using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.ChatService;
using Microsoft.AspNetCore.SignalR;
using Newtonsoft.Json;
using TiktokenSharp;
using System.Net.Http;
using System.Text;
using Betalgo.Ranul.OpenAI;
using Betalgo.Ranul.OpenAI.Managers;
using Betalgo.Ranul.OpenAI.ObjectModels.RequestModels;
using Microsoft.EntityFrameworkCore;

namespace aibotPro.Service;

public class DeepResearchService : IDeepResearchService
{
    private readonly AIBotProContext _context;
    private readonly IRedisService _redisService;
    private readonly IAiServer _aiServer;
    private readonly ISystemService _systemService;
    private readonly IFinanceService _financeService;
    private readonly IHubContext<DeepResearchHub> _hubContext;
    private List<SystemCfg> systemCfgs;
    private string leaderModel;
    private TikToken _tikToken;
    private readonly ChatCancellationManager _chatCancellationManager;
    private readonly IUsersService _usersService;

    // 重试配置常量
    private const int MAX_RETRY_COUNT = 3;
    private const int BASE_DELAY_MS = 1000;

    public DeepResearchService(AIBotProContext context, IRedisService redisService, IAiServer aiServer,
        ISystemService systemService, IFinanceService financeService, IHubContext<DeepResearchHub> hubContext, ChatCancellationManager chatCancellationManager, IUsersService usersService)
    {
        _context = context;
        _redisService = redisService;
        _aiServer = aiServer;
        _systemService = systemService;
        _financeService = financeService;
        _hubContext = hubContext;
        systemCfgs = _systemService.GetSystemCfgs();
        leaderModel = systemCfgs.FirstOrDefault(x => x.CfgKey == "DeepResearch_Leader_Model")?.CfgValue;
        _tikToken = TikToken.GetEncoding("o200k_base");
        _chatCancellationManager = chatCancellationManager;
        _usersService = usersService;
    }

    /// <summary>
    /// 通用重试方法，支持指数退避策略
    /// </summary>
    /// <typeparam name="T">返回类型</typeparam>
    /// <param name="operation">要执行的操作</param>
    /// <param name="operationName">操作名称，用于日志记录</param>
    /// <param name="maxRetries">最大重试次数</param>
    /// <param name="baseDelayMs">基础延迟时间（毫秒）</param>
    /// <returns>操作结果</returns>
    private async Task<T> ExecuteWithRetryAsync<T>(
        Func<Task<T>> operation,
        string operationName,
        int maxRetries = MAX_RETRY_COUNT,
        int baseDelayMs = BASE_DELAY_MS)
    {
        Exception lastException = null;

        for (int attempt = 0; attempt <= maxRetries; attempt++)
        {
            try
            {
                var result = await operation();

                // 如果不是第一次尝试且成功了，记录恢复日志
                if (attempt > 0)
                {
                    await _systemService.WriteLog($"{operationName} 在第 {attempt + 1} 次尝试后成功",
                        Dtos.LogLevel.Info, "DeepResearch");
                }

                return result;
            }
            catch (Exception ex)
            {
                lastException = ex;

                // 如果是最后一次尝试，不再重试
                if (attempt == maxRetries)
                {
                    await _systemService.WriteLog($"{operationName} 在 {maxRetries + 1} 次尝试后最终失败: {ex.Message}",
                        Dtos.LogLevel.Error, "DeepResearch");
                    break;
                }

                // 计算延迟时间（指数退避）
                var delay = baseDelayMs * (int)Math.Pow(2, attempt);

                await _systemService.WriteLog($"{operationName} 第 {attempt + 1} 次尝试失败: {ex.Message}，{delay}ms 后重试",
                    Dtos.LogLevel.Warn, "DeepResearch");

                // 等待后重试
                await Task.Delay(delay);
            }
        }

        // 如果所有重试都失败了，抛出最后一个异常
        throw lastException ?? new Exception($"{operationName} 执行失败");
    }

    /// <summary>
    /// 通用HTTP重试方法，专门处理网络请求
    /// </summary>
    private async Task<string> ExecuteHttpWithRetryAsync(
        Func<Task<string>> httpOperation,
        string operationName,
        int maxRetries = MAX_RETRY_COUNT)
    {
        return await ExecuteWithRetryAsync(async () =>
        {
            var result = await httpOperation();

            // 检查结果是否有效
            if (string.IsNullOrEmpty(result))
            {
                throw new InvalidOperationException($"{operationName} 返回空结果");
            }

            return result;
        }, operationName, maxRetries);
    }

