let page = 1;
let pageSize = 10;
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
$(window).scroll(function () {
    // 检查用户是否滚动到页面底部
    // window的滚动高度 + window的高度 >= 整个document的高度
    if ($(window).scrollTop() + $(window).height() >= $(document).height()) {
        getAIdrawResList('loadmore');
    }
});
function getAIdrawResList(type) {
    if (type == 'init') {
        page = 1;
        pageSize = 10;
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
                                    <a href="${item.imgSavePath}" id="resimgurl-a" class="image-popup">
                                        <img class="card-img-top img-fluid" src="${item.imgSavePath}">
                                    </a>
                                    <div class="card-body">
                                        <p class="card-text">${item.prompt}</p>
                                        <div class="d-flex justify-content-center">
                                            <a href="${item.imgSavePath}" class="btn btn-primary" style="margin-right:10px;" download>下载</a>
                                            <a href="#" class="btn btn-secondary" onclick="deleteImg(${item.id})">删除</a>
                                        </div>
                                    </div>
                                </div>
                            </div>`;
                }
                if (type == 'loadmore') {
                    $('#masonry-layout').append(html);
                    if (res.data.length < pageSize) {
                        balert('没有更多了', "info", false, 1500);
                        page--;
                    }
                } else
                    $('#masonry-layout').html(html);
                let $grid = $('#masonry-layout');
                $grid.imagesLoaded(function () {
                    // 如果是初始化，则正常初始化 Masonry
                    $grid.masonry({
                        itemSelector: '.grid-item',
                        columnWidth: '.grid-item',
                        percentPosition: true
                    });
                });

                $('.image-popup').magnificPopup({
                    type: 'image',
                    gallery: {
                        enabled: true
                    }
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