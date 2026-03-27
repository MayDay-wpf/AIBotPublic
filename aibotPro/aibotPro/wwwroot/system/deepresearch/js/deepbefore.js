// 深度研究 - 创建新研究功能
// 此文件包含创建新研究的核心逻辑，包括API调用和问题生成

// 全局变量
let currentQuestions = [];
let currentResearchTitle = '';
let deepResearchConnection = null;

var deepResearchChatId = '';

function checkToken() {
    const token = localStorage.getItem('aibotpro_userToken');
    if (!token) {
        window.location.href = "/Home/Welcome";
        return false;
    }
    return token;
}
// 初始化SignalR连接
function initDeepResearchSignalR() {
    if (deepResearchConnection && deepResearchConnection.state === signalR.HubConnectionState.Connected) {
        return Promise.resolve();
    }

    deepResearchConnection = new signalR.HubConnectionBuilder()
        .withUrl("/deepResearchHub", {
            accessTokenFactory: () => checkToken()
        })
        .withAutomaticReconnect([0, 2000, 10000, 30000]) // 自动重连间隔：立即、2秒、10秒、30秒
        .build();

    // 监听连接状态变化
    deepResearchConnection.onreconnecting((error) => {
        console.log('SignalR正在重连...', error);
        safeAlert('连接断开，正在尝试重连...', 'warning', false, 3000);
    });

    deepResearchConnection.onreconnected((connectionId) => {
        console.log('SignalR重连成功', connectionId);
        safeAlert('连接已恢复', 'success', false, 2000);
        
        // 重连成功后重新加入群组
        if (deepResearchChatId) {
            deepResearchConnection.invoke("JoinGroup", deepResearchChatId).catch(function (err) {
                console.error('重连后加入群组失败:', err);
            });
        }
    });

    deepResearchConnection.onclose((error) => {
        console.log('SignalR连接关闭', error);
        if (error) {
            safeAlert('连接已断开，请刷新页面重试', 'danger', false, 5000);
            // 5秒后尝试手动重连
            setTimeout(() => {
                attemptManualReconnect();
            }, 5000);
        }
    });
    // 监听加入群组成功
    deepResearchConnection.on("JoinGroupSuccess", function (chatId) {
        deepResearchChatId = chatId;
        // 更新window对象中的chatId
        window.deepResearchChatId = deepResearchChatId;
    });

    // 监听活动消息和状态更新
    deepResearchConnection.on("ReceiveActivityUpdate", function (data) {
        deepResearchChatId = data.chatId;
        // 更新window对象中的chatId
        window.deepResearchChatId = deepResearchChatId;
        
        if ($('.activity-placeholder').length > 0) {
            $('.activity-placeholder').remove();
        }

        // 根据数据类型决定是添加新活动还是更新现有活动
        if (data.message && data.icon) {
            // 包含message和icon说明是新活动
            safeAddActivityItem(data.title, data.message, data.icon, data.status);
        } else if (data.newDescription) {
            // 包含newDescription说明是状态更新
            safeUpdateActivityItem(data.title, data.newDescription, data.status);
        }
    });

    // 监听研究完成消息
    deepResearchConnection.on("ResearchCompleted", function (researchId, title, summary) {
        // 更新研究项目摘要
        $(`.research-item[data-id="${researchId}"] .research-item-summary`).text(summary);
        // 更新进度为100%
        if (typeof updateResearchProgress === 'function') {
            updateResearchProgress(researchId, "100");
        }
        safeAlert(`研究"${title}"已完成！`, 'success', false, 3000);
    });

    // 监听研究进度更新消息
    deepResearchConnection.on("ResearchProgressUpdate", function (data) {
        if (data.chatId && data.process !== undefined) {
            // 更新进度条显示
            if (typeof updateResearchProgress === 'function') {
                updateResearchProgress(data.chatId, data.process);
            }

            // 如果当前选中的研究项目进度更新了，需要重新检查编辑器状态
            if (window.currentResearchId === data.chatId) {
                if (data.process === "100") {
                    // 更新research-item-tags的状态badge
                    $(`.research-item[data-id="${data.chatId}"] .research-item-tags`).html('<span class="badge badge-success">已完成</span>');
                    // 研究完成，启用编辑器并切换到Chat tab
                    $('#researchEditContainer').removeClass('disabled');
                    // 启用编辑器编辑功能
                    if (window.researchEditor && window.researchEditor.vditorInstance) {
                        window.researchEditor.vditorInstance.enable();
                        window.researchEditor.isEditMode = true;
                    }
                    // 启用Chat tab
                    $('#chat-tab').removeClass('disabled').removeAttr('title');
                    $('#chatTabs .nav-link').removeClass('active');
                    $('.chat-panel-content .tab-pane').removeClass('active show');
                    $('#chat-tab').addClass('active');
                    $('#chatPanel').addClass('active show');
                    // 加载聊天历史
                    loadChatHistory(data.chatId);
                } else {
                    // 研究未完成，去掉遮罩层但保持编辑器只读
                    $('#researchEditContainer').removeClass('disabled');
                    // 设置编辑器为只读模式
                    if (window.researchEditor && window.researchEditor.vditorInstance) {
                        window.researchEditor.vditorInstance.disabled();
                        window.researchEditor.isEditMode = false;
                    }
                    // 更新research-item-tags的状态badge
                    $(`.research-item[data-id="${data.chatId}"] .research-item-tags`).html('<span class="badge badge-warning">进行中</span>');
                    $('#chatTabs .nav-link').removeClass('active');
                    $('.chat-panel-content .tab-pane').removeClass('active show');
                    $('#activity-tab').addClass('active');
                    $('#activityPanel').addClass('active show');
                }
            }
        }
    });

    // 监听研究报告内容实时推送
    deepResearchConnection.on("ReceiveReportContent", function (data) {
        if (data.chatId && data.content !== undefined) {
            // 如果当前选中的研究项目收到内容更新
            if (window.currentResearchId === data.chatId) {
                // 更新编辑器内容
                if (window.researchEditor && window.researchEditor.vditorInstance) {
                    // 获取当前内容
                    const currentContent = window.researchEditor.vditorInstance.getValue();
                    // 如果新内容比当前内容长，说明有新内容添加
                    if (data.content.length > currentContent.length) {
                        // 更新编辑器内容
                        window.researchEditor.vditorInstance.setValue(data.content);
                        // 滚动到底部显示最新内容
                        setTimeout(() => {
                            // 尝试多种可能的滚动容器
                            const scrollContainers = [
                                '#vditor .vditor-content',
                                '#vditor .vditor-wysiwyg',
                                '#vditor .vditor-ir',
                                '#vditor .vditor-sv .vditor-sv__preview',
                                '#vditor'
                            ];

                            for (const selector of scrollContainers) {
                                const element = document.querySelector(selector);
                                if (element) {
                                    element.scrollTop = element.scrollHeight;
                                    break;
                                }
                            }
                        }, 100);
                    }
                }
            }
        }
    });



    // 监听任务创建完成消息
    deepResearchConnection.on("TaskCreated", function (data) {
        if (data.chatId) {
            // 任务创建完成后，自动选中新创建的研究项目
            safeSelectResearch(data.chatId);
            // 如果当前选中的是这个新创建的研究项目，设置编辑器为只读模式
            if (window.currentResearchId === data.chatId) {
                // 去掉遮罩层但保持编辑器只读
                $('#researchEditContainer').removeClass('disabled');
                if (window.researchEditor && window.researchEditor.vditorInstance) {
                    window.researchEditor.disableEditor();
                }
            }
        }
    });

    // 监听错误消息
    deepResearchConnection.on("Error", function (data) {
        safeAlert(data.message + ': ' + data.error, 'danger');
    });

    // 监听深度研究聊天消息
    deepResearchConnection.on("ReceiveDeepResearchChat", function (data) {
        handleStreamingChatMessage(data);
    });

    // 启动连接
    return deepResearchConnection.start().then(function () {
        console.log('SignalR连接成功');
        // 更新window对象中的连接
        updateWindowConnection();
    }).catch(function (err) {
        console.error('SignalR连接失败:', err);
        safeAlert('连接服务器失败，部分功能可能受影响', 'warning', false, 3000);
        // 3秒后尝试重连
        setTimeout(() => {
            attemptManualReconnect();
        }, 3000);
    });
}

