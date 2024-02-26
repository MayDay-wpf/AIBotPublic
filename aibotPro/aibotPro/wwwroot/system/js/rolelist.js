$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#role-main-menu").addClass('active');
    $("#role-main-menu").parent().toggleClass('show');
    $("#role-main-menu").parent().siblings().removeClass('show');
    $("#list-role-nav").addClass('active');
    getRoleList('init');
});
let page = 1;
let pageSize = 10;
function getRoleList(type) {
    var name = $('#searchKey').val();
    if (type == 'init') {
        page = 1;
        pageSize = 10;
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
            if (res.success) {
                var html = '';
                for (var i = 0; i < res.data.length; i++) {
                    var item = res.data[i];
                    html += '<div class="col-lg-3 col-md-6 col-sm-12 mb-4 grid-item">';
                    html += '<div class="card h-100">';
                    html += '<img class="card-img-top" style="width: 50px;height: 50px;margin:10px auto;" src="' + item.roleAvatar + '">';
                    html += '<div class="card-body">';
                    html += '<h5 class="card-title">' + item.roleName + '</h5>';
                    html += '<p class="card-text">' + item.roleInfo + '</p>';
                    html += '<div class="d-flex justify-content-center">';
                    html += `<a href="/Role/RoleChat?type=` + item.roleCode + `" class="btn btn-primary" style="margin-right:10px;">对话</a>`;
                    html += '</div>';
                    html += '</div>';
                    html += '</div>';
                    html += '</div>';
                }
                if (type == 'loadmore') {
                    $('#masonry-layout').append(html);
                    if (res.data.length < pageSize) {
                        balert('没有更多了', "info", false, 1500);
                        page--;
                    }
                } else
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
$(window).scroll(function () {
    // 检查用户是否滚动到页面底部
    // window的滚动高度 + window的高度 >= 整个document的高度
    if ($(window).scrollTop() + $(window).height() >= $(document).height()) {
        getRoleList('loadmore');
    }
});
$(document).keypress(function (e) {
    if ($("#searchKey").is(":focus")) {
        if (e.which == 13) {
            // 避免回车键换行
            e.preventDefault();
            getRoleList('init');
        }
    }
});