using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using Microsoft.Build.Evaluation;
using Newtonsoft.Json;
using RestSharp;
using Spire.Presentation.Charts;
using System.Security.Policy;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;

namespace aibotPro.Service
{
    public class AssistantService : IAssistantService
    {
        private readonly AIBotProContext _context;
        private readonly ISystemService _systemService;
        private readonly IRedisService _redisService;
        private readonly IFinanceService _financeService;
        public AssistantService(AIBotProContext context, ISystemService systemService, IRedisService redisService, IFinanceService financeService)
        {
            _context = context;
            _systemService = systemService;
            _redisService = redisService;
            _financeService = financeService;
        }
        public List<AssistantModelPrice> GetAssistantModelPrices(string account = "", string modelname = "")
        {
            var assistantPrices = new List<AssistantModelPrice>();
            //尝试从缓存获取
            var assisCache = _redisService.GetAsync("AssistantModelPrices").Result;
            if (assisCache != null)
            {
                assistantPrices = JsonConvert.DeserializeObject<List<AssistantModelPrice>>(assisCache);
            }
            else
            {
                assistantPrices = _context.AssistantModelPrices.ToList();
                _redisService.SetAsync("AssistantModelPrices", JsonConvert.SerializeObject(assistantPrices));
            }
            //当模型名为空时则不过滤
            if (!string.IsNullOrEmpty(modelname))
                assistantPrices = assistantPrices.Where(x => x.ModelName == modelname).ToList();
            return assistantPrices;
        }
        public List<AssistantGPT> GetAssistantGPTs(string account)
        {
            var assists = new List<AssistantGPT>();
            if (string.IsNullOrEmpty(account))
                assists = _context.AssistantGPTs.ToList();
            else
                assists = _context.AssistantGPTs.Where(x => x.Account == account).ToList();
            return assists;
        }
        public List<AssistantFile> GetAssistantFiles(string account)
        {
            var files = new List<AssistantFile>();
            if (string.IsNullOrEmpty(account))
                files = _context.AssistantFiles.ToList();
            else
                files = _context.AssistantFiles.Where(x => x.Account == account).ToList();
            return files;
        }
        public List<ApiResponse> UploadAssistantFiles(string account, IFormFileCollection files)
        {
            List<ApiResponse> res = new List<ApiResponse>();
            var assistantSetting = GetAssistantModelPrices();
            if (assistantSetting == null)
            {
                res.Add(new ApiResponse()
                {
                    Error = new ErrorResponse()
                    {
                        Error = new ErrorResponse.ErrorDetail()
                        {
                            Message = "缺失助理配置"
                        }
                    }
                });
                return res;
            }
            if (files == null)
            {
                res.Add(new ApiResponse()
                {
                    Error = new ErrorResponse()
                    {
                        Error = new ErrorResponse.ErrorDetail()
                        {
                            Message = "没有可上传的文件"
                        }
                    }
                });
                return res;
            }
            var apikey = assistantSetting.Select(x => x.ApiKey).First();
            var baseurl = assistantSetting.Select(x => x.BaseUrl).First().TrimEnd('/');
            foreach (var file in files)
            {
                var client = new RestClient($"{baseurl}/v1/files");
                var request = new RestRequest("", Method.Post);
                request.AddHeader("Authorization", $"Bearer {apikey}");
                request.AddHeader("Accept", "*/*");
                request.AddHeader("Connection", "keep-alive");
                request.AddHeader("Content-Type", "multipart/form-data;charset=utf-8");
                request.AddParameter("purpose", "assistants");
                if (file.Length > 0)
                {
                    try
                    {
                        using (var stream = file.OpenReadStream())
                        {
                            request.AddFile("file", ReadAsBytes(stream), file.FileName);
                            RestResponse response = client.Execute(request);
                            if (response.IsSuccessful)
                            {
                                ApiResponse apiResponse = ParseApiResponse(response.Content);
                                res.Add(apiResponse);
                                _systemService.WriteLogUnAsync($"上传文件到助理{file.FileName}", Dtos.LogLevel.Info, account);
                            }
                            else
                            {
                                return res;
                            }
                        }
                    }
                    catch (Exception e)
                    {

                        throw;
                    }

                }
            }
            return res;
        }
        public string SaveAssistant(string assisId, string assisName, string assisSysPrompt, string assisModel, int codeinterpreter, int retrieval, List<Dictionary<string, string>> files, string account)
        {
            var assistantSetting = GetAssistantModelPrices();
            if (assistantSetting == null)
            {
                return "";
            }
            var apikey = assistantSetting.Select(x => x.ApiKey).First();
            var baseurl = assistantSetting.Select(x => x.BaseUrl).First().TrimEnd('/');
            List<Tools> tools = new List<Tools>();
            if (codeinterpreter == 1)
            {
                Tools tools1 = new Tools
                {
                    type = "code_interpreter"
                };
                tools.Add(tools1);
            }
            if (retrieval == 1)
            {
                Tools tools1 = new Tools
                {
                    type = "retrieval"
                };
                tools.Add(tools1);
            }
            List<string> fileids = new List<string>();
            if (files.Count > 0)
            {
                foreach (var dict in files)
                {
                    foreach (var key in dict.Keys)
                    {
                        fileids.Add(key);
                    }
                }
            }
            if (string.IsNullOrEmpty(assisId))//新增
            {
                var client = new RestClient($"{baseurl}/v1/assistants");
                var request = new RestRequest("", Method.Post);
                request.AddHeader("Authorization", $"Bearer {apikey}");
                request.AddHeader("Accept", "*/*");
                request.AddHeader("Connection", "keep-alive");
                request.AddHeader("Content-Type", "application/json");
                request.AddHeader("OpenAI-Beta", "assistants=v1");
                var body = @"{" + "\n" +
                        @$"  ""instructions"": ""{assisSysPrompt}""," + "\n" +
                        @$"  ""name"": ""{assisName}""," + "\n" +
                        @$"  ""tools"": {JsonConvert.SerializeObject(tools.ToArray())}," + "\n" +
                        @$"  ""model"": ""{assisModel}""," + "\n" +
                        @$"  ""file_ids"": {JsonConvert.SerializeObject(fileids.ToArray())}" + "\n" +
                        @"}";
                request.AddParameter("application/json", body, ParameterType.RequestBody);
                RestResponse response = client.Execute(request);
                var res = JsonConvert.DeserializeObject<dynamic>(response.Content);
                //保存到数据库
                _context.AssistantGPTs.Add(new AssistantGPT()
                {
                    Account = account,
                    AssisId = res.id,
                    AssisModel = assisModel,
                    AssisName = assisName,
                    AssisSystemPrompt = assisSysPrompt,
                    Codeinterpreter = codeinterpreter,
                    Retrieval = retrieval,
                    CreateTime = DateTime.Now
                });
                if (files.Count > 0)
                {
                    //保存文件
                    foreach (var item in files)
                    {
                        foreach (var kvp in item)
                        {
                            _context.AssistantFiles.Add(new AssistantFile
                            {
                                Account = account,
                                AssisId = res.id,
                                FileId = kvp.Key,
                                FileName = kvp.Value,
                                CreateTime = DateTime.Now
                            });
                        }
                    }
                }
                _context.SaveChanges();
                return res.id.ToString();
            }
            else//更新
            {
                //检查assisId与用户是否匹配
                var assistant = GetAssistantGPTs(account);
                if (assistant.Count > 0)
                {
                    string userAssisId = assistant.Select(x => x.AssisId).First();
                    if (assisId != userAssisId)
                        return "";
                }
                else
                    return "";
                var client = new RestClient($"{baseurl}/v1/assistants/{assisId}");
                var request = new RestRequest("", Method.Post);
                request.AddHeader("Authorization", $"Bearer {apikey}");
                request.AddHeader("Accept", "*/*");
                request.AddHeader("Connection", "keep-alive");
                request.AddHeader("Content-Type", "application/json");
                request.AddHeader("OpenAI-Beta", "assistants=v1");
                var body = @"{" + "\n" +
                        @$"  ""instructions"": ""{assisSysPrompt}""," + "\n" +
                        @$"  ""name"": ""{assisName}""," + "\n" +
                        @$"  ""tools"": {JsonConvert.SerializeObject(tools.ToArray())}," + "\n" +
                        @$"  ""model"": ""{assisModel}""," + "\n" +
                        @$"  ""file_ids"": {JsonConvert.SerializeObject(fileids.ToArray())}" + "\n" +
                        @"}";
                request.AddParameter("application/json", body, ParameterType.RequestBody);
                RestResponse response = client.Execute(request);
                var res = JsonConvert.DeserializeObject<dynamic>(response.Content);
                //更新数据库
                var assis = _context.AssistantGPTs.Where(x => x.AssisId == assisId).First();
                assis.AssisId = res.id;
                assis.AssisName = assisName;
                assis.AssisModel = assisModel;
                assis.AssisSystemPrompt = assisSysPrompt;
                assis.Codeinterpreter = codeinterpreter;
                assis.Retrieval = retrieval;
                assis.CreateTime = DateTime.Now;
                if (files.Count > 0)
                {
                    //删除旧文件
                    var oldfiles = _context.AssistantFiles.Where(x => x.Account == account);
                    if (oldfiles != null)
                        _context.RemoveRange(oldfiles);
                    //保存文件
                    foreach (var item in files)
                    {
                        foreach (var kvp in item)
                        {
                            _context.AssistantFiles.Add(new AssistantFile
                            {
                                Account = account,
                                AssisId = res.id,
                                FileId = kvp.Key,
                                FileName = kvp.Value,
                                CreateTime = DateTime.Now
                            });
                        }
                    }

                }
                _context.SaveChanges();
                return res.id.ToString();
            }
        }
        public bool DelFileByGPT(List<string> fileids)
        {
            bool deleted = false;
            var assistantSetting = GetAssistantModelPrices();
            if (assistantSetting == null)
            {
                return deleted;
            }
            var apikey = assistantSetting.Select(x => x.ApiKey).First();
            var baseurl = assistantSetting.Select(x => x.BaseUrl).First().TrimEnd('/');
            foreach (var file in fileids)
            {
                var client = new RestClient($"{baseurl}/v1/files/{file}");
                var request = new RestRequest("", Method.Delete);
                request.AddHeader("Authorization", $"Bearer {apikey}");
                request.AddHeader("Accept", "*/*");
                request.AddHeader("Connection", "keep-alive");
                request.AddHeader("Content-Type", "multipart/form-data;");
                RestResponse response = client.Execute(request);
                if (!response.Content.Contains("error"))
                {
                    dynamic obj = JsonConvert.DeserializeObject<dynamic>(response.Content);
                    if (bool.Parse(obj.deleted.ToString()))
                    {
                        deleted = true;
                        var files = _context.AssistantFiles.Where(x => x.FileId == file);
                        _context.RemoveRange(files);
                        _context.SaveChanges();
                    }
                    else
                        deleted = false;
                }
            }
            return deleted;
        }
        public async Task<string> CreateThread()
        {
            var assistantSetting = GetAssistantModelPrices();
            if (assistantSetting == null)
            {
                return "";
            }
            var apikey = assistantSetting.Select(x => x.ApiKey).First();
            var baseurl = assistantSetting.Select(x => x.BaseUrl).First().TrimEnd('/');
            RestResponse response = await GPTsClient($"{baseurl}/v1/threads", apikey, "");
            var res = JsonConvert.DeserializeObject<dynamic>(response.Content);
            return res.id.ToString();
        }
        public async Task<string> AddMessage(string threadId, string prompt)
        {
            var assistantSetting = GetAssistantModelPrices();
            if (assistantSetting == null)
            {
                return "";
            }
            var apikey = assistantSetting.Select(x => x.ApiKey).First();
            var baseurl = assistantSetting.Select(x => x.BaseUrl).First().TrimEnd('/');
            AssistantMsg myChatMesssage = new AssistantMsg();
            myChatMesssage.role = "user";
            myChatMesssage.content = prompt;
            RestResponse response = await GPTsClient($"{baseurl}/v1/threads/{threadId}/messages", apikey, JsonConvert.SerializeObject(myChatMesssage));
            var res = JsonConvert.DeserializeObject<dynamic>(response.Content);
            return res.id.ToString();
        }
        public async IAsyncEnumerable<AssistantReply> RunThread(string threadId, string assisId, string account)
        {
            var assistantSetting = GetAssistantModelPrices();
            var apikey = assistantSetting.Select(x => x.ApiKey).First();
            var baseurl = assistantSetting.Select(x => x.BaseUrl).First().TrimEnd('/');
            var body = @"{
                            " + "\n" +
                            @$"    ""assistant_id"":""{assisId}"",
                            " + "\n" +
                            @"    ""stream"":true
                            " + "\n" +
                            @"}";
            using (var httpClient = new HttpClient())
            {
                // 创建请求内容
                var requestBody = body;
                var request = new HttpRequestMessage(HttpMethod.Post, $"{baseurl}/v1/threads/{threadId}/runs");
                request.Headers.Add("Authorization", $"Bearer {apikey}");
                request.Headers.Add("OpenAI-Beta", "assistants=v1");
                var requestContent = new StringContent(requestBody, Encoding.UTF8, "application/json");
                request.Content = requestContent;
                string currentEvent = null;
                string currentData = null;
                int prompt_token = 0;
                int completion_tokens = 0;
                string model = string.Empty;
                using (var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead))
                {
                    using (var responseStream = await response.Content.ReadAsStreamAsync())
                    {
                        using (var reader = new StreamReader(responseStream, Encoding.UTF8))
                        {
                            string line;
                            while (!reader.EndOfStream)
                            {
                                AssistantReply assistantReply = new AssistantReply();
                                line = await reader.ReadLineAsync();
                                if (line.StartsWith("event:"))
                                {
                                    currentEvent = line.Substring("event:".Length).Trim();
                                }
                                else if (line.StartsWith("data:"))
                                {
                                    currentData = line.Substring("data:".Length).Trim();
                                    if (currentData == "[DONE]")
                                    {
                                        break;
                                    }
                                }
                                if (currentEvent != null && currentData != null)
                                {
                                    switch (currentEvent)
                                    {
                                        case "thread.run.created":
                                        case "thread.run.queued":
                                        case "thread.run.in_progress":
                                        case "thread.run.completed":
                                            var threadRun = System.Text.Json.JsonSerializer.Deserialize<ThreadRun>(currentData);
                                            if (threadRun.usage != null)
                                            {
                                                prompt_token = threadRun.usage.prompt_tokens;
                                                completion_tokens = threadRun.usage.completion_tokens;
                                            }
                                            model = threadRun.model;
                                            if (currentData == "thread.run.completed")
                                            {

                                            }
                                            //Console.WriteLine($"Event: {currentEvent}, Run ID: {threadRun.id}");
                                            break;
                                        case "thread.run.step.created":
                                        case "thread.run.step.in_progress":
                                        case "thread.run.step.completed":
                                            var threadRunStep = System.Text.Json.JsonSerializer.Deserialize<ThreadRunStep>(currentData);
                                            //Console.WriteLine($"Event: {currentEvent}, Step ID: {threadRunStep.id}");
                                            break;
                                        case "thread.run.step.delta":
                                            var threadRunStepDelta = System.Text.Json.JsonSerializer.Deserialize<ThreadRunStepDelta>(currentData);
                                            Console.WriteLine($"Event: {currentEvent}, Step ID: {threadRunStepDelta.id}");
                                            if (threadRunStepDelta.delta?.step_details?.tool_calls != null)
                                            {
                                                foreach (var toolCall in threadRunStepDelta.delta.step_details.tool_calls)
                                                {
                                                    if (toolCall.type == "code_interpreter" && toolCall.code_interpreter != null)
                                                    {
                                                        assistantReply.message = "📎";
                                                    }
                                                    if (toolCall.type == "retrieval" && toolCall.retrieval != null)
                                                    {
                                                        assistantReply.message = "💾";
                                                    }
                                                    yield return assistantReply;
                                                }
                                            }
                                            break;
                                        case "thread.message.created":
                                        case "thread.message.in_progress":
                                        case "thread.message.completed":
                                            var threadMessage = System.Text.Json.JsonSerializer.Deserialize<ThreadMessage>(currentData);
                                            if (threadMessage.file_ids != null && threadMessage.file_ids.Count > 0)
                                                assistantReply.file_ids = threadMessage.file_ids;
                                            yield return assistantReply;
                                            //Console.WriteLine($"Event: {currentEvent}, Message ID: {threadMessage.id}");
                                            break;
                                        case "thread.message.delta":
                                            var threadMessageDelta = System.Text.Json.JsonSerializer.Deserialize<ThreadMessageDelta>(currentData);
                                            //Console.WriteLine($"Event: {currentEvent}, Message ID: {threadMessageDelta.id}");
                                            if (threadMessageDelta.delta?.content != null && threadMessageDelta.delta.content.Count > 0)
                                            {
                                                var deltaContent = threadMessageDelta.delta.content[0];
                                                if (deltaContent.text != null)
                                                {
                                                    assistantReply.message = deltaContent.text.value;
                                                    yield return assistantReply;
                                                }
                                                if (deltaContent.image_file != null)
                                                {
                                                    assistantReply.file_ids.Add(deltaContent.image_file.file_id);
                                                    yield return assistantReply;
                                                }
                                            }
                                            break;
                                    }

                                    currentEvent = null;
                                    currentData = null;
                                }
                            }
                            //结算费用
                            await _financeService.CreateUseLogAndUpadteMoney(account, model + "-Assistants", prompt_token, completion_tokens);
                        }
                    }
                }
            }
        }

