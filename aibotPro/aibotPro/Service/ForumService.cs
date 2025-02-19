using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using Google.Protobuf.WellKnownTypes;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using iTextSharp.text;
using Microsoft.EntityFrameworkCore.Query.Internal;

namespace aibotPro.Service
{
    public class ForumService : IForumService
    {
        private readonly ISystemService _systemService;
        private readonly AIBotProContext _context;
        private readonly IUsersService _userService;
        private readonly IServiceProvider _serviceProvider;
        public ForumService(AIBotProContext context, ISystemService systemService, IUsersService userService, IServiceProvider serviceProvider)
        {
            _context = context;
            _systemService = systemService;
            _userService = userService;
            _serviceProvider = serviceProvider;
        }
        public bool PostTopic(string account, string title, string content, string tags, bool inviteAI, out string errmsg, out int newTopicId)
        {
            errmsg = "发帖成功";
            newTopicId = 0;
            var lastTopic = _context.ForumTopics.OrderByDescending(x => x.CreateTime).FirstOrDefault();
            var systemCfg = _systemService.GetSystemCfgs();
            var intervalDurationStr = systemCfg.FirstOrDefault(x => x.CfgKey == "Forum_Interval_Duration")?.CfgValue;
            var forumSubtractPoints = int.Parse(systemCfg.FirstOrDefault(x => x.CfgKey == "Forum_Subtract_Points")?.CfgValue);
            var forumSubtractPointsAI = int.Parse(systemCfg.FirstOrDefault(x => x.CfgKey == "Forum_Subtract_Points_AI")?.CfgValue);
            bool isAdmin = _userService.IsAdmin(account);
            // 如果找到了间隔时间配置并且上次有发帖记录
            if (!string.IsNullOrEmpty(intervalDurationStr) && lastTopic != null && lastTopic.CreateTime.HasValue &&
                !isAdmin)
            {
                // 将间隔时间字符串转换为整数
                if (int.TryParse(intervalDurationStr, out int intervalMinutes))
                {
                    // 计算上次发帖时间和当前时间的时间差
                    TimeSpan timeSinceLastPost = DateTime.Now - lastTopic.CreateTime.Value;

                    // 如果时间差小于设定的间隔时间
                    if (timeSinceLastPost.TotalMinutes < intervalMinutes)
                    {
                        errmsg = $"发帖过于频繁，请等待 {intervalMinutes - (int)timeSinceLastPost.TotalMinutes} 分钟后再试。";
                        return false;
                    }
                }
            }
            var user = _userService.GetUserData(account);
            var userSetting = _context.ForumUserSettings.FirstOrDefault(x => x.AccountId == user.Id);
            // 判断发帖积分是否足够,并且判断是否使用AI
            if (userSetting.Points < forumSubtractPoints || inviteAI && userSetting.Points < forumSubtractPointsAI)
            {
                errmsg = "积分不足，无法发布帖子";
                return false;
            }

            // 保存帖子
            var newTopic = new ForumTopic()
            {
                AccountId = _userService.GetUserData(account).Id,
                TopicTitle = title,
                TopicContent = _systemService.EncodeBase64(content),
                TopicTags = tags,
                CreateTime = DateTime.Now,
                hit = 0,
                IsDel = false,
                IsTop = false
            };
            _context.ForumTopics.Add(newTopic);
            if (_context.SaveChanges() > 0)
            {
                newTopicId = newTopic.Id; // 获取新创建的帖子的Id
                // 减去积分
                SubtractForumPoints(account, inviteAI ? (decimal)forumSubtractPointsAI : (decimal)forumSubtractPoints);
                if (inviteAI)
                    _ = InviteAIRespond(user.Id, newTopicId, content);
                return true;
            }
            return false;
        }
        public Task InviteAIRespond(int accountId, int topicId, string content)
        {
            return Task.Run(async () =>
             {
                 using (var scope = _serviceProvider.CreateScope())
                 {
                     var aiService = scope.ServiceProvider.GetRequiredService<IAiServer>();
                     var systemService = scope.ServiceProvider.GetRequiredService<ISystemService>();
                     var forumService = scope.ServiceProvider.GetRequiredService<IForumService>();
                     var userService = scope.ServiceProvider.GetRequiredService<IUsersService>();
                     var systemCfg = _systemService.GetSystemCfgs();
                     var aiModel = systemCfg.FirstOrDefault(x => x.CfgKey == "Forum_AI_Model")?.CfgValue;
                     var aiBaseUrl = systemCfg.FirstOrDefault(x => x.CfgKey == "Forum_AI_BaseUrl")?.CfgValue;
                     var aiApiKey = systemCfg.FirstOrDefault(x => x.CfgKey == "Forum_AI_ApiKey")?.CfgValue;
                     var aiUser = systemCfg.FirstOrDefault(x => x.CfgKey == "Forum_AI_User")?.CfgValue;
                     var user = userService.GetUserData(aiUser);
                     string prompt = $@"你现在是一个活跃的论坛用户,昵称叫""AIBotRobot""。你的任务是阅读帖子内容,并用幽默风趣的语言进行回复。你的回复应该具有以下特点: \n
                                        1. 使用轻松愉快、诙谐有趣的语言风格 \n
                                        2. 适当加入一些相关的笑话或双关语 \n
                                        3. 在回复中恰当地使用2-3个相关的Emoji表情 \n
                                        4. 尽量与帖子主题相关,但可以适度跑题来增加幽默感 \n
                                        5. 允许有轻微的冒犯 \n
                                        请记住,你的目标是让其他论坛用户会心一笑的同时,可以根据自身的知识库切实解决论坛用户的各种专业问题。现在,请根据我给出的帖子内容,按照上述要求进行回复。\c
                                        # 帖子内容如下: \n
                                        {content}";
                     var aiChat = aiService.CreateAiChat(aiModel, prompt, false, false, false, "");
                     var apiSetting = new APISetting
                     {
                         BaseUrl = aiBaseUrl,
                         ApiKey = aiApiKey,
                         IsVisionModel = false
                     };
                     string result = await aiService.CallingAINotStream(aiChat, apiSetting);
                     result += "\n\n---\n\n 此评论由AI生成,请不要回复,AI不会再继续响应";
                     //添加回复
                     var replyId = forumService.SubmitReply(user.Id, topicId, result, 0, out _);
                     //发送通知
                     forumService.SendNotification(accountId, user.Id, topicId, 0, result);
                 }
             });
        }

