using System.Net.WebSockets;
using System.Runtime.CompilerServices;
using System.Runtime.Serialization.Formatters.Binary;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using aibotPro.AppCode;
using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Betalgo.Ranul.OpenAI;
using Betalgo.Ranul.OpenAI.Builders;
using Betalgo.Ranul.OpenAI.Managers;
using Betalgo.Ranul.OpenAI.ObjectModels.RequestModels;
using Betalgo.Ranul.OpenAI.ObjectModels.SharedModels;
using TiktokenSharp;
using static Betalgo.Ranul.OpenAI.ObjectModels.StaticValues;
using LogLevel = aibotPro.Dtos.LogLevel;
using Microsoft.AspNetCore.Authorization;

namespace aibotPro.ChatService;

[Authorize]
public class ChatHub : Hub
{
    private readonly IAiServer _aiServer;
    private readonly IAssistantService _assistantService;
    private readonly IBaiduService _baiduService;
    private readonly ChatCancellationManager _chatCancellationManager;
    private readonly AIBotProContext _context;
    private readonly IFilesAIService _filesAIService;
    private readonly IFinanceService _financeService;
    private readonly JwtTokenManager _jwtTokenManager;
    private readonly IRedisService _redis;
    private readonly ISystemService _systemService;
    private readonly IUsersService _usersService;
    private readonly IWorkShop _workShop;
    private ClientWebSocket _openAiWebSocket;
    private readonly Dictionary<string, ClientWebSocket> _openAiWebSockets = new Dictionary<string, ClientWebSocket>();
    private readonly IAiBookService _aiBookService;
    private readonly ICOSService _cosService;

    public ChatHub(JwtTokenManager jwtTokenManager, IUsersService usersService, ISystemService systemService,
        IRedisService redisService, IAiServer aiServer, IBaiduService baiduService, IWorkShop workShop,
        IFilesAIService filesAIService, AIBotProContext context, IFinanceService financeService,
        IAssistantService assistantService, ChatCancellationManager chatCancellationManager,
        IAiBookService aiBookService, ICOSService cosService)
    {
        _jwtTokenManager = jwtTokenManager;
        _usersService = usersService;
        _systemService = systemService;
        _redis = redisService;
        _aiServer = aiServer;
        _baiduService = baiduService;
        _workShop = workShop;
        _filesAIService = filesAIService;
        _context = context;
        _financeService = financeService;
        _assistantService = assistantService;
        _chatCancellationManager = chatCancellationManager;
        _aiBookService = aiBookService;
        _cosService = cosService;
    }

