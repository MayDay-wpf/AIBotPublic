using System.Text;
using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using OpenAI;
using OpenAI.Managers;
using OpenAI.ObjectModels.RequestModels;
using OpenAI.ObjectModels.ResponseModels;
using StackExchange.Redis;
using TiktokenSharp;
using LogLevel = aibotPro.Dtos.LogLevel;

namespace aibotPro.Service;

public class OpenAPIService : IOpenAPIService
{
    private readonly IBaiduService _baiduService;
    private readonly AIBotProContext _context;
    private readonly IFinanceService _financeService;
    private readonly ISystemService _systemService;
    private readonly IWorkShop _workShop;

    public OpenAPIService(ISystemService systemService, IBaiduService baiduService, IWorkShop workShop,
        IFinanceService financeService, AIBotProContext context)
    {
        _systemService = systemService;
        _baiduService = baiduService;
        _workShop = workShop;
        _financeService = financeService;
        _context = context;
    }

    public async Task<Dictionary<string, string>> CallERNIEAsStream(HttpResponse response,
        ChatCompletionCreateRequest chatCompletionCreate, OpenAiOptions openAiOptions, WorkShopAIModel useModel,
        string account)
    {
        var fn = new BaiduResDto.FunctionCall();
        var pluginResDto = new PluginResDto();
        var valuePairs = new Dictionary<string, string>();
        var index = 0;
        var input = string.Empty;
        var output = string.Empty;
        var chatMessages = chatCompletionCreate.Messages;
        await foreach (var responseContent in _baiduService.CallBaiduAI_Stream(chatCompletionCreate, openAiOptions,
                           ""))
        {
            if (responseContent != null && !string.IsNullOrEmpty(responseContent.Result))
            {
                var chatCompletionResponse = CreateERNIEStreamResult(responseContent);
                chatCompletionResponse.Model = useModel.ModelName;
                chatCompletionResponse.Choices.FirstOrDefault().index = index;
                var msgBytes = CreateStream(chatCompletionResponse);
                await SendStream(response, msgBytes);
                output += responseContent.Result;
            }

            fn = responseContent.Function_Call;
            index++;
            if (fn != null)
            {
                output += fn.Arguments;
                var openaiFn = new FunctionCall();
                _systemService.CopyPropertiesTo(fn, openaiFn);
                pluginResDto = await _workShop.RunPlugin(account, openaiFn);
                if (!pluginResDto.doubletreating)
                {
                    var res = DoubletypeRes(pluginResDto);
                    responseContent.Result = res;
                    var chatCompletionResponse = CreateERNIEStreamResult(responseContent);
                    var msgBytes = CreateStream(chatCompletionResponse);
                    await SendStream(response, msgBytes);
                }
                //反馈ERNIE函数执行结果
                else
                {
                    chatMessages.Add(ChatMessage.FromAssistant(fn.Thoughts));
                    //生成对话参数
                    input += pluginResDto.result;
                    chatMessages.Add(ChatMessage.FromUser(pluginResDto.result));
                    chatCompletionCreate.Messages = chatMessages;
                    chatCompletionCreate.Tools = null;
                    chatCompletionCreate.ToolChoice = null;
                    chatCompletionCreate.Stream = true;
                    chatCompletionCreate.Model = useModel.ModelName;
                    await foreach (var responseContent_sec in _baiduService.CallBaiduAI_Stream(chatCompletionCreate,
                                       openAiOptions, ""))
                        if (responseContent_sec != null && !string.IsNullOrEmpty(responseContent_sec.Result))
                        {
                            var chatCompletionResponse =
                                CreateERNIEStreamResult(responseContent_sec);
                            chatCompletionResponse.Model = useModel.ModelName;
                            chatCompletionResponse.Choices[0].index = index;
                            var msgBytes = CreateStream(chatCompletionResponse);
                            await SendStream(response, msgBytes);
                            output += responseContent_sec.Result;
                        }
                }

                if (!string.IsNullOrEmpty(fn.Arguments))
                    output += fn.Arguments;
            }
        }

        valuePairs.Add(input, output);
        return valuePairs;
    }

