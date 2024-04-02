using Newtonsoft.Json;

namespace aibotPro.Dtos
{
    public class AssistantDto
    {
    }
    // 定义成功响应的结构
    public class FileResponse
    {
        [JsonProperty("object")]
        public string Object { get; set; }

        [JsonProperty("id")]
        public string Id { get; set; }

        [JsonProperty("purpose")]
        public string Purpose { get; set; }

        [JsonProperty("filename")]
        public string Filename { get; set; }

        [JsonProperty("bytes")]
        public long Bytes { get; set; }

        [JsonProperty("created_at")]
        public long CreatedAt { get; set; }

        [JsonProperty("status")]
        public string Status { get; set; }

        [JsonProperty("status_details")]
        public object StatusDetails { get; set; } // 由于这个字段可能为null，我们使用object类型
    }

    // 定义错误响应的结构
    public class ErrorResponse
    {
        [JsonProperty("error")]
        public ErrorDetail Error { get; set; }

        public class ErrorDetail
        {
            [JsonProperty("message")]
            public string Message { get; set; }

            [JsonProperty("type")]
            public string Type { get; set; }

            [JsonProperty("param")]
            public object Param { get; set; } // 由于这个字段可能为null，我们使用object类型

            [JsonProperty("code")]
            public object Code { get; set; } // 由于这个字段可能为null，我们使用object类型
        }
    }
    public class ApiResponse
    {
        public FileResponse File { get; set; }
        public ErrorResponse Error { get; set; }
    }
    public class Tools
    {
        public string type { get; set; }
    }
    public class AssistantMsg
    {
        public string role { get; set; }
        public string content { get; set; }
    }




    class EventData
    {
        public string @event { get; set; }
        public string data { get; set; }
    }

    class ThreadRun
    {
        public string id { get; set; }
        public string @object { get; set; }
        public long created_at { get; set; }
        public string assistant_id { get; set; }
        public string thread_id { get; set; }
        public string status { get; set; }
        public long? started_at { get; set; }
        public long? expires_at { get; set; }
        public object cancelled_at { get; set; }
        public object failed_at { get; set; }
        public long? completed_at { get; set; }
        public object required_action { get; set; }
        public object last_error { get; set; }
        public string model { get; set; }
        public string instructions { get; set; }
        public List<Tool> tools { get; set; }
        public List<string> file_ids { get; set; }
        public object metadata { get; set; }
        public Usage usage { get; set; }
    }

    class Usage
    {
        public int prompt_tokens { get; set; }
        public int completion_tokens { get; set; }
        public int total_tokens { get; set; }
    }

    class Tool
    {
        public string type { get; set; }
    }

    class ThreadRunStep
    {
        public string id { get; set; }
        public string @object { get; set; }
        public long created_at { get; set; }
        public string run_id { get; set; }
        public string assistant_id { get; set; }
        public string thread_id { get; set; }
        public string type { get; set; }
        public string status { get; set; }
        public object cancelled_at { get; set; }
        public long? completed_at { get; set; }
        public long expires_at { get; set; }
        public object failed_at { get; set; }
        public object last_error { get; set; }
        public StepDetails step_details { get; set; }
        public object usage { get; set; }
    }

    class StepDetails
    {
        public string type { get; set; }
        public MessageCreation message_creation { get; set; }
    }

    class MessageCreation
    {
        public string message_id { get; set; }
    }

    class ThreadMessage
    {
        public string id { get; set; }
        public string @object { get; set; }
        public long created_at { get; set; }
        public string assistant_id { get; set; }
        public string thread_id { get; set; }
        public string run_id { get; set; }
        public string status { get; set; }
        public object incomplete_details { get; set; }
        public object incomplete_at { get; set; }
        public long? completed_at { get; set; }
        public string role { get; set; }
        public List<Content> content { get; set; }
        public List<string> file_ids { get; set; }
        public object metadata { get; set; }
    }

    class Content
    {
        public string type { get; set; }
        public Text text { get; set; }
    }

    class Text
    {
        public string value { get; set; }
        public List<object> annotations { get; set; }
    }
    class ImgFile
    {
        public string file_id { get; set; }
    }

    class ThreadMessageDelta
    {
        public string id { get; set; }
        public string @object { get; set; }
        public Delta delta { get; set; }
    }

    class Delta
    {
        public List<DeltaContentass> content { get; set; }
    }

    class DeltaContentass
    {
        public long index { get; set; }
        public string type { get; set; }
        public Text text { get; set; }
        public ImgFile image_file { get; set; }
    }


    class ThreadRunStepDelta
    {
        public string id { get; set; }
        public string @object { get; set; }
        public RunStepDelta delta { get; set; }
    }

    class RunStepDelta
    {
        public RunStepDetails step_details { get; set; }
    }

    class RunStepDetails
    {
        public string type { get; set; }
        public List<ToolCall> tool_calls { get; set; }
    }

    class ToolCall
    {
        public int index { get; set; }
        public string type { get; set; }
        public CodeInterpreter code_interpreter { get; set; }
        public Retrieval retrieval { get; set; }
    }

    class CodeInterpreter
    {
        public string input { get; set; }
    }
    class Retrieval
    {
        public string input { get; set; }
    }

    public class AssistantReply
    {
        public string message { get; set; }
        public List<string> file_ids { get; set; } = new List<string>();
    }

}
