$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#assistant-main-menu").addClass('active');
    $("#assistant-main-menu").parent().toggleClass('show');
    $("#assistant-main-menu").parent().siblings().removeClass('show');
    $("#setting-assistant-nav").addClass('active');
})
$(document).ready(function () {
    // 定义一个函数来检查两个复选框是否都被选中
    function checkBothSelected() {
        if ($('#codeinterpreter').is(':checked') && $('#retrieval').is(':checked')) {
            $("#filegroup-assis").show();
        } else {
            $("#filegroup-assis").hide();
        }
    }

    // 监听第一个复选框的状态变化
    $('#codeinterpreter').change(function () {
        checkBothSelected(); // 检查是否都选中
    });

    // 监听第二个复选框的状态变化
    $('#retrieval').change(function () {
        checkBothSelected(); // 检查是否都选中
    });
});