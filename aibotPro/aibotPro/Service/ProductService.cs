using aibotPro.ChatService;
using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using Betalgo.Ranul.OpenAI.ObjectModels.RequestModels;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;

namespace aibotPro.Service
{
    public class ProductService : IProductService
    {
        private readonly AIBotProContext _context;
        private readonly ISystemService _systemService;
        private readonly IRedisService _redisService;
        private readonly IUsersService _usersService;
        private readonly IFinanceService _financeService;
        private readonly IHubContext<VibeCodingHub> _hubContext;

        public ProductService(AIBotProContext context, ISystemService systemService, IRedisService redisService,
            IUsersService usersService, IFinanceService financeService, IHubContext<VibeCodingHub> hubContext)
        {
            _context = context;
            _systemService = systemService;
            _redisService = redisService;
            _usersService = usersService;
            _financeService = financeService;
            _hubContext = hubContext;
        }

        public List<VibeCodingModel> GetVibeCodingModels()
        {
            //尝试获取缓存
            var cacheKey = "VibeCodingModels";
            var cacheValue = _redisService.GetAsync(cacheKey).Result;
            if (!string.IsNullOrEmpty(cacheValue))
            {
                return JsonConvert.DeserializeObject<List<VibeCodingModel>>(cacheValue);
            }

            var list = _context.VibeCodingModels.ToList();
            return list;
        }

        public List<DeepResearchModel> GetDeepResearchModels()
        {
            //尝试获取缓存
            var cacheKey = "DeepResearchModels";
            var cacheValue = _redisService.GetAsync(cacheKey).Result;
            if (!string.IsNullOrEmpty(cacheValue))
            {
                return JsonConvert.DeserializeObject<List<DeepResearchModel>>(cacheValue);
            }

            var list = _context.DeepResearchModels.ToList();
            return list;
        }

        public async Task<(bool, VibeCodingModel)> VibeCodingHubBeforeCheck(VibeCodingDto vibeCodingDto, string account,
            string sendMethod,
            string chatId)
        {
            bool result = true;
            ChatRes chatRes = new ChatRes();
            var user = _usersService.GetUserData(account);
            var aiModel = _context.VibeCodingModels.Where(x => x.ModelName == vibeCodingDto.aiModel).FirstOrDefault();

            var modelPrice = await _financeService.ModelPrice(vibeCodingDto.aiModel);
            bool isVip = await _financeService.IsVip(account);
            bool isSVip = await _financeService.IsSVip(account);
            bool shouldCharge = modelPrice != null && (
                (!isVip && !isSVip && (modelPrice.ModelPriceInput > 0 || modelPrice.ModelPriceOutput > 0 ||
                                       modelPrice.OnceFee > 0)) ||
                (isVip && !isSVip && (modelPrice.VipModelPriceInput > 0 || modelPrice.VipModelPriceOutput > 0 ||
                                      modelPrice.VipOnceFee > 0)) ||
                (isSVip && (modelPrice.SvipModelPriceInput > 0 || modelPrice.SvipModelPriceOutput > 0 ||
                            modelPrice.SvipOnceFee > 0)));

            // 不是会员且余额为0时不提供服务
            if (!isVip && !isSVip && user.Mcoin <= 0)
            {
                chatRes.message = "本站已停止向【非会员且余额为0】的用户提供服务，您可以[点击这里]('/Pay/Balance')前往充值1元及以上，长期使用本站的免费服务";
                await _hubContext.Clients.Group(chatId).SendAsync(sendMethod, chatRes);
                chatRes.message = "";
                chatRes.isfinish = true;
                await _hubContext.Clients.Group(chatId).SendAsync(sendMethod, chatRes);
                return (false, aiModel);
            }

            // 检查用户余额是否不足，只有在需要收费时检查
            if (shouldCharge && user.Mcoin <= 0)
            {
                chatRes.message = $"余额不足。请充值后再使用，您可以[点击这里]('/Pay/Balance')前往充值";
                await _hubContext.Clients.Group(chatId).SendAsync(sendMethod, chatRes);
                chatRes.message = "";
                chatRes.isfinish = true;
                await _hubContext.Clients.Group(chatId).SendAsync(sendMethod, chatRes);
                return (false, aiModel);
            }

            if (aiModel != null && aiModel.MinimumBalance > 0)
            {
                // 检查用户余额是否不足
                if (user.Mcoin < aiModel.MinimumBalance)
                {
                    chatRes.message =
                        $"该模型需要您的余额≥{aiModel.MinimumBalance}。请充值后再使用，您可以[点击这里]('/Pay/Balance')前往充值";
                    await _hubContext.Clients.Group(chatId).SendAsync(sendMethod, chatRes);
                    chatRes.message = "";
                    chatRes.isfinish = true;
                    await _hubContext.Clients.Group(chatId).SendAsync(sendMethod, chatRes);
                    return (false, aiModel);
                }
            }

            return (result, aiModel);
        }

