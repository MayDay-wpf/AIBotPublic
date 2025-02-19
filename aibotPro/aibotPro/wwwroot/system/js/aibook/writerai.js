const $chatInput = $("#chatInput");
const $sendButton = $("#sendButton");
var thisAiModel = "gpt-4o-mini"; //当前AI模型
var thisAiModelNick = `<i class='icon icon-gpt'></i> ChatGPT-4O-Mini✨🖼️`;
var processOver = true; //是否处理完毕
var image_path = [];
var file_list = [];
var chatid = "";
var chatgroupid = "";
var assistansBoxId = "";
let stream = true;
let writerModel = true;
var markdownHis = [];
var systemPrompt = "";
let modelList = [];
let currentPageSelect = 1;
let pageSizeSelect = 10;
let totalChaptersSelect = 0;
let isLoadingSelect = false;
let keywordSelect = '';
let selectChapters = [];
let currentPageSelectRole = 1;
let pageSizeSelectRole = 10;
let totalRolesSelect = 0;
let isLoadingSelectRole = false;
let keywordSelectRole = "";
let selectedRoles = [];
let roles = [];
const $closeButton = $('<button id="closeTips" class="close-button" onclick="deleteRole()">×</button>');

$(document).ready(function () {
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

    $("#chatInput").on("input", function () {
        const text = $(this).val();
        if (text.startsWith("@") && text.length === 1) {
            if (thisChapter == 0) {
                balert("请先选择章节或新建章节", "warning", false, 2000, 'center');
                return;
            }
            $(".chapter-select-container").show();
            loadSelectChapters(currentPageSelect, keywordSelect, desc);
        } else if (text.startsWith("#") && text.length === 1) {
            $(".role-select-container").show();
            loadSelectRoles(currentPageSelectRole, keywordSelectRole);
        } else {
            $(".chapter-select-container").hide();
            $(".role-select-container").hide();
        }
    });
    $('.chat-input-area').on('click', '#selectedChaptersBadge', function () {
        $(".chapter-select-container").show();
    });
    $(document.body).on('click', function (event) {
        if (!$(event.target).closest('.chapter-select-container').length && !$(event.target).is('#selectedChaptersBadge')) {
            $(".chapter-select-container").hide();
        }
    });
});
// 滚动事件监听
$("#chapterSelectList").on('scroll', function () {
    if ($("#chapterSelectList").scrollTop() + $("#chapterSelectList").height() >= $("#chapterSelectList").height() - 100 && !isLoadingSelect) {
        if (currentPageSelect * pageSizeSelect < totalChaptersSelect) {
            currentPageSelect++;
            loadSelectChapters(currentPageSelect, keywordSelect, desc);
        }
    }
});
// 滚动事件监听 for roleSelectList
$("#roleSelectList").on('scroll', function () {
    if ($("#roleSelectList").scrollTop() + $("#roleSelectList").innerHeight() >= $("#roleSelectList").prop('scrollHeight') - 100 && !isLoadingSelectRole) {
        if (currentPageSelectRole * pageSizeSelectRole < totalRolesSelect) {
            currentPageSelectRole++;
            loadSelectRoles(currentPageSelectRole, keywordSelectRole);
        }
    }
});

// 搜索功能
$('#searchSelectButton').click(function () {
    keywordSelect = $('#searchSelectInput').val();
    currentPageSelect = 1;
    $('#chapterSelectList').empty();
    loadSelectChapters(currentPageSelect, keywordSelect, desc);
});

$('#searchSelectInput').keypress(function (event) {
    if (event.keyCode == 13) {
        keywordSelect = $('#searchSelectInput').val();
        currentPageSelect = 1;
        $('#chapterSelectList').empty();
        loadSelectChapters(currentPageSelect, keywordSelect, desc);
    }
});

