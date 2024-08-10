using aibotPro.Dtos;
using aibotPro.Models;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace aibotPro.Interface
{
    public interface IUsersService
    {
        bool Regiest(User users, string checkCode, string shareCode, out string errormsg);//注册
        bool SendRegiestEmail(string toemail, string title, string content);//发送注册验证码
        bool SendFindEmail(string toemail, string title, string content);//发送找回密码验证码
        bool FindPassword(string account, string password, string checkCode, out string errormsg);//找回密码
        Task<string> GenerateCodeImage(string account, string key = "");//生成图形验证码
        Task<bool> CheckCodeImage(string account, string writeCode, string key = "");//验证图形验证码
        List<VIP> GetVIPs(string account);//获取VIP信息
        UserSetting GetUserSetting(string account);//获取用户设置
        bool SaveChatSetting(string account, string settingJson, out string errormsg);//保存对话设置
        bool DeleteChatSetting(string account, out string errormsg);//删除对话设置
        ChatSettingDto GetChatSetting(string account);//获取对话设置
        User GetUserData(string account);//获取用户信息
        bool IsAdmin(string username);//是否是管理员
        string CreateShareLink(string username);//创建分享链接
        bool ShareCodeIsTrue(string shareCode, out string errormsg);//分享码是否正确
        bool UpdateShareMcoinAndWriteLog(string shareCode, decimal Mcoin);//更新分享收益并写入分享日志
        Share GetShareInfo(string account);//获取分享信息
        List<Share> GetMyShare(string account, int page, int size, out int total);//获取我的分享列表
        List<ShareLog> GetShareLog(string account, int page, int size, out int total);//获取我的分享奖励/使用 记录
        bool SaveModelSeq(string account, List<ChatModelSeq> chatModelSeq, out string errormsg);//保存用户自定义模型列表排序
        Task<bool> ChatHubBeforeCheck(ChatDto chatDto, string account, string senMethod, string chatId);//对话前的检查
        List<ErrorBilling> GetErrorBilling(string username, int page, int page_size, out int total);//获取错误计费撤回申请列表
        bool IsSupperVIP(string account);//检查是否为高级会员
        List<DateTime> GetThisMonthSignInList(string account);//获取本月的签到记录
        bool AddUserPrompt(string prompt, string account);//添加用户常用提示词
        List<UserPrompt> GetUserPromptList(string account, int page, int size, out int total, string prompt = "");//获取用户常用提示词
        bool DeleteUserPrompt(int id, string account);//删除用户常用提示词

    }
}
