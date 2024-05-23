using aibotPro.Dtos;
using aibotPro.Models;
using Microsoft.AspNetCore.Mvc;
using System;
namespace aibotPro.Interface
{
    public interface IFinanceService
    {
        bool UpdateUserMoney(string account, decimal money, string type, out string errormsg);//更新用户余额
        Task<bool> CreateUseLogAndUpadteMoney(string account, string modelName, int inputCount, int outputCount, bool isdraw = false);//创建消耗记录并更新用户余额
        Task<bool> CreateUseLog(string account, string modelName, int inputCount, int outputCount, decimal realOutputMoney);//创建消耗记录
        Task<FreePlanDto> CheckFree(string account, string modelName);//检查免费详情
        Task<bool> UpdateFree(string account, int deductions = 1);//更新免费详情
        Task<FreePlanDto> GetFreePlan(string account);//获取免费详情
        Task<bool> IsVip(string account);//是否是VIP
        Task<List<VIP>> GetVipData(string account);//获取VIP信息
        Task<bool> VipExceed(string account);//VIP是否过期
        Task<List<ModelPrice>> GetModelPriceList();//获取模型价格列表
        Task<ModelPrice> ModelPrice(string modelName);//获取模型价格
        PayInfoDto PayInfo(string account, int money, string type, string param = null);//获取支付通道信息
        Task<PayInfoDto> PayTo(string account, string goodCode, string type);//商城支付获取支付通道信息
        Task<bool> BalancePayTo(string account, string goodCode, string type);//商城余额支付
        PayResultDto PayResult(string out_trade_no);//获取支付结果
        EasyPaySetting GetEasyPaySetting();//获取易支付配置
        List<Order> GetOrders(string account, int page, int size, out int total);//获取订单列表
        Task<List<UseUpLog>> GetUsedData(DateTime startTime, DateTime endTime, string account);//获取消耗记录
        List<UseUpLog> GetLogs(string account, int page, int size, out int total);//获取消耗记录-分页
        bool CreateTXorder(string account, string aliAccount, decimal money);//创建提现订单

        bool ReleaseGood(GoodReleaseDto goodReleaseDto);//发布商品
        Good GetGood(string goodCode);//查询商品
        List<Good> GetGoods(string gname, int pageIndex, int pageSize, bool? onShelves, out int total);//查询商品列表
        Task<bool> UpdateGoodsStock(string goodCode, int stock);//更新商品库存
    }
}