        public List<ForumTopicDto> GetTopicList(int page, int size, string searchKey, int? userId, out int total)
        {
            // 使用 AsNoTracking 提高查询性能
            var topicsQuery = _context.ForumTopics
                .AsNoTracking()
                .Where(f => f.IsDel != true);

            // 如果 userId 非空，则加入 AccountId 过滤
            if (userId.HasValue)
            {
                topicsQuery = topicsQuery.Where(f => f.AccountId == userId.Value);
            }
            // 如果有搜索关键字，先应用可以在数据库端执行的条件
            if (!string.IsNullOrWhiteSpace(searchKey))
            {
                topicsQuery = topicsQuery.Where(f =>
                    f.TopicTitle.Contains(searchKey) ||
                    f.TopicTags.Contains(searchKey) ||
                    f.TopicContent.Contains(searchKey));
            }

            // 连接 Users 表
            var joinedQuery = topicsQuery
                .Join(_context.Users.AsNoTracking(),
                      topic => topic.AccountId,
                      user => user.Id,
                      (topic, user) => new
                      {
                          Topic = topic,
                          User = user
                      });

            // 如果需要在内容中搜索，必须在内存中进行过滤
            if (!string.IsNullOrWhiteSpace(searchKey))
            {
                joinedQuery = joinedQuery
                    .AsEnumerable() // 切换到内存中操作
                    .Where(x => _systemService.DecodeBase64(x.Topic.TopicContent).Contains(searchKey))
                    .AsQueryable();
            }

            // 计算总数
            total = joinedQuery.Count();

            // 应用排序和分页
            var pagedData = joinedQuery
                .OrderByDescending(x => x.Topic.IsTop)
                .ThenByDescending(x => x.Topic.CreateTime)
                .Skip((page - 1) * size)
                .Take(size)
                .Select(x => new ForumTopicDto
                {
                    Id = x.Topic.Id,
                    Title = x.Topic.TopicTitle,
                    Content = _systemService.DecodeBase64(x.Topic.TopicContent),
                    AccountId = x.Topic.AccountId.Value,
                    Author = x.User.Nick,
                    Avatar = x.User.HeadImg,
                    Tags = x.Topic.TopicTags,
                    hit = x.Topic.hit.Value,
                    CreateTime = x.Topic.CreateTime.Value.ToString("yyyy-MM-dd HH:mm:ss"),
                    IsDel = x.Topic.IsDel.Value,
                    IsTop = x.Topic.IsTop.Value
                })
                .ToList();

            var topicIds = pagedData.Select(r => r.Id).ToList();

            // 获取评论数
            var commentCounts = _context.ForumTopicComments
                .AsNoTracking()
                .Where(c => c.TopicId.HasValue && topicIds.Contains(c.TopicId.Value))
                .GroupBy(c => c.TopicId)
                .Select(g => new { TopicId = g.Key.Value, Count = g.Count() })
                .ToDictionary(x => x.TopicId, x => x.Count);

            // 获取表态数据
            var stmtCounts = _context.ForumTopicStatements
                 .AsNoTracking()
                 .Where(s => s.TopicId.HasValue
                             && topicIds.Contains(s.TopicId.Value)
                             && (s.IsDel == null || s.IsDel == false))
                 .GroupBy(s => new { s.TopicId, s.Emoji })
                 .Select(g => new { g.Key.TopicId, g.Key.Emoji, Count = g.Count() })
                 .ToList();

            foreach (var topic in pagedData)
            {
                topic.CommentCount = commentCounts.TryGetValue(topic.Id, out int count) ? count : 0;
                topic.Statements = stmtCounts
                    .Where(s => s.TopicId == topic.Id)
                    .Select(s => new Statements { Emoji = s.Emoji, Count = s.Count })
                    .ToList();
            }

            return pagedData;
        }
        public bool SubmissionStatements(string account, int topicId, string index, out string errmsg)
        {
            errmsg = string.Empty;
            int accountId = _userService.GetUserData(account).Id;
            //检查是否已经表态
            var existingStatement = _context.ForumTopicStatements.Where(s => s.AccountId == accountId && s.TopicId == topicId).FirstOrDefault();
            if (existingStatement != null)
            {
                errmsg = "您已经表态过此主题";
                return false;
            }
            var newStatement = new ForumTopicStatement()
            {
                AccountId = accountId,
                TopicId = topicId,
                Emoji = index,
                IsDel = false,
                CreateTime = DateTime.Now
            };
            _context.Add(newStatement);
            return _context.SaveChanges() > 0;
        }
        public ForumTopicDto GetTopicById(int topicId, out string errmsg)
        {
            errmsg = string.Empty;
            try
            {
                // 获取话题及其作者信息
                var query = _context.ForumTopics
                    .Where(f => f.Id == topicId && !f.IsDel.Value)
                    .Join(_context.Users,
                        topic => topic.AccountId,
                        user => user.Id,
                        (topic, user) => new { Topic = topic, User = user })
                    .Select(x => new ForumTopicDto
                    {
                        Id = x.Topic.Id,
                        Title = x.Topic.TopicTitle,
                        Content = _systemService.DecodeBase64(x.Topic.TopicContent),
                        AccountId = x.Topic.AccountId.Value,
                        Author = x.User.Nick,
                        Avatar = x.User.HeadImg,
                        Tags = x.Topic.TopicTags,
                        hit = x.Topic.hit.Value,
                        CreateTime = x.Topic.CreateTime.Value.ToString("yyyy-MM-dd HH:mm:ss"),
                        IsDel = x.Topic.IsDel.Value,
                        IsTop = x.Topic.IsTop.Value
                    })
                    .FirstOrDefault();

                if (query == null)
                {
                    errmsg = "话题不存在或已被删除";
                    return null;
                }

                // 获取评论数
                query.CommentCount = _context.ForumTopicComments
                    .Count(c => c.TopicId == topicId);

                // 获取表态数据
                query.Statements = _context.ForumTopicStatements
                    .Where(s => s.TopicId == topicId && (s.IsDel == null || s.IsDel == false))
                    .GroupBy(s => s.Emoji)
                    .Select(g => new Statements
                    {
                        Emoji = g.Key,
                        Count = g.Count()
                    })
                    .ToList();

                // 更新点击量
                var topic = _context.ForumTopics.Find(topicId);
                if (topic != null)
                {
                    topic.hit = (topic.hit ?? 0) + 1;
                    _context.SaveChanges();
                }

                return query;
            }
            catch (Exception ex)
            {
                errmsg = $"获取话题详情失败：{ex.Message}";
                return null;
            }
        }
        public List<TopicCommentDto> GetTopicComments(int topicId, int page, int pagesize, out int total)
        {
            // 1. 计算顶级评论的总数
            total = _context.ForumTopicComments
                .Count(c => c.TopicId == topicId && !c.IsDel.Value && !c.ParentId.HasValue);

            // 2. 获取分页后的顶级评论，并同时获取用户信息
            var topLevelComments = (from c in _context.ForumTopicComments.AsNoTracking()
                                    where c.TopicId == topicId && !c.IsDel.Value && !c.ParentId.HasValue
                                    orderby c.CreateTime
                                    join u in _context.Users.AsNoTracking()
                                        on c.AccountId equals u.Id into userJoin
                                    from u in userJoin.DefaultIfEmpty()
                                    select new
                                    {
                                        Comment = c,
                                        User = u
                                    })
                                    .Skip((page - 1) * pagesize)
                                    .Take(pagesize)
                                    .ToList();

            var topLevelIds = topLevelComments.Select(c => c.Comment.Id).ToList();

            // 3. 获取所有子评论，并同时获取用户信息
            var allChildComments = (from c in _context.ForumTopicComments.AsNoTracking()
                                    where c.TopicId == topicId && !c.IsDel.Value && c.ParentId.HasValue && topLevelIds.Contains(c.ParentId.Value)
                                    orderby c.CreateTime
                                    join u in _context.Users.AsNoTracking()
                                        on c.AccountId equals u.Id into userJoin
                                    from u in userJoin.DefaultIfEmpty()
                                    select new
                                    {
                                        Comment = c,
                                        User = u
                                    })
                                    .ToList();

            // 4. 预计算每个评论的子评论数量
            var commentIds = topLevelIds.Concat(allChildComments.Select(c => c.Comment.Id)).ToList();

            var childCounts = _context.ForumTopicComments
                .Where(c => c.TopicId == topicId && !c.IsDel.Value && c.ParentId.HasValue && commentIds.Contains(c.ParentId.Value))
                .GroupBy(c => c.ParentId.Value)
                .Select(g => new { ParentId = g.Key, Count = g.Count() })
                .ToDictionary(x => x.ParentId, x => x.Count);

            // 5. 组装用户信息
            var userIds = topLevelComments.Select(c => c.Comment.AccountId)
                .Union(allChildComments.Select(c => c.Comment.AccountId))
                .ToList();

            var users = _context.Users
                .Where(u => userIds.Contains(u.Id))
                .ToDictionary(u => u.Id, u => u);

            var result = new List<TopicCommentDto>();

            foreach (var top in topLevelComments)
            {
                var user = users.ContainsKey(top.Comment.AccountId.Value) ? users[top.Comment.AccountId.Value] : null;
                var topLevelDto = CreateTopicCommentDto(top.Comment, user);
                topLevelDto.TotalChild = childCounts.ContainsKey(top.Comment.Id) ? childCounts[top.Comment.Id] : 0;
                result.Add(topLevelDto);

                // 添加子评论
                var childComments = allChildComments.Where(c => c.Comment.ParentId == top.Comment.Id).ToList();
                foreach (var child in childComments)
                {
                    var childUser = users.ContainsKey(child.Comment.AccountId.Value) ? users[child.Comment.AccountId.Value] : null;
                    var childDto = CreateTopicCommentDto(child.Comment, childUser);
                    childDto.TotalChild = childCounts.ContainsKey(child.Comment.Id) ? childCounts[child.Comment.Id] : 0;
                    result.Add(childDto);
                }
            }

            return result;
        }
        private TopicCommentDto CreateTopicCommentDto(ForumTopicComment comment, User user)
        {
            return new TopicCommentDto
            {
                Id = comment.Id,
                Content = _systemService.DecodeBase64(comment.CommentsContent),
                UserName = user?.Nick,
                AccountId = user?.Id ?? 0,
                Avatar = user?.HeadImg,
                CreateTime = comment.CreateTime?.ToString("yyyy-MM-dd HH:mm:ss"),
                ParentCommentId = comment.ParentId,
                TopicId = comment.TopicId ?? 0,
                IsDel = comment.IsDel ?? false,
                TotalChild = 0 // 后续会根据需要设置
            };
        }
        public bool SendNotification(int accountId, int fromAccountId, int topicId, int commentsId, string content)
        {
            var notification = new ForumNotification
            {
                AccountId = accountId,
                FromAccountId = fromAccountId,
                TopicId = topicId,
                CommentsId = commentsId,
                NotificationContent = _systemService.EncodeBase64(content),
                CreateTime = DateTime.Now,
                IsRead = false
            };
            _context.ForumNotifications.Add(notification);
            return _context.SaveChanges() > 0;
        }

