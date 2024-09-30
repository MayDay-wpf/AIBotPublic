using aibotPro.Dtos;

namespace aibotPro.Interface
{
    public interface INewApiService
    {
        bool UserIsBinded(string account); //检查用户是否绑定NewAPI
        bool UserBindNewApi(string account, string newapiAcount, out string errorMsg, string password); //绑定NewAPI
        NewApiUserInfoResult GetNewApiUserInfoByAccount(string newusername, out string errorMsg); //获取NewAPI用户信息
        string NewApiCheckIn(string account, out string errorMsg); //签到领取API额度
        bool TodayIsCheckedIn(string account); //判断今天是否签到过
        string CreateNewApiCard(string name, int count, long quota); //创建NewAPI兑换卡
    }
}