using System;
using System.Security.Cryptography;
using System.Text;
using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using Newtonsoft.Json;

namespace aibotPro.Service
{
    public class FinanceService : IFinanceService
    {
        private readonly AIBotProContext _context;
        private readonly ISystemService _systemService;
        private readonly IRedisService _redisService;
        private readonly IAiServer _aiServer;

        public FinanceService(AIBotProContext context, ISystemService systemService, IRedisService redisService, IAiServer aiServer)
        {
            _context = context;
            _systemService = systemService;
            _redisService = redisService;
            _aiServer = aiServer;
        }
        public bool UpdateUserMoney(string account, decimal money, string type, out string errormsg)
        {
            errormsg = string.Empty;
            var user = _context.Users.Where(x => x.Account == account).FirstOrDefault();
            if (user == null)
            {
                errormsg = "用户不存在";
                return false;
            }
            if (type == "add")
            {
                user.Mcoin += money;
            }
            else
            {
                //如果余额不足
                if (user.Mcoin < money)
                {
                    errormsg = "余额不足";
                    return false;
                }
                user.Mcoin -= money;
            }
            // 保存变更
            try
            {
                _context.Entry(user).State = EntityState.Modified; // 标记实体状态为已修改
                return _context.SaveChanges() > 0; // 保存变更到数据库
            }
            catch (Exception ex)
            {
                errormsg = ex.Message;
                // 异常处理，记录日志
                _systemService.WriteLog("更新用户余额失败：" + ex.Message, Dtos.LogLevel.Error, account);
                return false;
            }
        }
        public async Task<bool> CreateUseLogAndUpadteMoney(string account, string modelName, int inputCount, int outputCount, bool isdraw = false)
        {
            var user = _context.Users.Where(x => x.Account == account).FirstOrDefault();
            if (user == null)
            {
                return false;
            }
            decimal? realOutputMoney = 0m;
            //尝试从缓存中获取模型定价列表
            List<ModelPrice> modelPriceList = await GetModelPriceList();
            //根据模型名称获取模型定价
            var modelPrice = modelPriceList.Where(x => x.ModelName == modelName).FirstOrDefault();
            if (modelPrice != null)//如果不存在就是不扣费
            {
                //查询用户是否是VIP
                bool vip = await IsVip(account);
                if (vip)
                {
                    //如果是VIP，使用VIP价格
                    modelPrice.ModelPriceInput = modelPrice.VipModelPriceInput;
                    modelPrice.ModelPriceOutput = modelPrice.VipModelPriceOutput;
                    modelPrice.Rebate = modelPrice.VipRebate;
                }
                //如果是绘画
                if (isdraw)
                {
                    realOutputMoney = modelPrice.ModelPriceOutput * modelPrice.Rebate;
                }
                else
                {
                    //更新用户余额,字数要除以1000
                    var inputMoney = modelPrice.ModelPriceInput * inputCount / 1000;
                    var outputMoney = modelPrice.ModelPriceOutput * outputCount / 1000;
                    //根据折扣计算实际扣费
                    var rebate = modelPrice.Rebate;
                    realOutputMoney = (inputMoney + outputMoney) * rebate;
                }
                //扣除用户余额
                user.Mcoin -= realOutputMoney;
                if (user.Mcoin < 0)
                {
                    user.Mcoin = 0;
                }
                //标记实体状态为已修改
                _context.Entry(user).State = EntityState.Modified;
            }
            var log = new UseUpLog
            {
                Account = account,
                InputCount = inputCount,
                OutputCount = outputCount,
                UseMoney = realOutputMoney,
                CreateTime = DateTime.Now,
                ModelName = modelName
            };
            _context.UseUpLogs.Add(log);
            //保存变更到数据库
            return await _context.SaveChangesAsync() > 0;
        }
        public async Task<bool> IsVip(string account)
        {
            //查询用户是否是VIP
            var vip = await _context.VIPs.Where(x => x.Account == account).ToListAsync();
            //遍历VIP列表，如果有一个VIP未过期，则返回true
            if (vip.Count == 0)
            {
                return false;
            }
            foreach (var item in vip)
            {
                if (item.EndTime > DateTime.Now)
                {
                    return true;
                }
            }
            return false;
        }
        public async Task<List<VIP>> GetVipData(string account)
        {
            var vip = await _context.VIPs.Where(x => x.Account == account).ToListAsync();
            return vip;
        }
        public async Task<bool> VipExceed(string account)
        {
            //查询用户是否是VIP
            var vip = await _context.VIPs.Where(x => x.Account == account).ToListAsync();
            if (vip.Count == 0)
            {
                return false;
            }
            //遍历VIP列表
            foreach (var item in vip)
            {
                //删除过期的VIP
                if (item.EndTime < DateTime.Now)
                {
                    _context.VIPs.Remove(item);
                    _context.SaveChanges();
                }
            }
            //如果VIP列表为空，则返回true
            if (vip.Count == 0)
            {
                return true;
            }
            else
                return false;
            return true;
        }
        public async Task<List<ModelPrice>> GetModelPriceList()
        {
            //尝试从缓存中获取模型定价列表
            List<ModelPrice> modelPriceList = null;
            var modelPriceList_str = await _redisService.GetAsync("ModelPriceList");
            if (modelPriceList == null)
            {
                //如果缓存中没有模型定价列表，则从数据库中获取
                modelPriceList = await _context.ModelPrices.AsNoTracking().ToListAsync();
                //将模型定价列表存入缓存
                await _redisService.SetAsync("ModelPriceList", JsonConvert.SerializeObject(modelPriceList));
            }
            else
            {
                modelPriceList = JsonConvert.DeserializeObject<List<ModelPrice>>(modelPriceList_str);
            }
            return modelPriceList;
        }
        public async Task<ModelPrice> ModelPrice(string modelName)
        {
            //尝试从缓存中获取模型定价列表
            List<ModelPrice> modelPriceList = null;
            var modelPriceList_str = await _redisService.GetAsync("ModelPriceList");
            if (modelPriceList == null)
            {
                //如果缓存中没有模型定价列表，则从数据库中获取
                modelPriceList = await _context.ModelPrices.AsNoTracking().ToListAsync();
                //将模型定价列表存入缓存
                await _redisService.SetAsync("ModelPriceList", JsonConvert.SerializeObject(modelPriceList));
            }
            else
            {
                modelPriceList = JsonConvert.DeserializeObject<List<ModelPrice>>(modelPriceList_str);
            }
            return modelPriceList.Where(x => x.ModelName == modelName).FirstOrDefault();
        }
        public EasyPaySetting GetEasyPaySetting()
        {
            EasyPaySetting easyPaySetting = null;
            var payInfo = _redisService.GetAsync("PayInfo").Result;
            if (payInfo == null)
            {
                //如果缓存中没有支付通道信息，则从数据库中获取
                easyPaySetting = _context.EasyPaySettings.AsNoTracking().FirstOrDefault();
                //将支付通道信息存入缓存
                _redisService.SetAsync("PayInfo", JsonConvert.SerializeObject(easyPaySetting));
            }
            else
            {
                easyPaySetting = JsonConvert.DeserializeObject<EasyPaySetting>(payInfo);
            }
            return easyPaySetting;
        }
        public PayInfoDto PayInfo(string account, int money, string type, string param = null)
        {
            //尝试从缓存中获取支付通道信息
            EasyPaySetting easyPaySetting = GetEasyPaySetting();
            string OrderCode = DateTime.Now.ToString("yyyyMMddHHmmss") + Guid.NewGuid().ToString().Replace("-", "");
            int pid = easyPaySetting.ShopId.Value;
            string out_trade_no = OrderCode;
            string notify_url = easyPaySetting.NotifyUrl;
            string return_url = easyPaySetting.ReturnUrl;
            string name = string.Empty;
            if (string.IsNullOrEmpty(param))
                name = $"Mcoin:{money}";
            else
                name = param;
            param += $"|{_systemService.UrlEncode(account)}";
            string payurl = easyPaySetting.SubmitUrl;
            var parameters = new Dictionary<string, string>
                {
                    { "pid",pid.ToString()},
                    { "type", type },
                    { "out_trade_no",OrderCode },
                    { "notify_url", notify_url },
                    { "return_url", return_url },
                    { "name", name },
                    { "param", param},
                    { "money", money.ToString("F2")}
                };
            string apikey = easyPaySetting.ApiKey;
            string sign = GenerateSign(parameters, apikey);
            Order order = new Order();
            order.OrderMoney = money;
            order.OrderCode = OrderCode;
            order.CreateTime = DateTime.Now;
            order.OrderStatus = "NO";
            order.OrderType = name;
            order.Account = account;
            _context.Orders.Add(order);
            _context.SaveChanges();
            PayInfoDto payInfoDto = new PayInfoDto();
            payInfoDto.payurl = payurl;
            payInfoDto.pid = pid.ToString();
            payInfoDto.out_trade_no = out_trade_no;
            payInfoDto.notify_url = notify_url;
            payInfoDto.return_url = return_url;
            payInfoDto.name = name;
            payInfoDto.param = param;
            payInfoDto.money = money.ToString("F2");
            payInfoDto.sign = sign;
            payInfoDto.sign_type = "MD5";
            return payInfoDto;
        }
        public PayResultDto PayResult(string out_trade_no)
        {
            EasyPaySetting easyPaySetting = GetEasyPaySetting();
            Dictionary<string, string> pr = new Dictionary<string, string>();
            pr.Add("act", "order");
            pr.Add("pid", easyPaySetting.ShopId.ToString());
            pr.Add("key", easyPaySetting.ApiKey.ToString());
            pr.Add("out_trade_no", out_trade_no);
            PayResultDto payResultDto = JsonConvert.DeserializeObject<PayResultDto>(_aiServer.AiGet(easyPaySetting.CheckPayUrl, pr));
            return payResultDto;
        }
        public List<Order> GetOrders(string account, int page, int size, out int total)
        {
            IQueryable<Order> query = null;
            // 利用IQueryable延迟执行，直到真正需要数据的时候才去数据库查询
            if (string.IsNullOrEmpty(account))
            {
                query = _context.Orders;
            }
            else
            {
                query = _context.Orders.Where(p => p.Account == account);
            }
            // 首先计算总数，此时还未真正运行SQL查询
            total = query.Count();

            // 然后添加分页逻辑，此处同样是构建查询，没有执行
            var orders = query.OrderByDescending(x => x.CreateTime) // 这里可以根据需要替换为合适的排序字段
                                .Skip((page - 1) * size)
                                .Take(size)
                                .ToList(); // 直到调用ToList，查询才真正执行

            return orders;
        }
        public List<UseUpLog> GetLogs(string account, int page, int size, out int total)
        {
            IQueryable<UseUpLog> query = null;
            //如果账号为空，则查询所有用户的消费记录
            if (string.IsNullOrEmpty(account))
            {
                query = _context.UseUpLogs;
            }
            else
            {
                // 利用IQueryable延迟执行，直到真正需要数据的时候才去数据库查询
                query = _context.UseUpLogs.Where(p => p.Account == account);
            }
            // 首先计算总数，此时还未真正运行SQL查询
            total = query.Count();

            // 然后添加分页逻辑，此处同样是构建查询，没有执行
            var logs = query.OrderByDescending(x => x.CreateTime) // 这里可以根据需要替换为合适的排序字段
                                .Skip((page - 1) * size)
                                .Take(size)
                                .ToList(); // 直到调用ToList，查询才真正执行

            return logs;
        }
        public async Task<List<UseUpLog>> GetUsedData(DateTime startTime, DateTime endTime, string account)
        {
            //如果账号为空，则查询所有用户的消费记录
            if (string.IsNullOrEmpty(account))
            {
                var usedDataAll = await _context.UseUpLogs.Where(x => x.CreateTime >= startTime && x.CreateTime <= endTime).ToListAsync();
                return usedDataAll;
            }
            var usedData = await _context.UseUpLogs.Where(x => x.CreateTime >= startTime && x.CreateTime <= endTime && x.Account == account).ToListAsync();
            return usedData;
        }
        public bool CreateTXorder(string account, string aliAccount, decimal money)
        {
            TxOrder txOrder = new TxOrder();
            txOrder.Account = account;
            txOrder.AliAccount = aliAccount;
            txOrder.Money = money;
            txOrder.IsOver = 0;
            txOrder.CreateTime = DateTime.Now;
            _context.TxOrders.Add(txOrder);
            return _context.SaveChanges() > 0;
        }

        private static string GenerateSign(IDictionary<string, string> parameters, string key)
        {
            // 第一步：按照参数名ASCII码从小到大排序
            var sortedParams = parameters
                .OrderBy(p => p.Key, StringComparer.Ordinal)
                .Where(p => !string.IsNullOrEmpty(p.Value))
                .ToDictionary(p => p.Key, p => p.Value);

            // 第二步：拼接参数
            var paramString = string.Join("&", sortedParams.Select(p => $"{p.Key}={p.Value}"));

            // 第三步：拼接商户密钥并进行MD5加密
            string sign = CalculateMD5(paramString + key);

            return sign;
        }

        private static string CalculateMD5(string input)
        {
            using (MD5 md5 = System.Security.Cryptography.MD5.Create())
            {
                byte[] inputBytes = Encoding.UTF8.GetBytes(input);
                byte[] hashBytes = md5.ComputeHash(inputBytes);

                StringBuilder sb = new StringBuilder();
                foreach (byte b in hashBytes)
                {
                    sb.Append(b.ToString("x2"));
                }
                return sb.ToString();
            }
        }
    }
}

