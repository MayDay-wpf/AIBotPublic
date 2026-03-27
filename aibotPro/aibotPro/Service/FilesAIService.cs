using aibotPro.ChatService;
using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using iTextSharp.text;
using Microsoft.AspNetCore.SignalR;
using Newtonsoft.Json.Linq;
using System.Runtime.CompilerServices;
using TiktokenSharp;


namespace aibotPro.Service;

public class FilesAIService : IFilesAIService
{
    private readonly AIBotProContext _context;
    private readonly ISystemService _systemService;
    private readonly IAiServer _aiServer;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly IFinanceService _financeService;
    private readonly ICOSService _cosService;

    public FilesAIService(ISystemService systemService, AIBotProContext context, IAiServer aiServer,
        IHubContext<ChatHub> hubContext, IFinanceService financeService, ICOSService cosService)
    {
        _systemService = systemService;
        _context = context;
        _aiServer = aiServer;
        _hubContext = hubContext;
        _financeService = financeService;
        _cosService = cosService;
    }

    public bool SaveFilesLib(FilesLib filesLib)
    {
        //保存文件库
        _context.FilesLibs.Add(filesLib);
        return _context.SaveChanges() > 0;
    }

    public List<FilesLib> GetFilesLibs(int page, int pageSize, string name, out int total, string account = "")
    {
        // 利用IQueryable延迟执行，直到真正需要数据的时候才去数据库查询
        IQueryable<FilesLib> query = _context.FilesLibs;

        // 如果name不为空，则加上name的过滤条件
        if (!string.IsNullOrEmpty(name)) query = query.Where(x => x.FileName.Contains(name));
        if (!string.IsNullOrEmpty(account)) query = query.Where(x => x.Account == account);

        // 首先计算总数，此时还未真正运行SQL查询
        total = query.Count();

        // 然后添加分页逻辑，此处同样是构建查询，没有执行
        var listFilesLibs = query.OrderByDescending(x => x.CreateTime)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList(); // 直到调用ToList，查询才真正执行

        return listFilesLibs;
    }

    public bool DeleteFilesLibs(string fileCode, string account)
    {
        //删除文件库文件
        var filesLib = _context.FilesLibs.FirstOrDefault(x => x.FileCode == fileCode && x.Account == account);
        if (filesLib != null)
        {
            _context.FilesLibs.Remove(filesLib);
            
            //组合原文件路径
            var filePath = $"wwwroot{filesLib.FilePath}";
            //删除原文件
            bool originalFileDeleted = _systemService.DeleteFile(filePath);
            
            //如果有ObjectPath，也删除解析后的文件
            bool objectFileDeleted = true;
            if (!string.IsNullOrEmpty(filesLib.ObjectPath))
            {
                // 检查ObjectPath是否为COS直链
                if (filesLib.ObjectPath.StartsWith("http"))
                {
                    // 从COS直链中提取COS key并删除COS文件
                    try
                    {
                        // 解析COS URL，提取key
                        var uri = new Uri(filesLib.ObjectPath);
                        var cosKey = uri.AbsolutePath.TrimStart('/'); // 移除开头的'/'
                        
                        // 删除COS文件
                        objectFileDeleted = _cosService.DeleteObject(cosKey);
                        
                        if (!objectFileDeleted)
                        {
                            _systemService.WriteLogUnAsync($"删除COS解析文件失败: {cosKey}", Dtos.LogLevel.Warn, account);
                        }
                    }
                    catch (Exception ex)
                    {
                        _systemService.WriteLogUnAsync($"解析COS URL失败: {filesLib.ObjectPath}, 错误: {ex.Message}", Dtos.LogLevel.Error, account);
                        objectFileDeleted = false;
                    }
                }
                else
                {
                    // 旧格式：本地路径，删除本地文件
                    var objectPath = filesLib.ObjectPath.Contains("wwwroot") 
                        ? filesLib.ObjectPath 
                        : $"wwwroot/{filesLib.ObjectPath}";
                    objectFileDeleted = _systemService.DeleteFile(objectPath);
                }
            }
            
            //只有在原文件删除成功（或不存在）的情况下才保存数据库更改
            //解析文件删除失败不影响主流程，但会记录日志
            if (originalFileDeleted) 
            {
                if (!objectFileDeleted)
                {
                    _systemService.WriteLogUnAsync($"解析文件删除失败，但继续删除数据库记录: {fileCode}", Dtos.LogLevel.Warn, account);
                }
                return _context.SaveChanges() > 0;
            }
        }

        return false;
    }
    public List<FoldersLib> GetFoldersLibs(string account)
    {
        //获取文件夹列表
        var foldersLibs = _context.FoldersLibs.Where(x => x.Account == account).ToList();
        return foldersLibs;
    }

