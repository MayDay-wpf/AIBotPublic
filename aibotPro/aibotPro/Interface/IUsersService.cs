using aibotPro.Dtos;
using aibotPro.Models;

namespace aibotPro.Interface
{
    public interface IUsersService
    {
        bool Regiest(User users, string checkCode, string shareCode, out string errormsg);//注册
        bool SendRegiestEmail(string toemail, string title, string content);//发送注册验证码
        bool SendFindEmail(string toemail, string title, string content);//发送找回密码验证码
        bool FindPassword(string account, string password, string checkCode, out string errormsg);//找回密码
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
        List<Share> GetMyShare(string account, int page, int size, out int total);
        List<ShareLog> GetShareLog(string account, int page, int size, out int total);

        bool SaveModelSeq(string account, List<ChatModelSeq> chatModelSeq, out string errormsg);
        Task<bool> ChatHubBeforeCheck(ChatDto chatDto, string account, string senMethod, string chatId);

    }
}