        public List<ForumNotifitionsDto> GetNotifications(int accountId, int page, int size, out int total)
        {
            // 计算要跳过的记录数
            int skip = (page - 1) * size;

            // 使用 IQueryable 延迟执行查询
            var query = _context.ForumNotifications
                .Where(n => n.AccountId == accountId)
                .OrderByDescending(n => n.CreateTime);

            // 获取总记录数
            total = query.Count();

            // 执行分页查询并投影到 DTO
            var result = query
                .Skip(skip)
                .Take(size)
                .Select(n => new ForumNotifitionsDto
                {
                    Id = n.Id,
                    Content = _systemService.DecodeBase64(n.NotificationContent),
                    CreateTime = n.CreateTime.HasValue
                        ? n.CreateTime.Value.ToString("yyyy-MM-dd HH:mm:ss")
                        : string.Empty,
                    TopicId = n.TopicId ?? 0,
                    CommentsId = n.CommentsId ?? 0,
                    FromAccountId = n.FromAccountId ?? 0,
                    IsRead = n.IsRead ?? false
                })
                .ToList();

            // 获取相关的 Topic 和 User 信息
            var topicIds = result.Select(r => r.TopicId).Distinct().ToList();
            var userIds = result.Select(r => r.FromAccountId).Distinct().ToList();

            var topics = _context.ForumTopics
                .Where(t => topicIds.Contains(t.Id))
                .ToDictionary(t => t.Id, t => t.TopicTitle);

            var users = _context.Users
                .Where(u => userIds.Contains(u.Id))
                .ToDictionary(u => u.Id, u => new { u.Nick, u.HeadImg });

            // 填充额外信息
            foreach (var item in result)
            {
                if (topics.TryGetValue(item.TopicId, out var topicTitle))
                {
                    item.TopicTitle = topicTitle;
                }

                if (users.TryGetValue(item.FromAccountId, out var user))
                {
                    item.FromUserName = user.Nick;
                    item.FromAvatar = user.HeadImg;
                }
            }

            return result;
        }

