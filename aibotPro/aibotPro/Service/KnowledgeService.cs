using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using Newtonsoft.Json;
using RestSharp;
using System.Collections;
using System.Security.Principal;
using System.Text.RegularExpressions;

namespace aibotPro.Service
{
    public class KnowledgeService : IKnowledgeService
    {
        private readonly ISystemService _systemService;
        private readonly AIBotProContext _context;
        private readonly IRedisService _redisService;
        public KnowledgeService(ISystemService systemService, AIBotProContext context, IRedisService redisService)
        {
            _systemService = systemService;
            _context = context;
            _redisService = redisService;
        }
        public bool SaveKnowledgeFile(Knowledge knowledge)
        {
            //保存文件
            _context.Knowledges.Add(knowledge);
            return _context.SaveChanges() > 0;
        }
        public List<Knowledge> GetKnowledgeFiles(int page, int pageSize, string name, out int total, string account = "")
        {
            // 利用IQueryable延迟执行，直到真正需要数据的时候才去数据库查询
            IQueryable<Knowledge> query = _context.Knowledges;

            // 如果name不为空，则加上name的过滤条件
            if (!string.IsNullOrEmpty(name))
            {
                query = query.Where(x => x.FileName.Contains(name));
            }
            if (!string.IsNullOrEmpty(account))
            {
                query = query.Where(x => x.Account == account);
            }

            // 首先计算总数，此时还未真正运行SQL查询
            total = query.Count();

            // 然后添加分页逻辑，此处同样是构建查询，没有执行
            var knowledges = query.OrderBy(x => x.CreateTime) // 这里可以根据需要替换为合适的排序字段
                                .Skip((page - 1) * pageSize)
                                .Take(pageSize)
                                .ToList(); // 直到调用ToList，查询才真正执行

            return knowledges;
        }
        public bool DeleteKnowledgeFiles(string fileCode, string account)
        {
            //删除文件库文件
            var knowledge = _context.Knowledges.FirstOrDefault(x => x.FileCode == fileCode && x.Account == account);
            if (knowledge != null)
            {
                _context.Knowledges.Remove(knowledge);
                //组合文件路径
                string filePath = $"wwwroot{knowledge.FilePath}";
                //根据文件路径删除文件
                if (_systemService.DeleteFile(filePath))
                {
                    return _context.SaveChanges() > 0;
                }
            }
            return false;
        }
        public async Task UploadKnowledgeToVector(string embModel, string processType, string aiModel, string filePath, string fileCode, string chunkLength, string account)
        {
            List<SystemCfg> systemCfgs = _systemService.GetSystemCfgs();
            var Alibaba_DashVectorApiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "Alibaba_DashVectorApiKey")?.CfgValue;
            var Alibaba_DashVectorEndpoint = systemCfgs.FirstOrDefault(x => x.CfgKey == "Alibaba_DashVectorEndpoint")?.CfgValue;
            var Alibaba_DashVectorCollectionName = systemCfgs.FirstOrDefault(x => x.CfgKey == "Alibaba_DashVectorCollectionName")?.CfgValue;
            var EmbeddingsUrl = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsUrl")?.CfgValue;
            var EmbeddingsApiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsApiKey")?.CfgValue;
            var QAurl = systemCfgs.FirstOrDefault(x => x.CfgKey == "QAurl")?.CfgValue;
            if (processType == "unwash")//不清洗切片
            {
                VectorHelper vectorHelper = new VectorHelper(_redisService, Alibaba_DashVectorApiKey, Alibaba_DashVectorEndpoint, Alibaba_DashVectorCollectionName, EmbeddingsUrl, EmbeddingsApiKey);
                //取出文件内容
                string content = await _systemService.GetFileText(filePath);
                //去除换行\n \r
                content = content.Replace("\r", "").Replace("\n", "").Replace("\"", "“");
                List<string> chunkList = SplitIntoBlocks(content, 2000, 200);//切片
                chunkList.RemoveAll(s => string.IsNullOrWhiteSpace(s));//去除空行
                await _redisService.SetAsync($"{account}_wikiuploadlog", "文件准备切片嵌入中...");
                List<List<double>> vectorList = await vectorHelper.StringToVectorAsync("text-embedding-3-small", chunkList, account);
                await _redisService.SetAsync($"{account}_wikiuploadlog", "文件切片转存中...");
                await ChunkSave(vectorList, chunkList, account, fileCode, vectorHelper);
            }
            else//清洗切片
            {
                try
                {
                    VectorHelper vectorHelper = new VectorHelper(_redisService, Alibaba_DashVectorApiKey, Alibaba_DashVectorEndpoint, Alibaba_DashVectorCollectionName, QAurl, EmbeddingsApiKey);
                    //取出文件内容
                    string content = await _systemService.GetFileText(filePath);
                    //去除换行\n \r
                    content = content.Replace("\r", "").Replace("\n", "").Replace("\"", "“");
                    List<string> chunkList = SplitIntoBlocks(content, 2000, 200);//切片
                    chunkList.RemoveAll(s => string.IsNullOrWhiteSpace(s));//去除空行
                    await _redisService.SetAsync($"{account}_wikiuploadlog", "文件清洗中...");
                    List<List<QA>> qaList = await vectorHelper.StringToQA(aiModel, chunkList, account);
                    //移除qaList中的null
                    qaList.RemoveAll(s => s == null);
                    await _redisService.SetAsync($"{account}_wikiuploadlog", "文件清洗完毕，准备切片嵌入...");
                    //转切片
                    List<string> qaChunkList = new List<string>();
                    foreach (var item in qaList)
                    {
                        string qa = "";
                        foreach (var q in item)
                        {
                            qa += "【提问：" + q.question + " 回答：" + q.answer + "】";
                        }
                        qaChunkList.Add(qa.Replace("\r", "").Replace("\n", "").Replace("\"", "“"));
                    }
                    vectorHelper.embeddingsUrl = EmbeddingsUrl;
                    List<List<double>> vectorList = await vectorHelper.StringToVectorAsync("text-embedding-3-small", qaChunkList, account);
                    await ChunkSave(vectorList, qaChunkList, account, fileCode, vectorHelper);
                }
                catch (Exception e)
                {
                    await _redisService.DeleteAsync($"{account}_wikiuploadlog");
                    throw;
                }

            }

        }
        //文件切片
        public static List<string> SplitIntoBlocks(string text, int blockSize, int overlapSize)
        {
            List<string> blocks = new List<string>();
            if (blockSize <= overlapSize)
            {
                // 当blockSize小于或等于overlapSize时，直接将整个文本作为一个分片
                blocks.Add(text);
                return blocks;
            }

            for (int i = 0; i < text.Length; i += blockSize - overlapSize)
            {
                if (i == 0)
                {
                    // 第一个分片不包含重叠部分
                    blocks.Add(text.Substring(0, Math.Min(blockSize, text.Length)));
                }
                else
                {
                    int start = i - overlapSize;
                    int length = Math.Min(blockSize + overlapSize, text.Length - start);
                    blocks.Add(text.Substring(start, length));
                }
            }

            return blocks;
        }
        public bool DeleteVector(DelRoot delRoot)
        {
            List<SystemCfg> systemCfgs = _systemService.GetSystemCfgs();
            var Alibaba_DashVectorApiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "Alibaba_DashVectorApiKey")?.CfgValue;
            var Alibaba_DashVectorEndpoint = systemCfgs.FirstOrDefault(x => x.CfgKey == "Alibaba_DashVectorEndpoint")?.CfgValue;
            var Alibaba_DashVectorCollectionName = systemCfgs.FirstOrDefault(x => x.CfgKey == "Alibaba_DashVectorCollectionName")?.CfgValue;
            var client = new RestClient($"https://{Alibaba_DashVectorEndpoint}/v1/collections/{Alibaba_DashVectorCollectionName}/docs");
            var request = new RestRequest("", Method.Delete);
            request.AddHeader("dashvector-auth-token", Alibaba_DashVectorApiKey);
            request.AddHeader("Content-Type", "application/json");
            request.AddHeader("Accept", "*/*");
            var body = JsonConvert.SerializeObject(delRoot);
            request.AddParameter("application/json", body, ParameterType.RequestBody);
            RestResponse response = client.Execute(request);
            dynamic result = JsonConvert.DeserializeObject<dynamic>(response.Content);
            if (result.code == 0)
                return true;
            else
                return false;
        }
        public Task<string> SearchSchedule(string key)
        {
            var result = _redisService.GetAsync(key);
            if (result != null)
                return result;
            else
                return null;
        }
        //切片保存
        public async Task ChunkSave(List<List<double>> vectorList, List<string> chunkList, string account, string fileCode, VectorHelper vectorHelper)
        {
            Root root = new Root();
            List<Doc> docs = new List<Doc>();
            for (int i = 0; i < vectorList.Count; i++)
            {
                if (vectorList[i] == null)
                    continue;
                Dictionary<string, object> fields = new Dictionary<string, object>();
                fields.Add("knowledge", chunkList[i]);
                fields.Add("account", account);
                Doc doc = new Doc
                {
                    id = Guid.NewGuid().ToString().Replace("-", ""),
                    vector = vectorList[i],
                    fields = fields
                };
                docs.Add(doc);
            }
            root.docs = docs;
            bool innerVector = await vectorHelper.InnerVectorAsync(root, account);
            if (innerVector)
                await _redisService.SetAsync($"{account}_wikiuploadlog", "success");
            for (int i = 0; i < docs.Count; i++)
            {
                //保存切片
                var knowledgeList = _context.KnowledgeLists;
                knowledgeList.Add(new KnowledgeList
                {
                    Account = account,
                    FileCode = fileCode,
                    VectorId = docs[i].id
                });
            }
            await _redisService.DeleteAsync($"{account}_wikiuploadlog");
            _context.SaveChanges();
        }
    }
}
