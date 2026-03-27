using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;
using System.Text.Json;

namespace aibotPro.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class MCPController : ControllerBase
    {
        private readonly IAiServer _aiServer;
        private readonly ISystemService _systemService;
        
        public MCPController(IAiServer aiServer, ISystemService systemService)
        {
            _aiServer = aiServer;
            _systemService = systemService;
        }
        
        /// <summary>
        /// 验证MCP配置
        /// </summary>
        [HttpPost("validate")]
        public async Task<IActionResult> ValidateConfig([FromBody] object config)
        {
            try
            {
                var account = User.Identity.Name;
                var result = await _aiServer.ValidateMCPConfig(config, account);
                
                if (result.Success)
                {
                    return Ok(new { success = true, message = result.Message });
                }
                else
                {
                    return Ok(new { success = false, message = result.Message, errors = result.Errors });
                }
            }
            catch (Exception ex)
            {
                await _systemService.WriteLog($"验证MCP配置失败: {ex.Message}", Dtos.LogLevel.Error, "MCP");
                return StatusCode(500, new { success = false, message = "验证配置失败" });
            }
        }
        
        /// <summary>
        /// 保存MCP配置
        /// </summary>
        [HttpPost("save")]
        public async Task<IActionResult> SaveConfig([FromBody] object config)
        {
            try
            {
                var account = User.Identity.Name;
                
                // 先验证配置
                var validationResult = await _aiServer.ValidateMCPConfig(config, account);
                if (!validationResult.Success)
                {
                    return Ok(new { success = false, message = validationResult.Message, errors = validationResult.Errors });
                }
                
                // 保存配置
                var result = await _aiServer.SaveMCPConfig(config, account);
                
                if (result.Success)
                {
                    return Ok(new { success = true, message = result.Message });
                }
                else
                {
                    return Ok(new { success = false, message = result.Message });
                }
            }
            catch (Exception ex)
            {
                await _systemService.WriteLog($"保存MCP配置失败: {ex.Message}", Dtos.LogLevel.Error, "MCP");
                return StatusCode(500, new { success = false, message = "保存配置失败" });
            }
        }
        
        /// <summary>
        /// 加载MCP服务器
        /// </summary>
        [HttpPost("load-servers")]
        public async Task<IActionResult> LoadServers([FromBody] object config)
        {
            try
            {
                var account = User.Identity.Name;
                var result = await _aiServer.LoadMCPServers(config, account);
                
                if (result.Success)
                {
                    return Ok(new 
                    { 
                        success = true, 
                        message = result.Message,
                        servers = result.Servers,
                        tools = result.Tools
                    });
                }
                else
                {
                    return Ok(new { success = false, message = result.Message });
                }
            }
            catch (Exception ex)
            {
                await _systemService.WriteLog($"加载MCP服务器失败: {ex.Message}", Dtos.LogLevel.Error, "MCP");
                return StatusCode(500, new { success = false, message = "加载服务器失败" });
            }
        }
        
        /// <summary>
        /// 获取MCP工具列表
        /// </summary>
        [HttpGet("tools")]
        public async Task<IActionResult> GetTools()
        {
            try
            {
                var account = User.Identity.Name;
                var result = await _aiServer.GetMCPTools(account);
                
                if (result.Success)
                {
                    return Ok(new 
                    { 
                        success = true, 
                        message = result.Message,
                        tools = result.Tools
                    });
                }
                else
                {
                    return Ok(new { success = false, message = result.Message });
                }
            }
            catch (Exception ex)
            {
                await _systemService.WriteLog($"获取MCP工具列表失败: {ex.Message}", Dtos.LogLevel.Error, "MCP");
                return StatusCode(500, new { success = false, message = "获取工具列表失败" });
            }
        }
        
        /// <summary>
        /// 执行MCP工具
        /// </summary>
        [HttpPost("execute-tool")]
        public async Task<IActionResult> ExecuteTool([FromBody] MCPExecuteToolRequest request)
        {
            try
            {
                var account = User.Identity.Name;
                MCPExecuteToolResult result;
                
                if (!string.IsNullOrEmpty(request.ServerName))
                {
                    // 如果指定了服务器名称，使用指定服务器执行
                    result = await _aiServer.ExecuteMCPTool(request.ToolName, request.Arguments, account, request.ServerName);
                }
                else
                {
                    // 否则使用默认方式执行
                    result = await _aiServer.ExecuteMCPTool(request.ToolName, request.Arguments, account);
                }
                
                if (result.Success)
                {
                    return Ok(new 
                    { 
                        success = true, 
                        message = result.Message,
                        result = result.Result
                    });
                }
                else
                {
                    return Ok(new { success = false, message = result.Message });
                }
            }
            catch (Exception ex)
            {
                await _systemService.WriteLog($"执行MCP工具失败: {ex.Message}", Dtos.LogLevel.Error, "MCP");
                return StatusCode(500, new { success = false, message = "执行工具失败" });
            }
        }
        
        /// <summary>
        /// 清空MCP配置
        /// </summary>
        [HttpPost("clear")]
        public async Task<IActionResult> ClearConfig()
        {
            try
            {
                var account = User.Identity.Name;
                var result = await _aiServer.ClearMCPConfig(account);
                
                if (result.Success)
                {
                    return Ok(new { success = true, message = result.Message });
                }
                else
                {
                    return Ok(new { success = false, message = result.Message });
                }
            }
            catch (Exception ex)
            {
                await _systemService.WriteLog($"清空MCP配置失败: {ex.Message}", Dtos.LogLevel.Error, "MCP");
                return StatusCode(500, new { success = false, message = "清空配置失败" });
            }
        }
        
        /// <summary>
        /// 获取用户的MCP配置
        /// </summary>
        [HttpGet("config")]
        public async Task<IActionResult> GetConfig()
        {
            try
            {
                var account = User.Identity.Name;
                
                // 从数据库获取配置
                var context = HttpContext.RequestServices.GetService<AIBotProContext>();
                var userMcp = await context.UserMCPs.FirstOrDefaultAsync(x => x.Account == account);
                
                if (userMcp != null && !string.IsNullOrEmpty(userMcp.MCPConfig))
                {
                    var config = JsonSerializer.Deserialize<object>(userMcp.MCPConfig);
                    return Ok(new 
                    { 
                        success = true,
                        config = config
                    });
                }
                else
                {
                    return Ok(new 
                    { 
                        success = true,
                        config =""
                    });
                }
            }
            catch (Exception ex)
            {
                await _systemService.WriteLog($"获取MCP配置失败: {ex.Message}", Dtos.LogLevel.Error, "MCP");
                return StatusCode(500, new { success = false, message = "获取配置失败" });
            }
        }
    }
    
    public class MCPExecuteToolRequest
    {
        public string ToolName { get; set; }
        public object Arguments { get; set; }
        public string ServerName { get; set; }
    }
}