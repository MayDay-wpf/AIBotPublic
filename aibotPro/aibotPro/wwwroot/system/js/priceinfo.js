$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#price-info-menu").addClass('active');
    getAIModelGroup();
    getAIModelPriceInfo('');
});
function getAIModelGroup() {
    $.ajax({
        type: "Post",
        url: "/Home/GetAIModelGroup",
        dataType: "json",
        success: function (res) {
            if (res.success) {
                var data = res.data;
                var html = `<button class="filter-button active" data-group="">全部</button>`;
                for (var i = 0; i < data.length; i++) {
                    html += `<button class="filter-button" data-group="${data[i]}">${data[i]}</button>`;
                }
                html = addDefaultGroup(html);
                $('.filter-buttons').html(html);

                // 添加点击事件处理
                $('.filter-button').click(function () {
                    $('.filter-button').removeClass('active');
                    $(this).addClass('active');
                    var selectedGroup = $(this).data('group');
                    getAIModelPriceInfo(selectedGroup);
                });
            }
        }
    });
}

function addDefaultGroup(html) {
    html += `<button class="filter-button" data-group="free">🆓 免费模型</button>`;
    html += `<button class="filter-button" data-group="vip">✨ VIP特惠</button>`;
    html += `<button class="filter-button" data-group="svip">👑 SVIP特惠</button>`;
    return html;
}
function getAIModelPriceInfo(group) {
    $.ajax({
        type: "Post",
        url: "/Home/GetAIModelPriceInfo",
        dataType: "json",
        data: {
            group: group
        },
        success: function (res) {
            if (res.success) {
                var data = res.data;
                console.log(data);
                var html = `免费,暂无报价~`;
                if (data.length > 0)
                    html = '';
                for (var i = 0; i < data.length; i++) {
                    var model = data[i];
                    var priceInfo = '';
                    if (model.onceFee > 0 || model.vipOnceFee > 0 || model.svipOnceFee > 0) {
                        // 按次收费
                        priceInfo = `
                            <p><span class="badge rounded-pill bg-dark text-white">普通用户</span> <span class="badge rounded-pill bg-info text-white">${model.onceFee}/次</span><span class="badge rounded-pill bg-info text-white">倍率:${model.rebate}</span></p>
                            <p><span class="badge rounded-pill bg-warning text-white">VIP用户</span> <span class="badge rounded-pill bg-info text-white">${model.vipOnceFee}/次</span><span class="badge rounded-pill bg-info text-white">倍率:${model.vipRebate}</span></p>
                            <p><span class="badge rounded-pill bg-danger text-white">SVIP用户</span> <span class="badge rounded-pill bg-info text-white">${model.svipOnceFee}/次</span><span class="badge rounded-pill bg-info text-white">倍率:${model.svipRebate}</span></p>
                        `;
                    } else {
                        // 按 token 收费
                        priceInfo = `
                                     <p>
                                         <span class="badge rounded-pill bg-dark text-white">普通用户</span>
                                         <span class="badge rounded-pill bg-primary text-white">${model.modelPriceInput == 0 ? '免费' : model.modelPriceInput + '/1k tokens'}</span>
                                         <span class="badge rounded-pill bg-primary text-white">${model.modelPriceOutput == 0 ? '免费' : model.modelPriceOutput + '/1k tokens'}</span>
                                         <span class="badge rounded-pill bg-info text-white">倍率:${model.modelPriceInput == 0 ? '0' : model.rebate}</span>
                                     </p>
                                     <p>
                                         <span class="badge rounded-pill bg-warning text-white">VIP用户</span> 
                                         <span class="badge rounded-pill bg-primary text-white">${model.vipModelPriceInput == 0 ? '免费' : model.vipModelPriceInput + '/1k tokens'}</span>
                                         <span class="badge rounded-pill bg-primary text-white">${model.vipModelPriceOutput == 0 ? '免费' : model.vipModelPriceOutput + '/1k tokens'}</span>
                                         <span class="badge rounded-pill bg-info text-white">倍率:${model.vipModelPriceOutput == 0 ? '0' : model.rebate}</span>
                                     </p>
                                     <p>
                                         <span class="badge rounded-pill bg-danger text-white">SVIP用户</span> 
                                         <span class="badge rounded-pill bg-primary text-white">${model.svipModelPriceInput == 0 ? '免费' : model.svipModelPriceInput + '/1k tokens'}</span>
                                         <span class="badge rounded-pill bg-primary text-white">${model.svipModelPriceOutput == 0 ? '免费' : model.svipModelPriceOutput + '/1k tokens'}</span>
                                         <span class="badge rounded-pill bg-info text-white">倍率:${model.svipModelPriceOutput == 0 ? '0' : model.rebate}</span>
                                     </p>
                                 `;
                    }

                    html += `
                        <div class="col-md-6 col-lg-4 mb-4">
                            <div class="card model-card h-100">
                                <div class="card-body">
                                    <h5 class="card-title">${model.modelNick}</h5>
                                    <h6 class="card-subtitle mb-2 text-muted">${model.modelName}</h6>
                                    <p class="card-text">${model.modelInfo || '暂无描述'}</p>
                                    <div class="price-info mt-3">
                                        <h6 class="mb-2">价格信息：</h6>
                                        ${priceInfo}
                                    </div>
                                </div>
                                <div class="card-footer">
                                    <small class="text-muted">模型组: ${model.modelGroup || '未分组'}</small>
                                </div>
                            </div>
                        </div>
                    `;
                }
                $('.model-list').html(html);
            }
        }
    });
}

