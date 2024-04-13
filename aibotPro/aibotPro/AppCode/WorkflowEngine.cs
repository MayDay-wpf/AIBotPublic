using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using JavaScriptEngineSwitcher.ChakraCore;
using JavaScriptEngineSwitcher.Core;
using JavaScriptEngineSwitcher.Extensions.MsDependencyInjection;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Spire.Presentation.Charts;
using StackExchange.Redis;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Xml.Linq;
using TiktokenSharp;
using static iTextSharp.text.pdf.AcroFields;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory;

namespace aibotPro.AppCode
{
    public class WorkflowEngine
    {
        private readonly WorkFlowNodeData _workflowData;
        private readonly IAiServer _aiServer;
        private readonly ISystemService _systemService;
        private readonly IFinanceService _financeService;
        private readonly AIBotProContext _context;
        private readonly string _account;
        private readonly string _chatId;
        private readonly string _senMethod;
        private readonly List<WorkFlowCharging> _workFlowChargings = new List<WorkFlowCharging>();
        private readonly IServiceProvider _serviceProvider;
        private readonly IHubContext<ChatHub> _hubContext;
        public WorkflowEngine(WorkFlowNodeData workflowData, IAiServer aiServer, ISystemService systemService, IFinanceService financeService, AIBotProContext context, string account, IServiceProvider serviceProvider, IHubContext<ChatHub> hubContext, string chatId, string senMethod)
        {
            _workflowData = workflowData;
            _aiServer = aiServer;
            _systemService = systemService;
            _financeService = financeService;
            _context = context;
            _account = account;
            _serviceProvider = serviceProvider;
            _hubContext = hubContext;
            _chatId = chatId;
            _senMethod = senMethod;
        }
        public async Task<List<NodeOutput>> Execute(string startNodeOutput)
        {
            var startNode = _workflowData.Drawflow.Home.Data.Values.FirstOrDefault(x => x.Name == "start");
            var processedNodes = new HashSet<string>();
            var builds = Builds(startNode, 0);
            return await ExecuteFlow(builds, startNodeOutput);
            //return ExecuteNode(startNode, startNodeOutput, processedNodes);
        }
        private List<WorkFlowNodeBuild> Builds(NodeData node, int seq)
        {
            var result = new List<WorkFlowNodeBuild>();
            var levelNodes = new Dictionary<int, List<NodeData>>();
            var nodeMaxLevel = new Dictionary<int, int>();

            void UpdateNodeLevel(NodeData currentNode, int currentLevel, HashSet<NodeData> visitedNodes)
            {
                if (visitedNodes.Contains(currentNode))
                {
                    throw new Exception("Detected a circular dependency in the workflow.");
                }
                visitedNodes.Add(currentNode);

                // 更新当前节点的层级
                if (!nodeMaxLevel.ContainsKey(currentNode.Id) || nodeMaxLevel[currentNode.Id] < currentLevel)
                {
                    nodeMaxLevel[currentNode.Id] = currentLevel;
                }

                // 递归更新后续节点的层级
                foreach (var output in currentNode.Outputs)
                {
                    foreach (var connection in output.Value.Connections)
                    {
                        var nextNodeId = connection.Node;
                        var nextNode = _workflowData.Drawflow.Home.Data.Values.FirstOrDefault(x => x.Id.ToString() == nextNodeId);
                        if (nextNode != null)
                        {
                            UpdateNodeLevel(nextNode, currentLevel + 1, new HashSet<NodeData>(visitedNodes));
                        }
                    }
                }
            }

            // 首先确定所有节点的最大层级
            UpdateNodeLevel(node, seq, new HashSet<NodeData>());

            // 根据节点最大层级构建层级结构
            void RecursiveBuild(NodeData currentNode, int currentSeq, HashSet<NodeData> visitedNodes)
            {
                if (visitedNodes.Contains(currentNode))
                {
                    throw new Exception("Detected a circular dependency in the workflow.");
                }
                visitedNodes.Add(currentNode);

                int nodeLevel = nodeMaxLevel[currentNode.Id];
                if (!levelNodes.ContainsKey(nodeLevel))
                {
                    levelNodes[nodeLevel] = new List<NodeData>();
                }
                if (!levelNodes[nodeLevel].Contains(currentNode))
                {
                    levelNodes[nodeLevel].Add(currentNode);
                }

                foreach (var output in currentNode.Outputs)
                {
                    foreach (var connection in output.Value.Connections)
                    {
                        var nextNodeId = connection.Node;
                        var nextNode = _workflowData.Drawflow.Home.Data.Values.FirstOrDefault(x => x.Id.ToString() == nextNodeId);
                        if (nextNode != null)
                        {
                            RecursiveBuild(nextNode, nodeLevel + 1, new HashSet<NodeData>(visitedNodes));
                        }
                    }
                }
            }

            // 构建层级结构
            RecursiveBuild(node, 0, new HashSet<NodeData>());

            // 构建结果
            foreach (var kv in levelNodes.OrderBy(kv => kv.Key))
            {
                result.Add(new WorkFlowNodeBuild
                {
                    Seq = kv.Key,
                    Nodes = kv.Value
                });
            }

            return result;
        }
        private async Task<List<NodeOutput>> ExecuteFlow(List<WorkFlowNodeBuild> builds, string startNodeOutput)
        {
            List<NodeOutput> result = new List<NodeOutput>();
            // 对builds按照seq排序，并处理start元素
            builds = builds.OrderBy(x => x.Seq).ToList();
            result.Add(new NodeOutput { NodeName = "start", OutputData = startNodeOutput });
            builds.RemoveAt(0); // 第一个build是"start"，且已处理
            // 按照顺序处理每一个build，但build内部的Nodes可以并行执行
            foreach (var build in builds)
            {
                var tasks = build.Nodes.Select(node => ExecuteNode(node, result)).ToArray();
                // 等待这个build中所有node的处理完成
                var nodeOutputs = await Task.WhenAll(tasks);
                // 添加到总结果中
                result.AddRange(nodeOutputs);
            }
            foreach (var item in _workFlowChargings)
            {
                await _financeService.CreateUseLogAndUpadteMoney(item.Account, item.ModelName, item.InputCount, item.OutputCount, item.IsDraw);
            }
            return result;
        }
        private async Task<NodeOutput> ExecuteNode(NodeData node, List<NodeOutput> result)
        {
            NodeOutput nodeOutput = new NodeOutput();
            var nodeName = node.Name;
            var nodeId = node.Id;
            if (node.Name != "end")
                nodeOutput.NodeName = nodeName + nodeId;
            else
                nodeOutput.NodeName = nodeName;
            switch (nodeName)
            {
                case "javascript":
                    nodeOutput.OutputData = await ProcessJavaScriptNode(node, result);
                    break;
                case "http":
                    nodeOutput.OutputData = await ProcessHttpNode(node, result);
                    break;
                case "LLM":
                    nodeOutput.OutputData = await ProcessLLMNode(node, result);
                    break;
                case "DALL":
                    nodeOutput.OutputData = await ProcessDALLNode(node, result);
                    break;
                case "DALLsm":
                    nodeOutput.OutputData = await ProcessDALLsmNode(node, result);
                    break;
                case "web":
                    nodeOutput.OutputData = await ProcessWebNode(node, result);
                    break;
                case "end":
                    nodeOutput.OutputData = ProcessEndNode(node, result);
                    break;
                default:
                    throw new InvalidOperationException($"Unsupported node type: {nodeName}");
            }


            return nodeOutput;
        }

