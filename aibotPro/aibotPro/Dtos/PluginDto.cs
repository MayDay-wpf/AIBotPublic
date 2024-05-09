using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace aibotPro.Dtos
{
    public class PluginDto
    {
        public int Id { get; set; }
        public int InstallId { get; set; }
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
        public string ParamCode { get; set; }
        public string PheadersCode { get; set; }
        public string PcookiesCode { get; set; }
        public string Pjscode { get; set; }
        public string PrunLocation { get; set; }
        public string Pusehtml { get; set; }
        public string IsPublic { get; set; }
        public DateTime? CreateTime { get; set; }
        public bool? MustHit { get; set; }
    }
}