// 手动重连函数
function attemptManualReconnect() {
    if (deepResearchConnection && deepResearchConnection.state === signalR.HubConnectionState.Disconnected) {
        console.log('尝试手动重连SignalR...');
        deepResearchConnection.start().then(function () {
            console.log('手动重连成功');
            safeAlert('连接已恢复', 'success', false, 2000);
            
            // 重连成功后重新加入群组
            if (deepResearchChatId) {
                deepResearchConnection.invoke("JoinGroup", deepResearchChatId).catch(function (err) {
                    console.error('重连后加入群组失败:', err);
                });
            }
            
            // 更新window对象中的连接
            updateWindowConnection();
        }).catch(function (err) {
            console.error('手动重连失败:', err);
            // 如果手动重连失败，10秒后再次尝试
            setTimeout(() => {
                attemptManualReconnect();
            }, 10000);
        });
    }
}

// 检查连接状态
function checkConnectionStatus() {
    if (!deepResearchConnection) {
        return 'NotInitialized';
    }
    return deepResearchConnection.state;
}

// 确保连接可用的包装函数
function ensureConnection() {
    return new Promise((resolve, reject) => {
        if (deepResearchConnection && deepResearchConnection.state === signalR.HubConnectionState.Connected) {
            resolve();
        } else if (deepResearchConnection && deepResearchConnection.state === signalR.HubConnectionState.Connecting) {
            // 如果正在连接中，等待连接完成
            const checkInterval = setInterval(() => {
                if (deepResearchConnection.state === signalR.HubConnectionState.Connected) {
                    clearInterval(checkInterval);
                    resolve();
                } else if (deepResearchConnection.state === signalR.HubConnectionState.Disconnected) {
                    clearInterval(checkInterval);
                    reject(new Error('连接失败'));
                }
            }, 100);
        } else {
            // 尝试重新初始化连接
            initDeepResearchSignalR().then(resolve).catch(reject);
        }
    });
}

