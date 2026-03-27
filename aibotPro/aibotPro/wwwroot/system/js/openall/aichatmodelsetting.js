// 全局变量
var modelGroups = {};
var currentActiveTab = 'all';

$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#aisystem-main-menu").addClass('active');
    $("#aisystem-main-menu").parent().toggleClass('show');
    $("#aisystem-main-menu").parent().siblings().removeClass('show');
    $("#aichatmodel_aisystem_nav").addClass('active');
    getChatSetting();
    // 页面加载完成后初始化功能
    setTimeout(function () {
        initGroupTabs();
        initSortable();
        initSearch();
    }, 500);
});

function whatMyChatSetting() {
    var content = `<p>此处设置可自定义对话模型,如图所示位置：</p>
                   <p><img src="/system/images/chatsetting1.png" style="width:100%" /></p>`;
    showConfirmationModal("说明", content);
}

// 初始化分组Tab
function initGroupTabs() {
    // 绑定Tab切换事件
    $('#groupTabs').on('click', '.nav-link', function(e) {
        e.preventDefault();
        var target = $(this).data('bs-target');
        currentActiveTab = target.replace('#', '').replace('-content', '');
        switchTab(currentActiveTab);
    });
    
    // 绑定滚动按钮事件
    $('#tabNavPrev').on('click', function() {
        scrollTabs('prev');
    });
    
    $('#tabNavNext').on('click', function() {
        scrollTabs('next');
    });
    
    // 初始化滚动状态
    updateScrollButtons();
}

// 切换Tab
function switchTab(tabName) {
    // 更新Tab激活状态
    $('#groupTabs .nav-link').removeClass('active');
    $('#groupTabs .nav-link[data-bs-target="#' + tabName + '-content"]').addClass('active');
    
    // 更新内容区域激活状态
    $('.tab-pane').removeClass('show active');
    $('#' + tabName + '-content').addClass('show active');
    
    currentActiveTab = tabName;
}


// Tab滚动功能
function scrollTabs(direction) {
    var container = $('.tabs-scroll-container');
    var tabs = $('#groupTabs');
    var containerWidth = container.width();
    var tabsWidth = tabs[0].scrollWidth;
    var currentTransform = tabs.css('transform');
    var currentX = 0;
    
    if (currentTransform !== 'none') {
        var matrix = currentTransform.match(/matrix\((.+)\)/);
        if (matrix) {
            currentX = parseFloat(matrix[1].split(',')[4]) || 0;
        }
    }
    
    var scrollDistance = containerWidth * 0.7; // 每次滚动70%的容器宽度
    var newX = currentX;
    
    if (direction === 'prev') {
        newX = Math.min(currentX + scrollDistance, 0);
    } else {
        var maxScroll = containerWidth - tabsWidth;
        newX = Math.max(currentX - scrollDistance, maxScroll);
    }
    
    tabs.css('transform', 'translateX(' + newX + 'px)');
    updateScrollButtons();
}

// 更新滚动按钮状态
function updateScrollButtons() {
    var container = $('.tabs-scroll-container');
    var tabs = $('#groupTabs');
    var containerWidth = container.width();
    var tabsWidth = tabs[0].scrollWidth;
    
    if (tabsWidth <= containerWidth) {
        // 不需要滚动
        $('#tabNavPrev, #tabNavNext').prop('disabled', true);
        return;
    }
    
    var currentTransform = tabs.css('transform');
    var currentX = 0;
    
    if (currentTransform !== 'none') {
        var matrix = currentTransform.match(/matrix\((.+)\)/);
        if (matrix) {
            currentX = parseFloat(matrix[1].split(',')[4]) || 0;
        }
    }
    
    // 更新按钮状态
    $('#tabNavPrev').prop('disabled', currentX >= 0);
    $('#tabNavNext').prop('disabled', currentX <= containerWidth - tabsWidth);
}

