using aibotPro.Interface;
using aibotPro.Models;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using System;

namespace aibotPro.Service
{
    public class AdminService : IAdminsService
    {
        private readonly AIBotProContext _context;
        private readonly IRedisService _redisService;
        private readonly ISystemService _systemService;
        public AdminService(AIBotProContext context, IRedisService redisService, ISystemService systemService)
        {
            _context = context;
            _redisService = redisService;
            _systemService = systemService;
        }
        public bool IsAdmin(string username)
        {
            var admin = _context.Admins.AsNoTracking().FirstOrDefault(x => x.Account == username);
            return admin != null;
        }
        public List<IPlook> GetIps(int page, int size, out int total)
        {
            // 利用IQueryable延迟执行，直到真正需要数据的时候才去数据库查询
            IQueryable<IPlook> query = _context.IPlooks;
            // 首先计算总数，此时还未真正运行SQL查询
            total = query.Count();

            // 然后添加分页逻辑，此处同样是构建查询，没有执行
            var ips = query.OrderByDescending(x => x.LookTime) // 这里可以根据需要替换为合适的排序字段
                                .Skip((page - 1) * size)
                                .Take(size)
                                .ToList(); // 直到调用ToList，查询才真正执行

            return ips;
        }
        public List<User> GetUsersList(int page, int size, string name, int isBan, out int total)
        {
            IQueryable<User> query = _context.Users.Where(x => string.IsNullOrEmpty(name) || x.Account.Contains(name)).Where(x => x.IsBan == isBan);
            total = query.Count();
            var users = query.OrderByDescending(x => x.Id)
                                .Skip((page - 1) * size)
                                .Take(size)
                                .ToList();
            return users;
        }
        public List<VIP> GetVipList(int page, int size, string name, out int total)
        {
            IQueryable<VIP> query = _context.VIPs.Where(x => string.IsNullOrEmpty(name) || x.Account.Contains(name));
            total = query.Count();
            var vips = query.OrderByDescending(x => x.Id)
                                .Skip((page - 1) * size)
                                .Take(size)
                                .ToList();
            return vips;
        }
        public async Task<bool> SaveAiChatSetting(List<AImodel> aImodel)
        {
            //删除所有AI聊天设置
            _context.AImodels.RemoveRange(_context.AImodels);
            //保存AI聊天设置
            _context.AImodels.AddRange(aImodel);
            //更新缓存
            await _redisService.SetAsync("AImodel", JsonConvert.SerializeObject(aImodel));
            //保存到数据库
            return _context.SaveChanges() > 0;
        }
        public async Task<bool> SaveWorkShopAiChatSetting(List<WorkShopAIModel> workShopAIModel)
        {
            //删除所有AI聊天设置
            _context.WorkShopAIModels.RemoveRange(_context.WorkShopAIModels);
            //保存AI聊天设置
            _context.WorkShopAIModels.AddRange(workShopAIModel);
            //更新缓存
            await _redisService.SetAsync("WorkShopAImodel", JsonConvert.SerializeObject(workShopAIModel));
            //保存到数据库
            return _context.SaveChanges() > 0;
        }
        public async Task<bool> SaveAssistantSetting(List<AssistantModelPrice> assistantModelPrice)
        {
            //删除所有AI聊天设置
            _context.AssistantModelPrices.RemoveRange(_context.AssistantModelPrices);
            //保存AI聊天设置
            _context.AssistantModelPrices.AddRange(assistantModelPrice);
            //保存到数据库
            return _context.SaveChanges() > 0;
        }
        public async Task<bool> SaveModelPrice(List<ModelPrice> modelPrice)
        {
            //删除所有模型价格
            _context.ModelPrices.RemoveRange(_context.ModelPrices);
            //保存模型价格
            _context.ModelPrices.AddRange(modelPrice);
            //更新缓存
            await _redisService.SetAsync("ModelPriceList", JsonConvert.SerializeObject(modelPrice));
            //保存到数据库
            return _context.SaveChanges() > 0;
        }
        public async Task<bool> SaveSystemConfig(List<SystemCfg> systemCfgs)
        {
            //删除所有系统配置
            _context.SystemCfgs.RemoveRange(_context.SystemCfgs);
            //保存系统配置
            _context.SystemCfgs.AddRange(systemCfgs);
            //更新缓存
            await _redisService.SetAsync("SystemConfig", JsonConvert.SerializeObject(systemCfgs));
            //保存到数据库
            return _context.SaveChanges() > 0;
        }
        public List<SystemLog> GetSystemLogs(int page, int size, out int total)
        {
            IQueryable<SystemLog> query = _context.SystemLogs;
            total = query.Count();
            var logs = query.OrderByDescending(x => x.Id)
                                .Skip((page - 1) * size)
                                .Take(size)
                                .ToList();
            return logs;
        }
        public List<Admin> GetAdminList(int page, int size, out int total)
        {
            IQueryable<Admin> query = _context.Admins;
            total = query.Count();
            var admins = query.OrderByDescending(x => x.Id)
                                .Skip((page - 1) * size)
                                .Take(size)
                                .ToList();
            return admins;
        }
        public bool CreateAccount(string account, string password)
        {
            var user = _context.Users.Where(x => x.Account == account).FirstOrDefault();
            if (user != null)
            {
                return false;
            }
            _context.Users.Add(new User
            {
                UserCode = Guid.NewGuid().ToString("N"),
                Account = account,
                Password = _systemService.ConvertToMD5(password),
                Nick = account,
                HeadImg = "/system/images/defaultHeadImg.png",//默认头像
                Sex = "保密",
                Mcoin = 0,
                IsBan = 0,
                CreateTime = DateTime.Now
            });
            _context.UserSettings.Add(new UserSetting
            {
                Account = account,
                UseHistory = 1,
                GoodHistory = 1,
                HistoryCount = 5,
                Scrolling = 1
            });
            return _context.SaveChanges() > 0;
        }

