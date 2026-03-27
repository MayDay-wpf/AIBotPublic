using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using TiktokenSharp;
using Xabe.FFmpeg;
using static Google.Apis.Requests.BatchRequest;

namespace aibotPro.Controllers
{
    public class ProductController : Controller
    {
        private readonly IAiServer _aiServer;
        private readonly ISystemService _systemService;
        private readonly JwtTokenManager _jwtTokenManager;
        private readonly IFinanceService _financeService;
        private readonly IUsersService _usersService;
        private readonly IProductService _productService;
        private readonly IRedisService _redisService;
        private readonly IDeepResearchService _deepResearchService;

        public ProductController(IAiServer aiServer, ISystemService systemService, JwtTokenManager jwtTokenManager,
            IFinanceService financeService, IUsersService usersService, IProductService productService,
            IRedisService redisService, IDeepResearchService deepResearchService)
        {
            _aiServer = aiServer;
            _systemService = systemService;
            _jwtTokenManager = jwtTokenManager;
            _financeService = financeService;
            _usersService = usersService;
            _productService = productService;
            _redisService = redisService;
            _deepResearchService = deepResearchService;
        }

        public IActionResult ChatGrid()
        {
            return View();
        }

        public IActionResult AiMarketing()
        {
            return View();
        }

        public IActionResult AiDoc()
        {
            return View();
        }

        public IActionResult ChatPDF()
        {
            return View();
        }

        public IActionResult RealTime()
        {
            return View();
        }

        public IActionResult VibeCoding()
        {
            return View();
        }

        public IActionResult DeepResearch()
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
            string outputPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot/files/audio",
                $"output/{DateTime.Now.ToString("yyyyMMdd")}");
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
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var user = _usersService.GetUserData(username);
            //检查该模型是否需要收费
            var modelPrice = await _financeService.ModelPrice(model);
            bool isVip = await _financeService.IsVip(username);
            bool shouldCharge = !isVip && modelPrice != null &&
                                (modelPrice.VipModelPriceInput > 0 || modelPrice.ModelPriceOutput > 0);

            //不是会员且余额为0时不提供服务
            if (!isVip && user.Mcoin <= 0)
            {
                return Json(new
                {
                    success = false,
                    data = "本站已停止向【非会员且余额为0】的用户提供服务，您可以前往充值1元及以上，长期使用本站的免费服务"
                });
            }

            // 检查用户余额是否不足，只有在需要收费时检查
            if (shouldCharge && user.Mcoin <= 0)
            {
                return Json(new
                {
                    success = false,
                    data = "余额不足，请充值后再使用"
                });
            }

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
            // 验证用户的身份
            string username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

            // 音频文件路径
            var combinedMp3 = Path.Combine("wwwroot", request.CombinedMp3);

