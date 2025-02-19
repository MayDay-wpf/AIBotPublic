using System.Net;
using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Web;
using System.Xml;
using aibotPro.AppCode;
using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using Google.Apis.Util;
using iTextSharp.text;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using RestSharp;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.PixelFormats;
using Spire.Presentation.Charts;
using TiktokenSharp;
using Formatting = Newtonsoft.Json.Formatting;
using Image = SixLabors.ImageSharp.Image;
using JsonSerializer = System.Text.Json.JsonSerializer;
using LogLevel = aibotPro.Dtos.LogLevel;

// 像素格式
// 添加ImageSharp的引用

namespace aibotPro.Service;

public class AiServer : IAiServer
{
    private readonly ChatCancellationManager _chatCancellationManager;
    private readonly AIBotProContext _context;
    private readonly ICOSService _cosservice;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly IMilvusService _milvusService;
    private readonly IRedisService _redis;
    private readonly IServiceProvider _serviceProvider;
    private readonly ISystemService _systemService;


    public AiServer(ISystemService systemService, AIBotProContext context, IRedisService redis,
        IHubContext<ChatHub> hubContext, IMilvusService milvusService, ChatCancellationManager chatCancellationManager,
        ICOSService cosservice, IServiceProvider serviceProvider)
    {
        _systemService = systemService;
        _context = context;
        _redis = redis;
        _hubContext = hubContext;
        _milvusService = milvusService;
        _chatCancellationManager = chatCancellationManager;
        _cosservice = cosservice;
        _serviceProvider = serviceProvider;
    }

    //实现接口
    public async IAsyncEnumerable<AiRes> CallingAI(
        AiChat aiChat,
        APISetting apiSetting,
        string chatId,
        VisionBody visionBody = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var baseUrl = apiSetting.BaseUrl;
        if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');

        var url = baseUrl + "/v1/chat/completions";
        using (var httpClient = new HttpClient())
        {
            var settings = new JsonSerializerSettings
            {
                NullValueHandling = NullValueHandling.Ignore
            };
            var requestBody = visionBody == null
                ? JsonConvert.SerializeObject(aiChat)
                : JsonConvert.SerializeObject(visionBody);
            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Add("Authorization", $"Bearer {apiSetting.ApiKey}");
            var requestContent = new StringContent(requestBody, Encoding.UTF8, "application/json");
            request.Content = requestContent;

            // 发送请求时，也传递取消令牌以便在请求级别处理取消
            using (var response =
                   await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken))
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
                                var tokenIndex = jsonData.IndexOf("\"total_tokens\":");
                                if (resultIndex >= 0 || tokenIndex >= 0)
                                {
                                    var res = new AiRes();
                                    try
                                    {
                                        res = JsonConvert.DeserializeObject<AiRes>(jsonData);
                                    }
                                    catch (Exception e)
                                    {
                                        await _systemService.WriteLog(e.Message, LogLevel.Error, "system");
                                        throw;
                                    }

                                    if (res != null)
                                    {
                                        //if (res.Choices != null && res.Choices.Count > 0 &&
                                        //    res.Choices[0].Delta != null)
                                        //{
                                        //    var decodedResult = res.Choices[0].Delta.Content;
                                        //    if (!string.IsNullOrEmpty(decodedResult))
                                        //        yield return res;
                                        //}
                                        //else if (res.Usages != null)
                                        //{
                                        //    yield return res;
                                        //}
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


    public async Task<string> CallingAINotStream(AiChat aiChat, APISetting apiSetting, VisionBody visionBody = null,
        bool returnObject = false)
    {
        var baseUrl = apiSetting.BaseUrl;
        if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');

        var url = baseUrl + "/v1/chat/completions";
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
        }
        catch (Exception e)
        {
            throw e;
        }

        var client = new RestClient($"{baseUrl}/v1/chat/completions");
        var request = new RestRequest("", Method.Post);
        request.AddHeader("Accept", "application/json");
        request.AddHeader("Authorization", $"Bearer {apiSetting.ApiKey}");
        request.AddHeader("Content-Type", "application/json");
        request.AddHeader("Connection", "keep-alive");
        var requestBody = new object();
        if (visionBody != null)
            requestBody = visionBody;
        else
            requestBody = aiChat;
        var body = JsonConvert.SerializeObject(requestBody, Formatting.Indented);
        request.AddParameter("application/json", body, ParameterType.RequestBody);
        var response = client.Execute(request);
        if (response.IsSuccessful)
        {
            var jsonResponse = JObject.Parse(response.Content);
            if (returnObject)
                return jsonResponse.ToString();
            var messageContent = jsonResponse["choices"]?[0]?["message"]?["content"];

            if (messageContent != null)
                return messageContent.ToString();
            return "";
        }

        return "";
    }

    public async Task<bool> SaveChatHistory(string account, string chatId, string content, string chatCode,
        string chatGroupId, string role, string model, string firstTime = "", string allTime = "", int islock = 0)
    {
        var chatHistory = new ChatHistory();
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
        chatHistory.IsLock = islock;
        _context.ChatHistories.Add(chatHistory);
        await _context.SaveChangesAsync();
        var chatHistories = _context.ChatHistories
            .AsNoTracking()
            .Where(x => x.ChatId == chatId && x.IsDel == 0).ToList();
        //刷新缓存
        await _redis.SetAsync(chatId, JsonConvert.SerializeObject(chatHistories), TimeSpan.FromHours(1));
        return true;
    }

    public List<ChatHistory> GetChatHistories(string account, string chatId, int historyCount, bool coder = false)
    {
        //先用chatId查询缓存
        var chatHistories = new List<ChatHistory>();
        var chatHistoryStr = _redis.GetAsync(chatId).Result;
        if (!string.IsNullOrEmpty(chatHistoryStr))
        {
            chatHistories = JsonConvert.DeserializeObject<List<ChatHistory>>(chatHistoryStr);
        }
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
        if (historyCount < 0)
            return chatHistories;
        //使用historyCount截取chatHistories,因为chatHistories是双行的所以要乘以2
        if (historyCount >= 0 && chatHistories.Count > historyCount * 2)
            chatHistories = chatHistories.Skip(chatHistories.Count - historyCount * 2).Take(historyCount * 2).ToList();
        chatHistories.ForEach(x => { x.Chat = _systemService.DecodeBase64(x.Chat); });
        if (coder)
        {
            for (int i = 0; i < chatHistories.Count; i++)
            {
                if (chatHistories[i].Role == "user")
                {
                    var nextIndex = i + 1;
                    if (nextIndex < chatHistories.Count && chatHistories[nextIndex].Role == "assistant")
                    {
                        // 查找 ``` 开始和结束的位置
                        int start = chatHistories[nextIndex].Chat.IndexOf("```");
                        while (start != -1)
                        {
                            int end = chatHistories[nextIndex].Chat.IndexOf("```", start + 3);
                            if (end != -1)
                            {
                                // 检查是否是语言类型代码块
                                int languageStart = start + 3;
                                int languageEnd = chatHistories[nextIndex].Chat
                                    .IndexOfAny(new char[] { '\n', ' ' }, languageStart);
                                if (languageEnd != -1 && languageEnd < end)
                                {
                                    // 移除代码块
                                    chatHistories[nextIndex].Chat =
                                        chatHistories[nextIndex].Chat.Remove(start, end - start + 3);
                                    // 重新查找下一个 ```
                                    start = chatHistories[nextIndex].Chat
                                        .IndexOf("```", start); // 注意这里不需要 + 3，因为我们已经移除了代码块
                                }
                                else
                                {
                                    // 不是语言类型代码块，继续查找下一个 ```
                                    start = chatHistories[nextIndex].Chat.IndexOf("```", end + 3);
                                }
                            }
                            else
                            {
                                // 没有找到结束的 ```，跳出循环
                                break;
                            }
                        }
                    }
                }
            }
        }
        else
        {
            for (int i = 0; i < chatHistories.Count; i++)
            {
                if (chatHistories[i].Role == "assistant")
                {
                    chatHistories[i].Chat = RemoveThinkTags(chatHistories[i].Chat);
                }
            }
        }

        return chatHistories;
    }

    private string RemoveThinkTags(string message)
    {
        string pattern = @"<think>.*?</think>";
        string result = System.Text.RegularExpressions.Regex.Replace(message, pattern, string.Empty,
            System.Text.RegularExpressions.RegexOptions.Singleline);

        // 如果整个字符串都被 <think> 包裹，或者 <think> 没有闭合，则返回空字符串
        if (result.Trim().Length == 0 || message.Contains("<think>") && !message.Contains("</think>"))
        {
            return string.Empty;
        }

        // 检查是否存在未闭合的 <think> 标签
        if (result.Contains("<think>"))
        {
            return string.Empty;
        }

        return result;
    }

    public async Task<List<ChatHistory>> GetChatHistoriesList(string account, int pageIndex, int pageSize,
        string searchKey)
    {
        var query = _context.ChatHistories
            .AsNoTracking()
            .Where(ch =>
                ch.Account == account && ch.IsDel != 1 && ch.Role == "user" && string.IsNullOrEmpty(ch.CollectionCode));

        // 优化：使用窗口函数获取每个 ChatId 对应的最早 CreateTime
        var subQuery = query
            .GroupBy(ch => ch.ChatId)
            .Select(g => new { ChatId = g.Key, MinCreateTime = g.Min(ch => ch.CreateTime) });

        var baseQuery = _context.ChatHistories
            .AsNoTracking()
            .Join(subQuery,
                ch => new { ch.ChatId, ch.CreateTime },
                sub => new { sub.ChatId, CreateTime = sub.MinCreateTime },
                (ch, sub) => ch)
            .Where(ch => ch.Account == account && ch.IsDel != 1 && ch.Role == "user");

        // 优化：将置顶逻辑和排序合并到一个查询中
        var pagedQuery = baseQuery
            .OrderByDescending(ch => ch.IsTop) // 置顶的排在前面
            .ThenByDescending(ch => ch.CreateTime);

        // 优化：应用搜索条件
        if (!string.IsNullOrEmpty(searchKey))
        {
            pagedQuery = (IOrderedQueryable<ChatHistory>)pagedQuery.Where(ch => ch.Chat.Contains(searchKey));
        }

        // 优化：数据库分页
        var chatHistories = await pagedQuery
            .Skip((pageIndex - 1) * pageSize)
            .Take(pageSize)
            .Select(ch => new ChatHistory // 一次性完成数据转换
            {
                ChatId = ch.ChatId,
                Account = ch.Account,
                Role = ch.Role,
                CreateTime = ch.CreateTime,
                IsDel = ch.IsDel,
                Chat = ch.Chat,
                ChatTitle = ch.ChatTitle,
                IsLock = ch.IsLock ?? 0,
                IsTop = ch.IsTop
            })
            .ToListAsync();

        // 优化：解码操作在获取数据后进行
        foreach (var history in chatHistories)
        {
            history.Chat = _systemService.DecodeBase64(history.Chat);
            if (!string.IsNullOrEmpty(history.ChatTitle))
            {
                history.ChatTitle = _systemService.DecodeBase64(history.ChatTitle);
                history.Chat = history.ChatTitle;
            }
        }

        return chatHistories;
    }

    public async Task<bool> UpdateAllChatTitlesByChatIdAsync(string account, string chatId, string chatTitle)
    {
        try
        {
            // 查询所有与给定 chatId 匹配的记录
            var chatHistories = await _context.ChatHistories
                .Where(ch => ch.ChatId == chatId && ch.Account == account && ch.IsDel == 0)
                .ToListAsync();

            if (chatHistories == null || chatHistories.Count == 0)
            {
                // 没有找到任何匹配的记录
                return false;
            }

            // 对 newChatTitle 进行 Base64 编码处理
            string encodedTitle = _systemService.EncodeBase64(chatTitle);

            // 更新所有匹配记录的 ChatTitle
            foreach (var chatHistory in chatHistories)
            {
                chatHistory.ChatTitle = encodedTitle;
            }

            // 提交更改到数据库
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            // 异常处理（也可以把异常抛出到更高一级的调用者处理）
            await _systemService.WriteLog($"/AiServer/UpdateAllChatTitlesByChatIdAsync:{ex.Message}",
                Dtos.LogLevel.Error, "system");
            return false;
        }
    }

    public bool DelChatHistory(string account, string chatId)
    {
        var chatHistories = new List<ChatHistory>();
        //删除聊天记录
        if (!string.IsNullOrEmpty(chatId))
        {
            //没有指定chatId则删除所有
            chatHistories = _context.ChatHistories.Where(x => x.Account == account && x.ChatId == chatId).ToList();
            chatHistories.ForEach(x => { x.IsDel = 1; });
        }
        else
        {
            chatHistories = _context.ChatHistories.Where(x => x.Account == account).ToList();
            chatHistories.ForEach(x => { x.IsDel = 1; });
        }

        chatHistories.ForEach(x => { x.IsDel = 1; });
        //清除缓存
        if (!string.IsNullOrEmpty(chatId))
            _redis.DeleteAsync(chatId);
        return _context.SaveChanges() > 0;
    }

    public List<ChatHistory> ShowHistoryDetail(string account, string chatId)
    {
        var chatHistories = new List<ChatHistory>();
        //从数据库加载
        chatHistories = _context.ChatHistories
            .Where(x => x.ChatId == chatId && x.IsDel != 1 && x.Account == account)
            .OrderBy(y => y.CreateTime).ToList();
        //写入缓存
        _redis.SetAsync(chatId, JsonConvert.SerializeObject(chatHistories), TimeSpan.FromHours(1));

        chatHistories.ForEach(x => { x.Chat = _systemService.DecodeBase64(x.Chat); });
        return chatHistories;
    }

    public bool DelChatGroup(string account, string groupId, int type)
    {
        var chatHistories = _context.ChatHistories.Where(x => x.Account == account && x.ChatGroupId == groupId)
            .ToList();
        chatHistories.ForEach(x => { x.IsDel = type; });
        //清除缓存
        if (chatHistories != null && chatHistories.Count > 0)
            _redis.DeleteAsync(chatHistories[0].ChatId);
        return _context.SaveChanges() > 0;
    }

    public async Task<string> CreateMJdraw(string prompt, string botType, string[] referenceImgPath, string baseUrl,
        string apiKey, string drawmodel)
    {
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
        }
        catch (Exception e)
        {
            throw e;
        }

        baseUrl += $"/mj-{drawmodel}/mj/submit/imagine";
        var client = new RestClient(baseUrl);
        var request = new RestRequest("", Method.Post);
        request.AddHeader("mj-api-secret", apiKey);
        request.AddHeader("Authorization", apiKey);
        request.AddHeader("Content-Type", "application/json");
        var mJdrawBody = new MJdrawBody();
        mJdrawBody.prompt = prompt;
        //mJdrawBody.botType = botType;
        mJdrawBody.base64Array = referenceImgPath;
        var body = JsonConvert.SerializeObject(mJdrawBody);
        request.AddParameter("application/json", body, ParameterType.RequestBody);
        var response = await client.ExecuteAsync(request);
        if (response.IsSuccessful)
        {
            var res = JsonConvert.DeserializeObject<dynamic>(response.Content);
            string taskId = res.result.ToString();
            return taskId;
        }

        await _systemService.WriteLog(response.Content, LogLevel.Error, "system");
        return "";
    }

    public async Task<string> CreateMJdrawByBlend(string botType, List<string> blendImages, string baseUrl,
        string apiKey, string drawmodel, string dimensions)
    {
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
        }
        catch (Exception e)
        {
            throw e;
        }

        baseUrl += $"/mj-{drawmodel}/mj/submit/blend";
        var client = new RestClient(baseUrl);
        var request = new RestRequest("", Method.Post);
        request.AddHeader("mj-api-secret", apiKey);
        request.AddHeader("Authorization", apiKey);
        request.AddHeader("Content-Type", "application/json");
        List<string> base64Array = new List<string>();
        foreach (var image in blendImages)
        {
            base64Array.Add("data:image/jpeg;base64," + await _systemService.ImgConvertToBase64(image));
        }

        var mJdrawBody = new
        {
            base64Array = base64Array,
            dimensions = dimensions
        };
        var body = JsonConvert.SerializeObject(mJdrawBody);
        request.AddParameter("application/json", body, ParameterType.RequestBody);
        var response = await client.ExecuteAsync(request);
        if (response.IsSuccessful)
        {
            var res = JsonConvert.DeserializeObject<dynamic>(response.Content);
            string taskId = res.result.ToString();
            return taskId;
        }

        await _systemService.WriteLog(response.Content, LogLevel.Error, "system");
        return "";
    }