// 创建新研究的主函数
function createNewResearchWithAPI(title) {
    if (!title || !title.trim()) {
        if (typeof balert === 'function') {
            balert('请输入有效的研究标题', 'warning');
        } else {
            balert('请输入有效的研究标题', 'warning');
        }
        return;
    }

    // 检查是否有正在进行的任务
    if (hasRunningTasks()) {
        safeAlert('当前有正在进行的研究任务，请等待完成后再创建新的研究项目', 'warning');
        return;
    }

    currentResearchTitle = title.trim();

    // 创建新研究时重置编辑器状态
    resetEditorForNewResearch();

    // 初始化SignalR连接
    initDeepResearchSignalR().then(function () {
        // 显示加载状态
        showLoadingState('正在生成研究相关问题...');

        // 调用API生成问题
        generateResearchQuestions(currentResearchTitle);
    }).catch(function (err) {
        // 即使SignalR连接失败，也继续执行
        showLoadingState('正在生成研究相关问题...');
        generateResearchQuestions(currentResearchTitle);
    });
}

// 检查是否有正在进行的任务
function hasRunningTasks() {
    // 检查是否有带有"进行中"标识的研究项目
    const runningTasks = $('.research-item .badge-warning:contains("进行中")').length;
    
    // 检查是否有processing类的研究项目
    const processingTasks = $('.research-item.processing').length;
    
    // 检查是否有进度条显示（表示任务正在进行）
    const progressBarTasks = $('.research-item .research-item-progress:visible').length;
    
    // 检查是否有进度文本显示非100%的进度
    let progressTextTasks = 0;
    $('.research-item .research-progress-text').each(function() {
        const text = $(this).text();
        const match = text.match(/进度:\s*(\d+)%/);
        if (match) {
            const progress = parseInt(match[1]);
            if (progress > 0 && progress < 100) {
                progressTextTasks++;
            }
        }
    });
    
    // 检查是否有"待开始"状态的研究项目（刚创建但还未开始）
    const pendingTasks = $('.research-item .badge-secondary:contains("待开始")').length;
    
    // 如果任何一种检查方式发现有正在进行的任务，则返回true
    const hasRunning = runningTasks > 0 || processingTasks > 0 || progressBarTasks > 0 || progressTextTasks > 0 || pendingTasks > 0;
    
    return hasRunning;
}

