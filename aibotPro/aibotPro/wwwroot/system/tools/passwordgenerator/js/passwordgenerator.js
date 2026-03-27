let generatedPasswords = [];

$(document).ready(function() {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#tools-main-menu").addClass('active');
    $("#tools-main-menu").parent().toggleClass('show');
    $("#tools-main-menu").parent().siblings().removeClass('show');
    $("#password-generator-tools-nav").addClass('active');

    initializeComponents();
    bindEvents();
});

function initializeComponents() {
    feather.replace();
    updateLengthDisplay();
    updateCharacterPreview();
}

function bindEvents() {
    // 密码长度滑块事件
    $('#passwordLength').on('input', function() {
        updateLengthDisplay();
    });

    // 字符选项变化事件
    $('.character-options input[type="checkbox"], .advanced-options input[type="checkbox"]').on('change', function() {
        updateCharacterPreview();
        updateOptionStyles();
    });

    // 键盘快捷键
    $(document).on('keydown', function(e) {
        // Ctrl+Enter 生成密码
        if (e.ctrlKey && e.keyCode === 13) {
            generatePasswords();
        }
        // Ctrl+C 复制全部（如果有生成的密码）
        if (e.ctrlKey && e.keyCode === 67 && generatedPasswords.length > 0) {
            copyAllPasswords();
        }
    });

    // 初始化选项样式
    updateOptionStyles();
}

function updateLengthDisplay() {
    const length = $('#passwordLength').val();
    $('#lengthValue').text(length);

    // 根据长度更新颜色提示
    const lengthNum = parseInt(length);
    let colorClass = '';
    if (lengthNum < 8) {
        colorClass = 'text-danger';
    } else if (lengthNum < 12) {
        colorClass = 'text-warning';
    } else {
        colorClass = 'text-success';
    }

    $('#lengthValue').removeClass('text-danger text-warning text-success').addClass(colorClass);
}

function updateOptionStyles() {
    $('.option-item').each(function() {
        const checkbox = $(this).find('input[type="checkbox"]');
        if (checkbox.is(':checked')) {
            $(this).addClass('selected');
        } else {
            $(this).removeClass('selected');
        }
    });
}

function updateCharacterPreview() {
    const charset = buildCharacterSet();
    const previewHtml = `
        <div class="charset-preview">
            <h6>当前字符集预览 (共 ${charset.length} 个字符):</h6>
            <div>${charset}</div>
        </div>
    `;

    // 如果预览区域不存在，则添加
    if ($('.charset-preview').length === 0) {
        $('.advanced-options').after(previewHtml);
    } else {
        $('.charset-preview').replaceWith(previewHtml);
    }
}