        public bool DoActionNotification(int accountId, int notificationId, string action)
        {
            var notification = _context.ForumNotifications
                .Where(n => n.Id == notificationId && n.AccountId == accountId).FirstOrDefault();
            if (notification != null)
            {
                if (action == "delete")
                {
                    _context.ForumNotifications.Remove(notification);
                    return _context.SaveChanges() > 0;
                }

                if (action == "read")
                {
                    notification.IsRead = true;
                    return _context.SaveChanges() > 0;
                }
            }

            return false;
        }
        public bool SubmitReply(int accountId, int topicId, string content, int replyId, out int commentsId)
        {
            commentsId = 0;
            var topicComm = new ForumTopicComment();
            if (replyId > 0)
            {
                topicComm.ParentId = replyId;
            }
            topicComm.AccountId = accountId;
            topicComm.CommentsContent = _systemService.EncodeBase64(content);
            topicComm.CreateTime = DateTime.Now;
            topicComm.TopicId = topicId;
            topicComm.IsDel = false;
            _context.ForumTopicComments.Add(topicComm);
            // 保存更改到数据库
            int rowsAffected = _context.SaveChanges();

            if (rowsAffected > 0)
            {
                commentsId = topicComm.Id;
                return true;
            }
            else
            {
                return false;
            }
        }

