using System.Net;
using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Web;
using System.Xml;
using aibotPro.AppCode;
using aibotPro.ChatService;
using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using Betalgo.Ranul.OpenAI;
using Betalgo.Ranul.OpenAI.Managers;
using Betalgo.Ranul.OpenAI.ObjectModels.RequestModels;
using Betalgo.Ranul.OpenAI.ObjectModels.ResponseModels;
using Betalgo.Ranul.OpenAI.ObjectModels.SharedModels;
using Google.Apis.Util;
using iTextSharp.text;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using RestSharp;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.PixelFormats;
using Spire.Presentation.Charts;
using TiktokenSharp;
using Formatting = Newtonsoft.Json.Formatting;
using Image = SixLabors.ImageSharp.Image;
using JsonSerializer = System.Text.Json.JsonSerializer;
using LogLevel = aibotPro.Dtos.LogLevel;

// 像素格式
// 添加ImageSharp的引用

namespace aibotPro.Service;

public class AiServer : IAiServer
{
    private readonly ChatCancellationManager _chatCancellationManager;
    private readonly AIBotProContext _context;
    private readonly ICOSService _cosservice;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly IMilvusService _milvusService;
    private readonly IRedisService _redis;
    private readonly IServiceProvider _serviceProvider;
    private readonly ISystemService _systemService;
    private readonly IBaiduService _baiduService;
    private readonly IAiBookService _aiBookService;
    private readonly IMcpService _mcpService;


    public AiServer(ISystemService systemService, AIBotProContext context, IRedisService redis,
        IHubContext<ChatHub> hubContext, IMilvusService milvusService, ChatCancellationManager chatCancellationManager,
        ICOSService cosservice, IServiceProvider serviceProvider, IBaiduService baiduService,
        IAiBookService aiBookService, IMcpService mcpService)
    {
        _systemService = systemService;
        _context = context;
        _redis = redis;
        _hubContext = hubContext;
        _milvusService = milvusService;
        _chatCancellationManager = chatCancellationManager;
        _cosservice = cosservice;
        _serviceProvider = serviceProvider;
        _baiduService = baiduService;
        _aiBookService = aiBookService;
        _mcpService = mcpService;
    }

    //实现接口
    public async IAsyncEnumerable<AiRes> CallingAI(
        AiChat aiChat,
        APISetting apiSetting,
        string chatId,
        string realChatId,
        bool isResponses = false,
        VisionBody visionBody = null,
        List<object> mcpTools = null,
        string account = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        // 如果有MCP工具，使用OpenAI SDK进行处理，支持工具调用
        if (mcpTools != null && mcpTools.Any())
        {
            // 从aiChat或visionBody获取modelName
            var modelName = visionBody?.model ?? aiChat.Model;
            // 暂时假设不使用自己的key（这个信息需要从调用方传递）
            var useMyKey = false;

            await foreach (var result in CallingAIWithMCPTools(aiChat, apiSetting, chatId, realChatId, visionBody,
                               mcpTools,
                               account, modelName, useMyKey, cancellationToken))
            {
                yield return result;
            }
        }
        else
        {
            // 原有的直接HTTP调用逻辑，不支持工具调用
            await foreach (var result in CallingAIDirectHttp(aiChat, apiSetting, chatId, visionBody, isResponses,
                               cancellationToken))
            {
                yield return result;
            }
        }
    }

