using System;
using System.Net;
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
using StackExchange.Redis;
using Order = aibotPro.Models.Order;

namespace aibotPro.Service
{
    public class FinanceService : IFinanceService
    {
        private readonly AIBotProContext _context;
        private readonly ISystemService _systemService;
        private readonly IRedisService _redisService;

        public FinanceService(AIBotProContext context, ISystemService systemService, IRedisService redisService,
            IAiServer aiServer)
        {
            _context = context;
            _systemService = systemService;
            _redisService = redisService;
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

        public async Task<bool> CreateUseLogAndUpadteMoney(string account, string modelName, int inputCount,
    int outputCount, bool isdraw = false)
        {
            var lockKey = $"lock-balance-{account}";
            try
            {
                if (!await AcquireLockAsync(lockKey))
                {
                    return false; // 未能获取锁，直接退出以避免并发修改
                }

                using (var transaction = _context.Database.BeginTransaction())
                {
                    try
                    {
                        var user = _context.Users.SingleOrDefault(x => x.Account == account);
                        if (user == null)
                        {
                            return false;
                        }

                        decimal? realOutputMoney = 0m;
                        List<ModelPrice> modelPriceList = await GetModelPriceList();
                        var modelPrice = modelPriceList.SingleOrDefault(x => x.ModelName == modelName);

                        if (modelPrice != null)
                        {
                            bool vip = await IsVip(account);
                            bool svip = await IsSVip(account);
                            decimal? onceFee;
                            decimal? inputMoney = 0;
                            decimal? outputMoney = 0;

                            if (svip)
                            {
                                onceFee = modelPrice.SvipOnceFee;
                                modelPrice.ModelPriceInput = modelPrice.SvipModelPriceInput;
                                modelPrice.ModelPriceOutput = modelPrice.SvipModelPriceOutput;
                                modelPrice.Rebate = modelPrice.SvipRebate;
                            }
                            else if (vip)
                            {
                                onceFee = modelPrice.VipOnceFee;
                                modelPrice.ModelPriceInput = modelPrice.VipModelPriceInput;
                                modelPrice.ModelPriceOutput = modelPrice.VipModelPriceOutput;
                                modelPrice.Rebate = modelPrice.VipRebate;
                            }
                            else
                            {
                                onceFee = modelPrice.OnceFee;
                                // ModelPriceInput and ModelPriceOutput are already set for non-VIP users
                            }

                            if (onceFee > 0)
                            {
                                realOutputMoney = onceFee;
                            }
                            else
                            {
                                if (isdraw)
                                {
                                    realOutputMoney = modelPrice.ModelPriceOutput * modelPrice.Rebate;
                                }
                                else
                                {
                                    inputMoney = modelPrice.ModelPriceInput * inputCount / 1000;
                                    outputMoney = modelPrice.ModelPriceOutput * outputCount / 1000;
                                    realOutputMoney = (inputMoney + outputMoney) * modelPrice.Rebate;
                                    if (realOutputMoney > modelPrice.Maximum)
                                    {
                                        realOutputMoney = modelPrice.Maximum;
                                    }
                                }
                            }

                            user.Mcoin -= realOutputMoney ?? 0;
                            if (user.Mcoin < 0)
                            {
                                user.Mcoin = 0;
                            }

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
            finally
            {
                await ReleaseLockAsync(lockKey);
            }
        }

        private async Task<bool> AcquireLockAsync(string key)
        {
            var lockValue = Guid.NewGuid().ToString();
            var expiry = TimeSpan.FromSeconds(30); // 锁过期时间

            // 首先查询 key 是否已经存在
            var existingValue = await _redisService.GetAsync(key);
            if (existingValue != null)
            {
                return false; // 锁已存在，无法获取
            }

            // 尝试设置 key
            await _redisService.SetAsync(key, lockValue, expiry, AIBotProEnum.HashFieldOperationMode.Overwrite);

            // 再次确保在设置后，锁依旧属于我们
            var finalValue = await _redisService.GetAsync(key);
            return finalValue == lockValue;
        }

        private async Task ReleaseLockAsync(string key)
        {
            await _redisService.DeleteAsync(key);
        }
        public async Task<bool> CreateUseLog(string account, string modelName, int inputCount, int outputCount,
            decimal realOutputMoney)
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
            if (workShopFreeModel != null) //如果有免费模型
            {
                var workShopFreeModel_list = workShopFreeModel.CfgValue.Split(",");
                if (workShopFreeModel_list.Contains(modelName)) //如果使用模型属于免费模型
                {
                    string freePlanKey = "FreePlan_" + account; //免费方案Redis Key
                    var freePlan = await _redisService.GetAsync(freePlanKey);
                    if (freePlan == null) //如果没有免费方案
                    {
                        bool isVip = await IsVip(account);
                        var workShopFreeModelUpdateHour = double.Parse(systemCfg
                            .Where(x => x.CfgKey == "WorkShop_FreeModel_UpdateHour").FirstOrDefault().CfgValue
                            .ToString());
                        if (isVip)
                        {
                            var workShopFreeModelCountVip = int.Parse(systemCfg
                                .Where(x => x.CfgKey == "WorkShop_FreeModel_Count_VIP").FirstOrDefault().CfgValue
                                .ToString());
                            freePlanDto.TotalCount = workShopFreeModelCountVip;
                            freePlanDto.UsedCount = 0;
                            freePlanDto.RemainCount = workShopFreeModelCountVip;
                            freePlanDto.ExpireTime = DateTime.Now.AddHours(workShopFreeModelUpdateHour);
                        }
                        else
                        {
                            var workShopFreeModelCount = int.Parse(systemCfg
                                .Where(x => x.CfgKey == "WorkShop_FreeModel_Count").FirstOrDefault().CfgValue
                                .ToString());
                            freePlanDto.TotalCount = workShopFreeModelCount;
                            freePlanDto.UsedCount = 0;
                            freePlanDto.RemainCount = workShopFreeModelCount;
                            freePlanDto.ExpireTime = DateTime.Now.AddHours(workShopFreeModelUpdateHour);
                        }

                        //免费计划写入缓存
                        await _redisService.SetAsync(freePlanKey, JsonConvert.SerializeObject(freePlanDto),
                            freePlanDto.ExpireTime - DateTime.Now);
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
            string freePlanKey = "FreePlan_" + account; //免费方案Redis Key
            var freePlan = await _redisService.GetAsync(freePlanKey);
            if (freePlan != null)
            {
                FreePlanDto freePlanDto = JsonConvert.DeserializeObject<FreePlanDto>(freePlan);
                if (freePlanDto.RemainCount > 0)
                {
                    freePlanDto.RemainCount -= deductions;
                    freePlanDto.UsedCount += deductions;
                    //更新缓存
                    await _redisService.SetAsync(freePlanKey, JsonConvert.SerializeObject(freePlanDto),
                        freePlanDto.ExpireTime - DateTime.Now);
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
            if (workShopFreeModel != null) //如果有免费模型
            {
                string freePlanKey = "FreePlan_" + account; //免费方案Redis Key
                var freePlan = await _redisService.GetAsync(freePlanKey);
                if (freePlan == null) //如果没有免费方案
                {
                    bool isVip = await IsVip(account);
                    var workShopFreeModelUpdateHour = double.Parse(systemCfg
                        .Where(x => x.CfgKey == "WorkShop_FreeModel_UpdateHour").FirstOrDefault().CfgValue.ToString());
                    if (isVip)
                    {
                        var workShopFreeModelCountVip = int.Parse(systemCfg
                            .Where(x => x.CfgKey == "WorkShop_FreeModel_Count_VIP").FirstOrDefault().CfgValue
                            .ToString());
                        freePlanDto.TotalCount = workShopFreeModelCountVip;
                        freePlanDto.UsedCount = 0;
                        freePlanDto.RemainCount = workShopFreeModelCountVip;
                        freePlanDto.ExpireTime = DateTime.Now.AddHours(workShopFreeModelUpdateHour);
                    }
                    else
                    {
                        var workShopFreeModelCount = int.Parse(systemCfg
                            .Where(x => x.CfgKey == "WorkShop_FreeModel_Count").FirstOrDefault().CfgValue.ToString());
                        freePlanDto.TotalCount = workShopFreeModelCount;
                        freePlanDto.UsedCount = 0;
                        freePlanDto.RemainCount = workShopFreeModelCount;
                        freePlanDto.ExpireTime = DateTime.Now.AddHours(workShopFreeModelUpdateHour);
                    }

                    //将免费方案存入缓存
                    await _redisService.SetAsync(freePlanKey, JsonConvert.SerializeObject(freePlanDto),
                        freePlanDto.ExpireTime - DateTime.Now);
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
        public async Task<bool> IsSVip(string account)
        {
            //查询用户是否是SVIP
            var vip = await _context.VIPs.Where(x => x.Account == account && (x.VipType == "VIP|50" || x.VipType == "VIP|90")).ToListAsync();
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

        public async Task<VIPDto> VipExceed(string account)
        {
            VIPDto dto = new VIPDto();
            //查询用户是否是VIP
            var vip = await _context.VIPs.Where(x => x.Account == account).ToListAsync();
            if (vip.Count == 0)
            {
                //未开通
                dto.Exceed = false;
                dto.Unopened = true;
                return dto;
            }

            //遍历VIP列表
            foreach (var item in vip)
            {
                //删除过期的VIP
                if (item.EndTime < DateTime.Now)
                {
                    _context.VIPs.Remove(item);
                }
            }

            _context.SaveChanges();
            vip = await _context.VIPs.Where(x => x.Account == account).ToListAsync();
            //更新后再检查该用户会员状态
            if (vip.Count == 0)
            {
                //已过期
                dto.Exceed = true;
                dto.Unopened = false;
            }

            return dto;
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
                { "pid", pid.ToString() },
                { "type", type },
                { "out_trade_no", OrderCode },
                { "notify_url", notify_url },
                { "return_url", return_url },
                { "name", name },
                { "param", param },
                { "money", money.ToString("F2") }
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
                { "pid", pid.ToString() },
                { "type", type },
                { "out_trade_no", OrderCode },
                { "notify_url", notify_url },
                { "return_url", return_url },
                { "name", good.GoodName },
                { "param", param },
                { "money", good.GoodPrice.ToString() }
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

                if (good.VIPType == "VIP|20")
                {
                    var vipinfo = _context.VIPs.AsNoTracking().FirstOrDefault(x => x.Account == account);
                    if (vipinfo != null && vipinfo.VipType == "VIP|20")
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
                    else if (vipinfo != null && vipinfo.VipType == "VIP|50")
                    {
                        VIP vip = new VIP();
                        vip.VipType = "VIP|20";
                        vip.Account = account;
                        vip.StartTime = vipinfo.EndTime;
                        vip.EndTime = vipinfo.EndTime.Value.AddDays((double)good.VIPDays);
                        vip.CreateTime = DateTime.Now;
                        _context.VIPs.Add(vip);
                    }
                    else
                    {
                        VIP vip = new VIP();
                        vip.VipType = "VIP|20";
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
                else if (good.VIPType == "VIP|50")
                {
                    var vipinfo = _context.VIPs.AsNoTracking().FirstOrDefault(x => x.Account == account);
                    if (vipinfo != null && vipinfo.VipType == "VIP|50")
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
                    else if (vipinfo != null && vipinfo.VipType == "VIP|20")
                    {
                        VIP vip = new VIP();
                        vip.VipType = "VIP|50";
                        vip.Account = account;
                        vip.StartTime = vipinfo.EndTime;
                        vip.EndTime = vipinfo.EndTime.Value.AddDays((double)good.VIPDays);
                        vip.CreateTime = DateTime.Now;
                        _context.VIPs.Add(vip);
                    }
                    else
                    {
                        VIP vip = new VIP();
                        vip.VipType = "VIP|50";
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
            PayResultDto payResultDto =
                JsonConvert.DeserializeObject<PayResultDto>(GetResult(easyPaySetting.CheckPayUrl, pr));
            return payResultDto;
        }
        private string GetResult(string url, Dictionary<string, object> dic, Dictionary<string, string> headers = null,
    Dictionary<string, string> cookies = null)
        {
            var result = "";
            var builder = new StringBuilder();
            builder.Append(url);
            if (dic.Count > 0)
            {
                builder.Append("?");
                var i = 0;
                foreach (var item in dic)
                {
                    if (i > 0)
                        builder.Append("&");
                    builder.AppendFormat("{0}={1}", item.Key, item.Value);
                    i++;
                }
            }

            //如果headers有值，则加入到request头部
            var req = (HttpWebRequest)WebRequest.Create(builder.ToString());
            if (headers != null)
                foreach (var item in headers)
                    req.Headers.Add(item.Key, item.Value);

            //如果cookies有值，则加入到request的Cookie容器
            if (cookies != null)
            {
                var cookieContainer = new CookieContainer();
                foreach (var item in cookies)
                    cookieContainer.Add(new Cookie(item.Key, item.Value, "/", req.RequestUri.Host));
                req.CookieContainer = cookieContainer;
            }

            //添加参数
            var resp = (HttpWebResponse)req.GetResponse();
            var stream = resp.GetResponseStream();
            try
            {
                //获取内容
                using (var reader = new StreamReader(stream))
                {
                    result = reader.ReadToEnd();
                }
            }
            finally
            {
                stream.Close();
            }

            return result;
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
                var usedDataAll = await _context.UseUpLogs
                    .Where(x => x.CreateTime >= startTime && x.CreateTime <= endTime).ToListAsync();
                return usedDataAll;
            }

            var usedData = await _context.UseUpLogs
                .Where(x => x.CreateTime >= startTime && x.CreateTime <= endTime && x.Account == account).ToListAsync();
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

        public bool CreateErrorBilling(int logId, decimal useMoney, string cause, string account, out string errMsg)
        {
            errMsg = string.Empty;
            bool result = false;
            //查询该笔申请是否已存在
            var bill = _context.ErrorBillings.Where(b => b.LogId == logId).FirstOrDefault();
            if (bill != null)
            {
                errMsg = "申请已存在，请勿重复提交";
            }
            else
            {
                ErrorBilling errorBilling = new ErrorBilling()
                {
                    LogId = logId,
                    Account = account,
                    Cause = cause,
                    UseMoney = useMoney,
                    Status = 0,
                    Reply = string.Empty,
                    CreateTime = DateTime.Now
                };
                _context.ErrorBillings.Add(errorBilling);
                _context.SaveChanges();
                result = true;
            }

            return result;
        }

        public bool UpdateErrorBilling(int id, int type, string reply, out string errMsg)
        {
            errMsg = string.Empty;
            var bill = _context.ErrorBillings.Where(b => b.Id == id).FirstOrDefault();
            if (bill != null)
            {
                if (type == 3)
                {
                    _context.ErrorBillings.Remove(bill);
                    return _context.SaveChanges() > 0;
                }

                bill.Status = type;
                bill.Reply = reply;
                bill.HandlingTime = DateTime.Now;
                //标记实体状态为已修改
                _context.Entry(bill).State = EntityState.Modified;
                if (bill.Status == 1) //恢复用户余额
                {
                    var user = _context.Users.Where(x => x.Account == bill.Account).FirstOrDefault();
                    if (user == null)
                    {
                        errMsg = "用户不存在";
                        return false;
                    }

                    user.Mcoin += bill.UseMoney;
                    //删除日志
                    var log = _context.UseUpLogs.Where(l => l.Id == bill.LogId).FirstOrDefault();
                    _context.UseUpLogs.Remove(log);
                    _context.Entry(user).State = EntityState.Modified;
                }

                return _context.SaveChanges() > 0;
            }
            else
            {
                errMsg = "记录不存在";
                return false;
            }
        }

        public async Task UsageSaveRedis(string chatId, string account, string role, string content,
            AIBotProEnum.HashFieldOperationMode mode = AIBotProEnum.HashFieldOperationMode.Overwrite)
        {
            if (!string.IsNullOrEmpty(content))
            {
                await _redisService.SetAsync($"{chatId}_{role}", content, TimeSpan.FromHours(1), mode);
            }
        }

        public async Task<string> UsageGetRedis(string chatId, string role)
        {
            string key = $"{chatId}_{role}";
            return await _redisService.GetAsync(key);
        }

        public async Task<bool> DeleteUsageRedis(string chatId, string role)
        {
            string key = $"{chatId}_{role}";
            return await _redisService.DeleteAsync(key);
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