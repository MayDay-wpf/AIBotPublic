namespace aibotPro.Dtos
{
    public class ForumTopicDto
    {
        public int Id { get; set; }
        public int AccountId { get; set; }

        public string Title { get; set; }
        public string Content { get; set; }
        public string Author { get; set; }
        public string Avatar { get; set; }
        public string Tags { get; set; }
        public long hit { get; set; }
        public int CommentCount { get; set; }
        public string CreateTime { get; set; }
        public bool IsDel { get; set; }
        public bool IsTop { get; set; }
        public List<Statements> Statements { get; set; }
    }
    public class Statements
    {
        public string Emoji { get; set; }
        public int Count { get; set; }
    }

    public class TopicCommentDto
    {
        public int Id { get; set; }
        public string Content { get; set; }
        public string UserName { get; set; }
        public int AccountId { get; set; }
        public string Avatar { get; set; }
        public string CreateTime { get; set; }
        public int? ParentCommentId { get; set; }
        public int TopicId { get; set; }
        public bool IsDel { get; set; }
        public int TotalChild { get; set; }
    }
    public class ForunUserInfo
    {
        public int Id { get; set; }
        public string UserName { get; set; }
        public string Avatar { get; set; }
        public string Introduction { get; set; }

        public string WebSite { get; set; }

        public decimal Points { get; set; }
        public int UnReadNotifitions { get; set; }
    }

    public class ForumNotifitionsDto
    {
        public int Id { get; set; }
        public string Content { get; set; }
        public string CreateTime { get; set; }
        public int TopicId { get; set; }
        public string TopicTitle { get; set; }
        public int CommentsId { get; set; }
        public int FromAccountId { get; set; }
        public string FromUserName { get; set; }
        public string FromAvatar { get; set; }
        public bool IsRead { get; set; }
    }
}
