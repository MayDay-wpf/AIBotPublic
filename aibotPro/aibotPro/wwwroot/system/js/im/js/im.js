// websocket连接设置
var connection_im = new signalR.HubConnectionBuilder()
    .withUrl('/imessageHub', {
        accessTokenFactory: () => localStorage.getItem('aibotpro_userToken')
    })
    .withAutomaticReconnect()
    .build();

// 启动连接
connection_im.start()
    .then(function () {
        console.log('IM与服务器握手成功 :-)'); // 与服务器握手成功
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
connection_im.onreconnecting((error) => {
    console.assert(connection_im.state === signalR.HubConnectionState.Reconnecting);
    console.log(`由于错误"${error}"失去连接。正在尝试重新连接。`);
    // Here you might want to inform the user that the connection is being reattempted.
});

connection_im.onreconnected((connectionId) => {
    console.assert(connection_im.state === signalR.HubConnectionState.Connected);
    console.log(`连接已重新建立。已连接到connectionId为"${connectionId}"。`);
    // Here you might want to inform the user that the connection has been successfully reestablished.
});

connection_im.onclose((error) => {
    console.assert(connection_im.state === signalR.HubConnectionState.Disconnected);
    console.log(`由于错误"${error}"连接已关闭。尝试重新启动连接。`);
    // 这里您可以尝试再次启动连接，或者通知用户连接已丢失。
    connection_im.start();
});
$(document).ready(function () {
    var $floatingButton = $(".ai-floating-button-container");
    var $chatWindow = $(".ai-chat-window");
    var $closeBtn = $(".ai-close-btn");
    var isDragging = false; // 添加拖动标志变量

    $floatingButton.draggable({
        axis: "y",
        containment: "window",
        scroll: false,
        start: function () {
            isDragging = true; // 拖动开始时设置标志为 true
        },
        stop: function () {
            isDragging = false; // 拖动结束时设置标志为 false
        },
        drag: function () {
            localStorage.setItem('buttonPosition', $floatingButton.css('top'));
        }
    });

    // 防止按钮点击事件干扰拖动
    $floatingButton.find("button").on("mousedown", function (e) {
        e.preventDefault();
    });

    var savedPosition = localStorage.getItem('buttonPosition');
    if (savedPosition !== null) {
        $floatingButton.css('top', savedPosition);
    }
    $floatingButton.show();
    // 打开聊天窗口
    $floatingButton.on("click", function () {
        if (!isDragging) { // 检查是否正在拖动
            $chatWindow.css('display', 'block');
            setTimeout(function () {
                $chatWindow.addClass("open");
            }, 10);
            $floatingButton.hide();
        }
    });

    // 关闭聊天窗口
    $closeBtn.on("click", function () {
        $chatWindow.removeClass("open");
        setTimeout(function () {
            $chatWindow.css('display', 'none');
        }, 300);
        $floatingButton.show();
    });
});
var $chatMenu = $(".ai-chat-menu");
var $plusMenu = $("#plus-menu");

function openMenu() {
    $chatMenu.slideDown();
    $plusMenu.html('<i class="fas fa-times"></i>');
    $plusMenu.off("click").on("click", closeMenu);
}

function closeMenu() {
    $chatMenu.slideUp(function () {
        $plusMenu.html('<i class="fas fa-bars"></i>');
        $plusMenu.off("click").on("click", openMenu);
    });
}

$plusMenu.on("click", openMenu);
var $message = $("#message");
var $ai_chat_content = $(".ai-chat-content");
var messagecode = generateGUID(true);
$(document).keypress(function (e) {
    if ($message.is(":focus")) {
        if ((e.which == 13 && e.shiftKey) || (e.which == 10 && e.shiftKey) || (e.which == 13 && e.ctrlKey) || (e.which == 10 && e.ctrlKey)) {

            // 这里实现光标处换行
            var input = $message;
            var content = input.val();
            var caretPos = input[0].selectionStart;

            var newContent = content.substring(0, caretPos) + "\n" + content.substring(input[0].selectionEnd, content.length);
            input.val(newContent);
            // 设置新的光标位置
            input[0].selectionStart = input[0].selectionEnd = caretPos + 1;
            e.preventDefault();  // 阻止默认行为
            autoResizeTextarea();
        } else if (e.which == 13) {
            // 避免回车键换行
            e.preventDefault();
            sendMessages();
        }
    }
});
$message.on('input', autoResizeTextarea);

function autoResizeTextarea() {
    $message.css('height', 'auto');
    $message.css('height', $message[0].scrollHeight + 'px');
}

connection_im.on("ReceiveMessage", function (message) {
    if (messagecode != message.messageCode) {
        var messageContainer = $("<div class='message-container'>");

        var avatarContainer = $("<div class='avatar-container'>");
        var avatar = $("<img>").attr("src", message.headImgPath).addClass("ai-chat-avatar rounded-circle");
        var messageInfo = $("<div class='message-info'>");
        var username = $("<span class='username'>").text(message.nick);
        var timestamp = $("<span class='timestamp'>").text(new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        }));
        messageInfo.append(username, timestamp);
        avatarContainer.append(avatar, messageInfo);

        var messageContent = $("<div class='message-content'>");

        if (message.message) {
            var messageText = $("<div class='message-text'>").text(message.message);
            messageContent.append(messageText);
        }

        if (message.files && message.files.length > 0) {
            for (var i = 0; i < message.files.length; i++) {
                var file = message.files[i];
                var fileExtension = file.split('.').pop().toLowerCase();

                if (fileExtension === 'jpg' || fileExtension === 'jpeg' || fileExtension === 'png' || fileExtension === 'gif') {
                    var messageImage = $("<div class='message-image'>");
                    var image = $("<img>").attr("src", file).addClass("img-fluid rounded");
                    messageImage.append(image);
                    messageContent.append(messageImage);
                } else {
                    var messageFile = $("<div class='message-file'>");
                    var fileIcon = $("<i>").addClass("fas fa-file-" + getFileIcon(fileExtension));
                    var fileName = $("<span>").text(file.split('/').pop());
                    var downloadLink = $("<a>").attr("href", file).addClass("btn btn-sm btn-primary").html("<i class='fas fa-download'></i> 下载");
                    messageFile.append(fileIcon, fileName, downloadLink);
                    messageContent.append(messageFile);
                }
            }
        }

        var actionButtons = $("<div>");
        var atSign = $("<i>").attr("data-feather", "at-sign").addClass("chatbtns");
        var trash = $("<i>").attr("data-feather", "trash-2").addClass("chatbtns");
        actionButtons.append(atSign, trash);

        messageContainer.append(avatarContainer, messageContent, actionButtons);
        $ai_chat_content.append(messageContainer);
        feather.replace();
    } else {
        messagecode = generateGUID(true);
    }
});

