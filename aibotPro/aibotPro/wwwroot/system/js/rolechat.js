function runTestRole() {
    //发起请求
    loadingOverlay.show();
    $.ajax({
        url: "/Role/GetTestRole", type: "post", contentType: "application/json", success: function (res) {
            systemPrompt = res.data.roleSystemPrompt;
            roleName = res.data.roleName;
            //截取roleName前5个字符
            $("#roleName").html(roleName.substring(0, 5) + '...');
            if (res.data.roleChat != null) writeChats(res.data.roleChat);
        }, error: function (e) {
            sendok = true;
            console.log("失败" + e);
        }
    });
}

function runMarketRole(type) {
    //发起请求
    loadingOverlay.show();
    $.ajax({
        url: "/Role/GetMarketRole", type: "post", data: {
            roleCode: type
        }, success: function (res) {
            if (res.success) {
                systemPrompt = res.data.roleSystemPrompt;
                roleName = res.data.roleName;
                roleAvatar = `<img src="${res.data.roleAvatar}" />`;
                //截取roleName前5个字符
                $("#roleName").html(roleName.substring(0, 5) + '...');
                if (res.data.roleChat != null)
                    writeChats(res.data.roleChat);
                else
                    loadingOverlay.hide();
            } else {
                newChat();
                loadingOverlay.hide();
            }
        }, error: function (e) {
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
            if (res.success) {
                getHistoryList(1, 20, true, true, "");
                showHistoryDetail(res.msg);
            } else {
                newChat();
                loadingOverlay.hide();
            }
        },
        error: function (e) {
            loadingOverlay.hide();
            sendok = true;
            console.log("失败" + e);
        }
    });
}


