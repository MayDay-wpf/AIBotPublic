using Newtonsoft.Json;
using System;
namespace aibotPro.Dtos
{
    public class ChatDto
    {
        public string msg { get; set; }
        public string aiModel { get; set; }
        public string ip { get; set; }
        public string? chatid { get; set; }
        public string msgid_u { get; set; }
        public string msgid_g { get; set; }
        public string chatgroupid { get; set; }
        public string? image_path { get; set; }
        public List<string> file_list { get; set; }
        public string? system_prompt { get; set; }
    }
    public class ChatRes
    {
        public string message { get; set; }
        public string chatid { get; set; }
        public string jscode { get; set; }
        public bool isfinish { get; set; } = false;
    }
    public class AiChat
    {
        [JsonProperty("model")]
        public string Model { get; set; }

        [JsonProperty("messages")]
        public List<Message> Messages { get; set; }

        [JsonProperty("stream")]
        public bool Stream { get; set; }
    }
    public class APISetting
    {
        public string BaseUrl { get; set; }
        public string ApiKey { get; set; }
    }

    public class Message
    {
        [JsonProperty("role")]
        public string Role { get; set; }

        [JsonProperty("content")]
        public string Content { get; set; }
    }
    public class AiRes
    {
        [JsonProperty("id")]
        public string Id { get; set; }

        [JsonProperty("object")]
        public string Object { get; set; }

        [JsonProperty("created")]
        public long Created { get; set; }

        [JsonProperty("model")]
        public string Model { get; set; }

        [JsonProperty("system_fingerprint")]
        public object SystemFingerprint { get; set; } // 使用 object 类型因为它是 null

        [JsonProperty("choices")]
        public List<Choice> Choices { get; set; }
    }

    public class Choice
    {
        [JsonProperty("index")]
        public int Index { get; set; }

        [JsonProperty("delta")]
        public DeltaContent Delta { get; set; }

        [JsonProperty("logprobs")]
        public object Logprobs { get; set; } // 使用 object 类型因为它是 null

        [JsonProperty("finish_reason")]
        public object FinishReason { get; set; } // 使用 object 类型因为它是 null
    }

    public class DeltaContent
    {
        [JsonProperty("content")]
        public string Content { get; set; }
    }



    public class VisionBody
    {
        public bool stream { get; set; } = true;
        public VisionChatMesssage[] messages { get; set; }
        public string model { get; set; }
        public int max_tokens = 4096;
    }
    public class VisionChatMesssage
    {
        public string role { get; set; }
        public List<VisionContent> content { get; set; }
    }
    public class VisionContent
    {
        public string type { get; set; } = "text";
        [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
        public string text { get; set; }
        [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
        public VisionImg image_url { get; set; }
    }
    public class VisionImg
    {
        public string url { get; set; }
    }
    public class QAData
    {
        public List<QA> QA { get; set; }
    }

    public class QA
    {
        public string question { get; set; }
        public string answer { get; set; }
    }
    public class CombineMP3Request
    {
        public List<string> Pathlist { get; set; }
    }

}

