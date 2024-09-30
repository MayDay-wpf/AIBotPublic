using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StackExchange.Redis;
using System.Configuration;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using System.Net;
using aibotPro.Dtos;
using Microsoft.Extensions.Options;
using Milvus.Client;
using Microsoft.Extensions.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);
// 读取 appsettings.json 配置
IConfiguration configuration = builder.Configuration;

// 获取 Redis 配置节点
IConfigurationSection redisSection = configuration.GetSection("Redis");

// 创建 ConfigurationOptions 对象
ConfigurationOptions configOptions = new ConfigurationOptions
{
    ConnectTimeout = redisSection.GetValue<int>("ConnectTimeout"),
    SyncTimeout = redisSection.GetValue<int>("SyncTimeout"),
    AbortOnConnectFail = redisSection.GetValue<bool>("AbortOnConnectFail")
};
// 获取密码
string password = redisSection.GetValue<string>("Password");

// 如果密码不为空,则设置密码
if (!string.IsNullOrEmpty(password))
{
    configOptions.Password = password;
}

// 添加 Redis 服务器节点
foreach (var endpoint in redisSection.GetSection("EndPoints").GetChildren())
{
    string host = endpoint["Host"];
    int port = endpoint.GetValue<int>("Port");
    configOptions.EndPoints.Add(host, port);
}
builder.Services.Configure<MilvusOptions>(builder.Configuration.GetSection("Milvus"));
// 配置 MilvusClient
builder.Services.AddSingleton<MilvusClient>(sp =>
{
    var options = sp.GetRequiredService<IOptions<MilvusOptions>>().Value;
    var client = new MilvusClient(options.Host, options.UserName, options.Password, options.Port, options.UseSsl, options.Database);
    return client;
});

// 注册 Redis 连接为单例服务
builder.Services.AddSingleton<IConnectionMultiplexer>(ConnectionMultiplexer.Connect(configOptions));
// Add services to the container.
builder.Services.AddControllersWithViews();

builder.Services.AddHttpContextAccessor();
//注册服务
builder.Services.AddDbContext<AIBotProContext>(options => { options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")); });
builder.Services.AddScoped<IRedisService, RedisService>();
builder.Services.AddScoped<ISystemService, SystemService>();
builder.Services.AddScoped<IUsersService, UsersService>();
builder.Services.AddScoped<IAiServer, AiServer>();
builder.Services.AddScoped<IBaiduService, BaiduService>();
builder.Services.AddScoped<IWorkShop, WorkShopService>();
builder.Services.AddScoped<IRoleService, RoleService>();
builder.Services.AddScoped<IFilesAIService, FilesAIService>();
builder.Services.AddScoped<IKnowledgeService, KnowledgeService>();
builder.Services.AddScoped<IAssistantService, AssistantService>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<IFinanceService, FinanceService>();
builder.Services.AddScoped<IAdminsService, AdminService>();
builder.Services.AddScoped<IAuthorizationHandler, AdminRequirementHandler>();
builder.Services.AddScoped<IAuthorizationHandler, APIRequirementHandler>();
builder.Services.AddScoped<IMilvusService, MilvusService>();
builder.Services.AddScoped<IOpenAPIService, OpenAPIService>();
builder.Services.AddScoped<ICOSService, COSService>();
builder.Services.AddScoped<INewApiService, NewApiService>();
builder.Services.AddSingleton<ChatCancellationManager>();
builder.Services.AddMemoryCache();
builder.Services.AddSignalR();

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]))
    };
}); ;
builder.Services.AddAuthorization(options =>
{
    // 定义策略
    options.AddPolicy("AdminOnly", policy =>
    {
        policy.Requirements.Add(new AdminRequirement());
    });
    options.AddPolicy("APIOnly", policy =>
    {
        policy.Requirements.Add(new APIRequirement());
    });
});


builder.Services.AddAuthorization();
builder.Services.AddSingleton<JwtTokenManager>();
var app = builder.Build();
app.Use((context, next) =>
{
    var remoteIpAddress = context.Connection.RemoteIpAddress;

    if (context.Request.Headers.TryGetValue("X-Forwarded-For", out var forwardedFor))
    {
        remoteIpAddress = IPAddress.Parse(forwardedFor.First());
    }

    context.Items["RemoteIpAddress"] = remoteIpAddress;

    return next();
});
// 配置请求管道的中间件
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
// 注册自定义中间件
app.UseMiddleware<ConfigurationLoaderMiddleware>();//加载系统配置到Redis
// 使用认证中间件
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapHub<ChatHub>("/chatHub");  // 映射Hub
// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
}
//配置跨域
app.UseCors(builder =>
{
    builder.AllowAnyOrigin()
           .AllowAnyMethod()
           .AllowAnyHeader();
});

app.UseStaticFiles();

app.UseRouting();

app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
