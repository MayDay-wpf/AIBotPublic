using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace aibotPro.Dtos;

public class ChatDto
{
    public bool seniorSetting { get; set; } = false;
    public string msg { get; set; }
    public string aiModel { get; set; }
    public string ip { get; set; }
    public string? chatid { get; set; }
    public string msgid_u { get; set; }
    public string msgid_g { get; set; }
    public string chatgroupid { get; set; }
    public List<string> image_path { get; set; } = new List<string>();
    public List<string> file_list { get; set; } = new List<string>();
    public string? system_prompt { get; set; }
    public bool isbot { get; set; } = false;
    public string threadid { get; set; }
    public float temperature { get; set; } = 1;
    public int maxtokens { get; set; } = 4095;
    //public float topp { get; set; } = 1;
    public float presence { get; set; } = 0;
    public float frequency { get; set; } = 0;
    public bool useMemory { get; set; } = false;
    public string chatfrom { get; set; } = "";
    public bool createAiPrompt { get; set; } = false;
    public string inputCacheKey { get; set; } = "";
    public int knowledgetopk { get; set; } = 3;
    public bool knowledgereranker { get; set; } = false;
    public int knowledgetopn { get; set; } = 3;
    public bool stream { get; set; } = true;
    public bool readingMode { get; set; } = false;
}

public class ChatRes
{
    public string message { get; set; }
    public string chatid { get; set; }
    public string jscode { get; set; }
    public bool isfinish { get; set; } = false;
    public string threadid { get; set; }
    public string file_id { get; set; }
    public bool loading { get; set; } = false;
    public bool isterminal { get; set; } = false;
}

public class AiChat
{
    [JsonProperty("response_format", NullValueHandling = NullValueHandling.Ignore)]
    public ResponseFormat? ResponseFormat { get; set; }

    [JsonProperty("model")] public string Model { get; set; }

    [JsonProperty("messages")] public List<Message> Messages { get; set; }

    [JsonProperty("temperature", NullValueHandling = NullValueHandling.Ignore)]
    public float? Temperature { get; set; }

    // [JsonProperty("top_p", NullValueHandling = NullValueHandling.Ignore)]
    //public float? TopP { get; set; }
    [JsonProperty("presence_penalty", NullValueHandling = NullValueHandling.Ignore)]
    public float? PresencePenalty { get; set; }

    [JsonProperty("frequency_penalty", NullValueHandling = NullValueHandling.Ignore)]
    public float? FrequencyPenalty { get; set; }

    [JsonProperty("max_tokens", NullValueHandling = NullValueHandling.Ignore)]
    public int? MaxTokens { get; set; }

    [JsonProperty("stream")] public bool Stream { get; set; }
}

public class ResponseFormat
{
    [JsonProperty("type", NullValueHandling = NullValueHandling.Ignore)]
    public string Type { get; set; }

    [JsonProperty("json_schema", NullValueHandling = NullValueHandling.Ignore)]
    public JsonSchemaWrapper JsonSchema { get; set; }
}

public class JsonSchemaWrapper
{
    [JsonProperty("name")] public string Name { get; set; }

    [JsonProperty("strict")] public bool Strict { get; set; }

    [JsonProperty("schema")] public JObject Schema { get; set; } // 使用JObject来代表动态的schema
}

public class APISetting
{
    public string BaseUrl { get; set; }
    public string ApiKey { get; set; }
    public bool? IsVisionModel { get; set; }
}

public class Message
{
    [JsonProperty("role")] public string Role { get; set; }

    [JsonProperty("content")] public string Content { get; set; }
}

public class AiRes
{
    [JsonProperty("id")] public string Id { get; set; }

    [JsonProperty("object")] public string Object { get; set; }

    [JsonProperty("created")] public long Created { get; set; }

    [JsonProperty("model")] public string Model { get; set; }

    [JsonProperty("system_fingerprint")] public object SystemFingerprint { get; set; } // 使用 object 类型因为它是 null

    [JsonProperty("choices")] public List<Choice> Choices { get; set; }
}

public class Choice
{
    [JsonProperty("index")] public int Index { get; set; }

    [JsonProperty("delta")] public DeltaContent Delta { get; set; }

    [JsonProperty("logprobs")] public object Logprobs { get; set; } // 使用 object 类型因为它是 null

    [JsonProperty("finish_reason")] public object FinishReason { get; set; } // 使用 object 类型因为它是 null
}

public class DeltaContent
{
    [JsonProperty("content")] public string Content { get; set; }
    [JsonProperty("role")] public string Role { get; set; }
}

public class VisionBody
{
    [JsonProperty("max_tokens", NullValueHandling = NullValueHandling.Ignore)]
    public int? MaxTokens { get; set; } = 4095;

    [JsonProperty("response_format", NullValueHandling = NullValueHandling.Ignore)]
    public ResponseFormat? response_format { get; set; }

    public bool stream { get; set; } = true;
    public VisionChatMesssage[] messages { get; set; }
    public string model { get; set; }

    [JsonProperty("temperature", NullValueHandling = NullValueHandling.Ignore)]
    public float? Temperature { get; set; }

    // [JsonProperty("top_p", NullValueHandling = NullValueHandling.Ignore)]
    //public float? TopP { get; set; }
    [JsonProperty("presence_penalty", NullValueHandling = NullValueHandling.Ignore)]
    public float? PresencePenalty { get; set; }

    [JsonProperty("frequency_penalty", NullValueHandling = NullValueHandling.Ignore)]
    public float? FrequencyPenalty { get; set; }
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

public class ChatModelSeq
{
    public string ModelNick { get; set; }
    public string ModelName { get; set; }
    public int Seq { get; set; }
}

public class TranslationResult
{
    public string TranslatedText { get; set; }
}

public class OptimizeResult
{
    public string OptimizedPrompt { get; set; }
}

public class LyricsResult
{
    public string Title { get; set; }
    public string Lyrics { get; set; }
    public string Tags { get; set; }
}