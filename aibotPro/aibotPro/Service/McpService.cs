using System.Collections.Concurrent;
using System.Text.Json;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using ModelContextProtocol.Client;
using aibotPro.Dtos;
using aibotPro.Interface;
using aibotPro.Models;

namespace aibotPro.Service
{
    public class McpService : IMcpService
    {
        private readonly ConcurrentDictionary<string, Dictionary<string, IMcpClient>> _clients = new();
        private readonly ConcurrentDictionary<string, List<McpServerConfig>> _userConfigs = new();
        private readonly ISystemService _systemService;
        private readonly AIBotProContext _context;
        private readonly IRedisService _redisService;

        public McpService(ISystemService systemService, AIBotProContext context, IRedisService redisService)
        {
            _systemService = systemService;
            _context = context;
            _redisService = redisService;
        }

        public async Task<bool> InitializeClientAsync(string account, object config)
        {
            try
            {
                // 解析配置
                var mcpConfig = ParseConfig(config);
                if (mcpConfig == null || !mcpConfig.Servers.Any())
                {
                    return false;
                }

                // 清理旧的客户端
                await DisposeClientAsync(account);

                var clientsForUser = new Dictionary<string, IMcpClient>();
                var successCount = 0;
                var totalCount = mcpConfig.Servers.Count;

                // 为每个配置的服务器创建客户端
                foreach (var serverKvp in mcpConfig.Servers)
                {
                    var serverName = serverKvp.Key;
                    var serverConfig = serverKvp.Value;
                    var transport = serverConfig.GetTransport();

                    try
                    {
                        IMcpClient? mcpClient = null;

                        if (transport.Type?.ToLower() == "stdio" && !string.IsNullOrEmpty(transport.Command))
                        {
                            // 根据文档创建 STDIO 传输的 MCP 客户端
                            var clientTransport = new StdioClientTransport(new StdioClientTransportOptions
                            {
                                Name = serverConfig.Description ?? serverName,
                                Command = transport.Command,
                                Arguments = transport.Args?.ToArray() ?? Array.Empty<string>()
                            });

                            mcpClient = await McpClientFactory.CreateAsync(clientTransport);
                        }
                        else if (!string.IsNullOrEmpty(transport.Url))
                        {
                           // 使用SSE 自动适应 HTTP
                            var clientTransport = new SseClientTransport(new SseClientTransportOptions
                            {
                                Name = serverConfig.Description ?? serverName,
                                Endpoint = new Uri(transport.Url),
                                TransportMode = HttpTransportMode.AutoDetect
                            });

                            mcpClient = await McpClientFactory.CreateAsync(clientTransport);
                        }

                        if (mcpClient != null)
                        {
                            clientsForUser[serverName] = mcpClient;
                            successCount++;
                        }
                    }
                    catch (Exception ex)
                    {
                        await _systemService.WriteLog($"初始化MCP客户端失败 {serverName}: {ex.Message}", Dtos.LogLevel.Error, account);
                    }
                }

                if (clientsForUser.Any())
                {
                    _clients[account] = clientsForUser;
                    _userConfigs[account] = mcpConfig.GetServersList();
                    return true;
                }
                return false;
            }
            catch (Exception ex)
            {
                await _systemService.WriteLog($"初始化MCP客户端失败: {ex.Message}", Dtos.LogLevel.Error, account);
                return false;
            }
        }

        public IMcpClient? GetClient(string account)
        {
            if (_clients.TryGetValue(account, out var clients) && clients.Any())
            {
                return clients.First().Value; // 返回第一个客户端用于兼容性
            }
            return null;
        }

        public Dictionary<string, IMcpClient> GetAllClients(string account)
        {
            _clients.TryGetValue(account, out var clients);
            return clients ?? new Dictionary<string, IMcpClient>();
        }

        public IMcpClient? GetClientByServerName(string account, string serverName)
        {
            if (_clients.TryGetValue(account, out var clients))
            {
                clients.TryGetValue(serverName, out var client);
                return client;
            }
            return null;
        }

        public Task<MCPValidationResult> ValidateConfigAsync(object config)
        {
            var result = new MCPValidationResult
            {
                Success = false,
                IsValid = false,
                Errors = new List<string>()
            };

            try
            {
                var mcpConfig = ParseConfig(config);

                if (mcpConfig == null)
                {
                    result.Errors.Add("配置格式无效");
                    return Task.FromResult(result);
                }

                // 允许空配置（用户可以不使用MCP服务）
                if (mcpConfig.Servers == null || !mcpConfig.Servers.Any())
                {
                    result.IsValid = true;
                    result.Success = true;
                    result.Message = "空配置验证成功";
                    return Task.FromResult(result);
                }

                foreach (var kvp in mcpConfig.Servers)
                {
                    var serverName = kvp.Key;
                    var server = kvp.Value;

                    if (string.IsNullOrEmpty(serverName))
                    {
                        result.Errors.Add("服务器名称不能为空");
                        continue;
                    }

                    // 检查是否有有效的连接配置
                    if (string.IsNullOrEmpty(server.Url) && string.IsNullOrEmpty(server.Command))
                    {
                        result.Errors.Add($"服务器 {serverName} 需要配置 URL（用于 SSE/HTTP）或 Command（用于 STDIO）");
                        continue;
                    }

                    // 验证 URL 格式
                    if (!string.IsNullOrEmpty(server.Url))
                    {
                        if (!Uri.TryCreate(server.Url, UriKind.Absolute, out var uri))
                        {
                            result.Errors.Add($"服务器 {serverName} 的 URL 格式无效");
                        }
                        else if (uri.Scheme != "http" && uri.Scheme != "https")
                        {
                            result.Errors.Add($"服务器 {serverName} 的 URL 必须使用 http 或 https 协议");
                        }
                    }
                }

                result.IsValid = !result.Errors.Any();
                result.Success = result.IsValid;
                result.Message = result.IsValid ? "配置验证成功" : "配置验证失败";

                return Task.FromResult(result);
            }
            catch (Exception ex)
            {
                result.Errors.Add($"验证配置时出错: {ex.Message}");
                result.Message = "配置验证失败";
                result.Success = false;
                result.IsValid = false;
                return Task.FromResult(result);
            }
        }

