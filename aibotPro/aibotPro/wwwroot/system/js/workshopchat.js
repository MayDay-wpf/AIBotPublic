var max_textarea = false;
var textarea = document.getElementById("Q");
var $Q = $("#Q");
var chatBody = $(".chat-body-main");
var thisAiModel = "gpt-4o-mini-CYGF"; //当前AI模型
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
var markdownHis = [];
let roleAvatar = 'A';
let roleName = "AIBot";
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
        console.log('与工坊服务器握手成功 :-)'); // 与服务器握手成功
    })
    .catch(function (error) {
        console.log('与工坊服务器握手失败 :-( 原因: ' + error); // 与服务器握手失败
        sendExceptionMsg('与工坊服务器握手失败 :-( 原因: ' + error);
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
    console.log(`由于错误"${error}"失去连接。正在尝试重新连接工坊。`);
    // Here you might want to inform the user that the connection is being reattempted.
});

connection.onreconnected((connectionId) => {
    console.assert(connection.state === signalR.HubConnectionState.Connected);
    console.log(`工坊连接已重新建立。已连接到connectionId为"${connectionId}"。`);
    // Here you might want to inform the user that the connection has been successfully reestablished.
});
$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#cygf-main-menu").addClass('active');
    $("#cygf-main-menu").parent().toggleClass('show');
    $("#cygf-main-menu").parent().siblings().removeClass('show');
    $("#chat-cygf-nav").addClass('active');
    getAIModelList();
    getHistoryList(pageIndex, pageSize, true, true, "");
    $('[data-toggle="tooltip"]').tooltip();
    getFreePlan();
})
//监听键盘事件
$(document).keypress(function (e) {
    if ($("#Q").is(":focus")) {
        if (isMobile() && max_textarea)
            return;
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
            sendMsg();
        }
    }
    if ($("#searchKey").is(":focus")) {
        if (e.which == 13) {
            //按下回车键搜索
            getHistoryList(1, 20, true, true, $("#searchKey").val().trim());
        }
    }
});

function dataURLtoFile(dataurl, filename) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

// 阻止浏览器默认行为
$(document).on({
    dragenter: function (e) {
        e.stopPropagation();
        e.preventDefault();
    },
    dragover: function (e) {
        e.stopPropagation();
        e.preventDefault();
    },
    drop: function (e) {
        e.stopPropagation();
        e.preventDefault();
        var files = e.originalEvent.dataTransfer.files;
        handleDroppedFiles(files);
    }
});
//页面加载完成后执行
$(document).ready(function () {
    bindEnglishPromptTranslation("#Q");
    bindOptimizePrompt("#Q");
    bindInputToSidebar("#Q");
    $('#Q').on('paste', function (event) {
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
        } else
            sendMsg();
    })
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
        //UploadPWT2(file);
    }
}

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
                width: "100%",
                marginLeft: "0"
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
var sysmsg = "";
var jishuqi = 0;