function getFileIcon(extension) {
    switch (extension) {
        case 'pdf':
            return 'pdf';
        case 'doc':
        case 'docx':
            return 'word';
        case 'xls':
        case 'xlsx':
            return 'excel';
        case 'ppt':
        case 'pptx':
            return 'powerpoint';
        case 'zip':
        case 'rar':
            return 'archive';
        default:
            return 'alt';
    }
}


function sendMessages() {
    var message = $message.val();
    if (message.trim() == "") {
        balert("请输入内容", "warning", false, 1500, "right");
        return;
    }
    scrollToBottom();
    var messageContainer = $("<div class='message-container self'>");

    var messageContent = $("<div class='message-content'>");
    var messageText = $("<div class='message-text'>").text(message);
    var timestamp = $("<span class='timestamp'>").text(new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    }));
    messageContent.append(messageText, timestamp);

    var actionButtons = $("<div class='action-buttons'>");
    var trash = $("<i>").attr("data-feather", "trash-2").addClass("chatbtns");
    actionButtons.append(trash);

    messageContainer.append(messageContent, actionButtons);
    $ai_chat_content.append(messageContainer);
    $message.val("");
    autoResizeTextarea();
    feather.replace();
    var data = {
        "message": message,
        "files": [],
        "code": "",
        "messagecode": messagecode,
        "headimgpath": HeadImgPath,
        "nick": UserNickText
    };

    $.ajax({
        url: '/IM/SendMessage',  // 假设控制器的路由是 /IM/SendMessage
        type: 'POST',
        data: data
    });
}


function scrollToBottom() {
    $ai_chat_content.animate({scrollTop: $ai_chat_content.prop("scrollHeight")}, 100);
}