        public async Task<MCPSaveResult> SaveConfigAsync(object config, string account)
        {
            var result = new MCPSaveResult
            {
                Success = false
            };

            try
            {
                // 检查是否为空配置
                var mcpConfig = ParseConfig(config);
                bool isEmptyConfig = mcpConfig == null || mcpConfig.Servers == null || !mcpConfig.Servers.Any();
                
                if (!isEmptyConfig)
                {
                    // 非空配置需要验证
                    var validationResult = await ValidateConfigAsync(config);
                    if (!validationResult.IsValid)
                    {
                        result.Message = string.Join("; ", validationResult.Errors);
                        return result;
                    }
                }

                // 序列化配置
                var configJson = JsonSerializer.Serialize(config);

                // 保存到Redis缓存
                var cacheKey = $"mcp_config:{account}";
                await _redisService.SetAsync(cacheKey, configJson, TimeSpan.FromDays(30));

                // 保存到数据库
                var existingConfig = await _context.UserMCPs
                    .FirstOrDefaultAsync(c => c.Account == account);

                if (existingConfig != null)
                {
                    existingConfig.MCPConfig = configJson;
                }
                else
                {
                    var newConfig = new UserMCP
                    {
                        Account = account,
                        MCPConfig = configJson,
                        CreateTime = DateTime.Now
                    };
                    await _context.UserMCPs.AddAsync(newConfig);
                }

                await _context.SaveChangesAsync();

                // 清理旧的缓存数据（因为配置已变更）
                try
                {
                    var oldConfigHashCacheKey = GetConfigHashCacheKey(account);
                    var oldConfigHash = await _redisService.GetAsync(oldConfigHashCacheKey);
                    
                    if (!string.IsNullOrEmpty(oldConfigHash))
                    {
                        // 删除基于旧配置哈希的缓存
                        var oldToolsCacheKey = GetToolsCacheKey(account, oldConfigHash);
                        var oldServersCacheKey = GetServersCacheKey(account, oldConfigHash);
                        
                        await _redisService.DeleteAsync(oldToolsCacheKey);
                        await _redisService.DeleteAsync(oldServersCacheKey);
                    }
                    
                    // 删除配置哈希缓存，下次获取时会重新计算
                    await _redisService.DeleteAsync(oldConfigHashCacheKey);
                }
                catch (Exception cacheEx)
                {
                    await _systemService.WriteLog($"清理MCP缓存失败: {cacheEx.Message}", Dtos.LogLevel.Warn, account);
                }

                result.Success = true;
                result.Message = "配置保存成功";
                return result;
            }
            catch (Exception ex)
            {
                result.Message = $"保存配置失败: {ex.Message}";
                await _systemService.WriteLog($"保存MCP配置失败: {ex.Message}", Dtos.LogLevel.Error, account);
                return result;
            }
        }

        public async Task<MCPSaveResult> ClearConfigAsync(string account)
        {
            var result = new MCPSaveResult
            {
                Success = false
            };

            try
            {
                // 1. 关闭并清理现有的MCP客户端连接
                await DisposeClientAsync(account);

                // 2. 清理数据库中的配置
                var existingConfig = await _context.UserMCPs
                    .FirstOrDefaultAsync(c => c.Account == account);

                if (existingConfig != null)
                {
                    existingConfig.MCPConfig = JsonSerializer.Serialize(new { servers = new { } });
                    await _context.SaveChangesAsync();
                }

                // 3. 清理Redis中的所有相关缓存
                try
                {
                    // 清理配置缓存
                    var configCacheKey = $"mcp_config:{account}";
                    await _redisService.DeleteAsync(configCacheKey);

                    // 清理配置哈希缓存
                    var configHashCacheKey = GetConfigHashCacheKey(account);
                    var configHash = await _redisService.GetAsync(configHashCacheKey);
                    
                    if (!string.IsNullOrEmpty(configHash))
                    {
                        // 清理基于配置哈希的缓存
                        var toolsCacheKey = GetToolsCacheKey(account, configHash);
                        var serversCacheKey = GetServersCacheKey(account, configHash);
                        
                        await _redisService.DeleteAsync(toolsCacheKey);
                        await _redisService.DeleteAsync(serversCacheKey);
                    }
                    
                    // 清理配置哈希缓存
                    await _redisService.DeleteAsync(configHashCacheKey);

                    // 清理其他可能存在的缓存键（基于已知的模式）
                    // 由于无法使用模式匹配删除，这里只能删除已知的缓存键
                    var additionalCacheKeys = new[]
                    {
                        $"mcp_config:{account}",
                        $"mcp_config_hash:{account}"
                    };

                    foreach (var key in additionalCacheKeys)
                    {
                        try
                        {
                            await _redisService.DeleteAsync(key);
                        }
                        catch (Exception keyEx)
                        {
                            await _systemService.WriteLog($"清理MCP缓存键 {key} 失败: {keyEx.Message}", Dtos.LogLevel.Warn, account);
                        }
                    }
                }
                catch (Exception cacheEx)
                {
                    await _systemService.WriteLog($"清理MCP缓存失败: {cacheEx.Message}", Dtos.LogLevel.Warn, account);
                }

                result.Success = true;
                result.Message = "MCP配置已清空，所有相关缓存已清理";
                
                return result;
            }
            catch (Exception ex)
            {
                result.Message = $"清空配置失败: {ex.Message}";
                await _systemService.WriteLog($"清空MCP配置失败: {ex.Message}", Dtos.LogLevel.Error, account);
                return result;
            }
        }

