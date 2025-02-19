using aibotPro.Models;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;
using Microsoft.AspNetCore.Authorization;
using aibotPro.Interface;
using Newtonsoft.Json;
using aibotPro.AppCode;
using aibotPro.Service;
using aibotPro.Dtos;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using System.Security.Principal;
using System.Text;
using System.Collections.Concurrent;
using System.IO.Compression;
using Microsoft.IdentityModel.Tokens;
using System.Text.RegularExpressions;

namespace aibotPro.Controllers
{
    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;
        private readonly IRedisService _redis;
        private readonly AIBotProContext _context;
        private readonly ISystemService _systemService;
        private readonly JwtTokenManager _jwtTokenManager;
        private readonly IUsersService _usersService;
        private readonly IAiServer _ai;
        private readonly IMilvusService _milvusService;
        private readonly ChatCancellationManager _chatCancellationManager;

        public HomeController(ILogger<HomeController> logger, IRedisService redisService, AIBotProContext context,
            ISystemService systemService, JwtTokenManager jwtTokenManager, IUsersService usersService, IAiServer ai,
            IMilvusService milvusService, ChatCancellationManager chatCancellationManager)
        {
            _logger = logger;
            _redis = redisService;
            _context = context;
            _systemService = systemService;
            _jwtTokenManager = jwtTokenManager;
            _usersService = usersService;
            _ai = ai;
            _milvusService = milvusService;
            _chatCancellationManager = chatCancellationManager;
        }

        [Route("install.html")]
        public IActionResult Install()
        {
            //检查是否已经安装，验证aibotinstall.lock 文件是否存在
            var check = _context.Admins.AsNoTracking().FirstOrDefault();
            if (System.IO.File.Exists("aibotinstall.lock") || check != null)
            {
                //锁定安装页
                try
                {
                    string lockFilePath =
                        System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "aibotinstall.lock");
                    if (!System.IO.File.Exists(lockFilePath))
                    {
                        using (FileStream lockFile = System.IO.File.Create(lockFilePath))
                        {
                            // 写入一些内容到锁文件，可以是空内容或者一些标识信息
                            byte[] content = Encoding.UTF8.GetBytes("Lock file created by the application.");
                            lockFile.Write(content, 0, content.Length);
                        }
                    }

                    return Redirect("/Home/Index");
                }
                catch (Exception ex)
                {
                    _systemService.WriteLogUnAsync($"创建锁定文件时出现异常：{ex.Message}", Dtos.LogLevel.Error, "system");
                    return Redirect("/Home/Index");
                }
            }

