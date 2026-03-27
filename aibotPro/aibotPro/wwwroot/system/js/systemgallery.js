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
// 滚动事件监听器
$(window).scroll(function () {
    if (loading || noMoreData) return;

    // 当接近页面底部时触发
    if ($(window).scrollTop() + $(window).height() > $(document).height() - 100) {
        getAIdrawResList('scroll');
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
    $('#load-more-message').text('正在加载更多内容...').show();
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
                    // 管理员控制按钮 (删除 & NSFW)
                    let adminControls = '';
                    if (IsAdmin) {
                        adminControls = `
                            <button class="btn btn-danger btn-sm" data-id="${item.id}" onclick="event.stopPropagation();deleteImage(this)"><i data-feather="trash-2"></i> 删除</button>
                            <button class="btn btn-warning btn-sm" data-id="${item.id}" onclick="event.stopPropagation();toggleNsfw(this)"><i data-feather="${item.nsfw ? 'eye' : 'eye-off'}"></i> ${item.nsfw ? '取消NSFW' : '标记NSFW'}</button>
                        `;  //根据 item.isNsfw 动态显示按钮文本
                    }
                    let nsfwOverlay = '';
                    if (item.nsfw) {
                        nsfwOverlay = `
                            <div class="nsfw-overlay" onclick="event.stopPropagation();showImage(this)">
                                <div class="nsfw-blur"></div>
                                <div class="nsfw-text">
                                    <i data-feather="eye-off"></i> NSFW Content<br>
                                    点击显示
                                </div>
                            </div>
                        `;
                    }
                    html += `<div class="grid-item col-lg-3 col-md-4 col-sm-6">
                                <div class="img-wrapper ${item.nsfw ? 'nsfw-wrapper' : ''}">
                                   <img class="img-fluid lazy" src="${item.thumbSavePath || item.imgSavePath}" style="width: 100%;" data-original="${item.imgSavePath}">
                                     ${nsfwOverlay}
                                     <div class="img-overlay">
                                         <div class="overlay-content">
                                             <p class="prompt">${item.prompt}</p>
                                             <div class="btn-group">
                                                 <a href="${item.imgSavePath}" class="btn btn-primary btn-sm" download onclick="event.stopPropagation();"><i data-feather="download-cloud"></i> 下载</a>
                                                 <button class="btn btn-success btn-sm"  data-prompt="${encodeURIComponent(item.prompt)}" onclick="event.stopPropagation();handleClick(this)"><i data-feather="copy"></i> 复制提示词</button>
                                                 ${adminControls} 
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
                    $('#load-more-message').text('到底了~').show();
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
            } else {
                $('#load-more-message').text('加载失败，请重试').show();
            }
        },
        error: function () {
            loading = false;
            loadingOverlay.hide();
            $('#load-more-message').text('加载失败，请重试').show();
        }
    });
}
function handleClick(btn) {
    const encodedPrompt = btn.getAttribute('data-prompt');
    const prompt = decodeURIComponent(encodedPrompt);
    copyText(prompt);
}

// 删除图片的函数 (需要实现)
function deleteImage(element) {
    const imageId = element.dataset.id;
    showConfirmationModal("提示", "确定删除这张图片吗？", function () {
        // 发送 AJAX 请求到后端删除图片
        $.ajax({
            type: 'POST', // 或者 'DELETE', 取决于你的后端 API
            url: '/AIdraw/DeleteAIdrawResByAdmin',  // 替换为你的删除 API 端点
            data: {id: imageId},
            success: function (response) {
                if (response.success) {
                    // 从 DOM 中移除图片元素
                    $(element).closest('.grid-item').remove();
                    // 重新布局 Masonry
                    $grid.masonry('layout');
                    balert("删除成功！", "success", false, 1500, 'center');
                } else {
                    balert("删除失败：" + response.msg, "danger", false, 3000, 'center'); // 显示错误信息
                }
            },
            error: function () {
                balert("删除失败：服务器错误", "danger", false, 3000, 'center');
            }
        });
    });
}

// 切换 NSFW 标记的函数 (需要实现)
function toggleNsfw(element) {
    const imageId = element.dataset.id;
    // 发送 AJAX 请求到后端更新 NSFW 标记
    $.ajax({
        type: 'POST',
        url: '/AIdraw/ToggleNsfw',
        data: {id: imageId},
        success: function (response) {
            if (response.success) {
                // 更新按钮文本和图标
                const button = $(element);
                const isNsfw = response.isNsfw;
                button.find('i').attr('data-feather', isNsfw ? 'eye' : 'eye-off');
                button.html(`<i data-feather="${isNsfw ? 'eye' : 'eye-off'}"></i> ${isNsfw ? '取消NSFW' : '标记NSFW'}`);
                feather.replace();

                balert(response.msg, "success", false, 1500, 'center');
                const imgWrapper = button.closest('.img-wrapper');
                if (isNsfw) {
                    imgWrapper.addClass('nsfw-wrapper');
                    imgWrapper.append(`
                        <div class="nsfw-overlay" onclick="event.stopPropagation();showImage(this)">
                            <div class="nsfw-blur"></div>
                            <div class="nsfw-text">
                                <i data-feather="eye-off"></i> NSFW Content<br>
                                点击显示
                            </div>
                        </div>
                    `);
                    feather.replace(); // Re-render after adding
                } else {
                    imgWrapper.removeClass('nsfw-wrapper');
                    imgWrapper.find('.nsfw-overlay').remove();
                }
            } else {
                balert("操作失败：" + response.msg, "danger", false, 3000, 'center');
            }
        },
        error: function () {
            balert("操作失败：服务器错误", "danger", false, 3000, 'center');
        }
    });
}

function showImage(overlayElement) {
    $(overlayElement).fadeOut(300, function () {
        $(this).remove();
    });
}