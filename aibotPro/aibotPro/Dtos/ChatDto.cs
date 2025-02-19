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

    public int maxtokens { get; set; }

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
    public string coderMsg { get; set; } = "";
    public bool coderModel { get; set; } = false;
    public bool globe { get; set; } = false;
    public bool writerModel { get; set; } = false;
    public string bookCode { get; set; } = "";
    public int chapterId { get; set; } = 0;
    public List<int> selectChapters { get; set; } = new List<int>();
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

    [JsonProperty("stream_options")] public SOptions StreamOptions { get; set; } = new SOptions();
}

public class SOptions
{
    [JsonProperty("include_usage")] public bool StreamOptions { get; set; } = true;
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
    [JsonProperty("usage")] public StreamUsage Usages { get; set; }
}

public class Choice
{
    [JsonProperty("index")] public int Index { get; set; }

    [JsonProperty("delta")] public DeltaContent Delta { get; set; }

    [JsonProperty("logprobs")] public object Logprobs { get; set; } // 使用 object 类型因为它是 null

    [JsonProperty("finish_reason")] public object FinishReason { get; set; } // 使用 object 类型因为它是 null
}

public class PromptTokensDetails
{
    [JsonProperty("cached_tokens")] public int CachedTokens { get; set; }
    [JsonProperty("audio_tokens")] public int AudioTokens { get; set; }
}

public class CompletionTokensDetails
{
    [JsonProperty("reasoning_tokens")] public int ReasoningTokens { get; set; }
    [JsonProperty("audio_tokens")] public int AudioTokens { get; set; }

    [JsonProperty("accepted_prediction_tokens")]
    public int AcceptedPredictionTokens { get; set; }

    [JsonProperty("rejected_prediction_tokens")]
    public int RejectedPredictionTokens { get; set; }
}

public class StreamUsage
{
    [JsonProperty("prompt_tokens")] public int PromptTokens { get; set; }
    [JsonProperty("completion_tokens")] public int CompletionTokens { get; set; }
    [JsonProperty("total_tokens")] public int TotalTokens { get; set; }

    [JsonProperty("prompt_tokens_details")]
    public PromptTokensDetails PromptTokensDetails { get; set; }

    [JsonProperty("completion_tokens_details")]
    public CompletionTokensDetails CompletionTokensDetails { get; set; }
}

public class DeltaContent
{
    [JsonProperty("content")] public string Content { get; set; }
    [JsonProperty("reasoning_content")] public string ReasoningContent { get; set; }
    [JsonProperty("role")] public string Role { get; set; }
}

public class VisionBody
{
    [JsonProperty("max_tokens", NullValueHandling = NullValueHandling.Ignore)]
    public int? MaxTokens { get; set; }

    [JsonProperty("response_format", NullValueHandling = NullValueHandling.Ignore)]
    public ResponseFormat? response_format { get; set; }

    public bool stream { get; set; } = true;
    public VisionChatMessage[] messages { get; set; }
    public string model { get; set; }

    [JsonProperty("temperature", NullValueHandling = NullValueHandling.Ignore)]
    public float? Temperature { get; set; }

    // [JsonProperty("top_p", NullValueHandling = NullValueHandling.Ignore)]
    //public float? TopP { get; set; }
    [JsonProperty("presence_penalty", NullValueHandling = NullValueHandling.Ignore)]
    public float? PresencePenalty { get; set; }

    [JsonProperty("frequency_penalty", NullValueHandling = NullValueHandling.Ignore)]
    public float? FrequencyPenalty { get; set; }

    [JsonProperty("stream_options")] public SOptions StreamOptions { get; set; } = new SOptions();
}

public class VisionChatMessage
{
    public string role { get; set; }
    public ContentWrapper content { get; set; }
}

[JsonConverter(typeof(ContentWrapperConverter))]
public class ContentWrapper
{
    private List<VisionContent> _visionContentList;
    private string _stringContent;

    public List<VisionContent> visionContentList
    {
        get => _visionContentList;
        set
        {
            _visionContentList = value;
            _stringContent = null; // Clear string content if list is set
        }
    }

    public string stringContent
    {
        get => _stringContent;
        set
        {
            _stringContent = value;
            _visionContentList = null; // Clear list content if string is set
        }
    }

    // Omitting the isList and isString properties as we don't need them for serialization
}

public class ContentWrapperConverter : JsonConverter
{
    public override bool CanConvert(Type objectType)
    {
        return objectType == typeof(ContentWrapper);
    }

    public override object ReadJson(JsonReader reader, Type objectType, object existingValue, JsonSerializer serializer)
    {
        // Implement if necessary: deserialize JSON back to ContentWrapper
        throw new NotImplementedException();
    }

    public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer)
    {
        var contentWrapper = value as ContentWrapper;
        if (contentWrapper != null)
        {
            if (contentWrapper.stringContent != null)
            {
                serializer.Serialize(writer, contentWrapper.stringContent);
            }
            else if (contentWrapper.visionContentList != null)
            {
                serializer.Serialize(writer, contentWrapper.visionContentList);
            }
            else
            {
                writer.WriteNull();
            }
        }
    }
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