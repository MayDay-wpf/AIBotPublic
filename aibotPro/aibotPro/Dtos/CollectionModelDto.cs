using System.Text.Json.Serialization;

namespace aibotPro.Dtos;

public class CollectionModelDto
{
    [JsonPropertyName("id")]
    public int Id { get; set; }
    
    [JsonPropertyName("modelNick")]
    public string ModelNick { get; set; }
    
    [JsonPropertyName("modelName")]
    public string ModelName { get; set; }
    
    [JsonPropertyName("modelInfo")]
    public string ModelInfo { get; set; }
    
    [JsonPropertyName("modelGroup")]
    public string ModelGroup { get; set; }
    
    [JsonPropertyName("adminPrompt")]
    public string AdminPrompt { get; set; }
    
    [JsonPropertyName("visionModel")]
    public bool? VisionModel { get; set; }
    
    [JsonPropertyName("minimumBalance")]
    public decimal? MinimumBalance { get; set; }
    
    [JsonPropertyName("seq")]
    public int? Seq { get; set; }
    
    [JsonPropertyName("delay")]
    public int? Delay { get; set; }
    
    [JsonPropertyName("responses")]
    public bool? Responses { get; set; }
    
    [JsonPropertyName("modelPriceInput")]
    public decimal? ModelPriceInput { get; set; }
    
    [JsonPropertyName("modelPriceOutput")]
    public decimal? ModelPriceOutput { get; set; }
    
    [JsonPropertyName("vipModelPriceInput")]
    public decimal? VipModelPriceInput { get; set; }
    
    [JsonPropertyName("vipModelPriceOutput")]
    public decimal? VipModelPriceOutput { get; set; }
    
    [JsonPropertyName("svipModelPriceInput")]
    public decimal? SvipModelPriceInput { get; set; }
    
    [JsonPropertyName("svipModelPriceOutput")]
    public decimal? SvipModelPriceOutput { get; set; }
    
    [JsonPropertyName("rebate")]
    public decimal? Rebate { get; set; }
    
    [JsonPropertyName("vipRebate")]
    public decimal? VipRebate { get; set; }
    
    [JsonPropertyName("svipRebate")]
    public decimal? SvipRebate { get; set; }
    
    [JsonPropertyName("maximum")]
    public decimal? Maximum { get; set; }
    
    [JsonPropertyName("onceFee")]
    public decimal? OnceFee { get; set; }
    
    [JsonPropertyName("vipOnceFee")]
    public decimal? VipOnceFee { get; set; }
    
    [JsonPropertyName("svipOnceFee")]
    public decimal? SvipOnceFee { get; set; }
}