        private string ProcessStartNode(NodeData node, List<NodeOutput> result)
        {
            // 处理 "start" 节点,返回 JSON 字符串
            return "";
        }

        private async Task<string> ProcessJavaScriptNode(NodeData node, List<NodeOutput> result)
        {
            //获取javascript节点的脚本内容
            var jsData = (JavaScriptData)node.Data;
            //替换脚本中的变量
            jsData.Output.JavaScript = FillScriptWithValues(jsData.Output.JavaScript, result);
            var nodeName = node.Name;
            var nodeId = node.Id;
            if (!string.IsNullOrEmpty(_chatId))
            {
                ChatRes chatRes = new ChatRes();
                chatRes.message = $"👨‍💻";
                await _hubContext.Clients.Group(_chatId).SendAsync(_senMethod, chatRes);
            }
            //初始化JavaScript引擎
            IServiceCollection services = new ServiceCollection();
            services.AddJsEngineSwitcher(options => options.DefaultEngineName = ChakraCoreJsEngine.EngineName)
                    .AddChakraCore();

            IServiceProvider serviceProvider = services.BuildServiceProvider();
            IJsEngineSwitcher jsEngineSwitcher = serviceProvider.GetRequiredService<IJsEngineSwitcher>();

            IJsEngine jsEngine = jsEngineSwitcher.CreateDefaultEngine();
            //执行JavaScript代码
            jsEngine.Execute(jsData.Output.JavaScript);
            string ExecuteResult = jsEngine.CallFunction<string>(nodeName + nodeId);
            return BuilderJson(nodeName + nodeId, ExecuteResult);
        }

