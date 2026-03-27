using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using LogLevel = aibotPro.Dtos.LogLevel;
using aibotPro.Dtos;
using System.Security.Claims;
using Microsoft.Extensions.Options;
using System.Text.RegularExpressions;
using System.Linq;
using System.Collections.Generic;

namespace aibotPro.Controllers;

public class UsersController : Controller
{
    //依赖注入
    private readonly AIBotProContext _context;
    private readonly IFinanceService _financeService;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly JwtTokenManager _jwtTokenManager;
    private readonly IRedisService _redisService;
    private readonly ISystemService _systemService;
    private readonly IUsersService _usersService;

    public UsersController(AIBotProContext context, IUsersService usersService, ISystemService systemService,
        IRedisService redisService, IHttpContextAccessor httpContextAccessor, JwtTokenManager jwtTokenManager,
        IFinanceService financeService)
    {
        _context = context;
        _usersService = usersService;
        _systemService = systemService;
        _redisService = redisService;
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
        var lockedKey = "lockedaccount_" + account;
        var lockedTime = await _redisService.GetAsync(lockedKey);
        if (!string.IsNullOrEmpty(lockedTime))
        {
            //查询解锁时间
            var lockDateTime = DateTime.Parse(lockedTime);
            var timeSpan = (lockDateTime.AddMinutes(30) - DateTime.Now);
            if (timeSpan.TotalMinutes > 0)
            {
                var minutes = Math.Floor(timeSpan.TotalMinutes);
                var seconds = timeSpan.Seconds;
                errormsg = minutes > 0
                    ? $"账号已被锁定,请{minutes}分{seconds}秒后再试"
                    : $"账号已被锁定,请{seconds}秒后再试";
                return Json(new { success = false, msg = errormsg, errorCount });
            }
        }

        if (!string.IsNullOrEmpty(await _redisService.GetAsync(errorCountKey)))
            errorCount = Convert.ToInt32(await _redisService.GetAsync(errorCountKey));
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

        if (errorCount >= 5)
        {
            //账号被锁定30分钟，写入redis
            await _redisService.SetAsync("lockedaccount_" + account, DateTime.Now.ToString(), TimeSpan.FromMinutes(30));
            errormsg = "连续密码错误多次，账号已被锁定30分钟";
            await _redisService.DeleteAsync(errorCountKey);
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
            await _redisService.SetAsync(errorCountKey, errorCount.ToString());
            await _systemService.WriteLog("登录失败", LogLevel.Info, account);
            return Json(new { success = false, msg = errormsg, errorCount });
        }

        if (user.IsBan == 1)
        {
            errormsg = "账号已被禁用";
            return Json(new { success = false, msg = errormsg, errorCount });
        }

        //生成token
        await _redisService.DeleteAsync(errorCountKey);
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
        if (user.IsBan == 1)
        {
            return Json(new { success = false, msg = "账号已被禁用" });
        }

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
        var systemCfg = _systemService.GetSystemCfgs();
        bool isValidEmail = true;
        string errorMessage = "";
        if (!toemail.Contains("@"))
        {
            isValidEmail = false;
            errorMessage = "请输入有效的邮箱地址";
        }

        if (!isValidEmail)
        {
            return Json(new
            {
                success = false,
                msg = errorMessage
            });
        }

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
    public async Task<IActionResult> UploadAvatar([FromForm] IFormFile file)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        if (string.IsNullOrEmpty(username))
            return Json(new
            {
                success = false,
                msg = "账号异常"
            });
        var fileName = await _systemService.UploadFileToImageHosting(file, username);
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
    public async Task<IActionResult> VipToBalance(int days)
    {
        // 验证JWT并获取用户名
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

        if (string.IsNullOrEmpty(username))
        {
            return Json(new
            {
                success = false,
                msg = "账号异常"
            });
        }

        // 检查用户是否为VIP用户并获取VIP数据
        var isVip = await _financeService.IsVip(username);
        if (!isVip)
        {
            return Json(new
            {
                success = false,
                msg = "非VIP用户，无法兑换"
            });
        }

        // 获取用户的VIP数据，按过期时间倒序排列
        var vipData = await _financeService.GetVipData(username);
        vipData = vipData.OrderByDescending(x => x.EndTime).ToList();

        // 验证是否有VIP数据
        if (!vipData.Any())
        {
            return Json(new
            {
                success = false,
                msg = "无有效的VIP数据"
            });
        }

        // 获取最新的VIP信息
        var latestVip = vipData.FirstOrDefault();
        var vipEndDate = latestVip?.EndTime;
        var vipType = latestVip?.VipType;

        if (vipEndDate == null || days <= 0)
        {
            return Json(new
            {
                success = false,
                msg = "无法进行兑换，提供的天数无效"
            });
        }

        // 计算剩余的VIP天数
        int daysRemaining = (int)Math.Ceiling((vipEndDate.Value - DateTime.UtcNow).TotalDays);

        if (days > daysRemaining)
        {
            return Json(new
            {
                success = false,
                msg = "可兑换的天数不足"
            });
        }

        // 从VipType中解析出价格-赠送余额
        decimal vipPrice = GetVipPriceFromType(vipType) / 2m;
        decimal ratePerDay = vipPrice / 30;
        decimal balanceToAdd = days * ratePerDay;

        // 更新用户余额
        var user = _context.Users.Where(u => u.Account == username).FirstOrDefault();
        user.Mcoin += balanceToAdd;
        // 更新会员剩余天数
        var vip = _context.VIPs.Where(v => v.Account == username).OrderByDescending(v => v.EndTime).FirstOrDefault();
        if (vip == null)
        {
            return Json(new
            {
                success = false,
                msg = "VIP记录未找到"
            });
        }

        // 如果兑换的天数等于剩余天数，直接删除VIP记录
        if (days == daysRemaining)
        {
            _context.VIPs.Remove(vip); // 删除VIP记录
        }
        else
        {
            vip.EndTime = vip.EndTime.Value.AddDays(-days); // 否则减少相应的天数
            _context.VIPs.Update(vip); // 标记VIP返回更新
        }

        // 提交对数据库的所有更改
        bool changesSaved = await _context.SaveChangesAsync() > 0;
        return Json(new
        {
            success = changesSaved
        });
    }

    // 从VipType提取出价格
    private decimal GetVipPriceFromType(string vipType)
    {
        if (string.IsNullOrEmpty(vipType))
        {
            throw new ArgumentException("VIP类型无效");
        }

        // 解析出价格部分
        var parts = vipType.Split('|');
        if (parts.Length < 2 || !decimal.TryParse(parts[1], out var price))
        {
            throw new ArgumentException("VIP价格解析失败");
        }

        return price;
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
        decimal topVipPrice = 0;

        // 定义VIP类型的优先级
        var vipPriority = new Dictionary<string, int>
        {
            { "VIP|15", 1 },
            { "VIP|20", 2 },
            { "VIP|50", 3 },
            { "VIP|90", 4 }
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
                    topVipPrice = decimal.Parse(vip.VipType.Split('|')[1]);
                }
            }
        }