        public async Task<MCPLoadServersResult> LoadServersAsync(object config, string account)
        {
            var result = new MCPLoadServersResult
            {
                Success = false,
                Servers = new List<MCPServerInfo>(),
                Tools = new List<MCPToolInfo>()
            };

            try
            {
                // 1. 计算配置哈希值
                var configHash = ComputeConfigHash(config);
                var configHashCacheKey = GetConfigHashCacheKey(account);
                var cachedConfigHash = await _redisService.GetAsync(configHashCacheKey);

                // 2. 检查是否有缓存的服务器和工具信息且配置未变更
                var serversCacheKey = GetServersCacheKey(account, configHash);
                var toolsCacheKey = GetToolsCacheKey(account, configHash);
                
                if (configHash == cachedConfigHash)
                {
                    // 尝试从缓存获取服务器信息
                    var cachedServersJson = await _redisService.GetAsync(serversCacheKey);
                    var cachedToolsJson = await _redisService.GetAsync(toolsCacheKey);

                    if (!string.IsNullOrEmpty(cachedServersJson) && !string.IsNullOrEmpty(cachedToolsJson))
                    {
                        try
                        {
                            var cachedServers = JsonSerializer.Deserialize<List<MCPServerInfo>>(cachedServersJson);
                            var cachedTools = JsonSerializer.Deserialize<List<MCPToolInfo>>(cachedToolsJson);

                            if (cachedServers != null && cachedTools != null)
                            {
                                result.Success = true;
                                result.Servers = cachedServers;
                                result.Tools = cachedTools;
                                result.Message = $"从缓存加载 {result.Servers.Count} 个MCP服务器，{result.Tools.Count} 个工具";
                                return result;
                            }
                        }
                        catch (Exception cacheEx)
                        {
                            await _systemService.WriteLog($"解析缓存的服务器信息失败: {cacheEx.Message}", Dtos.LogLevel.Warn, account);
                        }
                    }
                }

                // 3. 缓存未命中或配置已变更，需要重新初始化和获取
                var initSuccess = await InitializeClientAsync(account, config);
                if (!initSuccess)
                {
                    result.Message = "初始化MCP客户端失败";
                    return result;
                }

                var allClients = GetAllClients(account);
                if (!allClients.Any())
                {
                    result.Message = "MCP客户端未初始化";
                    return result;
                }

                var mcpConfig = ParseConfig(config);
                if (mcpConfig?.Servers != null)
                {
                    foreach (var kvp in mcpConfig.Servers)
                    {
                        var serverName = kvp.Key;
                        var serverConfig = kvp.Value;
                        var transport = serverConfig.GetTransport();
                        var mcpClient = GetClientByServerName(account, serverName);

                        try
                        {
                            // 使用 MCP SDK 获取服务器信息
                            var serverInfo = new MCPServerInfo
                            {
                                Name = serverName,
                                Description = serverConfig.Description ?? "",
                                Type = transport.Type?.ToUpper() ?? "UNKNOWN",
                                Command = transport.Command ?? "",
                                Args = transport.Args ?? new List<string>(),
                                Env = transport.Env ?? new Dictionary<string, string>(),
                                Url = transport.Url ?? "",
                                Method = transport.Type ?? ""
                            };

                            // 尝试连接服务器并获取状态
                            if (mcpClient != null)
                            {
                                try
                                {
                                    serverInfo.Status = "connected";
                                    serverInfo.StatusText = "已连接";
                                }
                                catch (Exception ex)
                                {
                                    serverInfo.Status = "error";
                                    serverInfo.StatusText = $"连接失败: {ex.Message}";
                                    serverInfo.Error = ex.Message;

                                    await _systemService.WriteLog($"MCP服务器连接失败 {serverName}: {ex.Message}",
                                        Dtos.LogLevel.Error, account);
                                }
                            }
                            else
                            {
                                serverInfo.Status = "error";
                                serverInfo.StatusText = "初始化失败";
                                serverInfo.Error = "服务器初始化失败";
                            }

                            result.Servers.Add(serverInfo);
                        }
                        catch (Exception ex)
                        {
                            await _systemService.WriteLog($"处理MCP服务器配置失败 {serverName}: {ex.Message}",
                                Dtos.LogLevel.Error, account);
                        }
                    }

                    // 从所有客户端获取工具列表
                    foreach (var clientKvp in allClients)
                    {
                        var serverName = clientKvp.Key;
                        var mcpClient = clientKvp.Value;
                        
                        try
                        {
                                                    var tools = await mcpClient.ListToolsAsync();
                        if (tools != null)
                        {
                            foreach (var tool in tools)
                            {
                                // 从JsonSchema中提取参数定义
                                object parameters = new { };
                                try
                                {
                                    if (tool.JsonSchema.ValueKind != JsonValueKind.Undefined && 
                                        tool.JsonSchema.ValueKind != JsonValueKind.Null)
                                    {
                                        // 将JsonElement转换为对象
                                        var jsonString = tool.JsonSchema.GetRawText();
                                        parameters = JsonSerializer.Deserialize<object>(jsonString) ?? new { };
                                    }
                                }
                                catch (Exception paramEx)
                                {
                                    await _systemService.WriteLog($"解析工具参数失败 [{tool.Name}]: {paramEx.Message}", Dtos.LogLevel.Warn, account);
                                }

                                result.Tools.Add(new MCPToolInfo
                                {
                                    Name = tool.Name,
                                    Description = tool.Description,
                                    Parameters = parameters,
                                    ServerName = serverName // 使用服务器名作为标识
                                });
                            }
                        }
                        }
                        catch (Exception ex)
                        {
                            await _systemService.WriteLog($"获取MCP服务器 {serverName} 工具列表失败: {ex.Message}", Dtos.LogLevel.Error, account);
                        }
                    }
                }

                // 4. 缓存服务器信息和工具列表
                if (result.Servers.Any() || result.Tools.Any())
                {
                    try
                    {
                        var serversJson = JsonSerializer.Serialize(result.Servers);
                        var toolsJson = JsonSerializer.Serialize(result.Tools);
                        
                        await _redisService.SetAsync(serversCacheKey, serversJson, TimeSpan.FromHours(2)); // 服务器信息缓存2小时
                        await _redisService.SetAsync(toolsCacheKey, toolsJson, TimeSpan.FromHours(2)); // 工具列表缓存2小时
                        await _redisService.SetAsync(configHashCacheKey, configHash, TimeSpan.FromDays(30)); // 配置哈希缓存30天
                    }
                    catch (Exception cacheEx)
                    {
                        await _systemService.WriteLog($"缓存服务器信息失败: {cacheEx.Message}", Dtos.LogLevel.Warn, account);
                    }
                }

                result.Success = true;
                result.Message = $"成功加载 {result.Servers.Count} 个MCP服务器，{result.Tools.Count} 个工具";

                return result;
            }
            catch (Exception ex)
            {
                result.Message = $"加载MCP服务器失败: {ex.Message}";
                await _systemService.WriteLog($"加载MCP服务器失败: {ex.Message}", Dtos.LogLevel.Error, account);
                return result;
            }
        }

