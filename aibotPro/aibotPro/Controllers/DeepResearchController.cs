using aibotPro.ChatService;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Newtonsoft.Json;
using TiktokenSharp;
using Microsoft.AspNetCore.Authorization;

namespace aibotPro.Controllers;

/// <summary>
/// 深度研究控制器 - 已集成重试机制
/// 
/// 重试机制集成说明：
/// - GenerateQuestions方法已添加完整的重试机制和错误处理
/// - 其他方法通过调用DeepResearchService中的重试方法间接获得容错能力
/// - 所有API都提供详细的错误信息和状态反馈
/// - SignalR实时通知包含重试状态和错误信息
/// </summary>
public class DeepResearchController : Controller
{
    private readonly ISystemService _systemService;
    private readonly AIBotProContext _context;
    private readonly IUsersService _usersService;
    private readonly IFinanceService _financeService;
    private readonly IAiServer _aiServer;
    private readonly JwtTokenManager _jwtTokenManager;
    private readonly IHubContext<DeepResearchHub> _hubContext;
    private readonly IDeepResearchService _deepResearchService;
    private readonly ICOSService _cosService;
    private readonly IRedisService _redisService;

    public DeepResearchController(ISystemService systemService, AIBotProContext context, IUsersService usersService,
        IFinanceService financeService, IAiServer aiServer, JwtTokenManager jwtTokenManager,
        IHubContext<DeepResearchHub> hubContext, IDeepResearchService deepResearchService, ICOSService cosService, IRedisService redisService)
    {
        _redisService = redisService;
        _systemService = systemService;
        _context = context;
        _usersService = usersService;
        _financeService = financeService;
        _aiServer = aiServer;
        _jwtTokenManager = jwtTokenManager;
        _hubContext = hubContext;
        _deepResearchService = deepResearchService;
        _cosService = cosService;

    }

    //根据研究报告标题生成一些需要补充的问题
    public async Task<IActionResult> GenerateQuestions(string title, string chatId = null)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var systemCfgs = _systemService.GetSystemCfgs();
        string model = systemCfgs.FirstOrDefault(x => x.CfgKey == "DeepResearch_Leader_Model")?.CfgValue;
        bool beforeCheck = await _deepResearchService.DeepResearchBeforeCheck(model, username);
        if (!beforeCheck)
        {
            return Json(new
            {
                success = false,
                msg = "余额不足"
            });
        }
        // 检查用户是否有进行中的任务
        var hasRunningTasks = await _deepResearchService.HasRunningTasksAsync(username);
        if (hasRunningTasks)
        {
            return Json(new
            {
                success = false,
                msg = "当前有正在进行的研究任务，请等待完成后再创建新的研究项目"
            });
        }
        if (string.IsNullOrEmpty(chatId))
        {
            chatId = username + "_deepresearch_" + Guid.NewGuid().ToString("N");
        }
        var waitSave = _deepResearchService.SaveAIActiveAsync(chatId, username, "fas fa-question-circle text-info", "研究方向拓展", "正在生成研究方向(请不要离开)...", "loading");
        var data = new
        {
            chatId = chatId,
            title = "研究方向拓展",
            message = "正在生成研究方向(请不要离开)...",
            icon = "fas fa-question-circle text-info",
            status = "loading"
        };
        await _hubContext.Clients.Group(chatId).SendAsync("ReceiveActivityUpdate", data);

        var question = new Dtos.ResearchList();
        bool success = false;
        string errorMessage = "";

