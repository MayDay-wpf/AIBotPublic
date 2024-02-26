using aibotPro.Interface;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace aibotPro.Service
{
    public class AdminRequirementHandler : AuthorizationHandler<AdminRequirement>
    {
        private readonly IAdminsService _adminsService;
        public AdminRequirementHandler(IAdminsService adminsService)
        {
            _adminsService = adminsService;
        }
        protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, AdminRequirement requirement)
        {
            if (_adminsService.IsAdmin(context.User.FindFirst(c => c.Type == ClaimTypes.Name)?.Value))
            {
                context.Succeed(requirement);
            }
            await Task.CompletedTask;
        }
    }
}
