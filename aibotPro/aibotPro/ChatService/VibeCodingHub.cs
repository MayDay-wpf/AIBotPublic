using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using aibotPro.Service;
using Betalgo.Ranul.OpenAI;
using Betalgo.Ranul.OpenAI.Managers;
using Betalgo.Ranul.OpenAI.ObjectModels.RequestModels;
using Grpc.Net.Client.Balancer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using TiktokenSharp;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Numerics;
using Microsoft.Build.Experimental.ProjectCache;

namespace aibotPro.ChatService
{
    [Authorize]
    public class VibeCodingHub : Hub
    {
        private readonly IFinanceService _financeService;
        private readonly IUsersService _usersService;
        private readonly IProductService _productService;
        private readonly IAiServer _aiServer;
        private readonly IRedisService _redisService;
        private readonly ChatCancellationManager _chatCancellationManager;

        public VibeCodingHub(IFinanceService financeService, IUsersService usersService, IProductService productService,
            IAiServer aiServer, IRedisService redisService, ChatCancellationManager chatCancellationManager)
        {
            _financeService = financeService;
            _usersService = usersService;
            _productService = productService;
            _aiServer = aiServer;
            _redisService = redisService;
            _chatCancellationManager = chatCancellationManager;
        }

        public async Task SendVibeCodingMessage(VibeCodingDto vibeCodingDto)
        {
            var httpContext = Context.GetHttpContext();
            var Account = Context.User.Identity.Name;
            string cacheContent = string.Empty;
            var sendMethod = "VibeCodingReceiveMessage";
            if (!string.IsNullOrEmpty(vibeCodingDto.systemCacheKey))
            {
                cacheContent = await _redisService.GetAsync(vibeCodingDto.systemCacheKey);
                if (!string.IsNullOrEmpty(cacheContent))
                {
                    await _redisService.DeleteAsync(vibeCodingDto.systemCacheKey);
                }
            }

            if (!string.IsNullOrEmpty(vibeCodingDto.inputCacheKey))
            {
                vibeCodingDto.msg = await _redisService.GetAsync(vibeCodingDto.inputCacheKey);
                if (!string.IsNullOrEmpty(vibeCodingDto.msg))
                {
                    await _redisService.DeleteAsync(vibeCodingDto.inputCacheKey);
                }
            }

            string chatId = string.Empty;
            string sysmsg = string.Empty;
            string thinkmsg = string.Empty;
            string input = string.Empty;
            string output = string.Empty;
            int usageInput = 0;
            int usageOutput = 0;
            var newChat = false;
            if (string.IsNullOrEmpty(vibeCodingDto.chatid))
            {
                chatId = Guid.NewGuid().ToString("N"); //创建chatid头部
                chatId = $"{chatId}U{Account}IP{vibeCodingDto.ip}";
                vibeCodingDto.chatid = chatId;
                newChat = true;
            }
            else
            {
                chatId = vibeCodingDto.chatid;
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, chatId);
            var vibeCodingRes = new VibeCodingRes();
            vibeCodingRes.chatid = chatId;
            await Clients.Group(chatId).SendAsync("sendMethod", vibeCodingRes);
            //对话前的检查
            (bool result, VibeCodingModel aiModel) = await _productService.VibeCodingHubBeforeCheck(vibeCodingDto,
                Account,
                sendMethod, chatId);
            if (!result)
                return;
            var OpenAIOptions = new OpenAIOptions
            {
                ApiKey = aiModel.ApiKey,
                BaseDomain = aiModel.BaseUrl
            };
            var openAiService = new OpenAIService(OpenAIOptions);
            List<ChatMessage> chatMessages = new List<ChatMessage>();
            string systemPrompt = BuildSystemPrompt(vibeCodingDto, cacheContent);
            chatMessages.Add(ChatMessage.FromSystem(systemPrompt));
            input += systemPrompt;
            var chatMessagesHistory =
                await _productService.CreateVibeCodingChatMessage(chatId, Account, vibeCodingDto, aiModel, newChat);
            input += JsonConvert.SerializeObject(chatMessagesHistory);
            chatMessages.AddRange(chatMessagesHistory);
            var chatCompletionCreate = new ChatCompletionCreateRequest();
            chatCompletionCreate.Messages = chatMessages;
            chatCompletionCreate.Stream = vibeCodingDto.stream;
            chatCompletionCreate.Model = vibeCodingDto.aiModel;
            chatCompletionCreate.StreamOptions = new StreamOptions
            {
                IncludeUsage = true
            };
            var tikToken = TikToken.GetEncoding("o200k_base");
            var (semaphore, cancellationToken) = _chatCancellationManager.GetOrCreateToken(vibeCodingDto.chatgroupid);
            var completionResult = openAiService.ChatCompletion.CreateCompletionAsStream(chatCompletionCreate,
                chatCompletionCreate.Model, true, cancellationToken);
            bool insideThinkTag = false;
            await foreach (var responseContent in completionResult.WithCancellation(cancellationToken))
            {
                if (responseContent.Successful)
                {
                    var choice = responseContent.Choices.FirstOrDefault();
                    if (choice != null)
                    {
                        if (choice.Message != null)
                        {
                            if (!string.IsNullOrEmpty(choice.Message.Content))
                            {
                                string content = choice.Message.Content;

                                // 检查是否包含<think>开始标签
                                if (!insideThinkTag && content.Contains("<think>"))
                                {
                                    insideThinkTag = true;
                                    int startIndex = content.IndexOf("<think>");

                                    // 处理<think>标签前的内容
                                    if (startIndex > 0)
                                    {
                                        string beforeThink = content.Substring(0, startIndex);
                                        sysmsg += beforeThink;
                                        vibeCodingRes.message = beforeThink;
                                        await Clients.Group(chatId).SendAsync(sendMethod, vibeCodingRes);
                                        vibeCodingRes.message = "";
                                    }

                                    // 如果同时包含结束标签
                                    if (content.Contains("</think>"))
                                    {
                                        int endIndex = content.IndexOf("</think>");
                                        // 提取思考内容
                                        string thinkContent = content.Substring(startIndex + 7,
                                            endIndex - (startIndex + 7));
                                        thinkmsg += thinkContent;
                                        vibeCodingRes.reasoning = thinkContent;
                                        await Clients.Group(chatId).SendAsync(sendMethod, vibeCodingRes);
                                        vibeCodingRes.reasoning = "";

                                        // 处理</think>标签后的内容
                                        if (endIndex + 8 < content.Length)
                                        {
                                            string afterThink = content.Substring(endIndex + 8);
                                            sysmsg += afterThink;
                                            vibeCodingRes.message = afterThink;
                                            await Clients.Group(chatId).SendAsync(sendMethod, vibeCodingRes);
                                            vibeCodingRes.message = "";
                                        }

                                        insideThinkTag = false;
                                    }
                                    else
                                    {
                                        // 提取并发送<think>后的内容
                                        string thinkContent = content.Substring(startIndex + 7);
                                        thinkmsg += thinkContent;
                                        vibeCodingRes.reasoning = thinkContent;
                                        await Clients.Group(chatId).SendAsync(sendMethod, vibeCodingRes);
                                        vibeCodingRes.reasoning = "";
                                    }
                                }
                                // 检查是否包含</think>结束标签
                                else if (insideThinkTag && content.Contains("</think>"))
                                {
                                    int endIndex = content.IndexOf("</think>");

                                    // 处理</think>标签前的内容
                                    if (endIndex > 0)
                                    {
                                        string thinkContent = content.Substring(0, endIndex);
                                        thinkmsg += thinkContent;
                                        vibeCodingRes.reasoning = thinkContent;
                                        await Clients.Group(chatId).SendAsync(sendMethod, vibeCodingRes);
                                        vibeCodingRes.reasoning = "";
                                    }

                                    // 处理</think>标签后的内容
                                    if (endIndex + 8 < content.Length)
                                    {
                                        string afterThink = content.Substring(endIndex + 8);
                                        sysmsg += afterThink;
                                        vibeCodingRes.message = afterThink;
                                        await Clients.Group(chatId).SendAsync(sendMethod, vibeCodingRes);
                                        vibeCodingRes.message = "";
                                    }

                                    insideThinkTag = false;
                                }
                                // 如果已在<think>标签内，直接发送为思考内容
                                else if (insideThinkTag)
                                {
                                    thinkmsg += content;
                                    vibeCodingRes.reasoning = content;
                                    await Clients.Group(chatId).SendAsync(sendMethod, vibeCodingRes);
                                    vibeCodingRes.reasoning = "";
                                }
                                // 普通内容处理
                                else
                                {
                                    vibeCodingRes.reasoning = string.Empty;
                                    sysmsg += content;
                                    output += content;
                                    vibeCodingRes.message = content;
                                    await Clients.Group(chatId).SendAsync(sendMethod, vibeCodingRes);
                                }
                            }

                            if (!string.IsNullOrEmpty(choice.Message.ReasoningContent))
                            {
                                vibeCodingRes.message = string.Empty;
                                thinkmsg += choice.Message.ReasoningContent;
                                output += choice.Message.ReasoningContent;
                                vibeCodingRes.reasoning = choice.Message.ReasoningContent;
                                await Clients.Group(chatId).SendAsync(sendMethod, vibeCodingRes);
                            }
                        }

                        if (responseContent.Usage != null)
                        {
                            usageInput = responseContent.Usage.PromptTokens;
                            usageOutput = responseContent.Usage.CompletionTokens.Value;
                        }
                    }
                }
            }

            vibeCodingRes.message = string.Empty;
            vibeCodingRes.reasoning = string.Empty;
            vibeCodingRes.isFinished = true;
            await Clients.Group(chatId).SendAsync(sendMethod, vibeCodingRes);
            await _productService.SaveHistory(chatId, vibeCodingDto.chatgroupid, vibeCodingDto.aiModel, Account,
                vibeCodingDto.msg,
                sysmsg, thinkmsg, vibeCodingDto.shouldSave,
                vibeCodingDto.image_path.Count > 0 ? string.Join(",", vibeCodingDto.image_path) : null);
            if (usageInput == 0 || usageOutput == 0)
            {
                usageInput = tikToken.Encode(input).Count;
                usageOutput = tikToken.Encode(output).Count;
            }

            await _financeService.CreateUseLogAndUpadteMoney(Account, vibeCodingDto.aiModel,
                usageInput, usageOutput);
        }

