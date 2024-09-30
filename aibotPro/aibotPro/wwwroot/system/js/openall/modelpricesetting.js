$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#aisystem-main-menu").addClass('active');
    $("#aisystem-main-menu").parent().toggleClass('show');
    $("#aisystem-main-menu").parent().siblings().removeClass('show');
    $("#modelprice_aisystem_nav").addClass('active');
    getModelPrice();
    initializeResizableColumns();
});

function initializeResizableColumns() {
    $("#modelPriceTable thead td").each(function (i) {
        $(this).resizable({
            handles: 'e',
            minWidth: 50,
            start: function (event, ui) {
                // 保存所有列的初始宽度
                $("#modelPriceTable thead td").each(function (index) {
                    $(this).data('startWidth', $(this).width());
                });
                // 保存表格的初始宽度
                $("#modelPriceTable").data('startWidth', $("#modelPriceTable").width());
            },
            resize: function (event, ui) {
                var colIndex = ui.element.index();
                var widthChange = ui.size.width - ui.originalSize.width;
                var tableStartWidth = $("#modelPriceTable").data('startWidth');

                // 调整当前列宽度
                $(`#modelPriceTable tr td:nth-child(${colIndex + 1})`).width(ui.size.width);

                // 调整右侧下一列的宽度
                if (colIndex < $("#modelPriceTable thead td").length - 1) {
                    var nextColIndex = colIndex + 1;
                    var nextCol = $(`#modelPriceTable tr td:nth-child(${nextColIndex + 1})`);
                    var nextColStartWidth = nextCol.eq(0).data('startWidth');
                    var nextColNewWidth = Math.max(nextColStartWidth - widthChange, 50);
                    nextCol.width(nextColNewWidth);
                }

                // 更新表格宽度
                $("#modelPriceTable").width(tableStartWidth + Math.max(widthChange, 0));

                event.stopPropagation();
            },
            stop: function (event, ui) {
                // 重新计算并设置表格总宽度
                var tableWidth = 0;
                $("#modelPriceTable thead td").each(function () {
                    tableWidth += $(this).outerWidth();
                });
                $("#modelPriceTable").width(tableWidth);
            }
        });
    });
}

function addStLine() {
    var str = `<tr>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="模型名称" /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="用户输入价格" /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="AI输出价格"  /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="（VIP）用户输入价格" /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="（VIP）AI输出价格"  /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="（SVIP）用户输入价格" /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="（SVIP）AI输出价格"  /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="倍率"  /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="（VIP）倍率"  /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="（SVIP）倍率"  /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="单次消耗最大金额(超出时按此设置计费)"  /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="大于0时按次计费"  /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="（VIP）大于0时按次计费"  /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="（SVIP）大于0时按次计费"  /></td>
                 <td><i data-feather="delete" style="color:red;cursor:pointer;" onclick="delLine()"></i></td></tr>`
    $("#AddSt").append(str);
    feather.replace();
    initializeResizableColumns();
}

function delLine() {
    $(event.target).closest('tr').remove();
}

function getModelPrice() {
    //发起请求
    $.ajax({
        type: 'Post',
        url: '/OpenAll/GetModelPrice',
        success: function (res) {
            if (res.success) {
                var data = res.data;
                if (data == null)
                    return;
                for (var i = 0; i < data.length; i++) {
                    var str = `<tr>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="模型名称" value="${data[i].modelName}" /></td>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="用户输入价格" value="${data[i].modelPriceInput}" /></td>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="AI输出价格" value="${data[i].modelPriceOutput}" /></td>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="（VIP）用户输入价格" value="${data[i].vipModelPriceInput}" /></td>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="（VIP）AI输出价格" value="${data[i].vipModelPriceOutput}" /></td>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="（SVIP）用户输入价格" value="${data[i].svipModelPriceInput}" /></td>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="（SVIP）AI输出价格" value="${data[i].svipModelPriceOutput}" /></td>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="倍率" value="${data[i].rebate}" /></td>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="（VIP）倍率" value="${data[i].vipRebate}" /></td>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="（SVIP）倍率" value="${data[i].svipRebate}" /></td>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="单次消耗最大金额(超出时按此设置计费)" value="${data[i].maximum}" /></td>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="按次计费" value="${data[i].onceFee}" /></td>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="（VIP）按次计费" value="${data[i].vipOnceFee}" /></td>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="（SVIP）按次计费" value="${data[i].svipOnceFee}" /></td>
                                <td><i data-feather="delete" style="color:red;cursor:pointer;" onclick="delLine()"></i></td></tr>`
                    $("#AddSt").append(str);
                    feather.replace();

                }
            } else {
                balert(res.msg, "danger", false, 1500, 'top');
            }
        }
    });
}

