using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using JavaScriptEngineSwitcher.ChakraCore;
using JavaScriptEngineSwitcher.Core;
using JavaScriptEngineSwitcher.Extensions.MsDependencyInjection;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using TiktokenSharp;
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
        private readonly IServiceProvider _serviceProvider;
        public WorkflowEngine(WorkFlowNodeData workflowData, IAiServer aiServer, ISystemService systemService, IFinanceService financeService, AIBotProContext context, string account, IServiceProvider serviceProvider)
        {
            _workflowData = workflowData;
            _aiServer = aiServer;
            _systemService = systemService;
            _financeService = financeService;
            _context = context;
            _account = account;
            _serviceProvider = serviceProvider;
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

            void UpdateNodeLevel(NodeData currentNode, int currentLevel)
            {
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
                            UpdateNodeLevel(nextNode, currentLevel + 1);
                        }
                    }
                }
            }

            // 首先确定所有节点的最大层级
            UpdateNodeLevel(node, seq);

            // 根据节点最大层级构建层级结构
            void RecursiveBuild(NodeData currentNode, int currentSeq)
            {
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
                            RecursiveBuild(nextNode, nodeLevel + 1); // 递归构建时考虑正确的层级
                        }
                    }
                }
            }

            // 构建层级结构
            RecursiveBuild(node, 0);

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

        //private async Task<List<NodeOutput>> ExecuteFlow(List<WorkFlowNodeBuild> builds, string startNodeOutput)
        //{
        //    List<NodeOutput> result = new List<NodeOutput>();
        //    //把builds按照seq排序
        //    builds = builds.OrderBy(x => x.Seq).ToList();
        //    //把startNodeOutput添加到result
        //    result.Add(new NodeOutput { NodeName = "start", OutputData = startNodeOutput });
        //    //移除builds中的start元素
        //    builds.RemoveAt(0);
        //    //遍历builds
        //    foreach (var build in builds)
        //    {
        //        foreach (var node in build.Nodes)
        //        {
        //            result.Add(await ExecuteNode(node, result));
        //        }
        //    }
        //    return result;
        //}
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
                    nodeOutput.OutputData = ProcessJavaScriptNode(node, result);
                    break;
                case "http":
                    nodeOutput.OutputData = ProcessHttpNode(node, result);
                    break;
                case "LLM":
                    nodeOutput.OutputData = await ProcessLLMNode(node, result);
                    break;
                case "DALL":
                    nodeOutput.OutputData = await ProcessDALLNode(node, result);
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

        private string ProcessJavaScriptNode(NodeData node, List<NodeOutput> result)
        {
            //获取javascript节点的脚本内容
            var jsData = (JavaScriptData)node.Data;
            //替换脚本中的变量
            jsData.Output.JavaScript = FillScriptWithValues(jsData.Output.JavaScript, result);
            var nodeName = node.Name;
            var nodeId = node.Id;
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

        private string ProcessHttpNode(NodeData node, List<NodeOutput> result)
        {
            // 处理 "http" 节点,执行 HTTP 请求,返回 JSON 字符串
            HttpData httpData = (HttpData)node.Data;
            string type = httpData.Output.Type;
            string url = httpData.Output.RequestUrl;
            string body = string.Empty;
            var nodeName = node.Name;
            var nodeId = node.Id;
            Dictionary<string, string> parameters = new Dictionary<string, string>();
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
            string aimodel = llmData.Output.AiModel;
            string prompt = FillScriptWithValues(llmData.Output.Prompt, result);
            string airesult = await _aiServer.CallingAINotStream(prompt, aimodel);
            if (string.IsNullOrEmpty(airesult))
                throw new Exception("LLM处理数据时回复为空，工作流中断，请重试");
            var jsonBuilder = new StringBuilder();
            jsonBuilder.Append("{");
            jsonBuilder.Append($"\"{node.Name + node.Id}\":");
            jsonBuilder.Append("{");
            jsonBuilder.Append($"\"data\":");
            jsonBuilder.Append($"\"{airesult}\"");
            jsonBuilder.Append("}");
            jsonBuilder.Append("}");
            TikToken tikToken = TikToken.GetEncoding("cl100k_base");
            int inputCount = tikToken.Encode(prompt).Count;
            int outputCount = tikToken.Encode(airesult).Count;
            await _financeService.CreateUseLogAndUpadteMoney(_account, aimodel, inputCount, outputCount);
            return jsonBuilder.ToString();
        }

        private async Task<string> ProcessDALLNode(NodeData node, List<NodeOutput> result)
        {
            // 处理 "DALL" 节点,执行 DALL 代码,返回 JSON 字符串
            DALLData dallData = (DALLData)node.Data;
            string prompt = FillScriptWithValues(dallData.Output.Prompt, result);
            //获取DALLE3的apikey和baseurl
            var aiModel = _context.AIdraws.AsNoTracking().Where(x => x.ModelName == "DALLE3").FirstOrDefault();
            if (aiModel == null)
                throw new Exception("系统未配置DALLE3模型");
            string airesult = await _aiServer.CreateDALLdraw(prompt, "1024x1024", "standard", aiModel.BaseUrl, aiModel.ApiKey);
            if (string.IsNullOrEmpty(airesult))
                throw new Exception("DALLE3绘图失败");
            var jsonBuilder = new StringBuilder();
            jsonBuilder.Append("{");
            jsonBuilder.Append($"\"{node.Name + node.Id}\":");
            jsonBuilder.Append("{");
            jsonBuilder.Append($"\"data\":");
            jsonBuilder.Append($"\"{airesult}\"");
            jsonBuilder.Append("}");
            jsonBuilder.Append("}");
            await _financeService.CreateUseLogAndUpadteMoney(_account, "DALLE3", 0, 0, true);
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

        private async Task<string> ProcessWebNode(NodeData node, List<NodeOutput> result)
        {
            // 处理 "web" 节点,执行 web 代码,返回 JSON 字符串
            WebData webData = (WebData)node.Data;
            string prompt = FillScriptWithValues(webData.Output.Prompt, result);
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


        public static string ExtractValueFromPath(string path, List<NodeOutput> results)
        {
            foreach (var result in results)
            {
                try
                {
                    var json = JObject.Parse(result.OutputData);
                    var token = json.SelectToken(path);  // 使用SelectToken提取路径对应的值

                    // 如果找到了对应的值，返回它
                    if (token != null)
                    {
                        return token.ToString();
                    }
                }
                catch (Exception ex)
                {
                    // 如果在处理JSON时发生错误，可能是JSON格式不正确
                    // 这里可根据需要记录或处理异常
                    Console.WriteLine($"Error processing JSON for NodeName: {result.NodeName}. Error: {ex.Message}");
                }
            }

            // 如果没有找到任何匹配的路径，则抛出异常
            throw new Exception($"Value for path '{path}' not found in any NodeOutput.");
        }
        private static string FillScriptWithValues(string script, List<NodeOutput> results)
        {
            // 查找脚本中所有的占位符
            var placeholders = System.Text.RegularExpressions.Regex.Matches(script, @"\{\{([^}]+)\}\}");

            // 对于每个占位符，从NodeOutput中提取相应的值并替换
            foreach (System.Text.RegularExpressions.Match match in placeholders)
            {
                // 获取占位符中的路径
                string path = match.Groups[1].Value;
                // 调用通用函数获取路径对应的值
                try
                {
                    string value = ExtractValueFromPath(path, results);
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