        public async Task<MCPExecuteToolResult> ExecuteToolAsync(string toolName, object arguments, string account)
        {
            return await ExecuteToolAsync(toolName, arguments, account, "");
        }

        public async Task<MCPExecuteToolResult> ExecuteToolAsync(string toolName, object arguments, string account, string serverName)
        {
            var result = new MCPExecuteToolResult
            {
                Success = false
            };

            try
            {
                IMcpClient? mcpClient = null;
                
                if (!string.IsNullOrEmpty(serverName))
                {
                    // 精准连接指定服务器
                    mcpClient = await GetOrCreateClientByServerName(account, serverName);
                }
                else
                {
                    // 如果没有指定服务器，尝试从所有客户端中找到包含该工具的客户端
                    var allClients = GetAllClients(account);
                    foreach (var clientKvp in allClients)
                    {
                        try
                        {
                            var tools = await clientKvp.Value.ListToolsAsync();
                            if (tools != null && tools.Any(t => t.Name == toolName))
                            {
                                mcpClient = clientKvp.Value;
                                serverName = clientKvp.Key ?? "";
                                break;
                            }
                        }
                        catch (Exception ex)
                        {
                            await _systemService.WriteLog($"检查工具时出错 {clientKvp.Key}: {ex.Message}", Dtos.LogLevel.Warn, account);
                        }
                    }
                }

                // 如果客户端未找到，尝试自动初始化
                if (mcpClient == null)
                {
                    // 尝试从缓存或数据库获取配置并初始化客户端
                    var autoInitSuccess = await TryAutoInitializeClientAsync(account);
                    if (autoInitSuccess)
                    {
                        // 重新尝试获取客户端
                        if (!string.IsNullOrEmpty(serverName))
                        {
                            mcpClient = GetClientByServerName(account, serverName);
                        }
                        else
                        {
                            // 重新搜索包含该工具的客户端
                            var allClients = GetAllClients(account);
                            foreach (var clientKvp in allClients)
                            {
                                try
                                {
                                    var tools = await clientKvp.Value.ListToolsAsync();
                                    if (tools != null && tools.Any(t => t.Name == toolName))
                                    {
                                        mcpClient = clientKvp.Value;
                                        serverName = clientKvp.Key ?? "";
                                        break;
                                    }
                                }
                                catch (Exception ex)
                                {
                                    await _systemService.WriteLog($"自动初始化后检查工具时出错 {clientKvp.Key}: {ex.Message}", Dtos.LogLevel.Warn, account);
                                }
                            }
                        }
                    }
                }

                if (mcpClient == null)
                {
                    result.Message = string.IsNullOrEmpty(serverName) 
                        ? $"未找到包含工具 {toolName} 的MCP服务器，且自动初始化失败" 
                        : $"MCP客户端未初始化或服务器 {serverName ?? ""} 不存在，且自动初始化失败";
                    return result;
                }

                // 根据文档使用 MCP SDK 执行工具
                try
                {
                    var parameters = new Dictionary<string, object?>();
                    if (arguments != null)
                    {
                        // 处理不同类型的参数
                        if (arguments is string jsonString)
                        {
                            // 如果参数是字符串，直接反序列化
                            try
                            {
                                parameters = JsonSerializer.Deserialize<Dictionary<string, object?>>(jsonString) ?? new();
                            }
                            catch (JsonException)
                            {
                                // 如果无法反序列化为Dictionary，尝试解析为JsonElement再转换
                                try
                                {
                                    var jsonElement = JsonSerializer.Deserialize<JsonElement>(jsonString);
                                    parameters = ConvertJsonElementToDictionary(jsonElement);
                                }
                                catch (Exception parseEx)
                                {
                                    await _systemService.WriteLog($"解析工具参数失败 {toolName}: {parseEx.Message}, 原始参数: {jsonString}", Dtos.LogLevel.Error, account);
                                    result.Message = $"工具参数格式错误: {parseEx.Message}";
                                    return result;
                                }
                            }
                        }
                        else
                        {
                            // 如果参数不是字符串，先序列化再反序列化
                            try
                            {
                                var json = JsonSerializer.Serialize(arguments);
                                parameters = JsonSerializer.Deserialize<Dictionary<string, object?>>(json) ?? new();
                            }
                            catch (JsonException)
                            {
                                // 如果无法反序列化为Dictionary，尝试转换
                                try
                                {
                                    var json = JsonSerializer.Serialize(arguments);
                                    var jsonElement = JsonSerializer.Deserialize<JsonElement>(json);
                                    parameters = ConvertJsonElementToDictionary(jsonElement);
                                }
                                catch (Exception parseEx)
                                {
                                    await _systemService.WriteLog($"解析工具参数失败 {toolName}: {parseEx.Message}, 参数类型: {arguments.GetType()}", Dtos.LogLevel.Error, account);
                                    result.Message = $"工具参数格式错误: {parseEx.Message}";
                                    return result;
                                }
                            }
                        }
                    }

                    var toolResult = await mcpClient.CallToolAsync(toolName, parameters);

                    if (toolResult?.Content != null && toolResult.Content.Any())
                    {
                        // 处理工具调用结果
                        result.Success = true;
                        result.Result = JsonSerializer.Serialize(toolResult.Content);
                        result.Message = "工具执行成功";
                    }
                    else
                    {
                        result.Message = "工具执行返回空结果";
                    }
                }
                catch (Exception mcpEx)
                {
                    result.Message = $"MCP工具执行错误: {mcpEx.Message}";
                    await _systemService.WriteLog($"MCP工具执行错误 {toolName} (服务器: {serverName ?? ""}): {mcpEx.Message}", Dtos.LogLevel.Error,
                        account);
                }

                return result;
            }
            catch (Exception ex)
            {
                result.Message = $"执行工具失败: {ex.Message}";
                await _systemService.WriteLog($"执行MCP工具失败: {ex.Message}", Dtos.LogLevel.Error, account);
                return result;
            }
        }