// 创建分组Tab
function createGroupTab(groupName, count) {
    // 生成安全的tabId，移除HTML标签和特殊字符
    var tabId = groupName === '' ? 'ungrouped' : groupName.replace(/<[^>]*>/g, '').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
    var displayName = groupName === '' ? '<i class="fas fa-inbox"></i> 未分组' : groupName;
    
    // 创建Tab导航
    var tabNav = `
        <li class="nav-item" role="presentation">
            <button class="nav-link" id="${tabId}-tab" data-bs-toggle="tab" data-bs-target="#${tabId}-content" 
                    type="button" role="tab" aria-controls="${tabId}-content" aria-selected="false">
                ${displayName} <span class="badge badge-secondary ms-1" id="${tabId}-count">${count}</span>
            </button>
        </li>`;
    
    // 创建Tab内容
    var tabContent = `
        <div class="tab-pane fade" id="${tabId}-content" role="tabpanel" aria-labelledby="${tabId}-tab">
            <div class="model-cards" data-group="${groupName}">
                <!-- 该分组的模型卡片 -->
            </div>
            <div class="add-model-card" onclick="addStLineFromFloat()">
                <div class="add-model-text">
                    <span><i class="fas fa-plus"></i> 新增模型配置</span>
                </div>
            </div>
        </div>`;
    
    // 插入到DOM
    $('#groupTabs').append(tabNav);
    $('#groupTabContent').append(tabContent);
    
    return tabId;
}

// 更新分组统计
function updateGroupCounts() {
    var groupCounts = {};
    var totalCount = 0;

    // 只统计主容器中的模型数量，避免重复计算分组Tab中的克隆卡片
    $('#model-cards-container .model-card').each(function() {
        var groupInput = $(this).find('input').eq(6); // 分组输入框
        var group = groupInput.val() || '';
        groupCounts[group] = (groupCounts[group] || 0) + 1;
        totalCount++;
    });

    // 更新全部Tab计数
    $('#all-count').text(totalCount);

    // 更新各分组Tab计数
    Object.keys(groupCounts).forEach(function(groupName) {
        var tabId = groupName === '' ? 'ungrouped' : groupName.replace(/<[^>]*>/g, '').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
        $('#' + tabId + '-count').text(groupCounts[groupName]);
    });
}

// 重新组织分组Tab
function reorganizeGroupTabs() {
    var groups = {};

    // 收集当前分组信息
    $('#model-cards-container .model-card').each(function() {
        var groupInput = $(this).find('input').eq(6);
        var group = groupInput.val() || '';
        if (!groups[group]) {
            groups[group] = [];
        }
        groups[group].push($(this).clone(true));
    });

    // 更新现有分组Tab的内容，而不是重建整个Tab
    $('.tab-pane:not(#all-content)').each(function() {
        var tabContent = $(this);
        var groupName = tabContent.find('.model-cards').attr('data-group') || '';

        // 清空当前Tab的内容
        tabContent.find('.model-cards').empty();

        // 如果该分组还有模型，重新填充
        if (groups[groupName] && groups[groupName].length > 0) {
            groups[groupName].forEach(function(card) {
                tabContent.find('.model-cards').append(card);
            });
        }
    });

    // 检查是否有新的分组需要创建Tab
    Object.keys(groups).forEach(function(groupName) {
        if (groupName !== '') {
            var tabId = groupName.replace(/<[^>]*>/g, '').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');

            // 如果该分组的Tab不存在，创建新Tab
            if ($('#' + tabId + '-content').length === 0) {
                createGroupTab(groupName, groups[groupName].length);
                groups[groupName].forEach(function(card) {
                    $('#' + tabId + '-content .model-cards').append(card);
                });
            }
        }
    });

    // 处理未分组模型
    if (groups[''] && groups[''].length > 0) {
        if ($('#ungrouped-content').length === 0) {
            createGroupTab('', groups[''].length);
        }
        $('#ungrouped-content .model-cards').empty();
        groups[''].forEach(function(card) {
            $('#ungrouped-content .model-cards').append(card);
        });
    }

    // 移除空的分组Tab
    $('.tab-pane:not(#all-content)').each(function() {
        var tabContent = $(this);
        var groupName = tabContent.find('.model-cards').attr('data-group') || '';

        if (!groups[groupName] || groups[groupName].length === 0) {
            var tabId = tabContent.attr('id').replace('-content', '');
            // 如果是当前激活的Tab，切换到全部Tab
            if (currentActiveTab === tabId) {
                switchTab('all');
            }
            // 移除Tab导航和内容
            $('#' + tabId + '-tab').closest('.nav-item').remove();
            tabContent.remove();
        }
    });

    updateGroupCounts();
    updateScrollButtons();
}

