using aibotPro.AppCode;
using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using iTextSharp.text.pdf.qrcode;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Build.Evaluation;
using Microsoft.CodeAnalysis;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Newtonsoft.Json;
using NuGet.Configuration;
using OpenAI;
using OpenAI.Builders;
using OpenAI.Managers;
using OpenAI.ObjectModels.RequestModels;
using OpenAI.ObjectModels.SharedModels;
using Spire.Presentation.Charts;
using System.Collections.Concurrent;
using System.Security.Policy;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using TiktokenSharp;
using static OpenAI.ObjectModels.StaticValues;

namespace aibotPro.Service
{
    public class ChatHub : Hub
    {
        private readonly JwtTokenManager _jwtTokenManager;
        private readonly IUsersService _usersService;
        private readonly ISystemService _systemService;
        private readonly IRedisService _redis;
        private readonly IAiServer _aiServer;
        private readonly IBaiduService _baiduService;
        private readonly IWorkShop _workShop;
        private readonly IFilesAIService _filesAIService;
        private readonly AIBotProContext _context;
        private readonly IFinanceService _financeService;
        private readonly IAssistantService _assistantService;
        private readonly ChatCancellationManager _chatCancellationManager;
        public ChatHub(JwtTokenManager jwtTokenManager, IUsersService usersService, ISystemService systemService, IRedisService redisService, IAiServer aiServer, IBaiduService baiduService, IWorkShop workShop, IFilesAIService filesAIService, AIBotProContext context, IFinanceService financeService, IAssistantService assistantService, ChatCancellationManager chatCancellationManager)
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
        }
        //基础对话模型交互
        public async Task SendMessage(ChatDto chatDto)
        {
            var httpContext = Context.GetHttpContext();
            string? token = string.Empty;
            token = httpContext?.Request.Query["access_token"];
            if (string.IsNullOrEmpty(token) || !_jwtTokenManager.isTokenValid(token) || string.IsNullOrEmpty(chatDto.ip))
            {
                // 如果没有令牌或者令牌无效或者ip为空，则断开连接
                Context.Abort();
                return;
            }
            //从token中获取账号信息
            string Account = string.Empty;
            if (!chatDto.isbot)
                Account = _jwtTokenManager.ValidateToken(token).Identity.Name;
            else
                Account = "robot_AIBOT";
            string chatId = string.Empty;
            bool newChat = false;
            if (string.IsNullOrEmpty(chatDto.chatid))
            {
                chatId = Guid.NewGuid().ToString().Replace("-", "");//创建chatid头部
                chatId = $"{chatId}U{Account}IP{chatDto.ip}";
                newChat = true;
            }
            else
                chatId = chatDto.chatid;
            await Groups.AddToGroupAsync(Context.ConnectionId, chatId);
            ChatRes chatRes = new ChatRes();
            chatRes.chatid = chatId;
            string senMethod = "ReceiveMessage";
            if (chatDto.isbot)
                senMethod = "ReceiveMessage_bot";
            //回应客户端就绪状态
            await Clients.Group(chatId).SendAsync(senMethod, chatRes);
            bool isVisionModel = false;
            bool useMyKey = false;
            string imgTxt = string.Empty;
            string imgRes = string.Empty;
            string promptHeadle = chatDto.msg;
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
                APISetting apiSetting = new APISetting();
                List<AImodel> aImodels = new List<AImodel>();
                int delay = 0;
                if (chatSetting != null && chatSetting.MyChatModel != null && chatSetting.MyChatModel.Count > 0)
                {
                    foreach (var item in chatSetting.MyChatModel)
                    {
                        AImodel aiModel = new AImodel();
                        aiModel.ModelNick = item.ChatNickName;
                        aiModel.ModelName = item.ChatModel;
                        aiModel.BaseUrl = item.ChatBaseURL;
                        aiModel.ApiKey = item.ChatApiKey;
                        aiModel.VisionModel = item.VisionModel;
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
                        }
                        else
                            throw new Exception($"系统未配置{chatDto.aiModel}模型，请联系管理员");
                    }
                    else
                        throw new Exception("系统未配置任何模型，请联系管理员");
                }
                //生成AI请求参数
                string input = string.Empty;
                string output = string.Empty;
                AiChat aiChat = new AiChat();
                VisionBody visionBody = new VisionBody();
                aiChat.Stream = true;
                VisionImg visionImg = new VisionImg();
                if (chatDto.useMemory)
                {
                    var memory = await _aiServer.GetMemory("text-embedding-3-small", Account, promptHeadle);
                    if (memory != null && memory.Data != null)
                    {
                        chatDto.system_prompt = "我会使用数据库存储用户需要保留的历史记忆，以下是系统历史记忆,如果用户有需要可以取用：\n";
                        foreach (var item in memory.Data)
                        {
                            chatDto.system_prompt += $"{item.VectorContent} \n";
                        }
                    }
                }
                //如果有图片
                if (!string.IsNullOrEmpty(chatDto.image_path))
                {
                    //检查图片是路径还是链接
                    string urlPattern = @"^(http|https)://";
                    // 检查输入字符串是否匹配正则表达式
                    bool isUrl = Regex.IsMatch(chatDto.image_path, urlPattern, RegexOptions.IgnoreCase);
                    if (!isVisionModel)
                    {
                        if (!isUrl)
                            chatDto.image_path = "wwwroot" + chatDto.image_path;
                        string imageData = await _systemService.ImgConvertToBase64(chatDto.image_path);
                        imgTxt = _baiduService.GetText(imageData);
                        imgRes = _baiduService.GetRes(imageData);
                        promptHeadle = $"请你充当图片内容分析师，图像中的文字识别结果为：{imgTxt},图像中物体和场景识别结果为：{imgRes},请根据识别结果进行专业的分析回答:{promptHeadle}";
                    }
                    if (chatDto.aiModel == "gpt-4-all")
                    {
                        if (isUrl)
                            promptHeadle = $"{chatDto.msg}\n\n图片链接：{chatDto.image_path}".Replace("\\", "/");
                        else
                            promptHeadle = $"{chatDto.msg}\n\n图片链接：{Context.GetHttpContext().Request.Scheme}://{systemCfg.Where(x => x.CfgCode == "Domain").FirstOrDefault().CfgValue}{chatDto.image_path.Replace("wwwroot", "")}".Replace("\\", "/");
                    }
                    else
                    {
                        if (isUrl)
                        {
                            visionImg.url = chatDto.image_path;
                        }
                        else
                        {
                            string imgBase64 = await _systemService.ImgConvertToBase64(chatDto.image_path);
                            string dataHeader = "data:image/jpeg;base64,";
                            visionImg.url = dataHeader + imgBase64;//$"{Context.GetHttpContext().Request.Scheme}://{systemCfg.Where(x => x.CfgCode == "Domain").FirstOrDefault().CfgValue}{chatDto.image_path.Replace("wwwroot", "")}".Replace("\\", "/");
                        }
                    }
                }
                if (string.IsNullOrEmpty(chatDto.image_path) && chatDto.aiModel == "gemini-pro-vision")
                    chatDto.aiModel = "gemini-pro";
                if (chatDto.file_list != null && chatDto.file_list.Count > 0)
                {
                    string fileContent = await _filesAIService.PromptFromFiles(chatDto.file_list, Account);
                    if (chatDto.aiModel == "gpt-4-all")
                    {
                        for (int i = 0; i < chatDto.file_list.Count; i++)
                        {
                            chatDto.system_prompt += $"# 文件地址{i + 1}：{Context.GetHttpContext().Request.Scheme}://{systemCfg.Where(x => x.CfgCode == "Domain").FirstOrDefault().CfgValue}{chatDto.file_list[i].Replace("wwwroot", "")} \n";
                        }
                        chatDto.system_prompt += "\n 请根据上述文件回答";
                        input += fileContent;
                    }
                    else
                    {
                        promptHeadle = $"文件内容：{fileContent}\n\n{promptHeadle}";
                    }
                }
                input += promptHeadle;
                visionBody.model = chatDto.aiModel;
                aiChat.Model = chatDto.aiModel;
                List<VisionChatMesssage> tmpmsg_v = new List<VisionChatMesssage>();
                List<Message> messages = new List<Message>();
                if (chatDto.chatid.Contains("gridview"))
                    newChat = true;
                if (newChat)
                {
                    if (!isVisionModel)
                    {
                        //如果是新对话直接填充用户输入
                        Message message = new Message();
                        if (!string.IsNullOrEmpty(chatDto.system_prompt))
                        {
                            message.Role = "system";
                            message.Content = chatDto.system_prompt;
                            messages.Add(message);
                            input += chatDto.system_prompt;
                        }
                        message = new Message();
                        message.Role = "user";
                        message.Content = promptHeadle;
                        messages.Add(message);
                    }
                    else
                    {

                        //Vision
                        VisionChatMesssage promptvisionChatMesssage = new VisionChatMesssage();
                        List<VisionContent> promptcontent = new List<VisionContent>();
                        VisionContent promptvisionContent = new VisionContent();

                        // 系统提示部分
                        if (!string.IsNullOrEmpty(chatDto.system_prompt) && chatDto.aiModel != "gemini-pro-vision")
                        {
                            promptvisionChatMesssage.role = "system";
                            promptvisionContent.text = chatDto.system_prompt;
                            promptcontent.Add(promptvisionContent);
                            promptvisionChatMesssage.content = promptcontent;
                            tmpmsg_v.Add(promptvisionChatMesssage);
                            input += chatDto.system_prompt;

                            // 重置为用户消息
                            promptvisionChatMesssage = new VisionChatMesssage();
                            promptcontent = new List<VisionContent>();
                            promptvisionContent = new VisionContent();
                        }

                        // 用户消息部分
                        promptvisionChatMesssage.role = "user";
                        promptvisionContent.text = promptHeadle;
                        promptcontent.Add(promptvisionContent);

                        // 添加图片，如果存在
                        if (!string.IsNullOrEmpty(chatDto.image_path))
                        {
                            promptvisionContent = new VisionContent();
                            promptvisionContent.type = "image_url";
                            promptvisionContent.image_url = visionImg;
                            promptcontent.Add(promptvisionContent);
                        }

                        promptvisionChatMesssage.content = promptcontent;
                        tmpmsg_v.Add(promptvisionChatMesssage);
                    }

                }
                else
                {
                    //否则查询历史记录
                    int historyCount = 5;//默认5
                    if (chatSetting.SystemSetting.HistoryCount != 5)
                        historyCount = chatSetting.SystemSetting.HistoryCount;
                    List<ChatHistory> chatHistories = _aiServer.GetChatHistories(Account, chatId, historyCount);
                    //遍历填充历史记录
                    bool systemPromptAdded = false;  // 添加一个标志来控制系统提示词是否已填充

                    foreach (var item in chatHistories)
                    {
                        input += item.Chat;
                        if (!isVisionModel)
                        {
                            Message message = new Message();
                            if (!systemPromptAdded && !string.IsNullOrEmpty(chatDto.system_prompt))
                            {
                                message.Role = "system";
                                message.Content = chatDto.system_prompt;
                                messages.Add(message);
                                input += chatDto.system_prompt;
                                systemPromptAdded = true;  // 更新标志状态，表明系统提示词已经添加
                            }
                            message = new Message();
                            message.Role = item.Role;
                            message.Content = item.Chat;
                            messages.Add(message);
                        }
                        else
                        {
                            // Vision
                            VisionChatMesssage hisvisionChatMesssage = new VisionChatMesssage();
                            List<VisionContent> hiscontent = new List<VisionContent>();
                            VisionContent hisvisionContent = new VisionContent();
                            if (!systemPromptAdded && !string.IsNullOrEmpty(chatDto.system_prompt) && chatDto.aiModel != "gemini-pro-vision")
                            {
                                hisvisionChatMesssage.role = "system";
                                hisvisionContent.text = chatDto.system_prompt;
                                hiscontent.Add(hisvisionContent);
                                hisvisionChatMesssage.content = hiscontent;
                                tmpmsg_v.Add(hisvisionChatMesssage);
                                input += chatDto.system_prompt;
                                systemPromptAdded = true;  // 更新标志状态
                            }
                            hisvisionChatMesssage = new VisionChatMesssage();
                            if (item.Chat.Contains("aee887ee6d5a79fdcmay451ai8042botf1443c04"))
                            {
                                hisvisionContent = new VisionContent();
                                // 分割文本和图片
                                string[] parts = item.Chat.Split(new string[] { "aee887ee6d5a79fdcmay451ai8042botf1443c04" }, StringSplitOptions.None);

                                // 提取并填充文本内容
                                if (parts.Length > 0)
                                {
                                    VisionContent textContent = new VisionContent();
                                    textContent.type = "text";
                                    textContent.text = parts[0];
                                    hiscontent.Add(textContent);
                                }

                                // 提取并填充图片内容
                                if (parts.Length > 1)
                                {
                                    const string pattern = @"<img.+?src=[""'](.*?)[""'].*?>";
                                    Regex regex = new Regex(pattern, RegexOptions.IgnoreCase);
                                    Match match = regex.Match(parts[1]);

                                    if (match.Success)
                                    {
                                        VisionImg visionImg1 = new VisionImg();
                                        visionImg1.url = match.Groups[1].Value;
                                        hisvisionContent.image_url = visionImg1;
                                        hisvisionContent.type = "image_url";
                                        hiscontent.Add(hisvisionContent);
                                    }
                                }
                            }
                            else
                            {
                                hisvisionContent = new VisionContent();
                                hisvisionContent.text = item.Chat;
                                hiscontent.Add(hisvisionContent);
                            }
                            hisvisionChatMesssage.role = item.Role;
                            hisvisionChatMesssage.content = hiscontent;
                            tmpmsg_v.Add(hisvisionChatMesssage);
                        }
                    }
                    if (!isVisionModel)
                    {
                        //填充用户输入
                        Message message1 = new Message();
                        message1.Role = "user";
                        message1.Content = promptHeadle;
                        messages.Add(message1);
                    }
                    else
                    {
                        //Vision
                        VisionChatMesssage promptvisionChatMesssage = new VisionChatMesssage();
                        List<VisionContent> promptcontent = new List<VisionContent>();
                        VisionContent promptvisionContent = new VisionContent();
                        promptvisionContent.text = promptHeadle;
                        promptcontent.Add(promptvisionContent);
                        if (!string.IsNullOrEmpty(chatDto.image_path))
                        {
                            promptvisionContent = new VisionContent();
                            promptvisionContent.type = "image_url";
                            promptvisionContent.image_url = visionImg;
                            promptcontent.Add(promptvisionContent);
                        }
                        promptvisionChatMesssage.role = "user";
                        promptvisionChatMesssage.content = promptcontent;
                        tmpmsg_v.Add(promptvisionChatMesssage);
                    }

                }
                aiChat.Messages = messages;
                visionBody.messages = tmpmsg_v.ToArray();
                if (!isVisionModel)
                    visionBody = null;
                //准备调用AI接口，缓存存入工作中状态
                var (semaphore, cancellationToken) = _chatCancellationManager.GetOrCreateToken(chatDto.chatgroupid);
                string sysmsg = string.Empty;
                try
                {
                    await foreach (var responseContent in _aiServer.CallingAI(aiChat, apiSetting, chatDto.chatgroupid, visionBody, cancellationToken))
                    {
                        if (semaphore.CurrentCount == 0)
                        {
                            // 被取消
                            break;
                        }
                        sysmsg += responseContent.Choices[0].Delta.Content;
                        chatRes.message = responseContent.Choices[0].Delta.Content;
                        await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                        Thread.Sleep(delay);
                    }
                }
                catch (OperationCanceledException)
                {
                    //await _systemService.WriteLog("输出取消", Dtos.LogLevel.Info, Account); //输出取消
                }
                finally
                {
                    _chatCancellationManager.RemoveToken(chatDto.chatgroupid);
                    //保存对话记录
                    if (!string.IsNullOrEmpty(chatDto.image_path))
                    {
                        chatDto.msg += $@"aee887ee6d5a79fdcmay451ai8042botf1443c04<br /><img src=""{chatDto.image_path.Replace("wwwroot", "")}"" style=""max-width:50%;"" />";
                    }
                    output = sysmsg;
                    TikToken tikToken = TikToken.GetEncoding("cl100k_base");
                    if (chatDto.chatid.Contains("gridview"))
                    {
                        sysmsg = sysmsg.ToLower();
                        if (sysmsg.Contains("```json"))
                        {
                            sysmsg = sysmsg.Split("```json")[1];
                            if (sysmsg.Contains("```"))
                            {
                                sysmsg = sysmsg.Split("```")[0];
                            }
                        }
                        if (sysmsg.Contains("$schema"))
                        {
                            chatRes.message = $@"var spec = {sysmsg};
                                            vegaEmbed('.vis', spec)
                                                .then(result => console.log(result))
                                                .catch(error => console.error(error))";
                            //await Clients.Group(chatId).SendAsync(senMethod, JsonConvert.SerializeObject(hubRes));
                            chatRes.jscode = chatRes.message;//newFileName;
                            await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                        }
                    }
                    await _aiServer.SaveChatHistory(Account, chatId, chatDto.msg, chatDto.msgid_u, chatDto.chatgroupid, "user", chatDto.aiModel);
                    await _aiServer.SaveChatHistory(Account, chatId, sysmsg, chatDto.msgid_g, chatDto.chatgroupid, "assistant", chatDto.aiModel);
                    chatRes.message = "";
                    chatRes.isfinish = true;
                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    if (!string.IsNullOrEmpty(output))
                        await _financeService.CreateUseLogAndUpadteMoney(Account, chatDto.aiModel, tikToken.Encode(input).Count, tikToken.Encode(output).Count);
                }
            }
            catch (Exception e)
            {
                await _redis.DeleteAsync($"{chatId}_process");
                chatRes.message = $"糟糕！出错了！错误原因：【{e.Message}】,刷新页面或重试一次吧😢";
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                chatRes.message = "";
                chatRes.isfinish = true;
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                return;
            }
        }

        //创意工坊交互
        public async Task SendWorkShopMessage(ChatDto chatDto, bool onknowledge, List<string> typeCode)
        {
            var httpContext = Context.GetHttpContext();
            string? token = string.Empty;
            token = httpContext?.Request.Query["access_token"];
            if (string.IsNullOrEmpty(token) || !_jwtTokenManager.isTokenValid(token) || string.IsNullOrEmpty(chatDto.ip))
            {
                // 如果没有令牌或者令牌无效或者ip为空，则断开连接
                Context.Abort();
                return;
            }
            //从token中获取账号信息
            string Account = string.Empty;
            if (!chatDto.isbot)
                Account = _jwtTokenManager.ValidateToken(token).Identity.Name;
            else
                Account = "robot_AIBOT";
            var user = _usersService.GetUserData(Account);
            string chatId = string.Empty;
            bool newChat = false;
            if (string.IsNullOrEmpty(chatDto.chatid))
            {
                chatId = Guid.NewGuid().ToString().Replace("-", "");//创建chatid头部
                chatId = $"{chatId}U{Account}IP{chatDto.ip}";
                newChat = true;
            }
            else
                chatId = chatDto.chatid;
            await Groups.AddToGroupAsync(Context.ConnectionId, chatId);
            ChatRes chatRes = new ChatRes();
            chatRes.chatid = chatId;
            string senMethod = "ReceiveWorkShopMessage";
            if (chatDto.isbot)
                senMethod = "ReceiveWorkShopMessage_bot";
            //回应客户端就绪状态
            await Clients.Group(chatId).SendAsync(senMethod, chatRes);
            string imgTxt = string.Empty;
            string imgRes = string.Empty;
            string input = string.Empty;
            string output = string.Empty;
            string promptHeadle = chatDto.msg;
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
                APISetting apiSetting = new APISetting();
                int delay = 0;
                List<WorkShopAIModel> aImodels = new List<WorkShopAIModel>();
                //获取模型设置
                aImodels = _systemService.GetWorkShopAImodel();
                OpenAiOptions openAiOptions = new OpenAiOptions();
                bool? visionModel = false;
                string channel = "OpenAI";
                if (aImodels != null)
                {
                    var useModel = aImodels.Where(x => x.ModelName == chatDto.aiModel).FirstOrDefault();
                    if (useModel != null)
                    {
                        openAiOptions.BaseDomain = useModel.BaseUrl;
                        openAiOptions.ApiKey = useModel.ApiKey;
                        if (useModel.VisionModel.HasValue)
                            visionModel = useModel.VisionModel;
                        if (useModel.Delay.HasValue && useModel.Delay.Value >= 0)
                            delay = useModel.Delay.Value;
                        if (!string.IsNullOrEmpty(useModel.Channel))
                            channel = useModel.Channel;
                    }
                    else
                        throw new Exception($"系统未配置{chatDto.aiModel}模型，请联系管理员");
                }
                else
                    throw new Exception("系统未配置任何模型，请联系管理员");
                var openAiService = new OpenAIService(openAiOptions);
                var systemPluginsInstallList = await _workShop.GetSystemPluginsInstall(Account);
                var mytools = new List<ToolDefinition>();
                List<PluginDto> myplugins = new List<PluginDto>();
                if (onknowledge)//知识库检索状态
                {
                    if (systemPluginsInstallList.Where(p => p.PluginName == "search_knowledge_base").FirstOrDefault() == null)
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
                    {
                        if (systemPluginsInstallList.Where(p => p.PluginName == "use_dalle3_withpr").FirstOrDefault() != null)
                            mytools.Add(ToolDefinition.DefineFunction(SystemPlugins.FnDall));
                    }
                    if (systemPluginsInstallList.Where(p => p.PluginName == "search_google_when_gpt_cannot_answer").FirstOrDefault() != null)
                        mytools.Add(ToolDefinition.DefineFunction(SystemPlugins.FnGoogleSearch));
                    //获取用户插件列表
                    if (string.IsNullOrEmpty(chatDto.chatfrom))
                        myplugins = _workShop.GetPluginInstall(Account);
                    else
                    {
                        myplugins = _workShop.GetPluginByTest(chatDto.chatfrom);
                    }
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
                                var nodeData = _context.WorkFlows.Where(x => x.Pcode == pluginitem.Pcode)
                                    .FirstOrDefault().FlowJson;
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
                                            switch (prItem.PrType)
                                            {
                                                case "String":
                                                    myfn.AddParameter(prItem.PrName, PropertyDefinition.DefineString(prItem.PrInfo));
                                                    break;
                                                case "Integer":
                                                    myfn.AddParameter(prItem.PrName, PropertyDefinition.DefineInteger(prItem.PrInfo));
                                                    break;
                                                case "Boolean":
                                                    myfn.AddParameter(prItem.PrName, PropertyDefinition.DefineBoolean(prItem.PrInfo));
                                                    break;
                                                case "Number":
                                                    myfn.AddParameter(prItem.PrName, PropertyDefinition.DefineNumber(prItem.PrInfo));
                                                    break;
                                                default:
                                                    myfn.AddParameter(prItem.PrName, PropertyDefinition.DefineString(prItem.PrInfo));
                                                    break;
                                            }
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
                                        switch (paramitem.ParamType)
                                        {
                                            case "String":
                                                myfn.AddParameter(paramitem.ParamName, PropertyDefinition.DefineString(paramitem.ParamInfo));
                                                break;
                                            case "Integer":
                                                myfn.AddParameter(paramitem.ParamName, PropertyDefinition.DefineInteger(paramitem.ParamInfo));
                                                break;
                                            case "Boolean":
                                                myfn.AddParameter(paramitem.ParamName, PropertyDefinition.DefineBoolean(paramitem.ParamInfo));
                                                break;
                                            case "Number":
                                                myfn.AddParameter(paramitem.ParamName, PropertyDefinition.DefineNumber(paramitem.ParamInfo));
                                                break;
                                            default:
                                                myfn.AddParameter(paramitem.ParamName, PropertyDefinition.DefineString(paramitem.ParamInfo));
                                                break;
                                        }
                                    }
                                }
                            }
                            functionDefinition = myfn.Validate().Build();
                            mytools.Add(ToolDefinition.DefineFunction(functionDefinition));
                        }
                    }
                    if (!chatDto.isbot)
                        chatDto.system_prompt = "如果用户的请求不清晰，可以要求澄清，也询问用户以明确是否需要调用函数。";
                }
                List<MessageContent> visionMessageContent = new List<MessageContent>();
                //如果有图片
                if (!string.IsNullOrEmpty(chatDto.image_path))
                {
                    string urlPattern = @"^(http|https)://";
                    // 检查输入字符串是否匹配正则表达式
                    bool isUrl = Regex.IsMatch(chatDto.image_path, urlPattern, RegexOptions.IgnoreCase);
                    string imageData = string.Empty;
                    if (visionModel.HasValue && visionModel.Value)
                    {
                        imageData = isUrl ? chatDto.image_path : await _systemService.ImgConvertToBase64(chatDto.image_path);
                        if (!isUrl) imageData = "data:image/jpeg;base64," + imageData;
                        visionMessageContent = new List<MessageContent>
                            {
                                MessageContent.TextContent(promptHeadle),
                                MessageContent.ImageUrlContent(
                                    imageData,
                                    ImageStatics.ImageDetailTypes.High
                                )
                            };
                    }
                    else
                    {
                        imageData = await _systemService.ImgConvertToBase64(chatDto.image_path);
                        imgTxt = _baiduService.GetText(imageData);
                        imgRes = _baiduService.GetRes(imageData);
                        promptHeadle = $"请你充当图片内容分析师，图像中的文字识别结果为：{imgTxt},图像中物体和场景识别结果为：{imgRes},请根据识别结果进行专业的分析回答:{promptHeadle}";
                    }
                }
                input += promptHeadle;
                List<ChatMessage> chatMessages = new List<ChatMessage>();
                chatMessages.Add(ChatMessage.FromSystem(chatDto.system_prompt));
                if (newChat)
                {
                    if (visionMessageContent.Count > 0)
                        chatMessages.Add(ChatMessage.FromUser(visionMessageContent));
                    else
                        chatMessages.Add(ChatMessage.FromUser(promptHeadle));
                }
                else
                {
                    //否则查询历史记录
                    int historyCount = 5;
                    List<ChatHistory> chatHistories = _aiServer.GetChatHistories(Account, chatId, historyCount);

                    //遍历填充历史记录
                    foreach (var item in chatHistories)
                    {
                        if (item.Chat.Contains("aee887ee6d5a79fdcmay451ai8042botf1443c04") && visionModel.HasValue && visionModel.Value)
                        {
                            string[] parts = item.Chat.Split(new string[] { "aee887ee6d5a79fdcmay451ai8042botf1443c04" }, StringSplitOptions.None);
                            // 提取并填充图片内容
                            if (parts.Length > 1)
                            {
                                const string pattern = @"<img.+?src=[""'](.*?)[""'].*?>";
                                Regex regex = new Regex(pattern, RegexOptions.IgnoreCase);
                                Match match = regex.Match(parts[1]);

                                if (match.Success)
                                {
                                    string imageUrl = match.Groups[1].Value;
                                    string urlPattern = @"^(http|https)://";
                                    // 检查输入字符串是否匹配正则表达式
                                    bool isUrl = Regex.IsMatch(imageUrl, urlPattern, RegexOptions.IgnoreCase);
                                    string imageData = isUrl ? imageUrl : await _systemService.ImgConvertToBase64(imageUrl);
                                    if (!isUrl) imageData = "data:image/jpeg;base64," + imageData;
                                    var hisvision = new List<MessageContent>();
                                    if (item.Role == "user")
                                    {
                                        var hisvisionMessageContent = new List<MessageContent>
                                        {
                                            MessageContent.TextContent(parts[0]),
                                            MessageContent.ImageUrlContent(
                                                imageData,
                                                ImageStatics.ImageDetailTypes.High
                                            )
                                        };
                                        // 添加图片内容
                                        chatMessages.Add(ChatMessage.FromUser(hisvisionMessageContent));
                                    }
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

                    if (visionMessageContent.Count > 0)
                        chatMessages.Add(ChatMessage.FromUser(visionMessageContent));
                    else
                        chatMessages.Add(ChatMessage.FromUser(promptHeadle));

                }
                ChatCompletionCreateRequest chatCompletionCreate = new ChatCompletionCreateRequest();
                chatCompletionCreate.Messages = chatMessages;
                if (mytools.Count > 0)
                    chatCompletionCreate.Tools = mytools;
                //插件选择
                var tool_choice = myplugins.Where(x => x.MustHit == true).FirstOrDefault();
                if (tool_choice != null)
                {
                    if (!onknowledge)
                    {
                        chatCompletionCreate.ToolChoice = new ToolChoice()
                        {
                            Type = "function",
                            Function = new ToolChoice.FunctionTool()
                            {
                                Name = tool_choice.Pfunctionname
                            }
                        };
                    }
                }
                chatCompletionCreate.Stream = true;
                chatCompletionCreate.Model = chatDto.aiModel;
                string sysmsg = string.Empty;
                TikToken tikToken = TikToken.GetEncoding("cl100k_base");
                var (semaphore, cancellationToken) = _chatCancellationManager.GetOrCreateToken(chatDto.chatgroupid);
                if (channel == "ERNIE")
                {
                    sysmsg = string.Empty;
                    BaiduResDto.FunctionCall fn = new BaiduResDto.FunctionCall();
                    try
                    {
                        await foreach (var responseContent in _baiduService.CallBaiduAI_Stream(chatCompletionCreate, openAiOptions, chatDto.chatgroupid, cancellationToken))
                        {
                            if (responseContent != null && !string.IsNullOrEmpty(responseContent.Result))
                            {
                                sysmsg += responseContent.Result;
                                output += responseContent.Result;
                                chatRes.message = responseContent.Result;
                                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                Thread.Sleep(delay);
                            }
                            fn = responseContent.Function_Call;
                        }
                        if (fn != null)
                        {
                            FunctionCall openaiFn = new FunctionCall();
                            _systemService.CopyPropertiesTo(fn, openaiFn);
                            PluginResDto pluginResDto = new PluginResDto();
                            var ctsemoji = new CancellationTokenSource();
                            _aiServer.ExecuteFunctionWithLoadingIndicators(fn.Name, chatId, senMethod, ctsemoji.Token);
                            pluginResDto = await _workShop.RunPlugin(Account, openaiFn, chatId, senMethod, typeCode);
                            if (!pluginResDto.doubletreating)
                            {
                                ctsemoji.Cancel();
                                sysmsg = await _aiServer.UnDoubletreating(pluginResDto, chatId, senMethod);
                            }
                            else
                            {
                                ctsemoji.Cancel();
                                chatMessages.Add(ChatMessage.FromAssistant(fn.Thoughts));
                                //生成对话参数
                                input += pluginResDto.result;
                                chatMessages.Add(ChatMessage.FromUser(pluginResDto.result));
                                chatCompletionCreate.Messages = chatMessages;
                                chatCompletionCreate.Tools = null;
                                chatCompletionCreate.ToolChoice = null;
                                chatCompletionCreate.Stream = true;
                                chatCompletionCreate.Model = chatDto.aiModel;
                                await foreach (var responseContent in _baiduService.CallBaiduAI_Stream(chatCompletionCreate, openAiOptions, chatDto.chatgroupid))
                                {
                                    if (responseContent != null && !string.IsNullOrEmpty(responseContent.Result))
                                    {
                                        sysmsg += responseContent.Result;
                                        output += responseContent.Result;
                                        chatRes.message = responseContent.Result;
                                        await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                        Thread.Sleep(delay);
                                    }
                                }
                            }
                            if (!string.IsNullOrEmpty(fn.Arguments))
                                output += fn.Arguments;
                        }
                    }
                    catch (OperationCanceledException)
                    {
                        //await _systemService.WriteLog("工坊ERNIE输出取消", Dtos.LogLevel.Info, Account); //输出取消

                    }
                    finally
                    {

                    }
                }
                else
                {
                    var completionResult = openAiService.ChatCompletion.CreateCompletionAsStream(chatCompletionCreate, chatCompletionCreate.Model, true, cancellationToken);
                    var functionArguments = new Dictionary<int, string>();
                    FunctionCall fn = new FunctionCall();
                    PluginResDto pluginResDto = new PluginResDto();
                    try
                    {
                        await foreach (var responseContent in completionResult.WithCancellation(cancellationToken))
                        {
                            if (responseContent.Successful)
                            {
                                var choice = responseContent.Choices.FirstOrDefault();
                                if (choice != null)
                                {
                                    if (choice.Message != null)
                                    {
                                        sysmsg += choice.Message.Content;
                                        output += choice.Message.Content;
                                        chatRes.message = choice.Message.Content;
                                        await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                        var tools = choice.Message.ToolCalls;
                                        if (tools != null)
                                        {
                                            //函数并行待定......
                                            //for (int i = 0; i < tools.Count; i++)
                                            //{
                                            //    var toolCall = tools[i];
                                            //    var fn = toolCall.FunctionCall;
                                            //    if (fn != null)
                                            //    {
                                            //        if (!string.IsNullOrEmpty(fn.Name))
                                            //        {
                                            //            pluginResDto = await _workShop.RunPlugin(Account, fn);
                                            //        }
                                            //    }
                                            //}
                                            var toolCall = tools[0];
                                            fn = toolCall.FunctionCall;
                                        }
                                        if (fn != null)
                                        {
                                            var ctsemoji = new CancellationTokenSource();
                                            if (!string.IsNullOrEmpty(fn.Name))
                                            {
                                                _aiServer.ExecuteFunctionWithLoadingIndicators(fn.Name, chatId, senMethod, ctsemoji.Token);
                                                pluginResDto = await _workShop.RunPlugin(Account, fn, chatId, senMethod, typeCode);
                                                if (!pluginResDto.doubletreating)
                                                {
                                                    ctsemoji.Cancel();
                                                    sysmsg = await _aiServer.UnDoubletreating(pluginResDto, chatId, senMethod);
                                                }
                                                //反馈GPT函数执行结果
                                                else
                                                {
                                                    ctsemoji.Cancel();
                                                    //生成对话参数
                                                    input += pluginResDto.result;
                                                    chatMessages.Add(ChatMessage.FromUser(pluginResDto.result));
                                                    chatCompletionCreate.Messages = chatMessages;
                                                    chatCompletionCreate.Tools = null;
                                                    chatCompletionCreate.ToolChoice = null;
                                                    chatCompletionCreate.Stream = true;
                                                    chatCompletionCreate.Model = chatDto.aiModel;
                                                    completionResult = openAiService.ChatCompletion.CreateCompletionAsStream(chatCompletionCreate, chatCompletionCreate.Model, true, cancellationToken);
                                                    await foreach (var responseContent_sec in completionResult.WithCancellation(cancellationToken))
                                                    {
                                                        if (responseContent_sec.Successful)
                                                        {
                                                            var choice_sec = responseContent_sec.Choices.FirstOrDefault();
                                                            if (choice_sec != null && choice_sec.Message != null)
                                                            {
                                                                sysmsg += choice_sec.Message.Content;
                                                                output += choice_sec.Message.Content;
                                                                chatRes.message = choice_sec.Message.Content;
                                                                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                                            }

                                                        }
                                                        Thread.Sleep(delay);
                                                    }
                                                }
                                                if (!string.IsNullOrEmpty(fn.Arguments))
                                                    output += fn.Arguments;
                                            }
                                        }
                                    }
                                }
                                Thread.Sleep(delay);
                            }
                        }
                    }
                    catch (OperationCanceledException)
                    {
                        //await _systemService.WriteLog("工坊OpenAI输出取消", Dtos.LogLevel.Info, Account); //输出取消

                    }
                    finally
                    {

                    }
                }
                //保存对话记录
                if (!string.IsNullOrEmpty(chatDto.image_path))
                {
                    chatDto.msg += $@"aee887ee6d5a79fdcmay451ai8042botf1443c04<br /><img src=""{chatDto.image_path.Replace("wwwroot", "")}"" style=""max-width:50%;"" />";
                }
                await _aiServer.SaveChatHistory(Account, chatId, chatDto.msg, chatDto.msgid_u, chatDto.chatgroupid, "user", chatDto.aiModel);
                await _aiServer.SaveChatHistory(Account, chatId, sysmsg, chatDto.msgid_g, chatDto.chatgroupid, "assistant", chatDto.aiModel);
                chatRes.message = "";
                chatRes.isfinish = true;
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                if (!string.IsNullOrEmpty(sysmsg))
                {
                    var freePlan = await _financeService.CheckFree(Account, chatDto.aiModel);
                    if (freePlan.RemainCount > 0)
                    {
                        await _financeService.UpdateFree(Account);
                        await _financeService.CreateUseLog(Account, chatDto.aiModel, tikToken.Encode(input).Count, tikToken.Encode(output).Count, 0);
                    }
                    else
                    {
                        await _financeService.CreateUseLogAndUpadteMoney(Account, chatDto.aiModel, tikToken.Encode(input).Count, tikToken.Encode(output).Count);
                    }
                }
            }
            catch (Exception e)
            {
                await _redis.DeleteAsync($"{chatId}_process");
                chatRes.message = $"糟糕！出错了！错误原因：【{e.Message}】,刷新页面或重试一次吧😢";
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                chatRes.message = "";
                chatRes.isfinish = true;
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                return;
            }
        }

        //助理GPT交互
        public async Task SendAssistantMessage(ChatDto chatDto)
        {
            var httpContext = Context.GetHttpContext();
            string? token = string.Empty;
            token = httpContext?.Request.Query["access_token"];
            if (string.IsNullOrEmpty(token) || !_jwtTokenManager.isTokenValid(token) || string.IsNullOrEmpty(chatDto.ip))
            {
                // 如果没有令牌或者令牌无效或者ip为空，则断开连接
                Context.Abort();
                return;
            }
            //从token中获取账号信息
            string Account = string.Empty;
            if (!chatDto.isbot)
                Account = _jwtTokenManager.ValidateToken(token).Identity.Name;
            else
                Account = "robot_AIBOT";
            var user = _usersService.GetUserData(Account);
            string chatId = string.Empty;
            string threadId = chatDto.threadid;
            bool newChat = false;
            if (string.IsNullOrEmpty(chatDto.chatid))
            {
                chatId = Guid.NewGuid().ToString().Replace("-", "");//创建chatid头部
                chatId = $"{chatId}U{Account}IP{chatDto.ip}";
                newChat = true;
            }
            else
                chatId = chatDto.chatid;
            await Groups.AddToGroupAsync(Context.ConnectionId, chatId);
            ChatRes chatRes = new ChatRes();
            chatRes.chatid = chatId;
            string senMethod = "ReceiveAssistantMessage";
            if (chatDto.isbot)
                senMethod = "ReceiveAssistantMessage_bot";
            //回应客户端就绪状态
            await Clients.Group(chatId).SendAsync(senMethod, chatRes);
            string promptHeadle = chatDto.msg;
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
            string assisId = assistant.First().AssisId;
            try
            {
                if (string.IsNullOrEmpty(threadId))//新对话
                {
                    //创建线程
                    threadId = await _assistantService.CreateThread();
                    chatRes.threadid = threadId;
                    //chatRes.message = $"线程已创建【{threadId}】，程序继续运行";
                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                }
                chatRes.threadid = string.Empty;
                //向线程添加消息
                string msgId = await _assistantService.AddMessage(threadId, promptHeadle);
                string sysmsg = string.Empty;
                List<string> fileids = new List<string>();
                await foreach (var responseContent in _assistantService.RunThread(threadId, assisId, Account))
                {
                    sysmsg += responseContent;
                    chatRes.message = responseContent.message;
                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    if (responseContent.file_ids != null && responseContent.file_ids.Count > 0)
                    {
                        for (int i = 0; i < responseContent.file_ids.Count; i++)
                        {
                            if (!fileids.Contains(responseContent.file_ids[i]))
                                fileids.Add(responseContent.file_ids[i]);
                        }
                    }
                    //Thread.Sleep(50);
                }
                foreach (var item in fileids)
                {
                    chatRes.file_id = item;
                    chatRes.message = "";
                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                }
                TikToken tikToken = TikToken.GetEncoding("cl100k_base");
                chatRes.message = "";
                chatRes.isfinish = true;
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
            }
            catch (Exception e)
            {
                await _redis.DeleteAsync($"{chatId}_process");
                chatRes.message = $"糟糕！出错了！错误原因：【{e.Message}】,刷新页面或重试一次吧😢";
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                chatRes.message = "";
                chatRes.isfinish = true;
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                return;
            }
        }


        // 重写OnConnectedAsync方法
        public override async Task OnConnectedAsync()
        {
            var httpContext = Context.GetHttpContext();
            string? token = string.Empty;
            token = httpContext?.Request.Query["access_token"];
            if (string.IsNullOrEmpty(token) || !_jwtTokenManager.isTokenValid(token))
            {
                // 如果没有令牌或者令牌无效，则断开连接，并抛出异常要求登录
                Context.Abort();
                throw new Exception("连接失败");
            }

            await base.OnConnectedAsync();
        }
    }
}
