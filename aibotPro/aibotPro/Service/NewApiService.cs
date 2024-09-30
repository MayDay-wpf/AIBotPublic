using System.Text;
using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using Newtonsoft.Json;
using RestSharp;

namespace aibotPro.Service
{
    public class NewApiService : INewApiService
    {
        private readonly AIBotProContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IRedisService _redis;
        private readonly ISystemService _systemService;
        private string _newApiAccessToken = string.Empty;
        private string _newApiUrl = string.Empty;

        public NewApiService(AIBotProContext context, IHttpContextAccessor httpContextAccessor, IRedisService redis,
            ISystemService systemService)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
            _redis = redis;
            _systemService = systemService;
            var systemConfig = _systemService.GetSystemCfgs();
            _newApiAccessToken = systemConfig.Find(x => x.CfgKey == "NewApiAccessToken").CfgValue;
            _newApiUrl = systemConfig.Find(x => x.CfgKey == "NewApiUrl").CfgValue;
            if (!string.IsNullOrEmpty(_newApiAccessToken) && !string.IsNullOrEmpty(_newApiUrl))
            {
                if (_newApiUrl.EndsWith("/")) _newApiUrl = _newApiUrl.TrimEnd('/');
            }
        }

        public bool UserIsBinded(string account)
        {
            var user = _context.BindNewApis.Where(x => x.Account == account).FirstOrDefault();
            return user != null;
        }

        public NewApiUserInfoResult GetNewApiUserInfoByAccount(string newusername, out string errorMsg)
        {
            errorMsg = string.Empty;
            NewApiUserInfoResult result = new NewApiUserInfoResult();
            var client = new RestClient($"{_newApiUrl}/api/user/search?keyword={newusername}");
            var request = new RestRequest("", Method.Get);
            request.AddHeader("Authorization", $"Bearer {_newApiAccessToken}");
            request.AddHeader("Accept", "*/*");
            request.AddHeader("Connection", "keep-alive");
            var response = client.Execute(request);
            if (response.IsSuccessful)
            {
                result = JsonConvert.DeserializeObject<NewApiUserInfoResult>(response.Content);
                if (result.success)
                {
                    if (result.data.Count <= 0)
                        errorMsg = "用户不存在";
                }
                else
                {
                    errorMsg = result.message;
                }
            }
            else
            {
                errorMsg = "获取信息失败";
            }

            return result;
        }

        public bool UserBindNewApi(string account, string newapiAcount, out string errorMsg, string password)
        {
            errorMsg = string.Empty;
            //检查NewApi用户是否存在
            var newApiUser = GetNewApiUserInfoByAccount(newapiAcount, out errorMsg);
            var binguser = _context.BindNewApis.Where(x => x.ApiUserName == newapiAcount).FirstOrDefault();
            if (binguser != null)
            {
                errorMsg = "该NewApi用户已绑定,如有错误请联系管理员";
                _systemService.WriteLogUnAsync("尝试绑定已绑定的NewAPI用户", Dtos.LogLevel.Warn, account);
                return false;
            }

            if (newApiUser.data.Count > 0 && !string.IsNullOrEmpty(password))
            {
                errorMsg = "用户名已被使用,换一个试试吧";
                return false;
            }
            if (newApiUser.data.Count <= 0)
            {
                if (string.IsNullOrEmpty(password))
                {
                    errorMsg = "NewApi用户不存在，请先创建新用户";
                    _systemService.WriteLogUnAsync("尝试绑定不存在的NewAPI用户", Dtos.LogLevel.Warn, account);
                    return false;
                }
                //创建新用户
                var client = new RestClient($"{_newApiUrl}/api/user/register");
                var request = new RestRequest("", Method.Post);
                request.AddHeader("Content-Type", "application/json");
                request.AddHeader("Accept", "*/*");
                request.AddHeader("Connection", "keep-alive");
                var body = new
                {
                    username = newapiAcount,
                    password = password,
                    password2 = password
                };
                request.AddParameter("application/json", JsonConvert.SerializeObject(body), ParameterType.RequestBody);
                var response = client.Execute(request);
                if (response.IsSuccessful)
                {
                    newApiUser = JsonConvert.DeserializeObject<NewApiUserInfoResult>(response.Content);
                    if (!newApiUser.success)
                    {
                        errorMsg = newApiUser.message;
                        return false;
                    }
                    else
                    {
                        newApiUser = GetNewApiUserInfoByAccount(newapiAcount, out errorMsg);
                    }
                }
            }

            var bindNewApi = new BindNewApi();
            bindNewApi.Account = account;
            bindNewApi.ApiUserName = newapiAcount;
            bindNewApi.ApiId = newApiUser.data[0].id;
            _context.BindNewApis.Add(bindNewApi);
            return _context.SaveChanges() > 0;
        }