    public async Task<Dictionary<string, string>> CallOpenAIAsStream(HttpResponse response,
        ChatCompletionCreateRequest chatCompletionCreate, OpenAIService openAiService, string account)
    {
        var pluginResDto = new PluginResDto();
        var valuePairs = new Dictionary<string, string>();
        var input = string.Empty;
        var output = string.Empty;
        var chatMessages = chatCompletionCreate.Messages;
        var completionResult = openAiService.ChatCompletion.CreateCompletionAsStream(chatCompletionCreate);
        try
        {
            await foreach (var responseContent in completionResult)
                if (responseContent.Successful)
                {
                    var choice = responseContent.Choices.FirstOrDefault();
                    if (choice != null)
                    {
                        var chatCompletionResponse = CreateOpenAIStreamResult(responseContent);
                        if (chatCompletionResponse.Choices.FirstOrDefault() != null &&
                            !string.IsNullOrEmpty(chatCompletionResponse.Choices
                                .FirstOrDefault().delta.Content))
                        {
                            chatCompletionResponse.Model = chatCompletionCreate.Model;
                            var msgBytes = CreateStream(chatCompletionResponse);
                            await SendStream(response, msgBytes);
                            output += chatCompletionResponse.Choices[0].delta.Content;
                        }


                        var tools = choice.Message.ToolCalls;
                        if (tools != null)
                        {
                            var toolCall = tools[0];
                            var fn = toolCall.FunctionCall;
                            if (fn != null)
                                if (!string.IsNullOrEmpty(fn.Name))
                                {
                                    pluginResDto = await _workShop.RunPlugin(account, fn);
                                    if (!pluginResDto.doubletreating)
                                    {
                                        var res = DoubletypeRes(pluginResDto);
                                        responseContent.Choices[0].Message.Content = res;
                                        responseContent.Model = chatCompletionCreate.Model;
                                        chatCompletionResponse =
                                            CreateOpenAIStreamResult(responseContent);
                                        var msgBytes = CreateStream(chatCompletionResponse);
                                        await SendStream(response, msgBytes);
                                    }
                                    //反馈GPT函数执行结果
                                    else
                                    {
                                        //生成对话参数
                                        chatMessages.Add(ChatMessage.FromUser(pluginResDto.result));
                                        input += pluginResDto.result;
                                        chatCompletionCreate.Messages = chatMessages;
                                        chatCompletionCreate.Tools = null;
                                        chatCompletionCreate.Stream = true;
                                        completionResult =
                                            openAiService.ChatCompletion.CreateCompletionAsStream(chatCompletionCreate);
                                        await foreach (var responseContent_sec in completionResult)
                                            if (responseContent_sec.Successful)
                                            {
                                                var choice_sec = responseContent_sec.Choices.FirstOrDefault();
                                                if (choice_sec != null)
                                                {
                                                    chatCompletionResponse =
                                                        CreateOpenAIStreamResult(responseContent_sec);
                                                    if (chatCompletionResponse.Choices.FirstOrDefault() != null &&
                                                        !string.IsNullOrEmpty(chatCompletionResponse.Choices
                                                            .FirstOrDefault().delta.Content))
                                                    {
                                                        chatCompletionResponse.Model = chatCompletionCreate.Model;
                                                        var msgBytes = CreateStream(chatCompletionResponse);
                                                        await SendStream(response, msgBytes);
                                                        output += chatCompletionResponse.Choices[0].delta.Content;
                                                    }
                                                }
                                            }
                                    }

                                    if (!string.IsNullOrEmpty(fn.Arguments))
                                        output += fn.Arguments;
                                }
                        }
                    }
                }
        }
        catch (Exception e)
        {
            await _systemService.WriteLog(e.Message, LogLevel.Error, "CallOpenAIAsStream");
        }

        valuePairs.Add(input, output);
        return valuePairs;
    }

    public async Task<ChatCompletionResponseUnStream> CallERNIE(ChatCompletionCreateRequest chatCompletionCreate,
        OpenAiOptions openAiOptions, WorkShopAIModel useModel, string account)
    {
        var chatCompletionResponse = new ChatCompletionResponseUnStream();
        var pluginResDto = new PluginResDto();
        var tikToken = TikToken.GetEncoding("cl100k_base");
        var chatMessages = chatCompletionCreate.Messages;
        var completionResult = await _baiduService.CallBaiduAI(chatCompletionCreate, openAiOptions);
        var fn = completionResult.Function_Call;
        if (fn != null)
        {
            var openaiFn = new FunctionCall();
            _systemService.CopyPropertiesTo(fn, openaiFn);
            pluginResDto = await _workShop.RunPlugin(account, openaiFn);
            if (!pluginResDto.doubletreating)
            {
                var res = DoubletypeRes(pluginResDto);
                completionResult.Result = res;
            }
            //反馈百度函数执行结果
            else
            {
                //生成对话参数
                chatMessages.Add(ChatMessage.FromAssistant(fn.Thoughts));
                chatMessages.Add(ChatMessage.FromUser(pluginResDto.result));
                chatCompletionCreate.Messages = chatMessages;
                chatCompletionCreate.Tools = null;
                completionResult = await _baiduService.CallBaiduAI(chatCompletionCreate, openAiOptions);
                completionResult.Usage.PromptTokens += tikToken.Encode(fn.Thoughts).Count;
                completionResult.Usage.PromptTokens += tikToken.Encode(pluginResDto.result).Count;
            }

            if (!string.IsNullOrEmpty(fn.Arguments))
                completionResult.Usage.CompletionTokens += tikToken.Encode(fn.Arguments).Count;
        }

        chatCompletionResponse = CreateERNIEUnStreamResult(completionResult);
        chatCompletionResponse.Model = useModel.ModelName;
        return chatCompletionResponse;
    }

