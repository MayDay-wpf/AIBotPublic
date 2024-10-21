$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#system-main-menu").addClass('active');
    $("#system-main-menu").parent().toggleClass('show');
    $("#system-main-menu").parent().siblings().removeClass('show');
    $("#admin_system_nav").addClass('active');
    loadAdminList(page, page_size);
});

let page = 1;
let page_size = 15;
let total = 0;
function loadAdminList(page, page_size) {
    loadingOverlay.show();
    $.ajax({
        url: '/OpenAll/GetAdminList',
        type: 'Post',
        data: {
            page: page,
            page_size: page_size
        },
        dataType: 'json',
        success: function (response) {
            loadingOverlay.hide();
            if (response.success) {
                var admins = response.data;
                total = response.total;
                updateAdminList(admins);
                updatePagination(page, Math.ceil(total / page_size));
            } else {
                balert('加载失败，请稍后再试', 'danger', false, 1500, 'center');
            }
        },
        error: function (error) {
            loadingOverlay.hide();
            console.log(error);
            balert('加载失败，请稍后再试', 'danger', false, 1500, 'center');
        }
    });
}

function updateAdminList(admins) {
    var $adminList = $('#adminList');
    $adminList.empty(); // 清空现有的列表项
    var str = "";
    for (var i = 0; i < admins.length; i++) {
        str += `<tr><td>` + admins[i].account + `</td><td><button class="btn btn-danger" onclick="deleteAdmin('${admins[i].id}')">删除</button></td></tr>`;
    }
    $adminList.html(str);
}

// 更新分页
function updatePagination(currentPage, totalPages) {
    var $pagination = $('.pagination');
    $('li.page-item.dynamic').remove(); // 清除之前添加的页码

    const maxPagesToShow = 5; // 最多显示的页码数（含省略的...）
    let startPage, endPage;

    if (totalPages <= maxPagesToShow) {
        // 显示所有页码
        startPage = 1;
        endPage = totalPages;
    } else {
        // 计算显示的页码范围
        const maxPagesBeforeCurrentPage = Math.floor(maxPagesToShow / 2);
        const maxPagesAfterCurrentPage = Math.ceil(maxPagesToShow / 2) - 1;

        if (currentPage <= maxPagesBeforeCurrentPage) {
            startPage = 1;
            endPage = maxPagesToShow - 1;
        } else if (currentPage + maxPagesAfterCurrentPage >= totalPages) {
            startPage = totalPages - maxPagesToShow + 2;
            endPage = totalPages;
        } else {
            startPage = currentPage - maxPagesBeforeCurrentPage + 1;
            endPage = currentPage + maxPagesAfterCurrentPage;
        }
    }

    // 添加页码
    for (let i = startPage; i <= endPage; i++) {
        let $pageItem = $('<li class="page-item dynamic"><a class="page-link" href="#">' + i + '</a></li>');

        if (i === currentPage) {
            $pageItem.addClass('active');
        }

        $pageItem.insertBefore('#next-page').click(function (e) {
            e.preventDefault(); // 阻止默认事件
            var page = parseInt($(this).text());
            loadAdminList(page, page_size);
        });
    }

    // 处理省略的显示
    if (startPage > 1) {
        $('<li class="page-item dynamic"><span class="page-link">...</span></li>').insertBefore('.page-item.dynamic:first');
    }

    if (endPage < totalPages) {
        $('<li class="page-item dynamic"><span class="page-link">...</span></li>').insertBefore('#next-page');
    }

    // 更新上一页和下一页的状态
    $('#previous-page').off('click').toggleClass('disabled', currentPage === 1);
    if (currentPage > 1) {
        $('#previous-page').click(function (e) {
            e.preventDefault();
            loadAdminList(currentPage - 1, page_size);
        });
    }

    // 更新下一页按钮
    $('#next-page').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#next-page').click(function (e) {
            e.preventDefault();
            loadAdminList(currentPage + 1, page_size);
        });
    }
    // 更新首页和尾页的状态
    $('#first-page').off('click').toggleClass('disabled', currentPage === 1);
    if (currentPage > 1) {
        $('#first-page').click(function (e) {
            e.preventDefault();
            loadAdminList(1, page_size);  // 跳转到首页
        });
    }

    $('#last-page').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#last-page').click(function (e) {
            e.preventDefault();
            loadAdminList(totalPages, page_size);  // 跳转到尾页
        });
    }
}

function addAdmin() {
    var account = $('#account').val();
    if (account == "") {
        balert('请输入账号', 'danger', false, 1500, 'top');
        return;
    }
    loadingBtn('.addadmin');
    $.ajax({
        url: '/OpenAll/AddAdmin',
        type: 'Post',
        data: {
            account: account
        },
        dataType: 'json',
        success: function (response) {
            unloadingBtn('.addadmin');
            if (response.success) {
                balert('添加成功', 'success', false, 1500, 'top');
                $('#account').val('');
                loadAdminList(page, page_size);
            } else {
                balert(response.message, 'danger', false, 1500, 'top');
            }
        },
        error: function (error) {
            unloadingBtn('.addadmin');
            sendExceptionMsg(error);
            balert('添加失败，请稍后再试', 'danger', false, 1500, 'top');
        }
    });
}
function deleteAdmin(id) {
    //询问框
    showConfirmationModal("提醒", "确定要删除这个管理员吗？", function () {
        // 确认删除，发起请求
        $.ajax({
            url: '/OpenAll/DeleteAdmin',
            type: 'Post',
            data: {
                id: id
            },
            dataType: 'json',
            success: function (response) {
                if (response.success) {
                    balert('删除成功', 'success', false, 1500, 'center');
                    loadAdminList(page, page_size);
                } else {
                    balert('删除失败，请稍后再试', 'danger', false, 1500, 'center');
                }
            },
            error: function (error) {
                sendExceptionMsg(error);
                balert('添加失败，请稍后再试', 'danger', false, 1500, 'top');
            }
        });
    });
}