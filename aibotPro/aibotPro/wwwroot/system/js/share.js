$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#usercenter-main-menu").addClass('active');
    $("#usercenter-main-menu").parent().toggleClass('show');
    $("#usercenter-main-menu").parent().siblings().removeClass('show');
    $("#user_share_nav").addClass('active');
    getShareInfo();
    loadMyShareList(page, page_size);
    loadLogList(page_log, page_size_log);
    createShareLink();
});
let page = 1;
let page_size = 15;
let total = 0;

let page_log = 1;
let page_size_log = 15;
let total_log = 0;
function createShareLink() {
    //发起请求
    $.ajax({
        url: "/Users/CreateShareLink",
        type: "POST",
        success: function (data) {
            if (data.success) {
                $("#shareLink").val(data.data);
            }
        }
    });
}
function getShareInfo() {
    //发起请求
    $.ajax({
        url: "/Users/GetShareInfo",
        type: "POST",
        success: function (data) {
            if (data.success) {
                $("#shareMcoin").text(data.data.mcoin);
            }
        }
    });
}

function loadMyShareList(page, page_size) {
    loadingOverlay.show();
    $.ajax({
        url: '/Users/GetMyShare',
        type: 'Post',
        data: {
            page: page,
            pageSize: page_size
        },
        dataType: 'json',
        success: function (response) {
            loadingOverlay.hide();
            if (response.success) {
                var users = response.data;
                total = response.total;
                updateMyShareList(users);
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
function updateMyShareList(users) {
    var $usersList = $('#usersList');
    $usersList.empty(); // 清空现有的列表项
    var str = "";
    for (var i = 0; i < users.length; i++) {
        str += `<tr>
                    <td>${users[i].account}</td>
                    <td>${users[i].createTime}</td>
               </tr>`;
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
            loadMyShareList(page, page_size);
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
            loadMyShareList(currentPage - 1, page_size);
        });
    }

    // 更新下一页按钮
    $('#next-page').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#next-page').click(function (e) {
            e.preventDefault();
            loadMyShareList(currentPage + 1, page_size);
        });
    }
    // 更新首页和尾页的状态
    $('#first-page').off('click').toggleClass('disabled', currentPage === 1);
    if (currentPage > 1) {
        $('#first-page').click(function (e) {
            e.preventDefault();
            loadMyShareList(1, page_size);  // 跳转到首页
        });
    }

    $('#last-page').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#last-page').click(function (e) {
            e.preventDefault();
            loadMyShareList(totalPages, page_size);  // 跳转到尾页
        });
    }
}