// 为新研究重置编辑器状态
function resetEditorForNewResearch() {
    // 清空编辑器内容
    if (window.researchEditor && window.researchEditor.vditorInstance) {
        window.researchEditor.vditorInstance.setValue('');
        // 禁用编辑器
        window.researchEditor.vditorInstance.disabled();
        window.researchEditor.isEditMode = false;
    }

    // 添加禁用遮罩层，并设置新建研究时的提示文字
    $('#researchEditContainer').addClass('disabled').attr('data-disabled-message', '正在创建研究项目，请勿离开页面...');

    // 切换到AI活动面板
    $('#chatTabs .nav-link').removeClass('active');
    $('.chat-panel-content .tab-pane').removeClass('active show');
    $('#activity-tab').addClass('active');
    $('#activityPanel').addClass('active show');

    // 清空当前研究ID
    window.currentResearchId = "";
    currentResearchId = "";
}

// 调用后端API生成研究问题
async function generateResearchQuestions(title) {
    deepResearchChatId = '';
    $('#activityList').html('');
    // 立即加入SignalR群组
    ensureConnection().then(() => {
        deepResearchConnection.invoke("JoinGroup", deepResearchChatId).catch(function (err) {
            safeAlert('加入SignalR群组失败: ' + (err.message || err), 'warning');
        });
    }).catch((err) => {
        console.error('确保连接失败:', err);
        safeAlert('连接服务器失败，请稍后重试', 'warning');
    });
    //等待加入群组成功
    while (!deepResearchChatId) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    $.ajax({
        type: "POST",
        url: "/DeepResearch/GenerateQuestions",
        data: { title: title, chatId: deepResearchChatId },
        dataType: "json",
        success: function (res) {
            hideLoadingState();

            if (res.success && res.data && res.data.length > 0) {
                // 保存生成的问题
                currentQuestions = res.data;

                // 显示问题确认对话框
                showQuestionsConfirmationDialog(title, res.data);
            } else {
                // 处理失败情况
                safeAlert(res.msg || '研究方向拓展失败，将直接创建研究项目', 'warning');

                // 即使失败也继续创建研究项目
                proceedWithResearchCreation(title, []);
            }
        },
        error: function (xhr, status, error) {
            hideLoadingState();


            safeAlert(errorMessage, 'danger');

            // 提供继续创建的选项
            safeShowConfirmationModal(
                '继续创建研究？',
                '无法生成相关方向，是否直接创建研究项目？',
                function () {
                    proceedWithResearchCreation(title, []);
                },
                function () {
                    proceedWithResearchCreation(title, []);
                }
            );
        }
    });
}

