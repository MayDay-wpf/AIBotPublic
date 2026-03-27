using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.ChatService;
using Microsoft.AspNetCore.SignalR;
using Newtonsoft.Json;
using System.Collections.Concurrent;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace aibotPro.Service;

public class DeepResearchBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<DeepResearchBackgroundService> _logger;
    private readonly ConcurrentQueue<DeepResearchTask> _taskQueue = new();
    private readonly SemaphoreSlim _semaphore = new(1, 1); // 控制并发数量
    private readonly ChatCancellationManager _chatCancellationManager;

    public DeepResearchBackgroundService(IServiceProvider serviceProvider, ILogger<DeepResearchBackgroundService> logger, ChatCancellationManager chatCancellationManager)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _chatCancellationManager = chatCancellationManager;
    }

    public void EnqueueTask(DeepResearchTask task)
    {
        _taskQueue.Enqueue(task);
        _logger.LogInformation($"深度研究任务已加入队列: {task.ChatId}");
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("深度研究后台服务已启动");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (_taskQueue.TryDequeue(out var task))
                {
                    await _semaphore.WaitAsync(stoppingToken);
                    try
                    {
                        // 在后台处理任务
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                await ProcessDeepResearchTask(task);
                            }
                            catch (Exception ex)
                            {
                                _logger.LogError(ex, $"处理深度研究任务失败: {task.ChatId}");
                            }
                            finally
                            {
                                _semaphore.Release();
                            }
                        }, stoppingToken);
                    }
                    catch
                    {
                        _semaphore.Release();
                        throw;
                    }
                }
                else
                {
                    // 没有任务时等待一段时间
                    await Task.Delay(1000, stoppingToken);
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "深度研究后台服务执行出错");
                await Task.Delay(5000, stoppingToken); // 出错后等待5秒再继续
            }
        }

        _logger.LogInformation("深度研究后台服务已停止");
    }

    private async Task ProcessDeepResearchTask(DeepResearchTask task)
    {
        using var scope = _serviceProvider.CreateScope();
        var deepResearchService = scope.ServiceProvider.GetRequiredService<IDeepResearchService>();
        var redisService = scope.ServiceProvider.GetRequiredService<IRedisService>();
        var systemService = scope.ServiceProvider.GetRequiredService<ISystemService>();
        var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<DeepResearchHub>>();

        // 获取或创建取消令牌
        var (semaphore, cancellationToken) = _chatCancellationManager.GetOrCreateToken(task.ChatId);

        try
        {

            // 检查是否已被取消
            cancellationToken.ThrowIfCancellationRequested();

            // 发送开始处理通知
            await SendAIActivity(hubContext, task.ChatId, task.Account, "创建任务", "正在创建任务...", "fas fa-thumbtack text-info", "loading");

            // 创建深度研究任务
            bool result = await deepResearchService.CreateDeepResearchAsync(
                task.ChatId,
                task.Account,
                task.Title,
                task.SelectedQuestions);

            // 检查是否已被取消
            cancellationToken.ThrowIfCancellationRequested();

            await SendAIActivity(hubContext, task.ChatId, task.Account, "创建任务", "任务创建成功", "", "success");

            // 发送任务创建完成通知，告知前端可以安全选中研究项目
            await SendTaskCreatedNotification(hubContext, task.ChatId, task.Title);

            // 生成大纲
            await SendAIActivity(hubContext, task.ChatId, task.Account, "生成大纲", "正在生成大纲...", "fas fa-list-ol text-warning", "loading");

            // 检查是否已被取消
            cancellationToken.ThrowIfCancellationRequested();

            DeepOutline outline = await deepResearchService.CreateDeepResearchOutlineAsync(
                task.ChatId,
                task.Account,
                task.Title,
                task.SelectedQuestions);

            // 检查是否已被取消
            cancellationToken.ThrowIfCancellationRequested();

            await SendAIActivity(hubContext, task.ChatId, task.Account, "生成大纲", "大纲生成成功", "", "success");

            // 创建报告主体缓存
            string reportContent = $"# {task.Title}\n\n";
            await redisService.SetAsync($"deepresearch_report_{task.ChatId}", reportContent, TimeSpan.FromMinutes(30));

            // 推送初始报告内容到前端
            await SendReportContent(hubContext, task.ChatId, reportContent);

            // 计算所有子标题的总数，用于整体进度计算
            int totalSubTitles = outline.Outline.Sum(item => item.SubTitle.Count);
            int completedSubTitles = 0;

            // 报告生成阶段的进度范围：10% - 100%（前面已经完成了10%的进度）
            const int baseProgress = 10; // 基础进度（创建任务5% + 生成大纲5%）
            const int reportProgress = 90; // 报告生成占用的进度范围（100% - 10%）

            // 根据大纲遍历生成完整的研究报告
            foreach (var item in outline.Outline)
            {
                // 检查是否已被取消
                cancellationToken.ThrowIfCancellationRequested();

                // 检查用户余额和会员状态是否继续可用
                bool beforeCheck = await deepResearchService.DeepResearchBeforeCheck(task.Model, task.Account);
                if (!beforeCheck)
                {
                    // 推送余额不足通知
                    await SendAIActivity(hubContext, task.ChatId, task.Account, "余额不足", "账户余额不足，无法继续生成报告", "fas fa-exclamation-triangle text-warning", "error");
                    
                    // 保存当前已生成的报告内容到数据库
                    var currentContentCache = await redisService.GetAsync($"deepresearch_report_{task.ChatId}");
                    if (!string.IsNullOrEmpty(currentContentCache))
                    {
                        await deepResearchService.UpdateDeepResearchAsync(task.ChatId, task.Account, currentContentCache);
                        // 推送当前报告内容到前端
                        await SendReportContent(hubContext, task.ChatId, currentContentCache);
                    }
                    
                    // 将任务进度设置为100%完成
                    await deepResearchService.UpdateProcess(task.ChatId, 100, task.Title);
                    
                    // 发送任务完成通知（虽然是因余额不足而结束）
                    await SendAIActivity(hubContext, task.ChatId, task.Account, "任务完成", "由于余额不足，任务已提前完成", "fas fa-check-circle text-success", "success");
                    
                    return; // 提前结束任务
                }
                // 更新二级标题
                var contentCacheTitle = await redisService.GetAsync($"deepresearch_report_{task.ChatId}");
                if (!string.IsNullOrEmpty(contentCacheTitle))
                {
                    contentCacheTitle += $"\n\n## {item.MainTitle}\n\n";
                    await redisService.SetAsync($"deepresearch_report_{task.ChatId}", contentCacheTitle, TimeSpan.FromMinutes(30));

                    // 推送二级标题到前端
                    await SendReportContent(hubContext, task.ChatId, contentCacheTitle);
                }

                for (int i = 0; i < item.SubTitle.Count; i++)
                {
                    // 检查是否已被取消
                    cancellationToken.ThrowIfCancellationRequested();

                    // 通知生成状态
                    var subTitle = item.SubTitle[i];
                    await SendAIActivity(hubContext, task.ChatId, task.Account, $"生成报告:{subTitle}", "正在生成...", "fas fa-file-alt text-primary", "loading");

                    // 判断是否需要联网搜索
                    OutLineShouldSearch outLineShouldSearch = await deepResearchService.JudgeShouldSearchAsync(
                        task.ChatId,
                        task.Account,
                        subTitle,
                        OutLineToMarkdown(outline));

                    // 检查是否已被取消
                    cancellationToken.ThrowIfCancellationRequested();

                    string searchResult = string.Empty;
                    if (outLineShouldSearch.ShouldSearch)
                    {
                        // 联网搜索
                        searchResult = await deepResearchService.GetJinaSearchResultAsync(outLineShouldSearch.SearchKeywords);
                    }

                    // 检查是否已被取消
                    cancellationToken.ThrowIfCancellationRequested();

                    // 生成小标题的正文内容（传递取消令牌）
                    string subTitleContent = await deepResearchService.DeepResearchReportContentGenerateAsync(
                        task.ChatId,
                        task.Account,
                        subTitle,
                        CreateSystemPrompt(task.Title, outline),
                        task.Model,
                        searchResult);

                    // 检查是否已被取消
                    cancellationToken.ThrowIfCancellationRequested();

                    // 更新缓存中报告内容
                    var contentCache = await redisService.GetAsync($"deepresearch_report_{task.ChatId}");
                    if (!string.IsNullOrEmpty(contentCache))
                    {
                        contentCache += $"\n\n### {subTitle}\n\n{subTitleContent}";
                        await redisService.SetAsync($"deepresearch_report_{task.ChatId}", contentCache, TimeSpan.FromMinutes(30));

                        // 实时推送研究报告内容到前端
                        await SendReportContent(hubContext, task.ChatId, contentCache);
                    }

                    // 通知此小标题生成完成
                    await SendAIActivity(hubContext, task.ChatId, task.Account, $"生成报告:{subTitle}", $"生成完成({task.Model})", "", "success");

                    // 计算整体进度并更新
                    completedSubTitles++;
                    // 计算报告生成的进度（10% - 100%）
                    int reportGenerationProgress = (int)(((double)completedSubTitles / (double)totalSubTitles) * reportProgress);
                    int process = baseProgress + reportGenerationProgress;
                    await deepResearchService.UpdateProcess(task.ChatId, process, task.Title);
                }
            }

            // 检查是否已被取消
            cancellationToken.ThrowIfCancellationRequested();

            // 保存最终报告到数据库
            var lastContentCache = await redisService.GetAsync($"deepresearch_report_{task.ChatId}");
            await deepResearchService.UpdateDeepResearchAsync(task.ChatId, task.Account, lastContentCache);

            // 推送最终完整报告内容到前端
            await SendReportContent(hubContext, task.ChatId, lastContentCache);

        }
        catch (OperationCanceledException)
        {
            // 发送取消通知到前端
            // await SendAIActivity(hubContext, task.ChatId, task.Account, "任务取消", "研究任务已被取消", "fas fa-times-circle text-warning", "error");
        }
        catch (Exception ex)
        {
            await systemService.WriteLog(ex.Message, Dtos.LogLevel.Error, "ProcessDeepResearchTask");
            // 发送错误通知到前端
            await SendAIActivity(hubContext, task.ChatId, task.Account, "任务处理", "任务处理失败", "fas fa-exclamation-triangle text-danger", "error");
        }
        finally
        {
            // 清理取消令牌
            _chatCancellationManager.RemoveToken(task.ChatId);
        }
    }

    private async Task SendAIActivity(IHubContext<DeepResearchHub> hubContext, string chatId, string account, string title, string message, string icon, string status)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var deepResearchService = scope.ServiceProvider.GetRequiredService<IDeepResearchService>();

            var data = new Object();
            if (!string.IsNullOrEmpty(icon))
            {
                data = new
                {
                    chatId = chatId,
                    title = title,
                    message = message,
                    icon = icon,
                    status = status
                };
            }
            else
            {
                data = new
                {
                    chatId = chatId,
                    title = title,
                    newDescription = message,
                    status = status
                };
            }

            await hubContext.Clients.Group(chatId).SendAsync("ReceiveActivityUpdate", data);
            // 保存活动到数据库
            await deepResearchService.SaveAIActiveAsync(chatId, account, icon, title, message, status);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"SendAIActivity error: {ex.Message}");
        }
    }

    private async Task SendReportContent(IHubContext<DeepResearchHub> hubContext, string chatId, string content)
    {
        try
        {
            var data = new
            {
                chatId = chatId,
                content = content
            };

            await hubContext.Clients.Group(chatId).SendAsync("ReceiveReportContent", data);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"SendReportContent error: {ex.Message}");
        }
    }

    private string OutLineToMarkdown(DeepOutline outline)
    {
        var markdown = string.Empty;
        foreach (var item in outline.Outline)
        {
            markdown += $"# {item.MainTitle}\n\n";
            foreach (var subTitle in item.SubTitle)
            {
                markdown += $"## {subTitle}\n\n";
            }
        }
        return markdown;
    }

    private string CreateSystemPrompt(string title, DeepOutline outline)
    {
        string systemPrompt = $@"# You are a professional research assistant. You are given a research title and an outline. You need to generate a research report based on the outline. The language of the report follows the user's report title language. 
        
        ## Crucial Policy: No assumptions are permitted regarding the data; all data must be rigorously verifiable and traceable.\n\n
        
        * The report title is: \n\n
        {title} \n\n
        * The outline is as follows: \n\n
        {OutLineToMarkdown(outline)} \n\n

        # Requirements for Generating Report Content\n\n

        * The report should be formatted in Markdown, using the vditor editor.\n\n

        * The user will provide a subheading from the outline; you should focus on generating the report content for that subheading. Do not generate the title or any extraneous text, only the content related to that subheading.\n\n

        * The user may provide some information found through online searches. If relevant content is present in the provided materials, you can cite it, but do not copy it directly. Instead, summarize and synthesize the information.\n\n

        ## CRITICAL: Reference and Citation Requirements\n\n

        ### **MANDATORY Reference Format**\n\n

        * **HYPERLINKS ONLY**: When citing content or referencing sources, you MUST use complete Markdown hyperlink format: [显示文字](完整链接URL)\n\n

        * **ABSOLUTELY FORBIDDEN**: Do NOT use footnotes, endnotes, or any numbered reference system like [1], [2], etc.\n\n

        * **NEVER** use incomplete links like [显示文字] without the URL part in parentheses.\n\n

        * **ALWAYS** include both the display text in square brackets AND the complete URL in parentheses.\n\n

        ### **CRITICAL: Handling Search Result References**\n\n

        * **IGNORE INVALID REFERENCES**: The search results may contain invalid reference markers like [1], [2], [xxxx], [source], [ref], etc. You MUST completely ignore and remove these markers.\n\n

        * **DO NOT REPRODUCE**: Never reproduce or copy these bracketed reference markers from the search results. They are meaningless without proper URLs.\n\n

        * **CLEAN PROCESSING**: When processing search result content:\n
          1. Extract the meaningful information\n
          2. Completely ignore any bracketed reference markers like [1], [2], [source], [ref], [xxxx]\n
          3. Do not include these markers in your output under any circumstances\n
          4. If you want to reference the source, create a proper hyperlink instead\n\n

        * **EXAMPLES of what to IGNORE and REMOVE**:\n
          - [1], [2], [3]... [999] ❌ (Remove completely)\n
          - [source], [ref], [citation] ❌ (Remove completely)\n
          - [xxxx], [yyyy], [任意文字] ❌ (Remove completely)\n
          - Any bracketed content without a corresponding URL ❌ (Remove completely)\n\n

        ### **Reference Format Examples**\n\n

        * **CORRECT hyperlink format** (ONLY acceptable method):\n
          - [OpenAI官方文档](https://docs.openai.com)\n
          - [GitHub仓库](https://github.com/example/repo)\n
          - [研究论文](https://arxiv.org/abs/2301.00001)\n
          - [相关报告](https://example.com/report.pdf)\n\n

        * **ABSOLUTELY FORBIDDEN formats** (DO NOT USE):\n
          - [OpenAI官方文档] ❌\n
          - [GitHub仓库]() ❌\n
          - 仅显示文字而无链接 ❌\n
          - 使用注脚 [1] ❌\n
          - 使用尾注 (1) ❌\n
          - 任何数字引用系统 ❌\n
          - 从搜索结果复制的无效引用标记 ❌\n\n

        ### **Reference Guidelines**\n\n

        * **INLINE ONLY**: All references must be inline hyperlinks within the text flow\n\n

        * **NO REFERENCE SECTIONS**: Do not create reference sections like 参考文献、引用、References at the end\n\n

        * **NO NUMBERED CITATIONS**: Never use [1], [2], (1), (2) or any numbered reference system\n\n

        * **CLEAN OUTPUT**: Your final output should be completely free of any meaningless bracketed markers from search results\n\n

        * If you don't have a specific URL for a reference, either:\n
          1. Don't create a link (just use plain text)\n
          2. Or use a general search URL like [搜索关键词](https://www.google.com/search?q=关键词)\n\n

        * Mark the source of the citation at the relevant point in the text using these complete Markdown hyperlinks.\n\n

        * If the user does not provide online materials, you can generate the report content based on your existing knowledge base, but still follow the link format rules if you include any references.\n\n

        # IMPORTANT: Balanced Content with Appropriate Visual Elements\n\n

        * vditor follows and is compatible with all Markdown syntax.\n\n

        ## **Content Quality Guidelines**: Use Visual Elements Strategically\n\n

        * **BALANCE**: Create well-structured reports that combine quality text content with appropriate visual elements when they truly add value.\n\n

        * **SELECTIVE USE**: Only use visual elements (tables, charts, diagrams) when they significantly improve understanding or present information more effectively than text.\n\n

        * **PRIORITY ORDER for visual elements**:\n
          1. **Tables** - Use for data comparison, structured information, and organized content (MOST PREFERRED)\n
          2. **Pie charts** - Use for statistical data, percentages, and proportional relationships\n
          3. **ECharts** - Use for complex data visualization, trends, and multi-dimensional data\n
          4. **Mermaid diagrams** - Use SPARINGLY, only for complex processes or system relationships that truly need visualization\n\n

        * **AVOID**: Overusing visual elements, especially flowcharts and diagrams. Not every process needs a diagram.\n\n

        * **WHEN TO USE visual elements**:\n
          - Data comparison → Use tables (preferred) or charts only if data is complex\n
          - Statistical information → Use pie charts or ECharts for significant datasets\n
          - Complex processes → Use mermaid diagrams ONLY when the process is genuinely complex\n
          - Simple explanations → Use text, avoid unnecessary diagrams\n\n

        ## Available Visual Tools (Use Selectively)\n\n

        ### **Tables for Data Presentation** (PREFERRED)\n\n
        * Use Markdown tables for structured data, comparisons, and organized information.\n\n
        - Example:\n\n
        | 特性 | 方案A | 方案B | 方案C |\n
        |------|-------|-------|-------|\n
        | 成本 | 低 | 中 | 高 |\n
        | 效率 | 中 | 高 | 高 |\n
        | 可维护性 | 低 | 中 | 高 |\n
        | 推荐指数 | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |\n\n

        ### **Pie Charts for Statistical Data**\n\n
        * Use for market share, survey results, proportional data.\n\n
        ```pie
        title 市场份额分析
        ""产品A"" : 386
        ""产品B"" : 583
        ""产品C"" : 276
        ""其他"" : 155
        ```

        ### **ECharts for Complex Data Visualization**\n\n
        * Use for trends, multi-dimensional data, time series.\n\n

        ### **Mermaid Diagrams** (USE SPARINGLY)\n\n
        * **ONLY use when absolutely necessary** for complex system relationships or intricate processes.\n
        * **AVOID** for simple step-by-step processes that can be explained in text.
        * **CRITICAL**: The system uses Mermaid version 10.8.0 - ensure all syntax is compatible with this version.

        #### **Mermaid v10.8.0 Syntax Guidelines:**
        * Use proper node shapes: `[]` for rectangles, `()` for rounded, `{{}}` for rhombus, `{{{{}}}}` for hexagon
        * Direction syntax: `TD` (Top-Down), `LR` (Left-Right), `BT` (Bottom-Top), `RL` (Right-Left)
        * Link labels use `-->|label|` format
        * Subgraphs: `subgraph title` ... `end`
        * Classes and styles: `classDef className fill:#color`\\n\\n
        ```mermaid
        graph TD
        A[复杂系统A] --> B{{关键决策点}}
        B -->|条件1| C[子系统C]
        B -->|条件2| D[子系统D]
        C --> E((结果1))
        D --> F((结果2))

        classDef systemClass fill:#e1f5fe,stroke:#01579b,stroke-width:2px
        classDef decisionClass fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
        classDef resultClass fill:#e8f5e8,stroke:#2e7d32,stroke-width:2px

        class A,C,D systemClass
        class B decisionClass
        class E,F resultClass
        ```

        ### **Content Balance Guidelines**\n\n
        * **TEXT FIRST**: Most content should be well-written, informative text\n
        * **VISUAL SUPPORT**: Use visual elements to support and enhance text, not replace it\n
        * **QUALITY OVER QUANTITY**: One well-chosen table or chart is better than multiple unnecessary diagrams\n
        * **READER FOCUS**: Ask ""Does this visual element help the reader understand better, or is it just decoration?""\n\n

        * vditor supports rendering echarts charts for complex data visualization.\n\n
        - Example:\n\n
        ```echarts
        {{
          ""title"": {{ ""text"": ""Last 7 days"" }},
          ""tooltip"": {{ ""trigger"": ""axis"", ""axisPointer"": {{ ""lineStyle"": {{ ""width"": 0 }} }} }},
          ""legend"": {{ ""data"": [""Posts"", ""Users"", ""Replies""] }},
          ""xAxis"": [{{
              ""type"": ""category"",
              ""boundaryGap"": false,
              ""data"": [""2019-05-08"",""2019-05-09"",""2019-05-10"",""2019-05-11"",""2019-05-12"",""2019-05-13"",""2019-05-14""],
              ""axisTick"": {{ ""show"": false }},
              ""axisLine"": {{ ""show"": false }}
          }}],
          ""yAxis"": [{{ ""type"": ""value"", ""axisTick"": {{ ""show"": false }}, ""axisLine"": {{ ""show"": false }}, ""splitLine"": {{ ""lineStyle"": {{ ""color"": ""rgba(0, 0, 0, .38)"", ""type"": ""dashed"" }} }} }}],
          ""series"": [
            {{
              ""name"": ""Posts"", ""type"": ""line"", ""smooth"": true, ""itemStyle"": {{ ""color"": ""#d23f31"" }}, ""areaStyle"": {{ ""normal"": {{}} }}, ""z"": 3,
              ""data"": [""18"",""14"",""22"",""9"",""7"",""18"",""10""]
            }},
            {{
              ""name"": ""Users"", ""type"": ""line"", ""smooth"": true, ""itemStyle"": {{ ""color"": ""#f1e05a"" }}, ""areaStyle"": {{ ""normal"": {{}} }}, ""z"": 2,
              ""data"": [""31"",""33"",""30"",""23"",""16"",""29"",""23""]
            }},
            {{
              ""name"": ""Replies"", ""type"": ""line"", ""smooth"": true, ""itemStyle"": {{ ""color"": ""#4285f4"" }}, ""areaStyle"": {{ ""normal"": {{}} }}, ""z"": 1,
              ""data"": [""35"",""42"",""73"",""15"",""43"",""58"",""55""]
            }}
          ]
        }}

        * vditor supports rendering LaTeX equations.\n\n
        - Example:\n\n
        Multi-line formula block:\n\n
        Use $$ to start and end a multi-line formula block.\n\n
        - Example:\n\n
        $$\\frac{{1}}{{2\\pi i}} \\oint_C \\frac{{f(z)}}{{z-z_0}} dz$$

        Inline formula:\n\n
        Use $ to start and end an inline formula.\n\n
        - Example:\n\n
        $a^2 + b^2 = c^2$
        ";

        return systemPrompt;
    }

    private async Task SendTaskCreatedNotification(IHubContext<DeepResearchHub> hubContext, string chatId, string title)
    {
        try
        {
            var data = new
            {
                chatId = chatId,
                title = title
            };

            // 发送专门的任务创建完成通知
            await hubContext.Clients.Group(chatId).SendAsync("TaskCreated", data);
            _logger.LogInformation($"任务创建完成通知已发送: {chatId}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"SendTaskCreatedNotification error: {ex.Message}");
        }
    }
}

// 深度研究任务数据传输对象
public class DeepResearchTask
{
    public string ChatId { get; set; } = string.Empty;
    public string Account { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public List<string> SelectedQuestions { get; set; } = new();
    public string Model { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
}