function loadLogList(page_log, page_size_log) {
    loadingOverlay.show();
    $.ajax({
        url: '/Users/GetShareLog',
        type: 'Post',
        data: {
            page: page_log,
            pageSize: page_size_log
        },
        dataType: 'json',
        success: function (response) {
            loadingOverlay.hide();
            if (response.success) {
                var log = response.data;
                total_log = response.total;
                updateLogList(log);
                updateLogPagination(page, Math.ceil(total_log / page_size_log));
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
function updateLogList(log) {
    var $logList = $('#logList');
    $logList.empty(); // 清空现有的列表项
    var str = "";
    for (var i = 0; i < log.length; i++) {
        str += `<tr>
                    <td>${log[i].logTxt}</td>
                    <td>${log[i].createTime}</td>
               </tr>`;
    }
    $logList.html(str);
}

// 更新分页
function updateLogPagination(currentPage, totalPages) {
    var $pagination = $('.pagination-log');
    $('li.page-item.log.dynamic').remove(); // 清除之前添加的页码

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
        let $pageItem = $('<li class="page-item log dynamic"><a class="page-link log" href="#">' + i + '</a></li>');

        if (i === currentPage) {
            $pageItem.addClass('active');
        }

        $pageItem.insertBefore('#next-page-log').click(function (e) {
            e.preventDefault(); // 阻止默认事件
            var page = parseInt($(this).text());
            loadLogList(page, page_size_log);
        });
    }

    // 处理省略的显示
    if (startPage > 1) {
        $('<li class="page-item log dynamic"><span class="page-link log">...</span></li>').insertBefore('#next-page-log');
    }

    if (endPage < totalPages) {
        $('<li class="page-item log dynamic"><span class="page-link log">...</span></li>').insertBefore('#next-page-log');
    }

    // 更新上一页和下一页的状态
    $('#previous-page-log').off('click').toggleClass('disabled', currentPage === 1);
    if (currentPage > 1) {
        $('#previous-page-log').click(function (e) {
            e.preventDefault();
            loadLogList(currentPage - 1, page_size_log);
        });
    }

    // 更新下一页按钮
    $('#next-page-log').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#next-page-log').click(function (e) {
            e.preventDefault();
            loadLogList(currentPage + 1, page_size_log);
        });
    }
    // 更新首页和尾页的状态
    $('#first-page-log').off('click').toggleClass('disabled', currentPage === 1);
    if (currentPage > 1) {
        $('#first-page').click(function (e) {
            e.preventDefault();
            loadLogs(1, page_size);  // 跳转到首页
        });
    }

    $('#last-page-log').off('click').toggleClass('disabled', currentPage === totalPages);
    if (currentPage < totalPages) {
        $('#last-page-log').click(function (e) {
            e.preventDefault();
            loadLogs(totalPages, page_size);  // 跳转到尾页
        });
    }
}

function mcoinToMcoin() {
    showConfirmationModal('确定要转换吗？', '确定将分享盈利全部转换为Mcoin以使用本站AI产品吗？', function () {
        loadingOverlay.show();
        $.ajax({
            url: "/Users/McoinToMcoin",
            type: "POST",
            success: function (data) {
                loadingOverlay.hide();
                if (data.success) {
                    balert('转换成功', 'success', false, 1500, 'center');
                    getShareInfo();
                } else {
                    balert(data.msg, 'danger', false, 1500, 'center');
                }
            }
        });
    });

}

function mcoinToMoney() {
    showPromptModal('提现支付宝', '请输入您的提现<b style="color:red">支付宝</b>账号', function (value) {
        if (value != "") {
            loadingOverlay.show();
            $.ajax({
                url: "/Users/McoinToMoney",
                type: "POST",
                data: {
                    aliAccount: value
                },
                success: function (data) {
                    loadingOverlay.hide();
                    if (data.success) {
                        balert(data.msg, 'success', false, 1500, 'center');
                        getShareInfo();
                    } else {
                        balert(data.msg, 'danger', false, 1500, 'center');
                    }
                }
            });
        } else {
            balert('支付宝账号不能为空', 'danger', false, 1000, 'center', function () {
                mcoinToMoney();
            });
        }
    });
}
function ShareInfo() {
    showConfirmationModal('分享规则',
        `<p><b>分享合盈</b><br>当您使用<b>分享链接</b>邀请新用户注册时，将会获得奖励，以下是分享对比表</p>
                 <p><b>注册奖励</b></p>
                  <table>
                   <tbody><tr><td>分享者</td><td>新用户</td></tr>
                   <tr><td>获得0.3元</td><td>获得3Mcoin</td></tr>
                  </tbody></table>
                 <p>普通注册非邀请的新用户，仅可获得0.3Mcoin</p>
                 <p><b>充值奖励</b></p>
                  <table>
                   <tbody><tr><td>分享者</td><td>新用户</td></tr>
                   <tr><td>获得15元</td><td>充值100元，获得110Mcoin（如未获得10奖励，请联系站长：QQ群主）</td></tr>
                  </tbody></table>
                 <p>邀请人永久获利分享注册用户充值的15%</p>
                 <p style="color:red">注意：金额满10元即可提现，无法部分提现，仅可全部提现，我们对于恶意刷邀请行为，会给予能力范围内最严重的惩罚！！！</p>
        `)
}