        return Json(new
        {
            success = true,
            data = topVipType,
            price = topVipPrice
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
                    _usersService.UpdateShareMcoinAndWriteLog(parentShareCode.ShareCode, intomoney * 0.15m);
                }

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
        if (vipdata.Where(x =>
                    x.VipType == "VIP|50" || x.VipType == "VIP|90" || x.VipType == "VIP|15" || x.VipType == "VIP|20")
                .Count() > 0)
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
            //余额随机增加 0.5~0.6
            var random = new Random();
            // 生成 0.5 到 0.6 之间的随机小数
            decimal money = (decimal)(random.NextDouble() * 0.1 + 0.5);
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
            msg = "不是会员，无法签到"
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
        var systemCfg = _systemService.GetSystemCfgs();
        var cardsLimit = systemCfg.FirstOrDefault(x => x.CfgKey == "Cards_Limit");
        // 检查是否在限制时间内使用
        if (cardsLimit != null)
        {
            var cardsLimitTime = int.Parse(cardsLimit.CfgValue);
            var lastUsedCard = _context.Cards
                .Where(x => x.UseAccount == username)
                .OrderByDescending(x => x.CreateTime)
                .FirstOrDefault();

            if (lastUsedCard != null)
            {
                // 计算时间差（将两者相减得到的是一个TimeSpan对象）
                TimeSpan timeElapsed = DateTime.Now - lastUsedCard.CreateTime.Value;
                double timeElapsedInSeconds = timeElapsed.TotalSeconds;
                var cardsLimitTimeInSeconds = cardsLimitTime * 60;

                if (timeElapsedInSeconds < cardsLimitTimeInSeconds)
                {
                    var remainingTime = cardsLimitTimeInSeconds - timeElapsedInSeconds;
                    var remainingMinutes = Math.Floor(remainingTime / 60);
                    var remainingSeconds = remainingTime % 60;

                    return Json(new
                    {
                        success = false,
                        msg = $"请等待 {remainingMinutes:F0} 分钟 {remainingSeconds:F0} 秒后再试"
                    });
                }
            }
        }

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
        card.CreateTime = DateTime.Now;
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
    public IActionResult InitiateLinuxDoLogin()
    {
        var systemCfgs = _systemService.GetSystemCfgs();
        var clientId = systemCfgs.FirstOrDefault(x => x.CfgKey == "LinuxDoClientID")?.CfgValue;
        var redirectUri = Url.Action("HandleGoogleCallback", "Users", null, Request.Scheme,
            Request.Host.ToUriComponent());

        var authorizationEndpoint =
            "https://connect.linux.do/oauth2/authorize"; //"https://accounts.google.com/o/oauth2/v2/auth";
        var scope = "openid email profile";

        var authorizationRequest = new UriBuilder(authorizationEndpoint);
        authorizationRequest.Query = string.Format(
            "client_id={0}&state={1}&response_type=code&scope={2}",
            clientId, Guid.NewGuid().ToString(), "user:profile");

        return Redirect(authorizationRequest.ToString());
    }

    [HttpGet]
    public IActionResult HandleLinuxDoCallback()
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
    public IActionResult HandleGitHubCallback()
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
            if (user.IsBan == 1)
            {
                return Json(new
                {
                    success = false,
                    msg = "用户被封禁",
                    token
                });
            }

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

    [HttpPost]
    public IActionResult LinuxDoOAuth(string code, string redirect)
    {
        string JWT = GetLinuxDoTokenAsync(code);
        // 获取LinuxDo用户信息
        string url = "https://connect.linux.do/api/user";
        string token = string.Empty;
        using (HttpClient client = new HttpClient())
        {
            // 设置 Authorization Header
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", JWT);

            // GET 请求
            HttpResponseMessage response = client.GetAsync(url).Result;

            if (response.IsSuccessStatusCode)
            {
                // 读取响应内容
                string responseData = response.Content.ReadAsStringAsync().Result;
                JwtTokenManager.LinuxDoJWT linuxDoJwt =
                    JsonConvert.DeserializeObject<JwtTokenManager.LinuxDoJWT>(responseData);

                string email = linuxDoJwt.email;
                string nick = linuxDoJwt.username;
                string headImg = linuxDoJwt.avatar_template;
                //检查用户是否存在
                var user = _context.Users.AsNoTracking().Where(u => u.Account == email).FirstOrDefault();

                if (user != null)
                {
                    if (user.IsBan == 1)
                    {
                        return Json(new
                        {
                            success = false,
                            msg = "用户被封禁",
                            token
                        });
                    }

                    //直接登录
                    token = _jwtTokenManager.GenerateToken(user.Account);
                    return Json(new { success = true, msg = "登录成功", token });
                }
                else
                {
                    //注册后登录
                    token = _usersService.GetRegisterTokenByAnother(email, nick, headImg);
                }
            }
            else
            {
                Console.WriteLine($"Error: {response.StatusCode}");
                Console.WriteLine(response.Content.ReadAsStringAsync().Result);
            }
        }

        return Json(new { success = string.IsNullOrEmpty(token) ? false : true, token });
    }

    private string GetLinuxDoTokenAsync(string code)
    {
        var systemCfgs = _systemService.GetSystemCfgs();
        var clientId = systemCfgs.FirstOrDefault(x => x.CfgKey == "LinuxDoClientID")?.CfgValue;
        var clientSecret = systemCfgs.FirstOrDefault(x => x.CfgKey == "LinuxDoSecret")?.CfgValue;
        var redirectUri = Url.Action("HandleGoogleCallback", "Users", null, Request.Scheme,
            Request.Host.ToUriComponent());

        var authorizationEndpoint = "https://connect.linux.do/oauth2/token";
        string authorization = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));

