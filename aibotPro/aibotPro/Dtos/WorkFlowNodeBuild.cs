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
    public class WorkFlowCharging
    {
        public string Account { get; set; }
        public string ModelName { get; set; }
        public int InputCount { get; set; }
        public int OutputCount { get; set; }
        public bool IsDraw { get; set; } = false;
    }
}
