using System.ComponentModel.DataAnnotations;

namespace aibotPro.Dtos
{
    // MCP 验证结果
    public class MCPValidationResult
    {
        public bool Success { get; set; }
        public bool IsValid { get; set; }
        public string Message { get; set; }
        public List<string> Errors { get; set; } = new List<string>();
    }

    // MCP 保存结果  
    public class MCPSaveResult
    {
        public bool Success { get; set; }
        public string Message { get; set; }
    }

    // MCP 服务信息
    public class MCPServerInfo
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public string Type { get; set; } // STDIO, HTTP, SSE
        public string Command { get; set; }
        public List<string> Args { get; set; }
        public Dictionary<string, string> Env { get; set; }
        public string Url { get; set; }
        public string Method { get; set; }
        public string Status { get; set; }
        public string StatusText { get; set; }
        public string Error { get; set; }
        public List<MCPToolInfo> Tools { get; set; } = new List<MCPToolInfo>();
    }

    // MCP 工具信息
    public class MCPToolInfo
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public object InputSchema { get; set; }
        public object Parameters { get; set; }
        public string ServerName { get; set; }
    }

    // MCP 加载服务结果
    public class MCPLoadServersResult
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public List<MCPServerInfo> Servers { get; set; } = new List<MCPServerInfo>();
        public List<MCPToolInfo> Tools { get; set; } = new List<MCPToolInfo>();
    }

    // MCP 执行工具结果
    public class MCPExecuteToolResult
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public object Result { get; set; }
    }

    // MCP 获取工具列表结果
    public class MCPGetToolsResult
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public List<MCPToolInfo> Tools { get; set; } = new List<MCPToolInfo>();
    }

    // MCP 服务配置
    public class MCPServerConfig
    {
        // STDIO类型服务配置
        public string Command { get; set; }
        public List<string> Args { get; set; } = new List<string>();
        public Dictionary<string, string> Env { get; set; } = new Dictionary<string, string>();
        
        // HTTP/SSE类型服务配置
        public string Url { get; set; }
        public string Method { get; set; } // http, sse
    }

    // MCP 配置根对象
    public class MCPConfig
    {
        public Dictionary<string, MCPServerConfig> Servers { get; set; } = new Dictionary<string, MCPServerConfig>();
    }
}