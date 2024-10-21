using aibotPro.AppCode;
using aibotPro.Interface;
using aibotPro.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using System.Net;
using System.Threading.Tasks;

public class ConfigurationLoaderMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IMemoryCache _cache;
    private static bool IsInitialized = false;
    private static readonly object InitLock = new object();
    public ConfigurationLoaderMiddleware(RequestDelegate next, IMemoryCache cache)
    {
        _next = next;
        _cache = cache;
    }

    public async Task InvokeAsync(HttpContext context, IServiceProvider serviceProvider, IWebHostEnvironment env)
    {
        // 动态创建作用域来获取AIBotProContext
        using (var scope = serviceProvider.CreateScope())
        {
            var scopedContext = scope.ServiceProvider.GetRequiredService<AIBotProContext>();
            var scopedRedis = scope.ServiceProvider.GetRequiredService<IRedisService>();
            // 从Redis中获取系统配置信息
            var systemConfigStr = await scopedRedis.GetAsync("SystemConfig");//用于手动重载系统配置
            if (!IsInitialized || string.IsNullOrEmpty(systemConfigStr))//如果没有初始化
            {
                if (System.IO.File.Exists("aibotinstall.lock"))//非安装状态
                {
                    // 从数据库加载系统配置信息
                    var systemConfig = scopedContext.SystemCfgs.ToList();
                    await scopedRedis.SetAsync("SystemConfig", JsonConvert.SerializeObject(systemConfig));
                }
                // 从数据库加载AI模型信息
                //var aiModel = scopedContext.AImodels.ToList();
                // 将配置信息存入Redis以便后续使用
                //await scopedRedis.SetAsync("AImodel", JsonConvert.SerializeObject(aiModel));
                IsInitialized = true;
            }
            //获取客户端IP并查询详情
            var ip = context.Items["RemoteIpAddress"] as IPAddress;
            var settings = new ChunZhenSetting();
            settings.DatPath = Path.Combine(env.WebRootPath, "system", "doc", "qqwry.dat");
            var ipSearch = new IPSearchHelper(settings);
            IPSearchHelper.IPLocation iPLocation = new IPSearchHelper.IPLocation();
            if (!string.IsNullOrEmpty(ip.ToString()))
                iPLocation = ipSearch.GetIPLocation(ip.ToString());
            else
                iPLocation = ipSearch.GetIPLocation("127.0.0.1");
            context.Items["IP"] = iPLocation.ip;
            context.Items["IPAddress"] = (iPLocation.country + iPLocation.area).Replace("CZ88.NET", "");
        }

        // 调用管道中的下一个中间件
        await _next(context);
    }
}
