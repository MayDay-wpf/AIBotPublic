using COSXML.Model.Object;

namespace aibotPro.Interface
{
    public interface ICOSService
    {
        string PutObject(string key, string srcPath, string fileName);
        bool DeleteObject(string key);
        // 切片上传相关方法
        string InitMultipartUpload(string key);
        string UploadPart(string key, string uploadId, int partNumber, string srcPath);
        bool CompleteMultipartUpload(string key, string uploadId, List<string> eTagList);
        bool AbortMultipartUpload(string key, string uploadId);
        string GetObjectUrl(string key);
        Task<Stream> GetObjectAsync(string key);
        bool DownloadObject(string key, string localFilePath);
    }
}