// 显示问题确认对话框
function showQuestionsConfirmationDialog(title, questions) {
    let questionsHtml = '';
    questions.forEach((question, index) => {
        questionsHtml += `
            <div class="form-check mb-2">
                <input class="form-check-input" type="checkbox" value="${escapeHtml(question)}" 
                       id="question${index}" checked>
                <label class="form-check-label" for="question${index}">
                    ${escapeHtml(question)}
                </label>
            </div>
        `;
    });

    const modalContent = `
        <div class="modal fade" id="questionsModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-question-circle text-primary me-2"></i>
                            完善研究方向
                        </h5>
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <h5 class="text-muted">研究标题：</h5>
                            <p class="fw-bold">${escapeHtml(title)}</p>
                        </div>
                        <div class="mb-3">
                            <h6 class="text-muted">AI为您拓展了更多研究方向细节，请选择您感兴趣的方向：</h6>
                            <div class="questions-container border rounded p-3 bg-light">
                                <div class="form-check mb-3 border-bottom pb-2">
                                    <input class="form-check-input" type="checkbox" id="selectAll" checked>
                                    <label class="form-check-label fw-bold text-primary" for="selectAll">
                                        全选/全不选
                                    </label>
                                </div>
                                ${questionsHtml}
                            </div>
                        </div>
                        <div class="mb-3">
                            <h6 class="text-muted">您也可以手动添加自己的研究方向或补充生成报告的内容要求：</h6>
                            <div class="input-group mb-2">
                                <input type="text" class="form-control" id="customQuestionInput" placeholder="输入您自己的研究方向...">
                                <div class="input-group-append">
                                    <button class="btn btn-outline-secondary" type="button" id="addCustomQuestionBtn">
                                        <i class="fas fa-plus"></i> 添加
                                    </button>
                                </div>
                            </div>
                            <div id="customQuestionsList"></div>
                        </div>
                        <div class="alert alert-info">
                            <i class="fas fa-lightbulb me-2"></i>
                            您可以取消勾选不相关的问题，或者直接使用所有问题来指导研究方向。
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">
                            取消
                        </button>
                        <button type="button" class="btn btn-primary" onclick="confirmQuestionsAndCreateResearch()">
                            <i class="fas fa-rocket mr-2"></i>
                            开始研究
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 移除已存在的模态框
    $('#questionsModal').remove();

    // 添加新的模态框到页面
    $('body').append(modalContent);

    // 显示模态框
    $('#questionsModal').modal('show');

    // 初始化模态框功能
    initQuestionsModalEvents();
}

// 初始化问题模态框事件
function initQuestionsModalEvents() {
    // 全选/全不选功能
    $('#selectAll').off('change').on('change', function () {
        const isChecked = $(this).is(':checked');
        $('#questionsModal .questions-container input[type="checkbox"]:not(#selectAll), #customQuestionsList input[type="checkbox"]').prop('checked', isChecked);
    });

    // 监听单个问题选择变化，更新全选状态
    $('#questionsModal .questions-container').off('change', 'input[type="checkbox"]:not(#selectAll)').on('change', 'input[type="checkbox"]:not(#selectAll)', function () {
        const totalQuestions = $('#questionsModal .questions-container input[type="checkbox"]:not(#selectAll)').length;
        const checkedQuestions = $('#questionsModal .questions-container input[type="checkbox"]:not(#selectAll):checked').length;

        if (checkedQuestions === totalQuestions) {
            $('#selectAll').prop('checked', true).prop('indeterminate', false);
        } else if (checkedQuestions === 0) {
            $('#selectAll').prop('checked', false).prop('indeterminate', false);
        } else {
            $('#selectAll').prop('indeterminate', true);
        }
    });

    // 添加自定义问题
    $('#addCustomQuestionBtn').off('click').on('click', function () {
        addCustomQuestion();
    });

    // 回车键添加自定义问题
    $('#customQuestionInput').off('keypress').on('keypress', function (e) {
        if (e.which === 13) {
            e.preventDefault();
            addCustomQuestion();
        }
    });
}

// 添加自定义问题
function addCustomQuestion() {
    const customQuestion = $('#customQuestionInput').val().trim();
    if (!customQuestion) {
        safeAlert('请输入研究方向内容', 'warning');
        return;
    }

    // 检查是否重复
    const existingQuestions = [];
    $('#questionsModal .form-check-input:not(#selectAll)').each(function () {
        existingQuestions.push($(this).val());
    });

    if (existingQuestions.includes(customQuestion)) {
        safeAlert('该研究方向已存在', 'warning');
        return;
    }

    // 生成唯一ID
    const questionId = 'customQuestion' + Date.now();

    // 创建新的问题HTML
    const customQuestionHtml = `
        <div class="form-check mb-2 custom-question-item">
            <input class="form-check-input" type="checkbox" value="${escapeHtml(customQuestion)}" 
                   id="${questionId}" checked>
            <label class="form-check-label" for="${questionId}">
                ${escapeHtml(customQuestion)}
            </label>
            <button type="button" class="btn btn-sm btn-outline-danger ml-2 remove-custom-btn" 
                    onclick="removeCustomQuestion('${questionId}')">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    // 添加到自定义问题列表
    $('#customQuestionsList').append(customQuestionHtml);

    // 为新添加的自定义问题绑定change事件
    $(`#${questionId}`).on('change', function () {
        updateSelectAllStatus();
    });

    // 清空输入框
    $('#customQuestionInput').val('');

    // 更新全选状态
    updateSelectAllStatus();

    safeAlert('研究方向添加成功', 'success');
}

