namespace aibotPro.Dtos
{
    public class ChatSettingDto
    {
        public List<MyChatModel> MyChatModel { get; set; }
        public MyDall MyDall { get; set; }
        public MyMidjourney MyMidjourney { get; set; }

        public SystemSetting SystemSetting { get; set; }
    }
    public class MyChatModel
    {
        public string ChatNickName { get; set; }
        public string ChatModel { get; set; }
        public string ChatBaseURL { get; set; }
        public string ChatApiKey { get; set; }
    }
    public class MyDall
    {
        public string BaseURL { get; set; }
        public string ApiKey { get; set; }
    }
    public class MyMidjourney
    {
        public string BaseURL { get; set; }
        public string ApiKey { get; set; }
    }
    public class SystemSetting
    {
        public int UseHistory { get; set; }
        public int HistoryCount { get; set; }
        public int Scrolling { get; set; }
    }
}
