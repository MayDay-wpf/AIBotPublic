namespace aibotPro.Interface
{
    public interface IBaiduService
    {
        string GetText(string Imgbase64);//获取图片文字
        string GetRes(string Imgbase64);//获取图片识别结果
    }
}