        public bool SendNotice(int id, string title, string content)
        {
            //更新通知
            if (id > 0)
            {
                var notice = _context.Notices.Where(x => x.Id == id);
                notice.FirstOrDefault().NoticeTitle = title;
                notice.FirstOrDefault().NoticeContent = content;
                notice.FirstOrDefault().CreateTime = DateTime.Now;
            }
            else
            {
                _context.Notices.Add(new Notice
                {
                    NoticeTitle = title,
                    NoticeContent = content,
                    CreateTime = DateTime.Now
                });
            }
            return _context.SaveChanges() > 0;
        }

        public List<Notice> GetNotices(int page, int size, out int total)
        {
            IQueryable<Notice> query = null;
            query = _context.Notices;
            // 首先计算总数，此时还未真正运行SQL查询
            total = query.Count();

            // 然后添加分页逻辑，此处同样是构建查询，没有执行
            var notices = query.OrderByDescending(x => x.CreateTime) // 这里可以根据需要替换为合适的排序字段
                .Skip((page - 1) * size)
                .Take(size)
                .ToList(); // 直到调用ToList，查询才真正执行

            return notices;
        }
        public bool ApiKeyCheck(string key)
        {
            var result = _context.APIKEYs.Where(x => x.ApiKey1 == key).FirstOrDefault();
            return result != null;
        }
        public List<UsersLimit> GetUsersLimits(int page, int size, out int total, string account = "")
        {
            IQueryable<UsersLimit> query = _context.UsersLimits.Where(x => string.IsNullOrEmpty(account) || x.Account.Contains(account));
            total = query.Count();
            var usersLimit = query.OrderByDescending(x => x.Id)
                                .Skip((page - 1) * size)
                                .Take(size)
                                .ToList();
            return usersLimit;
        }
        public bool EnableUsersLimits(int Id, bool enable)
        {
            var usersLimit = _context.UsersLimits.Where(l => l.Id == Id).FirstOrDefault();
            if (usersLimit != null)
            {
                usersLimit.Enable = enable;
                _context.SaveChanges();
            }
            return true;
        }
    }
}