    // 使用HTTP直接调用处理MCP工具调用的方法
    private async IAsyncEnumerable<AiRes> CallingAIWithMCPTools(
        AiChat aiChat,
        APISetting apiSetting,
        string chatId,
        string realChatId,
        VisionBody visionBody,
        List<object> mcpTools,
        string account,
        string modelName,
        bool useMyKey,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        // 创建请求体对象
        object requestBody;

        if (visionBody != null)
        {
            // 使用VisionBody并添加MCP工具
            var visionBodyWithTools = new
            {
                model = visionBody.model,
                messages = visionBody.messages,
                stream = visionBody.stream,
                tools = mcpTools?.ToArray()
            };
            requestBody = visionBodyWithTools;
        }
        else
        {
            // 使用AiChat并添加MCP工具
            var aiChatWithTools = new
            {
                model = aiChat.Model,
                messages = aiChat.Messages,
                stream = aiChat.Stream,
                tools = mcpTools?.ToArray()
            };
            requestBody = aiChatWithTools;
        }

        // 最大工具调用次数，防止无限循环
        const int maxToolCalls = 10;
        int toolCallCount = 0;

        // Token累计变量，用于追踪所有工具调用的token消耗
        int totalPromptTokens = 0;
        int totalCompletionTokens = 0;
        int totalReasoningTokens = 0;

        // 备用token计算所需的内容跟踪
        var tikToken = TikToken.GetEncoding("o200k_base");
        var allInputContent = new System.Text.StringBuilder();
        var allOutputContent = new System.Text.StringBuilder();

        // 初始内容分类
        if (visionBody != null)
        {
            foreach (var msg in visionBody.messages)
            {
                var content = msg.content?.stringContent ?? "";
                if (msg.role == "user" || msg.role == "tool")
                {
                    // 用户消息和工具结果算作输入
                    allInputContent.AppendLine(content);
                }
                else if (msg.role == "assistant")
                {
                    // 助手消息算作输出
                    allOutputContent.AppendLine(content);
                }
            }
        }
        else
        {
            foreach (var msg in aiChat.Messages)
            {
                var content = msg.Content ?? "";
                if (msg.Role == "user" || msg.Role == "tool")
                {
                    // 用户消息和工具结果算作输入
                    allInputContent.AppendLine(content);
                }
                else if (msg.Role == "assistant")
                {
                    // 助手消息算作输出
                    allOutputContent.AppendLine(content);
                }
            }
        }

        while (toolCallCount < maxToolCalls)
        {
            var hasToolCall = false;
            string currentToolCallId = null;
            string currentFunctionName = null;
            string currentFunctionArguments = null;

            var baseUrl = apiSetting.BaseUrl;
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
            var url = baseUrl + "/v1/chat/completions";

            using (var httpClient = new HttpClient())
            {
                var requestJson = JsonConvert.SerializeObject(requestBody);
                var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Headers.Add("Authorization", $"Bearer {apiSetting.ApiKey}");
                var requestContent = new StringContent(requestJson, Encoding.UTF8, "application/json");
                request.Content = requestContent;

                using (var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead,
                           cancellationToken))
                {
                    using (var responseStream = await response.Content.ReadAsStreamAsync(cancellationToken))
                    {
                        using (var reader = new StreamReader(responseStream, Encoding.UTF8))
                        {
                            while (!reader.EndOfStream)
                            {
                                cancellationToken.ThrowIfCancellationRequested();

                                var line = await reader.ReadLineAsync();
                                if (line?.StartsWith("data:") == true)
                                {
                                    var jsonDataStartIndex = line.IndexOf("data:") + "data:".Length;
                                    var jsonData = line.Substring(jsonDataStartIndex).Trim();

                                    if (jsonData == "[DONE]") break;

                                    AiRes? resultToYield = null;
                                    try
                                    {
                                        var responseObj = JsonConvert.DeserializeObject<dynamic>(jsonData);
                                        if (responseObj?.choices != null && responseObj.choices.Count > 0)
                                        {
                                            var choice = responseObj.choices[0];
                                            var delta = choice.delta;

                                            // 处理普通内容
                                            if (delta?.content != null)
                                            {
                                                var content = delta.content.ToString();
                                                allOutputContent.Append(content); // 跟踪输出内容

                                                resultToYield = new AiRes
                                                {
                                                    Choices = new List<Choice>
                                                    {
                                                        new Choice
                                                        {
                                                            Delta = new DeltaContent
                                                            {
                                                                Content = content
                                                            }
                                                        }
                                                    }
                                                };
                                            }
                                            // 处理推理内容
                                            else if (delta?.reasoning_content != null)
                                            {
                                                var reasoningContent = delta.reasoning_content.ToString();
                                                allOutputContent.Append(reasoningContent); // 跟踪推理内容

                                                resultToYield = new AiRes
                                                {
                                                    Choices = new List<Choice>
                                                    {
                                                        new Choice
                                                        {
                                                            Delta = new DeltaContent
                                                            {
                                                                reasoning_content = reasoningContent
                                                            }
                                                        }
                                                    }
                                                };
                                            }
                                            // 处理使用情况
                                            else if (responseObj.usage != null)
                                            {
                                                // 累计token使用量
                                                int currentPromptTokens = responseObj.usage.prompt_tokens ?? 0;
                                                int currentCompletionTokens = responseObj.usage.completion_tokens ?? 0;
                                                int currentReasoningTokens = 0;

                                                // 检查是否有推理token
                                                if (responseObj.usage.completion_tokens_details?.reasoning_tokens !=
                                                    null)
                                                {
                                                    currentReasoningTokens = responseObj.usage.completion_tokens_details
                                                        .reasoning_tokens ?? 0;
                                                }

                                                totalPromptTokens += currentPromptTokens;
                                                totalCompletionTokens += currentCompletionTokens;
                                                totalReasoningTokens += currentReasoningTokens;

                                                resultToYield = new AiRes
                                                {
                                                    Usages = new StreamUsage
                                                    {
                                                        PromptTokens = currentPromptTokens,
                                                        CompletionTokens = currentCompletionTokens +
                                                                           currentReasoningTokens,
                                                        TotalTokens = currentPromptTokens + currentCompletionTokens +
                                                                      currentReasoningTokens,
                                                        CompletionTokensDetails =
                                                            new aibotPro.Dtos.CompletionTokensDetails
                                                            {
                                                                ReasoningTokens = currentReasoningTokens
                                                            }
                                                    }
                                                };
                                            }

                                            // 处理工具调用
                                            if (delta?.tool_calls != null)
                                            {
                                                foreach (var toolCall in delta.tool_calls)
                                                {
                                                    if (toolCall.id != null)
                                                        currentToolCallId = toolCall.id.ToString();

                                                    if (toolCall.function != null)
                                                    {
                                                        if (toolCall.function.name != null)
                                                            currentFunctionName = toolCall.function.name.ToString();
                                                        if (toolCall.function.arguments != null)
                                                            currentFunctionArguments +=
                                                                toolCall.function.arguments.ToString();

                                                        hasToolCall = true;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    catch (Exception ex)
                                    {
                                        await _systemService.WriteLog($"解析响应失败: {ex.Message}", LogLevel.Error,
                                            account ?? "system");
                                    }

                                    // 在try/catch外部yield return
                                    if (resultToYield != null)
                                    {
                                        yield return resultToYield;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 如果有工具调用，执行工具
            if (hasToolCall && !string.IsNullOrEmpty(currentFunctionName))
            {
                toolCallCount++;

                try
                {
                    // 推送工具调用开始状态到前端
                    await NotifyToolCallStatus(realChatId, currentFunctionName, currentFunctionArguments ?? "{}",
                        "calling", currentToolCallId);

                    // 执行MCP工具 - 支持从工具名解析服务器名
                    var mcpResult = await ExecuteMCPToolWithServerParsing(
                        currentFunctionName,
                        currentFunctionArguments ?? "{}",
                        account ?? "");

                    // 将工具执行结果添加到消息历史
                    var toolResult = mcpResult.Success
                        ? (mcpResult.Result?.ToString() ?? "")
                        : $"工具执行失败: {mcpResult.Message}";

                    // 推送工具调用结果状态到前端
                    await NotifyToolCallStatus(realChatId, currentFunctionName, currentFunctionArguments ?? "{}",
                        mcpResult.Success ? "success" : "error", currentToolCallId, toolResult);

                    // 跟踪工具调用和结果内容，用于备用token计算
                    // 工具调用本身算作输出token（AI生成的）
                    allOutputContent.AppendLine(
                        $"Function call: {currentFunctionName}({currentFunctionArguments ?? ""})");
                    // 工具执行结果算作输入token（将发送给AI的）
                    allInputContent.AppendLine($"Function result: {toolResult}");

                    // 使用保存的工具调用ID，如果没有则生成新的
                    var toolCallIdToUse = !string.IsNullOrEmpty(currentToolCallId)
                        ? currentToolCallId
                        : Guid.NewGuid().ToString();

                    // 构建包含工具调用的完整消息历史
                    var messages = new List<object>();

                    // 获取现有消息并解析工具调用信息
                    if (visionBody != null)
                    {
                        foreach (var msg in visionBody.messages)
                        {
                            var content = msg.content?.stringContent ?? "";
                            if (msg.role == "assistant" && content.StartsWith("TOOL_CALL:"))
                            {
                                // 解析工具调用信息: TOOL_CALL:id:name:arguments
                                var parts = content.Split(':', 4);
                                if (parts.Length >= 4)
                                {
                                    messages.Add(new
                                    {
                                        role = "assistant",
                                        content = "",
                                        tool_calls = new[]
                                        {
                                            new
                                            {
                                                id = parts[1],
                                                type = "function",
                                                function = new
                                                {
                                                    name = parts[2],
                                                    arguments = parts[3]
                                                }
                                            }
                                        }
                                    });
                                }
                            }
                            else if (msg.role == "tool" && content.StartsWith("TOOL_RESULT:"))
                            {
                                // 解析工具结果信息: TOOL_RESULT:id:result
                                var parts = content.Split(':', 3);
                                if (parts.Length >= 3)
                                {
                                    messages.Add(new
                                    {
                                        role = "tool",
                                        content = parts[2],
                                        tool_call_id = parts[1]
                                    });
                                }
                            }
                            else
                            {
                                // 普通消息
                                messages.Add(msg);
                            }
                        }
                    }
                    else
                    {
                        foreach (var msg in aiChat.Messages)
                        {
                            var content = msg.Content ?? "";
                            if (msg.Role == "assistant" && content.StartsWith("TOOL_CALL:"))
                            {
                                // 解析工具调用信息: TOOL_CALL:id:name:arguments
                                var parts = content.Split(':', 4);
                                if (parts.Length >= 4)
                                {
                                    messages.Add(new
                                    {
                                        role = "assistant",
                                        content = "",
                                        tool_calls = new[]
                                        {
                                            new
                                            {
                                                id = parts[1],
                                                type = "function",
                                                function = new
                                                {
                                                    name = parts[2],
                                                    arguments = parts[3]
                                                }
                                            }
                                        }
                                    });
                                }
                            }
                            else if (msg.Role == "tool" && content.StartsWith("TOOL_RESULT:"))
                            {
                                // 解析工具结果信息: TOOL_RESULT:id:result
                                var parts = content.Split(':', 3);
                                if (parts.Length >= 3)
                                {
                                    messages.Add(new
                                    {
                                        role = "tool",
                                        content = parts[2],
                                        tool_call_id = parts[1]
                                    });
                                }
                            }
                            else
                            {
                                // 普通消息
                                messages.Add(new { role = msg.Role, content = msg.Content });
                            }
                        }
                    }

                    // 添加助手的工具调用消息
                    messages.Add(new
                    {
                        role = "assistant",
                        content = "",
                        tool_calls = new[]
                        {
                            new
                            {
                                id = toolCallIdToUse,
                                type = "function",
                                function = new
                                {
                                    name = currentFunctionName,
                                    arguments = currentFunctionArguments ?? ""
                                }
                            }
                        }
                    });

                    // 添加工具执行结果
                    messages.Add(new
                    {
                        role = "tool",
                        content = toolResult,
                        tool_call_id = toolCallIdToUse
                    });

                    // 同时更新原始对象，持久化消息记录（包含工具调用信息）
                    if (visionBody != null)
                    {
                        var messagesList = visionBody.messages.ToList();
                        // 保存assistant消息时，在content中编码工具调用信息
                        var toolCallInfo =
                            $"TOOL_CALL:{toolCallIdToUse}:{currentFunctionName}:{currentFunctionArguments ?? ""}";
                        messagesList.Add(new VisionChatMessage
                        {
                            role = "assistant",
                            content = new ContentWrapper { stringContent = toolCallInfo }
                        });
                        // 保存tool消息时，在content中编码tool_call_id
                        var toolResultInfo = $"TOOL_RESULT:{toolCallIdToUse}:{toolResult}";
                        messagesList.Add(new VisionChatMessage
                        {
                            role = "tool",
                            content = new ContentWrapper { stringContent = toolResultInfo }
                        });
                        visionBody.messages = messagesList.ToArray();
                    }
                    else
                    {
                        var messagesList = aiChat.Messages.ToList();
                        // 保存assistant消息时，在content中编码工具调用信息
                        var toolCallInfo =
                            $"TOOL_CALL:{toolCallIdToUse}:{currentFunctionName}:{currentFunctionArguments ?? ""}";
                        messagesList.Add(new Message { Role = "assistant", Content = toolCallInfo });
                        // 保存tool消息时，在content中编码tool_call_id
                        var toolResultInfo = $"TOOL_RESULT:{toolCallIdToUse}:{toolResult}";
                        messagesList.Add(new Message { Role = "tool", Content = toolResultInfo });
                        aiChat.Messages = messagesList;
                    }

                    // 在工具调用完成后进行计费（如果这是中间轮次）
                    if (toolCallCount > 0 && !useMyKey)
                    {
                        await PerformMCPToolBilling(account, modelName, allInputContent.ToString(),
                            allOutputContent.ToString(), mcpTools);

                        // 清空内容累计器，为下次工具调用准备
                        allInputContent.Clear();
                        allOutputContent.Clear();

                        // 重新添加当前请求的输入内容，区分输入和输出
                        if (visionBody != null)
                        {
                            foreach (var msg in visionBody.messages)
                            {
                                var content = msg.content?.stringContent ?? "";
                                if (msg.role == "user" || msg.role == "tool")
                                {
                                    // 用户消息和工具结果算作输入
                                    allInputContent.AppendLine(content);
                                }
                                else if (msg.role == "assistant")
                                {
                                    // 助手消息算作输出
                                    allOutputContent.AppendLine(content);
                                }
                            }
                        }
                        else
                        {
                            foreach (var msg in aiChat.Messages)
                            {
                                var content = msg.Content ?? "";
                                if (msg.Role == "user" || msg.Role == "tool")
                                {
                                    // 用户消息和工具结果算作输入
                                    allInputContent.AppendLine(content);
                                }
                                else if (msg.Role == "assistant")
                                {
                                    // 助手消息算作输出
                                    allOutputContent.AppendLine(content);
                                }
                            }
                        }
                    }

                    // 更新请求体，AI根据结果继续生成回答
                    requestBody = new
                    {
                        model = visionBody?.model ?? aiChat.Model,
                        messages = messages,
                        tools = mcpTools?.ToArray(),
                        stream = visionBody?.stream ?? aiChat.Stream
                    };
                }
                catch (Exception ex)
                {
                    await _systemService.WriteLog($"MCP工具执行失败: {ex.Message}", LogLevel.Error, account ?? "system");

                    // 添加错误信息到对话
                    var toolCallIdToUse = !string.IsNullOrEmpty(currentToolCallId)
                        ? currentToolCallId
                        : Guid.NewGuid().ToString();

                    // 构建包含工具调用错误的完整消息历史
                    var messages = new List<object>();

                    // 获取现有消息并解析工具调用信息
                    if (visionBody != null)
                    {
                        foreach (var msg in visionBody.messages)
                        {
                            var content = msg.content?.stringContent ?? "";
                            if (msg.role == "assistant" && content.StartsWith("TOOL_CALL:"))
                            {
                                // 解析工具调用信息: TOOL_CALL:id:name:arguments
                                var parts = content.Split(':', 4);
                                if (parts.Length >= 4)
                                {
                                    messages.Add(new
                                    {
                                        role = "assistant",
                                        content = "",
                                        tool_calls = new[]
                                        {
                                            new
                                            {
                                                id = parts[1],
                                                type = "function",
                                                function = new
                                                {
                                                    name = parts[2],
                                                    arguments = parts[3]
                                                }
                                            }
                                        }
                                    });
                                }
                            }
                            else if (msg.role == "tool" && content.StartsWith("TOOL_RESULT:"))
                            {
                                // 解析工具结果信息: TOOL_RESULT:id:result
                                var parts = content.Split(':', 3);
                                if (parts.Length >= 3)
                                {
                                    messages.Add(new
                                    {
                                        role = "tool",
                                        content = parts[2],
                                        tool_call_id = parts[1]
                                    });
                                }
                            }
                            else
                            {
                                // 普通消息
                                messages.Add(msg);
                            }
                        }
                    }
                    else
                    {
                        foreach (var msg in aiChat.Messages)
                        {
                            var content = msg.Content ?? "";
                            if (msg.Role == "assistant" && content.StartsWith("TOOL_CALL:"))
                            {
                                // 解析工具调用信息: TOOL_CALL:id:name:arguments
                                var parts = content.Split(':', 4);
                                if (parts.Length >= 4)
                                {
                                    messages.Add(new
                                    {
                                        role = "assistant",
                                        content = "",
                                        tool_calls = new[]
                                        {
                                            new
                                            {
                                                id = parts[1],
                                                type = "function",
                                                function = new
                                                {
                                                    name = parts[2],
                                                    arguments = parts[3]
                                                }
                                            }
                                        }
                                    });
                                }
                            }
                            else if (msg.Role == "tool" && content.StartsWith("TOOL_RESULT:"))
                            {
                                // 解析工具结果信息: TOOL_RESULT:id:result
                                var parts = content.Split(':', 3);
                                if (parts.Length >= 3)
                                {
                                    messages.Add(new
                                    {
                                        role = "tool",
                                        content = parts[2],
                                        tool_call_id = parts[1]
                                    });
                                }
                            }
                            else
                            {
                                // 普通消息
                                messages.Add(new { role = msg.Role, content = msg.Content });
                            }
                        }
                    }

                    // 添加工具执行错误结果
                    messages.Add(new
                    {
                        role = "tool",
                        content = $"工具执行出错: {ex.Message}",
                        tool_call_id = toolCallIdToUse
                    });

                    // 同时更新原始对象，持久化消息记录（包括错误信息）
                    if (visionBody != null)
                    {
                        var messagesList = visionBody.messages.ToList();
                        // 保存tool错误消息时，在content中编码tool_call_id
                        var toolErrorInfo = $"TOOL_RESULT:{toolCallIdToUse}:工具执行出错: {ex.Message}";
                        messagesList.Add(new VisionChatMessage
                        {
                            role = "tool",
                            content = new ContentWrapper { stringContent = toolErrorInfo }
                        });
                        visionBody.messages = messagesList.ToArray();
                    }
                    else
                    {
                        var messagesList = aiChat.Messages.ToList();
                        // 保存tool错误消息时，在content中编码tool_call_id
                        var toolErrorInfo = $"TOOL_RESULT:{toolCallIdToUse}:工具执行出错: {ex.Message}";
                        messagesList.Add(new Message { Role = "tool", Content = toolErrorInfo });
                        aiChat.Messages = messagesList;
                    }

                    requestBody = new
                    {
                        model = visionBody?.model ?? aiChat.Model,
                        messages = messages,
                        tools = mcpTools?.ToArray(),
                        stream = visionBody?.stream ?? aiChat.Stream
                    };
                }
            }
            else
            {
                // 没有工具调用，结束循环
                break;
            }
        }

        // 工具调用循环结束后，不再返回累计的token统计
        // 因为每次工具调用已经直接计费，ChatHub只需要处理最后一轮对话的计费
        // 这样避免重复计费
    }

    // 原有的直接HTTP调用方法
    private async IAsyncEnumerable<AiRes> CallingAIDirectHttp(
        AiChat aiChat,
        APISetting apiSetting,
        string chatId,
        VisionBody visionBody,
        bool isResponses = false,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var baseUrl = apiSetting.BaseUrl;
        if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');

        // 根据isResponses参数选择端点
        var url = baseUrl + (isResponses ? "/v1/responses" : "/v1/chat/completions");
        using (var httpClient = new HttpClient())
        {
            var settings = new JsonSerializerSettings
            {
                NullValueHandling = NullValueHandling.Ignore
            };

            // 根据isResponses参数创建不同的请求体格式
            string requestBody;
            if (isResponses)
            {
                if (visionBody?.messages != null)
                {
                    foreach (var message in visionBody.messages)
                    {
                        if (message.content?.visionContentList != null)
                        {
                            foreach (var visionContent in message.content.visionContentList)
                            {
                                if (!visionContent.type.StartsWith("input_"))
                                {
                                    visionContent.type = $"input_{visionContent.type}";
                                }

                                if (visionContent.type == "input_image_url")
                                {
                                    visionContent.type = "input_image";
                                }
                            }
                        }
                    }
                }

                // 创建转换后的消息结构
                object convertedMessages = null;
                if (visionBody?.messages != null)
                {
                    var messageList = new List<object>();
                    foreach (var message in visionBody.messages)
                    {
                        object content;
                        if (message.content?.stringContent != null)
                        {
                            content = message.content.stringContent;
                        }
                        else if (message.content?.visionContentList != null)
                        {
                            var contentList = new List<object>();
                            foreach (var vc in message.content.visionContentList)
                            {
                                if (vc.type == "input_image")
                                {
                                    contentList.Add(new
                                    {
                                        type = vc.type,
                                        text = vc.text,
                                        image_url = vc.image_url?.url // 直接使用字符串
                                    });
                                }
                                else
                                {
                                    contentList.Add(new
                                    {
                                        type = vc.type,
                                        text = vc.text,
                                        image_url = vc.image_url
                                    });
                                }
                            }

                            content = contentList;
                        }
                        else
                        {
                            content = null;
                        }

                        messageList.Add(new
                        {
                            role = message.role,
                            content = content
                        });
                    }

                    convertedMessages = messageList;
                }

                // 使用responses端点的请求体格式
                var responseRequestObj = new
                {
                    model = visionBody?.model ?? aiChat.Model,
                    input = convertedMessages ?? (object)aiChat.Messages,
                    reasoning = new { summary = "auto" },
                    stream = visionBody?.stream ?? aiChat.Stream
                };
                requestBody = JsonConvert.SerializeObject(responseRequestObj, settings);
            }

            else
            {
                // 使用原有的chat/completions请求体格式
                requestBody = visionBody == null
                    ? JsonConvert.SerializeObject(aiChat)
                    : JsonConvert.SerializeObject(visionBody);
            }

            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Add("Authorization", $"Bearer {apiSetting.ApiKey}");
            var requestContent = new StringContent(requestBody, Encoding.UTF8, "application/json");
            request.Content = requestContent;

            // 发送请求时，也传递取消令牌以便在请求级别处理取消
            using (var response =
                   await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken))
            {
                cancellationToken.ThrowIfCancellationRequested(); // 测试取消令牌，早期中断

                using (var responseStream = await response.Content.ReadAsStreamAsync(cancellationToken))
                {
                    cancellationToken.ThrowIfCancellationRequested(); // 测试取消令牌，中断读取响应流

                    using (var reader = new StreamReader(responseStream, Encoding.UTF8))
                    {
                        while (!reader.EndOfStream)
                        {
                            cancellationToken.ThrowIfCancellationRequested(); // 检查取消令牌，中断读取

                            var line = await reader.ReadLineAsync();
                            if (line.StartsWith("data:"))
                            {
                                var jsonDataStartIndex = line.IndexOf("data:") + "data:".Length;
                                var jsonData = line.Substring(jsonDataStartIndex).Trim();

                                // 根据isResponses参数处理不同的响应格式
                                if (isResponses)
                                {
                                    // 处理/v1/responses端点的响应格式
                                    if (jsonData.Contains("\"type\":\"response.reasoning_summary_text.delta\"") ||
                                        jsonData.Contains("\"type\":\"response.output_text.delta\""))
                                    {
                                        var responseData = JsonConvert.DeserializeObject<dynamic>(jsonData);
                                        var res = new AiRes();

                                        if (responseData.type == "response.reasoning_summary_text.delta")
                                        {
                                            // 思考部分
                                            res.Choices = new List<Choice>
                                            {
                                                new Choice
                                                {
                                                    Delta = new DeltaContent
                                                    {
                                                        reasoning_content = responseData.delta?.ToString() ?? ""
                                                    }
                                                }
                                            };
                                        }
                                        else if (responseData.type == "response.output_text.delta")
                                        {
                                            // 正文部分
                                            res.Choices = new List<Choice>
                                            {
                                                new Choice
                                                {
                                                    Delta = new DeltaContent
                                                    {
                                                        Content = responseData.delta?.ToString() ?? ""
                                                    }
                                                }
                                            };
                                        }

                                        if (res.Choices != null)
                                        {
                                            yield return res;
                                        }
                                    }
                                }
                                else
                                {
                                    // 处理原有的/v1/chat/completions端点响应格式
                                    var resultIndex = jsonData.IndexOf("\"content\":");
                                    var reasoningIndex = jsonData.IndexOf("\"reasoning_content\":");
                                    var tokenIndex = jsonData.IndexOf("\"total_tokens\":");
                                    if (resultIndex >= 0 || tokenIndex >= 0 || reasoningIndex >= 0)
                                    {
                                        var res = new AiRes();
                                        try
                                        {
                                            res = JsonConvert.DeserializeObject<AiRes>(jsonData);
                                        }
                                        catch (Exception e)
                                        {
                                            await _systemService.WriteLog(e.Message, LogLevel.Error, "system");
                                            throw;
                                        }

                                        if (res != null)
                                        {
                                            yield return res;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }


    public async Task<string> CallingAINotStream(AiChat aiChat, APISetting apiSetting, VisionBody visionBody = null,
        bool returnObject = false)
    {
        var baseUrl = apiSetting.BaseUrl;
        if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');

        var url = baseUrl + "/v1/chat/completions";
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
        }
        catch (Exception e)
        {
            throw e;
        }

        var client = new RestClient($"{baseUrl}/v1/chat/completions");
        var request = new RestRequest("", Method.Post);
        request.AddHeader("Accept", "application/json");
        request.AddHeader("Authorization", $"Bearer {apiSetting.ApiKey}");
        request.AddHeader("Content-Type", "application/json");
        request.AddHeader("Connection", "keep-alive");
        var requestBody = new object();
        if (visionBody != null)
            requestBody = visionBody;
        else
            requestBody = aiChat;
        var body = JsonConvert.SerializeObject(requestBody, Formatting.Indented);
        request.AddParameter("application/json", body, ParameterType.RequestBody);
        var response = client.Execute(request);
        if (response.IsSuccessful)
        {
            var jsonResponse = JObject.Parse(response.Content);
            if (returnObject)
                return jsonResponse.ToString();
            var messageContent = jsonResponse["choices"]?[0]?["message"]?["content"];

            if (messageContent != null)
                return messageContent.ToString();
            return "";
        }

        return "";
    }

    public async Task<bool> SaveChatHistory(string account, string chatId, string content, string chatCode,
        string chatGroupId,
        string role, string model, string firstTime = "", string allTime = "", int islock = 0, string reasoning = "")
    {
        var chatHistory = new ChatHistory();
        chatHistory.Account = account;
        chatHistory.Chat = _systemService.EncodeBase64(content);
        chatHistory.Reasoning = _systemService.EncodeBase64(reasoning);
        chatHistory.Role = role;
        chatHistory.ChatId = chatId;
        chatHistory.ChatCode = chatCode;
        chatHistory.ChatGroupId = chatGroupId;
        chatHistory.Model = model;
        chatHistory.IsDel = 0;
        chatHistory.FirstTime = firstTime;
        chatHistory.AllTime = allTime;
        chatHistory.CreateTime = DateTime.Now;
        chatHistory.IsLock = islock;
        _context.ChatHistories.Add(chatHistory);
        await _context.SaveChangesAsync();
        var chatHistories = _context.ChatHistories
            .AsNoTracking()
            .Where(x => x.ChatId == chatId && x.IsDel == 0).ToList();
        //刷新缓存
        await _redis.SetAsync(chatId, JsonConvert.SerializeObject(chatHistories), TimeSpan.FromHours(1));
        return true;
    }

    public List<ChatHistory> GetChatHistories(string account, string chatId, int historyCount, bool coder = false)
    {
        //先用chatId查询缓存
        var chatHistories = new List<ChatHistory>();
        var chatHistoryStr = _redis.GetAsync(chatId).Result;
        if (!string.IsNullOrEmpty(chatHistoryStr))
        {
            chatHistories = JsonConvert.DeserializeObject<List<ChatHistory>>(chatHistoryStr);
        }
        else
        {
            //从数据库加载
            chatHistories = _context.ChatHistories
                .AsNoTracking()
                .Where(x => x.ChatId == chatId && x.IsDel == 0).ToList();
            //写入缓存
            _redis.SetAsync(chatId, JsonConvert.SerializeObject(chatHistories), TimeSpan.FromHours(1));
        }

        chatHistories = chatHistories.OrderBy(x => x.CreateTime).ToList();
        if (historyCount < 0)
            return chatHistories;
        //使用historyCount截取chatHistories,因为chatHistories是双行的所以要乘以2
        if (historyCount >= 0 && chatHistories.Count > historyCount * 2)
            chatHistories = chatHistories.Skip(chatHistories.Count - historyCount * 2).Take(historyCount * 2).ToList();
        chatHistories.ForEach(x => { x.Chat = _systemService.DecodeBase64(x.Chat); });
        if (coder)
        {
            for (int i = 0; i < chatHistories.Count; i++)
            {
                if (chatHistories[i].Role == "user")
                {
                    var nextIndex = i + 1;
                    if (nextIndex < chatHistories.Count && chatHistories[nextIndex].Role == "assistant")
                    {
                        // 查找 ``` 开始和结束的位置
                        int start = chatHistories[nextIndex].Chat.IndexOf("```");
                        while (start != -1)
                        {
                            int end = chatHistories[nextIndex].Chat.IndexOf("```", start + 3);
                            if (end != -1)
                            {
                                // 检查是否是语言类型代码块
                                int languageStart = start + 3;
                                int languageEnd = chatHistories[nextIndex].Chat
                                    .IndexOfAny(new char[] { '\n', ' ' }, languageStart);
                                if (languageEnd != -1 && languageEnd < end)
                                {
                                    // 移除代码块
                                    chatHistories[nextIndex].Chat =
                                        chatHistories[nextIndex].Chat.Remove(start, end - start + 3);
                                    // 重新查找下一个 ```
                                    start = chatHistories[nextIndex].Chat
                                        .IndexOf("```", start); // 注意这里不需要 + 3，因为我们已经移除了代码块
                                }
                                else
                                {
                                    // 不是语言类型代码块，继续查找下一个 ```
                                    start = chatHistories[nextIndex].Chat.IndexOf("```", end + 3);
                                }
                            }
                            else
                            {
                                // 没有找到结束的 ```，跳出循环
                                break;
                            }
                        }
                    }
                }
            }
        }
        else
        {
            for (int i = 0; i < chatHistories.Count; i++)
            {
                if (chatHistories[i].Role == "assistant")
                {
                    chatHistories[i].Chat = RemoveThinkTags(chatHistories[i].Chat);
                }
            }
        }

        return chatHistories;
    }

    private string RemoveThinkTags(string message)
    {
        // 检查消息是否以<think>开头
        if (message.TrimStart().StartsWith("<think>"))
        {
            int startIndex = message.IndexOf("<think>");
            int endIndex = message.IndexOf("</think>");

            // 如果找到了闭合标签
            if (endIndex > startIndex)
            {
                // 移除开头的<think>...</think>部分
                return message.Remove(startIndex, endIndex + 8 - startIndex);
            }
            // 如果<think>标签没有闭合，返回空字符串
            else
            {
                return string.Empty;
            }
        }

        // 如果消息不是以<think>开头，则返回原消息
        return message;
    }

    public async Task<List<ChatHistory>> GetChatHistoriesList(string account, int pageIndex, int pageSize,
        string searchKey)
    {
        var query = _context.ChatHistories
            .AsNoTracking()
            .Where(ch =>
                ch.Account == account && ch.IsDel != 1 && ch.Role == "user" && string.IsNullOrEmpty(ch.CollectionCode));

        // 优化：使用窗口函数获取每个 ChatId 对应的最早 CreateTime
        var subQuery = query
            .GroupBy(ch => ch.ChatId)
            .Select(g => new { ChatId = g.Key, MinCreateTime = g.Min(ch => ch.CreateTime) });

        var baseQuery = _context.ChatHistories
            .AsNoTracking()
            .Join(subQuery,
                ch => new { ch.ChatId, ch.CreateTime },
                sub => new { sub.ChatId, CreateTime = sub.MinCreateTime },
                (ch, sub) => ch)
            .Where(ch => ch.Account == account && ch.IsDel != 1 && ch.Role == "user");

        // 优化：将置顶逻辑和排序合并到一个查询中
        var pagedQuery = baseQuery
            .OrderByDescending(ch => ch.IsTop) // 置顶的排在前面
            .ThenByDescending(ch => ch.CreateTime);

        // 优化：应用搜索条件
        if (!string.IsNullOrEmpty(searchKey))
        {
            pagedQuery = (IOrderedQueryable<ChatHistory>)pagedQuery.Where(ch => ch.Chat.Contains(searchKey));
        }

        // 优化：数据库分页
        var chatHistories = await pagedQuery
            .Skip((pageIndex - 1) * pageSize)
            .Take(pageSize)
            .Select(ch => new ChatHistory // 一次性完成数据转换
            {
                ChatId = ch.ChatId,
                Account = ch.Account,
                Role = ch.Role,
                CreateTime = ch.CreateTime,
                IsDel = ch.IsDel,
                Chat = ch.Chat,
                ChatTitle = ch.ChatTitle,
                IsLock = ch.IsLock ?? 0,
                IsTop = ch.IsTop
            })
            .ToListAsync();

        // 优化：解码操作在获取数据后进行
        foreach (var history in chatHistories)
        {
            history.Chat = _systemService.DecodeBase64(history.Chat);
            if (!string.IsNullOrEmpty(history.ChatTitle))
            {
                history.ChatTitle = _systemService.DecodeBase64(history.ChatTitle);
                history.Chat = history.ChatTitle;
            }
        }

        return chatHistories;
    }

    public async Task<bool> UpdateAllChatTitlesByChatIdAsync(string account, string chatId, string chatTitle)
    {
        try
        {
            // 查询所有与给定 chatId 匹配的记录
            var chatHistories = await _context.ChatHistories
                .Where(ch => ch.ChatId == chatId && ch.Account == account && ch.IsDel == 0)
                .ToListAsync();

            if (chatHistories == null || chatHistories.Count == 0)
            {
                // 没有找到任何匹配的记录
                return false;
            }

            // 对 newChatTitle 进行 Base64 编码处理
            string encodedTitle = _systemService.EncodeBase64(chatTitle);

            // 更新所有匹配记录的 ChatTitle
            foreach (var chatHistory in chatHistories)
            {
                chatHistory.ChatTitle = encodedTitle;
            }

            // 提交更改到数据库
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            // 异常处理（也可以把异常抛出到更高一级的调用者处理）
            await _systemService.WriteLog($"/AiServer/UpdateAllChatTitlesByChatIdAsync:{ex.Message}",
                Dtos.LogLevel.Error, "system");
            return false;
        }
    }

    public bool DelChatHistory(string account, string chatId)
    {
        var chatHistories = new List<ChatHistory>();
        //删除聊天记录
        if (!string.IsNullOrEmpty(chatId))
        {
            //没有指定chatId则删除所有
            chatHistories = _context.ChatHistories.Where(x => x.Account == account && x.ChatId == chatId).ToList();
            chatHistories.ForEach(x => { x.IsDel = 1; });
        }
        else
        {
            chatHistories = _context.ChatHistories.Where(x => x.Account == account).ToList();
            chatHistories.ForEach(x => { x.IsDel = 1; });
        }

        chatHistories.ForEach(x => { x.IsDel = 1; });
        //清除缓存
        if (!string.IsNullOrEmpty(chatId))
            _redis.DeleteAsync(chatId);
        return _context.SaveChanges() > 0;
    }

    public List<ChatHistory> ShowHistoryDetail(string account, string chatId)
    {
        var chatHistories = new List<ChatHistory>();
        //从数据库加载
        chatHistories = _context.ChatHistories
            .Where(x => x.ChatId == chatId && x.IsDel != 1 && x.Account == account)
            .OrderBy(y => y.CreateTime).ToList();
        //写入缓存
        _redis.SetAsync(chatId, JsonConvert.SerializeObject(chatHistories), TimeSpan.FromHours(1));

        chatHistories.ForEach(x =>
        {
            x.Chat = _systemService.DecodeBase64(x.Chat);
            x.Reasoning = _systemService.DecodeBase64(x.Reasoning);
        });
        return chatHistories;
    }

    public List<ChatHistory> ShowHistoryDetailPaged(string account, string chatId, int pageIndex, int pageSize)
    {
        var chatHistories = new List<ChatHistory>();

        // 计算跳过的记录数
        int skip = (pageIndex - 1) * pageSize;

        // 先查询原始数据，因为需要Base64解码后才能正确判断长度
        var rawData = _context.ChatHistories
            .Where(x => x.ChatId == chatId && x.IsDel != 1 && x.Account == account)
            .OrderByDescending(y => y.CreateTime)
            .Skip(skip)
            .Take(pageSize)
            .OrderBy(x => x.CreateTime) // 最后按时间正序排列
            .ToList();

        // 解码并截取数据
        chatHistories = rawData.Select(x =>
        {
            var decodedChat = _systemService.DecodeBase64(x.Chat);
            var decodedReasoning = _systemService.DecodeBase64(x.Reasoning);

            // 判断是否需要截取
            bool chatNeedsTruncate = !string.IsNullOrEmpty(decodedChat) && decodedChat.Length > 500;
            bool reasoningNeedsTruncate = !string.IsNullOrEmpty(decodedReasoning) && decodedReasoning.Length > 300;

            return new ChatHistory
            {
                Id = x.Id,
                Account = x.Account,
                ChatId = x.ChatId,
                ChatCode = x.ChatCode,
                ChatGroupId = x.ChatGroupId,
                Role = x.Role,
                Model = x.Model,
                CreateTime = x.CreateTime,
                FirstTime = x.FirstTime,
                AllTime = x.AllTime,
                IsDel = x.IsDel,
                IsLock = x.IsLock,
                IsTop = x.IsTop,
                // 截取解码后的内容
                Chat = chatNeedsTruncate ? decodedChat.Substring(0, 500) + "..." : decodedChat,
                Reasoning = reasoningNeedsTruncate ? decodedReasoning.Substring(0, 300) + "..." : decodedReasoning,
                // 分别标记聊天内容和思考内容的截取状态
                ChatTitle = (chatNeedsTruncate && reasoningNeedsTruncate) ? "HAS_FULL_CONTENT_BOTH" :
                    chatNeedsTruncate ? "HAS_FULL_CONTENT_CHAT" :
                    reasoningNeedsTruncate ? "HAS_FULL_CONTENT_REASONING" : null
            };
        }).ToList();

        return chatHistories;
    }

    public ChatHistory GetFullChatContent(string account, string chatCode)
    {
        var chatHistory = _context.ChatHistories
            .Where(x => x.ChatCode == chatCode && x.IsDel != 1 && x.Account == account)
            .FirstOrDefault();

        if (chatHistory != null)
        {
            chatHistory.Chat = _systemService.DecodeBase64(chatHistory.Chat);
            chatHistory.Reasoning = _systemService.DecodeBase64(chatHistory.Reasoning);
        }

        return chatHistory;
    }

    public bool DelChatGroup(string account, string groupId, int type)
    {
        var chatHistories = _context.ChatHistories.Where(x => x.Account == account && x.ChatGroupId == groupId)
            .ToList();
        chatHistories.ForEach(x => { x.IsDel = type; });
        //清除缓存
        if (chatHistories != null && chatHistories.Count > 0)
            _redis.DeleteAsync(chatHistories[0].ChatId);
        return _context.SaveChanges() > 0;
    }

    public async Task<string> CreateMJdraw(string prompt, string botType, string[] referenceImgPath, string baseUrl,
        string apiKey, string drawmodel)
    {
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
        }
        catch (Exception e)
        {
            throw e;
        }

        baseUrl += $"/mj-{drawmodel}/mj/submit/imagine";
        var client = new RestClient(baseUrl);
        var request = new RestRequest("", Method.Post);
        request.AddHeader("mj-api-secret", apiKey);
        request.AddHeader("Authorization", apiKey);
        request.AddHeader("Content-Type", "application/json");
        var mJdrawBody = new MJdrawBody();
        mJdrawBody.prompt = prompt;
        //mJdrawBody.botType = botType;
        mJdrawBody.base64Array = referenceImgPath;
        var body = JsonConvert.SerializeObject(mJdrawBody);
        request.AddParameter("application/json", body, ParameterType.RequestBody);
        var response = await client.ExecuteAsync(request);
        if (response.IsSuccessful)
        {
            var res = JsonConvert.DeserializeObject<dynamic>(response.Content);
            string taskId = res.result.ToString();
            return taskId;
        }

        await _systemService.WriteLog(response.Content, LogLevel.Error, "system");
        return "";
    }

    public async Task<string> CreateMJdrawByBlend(string botType, List<string> blendImages, string baseUrl,
        string apiKey, string drawmodel, string dimensions)
    {
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
        }
        catch (Exception e)
        {
            throw e;
        }

        baseUrl += $"/mj-{drawmodel}/mj/submit/blend";
        var client = new RestClient(baseUrl);
        var request = new RestRequest("", Method.Post);
        request.AddHeader("mj-api-secret", apiKey);
        request.AddHeader("Authorization", apiKey);
        request.AddHeader("Content-Type", "application/json");
        List<string> base64Array = new List<string>();
        foreach (var image in blendImages)
        {
            base64Array.Add("data:image/jpeg;base64," + await _systemService.ImgConvertToBase64(image));
        }

        var mJdrawBody = new
        {
            base64Array = base64Array,
            dimensions = dimensions
        };
        var body = JsonConvert.SerializeObject(mJdrawBody);
        request.AddParameter("application/json", body, ParameterType.RequestBody);
        var response = await client.ExecuteAsync(request);
        if (response.IsSuccessful)
        {
            var res = JsonConvert.DeserializeObject<dynamic>(response.Content);
            string taskId = res.result.ToString();
            return taskId;
        }

        await _systemService.WriteLog(response.Content, LogLevel.Error, "system");
        return "";
    }

    public async Task<string> CreateMJdrawBySwap(string botType, string baseUrl, string apiKey, string drawmodel,
        string yourFace, string starFace)
    {
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
        }
        catch (Exception e)
        {
            throw e;
        }

        baseUrl += $"/mj-{drawmodel}/mj/insight-face/swap";
        var client = new RestClient(baseUrl);
        var request = new RestRequest("", Method.Post);
        request.AddHeader("mj-api-secret", apiKey);
        request.AddHeader("Authorization", apiKey);
        request.AddHeader("Content-Type", "application/json");
        yourFace = "data:image/jpeg;base64," + await _systemService.ImgConvertToBase64(yourFace);
        starFace = "data:image/jpeg;base64," + await _systemService.ImgConvertToBase64(starFace);
        var mJdrawBody = new
        {
            sourceBase64 = yourFace,
            targetBase64 = starFace
        };
        var body = JsonConvert.SerializeObject(mJdrawBody);
        request.AddParameter("application/json", body, ParameterType.RequestBody);
        var response = await client.ExecuteAsync(request);
        if (response.IsSuccessful)
        {
            var res = JsonConvert.DeserializeObject<dynamic>(response.Content);
            string taskId = res.result.ToString();
            return taskId;
        }

        await _systemService.WriteLog(response.Content, LogLevel.Error, "system");
        return "";
    }

    public async Task<string> CreateDALLdraw(string prompt, string imgSize, string quality, string baseUrl,
        string apiKey)
    {
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
        }
        catch (Exception e)
        {
            throw e;
        }

        var client = new RestClient(baseUrl + "/v1/images/generations");
        var request = new RestRequest("", Method.Post);
        request.AddHeader("Content-Type", "application/json");
        request.AddHeader("Authorization", $"Bearer {apiKey}");
        prompt = prompt.Replace("\r", "\\n").Replace("\n", "\\n");
        var dALLdrawBody = new DALLdrawBody();
        dALLdrawBody.model = "dall-e-3";
        dALLdrawBody.prompt = prompt;
        dALLdrawBody.size = imgSize;
        dALLdrawBody.quality = quality;
        dALLdrawBody.n = 1;
        var body = JsonConvert.SerializeObject(dALLdrawBody);
        request.AddParameter("application/json", body, ParameterType.RequestBody);
        var response = await client.ExecuteAsync(request);
        if (response.IsSuccessful)
        {
            var imgdata = JsonConvert.DeserializeObject<IMGResponseData>(response.Content);
            if (imgdata.data.Count > 0)
                return imgdata.data[0].url;
            return "";
        }

        return "";
    }

    public async Task<string> CreateGptImage1Task(string prompt, string action, string imageSize, string quality,
        string image, string mask, string baseUrl,
        string apiKey)
    {
        switch (action)
        {
            case "generations":
                return await CreateGptImage1draw(prompt, imageSize, quality, baseUrl, apiKey);
            case "edit":
                return await EditGptImage1draw(prompt, image, mask, imageSize, quality, baseUrl, apiKey);
            case "variation":
                return await VariationGptImage1draw(prompt, image, imageSize, quality, baseUrl, apiKey);
            default:
                return "";
        }
    }

    private async Task<string> CreateGptImage1draw(string prompt, string imgSize, string quality, string baseUrl,
        string apiKey)
    {
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
        }
        catch (Exception e)
        {
            throw e;
        }

        var client = new RestClient(baseUrl + "/v1/images/generations");
        var request = new RestRequest("", Method.Post);
        request.AddHeader("Content-Type", "application/json");
        request.AddHeader("Authorization", $"Bearer {apiKey}");
        prompt = prompt.Replace("\r", "\\n").Replace("\n", "\\n");
        var dALLdrawBody = new DALLdrawBody();
        dALLdrawBody.model = "gpt-image-1";
        dALLdrawBody.prompt = prompt;
        if (imgSize == "1024x1792")
            imgSize = "1024x1536";
        if (imgSize == "1792x1024")
            imgSize = "1536x1024";
        dALLdrawBody.size = imgSize;
        dALLdrawBody.quality = quality == "hd" ? "high" : "low";
        dALLdrawBody.n = 1;
        var body = JsonConvert.SerializeObject(dALLdrawBody);
        request.AddParameter("application/json", body, ParameterType.RequestBody);
        var response = await client.ExecuteAsync(request);
        if (response.IsSuccessful)
        {
            var imgdata = JsonConvert.DeserializeObject<IMGResponseData>(response.Content);
            if (imgdata.data.Count > 0)
                return imgdata.data[0].b64_json;
            return "";
        }

        return "";
    }

    private async Task<string> EditGptImage1draw(string prompt, string imageBase64, string maskBase64, string imgSize,
        string quality, string baseUrl, string apiKey)
    {
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');

            // Convert base64 strings to files
            var imageBytes = Convert.FromBase64String(imageBase64);
            var maskBytes = Convert.FromBase64String(maskBase64);

            var tempImagePath = Path.GetTempFileName() + ".png";
            var tempMaskPath = Path.GetTempFileName() + ".png";

            await File.WriteAllBytesAsync(tempImagePath, imageBytes);
            await File.WriteAllBytesAsync(tempMaskPath, maskBytes);

            try
            {
                var client = new RestClient(baseUrl + "/v1/images/edits");
                var request = new RestRequest("", Method.Post);
                request.AddHeader("Authorization", $"Bearer {apiKey}");

                // Add form data
                request.AlwaysMultipartFormData = true;
                request.AddParameter("model", "gpt-image-1");
                request.AddParameter("prompt", prompt);
                request.AddParameter("size", imgSize);
                request.AddParameter("quality", quality == "hd" ? "high" : "low");
                request.AddParameter("n", "1");

                // Add files
                request.AddFile("image", tempImagePath);
                request.AddFile("mask", tempMaskPath);

                var response = await client.ExecuteAsync(request);
                if (response.IsSuccessful)
                {
                    var imgdata = JsonConvert.DeserializeObject<IMGResponseData>(response.Content);
                    if (imgdata.data.Count > 0)
                        return imgdata.data[0].b64_json;
                    return "";
                }

                return "";
            }
            finally
            {
                // Clean up temporary files
                if (File.Exists(tempImagePath))
                    File.Delete(tempImagePath);

                if (File.Exists(tempMaskPath))
                    File.Delete(tempMaskPath);
            }
        }
        catch (Exception e)
        {
            throw e;
        }
    }

    private async Task<string> VariationGptImage1draw(string prompt, string imageBase64, string imgSize,
        string quality, string baseUrl, string apiKey)
    {
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');

            // Convert base64 strings to files
            var imageBytes = Convert.FromBase64String(imageBase64);

            var tempImagePath = Path.GetTempFileName() + ".png";
            var tempMaskPath = Path.GetTempFileName() + ".png";

            await File.WriteAllBytesAsync(tempImagePath, imageBytes);

            try
            {
                var client = new RestClient(baseUrl + "/v1/images/variations");
                var request = new RestRequest("", Method.Post);
                request.AddHeader("Authorization", $"Bearer {apiKey}");

                // Add form data
                request.AlwaysMultipartFormData = true;
                request.AddParameter("model", "gpt-image-1");
                request.AddParameter("prompt", prompt);
                request.AddParameter("size", imgSize);
                request.AddParameter("quality", quality == "hd" ? "high" : "low");
                request.AddParameter("n", "1");

                // Add files
                request.AddFile("image", tempImagePath);
                request.AddFile("mask", tempMaskPath);

                var response = await client.ExecuteAsync(request);
                if (response.IsSuccessful)
                {
                    var imgdata = JsonConvert.DeserializeObject<IMGResponseData>(response.Content);
                    if (imgdata.data.Count > 0)
                        return imgdata.data[0].b64_json;
                    return "";
                }

                return "";
            }
            finally
            {
                // Clean up temporary files
                if (File.Exists(tempImagePath))
                    File.Delete(tempImagePath);

                if (File.Exists(tempMaskPath))
                    File.Delete(tempMaskPath);
            }
        }
        catch (Exception e)
        {
            throw e;
        }
    }

    public async Task<string> CreateDALLE2draw(string prompt, string imgSize, string baseUrl, string apiKey, int n = 1)
    {
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
        }
        catch (Exception e)
        {
            throw e;
        }

        var client = new RestClient(baseUrl + "/v1/images/generations");
        var request = new RestRequest("", Method.Post);
        request.AddHeader("Content-Type", "application/json");
        request.AddHeader("Authorization", $"Bearer {apiKey}");
        prompt = prompt.Replace("\r", "\\n").Replace("\n", "\\n");
        var dALLe2drawBody = new DALLE2drawBody();
        dALLe2drawBody.model = "dall-e-2";
        dALLe2drawBody.prompt = prompt;
        dALLe2drawBody.size = imgSize;
        dALLe2drawBody.n = n;
        var body = JsonConvert.SerializeObject(dALLe2drawBody);
        request.AddParameter("application/json", body, ParameterType.RequestBody);
        var response = await client.ExecuteAsync(request);
        if (response.IsSuccessful)
        {
            var imgdata = JsonConvert.DeserializeObject<IMGResponseDataE2>(response.Content);
            if (imgdata.data.Count > 0)
                return imgdata.data[0].url;
            return "";
        }

        return "";
    }

    public async Task<SDResponse> CreateSDdraw(string prompt, string model, string imageSize, int numberImages,
        long seed, int inferenceSteps, float guidanceScale, string negativePrompt, string apiKey, string baseUrl,
        string Channel, string referenceImageData = "")
    {
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
        }
        catch (Exception e)
        {
            throw e;
        }

        var sDResponse = new SDResponse();
        if (Channel == "SiliconCloud")
        {
            var client = new RestClient(baseUrl + $"/v1/images/generations");
            var request = new RestRequest("", Method.Post);
            request.AddHeader("Content-Type", "application/json");
            request.AddHeader("Authorization", $"Bearer {apiKey}");
            prompt = prompt.Replace("\r", "\\n").Replace("\n", "\\n");
            var sDdrawBody = new SDdrawBody();
            sDdrawBody.model = model;
            sDdrawBody.prompt = prompt;
            sDdrawBody.batch_size = numberImages;
            sDdrawBody.guidance_scale = guidanceScale;
            sDdrawBody.seed = seed;
            sDdrawBody.num_inference_steps = inferenceSteps;
            sDdrawBody.image_size = imageSize;
            if (!string.IsNullOrEmpty(referenceImageData))
            {
                sDdrawBody.image = referenceImageData;
            }

            var jsonSettings = new JsonSerializerSettings
            {
                NullValueHandling = NullValueHandling.Ignore
            };
            var body = JsonConvert.SerializeObject(sDdrawBody, jsonSettings);
            request.AddParameter("application/json", body, ParameterType.RequestBody);
            var response = await client.ExecuteAsync(request);
            if (response.IsSuccessful)
                sDResponse = JsonConvert.DeserializeObject<SDResponse>(response.Content);
            else
                await _systemService.WriteLog("/AiServer/CreateSDdraw" + response.Content, LogLevel.Error, "system");
        }

        return sDResponse;
    }

    public async Task<TaskResponse> GetMJTaskResponse(string taskId, string baseUrl, string apiKey)
    {
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');


            var client = new RestClient($"{baseUrl}/mj/task/{taskId}/fetch");
            var request = new RestRequest("");
            request.AddHeader("Authorization", apiKey);
            var response = await client.ExecuteAsync(request);
            if (response.IsSuccessful)
            {
                var res = JsonConvert.DeserializeObject<TaskResponse>(response.Content);
                return res;
            }
        }
        catch (Exception e)
        {
            await _systemService.WriteLog("/AiServer/GetMJTaskResponse" + e.Message, LogLevel.Error, "system");
        }

        return null;
    }

    public async Task DownloadImageAsync(string imageUrl, string savePath, string fileNameWithoutExtension)
    {
        // 如果文件夹不存在则创建
        if (!Directory.Exists(savePath)) Directory.CreateDirectory(savePath);

        var fullPath = Path.Combine(savePath, $"{fileNameWithoutExtension}.png");

        try
        {
            using (var client = new HttpClient())
            {
                using (var response = await client.GetAsync(imageUrl))
                {
                    if (response.IsSuccessStatusCode)
                    {
                        using (var streamToReadFrom = await response.Content.ReadAsStreamAsync())
                        {
                            // 使用ImageSharp库加载图像
                            using (var image = Image.Load(streamToReadFrom))
                            {
                                // 转换并保存为PNG格式
                                image.SaveAsPng(fullPath);
                            }
                        }
                    }
                    else
                    {
                        await _systemService.WriteLog($"Error while downloading image: {response.StatusCode}",
                            LogLevel.Error, "system");
                        throw new Exception($"Error while downloading image: {response.StatusCode}");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"Error while downloading or saving the image: {ex.Message}", LogLevel.Error,
                "system");
            // 这里可以添加一些异常处理的代码，如记录日志等
            throw;
        }
    }

    public async Task<bool> SaveAiDrawResult(string account, string model, string savePath, string prompt,
        string referenceImgPath, string thumbSavePath, string thumbKey)
    {
        try
        {
            //保存到数据库
            _context.AIdrawRes.Add(new AIdrawRe
            {
                Account = account,
                AImodel = model,
                Prompt = prompt,
                ReferenceImgPath = referenceImgPath,
                ThumbSavePath = thumbSavePath,
                ThumbKey = thumbKey,
                ImgSavePath = savePath,
                CreateTime = DateTime.Now,
                NSFW = false,
                IsDel = 0
            });
            return _context.SaveChanges() > 0;
        }
        catch (Exception e)
        {
            await _systemService.WriteLog(e.Message, LogLevel.Error, "system");
            return false;
        }
    }

    public async Task<string> CreateMJchange(string changeType, int changeIndex, string taskId, string baseUrl,
        string apiKey, string drawmodel)
    {
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
        }
        catch (Exception e)
        {
            throw e;
        }

        baseUrl += $"/mj-{drawmodel}/mj/submit/change";
        var client = new RestClient(baseUrl);
        var request = new RestRequest("", Method.Post);
        request.AddHeader("mj-api-secret", apiKey);
        request.AddHeader("Content-Type", "application/json");
        var mJchangeBody = new MJchangeBody();
        mJchangeBody.action = changeType;
        mJchangeBody.index = changeIndex;
        mJchangeBody.taskId = taskId;
        var body = JsonConvert.SerializeObject(mJchangeBody);
        request.AddParameter("application/json", body, ParameterType.RequestBody);
        var response = await client.ExecuteAsync(request);
        if (response.IsSuccessful)
        {
            var res = JsonConvert.DeserializeObject<dynamic>(response.Content);
            string change_taskId = res.result.ToString();
            return change_taskId;
        }

        return "";
    }

    public async Task<List<SearchEngineResult>> GetWebSearchResult(string query, string googleSearchApiKey,
        string googleSearchEngineId)
    {
        var result = new GoogleSearch(googleSearchApiKey, googleSearchEngineId).Search(query);
        if (result.Count > 0)
            return result;
        return null;
    }

    public string AiGet(string url, Dictionary<string, object> dic, Dictionary<string, string> headers = null,
        Dictionary<string, string> cookies = null)
    {
        var result = "";
        var builder = new StringBuilder();
        builder.Append(url);
        if (dic.Count > 0)
        {
            builder.Append("?");
            var i = 0;
            foreach (var item in dic)
            {
                if (i > 0)
                    builder.Append("&");
                builder.AppendFormat("{0}={1}", item.Key, item.Value);
                i++;
            }
        }

        //如果headers有值，则加入到request头部
        var req = (HttpWebRequest)WebRequest.Create(builder.ToString());
        if (headers != null)
            foreach (var item in headers)
                req.Headers.Add(item.Key, item.Value);

        //如果cookies有值，则加入到request的Cookie容器
        if (cookies != null)
        {
            var cookieContainer = new CookieContainer();
            foreach (var item in cookies)
                cookieContainer.Add(new Cookie(item.Key, item.Value, "/", req.RequestUri.Host));
            req.CookieContainer = cookieContainer;
        }

        //添加参数
        var resp = (HttpWebResponse)req.GetResponse();
        var stream = resp.GetResponseStream();
        try
        {
            //获取内容
            using (var reader = new StreamReader(stream))
            {
                result = reader.ReadToEnd();
            }
        }
        finally
        {
            stream.Close();
        }

        return result;
    }

    public string AiPost(string url, Dictionary<string, object> parameters, Dictionary<string, string> headers = null,
        Dictionary<string, string> cookies = null, string jsonBody = "")
    {
        var client = new RestClient(url);
        var request = new RestRequest("", Method.Post);
        if (cookies != null)
            foreach (var item in cookies)
                request.AddHeader("Cookie", $"{item.Key}={item.Value}");
        if (headers != null)
            foreach (var item in headers)
                request.AddHeader(item.Key, item.Value);
        request.AddHeader("Content-Type", "application/json");
        request.AddHeader("Accept", "*/*");
        request.AddHeader("Connection", "keep-alive");
        if (!string.IsNullOrEmpty(jsonBody))
        {
            request.AddParameter("application/json", jsonBody, ParameterType.RequestBody);
        }
        else
        {
            var body = JsonSerializer.Serialize(parameters);
            request.AddParameter("application/json", body, ParameterType.RequestBody);
        }

        var response = client.Execute(request);

        if (response.IsSuccessStatusCode)
        {
            var responseContent = response.Content;
            return responseContent;
        }

        return "请求失败：" + response.StatusCode;
    }

    public async Task<List<AIdrawRe>> GetAIdrawResList(string account, int page, int pageSize, string role = "")
    {
        // 利用IQueryable延迟执行，直到真正需要数据的时候才去数据库查询
        if (!string.IsNullOrEmpty(role))
            account = "system";
        var query = _context.AIdrawRes.Where(p => p.Account == account);
        // 然后添加分页逻辑，此处同样是构建查询，没有执行
        var aidrawRes = query.OrderByDescending(x => x.CreateTime) // 这里可以根据需要替换为合适的排序字段
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList(); // 直到调用ToList，查询才真正执行

        return aidrawRes;
    }

    public async Task<string> GPTJsonModel(string systemprompt, string prompt, string model, string account)
    {
        AImodel modelCfg = new AImodel();
        string baseUrl = string.Empty;
        var systemCfg = _systemService.GetSystemCfgs();
        var aICodeCheckModel = systemCfg.FirstOrDefault(x => x.CfgKey == "AICodeCheckModel");
        var aICodeCheckBaseUrl = systemCfg.FirstOrDefault(x => x.CfgKey == "AICodeCheckBaseUrl");
        var aICodeCheckApiKey = systemCfg.FirstOrDefault(x => x.CfgKey == "AICodeCheckApiKey");
        if (aICodeCheckModel != null && aICodeCheckBaseUrl != null && aICodeCheckApiKey != null &&
            aICodeCheckModel.CfgValue == model)
        {
            baseUrl = aICodeCheckBaseUrl.CfgValue;
            modelCfg.ApiKey = aICodeCheckApiKey.CfgValue;
        }
        else
        {
            // 查询AIModel
            var aiModel = _systemService.GetAImodel();
            modelCfg = aiModel.FirstOrDefault(x => x.ModelName == model);
            if (modelCfg == null)
                return "未找到AIModel";
            baseUrl = modelCfg.BaseUrl;
        }

        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
        }
        catch (Exception e)
        {
            throw e;
        }

        var url = baseUrl + "/v1/chat/completions";

        var client = new RestClient(url);
        var request = new RestRequest("", Method.Post);
        request.AddHeader("Authorization", $"Bearer {modelCfg.ApiKey}");
        request.AddHeader("Content-Type", "application/json");
        request.AddHeader("Accept", "*/*");
        request.AddHeader("Connection", "keep-alive");

        var payload = new
        {
            model,
            response_format = new { type = "json_object" },
            messages = new[]
            {
                new { role = "system", content = systemprompt },
                new { role = "user", content = prompt }
            },
            stream = false
        };

        var jsonBody = JsonConvert.SerializeObject(payload);
        request.AddParameter("application/json", jsonBody, ParameterType.RequestBody);

        var response = client.Execute(request);
        if (response.IsSuccessful)
        {
            var jsonObj = JsonConvert.DeserializeObject<JObject>(response.Content);
            var content = jsonObj["choices"][0]["message"]["content"].ToString();
            var tikToken = TikToken.GetEncoding("o200k_base");
            await CreateUseLogAndUpadteMoney(account, model, tikToken.Encode(systemprompt + prompt).Count,
                tikToken.Encode(content).Count);


            return content;
        }

        return "";
    }

    public async Task<string> GPTJsonSchema(string prompt, string schema, string model, string account)
    {
        var aiChat = CreateAiChat(model, prompt, false, false, true, schema);
        var apiSetting = CreateAPISetting(model);
        var result = await CallingAINotStream(aiChat, apiSetting, null);
        return result;
    }

    public AiChat CreateAiChat(string aimodel, string prompt, bool stream, bool jsonModel, bool jsonSchema,
        string jsonSchemaInput)
    {
        AiChat aiChat = new AiChat();
        aiChat.Model = aimodel;
        aiChat.Stream = stream;

        // 处理JSON模型
        if (jsonModel)
        {
            aiChat.ResponseFormat = new aibotPro.Dtos.ResponseFormat()
            {
                Type = "json_object"
            };
        }

        // 处理JSON Schema
        if (jsonSchema && !string.IsNullOrWhiteSpace(jsonSchemaInput))
        {
            JObject schemaObject = JObject.Parse(jsonSchemaInput);

            aiChat.ResponseFormat = new aibotPro.Dtos.ResponseFormat()
            {
                Type = "json_schema",
                JsonSchema = new JsonSchemaWrapper
                {
                    Name = "reply_schema",
                    Strict = true,
                    Schema = schemaObject
                }
            };
        }

        // 创建消息列表
        List<Message> messages = new List<Message>();
        Message message = new Message
        {
            Role = "user",
            Content = prompt
        };
        messages.Add(message);
        aiChat.Messages = messages;
        return aiChat;
    }

    public VisionBody CreateVisionBody(string aimodel, string prompt, string imgurl, bool stream, bool jsonModel,
        bool jsonSchema, string jsonSchemaInput)
    {
        VisionBody visionBody = new VisionBody();
        visionBody.model = aimodel;
        visionBody.stream = stream;

        if (jsonModel)
        {
            visionBody.response_format = new aibotPro.Dtos.ResponseFormat()
            {
                Type = "json_object"
            };
        }

        if (jsonSchema && !string.IsNullOrWhiteSpace(jsonSchemaInput))
        {
            // 解析jsonSchemaInput为JObject
            JObject schemaObject = JObject.Parse(jsonSchemaInput);

            visionBody.response_format = new aibotPro.Dtos.ResponseFormat()
            {
                Type = "json_schema",
                JsonSchema = new JsonSchemaWrapper
                {
                    Name = "reply_schema", // 可以自定义通过参数传入或固定命名
                    Strict = true, // 根据实际需求设置
                    Schema = schemaObject
                }
            };
        }

        List<VisionChatMessage> messages = new List<VisionChatMessage>();
        List<VisionContent> visionContents = new List<VisionContent>();

        VisionContent textVisionContent = new VisionContent()
        {
            type = "text",
            text = prompt
        };
        VisionContent imgVisionContent = new VisionContent()
        {
            type = "image_url",
            image_url = new VisionImg
            {
                url = imgurl
            }
        };

        visionContents.Add(textVisionContent);
        visionContents.Add(imgVisionContent);

        messages.Add(new VisionChatMessage
        {
            role = "user",
            content = new ContentWrapper
            {
                visionContentList = visionContents
            }
        });

        visionBody.messages = messages.ToArray();
        return visionBody;
    }

    public async Task<string> TTS(string text, string model, string voice)
    {
        //查询AIModel
        var aiModel = _systemService.GetAImodel();
        var modelCfg = aiModel.FirstOrDefault();
        if (modelCfg == null)
            return "未找到AIModel";
        var baseUrl = modelCfg.BaseUrl;
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
        }
        catch (Exception e)
        {
            throw e;
        }

        var url = baseUrl + "/v1/audio/speech";
        var client = new RestClient(url);
        var request = new RestRequest("", Method.Post);
        request.AddHeader("Content-Type", "application/json");
        request.AddHeader("Authorization", $"Bearer {modelCfg.ApiKey}");
        request.AddHeader("Accept", "*/*");
        request.AddHeader("Connection", "keep-alive");
        text = text.Replace("\r", "\\n").Replace("\n", "\\n");
        var body = @"{" + "\n" +
                   @$"  ""model"": ""{model}""," + "\n" +
                   @$"  ""input"": ""{text}""," + "\n" +
                   @$"  ""voice"": ""{voice}""" + "\n" +
                   @"}";
        request.AddParameter("application/json", body, ParameterType.RequestBody);
        var response = await client.ExecuteAsync(request);
        if (response.StatusCode == HttpStatusCode.OK)
        {
            //保存返回的音频文件
            var savePath = Path.Combine("wwwroot", $"files/audio/{DateTime.Now.ToString("yyyyMMdd")}");
            if (!Directory.Exists(savePath)) Directory.CreateDirectory(savePath);
            var fileName = Guid.NewGuid() + ".mp3";
            savePath = Path.Combine(savePath, fileName);
            using (var fs = new FileStream(savePath, FileMode.Create))
            {
                fs.Write(response.RawBytes, 0, response.RawBytes.Length);
            }

            return savePath;
        }

        await _systemService.WriteLog(response.Content, LogLevel.Error, "system");
        return "";
    }

    public async Task ExecuteFunctionWithLoadingIndicators(string fnName, string chatId, string senMethod,
        CancellationToken cancellationToken)
    {
        var chatRes = new ChatRes();
        string loadingDOM = @"<div class=""pluginloading-container"">
                                <div class=""pluginloading-loading-border"">
                                    <img src=""{0}"" class=""pluginloading-avatar"">
                                </div>
                                <div class=""pluginloading-content"">
                                    <h6 class=""pluginloading-title"">{1}</h6>
                                </div>
                            </div>";
        //async Task StartLoadingIndicator(List<string> emojiList)
        //{
        //    var random = new Random();
        //    try
        //    {
        //        while (!cancellationToken.IsCancellationRequested)
        //        {
        //            var randomEmoji = emojiList[random.Next(emojiList.Count)];
        //            chatRes.message = $"{randomEmoji}";
        //            await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
        //            await Task.Delay(1000, cancellationToken);
        //        }
        //    }
        //    catch (TaskCanceledException)
        //    {
        //        // Handle the task cancellation if needed
        //    }
        //}

        if (fnName == "use_dalle3_withpr")
        {
            chatRes.message = string.Format(loadingDOM, "/system/images/systempluginlogo/dalle3.png", "DALL·E3");
            chatRes.loading = true;
            await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
            //var emojiList = new List<string> { "🖌", "🎨", "🔧", "🖊", "🖍", "🖼", "🤯" };
            //await StartLoadingIndicator(emojiList);
        }
        else if (fnName == "search_google_when_gpt_cannot_answer")
        {
            chatRes.message = string.Format(loadingDOM, "/system/images/systempluginlogo/google.png", "Google搜索");
            chatRes.loading = true;
            await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
            //var emojiList = new List<string> { "🌐" };
            //await StartLoadingIndicator(emojiList);
        }
        else if (fnName == "search_knowledge_base")
        {
            chatRes.message = string.Format(loadingDOM, "/system/images/systempluginlogo/knowledge.png", "知识库检索");
            chatRes.loading = true;
            await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
            //var emojiList = new List<string> { "🔎📄" };
            //await StartLoadingIndicator(emojiList);
        }
        else
        {
            var plugin = _context.Plugins.Where(p => p.Pfunctionname == fnName).FirstOrDefault();
            if (plugin != null)
            {
                chatRes.message = string.Format(loadingDOM, plugin.Pavatar, plugin.Pnickname);
                chatRes.loading = true;
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
            }
        }
    }

    public async Task<string> UnDoubletreating(PluginResDto pluginResDto, string chatId, string senMethod)
    {
        var chatRes = new ChatRes();
        var res = string.Empty;
        switch (pluginResDto.doubletype)
        {
            case "dalle3":
                if (!string.IsNullOrEmpty(pluginResDto.errormsg) || string.IsNullOrEmpty(pluginResDto.result))
                {
                    chatRes.message = $"绘制失败，请重试！({pluginResDto.errormsg})";
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    break;
                }

                var res1 = "<p>已为您绘制完成</p>";
                chatRes.message = res1;
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                Thread.Sleep(200);
                var res2 = "<p>绘制结果如下,请您查阅：</p><br />";
                chatRes.message = res2;
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                Thread.Sleep(200);
                var res3 = $"<img src='{pluginResDto.result}' style='width:300px;'/>";
                chatRes.message = res3;
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                Thread.Sleep(200);
                var res4 = @$"<br><p>提示词：<b>{pluginResDto.dallprompt}</b></p>";
                chatRes.message = res4;
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                Thread.Sleep(200);
                var res5 =
                    @$"<br><p><b>如有需要，您可以前往【个人中心】->【图库】下载此图片，或者</b><a href=""{pluginResDto.result}"" target=""_blank"">【点击这里下载此图片】</a></p>";
                chatRes.message = res5;
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                res = res1 + res2 + res3 + res4 + res5;
                break;
            case "html":
                res = pluginResDto.result;
                chatRes.message = res;
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                break;
            case "js":
                chatRes.message = "";
                chatRes.jscode = pluginResDto.result;
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                chatRes.jscode = "";
                break;
            default:
                res = pluginResDto.result;
                chatRes.message = res;
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                break;
        }

        return res;
    }

    public async Task<bool> SaveMemory(string aimodel, string account, string chatgroupId, string chatId)
    {
        var result = false;
        // 获取历史记录
        var chatList = GetChatHistories(account, chatId, -1);

        // 如果 chatgroupId 不为空，则进行过滤
        if (!string.IsNullOrEmpty(chatgroupId))
        {
            chatList = chatList.Where(c => c.ChatGroupId == chatgroupId).ToList();
        }

        // 按照 chatgroupId 分组处理
        var groupedChatList = chatList.GroupBy(c => c.ChatGroupId).ToList();

        foreach (var group in groupedChatList)
        {
            var memoryStr = string.Empty;
            foreach (var item in group)
            {
                if (item.Role == "user")
                {
                    memoryStr += $"[User]:\n {_systemService.DecodeBase64(item.Chat)} \n";
                }
                else
                {
                    memoryStr += $"[Assistant]:\n {_systemService.DecodeBase64(item.Chat)} \n";
                }
            }

            // 如果 memoryStr 不为空，进行向量保存操作
            if (!string.IsNullOrEmpty(memoryStr))
            {
                var systemCfgs = _systemService.GetSystemCfgs();
                var embeddingsUrl = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsUrl")?.CfgValue;
                var embeddingsApiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsApiKey")?.CfgValue;

                // 文本转向量
                var client = new RestClient(embeddingsUrl);
                var request = CreateRequest(aimodel, memoryStr, embeddingsApiKey);
                var response = await client.ExecuteAsync(request);
                var vector = new List<float>();

                if (response.IsSuccessful)
                {
                    var embeddingApiResponseByMilvus =
                        JsonConvert.DeserializeObject<EmbeddingApiResponseByMilvus>(response.Content);
                    if (embeddingApiResponseByMilvus != null && embeddingApiResponseByMilvus.Data != null &&
                        embeddingApiResponseByMilvus.Data.Count > 0)
                    {
                        vector = embeddingApiResponseByMilvus.Data[0].Embedding;
                    }

                    var milvusDataDto = new MilvusDataDto
                    {
                        Id = Guid.NewGuid().ToString("N"),
                        Account = account,
                        Vector = vector,
                        VectorContent = memoryStr,
                        Type = $"{account}_memory"
                    };

                    result = await _milvusService.InsertVector(new List<MilvusDataDto> { milvusDataDto },
                        $"{account}_memory", account);
                }
            }
        }

        return result;
    }

    public async Task<SearchVectorResultByMilvus> GetMemory(string aimodel, string account, string prompt)
    {
        var searchVectorResultByMilvus = new SearchVectorResultByMilvus();
        var systemCfgs = _systemService.GetSystemCfgs();
        var embeddingsUrl = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsUrl")?.CfgValue;
        var embeddingsApiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsApiKey")?.CfgValue;
        //文本转向量
        var client = new RestClient(embeddingsUrl);
        var request = CreateRequest(aimodel, prompt, embeddingsApiKey);
        var response = await client.ExecuteAsync(request);
        var vector = new List<float>();
        if (response.IsSuccessful)
        {
            var embeddingApiResponseByMilvus =
                JsonConvert.DeserializeObject<EmbeddingApiResponseByMilvus>(response.Content);
            if (embeddingApiResponseByMilvus != null && embeddingApiResponseByMilvus.Data != null &&
                embeddingApiResponseByMilvus.Data.Count > 0) vector = embeddingApiResponseByMilvus.Data[0].Embedding;
            var typeCodes = new List<string> { $"{account}_memory" };
            searchVectorResultByMilvus = await _milvusService.SearchVector(vector, account, typeCodes, 5);
        }

        return searchVectorResultByMilvus;
    }

    public RestRequest CreateRequest(string model, string input, string embeddingsapikey)
    {
        var request = new RestRequest("", Method.Post);
        request.AddHeader("Authorization", $"Bearer {embeddingsapikey}");
        request.AddHeader("Content-Type", "application/json");
        request.AddHeader("Accept", "*/*");
        var embeddingsBody = new EmbeddingsBody
        {
            Model = model,
            Input = input
        };
        var body = JsonConvert.SerializeObject(embeddingsBody);
        request.AddParameter("application/json", body, ParameterType.RequestBody);
        return request;
    }

    public async Task<string> CreateHistoryPrompt(List<Message> messages,
        List<VisionChatMessage> visionChatMesssages = null)
    {
        var systemCfg = _systemService.GetSystemCfgs();
        var keepQuantity = systemCfg.Where(x => x.CfgCode == "History_Prompt_Keep_Quantity").FirstOrDefault();
        if (keepQuantity == null)
            return string.Empty;
        // 检查是否有足够的消息来创建历史记录
        if ((messages == null || messages.Count < int.Parse(keepQuantity.CfgValue) * 2) &&
            (visionChatMesssages == null || visionChatMesssages.Count < int.Parse(keepQuantity.CfgValue) * 2))
            return string.Empty;

        var prompt = string.Empty;
        var historyStr = "请对以下对话历史进行简洁的总结，保留关键信息和上下文：\n\n";
        var aiChat = new AiChat();
        var useAiModel = systemCfg.FirstOrDefault(x => x.CfgKey == "History_Prompt_AIModel");
        if (useAiModel == null)
            return string.Empty;
        aiChat.Model = useAiModel.CfgValue;
        aiChat.Stream = false;
        var apiSetting = CreateAPISetting(aiChat.Model);

        List<object> lastTwoMessages;
        List<object> messagesToSummarize;

        if (visionChatMesssages != null && visionChatMesssages.Any())
        {
            lastTwoMessages = visionChatMesssages.TakeLast(2).Cast<object>().ToList();
            messagesToSummarize = visionChatMesssages.Take(visionChatMesssages.Count - 2).Cast<object>().ToList();
        }
        else
        {
            lastTwoMessages = messages.TakeLast(2).Cast<object>().ToList();
            messagesToSummarize = messages.Take(messages.Count - 2).Cast<object>().ToList();
        }

        // 生成历史摘要
        foreach (var item in messagesToSummarize)
        {
            if (item is VisionChatMessage visionMessage)
            {
                // 确定角色，并追加到历史字符串
                historyStr += visionMessage.role == "user" ? "用户: " : "AI: ";

                // 检查是否有 stringContent (即 content 被配置为字符串)
                if (visionMessage.content.stringContent != null)
                {
                    historyStr += visionMessage.content.stringContent + " ";
                }
                // 否则检查是否有 visionContentList
                else if (visionMessage.content.visionContentList != null)
                {
                    foreach (var content in visionMessage.content.visionContentList)
                    {
                        // 根据内容类型处理
                        if (content.type == "text")
                        {
                            historyStr += content.text + " ";
                        }
                        else if (content.type == "image_url" && content.image_url != null)
                        {
                            historyStr += "[图片内容: " + content.image_url.url + "] ";
                        }
                    }
                }
            }
            else if (item is Message message)
            {
                historyStr += message.Role == "user" ? "用户: " : "AI: ";
                historyStr += message.Content;
            }

            historyStr += "\n";
        }

        // 发起非流请求获取摘要
        var newMessages = new List<Message>
        {
            new()
            {
                Role = "system",
                Content = "你是一个专业的对话总结助手。请对给定的对话历史进行全面的总结，确保包含关键信息和上下文。避免重复和不必要的细节。条理清晰段落清晰。"
            },
            new()
            {
                Role = "user",
                Content = historyStr
            }
        };
        aiChat.Messages = newMessages;
        var summaryResult = await CallingAINotStream(aiChat, apiSetting);

        if (!string.IsNullOrEmpty(summaryResult))
        {
            prompt += "# 要求：请基于以下内容继续我们的对话。\n\n";
            prompt = $"* 以下是之前对话的总结：\n\n{summaryResult}\n\n*以下是最近的对话：\n\n";
            foreach (var message in lastTwoMessages)
            {
                if (message is VisionChatMessage visionMessage)
                {
                    // 追加用户或AI的角色到 prompt
                    prompt += $"{(visionMessage.role == "user" ? "用户" : "AI")}: ";

                    // 如果 content 是字符串，直接处理 stringContent
                    if (visionMessage.content.stringContent != null)
                    {
                        prompt += visionMessage.content.stringContent + " ";
                    }
                    // 否则，处理 visionContentList
                    else if (visionMessage.content.visionContentList != null)
                    {
                        foreach (var content in visionMessage.content.visionContentList)
                        {
                            // 如果内容类型是 text，就追加文本
                            if (content.type == "text")
                            {
                                prompt += content.text + " ";
                            }
                        }
                    }
                }
                else if (message is Message textMessage)
                {
                    prompt += $"{(textMessage.Role == "user" ? "用户" : "AI")}: {textMessage.Content}";
                }

                prompt += "\n";
            }
        }

        return prompt;
    }

    public async Task<string> CreateSunoTask(string mode, string gptDescription, string prompt, string tags, string mv,
        string title, string baseUrl, string apiKey, string account)
    {
        var taskId = string.Empty;
        var data = string.Empty;
        if (baseUrl.EndsWith("/"))
            baseUrl = baseUrl.TrimEnd('/');
        baseUrl = baseUrl + "/suno/v1/music";
        if (mode == "inspiration") //灵感模式
        {
            mv = "chirp-v3-0";
            tags = "emotional punk";
            var systemPrompt = @"
                                    # 你是一个歌曲作词专家。
                                    # 请根据提供的用户灵感进行创作
                                    # 输出应该是一个JSON格式的字符串，包含歌词,标题,标签。
                                    # 输出的JSON格式应当按照以下示例：
                                    {
                                        ""title"": ""这里填写根据灵感生成的标题"",
                                        ""lyrics"": ""这里填写根据灵感生成的歌词"",
                                        ""tags"": ""这里填写根据灵感生成的标签,标签使用英语"",
                                    }";
            var userprompt = $"用户灵感：{gptDescription}";
            var aiModel = "gpt-4.1-nano-openai";
            var systemCfg = _systemService.GetSystemCfgs();
            var aICodeCheckModel = systemCfg.FirstOrDefault(x => x.CfgKey == "AICodeCheckModel");
            if (aICodeCheckModel != null)
                aiModel = aICodeCheckModel.CfgValue;
            var resultJson = await GPTJsonModel(systemPrompt, userprompt, aiModel, account);
            if (!string.IsNullOrEmpty(resultJson))
            {
                var resultData = JsonConvert.DeserializeObject<LyricsResult>(resultJson);
                if (resultData != null && !string.IsNullOrEmpty(resultData.Lyrics) &&
                    !string.IsNullOrEmpty(resultData.Title) && !string.IsNullOrEmpty(resultData.Tags))
                {
                    prompt = resultData.Lyrics;
                    title = resultData.Title;
                    tags = resultData.Tags;
                }
                else
                {
                    return taskId;
                }
            }
            else
            {
                return taskId;
            }
        }

        var dataObj = new
        {
            custom_mode = true,
            input = new
            {
                prompt,
                title,
                tags,
                mv
            }
        };
        data = JsonConvert.SerializeObject(dataObj);
        //发起请求
        var client = new RestClient(baseUrl);
        var request = new RestRequest("", Method.Post);
        request.AddHeader("Content-Type", "application/json");
        request.AddHeader("Authorization", $"Bearer {apiKey}");
        request.AddHeader("Accept", "*/*");
        request.AddHeader("Connection", "keep-alive");
        request.AddParameter("application/json", data, ParameterType.RequestBody);
        var response = await client.ExecuteAsync(request);
        if (response.IsSuccessful)
        {
            var sunoResponse = JsonConvert.DeserializeObject<SunoResponse>(response.Content);
            if (sunoResponse != null && sunoResponse.Data != null && !string.IsNullOrEmpty(sunoResponse.Data.TaskId))
                taskId = JsonConvert.DeserializeObject<SunoResponse>(response.Content).Data.TaskId;
        }
        else
        {
            await _systemService.WriteLog("AiServer/CreateSunoTask" + response.Content, LogLevel.Error, "system");
        }

        if (!string.IsNullOrEmpty(taskId)) await _redis.SetAsync($"{account}-suno", taskId, TimeSpan.FromHours(1));
        return taskId;
    }

    public async Task<SunoTaskResponse> GetSunoTask(string taskId, string account, string baseUrl, string apiKey)
    {
        var redis_key = $"{account}-suno";
        var sunoTaskResponse = new SunoTaskResponse();
        if (baseUrl.EndsWith("/"))
            baseUrl = baseUrl.TrimEnd('/');
        baseUrl = baseUrl + "/suno/v1/music/";
        var client = new RestClient(baseUrl + taskId);
        var request = new RestRequest("");
        request.AddHeader("Content-Type", "application/json");
        request.AddHeader("Authorization", $"Bearer {apiKey}");
        request.AddHeader("Accept", "*/*");
        request.AddHeader("Connection", "keep-alive");

        const int maxRetries = 3;
        var retryCount = 0;
        RestResponse response = null;

        while (retryCount < maxRetries)
            try
            {
                response = await client.ExecuteAsync(request);
                if (response.IsSuccessStatusCode) break;
                retryCount++;
                if (retryCount < maxRetries)
                    await Task.Delay(1000 * retryCount); // Wait for 1, 2, 3 seconds before retrying
            }
            catch (Exception ex)
            {
                await _systemService.WriteLog($"【/AiServer/GetSunoTask】Attempt {retryCount + 1} failed: {ex.Message}",
                    LogLevel.Error, account);
                retryCount++;
                if (retryCount < maxRetries) await Task.Delay(1000 * retryCount);
            }

        if (response == null || !response.IsSuccessStatusCode)
        {
            await _redis.DeleteAsync(redis_key);
            throw new Exception($"API request failed after {maxRetries} attempts");
        }

        try
        {
            sunoTaskResponse = JsonConvert.DeserializeObject<SunoTaskResponse>(response.Content);
        }
        catch (Exception e)
        {
            await _systemService.WriteLog($"【/AiServer/GetSunoTask】:{e.Message}", LogLevel.Error, account);
        }

        if (sunoTaskResponse.Data.Status == "completed")
        {
            foreach (var clipKvp in sunoTaskResponse.Data.Clips)
            {
                var clip = clipKvp.Value;
                var sunoRe = new SunoRe
                {
                    Account = account,
                    TaskId = taskId,
                    SongId = clip.Id,
                    Prompt = clip.Metadata.Prompt,
                    CreateTime = DateTime.Now,
                    Title = clip.Title,
                    ImageUrl = clip.ImageUrl,
                    ImageLargeUrl = clip.ImageLargeUrl,
                    AudioUrl = clip.AudioUrl,
                    VideoUrl = clip.VideoUrl
                };

                _context.SunoRes.Add(sunoRe);
            }

            await _context.SaveChangesAsync();
            await _redis.DeleteAsync(redis_key);

            // 在后台启动一个任务处理文件下载和可能的COS上传
            _ = Task.Run(async () =>
            {
                using (var scope = _serviceProvider.CreateScope())
                {
                    var context = scope.ServiceProvider.GetRequiredService<AIBotProContext>();
                    var systemService = scope.ServiceProvider.GetRequiredService<ISystemService>();
                    var cosService = scope.ServiceProvider.GetRequiredService<ICOSService>();

                    var systemCfg = systemService.GetSystemCfgs();
                    var cos_switch = systemCfg.FirstOrDefault(x => x.CfgKey == "COS_Switch");
                    var useCOS = cos_switch != null && cos_switch.CfgValue == "1";

                    foreach (var clipKvp in sunoTaskResponse.Data.Clips)
                    {
                        var clip = clipKvp.Value;
                        var newFileName = Guid.NewGuid().ToString().Replace("-", "");
                        var currentDate = DateTime.Now.ToString("yyyyMMdd");
                        var baseSavePath = Path.Combine("wwwroot", "files", "sunores", currentDate);

                        var sunoRe = await context.SunoRes.FirstOrDefaultAsync(s => s.SongId == clipKvp.Value.Id);

                        if (sunoRe != null)
                        {
                            if (useCOS)
                            {
                                var imageResult = await DownloadAndUploadToCOS(clip.ImageUrl, baseSavePath, "image",
                                    newFileName, account, cosService, systemService);
                                sunoRe.ImageCosKey = imageResult.CosKey;
                                sunoRe.ImageUrl = imageResult.CosUrl;

                                var imageLargeResult = await DownloadAndUploadToCOS(clip.ImageLargeUrl, baseSavePath,
                                    "image", newFileName, account, cosService, systemService);
                                sunoRe.ImageLargeCosKey = imageLargeResult.CosKey;
                                sunoRe.ImageLargeUrl = imageLargeResult.CosUrl;

                                var audioResult = await DownloadAndUploadToCOS(clip.AudioUrl, baseSavePath, "audio",
                                    newFileName, account, cosService, systemService);
                                sunoRe.AudioCosKey = audioResult.CosKey;
                                sunoRe.AudioUrl = audioResult.CosUrl;

                                var videoResult = await DownloadAndUploadToCOS(clip.VideoUrl, baseSavePath, "video",
                                    newFileName, account, cosService, systemService);
                                sunoRe.VideoCosKey = videoResult.CosKey;
                                sunoRe.VideoUrl = videoResult.CosUrl;
                            }
                            else
                            {
                                sunoRe.ImageUrl = await DownloadToLocal(clip.ImageUrl, baseSavePath, "image",
                                    newFileName, account, systemService);
                                sunoRe.ImageLargeUrl = await DownloadToLocal(clip.ImageLargeUrl, baseSavePath, "image",
                                    newFileName, account, systemService);
                                sunoRe.AudioUrl = await DownloadToLocal(clip.AudioUrl, baseSavePath, "audio",
                                    newFileName, account, systemService);
                                sunoRe.VideoUrl = await DownloadToLocal(clip.VideoUrl, baseSavePath, "video",
                                    newFileName, account, systemService);
                            }

                            context.SunoRes.Update(sunoRe);
                            await context.SaveChangesAsync();
                        }
                    }
                }
            });
            Thread.Sleep(10000); //等10s控制并发
        }

        return sunoTaskResponse;
    }

    public async Task<TokenizerDetail> TokenizeJinaAI(string content, int maxChunkLength,
        string tokenizer = "o200k_base", bool returnChunks = true, bool returnTokens = false)
    {
        TokenizerDetail result = new TokenizerDetail();
        var systemCfgs = _systemService.GetSystemCfgs();
        var baseUrl = systemCfgs.FirstOrDefault(x => x.CfgKey == "Tokenize_BaseUrl_Jina")?.CfgValue;
        var apiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "Tokenize_ApiKey_Jina")?.CfgValue;

        if (string.IsNullOrEmpty(baseUrl))
        {
            throw new Exception("Tokenize_BaseUrl_Jina is not configured.");
        }

        using (var httpClient = new HttpClient())
        {
            httpClient.BaseAddress = new Uri(baseUrl);

            if (!string.IsNullOrEmpty(apiKey))
            {
                httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            }

            var requestData = new
            {
                content = content,
                return_chunks = returnChunks.ToString().ToLower(),
                max_chunk_length = maxChunkLength.ToString(),
                return_tokens = returnTokens.ToString().ToLower(),
                tokenizer = tokenizer
            };

            var jsonContent = JsonConvert.SerializeObject(requestData);
            var httpContent = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync("", httpContent);

            if (response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                result = JsonConvert.DeserializeObject<TokenizerDetail>(responseContent);
            }
            else
            {
                throw new Exception($"API request failed with status code: {response.StatusCode}");
            }
        }

        return result;
    }


    public async Task<RerankerResponse> RerankerJinaAI(List<string> documents, string query, int topn)
    {
        var systemCfgs = _systemService.GetSystemCfgs();
        var baseUrl = systemCfgs.FirstOrDefault(x => x.CfgKey == "Rerank_BaseUrl_Jina")?.CfgValue;
        var apiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "Rerank_ApiKey_Jina")?.CfgValue;
        var model = systemCfgs.FirstOrDefault(x => x.CfgKey == "Rerank_Model_Jina")?.CfgValue;

        if (string.IsNullOrEmpty(baseUrl) || string.IsNullOrEmpty(apiKey))
        {
            throw new Exception("Rerank configuration is missing.");
        }

        using (var client = new HttpClient())
        {
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

            var requestBody = new
            {
                model,
                query,
                top_n = topn,
                documents
            };

            var content = new StringContent(JsonConvert.SerializeObject(requestBody), Encoding.UTF8,
                "application/json");

            var response = await client.PostAsync(baseUrl, content);

            if (response.IsSuccessStatusCode)
            {
                var responseString = await response.Content.ReadAsStringAsync();
                return JsonConvert.DeserializeObject<RerankerResponse>(responseString);
            }
            else
            {
                throw new HttpRequestException($"Error calling Jina AI API: {response.StatusCode}");
            }
        }
    }

    public async Task<string> ReadUrlJinaAI(string url)
    {
        var systemCfgs = _systemService.GetSystemCfgs();
        var baseUrl = systemCfgs.FirstOrDefault(x => x.CfgKey == "Read_BaseUrl_Jina")?.CfgValue;
        var apiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "Read_ApiKey_Jina")?.CfgValue;

        if (string.IsNullOrEmpty(baseUrl))
        {
            throw new Exception("Rerank configuration is missing.");
        }

        using (var client = new HttpClient())
        {
            if (!string.IsNullOrEmpty(apiKey))
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

            var requestBody = new
            {
                url = url
            };

            var content = new StringContent(JsonConvert.SerializeObject(requestBody), Encoding.UTF8,
                "application/json");

            var response = await client.PostAsync(baseUrl, content);

            if (response.IsSuccessStatusCode)
            {
                var responseString = await response.Content.ReadAsStringAsync();
                return responseString;
            }
            else
            {
                throw new HttpRequestException($"Error calling Jina AI API: {response.StatusCode}");
            }
        }
    }

    public APISetting CreateAPISetting(string aimodel)
    {
        var apiSetting = new APISetting();
        //var aImodels = _systemService.GetAImodel();
        //var aiModelInfo = aImodels.Where(x => x.ModelName == aimodel).FirstOrDefault();
        // if (aiModelInfo == null) throw new Exception("AI模型不存在");
        var systemCfg = _systemService.GetSystemCfgs();
        var apiKey = systemCfg.FirstOrDefault(x => x.CfgKey == "AICodeCheckApiKey").CfgValue;
        //标准化baseurl
        var baseUrl = systemCfg.FirstOrDefault(x => x.CfgKey == "AICodeCheckBaseUrl").CfgValue;
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
        }
        catch (Exception e)
        {
            throw e;
        }

        apiSetting.ApiKey = apiKey;
        apiSetting.BaseUrl = baseUrl;
        return apiSetting;
    }

    public int GetImageTokenCount(string imagePath, string modelName)
    {
        int width = 0, height = 0;

        // Load image and get width and height
        using (var image = LoadImage(imagePath))
        {
            width = image.Width;
            height = image.Height;
        }

        // Calculate tokens
        if (modelName.Contains("claude"))
        {
            return 2048;
        }
        else if (modelName.Contains("gpt"))
        {
            int blockWidth = 512;
            int blockHeight = 512;
            int tokenPerBlock = 255;

            // 如果图片小于或等于一个块的大小，直接返回一个块的token数
            if (width <= blockWidth && height <= blockHeight)
            {
                return tokenPerBlock;
            }

            // 计算完整的块数（向下取整）
            int blocksHorizontal = Math.Max(1, width / blockWidth);
            int blocksVertical = Math.Max(1, height / blockHeight);
            int totalBlocks = blocksHorizontal * blocksVertical;
            if (totalBlocks > 8)
                totalBlocks = 8;
            // 计算总token数
            int totalTokens = totalBlocks * tokenPerBlock;
            if (modelName.Contains("4o-mini") || modelName.Contains("4.1-nano-openai"))
            {
                totalTokens = totalTokens * 33;
            }

            return totalTokens;
        }

        return 1024;
    }

    public async Task<List<SearchEngineResult>> SerperSearch(string query, string type = "global", int maxResults = 5)
    {
        var systemCfg = _systemService.GetSystemCfgs();
        var apiKey = systemCfg.FirstOrDefault(x => x.CfgKey == "SerperApiKey").CfgValue;
        var baseUrl = "https://google.serper.dev";
        var client = new HttpClient();
        var results = new List<SearchEngineResult>();
        var request = default(HttpRequestMessage);
        try
        {
            switch (type)
            {
                case "global":
                    request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/search");
                    break;
                case "scholar":
                    return await SearchArxivAsync(query);
                case "news":
                    request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/news");
                    break;
                case "image":
                    request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/images");
                    break;
                case "shopping":
                    request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/shopping");
                    break;
            }

            request.Headers.Add("X-API-KEY", apiKey);
            var content = new StringContent(
                JsonSerializer.Serialize(new { q = query }),
                Encoding.UTF8,
                "application/json");
            request.Content = content;

            var response = await client.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var jsonResponse = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

            if (type == "image")
            {
                // 处理图片搜索结果
                var images = jsonResponse.RootElement.GetProperty("images");
                foreach (var image in images.EnumerateArray())
                {
                    results.Add(new SearchEngineResult
                    {
                        Title = image.GetProperty("title").GetString(),
                        Url = image.GetProperty("imageUrl").GetString()
                    });
                }
            }
            else
            {
                // 处理普通搜索结果
                var key = "organic";
                switch (type)
                {
                    case "global":
                        key = "organic";
                        break;
                    case "news":
                        key = "news";
                        break;
                    case "shopping":
                        key = "shopping";
                        break;
                }

                var organic = jsonResponse.RootElement.GetProperty(key);
                foreach (var item in organic.EnumerateArray())
                {
                    results.Add(new SearchEngineResult
                    {
                        Title = item.GetProperty("title").GetString(),
                        Url = item.GetProperty("link").GetString(),
                        Snippet = key == "shopping"
                            ? item.GetProperty("price").GetString()
                            : item.GetProperty("snippet").GetString()
                    });
                }
            }
        }
        catch (Exception ex)
        {
        }

        return results;
    }

    public async Task<string> CreateSearchKeyWordByHistory(string question, List<Message> messages,
        List<VisionChatMessage> visionChatMesssages,
        string model)
    {
        string historyChat = messages != null
            ? JsonConvert.SerializeObject(messages)
            : JsonConvert.SerializeObject(visionChatMesssages);

        string prompt = @$"
                    # Role: Expert in generating keywords for search engines
                    # Scenario: Generate keywords suitable for search engines based on user conversation records, understand the query requirements in the context of the problem
                    # Limitation: Only return keywords, without any punctuation or spaces, no explanations or extra words needed
                    # Important1: Keywords should be concise and to the point, not overly lengthy.
                    # Important2: Just give me the keywords. No need for extra chatter.
                    # Language: Follow the conversation record
                    # User's new reply: {question}
                    # Conversation Record Json: {historyChat}";

        AiChat aiChat = CreateAiChat(model, prompt, false, false, false, "");
        APISetting apiSetting = CreateAPISetting(model);

        string result = string.Empty;
        int retryCount = 0;
        const int maxRetries = 3;

        while (retryCount < maxRetries)
        {
            try
            {
                result = await CallingAINotStream(aiChat, apiSetting);
                if (!string.IsNullOrEmpty(result))
                {
                    return result; // Return if result is not empty
                }
            }
            catch (Exception e)
            {
                await _systemService.WriteLog($"Error while calling AI: {e.Message}", Dtos.LogLevel.Error, "system");
                throw; // Optionally rethrow the exception if you want to handle it outside
            }

            retryCount++;
        }

        return result; // Return the empty result if all retries failed
    }

    public async Task<List<SearchEngineResult>> SearchArxivAsync(string query, int maxResults = 20)
    {
        var results = new List<SearchEngineResult>();
        try
        {
            var arxivUrl =
                $"http://export.arxiv.org/api/query?search_query=all:{Uri.EscapeDataString(query)}&start=0&max_results={maxResults}";
            var request = new HttpRequestMessage(HttpMethod.Get, arxivUrl);
            var client = new HttpClient();
            var arxivResponse = await client.SendAsync(request);
            arxivResponse.EnsureSuccessStatusCode();

            var xmlContent = await arxivResponse.Content.ReadAsStringAsync();
            var xmlDoc = new XmlDocument();
            xmlDoc.LoadXml(xmlContent);

            var nsMgr = new XmlNamespaceManager(xmlDoc.NameTable);
            nsMgr.AddNamespace("arxiv", "http://www.w3.org/2005/Atom");

            var entries = xmlDoc.SelectNodes("//arxiv:entry", nsMgr);

            if (entries != null)
            {
                foreach (XmlNode entry in entries)
                {
                    var title = entry.SelectSingleNode("arxiv:title", nsMgr)?.InnerText.Trim();
                    var summary = entry.SelectSingleNode("arxiv:summary", nsMgr)?.InnerText.Trim();
                    var pdfUrl = entry.SelectSingleNode("arxiv:id", nsMgr)?.InnerText.Trim();

                    if (!string.IsNullOrEmpty(pdfUrl))
                    {
                        // 将arXiv ID转换为PDF链接
                        pdfUrl = pdfUrl.Replace("abs", "pdf");
                        if (!pdfUrl.EndsWith(".pdf"))
                        {
                            pdfUrl += ".pdf";
                        }
                    }

                    results.Add(new SearchEngineResult
                    {
                        Title = title,
                        Url = pdfUrl,
                        Snippet = summary
                    });
                }
            }
        }
        catch (Exception ex)
        {
            // 适当的错误处理
            throw new Exception($"Arxiv search failed: {ex.Message}", ex);
        }

        return results;
    }

    public async Task<string> PromptFromFiles(List<string> paths, string account)
    {
        var prompt = new StringBuilder();
        if (paths?.Count > 0)
        {
            foreach (var path in paths)
            {
                var processedPath = path.Contains("wwwroot") ? path : $"wwwroot{path}";
                var fileName = System.IO.Path.GetFileName(processedPath);
                string fileText = string.Empty;

                // 先查询FilesLib表，看是否有已处理的文件
                var filesLib = await _context.FilesLibs
                    .FirstOrDefaultAsync(f => f.FilePath == path && f.Account == account);

                if (filesLib != null && !string.IsNullOrEmpty(filesLib.ObjectPath))
                {
                    // 检查ObjectPath是否为COS直链
                    if (filesLib.ObjectPath.StartsWith("http"))
                    {
                        // 从COS直链下载内容
                        try
                        {
                            using (var httpClient = new HttpClient())
                            {
                                fileText = await httpClient.GetStringAsync(filesLib.ObjectPath);
                            }
                        }
                        catch (Exception ex)
                        {
                            await _systemService.WriteLog($"从COS下载解析文件失败: {ex.Message}", LogLevel.Error, account);
                            // 如果下载失败，重新解析原文件
                            fileText = await _systemService.GetFileText(processedPath);
                            if (!string.IsNullOrEmpty(fileText))
                            {
                                var txtUrl = await SaveFileContentAsTxt(fileText, fileName, account);
                                filesLib.ObjectPath = txtUrl;
                                _context.FilesLibs.Update(filesLib);
                                await _context.SaveChangesAsync();
                            }
                        }
                    }
                    else
                    {
                        // 旧格式：本地路径，尝试读取本地文件
                        var objectPath = filesLib.ObjectPath.Contains("wwwroot")
                            ? filesLib.ObjectPath
                            : $"wwwroot/{filesLib.ObjectPath}";
                        if (File.Exists(objectPath))
                        {
                            fileText = await File.ReadAllTextAsync(objectPath);
                        }
                        else
                        {
                            // ObjectPath文件不存在，重新解析原文件
                            fileText = await _systemService.GetFileText(processedPath);
                            if (!string.IsNullOrEmpty(fileText))
                            {
                                // 保存解析后的内容并上传到COS
                                var txtUrl = await SaveFileContentAsTxt(fileText, fileName, account);
                                filesLib.ObjectPath = txtUrl;
                                _context.FilesLibs.Update(filesLib);
                                await _context.SaveChangesAsync();
                            }
                        }
                    }
                }
                else
                {
                    // 没有记录或没有ObjectPath，解析原文件
                    fileText = await _systemService.GetFileText(processedPath);
                    if (!string.IsNullOrEmpty(fileText))
                    {
                        // 保存解析后的内容并上传到COS
                        var txtUrl = await SaveFileContentAsTxt(fileText, fileName, account);

                        if (filesLib != null)
                        {
                            // 更新现有记录
                            filesLib.ObjectPath = txtUrl;
                            _context.FilesLibs.Update(filesLib);
                        }
                        else
                        {
                            // 创建新记录
                            var newFilesLib = new FilesLib
                            {
                                FileCode = Guid.NewGuid().ToString(),
                                Account = account,
                                FileName = fileName,
                                FilePath = path,
                                FileType = Path.GetExtension(fileName),
                                ObjectPath = txtUrl,
                                CreateTime = DateTime.Now
                            };
                            _context.FilesLibs.Add(newFilesLib);
                        }

                        await _context.SaveChangesAsync();
                    }
                }

                if (!string.IsNullOrEmpty(fileText))
                    prompt.AppendLine($"## 文件 ```{fileName}```：{fileText}\n");
            }

            return prompt.ToString();
        }

        return string.Empty;
    }

    private async Task<string> SaveFileContentAsTxt(string content, string originalFileName, string account)
    {
        try
        {
            // 检查是否启用COS
            var systemCfg = _systemService.GetSystemCfgs();
            var cos_switch = systemCfg.FirstOrDefault(x => x.CfgKey == "COS_Switch");
            var useCOS = cos_switch != null && cos_switch.CfgValue == "1";

            var currentDate = DateTime.Now.ToString("yyyyMMdd");
            var fileNameWithoutExt = Path.GetFileNameWithoutExtension(originalFileName);
            var newFileName = $"{fileNameWithoutExt}_{Guid.NewGuid().ToString("N")[..8]}.txt";

            if (useCOS)
            {
                // 使用COS存储
                var tempPath = Path.Combine(Path.GetTempPath(), newFileName);

                // 先保存到临时文件
                await File.WriteAllTextAsync(tempPath, content, Encoding.UTF8);

                // 上传到COS
                var cosKey = $"files/parsed/{currentDate}/{newFileName}";
                var cosUrl = _cosservice.PutObject(cosKey, tempPath, newFileName);

                if (!string.IsNullOrEmpty(cosUrl))
                {
                    // 上传成功，删除临时文件
                    if (File.Exists(tempPath))
                    {
                        File.Delete(tempPath);
                    }

                    return cosUrl; // 返回COS直链
                }
                else
                {
                    // COS上传失败，回退到本地存储
                    await _systemService.WriteLog($"COS上传失败，回退到本地存储: {originalFileName}", Dtos.LogLevel.Warn, account);

                    // 删除临时文件
                    if (File.Exists(tempPath))
                    {
                        File.Delete(tempPath);
                    }

                    // 使用本地存储逻辑
                    var savePath = Path.Combine("wwwroot", "files", "parsed", currentDate);
                    if (!Directory.Exists(savePath))
                    {
                        Directory.CreateDirectory(savePath);
                    }

                    var fullPath = Path.Combine(savePath, newFileName);
                    await File.WriteAllTextAsync(fullPath, content, Encoding.UTF8);
                    return Path.Combine("files", "parsed", currentDate, newFileName).Replace("\\", "/");
                }
            }
            else
            {
                // 使用本地存储
                var savePath = Path.Combine("wwwroot", "files", "parsed", currentDate);
                if (!Directory.Exists(savePath))
                {
                    Directory.CreateDirectory(savePath);
                }

                var fullPath = Path.Combine(savePath, newFileName);
                await File.WriteAllTextAsync(fullPath, content, Encoding.UTF8);
                return Path.Combine("files", "parsed", currentDate, newFileName).Replace("\\", "/");
            }
        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"保存解析文件失败: {ex.Message}", LogLevel.Error, account);
            return string.Empty;
        }
    }

    public async Task<List<string>> ReadingFiles(string content, string prompt, string chatId, string account,
        string senMethod,
        int cutSize = 2000, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        List<string> result = new List<string>();
        ChatRes chatRes = new ChatRes();
        chatRes.isterminal = true;
        var systemCfg = _systemService.GetSystemCfgs();
        var chunkLength = int.Parse(systemCfg.Find(x => x.CfgKey == "ReadingModelChunkLength").CfgValue);
        var readingModelMaxChunk = int.Parse(systemCfg.Find(x => x.CfgKey == "ReadingModelMaxChunk").CfgValue);
        var aiCodeCheckBaseUrl = systemCfg.FirstOrDefault(x => x.CfgKey == "AICodeCheckBaseUrl");
        var aiCodeCheckApiKey = systemCfg.FirstOrDefault(x => x.CfgKey == "AICodeCheckApiKey");
        var aiCodeCheckModel = systemCfg.FirstOrDefault(x => x.CfgKey == "AICodeCheckModel");
        var tikToken = TikToken.GetEncoding("o200k_base");
        APISetting apiSetting = new APISetting
        {
            BaseUrl = aiCodeCheckBaseUrl.CfgValue,
            ApiKey = aiCodeCheckApiKey.CfgValue
        };
        List<string> fileChunks = new List<string>();
        if (content.Length <= chunkLength)
        {
            fileChunks.Add(content);
        }
        else
        {
            for (int i = 0; i < content.Length; i += chunkLength)
            {
                // 如果剩余的长度小于 chunkLength 就取剩余的部分
                var chunk = content.Substring(i, Math.Min(chunkLength, content.Length - i));
                fileChunks.Add(chunk);
            }
        }

        chatRes.message = "🟦 准备切片阅读...";
        await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
        foreach (var fileStr in fileChunks)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var segment = await TokenizeJinaAI(fileStr, cutSize);
            chatRes.message = $"🟩 切片完成,总切片数：{segment.Chunks.Count}";
            if (segment.Chunks.Count > readingModelMaxChunk)
            {
                segment.Chunks = MergeChunks(segment.Chunks, readingModelMaxChunk);
                chatRes.message += $"🟨 切片数量超过限制，已自动合并为 {segment.Chunks.Count} 个切片";
            }

            await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
            for (int i = 0; i < segment.Chunks.Count; i++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                //使用AI判断当前分片是否对用户提问有用
                string jsonschema = @"{
                                          ""type"": ""object"",
                                          ""properties"": {
                                            ""result"": {
                                              ""type"": ""boolean"",
                                              ""description"": ""判断结果，文件片段对提问是否有效""
                                            },
                                            ""isfinish"": {
                                              ""type"": ""boolean"",
                                              ""description"": ""阅读结束""
                                            }
                                          },
                                          ""required"": [
                                            ""result"",
                                            ""isfinish""
                                          ],
                                          ""additionalProperties"": false
                                    }";
                string question =
                    $"# 你是一个文件分析专家，可以根据文件片段以判断该分片对用户的提问是否有效，如果有效`result`返回`true`无效返回`false`，应该使用冗余设计，可能有效的也应该返回`true`\n" +
                    $"**注意事项1:** 当用户有文件总结的需求时，大部分片段都应该是有效的\n" +
                    $"**注意事项2:** 如果是信息查询的场景，当你找到后，请将`isfinish`设置为`true`，以结束阅读，否则设置为`false`，切记不要轻易结束阅读，应该多阅读一些内容以获得详细信息\n" +
                    $"**注意事项3:** 由于分片可能导致信息被截断，所以阅读时请结合已确认**有效**的文本分片来确定当前分片是否与用户提问相关，当前分片有可能可以与当前有效的分片拼接使用\n" +
                    $"* 用户提问:{prompt}\n" +
                    $"* 当前待分析的文本片段:\n" +
                    $"```text\n" +
                    $"{segment.Chunks[i]}\n" +
                    $"```" +
                    $"* 已确认有效的文本分片\n" +
                    $"{UseChunkMerge(result)}";
                AiChat aiChat =
                    CreateAiChat(aiCodeCheckModel.CfgValue, question, false, false, true, jsonschema);
                string res = await CallingAINotStream(aiChat, apiSetting);
                await CreateUseLogAndUpadteMoney(account, aiCodeCheckModel.CfgValue,
                    tikToken.Encode(question).Count, tikToken.Encode(res).Count);
                cancellationToken.ThrowIfCancellationRequested();
                JObject json = JObject.Parse(res);
                bool judgmentResult = json["result"].Value<bool>();
                bool judgmentIsFinish = json["isfinish"].Value<bool>();
                if (judgmentResult)
                {
                    result.Add(segment.Chunks[i]);
                    chatRes.message = $"✅ 第{i + 1}片：内容有效:\n {segment.Chunks[i]}";
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                }
                else
                {
                    chatRes.message = $"❌ 第{i + 1}片：内容无效";
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                }

                if (judgmentIsFinish)
                {
                    break;
                }
            }
        }

        return result;
    }

