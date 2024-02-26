using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;
using aibotPro.Models;

namespace aibotPro.Dtos
{
    public class RoleSettingDto
    {
        public int Id { get; set; }
        public string RoleCode { get; set; }
        public string RoleAvatar { get; set; }
        public string RoleName { get; set; }
        public string RoleInfo { get; set; }
        public string RoleSystemPrompt { get; set; }
        public string RoleChatCode { get; set; }
        public string Account { get; set; }
        public DateTime? CreateTime { get; set; }
        public List<RoleChat> RoleChat { get; set; }
    }
    public class RoleChat
    {
        public int Id { get; set; }
        public string RoleChatCode { get; set; }
        public string UserInput { get; set; }
        public string AssistantOutput { get; set; }
    }
}