        public ForunUserInfo GetForumUserInfo(string account, int? userId)
        {
            User user;
            if (userId.HasValue)
            {
                user = _context.Users.AsNoTracking().Where(x => x.Id == userId).FirstOrDefault();
            }
            else
            {
                user = _userService.GetUserData(account);
            }

            var forumUserSetting = _context.ForumUserSettings.FirstOrDefault(x => x.AccountId == user.Id);

            if (forumUserSetting == null)
            {
                var tokensum = _context.UseUpLogs
                    .Where(x => x.Account == account)
                    .GroupBy(x => x.Account)
                    .Select(g => g.Sum(x => (x.InputCount ?? 0) + (x.OutputCount ?? 0)))
                    .FirstOrDefault();

                forumUserSetting = new ForumUserSetting
                {
                    AccountId = user.Id,
                    Introduction = "这个人很懒,没有任何简介~ ",
                    WebSite = "https://aibotpro.cn",
                    AccessToken = user.UserCode,
                    Points = Math.Max(0.01m, (decimal)tokensum / 10000), // 确保最小积分为0.01
                    Mute = false
                };

                _context.ForumUserSettings.Add(forumUserSetting);
                _context.SaveChanges();
            }

            var unReadNotifications = _context.ForumNotifications.Count(x => x.AccountId == user.Id && x.IsRead == false);

            return new ForunUserInfo
            {
                Id = user.Id,
                UserName = user.Nick,
                Avatar = user.HeadImg,
                Introduction = forumUserSetting.Introduction,
                WebSite = forumUserSetting.WebSite,
                Points = forumUserSetting.Points ?? 0,
                UnReadNotifitions = unReadNotifications
            };
        }

