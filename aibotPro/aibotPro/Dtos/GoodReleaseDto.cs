namespace aibotPro.Dtos
{
    public class GoodReleaseDto
    {
        public string Goodcode { get; set; }
        public string Goodname { get; set; }
        public string Goodinfo { get; set; }
        public decimal Goodprice { get; set; }
        public int Goodstock { get; set; }
        public string Viptype { get; set; }
        public int Vipdays { get; set; }
        public decimal Balance { get; set; }
        public string Goodimage { get; set; }
        public List<string> Paytype { get; set; }
        public bool isUpdate { get; set; } = false;
    }
}
