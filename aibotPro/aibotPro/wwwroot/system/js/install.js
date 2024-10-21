$(function () {
    checkDatabase();
})
function checkDatabase() {
    $("#logArea").append(`<p style="color:rgb(13,138,219)">正在检查数据库连接...</p>`);
    $.ajax({
        type: 'Post',
        url: '/Home/CheckDataBaseServer',
        success: function (res) {
            if (res.success) {
                $("#logArea").append(`<p style="color:rgb(21,211,106)">√ ${res.msg}</p>`);
                checkRedis();
            } else {
                $("#logArea").append(`<p style="color:rgb(134,27,45)">× ${res.msg}</p>`);
            }
        }, error: function (res) {
            $("#logArea").append(`<p style="color:rgb(134,27,45)">× 系统错误：${res}</p>`);
        }
    });
}
function checkRedis() {
    $("#logArea").append(`<p style="color:rgb(13,138,219)">正在检查Redis连接...</p>`);
    $.ajax({
        type: 'Post',
        url: '/Home/CheckRedis',
        success: function (res) {
            if (res.success) {
                $("#logArea").append(`<p style="color:rgb(21,211,106)">√${res.msg}</p>` + "<br>");
                $(".installStep").show();
            } else {
                $("#logArea").append(`<p style="color:rgb(134,27,45)">×${res.msg}</p>` + "<br>");
            }
        }, error: function (res) {
            $("#logArea").append(`<p style="color:rgb(134,27,45)">× 系统错误：${res}</p>`);
        }
    });
}
function createAdmin() {
    $("#logArea").append(`<p style="color:rgb(13,138,219)">正在创建管理员...</p>`);
    $.ajax({
        type: 'Post',
        url: '/Home/CreateAdmin',
        data: {
            Account: $("#adminUsername").val(),
            Password: $("#adminPassword").val(),
        },
        success: function (res) {
            if (res.success) {
                $("#logArea").append(`<p style="color:rgb(21,211,106)">√${res.msg}</p>` + "<br>");
                createSystemCfg();
            } else {
                $("#logArea").append(`<p style="color:rgb(134,27,45)">×${res.msg}</p>` + "<br>");
            }
        }, error: function (res) {
            $("#logArea").append(`<p style="color:rgb(134,27,45)">× 系统错误：${res}</p>`);
        }
    });
}
function createSystemCfg() {
    $("#logArea").append(`<p style="color:rgb(13,138,219)">正在创建系统配置...</p>`);
    $.ajax({
        type: 'Post',
        url: '/Home/CreateSystemCfg',
        success: function (res) {
            if (res.success) {
                window.location.href = "/Home/Index";
            } else {
                $("#logArea").append(`<p style="color:rgb(134,27,45)">×${res.msg}</p>` + "<br>");
            }
        }, error: function (res) {
            $("#logArea").append(`<p style="color:rgb(134,27,45)">× 系统错误：${res}</p>`);
        }
    });
}