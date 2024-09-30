using Newtonsoft.Json;
using System.Text.Json.Serialization;

namespace aibotPro.Dtos
{
    public class ApiDto
    {
    }
    public class ChatMessages
    {
        [JsonProperty("role")]
        public string Role { get; set; }

        [JsonProperty("content")]
        public string Content { get; set; }
    }

    public class ChatSession
    {
        [JsonProperty("model")]
        public string Model { get; set; }

        [JsonProperty("messages")]
        public List<ChatMessages> Messages { get; set; }

        [JsonProperty("stream")]
        public bool Stream { get; set; } = false;
    }


    public class ChatCompletionResponse
    {
        [JsonPropertyName("id")]
        public string Id { get; set; }

        [JsonPropertyName("object")]
        public string Object { get; set; }

        [JsonPropertyName("created")]
        public long Created { get; set; }

        [JsonPropertyName("model")]
        public string Model { get; set; }

        [JsonPropertyName("system_fingerprint")]
        public string system_fingerprint { get; set; }

        [JsonPropertyName("choices")]
        public List<Choices> Choices { get; set; }
    }
    public class ChatCompletionResponseUnStream
    {
        [JsonPropertyName("id")]
        public string Id { get; set; }

        [JsonPropertyName("object")]
        public string Object { get; set; }

        [JsonPropertyName("created")]
        public long Created { get; set; }

        [JsonPropertyName("model")]
        public string Model { get; set; }

        [JsonPropertyName("system_fingerprint")]
        public string system_fingerprint { get; set; }

        [JsonPropertyName("choices")] public List<ChoicesUnStream> Choices { get; set; }
        public Usage Usage { get; set; }
    }
    public class Choices
    {
        [JsonProperty("index")]
        public int index { get; set; }

        [JsonProperty("delta")]
        public DeltaContent delta { get; set; }

        [JsonProperty("logprobs")]
        public object logprobs { get; set; } // 使用 object 类型因为它是 null

        [JsonProperty("finish_reason")]
        public object finish_reason { get; set; } // 使用 object 类型因为它是 null
    }

    public class ChoicesUnStream
    {
        [JsonProperty("index")] public int index { get; set; }

        [JsonProperty("message")] public DeltaContent message { get; set; }

        [JsonProperty("logprobs")] public object logprobs { get; set; } // 使用 object 类型因为它是 null

        [JsonProperty("finish_reason")] public object finish_reason { get; set; } // 使用 object 类型因为它是 null
    }
    public class EmbeddingsBody
    {

        [JsonProperty("model")]
        public string Model { get; set; }
        [JsonProperty("input")]
        public string Input { get; set; }
    }
    public class SunoResponse
    {
        [JsonProperty("code")]
        public string Code { get; set; }
        [JsonProperty("message")]
        public string Message { get; set; }
        [JsonProperty("data")]
        public SunoData Data { get; set; }
    }
    public class SunoData
    {
        [JsonProperty("task_id")]
        public string TaskId { get; set; }
    }
}
