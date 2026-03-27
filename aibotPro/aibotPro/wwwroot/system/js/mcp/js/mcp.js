// MCP 配置页面 JavaScript
var mcpConfig = null;
var mcpServers = [];
var mcpTools = [];
var mcpIsValidated = false;
var mcpIsConnected = false;
var mcpCurrentServer = 'all'; // 当前选中的服务器，'all' 表示显示所有服务器的工具

function mcpInit() {
    mcpBindEvents();
    mcpLoadSavedConfig();
    mcpUpdateUI();
}

function mcpBindEvents() {
    // 可视化配置
    document.getElementById('visualConfigBtn').addEventListener('click', mcpShowVisualConfig);

    // 加载模板
    document.getElementById('loadTemplateBtn').addEventListener('click', mcpLoadTemplate);

    // 清空配置
    document.getElementById('clearConfigBtn').addEventListener('click', mcpClearConfig);

    // 验证配置
    document.getElementById('validateConfigBtn').addEventListener('click', mcpValidateConfig);

    // 保存配置
    document.getElementById('saveConfigBtn').addEventListener('click', mcpSaveConfig);

    // 刷新服务
    document.getElementById('refreshServersBtn').addEventListener('click', mcpRefreshServers);

    // 配置编辑器变化时重置验证状态
    document.getElementById('mcpConfigEditor').addEventListener('input', mcpOnConfigChanged);

    // 可视化配置相关事件
    document.getElementById('addServerBtn').addEventListener('click', mcpAddServerConfig);
    document.getElementById('applyVisualConfigBtn').addEventListener('click', mcpApplyVisualConfig);
}

function mcpLoadTemplate() {
    const template = {
        "servers": {
            "context7": {
                "url": "https://mcp.context7.com/mcp"
            }
        }
    };

    document.getElementById('mcpConfigEditor').value = JSON.stringify(template, null, 2);
    mcpOnConfigChanged();
}

function mcpClearConfig() {
    showConfirmationModal(
        '确认清空配置',
        '确定要清空配置吗？此操作不可撤销，将同时清空后端缓存。',
        function () {
            // 直接调用清空配置的API
            mcpClearConfigAndSave();
        },
        function () {
            // 取消操作，无需处理
        }
    );
}

function mcpClearConfigAndSave() {
    loadingBtn('#clearConfigBtn');

    $.ajax({
        type: 'POST',
        url: '/api/MCP/clear',
        contentType: 'application/json',
        success: function (result) {
            // 关闭加载提示
            unloadingBtn('#clearConfigBtn');

            if (result.success) {
                // 清空编辑器内容
                document.getElementById('mcpConfigEditor').value = '';
                
                // 重置状态
                mcpConfig = {};
                mcpServers = [];
                mcpTools = [];
                mcpIsValidated = true;
                mcpIsConnected = false;
                mcpCurrentServer = 'all';
                
                // 更新UI
                mcpUpdateUI();
                mcpUpdateConnectionStatus('disconnected', '未连接');
                mcpRenderServers();
                mcpRenderTools();
                mcpHideValidationResult();
                
                balert('配置已清空并保存成功！', 'success', true, 3000, 'top');
            } else {
                balert('清空配置失败：' + (result.message || '未知错误'), 'danger', true, 5000, 'top');
            }
        },
        error: function () {
            // 关闭加载提示
            unloadingBtn('#clearConfigBtn');
            balert('清空配置失败：网络请求失败', 'danger', true, 5000, 'top');
        }
    });
}

function mcpOnConfigChanged() {
    // 检查是否为空配置
    const configText = document.getElementById('mcpConfigEditor').value.trim();
    if (!configText) {
        // 空配置允许直接保存
        mcpIsValidated = true;
        mcpConfig = {};
    } else {
        mcpIsValidated = false;
    }
    mcpUpdateUI();
    mcpHideValidationResult();
}

