using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xabe.FFmpeg;
using static Google.Apis.Requests.BatchRequest;

namespace aibotPro.Controllers
{
    public class ProductController : Controller
    {
        private readonly IAiServer _aiServer;
        private readonly ISystemService _systemService;
        private readonly JwtTokenManager _jwtTokenManager;
        public ProductController(IAiServer aiServer, ISystemService systemService, JwtTokenManager jwtTokenManager)
        {
            _aiServer = aiServer;
            _systemService = systemService;
            _jwtTokenManager = jwtTokenManager;
        }
        public IActionResult ChatGrid()
        {
            return View();
        }
        public IActionResult AiMarketing()
        {
            return View();
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> CreateTTSMP3(string text, string voice)
        {
            string result = await _aiServer.TTS(text, "tts-1", voice);
            return Json(new
            {
                success = true,
                data = result
            });
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> CombineMP3([FromBody] CombineMP3Request request)
        {
            //合并MP3
            List<string> pathlists = request.Pathlist;
            string outputPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/files/audio", $"output/{DateTime.Now.ToString("yyyyMMdd")}");
            //没有目录则创建
            if (!Directory.Exists(outputPath))
            {
                Directory.CreateDirectory(outputPath);
            }
            outputPath = Path.Combine(outputPath, $"{Guid.NewGuid().ToString().Replace("-", "")}.mp3");
            // 使用FileStream来创建/覆盖输出文件
            using (var outputStream = new FileStream(outputPath, FileMode.Create))
            {
                // 遍历提供的路径，逐一读取文件并写入到输出文件中
                foreach (var path in pathlists)
                {
                    // 检查文件是否存在
                    if (System.IO.File.Exists(path))
                    {
                        // 读取每个文件的字节并写入输出文件
                        byte[] mp3Bytes = await System.IO.File.ReadAllBytesAsync(path);
                        await outputStream.WriteAsync(mp3Bytes, 0, mp3Bytes.Length);
                    }
                }
            }
            //outputPath只取相对路径
            outputPath = outputPath.Replace(Directory.GetCurrentDirectory(), "").Replace("\\", "/");
            // 返回操作结果，包括合并后文件的路径或其他信息
            return Json(new
            {
                success = true,
                data = outputPath
            });
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> CreateLens(string model, string text, string systemPrompt)
        {
            //testModel:gpt-4-turbo-preview
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            //去除text中的换行
            text = text.Replace("\r\n", " ").Replace("\n", " ");
            var result = await _aiServer.GPTJsonModel(systemPrompt, text, model, username);
            //反序列化
            JObject jsonObj = JsonConvert.DeserializeObject<JObject>(result);
            try
            {
                StoryboardObject SB = JsonConvert.DeserializeObject<StoryboardObject>(jsonObj.ToString());
                await _systemService.WriteLog($"用户{username}创建了一个{model}的Lens", Dtos.LogLevel.Info, username);
                return Json(new
                {
                    success = true,
                    data = SB
                });
            }
            catch (Exception)
            {
                return Json(new
                {
                    success = false,
                    data = result
                });
            }

        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> CreateVideo([FromBody] ImgListRequest request)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var combinedMp3 = $"wwwroot{request.CombinedMp3}";
            var outputPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "files", "video", $"output/{DateTime.Now:yyyyMMdd}");

            if (!Directory.Exists(outputPath))
            {
                Directory.CreateDirectory(outputPath);
            }

            var outputVideoPath = Path.Combine(outputPath, $"{Guid.NewGuid():N}.mp4");

            // 创建临时文件夹以保存重命名的图片列表
            var tempImgDir = Path.Combine(Directory.GetCurrentDirectory(), "TempImages", Guid.NewGuid().ToString());
            Directory.CreateDirectory(tempImgDir);

            try
            {
                // 重命名并复制图片到临时文件夹
                int imgIndex = 1;
                foreach (var img in request.Imglist)
                {
                    img.Path = $"wwwroot{img.Path}";
                    var imgExtension = Path.GetExtension(img.Path);
                    var tempImgPath = Path.Combine(tempImgDir, $"{imgIndex:D3}{imgExtension}");
                    System.IO.File.Copy(img.Path, tempImgPath);
                    imgIndex++;
                }

                // 准备将图片转换成视频的 FFmpeg 命令
                string imagesPathPattern = Path.Combine(tempImgDir, "%03d" + Path.GetExtension(request.Imglist[0].Path)); // 假设所有图片有相同的扩展名
                //使用音频时长，平均分配图片显示时间
                FFmpeg.SetExecutablesPath("C:\\ffmpeg\\bin");
                var audioDuration = await FFmpeg.GetMediaInfo(combinedMp3);
                var audioDurationSeconds = audioDuration.Duration.TotalSeconds;
                var imagesCount = request.Imglist.Count;
                var imageDuration = audioDurationSeconds / imagesCount;
                string imagesToVideoCommand = $"-framerate 1/{imageDuration} -i {imagesPathPattern} -c:v libx264 -r 25 -pix_fmt yuv420p {outputVideoPath}";
                // 使用Xabe.FFmpeg 执行生成视频的命令
                await FFmpeg.Conversions.New().Start(imagesToVideoCommand);

                // 如有必要，将音频添加到视频
                if (!string.IsNullOrEmpty(combinedMp3))
                {
                    var finalOutputPath = Path.Combine(outputPath, $"{Guid.NewGuid():N}.mp4");
                    var addAudioCommand = $"-i {outputVideoPath} -i {combinedMp3} -c copy -map 0:v:0 -map 1:a:0 {finalOutputPath}";
                    await FFmpeg.Conversions.New().Start(addAudioCommand);
                    outputVideoPath = finalOutputPath; // 更新最终视频文件的路径
                }
            }
            catch (Exception ex)
            {
                await _systemService.WriteLog($"用户{username}创建视频失败: {ex.Message}", Dtos.LogLevel.Error, username);
                return StatusCode(500, $"创建视频失败: {ex.Message}");
            }
            finally
            {
                // 清理临时文件夹及其内容
                if (Directory.Exists(tempImgDir))
                {
                    Directory.Delete(tempImgDir, true);
                }
            }

            var relativeVideoPath = outputVideoPath.Replace(Directory.GetCurrentDirectory(), "").Replace("\\", "/");
            return Ok(new { videoPath = relativeVideoPath });
        }

    }
}
