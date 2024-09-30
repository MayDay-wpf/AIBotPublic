using aibotPro.Dtos;
using aibotPro.Interface;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using OfficeOpenXml.FormulaParsing.Excel.Functions.Text;
using RestSharp;

namespace aibotPro.Service
{
    public class VectorHelper
    {
        private readonly IRedisService _redisService;
        public string apikey;
        public string endpoint;
        public string collectionName;
        public string embeddingsUrl;
        public string embeddingsapikey;
        public string embeddingsmodel;
        public VectorHelper(IRedisService redisService, string _alibbapikey, string _endpoint, string _collectionName, string _embeddingsUrl, string _embeddingsapikey, string _embeddingsmodel)
        {
            _redisService = redisService;
            apikey = _alibbapikey;
            endpoint = _endpoint;
            collectionName = _collectionName;
            embeddingsUrl = _embeddingsUrl;
            embeddingsapikey = _embeddingsapikey;
            embeddingsmodel = _embeddingsmodel;
        }
        public async Task<List<List<double>>> StringToVectorAsync(string model, List<string> inputs, string Account)
        {
            var client = new RestClient(embeddingsUrl);
            int EmbRate = 5;//5个并发
            var semaphore = new SemaphoreSlim(EmbRate); //并发限制
            var tasks = new List<Task<List<double>>>(); //保存所有任务

            int totalCount = inputs.Count;
            int completeCount = 0; // 已完成任务数

            foreach (var input in inputs)
            {
                await semaphore.WaitAsync(); //等待可用的并发插槽
                tasks.Add(Task.Run(async () =>
                {
                    try
                    {
                        var request = CreateRequest(model, input);
                        var response = await client.ExecuteAsync(request);
                        Interlocked.Increment(ref completeCount);
                        return ParseResponse(response);
                    }
                    finally
                    {
                        semaphore.Release();
                        await _redisService.SetAsync($"{Account}_wikiuploadlog", $"切片进度：{completeCount} / {totalCount}");// 在释放并发资源的时候更新完成的任务数
                    }
                }));
            }

            await Task.WhenAll(tasks); //等待所有任务完成
            return tasks.Select(t => t.Result).ToList(); //转换结果并返回
        }
        private RestRequest CreateRequest(string model, string input)
        {
            var request = new RestRequest("", Method.Post);
            request.AddHeader("Authorization", $"Bearer {embeddingsapikey}");
            request.AddHeader("Content-Type", "application/json");
            request.AddHeader("Accept", "*/*");
            var body = @"{" + "\n" +
            $@"  ""model"": ""{model}""," + "\n" +
            $@"  ""input"": ""{input}""" + "\n" +
            @"}";
            request.AddParameter("application/json", body, ParameterType.RequestBody);
            return request;
        }

        private static List<double> ParseResponse(RestResponse response)
        {
            if (response.IsSuccessful)
            {
                EmbeddingApiResponse embeddingApiResponse = JsonConvert.DeserializeObject<EmbeddingApiResponse>(response.Content);
                return embeddingApiResponse.Data[0].Embedding;
            }
            else
                return null;
        }
        public async Task<List<List<QA>>> StringToQA(string model, List<string> inputs, string Account)
        {
            var client = new RestClient(embeddingsUrl);
            int EmbRate = 1;//并发
            var semaphore = new SemaphoreSlim(EmbRate); //并发限制
            var tasks = new List<Task<List<QA>>>(); //保存所有任务

            int totalCount = inputs.Count;
            int completeCount = 0; // 已完成任务数

            foreach (var input in inputs)
            {
                await semaphore.WaitAsync(); //等待可用的并发插槽
                tasks.Add(Task.Run(async () =>
                {
                    try
                    {
                        var request = CreateQARequest(model, input);
                        var response = await client.ExecuteAsync(request);
                        Interlocked.Increment(ref completeCount);
                        return ParseQAResponse(response);
                    }
                    finally
                    {
                        semaphore.Release();
                        await _redisService.SetAsync($"{Account}_wikiuploadlog", $"清洗进度：{completeCount} / {totalCount}");// 在释放并发资源的时候更新完成的任务数
                    }
                }));
            }

            await Task.WhenAll(tasks); //等待所有任务完成
            return tasks.Select(t => t.Result).ToList(); //转换结果并返回
        }
        private RestRequest CreateQARequest(string model, string input)
        {
            var request = new RestRequest("", Method.Post);
            request.AddHeader("Authorization", $"Bearer {embeddingsapikey}");
            request.AddHeader("Content-Type", "application/json");
            request.AddHeader("Accept", "*/*");
            request.AddHeader("Connection", "keep-alive");
            var body = @"{
                            " + "\n" +
                                        @$"  ""model"": ""{model}"",
                            " + "\n" +
                                        @"  ""response_format"": {
                            " + "\n" +
                                        @"    ""type"": ""json_object""
                            " + "\n" +
                                        @"  },
                            " + "\n" +
                                        @"  ""messages"": [
                            " + "\n" +
                                        @"    {
                            " + "\n" +
                                        @"      ""role"": ""system"",
                            " + "\n" +
                                        @"      ""content"": ""你是一个有用的问题归纳机器人，请你根据文本内容提出问题并解答以Q/A形式，并以JSON格式输出，格式示例：{'QA':[{'question':'什么是ChatGPT','answer':'ChatGPT是由OpenAI公司开发并运用的AI自然语言交互服务'},{'question':'ChatGPT能帮你做什么','answer':'ChatGPT可以帮助你编程，润色文章，发送邮件等等'}]}""
                            " + "\n" +
                                        @"    },
                            " + "\n" +
                                        @"    {
                            " + "\n" +
                                        @"      ""role"": ""user"",
                            " + "\n" +
                                        @$"      ""content"": ""{input}""
                            " + "\n" +
                                        @"    }
                            " + "\n" +
                                        @"  ],
                            " + "\n" +
                                        @"  ""stream"": false
                            " + "\n" +
                                        @"}";
            request.AddParameter("application/json", body, ParameterType.RequestBody);
            return request;
        }
        private static List<QA> ParseQAResponse(RestResponse response)
        {
            if (response.IsSuccessful)
            {
                JObject jsonObj = JsonConvert.DeserializeObject<JObject>(response.Content);
                string content = jsonObj["choices"][0]["message"]["content"].ToString();
                QAData res = JsonConvert.DeserializeObject<QAData>(content);
                return res.QA;
            }
            else
                return null;
        }

