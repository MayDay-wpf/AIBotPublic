using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using System.IO.Compression;
using System.Security.Principal;
using LogLevel = aibotPro.Dtos.LogLevel;

namespace aibotPro.Controllers;

public class AIdrawController : Controller
{
    private readonly IAiServer _ai;
    private readonly AIBotProContext _context;
    private readonly ICOSService _cosservice;
    private readonly IFinanceService _financeService;
    private readonly JwtTokenManager _jwtTokenManager;
    private readonly IRedisService _redisService;
    private readonly IServiceProvider _serviceProvider;
    private readonly ISystemService _systemService;
    private readonly IUsersService _usersService;

    public AIdrawController(ISystemService systemService, IUsersService usersService,
        JwtTokenManager jwtTokenManager, AIBotProContext aIBotProContext, IAiServer ai,
        IFinanceService financeService, IServiceProvider serviceProvider, IRedisService redisService,
        ICOSService cOSService)
    {
        _systemService = systemService;
        _usersService = usersService;
        _jwtTokenManager = jwtTokenManager;
        _context = aIBotProContext;
        _ai = ai;
        _financeService = financeService;
        _serviceProvider = serviceProvider;
        _redisService = redisService;
        _cosservice = cOSService;
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Upload([FromForm] IFormFile file, [FromForm] int chunkNumber,
        [FromForm] string fileName)
    {
        var path = await _systemService.UploadFileChunkAsync(file, chunkNumber, fileName,
            "wwwroot/files/referencedrawing");
        return Ok(new { path });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> MergeFiles([FromBody] MergeRequest request)
    {
        var uniqueFileName = Guid.NewGuid() + "_" + request.FileName; // 使用 GUID 生成唯一文件名
        //获取用户名
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var path = await _systemService.MergeFileAsync(uniqueFileName, request.TotalChunks, username,
            "wwwroot/files/referencedrawing");
        // 这里假设路径是内部文件系统路径。根据需要调整返回值。
        // 如果你想返回可以访问的URL，请生成和返回相应的URL。
        return Ok(new { path });
    }
    [Authorize]
    [HttpPost]
    public async Task<IActionResult> ImageUpload([FromForm] IFormFile file)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        string savePath = "wwwroot/files/mjupload";
        string path = _systemService.SaveFiles(savePath, file, username);
        return Ok(new
        {
            success = true,
            msg = path
        });
    }
    [Authorize]
    [HttpPost]
    public async Task<IActionResult> CreateMJTask(string prompt, string botType, string referenceImgPath,
        string drawmodel, List<string> blendImages, string FS, string dimensions, string yourFace, string starFace, bool agreeTerms = false)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var user = _usersService.GetUserData(username);
        if (user.Mcoin <= 0)
            return Ok(new
            {
                success = false,
                msg = "余额不足，请充值后再使用"
            });
        string cachefreemjkey = $"{username}-freemj";
        string cachefreemj = await _redisService.GetAsync(cachefreemjkey);
        int usecount = 0;
        if (!string.IsNullOrEmpty(cachefreemj) && agreeTerms)
        {
            usecount = int.Parse(cachefreemj);
        }
        if (usecount >= 3 && agreeTerms)
        {
            return Ok(new
            {
                success = false,
                msg = "免费次数已耗尽，请10分钟后继续"
            });
        }
        //从数据库获取AIdraw模型
        var aiModel = _context.AIdraws.AsNoTracking().Where(x => x.ModelName == botType).FirstOrDefault();
        if (aiModel == null)
            return Ok(new { success = false, msg = "AI模型不存在" });
        var chatSetting = _usersService.GetChatSetting(username);
        var needToPay = true;
        if (chatSetting != null && chatSetting.MyMidjourney != null &&
            !string.IsNullOrEmpty(chatSetting.MyMidjourney.BaseURL) &&
            !string.IsNullOrEmpty(chatSetting.MyMidjourney.ApiKey))
        {
            aiModel.BaseUrl = chatSetting.MyDall.BaseURL;
            aiModel.ApiKey = chatSetting.MyDall.ApiKey;
            needToPay = false;
        }
        if (agreeTerms)
        {
            needToPay = false;
            usecount++;
            await _redisService.SetAsync(cachefreemjkey, usecount.ToString(), TimeSpan.FromMinutes(10));
            await _systemService.WriteLog($"{username}:使用免费MJ绘画-CREATE", Dtos.LogLevel.Info, username);
        }
        //如果有参考图，则转base64
        string[] imageData = { };
        if (!string.IsNullOrEmpty(referenceImgPath))
        {
            var base64Image = await _systemService.ImgConvertToBase64(referenceImgPath);
            var dataHeader = "data:image/jpeg;base64,";
            imageData = new[] { dataHeader + base64Image };
        }
        string taskId = string.Empty;
        //发起请求
        if (FS == "imagine")
            taskId = await _ai.CreateMJdraw(prompt, botType, imageData, aiModel.BaseUrl, aiModel.ApiKey, drawmodel);
        else if (FS == "blend")
            taskId = await _ai.CreateMJdrawByBlend(botType, blendImages, aiModel.BaseUrl, aiModel.ApiKey, drawmodel, dimensions);
        else if (FS == "swap")
            taskId = await _ai.CreateMJdrawBySwap(botType, aiModel.BaseUrl, aiModel.ApiKey, drawmodel, yourFace, starFace);
        if (string.IsNullOrEmpty(taskId))
            return Ok(new { success = false, msg = "AI任务创建失败" });
        if (needToPay)
        {
            await _financeService.CreateUseLogAndUpadteMoney(username, $"{botType}-{drawmodel}", 0, 0, true);
            //taskId 写入缓存
            var key = $"{username}_MJtask";
            var task = new
            {
                taskId,
                type = "CREATE"
            };
            await _redisService.SetAsync(key, JsonConvert.SerializeObject(task), TimeSpan.FromHours(24));
        }

        return Ok(new { success = true, msg = "AI任务创建成功", taskId });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> CreateMJChange(string action, int index, string taskId, string drawmodel, bool agreeTerms = false)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var user = _usersService.GetUserData(username);
        if (user.Mcoin <= 0)
            return Ok(new
            {
                success = false,
                msg = "余额不足，请充值后再使用"
            });
        //从数据库获取AIdraw模型
        var aiModel = _context.AIdraws.AsNoTracking().Where(x => x.ModelName == "Midjourney").FirstOrDefault();
        if (aiModel == null)
            return Ok(new { success = false, msg = "AI模型不存在" });
        var chatSetting = _usersService.GetChatSetting(username);
        var needToPay = true;
        if (chatSetting != null && chatSetting.MyMidjourney != null &&
            !string.IsNullOrEmpty(chatSetting.MyMidjourney.BaseURL) &&
            !string.IsNullOrEmpty(chatSetting.MyMidjourney.ApiKey))
        {
            aiModel.BaseUrl = chatSetting.MyDall.BaseURL;
            aiModel.ApiKey = chatSetting.MyDall.ApiKey;
            needToPay = false;
        }
        if (agreeTerms)
        {
            needToPay = false;
            await _systemService.WriteLog($"{username}:使用免费MJ绘画-{action}", Dtos.LogLevel.Info, username);
        }
        //发起请求
        var newTaskId = await _ai.CreateMJchange(action, index, taskId, aiModel.BaseUrl, aiModel.ApiKey, drawmodel);
        if (string.IsNullOrEmpty(newTaskId))
            return Ok(new { success = false, msg = "AI任务创建失败" });
        if (needToPay)
        {
            await _financeService.CreateUseLogAndUpadteMoney(username, $"{action}-{drawmodel}", 0, 0, true);
            //taskId 写入缓存 10分钟
            var key = $"{username}_MJtask";
            var task = new
            {
                taskId = newTaskId,
                type = action
            };
            await _redisService.SetAsync(key, JsonConvert.SerializeObject(task), TimeSpan.FromHours(24));
        }

        return Ok(new { success = true, msg = "AI任务创建成功", taskId = newTaskId });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> GetMJTaskResponse(string taskId, bool agreeTerms = false)
    {
        try
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            //从数据库获取AIdraw模型
            var aiModel = _context.AIdraws.AsNoTracking().Where(x => x.ModelName == "Midjourney").FirstOrDefault();
            if (aiModel == null)
                return Ok(new { code = 1, msg = "AI模型不存在" });
            //获取对话设置
            var chatSetting = _usersService.GetChatSetting(username);
            if (chatSetting != null && chatSetting.MyMidjourney != null &&
                !string.IsNullOrEmpty(chatSetting.MyMidjourney.BaseURL) &&
                !string.IsNullOrEmpty(chatSetting.MyMidjourney.ApiKey))
            {
                aiModel.BaseUrl = chatSetting.MyMidjourney.BaseURL;
                aiModel.ApiKey = chatSetting.MyMidjourney.ApiKey;
            }

            var taskResponse = await _ai.GetMJTaskResponse(taskId, aiModel.BaseUrl, aiModel.ApiKey);
            if (taskResponse.status == "SUCCESS")
            {
                //生成完毕，下载图片
                var imgPath = taskResponse.imageUrl;
                //获取用户名
                var newFileName = DateTime.Now.ToString("yyyyMMdd") + "-" +
                                  Guid.NewGuid().ToString().Replace("-", "");
                var savePath = Path.Combine("wwwroot", "files/mjres", username);
                await _ai.DownloadImageAsync(imgPath, savePath, newFileName);
                var imgResPath = Path.Combine("/files/mjres", username, newFileName + ".png");
                var referenceImgPath = taskResponse.promptEn;
                var thumbKey = string.Empty;
                //查询是否启用了COS
                var systemCfg = _systemService.GetSystemCfgs();
                var cos_switch = systemCfg.FirstOrDefault(x => x.CfgKey == "COS_Switch");
                var thumbSavePath = _systemService.CompressImage(Path.Combine(savePath, newFileName + ".png"), 75);
                if (cos_switch != null)
                {
                    var cos_switch_val = cos_switch.CfgValue;
                    if (!string.IsNullOrEmpty(cos_switch_val) && cos_switch_val == "1")
                    {
                        var coskey = $"mjres/{DateTime.Now.ToString("yyyyMMdd")}/{newFileName}.png";
                        var thumbFileName = Path.GetFileName(thumbSavePath);
                        thumbKey = coskey.Replace(Path.GetFileName(imgResPath), thumbFileName);
                        imgResPath = _cosservice.PutObject(coskey, Path.Combine(savePath, newFileName + ".png"),
                            newFileName + ".png");
                        thumbSavePath = _cosservice.PutObject(thumbKey, thumbSavePath, thumbFileName);
                        referenceImgPath = coskey;
                    }
                }

                taskResponse.imageUrl = imgResPath;
                //保存结果到数据库
                if (agreeTerms)
                    username = "system";
                await _ai.SaveAiDrawResult(username, "Midjourney", imgResPath, taskResponse.prompt, referenceImgPath,
                thumbSavePath, thumbKey);
                var key = $"{username}_MJtask";
                await _redisService.DeleteAsync(key);
                return Ok(new { success = true, msg = "获取任务状态成功", taskResponse });
            }

            if (taskResponse != null)
                return Ok(new { success = true, msg = "获取任务状态成功", taskResponse });
            return Ok(new { success = false, msg = "获取任务状态失败" });
        }
        catch (Exception e)
        {
            _systemService.WriteLogUnAsync($"MJ绘画失败：{e.Message}", LogLevel.Error, "system");
            return Ok(new { success = false, msg = $"绘制失败：{e.Message}" });
        }
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> HasMJTask()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var key = $"{username}_MJtask";
        var value = await _redisService.GetAsync(key);
        if (value == null)
            return Ok(new
            {
                success = false
            });
        return Ok(new
        {
            success = true,
            data = value
        });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> CancelMJTask()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var key = $"{username}_MJtask";
        await _redisService.DeleteAsync(key);
        return Ok(new
        {
            success = true
        });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> CreateDALLTask(string prompt, string imgSize, string quality)
    {
        // 获取用户名
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var user = _usersService.GetUserData(username);
        if (user.Mcoin <= 0)
            return Ok(new
            {
                success = false,
                msg = "余额不足，请充值后再使用"
            });

        //从数据库获取AIdraw模型
        var aiModel = _context.AIdraws.AsNoTracking().Where(x => x.ModelName == "DALLE3").FirstOrDefault();
        if (aiModel == null)
            return Ok(new { success = false, msg = "AI模型不存在" });
        //获取对话设置
        var chatSetting = _usersService.GetChatSetting(username);
        var needToPay = true;
        if (chatSetting != null && chatSetting.MyDall != null &&
            !string.IsNullOrEmpty(chatSetting.MyDall.BaseURL) && !string.IsNullOrEmpty(chatSetting.MyDall.ApiKey))
        {
            aiModel.BaseUrl = chatSetting.MyDall.BaseURL;
            aiModel.ApiKey = chatSetting.MyDall.ApiKey;
            needToPay = false;
        }

        //发起请求
        var imgurl = await _ai.CreateDALLdraw(prompt, imgSize, quality, aiModel.BaseUrl, aiModel.ApiKey);
        if (string.IsNullOrEmpty(imgurl)) return Ok(new { success = false, msg = "AI任务创建失败" });

        // 直接返回在线图片链接给客户端
        // 注意：这里返回的是原始的在线图片链接
        if (needToPay)
            await _financeService.CreateUseLogAndUpadteMoney(username, "DALLE3", 0, 0, true);
        var newFileName = DateTime.Now.ToString("yyyyMMdd") + "-" +
                          Guid.NewGuid().ToString().Replace("-", "");
        var imgResPath = Path.Combine("/files/dallres", username, newFileName + ".png");
        var response = new { success = true, msg = "AI任务创建成功", imgurl, localhosturl = imgResPath };
        var referenceImgPath = prompt;
        var thumbKey = string.Empty;
        // 在后台启动一个任务下载图片
        _ = Task.Run(async () =>
        {
            using (var scope = _serviceProvider.CreateScope()) // _serviceProvider 是 IServiceProvider 的一个实例。
            {
                // 这里做一些后续处理，比如更新数据库记录等
                var savePath = Path.Combine("wwwroot", "files/dallres", username);
                var aiSaveService = scope.ServiceProvider.GetRequiredService<IAiServer>();
                var cosService = scope.ServiceProvider.GetRequiredService<ICOSService>();
                var systemService = scope.ServiceProvider.GetRequiredService<ISystemService>();
                await aiSaveService.DownloadImageAsync(imgurl, savePath, newFileName);
                var thumbSavePath = systemService.CompressImage(Path.Combine(savePath, newFileName + ".png"), 75);
                //查询是否启用了COS
                var systemCfg = systemService.GetSystemCfgs();
                var cos_switch = systemCfg.FirstOrDefault(x => x.CfgKey == "COS_Switch");
                if (cos_switch != null)
                {
                    var cos_switch_val = cos_switch.CfgValue;
                    if (!string.IsNullOrEmpty(cos_switch_val) && cos_switch_val == "1")
                    {
                        var coskey = $"dallres/{DateTime.Now.ToString("yyyyMMdd")}/{newFileName}.png";
                        var thumbFileName = Path.GetFileName(thumbSavePath);
                        thumbKey = coskey.Replace(Path.GetFileName(imgResPath), thumbFileName);
                        imgResPath = cosService.PutObject(coskey, Path.Combine(savePath, newFileName + ".png"),
                            newFileName + ".png");
                        thumbSavePath = cosService.PutObject(thumbKey, thumbSavePath, thumbFileName);
                        referenceImgPath = coskey;
                    }
                }

                await aiSaveService.SaveAiDrawResult(username, "DALLE3", imgResPath, prompt, referenceImgPath,
                    thumbSavePath, thumbKey);
            }
        });

        // 立即返回给客户端，不需要等待图片下载完成
        return Ok(response);
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> CreateSDTask(string prompt, string model, string imageSize, int numberImages,
        int seed, int inferenceSteps, float guidanceScale, string negativePrompt)
    {
        // 获取用户名
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var user = _usersService.GetUserData(username);
        if (user.Mcoin <= 0)
            return Ok(new
            {
                success = false,
                msg = "余额不足，请充值后再使用"
            });
        //从数据库获取AIdraw模型
        var aiModel = _context.AIdraws.AsNoTracking().Where(x => x.ModelName == "SD").FirstOrDefault();
        if (aiModel == null)
            return Ok(new { success = false, msg = "AI模型不存在" });
        //发起请求
        var sdResponse = new SDResponse();
        try
        {
            sdResponse = await _ai.CreateSDdraw(prompt, model, imageSize, numberImages, seed, inferenceSteps,
                guidanceScale, negativePrompt, aiModel.ApiKey, aiModel.BaseUrl, aiModel.Channel);
            if (sdResponse == null || sdResponse.Images.Count == 0)
                return Ok(new { success = false, msg = "AI任务创建失败" });
        }
        catch (Exception)
        {
            return Ok(new { success = false, msg = "AI任务创建失败" });
        }


        var imgurls = new List<string>();
        for (var i = 0; i < sdResponse.Images.Count; i++)
        {
            await _financeService.CreateUseLogAndUpadteMoney(username, model, 0, 0, true);

            var newFileName = $"{Guid.NewGuid()}";
            var savePath = Path.Combine("wwwroot", "files/sdres", username);
            await _ai.DownloadImageAsync(sdResponse.Images[i].Url, savePath, newFileName);
            var imgResPath = $"wwwroot/files/sdres/{username}/{newFileName}.png";
            var thumbKey = string.Empty;
            var referenceImgPath = prompt;
            imgurls.Add(sdResponse.Images[i].Url);

            _ = Task.Run(async () =>
            {
                using (var scope = _serviceProvider.CreateScope())
                {
                    var aiSaveService = scope.ServiceProvider.GetRequiredService<IAiServer>();
                    var cosService = scope.ServiceProvider.GetRequiredService<ICOSService>();
                    var systemService = scope.ServiceProvider.GetRequiredService<ISystemService>();
                    var thumbSavePath = systemService.CompressImage(imgResPath, 75);

                    //查询是否启用了COS
                    var systemCfg = systemService.GetSystemCfgs();
                    var cos_switch = systemCfg.FirstOrDefault(x => x.CfgKey == "COS_Switch");
                    if (cos_switch != null && cos_switch.CfgValue == "1")
                    {
                        var coskey = $"sdres/{DateTime.Now.ToString("yyyyMMdd")}/{newFileName}.png";
                        var thumbFileName = Path.GetFileName(thumbSavePath);
                        thumbKey = coskey.Replace(Path.GetFileName(imgResPath), thumbFileName);
                        imgResPath = cosService.PutObject(coskey, imgResPath, $"{newFileName}.png");
                        thumbSavePath = cosService.PutObject(thumbKey, thumbSavePath, thumbFileName);
                        referenceImgPath = coskey;
                    }

                    await aiSaveService.SaveAiDrawResult(username, model, imgResPath, prompt, referenceImgPath,
                        thumbSavePath, thumbKey ?? string.Empty);
                }
            });
        }

        var response = new { success = true, msg = "AI任务创建成功", imgurls };
        return Ok(response);
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> GetAIdrawResList(int page, int pageSize, string role = "")
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var resList = await _ai.GetAIdrawResList(username, page, pageSize, role);
        return Ok(new
        {
            success = true,
            data = resList
        });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> DeleteAIdrawRes(int id)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var res = await _context.AIdrawRes.FirstOrDefaultAsync(x => x.Id == id);
        if (res != null && res.Account == username)
        {
            _context.AIdrawRes.Remove(res);
            await _context.SaveChangesAsync();
            var systemCfg = _systemService.GetSystemCfgs();
            var cos_switch = systemCfg.FirstOrDefault(x => x.CfgKey == "COS_Switch");
            //删除文件
            if (cos_switch != null)
            {
                var cos_switch_val = cos_switch.CfgValue;
                if (!string.IsNullOrEmpty(cos_switch_val) && cos_switch_val == "1")
                {
                    _cosservice.DeleteObject(res.ReferenceImgPath);
                    if (!string.IsNullOrEmpty(res.ThumbSavePath))
                        _cosservice.DeleteObject(res.ThumbKey);
                }
                else
                {
                    _systemService.DeleteFile($"wwwroot{res.ImgSavePath}");
                    if (!string.IsNullOrEmpty(res.ThumbSavePath))
                        _systemService.DeleteFile(res.ThumbSavePath);
                }
            }
            else
            {
                _systemService.DeleteFile($"wwwroot{res.ImgSavePath}");
            }

            return Ok(new { success = true, msg = "删除成功" });
        }

        return Ok(new { success = false, msg = "删除失败" });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> EnglishPrompt(string prompt)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var systemPrompt =
            @"You are a sophisticated multilingual translation assistant. Translate the following text into English and output the result in a JSON format. 
                             The JSON should contain a key named 'translatedText' that stores the translated English sentence.
                             Here is an example json return value：
                             {
                                'translatedText': 'Your translated English text will appear here'
                             }";
        prompt = $"Text waiting to be translated: {prompt}";
        var resultJson = await _ai.GPTJsonModel(systemPrompt, prompt, "gpt-4o-mini", username);
        if (!string.IsNullOrEmpty(resultJson))
        {
            var resultData = JsonConvert.DeserializeObject<TranslationResult>(resultJson);
            if (resultData != null && !string.IsNullOrEmpty(resultData.TranslatedText))
                return Ok(new
                {
                    success = true,
                    data = resultData.TranslatedText
                });
        }

        return Ok(new
        {
            success = false
        });
    }
    [Authorize]
    [HttpPost]
    public async Task<IActionResult> CreateSunoTask(string mode, string gptDescription, string prompt, string tags, string mv, string title)
    {
        if (mode != "inspiration" && mode != "custom")
            return Ok(new
            {
                success = false,
                msg = "生成失败,请重试！"
            });
        var username = _jwtTokenManager
           .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var user = _usersService.GetUserData(username);
        if (user.Mcoin <= 0)
            return Ok(new
            {
                success = false,
                msg = "余额不足，请充值后再使用"
            });
        //从数据库获取AIdraw模型
        var aiModel = _context.AIdraws.AsNoTracking().Where(x => x.ModelName == "Suno").FirstOrDefault();
        if (aiModel == null)
            return Ok(new { success = false, msg = "AI模型不存在" });
        string oldTask = await _redisService.GetAsync($"{username}-suno");
        if (!string.IsNullOrEmpty(oldTask))
        {
            return Ok(new
            {
                success = false,
                msg = "有任务正在进行中，请结束后再生成"
            });
        }
        //查询 baseUrl和APIkey

        string taskId = await _ai.CreateSunoTask(mode, gptDescription, prompt, tags, mv, title, aiModel.BaseUrl, aiModel.ApiKey, username);
        if (!string.IsNullOrEmpty(taskId))
        {
            await _financeService.CreateUseLogAndUpadteMoney(username, mode, 0, 0, false);
            return Ok(new
            {
                success = true,
                data = taskId
            });
        }
        else
            return Ok(new
            {
                success = false,
                msg = "生成失败,请重试！"
            });
    }

    [Authorize]
    [HttpPost]

    public async Task<IActionResult> GetSunoTask()
    {
        var username = _jwtTokenManager
           .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        string taskId = await _redisService.GetAsync($"{username}-suno");
        //从数据库获取AIdraw模型
        var aiModel = _context.AIdraws.AsNoTracking().Where(x => x.ModelName == "Suno").FirstOrDefault();
        if (aiModel == null)
            return Ok(new { success = false, msg = "AI模型不存在" });
        if (!string.IsNullOrEmpty(taskId))
        {
            var result = await _ai.GetSunoTask(taskId, username, aiModel.BaseUrl, aiModel.ApiKey);
            return Ok(new
            {
                success = true,
                data = result
            });
        }
        else
        {
            return Ok(new
            {
                success = false,
                msg = "无任务"
            });
        }
    }

    [Authorize]
    [HttpPost]
    public IActionResult GetSongList(string keyword, int page = 1, int pageSize = 20)
    {
        var username = _jwtTokenManager
           .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

        var query = _context.SunoRes.AsNoTracking()
            .Where(s => s.Account == username);

        if (!string.IsNullOrEmpty(keyword))
        {
            // 如果有搜索关键词，不分页，返回所有匹配结果
            query = query.Where(s => s.Prompt.Contains(keyword) || s.Title.Contains(keyword));
            var searchResults = query.OrderByDescending(x => x.CreateTime).ToList();

            return Ok(new
            {
                success = true,
                data = searchResults,
                isSearch = true
            });
        }
        else
        {
            // 如果没有搜索关键词，使用分页
            var pagedResults = query
                .OrderByDescending(x => x.CreateTime)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            return Ok(new
            {
                success = true,
                data = pagedResults,
                isSearch = false
            });
        }
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> DeleteSunoRes(int id)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

        var res = await _context.SunoRes.FirstOrDefaultAsync(x => x.Id == id && x.Account == username);
        if (res != null && res.Account == username)
        {
            _context.SunoRes.Remove(res);
            await _context.SaveChangesAsync();

            var systemCfg = _systemService.GetSystemCfgs();
            var cos_switch = systemCfg.FirstOrDefault(x => x.CfgKey == "COS_Switch");

            // 删除文件
            if (cos_switch != null && cos_switch.CfgValue == "1")
            {
                // COS 启用，删除 COS 上的文件
                if (!string.IsNullOrEmpty(res.ImageCosKey))
                    _cosservice.DeleteObject(res.ImageCosKey);
                if (!string.IsNullOrEmpty(res.ImageLargeCosKey))
                    _cosservice.DeleteObject(res.ImageLargeCosKey);
                if (!string.IsNullOrEmpty(res.AudioCosKey))
                    _cosservice.DeleteObject(res.AudioCosKey);
                if (!string.IsNullOrEmpty(res.VideoCosKey))
                    _cosservice.DeleteObject(res.VideoCosKey);
            }
            else
            {
                // COS 未启用，删除本地文件
                if (!string.IsNullOrEmpty(res.ImageUrl))
                    _systemService.DeleteFile($"wwwroot{res.ImageUrl}");
                if (!string.IsNullOrEmpty(res.ImageLargeUrl))
                    _systemService.DeleteFile($"wwwroot{res.ImageLargeUrl}");
                if (!string.IsNullOrEmpty(res.AudioUrl))
                    _systemService.DeleteFile($"wwwroot{res.AudioUrl}");
                if (!string.IsNullOrEmpty(res.VideoUrl))
                    _systemService.DeleteFile($"wwwroot{res.VideoUrl}");
            }

            return Ok(new { success = true, msg = "删除成功" });
        }

        return Ok(new { success = false, msg = "删除失败" });
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> DownloadSuno(int id)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

        var res = await _context.SunoRes.FirstOrDefaultAsync(x => x.Id == id && x.Account == username);
        if (res == null)
        {
            return NotFound(new { success = false, msg = "资源不存在或无权访问" });
        }

        string downloadKey = $"{username}-sunodownload";
        string downloadCountStr = await _redisService.GetAsync(downloadKey);
        int downloadCount = string.IsNullOrEmpty(downloadCountStr) ? 0 : int.Parse(downloadCountStr);

        if (downloadCount >= 10)
        {
            return BadRequest(new { success = false, msg = "您已达到每小时下载限制（10次）" });
        }
        var tempDirName = Guid.NewGuid().ToString();
        var tempDir = Path.Combine("wwwroot", "files", "temp", tempDirName);
        Directory.CreateDirectory(tempDir);
        try
        {

            var filesToDownload = new Dictionary<string, string>
        {
            { "image", res.ImageUrl },
            { "image_large", res.ImageLargeUrl },
            { "audio", res.AudioUrl },
            { "video", res.VideoUrl }
        };

            foreach (var file in filesToDownload)
            {
                if (!string.IsNullOrEmpty(file.Value))
                {
                    var downloadedPath = await _systemService.DownloadFileByUrl(file.Value, tempDir, username);
                    if (downloadedPath != null)
                    {
                        var extension = Path.GetExtension(downloadedPath);
                        var newFileName = $"{file.Key}{extension}";
                        System.IO.File.Move(downloadedPath, Path.Combine(tempDir, newFileName));
                    }
                }
            }

            var zipFileName = $"Suno_{id}.zip";
            var zipPath = Path.Combine("wwwroot", "files", "temp", zipFileName);
            ZipFile.CreateFromDirectory(tempDir, zipPath);

            var memory = new MemoryStream();
            using (var stream = new FileStream(zipPath, FileMode.Open))
            {
                await stream.CopyToAsync(memory);
            }
            memory.Position = 0;

            // 清理临时文件
            Directory.Delete(tempDir, true);
            System.IO.File.Delete(zipPath);

            // Increase download count
            await _redisService.SetAsync(downloadKey, (++downloadCount).ToString(), TimeSpan.FromHours(1));

            return File(memory, "application/zip", zipFileName);
        }
        catch (Exception ex)
        {
            // 确保在发生异常时也清理临时文件
            if (Directory.Exists(tempDir))
            {
                Directory.Delete(tempDir, true);
            }
            await _systemService.WriteLog("下载过程中发生错误:" + ex.Message, Dtos.LogLevel.Error, username);
            throw ex;
        }
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> StopGenerate()
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        string key = $"{username}-suno";
        await _redisService.DeleteAsync(key);
        return Ok(new { success = true });
    }
}