// Chapters
function loadSelectChapters(page, keyword, desc) {
    isLoadingSelect = true;
    if (page === 1) {
        $('#chapterSelectList').html('<i class="fas fa-spinner fa-spin"></i> 加载中...');
    } else {
        $('#chapterSelectList').append('<div class="loading-more text-center"><i class="fas fa-spinner fa-spin"></i> 加载更多...</div>');
    }

    $.ajax({
        url: '/AiBook/GetChapterList', type: 'POST', dataType: 'json', data: {
            keyword: keyword, bookCode: bookCode, page: page, pageSize: pageSizeSelect, desc: desc
        }, success: function (response) {
            if (response.success) {
                totalChaptersSelect = response.total;
                if (page === 1) {
                    $('#chapterSelectList').empty();
                } else {
                    $('#chapterSelectList .loading-more').remove();
                }

                if (response.data.length === 0 && page === 1) {
                    $('#chapterSelectList').html(`<div class="text-center"><p>没有任何章节信息<br />点击创建章节按钮开始创作吧🤗</p>
                        <img src = "/system/images/nothing.png" /></div>`);
                } else {
                    renderSeletcChapters(response.data);
                }

                isLoadingSelect = false;
            } else {
                $('#chapterSelectList').html('<div class="text-center">加载失败</div>');
                isLoadingSelect = false;
            }
        }, error: function () {
            $('#chapterSelectList').html('<div class="text-center">加载失败</div>');
            isLoadingSelect = false;
        }
    });
}

function renderSeletcChapters(chapters) {
    $.each(chapters, function (index, chapter) {
        $('#chapterSelectList').append(`
                <div class="chapter-item" id="chapterSelect-${chapter.id}" onclick="addSelectChapters(${chapter.id})">
                    <div class="chapter-content">
                        <div class="chapter-title">${chapter.chapterTitle}</div>
                        <div class="chapter-wordcount">${chapter.wordCount}字</div>
                    </div>
                    ${selectChapters.includes(chapter.id) ? '<div class="chapter-selected"><i class="fas fa-check"></i></div>' : ''}
                </div>
            `);
    });
}

function addSelectChapters(id) {
    if (selectChapters.includes(id)) {
        selectChapters = selectChapters.filter(item => item !== id);
        $('#chapterSelect-' + id + ' .chapter-selected').remove();
    } else {
        if (id == thisChapter) {
            balert("无需选择正在创作的章节", "warning", false, 1500, "center");
            return;
        }
        if (selectChapters.length >= 2) {
            balert("最多只能选择两个章节", "danger", false, 1500, "center");
            return;
        }
        selectChapters.push(id);
        $('#chapterSelect-' + id).append(`<div class="chapter-selected"><i class="fas fa-check"></i></div>`);
    }
    updateSelectedBadge();
}

function updateSelectedBadge() {
    const badge = $('#selectedChaptersBadge');
    if (selectChapters.length > 0) {
        if (badge.length) {
            badge.text(selectChapters.length);
        } else {
            // 在发送按钮旁边添加徽标
            $('#chatInput').after(`<span id="selectedChaptersBadge" class="badge badge-pill badge-primary ml-2">${selectChapters.length}</span>`);
            badge.on('click', $(".chapter-select-container").show());
        }
    } else {
        badge.remove();
    }
}

// Role
$("#roleSearchInput").on("keyup", function (event) {
    if (event.key === "Enter") {
        keywordSelectRole = $(this).val();
        currentPageSelectRole = 1;
        loadSelectRoles(currentPageSelectRole, keywordSelectRole);
    }
});
$("#roleSearchBtn").on("click", function () {
    keywordSelectRole = $("#roleSearchInput").val();
    currentPageSelectRole = 1;
    loadSelectRoles(currentPageSelectRole, keywordSelectRole);
});