function mcpValidateConfig() {
    const configText = document.getElementById('mcpConfigEditor').value.trim();

    if (!configText) {
        // 空配置直接通过验证
        mcpConfig = { servers: {} };
        mcpIsValidated = true;
        mcpUpdateUI();
        mcpHideValidationResult();
        balert('空配置验证通过！', 'success', true, 2000, 'top');
        return;
    }

    try {
        // 先验证JSON格式
        const config = JSON.parse(configText);

        // 验证配置结构
        if (!config.servers || typeof config.servers !== 'object') {
            throw new Error('配置必须包含 servers 对象');
        }

        // 验证每个服务配置
        for (const [name, server] of Object.entries(config.servers)) {
            // 检查服务类型并验证相应配置
            if (server.command) {
                // STDIO类型：需要command和args
                if (!Array.isArray(server.args)) {
                    throw new Error(`STDIO服务 "${name}" 的 args 必须是数组`);
                }
            } else if (server.url) {
                // HTTP或SSE类型：需要url
                if (typeof server.url !== 'string' || !server.url.trim()) {
                    throw new Error(`HTTP/SSE服务 "${name}" 的 url 不能为空`);
                }
                // 验证URL格式
                try {
                    new URL(server.url);
                } catch (urlError) {
                    throw new Error(`服务 "${name}" 的 url 格式无效`);
                }
                // 如果指定了method，验证是否为有效值
                if (server.method && !['http', 'sse'].includes(server.method.toLowerCase())) {
                    throw new Error(`服务 "${name}" 的 method 必须是 "http" 或 "sse"`);
                }
            } else {
                throw new Error(`服务 "${name}" 必须配置 command（STDIO）或 url（HTTP/SSE）`);
            }
        }

        // 调用后端API验证
        loadingBtn('#validateConfigBtn');

        $.ajax({
            type: 'POST',
            url: '/api/MCP/validate',
            contentType: 'application/json',
            data: JSON.stringify(config),
            success: function (result) {
                if (result.success) {
                    mcpConfig = config;
                    mcpIsValidated = true;
                    mcpHideValidationResult();
                    balert('配置验证通过，正在加载服务...', 'success', true, 2000, 'top');

                    // 验证成功后自动加载服务
                    setTimeout(() => {
                        mcpLoadServersInternal(config);
                    }, 500);
                } else {
                    unloadingBtn('#validateConfigBtn');
                    balert('配置验证失败：' + (result.message || '未知错误'), 'danger', false, 1000, 'top');
                }
                mcpUpdateUI();
            },
            error: function () {
                // 关闭加载提示
                unloadingBtn('#validateConfigBtn');
                balert('网络请求失败', 'danger', true, 5000, 'top');
                mcpUpdateUI();
            }
        });
    } catch (error) {
        // 关闭加载提示
        unloadingBtn('#validateConfigBtn');
        balert('配置错误：' + (error.message || '配置格式错误'), 'danger', true, 5000, 'top');
        mcpUpdateUI();
    }
}

function mcpSaveConfig() {
    if (!mcpIsValidated) {
        balert('请先验证配置', 'warning', true, 3000, 'top');
        return;
    }

    loadingBtn('#saveConfigBtn');

    // 获取当前配置
    const configText = document.getElementById('mcpConfigEditor').value.trim();
    let configToSave;
    
    if (!configText) {
        // 空配置
        configToSave = { servers: {} };
    } else {
        configToSave = mcpConfig || {};
    }

    $.ajax({
        type: 'POST',
        url: '/api/MCP/save',
        contentType: 'application/json',
        data: JSON.stringify(configToSave),
        success: function (result) {
            // 关闭加载提示
            unloadingBtn('#saveConfigBtn');

            if (result.success) {
                balert('配置保存成功！', 'success', true, 3000, 'top');
            } else {
                balert('配置保存失败：' + (result.message || '未知错误'), 'danger', true, 5000, 'top');
            }
        },
        error: function () {
            // 关闭加载提示
            unloadingBtn('#saveConfigBtn');
            balert('保存失败：网络请求失败', 'danger', true, 5000, 'top');
        }
    });
}

function mcpLoadServersInternal(config) {
    mcpUpdateConnectionStatus('loading', '连接中...');

    $.ajax({
        type: 'POST',
        url: '/api/MCP/load-servers',
        contentType: 'application/json',
        data: JSON.stringify(config),
        success: function (result) {
            unloadingBtn('#validateConfigBtn');
            if (result.success) {
                mcpServers = result.servers || [];
                mcpTools = result.tools || [];
                mcpIsConnected = true;
                mcpUpdateConnectionStatus('connected', '已连接');
                mcpRenderServers();
                mcpRenderTools();
                balert(`服务加载成功！共 ${mcpServers.length} 个服务，${mcpTools.length} 个工具`, 'success', true, 3000, 'top');
            } else {
                mcpUpdateConnectionStatus('disconnected', '连接失败');
                balert('加载服务信息失败：' + (result.message || '未知错误'), 'danger', true, 5000, 'top');
            }
        },
        error: function () {
            unloadingBtn('#validateConfigBtn');
            mcpUpdateConnectionStatus('disconnected', '连接失败');
            balert('加载失败：网络请求失败', 'danger', true, 5000, 'top');
        }
    });
}

