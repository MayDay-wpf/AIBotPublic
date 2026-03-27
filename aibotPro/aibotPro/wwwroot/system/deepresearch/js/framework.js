$(function () {
    $('.nav-sub-link').removeClass('active');
    $('#system-menu .nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#deepresearch-nav").addClass('active');

    // 初始化深度研究页面
    initDeepResearchPage();
});

// 全局变量
let currentResearchId = "";
// let currentSearchEngine = 'yahoo';
// window.currentSearchEngine = currentSearchEngine;
let currentModel = null;
// chatHistory 已迁移到 deepchat.js
let modelList = [];

// 分页相关变量
let currentPage = 1;
let pageSize = 10;
let isLoading = false;
let hasMoreData = true;
let currentSearchKeyword = '';

// 页面初始化标志
let isPageInitialLoad = true;

// 页面初始化
function initDeepResearchPage() {
    // 初始化事件监听器
    initEventListeners();

    // 初始化模型列表
    loadModelList();

    // 初始化研究列表
    loadResearchList();

    // 初始化编辑器
    initResearchEditor();

    // 初始化侧边栏状态
    initSidebarState();

    // 初始化图标
    feather.replace();
}

// 初始化研究编辑器
function initResearchEditor() {
    if (window.researchEditor) {
        window.researchEditor.initEditor('vditor', {
            content: '# 请选择或创建一个研究项目开始编辑。'
        });

        // 默认设置编辑器为禁用状态（不设置data-disabled-message，使用CSS默认文字）
        $('#researchEditContainer').addClass('disabled');
        // 默认禁用Chat tab
        $('#chat-tab').addClass('disabled').attr('title', '请先选择一个已完成的研究项目');
        window.researchEditor.isEditMode = false;
    }
}

// 初始化事件监听器
function initEventListeners() {
    // 搜索引擎选择
    // $(document).on('click', '.search-engine-item', function (e) {
    //     e.preventDefault();
    //     const engine = $(this).data('engine');
    //     selectSearchEngine(engine);
    // });

    // 模型搜索图标点击
    $('#searchIcon').on('click', function (event) {
        event.stopPropagation();
        $('#searchIcon').hide();
        $('#modelSearch').addClass('expand').fadeIn().focus();
    });

    // 搜索框失去焦点时恢复成放大镜图标
    $('#modelSearch').on('blur', function () {
        $(this).removeClass('expand').fadeOut(function () {
            $('#searchIcon').fadeIn();
        });
        $(this).val('');
        filterModels();
    });

    // 模型搜索输入
    $('#modelSearch').on('keyup', function () {
        filterModels();
    });

    // 新建研究
    $('#new-research').click(function () {
        showNewResearchDialog();
    });

    // 导出PDF
    $('#export-pdf').click(function () {
        exportCurrentResearchToPDF();
    });

    // 研究项目点击
    $(document).on('click', '.research-item', function () {
        const researchId = $(this).data('id');
        selectResearch(researchId);
    });

    // 研究项目删除
    $(document).on('click', '.delete-btn', function (e) {
        e.stopPropagation();
        const researchId = $(this).closest('.research-item').data('id');
        deleteResearch(researchId);
    });

    // 侧边栏展开/收起功能
    $('#sidebarToggleBtn').click(function () {
        toggleSidebar();
    });

    $('#sidebarExpandBtn').click(function () {
        expandSidebar();
    });

    // 聊天相关事件监听器已迁移到 deepchat.js

    // 研究搜索（已在后面重新实现）

    // Tab切换功能已迁移到 deepchat.js

    // 无限滚动监听器
    $('#researchList').on('scroll', function () {
        const scrollTop = $(this).scrollTop();
        const scrollHeight = $(this)[0].scrollHeight;
        const clientHeight = $(this).height();

        // 当滚动到底部附近时加载更多数据
        if (scrollTop + clientHeight >= scrollHeight - 50 && !isLoading && hasMoreData) {
            loadMoreResearch();
        }
    });

    // 搜索功能优化 - 使用防抖
    let searchTimeout;
    $('#research-search').on('input', function () {
        const searchTerm = $(this).val().trim();

        // 清除之前的定时器
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        // 设置新的定时器，300ms后执行搜索
        searchTimeout = setTimeout(() => {
            searchResearchList(searchTerm);
        }, 300);
    });

    // 键盘快捷键支持
    $(document).on('keydown', function(e) {
        // Ctrl/Cmd + B 切换侧边栏
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            toggleSidebar();
        }
    });

    // 移动设备上点击主内容区域时自动收起侧边栏
    $('.research-content, .research-chat-panel').on('click', function(e) {
        if (isMobile() && !sidebarCollapsed && $(window).width() <= 992) {
            // 确保不是点击了侧边栏内的元素
            if (!$(e.target).closest('.research-sidebar').length) {
                collapseSidebar();
            }
        }
    });
}

