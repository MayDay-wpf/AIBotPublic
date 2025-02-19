$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#role-main-menu").addClass('active');
    $("#role-main-menu").parent().toggleClass('show');
    $("#role-main-menu").parent().siblings().removeClass('show');
    $("#list-role-nav").addClass('active');
    getRoleList('init');
    window.addEventListener('scroll', handleScroll); // 添加滚动监听
});
let page = 1;
let pageSize = 12;
let noMoreData = false;
let isLoading = false;
const scrollThreshold = 50;

function handleScroll() {
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
    const clientHeight = window.innerHeight || document.documentElement.clientHeight;

    if (scrollHeight - scrollTop - clientHeight < scrollThreshold && !isLoading && !noMoreData) {
        isLoading = true;
        getRoleList('loadmore');
    }
}

function getRoleList(type) {
    loadingOverlay.show();
    isLoading = true;

    var name = $('#searchKey').val();
    if (type == 'init') {
        page = 1;
        pageSize = 12;
        noMoreData = false;
    }
    if (type == 'loadmore' && noMoreData) {
        loadingOverlay.hide();
        isLoading = false;
        balert('没有更多了', "info", false, 1500, "center");
        return;
    }
    if (type == 'loadmore') {
        page++;
    }

    var data = {
        name: name,
        page: page,
        pageSize: pageSize
    };

    $.ajax({
        type: 'Post',
        url: '/Role/GetRoleList',
        data: data,
        success: function (res) {
            isLoading = false;
            loadingOverlay.hide();
            if (res.success) {
                var html = '';
                for (var i = 0; i < res.data.length; i++) {
                    var item = res.data[i];
                    html += '<div class="col-lg-3 col-md-6 col-sm-12 mb-4 grid-item">';
                    html += '<div class="card h-100">';
                    html += '<img class="card-img-top" style="width: 50px;height: 50px;margin:10px auto;" src="' + item.roleAvatar + '">';
                    html += '<div class="card-body">';
                    html += '<h5 class="card-title">' + item.roleName + '</h5>';
                    html += '<p class="card-text" style="max-height: 100px; overflow: auto;">' + item.roleInfo + '</p>';
                    html += '<div class="d-flex justify-content-center">';
                    html += `<a href="/Home/Index?type=` + item.roleCode + `" class="btn btn-primary"><i data-feather="message-circle"></i> 对话</a>`;
                    html += `<a href="/Role/CustomRole?code=` + item.roleCode + `" class="btn btn-info"><i data-feather="edit"></i> 编辑</a>`;
                    if (item.canDelete || IsAdmin)
                        html += `<button onclick="delRole('${item.roleCode}')" class="btn btn-danger"><i data-feather="trash-2"></i> 删除</button>`;
                    html += '</div>';
                    html += '</div>';
                    html += '</div>';
                    html += '</div>';
                }
                if (type == 'loadmore') {
                    $('#masonry-layout').append(html);
                    noMoreData = res.data.length < pageSize;
                } else {
                    $('#masonry-layout').html(html);
                    noMoreData = res.data.length < pageSize;
                }
                feather.replace();
            }
        },
        error: function (res) {
            isLoading = false;
            loadingOverlay.hide();
        }
    });
}

function delRole(code) {
    //二次确认
    showConfirmationModal("提示", "确定删除这个角色吗？", function () {
        $.ajax({
            type: "Post",
            url: "/Role/DelRole",
            dataType: "json",
            data: {
                roleCode: code
            },
            success: function (res) {
                if (res.success) {
                    balert("删除成功", "success", false, 1000, "top");
                    getRoleList('init');
                } else
                    balert(res.errormsg, "danger", false, 1000, "top");
            },
            error: function (err) {
                //window.location.href = "/Users/Login";
                balert("删除失败，错误请联系管理员：err", "danger", false, 2000, "center");
            }
        });
    });
}

$(document).keypress(function (e) {
    if ($("#searchKey").is(":focus")) {
        if (e.which == 13) {
            // 避免回车键换行
            e.preventDefault();
            getRoleList('init');
        }
    }
});