        public override async Task OnConnectedAsync()
        {
            await base.OnConnectedAsync();
        }

        private string BuildSystemPrompt(VibeCodingDto vibeCodingDto, string cacheContent)
        {
            // Create file tool definition
            string createFilePrompt = BuildCreateFilePromptDefinition();

            // Edit file tool definition
            string editFilePrompt = BuildEditFilePromptDefinition();

            // Code base search tool definition
            string codeBaseSearchPrompt = BuildCodeBaseSearchPromptDefinition();

            // Web scraping tool definition
            string webScrapingPrompt = BuildWebScrapingPromptDefinition();

            // Determine which tools to include based on mode
            string toolsSection = vibeCodingDto.useMode == "chat"
                ? "# The code part should be as detailed and complete as possible."
                : $"{createFilePrompt}\n\n{editFilePrompt}";

            // Construct the full system prompt
            return $@"
# Role Info:

- You are a professional Coder Copilot who generates code based on user inquiries. 

- You must not write or assume any code you don't know, and speculation is not allowed. 

- For any documentation content you're unfamiliar with, you must use tools. 

- You can use tools without seeking user consent and without asking whether the user wishes to continue - just use them directly.

# The current mode is: {vibeCodingDto.useMode}. 

{(vibeCodingDto.useMode == "chat" ?
    "- chat mode:You are only permitted to use the **readfile_path** and **code_base_search** to read files and directly answer the user's programming questions.It is recommended to search first and then read, as this is more logical." :
    "- agent mode:You are free to use all tools to fulfill the user's requests.It is recommended to search first and then read, as this is more logical.")}

## Important Guidelines
- **Tools:** If a useful tool exists, it should be utilized.
- **Language:** Follow the user's language preference. Reply in the same language the user uses in their question.
- **Avoid Assumptions:** Do not make any assumptions about the user's question. This is considered a serious violation, as the program may be used for critical work.
- **No Assumed Code:** Do not write any code based on assumptions.
- **File Attention:** Pay attention to the files selected by the user.
- **Active Tool Usage:** Proactively use tools to obtain unknown content and make content modifications.
- **Limitations:** Use tools step by step. **Only one tool is allowed per response, and the user must reply before you use a second tool.**
- **Code:** In the context of code output, all code must reside within a single file; avoid any fragmentation or separate explanations.

## Tool Usage
- **IMPORTANT: You can only use one tool per response, and the tool call must be placed at the very end of your response.**
- When you need to use a tool, insert `<mcp></mcp>` at the end of your response.
- Content within `<mcp></mcp>` must follow the XML format and must be wrapped in <mcp></mcp> tags, otherwise it will not execute.
- You can only use the tools listed below. You cannot use tools that are not in the tool list. You can only use one tool per response.
- **No user consent needed. To improve the quality and credibility of your responses, you can use tools directly without requesting user consent or asking if they want to continue.**
- If the data obtained after using a tool is insufficient to answer the question, you can continue using tools.
- **You should actively use tools.**
- **code_base_search** is used to query the location of functional code (queries the code location based on file path and search keywords, returning only the start and end line numbers), and **readfile_path** is used to read the code content based on the code location (retrieves content based on file path and start and end line numbers). The two tools need to be used in conjunction.
## Editor and Project Information
{cacheContent}

## Guidelines
- Clearly analyze problems and plan solutions.

## Tool Usage Instructions:
- **IMPORTANT: You can only use one tool per response, and the tool call must be placed at the very end of your response.**
- When calling a tool, wrap the content with `<mcp></mcp>` tags.
- Content must follow the XML format.
- Only use the tools listed below.

## Available Tools

### **readfile_path**
- **Function**: Read the content of a file mentioned by the user but not provided.
- **Features**: It also allows the use of folder paths to list the files and paths under the folder.
**When the starting line number is not provided, you can try to use the code_base_search tool first.**
- **Important Notes**:
  - **Line Number Limits**:
    - **Minimum lines**: 300
    - **Maximum lines**: 800
  - **Explanation**: If a single read is insufficient to answer the question, you may continue using tools without requiring additional user approval.
- **Usage**: Insert the following XML payload at the end of your response:

<mcp>
<method>readfile_path</method>
<params>
<path>Relative file path. All paths must start with '/', file path or folders path</path>
<startLine>Starting line number (if folder,set to 1)</startLine>
<endLine>Ending line number (value should be greater than 300 and less than 800,if folder,set to 1)</endLine>
</params>
</mcp>

## **readfile_path** Usage Example
When a user asks how to implement a file upload feature, here's a correct response example:

'I'll help you implement the file upload feature. First, I need to check your project structure to understand the existing code.'

**Please ensure thorough grammar and code integrity checks, paying close attention to complete lines or functions that have been modified.**


<mcp>
<method>readfile_path</method>
<params>
<path>/Controllers/HomeController.cs</path>
<startLine>1</startLine>
<endLine>300</endLine>
</params>
</mcp>

{codeBaseSearchPrompt}

{webScrapingPrompt}

{toolsSection}

Note: Whenever you need to call a tool, simply insert the proper XML-formatted command within <mcp></mcp> tags at the end of your response. Remember to only use one tool per response.
";
        }

