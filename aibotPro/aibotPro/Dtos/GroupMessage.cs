using iTextSharp.text;

namespace aibotPro.Dtos;

public class GroupMessage
{
    public bool groupOwner { get; set; } = false;
    public string chatCode { get; set; } = "";
    public string text { get; set; } = "";
    public string role { get; set; } = "";
    public List<string> images { get; set; } = new List<string>();
    public List<FilesObj> files { get; set; } = new List<FilesObj>();
    public List<string> mentionedAIs = new List<string>();
}

public class FilesObj
{
    public string fileName { get; set; } = "";
    public bool onfile { get; set; } = false;
    public string path { get; set; } = "";
}