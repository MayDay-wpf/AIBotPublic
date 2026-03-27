using ModelContextProtocol.Client;
using aibotPro.Dtos;

namespace aibotPro.Interface
{
    public interface IMcpService
    {
        /// <summary>
        /// 初始化MCP客户端
        /// </summary>
        Task<bool> InitializeClientAsync(string account, object config);
        
        /// <summary>
        /// 获取指定账户的MCP客户端
        /// </summary>
        IMcpClient? GetClient(string account);
        
        /// <summary>
        /// 获取指定账户的所有MCP客户端
        /// </summary>
        Dictionary<string, IMcpClient> GetAllClients(string account);
        
        /// <summary>
        /// 根据服务器名称获取指定账户的MCP客户端
        /// </summary>
        IMcpClient? GetClientByServerName(string account, string serverName);
        
        /// <summary>
        /// 验证MCP配置
        /// </summary>
        Task<MCPValidationResult> ValidateConfigAsync(object config);
        
        /// <summary>
        /// 保存MCP配置
        /// </summary>
        Task<MCPSaveResult> SaveConfigAsync(object config, string account);
        
        /// <summary>
        /// 清空MCP配置
        /// </summary>
        Task<MCPSaveResult> ClearConfigAsync(string account);
        
        /// <summary>
        /// 加载MCP服务器
        /// </summary>
        Task<MCPLoadServersResult> LoadServersAsync(object config, string account);
        
        /// <summary>
        /// 执行MCP工具
        /// </summary>
        Task<MCPExecuteToolResult> ExecuteToolAsync(string toolName, object arguments, string account);
        
        /// <summary>
        /// 执行MCP工具（指定服务器）
        /// </summary>
        Task<MCPExecuteToolResult> ExecuteToolAsync(string toolName, object arguments, string account, string serverName);
        
        /// <summary>
        /// 获取可用的MCP工具列表
        /// </summary>
        Task<MCPGetToolsResult> GetToolsAsync(string account);
        
        /// <summary>
        /// 检查用户是否有MCP配置
        /// </summary>
        Task<bool> HasMCPConfigAsync(string account);
        
        /// <summary>
        /// 释放客户端资源
        /// </summary>
        Task DisposeClientAsync(string account);
    }
}