// 加载模型列表
function loadModelList() {
    $.ajax({
        type: "Post",
        url: "/Product/GetDeepResearchModels",
        dataType: "json",
        success: function (res) {
            var html = "";
            if (res.success) {
                if (res.data && res.data.length > 0) {
                    // 设置默认选中第一个模型
                    $("#selectedModel").html(res.data[0].modelNick);
                    currentModel = res.data[0].modelName;
                    window.currentModel = res.data[0].modelName;

                    for (var i = 0; i < res.data.length; i++) {
                        var modelNick = stripHTML(res.data[i].modelNick);
                        var modelName = res.data[i].modelName;
                        modelList.push({
                            model: modelName,
                            modelNick: res.data[i].modelNick
                        });
                        html += `<a class="dropdown-item font-14 model-item" href="#" data-model-name="${modelName}" data-model-nick="${modelNick}" data-seq="${res.data[i].seq}">
                                    <div class="model-info">
                                        <div class="model-name">${res.data[i].modelNick}</div>
                                        <div class="model-desc">${res.data[i].modelName}</div>
                                    </div>
                                </a>`;
                    }
                    $('#modelItems').html(html);
                    bindModelClickEvent();

                    // 绑定悬停事件
                    if (!isMobile()) {
                        bindModelHoverEvent();
                    }
                    $(".dropdown-item").css("margin-left", 0);
                } else {
                    $('#modelItems').html('<div class="dropdown-item text-muted">暂无可用模型</div>');
                }
            }
        },
        error: function (err) {
            console.error("获取模型列表失败:", err);
            $('#modelItems').html('<div class="dropdown-item text-danger">获取模型列表失败</div>');
        }
    });
}

// 绑定模型点击事件
function bindModelClickEvent() {
    $('#modelItems a').off('click').on('click', function (e) {
        e.preventDefault();
        var modelName = $(this).data('model-name');
        var modelNick = $(this).find('.model-name').html();
        selectModel(modelName, modelNick);
    });
}

// 绑定模型悬停事件
function bindModelHoverEvent() {
    $('#modelItems a').on('mouseenter', function (e) {
        var modelName = $(this).data('model-name');
        showTooltip(modelName, e);
    }).on('mouseleave', function () {
        hideTooltip();
    }).on('mousemove', function (e) {
        moveTooltip(e);
    });
}

// 显示工具提示
function showTooltip(text, e) {
    $('body').append('<div id="customTooltip" style="position: fixed; background: #333; color: #fff; padding: 5px 10px; border-radius: 4px; font-size: 12px; z-index: 9999;">' + text + '</div>');
    moveTooltip(e);
}

// 移动工具提示
function moveTooltip(e) {
    $('#customTooltip').css({
        left: e.pageX + 10,
        top: e.pageY + 10
    });
}

// 隐藏工具提示
function hideTooltip() {
    $('#customTooltip').remove();
}

// 选择模型
function selectModel(modelName, modelNick) {
    window.currentModel = modelName;
    currentModel = modelName;
    $('#selectedModel').html(modelNick);
    console.log('选择模型:', modelName, modelNick);
    balert("切换模型【" + stripHTML(modelNick) + "】成功", "success", false, 1000);
}

// 保存研究
function saveResearch() {
    if (window.researchEditor && window.researchEditor.vditorInstance) {
        loadingBtn('#save-btn');
        window.researchEditor.saveContent();
        unloadingBtn('#save-btn');
    }
}

// 选择搜索引擎
// function selectSearchEngine(engine) {
//     window.currentSearchEngine = engine;
//     currentSearchEngine = engine;
//     let engineName = '';
//     switch (engine) {
//         case 'google':
//             engineName = 'Google';
//             break;
//         case 'yahoo':
//             engineName = 'Yahoo';
//             break;
//     }
//     $('#selectedSearchEngine').html(`<i class="${engine}ico"></i>`);
//     console.log('选择搜索引擎:', engine);
// }

