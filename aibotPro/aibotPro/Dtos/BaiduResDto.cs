using Newtonsoft.Json;
using System.Text.Json.Serialization;

namespace aibotPro.Dtos
{
    public class BaiduResDto
    {
        public class StreamResult
        {
            [JsonProperty("id")]
            public string Id { get; set; }
            [JsonProperty("object")]
            public string Object { get; set; }
            [JsonProperty("created")]
            public int Created { get; set; }
            public int SentenceId { get; set; }
            public bool IsEnd { get; set; }
            [JsonProperty("is_truncated")]
            public bool IsTruncated { get; set; }
            [JsonProperty("result")]
            public string Result { get; set; }
            [JsonProperty("need_clear_history")]
            public bool NeedClearHistory { get; set; }
            [JsonProperty("function_call")]
            public FunctionCall Function_Call { get; set; }
            [JsonProperty("finish_reason")]
            public string FinishReason { get; set; }
            [JsonProperty("usage")]
            public Usage Usage { get; set; }
        }

        public class FunctionCall
        {
            /// <summary>
            ///     Function name
            /// </summary>
            [JsonProperty("name")]
            public string? Name { get; set; }
            [JsonProperty("thoughts")]

            public string? Thoughts { get; set; }

            /// <summary>
            ///     Function arguments, returned as a JSON-encoded dictionary mapping
            ///     argument names to argument values.
            /// </summary>

            [JsonProperty("arguments")]
            public string? Arguments { get; set; }

            // 这里省略了 Thoughts 属性

            public Dictionary<string, object> ParseArguments()
            {
                var result = !string.IsNullOrWhiteSpace(Arguments) ? System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(Arguments) : null;
                return result ?? new Dictionary<string, object>();
            }
        }

        public class Usage
        {
            [JsonProperty("prompt_tokens")]
            public int PromptTokens { get; set; }
            [JsonProperty("completion_tokens")]
            public int CompletionTokens { get; set; }
            [JsonProperty("total_tokens")]
            public int TotalTokens { get; set; }
        }

        public class MessageDto
        {
            [JsonProperty("messages")]
            public List<Message> Messages { get; set; }
            [JsonProperty("functions")]
            public List<Function> Functions { get; set; }
            [JsonProperty("stream")]
            public bool Stream { get; set; }
            [JsonProperty("tool_choice")]
            public ToolChoice ToolChoice { get; set; }
            [JsonProperty("system")]
            public string System { get; set; }
            [JsonProperty("temperature")]
            public float? Temperature { get; set; }
            [JsonProperty("top_p")]

            public float? Top_P { get; set; }
            [JsonProperty("penalty_score")]
            public float? Penalty_Score { get; set; }

        }
        public class Message
        {
            [JsonProperty("role")]

            public string Role { get; set; }
            [JsonProperty("content")]

            public string Content { get; set; }
            [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]

            public FunctionCall Function_Call { get; set; }
            [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]
            public string Name { get; set; }
        }

        public class Property
        {
            [JsonProperty("type")]
            public string Type { get; set; } = "string";
            [JsonProperty("description")]
            public string Description { get; set; }
            [JsonProperty(NullValueHandling = NullValueHandling.Ignore)]

            public List<string> Enum { get; set; }
        }

        public class Parameter
        {
            [JsonProperty("type")]

            public string Type { get; set; }
            [JsonProperty("properties")]

            public Dictionary<string, Property> Properties { get; set; }
            [JsonProperty("required")]
            public List<string> Required { get; set; }
        }

        public class Function
        {
            [JsonProperty("name")]

            public string Name { get; set; }
            [JsonProperty("description")]

            public string Description { get; set; }
            [JsonProperty("parameters")]

            public Parameter Parameters { get; set; }
        }

        public class ToolChoice
        {
            [JsonProperty("type")]

            public string Type { get; set; } = "function";
            [JsonProperty("function")]

            public Function Function { get; set; }
        }
    }
}
