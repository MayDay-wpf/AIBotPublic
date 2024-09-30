var regex = /'/;
var roleAvatar = '';
var code = '';
var chatcode = '';
$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#role-main-menu").addClass('active');
    $("#role-main-menu").parent().toggleClass('show');
    $("#role-main-menu").parent().siblings().removeClass('show');
    $("#custom-role-nav").addClass('active');
    getTestRole();
    code = getUrlParam("code");
    if (code != "") {
        getRole(code);
    }
});
function getRole(code) {
    //发起请求
    loadingOverlay.show();
    $.ajax({
        url: "/Role/GetMarketRole",
        type: "post",
        data: {
            roleCode: code
        },
        success: function (res) {
            loadingOverlay.hide();
            if (res.success) {
                var data = res.data;
                if (data.canDelete) {
                    $("#avatar-image").attr("src", data.roleAvatar);
                    roleAvatar = data.roleAvatar;
                    $("#roleName").val(data.roleName);
                    $("#roleInfo").val(data.roleInfo);
                    $("#roleSystemChat").val(data.roleSystemPrompt);
                    var roleChat = data.roleChat;
                    for (var i = 0; i < roleChat.length; i++) {
                        var str = `<tr>
                                     <td><input type="text" class="form-control" maxlength="1024" value="${roleChat[i].userInput}" /></td>
                                     <td><input type="text" class="form-control" maxlength="1024" value="${roleChat[i].assistantOutput}" /></td>
                                     <td><i data-feather="delete" style="color:red;cursor:pointer;" onclick="delLine()"></i></td></tr>`;
                        $("#AddRoleChat1").append(str);
                        chatcode = roleChat[i].roleChatCode;
                    }
                    feather.replace();
                } else {
                    $("#roleName2").val(data.roleName);
                    $("#roleSystemChat2").val(data.roleSystemPrompt);
                    var roleChat = data.roleChat;
                    for (var i = 0; i < roleChat.length; i++) {
                        var str = `<tr>
                                     <td><input type="text" class="form-control" maxlength="1024" value="${roleChat[i].userInput}" /></td>
                                     <td><input type="text" class="form-control" maxlength="1024" value="${roleChat[i].assistantOutput}" /></td>
                                     <td><i data-feather="delete" style="color:red;cursor:pointer;" onclick="delLine()"></i></td></tr>`;
                        $("#AddRoleChat2").append(str);
                    }
                    //屏幕滚动到最底部
                    $('html, body').animate({
                        scrollTop: $(document).height() - $(window).height()
                    }, 500);
                }

            }

        },
        error: function (e) {
            loadingOverlay.hide();
            sendok = true;
            console.log("失败" + e);
        }
    });
}
function addRoleChatLine(index) {
    var str = `<tr>
                 <td><input type="text" class="form-control" maxlength="1024" placeholder="用户输入" /></td>
                 <td><input type="text" class="form-control" maxlength="1024" placeholder="AI输出" /></td>
                 <td><i data-feather="delete" style="color:red;cursor:pointer;" onclick="delLine()"></i></td></tr>`;
    if (index == 1)
        $("#AddRoleChat1").append(str);
    else if (index == 2)
        $("#AddRoleChat2").append(str);
    feather.replace();
}
function delLine() {
    $(event.target).closest('tr').remove();
}
function loadImage(event) {
    var input = event.target;
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        //只允许上传图片
        if (!/image\/\w+/.test(input.files[0].type)) {
            balert('请确保文件为图像类型', 'warning', false, 1500, 'center');
            return;
        }
        //图片大小不大于5M
        if (input.files[0].size > 5 * 1024 * 1024) {
            balert('图片大小不得超过5M', 'warning', false, 1500, 'center');
            return;
        }
        reader.onload = function (e) {
            $('#avatar-image').attr('src', e.target.result);
        }
        reader.readAsDataURL(input.files[0]);
        //上传图片
        var formData = new FormData();
        formData.append('file', input.files[0]);
        $.ajax({
            url: '/Role/UploadAvatar',
            type: 'post',
            data: formData,
            contentType: false,
            processData: false,
            success: function (res) {
                if (res.success) {
                    roleAvatar = res.filePath.replace('wwwroot', '');
                }
                else {
                    balert(res.msg, 'danger', false, 1500, 'center');
                }
            }
        });
    }
}
//保存角色
function saveRole() {
    var roleName = $('#roleName').val();
    var roleInfo = $('#roleInfo').val();
    var roleSystemChat = $('#roleSystemChat').val();
    var chat1 = [];
    var isEmpty = false;
    $('#AddRoleChat1 tr').each(function () {
        var columns = $(this).find('td');

        var UserInput = columns.eq(0).find('input').val();
        var AssistantOutput = columns.eq(1).find('input').val();
        if (UserInput.trim() === '' || AssistantOutput.trim() === '' || regex.test(UserInput) || regex.test(AssistantOutput)) {
            isEmpty = true;
        }

        var item = {
            "UserInput": UserInput,
            "AssistantOutput": AssistantOutput
        };
        chat1.push(item);
    });
    if (roleName == '') {
        balert('角色名称不能为空', 'warning', false, 1500, 'center');
        return;
    }
    if (roleInfo == '') {
        balert('角色描述不能为空', 'warning', false, 1500, 'center');
        return;
    }
    if (roleAvatar == '') {
        balert('请上传角色头像', 'warning', false, 1500, 'center');
        return;
    }
    if (roleSystemChat == '') {
        balert('系统提示词不能为空', 'warning', false, 1500, 'center');
        return;
    }
    //表单提交
    var formData = new FormData();
    formData.append('roleSetting.RoleCode', code);
    formData.append('roleSetting.RoleName', roleName);
    formData.append('roleSetting.RoleInfo', roleInfo);
    formData.append('roleSetting.RoleAvatar', roleAvatar);
    formData.append('roleSetting.RoleSystemPrompt', roleSystemChat);
    formData.append('roleSetting.RoleChatCode', chatcode);
    chat1.forEach((chat, index) => {
        formData.append(`roleSetting.RoleChat[${index}].RoleChatCode`, chatcode);
        formData.append(`roleSetting.RoleChat[${index}].UserInput`, chat.UserInput);
        formData.append(`roleSetting.RoleChat[${index}].AssistantOutput`, chat.AssistantOutput);
    });
    loadingBtn('.saveBtn');
    $.ajax({
        url: '/Role/SaveRole',
        type: 'post',
        data: formData,
        contentType: false,
        processData: false,
        success: function (res) {
            unloadingBtn('.saveBtn');
            if (res.success) {
                balert('保存成功', 'success', false, 1500, 'center');
            }
            else {
                balert(res.msg, 'danger', false, 1500, 'center');
            }
        }
    });
}