        /// <summary>
        /// 检查用户是否有MCP配置
        /// </summary>
        public async Task<bool> HasMCPConfigAsync(string account)
        {
            try
            {
                // 1. 先从缓存检查
                var cacheKey = $"mcp_config:{account}";
                var configJson = await _redisService.GetAsync(cacheKey);

                if (!string.IsNullOrEmpty(configJson))
                {
                    // 检查配置是否为空配置
                    var config = JsonSerializer.Deserialize<object>(configJson);
                    var mcpConfig = ParseConfig(config);
                    return mcpConfig?.Servers != null && mcpConfig.Servers.Any();
                }

                // 2. 从数据库检查
                var dbConfig = await _context.UserMCPs
                    .FirstOrDefaultAsync(c => c.Account == account);

                if (dbConfig != null && !string.IsNullOrEmpty(dbConfig.MCPConfig))
                {
                    var config = JsonSerializer.Deserialize<object>(dbConfig.MCPConfig);
                    var mcpConfig = ParseConfig(config);
                    return mcpConfig?.Servers != null && mcpConfig.Servers.Any();
                }

                return false;
            }
            catch (Exception ex)
            {
                await _systemService.WriteLog($"检查MCP配置失败: {ex.Message}", Dtos.LogLevel.Warn, account);
                return false;
            }
        }

