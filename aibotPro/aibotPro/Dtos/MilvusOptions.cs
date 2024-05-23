namespace aibotPro.Dtos
{
    public class MilvusOptions
    {
        public string Host { get; set; }
        public int Port { get; set; }
        public bool UseSsl { get; set; }
        public string Database { get; set; }
        public string Collection { get; set; }
        public string UserName { get; set; }
        public string Password { get; set; }
    }
    public class EmbeddingElementByMilvus
    {
        public string ObjectType { get; set; }
        public int Index { get; set; }
        public List<float> Embedding { get; set; }
    }

    public class UsageByMilvus
    {
        public int PromptTokens { get; set; }
        public int TotalTokens { get; set; }
    }

    public class EmbeddingApiResponseByMilvus
    {
        public string ObjectType { get; set; }
        public List<EmbeddingElementByMilvus> Data { get; set; }
        public string Model { get; set; }
        public UsageByMilvus Usage { get; set; }
    }
}
