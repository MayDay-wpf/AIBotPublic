using aibotPro.Dtos;
using Milvus.Client;

namespace aibotPro.Interface
{
    public interface IMilvusService
    {
        Task<bool> InsertVector(List<MilvusDataDto> milvusDataDto, string fileCode, string account);
        Task<bool> DeleteVector(List<string> ids);
        Task<SearchVectorResultByMilvus> SearchVector(List<float> vector, string account, List<string> typeCode, int topK);
    }
}
