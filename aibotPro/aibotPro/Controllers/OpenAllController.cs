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
        public OpenAllController(IAdminsService adminsService, JwtTokenManager jwtTokenManager, AIBotProContext context, IFinanceService financeService, ISystemService systemService, IRedisService redisService)
        {
            _adminsService = adminsService;
            _jwtTokenManager = jwtTokenManager;
            _context = context;
            _financeService = financeService;
            _systemService = systemService;
            _redisService = redisService;
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
                return RedirectToAction("Users", "Login");
            }
            return View();
        }
        public IActionResult Consumption()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Users", "Login");
            }
            return View();
        }
        public IActionResult UsersList()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Users", "Login");
            }
            return View();
        }
        public IActionResult VipList()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Users", "Login");
            }
            return View();
        }
        public IActionResult BlackList()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Users", "Login");
            }
            return View();
        }
        public IActionResult OrderList()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Users", "Login");
            }
            return View();
        }
        public IActionResult Payment()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Users", "Login");
            }
            return View();
        }
        public IActionResult AiChatModelSetting()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Users", "Login");
            }
            return View();
        }
        public IActionResult AiDrawModelSetting()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Users", "Login");
            }
            return View();
        }
        public IActionResult WorkShopModelSetting()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Users", "Login");
            }
            return View();
        }
        public IActionResult ModelPriceSetting()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Users", "Login");
            }
            return View();
        }
        public IActionResult SystemConfig()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Users", "Login");
            }
            return View();
        }
        public IActionResult AdminSetting()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Users", "Login");
            }
            return View();
        }
        public IActionResult SystemLog()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Users", "Login");
            }
            return View();
        }
        public IActionResult SystemNotice()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Users", "Login");
            }
            return View();
        }
        public IActionResult MailNotice()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Users", "Login");
            }
            return View();
        }
        public IActionResult AssistantSetting()
        {
            var username = GetUserFromToken();
            if (string.IsNullOrEmpty(username) || !_adminsService.IsAdmin(username))
            {
                return RedirectToAction("Users", "Login");
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
            if (viptype == "VIP|15")
            {
                var vipinfo = _context.VIPs.AsNoTracking().FirstOrDefault(x => x.Account == account && x.VipType == "VIP|15");
                if (vipinfo != null && vipinfo.VipType == "VIP|15")
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
                    vip.VipType = "VIP|15";
                    vip.Account = account;
                    vip.StartTime = DateTime.Now;
                    vip.EndTime = DateTime.Now.AddDays(30);
                    vip.CreateTime = DateTime.Now;
                    _context.VIPs.Add(vip);
                }
                _context.SaveChanges();
                await _systemService.WriteLog("管理员充值VIP|15", Dtos.LogLevel.Info, account);
            }
            else if (viptype == "VIP|90")
            {
                var vipinfo = _context.VIPs.AsNoTracking().FirstOrDefault(x => x.Account == account && x.VipType == "VIP|90");
                if (vipinfo != null && vipinfo.VipType == "VIP|90")
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
                    vip.VipType = "VIP|90";
                    vip.Account = account;
                    vip.StartTime = DateTime.Now;
                    vip.EndTime = DateTime.Now.AddDays(30);
                    vip.CreateTime = DateTime.Now;
                    _context.VIPs.Add(vip);
                }
                user.Mcoin = user.Mcoin + 100;
                _context.Users.Update(user);
                _context.SaveChanges();
                await _systemService.WriteLog("管理员充值VIP|90", Dtos.LogLevel.Info, account);
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
        public async Task<IActionResult> SaveAiChatSetting([FromForm] List<AImodel> aImodel)
        {
            bool result = await _adminsService.SaveAiChatSetting(aImodel);
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
        public IActionResult SaveDrawSetting(string type, string baseUrl, string apiKey)
        {
            var drawSetting = _context.AIdraws.AsNoTracking().FirstOrDefault(x => x.ModelName == type);
            //如果为空则新增，如果不为空则修改
            if (drawSetting == null)
            {
                AIdraw setting = new AIdraw();
                setting.ApiKey = apiKey;
                setting.BaseUrl = baseUrl;
                setting.ModelName = type;
                _context.AIdraws.Add(setting);
            }
            else
            {
                drawSetting.ApiKey = apiKey;
                drawSetting.BaseUrl = baseUrl;
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
        public async Task<IActionResult> SaveModelPrice([FromForm] List<ModelPrice> modelPrice)
        {
            bool result = await _adminsService.SaveModelPrice(modelPrice);
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
        public IActionResult SendSystemNotice(string content)
        {
            var result = _adminsService.SendNotice(content);
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
        [Authorize]
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
        [Authorize]
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
    }
}
