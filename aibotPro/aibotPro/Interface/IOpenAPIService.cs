using aibotPro.Dtos;
using aibotPro.Models;
using OpenAI;
using OpenAI.Managers;
using OpenAI.ObjectModels.RequestModels;
using OpenAI.ObjectModels.ResponseModels;

namespace aibotPro.Interface
{
    public interface IOpenAPIService
    {
        Task<Dictionary<string, string>> CallERNIEAsStream(HttpResponse httpResponse, ChatCompletionCreateRequest chatCompletionCreate, OpenAiOptions openAiOptions, WorkShopAIModel useModel, string account);
        Task<Dictionary<string, string>> CallOpenAIAsStream(HttpResponse httpResponse, ChatCompletionCreateRequest chatCompletionCreate, OpenAIService openAiService, string account);
        Task<ChatCompletionResponseUnStream> CallERNIE(ChatCompletionCreateRequest chatCompletionCreate, OpenAiOptions openAiOptions, WorkShopAIModel useModel, string account);
        Task<ChatCompletionResponseUnStream> CallOpenAI(ChatCompletionCreateRequest chatCompletionCreate, OpenAIService openAiService, string account);
        Byte[] CreateStream(ChatCompletionResponse chatCompletionResponse);//创建流
        ChatCompletionResponse CreateERNIEStreamResult(BaiduResDto.StreamResult responseContent);//ERNIE返回值对齐OpenAI
        ChatCompletionResponse CreateOpenAIStreamResult(ChatCompletionCreateResponse responseContent);//OpenAI返回值对齐OpenAI
        string DoubletypeRes(PluginResDto pluginResDto);//不进行AI二次对话的返回值对齐
        Task SendStream(HttpResponse httpResponse, byte[] msgBytes);//返回流数据
    }
}
