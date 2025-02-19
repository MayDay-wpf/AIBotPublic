using System.Text.Json.Serialization;

namespace aibotPro.Dtos;

using Newtonsoft.Json;
using System;
using System.Collections.Generic;

public class DuckDuckGoResDto
{
    [JsonPropertyName("results")] public List<DuckDuckGoRes> Results { get; set; }
}

public class DuckDuckGoRes
{
    [JsonPropertyName("body")] public string Body { get; set; }

    [JsonPropertyName("title")] public string Title { get; set; }

    [JsonPropertyName("href")] public string Href { get; set; }
}

public class DuckDuckGoImagesRes : DuckDuckGoRes
{
    [JsonPropertyName("thumbnail")] public string Thumbnail { get; set; }

    [JsonPropertyName("image")] public string Image { get; set; }

    [JsonPropertyName("url")] public string Url { get; set; }

    [JsonPropertyName("height")] public int Height { get; set; }

    [JsonPropertyName("width")] public int Width { get; set; }

    [JsonPropertyName("source")] public string Source { get; set; }
}

public class DuckDuckGoVideosRes : DuckDuckGoRes
{
    [JsonPropertyName("content")] public string Content { get; set; }

    [JsonPropertyName("description")] public string Description { get; set; }

    [JsonPropertyName("duration")] public string Duration { get; set; }

    [JsonPropertyName("embedhtml")] public string EmbedHtml { get; set; }

    [JsonPropertyName("embedurl")] public string EmbedUrl { get; set; }

    [JsonPropertyName("imagetoken")] public string ImageToken { get; set; }

    [JsonPropertyName("images")] public VideoImages Images { get; set; }

    [JsonPropertyName("provider")] public string Provider { get; set; }

    [JsonPropertyName("published")] public DateTime Published { get; set; }

    [JsonPropertyName("publisher")] public string Publisher { get; set; }

    [JsonPropertyName("statistics")] public VideoStatistics Statistics { get; set; }

    [JsonPropertyName("uploader")] public string Uploader { get; set; }
}

public class VideoImages
{
    [JsonPropertyName("large")] public string Large { get; set; }

    [JsonPropertyName("medium")] public string Medium { get; set; }

    [JsonPropertyName("motion")] public string Motion { get; set; }

    [JsonPropertyName("small")] public string Small { get; set; }
}

public class VideoStatistics
{
    [JsonPropertyName("viewcount")] public int ViewCount { get; set; }
}