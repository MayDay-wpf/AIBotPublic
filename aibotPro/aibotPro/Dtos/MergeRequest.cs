namespace aibotPro.Dtos
{
    public class MergeRequest
    {
        public string FileName { get; set; }
        public int TotalChunks { get; set; }
        public string ProcessType { get; set; }
    }

    public class MJdrawBody
    {
        public string prompt { get; set; }
        public string botType { get; set; }
        public string[] base64Array { get; set; }
    }
    public class DALLdrawBody
    {
        public string model { get; set; }
        public string prompt { get; set; }
        public string size { get; set; }
        public string quality { get; set; }
        public int n { get; set; }
    }
    public class DALLE2drawBody
    {
        public string model { get; set; }
        public string prompt { get; set; }
        public string size { get; set; }
        public int n { get; set; }
    }
    public class IMGResponseData
    {
        public long created { get; set; }
        public List<IMGDataItem> data { get; set; }
    }
    public class IMGResponseDataE2
    {
        public long created { get; set; }
        public List<IMGDataItemE2> data { get; set; }
    }
    public class IMGDataItemE2
    {
        public string url { get; set; }
    }
    public class IMGDataItem
    {
        public string revised_prompt { get; set; }
        public string url { get; set; }
    }
    public class MJchangeBody
    {
        public string action { get; set; }
        public int index { get; set; }
        public string taskId { get; set; }
    }

    public class TaskResponse
    {
        public string action { get; set; }
        public List<Button> buttons { get; set; }
        public string description { get; set; }
        public string failReason { get; set; }
        public long finishTime { get; set; }
        public string id { get; set; }
        public string imageUrl { get; set; }
        public string progress { get; set; }
        public string prompt { get; set; }
        public string promptEn { get; set; }
        public Dictionary<string, object> properties { get; set; }
        public long startTime { get; set; }
        public string state { get; set; }
        public string status { get; set; }
        public long submitTime { get; set; }
    }

    public class Button
    {
        public string customId { get; set; }
        public string emoji { get; set; }
        public string label { get; set; }
        public int style { get; set; }
        public int type { get; set; }
    }

}
