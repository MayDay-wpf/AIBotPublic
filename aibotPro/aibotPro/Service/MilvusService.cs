using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using iTextSharp.text;
using Microsoft.Extensions.Options;
using Milvus.Client;
using Newtonsoft.Json;
using OfficeOpenXml.FormulaParsing.Excel.Functions;
using RestSharp;
using StackExchange.Redis;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Net;

namespace aibotPro.Service
{
    public class MilvusService : IMilvusService
    {
        private readonly AIBotProContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IRedisService _redis;
        private readonly ISystemService _systemService;
        private readonly MilvusOptions _options;
        private readonly MilvusClient _milvusclient;
        public MilvusService(AIBotProContext context, IHttpContextAccessor httpContextAccessor, IRedisService redis, ISystemService systemService, IOptions<MilvusOptions> options, MilvusClient milvusClient)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
            _redis = redis;
            _systemService = systemService;
            _options = options.Value;
            _milvusclient = milvusClient;
        }

        public async Task<bool> InsertVector(List<MilvusDataDto> milvusDataDtos, string fileCode, string account)
        {
            try
            {
                MilvusHealthState res = await _milvusclient.HealthAsync();
                //var data = milvusDataDtos.Select(milvusData => new
                //{
                //    id = milvusData.Id,
                //    vector = milvusData.Vector,
                //    account = milvusData.Account,
                //    vectorcontent = milvusData.VectorContent,
                //    type = milvusData.Type
                //}).ToList();

                //var body = new
                //{
                //    dbName = _options.Database,
                //    collectionName = _options.Collection,
                //    data
                //};
                //var json = JsonConvert.SerializeObject(body);
                //var uri = $"{_options.Host}:{_options.Port}";
                MilvusCollection collection = _milvusclient.GetCollection(_options.Collection);

                // 准备数据
                var ids = milvusDataDtos.Select(data => data.Id).ToList();
                var vectors = milvusDataDtos.Select(data => new ReadOnlyMemory<float>(data.Vector.ToArray())).ToList();
                var accounts = milvusDataDtos.Select(data => data.Account).ToList();
                var vectorContents = milvusDataDtos.Select(data => data.VectorContent).ToList();
                var types = milvusDataDtos.Select(data => data.Type).ToList();

                // 插入数据
                MutationResult result = await collection.InsertAsync(
                    new FieldData[]{
                        FieldData.Create("id", ids),
                        FieldData.CreateFloatVector("vector", vectors),
                        FieldData.Create("account", accounts),
                        FieldData.Create("vectorcontent", vectorContents),
                        FieldData.Create("type", types)
                    });
                if (result.InsertCount > 0)
                {
                    //写如KnowledgeList
                    foreach (var item in milvusDataDtos)
                    {
                        KnowledgeList knowledgeList = new KnowledgeList();
                        knowledgeList.Account = account;
                        knowledgeList.FileCode = fileCode;
                        knowledgeList.VectorId = item.Id;
                        _context.KnowledgeLists.Add(knowledgeList);
                    }
                    await _context.SaveChangesAsync();
                    return true;
                }
                else
                    return false;
            }
            catch (Exception e)
            {

                await _systemService.WriteLog($"Error while inserting vector: {e.Message}", Dtos.LogLevel.Error, "system");
                return false;
            }
        }

        public async Task<bool> DeleteVector(List<string> ids)
        {
            try
            {
                MilvusCollection collection = _milvusclient.GetCollection(_options.Collection);
                // 在每个ID两侧添加单引号
                string idsStr = string.Join(",", ids.Select(id => $"'{id}'"));
                MutationResult result = await collection.DeleteAsync(@$"id in [{idsStr}]");
                if (result.DeleteCount > 0)
                    return true;
                else
                    return false;
            }
            catch (Exception e)
            {
                await _systemService.WriteLog($"Error while delete vector: {e.Message}", Dtos.LogLevel.Error, "system");
                return false;
            }
        }
        public async Task<Dtos.SearchVectorResultByMilvus> SearchVector(List<float> vector, string account, List<string> typeCode, int topK)
        {
            SearchVectorResultByMilvus result = new SearchVectorResultByMilvus();
            string typeCodeStr = string.Join(",", typeCode.Select(code => $"'{code}'"));
            try
            {
                var body = new
                {
                    dbName = _options.Database,
                    collectionName = _options.Collection,
                    filter = @$"account=='{account}' and type in [{typeCodeStr}]",
                    data = new List<List<float>>() { vector },
                    limit = topK,
                    outputFields = new List<string>() { "vectorcontent" },
                    annsField = "vector"
                };
                var json = JsonConvert.SerializeObject(body);
                var uri = $"http://{_options.Host}:{_options.Port}/v2/vectordb/entities/search";
                string res = await PostAsync(json, uri, $"{_options.UserName}:{_options.Password}");
                if (!string.IsNullOrEmpty(res))
                    result = JsonConvert.DeserializeObject<SearchVectorResultByMilvus>(res);
                return result;
            }
            catch (Exception e)
            {
                await _systemService.WriteLog($"Error while search vector: {e.Message}", Dtos.LogLevel.Error, "system");
                return result;
            }
        }

        private async Task<bool> InsertMilvus(string body, string uri, string authorization)
        {
            string result = await PostAsync(body, uri, authorization);

            if (!string.IsNullOrEmpty(result))
            {
                var res = JsonConvert.DeserializeObject<ResponseModel>(result);
                return res?.Code == 200;
            }
            return false;
        }
        private async Task<string> PostAsync(string body, string uri, string authorization)
        {
            var client = new RestClient(uri);
            var request = new RestRequest("", Method.Post);
            request.AddHeader("Content-Type", "application/json");
            request.AddHeader("Accept", "*/*");
            request.AddHeader("Authorization", $"Bearer {authorization}");
            request.AddParameter("application/json", body, ParameterType.RequestBody);
            RestResponse response = await client.ExecuteAsync(request);
            return response.Content;
        }
    }
}
