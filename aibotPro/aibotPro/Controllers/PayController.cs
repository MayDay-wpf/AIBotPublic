using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RestSharp.Authenticators;

namespace aibotPro.Controllers
{
    public class PayController : Controller
    {
        private readonly IUsersService _usersService;
        private readonly IFinanceService _financeService;
        private readonly JwtTokenManager _jwtTokenManager;
        private readonly AIBotProContext _context;
        private readonly ISystemService _systemService;
        public PayController(IUsersService usersService, IFinanceService financeService, JwtTokenManager jwtTokenManager, AIBotProContext context, ISystemService systemService)
        {
            _usersService = usersService;
            _financeService = financeService;
            _jwtTokenManager = jwtTokenManager;
            _context = context;
            _systemService = systemService;
        }
        public IActionResult Balance()
        {
            return View();
        }
        public IActionResult VIP()
        {
            return View();
        }
        public IActionResult PayRes()
        {
            return View();
        }
        [Authorize]
        [HttpPost]
        public IActionResult PayInfo(int money, string type, string param = null)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var payInfo = _financeService.PayInfo(username, money, type, param);
            return Ok(new { success = true, data = payInfo });
        }
        public IActionResult Return(string money, string out_trade_no, string trade_status, string param)
        {
            PayResultDto payRes = _financeService.PayResult(out_trade_no);
            if (payRes.status == "1")
            {
                var username = _systemService.UrlDecode(param.Split('|')[param.Split('|').Length - 1]);
                var user = _context.Users.FirstOrDefault(x => x.Account == username);
                int intomoney = Convert.ToInt32(money);
                var order = _context.Orders.FirstOrDefault(x => x.OrderCode == out_trade_no && x.OrderStatus == "NO");
                if (trade_status == "TRADE_SUCCESS" && order != null)
                {
                    if (param.Contains("VIP|15") && intomoney == 15)
                    {
                        var vipinfo = _context.VIPs.AsNoTracking().FirstOrDefault(x => x.Account == username && x.VipType == "VIP|15");
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
                            var parentShareCode = _context.Shares.AsNoTracking().FirstOrDefault(x => x.Account == shareinfo.ParentAccount);
                            _usersService.UpdateShareMcoinAndWriteLog(parentShareCode.ShareCode, 15m * 0.15m);
                        }
                    }
                    else if (param.Contains("VIP|90") && intomoney == 90)
                    {
                        var vipinfo = _context.VIPs.AsNoTracking().FirstOrDefault(x => x.Account == username && x.VipType == "VIP|90");
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
                            var parentShareCode = _context.Shares.AsNoTracking().FirstOrDefault(x => x.Account == shareinfo.ParentAccount);
                            _usersService.UpdateShareMcoinAndWriteLog(parentShareCode.ShareCode, 90m * 0.15m);
                        }
                        user.Mcoin = user.Mcoin + intomoney + 10;
                        _context.Users.Update(user);
                    }
                    else
                    {
                        //查询是否有上级
                        var shareinfo = _context.Shares.AsNoTracking().FirstOrDefault(x => x.Account == username);
                        if (shareinfo != null && shareinfo.ParentAccount != "admin")
                        {
                            var parentShareCode = _context.Shares.AsNoTracking().FirstOrDefault(x => x.Account == shareinfo.ParentAccount);
                            _usersService.UpdateShareMcoinAndWriteLog(parentShareCode.ShareCode, (decimal)intomoney * 0.15m);
                        }
                        //更新用户余额
                        user.Mcoin = user.Mcoin + intomoney;
                        _context.Users.Update(user);
                    }
                    order.OrderStatus = "YES";
                    _context.Orders.Update(order);
                    _context.SaveChanges();
                    return Redirect("/Pay/PayRes?success=1");
                }
                else
                {
                    return Redirect("/Pay/PayRes?success=0");
                }
            }
            else
            {
                return Redirect("/Pay/PayRes?success=0");
            }
        }
        public IActionResult Notify(string money, string out_trade_no, string trade_status, string param)
        {
            PayResultDto payRes = _financeService.PayResult(out_trade_no);
            if (payRes.status == "1")
            {
                var username = _systemService.UrlDecode(param.Split('|')[param.Split('|').Length - 1]);
                var user = _context.Users.FirstOrDefault(x => x.Account == username);
                int intomoney = Convert.ToInt32(money);
                var order = _context.Orders.FirstOrDefault(x => x.OrderCode == out_trade_no && x.OrderStatus == "NO");
                if (trade_status == "TRADE_SUCCESS" && order != null)
                {
                    if (param.Contains("VIP|15") && intomoney == 15)
                    {
                        var vipinfo = _context.VIPs.AsNoTracking().FirstOrDefault(x => x.Account == username && x.VipType == "VIP|15");
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
                            var parentShareCode = _context.Shares.AsNoTracking().FirstOrDefault(x => x.Account == shareinfo.ParentAccount);
                            _usersService.UpdateShareMcoinAndWriteLog(parentShareCode.ShareCode, 15m * 0.15m);
                        }
                    }
                    else if (param.Contains("VIP|90") && intomoney == 90)
                    {
                        var vipinfo = _context.VIPs.AsNoTracking().FirstOrDefault(x => x.Account == username && x.VipType == "VIP|90");
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
                            var parentShareCode = _context.Shares.AsNoTracking().FirstOrDefault(x => x.Account == shareinfo.ParentAccount);
                            _usersService.UpdateShareMcoinAndWriteLog(parentShareCode.ShareCode, 90m * 0.15m);
                        }
                        user.Mcoin = user.Mcoin + intomoney + 10;
                        _context.Users.Update(user);
                    }
                    else
                    {
                        //查询是否有上级
                        var shareinfo = _context.Shares.AsNoTracking().FirstOrDefault(x => x.Account == username);
                        if (shareinfo != null && shareinfo.ParentAccount != "admin")
                        {
                            var parentShareCode = _context.Shares.AsNoTracking().FirstOrDefault(x => x.Account == shareinfo.ParentAccount);
                            _usersService.UpdateShareMcoinAndWriteLog(parentShareCode.ShareCode, (decimal)intomoney * 0.15m);
                        }
                        //更新用户余额
                        user.Mcoin = user.Mcoin + intomoney;
                        _context.Users.Update(user);
                    }
                    order.OrderStatus = "YES";
                    _context.Orders.Update(order);
                    _context.SaveChanges();
                    return Redirect("/Pay/PayRes?success=1");
                }
                else
                {
                    return Redirect("/Pay/PayRes?success=0");
                }
            }
            else
            {
                return Redirect("/Pay/PayRes?success=0");
            }
        }
        public async Task<IActionResult> BalancePayVIP(decimal mcoin)
        {
            //查询用户余额
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            if (mcoin < 15)
            {
                //非法请求，写日志
                await _systemService.WriteLog("BalancePayVIP非法请求", Dtos.LogLevel.Warn, username);
                return Ok(new { success = false, msg = "非法请求" });
            }
            var user = _context.Users.FirstOrDefault(x => x.Account == username);
            if (user.Mcoin < mcoin)
            {
                return Ok(new { success = false, msg = "余额不足" });
            }
            else
            {
                user.Mcoin = user.Mcoin - mcoin;
                _context.Users.Update(user);
                //更新VIP
                var vipinfo = _context.VIPs.AsNoTracking().FirstOrDefault(x => x.Account == username && x.VipType == "VIP|15");
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
                    vip.Account = username;
                    vip.StartTime = DateTime.Now;
                    vip.EndTime = DateTime.Now.AddDays(30);
                    vip.CreateTime = DateTime.Now;
                    _context.VIPs.Add(vip);
                }
                _context.SaveChanges();
                return Ok(new { success = true });
            }
        }
    }
}