//测试角色
function runTestRole() {
    var roleName = $('#roleName2').val();
    var roleSystemChat = $('#roleSystemChat2').val();
    var chat2 = [];
    var guid = generateGUID();
    var isEmpty = false;
    $('#AddRoleChat2 tr').each(function () {
        var columns = $(this).find('td');

        var UserInput = columns.eq(0).find('input').val();
        var AssistantOutput = columns.eq(1).find('input').val();
        if (UserInput.trim() === '' || AssistantOutput.trim() === '' || regex.test(UserInput) || regex.test(AssistantOutput)) {
            isEmpty = true;
        }

        var item = {
            "UserInput": UserInput,
            "AssistantOutput": AssistantOutput
        };
        chat2.push(item);
    });

    if (roleName == '') {
        balert('角色名称不能为空', 'warning', false, 1500, 'center');
        return;
    }
    if (roleSystemChat == '') {
        balert('系统提示词不能为空', 'warning', false, 1500, 'center');
        return;
    }
    if (isEmpty) {
        balert('请删除空的用户输入和AI输出', 'warning', false, 1500, 'center');
        return;
    }
    //表单提交
    var formData = new FormData();
    formData.append('roleSetting.RoleName', roleName);
    formData.append('roleSetting.RoleSystemPrompt', roleSystemChat);
    formData.append('roleSetting.RoleChatCode', guid);
    chat2.forEach((chat, index) => {
        formData.append(`roleSetting.RoleChat[${index}].RoleChatCode`, guid);
        formData.append(`roleSetting.RoleChat[${index}].UserInput`, chat.UserInput);
        formData.append(`roleSetting.RoleChat[${index}].AssistantOutput`, chat.AssistantOutput);
    });
    loadingBtn('.testBtn');
    $.ajax({
        url: '/Role/SaveTestRole',
        type: 'post',
        data: formData,
        contentType: false,
        processData: false,
        success: function (res) {
            unloadingBtn('.testBtn');
            if (res.success) {
                window.location.href = '/Home/Index?type=test';
            }
            else {
                balert(res.msg, 'danger', false, 1500, 'center');
            }
        }
    });
}

function getTestRole() {
    $.ajax({
        url: "/Role/GetTestRole",
        type: "post",
        contentType: "application/json",
        success: function (res) {
            if (!res.success)
                return;
            systemPrompt = res.data.roleSystemPrompt;
            roleName = res.data.roleName;
            roleChat = res.data.roleChat;
            $("#roleName2").val(roleName);
            $("#roleSystemChat2").val(systemPrompt);
            if (roleChat == null)
                return;
            for (var i = 0; i < roleChat.length; i++) {
                var str = `<tr>
                 <td><input type="text" class="form-control" maxlength="1024" value="${roleChat[i].userInput}" /></td>
                 <td><input type="text" class="form-control" maxlength="1024" value="${roleChat[i].assistantOutput}" /></td>
                 <td><i data-feather="delete" style="color:red;cursor:pointer;" onclick="delLine()"></i></td></tr>`;
                $("#AddRoleChat2").append(str);
            }
            feather.replace();
        },
        error: function (e) {
            sendok = true;
            console.log("失败" + e);
        }
    });
}