    public async Task<ChatCompletionResponseUnStream> CallOpenAI(ChatCompletionCreateRequest chatCompletionCreate,
        OpenAIService openAiService, string account)
    {
        var pluginResDto = new PluginResDto();
        var tikToken = TikToken.GetEncoding("cl100k_base");
        var chatMessages = chatCompletionCreate.Messages;
        var chatCompletionResponse = new ChatCompletionResponseUnStream();
        var completionResult = await openAiService.ChatCompletion.CreateCompletion(chatCompletionCreate);
        if (completionResult.Successful)
        {
            var choice = completionResult.Choices.First();
            if (choice != null && choice.Message != null && choice.Message.ToolCalls != null &&
                choice.Message.ToolCalls[0].FunctionCall != null)
            {
                var fn = choice.Message.ToolCalls[0].FunctionCall;
                if (!string.IsNullOrEmpty(fn.Name))
                {
                    pluginResDto = await _workShop.RunPlugin(account, fn);
                    if (!pluginResDto.doubletreating)
                    {
                        var res = DoubletypeRes(pluginResDto);
                        completionResult.Model = chatCompletionCreate.Model;
                        completionResult.Choices[0].Message.Content = res;
                        chatCompletionResponse = CreateOpenAIUnStreamResult(completionResult);
                    }
                    //反馈GPT函数执行结果
                    else
                    {
                        //生成对话参数
                        chatMessages.Add(ChatMessage.FromUser(pluginResDto.result));
                        chatCompletionCreate.Messages = chatMessages;
                        chatCompletionCreate.Tools = null;
                        chatCompletionCreate.Stream = false;
                        completionResult =
                            await openAiService.ChatCompletion.CreateCompletion(chatCompletionCreate);
                        if (completionResult.Successful)
                        {
                            var choice_sec = completionResult.Choices.FirstOrDefault();
                            if (choice_sec != null)
                            {
                                completionResult.Model = chatCompletionCreate.Model;
                                chatCompletionResponse = CreateOpenAIUnStreamResult(completionResult);
                                chatCompletionResponse.Usage.prompt_tokens +=
                                    tikToken.Encode(pluginResDto.result).Count;
                            }
                        }
                    }

                    if (!string.IsNullOrEmpty(fn.Arguments))
                        chatCompletionResponse.Usage.completion_tokens += tikToken.Encode(fn.Arguments).Count;
                }
            }
            else
            {
                completionResult.Model = chatCompletionCreate.Model;
                chatCompletionResponse = CreateOpenAIUnStreamResult(completionResult);
            }
        }

        return chatCompletionResponse;
    }


    public byte[] CreateStream(ChatCompletionResponse chatCompletionResponse)
    {
        var settings = new JsonSerializerSettings
        {
            ContractResolver = new DefaultContractResolver
            {
                NamingStrategy = new CamelCaseNamingStrategy()
            }
        };
        var jsonContent = JsonConvert.SerializeObject(chatCompletionResponse, settings);
        var msg = $"data: {jsonContent}\n\n";
        var msgBytes = Encoding.UTF8.GetBytes(msg);
        return msgBytes;
    }

    public ChatCompletionResponse CreateERNIEStreamResult(BaiduResDto.StreamResult responseContent)
    {
        var chatCompletionResponse = new ChatCompletionResponse();
        chatCompletionResponse.Id = responseContent.Id;
        chatCompletionResponse.Object = responseContent.Object;
        chatCompletionResponse.Created = responseContent.Created;
        chatCompletionResponse.system_fingerprint = responseContent.Id;
        var chatChoices = new List<Choices>
        {
            new()
            {
                logprobs = null,
                finish_reason = null,
                delta = new DeltaContent
                {
                    Content = responseContent.Result
                }
            }
        };
        chatCompletionResponse.Choices = chatChoices;
        return chatCompletionResponse;
    }

