using System.Net.WebSockets;

namespace aibotPro.Dtos
{
    using Newtonsoft.Json;
    using System.ComponentModel;

    public class RealTimeDto
    {
        [JsonProperty("type")] public string Type { get; set; }

        [JsonProperty("session")] public Session Session { get; set; }
    }

    public class Session
    {
        [JsonProperty("instructions")] public string Instructions { get; set; }

        [JsonProperty("turn_detection")] public TurnDetection TurnDetection { get; set; }

        [JsonProperty("voice")] public string Voice { get; set; }

        [JsonProperty("temperature")] public double Temperature { get; set; }

        [JsonProperty("max_response_output_tokens")]
        public int MaxResponseOutputTokens { get; set; }

        [JsonProperty("tools")] public List<object> Tools { get; set; } = new List<object>();

        [JsonProperty("modalities")]
        public List<string> Modalities { get; set; } = new List<string> { "text", "audio" };

        [JsonProperty("input_audio_format")]
        [DefaultValue("pcm16")]
        public string InputAudioFormat { get; set; }

        [JsonProperty("output_audio_format")]
        [DefaultValue("pcm16")]
        public string OutputAudioFormat { get; set; }

        [JsonProperty("input_audio_transcription")]
        public InputAudioTranscription InputAudioTranscription { get; set; }

        [JsonProperty("tool_choice")]
        [DefaultValue("auto")]
        public string ToolChoice { get; set; }
    }

    public class TurnDetection
    {
        [JsonProperty("type")] public string Type { get; set; }

        [JsonProperty("threshold")] public double Threshold { get; set; }

        [JsonProperty("prefix_padding_ms")] public int PrefixPaddingMs { get; set; }

        [JsonProperty("silence_duration_ms")] public int SilenceDurationMs { get; set; }
    }

    public class InputAudioTranscription
    {
        [JsonProperty("model")]
        [DefaultValue("whisper-1")]
        public string Model { get; set; }
    }

    public class AudioMessageDto
    {
        [JsonProperty("event_id")] public string EventId { get; set; }
        [JsonProperty("type")] public string Type { get; set; }
        [JsonProperty("audio")] public string Audio { get; set; }
    }

    public class OpenAiSession
    {
        public WebSocket WebSocket { get; set; }
        public CancellationTokenSource CancellationTokenSource { get; set; } = new CancellationTokenSource();
    }
}