        private async Task<string> ProcessHttpNode(NodeData node, List<NodeOutput> result)
        {
            // 处理 "http" 节点,执行 HTTP 请求,返回 JSON 字符串
            HttpData httpData = (HttpData)node.Data;
            string type = httpData.Output.Type;
            string url = FillScriptWithValues(httpData.Output.RequestUrl, result);
            string body = string.Empty;
            var nodeName = node.Name;
            var nodeId = node.Id;
            if (!string.IsNullOrEmpty(_chatId))
            {
                ChatRes chatRes = new ChatRes();
                chatRes.message = $"📎";
                await _hubContext.Clients.Group(_chatId).SendAsync(_senMethod, chatRes);
            }
            Dictionary<string, object> parameters = new Dictionary<string, object>();
            Dictionary<string, string> headers = new Dictionary<string, string>();
            Dictionary<string, string> cookies = new Dictionary<string, string>();
            if (httpData.Output.ParamsItems.Count > 0 && type == "get")
            {
                foreach (var itemPr in httpData.Output.ParamsItems)
                {
                    parameters.Add(itemPr.ParamKey, FillScriptWithValues(itemPr.ParamValue, result));
                }
            }
            else
            {
                if (!string.IsNullOrEmpty(httpData.Output.Jsontemplate))
                {
                    body = FillScriptWithValues(httpData.Output.Jsontemplate, result);
                }
            }
            if (httpData.Output.HeadersItems.Count > 0)
            {
                foreach (var itemHd in httpData.Output.HeadersItems)
                {
                    headers.Add(itemHd.HdValue, itemHd.HdValue);
                }
            }
            if (httpData.Output.CookiesItems.Count > 0)
            {
                foreach (var itemCk in httpData.Output.CookiesItems)
                {
                    cookies.Add(itemCk.CkKey, itemCk.CkValue);
                }
            }
            if (type == "get")
            {
                return BuilderJson(nodeName + nodeId, _aiServer.AiGet(url, parameters, headers, cookies));
            }
            else
            {
                return BuilderJson(nodeName + nodeId, _aiServer.AiPost(url, parameters, headers, cookies, body));
            }
        }

