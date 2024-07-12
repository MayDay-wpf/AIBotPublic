using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Humanizer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using OpenAI.ObjectModels.ResponseModels;
using System;
using System.Security.Principal;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using static OpenAI.ObjectModels.StaticValues.ImageStatics;
using static System.Formats.Asn1.AsnWriter;

namespace aibotPro.Controllers
{
    public class AIdrawController : Controller
    {
        private readonly ISystemService _systemService;
        private readonly IUsersService _usersService;
        private readonly JwtTokenManager _jwtTokenManager;
        private readonly AIBotProContext _context;
        private readonly IAiServer _ai;
        private readonly IFinanceService _financeService;
        private readonly IServiceProvider _serviceProvider;
        private readonly IRedisService _redisService;
        private readonly ICOSService _cosservice;

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
            var uniqueFileName = Guid.NewGuid().ToString() + "_" + request.FileName; // 使用 GUID 生成唯一文件名
            //获取用户名
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var path = await _systemService.MergeFileAsync(uniqueFileName, request.TotalChunks, username,
                "wwwroot/files/referencedrawing");
            // 这里假设路径是内部文件系统路径。根据需要调整返回值。
            // 如果你想返回可以访问的URL，请生成和返回相应的URL。
            return Ok(new { path = path });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> CreateMJTask(string prompt, string botType, string referenceImgPath, string drawmodel)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var user = _usersService.GetUserData(username);
            if (user.Mcoin <= 0)
            {
                return Ok(new
                {
                    success = false,
                    msg = "余额不足，请充值后再使用"
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

            //如果有参考图，则转base64
            string[] imageData = { };
            if (!string.IsNullOrEmpty(referenceImgPath))
            {
                string base64Image = await _systemService.ImgConvertToBase64(referenceImgPath);
                string dataHeader = "data:image/jpeg;base64,";
                imageData = new string[] { dataHeader + base64Image };
            }

            //发起请求
            string taskId = await _ai.CreateMJdraw(prompt, botType, imageData, aiModel.BaseUrl, aiModel.ApiKey, drawmodel);
            if (string.IsNullOrEmpty(taskId))
                return Ok(new { success = false, msg = "AI任务创建失败" });
            if (needToPay)
            {
                await _financeService.CreateUseLogAndUpadteMoney(username, $"{botType}-{drawmodel}", 0, 0, true);
                //taskId 写入缓存
                string key = $"{username}_MJtask";
                var task = new
                {
                    taskId = taskId,
                    type = "CREATE"
                };
                await _redisService.SetAsync(key, JsonConvert.SerializeObject(task), TimeSpan.FromHours(24));
            }

            return Ok(new { success = true, msg = "AI任务创建成功", taskId = taskId });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> CreateMJChange(string action, int index, string taskId, string drawmodel)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var user = _usersService.GetUserData(username);
            if (user.Mcoin <= 0)
            {
                return Ok(new
                {
                    success = false,
                    msg = "余额不足，请充值后再使用"
                });
            }

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

            //发起请求
            string newTaskId = await _ai.CreateMJchange(action, index, taskId, aiModel.BaseUrl, aiModel.ApiKey, drawmodel);
            if (string.IsNullOrEmpty(newTaskId))
                return Ok(new { success = false, msg = "AI任务创建失败" });
            if (needToPay)
            {
                await _financeService.CreateUseLogAndUpadteMoney(username, $"{action}-{drawmodel}", 0, 0, true);
                //taskId 写入缓存 10分钟
                string key = $"{username}_MJtask";
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
        public async Task<IActionResult> GetMJTaskResponse(string taskId)
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
                if (chatSetting != null && chatSetting.MyDall != null &&
                    !string.IsNullOrEmpty(chatSetting.MyDall.BaseURL) &&
                    !string.IsNullOrEmpty(chatSetting.MyDall.ApiKey))
                {
                    aiModel.BaseUrl = chatSetting.MyDall.BaseURL;
                    aiModel.ApiKey = chatSetting.MyDall.ApiKey;
                }

                TaskResponse taskResponse = await _ai.GetMJTaskResponse(taskId, aiModel.BaseUrl, aiModel.ApiKey);
                if (taskResponse.status == "SUCCESS")
                {
                    //生成完毕，下载图片
                    string imgPath = taskResponse.imageUrl;
                    //获取用户名
                    string newFileName = DateTime.Now.ToString("yyyyMMdd") + "-" +
                                         Guid.NewGuid().ToString().Replace("-", "");
                    string savePath = Path.Combine("wwwroot", "files/mjres", username);
                    await _ai.DownloadImageAsync(imgPath, savePath, newFileName);
                    string imgResPath = Path.Combine("/files/mjres", username, newFileName + ".png");
                    string referenceImgPath = taskResponse.promptEn;
                    string thumbKey = string.Empty;
                    //查询是否启用了COS
                    var systemCfg = _systemService.GetSystemCfgs();
                    var cos_switch = systemCfg.FirstOrDefault(x => x.CfgKey == "COS_Switch");
                    string thumbSavePath = _systemService.CompressImage(Path.Combine(savePath, newFileName + ".png"), 75);
                    if (cos_switch != null)
                    {
                        string cos_switch_val = cos_switch.CfgValue;
                        if (!string.IsNullOrEmpty(cos_switch_val) && cos_switch_val == "1")
                        {
                            string coskey = $"mjres/{DateTime.Now.ToString("yyyyMMdd")}/{newFileName}.png";
                            string thumbFileName = System.IO.Path.GetFileName(thumbSavePath);
                            thumbKey = coskey.Replace(System.IO.Path.GetFileName(imgResPath), thumbFileName);
                            imgResPath = _cosservice.PutObject(coskey, Path.Combine(savePath, newFileName + ".png"), newFileName + ".png");
                            thumbSavePath = _cosservice.PutObject(thumbKey, thumbSavePath, thumbFileName);
                            referenceImgPath = coskey;
                        }
                    }

                    taskResponse.imageUrl = imgResPath;
                    //保存结果到数据库
                    await _ai.SaveAiDrawResult(username, "Midjourney", imgResPath, taskResponse.prompt, referenceImgPath, thumbSavePath, thumbKey);
                    string key = $"{username}_MJtask";
                    await _redisService.DeleteAsync(key);
                    return Ok(new { success = true, msg = "获取任务状态成功", taskResponse = taskResponse });
                }

                if (taskResponse != null)
                {
                    return Ok(new { success = true, msg = "获取任务状态成功", taskResponse = taskResponse });
                }
                else
                {
                    return Ok(new { success = false, msg = "获取任务状态失败" });
                }
            }
            catch (Exception e)
            {
                _systemService.WriteLogUnAsync($"MJ绘画失败：{e.Message}", Dtos.LogLevel.Error, "system");
                return Ok(new { success = false, msg = $"绘制失败：{e.Message}" });
            }
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> HasMJTask()
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            string key = $"{username}_MJtask";
            var value = await _redisService.GetAsync(key);
            if (value == null)
            {
                return Ok(new
                {
                    success = false
                });
            }
            else
            {
                return Ok(new
                {
                    success = true,
                    data = value
                });
            }
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> CancelMJTask()
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            string key = $"{username}_MJtask";
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
            {
                return Ok(new
                {
                    success = false,
                    msg = "余额不足，请充值后再使用"
                });
            }

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
            string imgurl = await _ai.CreateDALLdraw(prompt, imgSize, quality, aiModel.BaseUrl, aiModel.ApiKey);
            if (string.IsNullOrEmpty(imgurl))
                return Ok(new { success = false, msg = "AI任务创建失败" });
            else
            {
                // 直接返回在线图片链接给客户端
                // 注意：这里返回的是原始的在线图片链接
                if (needToPay)
                    await _financeService.CreateUseLogAndUpadteMoney(username, "DALLE3", 0, 0, true);
                string newFileName = DateTime.Now.ToString("yyyyMMdd") + "-" +
                                     Guid.NewGuid().ToString().Replace("-", "");
                string imgResPath = Path.Combine("/files/dallres", username, newFileName + ".png");
                var response = new { success = true, msg = "AI任务创建成功", imgurl = imgurl, localhosturl = imgResPath };
                string referenceImgPath = prompt;
                string thumbKey = string.Empty;
                // 在后台启动一个任务下载图片
                Task.Run(async () =>
                {
                    using (var scope = _serviceProvider.CreateScope()) // _serviceProvider 是 IServiceProvider 的一个实例。
                    {
                        // 这里做一些后续处理，比如更新数据库记录等
                        string savePath = Path.Combine("wwwroot", "files/dallres", username);
                        await _ai.DownloadImageAsync(imgurl, savePath, newFileName);
                        var aiSaveService =
                            scope.ServiceProvider.GetRequiredService<IAiServer>(); // 假设保存记录方法在IAiSaveService中。
                        var cosService = scope.ServiceProvider.GetRequiredService<ICOSService>();
                        var systemService = scope.ServiceProvider.GetRequiredService<ISystemService>();
                        string thumbSavePath =
                            systemService.CompressImage(Path.Combine(savePath, newFileName + ".png"), 75);
                        //查询是否启用了COS
                        var systemCfg = systemService.GetSystemCfgs();
                        var cos_switch = systemCfg.FirstOrDefault(x => x.CfgKey == "COS_Switch");
                        if (cos_switch != null)
                        {
                            string cos_switch_val = cos_switch.CfgValue;
                            if (!string.IsNullOrEmpty(cos_switch_val) && cos_switch_val == "1")
                            {
                                string coskey = $"dallres/{DateTime.Now.ToString("yyyyMMdd")}/{newFileName}.png";
                                string thumbFileName = System.IO.Path.GetFileName(thumbSavePath);
                                thumbKey = coskey.Replace(System.IO.Path.GetFileName(imgResPath), thumbFileName);
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
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> CreateSDTask(string prompt, string model, string imageSize, int numberImages, int seed, int inferenceSteps, float guidanceScale, string negativePrompt)
        {
            // 获取用户名
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var user = _usersService.GetUserData(username);
            if (user.Mcoin <= 0)
            {
                return Ok(new
                {
                    success = false,
                    msg = "余额不足，请充值后再使用"
                });
            }
            //从数据库获取AIdraw模型
            var aiModel = _context.AIdraws.AsNoTracking().Where(x => x.ModelName == "SD").FirstOrDefault();
            if (aiModel == null)
                return Ok(new { success = false, msg = "AI模型不存在" });
            //发起请求
            SDResponse sdResponse = new SDResponse();
            try
            {
                sdResponse = await _ai.CreateSDdraw(prompt, model, imageSize, numberImages, seed, inferenceSteps, guidanceScale, negativePrompt, aiModel.ApiKey, aiModel.BaseUrl, aiModel.Channel);
                if (sdResponse == null || sdResponse.Images.Count == 0)
                    return Ok(new { success = false, msg = "AI任务创建失败" });
            }
            catch (Exception)
            {
                return Ok(new { success = false, msg = "AI任务创建失败" });
            }


            List<string> imgurls = new List<string>();
            for (var i = 0; i < sdResponse.Images.Count; i++)
            {
                await _financeService.CreateUseLogAndUpadteMoney(username, model, 0, 0, true);

                string newFileName = $"{Guid.NewGuid()}";
                string savePath = Path.Combine("wwwroot", "files/sdres", username);
                await _ai.DownloadImageAsync(sdResponse.Images[i].Url, savePath, newFileName);
                string imgResPath = $"wwwroot/files/sdres/{username}/{newFileName}.png";
                string thumbKey = string.Empty;
                string referenceImgPath = prompt;
                imgurls.Add(sdResponse.Images[i].Url);

                _ = Task.Run(async () =>
                 {
                     using (var scope = _serviceProvider.CreateScope())
                     {
                         var aiSaveService = scope.ServiceProvider.GetRequiredService<IAiServer>();
                         var cosService = scope.ServiceProvider.GetRequiredService<ICOSService>();
                         var systemService = scope.ServiceProvider.GetRequiredService<ISystemService>();
                         string thumbSavePath = systemService.CompressImage(imgResPath, 75);

                         //查询是否启用了COS
                         var systemCfg = systemService.GetSystemCfgs();
                         var cos_switch = systemCfg.FirstOrDefault(x => x.CfgKey == "COS_Switch");
                         if (cos_switch != null && cos_switch.CfgValue == "1")
                         {
                             string coskey = $"sdres/{DateTime.Now.ToString("yyyyMMdd")}/{newFileName}.png";
                             string thumbFileName = Path.GetFileName(thumbSavePath);
                             thumbKey = coskey.Replace(Path.GetFileName(imgResPath), thumbFileName);
                             imgResPath = cosService.PutObject(coskey, imgResPath, $"{newFileName}.png");
                             thumbSavePath = cosService.PutObject(thumbKey, thumbSavePath, thumbFileName);
                             referenceImgPath = coskey;
                         }

                         await aiSaveService.SaveAiDrawResult(username, model, imgResPath, prompt, referenceImgPath, thumbSavePath, thumbKey ?? string.Empty);
                     }
                 });
            }

            var response = new { success = true, msg = "AI任务创建成功", imgurls = imgurls };
            return Ok(response);
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> GetAIdrawResList(int page, int pageSize)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var resList = await _ai.GetAIdrawResList(username, page, pageSize);
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
                    string cos_switch_val = cos_switch.CfgValue;
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
            else
            {
                return Ok(new { success = false, msg = "删除失败" });
            }
        }
    }
}