using aibotPro.AppCode;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Runtime.Serialization;
using static OpenAI.ObjectModels.SharedModels.IOpenAiModels;

namespace aibotPro.Dtos
{
    public class WorkFlowNodeData
    {
        [JsonProperty("drawflow")]
        public Drawflow Drawflow { get; set; }
    }
    public class Drawflow
    {
        [JsonProperty("Home")]
        public Home Home { get; set; }
    }

    public class Home
    {
        [JsonProperty("data")]
        public Dictionary<string, NodeData> Data { get; set; }
    }
    public class NodeData
    {
        [JsonProperty("id")]
        public int Id { get; set; }

        [JsonProperty("name")]
        public string Name { get; set; }
        [JsonIgnore]
        public NodeSpecificData Data { get; set; }
        [JsonProperty("data")]
        private JToken RawData { get; set; }
        public void InitializeDataFromNodeType()
        {
            switch (Class)
            {
                case "start":
                    Data = RawData.ToObject<StartData>();
                    break;
                case "javascript":
                    Data = RawData.ToObject<JavaScriptData>();
                    break;
                case "http":
                    Data = RawData.ToObject<HttpData>();
                    break;
                case "LLM":
                    Data = RawData.ToObject<LLMData>();
                    break;
                case "DALL":
                    Data = RawData.ToObject<DALLData>();
                    break;
                case "DALLsm":
                    Data = RawData.ToObject<DALLsmData>();
                    break;
                case "downloadimg":
                    Data = RawData.ToObject<DownLoadImg>();
                    break;
                case "web":
                    Data = RawData.ToObject<WebData>();
                    break;
                case "ifelse":
                    Data = RawData.ToObject<IfElseData>();
                    break;
                case "knowledge":
                    Data = RawData.ToObject<KnowledgeData>();
                    break;
                case "debug":
                    Data = RawData.ToObject<DebugData>();
                    break;
                case "end":
                    Data = RawData.ToObject<EndData>();
                    break;
                // 根据需要添加更多的 case
                default:
                    throw new InvalidOperationException($"Unsupported node type: {Class}");
            }
        }
        [OnDeserialized]
        internal void OnDeserializedMethod(StreamingContext context)
        {
            InitializeDataFromNodeType();
        }

        [JsonProperty("class")]
        public string Class { get; set; }

        [JsonProperty("html")]
        public string Html { get; set; }

        [JsonProperty("typenode")]
        public bool TypeNode { get; set; }

        [JsonProperty("inputs")]
        public Dictionary<string, NodeConnection> Inputs { get; set; }

        [JsonProperty("outputs")]
        public Dictionary<string, NodeConnection> Outputs { get; set; }

        [JsonProperty("pos_x")]
        public float PosX { get; set; }

        [JsonProperty("pos_y")]
        public float PosY { get; set; }
    }
    public class NodeConnection
    {
        [JsonProperty("connections")]
        public List<ConnectionDetail> Connections { get; set; }
    }

    public class ConnectionDetail
    {
        [JsonProperty("node")]
        public string Node { get; set; }

        [JsonProperty("output")]
        public string Output { get; set; }

        [JsonProperty("input")]
        public string Input { get; set; }
    }

    // Classes for the processing items in Output can be made more specific as needed

    public class ProcessingItem
    {
        [JsonProperty("prName")]
        public string PrName { get; set; }
        [JsonProperty("prType")]
        public string PrType { get; set; }

        [JsonProperty("prInfo")]
        public string PrInfo { get; set; }

        [JsonProperty("prConst")]
        public string PrConst { get; set; }
    }
    // 基类
    public abstract class NodeSpecificData
    {
        public virtual object GetOutput() => null;
    }
    // Start派生类
    public class StartData : NodeSpecificData
    {
        [JsonProperty("output")]
        public StartOutput Output { get; set; }

        public override object GetOutput() => Output;
    }

    // JavaScript派生类
    public class JavaScriptData : NodeSpecificData
    {
        [JsonProperty("output")]
        public new JavaScriptOutput Output { get; set; }
        public override object GetOutput() => Output;
    }

    // Http派生类
    public class HttpData : NodeSpecificData
    {
        [JsonProperty("output")]
        public new HttpOutput Output { get; set; }
        public override object GetOutput() => Output;
    }