        public async Task<MCPGetToolsResult> GetToolsAsync(string account)
        {
            var result = new MCPGetToolsResult
            {
                Success = false,
                Tools = new List<MCPToolInfo>()
            };

            try
            {
                // 1. 先尝试从缓存或数据库获取配置
                var cacheKey = $"mcp_config:{account}";
                var configJson = await _redisService.GetAsync(cacheKey);

                if (string.IsNullOrEmpty(configJson))
                {
                    var dbConfig = await _context.UserMCPs
                        .FirstOrDefaultAsync(c => c.Account == account);

                    if (dbConfig != null)
                    {
                        configJson = dbConfig.MCPConfig;
                        // 将数据库配置缓存到Redis
                        await _redisService.SetAsync(cacheKey, configJson, TimeSpan.FromDays(30));
                    }
                }

                if (string.IsNullOrEmpty(configJson))
                {
                    result.Message = "未找到MCP配置";
                    return result;
                }

                // 2. 计算配置哈希值
                var config = JsonSerializer.Deserialize<object>(configJson);
                var configHash = ComputeConfigHash(config ?? new { });
                var configHashCacheKey = GetConfigHashCacheKey(account);
                var cachedConfigHash = await _redisService.GetAsync(configHashCacheKey);

                // 3. 检查是否有缓存的工具列表且配置未变更
                var toolsCacheKey = GetToolsCacheKey(account, configHash);
                if (configHash == cachedConfigHash)
                {
                    var cachedToolsJson = await _redisService.GetAsync(toolsCacheKey);
                    if (!string.IsNullOrEmpty(cachedToolsJson))
                    {
                        try
                        {
                            var cachedTools = JsonSerializer.Deserialize<List<MCPToolInfo>>(cachedToolsJson);
                            if (cachedTools != null && cachedTools.Any())
                            {
                                result.Success = true;
                                result.Tools = cachedTools;
                                result.Message = $"从缓存获取到 {result.Tools.Count} 个工具";
                                return result;
                            }
                        }
                        catch (Exception cacheEx)
                        {
                            await _systemService.WriteLog($"解析缓存的工具列表失败: {cacheEx.Message}", Dtos.LogLevel.Warn, account);
                        }
                    }
                }

                // 4. 缓存未命中或配置已变更，需要重新获取
                var allClients = GetAllClients(account);
                if (!allClients.Any() || configHash != cachedConfigHash)
                {
                    // 配置变更或客户端未初始化，重新初始化
                    await InitializeClientAsync(account, config ?? new { });
                    allClients = GetAllClients(account);
                }

                if (!allClients.Any())
                {
                    result.Message = "MCP客户端初始化失败";
                    return result;
                }

                // 5. 从所有客户端获取工具列表
                foreach (var clientKvp in allClients)
                {
                    var serverName = clientKvp.Key;
                    var mcpClient = clientKvp.Value;
                    
                    try
                    {
                        var tools = await mcpClient.ListToolsAsync();

                        if (tools != null)
                        {
                            foreach (var tool in tools)
                            {
                                // 从JsonSchema中提取参数定义
                                object parameters = new { };
                                try
                                {
                                    if (tool.JsonSchema.ValueKind != JsonValueKind.Undefined && 
                                        tool.JsonSchema.ValueKind != JsonValueKind.Null)
                                    {
                                        // 将JsonElement转换为对象
                                        var jsonString = tool.JsonSchema.GetRawText();
                                        parameters = JsonSerializer.Deserialize<object>(jsonString) ?? new { };
                                    }
                                }
                                catch (Exception paramEx)
                                {
                                    await _systemService.WriteLog($"解析工具参数失败 [{tool.Name}]: {paramEx.Message}", Dtos.LogLevel.Warn, account);
                                }

                                result.Tools.Add(new MCPToolInfo
                                {
                                    Name = tool.Name,
                                    Description = tool.Description,
                                    Parameters = parameters,
                                    ServerName = serverName // 使用服务器名作为标识
                                });
                            }
                        }
                    }
                    catch (Exception mcpEx)
                    {
                        await _systemService.WriteLog($"MCP服务器 {serverName} 工具列表获取错误: {mcpEx.Message}", Dtos.LogLevel.Error, account);
                    }
                }

                // 6. 缓存工具列表和配置哈希
                if (result.Tools.Any())
                {
                    try
                    {
                        var toolsJson = JsonSerializer.Serialize(result.Tools);
                        await _redisService.SetAsync(toolsCacheKey, toolsJson, TimeSpan.FromHours(2)); // 工具列表缓存2小时
                        await _redisService.SetAsync(configHashCacheKey, configHash, TimeSpan.FromDays(30)); // 配置哈希缓存30天
                    }
                    catch (Exception cacheEx)
                    {
                        await _systemService.WriteLog($"缓存工具列表失败: {cacheEx.Message}", Dtos.LogLevel.Warn, account);
                    }
                }

                result.Success = true;
                result.Message = $"获取到 {result.Tools.Count} 个工具";
                return result;
            }
            catch (Exception ex)
            {
                result.Message = $"获取工具列表失败: {ex.Message}";
                await _systemService.WriteLog($"获取MCP工具列表失败: {ex.Message}", Dtos.LogLevel.Error, account);
                return result;
            }
        }

