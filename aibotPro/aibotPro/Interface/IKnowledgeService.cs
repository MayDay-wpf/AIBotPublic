using aibotPro.Models;
using aibotPro.Service;

namespace aibotPro.Interface
{
    public interface IKnowledgeService
    {
        bool SaveKnowledgeFile(Knowledge knowledge);
        List<Knowledge> GetKnowledgeFiles(int page, int pageSize, string name, out int total, string account = "");//分页获取文件库
        bool DeleteKnowledgeFiles(string fileCode, string account);//删除文件库文件
        Task UploadKnowledgeToVector(string embModel, string processType, string aiModel, string filePath, string fileCode, string chunkLength, string account);//上传文件库文件到向量库
        bool DeleteVector(DelRoot delRoot);//删除向量库文件
        Task<string> SearchSchedule(string key);//查询进度
    }
}