function mcpRefreshServers() {
    if (mcpIsConnected && mcpConfig) {
        mcpLoadServersInternal(mcpConfig);
    } else {
        balert('请先验证配置并加载服务信息', 'warning', true, 3000, 'top');
    }
}

function mcpLoadSavedConfig() {
    // 检查token是否存在，如果不存在则延迟加载
    const token = localStorage.getItem('aibotpro_userToken');
    if (!token) {
        console.log('Token未找到，延迟加载配置');
        setTimeout(mcpLoadSavedConfig, 1000);
        return;
    }
    loadingBtn('#validateConfigBtn');
    $.ajax({
        type: 'GET',
        url: '/api/MCP/config',
        success: function (result) {
            unloadingBtn('#validateConfigBtn');
            if (result.success && result.config) {
                document.getElementById('mcpConfigEditor').value =
                    JSON.stringify(result.config, null, 2);
                mcpConfig = result.config;
                mcpIsValidated = true;
                balert('已加载保存的配置', 'success', true, 1000, 'top');
                // 自动加载服务
                // setTimeout(() => {
                //     mcpLoadServersInternal(result.config);
                // }, 1000);
            }
            mcpUpdateUI();
        },
        error: function (xhr, status, error) {
            unloadingBtn('#validateConfigBtn');
            console.error('加载已保存配置失败:', xhr.status, error);
            // 如果是401错误且有token，可能是全局拦截器还没生效，延迟重试
            if (xhr.status === 401 && token) {
                console.log('401错误，可能全局拦截器未生效，延迟重试');
                setTimeout(mcpLoadSavedConfig, 1000);
            } else {
                mcpUpdateUI();
            }
        }
    });
}

function mcpShowValidationResult(success, message) {
    const resultDiv = document.getElementById('validationResult');
    resultDiv.className = `validation-result ${success ? 'success' : 'error'}`;
    resultDiv.textContent = message;
    resultDiv.style.display = 'block';
}

function mcpHideValidationResult() {
    const resultDiv = document.getElementById('validationResult');
    resultDiv.style.display = 'none';
}

function mcpUpdateConnectionStatus(status, text) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.getElementById('connectionStatus');

    statusDot.className = `status-dot status-${status}`;
    statusText.textContent = text;
}

function mcpUpdateUI() {
    const saveBtn = document.getElementById('saveConfigBtn');

    saveBtn.disabled = !mcpIsValidated;
}

function mcpRenderServers() {
    const serversList = document.getElementById('serversList');

    if (mcpServers.length === 0) {
        serversList.innerHTML = `
            <div class="empty-state">
                <i data-feather="server"></i>
                <p>暂无服务信息</p>
                <small>服务可能启动失败或配置有误</small>
            </div>
        `;
    } else {
        serversList.innerHTML = mcpServers.map(server => `
            <div class="server-item">
                <div class="server-name">${server.name}</div>
                <div class="server-status">
                    <span class="status-badge ${server.status}">${server.statusText}</span>
                </div>
                <div class="server-details">
                    <div><strong>类型:</strong> ${server.type || 'STDIO'}</div>
                    ${server.command ? `<div><strong>命令:</strong> ${server.command}</div>` : ''}
                    ${server.args && server.args.length > 0 ? `<div><strong>参数:</strong> ${server.args.join(' ')}</div>` : ''}
                    ${server.url ? `<div><strong>URL:</strong> ${server.url}</div>` : ''}
                    ${server.method ? `<div><strong>方法:</strong> ${server.method.toUpperCase()}</div>` : ''}
                    ${server.error ? `<div class="text-danger"><strong>错误:</strong> ${server.error}</div>` : ''}
                </div>
            </div>
        `).join('');
    }

    // 重新初始化图标
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
}

