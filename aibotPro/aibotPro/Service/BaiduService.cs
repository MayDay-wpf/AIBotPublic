using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using Microsoft.DotNet.Scaffolding.Shared.CodeModifier.CodeChange;
using Newtonsoft.Json;
using OpenAI.ObjectModels.RequestModels;
using OpenAI;
using RestSharp;
using static aibotPro.Dtos.BaiduResDto;
using System.Text;
using Newtonsoft.Json.Linq;
using System.Runtime.CompilerServices;

namespace aibotPro.Service
{
    public class BaiduService : IBaiduService
    {
        private readonly IRedisService _redis;
        private readonly ISystemService _systemService;
        public static string AT = string.Empty;
        public BaiduService(IRedisService redisService, ISystemService systemService)
        {
            _redis = redisService;
            _systemService = systemService;
        }
        public string GetText(string Imgbase64)
        {

            List<SystemCfg> systemConfig = _systemService.GetSystemCfgs();
            string AK = systemConfig.Find(x => x.CfgKey == "Baidu_TXT_AK").CfgValue;
            string SK = systemConfig.Find(x => x.CfgKey == "Baidu_TXT_SK").CfgValue;
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
            string AK = systemConfig.Find(x => x.CfgKey == "Baidu_OBJ_AK").CfgValue;
            string SK = systemConfig.Find(x => x.CfgKey == "Baidu_OBJ_SK").CfgValue;
            string AT = GetAccessToken(AK, SK);
            var client = new RestClient($"https://aip.baidubce.com/rest/2.0/image-classify/v2/advanced_general?access_token={AT}");
            var request = new RestRequest("", RestSharp.Method.Post);
            request.AddHeader("Content-Type", "application/x-www-form-urlencoded");
            request.AddHeader("Accept", "application/json");
            request.AddParameter("image", Imgbase64);
            RestResponse response = client.Execute(request);
            return response.Content;
        }

        public async IAsyncEnumerable<BaiduResDto.StreamResult> CallBaiduAI_Stream(
      ChatCompletionCreateRequest chatCompletionCreate,
      OpenAiOptions openAiOptions,
      string chatgroupId,
      [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var arrApiKey = openAiOptions.ApiKey.Split("|");
            string baseUrl = openAiOptions.BaseDomain;
            var accessToken = GetAccessToken(arrApiKey[0], arrApiKey[1]);
            var url = $"{baseUrl}?access_token={accessToken}";

            // 对齐参数
            var baiduMsg = AlignTheBody(chatCompletionCreate);

            // 创建 HTTP 客户端
            using (var httpClient = new HttpClient())
            {
                // 创建请求内容
                var requestBody = JsonConvert.SerializeObject(baiduMsg);
                var requestContent = new StringContent(requestBody, Encoding.UTF8, "application/json");
                var request = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = requestContent
                };

                // 发送请求时，也传递取消令牌以便在请求级别处理取消
                using (var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken))
                {
                    cancellationToken.ThrowIfCancellationRequested(); // 检查取消令牌，早期中断

                    using (var responseStream = await response.Content.ReadAsStreamAsync(cancellationToken))
                    {
                        cancellationToken.ThrowIfCancellationRequested(); // 检查取消令牌，中断读取响应流

                        using (var reader = new StreamReader(responseStream, Encoding.UTF8))
                        {
                            string line;
                            while ((line = await reader.ReadLineAsync()) != null)
                            {
                                cancellationToken.ThrowIfCancellationRequested(); // 检查取消令牌，中断读取
                                if (line.StartsWith("data:"))
                                {
                                    var streamResult = JsonConvert.DeserializeObject<BaiduResDto.StreamResult>(line.Replace("data:", ""));
                                    yield return streamResult;
                                }
                            }
                        }
                    }
                }
            }
        }

