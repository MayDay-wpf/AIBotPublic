using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using NuGet.Packaging;
using RestSharp;
using StackExchange.Redis;
using System.Collections;
using System.Security.Policy;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;

namespace aibotPro.Service
{
    public class KnowledgeService : IKnowledgeService
    {
        private readonly ISystemService _systemService;
        private readonly AIBotProContext _context;
        private readonly IRedisService _redisService;
        private readonly IMilvusService _milvusService;
        private readonly IAiServer _aiServer;

        public KnowledgeService(ISystemService systemService, AIBotProContext context, IRedisService redisService,
            IMilvusService milvusService, IAiServer aiServer)
        {
            _systemService = systemService;
            _context = context;
            _redisService = redisService;
            _milvusService = milvusService;
            _aiServer = aiServer;
        }

        public bool SaveKnowledgeFile(Knowledge knowledge)
        {
            //保存文件
            _context.Knowledges.Add(knowledge);
            return _context.SaveChanges() > 0;
        }

        public List<Knowledge> GetKnowledgeFiles(int page, int pageSize, string name, out int total,
            string account = "", string typeCode = "")
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

            if (!string.IsNullOrEmpty(typeCode))
            {
                query = query.Where(x => x.TypeCode == typeCode);
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

        // public async Task UploadKnowledgeToVector(string embModel, string processType, string aiModel, string filePath,
        //     string fileCode, string chunkLength, string account)
        // {
        //     List<SystemCfg> systemCfgs = _systemService.GetSystemCfgs();
        //     // var Alibaba_DashVectorApiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "Alibaba_DashVectorApiKey")?.CfgValue;
        //     // var Alibaba_DashVectorEndpoint = systemCfgs.FirstOrDefault(x => x.CfgKey == "Alibaba_DashVectorEndpoint")?.CfgValue;
        //     // var Alibaba_DashVectorCollectionName = systemCfgs.FirstOrDefault(x => x.CfgKey == "Alibaba_DashVectorCollectionName")?.CfgValue;
        //     var EmbeddingsUrl = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsUrl")?.CfgValue;
        //     var EmbeddingsApiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsApiKey")?.CfgValue;
        //     var EmbeddingsModel = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsModel")?.CfgValue;
        //     var QAurl = systemCfgs.FirstOrDefault(x => x.CfgKey == "QAurl")?.CfgValue;
        //     var QAapikey = systemCfgs.FirstOrDefault(x => x.CfgKey == "QAapiKey")?.CfgValue;
        //     var QAmodel = systemCfgs.FirstOrDefault(x => x.CfgKey == "QAmodel")?.CfgValue;
        //     if (processType == "unwash") //不清洗切片
        //     {
        //         VectorHelper vectorHelper =
        //             new VectorHelper(_redisService, EmbeddingsUrl, EmbeddingsApiKey, EmbeddingsModel);
        //         //取出文件内容
        //         string content = await _systemService.GetFileText(filePath);
        //         //去除换行\n \r
        //         content = content.Replace("\r", "").Replace("\n", "").Replace("\"", "“");
        //         List<string> chunkList = SplitIntoBlocks(content, 2000, 200); //切片
        //         chunkList.RemoveAll(s => string.IsNullOrWhiteSpace(s)); //去除空行
        //         await _redisService.SetAsync($"{account}_wikiuploadlog", "文件准备切片嵌入中...");
        //         List<List<double>> vectorList = await vectorHelper.StringToVectorAsync(embModel, chunkList, account);
        //         await _redisService.SetAsync($"{account}_wikiuploadlog", "文件切片转存中...");
        //         await ChunkSave(vectorList, chunkList, account, fileCode, vectorHelper);
        //     }
        //     else //清洗切片
        //     {
        //         try
        //         {
        //             VectorHelper vectorHelper = new VectorHelper(_redisService, QAurl, QAapikey, QAmodel);
        //             //取出文件内容
        //             string content = await _systemService.GetFileText(filePath);
        //             //去除换行\n \r
        //             content = content.Replace("\r", "").Replace("\n", "").Replace("\"", "“");
        //             List<string> chunkList = SplitIntoBlocks(content, 2000, 200); //切片
        //             chunkList.RemoveAll(s => string.IsNullOrWhiteSpace(s)); //去除空行
        //             await _redisService.SetAsync($"{account}_wikiuploadlog", "文件清洗中...");
        //             List<List<QA>> qaList = await vectorHelper.StringToQA(aiModel, chunkList, account);
        //             //移除qaList中的null
        //             qaList.RemoveAll(s => s == null);
        //             await _redisService.SetAsync($"{account}_wikiuploadlog", "文件清洗完毕，准备切片嵌入...");
        //             //转切片
        //             List<string> qaChunkList = new List<string>();
        //             foreach (var item in qaList)
        //             {
        //                 string qa = "";
        //                 foreach (var q in item)
        //                 {
        //                     qa += "【提问：" + q.question + " 回答：" + q.answer + "】";
        //                 }
        //
        //                 qaChunkList.Add(qa.Replace("\r", "").Replace("\n", "").Replace("\"", "“"));
        //             }
        //
        //             vectorHelper.embeddingsUrl = EmbeddingsUrl;
        //             List<List<double>> vectorList =
        //                 await vectorHelper.StringToVectorAsync(EmbeddingsModel, qaChunkList, account);
        //             await ChunkSave(vectorList, qaChunkList, account, fileCode, vectorHelper);
        //         }
        //         catch (Exception e)
        //         {
        //             await _redisService.DeleteAsync($"{account}_wikiuploadlog");
        //             await _systemService.WriteLog(e.Message, Dtos.LogLevel.Error, account);
        //             throw;
        //         }
        //     }
        // }

        //文件切片
        private static readonly Regex SpecialTextRegex = new Regex(
            @"(!?\[.*?\]\(.*?\))|(<.*?>)|(https?://\S+)|(www\.\S+)",
            RegexOptions.Compiled | RegexOptions.IgnoreCase
        );

        public static List<string> SplitIntoBlocks(string text, int blockSize, int overlapSize)
        {
            if (blockSize <= overlapSize || text.Length <= blockSize)
            {
                return new List<string> { text };
            }

            // 提取特殊文本
            var specialTexts = SpecialTextRegex.Matches(text)
                .Cast<Match>()
                .Select(m => m.Value)
                .ToList();

            // 移除特殊文本，得到纯文本
            string pureText = SpecialTextRegex.Replace(text, "");

            // 分割纯文本
            List<string> blocks = SplitPureText(pureText, blockSize, overlapSize);

            // 将特殊文本添加到对应的块末尾
            for (int i = 0; i < blocks.Count; i++)
            {
                if (i < specialTexts.Count)
                {
                    blocks[i] += " " + specialTexts[i];
                }
                else if (i == blocks.Count - 1)
                {
                    // 如果是最后一个块，添加所有剩余的特殊文本
                    blocks[i] += " " + string.Join(" ", specialTexts.Skip(blocks.Count - 1));
                }
            }

            return blocks;
        }

        private static List<string> SplitPureText(string text, int blockSize, int overlapSize)
        {
            int totalBlocks = (int)Math.Ceiling((double)(text.Length - overlapSize) / (blockSize - overlapSize));

            return Enumerable.Range(0, totalBlocks)
                .Select(i =>
                {
                    int start = i * (blockSize - overlapSize);
                    int length = Math.Min(blockSize, text.Length - start);
                    return text.Substring(start, length);
                })
                .ToList();
        }

        // public bool DeleteVector(DelRoot delRoot)
        // {
        //     List<SystemCfg> systemCfgs = _systemService.GetSystemCfgs();
        //     var Alibaba_DashVectorApiKey =
        //         systemCfgs.FirstOrDefault(x => x.CfgKey == "Alibaba_DashVectorApiKey")?.CfgValue;
        //     var Alibaba_DashVectorEndpoint =
        //         systemCfgs.FirstOrDefault(x => x.CfgKey == "Alibaba_DashVectorEndpoint")?.CfgValue;
        //     var Alibaba_DashVectorCollectionName =
        //         systemCfgs.FirstOrDefault(x => x.CfgKey == "Alibaba_DashVectorCollectionName")?.CfgValue;
        //     var client =
        //         new RestClient(
        //             $"https://{Alibaba_DashVectorEndpoint}/v1/collections/{Alibaba_DashVectorCollectionName}/docs");
        //     var request = new RestRequest("", Method.Delete);
        //     request.AddHeader("dashvector-auth-token", Alibaba_DashVectorApiKey);
        //     request.AddHeader("Content-Type", "application/json");
        //     request.AddHeader("Accept", "*/*");
        //     var body = JsonConvert.SerializeObject(delRoot);
        //     request.AddParameter("application/json", body, ParameterType.RequestBody);
        //     RestResponse response = client.Execute(request);
        //     dynamic result = JsonConvert.DeserializeObject<dynamic>(response.Content);
        //     if (result.code == 0)
        //         return true;
        //     else
        //         return false;
        // }

        public Task<string> SearchSchedule(string key)
        {
            var result = _redisService.GetAsync(key);
            if (result != null)
                return result;
            else
                return null;
        }

        //切片保存
        // public async Task ChunkSave(List<List<double>> vectorList, List<string> chunkList, string account,
        //     string fileCode, VectorHelper vectorHelper)
        // {
        //     Root root = new Root();
        //     List<Doc> docs = new List<Doc>();
        //     for (int i = 0; i < vectorList.Count; i++)
        //     {
        //         if (vectorList[i] == null)
        //             continue;
        //         Dictionary<string, object> fields = new Dictionary<string, object>();
        //         fields.Add("knowledge", chunkList[i]);
        //         fields.Add("account", account);
        //         Doc doc = new Doc
        //         {
        //             id = Guid.NewGuid().ToString().Replace("-", ""),
        //             vector = vectorList[i],
        //             fields = fields
        //         };
        //         docs.Add(doc);
        //     }
        //
        //     root.docs = docs;
        //     bool innerVector = await vectorHelper.InnerVectorAsync(root, account);
        //     if (innerVector)
        //         await _redisService.SetAsync($"{account}_wikiuploadlog", "success");
        //     for (int i = 0; i < docs.Count; i++)
        //     {
        //         //保存切片
        //         var knowledgeList = _context.KnowledgeLists;
        //         knowledgeList.Add(new KnowledgeList
        //         {
        //             Account = account,
        //             FileCode = fileCode,
        //             VectorId = docs[i].id
        //         });
        //     }
        //
        //     await _redisService.DeleteAsync($"{account}_wikiuploadlog");
        //     _context.SaveChanges();
        // }

        //---------------------------------------------Milvus----------------------------------------------

        public async Task<List<MilvusDataDto>> CreateMilvusList(string account, string filePath, string embModel,
            string processType, string aiModel, string type, string fileCode, int fixedlength)
        {
            List<MilvusDataDto> milvusDataDtos = new List<MilvusDataDto>();
            List<SystemCfg> systemCfgs = _systemService.GetSystemCfgs();
            var EmbeddingsUrl = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsUrl")?.CfgValue;
            var EmbeddingsApiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsApiKey")?.CfgValue;
            string content = await _systemService.GetFileText(filePath);
            List<Dictionary<List<float>, string>> vectorList = new List<Dictionary<List<float>, string>>();
            List<string> chunkList = await CutFile(content, processType, account, aiModel, fileCode, fixedlength);
            vectorList = await StringToVectorByMilvusAsync(embModel, chunkList, account, EmbeddingsUrl,
                EmbeddingsApiKey, fileCode);
            foreach (var item in vectorList)
            {
                foreach (var kvp in item)
                {
                    MilvusDataDto milvusDataDto = new MilvusDataDto
                    {
                        Id = Guid.NewGuid().ToString("N"),
                        Vector = kvp.Key, // List<float> 类型
                        VectorContent = kvp.Value, // string 类型
                        Account = account,
                        Type = type
                    };
                    milvusDataDtos.Add(milvusDataDto);
                }
            }

            return milvusDataDtos;
        }

        public async Task<List<string>> CutFile(string content, string processType, string account, string aiModel,
            string fileCode, int fixedlength)
        {
            try
            {
                List<string> chunkList = new List<string>();
                if (processType == "Fixedlength") //定长切片
                {
                    content = content.Replace("\r", "").Replace("\n", "").Replace("\"", "“");
                    chunkList = SplitIntoBlocks(content, fixedlength, 200); //切片
                    chunkList.RemoveAll(s => string.IsNullOrWhiteSpace(s)); //去除空行
                }
                else if (processType == "FixedlengthByJina") //智能定长切片
                {
                    TokenizerDetail result = await _aiServer.TokenizeJinaAI(content, fixedlength);
                    chunkList = result.Chunks.Select(c => c.Replace("\r", "").Replace("\n", "").Replace("\"", "“"))
                        .ToList();
                }
                else if (processType == "QA") //QA清洗
                {
                    List<SystemCfg> systemCfgs = _systemService.GetSystemCfgs();
                    var EmbeddingsApiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsApiKey")?.CfgValue;
                    var QAurl = systemCfgs.FirstOrDefault(x => x.CfgKey == "QAurl")?.CfgValue;
                    content = content.Replace("\r", "").Replace("\n", "").Replace("\"", "“");
                    chunkList = SplitIntoBlocks(content, 2000, 200); //切片
                    chunkList.RemoveAll(s => string.IsNullOrWhiteSpace(s)); //去除空行
                    List<List<QA>> qaList =
                        await StringToQA(aiModel, chunkList, account, QAurl, EmbeddingsApiKey, fileCode);
                    //移除qaList中的null
                    qaList.RemoveAll(s => s == null);
                    //转切片
                    List<string> qaChunkList = new List<string>();
                    foreach (var item in qaList)
                    {
                        foreach (var q in item)
                        {
                            string qa = "【提问：" + q.question + " 回答：" + q.answer + "】";
                            qaChunkList.Add(qa.Replace("\r", "").Replace("\n", "").Replace("\"", "“"));
                        }
                    }

                    chunkList = qaChunkList;
                }
                else if (processType == "Newline") // 单换行符切片
                {
                    // 使用正则表达式匹配所有类型的单个换行符进行分割，并去除空白项。
                    var lines = Regex.Split(content, @"\r?\n")
                        .Select(line => line.Trim().Replace("\"", "“"))
                        .Where(line => !string.IsNullOrWhiteSpace(line));

                    chunkList.AddRange(lines);
                }
                else if (processType == "DoubleNewline") // 双换行符切片
                {
                    // 使用正则表达式匹配所有类型的双重换行符进行分割，并去除空白项。
                    var blocks = Regex.Split(content, @"\r?\n\r?\n")
                        .Select(block => block.Trim().Replace("\r", "").Replace("\n", "").Replace("\"", "“"))
                        .Where(block => !string.IsNullOrWhiteSpace(block));

                    chunkList.AddRange(blocks);
                }
                else // 正则表达式切片
                {
                    try
                    {
                        Regex regex = new Regex(processType, RegexOptions.Singleline);
                        MatchCollection matches = regex.Matches(content);

                        foreach (Match match in matches)
                        {
                            chunkList.Add(match.Value.Replace("\r", "").Replace("\n", "").Replace("\"", "“"));
                        }
                    }
                    catch (ArgumentException ex)
                    {
                        await _systemService.WriteLog($"正则表达式无效: {ex.Message}", Dtos.LogLevel.Error, "system");
                        throw new Exception($"正则表达式无效: {ex.Message}");
                    }
                }

                return chunkList;
            }
            catch (Exception e)
            {
                await _systemService.WriteLog($"文件切片时出现异常：{e.Message}", Dtos.LogLevel.Error, "system");
                throw new Exception($"文件切片时出现异常：{e.Message}");
            }
        }

        public async Task<List<Dictionary<List<float>, string>>> StringToVectorByMilvusAsync(string model,
            List<string> inputs, string Account, string embeddingsUrl, string embeddingsapikey, string fileCode)
        {
            var client = new RestClient(embeddingsUrl);
            int EmbRate = 5; //5个并发
            var semaphore = new SemaphoreSlim(EmbRate); //并发限制
            var tasks = new List<Task<Dictionary<List<float>, string>>>(); //保存所有任务

            int totalCount = inputs.Count;
            int completeCount = 0; // 已完成任务数

            foreach (var input in inputs)
            {
                await semaphore.WaitAsync(); //等待可用的并发插槽
                tasks.Add(Task.Run(async () =>
                {
                    int retryCount = 0;
                    const int maxRetryCount = 3; // 最大重试次数
                    while (retryCount < maxRetryCount)
                    {
                        try
                        {
                            var request = CreateRequest(model, input, embeddingsapikey);
                            var response = await client.ExecuteAsync(request);
                            if (response.IsSuccessful)
                            {
                                Interlocked.Increment(ref completeCount);
                                List<float> vector = ParseResponse(response);
                                Dictionary<List<float>, string> pairs = new Dictionary<List<float>, string>();
                                pairs.Add(vector, input);
                                return pairs;
                            }
                            else
                            {
                                retryCount++;
                            }
                        }
                        catch (Exception ex)
                        {
                            retryCount++;
                        }
                        finally
                        {
                            await _redisService.SetAsync($"knowledge_{fileCode}",
                                $"{((double)completeCount / totalCount * 100).ToString("F2")}");
                            semaphore.Release();
                        }
                    }

                    return null; // 重试达到上限后返回null
                }));
            }

            await Task.WhenAll(tasks); //等待所有任务完成
            await _redisService.DeleteAsync($"knowledge_{fileCode}");
            return tasks.Where(t => t.Result != null).Select(t => t.Result).ToList(); //转换结果并返回
        }

        private RestRequest CreateRequest(string model, string input, string embeddingsapikey)
        {
            var request = new RestRequest("", Method.Post);
            request.AddHeader("Authorization", $"Bearer {embeddingsapikey}");
            request.AddHeader("Content-Type", "application/json");
            request.AddHeader("Accept", "*/*");

            // 使用匿名对象
            var body = new
            {
                model = model,
                input = input
            };
            request.AddJsonBody(body);
            return request;
        }

        private static List<float> ParseResponse(RestResponse response)
        {
            if (response.IsSuccessful)
            {
                EmbeddingApiResponseByMilvus embeddingApiResponseByMilvus =
                    JsonConvert.DeserializeObject<EmbeddingApiResponseByMilvus>(response.Content);
                if (embeddingApiResponseByMilvus != null && embeddingApiResponseByMilvus.Data != null &&
                    embeddingApiResponseByMilvus.Data.Count > 0)
                {
                    return embeddingApiResponseByMilvus.Data[0].Embedding;
                }
            }

            return null;
        }

        private async Task<List<List<QA>>> StringToQA(string model, List<string> inputs, string Account,
            string embeddingsUrl, string embeddingsapikey, string fileCode)
        {
            var client = new RestClient(embeddingsUrl);
            int EmbRate = 1; //并发
            var semaphore = new SemaphoreSlim(EmbRate); //并发限制
            var tasks = new List<Task<List<QA>>>(); //保存所有任务

            int totalCount = inputs.Count;
            int completeCount = 0; // 已完成任务数

            foreach (var input in inputs)
            {
                await semaphore.WaitAsync(); //等待可用的并发插槽
                tasks.Add(Task.Run(async () =>
                {
                    int retryCount = 0;
                    const int maxRetryCount = 3; // 最大重试次数
                    while (retryCount < maxRetryCount)
                    {
                        try
                        {
                            var request = CreateQARequest(model, input, embeddingsapikey);
                            var response = await client.ExecuteAsync(request);
                            if (response.IsSuccessful)
                            {
                                Interlocked.Increment(ref completeCount);
                                return ParseQAResponse(response);
                            }
                            else
                            {
                                retryCount++;
                            }
                        }
                        catch (Exception ex)
                        {
                            retryCount++;
                        }
                        finally
                        {
                            semaphore.Release();
                            await _redisService.SetAsync($"knowledge_{fileCode}",
                                $"{((double)completeCount / totalCount * 100).ToString("F2")}"); // 在释放并发资源的时候更新完成的任务数
                        }
                    }

                    return null; // 重试达到上限后返回null
                }));
            }

            await Task.WhenAll(tasks); //等待所有任务完成
            await _redisService.DeleteAsync($"knowledge_{fileCode}");
            return tasks.Select(t => t.Result).ToList(); //转换结果并返回
        }

        private RestRequest CreateQARequest(string model, string input, string embeddingsapikey)
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

        public bool CreateKnowledgeType(string typeName, string typeCode, string account)
        {
            KnowledgeType knowledgeType = new KnowledgeType();
            knowledgeType.TypeCode = typeCode;
            knowledgeType.Account = account;
            knowledgeType.TypeName = typeName;
            knowledgeType.CreateTime = DateTime.Now;
            _context.KnowledgeTypes.Add(knowledgeType);
            return _context.SaveChanges() > 0;
        }

        public List<KnowledgeType> GetKnowledgeType(int page, int pageSize, string name, out int total,
            string account = "")
        {
            // 利用IQueryable延迟执行，直到真正需要数据的时候才去数据库查询
            IQueryable<KnowledgeType> query = _context.KnowledgeTypes;

            // 如果name不为空，则加上name的过滤条件
            if (!string.IsNullOrEmpty(name))
            {
                query = query.Where(x => x.TypeName.Contains(name));
            }

            if (!string.IsNullOrEmpty(account))
            {
                query = query.Where(x => x.Account == account);
            }

            // 首先计算总数，此时还未真正运行SQL查询
            total = query.Count();

            // 然后添加分页逻辑，此处同样是构建查询，没有执行
            var knowledgetypes = query.OrderByDescending(x => x.CreateTime) // 这里可以根据需要替换为合适的排序字段
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList(); // 直到调用ToList，查询才真正执行

            return knowledgetypes;
        }
    }
}