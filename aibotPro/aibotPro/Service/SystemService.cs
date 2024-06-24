using aibotPro.Interface;
using aibotPro.Models;
using AlibabaCloud.OpenApiClient.Models;
using AlibabaCloud.SDK.Captcha20230305;
using AlibabaCloud.SDK.Captcha20230305.Models;
using iTextSharp.text;
using iTextSharp.text.pdf;
using iTextSharp.text.pdf.parser;
using iTextSharp.text.pdf.security;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using OfficeOpenXml;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp;
using Spire.Presentation;
using System.Collections.Generic;
using System.ComponentModel;
using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Web;
using TiktokenSharp;
using static OpenAI.ObjectModels.SharedModels.IOpenAiModels;
using System.Numerics;
using aibotPro.Dtos;
using System.Collections;
using RestSharp;
using System.Drawing.Imaging;
using System.Drawing;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Formats;

namespace aibotPro.Service
{
    public class SystemService : ISystemService
    {
        //依赖注入AIbotProContext
        private readonly AIBotProContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IRedisService _redis;


        public SystemService(AIBotProContext context, IHttpContextAccessor httpContextAccessor, IRedisService redis)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
            _redis = redis;
        }
        public bool SendEmail(string toemail, string title, string content)
        {
            SmtpClient client = new SmtpClient("smtp.qq.com", 587);
            client.EnableSsl = true;
            client.UseDefaultCredentials = false;
            //获取系统配置
            List<SystemCfg> systemConfig = GetSystemCfgs();
            //var systemConfig = _httpContextAccessor.HttpContext?.Items["SystemConfig"] as List<SystemCfg>;
            string fromEmail = string.Empty;
            string mailPwd = string.Empty;
            if (systemConfig != null)
            {
                fromEmail = systemConfig.Find(x => x.CfgKey == "Mail").CfgValue;
                mailPwd = systemConfig.Find(x => x.CfgKey == "MailPwd").CfgValue;
            }
            else
            {
                WriteLogUnAsync("系统配置表为空", Dtos.LogLevel.Error, "system");
                return false;
            }
            client.Credentials = new NetworkCredential(fromEmail, mailPwd);
            // 创建电子邮件
            MailMessage mailMessage = new MailMessage(fromEmail, toemail, title, content);
            mailMessage.IsBodyHtml = true;
            try
            {
                // 发送邮件
                client.Send(mailMessage);
                return true;

            }
            catch (Exception ex)
            {
                WriteLogUnAsync(ex.Message, Dtos.LogLevel.Error, "system");
                return false;
            }
        }
        public async Task WriteLog(string log, string logLevel, string CreateAccount)
        {
            SystemLog systemLog = new SystemLog();
            systemLog.LogTxt = log;
            systemLog.CreateTime = DateTime.Now;
            systemLog.CreateAccount = CreateAccount;
            systemLog.LogLevel = logLevel;
            await _context.SystemLogs.AddAsync(systemLog);
            await _context.SaveChangesAsync();
        }
        public void WriteLogUnAsync(string log, string logLevel, string CreateAccount)
        {
            SystemLog systemLog = new SystemLog();
            systemLog.LogTxt = log;
            systemLog.CreateTime = DateTime.Now;
            systemLog.CreateAccount = CreateAccount;
            systemLog.LogLevel = logLevel;
            _context.SystemLogs.Add(systemLog);
            _context.SaveChanges();
        }
        public string GenerateCode(int length)
        {
            // 包含数字和小写字母的字符集
            const string chars = "abcdefghijklmnopqrstuvwxyz0123456789";
            StringBuilder code = new StringBuilder(length);
            Random random = new Random();

            for (int i = 0; i < length; i++)
            {
                int index = random.Next(chars.Length);
                code.Append(chars[index]);
            }

            return code.ToString();
        }
        public string ConvertToMD5(string str, int length = 16, bool lower = false)
        {
            //MD5加密
            MD5 md5 = new MD5CryptoServiceProvider();
            byte[] result = md5.ComputeHash(System.Text.Encoding.UTF8.GetBytes(str));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < result.Length; i++)
            {
                sb.Append(result[i].ToString("x2"));
            }
            if (lower)
                return sb.ToString().ToLower().Substring(0, length);
            else
                return sb.ToString().Substring(0, length);
        }
        public bool SaveIP(string ip, string address)
        {
            //查询IP是否存在，今天是否已记录
            var iplook_this = _context.IPlooks
                .Where(x => x.IPv4 == ip && (x.LookTime == null || x.LookTime.Value.Date == DateTime.Now.Date))
                .FirstOrDefault();
            //如果存在，不处理，返回true
            if (iplook_this != null)
            {
                return true;
            }
            IPlook iplook = new IPlook()
            {
                IPv4 = ip,
                Address = address,
                LookTime = DateTime.Now
            };
            _context.IPlooks.Add(iplook);
            _context.SaveChanges();
            return true;
        }
        public List<AImodel> GetAImodel()
        {
            var aiModel = _redis.GetAsync("AImodel").Result;
            List<AImodel> aiModel_lst = new List<AImodel>();
            //如果Redis中没有AI模型信息，则从数据库加载AI模型信息
            if (string.IsNullOrEmpty(aiModel))
            {
                // 从数据库加载AI模型信息
                aiModel_lst = _context.AImodels.ToList();
                //根据Seq排序
                aiModel_lst.Sort((x, y) => x.Seq.GetValueOrDefault().CompareTo(y.Seq));
                // 将配置信息存入Redis以便后续使用
                _redis.SetAsync("AImodel", JsonConvert.SerializeObject(aiModel_lst));
            }
            else
            {
                // 将配置信息从Redis中取出并反序列化
                aiModel_lst = JsonConvert.DeserializeObject<List<AImodel>>(aiModel);
                //根据Seq排序
                aiModel_lst.Sort((x, y) => x.Seq.GetValueOrDefault().CompareTo(y.Seq));
            }
            return aiModel_lst;
        }
        public List<AImodelsUserSeq> GetAImodelSeq(string account)
        {
            //尝试从Redis中获取AI模型序列
            var aiModelSeq = _redis.GetAsync(account + "_modelSeq").Result;
            List<AImodelsUserSeq> aiModelSeq_lst = new List<AImodelsUserSeq>();
            //如果Redis中没有AI模型序列信息，则从数据库加载AI模型序列信息
            if (string.IsNullOrEmpty(aiModelSeq))
            {
                // 从数据库加载AI模型序列信息
                aiModelSeq_lst = _context.AImodelsUserSeqs.Where(x => x.Account == account).ToList();
                // 将配置信息存入Redis以便后续使用
                _redis.SetAsync(account + "_modelSeq", JsonConvert.SerializeObject(aiModelSeq_lst));
            }
            else
            {
                // 将配置信息从Redis中取出并反序列化
                aiModelSeq_lst = JsonConvert.DeserializeObject<List<AImodelsUserSeq>>(aiModelSeq);
            }
            return aiModelSeq_lst;
        }
        public List<WorkShopAIModel> GetWorkShopAImodel()
        {
            var aiModel = _redis.GetAsync("WorkShopAImodel").Result;
            List<WorkShopAIModel> aiModel_lst = new List<WorkShopAIModel>();
            //如果Redis中没有AI模型信息，则从数据库加载AI模型信息
            if (string.IsNullOrEmpty(aiModel))
            {
                // 从数据库加载AI模型信息
                aiModel_lst = _context.WorkShopAIModels.ToList();
                // 将配置信息存入Redis以便后续使用
                _redis.SetAsync("WorkShopAImodel", JsonConvert.SerializeObject(aiModel_lst));
            }
            else
            {
                // 将配置信息从Redis中取出并反序列化
                aiModel_lst = JsonConvert.DeserializeObject<List<WorkShopAIModel>>(aiModel);
            }
            return aiModel_lst;
        }
        public string EncodeBase64(string source)
        {
            //非空判断
            if (string.IsNullOrEmpty(source))
                return string.Empty;
            byte[] bytes = Encoding.UTF8.GetBytes(source);
            return Convert.ToBase64String(bytes);
        }
        public string DecodeBase64(string result)
        {
            byte[] outputb = Convert.FromBase64String(result);
            return Encoding.UTF8.GetString(outputb);
        }
        public string SaveFiles(string path, IFormFile file, string Account = "")
        {
            Account = string.IsNullOrEmpty(Account) ? "system" : Account;
            //如果文件夹不存在则创建
            if (!Directory.Exists(path))
                Directory.CreateDirectory(path);
            //把路径融合进文件名以-分隔
            string fileName = Guid.NewGuid().ToString().Replace("-", "");
            string fileExtension = System.IO.Path.GetExtension(file.FileName);
            string savePath = System.IO.Path.Combine(path, fileName + fileExtension);
            using (var stream = new FileStream(savePath, FileMode.Create))
            {
                file.CopyTo(stream);
            }
            //写入日志
            WriteLogUnAsync($"文件{file.FileName}上传成功", Dtos.LogLevel.Info, Account);
            //处理路径的反斜杠
            savePath = savePath.Replace("\\", "/");
            //返回文件相对路径
            return savePath;
        }
        public async Task<string> UploadFileToImageHosting(IFormFile file, string Account = "")
        {
            Account = string.IsNullOrEmpty(Account) ? "system" : Account;
            List<SystemCfg> systemConfig = GetSystemCfgs();
            var imgHost = systemConfig.Where(s => s.CfgKey == "ImageHosting").FirstOrDefault();
            if (imgHost == null)
                throw new Exception("未配置“只是图床”服务");
            string imgHostUrl = imgHost.CfgValue;
            var client = new RestClient(imgHostUrl);
            var request = new RestRequest("", Method.Post);
            request.AddHeader("Accept", "*/*");
            request.AddHeader("Connection", "keep-alive");
            // Content-Type will be set by AddFile automatically
            using (var memoryStream = new System.IO.MemoryStream())
            {
                await file.CopyToAsync(memoryStream);
                request.AddFile("file", memoryStream.ToArray(), file.FileName, file.ContentType);
            }
            RestResponse response = await client.ExecuteAsync(request);
            if (response.IsSuccessful)
            {
                await WriteLog($"文件{file.FileName}上传成功--图床", Dtos.LogLevel.Info, Account);
                var responseContent = response.Content;
                var json = System.Text.Json.JsonDocument.Parse(responseContent);

                if (json.RootElement.TryGetProperty("code", out var codeElement) && codeElement.GetInt32() == 200)
                {
                    if (json.RootElement.TryGetProperty("url", out var fileUrlElement))
                    {
                        return fileUrlElement.GetString();
                    }
                }
                else if (json.RootElement.TryGetProperty("msg", out var msgElement))
                {
                    var errorMsg = msgElement.GetString();
                    System.Diagnostics.Debug.WriteLine($"File upload failed: {errorMsg}");
                }
            }

            return null;
        }
        public async Task<string> ImgConvertToBase64(string imagePath)
        {
            byte[] imageBytes;

            if (Uri.IsWellFormedUriString(imagePath, UriKind.Absolute))
            {
                // 处理图片链接
                using (HttpClient client = new HttpClient())
                {
                    imageBytes = await client.GetByteArrayAsync(imagePath);
                }
            }
            else
            {
                // 处理本地文件路径
                imageBytes = File.ReadAllBytes(imagePath);
            }

            string base64String = Convert.ToBase64String(imageBytes);
            return base64String;
        }
        public int TokenMath(string str, double divisor)
        {
            int result = 0;
            TikToken tikToken = TikToken.GetEncoding("cl100k_base");
            result = (int)Math.Floor(tikToken.Encode(str).Count * divisor);
            return result;
        }
        public List<SystemCfg> GetSystemCfgs()
        {
            List<SystemCfg> systemConfig = new List<SystemCfg>();
            var systemConfigStr = _redis.GetAsync("SystemConfig").Result;
            if (!string.IsNullOrEmpty(systemConfigStr))
                systemConfig = JsonConvert.DeserializeObject<List<SystemCfg>>(systemConfigStr);
            else
            {
                //从数据库加载系统配置信息
                systemConfig = _context.SystemCfgs.AsNoTracking().ToList();
            }
            return systemConfig;
        }

        public async Task<string> UploadFileChunkAsync(IFormFile file, int chunkNumber, string fileName, string filePathhead)
        {
            var folderName = System.IO.Path.Combine(filePathhead, DateTime.Now.ToString("yyyyMMdd"));
            //如果文件夹不存在则创建
            if (!Directory.Exists(folderName))
                Directory.CreateDirectory(folderName);
            var filePath = System.IO.Path.Combine(folderName, $"{chunkNumber}.tmp");
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return filePath;
        }

        public async Task<string> MergeFileAsync(string fileName, int totalChunks, string account, string filePathhead)
        {
            var folderName = System.IO.Path.Combine(filePathhead, DateTime.Now.ToString("yyyyMMdd"));
            //如果文件夹不存在则创建
            if (!Directory.Exists(folderName))
                Directory.CreateDirectory(folderName);
            var finalPath = System.IO.Path.Combine(folderName, fileName);

            using (var fs = new FileStream(finalPath, FileMode.Create))
            {
                for (int i = 1; i <= totalChunks; i++)
                {
                    var tempFilePath = System.IO.Path.Combine(folderName, $"{i}.tmp");
                    byte[] chunkBytes = await File.ReadAllBytesAsync(tempFilePath);
                    await fs.WriteAsync(chunkBytes, 0, chunkBytes.Length);
                    File.Delete(tempFilePath); // Optionally delete the chunk
                }
            }
            //记录日志
            await WriteLog($"文件{fileName}合并成功", Dtos.LogLevel.Info, account);
            return finalPath;  // Or return a relative URL/path as per your requirement
        }
        public async Task<bool> AlibabaCaptchaAsync(string captchaVerifyParam)
        {
            //获取系统配置
            var systemConfig = GetSystemCfgs();
            //获取AK,SK
            var ak = systemConfig.Find(x => x.CfgKey == "Alibaba_Captcha_AK").CfgValue;
            var sk = systemConfig.Find(x => x.CfgKey == "Alibaba_Captcha_SK").CfgValue;
            var endpoint = systemConfig.Find(x => x.CfgKey == "Alibaba_Captcha_Endpoint").CfgValue;
            Config config = new Config
            {
                // 您的AccessKey ID
                AccessKeyId = ak,
                // 您的AccessKey Secret
                AccessKeySecret = sk,
                Endpoint = endpoint
            };
            Client client = new Client(config);
            VerifyCaptchaRequest request = new VerifyCaptchaRequest();
            request.CaptchaVerifyParam = captchaVerifyParam;
            VerifyCaptchaResponse response = client.VerifyCaptcha(request);
            if (response.StatusCode == 200)
                return bool.Parse(response.Body.Result.VerifyResult.ToString());
            else
                return false;
        }
        //public async Task<string> CreateGraphicVerificationCode()
        //{
        //    var code = _securityCode.GetRandomEnDigitalText(4);
        //    var imgbyte = _securityCode.GetEnDigitalCodeByte(code);

        //}

        public bool DeleteFile(string filePath)
        {
            if (File.Exists(filePath))
            {
                File.Delete(filePath);
                return true;
            }
            //文件不存在就是删除
            return true;
        }
        public async Task<string> GetFileText(string path)
        {
            //判断文件类型
            string fileType = System.IO.Path.GetExtension(path);
            //如果是txt文件
            if (fileType == ".txt")
            {
                return await File.ReadAllTextAsync(path);
            }
            //如果是pdf文件
            else if (fileType == ".pdf")
            {
                using (PdfReader reader = new PdfReader(path))
                {
                    StringBuilder text = new StringBuilder();
                    for (int i = 1; i <= reader.NumberOfPages; i++)
                    {
                        text.Append(PdfTextExtractor.GetTextFromPage(reader, i));
                    }
                    return text.ToString();
                }
            }
            // 如果是Excel文件
            else if (fileType == ".xlsx" || fileType == ".xls")
            {
                ExcelPackage.LicenseContext = OfficeOpenXml.LicenseContext.NonCommercial;
                using (var stream = new FileStream(path, FileMode.Open))
                {
                    using (var package = new ExcelPackage(stream))
                    {
                        StringBuilder excelText = new StringBuilder();
                        var worksheet = package.Workbook.Worksheets[0];
                        int rowCount = worksheet.Dimension.Rows;
                        int colCount = worksheet.Dimension.Columns;

                        for (int row = 1; row <= rowCount; row++)
                        {
                            for (int col = 1; col <= colCount; col++)
                            {
                                var cellValue = worksheet.Cells[row, col].Value?.ToString();
                                excelText.Append("|");
                                excelText.Append(cellValue);
                            }
                            excelText.AppendLine("|");
                        }

                        return excelText.ToString();
                    }
                }
            }
            //如果是PPT
            else if (fileType == ".pptx" || fileType == ".ppt")
            {
                // 确保传入的文件不是null
                using (var memoryStream = new MemoryStream())
                {
                    // 初始化Presentation类的实例
                    using (var presentation = new Presentation())
                    {
                        // 从内存流加载PowerPoint文档
                        presentation.LoadFromFile(path);
                        StringBuilder sb = new StringBuilder();

                        // 遍历文档中的每张幻灯片
                        foreach (ISlide slide in presentation.Slides)
                        {
                            // 遍历每张幻灯片中的每个形状
                            foreach (Spire.Presentation.IShape shape in slide.Shapes)
                            {
                                // 检查形状是否为IAutoShape类型
                                if (shape is IAutoShape autoShape)
                                {
                                    // 以每种形状遍历所有段落
                                    foreach (TextParagraph tp in autoShape.TextFrame.Paragraphs)
                                    {
                                        // 提取文本并保存到StringBuilder实例中
                                        sb.AppendLine(tp.Text);
                                    }
                                }
                            }
                        }
                        // 返回提取的文本
                        return sb.ToString();
                    }
                }
            }
            //如果是word
            else if (fileType == ".docx" || fileType == ".doc")
            {
                // 确保文件不为空
                string extractedText = string.Empty;
                try
                {
                    using (Stream stream = new FileStream(path, FileMode.Open))
                    {
                        // 创建Document对象
                        Spire.Doc.Document document = new Spire.Doc.Document();

                        // 加载Word文档
                        document.LoadFromStream(stream, Spire.Doc.FileFormat.Auto);

                        // 使用StringBuilder来保存提取的文本
                        StringBuilder sb = new StringBuilder();

                        // 遍历文档中的段落
                        foreach (Spire.Doc.Section section in document.Sections)
                        {
                            foreach (Spire.Doc.Documents.Paragraph paragraph in section.Paragraphs)
                            {
                                // 提取段落中的文本
                                sb.AppendLine(paragraph.Text);
                            }
                        }

                        // 将提取的文本转换为字符串
                        extractedText = sb.ToString();
                    }
                }
                catch (Exception ex)
                {
                    // 处理异常
                    await WriteLog(ex.Message, Dtos.LogLevel.Error, "system");
                }
                return extractedText;
            }
            else
            {
                return "暂不支持该文件类型";
            }
        }
        private string SaveImage(Stream stream, string fileName, string savePath)
        {
            // 确保保存路径存在
            if (!Directory.Exists(savePath))
                Directory.CreateDirectory(savePath);

            // 组合完整的文件路径
            string filePath = System.IO.Path.Combine(savePath, fileName);

            try
            {
                // 使用using语句确保FileStream在写入后被正确关闭和释放资源
                using (FileStream fileStream = File.Create(filePath))
                {
                    // 将传入的流复制到文件流中，从而将数据写入文件
                    stream.CopyTo(fileStream);
                }

                // 返回处理过的文件路径（适用于URL）
                return filePath.Replace("\\", "/");
            }
            catch (Exception ex)
            {
                // 在异常情况下进行处理，记录日志信息
                WriteLogUnAsync($"Error saving image: {ex.Message}", Dtos.LogLevel.Error, "system");
                // 可能需要根据实际情况决定是否要重新抛出异常或返回null/空字符串
                return null;  // 或者 throw;
            }
        }
        public string UrlEncode(string text)
        {
            return HttpUtility.UrlEncode(text);
        }

        public string UrlDecode(string encodedText)
        {
            return HttpUtility.UrlDecode(encodedText);
        }
        public bool CheckDataBaseServer()
        {
            try
            {
                _context.Database.CanConnect();
                return true;
            }
            catch (Exception ex)
            {
                WriteLogUnAsync(ex.Message, Dtos.LogLevel.Error, "system");
                return false;
            }
        }
        public bool CheckRedis()
        {
            //检查Redis是否连接
            return _redis.CheckRedis();
        }
        public bool CreateAdmin(string account, string password)
        {
            try
            {
                //先创建用户
                User user = new User()
                {
                    Account = account,
                    Password = ConvertToMD5(password),
                    CreateTime = DateTime.Now,
                    Nick = "admin",
                    HeadImg = "/system/images/defaultHeadImg.png",
                    Sex = "unknow",
                    UserCode = GenerateCode(6),
                    IsBan = 0,
                    Mcoin = 999
                };
                _context.Users.Add(user);
                //设置用户默认设置
                UserSetting userSetting = new UserSetting();
                userSetting.Account = account;
                userSetting.UseHistory = 1;
                userSetting.GoodHistory = 1;
                userSetting.HistoryCount = 5;
                userSetting.Scrolling = 1;
                _context.UserSettings.Add(userSetting);
                //添加管理员
                Admin admin = new Admin()
                {
                    Account = account,
                };
                _context.Admins.Add(admin);
                return _context.SaveChanges() > 0;
            }
            catch (Exception)
            {
                WriteLogUnAsync("创建管理员失败", Dtos.LogLevel.Error, "system");
                return false;
            }
        }
        public string CompressImage(string inputFile, int quality)
        {
            string directory = System.IO.Path.GetDirectoryName(inputFile);
            string fileName = System.IO.Path.GetFileNameWithoutExtension(inputFile);
            string thumbFileName = $"thumbnails_{fileName}.jpg"; // 强制输出为 JPEG
            string thumbPath = System.IO.Path.Combine(directory, thumbFileName);

            using (SixLabors.ImageSharp.Image image = SixLabors.ImageSharp.Image.Load(inputFile))
            {
                var encoder = new SixLabors.ImageSharp.Formats.Jpeg.JpegEncoder
                {
                    Quality = quality
                };

                image.Save(thumbPath, encoder); // 强制保存为 JPEG 格式
            }

            return thumbPath;
        }
        public bool CreateSystemCfg()
        {
            SystemCfg Mail = new SystemCfg()
            {
                CfgName = "系统邮箱",
                CfgKey = "Mail",
                CfgCode = "Mail",
                CfgValue = "After"
            };
            SystemCfg MailPwd = new SystemCfg()
            {
                CfgName = "系统邮箱密码",
                CfgKey = "MailPwd",
                CfgCode = "MailPwd",
                CfgValue = "After"
            };
            SystemCfg RegiestMcoin = new SystemCfg()
            {
                CfgName = "注册赠送M币",
                CfgKey = "RegiestMcoin",
                CfgCode = "RegiestMcoin",
                CfgValue = "3"
            };
            SystemCfg Baidu_TXT_AK = new SystemCfg()
            {
                CfgName = "百度文字识别AccessKey",
                CfgKey = "Baidu_TXT_AK",
                CfgCode = "Baidu_TXT_AK",
                CfgValue = "After"
            };
            SystemCfg Baidu_TXT_SK = new SystemCfg()
            {
                CfgName = "百度文字识别SecretKey",
                CfgKey = "Baidu_TXT_SK",
                CfgCode = "Baidu_TXT_SK",
                CfgValue = "After"
            };
            SystemCfg GoogleSearchApiKey = new SystemCfg()
            {
                CfgName = "谷歌搜索ApiKey",
                CfgKey = "GoogleSearchApiKey",
                CfgCode = "GoogleSearchApiKey",
                CfgValue = "After"
            };
            SystemCfg GoogleSearchEngineId = new SystemCfg()
            {
                CfgName = "谷歌搜索引擎Id",
                CfgKey = "GoogleSearchEngineId",
                CfgCode = "GoogleSearchEngineId",
                CfgValue = "After"
            };
            SystemCfg Alibaba_Captcha_AK = new SystemCfg()
            {
                CfgName = "阿里巴巴滑动验证AccessKey(弃用)",
                CfgKey = "Alibaba_Captcha_AK",
                CfgCode = "Alibaba_Captcha_AK",
                CfgValue = "After"
            };
            SystemCfg Alibaba_Captcha_SK = new SystemCfg()
            {
                CfgName = "阿里巴巴滑动验证SecretKey(弃用)",
                CfgKey = "Alibaba_Captcha_SK",
                CfgCode = "Alibaba_Captcha_SK",
                CfgValue = "After"
            };
            SystemCfg Alibaba_Captcha_Endpoint = new SystemCfg()
            {
                CfgName = "阿里巴巴滑动验证Endpoint(弃用)",
                CfgKey = "Alibaba_Captcha_Endpoint",
                CfgCode = "Alibaba_Captcha_Endpoint",
                CfgValue = "After"
            };
            SystemCfg Domain = new SystemCfg()
            {
                CfgName = "系统域名",
                CfgKey = "Domain",
                CfgCode = "Domain",
                CfgValue = "After"
            };
            SystemCfg Alibaba_DashVectorApiKey = new SystemCfg()
            {
                CfgName = "阿里巴巴向量检索ApiKey(弃用)",
                CfgKey = "Alibaba_DashVectorApiKey",
                CfgCode = "Alibaba_DashVectorApiKey",
                CfgValue = "After"
            };
            SystemCfg Alibaba_DashVectorEndpoint = new SystemCfg()
            {
                CfgName = "阿里巴巴向量检索Endpoint(弃用)",
                CfgKey = "Alibaba_DashVectorEndpoint",
                CfgCode = "Alibaba_DashVectorEndpoint",
                CfgValue = "After"
            };
            SystemCfg Alibaba_DashVectorCollectionName = new SystemCfg()
            {
                CfgName = "阿里巴巴向量检索CollectionName(弃用)",
                CfgKey = "Alibaba_DashVectorCollectionName",
                CfgCode = "Alibaba_DashVectorCollectionName",
                CfgValue = "After"
            };
            SystemCfg EmbeddingsUrl = new SystemCfg()
            {
                CfgName = "嵌入AI模型BaseUrl",
                CfgKey = "EmbeddingsUrl",
                CfgCode = "EmbeddingsUrl",
                CfgValue = "After"
            };
            SystemCfg EmbeddingsApiKey = new SystemCfg()
            {
                CfgName = "嵌入AI模型ApiKey",
                CfgKey = "EmbeddingsApiKey",
                CfgCode = "EmbeddingsApiKey",
                CfgValue = "After"
            };
            SystemCfg QAurl = new SystemCfg()
            {
                CfgName = "(gpt3.5)数据清洗AI模型BaseUrl",
                CfgKey = "QAurl",
                CfgCode = "QAurl",
                CfgValue = "After"
            };
            SystemCfg ShareMcoin = new SystemCfg()
            {
                CfgName = "分享注册用户获得M币",
                CfgKey = "ShareMcoin",
                CfgCode = "ShareMcoin",
                CfgValue = "3"
            };
            SystemCfg Baidu_OBJ_AK = new SystemCfg()
            {
                CfgName = "百度场景识别AccessKey",
                CfgKey = "Baidu_OBJ_AK",
                CfgCode = "Baidu_OBJ_AK",
                CfgValue = "After"
            };
            SystemCfg Baidu_OBJ_SK = new SystemCfg()
            {
                CfgName = "百度场景识别SecretKey",
                CfgKey = "Baidu_OBJ_SK",
                CfgCode = "Baidu_OBJ_SK",
                CfgValue = "After"
            };
            SystemCfg WorkShop_FreeModel = new SystemCfg()
            {
                CfgName = "创意工坊免费模型",
                CfgKey = "WorkShop_FreeModel",
                CfgCode = "WorkShop_FreeModel",
                CfgValue = "0"
            };
            SystemCfg WorkShop_FreeModel_Count = new SystemCfg()
            {
                CfgName = "创意工坊免费模型可用次数(用户)",
                CfgKey = "WorkShop_FreeModel_Count",
                CfgCode = "WorkShop_FreeModel_Count",
                CfgValue = "0"
            };
            SystemCfg WorkShop_FreeModel_Count_VIP = new SystemCfg()
            {
                CfgName = "创意工坊免费模型可用次数(VIP)",
                CfgKey = "WorkShop_FreeModel_Count_VIP",
                CfgCode = "WorkShop_FreeModel_Count_VIP",
                CfgValue = "0"
            };
            SystemCfg WorkShop_FreeModel_UpdateHour = new SystemCfg()
            {
                CfgName = "创意工坊免费模型更新频率(小时)",
                CfgKey = "WorkShop_FreeModel_UpdateHour",
                CfgCode = "WorkShop_FreeModel_UpdateHour",
                CfgValue = "1"
            };
            SystemCfg WorkFlow_Limit = new SystemCfg()
            {
                CfgName = "流程引擎死循环保护的极限重复次数",
                CfgKey = "WorkFlow_Limit",
                CfgCode = "WorkFlow_Limit",
                CfgValue = "20"
            };
            SystemCfg ImageHosting = new SystemCfg()
            {
                CfgName = "“只是图床”API地址",
                CfgKey = "ImageHosting",
                CfgCode = "ImageHosting",
                CfgValue = "https://img.maymay5.com/api/upload"
            };
            _context.SystemCfgs.Add(Mail);
            _context.SystemCfgs.Add(MailPwd);
            _context.SystemCfgs.Add(RegiestMcoin);
            _context.SystemCfgs.Add(Baidu_TXT_AK);
            _context.SystemCfgs.Add(Baidu_TXT_SK);
            _context.SystemCfgs.Add(GoogleSearchApiKey);
            _context.SystemCfgs.Add(GoogleSearchEngineId);
            _context.SystemCfgs.Add(Alibaba_Captcha_AK);
            _context.SystemCfgs.Add(Alibaba_Captcha_SK);
            _context.SystemCfgs.Add(Alibaba_Captcha_Endpoint);
            _context.SystemCfgs.Add(Domain);
            _context.SystemCfgs.Add(Alibaba_DashVectorApiKey);
            _context.SystemCfgs.Add(Alibaba_DashVectorEndpoint);
            _context.SystemCfgs.Add(Alibaba_DashVectorCollectionName);
            _context.SystemCfgs.Add(EmbeddingsUrl);
            _context.SystemCfgs.Add(EmbeddingsApiKey);
            _context.SystemCfgs.Add(QAurl);
            _context.SystemCfgs.Add(ShareMcoin);
            _context.SystemCfgs.Add(Baidu_OBJ_AK);
            _context.SystemCfgs.Add(Baidu_OBJ_SK);
            _context.SystemCfgs.Add(WorkShop_FreeModel);
            _context.SystemCfgs.Add(WorkShop_FreeModel_Count);
            _context.SystemCfgs.Add(WorkShop_FreeModel_Count_VIP);
            _context.SystemCfgs.Add(WorkShop_FreeModel_UpdateHour);
            _context.SystemCfgs.Add(WorkFlow_Limit);
            _context.SystemCfgs.Add(ImageHosting);


            if (_context.SaveChanges() > 0)
            {
                //在系统根目录生成aibotinstall.lock 文件
                string lockFilePath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "aibotinstall.lock");
                try
                {
                    if (!File.Exists(lockFilePath))
                    {
                        using (FileStream lockFile = File.Create(lockFilePath))
                        {
                            // 写入一些内容到锁文件，可以是空内容或者一些标识信息
                            byte[] content = Encoding.UTF8.GetBytes("Lock file created by the application.");
                            lockFile.Write(content, 0, content.Length);
                            return true;
                        }
                    }
                    else
                        return false;
                }
                catch (UnauthorizedAccessException)
                {
                    return false;
                }
                catch (IOException)
                {
                    return false;
                }
            }
            else
                return false;
        }

        public bool SaveSystemUI(UISettingDto uISettingDto, string account)
        {
            //删除用户原有配置
            _context.UISettings.RemoveRange(_context.UISettings.Where(x => x.Account == account));
            //保存用户新配置
            UISetting uISetting = new UISetting();
            uISetting.Account = account;
            uISetting.SettingKey = "SystemName";
            uISetting.SettingValue = uISettingDto.SystemName;
            _context.UISettings.Add(uISetting);
            uISetting.SettingKey = "BackgroundImg";
            uISetting.SettingValue = uISettingDto.BackgroundImg;
            _context.UISettings.Add(uISetting);
            uISetting.SettingKey = "MenuTransparency";
            uISetting.SettingValue = uISettingDto.MenuTransparency;
            _context.UISettings.Add(uISetting);
            uISetting.SettingKey = "ContentTransparency";
            uISetting.SettingValue = uISettingDto.ContentTransparency;
            _context.UISettings.Add(uISetting);
            uISetting.SettingKey = "ColorPicker";
            uISetting.SettingValue = uISettingDto.ColorPicker;
            _context.UISettings.Add(uISetting);
            uISetting.SettingKey = "ShadowSize";
            uISetting.SettingValue = uISettingDto.ShadowSize;
            _context.UISettings.Add(uISetting);
            //写入缓存
            _redis.SetAsync(account + "_UISetting", JsonConvert.SerializeObject(uISettingDto));
            _context.SaveChanges();
            return true;
        }
        public UISettingDto GetSystemUI(string account)
        {
            var uISetting = _redis.GetAsync(account + "_UISetting").Result;
            if (string.IsNullOrEmpty(uISetting))
            {
                var uISettingList = _context.UISettings.Where(x => x.Account == account).ToList();
                UISettingDto uISettingDto = new UISettingDto();
                foreach (var item in uISettingList)
                {
                    switch (item.SettingKey)
                    {
                        case "SystemName":
                            uISettingDto.SystemName = item.SettingValue;
                            break;
                        case "BackgroundImg":
                            uISettingDto.BackgroundImg = item.SettingValue;
                            break;
                        case "MenuTransparency":
                            uISettingDto.MenuTransparency = item.SettingValue;
                            break;
                        case "ContentTransparency":
                            uISettingDto.ContentTransparency = item.SettingValue;
                            break;
                        case "ColorPicker":
                            uISettingDto.ColorPicker = item.SettingValue;
                            break;
                        case "ShadowSize":
                            uISettingDto.ShadowSize = item.SettingValue;
                            break;
                    }
                }
                _redis.SetAsync(account + "_UISetting", JsonConvert.SerializeObject(uISettingDto));
                return uISettingDto;
            }
            else
            {
                return JsonConvert.DeserializeObject<UISettingDto>(uISetting);
            }
        }
        public void CopyPropertiesTo<T, TU>(T source, TU dest)
        {
            var sourceProps = typeof(T).GetProperties().Where(x => x.CanRead).ToList();
            var destProps = typeof(TU).GetProperties()
                .Where(x => x.CanWrite && sourceProps.Any(sp => sp.Name == x.Name)).ToList();

            foreach (var sourceProp in sourceProps)
            {
                if (destProps.Any(x => x.Name == sourceProp.Name))
                {
                    var p = destProps.First(x => x.Name == sourceProp.Name);
                    if (p.CanWrite) // 判断是否可写
                    {
                        // 将源对象的属性值赋给目标对象的同名属性
                        p.SetValue(dest, sourceProp.GetValue(source, null), null);
                    }
                }
            }
        }
    }
}
