using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Humanizer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Principal;
using System.Threading.Tasks;
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
        public AIdrawController(ISystemService systemService, IUsersService usersService, JwtTokenManager jwtTokenManager, AIBotProContext aIBotProContext, IAiServer ai, IFinanceService financeService, IServiceProvider serviceProvider)
        {
            _systemService = systemService;
            _usersService = usersService;
            _jwtTokenManager = jwtTokenManager;
            _context = aIBotProContext;
            _ai = ai;
            _financeService = financeService;
            _serviceProvider = serviceProvider;
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> Upload([FromForm] IFormFile file, [FromForm] int chunkNumber, [FromForm] string fileName)
        {
            var path = await _systemService.UploadFileChunkAsync(file, chunkNumber, fileName, "wwwroot/files/referencedrawing");
            return Ok(new { path });
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> MergeFiles([FromBody] MergeRequest request)
        {
            var uniqueFileName = Guid.NewGuid().ToString() + "_" + request.FileName; // 使用 GUID 生成唯一文件名
            //获取用户名
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var path = await _systemService.MergeFileAsync(uniqueFileName, request.TotalChunks, username, "wwwroot/files/referencedrawing");
            // 这里假设路径是内部文件系统路径。根据需要调整返回值。
            // 如果你想返回可以访问的URL，请生成和返回相应的URL。
            return Ok(new { path = path });
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> CreateMJTask(string prompt, string botType, string referenceImgPath)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
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
            if (chatSetting != null && chatSetting.MyMidjourney != null && !string.IsNullOrEmpty(chatSetting.MyMidjourney.BaseURL) && !string.IsNullOrEmpty(chatSetting.MyMidjourney.ApiKey))
            {
                aiModel.BaseUrl = chatSetting.MyDall.BaseURL;
                aiModel.ApiKey = chatSetting.MyDall.ApiKey;
                needToPay = false;
            }
            //如果有参考图，则转base64
            string[] imageData = { };
            if (!string.IsNullOrEmpty(referenceImgPath))
            {
                string base64Image = _systemService.ImgConvertToBase64(referenceImgPath);
                string dataHeader = "data:image/jpeg;base64,";
                imageData = new string[] { dataHeader + base64Image };
            }
            //发起请求
            string taskId = await _ai.CreateMJdraw(prompt, botType, imageData, aiModel.BaseUrl, aiModel.ApiKey);
            if (string.IsNullOrEmpty(taskId))
                return Ok(new { success = false, msg = "AI任务创建失败" });
            if (needToPay)
                await _financeService.CreateUseLogAndUpadteMoney(username, "Midjourney", 0, 0, true);
            return Ok(new { success = true, msg = "AI任务创建成功", taskId = taskId });
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> CreateMJChange(string action, int index, string taskId)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
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
            if (chatSetting != null && chatSetting.MyMidjourney != null && !string.IsNullOrEmpty(chatSetting.MyMidjourney.BaseURL) && !string.IsNullOrEmpty(chatSetting.MyMidjourney.ApiKey))
            {
                aiModel.BaseUrl = chatSetting.MyDall.BaseURL;
                aiModel.ApiKey = chatSetting.MyDall.ApiKey;
                needToPay = false;
            }
            //发起请求
            string newTaskId = await _ai.CreateMJchange(action, index, taskId, aiModel.BaseUrl, aiModel.ApiKey);
            if (string.IsNullOrEmpty(newTaskId))
                return Ok(new { success = false, msg = "AI任务创建失败" });
            if (needToPay)
                await _financeService.CreateUseLogAndUpadteMoney(username, action, 0, 0, true);
            return Ok(new { success = true, msg = "AI任务创建成功", taskId = newTaskId });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> GetMJTaskResponse(string taskId)
        {
            try
            {
                var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
                //从数据库获取AIdraw模型
                var aiModel = _context.AIdraws.AsNoTracking().Where(x => x.ModelName == "Midjourney").FirstOrDefault();
                if (aiModel == null)
                    return Ok(new { code = 1, msg = "AI模型不存在" });
                //获取对话设置
                var chatSetting = _usersService.GetChatSetting(username);
                if (chatSetting != null && chatSetting.MyDall != null && !string.IsNullOrEmpty(chatSetting.MyDall.BaseURL) && !string.IsNullOrEmpty(chatSetting.MyDall.ApiKey))
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
                    string newFileName = DateTime.Now.ToString("yyyyMMdd") + "-" + Guid.NewGuid().ToString().Replace("-", "");
                    string savePath = Path.Combine("wwwroot", "files/mjres", username);
                    await _ai.DownloadImageAsync(imgPath, savePath, newFileName);
                    string imgResPath = Path.Combine("/files/mjres", username, newFileName + ".png");
                    taskResponse.imageUrl = imgResPath;
                    //保存结果到数据库
                    await _ai.SaveAiDrawResult(username, "Midjourney", imgResPath, taskResponse.prompt, taskResponse.promptEn);
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
        public async Task<IActionResult> CreateDALLTask(string prompt, string imgSize, string quality)
        {

            // 获取用户名
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
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
            if (chatSetting != null && chatSetting.MyDall != null && !string.IsNullOrEmpty(chatSetting.MyDall.BaseURL) && !string.IsNullOrEmpty(chatSetting.MyDall.ApiKey))
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
                string newFileName = DateTime.Now.ToString("yyyyMMdd") + "-" + Guid.NewGuid().ToString().Replace("-", "");
                string imgResPath = Path.Combine("/files/dallres", username, newFileName + ".png");
                var response = new { success = true, msg = "AI任务创建成功", imgurl = imgurl, localhosturl = imgResPath };
                // 在后台启动一个任务下载图片
                Task.Run(async () =>
                {
                    using (var scope = _serviceProvider.CreateScope()) // _serviceProvider 是 IServiceProvider 的一个实例。
                    {
                        // 这里做一些后续处理，比如更新数据库记录等
                        string savePath = Path.Combine("wwwroot", "files/dallres", username);
                        await _ai.DownloadImageAsync(imgurl, savePath, newFileName);
                        var aiSaveService = scope.ServiceProvider.GetRequiredService<IAiServer>(); // 假设保存记录方法在IAiSaveService中。
                        await aiSaveService.SaveAiDrawResult(username, "DALLE3", imgResPath, prompt, prompt);
                    }
                });

                // 立即返回给客户端，不需要等待图片下载完成
                return Ok(response);
            }
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> GetAIdrawResList(int page, int pageSize)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
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
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var res = await _context.AIdrawRes.FirstOrDefaultAsync(x => x.Id == id);
            if (res != null && res.Account == username)
            {
                _context.AIdrawRes.Remove(res);
                await _context.SaveChangesAsync();
                //删除文件
                _systemService.DeleteFile($"wwwroot{res.ImgSavePath}");
                return Ok(new { success = true, msg = "删除成功" });
            }
            else
            {
                return Ok(new { success = false, msg = "删除失败" });
            }
        }
    }
}
