using aibotPro.Dtos;
using aibotPro.Models;
using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Drawing.Printing;
using System.Xml.Linq;

namespace aibotPro.Interface
{
    public interface IRoleService
    {
        //保存角色设置
        bool SaveRole(string account, RoleSettingDto roleSetting, out string errormsg);

        //获取角色列表
        List<RoleSetting> GetRoleList(int page, int pageSize, string name, out int total);
        //获取角色
        RoleSettingDto GetRole(string roleCode);
    }
}
