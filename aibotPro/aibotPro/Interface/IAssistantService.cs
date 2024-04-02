using aibotPro.Dtos;
using aibotPro.Models;

namespace aibotPro.Interface
{
    public interface IAssistantService
    {
        List<AssistantModelPrice> GetAssistantModelPrices(string account = "", string modelname = "");//获取助理模型、API、价格
        List<AssistantGPT> GetAssistantGPTs(string account);//获取用户助理信息
        List<AssistantFile> GetAssistantFiles(string account);//获取用户助理文件
        List<ApiResponse> UploadAssistantFiles(string account, IFormFileCollection files);//上传文件到助理
        string SaveAssistant(string assisId, string assisName, string assisSysPrompt, string assisModel, int codeinterpreter, int retrieval, List<Dictionary<string, string>> files, string account);//保存助理
        bool DelFileByGPT(List<string> fileids);//删除助理文件
        Task<string> CreateThread();//创建助理线程
        Task<string> AddMessage(string threadId, string prompt);//向线程添加消息
        IAsyncEnumerable<AssistantReply> RunThread(string threadId, string assisId, string account);//启动线程

    }
}