function saveModelPrice() {
    var formData = new FormData();
    var rows = $("#AddSt").find("tr");
    var issave = true;
    rows.each(function (index, row) {
        // 非空校验
        var modelname = $(row).find("input").eq(0).val();
        var modelpriceinput = $(row).find("input").eq(1).val();
        var modelpriceoutput = $(row).find("input").eq(2).val();
        var vipmodelpriceinput = $(row).find("input").eq(3).val();
        var vipmodelpriceoutput = $(row).find("input").eq(4).val();
        var svipmodelpriceinput = $(row).find("input").eq(5).val();
        var svipmodelpriceoutput = $(row).find("input").eq(6).val();
        var rebate = $(row).find("input").eq(7).val();
        var viprebate = $(row).find("input").eq(8).val();
        var sviprebate = $(row).find("input").eq(9).val();
        var maximum = $(row).find("input").eq(10).val();
        var oncefee = $(row).find("input").eq(11).val();
        var viponcefee = $(row).find("input").eq(12).val();
        var sviponcefee = $(row).find("input").eq(13).val();

        if (!removeSpaces(modelname) || !removeSpaces(modelpriceinput) || !removeSpaces(modelpriceoutput) ||
            !removeSpaces(vipmodelpriceinput) || !removeSpaces(vipmodelpriceoutput) || !removeSpaces(rebate) || !removeSpaces(viprebate)) {
            balert('请将空的【自定义对话模型】输入行删除，或填写完整', 'danger', false, 1500, 'top');
            issave = false;
            return;
        } else {
            formData.append(`ModelPrice[${index}].ModelName`, modelname);
            formData.append(`ModelPrice[${index}].ModelPriceInput`, modelpriceinput);
            formData.append(`ModelPrice[${index}].ModelPriceOutput`, modelpriceoutput);
            formData.append(`ModelPrice[${index}].VipModelPriceInput`, vipmodelpriceinput);
            formData.append(`ModelPrice[${index}].VipModelPriceOutput`, vipmodelpriceoutput);
            formData.append(`ModelPrice[${index}].SvipModelPriceInput`, svipmodelpriceinput);
            formData.append(`ModelPrice[${index}].SvipModelPriceOutput`, svipmodelpriceoutput);
            formData.append(`ModelPrice[${index}].Rebate`, rebate);
            formData.append(`ModelPrice[${index}].VipRebate`, viprebate);
            formData.append(`ModelPrice[${index}].SvipRebate`, sviprebate);
            formData.append(`ModelPrice[${index}].Maximum`, maximum);
            formData.append(`ModelPrice[${index}].OnceFee`, oncefee);
            formData.append(`ModelPrice[${index}].VipOnceFee`, viponcefee);
            formData.append(`ModelPrice[${index}].SvipOnceFee`, sviponcefee);
        }
    });
    if (issave) {
        loadingBtn('.save');
        $.ajax({
            type: 'POST',
            url: '/OpenAll/SaveModelPrice',
            processData: false,  // 告诉jQuery不要处理发送的数据
            contentType: false,  // 告诉jQuery不要设置contentType
            data: formData,
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