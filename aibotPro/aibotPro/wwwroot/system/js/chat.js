var max_textarea = false;
var textarea = document.getElementById("Q");
var $Q = $("#Q");
var chatBody = $(".chat-body-main");
var thisAiModel = "gpt-4o-mini"; //当前AI模型
var thisAiModelNick = `<i class='icon icon-gpt'></i> ChatGPT-4O-Mini✨🖼️`;
var processOver = true; //是否处理完毕
var image_path = [];
var file_list = [];
var chatid = "";
var chatgroupid = "";
var assistansBoxId = "";
let pageIndex = 1;
let pageSize = 20;
let isLoading = false;
let hasMore = true;
let useMemory = false;
let pure = false;
let grouping = true;
let createAiPrompt = false;
let seniorSetting = false;
let shortcuts = true;
let stream = true;
let readingMode = false;
let autoChange = true;
var markdownHis = [];
let roleAvatar = 'A';
var systemPrompt = "";
let roleName = "AIBot";
let modelList = [];
let globe = false;
let roleListPage = 1;
let roleListPageSize = 20;
let roleListNoMoreData = false;
let roleListIsLoading = false;
let connection = null;

// 1. 封装token检查函数
function checkToken() {
    const token = localStorage.getItem('aibotpro_userToken');
    if (!token) {
        window.location.href = "/Users/Welcome";
        return false;
    }
    return token;
}

// 2. 封装connection创建函数 
function createConnection(token) {
    connection = new signalR.HubConnectionBuilder()
        .withUrl('/chatHub', {
            accessTokenFactory: () => token
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, null]) // 自定义重连间隔
        .build();
    return connection;
}

// 3. 优化启动连接的处理
async function startConnection(connection) {
    try {
        await connection.start();
        console.log('与服务器握手成功 :-)');
    } catch (error) {
        console.error('与服务器握手失败:', error);

        if (isTokenExpiredError(error)) {
            localStorage.removeItem('aibotpro_userToken'); // 清除过期token
            localStorage.removeItem('aibotpro_userToken_Expiration');
            window.location.href = "/Users/Login";
            return;
        }

        // 其他错误处理
        sendExceptionMsg('连接失败: ' + error.message);
    }
}

// 4. 改进token过期检查
function isTokenExpiredError(error) {
    return error.statusCode === 401 ||
        error.message?.toLowerCase().includes('token') ||
        error.message?.toLowerCase().includes('unauthorized');
}

// 5. 主函数整合所有功能
async function initializeConnection() {
    const token = checkToken();
    if (!token) return;

    const connection = createConnection(token);

    // 注册事件处理
    connection.onreconnecting((error) => {
        console.warn(`连接断开,正在重连...`, error);
        // 可以显示重连UI提示
    });

    connection.onreconnected((connectionId) => {
        console.log(`重连成功! ID: ${connectionId}`);
        // 可以隐藏重连UI提示
    });

    connection.onclose(async (error) => {
        console.error(`连接关闭:`, error);
        // 可以显示断开连接UI提示
        await startConnection(connection); // 尝试重新连接
    });

    // 启动连接
    await startConnection(connection);

    return connection;
}

// 6. 启动应用
(async () => {
    try {
        const connection = await initializeConnection();
        // 在这里可以使用connection进行后续操作
    } catch (error) {
        console.error('初始化连接失败:', error);
    }
})();

//监听键盘事件
$(document).keypress(function (e) {
    if ($("#Q").is(":focus")) {
        if (isMobile() && max_textarea) return;
        if ((e.which == 13 && e.shiftKey) || (e.which == 10 && e.shiftKey) || (e.which == 13 && e.ctrlKey) || (e.which == 10 && e.ctrlKey)) {

            // 这里实现光标处换行
            var input = $("#Q");
            var content = input.val();
            var caretPos = input[0].selectionStart;

            var newContent = content.substring(0, caretPos) + "\n" + content.substring(input[0].selectionEnd, content.length);
            input.val(newContent);
            // 设置新的光标位置
            input[0].selectionStart = input[0].selectionEnd = caretPos + 1;
            e.preventDefault();  // 阻止默认行为
        } else if (e.which == 13) {
            // 避免回车键换行
            e.preventDefault();
            if (sysmodel == 'chat') sendMsg();
            else sendMsgByCanver();
        }
    }
    if ($("#searchKey").is(":focus")) {
        if (e.which == 13) {
            //按下回车键搜索
            hasMore = true;
            getHistoryList(1, 20, true, true, $("#searchKey").val().trim());
        }
    }
});

function dataURLtoFile(dataurl, filename) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]), n = bstr.length,
        u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type: mime});
}

// 阻止浏览器默认行为
$(document).on({
    dragenter: function (e) {
        e.stopPropagation();
        e.preventDefault();
    }, dragover: function (e) {
        e.stopPropagation();
        e.preventDefault();
    }, drop: function (e) {
        e.stopPropagation();
        e.preventDefault();
        var files = e.originalEvent.dataTransfer.files;
        handleDroppedFiles(files);
    }
});
//页面加载完成后执行
$(document).ready(function () {
    bindEnglishPromptTranslation("#Q");
    bindAtCharacterSelector("#Q");
    bindOptimizePrompt("#Q");
    bindInputToSidebar("#Q");
    //当#Q失去焦点时，关闭最大化
    // $("#Q").blur(function () {
    //     if (max_textarea) {
    //         max_textarea_Q();
    //     }
    // });
    $Q.on('paste', function (event) {
        for (var i = 0; i < event.originalEvent.clipboardData.items.length; i++) {
            var item = event.originalEvent.clipboardData.items[i];
            if (item.kind === 'file') {
                var blob = item.getAsFile();
                handleFileUpload(blob);
            }
        }
    });
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
    $("#sendBtn").on("click", function () {
        if (!processOver) {
            stopGenerate();
        } else if (sysmodel == 'chat') sendMsg();
        else sendMsgByCanver();
    });


    const daysInMonth = moment("2024-07", "YYYY-MM").daysInMonth();
    const firstDay = moment("2024-07-01", "YYYY-MM-DD").day();

    for (let i = 0; i < firstDay; i++) {
        $('#calendarBody').append('<div></div>');
    }

    for (let i = 1; i <= daysInMonth; i++) {
        $('#calendarBody').append(`<div class="calendar-day">${i}</div>`);
    }
    isVIPbyUserInfo();
});
document.addEventListener('DOMContentLoaded', function () {
    // 为所有的聊天项绑定右键事件
    document.body.addEventListener('contextmenu', function (e) {
        const chatItem = e.target.closest('.chat-item');
        if (chatItem) {
            e.preventDefault();
            const chatId = chatItem.dataset.chatId;
            const isTop = chatItem.dataset.istop === 'true';
            const itemType = chatItem.dataset.itemtype;
            showContextMenu(e.pageX, e.pageY, chatId, isTop, itemType);
        }
    });

    // 为移动设备绑定长按事件
    let longPressTimer;
    document.body.addEventListener('touchstart', function (e) {
        const chatItem = e.target.closest('.chat-item');
        if (chatItem) {
            longPressTimer = setTimeout(function () {
                const chatId = chatItem.dataset.chatId;
                const isTop = chatItem.dataset.istop === 'true';
                const itemType = chatItem.dataset.itemtype;
                showContextMenu(e.touches[0].pageX, e.touches[0].pageY, chatId, isTop, itemType);
            }, 500);
        }
    });

    document.body.addEventListener('touchend', function () {
        clearTimeout(longPressTimer);
    });

    // 阻止长按时默认的上下文菜单
    document.body.addEventListener('touchmove', function (e) {
        clearTimeout(longPressTimer);
    });

    // 点击其他地方关闭菜单
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.custom-context-menu')) {
            $('.custom-context-menu').remove();
        }
    });
});

function updateSliderValue(sliderId, displayId, isInt = false) {
    $(sliderId).on('input', function () {
        let value = isInt ? parseInt($(this).val()) : parseFloat($(this).val()).toFixed(2);
        $(displayId).text(value);
        localStorage.setItem(displayId.replace('#', ''), value);
    });
}

// 注册各滑块的事件处理
updateSliderValue('#temperatureSlider', '#temperatureValue');
updateSliderValue('#topPSlider', '#topPValue');
updateSliderValue('#frequencyPenaltySlider', '#frequencyPenaltyValue');
updateSliderValue('#presencePenaltySlider', '#presencePenaltyValue');
updateSliderValue('#maxTokensSlider', '#maxTokensValue', true);

function handleDroppedFiles(files) {
    for (var i = 0; i < files.length; i++) {
        handleFileUpload(files[i]);
    }
}

function handleFileUpload(file) {
    var reader = new FileReader();

    if (/image/.test(file.type)) {
        reader.onload = function (event) {
            var base64 = event.target.result;
            var imageFile = dataURLtoFile(base64, "clipboard_image-" + new Date().toISOString() + ".png");
            var destroyAlert = balert(`<i data-feather="loader" style="width:20px;"></i> 正在上传...`, "info", false, 0, "center");
            uploadIMGFile(imageFile, destroyAlert);
        };
        reader.readAsDataURL(file);
    } else {
        uploadFiles(file, false);
    }
}

$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#aichat-nav").addClass('active');
    if (grouping && !isMobile()) getAIModelListByGroup(); else getAIModelList();
    getHistoryList(pageIndex, pageSize, true, true, "");
    var type = getUrlParam("type");
    if (type == "test") {
        runTestRole();
    }
    //如果没有type参数，执行默认的角色
    if (type == '') {
        $(".clearRole").hide();
    } else {
        $(".clearRole").show();
        runMarketRole(type);
    }
    $('[data-toggle="tooltip"]').tooltip();
    $('[data-toggle="popover"]').popover({
        trigger: 'manual',
        container: 'body'
    });
    isVIPorSupperVIP(function (isSuper) {
        if (isSuper) {
            $('.calendar-overlay').hide();
            getThisMonthSignInList();
        } else {
            $('.calendar-overlay').show();
        }
    });
})

//最大化输入框
function max_textarea_Q() {
    const contentElement = $(".chat-body-content");
    if (!max_textarea) {
        $Q.css({
            "height": "500px",
            "max-height": "500px"
        });
        contentElement.css("height", "calc(100% - 580px)");
        $(".maximize-2").attr("data-feather", "minimize-2");
        max_textarea = true;
    } else {
        $Q.css({
            "height": "auto",
            "max-height": "200px"
        });
        contentElement.css("height", "calc(100% - 120px)");
        $(".maximize-2").attr("data-feather", "maximize-2");
        max_textarea = false;
    }

    // 更新 Feather 图标
    feather.replace();
}

