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

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();

builder.Services.AddHttpContextAccessor();
//注册服务
builder.Services.AddDbContext<AIBotProContext>(options => { options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")); });
builder.Services.AddSingleton<IConnectionMultiplexer>(ConnectionMultiplexer.Connect("localhost"));
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
