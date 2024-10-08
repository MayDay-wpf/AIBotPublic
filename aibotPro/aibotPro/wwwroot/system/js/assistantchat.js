﻿$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#assistant-main-menu").addClass('active');
    $("#assistant-main-menu").parent().toggleClass('show');
    $("#assistant-main-menu").parent().siblings().removeClass('show');
    $("#chat-assistant-nav").addClass('active');
    $(".chat-body").show();
})
var max_textarea = false;
var textarea = document.getElementById("Q");
var $Q = $("#Q");
var chatBody = $(".chat-body-content");
var processOver = true; //是否处理完毕
var chatid = "";
var assistansBoxId = "";
var threadId = "";
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
        console.log('【Assistant】与服务器握手成功 :-)'); // 与服务器握手成功
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
});

function newChat() {
    if (!processOver) {
        balert("对话进行中,请结束后再试", "warning", false, 2000);
        return;
    }
    chatid = "";
    threadId = "";
    chatBody.html("");
    $("#Q").focus();
}

$(document).ready(function () {
    bindEnglishPromptTranslation("#Q");
    bindOptimizePrompt("#Q");
    bindInputToSidebar("#Q");
    //当#Q失去焦点时，关闭最大化
    $("#Q").blur(function () {
        if (max_textarea) {
            max_textarea_Q();
        }
    });

    $("#sendBtn").on("click", function () {
        if (!processOver) {
            stopGenerate();
        } else
            sendMsg();
    })
});


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

//引用
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
        chatBody.css("height", "calc(100% - 140px)");
}

// 绑定input事件
textarea.addEventListener("input", adjustTextareaHeight);
// 绑定keyup事件
textarea.addEventListener("keyup", adjustTextareaHeight);
//绑定change事件
textarea.addEventListener("change", adjustTextareaHeight);


//接收消息
var md = window.markdownit();
var sysmsg = "";
var jishuqi = 0;
connection.on('ReceiveAssistantMessage', function (message) {
    //console.log(message);
    if (!message.isfinish) {
        if (jishuqi == 0) {
            chatid = message.chatid;
        } else {
            if (message.threadid != null && message.threadid != "") {
                threadId = message.threadid;
            }
            if (message.message != null) {
                sysmsg += message.message;
                $("#" + assistansBoxId).html(md.render(sysmsg));
                MathJax.typeset();
                //hljs.highlightAll();
                $("#" + assistansBoxId + " pre code").each(function (i, block) {
                    hljs.highlightElement(block);
                });
                addCopyBtn(assistansBoxId);
                if (Scrolling == 1)
                    chatBody.scrollTop(chatBody[0].scrollHeight);
                applyMagnificPopup('.chat-message-box');
            }

        }
        jishuqi++;
    } else {
        processOver = true;
        //"sandbox:/mnt/data/";
        $("#" + assistansBoxId).html(marked(completeMarkdown(sysmsg)));
        $("#" + assistansBoxId).find("a").each(function () {
            var href = $(this).attr("href");
            if (href && href.includes("sandbox:/mnt/data/")) {
                var newHref = href.replace("sandbox:/mnt/data/", "/AssistantGPT/DownloadFile?fileid=");
                $(this).attr("href", newHref);
            }
        });
        MathJax.typeset();
        //hljs.highlightAll();
        $("#" + assistansBoxId + " pre code").each(function (i, block) {
            hljs.highlightElement(block);
        });
        var item = {
            id: assistansBoxId,
            markdown: sysmsg
        };
        markdownHis.push(item);
        sysmsg = "";
        jishuqi = 0;
        $('.LDI').remove();
        $stopBtn.hide();
        addCopyBtn(assistansBoxId);
        getHistoryList(1, 20, true, false, "");
        addExportButtonToTables();
        if (Scrolling == 1)
            chatBody.scrollTop(chatBody[0].scrollHeight);
        applyMagnificPopup('.chat-message-box');
    }
    if (message.file_id != null && message.file_id != "") {
        sysmsg += `<button class="btn btn-info" onclick="window.location.href='/AssistantGPT/DownloadFile?fileid=${message.file_id}'">强制下载按钮</button>`
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
    var chatgroupid = generateGUID();
    var msgid_u = generateGUID();
    var msgid_g = generateGUID();
    assistansBoxId = msgid_g;
    var data = {
        "msg": msg,
        "chatid": chatid,
        "aiModel": "",
        "msgid_u": msgid_u,
        "msgid_g": msgid_g,
        "chatgroupid": chatgroupid,
        "ip": IP,
        "image_path": [],
        "threadid": threadId,
        "inputCacheKey": ""
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
                       <pre id="` + msgid_u + `"></pre>
                     </div>
                     <div>
                      <i data-feather="refresh-cw" class="chatbtns" onclick="tryAgain('` + msgid_u + `')"></i>
                      <i data-feather="edit-3" class="chatbtns" onclick="editChat('` + msgid_u + `')"></i>
                     </div>
                </div>`;
    $(".chat-body-content").append(html);
    $("#" + msgid_u).text(msg);
    if (msg.length > 1000) {
        setInputToCache(data, function (responseData) {
            data.inputCacheKey = responseData;
            data.msg = "";
        });
    }
    var gpthtml = `<div class="chat-message" data-group="` + chatgroupid + `">
                    <div style="display: flex; align-items: center;">
                       <div class="avatar gpt-avatar">A</div>
                       <div class="nickname" style="font-weight: bold; color: black;">AIBot</div>
                    </div>
                    <div class="chat-message-box">
                        <div id="` + msgid_g + `"></div><div class="spinner-grow spinner-grow-sm LDI"></div>
                    </div>
                    <div>
                        <i data-feather="copy" class="chatbtns" onclick="copyAll('` + msgid_g + `')"></i>
                        <i data-feather="anchor" class="chatbtns" onclick="quote('` + msgid_g + `')"></i>
                        <i data-feather="codepen" class="chatbtns" data-toggle="tooltip" title="复制Markdown" onclick="toMarkdown('${msgid_g}')"></i>
                    </div>
                </div>`;
    $(".chat-body-content").append(gpthtml);
    adjustTextareaHeight();
    chatBody.animate({
        scrollTop: chatBody.prop("scrollHeight")
    }, 500);
    feather.replace();

    // 尝试发送消息
    function trySendMessage() {
        connection.invoke("SendAssistantMessage", data)
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
    } else {
        $Q.css("height", "auto");
        $Q.css("max-height", "200px");
        chatBody.css("height", "calc(100% - 140px)");
        $(".maximize-2").attr("data-feather", "maximize-2");
        feather.replace();
        max_textarea = false;
    }
}

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



