namespace aibotPro.Dtos
{
    public class WorkShopPlugin
    {
        public int Id { get; set; }
        public string Pcode { get; set; }
        public string Account { get; set; }
        public string Pavatar { get; set; }
        public string Pnickname { get; set; }
        public string Pfunctionname { get; set; }
        public string Pfunctioninfo { get; set; }
        public string Popensource { get; set; }
        public decimal? Pluginprice { get; set; }
        public string Pcodemodel { get; set; }
        public string Papiurl { get; set; }
        public string Pmethod { get; set; }
        public List<PluginParamDto> Param { get; set; }
        public List<PluginHeaderDto> Pheaders { get; set; }
        public List<PluginCookieDto> Pcookies { get; set; }
        public string Pjscode { get; set; }
        public string PrunLocation { get; set; }
        public string Pusehtml { get; set; }
        public string IsPublic { get; set; }
        public System.DateTime? CreateTime { get; set; }
    }
    public class PluginParamDto
    {
        public string ParamCode { get; set; }
        public string ParamInfo { get; set; }
        public string ParamName { get; set; }
        public string ParamConst { get; set; }
    }
    public class PluginHeaderDto
    {
        public string PheadersCode { get; set; }
        public string PheadersName { get; set; }
        public string PheadersValue { get; set; }
    }
    public class PluginCookieDto
    {
        public string PcookiesCode { get; set; }
        public string PcookiesName { get; set; }
        public string PcookiesValue { get; set; }
    }
}
