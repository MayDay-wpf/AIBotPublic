$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#notification-main-menu").addClass('active');
    $("#notification-main-menu").parent().toggleClass('show');
    $("#notification-main-menu").parent().siblings().removeClass('show');
    $("#email_notification_nav").addClass('active');
});

function sendmail() {
    var tomail = $('#tomail').val();
    var mailtitle = $('#mailtitle').val();
    var mailcontent = $('#mailcontent').val();
    if (tomail == '') {
        balert('请输入收件人邮箱地址', 'danger', false, 1500, 'top');
        return;
    }
    if (mailtitle == '') {
        balert('请输入邮件标题', 'danger', false, 1500, 'top');
        return;
    }
    if (mailcontent == '') {
        balert('请输入邮件内容', 'danger', false, 1500, 'top');
        return;
    }
    loadingBtn('.sendmail');
    //发起请求
    $.ajax({
        url: '/OpenAll/SendMail',
        type: 'Post',
        data: {
            tomail: tomail,
            mailtitle: mailtitle,
            mailcontent: mailcontent
        },
        dataType: 'json',
        success: function (response) {
            unloadingBtn('.sendmail');
            if (response.success) {
                balert('发送成功', 'success', false, 1500, 'center');
            } else {
                balert(response.message, 'danger', false, 1500, 'center');
            }
        },
        error: function (error) {
            unloadingBtn('.sendmail');
            console.log(error);
            balert('添加失败，请稍后再试', 'danger', false, 1500, 'center');
        }
    });
}