using aibotPro.AppCode;
using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using RestSharp;
using StackExchange.Redis;
using System;
using System.Net;
using System.Security.Policy;
using System.Text;

namespace aibotPro.Service
{
    public class AiServer : IAiServer
    {
        readonly ISystemService _systemService;
        readonly AIBotProContext _context;
        readonly IRedisService _redis;
        public AiServer(ISystemService systemService, AIBotProContext context, IRedisService redis)
        {
            _systemService = systemService;
            _context = context;
            _redis = redis;
        }
        //实现接口
        public async IAsyncEnumerable<AiRes> CallingAI(AiChat aiChat, APISetting apiSetting, VisionBody visionBody = null)
        {
            //标准化baseurl
            string baseUrl = apiSetting.BaseUrl;
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
            // 创建HTTP客户端
            using (var httpClient = new HttpClient())
            {
                // 创建请求内容
                var requestBody = visionBody == null ? JsonConvert.SerializeObject(aiChat) : JsonConvert.SerializeObject(visionBody);
                var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Headers.Add("Authorization", $"Bearer {apiSetting.ApiKey}");
                var requestContent = new StringContent(requestBody, Encoding.UTF8, "application/json");
                request.Content = requestContent;
                using (var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead))
                {
                    using (var responseStream = await response.Content.ReadAsStreamAsync())
                    {
                        using (var reader = new StreamReader(responseStream, Encoding.UTF8))
                        {
                            string line;
                            while (!reader.EndOfStream)
                            {
                                line = await reader.ReadLineAsync();
                                if (line.StartsWith("data:"))
                                {
                                    var jsonDataStartIndex = line.IndexOf("data:") + "data:".Length;
                                    var jsonData = line.Substring(jsonDataStartIndex).Trim();

                                    // 检查是否有 "content":
                                    var resultIndex = jsonData.IndexOf("\"content\":");
                                    if (resultIndex >= 0)
                                    {
                                        AiRes res = new AiRes();
                                        try
                                        {
                                            // 直接使用 jsonData，它是 "data:" 之后的字符串
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

        public async Task<bool> SaveChatHistory(string account, string chatId, string content, string chatCode, string chatGroupId, string role, string model)
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
            //使用historyCount截取chatHistories,因为chatHistories是双行的所以要乘以2
            if (chatHistories.Count > historyCount * 2)
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
                                     .AsNoTracking()
                                     .Where(x => x.ChatId == chatId && x.IsDel == 0).ToList();
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
            if (chatHistories != null)
                _redis.DeleteAsync(chatHistories[0].ChatId);
            return _context.SaveChanges() > 0;
        }
        public async Task<string> CreateMJdraw(string prompt, string botType, string[] referenceImgPath, string baseUrl, string apiKey)
        {
            var client = new RestClient(baseUrl + "/mj/submit/imagine");
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
            var url = baseUrl + "/v1/chat/completions";
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
        public async Task DownloadImageAsync(string imageUrl, string savePath, string fileName)
        {
            //如果文件夹不存在则创建
            if (!Directory.Exists(savePath))
            {
                Directory.CreateDirectory(savePath);
            }
            try
            {
                //拼接文件名
                savePath = Path.Combine(savePath, fileName);
                using (HttpClient client = new HttpClient())
                {
                    using (HttpResponseMessage response = await client.GetAsync(imageUrl))
                    {
                        using (Stream streamToReadFrom = await response.Content.ReadAsStreamAsync())
                        {
                            using (Stream streamToWriteTo = File.Open(savePath, FileMode.Create))
                            {
                                await streamToReadFrom.CopyToAsync(streamToWriteTo);
                            }
                        }
                    }
                }
            }
            catch (Exception)
            {

                throw;
            }
        }

        public bool SaveAiDrawResult(string account, string model, string savePath, string prompt, string referenceImgPath)
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
                    ImgSavePath = savePath,
                    CreateTime = DateTime.Now,
                    IsDel = 0
                });
                return _context.SaveChanges() > 0;
            }
            catch (Exception e)
            {
                _systemService.WriteLog(e.Message, Dtos.LogLevel.Error, "system");
                return false;
            }

        }

        public async Task<string> CreateMJchange(string changeType, int changeIndex, string taskId, string baseUrl, string apiKey)
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
            var client = new RestClient(baseUrl + "/mj/submit/change");
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
        public string AiGet(string url, Dictionary<string, string> dic, Dictionary<string, string> headers = null, Dictionary<string, string> cookies = null)
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
        public string AiPost(string url, Dictionary<string, string> parameters, Dictionary<string, string> headers = null, Dictionary<string, string> cookies = null)
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
            var body = System.Text.Json.JsonSerializer.Serialize(parameters);
            request.AddParameter("application/json", body, ParameterType.RequestBody);
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
    }
}