function addStLine(defaultGroup) {
    var cardIndex = $('#model-cards-container .model-card').length + 1;
    defaultGroup = defaultGroup || '';
    var str = `<div class="model-card" data-index="${cardIndex}">
                 <div class="card-header-custom">
                     <div class="drag-handle" title="拖拽排序"><i data-feather="align-justify"></i></div>
                     <h5 class="card-title">新模型配置 <span class="model-badge seq-badge">${cardIndex}</span></h5>
                     <div class="card-actions">
                         <span class="add-btn" onclick="addStLineAfter(this)" title="在下方新增"><i class="fas fa-plus"></i></span>
                         <span class="delete-btn" onclick="delLine(this)" title="删除"><i class="fas fa-trash"></i></span>
                     </div>
                 </div>
                 <div class="form-row-custom">
                     <div class="form-group-custom">
                         <label>模型昵称</label>
                         <input type="text" class="form-control" placeholder="请输入模型昵称" value="" />
                     </div>
                     <div class="form-group-custom">
                         <label>模型名称</label>
                         <input type="text" class="form-control" placeholder="实际请求时使用的模型名称" value="" />
                     </div>
                 </div>
                 <div class="form-row-custom">
                     <div class="form-group-custom">
                         <label>Base URL</label>
                         <input type="text" class="form-control" placeholder="API端点地址" value="" />
                     </div>
                     <div class="form-group-custom">
                         <label>API KEY</label>
                         <input type="text" class="form-control" placeholder="API密钥" value="" />
                     </div>
                 </div>
                 <div class="form-row-custom">
                     <div class="form-group-custom">
                         <label>模型配置</label>
                         <div class="checkbox-group">
                             <input type="checkbox" id="vision-${cardIndex}"> <label for="vision-${cardIndex}">视觉模型</label>
                             <input type="checkbox" id="responses-${cardIndex}"> <label for="responses-${cardIndex}">Responses</label>
                         </div>
                     </div>
                     <div class="form-group-custom">
                         <label>分组</label>
                         <input type="text" class="form-control" placeholder="模型分组" value="${defaultGroup}" onchange="onGroupChange(this)" />
                     </div>
                 </div>
                 <div class="form-row-custom">
                     <div class="form-group-custom">
                         <label>排序</label>
                         <input type="number" class="form-control seq-input" placeholder="排序" value="${cardIndex}" />
                     </div>
                     <div class="form-group-custom">
                         <label>流延时(ms)</label>
                         <input type="number" class="form-control" placeholder="流式响应延时" value="0" />
                     </div>
                 </div>
                 <div class="form-row-custom">
                     <div class="form-group-custom">
                         <label>最低使用余额</label>
                         <input type="text" class="form-control" placeholder="最低使用余额" value="" />
                     </div>
                     <div class="form-group-custom">
                         <label>预设系统提示词</label>
                         <input type="text" class="form-control" placeholder="系统提示词" value="" />
                     </div>
                 </div>
                 <div class="form-group-custom">
                     <label>模型说明</label>
                     <input type="text" class="form-control" placeholder="模型功能说明" value="" />
                 </div>
             </div>`
             
    // 添加到全部Tab
    $('#model-cards-container').append(str);
    
    updateSeqNumbers();
    updateGroupCounts();
    reorganizeGroupTabs();
    feather.replace();
    
    // 重新初始化功能
    setTimeout(function() {
        initSortable();
        initSearch();
        updateScrollButtons();
    }, 100);
}

// 分组输入框变化事件
function onGroupChange(element) {
    setTimeout(function() {
        reorganizeGroupTabs();
        initSortable();
    }, 100);
}

// 浮动按钮新增模型
function addStLineFromFloat() {
    var defaultGroup = '';
    
    // 根据当前激活的Tab确定默认分组
    if (currentActiveTab !== 'all') {
        // 找到当前激活Tab对应的分组名称
        var activeTabContent = $('#' + currentActiveTab + '-content');
        if (activeTabContent.length > 0) {
            var groupName = activeTabContent.find('.model-cards').attr('data-group');
            if (groupName !== undefined) {
                defaultGroup = groupName;
            }
        }
    }
    
    addStLine(defaultGroup);
}