            // 视频输出目录
            var outputPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "files", "video",
                $"output/{DateTime.Now:yyyyMMdd}");

            if (!Directory.Exists(outputPath))
            {
                Directory.CreateDirectory(outputPath);
            }

            var outputVideoPath = Path.Combine(outputPath, $"{Guid.NewGuid():N}.mp4");

            // 临时图片文件夹，用于放置重命名的图片
            var tempImgDir = Path.Combine(Directory.GetCurrentDirectory(), "TempImages", Guid.NewGuid().ToString());
            Directory.CreateDirectory(tempImgDir);

            try
            {
                // 重命名并复制图片到临时文件夹
                int imgIndex = 1;
                foreach (var img in request.Imglist)
                {
                    img.Path = Path.Combine("wwwroot", img.Path); // 跨平台拼接路径
                    var imgExtension = Path.GetExtension(img.Path);
                    var tempImgPath = Path.Combine(tempImgDir, $"{imgIndex:D3}{imgExtension}");
                    System.IO.File.Copy(img.Path, tempImgPath);
                    imgIndex++;
                }

                // 定位ffmpeg执行文件，确保跨平台可以正常工作
                string ffmpegDirectory = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "ffmpeg-binaries");
                FFmpeg.SetExecutablesPath(ffmpegDirectory);

                // 获取音频文件信息，计算图片显示时长
                var audioInfo = await FFmpeg.GetMediaInfo(combinedMp3);
                var audioDurationSeconds = audioInfo.Duration.TotalSeconds;
                var imagesCount = request.Imglist.Count;
                var imageDuration = audioDurationSeconds / imagesCount;

                // 准备生成视频的命令
                string imagesPattern = Path.Combine(tempImgDir, "%03d" + Path.GetExtension(request.Imglist[0].Path));

                // 开始生成视频
                var conversion = await FFmpeg.Conversions.New()
                    .AddParameter($"-framerate 1/{imageDuration}")
                    .AddParameter($"-i {imagesPattern}")
                    .SetOutput(outputVideoPath)
                    .SetOverwriteOutput(true)
                    .Start();

                // 如果存在音频，则将音频合并到视频
                if (!string.IsNullOrEmpty(combinedMp3))
                {
                    var finalOutputPath = Path.Combine(outputPath, $"{Guid.NewGuid():N}.mp4");
                    var addAudioConversion = await FFmpeg.Conversions.New()
                        .AddParameter($"-i {outputVideoPath}")
                        .AddParameter($"-i {combinedMp3}")
                        .AddParameter("-c copy -map 0:v:0 -map 1:a:0")
                        .SetOutput(finalOutputPath)
                        .SetOverwriteOutput(true)
                        .Start();

                    outputVideoPath = finalOutputPath; // 更新最终的视频输出路径
                }
            }
            catch (Exception ex)
            {
                await _systemService.WriteLog($"用户 {username} 创建视频失败: {ex.Message}", Dtos.LogLevel.Error, username);
                return StatusCode(500, $"创建视频失败: {ex.Message}");
            }
            finally
            {
                // 清理临时图片目录
                if (Directory.Exists(tempImgDir))
                {
                    Directory.Delete(tempImgDir, true);
                }
            }

            // 返回视频的相对路径
            var relativeVideoPath = outputVideoPath.Replace(Directory.GetCurrentDirectory(), "").Replace("\\", "/");
            return Ok(new { videoPath = relativeVideoPath });
        }

        #region ChatPDF

        public async Task<IActionResult> CreateQuestion(string content)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var user = _usersService.GetUserData(username);
            if (user.Mcoin <= 0)
            {
                return Json(new
                {
                    success = false,
                    msg = "余额不足"
                });
            }

            var question = new Dtos.QuestionList();
            bool success = false;
            string prompt = @$"# Role: Please act as a question creator. \n
                               * Requirements: Based on the following text, generate 4 questions. Note that only 4 are needed. \n
                               * Please ask your questions in Chinese. \n
                               * The content of the document is as follows: \n
                               * {content}";
            string schema = @"{
                                ""type"": ""object"",
                                ""properties"": {
                                  ""questions"": {
                                    ""type"": ""array"",
                                    ""description"": ""List of question"",
                                    ""items"": {
                                      ""type"": ""string""
                                    }
                                  }
                                },
                                ""required"": [
                                  ""questions""
                                ],
                                ""additionalProperties"": false
                              }";
            var systemCfgs = _systemService.GetSystemCfgs();
            string model = systemCfgs.FirstOrDefault(x => x.CfgKey == "AICodeCheckModel")?.CfgValue;
            var result = await _aiServer.GPTJsonSchema(prompt, schema, model, username);
            question = JsonConvert.DeserializeObject<Dtos.QuestionList>(result);
            if (!string.IsNullOrEmpty(result))
            {
                success = true;
                var tikToken = TikToken.GetEncoding("o200k_base");
                await _financeService.CreateUseLogAndUpadteMoney(username, model,
                    tikToken.Encode(prompt + schema).Count, tikToken.Encode(result).Count);
            }

            return Json(new
            {
                success = success,
                data = question.Questions
            });
        }

        #endregion

        #region VibeCoding

        public IActionResult GetVibeCodingModels()
        {
            var models = _productService.GetVibeCodingModels();
            models.Sort((x, y) => x.Seq.GetValueOrDefault().CompareTo(y.Seq));
            //移除Baseurl和ApiKey
            foreach (var model in models)
            {
                model.BaseUrl = "";
                model.ApiKey = "";
                model.Delay = 0;
                model.AdminPrompt = "";
            }

            return Json(new
            {
                success = true,
                data = models
            });
        }

        public IActionResult GetDeepResearchModels()
        {
            var models = _productService.GetDeepResearchModels();
            models.Sort((x, y) => x.Seq.GetValueOrDefault().CompareTo(y.Seq));
            foreach (var model in models)
            {
                model.BaseUrl = "";
                model.ApiKey = "";
                model.Delay = 0;
                model.AdminPrompt = "";
            }
            return Json(new
            {
                success = true,
                data = models
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> GetVibeCodingHistoriesList(int pageIndex = 1, int pageSize = 10,
            string searchKey = "")
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

            var histories = await _productService.GetVibeCodingHistoriesList(username, pageIndex, pageSize, searchKey);

            return Json(new
            {
                success = true,
                data = histories
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> GetVibeCodingHistoryDetail(string chatId)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

            var historyDetail = await _productService.GetVibeCodingHistoryDetail(chatId, username);

            return Json(new
            {
                success = true,
                data = historyDetail
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> DeleteVibeCodingHistory(string chatId)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

            var result = await _productService.DeleteVibeCodingHistory(chatId, username);

            return Json(new
            {
                success = result,
                message = result ? "删除成功" : "删除失败"
            });
        }

        public async Task<IActionResult> CreateCache(string codeContext, string key)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            await _redisService.SetAsync(key, codeContext, TimeSpan.FromMinutes(10));
            // 返回缓存的key
            return Json(new
            {
                success = true,
                data = key
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> GetVibeCodingSearchCode(string content, string question)
        {
            var username = _jwtTokenManager
                .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            string systemPrompt = @"你是一个代码查找搜索引擎。根据用户的关键词和提供的相关代码块进行分析和查找。
                                    分析要求：
                                    1. 仔细分析代码片段中是否存在与用户问题相关的代码
                                    2. 如果存在相关代码，请按以下格式回复：
                                       **行号范围：[起始行号-结束行号]**
                                       **相关代码说明：**[简要说明该代码段的作用及与问题的关系]

                                    3. 如果代码片段中不存在与用户问题相关的代码，请直接回复：
                                       **无关代码**

                                    4. 最大的容错率，只要可能与用户关键词相关的代码段，即便不完整也视为有效

                                    注意：
                                    - 行号必须准确对应代码片段中的实际行号
                                    - 如果有多个相关代码段，请分别标注
                                    - 回复要简洁明确，避免冗余描述"";
                                    ```

                                    ## 示例演示

                                    **用户问题：** 这段代码中有数据库连接的相关代码吗？

                                    **代码片段：**
                                    ```
                                    1  public class UserService 
                                    2  {
                                    3      private readonly IConfiguration _config;
                                    4      private readonly string _connectionString;
                                    5      
                                    6      public UserService(IConfiguration config)
                                    7      {
                                    8          _config = config;
                                    9          _connectionString = _config.GetConnectionString(""DefaultConnection"");
                                    10     }
                                    11     
                                    12     public async Task<User> GetUserAsync(int id)
                                    13     {
                                    14         using var connection = new SqlConnection(_connectionString);
                                    15         await connection.OpenAsync();
                                    16         var sql = ""SELECT * FROM Users WHERE Id = @id"";
                                    17         return await connection.QueryFirstOrDefaultAsync<User>(sql, new { id });
                                    18     }
                                    19     
                                    20     public void LogMessage(string message)
                                    21     {
                                    22         Console.WriteLine($""[{DateTime.Now}] {message}"");
                                    23     }
                                    24 }
                                    ```

                                    **AI回复示例1（存在相关代码）：**
                                    ```
                                    **行号范围：[4-4]**
                                    **相关代码说明：**定义数据库连接字符串字段

                                    **行号范围：[9-9]**
                                    **相关代码说明：**从配置中获取数据库连接字符串

                                    **行号范围：[14-17]**
                                    **相关代码说明：**创建并打开数据库连接，执行SQL查询
                                    ```

                                    **AI回复示例2（不存在相关代码）：**
                                    如果代码片段只包含日志记录功能，用户问的是数据库连接：
                                    ```
                                    **无关代码:[1-24]**
                                    ```";
            var systemCfgs = _systemService.GetSystemCfgs();
            var model = systemCfgs.FirstOrDefault(x => x.CfgKey == "QAmodel")?.CfgValue;
            var aiChat = new AiChat();
            aiChat.Model = model;
            aiChat.Messages = new List<Message>();
            aiChat.Messages.Add(new Message()
            {
                Role = "system",
                Content = systemPrompt
            });
            aiChat.Messages.Add(new Message()
            {
                Role = "user",
                Content = $"用户关键词：{question}\n代码片段：{content}"
            });
            aiChat.Stream = false;
            var apiSetting = _aiServer.CreateAPISetting(model);
            var result = await _aiServer.CallingAINotStream(aiChat, apiSetting);
            return Json(new
            {
                success = true,
                data = result
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> GetVibeCodingWebSearch(string query)
        {
            try
            {
                var username = _jwtTokenManager
                    .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;

                if (string.IsNullOrEmpty(query))
                {
                    return Json(new
                    {
                        success = false,
                        message = "搜索查询不能为空"
                    });
                }

                // 使用JINA AI进行联网搜索
                var keywords = new List<string> { query };
                var searchResult = await _deepResearchService.GetJinaSearchResultAsync(keywords);

                return Json(new
                {
                    success = true,
                    data = searchResult
                });
            }
            catch (Exception ex)
            {
                return Json(new
                {
                    success = false,
                    message = $"搜索失败: {ex.Message}"
                });
            }
        }

        #endregion
    }
}