// 添加显示代码语言的 Labels
function addLanguageLabels(useSpecificId = false, assistansBoxId = '') {
    var selector = useSpecificId && assistansBoxId ? $("#" + assistansBoxId + " pre code") : $("pre code");

    selector.each(function () {
        var codeBlock = $(this);
        var parentPre = codeBlock.parent('pre');

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
connection.on('ReceiveWorkShopMessage', function (message) {
    //console.log(message);
    if (!message.isfinish) {
        if (jishuqi == 0) {
            chatid = message.chatid;
            ClearImg();
            //fileTXT = "";
        } else if (message.loading) {
            $("#pluginloading").html(message.message);
        } else {
            if (message.message != null) {
                stopTimer(`#${assistansBoxId}_timer_first`);
                sysmsg += message.message;
                let chatContentBox = $(`#${assistansBoxId}`);
                let thinkContent = '';
                let normalContent = sysmsg;
                let thinkingEnded = false;
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
                //MathJax.typeset();
                //hljs.highlightAll();
                $("#" + assistansBoxId + " pre code").each(function (i, block) {
                    hljs.highlightElement(block);
                });
                addLanguageLabels(true, assistansBoxId);
                addCopyBtn(assistansBoxId);
                if (Scrolling == 1)
                    chatBody.scrollTop(chatBody[0].scrollHeight);
                applyMagnificPopup('.chat-message-box');
            }

        }
        jishuqi++;
    } else {
        stopTimer(`#${assistansBoxId}_timer_first`);
        stopTimer(`#${assistansBoxId}_timer_alltime`);
        processOver = true;
        $("#sendBtn").html(`<i data-feather="send"></i>`);
        $("#ctrl-" + assistansBoxId).show();
        feather.replace();
        $("#sendBtn").removeClass("text-danger");
        $("#" + assistansBoxId).html(marked(completeMarkdown(sysmsg)));
        //MathJax.typeset();
        //hljs.highlightAll();
        $("#" + assistansBoxId + " pre code").each(function (i, block) {
            hljs.highlightElement(block);
        });
        addLanguageLabels(true, assistansBoxId);
        var item = {
            id: assistansBoxId,
            markdown: sysmsg
        };
        markdownHis.push(item);
        sysmsg = "";
        jishuqi = 0;
        $('.LDI').remove();
        $("#pluginloading").remove();
        addCopyBtn(assistansBoxId);
        getHistoryList(1, 20, true, false, "");
        addExportButtonToTables();
        getFreePlan();
        if (Scrolling == 1)
            chatBody.scrollTop(chatBody[0].scrollHeight);
        applyMagnificPopup('.chat-message-box');
        renderMermaidDiagrams('#' + assistansBoxId);
        getUserInfo();
    }
    if (message.jscode != null && message.jscode != "") {
        (function () {
            eval(message.jscode);
        })();
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
    processOver = false;
    $("#sendBtn").html(`<i data-feather="stop-circle"></i>`);
    feather.replace();
    $("#sendBtn").addClass("text-danger");
    chatgroupid = generateGUID();
    var msgid_u = generateGUID();
    var msgid_g = generateGUID();
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
        "inputCacheKey": ""
    };
    if (max_textarea)
        max_textarea_Q();
    $("#Q").val("");
    $("#Q").focus();
    var isvip = false;
    isVIP(function (status) {
        isvip = status;
    });
    var vipHead = isvip ?
        `<div class="avatar" style="border:2px solid #FFD43B">
             <img src='${HeadImgPath}'/>
             <i class="fas fa-crown vipicon"></i>
         </div>
         <div class="nicknamevip">${UserNickText}</div>` :
        `<div class="avatar">
             <img src='${HeadImgPath}'/>
         </div>
         <div class="nickname">${UserNickText}</div>`;
    var html = `<div class="chat-message" data-group="` + chatgroupid + `">
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
    var gpthtml = `<div class="chat-message" data-group="` + chatgroupid + `">
                    <div style="display: flex; align-items: center;">
                       <div class="avatar gpt-avatar">A</div>
                       <div class="nickname" style="font-weight: bold; color: black;">AIBot</div>
                       <span class="badge badge-info ${thisAiModel.replace('.', '')}">${thisAiModel}</span>
                       <span class="badge badge-pill badge-success" id="${msgid_g}_timer_first"></span>
                       <span class="badge badge-pill badge-dark" id="${msgid_g}_timer_alltime"></span>
                    </div>
                    <div class="chat-message-box">
                        <div id="pluginloading">
                        </div>
                        <div id="${msgid_g}"></div><div class="spinner-grow spinner-grow-sm LDI"></div>
                    </div>
                    <div id="ctrl-${msgid_g}" style="display: none;">
                        <i data-feather="copy" data-toggle="tooltip" title="复制" class="chatbtns" onclick="copyAll('${msgid_g}')"></i>
                        <i data-feather="anchor" class="chatbtns" data-toggle="tooltip" title="锚" onclick="quote('${msgid_g}')"></i>
                        <i data-feather="trash-2" class="chatbtns custom-delete-btn-1" data-toggle="tooltip" title="删除" data-chatgroupid="${chatgroupid}"></i>
                        <i data-feather="codepen" class="chatbtns" data-toggle="tooltip" title="显示/隐藏Markdown" onclick="toMarkdown('${msgid_g}')"></i>
                    </div>
                </div>`;
    chatBody.append(gpthtml);
    applyMagnificPopup("#" + msgid_u);
    initImageFolding("#" + msgid_u);
    startTimer(`#${msgid_g}_timer_first`, true);
    startTimer(`#${msgid_g}_timer_alltime`);
    adjustTextareaHeight();
    chatBody.animate({
        scrollTop: chatBody.prop("scrollHeight")
    }, 500);

    // 尝试发送消息
    function trySendMessage() {
        connection.invoke("SendWorkShopMessage", data, false, [])
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
    if (loading)
        $(".chat-list").append(`<li class="divider-text" style="text-align:center;">加载中...</li>`);
    $.ajax({
        type: "Post",
        url: "/Home/GetChatHistoriesList",
        dataType: "json",
        data: {
            pageIndex: pageIndex,
            pageSize: pageSize,
            searchKey: searchKey
        },
        success: function (res) {
            //console.log(res);
            isLoading = false;
            $(".divider-text").remove();
            if (res.data.length <= 0 && pageIndex > 1 && !reload) {
                hasMore = false;
                $(".chat-list").append(`<li class="divider-text" style="text-align:center;">没有更多数据了~</li>`);
                //禁用loadMoreBtn
                $("#loadMoreBtn").prop('disabled', true).addClass('btn-secondary').removeClass('btn-primary')
                // $(".chat-sidebar-body").animate({
                //     scrollTop: $(".chat-sidebar-body")[0].scrollHeight
                // }, 500)
            }
            var html = "";
            for (var i = 0; i < res.data.length; i++) {
                var chat = res.data[i].chat;
                if (chat.indexOf('aee887ee6d5a79fdcmay451ai8042botf1443c04') != -1) {
                    var contentarr = chat.split("aee887ee6d5a79fdcmay451ai8042botf1443c04");
                    chat = contentarr[0];
                }
                chat = chat.substring(0, 50); // 只取前20个文字
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
                    topIcon = '<i class="far fa-arrow-alt-circle-up text-success mg-r-10"></i>';
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
            }
            else {
                $(".chat-list").append(html);
                // $(".chat-sidebar-body").animate({
                //     scrollTop: $(".chat-sidebar-body")[0].scrollHeight
                // }, 500);
            }
            feather.replace();
            addChatItemListeners();
        },
        error: function (err) {
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

//删除历史记录
function deleteChat(id) {
    event.stopPropagation();
    if (!processOver && id == chatid) {
        balert("对话进行中,请结束后再试", "warning", false, 2000, "center");
        return;
    }
    showConfirmationModal("提示", "确定删除这条历史记录吗？", function () {
        $.ajax({
            type: "Post",
            url: "/Home/DelChatHistory",
            dataType: "json",
            data: {
                chatId: id
            },
            success: function (res) {
                if (res.success) {
                    balert("删除成功", "success", false, 1000, "top");
                    $('[id*="' + id + '"]').remove();
                    if (id == chatid) {
                        chatBody.html("");
                        chatid = "";
                    }
                }
            },
            error: function (err) {
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
                type: "Post",
                url: "/Home/DelChatHistory",
                dataType: "json",
                data: {
                    chatId: ''
                },
                success: function (res) {
                    if (res.success) {
                        balert("删除成功", "success", false, 1000, "top");
                        chatBody.html("");
                        $(".chat-list").html("");
                        chatid = "";
                    }
                },
                error: function (err) {
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
            isVIP(function (status) {
                isvip = status;
            });
            var imgBox = [];
            var vipHead = isvip ?
                `<div class="avatar" style="border:2px solid #FFD43B">
                     <img src='${HeadImgPath}'/>
                     <i class="fas fa-crown vipicon"></i>
                 </div>
                 <div class="nicknamevip">${UserNickText}</div>` :
                `<div class="avatar">
                     <img src='${HeadImgPath}'/>
                 </div>
                 <div class="nickname">${UserNickText}</div>`;
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
                                       <pre id="` + res.data[i].chatCode + `">` + content + `</pre>
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
                    }
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
                    var firstTime = '';
                    var allTime = '';
                    if (res.data[i].firstTime != "null" && res.data[i].allTime != "null" && res.data[i].firstTime != null && res.data[i].allTime != null) {
                        firstTime = `<span class="badge badge-pill badge-success">${res.data[i].firstTime}s</span>`
                        allTime = `<span class="badge badge-pill badge-dark">${res.data[i].allTime}s</span>`
                        if (res.data[i].firstTime > 10) {
                            firstTime = `<span class="badge badge-pill badge-danger">${res.data[i].firstTime}s</span>`
                        } else if (res.data[i].firstTime > 5) {
                            firstTime = `<span class="badge badge-pill badge-warning">${res.data[i].firstTime}s</span>`
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
                                   <div class="avatar gpt-avatar">A</div>
                                   <div class="nickname" style="font-weight: bold; color: black;">AIBot</div>
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
                                  <i data-feather="codepen" class="chatbtns" data-toggle="tooltip" title="显示/隐藏Markdown" onclick="toMarkdown('${res.data[i].chatCode}')"></i>
                                </div>
                            </div>`;
                }
            }
            chatBody.html(html).hide().fadeIn(300);
            //MathJax.typeset();
            $(".chat-message pre code").each(function (i, block) {
                hljs.highlightElement(block);
            });
            addLanguageLabels();
            addCopyBtn();
            addExportButtonToTables();
            feather.replace();
            applyMagnificPopup('.chat-message-box');
            imgBox.forEach(item => initImageFolding(`#${item}`));
            createMaskedOverlays();
            renderMermaidDiagrams();
            //滚动到最底部
            chatBody.scrollTop(chatBody[0].scrollHeight);
        },
        error: function (err) {
            //window.location.href = "/Users/Login";
            balert("删除失败，错误请联系管理员：err", "danger", false, 2000, "center");
        }
    });
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
}

//加载更多历史记录
function loadMoreHistory() {
    pageIndex++;
    getHistoryList(pageIndex, pageSize, false, true, $("#searchKey").val().trim());
}

//停止生成
function stopGenerate() {
    processOver = true;
    stopTimer(`#${assistansBoxId}_timer_first`);
    stopTimer(`#${assistansBoxId}_timer_alltime`);
    $("#sendBtn").html(`<i data-feather="send"></i>`);
    $("#ctrl-" + assistansBoxId).show();
    feather.replace();
    $("#sendBtn").removeClass("text-danger");
    $('.LDI').remove();
    if (sysmsg != '')
        $("#" + assistansBoxId).html(marked(completeMarkdown(sysmsg)));
    //MathJax.typeset();
    $("#" + assistansBoxId + " pre code").each(function (i, block) {
        hljs.highlightElement(block);
    });
    addLanguageLabels(true, assistansBoxId);
    addCopyBtn(assistansBoxId);
    $.ajax({
        type: "Post",
        url: "/Home/StopGenerate",
        dataType: "json",
        data: {
            chatId: chatgroupid
        },
        success: function (res) {
            getUserInfo();
        },
        error: function (err) {
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

        var copyBtn = $('<span>').addClass('copy-btn').attr('title', 'Copy to clipboard');
        copyBtn.html(feather.icons.clipboard.toSvg());

        if ($(this).parent().find('.copy-btn').length === 0) {
            copyContainer.append(copyBtn);
            codeBlock.parent().append(copyContainer);
        }

        copyBtn.click(function () {
            var codeToCopy = codeBlock.text();
            var tempTextArea = $('<textarea>').appendTo('body').val(codeToCopy).select();
            document.execCommand('copy');
            tempTextArea.remove();
            balert("复制成功", "success", false, 1000, "top");
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


//获取AI模型列表
function getAIModelList() {
    $.ajax({
        type: "Post",
        url: "/WorkShop/GetWorkShopAImodel",
        dataType: "json",
        success: function (res) {
            var html = "";
            if (res.success) {
                $("#firstModel").html(res.data[0].modelNick);
                thisAiModel = res.data[0].modelName;
                for (var i = 0; i < res.data.length; i++) {
                    var modelNick = stripHTML(res.data[i].modelNick);
                    html += `<a class="dropdown-item font-14" href="#" data-model-name="${res.data[i].modelName}" data-model-nick="${modelNick}" data-seq="${res.data[i].seq}">` + res.data[i].modelNick + `</a>`;
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
                            originalOrder = $("#modelList").sortable("toArray", { attribute: "data-model-name" });
                            // 在拖动开始时禁用点击事件
                            $('#modelList a').off('click');
                        }, stop: function (event, ui) {
                            var newOrder = $("#modelList").sortable("toArray", { attribute: "data-model-name" });
                            // 比较新旧顺序
                            if (!arraysEqual(originalOrder, newOrder)) {
                                SaveWorkShopModelSeq();
                            }
                            bindClickEvent();
                            bindHoverEvent();
                        }
                    }).disableSelection();
                    bindHoverEvent();
                }
                $(".dropdown-item").css("margin-left", 0);
            }
        },
        error: function (err) {
            //window.location.href = "/Users/Login";
            balert("系统未配置AI模型", "info", false, 2000, "center");
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

function SaveWorkShopModelSeq() {
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
        url: '/WorkShop/SaveWorkShopModelSeq',
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

//切换模型
function changeModel(modelName, modelNick) {
    $("#chatDropdown").html(modelNick);
    feather.replace();
    $("#chatDropdown").attr("data-modelName", modelName);
    $("#chatDropdown").attr("data-modelNick", modelNick);
    thisAiModel = modelName;
    balert("切换模型【" + modelNick + "】成功", "success", false, 1000);
}

function quote(id) {
    var $elem = $("#" + id);
    // 检查是否存在<img>标签
    if ($elem.find("img").length > 0) {
        // 如果存在，遍历所有找到的<img>标签
        $elem.find("img").each(function () {
            // 为每个<img>标签提取src属性
            var imgSrc = $(this).attr("src");
            image_path = imgSrc;
            $("#openCamera").addClass("cameraColor");
            $Q.val("回复：" + $elem.text());
        });
    } else {
        $Q.val("回复： " + $elem.text() + "\n\n");
    }
    $Q.focus();
    adjustTextareaHeight();
}

//----------------------通用函数----------------------
function adjustTextareaHeight() {
    if (max_textarea) return;

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

// 绑定input事件
textarea.addEventListener("input", adjustTextareaHeight);
// 绑定keyup事件
textarea.addEventListener("keyup", adjustTextareaHeight);
//绑定change事件
textarea.addEventListener("change", adjustTextareaHeight);

function getFreePlan() {
    $.ajax({
        type: "Post",
        url: "/WorkShop/GetFreePlan",
        dataType: "json",
        success: function (res) {
            if (res.success) {
                var data = res.data;
                var minValue = 0; // 最小值
                var maxValue = data.totalCount; // 最大值
                var currentValue = data.remainCount; // 当前值
                $(".progress-bar").attr("aria-valuemin", minValue)
                    .attr("aria-valuemax", maxValue)
                    .attr("aria-valuenow", currentValue)
                    .css("width", currentValue / maxValue * 100 + "%")
                    .text(currentValue); // 显示数值
            }
        },
        error: function (err) {
            //window.location.href = "/Users/Login";
            balert("系统必要参数加载失败", "danger", false, 2000, "center");
        }
    });
}

function freePlanInfo() {
    $.ajax({
        type: "Post",
        url: "/WorkShop/GetFreePlanInfo",
        dataType: "json",
        success: function (res) {
            var content = '';
            if (res.success) {
                var freeModelArr = res.freeModel.split(',');
                var freeModelStr = ``;
                for (var i = 0; i < freeModelArr.length; i++) {
                    freeModelStr += `<a href="javascript:void(0);" class="badge badge-pill badge-success" onclick="copyText('${freeModelArr[i]}')">${freeModelArr[i]}</a> `;
                }
                content = `<p>1、免费模型只可在<b>创意工坊</b>中使用，免费模型名后带有‘🕔’标识</p>
                   <p>2、免费模型有：<b>${freeModelStr}</b></p>
                   <p>3、普通用户免费次数：<b>${res.freeCount}</b></p>
                   <p>4、会员用户免费次数：<b>${res.freeCountVIP}</b></p>
                   <p>5、免费次数刷新频率：上线后<b>${res.freePlanUpdate}小时</b>一次，剩余不累加</p>
                   <p>6、下一次刷新时间：<b>${isoStringToDateTime(res.nextRefreshTime)}</b></p>
                   <p>7、注意事项：<b>对话模型免费不代表插件免费，当您调用的插件中含DALL-E3等付费功能时，依旧需要对相应功能调用付费</b></p>`;
            } else {
                content = `<p>系统暂未开放免费</p>`;
            }
            showConfirmationModal("免费次数说明", content);
        },
        error: function (err) {
            //window.location.href = "/Users/Login";
            balert("系统必要参数加载失败", "danger", false, 2000, "center");
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
                } catch (__) { }
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
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}