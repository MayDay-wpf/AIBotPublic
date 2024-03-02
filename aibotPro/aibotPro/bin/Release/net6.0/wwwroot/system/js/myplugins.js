$(function () {
    $('.nav-sub-link').removeClass('active');
    $('#dpSidebarBody .nav-link').removeClass('active');
    $("#cygf-main-menu").addClass('active');
    $("#cygf-main-menu").parent().addClass('show');
    $("#cygf-main-menu").parent().siblings().removeClass('show');
    $("#myplugins-cygf-nav").addClass('active');
    getMyInstall();
});

window.onload = function () {
    var elem = document.querySelector('#masonry-layout');
    new Masonry(elem, {
        // 选项
        itemSelector: '.grid-item',
        columnWidth: '.grid-item',
        percentPosition: true
    });
    var elem_mine = document.querySelector('#masonry-layout-mine');
    new Masonry(elem_mine, {
        // 选项
        itemSelector: '.grid-item',
        columnWidth: '.grid-item',
        percentPosition: true
    });
};
$('#myTab .nav-link').on('click', function (e) {
    var tabText = $(this).data('info');
    if (tabText === 'myinstall') {
        getMyInstall();
    } else if (tabText === 'mycreated') {
        getPlugins();
    }
});

function getMyInstall() {
    $.ajax({
        type: 'Post',
        url: '/WorkShop/GetMyInstall',
        success: function (res) {
            if (res.success) {
                var html = '';
                for (var i = 0; i < res.data.length; i++) {
                    var item = res.data[i];
                    html += `<div class="col-lg-3 col-md-6 col-sm-12 mb-4 grid-item">
                                <div class="card h-100">
                                    <img class="card-img-top" style="width: 50px;height: 50px;margin:10px auto;"
                                        src="`+ item.pavatar + `">
                                    <div class="card-body">
                                        <h5 class="card-title">`+ item.pnickname + `</h5>
                                        <p class="card-text">`+ item.pfunctioninfo + `</p>
                                        <div class="d-flex justify-content-center flex-wrap">
                                            <a href="#" class="btn btn-sm btn-secondary" onclick="uninstallPlugin(`+ item.id + `)">卸载</a>
                                        </div>
                                    </div>
                                </div>
                            </div>`;
                }
                if (res.data.length == 0) {
                    html += '<div class="col-12 text-center grid-item">暂无数据</div>';
                }
                $('#masonry-layout').html(html);
                var elem = document.querySelector('#masonry-layout');
                new Masonry(elem, {
                    // 选项
                    itemSelector: '.grid-item',
                    columnWidth: '.grid-item',
                    percentPosition: true
                });
            }
        }
    });
}

function getPlugins() {
    $.ajax({
        type: 'Post',
        url: '/WorkShop/GetMyPlugins',
        success: function (res) {
            if (res.success) {
                var html = '';
                for (var i = 0; i < res.data.length; i++) {
                    var item = res.data[i];
                    html += `<div class="col-lg-3 col-md-6 col-sm-12 mb-4 grid-item">
                                <div class="card h-100">
                                    <img class="card-img-top" style="width: 50px;height: 50px;margin:10px auto;"
                                        src="`+ item.pavatar + `">
                                    <div class="card-body">
                                        <h5 class="card-title">`+ item.pnickname + `</h5>
                                        <p class="card-text">`+ item.pfunctioninfo + `</p>
                                        <div class="d-flex justify-content-center flex-wrap">
                                            <a href="#" class="btn btn-sm btn-primary" style="margin-right:10px" onclick="editPlugin('`+ item.pcode + `',` + item.id + `)">编辑</a>
                                            <a href="#" class="btn btn-sm btn-success" style="margin-right:10px" onclick="insertMyPlugin(` + item.id + `)">安装</a>
                                            <a href="#" class="btn btn-sm btn-warning" style="margin-right:10px" onclick="closeRelease(`+ item.id + `)">下架</a>
                                            <a href="#" class="btn btn-sm btn-secondary" onclick="deletePlugin(`+ item.id + `)">删除</a>
                                        </div>
                                    </div>
                                </div>
                            </div>`;
                }
                if (res.data.length == 0) {
                    html += '<div class="col-12 text-center grid-item">暂无数据</div>';
                }
                $('#masonry-layout-mine').html(html);
                setTimeout(function () {
                    var elem_mine = document.querySelector('#masonry-layout-mine');
                    new Masonry(elem_mine, {
                        itemSelector: '.grid-item',
                        columnWidth: '.grid-item',
                        percentPosition: true
                    });
                }, 100); // 延迟100毫秒
            }
        }
    });
}
function insertMyPlugin(id) {
    //二次确认
    showConfirmationModal('安装插件', '确认安装此自制插件？', function () {
        //发起请求
        $.ajax({
            type: 'Post',
            url: '/WorkShop/InstallMyPlugin',
            data: { id: id },
            success: function (res) {
                if (res.success) {
                    balert(res.msg, "success", false, 1500);
                } else {
                    balert(res.msg, "danger", false, 2000);
                }
            }
        });
    });
}

function uninstallPlugin(id) {
    //询问框
    showConfirmationModal("卸载插件", "确定要卸载该插件吗？", function () {
        $.ajax({
            type: 'Post',
            url: '/WorkShop/UninstallPlugin',
            data: { id: id },
            success: function (res) {
                if (res.success) {
                    getMyInstall();
                }
                else
                    balert(res.msg, "danger", false, 2000);
            }
        });
    });
}

function deletePlugin(id) {
    //询问框
    showConfirmationModal("删除插件", "确定要删除该插件吗？", function () {
        $.ajax({
            type: 'Post',
            url: '/WorkShop/DeletePlugin',
            data: { id: id },
            success: function (res) {
                if (res.success) {
                    getPlugins();
                }
                else
                    balert(res.msg, "danger", false, 2000);
            }
        });
    });
}

function closeRelease(id) {
    //询问框
    showConfirmationModal("下架插件", "确定要下架该插件吗？", function () {
        $.ajax({
            type: 'Post',
            url: '/WorkShop/CloseRelease',
            data: { id: id },
            success: function (res) {
                if (res.success) {
                    balert('插件下架成功', 'success', false, 1500, 'top');
                    getPlugins();
                }
                else
                    balert(res.msg, "danger", false, 2000);
            }
        });
    });
}

function editPlugin(code, id) {
    window.location.href = '/WorkShop/MyWork?plugincode=' + code + '&id=' + id + '&type=edit';
}
