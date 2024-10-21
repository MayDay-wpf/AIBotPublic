$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#memory-nav").addClass('active');
    getMemory("", 50);
});
function getMemory(filter, limit) {
    loadingOverlay.show();
    $.ajax({
        url: "/Home/QueryData",
        type: "post",
        dataType: "json",//返回对象
        data: {
            limit: limit,
            filter: filter
        },
        success: function (res) {
            loadingOverlay.hide();
            if (res.success) {
                var data = res.data;
                var html = ``;
                for (var i = 0; i < data.length; i++) {
                    html += `<tr><td>${data[i].vectorContent}</td><td><button class="btn btn-danger" onclick="deleteMemory('${data[i].id}')">删除</button></td></tr>`;
                }
                $("#MemoryList").html(html);
            }
        },
        error: function () {
            loadingOverlay.hide();
        }
    });
}
function queryMemory() {
    var filter = $("#searchkey").val();
    if (filter != "")
        filter = `vectorcontent like "${filter}%"`;
    var limit = $("#limit").val();
    getMemory(filter, limit);
}
function deleteMemory(id) {
    $.ajax({
        url: "/Home/DeleteMemory",
        type: "post",
        dataType: "json",//返回对象
        data: {
            id: id
        },
        success: function (res) {
            queryMemory();
        }
    });
}