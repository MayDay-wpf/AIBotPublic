$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#aisystem-main-menu").addClass('active');
    $("#aisystem-main-menu").parent().toggleClass('show');
    $("#aisystem-main-menu").parent().siblings().removeClass('show');
    $("#modelprice_aisystem_nav").addClass('active');
    getModelPrice();
    initSearch();
});

function initSearch() {
    const searchInput = $('#priceSearch');
    const clearBtn = $('#clearSearch');
    const searchStats = $('#searchStats');
    const noResults = $('#noResults');
    const addPriceCard = $('.add-price-card');

    function performSearch() {
        const query = searchInput.val().toLowerCase().trim();
        const cards = $('#price-cards-container .price-card');
        let visibleCount = 0;

        if (query === '') {
            cards.removeClass('hidden');
            clearBtn.hide();
            searchStats.text('');
            noResults.hide();
            addPriceCard.show();
            return;
        }

        clearBtn.show();
        cards.each(function () {
            const card = $(this);
            const modelName = card.find('.model-name-input').val() || '';

            if (modelName.toLowerCase().includes(query)) {
                card.removeClass('hidden');
                visibleCount++;
            } else {
                card.addClass('hidden');
            }
        });

        if (visibleCount > 0) {
            searchStats.text('显示 ' + visibleCount + ' 个结果');
            noResults.hide();
            addPriceCard.hide();
        } else {
            searchStats.text('无匹配结果');
            noResults.show();
            addPriceCard.hide();
        }
    }

    // 绑定搜索事件
    searchInput.on('input', performSearch);

    // 清除搜索按钮事件
    clearBtn.click(function () {
        searchInput.val('');
        performSearch();
        searchInput.focus();
    });

    // 回车键搜索
    searchInput.on('keypress', function (e) {
        if (e.which === 13) {
            performSearch();
        }
    });

    // 初始状态 
    clearBtn.hide();
    searchStats.text('');
    noResults.hide();
}

