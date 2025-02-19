const pageSize = 15;
let currentPage = 1;
let totalPage = 0;
$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#userslist-main-menu").addClass('active');
    $("#userslist-main-menu").parent().toggleClass('show');
    $("userslist-main-menu").parent().siblings().removeClass('show');
    $("#limit_userlists_nav").addClass('active');
    $('#modalConfirm').on('click', function () {
        var account = $('#limitaccount').val();
        var selectedModels = $('#multiSelectModel').val();
        var limitValue = $('#limitValue').val();
        $.ajax({
            type: 'POST',
            url: '/OpenAll/SaveLimit',
            dataType: 'json',
            data: {
                account: account,
                selectedModels: selectedModels,
                limitValue: limitValue
            },
            success: function (res) {
                if (res.success) {
                    loadTable(currentPage, $('#name').val());
                    var models = res.data;
                    if (models == null) {
                        return;
                    }

                    var multiSelect = $('#multiSelectModel');

                    // 清空选项
                    multiSelect.empty();

                    // 填充选项
                    for (var i = 0; i < models.length; i++) {
                        var modelOption = `<option value="${models[i].modelName}">${models[i].modelNick}</option>`;
                        multiSelect.append(modelOption);
                    }
                    initializeSelect2();
                } else {
                    balert(res.msg, "danger", false, 1000, "center");
                }
            }
        });
        // 关闭模态框
        $('#limitModal').modal('hide');
    });
    loadTable(currentPage, $('#name').val());
});
// 获取模型列表并填充到多选框和下拉框
function initializeSelect2() {
    $('#multiSelectModel').select2({
        placeholder: "选择模型",
        allowClear: true
    });
}

// 获取模型列表并填充到多选框和下拉框
function getModels() {
    $.ajax({
        type: 'POST',
        url: '/OpenAll/GetChatSetting',
        success: function (res) {
            if (res.success) {
                var models = res.data;
                if (models == null) {
                    return;
                }

                var multiSelect = $('#multiSelectModel');

                // 清空选项
                multiSelect.empty();

                // 填充选项
                for (var i = 0; i < models.length; i++) {
                    var modelOption = `<option value="${models[i].modelName}">${models[i].modelNick}</option>`;
                    multiSelect.append(modelOption);
                }

                // 初始化Select2组件
                initializeSelect2();
            } else {
                balert("获取模型列表失败", "danger", false, 1000, "center");
            }
        }
    });
}

function addLimit() {
    // 在模态框显示之前获取模型列表
    getModels();

    // 显示模态框
    $('#limitModal').modal('show');
}

function loadTable(page, account) {
    loadingOverlay.show();
    $.post('/OpenAll/GetUsersLimits', { page: page, size: pageSize, account: account }, function (response) {
        loadingOverlay.hide();
        const { data, total } = response;
        totalPage = Math.ceil(total / pageSize);

        $('#limitList').empty();
        data.forEach(user => {
            $('#limitList').append(`
                    <tr>
                        <td>${user.account}</td>
                        <td>${user.modelName}</td>
                        <td>${user.limit}</td>
                        <td>${user.createTime}</td>
                        <td><input type="checkbox" class="enable-checkbox" data-id="${user.id}" ${user.enable ? 'checked' : ''}></td>
                        <td><button class="btn btn-danger" onclick="deleteLimit(${user.id})">删除</button></td>
                    </tr>
                `);
        });

        updatePagination();
    });
}

function updatePagination() {
    $('#pagination').empty();

    // 添加"首页"和"上一页"按钮，并根据条件设置disabled属性
    $('#pagination').append(`
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="1">首页</a>
            </li>
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage - 1}">上一页</a>
            </li>
        `);

    const maxDisplayPages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxDisplayPages / 2));
    let endPage = Math.min(totalPage, startPage + maxDisplayPages - 1);

    if (startPage > 1) {
        $('#pagination').append('<li class="page-item disabled"><span class="page-link">...</span></li>');
    }

    for (let i = startPage; i <= endPage; i++) {
        $('#pagination').append(`
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}">${i}</a>
                </li>
            `);
    }

    if (endPage < totalPage) {
        $('#pagination').append('<li class="page-item disabled"><span class="page-link">...</span></li>');
    }

    // 添加"下一页"和"尾页"按钮，并根据条件设置disabled属性
    $('#pagination').append(`
            <li class="page-item ${currentPage === totalPage || totalPage === 0 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${currentPage + 1}">下一页</a>
            </li>
            <li class="page-item ${currentPage === totalPage || totalPage === 0 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${totalPage}">尾页</a>
            </li>
        `);
}

$(document).on('click', '.page-item a', function (e) {
    e.preventDefault();
    const newPage = parseInt($(this).data('page'));

    if (newPage > 0 && newPage <= totalPage && newPage !== currentPage) {
        currentPage = newPage;
        loadTable(currentPage, $('#name').val());
    }
});

$('#name').on('keypress', function (e) {
    if (e.which === 13) { // Enter key
        currentPage = 1;
        loadTable(currentPage, $(this).val());
    }
});

$(document).on('click', '.page-item a', function (e) {
    e.preventDefault();
    const text = $(this).text();

    if (text === '首页') {
        currentPage = 1;
    } else if (text === '上一页') {
        if (currentPage > 1) currentPage--;
    } else if (text === '下一页') {
        if (currentPage < totalPage) currentPage++;
    } else if (text === '尾页') {
        currentPage = totalPage;
    } else {
        currentPage = parseInt(text);
    }

    loadTable(currentPage, $('#name').val());
});

$('#name').on('keypress', function (e) {
    if (e.which === 13) { // Enter key
        currentPage = 1;
        loadTable(currentPage, $(this).val());
    }
});
$(document).on('change', '.enable-checkbox', function () {
    const id = $(this).data('id');
    const isEnabled = $(this).is(':checked');

    $.post('/OpenAll/EnableUsersLimits', { Id: id, enable: isEnabled }, function (response) {
        if (response.success) {
            balert("状态更新成功", "success", false, 1000, "center");
        } else {
            balert("状态更新失败", "danger", false, 1000, "center");
            $(this).prop('checked', !isEnabled);
        }
    }.bind(this));
});

function deleteLimit(id) {
    showConfirmationModal("提醒", "确定要删除这个用户限制吗？", function () {
        $.post('/OpenAll/DeleteLimit', { Id: id }, function (response) {
            if (response.success) {
                balert("删除成功", "success", false, 1000, "center");
                loadTable(currentPage, $('#name').val());
            } else {
                balert("删除失败", "danger", false, 1000, "center");
            }
        }.bind(this));
    });
}