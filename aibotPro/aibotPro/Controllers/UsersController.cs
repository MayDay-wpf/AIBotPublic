using System.Net.Http.Headers;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using LogLevel = aibotPro.Dtos.LogLevel;

namespace aibotPro.Controllers;

public class UsersController : Controller
{
    //依赖注入
    private readonly AIBotProContext _context;
    private readonly IFinanceService _financeService;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly JwtTokenManager _jwtTokenManager;
    private readonly IRedisService _redis;
    private readonly ISystemService _systemService;
    private readonly IUsersService _usersService;

    public UsersController(AIBotProContext context, IUsersService usersService, ISystemService systemService,
        IRedisService redis, IHttpContextAccessor httpContextAccessor, JwtTokenManager jwtTokenManager,
        IFinanceService financeService)
    {
        _context = context;
        _usersService = usersService;
        _systemService = systemService;
        _redis = redis;
        _httpContextAccessor = httpContextAccessor;
        _jwtTokenManager = jwtTokenManager;
        _financeService = financeService;
    }

    public IActionResult Index()
    {
        return View();
    }

    public IActionResult Login()
    {
        return View();
    }

    public IActionResult Regiest()
    {
        return View();
    }

    public IActionResult ForgetPassword()
    {
        return View();
    }

    public IActionResult UserInfo()
    {
        return View();
    }

    public IActionResult Statistics()
    {
        return View();
    }

    public IActionResult Gallery()
    {
        return View();
    }

    public IActionResult Share()
    {
        return View();
    }

    public IActionResult NewApi()
    {
        return View();
    }

    /// <summary>
    ///     注册
    /// </summary>
    /// <param name="users">用户信息</param>
    /// <param name="checkCode">验证码</param>
    /// <returns></returns>
    [HttpPost]
    public IActionResult Regiest(User users, string checkCode, string shareCode)
    {
        var errormsg = string.Empty;
        if (string.IsNullOrEmpty(checkCode))
        {
            errormsg = "验证码不能为空";
            return Json(new { success = false, msg = errormsg });
        }

        if (string.IsNullOrEmpty(users.Account))
        {
            errormsg = "账号不能为空";
            return Json(new { success = false, msg = errormsg });
        }

        if (string.IsNullOrEmpty(users.Password))
        {
            errormsg = "密码不能为空";
            return Json(new { success = false, msg = errormsg });
        }

        if (string.IsNullOrEmpty(users.Nick))
        {
            errormsg = "昵称不能为空";
            return Json(new { success = false, msg = errormsg });
        }

        if (string.IsNullOrEmpty(users.Sex))
        {
            errormsg = "性别不能为空";
            return Json(new { success = false, msg = errormsg });
        }

        if (_usersService.Regiest(users, checkCode, shareCode, out errormsg))
            //return RedirectToAction("Login");
            return Json(new { success = true });

        ViewBag.ErrorMsg = errormsg;
        return Json(new { success = false, msg = errormsg });
    }

    [HttpPost]
    public IActionResult GetMailRestrict()
    {
        var systemCfg = _systemService.GetSystemCfgs();
        var mailRestrict = systemCfg.FirstOrDefault(x => x.CfgKey == "RegiestMail");
        string restrictStr = string.Empty;
        if (mailRestrict != null && mailRestrict.CfgValue != "0" && mailRestrict.CfgValue.Contains("."))
        {
            restrictStr = mailRestrict.CfgValue;
        }

        return Json(new
        {
            success = true,
            data = restrictStr
        });
    }