    // LLM派生类
    public class LLMData : NodeSpecificData
    {
        [JsonProperty("output")]
        public new LLMOutput Output { get; set; }
        public override object GetOutput() => Output;
    }
    // DALL派生类
    public class DALLData : NodeSpecificData
    {
        [JsonProperty("output")]
        public new DALLOutput Output { get; set; }
        public override object GetOutput() => Output;
    }
    // DALL-E2派生类
    public class DALLsmData : NodeSpecificData
    {
        [JsonProperty("output")]
        public new DALLsmOutput Output { get; set; }
        public override object GetOutput() => Output;
    }
    // DownLoadImageData派生类
    public class DownLoadImg : NodeSpecificData
    {
        [JsonProperty("output")]
        public new DownLoadImageOutput Output { get; set; }
        public override object GetOutput() => Output;
    }
    // DebugData派生类
    public class DebugData : NodeSpecificData
    {
        [JsonProperty("output")]
        public new DebugOutput Output { get; set; }
        public override object GetOutput() => Output;
    }
    // Web派生类
    public class WebData : NodeSpecificData
    {
        [JsonProperty("output")]
        public new WebOutput Output { get; set; }
        public override object GetOutput() => Output;
    }
    //IF-ELSE派生类
    public class IfElseData : NodeSpecificData
    {
        [JsonProperty("output")]
        public new IfElse Output { get; set; }
        public override object GetOutput() => Output;
    }
    //Knowledge派生类
    public class KnowledgeData : NodeSpecificData
    {
        [JsonProperty("output")]
        public new Konwledge Output { get; set; }
        public override object GetOutput() => Output;
    }
    // End派生类
    public class EndData : NodeSpecificData
    {
        [JsonProperty("output")]
        public new EndOutput Output { get; set; }
        public override object GetOutput() => Output;
    }
    public class StartOutput
    {
        [JsonProperty("prItems")]
        public List<ProcessingItem> PrItems { get; set; }
    }

    public class JavaScriptOutput
    {
        [JsonProperty("javascript")]
        public string JavaScript { get; set; }
    }

    public class HttpOutput
    {
        [JsonProperty("type")]
        public string Type { get; set; }
        [JsonProperty("jsontemplate")]
        public string Jsontemplate { get; set; }
        [JsonProperty("paramsItems")]
        public List<ParamsItem> ParamsItems { get; set; }

        [JsonProperty("headersItems")]
        public List<HeaderItem> HeadersItems { get; set; }

        [JsonProperty("cookiesItems")]
        public List<CookieItem> CookiesItems { get; set; }

        [JsonProperty("requestUrl")]
        public string RequestUrl { get; set; }
        [JsonProperty("judgescript")]
        public string JudgeScript { get; set; }
        [JsonProperty("httpmaxcount")]
        public int HttpMaxcount { get; set; }
        [JsonProperty("httpdelayed")]
        public int HttpDelayed { get; set; }
    }

    public class LLMOutput
    {
        [JsonProperty("aimodel")]
        public string AiModel { get; set; }

        [JsonProperty("prompt")]
        public string Prompt { get; set; }
        [JsonProperty("imgurl")]
        public string ImgUrl { get; set; }
        [JsonProperty("retry")]
        public int Retry { get; set; }
        [JsonProperty("stream")]
        public bool Stream { get; set; }
        [JsonProperty("jsonmodel")]
        public bool JsonModel { get; set; }
        [JsonProperty("judgescript")]
        public string JudgeScript { get; set; }
        [JsonProperty("llmmaxcount")]
        public int LLMMaxcount { get; set; }
    }
    public class DALLOutput
    {
        [JsonProperty("prompt")]
        public string Prompt { get; set; }
        [JsonProperty("size")]
        public string Size { get; set; }
        [JsonProperty("quality")]
        public string Quality { get; set; }
        [JsonProperty("retry")]
        public int Retry { get; set; }
    }
    public class DALLsmOutput
    {
        [JsonProperty("prompt")]
        public string Prompt { get; set; }
        [JsonProperty("retry")]
        public int Retry { get; set; }
    }
    public class DownLoadImageOutput
    {
        [JsonProperty("imageurl")]
        public string ImageUrl { get; set; }
        [JsonProperty("prompt")]
        public string Prompt { get; set; }
    }
    public class DebugOutput
    {
        [JsonProperty("chatlog")]
        public string ChatLog { get; set; }
    }

    public class WebOutput
    {
        [JsonProperty("prompt")]
        public string Prompt { get; set; }
    }
    public class IfElse
    {
        [JsonProperty("judgresult")]
        public string JudgResult { get; set; }
    }
    public class Konwledge
    {
        [JsonProperty("prompt")]
        public string Prompt { get; set; }
        [JsonProperty("retry")]
        public int Retry { get; set; }
        [JsonProperty("topk")]
        public int TopK { get; set; }
        [JsonProperty("typecode")]
        public List<string> TypeCode { get; set; }
    }
    public class EndOutput
    {
        [JsonProperty("endaction")]
        public string EndAction { get; set; }

        [JsonProperty("endscript")]
        public string EndScript { get; set; }
    }
    public class ParamsItem
    {
        [JsonProperty("paramKey")]
        public string ParamKey { get; set; }

        [JsonProperty("paramValue")]
        public string ParamValue { get; set; }
    }
    public class HeaderItem
    {
        [JsonProperty("hdKey")]
        public string HdKey { get; set; }

        [JsonProperty("hdValue")]
        public string HdValue { get; set; }
    }

    public class CookieItem
    {
        [JsonProperty("ckKey")]
        public string CkKey { get; set; }

        [JsonProperty("ckValue")]
        public string CkValue { get; set; }
    }
}
