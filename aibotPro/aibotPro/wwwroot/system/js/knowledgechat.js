﻿$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#knowledge-main-menu").addClass('active');
    $("#knowledge-main-menu").parent().toggleClass('show');
    $("#knowledge-main-menu").parent().siblings().removeClass('show');
    $("#chat-knowledge-nav").addClass('active');
    getAIModelList();
    getHistoryList(pageIndex, pageSize, true, true, "");
    $('[data-toggle="tooltip"]').tooltip();
    getKonwLedgeTypeByMilvus('init');
});
var max_textarea = false;
var textarea = document.getElementById("Q");
var $Q = $("#Q");
var chatBody = $(".chat-body-content");
var thisAiModel = "gpt-3.5-turbo-0125"; //当前AI模型
var processOver = true; //是否处理完毕
var image_path = "";
var onknowledgearr = [];
var chatid = "";
var chatgroupid = "";
var assistansBoxId = "";
let pageIndex = 1;
let pageSize = 20;
let pageIndex_k = 1;
let pageSize_k = 20;
var markdownHis = [];
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
    if ($("#seachKnowledge").is(":focus")) {
        if (e.which == 13) {
            //按下回车键搜索
            getKonwLedgeTypeByMilvus('init');
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
    //当#Q失去焦点时，关闭最大化
    $("#Q").blur(function () {
        if (max_textarea) {
            max_textarea_Q();
        }
    });
    $('#Q').on('paste', function (event) {
        for (var i = 0; i < event.originalEvent.clipboardData.items.length; i++) {
            var item = event.originalEvent.clipboardData.items[i];
            if (item.kind === 'file') {
                var blob = item.getAsFile();
                handleFileUpload(blob);
            }
        }
    });

    $("#sendBtn").on("click", function () {
        if (!processOver) {
            stopGenerate();
        }
        else
            sendMsg();
    })
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
    //#Q获得焦点
    $("#Q").focus();
    if (!max_textarea) {
        $Q.css("height", "500px");
        $Q.css("max-height", "500px");
        chatBody.css("height", "calc(100% - 620px)");
        $(".maximize-2").attr("data-feather", "minimize-2");
        feather.replace();
        max_textarea = true;
    }
    else {
        $Q.css("height", "auto");
        $Q.css("max-height", "200px");
        chatBody.css("height", "calc(100% - 120px)");
        $(".maximize-2").attr("data-feather", "maximize-2");
        feather.replace();
        max_textarea = false;
    }
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
    }
    else {
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
        }
        else {
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
        }
        else {
            $(".chat-sidebar").show();
            $(".chat-body").hide();
        }
    }
}