    /// <summary>
    ///     发送注册验证码
    /// </summary>
    /// <param name="toemail">注册邮箱</param>
    /// <returns></returns>
    [HttpPost]
    //public IActionResult SendRegiestEmail([FromBody] JsonElement requestBody)
    public async Task<IActionResult> SendRegiestEmail(string toemail, string checkCode, string codekey)
    {
        //string captchaVerifyParam = requestBody.GetProperty("captchaVerifyParam").GetString();
        //bool result = _systemService.AlibabaCaptchaAsync(captchaVerifyParam).Result;
        //if (!result)
        //{
        //    return Json(new
        //    {
        //        success = false,
        //        msg = "验证码错误",
        //        captchaVerifyResult = false
        //    });
        //}
        //string toemail = requestBody.GetProperty("toemail").GetString();
        if (string.IsNullOrEmpty(checkCode)) return Json(new { success = false, msg = "验证码不能为空" });
        if (string.IsNullOrEmpty(codekey)) return Json(new { success = false, msg = "验证码异常" });
        if (!await _usersService.CheckCodeImage("", checkCode, codekey))
            return Json(new { success = false, msg = "验证码错误" });
        var user = _context.Users.AsNoTracking().Where(x => x.Account == toemail).FirstOrDefault();
        if (user != null)
            return Json(new
            {
                success = false,
                msg = "用户已存在"
                //captchaVerifyResult = result
            });
        var title = "【注册验证】";
        var content = @"
                                <!DOCTYPE html>
                                <html lang='en'>
                                <head>
                                <meta charset='UTF-8'>
                                <meta http-equiv='X-UA-Compatible' content='IE=edge'>
                                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                                <title>验证码</title>
                                <style>
                                    body {
                                        background-color: #f0f7ff;
                                        font-family: Arial, sans-serif;
                                        text-align: center;
                                    }
                                    .container {
                                        max-width: 600px;
                                        margin: 50px auto;
                                        padding: 20px;
                                        border: 1px solid #bdd8eb;
                                        border-radius: 5px;
                                        background-color: #e1edf7;
                                    }
                                    h1 {
                                        color: #336699;
                                    }
                                    p {
                                        color: #333;
                                    }
                                </style>
                                </head>
                                <body>
                                    <div class='container'>
                                        <h1>注册验证码</h1>
                                        <p>您的注册验证码是：
                                          <h2>{{checkCode}}</h2>
                                          有效期10分钟。
                                        </p>
                                        <p>过期后需重新获取，请您尽快完成注册 <i>:-)</i></p>
                                    </div>
                                </body>
                                </html>
                            ";
        //非空判断
        //if (string.IsNullOrEmpty(captchaVerifyParam))
        //{
        //    return Json(new
        //    {
        //        success = false,
        //        msg = "参数不能为空",
        //    });
        //}
        var tomail = toemail.ToLower();
        try
        {
            var systemCfg = _systemService.GetSystemCfgs();
            var mailRestrict = systemCfg.FirstOrDefault(x => x.CfgKey == "RegiestMail");
            bool isValidEmail = true;
            string errorMessage = "";

            if (mailRestrict != null)
            {
                if (mailRestrict.CfgValue == "0")
                {
                    // 如果配置值为"0"，则没有限制
                }
                else
                {
                    if (!toemail.Contains("@"))
                    {
                        isValidEmail = false;
                        errorMessage = "请输入有效的邮箱地址";
                    }
                    else
                    {
                        // 过滤并清理域名列表
                        var allowedDomains = mailRestrict.CfgValue
                            .Split(new char[] { ',' }, StringSplitOptions.RemoveEmptyEntries)
                            .Select(d => d.Trim())
                            .Where(d => d.Contains("."))
                            .ToArray();

                        var emailDomain = toemail.Split('@').LastOrDefault()?.ToLower();

                        if (string.IsNullOrEmpty(emailDomain))
                        {
                            isValidEmail = false;
                            errorMessage = "请输入有效的邮箱地址";
                        }
                        else if (!allowedDomains.Any(domain => emailDomain.EndsWith(domain)))
                        {
                            if (allowedDomains.Length == 0)
                            {
                                errorMessage = "系统配置错误: 未正确设置允许的邮箱后缀";
                            }
                            else
                            {
                                errorMessage = $"只允许使用{string.Join(", ", allowedDomains)}的邮箱";
                            }

                            isValidEmail = false;
                        }
                    }
                }
            }

            if (!isValidEmail)
            {
                return Json(new
                {
                    success = false,
                    msg = errorMessage
                });
            }

            if (_usersService.SendRegiestEmail(toemail, title, content))
                return Json(new
                {
                    success = true,
                    msg = "发送成功"
                    //captchaVerifyResult = result
                });
            return Json(new
            {
                success = false,
                msg = "邮件发送失败"
                //captchaVerifyResult = false
            });
        }
        catch (Exception e)
        {
            await _systemService.WriteLog($"注册邮件发送失败：{e.Message}", LogLevel.Error, "system");
            return Json(new
            {
                success = false,
                msg = "邮件发送失败"
                //captchaVerifyResult = false
            });
        }
    }

    /// <summary>
    ///     用户登录
    /// </summary>
    /// <param name="account">账号</param>
    /// <param name="password">密码</param>
    /// <returns></returns>
    [HttpPost]
    public async Task<IActionResult> Login(string account, string password, string checkCode, string codekey)
    {
        var errormsg = string.Empty;
        var errorCountKey = $"{account}_passwordErrorCount";
        var errorCount = 0;
        if (!string.IsNullOrEmpty(await _redis.GetAsync(errorCountKey)))
            errorCount = Convert.ToInt32(await _redis.GetAsync(errorCountKey));
        if (string.IsNullOrEmpty(account))
        {
            errormsg = "账号不能为空";
            return Json(new { success = false, msg = errormsg, errorCount });
        }

        if (string.IsNullOrEmpty(password))
        {
            errormsg = "密码不能为空";
            return Json(new { success = false, msg = errormsg, errorCount });
        }

        if (string.IsNullOrEmpty(checkCode) && errorCount >= 3)
        {
            errormsg = "验证码不能为空";
            return Json(new { success = false, msg = errormsg, errorCount });
        }

        if (string.IsNullOrEmpty(codekey) && errorCount >= 3)
        {
            errormsg = "验证码异常";
            return Json(new { success = false, msg = errormsg, errorCount });
        }

        if (errorCount >= 3 && !await _usersService.CheckCodeImage("", checkCode, codekey))
        {
            errormsg = "验证码错误";
            return Json(new { success = false, msg = errormsg, errorCount });
        }

        var user = _context.Users.AsNoTracking().Where(x => x.Account == account).FirstOrDefault();
        if (user == null)
        {
            errormsg = "账号不存在";
            return Json(new { success = false, msg = errormsg, errorCount });
        }

        if (user.Password != _systemService.ConvertToMD5(password))
        {
            errormsg = "密码错误";
            errorCount++;
            await _redis.SetAsync(errorCountKey, errorCount.ToString());
            await _systemService.WriteLog("登录失败", LogLevel.Info, account);
            return Json(new { success = false, msg = errormsg, errorCount });
        }

        if (user.IsBan == 1)
        {
            errormsg = "账号已被禁用";
            return Json(new { success = false, msg = errormsg, errorCount });
        }

        //生成token
        await _redis.DeleteAsync(errorCountKey);
        var token = _jwtTokenManager.GenerateToken(user.Account);
        return Json(new { success = true, msg = "登录成功", token });
    }

    [HttpPost]
    public async Task<IActionResult> GenerateCodeImage(string key)
    {
        if (string.IsNullOrEmpty(key))
            return Json(new { success = true, data = "The key was not found" });
        var imagebase64 = await _usersService.GenerateCodeImage("", key);
        return Json(new { success = true, data = imagebase64 });
    }

    //判断用户是否登录
    [HttpPost]
    public IActionResult IsLogin()
    {
        var token = Request.Headers["Authorization"].ToString().Replace("Bearer ", "");
        if (_jwtTokenManager.isTokenValid(token))
            return Json(new { success = true, msg = "已登录" });
        return Json(new { success = false, msg = "未登录" });
    }

    [HttpPost]
    //public IActionResult SendFindPasswordEmail([FromBody] JsonElement requestBody)
    public async Task<IActionResult> SendFindPasswordEmail(string toemail, string checkCode, string codekey)
    {
        //string captchaVerifyParam = requestBody.GetProperty("captchaVerifyParam").GetString();
        //bool result = _systemService.AlibabaCaptchaAsync(captchaVerifyParam).Result;
        //if (!result)
        //{
        //    return Json(new
        //    {
        //        success = false,
        //        msg = "验证码错误",
        //        captchaVerifyResult = false
        //    });
        //}
        //string toemail = requestBody.GetProperty("toemail").GetString();
        //判断用户是否存在
        if (string.IsNullOrEmpty(checkCode)) return Json(new { success = false, msg = "验证码不能为空" });
        if (string.IsNullOrEmpty(codekey)) return Json(new { success = false, msg = "验证码异常" });
        if (!await _usersService.CheckCodeImage("", checkCode, codekey))
            return Json(new { success = false, msg = "验证码错误" });
        var user = _context.Users.AsNoTracking().Where(x => x.Account == toemail).FirstOrDefault();
        if (user == null)
            return Json(new
            {
                success = false,
                msg = "用户不存在"
                //captchaVerifyResult = result
            });
        var title = "【找回密码】";
        var content = @"
                                <!DOCTYPE html>
                                <html lang='en'>
                                <head>
                                <meta charset='UTF-8'>
                                <meta http-equiv='X-UA-Compatible' content='IE=edge'>
                                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                                <title>验证码</title>
                                <style>
                                    body {
                                        background-color: #f0f7ff;
                                        font-family: Arial, sans-serif;
                                        text-align: center;
                                    }
                                    .container {
                                        max-width: 600px;
                                        margin: 50px auto;
                                        padding: 20px;
                                        border: 1px solid #bdd8eb;
                                        border-radius: 5px;
                                        background-color: #e1edf7;
                                    }
                                    h1 {
                                        color: #336699;
                                    }
                                    p {
                                        color: #333;
                                    }
                                </style>
                                </head>
                                <body>
                                    <div class='container'>
                                        <h1>账号找回验证码</h1>
                                        <p>您的账号找回验证码是：<strong>{{checkCode}}</strong>，有效期10分钟。</p>
                                        <p>过期后需重新获取，请您尽快完成找回验证 <i>:-)</i></p>
                                    </div>
                                </body>
                                </html>
                            ";
        //非空判断
        //if (string.IsNullOrEmpty(captchaVerifyParam))
        //{
        //    return Json(new
        //    {
        //        success = false,
        //        msg = "参数不能为空",
        //    });
        //}
        var tomail = toemail.ToLower();
        if (!toemail.Contains("qq.com") && !toemail.Contains("gmail.com") && !toemail.Contains("163.com") &&
            !toemail.Contains("126.com"))
            return Json(new
            {
                success = false,
                msg = "只允许使用qq,gmail,163,126邮箱"
                //captchaVerifyResult = result
            });
        if (_usersService.SendFindEmail(toemail, title, content))
            return Json(new
            {
                success = true,
                msg = "发送成功"
                //captchaVerifyResult = result
            });
        return Json(new
        {
            success = false,
            msg = "邮件发送失败",
            captchaVerifyResult = false
        });
    }

    [HttpPost]
    public IActionResult FindPassword(string account, string password, string checkCode)
    {
        var errormsg = string.Empty;
        if (string.IsNullOrEmpty(account))
        {
            errormsg = "账号不能为空";
            return Json(new { success = false, msg = errormsg });
        }

        if (string.IsNullOrEmpty(password))
        {
            errormsg = "密码不能为空";
            return Json(new { success = false, msg = errormsg });
        }

        if (string.IsNullOrEmpty(checkCode))
        {
            errormsg = "验证码不能为空";
            return Json(new { success = false, msg = errormsg });
        }

        if (_usersService.FindPassword(account, password, checkCode, out errormsg))
            return Json(new { success = true, msg = "修改成功" });
        return Json(new { success = false, msg = errormsg });
    }

    [Authorize]
    [HttpPost]
    public IActionResult GetUserInfo()
    {
        var userName = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var userInfo = _usersService.GetUserData(userName);
        return Ok(new { success = true, data = userInfo });
    }

    [Authorize]
    [HttpPost]
    public IActionResult UploadAvatar([FromForm] IFormFile file)
    {
        //保存图片
        var path = Path.Combine("wwwroot/files/usersavatar",
            $"{DateTime.Now.ToString("yyyyMMdd")}"); //$"wwwroot\\files\\pluginavatar\\{DateTime.Now.ToString("yyyyMMdd")}";
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        if (string.IsNullOrEmpty(username))
            return Json(new
            {
                success = false,
                msg = "账号异常"
            });
        var fileName = _systemService.SaveFiles(path, file, username);
        //返回文件名
        return Json(new
        {
            success = true,
            filePath = fileName
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult SaveUserInfo(string nick, string avatar)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        if (string.IsNullOrEmpty(username))
            return Json(new
            {
                success = false,
                msg = "账号异常"
            });
        var users = _context.Users.Where(x => x.Account == username).FirstOrDefault();
        users.Nick = nick;
        users.HeadImg = avatar;
        _context.Users.Update(users);
        if (_context.SaveChanges() > 0)
            return Json(new
            {
                success = true,
                msg = "保存成功"
            });
        return Json(new
        {
            success = false,
            msg = "保存失败"
        });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> IsVIP()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        if (string.IsNullOrEmpty(username))
            return Json(new
            {
                success = false,
                msg = "账号异常"
            });
        var result = await _financeService.IsVip(username);
        if (result)
        {
            var vipdata = await _financeService.GetVipData(username);
            //取过期时间最晚的
            vipdata = vipdata.OrderByDescending(x => x.EndTime).ToList();
            return Json(new
            {
                success = true,
                msg = "是VIP",
                data = vipdata
            });
        }

        return Json(new
        {
            success = false,
            msg = "不是VIP"
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult GetTopVipType()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        if (string.IsNullOrEmpty(username))
            return Json(new
            {
                success = false,
                msg = "账号异常"
            });

        var currentTime = DateTime.Now;
        var vipdata = _context.VIPs
            .Where(x => x.Account == username && x.EndTime > currentTime)
            .ToList();

        string topVipType = "";

        // 定义VIP类型的优先级
        var vipPriority = new Dictionary<string, int>
        {
            { "VIP|15", 1 },
            { "VIP|50", 2 },
            { "VIP|90", 3 } // VIP|90 是最高等级
        };

        int highestPriority = 0;

        foreach (var vip in vipdata)
        {
            if (vipPriority.TryGetValue(vip.VipType, out int priority))
            {
                if (priority > highestPriority)
                {
                    highestPriority = priority;
                    topVipType = vip.VipType;
                }
            }
        }

        return Json(new
        {
            success = true,
            data = topVipType
        });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> VipExceed()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var result = await _financeService.VipExceed(username);
        return Json(new
        {
            success = true,
            data = result
        });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> GetOrders(int page, int page_size)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        if (string.IsNullOrEmpty(username))
            return Json(new
            {
                success = false,
                msg = "账号异常"
            });
        var total = 0;
        var orders = _financeService.GetOrders(username, page, page_size, out total);
        return Json(new
        {
            success = true,
            msg = "获取成功",
            data = orders,
            total
        });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> CheckUserOrder(string orderCode)
    {
        //查询订单详情
        var thisorder = _context.Orders.Where(x => x.OrderCode == orderCode && x.OrderStatus == "NO").FirstOrDefault();
        if (thisorder == null)
            return Json(new
            {
                success = false,
                msg = "订单不存在"
            });
        var payRes = _financeService.PayResult(orderCode);
        if (payRes.status == "1")
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var user = _context.Users.FirstOrDefault(x => x.Account == username);
            var intomoney = Convert.ToDecimal(thisorder.OrderMoney);
            if (thisorder.OrderType.Contains("VIP|20") && intomoney == 15)
            {
                var vipinfo = _context.VIPs.AsNoTracking()
                    .FirstOrDefault(x => x.Account == username && x.VipType == "VIP|20");
                if (vipinfo != null && vipinfo.VipType == "VIP|20")
                {
                    if (vipinfo.EndTime > DateTime.Now)
                        vipinfo.EndTime = vipinfo.EndTime.Value.AddDays(30);
                    else
                        vipinfo.EndTime = DateTime.Now.AddDays(30);
                    _context.VIPs.Update(vipinfo);
                }
                else
                {
                    var vip = new VIP();
                    vip.VipType = "VIP|20";
                    vip.Account = username;
                    vip.StartTime = DateTime.Now;
                    vip.EndTime = DateTime.Now.AddDays(30);
                    vip.CreateTime = DateTime.Now;
                    _context.VIPs.Add(vip);
                }

                //查询是否有上级
                var shareinfo = _context.Shares.AsNoTracking().FirstOrDefault(x => x.Account == username);
                if (shareinfo != null && shareinfo.ParentAccount != "admin")
                {
                    var parentShareCode = _context.Shares.AsNoTracking()
                        .FirstOrDefault(x => x.Account == shareinfo.ParentAccount);
                    _usersService.UpdateShareMcoinAndWriteLog(parentShareCode.ShareCode, 15m * 0.15m);
                }
            }
            else if (thisorder.OrderType.Contains("VIP|50") && intomoney == 50)
            {
                var vipinfo = _context.VIPs.AsNoTracking()
                    .FirstOrDefault(x => x.Account == username && x.VipType == "VIP|50");
                if (vipinfo != null && vipinfo.VipType == "VIP|50")
                {
                    if (vipinfo.EndTime > DateTime.Now)
                        vipinfo.EndTime = vipinfo.EndTime.Value.AddDays(30);
                    else
                        vipinfo.EndTime = DateTime.Now.AddDays(30);
                    _context.VIPs.Update(vipinfo);
                }
                else
                {
                    var vip = new VIP();
                    vip.VipType = "VIP|50";
                    vip.Account = username;
                    vip.StartTime = DateTime.Now;
                    vip.EndTime = DateTime.Now.AddDays(30);
                    vip.CreateTime = DateTime.Now;
                    _context.VIPs.Add(vip);
                }

                //查询是否有上级
                var shareinfo = _context.Shares.AsNoTracking().FirstOrDefault(x => x.Account == username);
                if (shareinfo != null && shareinfo.ParentAccount != "admin")
                {
                    var parentShareCode = _context.Shares.AsNoTracking()
                        .FirstOrDefault(x => x.Account == shareinfo.ParentAccount);
                    _usersService.UpdateShareMcoinAndWriteLog(parentShareCode.ShareCode, 90m * 0.15m);
                }

                user.Mcoin = user.Mcoin + intomoney;
                _context.Users.Update(user);
            }
            else if (thisorder.OrderType.Contains("MALL"))
            {
                var goodCode = thisorder.OrderType.Split('|')[0];
                var good = _context.Goods.AsNoTracking().FirstOrDefault(x => x.GoodCode == goodCode);
                if (good != null)
                {
                    //检查金额是否正确
                    if (good.GoodPrice != intomoney) return Ok("fail");

                    //查询是否有上级
                    var shareinfo = _context.Shares.AsNoTracking().FirstOrDefault(x => x.Account == username);
                    if (shareinfo != null && shareinfo.ParentAccount != "admin")
                    {
                        var parentShareCode = _context.Shares.AsNoTracking()
                            .FirstOrDefault(x => x.Account == shareinfo.ParentAccount);
                        _usersService.UpdateShareMcoinAndWriteLog(parentShareCode.ShareCode, intomoney * 0.15m);
                    }

                    if (good.Balance > 0)
                        //更新用户余额
                        user.Mcoin = user.Mcoin + good.Balance;
                    if (good.VIPType == "VIP|20")
                    {
                        var vipinfo = _context.VIPs.AsNoTracking()
                            .FirstOrDefault(x => x.Account == username && x.VipType == "VIP|20");
                        if (vipinfo != null && vipinfo.VipType == "VIP|20")
                        {
                            if (vipinfo.EndTime > DateTime.Now)
                                vipinfo.EndTime = vipinfo.EndTime.Value.AddDays((double)good.VIPDays);
                            else
                                vipinfo.EndTime = DateTime.Now.AddDays((double)good.VIPDays);
                            _context.VIPs.Update(vipinfo);
                        }
                        else
                        {
                            var vip = new VIP();
                            vip.VipType = "VIP|20";
                            vip.Account = username;
                            vip.StartTime = DateTime.Now;
                            vip.EndTime = DateTime.Now.AddDays((double)good.VIPDays);
                            vip.CreateTime = DateTime.Now;
                            _context.VIPs.Add(vip);
                        }
                    }

                    if (good.VIPType == "VIP|50")
                    {
                        var vipinfo = _context.VIPs.AsNoTracking()
                            .FirstOrDefault(x => x.Account == username && x.VipType == "VIP|50");
                        if (vipinfo != null && vipinfo.VipType == "VIP|50")
                        {
                            if (vipinfo.EndTime > DateTime.Now)
                                vipinfo.EndTime = vipinfo.EndTime.Value.AddDays((double)good.VIPDays);
                            else
                                vipinfo.EndTime = DateTime.Now.AddDays((double)good.VIPDays);
                            _context.VIPs.Update(vipinfo);
                        }
                        else
                        {
                            var vip = new VIP();
                            vip.VipType = "VIP|50";
                            vip.Account = username;
                            vip.StartTime = DateTime.Now;
                            vip.EndTime = DateTime.Now.AddDays((double)good.VIPDays);
                            vip.CreateTime = DateTime.Now;
                            _context.VIPs.Add(vip);
                        }
                    }

                    _context.Users.Update(user);
                    await _financeService.UpdateGoodsStock(goodCode, 1);
                }
            }
            else
            {
                //查询是否有上级
                var shareinfo = _context.Shares.AsNoTracking().FirstOrDefault(x => x.Account == username);
                if (shareinfo != null && shareinfo.ParentAccount != "admin")
                {
                    var parentShareCode = _context.Shares.AsNoTracking()
                        .FirstOrDefault(x => x.Account == shareinfo.ParentAccount);
                    _usersService.UpdateShareMcoinAndWriteLog(parentShareCode.ShareCode, intomoney * 0.15m);
                }

                //更新用户余额
                user.Mcoin = user.Mcoin + intomoney;
                _context.Users.Update(user);
            }

            thisorder.OrderStatus = "YES";
            _context.Orders.Update(thisorder);
            _context.SaveChanges();
            return Json(new
            {
                success = true,
                msg = "支付成功"
            });
        }

        return Json(new
        {
            success = false,
            msg = "未支付"
        });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> GetUsedData(DateTime startTime, DateTime endTime)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        if (string.IsNullOrEmpty(username))
            return Json(new
            {
                success = false,
                msg = "账号异常"
            });
        var result = await _financeService.GetUsedData(startTime, endTime, username);
        return Json(new
        {
            success = true,
            msg = "获取成功",
            data = result
        });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> GetLogs(int page, int page_size)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        if (string.IsNullOrEmpty(username))
            return Json(new
            {
                success = false,
                msg = "账号异常"
            });
        var total = 0;
        var logs = _financeService.GetLogs(username, page, page_size, out total);
        return Json(new
        {
            success = true,
            msg = "获取成功",
            data = logs,
            total
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult getUserSetting()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var userSetting = _usersService.GetUserSetting(username);
        return Json(new
        {
            success = true,
            msg = "获取成功",
            data = userSetting
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult IsAdmin()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var result = _usersService.IsAdmin(username);
        return Json(new
        {
            success = result,
            msg = "获取成功"
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult IsBlackUser()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var result = _usersService.GetUserData(username);
        return Json(new
        {
            success = true,
            data = result
        });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> SignIn()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var vipdata = await _financeService.GetVipData(username);
        //如果是VIP|50
        if (vipdata.Where(x => x.VipType == "VIP|50" || x.VipType == "VIP|90").Count() > 0)
        {
            //查询今天是否已签到
            var sign = _context.SignIns.AsNoTracking()
                .Where(x => x.Account == username && x.CreateTime.Value.Date == DateTime.Now.Date).FirstOrDefault();
            if (sign != null)
                return Json(new
                {
                    success = false,
                    msg = "今天已签到,明天再来吧！"
                });
            var user = _context.Users.FirstOrDefault(x => x.Account == username);
            //余额随机增加0.5~1
            var random = new Random();
            // 生成0.5到1(不包含)之间的随机小数
            var money = Convert.ToDecimal(random.NextDouble() * 0.5 + 0.5);
            user.Mcoin = user.Mcoin + money;
            _context.Users.Update(user);
            //记录签到
            var signInLog = new SignIn();
            signInLog.Account = username;
            signInLog.CreateTime = DateTime.Now;
            _context.SignIns.Add(signInLog);
            _context.SaveChanges();
            return Json(new
            {
                success = true,
                msg = $"签到成功 余额+{money}",
                data = 10
            });
        }

        return Json(new
        {
            success = false,
            msg = "不是高级会员，无法签到"
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult ExchangeCard(string cardno)
    {
        //查询卡密
        var card = _context.Cards.Where(x => x.CardNo == cardno).FirstOrDefault();
        if (card == null)
            return Json(new
            {
                success = false,
                msg = "卡密不存在"
            });
        if (card.Used == 1)
            return Json(new
            {
                success = false,
                msg = "卡密已使用"
            });
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var user = _context.Users.FirstOrDefault(x => x.Account == username);
        if (card.Mcoin > 0)
            //更新用户余额
            user.Mcoin = user.Mcoin + card.Mcoin;
        if (card.VipType == "VIP|20")
        {
            var vipinfo = _context.VIPs.AsNoTracking()
                .FirstOrDefault(x => x.Account == username && x.VipType == "VIP|20");
            if (vipinfo != null && vipinfo.VipType == "VIP|20")
            {
                if (vipinfo.EndTime > DateTime.Now)
                    vipinfo.EndTime = vipinfo.EndTime.Value.AddDays((double)card.VipDay);
                else
                    vipinfo.EndTime = DateTime.Now.AddDays((double)card.VipDay);
                _context.VIPs.Update(vipinfo);
            }
            else
            {
                var vip = new VIP();
                vip.VipType = "VIP|20";
                vip.Account = username;
                vip.StartTime = DateTime.Now;
                vip.EndTime = DateTime.Now.AddDays((double)card.VipDay);
                vip.CreateTime = DateTime.Now;
                _context.VIPs.Add(vip);
            }
        }

        if (card.VipType == "VIP|50")
        {
            var vipinfo = _context.VIPs.AsNoTracking()
                .FirstOrDefault(x => x.Account == username && x.VipType == "VIP|50");
            if (vipinfo != null && vipinfo.VipType == "VIP|50")
            {
                if (vipinfo.EndTime > DateTime.Now)
                    vipinfo.EndTime = vipinfo.EndTime.Value.AddDays((double)card.VipDay);
                else
                    vipinfo.EndTime = DateTime.Now.AddDays((double)card.VipDay);
                _context.VIPs.Update(vipinfo);
            }
            else
            {
                var vip = new VIP();
                vip.VipType = "VIP|50";
                vip.Account = username;
                vip.StartTime = DateTime.Now;
                vip.EndTime = DateTime.Now.AddDays((double)card.VipDay);
                vip.CreateTime = DateTime.Now;
                _context.VIPs.Add(vip);
            }
        }

        card.Used = 1;
        card.UseAccount = username;
        _context.Cards.Update(card);
        _context.Users.Update(user);
        _context.SaveChanges();
        return Json(new
        {
            success = true,
            msg = "兑换成功"
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult CreateShareLink()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var shareLink = _usersService.CreateShareLink(username);
        return Json(new
        {
            success = true,
            msg = "获取成功",
            data = shareLink
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult GetShareInfo()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var shareInfo = _usersService.GetShareInfo(username);
        return Json(new
        {
            success = true,
            msg = "获取成功",
            data = shareInfo
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult GetMyShare(int page, int pageSize)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var total = 0;
        var shareInfo = _usersService.GetMyShare(username, page, pageSize, out total);
        var share = new List<Share>();
        foreach (var item in shareInfo)
        {
            //隐藏账号
            var account = item.Account.Substring(0, 3) + "****";
            share.Add(
                new Share
                {
                    Account = account,
                    CreateTime = item.CreateTime
                });
        }

        return Json(new
        {
            success = true,
            msg = "获取成功",
            data = share,
            total
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult GetShareLog(int page, int pageSize)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var total = 0;
        var shareLog = _usersService.GetShareLog(username, page, pageSize, out total);
        return Json(new
        {
            success = true,
            msg = "获取成功",
            data = shareLog,
            total
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult McoinToMcoin()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var shareInfo = _usersService.GetShareInfo(username);
        if (shareInfo.Mcoin > 0)
        {
            var mcoin = shareInfo.Mcoin.Value;
            _usersService.UpdateShareMcoinAndWriteLog(shareInfo.ShareCode, -mcoin);
            _financeService.UpdateUserMoney(username, mcoin, "add", out var err);
            return Json(new
            {
                success = true,
                msg = "转换成功"
            });
        }

        return Json(new
        {
            success = false,
            msg = "没有可转换余额"
        });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> McoinToMoney(string aliAccount)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var shareInfo = _usersService.GetShareInfo(username);
        if (shareInfo.Mcoin > 0)
        {
            if (shareInfo.Mcoin < 10)
                return Json(new
                {
                    success = false,
                    msg = "余额不足10元，无法提现"
                });
            var mcoin = shareInfo.Mcoin.Value;
            _usersService.UpdateShareMcoinAndWriteLog(shareInfo.ShareCode, -mcoin);
            if (_financeService.CreateTXorder(username, aliAccount, mcoin))
            {
                //发送邮件给管理员
                _systemService.SendEmail("maymay5jace@gmail.com", "提现申请", $"账号【{username}】，有一笔【{mcoin}】元的提现订单待处理");
                await _systemService.WriteLog($"账号【{username}】，有一笔【{mcoin}】元的提现订单待处理", LogLevel.Info, username);
                return Json(new
                {
                    success = true,
                    msg = "提现申请已提交"
                });
            }

            return Json(new
            {
                success = false,
                msg = "提现申请提交失败"
            });
        }

        return Json(new
        {
            success = false,
            msg = "没有可提现余额"
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult ErrorBilling(int id, decimal useMoney, string cause)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var result = _financeService.CreateErrorBilling(id, useMoney, cause, username, out var errMsg);
        return Json(new
        {
            success = result,
            msg = errMsg
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult GetErrorBilling(int page, int page_size)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var total = 0;
        var billLog = _usersService.GetErrorBilling(username, page, page_size, out total);
        return Json(new
        {
            success = true,
            msg = "获取成功",
            data = billLog,
            total
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult GetBalance()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var users = _context.Users.Where(x => x.Account == username).FirstOrDefault();
        decimal? balance = 0;
        if (users != null)
            balance = users.Mcoin;
        return Json(new
        {
            success = true,
            msg = "获取成功",
            data = balance
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult IsSupperVIP()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var isSupperVIP = _usersService.IsSupperVIP(username);
        return Json(new
        {
            success = isSupperVIP
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult GetThisMonthSignInList()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var thisMonthList = _usersService.GetThisMonthSignInList(username);
        return Json(new
        {
            success = true,
            data = thisMonthList
        });
    }

    [HttpGet]
    public IActionResult InitiateGoogleLogin()
    {
        var systemCfgs = _systemService.GetSystemCfgs();
        var clientId = systemCfgs.FirstOrDefault(x => x.CfgKey == "GoogleClientID")?.CfgValue;
        var redirectUri = Url.Action("HandleGoogleCallback", "Users", null, Request.Scheme,
            Request.Host.ToUriComponent());

        var authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
        var scope = "openid email profile";

        var authorizationRequest = new UriBuilder(authorizationEndpoint);
        authorizationRequest.Query = string.Format(
            "client_id={0}&redirect_uri={1}&response_type=id_token&scope={2}&nonce={3}",
            clientId, Uri.EscapeDataString(redirectUri), Uri.EscapeDataString(scope), Guid.NewGuid().ToString());

        return Redirect(authorizationRequest.ToString());
    }

    [HttpGet]
    public IActionResult HandleGoogleCallback()
    {
        return View();
    }

    [HttpGet]
    public IActionResult InitiateGitHubLogin()
    {
        var systemCfgs = _systemService.GetSystemCfgs();
        var clientId = systemCfgs.FirstOrDefault(x => x.CfgKey == "GitHubClientID")?.CfgValue;

        var redirectUri = Url.Action("HandleGitHubCallback", "Users", null, Request.Scheme,
            Request.Host.ToUriComponent());
        var scope = "user:email";

        var authorizationEndpoint = "https://github.com/login/oauth/authorize";
        var authorizationRequest = new UriBuilder(authorizationEndpoint);
        authorizationRequest.Query = string.Format("client_id={0}&redirect_uri={1}&scope={2}",
            clientId, Uri.EscapeDataString(redirectUri), Uri.EscapeDataString(scope));

        return Redirect(authorizationRequest.ToString());
    }

    [HttpGet]
    public IActionResult HandleGitHubCallback(string code)
    {
        return View();
    }
    [HttpPost]
    public IActionResult GoogleOAuth(string JWT, string redirect)
    {
        // 解析JWT
        JwtTokenManager.GoogleJWT googleJwt = _jwtTokenManager.DecodeGoogleJwtToken(JWT);
        string email = googleJwt.payload.email;
        string nick = googleJwt.payload.name;
        string headImg = googleJwt.payload.picture;
        //检查用户是否存在
        var user = _context.Users.AsNoTracking().Where(u => u.Account == email).FirstOrDefault();
        string token = string.Empty;
        if (user != null)
        {
            //直接登录
            token = _jwtTokenManager.GenerateToken(user.Account);
            return Json(new { success = true, msg = "登录成功", token });
        }
        else
        {
            //注册后登录
            token = _usersService.GetRegisterTokenByAnother(email, nick, headImg);
        }

        return Json(new { success = string.IsNullOrEmpty(token) ? false : true, token });
    }

    public async Task<IActionResult> GitHubOAuth(string code)
    {
        Dtos.GitHubCallback result = new Dtos.GitHubCallback();
        if (string.IsNullOrEmpty(code))
        {
            result.Token = string.Empty;
            result.Msg = "授权失败";
        }

        var systemCfgs = _systemService.GetSystemCfgs();
        var clientId = systemCfgs.FirstOrDefault(x => x.CfgKey == "GitHubClientID")?.CfgValue;
        var clientSecret = systemCfgs.FirstOrDefault(x => x.CfgKey == "GitHubSecret")?.CfgValue;

        var tokenEndpoint = "https://github.com/login/oauth/access_token";
        var content = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("client_id", clientId),
            new KeyValuePair<string, string>("client_secret", clientSecret),
            new KeyValuePair<string, string>("code", code)
        });

        var response = await new HttpClient().PostAsync(tokenEndpoint, content);
        var responseString = await response.Content.ReadAsStringAsync();
        var responseParams = System.Web.HttpUtility.ParseQueryString(responseString);
        var accessToken = responseParams["access_token"];

        if (string.IsNullOrEmpty(accessToken))
        {
            result.Token = string.Empty;
            result.Msg = "授权失败";
        }

        var userInfoEndpoint = "https://api.github.com/user";
        var httpclient = new HttpClient();
        httpclient.DefaultRequestHeaders.Add("Authorization", $"token {accessToken}");
        httpclient.DefaultRequestHeaders.Add("User-Agent", "AIBotPRO");
        var userInfoResponse = await httpclient.GetAsync(userInfoEndpoint);
        var userInfo = await userInfoResponse.Content.ReadAsStringAsync();
        // 解析用户信息
        var userInfoObj = JsonConvert.DeserializeObject<Dtos.GitHubUserInfo>(userInfo);

        // 获取用户邮箱
        var emailEndpoint = "https://api.github.com/user/emails";
        var emailResponse = await httpclient.GetAsync(emailEndpoint);
        var emailInfo = await emailResponse.Content.ReadAsStringAsync();

        // 解析邮箱信息
        var emailList = JsonConvert.DeserializeObject<List<Dtos.GitHubEmail>>(emailInfo);
        var primaryEmail = emailList?.FirstOrDefault(e => e.Primary)?.Email;

        if (string.IsNullOrEmpty(primaryEmail))
        {
            result.Token = string.Empty;
            result.Msg = "获取邮箱失败";
        }

        // 调用 GitHubOAuth 方法
        result.Token = GitHubOAuth(primaryEmail, userInfoObj.name ?? userInfoObj.login, userInfoObj.avatar_url);

        if (string.IsNullOrEmpty(result.Token))
        {
            result.Token = string.Empty;
            result.Msg = "系统异常,未生成令牌";
        }

        // 返回包含 token 的视图
        return Json(new
        {
            success = string.IsNullOrEmpty(result.Token) ? false : true,
            data = result
        });
    }

    private string GitHubOAuth(string email, string nick, string headImg)
    {
        var user = _context.Users.AsNoTracking().Where(u => u.Account == email).FirstOrDefault();
        string token = string.Empty;
        if (user != null)
        {
            //直接登录
            token = _jwtTokenManager.GenerateToken(user.Account);
        }
        else
        {
            //注册后登录
            token = _usersService.GetRegisterTokenByAnother(email, nick, headImg);
        }

        return token;
    }

    [Authorize]
    [HttpPost]
    public IActionResult EditPassword(string oldPassword, string newPassword)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        string md5OldPassword = _systemService.ConvertToMD5(oldPassword);
        string md5NewPassword = _systemService.ConvertToMD5(newPassword);
        var user = _context.Users.Where(u => u.Account == username).FirstOrDefault();
        if (user != null)
        {
            if (user.Password == md5OldPassword)
            {
                user.Password = md5NewPassword;
                _context.SaveChanges();
                return Json(new
                {
                    success = true
                });
            }
            else
            {
                return Json(new
                {
                    success = false,
                    msg = "旧密码错误"
                });
            }
        }

        return Json(new
        {
            success = false,
            msg = "用户不存在"
        });
    }
}