using System.ComponentModel.DataAnnotations;
using Org.BouncyCastle.Bcpg;

namespace aibotPro.Dtos;

public class DeepRequest
{
    [Required(ErrorMessage = "chatId不能为空")]
    public string chatId { get; set; } = string.Empty;

    [Required(ErrorMessage = "研究标题不能为空")] public string title { get; set; } = string.Empty;

    public List<string> selectedQuestions { get; set; } = new List<string>();

    public string model { get; set; } = string.Empty;

    // public string searchEngine { get; set; } = string.Empty;
}

public class DeepChatRequest{
    public string chatId { get; set; } = string.Empty;
    
    public string groupId { get; set; } = string.Empty;

    public string deepResearchChatId { get; set; } = string.Empty;

    public string model { get; set; } = string.Empty;

    public string chatMessage { get; set; } = string.Empty;

    public string cacheKey { get; set; } = string.Empty;

    public string viewportContent { get; set; } = string.Empty;
}