function loadSelectRoles(page, keyword) {
    if (isLoadingSelectRole) return; // Prevent multiple simultaneous loads

    isLoadingSelectRole = true;
    if (page === 1) {
        $('#roleSelectList').html('<i class="fas fa-spinner fa-spin"></i> 加载中...');
    } else {
        $('#roleSelectList').append('<div class="loading-more text-center"><i class="fas fa-spinner fa-spin"></i> 加载更多...</div>');
    }

    $.ajax({
        url: '/Role/GetRoleList', type: 'POST', dataType: 'json', data: {
            name: keyword, bookCode: bookCode, page: page, pageSize: pageSizeSelectRole
        }, success: function (response) {
            if (response.success) {
                totalRolesSelect = response.total;
                if (page === 1) {
                    $('#roleSelectList').empty();
                    roles = response.data;
                } else {
                    $('#roleSelectList .loading-more').remove();
                    response.data.forEach(newRole => {
                        if (!roles.some(existingRole => existingRole.roleCode === newRole.roleCode)) {
                            roles.push(newRole);
                        }
                    });
                }

                if (response.data.length === 0 && page === 1) {
                    $('#roleSelectList').html(`<div class="text-center"><p>没有找到任何角色信息<br />请尝试其他关键词或创建新角色🤗</p>
                        <img src="/system/images/nothing.png" /></div>`);
                } else {
                    renderSelectRoles(response.data);
                }

                isLoadingSelectRole = false;
            } else {
                $('#roleSelectList').html('<div class="text-center">加载失败</div>');
                isLoadingSelectRole = false;
            }
        }, error: function () {
            $('#roleSelectList').html('<div class="text-center">加载失败</div>');
            isLoadingSelectRole = false;
        }
    });
}

// 渲染角色列表
function renderSelectRoles(roles) {
    $.each(roles, function (index, role) {
        $('#roleSelectList').append(`
            <div class="role-item" id="roleSelect-${role.roleCode}" onclick="addSelectRoles('${role.roleCode}')">
                <div class="role-content">
                    <img src="${role.roleAvatar}" alt="${role.roleName}" class="role-avatar">
                    <div class="role-details">
                        <div class="role-name">${role.roleName}</div>
                        <div class="role-info">${role.roleInfo}</div>
                    </div>
                </div>
                ${selectedRoles.includes(role.roleCode) ? '<div class="role-selected"><i class="fas fa-check"></i></div>' : ''}
            </div>
        `);
    });
}

$closeButton.click(function () {
    // 清理/重置状态 (根据你的应用逻辑)
    selectedRoles = [];
    $chatInput.val("");
    systemPrompt = "";
    loadSelectRoles(1, '');
    $closeButton.remove();//点击后，删除按钮
});

function addSelectRoles(roleCode) {
    const selectedRole = roles.find(role => role.roleCode === roleCode);

    if (!selectedRoles.includes(roleCode)) {
        selectedRoles.push(roleCode);
        //$chatInput.val("#" + roleCode + " " + $chatInput.val().substring(1));

        $(`#roleSelect-${roleCode}`).addClass("selected").append('<div class="role-selected"><i class="fas fa-check"></i></div>');

        if (selectedRole) {
            systemPrompt = selectedRole.roleSystemPrompt;
            $('#Tips').html(`<img src="${selectedRole.roleAvatar}" alt="${selectedRole.roleName}" class="role-avatar-tip"> ${selectedRole.roleName}`).append($closeButton);
        }

    } else {
        selectedRoles = selectedRoles.filter(item => item !== roleCode);
        $chatInput.val($chatInput.val().replace("#" + roleCode + " ", ""));
        $(`#roleSelect-${roleCode}`).removeClass("selected");
        $(`#roleSelect-${roleCode} .role-selected`).remove();

        if (selectedRoles.length === 0) {
            systemPrompt = "";
            $('#Tips').html(`
                    <i data-feather="info"></i> 我是您的创作助手，您可以选中右侧内容与我进行针对性交流👉
                    <br />
                    如果您没有现存的文章，您依旧可以对我直接提问，您将需要的桥段粘贴至右侧，我会记住👉
                `);
            feather.replace(); // 重新渲染 Feather 图标
        } else {
            const firstSelectedRoleCode = selectedRoles[0];
            const firstSelectedRole = roles.find(role => role.roleCode === firstSelectedRoleCode);
            if (firstSelectedRole) {
                systemPrompt = firstSelectedRole.roleSystemPrompt;
                $('#Tips').html(`<img src="${firstSelectedRole.roleAvatar}" alt="${firstSelectedRole.roleName}" class="role-avatar-tip"> ${firstSelectedRole.roleName}`);
            }
        }
    }
    $(".role-select-container").hide();
}

