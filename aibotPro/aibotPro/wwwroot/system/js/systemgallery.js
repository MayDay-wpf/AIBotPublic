let page = 1;
let pageSize = 30;
let loading = false;
let noMoreData = false;
$grid = $('#masonry-layout').masonry({
    itemSelector: '.grid-item',
    percentPosition: true
});

$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#systemgallery-nav").addClass('active');
    getAIdrawResList();
});
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
        pageSize: pageSize,
        role: "system"
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
                                                 <button class="btn btn-success btn-sm"  data-prompt="${encodeURIComponent(item.prompt)}" onclick="event.stopPropagation();handleClick(this)"><i data-feather="copy"></i> 复制提示词</button>
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
function handleClick(btn) {
    const encodedPrompt = btn.getAttribute('data-prompt');
    const prompt = decodeURIComponent(encodedPrompt);
    copyText(prompt);
}