        public async Task DisposeClientAsync(string account)
        {
            try
            {
                if (_clients.TryRemove(account, out var allClients))
                {
                    // 根据文档使用 MCP SDK 正确关闭所有连接
                    foreach (var clientKvp in allClients)
                    {
                        var serverName = clientKvp.Key;
                        var mcpClient = clientKvp.Value;
                        
                        try
                        {
                            await mcpClient.DisposeAsync();
                        }
                        catch (Exception ex)
                        {
                            await _systemService.WriteLog($"关闭MCP客户端连接时出错 {account} - {serverName}: {ex.Message}", Dtos.LogLevel.Warn,
                                account);
                        }
                    }
                }

                _userConfigs.TryRemove(account, out _);

                // 清理该用户的相关缓存
                try
                {
                    var configHashCacheKey = GetConfigHashCacheKey(account);
                    var configHash = await _redisService.GetAsync(configHashCacheKey);
                    
                    if (!string.IsNullOrEmpty(configHash))
                    {
                        var toolsCacheKey = GetToolsCacheKey(account, configHash);
                        var serversCacheKey = GetServersCacheKey(account, configHash);
                        
                        await _redisService.DeleteAsync(toolsCacheKey);
                        await _redisService.DeleteAsync(serversCacheKey);
                    }
                    
                    await _redisService.DeleteAsync(configHashCacheKey);
                    
                }
                catch (Exception cacheEx)
                {
                    await _systemService.WriteLog($"清理用户MCP缓存失败 {account}: {cacheEx.Message}", Dtos.LogLevel.Warn, account);
                }
            }
            catch (Exception ex)
            {
                await _systemService.WriteLog($"释放MCP客户端失败: {ex.Message}", Dtos.LogLevel.Error, account);
            }
        }

        private McpConfiguration? ParseConfig(object config)
        {
            try
            {
                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                if (config is string jsonString)
                {
                    return JsonSerializer.Deserialize<McpConfiguration>(jsonString, options);
                }

                var json = JsonSerializer.Serialize(config);
                return JsonSerializer.Deserialize<McpConfiguration>(json, options);
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// 计算配置的哈希值，用于检测配置是否发生变化
        /// </summary>
        private string ComputeConfigHash(object config)
        {
            try
            {
                // 将配置序列化为标准化的JSON字符串
                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    WriteIndented = false // 确保格式一致
                };
                
                string configJson;
                if (config is string jsonString)
                {
                    // 先反序列化再序列化，确保格式标准化
                    var tempConfig = JsonSerializer.Deserialize<object>(jsonString, options);
                    configJson = JsonSerializer.Serialize(tempConfig, options);
                }
                else
                {
                    configJson = JsonSerializer.Serialize(config, options);
                }

                // 计算SHA256哈希
                using var sha256 = SHA256.Create();
                var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(configJson));
                return Convert.ToBase64String(hashBytes);
            }
            catch
            {
                // 如果计算哈希失败，返回一个基于时间戳的唯一值，确保每次都重新获取
                return $"hash_error_{DateTime.UtcNow.Ticks}";
            }
        }

        /// <summary>
        /// 获取工具缓存键
        /// </summary>
        private string GetToolsCacheKey(string account, string configHash)
        {
            return $"mcp_tools:{account}:{configHash}";
        }

        /// <summary>
        /// 获取服务器信息缓存键
        /// </summary>
        private string GetServersCacheKey(string account, string configHash)
        {
            return $"mcp_servers:{account}:{configHash}";
        }

        /// <summary>
        /// 获取配置哈希缓存键
        /// </summary>
        private string GetConfigHashCacheKey(string account)
        {
            return $"mcp_config_hash:{account}";
        }

        /// <summary>
        /// 将JsonElement转换为Dictionary<string, object?>
        /// </summary>
        private Dictionary<string, object?> ConvertJsonElementToDictionary(JsonElement element)
        {
            var dictionary = new Dictionary<string, object?>();
            
            if (element.ValueKind == JsonValueKind.Object)
            {
                foreach (var property in element.EnumerateObject())
                {
                    dictionary[property.Name] = ConvertJsonElementToObject(property.Value);
                }
            }
            
            return dictionary;
        }

        /// <summary>
        /// 将JsonElement转换为对应的C#对象
        /// </summary>
        private object? ConvertJsonElementToObject(JsonElement element)
        {
            return element.ValueKind switch
            {
                JsonValueKind.String => element.GetString(),
                JsonValueKind.Number => element.TryGetInt32(out var intValue) ? intValue : element.GetDouble(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Null => null,
                JsonValueKind.Object => ConvertJsonElementToDictionary(element),
                JsonValueKind.Array => element.EnumerateArray().Select(ConvertJsonElementToObject).ToArray(),
                _ => element.GetRawText()
            };
        }

        /// <summary>
        /// 尝试自动初始化MCP客户端
        /// </summary>
        /// <summary>
        /// 获取或创建指定服务器的客户端（精准连接）
        /// </summary>
        private async Task<IMcpClient?> GetOrCreateClientByServerName(string account, string serverName)
        {
            // 首先尝试从现有客户端获取
            var existingClient = GetClientByServerName(account, serverName);
            if (existingClient != null)
            {
                return existingClient;
            }

            // 如果不存在，尝试从配置中创建特定服务器的客户端
            try
            {
                // 1. 获取配置
                var cacheKey = $"mcp_config:{account}";
                var configJson = await _redisService.GetAsync(cacheKey);

                if (string.IsNullOrEmpty(configJson))
                {
                    var dbConfig = await _context.UserMCPs
                        .FirstOrDefaultAsync(c => c.Account == account);

                    if (dbConfig != null)
                    {
                        configJson = dbConfig.MCPConfig;
                        await _redisService.SetAsync(cacheKey, configJson, TimeSpan.FromDays(30));
                    }
                }

                if (string.IsNullOrEmpty(configJson))
                {
                    return null;
                }

                // 2. 解析配置找到指定服务器
                var configObj = JsonSerializer.Deserialize<object>(configJson);
                if (configObj == null)
                {
                    return null;
                }
                
                var config = ParseConfig(configObj);
                if (config?.Servers == null || !config.Servers.ContainsKey(serverName))
                {
                    return null;
                }

                var serverConfig = config.Servers[serverName];
                
                // 3. 创建单个服务器的客户端
                var client = await CreateSingleClient(serverConfig, serverName, account);
                if (client != null)
                {
                    // 4. 将客户端添加到缓存
                    if (!_clients.ContainsKey(account))
                    {
                        _clients[account] = new Dictionary<string, IMcpClient>();
                    }
                    _clients[account][serverName] = client;
                    
                    return client;
                }
            }
            catch (Exception ex)
            {
                await _systemService.WriteLog($"创建MCP客户端失败 {serverName}: {ex.Message}", Dtos.LogLevel.Error, account);
            }

            return null;
        }

