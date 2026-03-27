using aibotPro.Dtos;
using Betalgo.Ranul.OpenAI;
using Betalgo.Ranul.OpenAI.ObjectModels.RequestModels;
using System.Runtime.CompilerServices;
using static aibotPro.Dtos.BaiduResDto;

namespace aibotPro.Interface
{
    public interface IBaiduService
    {
        string GetText(string Imgbase64);//获取图片文字
        string GetRes(string Imgbase64);//获取图片识别结果
        IAsyncEnumerable<BaiduResDto.StreamResult> CallBaiduAI_Stream(ChatCompletionCreateRequest chatCompletionCreate, OpenAIOptions OpenAIOptions, string chatgroupId, [EnumeratorCancellation] CancellationToken cancellationToken = default);//文心一言流式输出
        Task<BaiduResDto.StreamResult> CallBaiduAI(ChatCompletionCreateRequest chatCompletionCreate, OpenAIOptions OpenAIOptions);//文心一言非流

        MessageDto AlignTheBody(ChatCompletionCreateRequest chatCompletionCreate);//请求体对齐
    }
}
