$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#role-main-menu").addClass('active');
    $("#role-main-menu").parent().toggleClass('show');
    $("#role-main-menu").parent().siblings().removeClass('show');
    $("#chat-role-nav").addClass('active');
    getAIModelList();
    getHistoryList(pageIndex, pageSize, true, true, "");
    //获取url参数
    var type = getUrlParam("type");
    if (type == "test") {
        runTestRole();
    }
    //如果没有type参数，执行默认的角色
    if (type == '') {
        $(".clearRole").hide();
    }
    else {
        $(".clearRole").show();
        runMarketRole(type);
    }
    $('[data-toggle="tooltip"]').tooltip();
    $("#slidertemperature").val("0.5");
    $("#slidertopp").val("1");
    $("#sliderpresence").val("0.5");
    $("#sliderfrequency").val("0.5");
});
var slidertemperature = document.getElementById("slidertemperature");
slidertemperature.oninput = function () {
    this.setAttribute('data-original-title', this.value);
    $(this).tooltip('show');
}

var slidertopp = document.getElementById("slidertopp");
slidertopp.oninput = function () {
    this.setAttribute('data-original-title', this.value);
    $(this).tooltip('show');
}

var sliderpresence = document.getElementById("sliderpresence");
sliderpresence.oninput = function () {
    this.setAttribute('data-original-title', this.value);
    $(this).tooltip('show');
}

var sliderfrequency = document.getElementById("sliderfrequency");
sliderfrequency.oninput = function () {
    this.setAttribute('data-original-title', this.value);
    $(this).tooltip('show');
}
let roleAvatar = 'A';
var max_textarea = false;
var textarea = document.getElementById("Q");
var $Q = $("#Q");
var $stopBtn = $("#stopBtn");
var chatBody = $(".chat-body-content");
var thisAiModel = "gpt-3.5-turbo-0125"; //当前AI模型
var processOver = true; //是否处理完毕
var image_path = "";
var file_list = [];
var chatid = "";
var assistansBoxId = "";
let pageIndex = 1;
let pageSize = 20;
var systemPrompt = "";
var roleName = "AIBot";

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
        UploadPWT2(file);
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


