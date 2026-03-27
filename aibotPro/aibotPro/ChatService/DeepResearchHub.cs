using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Betalgo.Ranul.OpenAI;
using Betalgo.Ranul.OpenAI.Managers;
using Betalgo.Ranul.OpenAI.ObjectModels.RequestModels;
using Microsoft.AspNetCore.SignalR;
using Newtonsoft.Json;
using System.Linq;
using TiktokenSharp;

namespace aibotPro.ChatService;

public class DeepResearchHub : Hub
{
    private readonly IFinanceService _financeService;
    private readonly IUsersService _usersService;
    private readonly IProductService _productService;
    private readonly IAiServer _aiServer;
    private readonly IRedisService _redisService;
    private readonly ChatCancellationManager _chatCancellationManager;
    private readonly IDeepResearchService _deepResearchService;
    private readonly AIBotProContext _context;
    private readonly ISystemService _systemService;
    private readonly DeepResearchBackgroundService _backgroundService;
    private TikToken _tikToken;
    public DeepResearchHub(IFinanceService financeService, IUsersService usersService, IProductService productService,
        IAiServer aiServer, IRedisService redisService, ChatCancellationManager chatCancellationManager,
        IDeepResearchService deepResearchService, AIBotProContext context, ISystemService systemService,
        DeepResearchBackgroundService backgroundService)
    {
        _financeService = financeService;
        _usersService = usersService;
        _productService = productService;
        _aiServer = aiServer;
        _redisService = redisService;
        _chatCancellationManager = chatCancellationManager;
        _deepResearchService = deepResearchService;
        _context = context;
        _systemService = systemService;
        _backgroundService = backgroundService;
        _tikToken = TikToken.GetEncoding("o200k_base");
    }

    // AI活动加入群组
    public async Task JoinGroup(string chatId)
    {
        try
        {
            if (string.IsNullOrEmpty(chatId))
            {
                var userName = Context.User?.Identity?.Name;
                if (string.IsNullOrEmpty(userName))
                {
                    throw new InvalidOperationException("用户身份验证失败");
                }

                chatId = userName + "_deepresearch_" + Guid.NewGuid().ToString("N");
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, chatId);

            //回复加入成功的chatId
            await Clients.Caller.SendAsync("JoinGroupSuccess", chatId);
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("Error", new { message = "加入群组失败", error = ex.Message });
        }
    }

    //开始研究
    public async Task StartResearch(DeepRequest deepRequest)
    {
        try
        {
            var Account = Context.User?.Identity?.Name;
            await SendAIActivity(deepRequest.chatId, Account, "任务提交", "任务提交中...", "fas fa-clock text-success", "loading");
            bool beforeCheck = await _deepResearchService.DeepResearchBeforeCheck(deepRequest.model, Account);
            if (!beforeCheck)
            {
                await SendAIActivity(deepRequest.chatId, Account, "任务提交", "余额不足,无法提交任务", "", "error");
                return;
            }
            // 立即返回确认消息给前端
            await SendAIActivity(deepRequest.chatId, Account, "任务提交", "任务提交完成", "", "success");
            // 创建后台任务对象
            var backgroundTask = new DeepResearchTask
            {
                ChatId = deepRequest.chatId,
                Account = Account,
                Title = deepRequest.title,
                SelectedQuestions = deepRequest.selectedQuestions,
                Model = deepRequest.model
            };

            // 将任务加入后台队列
            _backgroundService.EnqueueTask(backgroundTask);
        }
        catch (Exception ex)
        {
            // 记录错误日志
            await _systemService.WriteLog(ex.Message, Dtos.LogLevel.Error, "StartResearch");
            await SendAIActivity(deepRequest.chatId, Context.User?.Identity?.Name, "任务提交", "任务提交失败", "fas fa-exclamation-triangle text-danger", "error");
        }
    }