        // Builds the create_file tool prompt definition
        private string BuildCreateFilePromptDefinition()
        {
            return @"### **create_file**
- **Function**: Creates new files to fulfill feature requests,No user consent is required when creating files; it can be used directly.
- **Restriction**: Only one file can be created at a time.
- **Process**: Files are created directly, without requiring user confirmation.
- **Usage**: Output the complete code in one go, write the code into a file, and then inform the user of the new file's path.
- **Important**: When using this tool, ensure the XML is correctly formatted and valid,Code blocks should use CDATA tags to avoid parsing errors.

Insert the following XML payload at the end of your response:

<mcp>
<method>create_file</method>
<params>
<path>Relative file path. All paths must start with '/', only specific file paths are allowed, not folders</path>
<content>Code content to be added to the file. All code will be inserted as-is without formatting changes.</content>
</params>
</mcp>

## **create_file** Usage Example
When a user asks you to create a new controller for user management, here's a correct response example:

'I'll help you implement a new UserController. Here's the complete implementation with user management functionality:'

<mcp>
<method>create_file</method>
<params>
<path>/Controllers/UserController.cs</path>
<content>
<![CDATA[using System;
using System.Collections.Generic;
using Microsoft.AspNetCore.Mvc;

namespace MyApp.Controllers
{
    [ApiController]
    [Route(""api/[controller]"")]
    public class UserController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetUsers()
        {
            // Implementation here
            return Ok(new { message = ""Users retrieved successfully"" });
        }
        
        [HttpPost]
        public IActionResult CreateUser()
        {
            // Implementation here
            return Ok(new { message = ""User created successfully"" });
        }
    }
}]]>
</content>
</params>
</mcp>";
        }