//获取AI模型列表
function getAIModelList() {
    $.ajax({
        type: "Post",
        url: "/Home/GetAImodel",
        dataType: "json",
        success: function (res) {
            var html = "";
            if (res.success) {
                $("#firstModel").text(res.data[0].modelNick);
                thisAiModel = res.data[0].modelName;
                for (var i = 0; i < res.data.length; i++) {
                    html += `<a class="dropdown-item font-14" href="#" onclick="changeModel('` + res.data[i].modelName + `','` + res.data[i].modelNick + `')">` + res.data[i].modelNick + `</a>`;
                }
                $('#AIModel').html(html);
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

//隐藏历史记录列表
var isShowHistory = true;
function hideHistoary() {
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
connection.on('ReceiveMessage', function (message) {
    //console.log(message);
    if (!message.isfinish) {
        if (jishuqi == 0) {
            chatid = message.chatid;
            $stopBtn.show();
            ClearImg();
            //fileTXT = "";
        } else {
            if (message.message != null) {
                sysmsg += message.message;
                $("#" + assistansBoxId).html(md.render(sysmsg));
                MathJax.typeset();
                //hljs.highlightAll();
                $("#" + assistansBoxId + " pre code").each(function (i, block) {
                    hljs.highlightElement(block);
                });
                addLanguageLabels(true, assistansBoxId);
                if (Scrolling == 1)
                    chatBody.scrollTop(chatBody[0].scrollHeight);
            }

        }
        jishuqi++;
    } else {
        processOver = true;
        $("#sendBtn").html(`<i data-feather="send"></i>`);
        feather.replace();
        $("#sendBtn").css("color", "rgb(54,55,86)");
        $("#" + assistansBoxId).html(marked(sysmsg));
        MathJax.typeset();
        //hljs.highlightAll();
        $("#" + assistansBoxId + " pre code").each(function (i, block) {
            hljs.highlightElement(block);
        });
        addLanguageLabels(true, assistansBoxId);
        sysmsg = "";
        jishuqi = 0;
        $('.LDI').remove();
        $stopBtn.hide();
        addCopyBtn();
        getHistoryList(1, 20, true, false, "");
        addExportButtonToTables();
        if (Scrolling == 1)
            chatBody.scrollTop(chatBody[0].scrollHeight);
    }
});


//发送消息
function sendMsg() {
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
    $("#sendBtn").css("color", "red")
    var chatgroupid = generateGUID();
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
        "image_path": image_path,
        "system_prompt": systemPrompt,
        "temperature": parseFloat(temperature),
        "top_p": parseFloat(topp),
        "presence_penalty": parseFloat(presence),
        "frequency_penalty": parseFloat(frequency)
    };
    max_textarea = true;
    max_textarea_Q();
    $("#Q").val("");
    $("#Q").focus();
    var html = `<div class="chat-message" data-group="` + chatgroupid + `">
                     <div style="display: flex; align-items: center;">
                        <div class="avatar"><img src='${HeadImgPath}'/></div>
                        <div class="nickname" style="font-weight: bold; color: black;">${UserNickText}</div>
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
                        <div class="avatar"><img src='${roleAvatar}'/></div>
                        <div class="nickname" style="font-weight: bold; color: black;">${roleName}</div>
                     </div>
                    <div class="chat-message-box">
                        <div id="`+ msgid_g + `"></div><svg width="30" height="30" class="LDI"><circle cx="15" cy="15" r="7.5" fill="black" class="blinking-dot" /></svg>
                    </div>
                    <div>
                        <i data-feather="copy" class="chatbtns" onclick="copyAll('`+ msgid_g + `')"></i>
                        <i data-feather="anchor" class="chatbtns" onclick="quote('`+ msgid_g + `')"></i>
                        <i data-feather="trash-2" class="chatbtns" onclick="deleteChatGroup('`+ chatgroupid + `')"></i>
                    </div>
                </div>`;
    $(".chat-body-content").append(gpthtml);
    adjustTextareaHeight();
    chatBody.scrollTop(chatBody[0].scrollHeight);
    connection.invoke("SendMessage", data)
        .then(function () {
        })
        .catch(function (err) {
            processOver = true;
            sendExceptionMsg(err.toString());
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
                chat = chat.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                html += `<li class="chat-item" id="` + res.data[i].chatId + `" onclick="showHistoryDetail('` + res.data[i].chatId + `')">
                            <div class="chat-item-body">
                                <div>
                                    <b>
                                        `+ chat + `
                                    </b>
                                </div>
                                <p>
                                    `+ res.data[i].createTime + `
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
                }, 500);
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
    $(".chat-item").css("border", "none");
    $(".chat-item").css("background-color", "white");
    $('[id*="' + id + '"]').css("background-color", "#f5f5fc");
    $('[id*="' + id + '"]').css("border-right", "2px solid rgb(46,161,77)");
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
            for (var i = 0; i < res.data.length; i++) {
                var content = res.data[i].chat;
                if (res.data[i].role == "user") {
                    if (content.indexOf('aee887ee6d5a79fdcmay451ai8042botf1443c04') == -1) {
                        content = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                        html += `<div class="chat-message" data-group="` + res.data[i].chatGroupId + `">
                                     <div style="display: flex; align-items: center;">
                                        <div class="avatar"><img src='${HeadImgPath}'/></div>
                                        <div class="nickname" style="font-weight: bold; color: black;">${UserNickText}</div>
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
                    var markedcontent = marked(content);//md.render(content)//marked.parse(content);
                    var encoder = new TextEncoder();
                    html += `<div class="chat-message" data-group="` + res.data[i].chatGroupId + `">
                                <div style="display: flex; align-items: center;">
                                    <div class="avatar"><img src='${roleAvatar}'/></div>
                                    <div class="nickname" style="font-weight: bold; color: black;">${roleName}</div>
                                </div>
                                <div class="chat-message-box">
                                    <div id="`+ res.data[i].chatCode + `">` + markedcontent + `</div>
                                </div>
                                <div>
                                  <i data-feather="copy" class="chatbtns" onclick="copyAll('`+ res.data[i].chatCode + `')"></i>
                                  <i data-feather="anchor" class="chatbtns" onclick="quote('`+ res.data[i].chatCode + `')"></i>
                                  <i data-feather="trash-2" class="chatbtns" onclick="deleteChatGroup('`+ res.data[i].chatGroupId + `')"></i>
                                </div>
                            </div>`;
                }
            }
            chatBody.html(html);
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
    mobileChat(true);
    chatid = "";
    chatBody.html("");
    $(".chat-item").css("border", "none");
    $(".chat-item").css("background-color", "white");
    $("#Q").focus();
}
//加载更多历史记录
function loadMoreHistory() {
    pageIndex++;
    getHistoryList(pageIndex, pageSize, false, true, $("#searchKey").val().trim());
}
//停止生成
function stopGenerate() {
    $.ajax({
        type: "Post",
        url: "/Home/StopGenerate",
        dataType: "json",
        data: {
            chatId: chatid
        },
        success: function (res) {
            $("#sendBtn").html(`<i data-feather="send"></i>`);
            feather.replace();
            $("#sendBtn").css("color", "rgb(54,55,86)")
            processOver = true;
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
    $("#openCamera").css("color", "red");
}
//清除图片
function ClearImg() {
    image_path = "";
    $('#imgPreview').attr('src', "");
    $('.imgViewBox').hide();
    $("#openCamera").css("color", "rgb(135,136,154)");
}
//遍历添加复制按钮
function addCopyBtn() {
    // 遍历所有含有 'hljs' 类的 code 标签
    $('pre code.hljs').each(function () {
        var codeBlock = $(this); // 当前的 code 标签

        // 为复制按钮创建一个容器
        var copyContainer = $('<div>').addClass('copy-container').css({
            'text-align': 'right', // 复制按钮靠右显示
            'background-color': 'rgb(40,44,52)', // 容器的背景颜色
            'padding': '4px', // 容器的内边距
            //'margin-top': '4px', // 与 code 标签之间的间距
            'display': 'block',
            'color': 'rgb(135,136,154)',
            'cursor': 'pointer'
        });

        // 创建复制按钮
        var copyBtn = $('<span>').addClass('copy-btn').attr('title', 'Copy to clipboard');
        copyBtn.html(feather.icons.clipboard.toSvg());

        if ($(this).parent().find('.copy-btn').length === 0) {
            copyContainer.append(copyBtn);
            // 把按钮容器添加到 code 标签的外层容器中（假设是 pre 标签）
            codeBlock.parent().append(copyContainer);
        }

        // 把按钮容器添加到 code 标签的外层容器中（假设是 pre 标签）
        codeBlock.parent().append(copyContainer);

        // 实现复制功能
        copyBtn.click(function () {
            var codeToCopy = codeBlock.text(); // 获取 code 标签中的文本
            var tempTextArea = $('<textarea>').appendTo('body').val(codeToCopy).select(); // 创建临时的 textarea 并选中文本
            document.execCommand('copy'); // 执行复制操作
            tempTextArea.remove(); // 移除临时创建的 textarea
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
            image_path = "wwwroot" + imgSrc;
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
            image_path = "wwwroot" + imgSrc;
            $("#openCamera").css("color", "red");
            $Q.val($elem.text());
        });
    } else {
        $Q.val($elem.text());
    }
    adjustTextareaHeight();
}
function runTestRole() {
    //发起请求
    loadingOverlay.show();
    $.ajax({
        url: "/Role/GetTestRole",
        type: "post",
        contentType: "application/json",
        success: function (res) {
            systemPrompt = res.data.roleSystemPrompt;
            roleName = res.data.roleName;
            //截取roleName前5个字符
            $("#roleName").html(roleName.substring(0, 5) + '...');
            if (res.data.roleChat != null)
                writeChats(res.data.roleChat);
        },
        error: function (e) {
            sendok = true;
            console.log("失败" + e);
        }
    });
}
function runMarketRole(type) {
    //发起请求
    loadingOverlay.show();
    $.ajax({
        url: "/Role/GetMarketRole",
        type: "post",
        data: {
            roleCode: type
        },
        success: function (res) {
            loadingOverlay.hide();
            if (res.success) {
                systemPrompt = res.data.roleSystemPrompt;
                roleName = res.data.roleName;
                roleAvatar = `<img src="${res.data.roleAvatar}" />`;
                //截取roleName前5个字符
                $("#roleName").html(roleName.substring(0, 5) + '...');
                if (res.data.roleChat != null)
                    writeChats(res.data.roleChat);
            } else {
                newChat();
            }

        },
        error: function (e) {
            loadingOverlay.hide();
            sendok = true;
            console.log("失败" + e);
        }
    });
}

function writeChats(roleChats) {
    var formData = new FormData();
    roleChats.forEach(function (item, index) {
        var guid = generateGUID();
        formData.append(`roleChat[${index}].RoleChatCode`, guid);
        formData.append(`roleChat[${index}].UserInput`, item.userInput);
        formData.append(`roleChat[${index}].AssistantOutput`, item.assistantOutput);
    });
    $.ajax({
        url: "/Role/WriteChats",
        type: "post",
        data: formData,
        contentType: false,
        processData: false,
        success: function (res) {
            loadingOverlay.hide();
            if (res.success) {
                getHistoryList(1, 20, true, true, "");
                showHistoryDetail(res.msg);
            }
            else
                newChat();
        },
        error: function (e) {
            sendok = true;
            console.log("失败" + e);
        }
    });
}
function quote(id) {
    var $elem = $("#" + id);
    // 检查是否存在<img>标签
    if ($elem.find("img").length > 0) {
        // 如果存在，遍历所有找到的<img>标签
        $elem.find("img").each(function () {
            // 为每个<img>标签提取src属性
            var imgSrc = $(this).attr("src");
            image_path = "wwwroot" + imgSrc;
            $("#openCamera").css("color", "red");
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