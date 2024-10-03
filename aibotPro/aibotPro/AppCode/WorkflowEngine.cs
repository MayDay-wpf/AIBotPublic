using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using iTextSharp.text;
using iTextSharp.text.pdf.qrcode;
using JavaScriptEngineSwitcher.ChakraCore;
using JavaScriptEngineSwitcher.Core;
using JavaScriptEngineSwitcher.Extensions.MsDependencyInjection;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Spire.Doc;
using Spire.Presentation;
using Spire.Presentation.Charts;
using StackExchange.Redis;
using System;
using System.Diagnostics;
using System.Net.Mail;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using TiktokenSharp;
using static iTextSharp.text.pdf.AcroFields;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory;
using CSScriptLib;

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
        private readonly IRedisService _redisService;
        private readonly IMilvusService _milvusService;
        private readonly ICOSService _cossService;
        private static int _checkCount;
        private readonly IBaiduService _baiduService;
        private Dictionary<string, int> _nodeCheckCounts = new Dictionary<string, int>();
        private readonly CancellationToken _cancellationToken;

        public WorkflowEngine(WorkFlowNodeData workflowData, IAiServer aiServer, ISystemService systemService,
            IFinanceService financeService, AIBotProContext context, string account, IServiceProvider serviceProvider,
            IHubContext<ChatHub> hubContext, string chatId, string senMethod, IRedisService redisService,
            IMilvusService milvusService, int checkCount, ICOSService cossService, IBaiduService baiduService,
            [EnumeratorCancellation] CancellationToken cancellationToken)
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
            _redisService = redisService;
            _milvusService = milvusService;
            _checkCount = checkCount;
            _cossService = cossService;
            _baiduService = baiduService;
            _cancellationToken = cancellationToken;
        }

        public async Task<List<NodeOutput>> Execute(string startNodeOutput)
        {
            var startNode = _workflowData.Drawflow.Home.Data.Values.FirstOrDefault(x => x.Name == "start");
            var processedNodes = new HashSet<string>();
            return await ExecuteFlow(startNodeOutput);
        }

        private async Task<List<NodeOutput>> ExecuteFlow(string startNodeOutput)
        {
            List<NodeOutput> result = new List<NodeOutput>();
            result.Add(new NodeOutput { NodeName = "start", OutputData = startNodeOutput });
            List<NodeData> nextNodes = new List<NodeData>();
            var startNode = _workflowData.Drawflow.Home.Data.Values.FirstOrDefault(x => x.Name == "start");
            nextNodes.Add(startNode);
            while (nextNodes.Count != 0)
            {
                var tasks = nextNodes.Select(node => ExecuteNode(node, result)).ToArray();
                // 等待这个build中所有node的处理完成
                var nodeOutputs = await Task.WhenAll(tasks);
                // 添加到总结果中 
                if (nodeOutputs.Count() > 0)
                {
                    foreach (var nodeOutput in nodeOutputs)
                    {
                        if (!string.IsNullOrEmpty(nodeOutput.OutputData))
                        {
                            // 查找是否已经有相同NodeName的NodeOutput
                            var existingItem = result.FirstOrDefault(no => no.NodeName == nodeOutput.NodeName);

                            if (existingItem != null)
                            {
                                // 如果存在，替换旧的NodeOutput
                                int index = result.IndexOf(existingItem);
                                result[index] = nodeOutput;
                            }
                            else
                            {
                                // 如果不存在，添加新的NodeOutput到列表
                                result.Add(nodeOutput);
                            }
                        }
                    }
                }

                nextNodes = new List<NodeData>();
                foreach (var nodeOutput in nodeOutputs)
                {
                    foreach (var nextNode in nodeOutput.NextNodes)
                    {
                        if (!nextNodes.Contains(nextNode))
                        {
                            nextNodes.Add(nextNode);
                        }
                    }
                }
            }

            foreach (var item in _workFlowChargings)
            {
                await _financeService.CreateUseLogAndUpadteMoney(item.Account, item.ModelName, item.InputCount,
                    item.OutputCount, item.IsDraw);
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
                case "start":
                    nodeOutput = await ProcessStartNode(node, result);
                    break;
                case "javascript":
                    nodeOutput = await ProcessJavaScriptNode(node, result);
                    break;
                case "csharp":
                    nodeOutput = await ProcessCsharpNode(node, result);
                    break;
                case "http":
                    nodeOutput = await ProcessHttpNode(node, result);
                    break;
                case "LLM":
                    nodeOutput = await ProcessLLMNode(node, result);
                    break;
                case "DALL":
                    nodeOutput = await ProcessDALLNode(node, result);
                    break;
                /*case "DALLsm":
                    nodeOutput = await ProcessDALLsmNode(node, result);
                    break;*/
                case "downloadimg":
                    nodeOutput = await ProcessDownLoadImgNode(node, result);
                    break;
                case "web":
                    nodeOutput = await ProcessWebNode(node, result);
                    break;
                case "ifelse":
                    nodeOutput = await ProcessIfElseNode(node, result);
                    break;
                case "knowledge":
                    nodeOutput = await ProcessKonwledgeNode(node, result);
                    break;
                case "debug":
                    nodeOutput = await ProcessDebugNode(node, result);
                    break;
                case "end":
                    nodeOutput = await ProcessEndNode(node, result);
                    break;
                default:
                    throw new InvalidOperationException($"Unsupported node type: {nodeName}");
            }


            return nodeOutput;
        }

        private List<NodeData> FindNextNode(Dictionary<string, NodeConnection> nodeOutput)
        {
            List<NodeData> nextNodes = new List<NodeData>();
            List<int> nodeIds = new List<int>();
            foreach (var item in nodeOutput)
            {
                foreach (var items in item.Value.Connections)
                {
                    nodeIds.Add(Convert.ToInt32(items.Node));
                }
            }

            foreach (var item in nodeIds)
            {
                var nextnode = _workflowData.Drawflow.Home.Data.Values.Where(x => x.Id == item).FirstOrDefault();
                nextNodes.Add(nextnode);
            }

            return nextNodes;
        }

        private string RunScript(string functionName, string javaScript)
        {
            //初始化JavaScript引擎
            IServiceCollection services = new ServiceCollection();
            services.AddJsEngineSwitcher(options => options.DefaultEngineName = ChakraCoreJsEngine.EngineName)
                .AddChakraCore();

            IServiceProvider serviceProvider = services.BuildServiceProvider();
            IJsEngineSwitcher jsEngineSwitcher = serviceProvider.GetRequiredService<IJsEngineSwitcher>();

            IJsEngine jsEngine = jsEngineSwitcher.CreateDefaultEngine();
            //执行JavaScript代码
            jsEngine.Execute(javaScript);
            string executeResult = jsEngine.CallFunction<string>(functionName);
            return executeResult;
        }

        private async Task<NodeOutput> ProcessStartNode(NodeData node, List<NodeOutput> result)
        {
            NodeOutput nodeOutput = new NodeOutput();
            nodeOutput.NodeName = node.Name + node.Id;
            nodeOutput.NextNodes = FindNextNode(node.Outputs);
            //查找下一个节点
            return nodeOutput;
        }

        private async Task<NodeOutput> ProcessJavaScriptNode(NodeData node, List<NodeOutput> result)
        {
            var nodeKey = node.Name + node.Id;
            if (!_nodeCheckCounts.ContainsKey(nodeKey))
            {
                _nodeCheckCounts[nodeKey] = _checkCount;
            }

            if (_nodeCheckCounts[nodeKey] <= 0)
            {
                throw new Exception($"节点 {nodeKey} 的运行次数超出系统设定的极限, 触发流程引擎死循环保护, 请修正您的 WorkFlow");
            }

            NodeOutput nodeOutput = new NodeOutput();
            //获取javascript节点的脚本内容
            var jsData = (JavaScriptData)node.Data;
            //替换脚本中的变量
            jsData.Output.JavaScript = FillScriptWithValues(jsData.Output.JavaScript, result);
            string prompt =
                $@"# Carefully analyze the following JavaScript code to determine if there are any infinite loops:

                   **Guidelines**:
                   
                   * Examine all loop structures (while, for, do-while, etc.).
                   * Analyze loop conditions and the code within loop bodies.
                   * Determine if there are explicit, guaranteed-to-be-reached exit conditions.
                   * Be aware of edge cases or data type limitations that might cause loops to never terminate.
                   * Don't be misled by comments or seemingly reasonable code structures.
                   * Consider all possible execution paths, including exception handling.
                   
                   **Result Requirements**:
                   
                   * Return true if there's any scenario that could lead to an infinite loop.
                   * Return false if all loops have clear and guaranteed-to-be-reached exit conditions.
                   * Provide your reasoning for the judgment.
                   
                   # Code:
                   
                   ```javascript
                   {jsData.Output.JavaScript}
                   ```";

            var (isValid, reason) = await AICodeCheck(prompt);
            if (isValid)
            {
                throw new Exception($"节点 {nodeKey}:{reason}");
            }

            string ExecuteResult = RunScript(nodeKey, jsData.Output.JavaScript);
            nodeOutput.NodeName = nodeKey;
            nodeOutput.OutputData = BuilderJson(nodeKey, ExecuteResult);
            nodeOutput.NextNodes = FindNextNode(node.Outputs);
            _nodeCheckCounts[nodeKey]--;
            return nodeOutput;
        }

        private async Task<NodeOutput> ProcessCsharpNode(NodeData node, List<NodeOutput> result)
        {
            var nodeKey = node.Name + node.Id;
            if (!_nodeCheckCounts.ContainsKey(nodeKey))
            {
                _nodeCheckCounts[nodeKey] = _checkCount;
            }

            if (_nodeCheckCounts[nodeKey] <= 0)
            {
                throw new Exception($"节点 {nodeKey} 的运行次数超出系统设定的极限, 触发流程引擎死循环保护, 请修正您的 WorkFlow");
            }

            NodeOutput nodeOutput = new NodeOutput();
            //获取csharp节点的脚本内容
            var csData = (CsharpData)node.Data;
            //替换脚本中的变量
            csData.Output.Csharp = FillScriptWithValues(csData.Output.Csharp, result);

            string prompt =
                $@"# Carefully analyze the following C# code to determine if there are any infinite loops:

                   **Guidelines**:
   
                   * Examine all loop structures (while, for, do-while, etc.).
                   * Analyze loop conditions and the code within loop bodies.
                   * Determine if there are explicit, guaranteed-to-be-reached exit conditions.
                   * Be aware of edge cases or data type limitations that might cause loops to never terminate.
                   * Don't be misled by comments or seemingly reasonable code structures.
                   * Consider all possible execution paths, including exception handling.
                   * Evaluate whether loops will end within a reasonable time (about 30 seconds). HTTP request code is not within the scope of consideration, as HTTP request times are not stable.
                   * Analyze changes in loop variables to ensure they're moving towards termination conditions.
   
                   **Result Requirements**:
   
                   * Return true if there's any scenario that could lead to an infinite loop or a loop running for an excessively long time (over 30 seconds).
                   * Return false if all loops have clear and guaranteed-to-be-reached exit conditions and can finish within a reasonable time.
                   * Provide a concise explanation for your judgment, explaining your analysis process and conclusions.
   
                   # Code:
                   
                   ```csharp
                   {csData.Output.Csharp}
                   ```";

            var (isValid, reason) = await AICodeCheck(prompt);
            if (isValid)
            {
                throw new Exception($"节点 {nodeKey}:{reason}");
            }

            string ExecuteResult = "Not have Data";
            try
            {
                Assembly asm = null;
                try
                {
                    asm = CSScript.Evaluator.CompileCode(csData.Output.Csharp);
                }
                catch (Exception ex)
                {
                    ExecuteResult = $"Compilation failed: {ex.Message}";
                    throw new Exception(ExecuteResult);
                }

                var scriptType = asm.GetTypes().FirstOrDefault(t => t.FullName.EndsWith("Script"));
                if (scriptType == null)
                {
                    ExecuteResult = "Class 'Script' not found in the compiled assembly.";
                    throw new Exception(ExecuteResult);
                }

                var executeMethod = scriptType.GetMethod("Main",
                    System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);

                if (executeMethod != null)
                {
                    // 检查方法参数
                    var parameters = executeMethod.GetParameters();
                    if (parameters.Length == 0)
                    {
                        ExecuteResult = (string)executeMethod.Invoke(null, null);
                    }
                    else if (parameters.Length > 0)
                    {
                        var parameterValues = new List<object>();
                        foreach (var param in parameters)
                        {
                            var matchingItem = csData.Output.PrItems.FirstOrDefault(item => item.PrName == param.Name);
                            if (matchingItem != null)
                            {
                                object paramValue = ConvertParameter(matchingItem.PrConst, matchingItem.PrType, result);
                                parameterValues.Add(paramValue);
                            }
                            else
                            {
                                // 如果没有找到匹配的参数，添加默认值或者null
                                parameterValues.Add(param.ParameterType.IsValueType
                                    ? Activator.CreateInstance(param.ParameterType)
                                    : null);
                            }
                        }

                        ExecuteResult = (string)executeMethod.Invoke(null, parameterValues.ToArray());
                    }
                    else
                    {
                        ExecuteResult = "Main method has unexpected parameters.";
                        throw new Exception(ExecuteResult);
                    }
                }
                else
                {
                    ExecuteResult = "Method 'Main' not found in Script class";
                    throw new Exception(ExecuteResult);
                }
            }
            catch (Exception ex)
            {
                ExecuteResult = $"An error occurred: {ex.Message}\n\nStack Trace: {ex.StackTrace}";
                if (ex.InnerException != null)
                {
                    ExecuteResult +=
                        $"\n\nInner Exception: {ex.InnerException.Message}\n\nInner Stack Trace: {ex.InnerException.StackTrace}";
                }

                throw new Exception(ExecuteResult);
            }

            nodeOutput.NodeName = nodeKey;
            nodeOutput.OutputData = BuilderJson(nodeKey, ExecuteResult.ToString());
            nodeOutput.NextNodes = FindNextNode(node.Outputs);
            _nodeCheckCounts[nodeKey]--;
            return nodeOutput;
        }

        private object ConvertParameter(string value, string type, List<NodeOutput> result)
        {
            try
            {
                value = FillScriptWithValues(value, result);
                switch (type.ToLower())
                {
                    case "string":
                        return value;
                    case "json":
                        return ProcessJsonString(value);
                    case "int":
                        return int.Parse(value);
                    case "bool":
                        return bool.Parse(value);
                    case "decimal":
                        return decimal.Parse(value);
                    default:
                        throw new NotSupportedException($"Unsupported parameter type: {type}");
                }
            }
            catch (Exception e)
            {
                throw new Exception($"Error converting parameter: {e.Message}");
            }
        }

        private static string ProcessJsonString(string jsonString)
        {
            jsonString = jsonString.Replace("\\n", "\n").Replace("\\t", "\t").Replace("\\r", "\r").Replace("\\\"", "\"");
            return jsonString;
        }
        private async Task<NodeOutput> ProcessHttpNode(NodeData node, List<NodeOutput> result)
        {
            var nodeKey = node.Name + node.Id;
            if (!_nodeCheckCounts.ContainsKey(nodeKey))
            {
                _nodeCheckCounts[nodeKey] = _checkCount;
            }

            if (_nodeCheckCounts[nodeKey] <= 0)
            {
                throw new Exception($"节点 {nodeKey} 的运行次数超出系统设定的极限, 触发流程引擎死循环保护, 请修正您的 WorkFlow");
            }

            NodeOutput nodeOutput = new NodeOutput();
            // 处理 "http" 节点,执行 HTTP 请求,返回 JSON 字符串
            HttpData httpData = (HttpData)node.Data;
            string type = httpData.Output.Type;
            string url = FillScriptWithValues(httpData.Output.RequestUrl, result);
            string body = string.Empty;
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
                    headers.Add(itemHd.HdKey, itemHd.HdValue);
                }
            }

            if (httpData.Output.CookiesItems.Count > 0)
            {
                foreach (var itemCk in httpData.Output.CookiesItems)
                {
                    cookies.Add(itemCk.CkKey, itemCk.CkValue);
                }
            }

            string httpResult = string.Empty;
            int maxcount = httpData.Output.HttpMaxcount;
            int httpdelayed = httpData.Output.HttpDelayed;
            while (true)
            {
                if (maxcount < 0)
                    throw new Exception($"{nodeKey}循环次数已超出允许的最大次数");
                maxcount--;
                string httpScript = httpData.Output.JudgeScript;
                httpResult = await Task.Run(async () =>
                {
                    string httpresult = string.Empty;
                    if (type == "get")
                    {
                        httpresult = _aiServer.AiGet(url, parameters, headers, cookies);
                    }
                    else
                    {
                        httpresult = _aiServer.AiPost(url, parameters, headers, cookies, body);
                    }

                    return httpresult;
                });
                httpScript = FillScriptWithValues(httpScript, result, BuilderJson(nodeKey, httpResult));
                string ExecuteResult = RunScript(nodeKey, httpScript);
                if (ExecuteResult == "True")
                {
                    break; // 如果返回值为"true",结束循环
                }
                else if (ExecuteResult != "False" && !string.IsNullOrEmpty(_chatId))
                {
                    ChatRes chatRes = new ChatRes();
                    chatRes.message = ExecuteResult;
                    await _hubContext.Clients.Group(_chatId).SendAsync(_senMethod, chatRes);
                }

                Thread.Sleep(httpdelayed);
            }

            nodeOutput.NodeName = nodeKey;
            nodeOutput.OutputData = BuilderJson(nodeKey, httpResult);
            nodeOutput.NextNodes = FindNextNode(node.Outputs);
            _nodeCheckCounts[nodeKey]--;
            return nodeOutput;
        }

        private async Task<NodeOutput> ProcessLLMNode(NodeData node, List<NodeOutput> result)
        {
            var nodeKey = node.Name + node.Id;
            if (!_nodeCheckCounts.ContainsKey(nodeKey))
            {
                _nodeCheckCounts[nodeKey] = _checkCount;
            }

            if (_nodeCheckCounts[nodeKey] <= 0)
            {
                throw new Exception($"节点 {nodeKey} 的运行次数超出系统设定的极限, 触发流程引擎死循环保护, 请修正您的 WorkFlow");
            }

            NodeOutput nodeOutput = new NodeOutput();
            // 处理 "LLM" 节点,执行 LLM 代码,返回 JSON 字符串
            LLMData llmData = (LLMData)node.Data;
            TikToken tikToken = TikToken.GetEncoding("cl100k_base");
            string inputtokens = "";
            string outputtokens = "";
            string aimodel = llmData.Output.AiModel;
            string prompt = FillScriptWithValues(llmData.Output.Prompt, result);
            string airesult = string.Empty; // 初始化为空
            int retryCount = llmData.Output.Retry; // 重试次数
            bool stream = llmData.Output.Stream;
            bool jsonModel = llmData.Output.JsonModel;
            bool jsonSchema = llmData.Output.JsonSchema;
            string jsonSchemaInput = llmData.Output.JsonSchemaInput;
            int initialRetryCount = retryCount;
            int maxcount = llmData.Output.LLMMaxcount;
            AiChat aiChat = null;
            VisionBody visionBody = null;
            APISetting apiSetting = _aiServer.CreateAPISetting(aimodel);
            if (!string.IsNullOrEmpty(llmData.Output.ImgUrl))
            {
                string imgurl = FillScriptWithValues(llmData.Output.ImgUrl, result);
                if (apiSetting.IsVisionModel.HasValue && apiSetting.IsVisionModel.Value)
                    visionBody = _aiServer.CreateVisionBody(aimodel, prompt, imgurl, stream, jsonModel, jsonSchema,
                        jsonSchemaInput);
                else
                {
                    string imageData = await _systemService.ImgConvertToBase64(imgurl);
                    string imgTxt = _baiduService.GetText(imageData);
                    string imgRes = _baiduService.GetRes(imageData);
                    prompt = @$"# 要求：请你充当图片内容分析师,回答:{prompt}
                                * 图像中的文字识别结果为：{imgTxt}
                                * 图像中物体和场景识别结果为：{imgRes}";
                    aiChat = _aiServer.CreateAiChat(aimodel, prompt, stream, jsonModel, jsonSchema, jsonSchemaInput);
                }
            }
            else
            {
                aiChat = _aiServer.CreateAiChat(aimodel, prompt, stream, jsonModel, jsonSchema, jsonSchemaInput);
            }

            while (true)
            {
                if (maxcount < 0)
                    throw new Exception($"{nodeKey}循环次数已超出允许的最大次数");
                maxcount--;
                airesult += await Task.Run(async () =>
                {
                    string result = string.Empty;
                    int currentRetryCount = retryCount;

                    do
                    {
                        result = string.Empty;
                        if (!stream || string.IsNullOrEmpty(_chatId))
                        {
                            result = await _aiServer.CallingAINotStream(aiChat, apiSetting, visionBody);
                            if (!jsonModel && !jsonSchema)
                                result = EscapeSpecialCharacters(result);
                            if (!string.IsNullOrEmpty(result))
                            {
                                outputtokens = result;
                                break; // 如果结果非空,退出循环
                            }

                            if (!string.IsNullOrEmpty(_chatId) && currentRetryCount > 0)
                            {
                                // 计算剩余重试次数
                                int remainingRetries = currentRetryCount - 1;
                                string retryMessage =
                                    $"🔄 LLM重试 {initialRetryCount - remainingRetries}/{initialRetryCount}...";

                                await _hubContext.Clients.Group(_chatId)
                                    .SendAsync(_senMethod, new ChatRes { message = retryMessage });
                            }
                        }
                        else
                        {
                            try
                            {
                                await foreach (var responseContent in _aiServer.CallingAI(aiChat, apiSetting, _chatId,
                                                   visionBody, _cancellationToken))
                                {
                                    result += responseContent.Choices[0].Delta.Content;
                                    await _hubContext.Clients.Group(_chatId).SendAsync(_senMethod,
                                        new ChatRes { message = responseContent.Choices[0].Delta.Content });
                                    outputtokens += responseContent.Choices[0].Delta.Content;
                                }

                                await _financeService.UsageSaveRedis(_chatId, _account, "assistant", result,
                                    AIBotProEnum.HashFieldOperationMode.Append);
                                break;
                            }
                            catch (Exception ex)
                            {
                                if (!string.IsNullOrEmpty(_chatId) && currentRetryCount > 0)
                                {
                                    // 计算剩余重试次数
                                    int remainingRetries = currentRetryCount - 1;
                                    string retryMessage =
                                        $"🔄 LLM请求出错,重试 {initialRetryCount - remainingRetries}/{initialRetryCount}...";

                                    await _hubContext.Clients.Group(_chatId).SendAsync(_senMethod,
                                        new ChatRes { message = retryMessage });
                                }

                                await Task.Delay(500); // 延迟一段时间再重试
                                continue; // 继续下一次重试
                            }
                        }

                        await Task.Delay(500);
                    } while (--currentRetryCount >= 0);

                    // 如果在重试结束后结果仍为空,则抛出异常
                    if (string.IsNullOrEmpty(result))
                    {
                        string failMessage = "❌ 重试失败。LLM处理数据时回复为空,工作流中断,请重试";
                        if (!string.IsNullOrEmpty(_chatId))
                        {
                            await _hubContext.Clients.Group(_chatId)
                                .SendAsync(_senMethod, new ChatRes { message = failMessage });
                        }

                        throw new Exception(failMessage);
                    }

                    return result;
                });
                string llmScript = llmData.Output.JudgeScript;
                llmScript = FillScriptWithValues(llmScript, result, BuilderJson(nodeKey, airesult));
                string ExecuteResult = RunScript(nodeKey, llmScript);
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

            nodeOutput.NodeName = nodeKey;
            nodeOutput.OutputData = BuilderJson(nodeKey, airesult);
            nodeOutput.NextNodes = FindNextNode(node.Outputs);
            _nodeCheckCounts[nodeKey]--;
            return nodeOutput;
        }

        private async Task<NodeOutput> ProcessDALLNode(NodeData node, List<NodeOutput> result)
        {
            var nodeKey = node.Name + node.Id;
            if (!_nodeCheckCounts.ContainsKey(nodeKey))
            {
                _nodeCheckCounts[nodeKey] = _checkCount;
            }

            if (_nodeCheckCounts[nodeKey] <= 0)
            {
                throw new Exception($"节点 {nodeKey} 的运行次数超出系统设定的极限, 触发流程引擎死循环保护, 请修正您的 WorkFlow");
            }

            NodeOutput nodeOutput = new NodeOutput();
            // 处理 "DALL" 节点,执行 DALL 代码,返回 JSON 字符串
            DALLData dallData = (DALLData)node.Data;
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
                airesult = await _aiServer.CreateDALLdraw(prompt, dallData.Output.Size, dallData.Output.Quality,
                    aiModel.BaseUrl, aiModel.ApiKey);
                if (!string.IsNullOrEmpty(airesult)) break; // 如果结果非空，退出循环
                if (!string.IsNullOrEmpty(_chatId) && retryCount > 0)
                {
                    // 计算剩余重试次数
                    int remainingRetries = retryCount - 1;
                    string retryMessage = $"🔄 DALLE3重试 {initialRetryCount - remainingRetries}/{initialRetryCount}...";

                    await _hubContext.Clients.Group(_chatId)
                        .SendAsync(_senMethod, new ChatRes { message = retryMessage });
                }

                await Task.Delay(500);
            } while (--retryCount >= 0);

            // 如果在重试结束后结果仍为空，则抛出异常
            if (string.IsNullOrEmpty(airesult))
            {
                string failMessage = "❌ 重试失败。DALLE3绘图失败，工作流中断，请重试";
                if (!string.IsNullOrEmpty(_chatId))
                {
                    await _hubContext.Clients.Group(_chatId)
                        .SendAsync(_senMethod, new ChatRes { message = failMessage });
                }

                throw new Exception(failMessage);
            }

            _workFlowChargings.Add(new WorkFlowCharging
            { Account = _account, ModelName = "DALLE3", InputCount = 0, OutputCount = 0, IsDraw = true });

            // 在后台启动一个任务下载图片
            string newFileName = DateTime.Now.ToString("yyyyMMdd") + "-" + Guid.NewGuid().ToString().Replace("-", "");
            string imgResPath = Path.Combine("/files/dallres", _account, newFileName + ".png");
            string referenceImgPath = prompt;
            string thumbKey = string.Empty;
            Task.Run(async () =>
            {
                using (var scope = _serviceProvider.CreateScope()) // _serviceProvider 是 IServiceProvider 的一个实例。
                {
                    // 这里做一些后续处理，比如更新数据库记录等
                    string savePath = Path.Combine("wwwroot", "files/dallres", _account);
                    var aiSaveService = scope.ServiceProvider.GetRequiredService<IAiServer>();
                    var cosService = scope.ServiceProvider.GetRequiredService<ICOSService>();
                    var systemService = scope.ServiceProvider.GetRequiredService<ISystemService>();
                    await aiSaveService.DownloadImageAsync(airesult, savePath, newFileName);
                    string thumbSavePath =
                        systemService.CompressImage(Path.Combine(savePath, newFileName + ".png"), 75);
                    //查询是否启用了COS
                    var systemCfg = systemService.GetSystemCfgs();
                    var cos_switch = systemCfg.FirstOrDefault(x => x.CfgKey == "COS_Switch");
                    if (cos_switch != null)
                    {
                        string cos_switch_val = cos_switch.CfgValue;
                        if (!string.IsNullOrEmpty(cos_switch_val) && cos_switch_val == "1")
                        {
                            string coskey = $"dallres/{DateTime.Now.ToString("yyyyMMdd")}/{newFileName}.png";
                            string thumbFileName = System.IO.Path.GetFileName(thumbSavePath);
                            thumbKey = coskey.Replace(System.IO.Path.GetFileName(imgResPath), thumbFileName);
                            imgResPath = cosService.PutObject(coskey, Path.Combine(savePath, newFileName + ".png"),
                                newFileName + ".png");
                            thumbSavePath = cosService.PutObject(thumbKey, thumbSavePath, thumbFileName);
                            referenceImgPath = coskey;
                        }
                    }

                    await aiSaveService.SaveAiDrawResult(_account, "DALLE3", imgResPath, prompt, referenceImgPath,
                        thumbSavePath, thumbKey);
                }
            });
            nodeOutput.NodeName = nodeKey;
            nodeOutput.OutputData = BuilderJson(nodeKey, airesult);
            nodeOutput.NextNodes = FindNextNode(node.Outputs);
            _nodeCheckCounts[nodeKey]--;
            return nodeOutput;
        }

        private async Task<NodeOutput> ProcessDownLoadImgNode(NodeData node, List<NodeOutput> result)
        {
            var nodeKey = node.Name + node.Id;
            if (!_nodeCheckCounts.ContainsKey(nodeKey))
            {
                _nodeCheckCounts[nodeKey] = _checkCount;
            }

            if (_nodeCheckCounts[nodeKey] <= 0)
            {
                throw new Exception($"节点 {nodeKey} 的运行次数超出系统设定的极限, 触发流程引擎死循环保护, 请修正您的 WorkFlow");
            }

            NodeOutput nodeOutput = new NodeOutput();
            DownLoadImg downLoadImageData = (DownLoadImg)node.Data;
            string imageUrl = FillScriptWithValues(downLoadImageData.Output.ImageUrl, result);
            string prompt = FillScriptWithValues(downLoadImageData.Output.Prompt, result);
            if (string.IsNullOrEmpty(imageUrl))
            {
                string error = $"❌ 图片链接为空，请重试";
                throw new Exception(error);
            }

            // 在后台启动一个任务下载图片
            string newFileName = DateTime.Now.ToString("yyyyMMdd") + "-" + Guid.NewGuid().ToString().Replace("-", "");
            string imgResPath = Path.Combine("/files/workflowdownloadres", _account, newFileName + ".png");
            string referenceImgPath = string.Empty;
            string thumbKey = string.Empty;
            // 这里做一些后续处理，比如更新数据库记录等
            string savePath = Path.Combine("wwwroot", "files/workflowdownloadres", _account);
            Task.Run(async () =>
            {
                using (var scope = _serviceProvider.CreateScope()) // _serviceProvider 是 IServiceProvider 的一个实例。
                {
                    // 这里做一些后续处理，比如更新数据库记录等
                    string savePath = Path.Combine("wwwroot", "files/workflowdownloadres", _account);
                    var aiSaveService =
                        scope.ServiceProvider.GetRequiredService<IAiServer>(); // 假设保存记录方法在IAiSaveService中。
                    var cosService = scope.ServiceProvider.GetRequiredService<ICOSService>();
                    var systemService = scope.ServiceProvider.GetRequiredService<ISystemService>();
                    await aiSaveService.DownloadImageAsync(imageUrl, savePath, newFileName);
                    string thumbSavePath =
                        systemService.CompressImage(Path.Combine(savePath, newFileName + ".png"), 75);
                    //查询是否启用了COS
                    var systemCfg = systemService.GetSystemCfgs();
                    var cos_switch = systemCfg.FirstOrDefault(x => x.CfgKey == "COS_Switch");
                    if (cos_switch != null)
                    {
                        string cos_switch_val = cos_switch.CfgValue;
                        if (!string.IsNullOrEmpty(cos_switch_val) && cos_switch_val == "1")
                        {
                            string coskey =
                                $"workflowdownloadres/{DateTime.Now.ToString("yyyyMMdd")}/{newFileName}.png";
                            string thumbFileName = System.IO.Path.GetFileName(thumbSavePath);
                            thumbKey = coskey.Replace(System.IO.Path.GetFileName(imgResPath), thumbFileName);
                            imgResPath = cosService.PutObject(coskey, Path.Combine(savePath, newFileName + ".png"),
                                newFileName + ".png");
                            thumbSavePath = cosService.PutObject(thumbKey, thumbSavePath, thumbFileName);
                            referenceImgPath = coskey;
                        }
                    }

                    await aiSaveService.SaveAiDrawResult(_account, "workflowdownloadres", imgResPath, prompt, prompt,
                        thumbSavePath, thumbKey);
                }
            });
            nodeOutput.NodeName = nodeKey;
            nodeOutput.OutputData = BuilderJson(nodeKey, imageUrl);
            nodeOutput.NextNodes = FindNextNode(node.Outputs);
            _nodeCheckCounts[nodeKey]--;
            return nodeOutput;
        }

        private async Task<NodeOutput> ProcessDebugNode(NodeData node, List<NodeOutput> result)
        {
            var nodeKey = node.Name + node.Id;
            if (!_nodeCheckCounts.ContainsKey(nodeKey))
            {
                _nodeCheckCounts[nodeKey] = _checkCount;
            }

            if (_nodeCheckCounts[nodeKey] <= 0)
            {
                throw new Exception($"节点 {nodeKey} 的运行次数超出系统设定的极限, 触发流程引擎死循环保护, 请修正您的 WorkFlow");
            }

            NodeOutput nodeOutput = new NodeOutput();
            DebugData debugData = (DebugData)node.Data;
            string chatLog = FillScriptWithValues(debugData.Output.ChatLog, result);
            if (!string.IsNullOrEmpty(_chatId))
            {
                ChatRes chatRes = new ChatRes();
                chatRes.message = $"{chatLog} \n";
                await _financeService.UsageSaveRedis(_chatId, _account, "assistant", chatRes.message,
                    AIBotProEnum.HashFieldOperationMode.Append);
                await _hubContext.Clients.Group(_chatId).SendAsync(_senMethod, chatRes);
            }

            nodeOutput.NodeName = nodeKey;
            nodeOutput.OutputData = BuilderJson(nodeKey, chatLog);
            nodeOutput.NextNodes = FindNextNode(node.Outputs);
            _nodeCheckCounts[nodeKey]--;
            return nodeOutput;
        }

        /*private async Task<NodeOutput> ProcessDALLsmNode(NodeData node, List<NodeOutput> result)
        {
            var nodeKey = node.Name + node.Id;
            if (!_nodeCheckCounts.ContainsKey(nodeKey))
            {
                _nodeCheckCounts[nodeKey] = _checkCount;
            }
            if (_nodeCheckCounts[nodeKey] <= 0)
            {
                throw new Exception($"节点 {nodeKey} 的运行次数超出系统设定的极限, 触发流程引擎死循环保护, 请修正您的 WorkFlow");
            }
            NodeOutput nodeOutput = new NodeOutput();
            // 处理 "DALL" 节点,执行 DALL 代码,返回 JSON 字符串
            DALLsmData dallsmData = (DALLsmData)node.Data;
            if (!string.IsNullOrEmpty(_chatId))
            {
                ChatRes chatRes = new ChatRes();
                chatRes.message = $"✍\n";
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
                    var aiSaveService = scope.ServiceProvider.GetRequiredService<IAiServer>();
                    await aiSaveService.DownloadImageAsync(airesult, savePath, newFileName);
                    await aiSaveService.SaveAiDrawResult(_account, "DALLE2", imgResPath, prompt, "workflow_Engine");
                }
            });
            nodeOutput.NodeName = nodeKey;
            nodeOutput.OutputData = jsonBuilder.ToString();
            nodeOutput.NextNodes = FindNextNode(node.Outputs);
            _nodeCheckCounts[nodeKey]--;
            return nodeOutput;
        }*/

        private async Task<NodeOutput> ProcessWebNode(NodeData node, List<NodeOutput> result)
        {
            var nodeKey = node.Name + node.Id;
            if (!_nodeCheckCounts.ContainsKey(nodeKey))
            {
                _nodeCheckCounts[nodeKey] = _checkCount;
            }

            if (_nodeCheckCounts[nodeKey] <= 0)
            {
                throw new Exception($"节点 {nodeKey} 的运行次数超出系统设定的极限, 触发流程引擎死循环保护, 请修正您的 WorkFlow");
            }

            NodeOutput nodeOutput = new NodeOutput();
            // 处理 "web" 节点,执行 web 代码,返回 JSON 字符串
            WebData webData = (WebData)node.Data;
            string prompt = FillScriptWithValues(webData.Output.Prompt, result);
            var webjson = webData.Output.WebJson;
            List<SystemCfg> systemConfig = _systemService.GetSystemCfgs();
            string googleSearchApiKey = systemConfig.Find(x => x.CfgKey == "GoogleSearchApiKey").CfgValue;
            string googleSearchEngineId = systemConfig.Find(x => x.CfgKey == "GoogleSearchEngineId").CfgValue;
            var googleSearch = await _aiServer.GetWebSearchResult(prompt, googleSearchApiKey, googleSearchEngineId);
            if (googleSearch.Count == 0)
                throw new Exception("联网搜索的结果集为空，运行中断，请重试");
            if (webjson.HasValue && webjson.Value)
            {
                var dataArray = JArray.FromObject(googleSearch);
                nodeOutput.OutputData = BuilderJson(nodeKey, JsonConvert.SerializeObject(dataArray));
            }
            else
            {
                var airesult = new StringBuilder();
                for (int i = 0; i < googleSearch.Count; i++)
                {
                    airesult.AppendLine($"# {i + 1}:标题：{googleSearch[i].Title}");
                    airesult.AppendLine($"# 链接地址：{googleSearch[i].Link}");
                    airesult.AppendLine($"# 摘要：{googleSearch[i].Snippet}");
                    airesult.AppendLine();
                }

                var data =
                    $@"I will give you a question or an instruction. Your objective is to answer my question or fulfill my instruction.

                        My question or instruction is: {prompt}

                        For your reference, today's date is {DateTime.Now.ToString()} in Beijing.

                        It's possible that the question or instruction, or just a portion of it, requires relevant information from the internet to give a satisfactory answer or complete the task. Therefore, provided below is the necessary information obtained from the internet, which sets the context for addressing the question or fulfilling the instruction. You will write a comprehensive reply to the given question or instruction. Do not include urls and sources in the summary text. If the provided information from the internet results refers to multiple subjects with the same name, write separate answers for each subject:
                        {airesult}
                        Reply in 中文";

                nodeOutput.OutputData = BuilderJson(nodeKey, data);
            }

            nodeOutput.NodeName = nodeKey;
            nodeOutput.NextNodes = FindNextNode(node.Outputs);
            _nodeCheckCounts[nodeKey]--;
            return nodeOutput;
        }

        private async Task<NodeOutput> ProcessIfElseNode(NodeData node, List<NodeOutput> result)
        {
            var nodeKey = node.Name + node.Id;
            if (!_nodeCheckCounts.ContainsKey(nodeKey))
            {
                _nodeCheckCounts[nodeKey] = _checkCount;
            }

            if (_nodeCheckCounts[nodeKey] <= 0)
            {
                throw new Exception($"节点 {nodeKey} 的运行次数超出系统设定的极限, 触发流程引擎死循环保护, 请修正您的 WorkFlow");
            }

            NodeOutput nodeOutput = new NodeOutput();
            List<int> nodeIds = new List<int>();
            IfElseData ifElseData = (IfElseData)node.Data;
            string judgresult = FillScriptWithValues(ifElseData.Output.JudgResult, result);
            string ExecuteResult = RunScript(nodeKey, judgresult);
            Dictionary<string, NodeConnection> keyValuePairs = new Dictionary<string, NodeConnection>();
            if (ExecuteResult == "True")
            {
                keyValuePairs = node.Outputs.Where(x => x.Key == "output_1").ToDictionary(x => x.Key, x => x.Value);
            }
            else
            {
                keyValuePairs = node.Outputs.Where(x => x.Key == "output_2").ToDictionary(x => x.Key, x => x.Value);
            }

            List<NodeData> nextNodes = new List<NodeData>();
            foreach (var item in keyValuePairs)
            {
                foreach (var items in item.Value.Connections)
                {
                    nodeIds.Add(Convert.ToInt32(items.Node));
                }
            }

            foreach (var item in nodeIds)
            {
                var nextnode = _workflowData.Drawflow.Home.Data.Values.Where(x => x.Id == item).FirstOrDefault();
                nextNodes.Add(nextnode);
            }

            var jobject = new JObject
            {
                ["data"] = bool.Parse(ExecuteResult.ToLower()).ToString().ToLower()
            };
            //查找下一个节点
            nodeOutput.NextNodes = nextNodes;
            nodeOutput.NodeName = nodeKey;
            nodeOutput.OutputData = BuilderJson(nodeKey, JsonConvert.SerializeObject(jobject));
            _nodeCheckCounts[nodeKey]--;
            return nodeOutput;
        }

        private async Task<NodeOutput> ProcessKonwledgeNode(NodeData node, List<NodeOutput> result)
        {
            var nodeKey = node.Name + node.Id;
            if (!_nodeCheckCounts.ContainsKey(nodeKey))
            {
                _nodeCheckCounts[nodeKey] = _checkCount;
            }

            if (_nodeCheckCounts[nodeKey] <= 0)
            {
                throw new Exception($"节点 {nodeKey} 的运行次数超出系统设定的极限, 触发流程引擎死循环保护, 请修正您的 WorkFlow");
            }

            NodeOutput nodeOutput = new NodeOutput();
            KnowledgeData knowledgeData = (KnowledgeData)node.Data;
            string prompt = FillScriptWithValues(knowledgeData.Output.Prompt, result);
            string airesult = string.Empty;
            int retryCount = knowledgeData.Output.Retry; // 重试次数
            int initialRetryCount = retryCount;
            bool reranker = knowledgeData.Output.Reranker;
            int topn = knowledgeData.Output.TopN;
            List<SystemCfg> systemCfgs = _systemService.GetSystemCfgs();
            var Alibaba_DashVectorApiKey =
                systemCfgs.FirstOrDefault(x => x.CfgKey == "Alibaba_DashVectorApiKey")?.CfgValue;
            var Alibaba_DashVectorEndpoint =
                systemCfgs.FirstOrDefault(x => x.CfgKey == "Alibaba_DashVectorEndpoint")?.CfgValue;
            var Alibaba_DashVectorCollectionName =
                systemCfgs.FirstOrDefault(x => x.CfgKey == "Alibaba_DashVectorCollectionName")?.CfgValue;
            var EmbeddingsUrl = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsUrl")?.CfgValue;
            var EmbeddingsApiKey = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsApiKey")?.CfgValue;
            var EmbeddingsModel = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsModel")?.CfgValue;
            VectorHelper vectorHelper = new VectorHelper(_redisService, Alibaba_DashVectorApiKey,
                Alibaba_DashVectorEndpoint, Alibaba_DashVectorCollectionName, EmbeddingsUrl, EmbeddingsApiKey, EmbeddingsModel);
            List<string> pm = new List<string>();
            pm.Add(prompt);
            List<List<double>> vectorList = new List<List<double>>();
            do
            {
                var embeddingModel = systemCfgs.FirstOrDefault(x => x.CfgKey == "EmbeddingsModel");
                vectorList = await vectorHelper.StringToVectorAsync(embeddingModel.CfgValue,
                    pm.Select(s => s.Replace("\r", "").Replace("\n", "")).ToList(), _account);
                if (vectorList != null && vectorList.Count > 0) break; // 如果结果非空，退出循环
                if (!string.IsNullOrEmpty(_chatId) && retryCount > 0)
                {
                    // 计算剩余重试次数
                    int remainingRetries = retryCount - 1;
                    string retryMessage =
                        $"🔄 Knowledge重试 {initialRetryCount - remainingRetries}/{initialRetryCount}...";

                    await _hubContext.Clients.Group(_chatId)
                        .SendAsync(_senMethod, new ChatRes { message = retryMessage });
                }

                await Task.Delay(500);
            } while (--retryCount >= 0);

            SearchVectorPr searchVectorPr = new SearchVectorPr();
            searchVectorPr.filter = $"account = '{_account}'";
            searchVectorPr.topk = knowledgeData.Output.TopK;
            searchVectorPr.vector = vectorList[0];
            List<string> typeCode = knowledgeData.Output.TypeCode;
            //SearchVectorResult searchVectorResult = vectorHelper.SearchVector(searchVectorPr);
            SearchVectorResult searchVectorResult = new SearchVectorResult();
            if (typeCode != null && typeCode.Count > 0)
            {
                List<float> vectorByMilvus = searchVectorPr.vector.ConvertAll(x => (float)x);
                var resultByMilvus =
                    await _milvusService.SearchVector(vectorByMilvus, _account, typeCode, searchVectorPr.topk);
                searchVectorResult = new SearchVectorResult
                {
                    code = resultByMilvus.Code,
                    request_id = Guid.NewGuid().ToString(),
                    message = string.Empty,
                    output = resultByMilvus.Data.Select(data => new Output
                    {
                        id = data.Id,
                        fields = new Fields
                        {
                            account = string.Empty,
                            knowledge = data.VectorContent
                        },
                        score = (double)data.Distance
                    }).ToList()
                };
            }
            else
                searchVectorResult = vectorHelper.SearchVector(searchVectorPr);

            string data = string.Empty;
            if (searchVectorResult.output != null)
            {
                List<string> docs = new List<string>();
                for (int i = 0; i < searchVectorResult.output.Count; i++)
                {
                    Output output = searchVectorResult.output[i];
                    data += $"{i + 1}：{output.fields.knowledge} \n";
                    docs.Add(output.fields.knowledge);
                }

                if (reranker)
                {
                    var rerankRes =
                        await _aiServer.RerankerJinaAI(docs, "jina-reranker-v2-base-multilingual", prompt, topn);
                    if (rerankRes != null && rerankRes.Results.Count > 0)
                    {
                        data = string.Empty;
                        for (int i = 0; i < rerankRes.Results.Count; i++)
                        {
                            data += $"{i + 1}：{rerankRes.Results[i].Document.Text} \n";
                        }
                    }
                }

                data = $@"# 知识库查询结果如下：
                                     {data}
                                     * 保持回答尽可能参考知识库的内容。 
                                     * 使用 Markdown 语法优化回答格式。
                                     * 以知识库中的理念和说话风格来解答用户的问题。 
                                     * 使用与问题相同的语言回答。";
            }
            else
                data = "知识库中没有查到关于这个问题的内容,请自行回答";

            nodeOutput.NodeName = nodeKey;
            nodeOutput.OutputData = BuilderJson(nodeKey, data);
            nodeOutput.NextNodes = FindNextNode(node.Outputs);
            _nodeCheckCounts[nodeKey]--;
            return nodeOutput;
        }

        private async Task<NodeOutput> ProcessEndNode(NodeData node, List<NodeOutput> result)
        {
            NodeOutput nodeOutput = new NodeOutput();
            // 处理 "end" 节点,根据 "endaction" 执行相应操作,返回 JSON 字符串
            EndData endData = (EndData)node.Data;
            string type = endData.Output.EndAction;
            string jsData = FillScriptWithValues(endData.Output.EndScript, result);
            var nodeName = node.Name;
            if (type != "js")
            {
                string ExecuteResult = RunScript(nodeName, jsData);
                nodeOutput.NodeName = nodeName;
                nodeOutput.OutputData = ExecuteResult;
                nodeOutput.NextNodes = FindNextNode(node.Outputs);
                return nodeOutput;
            }

            nodeOutput.NodeName = nodeName;
            nodeOutput.OutputData = jsData;
            nodeOutput.NextNodes = FindNextNode(node.Outputs);
            return nodeOutput;
        }

        /// <summary>
        /// 使用AI进行脚本代码审查
        /// </summary>
        /// <param name="prompt"></param>
        /// <param name="code"></param>
        /// <returns></returns>
        private async Task<(bool result, string cause)> AICodeCheck(string prompt)
        {
            string JsonSchemaInput = @"{
                          ""type"": ""object"",
                          ""properties"": {
                            ""judgment_results"": {
                              ""type"": ""boolean"",
                              ""description"": ""判断结果""
                            },
                            ""judgment_cause"": {
                              ""type"": ""string"",
                              ""description"": ""判断原因""
                            }
                          },
                          ""required"": [
                            ""judgment_results"",
                            ""judgment_cause""
                          ],
                          ""additionalProperties"": false
                        }";
            var systemCfg = _systemService.GetSystemCfgs();
            var aiCodeCheckBaseUrl = systemCfg.FirstOrDefault(x => x.CfgKey == "AICodeCheckBaseUrl");
            var aiCodeCheckApiKey = systemCfg.FirstOrDefault(x => x.CfgKey == "AICodeCheckApiKey");
            var aiCodeCheckModel = systemCfg.FirstOrDefault(x => x.CfgKey == "AICodeCheckModel");
            if (aiCodeCheckBaseUrl == null || aiCodeCheckApiKey == null || aiCodeCheckModel == null)
                throw new Exception("系统未配置代码检查：AICodeCheckBaseUrl、AICodeCheckApiKey、AICodeCheckModel");
            AiChat aiChat = _aiServer.CreateAiChat(aiCodeCheckModel.CfgValue, prompt, false, false, true, JsonSchemaInput);
            APISetting apiSetting = new APISetting
            {
                BaseUrl = aiCodeCheckBaseUrl.CfgValue,
                ApiKey = aiCodeCheckApiKey.CfgValue
            };
            string result = await _aiServer.CallingAINotStream(aiChat, apiSetting);

            // Parsing the judgment_results and judgment_cause from the JSON
            JObject json = JObject.Parse(result);
            bool judgmentResult = json["judgment_results"].Value<bool>();
            string judgmentCause = json["judgment_cause"].Value<string>();

            return (judgmentResult, judgmentCause);
        }

        //------------------------------------------静态函数-----------------------------------------
        private static string EscapeSpecialCharacters(string input)
        {
            // 转义单引号（'）、双引号（"）和反引号（`）
            return input.Replace("'", "\\'")
                .Replace("\"", "\\\"")
                .Replace("`", "\\`")
                .Replace("\n", "\\n")
                .Replace("\r", "\\r")
                .Replace("${", "\\${");
        }

        private static string ExtractValueFromPath(string path, string thisJson)
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
                        return EscapeSpecialCharacters(currentToken.ToString());
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

        private static string ExtractValueFromPath(string path, List<NodeOutput> results)
        {
            foreach (var result in results)
            {
                try
                {
                    var json = JObject.Parse(result.OutputData);
                    var token = json.SelectToken(path); // 使用SelectToken提取路径对应的值

                    // 如果找到了对应的值,返回它
                    if (token != null)
                    {
                        return EscapeSpecialCharacters(token.ToString());
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
            JObject jobject;

            try
            {
                // 尝试将 result 解析为 JToken
                JToken jToken = JToken.Parse(result);

                if (jToken is JObject jObject)
                {
                    // 如果是 JObject
                    jobject = new JObject
                    {
                        [nodeName] = new JObject
                        {
                            ["data"] = jObject
                        }
                    };
                }
                else if (jToken is JArray jArray)
                {
                    // 如果是 JArray
                    jobject = new JObject
                    {
                        [nodeName] = new JObject
                        {
                            ["data"] = jArray
                        }
                    };
                }
                else
                {
                    // 如果既不是 JObject 也不是 JArray,视为普通字符串
                    jobject = new JObject
                    {
                        [nodeName] = new JObject
                        {
                            ["data"] = result
                        }
                    };
                }
            }
            catch (JsonReaderException)
            {
                // 如果解析失败,将 result 视为普通字符串
                jobject = new JObject
                {
                    [nodeName] = new JObject
                    {
                        ["data"] = result
                    }
                };
            }

            return JsonConvert.SerializeObject(jobject, Formatting.None);
        }
    }
}