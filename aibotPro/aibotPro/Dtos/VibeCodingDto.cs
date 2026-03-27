namespace aibotPro.Dtos
{
    public class VibeCodingDto
    {
        public string msg { get; set; }
        public string aiModel { get; set; }
        public string ip { get; set; }
        public string? chatid { get; set; }
        public string msgid_u { get; set; }
        public string msgid_g { get; set; }
        public string chatgroupid { get; set; }
        public List<string> image_path { get; set; } = new List<string>();
        public List<string> file_path { get; set; } = new List<string>();
        public string? system_prompt { get; set; }
        public string? inputCacheKey { get; set; } = string.Empty;
        public string? systemCacheKey { get; set; } = string.Empty;
        public bool shouldSave { get; set; } = true;
        public bool stream { get; set; } = true;

        public string useMode { get; set; } = "chat";
    }

    public class VibeCodingRes
    {
        public string message { get; set; }
        public string reasoning { get; set; }
        public string chatid { get; set; }
        public bool isFinished { get; set; } = false;
    }
}