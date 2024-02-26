using aibotPro.Models;
using System.Net;

namespace aibotPro.Interface
{
    public interface IAdminsService
    {
        bool IsAdmin(string username);//是否是管理员
        List<IPlook> GetIps(int page, int size, out int total);//获取IP记录-分页
        List<User> GetUsersList(int page, int size, string name, int isBan, out int total);//获取用户列表-分页
        List<VIP> GetVipList(int page, int size, string name, out int total);//获取VIP列表-分页
        Task<bool> SaveAiChatSetting(List<AImodel> aImodel);//保存AI聊天设置
        Task<bool> SaveWorkShopAiChatSetting(List<WorkShopAIModel> workShopAIModel);//保存插件基底模型
        Task<bool> SaveModelPrice(List<ModelPrice> modelPrice);//保存模型价格
        Task<bool> SaveSystemConfig(List<SystemCfg> systemCfgs);//保存系统配置
        List<SystemLog> GetSystemLogs(int page, int size, out int total);//获取系统日志
        List<Admin> GetAdminList(int page, int size, out int total);//获取管理员列表
        bool CreateAccount(string account, string password);//创建账号
        bool SendNotice(string content);//发送公告
    }
}