        public async Task<BaiduResDto.StreamResult> CallBaiduAI(ChatCompletionCreateRequest chatCompletionCreate, OpenAiOptions openAiOptions)
        {
            BaiduResDto.StreamResult result = new StreamResult();
            var arrApiKey = openAiOptions.ApiKey.Split("|");
            string BaseUrl = openAiOptions.BaseDomain;
            string AT = GetAccessToken(arrApiKey[0], arrApiKey[1]);
            var url = $"{BaseUrl}?access_token={AT}";

            //对齐参数
            MessageDto baidumsg = AlignTheBody(chatCompletionCreate);

            using (var httpClient = new HttpClient())
            {
                // 创建请求内容
                var requestBody = JsonConvert.SerializeObject(baidumsg);
                var requestContent = new StringContent(requestBody, Encoding.UTF8, "application/json");
                var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Content = requestContent;

                using (var response = await httpClient.SendAsync(request))
                {
                    if (response.IsSuccessStatusCode)
                    {
                        var responseContent = await response.Content.ReadAsStringAsync();
                        result = JsonConvert.DeserializeObject<BaiduResDto.StreamResult>(responseContent);
                    }
                    else
                    {
                        // 处理错误响应
                        throw new Exception($"请求失败，状态码：{response.StatusCode}");
                    }
                }
            }

            return result;
        }
        public async IAsyncEnumerable<StreamResult> SendMsgAgain(MessageDto messageDto, string BaseUrl, string chatgroupId)
        {
            var url = $"{BaseUrl}?access_token={AT}";
            // 创建HTTP客户端
            using (var httpClient = new HttpClient())
            {
                // 创建请求内容
                var requestBody = JsonConvert.SerializeObject(messageDto);
                var requestContent = new StringContent(requestBody, Encoding.UTF8, "application/json");
                var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Content = requestContent;
                using (var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead))
                {
                    using (var responseStream = await response.Content.ReadAsStreamAsync())
                    {
                        using (var reader = new StreamReader(responseStream, Encoding.UTF8))
                        {
                            string line;
                            while ((line = await reader.ReadLineAsync()) != null)
                            {
                                if (!string.IsNullOrEmpty(chatgroupId))
                                {
                                    string thisTask = await _redis.GetAsync($"{chatgroupId}_process");
                                    if (string.IsNullOrEmpty(thisTask) || !bool.Parse(thisTask))
                                    {
                                        yield break;
                                    }
                                }
                                if (line.StartsWith("data:"))
                                {
                                    StreamResult streamResult = JsonConvert.DeserializeObject<StreamResult>(line.Replace("data:", ""));
                                    yield return streamResult;
                                }
                            }
                        }
                    }
                }
            }
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
        public MessageDto AlignTheBody(ChatCompletionCreateRequest chatCompletionCreate)
        {
            MessageDto messageDto = new MessageDto();
            //组装List<Message>
            List<BaiduResDto.Message> Messages = new List<BaiduResDto.Message>();
            foreach (var item in chatCompletionCreate.Messages)
            {
                BaiduResDto.Message message = new BaiduResDto.Message();
                if (item.Role == "system")
                    messageDto.System = item.Content;
                else
                {
                    message.Role = item.Role;
                    message.Content = item.Content;
                    Messages.Add(message);
                }
            }
            messageDto.Messages = Messages;
            messageDto.Top_P = chatCompletionCreate.TopP;
            messageDto.Temperature = chatCompletionCreate.Temperature;
            messageDto.Penalty_Score = chatCompletionCreate.PresencePenalty;
            messageDto.Stream = chatCompletionCreate.Stream.Value;
            if (chatCompletionCreate.Tools != null)
            {
                List<Function> functions = new List<Function>();
                foreach (var item in chatCompletionCreate.Tools)
                {
                    Function function = new Function();
                    var openaiFunction = item.Function;
                    function.Name = openaiFunction.Name;
                    function.Description = openaiFunction.Description;
                    BaiduResDto.Parameter parameters = new BaiduResDto.Parameter();
                    parameters.Type = openaiFunction.Parameters.Type;
                    Dictionary<string, Property> keyValuePairs = new Dictionary<string, Property>();
                    parameters.Required = openaiFunction.Parameters.Required.ToList();
                    foreach (var pr in openaiFunction.Parameters.Properties)
                    {
                        Property property = new Property()
                        {
                            Type = pr.Value.Type,
                            Description = pr.Value.Description,
                        };

                        keyValuePairs.Add(pr.Key, property);
                    }
                    parameters.Properties = keyValuePairs;
                    function.Parameters = parameters;
                    functions.Add(function);
                }
                if (functions.Count > 0)
                    messageDto.Functions = functions;
                if (chatCompletionCreate.ToolChoice != null)
                {
                    BaiduResDto.ToolChoice toolChoice = new BaiduResDto.ToolChoice();
                    var choice = functions.Where(f => f.Name == chatCompletionCreate.ToolChoice.Function.Name).FirstOrDefault();
                    if (choice != null)
                    {
                        toolChoice.Function = choice;
                    }
                    messageDto.ToolChoice = toolChoice;
                }
            }
            return messageDto;
        }
    }
}