        private async Task<string> ProcessLLMNode(NodeData node, List<NodeOutput> result)
        {
            // 处理 "LLM" 节点,执行 LLM 代码,返回 JSON 字符串
            LLMData llmData = (LLMData)node.Data;
            TikToken tikToken = TikToken.GetEncoding("cl100k_base");
            var nodeName = node.Name;
            var nodeId = node.Id;
            string inputtokens = "";
            string outputtokens = "";
            if (!string.IsNullOrEmpty(_chatId))
            {
                ChatRes chatRes = new ChatRes();
                chatRes.message = $"🤖";
                await _hubContext.Clients.Group(_chatId).SendAsync(_senMethod, chatRes);
            }
            string aimodel = llmData.Output.AiModel;
            string prompt = FillScriptWithValues(llmData.Output.Prompt, result);
            string airesult = string.Empty; // 初始化为空
            int retryCount = llmData.Output.Retry; // 重试次数
            bool stream = llmData.Output.Stream;
            int initialRetryCount = retryCount;

            while (true)
            {
                airesult += await Task.Run(async () =>
                {
                    string result = string.Empty;
                    int currentRetryCount = retryCount;

                    do
                    {
                        result = string.Empty;
                        if (!stream || string.IsNullOrEmpty(_chatId))
                        {
                            result = await _aiServer.CallingAINotStream(prompt, aimodel);
                            result = result.Replace("\"", "");
                            if (!string.IsNullOrEmpty(result))
                            {
                                outputtokens = result;
                                break; // 如果结果非空,退出循环
                            }


                            // 如果在重试结束后结果仍为空,则抛出异常
                            if (string.IsNullOrEmpty(result))
                            {
                                string failMessage = "❌ 重试失败。LLM处理数据时回复为空,工作流中断,请重试";
                                if (!string.IsNullOrEmpty(_chatId))
                                {
                                    await _hubContext.Clients.Group(_chatId).SendAsync(_senMethod, new ChatRes { message = failMessage });
                                }
                                throw new Exception(failMessage);
                            }
                            if (!string.IsNullOrEmpty(_chatId) && currentRetryCount > 0)
                            {
                                // 计算剩余重试次数
                                int remainingRetries = currentRetryCount - 1;
                                string retryMessage = $"🔄 LLM重试 {initialRetryCount - remainingRetries}/{initialRetryCount}...";

                                await _hubContext.Clients.Group(_chatId).SendAsync(_senMethod, new ChatRes { message = retryMessage });
                            }
                        }
                        else
                        {
                            AiChat aiChat = new AiChat();
                            APISetting apiSetting = new APISetting();
                            var aImodels = _systemService.GetAImodel();
                            string apiKey = aImodels.Where(x => x.ModelName == aimodel).FirstOrDefault().ApiKey;
                            //标准化baseurl
                            string baseUrl = aImodels.Where(x => x.ModelName == aimodel).FirstOrDefault().BaseUrl;
                            try
                            {
                                if (baseUrl.EndsWith("/"))
                                {
                                    baseUrl = baseUrl.TrimEnd('/');
                                }
                            }
                            catch (Exception e)
                            {
                                throw e;
                            }
                            apiSetting.ApiKey = apiKey;
                            apiSetting.BaseUrl = baseUrl;
                            aiChat.Model = aimodel;
                            aiChat.Stream = true;
                            List<Message> messages = new List<Message>();
                            Message message = new Message
                            {
                                Role = "user",
                                Content = prompt
                            };
                            messages.Add(message);
                            aiChat.Messages = messages;
                            try
                            {
                                await foreach (var responseContent in _aiServer.CallingAI(aiChat, apiSetting))
                                {
                                    result += responseContent.Choices[0].Delta.Content;
                                    await _hubContext.Clients.Group(_chatId).SendAsync(_senMethod, new ChatRes { message = responseContent.Choices[0].Delta.Content });
                                    outputtokens += responseContent.Choices[0].Delta.Content;
                                }
                                break;
                            }
                            catch (Exception ex)
                            {
                                if (!string.IsNullOrEmpty(_chatId) && currentRetryCount > 0)
                                {
                                    // 计算剩余重试次数
                                    int remainingRetries = currentRetryCount - 1;
                                    string retryMessage = $"🔄 LLM请求出错,重试 {initialRetryCount - remainingRetries}/{initialRetryCount}...";

                                    await _hubContext.Clients.Group(_chatId).SendAsync(_senMethod, new ChatRes { message = retryMessage });
                                }

                                await Task.Delay(500); // 延迟一段时间再重试
                                continue; // 继续下一次重试
                            }
                        }
                        await Task.Delay(500);
                    } while (--currentRetryCount >= 0);

                    return result;
                });
                airesult = airesult.Replace("\"", "");
                var jsonBuilder = new StringBuilder();
                jsonBuilder.Append("{");
                jsonBuilder.Append($"\"{node.Name + node.Id}\":");
                jsonBuilder.Append("{");
                jsonBuilder.Append($"\"data\":");
                jsonBuilder.Append($"\"{airesult}\"");
                jsonBuilder.Append("}");
                jsonBuilder.Append("}");
                string jsonStr = jsonBuilder.ToString();
                string llmScript = llmData.Output.JudgeScript;
                llmScript = FillScriptWithValues(llmScript, result, jsonStr);
                //初始化JavaScript引擎
                IServiceCollection services = new ServiceCollection();
                services.AddJsEngineSwitcher(options => options.DefaultEngineName = ChakraCoreJsEngine.EngineName)
                        .AddChakraCore();

                IServiceProvider serviceProvider = services.BuildServiceProvider();
                IJsEngineSwitcher jsEngineSwitcher = serviceProvider.GetRequiredService<IJsEngineSwitcher>();

                IJsEngine jsEngine = jsEngineSwitcher.CreateDefaultEngine();
                //执行JavaScript代码
                jsEngine.Execute(llmScript);
                string ExecuteResult = jsEngine.CallFunction<string>(nodeName + nodeId);
                if (ExecuteResult == "True")
                {
                    inputtokens = prompt;
                    int inputCount = tikToken.Encode(inputtokens).Count;
                    int outputCount = tikToken.Encode(outputtokens).Count;
                    await _financeService.CreateUseLogAndUpadteMoney(_account, aimodel, inputCount, outputCount);
                    break; // 如果返回值为"true",结束循环
                }
                else
                {
                    prompt = ExecuteResult; // 否则将返回值作为新的Prompt继续执行
                    inputtokens = prompt;
                    int inputCount = tikToken.Encode(inputtokens).Count;
                    int outputCount = tikToken.Encode(outputtokens).Count;
                    await _financeService.CreateUseLogAndUpadteMoney(_account, aimodel, inputCount, outputCount);
                }

            }

            var jsonRes = new StringBuilder();
            jsonRes.Append("{");
            jsonRes.Append($"\"{node.Name + node.Id}\":");
            jsonRes.Append("{");
            jsonRes.Append($"\"data\":");
            jsonRes.Append($"\"{airesult}\"");
            jsonRes.Append("}");
            jsonRes.Append("}");
            return jsonRes.ToString();
        }


