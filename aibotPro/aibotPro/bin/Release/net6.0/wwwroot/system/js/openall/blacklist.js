$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#userslist-main-menu").addClass('active');
    $("#userslist-main-menu").parent().toggleClass('show');
    $("#userslist-main-menu").parent().siblings().removeClass('show');
    $("#blacklist_userlists_nav").addClass('active');
    loadUsersList(page, page_size);
});
let page = 1;
let page_size = 15;
let total = 0;
$(document).keypress(function (e) {
    if ($("#name").is(":focus")) {
        if (e.which == 13) {
            // 避免回车键换行
            e.preventDefault();
            loadUsersList(page, page_size);
        }
    }
});
function processData(data, key) {
    let modelData = {};
    data.forEach(d => {
        if (!modelData[d.modelName]) {
            modelData[d.modelName] = 0;
        }
        if (key === 'money') {
            modelData[d.modelName] += d.useMoney;
        } else {
            modelData[d.modelName] += d.inputCount + d.outputCount;
        }
    });
    return Object.entries(modelData).map(([name, value]) => ({ name, value }));
}

function loadUsersList(page, page_size) {
    var name = $('#name').val();
    loadingOverlay.show();
    $.ajax({
        url: '/OpenAll/GetBlackList',
        type: 'Post',
        data: {
            page: page,
            page_size: page_size,
            name: name
        },
        dataType: 'json',
        success: function (response) {
            loadingOverlay.hide();
            if (response.success) {
                var users = response.data;
                total = response.total;
                updateUsersList(users);
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
function updateUsersList(users) {
    var $usersList = $('#usersList');
    $usersList.empty(); // 清空现有的列表项
    var str = "";
    for (var i = 0; i < users.length; i++) {
        var btn = `<button class="btn btn-success" onclick="editUserEdit(${users[i].id},0)">移出黑名单</button>`;
        str += `<tr><td><img src="${users[i].headImg}" style="width:50px;height:50px;" /></td>
                    <td>${users[i].account}</td>
                    <td>${users[i].nick}</td>
                    <td>${users[i].mcoin}</td>
                    <td>${users[i].createTime}</td>
                    <td>${btn}</td></tr>`;
    }
    $usersList.html(str);
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
            endPage = maxPagesToShow;
        } else if (currentPage + maxPagesAfterCurrentPage >= totalPages) {
            startPage = totalPages - maxPagesToShow + 1;
            endPage = totalPages;
        } else {
            startPage = currentPage - maxPagesBeforeCurrentPage;
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
            loadUsersList(page, page_size);
        });
    }

    // 处理省略的显示
    if (startPage > 1) {
        $('<li class="page-item dynamic"><span class="page-link">...</span></li>').insertBefore('#next-page');
    }

    if (endPage < totalPages) {
        $('<li class="page-item dynamic"><span class="page-link">...</span></li>').insertBefore('#next-page');
    }

    // 更新上一页和下一页的状态
    $('#previous-page').off('click').toggleClass('disabled', currentPage === 1);
    if (currentPage > 1) {
        $('#previous-page').click(function (e) {
            e.preventDefault();
            loadUsersList(currentPage - 1, page_size);
        });
    }

    // 更新下一页按钮
    $('#next-page').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#next-page').click(function (e) {
            e.preventDefault();
            loadUsersList(currentPage + 1, page_size);
        });
    }
}
function editUserEdit(id, type) {
    loadingOverlay.show();
    $.ajax({
        url: '/OpenAll/EditUserEdit',
        type: 'Post',
        data: {
            id: id,
            type: type
        },
        dataType: 'json',
        success: function (response) {
            loadingOverlay.hide();
            if (response.success) {
                balert('操作成功', 'success', false, 1500, 'center');
                loadUsersList(page, page_size);
            } else {
                balert('操作失败，请稍后再试', 'danger', false, 1500, 'center');
            }
        },
        error: function (error) {
            loadingOverlay.hide();
            console.log(error);
            balert('操作失败，请稍后再试', 'danger', false, 1500, 'center');
        }
    });
}