//接收消息
var md = window.markdownit();
var sysmsg = "";
var jishuqi = 0;
// 添加显示代码语言的 Labels
function addLanguageLabels(useSpecificId = false, assistansBoxId = '') {
    // 根据 useSpecificId 决定选择器的范围
    var selector = useSpecificId && assistansBoxId ? $("#" + assistansBoxId + " pre code") : $("pre code");

    selector.each(function () {
        // 仅对尚未添加过语言标签的 code 元素进行处理
        if ($(this).parent().find('.code-lang-label-container').length === 0) {
            var lang = $(this).attr('class').match(/language-(\w+)/);
            if (lang) {
                // 创建语言标签容器
                var langLabelContainer = $('<div class="code-lang-label-container" style="background-color: rgb(80, 80, 90);"></div>');
                // 创建语言标签
                var langLabel = $('<span class="code-lang-label" style="color: white;">' + lang[1] + '</span>');
                // 将语言标签添加到容器中
                langLabelContainer.append(langLabel);
                // 将语言标签容器插入到代码块的顶部
                $(this).before(langLabelContainer);
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
        } else {
            if (message.message != null) {
                stopTimer(`#${assistansBoxId}_timer_first`);
                sysmsg += message.message;
                $("#" + assistansBoxId).html(md.render(sysmsg));
                $("#" + assistansBoxId).html(marked(sysmsg));
                MathJax.typeset();
                //hljs.highlightAll();
                $("#" + assistansBoxId + " pre code").each(function (i, block) {
                    hljs.highlightElement(block);
                });
                addLanguageLabels(true, assistansBoxId);
                addCopyBtn(assistansBoxId);
                if (Scrolling == 1)
                    chatBody.scrollTop(chatBody[0].scrollHeight);
            }

        }
        jishuqi++;
    } else {
        stopTimer(`#${assistansBoxId}_timer_first`);
        stopTimer(`#${assistansBoxId}_timer_alltime`);
        processOver = true;
        $("#sendBtn").html(`<i data-feather="send"></i>`);
        feather.replace();
        $("#sendBtn").removeClass("text-danger");
        $("#" + assistansBoxId).html(marked(completeMarkdown(sysmsg)));
        MathJax.typeset();
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
        addCopyBtn(assistansBoxId);
        getHistoryList(1, 20, true, false, "");
        addExportButtonToTables();
        if (Scrolling == 1)
            chatBody.scrollTop(chatBody[0].scrollHeight);
    }
    if (message.jscode != null && message.jscode != "") {
        eval(message.jscode);
    }
});


//发送消息
function sendMsg() {
    var msg = $("#Q").val().trim();
    var onknowledge = true;
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
    var temperature = $("#slidertemperature").val();
    var topp = $("#slidertopp").val();
    var presence = $("#sliderpresence").val();
    var frequency = $("#sliderfrequency").val();
    var data = {
        "msg": msg,
        "chatid": chatid,
        "aiModel": thisAiModel,
        "msgid_u": msgid_u,
        "msgid_g": msgid_g,
        "chatgroupid": chatgroupid,
        "ip": IP,
        "image_path": image_path
    };
    max_textarea = true;
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
                       <pre id="`+ msgid_u + `"></pre>
                     </div>
                     <div>
                      <i data-feather="refresh-cw" class="chatbtns" onclick="tryAgain('`+ msgid_u + `')"></i>
                      <i data-feather="edit-3" class="chatbtns" onclick="editChat('`+ msgid_u + `')"></i>
                     </div>
                </div>`;
    $(".chat-body-content").append(html);
    $("#" + msgid_u).text(msg);
    if (image_path != "") {
        $("#" + msgid_u).append(`<br /><img src="` + image_path.replace("wwwroot", "") + `" style="max-width:50%" />`);
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
                        <div id="`+ msgid_g + `"></div><div class="spinner-grow spinner-grow-sm LDI"></div>
                    </div>
                    <div>
                        <i data-feather="copy" class="chatbtns" onclick="copyAll('`+ msgid_g + `')"></i>
                        <i data-feather="anchor" class="chatbtns" onclick="quote('`+ msgid_g + `')"></i>
                        <i data-feather="trash-2" class="chatbtns" onclick="deleteChatGroup('`+ chatgroupid + `')"></i>
                        <i data-feather="codepen" class="chatbtns" data-toggle="tooltip" title="复制Markdown" onclick="toMarkdown('${msgid_g}')"></i>
                    </div>
                </div>`;
    $(".chat-body-content").append(gpthtml);
    startTimer(`#${msgid_g}_timer_first`, true);
    startTimer(`#${msgid_g}_timer_alltime`);
    adjustTextareaHeight();
    chatBody.animate({
        scrollTop: chatBody.prop("scrollHeight")
    }, 500);
    connection.invoke("SendWorkShopMessage", data, onknowledge, onknowledgearr)
        .then(function () {
        })
        .catch(function (err) {
            processOver = true;
            sendExceptionMsg("【知识库】发送消息时出现了一些未经处理的异常 :-( 原因：" + err);
            //balert("您的登录令牌似乎已失效，我们将启动账号保护，请稍候，正在前往重新登录...", "danger", false, 3000, "center", function () {
            //    window.location.href = "/Users/Login";
            //});
        });
}

//调起摄像头&相册
function showCameraMenu() {
    $("#cameraModel").modal('show');
    if (image_path != "")
        reviewImg(image_path.replace("wwwroot", ""));
}

//获取历史记录
function getHistoryList(pageIndex, pageSize, reload, loading, searchKey) {
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
            $(".divider-text").remove();
            if (res.data.length <= 0 && pageIndex > 1 && !reload) {
                $(".chat-list").append(`<li class="divider-text" style="text-align:center;">没有更多数据了~</li>`);
                //禁用loadMoreBtn
                $("#loadMoreBtn").prop('disabled', true).addClass('btn-secondary').removeClass('btn-primary')
                $(".chat-sidebar-body").animate({
                    scrollTop: $(".chat-sidebar-body")[0].scrollHeight
                }, 500)
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
                html += `<li class="chat-item" id="` + res.data[i].chatId + `" onclick="showHistoryDetail('` + res.data[i].chatId + `')">
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
                        <span class="delete-chat">
                            <i data-feather="x" onclick="deleteChat('`+ res.data[i].chatId + `')"></i>
                        </span>
                    </li>`;
            }
            if (reload)
                $(".chat-list").html(html);
            else {
                $(".chat-list").append(html);
                $(".chat-sidebar-body").animate({
                    scrollTop: $(".chat-sidebar-body")[0].scrollHeight
                }, 500)
            }
            feather.replace();
        },
        error: function (err) {
            //window.location.href = "/Users/Login";
            //balert("出现了未经处理的异常，请联系管理员：" + err, "danger", false, 2000, "center");
        }
    });
}
//删除历史记录
function deleteChat(id) {
    event.stopPropagation();
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
function deleteChatGroup(id) {
    showConfirmationModal("提示", "确定删除这条记录吗？", function () {
        $.ajax({
            type: "Post",
            url: "/Home/DelChatGroup",
            dataType: "json",
            data: {
                groupId: id
            },
            success: function (res) {
                if (res.success) {
                    balert("删除成功", "success", false, 1000, "top");
                    $('[data-group="' + id + '"]').remove();
                    //刷新列表
                    getHistoryList(pageIndex, pageSize, true, false, $("#searchKey").val().trim());
                    if (chatBody.find('[data-group]').length <= 0)
                        chatid = "";
                }
            },
            error: function (err) {
                //window.location.href = "/Users/Login";
                balert("删除失败，错误请联系管理员：err", "danger", false, 2000, "center");
            }
        });
    });
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
    $('[id*="' + id + '"]').addClass("highlight-chat-item");
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
                if (res.data[i].role == "user") {
                    if (content.indexOf('aee887ee6d5a79fdcmay451ai8042botf1443c04') == -1) {
                        content = content.replace(/&lt;/g, "&amp;lt;").replace(/&gt;/g, "&amp;gt;");
                        content = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        html += `<div class="chat-message" data-group="` + res.data[i].chatGroupId + `">
                                     <div style="display: flex; align-items: center;">
                                        ${vipHead}
                                     </div>
                                     <div class="chat-message-box">
                                       <pre id="`+ res.data[i].chatCode + `">` + content + `</pre>
                                     </div>
                                     <div>
                                      <i data-feather="refresh-cw" class="chatbtns" onclick="tryAgain('`+ res.data[i].chatCode + `')"></i>
                                      <i data-feather="edit-3" class="chatbtns" onclick="editChat('`+ res.data[i].chatCode + `')"></i>
                                     </div>
                                 </div>`;
                    } else {
                        var contentarr = content.split("aee887ee6d5a79fdcmay451ai8042botf1443c04");
                        html += `<div class="chat-message" data-group="` + res.data[i].chatGroupId + `">
                                 <div style="display: flex; align-items: center;">
                                     <div class="avatar"><img src='${HeadImgPath}'/></div>
                                     <div class="nickname" style="font-weight: bold; color: black;">${UserNickText}</div>
                                 </div>
                                 <div class="chat-message-box">
                                   <pre id="`+ res.data[i].chatCode + `">` + contentarr[0].replace(/</g, "&lt;").replace(/>/g, "&gt;") + contentarr[1] + `</pre>
                                 </div>
                                 <div>
                                      <i data-feather="refresh-cw" class="chatbtns" onclick="tryAgain('`+ res.data[i].chatCode + `')"></i>
                                      <i data-feather="edit-3" class="chatbtns" onclick="editChat('`+ res.data[i].chatCode + `')"></i>
                                 </div>
                            </div>`;
                    }

                }
                else {
                    var item = {
                        id: res.data[i].chatCode,
                        markdown: content
                    };
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
                    markdownHis.push(item);
                    var markedcontent = marked(completeMarkdown(content));//md.render(content)//marked.parse(content);
                    var encoder = new TextEncoder();
                    html += `<div class="chat-message" data-group="` + res.data[i].chatGroupId + `">
                                <div style="display: flex; align-items: center;">
                                   <div class="avatar gpt-avatar">A</div>
                                   <div class="nickname" style="font-weight: bold; color: black;">AIBot</div>
                                   <span class="badge badge-info ${res.data[i].model.replace('.', '')}">${res.data[i].model}</span>
                                   ${firstTime}${allTime}
                                </div>
                                <div class="chat-message-box">
                                    <div id="`+ res.data[i].chatCode + `">` + markedcontent + `</div>
                                </div>
                                <div>
                                  <i data-feather="copy" class="chatbtns" onclick="copyAll('`+ res.data[i].chatCode + `')"></i>
                                  <i data-feather="anchor" class="chatbtns" onclick="quote('`+ res.data[i].chatCode + `')"></i>
                                  <i data-feather="trash-2" class="chatbtns" onclick="deleteChatGroup('`+ res.data[i].chatGroupId + `')"></i>
                                  <i data-feather="codepen" class="chatbtns" data-toggle="tooltip" title="复制Markdown" onclick="toMarkdown('${res.data[i].chatCode}')"></i>
                                </div>
                            </div>`;
                }
            }
            chatBody.html(html).hide().fadeIn(300);
            MathJax.typeset();
            $(".chat-message pre code").each(function (i, block) {
                hljs.highlightElement(block);
            });
            addLanguageLabels();
            addCopyBtn();
            addExportButtonToTables();
            feather.replace();
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
    feather.replace();
    $("#sendBtn").removeClass("text-danger");
    $('.LDI').remove();
    if (sysmsg != '')
        $("#" + assistansBoxId).html(marked(completeMarkdown(sysmsg)));
    MathJax.typeset();
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
            console.log(`knowledge停止生成，Id：${chatgroupid} --${getCurrentDateTime()}`);
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
    }
    else if (type == "upload") {
        $fileInput.removeAttr("capture");
        $fileInput.click();
    }

    $("#uploadImg").on('change', function (e) {
        var destroyAlert = balert(`<i data-feather="loader" style="width:20px;"></i> 正在上传...`, "info", false, 0, "center");
        uploadIMGFile(e.target.files[0], destroyAlert);
    });
});