        private async Task<string> ProcessDALLNode(NodeData node, List<NodeOutput> result)
        {
            // 处理 "DALL" 节点,执行 DALL 代码,返回 JSON 字符串
            DALLData dallData = (DALLData)node.Data;
            var nodeName = node.Name;
            var nodeId = node.Id;
            if (!string.IsNullOrEmpty(_chatId))
            {
                ChatRes chatRes = new ChatRes();
                chatRes.message = $"✍";
                await _hubContext.Clients.Group(_chatId).SendAsync(_senMethod, chatRes);
            }
            string prompt = FillScriptWithValues(dallData.Output.Prompt, result);
            //获取DALLE3的apikey和baseurl
            var aiModel = _context.AIdraws.AsNoTracking().Where(x => x.ModelName == "DALLE3").FirstOrDefault();
            if (aiModel == null)
                throw new Exception("系统未配置DALLE3模型");
            string airesult = string.Empty;
            int retryCount = dallData.Output.Retry; // 重试次数
            int initialRetryCount = retryCount;
            do
            {
                airesult = await _aiServer.CreateDALLdraw(prompt, dallData.Output.Size, dallData.Output.Quality, aiModel.BaseUrl, aiModel.ApiKey);
                if (!string.IsNullOrEmpty(airesult)) break; // 如果结果非空，退出循环
                if (!string.IsNullOrEmpty(_chatId) && retryCount > 0)
                {
                    // 计算剩余重试次数
                    int remainingRetries = retryCount - 1;
                    string retryMessage = $"🔄 DALLE3重试 {initialRetryCount - remainingRetries}/{initialRetryCount}...";

                    await _hubContext.Clients.Group(_chatId).SendAsync(_senMethod, new ChatRes { message = retryMessage });
                }
                await Task.Delay(500);
            } while (--retryCount >= 0);

            // 如果在重试结束后结果仍为空，则抛出异常
            if (string.IsNullOrEmpty(airesult))
            {
                string failMessage = "❌ 重试失败。DALLE3绘图失败，工作流中断，请重试";
                if (!string.IsNullOrEmpty(_chatId))
                {
                    await _hubContext.Clients.Group(_chatId).SendAsync(_senMethod, new ChatRes { message = failMessage });
                }
                throw new Exception(failMessage);
            }
            var jsonBuilder = new StringBuilder();
            jsonBuilder.Append("{");
            jsonBuilder.Append($"\"{node.Name + node.Id}\":");
            jsonBuilder.Append("{");
            jsonBuilder.Append($"\"data\":");
            jsonBuilder.Append($"\"{airesult}\"");
            jsonBuilder.Append("}");
            jsonBuilder.Append("}");
            _workFlowChargings.Add(new WorkFlowCharging { Account = _account, ModelName = "DALLE3", InputCount = 0, OutputCount = 0, IsDraw = true });

            // 在后台启动一个任务下载图片
            string newFileName = DateTime.Now.ToString("yyyyMMdd") + "-" + Guid.NewGuid().ToString().Replace("-", "");
            string imgResPath = Path.Combine("/files/dallres", _account, newFileName + ".png");
            Task.Run(async () =>
            {
                using (var scope = _serviceProvider.CreateScope()) // _serviceProvider 是 IServiceProvider 的一个实例。
                {
                    // 这里做一些后续处理，比如更新数据库记录等
                    string savePath = Path.Combine("wwwroot", "files/dallres", _account);
                    await _aiServer.DownloadImageAsync(airesult, savePath, newFileName);
                    var aiSaveService = scope.ServiceProvider.GetRequiredService<IAiServer>(); // 假设保存记录方法在IAiSaveService中。
                    await aiSaveService.SaveAiDrawResult(_account, "DALLE3", imgResPath, "workflow_Engine", "workflow_Engine");
                }
            });
            return jsonBuilder.ToString();
        }