        using (var client = new HttpClient())
        {
            // Set the authorization header
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", authorization);

            // Create the POST content
            var content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("grant_type", "authorization_code"),
                new KeyValuePair<string, string>("code", code),
                new KeyValuePair<string, string>("redirect_uri", redirectUri)
            });

            // Make the POST request
            var response = client.PostAsync(authorizationEndpoint, content).Result;

            if (response.IsSuccessStatusCode)
            {
                var responseContent = response.Content.ReadAsStringAsync().Result;

                // Parse the JSON response to get access_token
                var jsonDocument = JsonDocument.Parse(responseContent);
                if (jsonDocument.RootElement.TryGetProperty("access_token", out JsonElement accessTokenElement))
                {
                    return accessTokenElement.GetString();
                }

                throw new Exception("Access token not found in the response.");
            }
            else
            {
                throw new Exception("Failed to retrieve the token: " + response.ReasonPhrase);
            }
        }
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
            if (user.IsBan == 1)
            {
                return token;
            }

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

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> GetHeatmapData()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", string.Empty))?.Identity
            ?.Name;
        if (string.IsNullOrEmpty(username))
        {
            return Unauthorized();
        }

        DateTime today = DateTime.Now;
        DateTime oneYearAgo = today.AddYears(-1).Date; // 起始日期取Date部分

        var dailyUsage = await _context.UseUpLogs
            .Where(x => x.Account == username &&
                        x.CreateTime.HasValue &&
                        x.CreateTime.Value >= oneYearAgo &&
                        x.CreateTime.Value <= today) // 使用 <= today 而不是 today.Date
            .GroupBy(x => x.CreateTime.Value.Date)
            .Select(g => new
            {
                Date = g.Key,
                TotalUsage = g.Sum(x => (x.InputCount ?? 0) + (x.OutputCount ?? 0))
            })
            .ToListAsync();

        var usageDict = dailyUsage.ToDictionary(x => x.Date.Date, x => x.TotalUsage);
        List<object> result = new List<object>();

        // 循环到今天（包含今天）
        for (DateTime date = oneYearAgo; date <= today.Date; date = date.AddDays(1))
        {
            result.Add(new
            {
                Date = date.ToString("yyyy-MM-dd"),
                Usage = usageDict.ContainsKey(date.Date) ? usageDict[date.Date] : 0
            });
        }

        return Ok(result);
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> GetUserTokenPackages()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", string.Empty))?.Identity
            ?.Name;
        if (string.IsNullOrEmpty(username))
        {
            return Unauthorized();
        }

        DateTime today = DateTime.Now;
        DateTime oneYearAgo = today.AddYears(-1).Date; // 起始日期取Date部分

        var dailyUsage = await _context.UseUpLogs
            .Where(x => x.Account == username &&
                        x.CreateTime.HasValue &&
                        x.CreateTime.Value >= oneYearAgo &&
                        x.CreateTime.Value <= today) // 使用 <= today 而不是 today.Date
            .GroupBy(x => x.CreateTime.Value.Date)
            .Select(g => new
            {
                Date = g.Key,
                TotalUsage = g.Sum(x => (x.InputCount ?? 0) + (x.OutputCount ?? 0))
            })
            .ToListAsync();

        var usageDict = dailyUsage.ToDictionary(x => x.Date.Date, x => x.TotalUsage);
        List<object> result = new List<object>();

        // 循环到今天（包含今天）
        for (DateTime date = oneYearAgo; date <= today.Date; date = date.AddDays(1))
        {
            result.Add(new
            {
                Date = date.ToString("yyyy-MM-dd"),
                Usage = usageDict.ContainsKey(date.Date) ? usageDict[date.Date] : 0
            });
        }

        return Ok(result);
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> GetMyTokenPackages()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

        if (string.IsNullOrEmpty(username))
        {
            return Json(new
            {
                success = false,
                msg = "账号异常"
            });
        }

        // 尝试从缓存获取Token包列表
        string cacheKey = $"user_token_packages:{username}";
        var cachedData = await _redisService.GetAsync(cacheKey);
        List<TokenPackage> tokenPackages;

        if (!string.IsNullOrEmpty(cachedData))
        {
            try
            {
                tokenPackages = JsonConvert.DeserializeObject<List<TokenPackage>>(cachedData);
            }
            catch
            {
                // 如果反序列化失败，从数据库获取并更新缓存
                tokenPackages = await _context.TokenPackages
                    .Where(tp => tp.UseAccount == username &&
                                 tp.ExpirationTime > DateTime.Now)
                    .OrderByDescending(tp => tp.ExpirationTime)
                    .ToListAsync();

                // 更新缓存
                await _redisService.SetAsync(cacheKey, JsonConvert.SerializeObject(tokenPackages),
                    TimeSpan.FromMinutes(5));
            }
        }
        else
        {
            // 从数据库获取
            tokenPackages = await _context.TokenPackages
                .Where(tp => tp.UseAccount == username &&
                             tp.ExpirationTime > DateTime.Now)
                .OrderByDescending(tp => tp.ExpirationTime)
                .ToListAsync();

            // 更新缓存
            await _redisService.SetAsync(cacheKey, JsonConvert.SerializeObject(tokenPackages), TimeSpan.FromMinutes(5));
        }

        // 处理Token包列表，转换为前端所需格式
        var result = new List<object>();

        foreach (var package in tokenPackages)
        {
            // 计算Token使用情况
            int totalTokens = package.TokenTotal ?? 0;
            int usedTokens = package.TokenUsage ?? 0;

            // 计算使用百分比
            double percentage =
                totalTokens > 0 ? Math.Min(100, Math.Round((double)usedTokens / totalTokens * 100, 0)) : 0;

            // 计算剩余天数
            int remainingDays = (int)Math.Ceiling((package.ExpirationTime.Value - DateTime.Now).TotalDays);

            // 获取可用模型列表
            var modelNames = string.IsNullOrEmpty(package.ModelList)
                ? new List<string> { "所有模型" }
                : package.ModelList.Split(',').ToList();

            result.Add(new
            {
                id = package.Id,
                code = package.Code,
                totalTokens = totalTokens,
                usedTokens = usedTokens,
                remainingTokens = Math.Max(0, totalTokens - usedTokens),
                percentage = percentage,
                expirationDate = package.ExpirationTime.Value.ToString("yyyy-MM-dd"),
                remainingDays = remainingDays,
                models = modelNames
            });
        }

        return Json(new
        {
            success = true,
            data = result
        });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> RedeemTokenPackage(string code)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

        if (string.IsNullOrEmpty(username))
        {
            return Json(new
            {
                success = false,
                msg = "账号异常"
            });
        }

        if (string.IsNullOrEmpty(code))
        {
            return Json(new
            {
                success = false,
                msg = "兑换码不能为空"
            });
        }

        // 使用缓存方法查找Token包
        var tokenPackage = await _financeService.GetTokenPackageByCodeAsync(code);

        if (tokenPackage == null || !string.IsNullOrEmpty(tokenPackage.UseAccount))
        {
            return Json(new
            {
                success = false,
                msg = "兑换码不存在或已被使用"
            });
        }

        if (tokenPackage.ExpirationTime < DateTime.Now)
        {
            return Json(new
            {
                success = false,
                msg = "该兑换码已过期"
            });
        }

        // 更新Token包的使用者
        tokenPackage.UseAccount = username;
        // 确保TokenUsage有初始值
        if (tokenPackage.TokenUsage == null)
        {
            tokenPackage.TokenUsage = 0;
        }

        _context.TokenPackages.Update(tokenPackage);
        await _context.SaveChangesAsync();

        // 清除相关缓存
        string userCacheKey = $"user_token_packages:{username}";
        string packageCacheKey = $"token_package_code:{code}";
        await _redisService.DeleteAsync(userCacheKey);
        await _redisService.DeleteAsync(packageCacheKey);

        await _systemService.WriteLog($"用户兑换Token包: {code}", Dtos.LogLevel.Info, username);

        return Json(new
        {
            success = true,
            msg = "兑换成功",
            data = new
            {
                tokenPackage.TokenTotal,
                Models = string.IsNullOrEmpty(tokenPackage.ModelList) ? "所有模型" : tokenPackage.ModelList,
                ExpirationDate = tokenPackage.ExpirationTime.Value.ToString("yyyy-MM-dd")
            }
        });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> GetCompleteUserInfo()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

        if (string.IsNullOrEmpty(username))
        {
            return Json(new
            {
                success = false,
                msg = "账号异常"
            });
        }

        try
        {
            // 获取用户基本信息
            var user = _usersService.GetUserData(username);
            if (user == null)
            {
                return Json(new
                {
                    success = false,
                    msg = "用户不存在"
                });
            }

            // 获取VIP信息
            var vipData = await _financeService.GetVipData(username);
            DateTime? vipEndTime = null;
            string vipType = null;

            if (vipData != null && vipData.Any())
            {
                // 按过期时间倒序排列，取最晚过期的VIP
                var latestVip = vipData.OrderByDescending(x => x.EndTime).FirstOrDefault();
                if (latestVip != null && latestVip.EndTime > DateTime.Now)
                {
                    vipEndTime = latestVip.EndTime;
                    vipType = latestVip.VipType;
                }
            }

            // 获取Token包信息
            var tokenPackages = await _context.TokenPackages
                .Where(tp => tp.UseAccount == username &&
                             tp.ExpirationTime > DateTime.Now)
                .OrderByDescending(tp => tp.ExpirationTime)
                .ToListAsync();

            var tokenPackageList = new List<object>();

            foreach (var package in tokenPackages)
            {
                int totalTokens = package.TokenTotal ?? 0;
                int usedTokens = package.TokenUsage ?? 0;
                int remainingTokens = Math.Max(0, totalTokens - usedTokens);
                double percentage = totalTokens > 0
                    ? Math.Min(100, Math.Round((double)usedTokens / totalTokens * 100, 1))
                    : 0;
                int remainingDays = (int)Math.Ceiling((package.ExpirationTime.Value - DateTime.Now).TotalDays);

                var modelNames = string.IsNullOrEmpty(package.ModelList)
                    ? new List<string> { "所有模型" }
                    : package.ModelList.Split(',').ToList();

                tokenPackageList.Add(new
                {
                    id = package.Id,
                    code = package.Code,
                    totalTokens = totalTokens,
                    usedTokens = usedTokens,
                    remainingTokens = remainingTokens,
                    usagePercentage = percentage,
                    expirationDate = package.ExpirationTime.Value.ToString("yyyy-MM-dd"),
                    remainingDays = remainingDays,
                    models = modelNames
                });
            }

            // 构建返回数据
            var userInfo = new
            {
                account = user.Account,
                nickname = user.Nick,
                avatar = user.HeadImg,
                balance = user.Mcoin,
                createTime = user.CreateTime,
                vipInfo = vipEndTime.HasValue
                    ? new
                    {
                        isVip = true,
                        vipType = vipType,
                        endTime = vipEndTime.Value.ToString("yyyy-MM-dd HH:mm:ss"),
                        remainingDays = (int)Math.Ceiling((vipEndTime.Value - DateTime.Now).TotalDays)
                    }
                    : new
                    {
                        isVip = false,
                        vipType = (string)null,
                        endTime = (string)null,
                        remainingDays = 0
                    },
                tokenPackages = tokenPackageList
            };

            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = userInfo
            });
        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"获取用户完整信息失败: {ex.Message}", Dtos.LogLevel.Error, username);
            return Json(new
            {
                success = false,
                msg = "获取用户信息失败"
            });
        }
    }

    [Authorize]
    [HttpPost]
    public IActionResult GetMyCollectionModel()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

        if (string.IsNullOrEmpty(username))
        {
            return Json(new
            {
                success = false,
                msg = "账号异常"
            });
        }

        try
        {
            var collectionModels = _systemService.GetMyCollectionModel(username);
            //信息脱敏 - 直接返回数据，因为已经不包含敏感字段
            
            return Json(new
            {
                success = true,
                msg = "获取成功",
                data = collectionModels
            });
        }
        catch (Exception ex)
        {
            return Json(new
            {
                success = false,
                msg = "获取失败: " + ex.Message
            });
        }
    }

    [Authorize]
    [HttpPost]
    public IActionResult UpdateMyCollectionModel(string modelNames)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

        if (string.IsNullOrEmpty(username))
        {
            return Json(new
            {
                success = false,
                msg = "账号异常"
            });
        }

        if (modelNames == null)
        {
            modelNames = "";
        }

        try
        {
            var result = _systemService.UpdateMyCollectionModel(username, modelNames);
            return Json(new
            {
                success = result,
                msg = result ? "更新成功" : "更新失败"
            });
        }
        catch (Exception ex)
        {
            return Json(new
            {
                success = false,
                msg = "更新失败: " + ex.Message
            });
        }
    }
}