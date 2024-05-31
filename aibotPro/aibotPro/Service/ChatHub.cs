using aibotPro.AppCode;
using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using iTextSharp.text.pdf.qrcode;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.CodeAnalysis;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using NuGet.Configuration;
using OpenAI;
using OpenAI.Builders;
using OpenAI.Managers;
using OpenAI.ObjectModels.RequestModels;
using OpenAI.ObjectModels.SharedModels;
using Spire.Presentation.Charts;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using TiktokenSharp;

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
        public ChatHub(JwtTokenManager jwtTokenManager, IUsersService usersService, ISystemService systemService, IRedisService redisService, IAiServer aiServer, IBaiduService baiduService, IWorkShop workShop, IFilesAIService filesAIService, AIBotProContext context, IFinanceService financeService, IAssistantService assistantService)
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
            //检查该模型是否需要收费
            var modelPrice = await _financeService.ModelPrice(chatDto.aiModel);
            bool isVip = await _financeService.IsVip(Account);
            bool shouldCharge = modelPrice != null && (
                        (!isVip && modelPrice.ModelPriceOutput > 0) || // 非VIP用户，且模型有非VIP价格
                        (isVip && modelPrice.VipModelPriceInput > 0)); // VIP用户，且模型对VIP也有价格

            //不是会员且余额为0时不提供服务
            if (!isVip && user.Mcoin <= 0)
            {
                chatRes.message = "本站已停止向【非会员且余额为0】的用户提供服务，您可以<a href='/Pay/Balance'>点击这里</a>前往充值1元及以上，长期使用本站的免费服务";
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                chatRes.message = "";
                chatRes.isfinish = true;
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                return;
            }
            // 检查用户余额是否不足，只有在需要收费时检查
            if (shouldCharge && user.Mcoin <= 0)
            {
                chatRes.message = "余额不足，请充值后再使用，您可以<a href='/Pay/Balance'>点击这里</a>前往充值";
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                chatRes.message = "";
                chatRes.isfinish = true;
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                return;
            }
            if (chatDto.isbot && !chatDto.aiModel.Contains("gpt-3.5"))
            {
                chatRes.message = "您正在使用非正当手段修改我的基底模型，我们允许且欢迎您寻找本站的BUG，但很明显，这个漏洞已经被开发团队修复，请您不要再继续尝试，本站不会记录任何用户的正常行为，但是对于异常行为有着详细的日志信息和风控手段，感谢您的合作与支持，如果您还有其他问题，请询问我。";
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                chatRes.message = "";
                chatRes.isfinish = true;
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                await _systemService.WriteLog("异常行为：用户尝试修改Robot的基底模型", Dtos.LogLevel.Fatal, Account);
                return;
            }
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
                    apiSetting.BaseUrl = aImodels.Where(x => x.ModelName == chatDto.aiModel).FirstOrDefault().BaseUrl;
                    apiSetting.ApiKey = aImodels.Where(x => x.ModelName == chatDto.aiModel).FirstOrDefault().ApiKey;
                }

                //if (chatDto.aiModel == "gpt-4-vision-preview" || chatDto.aiModel == "gpt-4-turbo" || chatDto.aiModel == "gpt-4-turbo-2024-04-09" || chatDto.aiModel == "gemini-pro-vision")
                if (aImodels.Where(x => x.ModelName == chatDto.aiModel).FirstOrDefault().VisionModel.HasValue)
                    isVisionModel = aImodels.Where(x => x.ModelName == chatDto.aiModel).FirstOrDefault().VisionModel.Value;
                //生成AI请求参数
                string input = string.Empty;
                string output = string.Empty;
                AiChat aiChat = new AiChat();
                VisionBody visionBody = new VisionBody();
                aiChat.Stream = true;
                if (chatDto.temperature != null)
                {
                    aiChat.Temperature = chatDto.temperature;
                }

                if (chatDto.top_p != null)
                {
                    aiChat.TopP = chatDto.top_p;
                }

                if (chatDto.frequency_penalty != null)
                {
                    aiChat.FrequencyPenalty = chatDto.frequency_penalty;
                }

                if (chatDto.presence_penalty != null)
                {
                    aiChat.PresencePenalty = chatDto.presence_penalty;
                }
                VisionImg visionImg = new VisionImg();
                //如果有图片
                if (!string.IsNullOrEmpty(chatDto.image_path))
                {
                    if (!isVisionModel)
                    {
                        string imageData = _systemService.ImgConvertToBase64(chatDto.image_path);
                        imgTxt = _baiduService.GetText(imageData);
                        imgRes = _baiduService.GetRes(imageData);
                        promptHeadle = $"请你充当图片内容分析师，图像中的文字识别结果为：{imgTxt},图像中物体和场景识别结果为：{imgRes},请根据识别结果进行专业的分析回答:{promptHeadle}";
                    }
                    if (chatDto.aiModel == "gpt-4-all")
                    {
                        promptHeadle = $"{chatDto.msg}\n\n图片链接：{Context.GetHttpContext().Request.Scheme}://{systemCfg.Where(x => x.CfgCode == "Domain").FirstOrDefault().CfgValue}{chatDto.image_path.Replace("wwwroot", "")}".Replace("\\", "/");
                    }
                    else
                    {
                        string imgBase64 = _systemService.ImgConvertToBase64(chatDto.image_path);
                        string dataHeader = "data:image/jpeg;base64,";
                        visionImg.url = dataHeader + imgBase64;//$"{Context.GetHttpContext().Request.Scheme}://{systemCfg.Where(x => x.CfgCode == "Domain").FirstOrDefault().CfgValue}{chatDto.image_path.Replace("wwwroot", "")}".Replace("\\", "/");
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
                                hisvisionContent.type = "image_url";
                                const string pattern = @"<img.+?src=[""'](.*?)[""'].*?>";
                                Regex regex = new Regex(pattern, RegexOptions.IgnoreCase);
                                Match match = regex.Match(item.Chat);
                                VisionImg visionImg1 = new VisionImg();
                                visionImg1.url = match.Groups[1].Value;
                                hisvisionContent.image_url = visionImg1;
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
                await _redis.SetAsync($"{chatId}_process", "true", TimeSpan.FromHours(1));
                string sysmsg = string.Empty;
                await foreach (var responseContent in _aiServer.CallingAI(aiChat, apiSetting, chatId, visionBody))
                {
                    sysmsg += responseContent.Choices[0].Delta.Content;
                    chatRes.message = responseContent.Choices[0].Delta.Content;
                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    //Thread.Sleep(50);

                }
                await _redis.DeleteAsync($"{chatId}_process");
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
                chatRes.message = "";
                chatRes.isfinish = true;
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                await _aiServer.SaveChatHistory(Account, chatId, chatDto.msg, chatDto.msgid_u, chatDto.chatgroupid, "user", chatDto.aiModel);
                await _aiServer.SaveChatHistory(Account, chatId, sysmsg, chatDto.msgid_g, chatDto.chatgroupid, "assistant", chatDto.aiModel);
                if (!string.IsNullOrEmpty(output))
                    await _financeService.CreateUseLogAndUpadteMoney(Account, chatDto.aiModel, tikToken.Encode(input).Count, tikToken.Encode(output).Count);
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
            //检查该模型是否需要收费
            var modelPrice = await _financeService.ModelPrice(chatDto.aiModel);
            bool isVip = await _financeService.IsVip(Account);
            bool shouldCharge = !isVip && modelPrice != null &&
                                (modelPrice.VipModelPriceInput > 0 || modelPrice.ModelPriceOutput > 0);

            //不是会员且余额为0时不提供服务
            if (!isVip && user.Mcoin <= 0)
            {
                chatRes.message = "本站已停止向【非会员且余额为0】的用户提供服务，您可以<a href='/Pay/Balance'>点击这里</a>前往充值1元及以上，长期使用本站的免费服务";
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                chatRes.message = "";
                chatRes.isfinish = true;
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                return;
            }

            // 检查用户余额是否不足，只有在需要收费时检查
            if (shouldCharge && user.Mcoin <= 0)
            {
                chatRes.message = "余额不足，请充值后再使用，您可以<a href='/Pay/Balance'>点击这里</a>前往充值";
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                chatRes.message = "";
                chatRes.isfinish = true;
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                return;
            }
            if (chatDto.isbot && !chatDto.aiModel.Contains("gpt-3.5"))
            {
                chatRes.message = "您正在使用非正当手段修改我的基底模型，我们允许且欢迎您寻找本站的BUG，但很明显，这个漏洞已经被开发团队修复，请您不要再继续尝试，本站不会记录任何用户的正常行为，但是对于异常行为有着详细的日志信息和风控手段，感谢您的合作与支持，如果您还有其他问题，请询问我。";
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                chatRes.message = "";
                chatRes.isfinish = true;
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                await _systemService.WriteLog("异常行为：用户尝试修改Robot的基底模型", Dtos.LogLevel.Fatal, Account);
                return;
            }
            //如果有图片
            if (!string.IsNullOrEmpty(chatDto.image_path))
            {
                string imageData = _systemService.ImgConvertToBase64(chatDto.image_path);
                imgTxt = _baiduService.GetText(imageData);
                imgRes = _baiduService.GetRes(imageData);
                promptHeadle = $"请你充当图片内容分析师，图像中的文字识别结果为：{imgTxt},图像中物体和场景识别结果为：{imgRes},请根据识别结果进行专业的分析回答:{promptHeadle}";

            }
            input += promptHeadle;
            try
            {
                //获取对话设置
                var chatSetting = _usersService.GetChatSetting(Account);
                //如果不使用历史记录
                if (chatSetting.SystemSetting.UseHistory == 0)
                    newChat = true;
                //生成设置参数
                APISetting apiSetting = new APISetting();
                List<WorkShopAIModel> aImodels = new List<WorkShopAIModel>();
                //获取模型设置
                aImodels = _systemService.GetWorkShopAImodel();
                OpenAiOptions openAiOptions = new OpenAiOptions();
                openAiOptions.BaseDomain = aImodels.Where(x => x.ModelName == chatDto.aiModel).FirstOrDefault().BaseUrl;
                openAiOptions.ApiKey = aImodels.Where(x => x.ModelName == chatDto.aiModel).FirstOrDefault().ApiKey;
                var openAiService = new OpenAIService(openAiOptions);
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
                List<PluginDto> myplugins = new List<PluginDto>();
                if (onknowledge)//知识库检索状态
                {
                    mytools.Add(ToolDefinition.DefineFunction(sysKnowledgeSearch));
                    //mytools.Add(ToolDefinition.DefineFunction(fnGoogleSearch));
                    chatDto.system_prompt = "你是知识库阅览专家，任何问题你先查询知识库，如知识库中无记录再自行结合上下文回答，请记住，先查询知识库";
                }
                else
                {
                    if (!chatDto.isbot)
                    {
                        mytools.Add(ToolDefinition.DefineFunction(fnDall));
                    }
                    mytools.Add(ToolDefinition.DefineFunction(fnGoogleSearch));
                    //获取用户插件列表
                    myplugins = _workShop.GetPluginInstall(Account);
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
                        chatDto.system_prompt = "对于要插入函数的值，不要做任何假设。如果用户的请求不清晰，可以要求澄清，也可以询问用户是否需要调用函数插件";
                }
                List<ChatMessage> chatMessages = new List<ChatMessage>();
                chatMessages.Add(ChatMessage.FromSystem(chatDto.system_prompt));
                if (newChat)
                {
                    chatMessages.Add(ChatMessage.FromUser(promptHeadle));
                }
                else
                {
                    //否则查询历史记录
                    int historyCount = 5;//默认5
                    if (chatSetting.SystemSetting.HistoryCount != 5)
                        historyCount = chatSetting.SystemSetting.HistoryCount;
                    List<ChatHistory> chatHistories = _aiServer.GetChatHistories(Account, chatId, historyCount);
                    //遍历填充历史记录
                    foreach (var item in chatHistories)
                    {
                        if (item.Role == "user")
                            chatMessages.Add(ChatMessage.FromUser(item.Chat));
                        else
                            chatMessages.Add(ChatMessage.FromAssistant(item.Chat));
                        input += item.Chat;
                    }
                    chatMessages.Add(ChatMessage.FromUser(promptHeadle));
                }
                ChatCompletionCreateRequest chatCompletionCreate = new ChatCompletionCreateRequest();
                chatCompletionCreate.Messages = chatMessages;
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
                if (chatDto.temperature != null)
                {
                    chatCompletionCreate.Temperature = chatDto.temperature;
                }

                if (chatDto.top_p != null)
                {
                    chatCompletionCreate.TopP = chatDto.top_p;
                }

                if (chatDto.frequency_penalty != null)
                {
                    chatCompletionCreate.FrequencyPenalty = chatDto.frequency_penalty;
                }

                if (chatDto.presence_penalty != null)
                {
                    chatCompletionCreate.PresencePenalty = chatDto.presence_penalty;
                }
                CancellationTokenSource cts = new CancellationTokenSource();
                CancellationToken cancellationToken = cts.Token;
                cancellationToken.Register(async () => await _redis.DeleteAsync($"{chatId}_process"));
                var completionResult = openAiService.ChatCompletion.CreateCompletionAsStream(chatCompletionCreate, chatCompletionCreate.Model, true, cancellationToken);
                await _redis.SetAsync($"{chatId}_process", "true", TimeSpan.FromHours(1));
                string sysmsg = string.Empty;
                var functionArguments = new Dictionary<int, string>();
                PluginResDto pluginResDto = new PluginResDto();
                TikToken tikToken = TikToken.GetEncoding("cl100k_base");
                await foreach (var responseContent in completionResult.WithCancellation(cancellationToken))
                {
                    if (responseContent.Successful)
                    {
                        string thisTask = await _redis.GetAsync($"{chatId}_process");
                        if (string.IsNullOrEmpty(thisTask))
                        {
                            cts.Cancel();
                            break;
                        }
                        if (bool.Parse(thisTask))
                        {
                            var choice = responseContent.Choices.FirstOrDefault();
                            if (choice != null && choice.Message != null)
                            {
                                sysmsg += choice.Message.Content;
                                output += choice.Message.Content;
                                chatRes.message = choice.Message.Content;
                                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                            }
                            else
                            {
                                await _systemService.WriteLog("Function Calling执行失败，该问题通常重试后即可", Dtos.LogLevel.Error, "system");
                                throw new Exception("Function Calling执行失败，该问题通常重试后即可");
                            }
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
                                var fn = toolCall.FunctionCall;
                                if (fn != null)
                                {
                                    if (!string.IsNullOrEmpty(fn.Name))
                                    {
                                        bool dalleloadding = true;
                                        bool websearchloadding = true;
                                        bool knowledgeloadding = true;
                                        if (fn.Name == "use_dalle3_withpr")
                                        {
                                            chatRes.message = "使用【DALL·E3】组件执行绘制,这需要大约1-2分钟";
                                            await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                            var emojiList = new List<string> { "🖌", "🎨", "🔧", "🖊", "🖍", "🖼", "🤯" };
                                            var random = new Random();
                                            // 线程开始
                                            var emojiTask = Task.Run(async () =>
                                            {
                                                while (dalleloadding)
                                                {
                                                    var randomEmoji = emojiList[random.Next(emojiList.Count)]; //从列表中随机选择一个
                                                    chatRes.message = $"{randomEmoji}";
                                                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                                    await Task.Delay(1000);
                                                }
                                            });
                                        }
                                        else if (fn.Name == "search_google_when_gpt_cannot_answer")
                                        {
                                            chatRes.message = "请稍候，让我Google一下";
                                            await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                            // 线程开始
                                            var websearchTask = Task.Run(async () =>
                                            {
                                                while (websearchloadding)
                                                {
                                                    chatRes.message = $"🌐";
                                                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                                    await Task.Delay(1000);
                                                }
                                            });
                                        }
                                        else if (fn.Name == "search_knowledge_base")
                                        {
                                            chatRes.message = "请稍候，让我尝试检索知识库";
                                            await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                            // 线程开始
                                            var websearchTask = Task.Run(async () =>
                                            {
                                                while (knowledgeloadding)
                                                {
                                                    chatRes.message = $"🔎📄";
                                                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                                    await Task.Delay(1000);
                                                }
                                            });
                                        }
                                        pluginResDto = await _workShop.RunPlugin(Account, fn, chatId, senMethod, typeCode);
                                        if (!pluginResDto.doubletreating)
                                        {
                                            string res = string.Empty;
                                            switch (pluginResDto.doubletype)
                                            {
                                                case "dalle3":
                                                    dalleloadding = false;
                                                    if (!string.IsNullOrEmpty(pluginResDto.errormsg) || string.IsNullOrEmpty(pluginResDto.result))
                                                    {
                                                        chatRes.message = $"绘制失败，请重试！({pluginResDto.errormsg})";
                                                        await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                                        break;
                                                    }
                                                    string res1 = "<p>已为您绘制完成</p>";
                                                    chatRes.message = res1;
                                                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                                    Thread.Sleep(200);
                                                    string res2 = "<p>绘制结果如下,请您查阅：</p><br />";
                                                    chatRes.message = res2;
                                                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                                    Thread.Sleep(200);
                                                    string res3 = $"<img src='{pluginResDto.result}' style='width:300px;'/>";
                                                    chatRes.message = res3;
                                                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                                    Thread.Sleep(200);
                                                    string res4 = @$"<br>提示词：<b>{pluginResDto.dallprompt}</b>";
                                                    chatRes.message = res4;
                                                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                                    Thread.Sleep(200);
                                                    string res5 = @$"<br><b>如有需要，请及时下载您的图片，图片缓存我们将定时删除</b><a href=""{pluginResDto.result}"" target=""_blank"">【点击这里下载图片】</a>";
                                                    chatRes.message = res5;
                                                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                                    res = res1 + res2 + res3 + res4 + res5;
                                                    break;
                                                case "html":
                                                    res = pluginResDto.result;
                                                    chatRes.message = res;
                                                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                                    break;
                                                case "js":
                                                    chatRes.message = "";
                                                    chatRes.jscode = pluginResDto.result;
                                                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                                    chatRes.jscode = "";
                                                    break;
                                                default:
                                                    res = pluginResDto.result;
                                                    chatRes.message = res;
                                                    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                                                    break;
                                            }
                                            sysmsg = res;
                                        }
                                        //反馈GPT函数执行结果
                                        else
                                        {
                                            websearchloadding = false;
                                            knowledgeloadding = false;
                                            //生成对话参数
                                            input += pluginResDto.result;
                                            chatMessages.Add(ChatMessage.FromUser(pluginResDto.result));
                                            chatCompletionCreate.Messages = chatMessages;
                                            chatCompletionCreate.Tools = null;
                                            chatCompletionCreate.ToolChoice = null;
                                            chatCompletionCreate.Stream = true;
                                            chatCompletionCreate.Model = chatDto.aiModel;
                                            if (chatDto.temperature != null)
                                            {
                                                chatCompletionCreate.Temperature = chatDto.temperature;
                                            }

                                            if (chatDto.top_p != null)
                                            {
                                                chatCompletionCreate.TopP = chatDto.top_p;
                                            }

                                            if (chatDto.frequency_penalty != null)
                                            {
                                                chatCompletionCreate.FrequencyPenalty = chatDto.frequency_penalty;
                                            }

                                            if (chatDto.presence_penalty != null)
                                            {
                                                chatCompletionCreate.PresencePenalty = chatDto.presence_penalty;
                                            }
                                            completionResult = openAiService.ChatCompletion.CreateCompletionAsStream(chatCompletionCreate, chatCompletionCreate.Model, true, cancellationToken);
                                            await foreach (var responseContent_sec in completionResult.WithCancellation(cancellationToken))
                                            {
                                                if (responseContent_sec.Successful)
                                                {
                                                    thisTask = await _redis.GetAsync($"{chatId}_process");
                                                    if (string.IsNullOrEmpty(thisTask))
                                                    {
                                                        cts.Cancel();
                                                        break;
                                                    }
                                                    if (bool.Parse(thisTask))
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
                                                    else
                                                    {
                                                        cts.Cancel();
                                                        break;
                                                    }
                                                }
                                            }
                                        }

                                    }
                                }
                            }
                            //Thread.Sleep(50);
                        }
                        else
                        {
                            cts.Cancel();
                            break;
                        }
                    }
                }
                await _redis.DeleteAsync($"{chatId}_process");
                //保存对话记录
                if (!string.IsNullOrEmpty(chatDto.image_path))
                {
                    chatDto.msg += $@"aee887ee6d5a79fdcmay451ai8042botf1443c04<br /><img src=""{chatDto.image_path.Replace("wwwroot", "")}"" style=""max-width:50%;"" />";
                }
                await _aiServer.SaveChatHistory(Account, chatId, chatDto.msg, chatDto.msgid_u, chatDto.chatgroupid, "user", chatDto.aiModel);
                await _aiServer.SaveChatHistory(Account, chatId, sysmsg, chatDto.msgid_g, chatDto.chatgroupid, "assistant", chatDto.aiModel);
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
            // 检查用户余额是否不足，只有在需要收费时检查
            if (user.Mcoin <= 0)
            {
                chatRes.message = "余额不足，请充值后再使用，您可以<a href='/Pay/Balance'>点击这里</a>前往充值";
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                chatRes.message = "";
                chatRes.isfinish = true;
                await Clients.Group(chatId).SendAsync(senMethod, chatRes);
                return;
            }
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

            //try
            //{
            //    //获取对话设置
            //    var chatSetting = _usersService.GetChatSetting(Account);
            //    //如果不使用历史记录
            //    if (chatSetting.SystemSetting.UseHistory == 0)
            //        newChat = true;
            //    //生成设置参数
            //    APISetting apiSetting = new APISetting();
            //    List<AImodel> aImodels = new List<AImodel>();
            //    if (chatSetting != null && chatSetting.MyChatModel != null && chatSetting.MyChatModel.Count > 0)
            //    {
            //        foreach (var item in chatSetting.MyChatModel)
            //        {
            //            AImodel aiModel = new AImodel();
            //            aiModel.ModelNick = item.ChatNickName;
            //            aiModel.ModelName = item.ChatModel;
            //            aiModel.BaseUrl = item.ChatBaseURL;
            //            aiModel.ApiKey = item.ChatApiKey;
            //            aImodels.Add(aiModel);
            //        }
            //        apiSetting.BaseUrl = aImodels.Where(x => x.ModelName == chatDto.aiModel).FirstOrDefault().BaseUrl;
            //        apiSetting.ApiKey = aImodels.Where(x => x.ModelName == chatDto.aiModel).FirstOrDefault().ApiKey;
            //        useMyKey = true;
            //    }
            //    else
            //    {
            //        //获取模型设置
            //        aImodels = _systemService.GetAImodel();
            //        apiSetting.BaseUrl = aImodels.Where(x => x.ModelName == chatDto.aiModel).FirstOrDefault().BaseUrl;
            //        apiSetting.ApiKey = aImodels.Where(x => x.ModelName == chatDto.aiModel).FirstOrDefault().ApiKey;
            //    }
            //    //生成AI请求参数
            //    string input = string.Empty;
            //    string output = string.Empty;
            //    AiChat aiChat = new AiChat();
            //    VisionBody visionBody = new VisionBody();
            //    aiChat.Stream = true;
            //    VisionImg visionImg = new VisionImg();
            //    input += promptHeadle;
            //    visionBody.model = chatDto.aiModel;
            //    aiChat.Model = chatDto.aiModel;
            //    List<VisionChatMesssage> tmpmsg_v = new List<VisionChatMesssage>();
            //    List<Message> messages = new List<Message>();
            //    if (chatDto.chatid.Contains("gridview"))
            //        newChat = true;
            //    if (newChat)
            //    {
            //        //如果是新对话直接填充用户输入
            //        Message message = new Message();
            //        if (!string.IsNullOrEmpty(chatDto.system_prompt))
            //        {
            //            message.Role = "system";
            //            message.Content = chatDto.system_prompt;
            //            messages.Add(message);
            //        }
            //        message = new Message();
            //        message.Role = "user";
            //        message.Content = promptHeadle;
            //        messages.Add(message);
            //    }
            //    else
            //    {
            //        //否则查询历史记录
            //        int historyCount = 5;//默认5
            //        if (chatSetting.SystemSetting.HistoryCount != 5)
            //            historyCount = chatSetting.SystemSetting.HistoryCount;
            //        List<ChatHistory> chatHistories = _aiServer.GetChatHistories(Account, chatId, historyCount);
            //        //遍历填充历史记录
            //        foreach (var item in chatHistories)
            //        {
            //            input += item.Chat;
            //            Message message = new Message();
            //            if (!string.IsNullOrEmpty(chatDto.system_prompt))
            //            {
            //                message.Role = "system";
            //                message.Content = chatDto.system_prompt;
            //                messages.Add(message);
            //            }
            //            message = new Message();
            //            message.Role = item.Role;
            //            message.Content = item.Chat;
            //            messages.Add(message);


            //        }
            //        //填充用户输入
            //        Message message1 = new Message();
            //        message1.Role = "user";
            //        message1.Content = promptHeadle;
            //        messages.Add(message1);


            //    }
            //    aiChat.Messages = messages;
            //    visionBody.messages = tmpmsg_v.ToArray();
            //    //准备调用AI接口，缓存存入工作中状态
            //    string sysmsg = string.Empty;
            //    await foreach (var responseContent in _aiServer.CallingAI(aiChat, apiSetting, visionBody))
            //    {
            //        string thisTask = await _redis.GetAsync($"{chatId}_process");
            //        if (string.IsNullOrEmpty(thisTask))
            //            break;
            //        if (bool.Parse(thisTask))
            //        {
            //            sysmsg += responseContent.Choices[0].Delta.Content;
            //            chatRes.message = responseContent.Choices[0].Delta.Content;
            //            await Clients.Group(chatId).SendAsync(senMethod, chatRes);
            //            //Thread.Sleep(50);
            //        }
            //        else
            //        {
            //            break;
            //        }
            //    }
            //    //保存对话记录
            //    output = sysmsg;
            //    TikToken tikToken = TikToken.GetEncoding("cl100k_base");
            //    await _aiServer.SaveChatHistory(Account, chatId, chatDto.msg, chatDto.msgid_u, chatDto.chatgroupid, "user", chatDto.aiModel);
            //    await _aiServer.SaveChatHistory(Account, chatId, sysmsg, chatDto.msgid_g, chatDto.chatgroupid, "assistant", chatDto.aiModel);
            //    await _financeService.CreateUseLogAndUpadteMoney(Account, chatDto.aiModel, tikToken.Encode(input).Count, tikToken.Encode(output).Count);
            //    chatRes.message = "";
            //    chatRes.isfinish = true;
            //    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
            //}
            //catch (Exception e)
            //{
            //    await _redis.DeleteAsync($"{chatId}_process");
            //    chatRes.message = $"糟糕！出错了！错误原因：【{e.Message}】,刷新页面或重试一次吧😢";
            //    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
            //    chatRes.message = "";
            //    chatRes.isfinish = true;
            //    await Clients.Group(chatId).SendAsync(senMethod, chatRes);
            //    return;
            //}
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
