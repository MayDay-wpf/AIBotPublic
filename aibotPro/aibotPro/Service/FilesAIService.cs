using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using iTextSharp.text;
using Microsoft.AspNetCore.SignalR;
using Newtonsoft.Json.Linq;
using System.Runtime.CompilerServices;
using TiktokenSharp;


namespace aibotPro.Service;

public class FilesAIService : IFilesAIService
{
    private readonly AIBotProContext _context;
    private readonly ISystemService _systemService;
    private readonly IAiServer _aiServer;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly IFinanceService _financeService;

    public FilesAIService(ISystemService systemService, AIBotProContext context, IAiServer aiServer,
        IHubContext<ChatHub> hubContext, IFinanceService financeService)
    {
        _systemService = systemService;
        _context = context;
        _aiServer = aiServer;
        _hubContext = hubContext;
        _financeService = financeService;
    }

    public bool SaveFilesLib(FilesLib filesLib)
    {
        //保存文件库
        _context.FilesLibs.Add(filesLib);
        return _context.SaveChanges() > 0;
    }

    public List<FilesLib> GetFilesLibs(int page, int pageSize, string name, out int total, string account = "")
    {
        // 利用IQueryable延迟执行，直到真正需要数据的时候才去数据库查询
        IQueryable<FilesLib> query = _context.FilesLibs;

        // 如果name不为空，则加上name的过滤条件
        if (!string.IsNullOrEmpty(name)) query = query.Where(x => x.FileName.Contains(name));
        if (!string.IsNullOrEmpty(account)) query = query.Where(x => x.Account == account);

        // 首先计算总数，此时还未真正运行SQL查询
        total = query.Count();

        // 然后添加分页逻辑，此处同样是构建查询，没有执行
        var listFilesLibs = query.OrderBy(x => x.CreateTime) // 这里可以根据需要替换为合适的排序字段
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList(); // 直到调用ToList，查询才真正执行

        return listFilesLibs;
    }

    public bool DeleteFilesLibs(string fileCode, string account)
    {
        //删除文件库文件
        var filesLib = _context.FilesLibs.FirstOrDefault(x => x.FileCode == fileCode && x.Account == account);
        if (filesLib != null)
        {
            _context.FilesLibs.Remove(filesLib);
            //组合文件路径
            var filePath = $"wwwroot{filesLib.FilePath}";
            //根据文件路径删除文件
            if (_systemService.DeleteFile(filePath)) return _context.SaveChanges() > 0;
        }

        return false;
    }

    public async Task<string> PromptFromFiles(List<string> path, string account)
    {
        var prompt = string.Empty;
        //判断路径是否有wwwroot
        if (path.Count > 0)
        {
            for (var i = 0; i < path.Count; i++)
            {
                if (!path[i].Contains("wwwroot")) path[i] = $"wwwroot{path[i]}";
                var fileText = await _systemService.GetFileText(path[i]);
                if (!string.IsNullOrEmpty(fileText)) prompt += $"## 文件内容{i + 1}：{fileText} \n\n";
            }

            return prompt;
        }

        return "";
    }

