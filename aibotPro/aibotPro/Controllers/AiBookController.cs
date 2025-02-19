using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace aibotPro.Controllers
{
    public class AiBookController : Controller
    {
        private readonly JwtTokenManager _jwtTokenManager;
        private readonly ISystemService _systemService;
        private readonly IAiBookService _aiBookService;
        private readonly AIBotProContext _context;
        public AiBookController(JwtTokenManager jwtTokenManager, ISystemService systemService, IAiBookService aiBookService, AIBotProContext context)
        {
            _jwtTokenManager = jwtTokenManager;
            _systemService = systemService;
            _aiBookService = aiBookService;
            _context = context;
        }
        public IActionResult Index()
        {
            return View();
        }
        public IActionResult CreateNewBook()
        {
            return View();
        }
        public IActionResult Writer()
        {
            return View();
        }
        [Authorize]
        [HttpPost]
        public IActionResult UploadBookImg([FromForm] IFormFile file)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            //保存原图
            string path = Path.Combine("wwwroot/files/aibook", $"{DateTime.Now.ToString("yyyyMMdd")}");   //$"wwwroot\\files\\pluginavatar\\{DateTime.Now.ToString("yyyyMMdd")}";
            if (string.IsNullOrEmpty(username))
            {
                return Json(new
                {
                    success = false,
                    msg = "账号异常"
                });
            }
            string fileName = _systemService.SaveFiles(path, file, username);
            //保存缩略图
            string thumbnailFileName = _systemService.CompressImage(fileName, 50);
            //返回文件名
            return Json(new
            {
                success = true,
                filePath = fileName,
                thumbnailFilePath = thumbnailFileName
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult AddNewBook(string bookName, string bookimg, string bookimgthumbnails, string bookRemark, string bookType, string bookTag, bool isPublic=false)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            bool result = _aiBookService.AddNewBook(username, bookName, bookimg, bookimgthumbnails, bookRemark, bookType, bookTag, isPublic, out string msg);
            return Json(new
            {
                success = result,
                msg = msg
            });
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> GetBookList(string keyword, int page = 1, int pageSize = 20)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var (books, totalCount) = await _aiBookService.GetBookListAsync(username, keyword, page, pageSize);
            return Json(new
            {
                success = true,
                data = books,
                total = totalCount
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult DeleteBook(int id)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var book = _context.AIBooks.FirstOrDefault(x => x.Id == id && x.Account == username);
            if (book == null)
            {
                return Json(new
                {
                    success = false,
                    msg = "书籍不存在"
                });
            }
            book.IsDel = true;
            _context.SaveChanges();
            return Json(new
            {
                success = true,
                msg = "删除成功"
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult PublishUnPublishBook(int id, bool isPublic)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var book = _context.AIBooks.FirstOrDefault(x => x.Id == id && x.Account == username);
            if (book == null)
            {
                return Json(new
                {
                    success = false,
                    msg = "书籍不存在"
                });
            }
            book.IsPublic = isPublic;
            _context.SaveChanges();
            return Json(new
            {
                success = true,
                msg = "操作成功"
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult GetBookInfo(string bookCode)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            return Json(new
            {
                success = true,
                data = _aiBookService.GetBookInfo(username, bookCode)
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult UpdateBookInfo(string bookCode, string bookName, string bookimg, string bookimgthumbnails, string bookRemark, string bookType, string bookTag)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            bool result = _aiBookService.UpdateBookInfo(username, bookCode, bookName, bookimg, bookimgthumbnails, bookRemark, bookType, bookTag);
            return Json(new
            {
                success = result,
                msg = result ? "更新成功" : "更新失败"
            });
        }
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> GetChapterList(string keyword, string bookCode, int page = 1, int pageSize = 20, bool desc = false)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var (chapters, totalCount) = await _aiBookService.GetChapterList(username, bookCode, keyword, page, pageSize, desc);
            return Json(new
            {
                success = true,
                data = chapters,
                total = totalCount
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult CreateChapter(string bookCode, string title)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            (bool, int) result = _aiBookService.CreateChapter(username, bookCode, title);
            return Json(new
            {
                success = result.Item1,
                msg = result.Item1 ? "创建成功" : "创建失败",
                id = result.Item2
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult DeleteChapter(int id)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var chapter = _context.AIBookChapters.FirstOrDefault(x => x.Id == id && x.Account == username);
            if (chapter == null)
            {
                return Json(new
                {
                    success = false,
                    msg = "章节不存在"
                });
            }
            _context.AIBookChapters.Remove(chapter);
            _context.SaveChanges();
            return Json(new
            {
                success = true,
                msg = "删除成功"
            });

        }
        [Authorize]
        [HttpPost]
        public IActionResult GetChapterInfo(string bookCode, int id)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            return Json(new
            {
                success = true,
                data = _aiBookService.GetChapterInfo(username, bookCode, id)
            });
        }
        [Authorize]
        [HttpPost]
        public IActionResult UpdateChapterInfo(int id, string title, string body, int wordCount)
        {
            string username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
            var chapter = _context.AIBookChapters.FirstOrDefault(x => x.Id == id && x.Account == username);
            if (chapter == null)
            {
                return Json(new
                {
                    success = false,
                    msg = "章节不存在"
                });
            }
            chapter.ChapterTitle = title;
            chapter.ChapterBody = body;
            chapter.WordCount = wordCount;
            chapter.CreateTime = DateTime.Now;
            //更新全书字数
            var book = _context.AIBooks.FirstOrDefault(x => x.BookCode == chapter.ParentCode && x.Account == username);
            if (book != null)
            {
                book.BookWordCount = _context.AIBookChapters.Where(x => x.ParentCode == book.BookCode && x.Account == username).Sum(x => x.WordCount);
                _context.AIBooks.Update(book);
            }
            _context.SaveChanges();
            return Json(new
            {
                success = true,
                msg = "更新成功"
            });
        }
    }
}
