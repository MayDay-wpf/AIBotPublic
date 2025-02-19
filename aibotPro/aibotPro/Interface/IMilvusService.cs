using aibotPro.Dtos;
using Milvus.Client;
using System;

namespace aibotPro.Interface
{
    public interface IMilvusService
    {
        Task<bool> InsertVector(List<MilvusDataDto> milvusDataDto, string fileCode, string account);
        Task<bool> DeleteVector(List<string> ids);

        Task<SearchVectorResultByMilvus> SearchVector(List<float> vector, string account,
            List<string> typeCode = null, int topK = 3);
        Task<List<MilvusDataDto>> QueryData(string account, List<string> typeCode, int limit, string filter);
        Task<bool> DeleteMemory(string username, string id);
    }
}
