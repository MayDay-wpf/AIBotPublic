using OpenAI.Builders;
using OpenAI.ObjectModels.RequestModels;
using OpenAI.ObjectModels.SharedModels;

namespace aibotPro.AppCode
{
    public class SystemPlugins
    {
        public static FunctionDefinition FnDall { get; } = new FunctionDefinitionBuilder("use_dalle3_withpr", "结合上下文生成DALL-E3提示词并绘制")
        .AddParameter("drawprompt", PropertyDefinition.DefineString("根据绘画要求，结合上下文优化后的DALL-E3绘画提示词，除非用户明确提出需要调用此函数，否则不要轻易调用"))
        .AddParameter("drawsize", PropertyDefinition.DefineEnum(new List<string> { "1024x1024", "1792x1024", "1024x1792" }, "需要绘制的图片尺寸,默认1024x1024"))
        .AddParameter("quality", PropertyDefinition.DefineEnum(new List<string> { "standard", "hd" }, "绘制图片的质量，默认standard标准质量，当许要更高清晰度和更多细节时，使用hd质量"))
        .Validate()
        .Build();

        public static FunctionDefinition FnGoogleSearch { get; } = new FunctionDefinitionBuilder("search_google_when_gpt_cannot_answer", "当 gpt 遇到无法回答的或者需要搜索引擎协助回答时从 google 搜索")
             .AddParameter("message", PropertyDefinition.DefineString("搜索句，支持中文或者英文"))
             .Validate()
             .Build();

        public static FunctionDefinition SysKnowledgeSearch { get; } = new FunctionDefinitionBuilder("search_knowledge_base", "从知识库中查询或搜索GPT无法得知的内容")
                 .AddParameter("message", PropertyDefinition.DefineString("搜索用的关键词，支持中文或者英文"))
                 .Validate()
                 .Build();
    }
}
