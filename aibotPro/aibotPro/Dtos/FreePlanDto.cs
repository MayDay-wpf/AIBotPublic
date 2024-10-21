namespace aibotPro.Dtos
{
    public class FreePlanDto
    {
        public int TotalCount { get; set; } = 0;
        public int UsedCount { get; set; } = 0;
        public int RemainCount { get; set; } = 0;
        public DateTime ExpireTime { get; set; } = DateTime.MinValue;
    }
}