        public async Task<List<VibeCodingChatHistory>> GetVibeCodingChatHistory(string chatId, string account,
            bool useCache = true,
            int historyCount = 5)
        {
            var cacheKey = $"VibeCodingChatHistory_{chatId}";
            List<VibeCodingChatHistory> chatHistory = null;

            if (useCache)
            {
                // 尝试获取缓存
                var cacheValue = await _redisService.GetAsync(cacheKey);
                if (!string.IsNullOrEmpty(cacheValue))
                {
                    chatHistory = JsonConvert.DeserializeObject<List<VibeCodingChatHistory>>(cacheValue);
                }
            }

            if (chatHistory == null)
            {
                // 缓存未命中 或 不使用缓存，查询数据库
                chatHistory = _context.VibeCodingChatHistories
                    .AsNoTracking()
                    .Where(x => x.ChatId == chatId && x.Account == account && x.IsDel == 0)
                    .OrderBy(x => x.CreateTime)
                    .ToList();

                if (useCache)
                {
                    // 缓存数据
                    await _redisService.SetAsync(cacheKey, JsonConvert.SerializeObject(chatHistory),
                        TimeSpan.FromHours(3));
                }
            }

            if (chatHistory.Count > historyCount)
            {
                chatHistory = chatHistory.Skip(chatHistory.Count - historyCount * 2).Take(historyCount * 2).ToList();
            }

            chatHistory.ForEach(x => { x.Chat = _systemService.DecodeBase64(x.Chat); });
            return chatHistory;
        }

        public async Task<List<ChatMessage>> CreateVibeCodingChatMessage(string chatId, string account,
            VibeCodingDto vibeCodingDto, VibeCodingModel aiModel, bool newChat)
        {
            List<VibeCodingChatHistory> chatHistory = new List<VibeCodingChatHistory>();
            var chatMessages = new List<ChatMessage>();
            if (!newChat)
            {
                chatHistory = await GetVibeCodingChatHistory(vibeCodingDto.chatid, account);
                foreach (var item in chatHistory)
                {
                    if (item.Role == "user")
                    {
                        var messages = new List<MessageContent>();
                        messages.Add(MessageContent.TextContent(item.Chat));
                        if (aiModel.VisionModel.HasValue && aiModel.VisionModel.Value && item.ImageList != null &&
                            item.ImageList.Length > 0)
                        {
                            foreach (var image in item.ImageList.Split(","))
                            {
                                messages.Add(MessageContent.ImageUrlContent(image));
                            }
                        }

                        chatMessages.Add(ChatMessage.FromUser(messages));
                    }
                    else
                    {
                        chatMessages.Add(ChatMessage.FromAssistant(item.Chat));
                    }
                }
            }

            var messagesNow = new List<MessageContent>();
            string prompt = vibeCodingDto.msg;
            if (vibeCodingDto.file_path.Count > 0)
            {
                prompt = vibeCodingDto.msg + @$"filepath_list:{string.Join(',', vibeCodingDto.file_path)}";
            }

            messagesNow.Add(MessageContent.TextContent(prompt));
            if (vibeCodingDto.image_path.Count > 0)
            {
                foreach (var image in vibeCodingDto.image_path)
                {
                    messagesNow.Add(MessageContent.ImageUrlContent(image));
                }
            }

            chatMessages.Add(ChatMessage.FromUser(messagesNow));
            return chatMessages;
        }

        public async Task<bool> SaveHistory(string chatId, string chatGroupId, string model, string account,
            string question,
            string answer, string thinkmsg,
            bool shouldSave = true, string imageList = "")
        {
            var vibeCodingChatHistoryByUser = new VibeCodingChatHistory
            {
                ChatId = chatId,
                ChatGroupId = chatGroupId,
                Role = "user",
                Model = model,
                Account = account,
                Chat = _systemService.EncodeBase64(question),
                ImageList = imageList,
                CreateTime = DateTime.Now,
                Location = shouldSave ? "show" : "hide",
                IsDel = 0
            };
            var vibeCodingChatHistoryByAi = new VibeCodingChatHistory
            {
                ChatId = chatId,
                ChatGroupId = chatGroupId,
                Role = "assistant",
                Model = model,
                Account = account,
                Chat = _systemService.EncodeBase64(answer),
                Reasoning = thinkmsg,
                CreateTime = DateTime.Now,
                Location = "show",
                IsDel = 0
            };
            try
            {
                _context.VibeCodingChatHistories.Add(vibeCodingChatHistoryByUser);
                _context.VibeCodingChatHistories.Add(vibeCodingChatHistoryByAi);
                await _context.SaveChangesAsync();
                //刷新缓存
                var vibeCodingChatHistory = await GetVibeCodingChatHistory(chatId, account, false);
                await _redisService.SetAsync("VibeCodingChatHistory_" + chatId,
                    JsonConvert.SerializeObject(vibeCodingChatHistory),
                    TimeSpan.FromHours(3));
                return true;
            }
            catch (Exception e)
            {
                Console.WriteLine(e);
                return false;
            }
        }