function uploadIMGFile(file, destroyAlert) {
    //if (fileTXT != "") {
    //    layer.msg('请先清除文件');
    //    return;
    //}
    //if (chattype == "tts" || chattype == "draw3" || chattype == "whisper") {
    //    layer.msg('当前模型不支持图片上传');
    //    return;
    //}
    if (!file.type.startsWith('image/')) {
        layer.msg('请选择图片文件');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        layer.msg('图片文件大小不能超过5M');
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
                balert("上传成功", "success", false, 800, "center");
                reviewImg(res.data.replace("wwwroot", ""));
                image_path = res.data;
            }
            else {
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
function reviewImg(path) {
    $('#imgPreview').attr('src', path);
    $('.imgViewBox').show();
    $("#openCamera").addClass("cameraColor");
}
//清除图片
function ClearImg() {
    image_path = "";
    $('#imgPreview').attr('src', "");
    $('.imgViewBox').hide();
    $("#openCamera").removeClass("cameraColor");
}
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
            image_path = imgSrc;
            $Q.val($elem.text());
        });
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
            image_path = imgSrc;
            $("#openCamera").addClass("cameraColor");
            $Q.val($elem.text());
        });
    } else {
        $Q.val($elem.text());
    }
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
                    html += `<a class="dropdown-item font-14" href="#" onclick="changeModel('${escapeQuotes(res.data[i].modelName)}','${escapeQuotes(res.data[i].modelNick)}')">` + res.data[i].modelNick + `</a>`;
                }
                $('#AIModel').html(html);
                $(".dropdown-item").css("margin-left", 0);
            }
        },
        error: function (err) {
            //window.location.href = "/Users/Login";
            balert("系统未配置AI模型", "info", false, 2000, "center");
        }
    });
}
//切换模型
function changeModel(modelName, modelNick) {
    $("#chatDropdown").html(modelNick + `<i data-feather="chevron-down" style="width:20px;"></i>`);
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
$(document).on('click', '.dropdown-menu-onfile', function (event) {
    event.stopPropagation();

});
function getKonwLedgeTypeByMilvus(type) {
    if (type == 'loadmore')
        loadingBtn('.loadmorebtn');
    var name = $("#seachKnowledge").val();
    $.ajax({
        type: "Post",
        url: "/KnowledgeAI/GetKnowledgeType",
        dataType: "json",
        data: {
            name: name,
            page: pageIndex_k,
            pageSize: pageSize_k
        },
        success: function (res) {
            unloadingBtn('.loadmorebtn');
            var html = ``;
            res = res.data;
            if (res.length > 0) {
                if (res.length < pageSize_k)
                    $('.loadmorebtn').hide();
                for (var i = 0; i < res.length; i++) {
                    html += `<li class="list-group-item d-flex justify-content-between align-items-center">
                                    <div>
                                        <input type="checkbox" value='${res[i].typeCode}'>
                                        ${truncateString(res[i].typeName, 15)}
                                    </div>
                                 </li>`;
                }
            } else {
                html = `没有知识库~`;
                $('.loadmorebtn').hide();
            }
            $('#onknowledgeitem').html(html);
        },
        error: function (e) {
            unloadingBtn('.loadmorebtn');
        }
    });
}
// 当复选框状态改变时
$('#onknowledgeitem').on('change', 'input[type="checkbox"]', function (e) {
    var typecode = $(this).val();
    if ($(this).is(':checked')) {
        // 如果onknowledgearr已存在这个code，则不添加
        if (onknowledgearr.findIndex(item => item === typecode) === -1) {
            // 添加到onfilearr
            onknowledgearr.push(typecode);
        }
    } else {
        // 从onfilearr中移除
        onknowledgearr = onknowledgearr.filter(item => item !== typecode);
    }
});



//----------------------通用函数----------------------
function adjustTextareaHeight() {
    if (max_textarea)
        return;

    textarea.style.height = 'auto'; // Temporarily shrink textarea to auto to get the right scrollHeight.
    let scrollHeight = textarea.scrollHeight;
    if (scrollHeight > 200) {
        textarea.style.height = "200px";
        chatBody.css("height", "calc(100% - " + (120 + 200) + "px)");
    } else {
        textarea.style.height = scrollHeight + "px"; // Set height to scrollHeight directly.
        chatBody.css("height", "calc(100% - " + (120 + scrollHeight) + "px)");
    }
    if (scrollHeight == 39)
        chatBody.css("height", "calc(100% - 120px)");
}
// 绑定input事件
textarea.addEventListener("input", adjustTextareaHeight);
// 绑定keyup事件
textarea.addEventListener("keyup", adjustTextareaHeight);
//绑定change事件
textarea.addEventListener("change", adjustTextareaHeight);
function toMarkdown(id) {
    var item = markdownHis.find(function (element) {
        return element.id === id;
    });
    var markd = item ? item.markdown : null;
    copyText(markd);
    // 确保获取目标元素的唯一性
    var $targetElement = $('#' + id);

    if ($targetElement.length > 0) {
        // 检查是否已经存在 .markdown-content
        var $existingMarkdownDiv = $targetElement.find('.markdown-content');

        if ($existingMarkdownDiv.length > 0) {
            // 如果存在，直接执行关闭操作
            $existingMarkdownDiv.slideUp(function () {
                $existingMarkdownDiv.remove();
            });
            return; // 提前返回
        }
        if (markd) {
            // 确保获取目标元素的唯一性
            var $targetElement = $('#' + id);
            if ($targetElement.length > 0 && markd) {
                // 创建一个新的div来显示markdown内容
                var $markdownDiv = $('<div class="markdown-content"></div>').hide();

                // 插入markdown内容和关闭按钮到div
                $closeButton = $('<p class="close-button">&times</p>');
                var $contentDiv = $('<span class="badge badge-info">下方可编辑Markdown</span><textarea class="markdown-txt"></textarea>').val(markd);
                $markdownDiv.append($closeButton);
                $markdownDiv.append($contentDiv);

                // 将该div插入目标元素中
                $targetElement.append($markdownDiv);

                // 展开动画效果
                $markdownDiv.slideDown(300);
                if (chatBody.length > 0) {
                    var markdownDivOffsetTop = $markdownDiv.offset().top;
                    var markdownDivHeight = $markdownDiv.outerHeight(true);
                    var chatBodyHeight = chatBody.height();

                    // 计算滚动位置，使$markdownDiv的中部在父容器的中部显示
                    var scrollTop = markdownDivOffsetTop - chatBodyHeight / 2 + markdownDivHeight / 2 - chatBody.offset().top;

                    // 滚动 chatBody
                    chatBody.animate({
                        scrollTop: chatBody.scrollTop() + scrollTop
                    }, 'slow');   // 使用平滑滚动
                }

                // 关闭按钮功能，点击后收起div
                $closeButton.on('click', function () {
                    $markdownDiv.slideUp(function () {
                        $markdownDiv.remove(); // 在动画结束后移除div
                    });
                });
            }
        }
    }
}