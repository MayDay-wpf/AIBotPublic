namespace aibotPro.Dtos;

public class DeepOutline
{
    public List<OutLineBody> Outline { get; set; }
}

public class OutLineBody
{
    public string MainTitle { get; set; }
    public List<string> SubTitle { get; set; }
}

public class OutLineShouldSearch
{
    public bool ShouldSearch { get; set; }
    public List<string> SearchKeywords { get; set; }
}