    /// <summary>
    /// 验证系统配置完整性
    /// </summary>
    /// <param name="requiredConfigs">必需的配置键列表</param>
    /// <returns>配置验证结果</returns>
    private async Task<(bool isValid, string errorMessage)> ValidateSystemConfigAsync(params string[] requiredConfigs)
    {
        try
        {
            var missingConfigs = new List<string>();

            foreach (var configKey in requiredConfigs)
            {
                var config = systemCfgs.FirstOrDefault(x => x.CfgKey == configKey);
                if (config == null || string.IsNullOrEmpty(config.CfgValue))
                {
                    missingConfigs.Add(configKey);
                }
            }

            if (missingConfigs.Any())
            {
                var errorMsg = $"系统配置不完整，缺少以下配置: {string.Join(", ", missingConfigs)}";
                await _systemService.WriteLog(errorMsg, Dtos.LogLevel.Error, "DeepResearch");
                return (false, errorMsg);
            }

            return (true, string.Empty);
        }
        catch (Exception ex)
        {
            var errorMsg = $"验证系统配置时发生异常: {ex.Message}";
            await _systemService.WriteLog(errorMsg, Dtos.LogLevel.Error, "DeepResearch");
            return (false, errorMsg);
        }
    }

    /// <summary>
    /// 验证AI模型配置完整性
    /// </summary>
    /// <param name="modelName">模型名称</param>
    /// <returns>模型配置验证结果</returns>
    private async Task<(bool isValid, string errorMessage, DeepResearchModel model)> ValidateModelConfigAsync(string modelName)
    {
        try
        {
            if (string.IsNullOrEmpty(modelName))
            {
                return (false, "模型名称不能为空", null);
            }

            var model = _context.DeepResearchModels.FirstOrDefault(x => x.ModelName == modelName);

            if (model == null)
            {
                var errorMsg = $"未找到模型配置: {modelName}";
                await _systemService.WriteLog(errorMsg, Dtos.LogLevel.Error, "DeepResearch");
                return (false, errorMsg, null);
            }

            if (string.IsNullOrEmpty(model.ApiKey) || string.IsNullOrEmpty(model.BaseUrl))
            {
                var errorMsg = $"模型 {modelName} 配置不完整：缺少ApiKey或BaseUrl";
                await _systemService.WriteLog(errorMsg, Dtos.LogLevel.Error, "DeepResearch");
                return (false, errorMsg, null);
            }

            return (true, string.Empty, model);
        }
        catch (Exception ex)
        {
            var errorMsg = $"验证模型配置时发生异常: {ex.Message}";
            await _systemService.WriteLog(errorMsg, Dtos.LogLevel.Error, "DeepResearch");
            return (false, errorMsg, null);
        }
    }

    public async Task<bool> SaveAIActiveAsync(string chatId, string account, string icon, string title,
        string activeContent,
        string status)
    {
        var active = new DeepResearchActiveList
        {
            ChatId = chatId,
            Account = account,
            Icon = icon,
            Title = title,
            ActiveContent = activeContent,
            ActiveStatus = status,
            CreateTime = DateTime.Now
        };
        _context.DeepResearchActiveLists.Add(active);
        var result = await _context.SaveChangesAsync() > 0;
        return result;
    }

    //创建深度研究任务
    public async Task<bool> CreateDeepResearchAsync(string chatId, string account, string title,
        List<string> selectedQuestions)
    {
        var deepResearch = new DeepResearchList
        {
            ChatId = chatId,
            Account = account,
            DeepTitle = title,
            DeepDesc = JsonConvert.SerializeObject(selectedQuestions),
            DeepContent = string.Empty,
            Process = "5",
            CreateTime = DateTime.Now
        };
        _context.DeepResearchLists.Add(deepResearch);
        var result = await _context.SaveChangesAsync() > 0;
        // 任务加载到redis
        await UpdateProcess(chatId, 5, title);
        return result;
    }