    public bool SaveFolderLib(FoldersLib folderLib)
    {
        //保存文件夹
        _context.FoldersLibs.Add(folderLib);
        return _context.SaveChanges() > 0;
    }
    public bool SaveFilesLibCloud(FilesLibCloud filesLibCloud)
    {
        //保存云存储文件
        _context.FilesLibClouds.Add(filesLibCloud);
        return _context.SaveChanges() > 0;
    }

    public List<FilesLibCloud> GetFilesLibClouds(int page, int pageSize, string name, string folderCode, out int total, string account = "")
    {
        // 利用IQueryable延迟执行，直到真正需要数据的时候才去数据库查询
        IQueryable<FilesLibCloud> query = _context.FilesLibClouds;

        // 添加过滤条件
        if (!string.IsNullOrEmpty(name)) query = query.Where(x => x.FileName.Contains(name));
        if (!string.IsNullOrEmpty(account)) query = query.Where(x => x.Account == account);
        if (!string.IsNullOrEmpty(folderCode)) query = query.Where(x => x.FolderCode == folderCode);

        // 计算总数
        total = query.Count();

        // 添加分页逻辑
        var listFilesLibClouds = query.OrderByDescending(x => x.CreateTime)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return listFilesLibClouds;
    }

    public bool DeleteFilesLibCloud(string fileCode, string account)
    {
        List<string> files = fileCode.Split(',').ToList();

        // Find all matching files
        var filesLibClouds = _context.FilesLibClouds
            .Where(x => files.Contains(x.FileCode) && x.Account == account)
            .ToList();

        if (filesLibClouds != null && filesLibClouds.Count > 0)
        {
            foreach (var file in filesLibClouds)
            {
                // 判断是否为COS路径
                if (file.FilePath.StartsWith("http") || file.FilePath.StartsWith("https") || file.FilePath.Contains("cos."))
                {
                    // 从COS路径中提取key
                    string key = file.FilePath.Substring(file.FilePath.LastIndexOf("/") + 1);
                    // 使用COS服务删除文件
                    _cosService.DeleteObject(file.FilePathKey);
                }
                else
                {
                    // 删除本地物理文件
                    var filePath = $"wwwroot{file.FilePath}";
                    _systemService.DeleteFile(filePath);
                }
                // Remove each file from the database
                _context.FilesLibClouds.Remove(file);
            }

            // Save all changes at once
            return _context.SaveChanges() > 0;
        }

        return false;
    }
    public bool DeleteFolderLib(string folderCode, string account)
    {
        //删除文件夹
        var folderLib = _context.FoldersLibs.FirstOrDefault(x => x.FolderCode == folderCode && x.Account == account);
        if (folderLib != null)
        {
            _context.FoldersLibs.Remove(folderLib);
            //删除文件夹下的文件
            var filesLibs = _context.FilesLibClouds.Where(x => x.FolderCode == folderCode && x.Account == account).ToList();
            foreach (var item in filesLibs)
            {
                _context.FilesLibClouds.Remove(item);
                // 判断是否为COS路径
                if (item.FilePath.StartsWith("http") || item.FilePath.StartsWith("https") || item.FilePath.Contains("cos."))
                {
                    // 使用COS服务删除文件
                    _cosService.DeleteObject(item.FilePathKey);
                }
                else
                {
                    // 删除本地物理文件
                    _systemService.DeleteFile($"wwwroot{item.FilePath}");
                }
            }
            return _context.SaveChanges() > 0;
        }
        //删除子文件夹
        var folderLibs = _context.FoldersLibs.Where(x => x.ParentCode == folderCode && x.Account == account).ToList();
        if (folderLibs.Count > 0)
        {
            foreach (var item in folderLibs)
            {
                _context.FoldersLibs.Remove(item);
                //删除子文件夹下的文件
                var filesLibs = _context.FilesLibClouds.Where(x => x.FolderCode == item.FolderCode && x.Account == account).ToList();
                foreach (var item2 in filesLibs)
                {
                    _context.FilesLibClouds.Remove(item2);
                    // 判断是否为COS路径
                    if (item2.FilePath.StartsWith("http") || item2.FilePath.StartsWith("https") || item2.FilePath.Contains("cos."))
                    {
                        // 使用COS服务删除文件
                        _cosService.DeleteObject(item2.FilePathKey);
                    }
                    else
                    {
                        // 删除本地物理文件
                        _systemService.DeleteFile($"wwwroot{item2.FilePath}");
                    }
                }
            }
            return _context.SaveChanges() > 0;
        }

        return true;
    }
    public async Task<bool> UploadFileToCOS(string localFilePath, string cosKey, Action<int> progressCallback = null)
    {
        try
        {
            // 文件信息
            var fileInfo = new FileInfo(localFilePath);
            if (!fileInfo.Exists)
            {
                _systemService.WriteLogUnAsync($"文件不存在: {localFilePath}", Dtos.LogLevel.Error, "system");
                return false;
            }

            // 分片大小，5MB
            const int chunkSize = 5 * 1024 * 1024;
            int totalChunks = (int)Math.Ceiling(fileInfo.Length / (double)chunkSize);

            // 初始化分片上传
            string uploadId = _cosService.InitMultipartUpload(cosKey);
            if (string.IsNullOrEmpty(uploadId))
            {
                _systemService.WriteLogUnAsync("初始化COS分片上传失败", Dtos.LogLevel.Error, "system");
                return false;
            }

            // 上传分片
            List<string> eTagList = new List<string>(totalChunks);
            for (int i = 0; i < totalChunks; i++)
            {
                eTagList.Add(string.Empty);
            }

            using (FileStream fs = new FileStream(localFilePath, FileMode.Open, FileAccess.Read))
            {
                byte[] buffer = new byte[chunkSize];

                for (int partNumber = 1; partNumber <= totalChunks; partNumber++)
                {
                    // 创建临时分片文件
                    string tempChunkPath = Path.Combine(Path.GetTempPath(), $"{Path.GetFileName(localFilePath)}_chunk_{partNumber}");

                    using (FileStream tempChunkStream = new FileStream(tempChunkPath, FileMode.Create, FileAccess.Write))
                    {
                        int bytesRead = fs.Read(buffer, 0, chunkSize);
                        tempChunkStream.Write(buffer, 0, bytesRead);
                    }

                    // 上传分片
                    string eTag = _cosService.UploadPart(cosKey, uploadId, partNumber, tempChunkPath);
                    if (string.IsNullOrEmpty(eTag))
                    {
                        _systemService.WriteLogUnAsync($"上传分片{partNumber}失败", Dtos.LogLevel.Error, "system");
                        _cosService.AbortMultipartUpload(cosKey, uploadId);
                        return false;
                    }

                    eTagList[partNumber - 1] = eTag;

                    // 计算并回调进度
                    int progress = (int)((partNumber / (double)totalChunks) * 100);
                    progressCallback?.Invoke(progress);

                    // 删除临时分片文件
                    try { File.Delete(tempChunkPath); } catch { }
                }
            }

            // 完成分片上传
            bool completeResult = _cosService.CompleteMultipartUpload(cosKey, uploadId, eTagList);
            if (!completeResult)
            {
                _systemService.WriteLogUnAsync("完成COS分片上传失败", Dtos.LogLevel.Error, "system");
                return false;
            }

            // 上传完成，回调100%进度
            progressCallback?.Invoke(100);

            // 删除本地文件
            try { _systemService.DeleteFile(localFilePath); } catch { }

            return true;
        }
        catch (Exception ex)
        {
            _systemService.WriteLogUnAsync($"上传文件到COS失败: {ex.Message}", Dtos.LogLevel.Error, "system");
            return false;
        }
    }
    public FilesLibCloud GetFileLibCloudByCode(string fileCode, string username)
    {
        return _context.FilesLibClouds
            .FirstOrDefault(f => f.FileCode == fileCode && f.Account == username);
    }
}