    public async Task<List<string>> ReadingFiles(string content, string prompt, string chatId, string account,
        string senMethod,
        int cutSize = 2000, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        List<string> result = new List<string>();
        ChatRes chatRes = new ChatRes();
        chatRes.isterminal = true;
        var systemCfg = _systemService.GetSystemCfgs();
        var chunkLength = int.Parse(systemCfg.Find(x => x.CfgKey == "ReadingModelChunkLength").CfgValue);
        var readingModelMaxChunk = int.Parse(systemCfg.Find(x => x.CfgKey == "ReadingModelMaxChunk").CfgValue);
        var aiCodeCheckBaseUrl = systemCfg.FirstOrDefault(x => x.CfgKey == "AICodeCheckBaseUrl");
        var aiCodeCheckApiKey = systemCfg.FirstOrDefault(x => x.CfgKey == "AICodeCheckApiKey");
        var aiCodeCheckModel = systemCfg.FirstOrDefault(x => x.CfgKey == "AICodeCheckModel");
        var tikToken = TikToken.GetEncoding("cl100k_base");
        APISetting apiSetting = new APISetting
        {
            BaseUrl = aiCodeCheckBaseUrl.CfgValue,
            ApiKey = aiCodeCheckApiKey.CfgValue
        };
        List<string> fileChunks = new List<string>();
        if (content.Length <= chunkLength)
        {
            fileChunks.Add(content);
        }
        else
        {
            for (int i = 0; i < content.Length; i += chunkLength)
            {
                // 如果剩余的长度小于 chunkLength 就取剩余的部分
                var chunk = content.Substring(i, Math.Min(chunkLength, content.Length - i));
                fileChunks.Add(chunk);
            }
        }

        chatRes.message = "🟦 准备切片阅读...";
        await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
        foreach (var fileStr in fileChunks)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var segment = await _aiServer.TokenizeJinaAI(fileStr, cutSize);
            chatRes.message = $"🟩 切片完成,总切片数：{segment.Chunks.Count}";
            if (segment.Chunks.Count > readingModelMaxChunk)
            {
                segment.Chunks = MergeChunks(segment.Chunks, readingModelMaxChunk);
                chatRes.message += $"🟨 切片数量超过限制，已自动合并为 {segment.Chunks.Count} 个切片";
            }
            await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
            for (int i = 0; i < segment.Chunks.Count; i++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                //使用AI判断当前分片是否对用户提问有用
                string jsonschema = @"{
                                          ""type"": ""object"",
                                          ""properties"": {
                                            ""result"": {
                                              ""type"": ""boolean"",
                                              ""description"": ""判断结果，文件片段对提问是否有效""
                                            },
                                            ""isfinish"": {
                                              ""type"": ""boolean"",
                                              ""description"": ""阅读结束""
                                            }
                                          },
                                          ""required"": [
                                            ""result"",
                                            ""isfinish""
                                          ],
                                          ""additionalProperties"": false
                                    }";
                string question = $"# 你是一个文件分析专家，可以根据文件片段以判断该分片对用户的提问是否有效，如果有效`result`返回`true`无效返回`false`，应该使用冗余设计，可能有效的也应该返回`true`\n" +
                                  $"**注意事项1:** 当用户有文件总结的需求时，大部分片段都应该是有效的\n" +
                                  $"**注意事项2:** 如果是信息查询的场景，当你找到后，请将`isfinish`设置为`true`，以结束阅读，否则设置为`false`，切记不要轻易结束阅读，应该多阅读一些内容以获得详细信息\n" +
                                  $"**注意事项3:** 由于分片可能导致信息被截断，所以阅读时请结合已确认**有效**的文本分片来确定当前分片是否与用户提问相关，当前分片有可能可以与当前有效的分片拼接使用\n" +
                                  $"* 用户提问:{prompt}\n" +
                                  $"* 当前待分析的文本片段:\n" +
                                  $"```text\n" +
                                  $"{segment.Chunks[i]}\n" +
                                  $"```" +
                                  $"* 已确认有效的文本分片\n" +
                                  $"{UseChunkMerge(result)}";
                AiChat aiChat = _aiServer.CreateAiChat(aiCodeCheckModel.CfgValue, question, false, false, true, jsonschema);
                string res = await _aiServer.CallingAINotStream(aiChat, apiSetting);
                await _financeService.CreateUseLogAndUpadteMoney(account, aiCodeCheckModel.CfgValue,
                    tikToken.Encode(question).Count, tikToken.Encode(res).Count);
                cancellationToken.ThrowIfCancellationRequested();
                JObject json = JObject.Parse(res);
                bool judgmentResult = json["result"].Value<bool>();
                bool judgmentIsFinish = json["isfinish"].Value<bool>();
                if (judgmentResult)
                {
                    result.Add(segment.Chunks[i]);
                    chatRes.message = $"✅ 第{i + 1}片：内容有效:\n {segment.Chunks[i]}";
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                }
                else
                {
                    chatRes.message = $"❌ 第{i + 1}片：内容无效";
                    await _hubContext.Clients.Group(chatId).SendAsync(senMethod, chatRes);
                }
                if (judgmentIsFinish)
                {
                    break;
                }
            }
        }

        return result;
    }
    private List<string> MergeChunks(List<string> originalChunks, int maxChunkCount)
    {
        if (originalChunks.Count <= maxChunkCount)
        {
            return originalChunks;
        }

        List<string> mergedChunks = new List<string>();
        int chunkSize = (int)Math.Ceiling((double)originalChunks.Count / maxChunkCount);

        for (int i = 0; i < originalChunks.Count; i += chunkSize)
        {
            string mergedChunk = string.Join(" ", originalChunks.Skip(i).Take(chunkSize));
            mergedChunks.Add(mergedChunk);
        }

        return mergedChunks;
    }
    private string UseChunkMerge(List<string> chunks)
    {
        string result = string.Empty;
        for (int i = 0; i < chunks.Count; i++)
        {
            result += $"* 分片{i + 1}:\n" +
                      $"```text\n" +
                      $"{chunks[i]}\n" +
                      $"```\n";
        }
        return result;
    }
}