$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#knowledge-main-menu").addClass('active');
    $("#knowledge-main-menu").parent().toggleClass('show');
    $("#knowledge-main-menu").parent().siblings().removeClass('show');
    $("#management-knowledge-nav").addClass('active');
    getFiles('init');
})

let page = 1;
let pageSize = 12;
let noMoreData = false;
function getFiles(type) {
    loadingOverlay.show();
    var name = $('#searchKey').val();
    if (type == 'init') {
        page = 1;
        pageSize = 12;
    }
    if (type == 'loadmore' && noMoreData) { // 加载更多但标志已表示没有更多数据
        loadingOverlay.hide();
        balert('没有更多了', "info", false, 1500, "center");
        return; // 直接返回，不再进行请求
    }
    if (type == 'loadmore') {
        page++;
    }
    var data = {
        name: name,
        page: page,
        pageSize: pageSize
    };
    $.ajax({
        type: 'Post',
        url: '/KnowledgeAI/GetKnowledgeFiles',
        data: data,
        success: function (res) {
            loadingOverlay.hide();
            if (res.success) {
                var html = '';
                for (var i = 0; i < res.data.length; i++) {
                    var item = res.data[i];
                    //获取文件类型
                    var fileType = item.fileName.substring(item.fileName.lastIndexOf('.')).toLowerCase();
                    var avatarpath = '';
                    if (fileType == ".txt")
                        avatarpath = '/static/image/TXTimg.png';
                    else if (fileType == ".pdf")
                        avatarpath = '/static/image/PDF.png';
                    else if (fileType == ".pptx")
                        avatarpath = '/static/image/PPT.png';
                    else if (fileType == ".doc" || fileType == ".docx")
                        avatarpath = '/static/image/DOC.png';
                    else if (fileType == ".xls" || fileType == ".xlsx")
                        avatarpath = '/static/image/XLS.png';
                    else
                        avatarpath = '';
                    html += '<div class="col-lg-3 col-md-6 col-sm-12 mb-4 grid-item">';
                    html += '<div class="card h-100">';
                    html += '<img class="card-img-top" style="width: 50px;height: 50px;margin:10px auto;" src="' + avatarpath + '">';
                    html += '<div class="card-body">';
                    html += '<h5 class="card-title" style="max-height: 100px; overflow: auto;">' + item.fileName + '</h5>';
                    html += '<p class="card-text">' + item.createTime + '</p>';
                    html += '<div class="d-flex justify-content-center">';
                    html += `<a href="#" class="btn btn-danger" style="margin-right:10px;" onclick="deleteFiles('` + item.fileCode + `')">删除</a>`;
                    html += '</div>';
                    html += '</div>';
                    html += '</div>';
                    html += '</div>';
                }
                if (type == 'loadmore') {
                    $('#masonry-layout').append(html);
                    if (res.data.length < pageSize) {
                        noMoreData = true;
                    }
                } else {
                    $('#masonry-layout').html(html);
                    if (res.data.length < pageSize) {
                        noMoreData = true;
                    }
                }
            }
        },
        error: function (res) {
            loadingOverlay.hide();
        }
    });
}
function deleteFiles(fileCode) {
    showConfirmationModal('警告', '确认删除文件？', function () {
        //发送请求
        loadingOverlay.show();
        $.ajax({
            type: 'Post',
            url: '/KnowledgeAI/DeleteKnowledgeFiles',
            data: { fileCode: fileCode },
            success: function (res) {
                loadingOverlay.hide();
                if (res.success) {
                    balert('删除成功', "success", false, 1500);
                    getFiles('init');
                }
            }
        });
    })
}
function throttle(func, limit) {
    var lastFunc, lastRan;
    return function () {
        var context = this, args = arguments;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(function () {
                if ((Date.now() - lastRan) >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    }
}

$(window).scroll(throttle(function () {
    if ($(window).scrollTop() + $(window).height() >= $(document).height() && !isLoading) {
        isLoading = true;
        getFiles('loadmore');
    }
}, 500)); // limit to run every 250 milliseconds
$(document).keypress(function (e) {
    if ($("#searchKey").is(":focus")) {
        if (e.which == 13) {
            // 避免回车键换行
            e.preventDefault();
            getFiles('init');
        }
    }
});