// 加载研究列表
function loadResearchList(reset = true) {
    if (reset) {
        currentPage = 1;
        hasMoreData = true;
        $('#researchList').html('');
    }

    if (isLoading || !hasMoreData) {
        return;
    }

    isLoading = true;

    // 显示加载状态
    if (currentPage === 1) {
        $('#researchList').html('<div class="loading-placeholder"><i class="fas fa-spinner fa-spin"></i> 正在加载研究列表...</div>');
    } else {
        $('#researchList').append('<div class="loading-more"><i class="fas fa-spinner fa-spin"></i> 加载更多...</div>');
    }

    $.ajax({
        type: "POST",
        url: "/DeepResearch/GetDeepResearchList",
        data: {
            page: currentPage,
            pageSize: pageSize,
            searchKeyword: currentSearchKeyword
        },
        dataType: "json",
        success: function (res) {
            isLoading = false;

            // 移除加载状态
            $('.loading-placeholder, .loading-more').remove();

            if (res.success && res.data) {
                const { items, hasMore, totalCount } = res.data;

                if (items && items.length > 0) {
                    // 渲染研究项目
                    items.forEach(function (research) {
                        const researchHtml = createResearchItemHtml(research);
                        $('#researchList').append(researchHtml);
                    });

                    // 更新分页状态
                    hasMoreData = hasMore;
                    currentPage++;

                    // 如果是页面初始加载且是第一页且没有当前选中的研究项目，自动选中第一个正在进行中的项目
                    if (isPageInitialLoad && currentPage === 2 && !currentResearchId) { // currentPage已经+1了，所以是2表示刚加载完第一页
                        autoSelectFirstInProgressResearch(items);
                        isPageInitialLoad = false; // 标记初始加载已完成
                    }
                } else if (currentPage === 1) {
                    // 第一页没有数据
                    $('#researchList').html('<div class="empty-placeholder"><i class="fas fa-clipboard-list"></i><p>暂无研究项目</p><p>点击"新建研究"开始您的第一个研究项目</p></div>');
                    hasMoreData = false;
                } else {
                    // 后续页面没有更多数据
                    hasMoreData = false;
                }
            } else {
                if (currentPage === 1) {
                    $('#researchList').html('<div class="error-placeholder"><i class="fas fa-exclamation-triangle"></i><p>加载研究列表失败</p><button class="btn btn-sm btn-primary" onclick="loadResearchList()">重试</button></div>');
                }
                balert('获取研究列表失败', 'danger');
            }
        },
        error: function (err) {
            isLoading = false;
            $('.loading-placeholder, .loading-more').remove();

            if (currentPage === 1) {
                $('#researchList').html('<div class="error-placeholder"><i class="fas fa-exclamation-triangle"></i><p>加载研究列表异常</p><button class="btn btn-sm btn-primary" onclick="loadResearchList()">重试</button></div>');
            }
            balert('获取研究列表异常', 'danger');
        }
    });
}

// 自动选中第一个正在进行中的研究项目
function autoSelectFirstInProgressResearch(researchItems) {
    if (!researchItems || researchItems.length === 0) {
        return;
    }

    // 查找第一个正在进行中的研究项目（进度大于0且小于100的）
    const inProgressResearch = researchItems.find(research => {
        const process = parseInt(research.process) || 0;
        return process > 0 && process < 100;
    });

    if (inProgressResearch) {
        // 延迟一点时间确保DOM已经渲染完成
        setTimeout(() => {
            selectResearch(inProgressResearch.chatId);
        }, 200);
    } else {
        // 如果没有正在进行中的项目，选中第一个已完成的项目（如果有的话）
        const completedResearch = researchItems.find(research => {
            const process = parseInt(research.process) || 0;
            return process === 100;
        });

        if (completedResearch) {
            setTimeout(() => {
                selectResearch(completedResearch.chatId);
            }, 200);
        } else {
            // 如果既没有进行中也没有已完成的，选中第一个项目
            const firstResearch = researchItems[0];
            if (firstResearch) {
                setTimeout(() => {
                    selectResearch(firstResearch.chatId);
                }, 200);
            }
        }
    }
}

// 创建研究项目HTML
function createResearchItemHtml(research) {
    const process = parseInt(research.process) || 0;
    const statusClass = process === 100 ? 'completed' : process > 0 ? 'processing' : '';
    const createTime = new Date(research.createTime).toLocaleDateString();

    // 解析研究描述（可能是JSON格式的问题列表）
    let summary = '';
    try {
        const questions = JSON.parse(research.deepDesc || '[]');
        if (Array.isArray(questions) && questions.length > 0) {
            summary = `包含${questions.length}个研究问题`;
        } else {
            summary = research.deepDesc || '基础研究项目';
        }
    } catch (e) {
        summary = research.deepDesc || '基础研究项目';
    }

    // 限制摘要长度
    if (summary.length > 50) {
        summary = summary.substring(0, 50) + '...';
    }

    const progressHtml = process < 100 ? `
        <div class="research-item-progress">
            <div class="research-progress-bar">
                <div class="research-progress-fill" style="width: ${process}%"></div>
            </div>
            <div class="research-progress-text">进度: ${process}%</div>
        </div>
    ` : '';

    const statusBadge = process === 100 ?
        '<span class="badge badge-success">已完成</span>' :
        process > 0 ?
            '<span class="badge badge-warning">进行中</span>' :
            '<span class="badge badge-secondary">待开始</span>';

    return `
        <div class="research-item ${statusClass}" data-id="${research.chatId}">
            <div class="research-item-header">
                <h6>${escapeHtml(research.deepTitle)}</h6>
                <span class="research-date">${createTime}</span>
            </div>
            <div class="research-item-summary">
                ${escapeHtml(summary)}
            </div>
            ${progressHtml}
            <div class="research-item-tags">
                ${statusBadge}
            </div>
            <div class="research-item-actions">
                <button class="btn btn-sm btn-outline-danger delete-btn" title="删除">
                    <i class="far fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `;
}

