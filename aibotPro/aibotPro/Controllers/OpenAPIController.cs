using System.Text;
using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using OpenAI;
using OpenAI.Builders;
using OpenAI.Managers;
using OpenAI.ObjectModels.RequestModels;
using OpenAI.ObjectModels.SharedModels;
using TiktokenSharp;
using LogLevel = aibotPro.Dtos.LogLevel;

namespace aibotPro.Controllers;

public class OpenAPIController : Controller
{
    private readonly IAiServer _aiServer;
    private readonly IBaiduService _baiduService;
    private readonly AIBotProContext _context;
    private readonly IFinanceService _financeService;
    private readonly JwtTokenManager _jwtTokenManager;
    private readonly IOpenAPIService _openAPIService;
    private readonly IRedisService _redisService;
    private readonly ISystemService _systemService;
    private readonly IWorkShop _workShop;

    public OpenAPIController(ISystemService systemService, IRedisService redisService, IWorkShop workShop,
        JwtTokenManager jwtTokenManager, AIBotProContext context, IFinanceService financeService,
        IBaiduService baiduService, IAiServer aiServer, IOpenAPIService openAPIService)
    {
        _systemService = systemService;
        _redisService = redisService;
        _workShop = workShop;
        _jwtTokenManager = jwtTokenManager;
        _context = context;
        _financeService = financeService;
        _baiduService = baiduService;
        _aiServer = aiServer;
        _openAPIService = openAPIService;
    }

    [Authorize]
    [HttpPost]
    public IActionResult CreateApiKey()
    {
        //创建一个以sk-开头的随机字符串
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var apiKey = "sk-" +
                     _systemService.ConvertToMD5(username + DateTime.Now.ToString("yyyyMMddHHmmss"), 32, true);
        //将API Key存入数据库,已存在则更新
        var result = _context.APIKEYs.Where(x => x.Account == username).FirstOrDefault();
        if (result == null)
            _context.APIKEYs.Add(new APIKEY { Account = username, ApiKey1 = apiKey });
        else
            result.ApiKey1 = apiKey;

        //更新SystemPlugins表
        var systemPlugins = _context.SystemPlugins.Where(x => x.Account == username).ToList();
        foreach (var item in systemPlugins) item.ApiKey = apiKey;

        _context.SaveChanges();
        return Ok(new { success = true, msg = "Success", data = apiKey });
    }

