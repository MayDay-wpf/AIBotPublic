using aibotPro.Dtos;
using aibotPro.Models;
using iTextSharp.text;

namespace aibotPro.Interface
{
    public interface IForumService
    {
        bool PostTopic(string account, string title, string content, string tags, bool inviteAI, out string errmsg, out int newTopicId);//发帖
        List<ForumTopicDto> GetTopicList(int page, int size, string searchKey, int? userId, out int total); //获取帖子列表
        bool SubmissionStatements(string account, int topicId, string index, out string errmsg);//表态
        ForumTopicDto GetTopicById(int topicId, out string errmsg); //获取帖子详情
        bool DoActionTopic(int topicId, string account, string action, bool isAdmin = false); //操作帖子
        List<TopicCommentDto> GetTopicComments(int topicId, int page, int pagesize, out int total);//获取评论列表
        bool SendNotification(int accountId, int fromAccountId, int topicId, int commentsId, string content);//发送通知
        List<ForumNotifitionsDto> GetNotifications(int accountId, int page, int size, out int total); //获取通知
        bool DoActionNotification(int accountId, int notificationId, string action); //操作通知
        bool SubmitReply(int accountId, int topicId, string content, int replyId, out int commentsId);//发送评论
        ForunUserInfo GetForumUserInfo(string account, int? userId); //获取用户信息

        bool UpdateUserInfo(string account, string introduction, string website,
            out string errmsg); //更新用户信息

        bool AddTopicEndum(int topicId, string account, string content, out string errmsg); //帖子添加附言
        List<ForumTopicAddendum> GetTopicEndum(int topicId);//获取帖子附言
        bool SubtractForumPoints(string account, decimal points);//扣除论坛积分

    }
}
