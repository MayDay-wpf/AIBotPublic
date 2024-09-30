using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text;
using System.Text.Json;

namespace aibotPro.Controllers
{
    public class KnowledgeAIController : Controller
    {
        private readonly ISystemService _systemService;
        private readonly JwtTokenManager _jwtTokenManager;
        private readonly IKnowledgeService _knowledgeService;
        private readonly AIBotProContext _context;
        private readonly IRedisService _redisService;
        private readonly IServiceProvider _serviceProvider;
        private readonly IMilvusService _milvusService;

        public KnowledgeAIController(ISystemService systemService, JwtTokenManager jwtTokenManager, IKnowledgeService knowledgeService, AIBotProContext context, IRedisService redisService, IServiceProvider serviceProvider, IMilvusService milvusService)
        {
            _systemService = systemService;
            _jwtTokenManager = jwtTokenManager;
            _knowledgeService = knowledgeService;
            _context = context;
            _redisService = redisService;
            _serviceProvider = serviceProvider;
            _milvusService = milvusService;
        }
        public IActionResult KnowledgeChat()
        {
            return View();
        }
        public IActionResult KnowledgeManagement()
        {
            return View();
        }
        public IActionResult KnowledgeBuild()
        {
            return View();
        }
        public IActionResult KnowledgeAllInMilvus()
        {
            return View();
        }
        public IActionResult CutFileTest()
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

            var allowedExtensions = new List<string> { ".txt", ".pdf", ".ppt", ".doc", ".docx", ".xls", ".xlsx" };
            var fileExtension = Path.GetExtension(fileName).ToLower();

            if (!allowedExtensions.Contains(fileExtension))
            {
                return BadRequest("只允许上传 TXT, PDF, PPT, WORD, EXCEL 文件");
            }

