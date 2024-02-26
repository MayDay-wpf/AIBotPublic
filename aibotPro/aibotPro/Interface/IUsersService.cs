using aibotPro.Dtos;
using aibotPro.Models;

namespace aibotPro.Interface
{
    public interface IUsersService
    {
        bool Regiest(User users, string checkCode, out string errormsg);//注册
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
    }
}