//获取AI模型列表
function getAIModelList() {
    // 允许滚动
    $('#AIModel').html(`<div id="searchIcon" style="cursor:pointer;margin:5px;color:gray;">
                            <i data-feather="search" style="width: 20px;"></i>
                            <span>点击搜索,下方拖动排序</span>
                        </div>
                        <input type="text" id="modelSearch" class="form-control searchModel" placeholder="搜索模型..."
                               onkeyup="filterModels()" style="display:none;">
                        <div id="modelList"></div>`);
    $('#AIModel').css({
        'overflow': 'auto',
        'height': '550px'
    });
    $.ajax({
        type: "Post", url: "/Home/GetAImodel", dataType: "json", success: function (res) {
            var html = "";
            if (res.success) {
                modelPriceInfo(res.data[0].modelName);
                $("#firstModel").html(res.data[0].modelNick);
                thisAiModel = res.data[0].modelName;
                for (var i = 0; i < res.data.length; i++) {
                    var modelNick = stripHTML(res.data[i].modelNick);
                    var modelName = res.data[i].modelName;
                    modelList.push({
                        model: modelName,
                        modelNick: res.data[i].modelNick
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

function getAIModelListByGroup() {
    // 基础HTML结构
    var html = `<div class="newgroup-container">
                    <!-- 左侧分组 -->
                    <div class="newgroup-sidebar">
                        <div class="newgroup-search">
                            <input type="text" class="form-control" placeholder="搜索模型...">
                        </div>
                        <div class="newgroup-categories">
                        </div>
                    </div>
                    <!-- 右侧模型列表 -->
                    <div class="newgroup-content">
                        <div class="newgroup-models">
                           <p class="text-info">加载中...</p>
                        </div>
                    </div>
                </div>`;

    // 首先将基础HTML结构渲染到#AIModel
    $('#AIModel').html(html);
    $('#AIModel .newgroup-container').on('click', function (e) {
        e.stopPropagation();
    });
    // 禁止滚动
    $('#AIModel').css({
        'overflow': 'hidden',
        'height': '550px'
    });
    // 渲染分组列表
    getGroupHtml();

    // 渲染模型卡片
    getModelCard('');

    // 绑定搜索功能
    $('#AIModel .newgroup-search input').on('input', function () {
        const searchText = $(this).val().toLowerCase();
        $('#AIModel .newgroup-model-card').each(function () {
            const title = $(this).find('.newgroup-model-title').text().toLowerCase();
            const desc = $(this).find('.newgroup-model-desc').text().toLowerCase();
            if (title.includes(searchText) || desc.includes(searchText)) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    });
}

//渲染分组列表
function getGroupHtml() {
    let groupHtml = '';
    $.ajax({
        type: "Post",
        url: "/Home/GetAIModelGroup",
        dataType: "json",
        success: function (res) {
            if (res.success) {
                var data = res.data;
                groupHtml += `<div class="newgroup-category active" data-group="">
                                <div class="newgroup-category-name">全部</div>
                             </div>`;
                groupHtml += `<div class="newgroup-category" data-group="free">
                                <div class="newgroup-category-name">🆓 免费模型</div>
                             </div>`;
                groupHtml += `<div class="newgroup-category" data-group="vip">
                                <div class="newgroup-category-name">✨ VIP特惠</div>
                             </div>`;
                groupHtml += `<div class="newgroup-category" data-group="svip">
                                <div class="newgroup-category-name">👑 SVIP特惠</div>
                             </div>`;
                for (var i = 0; i < data.length; i++) {
                    groupHtml += `<div class="newgroup-category ${data[i] === 'all' ? 'active' : ''}" data-group="${data[i]}">
                                <div class="newgroup-category-name">${data[i]}</div>
                             </div>`;
                }

                $('#AIModel .newgroup-categories').html(groupHtml);
                // 绑定分组点击事件
                $('#AIModel .newgroup-category').click(function () {
                    $('#AIModel .newgroup-category').removeClass('active');
                    $(this).addClass('active');

                    const selectedGroup = $(this).data('group');
                    $('#AIModel .newgroup-models').html(`<p class="text-info">加载中...</p>`);
                    getModelCard(selectedGroup);
                });
            }
        }
    });
}

// 渲染模型卡片
function getModelCard(group) {
    let modelCards = '';
    $.ajax({
        type: "Post",
        url: "/Home/GetAIModelPriceInfo",
        dataType: "json",
        data: {
            group: group
        },
        success: function (res) {
            var data = res.data;
            $("#firstModel").html(data[0].modelNick);
            thisAiModel = data[0].modelName;
            modelPriceInfo(data[0].modelName);
            for (var i = 0; i < data.length; i++) {
                var model = data[i];
                if (group === '') {
                    modelList.push({
                        model: model.modelName,
                        modelNick: model.modelNick
                    });
                }
                const needExpand = model.modelInfo.length > 36;
                modelCards += `
                    <div class="newgroup-model-card" data-model="${model.modelName}">
                        <div class="newgroup-model-title">${model.modelNick}</div>
                        <small class="text-info">${model.modelName}</small>
                        <div class="newgroup-model-desc">${model.modelInfo}</div>
                        <div class="toggle-expand" style="display: ${needExpand ? 'block' : 'none'}">展开</div>
                    </div>
                    `;
            }
            //modelList去重
            modelList = modelList.filter((item, index) => {
                return modelList.findIndex(obj => obj.model === item.model) === index;
            });
            $('#AIModel .newgroup-models').html(modelCards);
            // 展开收起点击事件
            $('.toggle-expand').click(function (e) {
                e.stopPropagation(); // 阻止事件冒泡
                const $this = $(this);
                const $desc = $this.siblings('.newgroup-model-desc');

                if ($desc.hasClass('expanded')) {
                    $desc.removeClass('expanded');
                    $this.text('展开');
                } else {
                    $desc.addClass('expanded');
                    $this.text('收起');
                }
            });
            // 绑定模型卡片点击事件
            $('#AIModel .newgroup-model-card').click(function () {
                const modelName = $(this).data('model');
                const modelNick = $(this).find('.newgroup-model-title').html();

                // 更新选中的模型
                $('#firstModel').html(modelNick);
                thisAiModel = modelName;
                balert("切换模型【" + modelNick + "】成功", "success", false, 1000);
                // 关闭下拉框
                $('#chatDropdown').dropdown('hide');
                modelPriceInfo(modelName);
            });
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
        left: e.pageX + 10,
        top: e.pageY + 10
    });
}

function hideTooltip() {
    $('#customTooltip').remove();
}

function modelPriceInfo(modelName) {
    $.ajax({
        url: "/Home/GetModelPrice", type: "post", dataType: "json",//返回对象
        data: {
            modelName: modelName
        }, success: function (res) {
            if (res.success) {
                res = res.data;
                var str = ``;
                if (res.length > 0) {
                    var data = res[0];
                    if (data.modelPrice.onceFee > 0) {
                        if (topVipType == "VIP|15" || topVipType == "VIP|20") {
                            str = `<span class="badge badge-pill badge-info">输出：${data.modelPrice.vipOnceFee}/次</span>`;
                        }
                        if (topVipType == "VIP|50" || topVipType == "VIP|90") {
                            str = `<span class="badge badge-pill badge-info">输出：${data.modelPrice.svipOnceFee}/次</span>`;
                        } else {
                            str = `<span class="badge badge-pill badge-info">输出：${data.modelPrice.onceFee}/次</span>`;
                        }
                    } else {
                        if (topVipType == "VIP|15" || topVipType == "VIP|20") {
                            if (data.modelPrice.vipModelPriceInput > 0 && data.modelPrice.vipModelPriceOutput > 0) {
                                str = `<span class="badge badge-pill badge-info">输入：${data.modelPrice.vipModelPriceInput}/1k token</span>
                                   <span class="badge badge-pill badge-info">输出：${data.modelPrice.vipModelPriceOutput}/1k token</span>`;
                            } else {
                                str = '<span class="badge badge-pill badge-success">免费</span>';
                            }
                        } else if (topVipType == "VIP|50" || topVipType == "VIP|90") {
                            if (data.modelPrice.svipModelPriceInput > 0 && data.modelPrice.svipModelPriceOutput > 0) {
                                str = `<span class="badge badge-pill badge-info">输入：${data.modelPrice.svipModelPriceInput}/1k token</span>
                                   <span class="badge badge-pill badge-info">输出：${data.modelPrice.svipModelPriceOutput}/1k token</span>`;
                            } else {
                                str = '<span class="badge badge-pill badge-info">免费</span>';
                            }
                        } else {
                            if (data.modelPrice.modelPriceInput > 0 && data.modelPrice.modelPriceOutput > 0) {
                                str = `<span class="badge badge-pill badge-info">输入：${data.modelPrice.modelPriceInput}/1k token</span>
                                   <span class="badge badge-pill badge-info">输出：${data.modelPrice.modelPriceOutput}/1k token</span>`;
                            } else {
                                str = '<span class="badge badge-pill badge-info">免费</span>';
                            }
                        }
                    }
                } else {
                    str = '<span class="badge badge-pill badge-info">免费</span>';
                }
                $('#priceInfo').html(str);
            }
        }
    });
}

// 辅助函数：比较两个数组是否相等
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
    modelPriceInfo(modelName);
    balert("切换模型【" + modelNick + "】成功", "success", false, 1000);
}

//隐藏历史记录列表
var isShowHistory = true;

function hideHistoary() {
    if (!processOver) {
        balert("对话进行中,请结束后再试", "warning", false, 2000);
        return;
    }
    if (isMobile()) {
        mobileChat(false);
    } else {
        var chatSidebar = $(".chat-sidebar");
        var chatBody = $(".chat-body");
        var icon = $("#hidehis");
        var animationDuration = 400; // 单位毫秒
        if (isShowHistory) {
            chatSidebar.hide();
            icon.attr("data-feather", "chevron-right");
            feather.replace();
            chatBody.animate({
                width: "100%", marginLeft: "0"
            }, animationDuration, function () {
            });
            isShowHistory = false;
        } else {
            chatBody.css("width", "calc(100% - 300px)");
            icon.attr("data-feather", "chevron-left");
            feather.replace();
            chatBody.animate({
                marginLeft: "300px"
            }, animationDuration, function () {
                chatSidebar.show();  // 立即显示sidebar
            });
            isShowHistory = true;
        }
    }
}

//移动端显示聊天记录
function mobileChat(show) {
    if (isMobile()) {
        if (show) {
            $(".chat-sidebar").hide();
            $(".chat-body").show();
        } else {
            $(".chat-sidebar").show();
            $(".chat-body").hide();
        }
    }
}

//接收消息

let sysmsg = "";
let jishuqi = 0;

// 添加显示代码语言的 Labels
function addLanguageLabels() {
    $("pre code").each(function () {
        var codeBlock = $(this);
        if (codeBlock.parent('.code-container').length === 0) {
            codeBlock.wrap('<div class="code-container"></div>');
            var lang = codeBlock.attr('class').match(/language-(\w+)/);
            var language = lang ? lang[1] : "code";
            var langLabelContainer = $('<div class="code-lang-label-container"></div>');
            var langLabel = $('<span>' + language + '</span>');
            var toggleIcon = $('<span class="toggle-icon"><i class="fas fa-chevron-down"></i></span>');

            toggleIcon.on('click', function () {
                var container = $(this).parent().next('.code-container');
                container.toggleClass('open');
                $(this).find('i').toggleClass('fa-chevron-down fa-chevron-up');
            });

            langLabelContainer.append(langLabel, toggleIcon);
            codeBlock.before(langLabelContainer);
        }
    });
}

function addLanguageLabels(useSpecificId = false, assistansBoxId = '') {
    var selector = useSpecificId && assistansBoxId ? $("#" + assistansBoxId + " pre code") : $("pre code");

    selector.each(function () {
        var codeBlock = $(this);
        var parentPre = codeBlock.parent('pre');
        // 添加标记,防止重复处理
        if (parentPre.data('labels-added')) {
            return;
        }
        // 跳过 Mermaid 图表
        if (parentPre.prev('.mermaid').length > 0 || codeBlock.hasClass('language-mermaid')) {
            return;
        }

        if (parentPre.find('.code-lang-label-container').length === 0) {
            var lang = codeBlock.attr('class').match(/language-(\w+)/);
            if (lang) {
                var langLabelContainer = $('<div class="code-lang-label-container"></div>');
                var langLabel = $('<span class="code-lang-label">' + lang[1] + '</span>');
                var toggleBtn = $('<span class="toggle-button"><i class="fas fa-chevron-up"></i> 收起</span>');

                toggleBtn.on('click', function () {
                    if (codeBlock.is(':visible')) {
                        codeBlock.slideUp();
                        $(this).html('<i class="fas fa-chevron-down"></i> 展开');
                    } else {
                        codeBlock.slideDown();
                        $(this).html('<i class="fas fa-chevron-up"></i> 收起');
                    }
                });

                langLabelContainer.append(langLabel, toggleBtn);
                parentPre.before(langLabelContainer);
            }
        }
    });
}

connection.on('ReceiveMessage', function (message) {
    //console.log(message);
    if (!message.isfinish) {
        if (jishuqi == 0) {
            chatid = message.chatid;
            ClearImg();
            //fileTXT = "";
        } else {
            if (message.isterminal) {
                // 检查是否已存在终端窗口
                let terminalWindow = $(`#${assistansBoxId} .terminal-window`);

                if (terminalWindow.length === 0) {
                    // 如果不存在，创建新的终端窗口
                    terminalWindow = $('<div class="terminal-window"></div>');
                    let terminalHeader = $('<div class="terminal-header">Terminal</div>');
                    let terminalBody = $('<div class="terminal-body"></div>');
                    let terminalContent = $('<pre class="terminal-content"></pre>');

                    terminalBody.append(terminalContent);
                    terminalWindow.append(terminalHeader).append(terminalBody);
                    $(`#${assistansBoxId}`).append(terminalWindow);
                }

                // 更新终端内容
                let terminalContent = terminalWindow.find('.terminal-content');
                terminalContent.append(message.message + '\n');

                // 滚动到底部
                let terminalBody = terminalWindow.find('.terminal-body');
                terminalBody.scrollTop(terminalBody[0].scrollHeight);
            } else if (message.message != null) {
                sysmsg += message.message;
                let thinkContent = '';
                let normalContent = sysmsg;
                let thinkingEnded = false; // 标记是否找到完整的 <think></think> 对

                // 提取 <think> 标签及内容
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

                if (sysmodel == "chat") {
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

                    $("#" + assistansBoxId + " pre code").each(function (i, block) {
                        hljs.highlightElement(block);
                    });
                    addLanguageLabels(true, assistansBoxId);
                    addCopyBtn(assistansBoxId);
                    if (Scrolling == 1) chatBody.scrollTop(chatBody[0].scrollHeight);
                    applyMagnificPopup('.chat-message-box');
                } else if (sysmodel == "aicanver") {
                    // 渲染普通内容
                    let aicanverContentBox = $(`#${assistansBoxId}`);
                    if (normalContent) {
                        handleAicanverContent(normalContent, assistansBoxId, processOver);
                    }
                    // 处理 <think> 内容
                    let thinkBox = $(`#${assistansBoxId}-think`);
                    if (thinkContent) {
                        if (thinkBox.length === 0) {
                            thinkBox = $(`<details id="${assistansBoxId}-think"><summary>AI 正在思考中...</summary><div class="think-content"></div></details>`);
                            aicanverContentBox.before(thinkBox);
                        }

                        thinkBox.find('.think-content').html(md.render(thinkContent));
                        if (thinkingEnded) {
                            thinkBox.find('summary').text('AI 思考结束（点击展开）');
                            if (!thinkBox.data('fixed')) {
                                aicanverContentBox.parent().prepend(thinkBox);
                                thinkBox.data('fixed', true);
                            }
                        } else {
                            thinkBox.find('summary').text('AI 正在思考中（点击展开）...');
                        }
                    }
                    if (Scrolling == 1) {
                        $('.aicanver-chat-container').scrollTop($('.aicanver-chat-container').prop("scrollHeight"));
                    }
                }
            }

        }
        jishuqi++;
    } else {
        processOver = true;
        $("#sendBtn").html(`<i data-feather="send"></i>`);
        $("#sendBtn").removeClass("text-danger");
        $("#ctrl-" + assistansBoxId).show();
        if (sysmodel == "chat") {
            stopTimer(`#${assistansBoxId}_timer_first`);
            stopTimer(`#${assistansBoxId}_timer_alltime`);
            $('[data-toggle="tooltip"]').tooltip();
            $(`.chat-message[data-group="${chatgroupid}"] .memory`).attr('onclick', function () {
                return `saveMemory('${chatgroupid}','${chatid}')`;
            });

            $("#" + assistansBoxId + " pre code").each(function (i, block) {
                hljs.highlightElement(block);
            });
            var item = {
                id: assistansBoxId, markdown: sysmsg
            };
            markdownHis.push(item);
            addCopyBtn(assistansBoxId);
            addExportButtonToTables();
            if (Scrolling == 1) chatBody.scrollTop(chatBody[0].scrollHeight);
            applyMagnificPopup('.chat-message-box');
            renderMermaidDiagrams('#' + assistansBoxId);
        } else if (sysmodel == "aicanver") {
            handleAicanverContent(sysmsg, assistansBoxId, processOver);
            var newCode = monacoEditor.getValue();
            highlightChanges(oldCode, newCode, monacoEditor);
            if (Scrolling == 1) {
                $('.chat-sidebar-body').scrollTop($('.chat-sidebar-body').prop("scrollHeight"));
            }
        }
        feather.replace();
        sysmsg = "";
        jishuqi = 0;
        $('.LDI').remove();
        getHistoryList(1, 20, true, false, "");
        getUserInfo();
    }
});


//发送消息
function sendMsg(retryCount = 3) {
    var msg = $("#Q").val().trim();
    if (msg == "") {
        balert("请输入问题", "warning", false, 2000);
        return;
    }
    if (!processOver) {
        balert("对话进行中,请结束后再试", "warning", false, 2000);
        return;
    }
    if (max_textarea) {
        max_textarea_Q();
    }
    processOver = false;
    $("#sendBtn").html(`<i data-feather="stop-circle"></i>`);
    feather.replace();
    $("#sendBtn").addClass("text-danger");
    chatgroupid = generateGUID();
    var msgid_u = generateGUID();
    var msgid_g = generateGUID();
    var temperatureText = $('#temperatureValue').text();
    var temperature = parseFloat(temperatureText);
    if (isNaN(temperature)) {
        temperature = 1.00;
    }

    //var toppText = $('#topPValue').text();
    //var topp = parseFloat(toppText);
    //if (isNaN(topp)) {
    //    topp = 1.00;
    //}

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
    var shortcutSystemPrompt = $("#shortcutSystemPrompt").val() === "" ? systemPrompt : $("#shortcutSystemPrompt").val();
    assistansBoxId = msgid_g;
    var data = {
        "msg": msg,
        "chatid": chatid,
        "aiModel": thisAiModel,
        "msgid_u": msgid_u,
        "msgid_g": msgid_g,
        "chatgroupid": chatgroupid,
        "ip": IP,
        "image_path": image_path,
        "file_list": file_list,
        "system_prompt": `${shortcutSystemPrompt}`,
        "useMemory": useMemory,
        "createAiPrompt": createAiPrompt,
        "temperature": temperature,
        "presence": presence,
        "frequency": frequency,
        "maxtokens": maxtokens,
        "seniorSetting": seniorSetting,
        "inputCacheKey": "",
        "stream": stream,
        "readingMode": readingMode,
        "globe": globe
    };
    $("#Q").val("");
    $("#Q").focus();
    var isvip = false;
    isVIP(function (status) {
        isvip = status;
    });
    var vipHead = isvip ? `<div class="avatar" style="border:2px solid #FFD43B">
             <img src='${HeadImgPath}'/>
             <i class="fas fa-crown vipicon"></i>
         </div>
         <div class="nicknamevip">${UserNickText}</div>` : `<div class="avatar">
             <img src='${HeadImgPath}'/>
         </div>
         <div class="nickname">${UserNickText}</div>`;
    var html = `<div class="chat-message" data-group="${chatgroupid}">
                     <div style="display: flex; align-items: center;">
                        ${vipHead}
                     </div>
                     <div class="chat-message-box">
                       <pre id="${msgid_u}"></pre>
                     </div>
                     <div>
                      <i data-feather="refresh-cw" class="chatbtns" onclick="tryAgain('${msgid_u}')"></i>
                      <i data-feather="edit-3" class="chatbtns" onclick="editChat('${msgid_u}')"></i>
                     </div>
                </div>`;
    $(".model-icons-container").remove();
    chatBody.append(html);
    if (msg.length > 1000) {
        setInputToCache(data, function (responseData) {
            data.inputCacheKey = responseData;
            data.msg = "";
        });
    }
    $("#" + msgid_u).text(msg);
    if (image_path.length > 0) {
        image_path.forEach(function (path) {
            if (path != "") {
                $("#" + msgid_u).append(`<br /><img src="${path.replace("wwwroot", "")}" style="max-width:50%" />`);
            }
        });
    }
    // 遍历 onfilearr 数组，在每次迭代中将文件名添加到 file_list
    if (onfilearr.length > 0) {
        data.file_list = [];
        onfilearr.forEach(function (file) {
            if (file.onfile)
                data.file_list.push(file.path);
        });
    }
    applyMagnificPopup("#" + msgid_u);
    initImageFolding("#" + msgid_u);
    var gpthtml = `<div class="chat-message" data-group="${chatgroupid}">
                    <div style="display: flex; align-items: center;">
                       <div class="avatar gpt-avatar">${roleAvatar}</div>
                        <div class="nickname" style="font-weight: bold; color: black;">${roleName}</div>
                       <span class="badge badge-info ${thisAiModel.replace('.', '')}">${thisAiModel}</span>
                       <span class="badge badge-pill badge-success" id="${msgid_g}_timer_first"></span>
                       <span class="badge badge-pill badge-dark" id="${msgid_g}_timer_alltime"></span>
                    </div>
                    <div class="chat-message-box">
                        <div id="${msgid_g}"></div><div class="spinner-grow spinner-grow-sm LDI"></div>
                    </div>
                    <div id="ctrl-${msgid_g}" style="display: none;">
                        <i data-feather="copy" data-toggle="tooltip" title="复制" class="chatbtns" onclick="copyAll('${msgid_g}')"></i>
                        <i data-feather="anchor" class="chatbtns" data-toggle="tooltip" title="锚" onclick="quote('${msgid_g}')"></i>
                        <i data-feather="trash-2" class="chatbtns custom-delete-btn-1" data-toggle="tooltip" title="删除" data-chatgroupid="${chatgroupid}"></i>
                        <i data-feather="cpu" class="chatbtns memory" data-toggle="tooltip" title="存入记忆" onclick="saveMemory('${chatgroupid}','${chatid}')"></i>
                        <i data-feather="codepen" class="chatbtns" data-toggle="tooltip" title="显示/隐藏Markdown" onclick="toMarkdown('${msgid_g}')"></i>
                    </div>
                </div>`;
    chatBody.append(gpthtml);
    startTimer(`#${msgid_g}_timer_first`, true);
    startTimer(`#${msgid_g}_timer_alltime`);
    adjustTextareaHeight();
    chatBody.animate({
        scrollTop: chatBody.prop("scrollHeight")
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
                    stopTimer(`#${assistansBoxId}_timer_first`);
                    stopTimer(`#${assistansBoxId}_timer_alltime`);
                    $('.LDI').remove();
                    sendExceptionMsg("发送消息失败，请检查网络连接并重试。");
                }
            });
    }

    trySendMessage();
}

//调起摄像头&相册
function showCameraMenu() {
    $("#cameraModel").modal('show');
    if (image_path.length > 0) {
        reviewImg(image_path);
    }
}

//获取历史记录
function getHistoryList(pageIndex, pageSize, reload, loading, searchKey) {
    if (isLoading || !hasMore) return;
    isLoading = true;
    if (loading) $(".chat-list").append(`<li class="divider-text" style="text-align:center;">加载中...</li>`);
    $.ajax({
        type: "Post", url: "/Home/GetChatHistoriesList", dataType: "json", data: {
            pageIndex: pageIndex, pageSize: pageSize, searchKey: searchKey
        }, success: function (res) {
            //console.log(res);
            isLoading = false;
            $(".divider-text").remove();
            if (res.data.length <= 0) {
                if (pageIndex > 1 && !reload) {
                    hasMore = false;
                    $(".chat-list").append(`<li class="divider-text" style="text-align:center;">没有更多数据了~</li>`);
                    //禁用loadMoreBtn
                    //$("#loadMoreBtn").prop('disabled', true).addClass('btn-secondary').removeClass('btn-primary')
                    // $(".chat-sidebar-body").animate({
                    //     scrollTop: $(".chat-sidebar-body")[0].scrollHeight
                    // }, 500)
                } else {
                    //显示没有更多数据了
                    $(".chat-list").append(`<li class="divider-text" style="text-align:center;">暂无对话记录,快开始一次对话吧~</li>`);
                }

            }
            var html = "";
            for (var i = 0; i < res.data.length; i++) {
                var chat = res.data[i].chat;
                if (chat.indexOf('aee887ee6d5a79fdcmay451ai8042botf1443c04') != -1) {
                    var contentarr = chat.split("aee887ee6d5a79fdcmay451ai8042botf1443c04");
                    chat = contentarr[0];
                }
                chat = chat.substring(0, 50);
                if (chat.length > 20) {
                    chat += "...";
                }
                //转译尖括号
                chat = chat.replace(/&lt;/g, "&amp;lt;").replace(/&gt;/g, "&amp;gt;");
                chat = chat.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                var ctrlBtn = `<span class="delete-chat">
                                 <i data-feather="x" onclick="deleteChat('` + res.data[i].chatId + `')"></i>
                               </span>`;
                if (res.data[i].isLock == 1) {
                    ctrlBtn = `<span class="delete-chat text-success">
                                 <i data-feather="unlock" onclick="unLockChat('` + res.data[i].chatId + `')"></i>
                               </span>`;
                }
                var topIcon = '';
                if (res.data[i].isTop == 1) {//<i data-feather="arrow-up" class="text-success mg-r-10"></i>
                    topIcon = '<i class="far fa-arrow-alt-circle-up text-success"></i>';
                }
                html += `<li class="chat-item" id="${res.data[i].chatId}" data-chat-id="${res.data[i].chatId}" data-istop="${res.data[i].isTop}" data-itemtype="chat">
                            ${topIcon}
                            <div class="chat-item-body">
                                <div>
                                    <txt>
                                        ${chat}
                                    </txt>
                                </div>
                                <p>
                                    ${isoStringToDateTime(res.data[i].createTime)}
                                </p>
                            </div>
                            ${ctrlBtn}
                    </li>`;
            }
            if (reload) {
                $.ajax({
                    url: "/Home/GetCollection",
                    type: "post",
                    dataType: "json",
                    success: function (res) {
                        var data = res.data;
                        var str = "";
                        for (var i = 0; i < data.length; i++) {
                            var item = data[i];
                            str += `<li class="chat-item" id="${item.collectionCode}" data-chat-id="${item.collectionCode}" data-itemtype="collection" onclick="showCollection('${item.collectionCode}')">
                                        <i data-feather="folder"></i>
                                        <div class="chat-item-body">
                                            <div>
                                                <txt id="${item.collectionCode}">
                                                    ${item.collectionName}
                                                </txt>
                                            </div>
                                            <p>
                                                ${item.createTime}
                                            </p>
                                        </div>
                                        <span class="delete-chat">
                                           <i data-feather="trash-2" onclick="deleteCollection('${item.collectionCode}','${item.id}')"></i>
                                        </span>
                                   </li>`
                        }
                        html = str + html;
                        $(".chat-list").html(html);
                        feather.replace();
                        addChatItemListeners();
                    },
                    error: function (err) {
                        sendExceptionMsg(`【API：/Home/GetCollection】:${err}`);
                    }
                });

            } else {
                $(".chat-list").append(html);
                // $(".chat-sidebar-body").animate({
                //     scrollTop: $(".chat-sidebar-body")[0].scrollHeight
                // }, 500)
            }
            feather.replace();
            addChatItemListeners();
        }, error: function (err) {
            isLoading = false;
            //window.location.href = "/Users/Login";
            //balert("出现了未经处理的异常，请联系管理员：" + err, "danger", false, 2000, "center");
        }
    });
}

function showCollection(collectionCode) {
    const $collectionItem = $(`#${collectionCode}[data-itemtype="collection"]`);

    // 切换展开/折叠状态
    const isExpanded = $collectionItem.hasClass("expanded");

    if (isExpanded) {
        // 当前是展开状态，执行折叠操作
        $collectionItem.removeClass("expanded");
        $collectionItem.next(".collection-content").slideUp(300, function () {
            $(this).remove(); // 动画结束后移除 DOM 元素
        });
    } else {
        // 当前是折叠状态，执行展开操作
        $collectionItem.addClass("expanded");

        // 添加加载提示
        const loadingHtml = `
      <div class="collection-content" style="display: none;">
        <div class="collection-loading" style="text-align: center; padding: 10px;">
          <i class="fas fa-spinner fa-spin"></i> 加载中...
        </div>
      </div>
    `;
        $collectionItem.after(loadingHtml);
        $collectionItem.next(".collection-content").slideDown(300);

        // 发起 AJAX 请求获取合集内容
        $.ajax({
            type: "Post",
            url: "/Home/GetChatHistoryByCollection",
            dataType: "json",
            data: {
                collectionCode: collectionCode
            },
            success: function (res) {
                const $collectionContent = $collectionItem.next(".collection-content");
                $collectionContent.find(".collection-loading").remove(); // 移除加载提示

                if (res.data.length > 0) {
                    // 构建合集内容 HTML
                    let itemsHtml = "";
                    res.data.forEach(item => {
                        var chat = item.chat.substring(0, 50);
                        if (chat.length > 20) {
                            chat += "...";
                        }
                        //转译尖括号
                        chat = chat.replace(/&lt;/g, "&amp;lt;").replace(/&gt;/g, "&amp;gt;");
                        chat = chat.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        var ctrlBtn = `<span class="delete-chat">
                                 <i data-feather="x" onclick="deleteChat('` + item.chatId + `')"></i>
                               </span>`;
                        if (item.isLock == 1) {
                            ctrlBtn = `<span class="delete-chat text-success">
                                 <i data-feather="unlock" onclick="unLockChat('` + item.chatId + `')"></i>
                               </span>`;
                        }
                        itemsHtml += `<li class="chat-item" id="${item.chatId}" data-chat-id="${item.chatId}" data-istop="${item.isTop}" data-itemtype="chat">
                            <div class="chat-item-body">
                                <div>
                                    <txt>
                                        ${chat}
                                    </txt>
                                </div>
                                <p>
                                    ${isoStringToDateTime(item.createTime)}
                                </p>
                            </div>
                            ${ctrlBtn}
                    </li>`;
                    });

                    // 插入合集内容并添加背景
                    $collectionContent.append(`<ul class="chat-list">${itemsHtml}</ul>`);
                    feather.replace();
                    addChatItemListeners();
                } else {
                    // 数据为空时显示提示
                    $collectionContent.append(`<div style="text-align: center; padding: 10px;">该合集下暂无聊天记录</div>`);
                }

                // 合集内容添加平滑的进入动画
                $collectionContent.find(".chat-list, div").hide().fadeIn(300);
            },
            error: function () {
                // 请求失败时显示错误提示
                const $collectionContent = $collectionItem.next(".collection-content");
                $collectionContent.find(".collection-loading").remove();
                $collectionContent.append(`<div style="text-align: center; padding: 10px; color: red;">加载失败，请稍后重试</div>`);
            }
        });
    }
}

// 滚动监听
$(".chat-sidebar-body").on('scroll', function () {
    if (!isLoading && hasMore && $(this).scrollTop() + $(this).innerHeight() >= $(this)[0].scrollHeight - 20) {
        loadMoreHistory();
    }
});

function addChatItemListeners() {
    $('.chat-item').off('click').on('click', function () {
        var itemtype = $(this).data('itemtype');
        if (!window.isMultipleChoiceMode && itemtype == "chat") {
            showHistoryDetail($(this).attr('id'));
        }
    });

    $('.delete-chat i').off('click').on('click', function (e) {
        e.stopPropagation();
        var itemtype = $(this).attr('itemtype');
        if (itemtype == "chat")
            deleteChat($(this).data('chat-id'));
    });
}

//多项选择
function multipleChoice() {
    // 移除右键菜单
    $('.custom-context-menu').remove();

    // 切换多选模式
    window.isMultipleChoiceMode = !window.isMultipleChoiceMode;

    if (window.isMultipleChoiceMode) {
        // 添加多选操作栏
        var actionsHtml = `
           <div class="multiple-choice-actions p-2 sticky-top">
            <div class="action-container">
                <select id="bulkActionSelect" class="form-control">
                    <option value="delete">删除选中</option>
                    <option value="export">导出选中</option>
                </select>
                <button onclick="executeBulkAction()" class="btn btn-primary btn-sm">
                    <i class="fas fa-check mr-1"></i>执行
                </button>
                <button onclick="cancelMultipleChoice()" class="btn btn-secondary btn-sm">
                    <i class="fas fa-times mr-1"></i>取消
                </button>
            </div>
        </div>`;
        $('.chat-sidebar-body').prepend(actionsHtml);

        // 为每个聊天项添加复选框和样式
        $('.chat-item').each(function () {
            //data-itemtype="chat"才添加
            if ($(this).data('itemtype') != "chat") return;
            $(this).prepend('<div class="custom-control custom-checkbox"><input type="checkbox" class="custom-control-input chat-checkbox" id="checkbox-' + $(this).attr('id') + '"><label class="custom-control-label" for="checkbox-' + $(this).attr('id') + '"></label></div>');
            $(this).css({
                'padding-left': '40px',
                'position': 'relative'
            });
        });

        // 隐藏删除按钮
        if ($(this).data('itemtype') === "chat") {
            $('.delete-chat').hide();
        }
        // 隐藏loadMore
        $('.chat-sidebar-footer').hide();
    } else {
        cancelMultipleChoice();
    }
}

function cancelMultipleChoice() {
    // 移除多选操作栏和复选框
    $('.multiple-choice-actions').remove();
    $('.custom-control').remove();

    // 移除为多选模式添加的样式
    $('.chat-item').css({
        'padding-left': '',
        'position': ''
    });

    // 显示删除按钮
    $('.delete-chat').show();
    // 显示loadMore
    $('.chat-sidebar-footer').show();
    window.isMultipleChoiceMode = false;

    // 重新添加事件监听器
    addChatItemListeners();
}

function executeBulkAction() {
    var action = $('#bulkActionSelect').val();
    var selectedChats = $('.chat-checkbox:checked').map(function () {
        return $(this).closest('.chat-item').attr('id');
    }).get();

    if (selectedChats.length === 0) {
        balert("请选择至少一个对话", "warning", false, 2000, "center");
        return;
    }

    switch (action) {
        case 'delete':
            deteteChoiceChat(selectedChats.join(','));
            break;
        case 'export':
            exportChats(selectedChats.join(','));
            break;
        default:
            balert("请选择一个操作", "warning", false, 2000, "center");
    }
}

//删除单个历史记录
function deleteChat(id) {
    event.stopPropagation();
    if (!processOver && id == chatid) {
        balert("对话进行中,请结束后再试", "warning", false, 2000, "center");
        return;
    }
    showConfirmationModal("提示", "确定删除这条历史记录吗？", function () {
        $.ajax({
            type: "Post", url: "/Home/DelChatHistory", dataType: "json", data: {
                chatId: id
            }, success: function (res) {
                if (res.success) {
                    balert("删除成功", "success", false, 1000, "top");
                    $('[id*="' + id + '"]').remove();
                    if (id == chatid) {
                        chatBody.html("");
                        chatid = "";
                    }
                }
            }, error: function (err) {
                //window.location.href = "/Users/Login";
                balert("删除失败，错误请联系管理员：err", "danger", false, 2000, "center");
            }
        });
    });
}

function deleteCollection(collectionCode) {
    event.stopPropagation();
    showConfirmationModal("提示", "确定删除这个合集吗？注意：合集内的对话记录也会一起删除！", function () {
        $.ajax({
            type: "Post", url: "/Home/DeleteCollection", dataType: "json", data: {
                collectionCode: collectionCode
            }, success: function (res) {
                if (res.success) {
                    balert("删除成功", "success", false, 1000, "top");
                    $('[id*="' + collectionCode + '"]').remove();
                }
            }, error: function (err) {
                //window.location.href = "/Users/Login";
                balert("删除失败，错误请联系管理员：err", "danger", false, 2000, "center");
            }
        });
    });
}

//删除选中的历史记录
function deteteChoiceChat(ids) {
    showConfirmationModal("提示", "确定删除这些历史记录吗？", function () {
        loadingOverlay.show();
        $.ajax({
            type: "Post",
            url: "/Home/DelChoiceChatHistory",
            dataType: "json",
            data: {
                chatIds: ids
            },
            success: function (res) {
                loadingOverlay.hide();
                if (res.success) {
                    balert("删除成功", "success", false, 1000, "top");
                    // 删除成功后，移除对应的聊天项
                    ids.split(',').forEach(id => {
                        $('[id*="' + id + '"]').remove();
                        if (id === chatid) {
                            chatBody.html("");
                            chatid = "";
                        }
                    });
                    cancelMultipleChoice(); // 操作完成后取消多选模式
                }
            },
            error: function (err) {
                loadingOverlay.hide();
                balert("删除失败，错误请联系管理员：" + err, "danger", false, 2000, "center");
            }
        });
    });
}

//导出选中的历史记录并打包成ZIP
function exportChats(ids) {
    $('#exportImage').hide();
    $('#exportModal').modal('show');
    $('#exportMarkdown').off('click').on('click', function () {
        batchExport(ids, "markdown");
        $('#exportModal').modal('hide');
    });
    $('#exportHTML').off('click').on('click', function () {
        // 调用HTML导出逻辑
        batchExport(ids, "html");
        $('#exportModal').modal('hide');
    });
}

//批量导出
function batchExport(ids, type) {
    loadingOverlay.show();
    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/Home/ExportChats", true);
    xhr.responseType = "blob";

    // 获取 JWT Token
    var token = localStorage.getItem('aibotpro_userToken');

    if (token) {
        // 设置 Authorization 头，携带 JWT token
        xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    } else {
        // 如果 token 不存在，跳转到登录页面
        window.location.href = "/Home/Welcome";
        return;
    }

    // 设置请求的 Content-Type
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

    xhr.onload = function () {
        if (xhr.status === 200) {
            // 从 Content-Disposition 头中获取文件名
            var contentDisposition = xhr.getResponseHeader('Content-Disposition');
            var filename = "chat_exports.zip";

            if (contentDisposition && contentDisposition.indexOf('attachment') !== -1) {
                var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                var matches = filenameRegex.exec(contentDisposition);
                if (matches !== null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            var blob = xhr.response;
            var url = window.URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            loadingOverlay.hide();
            a.click();
            setTimeout(function () {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 0);
        } else {
            loadingOverlay.hide();
            balert("导出失败", "danger", false, 1500, "center");
            sendExceptionMsg(`【API：/Home/ExportChats】:${xhr.statusText}`);
        }
    };

    xhr.onerror = function () {
        loadingOverlay.hide();
        balert("导出失败", "danger", false, 1500, "center");
        sendExceptionMsg(`【API：/Home/ExportChats】:${xhr.statusText}`);
    };

    var data = `chatIds=${encodeURIComponent(ids)}&type=${encodeURIComponent(type)}`;
    xhr.send(data);
}

//删除所有历史记录
function deleteChatAll() {
    showPromptModal("提示", `请输入<b style="color:red;">“justdoit”</b>以删除全部历史记录<br/>`, function (text) {
        if (text == "justdoit") {
            $.ajax({
                type: "Post", url: "/Home/DelChatHistory", dataType: "json", data: {
                    chatId: ''
                }, success: function (res) {
                    if (res.success) {
                        balert("删除成功", "success", false, 1000, "top");
                        chatBody.html("");
                        $(".chat-list").html("");
                        chatid = "";
                    }
                }, error: function (err) {
                    //window.location.href = "/Users/Login";
                    balert("删除失败，错误请联系管理员：err", "danger", false, 2000, "center");
                }
            });
        } else {
            balert("输入错误，请重新输入", "danger", false, 500, "top", function () {
                deleteChatAll();
            });
        }
    })
}

//删除消息组
function deleteChatGroup(id, type) {
    //showConfirmationModal("提示", "确定删除这条记录吗？", function () {
    $.ajax({
        type: "Post", url: "/Home/DelChatGroup", dataType: "json", data: {
            groupId: id,
            type: type
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
    //});
}

//显示AI对话详情
function showHistoryDetail(id) {
    if (!processOver) {
        balert("对话进行中,请结束后再试", "warning", false, 2000);
        return;
    }
    chatBody.html(`<li class="divider-text">
                        加载中...
                    </li>`);
    $(".chat-item").removeClass("highlight-chat-item").addClass("reset-chat-item");
    $('[id="' + id + '"]').addClass("highlight-chat-item");
    mobileChat(true);
    $.ajax({
        type: "Post",
        url: "/Home/ShowHistoryDetail",
        dataType: "json",
        data: {
            chatId: id
        },
        success: function (res) {
            //console.log(res);
            chatid = id;
            var html = "";
            var isvip = false;
            var hisModelName = thisAiModel;
            var hisModelNick = thisAiModelNick;
            isVIP(function (status) {
                isvip = status;
            });
            var vipHead = isvip ? `<div class="avatar" style="border:2px solid #FFD43B">
                                 <img src='${HeadImgPath}'/>
                                 <i class="fas fa-crown vipicon"></i>
                             </div>
                             <div class="nicknamevip">${UserNickText}</div>` : `<div class="avatar">
                                 <img src='${HeadImgPath}'/>
                             </div>
                             <div class="nickname">${UserNickText}</div>`;
            var imgBox = [];
            for (var i = 0; i < res.data.length; i++) {
                var content = res.data[i].chat;
                var msgclass = "chat-message";
                if (res.data[i].isDel === 2)
                    msgclass = "chat-message chatgroup-masked";
                if (res.data[i].role == "user") {
                    if (content.indexOf('aee887ee6d5a79fdcmay451ai8042botf1443c04') == -1) {
                        content = content.replace(/&lt;/g, "&amp;lt;").replace(/&gt;/g, "&amp;gt;");
                        content = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        html += `<div class="${msgclass}" data-group="` + res.data[i].chatGroupId + `">
                                     <div style="display: flex; align-items: center;">
                                       ${vipHead}
                                     </div>
                                     <div class="chat-message-box">
                                       <pre id="` + res.data[i].chatCode + `">${content}</pre>
                                     </div>
                                     <div>
                                      <i data-feather="refresh-cw" class="chatbtns" onclick="tryAgain('` + res.data[i].chatCode + `')"></i>
                                      <i data-feather="edit-3" class="chatbtns" onclick="editChat('` + res.data[i].chatCode + `')"></i>
                                     </div>
                                 </div>`;
                    } else {
                        var contentarr = content.split("aee887ee6d5a79fdcmay451ai8042botf1443c04");
                        html += `<div class="${msgclass}" data-group="${res.data[i].chatGroupId}">
                                   <div style="display: flex; align-items: center;">
                                      ${vipHead}
                                   </div>
                                   <div class="chat-message-box">
                                     <pre id="${res.data[i].chatCode}">${contentarr[0].replace(/</g, "&lt;").replace(/>/g, "&gt;")}`;
                        // 循环添加后续内容
                        contentarr.slice(1).forEach(item => {
                            if (item.includes('<img ')) {
                                // 直接把图片HTML添加到<pre>中，假设item是一串完整的<img>标签
                                html += item;  // 添加图片的 HTML 到 <pre> 中
                            } else {
                                // 非图片内容也添加到<pre>，转义以便合理显示
                                html += item.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                            }
                        });
                        html += `</pre></div>
                                   <div>
                                     <i data-feather="refresh-cw" class="chatbtns" onclick="tryAgain('${res.data[i].chatCode}')"></i>
                                     <i data-feather="edit-3" class="chatbtns" onclick="editChat('${res.data[i].chatCode}')"></i>
                                   </div>
                                 </div>`;
                        imgBox.push(res.data[i].chatCode);
                    }
                } else {
                    var item = {
                        "id": res.data[i].chatCode,
                        "markdown": content
                    };
                    let thinkMatches = [];
                    let normalContent = content;
                    const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
                    let match;
                    while ((match = thinkRegex.exec(content)) !== null) {
                        if (!thinkMatches.includes(match[1])) {
                            thinkMatches.push(match[1]);
                        }
                    }
                    // 从 normalContent 中移除所有成对的 <think> 标签内容
                    normalContent = normalContent.replace(thinkRegex, '');
                    // 处理未闭合的 <think> 标签（例如只有 <think> 而没有 </think> 的情况）
                    const unfinishedThinkRegex = /<think>([\s\S]*)$/g;
                    if ((match = unfinishedThinkRegex.exec(normalContent)) !== null) {
                        if (!thinkMatches.includes(match[1])) {
                            thinkMatches.push(match[1]);
                        }
                        normalContent = normalContent.replace(unfinishedThinkRegex, '');
                    }
                    const thinkContent = thinkMatches.join("\n");

                    markdownHis.push(item);
                    var markedcontent = md.render(normalContent);
                    var encoder = new TextEncoder();
                    //<span class="badge badge-pill badge-success" id="${msgid_g}_timer_first"></span>
                    //   <span class="badge badge-pill badge-dark" id="${msgid_g}_timer_alltime"></span>
                    var firstTime = '';
                    var allTime = '';
                    if (res.data[i].firstTime != "null" && res.data[i].allTime != "null" && res.data[i].firstTime != null && res.data[i].allTime != null) {
                        firstTime = `<span class="badge badge-pill badge-success">${res.data[i].firstTime}s</span>`;
                        allTime = `<span class="badge badge-pill badge-dark">${res.data[i].allTime}s</span>`;
                        if (res.data[i].firstTime > 10) {
                            firstTime = `<span class="badge badge-pill badge-danger">${res.data[i].firstTime}s</span>`;
                        } else if (res.data[i].firstTime > 5) {
                            firstTime = `<span class="badge badge-pill badge-warning">${res.data[i].firstTime}s</span>`;
                        }
                    }
                    let thinkBoxHtml = '';
                    if (thinkContent) {
                        thinkBoxHtml = `<details><summary>AI 思考结束（点击展开）</summary>
                                            <div class="think-content">${md.render(thinkContent)}</div>
                                        </details>`;
                    }
                    html += `<div class="${msgclass}" data-group="` + res.data[i].chatGroupId + `">
                                 <div style="display: flex; align-items: center;">
                                    <div class="avatar  gpt-avatar">${roleAvatar}</div>
                                    <div class="nickname" style="font-weight: bold; color: black;">${roleName}</div>
                                    <span class="badge badge-info ${res.data[i].model.replace('.', '')}">${res.data[i].model}</span>
                                    ${firstTime}${allTime}
                                 </div>
                                 ${thinkBoxHtml}
                                <div class="chat-message-box">
                                    <div id="${res.data[i].chatCode}">${markedcontent}</div>
                                </div>
                                <div id="ctrl-${res.data[i].chatCode}">
                                  <i data-feather="copy" class="chatbtns" data-toggle="tooltip" title="复制" onclick="copyAll('${res.data[i].chatCode}')"></i>
                                  <i data-feather="anchor" class="chatbtns" data-toggle="tooltip" title="锚" onclick="quote('${res.data[i].chatCode}')"></i>
                                  <i data-feather="trash-2" class="chatbtns custom-delete-btn-1" data-toggle="tooltip" title="删除" data-chatgroupid="${res.data[i].chatGroupId}"></i>
                                  <i data-feather="cpu" class="chatbtns" data-toggle="tooltip" title="存入记忆" onclick="saveMemory('${res.data[i].chatGroupId}','${chatid}')"></i>
                                  <i data-feather="codepen" class="chatbtns" data-toggle="tooltip" title="显示/隐藏Markdown" onclick="toMarkdown('${res.data[i].chatCode}')"></i>
                                </div>
                            </div>`;
                    hisModelName = res.data[i].model;
                }
            }
            chatBody.html(html).hide().fadeIn(300);
            if (autoChange && hisModelName !== thisAiModel) {
                const matchedModel = modelList.find(model => model.model === hisModelName);
                if (matchedModel) {
                    changeModel(hisModelName, matchedModel.modelNick);
                } else {
                    changeModel(thisAiModel, thisAiModelNick);
                }
            }
            //MathJax.typeset();
            //MathJax.startup.promise = MathJax.startup.promise
            //    .then(() => MathJax.typesetClear())
            //    .then(() => MathJax.typesetPromise(document.querySelectorAll('.chat-body-content')))
            //    .catch((err) => console.log("Typeset failed: ", err));
            $(".chat-message pre code").each(function (i, block) {
                hljs.highlightElement(block);
            });
            addLanguageLabels();
            addCopyBtn();
            addExportButtonToTables();
            feather.replace();
            $('[data-toggle="tooltip"]').tooltip();
            applyMagnificPopup('.chat-message-box');
            imgBox.forEach(item => initImageFolding(`#${item}`));
            createMaskedOverlays();
            renderMermaidDiagrams();
            // 滚动到最底部
            chatBody.scrollTop(chatBody[0].scrollHeight);
            loadingOverlay.hide();
            //bindLinkPreview('.chat-message-box', '#previewBox');
        },
        error: function (err) {
            loadingOverlay.hide();
            //window.location.href = "/Users/Login";
            balert("获取对话详情失败，请联系管理员：err", "danger", false, 2000, "center");
        }
    });
}


function toMarkdown(id) {
    const targetElement = document.getElementById(id);
    if (!targetElement) return;

    // 查找对应的 markdown 内容
    const item = markdownHis.find(element => element.id === id);
    const markdownContent = item ? item.markdown : '';

    // 检查是否为移动端
    if (isMobile()) {
        // 移动端：切换内容显示
        if (targetElement.getAttribute('data-showing-markdown') === 'true') {
            // 如果正在显示 Markdown，切换回原始 HTML
            targetElement.innerHTML = targetElement.getAttribute('data-original-content');
            targetElement.removeAttribute('data-showing-markdown');
        } else {
            // 如果显示原始 HTML，切换到 Markdown
            targetElement.setAttribute('data-original-content', targetElement.innerHTML);

            // 创建一个隐藏的 textarea 来保存 Markdown 内容
            const hiddenTextarea = document.createElement('textarea');
            hiddenTextarea.style.display = 'none';
            hiddenTextarea.value = markdownContent;

            // 创建一个 pre 元素来显示 Markdown 内容
            const preElement = document.createElement('pre');
            preElement.textContent = markdownContent;
            preElement.style.whiteSpace = 'pre-wrap';
            preElement.style.wordWrap = 'break-word';

            targetElement.innerHTML = '';
            targetElement.appendChild(hiddenTextarea);
            targetElement.appendChild(preElement);
            targetElement.setAttribute('data-showing-markdown', 'true');
        }
        return;
    }

    // 桌面端：显示编辑器
    const existingEditor = targetElement.querySelector('.markdown-editor');
    if (existingEditor) {
        // 如果编辑器已存在，则移除它（切换功能）
        targetElement.innerHTML = targetElement.getAttribute('data-original-content');
        targetElement.removeAttribute('data-showing-markdown');
        return;
    }

    // 保存原始内容
    targetElement.setAttribute('data-original-content', targetElement.innerHTML);
    targetElement.setAttribute('data-showing-markdown', 'true');

    // 创建编辑器容器
    const editorContainer = document.createElement('div');
    editorContainer.className = 'markdown-editor';
    editorContainer.style.display = 'flex';
    editorContainer.style.flexDirection = 'column';
    editorContainer.style.height = '600px';

    // 创建编辑区域容器
    const editorAreaContainer = document.createElement('div');
    editorAreaContainer.style.display = 'flex';
    editorAreaContainer.style.flex = '1';

    // 创建左侧编辑区
    const editArea = document.createElement('textarea');
    editArea.className = 'markdown-edit-area';
    editArea.value = markdownContent;
    editArea.style.width = '50%';
    editArea.style.height = '100%';
    editArea.style.resize = 'none';

    // 创建右侧预览区
    const previewArea = document.createElement('div');
    previewArea.className = 'markdown-preview-area';
    previewArea.style.width = '50%';
    previewArea.style.height = '100%';
    previewArea.style.overflow = 'auto';
    previewArea.style.padding = '10px';
    previewArea.style.boxSizing = 'border-box';

    // 创建 markdown-it 实例
    const md = window.markdownit({
        highlight: function (str, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return '<pre class="hljs"><code>' +
                        hljs.highlight(lang, str, true).value +
                        '</code></pre>';
                } catch (__) {
                }
            }
            return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
        }
    });

    // 更新预览函数
    function updatePreview() {
        const renderedHTML = md.render(editArea.value);
        previewArea.innerHTML = renderedHTML;

        // 高亮代码块
        previewArea.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }

    // 初始更新预览
    updatePreview();

    // 添加实时预览
    editArea.addEventListener('input', updatePreview);

    // 组装编辑器
    editorAreaContainer.appendChild(editArea);
    editorAreaContainer.appendChild(previewArea);
    editorContainer.appendChild(editorAreaContainer);

    // 替换目标元素的内容
    targetElement.innerHTML = '';
    targetElement.appendChild(editorContainer);

    // 滚动到编辑器位置
    targetElement.scrollIntoView({behavior: 'smooth', block: 'nearest'});
}


//新建会话
function newChat() {
    if (!processOver) {
        balert("对话进行中,请结束后再试", "warning", false, 2000);
        return;
    }
    mobileChat(true);
    chatid = "";
    chatgroupid = "";
    chatBody.html("");
    $(".chat-item").removeClass("highlight-chat-item");
    $("#Q").focus();
    if (sysmodel == "aicanver") {
        var html = `<div class="aicanver-chat-container">
                        <div class="aicanver-message aicanver-ai-message">
                            <div id="aicanverTip">
                                <i data-feather="info"></i> 您可以在这里针对右侧代码提出问题，我将为您进行针对性修改👉
                                <br/>
                                如果您没有现存的代码或文本文件，您依旧可以对我直接提问，我将为您将代码显示在右侧编辑器👉
                            </div>
                        </div>
                    </div>`
        $('#aicanverChatBox').html(html);
        feather.replace();
    }
}

//加载更多历史记录
function loadMoreHistory() {
    pageIndex++;
    getHistoryList(pageIndex, pageSize, false, true, $("#searchKey").val().trim());
}

//停止生成
function stopGenerate() {
    if (!stream) {
        balert("非流式请求，无法中断对话", "danger", false, 2000, "center");
        return;
    }
    processOver = true;
    $("#sendBtn").html(`<i data-feather="send"></i>`);
    $("#sendBtn").removeClass("text-danger");
    $('.LDI').remove();
    //$("#" + assistansBoxId).html(marked(completeMarkdown(sysmsg)));
    //MathJax.typeset();
    if (sysmodel == "aicanver") {
        handleAicanverContent(sysmsg, assistansBoxId, processOver);
        var newCode = monacoEditor.getValue();
        highlightChanges(oldCode, newCode, monacoEditor);
    } else {
        if (sysmsg != '')
            $("#" + assistansBoxId).html(md.render(sysmsg));
        $("#ctrl-" + assistansBoxId).show();
        feather.replace();
        stopTimer(`#${assistansBoxId}_timer_first`);
        stopTimer(`#${assistansBoxId}_timer_alltime`);
        $("#" + assistansBoxId + " pre code").each(function (i, block) {
            hljs.highlightElement(block);
        });
        addLanguageLabels(true, assistansBoxId);
        addCopyBtn(assistansBoxId);
    }
    $.ajax({
        type: "Post", url: "/Home/StopGenerate", dataType: "json", data: {
            chatId: chatgroupid
        }, success: function (res) {
            getUserInfo();
        }, error: function (err) {
            //window.location.href = "/Users/Login";
            balert("出现了一些未经处理的异常，请联系管理员", "danger", false, 2000, "center", function () {
                sendExceptionMsg(err.toString());
            });
        }
    });
}

//图片上传
$('body').on('click', '.popup-item', function () {
    var type = $(this).data('type');
    var $fileInput = $('#uploadImg');
    if (type == "camera") {
        $fileInput.attr('capture', 'environment');
        $fileInput.click();
    } else if (type == "upload") {
        $fileInput.removeAttr("capture");
        $fileInput.click();
    }
});

$("#uploadImg").on('change', function (e) {
    var destroyAlert = balert(`<i data-feather="loader" style="width:20px;"></i> 正在上传...`, "info", false, 0, "center");
    uploadIMGFile(e.target.files[0], destroyAlert);
});

function uploadIMGFile(file, destroyAlert) {
    if (image_path.length >= 4) {
        destroyAlert();
        balert("最多只能上传4张图片", "warning", false, 2000, "center");
        return;
    }

    if (!file.type.startsWith('image/')) {
        destroyAlert();
        balert("请选择图片文件", "warning", false, 2000, "center");
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        destroyAlert();
        balert("图片文件大小不能超过5M", "warning", false, 2000, "center");
        return;
    }

    var formData = new FormData();
    formData.append("file", file);
    formData.append("thisAiModel", thisAiModel);
    feather.replace();

    $.ajax({
        url: "/Home/SaveImg",
        type: "post",
        data: formData,
        contentType: false,
        processData: false,
        success: function (res) {
            destroyAlert();
            if (res.success) {
                // 检查是否已存在相同路径的图片
                if (!image_path.includes(res.data)) {
                    image_path.push(res.data);
                    balert("上传成功", "success", false, 800, "center");
                }
                reviewImg(image_path);
            } else {
                ClearImg();
            }
        },
        error: function (e) {
            sendok = true;
            console.log("失败" + e);
        }
    });
}

//预览图片
function reviewImg(paths) {
    $('.preview-img').attr('src', '');
    $('.img-container').hide();
    let uniquePaths = [...new Set(paths)]; // 去重
    image_path = uniquePaths;
    for (let i = 0; i < uniquePaths.length && i < 4; i++) {
        $('.preview-img').eq(i).attr('src', uniquePaths[i].replace("wwwroot", ""));
        $('.img-container').eq(i).show();
    }
    applyMagnificPopup('.img-container');
    $('.imgViewBox').show();
    updateRedDot(uniquePaths.length)
}


//更新红点数字或隐藏
function updateRedDot(num) {
    var imageCount = $("#imageCount");
    if (num > 0) {
        imageCount.text(num);
        imageCount.show();
    } else {
        imageCount.hide();
    }
}

// 清除图片
function ClearImg() {
    image_path = [];
    var $img = $('.preview-img');
    $img.attr('src', '').removeClass('magnified');
    if ($img.parent().is('a')) {
        $img.unwrap();
    }
    $('.img-container').hide();
    $('.imgViewBox').hide();
    updateRedDot(0);
}

// 删除单个图片
function deleteImage(index) {
    let uniquePaths = [...new Set(image_path)]; // 去重
    let deletedPath = uniquePaths[index];
    image_path = image_path.filter(path => path !== deletedPath);
    reviewImg(image_path);
    if (image_path.length === 0) {
        $('.imgViewBox').hide();
    }
}

// 添加事件监听器
$(document).ready(function () {
    $('.delete-btn').on('click', function () {
        var index = $(this).parent().index();
        deleteImage(index);
    });
    $('#loadMoreBtn').on('click', function () {
        loadingBtn("#loadMoreBtn");
        getFiles('loadmore');
    });
});


//遍历添加复制按钮
function addCopyBtn(id = '') {
    var codebox;
    if (id != '') {
        codebox = $('#' + id + ' pre code.hljs, #' + id + ' pre code[class^="language-"]');
    } else {
        codebox = $('pre code.hljs, pre code[class^="language-"]');
    }

    codebox.each(function () {
        var codeBlock = $(this);

        var copyContainer = $('<div>').addClass('copy-container').css({
            'text-align': 'right',
            'background-color': 'rgb(40,44,52)',
            'padding': '4px',
            'display': 'block',
            'color': 'rgb(135,136,154)',
            'cursor': 'pointer'
        });

        // 复制按钮
        var copyBtn = $('<span>').addClass('copy-btn').attr('title', 'Copy to clipboard');
        copyBtn.html(feather.icons.clipboard.toSvg());

        // 编辑器按钮
        var editBtn = $('<span>').addClass('edit-btn').attr('title', 'Open in editor').css({
            'margin-right': '10px'
        });
        editBtn.html(feather.icons.code.toSvg());

        if ($(this).parent().find('.copy-btn').length === 0) {
            if (!isMobile())
                copyContainer.append(editBtn); // 先添加编辑按钮
            copyContainer.append(copyBtn);  // 再添加复制按钮
            codeBlock.parent().append(copyContainer);
        }

        // 复制按钮点击事件
        copyBtn.click(function () {
            var codeToCopy = codeBlock.text();
            var tempTextArea = $('<textarea>').appendTo('body').val(codeToCopy).select();
            document.execCommand('copy');
            tempTextArea.remove();
            balert("复制成功", "success", false, 1000, "top");
        });

        // 编辑器按钮点击事件
        editBtn.click(async function () {
            var codeContent = codeBlock.text();
            // 获取代码语言
            var lang = '';
            var classes = codeBlock.attr('class').split(' ');
            for (var i = 0; i < classes.length; i++) {
                if (classes[i].startsWith('language-')) {
                    lang = classes[i].replace('language-', '');
                    break;
                }
            }

            // 调用创建编辑器和设置内容的函数
            newChat();
            await createCanver(lang);
            setEditorContent(lang, codeContent, false, true);
        });
    });
}

function copyAll(id) {
    //复制全部text
    var codeToCopy = $("#" + id).text();
    var tempTextArea = $('<textarea>').appendTo('body').val(codeToCopy).select(); // 创建临时的 textarea 并选中文本
    document.execCommand('copy'); // 执行复制操作
    tempTextArea.remove(); // 移除临时创建的 textarea
    balert("复制成功", "success", false, 1000, "top");
}

//重试
function tryAgain(id) {
    var $elem = $("#" + id);
    // 检查是否存在<img>标签
    if ($elem.find("img").length > 0) {
        // 如果存在，遍历所有找到的<img>标签
        $elem.find("img").each(function () {
            // 为每个<img>标签提取src属性
            var imgSrc = $(this).attr("src");
            if (isURL(imgSrc))
                image_path.push(imgSrc);
            else
                image_path.push("wwwroot" + imgSrc);
            $Q.val($elem.text());
        });
        reviewImg(image_path);
    } else {
        $Q.val($elem.text());
    }
    sendMsg();
}

//编辑
function editChat(id) {
    var $elem = $("#" + id);
    // 检查是否存在<img>标签
    if ($elem.find("img").length > 0) {
        // 如果存在，遍历所有找到的<img>标签
        $elem.find("img").each(function () {
            // 为每个<img>标签提取src属性
            var imgSrc = $(this).attr("src");
            if (isURL(imgSrc))
                image_path.push(imgSrc);
            else
                image_path.push("wwwroot" + imgSrc);
            $Q.val($elem.text());
        });
        reviewImg(image_path);
    } else {
        $Q.val($elem.text());
    }
    adjustTextareaHeight();
}

//引用
function quote(id) {
    var $elem = $("#" + id);
    // 检查是否存在<img>标签
    if ($elem.find("img").length > 0) {
        // 如果存在，遍历所有找到的<img>标签
        $elem.find("img").each(function () {
            // 为每个<img>标签提取src属性
            var imgSrc = $(this).attr("src");
            if (isURL(imgSrc))
                image_path.push(imgSrc);
            else
                image_path.push("wwwroot" + imgSrc);
            $Q.val("回复：" + $elem.text());
        });
        reviewImg(image_path);
    } else {
        $Q.val("回复： " + $elem.text() + "\n\n");
    }
    $Q.focus();
    adjustTextareaHeight();
}

//记忆
function saveMemory(chatgroupId, chatId) {
    loadingOverlay.show();
    $.ajax({
        url: "/Home/SaveMemory", type: "post", dataType: "json",//返回对象
        data: {
            chatgroupId: chatgroupId, chatId: chatId
        }, success: function (res) {
            loadingOverlay.hide();
            if (res.success) balert("保存成功", "success", false, 1000); else balert("保存失败", "danger", false, 1000);
        }, error: function (err) {
            loadingOverlay.hide();
            balert("保存失败", "danger", false, 1000);
        }
    });
}

//----------------------通用函数----------------------
function adjustTextareaHeight() {
    if (max_textarea) return;
    if (sysmodel == 'chat') {
        const contentElement = $(".chat-body-content");
        const footerElement = $(".chat-body-footer");
        const initialContentHeight = contentElement.css("height");
        const initialFooterHeight = footerElement.outerHeight();

        textarea.style.height = 'auto';
        let scrollHeight = textarea.scrollHeight;

        if (scrollHeight > 200) {
            textarea.style.height = "200px";
        } else {
            textarea.style.height = scrollHeight + "px";
        }

        // 计算 footer 高度的变化
        const newFooterHeight = footerElement.outerHeight();
        const footerHeightDiff = newFooterHeight - initialFooterHeight;

        // 只有当 footer 高度发生变化时才调整 content 高度
        if (footerHeightDiff !== 0) {
            const currentContentHeight = contentElement.outerHeight();
            const newContentHeight = currentContentHeight - footerHeightDiff;
            contentElement.css("height", newContentHeight + "px");
        } else {
            contentElement.css("height", initialContentHeight);
        }
    }
}

// 绑定input事件
textarea.addEventListener("input", adjustTextareaHeight);
// 绑定keyup事件
textarea.addEventListener("keyup", adjustTextareaHeight);
//绑定change事件
textarea.addEventListener("change", adjustTextareaHeight);

// function getNotice() {
//     //发起请求
//     $.ajax({
//         url: "/Home/GetNotice", type: "post", dataType: "json",//返回对象
//         success: function (res) {
//             if (res.success) {
//                 $("#notice-box").html(res.data);
//             }
//         }
//     });
// }

function defaultSeniorSetting() {
    updateDefaultSeniorSetting('#temperatureSlider', '#temperatureValue', 1);
    updateDefaultSeniorSetting('#frequencyPenaltySlider', '#frequencyPenaltyValue', 0);
    updateDefaultSeniorSetting('#presencePenaltySlider', '#presencePenaltyValue', 0);
    updateDefaultSeniorSetting('#maxTokensSlider', '#maxTokensValue', 4095, true);
}

function updateDefaultSeniorSetting(sliderId, displayId, value, isInt = false) {
    value = isInt ? parseInt(value) : parseFloat(value).toFixed(2);
    $(displayId).text(value);
    $(sliderId).val(value);
    localStorage.setItem(displayId.replace('#', ''), value);
}

$(document).ready(function () {
    let unreadCount = 0;
    const $notificationCount = $('.notification-count');
    const $bellContainer = $('.bell-container');
    const $bell = $('.bell');
    const $closeBtn = $('.close-btn-bell');
    const $notificationDot = $('.notification-dot');
    const $notificationDropdown = $('.notification-dropdown');
    const $notificationList = $('.notification-list');
    getNoticeList();

    function receiveNewMessage(message) {
        unreadCount++;
        updateNotificationDot();
        addNotificationToList(message);
    }

    function updateNotificationDot() {
        if (unreadCount > 0) {
            $notificationDot.show();
            $notificationCount.text(unreadCount > 99 ? '99+' : unreadCount);
        } else {
            $notificationDot.hide();
        }
    }

    function addNotificationToList(notice) {
        const formattedTime = isoStringToDateTime(notice.createTime);
        const unreadClass = notice.isRead ? '' : 'unread';
        const unreadIndicator = notice.isRead ? '' : '<span class="unread-indicator"></span>';

        $notificationList.prepend(`
            <div class="notification-item ${unreadClass}" data-id="${notice.id}">
                <div class="notification-content">
                    <p class="mb-0" data-content="${encodeBase64(notice.noticeContent)}">${notice.noticeTitle}</p>
                    <small class="text-muted">${formattedTime}</small>
                </div>
                ${unreadIndicator}
            </div>
        `);
    }

    // 添加点击事件监听器
    $notificationList.on('click', '.notification-item', function () {
        $notificationDropdown.hide();
        const $item = $(this);
        const id = $item.data('id');
        const content = $item.find('p').data('content');
        if ($item.hasClass('unread')) {
            readNotice(id, content);
            $item.removeClass('unread');
            $item.find('.unread-indicator').remove();
        } else {
            showConfirmationModal("通知详情", decodeBase64(content));
        }
    });

    function adjustDropdownPosition() {
        const windowWidth = $(window).width();
        const dropdownWidth = $notificationDropdown.outerWidth();
        const bellRect = $bell[0].getBoundingClientRect();
        const containerRect = $bellContainer[0].getBoundingClientRect();

        if (windowWidth <= 576) {
            // 移动端：靠左对齐
            $notificationDropdown.css({left: '-100px', right: '0'});
        } else {
            // PC端：靠右对齐
            const rightPosition = containerRect.right - bellRect.right;
            $notificationDropdown.css({left: '0', right: '-100px'});

            // 确保下拉框不会超出屏幕左侧
            const leftEdge = bellRect.left + bellRect.width - dropdownWidth;
            if (leftEdge < 0) {
                $notificationDropdown.css({left: '0', right: 'auto'});
            }
        }
    }


    $bell.click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        $notificationDropdown.toggle();
        if ($notificationDropdown.is(':visible')) {
            adjustDropdownPosition();
        }
    });
    $closeBtn.click(function (e) {
        e.preventDefault();
        e.stopPropagation();
        $notificationDropdown.toggle();
        if ($notificationDropdown.is(':visible')) {
            adjustDropdownPosition();
        }
    });
    $(document).click(function (e) {
        if (!$(e.target).closest('.bell-container').length) {
            $notificationDropdown.hide();
        }
    });

    $notificationDropdown.click(function (e) {
        e.stopPropagation();
    });

    $(window).on('resize', adjustDropdownPosition);

    // 获取消息列表
    function getNoticeList() {
        $.ajax({
            url: "/Home/GetNoticeList",
            type: "post",
            dataType: "json",
            success: function (res) {
                if (res.success) {
                    $notificationList.empty(); // 清空现有列表
                    unreadCount = 0; // 重置未读计数

                    res.notices.forEach(notice => {
                        addNotificationToList(notice);
                        if (!notice.isRead) {
                            unreadCount++;
                        }
                    });

                    updateNotificationDot();
                    if (unreadCount > 0) {
                        $notificationDropdown.toggle();
                        if ($notificationDropdown.is(':visible')) {
                            adjustDropdownPosition();
                        }
                    }
                } else {
                    console.error("Failed to fetch notices");
                }
            },
            error: function (xhr, status, error) {
                console.error("Error fetching notices:", error);
            }
        });
    }

    function readNotice(id, content) {
        $.ajax({
            url: "/Home/ReadNotice",
            type: "post",
            data: {
                id: id
            },
            dataType: "json",
            success: function (res) {
                if (res.success) {
                    // 更新未读消息数量
                    unreadCount--;
                    updateNotificationDot();
                    showConfirmationModal("通知详情", decodeBase64(content));
                } else {
                    console.error("Failed to mark notice as read");
                }
            },
            error: function (xhr, status, error) {
            }
        })
    }
});


function toggleSignInDropdown() {
    const dropdown = document.getElementById('signInDropdown');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

// 点击其他地方关闭下拉框
document.addEventListener('click', function (event) {
    const container = document.querySelector('.dropdown-container');
    if (!container.contains(event.target)) {
        document.getElementById('signInDropdown').style.display = 'none';
    }
});

function isVIPbyUserInfo() {
    //发起请求
    $.ajax({
        url: "/Users/IsVIP",
        type: "post",
        dataType: "json",//返回对象
        success: function (res) {
            loadingOverlay.hide();
            if (res.success) {
                vipPrice = res.data[0].vipType.split('|')[1];
                vipEndDate = res.data[0].endTime
                $('#isvip').show();
                $('#vipendtime').html(`<span>${isoStringToDateTime(res.data[0].endTime)}</span> <span class="badge badge-pill badge-warning" style="cursor:pointer" onclick="vipToBalance()">会员时长兑换余额</span>`);
            } else {
                $('#isvip').hide();
                $('#vipendtime').html('<span>未开通</span> <a href="/Pay/VIP" class="text-success">点击前往开通VIP</a>');
            }
        }
    });
}

function signIn() {
    //发起请求
    loadingBtn('.signInBtn');
    $.ajax({
        url: "/Users/SignIn", type: "post", dataType: "json",//返回对象
        success: function (res) {
            unloadingBtn('.signInBtn');
            if (res.success) {
                balert(res.msg, 'success', false, 1500, 'center');
                const now = moment();
                const today = now.date();
                const currentMonth = now.month();
                const currentYear = now.year();

                $(`.calendar-day`).filter(function () {
                    const dayText = $(this).text().trim();
                    return dayText === today.toString() && $(this).closest('.calendar').find('.calendar-header').text().includes(`${currentYear}年${currentMonth + 1}月`);
                }).addClass('active animate__animated animate__rubberBand');
                getUserInfo();
                $('.signInBtn').prop('disabled', true).text('今日已签到').css('cursor', 'not-allowed');
            } else {
                balert(res.msg, 'danger', false, 1500, 'center');
            }
        }
    });
}

function getThisMonthSignInList() {
    $.ajax({
        url: "/Users/GetThisMonthSignInList", type: "post", dataType: "json", success: function (res) {
            if (res.success && res.data && Array.isArray(res.data)) {
                var isTodaySigned = false;
                var today = new Date();
                var currentYear = today.getFullYear();
                var currentMonth = today.getMonth();
                var currentDay = today.getDate();
                $('.calendar-header').text(`${currentYear}年${currentMonth + 1}月`);
                // 清除所有之前的 'active' 类
                $('.calendar-day').removeClass('active animate__animated animate__rubberBand');
                res.data.forEach(function (dateString) {
                    var date = new Date(dateString);
                    var day = date.getDate();

                    // 使用日期数字来选择元素
                    $(`.calendar-day:contains('${day}')`)
                        .filter(function () {
                            // 确保我们只选择exact match，避免选中包含这个数字的其他元素
                            return $(this).text().trim() === day.toString();
                        })
                        .addClass('active animate__animated animate__rubberBand');

                    if (date.getFullYear() === currentYear && date.getMonth() === currentMonth && day === currentDay) {
                        isTodaySigned = true;
                    }
                });

                if (isTodaySigned) {
                    $('.signInBtn').prop('disabled', true).text('今日已签到').css('cursor', 'not-allowed');
                } else {
                    toggleSignInDropdown();
                }
            }
        }
    });
}

function changeGlobe() {
    globe = !globe; // 切换状态

    const $globeSpan = $('.t-globe');

    if (globe) {
        $globeSpan.removeClass('badge-secondary').addClass('badge-success'); // 切换背景色
        $globeSpan.html('<i data-feather="globe"></i> 联网已启用'); // 更新文本
        balert("联网已启用", "success", false, 1500, "top");
    } else {
        $globeSpan.removeClass('badge-success').addClass('badge-secondary'); // 切换背景色
        $globeSpan.html('<i data-feather="globe"></i> 联网关闭'); // 更新文本
        balert("联网已关闭", "info", false, 1500, "top");
    }
}