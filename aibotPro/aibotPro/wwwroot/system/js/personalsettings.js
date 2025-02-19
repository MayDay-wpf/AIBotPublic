$(document).ready(function () {
    // 默认快捷键配置
    const defaultShortcuts = {
        useMemory: 'Ctrl+M',
        pure: 'Ctrl+P',
        modelGrouping: 'Ctrl+G',
        createAiPrompt: 'Ctrl+J',
        readingMode: 'Ctrl+R',
        autoChange: 'Ctrl+N',
        shortcuts: 'Ctrl+K',
        stream: 'Ctrl+S',
        seniorSetting: 'Ctrl+B'
    };

    // 当前快捷键配置
    let shortcutsConfig = {};

    // 加载快捷键配置
    function loadShortcuts() {
        const storedShortcuts = localStorage.getItem('shortcutsConfig');
        if (storedShortcuts) {
            shortcutsConfig = JSON.parse(storedShortcuts);
        } else {
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

    $('#searchIcon').on('click', function (event) {
        event.stopPropagation();
        $('#searchIcon').hide();
        $('#modelSearch').addClass('expand').fadeIn().focus();
    });

    // 搜索框失去焦点时恢复成放大镜图标
    $('#modelSearch').on('blur', function () {
        $(this).removeClass('expand').fadeOut(function () {
            $('#searchIcon').fadeIn();
        });
        $(this).val('');
        filterModels();
    });

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
        $('#maxTokensSlider').val(maxTokensValue);
        $('#maxTokensValue').text(parseInt(maxTokensValue));
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
    $('#maxTokensSlider').on('input', function () {
        $('#maxTokensValue').text(parseInt($(this).val()));
    });
    $('#settingsModal').on('show.bs.modal', function (e) {
        // 激活"基础设置"标签
        $('#settingsTabs a[href="#basic"]').tab('show');
    });
    $('#settingsTabs a[href="#basic"]').tab('show');
});
