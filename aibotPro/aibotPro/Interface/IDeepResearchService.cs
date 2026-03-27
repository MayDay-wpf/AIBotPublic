using aibotPro.Dtos;
using aibotPro.Models;

namespace aibotPro.Interface;

public interface IDeepResearchService
{
    Task<bool> SaveAIActiveAsync(string chatId, string account, string icon, string title,
        string activeContent,
        string status);

    Task<bool> CreateDeepResearchAsync(string chatId, string account, string title,
        List<string> selectedQuestions);

    Task<DeepOutline> CreateDeepResearchOutlineAsync(string chatId, string account, string title,
        List<string> selectedQuestions);

    Task<DeepResearchList> GetDeepResearch(string chatId, string account);

    Task UpdateProcess(string chatId, int process, string title);

    Task<OutLineShouldSearch> JudgeShouldSearchAsync(string chatId, string account, string title,
        string outlineMD);

    Task<string> GetJinaSearchResultAsync(List<string> keywords);

    Task<string> DeepResearchReportContentGenerateAsync(string chatId, string account, string title,
        string systemPrompt, string model, string webSearchResult = "");

    Task<bool> UpdateDeepResearchAsync(string chatId, string account, string content);

    Task<List<DeepResearchActiveList>> GetDeepResearchActivitiesAsync(string chatId, string account);

    Task<(List<DeepResearchList> items, int totalCount)> GetDeepResearchListAsync(string account, int page = 1, int pageSize = 10, string searchKeyword = "");

    Task<string> GetResearchReportContentAsync(string chatId, string account);

    Task<bool> SaveResearchReportContentAsync(string chatId, string account, string title, string content);

    Task<bool> DeleteDeepResearchAsync(string chatId, string account);

    Task<bool> HasRunningTasksAsync(string account);

    Task<List<DeepResearchChatHistory>> GetDeepResearchChatHistoryAsync(string deepResearchChatId, string account, int count = 3);

    Task<bool> SaveDeepResearchChatHistoryAsync(string chatId, string deepResearchChatId, string groupId, string account, string role, string chat, string think = "", bool isShow = true, string fileList = "", string imageList = "");
    Task<bool> DeepResearchBeforeCheck(string model, string account);
}