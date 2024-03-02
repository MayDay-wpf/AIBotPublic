let page = 1;
let pageSize = 10;
let isLoading = false;

$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#usercenter-main-menu").addClass('active');
    $("#usercenter-main-menu").parent().toggleClass('show');
    $("#usercenter-main-menu").parent().siblings().removeClass('show');
    $("#gallery_usercenter_nav").addClass('active');
    getAIdrawResList('init');
});
//window.onload = () => {
//    var elem = document.querySelector('#masonry-layout');
//    new Masonry(elem, {
//        // 选项
//        itemSelector: '.grid-item',
//        columnWidth: '.grid-item',
//        percentPosition: true
//    });
//};
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
//        getAIdrawResList('loadmore');
//    }
//}, 500)); // limit to run every 250 milliseconds
let $grid = $('#masonry-layout');
let noMoreData = false;
function getAIdrawResList(type) {
    if (type == 'init') {
        page = 1;
        pageSize = 10;
    }
    if (type == 'loadmore' && noMoreData) { // 加载更多但标志已表示没有更多数据
        balert('没有更多了', "info", false, 1500, "center");
        return; // 直接返回，不再进行请求
    }
    if (type == 'loadmore') {
        page++;
    }
    var data = {
        page: page,
        pageSize: pageSize
    };
    loadingOverlay.show();
    $.ajax({
        type: 'Post',
        url: '/AIdraw/GetAIdrawResList',
        data: data,
        success: function (res) {
            loadingOverlay.hide();
            if (res.success) {
                var html = '';
                for (var i = 0; i < res.data.length; i++) {
                    var item = res.data[i];
                    html += `<div class="col-lg-3 col-md-6 col-sm-12 mb-4 grid-item">
                                <div class="card h-100">
                                    <a href="${item.imgSavePath}" class="image-popup">
                                        <img class="card-img-top img-fluid" src="${item.imgSavePath}" style="aspect-ratio: 1 / 1; object-fit: cover;">
                                    </a>
                                    <div class="card-body">
                                        <p class="card-text" style="max-height: 100px; overflow: auto;">${item.prompt}</p>
                                        <div class="d-flex justify-content-center">
                                            <a href="${item.imgSavePath}" class="btn btn-primary" style="margin-right:10px;" download>下载</a>
                                            <a href="#" class="btn btn-secondary" onclick="deleteImg(${item.id})">删除</a>
                                        </div>
                                    </div>
                                </div>
                            </div>`;
                }
                if (type == 'loadmore') {
                    $grid.append(html);
                    if (res.data.length < pageSize) {
                        noMoreData = true;
                    }
                } else
                    $grid.html(html);
                $('.image-popup').magnificPopup({
                    type: 'image'
                });

            }
        }
    });
}
function deleteImg(id) {
    //询问框
    showConfirmationModal('提醒', '图片删除后无法恢复，确认删除？', function () {
        loadingOverlay.show();
        $.ajax({
            type: 'Post',
            url: '/AIdraw/DeleteAIdrawRes',
            data: { id: id },
            success: function (res) {
                loadingOverlay.hide();
                if (res.success) {
                    balert('删除成功', "success", false, 1500);
                    //浏览器刷新
                    location.reload();
                } else {
                    balert(res.msg, "danger", false, 1500);
                }
            }
        });
    });
}