        private async Task<string> ProcessDALLsmNode(NodeData node, List<NodeOutput> result)
        {
            // 处理 "DALL" 节点,执行 DALL 代码,返回 JSON 字符串
            DALLsmData dallsmData = (DALLsmData)node.Data;
            var nodeName = node.Name;
            var nodeId = node.Id;
            if (!string.IsNullOrEmpty(_chatId))
            {
                ChatRes chatRes = new ChatRes();
                chatRes.message = $"✍";
                await _hubContext.Clients.Group(_chatId).SendAsync(_senMethod, chatRes);
            }
            string prompt = FillScriptWithValues(dallsmData.Output.Prompt, result);
            //获取DALLE3的apikey和baseurl
            var aiModel = _context.AIdraws.AsNoTracking().Where(x => x.ModelName == "DALLE2").FirstOrDefault();
            if (aiModel == null)
                throw new Exception("系统未配置DALLE2模型");
            string airesult = string.Empty;
            int retryCount = dallsmData.Output.Retry; // 重试次数
            int initialRetryCount = retryCount;
            do
            {
                airesult = await _aiServer.CreateDALLE2draw(prompt, "1024x1024", aiModel.BaseUrl, aiModel.ApiKey, 1);
                if (!string.IsNullOrEmpty(airesult)) break; // 如果结果非空，退出循环
                if (!string.IsNullOrEmpty(_chatId) && retryCount > 0)
                {
                    // 计算剩余重试次数
                    int remainingRetries = retryCount - 1;
                    string retryMessage = $"🔄 DALLE2重试 {initialRetryCount - remainingRetries}/{initialRetryCount}...";

                    await _hubContext.Clients.Group(_chatId).SendAsync(_senMethod, new ChatRes { message = retryMessage });
                }
                await Task.Delay(500);
            } while (--retryCount >= 0);

            // 如果在重试结束后结果仍为空，则抛出异常
            if (string.IsNullOrEmpty(airesult))
            {
                string failMessage = "❌ 重试失败。DALLE2绘图失败，工作流中断，请重试";
                if (!string.IsNullOrEmpty(_chatId))
                {
                    await _hubContext.Clients.Group(_chatId).SendAsync(_senMethod, new ChatRes { message = failMessage });
                }
                throw new Exception(failMessage);
            }
            var jsonBuilder = new StringBuilder();
            jsonBuilder.Append("{");
            jsonBuilder.Append($"\"{node.Name + node.Id}\":");
            jsonBuilder.Append("{");
            jsonBuilder.Append($"\"data\":");
            jsonBuilder.Append($"\"{airesult}\"");
            jsonBuilder.Append("}");
            jsonBuilder.Append("}");
            _workFlowChargings.Add(new WorkFlowCharging { Account = _account, ModelName = "DALLE2", InputCount = 0, OutputCount = 0, IsDraw = true });
            // 在后台启动一个任务下载图片
            string newFileName = DateTime.Now.ToString("yyyyMMdd") + "-" + Guid.NewGuid().ToString().Replace("-", "");
            string imgResPath = Path.Combine("/files/dallres", _account, newFileName + ".png");
            Task.Run(async () =>
            {
                using (var scope = _serviceProvider.CreateScope()) // _serviceProvider 是 IServiceProvider 的一个实例。
                {
                    // 这里做一些后续处理，比如更新数据库记录等
                    string savePath = Path.Combine("wwwroot", "files/dallres", _account);
                    await _aiServer.DownloadImageAsync(airesult, savePath, newFileName);
                    var aiSaveService = scope.ServiceProvider.GetRequiredService<IAiServer>(); // 假设保存记录方法在IAiSaveService中。
                    await aiSaveService.SaveAiDrawResult(_account, "DALLE2", imgResPath, "workflow_Engine", "workflow_Engine");
                }
            });
            return jsonBuilder.ToString();
        }

