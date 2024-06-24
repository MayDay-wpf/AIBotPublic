using aibotPro.Dtos;
using aibotPro.Models;
using System.Threading.Tasks;
using System.Web;

namespace aibotPro.Interface
{
    public interface ISystemService
    {
        bool SendEmail(string toemail, string title, string content);//发送邮件
        Task WriteLog(string log, string logLevel, string CreateAccount);//写入日志
        void WriteLogUnAsync(string log, string logLevel, string CreateAccount);//写入日志
        string GenerateCode(int length);//生成验证码
        string ConvertToMD5(string str, int length = 16, bool lower = false);//MD5加密
        string EncodeBase64(string source); //字符串编码base64
        string DecodeBase64(string result); //字符串解码base64
        bool SaveIP(string ip, string address);//保存IP地址
        List<AImodel> GetAImodel();//获取AI模型
        List<AImodelsUserSeq> GetAImodelSeq(string account);//获取AI模型序列
        List<WorkShopAIModel> GetWorkShopAImodel();//获取插件基底模型
        string SaveFiles(string path, IFormFile file, string Account = ""); //保存文件到指定路径,返回图片路径
        Task<string> UploadFileToImageHosting(IFormFile file, string Account = "");//图片上传到“只是图床”
        Task<string> ImgConvertToBase64(string imagePath);//图片转base64
        int TokenMath(string str, double divisor);//计算token
        List<SystemCfg> GetSystemCfgs();//获取系统配置
        Task<string> UploadFileChunkAsync(IFormFile file, int chunkNumber, string fileName, string filePathhead);//上传文件分片
        Task<string> MergeFileAsync(string fileName, int totalChunks, string account, string filePathhead);//合并文件
        Task<bool> AlibabaCaptchaAsync(string captchaVerifyParam);//阿里巴巴验证码
        bool DeleteFile(string filePath);//删除文件
        Task<string> GetFileText(string path);//获取文件内容
        string UrlEncode(string text);//url编码
        string UrlDecode(string encodedText);//url解码
        bool CheckDataBaseServer();//检查数据库连接
        bool CheckRedis();//检查Redis连接
        bool CreateAdmin(string account, string password);//创建管理员
        bool CreateSystemCfg();//创建系统配置
        bool SaveSystemUI(UISettingDto uISettingDto, string account);//保存系统UI配置
        UISettingDto GetSystemUI(string account);//获取系统UI配置
        void CopyPropertiesTo<T, TU>(T source, TU dest);//反射赋值
        string CompressImage(string inputFile, int quality);//压缩图片质量，不改变尺寸
    }
}