        /// <summary>
        /// 创建单个服务器的客户端
        /// </summary>
        private async Task<IMcpClient?> CreateSingleClient(McpServerConfig serverConfig, string serverName, string account)
        {
            try
            {
                var transport = serverConfig.GetTransport();
                IMcpClient? mcpClient = null;
                
                if (transport.Type?.ToLower() == "stdio" && !string.IsNullOrEmpty(transport.Command))
                {
                    // 根据文档创建 STDIO 传输的 MCP 客户端
                    var clientTransport = new StdioClientTransport(new StdioClientTransportOptions
                    {
                        Name = serverConfig.Description ?? serverName,
                        Command = transport.Command,
                        Arguments = transport.Args?.ToArray() ?? Array.Empty<string>()
                    });

                    mcpClient = await McpClientFactory.CreateAsync(clientTransport);
                }
                else if (!string.IsNullOrEmpty(transport.Url))
                {
                   // 使用SSE 自动适应 HTTP
                    var clientTransport = new SseClientTransport(new SseClientTransportOptions
                    {
                        Name = serverConfig.Description ?? serverName,
                        Endpoint = new Uri(transport.Url),
                        TransportMode = HttpTransportMode.AutoDetect
                    });

                    mcpClient = await McpClientFactory.CreateAsync(clientTransport);
                }

                if (mcpClient != null)
                {
                    return mcpClient;
                }
                else
                {
                    return null;
                }
            }
            catch (Exception ex)
            {
                await _systemService.WriteLog($"创建客户端失败 {serverName}: {ex.Message}", Dtos.LogLevel.Error, account);
                return null;
            }
        }

        private async Task<bool> TryAutoInitializeClientAsync(string account)
        {
            try
            {
                // 1. 先尝试从缓存获取配置
                var cacheKey = $"mcp_config:{account}";
                var configJson = await _redisService.GetAsync(cacheKey);

                if (string.IsNullOrEmpty(configJson))
                {
                    // 2. 从数据库获取配置
                    var dbConfig = await _context.UserMCPs
                        .FirstOrDefaultAsync(c => c.Account == account);

                    if (dbConfig != null)
                    {
                        configJson = dbConfig.MCPConfig;
                        // 将数据库配置缓存到Redis
                        await _redisService.SetAsync(cacheKey, configJson, TimeSpan.FromDays(30));
                    }
                }

                if (string.IsNullOrEmpty(configJson))
                {
                    return false;
                }

                // 3. 解析并初始化配置
                var config = JsonSerializer.Deserialize<object>(configJson);
                if (config == null)
                {
                    return false;
                }

                // 4. 初始化客户端
                var initSuccess = await InitializeClientAsync(account, config);
                if (initSuccess)
                {
                    return true;
                }
                else
                {
                    return false;
                }
            }
            catch (Exception ex)
            {
                await _systemService.WriteLog($"自动初始化MCP客户端时出错 {account}: {ex.Message}", Dtos.LogLevel.Error, account);
                return false;
            }
        }
    }


    // 配置模型类
    public class McpConfiguration
    {
        public Dictionary<string, McpServerConfig> Servers { get; set; } = new();

        // 转换为列表格式以兼容现有代码
        public List<McpServerConfig> GetServersList()
        {
            var list = new List<McpServerConfig>();
            foreach (var kvp in Servers)
            {
                var server = kvp.Value;
                server.Name = kvp.Key; // 设置服务器名称
                list.Add(server);
            }

            return list;
        }
    }

    public class McpServerConfig
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public string? Url { get; set; } // 直接支持 URL
        public string? Command { get; set; } // for stdio
        public List<string>? Args { get; set; } // for stdio
        public Dictionary<string, string>? Env { get; set; } // for stdio

        // 自动推断传输类型和创建传输配置
        public McpTransportConfig GetTransport()
        {
            var transport = new McpTransportConfig();

            if (!string.IsNullOrEmpty(Url))
            {
                transport.Type = "http"; // 默认为 http
                transport.Url = Url;
            }
            else if (!string.IsNullOrEmpty(Command))
            {
                transport.Type = "stdio";
                transport.Command = Command;
                transport.Args = Args;
                transport.Env = Env;
            }

            return transport;
        }
    }

    public class McpTransportConfig
    {
        public string? Type { get; set; } // "stdio", "sse", "http"
        public string? Command { get; set; } // for stdio
        public List<string>? Args { get; set; } // for stdio
        public Dictionary<string, string>? Env { get; set; } // for stdio
        public string? Url { get; set; } // for sse/http
    }
}