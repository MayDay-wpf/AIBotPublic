using aibotPro.Interface;
using aibotPro.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;
using System.Security.Principal;
using aibotPro.Dtos;

namespace aibotPro.Service
{
    public class MessagesService : IMessagesService
    {
        private readonly AIBotProContext _context;
        private readonly IHubContext<MessagesHub> _msghubContext;

        public MessagesService(AIBotProContext context, IHubContext<MessagesHub> msghubContext)
        {
            _context = context;
            _msghubContext = msghubContext;
        }

        public async Task SendMessage(IMDtos data)
        {
            await _msghubContext.Clients.All.SendAsync("ReceiveMessage", data);
        }
    }
}