    public ChatCompletionResponse CreateOpenAIStreamResult(ChatCompletionCreateResponse responseContent)
    {
        var chatCompletionResponse = new ChatCompletionResponse();
        chatCompletionResponse.Id = responseContent.Id;
        chatCompletionResponse.Object = responseContent.ObjectTypeName;
        chatCompletionResponse.Created = responseContent.CreatedAt;
        chatCompletionResponse.Model = responseContent.Model;
        chatCompletionResponse.system_fingerprint = responseContent.SystemFingerPrint;
        var chatChoices = new List<Choices>();
        foreach (var item in responseContent.Choices)
        {
            var chatChoiceResponse = new Choices();
            chatChoiceResponse.index = item.Index.Value;
            chatChoiceResponse.finish_reason = item.FinishReason;
            var delta = new DeltaContent();
            if (item.Delta != null)
            {
                delta.Content = item.Delta.Content;
                delta.Role = item.Delta.Role;
                chatChoiceResponse.delta = delta;
            }

            chatChoices.Add(chatChoiceResponse);
        }

        chatCompletionResponse.Choices = chatChoices;
        return chatCompletionResponse;
    }

    public string DoubletypeRes(PluginResDto pluginResDto)
    {
        var res = string.Empty;
        switch (pluginResDto.doubletype)
        {
            case "dalle3":
                if (!string.IsNullOrEmpty(pluginResDto.errormsg) || string.IsNullOrEmpty(pluginResDto.result))
                    throw new Exception("Draw Fail");

                res = $"绘制完成 图片地址：{pluginResDto.result}";
                break;
            case "html":
                res = pluginResDto.result;
                break;
            case "js":
                res = pluginResDto.result;
                break;
            default:
                res = pluginResDto.result;
                break;
        }

        return res;
    }

    public async Task SendStream(HttpResponse response, byte[] msgBytes)
    {
        await response.Body.WriteAsync(msgBytes,
            0,
            msgBytes.Length);
        await response.Body.FlushAsync(); // 确保立即发送消息
    }

    public ChatCompletionResponseUnStream CreateERNIEUnStreamResult(BaiduResDto.StreamResult responseContent)
    {
        var chatCompletionResponse = new ChatCompletionResponseUnStream();
        chatCompletionResponse.Id = responseContent.Id;
        chatCompletionResponse.Object = responseContent.Object;
        chatCompletionResponse.Created = responseContent.Created;
        chatCompletionResponse.system_fingerprint = responseContent.Id;
        var chatChoices = new List<ChoicesUnStream>
        {
            new()
            {
                logprobs = null,
                finish_reason = null,
                message = new DeltaContent
                {
                    Content = responseContent.Result,
                    Role = "assistant"
                }
            }
        };
        chatCompletionResponse.Choices = chatChoices;
        chatCompletionResponse.Usage = new Dtos.Usage
        {
            completion_tokens = responseContent.Usage.CompletionTokens,
            prompt_tokens = responseContent.Usage.PromptTokens,
            total_tokens = responseContent.Usage.TotalTokens
        };
        return chatCompletionResponse;
    }

    public ChatCompletionResponseUnStream CreateOpenAIUnStreamResult(ChatCompletionCreateResponse responseContent)
    {
        var chatCompletionResponse = new ChatCompletionResponseUnStream();
        chatCompletionResponse.Id = responseContent.Id;
        chatCompletionResponse.Object = responseContent.ObjectTypeName;
        chatCompletionResponse.Created = responseContent.CreatedAt;
        chatCompletionResponse.Model = responseContent.Model;
        chatCompletionResponse.system_fingerprint = responseContent.SystemFingerPrint;
        var chatChoices = new List<ChoicesUnStream>();
        foreach (var item in responseContent.Choices)
        {
            var chatChoiceResponse = new ChoicesUnStream();
            chatChoiceResponse.index = item.Index.Value;
            chatChoiceResponse.finish_reason = item.FinishReason;
            var delta = new DeltaContent();
            if (item.Message != null)
            {
                delta.Content = item.Message.Content;
                delta.Role = item.Message.Role;
                chatChoiceResponse.message = delta;
            }

            chatChoices.Add(chatChoiceResponse);
        }

        chatCompletionResponse.Choices = chatChoices;
        chatCompletionResponse.Usage = new Dtos.Usage
        {
            completion_tokens = (int)responseContent.Usage.CompletionTokens,
            prompt_tokens = responseContent.Usage.PromptTokens,
            total_tokens = responseContent.Usage.TotalTokens
        };
        return chatCompletionResponse;
    }
}