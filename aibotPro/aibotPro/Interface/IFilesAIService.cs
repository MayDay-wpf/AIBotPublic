using aibotPro.Models;
using System.Runtime.CompilerServices;

namespace aibotPro.Interface
{
    public interface IFilesAIService
    {
        bool SaveFilesLib(FilesLib filesLib);//保存文件库
        List<FilesLib> GetFilesLibs(int page, int pageSize, string name, out int total, string account = "");//分页获取文件库
        bool DeleteFilesLibs(string fileCode, string account);//删除文件库文件
        List<FoldersLib> GetFoldersLibs(string account);//获取文件夹列表
        bool SaveFolderLib(FoldersLib folderLib);//保存文件夹库   
        bool SaveFilesLibCloud(FilesLibCloud filesLibCloud);//保存云存储文件
        List<FilesLibCloud> GetFilesLibClouds(int page, int pageSize, string name, string folderCode, out int total, string account = "");//分页获取云存储文件
        bool DeleteFilesLibCloud(string fileCode, string account);//删除云存储文件
        bool DeleteFolderLib(string folderCode, string account);//删除文件夹
        Task<bool> UploadFileToCOS(string localFilePath, string cosKey, Action<int> progressCallback = null);//上传文件到COS
        FilesLibCloud GetFileLibCloudByCode(string fileCode, string username);//根据文件编码获取文件信息
    }
}