    private List<string> MergeChunks(List<string> originalChunks, int maxChunkCount)
    {
        if (originalChunks.Count <= maxChunkCount)
        {
            return originalChunks;
        }

        List<string> mergedChunks = new List<string>();
        int chunkSize = (int)Math.Ceiling((double)originalChunks.Count / maxChunkCount);

        for (int i = 0; i < originalChunks.Count; i += chunkSize)
        {
            string mergedChunk = string.Join(" ", originalChunks.Skip(i).Take(chunkSize));
            mergedChunks.Add(mergedChunk);
        }

        return mergedChunks;
    }

    private string UseChunkMerge(List<string> chunks)
    {
        string result = string.Empty;
        for (int i = 0; i < chunks.Count; i++)
        {
            result += $"* 分片{i + 1}:\n" +
                      $"```text\n" +
                      $"{chunks[i]}\n" +
                      $"```\n";
        }

        return result;
    }

    public async Task<string> CreateSearchPrompt(string promptHeadle, List<Message> messages,
        List<VisionChatMessage> visionChatMesssages,
        string model, bool multimodal, string chatId, string senMethod)
    {
        if (string.IsNullOrEmpty(model))
        {
            var firstModel = _systemService.GetAImodel().FirstOrDefault();
            model = firstModel?.ModelName;
        }

        bool saySomething = false;
        ChatRes chatRes = new ChatRes();
        if (!string.IsNullOrEmpty(chatId) && !string.IsNullOrEmpty(senMethod))
        {
            chatRes.chatid = chatId;
            saySomething = true;
        }

        string searchKeyWord =
            await CreateSearchKeyWordByHistory(promptHeadle, messages, visionChatMesssages, model);
        //去除标点和空格
        searchKeyWord = !string.IsNullOrEmpty(searchKeyWord)
            ? Regex.Replace(searchKeyWord, @"[^\w\s]", "")
            : promptHeadle;
        var webSearchRes = new List<SearchEngineResult>();
        var webSearchVideoRes = new List<SearchEngineVideoResults>();
        var webSearchhImageRes = new List<SearchEngineImageResults>();
        if (saySomething)
        {
            chatRes.message = $"🤔 我想搜索关键词应该是：**{searchKeyWord}**，让我开始检索 \n";
            await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
            chatRes.message = "";
        }

        webSearchRes = await YahooSearch(searchKeyWord);
        if (multimodal)
        {
            if (saySomething)
            {
                chatRes.message = $"\ud83e\uddd1\u200d\ud83d\udcbb 接下来让我查询是否有相关视频资料佐证 \n";
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                chatRes.message = "";
            }

            webSearchVideoRes = await YahooSearchVideo(searchKeyWord);
            if (saySomething)
            {
                chatRes.message = $"\ud83d\udc69\u200d\ud83d\udcbb 还有图片部分我邀请助理来一起查询 \n";
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                chatRes.message = "";
            }

            webSearchhImageRes = await YahooSearchImages(searchKeyWord);
        }

        if (webSearchRes.Count == 0)
            webSearchRes = await SerperSearch(searchKeyWord);
        if (webSearchRes != null)
        {
            promptHeadle +=
                @$"\n\n # You can refer to the following search engine results. In your response, please include the full link with the entire URL as a citation anywhere in the content.：
                   \n\n {JsonConvert.SerializeObject(webSearchRes)}";
            if (multimodal)
            {
                promptHeadle +=
                    @$"\n\n # Additionally, users have search requirements for videos and images. I will also provide you with relevant video and image materials. Please summarize and present them to the users in a table format, ensuring completeness.：
                       \n\n # Important: Please use markdown syntax to display image elements.
                       \n\n # Videos：{JsonConvert.SerializeObject(webSearchVideoRes)}
                       \n\n # Images：{JsonConvert.SerializeObject(webSearchhImageRes)}";
            }
        }

        return promptHeadle;
    }