    private async Task SendAIActivity(string chatId, string account, string title, string message, string icon,
        string status)
    {
        try
        {
            var data = new Object();
            if (!string.IsNullOrEmpty(icon))
            {
                data = new
                {
                    chatId = chatId,
                    title = title,
                    message = message,
                    icon = icon,
                    status = status
                };
            }
            else
            {
                data = new
                {
                    chatId = chatId,
                    title = title,
                    newDescription = message,
                    status = status
                };
            }

            await Clients.Group(chatId).SendAsync("ReceiveActivityUpdate", data);
            // 保存活动到数据库
            await _deepResearchService.SaveAIActiveAsync(chatId, account, icon, title, message, status);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"SendAIActivity error: {ex.Message}");
        }
    }
    public async Task ChatWithAI(DeepChatRequest deepChatRequest)
    {
        try
        {
            var Account = Context.User?.Identity?.Name;
            string prompt = deepChatRequest.chatMessage;
            string model = deepChatRequest.model;
            string chatId = deepChatRequest.chatId;
            string deepResearchChatId = deepChatRequest.deepResearchChatId;
            string sysmsg = string.Empty;
            string output = string.Empty;
            string thinkmsg = string.Empty;
            bool insideThinkTag = false;
            int usageInput = 0;
            int usageOutput = 0;
            string sendMethod = "ReceiveDeepResearchChat";
            bool newChat = false;
            if (!string.IsNullOrEmpty(deepChatRequest.cacheKey))
            {
                prompt = await _redisService.GetAsync(deepChatRequest.cacheKey);
            }
            if (string.IsNullOrEmpty(chatId))
            {
                chatId = Account + "_deepchat_" + Guid.NewGuid().ToString("N");
                newChat = true;
            }
            var aiModel = _context.DeepResearchModels.Where(x => x.ModelName == model).FirstOrDefault();

            if (aiModel == null)
            {
                throw new InvalidOperationException($"未找到模型配置: {model}");
            }

            if (string.IsNullOrEmpty(aiModel.ApiKey) || string.IsNullOrEmpty(aiModel.BaseUrl))
            {
                throw new InvalidOperationException($"模型 {model} 配置不完整：缺少ApiKey或BaseUrl");
            }
            bool beforeCheck = await _deepResearchService.DeepResearchBeforeCheck(model, Account);
            if (!beforeCheck)
            {
                await Clients.Group(deepResearchChatId).SendAsync(sendMethod, new
                {
                    chatId = chatId,
                    message = "余额不足!",
                    status = "success"
                });
                return;
            }

            var OpenAIOptions = new OpenAIOptions
            {
                ApiKey = aiModel.ApiKey,
                BaseDomain = aiModel.BaseUrl
            };
            var openAiService = new OpenAIService(OpenAIOptions);

            // 生成系统提示词
            string systemPrompt = CreateSystemPrompt(deepResearchChatId, deepChatRequest.viewportContent);
            string historyStr = "";
            List<ChatMessage> chatMessages = new List<ChatMessage>();

            // 添加系统消息
            chatMessages.Add(ChatMessage.FromSystem(systemPrompt));

            if (newChat)
            {
                chatMessages.Add(ChatMessage.FromUser(prompt));
            }
            else
            {
                var histories = await _deepResearchService.GetDeepResearchChatHistoryAsync(deepChatRequest.deepResearchChatId, Account);
                foreach (var history in histories)
                {
                    if (history.Role == "user")
                    {
                        chatMessages.Add(ChatMessage.FromUser(history.Chat));
                    }
                    else
                    {
                        chatMessages.Add(ChatMessage.FromAssistant(history.Chat));
                    }
                    historyStr += history.Chat;
                }
                chatMessages.Add(ChatMessage.FromUser(prompt));
            }
            var chatCompletionCreate = new ChatCompletionCreateRequest();
            chatCompletionCreate.Messages = chatMessages;
            chatCompletionCreate.Model = model;
            chatCompletionCreate.Stream = true;
            chatCompletionCreate.StreamOptions = new StreamOptions
            {
                IncludeUsage = true
            };
            var (semaphore, cancellationToken) = _chatCancellationManager.GetOrCreateToken(chatId);
            try
            {
                var completionResult = openAiService.ChatCompletion.CreateCompletionAsStream(chatCompletionCreate,
                                   chatCompletionCreate.Model, true, cancellationToken);

                await foreach (var responseContent in completionResult.WithCancellation(cancellationToken))
                {
                    if (responseContent.Successful)
                    {
                        var choice = responseContent.Choices.FirstOrDefault();
                        if (choice != null)
                        {
                            if (choice.Message != null)
                            {
                                if (!string.IsNullOrEmpty(choice.Message.Content))
                                {
                                    string content = choice.Message.Content;

                                    // 检查是否包含<think>开始标签
                                    if (!insideThinkTag && content.Contains("<think>"))
                                    {
                                        insideThinkTag = true;
                                        int startIndex = content.IndexOf("<think>");

                                        // 处理<think>标签前的内容
                                        if (startIndex > 0)
                                        {
                                            string beforeThink = content.Substring(0, startIndex);
                                            sysmsg += beforeThink;
                                            await Clients.Group(deepResearchChatId).SendAsync(sendMethod, new
                                            {
                                                chatId = chatId,
                                                reasoning = beforeThink,
                                                status = "success"
                                            });
                                        }

                                        // 如果同时包含结束标签
                                        if (content.Contains("</think>"))
                                        {
                                            int endIndex = content.IndexOf("</think>");
                                            // 提取思考内容
                                            string thinkContent = content.Substring(startIndex + 7,
                                                endIndex - (startIndex + 7));
                                            thinkmsg += thinkContent;
                                            await Clients.Group(deepResearchChatId).SendAsync(sendMethod, new
                                            {
                                                chatId = chatId,
                                                reasoning = thinkContent,
                                                status = "success"
                                            });

                                            // 处理</think>标签后的内容
                                            if (endIndex + 8 < content.Length)
                                            {
                                                string afterThink = content.Substring(endIndex + 8);
                                                sysmsg += afterThink;
                                                await Clients.Group(deepResearchChatId).SendAsync(sendMethod, new
                                                {
                                                    chatId = chatId,
                                                    reasoning = afterThink,
                                                    status = "success"
                                                });
                                            }

                                            insideThinkTag = false;
                                        }
                                        else
                                        {
                                            // 提取并发送<think>后的内容
                                            string thinkContent = content.Substring(startIndex + 7);
                                            thinkmsg += thinkContent;
                                            await Clients.Group(deepResearchChatId).SendAsync(sendMethod, new
                                            {
                                                chatId = chatId,
                                                reasoning = thinkContent,
                                                status = "success"
                                            });
                                        }
                                    }
                                    // 检查是否包含</think>结束标签
                                    else if (insideThinkTag && content.Contains("</think>"))
                                    {
                                        int endIndex = content.IndexOf("</think>");

                                        // 处理</think>标签前的内容
                                        if (endIndex > 0)
                                        {
                                            string thinkContent = content.Substring(0, endIndex);
                                            thinkmsg += thinkContent;
                                            await Clients.Group(deepResearchChatId).SendAsync(sendMethod, new
                                            {
                                                chatId = chatId,
                                                reasoning = thinkContent,
                                                status = "success"
                                            });
                                        }

                                        // 处理</think>标签后的内容
                                        if (endIndex + 8 < content.Length)
                                        {
                                            string afterThink = content.Substring(endIndex + 8);
                                            sysmsg += afterThink;
                                            await Clients.Group(deepResearchChatId).SendAsync(sendMethod, new
                                            {
                                                chatId = chatId,
                                                reasoning = afterThink,
                                                status = "success"
                                            });
                                        }

                                        insideThinkTag = false;
                                    }
                                    // 如果已在<think>标签内，直接发送为思考内容
                                    else if (insideThinkTag)
                                    {
                                        thinkmsg += content;
                                        await Clients.Group(deepResearchChatId).SendAsync(sendMethod, new
                                        {
                                            chatId = chatId,
                                            message = content,
                                            status = "success"
                                        });
                                    }
                                    // 普通内容处理
                                    else
                                    {
                                        sysmsg += content;
                                        output += content;
                                        await Clients.Group(deepResearchChatId).SendAsync(sendMethod, new
                                        {
                                            chatId = chatId,
                                            message = content,
                                            status = "success"
                                        });
                                    }
                                }

                                if (!string.IsNullOrEmpty(choice.Message.ReasoningContent))
                                {
                                    thinkmsg += choice.Message.ReasoningContent;
                                    output += choice.Message.ReasoningContent;
                                    await Clients.Group(deepResearchChatId).SendAsync(sendMethod, new
                                    {
                                        chatId = chatId,
                                        reasoning = choice.Message.ReasoningContent,
                                        status = "success"
                                    });
                                }
                            }

                            if (responseContent.Usage != null)
                            {
                                usageInput = responseContent.Usage.PromptTokens;
                                usageOutput = responseContent.Usage.CompletionTokens.Value;
                            }
                        }
                    }
                }

                // 正常完成，保存聊天记录并发送完成状态
                await _deepResearchService.SaveDeepResearchChatHistoryAsync(chatId, deepResearchChatId, deepChatRequest.groupId, Account, "user", prompt, "", true, "", "");
                await _deepResearchService.SaveDeepResearchChatHistoryAsync(chatId, deepResearchChatId, deepChatRequest.groupId, Account, "assistant", sysmsg, thinkmsg, true, "", "");

                await Clients.Group(deepResearchChatId).SendAsync(sendMethod, new
                {
                    chatId = chatId,
                    message = "",
                    status = "finished"
                });

                if (usageInput == 0 || usageOutput == 0)
                {
                    usageInput = _tikToken.Encode(prompt + systemPrompt + historyStr).Count;
                    usageOutput = _tikToken.Encode(output).Count;
                }

                await _financeService.CreateUseLogAndUpadteMoney(Account, model,
                    usageInput, usageOutput);
            }
            catch (OperationCanceledException)
            {
                // 用户手动停止，保存已生成的内容并正常结算
                if (!string.IsNullOrEmpty(sysmsg) || !string.IsNullOrEmpty(thinkmsg))
                {
                    // 有内容则保存
                    await _deepResearchService.SaveDeepResearchChatHistoryAsync(chatId, deepResearchChatId, deepChatRequest.groupId, Account, "user", prompt, "", true, "", "");
                    await _deepResearchService.SaveDeepResearchChatHistoryAsync(chatId, deepResearchChatId, deepChatRequest.groupId, Account, "assistant", sysmsg, thinkmsg, true, "", "");
                }

                // 发送完成状态而不是错误状态
                await Clients.Group(deepResearchChatId).SendAsync(sendMethod, new
                {
                    chatId = chatId,
                    message = "",
                    status = "finished"
                });

                // 计算并扣费
                if (usageInput == 0 || usageOutput == 0)
                {
                    usageInput = _tikToken.Encode(prompt + systemPrompt + historyStr).Count;
                    usageOutput = _tikToken.Encode(output).Count;
                }

                if (usageInput > 0 || usageOutput > 0)
                {
                    await _financeService.CreateUseLogAndUpadteMoney(Account, model, usageInput, usageOutput);
                }

                // 记录日志但不抛出异常
                await _systemService.WriteLog($"深度研究聊天被用户停止: ChatId={chatId}", Dtos.LogLevel.Info, "DeepResearchChat");
                return; // 直接返回，不抛出异常
            }
            catch (Exception ex) when (!(ex is OperationCanceledException))
            {
                throw new InvalidOperationException($"内容生成失败: {ex.Message}");
            }
        }
        catch (Exception ex)
        {
            // 只处理非用户取消的异常
            if (!(ex is OperationCanceledException))
            {
                // 发送错误消息给前端
                await Clients.Group(deepChatRequest.deepResearchChatId).SendAsync("ReceiveDeepResearchChat", new
                {
                    chatId = deepChatRequest.chatId,
                    message = ex.Message,
                    status = "error"
                });

                // 记录错误日志
                await _systemService.WriteLog($"深度研究聊天失败: {ex.Message}", Dtos.LogLevel.Error, "DeepResearchChat");
            }
            // 对于OperationCanceledException，不做任何处理，因为已经在内部try-catch中处理了
        }
    }

    private string CreateSystemPrompt(string deepResearchChatId, string viewportContent)
    {
        var deepResearch = _context.DeepResearchLists.Where(x => x.ChatId == deepResearchChatId)
        .Select(x => x.DeepContent)
        .FirstOrDefault();

        // 获取研究报告内容
        if (string.IsNullOrEmpty(deepResearch))
        {
            return @"# AI Research Assistant System Prompt

## Role Definition
You are a professional AI research assistant, ready to help users with research-related questions and analysis.

## Language Guidelines
- **IMPORTANT**: Always respond in the same language as the user's message
- If user writes in Chinese, respond in Chinese
- If user writes in English, respond in English
- If user writes in other languages, respond in the same language

## Working Guidelines
1. **Professional Assistance**: Provide professional, accurate, and helpful responses
2. **Research Support**: Help users with research methodology, analysis, and insights
3. **Clear Communication**: Use clear structure and well-organized responses
4. **Comprehensive Analysis**: Provide detailed explanations when needed
5. **Objective Approach**: Maintain objectivity and evidence-based reasoning

## Response Requirements
- Match the user's language exactly
- Maintain professional and helpful tone
- Provide structured and detailed information
- Support users' research and learning needs

Please provide professional research assistance based on the user's needs.";
        }

        // 生成大纲字符串
        string outline = GenerateOutlineFromMarkdown(deepResearch);

        // 构建系统提示词
        var systemPrompt = $@"# AI Research Assistant System Prompt

## Role Definition
You are a professional AI research assistant specializing in providing detailed, accurate answers and analysis based on completed in-depth research reports.

## Research Report Outline
The following is the structural outline of the current research report:
{outline}

## Current Viewport Content
Content the user is currently viewing in the report:
```
{viewportContent ?? "No specific viewport content provided by user"}
```

## Language Guidelines
- **CRITICAL**: Always respond in the same language as the user's message
- If user writes in Chinese, respond in Chinese
- If user writes in English, respond in English
- If user writes in other languages, respond in the same language
- This language matching is mandatory and takes priority over all other instructions

## Working Guidelines
1. **Report-Based Responses**: All answers should be based on the above research report content, ensuring accuracy and consistency
2. **Viewport Integration**: Prioritize the content the user is currently viewing, providing relevant in-depth explanations
3. **Professional Approach**: Maintain professional tone and depth of analysis
4. **Structured Responses**: Use clear structure to organize answers, including headings and key points
5. **Report Citations**: Appropriately reference relevant sections or content from the report
6. **Contextual Expansion**: Provide reasonable expansion and explanation based on report content
7. **Consistency Maintenance**: Ensure answers align with the research report's viewpoints and conclusions

## Response Requirements
- **Language**: Respond in the exact same language as the user's message
- Maintain objective, professional attitude
- Provide specific, detailed information
- If user inquiries exceed report scope, clearly state this and suggest relevant report sections
- Support users' deep understanding and learning of report content

Please provide professional research consulting services based on the above information.";

        return systemPrompt;
    }

    /// <summary>
    /// 从Markdown内容生成大纲字符串
    /// </summary>
    /// <param name="markdownContent">Markdown内容</param>
    /// <returns>大纲字符串</returns>
    private string GenerateOutlineFromMarkdown(string markdownContent)
    {
        if (string.IsNullOrEmpty(markdownContent))
        {
            return "暂无大纲内容";
        }

        var lines = markdownContent.Split('\n');
        var outlineBuilder = new System.Text.StringBuilder();

        foreach (var line in lines)
        {
            var trimmedLine = line.Trim();

            // 匹配标题行（# ## ### #### ##### ######）
            if (trimmedLine.StartsWith("#") && !trimmedLine.StartsWith("#####"))
            {
                // 计算标题级别
                int level = 0;
                for (int i = 0; i < trimmedLine.Length && trimmedLine[i] == '#'; i++)
                {
                    level++;
                }

                // 提取标题文本
                string titleText = trimmedLine.Substring(level).Trim();

                if (!string.IsNullOrEmpty(titleText))
                {
                    // 根据级别添加缩进
                    string indent = new string(' ', (level - 1) * 2);
                    outlineBuilder.AppendLine($"{indent}- {titleText}");
                }
            }
        }

        return outlineBuilder.Length > 0 ? outlineBuilder.ToString().TrimEnd() : "暂无大纲内容";
    }

    public override async Task OnConnectedAsync()
    {
        await base.OnConnectedAsync();
    }
}