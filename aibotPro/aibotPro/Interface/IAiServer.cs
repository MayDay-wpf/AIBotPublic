using aibotPro.AppCode;
using aibotPro.Dtos;
using aibotPro.Models;
using RestSharp;
using System.Runtime.CompilerServices;
using iTextSharp.text;

namespace aibotPro.Interface
{
    public interface IAiServer
    {
        IAsyncEnumerable<AiRes> CallingAI(AiChat aiChat, APISetting apiSetting, string chatId,
            VisionBody visionBody = null,
            [EnumeratorCancellation] CancellationToken cancellationToken = default); //调用AI接口（流式）

        Task<string>
            CallingAINotStream(AiChat aiChat, APISetting apiSetting, VisionBody visionBody = null,
                bool returnObject = false); //调用AI接口（非流式）

        Task<bool> SaveChatHistory(string account, string chatId, string content, string chatCode, string chatGroupId,
            string role, string model, string firstTime = "", string allTime = "", int islock = 0); //AI对话记录入库

        List<ChatHistory>
            GetChatHistories(string account, string chatId, int historyCount, bool coder = false); //获取ai聊天记录

        Task<List<ChatHistory>>
            GetChatHistoriesList(string account, int pageIndex, int pageSize, string searchKey); //获取历史记录列表

        Task<bool> UpdateAllChatTitlesByChatIdAsync(string account, string chatId, string chatTitle); //更新消息标题
        bool DelChatHistory(string account, string chatId); //删除聊天记录
        List<ChatHistory> ShowHistoryDetail(string account, string chatId); //查看ai聊天记录详情
        bool DelChatGroup(string account, string groupId, int type); //删除对话组

        Task<string> CreateMJdraw(string prompt, string botType, string[] referenceImgPath, string baseUrl,
            string apiKey, string drawmodel); //创建Midjourney画图任务

        Task<string> CreateMJdrawByBlend(string botType, List<string> blendImages, string baseUrl, string apiKey,
            string drawmodel, string dimensions); //创建Midjourney-Blend画图任务

        Task<string> CreateMJdrawBySwap(string botType, string baseUrl, string apiKey, string drawmodel,
            string yourFace, string starFace); //创建Midjourney-Swap画图任务

        Task<string> CreateMJchange(string changeType, int changeIndex, string taskId, string baseUrl, string apiKey,
            string drawmodel); //创建Midjourney动作任务

        Task<string>
            CreateDALLdraw(string prompt, string imgSize, string quality, string baseUrl, string apiKey); //创建DALL-E画图任务

        Task<string>
            CreateDALLE2draw(string prompt, string imgSize, string baseUrl, string apiKey, int n = 1); //创建DALL-E画图任务

        Task<SDResponse> CreateSDdraw(string prompt, string model, string imageSize, int numberImages, int seed,
            int inferenceSteps, float guidanceScale, string negativePrompt, string apiKey, string baseUrl,
            string Channel); //创建SD画图任务

        Task<TaskResponse> GetMJTaskResponse(string taskId, string baseUrl, string apiKey); //获取任务状态

        Task DownloadImageAsync(string imageUrl, string savePath, string fileNameWithoutExtension); //下载图片

        Task<bool> SaveAiDrawResult(string account, string model, string savePath, string prompt,
            string referenceImgPath, string thumbSavePath, string thumbKey); //保存AI画图结果

        Task<List<SearchResult>> GetWebSearchResult(string query, string googleSearchApiKey,
            string googleSearchEngineId); //获取web搜索结果

        string AiGet(string url, Dictionary<string, object> dic, Dictionary<string, string> headers = null,
            Dictionary<string, string> cookies = null); //get请求

        string AiPost(string url, Dictionary<string, object> parameters, Dictionary<string, string> headers = null,
            Dictionary<string, string> cookies = null, string jsonBody = ""); //post请求

        Task<List<AIdrawRe>> GetAIdrawResList(string account, int page, int pageSize, string role = ""); //获取AI画图结果列表

        Task<string> GPTJsonModel(string systemprompt, string prompt, string model, string account); //JsonModel-GPT
        Task<string> GPTJsonSchema(string prompt, string schema, string model, string account); //JsonSchema-GPT

        public AiChat CreateAiChat(string aimodel, string prompt, bool stream, bool jsonModel, bool jsonSchema,
            string jsonSchemaInput); //创建AI对话请求体

        public VisionBody CreateVisionBody(string aimodel, string prompt, string imgurl, bool stream, bool jsonModel,
            bool jsonSchema, string jsonSchemaInput); //创建多模态AI对话请求体

        APISetting CreateAPISetting(string aimodel); //创建AI对话请求头
        Task<string> TTS(string text, string model, string voice); //TTS

        Task ExecuteFunctionWithLoadingIndicators(string fnName, string chatId, string senMethod,
            CancellationToken cancellationToken);

        Task<string> UnDoubletreating(PluginResDto pluginResDto, string chatId, string senMethod);

        Task<bool> SaveMemory(string aimodel, string account, string chatgroupId, string chatId); //存入记忆
        RestRequest CreateRequest(string model, string input, string embeddingsapikey); //创建嵌入请求
        Task<Dtos.SearchVectorResultByMilvus> GetMemory(string aimodel, string account, string prompt); //获取记忆

        Task<string>
            CreateHistoryPrompt(List<Message> messages,
                List<VisionChatMessage> visionChatMesssages = null); //总结历史记录生成Prompt

        Task<string> CreateSunoTask(string mode, string gptDescription, string prompt, string tags, string mv,
            string title, string baseUrl, string apiKey, string account); //创建suno任务

        Task<SunoTaskResponse> GetSunoTask(string taskId, string account, string baseUrl, string apiKey); //获取Suno任务结果

        Task<TokenizerDetail> TokenizeJinaAI(string count, int fixedlength, string tokenizer = "cl100k_base",
            bool returnchunks = true, bool returntokens = false); //JinaAI分词切片器

        Task<RerankerResponse> RerankerJinaAI(List<string> documents, string query, int topn); //JinaAI重排器
        int GetImageTokenCount(string imagePath, string modelName); //计算图片tokens

        Task<List<SearchEngineResult>>
            SerperSearch(string query, string type = "global", int maxResults = 5); //Serper搜索

        Task<List<SearchEngineResult>> YahooSearch(string query, int maxResults = 5); //Yahoo搜索

        Task<string> CreateSearchKeyWordByHistory(string question, List<Message> messages,
            List<VisionChatMessage> visionChatMesssages,
            string model); //根据对话记录生成搜索引擎关键词

        Task<string> CreateSearchPrompt(string promptHeadle, List<Message> messages,
            List<VisionChatMessage> visionChatMesssages,
            string model); //创建搜索引擎Prompt

        Task<List<ModelTokenUsage>> GetTokenUsage(string filterType); //获取全站模型token使用量
    }
}