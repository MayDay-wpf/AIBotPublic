using aibotPro.Models;

namespace aibotPro.Interface
{
    public interface IAiBookService
    {
        bool AddNewBook(string account, string bookName, string bookimg, string bookimgthumbnails, string bookRemark, string bookType, string bookTag, bool isPublic, out string msg);//新增书籍
        Task<(List<AIBook>, int)> GetBookListAsync(string account, string keyword, int page, int pageSize);//获取书籍列表
        AIBook GetBookInfo(string username, string code);//获取书籍信息
        bool UpdateBookInfo(string account, string bookCode, string bookName, string bookimg, string bookimgthumbnails, string bookRemark, string bookType, string bookTag);//更新书籍信息

        Task<(List<AIBookChapter>, int)> GetChapterList(string account, string bookCode, string keyword, int page = 1, int pageSize = 20, bool desc = false);//获取章节列表

        (bool, int) CreateChapter(string account, string bookCode, string chapterTitle);//新增章节

        AIBookChapter GetChapterInfo(string account, string bookCode, int id);//获取章节信息
    }
}