function deleteRole() {
    selectedRoles = [];
    systemPrompt = "";
    loadSelectRoles(1, '');
    $closeButton.remove();
    $('#Tips').html(`
                    <i data-feather="info"></i> 我是您的创作助手，您可以选中右侧内容与我进行针对性交流👉
                    <br />
                    如果您没有现存的文章，您依旧可以对我直接提问，您将需要的桥段粘贴至右侧，我会记住👉
                `);
    feather.replace();
}

// websocket连接设置
var connection = new signalR.HubConnectionBuilder()
    .withUrl('/chatHub', {
        accessTokenFactory: () => localStorage.getItem('aibotpro_userToken')
    })
    .withAutomaticReconnect()
    .build();

// 启动连接
connection.start()
    .then(function () {
        console.log('与服务器握手成功 :-)'); // 与服务器握手成功
    })
    .catch(function (error) {
        console.log('与服务器握手失败 :-( 原因: ' + error); // 与服务器握手失败
        sendExceptionMsg('与服务器握手失败 :-( 原因: ' + error);
        // 检查令牌是否过期，如果是，则跳转到登录页面
        if (isTokenExpiredError(error)) {
            window.location.href = "/Users/Login";
        }
    });

// 检查错误是否表示令牌过期的函数
// 注意：您需要根据实际的错误响应格式来调整此函数
function isTokenExpiredError(error) {
    // 这里的判断逻辑依赖于服务器返回的错误格式
    // 例如，如果服务器在令牌过期时返回特定的状态码或错误信息，您可以在这里检查
    var expiredTokenStatus = 401; // 假设401表示令牌过期
    return error.statusCode === expiredTokenStatus || error.message.includes("令牌过期");
}

// You can also handle the reconnection events if needed:
connection.onreconnecting((error) => {
    console.assert(connection.state === signalR.HubConnectionState.Reconnecting);
    console.log(`由于错误"${error}"失去连接。正在尝试重新连接。`);
    // Here you might want to inform the user that the connection is being reattempted.
});

connection.onreconnected((connectionId) => {
    console.assert(connection.state === signalR.HubConnectionState.Connected);
    console.log(`连接已重新建立。已连接到connectionId为"${connectionId}"。`);
    // Here you might want to inform the user that the connection has been successfully reestablished.
});

connection.onclose((error) => {
    console.assert(connection.state === signalR.HubConnectionState.Disconnected);
    console.log(`由于错误"${error}"连接已关闭。尝试重新启动连接。`);
    // 这里您可以尝试再次启动连接，或者通知用户连接已丢失。
    connection.start();
});

function getAIModelList() {
    // 允许滚动
    $('#AIModel').css({
        'overflow': 'auto', 'height': '550px'
    });
    $.ajax({
        type: "Post", url: "/Home/GetAImodel", dataType: "json", success: function (res) {
            var html = "";
            if (res.success) {
                //modelPriceInfo(res.data[0].modelName);
                $("#firstModel").html(res.data[0].modelNick);
                thisAiModel = res.data[0].modelName;
                for (var i = 0; i < res.data.length; i++) {
                    var modelNick = stripHTML(res.data[i].modelNick);
                    var modelName = res.data[i].modelName;
                    modelList.push({
                        model: modelName, modelNick: res.data[i].modelNick
                    });
                    html += `<a class="dropdown-item font-14" href="#" data-model-name="${modelName}" data-model-nick="${modelNick}" data-seq="${res.data[i].seq}">${res.data[i].modelNick}</a>`;
                }
                $('#modelList').html(html);
                bindClickEvent();
                if (!isMobile()) {
                    var originalOrder;
                    // 首先销毁之前的sortable实例
                    if ($("#modelList").data('uiSortable')) {
                        $("#modelList").sortable("destroy");
                    }
                    // 初始化拖动排序
                    $("#modelList").sortable({
                        revert: 100, start: function (event, ui) {
                            // 记录原始顺序
                            originalOrder = $("#modelList").sortable("toArray", {attribute: "data-model-name"});
                            // 在拖动开始时禁用点击事件
                            $('#modelList a').off('click');
                        }, stop: function (event, ui) {
                            var newOrder = $("#modelList").sortable("toArray", {attribute: "data-model-name"});
                            // 比较新旧顺序
                            if (!arraysEqual(originalOrder, newOrder)) {
                                saveModelSeq();
                            }
                            bindClickEvent();
                            bindHoverEvent();
                        }
                    }).disableSelection();
                    bindHoverEvent();
                }
                $(".dropdown-item").css("margin-left", 0);
            }
        }, error: function (err) {
            // balert("系统未配置AI模型", "info", false, 2000, "center");
        }
    });
}

