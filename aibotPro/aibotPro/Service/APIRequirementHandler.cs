using aibotPro.Interface;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace aibotPro.Service
{
    public class APIRequirementHandler : AuthorizationHandler<APIRequirement>
    {
        private readonly IAdminsService _adminsService;
        private readonly IHttpContextAccessor _httpContextAccessor;
        public APIRequirementHandler(IAdminsService adminsService, IHttpContextAccessor httpContextAccessor)
        {
            _adminsService = adminsService;
            _httpContextAccessor = httpContextAccessor;
        }
        protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, APIRequirement requirement)
        {
            var httpContext = _httpContextAccessor.HttpContext;
            if (httpContext != null)
            {
                var authHeader = httpContext.Request.Headers["Authorization"].FirstOrDefault();
                if (authHeader != null && authHeader.StartsWith("Bearer ", System.StringComparison.OrdinalIgnoreCase))
                {
                    var apikey = authHeader.Substring("Bearer ".Length).Trim();

                    if (_adminsService.ApiKeyCheck(apikey))
                    {
                        context.Succeed(requirement);
                    }
                }
            }

            await Task.CompletedTask;
        }
    }
}
