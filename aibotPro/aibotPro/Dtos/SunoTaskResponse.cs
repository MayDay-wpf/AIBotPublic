using Newtonsoft.Json;

namespace aibotPro.Dtos
{
    public class SunoTaskResponse
    {
        [JsonProperty("code")]
        public int? Code { get; set; }

        [JsonProperty("message")]
        public string Message { get; set; }

        [JsonProperty("data")]
        public Data Data { get; set; }
    }

    public class Data
    {
        [JsonProperty("action")]
        public string Action { get; set; }

        [JsonProperty("clips")]
        public Dictionary<string, Clip> Clips { get; set; }

        [JsonProperty("fail_reason")]
        public string FailReason { get; set; }

        [JsonProperty("finish_time")]
        public long? FinishTime { get; set; }

        [JsonProperty("progress")]
        public string Progress { get; set; }

        [JsonProperty("start_time")]
        public long? StartTime { get; set; }

        [JsonProperty("status")]
        public string Status { get; set; }

        [JsonProperty("submit_time")]
        public long? SubmitTime { get; set; }

        [JsonProperty("task_id")]
        public string TaskId { get; set; }
    }

    public class Clip
    {
        [JsonProperty("audio_url")]
        public string AudioUrl { get; set; }

        [JsonProperty("created_at")]
        public DateTime? CreatedAt { get; set; }

        [JsonProperty("display_name")]
        public string DisplayName { get; set; }

        [JsonProperty("handle")]
        public string Handle { get; set; }

        [JsonProperty("id")]
        public string Id { get; set; }

        [JsonProperty("image_large_url")]
        public string ImageLargeUrl { get; set; }

        [JsonProperty("image_url")]
        public string ImageUrl { get; set; }

        [JsonProperty("is_handle_updated")]
        public bool? IsHandleUpdated { get; set; }

        [JsonProperty("is_liked")]
        public bool? IsLiked { get; set; }

        [JsonProperty("is_public")]
        public bool? IsPublic { get; set; }

        [JsonProperty("is_trashed")]
        public bool? IsTrashed { get; set; }

        [JsonProperty("is_video_pending")]
        public bool? IsVideoPending { get; set; }

        [JsonProperty("major_model_version")]
        public string MajorModelVersion { get; set; }

        [JsonProperty("metadata")]
        public Metadata Metadata { get; set; }

        [JsonProperty("model_name")]
        public string ModelName { get; set; }

        [JsonProperty("play_count")]
        public int? PlayCount { get; set; }

        [JsonProperty("reaction")]
        public object? Reaction { get; set; }

        [JsonProperty("status")]
        public string Status { get; set; }

        [JsonProperty("title")]
        public string Title { get; set; }

        [JsonProperty("upvote_count")]
        public int? UpvoteCount { get; set; }

        [JsonProperty("user_id")]
        public string UserId { get; set; }

        [JsonProperty("video_url")]
        public string VideoUrl { get; set; }
    }

    public class Metadata
    {
        [JsonProperty("audio_prompt_id")]
        public object? AudioPromptId { get; set; }

        [JsonProperty("concat_history")]
        public object? ConcatHistory { get; set; }

        [JsonProperty("error_message")]
        public object? ErrorMessage { get; set; }

        [JsonProperty("error_type")]
        public object? ErrorType { get; set; }

        [JsonProperty("gpt_description_prompt")]
        public object? GptDescriptionPrompt { get; set; }

        [JsonProperty("history")]
        public object? History { get; set; }

        [JsonProperty("prompt")]
        public string Prompt { get; set; }

        [JsonProperty("refund_credits")]
        public bool? RefundCredits { get; set; }

        [JsonProperty("stream")]
        public bool? Stream { get; set; }

        [JsonProperty("tags")]
        public string Tags { get; set; }

        [JsonProperty("type")]
        public string Type { get; set; }
    }


}