function bindClickEvent() {
    $('#modelList a').on('click', function (e) {
        e.preventDefault();
        var modelName = $(this).data('model-name');
        var modelNick = $(this).html();
        changeModel(modelName, modelNick);
    });
}

function bindHoverEvent() {
    $('#modelList a').on('mouseenter', function (e) {
        var modelName = $(this).data('model-name');
        showTooltip(modelName, e);
    }).on('mouseleave', function () {
        hideTooltip();
    }).on('mousemove', function (e) {
        moveTooltip(e);
    });
}

function showTooltip(text, e) {
    $('body').append('<div id="customTooltip" style="position: fixed; background: #333; color: #fff; padding: 5px 10px; border-radius: 4px; font-size: 12px; z-index: 9999;">' + text + '</div>');
    moveTooltip(e);
}

function moveTooltip(e) {
    $('#customTooltip').css({
        left: e.pageX + 10, top: e.pageY + 10
    });
}

function hideTooltip() {
    $('#customTooltip').remove();
}

function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (var i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }
    return true;
}

function stripHTML(html) {
    var tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

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
        var nodes = document.querySelectorAll('#modelList a');
        nodes.forEach(function (node) {
            var modelNick = node.getAttribute('data-model-nick').toLowerCase();
            if (modelNick.includes(filter)) {
                node.style.display = "block";
            } else {
                node.style.display = "none";
            }
        });
    }
}

function saveModelSeq() {
    var items = $("#modelList").find("a");
    var formData = new FormData();
    items.each(function (index, item) {
        var modelName = $(item).data("model-name");
        var modelNick = $(item).data("model-nick");
        var seq = index + 1;
        formData.append(`ChatModelSeq[${index}].ModelNick`, modelNick);
        formData.append(`ChatModelSeq[${index}].ModelName`, modelName);
        formData.append(`ChatModelSeq[${index}].Seq`, seq);
    });

    //loadingBtn('.saveSeq');
    $.ajax({
        type: 'POST',
        url: '/Home/SaveModelSeq',
        processData: false,
        contentType: false,
        data: formData,
        success: function (res) {
            //unloadingBtn('.saveSeq');
            if (res.success) {
                balert(res.msg, 'success', false, 1500, 'top');
            } else {
                balert(res.msg, 'danger', false, 1500, 'top');
            }
        },
        error: function (error) {
            //unloadingBtn('.saveSeq');
            sendExceptionMsg("保存排序异常");
        }
    });
}

//切换模型
function changeModel(modelName, modelNick) {
    $("#firstModel").html(modelNick);
    feather.replace();
    $("#firstModel").attr("data-modelName", modelName);
    $("#firstModel").attr("data-modelNick", modelNick);
    thisAiModel = modelName;
    //modelPriceInfo(modelName);
    balert("切换模型【" + modelNick + "】成功", "success", false, 1000);
}

$(document).keypress(function (e) {
    if ($chatInput.is(":focus")) {
        if ((e.which == 13 && e.shiftKey) || (e.which == 10 && e.shiftKey) || (e.which == 13 && e.ctrlKey) || (e.which == 10 && e.ctrlKey)) {
            e.preventDefault();  // 阻止默认行为
            // 这里实现光标处换行
            var input = $chatInput;
            var content = input.val();
            var caretPos = input[0].selectionStart;

            var newContent = content.substring(0, caretPos) + "\n" + content.substring(input[0].selectionEnd, content.length);
            input.val(newContent);
            // 设置新的光标位置
            input[0].selectionStart = input[0].selectionEnd = caretPos + 1;
            adjustInputHeight(input);
        } else if (e.which == 13) {
            e.preventDefault();
            $sendButton.click();
        }
    }
});

// 输入内容时调整高度
$chatInput.on("input", function () {
    adjustInputHeight($(this));
});

