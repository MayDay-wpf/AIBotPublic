using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Service;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace aibotPro.Controllers;

public class IMController : Controller
{
    private readonly IMessagesService _messagesService;

    public IMController(IMessagesService messagesService)
    {
        _messagesService = messagesService;
    }

    [HttpPost]
    public async Task SendMessage([FromBody] IMDtos data)
    {
        await _messagesService.SendMessage(data);
    }
}