// 移除自定义问题
function removeCustomQuestion(questionId) {
    $(`#${questionId}`).closest('.custom-question-item').remove();
    updateSelectAllStatus();
}

// 更新全选状态
function updateSelectAllStatus() {
    const totalQuestions = $('#questionsModal .questions-container input[type="checkbox"]:not(#selectAll), #customQuestionsList input[type="checkbox"]').length;
    const checkedQuestions = $('#questionsModal .questions-container input[type="checkbox"]:not(#selectAll):checked, #customQuestionsList input[type="checkbox"]:checked').length;

    if (checkedQuestions === totalQuestions && totalQuestions > 0) {
        $('#selectAll').prop('checked', true).prop('indeterminate', false);
    } else if (checkedQuestions === 0) {
        $('#selectAll').prop('checked', false).prop('indeterminate', false);
    } else {
        $('#selectAll').prop('indeterminate', true);
    }
}

// 确认问题并创建研究
function confirmQuestionsAndCreateResearch() {
    // 获取选中的问题（包括AI生成的和自定义的）
    const selectedQuestions = [];
    $('#questionsModal .form-check-input:checked:not(#selectAll), #customQuestionsList .form-check-input:checked').each(function () {
        if ($(this).val()) {
            selectedQuestions.push($(this).val());
        }
    });

    if (selectedQuestions.length === 0) {
        safeAlert('请至少选择一个研究方向', 'warning');
        return;
    }

    // 关闭模态框
    $('#questionsModal').modal('hide');

    // 继续创建研究流程
    proceedWithResearchCreation(currentResearchTitle, selectedQuestions);
}