// 发送按钮点击事件
$sendButton.on("click", function () {
    if (!processOver) {
        stopGenerate();
    } else {
        if (thisChapter == 0) {
            balert("请先选择章节或新建章节", "warning", false, 2000);
            return;
        }
        sendMsgByWriter();
        $chatInput.val(""); // 清空输入框
        adjustInputHeight($chatInput); // 重置高度
    }
});
let sysmsg = "";
let jishuqi = 0;

// 调整输入框高度的函数
function adjustInputHeight($input) {
    $input.css('height', 'auto'); // 重置高度
    $input.css('height', $input[0].scrollHeight + 'px'); // 设置为内容高度
}

connection.on('ReceiveMessage', function (message) {
    if (!message.isfinish) {
        if (jishuqi == 0) {
            chatid = message.chatid;
        } else {
            if (message.message != null) {
                sysmsg += message.message;
                let thinkContent = '';
                let normalContent = sysmsg;
                let thinkingEnded = false;
                const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
                let match;
                while ((match = thinkRegex.exec(sysmsg)) !== null) {
                    thinkContent = match[1]; // 直接取最后一个完整的 think 块内容
                    normalContent = normalContent.replace(match[0], '');
                    thinkingEnded = true; // 找到完整的 <think></think> 对
                }

                // 如果没有找到完整的 <think></think> 对，则继续查找未闭合的 <think> 标签
                if (!thinkingEnded) {
                    const unfinishedThinkRegex = /<think>([\s\S]*?)$/g;
                    if ((match = unfinishedThinkRegex.exec(sysmsg)) !== null) {
                        thinkContent = match[1];
                        normalContent = normalContent.replace(match[0], '');
                    }
                }
                stopTimer(`#${assistansBoxId}_timer_first`);
                let chatContentBox = $(`#${assistansBoxId}`);

                // 处理 <think> 内容
                let thinkBox = $(`#${assistansBoxId}-think`);
                if (thinkContent) {
                    if (thinkBox.length === 0) {
                        thinkBox = $(`<details id="${assistansBoxId}-think"><summary>AI 正在思考中(点击展开)...</summary><div class="think-content"></div></details>`);
                        chatContentBox.before(thinkBox); // 将 thinkBox 放到 chatContentBox 前面
                    }

                    thinkBox.find('.think-content').html(md.render(thinkContent));
                    if (thinkingEnded) {
                        thinkBox.find('summary').text('AI 思考结束（点击展开）');
                        if (!thinkBox.data('fixed')) {
                            chatContentBox.parent().prepend(thinkBox);
                            thinkBox.data('fixed', true);
                        }
                    } else {
                        thinkBox.find('summary').text('AI 正在思考中(点击展开)...');
                    }
                }

                // 渲染普通内容
                if (normalContent) {
                    chatContentBox.html(md.render(normalContent));
                }
                //$("#" + assistansBoxId).html(md.render(sysmsg));
                $("#" + assistansBoxId + " pre code").each(function (i, block) {
                    hljs.highlightElement(block);
                });
                addLanguageLabels(true, assistansBoxId);
                addCopyBtn(assistansBoxId);
                if (Scrolling == 1) $('.chat-box').scrollTop($('.chat-box')[0].scrollHeight);
                applyMagnificPopup('.chat-message-box');

            }
        }
        jishuqi++;
    } else {
        processOver = true;
        $("#sendButton").html(`<i class="fas fa-paper-plane"></i> 发送`);
        $("#sendButton").removeClass("danger");
        $("#ctrl-" + assistansBoxId).show();
        $('[data-toggle="tooltip"]').tooltip();
        $("#" + assistansBoxId + " pre code").each(function (i, block) {
            hljs.highlightElement(block);
        });
        feather.replace();
        sysmsg = "";
        jishuqi = 0;
        $('.LDI').remove();
    }
});

