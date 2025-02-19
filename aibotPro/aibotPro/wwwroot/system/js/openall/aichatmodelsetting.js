$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#aisystem-main-menu").addClass('active');
    $("#aisystem-main-menu").parent().toggleClass('show');
    $("#aisystem-main-menu").parent().siblings().removeClass('show');
    $("#aichatmodel_aisystem_nav").addClass('active');
    getChatSetting();
});
function whatMyChatSetting() {
    var content = `<p>此处设置可自定义对话模型,如图所示位置：</p>
                   <p><img src="/system/images/chatsetting1.png" style="width:100%" /></p>`;
    showConfirmationModal("说明", content);
}
function addStLine() {
    var str = `<tr>
                 <td class="drag-handle"><i data-feather="align-justify"></i></td>
                 <td><input type="text" class="form-control" placeholder="模型昵称" /></td>
                 <td><input type="text" class="form-control" placeholder="模型名称(实际请求时使用)" /></td>
                 <td><input type="text" class="form-control" placeholder="Base URL"  /></td>
                 <td><input type="text" class="form-control" placeholder="API KEY"  /></td>
                 <td><input type="checkbox" class="form-control"></td>
                 <td><input type="text" class="form-control" placeholder="分组"  /></td>
                 <td><input type="number" class="form-control seq-input" placeholder="排序"  /></td>
                 <td><input type="number" class="form-control" placeholder="流延时(ms)"  /></td>
                 <td><input type="text" class="form-control" placeholder="预设系统提示词"  /></td>
                 <td><input type="text" class="form-control" placeholder="模型说明"  /></td>
                 <td><i data-feather="delete" style="color:red;cursor:pointer;" onclick="delLine()"></i></td>
                 <td><i data-feather="edit" style="color:skyblue;cursor:pointer;" onclick="editRow(this)"></i></td></tr>`
    $("#AddSt").append(str);
    feather.replace();
    $('#AddSt tr').each(function (index) {
        $(this).find('.seq-input').val(index + 1);
    });
}
function delLine() {
    $(event.target).closest('tr').remove();
    $('#AddSt tr').each(function (index) {
        $(this).find('.seq-input').val(index + 1);
    });
}
function saveChatSetting() {
    var aiModels = [];
    var rows = $("#AddSt").find("tr");
    var issave = true;
    rows.each(function (index, row) {
        // 非空校验
        var nickname = $(row).find("input").eq(0).val();
        var name = $(row).find("input").eq(1).val();
        var baseUrl = $(row).find("input").eq(2).val();
        var apiKey = $(row).find("input").eq(3).val();
        var visionModel = $(row).find("input").eq(4).prop('checked');
        var group = $(row).find("input").eq(5).val();
        var seq = $(row).find("input").eq(6).val();
        var delay = $(row).find("input").eq(7).val() < 0 ? 0 : $(row).find("input").eq(7).val();
        adminPrompt = $(row).find("input").eq(8).val();
        modelInfo = $(row).find("input").eq(9).val();
        if (!removeSpaces(nickname) || !removeSpaces(name) || !removeSpaces(baseUrl) || !removeSpaces(apiKey)) {
            balert('请将空的【自定义对话模型】输入行删除，或填写完整', 'danger', false, 1500, 'top');
            issave = false;
            return;
        } else {
            aiModels.push({
                ModelNick: nickname,
                ModelName: name,
                BaseURL: baseUrl,
                ApiKey: apiKey,
                VisionModel: visionModel,
                ModelGroup: group,
                Seq: seq,
                Delay: delay,
                ModelInfo: modelInfo,
                AdminPrompt: adminPrompt
            });
        }
    });
    if (issave) {
        loadingBtn('.save');
        $.ajax({
            type: 'POST',
            url: '/OpenAll/SaveAiChatSetting',
            dataType: 'json',
            data: {
                aImodel: JSON.stringify(aiModels)
            },
            success: function (res) {
                unloadingBtn('.save');
                if (res.success) {
                    balert(res.msg, 'success', false, 1500, 'top');
                } else {
                    balert(res.msg, 'danger', false, 1500, 'top');
                }
            },
            error: function (error) {
                unloadingBtn('.save');
                sendExceptionMsg(error);
                balert('保存失败，请稍后再试', 'danger', false, 1500, 'top');
            }
        });
    }
}

