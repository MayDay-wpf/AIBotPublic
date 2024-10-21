namespace aibotPro.Dtos
{
    public class PayInfoDto
    {
        public string payurl { get; set; }
        public string pid { get; set; }
        public string out_trade_no { get; set; }
        public string notify_url { get; set; }
        public string return_url { get; set; }
        public string name { get; set; }
        public string param { get; set; }
        public string money { get; set; }
        public string sign { get; set; }
        public string sign_type { get; set; }
    }
    public class PayResultDto
    {
        public int code { get; set; }
        public string msg { get; set; }
        public string trade_no { get; set; }
        public string out_trade_no { get; set; }
        public object api_trade_no { get; set; }
        public string type { get; set; }
        public string pid { get; set; }
        public string addtime { get; set; }
        public object endtime { get; set; }
        public string name { get; set; }
        public decimal money { get; set; }
        public string param { get; set; }
        public object buyer { get; set; }
        public string status { get; set; }
        public object payurl { get; set; }
    }
}
