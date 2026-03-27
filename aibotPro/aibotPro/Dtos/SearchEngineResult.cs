namespace aibotPro.Dtos;

public class SearchEngineResult
{
    public string? Title { get; set; }
    public string? Url { get; set; }
    public string? Snippet { get; set; }
}

public class SearchEngineVideoResults
{
    public string? Title { get; set; }
    public string? Url { get; set; }
    public string? Image { get; set; }
}

public class SearchEngineImageResults
{
    public string? Url { get; set; }
}