// 加载更多研究项目
function loadMoreResearch() {
    if (!isLoading && hasMoreData) {
        loadResearchList(false);
    }
}

// 搜索研究列表
function searchResearchList(searchTerm) {
    currentSearchKeyword = searchTerm;
    // 搜索时不触发自动选择
    isPageInitialLoad = false;
    loadResearchList(true);
}

// HTML转义函数
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 选择研究项目
function selectResearch(researchId) {
    currentResearchId = researchId;
    window.currentResearchId = researchId;

    // 用户手动选择后，禁用自动选择
    isPageInitialLoad = false;

    // 更新UI状态
    $('.research-item').removeClass('active');
    $(`.research-item[data-id="${researchId}"]`).addClass('active');

    // 调用后端API获取研究详情
    $.ajax({
        type: "POST",
        url: "/DeepResearch/GetDeepResearchDetail",
        data: { chatId: researchId },
        dataType: "json",
        success: function (res) {
            if (res.success && res.data) {
                const researchData = res.data;
                const process = researchData.process || "0";

                // 更新研究项目进度显示
                updateResearchProgress(researchId, process);

                // 根据Process状态控制页面行为
                if (process !== "100") {
                    // 研究未完成，需要加入SignalR群组接收AI活动通知
                    joinResearchSignalRGroup(researchId);

                    // 加载历史活动
                    loadResearchActivities(researchId);

                    // 1. 去掉遮罩层但保持编辑器只读
                    $('#researchEditContainer').removeClass('disabled').removeAttr('data-disabled-message');
                    // 禁用Chat tab
                    $('#chat-tab').addClass('disabled').attr('title', '请先选择一个已完成的研究项目');

                    // 2. 不切换到Chat，保持在AI活动页面
                    $('#chatTabs .nav-link').removeClass('active');
                    $('.chat-panel-content .tab-pane').removeClass('active show');
                    $('#activity-tab').addClass('active');
                    $('#activityPanel').addClass('active show');

                    // 3. 设置编辑器为只读模式并加载内容
                    if (window.researchEditor && window.researchEditor.vditorInstance) {
                        // 加载研究内容（如果有的话）
                        loadResearchContentFromAPI(researchId, researchData);
                        // 设置为只读模式
                        if (window.researchEditor && window.researchEditor.vditorInstance) {
                            window.researchEditor.disableEditor();
                        }
                    }


                } else {
                    // 研究已完成
                    // 1. 编辑器启用状态
                    $('#researchEditContainer').removeClass('disabled').removeAttr('data-disabled-message');
                    // 启用Chat tab
                    $('#chat-tab').removeClass('disabled').removeAttr('title');

                    // 2. 切换到对话tab
                    $('#chatTabs .nav-link').removeClass('active');
                    $('.chat-panel-content .tab-pane').removeClass('active show');
                    $('#chat-tab').addClass('active');
                    $('#chatPanel').addClass('active show');

                    // 3. 加载研究内容到编辑器并启用编辑
                    loadResearchContentFromAPI(researchId, researchData);
                    if (window.researchEditor && window.researchEditor.vditorInstance) {
                        window.researchEditor.enableEditor();
                    }
                    // 加载历史活动
                    loadResearchActivities(researchId);
                    // 加载聊天历史
                    loadChatHistory(researchId);
                    // 加入SignalR群组
                    joinResearchSignalRGroup(researchId);
                }
            } else {
                balert('获取研究详情失败', 'danger');
            }
        },
        error: function (err) {
            balert('获取研究详情异常', 'danger');
        }
    });
}