        public bool UpdateUserInfo(string account, string introduction, string website, out string errmsg)
        {
            var user = _userService.GetUserData(account);
            var forumUserSetting = _context.ForumUserSettings.FirstOrDefault(x => x.AccountId == user.Id);
            if (forumUserSetting == null)
            {
                errmsg = "用户信息不存在";
                return false;
            }

            forumUserSetting.Introduction = introduction;
            forumUserSetting.WebSite = website;
            _context.SaveChanges();
            errmsg = "";
            return true;
        }

        public bool DoActionTopic(int topicId, string account, string action, bool isAdmin = false)
        {
            var user = _userService.GetUserData(account);
            var topic = _context.ForumTopics.Where(t => t.Id == topicId).FirstOrDefault();
            if (topic == null) return false;
            if (user.Id != topic.AccountId && !isAdmin) return false;
            if (action == "delete")
            {
                topic.IsDel = true;
                // 删除评论
                _context.ForumTopicComments.Where(c => c.TopicId == topicId).ToList().ForEach(c => c.IsDel = true);
                // 删除表态
                _context.ForumTopicStatements.Where(s => s.TopicId == topicId).ToList().ForEach(s => s.IsDel = true);
                // 删除附言
                _context.ForumTopicAddenda.Where(a => a.TopicId == topicId).ToList().ForEach(a => a.IsDel = true);
                // 删除通知
                _context.ForumNotifications.RemoveRange(_context.ForumNotifications.Where(n => n.TopicId == topicId).ToList());
                return _context.SaveChanges() > 0;
            }
            else if (action == "top")
            {
                topic.IsTop = true;
                return _context.SaveChanges() > 0;
            }
            else if (action == "cancelTop")
            {
                topic.IsTop = false;
                return _context.SaveChanges() > 0;
            }

            return false;
        }

        public bool AddTopicEndum(int topicId, string account, string content, out string errmsg)
        {
            errmsg = string.Empty;
            var user = _userService.GetUserData(account);
            var topic = _context.ForumTopics.Where(t => t.Id == topicId).FirstOrDefault();
            if (topic == null)
            {
                errmsg = "主题不存在";
                return false;
            }

            if (topic.AccountId != user.Id)
            {
                errmsg = "只有主题创建人才能添加主题附言";
                return false;
            }

            var endumCount = _context.ForumTopicAddenda.Count(x => x.TopicId == topicId);
            if (endumCount >= 5)
            {
                errmsg = "主题附言最多添加5条";
                return false;
            }

            var endum = new ForumTopicAddendum();
            endum.AccountId = user.Id;
            endum.AddendumContent = _systemService.EncodeBase64(content);
            endum.CreateTime = DateTime.Now;
            endum.TopicId = topicId;
            endum.IsDel = false;
            _context.ForumTopicAddenda.Add(endum);
            if (_context.SaveChanges() > 0)
            {
                return true;
            }

            return false;
        }

        public List<ForumTopicAddendum> GetTopicEndum(int topicId)
        {
            return _context.ForumTopicAddenda
                .Where(x => x.TopicId == topicId && x.IsDel == false)
                .ToList()
                .Select(x =>
                {
                    x.AddendumContent = _systemService.DecodeBase64(x.AddendumContent);
                    return x;
                })
                .ToList();
        }
        public bool SubtractForumPoints(string account, decimal points)
        {
            var user = _userService.GetUserData(account);
            var userSetting = _context.ForumUserSettings.FirstOrDefault(x => x.AccountId == user.Id);
            userSetting.Points -= points;
            return _context.SaveChanges() > 0;
        }
    }
}