function createPriceCard(data = {}) {
    const cardId = 'card-' + Date.now() + Math.random().toString(36).substr(2, 9);

    // 安全地获取数据值，处理数字类型
    const getValue = (value) => {
        if (value === null || value === undefined) return '';
        return String(value);
    };

    return `
        <div class="price-card" id="${cardId}">
            <div class="card-header-custom">
                <h5 class="model-title">${data.modelName || '新模型配置'}</h5>
                <div class="card-actions">
                    <button type="button" class="btn btn-outline-success btn-sm add-btn" onclick="addStLineAfter('${cardId}')" title="在下方新增">
                        <i class="fas fa-plus"></i> 新增
                    </button>
                    <button type="button" class="btn btn-danger btn-sm" onclick="deletePriceCard('${cardId}')" title="删除">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </div>
            </div>
            
            <!-- 模型名称 -->
            <div class="form-group-small mb-3">
                <label>模型名称</label>
                <input type="text" class="form-control model-name-input" placeholder="请输入模型名称" value="${getValue(data.modelName)}" onchange="updateCardTitle('${cardId}', this.value)">
            </div>
            
            <!-- 价格配置区域 -->
            <div class="price-sections">
                <!-- 普通用户 -->
                <div class="price-section">
                    <div class="section-title">普通用户</div>
                    <div class="price-row">
                        <div class="form-group-small">
                            <label>输入价格</label>
                            <input type="text" class="form-control" placeholder="0.00" value="${getValue(data.modelPriceInput)}">
                        </div>
                        <div class="form-group-small">
                            <label>输出价格</label>
                            <input type="text" class="form-control" placeholder="0.00" value="${getValue(data.modelPriceOutput)}">
                        </div>
                    </div>
                    <div class="price-row">
                        <div class="form-group-small">
                            <label>倍率</label>
                            <input type="text" class="form-control" placeholder="1.0" value="${getValue(data.rebate)}">
                        </div>
                        <div class="form-group-small">
                            <label>按次计费</label>
                            <input type="text" class="form-control" placeholder="0" value="${getValue(data.onceFee)}">
                        </div>
                    </div>
                </div>
                
                <!-- VIP用户 -->
                <div class="price-section vip">
                    <div class="section-title">VIP用户</div>
                    <div class="price-row">
                        <div class="form-group-small">
                            <label>输入价格</label>
                            <input type="text" class="form-control" placeholder="0.00" value="${getValue(data.vipModelPriceInput)}">
                        </div>
                        <div class="form-group-small">
                            <label>输出价格</label>
                            <input type="text" class="form-control" placeholder="0.00" value="${getValue(data.vipModelPriceOutput)}">
                        </div>
                    </div>
                    <div class="price-row">
                        <div class="form-group-small">
                            <label>倍率</label>
                            <input type="text" class="form-control" placeholder="1.0" value="${getValue(data.vipRebate)}">
                        </div>
                        <div class="form-group-small">
                            <label>按次计费</label>
                            <input type="text" class="form-control" placeholder="0" value="${getValue(data.vipOnceFee)}">
                        </div>
                    </div>
                </div>
                
                <!-- SVIP用户 -->
                <div class="price-section svip">
                    <div class="section-title">SVIP用户</div>
                    <div class="price-row">
                        <div class="form-group-small">
                            <label>输入价格</label>
                            <input type="text" class="form-control" placeholder="0.00" value="${getValue(data.svipModelPriceInput)}">
                        </div>
                        <div class="form-group-small">
                            <label>输出价格</label>
                            <input type="text" class="form-control" placeholder="0.00" value="${getValue(data.svipModelPriceOutput)}">
                        </div>
                    </div>
                    <div class="price-row">
                        <div class="form-group-small">
                            <label>倍率</label>
                            <input type="text" class="form-control" placeholder="1.0" value="${getValue(data.svipRebate)}">
                        </div>
                        <div class="form-group-small">
                            <label>按次计费</label>
                            <input type="text" class="form-control" placeholder="0" value="${getValue(data.svipOnceFee)}">
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 高级设置 -->
            <div class="settings-section">
                <div class="section-title">高级设置</div>
                <div class="settings-row">
                    <div class="form-group-small">
                        <label>单次最大消耗</label>
                        <input type="text" class="form-control" placeholder="超出时按此设置计费" value="${getValue(data.maximum)}">
                    </div>
                </div>
            </div>
        </div>
    `;
}

function updateCardTitle(cardId, modelName) {
    const card = $('#' + cardId);
    const title = card.find('.model-title');
    title.text(modelName || '新模型配置');

    // 触发搜索更新
    initSearch();
}

function addStLine() {
    const cardHtml = createPriceCard();
    $('#price-cards-container').append(cardHtml);

    // 重新初始化搜索功能
    setTimeout(function () {
        initSearch();
    }, 100);
}

// 在指定卡片后新增模型价格配置
function addStLineAfter(cardId) {
    const currentCard = $('#' + cardId);
    const cardHtml = createPriceCard();

    // 在当前卡片后插入新卡片
    currentCard.after(cardHtml);

    // 获取新插入的卡片
    const newCard = currentCard.next('.price-card');

    // 滚动到新添加的卡片并高亮
    if (newCard.length > 0) {
        newCard[0].scrollIntoView({behavior: 'smooth', block: 'center'});
        // 高亮显示新卡片
        newCard.addClass('highlight-new');
        setTimeout(function () {
            newCard.removeClass('highlight-new');
        }, 3000);
    }

    // 重新初始化搜索功能
    setTimeout(function () {
        initSearch();
    }, 100);
}

function deletePriceCard(cardId) {
    $('#' + cardId).remove();
    // 重新初始化搜索功能
    initSearch();
}