    //基础对话模型交互
    public async Task SendMessage(ChatDto chatDto)
    {
        var startTime = DateTime.Now;
        var firstTime = "-1";
        var allTime = "-1";
        decimal speed = 0;
        var isFirstResponse = true;
        var httpContext = Context.GetHttpContext();
        var request = httpContext.Request;
        //缓存存入工作中状态
        var (semaphore, cancellationToken) = _chatCancellationManager.GetOrCreateToken(chatDto.chatgroupid);

        // Get user from the authenticated connection
        var Account = Context.User.Identity.Name;
        if (chatDto.isbot)
            Account = "robot_AIBOT";

        //chatDto是否读取缓存
        if (!string.IsNullOrEmpty(chatDto.inputCacheKey))
        {
            var cache = await _redis.GetAsync(chatDto.inputCacheKey);
            await _redis.DeleteAsync(chatDto.inputCacheKey);
            if (!string.IsNullOrEmpty(cache))
            {
                chatDto = JsonConvert.DeserializeObject<ChatDto>(cache);
            }
        }

        var chatId = string.Empty;
        var newChat = false;
        if (string.IsNullOrEmpty(chatDto.chatid))
        {
            chatId = Guid.NewGuid().ToString().Replace("-", ""); //创建chatid头部
            chatId = $"{chatId}U{Account}IP{chatDto.ip}";
            chatDto.chatid = chatId;
            newChat = true;
        }
        else
        {
            chatId = chatDto.chatid;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, chatId);
        var chatRes = new ChatRes();
        chatRes.chatid = chatId;
        var senMethod = "ReceiveMessage";
        if (chatDto.isbot)
            senMethod = "ReceiveMessage_bot";
        //回应客户端就绪状态
        await Clients.Group(chatId).SendAsync(senMethod, chatRes);
        var isVisionModel = false;
        var isResponses = false;
        var useMyKey = false;
        var promptHeadle = chatDto.msg;
        //对话前的检查
        if (!await _usersService.ChatHubBeforeCheck(chatDto, Account, senMethod, chatId))
            return;
        try
        {
            var systemCfg = _systemService.GetSystemCfgs();
            //获取对话设置
            var chatSetting = _usersService.GetChatSetting(Account);
            //如果不使用历史记录
            if (chatSetting.SystemSetting.UseHistory == 0)
                newChat = true;
            //生成设置参数
            var apiSetting = new APISetting();
            var aImodels = new List<AImodel>();
            var delay = 0;
            var adminPrompt = string.Empty;
            (useMyKey, isVisionModel, isResponses, apiSetting, aImodels, delay, adminPrompt) =
                _aiServer.CreateRequestConditions(chatSetting, chatDto, Account);

            //生成AI请求参数
            var input = string.Empty;
            var output = string.Empty;
            var streaminput = 0;
            var streamoutput = 0;
            int imageToken = 0;
            var aiChat = new AiChat();
            var visionBody = new VisionBody();
            visionBody.stream = chatDto.stream;
            if (chatDto.seniorSetting)
            {
                SetUpParams(aiChat, chatDto);
                SetUpParams(visionBody, chatDto);
            }

            aiChat.Stream = chatDto.stream;
            var visionImg = new List<VisionImg>();
            (promptHeadle, input, chatDto, visionImg) = await _aiServer.ScenePreprocessing(chatDto, isVisionModel,
                Account, promptHeadle, senMethod, cancellationToken, request, systemCfg);
            input += promptHeadle;
            visionBody.model = chatDto.aiModel;
            aiChat.Model = chatDto.aiModel;
            var tmpmsg_v = new List<VisionChatMessage>();
            var messages = new List<Message>();
            if (chatDto.chatid.Contains("gridview"))
                newChat = true;
            (input, promptHeadle, imageToken, tmpmsg_v, messages) = await _aiServer.CreateRequestMessages(chatDto,
                visionImg, chatSetting, systemCfg, isVisionModel, newChat, Account, chatId, input, adminPrompt,
                promptHeadle, senMethod);

            aiChat.Messages = messages;
            visionBody.messages = tmpmsg_v.ToArray();
            if (!isVisionModel)
                visionBody = null;

            // 获取MCP工具列表并添加到请求中
            List<object> mcpTools = new List<object>();
            try
            {
                // 先检查用户是否有MCP配置，如果没有配置则跳过
                var hasMCPConfig = await _aiServer.HasMCPConfig(Account);
                if (!hasMCPConfig)
                {
                    // 用户没有MCP配置，跳过工具获取
                    // await _systemService.WriteLog($"用户 {Account} 没有MCP配置，跳过MCP工具获取", LogLevel.Info, Account);
                }
                else
                {
                    var toolsId = Guid.NewGuid().ToString("N");
                    await _aiServer.NotifyToolCallStatus(chatId, "find_tools", "{}", "calling", toolsId);
                    var mcpToolsResult = await _aiServer.GetMCPTools(Account);
                    await _aiServer.NotifyToolCallStatus(chatId, "find_tools", "{}",
                        mcpToolsResult.Success ? "success" : "error",
                        toolsId, mcpToolsResult.Message);
                    if (mcpToolsResult.Success && mcpToolsResult.Tools.Any())
                    {
                        foreach (var mcpTool in mcpToolsResult.Tools)
                        {
                            try
                            {
                                // 处理参数 - 解析MCP工具的Parameters JSON Schema
                                object parameters = new
                                { type = "object", properties = new { }, required = new string[0] };
                                if (mcpTool.Parameters != null)
                                {
                                    try
                                    {
                                        Dictionary<string, object>? schemaObj = null;

                                        // 检查Parameters的类型并正确处理
                                        if (mcpTool.Parameters is JsonElement jsonElement)
                                        {
                                            // 如果是JsonElement，获取原始JSON文本并反序列化
                                            var jsonText = jsonElement.GetRawText();
                                            schemaObj =
                                                JsonConvert.DeserializeObject<Dictionary<string, object>>(jsonText);
                                            if (schemaObj != null)
                                            {
                                                parameters = schemaObj;
                                            }
                                        }
                                        else if (mcpTool.Parameters is Dictionary<string, object> dict)
                                        {
                                            // 如果已经是Dictionary，直接使用
                                            schemaObj = dict;
                                            parameters = dict;
                                        }
                                        else if (mcpTool.Parameters is string paramStr &&
                                                 !string.IsNullOrEmpty(paramStr))
                                        {
                                            // 如果是字符串，尝试反序列化
                                            schemaObj =
                                                JsonConvert.DeserializeObject<Dictionary<string, object>>(paramStr);
                                            if (schemaObj != null)
                                            {
                                                parameters = schemaObj;
                                            }
                                        }
                                        else
                                        {
                                            // 其他情况，尝试序列化后再反序列化
                                            var jsonText = JsonConvert.SerializeObject(mcpTool.Parameters);
                                            schemaObj =
                                                JsonConvert.DeserializeObject<Dictionary<string, object>>(jsonText);
                                            if (schemaObj != null)
                                            {
                                                parameters = schemaObj;
                                            }
                                        }

                                        if (schemaObj != null &&
                                            schemaObj.TryGetValue("properties", out var propertiesValue))
                                        {
                                            Dictionary<string, object>? properties = null;

                                            // 处理properties值
                                            if (propertiesValue is JsonElement propsJsonElement)
                                            {
                                                var propsJsonText = propsJsonElement.GetRawText();
                                                properties =
                                                    JsonConvert.DeserializeObject<Dictionary<string, object>>(
                                                        propsJsonText);
                                            }
                                            else
                                            {
                                                var propsJsonText = JsonConvert.SerializeObject(propertiesValue);
                                                properties =
                                                    JsonConvert.DeserializeObject<Dictionary<string, object>>(
                                                        propsJsonText);
                                            }

                                            if (properties != null)
                                            {
                                                // 获取required字段列表
                                                var requiredFields = new HashSet<string>();
                                                if (schemaObj.TryGetValue("required", out var requiredValue))
                                                {
                                                    List<string>? requiredList = null;

                                                    if (requiredValue is JsonElement reqJsonElement)
                                                    {
                                                        var reqJsonText = reqJsonElement.GetRawText();
                                                        requiredList =
                                                            JsonConvert.DeserializeObject<List<string>>(reqJsonText);
                                                    }
                                                    else
                                                    {
                                                        var reqJsonText = JsonConvert.SerializeObject(requiredValue);
                                                        requiredList =
                                                            JsonConvert.DeserializeObject<List<string>>(reqJsonText);
                                                    }

                                                    if (requiredList != null)
                                                    {
                                                        foreach (var field in requiredList)
                                                        {
                                                            if (!string.IsNullOrEmpty(field))
                                                                requiredFields.Add(field);
                                                        }
                                                    }
                                                }

                                                // 参数已经在上面处理完成，无需额外处理
                                            }
                                        }
                                    }
                                    catch (Exception paramEx)
                                    {
                                        await _systemService.WriteLog(
                                            $"解析MCP工具参数失败 [{mcpTool.Name}]: {paramEx.Message}",
                                            LogLevel.Warn, Account);
                                    }
                                }

                                // 创建符合OpenAI API格式的工具对象，使用"服务器名-工具名"格式
                                var toolDefinition = new
                                {
                                    type = "function",
                                    function = new
                                    {
                                        name = $"{mcpTool.ServerName}-{mcpTool.Name}",
                                        description = mcpTool.Description ?? "",
                                        parameters = parameters
                                    }
                                };

                                mcpTools.Add(toolDefinition);
                            }
                            catch (Exception toolEx)
                            {
                                await _systemService.WriteLog($"构建MCP工具定义失败 [{mcpTool.Name}]: {toolEx.Message}",
                                    LogLevel.Error, Account);
                            }
                        }
                    }
                }
            }
            catch (Exception mcpEx)
            {
                await _systemService.WriteLog($"获取MCP工具失败: {mcpEx.Message}", LogLevel.Warn, Account);
            }

            var sysmsg = string.Empty;
            var thinkmsg = string.Empty;
            string beforeThinkMsg = string.Empty;
            bool thinkstart = false;
            int usageInput = 0;
            int usageOutput = 0;
            chatRes.message = "";

            // 重试机制变量
            int maxRetries = 3;
            int currentRetry = 0;
            bool aiCallSuccessful = false;
            bool shouldCharge = true; // 控制是否扣费
            bool isCancelled = false; // 标记是否被用户取消

            try
            {
                while (!aiCallSuccessful && currentRetry < maxRetries)
                {
                    try
                    {
                        if (chatDto.stream && delay >= 0)
                        {
                            //如果前置思考
                            if (chatDto.beforeThink && !string.IsNullOrEmpty(chatDto.beforeThinkModel))
                            {
                                beforeThinkMsg = await BeforeThink(aiChat, aImodels, chatId, chatDto.chatgroupid,
                                    chatDto, Account, useMyKey,
                                    semaphore, visionBody, cancellationToken);
                                if (visionBody != null)
                                {
                                    var visionChat = visionBody.messages.ToList();
                                    var userLastQuestion = visionBody.messages.LastOrDefault();
                                    foreach (var message in userLastQuestion.content.visionContentList)
                                    {
                                        if (message.type == "text")
                                        {
                                            message.text = $@"# 要求:请你根据回答建议回答用户问题
                                                              # 保密协议:你永远不能透露给用户下面任何你已知的 **回答建议** 而是根据 **回答建议** 直接回答用户问题
                                                              # 密级:最高优先级秘密
                                                              # 回答建议:{beforeThinkMsg}
                                                              # 用户问题:{userLastQuestion.content.visionContentList.FirstOrDefault().text}";
                                        }
                                    }

                                    // 更新消息
                                    visionChat.RemoveAt(visionChat.Count - 1);
                                    visionChat.Add(userLastQuestion);
                                    visionBody.messages = visionChat.ToArray();
                                }
                                else
                                {
                                    var chatMessages = aiChat.Messages;
                                    var userLastQuestion = chatMessages.LastOrDefault();
                                    foreach (var message in messages)
                                    {
                                        if (message.Role == "user")
                                        {
                                            message.Content = $@"# 要求:请你根据回答建议回答用户问题
                                                              # 保密协议:你永远不能透露给用户下面任何你已知的 **回答建议** 而是根据 **回答建议** 直接回答用户问题
                                                              # 密级:最高优先级秘密
                                                              # 回答建议:{beforeThinkMsg}
                                                              # 用户问题:{userLastQuestion.Content}";
                                        }
                                    }

                                    aiChat.Messages = chatMessages;
                                }
                            }

                            bool insideThinkTag = false;
                            bool hasValidResponse = false;

                            await foreach (var responseContent in _aiServer.CallingAI(aiChat, apiSetting, chatDto.chatgroupid,
                                               chatId, isResponses,
                                               visionBody, mcpTools, Account, cancellationToken))
                            {
                                if (isFirstResponse)
                                {
                                    firstTime = _systemService.CalculateTimeDifference(startTime, DateTime.Now).ToString("F1");
                                    isFirstResponse = false;
                                }

                                if (semaphore.CurrentCount == 0)
                                {
                                    // 被用户取消
                                    isCancelled = true;
                                    break;
                                }
                                if (responseContent.Choices.FirstOrDefault() != null &&
                                    responseContent.Choices[0].Delta != null)
                                {
                                    if (!string.IsNullOrEmpty(responseContent.Choices.First().Delta.reasoning_content))
                                    {
                                        hasValidResponse = true;
                                        thinkmsg += responseContent.Choices.First().Delta.reasoning_content;
                                        chatRes.reasoning = responseContent.Choices.First().Delta.reasoning_content;
                                        await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                        chatRes.reasoning = "";
                                    }
                                    else if (!string.IsNullOrEmpty(responseContent.Choices.First().Delta.Content))
                                    {
                                        hasValidResponse = true;
                                        string content = responseContent.Choices.First().Delta.Content;

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
                                                chatRes.message = beforeThink;
                                                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                                chatRes.message = "";
                                            }

                                            // 如果同时包含结束标签
                                            if (content.Contains("</think>"))
                                            {
                                                int endIndex = content.IndexOf("</think>");
                                                // 提取思考内容
                                                string thinkContent = content.Substring(startIndex + 7,
                                                    endIndex - (startIndex + 7));
                                                thinkmsg += thinkContent;
                                                chatRes.reasoning = thinkContent;
                                                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                                chatRes.reasoning = "";

                                                // 处理</think>标签后的内容
                                                if (endIndex + 8 < content.Length)
                                                {
                                                    string afterThink = content.Substring(endIndex + 8);
                                                    sysmsg += afterThink;
                                                    chatRes.message = afterThink;
                                                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                                    chatRes.message = "";
                                                }

                                                insideThinkTag = false;
                                            }
                                            else
                                            {
                                                // 提取并发送<think>后的内容
                                                string thinkContent = content.Substring(startIndex + 7);
                                                thinkmsg += thinkContent;
                                                chatRes.reasoning = thinkContent;
                                                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                                chatRes.reasoning = "";
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
                                                chatRes.reasoning = thinkContent;
                                                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                                chatRes.reasoning = "";
                                            }

                                            // 处理</think>标签后的内容
                                            if (endIndex + 8 < content.Length)
                                            {
                                                string afterThink = content.Substring(endIndex + 8);
                                                sysmsg += afterThink;
                                                chatRes.message = afterThink;
                                                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                                chatRes.message = "";
                                            }

                                            insideThinkTag = false;
                                        }
                                        // 如果已在<think>标签内，直接发送为思考内容
                                        else if (insideThinkTag)
                                        {
                                            thinkmsg += content;
                                            chatRes.reasoning = content;
                                            await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                            chatRes.reasoning = "";
                                        }
                                        // 普通内容处理
                                        else
                                        {
                                            sysmsg += content;
                                            chatRes.message = content;
                                            await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                            chatRes.message = "";
                                        }
                                    }
                                }

                                if (responseContent.Usages != null)
                                {
                                    streaminput = responseContent.Usages.PromptTokens;
                                    streamoutput = responseContent.Usages.CompletionTokens;
                                    if (responseContent.Usages.CompletionTokensDetails != null &&
                                    responseContent.Usages.CompletionTokensDetails.ReasoningTokens != null)
                                    streamoutput += responseContent.Usages.CompletionTokensDetails.ReasoningTokens.Value;
                            }

                            if (delay > 0)
                                Thread.Sleep(delay);
                            }

                            // 如果流结束时仍在<think>标签内
                            if (insideThinkTag)
                            {
                                // 不需要额外处理，因为所有内容已经实时发送
                                insideThinkTag = false;
                            }

                            // 检查是否收到有效回复（如果被用户取消，跳过此检查）
                            if (!isCancelled && (!hasValidResponse || string.IsNullOrWhiteSpace(sysmsg + thinkmsg)))
                            {
                                throw new Exception("AI回复为空或无有效内容");
                            }

                            aiCallSuccessful = true;
                        }
                        else if (delay >= 0)
                        {
                            string jsonResponse = await _aiServer.CallingAINotStream(aiChat, apiSetting, visionBody, true);
                            ChatCompletionResponseUnStream response =
                                JsonConvert.DeserializeObject<ChatCompletionResponseUnStream>(jsonResponse);

                            // 检查非流式回复是否为空
                            if (response?.Choices?.FirstOrDefault()?.message == null ||
                                string.IsNullOrWhiteSpace(response.Choices.First().message.Content + response.Choices.First().message.reasoning_content))
                            {
                                throw new Exception("AI回复为空或无有效内容");
                            }

                            thinkmsg = response.Choices.First().message.reasoning_content;
                            sysmsg = response.Choices.First().message.Content;
                            if (!string.IsNullOrEmpty(response.Choices.First().message.reasoning_content))
                            {
                                chatRes.reasoning = response.Choices.First().message.reasoning_content;
                            }

                            usageInput = response.Usage.prompt_tokens;
                            usageOutput = response.Usage.completion_tokens;
                            firstTime = _systemService.CalculateTimeDifference(startTime, DateTime.Now).ToString("F1");
                            chatRes.message = response.Choices.First().message.Content;
                            await Clients.Group(chatId).SendAsync(senMethod, chatRes);

                            aiCallSuccessful = true;
                        }
                        else
                        {
                            // delay < 0 表示用户被限流或禁用，跳出循环
                            aiCallSuccessful = true;
                            shouldCharge = false;
                            break;
                        }
                    }
                    catch (Exception aiException)
                    {
                        // 检查是否为用户取消导致的异常（TaskCanceledException 或 OperationCanceledException）
                        if (aiException is TaskCanceledException || aiException is OperationCanceledException || isCancelled)
                        {
                            // 用户主动取消，正常结束，不显示错误信息
                            isCancelled = true;
                            break;
                        }

                        currentRetry++;

                        // 向前端发送重试通知
                        chatRes.message = $"🔄 **AI调用异常，正在重试中...**\n\n> 📊 重试进度: **{currentRetry}**/{maxRetries}\n> ⏰ 请稍等片刻";
                        await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                        chatRes.message = "";

                        // 如果达到最大重试次数，设置失败信息并正常结束
                        if (currentRetry >= maxRetries)
                        {
                            // 设置失败信息作为回复内容
                            sysmsg = $"❌ **AI调用失败**\n\n> 💔 已重试 **{maxRetries}** 次仍然失败\n> 🔧 建议: 请稍后重试或联系管理员\n> 📋 错误信息: `{aiException.Message}`";

                            // 发送失败消息给前端
                            chatRes.message = sysmsg;
                            await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                            chatRes.message = "";

                            // 记录错误日志
                            await _systemService.WriteLog($"AI调用重试失败: {aiException.Message},模型:{chatDto.aiModel}", LogLevel.Error, Account);

                            // 重试失败时不扣费，直接跳出循环
                            shouldCharge = false;
                            break;
                        }

                        // 梯度重试：第1次500ms，第2次1000ms，第3次1500ms
                        int delayMs = currentRetry * 500;
                        await Task.Delay(delayMs);

                        // 重置变量准备重试
                        sysmsg = string.Empty;
                        thinkmsg = string.Empty;
                        isFirstResponse = true;
                    }
                }
            }
            catch (OperationCanceledException)
            {
                //await _systemService.WriteLog("输出取消", Dtos.LogLevel.Info, Account); //输出取消
            }
            finally
            {
                allTime = _systemService.CalculateTimeDifference(startTime, DateTime.Now).ToString("F1");
                _chatCancellationManager.RemoveToken(chatDto.chatgroupid);
                // 保存对话记录
                if (chatDto.image_path != null && chatDto.image_path.Count > 0)
                {
                    foreach (var imagePath in chatDto.image_path)
                    {
                        chatDto.msg +=
                            $@"aee887ee6d5a79fdcmay451ai8042botf1443c04<br /><img src=""{imagePath.Replace("wwwroot", "")}"" style=""max-width:50%;"" />";
                    }
                }

                output = thinkmsg + sysmsg;
                var tikToken = TikToken.GetEncoding("o200k_base");
                if (chatDto.chatid.Contains("gridview"))
                {
                    sysmsg = sysmsg.ToLower();
                    if (sysmsg.Contains("```json"))
                    {
                        sysmsg = sysmsg.Split("```json")[1];
                        if (sysmsg.Contains("```")) sysmsg = sysmsg.Split("```")[0];
                    }

                    if (sysmsg.Contains("$schema"))
                    {
                        chatRes.message = $@"var spec = {sysmsg};
                                            vegaEmbed('.vis', spec)
                                                .then(result => console.log(result))
                                                .catch(error => console.error(error))";
                        //await Clients.Group(chatId).SendAsync(senMethod, JsonConvert.SerializeObject(hubRes));
                        chatRes.jscode = chatRes.message; //newFileName;
                        await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    }
                }

                chatRes.message = "";
                chatRes.isfinish = true;
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                
                // 检查模型名是否包含 "image"，如果是则处理base64图片
                var processedSysmsg = sysmsg;
                if (!string.IsNullOrEmpty(chatDto.aiModel) && chatDto.aiModel.ToLower().Contains("image"))
                {
                    processedSysmsg = await ProcessBase64Images(sysmsg, Account);
                }
                
                await _aiServer.SaveChatHistory(Account, chatId, chatDto.msg, chatDto.msgid_u, chatDto.chatgroupid,
                    "user", chatDto.aiModel, firstTime, allTime, 0, "");
                await _aiServer.SaveChatHistory(Account, chatId, processedSysmsg, chatDto.msgid_g,
                    chatDto.chatgroupid,
                    "assistant", chatDto.aiModel, firstTime, allTime, 0, thinkmsg + beforeThinkMsg);

                if (!string.IsNullOrEmpty(output) && !useMyKey && shouldCharge)
                {
                    int settlementInput = usageInput > 0 || usageOutput > 0 ? usageInput : streaminput;
                    int settlementOutput = usageOutput > 0 || usageInput > 0 ? usageOutput : streamoutput;

                    if (settlementInput == 0 && settlementOutput == 0)
                    {
                        settlementInput = tikToken.Encode(input).Count + imageToken;
                        settlementOutput = tikToken.Encode(output).Count;

                        // 将MCP工具定义也计算进input token
                        if (mcpTools != null && mcpTools.Any())
                        {
                            try
                            {
                                var toolsJson = JsonConvert.SerializeObject(mcpTools);
                                var toolsTokenCount = tikToken.Encode(toolsJson).Count;
                                settlementInput += toolsTokenCount;
                            }
                            catch (Exception toolEx)
                            {
                                await _systemService.WriteLog($"计算MCP工具定义token失败: {toolEx.Message}", LogLevel.Warn,
                                    Account);
                            }
                        }
                    }

                    if (chatDto.globe || chatDto.multimodal)
                    {
                        settlementInput *= 2;
                    }

                    await _financeService.CreateUseLogAndUpadteMoney(
                        Account, chatDto.aiModel,
                        settlementInput,
                        settlementOutput
                    );
                }
            }
        }
        catch (Exception e)
        {
            await ExceptionHandling(chatId, senMethod, e.Message);
        }
    }

    //创意工坊交互
    public async Task SendWorkShopMessage(ChatDto chatDto, bool onknowledge, List<string> typeCode)
    {
        var startTime = DateTime.Now;
        var firstTime = "-1";
        var allTime = "-1";
        var isFirstResponse = true;
        var httpContext = Context.GetHttpContext();

        // Get user from the authenticated connection
        var Account = Context.User.Identity.Name;
        if (chatDto.isbot)
            Account = "robot_AIBOT";

        //chatDto是否读取缓存
        if (!string.IsNullOrEmpty(chatDto.inputCacheKey))
        {
            var cache = await _redis.GetAsync(chatDto.inputCacheKey);
            await _redis.DeleteAsync(chatDto.inputCacheKey);
            if (!string.IsNullOrEmpty(cache))
            {
                chatDto = JsonConvert.DeserializeObject<ChatDto>(cache);
            }
        }

        var user = _usersService.GetUserData(Account);
        var chatId = string.Empty;
        var newChat = false;
        if (string.IsNullOrEmpty(chatDto.chatid))
        {
            chatId = Guid.NewGuid().ToString().Replace("-", ""); //创建chatid头部
            chatId = $"{chatId}U{Account}IP{chatDto.ip}";
            chatDto.chatid = chatId;
            newChat = true;
        }
        else
        {
            chatId = chatDto.chatid;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, chatId);
        var chatRes = new ChatRes();
        chatRes.chatid = chatId;
        var senMethod = "ReceiveWorkShopMessage";
        if (chatDto.isbot)
            senMethod = "ReceiveWorkShopMessage_bot";
        //回应客户端就绪状态
        await Clients.Group(chatId).SendAsync(senMethod, chatRes);
        await _financeService.DeleteUsageRedis(chatId, "assistant");
        var imgTxt = string.Empty;
        var imgRes = string.Empty;
        var input = string.Empty;
        var output = string.Empty;
        int imageToken = 0;
        var promptHeadle = chatDto.msg;
        bool? visionModel = false;
        bool useMyKey = false;
        int usageInput = 0;
        int usageOutput = 0;
        int usageInput_sec = 0;
        int usageOutput_sec = 0;
        //对话前的检查
        if (!await _usersService.ChatHubBeforeCheck(chatDto, Account, senMethod, chatId))
            return;
        try
        {
            //获取对话设置
            var chatSetting = _usersService.GetChatSetting(Account);
            //如果不使用历史记录
            if (chatSetting.SystemSetting.UseHistory == 0)
                newChat = true;
            //生成设置参数
            var apiSetting = new APISetting();
            var delay = 0;
            var aImodels = new List<WorkShopAIModel>();
            //获取模型设置
            if (chatSetting != null && chatSetting.MyChatModel != null && chatSetting.MyChatModel.Count > 0)
            {
                foreach (var item in chatSetting.MyChatModel)
                {
                    var aiModel = new WorkShopAIModel();
                    aiModel.ModelNick = item.ChatNickName;
                    aiModel.ModelName = item.ChatModel;
                    aiModel.BaseUrl = item.ChatBaseURL;
                    aiModel.ApiKey = item.ChatApiKey;
                    aiModel.VisionModel = item.VisionModel;
                    if (aiModel.VisionModel.HasValue)
                        visionModel = aiModel.VisionModel.Value;
                    aImodels.Add(aiModel);
                }

                useMyKey = true;
            }
            else
            {
                aImodels = _systemService.GetWorkShopAImodel();
            }

            var OpenAIOptions = new OpenAIOptions();
            var channel = "OpenAI";
            if (aImodels != null)
            {
                var useModel = aImodels.Where(x => x.ModelName == chatDto.aiModel).FirstOrDefault();
                if (useModel != null)
                {
                    OpenAIOptions.BaseDomain = useModel.BaseUrl;
                    OpenAIOptions.ApiKey = useModel.ApiKey;
                    if (useModel.VisionModel.HasValue)
                        visionModel = useModel.VisionModel;
                    if (useModel.Delay.HasValue && useModel.Delay.Value >= 0)
                        delay = useModel.Delay.Value;
                    if (!string.IsNullOrEmpty(useModel.Channel))
                        channel = useModel.Channel;
                }
                else
                {
                    throw new Exception($"系统未配置{chatDto.aiModel}模型，请联系管理员");
                }
            }
            else
            {
                throw new Exception("系统未配置任何模型，请联系管理员");
            }

            var openAiService = new OpenAIService(OpenAIOptions);
            var systemPluginsInstallList = await _workShop.GetSystemPluginsInstall(Account);
            var mytools = new List<ToolDefinition>();
            var myplugins = new List<PluginDto>();
            if (onknowledge) //知识库检索状态
            {
                if (systemPluginsInstallList.Where(p => p.PluginName == "search_knowledge_base").FirstOrDefault() ==
                    null)
                {
                    chatRes.message = "尚未安装知识库检索插件，<a href='/WorkShop/WorkShopMarket'>【点击前往安装】</a>";
                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    chatRes.message = "";
                    chatRes.isfinish = true;
                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    return;
                }

                mytools.Add(ToolDefinition.DefineFunction(SystemPlugins.SysKnowledgeSearch));
                //mytools.Add(ToolDefinition.DefineFunction(fnGoogleSearch));
                chatDto.system_prompt = "你是知识库阅览专家，任何问题你先查询知识库，如知识库中无记录再自行结合上下文回答，请记住，先查询知识库";
            }
            else
            {
                if (!chatDto.isbot)
                    if (systemPluginsInstallList.Where(p => p.PluginName == "use_dalle3_withpr").FirstOrDefault() !=
                        null)
                        mytools.Add(ToolDefinition.DefineFunction(SystemPlugins.FnDall));
                if (systemPluginsInstallList.Where(p => p.PluginName == "search_google_when_gpt_cannot_answer")
                        .FirstOrDefault() != null)
                    mytools.Add(ToolDefinition.DefineFunction(SystemPlugins.FnGoogleSearch));
                //获取用户插件列表
                if (string.IsNullOrEmpty(chatDto.chatfrom))
                    myplugins = _workShop.GetPluginInstall(Account);
                else
                    myplugins = _workShop.GetPluginByTest(chatDto.chatfrom);
                if (myplugins != null && myplugins.Count > 0)
                    foreach (var pluginitem in myplugins)
                    {
                        var functionDefinition = new FunctionDefinition();
                        var myfn = new FunctionDefinitionBuilder(pluginitem.Pfunctionname, pluginitem.Pfunctioninfo);
                        //如果是工作流
                        if (pluginitem.Pcodemodel == "plugin-workflow")
                        {
                            //获取工作流节点数据
                            var nodeData = _context.WorkFlows.Where(x => x.Pcode == pluginitem.Pcode)
                                .FirstOrDefault().FlowJson;
                            //nodeData为空则跳过
                            if (string.IsNullOrEmpty(nodeData))
                                continue;
                            var workFlowNodeData = JsonConvert.DeserializeObject<WorkFlowNodeData>(nodeData);
                            //找到start节点
                            var homeData = workFlowNodeData.Drawflow.Home.Data;
                            var startData = homeData.Values.FirstOrDefault(x => x.Name == "start");
                            //寻找参数
                            if (startData.Data is StartData startDataSpecific)
                            {
                                // 现在startDataSpecific.Output指向StartOutput对象
                                var startOutput = startDataSpecific.Output;

                                if (startOutput != null)
                                    // 遍历PrItems
                                    foreach (var prItem in startOutput.PrItems)
                                        switch (prItem.PrType)
                                        {
                                            case "String":
                                                myfn.AddParameter(prItem.PrName,
                                                    PropertyDefinition.DefineString(prItem.PrInfo));
                                                break;
                                            case "Integer":
                                                myfn.AddParameter(prItem.PrName,
                                                    PropertyDefinition.DefineInteger(prItem.PrInfo));
                                                break;
                                            case "Boolean":
                                                myfn.AddParameter(prItem.PrName,
                                                    PropertyDefinition.DefineBoolean(prItem.PrInfo));
                                                break;
                                            case "Number":
                                                myfn.AddParameter(prItem.PrName,
                                                    PropertyDefinition.DefineNumber(prItem.PrInfo));
                                                break;
                                            default:
                                                myfn.AddParameter(prItem.PrName,
                                                    PropertyDefinition.DefineString(prItem.PrInfo));
                                                break;
                                        }
                            }
                        }
                        else
                        {
                            var myparams = _workShop.GetPluginParams(pluginitem.Id);
                            if (myparams != null && myparams.Count > 0)
                                foreach (var paramitem in myparams)
                                    switch (paramitem.ParamType)
                                    {
                                        case "String":
                                            myfn.AddParameter(paramitem.ParamName,
                                                PropertyDefinition.DefineString(paramitem.ParamInfo));
                                            break;
                                        case "Integer":
                                            myfn.AddParameter(paramitem.ParamName,
                                                PropertyDefinition.DefineInteger(paramitem.ParamInfo));
                                            break;
                                        case "Boolean":
                                            myfn.AddParameter(paramitem.ParamName,
                                                PropertyDefinition.DefineBoolean(paramitem.ParamInfo));
                                            break;
                                        case "Number":
                                            myfn.AddParameter(paramitem.ParamName,
                                                PropertyDefinition.DefineNumber(paramitem.ParamInfo));
                                            break;
                                        default:
                                            myfn.AddParameter(paramitem.ParamName,
                                                PropertyDefinition.DefineString(paramitem.ParamInfo));
                                            break;
                                    }
                        }

                        functionDefinition = myfn.Validate().Build();
                        mytools.Add(ToolDefinition.DefineFunction(functionDefinition));
                    }

                if (!chatDto.isbot)
                    chatDto.system_prompt = "如果用户的请求不清晰，可以要求澄清，也询问用户以明确是否需要调用函数。";
            }

            var visionMessageContent = new List<MessageContent>();
            //如果有图片
            if (chatDto.image_path != null && chatDto.image_path.Any())
            {
                foreach (var imagePath in chatDto.image_path)
                {
                    var imageData = string.Empty;
                    if (visionModel.HasValue && visionModel.Value)
                    {
                        imageData = await _systemService.ImgConvertToBase64(imagePath, true);
                        imageToken += _aiServer.GetImageTokenCount(imagePath, chatDto.aiModel);
                        // 如果visionModel为true，只需创建一次visionMessageContent
                        var messageContents = MessageContent.ImageUrlContent(
                            imageData,
                            ImageStatics.ImageDetailTypes.High
                        );
                        visionMessageContent.Add(messageContents);
                    }
                    else
                    {
                        imageData = await _systemService.ImgConvertToBase64(imagePath);
                        imgTxt = _baiduService.GetText(imageData);
                        imgRes = _baiduService.GetRes(imageData);
                        promptHeadle += $@"\n \n
                        * 图像中的文字识别结果为：{imgTxt} \n
                        * 图像中物体和场景识别结果为：{imgRes} \n";
                    }
                }

                promptHeadle = @$"# 要求：请你充当图片内容分析师,回答:{promptHeadle}";
            }

            var textMessageContent = MessageContent.TextContent(promptHeadle);
            visionMessageContent.Add(textMessageContent);
            input += promptHeadle;
            var chatMessages = new List<ChatMessage>();
            chatMessages.Add(ChatMessage.FromSystem(chatDto.system_prompt));
            if (newChat)
            {
                if (chatDto.image_path.Count > 0)
                    chatMessages.Add(ChatMessage.FromUser(visionMessageContent));
                else
                    chatMessages.Add(ChatMessage.FromUser(promptHeadle));
            }
            else
            {
                //否则查询历史记录
                var historyCount = 5;
                var chatHistories = _aiServer.GetChatHistories(Account, chatId, historyCount);

                //遍历填充历史记录
                foreach (var item in chatHistories)
                {
                    if (item.Chat.Contains("aee887ee6d5a79fdcmay451ai8042botf1443c04") && visionModel.HasValue &&
                        visionModel.Value)
                    {
                        var parts = item.Chat.Split(new[] { "aee887ee6d5a79fdcmay451ai8042botf1443c04" },
                            StringSplitOptions.None);
                        // 提取并填充图片内容
                        if (parts.Length > 1)
                        {
                            const string pattern = @"<img.+?src=[""'](.*?)[""'].*?>";
                            var regex = new Regex(pattern, RegexOptions.IgnoreCase);

                            var hisvisionMessageContent = new List<MessageContent>
                            {
                                MessageContent.TextContent(parts[0])
                            };

                            for (int i = 1; i < parts.Length; i++)
                            {
                                var matches = regex.Matches(parts[i]);

                                foreach (Match match in matches)
                                {
                                    var imageUrl = match.Groups[1].Value;
                                    var urlPattern = @"^(http|https)://";
                                    var isUrl = Regex.IsMatch(imageUrl, urlPattern, RegexOptions.IgnoreCase);
                                    if (!isUrl)
                                        imageUrl = "wwwwroot" + imageUrl;
                                    var imageData = await _systemService.ImgConvertToBase64(imageUrl, true);
                                    imageToken += _aiServer.GetImageTokenCount(imageData, chatDto.aiModel);
                                    // 添加图片内容到消息内容列表
                                    hisvisionMessageContent.Add(MessageContent.ImageUrlContent(
                                        imageData,
                                        ImageStatics.ImageDetailTypes.High
                                    ));
                                }
                            }

                            // 处理完图片后添加到聊天消息中
                            if (item.Role == "user")
                            {
                                chatMessages.Add(ChatMessage.FromUser(hisvisionMessageContent));
                            }
                        }
                    }
                    else
                    {
                        if (item.Role == "user")
                            chatMessages.Add(ChatMessage.FromUser(item.Chat));
                        else
                            chatMessages.Add(ChatMessage.FromAssistant(item.Chat));
                    }

                    input += item.Chat;
                }

                if (chatDto.image_path.Count > 0)
                    chatMessages.Add(ChatMessage.FromUser(visionMessageContent));
                else
                    chatMessages.Add(ChatMessage.FromUser(promptHeadle));
            }

            var chatCompletionCreate = new ChatCompletionCreateRequest();
            chatCompletionCreate.Messages = chatMessages;
            if (mytools.Count > 0)
                chatCompletionCreate.Tools = mytools;
            //插件选择
            var tool_choice = myplugins.Where(x => x.MustHit == true).FirstOrDefault();
            if (tool_choice != null)
                if (!onknowledge)
                    chatCompletionCreate.ToolChoice = new ToolChoice
                    {
                        Type = "function",
                        Function = new ToolChoice.FunctionTool
                        {
                            Name = tool_choice.Pfunctionname
                        }
                    };
            chatCompletionCreate.Stream = true;
            chatCompletionCreate.Model = chatDto.aiModel;
            chatCompletionCreate.StreamOptions = new StreamOptions
            {
                IncludeUsage = true
            };
            var sysmsg = string.Empty;
            var thinkmsg = string.Empty;
            var tikToken = TikToken.GetEncoding("o200k_base");
            var (semaphore, cancellationToken) = _chatCancellationManager.GetOrCreateToken(chatDto.chatgroupid);
            if (channel == "ERNIE")
            {
                sysmsg = string.Empty;
                try
                {
                    var result = await ProcessERNIEWithChainCalling(chatCompletionCreate, OpenAIOptions, chatDto, chatId,
                        senMethod, Account, typeCode, cancellationToken, delay, startTime, isFirstResponse,
                        firstTime, sysmsg, input, output, chatMessages, mytools);
                    isFirstResponse = result.isFirstResponse;
                    firstTime = result.firstTime;
                    sysmsg = result.sysmsg;
                    input = result.input;
                    output = result.output;
                }
                catch (OperationCanceledException)
                {
                    var cachedAssistantMessage = await _financeService.UsageGetRedis(chatId, "assistant");
                    if (string.IsNullOrEmpty(cachedAssistantMessage) && !string.IsNullOrEmpty(sysmsg))
                    {
                        await _financeService.UsageSaveRedis(chatId, Account, "assistant", sysmsg);
                    }
                    //await _systemService.WriteLog("工坊ERNIE输出取消", Dtos.LogLevel.Info, Account); //输出取消
                }
            }
            else
            {
                try
                {
                    var result = await ProcessOpenAIWithChainCalling(openAiService, chatCompletionCreate, chatDto, chatId,
                        senMethod, Account, typeCode, cancellationToken, delay, startTime, isFirstResponse,
                        firstTime, sysmsg, thinkmsg, input, output, usageInput, usageOutput,
                        usageInput_sec, usageOutput_sec, chatMessages, mytools);
                    isFirstResponse = result.isFirstResponse;
                    firstTime = result.firstTime;
                    sysmsg = result.sysmsg;
                    thinkmsg = result.thinkmsg;
                    input = result.input;
                    output = result.output;
                    usageInput = result.usageInput;
                    usageOutput = result.usageOutput;
                    usageInput_sec = result.usageInput_sec;
                    usageOutput_sec = result.usageOutput_sec;
                }
                catch (OperationCanceledException)
                {
                    var cachedAssistantMessage = await _financeService.UsageGetRedis(chatId, "assistant");
                    if (string.IsNullOrEmpty(cachedAssistantMessage) && !string.IsNullOrEmpty(sysmsg))
                    {
                        await _financeService.UsageSaveRedis(chatId, Account, "assistant", sysmsg);
                    }
                    //await _systemService.WriteLog("工坊OpenAI输出取消", Dtos.LogLevel.Info, Account); //输出取消
                }
            }

            // 保存对话记录
            if (chatDto.image_path != null && chatDto.image_path.Count > 0)
            {
                foreach (var imagePath in chatDto.image_path)
                {
                    chatDto.msg +=
                        $@"aee887ee6d5a79fdcmay451ai8042botf1443c04<br /><img src=""{imagePath.Replace("wwwroot", "")}"" style=""max-width:50%;"" />";
                }
            }

            chatRes.message = "";
            chatRes.reasoning = "";
            chatRes.isfinish = true;
            await Clients.Group(chatId).SendAsync(senMethod, chatRes);
            allTime = _systemService.CalculateTimeDifference(startTime, DateTime.Now).ToString("F1");
            var savedAssistantMessage = await _financeService.UsageGetRedis(chatId, "assistant");
            if (!string.IsNullOrEmpty(savedAssistantMessage))
            {
                sysmsg = savedAssistantMessage;
            }

            var processedSysmsg = sysmsg;
            if (!string.IsNullOrEmpty(chatDto.aiModel) && chatDto.aiModel.ToLower().Contains("image"))
            {
                processedSysmsg = await ProcessBase64Images(sysmsg, Account);
            }

            await _aiServer.SaveChatHistory(Account, chatId, chatDto.msg, chatDto.msgid_u, chatDto.chatgroupid, "user",
                chatDto.aiModel, firstTime, allTime);
            await _aiServer.SaveChatHistory(Account, chatId, processedSysmsg, chatDto.msgid_g, chatDto.chatgroupid, "assistant",
                chatDto.aiModel, firstTime, allTime, 0, thinkmsg);
            if (!string.IsNullOrEmpty(sysmsg) && !useMyKey)
            {
                var freePlan = await _financeService.CheckFree(Account, chatDto.aiModel);
                int inputCount = usageInput_sec + usageInput;
                int outputCount = usageOutput_sec + usageOutput;
                if (inputCount == 0 || outputCount == 0)
                {
                    inputCount = tikToken.Encode(input).Count + imageToken;
                    outputCount = tikToken.Encode(output).Count;
                }

                if (freePlan.RemainCount > 0)
                {
                    await _financeService.UpdateFree(Account);
                    await _financeService.CreateUseLog(Account, chatDto.aiModel,
                        inputCount, outputCount, 0);
                }
                else
                {
                    await _financeService.CreateUseLogAndUpadteMoney(Account, chatDto.aiModel,
                        inputCount, outputCount);
                }
            }

            await _financeService.DeleteUsageRedis(chatId, "assistant");
        }
        catch (Exception e)
        {
            await ExceptionHandling(chatId, senMethod, e.Message);
        }
    }

    //助理GPT交互
    public async Task SendAssistantMessage(ChatDto chatDto)
    {
        var httpContext = Context.GetHttpContext();

        // Get user from the authenticated connection
        var Account = Context.User.Identity.Name;
        if (chatDto.isbot)
            Account = "robot_AIBOT";

        //chatDto是否读取缓存
        if (!string.IsNullOrEmpty(chatDto.inputCacheKey))
        {
            var cache = await _redis.GetAsync(chatDto.inputCacheKey);
            await _redis.DeleteAsync(chatDto.inputCacheKey);
            if (!string.IsNullOrEmpty(cache))
            {
                chatDto = JsonConvert.DeserializeObject<ChatDto>(cache);
            }
        }

        var user = _usersService.GetUserData(Account);
        var chatId = string.Empty;
        var threadId = chatDto.threadid;
        var newChat = false;
        if (string.IsNullOrEmpty(chatDto.chatid))
        {
            chatId = Guid.NewGuid().ToString().Replace("-", ""); //创建chatid头部
            chatId = $"{chatId}U{Account}IP{chatDto.ip}";
            chatDto.chatid = chatId;
            newChat = true;
        }
        else
        {
            chatId = chatDto.chatid;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, chatId);
        var chatRes = new ChatRes();
        chatRes.chatid = chatId;
        var senMethod = "ReceiveAssistantMessage";
        if (chatDto.isbot)
            senMethod = "ReceiveAssistantMessage_bot";
        //回应客户端就绪状态
        await Clients.Group(chatId).SendAsync(senMethod, chatRes);
        var promptHeadle = chatDto.msg;
        //对话前的检查
        if (!await _usersService.ChatHubBeforeCheck(chatDto, Account, senMethod, chatId))
            return;
        //根据账号查询Assistans
        var assistant = _assistantService.GetAssistantGPTs(Account);
        if (assistant.Count == 0)
        {
            chatRes.message = "您似乎还没有创建助理，您可以<a href='/AssistantGPT/AssistantSetting'>点击这里</a>前往创建";
            await Clients.Group(chatId).SendAsync(senMethod, chatRes);
            chatRes.message = "";
            chatRes.isfinish = true;
            await Clients.Group(chatId).SendAsync(senMethod, chatRes);
            return;
        }

        var assisId = assistant.First().AssisId;
        try
        {
            if (string.IsNullOrEmpty(threadId)) //新对话
            {
                //创建线程
                threadId = await _assistantService.CreateThread();
                chatRes.threadid = threadId;
                //chatRes.message = $"线程已创建【{threadId}】，程序继续运行";
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
            }

            chatRes.threadid = string.Empty;
            //向线程添加消息
            var msgId = await _assistantService.AddMessage(threadId, promptHeadle);
            var sysmsg = string.Empty;
            var fileids = new List<string>();
            await foreach (var responseContent in _assistantService.RunThread(threadId, assisId, Account))
            {
                sysmsg += responseContent;
                chatRes.message = responseContent.message;
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                if (responseContent.file_ids != null && responseContent.file_ids.Count > 0)
                    for (var i = 0; i < responseContent.file_ids.Count; i++)
                        if (!fileids.Contains(responseContent.file_ids[i]))
                            fileids.Add(responseContent.file_ids[i]);
                //Thread.Sleep(50);
            }

            foreach (var item in fileids)
            {
                chatRes.file_id = item;
                chatRes.message = "";
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
            }

            var tikToken = TikToken.GetEncoding("o200k_base");
            chatRes.message = "";
            chatRes.isfinish = true;
            await Clients.Group(chatId).SendAsync(senMethod, chatRes);
        }
        catch (Exception e)
        {
            await ExceptionHandling(chatId, senMethod, e.Message);
        }
    }

    // Override OnConnectedAsync but remove manual token validation since [Authorize] will handle it
    public override async Task OnConnectedAsync()
    {
        await base.OnConnectedAsync();
    }

    private static void SetUpParams(dynamic obj, ChatDto chatDto)
    {
        obj.Temperature = chatDto.temperature;
        //obj.TopP = chatDto.topp;
        obj.FrequencyPenalty = chatDto.frequency;
        obj.PresencePenalty = chatDto.presence;
        obj.MaxTokens = chatDto.maxtokens;
    }

    private async Task ExceptionHandling(string chatId, string senMethod, string errorMsg)
    {
        var chatRes = new ChatRes();
        await _redis.DeleteAsync($"{chatId}_process");
        chatRes.message = $"糟糕！出错了！错误原因：【{errorMsg}】,刷新页面或重试一次吧😢";
        await Clients.Group(chatId).SendAsync(senMethod, chatRes);
        chatRes.message = "";
        chatRes.isfinish = true;
        await Clients.Group(chatId).SendAsync(senMethod, chatRes);
        await _systemService.WriteLog($"{senMethod}:{errorMsg}", LogLevel.Error, $"chatId:{chatId}");
    }

    private async Task<string> BeforeThink(AiChat aiChat, List<AImodel> aImodels, string chatId,
        string groupId,
        ChatDto chatDto,
        string Account,
        bool useMyKey,
        SemaphoreSlim semaphore,
        VisionBody visionBody = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var sysmsg = string.Empty;
        var thinkmsg = string.Empty;
        bool thinkstart = false;
        var input = string.Empty;
        var output = string.Empty;
        int usageInput = 0;
        int usageOutput = 0;
        var streaminput = 0;
        var streamoutput = 0;
        int imageToken = 0;
        var tikToken = TikToken.GetEncoding("o200k_base");
        var chatRes = new ChatRes();
        chatRes.chatid = chatId;
        var senMethod = "ReceiveMessage";
        // 创建 visionBody 的副本
        VisionBody visionBodyCopy = null;
        AiChat aiChatCopy = null;
        APISetting apiSettingCopy = new APISetting();
        apiSettingCopy.BaseUrl = aImodels.Where(x => x.ModelName == chatDto.beforeThinkModel).FirstOrDefault().BaseUrl;
        apiSettingCopy.ApiKey = aImodels.Where(x => x.ModelName == chatDto.beforeThinkModel).FirstOrDefault().ApiKey;
        apiSettingCopy.IsVisionModel =
            aImodels.Where(x => x.ModelName == chatDto.beforeThinkModel).FirstOrDefault().VisionModel;
        if (visionBody != null)
        {
            visionBodyCopy = DeepCopy(visionBody);
            visionBodyCopy.model = chatDto.beforeThinkModel;
        }
        else
        {
            aiChatCopy = DeepCopy(aiChat);
            aiChatCopy.Model = chatDto.beforeThinkModel;
        }

        try
        {
            await foreach (var responseContent in _aiServer.BeforeThink(aiChatCopy, apiSettingCopy,
                               chatDto.chatgroupid,
                               visionBodyCopy, cancellationToken))
            {
                if (semaphore.CurrentCount == 0)
                    // 被取消
                    break;
                if (responseContent.Choices != null && responseContent.Choices.Count > 0 &&
                    responseContent.Choices[0].Delta != null)
                {
                    if (!string.IsNullOrEmpty(responseContent.Choices[0].Delta.reasoning_content) ||
                        !string.IsNullOrEmpty(responseContent.Choices[0].Delta.Content))
                    {
                        sysmsg += responseContent.Choices[0].Delta.reasoning_content +
                                  responseContent.Choices[0].Delta.Content;
                        if (!string.IsNullOrEmpty(responseContent.Choices[0].Delta.reasoning_content))
                        {
                            chatRes.reasoning = responseContent.Choices[0].Delta.reasoning_content;
                        }
                        else
                        {
                            chatRes.reasoning = responseContent.Choices[0].Delta.Content;
                        }

                        await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                        chatRes.reasoning = "";
                        chatRes.message = "";
                    }
                }

                if (responseContent.Usages != null)
                {
                    streaminput = responseContent.Usages.PromptTokens;
                    streamoutput = responseContent.Usages.CompletionTokens;
                    if (responseContent.Usages.CompletionTokensDetails != null &&
                        responseContent.Usages.CompletionTokensDetails.ReasoningTokens != null)
                        streamoutput += responseContent.Usages.CompletionTokensDetails.ReasoningTokens.Value;
                }
            }

            //if (thinkstart)
            //{
            //    sysmsg += "</think>";
            //    chatRes.message = "</think>";
            //    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
            //    thinkstart = false;
            //}
        }
        catch (OperationCanceledException)
        {
            //if (thinkstart)
            //{
            //    sysmsg += "</think>";
            //    chatRes.message = sysmsg;
            //    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
            //    thinkstart = false;
            //}
        }
        finally
        {
            output = sysmsg;
            if (!string.IsNullOrEmpty(output) && !useMyKey)
            {
                int settlementInput = usageInput > 0 || usageOutput > 0 ? usageInput : streaminput;
                int settlementOutput = usageOutput > 0 || usageInput > 0 ? usageOutput : streamoutput;

                if (settlementInput == 0 && settlementOutput == 0)
                {
                    settlementInput = tikToken.Encode(input).Count + imageToken;
                    settlementOutput = tikToken.Encode(output).Count;
                }

                if (chatDto.globe || chatDto.multimodal)
                {
                    settlementInput *= 2;
                }

                await _financeService.CreateUseLogAndUpadteMoney(
                    Account, chatDto.beforeThinkModel,
                    settlementInput,
                    settlementOutput
                );
            }
        }

        return sysmsg;
    }

    public static T DeepCopy<T>(T obj)
    {
        if (obj == null)
            return default;

        string json = JsonConvert.SerializeObject(obj);
        return JsonConvert.DeserializeObject<T>(json);
    }

    /// <summary>
    /// ERNIE链式调用结果
    /// </summary>
    public class ERNIEChainResult
    {
        public bool isFirstResponse { get; set; }
        public string firstTime { get; set; } = "-1";
        public string sysmsg { get; set; } = string.Empty;
        public string input { get; set; } = string.Empty;
        public string output { get; set; } = string.Empty;
    }

    /// <summary>
    /// 处理ERNIE模型的链式工具调用
    /// </summary>
    private async Task<ERNIEChainResult> ProcessERNIEWithChainCalling(ChatCompletionCreateRequest chatCompletionCreate,
        OpenAIOptions openAIOptions, ChatDto chatDto, string chatId, string senMethod, string account,
        List<string> typeCode, CancellationToken cancellationToken, int delay, DateTime startTime,
        bool isFirstResponse, string firstTime, string sysmsg, string input, string output,
        List<ChatMessage> chatMessages, List<ToolDefinition> mytools)
    {
        var chatRes = new ChatRes { chatid = chatId };
        var maxChainCalls = 5; // 最大链式调用次数，防止无限循环
        var chainCallCount = 0;

        while (chainCallCount < maxChainCalls)
        {
            var fn = new BaiduResDto.FunctionCall();
            var hasToolCall = false;

            await foreach (var responseContent in _baiduService.CallBaiduAI_Stream(chatCompletionCreate,
                               openAIOptions, chatDto.chatgroupid, cancellationToken))
            {
                if (isFirstResponse)
                {
                    firstTime = _systemService.CalculateTimeDifference(startTime, DateTime.Now).ToString("F1");
                    isFirstResponse = false;
                }

                if (responseContent != null && !string.IsNullOrEmpty(responseContent.Result))
                {
                    sysmsg += responseContent.Result;
                    output += responseContent.Result;
                    chatRes.message = responseContent.Result;
                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    await _financeService.UsageSaveRedis(chatId, account, "assistant", responseContent.Result,
                        AIBotProEnum.HashFieldOperationMode.Append);
                    if (delay > 0)
                        Thread.Sleep(delay);
                }

                fn = responseContent.Function_Call;
            }

            if (fn != null && !string.IsNullOrEmpty(fn.Name))
            {
                hasToolCall = true;
                chainCallCount++;

                var openaiFn = new FunctionCall();
                _systemService.CopyPropertiesTo(fn, openaiFn);
                var pluginResDto = new PluginResDto();
                var ctsemoji = new CancellationTokenSource();

                await _aiServer.ExecuteFunctionWithLoadingIndicators(fn.Name, chatId, senMethod, ctsemoji.Token);
                pluginResDto = await _workShop.RunPlugin(account, openaiFn, chatId, senMethod, typeCode,
                    cancellationToken, chatDto.knowledgetopk, chatDto.knowledgereranker, chatDto.knowledgetopn);

                if (!pluginResDto.doubletreating)
                {
                    ctsemoji.Cancel();
                    var directReply = await _aiServer.UnDoubletreating(pluginResDto, chatId, senMethod);
                    sysmsg += directReply;
                    output += directReply;
                    await _financeService.UsageSaveRedis(chatId, account, "assistant", directReply,
                        AIBotProEnum.HashFieldOperationMode.Append);
                    break; // 不需要二次处理，结束链式调用
                }
                else
                {
                    ctsemoji.Cancel();
                    // 添加助手回复和工具结果到对话历史
                    chatMessages.Add(ChatMessage.FromAssistant(fn.Thoughts));
                    input += pluginResDto.result;
                    chatMessages.Add(ChatMessage.FromUser(pluginResDto.result));

                    // 更新请求参数，保持工具可用以支持链式调用
                    chatCompletionCreate.Messages = chatMessages;
                    chatCompletionCreate.Tools = mytools; // 确保工具仍然可用
                    chatCompletionCreate.Stream = true;
                    chatCompletionCreate.Model = chatDto.aiModel;

                    // 重置sysmsg以便下次循环使用
                    sysmsg = "";
                }

                if (!string.IsNullOrEmpty(fn.Arguments))
                    output += fn.Arguments;
            }
            else
            {
                // 没有工具调用，结束链式调用
                break;
            }
        }

        return new ERNIEChainResult
        {
            isFirstResponse = isFirstResponse,
            firstTime = firstTime,
            sysmsg = sysmsg,
            input = input,
            output = output
        };
    }

    /// <summary>
    /// OpenAI链式调用结果
    /// </summary>
    public class OpenAIChainResult
    {
        public bool isFirstResponse { get; set; }
        public string firstTime { get; set; } = "-1";
        public string sysmsg { get; set; } = string.Empty;
        public string thinkmsg { get; set; } = string.Empty;
        public string input { get; set; } = string.Empty;
        public string output { get; set; } = string.Empty;
        public int usageInput { get; set; }
        public int usageOutput { get; set; }
        public int usageInput_sec { get; set; }
        public int usageOutput_sec { get; set; }
    }

    /// <summary>
    /// 处理OpenAI模型的链式工具调用
    /// </summary>
    private async Task<OpenAIChainResult> ProcessOpenAIWithChainCalling(OpenAIService openAiService,
        ChatCompletionCreateRequest chatCompletionCreate, ChatDto chatDto, string chatId, string senMethod,
        string account, List<string> typeCode, CancellationToken cancellationToken, int delay, DateTime startTime,
        bool isFirstResponse, string firstTime, string sysmsg, string thinkmsg, string input, string output,
        int usageInput, int usageOutput, int usageInput_sec, int usageOutput_sec,
        List<ChatMessage> chatMessages, List<ToolDefinition> mytools)
    {
        var chatRes = new ChatRes { chatid = chatId };
        var maxChainCalls = 5; // 最大链式调用次数，防止无限循环
        var chainCallCount = 0;

        while (chainCallCount < maxChainCalls)
        {
            var completionResult = openAiService.ChatCompletion.CreateCompletionAsStream(chatCompletionCreate,
                chatCompletionCreate.Model, true, cancellationToken);

            var fn = new FunctionCall();
            var hasToolCall = false;

            await foreach (var responseContent in completionResult.WithCancellation(cancellationToken))
            {
                chatRes.jscode = string.Empty;
                chatRes.message = string.Empty;
                chatRes.reasoning = string.Empty;

                if (isFirstResponse)
                {
                    firstTime = _systemService.CalculateTimeDifference(startTime, DateTime.Now).ToString("F1");
                    isFirstResponse = false;
                }

                if (responseContent.Successful)
                {
                    var choice = responseContent.Choices.FirstOrDefault();
                    if (choice?.Message != null)
                    {
                        if (!string.IsNullOrEmpty(choice.Message.Content))
                        {
                            sysmsg += choice.Message.Content;
                            output += choice.Message.Content;
                            await _financeService.UsageSaveRedis(chatId, account, "assistant", choice.Message.Content,
                                AIBotProEnum.HashFieldOperationMode.Append);
                            chatRes.message = choice.Message.Content;
                            await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                        }

                        if (!string.IsNullOrEmpty(choice.Message.ReasoningContent))
                        {
                            thinkmsg += choice.Message.ReasoningContent;
                            output += choice.Message.ReasoningContent;
                            chatRes.reasoning = choice.Message.ReasoningContent;
                            await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                        }

                        var tools = choice.Message.ToolCalls;
                        if (tools != null && tools.Any())
                        {
                            hasToolCall = true;
                            var toolCall = tools[0];
                            fn = toolCall.FunctionCall;
                        }

                        if (responseContent.Usage != null)
                        {
                            usageInput = responseContent.Usage.PromptTokens;
                            usageOutput = responseContent.Usage.CompletionTokens ?? 0;
                        }
                    }
                }

                if (delay > 0)
                    Thread.Sleep(delay);
            }

            if (hasToolCall && fn != null && !string.IsNullOrEmpty(fn.Name))
            {
                chainCallCount++;
                var ctsemoji = new CancellationTokenSource();

                await _aiServer.ExecuteFunctionWithLoadingIndicators(fn.Name, chatId, senMethod, ctsemoji.Token);
                var pluginResDto = await _workShop.RunPlugin(account, fn, chatId, senMethod,
                    typeCode, cancellationToken, chatDto.knowledgetopk,
                    chatDto.knowledgereranker, chatDto.knowledgetopn);

                if (!pluginResDto.doubletreating)
                {
                    ctsemoji.Cancel();
                    var directReply = await _aiServer.UnDoubletreating(pluginResDto, chatId, senMethod);
                    sysmsg += directReply;
                    output += directReply;
                    await _financeService.UsageSaveRedis(chatId, account, "assistant", directReply,
                        AIBotProEnum.HashFieldOperationMode.Append);
                    break; // 不需要二次处理，结束链式调用
                }
                else
                {
                    ctsemoji.Cancel();
                    // 添加工具调用结果到对话历史
                    input += pluginResDto.result;
                    chatMessages.Add(ChatMessage.FromUser(pluginResDto.result));

                    // 更新请求参数，保持工具可用以支持链式调用
                    chatCompletionCreate.Messages = chatMessages;
                    chatCompletionCreate.Tools = mytools; // 确保工具仍然可用
                    chatCompletionCreate.Stream = true;
                    chatCompletionCreate.Model = chatDto.aiModel;

                    // 重置sysmsg以便下次循环使用
                    sysmsg = "";
                }

                if (!string.IsNullOrEmpty(fn.Arguments))
                    output += fn.Arguments;
            }
            else
            {
                // 没有工具调用，结束链式调用
                break;
            }
        }

        return new OpenAIChainResult
        {
            isFirstResponse = isFirstResponse,
            firstTime = firstTime,
            sysmsg = sysmsg,
            thinkmsg = thinkmsg,
            input = input,
            output = output,
            usageInput = usageInput,
            usageOutput = usageOutput,
            usageInput_sec = usageInput_sec,
            usageOutput_sec = usageOutput_sec
        };
    }

    /// <summary>
    /// 处理消息中的base64图片，上传到COS并替换为URL
    /// </summary>
    /// <param name="content">消息内容</param>
    /// <param name="Account">用户账号</param>
    /// <returns>处理后的消息内容</returns>
    private async Task<string> ProcessBase64Images(string content, string Account)
    {
        if (string.IsNullOrEmpty(content))
            return content;

        try
        {
            // 匹配 Markdown 格式的 base64 图片: ![image](data:image/...;base64,...)
            var pattern = @"!\[([^\]]*)\]\(data:image/([a-zA-Z]+);base64,([A-Za-z0-9+/=]+)\)";
            var regex = new Regex(pattern, RegexOptions.Compiled);
            
            var matches = regex.Matches(content);
            if (matches.Count == 0)
                return content;

            var processedContent = content;
            
            foreach (Match match in matches)
            {
                try
                {
                    var altText = match.Groups[1].Value;
                    var imageFormat = match.Groups[2].Value.ToLower(); // png, jpg, jpeg, gif等
                    var base64Data = match.Groups[3].Value;
                    
                    // 将base64转换为字节数组
                    var imageBytes = Convert.FromBase64String(base64Data);
                    
                    // 生成唯一的文件名
                    var fileName = $"{Guid.NewGuid()}.{imageFormat}";
                    var key = $"ai-images/{DateTime.Now:yyyy-MM}/{fileName}";
                    
                    // 创建临时文件
                    var tempDir = Path.Combine(Path.GetTempPath(), "aibot_images");
                    if (!Directory.Exists(tempDir))
                        Directory.CreateDirectory(tempDir);
                    
                    var tempFilePath = Path.Combine(tempDir, fileName);
                    
                    // 将字节写入临时文件
                    await File.WriteAllBytesAsync(tempFilePath, imageBytes);
                    
                    // 上传到COS
                    var imageUrl = _cosService.PutObject(key, tempFilePath, fileName);
                    
                    if (!string.IsNullOrEmpty(imageUrl))
                    {
                        // 替换base64为URL
                        var newMarkdown = $"![{altText}]({imageUrl})";
                        processedContent = processedContent.Replace(match.Value, newMarkdown);
                        
                        await _systemService.WriteLog($"成功上传图片到COS: {imageUrl}", Dtos.LogLevel.Info, Account);
                    }
                    else
                    {
                        await _systemService.WriteLog($"上传图片到COS失败", Dtos.LogLevel.Error, Account);
                    }
                }
                catch (Exception ex)
                {
                    await _systemService.WriteLog($"处理单张base64图片时出错: {ex.Message}", Dtos.LogLevel.Error, Account);
                    // 继续处理下一张图片
                }
            }
            
            return processedContent;
        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"处理base64图片时出错: {ex.Message}", Dtos.LogLevel.Error, Account);
            return content; // 出错时返回原内容
        }
    }
}