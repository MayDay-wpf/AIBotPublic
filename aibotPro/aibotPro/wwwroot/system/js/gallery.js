let page = 1;
let pageSize = 12;
let loading = false;
let noMoreData = false;
$grid = $('#masonry-layout').masonry({
    itemSelector: '.grid-item',
    percentPosition: true
});

$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#usercenter-main-menu").addClass('active');
    $("#usercenter-main-menu").parent().toggleClass('show');
    $("#usercenter-main-menu").parent().siblings().removeClass('show');
    $("#gallery_usercenter_nav").addClass('active');
    getAIdrawResList();
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
//let $grid = $('#masonry-layout');

//function getAIdrawResList(type) {
//    if (type == 'init') {
//        page = 1;
//        pageSize = 12;
//    }
//    if (type == 'loadmore' && noMoreData) { // 加载更多但标志已表示没有更多数据
//        balert('没有更多了', "info", false, 1500, "center");
//        return; // 直接返回，不再进行请求
//    }
//    if (type == 'loadmore') {
//        page++;
//    }
//    if (type == 'reload') {
//        page = page;
//        pageSize = pageSize;
//    }
//    var data = {
//        page: page,
//        pageSize: pageSize
//    };
//    loadingOverlay.show();
//    $.ajax({
//        type: 'Post',
//        url: '/AIdraw/GetAIdrawResList',
//        data: data,
//        success: function (res) {
//            loadingOverlay.hide();
//            if (res.success) {
//                var html = '';
//                for (var i = 0; i < res.data.length; i++) {
//                    var item = res.data[i];
//                    var image = `<a href="${item.imgSavePath}" class="image-popup">
//                                          <img class="card-img-top img-fluid lazy" src="${item.imgSavePath}" style="aspect-ratio: 1 / 1; object-fit: cover;">
//                                        </a>`
//                    if (item.thumbSavePath != null && item.thumbSavePath !== '') {
//                        item.thumbSavePath = item.thumbSavePath.replace('wwwroot', '');
//                        image = `<a href="${item.imgSavePath}" class="image-popup">
//                                   <img class="card-img-top img-fluid lazy" src="${item.thumbSavePath}" style="aspect-ratio: 1 / 1; object-fit: cover;">
//                                 </a>`
//                    }
//                    html += `<div class="col-lg-3 col-md-6 col-sm-12 mb-4 grid-item">
//                                <div class="card h-100">
//                                    ${image}
//                                    <div class="card-body">
//                                        <p class="card-text" style="max-height: 100px; overflow: auto;">${item.prompt}</p>
//                                        <div class="d-flex justify-content-center">
//                                            <a href="${item.imgSavePath}" class="btn btn-primary" style="margin-right:10px;" download>下载</a>
//                                            <button class="btn btn-secondary" onclick="deleteImg(${item.id})">删除</button>
//                                        </div>
//                                    </div>
//                                </div>
//                            </div>`;
//                }
//                if (type == 'loadmore') {
//                    $grid.append(html);
//                    if (res.data.length < pageSize) {
//                        noMoreData = true;
//                    }
//                } else {
//                    if (res.data.length < pageSize) {
//                        noMoreData = true;
//                    }
//                    $grid.html(html);
//                }
//                $('.image-popup').magnificPopup({
//                    type: 'image'
//                });
//                var lazyLoadInstance = new LazyLoad();
//            }
//        }
//    });
//}
$(document).on('click', '.img-wrapper', function (e) {
    if (!$(e.target).is('.btn')) {
        var originalSrc = $(this).find('img').data('original');
        $.magnificPopup.open({
            items: {
                src: originalSrc
            },
            type: 'image'
        });
    }
});
function getAIdrawResList(type) {
    if (loading || noMoreData) {
        $(".row .d-block").removeClass("d-block").addClass("d-none");
        if (noMoreData)
            balert("没有更多了~", "warning", false, 1500, 'center');
        return;
    }
    if (type == 'reload') {
        pageSize = (page - 1) * pageSize;
        page = 1;
    }
    loading = true;
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
            if (res.success) {
                var html = '';
                for (var i = 0; i < res.data.length; i++) {
                    var item = res.data[i];
                    var image = `<img class="card-img-top img-fluid lazy" src="${item.imgSavePath}" style="width: 100%;">`
                    if (item.thumbSavePath != null && item.thumbSavePath !== '') {
                        item.thumbSavePath = item.thumbSavePath.replace('wwwroot', '');
                        image = `<img class="card-img-top img-fluid lazy" src="${item.thumbSavePath}" style="width: 100%;"></a>`
                    }
                    html += `<div class="grid-item col-lg-3 col-md-4 col-sm-6">
                                <div class="img-wrapper">
                                   <img class="img-fluid lazy" src="${item.thumbSavePath || item.imgSavePath}" style="width: 100%;" data-original="${item.imgSavePath}">
                                     <div class="img-overlay">
                                         <div class="overlay-content">
                                             <p class="prompt">${item.prompt}</p>
                                             <div class="btn-group">
                                                 <a href="${item.imgSavePath}" class="btn btn-primary btn-sm" download onclick="event.stopPropagation();"><i data-feather="download-cloud"></i> 下载</a>
                                                 <button class="btn btn-success btn-sm" onclick="event.stopPropagation();copyText(decodeURIComponent('${encodeURIComponent(item.prompt)}'))"><i data-feather="copy"></i> 复制提示词</button>
                                                 <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteImg(${item.id})"><i data-feather="trash-2"></i> 删除</button>
                                             </div>
                                         </div>
                                     </div>
                                </div>
                            </div>`;
                }
                var $items = $(html);
                if (type == 'reload') {
                    $grid.masonry('destroy');

                    // 清空 Masonry 容器内的内容
                    $('#masonry-layout').empty();
                    $grid = $('#masonry-layout').masonry({
                        itemSelector: '.grid-item',
                        percentPosition: true
                    });
                }
                $grid.append($items).masonry('appended', $items);
                $grid.imagesLoaded().progress(function () {
                    $grid.masonry('layout');
                });
                if (res.data.length < pageSize) {
                    noMoreData = true;
                } else {
                    page++;
                }
                loading = false;
                $('.image-popup').magnificPopup({
                    type: 'image'
                });
                var lazyLoadInstance = new LazyLoad();
                feather.replace();
                $(".row .d-none").removeClass("d-none").addClass("d-block");
                loadingOverlay.hide();
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
                    getAIdrawResList('reload');
                } else {
                    balert(res.msg, "danger", false, 1500);
                }
            }
        });
    });
}