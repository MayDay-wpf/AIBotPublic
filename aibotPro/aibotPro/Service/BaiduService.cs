using aibotPro.Interface;
using aibotPro.Models;
using Microsoft.DotNet.Scaffolding.Shared.CodeModifier.CodeChange;
using Newtonsoft.Json;
using RestSharp;

namespace aibotPro.Service
{
    public class BaiduService : IBaiduService
    {
        private readonly IRedisService _redis;
        private readonly ISystemService _systemService;
        public BaiduService(IRedisService redisService, ISystemService systemService)
        {
            _redis = redisService;
            _systemService = systemService;
        }
        public string GetText(string Imgbase64)
        {

            List<SystemCfg> systemConfig = _systemService.GetSystemCfgs();
            string AK = systemConfig.Find(x => x.CfgKey == "Baidu_AK").CfgValue;
            string SK = systemConfig.Find(x => x.CfgKey == "Baidu_SK").CfgValue;
            string AT = GetAccessToken(AK, SK);
            var client = new RestClient($"https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token={AT}");
            var request = new RestRequest("", RestSharp.Method.Post);
            request.AddHeader("Content-Type", "application/x-www-form-urlencoded");
            request.AddHeader("Accept", "application/json");
            request.AddParameter("detect_direction", "false");
            request.AddParameter("paragraph", "false");
            request.AddParameter("probability", "false");
            request.AddParameter("image", Imgbase64);
            RestResponse response = client.Execute(request);
            return response.Content;
        }
        public string GetRes(string Imgbase64)
        {
            List<SystemCfg> systemConfig = _systemService.GetSystemCfgs();
            string AK = systemConfig.Find(x => x.CfgKey == "Baidu_AK").CfgValue;
            string SK = systemConfig.Find(x => x.CfgKey == "Baidu_SK").CfgValue;
            string AT = GetAccessToken(AK, SK);
            var client = new RestClient($"https://aip.baidubce.com/rest/2.0/image-classify/v2/advanced_general?access_token={AT}");
            var request = new RestRequest("", RestSharp.Method.Post);
            request.AddHeader("Content-Type", "application/x-www-form-urlencoded");
            request.AddHeader("Accept", "application/json");
            request.AddParameter("image", Imgbase64);
            RestResponse response = client.Execute(request);
            return response.Content;
        }
        private string GetAccessToken(string AK, string SK)
        {
            var client = new RestClient($"https://aip.baidubce.com/oauth/2.0/token");
            var request = new RestRequest("", RestSharp.Method.Post);
            request.AddParameter("grant_type", "client_credentials");
            request.AddParameter("client_id", AK);
            request.AddParameter("client_secret", SK);
            RestResponse response = client.Execute(request);
            Console.WriteLine(response.Content);
            var result = JsonConvert.DeserializeObject<dynamic>(response.Content);
            return result.access_token.ToString();
        }
    }
}
