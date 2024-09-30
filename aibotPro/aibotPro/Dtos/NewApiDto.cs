namespace aibotPro.Dtos;

public class NewApiDto
{
}

public class NewApiUserInfoResult
{
    public bool success { get; set; }
    public string message { get; set; }
    public List<NewApiUserInfo> data { get; set; }
}

public class NewApiUserInfo
{
    public int id { get; set; }
    public string username { get; set; }
    public long quota { get; set; }
}

public class NewApiCard
{
    public bool success { get; set; }
    public string message { get; set; }
    public List<string> data { get; set; }
}
