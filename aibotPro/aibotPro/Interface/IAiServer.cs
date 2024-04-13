using aibotPro.AppCode;
using aibotPro.Dtos;
using aibotPro.Models;

namespace aibotPro.Interface
{
    public interface IAiServer
    {
        IAsyncEnumerable<AiRes> CallingAI(AiChat aiChat, APISetting apiSetting, VisionBody visionBody = null);//调用AI接口（流式）
        Task<string> CallingAINotStream(string prompt, string model);//调用AI接口（非流式）
        Task<bool> SaveChatHistory(string account, string chatId, string content, string chatCode, string chatGroupId, string role, string model);//AI对话记录入库
        List<ChatHistory> GetChatHistories(string account, string chatId, int historyCount);//获取ai聊天记录
        Task<List<ChatHistory>> GetChatHistoriesList(string account, int pageIndex, int pageSize, string searchKey);//获取历史记录列表
        bool DelChatHistory(string account, string chatId);//删除聊天记录
        List<ChatHistory> ShowHistoryDetail(string account, string chatId);//查看ai聊天记录详情
        bool DelChatGroup(string account, string groupId);//删除对话组
        Task<string> CreateMJdraw(string prompt, string botType, string[] referenceImgPath, string baseUrl, string apiKey);//创建Midjourney画图任务
        Task<string> CreateMJchange(string changeType, int changeIndex, string taskId, string baseUrl, string apiKey);//创建Midjourney动作任务
        Task<string> CreateDALLdraw(string prompt, string imgSize, string quality, string baseUrl, string apiKey);//创建DALL-E画图任务
        Task<string> CreateDALLE2draw(string prompt, string imgSize, string baseUrl, string apiKey, int n = 1);//创建DALL-E画图任务
        Task<TaskResponse> GetMJTaskResponse(string taskId, string baseUrl, string apiKey);//获取任务状态

        Task DownloadImageAsync(string imageUrl, string savePath, string fileNameWithoutExtension);//下载图片

        Task<bool> SaveAiDrawResult(string account, string model, string savePath, string prompt, string referenceImgPath);//保存AI画图结果
        Task<List<SearchResult>> GetWebSearchResult(string query, string googleSearchApiKey, string googleSearchEngineId);//获取web搜索结果
        string AiGet(string url, Dictionary<string, object> dic, Dictionary<string, string> headers = null, Dictionary<string, string> cookies = null);//get请求
        string AiPost(string url, Dictionary<string, object> parameters, Dictionary<string, string> headers = null, Dictionary<string, string> cookies = null, string jsonBody = "");//post请求
        Task<List<AIdrawRe>> GetAIdrawResList(string account, int page, int pageSize);//获取AI画图结果列表

        Task<string> GPTJsonModel(string systemprompt, string prompt, string model, string account);//JsonModel-GPT

        Task<string> TTS(string text, string model, string voice);//TTS
    }
}
