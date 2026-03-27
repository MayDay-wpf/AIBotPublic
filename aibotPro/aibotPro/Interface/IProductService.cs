using aibotPro.Dtos;
using aibotPro.Models;
using Betalgo.Ranul.OpenAI.ObjectModels.RequestModels;

namespace aibotPro.Interface
{
    public interface IProductService
    {
        List<VibeCodingModel> GetVibeCodingModels(); //获取所有的VibeCoding模型
        List<DeepResearchModel> GetDeepResearchModels(); //获取所有的深度研究模型

        Task<(bool, VibeCodingModel)> VibeCodingHubBeforeCheck(VibeCodingDto vibeCodingDto, string account,
            string sendMethod,
            string chatId); //对话前的检查

        Task<List<VibeCodingChatHistory>> GetVibeCodingChatHistory(string chatId, string account, bool useCache = true,
     int historyCount = 5); //获取VibeCoding对话记录

        Task<List<ChatMessage>> CreateVibeCodingChatMessage(string chatId, string account,
            VibeCodingDto vibeCodingDto, VibeCodingModel aiModel, bool newChat); //创建VibeCoding对话记录

        Task<bool> SaveHistory(string chatId, string chatGroupId, string model, string account, string question,
            string answer, string thinkmsg,
            bool shouldSave = true, string imageList = ""); //保存对话记录
            
        Task<List<VibeCodingChatHistory>> GetVibeCodingHistoriesList(string account, int pageIndex, int pageSize,
            string searchKey); //获取VibeCoding对话历史记录列表（分页）
            
        Task<List<VibeCodingChatHistory>> GetVibeCodingHistoryDetail(string chatId, string account); //根据chatId获取对话历史记录详情
        
        Task<bool> DeleteVibeCodingHistory(string chatId, string account); //根据chatId删除对话历史记录
    }
}