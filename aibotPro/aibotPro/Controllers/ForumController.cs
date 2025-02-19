using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace aibotPro.Controllers;

public class ForumController : Controller
{
    private readonly JwtTokenManager _jwtTokenManager;
    private readonly IForumService _forumService;
    private readonly IUsersService _usersService;
    private readonly AIBotProContext _context;
    public ForumController(JwtTokenManager jwtTokenManager, IForumService forumService, IUsersService usersService, AIBotProContext context)
    {
        _jwtTokenManager = jwtTokenManager;
        _forumService = forumService;
        _usersService = usersService;
        _context = context;
    }
    public IActionResult Index()
    {
        return View();
    }
    public IActionResult PublishArticle()
    {
        return View();
    }
    public IActionResult ReadTopic()
    {
        return View();
    }
    public IActionResult Notifications()
    {
        return View();
    }
    public IActionResult Personal()
    {
        return View();
    }
    [HttpPost]
    [Authorize]
    public IActionResult PostTopic(string title, string content, string tags, bool inviteAI)
    {
        var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var status = _forumService.PostTopic(username, title, content, tags, inviteAI, out string errmsg, out int newTopicId);
        return Json(new
        {
            success = status,
            msg = errmsg,
            data = newTopicId
        });
    }
    [HttpPost]
    public IActionResult GetTopicList(int page, int size, string searchKey, int? userId)
    {
        List<ForumTopicDto> list = new List<ForumTopicDto>();
        int total = 0;
        var status = _forumService.GetTopicList(page, size, searchKey, userId, out total);
        return Json(new
        {
            success = true,
            msg = "",
            data = new
            {
                list = status,
                total = total
            }
        });
    }

    [HttpPost]
    public IActionResult GetTopicById(int topicId)
    {
        ForumTopicDto topic = new ForumTopicDto();
        var data = _forumService.GetTopicById(topicId, out string errmsg);
        return Json(new
        {
            success = data != null,
            data = data,
            message = errmsg
        });
    }

    [HttpPost]
    public IActionResult GetTopicComments(int topicId, int page, int pagesize)
    {
        var data = _forumService.GetTopicComments(topicId, page, pagesize, out int total);
        return Json(new
        {
            success = data != null,
            data = data,
            total = total
        });
    }
    [HttpPost]
    [Authorize]
    public IActionResult SubmitReply(int topicId, string content, int replyId, int toAccountId)
    {
        var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        int accountId = _usersService.GetUserData(username).Id;
        bool result = _forumService.SubmitReply(accountId, topicId, content, replyId, out int commentsId);
        if (replyId > 0)
        {
            var reply = _context.ForumTopicComments.Where(c => c.Id == replyId).FirstOrDefault();
            if (reply != null)
            {
                toAccountId = reply.AccountId.Value;
            }
            else
            {
                return Json(new
                {
                    success = false
                });
            }
        }

        //不是自己的主题，发送通知
        bool result2 = true;
        if (accountId != toAccountId)
            result2 = _forumService.SendNotification(toAccountId, accountId, topicId, commentsId, content);
        return Json(new
        {
            success = result && result2
        });
    }


    [HttpPost]
    [Authorize]
    public IActionResult SubmissionStatements(int topicId, string index)
    {
        var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        bool result = _forumService.SubmissionStatements(username, topicId, index, out string errmsg);
        return Json(new
        {
            success = result,
            msg = errmsg
        });
    }
    [HttpPost]
    [Authorize]
    public IActionResult GetUserInfo(int? userId)
    {
        var username = _jwtTokenManager.ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        var data = _forumService.GetForumUserInfo(username, userId);
        return Json(new
        {
            success = true,
            data = data
        });
    }

    [HttpPost]
    [Authorize]
    public IActionResult GetNotifications(int page, int size)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        int accountId = _usersService.GetUserData(username).Id;
        var result = _forumService.GetNotifications(accountId, page, size, out int total);
        return Json(new
        {
            success = true,
            data = result,
            total = total
        });
    }

    [HttpPost]
    [Authorize]
    public IActionResult DeleteNotification(int id)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        int accountId = _usersService.GetUserData(username).Id;
        bool result = _forumService.DoActionNotification(accountId, id, "delete");
        return Json(new
        {
            success = result
        });
    }

    [HttpPost]
    [Authorize]
    public IActionResult ReadNotification(int id)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        int accountId = _usersService.GetUserData(username).Id;
        bool result = _forumService.DoActionNotification(accountId, id, "read");
        return Json(new
        {
            success = result
        });
    }

    [HttpPost]
    [Authorize]
    public IActionResult UpdateUserInfo(string introduction, string website)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        bool result = _forumService.UpdateUserInfo(username, introduction, website, out string errmsg);
        return Json(new
        {
            success = result,
            msg = errmsg
        });
    }

    [HttpPost]
    [Authorize]
    public IActionResult DeleteTopic(int id)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        bool result = _forumService.DoActionTopic(id, username, "delete");
        return Json(new
        {
            success = result
        });
    }

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public IActionResult DeleteTopicAdmin(int id)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        bool result = _forumService.DoActionTopic(id, username, "delete", true);
        return Json(new
        {
            success = result
        });
    }

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public IActionResult TopTopicAdmin(int id)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        bool result = _forumService.DoActionTopic(id, username, "top", true);
        return Json(new
        {
            success = result
        });
    }

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public IActionResult CancelTopicAdmin(int id)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        bool result = _forumService.DoActionTopic(id, username, "cancelTop", true);
        return Json(new
        {
            success = result
        });
    }

    [HttpPost]
    [Authorize]
    public IActionResult AddTopicEndum(int id, string content)
    {
        var username = _jwtTokenManager
            .ValidateToken(Request.Headers["Authorization"].ToString().Replace("Bearer ", "")).Identity?.Name;
        bool result = _forumService.AddTopicEndum(id, username, content, out string errmsg);
        return Json(new
        {
            success = result,
            msg = errmsg
        });
    }

    [HttpPost]
    [Authorize]
    public IActionResult GetTopicEndum(int id)
    {
        var data = _forumService.GetTopicEndum(id);
        return Json(new
        {
            success = true,
            data = data
        });
    }
}