        public async Task<bool> InnerVectorAsync(Root root, string Account)
        {
            int totalCount = root.docs.Count;  // 文档总数
            int sentCount = 0; // 已发送请求数量

            for (int i = 0; i < totalCount; i += 2)
            {
                var batchDocs = root.docs.Skip(i).Take(2).ToList(); // 每次取2个文档

                var response = await SendBatchRequestAsync2(batchDocs);
                Interlocked.Add(ref sentCount, batchDocs.Count);
                //FC.wikiuploadlog = $"转存进度：{sentCount} / {totalCount}";
                await _redisService.SetAsync($"{Account}_wikiuploadlog", $"转存进度：{sentCount} / {totalCount}");

                dynamic result = JsonConvert.DeserializeObject<dynamic>(response.Content);
                if (result.code != 0)
                    return false;
            }

            return true;
        }
        public async Task<RestResponse> SendBatchRequestAsync(List<Doc> batchDocs, SemaphoreSlim semaphore)
        {
            try
            {
                var client = new RestClient($"https://{endpoint}/v1/collections/{collectionName}/docs");
                var request = new RestRequest("", Method.Post);
                request.AddHeader("dashvector-auth-token", apikey);
                request.AddHeader("Content-Type", "application/json");
                request.AddHeader("Accept", "*/*");

                var body = JsonConvert.SerializeObject(new Root { docs = batchDocs });
                request.AddParameter("application/json", body, ParameterType.RequestBody);

                var response = await client.ExecuteAsync(request);
                return response;
            }
            finally
            {
                semaphore.Release(); // 释放信号量，确保其他任务能够获取
            }
        }
        public async Task<RestResponse> SendBatchRequestAsync2(List<Doc> batchDocs)
        {
            var client = new RestClient($"https://{endpoint}/v1/collections/{collectionName}/docs");
            var request = new RestRequest("", Method.Post);
            request.AddHeader("dashvector-auth-token", apikey);
            request.AddHeader("Content-Type", "application/json");
            request.AddHeader("Accept", "*/*");

            var body = JsonConvert.SerializeObject(new Root { docs = batchDocs });
            request.AddParameter("application/json", body, ParameterType.RequestBody);

            var response = await client.ExecuteAsync(request);
            return response;
        }

        public SearchVectorResult SearchVector(SearchVectorPr searchVectorPr)
        {
            var client = new RestClient($"https://{endpoint}/v1/collections/{collectionName}/query");
            var request = new RestRequest("", Method.Post);
            request.AddHeader("dashvector-auth-token", apikey);
            request.AddHeader("Content-Type", "application/json");
            request.AddHeader("Accept", "*/*");
            var body = JsonConvert.SerializeObject(searchVectorPr);
            request.AddParameter("application/json", body, ParameterType.RequestBody);
            RestResponse response = client.Execute(request);
            SearchVectorResult result = JsonConvert.DeserializeObject<SearchVectorResult>(response.Content);
            return result;
        }
    }
    public class Root
    {
        public List<Doc> docs { get; set; }
    }
    public class DelRoot
    {
        public List<string> ids { get; set; }
    }
    public class Doc
    {
        public string id { get; set; }

        public List<double> vector { get; set; }

        // 因为字段可以是任何列对（键值对），因此我们可以使用Dictionary来处理这种情况
        public Dictionary<string, object> fields { get; set; }
    }
    public class EmbeddingElement
    {
        public string ObjectType { get; set; }
        public int Index { get; set; }
        public List<double> Embedding { get; set; }
    }

    public class Usage
    {
        public int PromptTokens { get; set; }
        public int TotalTokens { get; set; }
    }

    public class EmbeddingApiResponse
    {
        public string ObjectType { get; set; }
        public List<EmbeddingElement> Data { get; set; }
        public string Model { get; set; }
        public Usage Usage { get; set; }
    }



    public class Fields
    {
        public string account { get; set; }
        public string knowledge { get; set; }
    }

    public class Output
    {
        public string id { get; set; }
        public Fields fields { get; set; }
        public double score { get; set; }
    }

    public class SearchVectorResult
    {
        public int code { get; set; }
        public string request_id { get; set; }
        public string message { get; set; }
        public List<Output> output { get; set; }
    }
    public class SearchVectorPr
    {
        public List<double> vector { get; set; }
        public int topk { get; set; }
        public string filter { get; set; }
    }
}