        private async Task<RestResponse> GPTsClient(string url, string apikey, string body, string type = "Post")
        {
            var client = new RestClient($"{url}");
            var request = new RestRequest("", Method.Post);
            if (type == "Get")
                request = new RestRequest("", Method.Get);
            request.AddHeader("Authorization", $"Bearer {apikey}");
            request.AddHeader("Accept", "*/*");
            request.AddHeader("Connection", "keep-alive");
            request.AddHeader("Content-Type", "application/json");
            request.AddHeader("OpenAI-Beta", "assistants=v1");
            request.AddParameter("application/json", body, ParameterType.RequestBody);
            RestResponse response = await client.ExecuteAsync(request);
            return response;
        }


        private static ApiResponse ParseApiResponse(string jsonResponse)
        {
            ApiResponse apiResponse = new ApiResponse();

            if (jsonResponse.Contains("\"error\":"))
            {
                apiResponse.Error = JsonConvert.DeserializeObject<ErrorResponse>(jsonResponse);
            }
            else
            {
                apiResponse.File = JsonConvert.DeserializeObject<FileResponse>(jsonResponse);
            }

            return apiResponse;
        }
        private byte[] ReadAsBytes(Stream input)
        {
            using (var memoryStream = new MemoryStream())
            {
                input.CopyTo(memoryStream);
                return memoryStream.ToArray();
            }
        }
    }
}
