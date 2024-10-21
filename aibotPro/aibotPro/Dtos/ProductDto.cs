namespace aibotPro.Dtos
{
    public class ProductDto
    {
    }


    public class StoryboardItem
    {
        public string storyboard { get; set; }
    }

    public class StoryboardObject
    {
        public List<StoryboardItem> SB { get; set; }
    }
    public class DrawImgRes
    {
        public string Id { get; set; }
        public string Path { get; set; }
    }

    public class ImgListRequest
    {
        public List<DrawImgRes> Imglist { get; set; }
        public string CombinedMp3 { get; set; }
    }
    public class QuestionList
    {
        public List<string> Questions { get; set; }
    }
}