        public async Task<List<VibeCodingChatHistory>> GetVibeCodingHistoriesList(string account, int pageIndex,
            int pageSize,
            string searchKey)
        {
            var query = _context.VibeCodingChatHistories
                .AsNoTracking()
                .Where(ch =>
                    ch.Account == account && ch.IsDel != 1 && ch.Role == "user");

            // Get the first message of each chat group
            var subQuery = query
                .GroupBy(ch => ch.ChatId)
                .Select(g => new { ChatId = g.Key, MinCreateTime = g.Min(ch => ch.CreateTime) });

            var baseQuery = _context.VibeCodingChatHistories
                .AsNoTracking()
                .Join(subQuery,
                    ch => new { ch.ChatId, ch.CreateTime },
                    sub => new { sub.ChatId, CreateTime = sub.MinCreateTime },
                    (ch, sub) => ch)
                .Where(ch => ch.Account == account && ch.IsDel != 1 && ch.Role == "user");

            // Apply sorting
            var pagedQuery = baseQuery
                .OrderByDescending(ch => ch.CreateTime);

            // Apply search filter if provided
            if (!string.IsNullOrEmpty(searchKey))
            {
                pagedQuery =
                    (IOrderedQueryable<VibeCodingChatHistory>)pagedQuery.Where(ch => ch.Chat.Contains(searchKey));
            }

            // Apply pagination
            var chatHistories = await pagedQuery
                .Skip((pageIndex - 1) * pageSize)
                .Take(pageSize)
                .Select(ch => new VibeCodingChatHistory
                {
                    Id = ch.Id,
                    ChatId = ch.ChatId,
                    ChatGroupId = ch.ChatGroupId,
                    Account = ch.Account,
                    Role = ch.Role,
                    CreateTime = ch.CreateTime,
                    IsDel = ch.IsDel,
                    Chat = ch.Chat,
                    ChatTitle = ch.ChatTitle,
                    Model = ch.Model
                })
                .ToListAsync();

            // Decode base64 content
            foreach (var history in chatHistories)
            {
                history.Chat = _systemService.DecodeBase64(history.Chat);
                if (!string.IsNullOrEmpty(history.ChatTitle))
                {
                    history.ChatTitle = _systemService.DecodeBase64(history.ChatTitle);
                    history.Chat = history.ChatTitle;
                }
            }

            return chatHistories;
        }

        public async Task<List<VibeCodingChatHistory>> GetVibeCodingHistoryDetail(string chatId, string account)
        {
            var chatHistories = await _context.VibeCodingChatHistories
                .AsNoTracking()
                .Where(ch => ch.ChatId == chatId && ch.Account == account && ch.IsDel != 1 && ch.Location == "show")
                .OrderBy(ch => ch.CreateTime)
                .ToListAsync();

            // Decode base64 content
            foreach (var history in chatHistories)
            {
                history.Chat = _systemService.DecodeBase64(history.Chat);
                if (!string.IsNullOrEmpty(history.ChatTitle))
                {
                    history.ChatTitle = _systemService.DecodeBase64(history.ChatTitle);
                }
            }

            return chatHistories;
        }

        public async Task<bool> DeleteVibeCodingHistory(string chatId, string account)
        {
            try
            {
                var chatHistories = await _context.VibeCodingChatHistories
                    .Where(ch => ch.ChatId == chatId && ch.Account == account)
                    .ToListAsync();

                if (chatHistories.Any())
                {
                    foreach (var history in chatHistories)
                    {
                        _context.VibeCodingChatHistories.Remove(history);
                    }

                    await _context.SaveChangesAsync();

                    // Clear cache for this chat
                    await _redisService.DeleteAsync($"VibeCodingChatHistory_{chatId}");

                    return true;
                }

                return false;
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex);
                return false;
            }
        }
    }
}