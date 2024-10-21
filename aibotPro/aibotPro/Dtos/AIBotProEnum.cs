namespace aibotPro.Dtos;

public class AIBotProEnum
{
    public enum HashFieldOperationMode
    {
        Overwrite, // 覆盖原有值
        Append, // 累积拼接
        NumericAdd // 数字累加
    }
}