// 继续创建研究流程
function proceedWithResearchCreation(title, selectedQuestions) {


    // 创建临时研究项目对象
    const tempResearch = {
        chatId: deepResearchChatId,
        deepTitle: title,
        deepDesc: JSON.stringify(selectedQuestions),
        process: "0",
        createTime: new Date().toISOString()
    };

    // 使用统一的HTML创建函数
    let newItemHtml;
    if (typeof createResearchItemHtml === 'function') {
        newItemHtml = createResearchItemHtml(tempResearch);
    } else {
        // 后备方案：手动创建HTML
        newItemHtml = `
            <div class="research-item processing" data-id="${deepResearchChatId}">
                <div class="research-item-header">
                    <h6>${escapeHtml(title)}</h6>
                    <span class="research-date">${new Date().toLocaleDateString()}</span>
                </div>
                <div class="research-item-summary">
                    ${selectedQuestions.length > 0 ?
                `包含${selectedQuestions.length}个研究问题，正在开始研究` :
                '基础研究项目，正在开始研究'
            }
                </div>
                <div class="research-item-progress">
                    <div class="research-progress-bar">
                        <div class="research-progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="research-progress-text">进度: 0%</div>
                </div>
                <div class="research-item-tags">
                    <span class="badge badge-secondary">待开始</span>
                </div>
                <div class="research-item-actions">
                    <button class="btn btn-sm btn-outline-danger delete-btn" title="删除">
                        <i class="far fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // 移除空状态占位符（如果存在）
    $('.empty-placeholder, .error-placeholder').remove();
    
    // 添加到列表顶部
    $('#researchList').prepend(newItemHtml);

    // 通知后端开始处理研究
    notifyBackendStartResearch(deepResearchChatId, title, selectedQuestions);

    // 显示成功消息
    const questionCount = selectedQuestions.length;
    const message = questionCount > 0 ?
        `已创建研究项目"${title}"，包含${questionCount}个关键问题` :
        `已创建研究项目"${title}"`;
    safeAlert(message, 'success');

    // 注意：不再立即选中研究项目，等待后台任务创建完成的TaskCreated事件后再选中
    console.log('研究项目已添加到列表，等待后台任务创建完成后自动选中');
}



// 安全调用函数 - 防止因framework.js未加载导致的错误

function safeAddActivityItem(title, description, iconClass, status) {
    if (typeof addActivityItem === 'function') {
        addActivityItem(title, description, iconClass, status);
    } else {
        // 如果framework.js的addActivityItem不可用，自己实现
        // 第一次添加活动时移除占位符
        $('.activity-placeholder').remove();

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
}

function safeUpdateActivityItem(title, description, status) {
    if (typeof updateActivityItem === 'function') {
        updateActivityItem(title, description, status);
    } else {
        console.log('Activity Update:', title, '-', description);
    }
}

function safeSelectResearch(researchId) {
    if (typeof selectResearch === 'function') {
        selectResearch(researchId);
    } else {
        // 手动实现选择逻辑
        $('.research-item').removeClass('active');
        $(`.research-item[data-id="${researchId}"]`).addClass('active');
        window.currentResearchId = researchId;
    }
}

function safeAlert(message, type, modal = false, duration = null) {
    if (typeof balert === 'function') {
        balert(message, type, modal, duration);
    } else {
        alert(message);
    }
}

function safeShowConfirmationModal(title, message, confirmCallback, fallbackCallback) {
    if (typeof showConfirmationModal === 'function') {
        showConfirmationModal(title, message, confirmCallback);
    } else {
        // 使用原生确认对话框作为后备
        if (confirm(title + '\n\n' + message)) {
            if (confirmCallback) confirmCallback();
        } else {
            if (fallbackCallback) fallbackCallback();
        }
    }
}

// HTML转义函数
function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 显示加载状态
function showLoadingState(message) {
    console.log('Loading:', message);
}

// 隐藏加载状态
function hideLoadingState() {
    console.log('Loading completed');
}

// 通知后端开始处理研究
function notifyBackendStartResearch(researchId, title, selectedQuestions) {
    // 确保数据完整性
    var data = {
        chatId: researchId,
        title: title,
        selectedQuestions: selectedQuestions,
        model: window.currentModel
        // searchEngine: window.currentSearchEngine
    };

    // 确保连接可用后通过SignalR通知后端开始处理研究
    ensureConnection().then(() => {
        deepResearchConnection.invoke("StartResearch", data)
            .catch(function (err) {
                safeAlert('开始研究失败: ' + (err.message || err), 'danger');
            });
    }).catch((err) => {
        console.error('确保连接失败:', err);
        safeAlert('连接服务器失败，无法开始研究，请刷新页面重试', 'danger');
    });
}

// 页面加载完成后初始化SignalR连接
$(document).ready(function () {
    initDeepResearchSignalR();
    
    // 启动连接状态监控
    startConnectionMonitoring();
});

// 连接状态监控
function startConnectionMonitoring() {
    // 每30秒检查一次连接状态
    setInterval(() => {
        if (deepResearchConnection) {
            const state = deepResearchConnection.state;
            console.log('SignalR连接状态:', state);
            
            // 如果连接断开且不在重连中，尝试重连
            if (state === signalR.HubConnectionState.Disconnected) {
                console.log('检测到连接断开，尝试重连...');
                attemptManualReconnect();
            }
        }
    }, 30000); // 30秒检查一次
}

// 页面可见性变化时的处理
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && deepResearchConnection) {
        // 页面重新可见时检查连接状态
        const state = deepResearchConnection.state;
        if (state === signalR.HubConnectionState.Disconnected) {
            console.log('页面重新可见，检测到连接断开，尝试重连...');
            attemptManualReconnect();
        }
    }
});

// 导出函数和变量供其他脚本使用
window.createNewResearchWithAPI = createNewResearchWithAPI;
window.confirmQuestionsAndCreateResearch = confirmQuestionsAndCreateResearch;
window.removeCustomQuestion = removeCustomQuestion;
window.initDeepResearchSignalR = initDeepResearchSignalR;
window.hasRunningTasks = hasRunningTasks;
window.attemptManualReconnect = attemptManualReconnect;
window.checkConnectionStatus = checkConnectionStatus;
window.ensureConnection = ensureConnection;

// 导出SignalR连接对象和相关变量
window.deepResearchConnection = deepResearchConnection;
window.deepResearchChatId = deepResearchChatId;

// 确保在连接建立后更新window对象中的连接
function updateWindowConnection() {
    window.deepResearchConnection = deepResearchConnection;
    window.deepResearchChatId = deepResearchChatId;
}
