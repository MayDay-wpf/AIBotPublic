using Google.Apis.CustomSearchAPI.v1;
using Google.Apis.Services;

namespace aibotPro.AppCode
{
    public class GoogleSearch
    {
        private readonly string apiKey;
        private readonly string searchEngineId;

        public GoogleSearch(string apiKey, string searchEngineId)
        {
            this.apiKey = apiKey;
            this.searchEngineId = searchEngineId;
        }

        public List<SearchResult> Search(string query, bool onlyImg = false)
        {
            // 创建一个CustomsearchService实例
            var customsearchService = new CustomSearchAPIService(new BaseClientService.Initializer
            {
                ApiKey = apiKey
            });

            // 构建搜索请求
            var listRequest = customsearchService.Cse.List();
            listRequest.Cx = searchEngineId;
            listRequest.Q = query;
            if (onlyImg)
            {
                listRequest.SearchType = CseResource.ListRequest.SearchTypeEnum.Image;
            }

            // 发送搜索请求并获取结果
            var searchResult = listRequest.Execute();

            // 处理搜索结果
            var results = new List<SearchResult>();
            foreach (var item in searchResult.Items)
            {
                results.Add(new SearchResult
                {
                    Title = item.Title,
                    Link = item.Link,
                    Snippet = item.Snippet
                });
            }

            return results;
        }
    }
    public class SearchResult
    {
        public string Title { get; set; }
        public string Link { get; set; }
        public string Snippet { get; set; }
    }
}