function mcpRenderTools() {
    const toolsContainer = document.getElementById('toolsContainer');

    // 检查元素是否存在
    if (!toolsContainer) {
        console.error('toolsContainer element not found');
        return;
    }

    if (mcpTools.length === 0) {
        toolsContainer.innerHTML = `
            <div class="tools-list">
                <div class="empty-state">
                    <i data-feather="settings"></i>
                    <p>暂无工具信息</p>
                    <small>服务中没有可用的工具</small>
                </div>
            </div>
        `;
    } else {
        // 按服务器分组工具
        const serverGroups = {};
        mcpTools.forEach(tool => {
            const serverName = tool.serverName || 'unknown';
            if (!serverGroups[serverName]) {
                serverGroups[serverName] = [];
            }
            serverGroups[serverName].push(tool);
        });

        // 生成服务器标签
        const serverTabs = Object.keys(serverGroups).length > 1 ? `
            <div class="server-tabs">
                <button class="server-tab ${mcpCurrentServer === 'all' ? 'active' : ''}" onclick="mcpSwitchServer('all')">
                    全部 <span class="server-tab-badge">${mcpTools.length}</span>
                </button>
                ${Object.keys(serverGroups).map(serverName => `
                    <button class="server-tab ${mcpCurrentServer === serverName ? 'active' : ''}" onclick="mcpSwitchServer('${serverName}')">
                        ${serverName} <span class="server-tab-badge">${serverGroups[serverName].length}</span>
                    </button>
                `).join('')}
            </div>
        ` : '';

        // 过滤工具
        const filteredTools = mcpCurrentServer === 'all'
            ? mcpTools
            : mcpTools.filter(tool => tool.serverName === mcpCurrentServer);

        const toolsHtml = filteredTools.length > 0 ? filteredTools.map(tool => `
            <div class="tool-item" onclick="mcpShowToolDetails('${tool.name}', '${tool.serverName || 'unknown'}')">
                <div class="tool-name">
                    ${tool.name}
                    <span class="tool-server">${tool.serverName || 'unknown'}</span>
                </div>
                <div class="tool-description">${tool.description || '无描述'}</div>
                ${tool.parameters && Object.keys(tool.parameters).length > 0 ? `
                    <div class="tool-schema">
                        <strong>参数:</strong><br>
                        <pre class="p-3 rounded">${JSON.stringify(tool.parameters, null, 2)}</pre>
                    </div>
                ` : ''}
            </div>
        `).join('') : `
            <div class="empty-state">
                <i data-feather="settings"></i>
                <p>暂无工具信息</p>
                <small>当前服务器没有可用的工具</small>
            </div>
        `;

        toolsContainer.innerHTML = `
            ${serverTabs}
            <div class="tools-list">
                ${toolsHtml}
            </div>
        `;
    }

    // 重新初始化图标
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
}

// 切换服务器显示
function mcpSwitchServer(serverName) {
    mcpCurrentServer = serverName;
    mcpRenderTools();
}

