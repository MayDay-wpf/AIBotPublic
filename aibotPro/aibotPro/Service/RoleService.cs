using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;

namespace aibotPro.Service
{
    public class RoleService : IRoleService
    {
        private readonly AIBotProContext _context;
        public RoleService(AIBotProContext context)
        {
            _context = context;
        }
        public bool SaveRole(string account, RoleSettingDto roleSetting, out string errormsg)
        {
            errormsg = string.Empty;
            if (!string.IsNullOrEmpty(roleSetting.RoleCode))
            {
                //RoleCode 不为空则是更新,删除原有角色
                var oldrole = _context.RoleSettings.Where(r => r.RoleCode == roleSetting.RoleCode).FirstOrDefault();
                _context.RoleSettings.Remove(oldrole);
                var oldrolechat = _context.RoleChats.Where(c => c.RoleChatCode == roleSetting.RoleChatCode).ToList();
                _context.RoleChats.RemoveRange(oldrolechat);
            }
            string roleCode = Guid.NewGuid().ToString("N");
            //保存角色设置
            var role = new RoleSetting();
            role.CreateTime = System.DateTime.Now;
            role.Account = account;
            role.RoleCode = roleCode;
            role.RoleAvatar = roleSetting.RoleAvatar;
            role.RoleName = roleSetting.RoleName;
            role.RoleInfo = roleSetting.RoleInfo;
            role.RoleSystemPrompt = roleSetting.RoleSystemPrompt;
            role.RoleChatCode = roleCode;
            _context.RoleSettings.Add(role);
            //保存角色对话
            if (roleSetting.RoleChat != null)
            {
                foreach (var item in roleSetting.RoleChat)
                {
                    var roleChat = new Models.RoleChat();
                    roleChat.RoleChatCode = roleCode;
                    roleChat.UserInput = item.UserInput;
                    roleChat.AssistantOutput = item.AssistantOutput;
                    _context.RoleChats.Add(roleChat);
                }
            }
            if (_context.SaveChanges() > 0)
            {
                errormsg = "保存成功";
                return true;
            }
            else
            {
                errormsg = "保存失败";
                return false;
            }

        }
        public List<RoleSetting> GetRoleList(int page, int pageSize, string name, out int total)
        {
            // 利用IQueryable延迟执行，直到真正需要数据的时候才去数据库查询
            IQueryable<RoleSetting> query = _context.RoleSettings;

            // 如果name不为空，则加上name的过滤条件
            if (!string.IsNullOrEmpty(name))
            {
                query = query.Where(x => x.RoleName.Contains(name));
            }

            // 首先计算总数，此时还未真正运行SQL查询
            total = query.Count();

            // 然后添加分页逻辑，此处同样是构建查询，没有执行
            var roleSettings = query.OrderBy(x => x.CreateTime) // 这里可以根据需要替换为合适的排序字段
                                .Skip((page - 1) * pageSize)
                                .Take(pageSize)
                                .ToList(); // 直到调用ToList，查询才真正执行

            return roleSettings;
        }
        public RoleSettingDto GetRole(string roleCode)
        {
            //获取角色
            var role = _context.RoleSettings.FirstOrDefault(x => x.RoleCode == roleCode);
            if (role != null)
            {
                var roleSetting = new RoleSettingDto();
                roleSetting.RoleAvatar = role.RoleAvatar;
                roleSetting.RoleName = role.RoleName;
                roleSetting.RoleInfo = role.RoleInfo;
                roleSetting.RoleSystemPrompt = role.RoleSystemPrompt;
                roleSetting.RoleChatCode = role.RoleChatCode;
                roleSetting.Account = role.Account;
                //获取角色对话
                var roleChats = _context.RoleChats.Where(x => x.RoleChatCode == role.RoleChatCode).ToList();
                if (roleChats != null && roleChats.Count > 0)
                {
                    roleSetting.RoleChat = new List<Dtos.RoleChat>();
                    foreach (var item in roleChats)
                    {
                        var roleChat = new Dtos.RoleChat();
                        roleChat.UserInput = item.UserInput;
                        roleChat.AssistantOutput = item.AssistantOutput;
                        roleSetting.RoleChat.Add(roleChat);
                    }
                }
                return roleSetting;
            }
            else
            {
                return null;
            }
        }
        public bool DelRole(string account, string roleCode, out string errormsg)
        {
            errormsg = string.Empty;
            var role = _context.RoleSettings.Where(r => r.RoleCode == roleCode && r.Account == account).FirstOrDefault();
            if (role == null)
            {
                errormsg = "角色不存在或用户无删除权限";
                return false;
            }
            var rolechat = _context.RoleChats.Where(c => c.RoleChatCode == role.RoleChatCode).ToList();
            _context.RoleSettings.Remove(role);
            _context.RoleChats.RemoveRange(rolechat);
            _context.SaveChanges();
            return true;
        }
    }
}
