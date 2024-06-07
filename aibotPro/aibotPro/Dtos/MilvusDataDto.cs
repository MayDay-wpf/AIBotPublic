using Newtonsoft.Json;

namespace aibotPro.Dtos
{
    public class MilvusDataDto
    {
        public string Id { get; set; }
        public List<float> Vector { get; set; }
        public string Account { get; set; }
        public string VectorContent { get; set; }
        public string Type { get; set; }
    }
    public class ResponseModel
    {
        [JsonProperty("code")]
        public int Code { get; set; }
    }
    public class SearchVectorResultByMilvus
    {
        [JsonProperty("code")]
        public int Code { get; set; }
        [JsonProperty("data")]
        public List<SearchVectorResultData> Data { get; set; }
    }
    public class QueryResultByMilvus
    {
        [JsonProperty("code")]
        public int Code { get; set; }
        [JsonProperty("data")]
        public List<MilvusDataDto> Data { get; set; }
    }
    public class SearchVectorResultData
    {
        [JsonProperty("distance")]
        public decimal Distance { get; set; }
        [JsonProperty("id")]
        public string Id { get; set; }
        [JsonProperty("vectorcontent")]
        public string VectorContent { get; set; }
    }
}