            return View();
        }

        public async Task<IActionResult> Index()
        {
            await RecordIpAddressAsync();
            return View();
        }

        public IActionResult Midjourney()
        {
            return View();
        }

        public IActionResult DALL()
        {
            return View();
        }

        public IActionResult StableDiffusion()
        {
            return View();
        }

        public IActionResult SystemGallery()
        {
            return View();
        }

        public IActionResult Suno()
        {
            return View();
        }

        public IActionResult ChatSetting()
        {
            return View();
        }

        public IActionResult UISetting()
        {
            return View();
        }

        public IActionResult Memory()
        {
            return View();
        }

        public IActionResult Welcome()
        {
            return View();
        }

        public IActionResult PriceInfo()
        {
            return View();
        }

        public IActionResult MoldeUsage()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }

        private async Task RecordIpAddressAsync()
        {
            var ip = HttpContext.Connection.RemoteIpAddress;
            var settings = new ChunZhenSetting
            {
                DatPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "system", "doc", "qqwry.dat")
            };
            var ipSearch = new IPSearchHelper(settings);
            var iPLocation = ipSearch.GetIPLocation(ip?.ToString() ?? "127.0.0.1");
            _systemService.SaveIP(ip.ToString(), (iPLocation.country + iPLocation.area).Replace("CZ88.NET", ""));
        }

        //从Redis中获取AI模型信息
        //不允许匿名访问
        [Authorize]
        [HttpPost]
        public IActionResult GetAImodel()
        {
            List<AImodel> aiModel_lst = new List<AImodel>();
            //查询是否有对话设置
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var chatSetting = _usersService.GetChatSetting(username);
            if (chatSetting != null && chatSetting.MyChatModel != null && chatSetting.MyChatModel.Count > 0)
            {
                foreach (var item in chatSetting.MyChatModel)
                {
                    AImodel aiModel = new AImodel();
                    aiModel.ModelNick = item.ChatNickName;
                    aiModel.ModelName = item.ChatModel;
                    aiModel.BaseUrl = item.ChatBaseURL;
                    aiModel.ApiKey = item.ChatApiKey;
                    aiModel_lst.Add(aiModel);
                }
            }
            else
                aiModel_lst = _systemService.GetAImodel();

            var aiModelSeq = _systemService.GetAImodelSeq(username);
            //如果有设置模型顺序，则按照设置的顺序返回
            if (aiModelSeq != null && aiModelSeq.Count > 0)
            {
                foreach (var item in aiModelSeq)
                {
                    var model = aiModel_lst.Find(x => x.ModelName == item.ModelName);
                    if (model != null)
                        model.Seq = item.Seq;
                }
            }

            //重新排序
            aiModel_lst.Sort((x, y) => x.Seq.GetValueOrDefault().CompareTo(y.Seq));
            //移除BaseURL和ApiKey
            aiModel_lst.ForEach(x =>
            {
                x.BaseUrl = string.Empty;
                x.ApiKey = string.Empty;
                x.Delay = 0;
                x.AdminPrompt = string.Empty;
            });
            return Json(new
            {
                success = true,
                data = aiModel_lst
            });
        }

        //获取IP地址及信息
        [HttpPost]
        public IActionResult GetIPInfo()
        {
            var ip = HttpContext.Items["IP"] as string;
            var address = HttpContext.Items["IPAddress"] as string;
            return Json(new
            {
                success = true,
                ip = ip,
                address = address
            });
        }

        //接收异常信息写入日志
        [Authorize]
        [HttpPost]
        public IActionResult WriteLog(string msg)
        {
            //从token中获取用户名
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            _systemService.WriteLog(msg, Dtos.LogLevel.Error, username);
            return Json(new
            {
                success = true,
                msg = "写入成功"
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> GetChatHistoriesList(int pageIndex, int pageSize, string searchKey)
        {
            List<ChatHistory> chatHistories = new List<ChatHistory>();
            //从token中获取用户名
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            chatHistories = await _ai.GetChatHistoriesList(username, pageIndex, pageSize, searchKey);
            return Json(new
            {
                success = true,
                data = chatHistories
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> UpdateChatTitle(string chatId, string chatTitle)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            bool result = await _ai.UpdateAllChatTitlesByChatIdAsync(username, chatId, chatTitle);
            return Json(new
            {
                success = result
            });
        }

        [Authorize]
        [HttpPost]
        //删除聊天记录
        public IActionResult DelChatHistory(string chatId)
        {
            //从token中获取用户名
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            _ai.DelChatHistory(username, chatId);
            return Json(new
            {
                success = true,
                msg = "删除成功"
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult DelChoiceChatHistory(string chatIds)
        {
            //从token中获取用户名
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            string[] chatIdLst = chatIds.Split(',');
            foreach (var chatId in chatIdLst)
            {
                _ai.DelChatHistory(username, chatId);
            }

            return Json(new
            {
                success = true,
                msg = "删除成功"
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult ShowHistoryDetail(string chatId)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var chatHistories = _ai.ShowHistoryDetail(username, chatId);
            return Json(new
            {
                success = true,
                data = chatHistories
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> StopGenerate(string chatId)
        {
            _chatCancellationManager.TryCancelChat(chatId);
            return Json(new
            {
                success = true,
                msg = "停止成功"
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> SaveImg(IFormFile file, string thisAiModel)
        {
            //以年月日生成文件路径
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            List<SystemCfg> systemConfig = _systemService.GetSystemCfgs();
            var imgHost = systemConfig.Where(s => s.CfgKey == "ImageHosting").FirstOrDefault();
            string fileName = string.Empty;
            if (imgHost == null)
            {
                string path = Path.Combine("wwwroot", "files/uploadImg", DateTime.Now.ToString("yyyyMMdd"));
                fileName = _systemService.SaveFiles(path, file, username);
            }
            else
            {
                fileName = await _systemService.UploadFileToImageHosting(file, username);
            }

            //返回文件名
            return Json(new
            {
                success = true,
                data = fileName
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult DelChatGroup(string groupId, int type)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            _ai.DelChatGroup(username, groupId, type);
            return Json(new
            {
                success = true,
                msg = "删除成功"
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult RestoreChatGroup(string groupId)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var chatGroups = _context.ChatHistories.Where(c => c.ChatGroupId == groupId && c.Account == username);
            if (chatGroups.Any())
            {
                foreach (var chatGroup in chatGroups)
                {
                    chatGroup.IsDel = 0;
                }

                _context.SaveChanges();
                return Json(new
                {
                    success = true,
                    msg = "恢复成功"
                });
            }

            return Json(new
            {
                success = false,
                msg = "恢复失败"
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult SaveChatSetting(ChatSettingDto chatSettingDto)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            bool mychatmodel = true;
            bool mydall = true;
            bool mymidjourney = true;
            bool systemsetting = true;
            //判断是否为清空
            if (chatSettingDto.MyChatModel == null || chatSettingDto.MyChatModel.Count == 0)
            {
                chatSettingDto.MyChatModel = new List<MyChatModel>();
                mychatmodel = false;
            }

            if (chatSettingDto.MyDall.ApiKey == null || chatSettingDto.MyDall.ApiKey == string.Empty ||
                chatSettingDto.MyDall.BaseURL == null || chatSettingDto.MyDall.BaseURL == string.Empty)
            {
                chatSettingDto.MyDall = new MyDall();
                mydall = false;
            }

            if (chatSettingDto.MyMidjourney.ApiKey == null || chatSettingDto.MyMidjourney.ApiKey == string.Empty ||
                chatSettingDto.MyMidjourney.BaseURL == null || chatSettingDto.MyMidjourney.BaseURL == string.Empty)
            {
                chatSettingDto.MyMidjourney = new MyMidjourney();
                mymidjourney = false;
            }

            if (!mychatmodel && !mydall && !mymidjourney && !systemsetting)
            {
                //清空
                return Json(new
                {
                    success = _usersService.DeleteChatSetting(username, out string errormsg2),
                    msg = errormsg2
                });
            }

            //保存
            return Json(new
            {
                success = _usersService.SaveChatSetting(username, JsonConvert.SerializeObject(chatSettingDto),
                    out string errormsg),
                msg = errormsg
            });
        }

        [Authorize]
        [HttpPost]
        //获取对话设置
        public IActionResult GetChatSetting()
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var chatSetting = _usersService.GetChatSetting(username);
            return Json(new
            {
                success = true,
                data = chatSetting
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult GetNotice()
        {
            var notice = _context.Notices.OrderByDescending(n => n.CreateTime).FirstOrDefault();
            return Json(new
            {
                success = true,
                data = notice.NoticeContent
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult GetNoticeList()
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

            if (string.IsNullOrEmpty(username))
            {
                return Json(new { success = false, message = "Invalid token" });
            }

            var notices = _context.Notices.ToList();
            var noticeReads = _context.NoticeReads.Where(nr => nr.Account == username).ToList();

            var allNotices = notices.Select(n => new
            {
                n.Id,
                n.NoticeTitle,
                n.NoticeContent,
                n.CreateTime,
                IsRead = noticeReads.Any(nr => nr.NoticeId == n.Id)
            }).ToList();

            return Json(new
            {
                success = true,
                notices = allNotices
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult ReadNotice(int id)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var read = _context.NoticeReads.Where(r => r.NoticeId == id && r.Account == username).FirstOrDefault();
            if (read == null)
            {
                var noticeRead = new NoticeRead
                {
                    Account = username,
                    NoticeId = id,
                    CreateTime = DateTime.Now
                };

                _context.NoticeReads.Add(noticeRead);
                _context.SaveChanges();
            }

            return Json(new
            {
                success = true,
                msg = "已读"
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult GetModelPrice(string modelName)
        {
            // 将 AImodels 和 WorkShopAIModel 表合并
            var aiModelsQuery = _context.AImodels.AsNoTracking()
                .Select(ai => new { ai.ModelNick, ai.ModelName })
                .Union(_context.WorkShopAIModels.AsNoTracking()
                    .Select(w => new { w.ModelNick, w.ModelName }));

            // 连接 ModelPrices 和合并后的 AI models 表，并选择所需字段
            var modelPriceQuery = from mp in _context.ModelPrices.AsNoTracking()
                                  join ai in aiModelsQuery
                                      on mp.ModelName equals ai.ModelName into joined
                                  from ai in joined.DefaultIfEmpty()
                                  select new
                                  {
                                      ModelPrice = mp,
                                      ModelNick = ai != null ? ai.ModelNick : "默认值" // 确保 ModelNick 不为空
                                  };

            // 根据传入的 modelName 进行筛选
            if (!string.IsNullOrEmpty(modelName))
                modelPriceQuery = modelPriceQuery.Where(m => m.ModelPrice.ModelName == modelName);

            // 将查询结果转换为列表
            var modelPriceList = modelPriceQuery.ToList();

            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = modelPriceList
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult SaveModelSeq(List<ChatModelSeq> ChatModelSeq)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            return Json(new
            {
                success = _usersService.SaveModelSeq(username, ChatModelSeq, out string errormsg),
                msg = errormsg
            });
        }

        public IActionResult CheckDataBaseServer()
        {
            bool result;
            result = _systemService.CheckDataBaseServer();
            return Json(new
            {
                success = result,
                msg = result ? "数据库连接正常" : "数据库连接异常"
            });
        }

        public IActionResult CheckRedis()
        {
            bool result;
            result = _systemService.CheckRedis();
            return Json(new
            {
                success = result,
                msg = result ? "Redis连接正常" : "Redis连接异常"
            });
        }

        [HttpPost]
        public IActionResult CreateAdmin(string Account, string Password)
        {
            //检查是否已经安装，验证aibotinstall.lock 文件是否存在
            if (System.IO.File.Exists("aibotinstall.lock"))
            {
                return Json(new
                {
                    success = false,
                    msg = "非法请求"
                });
            }
            else
            {
                //查询管理员列表中是否已有数据
                var check = _context.Admins.AsNoTracking().FirstOrDefault();
                if (check != null)
                {
                    return Json(new
                    {
                        success = false,
                        msg = "已存在管理员"
                    });
                }

                //创建管理员
                var result = _systemService.CreateAdmin(Account, Password);
                return Json(new
                {
                    success = result,
                    msg = result ? $"创建管理员{Account}:{Password}成功" : "创建管理员失败"
                });
            }
        }

        [HttpPost]
        public IActionResult CreateSystemCfg()
        {
            //检查是否已经安装，验证aibotinstall.lock 文件是否存在
            if (System.IO.File.Exists("aibotinstall.lock"))
            {
                return Json(new
                {
                    success = false,
                    msg = "非法请求"
                });
            }
            var result = _systemService.CreateSystemCfg();
            return Json(new
            {
                success = result,
                msg = result ? $"创建系统配置成功" : "创建系统配置失败"
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult UploadBackground([FromForm] IFormFile file)
        {
            //保存图片
            string path =
                Path.Combine("wwwroot/files/usersbackgroundimg",
                    $"{DateTime.Now.ToString("yyyyMMdd")}"); //$"wwwroot\\files\\pluginavatar\\{DateTime.Now.ToString("yyyyMMdd")}";
            string username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            if (string.IsNullOrEmpty(username))
            {
                return Json(new
                {
                    success = false,
                    msg = "账号异常"
                });
            }

            string fileName = _systemService.SaveFiles(path, file, username);
            //返回文件名
            return Json(new
            {
                success = true,
                filePath = fileName
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult SaveUISetting(UISettingDto uISetting)
        {
            string username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            return Json(new
            {
                success = _systemService.SaveSystemUI(uISetting, username)
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult GetUISetting()
        {
            string username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            return Json(new
            {
                success = true,
                data = _systemService.GetSystemUI(username)
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> SaveMemory(string chatgroupId, string chatId)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var systemCfg = _systemService.GetSystemCfgs();
            var embeddingModel = systemCfg.FirstOrDefault(x => x.CfgKey == "EmbeddingsModel");
            var result = await _ai.SaveMemory(embeddingModel.CfgValue, username, chatgroupId, chatId);
            return Json(new
            {
                success = result
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> QueryData(int limit, string filter)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            List<string> typeCode = new List<string>();
            typeCode.Add($"{username}_memory");
            var result = await _milvusService.QueryData(username, typeCode, limit, filter);
            return Json(new
            {
                success = true,
                data = result
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> DeleteMemory(string id)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            List<string> typeCode = new List<string>();
            typeCode.Add($"{username}_memory");
            var result = await _milvusService.DeleteMemory(username, id);
            return Json(new
            {
                success = true,
                data = result
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> OptimizePrompt(string prompt)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var systemPrompt =
                @"You are an advanced AI prompt optimization assistant. Your task is to improve the given prompt to make it more effective, clear, and likely to produce better results. Analyze the input prompt and provide an optimized version. Output the result in JSON format.
                     The JSON should contain a key named 'optimizedPrompt' that stores the improved prompt.
                     Here is an example of the JSON return value:
                     {
                        'optimizedPrompt': 'Your optimized prompt text will appear here'
                     }";
            prompt = $"Prompt to optimize: {prompt}";
            var resultJson = await _ai.GPTJsonModel(systemPrompt, prompt, "gpt-4o-mini", username);
            if (!string.IsNullOrEmpty(resultJson))
            {
                var resultData = JsonConvert.DeserializeObject<OptimizeResult>(resultJson);
                if (resultData != null && !string.IsNullOrEmpty(resultData.OptimizedPrompt))
                    return Ok(new
                    {
                        success = true,
                        data = resultData.OptimizedPrompt
                    });
            }

            return Ok(new
            {
                success = false
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult AddUserPrompt(string prompt)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            bool result = _usersService.AddUserPrompt(prompt, username);
            return Ok(new
            {
                success = true
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult GetUserPromptList(string prompt, int page, int size)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var list = _usersService.GetUserPromptList(username, page, size, out int total, prompt);
            return Ok(new
            {
                success = true,
                data = list,
                total = total
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult DeleteUserPrompt(int id)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            bool result = _usersService.DeleteUserPrompt(id, username);
            return Ok(new
            {
                success = result
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> InputToCache(ChatDto chatDto)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            string cacheKey = $"{username}-{Guid.NewGuid().ToString("N")}-inputcache";
            await _redis.SetAsync(cacheKey, JsonConvert.SerializeObject(chatDto), TimeSpan.FromMinutes(5));
            return Json(new
            {
                success = true,
                data = cacheKey
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> ExportChat(string chatId, string type)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var chatlist = _ai.GetChatHistories(username, chatId, -1);

            if (chatlist == null || !chatlist.Any())
            {
                return NotFound("No chat history found");
            }

            string content = string.Empty;
            string mimeType = string.Empty;
            string fileExtension = string.Empty;

            switch (type.ToLower())
            {
                case "markdown":
                    mimeType = "text/markdown";
                    fileExtension = "md";
                    content = ConvertToMarkdown(chatlist);
                    break;
                case "html":
                    mimeType = "text/html";
                    fileExtension = "html";
                    content = ConvertToHtml(chatlist);
                    break;
                default:
                    return BadRequest("Invalid export type");
            }

            var byteArray = Encoding.UTF8.GetBytes(content);
            var stream = new MemoryStream(byteArray);

            return File(stream, mimeType, $"{Guid.NewGuid().ToString("N")}.{fileExtension}");
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> ExportChats(string chatIds, string type)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

            var chatIdList = chatIds.Split(',', StringSplitOptions.RemoveEmptyEntries);

            if (!chatIdList.Any())
            {
                return BadRequest("No chat IDs provided");
            }

            var memoryStream = new MemoryStream();
            try
            {
                using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
                {
                    foreach (var chatId in chatIdList)
                    {
                        var chatlist = _ai.GetChatHistories(username, chatId, -1);

                        if (chatlist == null || !chatlist.Any())
                        {
                            continue; // Skip if no chat history found for this chatId
                        }

                        string content = string.Empty;
                        string fileExtension = string.Empty;

                        switch (type.ToLower())
                        {
                            case "markdown":
                                fileExtension = "md";
                                content = ConvertToMarkdown(chatlist);
                                break;
                            case "html":
                                fileExtension = "html";
                                content = ConvertToHtml(chatlist);
                                break;
                            default:
                                return BadRequest("Invalid export type");
                        }

                        var entryName = $"{chatId}.{fileExtension}";
                        var entry = archive.CreateEntry(entryName);

                        using (var entryStream = entry.Open())
                        using (var writer = new StreamWriter(entryStream))
                        {
                            await writer.WriteAsync(content);
                        }
                    }
                }

                memoryStream.Seek(0, SeekOrigin.Begin);

                return File(memoryStream, "application/zip", $"chat_exports_{DateTime.Now:yyyyMMddHHmmss}.zip");
            }
            catch (Exception ex)
            {
                memoryStream.Dispose();
                // Log the exception
                return StatusCode(500, "An error occurred while exporting chats");
            }
        }

        private string ConvertToMarkdown(List<ChatHistory> chatlist)
        {
            var markdownContent = new StringBuilder();

            markdownContent.AppendLine("# Chat History");
            markdownContent.AppendLine();

            foreach (var chat in chatlist)
            {
                markdownContent.AppendLine($"**角色:** {chat.Role}");
                if (chat.Role == "assistant")
                    markdownContent.AppendLine($"**模型:** {chat.Model}");
                if (chat.Role == "user")
                {
                    markdownContent.AppendLine($"**账号:** {chat.Account}");
                    markdownContent.AppendLine($"**创建时间:** {chat.CreateTime}");
                }

                markdownContent.AppendLine();
                markdownContent.AppendLine(_systemService.DecodeBase64(chat.Chat));
                markdownContent.AppendLine("---");
            }

            return markdownContent.ToString();
        }

        private string ConvertToHtml(List<ChatHistory> chatlist)
        {
            var htmlContent = new StringBuilder();

            // 开始HTML文档
            htmlContent.AppendLine("<html><head>");

            // 引入 Bootstrap 4 和 highlight.js 的CDN
            htmlContent.AppendLine(
                "<link href=\"https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css\" rel=\"stylesheet\">");
            htmlContent.AppendLine(
                "<link rel=\"stylesheet\" href=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/default.min.css\">");
            htmlContent.AppendLine(
                "<script src=\"https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js\"></script>");

            // 初始化 highlight.js
            htmlContent.AppendLine("<script>");
            htmlContent.AppendLine("   document.addEventListener('DOMContentLoaded', (event) => {");
            htmlContent.AppendLine("       document.querySelectorAll('.assistant code').forEach((el) => {");
            htmlContent.AppendLine("           hljs.highlightElement(el);");
            htmlContent.AppendLine("       });");
            htmlContent.AppendLine("   });");
            htmlContent.AppendLine("</script>");

            // 自定义样式
            htmlContent.AppendLine("<style>");
            htmlContent.AppendLine("   .assistant code { padding: 10px; display: block; }");
            htmlContent.AppendLine(
                "   .user { background-color: #85c46c; padding: 10px; border-radius: 5px; margin-bottom: 10px; }");
            htmlContent.AppendLine("   .chat-container { max-width: 1000px; margin: auto; }");
            htmlContent.AppendLine("   .chat-item { border: 1px solid gray; border-radius: 10px; padding: 20px;}");
            htmlContent.AppendLine("</style>");

            // 继续HTML主体部分
            htmlContent.AppendLine("</head><body>");
            htmlContent.AppendLine("<div class='container chat-container'>");
            htmlContent.AppendLine("<h1 class='text-center'>Chat History</h1>");

            // 遍历聊天记录
            foreach (var chat in chatlist)
            {
                htmlContent.AppendLine("<div class='chat-item mb-4'>");
                htmlContent.AppendLine($"<p>角色: {chat.Role}</p>");
                if (chat.Role == "assistant")
                    htmlContent.AppendLine($"<p>模型: {chat.Model}</p>");
                if (chat.Role == "user")
                {
                    htmlContent.AppendLine($"<p>账号: {chat.Account}</p>");
                    htmlContent.AppendLine($"<p>创建时间: {chat.CreateTime}</p>");
                }

                var decodedChat = _systemService.DecodeBase64(chat.Chat); // 假设数据是Base64编码

                if (chat.Role == "assistant")
                {
                    htmlContent.AppendLine("<pre class='assistant'><code>");
                    htmlContent.AppendLine(System.Web.HttpUtility.HtmlEncode(decodedChat));
                    htmlContent.AppendLine("</code></pre>");
                }
                else if (chat.Role == "user")
                {
                    htmlContent.AppendLine(
                        $"<pre class='user'><code>{System.Web.HttpUtility.HtmlEncode(decodedChat)}</code></pre>");
                }
                else
                {
                    htmlContent.AppendLine($"<p>{System.Web.HttpUtility.HtmlEncode(decodedChat)}</p>");
                }

                htmlContent.AppendLine("</div>");
            }

            htmlContent.AppendLine("</div></body></html>");

            return htmlContent.ToString();
        }

        public IActionResult GetAIModelGroup()
        {
            var aimodels = _systemService.GetAImodel();
            var groups = aimodels.Select(a => a.ModelGroup).Distinct().ToList();
            return Json(new
            {
                success = true,
                data = groups
            });
        }
        public IActionResult GetAIModelPriceInfo(string group)
        {
            var query = from model in _context.AImodels
                        join price in _context.ModelPrices
                        on model.ModelName equals price.ModelName
                        select new
                        {
                            model.Id,
                            model.ModelNick,
                            model.ModelName,
                            model.ModelInfo,
                            model.ModelGroup,
                            model.VisionModel,
                            model.Seq,
                            model.Delay,
                            price.ModelPriceInput,
                            price.ModelPriceOutput,
                            price.VipModelPriceInput,
                            price.VipModelPriceOutput,
                            price.SvipModelPriceInput,
                            price.SvipModelPriceOutput,
                            price.Rebate,
                            price.VipRebate,
                            price.SvipRebate,
                            price.Maximum,
                            price.OnceFee,
                            price.VipOnceFee,
                            price.SvipOnceFee
                        };

            if (!string.IsNullOrEmpty(group))
            {
                if (group == "free")
                    query = query.Where(m =>
                        m.ModelPriceInput == 0 && m.ModelPriceOutput == 0 && m.VipModelPriceInput == 0 &&
                        m.VipModelPriceOutput == 0 && m.SvipModelPriceInput == 0 && m.SvipModelPriceOutput == 0 &&
                        m.OnceFee == 0 && m.VipOnceFee == 0 && m.SvipOnceFee == 0);
                else if (group == "vip")
                    query = query.Where(m =>
                        m.VipModelPriceInput == 0 &&
                        m.VipModelPriceOutput == 0 && m.SvipModelPriceInput == 0 && m.SvipModelPriceOutput == 0 &&
                        m.VipOnceFee == 0 && m.SvipOnceFee == 0);
                else if (group == "svip")
                    query = query.Where(m =>
                        m.SvipModelPriceInput == 0 && m.SvipModelPriceOutput == 0 && m.SvipOnceFee == 0);
                else
                    query = query.Where(m => m.ModelGroup == group);
            }
            query = query.OrderBy(m => m.Seq);
            var result = query.ToList();

            return Json(new
            {
                success = true,
                data = result
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult LockChat(string chatId)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var chatList = _context.ChatHistories.Where(c => c.ChatId == chatId && c.Account == username).ToList();
            if (chatList != null && chatList.Count > 0)
            {
                string encryptionKey = _systemService.CreateEncryptionKey();
                foreach (var chat in chatList)
                {
                    if (chat.IsLock == 1)
                    {
                        return Json(new
                        {
                            success = false,
                            data = "请勿重复加密"
                        });
                    }
                    chat.Chat = _systemService.CreateCipherText(chat.Chat, encryptionKey);
                    chat.IsLock = 1;
                }
                _context.SaveChanges();
                return Json(new
                {
                    success = true,
                    data = encryptionKey
                });
            }
            return Json(new
            {
                success = false,
                data = string.Empty
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult UnLockChat(string chatId, string encryptionKey)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var chatList = _context.ChatHistories.Where(c => c.ChatId == chatId && c.Account == username).ToList();
            if (chatList != null && chatList.Count > 0)
            {
                foreach (var chat in chatList)
                {
                    if (chat.IsLock == 0)
                    {
                        return Json(new
                        {
                            success = false,
                            data = "非加密状态无需解密"
                        });
                    }
                    chat.Chat = _systemService.DecryptWithKey(chat.Chat, encryptionKey);
                    chat.IsLock = 0;
                }
                _context.SaveChanges();
                return Json(new
                {
                    success = true,
                    data = encryptionKey
                });
            }
            return Json(new
            {
                success = false,
                data = string.Empty
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult PinnedChat(string chatId, bool pinned)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

            if (pinned)
            {
                // 检查当前置顶的聊天数量（按ChatId分组）
                var pinnedChatsCount = _context.ChatHistories
                    .Where(c => c.Account == username && c.IsTop.HasValue ? c.IsTop.Value : false)
                    .Select(c => c.ChatId)
                    .Distinct()
                    .Count();

                // 如果已经有10个置顶的聊天，并且当前聊天不在置顶列表中，则返回错误
                if (pinnedChatsCount >= 10 && !_context.ChatHistories.Any(c => c.ChatId == chatId && c.Account == username && c.IsTop.HasValue ? c.IsTop.Value : false))
                {
                    return Json(new { success = false, data = "最多允许置顶10条记录" });
                }
            }

            var chatList = _context.ChatHistories.Where(c => c.ChatId == chatId && c.Account == username).ToList();

            foreach (var chat in chatList)
            {
                chat.IsTop = pinned;
            }

            var success = _context.SaveChanges() > 0;

            return Json(new { success });
        }

        [Authorize]
        [HttpPost]
        public IActionResult UpdateCollectionTitle(string collectionCode, string collectionName)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var result = _usersService.UpdateCollectionTitle(collectionCode, collectionName, username, out string msg);
            return Json(new
            {
                success = result,
                msg = msg
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult DeleteCollection(string collectionCode)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var result = _usersService.DeleteCollection(collectionCode, username);
            return Json(new
            {
                success = result
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult GetCollection()
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var result = _usersService.GetCollection(username);
            return Json(new
            {
                success = true,
                data = result
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult SaveToCollection(string chatId, string collectionCode)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var result = _usersService.SaveToCollection(chatId, collectionCode, username);
            return Json(new
            {
                success = result
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> GetChatHistoryByCollection(string collectionCode)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var result = await _usersService.GetChatHistoryByCollection(collectionCode, username);
            return Json(new
            {
                success = true,
                data = result
            });
        }

        [Authorize]
        [HttpPost]
        public IActionResult BackHistoryList(string chatId, string collectionCode)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var result = _usersService.BackHistoryList(chatId, collectionCode, username);
            return Json(new
            {
                success = result
            });
        }

        [HttpPost]
        public async Task<IActionResult> GetTokenUsage(string filterType)
        {
            var tokenUsage = await _ai.GetTokenUsage(filterType);
            return Json(new
            {
                success = true,
                data = tokenUsage
            });
        }
    }
}