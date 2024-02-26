$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#userslist-main-menu").addClass('active');
    $("#userslist-main-menu").parent().toggleClass('show');
    $("#userslist-main-menu").parent().siblings().removeClass('show');
    $("#userlist_userlists_nav").addClass('active');
    loadUsersList(page, page_size);
    $("#cards").val('');
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
        url: '/OpenAll/GetUsersList',
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
        var btn = `<button class="btn btn-danger" onclick="editUserEdit(${users[i].id},1)">加入黑名单</button>`;
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
function recharge() {
    var account = $("#account").val();
    var mcoin = $("#mcoin").val();
    if (account == "") {
        balert('请输入账号', 'danger', false, 1500, 'center');
        return;
    }
    if (mcoin == "" || mcoin <= 0) {
        balert('请输入充值金额', 'danger', false, 1500, 'center');
        return;
    }
    //发起充值请求
    loadingBtn('.recharge');
    $.ajax({
        url: '/OpenAll/Recharge',
        type: 'Post',
        data: {
            account: account,
            mcoin: mcoin
        },
        dataType: 'json',
        success: function (response) {
            unloadingBtn('.recharge');
            if (response.success) {
                balert('充值成功', 'success', false, 1500, 'center');
                loadUsersList(page, page_size);
            } else {
                balert('充值失败，请稍后再试', 'danger', false, 1500, 'center');
                sendExceptionMsg('手动充值余额失败');
            }
        },
        error: function (error) {
            loadingOverlay.hide();
            console.log(error);
            balert('充值失败，请稍后再试', 'danger', false, 1500, 'center');
            sendExceptionMsg(error);
        }
    });
}
function rechargevip() {
    var account = $("#account-vip").val();
    var viptype = $("#vipType").val();
    //发起充值请求
    loadingBtn('.rechargevip');
    $.ajax({
        url: '/OpenAll/RechargeVip',
        type: 'Post',
        data: {
            account: account,
            viptype: viptype
        },
        dataType: 'json',
        success: function (response) {
            unloadingBtn('.rechargevip');
            if (response.success) {
                balert('充值成功', 'success', false, 1500, 'center');
            } else {
                balert('充值失败，请稍后再试', 'danger', false, 1500, 'center');
                sendExceptionMsg('手动充值VIP失败');
            }
        },
        error: function (error) {
            loadingOverlay.hide();
            console.log(error);
            balert('充值失败，请稍后再试', 'danger', false, 1500, 'center');
            sendExceptionMsg(error);
        }
    });
}
function createAccount() {
    var account = $("#account-create").val();
    var password = $("#password").val();
    if (account == "" || password == "") {
        balert('请输入账号和密码', 'danger', false, 1500, 'center');
        return;
    }
    loadingBtn('.createaccount');
    $.ajax({
        url: '/OpenAll/CreateAccount',
        type: 'Post',
        data: {
            account: account,
            password: password
        },
        dataType: 'json',
        success: function (response) {
            unloadingBtn('.createaccount');
            if (response.success) {
                balert('创建成功', 'success', false, 1500, 'center');
                loadUsersList(page, page_size);
            } else {
                balert('创建失败，请稍后再试', 'danger', false, 1500, 'center');
            }
        },
        error: function (error) {
            loadingOverlay.hide();
            console.log(error);
            balert('创建失败，请稍后再试', 'danger', false, 1500, 'center');
        }
    });
}
function createCards() {
    var account = $("#account-card").val();
    var mcoin = $("#card-mcoin").val();
    var viptype = $("#card-viptype").val();
    var vipdays = $("#vip-days").val();
    var count = $("#card-count").val();
    if (account == "" && count == "") {
        balert('请输入账号和数量', 'danger', false, 1500, 'center');
        return;
    }
    loadingBtn('.createcards');
    $.ajax({
        url: '/OpenAll/CreateCards',
        type: 'Post',
        data: {
            account: account,
            mcoin: mcoin,
            viptype: viptype,
            vipdays: vipdays,
            count: count
        },
        dataType: 'json',
        success: function (response) {
            unloadingBtn('.createcards');
            if (response.success) {
                balert('创建成功', 'success', false, 1500, 'center');
                for (var i = 0; i < response.data.length; i++) {
                    //写入#cards文本框中
                    var card = response.data[i];
                    $("#cards").val($("#cards").val() + card + "\n");
                }
            } else {
                balert('创建失败，请稍后再试', 'danger', false, 1500, 'center');
            }
        },
        error: function (error) {
            loadingOverlay.hide();
            console.log(error);
            balert('创建失败，请稍后再试', 'danger', false, 1500, 'center');
        }
    });
}