        public string NewApiCheckIn(string account, out string errorMsg)
        {
            errorMsg = string.Empty;
            if (TodayIsCheckedIn(account))
            {
                errorMsg = "今天已经签到过了";
                return "";
            }

            var systemConfig = _systemService.GetSystemCfgs();
            var newApiCheckIn = systemConfig.Find(x => x.CfgKey == "NewApiUrlCheckIn");
            if (string.IsNullOrEmpty(newApiCheckIn?.CfgValue))
            {
                errorMsg = "未配置NewApiUrlCheckIn";
                return "";
            }

            var newapiUserName = _context.BindNewApis.Where(x => x.Account == account).Select(x => x.ApiUserName)
                .FirstOrDefault();
            if (string.IsNullOrEmpty(newapiUserName))
            {
                errorMsg = "用户未绑定NewApi";
                return "";
            }

            var newApiUser = GetNewApiUserInfoByAccount(newapiUserName, out errorMsg);
            if (!newApiUser.success)
            {
                errorMsg = newApiUser.message;
                return "";
            }

            long checkInQuota = (long)(double.Parse(newApiCheckIn?.CfgValue ?? "0") * 500000);
            string cardName = _systemService.ConvertToMD5(Guid.NewGuid().ToString("N"));
            string cardStr =
                CreateNewApiCard(cardName, 1, checkInQuota);
            if (!string.IsNullOrEmpty(cardStr))
            {
                _systemService.WriteLogUnAsync($"用户签到 NewApi：{cardStr}，金额：{newApiCheckIn?.CfgValue}，名称：{cardName}",
                    Dtos.LogLevel.Info,
                    account);
                var newApiCollectLog = new NewApiCollectLog();
                newApiCollectLog.Account = account;
                newApiCollectLog.Limit = checkInQuota;
                newApiCollectLog.CreateTime = DateTime.Now;
                _context.NewApiCollectLogs.Add(newApiCollectLog);
                _context.SaveChanges();
                return cardStr;
            }

            errorMsg = "签到失败";
            return "";
        }

        public bool TodayIsCheckedIn(string account)
        {
            var log = _context.NewApiCollectLogs
                .Where(x => x.Account == account && x.CreateTime.Value.Date == DateTime.Now.Date).FirstOrDefault();
            return log != null;
        }

        public string CreateNewApiCard(string name, int count, long quota)
        {
            var client = new RestClient($"{_newApiUrl}/api/redemption/");
            var request = new RestRequest("", Method.Post);
            request.AddHeader("Content-Type", "application/json");
            var body = new
            {
                name = name,
                count = count,
                quota = quota
            };
            request.AddJsonBody(body);
            request.AddHeader("Authorization", $"Bearer {_newApiAccessToken}");
            var response = client.Execute(request);
            if (response.IsSuccessful)
            {
                var result = JsonConvert.DeserializeObject<NewApiCard>(response.Content);
                if (result.success)
                {
                    return result.data[0];
                }
            }

            return "";
        }
    }
}