    //创建深度研究任务大纲
    public async Task<DeepOutline> CreateDeepResearchOutlineAsync(string chatId, string account, string title,
        List<string> selectedQuestions)
    {
        return await ExecuteWithRetryAsync(async () =>
        {
            var deepOutline = new DeepOutline();
            string prompt = @$"# You are preparing to generate a research report outline for the user\n

                                * The research report title provided by the user is «{title}».\n

                                * The research direction chosen by the user is:\n

                                {string.Join("\n", selectedQuestions)}

                                * You need to generate a practical and comprehensive research report outline based on the information provided by the user.\n

                                * The outline should be well-organized with clear logical structure, including introduction, main content sections, and conclusion.\n

                                * Focus on substantive content sections that can be effectively researched and written by AI.\n

                                * DO NOT include sections like 'References', 'Bibliography', 'Appendices', or 'Attachments' as these are difficult for AI to generate accurately.\n

                                * Each main section should have 2-4 relevant subsections that directly support the research topic.\n

                                * **CRITICAL: Emphasize data-driven research approach**:\n
                                  - For topics involving market analysis, industry trends, financial data, statistics, or quantitative research, prioritize sections that require current data and factual information\n
                                  - Include sections for data analysis, trend analysis, comparative studies, and quantitative insights where applicable\n
                                  - Structure the outline to support evidence-based conclusions with verifiable data points\n
                                  - For data-intensive topics, ensure multiple sections focus on different data perspectives (historical trends, current status, future projections, comparative analysis)\n

                                * The language of the outline follows the user's report title language.\n

                                * Ensure the outline is actionable and each section can be filled with meaningful research content backed by data and evidence.
                                ";
            string schema = @"{
                              ""type"": ""object"",
                              ""properties"": {
                                ""outline"": {
                                  ""type"": ""array"",
                                  ""description"": ""List of outline body"",
                                  ""items"": {
                                    ""type"": ""object"",
                                    ""properties"": {
                                      ""mainTitle"": {
                                        ""type"": ""string"",
                                        ""description"": ""Main title""
                                      },
                                      ""subTitle"": {
                                        ""type"": ""array"",
                                        ""description"": ""List of sub title"",
                                        ""items"": {
                                          ""type"": ""string""
                                        }
                                      }
                                    },
                                    ""additionalProperties"": false,
                                    ""required"": [
                                      ""mainTitle"",
                                      ""subTitle""
                                    ]
                                  }
                                }
                              },
                              ""required"": [
                                ""outline""
                              ],
                              ""additionalProperties"": false
                            }";

            var result = await _aiServer.GPTJsonSchema(prompt, schema, leaderModel, account);

            if (string.IsNullOrEmpty(result))
            {
                throw new InvalidOperationException("AI服务返回空结果");
            }

            try
            {
                deepOutline = JsonConvert.DeserializeObject<DeepOutline>(result);

                // 验证反序列化结果
                if (deepOutline?.Outline == null || !deepOutline.Outline.Any())
                {
                    throw new InvalidOperationException("生成的大纲格式无效或为空");
                }

                await _financeService.CreateUseLogAndUpadteMoney(account, leaderModel,
                    _tikToken.Encode(prompt + schema).Count, _tikToken.Encode(result).Count);
            }
            catch (JsonException ex)
            {
                throw new InvalidOperationException($"解析AI返回结果失败: {ex.Message}");
            }

            //更新任务进度
            await UpdateProcess(chatId, 10, title);
            return deepOutline;

        }, $"创建研究大纲 - {title}");
    }

    //获取深度研究报告详情
    public async Task<DeepResearchList> GetDeepResearch(string chatId, string account)
    {
        var deepResearch = _context.DeepResearchLists.Where(x => x.ChatId == chatId && x.Account == account).FirstOrDefault();
        if (deepResearch == null)
        {
            return null;
        }
        return deepResearch;
    }

    public async Task UpdateProcess(string chatId, int process, string title)
    {
        // 更新数据库中的进度
        var deepResearch = _context.DeepResearchLists.FirstOrDefault(x => x.ChatId == chatId);
        if (deepResearch != null)
        {
            deepResearch.Process = process.ToString();
            await _context.SaveChangesAsync();
        }

        // 保存到Redis缓存
        var redisKey = $"deepresearch_{chatId}";
        var redisValue = new
        {
            chatId = chatId,
            title = title,
            process = process
        };
        await _redisService.SetAsync(redisKey, JsonConvert.SerializeObject(redisValue), TimeSpan.FromMinutes(30));

        // 发送SignalR进度更新消息
        try
        {
            var progressData = new
            {
                chatId = chatId,
                title = title,
                process = process.ToString()
            };
            await _hubContext.Clients.Group(chatId).SendAsync("ResearchProgressUpdate", progressData);
        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"发送进度更新失败: {ex.Message}", Dtos.LogLevel.Error, "DeepResearch");
        }
    }

    public async Task<OutLineShouldSearch> JudgeShouldSearchAsync(string chatId, string account, string title,
        string outlineMD)
    {
        return await ExecuteWithRetryAsync(async () =>
        {
            string prompt = @$"# You are a professional research assistant. Please determine whether online search is needed to gather relevant information based on `the report title the user is preparing to generate`. Respond in the language of the user's title.\n\n
        
                               ## Crucial Policy: No assumptions are permitted regarding the data; all data must be rigorously verifiable and traceable.\n\n

                                * The outline is as follows:\n\n

                                {outlineMD}\n\n

                                * If online search is needed to gather relevant information, please return True, and provide multiple keywords to improve accuracy.\n\n

                                * If online search is not needed, please return False.\n\n

                            # The report title the user is preparing to generate: {title}\n\n

                            # Situations where online search is not needed\n\n

                                * For the introduction, overview, and conclusion, online search is not required.\n\n

                                * For some common knowledge content, online search is not necessary.\n\n

                            # Special note: Your search keywords should only target the report title the user is preparing to generate. Do not search for other content in the outline.\n\n

                            # For some highly specialized content or data that requires accuracy, online search is necessary.\n\n

                                *Current time: {DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")}*\n";
            string schema = @"{
                              ""type"": ""object"",
                              ""properties"": {
                                ""shouldSearch"": {
                                  ""type"": ""boolean"",
                                  ""description"": ""Whether to search online"",
                                },
                                ""searchKeywords"": {
                                  ""type"": ""array"",
                                  ""description"": ""List of search keywords"",
                                  ""items"": {
                                    ""type"": ""string""
                                  }
                                }
                              },
                              ""required"": [
                                ""shouldSearch"",
                                ""searchKeywords""
                              ],
                              ""additionalProperties"": false
                            }";

            var result = await _aiServer.GPTJsonSchema(prompt, schema, leaderModel, account);

            if (string.IsNullOrEmpty(result))
            {
                throw new InvalidOperationException("AI服务返回空结果");
            }

            try
            {
                var outLineShouldSearch = JsonConvert.DeserializeObject<OutLineShouldSearch>(result);

                // 验证反序列化结果
                if (outLineShouldSearch == null)
                {
                    throw new InvalidOperationException("联网判断结果格式无效");
                }

                // 记录费用
                await _financeService.CreateUseLogAndUpadteMoney(account, leaderModel,
                    _tikToken.Encode(prompt + schema).Count, _tikToken.Encode(result).Count);

                return outLineShouldSearch;
            }
            catch (JsonException ex)
            {
                throw new InvalidOperationException($"解析联网判断结果失败: {ex.Message}");
            }

        }, $"联网判断 - {title}");
    }

    public async Task<string> GetJinaSearchResultAsync(List<string> keywords)
    {
        return await ExecuteWithRetryAsync(async () =>
        {
            string baseUrl = systemCfgs.FirstOrDefault(x => x.CfgKey == "Serp_BaseUrl_Jina")?.CfgValue;
            string apiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "Serp_ApiKey_Jina")?.CfgValue;

            if (string.IsNullOrEmpty(baseUrl) || string.IsNullOrEmpty(apiKey))
            {
                throw new InvalidOperationException("Jina搜索配置不完整：缺少BaseUrl或ApiKey");
            }

            if (keywords == null || !keywords.Any())
            {
                throw new ArgumentException("搜索关键词不能为空");
            }

            using var httpClient = new HttpClient();
            httpClient.Timeout = TimeSpan.FromSeconds(30); // 设置超时时间
            httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
            httpClient.DefaultRequestHeaders.Add("X-Engine", "cf-browser-rendering");
            httpClient.DefaultRequestHeaders.Add("X-With-Generated-Alt", "true");

            // 并发搜索所有关键词，每个关键词都有重试机制
            var searchTasks = keywords.Select(async keyword =>
            {
                return await ExecuteWithRetryAsync(async () =>
                {
                    var requestBody = new
                    {
                        q = keyword
                    };

                    var json = JsonConvert.SerializeObject(requestBody);
                    var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

                    var response = await httpClient.PostAsync(baseUrl, content);

                    if (response.IsSuccessStatusCode)
                    {
                        var result = await response.Content.ReadAsStringAsync();

                        if (string.IsNullOrEmpty(result))
                        {
                            throw new InvalidOperationException($"关键词 '{keyword}' 搜索返回空结果");
                        }

                        return $"## 搜索关键词: {keyword}\n\n{result}\n\n";
                    }
                    else
                    {
                        throw new HttpRequestException($"Jina搜索失败，关键词: {keyword}, 状态码: {response.StatusCode}, 响应: {await response.Content.ReadAsStringAsync()}");
                    }

                }, $"Jina搜索关键词: {keyword}", maxRetries: 2); // 单个关键词重试2次
            });

            // 等待所有搜索任务完成
            var searchResults = await Task.WhenAll(searchTasks);

            // 验证搜索结果
            var validResults = searchResults.Where(r => !string.IsNullOrEmpty(r)).ToList();

            if (!validResults.Any())
            {
                throw new InvalidOperationException("所有关键词搜索都失败了");
            }

            // 拼接所有搜索结果
            var finalResult = string.Join("", validResults);

            return finalResult;

        }, $"Jina搜索 - {string.Join(", ", keywords.Take(3))}{(keywords.Count > 3 ? "..." : "")}");
    }

    public async Task<string> DeepResearchReportContentGenerateAsync(string chatId, string account, string title, string systemPrompt, string model, string webSearchResult = "")
    {
        return await ExecuteWithRetryAsync(async () =>
        {
            string result = string.Empty;

            // 从缓存中获取已生成的报告内容作为上下文
            string previousContent = "";
            try
            {
                var cacheKey = $"deepresearch_report_{chatId}";
                var cachedContent = await _redisService.GetAsync(cacheKey);
                if (!string.IsNullOrEmpty(cachedContent))
                {
                    // 提取最后2000个字符作为前文上下文，帮助AI理解报告结构和风格
                    var contentTokens = _tikToken.Encode(cachedContent);
                    if (contentTokens.Count > 2000)
                    {
                        var contextTokens = contentTokens.Skip(Math.Max(0, contentTokens.Count - 2000)).ToList();
                        previousContent = _tikToken.Decode(contextTokens);
                    }
                    else
                    {
                        previousContent = cachedContent;
                    }
                }
            }
            catch (Exception ex)
            {
                await _systemService.WriteLog($"获取前文上下文失败: {ex.Message}", Dtos.LogLevel.Warn, "DeepResearch");
            }

            var userPrompt = $@"# Generate professional report content for the subsection: 《{title}》 \n\n
## Crucial Policy: No assumptions are permitted regarding the data; all data must be rigorously verifiable and traceable. \n\n
## Important Requirements: \n\n
1. **Generate content ONLY for the current subsection**, do not involve other titles from the outline \n\n
2. **NEVER create H1(#), H2(##), or H3(###) level headings** \n\n
3. **You may use H4(####), H5(#####), H6(######) and lower level headings to organize content structure** \n\n
4. **Do not repeat the current subsection title at the beginning** \n\n
5. **Content should be professional, detailed, and logical** \n\n
6. **Maintain consistency with the overall report style** \n\n
7. **Use the same language as the title language** \n\n
8. **STRICTLY FORBIDDEN: Do not use footnotes or any numeric citation system like [1], [2], [任意文字] or similar invalid markdown link syntax** \n\n
9. **All references must be inline markdown hyperlinks in the form [display text](URL) with valid URLs only** \n\n
10. **Current time: {DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")}** \n\n

## Current Subsection: {title}";

            // 如果有前文上下文，添加到提示词中
            if (!string.IsNullOrEmpty(previousContent))
            {
                userPrompt += $@"

## Previous Report Context (for understanding report structure and style consistency):
```
{previousContent}
```";
            }

            if (!string.IsNullOrEmpty(webSearchResult))
            {
                // 限制webSearchResult的token数量不超过100K，为前文上下文和提示词留出空间
                var webSearchTokens = _tikToken.Encode(webSearchResult);
                if (webSearchTokens.Count > 100000)
                {
                    // 截取前100K个token对应的文本
                    var truncatedTokens = webSearchTokens.Take(100000).ToList();
                    webSearchResult = _tikToken.Decode(truncatedTokens);
                }

                userPrompt += $@"

## Related Online Search Information (for reference,Feel free to include relevant image links within the body of the text, if available.):
{webSearchResult}";
            }

            userPrompt += @"

## Content Generation Guidelines: \n\n
- Start writing content directly, do not repeat the title \n\n
- Use ####, #####, ######, *, -, level headings to organize paragraph structure \n\n
- Content should be in-depth and professional \n\n
- Maintain clear logic and well-structured paragraphs \n\n
- Ensure accuracy of data and citations if any";

            var aiModel = _context.DeepResearchModels.Where(x => x.ModelName == model).FirstOrDefault();

            if (aiModel == null)
            {
                throw new InvalidOperationException($"未找到模型配置: {model}");
            }

            if (string.IsNullOrEmpty(aiModel.ApiKey) || string.IsNullOrEmpty(aiModel.BaseUrl))
            {
                throw new InvalidOperationException($"模型 {model} 配置不完整：缺少ApiKey或BaseUrl");
            }

            var OpenAIOptions = new OpenAIOptions
            {
                ApiKey = aiModel.ApiKey,
                BaseDomain = aiModel.BaseUrl
            };
            var openAiService = new OpenAIService(OpenAIOptions);
            List<ChatMessage> chatMessages = new List<ChatMessage>();
            chatMessages.Add(ChatMessage.FromSystem(systemPrompt));
            chatMessages.Add(ChatMessage.FromUser(userPrompt));
            var chatCompletionCreate = new ChatCompletionCreateRequest();
            chatCompletionCreate.Messages = chatMessages;
            chatCompletionCreate.Model = model;
            chatCompletionCreate.Stream = true;
            chatCompletionCreate.StreamOptions = new StreamOptions
            {
                IncludeUsage = true
            };
            var (semaphore, cancellationToken) = _chatCancellationManager.GetOrCreateToken(chatId);

            try
            {
                var completionResult = openAiService.ChatCompletion.CreateCompletionAsStream(chatCompletionCreate,
                    chatCompletionCreate.Model, true, cancellationToken);

                await foreach (var responseContent in completionResult.WithCancellation(cancellationToken))
                {
                    if (responseContent.Successful)
                    {
                        var choice = responseContent.Choices.FirstOrDefault();
                        if (choice != null && choice.Message != null && !string.IsNullOrEmpty(choice.Message.Content))
                        {
                            result += choice.Message.Content;
                        }
                    }
                    else if (!string.IsNullOrEmpty(responseContent.Error?.Message))
                    {
                        throw new InvalidOperationException($"AI服务返回错误: {responseContent.Error.Message}");
                    }
                }

                // 验证生成的内容
                if (string.IsNullOrEmpty(result.Trim()))
                {
                    throw new InvalidOperationException("AI生成的内容为空");
                }

                // 记录费用
                await _financeService.CreateUseLogAndUpadteMoney(account, model,
                    _tikToken.Encode(systemPrompt + userPrompt).Count, _tikToken.Encode(result).Count);

                return result;
            }
            catch (OperationCanceledException)
            {
                throw new InvalidOperationException("内容生成被取消");
            }
            catch (Exception ex) when (!(ex is InvalidOperationException))
            {
                throw new InvalidOperationException($"内容生成失败: {ex.Message}");
            }

        }, $"生成报告内容 - {title}", maxRetries: 2); // 内容生成重试次数设为2次，避免过多重试
    }

    public async Task<bool> UpdateDeepResearchAsync(string chatId, string account, string content)
    {
        var deepResearch = _context.DeepResearchLists.FirstOrDefault(x => x.ChatId == chatId && x.Account == account);
        if (deepResearch != null)
        {
            deepResearch.DeepContent = content;
            deepResearch.Process = "100";
            await _context.SaveChangesAsync();
            await UpdateProcess(chatId, 100, deepResearch.DeepTitle);
            return true;
        }
        return false;
    }

    //获取深度研究项目的活动历史
    public async Task<List<DeepResearchActiveList>> GetDeepResearchActivitiesAsync(string chatId, string account)
    {
        var activities = await Task.FromResult(_context.DeepResearchActiveLists
            .Where(x => x.ChatId == chatId && x.Account == account)
            .OrderBy(x => x.CreateTime)
            .ToList());

        // 对活动进行合并处理
        var mergedActivities = MergeActivities(activities);

        return mergedActivities;
    }

    //合并活动数据 - 将相同标题的loading和success状态合并
    private List<DeepResearchActiveList> MergeActivities(List<DeepResearchActiveList> activities)
    {
        var result = new List<DeepResearchActiveList>();
        var activityGroups = activities.GroupBy(x => x.Title).ToList();

        foreach (var group in activityGroups)
        {
            var groupActivities = group.OrderBy(x => x.CreateTime).ToList();

            // 查找是否有success状态的活动
            var successActivity = groupActivities.FirstOrDefault(x => x.ActiveStatus == "success");

            if (successActivity != null)
            {
                // 如果有success状态，查找对应的loading状态来获取icon
                var loadingActivity = groupActivities.FirstOrDefault(x => x.ActiveStatus == "loading");

                // 创建合并后的活动
                var mergedActivity = new DeepResearchActiveList
                {
                    Id = successActivity.Id,
                    ChatId = successActivity.ChatId,
                    Account = successActivity.Account,
                    Title = successActivity.Title,
                    ActiveContent = successActivity.ActiveContent,
                    ActiveStatus = successActivity.ActiveStatus,
                    CreateTime = successActivity.CreateTime,
                    // 优先使用loading状态的icon，如果没有则使用success状态的icon
                    Icon = !string.IsNullOrEmpty(loadingActivity?.Icon) ? loadingActivity.Icon : successActivity.Icon
                };

                result.Add(mergedActivity);
            }
            else
            {
                // 如果没有success状态，保留最新的活动（通常是loading或error状态）
                var latestActivity = groupActivities.LastOrDefault();
                if (latestActivity != null)
                {
                    result.Add(latestActivity);
                }
            }
        }

        // 按创建时间排序返回
        return result.OrderBy(x => x.CreateTime).ToList();
    }

    //获取深度研究列表（分页查询）
    public async Task<(List<DeepResearchList> items, int totalCount)> GetDeepResearchListAsync(string account, int page = 1, int pageSize = 10, string searchKeyword = "")
    {
        var query = _context.DeepResearchLists.Where(x => x.Account == account);

        // 如果有搜索关键词，进行模糊搜索
        if (!string.IsNullOrEmpty(searchKeyword))
        {
            query = query.Where(x => x.DeepTitle.Contains(searchKeyword) || x.DeepDesc.Contains(searchKeyword));
        }

        // 获取总数
        var totalCount = await Task.FromResult(query.Count());

        // 分页查询，按创建时间倒序排列，跳过DeepContent大字段以提高查询性能
        var items = await Task.FromResult(query
            .OrderByDescending(x => x.CreateTime)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new DeepResearchList
            {
                Id = x.Id,
                ChatId = x.ChatId,
                Account = x.Account,
                DeepTitle = x.DeepTitle,
                DeepDesc = x.DeepDesc,
                // 跳过DeepContent字段，设为空字符串
                DeepContent = string.Empty,
                Process = x.Process,
                UseTime = x.UseTime,
                CreateTime = x.CreateTime
            })
            .ToList());

        return (items, totalCount);
    }

    //获取研究报告内容（优先从缓存获取，如果缓存中没有则从数据库获取）
    public async Task<string> GetResearchReportContentAsync(string chatId, string account)
    {
        try
        {
            // 首先尝试从Redis缓存获取进行中的研究报告内容
            var cacheKey = $"deepresearch_report_{chatId}";
            var cachedContent = await _redisService.GetAsync(cacheKey);

            if (!string.IsNullOrEmpty(cachedContent))
            {
                return cachedContent;
            }

            // 如果缓存中没有，从数据库获取已完成的研究报告
            var deepResearch = await Task.FromResult(_context.DeepResearchLists
                .Where(x => x.ChatId == chatId && x.Account == account)
                .FirstOrDefault());

            if (deepResearch != null)
            {
                var content = deepResearch.DeepContent;

                // 如果数据库中有内容，返回内容
                if (!string.IsNullOrEmpty(content))
                {
                    return content;
                }

                // 如果数据库中没有内容但研究项目存在，返回基础模板
                var basicContent = $"# {deepResearch.DeepTitle}\n\n正在生成研究报告，请稍候...\n\n";
                return basicContent;
            }

            // 如果研究项目不存在，返回空内容
            return string.Empty;
        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"获取研究报告内容异常: {chatId}, 错误: {ex.Message}", Dtos.LogLevel.Error, "DeepResearch");
            return string.Empty;
        }
    }

    //保存研究报告内容
    public async Task<bool> SaveResearchReportContentAsync(string chatId, string account, string title, string content)
    {
        try
        {
            // 验证输入参数
            if (string.IsNullOrEmpty(chatId) || string.IsNullOrEmpty(account) || string.IsNullOrEmpty(content))
            {
                return false;
            }

            // 查找对应的研究项目
            var deepResearch = _context.DeepResearchLists
                .FirstOrDefault(x => x.ChatId == chatId && x.Account == account);

            if (deepResearch == null)
            {
                return false;
            }

            // 更新研究报告内容和标题
            deepResearch.DeepContent = content;
            if (!string.IsNullOrEmpty(title))
            {
                deepResearch.DeepTitle = title;
            }

            // 保存到数据库
            await _context.SaveChangesAsync();

            // 同时更新Redis缓存
            var cacheKey = $"deepresearch_report_{chatId}";
            await _redisService.SetAsync(cacheKey, content, TimeSpan.FromMinutes(30));


            return true;
        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"保存研究报告内容异常: chatId={chatId}, account={account}, 错误: {ex.Message}", Dtos.LogLevel.Error, "DeepResearch");
            return false;
        }
    }

    //删除深度研究项目
    public async Task<bool> DeleteDeepResearchAsync(string chatId, string account)
    {
        try
        {
            // 验证输入参数
            if (string.IsNullOrEmpty(chatId) || string.IsNullOrEmpty(account))
            {
                await _systemService.WriteLog($"删除研究项目参数无效: chatId={chatId}, account={account}", Dtos.LogLevel.Warn, "DeepResearch");
                return false;
            }

            // 查找研究项目
            var deepResearch = _context.DeepResearchLists
                .FirstOrDefault(x => x.ChatId == chatId && x.Account == account);

            if (deepResearch == null)
            {
                return false;
            }

            // 检查是否为进行中的任务，如果是则取消任务
            var process = int.Parse(deepResearch.Process ?? "0");
            if (process > 0 && process < 100)
            {
                // 取消正在进行的后台任务
                _chatCancellationManager.TryCancelChat(chatId);
            }

            // 开始事务删除相关数据
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // 1. 删除深度研究对话记录表 (DeepResearchChatHistory)
                var chatHistories = _context.DeepResearchChatHistories
                    .Where(x => x.DeepResearchChatId == chatId)
                    .ToList();

                if (chatHistories.Any())
                {
                    _context.DeepResearchChatHistories.RemoveRange(chatHistories);
                }

                // 2. 删除AI活动表 (DeepResearchActiveList)
                var activities = _context.DeepResearchActiveLists
                    .Where(x => x.ChatId == chatId && x.Account == account)
                    .ToList();

                if (activities.Any())
                {
                    _context.DeepResearchActiveLists.RemoveRange(activities);
                }

                // 3. 删除研究报告表 (DeepResearchList)
                _context.DeepResearchLists.Remove(deepResearch);

                // 保存所有更改
                await _context.SaveChangesAsync();

                // 提交事务
                await transaction.CommitAsync();

                // 清理Redis缓存
                await CleanupRedisCache(chatId);

                // 清理取消令牌
                _chatCancellationManager.RemoveToken(chatId);

                return true;
            }
            catch (Exception ex)
            {
                // 回滚事务
                await transaction.RollbackAsync();
                return false;
            }
        }
        catch (Exception ex)
        {
            return false;
        }
    }

    //清理Redis缓存
    private async Task CleanupRedisCache(string chatId)
    {
        try
        {
            // 清理相关的Redis缓存
            var cacheKeys = new[]
            {
                $"deepresearch_{chatId}",           // 研究进度缓存
                $"deepresearch_report_{chatId}"     // 研究报告内容缓存
            };

            foreach (var key in cacheKeys)
            {
                await _redisService.DeleteAsync(key);
            }

        }
        catch (Exception ex)
        {
            await _systemService.WriteLog($"清理Redis缓存失败: chatId={chatId}, 错误: {ex.Message}", Dtos.LogLevel.Warn, "DeepResearch");
        }
    }

    //检查用户是否有进行中的任务
    public async Task<bool> HasRunningTasksAsync(string account)
    {
        try
        {
            // 查询该用户是否有进度不为100%的研究任务
            var runningTasks = await Task.FromResult(_context.DeepResearchLists
                .Where(x => x.Account == account)
                .Where(x => x.Process != "100" && !string.IsNullOrEmpty(x.Process))
                .Any());

            if (runningTasks)
            {
                return true;
            }

            return false;
        }
        catch (Exception ex)
        {
            return false; // 出现异常时，为了安全起见，允许创建新任务
        }
    }

    //获取深度研究对话历史
    public async Task<List<DeepResearchChatHistory>> GetDeepResearchChatHistoryAsync(string deepResearchChatId, string account, int count = 3)
    {
        try
        {
            List<DeepResearchChatHistory> histories = new List<DeepResearchChatHistory>();
            //尝试从缓存获取
            var cacheKey = $"deepresearch_chathistory_{deepResearchChatId}";
            var cachedHistory = await _redisService.GetAsync(cacheKey);
            if (!string.IsNullOrEmpty(cachedHistory))
            {
                histories = JsonConvert.DeserializeObject<List<DeepResearchChatHistory>>(cachedHistory);
            }
            else
            {
                histories = await Task.FromResult(_context.DeepResearchChatHistories
                   .AsNoTracking()
                   .Where(x => x.DeepResearchChatId == deepResearchChatId && x.Account == account)
                   .OrderBy(x => x.CreateTime)
                   .ToList());
                await _redisService.SetAsync(cacheKey, JsonConvert.SerializeObject(histories), TimeSpan.FromMinutes(30));
            }
            // 清除IsShow为false的记录
            histories = histories.Where(x => x.IsShow == true).ToList();
            if (histories.Count > count && count > 0)
            {
                histories = histories.Skip(histories.Count - count * 2).Take(count * 2).ToList();
            }

            return histories;
        }
        catch (Exception ex)
        {
            return new List<DeepResearchChatHistory>();
        }
    }

    //保存深度研究对话历史
    public async Task<bool> SaveDeepResearchChatHistoryAsync(string chatId, string deepResearchChatId, string groupId, string account, string role, string chat, string think = "", bool isShow = true, string fileList = "", string imageList = "")
    {
        var history = new DeepResearchChatHistory
        {
            ChatId = chatId,
            DeepResearchChatId = deepResearchChatId,
            ChatGroupId = groupId,
            Account = account,
            Role = role,
            Chat = chat,
            Reasoning = think,
            IsShow = isShow,
            FileList = fileList,
            ImageList = imageList,
            CreateTime = DateTime.Now
        };
        await _context.DeepResearchChatHistories.AddAsync(history);
        await _context.SaveChangesAsync();
        if (role == "assistant")
        {
            //更新缓存
            var cacheKey = $"deepresearch_chathistory_{deepResearchChatId}";
            var historyStr = _context.DeepResearchChatHistories
                .Where(x => x.DeepResearchChatId == deepResearchChatId && x.Account == account)
                .OrderBy(x => x.CreateTime)
                .ToList();
            await _redisService.SetAsync(cacheKey, JsonConvert.SerializeObject(historyStr), TimeSpan.FromMinutes(30));
        }
        return true;
    }

    // 使用前的余额会员检查
    public async Task<bool> DeepResearchBeforeCheck(string model, string account)
    {
        bool result = true;
        var user = _usersService.GetUserData(account);
        var aiModel = _context.VibeCodingModels.Where(x => x.ModelName == model).FirstOrDefault();

        var modelPrice = await _financeService.ModelPrice(model);
        bool isVip = await _financeService.IsVip(account);
        bool isSVip = await _financeService.IsSVip(account);
        bool shouldCharge = modelPrice != null && (
            (!isVip && !isSVip && (modelPrice.ModelPriceInput > 0 || modelPrice.ModelPriceOutput > 0 ||
                                   modelPrice.OnceFee > 0)) ||
            (isVip && !isSVip && (modelPrice.VipModelPriceInput > 0 || modelPrice.VipModelPriceOutput > 0 ||
                                  modelPrice.VipOnceFee > 0)) ||
            (isSVip && (modelPrice.SvipModelPriceInput > 0 || modelPrice.SvipModelPriceOutput > 0 ||
                        modelPrice.SvipOnceFee > 0)));

        // 不是会员且余额为0时不提供服务
        if (!isVip && !isSVip && user.Mcoin <= 0)
        {
            result = false;
        }

        // 检查用户余额是否不足，只有在需要收费时检查
        if (shouldCharge && user.Mcoin <= 0)
        {
            result = false;
        }

        if (aiModel != null && aiModel.MinimumBalance > 0)
        {
            // 检查用户余额是否不足
            result = false;
        }

        return result;
    }
}