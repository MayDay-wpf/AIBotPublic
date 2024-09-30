using System.Diagnostics;
using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Web;
using aibotPro.AppCode;
using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using AlibabaCloud.OpenApiClient.Models;
using AlibabaCloud.SDK.Captcha20230305;
using AlibabaCloud.SDK.Captcha20230305.Models;
using iTextSharp.text.pdf;
using iTextSharp.text.pdf.parser;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using OfficeOpenXml;
using RestSharp;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using Spire.Doc;
using Spire.Doc.Documents;
using Spire.Presentation;
using TiktokenSharp;
using FileFormat = Spire.Doc.FileFormat;
using Image = SixLabors.ImageSharp.Image;
using IShape = Spire.Presentation.IShape;
using LogLevel = aibotPro.Dtos.LogLevel;
using Path = System.IO.Path;
using Section = Spire.Doc.Section;

namespace aibotPro.Service;

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
        //获取系统配置
        var systemConfig = GetSystemCfgs();
        //var systemConfig = _httpContextAccessor.HttpContext?.Items["SystemConfig"] as List<SystemCfg>;
        var fromEmail = string.Empty;
        var mailPwd = string.Empty;
        var smtpServer = string.Empty;
        if (systemConfig != null)
        {
            fromEmail = systemConfig.Find(x => x.CfgKey == "Mail").CfgValue;
            mailPwd = systemConfig.Find(x => x.CfgKey == "MailPwd").CfgValue;
            smtpServer = systemConfig.Find(x => x.CfgKey == "SMTP_Server").CfgValue;
        }
        else
        {
            WriteLogUnAsync("系统配置表为空", LogLevel.Error, "system");
            return false;
        }

        var client = new SmtpClient(smtpServer, 587);
        client.EnableSsl = true;
        client.UseDefaultCredentials = false;
        client.Credentials = new NetworkCredential(fromEmail, mailPwd);
        // 创建电子邮件
        var mailMessage = new MailMessage(fromEmail, toemail, title, content);
        mailMessage.IsBodyHtml = true;
        try
        {
            // 发送邮件
            client.Send(mailMessage);
            return true;
        }
        catch (Exception ex)
        {
            WriteLogUnAsync(ex.Message, LogLevel.Error, "system");
            return false;
        }
    }

    public async Task WriteLog(string log, string logLevel, string CreateAccount)
    {
        var systemLog = new SystemLog();
        systemLog.LogTxt = log;
        systemLog.CreateTime = DateTime.Now;
        systemLog.CreateAccount = CreateAccount;
        systemLog.LogLevel = logLevel;
        await _context.SystemLogs.AddAsync(systemLog);
        await _context.SaveChangesAsync();
    }

    public void WriteLogUnAsync(string log, string logLevel, string CreateAccount)
    {
        var systemLog = new SystemLog();
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
        var code = new StringBuilder(length);
        var random = new Random();

        for (var i = 0; i < length; i++)
        {
            var index = random.Next(chars.Length);
            code.Append(chars[index]);
        }

        return code.ToString();
    }

    public Dictionary<string, string> GenerateCodeByImage()
    {
        try
        {
            var dic = new Dictionary<string, string>();
            var captchaCode = CaptchaGenerator.GenerateCaptchaCode();
            var base64Image = CaptchaGenerator.CreateCaptchaImageBase64(captchaCode);
            dic.Add(captchaCode, $"data:image/jpeg;base64,{base64Image}");
            return dic;
        }
        catch (Exception e)
        {
            WriteLogUnAsync(e.Message, LogLevel.Error, "system");
            throw new Exception(e.Message);
        }
    }

    public string ConvertToMD5(string str, int length = 16, bool lower = false)
    {
        //MD5加密
        MD5 md5 = new MD5CryptoServiceProvider();
        var result = md5.ComputeHash(Encoding.UTF8.GetBytes(str));
        var sb = new StringBuilder();
        for (var i = 0; i < result.Length; i++) sb.Append(result[i].ToString("x2"));

        if (lower)
            return sb.ToString().ToLower().Substring(0, length);
        return sb.ToString().Substring(0, length);
    }

    public bool SaveIP(string ip, string address)
    {
        //查询IP是否存在，今天是否已记录
        var iplook_this = _context.IPlooks
            .Where(x => x.IPv4 == ip && (x.LookTime == null || x.LookTime.Value.Date == DateTime.Now.Date))
            .FirstOrDefault();
        //如果存在，不处理，返回true
        if (iplook_this != null) return true;

        var iplook = new IPlook
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
        var aiModel_lst = new List<AImodel>();
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
        var aiModelSeq_lst = new List<AImodelsUserSeq>();
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

    public List<WorkShopModelUserSeq> GetWorkShopAImodelSeq(string account)
    {
        //尝试从Redis中获取AI模型序列
        var workAiModelSeq = _redis.GetAsync(account + "_workshopmodelSeq").Result;
        var workAiModelSeq_lst = new List<WorkShopModelUserSeq>();
        //如果Redis中没有AI模型序列信息，则从数据库加载AI模型序列信息
        if (string.IsNullOrEmpty(workAiModelSeq))
        {
            // 从数据库加载AI模型序列信息
            workAiModelSeq_lst = _context.WorkShopModelUserSeqs.Where(x => x.Account == account).ToList();
            // 将配置信息存入Redis以便后续使用
            _redis.SetAsync(account + "_workshopmodelSeq", JsonConvert.SerializeObject(workAiModelSeq_lst));
        }
        else
        {
            // 将配置信息从Redis中取出并反序列化
            workAiModelSeq_lst = JsonConvert.DeserializeObject<List<WorkShopModelUserSeq>>(workAiModelSeq);
        }

        return workAiModelSeq_lst;
    }

    public List<WorkShopAIModel> GetWorkShopAImodel()
    {
        var aiModel = _redis.GetAsync("WorkShopAImodel").Result;
        var aiModel_lst = new List<WorkShopAIModel>();
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
        var bytes = Encoding.UTF8.GetBytes(source);
        return Convert.ToBase64String(bytes);
    }

    public string DecodeBase64(string result)
    {
        var outputb = Convert.FromBase64String(result);
        return Encoding.UTF8.GetString(outputb);
    }

    public string SaveFiles(string path, IFormFile file, string Account = "")
    {
        Account = string.IsNullOrEmpty(Account) ? "system" : Account;
        //如果文件夹不存在则创建
        if (!Directory.Exists(path))
            Directory.CreateDirectory(path);
        //把路径融合进文件名以-分隔
        var fileName = Guid.NewGuid().ToString().Replace("-", "");
        var fileExtension = Path.GetExtension(file.FileName);
        var savePath = Path.Combine(path, fileName + fileExtension);
        using (var stream = new FileStream(savePath, FileMode.Create))
        {
            file.CopyTo(stream);
        }

        //写入日志
        WriteLogUnAsync($"文件{file.FileName}上传成功", LogLevel.Info, Account);
        //处理路径的反斜杠
        savePath = savePath.Replace("\\", "/");
        //返回文件相对路径
        return savePath;
    }

    public async Task<string> UploadFileToImageHosting(IFormFile file, string account = "")
    {
        account = string.IsNullOrEmpty(account) ? "system" : account;
        var systemConfig = GetSystemCfgs();
        var imgHost = systemConfig.FirstOrDefault(s => s.CfgKey == "ImageHosting");

        if (imgHost == null)
            throw new Exception("未配置“图床”服务");

        var imgHostUrl = imgHost.CfgValue;
        var client = new RestClient(imgHostUrl);
        var request = new RestRequest("", Method.Post);
        request.AddHeader("Accept", "*/*");
        request.AddHeader("Connection", "keep-alive");

        string newFileName = Guid.NewGuid().ToString() + Path.GetExtension(file.FileName); // 用GUID重命名文件

        using (var memoryStream = new MemoryStream())
        {
            await file.CopyToAsync(memoryStream);
            request.AddFile("file", memoryStream.ToArray(), newFileName, file.ContentType); // 使用新文件名上传
        }

        var response = await client.ExecuteAsync(request);
        if (response.IsSuccessful)
        {
            await WriteLog($"文件{file.FileName}上传成功--图床", LogLevel.Info, account);
            var responseContent = response.Content;
            var json = JsonDocument.Parse(responseContent);

            if (json.RootElement.TryGetProperty("code", out var codeElement) && codeElement.GetInt32() == 200)
            {
                if (json.RootElement.TryGetProperty("url", out var fileUrlElement))
                    return fileUrlElement.GetString();
            }
            else if (json.RootElement.TryGetProperty("msg", out var msgElement))
            {
                var errorMsg = msgElement.GetString();
                Debug.WriteLine($"文件上传失败: {errorMsg}");
            }
        }

        return null;
    }

    public async Task<string> ImgConvertToBase64(string imagePath)
    {
        byte[] imageBytes;

        if (Uri.IsWellFormedUriString(imagePath, UriKind.Absolute))
            // 处理图片链接
            using (var client = new HttpClient())
            {
                imageBytes = await client.GetByteArrayAsync(imagePath);
            }
        else
            // 处理本地文件路径
            imageBytes = File.ReadAllBytes(imagePath);

        var base64String = Convert.ToBase64String(imageBytes);
        return base64String;
    }

    public int TokenMath(string str, double divisor)
    {
        var result = 0;
        var tikToken = TikToken.GetEncoding("cl100k_base");
        result = (int)Math.Floor(tikToken.Encode(str).Count * divisor);
        return result;
    }

    public List<SystemCfg> GetSystemCfgs()
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

    public async Task<string> UploadFileChunkAsync(IFormFile file, int chunkNumber, string fileName,
        string filePathhead)
    {
        var folderName = Path.Combine(filePathhead, DateTime.Now.ToString("yyyyMMdd"));
        //如果文件夹不存在则创建
        if (!Directory.Exists(folderName))
            Directory.CreateDirectory(folderName);
        var filePath = Path.Combine(folderName, $"{chunkNumber}.tmp");
        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        return filePath;
    }

    public async Task<string> MergeFileAsync(string fileName, int totalChunks, string account, string filePathhead)
    {
        var folderName = Path.Combine(filePathhead, DateTime.Now.ToString("yyyyMMdd"));
        //如果文件夹不存在则创建
        if (!Directory.Exists(folderName))
            Directory.CreateDirectory(folderName);
        var finalPath = Path.Combine(folderName, fileName);

        using (var fs = new FileStream(finalPath, FileMode.Create))
        {
            for (var i = 1; i <= totalChunks; i++)
            {
                var tempFilePath = Path.Combine(folderName, $"{i}.tmp");
                var chunkBytes = await File.ReadAllBytesAsync(tempFilePath);
                await fs.WriteAsync(chunkBytes, 0, chunkBytes.Length);
                File.Delete(tempFilePath); // Optionally delete the chunk
            }
        }

        //记录日志
        await WriteLog($"文件{fileName}合并成功", LogLevel.Info, account);
        return finalPath; // Or return a relative URL/path as per your requirement
    }

    public async Task<bool> AlibabaCaptchaAsync(string captchaVerifyParam)
    {
        //获取系统配置
        var systemConfig = GetSystemCfgs();
        //获取AK,SK
        var ak = systemConfig.Find(x => x.CfgKey == "Alibaba_Captcha_AK").CfgValue;
        var sk = systemConfig.Find(x => x.CfgKey == "Alibaba_Captcha_SK").CfgValue;
        var endpoint = systemConfig.Find(x => x.CfgKey == "Alibaba_Captcha_Endpoint").CfgValue;
        var config = new Config
        {
            // 您的AccessKey ID
            AccessKeyId = ak,
            // 您的AccessKey Secret
            AccessKeySecret = sk,
            Endpoint = endpoint
        };
        var client = new Client(config);
        var request = new VerifyCaptchaRequest();
        request.CaptchaVerifyParam = captchaVerifyParam;
        var response = client.VerifyCaptcha(request);
        if (response.StatusCode == 200)
            return bool.Parse(response.Body.Result.VerifyResult.ToString());
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
        var fileType = Path.GetExtension(path);
        //如果是txt文件
        if (fileType == ".txt") return await File.ReadAllTextAsync(path);
        //如果是pdf文件
        if (fileType == ".pdf")
        {
            try
            {
                using (var reader = new PdfReader(path))
                {
                    var markdownContent = new StringBuilder();
                    for (var i = 1; i <= reader.NumberOfPages; i++)
                    {
                        try
                        {
                            // Extract text
                            string pageText = PdfTextExtractor.GetTextFromPage(reader, i);
                            markdownContent.AppendLine(pageText);
                            markdownContent.AppendLine(); // Add a blank line between pages
                            // Extract images
                            var pdfDictionary = reader.GetPageN(i);
                            var resources = pdfDictionary?.GetAsDict(PdfName.RESOURCES);
                            var xObject = resources?.GetAsDict(PdfName.XOBJECT);
                            if (xObject != null)
                            {
                                foreach (var name in xObject.Keys)
                                {
                                    try
                                    {
                                        var obj = xObject.GetAsStream(name);
                                        if (obj != null)
                                        {
                                            var subtype = obj.GetAsName(PdfName.SUBTYPE);
                                            if (subtype != null && subtype.Equals(PdfName.IMAGE))
                                            {
                                                var imgBytes = PdfReader.GetStreamBytesRaw((PRStream)obj);
                                                using (var ms = new MemoryStream(imgBytes))
                                                {
                                                    ms.Position = 0;
                                                    var formFile = new FormFile(ms, 0, ms.Length, "file",
                                                        $"{Guid.NewGuid().ToString()}.jpg")
                                                    {
                                                        Headers = new HeaderDictionary(),
                                                        ContentType = "image/jpeg"
                                                    };
                                                    var imageUrl = await UploadFileToImageHosting(formFile);
                                                    if (!string.IsNullOrEmpty(imageUrl))
                                                    {
                                                        markdownContent.AppendLine($"\n![Image]({imageUrl})\n");
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    catch (Exception ex)
                                    {
                                        await WriteLog(
                                            $"/SystemServer/GetFileText:Error processing XObject: {ex.Message}",
                                            Dtos.LogLevel.Error, "system");
                                    }
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                        }
                    }

                    return markdownContent.ToString();
                }
            }
            catch (Exception ex)
            {
            }
        }


        // 如果是Excel文件
        if (fileType == ".xlsx" || fileType == ".xls")
        {
            ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
            using (var stream = new FileStream(path, FileMode.Open))
            {
                using (var package = new ExcelPackage(stream))
                {
                    var excelText = new StringBuilder();
                    var worksheet = package.Workbook.Worksheets[0];
                    var rowCount = worksheet.Dimension.Rows;
                    var colCount = worksheet.Dimension.Columns;

                    for (var row = 1; row <= rowCount; row++)
                    {
                        for (var col = 1; col <= colCount; col++)
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

        if (fileType == ".pptx" || fileType == ".ppt")
            // 确保传入的文件不是null
            using (var memoryStream = new MemoryStream())
            {
                // 初始化Presentation类的实例
                using (var presentation = new Presentation())
                {
                    // 从内存流加载PowerPoint文档
                    presentation.LoadFromFile(path);
                    var sb = new StringBuilder();

                    // 遍历文档中的每张幻灯片
                    foreach (ISlide slide in presentation.Slides)
                        // 遍历每张幻灯片中的每个形状
                    foreach (IShape shape in slide.Shapes)
                        // 检查形状是否为IAutoShape类型
                        if (shape is IAutoShape autoShape)
                            // 以每种形状遍历所有段落
                            foreach (TextParagraph tp in autoShape.TextFrame.Paragraphs)
                                // 提取文本并保存到StringBuilder实例中
                                sb.AppendLine(tp.Text);

                    // 返回提取的文本
                    return sb.ToString();
                }
            }

        //如果是word
        if (fileType == ".docx" || fileType == ".doc")
        {
            // 确保文件不为空
            var extractedText = string.Empty;
            try
            {
                using (Stream stream = new FileStream(path, FileMode.Open))
                {
                    // 创建Document对象
                    var document = new Document();

                    // 加载Word文档
                    document.LoadFromStream(stream, FileFormat.Auto);

                    // 使用StringBuilder来保存提取的文本
                    var sb = new StringBuilder();

                    // 遍历文档中的段落
                    foreach (Section section in document.Sections)
                    foreach (Paragraph paragraph in section.Paragraphs)
                        // 提取段落中的文本
                        sb.AppendLine(paragraph.Text);

                    // 将提取的文本转换为字符串
                    extractedText = sb.ToString();
                }
            }
            catch (Exception ex)
            {
                // 处理异常
                await WriteLog(ex.Message, LogLevel.Error, "system");
            }

            return extractedText;
        }

        return "暂不支持该文件类型";
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
            WriteLogUnAsync(ex.Message, LogLevel.Error, "system");
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
            var user = new User
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
            var userSetting = new UserSetting();
            userSetting.Account = account;
            userSetting.UseHistory = 1;
            userSetting.GoodHistory = 1;
            userSetting.HistoryCount = 5;
            userSetting.Scrolling = 1;
            _context.UserSettings.Add(userSetting);
            //添加管理员
            var admin = new Admin
            {
                Account = account
            };
            _context.Admins.Add(admin);
            return _context.SaveChanges() > 0;
        }
        catch (Exception)
        {
            WriteLogUnAsync("创建管理员失败", LogLevel.Error, "system");
            return false;
        }
    }

    public string CompressImage(string inputFile, int quality)
    {
        var directory = Path.GetDirectoryName(inputFile);
        var fileName = Path.GetFileNameWithoutExtension(inputFile);
        var thumbFileName = $"thumbnails_{fileName}.jpg"; // 强制输出为 JPEG
        var thumbPath = Path.Combine(directory, thumbFileName);

        using (var image = Image.Load(inputFile))
        {
            var encoder = new JpegEncoder
            {
                Quality = quality
            };

            image.Save(thumbPath, encoder); // 强制保存为 JPEG 格式
        }

        return thumbPath;
    }

    public bool CreateSystemCfg()
    {
        var Mail = new SystemCfg
        {
            CfgName = "系统邮箱",
            CfgKey = "Mail",
            CfgCode = "Mail",
            CfgValue = "After"
        };
        var MailPwd = new SystemCfg
        {
            CfgName = "系统邮箱密码",
            CfgKey = "MailPwd",
            CfgCode = "MailPwd",
            CfgValue = "After"
        };
        var SMTP_Server = new SystemCfg
        {
            CfgName = "SMTP服务器地址",
            CfgKey = "SMTP_Server",
            CfgCode = "SMTP_Server",
            CfgValue = "smtp.googlemail.com"
        };
        var RegiestMcoin = new SystemCfg
        {
            CfgName = "注册赠送M币",
            CfgKey = "RegiestMcoin",
            CfgCode = "RegiestMcoin",
            CfgValue = "3"
        };
        var RegiestMail = new SystemCfg
        {
            CfgName = "注册邮箱后缀限制，删除或输入0则不限制，以逗号分隔",
            CfgKey = "RegiestMail",
            CfgCode = "RegiestMail",
            CfgValue = "qq.com,gmail.com,163.com,126.com,outlook.com"
        };
        var Baidu_TXT_AK = new SystemCfg
        {
            CfgName = "百度文字识别AccessKey",
            CfgKey = "Baidu_TXT_AK",
            CfgCode = "Baidu_TXT_AK",
            CfgValue = "After"
        };
        var Baidu_TXT_SK = new SystemCfg
        {
            CfgName = "百度文字识别SecretKey",
            CfgKey = "Baidu_TXT_SK",
            CfgCode = "Baidu_TXT_SK",
            CfgValue = "After"
        };
        var GoogleSearchApiKey = new SystemCfg
        {
            CfgName = "谷歌搜索ApiKey",
            CfgKey = "GoogleSearchApiKey",
            CfgCode = "GoogleSearchApiKey",
            CfgValue = "After"
        };
        var GoogleSearchEngineId = new SystemCfg
        {
            CfgName = "谷歌搜索引擎Id",
            CfgKey = "GoogleSearchEngineId",
            CfgCode = "GoogleSearchEngineId",
            CfgValue = "After"
        };
        var Alibaba_Captcha_AK = new SystemCfg
        {
            CfgName = "阿里巴巴滑动验证AccessKey(弃用)",
            CfgKey = "Alibaba_Captcha_AK",
            CfgCode = "Alibaba_Captcha_AK",
            CfgValue = "After"
        };
        var Alibaba_Captcha_SK = new SystemCfg
        {
            CfgName = "阿里巴巴滑动验证SecretKey(弃用)",
            CfgKey = "Alibaba_Captcha_SK",
            CfgCode = "Alibaba_Captcha_SK",
            CfgValue = "After"
        };
        var Alibaba_Captcha_Endpoint = new SystemCfg
        {
            CfgName = "阿里巴巴滑动验证Endpoint(弃用)",
            CfgKey = "Alibaba_Captcha_Endpoint",
            CfgCode = "Alibaba_Captcha_Endpoint",
            CfgValue = "After"
        };
        var Domain = new SystemCfg
        {
            CfgName = "系统域名",
            CfgKey = "Domain",
            CfgCode = "Domain",
            CfgValue = "After"
        };
        var Alibaba_DashVectorApiKey = new SystemCfg
        {
            CfgName = "阿里巴巴向量检索ApiKey(弃用)",
            CfgKey = "Alibaba_DashVectorApiKey",
            CfgCode = "Alibaba_DashVectorApiKey",
            CfgValue = "After"
        };
        var Alibaba_DashVectorEndpoint = new SystemCfg
        {
            CfgName = "阿里巴巴向量检索Endpoint(弃用)",
            CfgKey = "Alibaba_DashVectorEndpoint",
            CfgCode = "Alibaba_DashVectorEndpoint",
            CfgValue = "After"
        };
        var Alibaba_DashVectorCollectionName = new SystemCfg
        {
            CfgName = "阿里巴巴向量检索CollectionName(弃用)",
            CfgKey = "Alibaba_DashVectorCollectionName",
            CfgCode = "Alibaba_DashVectorCollectionName",
            CfgValue = "After"
        };
        var EmbeddingsUrl = new SystemCfg
        {
            CfgName = "嵌入AI模型BaseUrl",
            CfgKey = "EmbeddingsUrl",
            CfgCode = "EmbeddingsUrl",
            CfgValue = "After"
        };
        var EmbeddingsApiKey = new SystemCfg
        {
            CfgName = "嵌入AI模型ApiKey",
            CfgKey = "EmbeddingsApiKey",
            CfgCode = "EmbeddingsApiKey",
            CfgValue = "After"
        };
        var EmbeddingsModel = new SystemCfg
        {
            CfgName = "嵌入模型",
            CfgKey = "EmbeddingsModel",
            CfgCode = "EmbeddingsModel",
            CfgValue = "text-embedding-3-small"
        };
        var QAurl = new SystemCfg
        {
            CfgName = "数据清洗AI模型BaseUrl",
            CfgKey = "QAurl",
            CfgCode = "QAurl",
            CfgValue = "After"
        };
        var QAapiKey = new SystemCfg
        {
            CfgName = "数据清洗AI模型ApiKey",
            CfgKey = "QAapiKey",
            CfgCode = "QAapiKey",
            CfgValue = "After"
        };
        var QAmodel = new SystemCfg
        {
            CfgName = "QA清洗模型",
            CfgKey = "QAmodel",
            CfgCode = "QAmodel",
            CfgValue = "gpt-4o-mini"
        };
        var ShareMcoin = new SystemCfg
        {
            CfgName = "分享注册用户获得M币",
            CfgKey = "ShareMcoin",
            CfgCode = "ShareMcoin",
            CfgValue = "3"
        };
        var Baidu_OBJ_AK = new SystemCfg
        {
            CfgName = "百度场景识别AccessKey",
            CfgKey = "Baidu_OBJ_AK",
            CfgCode = "Baidu_OBJ_AK",
            CfgValue = "After"
        };
        var Baidu_OBJ_SK = new SystemCfg
        {
            CfgName = "百度场景识别SecretKey",
            CfgKey = "Baidu_OBJ_SK",
            CfgCode = "Baidu_OBJ_SK",
            CfgValue = "After"
        };
        var WorkShop_FreeModel = new SystemCfg
        {
            CfgName = "创意工坊免费模型",
            CfgKey = "WorkShop_FreeModel",
            CfgCode = "WorkShop_FreeModel",
            CfgValue = "0"
        };
        var WorkShop_FreeModel_Count = new SystemCfg
        {
            CfgName = "创意工坊免费模型可用次数(用户)",
            CfgKey = "WorkShop_FreeModel_Count",
            CfgCode = "WorkShop_FreeModel_Count",
            CfgValue = "0"
        };
        var WorkShop_FreeModel_Count_VIP = new SystemCfg
        {
            CfgName = "创意工坊免费模型可用次数(VIP)",
            CfgKey = "WorkShop_FreeModel_Count_VIP",
            CfgCode = "WorkShop_FreeModel_Count_VIP",
            CfgValue = "0"
        };
        var WorkShop_FreeModel_UpdateHour = new SystemCfg
        {
            CfgName = "创意工坊免费模型更新频率(小时)",
            CfgKey = "WorkShop_FreeModel_UpdateHour",
            CfgCode = "WorkShop_FreeModel_UpdateHour",
            CfgValue = "1"
        };
        var WorkFlow_Limit = new SystemCfg
        {
            CfgName = "流程引擎死循环保护的极限重复次数",
            CfgKey = "WorkFlow_Limit",
            CfgCode = "WorkFlow_Limit",
            CfgValue = "20"
        };
        var ImageHosting = new SystemCfg
        {
            CfgName = "“只是图床”API地址",
            CfgKey = "ImageHosting",
            CfgCode = "ImageHosting",
            CfgValue = ""
        };
        var ImageHostingByUrl = new SystemCfg
        {
            CfgName = "图床API地址(URL上传)",
            CfgKey = "ImageHostingByUrl",
            CfgCode = "ImageHostingByUrl",
            CfgValue = ""
        };
        var History_Prompt_AIModel = new SystemCfg
        {
            CfgName = "用于总结历史记录的AI模型名",
            CfgKey = "History_Prompt_AIModel",
            CfgCode = "History_Prompt_AIModel",
            CfgValue = "gpt-4o-mini"
        };
        var History_Prompt_Start_Compress = new SystemCfg
        {
            CfgName = "当用户启用历史总结时，开始压缩的对话数最小值，一问一答算一条对话",
            CfgKey = "History_Prompt_Start_Compress",
            CfgCode = "History_Prompt_Start_Compress",
            CfgValue = "4"
        };
        var History_Prompt_Keep_Quantity = new SystemCfg
        {
            CfgName = "当用户启用历史总结后，保留最近的几条对话数据，一问一答算一条对话",
            CfgKey = "History_Prompt_Keep_Quantity",
            CfgCode = "History_Prompt_Keep_Quantity",
            CfgValue = "1"
        };
        var Tokenize_BaseUrl_Jina = new SystemCfg
        {
            CfgName = "JinaAI分词器API地址",
            CfgKey = "Tokenize_BaseUrl_Jina",
            CfgCode = "Tokenize_BaseUrl_Jina",
            CfgValue = "https://tokenize.jina.ai"
        };
        var Tokenize_ApiKey_Jina = new SystemCfg
        {
            CfgName = "JinaAI分词器APIKEY(非必填，不填有RPM限制)",
            CfgKey = "Tokenize_ApiKey_Jina",
            CfgCode = "Tokenize_ApiKey_Jina",
            CfgValue = ""
        };
        var Rerank_BaseUrl_Jina = new SystemCfg
        {
            CfgName = "JinaAI重排器API地址",
            CfgKey = "Rerank_BaseUrl_Jina",
            CfgCode = "Rerank_BaseUrl_Jina",
            CfgValue = "https://api.jina.ai/v1/rerank"
        };
        var Rerank_ApiKey_Jina = new SystemCfg
        {
            CfgName = "JinaAI重排器APIKEY",
            CfgKey = "Rerank_ApiKey_Jina",
            CfgCode = "Rerank_ApiKey_Jina",
            CfgValue = ""
        };
        var AICodeCheckBaseUrl = new SystemCfg
        {
            CfgName = "Workflow代码检查模型URL（仅支持OpenAI API 且需要支持Jsonschema）",
            CfgKey = "AICodeCheckBaseUrl",
            CfgCode = "AICodeCheckBaseUrl",
            CfgValue = "https://api.openai.com"
        };
        var AICodeCheckApiKey = new SystemCfg
        {
            CfgName = "Workflow代码检查模型ApiKey（仅支持OpenAI API 且需要支持Jsonschema）",
            CfgKey = "AICodeCheckApiKey",
            CfgCode = "AICodeCheckApiKey",
            CfgValue = "openai apikey"
        };
        var AICodeCheckModel = new SystemCfg
        {
            CfgName = "Workflow代码检查模型Model（仅支持OpenAI API 且需要支持Jsonschema）",
            CfgKey = "AICodeCheckModel",
            CfgCode = "AICodeCheckModel",
            CfgValue = "gpt-4o-mini-2024-08-06"
        };
        var ReadingModelChunkLength = new SystemCfg
        {
            CfgName = "阅读模式下的最大文本字符数，超出将切片（该功能使用JinaAI分词器，最大64k）",
            CfgKey = "ReadingModelChunkLength",
            CfgCode = "ReadingModelChunkLength",
            CfgValue = "60000"
        };
        var ReadingModelMaxChunk = new SystemCfg
        {
            CfgName = "阅读模式允许的最大切片数（建议300）",
            CfgKey = "ReadingModelMaxChunk",
            CfgCode = "ReadingModelMaxChunk",
            CfgValue = "300"
        };
        var NewApiAccessToken = new SystemCfg
        {
            CfgName = "NewAPI Access Token",
            CfgKey = "NewApiAccessToken",
            CfgCode = "NewApiAccessToken",
            CfgValue = "After"
        };
        var NewApiUrl = new SystemCfg
        {
            CfgName = "NewAPI地址（含http或https请求头）",
            CfgKey = "NewApiUrl",
            CfgCode = "NewApiUrl",
            CfgValue = "After"
        };
        var GoogleClientID = new SystemCfg
        {
            CfgName = "Google登录客户端ID",
            CfgKey = "GoogleClientID",
            CfgCode = "GoogleClientID",
            CfgValue = "After"
        };
        _context.SystemCfgs.Add(Mail);
        _context.SystemCfgs.Add(MailPwd);
        _context.SystemCfgs.Add(SMTP_Server);
        _context.SystemCfgs.Add(RegiestMcoin);
        _context.SystemCfgs.Add(RegiestMail);
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
        _context.SystemCfgs.Add(EmbeddingsModel);
        _context.SystemCfgs.Add(QAurl);
        _context.SystemCfgs.Add(QAapiKey);
        _context.SystemCfgs.Add(QAmodel);
        _context.SystemCfgs.Add(ShareMcoin);
        _context.SystemCfgs.Add(Baidu_OBJ_AK);
        _context.SystemCfgs.Add(Baidu_OBJ_SK);
        _context.SystemCfgs.Add(WorkShop_FreeModel);
        _context.SystemCfgs.Add(WorkShop_FreeModel_Count);
        _context.SystemCfgs.Add(WorkShop_FreeModel_Count_VIP);
        _context.SystemCfgs.Add(WorkShop_FreeModel_UpdateHour);
        _context.SystemCfgs.Add(WorkFlow_Limit);
        _context.SystemCfgs.Add(ImageHosting);
        _context.SystemCfgs.Add(ImageHostingByUrl);
        _context.SystemCfgs.Add(History_Prompt_AIModel);
        _context.SystemCfgs.Add(History_Prompt_Start_Compress);
        _context.SystemCfgs.Add(History_Prompt_Keep_Quantity);
        _context.SystemCfgs.Add(Tokenize_BaseUrl_Jina);
        _context.SystemCfgs.Add(Tokenize_ApiKey_Jina);
        _context.SystemCfgs.Add(Rerank_BaseUrl_Jina);
        _context.SystemCfgs.Add(Rerank_ApiKey_Jina);
        _context.SystemCfgs.Add(AICodeCheckBaseUrl);
        _context.SystemCfgs.Add(AICodeCheckApiKey);
        _context.SystemCfgs.Add(AICodeCheckModel);
        _context.SystemCfgs.Add(ReadingModelChunkLength);
        _context.SystemCfgs.Add(ReadingModelMaxChunk);
        _context.SystemCfgs.Add(NewApiAccessToken);
        _context.SystemCfgs.Add(NewApiUrl);
        _context.SystemCfgs.Add(GoogleClientID);


        if (_context.SaveChanges() > 0)
        {
            //在系统根目录生成aibotinstall.lock 文件
            var lockFilePath =
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "aibotinstall.lock");
            try
            {
                if (!File.Exists(lockFilePath))
                    using (var lockFile = File.Create(lockFilePath))
                    {
                        // 写入一些内容到锁文件，可以是空内容或者一些标识信息
                        var content = Encoding.UTF8.GetBytes("Lock file created by the application.");
                        lockFile.Write(content, 0, content.Length);
                        return true;
                    }

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

        return false;
    }

    public bool SaveSystemUI(UISettingDto uISettingDto, string account)
    {
        //删除用户原有配置
        _context.UISettings.RemoveRange(_context.UISettings.Where(x => x.Account == account));
        //保存用户新配置
        var uISetting = new UISetting();
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
            var uISettingDto = new UISettingDto();
            foreach (var item in uISettingList)
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

            _redis.SetAsync(account + "_UISetting", JsonConvert.SerializeObject(uISettingDto));
            return uISettingDto;
        }

        return JsonConvert.DeserializeObject<UISettingDto>(uISetting);
    }

    public void CopyPropertiesTo<T, TU>(T source, TU dest)
    {
        var sourceProps = typeof(T).GetProperties().Where(x => x.CanRead).ToList();
        var destProps = typeof(TU).GetProperties()
            .Where(x => x.CanWrite && sourceProps.Any(sp => sp.Name == x.Name)).ToList();

        foreach (var sourceProp in sourceProps)
            if (destProps.Any(x => x.Name == sourceProp.Name))
            {
                var p = destProps.First(x => x.Name == sourceProp.Name);
                if (p.CanWrite) // 判断是否可写
                    // 将源对象的属性值赋给目标对象的同名属性
                    p.SetValue(dest, sourceProp.GetValue(source, null), null);
            }
    }

    public double CalculateTimeDifference(DateTime startTime, DateTime endTime)
    {
        // 计算时间差
        var timeDifference = endTime - startTime;

        // 将时间差转换为秒，并保留一位小数
        var seconds = Math.Round(timeDifference.TotalSeconds, 1);

        // 返回格式化的字符串
        return seconds;
    }

    public async Task<string> DownloadFileByUrl(string url, string savePath, string account)
    {
        try
        {
            using (var httpClient = new HttpClient(new HttpClientHandler { AllowAutoRedirect = true }))
            {
                // 添加用户代理
                httpClient.DefaultRequestHeaders.UserAgent.ParseAdd(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");

                // 添加授权头
                // httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "Your-Token-Here");

                var response = await httpClient.GetAsync(url);


                if (!response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    await WriteLog($"Error response content: {content}", Dtos.LogLevel.Error, account);
                    return null;
                }

                string fileName = Path.GetFileName(new Uri(url).LocalPath);
                if (string.IsNullOrEmpty(fileName))
                {
                    fileName = "downloadedFile_" + Guid.NewGuid().ToString("N");
                }

                string fullPath = Path.Combine(savePath, fileName);
                Directory.CreateDirectory(Path.GetDirectoryName(fullPath));

                using (var fileStream = new FileStream(fullPath, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    await response.Content.CopyToAsync(fileStream);
                }

                return fullPath;
            }
        }
        catch (HttpRequestException e)
        {
            await WriteLog($"HTTP Request Error: {e.Message}", Dtos.LogLevel.Error, account);
            return null;
        }
        catch (IOException e)
        {
            await WriteLog($"File I/O Error: {e.Message}", Dtos.LogLevel.Error, account);
            return null;
        }
        catch (Exception e)
        {
            await WriteLog($"An error occurred: {e.Message}", Dtos.LogLevel.Error, account);
            return null;
        }
    }

    private string SaveImage(Stream stream, string fileName, string savePath)
    {
        // 确保保存路径存在
        if (!Directory.Exists(savePath))
            Directory.CreateDirectory(savePath);

        // 组合完整的文件路径
        var filePath = Path.Combine(savePath, fileName);

        try
        {
            // 使用using语句确保FileStream在写入后被正确关闭和释放资源
            using (var fileStream = File.Create(filePath))
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
            WriteLogUnAsync($"Error saving image: {ex.Message}", LogLevel.Error, "system");
            // 可能需要根据实际情况决定是否要重新抛出异常或返回null/空字符串
            return null; // 或者 throw;
        }
    }
}