        private async Task<string> ProcessWebNode(NodeData node, List<NodeOutput> result)
        {
            // 处理 "web" 节点,执行 web 代码,返回 JSON 字符串
            WebData webData = (WebData)node.Data;
            string prompt = FillScriptWithValues(webData.Output.Prompt, result);
            var nodeName = node.Name;
            var nodeId = node.Id;
            if (!string.IsNullOrEmpty(_chatId))
            {
                ChatRes chatRes = new ChatRes();
                chatRes.message = $"🌐";
                await _hubContext.Clients.Group(_chatId).SendAsync(_senMethod, chatRes);
            }
            List<SystemCfg> systemConfig = _systemService.GetSystemCfgs();
            string googleSearchApiKey = systemConfig.Find(x => x.CfgKey == "GoogleSearchApiKey").CfgValue;
            string googleSearchEngineId = systemConfig.Find(x => x.CfgKey == "GoogleSearchEngineId").CfgValue;
            var googleSearch = await _aiServer.GetWebSearchResult(prompt, googleSearchApiKey, googleSearchEngineId);
            if (googleSearch.Count == 0)
                throw new Exception("联网搜索的结果集为空，运行中断，请重试");
            var airesult = new StringBuilder();
            for (int i = 0; i < googleSearch.Count; i++)
            {
                airesult.AppendLine($"# {i + 1}:标题：{googleSearch[i].Title}");
                airesult.AppendLine($"# 链接地址：{googleSearch[i].Link}");
                airesult.AppendLine($"# 摘要：{googleSearch[i].Snippet}");
                airesult.AppendLine();
            }

            var data = $@"I will give you a question or an instruction. Your objective is to answer my question or fulfill my instruction.

                        My question or instruction is: {prompt}

                        For your reference, today's date is {DateTime.Now.ToString()} in Beijing.

                        It's possible that the question or instruction, or just a portion of it, requires relevant information from the internet to give a satisfactory answer or complete the task. Therefore, provided below is the necessary information obtained from the internet, which sets the context for addressing the question or fulfilling the instruction. You will write a comprehensive reply to the given question or instruction. Do not include urls and sources in the summary text. If the provided information from the internet results refers to multiple subjects with the same name, write separate answers for each subject:
                        {airesult}
                        Reply in 中文";

            var jsonObject = new Dictionary<string, object>
            {
                [node.Name + node.Id] = new { data }
            };

            return System.Text.Json.JsonSerializer.Serialize(jsonObject);
        }

