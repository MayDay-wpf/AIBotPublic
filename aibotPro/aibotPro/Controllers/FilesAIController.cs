using aibotPro.ChatService;
using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace aibotPro.Controllers
{
    public class FilesAIController : Controller
    {
        private readonly ISystemService _systemService;
        private readonly JwtTokenManager _jwtTokenManager;
        private readonly IFilesAIService _filesAIService;
        private readonly ICOSService _cosService;
        private readonly IRedisService _redisService;
        private readonly AIBotProContext _context;
        public FilesAIController(ISystemService systemService, JwtTokenManager jwtTokenManager, IFilesAIService filesAIService, ICOSService cosService, IRedisService redisService, AIBotProContext context)
        {
            _systemService = systemService;
            _jwtTokenManager = jwtTokenManager;
            _filesAIService = filesAIService;
            _cosService = cosService;
            _redisService = redisService;
            _context = context;
        }
        public IActionResult FilesChat()
        {
            return View();
        }
        public IActionResult FilesLib()
        {
            return View();
        }
        public IActionResult FilesLibCloud()
        {
            return View();
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> Upload([FromForm] IFormFile file, [FromForm] int chunkNumber, [FromForm] string fileName)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("请选择文件");
            }

            var systemCfgs = _systemService.GetSystemCfgs();
            var allowedFileTypes = systemCfgs.FirstOrDefault(x => x.CfgKey == "Allowed_File_Types");
            List<string> allowedExtensions;
            if (allowedFileTypes != null && !string.IsNullOrWhiteSpace(allowedFileTypes.CfgValue))
            {
                // 从配置中获取允许的文件类型,并转换为小写
                allowedExtensions = allowedFileTypes.CfgValue.Split(',')
                    .Select(x => x.Trim().ToLowerInvariant())
                    .ToList();
            }
            else
            {
                // 如果配置为空,使用默认值
                allowedExtensions = new List<string> { ".txt", ".pdf", ".ppt", ".doc", ".docx", ".xls", ".xlsx" };
            }

            var fileExtension = Path.GetExtension(fileName).ToLowerInvariant();

            if (!allowedExtensions.Contains(fileExtension))
            {
                var allowedTypesMessage =
                    string.Join(", ", allowedExtensions.Select(ext => ext.TrimStart('.')).ToArray());
                return BadRequest($"只允许上传以下类型的文件: {allowedTypesMessage}");
            }

            var path = await _systemService.UploadFileChunkAsync(file, chunkNumber, fileName, "wwwroot/files/fileslib");
            return Ok(new { path });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> MergeFiles([FromBody] MergeRequest request)
        {
            var uniqueFileName = Guid.NewGuid().ToString() + "_" + request.FileName; // 使用 GUID 生成唯一文件名
            //获取用户名
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var path = await _systemService.MergeFileAsync(uniqueFileName, request.TotalChunks, username, "wwwroot/files/fileslib");
            FilesLib filesLib = new FilesLib();
            filesLib.FileCode = Guid.NewGuid().ToString();
            filesLib.Account = username;
            filesLib.FileName = request.FileName;
            filesLib.FilePath = path.Replace("wwwroot", "");
            filesLib.FileType = Path.GetExtension(path);
            filesLib.CreateTime = DateTime.Now;
            _filesAIService.SaveFilesLib(filesLib);
            return Ok(new
            {
                fileName = request.FileName,
                fileCode = filesLib.FileCode,
                path = path
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult GetFilesLibs(int page, int pageSize, string name)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            int total = 0;
            var listFilesLibs = _filesAIService.GetFilesLibs(page, pageSize, name, out total, username);
            return Ok(new { success = true, data = listFilesLibs, total });
        }
        [Authorize]
        [HttpPost]
        public IActionResult DeleteFilesLibs(string fileCode)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            _filesAIService.DeleteFilesLibs(fileCode, username);
            return Ok(new
            {
                success = true
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult GetFoldersLibs()
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var listFoldersLibs = _filesAIService.GetFoldersLibs(username);
            return Ok(new { success = true, data = listFoldersLibs });
        }

        [Authorize]
        [HttpPost]
        public IActionResult CreateFolder(string folderName, string parentCode)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var folderLib = new FoldersLib();
            folderLib.Account = username;
            folderLib.FolderCode = Guid.NewGuid().ToString();
            folderLib.CreateTime = DateTime.Now;
            folderLib.FolderName = folderName;
            folderLib.ParentCode = parentCode;

            var result = _filesAIService.SaveFolderLib(folderLib);
            return Ok(new { success = result, folderCode = folderLib.FolderCode });
        }
        // 添加以下方法
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> UploadCloud([FromForm] IFormFile file, [FromForm] int chunkNumber, [FromForm] string fileName, [FromForm] string folderCode)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("请选择文件");
            }
            //文件限制大小300M
            if (file.Length > 300 * 1024 * 1024)
            {
                return BadRequest("文件大小不能超过300M");
            }
            var systemCfgs = _systemService.GetSystemCfgs();
            var allowedFileTypes = systemCfgs.FirstOrDefault(x => x.CfgKey == "Allowed_FileCloud_Types");
            List<string> allowedExtensions;
            if (allowedFileTypes != null && !string.IsNullOrWhiteSpace(allowedFileTypes.CfgValue))
            {
                // 从配置中获取允许的文件类型,并转换为小写
                allowedExtensions = allowedFileTypes.CfgValue.Split(',')
                    .Select(x => x.Trim().ToLowerInvariant())
                    .ToList();
            }
            else
            {
                // 如果配置为空,使用默认值
                allowedExtensions = new List<string> { ".txt", ".pdf", ".ppt", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png", ".gif", ".mp3", ".mp4" };
            }

            var fileExtension = Path.GetExtension(fileName).ToLowerInvariant();

            if (!allowedExtensions.Contains(fileExtension))
            {
                var allowedTypesMessage =
                    string.Join(", ", allowedExtensions.Select(ext => ext.TrimStart('.')).ToArray());
                return BadRequest($"只允许上传以下类型的文件: {allowedTypesMessage}");
            }

            var path = await _systemService.UploadFileChunkAsync(file, chunkNumber, fileName, "wwwroot/files/filescloud");
            return Ok(new { path });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> MergeFilesCloud([FromBody] MergeCloudRequest request)
        {
            var uniqueFileName = request.FileCode + "_" + request.FileName; // 使用 GUID 生成唯一文件名
            //获取用户名
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var path = await _systemService.MergeFileAsync(uniqueFileName, request.TotalChunks, username, "wwwroot/files/filescloud");

            // 获取文件大小
            var fileInfo = new FileInfo(path);
            var fileSize = fileInfo.Length / 1024.0m; // 转换为KB

            FilesLibCloud filesLibCloud = new FilesLibCloud();
            filesLibCloud.FileCode = request.FileCode;
            filesLibCloud.Account = username;
            filesLibCloud.FileName = request.FileName;
            filesLibCloud.FilePath = path.Replace("wwwroot", "");
            filesLibCloud.FileType = Path.GetExtension(path);
            filesLibCloud.FileSize = fileSize;
            filesLibCloud.FolderCode = request.FolderCode;
            filesLibCloud.FullFolderCode = request.FullFolderCode;
            filesLibCloud.CreateTime = DateTime.Now;
            _filesAIService.SaveFilesLibCloud(filesLibCloud);

            return Ok(new
            {
                success = true,
                fileName = request.FileName,
                fileCode = filesLibCloud.FileCode,
                path = path
            });
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> MergeFilesCloudAndSyncToCOS([FromBody] MergeCloudRequest request)
        {
            try
            {
                // 首先合并文件
                var uniqueFileName = request.FileCode + "_" + request.FileName; // 使用 GUID 生成唯一文件名
                var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
                var localFilePath = await _systemService.MergeFileAsync(uniqueFileName, request.TotalChunks, username, "wwwroot/files/filescloud");

                if (string.IsNullOrEmpty(localFilePath))
                {
                    return Ok(new { success = false, msg = "文件合并失败" });
                }

                // 获取文件大小（在上传到COS前获取）
                var fileInfo = new FileInfo(localFilePath);
                var fileSize = fileInfo.Length / 1024.0m; // 转换为KB

                // 检查是否启用了COS
                var systemCfg = _systemService.GetSystemCfgs();
                var cos_switch = systemCfg.FirstOrDefault(x => x.CfgKey == "COS_Switch");

                if (cos_switch != null && cos_switch.CfgValue == "1")
                {
                    // 构建COS路径
                    string cosKey = $"files/{request.FolderCode}/{DateTime.Now:yyyyMMdd}/{request.FileCode}/{request.FileName}";

                    // 初始化进度为0
                    string processKey = $"process_{request.FileCode}";
                    await _redisService.SetAsync(processKey, "0");

                    // 上传到COS，并传入进度回调
                    bool uploadResult = await _filesAIService.UploadFileToCOS(localFilePath, cosKey, async progress =>
                    {
                        var processValue = await _redisService.GetAsync(processKey);
                        if (processValue != null)
                            await _redisService.SetAsync(processKey, progress.ToString());
                    });

                    if (!uploadResult)
                    {
                        // 上传失败时删除进度缓存
                        await _redisService.DeleteAsync(processKey);
                        return Ok(new { success = false, msg = "同步到云存储失败" });
                    }

                    // 获取COS URL
                    string cosUrl = _cosService.GetObjectUrl(cosKey);

                    // 保存文件记录到数据库，使用COS URL
                    var fileLib = new FilesLibCloud
                    {
                        FileCode = Guid.NewGuid().ToString(),
                        FileName = request.FileName,
                        FilePath = cosUrl,
                        FileSize = fileSize, // 使用之前获取的文件大小
                        FileType = Path.GetExtension(request.FileName),
                        Account = username,
                        FolderCode = request.FolderCode,
                        FullFolderCode = request.FullFolderCode,
                        CreateTime = DateTime.Now,
                        FilePathKey = cosKey
                    };

                    _filesAIService.SaveFilesLibCloud(fileLib);

                    return Ok(new
                    {
                        success = true,
                        msg = "文件上传并同步到云存储成功",
                        path = cosUrl,
                        fileCode = fileLib.FileCode
                    });
                }
                else
                {
                    // 不使用COS，保存本地文件记录
                    string webPath = $"/files/cloud/{request.FolderCode}/{request.FileName}";

                    var fileLib = new FilesLibCloud
                    {
                        FileCode = request.FileCode,
                        FileName = request.FileName,
                        FilePath = webPath,
                        FileSize = fileSize, // 使用之前获取的文件大小
                        FileType = Path.GetExtension(request.FileName),
                        Account = username,
                        FolderCode = request.FolderCode,
                        FullFolderCode = request.FullFolderCode,
                        CreateTime = DateTime.Now
                    };

                    _filesAIService.SaveFilesLibCloud(fileLib);

                    return Ok(new { success = true, msg = "文件上传成功", path = webPath, fileCode = fileLib.FileCode });
                }
            }
            catch (Exception ex)
            {
                // 发生异常时删除进度缓存
                if (!string.IsNullOrEmpty(request.FolderCode))
                {
                    await _redisService.DeleteAsync($"process_{request.FolderCode}");
                }

                _systemService.WriteLogUnAsync($"合并文件或同步到COS失败: {ex.Message}", Dtos.LogLevel.Error, "system");
                return Ok(new { success = false, msg = $"上传失败: {ex.Message}" });
            }
        }
        [Authorize]
        [HttpPost]
        public IActionResult GetFilesLibClouds(int page, int pageSize, string name, string folderCode)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            int total = 0;
            var listFilesLibClouds = _filesAIService.GetFilesLibClouds(page, pageSize, name, folderCode, out total, username);
            return Ok(new { success = true, data = listFilesLibClouds, total });
        }

        [Authorize]
        [HttpPost]
        public IActionResult DeleteFilesLibCloud(string fileCode)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var result = _filesAIService.DeleteFilesLibCloud(fileCode, username);
            return Ok(new { success = result });
        }

        // 添加请求模型
        public class MergeCloudRequest
        {
            public string FileName { get; set; }
            public string FileCode { get; set; }
            public int TotalChunks { get; set; }
            public string FolderCode { get; set; }
            public string FullFolderCode { get; set; }
        }
        [Authorize]
        [HttpPost]
        public IActionResult DeleteFolderLib(string folderCode)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var result = _filesAIService.DeleteFolderLib(folderCode, username);
            return Ok(new { success = result });
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> GetUploadProgress(string fileCode)
        {
            try
            {
                string processKey = $"process_{fileCode}";
                var progressValue = await _redisService.GetAsync(processKey);

                if (string.IsNullOrEmpty(progressValue))
                {
                    return Ok(new { success = true, progress = 100 });
                }

                if (double.TryParse(progressValue, out double progress))
                {
                    // 如果进度达到100%，删除缓存
                    if (progress >= 100)
                    {
                        await _redisService.DeleteAsync(processKey);
                    }

                    return Ok(new { success = true, progress });
                }

                return Ok(new { success = false, message = "无效的进度信息" });
            }
            catch (Exception ex)
            {
                _systemService.WriteLogUnAsync($"获取上传进度失败: {ex.Message}", Dtos.LogLevel.Error, "system");
                return Ok(new { success = false, message = "获取进度失败" });
            }
        }

        [HttpGet]
        public IActionResult Share(string fileCode)
        {
            var file = _context.FilesLibClouds.Where(x => x.FileCode == fileCode).FirstOrDefault();
            //重定向
            if (file != null)
            {
                return Redirect(file.FilePath);
            }
            return NotFound();
        }
        [Authorize]
        [HttpPost]
        public IActionResult SaveFileToCloud(string fileCode, string folderCode)
        {
            try
            {
                var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

                // 获取源文件信息
                var sourceFile = _context.FilesLibs.FirstOrDefault(f => f.FileCode == fileCode && f.Account == username);
                if (sourceFile == null)
                {
                    return Ok(new { success = false, msg = "找不到源文件" });
                }

                // 获取文件夹信息
                var folder = _context.FoldersLibs.FirstOrDefault(f => f.FolderCode == folderCode && f.Account == username);
                if (folder == null && folderCode != "root")
                {
                    return Ok(new { success = false, msg = "找不到目标文件夹" });
                }

                // 获取完整的文件夹路径编码
                string fullFolderCode = folderCode;
                if (folderCode != "root")
                {
                    // 构建完整路径
                    var currentFolder = folder;
                    var path = new List<string> { currentFolder.FolderCode };

                    while (currentFolder.ParentCode != "0" && currentFolder.ParentCode != null)
                    {
                        var parentFolder = _context.FoldersLibs.FirstOrDefault(f => f.FolderCode == currentFolder.ParentCode);
                        if (parentFolder == null) break;

                        path.Insert(0, parentFolder.FolderCode);
                        currentFolder = parentFolder;
                    }

                    fullFolderCode = string.Join("/", path);
                }

                // 获取源文件的物理路径
                string sourceFilePath = "wwwroot" + sourceFile.FilePath;

                // 检查文件是否存在
                if (!System.IO.File.Exists(sourceFilePath))
                {
                    return Ok(new { success = false, msg = "源文件不存在" });
                }

                // 创建目标文件名（保持原文件名，但添加GUID前缀避免重名）
                string newFileCode = Guid.NewGuid().ToString();
                string uniqueFileName = newFileCode + "_" + sourceFile.FileName;

                // 创建目标文件夹路径
                string targetFolderPath = Path.Combine("wwwroot", "files", "filescloud");
                Directory.CreateDirectory(targetFolderPath);

                // 目标文件完整路径
                string targetFilePath = Path.Combine(targetFolderPath, uniqueFileName);

                // 复制文件
                System.IO.File.Copy(sourceFilePath, targetFilePath, true);

                // 获取文件大小
                var fileInfo = new FileInfo(targetFilePath);
                var fileSize = fileInfo.Length / 1024.0m; // 转换为KB

                // 检查是否启用了COS
                var systemCfg = _systemService.GetSystemCfgs();
                var cos_switch = systemCfg.FirstOrDefault(x => x.CfgKey == "COS_Switch");

                FilesLibCloud filesLibCloud = new FilesLibCloud();
                filesLibCloud.FileCode = newFileCode;
                filesLibCloud.Account = username;
                filesLibCloud.FileName = sourceFile.FileName;
                filesLibCloud.FileType = sourceFile.FileType;
                filesLibCloud.FileSize = fileSize;
                filesLibCloud.FolderCode = folderCode;
                filesLibCloud.FullFolderCode = fullFolderCode;
                filesLibCloud.CreateTime = DateTime.Now;

                // 如果启用了COS，上传到COS
                if (cos_switch != null && cos_switch.CfgValue == "1")
                {
                    // 构建COS路径
                    string cosKey = $"files/{folderCode}/{DateTime.Now:yyyyMMdd}/{newFileCode}/{sourceFile.FileName}";

                    // 上传到COS
                    bool uploadResult = _filesAIService.UploadFileToCOS(targetFilePath, cosKey, null).Result;

                    if (!uploadResult)
                    {
                        return Ok(new { success = false, msg = "同步到云存储失败" });
                    }

                    // 获取COS URL
                    string cosUrl = _cosService.GetObjectUrl(cosKey);

                    // 设置文件路径为COS URL
                    filesLibCloud.FilePath = cosUrl;
                    filesLibCloud.FilePathKey = cosKey;
                }
                else
                {
                    // 不使用COS，使用本地路径
                    filesLibCloud.FilePath = "/files/filescloud/" + uniqueFileName;
                }

                // 保存到数据库
                _filesAIService.SaveFilesLibCloud(filesLibCloud);

                // 删除源文件
                try
                {
                    // 从数据库中删除记录
                    _filesAIService.DeleteFilesLibs(fileCode, username);

                    // 删除物理文件
                    if (System.IO.File.Exists(sourceFilePath))
                    {
                        System.IO.File.Delete(sourceFilePath);
                    }
                }
                catch (Exception ex)
                {
                    _systemService.WriteLogUnAsync($"删除源文件失败: {ex.Message}", Dtos.LogLevel.Error, "system");
                    // 即使删除源文件失败，转存操作仍然成功
                }

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _systemService.WriteLogUnAsync($"转存文件到网盘失败: {ex.Message}", Dtos.LogLevel.Error, "system");
                return Ok(new { success = false, msg = ex.Message });
            }
        }

        [Authorize]
        [HttpPost]
        public IActionResult MoveFileToLib(string fileCode)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

            try
            {
                // 获取源文件信息（网盘文件）
                var sourceFile = _context.FilesLibClouds.FirstOrDefault(f => f.FileCode == fileCode && f.Account == username);
                if (sourceFile == null)
                {
                    return Ok(new { success = false, msg = "找不到源文件" });
                }

                // 检查文件是否存在
                string sourceFilePath = string.Empty;
                bool isCloudFile = false;

                // 检查是否是COS文件
                if (sourceFile.FilePath.StartsWith("http"))
                {
                    isCloudFile = true;
                    // 如果是COS文件，需要先下载
                    if (string.IsNullOrEmpty(sourceFile.FilePathKey))
                    {
                        return Ok(new { success = false, msg = "云存储文件路径无效" });
                    }

                    // 创建临时文件夹
                    string tempFolderPath = Path.Combine("wwwroot", "temp");
                    Directory.CreateDirectory(tempFolderPath);

                    // 临时文件路径
                    sourceFilePath = Path.Combine(tempFolderPath, sourceFile.FileName);

                    // 从COS下载文件
                    bool downloadResult = _cosService.DownloadObject(sourceFile.FilePathKey, sourceFilePath);
                    if (!downloadResult)
                    {
                        return Ok(new { success = false, msg = "从云存储下载文件失败" });
                    }
                }
                else
                {
                    // 本地文件
                    sourceFilePath = "wwwroot" + sourceFile.FilePath;
                    if (!System.IO.File.Exists(sourceFilePath))
                    {
                        return Ok(new { success = false, msg = "源文件不存在" });
                    }
                }

                // 创建目标文件名（保持原文件名，但添加GUID前缀避免重名）
                string newFileCode = Guid.NewGuid().ToString();
                string uniqueFileName = newFileCode + "_" + sourceFile.FileName;

                // 创建目标文件夹路径
                string targetFolderPath = Path.Combine("wwwroot", "files", "fileslib", DateTime.Now.ToString("yyyyMMdd"));
                Directory.CreateDirectory(targetFolderPath);

                // 目标文件完整路径
                string targetFilePath = Path.Combine(targetFolderPath, uniqueFileName);

                // 复制文件
                System.IO.File.Copy(sourceFilePath, targetFilePath, true);

                // 如果是临时下载的云文件，删除临时文件
                if (isCloudFile && System.IO.File.Exists(sourceFilePath) && sourceFilePath.Contains("temp"))
                {
                    System.IO.File.Delete(sourceFilePath);
                }

                // 创建素材库文件记录
                FilesLib filesLib = new FilesLib();
                filesLib.FileCode = newFileCode;
                filesLib.Account = username;
                filesLib.FileName = sourceFile.FileName;
                filesLib.FilePath = $"/files/fileslib/{DateTime.Now.ToString("yyyyMMdd")}/" + uniqueFileName;
                filesLib.FileType = sourceFile.FileType;
                filesLib.CreateTime = DateTime.Now;

                // 保存到数据库
                _filesAIService.SaveFilesLib(filesLib);

                // 删除网盘中的源文件
                try
                {
                    // 如果是COS文件，从COS中删除
                    if (isCloudFile && !string.IsNullOrEmpty(sourceFile.FilePathKey))
                    {
                        _cosService.DeleteObject(sourceFile.FilePathKey);
                    }
                    // 如果是本地文件，删除物理文件
                    else if (!isCloudFile && System.IO.File.Exists(sourceFilePath))
                    {
                        System.IO.File.Delete(sourceFilePath);
                    }

                    // 从数据库中删除记录
                    _filesAIService.DeleteFilesLibCloud(fileCode, username);
                }
                catch (Exception ex)
                {
                    _systemService.WriteLogUnAsync($"删除网盘源文件失败: {ex.Message}", Dtos.LogLevel.Error, "system");
                    // 即使删除源文件失败，转存操作仍然成功
                }

                return Ok(new { success = true, fileCode = filesLib.FileCode });
            }
            catch (Exception ex)
            {
                _systemService.WriteLogUnAsync($"转存文件到素材库失败: {ex.Message}", Dtos.LogLevel.Error, "system");
                return Ok(new { success = false, msg = ex.Message });
            }
        }
    }
}
