$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#role-main-menu").addClass('active');
    $("#role-main-menu").parent().toggleClass('show');
    $("#role-main-menu").parent().siblings().removeClass('show');
    $("#list-role-nav").addClass('active');
    getRoleList('init');
});
let page = 1;
let pageSize = 12;
let noMoreData = false;
function getRoleList(type) {
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
        url: '/Role/GetRoleList',
        data: data,
        success: function (res) {
            loadingOverlay.hide();
            if (res.success) {
                var html = '';
                for (var i = 0; i < res.data.length; i++) {
                    var item = res.data[i];
                    html += '<div class="col-lg-3 col-md-6 col-sm-12 mb-4 grid-item">';
                    html += '<div class="card h-100">';
                    html += '<img class="card-img-top" style="width: 50px;height: 50px;margin:10px auto;" src="' + item.roleAvatar + '">';
                    html += '<div class="card-body">';
                    html += '<h5 class="card-title">' + item.roleName + '</h5>';
                    html += '<p class="card-text" style="max-height: 100px; overflow: auto;">' + item.roleInfo + '</p>';
                    html += '<div class="d-flex justify-content-center">';
                    html += `<a href="/Role/RoleChat?type=` + item.roleCode + `" class="btn btn-primary" style="margin-right:10px;">对话</a>`;
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
//function throttle(func, limit) {
//    var lastFunc, lastRan;
//    return function () {
//        var context = this, args = arguments;
//        if (!lastRan) {
//            func.apply(context, args);
//            lastRan = Date.now();
//        } else {
//            clearTimeout(lastFunc);
//            lastFunc = setTimeout(function () {
//                if ((Date.now() - lastRan) >= limit) {
//                    func.apply(context, args);
//                    lastRan = Date.now();
//                }
//            }, limit - (Date.now() - lastRan));
//        }
//    }
//}

//$(window).scroll(throttle(function () {
//    if ($(window).scrollTop() + $(window).height() >= $(document).height() && !isLoading) {
//        isLoading = true;
//        getRoleList('loadmore');
//    }
//}, 500)); // limit to run every 250 milliseconds
$(document).keypress(function (e) {
    if ($("#searchKey").is(":focus")) {
        if (e.which == 13) {
            // 避免回车键换行
            e.preventDefault();
            getRoleList('init');
        }
    }
});