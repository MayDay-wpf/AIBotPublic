using MessagePack;

namespace aibotPro.Dtos
{
    public class WorkFlowNodeBuild
    {
        public int Seq { get; set; }
        public List<NodeData> Nodes { get; set; }
    }

    public class NodeOutput
    {
        public string NodeName { get; set; }
        public string OutputData { get; set; }
    }
}
