using aibotPro.Dtos;
using aibotPro.Interface;
using Microsoft.AspNetCore.SignalR;

namespace aibotPro.Service
{
    public class MessagesHub : Hub
    {
        private static readonly Dictionary<string, HashSet<string>> _userConnections =
            new Dictionary<string, HashSet<string>>();

        private readonly JwtTokenManager _jwtTokenManager;
        private readonly IMessagesService _messagesService;

        public MessagesHub(JwtTokenManager jwtTokenManager, IMessagesService messagesService)
        {
            _jwtTokenManager = jwtTokenManager;
            _messagesService = messagesService;
        }

        public override async Task OnConnectedAsync()
        {
            var httpContext = Context.GetHttpContext();
            var token = httpContext?.Request.Query["access_token"];
            if (string.IsNullOrEmpty(token) || !_jwtTokenManager.isTokenValid(token))
            {
                Context.Abort();
                throw new Exception("连接失败");
            }

            string account = _jwtTokenManager.ValidateToken(token).Identity.Name;
            var connectionId = Context.ConnectionId;

            // 将连接ID加入到 AIBotIM 群组
            await Groups.AddToGroupAsync(connectionId, "AIBotIM");

            // 更新用户连接映射
            lock (_userConnections)
            {
                if (!_userConnections.ContainsKey(account))
                {
                    _userConnections[account] = new HashSet<string>();
                }

                _userConnections[account].Add(connectionId);
            }

            // 通知群组有新用户连接
            await Clients.Group("AIBotIM").SendAsync("UserConnected", $"{account} connected");

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            var connectionId = Context.ConnectionId;
            string account = null;

            // 从映射中移除断开的连接
            lock (_userConnections)
            {
                foreach (var pair in _userConnections)
                {
                    if (pair.Value.Remove(connectionId))
                    {
                        account = pair.Key;
                        if (pair.Value.Count == 0)
                        {
                            _userConnections.Remove(pair.Key);
                        }

                        break;
                    }
                }
            }

            if (account != null)
            {
                await Clients.Group("AIBotIM").SendAsync("UserDisconnected", $"{account} disconnected");
            }

            await Groups.RemoveFromGroupAsync(connectionId, "AIBotIM");
            await base.OnDisconnectedAsync(exception);
        }
    }
}