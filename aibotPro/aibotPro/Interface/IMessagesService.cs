using aibotPro.Dtos;

namespace aibotPro.Interface
{
    public interface IMessagesService
    {
        Task SendMessage(IMDtos data); // 发送消息
    }
}