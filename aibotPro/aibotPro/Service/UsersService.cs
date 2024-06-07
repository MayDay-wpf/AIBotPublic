using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using Microsoft.AspNetCore.SignalR;
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
        private readonly IFinanceService _financeService;
        private readonly IHubContext<ChatHub> _hubContext;

        public UsersService(AIBotProContext context, ISystemService systemService, IRedisService redis, IHttpContextAccessor httpContextAccessor, IFinanceService financeService, IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _systemService = systemService;
            _redis = redis;
            _httpContextAccessor = httpContextAccessor;
            _financeService = financeService;
            _hubContext = hubContext;
        }
        public bool Regiest(User users, string checkCode, string shareCode, out string errormsg)
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
                var startMcoin = Convert.ToDecimal(systemConfig.Find(x => x.CfgKey == "RegiestMcoin").CfgValue);
                if (!string.IsNullOrEmpty(shareCode) && ShareCodeIsTrue(shareCode, out errormsg))
                {
                    //验证分享码是否存在
                    startMcoin = Convert.ToDecimal(systemConfig.Find(x => x.CfgKey == "ShareMcoin").CfgValue);
                    //判断该用户是否存在于分享关系表中
                    if (!_context.Shares.AsNoTracking().Any(x => x.Account == users.Account))
                    {
                        //存入分享关系数据
                        var myCode = OnlyShareCode();
                        var parentAccount = _context.Shares.AsNoTracking().FirstOrDefault(x => x.ShareCode == shareCode).Account;
                        var shareRelation = new Share()
                        {
                            Account = users.Account,
                            ParentAccount = parentAccount,
                            CreateTime = DateTime.Now,
                            Mcoin = 0,
                            ShareCode = myCode
                        };
                        _context.Shares.Add(shareRelation);
                    }
                }
                users.Mcoin = startMcoin;
                users.CreateTime = DateTime.Now;
                users.UserCode = Guid.NewGuid().ToString().Replace("-", "");
                users.Password = _systemService.ConvertToMD5(users.Password);
                users.IsBan = 0;
            }
            else
            {
                _systemService.WriteLogUnAsync("系统配置表为空", Dtos.LogLevel.Error, "system");
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
            return UpdateShareMcoinAndWriteLog(shareCode, 0.3m);
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
            userSetting.GoodHistory = chatSettingDto.SystemSetting.GoodHistory;
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
                Scrolling = userSetting.Scrolling.Value,
                GoodHistory = userSetting.GoodHistory.Value
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
        public string CreateShareLink(string username)
        {
            //查询Share表中是否有此用户
            var share = _context.Shares.AsNoTracking().FirstOrDefault(x => x.Account == username);
            //获取网站地址
            var systemCfg = _systemService.GetSystemCfgs().FirstOrDefault(x => x.CfgKey == "Domain");
            if (systemCfg == null)
            {
                _systemService.WriteLog("系统配置表为空", Dtos.LogLevel.Error, "system");
                return string.Empty;
            }
            //没有则创建
            if (share == null)
            {
                var code = OnlyShareCode();
                share = new Share()
                {
                    Account = username,
                    ParentAccount = "admin",
                    CreateTime = DateTime.Now,
                    Mcoin = 0,
                    ShareCode = code
                };
                _context.Shares.Add(share);
                _context.SaveChanges();
                return "https://" + systemCfg.CfgValue + "/Users/Regiest?sharecode=" + code;
            }
            return "https://" + systemCfg.CfgValue + "/Users/Regiest?sharecode=" + share.ShareCode;
        }
        public bool ShareCodeIsTrue(string shareCode, out string errormsg)
        {
            errormsg = string.Empty;
            var share = _context.Shares.AsNoTracking().FirstOrDefault(x => x.ShareCode == shareCode);
            if (share == null)
            {
                errormsg = "分享码不存在";
                return false;
            }
            return true;
        }
        public bool UpdateShareMcoinAndWriteLog(string shareCode, decimal Mcoin)
        {
            if (!ShareCodeIsTrue(shareCode, out string errormsg))
            {
                return _context.SaveChanges() > 0;
            }
            var share = _context.Shares.FirstOrDefault(x => x.ShareCode == shareCode);
            share.Mcoin += Mcoin;
            _context.Entry(share).State = EntityState.Modified;
            //写入日志
            string log = $"分享收益+{Mcoin}";
            if (Mcoin < 0)
            {
                log = $"使用收益：{Mcoin}";
            }
            ShareLog shareLog = new ShareLog()
            {
                Account = share.Account,
                LogTxt = log,
                CreateTime = DateTime.Now
            };
            _context.ShareLogs.Add(shareLog);
            return _context.SaveChanges() > 0;
        }
        public Share GetShareInfo(string account)
        {
            var share = _context.Shares.AsNoTracking().FirstOrDefault(x => x.Account == account);
            return share;
        }
        public List<Share> GetMyShare(string account, int page, int size, out int total)
        {
            IQueryable<Share> query = _context.Shares.Where(s => s.ParentAccount == account);
            total = query.Count();
            var shares = query.OrderByDescending(x => x.Id)
                                .Skip((page - 1) * size)
                                .Take(size)
                                .ToList();
            return shares;
        }
        public List<ShareLog> GetShareLog(string account, int page, int size, out int total)
        {
            IQueryable<ShareLog> query = _context.ShareLogs.Where(s => s.Account == account);
            total = query.Count();
            var logs = query.OrderByDescending(x => x.Id)
                                .Skip((page - 1) * size)
                                .Take(size)
                                .ToList();
            return logs;
        }


        private string OnlyShareCode()
        {
            var code = "";
            do
            {
                code = _systemService.GenerateCode(6);
            } while (_context.Shares.AsNoTracking().Any(x => x.ShareCode == code));

            return code;
        }
        public bool SaveModelSeq(string account, List<ChatModelSeq> chatModelSeq, out string errormsg)
        {
            errormsg = "保存成功";
            var user = _context.Users.AsNoTracking().Where(x => x.Account == account).FirstOrDefault();
            if (user == null)
            {
                errormsg = "用户不存在";
                return false;
            }
            var modelSeq = _context.AImodelsUserSeqs.Where(x => x.Account == account).FirstOrDefault();
            //有则更新,没有则创建
            if (modelSeq == null)
            {
                foreach (var item in chatModelSeq)
                {
                    var aiModelSeq = new AImodelsUserSeq()
                    {
                        Account = account,
                        ModelNick = item.ModelNick,
                        ModelName = item.ModelName,
                        Seq = item.Seq
                    };
                    _context.AImodelsUserSeqs.Add(aiModelSeq);
                }
            }
            else
            {
                //删除原有的
                _context.AImodelsUserSeqs.RemoveRange(_context.AImodelsUserSeqs.Where(x => x.Account == account));
                //添加新的
                foreach (var item in chatModelSeq)
                {
                    var aiModelSeq = new AImodelsUserSeq()
                    {
                        Account = account,
                        ModelNick = item.ModelNick,
                        ModelName = item.ModelName,
                        Seq = item.Seq
                    };
                    _context.AImodelsUserSeqs.Add(aiModelSeq);
                }
            }
            //刷新缓存
            _redis.SetAsync(account + "_modelSeq", JsonConvert.SerializeObject(chatModelSeq));
            return _context.SaveChanges() > 0;
        }
        public async Task<bool> ChatHubBeforeCheck(ChatDto chatDto, string account, string senMethod, string chatId)
        {
            bool result = true;
            ChatRes chatRes = new ChatRes();
            var user = GetUserData(account);
            var modelPrice = await _financeService.ModelPrice(chatDto.aiModel);
            bool isVip = await _financeService.IsVip(account);
            bool shouldCharge = modelPrice != null && (
                        (!isVip && modelPrice.ModelPriceOutput > 0) || // 非VIP用户，且模型有非VIP价格
                        (isVip && modelPrice.VipModelPriceInput > 0)); // VIP用户，且模型对VIP也有价格

            //不是会员且余额为0时不提供服务
            if (!isVip && user.Mcoin <= 0)
            {
                chatRes.message = "本站已停止向【非会员且余额为0】的用户提供服务，您可以<a href='/Pay/Balance'>点击这里</a>前往充值1元及以上，长期使用本站的免费服务";
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                chatRes.message = "";
                chatRes.isfinish = true;
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                result = false;
            }
            // 检查用户余额是否不足，只有在需要收费时检查
            if (shouldCharge && user.Mcoin <= 0)
            {
                chatRes.message = "余额不足，请充值后再使用，您可以<a href='/Pay/Balance'>点击这里</a>前往充值";
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                chatRes.message = "";
                chatRes.isfinish = true;
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                result = false;
            }
            if (chatDto.isbot && !chatDto.aiModel.Contains("gpt-3.5"))
            {
                chatRes.message = "您正在使用非正当手段修改我的基底模型，我们允许且欢迎您寻找本站的BUG，但很明显，这个漏洞已经被开发团队修复，请您不要再继续尝试，本站不会记录任何用户的正常行为，但是对于异常行为有着详细的日志信息和风控手段，感谢您的合作与支持，如果您还有其他问题，请询问我。";
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                chatRes.message = "";
                chatRes.isfinish = true;
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                await _systemService.WriteLog("异常行为：用户尝试修改Robot的基底模型", Dtos.LogLevel.Fatal, account);
                result = false;
            }
            return result;
        }

    }
}
