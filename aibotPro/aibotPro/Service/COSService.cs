using aibotPro.Interface;
using aibotPro.Models;
using COSXML.Common;
using COSXML.CosException;
using COSXML.Model.Object;
using COSXML.Utils;
using COSXML.Auth;
using COSXML;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;

namespace aibotPro.Service
{
    public class COSService : ICOSService
    {
        private readonly AIBotProContext _context;
        private readonly IRedisService _redis;
        private static string region;
        private static string secretId;
        private static string secretKey;
        private static string bucket;

        public COSService(AIBotProContext context, IRedisService redis)
        {
            _context = context;
            _redis = redis;
        }

        private List<SystemCfg> GetSystemCfgs()
        {
            var systemConfig = new List<SystemCfg>();
            var systemConfigStr = _redis.GetAsync("SystemConfig").Result;
            if (!string.IsNullOrEmpty(systemConfigStr))
                systemConfig = JsonConvert.DeserializeObject<List<SystemCfg>>(systemConfigStr);
            else
                //从数据库加载系统配置信息
                systemConfig = _context.SystemCfgs.AsNoTracking().ToList();

            return systemConfig;
        }

        private async Task WriteLogAsync(string log, string logLevel, string createAccount)
        {
            try
            {
                var logEntity = new SystemLog
                {
                    LogLevel = logLevel,
                    LogTxt = log,
                    CreateTime = DateTime.Now,
                    CreateAccount = createAccount
                };
                _context.SystemLogs.Add(logEntity);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                // 记录日志失败时的处理，避免无限循环
                Console.WriteLine($"记录日志失败: {ex.Message}");
            }
        }

        private bool DeleteFile(string filePath)
        {
            if (File.Exists(filePath))
            {
                File.Delete(filePath);
                return true;
            }
            //文件不存在就是删除
            return true;
        }

        private CosXml CreateCosXml()
        {
            var systemCfg = GetSystemCfgs();
            region = systemCfg.FirstOrDefault(x => x.CfgKey == "COS_Region")?.CfgValue;
            secretId = systemCfg.FirstOrDefault(x => x.CfgKey == "COS_SecretId")?.CfgValue;
            secretKey = systemCfg.FirstOrDefault(x => x.CfgKey == "COS_SecretKey")?.CfgValue;
            bucket = systemCfg.FirstOrDefault(x => x.CfgKey == "COS_Bucket")?.CfgValue;
            long durationSecond = 600;
            CosXmlConfig config = new CosXmlConfig.Builder()
                .SetRegion(region) // 设置默认的区域
                .Build();

            QCloudCredentialProvider qCloudCredentialProvider = new DefaultQCloudCredentialProvider(secretId, secretKey, durationSecond);
            return new CosXmlServer(config, qCloudCredentialProvider);
        }

        public string PutObject(string key, string srcPath, string fileName)
        {
            string result = string.Empty;
            try
            {
                CosXml cosXml = CreateCosXml();
                PutObjectRequest request = new PutObjectRequest(bucket, key, srcPath);
                var res = cosXml.PutObject(request);
                result = $"https://{bucket}.cos.{region}.myqcloud.com/{key}";
                //删除本地文件
                DeleteFile(srcPath);

            }
            catch (CosClientException clientEx)
            {
                _ = WriteLogAsync("CosClientException: " + clientEx, "Error", "system");
            }
            catch (CosServerException serverEx)
            {
                _ = WriteLogAsync("CosServerException: " + serverEx.GetInfo(), "Error", "system");
            }
            return result;
        }

        public bool DeleteObject(string key)
        {
            bool result = false;
            try
            {
                CosXml cosXml = CreateCosXml();
                DeleteObjectRequest request = new DeleteObjectRequest(bucket, key);
                //执行请求
                DeleteObjectResult res = cosXml.DeleteObject(request);
                result = true;
            }
            catch (CosClientException clientEx)
            {
                _ = WriteLogAsync("CosClientException: " + clientEx, "Error", "system");
            }
            catch (CosServerException serverEx)
            {
                _ = WriteLogAsync("CosServerException: " + serverEx.GetInfo(), "Error", "system");
            }
            return result;
        }

        // 初始化分片上传
        public string InitMultipartUpload(string key)
        {
            string uploadId = string.Empty;
            try
            {
                CosXml cosXml = CreateCosXml();
                InitMultipartUploadRequest request = new InitMultipartUploadRequest(bucket, key);
                InitMultipartUploadResult result = cosXml.InitMultipartUpload(request);
                uploadId = result.initMultipartUpload.uploadId;
            }
            catch (CosClientException clientEx)
            {
                _ = WriteLogAsync("COS初始化分片上传失败: " + clientEx, "Error", "system");
            }
            catch (CosServerException serverEx)
            {
                _ = WriteLogAsync("COS初始化分片上传失败: " + serverEx.GetInfo(), "Error", "system");
            }
            return uploadId;
        }

        // 上传分片
        public string UploadPart(string key, string uploadId, int partNumber, string srcPath)
        {
            string eTag = string.Empty;
            try
            {
                CosXml cosXml = CreateCosXml();
                UploadPartRequest request = new UploadPartRequest(bucket, key, partNumber, uploadId, srcPath, 0, -1);
                UploadPartResult result = cosXml.UploadPart(request);
                eTag = result.eTag;
            }
            catch (CosClientException clientEx)
            {
                _ = WriteLogAsync($"COS上传分片{partNumber}失败: " + clientEx, "Error", "system");
            }
            catch (CosServerException serverEx)
            {
                _ = WriteLogAsync($"COS上传分片{partNumber}失败: " + serverEx.GetInfo(), "Error", "system");
            }
            return eTag;
        }

