using aibotPro.Interface;
using COSXML.Common;
using COSXML.CosException;
using COSXML.Model.Object;
using COSXML.Utils;
using COSXML.Auth;
using COSXML;
using iTextSharp.text.pdf.parser;
namespace aibotPro.Service
{
    public class COSService : ICOSService
    {
        private readonly ISystemService _systemService;
        private static string region;
        private static string secretId;
        private static string secretKey;
        private static string bucket;

        public COSService(ISystemService systemService)
        {
            _systemService = systemService;
        }
        private CosXml CreateCosXml()
        {
            var systemCfg = _systemService.GetSystemCfgs();
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
                _systemService.DeleteFile(srcPath);
                
            }
            catch (CosClientException clientEx)
            {
                _systemService.WriteLogUnAsync("CosClientException: " + clientEx, Dtos.LogLevel.Error, "system");
            }
            catch (CosServerException serverEx)
            {
                _systemService.WriteLogUnAsync("CosServerException: " + serverEx.GetInfo(), Dtos.LogLevel.Error, "system");
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
                _systemService.WriteLogUnAsync("CosClientException: " + clientEx, Dtos.LogLevel.Error, "system");
            }
            catch (CosServerException serverEx)
            {
                _systemService.WriteLogUnAsync("CosServerException: " + serverEx.GetInfo(), Dtos.LogLevel.Error, "system");
            }
            return result;
        }
    }
}
