using aibotPro.AppCode;
using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using RestSharp;
using StackExchange.Redis;
using System;
using System.Net;
using System.Security.Policy;
using System.Security.Principal;
using System.Text;
using TiktokenSharp;
using SixLabors.ImageSharp; // 添加ImageSharp的引用
using SixLabors.ImageSharp.Formats.Png; // 对PNG文件格式的引用
using SixLabors.ImageSharp.Processing; // 如果需要进行图像处理
using SixLabors.ImageSharp.Advanced; // 高级操作
using SixLabors.ImageSharp.PixelFormats;
using OpenAI;
using OpenAI.ObjectModels.RequestModels;
using OpenAI.Managers;
using System.Runtime.CompilerServices;
using Microsoft.AspNetCore.SignalR; // 像素格式

namespace aibotPro.Service
{
    public class AiServer : IAiServer
    {
        private readonly ISystemService _systemService;
        private readonly AIBotProContext _context;
        private readonly IRedisService _redis;
        private readonly IHubContext<ChatHub> _hubContext;
        private readonly IMilvusService _milvusService;
        private readonly ChatCancellationManager _chatCancellationManager;

        public AiServer(ISystemService systemService, AIBotProContext context, IRedisService redis, IHubContext<ChatHub> hubContext, IMilvusService milvusService, ChatCancellationManager chatCancellationManager)
        {
            _systemService = systemService;
            _context = context;
            _redis = redis;
            _hubContext = hubContext;
            _milvusService = milvusService;
            _chatCancellationManager = chatCancellationManager;
        }
        //实现接口
        public async IAsyncEnumerable<AiRes> CallingAI(
            AiChat aiChat,
            APISetting apiSetting,
            string chatId,
             VisionBody visionBody = null,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            string baseUrl = apiSetting.BaseUrl;
            if (baseUrl.EndsWith("/"))
            {
                baseUrl = baseUrl.TrimEnd('/');
            }

            var url = baseUrl + "/v1/chat/completions";
            using (var httpClient = new HttpClient())
            {
                var requestBody = visionBody == null ? JsonConvert.SerializeObject(aiChat) : JsonConvert.SerializeObject(visionBody);
                var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Headers.Add("Authorization", $"Bearer {apiSetting.ApiKey}");
                var requestContent = new StringContent(requestBody, Encoding.UTF8, "application/json");
                request.Content = requestContent;

                // 发送请求时，也传递取消令牌以便在请求级别处理取消
                using (var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken))
                {
                    cancellationToken.ThrowIfCancellationRequested(); // 测试取消令牌，早期中断

                    using (var responseStream = await response.Content.ReadAsStreamAsync(cancellationToken))
                    {
                        cancellationToken.ThrowIfCancellationRequested(); // 测试取消令牌，中断读取响应流

                        using (var reader = new StreamReader(responseStream, Encoding.UTF8))
                        {
                            while (!reader.EndOfStream)
                            {
                                cancellationToken.ThrowIfCancellationRequested(); // 检查取消令牌，中断读取

                                var line = await reader.ReadLineAsync();
                                if (line.StartsWith("data:"))
                                {
                                    var jsonDataStartIndex = line.IndexOf("data:") + "data:".Length;
                                    var jsonData = line.Substring(jsonDataStartIndex).Trim();
                                    var resultIndex = jsonData.IndexOf("\"content\":");
                                    if (resultIndex >= 0)
                                    {
                                        AiRes res = new AiRes();
                                        try
                                        {
                                            res = JsonConvert.DeserializeObject<AiRes>(jsonData);
                                        }
                                        catch (Exception e)
                                        {
                                            await _systemService.WriteLog(e.Message, Dtos.LogLevel.Error, "system");
                                            throw;
                                        }
                                        if (res != null && res.Choices != null && res.Choices[0].Delta != null)
                                        {
                                            var decodedResult = res.Choices[0].Delta.Content;
                                            if (!string.IsNullOrEmpty(decodedResult))
                                            {
                                                yield return res;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }



        public async Task<string> CallingAINotStream(string prompt, string model, bool jsonModel = false)
        {
            var aImodels = _systemService.GetAImodel();
            string apiKey = aImodels.Where(x => x.ModelName == model).FirstOrDefault().ApiKey;
            //标准化baseurl
            string baseUrl = aImodels.Where(x => x.ModelName == model).FirstOrDefault().BaseUrl;
            try
            {
                if (baseUrl.EndsWith("/"))
                {
                    baseUrl = baseUrl.TrimEnd('/');
                }
            }
            catch (Exception e)
            {
                throw e;
            }
            var client = new RestClient($"{baseUrl}/v1/chat/completions");
            var request = new RestRequest("", Method.Post);
            request.AddHeader("Accept", "application/json");
            request.AddHeader("Authorization", $"Bearer {apiKey}");
            request.AddHeader("Content-Type", "application/json");
            request.AddHeader("Connection", "keep-alive");
            object requestBody = new
            {
                model = model,
                messages = new[]
                 {
                    new { role = "user", content = prompt }
                },
                stream = false
            };
            if (jsonModel)
            {
                requestBody = new
                {
                    model = model,
                    response_format = new
                    {
                        type = "json_object"
                    },
                    messages = new[]
                {
                    new { role = "user", content = prompt }
                },
                    stream = false
                };
            }
            var body = JsonConvert.SerializeObject(requestBody, Formatting.Indented);
            request.AddParameter("application/json", body, ParameterType.RequestBody);
            RestResponse response = client.Execute(request);
            if (response.IsSuccessful)
            {
                JObject jsonResponse = JObject.Parse(response.Content);
                JToken messageContent = jsonResponse["choices"]?[0]?["message"]?["content"];

                if (messageContent != null)
                {
                    return messageContent.ToString();
                }
                else
                {
                    return "";
                }
            }
            else
                return "";
        }
        public async Task<bool> SaveChatHistory(string account, string chatId, string content, string chatCode, string chatGroupId, string role, string model, string firstTime = "", string allTime = "")
        {
            ChatHistory chatHistory = new ChatHistory();
            chatHistory.Account = account;
            chatHistory.Chat = _systemService.EncodeBase64(content);
            chatHistory.Role = role;
            chatHistory.ChatId = chatId;
            chatHistory.ChatCode = chatCode;
            chatHistory.ChatGroupId = chatGroupId;
            chatHistory.Model = model;
            chatHistory.IsDel = 0;
            chatHistory.FirstTime = firstTime;
            chatHistory.AllTime = allTime;
            chatHistory.CreateTime = DateTime.Now;
            _context.ChatHistories.Add(chatHistory);
            await _context.SaveChangesAsync();
            var chatHistories = _context.ChatHistories
                                         .AsNoTracking()
                                         .Where(x => x.ChatId == chatId && x.IsDel == 0).ToList();
            //刷新缓存
            await _redis.SetAsync(chatId, JsonConvert.SerializeObject(chatHistories), TimeSpan.FromHours(1));
            return true;
        }
        public List<ChatHistory> GetChatHistories(string account, string chatId, int historyCount)
        {
            //先用chatId查询缓存
            List<ChatHistory> chatHistories = new List<ChatHistory>();
            var chatHistoryStr = _redis.GetAsync(chatId).Result;
            if (!string.IsNullOrEmpty(chatHistoryStr))
                chatHistories = JsonConvert.DeserializeObject<List<ChatHistory>>(chatHistoryStr);
            else
            {
                //从数据库加载
                chatHistories = _context.ChatHistories
                                         .AsNoTracking()
                                         .Where(x => x.ChatId == chatId && x.IsDel == 0).ToList();
                //写入缓存
                _redis.SetAsync(chatId, JsonConvert.SerializeObject(chatHistories), TimeSpan.FromHours(1));
            }
            chatHistories = chatHistories.OrderBy(x => x.CreateTime).ToList();
            //使用historyCount截取chatHistories,因为chatHistories是双行的所以要乘以2
            if (historyCount >= 0 && chatHistories.Count > historyCount * 2)
                chatHistories = chatHistories.Skip(chatHistories.Count - historyCount * 2).Take(historyCount * 2).ToList();
            chatHistories.ForEach(x =>
            {
                x.Chat = _systemService.DecodeBase64(x.Chat);
            });
            return chatHistories;
        }
        public async Task<List<ChatHistory>> GetChatHistoriesList(string account, int pageIndex, int pageSize, string searchKey)
        {
            // 创建一个子查询，选出每个ChatId对应的最小CreateTime值，以此找到Role为"user"的记录
            var subQuery = _context.ChatHistories
                .AsNoTracking()
                .Where(ch => ch.Account == account && ch.IsDel == 0 && ch.Role == "user")
                .OrderByDescending(ch => ch.CreateTime)
                .GroupBy(ch => ch.ChatId)
                .Select(g => new { ChatId = g.Key, MinCreateTime = g.Min(ch => ch.CreateTime) });

            // 将子查询的结果与原表连接，以获取每个ChatId对应的第一条Role为"user"的记录
            var chatHistories = await _context.ChatHistories
                .AsNoTracking()
                .Join(subQuery, ch => new { ch.ChatId, ch.CreateTime }, sub => new { sub.ChatId, CreateTime = sub.MinCreateTime },
                    (ch, sub) => ch)
                .OrderByDescending(ch => ch.CreateTime)
                .Skip((pageIndex - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
            chatHistories.ForEach(x =>
            {
                x.Chat = _systemService.DecodeBase64(x.Chat);
            });
            if (!string.IsNullOrEmpty(searchKey))
                chatHistories = chatHistories.Where(x => x.Chat.Contains(searchKey)).ToList();
            return chatHistories;
        }
        public bool DelChatHistory(string account, string chatId)
        {
            List<ChatHistory> chatHistories = new List<ChatHistory>();
            //删除聊天记录
            if (!string.IsNullOrEmpty(chatId))
            {
                //没有指定chatId则删除所有
                chatHistories = _context.ChatHistories.Where(x => x.Account == account && x.ChatId == chatId).ToList();
                chatHistories.ForEach(x =>
                {
                    x.IsDel = 1;
                });
            }
            else
            {
                chatHistories = _context.ChatHistories.Where(x => x.Account == account).ToList();
                chatHistories.ForEach(x =>
                {
                    x.IsDel = 1;
                });
            }
            chatHistories.ForEach(x =>
            {
                x.IsDel = 1;
            });
            //清除缓存
            if (!string.IsNullOrEmpty(chatId))
                _redis.DeleteAsync(chatId);
            return _context.SaveChanges() > 0;
        }
        public List<ChatHistory> ShowHistoryDetail(string account, string chatId)
        {
            List<ChatHistory> chatHistories = new List<ChatHistory>();
            //从数据库加载
            chatHistories = _context.ChatHistories
                                     .Where(x => x.ChatId == chatId && x.IsDel == 0 && x.Account == account)
                                     .OrderBy(y => y.CreateTime).ToList();
            //写入缓存
            _redis.SetAsync(chatId, JsonConvert.SerializeObject(chatHistories), TimeSpan.FromHours(1));

            chatHistories.ForEach(x =>
            {
                x.Chat = _systemService.DecodeBase64(x.Chat);
            });
            return chatHistories;
        }
        public bool DelChatGroup(string account, string groupId)
        {
            var chatHistories = _context.ChatHistories.Where(x => x.Account == account && x.ChatGroupId == groupId).ToList();
            chatHistories.ForEach(x =>
            {
                x.IsDel = 1;
            });
            //清除缓存
            if (chatHistories != null && chatHistories.Count > 0)
                _redis.DeleteAsync(chatHistories[0].ChatId);
            return _context.SaveChanges() > 0;
        }
        public async Task<string> CreateMJdraw(string prompt, string botType, string[] referenceImgPath, string baseUrl, string apiKey, string drawmodel)
        {
            try
            {
                if (baseUrl.EndsWith("/"))
                {
                    baseUrl = baseUrl.TrimEnd('/');
                }
            }
            catch (Exception e)
            {
                throw e;
            }
            baseUrl += $"/mj-{drawmodel}/mj/submit/imagine";
            var client = new RestClient(baseUrl);
            var request = new RestRequest("", Method.Post);
            request.AddHeader("mj-api-secret", apiKey);
            request.AddHeader("Content-Type", "application/json");
            MJdrawBody mJdrawBody = new MJdrawBody();
            mJdrawBody.prompt = prompt;
            mJdrawBody.botType = botType;
            mJdrawBody.base64Array = referenceImgPath;
            var body = JsonConvert.SerializeObject(mJdrawBody);
            request.AddParameter("application/json", body, ParameterType.RequestBody);
            var response = await client.ExecuteAsync(request);
            if (response.IsSuccessful)
            {
                dynamic res = JsonConvert.DeserializeObject<dynamic>(response.Content);
                string taskId = res.result.ToString();
                return taskId;
            }
            else
            {
                await _systemService.WriteLog(response.Content, Dtos.LogLevel.Error, "system");
                return "";
            }
        }
        public async Task<string> CreateDALLdraw(string prompt, string imgSize, string quality, string baseUrl, string apiKey)
        {
            try
            {
                if (baseUrl.EndsWith("/"))
                {
                    baseUrl = baseUrl.TrimEnd('/');
                }
            }
            catch (Exception e)
            {
                throw e;
            }
            var client = new RestClient(baseUrl + "/v1/images/generations");
            var request = new RestRequest("", Method.Post);
            request.AddHeader("Content-Type", "application/json");
            request.AddHeader("Authorization", $"Bearer {apiKey}");
            prompt = prompt.Replace("\r", "\\n").Replace("\n", "\\n");
            DALLdrawBody dALLdrawBody = new DALLdrawBody();
            dALLdrawBody.model = "dall-e-3";
            dALLdrawBody.prompt = prompt;
            dALLdrawBody.size = imgSize;
            dALLdrawBody.quality = quality;
            dALLdrawBody.n = 1;
            var body = JsonConvert.SerializeObject(dALLdrawBody);
            request.AddParameter("application/json", body, ParameterType.RequestBody);
            var response = await client.ExecuteAsync(request);
            if (response.IsSuccessful)
            {
                IMGResponseData imgdata = JsonConvert.DeserializeObject<IMGResponseData>(response.Content);
                if (imgdata.data.Count > 0)
                {
                    return imgdata.data[0].url.ToString();
                }
                else
                    return "";
            }
            else
                return "";

        }

        public async Task<string> CreateDALLE2draw(string prompt, string imgSize, string baseUrl, string apiKey, int n = 1)
        {
            try
            {
                if (baseUrl.EndsWith("/"))
                {
                    baseUrl = baseUrl.TrimEnd('/');
                }
            }
            catch (Exception e)
            {
                throw e;
            }
            var client = new RestClient(baseUrl + "/v1/images/generations");
            var request = new RestRequest("", Method.Post);
            request.AddHeader("Content-Type", "application/json");
            request.AddHeader("Authorization", $"Bearer {apiKey}");
            prompt = prompt.Replace("\r", "\\n").Replace("\n", "\\n");
            DALLE2drawBody dALLe2drawBody = new DALLE2drawBody();
            dALLe2drawBody.model = "dall-e-2";
            dALLe2drawBody.prompt = prompt;
            dALLe2drawBody.size = imgSize;
            dALLe2drawBody.n = n;
            var body = JsonConvert.SerializeObject(dALLe2drawBody);
            request.AddParameter("application/json", body, ParameterType.RequestBody);
            var response = await client.ExecuteAsync(request);
            if (response.IsSuccessful)
            {
                IMGResponseDataE2 imgdata = JsonConvert.DeserializeObject<IMGResponseDataE2>(response.Content);
                if (imgdata.data.Count > 0)
                {
                    return imgdata.data[0].url.ToString();
                }
                else
                    return "";
            }
            else
                return "";

        }

        public async Task<SDResponse> CreateSDdraw(string prompt, string model, string imageSize, int numberImages, int seed, int inferenceSteps, float guidanceScale, string negativePrompt, string apiKey, string baseUrl, string Channel)
        {
            try
            {
                if (baseUrl.EndsWith("/"))
                {
                    baseUrl = baseUrl.TrimEnd('/');
                }
            }
            catch (Exception e)
            {
                throw e;
            }
            SDResponse sDResponse = new SDResponse();
            if (Channel == "SiliconCloud")
            {
                var client = new RestClient(baseUrl + $"/v1/stabilityai/{model}/text-to-image");
                var request = new RestRequest("", Method.Post);
                request.AddHeader("Content-Type", "application/json");
                request.AddHeader("Authorization", $"Bearer {apiKey}");
                prompt = prompt.Replace("\r", "\\n").Replace("\n", "\\n");
                SDdrawBody sDdrawBody = new SDdrawBody();
                sDdrawBody.prompt = prompt;
                sDdrawBody.batch_size = numberImages;
                sDdrawBody.guidance_scale = guidanceScale;
                sDdrawBody.seed = seed;
                sDdrawBody.num_inference_steps = inferenceSteps;
                sDdrawBody.image_size = imageSize;
                var body = JsonConvert.SerializeObject(sDdrawBody);
                request.AddParameter("application/json", body, ParameterType.RequestBody);
                var response = await client.ExecuteAsync(request);
                if (response.IsSuccessful)
                {
                    sDResponse = JsonConvert.DeserializeObject<SDResponse>(response.Content);
                }
            }
            return sDResponse;
        }

        public async Task<TaskResponse> GetMJTaskResponse(string taskId, string baseUrl, string apiKey)
        {
            try
            {
                if (baseUrl.EndsWith("/"))
                {
                    baseUrl = baseUrl.TrimEnd('/');
                }
            }
            catch (Exception e)
            {
                throw e;
            }
            var client = new RestClient($"{baseUrl}/mj/task/{taskId}/fetch");
            var request = new RestRequest("", Method.Get);
            request.AddHeader("Authorization", apiKey);
            var response = await client.ExecuteAsync(request);
            if (response.IsSuccessful)
            {
                TaskResponse res = JsonConvert.DeserializeObject<TaskResponse>(response.Content);
                return res;
            }
            else
            {
                return null;
            }
        }

        public async Task DownloadImageAsync(string imageUrl, string savePath, string fileNameWithoutExtension)
        {
            // 如果文件夹不存在则创建
            if (!Directory.Exists(savePath))
            {
                Directory.CreateDirectory(savePath);
            }

            string fullPath = Path.Combine(savePath, $"{fileNameWithoutExtension}.png");

            try
            {
                using (HttpClient client = new HttpClient())
                {
                    using (HttpResponseMessage response = await client.GetAsync(imageUrl))
                    {
                        if (response.IsSuccessStatusCode)
                        {
                            using (var streamToReadFrom = await response.Content.ReadAsStreamAsync())
                            {
                                // 使用ImageSharp库加载图像
                                using (var image = SixLabors.ImageSharp.Image.Load(streamToReadFrom))
                                {
                                    // 转换并保存为PNG格式
                                    image.SaveAsPng(fullPath);
                                }
                            }
                        }
                        else
                        {
                            await _systemService.WriteLog($"Error while downloading image: {response.StatusCode}", Dtos.LogLevel.Error, "system");
                            throw new Exception($"Error while downloading image: {response.StatusCode}");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                await _systemService.WriteLog($"Error while downloading or saving the image: {ex.Message}", Dtos.LogLevel.Error, "system");
                // 这里可以添加一些异常处理的代码，如记录日志等
                throw;
            }
        }

        public async Task<bool> SaveAiDrawResult(string account, string model, string savePath, string prompt, string referenceImgPath, string thumbSavePath, string thumbKey)
        {
            try
            {
                //保存到数据库
                _context.AIdrawRes.Add(new AIdrawRe
                {
                    Account = account,
                    AImodel = model,
                    Prompt = prompt,
                    ReferenceImgPath = referenceImgPath,
                    ThumbSavePath = thumbSavePath,
                    ThumbKey = thumbKey,
                    ImgSavePath = savePath,
                    CreateTime = DateTime.Now,
                    IsDel = 0
                });
                return _context.SaveChanges() > 0;
            }
            catch (Exception e)
            {
                await _systemService.WriteLog(e.Message, Dtos.LogLevel.Error, "system");
                return false;
            }

        }

        public async Task<string> CreateMJchange(string changeType, int changeIndex, string taskId, string baseUrl, string apiKey, string drawmodel)
        {
            try
            {
                if (baseUrl.EndsWith("/"))
                {
                    baseUrl = baseUrl.TrimEnd('/');
                }
            }
            catch (Exception e)
            {
                throw e;
            }
            baseUrl += $"/mj-{drawmodel}/mj/submit/change";
            var client = new RestClient(baseUrl);
            var request = new RestRequest("", Method.Post);
            request.AddHeader("mj-api-secret", apiKey);
            request.AddHeader("Content-Type", "application/json");
            MJchangeBody mJchangeBody = new MJchangeBody();
            mJchangeBody.action = changeType;
            mJchangeBody.index = changeIndex;
            mJchangeBody.taskId = taskId;
            var body = JsonConvert.SerializeObject(mJchangeBody);
            request.AddParameter("application/json", body, ParameterType.RequestBody);
            var response = await client.ExecuteAsync(request);
            if (response.IsSuccessful)
            {
                dynamic res = JsonConvert.DeserializeObject<dynamic>(response.Content);
                string change_taskId = res.result.ToString();
                return change_taskId;
            }
            else
            {
                return "";
            }
        }
        public async Task<List<SearchResult>> GetWebSearchResult(string query, string googleSearchApiKey, string googleSearchEngineId)
        {
            var result = new GoogleSearch(googleSearchApiKey, googleSearchEngineId).Search(query);
            if (result.Count > 0)
            {
                return result;
            }
            else
            {
                return null;
            }
        }
        public string AiGet(string url, Dictionary<string, object> dic, Dictionary<string, string> headers = null, Dictionary<string, string> cookies = null)
        {
            string result = "";
            StringBuilder builder = new StringBuilder();
            builder.Append(url);
            if (dic.Count > 0)
            {
                builder.Append("?");
                int i = 0;
                foreach (var item in dic)
                {
                    if (i > 0)
                        builder.Append("&");
                    builder.AppendFormat("{0}={1}", item.Key, item.Value);
                    i++;
                }
            }
            //如果headers有值，则加入到request头部
            HttpWebRequest req = (HttpWebRequest)WebRequest.Create(builder.ToString());
            if (headers != null)
            {
                foreach (KeyValuePair<string, string> item in headers)
                {
                    req.Headers.Add(item.Key, item.Value);
                }
            }

            //如果cookies有值，则加入到request的Cookie容器
            if (cookies != null)
            {
                CookieContainer cookieContainer = new CookieContainer();
                foreach (KeyValuePair<string, string> item in cookies)
                {
                    cookieContainer.Add(new Cookie(item.Key, item.Value, "/", req.RequestUri.Host));
                }
                req.CookieContainer = cookieContainer;
            }
            //添加参数
            HttpWebResponse resp = (HttpWebResponse)req.GetResponse();
            Stream stream = resp.GetResponseStream();
            try
            {
                //获取内容
                using (StreamReader reader = new StreamReader(stream))
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
        public string AiPost(string url, Dictionary<string, object> parameters, Dictionary<string, string> headers = null, Dictionary<string, string> cookies = null, string jsonBody = "")
        {
            var client = new RestClient(url);
            var request = new RestRequest("", Method.Post);
            if (cookies != null)
            {
                foreach (KeyValuePair<string, string> item in cookies)
                {
                    request.AddHeader("Cookie", $"{item.Key}={item.Value}");
                }
            }
            if (headers != null)
            {
                foreach (KeyValuePair<string, string> item in headers)
                {
                    request.AddHeader(item.Key, item.Value);
                }
            }
            request.AddHeader("Content-Type", "application/json");
            request.AddHeader("Accept", "*/*");
            request.AddHeader("Connection", "keep-alive");
            if (!string.IsNullOrEmpty(jsonBody))
            {
                request.AddParameter("application/json", jsonBody, ParameterType.RequestBody);
            }
            else
            {
                var body = System.Text.Json.JsonSerializer.Serialize(parameters);
                request.AddParameter("application/json", body, ParameterType.RequestBody);
            }
            RestResponse response = client.Execute(request);

            if (response.IsSuccessStatusCode)
            {
                string responseContent = response.Content;
                return responseContent;
            }
            else
            {
                return "请求失败：" + response.StatusCode;
            }
        }
        public async Task<List<AIdrawRe>> GetAIdrawResList(string account, int page, int pageSize)
        {
            // 利用IQueryable延迟执行，直到真正需要数据的时候才去数据库查询
            IQueryable<AIdrawRe> query = _context.AIdrawRes.Where(p => p.Account == account);
            // 然后添加分页逻辑，此处同样是构建查询，没有执行
            var aidrawRes = query.OrderByDescending(x => x.CreateTime) // 这里可以根据需要替换为合适的排序字段
                                .Skip((page - 1) * pageSize)
                                .Take(pageSize)
                                .ToList(); // 直到调用ToList，查询才真正执行

            return aidrawRes;
        }

        public async Task<string> GPTJsonModel(string systemprompt, string prompt, string model, string account)
        {
            //查询AIModel
            var aiModel = _systemService.GetAImodel();
            var modelCfg = aiModel.FirstOrDefault(x => x.ModelName == model);
            if (modelCfg == null)
                return "未找到AIModel";
            string baseUrl = modelCfg.BaseUrl;
            try
            {
                if (baseUrl.EndsWith("/"))
                {
                    baseUrl = baseUrl.TrimEnd('/');
                }
            }
            catch (Exception e)
            {
                throw e;
            }

            var url = baseUrl + "/v1/chat/completions";
            var client = new RestClient(url);
            var request = new RestRequest("", Method.Post);
            request.AddHeader("Authorization", $"Bearer {modelCfg.ApiKey}");
            request.AddHeader("Content-Type", "application/json");
            request.AddHeader("Accept", "*/*");
            request.AddHeader("Connection", "keep-alive");
            var body = @"{
                            " + "\n" +
                                        $@"  ""model"": ""{model}"",
                            " + "\n" +
                                        @"  ""response_format"": {
                            " + "\n" +
                                        @"    ""type"": ""json_object""
                            " + "\n" +
                                        @"  },
                            " + "\n" +
                                        @"  ""messages"": [
                            " + "\n" +
                                        @"    {
                            " + "\n" +
                                        @"      ""role"": ""system"",
                            " + "\n" +
                                        $@"      ""content"": ""{systemprompt}""
                            " + "\n" +
                                        @"    },
                            " + "\n" +
                                        @"    {
                            " + "\n" +
                                        @"      ""role"": ""user"",
                            " + "\n" +
                                        $@"      ""content"": ""{prompt}""
                            " + "\n" +
                                        @"    }
                            " + "\n" +
                                        @"  ],
                            " + "\n" +
                                        @"  ""stream"": false
                            " + "\n" +
                                        @"}";
            request.AddParameter("application/json", body, ParameterType.RequestBody);
            RestResponse response = client.Execute(request);
            if (response.IsSuccessful)
            {
                JObject jsonObj = JsonConvert.DeserializeObject<JObject>(response.Content);
                string content = jsonObj["choices"][0]["message"]["content"].ToString();
                if (!string.IsNullOrEmpty(content) && model == "gpt-4-turbo-preview")
                {
                    TikToken tikToken = TikToken.GetEncoding("cl100k_base");
                    await CreateUseLogAndUpadteMoney(account, model, tikToken.Encode(systemprompt + prompt).Count, tikToken.Encode(content).Count);
                }
                return content;
            }
            else
                return "";

        }
        private async Task<bool> IsVip(string account)
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
        private async Task<List<ModelPrice>> GetModelPriceList()
        {
            //尝试从缓存中获取模型定价列表
            List<ModelPrice> modelPriceList = null;
            var modelPriceList_str = await _redis.GetAsync("ModelPriceList");
            if (modelPriceList == null)
            {
                //如果缓存中没有模型定价列表，则从数据库中获取
                modelPriceList = await _context.ModelPrices.AsNoTracking().ToListAsync();
                //将模型定价列表存入缓存
                await _redis.SetAsync("ModelPriceList", JsonConvert.SerializeObject(modelPriceList));
            }
            else
            {
                modelPriceList = JsonConvert.DeserializeObject<List<ModelPrice>>(modelPriceList_str);
            }
            return modelPriceList;
        }
        public async Task<string> TTS(string text, string model, string voice)
        {
            //查询AIModel
            var aiModel = _systemService.GetAImodel();
            var modelCfg = aiModel.FirstOrDefault();
            if (modelCfg == null)
                return "未找到AIModel";
            string baseUrl = modelCfg.BaseUrl;
            try
            {
                if (baseUrl.EndsWith("/"))
                {
                    baseUrl = baseUrl.TrimEnd('/');
                }
            }
            catch (Exception e)
            {
                throw e;
            }
            var url = baseUrl + "/v1/audio/speech";
            var client = new RestClient(url);
            var request = new RestRequest("", Method.Post);
            request.AddHeader("Content-Type", "application/json");
            request.AddHeader("Authorization", $"Bearer {modelCfg.ApiKey}");
            request.AddHeader("Accept", "*/*");
            request.AddHeader("Connection", "keep-alive");
            text = text.Replace("\r", "\\n").Replace("\n", "\\n");
            var body = @"{" + "\n" +
            @$"  ""model"": ""{model}""," + "\n" +
            @$"  ""input"": ""{text}""," + "\n" +
            @$"  ""voice"": ""{voice}""" + "\n" +
            @"}";
            request.AddParameter("application/json", body, ParameterType.RequestBody);
            RestResponse response = await client.ExecuteAsync(request);
            if (response.StatusCode == HttpStatusCode.OK)
            {
                //保存返回的音频文件
                string savePath = Path.Combine("wwwroot", $"files/audio/{DateTime.Now.ToString("yyyyMMdd")}");
                if (!Directory.Exists(savePath))
                {
                    Directory.CreateDirectory(savePath);
                }
                string fileName = Guid.NewGuid().ToString() + ".mp3";
                savePath = Path.Combine(savePath, fileName);
                using (FileStream fs = new FileStream(savePath, FileMode.Create))
                {
                    fs.Write(response.RawBytes, 0, response.RawBytes.Length);
                }
                return savePath;
            }
            else
            {
                await _systemService.WriteLog(response.Content, Dtos.LogLevel.Error, "system");
                return "";
            }
        }

        public async Task ExecuteFunctionWithLoadingIndicators(string fnName, string chatId, string senMethod, CancellationToken cancellationToken)
        {
            var chatRes = new ChatRes();

            async Task StartLoadingIndicator(List<string> emojiList)
            {
                var random = new Random();
                try
                {
                    while (!cancellationToken.IsCancellationRequested)
                    {
                        var randomEmoji = emojiList[random.Next(emojiList.Count)];
                        chatRes.message = $"{randomEmoji}";
                        await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                        await Task.Delay(1000, cancellationToken);
                    }
                }
                catch (TaskCanceledException)
                {
                    // Handle the task cancellation if needed
                }
            }

            if (fnName == "use_dalle3_withpr")
            {
                chatRes.message = "使用【DALL·E3】组件执行绘制,这需要大约1-2分钟";
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                var emojiList = new List<string> { "🖌", "🎨", "🔧", "🖊", "🖍", "🖼", "🤯" };
                await StartLoadingIndicator(emojiList);
            }
            else if (fnName == "search_google_when_gpt_cannot_answer")
            {
                chatRes.message = "请稍候，让我Google一下";
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                var emojiList = new List<string> { "🌐" };
                await StartLoadingIndicator(emojiList);
            }
            else if (fnName == "search_knowledge_base")
            {
                chatRes.message = "请稍候，让我尝试检索知识库";
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                var emojiList = new List<string> { "🔎📄" };
                await StartLoadingIndicator(emojiList);
            }
        }
        public async Task<string> UnDoubletreating(PluginResDto pluginResDto, string chatId, string senMethod)
        {
            ChatRes chatRes = new ChatRes();
            string res = string.Empty;
            switch (pluginResDto.doubletype)
            {
                case "dalle3":
                    if (!string.IsNullOrEmpty(pluginResDto.errormsg) || string.IsNullOrEmpty(pluginResDto.result))
                    {
                        chatRes.message = $"绘制失败，请重试！({pluginResDto.errormsg})";
                        await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                        break;
                    }
                    string res1 = "<p>已为您绘制完成</p>";
                    chatRes.message = res1;
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    Thread.Sleep(200);
                    string res2 = "<p>绘制结果如下,请您查阅：</p><br />";
                    chatRes.message = res2;
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    Thread.Sleep(200);
                    string res3 = $"<img src='{pluginResDto.result}' style='width:300px;'/>";
                    chatRes.message = res3;
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    Thread.Sleep(200);
                    string res4 = @$"<br>提示词：<b>{pluginResDto.dallprompt}</b>";
                    chatRes.message = res4;
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    Thread.Sleep(200);
                    string res5 = @$"<br><b>如有需要，您可以前往【个人中心】->【图库】下载此图片，或者</b><a href=""{pluginResDto.result}"" target=""_blank"">【点击这里下载此图片】</a>";
                    chatRes.message = res5;
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    res = res1 + res2 + res3 + res4 + res5;
                    break;
                case "html":
                    res = pluginResDto.result;
                    chatRes.message = res;
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    break;
                case "js":
                    chatRes.message = "";
                    chatRes.jscode = pluginResDto.result;
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    chatRes.jscode = "";
                    break;
                default:
                    res = pluginResDto.result;
                    chatRes.message = res;
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    break;
            }
            return res;
        }
        public async Task<bool> SaveMemory(string aimodel, string account, string chatgroupId, string chatId)
        {
            bool result = false;
            //获取历史记录
            var chatList = GetChatHistories(account, chatId, -1).Where(c => c.ChatGroupId == chatgroupId).ToList();
            string memoryStr = string.Empty;
            foreach (var item in chatList)
            {
                if (item.Role == "user")
                    memoryStr += $"【提问：{item.Chat}】";
                else
                    memoryStr += $"【回答：{item.Chat}】";
            }
            memoryStr = memoryStr.Replace("\r", "").Replace("\n", "");
            if (!string.IsNullOrEmpty(memoryStr))
            {
                List<SystemCfg> systemCfgs = _systemService.GetSystemCfgs();
                var embeddingsUrl = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsUrl")?.CfgValue;
                var embeddingsApiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsApiKey")?.CfgValue;
                //文本转向量
                var client = new RestClient(embeddingsUrl);
                var request = CreateRequest(aimodel, memoryStr, embeddingsApiKey);
                var response = await client.ExecuteAsync(request);
                List<float> vector = new List<float>();
                if (response.IsSuccessful)
                {
                    EmbeddingApiResponseByMilvus embeddingApiResponseByMilvus = JsonConvert.DeserializeObject<EmbeddingApiResponseByMilvus>(response.Content);
                    if (embeddingApiResponseByMilvus != null && embeddingApiResponseByMilvus.Data != null && embeddingApiResponseByMilvus.Data.Count > 0)
                    {
                        vector = embeddingApiResponseByMilvus.Data[0].Embedding;
                    }
                    List<MilvusDataDto> milvusDataDtos = new List<MilvusDataDto> {
                       new MilvusDataDto
                       {
                           Id=Guid.NewGuid().ToString("N"),
                           Account=account,
                           Vector=vector,
                           VectorContent=memoryStr,
                           Type=$"{account}_memory"
                       }
                    };
                    result = await _milvusService.InsertVector(milvusDataDtos, $"{account}_memory", account);
                }
            }
            return result;
        }

        public async Task<Dtos.SearchVectorResultByMilvus> GetMemory(string aimodel, string account, string prompt)
        {
            Dtos.SearchVectorResultByMilvus searchVectorResultByMilvus = new SearchVectorResultByMilvus();
            List<SystemCfg> systemCfgs = _systemService.GetSystemCfgs();
            var embeddingsUrl = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsUrl")?.CfgValue;
            var embeddingsApiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsApiKey")?.CfgValue;
            //文本转向量
            var client = new RestClient(embeddingsUrl);
            var request = CreateRequest(aimodel, prompt, embeddingsApiKey);
            var response = await client.ExecuteAsync(request);
            List<float> vector = new List<float>();
            if (response.IsSuccessful)
            {
                EmbeddingApiResponseByMilvus embeddingApiResponseByMilvus = JsonConvert.DeserializeObject<EmbeddingApiResponseByMilvus>(response.Content);
                if (embeddingApiResponseByMilvus != null && embeddingApiResponseByMilvus.Data != null && embeddingApiResponseByMilvus.Data.Count > 0)
                {
                    vector = embeddingApiResponseByMilvus.Data[0].Embedding;
                }
                List<string> typeCodes = new List<string>() { $"{account}_memory" };
                searchVectorResultByMilvus = await _milvusService.SearchVector(vector, account, typeCodes, 5);
            }
            return searchVectorResultByMilvus;
        }
        public RestRequest CreateRequest(string model, string input, string embeddingsapikey)
        {
            var request = new RestRequest("", Method.Post);
            request.AddHeader("Authorization", $"Bearer {embeddingsapikey}");
            request.AddHeader("Content-Type", "application/json");
            request.AddHeader("Accept", "*/*");
            EmbeddingsBody embeddingsBody = new EmbeddingsBody
            {
                Model = model,
                Input = input
            };
            var body = JsonConvert.SerializeObject(embeddingsBody);
            request.AddParameter("application/json", body, ParameterType.RequestBody);
            return request;
        }
        private async Task<bool> CreateUseLogAndUpadteMoney(string account, string modelName, int inputCount, int outputCount, bool isdraw = false)
        {
            var user = _context.Users.Where(x => x.Account == account).FirstOrDefault();
            if (user == null)
            {
                return false;
            }
            decimal? realOutputMoney = 0m;
            //尝试从缓存中获取模型定价列表
            List<ModelPrice> modelPriceList = await GetModelPriceList();
            //根据模型名称获取模型定价
            var modelPrice = modelPriceList.Where(x => x.ModelName == modelName).FirstOrDefault();
            if (modelPrice != null)//如果不存在就是不扣费
            {
                //查询用户是否是VIP
                bool vip = await IsVip(account);
                if (vip)
                {
                    //如果是VIP，使用VIP价格
                    modelPrice.ModelPriceInput = modelPrice.VipModelPriceInput;
                    modelPrice.ModelPriceOutput = modelPrice.VipModelPriceOutput;
                    modelPrice.Rebate = modelPrice.VipRebate;
                }
                //如果是绘画
                if (isdraw)
                {
                    realOutputMoney = modelPrice.ModelPriceOutput * modelPrice.Rebate;
                }
                else
                {
                    //更新用户余额,字数要除以1000
                    var inputMoney = modelPrice.ModelPriceInput * inputCount / 1000;
                    var outputMoney = modelPrice.ModelPriceOutput * outputCount / 1000;
                    //根据折扣计算实际扣费
                    var rebate = modelPrice.Rebate;
                    realOutputMoney = (inputMoney + outputMoney) * rebate;
                }
                //扣除用户余额
                user.Mcoin -= realOutputMoney;
                if (user.Mcoin < 0)
                {
                    user.Mcoin = 0;
                }
                //标记实体状态为已修改
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
            //保存变更到数据库
            return await _context.SaveChangesAsync() > 0;
        }
    }
}