//发送消息
function sendMsgByWriter(retryCount = 3) {
    var msg = $("#chatInput").val().trim();
    if (msg == "") {
        balert("请输入问题", "warning", false, 2000);
        return;
    }
    if (!processOver) {
        balert("对话进行中,请结束后再试", "warning", false, 2000);
        return;
    }
    processOver = false;
    $("#sendButton").html(`<i class="far fa-stop-circle"></i> 终止`);
    feather.replace();
    $("#sendButton").addClass("danger");
    chatgroupid = generateGUID();
    var msgid_u = generateGUID();
    var msgid_g = generateGUID();
    var temperatureText = $('#temperatureValue').text();
    var temperature = parseFloat(temperatureText);
    if (isNaN(temperature)) {
        temperature = 1.00;
    }
    var presenceText = $('#frequencyPenaltyValue').text();
    var presence = parseFloat(presenceText);
    if (isNaN(presence)) {
        presence = 0;
    }

    var frequencyText = $('#presencePenaltyValue').text();
    var frequency = parseFloat(frequencyText);
    if (isNaN(frequency)) {
        frequency = 0;
    }
    var maxtokensText = $('#maxTokensValue').text();
    var maxtokens = parseInt(maxtokensText);
    if (isNaN(maxtokens)) {
        maxtokens = 4095;
    }
    assistansBoxId = msgid_g;
    var data = {
        "msg": msg,
        "chatid": chatid,
        "aiModel": thisAiModel,
        "msgid_u": msgid_u,
        "msgid_g": msgid_g,
        "chatgroupid": chatgroupid,
        "ip": IP,
        "image_path": [],
        "file_list": [],
        "system_prompt": systemPrompt,
        "useMemory": false,
        "temperature": temperature,
        "presence": presence,
        "frequency": frequency,
        "maxtokens": maxtokens,
        "seniorSetting": false,
        "inputCacheKey": "",
        "stream": true,
        "readingMode": false,
        "writerModel": true,
        "bookCode": bookCode,
        "chapterId": thisChapter,
        "selectChapters": selectChapters
    };
    var html = `<div class="message user">
                        <div class="bubble" data-group="${chatgroupid}">
                           <pre id="${msgid_u}"></pre>
                        </div>
                    </div>`;
    $('#chatBox').append(html);
    if (msg.length > 1000) {
        setInputToCache(data, function (responseData) {
            data.inputCacheKey = responseData;
            data.msg = "";
        });
    }
    $("#" + msgid_u).text(msg);
    var gpthtml = `
    <div class="message ai">
                        <div class="bubble" data-group="${chatgroupid}">
                         <div id="${msgid_g}"></div><div class="spinner-grow spinner-grow-sm LDI"></div>
                            <div id="ctrl-${msgid_g}" style="display: none;">
                                <i data-feather="copy" data-toggle="tooltip" title="复制" class="chatbtns" onclick="copyAll('${msgid_g}')"></i>
                                <i data-feather="trash-2" class="chatbtns delete_writer" data-toggle="tooltip" title="删除" data-chatgroupid="${chatgroupid}"></i>
                            </div>
                        </div>
                    </div>`;
    $('#chatBox').append(gpthtml);
    $('#chatBox').animate({
        scrollTop: $('#chatBox').prop("scrollHeight")
    }, 500);

    // 尝试发送消息
    function trySendMessage() {
        connection.invoke("SendMessage", data)
            .then(function () {
                // 消息发送成功
            })
            .catch(function (err) {
                console.error("Send message failed:", err);
                retryCount--;
                if (retryCount > 0) {
                    setTimeout(trySendMessage, 1000); // 1秒后重试
                } else {
                    processOver = true;
                    balert("发送消息失败,请刷新页面后重试", "danger", false, 2000, "center");
                    $('#' + assistansBoxId).html("发送消息失败,请刷新页面后重试 <a href='javascript:location.reload();'>点击刷新</a>");
                    $('.LDI').remove();
                    sendExceptionMsg("发送消息失败，请检查网络连接并重试。");
                }
            });
    }

    trySendMessage();
}

//停止生成
function stopGenerate() {
    processOver = true;
    $("#sendButton").html(`<i class="fas fa-paper-plane"></i> 发送`);
    $("#sendButton").removeClass("danger");
    $('.LDI').remove();
    $("#ctrl-" + assistansBoxId).show();
    $("#" + assistansBoxId + " pre code").each(function (i, block) {
        hljs.highlightElement(block);
    });
    $.ajax({
        type: "Post", url: "/Home/StopGenerate", dataType: "json", data: {
            chatId: chatgroupid
        }, success: function (res) {
        }, error: function (err) {
            //window.location.href = "/Users/Login";
            balert("出现了一些未经处理的异常，请联系管理员", "danger", false, 2000, "center", function () {
                sendExceptionMsg(err.toString());
            });
        }
    });
}