// 显示工具详情
function mcpShowToolDetails(toolName, serverName) {
    const tool = mcpTools.find(t => t.name === toolName && t.serverName === serverName);
    if (tool) {
        const detailsHtml = `
            <div class="modal fade" id="toolDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">工具详情: ${tool.name}</h5>
                            <button type="button" class="btn-close" onclick="mcpCloseToolDetails()"></button>
                        </div>
                        <div class="modal-body">
                            <p><strong>服务器:</strong> ${tool.serverName || 'unknown'}</p>
                            <p><strong>描述:</strong> ${tool.description || '无描述'}</p>
                            ${tool.parameters && Object.keys(tool.parameters).length > 0 ? `
                                <p><strong>参数:</strong></p>
                                <pre class="p-3 rounded">${JSON.stringify(tool.parameters, null, 2)}</pre>
                            ` : '<p><strong>参数:</strong> 无参数</p>'}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" onclick="mcpCloseToolDetails()">关闭</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 移除旧的模态框
        $('#toolDetailsModal').remove();
        // 添加新的模态框
        $('body').append(detailsHtml);
        // 显示模态框
        $('#toolDetailsModal').modal('show');
    }
}

// 关闭工具详情弹窗
function mcpCloseToolDetails() {
    $('#toolDetailsModal').modal('hide');
}



// 可视化配置相关变量
var visualConfigServers = [];
var serverConfigCounter = 0;

// HTML转义函数
function mcpEscapeHtml(text) {
    if (text === null || text === undefined) {
        return '';
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 显示可视化配置弹窗
function mcpShowVisualConfig() {
    // 清空现有配置
    visualConfigServers = [];
    serverConfigCounter = 0;
    
    // 尝试从当前JSON配置加载
    try {
        const configText = document.getElementById('mcpConfigEditor').value.trim();
        if (configText) {
            const config = JSON.parse(configText);
            if (config.servers) {
                Object.entries(config.servers).forEach(([name, serverConfig]) => {
                    // 根据配置推断类型
                    let type = 'sse'; // 默认类型
                    if (serverConfig.command) {
                        type = 'stdio';
                    } else if (serverConfig.url) {
                        type = 'sse';
                    }
                    
                    visualConfigServers.push({
                        id: ++serverConfigCounter,
                        name: name,
                        type: type,
                        description: serverConfig.description || '',
                        url: serverConfig.url || '',
                        command: serverConfig.command || '',
                        args: serverConfig.args || [],
                        env: serverConfig.env || {}
                    });
                });
            }
        }
    } catch (e) {
        console.warn('无法解析现有配置，使用空配置');
    }
    
    // 如果没有配置，添加一个默认的
    if (visualConfigServers.length === 0) {
        mcpAddServerConfig();
    }
    
    mcpRenderVisualConfig();
    $('#visualConfigModal').modal('show');
}

// 关闭可视化配置弹窗
function mcpCloseVisualConfig() {
    $('#visualConfigModal').modal('hide');
}

// 添加服务器配置
function mcpAddServerConfig() {
    const newServer = {
        id: ++serverConfigCounter,
        name: `server-${serverConfigCounter}`,
        type: 'sse',
        description: '',
        url: '',
        command: '',
        args: [],
        env: {}
    };
    
    visualConfigServers.push(newServer);
    mcpRenderVisualConfig();
}

// 移除服务器配置
function mcpRemoveServerConfig(serverId) {
    visualConfigServers = visualConfigServers.filter(s => s.id !== serverId);
    mcpRenderVisualConfig();
}

// 渲染可视化配置界面
function mcpRenderVisualConfig() {
    const serversList = document.getElementById('serversConfigList');
    
    if (visualConfigServers.length === 0) {
        serversList.innerHTML = '<p class="text-muted text-center">暂无服务器配置，点击"添加服务器"开始配置</p>';
        return;
    }
    
    serversList.innerHTML = visualConfigServers.map(server => `
        <div class="server-config-item" data-server-id="${server.id}">
            <div class="server-config-header">
                <h6 class="server-config-title">服务器配置 <b class="text-primary">#${server.id}</b></h6>
                <button type="button" class="server-config-remove" onclick="mcpRemoveServerConfig(${server.id})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="config-form-row">
                <div class="config-form-group">
                    <label>服务器名称 <b class="text-danger">*</b></label>
                    <input type="text" value="${mcpEscapeHtml(server.name)}" onchange="mcpUpdateServerConfig(${server.id}, 'name', this.value)" placeholder="例如: context7">
                </div>
                <div class="config-form-group medium">
                    <label>连接类型 <b class="text-danger">*</b></label>
                    <select onchange="mcpUpdateServerConfig(${server.id}, 'type', this.value); mcpRenderVisualConfig();">
                        <option value="sse" ${server.type === 'sse' ? 'selected' : ''}>SSE (HTTP)</option>
                        <option value="stdio" ${server.type === 'stdio' ? 'selected' : ''}>STDIO (本地命令)</option>
                    </select>
                </div>
            </div>
            
            <div class="config-form-row">
                <div class="config-form-group">
                    <label>描述</label>
                    <input type="text" value="${mcpEscapeHtml(server.description || '')}" onchange="mcpUpdateServerConfig(${server.id}, 'description', this.value)" placeholder="服务器描述（可选）">
                </div>
            </div>
            
            <div class="type-specific-config">
                ${server.type === 'sse' ? mcpRenderSseConfig(server) : mcpRenderStdioConfig(server)}
            </div>
            
            ${mcpRenderEnvVarsSection(server)}
        </div>
    `).join('');
    
    // 绑定环境变量输入框的事件监听器
    mcpBindEnvVarEvents();
}

// 绑定环境变量事件监听器
function mcpBindEnvVarEvents() {
    // 使用事件委托绑定环境变量输入框事件
    const serversList = document.getElementById('serversConfigList');
    if (!serversList) return;
    
    // 移除之前的事件监听器
    serversList.removeEventListener('change', mcpHandleEnvVarChange);
    serversList.removeEventListener('click', mcpHandleEnvVarClick);
    
    // 添加新的事件监听器
    serversList.addEventListener('change', mcpHandleEnvVarChange);
    serversList.addEventListener('click', mcpHandleEnvVarClick);
}

// 处理环境变量输入框变化事件
function mcpHandleEnvVarChange(event) {
    const target = event.target;
    const envVarItem = target.closest('.env-var-item');
    if (!envVarItem) return;
    
    const serverItem = target.closest('.server-config-item');
    if (!serverItem) return;
    
    const serverId = parseInt(serverItem.dataset.serverId);
    const envIndex = parseInt(envVarItem.dataset.envIndex);
    
    if (target.placeholder === '变量名') {
        mcpUpdateServerEnv(serverId, envIndex, target.value, 'key');
    } else if (target.placeholder === '变量值') {
        mcpUpdateServerEnv(serverId, envIndex, target.value, 'value');
    }
}

// 处理环境变量按钮点击事件
function mcpHandleEnvVarClick(event) {
    const target = event.target;
    
    if (target.closest('.env-var-remove')) {
        const envVarItem = target.closest('.env-var-item');
        const serverItem = target.closest('.server-config-item');
        if (envVarItem && serverItem) {
            const serverId = parseInt(serverItem.dataset.serverId);
            const envIndex = parseInt(envVarItem.dataset.envIndex);
            mcpRemoveEnvVar(serverId, envIndex);
        }
    }
}

// 渲染SSE配置
function mcpRenderSseConfig(server) {
    return `
        <div class="config-form-row">
            <div class="config-form-group">
                <label>服务器URL <b class="text-danger">*</b></label>
                <input type="url" value="${mcpEscapeHtml(server.url || '')}" onchange="mcpUpdateServerConfig(${server.id}, 'url', this.value)" placeholder="https://example.com/mcp">
            </div>
        </div>
    `;
}

// 渲染STDIO配置
function mcpRenderStdioConfig(server) {
    return `
        <div class="config-form-row">
            <div class="config-form-group">
                <label>命令 <b class="text-danger">*</b></label>
                <input type="text" value="${mcpEscapeHtml(server.command || '')}" onchange="mcpUpdateServerConfig(${server.id}, 'command', this.value)" placeholder="例如: npx">
            </div>
        </div>
        
        <div class="args-section">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="mb-0">命令参数</label>
                <button type="button" class="btn btn-sm btn-outline-primary add-arg" onclick="mcpAddArg(${server.id})">
                    <i class="fas fa-plus"></i> 添加参数
                </button>
            </div>
            <div class="args-list">
                ${(server.args || []).map((arg, index) => `
                    <div class="arg-item">
                        <input type="text" value="${mcpEscapeHtml(arg)}" onchange="mcpUpdateServerArg(${server.id}, ${index}, this.value)" placeholder="参数值">
                        <button type="button" class="arg-remove" onclick="mcpRemoveArg(${server.id}, ${index})">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// 渲染环境变量配置
function mcpRenderEnvVarsSection(server) {
    const envEntries = Object.entries(server.env || {});
    
    return `
        <div class="env-vars-section">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="mb-0">环境变量</label>
                <button type="button" class="btn btn-sm btn-outline-secondary add-env-var" onclick="mcpAddEnvVar(${server.id})">
                    <i class="fas fa-plus"></i> 添加环境变量
                </button>
            </div>
            <div class="env-vars-list">
                ${envEntries.map(([key, value], index) => `
                    <div class="env-var-item" data-env-index="${index}">
                        <input type="text" value="${mcpEscapeHtml(key)}" placeholder="变量名">
                        <span>=</span>
                        <input type="text" value="${mcpEscapeHtml(value)}" placeholder="变量值">
                        <button type="button" class="env-var-remove">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// 更新服务器配置
function mcpUpdateServerConfig(serverId, field, value) {
    const server = visualConfigServers.find(s => s.id === serverId);
    if (server) {
        server[field] = value;
    }
}

// 添加命令参数
function mcpAddArg(serverId) {
    const server = visualConfigServers.find(s => s.id === serverId);
    if (server) {
        if (!server.args) server.args = [];
        server.args.push('');
        mcpRenderVisualConfig();
    }
}

// 移除命令参数
function mcpRemoveArg(serverId, index) {
    const server = visualConfigServers.find(s => s.id === serverId);
    if (server && server.args) {
        server.args.splice(index, 1);
        mcpRenderVisualConfig();
    }
}

// 更新命令参数
function mcpUpdateServerArg(serverId, index, value) {
    const server = visualConfigServers.find(s => s.id === serverId);
    if (server && server.args) {
        server.args[index] = value;
    }
}

// 添加环境变量
function mcpAddEnvVar(serverId) {
    const server = visualConfigServers.find(s => s.id === serverId);
    if (server) {
        if (!server.env) server.env = {};
        // 生成一个唯一的临时键名
        let tempKey = 'NEW_VAR';
        let counter = 1;
        while (server.env.hasOwnProperty(tempKey)) {
            tempKey = `NEW_VAR_${counter}`;
            counter++;
        }
        server.env[tempKey] = '';
        mcpRenderVisualConfig();
    }
}

// 移除环境变量
function mcpRemoveEnvVar(serverId, index) {
    const server = visualConfigServers.find(s => s.id === serverId);
    if (server && server.env) {
        const envEntries = Object.entries(server.env);
        if (index >= 0 && index < envEntries.length) {
            const [keyToRemove] = envEntries[index];
            delete server.env[keyToRemove];
            mcpRenderVisualConfig();
        }
    }
}

// 更新环境变量
function mcpUpdateServerEnv(serverId, index, newValue, type) {
    const server = visualConfigServers.find(s => s.id === serverId);
    if (server && server.env) {
        const envEntries = Object.entries(server.env);
        if (index >= 0 && index < envEntries.length) {
            const [oldKey, oldValue] = envEntries[index];
            
            if (type === 'key') {
                // 更新键名
                if (newValue && newValue !== oldKey) {
                    // 删除旧键，添加新键
                    delete server.env[oldKey];
                    server.env[newValue] = oldValue;
                    // 重新渲染以更新索引
                    mcpRenderVisualConfig();
                }
            } else {
                // 更新值
                server.env[oldKey] = newValue;
            }
        }
    }
}

// 应用可视化配置
function mcpApplyVisualConfig() {
    try {
        // 验证配置
        const errors = [];
        visualConfigServers.forEach((server, index) => {
            if (!server.name.trim()) {
                errors.push(`服务器 #${server.id}: 服务器名称不能为空`);
            }
            
            if (server.type === 'sse') {
                if (!server.url.trim()) {
                    errors.push(`服务器 #${server.id}: SSE类型需要配置URL`);
                }
            } else if (server.type === 'stdio') {
                if (!server.command.trim()) {
                    errors.push(`服务器 #${server.id}: STDIO类型需要配置命令`);
                }
            }
        });
        
        if (errors.length > 0) {
            balert('配置验证失败：\\n' + errors.join('\\n'), 'danger', true, 8000, 'top');
            return;
        }
        
        // 生成配置JSON
        const config = {
            servers: {}
        };
        
        visualConfigServers.forEach(server => {
            const serverConfig = {
                description: server.description || ''
            };
            
            if (server.type === 'sse') {
                serverConfig.url = server.url;
            } else if (server.type === 'stdio') {
                serverConfig.command = server.command;
                if (server.args && server.args.length > 0) {
                    serverConfig.args = server.args.filter(arg => arg.trim());
                }
            }
            
            // 处理环境变量（SSE和STDIO都支持）
            if (server.env && Object.keys(server.env).length > 0) {
                // 过滤掉空的环境变量
                const filteredEnv = {};
                Object.entries(server.env).forEach(([key, value]) => {
                    if (key.trim() && value.trim()) {
                        filteredEnv[key.trim()] = value.trim();
                    }
                });
                if (Object.keys(filteredEnv).length > 0) {
                    serverConfig.env = filteredEnv;
                }
            }
            
            config.servers[server.name] = serverConfig;
        });
        
        // 更新JSON编辑器
        document.getElementById('mcpConfigEditor').value = JSON.stringify(config, null, 2);
        
        // 关闭弹窗
        $('#visualConfigModal').modal('hide');
        
        // 重置验证状态
        mcpOnConfigChanged();
        
        balert('配置已应用到JSON编辑器', 'success', true, 3000, 'top');
        
    } catch (error) {
        balert('应用配置失败: ' + error.message, 'danger', true, 5000, 'top');
    }
}

$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#mcp-nav").addClass('active');

    // 初始化MCP管理器
    mcpInit();
});