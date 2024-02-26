using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using System.Security.Principal;

namespace aibotPro.Service
{
    public class UsersService : IUsersService
    {
        //依赖注入
        private readonly AIBotProContext _context;
        private readonly ISystemService _systemService;
        private readonly IRedisService _redis;
        private readonly IHttpContextAccessor _httpContextAccessor;
        public UsersService(AIBotProContext context, ISystemService systemService, IRedisService redis, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _systemService = systemService;
            _redis = redis;
            _httpContextAccessor = httpContextAccessor;
        }
        public bool Regiest(User users, string checkCode, out string errormsg)
        {
            //验证用户是否存在
            errormsg = string.Empty;
            var user = _context.Users.AsNoTracking().Where(x => x.Account == users.Account).FirstOrDefault();
            if (user != null)
            {
                errormsg = "用户已存在";
                return false;
            }
            //验证验证码是否正确
            var code = _redis.GetAsync(users.Account + "regiest_checkcode").Result;
            if (code != checkCode)
            {
                errormsg = "验证码错误";
                return false;
            }
            List<SystemCfg> systemConfig = _systemService.GetSystemCfgs();
            if (systemConfig != null)
            {
                users.Mcoin = Convert.ToDecimal(systemConfig.Find(x => x.CfgKey == "RegiestMcoin").CfgValue);
                users.CreateTime = DateTime.Now;
                users.UserCode = Guid.NewGuid().ToString().Replace("-", "");
                users.Password = _systemService.ConvertToMD5(users.Password);
                users.IsBan = 0;
            }
            else
            {
                _systemService.WriteLog("系统配置表为空", Dtos.LogLevel.Error, "system");
                return false;
            }
            //添加用户
            _context.Users.Add(users);
            //设置用户默认设置
            UserSetting userSetting = new UserSetting();
            userSetting.Account = users.Account;
            userSetting.UseHistory = 1;
            userSetting.GoodHistory = 1;
            userSetting.HistoryCount = 5;
            userSetting.Scrolling = 1;
            _context.UserSettings.Add(userSetting);
            //保存
            return _context.SaveChanges() > 0;
        }
        public bool SendRegiestEmail(string toemail, string title, string content)
        {
            string checkCode = _systemService.GenerateCode(6);
            content = content.Replace("{{checkCode}}", checkCode);
            //写入缓存
            _redis.SetAsync(toemail + "regiest_checkcode", checkCode, TimeSpan.FromMinutes(10));
            return _systemService.SendEmail(toemail, title, content);
        }
        public bool SendFindEmail(string toemail, string title, string content)
        {
            string checkCode = _systemService.GenerateCode(6);
            content = content.Replace("{{checkCode}}", checkCode);
            //写入缓存
            _redis.SetAsync(toemail + "_findpassword_checkcode", checkCode, TimeSpan.FromMinutes(10));
            return _systemService.SendEmail(toemail, title, content);
        }
        public bool FindPassword(string account, string password, string checkCode, out string errormsg)
        {
            //验证用户是否存在
            errormsg = string.Empty;
            var user = _context.Users.Where(x => x.Account == account).FirstOrDefault();
            if (user == null)
            {
                errormsg = "用户不存在";
                return false;
            }
            //验证验证码是否正确
            var code = _redis.GetAsync(account + "_findpassword_checkcode").Result;
            if (code != checkCode)
            {
                errormsg = "验证码错误";
                return false;
            }
            user.Password = _systemService.ConvertToMD5(password);
            //保存
            // 保存变更
            try
            {
                _context.Entry(user).State = EntityState.Modified; // 标记实体状态为已修改
                return _context.SaveChanges() > 0; // 保存变更到数据库
            }
            catch (Exception ex)
            {
                // 异常处理，例如记录日志等
                errormsg = "更新密码失败：" + ex.Message;
                return false;
            }
        }

        public List<VIP> GetVIPs(string account)
        {
            var user = _context.Users.AsNoTracking().Where(x => x.Account == account).FirstOrDefault();
            if (user == null) return null;
            var vips = _context.VIPs.AsNoTracking().Where(x => x.Account == user.Account).ToList();
            return vips;
        }

