using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace aibotPro.Controllers;

public class NewApiController : Controller
{
    private readonly AIBotProContext _context;
    private readonly IFinanceService _financeService;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly JwtTokenManager _jwtTokenManager;
    private readonly IRedisService _redis;
    private readonly ISystemService _systemService;
    private readonly IUsersService _usersService;
    private readonly INewApiService _newApiService;

    public NewApiController(AIBotProContext context, IUsersService usersService, ISystemService systemService,
        IRedisService redis, IHttpContextAccessor httpContextAccessor, JwtTokenManager jwtTokenManager,
        IFinanceService financeService, INewApiService newApiService)
    {
        _context = context;
        _usersService = usersService;
        _systemService = systemService;
        _redis = redis;
        _httpContextAccessor = httpContextAccessor;
        _jwtTokenManager = jwtTokenManager;
        _financeService = financeService;
        _newApiService = newApiService;
    }

    [Authorize]
    [HttpPost]
    public IActionResult UserIsBinded()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        bool isBinded = _newApiService.UserIsBinded(username);
        return Json(new
        {
            success = isBinded
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult UserBindNewApi(string newapiAcount, string password = "")
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        bool isBinded = _newApiService.UserBindNewApi(username, newapiAcount, out string errorMsg, password);
        return Json(new
        {
            success = isBinded,
            msg = errorMsg
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult GetNewApiUserInfo()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var newApiUser = _context.BindNewApis.Where(x => x.Account == username).FirstOrDefault();
        var systemCfgs = _systemService.GetSystemCfgs();
        if (newApiUser != null)
        {
            return Json(new
            {
                success = true,
                data = new
                {
                    id = newApiUser.ApiId,
                    username = newApiUser.ApiUserName,
                    newapiUrl = systemCfgs.Find(x => x.CfgKey == "NewApiUrl").CfgValue
                }
            });
        }
        else
        {
            return Json(new
            {
                success = false,
                msg = "无绑定信息"
            });
        }
    }

    [Authorize]
    [HttpPost]
    public IActionResult NewApiCheckIn()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        string result = _newApiService.NewApiCheckIn(username, out string errorMsg);
        return Json(new
        {
            success = true,
            msg = errorMsg == "" ? result : errorMsg
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult TodayIsCheckedIn()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        bool result = _newApiService.TodayIsCheckedIn(username);
        return Json(new
        {
            success = result
        });
    }

    [Authorize]
    [HttpPost]
    public IActionResult CreateCard(decimal amount)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var user = _usersService.GetUserData(username);
        if (user.Mcoin < amount)
        {
            return Json(new
            {
                success = false,
                msg = "余额不足"
            });
        }

        long quota = (long)(amount * 500000);
        // 生成卡密
        string cardName = _systemService.ConvertToMD5(Guid.NewGuid().ToString("N"));
        var card = _newApiService.CreateNewApiCard($"{cardName}", 1, quota);
        if (!string.IsNullOrEmpty(card))
        {
            _systemService.WriteLogUnAsync($"用户生成NewAPI兑换码 ：{card}，金额：{amount}，名称：{cardName}", Dtos.LogLevel.Info,
                username);
            _financeService.UpdateUserMoney(username, amount, "deduction", out string errormsg);
            if (!string.IsNullOrEmpty(errormsg))
            {
                return Json(new
                {
                    success = false,
                    msg = errormsg
                });
            }
            else
            {
                return Json(new
                {
                    success = true,
                    msg = card
                });
            }
        }

        return Json(new
        {
            success = false,
            msg = "生成失败"
        });
    }
}