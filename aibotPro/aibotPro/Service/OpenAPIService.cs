using aibotPro.Dtos;
using aibotPro.Interface;
using Newtonsoft.Json.Serialization;
using Newtonsoft.Json;
using OpenAI.ObjectModels.ResponseModels;
using static Google.Apis.Requests.BatchRequest;
using OpenAI.ObjectModels.RequestModels;
using OpenAI;
using static OpenAI.ObjectModels.Models;
using System.Security.Principal;
using aibotPro.Models;
using OpenAI.Managers;
using TiktokenSharp;
using OpenAI.Interfaces;

namespace aibotPro.Service
{
    public class OpenAPIService : IOpenAPIService
    {
        private readonly ISystemService _systemService;
        private readonly IBaiduService _baiduService;
        private readonly IWorkShop _workShop;
        private readonly IFinanceService _financeService;
        public OpenAPIService(ISystemService systemService, IBaiduService baiduService, IWorkShop workShop, IFinanceService financeService)
        {
            _systemService = systemService;
            _baiduService = baiduService;
            _workShop = workShop;
            _financeService = financeService;
        }
        public async Task<Dictionary<string, string>> CallERNIEAsStream(HttpResponse response, ChatCompletionCreateRequest chatCompletionCreate, OpenAiOptions openAiOptions, WorkShopAIModel useModel, string account)
        {
            BaiduResDto.FunctionCall fn = new BaiduResDto.FunctionCall();
            PluginResDto pluginResDto = new PluginResDto();
            Dictionary<string, string> valuePairs = new Dictionary<string, string>();
            int index = 0;
            string input = string.Empty;
            string output = string.Empty;
            IList<ChatMessage> chatMessages = chatCompletionCreate.Messages;
            await foreach (var responseContent in _baiduService.CallBaiduAI_Stream(chatCompletionCreate, openAiOptions, ""))
            {
                if (responseContent != null && !string.IsNullOrEmpty(responseContent.Result))
                {
                    ChatCompletionResponse chatCompletionResponse = CreateERNIEStreamResult(responseContent);
                    chatCompletionResponse.Model = useModel.ModelName;
                    chatCompletionResponse.Choices[0].index = index;
                    var msgBytes = CreateStream(chatCompletionResponse);
                    await SendStream(response, msgBytes);
                    output += responseContent.Result;
                }
                fn = responseContent.Function_Call;
                index++;
                if (fn != null)
                {
                    output += fn.Arguments;
                    FunctionCall openaiFn = new FunctionCall();
                    _systemService.CopyPropertiesTo(fn, openaiFn);
                    pluginResDto = await _workShop.RunPlugin(account, openaiFn);
                    if (!pluginResDto.doubletreating)
                    {
                        string res = DoubletypeRes(pluginResDto);
                        responseContent.Result = res;
                        ChatCompletionResponse chatCompletionResponse = CreateERNIEStreamResult(responseContent);
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
                        await foreach (var responseContent_sec in _baiduService.CallBaiduAI_Stream(chatCompletionCreate, openAiOptions, ""))
                        {
                            if (responseContent_sec != null && !string.IsNullOrEmpty(responseContent_sec.Result))
                            {
                                ChatCompletionResponse chatCompletionResponse = CreateERNIEStreamResult(responseContent_sec);
                                chatCompletionResponse.Model = useModel.ModelName;
                                chatCompletionResponse.Choices[0].index = index;
                                var msgBytes = CreateStream(chatCompletionResponse);
                                await SendStream(response, msgBytes);
                                output += responseContent_sec.Result;
                            }
                        }
                    }
                    if (!string.IsNullOrEmpty(fn.Arguments))
                        output += fn.Arguments;
                }
            }
            valuePairs.Add(input, output);
            return valuePairs;
        }
        public async Task<Dictionary<string, string>> CallOpenAIAsStream(HttpResponse response, ChatCompletionCreateRequest chatCompletionCreate, OpenAIService openAiService, string account)
        {
            PluginResDto pluginResDto = new PluginResDto();
            Dictionary<string, string> valuePairs = new Dictionary<string, string>();
            string input = string.Empty;
            string output = string.Empty;
            IList<ChatMessage> chatMessages = chatCompletionCreate.Messages;
            var completionResult = openAiService.ChatCompletion.CreateCompletionAsStream(chatCompletionCreate);
            await foreach (var responseContent in completionResult)
            {
                if (responseContent.Successful)
                {
                    var choice = responseContent.Choices.FirstOrDefault();
                    if (choice != null)
                    {
                        ChatCompletionResponse chatCompletionResponse = CreateOpenAIStreamResult(responseContent);
                        var msgBytes = CreateStream(chatCompletionResponse);
                        await SendStream(response, msgBytes);
                        output += chatCompletionResponse.Choices[0].delta.Content;
                    }
                    else
                    {
                        throw new Exception("模型未回复，请重试");
                    }
                    var tools = choice.Message.ToolCalls;
                    if (tools != null)
                    {
                        var toolCall = tools[0];
                        var fn = toolCall.FunctionCall;
                        if (fn != null)
                        {
                            if (!string.IsNullOrEmpty(fn.Name))
                            {
                                pluginResDto = await _workShop.RunPlugin(account, fn);
                                if (!pluginResDto.doubletreating)
                                {
                                    string res = DoubletypeRes(pluginResDto);
                                    responseContent.Choices[0].Message.Content = res;
                                    ChatCompletionResponse chatCompletionResponse = CreateOpenAIStreamResult(responseContent);
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
                                    completionResult = openAiService.ChatCompletion.CreateCompletionAsStream(chatCompletionCreate);
                                    await foreach (var responseContent_sec in completionResult)
                                    {
                                        if (responseContent_sec.Successful)
                                        {
                                            var choice_sec = responseContent_sec.Choices.FirstOrDefault();
                                            if (choice_sec != null)
                                            {
                                                ChatCompletionResponse chatCompletionResponse = CreateOpenAIStreamResult(responseContent_sec);
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
            valuePairs.Add(input, output);
            return valuePairs;
        }
        public async Task<ChatCompletionResponseUnStream> CallERNIE(ChatCompletionCreateRequest chatCompletionCreate, OpenAiOptions openAiOptions, WorkShopAIModel useModel, string account)
        {
            ChatCompletionResponseUnStream chatCompletionResponse = new ChatCompletionResponseUnStream();
            PluginResDto pluginResDto = new PluginResDto();
            TikToken tikToken = TikToken.GetEncoding("cl100k_base");
            IList<ChatMessage> chatMessages = chatCompletionCreate.Messages;
            var completionResult = await _baiduService.CallBaiduAI(chatCompletionCreate, openAiOptions);
            var fn = completionResult.Function_Call;
            if (fn != null)
            {
                FunctionCall openaiFn = new FunctionCall();
                _systemService.CopyPropertiesTo(fn, openaiFn);
                pluginResDto = await _workShop.RunPlugin(account, openaiFn);
                if (!pluginResDto.doubletreating)
                {
                    string res = DoubletypeRes(pluginResDto);
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
                    chatCompletionResponse.Usage.prompt_tokens += tikToken.Encode(fn.Thoughts).Count;
                    chatCompletionResponse.Usage.prompt_tokens += tikToken.Encode(pluginResDto.result).Count;
                }
                if (!string.IsNullOrEmpty(fn.Arguments))
                    chatCompletionResponse.Usage.completion_tokens += tikToken.Encode(fn.Arguments).Count;
            }
            chatCompletionResponse = CreateERNIEUnStreamResult(completionResult);
            chatCompletionResponse.Model = useModel.ModelName;
            return chatCompletionResponse;
        }
        public async Task<ChatCompletionResponseUnStream> CallOpenAI(ChatCompletionCreateRequest chatCompletionCreate, OpenAIService openAiService, string account)
        {
            PluginResDto pluginResDto = new PluginResDto();
            TikToken tikToken = TikToken.GetEncoding("cl100k_base");
            IList<ChatMessage> chatMessages = chatCompletionCreate.Messages;
            ChatCompletionResponseUnStream chatCompletionResponse = new ChatCompletionResponseUnStream();
            var completionResult = await openAiService.ChatCompletion.CreateCompletion(chatCompletionCreate);
            if (completionResult.Successful)
            {
                var choice = completionResult.Choices.First();
                if (choice == null || choice.Message == null)
                    throw new Exception("模型未回复，请重试");
                if (choice.Message.ToolCalls != null && choice.Message.ToolCalls[0].FunctionCall != null)
                {
                    var fn = choice.Message.ToolCalls[0].FunctionCall;
                    if (!string.IsNullOrEmpty(fn.Name))
                    {
                        pluginResDto = await _workShop.RunPlugin(account, fn);
                        if (!pluginResDto.doubletreating)
                        {
                            string res = DoubletypeRes(pluginResDto);
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
                            completionResult = await openAiService.ChatCompletion.CreateCompletion(chatCompletionCreate);
                            if (completionResult.Successful)
                            {
                                var choice_sec = completionResult.Choices.FirstOrDefault();
                                if (choice_sec != null)
                                {
                                    chatCompletionResponse = CreateOpenAIUnStreamResult(completionResult);
                                    chatCompletionResponse.Usage.prompt_tokens += tikToken.Encode(pluginResDto.result).Count;
                                }
                            }
                        }
                        if (!string.IsNullOrEmpty(fn.Arguments))
                            chatCompletionResponse.Usage.completion_tokens += tikToken.Encode(fn.Arguments).Count;
                    }
                }
                else
                {
                    chatCompletionResponse = CreateOpenAIUnStreamResult(completionResult);
                }
            }
            return chatCompletionResponse;
        }


        public Byte[] CreateStream(ChatCompletionResponse chatCompletionResponse)
        {
            JsonSerializerSettings settings = new JsonSerializerSettings
            {
                ContractResolver = new DefaultContractResolver
                {
                    NamingStrategy = new CamelCaseNamingStrategy()
                }
            };
            string jsonContent = JsonConvert.SerializeObject(chatCompletionResponse, settings);
            string msg = $"data: {jsonContent}\n\n";
            var msgBytes = System.Text.Encoding.UTF8.GetBytes(msg);
            return msgBytes;
        }
        public ChatCompletionResponse CreateERNIEStreamResult(BaiduResDto.StreamResult responseContent)
        {
            ChatCompletionResponse chatCompletionResponse = new ChatCompletionResponse();
            chatCompletionResponse.Id = responseContent.Id;
            chatCompletionResponse.Object = responseContent.Object;
            chatCompletionResponse.Created = responseContent.Created;
            chatCompletionResponse.system_fingerprint = responseContent.Id;
            List<Choices> chatChoices = new List<Choices>()
            {
                                    new Choices()
                                    {
                                        logprobs=null,
                                        finish_reason=null,
                                        delta=new DeltaContent() {
                                           Content=responseContent.Result
                                        }
                                    }
                                };
            chatCompletionResponse.Choices = chatChoices;
            return chatCompletionResponse;
        }
        public ChatCompletionResponse CreateOpenAIStreamResult(ChatCompletionCreateResponse responseContent)
        {
            ChatCompletionResponse chatCompletionResponse = new ChatCompletionResponse();
            chatCompletionResponse.Id = responseContent.Id;
            chatCompletionResponse.Object = responseContent.ObjectTypeName;
            chatCompletionResponse.Created = responseContent.CreatedAt;
            chatCompletionResponse.Model = responseContent.Model;
            chatCompletionResponse.system_fingerprint = responseContent.SystemFingerPrint;
            List<Choices> chatChoices = new List<Choices>();
            foreach (var item in responseContent.Choices)
            {
                Choices chatChoiceResponse = new Choices();
                chatChoiceResponse.index = item.Index.Value;
                DeltaContent delta = new DeltaContent();
                if (item.Delta != null)
                {
                    delta.Content = item.Delta.Content;
                    chatChoiceResponse.delta = delta;
                }
                chatChoices.Add(chatChoiceResponse);
            }
            chatCompletionResponse.Choices = chatChoices;
            return chatCompletionResponse;
        }
        public ChatCompletionResponseUnStream CreateERNIEUnStreamResult(BaiduResDto.StreamResult responseContent)
        {
            ChatCompletionResponseUnStream chatCompletionResponse = new ChatCompletionResponseUnStream();
            chatCompletionResponse.Id = responseContent.Id;
            chatCompletionResponse.Object = responseContent.Object;
            chatCompletionResponse.Created = responseContent.Created;
            chatCompletionResponse.system_fingerprint = responseContent.Id;
            List<Choices> chatChoices = new List<Choices>()
            {
                                    new Choices()
                                    {
                                        logprobs=null,
                                        finish_reason=null,
                                        delta=new DeltaContent() {
                                           Content=responseContent.Result
                                        }
                                    }
                                };
            chatCompletionResponse.Choices = chatChoices;
            chatCompletionResponse.Usage = new Dtos.Usage()
            {
                completion_tokens = responseContent.Usage.CompletionTokens,
                prompt_tokens = responseContent.Usage.PromptTokens,
                total_tokens = responseContent.Usage.TotalTokens
            };
            return chatCompletionResponse;
        }
        public ChatCompletionResponseUnStream CreateOpenAIUnStreamResult(ChatCompletionCreateResponse responseContent)
        {
            ChatCompletionResponseUnStream chatCompletionResponse = new ChatCompletionResponseUnStream();
            chatCompletionResponse.Id = responseContent.Id;
            chatCompletionResponse.Object = responseContent.ObjectTypeName;
            chatCompletionResponse.Created = responseContent.CreatedAt;
            chatCompletionResponse.Model = responseContent.Model;
            chatCompletionResponse.system_fingerprint = responseContent.SystemFingerPrint;
            List<Choices> chatChoices = new List<Choices>();
            foreach (var item in responseContent.Choices)
            {
                Choices chatChoiceResponse = new Choices();
                chatChoiceResponse.index = item.Index.Value;
                DeltaContent delta = new DeltaContent();
                if (item.Delta != null)
                {
                    delta.Content = item.Delta.Content;
                    chatChoiceResponse.delta = delta;
                }
                chatChoices.Add(chatChoiceResponse);
            }
            chatCompletionResponse.Choices = chatChoices;
            chatCompletionResponse.Usage = new Dtos.Usage()
            {
                completion_tokens = (int)responseContent.Usage.CompletionTokens,
                prompt_tokens = (int)responseContent.Usage.PromptTokens,
                total_tokens = (int)responseContent.Usage.TotalTokens
            };
            return chatCompletionResponse;
        }
        public string DoubletypeRes(PluginResDto pluginResDto)
        {
            string res = string.Empty;
            switch (pluginResDto.doubletype)
            {
                case "dalle3":
                    if (!string.IsNullOrEmpty(pluginResDto.errormsg) || string.IsNullOrEmpty(pluginResDto.result))
                    {
                        throw new Exception("Draw Fail");
                    }
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
            await response.Body.FlushAsync();// 确保立即发送消息
        }
    }
}