    public async Task<List<ModelTokenUsage>> GetTokenUsage(string filterType)
    {
        DateTime startDate = DetermineStartDate(filterType);

        var query = _context.AImodels
            .GroupJoin(
                _context.UseUpLogs.Where(x => x.CreateTime >= startDate),
                model => model.ModelName,
                log => log.ModelName,
                (model, logs) => new { Model = model, Logs = logs }
            )
            .SelectMany(
                joinResult => joinResult.Logs.DefaultIfEmpty(),
                (joinResult, log) => new { joinResult.Model, Log = log }
            )
            .GroupBy(
                x => x.Model.ModelName,
                (key, group) => new ModelTokenUsage
                {
                    ModelName = key,
                    // 修复运算符优先级问题：先处理空值再除以1000
                    TokenUsage = Math.Round(
                        (group.Sum(x => x.Log == null ? 0m : x.Log.InputCount + x.Log.OutputCount) ?? 0m) / 1000m,
                        2)
                })
            .Where(x => x.TokenUsage > 0m);

        return await query.ToListAsync();
    }

    public async Task<List<SearchEngineResult>> YahooSearch(string query, int maxResults = 5)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            throw new ArgumentException("Query cannot be null or empty.", nameof(query));
        }

        if (maxResults <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(maxResults), "maxResults must be greater than 0.");
        }

        // Encode the query
        string encodedQuery = HttpUtility.UrlEncode(query);
        List<SearchEngineResult> allResults = new List<SearchEngineResult>();

        // 每页大约有7条结果，计算需要查询的页数
        int resultsPerPage = 7;
        int pagesNeeded = (int)Math.Ceiling((double)maxResults / resultsPerPage);

        using (HttpClientHandler handler = new HttpClientHandler() { AllowAutoRedirect = false })
        using (HttpClient client = new HttpClient(handler))
        {
            // 设置HTTP头
            client.DefaultRequestHeaders.Add("User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
            client.DefaultRequestHeaders.Add("Accept",
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8");
            client.DefaultRequestHeaders.Add("Connection", "keep-alive");
            client.DefaultRequestHeaders.Add("Upgrade-Insecure-Requests", "1");
            client.DefaultRequestHeaders.Add("Sec-Fetch-Dest", "document");
            client.DefaultRequestHeaders.Add("Sec-Fetch-Mode", "navigate");
            client.DefaultRequestHeaders.Add("Sec-Fetch-Site", "none");
            client.DefaultRequestHeaders.Add("Sec-Fetch-User", "?1");
            client.DefaultRequestHeaders.Add("Cache-Control", "no-cache");

            // 循环查询多页数据
            for (int page = 1; page <= pagesNeeded && allResults.Count < maxResults; page++)
            {
                try
                {
                    // 计算b参数，分页公式：b = 1 + (page - 1) * 7
                    int b = 1 + (page - 1) * resultsPerPage;
                    string requestUrl = $"https://sg.search.yahoo.com/search?p={encodedQuery}&ei=UTF-8&b={b}";

                    // 处理可能的重定向并获取最终响应
                    string response = await GetResponseWithRedirectHandling(client, requestUrl);

                    MatchCollection urlMatches = Regex.Matches(response,
                        "<a[^>]*class=\"[^\"]*d-ib fz-20 lh-26[^\"]*\"[^>]*href=\"(https?:\\/\\/[^\\s\"]+)\"[^>]*>",
                        RegexOptions.IgnoreCase);

                    MatchCollection titleMatches = Regex.Matches(response,
                        "<a[^>]*class=\"[^\"]*d-ib fz-20 lh-26[^\"]*\"[^>]*>(?:<span[^>]*>[^<]*</span>)?(.+?)</a>",
                        RegexOptions.IgnoreCase | RegexOptions.Singleline);

                    MatchCollection contentMatches = Regex.Matches(response,
                        "<span class=\"\\s*fc-falcon\\s*\"[^>]*>(.*?)</span>",
                        RegexOptions.IgnoreCase | RegexOptions.Singleline);

                    // 计算当前页要提取的结果数量
                    int remainingResults = maxResults - allResults.Count;
                    int count = Math.Min(remainingResults,
                        Math.Min(titleMatches.Count,
                            Math.Min(contentMatches.Count,
                                urlMatches.Count)));

                    // 如果当前页没有找到任何结果，停止查询
                    if (count == 0)
                        break;

                    for (int i = 0; i < count; i++)
                    {
                        // 标题处理 - 提取文本并清理HTML
                        string rawTitle = titleMatches[i].Groups[1].Value.Trim();
                        string title = Regex.Replace(rawTitle, "<.*?>", ""); // 移除可能存在的HTML标签
                        title = HttpUtility.HtmlDecode(title); // 解码HTML实体

                        // 标题清洗 - 移除面包屑部分，只保留实际的标题部分
                        // 面包屑通常是 "domain.com › path › path 实际标题"
                        if (title.Contains(" › "))
                        {
                            // 找到最后一个 "›" 后的内容
                            int lastArrowIndex = title.LastIndexOf("›");
                            if (lastArrowIndex >= 0 && lastArrowIndex < title.Length - 1)
                            {
                                title = title.Substring(lastArrowIndex + 1).Trim();
                            }
                        }

                        string snippet =
                            Regex.Replace(contentMatches[i].Groups[1].Value, "<.*?>", ""); // Remove HTML tags
                        snippet = HttpUtility.HtmlDecode(snippet); // 解码HTML实体

                        // 清理URL，提取真实链接
                        string rawUrl = urlMatches[i].Groups[1].Value;
                        string cleanUrl = rawUrl;

                        // 从Yahoo重定向URL中提取真实URL
                        if (rawUrl.Contains("/RU=") && rawUrl.Contains("/RK="))
                        {
                            int startIndex = rawUrl.IndexOf("/RU=") + 4;
                            int endIndex = rawUrl.IndexOf("/RK=");
                            if (startIndex > 0 && endIndex > startIndex)
                            {
                                cleanUrl = rawUrl.Substring(startIndex, endIndex - startIndex);
                                cleanUrl = HttpUtility.UrlDecode(cleanUrl);
                            }
                        }

                        allResults.Add(new SearchEngineResult
                        {
                            Title = title,
                            Url = cleanUrl,
                            Snippet = snippet
                        });
                    }

                    // 在页面之间稍作延迟，避免请求过于频繁
                    if (page < pagesNeeded && allResults.Count < maxResults)
                    {
                        await Task.Delay(500); // 延迟500毫秒
                    }
                }
                catch (HttpRequestException)
                {
                    // 如果某一页请求失败，继续尝试下一页
                    continue;
                }
                catch (RegexMatchTimeoutException)
                {
                    // 如果正则匹配超时，继续尝试下一页
                    continue;
                }
                catch (Exception)
                {
                    // 如果出现其他异常，继续尝试下一页
                    continue;
                }
            }

            return allResults;
        }
    }

    private async Task<string> GetResponseWithRedirectHandling(HttpClient client, string requestUrl,
        int maxRedirects = 10)
    {
        string currentUrl = requestUrl;
        int redirectCount = 0;

        while (redirectCount < maxRedirects)
        {
            var response = await client.GetAsync(currentUrl);

            if (response.StatusCode == HttpStatusCode.MovedPermanently ||
                response.StatusCode == HttpStatusCode.Found ||
                response.StatusCode == HttpStatusCode.TemporaryRedirect ||
                response.StatusCode == HttpStatusCode.PermanentRedirect)
            {
                string redirectUrl = response.Headers.Location?.ToString();

                if (string.IsNullOrEmpty(redirectUrl))
                {
                    throw new HttpRequestException("Redirect response missing Location header.");
                }

                // 处理相对URL
                if (!Uri.IsWellFormedUriString(redirectUrl, UriKind.Absolute))
                {
                    redirectUrl = new Uri(new Uri(currentUrl), redirectUrl).ToString();
                }

                currentUrl = redirectUrl;
                redirectCount++;

                // 在重定向之间稍作延迟
                await Task.Delay(200);
            }
            else if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadAsStringAsync();
            }
            else
            {
                throw new HttpRequestException($"HTTP request failed with status code: {response.StatusCode}");
            }
        }

        throw new HttpRequestException($"Maximum number of redirects ({maxRedirects}) exceeded.");
    }

    public async Task<List<SearchEngineVideoResults>> YahooSearchVideo(string query, int maxResults = 5)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            throw new ArgumentException("Query cannot be null or empty.", nameof(query));
        }

        if (maxResults <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(maxResults), "maxResults must be greater than 0.");
        }

        string encodedQuery = HttpUtility.UrlEncode(query);
        string requestUrl = $"https://sg.search.yahoo.com/search/video?p={encodedQuery}&ei=UTF-8";
        int maxRedirects = 10;

        using (HttpClientHandler handler = new HttpClientHandler() { AllowAutoRedirect = false })
        using (HttpClient client = new HttpClient(handler))
        {
            try
            {
                client.DefaultRequestHeaders.Add("User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
                client.DefaultRequestHeaders.Add("Accept",
                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8");
                client.DefaultRequestHeaders.Add("Connection", "keep-alive");
                client.DefaultRequestHeaders.Add("Upgrade-Insecure-Requests", "1");
                client.DefaultRequestHeaders.Add("Sec-Fetch-Dest", "document");
                client.DefaultRequestHeaders.Add("Sec-Fetch-Mode", "navigate");
                client.DefaultRequestHeaders.Add("Sec-Fetch-Site", "none");
                client.DefaultRequestHeaders.Add("Sec-Fetch-User", "?1");
                client.DefaultRequestHeaders.Add("Cache-Control", "no-cache");
                HttpResponseMessage response = await client.GetAsync(requestUrl);
                int redirectCount = 0;

                while ((response.StatusCode == HttpStatusCode.MovedPermanently ||
                        response.StatusCode == HttpStatusCode.Found ||
                        response.StatusCode == HttpStatusCode.TemporaryRedirect ||
                        response.StatusCode == HttpStatusCode.PermanentRedirect) &&
                       redirectCount < maxRedirects)
                {
                    string redirectUrl = response.Headers.Location.ToString();

                    if (!Uri.IsWellFormedUriString(redirectUrl, UriKind.Absolute))
                    {
                        redirectUrl = new Uri(new Uri(requestUrl), redirectUrl).ToString();
                    }

                    requestUrl = redirectUrl;
                    response = await client.GetAsync(redirectUrl);
                    redirectCount++;
                }

                if (redirectCount >= maxRedirects)
                {
                    Console.WriteLine("Maximum number of redirects exceeded.");
                    return new List<SearchEngineVideoResults>();
                }

                response.EnsureSuccessStatusCode();
                string responseBody = await response.Content.ReadAsStringAsync();


                // --- KEY CHANGE: More Specific Regex ---
                // Match <li> elements with class "vr vres", then find <a> tags within them.
                MatchCollection titleMatches = Regex.Matches(responseBody,
                    @"<li[^>]*class=""vr vres""[^>]*>.*?<a[^>]*aria-label=""([^""]*)""[^>]*>",
                    RegexOptions.IgnoreCase | RegexOptions.Singleline);
                MatchCollection urlMatches = Regex.Matches(responseBody,
                    @"<li[^>]*class=""vr vres""[^>]*>.*?<a[^>]*data-rurl=""([^""]*)""[^>]*>",
                    RegexOptions.IgnoreCase | RegexOptions.Singleline);
                MatchCollection imageMatches = Regex.Matches(responseBody,
                    @"<li[^>]*class=""vr vres""[^>]*>.*?<img[^>]*src=""([^""]*)""[^>]*class=""thm""[^>]*>",
                    RegexOptions.IgnoreCase | RegexOptions.Singleline);

                List<SearchEngineVideoResults> results = new List<SearchEngineVideoResults>();
                int count = Math.Min(maxResults,
                    Math.Min(titleMatches.Count, Math.Min(urlMatches.Count, imageMatches.Count)));

                for (int i = 0; i < count; i++)
                {
                    string title = HttpUtility.HtmlDecode(titleMatches[i].Groups[1].Value);
                    title = Regex.Replace(title, @"</?b>", "", RegexOptions.IgnoreCase);
                    string url = HttpUtility.UrlDecode(urlMatches[i].Groups[1].Value);
                    string image = HttpUtility.UrlDecode(imageMatches[i].Groups[1].Value);

                    results.Add(new SearchEngineVideoResults
                    {
                        Title = title,
                        Url = url,
                        Image = image
                    });
                }

                return results;
            }
            catch (HttpRequestException ex)
            {
                Console.WriteLine($"Error during Yahoo search: {ex.Message}");
                return new List<SearchEngineVideoResults>();
            }
            catch (RegexMatchTimeoutException ex)
            {
                Console.WriteLine($"Regex timeout during Yahoo search: {ex.Message}");
                return new List<SearchEngineVideoResults>();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"An unexpected error occurred: {ex.Message}");
                return new List<SearchEngineVideoResults>();
            }
        }
    }

    public async Task<List<SearchEngineImageResults>> YahooSearchImages(string query, int maxResults = 10)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            throw new ArgumentException("Query cannot be null or empty.", nameof(query));
        }

        if (maxResults <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(maxResults), "maxResults must be greater than 0.");
        }

        string encodedQuery = HttpUtility.UrlEncode(query);
        string requestUrl = $"https://sg.search.yahoo.com/search/images?p={encodedQuery}&ei=UTF-8";
        int maxRedirects = 10;

        using (HttpClientHandler handler = new HttpClientHandler() { AllowAutoRedirect = false })
        using (HttpClient client = new HttpClient(handler))
        {
            try
            {
                client.DefaultRequestHeaders.Add("User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
                client.DefaultRequestHeaders.Add("Accept",
                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8");
                client.DefaultRequestHeaders.Add("Connection", "keep-alive");
                client.DefaultRequestHeaders.Add("Upgrade-Insecure-Requests", "1");
                client.DefaultRequestHeaders.Add("Sec-Fetch-Dest", "document");
                client.DefaultRequestHeaders.Add("Sec-Fetch-Mode", "navigate");
                client.DefaultRequestHeaders.Add("Sec-Fetch-Site", "none");
                client.DefaultRequestHeaders.Add("Sec-Fetch-User", "?1");
                client.DefaultRequestHeaders.Add("Cache-Control", "no-cache");
                HttpResponseMessage response = await client.GetAsync(requestUrl);
                int redirectCount = 0;

                while ((response.StatusCode == HttpStatusCode.MovedPermanently ||
                        response.StatusCode == HttpStatusCode.Found ||
                        response.StatusCode == HttpStatusCode.TemporaryRedirect ||
                        response.StatusCode == HttpStatusCode.PermanentRedirect) &&
                       redirectCount < maxRedirects)
                {
                    string redirectUrl = response.Headers.Location.ToString();

                    if (!Uri.IsWellFormedUriString(redirectUrl, UriKind.Absolute))
                    {
                        redirectUrl = new Uri(new Uri(requestUrl), redirectUrl).ToString();
                    }

                    requestUrl = redirectUrl;
                    response = await client.GetAsync(redirectUrl);
                    redirectCount++;
                }

                if (redirectCount >= maxRedirects)
                {
                    Console.WriteLine("Maximum number of redirects exceeded.");
                    return new List<SearchEngineImageResults>();
                }

                response.EnsureSuccessStatusCode();
                string responseBody = await response.Content.ReadAsStringAsync();

                // 更新的正则表达式，匹配图片元素中的data-src属性
                MatchCollection imageMatches = Regex.Matches(responseBody,
                    @"<img\s+(?:.*?\s+)?data-src=['""]([^'""]+)['""](?:.*?\s+)?class=['""]process['""]",
                    RegexOptions.IgnoreCase | RegexOptions.Singleline);

                // 如果以上匹配为空，尝试备选正则表达式
                if (imageMatches.Count == 0)
                {
                    imageMatches = Regex.Matches(responseBody,
                        @"<img\s+(?:.*?\s+)?class=['""]process['""](?:.*?\s+)?data-src=['""]([^'""]+)['""]",
                        RegexOptions.IgnoreCase | RegexOptions.Singleline);
                }

                List<SearchEngineImageResults> results = new List<SearchEngineImageResults>();
                int count = Math.Min(maxResults, imageMatches.Count);

                for (int i = 0; i < count; i++)
                {
                    string imageUrl = HttpUtility.UrlDecode(imageMatches[i].Groups[1].Value);

                    if (!Uri.IsWellFormedUriString(imageUrl, UriKind.Absolute))
                    {
                        imageUrl = new Uri(new Uri(requestUrl), imageUrl).ToString();
                    }

                    results.Add(new SearchEngineImageResults
                    {
                        Url = imageUrl
                    });
                }

                return results;
            }
            catch (HttpRequestException ex)
            {
                Console.WriteLine($"Error during Yahoo search: {ex.Message}");
                return new List<SearchEngineImageResults>();
            }
            catch (RegexMatchTimeoutException ex)
            {
                Console.WriteLine($"Regex timeout during Yahoo search: {ex.Message}");
                return new List<SearchEngineImageResults>();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"An unexpected error occurred: {ex.Message}");
                return new List<SearchEngineImageResults>();
            }
        }
    }


    public async IAsyncEnumerable<AiRes> BeforeThink(AiChat aiChat, APISetting apiSetting, string chatId,
        VisionBody visionBody = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        string systemPrompt = @$"# 角色:生成式人工智能指导专家
                                 # 特点:拟人,可以在指导时加入一些语气助词,例如:嗯!、等一下、哦对!、我想想...、我知道了!、nice!
                                 # 职责:请你根据对话记录,给用户的提问梳理一个思考过程,注意不要回答答案,而是梳理怎么回复以指导生成式人工智能,注意梳理一定要尽可能全面以及联想用户的潜在问题
                                 # 重要1:当 **数据** 中存在对话记录，应该结合 **数据** 一起思考是否存在因果关系
                                 # 重要2:提出假设,证明假设,反复思考最优解,并给出一个思考过程,不要回答问题
                                 # 重要3:你任何时候都不允许直接回答用户的问题和询问用户,而是根据对话记录来思考,并给出一个思考过程,不要回答问题。
                                 ## 示例1:
                                 - 用户:你是谁？
                                 - 你的回答:用户询问你是谁，需要告诉用户，你是一个生成式人工智能助手，同时用户可能还想知道你的型号或制造商以及知识库等信息也请一并回答
                                 # 数据(可能为空):用户对话记录如下:";

        (aiChat, visionBody, systemPrompt) = CreateNewChat(systemPrompt, aiChat, visionBody);
        await foreach (var res in CallingAI(aiChat, apiSetting, chatId, chatId, false, visionBody, null, null,
                           cancellationToken))
        {
            yield return res;
        }
    }

    public async Task<string> BeforeThinkNotStream(AiChat aiChat, APISetting apiSetting, VisionBody visionBody = null,
        bool returnObject = false)
    {
        string systemPrompt = @$"# 角色:生成式人工智能指导专家
                                 # 特点:拟人,可以在指导时加入一些语气助词,例如:嗯!、等一下、哦对!、我想想...、我知道了!、nice!
                                 # 职责:请你根据对话记录,给用户的提问梳理一个思考过程,注意不要回答答案,而是梳理怎么回复以指导生成式人工智能,注意梳理一定要尽可能全面以及联想用户的潜在问题
                                 # 重要1:当 **数据** 中存在对话记录，应该结合 **数据** 一起思考是否存在因果关系
                                 # 重要2:提出假设,证明假设,反复思考最优解,并给出一个思考过程,不要回答问题
                                 # 重要3:你任何时候都不允许直接回答用户的问题和询问用户,而是根据对话记录来思考,并给出一个思考过程,不要回答问题。
                                 ## 示例1:
                                 - 用户:你是谁？
                                 - 你的回答:用户询问你是谁，需要告诉用户，你是一个生成式人工智能助手，同时用户可能还想知道你的型号或制造商以及知识库等信息也请一并回答
                                 # 数据(可能为空):用户对话记录如下:";

        (aiChat, visionBody, systemPrompt) = CreateNewChat(systemPrompt, aiChat, visionBody);
        string result = await CallingAINotStream(aiChat, apiSetting, visionBody, returnObject);
        return result;
    }

    public (bool, bool, bool, APISetting, List<AImodel>, int, string) CreateRequestConditions(
        ChatSettingDto chatSetting,
        ChatDto chatDto, string Account)
    {
        bool useMyKey = false;
        bool isVisionModel = false;
        bool isResponses = false;
        var apiSetting = new APISetting();
        var aImodels = new List<AImodel>();
        var delay = 0;
        var adminPrompt = string.Empty;
        if (chatSetting != null && chatSetting.MyChatModel != null && chatSetting.MyChatModel.Count > 0)
        {
            foreach (var item in chatSetting.MyChatModel)
            {
                var aiModel = new AImodel();
                aiModel.ModelNick = item.ChatNickName;
                aiModel.ModelName = item.ChatModel;
                aiModel.BaseUrl = item.ChatBaseURL;
                aiModel.ApiKey = item.ChatApiKey;
                aiModel.VisionModel = item.VisionModel;
                if (aiModel.VisionModel.HasValue)
                    isVisionModel = aiModel.VisionModel.Value;
                aiModel.Responses = item.Responses;
                if (aiModel.Responses.HasValue)
                    isResponses = aiModel.Responses.Value;
                aImodels.Add(aiModel);
            }

            apiSetting.BaseUrl = aImodels.Where(x => x.ModelName == chatDto.aiModel).FirstOrDefault().BaseUrl;
            apiSetting.ApiKey = aImodels.Where(x => x.ModelName == chatDto.aiModel).FirstOrDefault().ApiKey;
            useMyKey = true;
        }
        else
        {
            //获取模型设置
            aImodels = _systemService.GetAImodel();
            if (aImodels != null)
            {
                var useModel = aImodels.Where(x => x.ModelName == chatDto.aiModel).FirstOrDefault();
                if (useModel != null)
                {
                    apiSetting.BaseUrl = useModel.BaseUrl;
                    apiSetting.ApiKey = useModel.ApiKey;
                    if (useModel.VisionModel.HasValue)
                        isVisionModel = useModel.VisionModel.Value;
                    if (useModel.Delay.HasValue && useModel.Delay.Value >= 0)
                        delay = useModel.Delay.Value;
                    if (!string.IsNullOrEmpty(useModel.AdminPrompt))
                        adminPrompt = useModel.AdminPrompt;
                    if (useModel.Responses.HasValue)
                        isResponses = useModel.Responses.Value;
                }
                else
                {
                    throw new Exception($"系统未配置{chatDto.aiModel}模型，请联系管理员");
                }

                //查询用户模型限制
                var userModelLimit = _context.UsersLimits.AsNoTracking()
                    .Where(l => l.Account == Account && l.Enable.Value)
                    .FirstOrDefault();
                if (userModelLimit != null)
                {
                    var limitModel = userModelLimit.ModelName.Split(',').ToList();
                    if (limitModel.Contains(chatDto.aiModel))
                    {
                        delay = userModelLimit.Limit.Value;
                    }
                }
            }
            else
            {
                throw new Exception("系统未配置任何模型，请联系管理员");
            }
        }

        return (useMyKey, isVisionModel, isResponses, apiSetting, aImodels, delay, adminPrompt);
    }

    public async Task<(string, string, ChatDto, List<VisionImg>)> ScenePreprocessing(ChatDto chatDto,
        bool isVisionModel, string Account,
        string promptHeadle, string senMethod, CancellationToken cancellationToken, HttpRequest request,
        List<SystemCfg> systemCfg)
    {
        string imgTxt = string.Empty;
        string imgRes = string.Empty;
        string input = string.Empty;
        var visionImg = new List<VisionImg>();
        //如果记忆模式
        if (chatDto.useMemory)
        {
            var embeddingModel = systemCfg.FirstOrDefault(x => x.CfgKey == "EmbeddingsModel");
            var memory = await GetMemory(embeddingModel.CfgValue, Account, promptHeadle);
            if (memory != null && memory.Data != null)
            {
                chatDto.system_prompt = "我会使用数据库存储用户需要保留的历史记忆，以下是系统历史记忆,如果用户有需要可以取用：\n";
                foreach (var item in memory.Data) chatDto.system_prompt += $"{item.VectorContent} \n";
            }
        }

        //如果有图片
        if (chatDto.image_path != null && chatDto.image_path.Count > 0)
        {
            var urlPattern = @"^(http|https)://";
            var imageAnalysisResults = new List<string>();
            var imageUrls = new List<string>();

            foreach (var imagePath in chatDto.image_path)
            {
                var isUrl = Regex.IsMatch(imagePath, urlPattern, RegexOptions.IgnoreCase);
                if (!isVisionModel)
                {
                    var imageData = await _systemService.ImgConvertToBase64(imagePath);
                    imgTxt = _baiduService.GetText(imageData);
                    imgRes = _baiduService.GetRes(imageData);
                    imageAnalysisResults.Add($"图像中的文字识别结果为：{imgTxt}, 图像中物体和场景识别结果为：{imgRes}");
                }

                if (chatDto.aiModel.Contains("-all"))
                {
                    var imageUrl = isUrl
                        ? imagePath
                        : $"{request.Scheme}://{request.Host}{imagePath.Replace("wwwroot", "")}"
                            .Replace("\\", "/");
                    imageUrls.Add(imageUrl);
                }
                else
                {
                    var imgBase64 = await _systemService.ImgConvertToBase64(imagePath, true);
                    var visionImgitem = new VisionImg()
                    {
                        url = imgBase64
                    };
                    visionImg.Add(visionImgitem);
                }
            }

            if (!isVisionModel)
            {
                var combinedAnalysis = string.Join("\n", imageAnalysisResults);
                promptHeadle = $"# 请根据以下多张图片的识别结果进行专业的分析回答：{combinedAnalysis}\n\n{promptHeadle}";
            }

            if (chatDto.aiModel.Contains("-all"))
            {
                var combinedUrls = string.Join("\n", imageUrls);
                promptHeadle = $"{chatDto.msg}\n\n图片链接:{combinedUrls}";
            }
        }

        //如果有文件
        if (chatDto.file_list != null && chatDto.file_list.Count > 0)
        {
            var fileContent = await PromptFromFiles(chatDto.file_list, Account);
            if (chatDto.aiModel.Contains("-all"))
            {
                promptHeadle += $"\n # 要求：{promptHeadle} \n\n";
                for (var i = 0; i < chatDto.file_list.Count; i++)
                    promptHeadle +=
                        $"# 文件地址{i + 1}：{request.Scheme}://{request.Host}{chatDto.file_list[i].Replace("wwwroot", "").Replace("\\", "/")} \n\n";
                input += fileContent;
            }
            else
            {
                if (chatDto.readingMode)
                {
                    string fileStr = string.Empty;
                    try
                    {
                        var readingFiles =
                            await ReadingFiles(fileContent, promptHeadle, chatDto.chatid, Account,
                                senMethod, 2000, cancellationToken);
                        promptHeadle += $"\n # 你是一个文件阅读专家 \n" +
                                        $"# 注意事项：\n" +
                                        $"**当涉及到图片内容时,请你以纯文本markdown形式原样输出图片,不要包裹代码块,直接文本形式输出图片的markdown字符串,并且注意图片和文字合理使用换行符换行,每张图独占一行以增加可读性** \n" +
                                        $"* 需要回答的问题如下： \n" +
                                        $"* {promptHeadle} \n" +
                                        $"* 参考的文件内容如下：\n";

                        foreach (var redingStr in readingFiles)
                        {
                            fileStr += redingStr;
                        }
                    }
                    catch (OperationCanceledException)
                    {
                        //await _systemService.WriteLog("阅读取消", Dtos.LogLevel.Info, Account);
                    }

                    promptHeadle += fileStr;
                }
                else
                {
                    promptHeadle += $"\n # 你是一个文件阅读专家 \n" +
                                    $"# 注意事项：\n" +
                                    $"**当涉及到图片内容时,请你以纯文本markdown形式原样输出图片,不要包裹代码块,直接文本形式输出图片的markdown字符串,并且注意图片和文字合理使用换行符换行,每张图独占一行以增加可读性** \n" +
                                    $"* 需要回答的问题如下： \n" +
                                    $"* {promptHeadle} \n" +
                                    $"* 参考的文件内容如下：\n" +
                                    $"{fileContent}";
                }
            }
        }

        //如果是Coder模式
        if (chatDto.coderModel)
        {
            string originalText = !string.IsNullOrEmpty(chatDto.coderMsg)
                ? chatDto.coderMsg
                : "No original text available.";

            chatDto.system_prompt = $@"<Prompt>
                <Role>You are a professional code and text editor expert.</Role>
                <Description>Your primary task is to make precise modifications to the provided text or code according to user requirements.</Description>
                <Instructions>You should respond in the same language that users use in their requests. You can review the images provided by the user according to the requirements of the scenario.</Instructions>

                <WorkRequirements>
                    <Requirement>Must preserve all original content provided by users unless specifically requested to delete</Requirement>
                    <Requirement>Make modifications strictly according to user requirements</Requirement>
                    <Requirement><strong>Display the complete modified content in a single code block. Always ensure there is only ONE code block.</strong></Requirement>
                    <Requirement>For code modifications, maintain proper formatting and indentation</Requirement>
                    <Requirement>Use markdown to clearly highlight the modified parts</Requirement>
                    <Requirement>Provide a brief explanation of the specific changes made after editing without including any code blocks</Requirement>
                </WorkRequirements>

                <Rules>
                    <Rule>Proactively ask for clarification if user requirements are unclear</Rule>
                    <Rule>Actively suggest improvements if potential issues are identified</Rule>
                    <Rule>Ensure modifications don't compromise the integrity and coherence of the original content</Rule>
                    <Rule>Respond in the same language as the user's request (e.g., if user writes in Chinese, respond in Chinese; if in English, respond in English)</Rule>
                    <Rule>Never split code into multiple blocks, always keep it as one complete piece</Rule>
                    <Rule>The entire response should contain only one code block for code; the explanation section should not contain any code blocks</Rule>
                </Rules>

                <Instruction>Please provide the content you want to edit and your specific modification requirements. I will process them according to the above standards.</Instruction>

                <!-- Example: If a user wants to change the output of the following C# code from ""Hello World"" to ""Hello Universe"" -->
                <Example>
                    <UserRequest>
                        <CodeLanguage>C#</CodeLanguage>
                        <OriginalCode>
                            <![CDATA[
                            using System;
                            class Program
                            {{
                                static void Main()
                                {{
                                    Console.WriteLine(""Hello World"");
                                }}
                            }}
                            ]]>
                        </OriginalCode>
                        <ModificationRequirement>Change the output message to 'Hello Universe'</ModificationRequirement>
                    </UserRequest>
                    <SystemResponse>
                     <NaturalLanguage>okay, here is the modified code:</NaturalLanguage>
                        <![CDATA[
                        ```csharp
                        using System;
                        class Program
                        {{
                            static void Main()
                            {{
                                Console.WriteLine(""Hello Universe"");
                            }}
                        }}
                        ```
                        ]]>
                    </SystemResponse>
                    <Explanation>The string inside `Console.WriteLine` was changed from 'Hello World' to 'Hello Universe' as requested.</Explanation>
                </Example>

                <InputContent>
                    <OriginalTextOrCode>[{originalText}]</OriginalTextOrCode>
                </InputContent>
            </Prompt>";
        }

        //如果是Writer模式
        if (chatDto.writerModel)
        {
            var book = _aiBookService.GetBookInfo(Account, chatDto.bookCode);
            var chapter = _aiBookService.GetChapterInfo(Account, chatDto.bookCode, chatDto.chapterId);
            List<string> selectChapters = new List<string>();
            if (chatDto.selectChapters.Count > 0)
            {
                foreach (var item in chatDto.selectChapters)
                {
                    var objchapter = _aiBookService.GetChapterInfo(Account, chatDto.bookCode, item);
                    if (!string.IsNullOrEmpty(objchapter.ChapterBody))
                        selectChapters.Add(objchapter.ChapterBody.Substring(0,
                            Math.Min(objchapter.ChapterBody.Length, 1000)));
                }
            }

            string selectedChapter = string.Empty;
            if (selectChapters.Count > 0)
            {
                foreach (var item in selectChapters)
                {
                    selectedChapter += $"* Select Chapter Content: {item} \n\n";
                }

                selectedChapter = "# Select Chapter: \n\n" + selectedChapter;
            }

            string roleStr = string.IsNullOrEmpty(chatDto.system_prompt)
                ? "You are a professional and highly creative novel writer."
                : chatDto.system_prompt;
            chatDto.system_prompt = $@"
                               # Role Setting: {roleStr}
                               # Task Objective:
                               You will write, continue writing, or provide suggestions for chapters based on the provided novel background information and current chapter information. Your main responsibility is to generate high-quality text that fits the style and setting of the novel.

                               # Important Instructions:
                               1. **Output Format**: All your responses must contain only the novel's main body text, wrapped in a specific Markdown code block. For example:
                                  ```body
                                  This is the content of the novel's main body.
                                  It can be paragraphs, dialogues, scene descriptions, etc.
                                  ```
                                  Only **one** ```body``` code block is allowed in each response.
                               2. **Single Output**: Please output the complete body text at once. Do not reply in parts or complete it gradually.

                               3. **Language**: Your responses should be in the same language as the **Chapter Content**.
                               # Novel Background Information:
                               * **Book Title**: {book.BookName}
                               * **Synopsis**: {book.BookRemark}
                               * **Genre**: {book.BookType}
                               * **Tags**: {book.BookTag}

                               # Current Chapter Information:
                               * **Chapter Title**: {chapter.ChapterTitle}
                               * **Chapter Content**: {chapter.ChapterBody}

                               {selectedChapter}

                               Please create based on your understanding of the existing chapter content, ensuring a natural connection with the previous content. If the current chapter content is empty, please create based on the novel's background information.
                               # Creation Requirements:
                               1. **Consistent Style**: Maintain consistency with the overall style and tone of the novel.
                               2. **Continuity**: Ensure the new content flows smoothly with the existing chapter content.
                               3. **Creativity**: Be creative within the setting of the novel.
                               4. **Detailed Description**: Pay attention to details to make scenes, characters, and emotions more vivid.
                               5. **Logic**: Ensure the story is logically clear and the plot develops reasonably.

                               # Example of an Output:
                               * Okay, I understand the user's request. I'll begin writing the content for you now.
                                 ```body
                                  The content you've written...
                                 ```
                                 Hope you like it.

                               # What do you need to do?
                               Based on the above information, please continue the novel content of the current chapter based on the context provided by the user or make suggestions based on the requirements.
                               # Start your creation!";
        }

        return (promptHeadle, input, chatDto, visionImg);
    }

    public async Task<(string, string, int, List<VisionChatMessage>, List<Message>)> CreateRequestMessages(
        ChatDto chatDto,
        List<VisionImg> visionImg, ChatSettingDto chatSetting, List<SystemCfg> systemCfg, bool isVisionModel,
        bool newChat,
        string Account,
        string chatId,
        string input, string adminPrompt,
        string promptHeadle,
        string senMethod)
    {
        var tmpmsg_v = new List<VisionChatMessage>();
        var messages = new List<Message>();
        var chatRes = new ChatRes();
        int imageToken = 0;
        if (newChat)
        {
            if (!isVisionModel)
            {
                //如果是新对话直接填充用户输入
                var message = new Message();
                if (!string.IsNullOrEmpty(adminPrompt + chatDto.system_prompt))
                {
                    message.Role = "system";
                    message.Content = adminPrompt + "\n\n" + chatDto.system_prompt;
                    messages.Add(message);
                    input += chatDto.system_prompt;
                }

                //如果启用了联网
                if (chatDto.globe)
                {
                    chatRes.message = "🌏我正在联网查询...\n";
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    promptHeadle =
                        await CreateSearchPrompt(promptHeadle, messages, null, "", chatDto.multimodal, chatId,
                            senMethod);
                    chatRes.message = "✅我已经查询完成,请稍候我正在整理信息源...\n";
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                }

                message = new Message();
                message.Role = "user";
                message.Content = promptHeadle;
                messages.Add(message);
            }
            else
            {
                //Vision
                var promptvisionChatMesssage = new VisionChatMessage();
                var promptcontent = new List<VisionContent>();
                var promptvisionContent = new VisionContent();

                // 系统提示部分
                if (!string.IsNullOrEmpty(adminPrompt + chatDto.system_prompt))
                {
                    promptvisionChatMesssage.role = "system";
                    promptvisionContent.text = adminPrompt + "\n\n" + chatDto.system_prompt;
                    promptcontent.Add(promptvisionContent);
                    promptvisionChatMesssage.content = new ContentWrapper
                    {
                        stringContent = promptvisionContent.text
                    };
                    tmpmsg_v.Add(promptvisionChatMesssage);
                    input += chatDto.system_prompt;

                    // 重置为用户消息
                    promptvisionChatMesssage = new VisionChatMessage();
                    promptcontent = new List<VisionContent>();
                    promptvisionContent = new VisionContent();
                }

                //如果启用了联网
                if (chatDto.globe)
                {
                    chatRes.message = "🌏我正在联网查询...\n";
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    promptHeadle =
                        await CreateSearchPrompt(promptHeadle, null, tmpmsg_v, "", chatDto.multimodal, chatId,
                            senMethod);
                    chatRes.message = "✅我已经查询完成,请稍候我正在整理信息源...\n";
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                }

                // 用户消息部分
                promptvisionChatMesssage.role = "user";
                promptvisionContent.text = promptHeadle;
                promptcontent.Add(promptvisionContent);

                // 添加图片，如果存在
                if (visionImg != null && visionImg.Count > 0)
                {
                    foreach (var visionImgitem in visionImg)
                    {
                        promptvisionContent = new VisionContent();
                        promptvisionContent.type = "image_url";
                        promptvisionContent.image_url = visionImgitem;
                        promptcontent.Add(promptvisionContent);
                        imageToken += GetImageTokenCount(visionImgitem.url, chatDto.aiModel);
                    }
                }

                promptvisionChatMesssage.content = new ContentWrapper
                {
                    visionContentList = promptcontent
                };
                tmpmsg_v.Add(promptvisionChatMesssage);
            }
        }
        else
        {
            //否则查询历史记录
            var historyCount = 5; //默认5
            if (chatSetting.SystemSetting.HistoryCount != 5)
                historyCount = chatSetting.SystemSetting.HistoryCount;
            var chatHistories = GetChatHistories(Account, chatId, historyCount,
                (chatDto.coderModel || chatDto.writerModel));
            //开始压缩的对话条数
            var startCompress = systemCfg.Where(x => x.CfgCode == "History_Prompt_Start_Compress").FirstOrDefault();
            if (startCompress == null)
                chatDto.createAiPrompt = false;
            else if (chatHistories.Count < int.Parse(startCompress.CfgValue) * 2) //历史记录长度小于2强制关闭优化
                chatDto.createAiPrompt = false;
            //遍历填充历史记录
            var tempInput = string.Empty;

            // 先添加系统提示词（如果存在）
            if (!string.IsNullOrEmpty(adminPrompt + chatDto.system_prompt))
            {
                if (!isVisionModel)
                {
                    var systemMessage = new Message
                    {
                        Role = "system",
                        Content = adminPrompt + "\n\n" + chatDto.system_prompt
                    };
                    messages.Add(systemMessage);
                }
                else
                {
                    var systemVisionMessage = new VisionChatMessage
                    {
                        role = "system",
                        content = new ContentWrapper
                        {
                            stringContent = adminPrompt + "\n\n" + chatDto.system_prompt
                        }
                    };
                    tmpmsg_v.Add(systemVisionMessage);
                }

                input += chatDto.system_prompt;
            }

            foreach (var item in chatHistories)
            {
                tempInput += item.Chat;
                if (!isVisionModel)
                {
                    var message = new Message
                    {
                        Role = item.Role,
                        Content = item.Chat
                    };
                    messages.Add(message);
                }
                else
                {
                    // Vision
                    var hisvisionChatMesssage = new VisionChatMessage();
                    var hiscontent = new List<VisionContent>();
                    hisvisionChatMesssage.role = item.Role;
                    if (item.Chat.Contains("aee887ee6d5a79fdcmay451ai8042botf1443c04"))
                    {
                        // 分割文本和图片
                        var parts = item.Chat.Split(new[] { "aee887ee6d5a79fdcmay451ai8042botf1443c04" },
                            StringSplitOptions.None);

                        // 提取并填充文本内容
                        if (parts.Length > 0)
                        {
                            var textContent = new VisionContent
                            {
                                type = "text",
                                text = parts[0]
                            };
                            hiscontent.Add(textContent);
                        }

                        // 提取并填充图片内容
                        if (parts.Length > 1)
                        {
                            var urlPattern = @"^(http|https)://";
                            for (int i = 1; i < parts.Length; i++)
                            {
                                const string pattern = @"<img.+?src=[""'](.*?)[""'].*?>";
                                var regex = new Regex(pattern, RegexOptions.IgnoreCase);

                                var matches = regex.Matches(parts[i]);

                                foreach (Match match in matches)
                                {
                                    var imageData = string.Empty;
                                    // 检查输入字符串是否匹配正则表达式
                                    var isUrl = Regex.IsMatch(match.Groups[1].Value, urlPattern,
                                        RegexOptions.IgnoreCase);
                                    if (isUrl)
                                        imageData = match.Groups[1].Value;
                                    else
                                        imageData = "wwwroot" + match.Groups[1].Value;
                                    var imgContent = new VisionContent()
                                    {
                                        type = "image_url",
                                        image_url = new VisionImg
                                            { url = await _systemService.ImgConvertToBase64(imageData, true) }
                                    };
                                    imageToken += GetImageTokenCount(imgContent.image_url.url,
                                        chatDto.aiModel);
                                    hiscontent.Add(imgContent);
                                }
                            }
                        }

                        hisvisionChatMesssage.content = new ContentWrapper
                        {
                            visionContentList = hiscontent
                        };
                    }
                    else
                    {
                        if (item.Role == "user")
                        {
                            var hisvisionContent = new VisionContent { text = item.Chat };
                            hiscontent.Add(hisvisionContent);
                            hisvisionChatMesssage.content = new ContentWrapper
                            {
                                visionContentList = hiscontent
                            };
                        }
                        else
                        {
                            hisvisionChatMesssage.content = new ContentWrapper
                            {
                                stringContent = item.Chat
                            };
                        }
                    }

                    tmpmsg_v.Add(hisvisionChatMesssage);
                }
            }

            if (!isVisionModel)
            {
                if (chatDto.createAiPrompt)
                {
                    var message0 = new Message();
                    message0.Role = "user";
                    chatRes.message = "正在压缩历史记录📦...\n";
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    message0.Content = await CreateHistoryPrompt(messages);
                    chatRes.message = "压缩完成✅ \n等待AI回复⏳ \n\n\n";
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    if (!string.IsNullOrEmpty(message0.Content))
                    {
                        messages = new List<Message> { message0 };
                        input += message0.Content;
                    }
                    else
                    {
                        input += tempInput;
                        chatRes.message = "压缩失败❌ \n重新启用历史记录,等待AI回复⏳ \n\n\n";
                        await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    }
                }
                else
                {
                    input += tempInput;
                }

                //如果启用了联网
                if (chatDto.globe)
                {
                    chatRes.message = "🌏我正在联网查询...\n";
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    promptHeadle =
                        await CreateSearchPrompt(promptHeadle, messages, null, "", chatDto.multimodal, chatId,
                            senMethod);
                    chatRes.message = "✅我已经查询完成,请稍候我正在整理信息源...\n";
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                }

                //填充用户输入
                var message1 = new Message();
                message1.Role = "user";
                message1.Content = promptHeadle;
                messages.Add(message1);
            }
            else
            {
                if (chatDto.createAiPrompt)
                {
                    var promptvisionChatMesssage0 = new VisionChatMessage();
                    var promptcontent0 = new List<VisionContent>();
                    var promptvisionContent0 = new VisionContent();
                    chatRes.message = "正在压缩历史记录📦... \n";
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    string goodPR = await CreateHistoryPrompt(null, tmpmsg_v);
                    promptvisionContent0.text = goodPR;
                    promptcontent0.Add(promptvisionContent0);

                    promptvisionChatMesssage0.role = "user";
                    promptvisionChatMesssage0.content = new ContentWrapper
                    {
                        visionContentList = promptcontent0
                    };
                    if (!string.IsNullOrEmpty(goodPR))
                    {
                        tmpmsg_v = new List<VisionChatMessage> { promptvisionChatMesssage0 };
                        input += goodPR;
                        chatRes.message = "压缩完成✅ \n等待AI回复⏳ \n\n\n";
                        await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    }
                    else
                    {
                        input += tempInput;
                        chatRes.message = "压缩失败❌ \n重新启用历史记录,等待AI回复⏳ \n\n\n";
                        await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    }
                }
                else
                {
                    input += tempInput;
                }

                //如果启用了联网
                if (chatDto.globe)
                {
                    chatRes.message = "🌏我正在联网查询...\n";
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    promptHeadle =
                        await CreateSearchPrompt(promptHeadle, null, tmpmsg_v, "", chatDto.multimodal, chatId,
                            senMethod);
                    chatRes.message = "✅我已经查询完成,请稍候我正在整理信息源...\n";
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                }

                //Vision
                var promptvisionChatMesssage = new VisionChatMessage();
                var promptcontent = new List<VisionContent>();
                var promptvisionContent = new VisionContent();
                promptvisionContent.text = promptHeadle;
                promptcontent.Add(promptvisionContent);
                if (visionImg != null && visionImg.Count > 0)
                {
                    foreach (var visionImgitem in visionImg)
                    {
                        promptvisionContent = new VisionContent();
                        promptvisionContent.type = "image_url";
                        promptvisionContent.image_url = visionImgitem;
                        promptcontent.Add(promptvisionContent);
                    }
                }

                promptvisionChatMesssage.role = "user";
                promptvisionChatMesssage.content = new ContentWrapper
                {
                    visionContentList = promptcontent
                };
                tmpmsg_v.Add(promptvisionChatMesssage);
            }
        }

        return (input, promptHeadle, imageToken, tmpmsg_v, messages);
    }

    //------------------------------------通用私有函数---------------------------------

    private async Task<(string CosKey, string CosUrl)> DownloadAndUploadToCOS(string url, string baseSavePath,
        string fileType, string newFileName, string account, ICOSService cosService, ISystemService systemService)
    {
        if (string.IsNullOrEmpty(url))
            return (null, null);

        var fileExtension = Path.GetExtension(url);
        var fileName = $"{newFileName}{fileExtension}";
        var localFilePath = Path.Combine(baseSavePath, fileType);

        // 下载文件
        var filePath = await systemService.DownloadFileByUrl(url, localFilePath, account);

        // 上传到COS
        var cosKey = $"sunores/{DateTime.Now:yyyyMMdd}/{fileType}/{fileName}";
        var cosUrl = cosService.PutObject(cosKey, filePath, fileName);

        return (cosKey, cosUrl);
    }

    private async Task<string> DownloadToLocal(string url, string baseSavePath, string fileType, string newFileName,
        string account, ISystemService systemService)
    {
        if (string.IsNullOrEmpty(url))
            return null;

        var fileExtension = Path.GetExtension(url);
        var fileName = $"{newFileName}{fileExtension}";
        var localFilePath = Path.Combine(baseSavePath, fileType);

        // 下载文件
        await systemService.DownloadFileByUrl(url, localFilePath, account);

        // 返回相对路径
        return Path.Combine("files", "sunores", DateTime.Now.ToString("yyyyMMdd"), fileType, fileName);
    }

    private async Task<bool> IsVip(string account)
    {
        //查询用户是否是VIP
        var vip = await _context.VIPs.Where(x => x.Account == account).ToListAsync();
        //遍历VIP列表，如果有一个VIP未过期，则返回true
        if (vip.Count == 0) return false;
        foreach (var item in vip)
            if (item.EndTime > DateTime.Now)
                return true;
        return false;
    }

    private async Task<List<ModelPrice>> GetModelPriceList()
    {
        //尝试从缓存中获取模型定价列表
        List<ModelPrice> modelPriceList = null;
        var modelPriceList_str = await _redis.GetAsync("ModelPriceList");
        if (modelPriceList == null)
        {
            //如果缓存中没有模型定价列表，则从数据库中获取
            modelPriceList = await _context.ModelPrices.AsNoTracking().ToListAsync();
            //将模型定价列表存入缓存
            await _redis.SetAsync("ModelPriceList", JsonConvert.SerializeObject(modelPriceList));
        }
        else
        {
            modelPriceList = JsonConvert.DeserializeObject<List<ModelPrice>>(modelPriceList_str);
        }

        return modelPriceList;
    }

    private async Task<bool> CreateUseLogAndUpadteMoney(string account, string modelName, int inputCount,
        int outputCount, bool isdraw = false)
    {
        var user = _context.Users.Where(x => x.Account == account).FirstOrDefault();
        if (user == null) return false;
        decimal? realOutputMoney = 0m;
        //尝试从缓存中获取模型定价列表
        var modelPriceList = await GetModelPriceList();
        //根据模型名称获取模型定价
        var modelPrice = modelPriceList.Where(x => x.ModelName == modelName).FirstOrDefault();
        if (modelPrice != null) //如果不存在就是不扣费
        {
            //查询用户是否是VIP
            var vip = await IsVip(account);
            if (vip)
            {
                //如果是VIP，使用VIP价格
                modelPrice.ModelPriceInput = modelPrice.VipModelPriceInput;
                modelPrice.ModelPriceOutput = modelPrice.VipModelPriceOutput;
                modelPrice.Rebate = modelPrice.VipRebate;
            }

            //如果是绘画
            if (isdraw)
            {
                realOutputMoney = modelPrice.ModelPriceOutput * modelPrice.Rebate;
            }
            else
            {
                //更新用户余额,字数要除以1000
                var inputMoney = modelPrice.ModelPriceInput * inputCount / 1000;
                var outputMoney = modelPrice.ModelPriceOutput * outputCount / 1000;
                //根据折扣计算实际扣费
                var rebate = modelPrice.Rebate;
                realOutputMoney = (inputMoney + outputMoney) * rebate;
            }

            //扣除用户余额
            user.Mcoin -= realOutputMoney;
            if (user.Mcoin < 0) user.Mcoin = 0;
            //标记实体状态为已修改
            _context.Entry(user).State = EntityState.Modified;
        }

        var log = new UseUpLog
        {
            Account = account,
            InputCount = inputCount,
            OutputCount = outputCount,
            UseMoney = realOutputMoney,
            CreateTime = DateTime.Now,
            ModelName = modelName
        };
        _context.UseUpLogs.Add(log);
        //保存变更到数据库
        return await _context.SaveChangesAsync() > 0;
    }

    private static Image<Rgba32> LoadImage(string path)
    {
        if (IsBase64String(path))
        {
            // Remove the data URI scheme part if present
            string base64Data = path.Contains("base64,")
                ? path.Substring(path.IndexOf("base64,") + 7) // Remove "data:image/png;base64,"
                : path;

            byte[] imageBytes = Convert.FromBase64String(base64Data);
            using (var ms = new MemoryStream(imageBytes))
            {
                return Image.Load<Rgba32>(ms);
            }
        }
        else if (IsUrl(path))
        {
            using (WebClient wc = new WebClient())
            {
                byte[] imageData = wc.DownloadData(path);
                using (var ms = new MemoryStream(imageData))
                {
                    return Image.Load<Rgba32>(ms);
                }
            }
        }
        else if (File.Exists(path))
        {
            return Image.Load<Rgba32>(path);
        }
        else
        {
            throw new ArgumentException("Invalid image path provided.");
        }
    }

    private static bool IsBase64String(string s)
    {
        // Check if the string is a Base64 Data URI
        if (s.StartsWith("data:image", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        // Regular Base64 string validation, assuming it's a standard Base64 string
        s = s.Trim();
        return (s.Length % 4 == 0) && Convert.TryFromBase64String(s, new Span<byte>(new byte[s.Length]), out _);
    }

    private static bool IsUrl(string path)
    {
        return Uri.TryCreate(path, UriKind.Absolute, out Uri uriResult)
               && (uriResult.Scheme == Uri.UriSchemeHttp || uriResult.Scheme == Uri.UriSchemeHttps);
    }

    private DateTime DetermineStartDate(string filterType)
    {
        DateTime now = DateTime.Now;
        return filterType switch
        {
            "year" => new DateTime(now.Year, 1, 1),
            "month" => new DateTime(now.Year, now.Month, 1),
            "week" => now.Date.AddDays(-(int)now.DayOfWeek),
            _ => new DateTime(2022, 1, 1)
        };
    }

    private (AiChat aichat, VisionBody visionbody, string systemprompt) CreateNewChat(string systemPrompt,
        AiChat aiChat,
        VisionBody visionBody = null)
    {
        if (visionBody != null)
        {
            var visionChat = visionBody.messages.ToList();
            //移除最后一个用户的提问
            var userQuestion = visionBody.messages.LastOrDefault();
            visionChat.RemoveAt(visionChat.Count - 1);
            if (visionChat.Count == 0)
            {
                systemPrompt += "暂无对话记录，请直接根据用户提问来思考";
            }

            foreach (var message in visionChat)
            {
                if (message.role == "user")
                {
                    systemPrompt +=
                        $"\n用户: {message.content.visionContentList.FirstOrDefault(c => c.type == "text")?.text}";
                }
                else if (message.role == "assistant")
                {
                    systemPrompt +=
                        $"\nAI助手: {message.content.stringContent}";
                }
            }

            // 构建新的 VisionBody
            var messages = new List<VisionChatMessage>
            {
                new VisionChatMessage
                {
                    role = "system",
                    content = new ContentWrapper { stringContent = systemPrompt }
                },
                userQuestion
            };
            visionBody.messages = messages.ToArray();
        }
        else
        {
            var chatMessage = aiChat.Messages;
            var userQuestion = aiChat.Messages.LastOrDefault();
            chatMessage.RemoveAt(chatMessage.Count - 1);
            if (chatMessage.Count == 0)
            {
                systemPrompt += "暂无对话记录，请直接根据用户提问来思考";
            }

            foreach (var message in chatMessage)
            {
                if (message.Role == "user")
                {
                    systemPrompt +=
                        $"\n用户: {message.Content}";
                }
                else if (message.Role == "assistant")
                {
                    systemPrompt +=
                        $"\nAI助手: {message.Content}";
                }
            }

            aiChat.Messages = new List<Message>
            {
                new Message
                {
                    Role = "system",
                    Content = systemPrompt
                },
                userQuestion
            };
        }

        return (aiChat, visionBody, systemPrompt);
    }

    //------------------------------------MCP相关方法---------------------------------

    /// <summary>
    /// 验证MCP配置
    /// </summary>
    public async Task<MCPValidationResult> ValidateMCPConfig(object config, string account)
    {
        try
        {
            // 使用真正的MCP SDK进行配置验证
            return await _mcpService.ValidateConfigAsync(config);
        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"验证MCP配置失败: {ex.Message}", LogLevel.Error, account);
            return new MCPValidationResult
            {
                Success = false,
                IsValid = false,
                Errors = new List<string> { ex.Message },
                Message = "配置验证失败"
            };
        }
    }

    /// <summary>
    /// 保存MCP配置
    /// </summary>
    public async Task<MCPSaveResult> SaveMCPConfig(object config, string account)
    {
        try
        {
            // 使用真正的MCP SDK保存配置
            return await _mcpService.SaveConfigAsync(config, account);
        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"保存MCP配置失败: {ex.Message}", LogLevel.Error, account);
            return new MCPSaveResult
            {
                Success = false,
                Message = $"保存配置失败: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// 清空MCP配置
    /// </summary>
    public async Task<MCPSaveResult> ClearMCPConfig(string account)
    {
        try
        {
            // 使用真正的MCP SDK清空配置
            return await _mcpService.ClearConfigAsync(account);
        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"清空MCP配置失败: {ex.Message}", LogLevel.Error, account);
            return new MCPSaveResult
            {
                Success = false,
                Message = $"清空配置失败: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// 加载MCP服务
    /// </summary>
    public async Task<MCPLoadServersResult> LoadMCPServers(object config, string account)
    {
        try
        {
            // 使用真正的MCP SDK加载服务器
            return await _mcpService.LoadServersAsync(config, account);
        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"加载MCP服务失败: {ex.Message}", LogLevel.Error, account);
            return new MCPLoadServersResult
            {
                Success = false,
                Message = $"加载服务失败: {ex.Message}",
                Servers = new List<MCPServerInfo>()
            };
        }

        // 工具调用循环结束后，不再返回累计token统计，因为ChatHub不会处理
        // 每次工具调用都已经在过程中直接计费了
    }

    /// <summary>
    /// 推送工具调用状态到前端
    /// </summary>
    public async Task NotifyToolCallStatus(string chatId, string toolName, string arguments, string status,
        string toolCallId, string result = null)
    {
        try
        {
            var chatRes = new ChatRes
            {
                chatid = chatId,
                tool_call_name = toolName,
                tool_call_arguments = arguments,
                tool_call_status = status,
                tool_call_id = toolCallId,
                tool_call_result = result
            };

            await _hubContext.Clients.Group(chatId).SendAsync("ReceiveMessage", chatRes);
        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"推送工具调用状态失败: {ex.Message}", LogLevel.Error, "system");
        }
    }

    /// <summary>
    /// 执行MCP工具调用的计费逻辑
    /// </summary>
    private async Task PerformMCPToolBilling(string account, string modelName, string inputContent,
        string outputContent, List<object> mcpTools = null)
    {
        try
        {
            // 使用tiktoken计算token数量
            var tikToken = TikToken.GetEncoding("o200k_base");
            int inputTokens = string.IsNullOrEmpty(inputContent) ? 0 : tikToken.Encode(inputContent).Count;
            int outputTokens = string.IsNullOrEmpty(outputContent) ? 0 : tikToken.Encode(outputContent).Count;

            // 将MCP工具定义也计算进input token
            if (mcpTools != null && mcpTools.Any())
            {
                try
                {
                    var toolsJson = JsonConvert.SerializeObject(mcpTools);
                    var toolsTokenCount = tikToken.Encode(toolsJson).Count;
                    inputTokens += toolsTokenCount;
                }
                catch (Exception toolEx)
                {
                    await _systemService.WriteLog($"计算MCP工具定义token失败: {toolEx.Message}", LogLevel.Warn, account ?? "");
                }
            }

            if (inputTokens > 0 || outputTokens > 0)
            {
                using var scope = _serviceProvider.CreateScope();
                var financeService = scope.ServiceProvider.GetRequiredService<IFinanceService>();
                await financeService.CreateUseLogAndUpadteMoney(
                    account ?? "",
                    modelName,
                    inputTokens,
                    outputTokens
                );
            }
        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"MCP工具调用计费失败: {ex.Message}", LogLevel.Error, account ?? "");
        }
    }

    /// <summary>
    /// 执行MCP工具（支持从工具名解析服务器名）
    /// </summary>
    private async Task<MCPExecuteToolResult> ExecuteMCPToolWithServerParsing(string toolName, object arguments,
        string account)
    {
        try
        {
            // 检查工具名是否包含服务器名前缀（格式：服务器名-工具名）
            if (toolName.Contains("-"))
            {
                var parts = toolName.Split('-', 2);
                if (parts.Length == 2)
                {
                    var serverName = parts[0];
                    var actualToolName = parts[1];

                    // 使用指定服务器执行工具
                    return await _mcpService.ExecuteToolAsync(actualToolName, arguments, account, serverName);
                }
            }

            // 如果没有服务器名前缀，使用原有逻辑（遍历所有客户端）
            return await _mcpService.ExecuteToolAsync(toolName, arguments, account);
        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"执行MCP工具失败: {ex.Message}", LogLevel.Error, account);
            return new MCPExecuteToolResult
            {
                Success = false,
                Message = $"工具执行失败: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// 执行MCP工具
    /// </summary>
    public async Task<MCPExecuteToolResult> ExecuteMCPTool(string toolName, object arguments, string account)
    {
        try
        {
            // 使用真正的MCP SDK执行工具
            return await _mcpService.ExecuteToolAsync(toolName, arguments, account);
        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"执行MCP工具失败: {ex.Message}", LogLevel.Error, account);
            return new MCPExecuteToolResult
            {
                Success = false,
                Message = $"工具执行失败: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// 执行MCP工具（指定服务器）
    /// </summary>
    public async Task<MCPExecuteToolResult> ExecuteMCPTool(string toolName, object arguments, string account,
        string serverName)
    {
        try
        {
            // 使用真正的MCP SDK执行工具
            return await _mcpService.ExecuteToolAsync(toolName, arguments, account, serverName);
        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"执行MCP工具失败: {ex.Message}", LogLevel.Error, account);
            return new MCPExecuteToolResult
            {
                Success = false,
                Message = $"工具执行失败: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// 检查用户是否有MCP配置
    /// </summary>
    public async Task<bool> HasMCPConfig(string account)
    {
        try
        {
            return await _mcpService.HasMCPConfigAsync(account);
        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"检查MCP配置失败: {ex.Message}", LogLevel.Error, account);
            return false;
        }
    }

    /// <summary>
    /// 获取MCP工具列表
    /// </summary>
    public async Task<MCPGetToolsResult> GetMCPTools(string account)
    {
        try
        {
            // 使用真正的MCP SDK获取工具列表
            return await _mcpService.GetToolsAsync(account);
        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"获取MCP工具列表失败: {ex.Message}", LogLevel.Error, account);
            return new MCPGetToolsResult
            {
                Success = false,
                Message = $"获取工具列表失败: {ex.Message}",
                Tools = new List<MCPToolInfo>()
            };
        }
    }
}