using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using OpenAI.Managers;
using OpenAI;
using System.Text;
using OpenAI.ObjectModels.RequestModels;
using OpenAI.Builders;
using OpenAI.ObjectModels.SharedModels;
using System.Security.Principal;
using TiktokenSharp;
using StackExchange.Redis;
using Newtonsoft.Json.Serialization;
using Microsoft.Build.Evaluation;
using Org.BouncyCastle.Bcpg;
using static OpenAI.ObjectModels.SharedModels.IOpenAiModels;
using Microsoft.EntityFrameworkCore;

namespace aibotPro.Controllers
{
    public class OpenAPIController : Controller
    {
        private readonly ISystemService _systemService;
        private readonly IRedisService _redisService;
        private readonly IWorkShop _workShop;
        private readonly JwtTokenManager _jwtTokenManager;
        private readonly AIBotProContext _context;
        private readonly IFinanceService _financeService;
        public OpenAPIController(ISystemService systemService, IRedisService redisService, IWorkShop workShop, JwtTokenManager jwtTokenManager, AIBotProContext context, IFinanceService financeService)
        {
            _systemService = systemService;
            _redisService = redisService;
            _workShop = workShop;
            _jwtTokenManager = jwtTokenManager;
            _context = context;
            _financeService = financeService;
        }
        [Authorize]
        [HttpPost]
        public IActionResult CreateApiKey()
        {
            //创建一个以sk-开头的随机字符串
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            string apiKey = "sk-" + _systemService.ConvertToMD5(username + DateTime.Now.ToString("yyyyMMddHHmmss"), 32, true);
            //将API Key存入数据库,已存在则更新
            var result = _context.APIKEYs.Where(x => x.Account == username).FirstOrDefault();
            if (result == null)
            {
                _context.APIKEYs.Add(new APIKEY { Account = username, ApiKey1 = apiKey });
            }
            else
            {
                result.ApiKey1 = apiKey;
            }
            //更新SystemPlugins表
            var systemPlugins = _context.SystemPlugins.Where(x => x.Account == username).ToList();
            foreach (var item in systemPlugins)
            {
                item.ApiKey = apiKey;
            }
            _context.SaveChanges();
            return Ok(new { success = true, msg = "Success", data = apiKey });
        }
        [Authorize]
        [HttpPost]
        public IActionResult GetApiKey()
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var result = _context.APIKEYs.Where(x => x.Account == username).FirstOrDefault();
            if (result == null)
            {
                return Ok(new { success = false, msg = "No API Key" });
            }
            else
            {
                return Ok(new { success = true, msg = "Success", data = result.ApiKey1 });
            }
        }
        [Authorize]
        [HttpPost]
        public IActionResult UpdateSystemPlugin(string Pfunctionname, string type)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var apikeys = _context.APIKEYs.Where(x => x.Account == username).FirstOrDefault();
            if (apikeys == null)
            {
                return Ok(new { success = false, msg = "请先创建APIKEY" });
            }
            string apikey = apikeys.ApiKey1;
            if (type == "add")
            {
                //判断这个插件是否已经存在
                var result = _context.SystemPlugins.Where(x => x.Account == username && x.Pfunctionname == Pfunctionname).FirstOrDefault();
                if (result == null)
                    _context.SystemPlugins.Add(new SystemPlugin { Account = username, ApiKey = apikey, Pfunctionname = Pfunctionname });
            }
            else if (type == "remove")
            {
                var result = _context.SystemPlugins.Where(x => x.Account == username && x.Pfunctionname == Pfunctionname).FirstOrDefault();
                if (result != null)
                    _context.SystemPlugins.Remove(result);
            }
            _context.SaveChanges();
            return Ok(new { success = true, msg = "Success" });
        }
        [Authorize]
        [HttpPost]
        public IActionResult GetSystemPlugin()
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var result = _context.SystemPlugins.Where(x => x.Account == username).ToList();
            return Ok(new { success = true, msg = "Success", data = result });
        }
        [Authorize(Policy = "APIOnly")]
        [HttpPost]
        [Route("/v1/chat/completions")]
        public async Task<IActionResult> Completions()
        {
            //获取Authorize的API Key
            string apiKey = Request
                .Headers["Authorization"]
                .ToString()
                .Replace("Bearer ", "");
            //根据APIKEY查询用户账号
            string Account = _context.APIKEYs.Where(x => x.ApiKey1 == apiKey).FirstOrDefault().Account;
            var user = _context.Users.AsNoTracking().Where(x => x.Account == Account).FirstOrDefault();
            string jsonBody;
            using (var reader = new StreamReader(Request.Body, Encoding.UTF8))
            {
                jsonBody = await reader.ReadToEndAsync();
            }
            ChatSession chatSession = JsonConvert.DeserializeObject<ChatSession>(jsonBody);
            //获取模型关系映射并切换
            var openapiSetting = await _workShop.GetOpenAPIModelSetting(Account);
            if (openapiSetting != null)
            {
                var trueModelName = openapiSetting.Where(x => x.FromModelName == chatSession.Model).FirstOrDefault();
                if (trueModelName != null)
                    chatSession.Model = trueModelName.ToModelName;
            }

            //检查该模型是否需要收费
            var modelPrice = await _financeService.ModelPrice(chatSession.Model);
            bool isVip = await _financeService.IsVip(Account);
            bool shouldCharge = !isVip && modelPrice != null &&
                                (modelPrice.VipModelPriceInput > 0 || modelPrice.ModelPriceOutput > 0);

            //不是会员且余额为0时不提供服务
            if (!isVip && user.Mcoin <= 0)
            {
                throw new Exception("本站已停止向【非会员且余额为0】的用户提供服务，您可以前往充值1元及以上，长期使用本站的免费服务");
            }

            // 检查用户余额是否不足，只有在需要收费时检查
            if (shouldCharge && user.Mcoin <= 0)
            {
                throw new Exception("余额不足，请充值后再使用，您可以前往充值");
            }
            //记录系统使用日志
            await _systemService.WriteLog($"用户调用API：{chatSession.Model}", Dtos.LogLevel.Info, Account);
            List<WorkShopAIModel> aImodels = new List<WorkShopAIModel>();
            aImodels = _systemService.GetWorkShopAImodel();
            if (aImodels == null || aImodels.Count == 0)
            {
                throw new Exception("模型不存在");
            }
            if (aImodels.Where(x => x.ModelName == chatSession.Model).FirstOrDefault() == null)
            {
                throw new Exception("模型不存在");
            }
            OpenAiOptions openAiOptions = new OpenAiOptions();
            openAiOptions.BaseDomain = aImodels.Where(x => x.ModelName == chatSession.Model).FirstOrDefault().BaseUrl;
            openAiOptions.ApiKey = aImodels.Where(x => x.ModelName == chatSession.Model).FirstOrDefault().ApiKey;
            var openAiService = new OpenAIService(openAiOptions);
            //将ChatSession转换为OpenAI的ChatSession
            List<ChatMessage> chatMessages = new List<ChatMessage>();
            string input = string.Empty;
            string output = string.Empty;
            foreach (var item in chatSession.Messages)
            {
                if (item.Role == "system")
                    chatMessages.Add(ChatMessage.FromSystem(item.Content));
                else if (item.Role == "user")
                    chatMessages.Add(ChatMessage.FromUser(item.Content));
                else if (item.Role == "assistant")
                    chatMessages.Add(ChatMessage.FromAssistant(item.Content));
                input += item.Content;
            }
            ChatCompletionCreateRequest chatCompletionCreate = new ChatCompletionCreateRequest();
            chatCompletionCreate.Messages = chatMessages;
            //初始化系统函数
            var fnDall = new FunctionDefinitionBuilder("use_dalle3_withpr", "结合上下文生成DALL-E3提示词并绘制")
                            .AddParameter("drawprompt", PropertyDefinition.DefineString("根据绘画要求，结合上下文优化后的DALL-E3绘画提示词"))
                            .AddParameter("drawsize", PropertyDefinition.DefineEnum(new List<string> { "1024x1024", "1792x1024", "1024x1792" }, "需要绘制的图片尺寸,默认1024x1024"))
                            .AddParameter("quality", PropertyDefinition.DefineEnum(new List<string> { "standard", "hd" }, "绘制图片的质量，默认standard标准质量，当许要更高清晰度和更多细节时，使用hd质量"))
                            .Validate()
                            .Build();
            var fnGoogleSearch = new FunctionDefinitionBuilder("search_google_when_gpt_cannot_answer", "当 gpt 遇到无法回答的或者需要搜索引擎协助回答时从 google 搜索")
                                    .AddParameter("message", PropertyDefinition.DefineString("搜索句，支持中文或者英文"))
                                    .Validate()
                                    .Build();
            var sysKnowledgeSearch = new FunctionDefinitionBuilder("search_knowledge_base", "从知识库中查询或搜索GPT无法得知的内容")
                                        .AddParameter("message", PropertyDefinition.DefineString("搜索用的关键词，支持中文或者英文"))
                                        .Validate()
                                        .Build();
            var mytools = new List<ToolDefinition>();
            //查询系统插件
            var systemPlugins = _context.SystemPlugins.Where(x => x.ApiKey == apiKey).ToList();
            foreach (var plugin in systemPlugins)
            {
                if (plugin.Pfunctionname == "use_dalle3_withpr")
                    mytools.Add(ToolDefinition.DefineFunction(fnDall));
                else if (plugin.Pfunctionname == "search_google_when_gpt_cannot_answer")
                    mytools.Add(ToolDefinition.DefineFunction(fnGoogleSearch));
                else if (plugin.Pfunctionname == "search_knowledge_base")
                    mytools.Add(ToolDefinition.DefineFunction(sysKnowledgeSearch));
            }
            //获取用户插件列表
            var myplugins = _workShop.GetPluginInstall(Account);
            if (myplugins != null && myplugins.Count > 0)
            {
                foreach (var pluginitem in myplugins)
                {
                    FunctionDefinition functionDefinition = new FunctionDefinition();
                    var myfn = new FunctionDefinitionBuilder(pluginitem.Pfunctionname, pluginitem.Pfunctioninfo);
                    //如果是工作流
                    if (pluginitem.Pcodemodel == "plugin-workflow")
                    {
                        //获取工作流节点数据
                        var nodeData = _context.WorkFlows.Where(x => x.Pcode == pluginitem.Pcode).FirstOrDefault().FlowJson;
                        //nodeData为空则跳过
                        if (string.IsNullOrEmpty(nodeData))
                            continue;
                        WorkFlowNodeData workFlowNodeData = JsonConvert.DeserializeObject<WorkFlowNodeData>(nodeData);
                        //找到start节点
                        var homeData = workFlowNodeData.Drawflow.Home.Data;
                        NodeData startData = homeData.Values.FirstOrDefault(x => x.Name == "start");
                        //寻找参数
                        if (startData.Data is StartData startDataSpecific)
                        {
                            // 现在startDataSpecific.Output指向StartOutput对象
                            var startOutput = startDataSpecific.Output;

                            if (startOutput != null)
                            {
                                // 遍历PrItems
                                foreach (var prItem in startOutput.PrItems)
                                {
                                    myfn.AddParameter(prItem.PrName, PropertyDefinition.DefineString(prItem.PrInfo));
                                }
                            }
                        }
                    }
                    else
                    {
                        var myparams = _workShop.GetPluginParams(pluginitem.Id);
                        if (myparams != null && myparams.Count > 0)
                        {
                            foreach (var paramitem in myparams)
                            {
                                myfn.AddParameter(paramitem.ParamName, PropertyDefinition.DefineString(paramitem.ParamInfo));
                            }
                        }
                    }
                    functionDefinition = myfn.Validate().Build();
                    mytools.Add(ToolDefinition.DefineFunction(functionDefinition));
                }
            }
            if (mytools.Count > 0)
                chatCompletionCreate.Tools = mytools;
            chatCompletionCreate.Model = chatSession.Model;
            try
            {
                if (chatSession.Stream)
                {
                    var completionResult = openAiService.ChatCompletion.CreateCompletionAsStream(chatCompletionCreate);
                    chatCompletionCreate.Stream = true;
                    PluginResDto pluginResDto = new PluginResDto();
                    TikToken tikToken = TikToken.GetEncoding("cl100k_base");
                    //流式输出
                    var response = Response;
                    response.Headers.Add("Content-Type", "text/event-stream;charset=utf-8");
                    response.Headers.Add("Cache-Control", "no-cache");
                    response.Headers.Add("Connection", "keep-alive");
                    await foreach (var responseContent in completionResult)
                    {
                        if (responseContent.Successful)
                        {
                            var choice = responseContent.Choices.FirstOrDefault();
                            if (choice != null)
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
                                await response.Body.WriteAsync(msgBytes,
                                            0,
                                            msgBytes.Length);
                                await response.Body.FlushAsync();// 确保立即发送消息
                                output += chatCompletionResponse.Choices[0].delta.Content;
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
                                        pluginResDto = await _workShop.RunPlugin(Account, fn);
                                        if (!pluginResDto.doubletreating)
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
                                            ChatCompletionResponse chatCompletionResponse = new ChatCompletionResponse();
                                            chatCompletionResponse.Id = responseContent.Id;
                                            chatCompletionResponse.Object = responseContent.ObjectTypeName;
                                            chatCompletionResponse.Created = responseContent.CreatedAt;
                                            chatCompletionResponse.Model = responseContent.Model;
                                            chatCompletionResponse.system_fingerprint = responseContent.SystemFingerPrint;
                                            List<Choices> chatChoices = new List<Choices>();
                                            Choices chatChoiceResponse = new Choices();
                                            chatChoiceResponse.index = int.Parse(DateTime.Now.ToString("HHmmssfff"));
                                            DeltaContent delta = new DeltaContent();
                                            delta.Content = res;
                                            chatChoiceResponse.delta = delta;
                                            chatChoices.Add(chatChoiceResponse);
                                            chatCompletionResponse.Choices = chatChoices;
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
                                            await response.Body.WriteAsync(msgBytes,
                                                        0,
                                                        msgBytes.Length);
                                            await response.Body.FlushAsync();// 确保立即发送消息
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
                                            chatCompletionCreate.Model = chatSession.Model;
                                            completionResult = openAiService.ChatCompletion.CreateCompletionAsStream(chatCompletionCreate);
                                            await foreach (var responseContent_sec in completionResult)
                                            {
                                                if (responseContent_sec.Successful)
                                                {
                                                    var choice_sec = responseContent_sec.Choices.FirstOrDefault();
                                                    if (choice_sec != null)
                                                    {
                                                        ChatCompletionResponse chatCompletionResponse = new ChatCompletionResponse();
                                                        chatCompletionResponse.Id = responseContent_sec.Id;
                                                        chatCompletionResponse.Object = responseContent_sec.ObjectTypeName;
                                                        chatCompletionResponse.Created = responseContent_sec.CreatedAt;
                                                        chatCompletionResponse.Model = responseContent_sec.Model;
                                                        chatCompletionResponse.system_fingerprint = responseContent_sec.SystemFingerPrint;
                                                        List<Choices> chatChoices = new List<Choices>();
                                                        foreach (var item in responseContent_sec.Choices)
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
                                                            output += item.Delta.Content;
                                                        }
                                                        chatCompletionResponse.Choices = chatChoices;
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
                                                        await response.Body.WriteAsync(msgBytes,
                                                                    0,
                                                                    msgBytes.Length);
                                                        await response.Body.FlushAsync();// 确保立即发送消息
                                                    }

                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    await _financeService.CreateUseLogAndUpadteMoney(Account, chatSession.Model, tikToken.Encode(input).Count, tikToken.Encode(output).Count);
                }
                else
                {
                    chatCompletionCreate.Stream = false;
                    PluginResDto pluginResDto = new PluginResDto();
                    TikToken tikToken = TikToken.GetEncoding("cl100k_base");
                    var completionResult = await openAiService.ChatCompletion.CreateCompletion(chatCompletionCreate);
                    if (completionResult.Successful)
                    {
                        var choice = completionResult.Choices.First();
                        if (choice.Message.ToolCalls != null && choice.Message.ToolCalls[0].FunctionCall != null)
                        {
                            var fn = choice.Message.ToolCalls[0].FunctionCall;
                            if (!string.IsNullOrEmpty(fn.Name))
                            {
                                pluginResDto = await _workShop.RunPlugin(Account, fn);
                                if (!pluginResDto.doubletreating)
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
                                    ChatCompletionResponse chatCompletionResponse = new ChatCompletionResponse();
                                    chatCompletionResponse.Id = completionResult.Id;
                                    chatCompletionResponse.Object = completionResult.ObjectTypeName;
                                    chatCompletionResponse.Model = completionResult.Model;
                                    chatCompletionResponse.system_fingerprint = completionResult.SystemFingerPrint;
                                    List<Choices> chatChoices = new List<Choices>();
                                    Choices chatChoiceResponse = new Choices();
                                    chatChoiceResponse.index = int.Parse(DateTime.Now.ToString("yyyyHHmmss"));
                                    DeltaContent delta = new DeltaContent();
                                    delta.Content = res;
                                    chatChoiceResponse.delta = delta;
                                    chatChoices.Add(chatChoiceResponse);
                                    chatCompletionResponse.Choices = chatChoices;
                                    await _financeService.CreateUseLogAndUpadteMoney(Account, chatSession.Model, tikToken.Encode(input).Count, tikToken.Encode(output).Count);
                                    return Ok(chatCompletionResponse);
                                }
                                //反馈GPT函数执行结果
                                else
                                {
                                    //生成对话参数
                                    chatMessages.Add(ChatMessage.FromUser(pluginResDto.result));
                                    input += pluginResDto.result;
                                    chatCompletionCreate.Messages = chatMessages;
                                    chatCompletionCreate.Tools = null;
                                    chatCompletionCreate.Stream = false;
                                    chatCompletionCreate.Model = chatSession.Model;
                                    completionResult = await openAiService.ChatCompletion.CreateCompletion(chatCompletionCreate);
                                    if (completionResult.Successful)
                                    {
                                        var choice_sec = completionResult.Choices.FirstOrDefault();
                                        if (choice_sec != null)
                                        {
                                            ChatCompletionResponse chatCompletionResponse = new ChatCompletionResponse();
                                            chatCompletionResponse.Id = completionResult.Id;
                                            chatCompletionResponse.Object = completionResult.ObjectTypeName;
                                            chatCompletionResponse.Model = completionResult.Model;
                                            chatCompletionResponse.system_fingerprint = completionResult.SystemFingerPrint;
                                            List<Choices> chatChoices = new List<Choices>();
                                            foreach (var item in completionResult.Choices)
                                            {
                                                Choices chatChoiceResponse = new Choices();
                                                chatChoiceResponse.index = item.Index.Value;
                                                DeltaContent delta = new DeltaContent();
                                                if (item.Delta != null)
                                                {
                                                    delta.Content = item.Delta.Content;
                                                    chatChoiceResponse.delta = delta;
                                                    output += item.Delta.Content;
                                                }
                                                chatChoices.Add(chatChoiceResponse);
                                            }
                                            chatCompletionResponse.Choices = chatChoices;
                                            await _financeService.CreateUseLogAndUpadteMoney(Account, chatSession.Model, tikToken.Encode(input).Count, tikToken.Encode(output).Count);
                                            return Ok(chatCompletionResponse);
                                        }
                                    }
                                }
                            }
                        }
                        else
                        {
                            ChatCompletionResponse chatCompletionResponse = new ChatCompletionResponse();
                            chatCompletionResponse.Id = completionResult.Id;
                            chatCompletionResponse.Object = completionResult.ObjectTypeName;
                            chatCompletionResponse.Model = completionResult.Model;
                            chatCompletionResponse.system_fingerprint = completionResult.SystemFingerPrint;
                            List<Choices> chatChoices = new List<Choices>();
                            foreach (var item in completionResult.Choices)
                            {
                                Choices chatChoiceResponse = new Choices();
                                chatChoiceResponse.index = item.Index.Value;
                                DeltaContent delta = new DeltaContent();
                                if (item.Delta != null)
                                {
                                    delta.Content = item.Delta.Content;
                                    chatChoiceResponse.delta = delta;
                                    output += item.Delta.Content;
                                }
                                chatChoices.Add(chatChoiceResponse);
                            }
                            chatCompletionResponse.Choices = chatChoices;
                            await _financeService.CreateUseLogAndUpadteMoney(Account, chatSession.Model, tikToken.Encode(input).Count, tikToken.Encode(output).Count);
                            return Ok(chatCompletionResponse);
                        }
                    }
                }
                throw new Exception("Error");
            }
            catch (Exception e)
            {
                throw e;
            }

        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> GetOpenAPISetting()
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var result = await _workShop.GetOpenAPIModelSetting(username);
            return Ok(new { success = true, msg = "Success", data = result });
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> SaveOpenAPISetting([FromForm] List<OpenAPIModelSetting> openAPIModelSettings)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            bool result = await _workShop.SaveOpenAPIModelSetting(username, openAPIModelSettings);
            return Ok(new { success = result });
        }
    }
}
