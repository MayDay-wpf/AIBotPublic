$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#notification-main-menu").addClass('active');
    $("#notification-main-menu").parent().toggleClass('show');
    $("#notification-main-menu").parent().siblings().removeClass('show');
    $("#system_notification_nav").addClass('active');
});
function send() {
    var content = $('#content').val();
    if (content == "") {
        balert('请输入通知内容', 'danger', false, 1500, 'top');
        return;
    }
    loadingBtn('.send');
    //发起请求
    $.ajax({
        url: '/OpenAll/SendSystemNotice',
        type: 'Post',
        data: {
            content: content
        },
        dataType: 'json',
        success: function (response) {
            unloadingBtn('.send');
            if (response.success) {
                balert('发送成功', 'success', false, 1500, 'center');
            } else {
                balert(response.message, 'danger', false, 1500, 'center');
            }
        },
        error: function (error) {
            unloadingBtn('.send');
            console.log(error);
            balert('添加失败，请稍后再试', 'danger', false, 1500, 'center');
        }
    });
}