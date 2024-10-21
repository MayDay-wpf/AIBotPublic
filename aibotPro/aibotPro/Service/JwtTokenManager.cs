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

            var payload = new JwtPayload(_configuration["Jwt:Issuer"], _configuration["Jwt:Audience"], claims,
                DateTime.Now, DateTime.Now.AddMinutes(Convert.ToDouble(_configuration["Jwt:DurationInMinutes"])));

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
                            var user = scopedContext.Users.Where(x => x.Account == Account && x.IsBan == 0)
                                .FirstOrDefault();
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

        public GoogleJWT DecodeGoogleJwtToken(string googleJwt)
        {
            var handler = new JwtSecurityTokenHandler();
            var jsonToken = handler.ReadToken(googleJwt) as JwtSecurityToken;

            var header = new GoogleJwtHeader
            {
                alg = jsonToken.Header["alg"].ToString(),
                kid = jsonToken.Header["kid"].ToString(),
                typ = jsonToken.Header["typ"].ToString(),
            };

            var payload = new GoogleJwtPayload
            {
                iss = jsonToken.Claims.FirstOrDefault(claim => claim.Type == "iss")?.Value,
                azp = jsonToken.Claims.FirstOrDefault(claim => claim.Type == "azp")?.Value,
                aud = jsonToken.Claims.FirstOrDefault(claim => claim.Type == "aud")?.Value,
                sub = jsonToken.Claims.FirstOrDefault(claim => claim.Type == "sub")?.Value,
                email = jsonToken.Claims.FirstOrDefault(claim => claim.Type == "email")?.Value,
                email_verified =
                    bool.Parse(jsonToken.Claims.FirstOrDefault(claim => claim.Type == "email_verified")?.Value ??
                               "false"),
                nbf = long.Parse(jsonToken.Claims.FirstOrDefault(claim => claim.Type == "nbf")?.Value ?? "0"),
                name = jsonToken.Claims.FirstOrDefault(claim => claim.Type == "name")?.Value,
                picture = jsonToken.Claims.FirstOrDefault(claim => claim.Type == "picture")?.Value,
                given_name = jsonToken.Claims.FirstOrDefault(claim => claim.Type == "given_name")?.Value,
                family_name = jsonToken.Claims.FirstOrDefault(claim => claim.Type == "family_name")?.Value,
                iat = long.Parse(jsonToken.Claims.FirstOrDefault(claim => claim.Type == "iat")?.Value ?? "0"),
                exp = long.Parse(jsonToken.Claims.FirstOrDefault(claim => claim.Type == "exp")?.Value ?? "0"),
                jti = jsonToken.Claims.FirstOrDefault(claim => claim.Type == "jti")?.Value
            };

            return new GoogleJWT
            {
                header = header,
                payload = payload
            };
        }

        public class GoogleJWT
        {
            public GoogleJwtHeader header;
            public GoogleJwtPayload payload;
        }

        public class GoogleJwtHeader
        {
            public string alg { get; set; }
            public string kid { get; set; }
            public string typ { get; set; }
        }

        public class GoogleJwtPayload
        {
            public string iss { get; set; }
            public string azp { get; set; }
            public string aud { get; set; }
            public string sub { get; set; }
            public string email { get; set; }
            public bool email_verified { get; set; }
            public long nbf { get; set; }
            public string name { get; set; }
            public string picture { get; set; }
            public string given_name { get; set; }
            public string family_name { get; set; }
            public long iat { get; set; }
            public long exp { get; set; }
            public string jti { get; set; }
        }
    }
}