function newChat() {
    if (!processOver) {
        balert("对话进行中,请结束后再试", "warning", false, 2000);
        return;
    }
    chatid = "";
    chatgroupid = "";
    $("#sendButton").focus();
    var html = `<div id="Tips">
                        <i data-feather="info"></i> 我是您的创作助手，您可以选中右侧内容与我进行针对性交流👉
                        <br />
                        如果您没有现存的文章，您依旧可以对我直接提问，您将需要的桥段粘贴至右侧，我会记住👉
                    </div>`
    $('#chatBox').html(html);
    feather.replace();

}

function copyAll(id) {
    //复制全部text
    var codeToCopy = $("#" + id).text();
    var tempTextArea = $('<textarea>').appendTo('body').val(codeToCopy).select(); // 创建临时的 textarea 并选中文本
    document.execCommand('copy'); // 执行复制操作
    tempTextArea.remove(); // 移除临时创建的 textarea
    balert("复制成功", "success", false, 1000, "top");
}

$(document).on('click', '.delete_writer', function (e) {
    e.preventDefault();
    const chatgroupid = $(this).data('chatgroupid');
    const $btn = $(this);

    // 使用Bootstrap的Modal
    const $confirmDialog = $(`
        <div class="modal fade" id="deleteConfirmModal-${chatgroupid}" tabindex="-1" role="dialog" aria-labelledby="deleteConfirmModalLabel-${chatgroupid}" aria-hidden="true">
          <div class="modal-dialog" role="document">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="deleteConfirmModalLabel-${chatgroupid}">删除模式选择</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
              <div class="modal-body">
                请选择删除模式：
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-danger custom-confirm-1" data-dismiss="modal">彻底删除</button>
                <button type="button" class="btn btn-warning custom-confirm-2" data-dismiss="modal">标记删除</button>
              </div>
            </div>
          </div>
        </div>
    `);

    // 添加到body，并显示modal
    $('body').append($confirmDialog);
    $(`#deleteConfirmModal-${chatgroupid}`).modal('show');


    $confirmDialog.find('.custom-confirm-1').on('click', function () {
        deleteChatGroup(chatgroupid, 1);
        // 让Bootstrap处理关闭
        //  $(`#deleteConfirmModal-${chatgroupid}`).modal('hide'); //也可以使用这个
    });

    $confirmDialog.find('.custom-confirm-2').on('click', function () {
        deleteChatGroup(chatgroupid, 2);

        const $message = $(`.bubble[data-group='${chatgroupid}']`);
        let $chatgroup;

        if ($message.length === 0) {
            $chatgroup = $(`.chat-message[data-group='${chatgroupid}']`); // 假设这是备用选择器
        } else {
            $chatgroup = $message;
        }

        $chatgroup.addClass('chatgroup-masked');
        createMaskedOverlays();
        // 让Bootstrap处理关闭
        // $(`#deleteConfirmModal-${chatgroupid}`).modal('hide'); //也可以使用这个
    });

    // 清理：当模态框关闭时，从DOM中移除它（防止重复ID）
    $confirmDialog.on('hidden.bs.modal', function () {
        $(this).remove();
    });
});


function deleteChatGroup(id, type) {
    $.ajax({
        type: "Post", url: "/Home/DelChatGroup", dataType: "json", data: {
            groupId: id, type: type
        }, success: function (res) {
            if (res.success) {
                balert("删除成功", "success", false, 1000, "top");
                if (type === 1) {
                    $('[data-group="' + id + '"]').remove();
                    if (chatBody.find('[data-group]').length <= 0) {
                        chatid = "";
                        //刷新列表
                        getHistoryList(pageIndex, pageSize, true, false, $("#searchKey").val().trim());
                    }
                }
            }
        }, error: function (err) {
            //window.location.href = "/Users/Login";
            balert("删除失败，错误请联系管理员：err", "danger", false, 2000, "center");
        }
    });
}