// 加入研究项目的SignalR群组
function joinResearchSignalRGroup(researchId) {
    // 确保SignalR连接已初始化
    if (typeof window.initDeepResearchSignalR === 'function') {
        window.initDeepResearchSignalR().then(function () {
            // 检查连接状态并加入群组
            if (window.deepResearchConnection && window.deepResearchConnection.state === signalR.HubConnectionState.Connected) {
                window.deepResearchConnection.invoke("JoinGroup", researchId)
                    .catch(function (err) {
                        balert('加入研究项目群组失败: ' + (err.message || err), 'warning');
                    });
            } else {
                // 如果连接不可用，尝试重新初始化
                if (!window.deepResearchConnection || window.deepResearchConnection.state !== signalR.HubConnectionState.Connected) {
                    window.initDeepResearchSignalR().then(function () {
                        if (window.deepResearchConnection && window.deepResearchConnection.state === signalR.HubConnectionState.Connected) {
                            window.deepResearchConnection.invoke("JoinGroup", researchId)
                                .catch(function (err) {
                                    // 静默处理错误，避免过多提示
                                });
                        }
                    });
                }
            }
        }).catch(function (err) {
            // 静默处理SignalR连接失败
        });
    } else {
        balert('SignalR功能不可用，请刷新页面重试', 'warning');
    }
}

// 加载研究项目的历史活动
function loadResearchActivities(researchId) {
    // 清空当前活动列表
    $('#activityList').html('<div class="activity-placeholder">正在加载活动历史...</div>');

    $.ajax({
        type: "POST",
        url: "/DeepResearch/GetDeepResearchActivities",
        data: { chatId: researchId },
        dataType: "json",
        success: function (res) {
            if (res.success && res.data) {
                // 清空占位符
                $('#activityList').html('');

                // 如果没有活动历史，显示提示
                if (res.data.length === 0) {
                    $('#activityList').html('<div class="activity-placeholder">暂无活动记录</div>');
                    return;
                }

                // 按时间顺序显示活动（最新的在前面）
                res.data.reverse().forEach(function (activity) {
                    const statusIcon = activity.activeStatus === 'loading' ?
                        '<i class="fas fa-spinner fa-spin"></i>' :
                        activity.activeStatus === 'success' ?
                            '<i class="fas fa-check-circle text-success"></i>' :
                            '<i class="fas fa-times-circle text-danger"></i>';

                    const activityHtml = `
                        <div class="activity-item" data-title="${activity.title}">
                            <div class="activity-icon">
                                <i class="${activity.icon || 'fas fa-info-circle'}"></i>
                            </div>
                            <div class="activity-content">
                                <div class="activity-title">${activity.title}</div>
                                <div class="activity-desc">${activity.activeContent}</div>
                                <div class="activity-time">${formatActivityTime(activity.createTime)}</div>
                            </div>
                            <div class="activity-status">
                                ${statusIcon}
                            </div>
                        </div>
                    `;

                    $('#activityList').append(activityHtml);
                });

            } else {
                $('#activityList').html('<div class="activity-placeholder">加载活动历史失败</div>');
            }
        },
        error: function (err) {
            $('#activityList').html('<div class="activity-placeholder">加载活动历史异常</div>');
        }
    });
}

// 格式化活动时间显示
function formatActivityTime(timeString) {
    if (!timeString) return '未知时间';

    const activityTime = new Date(timeString);
    const now = new Date();
    const diffMs = now - activityTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
        return '刚刚';
    } else if (diffMins < 60) {
        return `${diffMins}分钟前`;
    } else if (diffHours < 24) {
        return `${diffHours}小时前`;
    } else if (diffDays < 7) {
        return `${diffDays}天前`;
    } else {
        return activityTime.toLocaleDateString();
    }
}