    public async Task<string> CreateMJdrawBySwap(string botType, string baseUrl, string apiKey, string drawmodel,
        string yourFace, string starFace)
    {
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
        }
        catch (Exception e)
        {
            throw e;
        }

        baseUrl += $"/mj-{drawmodel}/mj/insight-face/swap";
        var client = new RestClient(baseUrl);
        var request = new RestRequest("", Method.Post);
        request.AddHeader("mj-api-secret", apiKey);
        request.AddHeader("Authorization", apiKey);
        request.AddHeader("Content-Type", "application/json");
        yourFace = "data:image/jpeg;base64," + await _systemService.ImgConvertToBase64(yourFace);
        starFace = "data:image/jpeg;base64," + await _systemService.ImgConvertToBase64(starFace);
        var mJdrawBody = new
        {
            sourceBase64 = yourFace,
            targetBase64 = starFace
        };
        var body = JsonConvert.SerializeObject(mJdrawBody);
        request.AddParameter("application/json", body, ParameterType.RequestBody);
        var response = await client.ExecuteAsync(request);
        if (response.IsSuccessful)
        {
            var res = JsonConvert.DeserializeObject<dynamic>(response.Content);
            string taskId = res.result.ToString();
            return taskId;
        }

        await _systemService.WriteLog(response.Content, LogLevel.Error, "system");
        return "";
    }

    public async Task<string> CreateDALLdraw(string prompt, string imgSize, string quality, string baseUrl,
        string apiKey)
    {
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
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
        var dALLdrawBody = new DALLdrawBody();
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
            var imgdata = JsonConvert.DeserializeObject<IMGResponseData>(response.Content);
            if (imgdata.data.Count > 0)
                return imgdata.data[0].url;
            return "";
        }

        return "";
    }

    public async Task<string> CreateDALLE2draw(string prompt, string imgSize, string baseUrl, string apiKey, int n = 1)
    {
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
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
        var dALLe2drawBody = new DALLE2drawBody();
        dALLe2drawBody.model = "dall-e-2";
        dALLe2drawBody.prompt = prompt;
        dALLe2drawBody.size = imgSize;
        dALLe2drawBody.n = n;
        var body = JsonConvert.SerializeObject(dALLe2drawBody);
        request.AddParameter("application/json", body, ParameterType.RequestBody);
        var response = await client.ExecuteAsync(request);
        if (response.IsSuccessful)
        {
            var imgdata = JsonConvert.DeserializeObject<IMGResponseDataE2>(response.Content);
            if (imgdata.data.Count > 0)
                return imgdata.data[0].url;
            return "";
        }

        return "";
    }

    public async Task<SDResponse> CreateSDdraw(string prompt, string model, string imageSize, int numberImages,
        int seed, int inferenceSteps, float guidanceScale, string negativePrompt, string apiKey, string baseUrl,
        string Channel)
    {
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
        }
        catch (Exception e)
        {
            throw e;
        }

        var sDResponse = new SDResponse();
        if (Channel == "SiliconCloud")
        {
            var client = new RestClient(baseUrl + $"/v1/images/generations");
            var request = new RestRequest("", Method.Post);
            request.AddHeader("Content-Type", "application/json");
            request.AddHeader("Authorization", $"Bearer {apiKey}");
            prompt = prompt.Replace("\r", "\\n").Replace("\n", "\\n");
            var sDdrawBody = new SDdrawBody();
            sDdrawBody.model = model;
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
                sDResponse = JsonConvert.DeserializeObject<SDResponse>(response.Content);
            else
                await _systemService.WriteLog("/AiServer/CreateSDdraw" + response.Content, LogLevel.Error, "system");
        }

        return sDResponse;
    }

    public async Task<TaskResponse> GetMJTaskResponse(string taskId, string baseUrl, string apiKey)
    {
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');


            var client = new RestClient($"{baseUrl}/mj/task/{taskId}/fetch");
            var request = new RestRequest("");
            request.AddHeader("Authorization", apiKey);
            var response = await client.ExecuteAsync(request);
            if (response.IsSuccessful)
            {
                var res = JsonConvert.DeserializeObject<TaskResponse>(response.Content);
                return res;
            }
        }
        catch (Exception e)
        {
            await _systemService.WriteLog("/AiServer/GetMJTaskResponse" + e.Message, LogLevel.Error, "system");
        }
        return null;
    }

    public async Task DownloadImageAsync(string imageUrl, string savePath, string fileNameWithoutExtension)
    {
        // 如果文件夹不存在则创建
        if (!Directory.Exists(savePath)) Directory.CreateDirectory(savePath);

        var fullPath = Path.Combine(savePath, $"{fileNameWithoutExtension}.png");

        try
        {
            using (var client = new HttpClient())
            {
                using (var response = await client.GetAsync(imageUrl))
                {
                    if (response.IsSuccessStatusCode)
                    {
                        using (var streamToReadFrom = await response.Content.ReadAsStreamAsync())
                        {
                            // 使用ImageSharp库加载图像
                            using (var image = Image.Load(streamToReadFrom))
                            {
                                // 转换并保存为PNG格式
                                image.SaveAsPng(fullPath);
                            }
                        }
                    }
                    else
                    {
                        await _systemService.WriteLog($"Error while downloading image: {response.StatusCode}",
                            LogLevel.Error, "system");
                        throw new Exception($"Error while downloading image: {response.StatusCode}");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"Error while downloading or saving the image: {ex.Message}", LogLevel.Error,
                "system");
            // 这里可以添加一些异常处理的代码，如记录日志等
            throw;
        }
    }

    public async Task<bool> SaveAiDrawResult(string account, string model, string savePath, string prompt,
        string referenceImgPath, string thumbSavePath, string thumbKey)
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
            await _systemService.WriteLog(e.Message, LogLevel.Error, "system");
            return false;
        }
    }

    public async Task<string> CreateMJchange(string changeType, int changeIndex, string taskId, string baseUrl,
        string apiKey, string drawmodel)
    {
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
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
        var mJchangeBody = new MJchangeBody();
        mJchangeBody.action = changeType;
        mJchangeBody.index = changeIndex;
        mJchangeBody.taskId = taskId;
        var body = JsonConvert.SerializeObject(mJchangeBody);
        request.AddParameter("application/json", body, ParameterType.RequestBody);
        var response = await client.ExecuteAsync(request);
        if (response.IsSuccessful)
        {
            var res = JsonConvert.DeserializeObject<dynamic>(response.Content);
            string change_taskId = res.result.ToString();
            return change_taskId;
        }

        return "";
    }

    public async Task<List<SearchResult>> GetWebSearchResult(string query, string googleSearchApiKey,
        string googleSearchEngineId)
    {
        var result = new GoogleSearch(googleSearchApiKey, googleSearchEngineId).Search(query);
        if (result.Count > 0)
            return result;
        return null;
    }

    public string AiGet(string url, Dictionary<string, object> dic, Dictionary<string, string> headers = null,
        Dictionary<string, string> cookies = null)
    {
        var result = "";
        var builder = new StringBuilder();
        builder.Append(url);
        if (dic.Count > 0)
        {
            builder.Append("?");
            var i = 0;
            foreach (var item in dic)
            {
                if (i > 0)
                    builder.Append("&");
                builder.AppendFormat("{0}={1}", item.Key, item.Value);
                i++;
            }
        }

        //如果headers有值，则加入到request头部
        var req = (HttpWebRequest)WebRequest.Create(builder.ToString());
        if (headers != null)
            foreach (var item in headers)
                req.Headers.Add(item.Key, item.Value);

        //如果cookies有值，则加入到request的Cookie容器
        if (cookies != null)
        {
            var cookieContainer = new CookieContainer();
            foreach (var item in cookies)
                cookieContainer.Add(new Cookie(item.Key, item.Value, "/", req.RequestUri.Host));
            req.CookieContainer = cookieContainer;
        }

        //添加参数
        var resp = (HttpWebResponse)req.GetResponse();
        var stream = resp.GetResponseStream();
        try
        {
            //获取内容
            using (var reader = new StreamReader(stream))
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

    public string AiPost(string url, Dictionary<string, object> parameters, Dictionary<string, string> headers = null,
        Dictionary<string, string> cookies = null, string jsonBody = "")
    {
        var client = new RestClient(url);
        var request = new RestRequest("", Method.Post);
        if (cookies != null)
            foreach (var item in cookies)
                request.AddHeader("Cookie", $"{item.Key}={item.Value}");
        if (headers != null)
            foreach (var item in headers)
                request.AddHeader(item.Key, item.Value);
        request.AddHeader("Content-Type", "application/json");
        request.AddHeader("Accept", "*/*");
        request.AddHeader("Connection", "keep-alive");
        if (!string.IsNullOrEmpty(jsonBody))
        {
            request.AddParameter("application/json", jsonBody, ParameterType.RequestBody);
        }
        else
        {
            var body = JsonSerializer.Serialize(parameters);
            request.AddParameter("application/json", body, ParameterType.RequestBody);
        }

        var response = client.Execute(request);

        if (response.IsSuccessStatusCode)
        {
            var responseContent = response.Content;
            return responseContent;
        }

        return "请求失败：" + response.StatusCode;
    }

    public async Task<List<AIdrawRe>> GetAIdrawResList(string account, int page, int pageSize, string role = "")
    {
        // 利用IQueryable延迟执行，直到真正需要数据的时候才去数据库查询
        if (!string.IsNullOrEmpty(role))
            account = "system";
        var query = _context.AIdrawRes.Where(p => p.Account == account);
        // 然后添加分页逻辑，此处同样是构建查询，没有执行
        var aidrawRes = query.OrderByDescending(x => x.CreateTime) // 这里可以根据需要替换为合适的排序字段
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList(); // 直到调用ToList，查询才真正执行

        return aidrawRes;
    }

    public async Task<string> GPTJsonModel(string systemprompt, string prompt, string model, string account)
    {
        // 查询AIModel
        var aiModel = _systemService.GetAImodel();
        var modelCfg = aiModel.FirstOrDefault(x => x.ModelName == model);
        if (modelCfg == null)
            return "未找到AIModel";
        var baseUrl = modelCfg.BaseUrl;
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
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

        var payload = new
        {
            model,
            response_format = new { type = "json_object" },
            messages = new[]
            {
                new { role = "system", content = systemprompt },
                new { role = "user", content = prompt }
            },
            stream = false
        };

        var jsonBody = JsonConvert.SerializeObject(payload);
        request.AddParameter("application/json", jsonBody, ParameterType.RequestBody);

        var response = client.Execute(request);
        if (response.IsSuccessful)
        {
            var jsonObj = JsonConvert.DeserializeObject<JObject>(response.Content);
            var content = jsonObj["choices"][0]["message"]["content"].ToString();
            if (!string.IsNullOrEmpty(content) && model == "gpt-4-turbo-preview")
            {
                var tikToken = TikToken.GetEncoding("cl100k_base");
                await CreateUseLogAndUpadteMoney(account, model, tikToken.Encode(systemprompt + prompt).Count,
                    tikToken.Encode(content).Count);
            }

            return content;
        }

        return "";
    }

    public async Task<string> GPTJsonSchema(string prompt, string schema, string model, string account)
    {
        var aiChat = CreateAiChat(model, prompt, false, false, true, schema);
        var apiSetting = CreateAPISetting(model);
        var result = await CallingAINotStream(aiChat, apiSetting, null);
        return result;
    }

    public AiChat CreateAiChat(string aimodel, string prompt, bool stream, bool jsonModel, bool jsonSchema,
        string jsonSchemaInput)
    {
        AiChat aiChat = new AiChat();
        aiChat.Model = aimodel;
        aiChat.Stream = stream;

        // 处理JSON模型
        if (jsonModel)
        {
            aiChat.ResponseFormat = new ResponseFormat()
            {
                Type = "json_object"
            };
        }

        // 处理JSON Schema
        if (jsonSchema && !string.IsNullOrWhiteSpace(jsonSchemaInput))
        {
            JObject schemaObject = JObject.Parse(jsonSchemaInput);

            aiChat.ResponseFormat = new ResponseFormat()
            {
                Type = "json_schema",
                JsonSchema = new JsonSchemaWrapper
                {
                    Name = "reply_schema",
                    Strict = true,
                    Schema = schemaObject
                }
            };
        }

        // 创建消息列表
        List<Message> messages = new List<Message>();
        Message message = new Message
        {
            Role = "user",
            Content = prompt
        };
        messages.Add(message);
        aiChat.Messages = messages;
        return aiChat;
    }

    public VisionBody CreateVisionBody(string aimodel, string prompt, string imgurl, bool stream, bool jsonModel,
        bool jsonSchema, string jsonSchemaInput)
    {
        VisionBody visionBody = new VisionBody();
        visionBody.model = aimodel;
        visionBody.stream = stream;

        if (jsonModel)
        {
            visionBody.response_format = new ResponseFormat()
            {
                Type = "json_object"
            };
        }

        if (jsonSchema && !string.IsNullOrWhiteSpace(jsonSchemaInput))
        {
            // 解析jsonSchemaInput为JObject
            JObject schemaObject = JObject.Parse(jsonSchemaInput);

            visionBody.response_format = new ResponseFormat()
            {
                Type = "json_schema",
                JsonSchema = new JsonSchemaWrapper
                {
                    Name = "reply_schema", // 可以自定义通过参数传入或固定命名
                    Strict = true, // 根据实际需求设置
                    Schema = schemaObject
                }
            };
        }

        List<VisionChatMessage> messages = new List<VisionChatMessage>();
        List<VisionContent> visionContents = new List<VisionContent>();

        VisionContent textVisionContent = new VisionContent()
        {
            type = "text",
            text = prompt
        };
        VisionContent imgVisionContent = new VisionContent()
        {
            type = "image_url",
            image_url = new VisionImg
            {
                url = imgurl
            }
        };

        visionContents.Add(textVisionContent);
        visionContents.Add(imgVisionContent);

        messages.Add(new VisionChatMessage
        {
            role = "user",
            content = new ContentWrapper
            {
                visionContentList = visionContents
            }
        });

        visionBody.messages = messages.ToArray();
        return visionBody;
    }

    public async Task<string> TTS(string text, string model, string voice)
    {
        //查询AIModel
        var aiModel = _systemService.GetAImodel();
        var modelCfg = aiModel.FirstOrDefault();
        if (modelCfg == null)
            return "未找到AIModel";
        var baseUrl = modelCfg.BaseUrl;
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
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
        var response = await client.ExecuteAsync(request);
        if (response.StatusCode == HttpStatusCode.OK)
        {
            //保存返回的音频文件
            var savePath = Path.Combine("wwwroot", $"files/audio/{DateTime.Now.ToString("yyyyMMdd")}");
            if (!Directory.Exists(savePath)) Directory.CreateDirectory(savePath);
            var fileName = Guid.NewGuid() + ".mp3";
            savePath = Path.Combine(savePath, fileName);
            using (var fs = new FileStream(savePath, FileMode.Create))
            {
                fs.Write(response.RawBytes, 0, response.RawBytes.Length);
            }

            return savePath;
        }

        await _systemService.WriteLog(response.Content, LogLevel.Error, "system");
        return "";
    }

    public async Task ExecuteFunctionWithLoadingIndicators(string fnName, string chatId, string senMethod,
        CancellationToken cancellationToken)
    {
        var chatRes = new ChatRes();
        string loadingDOM = @"<div class=""pluginloading-container"">
                                <div class=""pluginloading-loading-border"">
                                    <img src=""{0}"" class=""pluginloading-avatar"">
                                </div>
                                <div class=""pluginloading-content"">
                                    <h6 class=""pluginloading-title"">{1}</h6>
                                </div>
                            </div>";
        //async Task StartLoadingIndicator(List<string> emojiList)
        //{
        //    var random = new Random();
        //    try
        //    {
        //        while (!cancellationToken.IsCancellationRequested)
        //        {
        //            var randomEmoji = emojiList[random.Next(emojiList.Count)];
        //            chatRes.message = $"{randomEmoji}";
        //            await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
        //            await Task.Delay(1000, cancellationToken);
        //        }
        //    }
        //    catch (TaskCanceledException)
        //    {
        //        // Handle the task cancellation if needed
        //    }
        //}

        if (fnName == "use_dalle3_withpr")
        {
            chatRes.message = string.Format(loadingDOM, "/system/images/systempluginlogo/dalle3.png", "DALL·E3");
            chatRes.loading = true;
            await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
            //var emojiList = new List<string> { "🖌", "🎨", "🔧", "🖊", "🖍", "🖼", "🤯" };
            //await StartLoadingIndicator(emojiList);
        }
        else if (fnName == "search_google_when_gpt_cannot_answer")
        {
            chatRes.message = string.Format(loadingDOM, "/system/images/systempluginlogo/google.png", "Google搜索");
            chatRes.loading = true;
            await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
            //var emojiList = new List<string> { "🌐" };
            //await StartLoadingIndicator(emojiList);
        }
        else if (fnName == "search_knowledge_base")
        {
            chatRes.message = string.Format(loadingDOM, "/system/images/systempluginlogo/knowledge.png", "知识库检索");
            chatRes.loading = true;
            await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
            //var emojiList = new List<string> { "🔎📄" };
            //await StartLoadingIndicator(emojiList);
        }
        else
        {
            var plugin = _context.Plugins.Where(p => p.Pfunctionname == fnName).FirstOrDefault();
            if (plugin != null)
            {
                chatRes.message = string.Format(loadingDOM, plugin.Pavatar, plugin.Pnickname);
                chatRes.loading = true;
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
            }
        }
    }

    public async Task<string> UnDoubletreating(PluginResDto pluginResDto, string chatId, string senMethod)
    {
        var chatRes = new ChatRes();
        var res = string.Empty;
        switch (pluginResDto.doubletype)
        {
            case "dalle3":
                if (!string.IsNullOrEmpty(pluginResDto.errormsg) || string.IsNullOrEmpty(pluginResDto.result))
                {
                    chatRes.message = $"绘制失败，请重试！({pluginResDto.errormsg})";
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                    break;
                }

                var res1 = "<p>已为您绘制完成</p>";
                chatRes.message = res1;
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                Thread.Sleep(200);
                var res2 = "<p>绘制结果如下,请您查阅：</p><br />";
                chatRes.message = res2;
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                Thread.Sleep(200);
                var res3 = $"<img src='{pluginResDto.result}' style='width:300px;'/>";
                chatRes.message = res3;
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                Thread.Sleep(200);
                var res4 = @$"<br><p>提示词：<b>{pluginResDto.dallprompt}</b></p>";
                chatRes.message = res4;
                await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                Thread.Sleep(200);
                var res5 =
                    @$"<br><p><b>如有需要，您可以前往【个人中心】->【图库】下载此图片，或者</b><a href=""{pluginResDto.result}"" target=""_blank"">【点击这里下载此图片】</a></p>";
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
        var result = false;
        // 获取历史记录
        var chatList = GetChatHistories(account, chatId, -1);

        // 如果 chatgroupId 不为空，则进行过滤
        if (!string.IsNullOrEmpty(chatgroupId))
        {
            chatList = chatList.Where(c => c.ChatGroupId == chatgroupId).ToList();
        }

        // 按照 chatgroupId 分组处理
        var groupedChatList = chatList.GroupBy(c => c.ChatGroupId).ToList();

        foreach (var group in groupedChatList)
        {
            var memoryStr = string.Empty;
            foreach (var item in group)
            {
                if (item.Role == "user")
                {
                    memoryStr += $"[User]:\n {_systemService.DecodeBase64(item.Chat)} \n";
                }
                else
                {
                    memoryStr += $"[Assistant]:\n {_systemService.DecodeBase64(item.Chat)} \n";
                }
            }

            // 如果 memoryStr 不为空，进行向量保存操作
            if (!string.IsNullOrEmpty(memoryStr))
            {
                var systemCfgs = _systemService.GetSystemCfgs();
                var embeddingsUrl = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsUrl")?.CfgValue;
                var embeddingsApiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsApiKey")?.CfgValue;

                // 文本转向量
                var client = new RestClient(embeddingsUrl);
                var request = CreateRequest(aimodel, memoryStr, embeddingsApiKey);
                var response = await client.ExecuteAsync(request);
                var vector = new List<float>();

                if (response.IsSuccessful)
                {
                    var embeddingApiResponseByMilvus =
                        JsonConvert.DeserializeObject<EmbeddingApiResponseByMilvus>(response.Content);
                    if (embeddingApiResponseByMilvus != null && embeddingApiResponseByMilvus.Data != null &&
                        embeddingApiResponseByMilvus.Data.Count > 0)
                    {
                        vector = embeddingApiResponseByMilvus.Data[0].Embedding;
                    }

                    var milvusDataDto = new MilvusDataDto
                    {
                        Id = Guid.NewGuid().ToString("N"),
                        Account = account,
                        Vector = vector,
                        VectorContent = memoryStr,
                        Type = $"{account}_memory"
                    };

                    result = await _milvusService.InsertVector(new List<MilvusDataDto> { milvusDataDto },
                        $"{account}_memory", account);
                }
            }
        }

        return result;
    }

    public async Task<SearchVectorResultByMilvus> GetMemory(string aimodel, string account, string prompt)
    {
        var searchVectorResultByMilvus = new SearchVectorResultByMilvus();
        var systemCfgs = _systemService.GetSystemCfgs();
        var embeddingsUrl = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsUrl")?.CfgValue;
        var embeddingsApiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsApiKey")?.CfgValue;
        //文本转向量
        var client = new RestClient(embeddingsUrl);
        var request = CreateRequest(aimodel, prompt, embeddingsApiKey);
        var response = await client.ExecuteAsync(request);
        var vector = new List<float>();
        if (response.IsSuccessful)
        {
            var embeddingApiResponseByMilvus =
                JsonConvert.DeserializeObject<EmbeddingApiResponseByMilvus>(response.Content);
            if (embeddingApiResponseByMilvus != null && embeddingApiResponseByMilvus.Data != null &&
                embeddingApiResponseByMilvus.Data.Count > 0) vector = embeddingApiResponseByMilvus.Data[0].Embedding;
            var typeCodes = new List<string> { $"{account}_memory" };
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
        var embeddingsBody = new EmbeddingsBody
        {
            Model = model,
            Input = input
        };
        var body = JsonConvert.SerializeObject(embeddingsBody);
        request.AddParameter("application/json", body, ParameterType.RequestBody);
        return request;
    }

    public async Task<string> CreateHistoryPrompt(List<Message> messages,
        List<VisionChatMessage> visionChatMesssages = null)
    {
        var systemCfg = _systemService.GetSystemCfgs();
        var keepQuantity = systemCfg.Where(x => x.CfgCode == "History_Prompt_Keep_Quantity").FirstOrDefault();
        if (keepQuantity == null)
            return string.Empty;
        // 检查是否有足够的消息来创建历史记录
        if ((messages == null || messages.Count < int.Parse(keepQuantity.CfgValue) * 2) &&
            (visionChatMesssages == null || visionChatMesssages.Count < int.Parse(keepQuantity.CfgValue) * 2))
            return string.Empty;

        var prompt = string.Empty;
        var historyStr = "请对以下对话历史进行简洁的总结，保留关键信息和上下文：\n\n";
        var aiChat = new AiChat();
        var useAiModel = systemCfg.FirstOrDefault(x => x.CfgKey == "History_Prompt_AIModel");
        if (useAiModel == null)
            return string.Empty;
        aiChat.Model = useAiModel.CfgValue;
        aiChat.Stream = false;
        var apiSetting = CreateAPISetting(aiChat.Model);

        List<object> lastTwoMessages;
        List<object> messagesToSummarize;

        if (visionChatMesssages != null && visionChatMesssages.Any())
        {
            lastTwoMessages = visionChatMesssages.TakeLast(2).Cast<object>().ToList();
            messagesToSummarize = visionChatMesssages.Take(visionChatMesssages.Count - 2).Cast<object>().ToList();
        }
        else
        {
            lastTwoMessages = messages.TakeLast(2).Cast<object>().ToList();
            messagesToSummarize = messages.Take(messages.Count - 2).Cast<object>().ToList();
        }

        // 生成历史摘要
        foreach (var item in messagesToSummarize)
        {
            if (item is VisionChatMessage visionMessage)
            {
                // 确定角色，并追加到历史字符串
                historyStr += visionMessage.role == "user" ? "用户: " : "AI: ";

                // 检查是否有 stringContent (即 content 被配置为字符串)
                if (visionMessage.content.stringContent != null)
                {
                    historyStr += visionMessage.content.stringContent + " ";
                }
                // 否则检查是否有 visionContentList
                else if (visionMessage.content.visionContentList != null)
                {
                    foreach (var content in visionMessage.content.visionContentList)
                    {
                        // 根据内容类型处理
                        if (content.type == "text")
                        {
                            historyStr += content.text + " ";
                        }
                        else if (content.type == "image_url" && content.image_url != null)
                        {
                            historyStr += "[图片内容: " + content.image_url.url + "] ";
                        }
                    }
                }
            }
            else if (item is Message message)
            {
                historyStr += message.Role == "user" ? "用户: " : "AI: ";
                historyStr += message.Content;
            }

            historyStr += "\n";
        }

        // 发起非流请求获取摘要
        var newMessages = new List<Message>
        {
            new()
            {
                Role = "system",
                Content = "你是一个专业的对话总结助手。请对给定的对话历史进行全面的总结，确保包含关键信息和上下文。避免重复和不必要的细节。条理清晰段落清晰。"
            },
            new()
            {
                Role = "user",
                Content = historyStr
            }
        };
        aiChat.Messages = newMessages;
        var summaryResult = await CallingAINotStream(aiChat, apiSetting);

        if (!string.IsNullOrEmpty(summaryResult))
        {
            prompt += "# 要求：请基于以下内容继续我们的对话。\n\n";
            prompt = $"* 以下是之前对话的总结：\n\n{summaryResult}\n\n*以下是最近的对话：\n\n";
            foreach (var message in lastTwoMessages)
            {
                if (message is VisionChatMessage visionMessage)
                {
                    // 追加用户或AI的角色到 prompt
                    prompt += $"{(visionMessage.role == "user" ? "用户" : "AI")}: ";

                    // 如果 content 是字符串，直接处理 stringContent
                    if (visionMessage.content.stringContent != null)
                    {
                        prompt += visionMessage.content.stringContent + " ";
                    }
                    // 否则，处理 visionContentList
                    else if (visionMessage.content.visionContentList != null)
                    {
                        foreach (var content in visionMessage.content.visionContentList)
                        {
                            // 如果内容类型是 text，就追加文本
                            if (content.type == "text")
                            {
                                prompt += content.text + " ";
                            }
                        }
                    }
                }
                else if (message is Message textMessage)
                {
                    prompt += $"{(textMessage.Role == "user" ? "用户" : "AI")}: {textMessage.Content}";
                }

                prompt += "\n";
            }
        }

        return prompt;
    }

    public async Task<string> CreateSunoTask(string mode, string gptDescription, string prompt, string tags, string mv,
        string title, string baseUrl, string apiKey, string account)
    {
        var taskId = string.Empty;
        var data = string.Empty;
        if (baseUrl.EndsWith("/"))
            baseUrl = baseUrl.TrimEnd('/');
        baseUrl = baseUrl + "/suno/v1/music";
        if (mode == "inspiration") //灵感模式
        {
            mv = "chirp-v3-0";
            tags = "emotional punk";
            var systemPrompt = @"
                                    # 你是一个歌曲作词专家。
                                    # 请根据提供的用户灵感进行创作
                                    # 输出应该是一个JSON格式的字符串，包含歌词,标题,标签。
                                    # 输出的JSON格式应当按照以下示例：
                                    {
                                        ""title"": ""这里填写根据灵感生成的标题"",
                                        ""lyrics"": ""这里填写根据灵感生成的歌词"",
                                        ""tags"": ""这里填写根据灵感生成的标签,标签使用英语"",
                                    }";
            var userprompt = $"用户灵感：{gptDescription}";
            var resultJson = await GPTJsonModel(systemPrompt, userprompt, "gpt-4o-mini", account);
            if (!string.IsNullOrEmpty(resultJson))
            {
                var resultData = JsonConvert.DeserializeObject<LyricsResult>(resultJson);
                if (resultData != null && !string.IsNullOrEmpty(resultData.Lyrics) &&
                    !string.IsNullOrEmpty(resultData.Title) && !string.IsNullOrEmpty(resultData.Tags))
                {
                    prompt = resultData.Lyrics;
                    title = resultData.Title;
                    tags = resultData.Tags;
                }
                else
                {
                    return taskId;
                }
            }
            else
            {
                return taskId;
            }
        }

        var dataObj = new
        {
            custom_mode = true,
            input = new
            {
                prompt,
                title,
                tags,
                mv
            }
        };
        data = JsonConvert.SerializeObject(dataObj);
        //发起请求
        var client = new RestClient(baseUrl);
        var request = new RestRequest("", Method.Post);
        request.AddHeader("Content-Type", "application/json");
        request.AddHeader("Authorization", $"Bearer {apiKey}");
        request.AddHeader("Accept", "*/*");
        request.AddHeader("Connection", "keep-alive");
        request.AddParameter("application/json", data, ParameterType.RequestBody);
        var response = await client.ExecuteAsync(request);
        if (response.IsSuccessful)
        {
            var sunoResponse = JsonConvert.DeserializeObject<SunoResponse>(response.Content);
            if (sunoResponse != null && sunoResponse.Data != null && !string.IsNullOrEmpty(sunoResponse.Data.TaskId))
                taskId = JsonConvert.DeserializeObject<SunoResponse>(response.Content).Data.TaskId;
        }
        else
        {
            await _systemService.WriteLog("AiServer/CreateSunoTask" + response.Content, LogLevel.Error, "system");
        }

        if (!string.IsNullOrEmpty(taskId)) await _redis.SetAsync($"{account}-suno", taskId, TimeSpan.FromHours(1));
        return taskId;
    }

    public async Task<SunoTaskResponse> GetSunoTask(string taskId, string account, string baseUrl, string apiKey)
    {
        var redis_key = $"{account}-suno";
        var sunoTaskResponse = new SunoTaskResponse();
        if (baseUrl.EndsWith("/"))
            baseUrl = baseUrl.TrimEnd('/');
        baseUrl = baseUrl + "/suno/v1/music/";
        var client = new RestClient(baseUrl + taskId);
        var request = new RestRequest("");
        request.AddHeader("Content-Type", "application/json");
        request.AddHeader("Authorization", $"Bearer {apiKey}");
        request.AddHeader("Accept", "*/*");
        request.AddHeader("Connection", "keep-alive");

        const int maxRetries = 3;
        var retryCount = 0;
        RestResponse response = null;

        while (retryCount < maxRetries)
            try
            {
                response = await client.ExecuteAsync(request);
                if (response.IsSuccessStatusCode) break;
                retryCount++;
                if (retryCount < maxRetries)
                    await Task.Delay(1000 * retryCount); // Wait for 1, 2, 3 seconds before retrying
            }
            catch (Exception ex)
            {
                await _systemService.WriteLog($"【/AiServer/GetSunoTask】Attempt {retryCount + 1} failed: {ex.Message}",
                    LogLevel.Error, account);
                retryCount++;
                if (retryCount < maxRetries) await Task.Delay(1000 * retryCount);
            }

        if (response == null || !response.IsSuccessStatusCode)
        {
            await _redis.DeleteAsync(redis_key);
            throw new Exception($"API request failed after {maxRetries} attempts");
        }

        try
        {
            sunoTaskResponse = JsonConvert.DeserializeObject<SunoTaskResponse>(response.Content);
        }
        catch (Exception e)
        {
            await _systemService.WriteLog($"【/AiServer/GetSunoTask】:{e.Message}", LogLevel.Error, account);
        }

        if (sunoTaskResponse.Data.Status == "completed")
        {
            foreach (var clipKvp in sunoTaskResponse.Data.Clips)
            {
                var clip = clipKvp.Value;
                var sunoRe = new SunoRe
                {
                    Account = account,
                    TaskId = taskId,
                    SongId = clip.Id,
                    Prompt = clip.Metadata.Prompt,
                    CreateTime = DateTime.Now,
                    Title = clip.Title,
                    ImageUrl = clip.ImageUrl,
                    ImageLargeUrl = clip.ImageLargeUrl,
                    AudioUrl = clip.AudioUrl,
                    VideoUrl = clip.VideoUrl
                };

                _context.SunoRes.Add(sunoRe);
            }

            await _context.SaveChangesAsync();
            await _redis.DeleteAsync(redis_key);

            // 在后台启动一个任务处理文件下载和可能的COS上传
            _ = Task.Run(async () =>
            {
                using (var scope = _serviceProvider.CreateScope())
                {
                    var context = scope.ServiceProvider.GetRequiredService<AIBotProContext>();
                    var systemService = scope.ServiceProvider.GetRequiredService<ISystemService>();
                    var cosService = scope.ServiceProvider.GetRequiredService<ICOSService>();

                    var systemCfg = systemService.GetSystemCfgs();
                    var cos_switch = systemCfg.FirstOrDefault(x => x.CfgKey == "COS_Switch");
                    var useCOS = cos_switch != null && cos_switch.CfgValue == "1";

                    foreach (var clipKvp in sunoTaskResponse.Data.Clips)
                    {
                        var clip = clipKvp.Value;
                        var newFileName = Guid.NewGuid().ToString().Replace("-", "");
                        var currentDate = DateTime.Now.ToString("yyyyMMdd");
                        var baseSavePath = Path.Combine("wwwroot", "files", "sunores", currentDate);

                        var sunoRe = await context.SunoRes.FirstOrDefaultAsync(s => s.SongId == clipKvp.Value.Id);

                        if (sunoRe != null)
                        {
                            if (useCOS)
                            {
                                var imageResult = await DownloadAndUploadToCOS(clip.ImageUrl, baseSavePath, "image",
                                    newFileName, account, cosService, systemService);
                                sunoRe.ImageCosKey = imageResult.CosKey;
                                sunoRe.ImageUrl = imageResult.CosUrl;

                                var imageLargeResult = await DownloadAndUploadToCOS(clip.ImageLargeUrl, baseSavePath,
                                    "image", newFileName, account, cosService, systemService);
                                sunoRe.ImageLargeCosKey = imageLargeResult.CosKey;
                                sunoRe.ImageLargeUrl = imageLargeResult.CosUrl;

                                var audioResult = await DownloadAndUploadToCOS(clip.AudioUrl, baseSavePath, "audio",
                                    newFileName, account, cosService, systemService);
                                sunoRe.AudioCosKey = audioResult.CosKey;
                                sunoRe.AudioUrl = audioResult.CosUrl;

                                var videoResult = await DownloadAndUploadToCOS(clip.VideoUrl, baseSavePath, "video",
                                    newFileName, account, cosService, systemService);
                                sunoRe.VideoCosKey = videoResult.CosKey;
                                sunoRe.VideoUrl = videoResult.CosUrl;
                            }
                            else
                            {
                                sunoRe.ImageUrl = await DownloadToLocal(clip.ImageUrl, baseSavePath, "image",
                                    newFileName, account, systemService);
                                sunoRe.ImageLargeUrl = await DownloadToLocal(clip.ImageLargeUrl, baseSavePath, "image",
                                    newFileName, account, systemService);
                                sunoRe.AudioUrl = await DownloadToLocal(clip.AudioUrl, baseSavePath, "audio",
                                    newFileName, account, systemService);
                                sunoRe.VideoUrl = await DownloadToLocal(clip.VideoUrl, baseSavePath, "video",
                                    newFileName, account, systemService);
                            }

                            context.SunoRes.Update(sunoRe);
                            await context.SaveChangesAsync();
                        }
                    }
                }
            });
            Thread.Sleep(10000); //等10s控制并发
        }

        return sunoTaskResponse;
    }

    public async Task<TokenizerDetail> TokenizeJinaAI(string content, int maxChunkLength,
        string tokenizer = "cl100k_base", bool returnChunks = true, bool returnTokens = false)
    {
        TokenizerDetail result = new TokenizerDetail();
        var systemCfgs = _systemService.GetSystemCfgs();
        var baseUrl = systemCfgs.FirstOrDefault(x => x.CfgKey == "Tokenize_BaseUrl_Jina")?.CfgValue;
        var apiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "Tokenize_ApiKey_Jina")?.CfgValue;

        if (string.IsNullOrEmpty(baseUrl))
        {
            throw new Exception("Tokenize_BaseUrl_Jina is not configured.");
        }

        using (var httpClient = new HttpClient())
        {
            httpClient.BaseAddress = new Uri(baseUrl);

            if (!string.IsNullOrEmpty(apiKey))
            {
                httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            }

            var requestData = new
            {
                content = content,
                return_chunks = returnChunks.ToString().ToLower(),
                max_chunk_length = maxChunkLength.ToString(),
                return_tokens = returnTokens.ToString().ToLower(),
                tokenizer = tokenizer
            };

            var jsonContent = JsonConvert.SerializeObject(requestData);
            var httpContent = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            var response = await httpClient.PostAsync("", httpContent);

            if (response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                result = JsonConvert.DeserializeObject<TokenizerDetail>(responseContent);
            }
            else
            {
                throw new Exception($"API request failed with status code: {response.StatusCode}");
            }
        }

        return result;
    }


    public async Task<RerankerResponse> RerankerJinaAI(List<string> documents, string query, int topn)
    {
        var systemCfgs = _systemService.GetSystemCfgs();
        var baseUrl = systemCfgs.FirstOrDefault(x => x.CfgKey == "Rerank_BaseUrl_Jina")?.CfgValue;
        var apiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "Rerank_ApiKey_Jina")?.CfgValue;
        var model = systemCfgs.FirstOrDefault(x => x.CfgKey == "Rerank_Model_Jina")?.CfgValue;

        if (string.IsNullOrEmpty(baseUrl) || string.IsNullOrEmpty(apiKey))
        {
            throw new Exception("Rerank configuration is missing.");
        }

        using (var client = new HttpClient())
        {
            client.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

            var requestBody = new
            {
                model,
                query,
                top_n = topn,
                documents
            };

            var content = new StringContent(JsonConvert.SerializeObject(requestBody), Encoding.UTF8,
                "application/json");

            var response = await client.PostAsync(baseUrl, content);

            if (response.IsSuccessStatusCode)
            {
                var responseString = await response.Content.ReadAsStringAsync();
                return JsonConvert.DeserializeObject<RerankerResponse>(responseString);
            }
            else
            {
                throw new HttpRequestException($"Error calling Jina AI API: {response.StatusCode}");
            }
        }
    }


    //------------------------------------通用私有函数---------------------------------

    private async Task<(string CosKey, string CosUrl)> DownloadAndUploadToCOS(string url, string baseSavePath,
        string fileType, string newFileName, string account, ICOSService cosService, ISystemService systemService)
    {
        if (string.IsNullOrEmpty(url))
            return (null, null);

        var fileExtension = Path.GetExtension(url);
        var fileName = $"{newFileName}{fileExtension}";
        var localFilePath = Path.Combine(baseSavePath, fileType);

        // 下载文件
        var filePath = await systemService.DownloadFileByUrl(url, localFilePath, account);

        // 上传到COS
        var cosKey = $"sunores/{DateTime.Now:yyyyMMdd}/{fileType}/{fileName}";
        var cosUrl = cosService.PutObject(cosKey, filePath, fileName);

        return (cosKey, cosUrl);
    }

    private async Task<string> DownloadToLocal(string url, string baseSavePath, string fileType, string newFileName,
        string account, ISystemService systemService)
    {
        if (string.IsNullOrEmpty(url))
            return null;

        var fileExtension = Path.GetExtension(url);
        var fileName = $"{newFileName}{fileExtension}";
        var localFilePath = Path.Combine(baseSavePath, fileType);

        // 下载文件
        await systemService.DownloadFileByUrl(url, localFilePath, account);

        // 返回相对路径
        return Path.Combine("files", "sunores", DateTime.Now.ToString("yyyyMMdd"), fileType, fileName);
    }

    private async Task<bool> IsVip(string account)
    {
        //查询用户是否是VIP
        var vip = await _context.VIPs.Where(x => x.Account == account).ToListAsync();
        //遍历VIP列表，如果有一个VIP未过期，则返回true
        if (vip.Count == 0) return false;
        foreach (var item in vip)
            if (item.EndTime > DateTime.Now)
                return true;
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

    private async Task<bool> CreateUseLogAndUpadteMoney(string account, string modelName, int inputCount,
        int outputCount, bool isdraw = false)
    {
        var user = _context.Users.Where(x => x.Account == account).FirstOrDefault();
        if (user == null) return false;
        decimal? realOutputMoney = 0m;
        //尝试从缓存中获取模型定价列表
        var modelPriceList = await GetModelPriceList();
        //根据模型名称获取模型定价
        var modelPrice = modelPriceList.Where(x => x.ModelName == modelName).FirstOrDefault();
        if (modelPrice != null) //如果不存在就是不扣费
        {
            //查询用户是否是VIP
            var vip = await IsVip(account);
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
            if (user.Mcoin < 0) user.Mcoin = 0;
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

    public APISetting CreateAPISetting(string aimodel)
    {
        var apiSetting = new APISetting();
        //var aImodels = _systemService.GetAImodel();
        //var aiModelInfo = aImodels.Where(x => x.ModelName == aimodel).FirstOrDefault();
        // if (aiModelInfo == null) throw new Exception("AI模型不存在");
        var systemCfg = _systemService.GetSystemCfgs();
        var apiKey = systemCfg.FirstOrDefault(x => x.CfgKey == "AICodeCheckApiKey").CfgValue;
        //标准化baseurl
        var baseUrl = systemCfg.FirstOrDefault(x => x.CfgKey == "AICodeCheckBaseUrl").CfgValue;
        try
        {
            if (baseUrl.EndsWith("/")) baseUrl = baseUrl.TrimEnd('/');
        }
        catch (Exception e)
        {
            throw e;
        }

        apiSetting.ApiKey = apiKey;
        apiSetting.BaseUrl = baseUrl;
        return apiSetting;
    }

    public int GetImageTokenCount(string imagePath, string modelName)
    {
        int width = 0, height = 0;

        // Load image and get width and height
        using (var image = LoadImage(imagePath))
        {
            width = image.Width;
            height = image.Height;
        }

        // Calculate tokens
        if (modelName.Contains("claude"))
        {
            return 2048;
        }
        else if (modelName.Contains("gpt"))
        {
            int blockWidth = 512;
            int blockHeight = 512;
            int tokenPerBlock = 255;

            // 如果图片小于或等于一个块的大小，直接返回一个块的token数
            if (width <= blockWidth && height <= blockHeight)
            {
                return tokenPerBlock;
            }

            // 计算完整的块数（向下取整）
            int blocksHorizontal = Math.Max(1, width / blockWidth);
            int blocksVertical = Math.Max(1, height / blockHeight);
            int totalBlocks = blocksHorizontal * blocksVertical;
            if (totalBlocks > 8)
                totalBlocks = 8;
            // 计算总token数
            int totalTokens = totalBlocks * tokenPerBlock;
            if (modelName.Contains("4o-mini"))
            {
                totalTokens = totalTokens * 33;
            }

            return totalTokens;
        }

        return 1024;
    }

    private static Image<Rgba32> LoadImage(string path)
    {
        if (IsBase64String(path))
        {
            // Remove the data URI scheme part if present
            string base64Data = path.Contains("base64,")
                ? path.Substring(path.IndexOf("base64,") + 7) // Remove "data:image/png;base64,"
                : path;

            byte[] imageBytes = Convert.FromBase64String(base64Data);
            using (var ms = new MemoryStream(imageBytes))
            {
                return Image.Load<Rgba32>(ms);
            }
        }
        else if (IsUrl(path))
        {
            using (WebClient wc = new WebClient())
            {
                byte[] imageData = wc.DownloadData(path);
                using (var ms = new MemoryStream(imageData))
                {
                    return Image.Load<Rgba32>(ms);
                }
            }
        }
        else if (File.Exists(path))
        {
            return Image.Load<Rgba32>(path);
        }
        else
        {
            throw new ArgumentException("Invalid image path provided.");
        }
    }

    private static bool IsBase64String(string s)
    {
        // Check if the string is a Base64 Data URI
        if (s.StartsWith("data:image", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        // Regular Base64 string validation, assuming it's a standard Base64 string
        s = s.Trim();
        return (s.Length % 4 == 0) && Convert.TryFromBase64String(s, new Span<byte>(new byte[s.Length]), out _);
    }

    private static bool IsUrl(string path)
    {
        return Uri.TryCreate(path, UriKind.Absolute, out Uri uriResult)
               && (uriResult.Scheme == Uri.UriSchemeHttp || uriResult.Scheme == Uri.UriSchemeHttps);
    }

    public async Task<List<SearchEngineResult>> SerperSearch(string query, string type = "global", int maxResults = 5)
    {
        var systemCfg = _systemService.GetSystemCfgs();
        var apiKey = systemCfg.FirstOrDefault(x => x.CfgKey == "SerperApiKey").CfgValue;
        var baseUrl = "https://google.serper.dev";
        var client = new HttpClient();
        var results = new List<SearchEngineResult>();
        var request = default(HttpRequestMessage);
        try
        {
            switch (type)
            {
                case "global":
                    request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/search");
                    break;
                case "scholar":
                    return await SearchArxivAsync(query);
                case "news":
                    request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/news");
                    break;
                case "image":
                    request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/images");
                    break;
                case "shopping":
                    request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/shopping");
                    break;
            }

            request.Headers.Add("X-API-KEY", apiKey);
            var content = new StringContent(
                JsonSerializer.Serialize(new { q = query }),
                Encoding.UTF8,
                "application/json");
            request.Content = content;

            var response = await client.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var jsonResponse = JsonDocument.Parse(await response.Content.ReadAsStringAsync());

            if (type == "image")
            {
                // 处理图片搜索结果
                var images = jsonResponse.RootElement.GetProperty("images");
                foreach (var image in images.EnumerateArray())
                {
                    results.Add(new SearchEngineResult
                    {
                        Title = image.GetProperty("title").GetString(),
                        Url = image.GetProperty("imageUrl").GetString()
                    });
                }
            }
            else
            {
                // 处理普通搜索结果
                var key = "organic";
                switch (type)
                {
                    case "global":
                        key = "organic";
                        break;
                    case "news":
                        key = "news";
                        break;
                    case "shopping":
                        key = "shopping";
                        break;
                }

                var organic = jsonResponse.RootElement.GetProperty(key);
                foreach (var item in organic.EnumerateArray())
                {
                    results.Add(new SearchEngineResult
                    {
                        Title = item.GetProperty("title").GetString(),
                        Url = item.GetProperty("link").GetString(),
                        Snippet = key == "shopping"
                            ? item.GetProperty("price").GetString()
                            : item.GetProperty("snippet").GetString()
                    });
                }
            }
        }
        catch (Exception ex)
        {
        }

        return results;
    }

    public async Task<string> CreateSearchKeyWordByHistory(string question, List<Message> messages,
        List<VisionChatMessage> visionChatMesssages,
        string model)
    {
        string historyChat = messages != null
            ? JsonConvert.SerializeObject(messages)
            : JsonConvert.SerializeObject(visionChatMesssages);

        string prompt = @$"
                    # Role: Expert in generating keywords for search engines
                    # Scenario: Generate keywords suitable for search engines based on user conversation records, understand the query requirements in the context of the problem
                    # Limitation: Only return keywords, without any punctuation or spaces, no explanations or extra words needed
                    # Language: Follow the conversation record
                    # User's new reply: {question}
                    # Conversation Record Json: {historyChat}";

        AiChat aiChat = CreateAiChat(model, prompt, false, false, false, "");
        APISetting apiSetting = CreateAPISetting(model);

        string result = string.Empty;
        int retryCount = 0;
        const int maxRetries = 3;

        while (retryCount < maxRetries)
        {
            try
            {
                result = await CallingAINotStream(aiChat, apiSetting);
                if (!string.IsNullOrEmpty(result))
                {
                    return result; // Return if result is not empty
                }
            }
            catch (Exception e)
            {
                await _systemService.WriteLog($"Error while calling AI: {e.Message}", Dtos.LogLevel.Error, "system");
                throw; // Optionally rethrow the exception if you want to handle it outside
            }

            retryCount++;
        }

        return result; // Return the empty result if all retries failed
    }

    public async Task<List<SearchEngineResult>> SearchArxivAsync(string query, int maxResults = 20)
    {
        var results = new List<SearchEngineResult>();
        try
        {
            var arxivUrl =
                $"http://export.arxiv.org/api/query?search_query=all:{Uri.EscapeDataString(query)}&start=0&max_results={maxResults}";
            var request = new HttpRequestMessage(HttpMethod.Get, arxivUrl);
            var client = new HttpClient();
            var arxivResponse = await client.SendAsync(request);
            arxivResponse.EnsureSuccessStatusCode();

            var xmlContent = await arxivResponse.Content.ReadAsStringAsync();
            var xmlDoc = new XmlDocument();
            xmlDoc.LoadXml(xmlContent);

            var nsMgr = new XmlNamespaceManager(xmlDoc.NameTable);
            nsMgr.AddNamespace("arxiv", "http://www.w3.org/2005/Atom");

            var entries = xmlDoc.SelectNodes("//arxiv:entry", nsMgr);

            if (entries != null)
            {
                foreach (XmlNode entry in entries)
                {
                    var title = entry.SelectSingleNode("arxiv:title", nsMgr)?.InnerText.Trim();
                    var summary = entry.SelectSingleNode("arxiv:summary", nsMgr)?.InnerText.Trim();
                    var pdfUrl = entry.SelectSingleNode("arxiv:id", nsMgr)?.InnerText.Trim();

                    if (!string.IsNullOrEmpty(pdfUrl))
                    {
                        // 将arXiv ID转换为PDF链接
                        pdfUrl = pdfUrl.Replace("abs", "pdf");
                        if (!pdfUrl.EndsWith(".pdf"))
                        {
                            pdfUrl += ".pdf";
                        }
                    }

                    results.Add(new SearchEngineResult
                    {
                        Title = title,
                        Url = pdfUrl,
                        Snippet = summary
                    });
                }
            }
        }
        catch (Exception ex)
        {
            // 适当的错误处理
            throw new Exception($"Arxiv search failed: {ex.Message}", ex);
        }

        return results;
    }

    public async Task<string> CreateSearchPrompt(string promptHeadle, List<Message> messages,
        List<VisionChatMessage> visionChatMesssages,
        string model)
    {
        if (string.IsNullOrEmpty(model))
        {
            var firstModel = _systemService.GetAImodel().FirstOrDefault();
            model = firstModel?.ModelName;
        }

        string searchKeyWord =
            await CreateSearchKeyWordByHistory(promptHeadle, messages, visionChatMesssages, model);
        //去除标点和空格
        searchKeyWord = !string.IsNullOrEmpty(searchKeyWord)
            ? Regex.Replace(searchKeyWord, @"[^\w\s]", "")
            : promptHeadle;
        var webSearchRes = new List<SearchEngineResult>();
        webSearchRes = await YahooSearch(searchKeyWord);
        if (webSearchRes.Count == 0)
            webSearchRes = await SerperSearch(searchKeyWord);
        if (webSearchRes != null)
        {
            promptHeadle +=
                @$"\n\n # You can refer to the following search engine results. In your response, please include the full link with the entire URL as a citation anywhere in the content.：
                   \n\n {JsonConvert.SerializeObject(webSearchRes)}";
        }

        return promptHeadle;
    }

    public async Task<List<ModelTokenUsage>> GetTokenUsage(string filterType)
    {
        DateTime startDate = DetermineStartDate(filterType);

        var query = _context.AImodels
            .GroupJoin(
                _context.UseUpLogs.Where(x => x.CreateTime >= startDate),
                model => model.ModelName,
                log => log.ModelName,
                (model, logs) => new { Model = model, Logs = logs }
            )
            .SelectMany(
                joinResult => joinResult.Logs.DefaultIfEmpty(),
                (joinResult, log) => new { joinResult.Model, Log = log }
            )
            .GroupBy(
                x => x.Model.ModelName,
                (key, group) => new ModelTokenUsage
                {
                    ModelName = key,
                    // 修复运算符优先级问题：先处理空值再除以1000
                    TokenUsage = Math.Round(
                        (group.Sum(x => x.Log == null ? 0m : x.Log.InputCount + x.Log.OutputCount) ?? 0m) / 1000m,
                        2)
                })
            .Where(x => x.TokenUsage > 0m);

        return await query.ToListAsync();
    }

    private DateTime DetermineStartDate(string filterType)
    {
        DateTime now = DateTime.Now;
        return filterType switch
        {
            "year" => new DateTime(now.Year, 1, 1),
            "month" => new DateTime(now.Year, now.Month, 1),
            "week" => now.Date.AddDays(-(int)now.DayOfWeek),
            _ => new DateTime(2022, 1, 1)
        };
    }

    public async Task<List<SearchEngineResult>> YahooSearch(string query, int maxResults = 5)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            throw new ArgumentException("Query cannot be null or empty.", nameof(query));
        }

        if (maxResults <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(maxResults), "maxResults must be greater than 0.");
        }


        // Encode the query
        string encodedQuery = HttpUtility.UrlEncode(query);
        string requestUrl = $"https://sg.search.yahoo.com/search?p={encodedQuery}&ei=UTF-8";

        using (HttpClient client = new HttpClient())
        {
            // client.DefaultRequestHeaders.Add("Host", "sg.search.yahoo.com");
            // client.DefaultRequestHeaders.Add("Connection", "keep-alive");
            // client.DefaultRequestHeaders.Add("User-Agent",
            //     "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:107.0) Gecko/20100101 Firefox/107.0");
            // client.DefaultRequestHeaders.Add("Accept",
            //     "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8");
            // client.DefaultRequestHeaders.Add("Accept-Language",
            //     "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2");

            try
            {
                // Make the request
                string response = await client.GetStringAsync(requestUrl);
                MatchCollection titleMatches =
                    Regex.Matches(response, "aria-label=\"([^\"]*)\"", RegexOptions.IgnoreCase);
                MatchCollection contentMatches = Regex.Matches(response,
                    "<span class=\"\\s*fc-falcon\\s*\"[^>]*>(.*?)</span>",
                    RegexOptions.IgnoreCase | RegexOptions.Singleline);
                MatchCollection urlMatches = Regex.Matches(response,
                    "<a[^>]*class=\"[^\"]*d-ib fz-20 lh-26[^\"]*\"[^>]*href=\"(https?:\\/\\/[^\\s\"]+)\"[^>]*>",
                    RegexOptions.IgnoreCase);


                // Create a list to store the results
                List<SearchEngineResult> results = new List<SearchEngineResult>();

                // Combine the matches into SearchEngineResult objects
                int count = Math.Min(maxResults,
                    Math.Min(titleMatches.Count,
                        Math.Min(contentMatches.Count,
                            urlMatches.Count))); //Important: Handle cases where counts differ
                for (int i = 0; i < count; i++)
                {
                    string title = titleMatches[i].Groups[1].Value;
                    string snippet = Regex.Replace(contentMatches[i].Groups[1].Value, "<.*?>", ""); // Remove HTML tags
                    string url = urlMatches[i].Groups[1].Value;

                    results.Add(new SearchEngineResult
                    {
                        Title = title,
                        Url = url,
                        Snippet = snippet
                    });
                }

                return results;
            }
            catch (HttpRequestException ex)
            {
                await _systemService.WriteLog($"Error during Yahoo search: {ex.Message}", Dtos.LogLevel.Error,
                    "system");
                return new List<SearchEngineResult>();
            }
            catch (RegexMatchTimeoutException ex) // Catch timeout exceptions during Regex
            {
                await _systemService.WriteLog($"Regex timeout during Yahoo search: {ex.Message}", Dtos.LogLevel.Error,
                    "system");
                return new List<SearchEngineResult>();
            }
            catch (Exception ex) // Catch other exceptions
            {
                await _systemService.WriteLog($"An unexpected error: {ex.Message}", Dtos.LogLevel.Error,
                    "system");
                return new List<SearchEngineResult>();
            }
        }
    }
}