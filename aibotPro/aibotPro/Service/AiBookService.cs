using aibotPro.Interface;
using aibotPro.Models;
using Microsoft.EntityFrameworkCore;

namespace aibotPro.Service
{
    public class AiBookService : IAiBookService
    {
        private readonly AIBotProContext _context;
        private readonly ISystemService _systemService;
        public AiBookService(AIBotProContext context, ISystemService systemService)
        {
            _context = context;
            _systemService = systemService;
        }
        public bool AddNewBook(string account, string bookName, string bookimg, string bookimgthumbnails, string bookRemark, string bookType, string bookTag, bool isPublic, out string msg)
        {
            msg = string.Empty;
            try
            {
                AIBook aIBook = new AIBook()
                {
                    Account = account,
                    BookCode = $"{_systemService.ConvertToMD5(account)}-{Guid.NewGuid().ToString("N")}",
                    BookName = bookName,
                    BookImg = bookimg,
                    BookThumbnail = bookimgthumbnails,
                    BookRemark = bookRemark,
                    BookType = bookType,
                    BookTag = bookTag,
                    IsPublic = isPublic,
                    BookWordCount = 0,
                    CreateTime = DateTime.Now,
                    IsDel = false
                };

                _context.AIBooks.Add(aIBook);
                msg = aIBook.BookCode;
                return _context.SaveChanges() > 0;
            }
            catch (Exception e)
            {
                msg = e.Message;
                return false;
            }
        }

        public async Task<(List<AIBook>, int)> GetBookListAsync(string account, string keyword, int page, int pageSize)
        {
            IQueryable<AIBook> query = _context.AIBooks.AsNoTracking()
       .Where(x => x.Account == account && x.IsDel == false);

            if (!string.IsNullOrEmpty(keyword))
            {
                query = query.Where(x => x.BookName.Contains(keyword));
            }

            var totalCount = await query.CountAsync();

            var books = await query.OrderByDescending(x => x.CreateTime)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (books, totalCount);
        }

        public AIBook GetBookInfo(string username, string code)
        {
            var book = _context.AIBooks.Where(b => b.BookCode == code && !b.IsDel.Value).FirstOrDefault();
            if (book != null)
            {
                if (book.IsPublic.Value)
                {
                    return book;
                }
                else if (book.Account == username)
                {
                    return book;
                }
                else
                {
                    return null;
                }
            }
            else
                return null;
        }

        public bool UpdateBookInfo(string account, string bookCode, string bookName, string bookimg, string bookimgthumbnails, string bookRemark, string bookType, string bookTag)
        {
            var book = _context.AIBooks.Where(b => b.BookCode == bookCode && !b.IsDel.Value).FirstOrDefault();
            if (book != null)
            {
                if (book.Account == account)
                {
                    book.BookName = bookName;
                    book.BookImg = bookimg;
                    book.BookThumbnail = bookimgthumbnails;
                    book.BookRemark = bookRemark;
                    book.BookType = bookType;
                    book.BookTag = bookTag;
                    _context.SaveChanges();
                    return true;
                }
                else
                {
                    return false;
                }
            }
            else
                return false;
        }
        public async Task<(List<AIBookChapter>, int)> GetChapterList(string account, string bookCode, string keyword, int page = 1, int pageSize = 20, bool desc = false)
        {
            IQueryable<AIBookChapter> query = _context.AIBookChapters.AsNoTracking()
      .Where(x => x.Account == account && x.ParentCode == bookCode);

            if (!string.IsNullOrEmpty(keyword))
            {
                query = query.Where(x => x.ChapterTitle.Contains(keyword));
            }

            var totalCount = await query.CountAsync();
            if (desc)
            {

                var chapters = await query.OrderByDescending(x => x.Seq)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                return (chapters, totalCount);
            }
            else
            {

                var chapters = await query.OrderBy(x => x.Seq)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                return (chapters, totalCount);
            }
        }

        public (bool, int) CreateChapter(string account, string bookCode, string chapterTitle)
        {
            //检查是否为书籍作者
            var book = _context.AIBooks.Where(b => b.BookCode == bookCode && !b.IsDel.Value && account == account).FirstOrDefault();
            if (book != null)
            {
                //查询新建章节的序号
                var maxSeq = _context.AIBookChapters.Where(b => b.ParentCode == bookCode).Max(x => x.Seq);
                if (maxSeq == null)
                {
                    maxSeq = 0;
                }
                var newChapter = new AIBookChapter()
                {
                    Account = account,
                    ParentCode = bookCode,
                    ChapterTitle = chapterTitle,
                    CreateTime = DateTime.Now,
                    Seq = maxSeq + 1,
                    WordCount = 0,
                    ChapterSummary = "",
                    ChapterBody = ""
                };
                _context.AIBookChapters.Add(newChapter);
                return (_context.SaveChanges() > 0, newChapter.Id);
            }
            else
            {
                return (false, 0);
            }
        }

        public AIBookChapter GetChapterInfo(string account, string bookCode, int id)
        {
            var chapter = _context.AIBookChapters.Where(b => b.Id == id && b.ParentCode == bookCode).FirstOrDefault();
            var book = _context.AIBooks.Where(b => b.BookCode == bookCode && !b.IsDel.Value).FirstOrDefault();
            if (book != null)
            {
                if (book.Account == account || book.IsPublic.Value)
                {
                    return chapter;
                }
                else
                {
                    return null;
                }
            }
            else
                return null;
        }
    }
}