function getModelPrice() {
    $.ajax({
        type: 'Post',
        url: '/OpenAll/GetModelPrice',
        success: function (res) {
            if (res.success) {
                var data = res.data;
                if (data == null)
                    return;

                $('#price-cards-container').empty();
                for (var i = 0; i < data.length; i++) {
                    const cardHtml = createPriceCard(data[i]);
                    $('#price-cards-container').append(cardHtml);
                }

                // 初始化搜索功能
                setTimeout(function () {
                    initSearch();
                }, 100);
            } else {
                balert(res.msg, "danger", false, 1500, 'top');
            }
        },
        error: function (error) {
            console.error('获取模型价格失败:', error);
            balert('获取模型价格失败，请刷新页面重试', 'danger', false, 3000, 'top');
        }
    });
}

function saveModelPrice() {
    var modelPriceList = [];
    var cards = $("#price-cards-container").find(".price-card");
    var issave = true;

    cards.each(function (index, card) {
        var $card = $(card);

        // 使用更精确的选择器来获取各个字段的值
        var modelname = $card.find(".model-name-input").val();

        // 普通用户价格区域
        var normalSection = $card.find(".price-section").eq(0);
        var modelpriceinput = normalSection.find("input").eq(0).val();
        var modelpriceoutput = normalSection.find("input").eq(1).val();
        var rebate = normalSection.find("input").eq(2).val();
        var oncefee = normalSection.find("input").eq(3).val();

        // VIP用户价格区域
        var vipSection = $card.find(".price-section.vip");
        var vipmodelpriceinput = vipSection.find("input").eq(0).val();
        var vipmodelpriceoutput = vipSection.find("input").eq(1).val();
        var viprebate = vipSection.find("input").eq(2).val();
        var viponcefee = vipSection.find("input").eq(3).val();

        // SVIP用户价格区域
        var svipSection = $card.find(".price-section.svip");
        var svipmodelpriceinput = svipSection.find("input").eq(0).val();
        var svipmodelpriceoutput = svipSection.find("input").eq(1).val();
        var sviprebate = svipSection.find("input").eq(2).val();
        var sviponcefee = svipSection.find("input").eq(3).val();

        // 高级设置区域
        var maximum = $card.find(".settings-section input").eq(0).val();

        // 安全地去除空格的函数
        function safeRemoveSpaces(str) {
            if (str === null || str === undefined) return '';
            return String(str).replace(/\s+/g, '');
        }

        // 验证必填字段
        if (!safeRemoveSpaces(modelname) || !safeRemoveSpaces(modelpriceinput) || !safeRemoveSpaces(modelpriceoutput) ||
            !safeRemoveSpaces(vipmodelpriceinput) || !safeRemoveSpaces(vipmodelpriceoutput) || !safeRemoveSpaces(rebate) || !safeRemoveSpaces(viprebate)) {
            balert('请将空的【模型价格配置】删除，或填写完整必填字段', 'danger', false, 2000, 'top');
            issave = false;
            return false;
        } else {
            modelPriceList.push({
                ModelName: modelname,
                ModelPriceInput: modelpriceinput,
                ModelPriceOutput: modelpriceoutput,
                VipModelPriceInput: vipmodelpriceinput,
                VipModelPriceOutput: vipmodelpriceoutput,
                SvipModelPriceInput: svipmodelpriceinput || '',
                SvipModelPriceOutput: svipmodelpriceoutput || '',
                Rebate: rebate,
                VipRebate: viprebate,
                SvipRebate: sviprebate || '',
                Maximum: maximum || '',
                OnceFee: oncefee || '',
                VipOnceFee: viponcefee || '',
                SvipOnceFee: sviponcefee || ''
            });
        }
    });

    if (issave) {
        loadingBtn('.save');
        $.ajax({
            type: 'POST',
            url: '/OpenAll/SaveModelPrice',
            dataType: 'json',
            data: {
                modelPrice: JSON.stringify(modelPriceList)
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