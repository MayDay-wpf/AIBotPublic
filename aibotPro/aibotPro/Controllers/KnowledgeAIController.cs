using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace aibotPro.Controllers
{
    public class KnowledgeAIController : Controller
    {
        private readonly ISystemService _systemService;
        private readonly JwtTokenManager _jwtTokenManager;
        private readonly IKnowledgeService _knowledgeService;
        private readonly AIBotProContext _context;
        private readonly IRedisService _redisService;
        public KnowledgeAIController(ISystemService systemService, JwtTokenManager jwtTokenManager, IKnowledgeService knowledgeService, AIBotProContext context, IRedisService redisService)
        {
            _systemService = systemService;
            _jwtTokenManager = jwtTokenManager;
            _knowledgeService = knowledgeService;
            _context = context;
            _redisService = redisService;
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
            //开始处理文件
            await _redisService.SetAsync($"{username}_wikiuploadlog", $"开始处理文件{request.FileName}");
            await _knowledgeService.UploadKnowledgeToVector("text-embedding-3-small", request.ProcessType, "gpt-3.5-turbo-0125", path, knowledge.FileCode, "", username);
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
        public IActionResult GetKnowledgeFiles(int page, int pageSize, string name)
        {
            var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            int total = 0;
            var listFilesLibs = _knowledgeService.GetKnowledgeFiles(page, pageSize, name, out total, username);
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

    }
}