        // Builds the edit_file tool prompt definition
        private string BuildEditFilePromptDefinition()
        {
            return @"### **edit_file**
    - **Function**: Edit existing files by precise line numbers. REQUIRED to validate line ranges with **readfile_path** or **code_base_search** before editing.
    - **Critical Requirements**:
        1. 100% line accuracy: ALWAYS call readfile_path or code_base_search immediately before editing to verify line numbers
        2. Fallback procedures:
           - If line mismatch detected ▸ RE-QUERY file contents
           - If full replacement impossible ▸ either:
             a) Request updated line ranges via readfile_path or code_base_search again OR
             b) Output partial code with CLEAR warnings
        3. Single file per operation
        4. No user confirmation required
        5. Be careful that code boundaries do not have extra or missing parentheses that can lead to syntax errors

    - **XML Specification**:
    <mcp>
    <method>edit_file</method>
    <params>
    <path>Absolute path starting with '/'. Folders prohibited</path>
    <content><![CDATA[Raw unmodified code]]></content>
    <startLine>Exact integer from readfile_path or code_base_search</startLine>
    <endLine>Exact integer from readfile_path or code_base_search</endLine>
    </params>
    </mcp>

    ## **Error Prevention Protocol**
    Follow STRICT line validation flow:
    1. Initial file query (readfile_path or code_base_search)
    2. Analyze context boundaries
    3. Verify ▸ Code between startLine-endLine matches expected content
    4. If ANY mismatch:
       a) [Preferred] Re-query file for new line numbers
       b) [Fallback] Output code with:
           - Visible WARNING markers
           - Context placeholders
           - Exact line number boundaries

    ## **Validation Failure Example**
    ❌ Invalid (Missing line check):
    <content>new code</content><startLine>50</startLine><endLine>55</endLine>

    ✅ Correct (Verified lines):
    <!-- VALIDATED via readfile_path or code_base_search @ 2024-02-20T14:30 -->
    <startLine>52</startLine><endLine>57</endLine>

    ## **Special Cases Handling**
    ▸ Cross-line Insertions: Break into multiple edit_file blocks
    ▸ Multi-file Edits: Create separate mcp blocks per file
    ▸ Ambiguous Locations: FIRST verify with 2-3 line code snippets

    ## **Strict Content Rules**
    1. Raw code only - NO:
       - Markdown formatting
       - Extra indentation
       - Commented explanations
    2. Preserve original:
       - Encoding
       - Line endings
       - BOM status
    3. CDATA REQUIRED for:
       - C# code
       - XML/HTML content
       - Any angle brackets usage";
        }

        private string BuildCodeBaseSearchPromptDefinition()
        {
            return @"
            ### **code_base_search**
            - **Function**: 
              * This tool is limited to searching within specific code files and cannot query entire folders.
              * Search for code in the code base
              * When user upload a file or ask you any file path,you can use this tool to search for code in the code base.
              * If the user provides a specific line number, please use readfile_path, not code_base_search.
              * this tool only return the code startLine and endLine,not the code content.you can use readfile_path to get the code content.
            
            - **Usage**: Insert the following XML payload at the end of your response:

            - **Differences from readfile_path**:
              * You can search for code in the code base.
              * There is no need to specify startLine and endLine like in readfile_path, because code_base_search searches the entire codebase, not specific lines.
              * In what situations should code_base_search be used?
                * When a user uploads a file, you can use code_base_search to check if that file exists in the codebase.
                * When a user asks you about any file path, you can use code_base_search to check if that file exists in the codebase.
            <mcp>
            <method>code_base_search</method>
            <params>
            <query>Search query,Search you wanna know code or function, like search engine,when the English is not good,you can use Chinese</query>
            <path>Relative file path. All paths must start with '/', Improtent:only specific file paths are allowed, not folders</path>
            </params>
            </mcp>
            ";
        }

        private string BuildWebScrapingPromptDefinition()
        {
            return @"### **web_scraping**
- **Function**:
  * Search the internet for information about development documentation, libraries, frameworks, or technical knowledge
  * Use when you need up-to-date information about APIs, documentation, or development resources that you're unfamiliar with
  * Retrieve current information about programming libraries, frameworks, or technical specifications
  * Get the latest documentation or examples for development tasks

- **When to use**:
  * When user asks about unfamiliar development libraries or frameworks
  * When you need current API documentation or examples
  * When user requests information about recent updates or features
  * When existing knowledge might be outdated and you need current information

- **Usage**: Insert the following XML payload at the end of your response:

<mcp>
<method>web_scraping</method>
<params>
<query>Search keywords describing what you want to find. Use specific terms like library names, API endpoints, or technical concepts</query>
</params>
</mcp>

## **web_scraping** Usage Example
When a user asks about a specific library or framework you're unfamiliar with:

'I need to search for the latest information about this development library to provide you with accurate guidance.'

<mcp>
<method>web_scraping</method>
<params>
<query>React 18 useEffect cleanup function best practices documentation</query>
</params>
</mcp>";
        }
    }
}