        try
        {
            // 使用重试机制生成研究方向
            question = await ExecuteWithRetryAsync(async () =>
            {
                string prompt = @$"# You are preparing to generate a research report for the user \n

                                    * The research report title provided by the user is «{title}». Please generate some additional research directions based on the title for the user to choose from \n

                                    * Add more details for the user to select, to guide the subsequent writing of the research report. \n

                                    * Please use the language of the user's report title \n

                                    * The recommended number of research directions is approximately 10-15 \n
                                    
                                    * Do not ask questions, but directly generate relevant research directions for users to choose from.";
                string schema = @"{
                                        ""type"": ""object"",
                                        ""properties"": {
                                          ""researchs"": {
                                            ""type"": ""array"",
                                            ""description"": ""List of research"",
                                            ""items"": {
                                              ""type"": ""string""
                                            }
                                          }
                                        },
                                        ""required"": [
                                          ""researchs""
                                        ],
                                        ""additionalProperties"": false
                                      }";

                if (string.IsNullOrEmpty(model))
                {
                    throw new InvalidOperationException("未配置深度研究模型");
                }

                var result = await _aiServer.GPTJsonSchema(prompt, schema, model, username);

                if (string.IsNullOrEmpty(result))
                {
                    throw new InvalidOperationException("AI服务返回空结果");
                }

                try
                {
                    var researchList = JsonConvert.DeserializeObject<Dtos.ResearchList>(result);

                    // 验证反序列化结果
                    if (researchList?.Researchs == null || !researchList.Researchs.Any())
                    {
                        throw new InvalidOperationException("生成的研究方向格式无效或为空");
                    }

                    // 记录费用
                    var tikToken = TikToken.GetEncoding("o200k_base");
                    await _financeService.CreateUseLogAndUpadteMoney(username, model,
                        tikToken.Encode(prompt + schema).Count, tikToken.Encode(result).Count);

                    return researchList;
                }
                catch (JsonException ex)
                {
                    throw new InvalidOperationException($"解析AI返回结果失败: {ex.Message}");
                }

            }, $"生成研究方向 - {title}");

            success = true;