function buildCharacterSet() {
    let charset = '';

    // 基础字符集
    if ($('#includeUppercase').is(':checked')) {
        charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    }

    if ($('#includeLowercase').is(':checked')) {
        charset += 'abcdefghijklmnopqrstuvwxyz';
    }

    if ($('#includeNumbers').is(':checked')) {
        charset += '0123456789';
    }

    if ($('#includeSymbols').is(':checked')) {
        charset += '!@#$%^&*()_+-=[]{}|;:,.<>?"\'`~';
    }

    // 应用排除选项
    if ($('#excludeSimilar').is(':checked')) {
        charset = charset.replace(/[0OlI1]/g, '');
    }

    if ($('#excludeAmbiguous').is(':checked')) {
        charset = charset.replace(/[{}\[\]()<>"'`~]/g, '');
    }

    return charset;
}

function generatePasswords() {
    const charset = buildCharacterSet();

    // 验证字符集
    if (charset.length === 0) {
        showAlert('请至少选择一种字符类型！', 'warning');
        return;
    }

    const length = parseInt($('#passwordLength').val());
    const count = parseInt($('#passwordCount').val());

    // 显示生成中状态
    const generateBtn = $('#generateBtn');
    generateBtn.addClass('generating').prop('disabled', true);
    generateBtn.html('<i data-feather="loader" class="loading-spinner"></i> 生成中<span class="loading-dots"></span>');
    feather.replace();

    // 模拟一点延迟，让用户感受到生成过程
    setTimeout(() => {
        try {
            generatedPasswords = [];

            for (let i = 0; i < count; i++) {
                const password = generateSinglePassword(charset, length);
                generatedPasswords.push(password);
            }

            displayPasswords();
            showStatistics(charset, length);

            // 显示结果区域
            $('#resultsContainer').show();

            // 滚动到结果区域
            setTimeout(() => {
                $('html, body').animate({
                    scrollTop: $('#resultsContainer').offset().top - 100
                }, 800);
            }, 100);

            showAlert(`成功生成 ${count} 个密码！`, 'success');

        } catch (error) {
            console.error('生成密码失败:', error);
            showAlert('生成密码失败，请重试', 'danger');
        } finally {
            // 恢复按钮状态
            generateBtn.removeClass('generating').prop('disabled', false);
            generateBtn.html('<i data-feather="key"></i> 生成密码');
            feather.replace();
        }
    }, 500);
}

function generateSinglePassword(charset, length) {
    let password = '';
    const cryptoArray = new Uint32Array(length);

    // 使用加密安全的随机数生成器
    if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(cryptoArray);
        for (let i = 0; i < length; i++) {
            password += charset[cryptoArray[i] % charset.length];
        }
    } else {
        // 降级到Math.random()（不推荐用于安全目的）
        for (let i = 0; i < length; i++) {
            password += charset[Math.floor(Math.random() * charset.length)];
        }
    }

    return password;
}

function displayPasswords() {
    const resultsContainer = $('#passwordResults');
    resultsContainer.empty();

    generatedPasswords.forEach((password, index) => {
        const passwordItem = `
            <div class="password-item">
                <div class="password-text" id="password-${index}">${password}</div>
                <div class="password-actions">
                    <button class="copy-btn" onclick="copyPassword(${index})" title="复制密码">
                        <i data-feather="copy"></i>
                    </button>
                </div>
            </div>
        `;
        resultsContainer.append(passwordItem);
    });

    feather.replace();
}

function showStatistics(charset, length) {
    const totalChars = charset.length;
    const entropy = Math.log2(Math.pow(totalChars, length));
    const combinations = Math.pow(totalChars, length);

    // 更新统计信息
    $('#totalChars').text(totalChars);
    $('#entropy').text(Math.round(entropy));

    // 格式化组合数量
    if (combinations > 1e15) {
        $('#combinations').text('> 10¹⁵');
    } else if (combinations > 1e12) {
        $('#combinations').text((combinations / 1e12).toFixed(1) + 'T');
    } else if (combinations > 1e9) {
        $('#combinations').text((combinations / 1e9).toFixed(1) + 'B');
    } else if (combinations > 1e6) {
        $('#combinations').text((combinations / 1e6).toFixed(1) + 'M');
    } else {
        $('#combinations').text(combinations.toExponential(2));
    }

    // 计算安全等级
    let strengthLevel, strengthClass;
    if (entropy < 40) {
        strengthLevel = '弱';
        strengthClass = 'strength-weak';
    } else if (entropy < 60) {
        strengthLevel = '中';
        strengthClass = 'strength-medium';
    } else if (entropy < 80) {
        strengthLevel = '强';
        strengthClass = 'strength-good';
    } else {
        strengthLevel = '极强';
        strengthClass = 'strength-strong';
    }

    $('#strengthLevel').text(strengthLevel).removeClass('strength-weak strength-medium strength-good strength-strong').addClass(strengthClass);

    // 显示统计信息
    $('#strengthStats').show();
}

function copyPassword(index) {
    const password = generatedPasswords[index];
    const copyBtn = $(`.password-item:eq(${index}) .copy-btn`);

    copyToClipboard(password).then(() => {
        // 视觉反馈
        copyBtn.addClass('copied');
        copyBtn.find('i').attr('data-feather', 'check');
        feather.replace();

        showAlert(`密码 ${index + 1} 已复制`, 'success');

        // 恢复按钮状态
        setTimeout(() => {
            copyBtn.removeClass('copied');
            copyBtn.find('i').attr('data-feather', 'copy');
            feather.replace();
        }, 2000);
    }).catch(() => {
        showAlert('复制失败，请手动选择复制', 'warning');
    });
}

function copyAllPasswords() {
    if (generatedPasswords.length === 0) {
        showAlert('没有可复制的密码', 'warning');
        return;
    }

    const allPasswords = generatedPasswords.join('\n');

    copyToClipboard(allPasswords).then(() => {
        showAlert(`已复制全部 ${generatedPasswords.length} 个密码`, 'success');
    }).catch(() => {
        showAlert('复制失败，请手动选择复制', 'warning');
    });
}

function copyToClipboard(text) {
    return new Promise((resolve, reject) => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(resolve).catch(reject);
        } else {
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                if (successful) {
                    resolve();
                } else {
                    reject();
                }
            } catch (err) {
                document.body.removeChild(textArea);
                reject(err);
            }
        }
    });
}


function downloadPasswords() {
    if (generatedPasswords.length === 0) {
        showAlert('没有可下载的密码', 'warning');
        return;
    }

    const content = generatedPasswords.join('\n');
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `passwords_${timestamp}.txt`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    showAlert(`密码已保存为 ${filename}`, 'success');
}

function clearPasswords() {
    generatedPasswords = [];
    $('#passwordResults').empty();
    $('#resultsContainer').hide();
    $('#strengthStats').hide();
    showAlert('已清空所有密码', 'info');
}

function showAlert(message, type = 'info') {
    // 创建或更新alert元素
    let alertElement = $('#passwordGeneratorAlert');

    if (alertElement.length === 0) {
        alertElement = $(`
            <div id="passwordGeneratorAlert" class="alert" style="position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
                <span id="alertMessage"></span>
                <button type="button" class="close ml-3" onclick="$('#passwordGeneratorAlert').fadeOut()">
                    <span>&times;</span>
                </button>
            </div>
        `);
        $('body').append(alertElement);
    }

    // 更新样式和消息
    alertElement.removeClass('alert-success alert-warning alert-danger alert-info')
                .addClass(`alert-${getBootstrapAlertClass(type)}`)
                .find('#alertMessage').text(message);

    // 显示并自动隐藏
    alertElement.fadeIn();

    setTimeout(() => {
        alertElement.fadeOut();
    }, type === 'error' ? 5000 : 3000);
}

function getBootstrapAlertClass(type) {
    const classMap = {
        'success': 'success',
        'warning': 'warning',
        'error': 'danger',
        'info': 'info'
    };
    return classMap[type] || 'info';
}