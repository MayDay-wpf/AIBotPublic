$(document).ready(function () {
    // 检查localStorage中的缓存
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

    // 监听复选框状态改变
    $('.useMemory').change(function () {
        var isChecked = $(this).is(':checked');
        // 存入缓存
        var cacheData = {
            value: isChecked, time: Date.now()
        };
        localStorage.setItem('useMemory', JSON.stringify(cacheData));
        useMemory = cacheData.value;
    });
    // 检查localStorage中的缓存
    var cache_createAiPrompt = localStorage.getItem('createAiPrompt');
    if (cache_createAiPrompt) {
        var cachedData = JSON.parse(cache_createAiPrompt);
        $('.createAiPrompt').prop('checked', cachedData.value);
        createAiPrompt = cachedData.value;
    } else {
        $('.createAiPrompt').prop('checked', false);
        createAiPrompt = false;
    }

    // 监听复选框状态改变
    $('.createAiPrompt').change(function () {
        var isChecked = $(this).is(':checked');
        console.log('历史记录压缩:', isChecked ? '选中' : '未选中');
        // 存入缓存
        var cacheData = {
            value: isChecked, time: Date.now()
        };
        localStorage.setItem('createAiPrompt', JSON.stringify(cacheData));
        createAiPrompt = cacheData.value;
    });

    // 检查localStorage中的缓存
    var grouping_cache = localStorage.getItem('modelGrouping');
    if (grouping_cache) {
        var cachedData = JSON.parse(grouping_cache);
        $('.modelGrouping').prop('checked', cachedData.value);
        grouping = cachedData.value;
    } else {
        $('.modelGrouping').prop('checked', false);
        grouping = false;
    }

    // 监听复选框状态改变
    $('.modelGrouping').change(function () {
        var isChecked = $(this).is(':checked');
        if (isChecked) {
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
    });
    // 检查localStorage中的缓存
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

    // 监听复选框状态改变
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
    });
    // 检查localStorage中的缓存
    var shortcuts_cache = localStorage.getItem('shortcuts');
    if (shortcuts_cache) {
        var cachedData = JSON.parse(shortcuts_cache);
        $('.shortcuts').prop('checked', cachedData.value);
        shortcuts = cachedData.value;
    } else {
        $('.shortcuts').prop('checked', true);
        shortcuts = true;
    }

    // 监听复选框状态改变
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
    });
    // 检查localStorage中的缓存
    var stream_cache = localStorage.getItem('stream');
    if (stream_cache) {
        var cachedData = JSON.parse(stream_cache);
        $('.stream').prop('checked', cachedData.value);
        stream = cachedData.value;
    } else {
        $('.stream').prop('checked', true);
        stream = true;
    }

    // 监听复选框状态改变
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
    });
    // 检查localStorage中的缓存
    var readingMode_cache = localStorage.getItem('readingMode');
    if (readingMode_cache) {
        var cachedData = JSON.parse(readingMode_cache);
        $('.readingMode').prop('checked', cachedData.value);
        readingMode = cachedData.value;
    } else {
        $('.readingMode').prop('checked', false);
        readingMode = false;
    }

    // 监听复选框状态改变
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
    });
    // 检查localStorage中的缓存
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