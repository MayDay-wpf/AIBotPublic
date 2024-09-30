namespace aibotPro.Dtos
{
    public class TokenizerByJinaDto
    {
        public static readonly string Cl100kBase = "cl100k_base";
        public static readonly string O200kBase = "o200k_base";
        public static readonly string P50kBase = "p50k_base";
        public static readonly string R50kBase = "r50k_base";
        public static readonly string P50kEdit = "p50k_edit";
        public static readonly string Gpt2 = "gpt2";
    }


    public class TokenUsage
    {
        public int Tokens { get; set; }
    }

    public class TokenizerDetail
    {
        public int NumTokens { get; set; }
        public string Tokenizer { get; set; }
        public TokenUsage Usage { get; set; }
        public int NumChunks { get; set; }
        public List<List<int>> ChunkPositions { get; set; }
        public List<string> Chunks { get; set; }
    }

    public class RerankerResponse
    {
        public string Model { get; set; }
        public RerankerUsage TokenUsage { get; set; }
        public List<RerankerResult> Results { get; set; }
    }

    public class RerankerUsage
    {
        public int TotalTokens { get; set; }
        public int PromptTokens { get; set; }
    }

    public class RerankerResult
    {
        public int Index { get; set; }
        public RerankedDocument Document { get; set; }
        public double RelevanceScore { get; set; }
    }

    public class RerankedDocument
    {
        public string Text { get; set; }
    }

}