function getChatSetting() {
    //发起请求
    $.ajax({
        type: 'Post',
        url: '/OpenAll/GetChatSetting',
        success: function (res) {
            if (res.success) {
                var data = res.data;
                if (data == null)
                    return;
                for (var i = 0; i < data.length; i++) {
                    var checkedAttr = data[i].visionModel ? 'checked' : '';
                    var str = `<tr>
                                <td class="drag-handle"><i data-feather="align-justify"></i></td>
                                <td><input type="text" class="form-control" placeholder="模型昵称" value="${data[i].modelNick}" /></td>
                                <td><input type="text" class="form-control" placeholder="模型名称(实际请求时使用)" value="${data[i].modelName}" /></td>
                                <td><input type="text" class="form-control" placeholder="Base URL" value="${data[i].baseUrl}" /></td>
                                <td><input type="text" class="form-control" placeholder="API KEY" value="${data[i].apiKey}" /></td>
                                <td><input type="checkbox" class="form-control" ${checkedAttr}></td>
                                <td><input type="text" class="form-control" placeholder="分组" value="${data[i].modelGroup}" /></td>
                                <td><input type="number" class="form-control seq-input" placeholder="排序" value="${data[i].seq}" /></td>
                                <td><input type="number" class="form-control" placeholder="流延时(ms)" value="${data[i].delay}" /></td>
                                <td><input type="text" class="form-control" placeholder="预设系统提示词"value="${data[i].adminPrompt == null ? '' : data[i].adminPrompt}"  /></td>
                                <td><input type="text" class="form-control" placeholder="模型说明" value="${data[i].modelInfo == null ? '' : data[i].modelInfo}" /></td>
                                <td><i data-feather="delete" style="color:red;cursor:pointer;" onclick="delLine()"></i></td>
                                <td><i data-feather="edit" style="color:skyblue;cursor:pointer;" onclick="editRow(this)"></i></td></tr>`
                    $("#AddSt").append(str);
                    feather.replace();
                    // 初始化拖动排序
                    $("#AddSt").sortable({
                        handle: '.drag-handle',
                        placeholder: 'drag-placeholder',
                        forcePlaceholderSize: true,
                        start: function (event, ui) {
                            ui.item.addClass('dragging');
                        },
                        stop: function (event, ui) {
                            ui.item.removeClass('dragging');
                        },
                        update: function (event, ui) {
                            // 更新排序文本框的值
                            $('#AddSt tr').each(function (index) {
                                $(this).find('.seq-input').val(index + 1);
                            });
                        }
                    }).disableSelection();
                }
            } else {
                balert(res.msg, "danger", false, 1500, 'top');
            }
        }
    });
}

function editRow(row) {
    // 记录当前点击的行
    currentRow = $(row).closest('tr');

    // 动态生成模态框的 HTML
    var modalHTML = `
        <div class="modal fade" id="editRowModal" tabindex="-1" role="dialog" aria-labelledby="editModalLabel" aria-hidden="true">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="editModalLabel">编辑表格行</h5>
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body" style="max-height: 600px; overflow-y: auto;">
                        <form id="editRowForm">
                            <div class="form-group">
                                <label>模型昵称</label>
                                <input type="text" class="form-control" id="edit-model-nick" value="${currentRow.find('td:eq(1) input').val()}"/>
                            </div>
                            <div class="form-group">
                                <label>模型名称</label>
                                <input type="text" class="form-control" id="edit-model-name" value="${currentRow.find('td:eq(2) input').val()}"/>
                            </div>
                            <div class="form-group">
                                <label>Base URL</label>
                                <input type="text" class="form-control" id="edit-base-url" value="${currentRow.find('td:eq(3) input').val()}"/>
                            </div>
                            <div class="form-group">
                                <label>API KEY</label>
                                <input type="text" class="form-control" id="edit-api-key" value="${currentRow.find('td:eq(4) input').val()}"/>
                            </div>
                            <div class="form-group">
                                <label>是否启用</label>
                                <input type="checkbox" id="edit-vision-model" ${currentRow.find('td:eq(5) input').prop('checked') ? 'checked' : ''}/>
                            </div>
                            <div class="form-group">
                                <label>分组</label>
                                <input type="text" class="form-control" id="edit-model-group" value="${currentRow.find('td:eq(6) input').val()}"/>
                            </div>
                            <div class="form-group">
                                <label>排序</label>
                                <input type="number" class="form-control" id="edit-seq" value="${currentRow.find('td:eq(7) input').val()}"/>
                            </div>
                            <div class="form-group">
                                <label>流延时(ms)</label>
                                <input type="number" class="form-control" id="edit-delay" value="${currentRow.find('td:eq(8) input').val()}"/>
                            </div>
                            <div class="form-group">
                                <label>预设系统提示词</label>
                                <textarea class="form-control" id="edit-admin-prompt">${currentRow.find('td:eq(9) input').val()}</textarea>
                            </div>
                            <div class="form-group">
                                <label>模型说明</label>
                                <textarea class="form-control" id="edit-model-info">${currentRow.find('td:eq(10) input').val()}</textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">关闭</button>
                        <button type="button" class="btn btn-primary" id="save-row-btn">保存</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 将生成的模态框添加到body
    $('body').append(modalHTML);

    // 显示模态框
    $('#editRowModal').modal('show');

    // 监听模态框关闭事件，删除模态框的 HTML 避免残留
    $('#editRowModal').on('hidden.bs.modal', function () {
        $('#editRowModal').remove();
    });

    // 保存按钮的点击事件
    $('#save-row-btn').click(function () {
        // 将模态框中的值写回表格中的对应行
        currentRow.find('td:eq(1) input').val($('#edit-model-nick').val());
        currentRow.find('td:eq(2) input').val($('#edit-model-name').val());
        currentRow.find('td:eq(3) input').val($('#edit-base-url').val());
        currentRow.find('td:eq(4) input').val($('#edit-api-key').val());
        currentRow.find('td:eq(5) input').prop('checked', $('#edit-vision-model').prop('checked'));
        currentRow.find('td:eq(6) input').val($('#edit-model-group').val());
        currentRow.find('td:eq(7) input').val($('#edit-seq').val());
        currentRow.find('td:eq(8) input').val($('#edit-delay').val());
        currentRow.find('td:eq(9) input').val($('#edit-admin-prompt').val());
        currentRow.find('td:eq(10) input').val($('#edit-model-info').val());

        // 隐藏模态框
        $('#editRowModal').modal('hide');
    });
}