        // 完成分片上传
        public bool CompleteMultipartUpload(string key, string uploadId, List<string> eTagList)
        {
            bool result = false;
            try
            {
                CosXml cosXml = CreateCosXml();
                CompleteMultipartUploadRequest request = new CompleteMultipartUploadRequest(bucket, key, uploadId);

                // 设置已上传的分片信息，必须有序，按照partNumber递增
                for (int i = 0; i < eTagList.Count; i++)
                {
                    if (!string.IsNullOrEmpty(eTagList[i]))
                    {
                        request.SetPartNumberAndETag(i + 1, eTagList[i]);
                    }
                }

                CompleteMultipartUploadResult completeResult = cosXml.CompleteMultiUpload(request);
                result = true;
            }
            catch (CosClientException clientEx)
            {
                _ = WriteLogAsync("COS完成分片上传失败: " + clientEx, "Error", "system");
            }
            catch (CosServerException serverEx)
            {
                _ = WriteLogAsync("COS完成分片上传失败: " + serverEx.GetInfo(), "Error", "system");
            }
            return result;
        }

        // 取消分片上传
        public bool AbortMultipartUpload(string key, string uploadId)
        {
            bool result = false;
            try
            {
                CosXml cosXml = CreateCosXml();
                AbortMultipartUploadRequest request = new AbortMultipartUploadRequest(bucket, key, uploadId);
                AbortMultipartUploadResult abortResult = cosXml.AbortMultiUpload(request);
                result = true;
            }
            catch (CosClientException clientEx)
            {
                _ = WriteLogAsync("COS取消分片上传失败: " + clientEx, "Error", "system");
            }
            catch (CosServerException serverEx)
            {
                _ = WriteLogAsync("COS取消分片上传失败: " + serverEx.GetInfo(), "Error", "system");
            }
            return result;
        }

        // 获取对象URL
        public string GetObjectUrl(string key)
        {
            return $"https://{bucket}.cos.{region}.myqcloud.com/{key}";
        }

        // 获取对象流
        public async Task<Stream> GetObjectAsync(string key)
        {
            try
            {
                CosXml cosXml = CreateCosXml();

                // 创建临时文件路径
                string localDir = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "cosdownload");
                if (!Directory.Exists(localDir))
                {
                    Directory.CreateDirectory(localDir);
                }

                string localFileName = Guid.NewGuid().ToString();
                string localFilePath = System.IO.Path.Combine(localDir, localFileName);

                // 创建请求对象
                GetObjectRequest request = new GetObjectRequest(bucket, key, localDir, localFileName);

                // 执行请求
                GetObjectResult result = cosXml.GetObject(request);

                // 检查请求是否成功
                if (result.httpCode == 200)
                {
                    // 创建文件流并设置为在读取完成后删除文件
                    FileStream fileStream = new FileStream(localFilePath, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, FileOptions.DeleteOnClose);
                    return fileStream;
                }
                else
                {
                    await WriteLogAsync($"获取COS对象失败，HTTP状态码: {result.httpCode}", "Error", "system");
                    return null;
                }
            }
            catch (CosClientException clientEx)
            {
                await WriteLogAsync("获取COS对象流失败(客户端异常): " + clientEx, "Error", "system");
                return null;
            }
            catch (CosServerException serverEx)
            {
                await WriteLogAsync("获取COS对象流失败(服务端异常): " + serverEx.GetInfo(), "Error", "system");
                return null;
            }
            catch (Exception ex)
            {
                await WriteLogAsync("获取COS对象流失败(通用异常): " + ex.Message, "Error", "system");
                return null;
            }
        }

        public bool DownloadObject(string key, string localFilePath)
        {
            bool result = false;
            try
            {
                CosXml cosXml = CreateCosXml();

                // 确保目标目录存在
                string directory = System.IO.Path.GetDirectoryName(localFilePath);
                if (!Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                // 创建请求对象
                string localDir = System.IO.Path.GetDirectoryName(localFilePath);
                string localFileName = System.IO.Path.GetFileName(localFilePath);

                GetObjectRequest request = new GetObjectRequest(bucket, key, localDir, localFileName);

                // 执行请求
                GetObjectResult getResult = cosXml.GetObject(request);

                // 检查请求是否成功
                if (getResult.httpCode == 200)
                {
                    result = true;
                }
                else
                {
                    _ = WriteLogAsync($"下载COS对象失败，HTTP状态码: {getResult.httpCode}", "Error", "system");
                }
            }
            catch (CosClientException clientEx)
            {
                _ = WriteLogAsync("下载COS对象失败(客户端异常): " + clientEx, "Error", "system");
            }
            catch (CosServerException serverEx)
            {
                _ = WriteLogAsync("下载COS对象失败(服务端异常): " + serverEx.GetInfo(), "Error", "system");
            }
            catch (Exception ex)
            {
                _ = WriteLogAsync("下载COS对象失败(通用异常): " + ex.Message, "Error", "system");
            }
            return result;
        }
    }
}
