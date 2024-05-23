$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#aisystem-main-menu").addClass('active');
    $("#aisystem-main-menu").parent().toggleClass('show');
    $("#aisystem-main-menu").parent().siblings().removeClass('show');
    $("#modelprice_aisystem_nav").addClass('active');
    getModelPrice();
});
function addStLine() {
    var str = `<tr>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="模型名称" /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="用户输入价格" /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="AI输出价格"  /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="（VIP）用户输入价格" /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="（VIP）AI输出价格"  /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="倍率"  /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="（VIP）倍率"  /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="单次消耗最大金额(超出时按此设置计费)"  /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="大于0时按次计费"  /></td>
                 <td><input type="text" class="form-control" maxlength="50" placeholder="（VIP）大于0时按次计费"  /></td>
                 <td><i data-feather="delete" style="color:red;cursor:pointer;" onclick="delLine()"></i></td></tr>`
    $("#AddSt").append(str);
    feather.replace();
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
                                <td><input type="text" class="form-control" maxlength="50" placeholder="倍率" value="${data[i].rebate}" /></td>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="（VIP）倍率" value="${data[i].vipRebate}" /></td>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="单次消耗最大金额(超出时按此设置计费)" value="${data[i].maximum}" /></td>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="按次计费" value="${data[i].onceFee}" /></td>
                                <td><input type="text" class="form-control" maxlength="50" placeholder="（VIP）按次计费" value="${data[i].vipOnceFee}" /></td>
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
        var rebate = $(row).find("input").eq(5).val();
        var viprebate = $(row).find("input").eq(6).val();
        var maximum = $(row).find("input").eq(7).val();
        var oncefee = $(row).find("input").eq(8).val();
        var viponcefee = $(row).find("input").eq(9).val();

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
            formData.append(`ModelPrice[${index}].Rebate`, rebate);
            formData.append(`ModelPrice[${index}].VipRebate`, viprebate);
            formData.append(`ModelPrice[${index}].Maximum`, maximum);
            formData.append(`ModelPrice[${index}].OnceFee`, oncefee);
            formData.append(`ModelPrice[${index}].VipOnceFee`, viponcefee);
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