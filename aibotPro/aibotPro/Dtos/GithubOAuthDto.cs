using System.Text.Json.Serialization;

namespace aibotPro.Dtos;

public class GithubOAuthDto
{
}

public class GitHubEmail
{
    public string Email { get; set; }
    public bool Primary { get; set; }
    public bool Verified { get; set; }
    public string Visibility { get; set; }
}

public class GitHubCallback
{
    public string Token { get; set; }
    public string Msg { get; set; }
}

public class GitHubUserInfo
{
    public string login { get; set; }

    public string name { get; set; }

    public string avatar_url { get; set; }
}