        private string ProcessEndNode(NodeData node, List<NodeOutput> result)
        {
            // 处理 "end" 节点,根据 "endaction" 执行相应操作,返回 JSON 字符串
            EndData endData = (EndData)node.Data;
            string type = endData.Output.EndAction;
            string jsData = FillScriptWithValues(endData.Output.EndScript, result);
            var nodeName = node.Name;
            if (type != "js")
            {
                //初始化JavaScript引擎
                IServiceCollection services = new ServiceCollection();
                services.AddJsEngineSwitcher(options => options.DefaultEngineName = ChakraCoreJsEngine.EngineName)
                        .AddChakraCore();

                IServiceProvider serviceProvider = services.BuildServiceProvider();
                IJsEngineSwitcher jsEngineSwitcher = serviceProvider.GetRequiredService<IJsEngineSwitcher>();

                IJsEngine jsEngine = jsEngineSwitcher.CreateDefaultEngine();
                //执行JavaScript代码
                jsEngine.Execute(jsData);
                return jsEngine.CallFunction<string>(nodeName);
            }
            return jsData;
        }


        public static string ExtractValueFromPath(string path, string thisJson)
        {
            if (!string.IsNullOrEmpty(thisJson))
            {
                try
                {
                    var json = JObject.Parse(thisJson);
                    var segments = path.Replace("this.", "").Split('.');

                    JToken currentToken = json;
                    foreach (var segment in segments)
                    {
                        currentToken = currentToken[segment];
                        if (currentToken == null)
                        {
                            break;
                        }
                    }

                    // 如果找到了对应的值,返回它
                    if (currentToken != null)
                    {
                        return currentToken.ToString();
                    }
                }
                catch (Exception ex)
                {
                    // 如果在处理JSON时发生错误,可能是JSON格式不正确
                    // 这里可根据需要记录或处理异常
                    Console.WriteLine($"Error processing JSON for thisJson. Error: {ex.Message}");
                }
            }

            // 如果没有找到任何匹配的路径,则抛出异常
            throw new Exception($"Value for path '{path}' not found in thisJson.");
        }

        public static string ExtractValueFromPath(string path, List<NodeOutput> results)
        {
            foreach (var result in results)
            {
                try
                {
                    var json = JObject.Parse(result.OutputData);
                    var token = json.SelectToken(path);  // 使用SelectToken提取路径对应的值

                    // 如果找到了对应的值,返回它
                    if (token != null)
                    {
                        return token.ToString();
                    }
                }
                catch (Exception ex)
                {
                    // 如果在处理JSON时发生错误,可能是JSON格式不正确
                    // 这里可根据需要记录或处理异常
                    Console.WriteLine($"Error processing JSON for NodeName: {result.NodeName}. Error: {ex.Message}");
                }
            }

            // 如果没有找到任何匹配的路径,则抛出异常
            throw new Exception($"Value for path '{path}' not found in any NodeOutput.");
        }

        private static string FillScriptWithValues(string script, List<NodeOutput> results, string thisJson = null)
        {
            // 查找脚本中所有的占位符
            var placeholders = System.Text.RegularExpressions.Regex.Matches(script, @"\{\{([^}]+)\}\}");

            // 对于每个占位符,根据不同情况从thisJson或NodeOutput中提取相应的值并替换
            foreach (System.Text.RegularExpressions.Match match in placeholders)
            {
                // 获取占位符中的路径
                string path = match.Groups[1].Value;
                // 调用不同的函数获取路径对应的值
                try
                {
                    string value;
                    if (path.StartsWith("this."))
                    {
                        value = ExtractValueFromPath(path, thisJson);
                    }
                    else
                    {
                        value = ExtractValueFromPath(path, results);
                    }
                    // 替换脚本中的占位符为实际值
                    script = script.Replace(match.Value, value);
                }
                catch (Exception ex)
                {
                    // 处理未找到路径的情况
                    Console.WriteLine($"Error: {ex.Message}");
                }
            }
            return script;
        }

        private static string BuilderJson(string nodeName, string result)
        {
            try
            {
                JObject json = new JObject();
                json[nodeName] = JObject.Parse(result);
                return json.ToString();
            }
            catch (Exception)
            {
                throw new Exception($"结果集中出现了一个非Json格式的异常，位置：{nodeName}");
            }
        }
    }
}
