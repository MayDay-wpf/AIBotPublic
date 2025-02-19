using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using System.Threading;
using static OpenAI.ObjectModels.SharedModels.IOpenAiModels;

namespace aibotPro.Controllers
{
    public class OpenAllController : Controller
    {
        private readonly IAdminsService _adminsService;
        private readonly JwtTokenManager _jwtTokenManager;
        private readonly AIBotProContext _context;
        private readonly IFinanceService _financeService;
        private readonly ISystemService _systemService;
        private readonly IRedisService _redisService;
        private readonly IUsersService _usersService;
        public OpenAllController(IAdminsService adminsService, JwtTokenManager jwtTokenManager, AIBotProContext context, IFinanceService financeService, ISystemService systemService, IRedisService redisService, IUsersService usersService)
        {
            _adminsService = adminsService;
            _jwtTokenManager = jwtTokenManager;
            _context = context;
            _financeService = financeService;
            _systemService = systemService;
            _redisService = redisService;
            _usersService = usersService;
        }
        private string GetUserFromToken()
        {
            var cookie = Request.Cookies["token"];
            return _jwtTokenManager.ValidateToken(cookie)?.Identity?.Name;
        }
        public IActionResult Index()
        {
            return View();
        }
        public IActionResult GetVisitor()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult Consumption()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult UsersList()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult VipList()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult BlackList()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult OrderList()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult ErrBillingList()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult Payment()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult AiChatModelSetting()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult AiDrawModelSetting()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult WorkShopModelSetting()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult ModelPriceSetting()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult SystemConfig()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult AdminSetting()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult SystemLog()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult SystemNotice()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult MailNotice()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult AssistantSetting()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult Grounding()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult Goods()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }
        public IActionResult Limit()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Login", "Users");
            }
            return View();
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult GetVisitorView()
        {
            //查询视图
            var viewData = _context.IPlook_Stats_Views.AsNoTracking().ToList();
            return Json(viewData);
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> GetIps(int page, int page_size)
        {
            int total = 0;
            var ips = _adminsService.GetIps(page, page_size, out total);
            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = ips,
                total = total
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> GetUsedData(DateTime startTime, DateTime endTime)
        {
            var result = await _financeService.GetUsedData(startTime, endTime, "");
            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = result
            });

        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> GetLogs(int page, int page_size, string account)
        {
            int total = 0;
            var logs = _financeService.GetLogs(account, page, page_size, out total);
            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = logs,
                total = total
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> GetUsersList(int page, int page_size, string name)
        {
            int total = 0;
            var users = _adminsService.GetUsersList(page, page_size, name, 0, out total);
            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = users,
                total = total
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> GetBlackList(int page, int page_size, string name)
        {
            int total = 0;
            var users = _adminsService.GetUsersList(page, page_size, name, 1, out total);
            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = users,
                total = total
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> GetVipList(int page, int page_size, string name)
        {
            int total = 0;
            var vips = _adminsService.GetVipList(page, page_size, name, out total);
            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = vips,
                total = total
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult EditUserEdit(int id, int type)
        {
            var user = _context.Users.FirstOrDefault(x => x.Id == id);
            if (user == null)
            {
                return Json(new
                {
                    success = false,
                    msg = "用户不存在"
                });
            }
            user.IsBan = type;
            _context.Users.Update(user);
            var apikey = _context.APIKEYs.FirstOrDefault(x => x.Account == user.Account);
            if (apikey != null)
            {
                _context.APIKEYs.Remove(apikey);
            }
            _context.SaveChanges();
            return Json(new
            {
                success = true,
                msg = "操作成功"
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> Recharge(string account, decimal mcoin)
        {
            bool result = _financeService.UpdateUserMoney(account, mcoin, "add", out string errormsg);
            if (result)
            {
                await _systemService.WriteLog($"管理员充值余额：{mcoin}", Dtos.LogLevel.Info, account);
                return Json(new
                {
                    success = true,
                    msg = "充值成功"
                });
            }
            else
            {
                return Json(new
                {
                    success = false,
                    msg = errormsg
                });
            }
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> RechargeVip(string account, string viptype)
        {
            var user = _context.Users.FirstOrDefault(x => x.Account == account);
            if (viptype == "VIP|20")
            {
                var vipinfo = _context.VIPs.AsNoTracking().FirstOrDefault(x => x.Account == account && x.VipType == "VIP|20");
                if (vipinfo != null && vipinfo.VipType == "VIP|20")
                {
                    if (vipinfo.EndTime > DateTime.Now)
                    {
                        vipinfo.EndTime = vipinfo.EndTime.Value.AddDays(30);
                    }
                    else
                    {
                        vipinfo.EndTime = DateTime.Now.AddDays(30);
                    }
                    _context.VIPs.Update(vipinfo);
                }
                else
                {
                    VIP vip = new VIP();
                    vip.VipType = "VIP|20";
                    vip.Account = account;
                    vip.StartTime = DateTime.Now;
                    vip.EndTime = DateTime.Now.AddDays(30);
                    vip.CreateTime = DateTime.Now;
                    _context.VIPs.Add(vip);
                }
                _context.SaveChanges();
                await _systemService.WriteLog("管理员充值VIP|20", Dtos.LogLevel.Info, account);
            }
            else if (viptype == "VIP|50")
            {
                var vipinfo = _context.VIPs.AsNoTracking().FirstOrDefault(x => x.Account == account && x.VipType == "VIP|50");
                if (vipinfo != null && vipinfo.VipType == "VIP|50")
                {
                    if (vipinfo.EndTime > DateTime.Now)
                    {
                        vipinfo.EndTime = vipinfo.EndTime.Value.AddDays(30);
                    }
                    else
                    {
                        vipinfo.EndTime = DateTime.Now.AddDays(30);
                    }
                    _context.VIPs.Update(vipinfo);
                }
                else
                {
                    VIP vip = new VIP();
                    vip.VipType = "VIP|50";
                    vip.Account = account;
                    vip.StartTime = DateTime.Now;
                    vip.EndTime = DateTime.Now.AddDays(30);
                    vip.CreateTime = DateTime.Now;
                    _context.VIPs.Add(vip);
                }
                //user.Mcoin = user.Mcoin + 100;
                _context.Users.Update(user);
                _context.SaveChanges();
                await _systemService.WriteLog("管理员充值VIP|50", Dtos.LogLevel.Info, account);
            }
            else
            {
                return Json(new
                {
                    success = false,
                    msg = "VIP类型错误"
                });
            }
            return Json(new
            {
                success = true
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> CreateAccount(string account, string password)
        {
            var result = _adminsService.CreateAccount(account, password);
            if (result)
            {
                return Json(new
                {
                    success = true,
                    msg = "创建成功"
                });
            }
            else
            {
                return Json(new
                {
                    success = false,
                    msg = "创建失败"
                });
            }
        }


        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> GetOrderList(int page, int page_size, string account)
        {
            int total = 0;
            var orders = _financeService.GetOrders(account, page, page_size, out total);
            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = orders,
                total = total
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> GetErrorBilling(int page, int page_size, string account)
        {
            int total = 0;
            var errorBillings = _usersService.GetErrorBilling(account, page, page_size, out total);
            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = errorBillings,
                total = total
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult HandleErrorBilling(int id, int type, string reply)
        {
            bool result = _financeService.UpdateErrorBilling(id, type, reply, out string errMsg);
            return Json(new
            {
                success = result,
                msg = errMsg
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult GetLogInfo(int logId)
        {
            var data = _context.UseUpLogs.FirstOrDefault(x => x.Id == logId);
            return Json(new
            {
                success = true,
                data = data
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> SavePayment(int shopId, string apiKey, string submitUrl, string checkPayUrl, string notifyUrl, string returnUrl)
        {
            //判断是否已经配置过支付
            var easypaysetting = _financeService.GetEasyPaySetting();
            //如果为空则新增，如果不为空则修改
            if (easypaysetting == null)
            {
                EasyPaySetting setting = new EasyPaySetting();
                setting.ApiKey = apiKey;
                setting.CheckPayUrl = checkPayUrl;
                setting.NotifyUrl = notifyUrl;
                setting.ReturnUrl = returnUrl;
                setting.ShopId = shopId;
                setting.SubmitUrl = submitUrl;
                _context.EasyPaySettings.Add(setting);
            }
            else
            {
                easypaysetting.ApiKey = apiKey;
                easypaysetting.CheckPayUrl = checkPayUrl;
                easypaysetting.NotifyUrl = notifyUrl;
                easypaysetting.ReturnUrl = returnUrl;
                easypaysetting.ShopId = shopId;
                easypaysetting.SubmitUrl = submitUrl;
                _context.EasyPaySettings.Update(easypaysetting);
            }
            _context.SaveChanges();
            //写入缓存
            await _redisService.SetAsync("PayInfo", JsonConvert.SerializeObject(easypaysetting));
            return Json(new
            {
                success = true,
                msg = "保存成功"
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult GetPayInfo()
        {
            var payinfo = _financeService.GetEasyPaySetting();
            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = payinfo
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> SaveAiChatSetting(string aImodel)
        {
            List<AImodel> aImodels = JsonConvert.DeserializeObject<List<AImodel>>(aImodel);
            bool result = await _adminsService.SaveAiChatSetting(aImodels);
            if (result)
            {
                return Json(new
                {
                    success = true,
                    msg = "保存成功"
                });
            }
            else
            {
                return Json(new
                {
                    success = false,
                    msg = "保存失败"
                });
            }
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult GetChatSetting()
        {
            var chatSetting = _context.AImodels.AsNoTracking().ToList();
            chatSetting.Sort((x, y) => x.Seq.GetValueOrDefault().CompareTo(y.Seq));
            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = chatSetting
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult GetDrawSetting()
        {
            var drawSetting = _context.AIdraws.AsNoTracking().ToList();
            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = drawSetting
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult SaveDrawSetting(string type, string baseUrl, string apiKey, string channel)
        {
            var drawSetting = _context.AIdraws.AsNoTracking().FirstOrDefault(x => x.ModelName == type);
            //如果为空则新增，如果不为空则修改
            if (drawSetting == null)
            {
                AIdraw setting = new AIdraw();
                setting.ApiKey = apiKey;
                setting.BaseUrl = baseUrl;
                setting.ModelName = type;
                setting.Channel = channel;
                _context.AIdraws.Add(setting);
            }
            else
            {
                drawSetting.ApiKey = apiKey;
                drawSetting.BaseUrl = baseUrl;
                drawSetting.Channel = channel;
                _context.AIdraws.Update(drawSetting);
            }
            _context.SaveChanges();
            return Json(new
            {
                success = true,
                msg = "保存成功"
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult GetWorkShopSetting()
        {
            var workShopSetting = _context.WorkShopAIModels.AsNoTracking().ToList();
            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = workShopSetting
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> SaveWorkShopSetting([FromForm] List<WorkShopAIModel> workShopAIModel)
        {
            bool result = await _adminsService.SaveWorkShopAiChatSetting(workShopAIModel);
            if (result)
            {
                return Json(new
                {
                    success = true,
                    msg = "保存成功"
                });
            }
            else
            {
                return Json(new
                {
                    success = false,
                    msg = "保存失败"
                });
            }
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult GetAssistantSetting()
        {
            var workShopSetting = _context.AssistantModelPrices.AsNoTracking().ToList();
            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = workShopSetting
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> SaveAssistantSetting([FromForm] List<AssistantModelPrice> assistantModelPrices)
        {
            bool result = await _adminsService.SaveAssistantSetting(assistantModelPrices);
            if (result)
            {
                return Json(new
                {
                    success = true,
                    msg = "保存成功"
                });
            }
            else
            {
                return Json(new
                {
                    success = false,
                    msg = "保存失败"
                });
            }
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult GetModelPrice()
        {
            var modelPrice = _context.ModelPrices.AsNoTracking().ToList();
            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = modelPrice
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> SaveModelPrice(string modelPrice)
        {
            List<ModelPrice> modelPriceList = JsonConvert.DeserializeObject<List<ModelPrice>>(modelPrice);
            bool result = await _adminsService.SaveModelPrice(modelPriceList);
            if (result)
            {
                return Json(new
                {
                    success = true,
                    msg = "保存成功"
                });
            }
            else
            {
                return Json(new
                {
                    success = false,
                    msg = "保存失败"
                });
            }
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult GetSystemConfig()
        {
            var systemConfig = _context.SystemCfgs.AsNoTracking().ToList();
            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = systemConfig
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> SaveSystemConfig([FromForm] List<SystemCfg> systemCfg)
        {
            var result = await _adminsService.SaveSystemConfig(systemCfg);
            if (result)
            {
                return Json(new
                {
                    success = true,
                    msg = "保存成功"
                });
            }
            else
            {
                return Json(new
                {
                    success = false,
                    msg = "保存失败"
                });
            }
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> GetSystemLogs(int page, int page_size)
        {
            int total = 0;
            var logs = _adminsService.GetSystemLogs(page, page_size, out total);
            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = logs,
                total = total
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> GetAdminList(int page, int page_size)
        {
            int total = 0;
            var admins = _adminsService.GetAdminList(page, page_size, out total);
            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = admins,
                total = total
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult AddAdmin(string account)
        {
            var user = _context.Users.Where(x => x.Account == account).FirstOrDefault();
            if (user == null)
            {
                return Json(new
                {
                    success = false,
                    msg = "用户不存在"
                });
            }
            var admin = _context.Admins.Where(x => x.Account == account).FirstOrDefault();
            if (admin != null)
            {
                return Json(new
                {
                    success = false,
                    msg = "用户已经是管理员"
                });
            }
            Admin newAdmin = new Admin();
            newAdmin.Account = account;
            _context.Admins.Add(newAdmin);
            _context.SaveChanges();
            return Json(new
            {
                success = true,
                msg = "添加成功"
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public async Task<IActionResult> SendMail(string tomail, string mailtitle, string mailcontent)
        {
            var result = _systemService.SendEmail(tomail, mailtitle, mailcontent);
            if (result)
            {
                return Json(new
                {
                    success = true,
                    msg = "发送成功"
                });
            }
            else
            {
                return Json(new
                {
                    success = false,
                    msg = "发送失败"
                });
            }
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult SendSystemNotice(int id, string title, string content)
        {
            var result = _adminsService.SendNotice(id, title, content);
            if (result)
            {
                return Json(new
                {
                    success = true,
                    msg = "发送成功"
                });
            }
            else
            {
                return Json(new
                {
                    success = false,
                    msg = "发送失败"
                });
            }
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult GetSystemNoticeList(int page, int page_size)
        {
            int total = 0;
            var notices = _adminsService.GetNotices(page, page_size, out total);
            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = notices,
                total = total
            });
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult DeleteNotice(int id)
        {
            var notice = _context.Notices.Where(x => x.Id == id).FirstOrDefault();
            if (notice != null)
            {
                _context.Notices.Remove(notice);
                _context.SaveChanges();
                return Json(new
                {
                    success = true,
                    msg = "删除成功"
                });
            }
            else
            {
                return Json(new
                {
                    success = false,
                    msg = "删除失败"
                });
            }
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult CreateCards(string account, decimal mcoin, string viptype, int vipdays, int count)
        {
            //根据count生成卡密
            List<string> cards = new List<string>();
            for (int i = 0; i < count; i++)
            {
                string card = _systemService.ConvertToMD5(Guid.NewGuid().ToString(), 16, true);
                cards.Add(card);
            }
            //保存到数据库
            foreach (var card in cards)
            {
                Card newCard = new Card();
                newCard.CardNo = card;
                newCard.CreateTime = DateTime.Now;
                newCard.Used = 0;
                newCard.Mcoin = mcoin;
                newCard.VipType = viptype;
                newCard.VipDay = vipdays;
                newCard.Account = account;
                _context.Cards.Add(newCard);
            }
            _context.SaveChanges();
            return Json(new
            {
                success = true,
                msg = "生成成功",
                data = cards
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult DeleteAdmin(int id)
        {
            var admin = _context.Admins.FirstOrDefault(x => x.Id == id);
            if (admin == null)
            {
                return Json(new
                {
                    success = false,
                    msg = "管理员不存在"
                });
            }
            _context.Admins.Remove(admin);
            _context.SaveChanges();
            return Json(new
            {
                success = true,
                msg = "删除成功",
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult DeleteVip(string account)
        {
            var vip = _context.VIPs.FirstOrDefault(x => x.Account == account);
            if (vip == null)
            {
                return Json(new
                {
                    success = false,
                    msg = "VIP不存在"
                });
            }
            _context.VIPs.Remove(vip);
            _context.SaveChanges();
            return Json(new
            {
                success = true,
                msg = "删除成功",
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult ReleaseGood([FromForm] GoodReleaseDto model)
        {
            try
            {
                bool result = _financeService.ReleaseGood(model);
                // 逻辑处理
                return Json(new { success = result });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, msg = ex.Message });
            }
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult UploadGoodImage([FromForm] IFormFile file)
        {
            //保存图片
            string path = Path.Combine("wwwroot/files/goodsimages", $"{DateTime.Now.ToString("yyyyMMdd")}");   //$"wwwroot\\files\\pluginavatar\\{DateTime.Now.ToString("yyyyMMdd")}";
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
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
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult GetGoods(int pageIndex, int pageSize, string name, string onShelves)
        {
            bool? OnShelves = null;
            if (!string.IsNullOrEmpty(onShelves))
                OnShelves = bool.Parse(onShelves);
            var data = _financeService.GetGoods(name, pageIndex, pageSize, OnShelves, out int total);
            return Json(new { success = true, data = data, total = total });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult GetGood(string goodCode)
        {
            var data = _financeService.GetGood(goodCode);
            return Json(new { success = true, data = data });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult DeleteGood(string goodCode)
        {
            _context.Goods.Remove(_context.Goods.FirstOrDefault(x => x.GoodCode == goodCode));
            return _context.SaveChanges() > 0 ? Json(new { success = true }) : Json(new { success = false });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult PutonOrOffShelves(string goodCode, bool shelves)
        {
            var good = _context.Goods.FirstOrDefault(x => x.GoodCode == goodCode);
            if (good == null)
            {
                return Json(new { success = false, msg = "商品不存在" });
            }
            good.OnShelves = shelves;
            _context.Goods.Update(good);
            return _context.SaveChanges() > 0 ? Json(new { success = true }) : Json(new { success = false });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult SaveLimit(string account, List<string> selectedModels, int limitValue)
        {
            var hasUserLimit = _context.UsersLimits.Where(x => x.Account == account).FirstOrDefault();
            if (hasUserLimit != null)
            {
                return Json(new
                {
                    success = false,
                    msg = "该用户已存在限制，请先删除该用户再添加限制。"
                });
            }
            var usersLimit = new UsersLimit
            {
                Account = account,
                ModelName = string.Join(",", selectedModels),
                Limit = limitValue,
                Enable = true,
                CreateTime = DateTime.Now
            };
            _context.Add(usersLimit);
            return Json(new
            {
                success = _context.SaveChanges() > 0
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult EnableUsersLimits(int Id, bool enable)
        {
            var usersLimit = _adminsService.EnableUsersLimits(Id, enable);
            return Json(new
            {
                success = usersLimit
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult GetUsersLimits(int page, int size, string account = "")
        {
            var usersLimit = _adminsService.GetUsersLimits(page, size, out int total, account);
            return Json(new
            {
                data = usersLimit,
                total = total
            });
        }
        [Authorize(Policy = "AdminOnly")]
        [HttpPost]
        public IActionResult DeleteLimit(int id)
        {
            var userLimit = _context.UsersLimits.Where(x => x.Id == id).FirstOrDefault();
            if (userLimit != null)
            {
                _context.UsersLimits.Remove(userLimit);
                _context.SaveChanges();
            }
            return Json(new
            {
                success = true
            });
        }
    }
}
