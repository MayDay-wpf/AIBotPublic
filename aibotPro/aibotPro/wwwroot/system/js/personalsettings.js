$(document).ready(function () {
    // 默认快捷键配置
    const defaultShortcuts = {
        useMemory: 'Ctrl+M',
        pure: 'Ctrl+P',
        modelGrouping: 'Ctrl+G',
        createAiPrompt: 'Ctrl+J',
        readingMode: 'Ctrl+R',
        autoChange: 'Ctrl+N', shortcuts: 'Ctrl+K', stream: 'Ctrl+S', beforeThink: 'Ctrl+T',
        seniorSetting: 'Ctrl+B'
    };

    // 当前快捷键配置
    let shortcutsConfig = {};

    // 加载快捷键配置
    function loadShortcuts() {
        const storedShortcuts = localStorage.getItem('shortcutsConfig');
        if (storedShortcuts) {
            // 从存储中加载快捷键
            const parsedShortcuts = JSON.parse(storedShortcuts);

            // 确保所有默认键都存在，如果不存在则从默认配置中补充
            shortcutsConfig = { ...defaultShortcuts, ...parsedShortcuts };

            // 检查是否有新的默认快捷键不在已存储的配置中
            let needsUpdate = false;
            for (const key in defaultShortcuts) {
                if (!(key in parsedShortcuts)) {
                    needsUpdate = true;
                    break;
                }
            }

            // 如果发现有缺失的快捷键，更新存储
            if (needsUpdate) {
                localStorage.setItem('shortcutsConfig', JSON.stringify(shortcutsConfig));
            }
        } else {
            // 如果没有存储的配置，使用默认配置
            shortcutsConfig = { ...defaultShortcuts };
            localStorage.setItem('shortcutsConfig', JSON.stringify(shortcutsConfig));
        }
    }

    // 保存快捷键配置
    function saveShortcuts() {
        localStorage.setItem('shortcutsConfig', JSON.stringify(shortcutsConfig));
    }

    // 显示快捷键到UI
    function displayShortcuts() {
        for (const [setting, key] of Object.entries(shortcutsConfig)) {
            $(`#${setting}-key`).text(key);
        }
    }

    // 检查快捷键是否被占用
    function isShortcutTaken(newShortcut, settingToExclude) {
        for (const [setting, shortcut] of Object.entries(shortcutsConfig)) {
            if (setting !== settingToExclude && shortcut.toLowerCase() === newShortcut.toLowerCase()) {
                return true;
            }
        }
        return false;
    }

    // 设置快捷键
    function setShortcut(setting, newShortcut) {
        shortcutsConfig[setting] = newShortcut;
        saveShortcuts();
        displayShortcuts();
    }

    // 初始化快捷键
    loadShortcuts();
    displayShortcuts();

    // 快捷键更改逻辑
    let currentSettingToChange = null;

    $('.change-shortcut').on('click', function () {
        const setting = $(this).data('setting');
        currentSettingToChange = setting;
        $('#shortcutInput').text('请按下新的快捷键...');
        $('#shortcutError').hide();
        $('#changeShortcutModal').modal('show');
    });

    // 捕捉快捷键输入
    let capturingShortcut = false;
    $('#changeShortcutModal').on('shown.bs.modal', function () {
        capturingShortcut = true;
    });

    $('#changeShortcutModal').on('hidden.bs.modal', function () {
        capturingShortcut = false;
        currentSettingToChange = null;
    });

    $(document).on('keydown', function (e) {
        if (capturingShortcut && currentSettingToChange) {
            e.preventDefault();
            let keys = [];
            if (e.ctrlKey) keys.push('Ctrl');
            if (e.altKey) keys.push('Alt');
            if (e.shiftKey) keys.push('Shift');
            if (e.metaKey) keys.push('Meta');
            if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
                keys.push(e.key.toUpperCase());
            }
            const newShortcut = keys.join('+');
            if (isShortcutTaken(newShortcut, currentSettingToChange)) {
                $('#shortcutError').show();
            } else {
                setShortcut(currentSettingToChange, newShortcut);
                $('#changeShortcutModal').modal('hide');
            }
        }
    });

    // 全局快捷键监听
    $(document).on('keydown', function (e) {
        if (!shortcuts)
            return;
        // 构建按下的键组合
        let pressedKeys = [];
        if (e.ctrlKey) pressedKeys.push('Ctrl');
        if (e.altKey) pressedKeys.push('Alt');
        if (e.shiftKey) pressedKeys.push('Shift');
        if (e.metaKey) pressedKeys.push('Meta');
        const key = e.key.toUpperCase();
        if (!['CONTROL', 'ALT', 'SHIFT', 'META'].includes(e.key)) {
            pressedKeys.push(key);
        }
        const pressedShortcut = pressedKeys.join('+');

        // 检查是否匹配任何快捷键
        for (const [setting, shortcut] of Object.entries(shortcutsConfig)) {
            if (pressedShortcut.toLowerCase() === shortcut.toLowerCase()) {
                e.preventDefault();
                toggleSetting(setting);
                break;
            }
        }
    });

    // 切换设置的函数
    function toggleSetting(setting) {
        const checkbox = $(`.${setting}`);
        checkbox.prop('checked', !checkbox.is(':checked')).change();
    }

    // 启用记忆体
    var cache = localStorage.getItem('useMemory');
    if (cache) {
        var cachedData = JSON.parse(cache);
        if (Date.now() - cachedData.time < 24 * 60 * 60 * 1000) { // 检查是否在24小时内
            $('.useMemory').prop('checked', cachedData.value);
            useMemory = cachedData.value;
        } else {
            $('.useMemory').prop('checked', false);
            localStorage.removeItem('useMemory');
            useMemory = false;
        }
    } else {
        $('.useMemory').prop('checked', false);
        useMemory = false;
    }

    $('.useMemory').change(function () {
        var isChecked = $(this).is(':checked');
        // 存入缓存
        var cacheData = {
            value: isChecked, time: Date.now()
        };
        localStorage.setItem('useMemory', JSON.stringify(cacheData));
        useMemory = cacheData.value;
        if (isChecked)
            balert("记忆体已启用", "success", false, 1500, "top");
        else
            balert("记忆体已关闭", "info", false, 1500, "top");
    });
    $('.pure').change(function () {
        var isChecked = $(this).is(':checked');
        pure = isChecked;
        updatePureMode(pure);
        // 存入缓存
        var cacheData = {
            value: isChecked, time: Date.now()
        };
        localStorage.setItem('pure', JSON.stringify(cacheData));
        if (isChecked)
            balert("纯净模式已启用", "success", false, 1500, "top");
        else
            balert("纯净模式已关闭", "info", false, 1500, "top");
    });
    // 历史记录智能压缩
    var cache_createAiPrompt = localStorage.getItem('createAiPrompt');
    if (cache_createAiPrompt) {
        var cachedData = JSON.parse(cache_createAiPrompt);
        $('.createAiPrompt').prop('checked', cachedData.value);
        createAiPrompt = cachedData.value;
    } else {
        $('.createAiPrompt').prop('checked', false);
        createAiPrompt = false;
    }

    $('.createAiPrompt').change(function () {
        var isChecked = $(this).is(':checked');
        console.log('历史记录压缩:', isChecked ? '选中' : '未选中');
        // 存入缓存
        var cacheData = {
            value: isChecked, time: Date.now()
        };
        localStorage.setItem('createAiPrompt', JSON.stringify(cacheData));
        createAiPrompt = cacheData.value;
        if (isChecked)
            balert("历史记录压缩已启用", "success", false, 1500, "top");
        else
            balert("历史记录压缩已关闭", "info", false, 1500, "top");
    });

    // 模型分组
    var grouping_cache = localStorage.getItem('modelGrouping');
    if (grouping_cache) {
        var cachedData = JSON.parse(grouping_cache);
        $('.modelGrouping').prop('checked', cachedData.value);
        grouping = cachedData.value;
    } else {
        $('.modelGrouping').prop('checked', true);
        grouping = true;
    }
    $('.modelGrouping').change(function () {
        var isChecked = $(this).is(':checked');
        if (isChecked && !isMobile()) {
            getAIModelListByGroup();
        } else {
            getAIModelList();
        }
        // 存入缓存
        var cacheData = {
            value: isChecked, time: Date.now()
        };
        localStorage.setItem('modelGrouping', JSON.stringify(cacheData));
        grouping = cacheData.value;
        if (isChecked)
            balert("模型分组已启用", "success", false, 1500, "top");
        else
            balert("模型分组已关闭", "info", false, 1500, "top");
    });


    // 启用参数调节
    var seniorSetting_cache = localStorage.getItem('seniorSetting');
    if (seniorSetting_cache) {
        var cachedData = JSON.parse(seniorSetting_cache);
        $('.seniorSetting').prop('checked', cachedData.value);
        seniorSetting = cachedData.value;
        if (seniorSetting) {
            $("#seniorSettingItems").show();
            $(".seniorSettingReset").show();
        } else {
            $("#seniorSettingItems").hide();
            $(".seniorSettingReset").hide();
        }
    } else {
        $('.seniorSetting').prop('checked', false);
        $("#seniorSettingItems").hide();
        seniorSetting = false;
    }

    $('.seniorSetting').change(function () {
        var isChecked = $(this).is(':checked');
        if (isChecked) {
            $("#seniorSettingItems").slideDown();
            $(".seniorSettingReset").show();
        } else {
            $("#seniorSettingItems").slideUp();
            $(".seniorSettingReset").hide();
        }
        // 存入缓存
        var cacheData = {
            value: isChecked, time: Date.now()
        };
        localStorage.setItem('seniorSetting', JSON.stringify(cacheData));
        seniorSetting = cacheData.value;
        if (isChecked)
            balert("参数调节已启用", "success", false, 1500, "top");
        else
            balert("参数调节已关闭", "info", false, 1500, "top");
    });


    // 启用快捷键
    var shortcuts_cache = localStorage.getItem('shortcuts');
    if (shortcuts_cache) {
        var cachedData = JSON.parse(shortcuts_cache);
        $('.shortcuts').prop('checked', cachedData.value);
        shortcuts = cachedData.value;
    } else {
        $('.shortcuts').prop('checked', true);
        shortcuts = true;
    }

    $('.shortcuts').change(function () {
        var isChecked = $(this).is(':checked');
        if (isChecked) {
            shortcuts = true;
        } else {
            shortcuts = false;
        }
        // 存入缓存
        var cacheData = {
            value: isChecked, time: Date.now()
        };
        localStorage.setItem('shortcuts', JSON.stringify(cacheData));
        shortcuts = cacheData.value;
        if (isChecked)
            balert("快捷键已启用", "success", false, 1500, "top");
        else
            balert("快捷键已关闭", "info", false, 1500, "top");
    });


    // 开启流式输出
    var stream_cache = localStorage.getItem('stream');
    if (stream_cache) {
        var cachedData = JSON.parse(stream_cache);
        $('.stream').prop('checked', cachedData.value);
        stream = cachedData.value;
    } else {
        $('.stream').prop('checked', true);
        stream = true;
    }

    $('.stream').change(function () {
        var isChecked = $(this).is(':checked');
        if (isChecked) {
            stream = true;
        } else {
            stream = false;
        }
        // 存入缓存
        var cacheData = {
            value: isChecked, time: Date.now()
        };
        localStorage.setItem('stream', JSON.stringify(cacheData));
        stream = cacheData.value;
        if (isChecked)
            balert("流式输出已启用", "success", false, 1500, "top");
        else
            balert("流式输出已关闭", "info", false, 1500, "top");
    });


    // 阅读模式
    var readingMode_cache = localStorage.getItem('readingMode');
    if (readingMode_cache) {
        var cachedData = JSON.parse(readingMode_cache);
        $('.readingMode').prop('checked', cachedData.value);
        readingMode = cachedData.value;
    } else {
        $('.readingMode').prop('checked', false);
        readingMode = false;
    }
    $('.readingMode').change(function () {
        var isChecked = $(this).is(':checked');
        if (isChecked) {
            readingMode = true;
        } else {
            readingMode = false;
        }
        // 存入缓存
        var cacheData = {
            value: isChecked, time: Date.now()
        };
        localStorage.setItem('readingMode', JSON.stringify(cacheData));
        readingMode = cacheData.value;
        if (isChecked)
            balert("阅读模式已启用", "success", false, 1500, "top");
        else
            balert("阅读模式已关闭", "info", false, 1500, "top");
    });


    // 模型自动切换
    var autoChange_cache = localStorage.getItem('autoChange');
    if (autoChange_cache) {
        var cachedData = JSON.parse(autoChange_cache);
        $('.autoChange').prop('checked', cachedData.value);
        autoChange = cachedData.value;
    } else {
        $('.autoChange').prop('checked', true);
        autoChange = true;
    }


    // 监听复选框状态改变
    $('.autoChange').change(function () {
        var isChecked = $(this).is(':checked');
        if (isChecked) {
            autoChange = true;
        } else {
            autoChange = false;
        }
        // 存入缓存
        var cacheData = {
            value: isChecked, time: Date.now()
        };
        localStorage.setItem('autoChange', JSON.stringify(cacheData));
        autoChange = cacheData.value;
        if (isChecked)
            balert("模型自动切换已启用", "success", false, 1500, "top");
        else
            balert("模型自动切换已关闭", "info", false, 1500, "top");
    });

    // 前置推理
    var beforeThink_cache = localStorage.getItem('beforeThink');
    if (beforeThink_cache) {
        var cachedData = JSON.parse(beforeThink_cache);
        if (Date.now() - cachedData.time < 24 * 60 * 60 * 1000) { // 检查是否在24小时内
            $('.beforeThink').prop('checked', cachedData.value);
            beforeThink = cachedData.value;
            beforeThinkModel = cachedData.modelName;
            if (cachedData.value) {
                $('#beforeModelBox').show();
                getBeforeThinlAIModelList();
            }
        } else {
            $('.beforeThink').prop('checked', false);
            localStorage.removeItem('beforeThink');
            beforeThink = false;
        }
    } else {
        $('.beforeThink').prop('checked', false);
        beforeThink = false;
    }

    $('.beforeThink').change(function () {
        var isChecked = $(this).is(':checked');
        // 存入缓存
        var cacheData = {
            value: isChecked, time: Date.now(), modelName: beforeThinkModel
        };
        localStorage.setItem('beforeThink', JSON.stringify(cacheData));
        beforeThink = cacheData.value;
        if (isChecked) {
            $('#beforeModelBox').show();
            beforeThink = true;
            balert("前置推理已启用", "success", false, 1500, "top");
            getBeforeThinlAIModelList();
        } else {
            $('#beforeModelBox').hide();
            beforeThink = false;
            balert("前置推理已关闭", "info", false, 1500, "top");
        }
    });

    function getBeforeThinlAIModelList() {
        $.ajax({
            type: "Post", url: "/Home/GetAImodel", dataType: "json", success: function (res) {
                var html = "";
                if (res.success) {
                    //modelPriceInfo(res.data[0].modelName);
                    //检查缓存
                    if (beforeThink) {
                        for (var i = 0; i < res.data.length; i++) {
                            if (res.data[i].modelName == beforeThinkModel) {
                                $("#beforeThinkfirstModel").html(res.data[i].modelNick);
                                break;
                            }
                        }
                    } else {
                        $("#beforeThinkfirstModel").html(res.data[0].modelNick);
                        beforeThinkModel = res.data[0].modelName;
                        //更新beforeThink缓存
                        var cacheData = {
                            value: beforeThink, time: Date.now(), modelName: beforeThinkModel
                        };
                        localStorage.setItem('beforeThink', JSON.stringify(cacheData));
                    }
                    for (var i = 0; i < res.data.length; i++) {
                        var modelNick = stripHTML(res.data[i].modelNick);
                        var modelName = res.data[i].modelName;
                        modelList.push({
                            model: modelName, modelNick: res.data[i].modelNick
                        });
                        html += `<a class="dropdown-item font-14" href="#" data-model-name="${modelName}" data-model-nick="${modelNick}" data-seq="${res.data[i].seq}">${res.data[i].modelNick}</a>`;
                    }
                    $('#beforeThinkmodelList').html(html);
                    bindBeforeThinkClickEvent();
                    $(".dropdown-item").css("margin-left", 0);
                }
            }, error: function (err) {
                // balert("系统未配置AI模型", "info", false, 2000, "center");
            }
        });
    }

    function bindBeforeThinkClickEvent() {
        $('#beforeThinkmodelList a').on('click', function (e) {
            e.preventDefault();
            var modelName = $(this).data('model-name');
            var modelNick = $(this).html();
            beforeThinkchangeModel(modelName, modelNick);
        });
    }

    function beforeThinkchangeModel(modelName, modelNick) {
        $("#beforeThinkfirstModel").html(modelNick);
        feather.replace();
        $("#beforeThinkfirstModel").attr("data-modelName", modelName);
        $("#beforeThinkfirstModel").attr("data-modelNick", modelNick);
        beforeThinkModel = modelName;
        //更新beforeThink缓存
        var cacheData = {
            value: beforeThink, time: Date.now(), modelName: beforeThinkModel
        };
        localStorage.setItem('beforeThink', JSON.stringify(cacheData));
        //modelPriceInfo(modelName);
        //balert("切换模型【" + modelNick + "】成功", "success", false, 1000);
    }

    if (pure) {
        $('.sidebar').hide();
        $('.header').hide();
        $('.content-body').css("height", "100vh");
        $('.content-body').css("padding", "0");
        $('.chat-body-content').css("padding", "10px 15% 10px 15%");
        $('body').toggleClass('toggle-sidebar');
    }

    $('body').append('<div id="modelDetails">加载中...</div>');
    if (localStorage.getItem('temperatureValue')) {
        let tempValue = localStorage.getItem('temperatureValue');
        $('#temperatureSlider').val(tempValue);
        $('#temperatureValue').text(parseFloat(tempValue).toFixed(2));
    }

    //if (localStorage.getItem('topPValue')) {
    //    let topPValue = localStorage.getItem('topPValue');
    //    $('#topPSlider').val(topPValue);
    //    $('#topPValue').text(parseFloat(topPValue).toFixed(2));
    //}

    if (localStorage.getItem('frequencyPenaltyValue')) {
        let frequencyPenaltyValue = localStorage.getItem('frequencyPenaltyValue');
        $('#frequencyPenaltySlider').val(frequencyPenaltyValue);
        $('#frequencyPenaltyValue').text(parseFloat(frequencyPenaltyValue).toFixed(2));
    }

    if (localStorage.getItem('presencePenaltyValue')) {
        let presencePenaltyValue = localStorage.getItem('presencePenaltyValue');
        $('#presencePenaltySlider').val(presencePenaltyValue);
        $('#presencePenaltyValue').text(parseFloat(presencePenaltyValue).toFixed(2));
    }
    if (localStorage.getItem('maxTokensValue')) {
        let maxTokensValue = localStorage.getItem('maxTokensValue');
        $('#maxTokensValue').val(maxTokensValue);
    }
    // 更新滑块值显示
    $('#temperatureSlider').on('input', function () {
        $('#temperatureValue').text(parseFloat($(this).val()).toFixed(2));
    });
    //$('#topPSlider').on('input', function () {
    //    $('#topPValue').text(parseFloat($(this).val()).toFixed(2));
    //});
    $('#frequencyPenaltySlider').on('input', function () {
        $('#frequencyPenaltyValue').text(parseFloat($(this).val()).toFixed(2));
    });
    $('#presencePenaltySlider').on('input', function () {
        $('#presencePenaltyValue').text(parseFloat($(this).val()).toFixed(2));
    });
    $('#settingsModal').on('show.bs.modal', function (e) {
        // 激活"基础设置"标签
        $('#settingsTabs a[href="#basic"]').tab('show');
    });
    $('#settingsTabs a[href="#basic"]').tab('show');
});

function beforeThinkfilterModels() {
    var input = document.getElementById("beforeThinkmodelSearch");
    var filter = input.value.toLowerCase();
    var nodes = document.querySelectorAll('#beforeThinkmodelList a');
    nodes.forEach(function (node) {
        var modelNick = node.getAttribute('data-model-nick').toLowerCase();
        if (modelNick.includes(filter)) {
            node.style.display = "block";
        } else {
            node.style.display = "none";
        }
    });
}