// 从API加载研究内容到编辑器
function loadResearchContentFromAPI(researchId, researchData = null) {
    // 显示加载状态
    if (window.researchEditor && window.researchEditor.vditorInstance) {
        const title = researchData?.deepTitle || $(`.research-item[data-id="${researchId}"] h6`).text() || '未命名研究';
        window.researchEditor.vditorInstance.setValue(`# ${title}\n\n正在加载研究报告内容...`);
        window.researchEditor.currentResearchId = researchId;
    }

    // 调用API获取研究报告内容
    $.ajax({
        type: "POST",
        url: "/DeepResearch/GetResearchReportContent",
        data: { chatId: researchId },
        dataType: "json",
        success: function (res) {
            if (res.success && res.data) {
                const content = res.data.content;
                const source = res.data.source;

                // 设置编辑器内容
                if (window.researchEditor && window.researchEditor.vditorInstance) {
                    if (content && content.trim() !== '') {
                        window.researchEditor.vditorInstance.setValue(content);
                    } else {
                        // 如果没有内容，显示默认模板
                        const title = researchData?.deepTitle || $(`.research-item[data-id="${researchId}"] h6`).text() || '未命名研究';
                        window.researchEditor.vditorInstance.setValue(`# ${title}\n\n暂无研究报告内容`);
                    }
                    window.researchEditor.currentResearchId = researchId;
                    window.researchEditor.isEditMode = true;
                }

            } else {
                // 设置错误状态的内容
                if (window.researchEditor && window.researchEditor.vditorInstance) {
                    const title = researchData?.deepTitle || $(`.research-item[data-id="${researchId}"] h6`).text() || '未命名研究';
                    window.researchEditor.vditorInstance.setValue(`# ${title}\n\n加载研究报告内容失败，请重试`);
                }
                balert('获取研究报告内容失败', 'danger');
            }
        },
        error: function (err) {
            // 设置错误状态的内容
            if (window.researchEditor && window.researchEditor.vditorInstance) {
                const title = researchData?.deepTitle || $(`.research-item[data-id="${researchId}"] h6`).text() || '未命名研究';
                window.researchEditor.vditorInstance.setValue(`# ${title}\n\n加载研究报告内容异常，请重试`);
            }
            balert('获取研究报告内容异常', 'danger');
        }
    });
}

// 加载研究内容到编辑器（保留原函数作为备用）
function loadResearchContent(researchId, researchData = null) {
    let title, content;

    if (researchData) {
        // 使用传入的研究数据
        title = researchData.deepTitle || '未命名研究';
        content = researchData.deepContent || `# ${title}\n\n`;
    } else {
        // 从DOM获取标题，设置默认内容
        title = $(`.research-item[data-id="${researchId}"] h6`).text() || '未命名研究';
        content = `# ${title}\n\n`;
    }

    // 设置编辑器内容
    if (window.researchEditor && window.researchEditor.vditorInstance) {
        window.researchEditor.vditorInstance.setValue(content);
        window.researchEditor.currentResearchId = researchId;
        window.researchEditor.isEditMode = true;
    }
}

// 更新研究项目进度显示
function updateResearchProgress(researchId, process) {
    const researchItem = $(`.research-item[data-id="${researchId}"]`);
    const progressValue = parseInt(process) || 0;

    // 移除所有状态类
    researchItem.removeClass('processing completed error');

    // 根据进度设置状态类
    if (progressValue === 100) {
        researchItem.addClass('completed');
    } else if (progressValue > 0) {
        researchItem.addClass('processing');
    }

    // 查找或创建进度条容器
    let progressContainer = researchItem.find('.research-item-progress');
    if (progressContainer.length === 0) {
        // 在research-item-summary后面添加进度条
        const summaryElement = researchItem.find('.research-item-summary');
        if (summaryElement.length > 0) {
            summaryElement.after(`
                <div class="research-item-progress">
                    <div class="research-progress-bar">
                        <div class="research-progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="research-progress-text">进度: 0%</div>
                </div>
            `);
            progressContainer = researchItem.find('.research-item-progress');
        }
    }

    // 更新进度条
    if (progressContainer.length > 0) {
        const progressBar = progressContainer.find('.research-progress-fill');
        const progressText = progressContainer.find('.research-progress-text');

        // 动画更新进度条宽度
        progressBar.css('width', progressValue + '%');
        progressText.text(`进度: ${progressValue}%`);

        // 如果进度为100%，隐藏进度条
        if (progressValue === 100) {
            setTimeout(() => {
                progressContainer.fadeOut(300);
            }, 1000);
        } else {
            progressContainer.show();
        }
    }
}

// 显示新建研究对话框
function showNewResearchDialog() {
    // 检查是否有正在进行的任务
    if (typeof hasRunningTasks === 'function' && hasRunningTasks()) {
        balert('当前有正在进行的研究任务，请等待完成后再创建新的研究项目', 'warning');
        return;
    }
    
    showPromptModal('新建研究', '请输入研究主题：', function (topic) {
        if (topic && topic.trim()) {
            createNewResearchWithAPI(topic.trim());
        }
    });
}

// 添加活动项目
function addActivityItem(title, description, iconClass, status) {
    const statusIcon = status === 'loading' ?
        '<i class="fas fa-spinner fa-spin"></i>' :
        '<i class="fas fa-check-circle text-success"></i>';

    const activityHtml = `
        <div class="activity-item" data-title="${title}">
            <div class="activity-icon">
                <i class="${iconClass}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">${title}</div>
                <div class="activity-desc">${description}</div>
                <div class="activity-time">刚刚</div>
            </div>
            <div class="activity-status">
                ${statusIcon}
            </div>
        </div>
    `;

    $('#activityList').prepend(activityHtml);
}

