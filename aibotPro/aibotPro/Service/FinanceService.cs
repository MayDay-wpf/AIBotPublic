using System;
using System.Security.Cryptography;
using System.Text;
using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Mvc.RazorPages;
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
            using (var transaction = _context.Database.BeginTransaction())
            {
                try
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
                        decimal? onceFee = 0;
                        if (vip)
                        {
                            //如果是VIP，使用VIP价格
                            modelPrice.ModelPriceInput = modelPrice.VipModelPriceInput;
                            modelPrice.ModelPriceOutput = modelPrice.VipModelPriceOutput;
                            modelPrice.Rebate = modelPrice.VipRebate;
                            onceFee = modelPrice.VipOnceFee;
                        }
                        else
                        {
                            onceFee = modelPrice.OnceFee;
                        }
                        //如果是绘画
                        if (isdraw)
                        {
                            if (onceFee > 0)
                                realOutputMoney = onceFee;
                            else
                                realOutputMoney = modelPrice.ModelPriceOutput * modelPrice.Rebate;
                        }
                        else
                        {
                            if (onceFee > 0)
                                realOutputMoney = onceFee;
                            else
                            {
                                //更新用户余额,字数要除以1000
                                var inputMoney = modelPrice.ModelPriceInput * inputCount / 1000;
                                var outputMoney = modelPrice.ModelPriceOutput * outputCount / 1000;
                                //根据折扣计算实际扣费
                                var rebate = modelPrice.Rebate;
                                realOutputMoney = (inputMoney + outputMoney) * rebate;
                                if (realOutputMoney > modelPrice.Maximum)
                                    realOutputMoney = modelPrice.Maximum;
                            }
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
                    await _context.SaveChangesAsync();
                    transaction.Commit();
                    return true;
                }
                catch (Exception)
                {
                    transaction.Rollback();
                    return false;
                }
            }
        }

        public async Task<bool> CreateUseLog(string account, string modelName, int inputCount, int outputCount, decimal realOutputMoney)
        {
            using (var transaction = _context.Database.BeginTransaction())
            {
                try
                {
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
                    await _context.SaveChangesAsync();
                    transaction.Commit();
                    return true;
                }
                catch (Exception)
                {
                    transaction.Rollback();
                    return false;
                }
            }
        }
        public async Task<FreePlanDto> CheckFree(string account, string modelName)
        {
            FreePlanDto freePlanDto = new FreePlanDto();
            var systemCfg = _systemService.GetSystemCfgs();
            var workShopFreeModel = systemCfg.Where(x => x.CfgKey == "WorkShop_FreeModel").FirstOrDefault();
            if (workShopFreeModel != null)//如果有免费模型
            {
                var workShopFreeModel_list = workShopFreeModel.CfgValue.Split(",");
                if (workShopFreeModel_list.Contains(modelName))//如果使用模型属于免费模型
                {
                    string freePlanKey = "FreePlan_" + account;//免费方案Redis Key
                    var freePlan = await _redisService.GetAsync(freePlanKey);
                    if (freePlan == null)//如果没有免费方案
                    {
                        bool isVip = await IsVip(account);
                        var workShopFreeModelUpdateHour = double.Parse(systemCfg.Where(x => x.CfgKey == "WorkShop_FreeModel_UpdateHour").FirstOrDefault().CfgValue.ToString());
                        if (isVip)
                        {
                            var workShopFreeModelCountVip = int.Parse(systemCfg.Where(x => x.CfgKey == "WorkShop_FreeModel_Count_VIP").FirstOrDefault().CfgValue.ToString());
                            freePlanDto.TotalCount = workShopFreeModelCountVip;
                            freePlanDto.UsedCount = 0;
                            freePlanDto.RemainCount = workShopFreeModelCountVip;
                            freePlanDto.ExpireTime = DateTime.Now.AddHours(workShopFreeModelUpdateHour);
                        }
                        else
                        {
                            var workShopFreeModelCount = int.Parse(systemCfg.Where(x => x.CfgKey == "WorkShop_FreeModel_Count").FirstOrDefault().CfgValue.ToString());
                            freePlanDto.TotalCount = workShopFreeModelCount;
                            freePlanDto.UsedCount = 0;
                            freePlanDto.RemainCount = workShopFreeModelCount;
                            freePlanDto.ExpireTime = DateTime.Now.AddHours(workShopFreeModelUpdateHour);
                        }
                        //免费计划写入缓存
                        await _redisService.SetAsync(freePlanKey, JsonConvert.SerializeObject(freePlanDto), freePlanDto.ExpireTime - DateTime.Now);
                    }
                    else
                    {
                        freePlanDto = JsonConvert.DeserializeObject<FreePlanDto>(freePlan);
                    }
                }
            }
            return freePlanDto;
        }
        public async Task<bool> UpdateFree(string account, int deductions = 1)
        {
            string freePlanKey = "FreePlan_" + account;//免费方案Redis Key
            var freePlan = await _redisService.GetAsync(freePlanKey);
            if (freePlan != null)
            {
                FreePlanDto freePlanDto = JsonConvert.DeserializeObject<FreePlanDto>(freePlan);
                if (freePlanDto.RemainCount > 0)
                {
                    freePlanDto.RemainCount -= deductions;
                    freePlanDto.UsedCount += deductions;
                    //更新缓存
                    await _redisService.SetAsync(freePlanKey, JsonConvert.SerializeObject(freePlanDto), freePlanDto.ExpireTime - DateTime.Now);
                    return true;
                }
            }
            return false;
        }
        public async Task<FreePlanDto> GetFreePlan(string account)
        {
            FreePlanDto freePlanDto = new FreePlanDto();
            var systemCfg = _systemService.GetSystemCfgs();
            var workShopFreeModel = systemCfg.Where(x => x.CfgKey == "WorkShop_FreeModel").FirstOrDefault();
            if (workShopFreeModel != null)//如果有免费模型
            {
                string freePlanKey = "FreePlan_" + account;//免费方案Redis Key
                var freePlan = await _redisService.GetAsync(freePlanKey);
                if (freePlan == null)//如果没有免费方案
                {
                    bool isVip = await IsVip(account);
                    var workShopFreeModelUpdateHour = double.Parse(systemCfg.Where(x => x.CfgKey == "WorkShop_FreeModel_UpdateHour").FirstOrDefault().CfgValue.ToString());
                    if (isVip)
                    {
                        var workShopFreeModelCountVip = int.Parse(systemCfg.Where(x => x.CfgKey == "WorkShop_FreeModel_Count_VIP").FirstOrDefault().CfgValue.ToString());
                        freePlanDto.TotalCount = workShopFreeModelCountVip;
                        freePlanDto.UsedCount = 0;
                        freePlanDto.RemainCount = workShopFreeModelCountVip;
                        freePlanDto.ExpireTime = DateTime.Now.AddHours(workShopFreeModelUpdateHour);
                    }
                    else
                    {
                        var workShopFreeModelCount = int.Parse(systemCfg.Where(x => x.CfgKey == "WorkShop_FreeModel_Count").FirstOrDefault().CfgValue.ToString());
                        freePlanDto.TotalCount = workShopFreeModelCount;
                        freePlanDto.UsedCount = 0;
                        freePlanDto.RemainCount = workShopFreeModelCount;
                        freePlanDto.ExpireTime = DateTime.Now.AddHours(workShopFreeModelUpdateHour);
                    }
                    //将免费方案存入缓存
                    await _redisService.SetAsync(freePlanKey, JsonConvert.SerializeObject(freePlanDto), freePlanDto.ExpireTime - DateTime.Now);
                }
                else
                {
                    freePlanDto = JsonConvert.DeserializeObject<FreePlanDto>(freePlan);
                }
            }
            return freePlanDto;
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
        public Task<PayInfoDto> PayTo(string account, string goodCode, string type)
        {
            //尝试从缓存中获取支付通道信息
            EasyPaySetting easyPaySetting = GetEasyPaySetting();
            string OrderCode = DateTime.Now.ToString("yyyyMMddHHmmss") + Guid.NewGuid().ToString().Replace("-", "");
            int pid = easyPaySetting.ShopId.Value;
            string out_trade_no = OrderCode;
            string notify_url = easyPaySetting.NotifyUrl;
            string return_url = easyPaySetting.ReturnUrl;
            //根据商品编码查询商品信息
            var good = _context.Goods.Where(x => x.GoodCode == goodCode).FirstOrDefault();
            if (good == null)
                throw new Exception("商品不存在");
            if (good.GoodStock <= 0)
                throw new Exception("商品库存不足");
            string param = goodCode + $"|{_systemService.UrlEncode(account)}" + "|MALL";
            string payurl = easyPaySetting.SubmitUrl;
            var parameters = new Dictionary<string, string>
                {
                    { "pid",pid.ToString()},
                    { "type", type },
                    { "out_trade_no",OrderCode },
                    { "notify_url", notify_url },
                    { "return_url", return_url },
                    { "name", good.GoodName },
                    { "param", param},
                    { "money", good.GoodPrice.ToString()}
                };
            string apikey = easyPaySetting.ApiKey;
            string sign = GenerateSign(parameters, apikey);
            Order order = new Order();
            order.OrderMoney = good.GoodPrice;
            order.OrderCode = OrderCode;
            order.CreateTime = DateTime.Now;
            order.OrderStatus = "NO";
            order.OrderType = param;
            order.Account = account;
            _context.Orders.Add(order);
            _context.SaveChanges();
            PayInfoDto payInfoDto = new PayInfoDto();
            payInfoDto.payurl = payurl;
            payInfoDto.pid = pid.ToString();
            payInfoDto.out_trade_no = out_trade_no;
            payInfoDto.notify_url = notify_url;
            payInfoDto.return_url = return_url;
            payInfoDto.name = good.GoodName;
            payInfoDto.param = param;
            payInfoDto.money = good.GoodPrice.ToString();
            payInfoDto.sign = sign;
            payInfoDto.sign_type = "MD5";
            return Task.FromResult(payInfoDto);
        }

        public Task<bool> BalancePayTo(string account, string goodCode, string type)
        {
            //查询商品信息
            var good = _context.Goods.Where(x => x.GoodCode == goodCode).FirstOrDefault();
            if (good == null)
                return Task.FromResult(false);
            if (good.GoodStock <= 0)
                return Task.FromResult(false);
            //检查商品是否允许余额支付
            if (good.GoodPayType.Contains(type))
            {
                //检查用户余额是否足够
                var user = _context.Users.Where(x => x.Account == account).FirstOrDefault();
                if (user.Mcoin < good.GoodPrice)
                {
                    return Task.FromResult(false);
                }
                //扣除用户余额
                user.Mcoin -= good.GoodPrice;
                _context.Entry(user).State = EntityState.Modified;
                //创建消耗记录
                UseUpLog useUpLog = new UseUpLog();
                useUpLog.Account = account;
                useUpLog.InputCount = 0;
                useUpLog.OutputCount = 0;
                useUpLog.UseMoney = good.GoodPrice;
                useUpLog.CreateTime = DateTime.Now;
                useUpLog.ModelName = good.GoodName;
                _context.UseUpLogs.Add(useUpLog);
                if (good.Balance > 0)
                {
                    //更新用户余额
                    user.Mcoin = user.Mcoin + good.Balance;
                }
                if (good.VIPType == "VIP|15")
                {
                    var vipinfo = _context.VIPs.AsNoTracking().FirstOrDefault(x => x.Account == account);
                    if (vipinfo != null && vipinfo.VipType == "VIP|15")
                    {
                        if (vipinfo.EndTime > DateTime.Now)
                        {
                            vipinfo.EndTime = vipinfo.EndTime.Value.AddDays((double)good.VIPDays);
                        }
                        else
                        {
                            vipinfo.EndTime = DateTime.Now.AddDays((double)good.VIPDays);
                        }
                        _context.VIPs.Update(vipinfo);
                    }
                    else if (vipinfo != null && vipinfo.VipType == "VIP|90")
                    {
                        VIP vip = new VIP();
                        vip.VipType = "VIP|15";
                        vip.Account = account;
                        vip.StartTime = vipinfo.EndTime;
                        vip.EndTime = vipinfo.EndTime.Value.AddDays((double)good.VIPDays);
                        vip.CreateTime = DateTime.Now;
                        _context.VIPs.Add(vip);
                    }
                    else
                    {
                        VIP vip = new VIP();
                        vip.VipType = "VIP|15";
                        vip.Account = account;
                        vip.StartTime = DateTime.Now;
                        vip.EndTime = DateTime.Now.AddDays((double)good.VIPDays);
                        vip.CreateTime = DateTime.Now;
                        _context.VIPs.Add(vip);
                    }
                    _context.SaveChanges();
                    UpdateGoodsStock(goodCode, 1);
                    return Task.FromResult(true);
                }
                else if (good.VIPType == "VIP|90")
                {
                    var vipinfo = _context.VIPs.AsNoTracking().FirstOrDefault(x => x.Account == account);
                    if (vipinfo != null && vipinfo.VipType == "VIP|90")
                    {
                        if (vipinfo.EndTime > DateTime.Now)
                        {
                            vipinfo.EndTime = vipinfo.EndTime.Value.AddDays((double)good.VIPDays);
                        }
                        else
                        {
                            vipinfo.EndTime = DateTime.Now.AddDays((double)good.VIPDays);
                        }
                        _context.VIPs.Update(vipinfo);
                    }
                    else if (vipinfo != null && vipinfo.VipType == "VIP|15")
                    {
                        VIP vip = new VIP();
                        vip.VipType = "VIP|90";
                        vip.Account = account;
                        vip.StartTime = vipinfo.EndTime;
                        vip.EndTime = vipinfo.EndTime.Value.AddDays((double)good.VIPDays);
                        vip.CreateTime = DateTime.Now;
                        _context.VIPs.Add(vip);
                    }
                    else
                    {
                        VIP vip = new VIP();
                        vip.VipType = "VIP|90";
                        vip.Account = account;
                        vip.StartTime = DateTime.Now;
                        vip.EndTime = DateTime.Now.AddDays((double)good.VIPDays);
                        vip.CreateTime = DateTime.Now;
                        _context.VIPs.Add(vip);
                    }
                }
                _context.SaveChanges();
                return Task.FromResult(true);
            }
            else
                return Task.FromResult(false);
        }
        public PayResultDto PayResult(string out_trade_no)
        {
            EasyPaySetting easyPaySetting = GetEasyPaySetting();
            Dictionary<string, object> pr = new Dictionary<string, object>();
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
                query = _context.Orders.Where(p => p.Account.Contains(account));
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
                query = _context.UseUpLogs.Where(p => p.Account.Contains(account));
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
        public bool ReleaseGood(GoodReleaseDto goodReleaseDto)
        {
            bool result = false;
            if (!goodReleaseDto.isUpdate)
            {
                Good good = new Good();
                good.GoodCode = Guid.NewGuid().ToString();
                good.GoodName = goodReleaseDto.Goodname;
                good.GoodPrice = goodReleaseDto.Goodprice;
                good.GoodImage = goodReleaseDto.Goodimage;
                good.GoodInfo = goodReleaseDto.Goodinfo;
                good.GoodStock = goodReleaseDto.Goodstock;
                good.GoodPayType = string.Join(",", goodReleaseDto.Paytype);
                good.OnShelves = true;
                good.VIPType = goodReleaseDto.Viptype;
                good.VIPDays = goodReleaseDto.Vipdays;
                good.Balance = goodReleaseDto.Balance;
                good.CreateTime = DateTime.Now;
                _context.Goods.Add(good);
                result = _context.SaveChanges() > 0;
            }
            else
            {
                Good goodToUpdate = _context.Goods.FirstOrDefault(g => g.GoodCode == goodReleaseDto.Goodcode);
                if (goodToUpdate != null)
                {
                    goodToUpdate.GoodName = goodReleaseDto.Goodname;
                    goodToUpdate.GoodPrice = goodReleaseDto.Goodprice;
                    goodToUpdate.GoodImage = goodReleaseDto.Goodimage;
                    goodToUpdate.GoodInfo = goodReleaseDto.Goodinfo;
                    goodToUpdate.GoodStock = goodReleaseDto.Goodstock;
                    goodToUpdate.GoodPayType = string.Join(",", goodReleaseDto.Paytype);
                    goodToUpdate.VIPType = goodReleaseDto.Viptype;
                    goodToUpdate.VIPDays = goodReleaseDto.Vipdays;
                    goodToUpdate.Balance = goodReleaseDto.Balance;
                    // 更新可能不需要修改创建时间和是否上架
                    _context.SaveChanges();
                    result = true;
                }
            }

            return result;
        }
        public Good GetGood(string goodCode)
        {
            return _context.Goods.Where(x => x.GoodCode == goodCode).FirstOrDefault();
        }
        public List<Good> GetGoods(string gname, int pageIndex, int pageSize, bool? onShelves, out int total)
        {
            //分页获取插件
            // 利用IQueryable延迟执行，直到真正需要数据的时候才去数据库查询
            IQueryable<Good> query = _context.Goods;
            if (onShelves != null)
            {
                query = _context.Goods.Where(g => g.OnShelves == onShelves);
            }

            // 如果name不为空，则加上name的过滤条件
            if (!string.IsNullOrEmpty(gname))
            {
                query = query.Where(x => x.GoodName.Contains(gname));
            }

            // 首先计算总数，此时还未真正运行SQL查询
            total = query.Count();

            // 然后添加分页逻辑，此处同样是构建查询，没有执行
            var goods = query.OrderBy(x => x.CreateTime) // 这里可以根据需要替换为合适的排序字段
                                .Skip((pageIndex - 1) * pageSize)
                                .Take(pageSize)
                                .ToList(); // 直到调用ToList，查询才真正执行

            return goods;
        }
        public Task<bool> UpdateGoodsStock(string goodCode, int stock)
        {
            var good = _context.Goods.Where(x => x.GoodCode == goodCode).FirstOrDefault();
            if (good == null)
            {
                return Task.FromResult(false);
            }
            good.GoodStock -= stock;
            _context.Entry(good).State = EntityState.Modified;
            return Task.FromResult(_context.SaveChanges() > 0);
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

