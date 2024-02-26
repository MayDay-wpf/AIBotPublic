using aibotPro.Interface;
using aibotPro.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace aibotPro.Service
{
    public class JwtTokenManager
    {
        private readonly IConfiguration _configuration;
        private readonly IServiceProvider _serviceProvider;

        public JwtTokenManager(IConfiguration configuration, IServiceProvider serviceProvider)
        {
            _configuration = configuration;
            _serviceProvider = serviceProvider;
        }

        public string GenerateToken(string username)
        {
            var symmetricSecurityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
            var credentials = new SigningCredentials(symmetricSecurityKey, SecurityAlgorithms.HmacSha256Signature);
            var header = new JwtHeader(credentials);

            var claims = new[]
            {
            new Claim(ClaimTypes.Name, username)
        };

            var payload = new JwtPayload(_configuration["Jwt:Issuer"], _configuration["Jwt:Audience"], claims, DateTime.Now, DateTime.Now.AddMinutes(Convert.ToDouble(_configuration["Jwt:DurationInMinutes"])));

            var token = new JwtSecurityToken(header, payload);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
        public ClaimsPrincipal ValidateToken(string token)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var validationParameters = GetValidationParameters();

            SecurityToken validatedToken;
            return tokenHandler.ValidateToken(token, validationParameters, out validatedToken);
        }
        public bool isTokenValid(string token)
        {
            try
            {
                // 实例化JwtTokenManager并调用ValidateToken函数
                var claimsPrincipal = ValidateToken(token);
                if (claimsPrincipal != null)
                {
                    string? Account = claimsPrincipal.Identity?.Name;
                    if (!string.IsNullOrEmpty(Account))
                    {
                        using (var scope = _serviceProvider.CreateScope())
                        {
                            var scopedContext = scope.ServiceProvider.GetRequiredService<AIBotProContext>();
                            var user = scopedContext.Users.Where(x => x.Account == Account && x.IsBan == 0).FirstOrDefault();
                            if (user != null)
                                return true;
                        }

                    }
                }
                return false;
            }
            catch (Exception ex)
            {
                // 如果在验证过程中抛出异常（例如，令牌过期、签名不正确等），则认为令牌是无效的
                return false; // 令牌无效
            }
        }
        private TokenValidationParameters GetValidationParameters()
        {
            return new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = _configuration["Jwt:Issuer"],
                ValidateAudience = true,
                ValidAudience = _configuration["Jwt:Audience"],
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"])),
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero,
            };
        }
    }
}
