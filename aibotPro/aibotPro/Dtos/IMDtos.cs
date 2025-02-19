using Newtonsoft.Json;

namespace aibotPro.Dtos;

public class IMDtos
{
    [JsonProperty("message")] public string Message { get; set; }
    [JsonProperty("files")] public List<string> Files { get; set; }
    [JsonProperty("code")] public string Code { get; set; }
    [JsonProperty("messagecode")] public string MessageCode { get; set; }
    [JsonProperty("headimgpath")] public string HeadImgPath { get; set; }
    [JsonProperty("nick")] public string Nick { get; set; }
}