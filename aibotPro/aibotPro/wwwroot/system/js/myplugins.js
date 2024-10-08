$(function () {
    $('.nav-sub-link').removeClass('active');
    $('#dpSidebarBody .nav-link').removeClass('active');
    $("#cygf-main-menu").addClass('active');
    $("#cygf-main-menu").parent().addClass('show');
    $("#cygf-main-menu").parent().siblings().removeClass('show');
    $("#myplugins-cygf-nav").addClass('active');
    var tab = getUrlParam('tab');
    if (tab != '' && tab =='mycreate') {
        $('#MyCreated').tab('show');
        getPlugins();
    } else
        getMyInstall();
});
$(document).ready(function () {
    $(document).on('change', '.plugin-checkbox', function () {
        // 将所有其他的复选框设置为未选中
        $('.plugin-checkbox').not(this).prop('checked', false);
        // 获取选中的复选框的ID
        var selectedPluginId = $(this).data('plugin-id');
        var mustHit = this.checked;
        //发起请求
        $.ajax({
            type: 'Post',
            url: '/WorkShop/SetMandatoryHit',
            data: {
                id: selectedPluginId,
                mustHit: mustHit
            },
            success: function (res) {
                if (res.success) {
                    balert(res.msg, "success", false, 1500);
                } else {
                    balert(res.msg, "danger", false, 2000);
                }
            }
        });

    });
});
//window.onload = function () {
//    var elem = document.querySelector('#masonry-layout');
//    new Masonry(elem, {
//        // 选项
//        itemSelector: '.grid-item',
//        columnWidth: '.grid-item',
//        percentPosition: true
//    });
//    var elem_mine = document.querySelector('#masonry-layout-mine');
//    new Masonry(elem_mine, {
//        // 选项
//        itemSelector: '.grid-item',
//        columnWidth: '.grid-item',
//        percentPosition: true
//    });
//};
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
                    var change = item.mustHit ? 'checked' : '';
                    html += `<div class="col-lg-3 col-md-6 col-sm-12 mb-4 grid-item">
                                <div class="card h-100">
                                    <img class="card-img-top" style="width: 50px;height: 50px;margin:10px auto;"
                                        src="`+ item.pavatar + `">
                                    <div class="card-body">
                                        <h5 class="card-title">`+ item.pnickname + `</h5>
                                        <p class="card-text" style="max-height: 100px; overflow: auto;">`+ item.pfunctioninfo + `</p>
                                        <div class="d-flex justify-content-center flex-wrap">
                                            <button class="btn btn-sm btn-danger" onclick="uninstallPlugin(`+ item.id + `)"><i data-feather="trash-2"></i> 卸载</button>
                                        </div>
                                        <div style="display: flex; justify-content: center; align-items: center;">
                                            <label class="ml-2"><input type="checkbox" class="plugin-checkbox" name="mandatoryHit" data-plugin-id="` + item.installId + `" ${change}> 是否必须使用 <a href="#" class="header-help-link" onclick="mustHitInfo()"><i data-feather="help-circle"></i></a></label>
                                        </div>
                                    </div>
                                </div>
                            </div>`;
                }
                if (res.data.length == 0) {
                    html += '<div class="col-12 text-center grid-item">暂无数据</div>';
                }
                $('#masonry-layout').html(html);
                feather.replace();
                //var elem = document.querySelector('#masonry-layout');
                //new Masonry(elem, {
                //    // 选项
                //    itemSelector: '.grid-item',
                //    columnWidth: '.grid-item',
                //    percentPosition: true
                //});
            }
        }
    });
}

function mustHitInfo() {
    var content = `<p>当您勾选<b>必须使用</b>时，在创意工坊的每次对话都会调用此插件</p>`;
    showConfirmationModal("是否必须使用说明", content);
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
                    var controlButton = `<button class="btn btn-sm btn-warning" style="margin-right:10px" onclick="controlRelease(${item.id},'no','下架')">下架</button>`;
                    if (item.isPublic == "no") {
                        controlButton = `<button class="btn btn-sm btn-info" style="margin-right:10px" onclick="controlRelease(${item.id},'yes','上架')">上架</button>`;
                    }
                    html += `<div class="col-lg-3 col-md-6 col-sm-12 mb-4 grid-item">
                                <div class="card h-100">
                                    <img class="card-img-top" style="width: 50px;height: 50px;margin:10px auto;"
                                        src="${item.pavatar}">
                                    <div class="card-body">
                                        <h5 class="card-title">${item.pnickname}</h5>
                                        <p class="card-text" style="max-height: 100px; overflow: auto;">${item.pfunctioninfo}</p>
                                        <div class="d-flex justify-content-center">
                                            <button class="btn btn-sm btn-primary" style="margin-right:10px" onclick="editPlugin('${item.pcode}',${item.id})">编辑</button>
                                            <button class="btn btn-sm btn-success" style="margin-right:10px" onclick="insertMyPlugin(${item.id})">安装</button>
                                            ${controlButton}
                                            <button class="btn btn-sm btn-secondary" onclick="deletePlugin(${item.id})">删除</button>
                                        </div>
                                    </div>
                                </div>
                            </div>`;
                }
                if (res.data.length == 0) {
                    html += '<div class="col-12 text-center grid-item">暂无数据</div>';
                }
                $('#masonry-layout-mine').html(html);
                //setTimeout(function () {
                //    var elem_mine = document.querySelector('#masonry-layout-mine');
                //    new Masonry(elem_mine, {
                //        itemSelector: '.grid-item',
                //        columnWidth: '.grid-item',
                //        percentPosition: true
                //    });
                //}, 100); // 延迟100毫秒
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
                    balert('删除成功', 'success', false, 1500, 'center');
                    getPlugins();
                }
                else
                    balert(res.msg, "danger", false, 2000);
            }
        });
    });
}

function controlRelease(id, type, typetxt) {
    //询问框
    showConfirmationModal(`${typetxt}插件`, `确定要${typetxt}该插件吗？`, function () {
        $.ajax({
            type: 'Post',
            url: '/WorkShop/ControlRelease',
            data: {
                id: id,
                type: type
            },
            success: function (res) {
                if (res.success) {
                    balert(res.msg, 'success', false, 1500, 'top');
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