            // 发送完成状态
            var completeData = new
            {
                chatId = chatId,
                title = "研究方向拓展",
                newDescription = $"已生成 {question.Researchs?.Count ?? 0} 个相关方向",
                status = "success"
            };
            await _hubContext.Clients.Group(chatId).SendAsync("ReceiveActivityUpdate", completeData);
            var waitSave2 = _deepResearchService.SaveAIActiveAsync(chatId, username, "fas fa-question-circle text-info", "研究方向拓展", "研究方向拓展完成", "success");
            await waitSave;
            await waitSave2;
        }
        catch (Exception ex)
        {
            success = false;
            errorMessage = ex.Message;

            // 记录错误日志
            _systemService.WriteLogUnAsync($"生成研究方向失败: {title}, 用户: {username}, 错误: {ex.Message}",
                Dtos.LogLevel.Error, "DeepResearch");

            // 发送失败状态
            var errorData = new
            {
                chatId = chatId,
                title = "研究方向拓展",
                newDescription = $"研究方向拓展失败: {ex.Message}",
                status = "error"
            };
            await _hubContext.Clients.Group(chatId).SendAsync("ReceiveActivityUpdate", errorData);
        }

        return Json(new
        {
            success = success,
            data = question.Researchs,
            chatId = chatId,
            msg = success ? "生成成功" : $"生成失败: {errorMessage}"
        });
    }

    /// <summary>
    /// 通用重试方法，支持指数退避策略
    /// </summary>
    private async Task<T> ExecuteWithRetryAsync<T>(
        Func<Task<T>> operation,
        string operationName,
        int maxRetries = 3,
        int baseDelayMs = 1000)
    {
        Exception lastException = null;

        for (int attempt = 0; attempt <= maxRetries; attempt++)
        {
            try
            {
                var result = await operation();

                // 如果不是第一次尝试且成功了，记录恢复日志
                if (attempt > 0)
                {
                    _systemService.WriteLogUnAsync($"{operationName} 在第 {attempt + 1} 次尝试后成功",
                        Dtos.LogLevel.Info, "DeepResearch");
                }

                return result;
            }
            catch (Exception ex)
            {
                lastException = ex;

                // 如果是最后一次尝试，不再重试
                if (attempt == maxRetries)
                {
                    _systemService.WriteLogUnAsync($"{operationName} 在 {maxRetries + 1} 次尝试后最终失败: {ex.Message}",
                        Dtos.LogLevel.Error, "DeepResearch");
                    break;
                }

                // 计算延迟时间（指数退避）
                var delay = baseDelayMs * (int)Math.Pow(2, attempt);

                _systemService.WriteLogUnAsync($"{operationName} 第 {attempt + 1} 次尝试失败: {ex.Message}，{delay}ms 后重试",
                    Dtos.LogLevel.Warn, "DeepResearch");

                // 等待后重试
                await Task.Delay(delay);
            }
        }

        // 如果所有重试都失败了，抛出最后一个异常
        throw lastException ?? new Exception($"{operationName} 执行失败");
    }

    /// <summary>
    /// 深度研究编辑器文件上传接口
    /// 支持图片、文档等文件类型，自动判断使用COS或本地存储
    /// </summary>
    [Authorize]
    [HttpPost]
    public async Task<IActionResult> UploadEditorFile([FromForm] IFormFile file)
    {
        try
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

            if (string.IsNullOrEmpty(username))
            {
                return Json(new { success = false, msg = "用户认证失败" });
            }

            if (file == null || file.Length == 0)
            {
                return Json(new { success = false, msg = "文件不能为空" });
            }

            // 文件大小限制 (20MB)
            const long maxFileSize = 20 * 1024 * 1024;
            if (file.Length > maxFileSize)
            {
                return Json(new { success = false, msg = "文件大小不能超过20MB" });
            }

            // 获取文件扩展名并验证
            var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg",
                                          ".pdf", ".doc", ".docx", ".txt", ".md", ".csv", ".xlsx", ".xls" };

            if (!allowedExtensions.Contains(fileExtension))
            {
                return Json(new { success = false, msg = "不支持的文件类型" });
            }

            // 生成唯一文件名
            var fileName = $"{Guid.NewGuid()}{fileExtension}";
            var uploadDate = DateTime.Now.ToString("yyyyMMdd");

            // 创建本地存储目录
            var localBasePath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "deepresearch", uploadDate);
            if (!Directory.Exists(localBasePath))
            {
                Directory.CreateDirectory(localBasePath);
            }

            var localFilePath = Path.Combine(localBasePath, fileName);

            // 保存文件到本地
            using (var stream = new FileStream(localFilePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // 检查是否启用了COS
            var systemCfgs = _systemService.GetSystemCfgs();
            var cosSwitch = systemCfgs.FirstOrDefault(x => x.CfgKey == "COS_Switch");

            if (cosSwitch != null && cosSwitch.CfgValue == "1")
            {
                // 使用COS存储
                try
                {
                    var cosKey = $"deepresearch/{username}/{uploadDate}/{fileName}";
                    var cosUrl = _cosService.PutObject(cosKey, localFilePath, fileName);

                    if (!string.IsNullOrEmpty(cosUrl))
                    {
                        // COS上传成功，本地文件已被删除
                        await LogUploadActivity(username, file.FileName, "COS云存储", true);

                        return Json(new
                        {
                            success = true,
                            msg = "文件上传成功",
                            data = new
                            {
                                url = cosUrl,
                                filename = file.FileName,
                                size = file.Length,
                                type = GetFileType(fileExtension)
                            }
                        });
                    }
                    else
                    {
                        // COS上传失败，使用本地存储作为备用
                        await LogUploadActivity(username, file.FileName, "本地存储(COS备用)", true);
                        return await CreateLocalFileResponse(localFilePath, file, fileName, uploadDate);
                    }
                }
                catch (Exception ex)
                {
                    _systemService.WriteLogUnAsync($"COS上传失败: {ex.Message}", Dtos.LogLevel.Error, "DeepResearch");
                    // COS上传异常，使用本地存储作为备用
                    await LogUploadActivity(username, file.FileName, "本地存储(COS异常)", true);
                    return await CreateLocalFileResponse(localFilePath, file, fileName, uploadDate);
                }
            }
            else
            {
                // 使用本地存储
                await LogUploadActivity(username, file.FileName, "本地存储", true);
                return await CreateLocalFileResponse(localFilePath, file, fileName, uploadDate);
            }
        }
        catch (Exception ex)
        {
            _systemService.WriteLogUnAsync($"深度研究文件上传异常: {ex.Message}", Dtos.LogLevel.Error, "DeepResearch");
            return Json(new { success = false, msg = $"上传失败: {ex.Message}" });
        }
    }

    /// <summary>
    /// 创建本地文件响应
    /// </summary>
    private async Task<IActionResult> CreateLocalFileResponse(string localFilePath, IFormFile file, string fileName, string uploadDate)
    {
        var webPath = $"/uploads/deepresearch/{uploadDate}/{fileName}";

        return Json(new
        {
            success = true,
            msg = "文件上传成功",
            data = new
            {
                url = webPath,
                filename = file.FileName,
                size = file.Length,
                type = GetFileType(Path.GetExtension(file.FileName).ToLowerInvariant())
            }
        });
    }

    /// <summary>
    /// 根据文件扩展名判断文件类型
    /// </summary>
    private string GetFileType(string extension)
    {
        var imageExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg" };
        var documentExtensions = new[] { ".pdf", ".doc", ".docx", ".txt", ".md" };
        var spreadsheetExtensions = new[] { ".csv", ".xlsx", ".xls" };

        if (imageExtensions.Contains(extension))
            return "image";
        else if (documentExtensions.Contains(extension))
            return "document";
        else if (spreadsheetExtensions.Contains(extension))
            return "spreadsheet";
        else
            return "file";
    }

    /// <summary>
    /// 记录上传活动日志
    /// </summary>
    private async Task LogUploadActivity(string username, string originalFileName, string storageType, bool success)
    {
        try
        {
            var logMessage = success
                ? $"用户 {username} 成功上传文件 '{originalFileName}' 到{storageType}"
                : $"用户 {username} 上传文件 '{originalFileName}' 到{storageType}失败";

            _systemService.WriteLogUnAsync(logMessage, success ? Dtos.LogLevel.Info : Dtos.LogLevel.Warn, "DeepResearch");
        }
        catch (Exception ex)
        {
            _systemService.WriteLogUnAsync($"记录上传日志失败: {ex.Message}", Dtos.LogLevel.Error, "DeepResearch");
        }
    }

    //获取深度研究报告详情
    [Authorize]
    [HttpPost]
    public async Task<IActionResult> GetDeepResearchDetail(string chatId)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var deepResearch = await _deepResearchService.GetDeepResearch(chatId, username);
        return Json(new { success = true, data = deepResearch });
    }

    //获取深度研究项目的活动历史
    [Authorize]
    [HttpPost]
    public async Task<IActionResult> GetDeepResearchActivities(string chatId)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var activities = await _deepResearchService.GetDeepResearchActivitiesAsync(chatId, username);
        return Json(new { success = true, data = activities });
    }

    //获取深度研究列表（分页查询）
    [Authorize]
    [HttpPost]
    public async Task<IActionResult> GetDeepResearchList(int page = 1, int pageSize = 10, string searchKeyword = "")
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

        var (items, totalCount) = await _deepResearchService.GetDeepResearchListAsync(username, page, pageSize, searchKeyword);

        return Json(new
        {
            success = true,
            data = new
            {
                items = items,
                totalCount = totalCount,
                currentPage = page,
                pageSize = pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize),
                hasMore = page * pageSize < totalCount
            }
        });
    }

    //获取研究报告内容（优先从缓存获取进行中的内容，如果缓存中没有则从数据库获取已完成的内容）
    [Authorize]
    [HttpPost]
    public async Task<IActionResult> GetResearchReportContent(string chatId)
    {
        try
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

            if (string.IsNullOrEmpty(chatId))
            {
                return Json(new { success = false, msg = "研究项目ID不能为空" });
            }

            var content = await _deepResearchService.GetResearchReportContentAsync(chatId, username);

            return Json(new
            {
                success = true,
                data = new
                {
                    chatId = chatId,
                    content = content,
                    source = !string.IsNullOrEmpty(content) && content.Contains("正在生成研究报告") ? "cache" : "database"
                }
            });
        }
        catch (Exception ex)
        {
            _systemService.WriteLogUnAsync($"获取研究报告内容异常: {ex.Message}", Dtos.LogLevel.Error, "DeepResearch");
            return Json(new { success = false, msg = $"获取研究报告内容失败: {ex.Message}" });
        }
    }

    //保存研究报告内容
    [Authorize]
    [HttpPost]
    public async Task<IActionResult> SaveResearchReportContent(string chatId, string title, string content)
    {
        try
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

            if (string.IsNullOrEmpty(chatId))
            {
                return Json(new { success = false, msg = "研究项目ID不能为空" });
            }

            if (string.IsNullOrEmpty(content))
            {
                return Json(new { success = false, msg = "研究报告内容不能为空" });
            }

            if (string.IsNullOrEmpty(title))
            {
                return Json(new { success = false, msg = "研究报告标题不能为空" });
            }

            var result = await _deepResearchService.SaveResearchReportContentAsync(chatId, username, title, content);

            if (result)
            {
                return Json(new
                {
                    success = true,
                    msg = "保存成功",
                    data = new
                    {
                        chatId = chatId,
                        title = title,
                        savedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }
                });
            }
            else
            {
                return Json(new { success = false, msg = "保存失败，请重试" });
            }
        }
        catch (Exception ex)
        {
            _systemService.WriteLogUnAsync($"保存研究报告内容异常: {ex.Message}", Dtos.LogLevel.Error, "DeepResearch");
            return Json(new { success = false, msg = $"保存失败: {ex.Message}" });
        }
    }

    //删除深度研究项目
    [Authorize]
    [HttpPost]
    public async Task<IActionResult> DeleteDeepResearch(string chatId)
    {
        try
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

            if (string.IsNullOrEmpty(chatId))
            {
                return Json(new { success = false, msg = "研究项目ID不能为空" });
            }

            if (string.IsNullOrEmpty(username))
            {
                return Json(new { success = false, msg = "用户认证失败" });
            }

            var result = await _deepResearchService.DeleteDeepResearchAsync(chatId, username);

            if (result)
            {
                return Json(new
                {
                    success = true,
                    msg = "删除成功",
                    data = new
                    {
                        chatId = chatId,
                        deletedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    }
                });
            }
            else
            {
                return Json(new { success = false, msg = "删除失败，请重试" });
            }
        }
        catch (Exception ex)
        {
            _systemService.WriteLogUnAsync($"删除研究项目异常: {ex.Message}", Dtos.LogLevel.Error, "DeepResearch");
            return Json(new { success = false, msg = $"删除失败: {ex.Message}" });
        }
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> CreateCache(string content, string key)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        await _redisService.SetAsync(key, content, TimeSpan.FromMinutes(10));
        // 返回缓存的key
        return Json(new
        {
            success = true,
            data = key
        });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> GetDeepResearchChatHistory(string deepResearchChatId)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var history = await _deepResearchService.GetDeepResearchChatHistoryAsync(deepResearchChatId, username, 0);
        return Json(new { success = true, data = history });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> DeleteDeepResearchChatHistoryByGroupId(string groupId)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var histories = _context.DeepResearchChatHistories.Where(x => x.ChatGroupId == groupId).ToList();
        
        foreach (var history in histories)
        {
            _context.DeepResearchChatHistories.Remove(history);
        }
        await _context.SaveChangesAsync();
        
        // 清理聊天历史缓存 - 直接使用groupId对应的chatId
        if (histories.Any())
        {
            var chatId = histories.First().DeepResearchChatId;
            try
            {
                var cacheKey = $"deepresearch_chathistory_{chatId}";
                await _redisService.DeleteAsync(cacheKey);
            }
            catch (Exception ex)
            {
                _systemService.WriteLogUnAsync($"清理聊天历史缓存失败: chatId={chatId}, 错误: {ex.Message}", 
                    Dtos.LogLevel.Warn, "DeepResearch");
            }
        }
        
        return Json(new { success = true, data = histories.Count });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> ClearChatHistory(string chatId)
    {
        try
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

            if (string.IsNullOrEmpty(chatId))
            {
                return Json(new { success = false, msg = "研究项目ID不能为空" });
            }

            if (string.IsNullOrEmpty(username))
            {
                return Json(new { success = false, msg = "用户认证失败" });
            }

            // 删除指定研究项目的所有聊天历史
            var histories = _context.DeepResearchChatHistories
                .Where(x => x.DeepResearchChatId == chatId && x.Account == username)
                .ToList();

            foreach (var history in histories)
            {
                _context.DeepResearchChatHistories.Remove(history);
            }

            await _context.SaveChangesAsync();

            // 清理聊天历史缓存
            try
            {
                var cacheKey = $"deepresearch_chathistory_{chatId}";
                await _redisService.DeleteAsync(cacheKey);
            }
            catch (Exception ex)
            {
                _systemService.WriteLogUnAsync($"清理聊天历史缓存失败: chatId={chatId}, 错误: {ex.Message}", 
                    Dtos.LogLevel.Warn, "DeepResearch");
            }

            return Json(new
            {
                success = true,
                msg = "聊天记录已清除",
                data = new
                {
                    chatId = chatId,
                    deletedCount = histories.Count,
                    clearedAt = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                }
            });
        }
        catch (Exception ex)
        {
            _systemService.WriteLogUnAsync($"清除聊天历史异常: {ex.Message}", Dtos.LogLevel.Error, "DeepResearch");
            return Json(new { success = false, msg = $"清除失败: {ex.Message}" });
        }
    }
}