        public UserSetting GetUserSetting(string account)
        {
            //先尝试读取缓存
            var userSettingStr = _redis.GetAsync(account + "_usersetting").Result;
            if (!string.IsNullOrEmpty(userSettingStr))
                return JsonConvert.DeserializeObject<UserSetting>(userSettingStr);
            var userSetting = _context.UserSettings.AsNoTracking().Where(x => x.Account == account).FirstOrDefault();
            //写入缓存
            if (userSetting == null)
            {
                _systemService.WriteLog("用户设置不存在", Dtos.LogLevel.Error, account);
                throw new Exception("用户设置不存在");
            }
            _redis.SetAsync(account + "_usersetting", JsonConvert.SerializeObject(userSetting));
            return userSetting;
        }
        public bool SaveChatSetting(string account, string settingJson, out string errormsg)
        {
            errormsg = string.Empty;
            //判断用户是否有设置
            var userChatSetting = _context.ChatSettings.Where(x => x.Account == account).FirstOrDefault();
            //有则更新
            if (userChatSetting == null)
            {
                ChatSetting chatSetting = new ChatSetting()
                {
                    Account = account,
                    ChatSettingKey = account,
                    ChatSettingValue = settingJson
                };
                _context.ChatSettings.Add(chatSetting);
            }
            else
            {
                //更新
                userChatSetting.ChatSettingValue = settingJson;
                _context.Entry(userChatSetting).State = EntityState.Modified;
                //更新缓存
                _redis.SetAsync(account + "_chatsetting", settingJson);
            }
            //保存userSetting
            var userSetting = _context.UserSettings.Where(x => x.Account == account).FirstOrDefault();
            if (userSetting == null)
            {
                errormsg = "用户设置不存在";
                return false;
            }
            var chatSettingDto = JsonConvert.DeserializeObject<ChatSettingDto>(settingJson);
            userSetting.UseHistory = chatSettingDto.SystemSetting.UseHistory;
            userSetting.HistoryCount = chatSettingDto.SystemSetting.HistoryCount;
            userSetting.Scrolling = chatSettingDto.SystemSetting.Scrolling;
            _context.Entry(userSetting).State = EntityState.Modified;
            //更新缓存
            _redis.SetAsync(account + "_usersetting", JsonConvert.SerializeObject(userSetting));
            //保存
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
        public ChatSettingDto GetChatSetting(string account)
        {
            ChatSettingDto chatSettingDto = new ChatSettingDto();
            //先尝试读取缓存
            var chatSettingStr = _redis.GetAsync(account + "_chatsetting").Result;
            if (!string.IsNullOrEmpty(chatSettingStr))
                return JsonConvert.DeserializeObject<ChatSettingDto>(chatSettingStr);
            var chatSetting = _context.ChatSettings.Where(x => x.Account == account).FirstOrDefault();
            //查询UserSetting
            var userSetting = GetUserSetting(account);
            if (chatSetting != null)
                chatSettingDto = JsonConvert.DeserializeObject<ChatSettingDto>(chatSetting.ChatSettingValue);
            chatSettingDto.SystemSetting = new SystemSetting()
            {
                UseHistory = userSetting.UseHistory.Value,
                HistoryCount = userSetting.HistoryCount.Value,
                Scrolling = userSetting.Scrolling.Value
            };
            //写入缓存
            _redis.SetAsync(account + "_chatsetting", JsonConvert.SerializeObject(chatSettingDto));
            return chatSettingDto;
        }
        public bool DeleteChatSetting(string account, out string errormsg)
        {
            //删除缓存
            _redis.DeleteAsync(account + "_chatsetting");
            //删除数据库
            var chatSetting = _context.ChatSettings.Where(x => x.Account == account).FirstOrDefault();
            if (chatSetting != null)
            {
                _context.ChatSettings.Remove(chatSetting);
                if (_context.SaveChanges() > 0)
                {
                    errormsg = "删除成功";
                    return true;
                }
                else
                {
                    errormsg = "删除失败";
                    return false;
                }
            }
            else
            {
                errormsg = "删除成功";
                return true;
            }
        }
        public User GetUserData(string account)
        {
            var user = _context.Users.Where(x => x.Account == account).FirstOrDefault();
            if (user == null) return null;
            return user;
        }
        public bool IsAdmin(string username)
        {
            var admin = _context.Admins.AsNoTracking().FirstOrDefault(x => x.Account == username);
            return admin != null;
        }
    }
}