    [Authorize]
    [HttpPost]
    public IActionResult GetApiKey()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var result = _context.APIKEYs.Where(x => x.Account == username).FirstOrDefault();
        if (result == null)
            return Ok(new { success = false, msg = "No API Key" });
        return Ok(new { success = true, msg = "Success", data = result.ApiKey1 });
    }

    [Authorize]
    [HttpPost]
    public IActionResult UpdateSystemPlugin(string Pfunctionname, string type)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var apikeys = _context.APIKEYs.Where(x => x.Account == username).FirstOrDefault();
        if (apikeys == null) return Ok(new { success = false, msg = "请先创建APIKEY" });

        var apikey = apikeys.ApiKey1;
        if (type == "add")
        {
            //判断这个插件是否已经存在
            var result = _context.SystemPlugins
                .Where(x => x.Account == username && x.Pfunctionname == Pfunctionname).FirstOrDefault();
            if (result == null)
                _context.SystemPlugins.Add(new SystemPlugin
                    { Account = username, ApiKey = apikey, Pfunctionname = Pfunctionname });
        }
        else if (type == "remove")
        {
            var result = _context.SystemPlugins
                .Where(x => x.Account == username && x.Pfunctionname == Pfunctionname).FirstOrDefault();
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
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var result = _context.SystemPlugins.Where(x => x.Account == username).ToList();
        return Ok(new { success = true, msg = "Success", data = result });
    }

    [Authorize(Policy = "APIOnly")]
    [HttpPost]
    [Route("/v1/chat/completions")]
    public async Task<IActionResult> Completions()
    {
        //获取Authorize的API Key
        var apiKey = Request
            .Headers["Authorization"]
            .ToString()
            .Replace("Bearer ", "");
        //根据APIKEY查询用户账号
        var Account = _context.APIKEYs.Where(x => x.ApiKey1 == apiKey).FirstOrDefault().Account;
        var user = _context.Users.AsNoTracking().Where(x => x.Account == Account).FirstOrDefault();
        string jsonBody;
        using (var reader = new StreamReader(Request.Body, Encoding.UTF8))
        {
            jsonBody = await reader.ReadToEndAsync();
        }

        var chatSession = JsonConvert.DeserializeObject<ChatSession>(jsonBody);
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
        var isVip = await _financeService.IsVip(Account);
        var shouldCharge = !isVip && modelPrice != null &&
                           (modelPrice.VipModelPriceInput > 0 || modelPrice.ModelPriceOutput > 0);

        //不是会员且余额为0时不提供服务
        if (!isVip && user.Mcoin <= 0) return Ok("本站已停止向【非会员且余额为0】的用户提供服务，您可以前往充值1元及以上，长期使用本站的免费服务");

        // 检查用户余额是否不足，只有在需要收费时检查
        if (shouldCharge && user.Mcoin <= 0) return Ok("余额不足，请充值后再使用，您可以前往充值");

        //记录系统使用日志
        await _systemService.WriteLog($"用户调用API：{chatSession.Model}", LogLevel.Info, Account);
        var aImodels = new List<WorkShopAIModel>();
        var defaultAiModels = new List<AImodel>();
        aImodels = _systemService.GetWorkShopAImodel();
        defaultAiModels = _systemService.GetAImodel();
        if (aImodels == null || aImodels.Count == 0) return Ok("工坊模型未定义");
        if (defaultAiModels == null || defaultAiModels.Count == 0) return Ok("基础模型未定义");
        var defaultModel = false;
        var useModel = aImodels.Where(x => x.ModelName == chatSession.Model).FirstOrDefault();
        var usedefaultModel = defaultAiModels.Where(x => x.ModelName == chatSession.Model).FirstOrDefault();
        if (useModel == null && usedefaultModel == null)
            return Ok("模型不存在");

        //var useModel = aImodels.Where(x => x.ModelName == chatSession.Model).FirstOrDefault();
        var openAiOptions = new OpenAiOptions();
        if (useModel != null)
        {
            openAiOptions.BaseDomain = aImodels.Where(x => x.ModelName == chatSession.Model).FirstOrDefault().BaseUrl;
            openAiOptions.ApiKey = aImodels.Where(x => x.ModelName == chatSession.Model).FirstOrDefault().ApiKey;
        }
        else
        {
            openAiOptions.BaseDomain =
                defaultAiModels.Where(x => x.ModelName == chatSession.Model).FirstOrDefault().BaseUrl;
            openAiOptions.ApiKey = defaultAiModels.Where(x => x.ModelName == chatSession.Model).FirstOrDefault().ApiKey;
            defaultModel = true;
        }

        var openAiService = new OpenAIService(openAiOptions);
        //将ChatSession转换为OpenAI的ChatSession
        var chatMessages = new List<ChatMessage>();
        var input = string.Empty;
        var output = string.Empty;
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

        var chatCompletionCreate = new ChatCompletionCreateRequest();
        chatCompletionCreate.Messages = chatMessages;
        var mytools = new List<ToolDefinition>();
        var channel = "OpenAI";
        if (!defaultModel)
        {
            //初始化系统函数
            var fnDall = new FunctionDefinitionBuilder("use_dalle3_withpr", "结合上下文生成DALL-E3提示词并绘制")
                .AddParameter("drawprompt", PropertyDefinition.DefineString("根据绘画要求，结合上下文优化后的DALL-E3绘画提示词"))
                .AddParameter("drawsize",
                    PropertyDefinition.DefineEnum(new List<string> { "1024x1024", "1792x1024", "1024x1792" },
                        "需要绘制的图片尺寸,默认1024x1024"))
                .AddParameter("quality",
                    PropertyDefinition.DefineEnum(new List<string> { "standard", "hd" },
                        "绘制图片的质量，默认standard标准质量，当许要更高清晰度和更多细节时，使用hd质量"))
                .Validate()
                .Build();
            var fnGoogleSearch = new FunctionDefinitionBuilder("search_google_when_gpt_cannot_answer",
                    "当 gpt 遇到无法回答的或者需要搜索引擎协助回答时从 google 搜索")
                .AddParameter("message", PropertyDefinition.DefineString("搜索句，支持中文或者英文"))
                .Validate()
                .Build();
            var sysKnowledgeSearch = new FunctionDefinitionBuilder("search_knowledge_base", "从知识库中查询或搜索GPT无法得知的内容")
                .AddParameter("message", PropertyDefinition.DefineString("搜索用的关键词，支持中文或者英文"))
                .Validate()
                .Build();
            //查询系统插件
            var systemPlugins = _context.SystemPlugins.Where(x => x.ApiKey == apiKey).ToList();
            foreach (var plugin in systemPlugins)
                if (plugin.Pfunctionname == "use_dalle3_withpr")
                    mytools.Add(ToolDefinition.DefineFunction(fnDall));
                else if (plugin.Pfunctionname == "search_google_when_gpt_cannot_answer")
                    mytools.Add(ToolDefinition.DefineFunction(fnGoogleSearch));
                else if (plugin.Pfunctionname == "search_knowledge_base")
                    mytools.Add(ToolDefinition.DefineFunction(sysKnowledgeSearch));

            //获取用户插件列表
            var myplugins = _workShop.GetPluginInstall(Account);
            if (myplugins != null && myplugins.Count > 0)
                foreach (var pluginitem in myplugins)
                {
                    var functionDefinition = new FunctionDefinition();
                    var myfn = new FunctionDefinitionBuilder(pluginitem.Pfunctionname, pluginitem.Pfunctioninfo);
                    //如果是工作流
                    if (pluginitem.Pcodemodel == "plugin-workflow")
                    {
                        //获取工作流节点数据
                        var nodeData = _context.WorkFlows.Where(x => x.Pcode == pluginitem.Pcode).FirstOrDefault()
                            .FlowJson;
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
                                    myfn.AddParameter(prItem.PrName, PropertyDefinition.DefineString(prItem.PrInfo));
                        }
                    }
                    else
                    {
                        var myparams = _workShop.GetPluginParams(pluginitem.Id);
                        if (myparams != null && myparams.Count > 0)
                            foreach (var paramitem in myparams)
                                myfn.AddParameter(paramitem.ParamName,
                                    PropertyDefinition.DefineString(paramitem.ParamInfo));
                    }

                    functionDefinition = myfn.Validate().Build();
                    mytools.Add(ToolDefinition.DefineFunction(functionDefinition));
                }

            if (mytools.Count > 0)
                chatCompletionCreate.Tools = mytools;
            channel = useModel.Channel;
        }

        chatCompletionCreate.Model = chatSession.Model;
        try
        {
            if (chatSession.Stream)
            {
                chatCompletionCreate.Stream = true;
                var pluginResDto = new PluginResDto();
                var tikToken = TikToken.GetEncoding("cl100k_base");
                //流式输出
                var response = Response;
                response.Headers.Add("Content-Type", "text/event-stream;charset=utf-8");
                response.Headers.Add("Cache-Control", "no-cache");
                response.Headers.Add("Connection", "keep-alive");
                if (channel == "ERNIE")
                {
                    var pairs = await _openAPIService.CallERNIEAsStream(response,
                        chatCompletionCreate, openAiOptions, useModel, Account);
                    input += string.Join(", ", pairs.Keys);
                    output += string.Join(", ", pairs.Values);
                }
                else
                {
                    var pairs =
                        await _openAPIService.CallOpenAIAsStream(response, chatCompletionCreate, openAiService,
                            Account);
                    input += string.Join(", ", pairs.Keys);
                    output += string.Join(", ", pairs.Values);
                }

                await _financeService.CreateUseLogAndUpadteMoney(Account, chatSession.Model,
                    tikToken.Encode(input).Count, tikToken.Encode(output).Count);
                return new EmptyResult();
            }
            else
            {
                chatCompletionCreate.Stream = false;
                var pluginResDto = new PluginResDto();
                var tikToken = TikToken.GetEncoding("cl100k_base");
                var completionResult = new ChatCompletionResponseUnStream();
                if (channel == "ERNIE")
                {
                    completionResult =
                        await _openAPIService.CallERNIE(chatCompletionCreate, openAiOptions, useModel, Account);
                    output += completionResult.Choices[0].message.Content;
                }
                else
                {
                    completionResult =
                        await _openAPIService.CallOpenAI(chatCompletionCreate, openAiService, Account);
                    output += completionResult.Choices[0].message.Content;
                }

                await _financeService.CreateUseLogAndUpadteMoney(Account, chatSession.Model,
                    tikToken.Encode(input).Count, tikToken.Encode(output).Count);
                return Ok(completionResult);
            }
        }
        catch (Exception e)
        {
            await _systemService.WriteLog(e.Message, LogLevel.Error, "system");
            return Ok(e.Message);
        }
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> GetOpenAPISetting()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var result = await _workShop.GetOpenAPIModelSetting(username);
        return Ok(new { success = true, msg = "Success", data = result });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> SaveOpenAPISetting([FromForm] List<OpenAPIModelSetting> openAPIModelSettings)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var result = await _workShop.SaveOpenAPIModelSetting(username, openAPIModelSettings);
        return Ok(new { success = result });
    }
}