// 更新活动项目
function updateActivityItem(title, newDescription, status) {
    const item = $(`.activity-item[data-title="${title}"]`);
    if (item.length) {
        item.find('.activity-desc').text(newDescription);
        if (status === 'success') {
            item.find('.activity-status').html('<i class="fas fa-check-circle text-success"></i>');
        }
        else if (status === 'error') {
            item.find('.activity-status').html('<i class="fas fa-times-circle text-danger"></i>');
        }
        else if (status === 'loading') {
            item.find('.activity-status').html('<i class="fas fa-spinner fa-spin"></i>');
        }
        else if (status === 'info') {
            item.find('.activity-status').html('<i class="fas fa-info-circle text-info"></i>');
        }
    }
}

// AI对话相关函数已迁移到 deepchat.js

// 删除研究
function deleteResearch(researchId) {
    // 获取研究项目标题用于确认对话框
    const researchTitle = $(`.research-item[data-id="${researchId}"] h6`).text() || '未命名研究';
    
    showConfirmationModal('删除确认', `确定要删除研究项目"${researchTitle}"吗？<br><br>
        <strong>注意：</strong>此操作将永久删除该研究项目的所有数据，包括研究报告、活动记录和对话历史，且无法恢复。<br><br>
        <span class="text-info"><i class="fas fa-info-circle"></i> 删除正在进行中的任务时，后台将自动取消任务</span>`, function () {
        // 显示删除进度
        const $researchItem = $(`.research-item[data-id="${researchId}"]`);
        const originalContent = $researchItem.html();
        $researchItem.html('<div class="text-center p-3"><i class="fas fa-spinner fa-spin"></i> 正在删除...</div>');
        
        // 调用后端API删除
        $.ajax({
            type: "POST",
            url: "/DeepResearch/DeleteDeepResearch",
            data: { chatId: researchId },
            dataType: "json",
            success: function (res) {
                if (res.success) {
                    // 删除成功，移除DOM元素
                    $researchItem.fadeOut(300, function() {
                        $(this).remove();
                        
                        // 检查是否删除的是当前选中的研究项目
                        if (currentResearchId == researchId) {
                            // 重置编辑器到初始状态
                            if (window.researchEditor && window.researchEditor.vditorInstance) {
                                window.researchEditor.vditorInstance.setValue('# 请选择或创建一个研究项目开始编辑。');
                                window.researchEditor.currentResearchId = null;
                                window.researchEditor.isEditMode = false;
                            }
                            // 重置编辑器为禁用状态
                            $('#researchEditContainer').addClass('disabled').removeAttr('data-disabled-message');
                            // 重置Chat tab为禁用状态
                            $('#chat-tab').addClass('disabled').attr('title', '请先选择一个已完成的研究项目');
                            // 清空活动列表
                            $('#activityList').html('<div class="activity-placeholder">请选择一个研究项目查看活动记录</div>');
                            // 重置聊天状态（如果deepchat.js已加载）
                            if (typeof window.resetChatState === 'function') {
                                window.resetChatState();
                            }
                            // 切换tab到AI活动
                            $('#chatTabs .nav-link').removeClass('active');
                            $('.chat-panel-content .tab-pane').removeClass('active show');
                            $('#activity-tab').addClass('active');
                            $('#activityPanel').addClass('active show');
                            currentResearchId = null;
                        }
                        
                        // 检查是否还有研究项目，如果没有则显示空状态
                        if ($('#researchList .research-item').length === 0) {
                            $('#researchList').html('<div class="empty-placeholder"><i class="fas fa-clipboard-list"></i><p>暂无研究项目</p><p>点击"新建研究"开始您的第一个研究项目</p></div>');
                        }
                    });
                    
                    balert('研究项目删除成功', 'success');
                } else {
                    // 删除失败，恢复原内容
                    $researchItem.html(originalContent);
                    balert(res.msg || '删除失败，请重试', 'danger');
                }
            },
            error: function (err) {
                // 删除异常，恢复原内容
                $researchItem.html(originalContent);
                console.error("删除研究项目异常:", err);
                balert('删除研究项目异常，请重试', 'danger');
            }
        });
    });
}

// 过滤研究列表功能已被searchResearchList替代

// 导出PDF
function exportCurrentResearchToPDF() {
    window.researchEditor.exportAsPDF();
}