            var path = await _systemService.UploadFileChunkAsync(file, chunkNumber, fileName, $"wwwroot/files/filesknowledge/{_systemService.ConvertToMD5(fileName, 16, true)}");
            return Ok(new { path });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> MergeFiles([FromBody] MergeRequest request)
        {
            var uniqueFileName = Guid.NewGuid().ToString() + "_" + request.FileName; // 使用 GUID 生成唯一文件名
            //获取用户名
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var path = await _systemService.MergeFileAsync(uniqueFileName, request.TotalChunks, username, $"wwwroot/files/filesknowledge/{_systemService.ConvertToMD5(request.FileName, 16, true)}");
            Knowledge knowledge = new Knowledge();
            knowledge.FileCode = Guid.NewGuid().ToString();
            knowledge.Account = username;
            knowledge.FileName = request.FileName;
            knowledge.FilePath = path.Replace("wwwroot", "");
            knowledge.CreateTime = DateTime.Now;
            var systemCfg = _systemService.GetSystemCfgs();
            var embeddingModel = systemCfg.FirstOrDefault(x => x.CfgKey == "EmbeddingsModel");
            var qaModel = systemCfg.FirstOrDefault(x => x.CfgKey == "QAmodel");
            if (embeddingModel == null || qaModel == null)
                throw new Exception("嵌入模型和QA模型不存在");
            //开始处理文件
            await _redisService.SetAsync($"{username}_wikiuploadlog", $"开始处理文件{request.FileName}");
            await _knowledgeService.UploadKnowledgeToVector(embeddingModel.CfgValue, request.ProcessType, qaModel.CfgValue, path, knowledge.FileCode, "", username);
            _knowledgeService.SaveKnowledgeFile(knowledge);
            return Ok(new
            {
                fileName = request.FileName,
                fileCode = knowledge.FileCode,
                path = path
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult GetKnowledgeFiles(int page, int pageSize, string name, string typeCode = "")
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            int total = 0;
            var listFilesLibs = _knowledgeService.GetKnowledgeFiles(page, pageSize, name, out total, username, typeCode);
            return Ok(new { success = true, data = listFilesLibs, total });
        }
        [Authorize]
        [HttpPost]
        public IActionResult DeleteKnowledgeFiles(string fileCode)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            _knowledgeService.DeleteKnowledgeFiles(fileCode, username);
            //查询向量库文件
            var knowledgelist = _context.KnowledgeLists.Where(x => x.FileCode == fileCode).ToList();
            //删除向量库文件
            List<string> ids = new List<string>();
            foreach (var item in knowledgelist)
            {
                ids.Add(item.VectorId);
            }
            _knowledgeService.DeleteVector(new DelRoot { ids = ids });
            _context.KnowledgeLists.RemoveRange(knowledgelist);
            _context.SaveChanges();
            return Ok(new
            {
                success = true
            });
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> DeleteKnowledgeFilesByMilvus(string fileCode, string typeCode = "")
        {
            try
            {
                var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
                //查询向量库文件
                List<KnowledgeList> knowledgelist = new List<KnowledgeList>();
                if (!string.IsNullOrEmpty(typeCode))
                {
                    var knowledges = _context.Knowledges.Where(x => x.TypeCode == typeCode).ToList();
                    var fileCodes = knowledges.Select(k => k.FileCode).ToList();  // 提取FileCode到一个列表
                    if (fileCodes.Count > 0)
                    {
                        knowledgelist = _context.KnowledgeLists
                                         .Where(kl => fileCodes.Contains(kl.FileCode))  // 使用Contains来替代Any
                                         .ToList();
                        foreach (var knowledge in knowledges)
                        {
                            _knowledgeService.DeleteKnowledgeFiles(knowledge.FileCode, username);
                        }
                    }
                    _context.KnowledgeTypes.Remove(_context.KnowledgeTypes.Where(x => x.TypeCode == typeCode).FirstOrDefault());
                }
                else
                {
                    _knowledgeService.DeleteKnowledgeFiles(fileCode, username);
                    knowledgelist = _context.KnowledgeLists.Where(x => x.FileCode == fileCode).ToList();
                }
                //删除向量库文件
                List<string> ids = new List<string>();
                foreach (var item in knowledgelist)
                {
                    ids.Add(item.VectorId);
                }
                bool result = await _milvusService.DeleteVector(ids);
                _context.KnowledgeLists.RemoveRange(knowledgelist);
                _context.SaveChanges();
                return Ok(new
                {
                    success = true
                });
            }
            catch (Exception e)
            {
                await _systemService.WriteLog($"Error with DeleteKnowledgeFilesByMilvus: {e.Message}", Dtos.LogLevel.Error, "system");
                return Ok(new
                {
                    success = false
                });
            }
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> SearchSchedule()
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            string key = $"{username}_wikiuploadlog";
            var result = await _knowledgeService.SearchSchedule(key);
            if (result != null)
            {
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
                    data = "未查询到进度"
                });
            }

        }
        [Authorize]
        [HttpPost]
        public IActionResult CreateKnowledgeType(string typeName)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            string typeCode = Guid.NewGuid().ToString("N");
            bool result = _knowledgeService.CreateKnowledgeType(typeName, typeCode, username);
            return Ok(new
            {
                success = result
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult GetKnowledgeType(int page, int pageSize, string name)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            int total = 0;
            var listFilesLibs = _knowledgeService.GetKnowledgeType(page, pageSize, name, out total, username);
            return Ok(new { success = true, data = listFilesLibs, total });
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> UploadByMilvus([FromForm] IFormFile file, [FromForm] int chunkNumber, [FromForm] string fileName)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("请选择文件");
            }

            var allowedExtensions = new List<string> { ".txt", ".pdf", ".ppt", ".doc", ".docx", ".xls", ".xlsx" };
            var fileExtension = Path.GetExtension(fileName).ToLower();

            if (!allowedExtensions.Contains(fileExtension))
            {
                return BadRequest("只允许上传 TXT, PDF, PPT, WORD, EXCEL 文件");
            }

            var path = await _systemService.UploadFileChunkAsync(file, chunkNumber, fileName, $"wwwroot/files/filesknowledge/{_systemService.ConvertToMD5(fileName, 16, true)}");
            return Ok(new { path });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> MergeFilesByMilvus([FromBody] MergeRequest request)
        {
            var uniqueFileName = Guid.NewGuid().ToString() + "_" + request.FileName; // 使用 GUID 生成唯一文件名
            //获取用户名
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var path = await _systemService.MergeFileAsync(uniqueFileName, request.TotalChunks, username, $"wwwroot/files/filesknowledge/{_systemService.ConvertToMD5(request.FileName, 16, true)}");
            Knowledge knowledge = new Knowledge();
            knowledge.FileCode = Guid.NewGuid().ToString();
            knowledge.Account = username;
            knowledge.FileName = request.FileName;
            knowledge.FilePath = path.Replace("wwwroot", "");
            knowledge.CreateTime = DateTime.Now;
            knowledge.TypeCode = request.TypeCode;
            _knowledgeService.SaveKnowledgeFile(knowledge);
            var systemCfg = _systemService.GetSystemCfgs();
            var embeddingModel = systemCfg.FirstOrDefault(x => x.CfgKey == "EmbeddingsModel");
            var qaModel = systemCfg.FirstOrDefault(x => x.CfgKey == "QAmodel");
            await _redisService.SetAsync($"knowledge_{knowledge.FileCode}", "0", TimeSpan.FromHours(1));
            _ = Task.Run(async () =>
            {
                try
                {
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var milvusService = scope.ServiceProvider.GetRequiredService<IMilvusService>();
                        var knowledgeService = scope.ServiceProvider.GetRequiredService<IKnowledgeService>();
                        List<MilvusDataDto> milvusDataDtos = await knowledgeService.CreateMilvusList(username, path,
                            embeddingModel.CfgValue, request.ProcessType, qaModel.CfgValue, request.TypeCode,
                            knowledge.FileCode, request.FixedLength);
                        await milvusService.InsertVector(milvusDataDtos, knowledge.FileCode, username);
                    }

                }
                catch (Exception ex)
                {
                    // 处理异常情况或记录日志
                    // 例如：_logger.LogError(ex, "Error processing Milvus data in background task.");
                }
            });
            return Ok(new
            {
                fileName = request.FileName,
                fileCode = knowledge.FileCode,
                path = path
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> UploadByTest([FromForm] IFormFile file, [FromForm] int chunkNumber, [FromForm] string fileName)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("请选择文件");
            }

            var allowedExtensions = new List<string> { ".txt", ".pdf", ".ppt", ".doc", ".docx", ".xls", ".xlsx" };
            var fileExtension = Path.GetExtension(fileName).ToLower();

            if (!allowedExtensions.Contains(fileExtension))
            {
                return BadRequest("只允许上传 TXT, PDF, PPT, WORD, EXCEL 文件");
            }

            var path = await _systemService.UploadFileChunkAsync(file, chunkNumber, fileName, "wwwroot/files/cuttest");
            return Ok(new { path });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> MergeFilesByTest([FromBody] MergeRequest request)
        {
            var uniqueFileName = Guid.NewGuid().ToString() + "_" + request.FileName; // 使用 GUID 生成唯一文件名
            //获取用户名
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var path = await _systemService.MergeFileAsync(uniqueFileName, request.TotalChunks, username, "wwwroot/files/cuttest");
            //读取文件内容返回
            string content = await _systemService.GetFileText(path);
            //删除文件
            _systemService.DeleteFile(path);
            return Ok(new
            {
                data = content
            });
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> CutFile(string text, string regular)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var result = await _knowledgeService.CutFile(text, regular, username, "", "", 1000);
            return Ok(new
            {
                data = result
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> GetProcess(List<string> fileCodes)
        {
            Dictionary<string, string> dic = new Dictionary<string, string>();
            //查询缓存
            foreach (var item in fileCodes)
            {
                var result = await _redisService.GetAsync($"knowledge_{item}");
                if (result != null)
                    dic.Add(item, result);
            }
            return Ok(new
            {
                success = true,
                data = dic
            });
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> StopBuild(string fileCode)
        {
            var result = await _redisService.GetAsync($"knowledge_{fileCode}");
            if (result != null)
                _redisService.DeleteAsync($"knowledge_{fileCode}");
            return Ok(new
            {
                success = true,
                data = "已取消"
            });
        }
    }
}