// 在指定卡片后新增模型
function addStLineAfter(element) {
    var currentCard = $(element).closest('.model-card');
    var currentInputs = currentCard.find('input');
    var currentGroup = currentInputs.eq(6).val() || ''; // 获取当前卡片的分组
    
    // 获取新卡片的索引（主容器卡片总数+1）
    var cardIndex = $('#model-cards-container .model-card').length + 1;
    
    // 创建新卡片HTML
    var newCardHtml = `<div class="model-card" data-index="${cardIndex}">
                 <div class="card-header-custom">
                     <div class="drag-handle" title="拖拽排序"><i data-feather="align-justify"></i></div>
                     <h5 class="card-title">新模型配置 <span class="model-badge seq-badge">${cardIndex}</span></h5>
                     <div class="card-actions">
                         <span class="add-btn" onclick="addStLineAfter(this)" title="在下方新增"><i class="fas fa-plus"></i></span>
                         <span class="delete-btn" onclick="delLine(this)" title="删除"><i class="fas fa-trash"></i></span>
                     </div>
                 </div>
                 <div class="form-row-custom">
                     <div class="form-group-custom">
                         <label>模型昵称</label>
                         <input type="text" class="form-control" placeholder="请输入模型昵称" value="" />
                     </div>
                     <div class="form-group-custom">
                         <label>模型名称</label>
                         <input type="text" class="form-control" placeholder="实际请求时使用的模型名称" value="" />
                     </div>
                 </div>
                 <div class="form-row-custom">
                     <div class="form-group-custom">
                         <label>Base URL</label>
                         <input type="text" class="form-control" placeholder="API端点地址" value="" />
                     </div>
                     <div class="form-group-custom">
                         <label>API KEY</label>
                         <input type="text" class="form-control" placeholder="API密钥" value="" />
                     </div>
                 </div>
                 <div class="form-row-custom">
                     <div class="form-group-custom">
                         <label>模型配置</label>
                         <div class="checkbox-group">
                             <input type="checkbox" id="vision-${cardIndex}"> <label for="vision-${cardIndex}">视觉模型</label>
                             <input type="checkbox" id="responses-${cardIndex}"> <label for="responses-${cardIndex}">Responses</label>
                         </div>
                     </div>
                     <div class="form-group-custom">
                         <label>分组</label>
                         <input type="text" class="form-control" placeholder="模型分组" value="${currentGroup}" onchange="onGroupChange(this)" />
                     </div>
                 </div>
                 <div class="form-row-custom">
                     <div class="form-group-custom">
                         <label>排序</label>
                         <input type="number" class="form-control seq-input" placeholder="排序" value="${cardIndex}" />
                     </div>
                     <div class="form-group-custom">
                         <label>流延时(ms)</label>
                         <input type="number" class="form-control" placeholder="流式响应延时" value="0" />
                     </div>
                 </div>
                 <div class="form-row-custom">
                     <div class="form-group-custom">
                         <label>最低使用余额</label>
                         <input type="text" class="form-control" placeholder="最低使用余额" value="" />
                     </div>
                     <div class="form-group-custom">
                         <label>预设系统提示词</label>
                         <input type="text" class="form-control" placeholder="系统提示词" value="" />
                     </div>
                 </div>
                 <div class="form-group-custom">
                     <label>模型说明</label>
                     <input type="text" class="form-control" placeholder="模型功能说明" value="" />
                 </div>
             </div>`;
    
    // 判断是否在分组Tab中操作
    if (currentCard.closest('#all-content').length === 0) {
        // 在分组Tab中，需要找到主容器中对应的卡片位置插入
        var currentIndex = currentCard.attr('data-index');
        var targetCard = $('#model-cards-container .model-card[data-index="' + currentIndex + '"]');
        if (targetCard.length > 0) {
            targetCard.after(newCardHtml);
        } else {
            // 如果找不到对应卡片，就添加到主容器末尾
            $('#model-cards-container').append(newCardHtml);
        }
    } else {
        // 在主容器中，直接在当前卡片后插入
        currentCard.after(newCardHtml);
    }

    // 重新初始化图标
    feather.replace();

    // 更新所有相关状态
    updateSeqNumbers();
    updateGroupCounts();
    reorganizeGroupTabs();
    
    // 重新初始化功能
    setTimeout(function() {
        initSortable();
        initSearch();
        updateScrollButtons();
    }, 100);
    
    // 滚动到新添加的卡片并高亮
    var newCard = currentCard.next('.model-card');
    if (newCard.length > 0) {
        newCard[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        // 高亮显示新卡片
        newCard.addClass('highlight-new');
        setTimeout(function() {
            newCard.removeClass('highlight-new');
        }, 3000);
    }
}

function delLine(element) {
    var cardToDelete = $(element).closest('.model-card');
    var cardIndex = cardToDelete.attr('data-index');

    // 如果在分组Tab中，需要删除主容器中对应的卡片
    if (cardToDelete.closest('#all-content').length === 0) {
        // 在分组Tab中，根据data-index删除主容器中的对应卡片
        $('#model-cards-container .model-card[data-index="' + cardIndex + '"]').remove();
    } else {
        // 在主容器中，直接删除
        cardToDelete.remove();
    }

    updateSeqNumbers();
    updateGroupCounts();
    reorganizeGroupTabs();
}

function updateSeqNumbers() {
    // 只更新主容器中的模型卡片序号，避免修改分组Tab中的克隆卡片
    $('#model-cards-container .model-card').each(function (index) {
        $(this).attr('data-index', index + 1);
        $(this).find('.seq-input').val(index + 1);
        $(this).find('.seq-badge').text(index + 1);
        var title = $(this).find('.card-title');
        var titleText = title.text().replace(/\d+$/, '') + (index + 1);
        if (!title.text().match(/\d+$/)) {
            titleText = title.text().split(' ')[0] + ' ' + (index + 1);
        }
        title.html(titleText.split(' ').slice(0, -1).join(' ') + ' <span class="model-badge seq-badge">' + (index + 1) + '</span>');
    });
}

// 同步当前激活分组Tab的数据到主容器
function syncAllTabsData() {
    // 如果当前在【全部】tab，不需要同步
    if (currentActiveTab === 'all') {
        return;
    }

    // 只同步当前激活的分组Tab的数据
    var activeTabContent = $('#' + currentActiveTab + '-content');
    if (activeTabContent.length > 0) {
        var groupName = activeTabContent.find('.model-cards').attr('data-group') || '';

        // 遍历该分组Tab中的所有模型卡片
        activeTabContent.find('.model-card').each(function() {
            var groupCard = $(this);
            var cardIndex = groupCard.attr('data-index');

            // 找到主容器中对应的卡片（通过data-index匹配）
            var mainCard = $("#model-cards-container .model-card[data-index='" + cardIndex + "']");

            if (mainCard.length > 0) {
                // 同步所有输入框的值
                var groupInputs = groupCard.find('input');
                var mainInputs = mainCard.find('input');

                groupInputs.each(function(index) {
                    var groupInput = $(this);
                    var mainInput = mainInputs.eq(index);

                    if (groupInput.attr('type') === 'checkbox') {
                        // 同步复选框状态
                        mainInput.prop('checked', groupInput.prop('checked'));
                    } else {
                        // 同步普通输入框值
                        mainInput.val(groupInput.val());
                    }
                });
            }
        });
    }
}

function initSortable() {
    // 销毁之前的sortable实例(如果存在)
    if ($("#model-cards-container").hasClass('ui-sortable')) {
        $("#model-cards-container").sortable('destroy');
    }

    $("#model-cards-container").sortable({
        items: '.model-card',
        handle: '.drag-handle',
        placeholder: 'drag-placeholder',
        forcePlaceholderSize: true,
        start: function (event, ui) {
            ui.item.addClass('dragging');
        },
        stop: function (event, ui) {
            ui.item.removeClass('dragging');
        },
        update: function (event, ui) {
            updateSeqNumbers();
        }
    }).disableSelection();
}

function saveChatSetting() {
    // 只在非搜索状态且当前不在【全部】tab时才同步分组Tab数据
    var isSearching = $('#modelSearch').val().trim() !== '';
    if (!isSearching && currentActiveTab !== 'all') {
        syncAllTabsData();
    }

    var aiModels = [];
    // 从全部Tab收集所有模型卡片（避免重复）
    var cards = $("#model-cards-container .model-card");
    var issave = true;
    cards.each(function (index, card) {
        var inputs = $(card).find("input");
        var nickname = inputs.eq(0).val();
        var name = inputs.eq(1).val();
        var baseUrl = inputs.eq(2).val();
        var apiKey = inputs.eq(3).val();
        var visionModel = inputs.eq(4).prop('checked');
        var responses = inputs.eq(5).prop('checked');
        var group = inputs.eq(6).val();
        var seq = inputs.eq(7).val();
        var delay = inputs.eq(8).val() < 0 ? 0 : inputs.eq(8).val();
        var minimumBalance = inputs.eq(9).val();
        var adminPrompt = inputs.eq(10).val();
        var modelInfo = inputs.eq(11).val();

        if (!removeSpaces(nickname) || !removeSpaces(name) || !removeSpaces(baseUrl) || !removeSpaces(apiKey)) {
            balert('请将空的【自定义对话模型】输入删除，或填写完整', 'danger', false, 1500, 'top');
            issave = false;
            return;
        } else {
            aiModels.push({
                ModelNick: nickname,
                ModelName: name,
                BaseURL: baseUrl,
                ApiKey: apiKey,
                VisionModel: visionModel,
                Responses: responses,
                ModelGroup: group,
                Seq: seq,
                Delay: delay,
                MinimumBalance: minimumBalance,
                ModelInfo: modelInfo,
                AdminPrompt: adminPrompt
            });
        }
    });
    if (issave) {
        loadingBtn('.save');
        $.ajax({
            type: 'POST',
            url: '/OpenAll/SaveAiChatSetting',
            dataType: 'json',
            data: {
                aImodel: JSON.stringify(aiModels)
            },
            success: function (res) {
                unloadingBtn('.save');
                if (res.success) {
                    balert(res.msg, 'success', false, 1500, 'top');
                } else {
                    balert(res.msg, 'danger', false, 1500, 'top');
                }
            },
            error: function (error) {
                unloadingBtn('.save');
                sendExceptionMsg(error);
                balert('保存失败，请稍后再试', 'danger', false, 1500, 'top');
            }
        });
    }
}

function getChatSetting() {
    $.ajax({
        type: 'Post',
        url: '/OpenAll/GetChatSetting',
        success: function (res) {
            if (res.success) {
                var data = res.data;
                if (data == null)
                    return;
                for (var i = 0; i < data.length; i++) {
                    var checkedAttr = data[i].visionModel ? 'checked' : '';
                    var responsesAttr = data[i].responses ? 'checked' : '';
                    var cardIndex = i + 1;
                    var str = `<div class="model-card" data-index="${cardIndex}">
                                 <div class="card-header-custom">
                                     <div class="drag-handle" title="拖拽排序"><i data-feather="align-justify"></i></div>
                                     <h5 class="card-title">${data[i].modelNick || '模型配置'} <span class="model-badge seq-badge">${cardIndex}</span></h5>
                                     <div class="card-actions">
                                         <span class="add-btn" onclick="addStLineAfter(this)" title="在下方新增"><i class="fas fa-plus"></i></span>
                                         <span class="delete-btn" onclick="delLine(this)" title="删除"><i class="fas fa-trash"></i></span>
                                     </div>
                                 </div>
                                 <div class="form-row-custom">
                                     <div class="form-group-custom">
                                         <label>模型昵称</label>
                                         <input type="text" class="form-control" placeholder="请输入模型昵称" value="${data[i].modelNick || ''}" />
                                     </div>
                                     <div class="form-group-custom">
                                         <label>模型名称</label>
                                         <input type="text" class="form-control" placeholder="实际请求时使用的模型名称" value="${data[i].modelName || ''}" />
                                     </div>
                                 </div>
                                 <div class="form-row-custom">
                                     <div class="form-group-custom">
                                         <label>Base URL</label>
                                         <input type="text" class="form-control" placeholder="API端点地址" value="${data[i].baseUrl || ''}" />
                                     </div>
                                     <div class="form-group-custom">
                                         <label>API KEY</label>
                                         <input type="text" class="form-control" placeholder="API密钥" value="${data[i].apiKey || ''}" />
                                     </div>
                                 </div>
                                 <div class="form-row-custom">
                                     <div class="form-group-custom">
                                         <label>模型配置</label>
                                         <div class="checkbox-group">
                                             <input type="checkbox" id="vision-${cardIndex}" ${checkedAttr}> <label for="vision-${cardIndex}">视觉模型</label>
                                             <input type="checkbox" id="responses-${cardIndex}" ${responsesAttr}> <label for="responses-${cardIndex}">Responses</label>
                                         </div>
                                     </div>
                                     <div class="form-group-custom">
                                         <label>分组</label>
                                         <input type="text" class="form-control" placeholder="模型分组" value="${data[i].modelGroup || ''}" onchange="onGroupChange(this)" />
                                     </div>
                                 </div>
                                 <div class="form-row-custom">
                                     <div class="form-group-custom">
                                         <label>排序</label>
                                         <input type="number" class="form-control seq-input" placeholder="排序" value="${data[i].seq || cardIndex}" />
                                     </div>
                                     <div class="form-group-custom">
                                         <label>流延时(ms)</label>
                                         <input type="number" class="form-control" placeholder="流式响应延时" value="${data[i].delay || 0}" />
                                     </div>
                                 </div>
                                 <div class="form-row-custom">
                                     <div class="form-group-custom">
                                         <label>最低使用余额</label>
                                         <input type="text" class="form-control" placeholder="最低使用余额" value="${data[i].minimumBalance !== undefined && data[i].minimumBalance !== null ? data[i].minimumBalance : ''}" />
                                     </div>
                                     <div class="form-group-custom">
                                         <label>预设系统提示词</label>
                                         <input type="text" class="form-control" placeholder="系统提示词" value="${data[i].adminPrompt || ''}" />
                                     </div>
                                 </div>
                                 <div class="form-group-custom">
                                     <label>模型说明</label>
                                     <input type="text" class="form-control" placeholder="模型功能说明" value="${data[i].modelInfo || ''}" />
                                 </div>
                             </div>`
                    $("#model-cards-container").append(str);
                    feather.replace();
                }
                setTimeout(function () {
                    reorganizeGroupTabs();
                    initSortable();
                    initSearch();
                }, 100);
            } else {
                balert(res.msg, "danger", false, 1500, 'top');
            }
        }
    });
}


function initSearch() {
    const searchInput = $('#modelSearch');
    const clearBtn = $('#clearSearch');
    const searchStats = $('#searchStats');
    const noResults = $('#noResults');
    const addModelCard = $('.add-model-card');

    function performSearch() {
        const query = searchInput.val().toLowerCase().trim();
        let visibleCount = 0;
        
        if (query === '') {
            // 清空搜索，恢复Tab显示和正常状态
            $('#model-cards-container .model-card').removeClass('hidden');
            $('#groupTabsContainer').show();
            // 恢复到当前活跃的Tab
            switchTab(currentActiveTab);
            clearBtn.hide();
            searchStats.text('');
            noResults.hide();
            $('.add-model-card').show();
            return;
        }
        
        clearBtn.show();
        $('#groupTabsContainer').hide(); // 搜索时隐藏Tab
        $('#groupTabContent .tab-pane').removeClass('show active');
        $('#all-content').addClass('show active');
        
        // 只搜索主容器中的模型卡片
        $('#model-cards-container .model-card').each(function () {
            const card = $(this);
            const inputs = card.find('input');
            const searchContent = [
                inputs.eq(0).val() || '', // 模型昵称   
                inputs.eq(1).val() || '', // 模型名称
                inputs.eq(6).val() || '', // 分组 
                inputs.eq(11).val() || '' // 模型说明 
            ].join(' ').toLowerCase();
            
            if (searchContent.includes(query)) {
                card.removeClass('hidden');
                visibleCount++;
            } else {
                card.addClass('hidden');
            }
        });
        
        if (visibleCount > 0) {
            searchStats.text('显示 ' + visibleCount + ' 个结果');
            noResults.hide();
            $('.add-model-card').hide();
        } else {
            searchStats.text('无匹配结果');
            noResults.show();
            $('.add-model-card').hide();
        }
    }

    // 绑定搜索事件
    searchInput.on('input', performSearch);
    
    // 清除搜索按钮事件
    clearBtn.click(function () {
        searchInput.val('');
        performSearch();
        // 恢复Tab显示
        $('#groupTabsContainer').show();
        searchInput.focus();
    });
    
    // 回车键搜索
    searchInput.on('keypress', function(e) {
        if (e.which === 13) {
            performSearch();
        }
    });
    
    // 初始状态 
    clearBtn.hide();
    searchStats.text('');
    noResults.hide();
    $('#groupTabsContainer').show();
}