$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#usercenter-main-menu").addClass('active');
    $("#usercenter-main-menu").parent().toggleClass('show');
    $("#usercenter-main-menu").parent().siblings().removeClass('show');
    $("#user_newapi_nav").addClass('active');
    $('#accountType').change(function () {
        if ($(this).val() === 'create') {
            $('#passwordGroup').show();
            $('#password').prop('required', true);
        } else {
            $('#passwordGroup').hide();
            $('#password').prop('required', false);
        }
    });

    $('#togglePassword').click(function () {
        const passwordInput = $('#password');
        const passwordFieldType = passwordInput.attr('type');

        if (passwordFieldType === 'password') {
            passwordInput.attr('type', 'text');
            $(this).find('i').removeClass('fa-eye').addClass('fa-eye-slash');
        } else {
            passwordInput.attr('type', 'password');
            $(this).find('i').removeClass('fa-eye-slash').addClass('fa-eye');
        }
    });
    isBind();
});

function isBind() {
    loadingOverlay.show();
    $.ajax({
        url: "/NewApi/UserIsBinded/",
        type: "post",
        dataType: "json",//返回对象
        async: false,
        success: function (res) {
            if (res.success) {
                getBindInfo();
                $("#bindInfo").show();
                $("#bindorcreate").hide();
            } else {
                loadingOverlay.hide();
                $("#bindorcreate").show();
                $("#bindInfo").hide();
            }
        },
        error: function (e) {
            loadingOverlay.hide();
            console.log("失败" + e);
            sendExceptionMsg(e);
        }
    });
}

function bindUser() {
    loadingBtn(".bind");
    var type = $("#accountType").val();
    var username = $("#username").val();
    var password = $("#password").val();

    // 用户名验证
    if (!/^[a-zA-Z0-9]{4,20}$/.test(username)) {
        balert("用户名只允许4-20位字母和数字组合", "danger", true, 2000, "top");
        unloadingBtn(".bind");
        return;
    }

    // 密码验证
    if (type == "create") {
        if (password === "") {
            balert("请输入密码", "danger", true, 2000, "top");
            unloadingBtn(".bind");
            return;
        }
        if (password.length < 6 || password.length > 20) {
            balert("密码长度必须在6-20位之间", "danger", true, 2000, "top");
            unloadingBtn(".bind");
            return;
        }
    }

    $.ajax({
        url: "/NewApi/UserBindNewApi",
        type: "post",
        data: {
            newapiAcount: username,
            password: password
        },
        dataType: "json",//返回对象
        success: function (res) {
            unloadingBtn(".bind");
            if (res.success) {
                balert("成功", "success", false, 2000, "top");
                isBind();
            } else {
                balert(res.msg, "danger", true, 2000, "top");
            }
        },
        error: function (e) {
            unloadingBtn(".bind");
            balert("失败", "danger", true, 2000, "top");
            sendExceptionMsg(e);
        }
    });
}

function getBindInfo() {
    $.ajax({
        url: "/NewApi/GetNewApiUserInfo",
        type: "post",
        dataType: "json",//返回对象
        success: function (res) {
            loadingOverlay.hide();
            if (res.success) {
                $("#newApiId").text(res.data.id);
                $("#newusername").text(res.data.username);
                $("#newapiUrl").html(`<a href="${res.data.newapiUrl}" target="_blank">${res.data.newapiUrl}</a>`);
                todayIsCheckIn();
            } else {
                balert(res.msg, "danger", true, 2000, "top");
            }
        },
        error: function (e) {
            loadingOverlay.hide();
            balert("失败", "danger", true, 2000, "top");
            sendExceptionMsg(e);
        }
    });
}

function newApiCheckIn() {
    loadingBtn(".checkin");
    $.ajax({
        url: "/NewApi/NewApiCheckIn",
        type: "post",
        dataType: "json",//返回对象
        success: function (res) {
            unloadingBtn(".checkin");
            if (res.success) {
                balert("签到成功", "success", false, 2000, "top");
                $("#exchangeCode").val(res.msg);
                // 禁用签到按钮
                $(".checkin")
                    .attr("disabled", "disabled")
                    .css("cursor", "not-allowed"); // 修改鼠标样式
                $(".checkin").html(`<i class="fas fa-check-circle"></i>今日已签到`);
            } else {
                balert(res.msg, "danger", true, 2000, "top");
            }
        },
        error: function (e) {
            unloadingBtn(".checkin");
            balert("请求失败", "danger", true, 2000, "top");
            sendExceptionMsg(e);
        }
    });
}

function todayIsCheckIn() {
    $.ajax({
        url: "/NewApi/TodayIsCheckedIn",
        type: "post",
        dataType: "json", // 返回对象
        success: function (res) {
            if (res.success) {
                // 禁用签到按钮
                $(".checkin")
                    .attr("disabled", "disabled")
                    .css("cursor", "not-allowed"); // 修改鼠标样式
                $(".checkin").html(`<i class="fas fa-check-circle"></i>今日已签到`);
            }
        },
        error: function (e) {
            balert("请求失败", "danger", true, 2000, "top");
        }
    });
}

function createCard() {
    var generateAmount = $("#generateAmount").val();
    if (generateAmount == "") {
        balert("请输入要生成的金额", "danger", true, 2000, "top");
        return;
    }
    loadingBtn("#generateBtn")
    $.ajax({
        url: "/NewApi/CreateCard",
        type: "post",
        data: {
            amount: generateAmount
        },
        dataType: "json",//返回对象
        success: function (res) {
            unloadingBtn("#generateBtn");
            if (res.success) {
                balert("生成成功", "success", false, 2000, "top");
                $("#apiCode").val(res.msg);
            } else
                balert(res.msg, "danger", true, 2000, "top");
        },
        error: function (e) {
            unloadingBtn("#generateBtn");
            balert("请求失败", "danger", true, 2000, "top");
            sendExceptionMsg(e);
        }
    });
}