// 模型过滤功能
function filterModels() {
    var input = document.getElementById("modelSearch");
    var filter = input.value.toLowerCase();
    var groups = document.querySelectorAll('.model-group');

    // 当输入框为空时，展开第一个分组，折叠其他所有分组，所有项可见
    if (groups.length > 0) {
        if (filter === '') {
            groups.forEach(function (group, index) {
                var nodes = group.querySelectorAll('a');

                nodes.forEach(function (node) {
                    node.style.display = "block";  // 显示所有模型
                });

                var collapse = group.querySelector('.collapse');
                if (index === 0) {
                    $(collapse).collapse('show');  // 展开第一个分组
                } else {
                    $(collapse).collapse('hide');  // 折叠其他分组
                }
                group.style.display = "block";  // 显示所有分组
            });
            return;
        }
        groups.forEach(function (group) {
            var nodes = group.querySelectorAll('a');
            var groupVisible = false;  // 用于判断当前组是否应当展示

            nodes.forEach(function (node) {
                var modelNick = node.getAttribute('data-model-nick').toLowerCase();
                if (modelNick.includes(filter)) {
                    node.style.display = "block";  // 显示匹配的模型
                    groupVisible = true;  // 标记分组为可见
                } else {
                    node.style.display = "none";
                }
            });

            // 如果组内有匹配的模型，则展开该组并显示，否则隐藏
            if (groupVisible) {
                var collapse = group.querySelector('.collapse');
                $(collapse).collapse('show');  // 使用jQuery来控制展开
                group.style.display = "block";  // 显示此分组
            } else {
                var collapse = group.querySelector('.collapse');
                $(collapse).collapse('hide');  // 如果没有匹配项则折叠该组
                group.style.display = "none";  // 隐藏此分组
            }
        });
    } else {
        var nodes = document.querySelectorAll('#modelItems a');
        nodes.forEach(function (node) {
            var modelNick = node.getAttribute('data-model-nick').toLowerCase();
            var modelName = node.querySelector('.model-name').textContent.toLowerCase();
            var modelDesc = node.querySelector('.model-desc').textContent.toLowerCase();
            if (modelNick.includes(filter) || modelName.includes(filter) || modelDesc.includes(filter)) {
                node.style.display = "block";
            } else {
                node.style.display = "none";
            }
        });
    }
}

// 去除HTML标签
function stripHTML(html) {
    var tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

// 检测是否为移动设备
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// 侧边栏展开/收起功能
let sidebarCollapsed = false;

// 切换侧边栏状态
function toggleSidebar() {
    if (sidebarCollapsed) {
        expandSidebar();
    } else {
        collapseSidebar();
    }
}

// 收起侧边栏
function collapseSidebar() {
    const $sidebar = $('#researchSidebar');
    const $container = $('.research-container');
    const $toggleBtn = $('#sidebarToggleBtn');
    const $expandBtn = $('#sidebarExpandBtn');

    // 添加收起状态的类
    $sidebar.addClass('collapsed');
    $container.addClass('sidebar-collapsed');
    
    // 更新按钮图标
    $toggleBtn.find('i').removeClass('fa-chevron-left').addClass('fa-chevron-right');
    $toggleBtn.attr('title', '展开面板 (Ctrl+B)');
    
    // 显示展开按钮
    setTimeout(() => {
        $expandBtn.show();
    }, 300); // 等待收起动画完成
    
    sidebarCollapsed = true;
    
    // 保存状态到本地存储
    localStorage.setItem('deepresearch_sidebar_collapsed', 'true');
}

// 展开侧边栏
function expandSidebar() {
    const $sidebar = $('#researchSidebar');
    const $container = $('.research-container');
    const $toggleBtn = $('#sidebarToggleBtn');
    const $expandBtn = $('#sidebarExpandBtn');

    // 隐藏展开按钮
    $expandBtn.hide();
    
    // 移除收起状态的类
    $sidebar.removeClass('collapsed');
    $container.removeClass('sidebar-collapsed');
    
    // 更新按钮图标
    $toggleBtn.find('i').removeClass('fa-chevron-right').addClass('fa-chevron-left');
    $toggleBtn.attr('title', '收起面板 (Ctrl+B)');
    
    sidebarCollapsed = false;
    
    // 保存状态到本地存储
    localStorage.setItem('deepresearch_sidebar_collapsed', 'false');
}

// 初始化侧边栏状态（从本地存储恢复）
function initSidebarState() {
    const collapsed = localStorage.getItem('deepresearch_sidebar_collapsed');
    
    // 在移动设备上，默认收起侧边栏以节省空间
    if (isMobile() && collapsed === null) {
        setTimeout(() => {
            collapseSidebar();
        }, 100);
        return;
    }
    
    if (collapsed === 'true') {
        // 延迟执行，确保DOM已完全加载
        setTimeout(() => {
            collapseSidebar();
        }, 100);
    }
}




