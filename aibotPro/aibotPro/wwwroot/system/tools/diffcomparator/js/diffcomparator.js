let originalEditor = null;
let modifiedEditor = null;
let realTimeCompareTimer = null;
let lastOriginalContent = '';
let lastModifiedContent = '';
let originalDecorations = [];
let modifiedDecorations = [];

$(document).ready(function() {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#tools-main-menu").addClass('active');
    $("#tools-main-menu").parent().toggleClass('show');
    $("#tools-main-menu").parent().siblings().removeClass('show');
    $("#diff-comparator-tools-nav").addClass('active');

    // 延迟初始化，确保所有资源加载完成
    setTimeout(() => {
        // 初始化Monaco编辑器
        initializeMonacoEditors();

        // 初始化事件
        initializeEvents();

        // 安全地初始化Feather图标
        // if (typeof feather !== 'undefined' && feather.replace) {
        //     feather.replace();
        // }
    }, 100);
});

function initializeMonacoEditors() {
    // 配置Monaco Editor加载路径
    require.config({
        paths: {
            'vs': '/system/monaco-editor-0.45.0/package/min/vs'
        }
    });

    require(['vs/editor/editor.main'], function() {
        // 创建原始文本编辑器
        originalEditor = monaco.editor.create(document.getElementById('originalEditor'), {
            value: '',
            language: 'plaintext',
            theme: 'vs',
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            folding: true
        });

        // 创建修改文本编辑器
        modifiedEditor = monaco.editor.create(document.getElementById('modifiedEditor'), {
            value: '',
            language: 'plaintext',
            theme: 'vs',
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            folding: true
        });

        // 监听语言类型变化
        $('#languageType').on('change', function() {
            const language = $(this).val();
            if (language !== 'auto') {
                originalEditor.getModel().setLanguage(language);
                modifiedEditor.getModel().setLanguage(language);
            }
        });

        // 监听编辑器内容变化，实现实时比较
        originalEditor.onDidChangeModelContent(() => {
            realTimeCompare();
        });

        modifiedEditor.onDidChangeModelContent(() => {
            realTimeCompare();
        });

        showAlert('编辑器初始化完成，支持实时比较', 'success');

        // 测试语言检测功能
        console.log('测试语言检测:');
        console.log('JavaScript:', detectLanguage('function test() { console.log("hello"); }', ''));
        console.log('JSON:', detectLanguage('{"name": "test"}', ''));
        console.log('HTML:', detectLanguage('<div>Hello</div>', ''));
        console.log('CSS:', detectLanguage('.class { color: red; }', ''));
    });
}

function initializeEvents() {
    // 比较选项变化时重新比较
    $('#ignoreWhitespace, #ignoreCase').on('change', function() {
        realTimeCompare();
    });

    // 键盘快捷键
    $(document).on('keydown', function(e) {
        // Ctrl+Shift+S 交换文本
        if (e.ctrlKey && e.shiftKey && e.keyCode === 83) {
            swapTexts();
        }
    });
}

// 实时比较函数
function realTimeCompare() {
    // 清除之前的定时器
    if (realTimeCompareTimer) {
        clearTimeout(realTimeCompareTimer);
    }

    // 延迟执行比较，避免频繁触发
    realTimeCompareTimer = setTimeout(() => {
        const originalText = originalEditor.getValue();
        const modifiedText = modifiedEditor.getValue();

        // 检查内容是否有变化
        if (originalText === lastOriginalContent && modifiedText === lastModifiedContent) {
            return;
        }

        lastOriginalContent = originalText;
        lastModifiedContent = modifiedText;

        // 自动检测语言
        if ($('#languageType').val() === 'auto') {
            const detectedLanguage = detectLanguage(originalText, modifiedText);
            if (detectedLanguage !== 'plaintext') {
                console.log('检测到语言:', detectedLanguage);
                originalEditor.getModel().setLanguage(detectedLanguage);
                modifiedEditor.getModel().setLanguage(detectedLanguage);
            }
        }

        // 如果两个编辑器都有内容，则进行内联差异比较
        if (originalText.trim() || modifiedText.trim()) {
            performInlineDiff(originalText, modifiedText);
            calculateDiffStats(originalText, modifiedText);
            $('#diffStatsContainer').show();
        } else {
            clearDiffHighlights();
            $('#diffStatsContainer').hide();
            $('#diffStats').text('实时比较');
        }
    }, 300); // 减少到300ms延迟，提高响应速度
}


// 执行内联差异比较
function performInlineDiff(originalText, modifiedText) {
    const originalLines = originalText.split('\n');
    const modifiedLines = modifiedText.split('\n');

    // 清除之前的装饰
    clearDiffHighlights();

    const originalDecorationsList = [];
    const modifiedDecorationsList = [];

    // 简单的行级差异检测
    const maxLines = Math.max(originalLines.length, modifiedLines.length);

    for (let i = 0; i < maxLines; i++) {
        const originalLine = originalLines[i] || '';
        const modifiedLine = modifiedLines[i] || '';

        if (i >= originalLines.length) {
            // 这是新增行（只在修改编辑器中）
            modifiedDecorationsList.push({
                range: new monaco.Range(i + 1, 1, i + 1, modifiedLine.length + 1),
                options: {
                    isWholeLine: true,
                    className: 'diff-line-added',
                    marginClassName: 'diff-margin-added'
                }
            });
        } else if (i >= modifiedLines.length) {
            // 这是删除行（只在原始编辑器中）
            originalDecorationsList.push({
                range: new monaco.Range(i + 1, 1, i + 1, originalLine.length + 1),
                options: {
                    isWholeLine: true,
                    className: 'diff-line-deleted',
                    marginClassName: 'diff-margin-deleted'
                }
            });
        } else if (originalLine !== modifiedLine) {
            // 检查是否需要忽略空白或大小写
            let shouldIgnore = false;

            if ($('#ignoreWhitespace').is(':checked') && originalLine.trim() === modifiedLine.trim()) {
                shouldIgnore = true;
            }

            if ($('#ignoreCase').is(':checked') && originalLine.toLowerCase() === modifiedLine.toLowerCase()) {
                shouldIgnore = true;
            }

            if (!shouldIgnore) {
                // 修改行，在两个编辑器中都标记
                originalDecorationsList.push({
                    range: new monaco.Range(i + 1, 1, i + 1, originalLine.length + 1),
                    options: {
                        isWholeLine: true,
                        className: 'diff-line-modified-original',
                        marginClassName: 'diff-margin-modified'
                    }
                });

                modifiedDecorationsList.push({
                    range: new monaco.Range(i + 1, 1, i + 1, modifiedLine.length + 1),
                    options: {
                        isWholeLine: true,
                        className: 'diff-line-modified-new',
                        marginClassName: 'diff-margin-modified'
                    }
                });
            }
        }
    }

    // 应用装饰
    originalDecorations = originalEditor.deltaDecorations(originalDecorations, originalDecorationsList);
    modifiedDecorations = modifiedEditor.deltaDecorations(modifiedDecorations, modifiedDecorationsList);
}

// 清除差异高亮
function clearDiffHighlights() {
    if (originalEditor && originalDecorations.length > 0) {
        originalDecorations = originalEditor.deltaDecorations(originalDecorations, []);
    }
    if (modifiedEditor && modifiedDecorations.length > 0) {
        modifiedDecorations = modifiedEditor.deltaDecorations(modifiedDecorations, []);
    }
}


// 自动语言检测函数
function detectLanguage(originalText, modifiedText) {
    const allText = (originalText + modifiedText).toLowerCase().trim();

    if (!allText) return 'plaintext';

    // JSON检测 - 优先级最高
    if (isJSON(originalText) || isJSON(modifiedText)) {
        return 'json';
    }

    // HTML检测
    if (allText.includes('<!doctype') || allText.includes('<html') ||
        allText.includes('<body') || allText.includes('<head') ||
        (allText.includes('<div') && allText.includes('</div>')) ||
        (allText.includes('<span') && allText.includes('</span>'))) {
        return 'html';
    }

    // XML检测
    if (allText.includes('<?xml') ||
        (allText.includes('<') && allText.includes('</') && allText.includes('/>'))) {
        return 'xml';
    }

    // CSS检测
    if ((allText.includes('{') && allText.includes('}') && allText.includes(':') && allText.includes(';')) &&
        (allText.includes('margin') || allText.includes('padding') || allText.includes('color') ||
         allText.includes('font-size') || allText.includes('background') || allText.includes('border') ||
         allText.includes('width') || allText.includes('height'))) {
        return 'css';
    }

    // TypeScript检测 - 在JavaScript之前
    if ((allText.includes('interface ') || allText.includes('type ') ||
         allText.includes(': string') || allText.includes(': number') || allText.includes(': boolean')) &&
        (allText.includes('function') || allText.includes('const') || allText.includes('let'))) {
        return 'typescript';
    }

    // JavaScript检测
    if (allText.includes('function') || allText.includes('const ') ||
        allText.includes('let ') || allText.includes('var ') ||
        allText.includes('=>') || allText.includes('console.log') ||
        allText.includes('document.') || allText.includes('window.')) {
        return 'javascript';
    }

    // Python检测
    if (allText.includes('def ') || allText.includes('import ') ||
        allText.includes('from ') || allText.includes('print(') ||
        allText.includes('class ') && allText.includes('self')) {
        return 'python';
    }

    // Java检测
    if ((allText.includes('public class') || allText.includes('private class')) ||
        allText.includes('public static void main') ||
        (allText.includes('import java') && allText.includes('class'))) {
        return 'java';
    }

    // C#检测
    if (allText.includes('using system') ||
        (allText.includes('namespace ') && allText.includes('class')) ||
        allText.includes('public static void main') && allText.includes('string[]')) {
        return 'csharp';
    }

    // C++检测
    if (allText.includes('#include') ||
        (allText.includes('std::') && (allText.includes('cout') || allText.includes('cin'))) ||
        allText.includes('int main(')) {
        return 'cpp';
    }

    // SQL检测
    if (allText.includes('select ') && allText.includes('from ') ||
        allText.includes('insert into') || allText.includes('update ') ||
        allText.includes('delete from') || allText.includes('create table')) {
        return 'sql';
    }

    return 'plaintext';
}

// JSON格式检测
function isJSON(text) {
    if (!text || typeof text !== 'string') return false;

    try {
        const trimmed = text.trim();
        if (!trimmed) return false;

        // 必须以 { 或 [ 开始，以 } 或 ] 结束
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            JSON.parse(trimmed);
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

function calculateDiffStats(originalText, modifiedText) {
    const originalLines = originalText.split('\n');
    const modifiedLines = modifiedText.split('\n');

    // 简单的行级差异统计
    const maxLines = Math.max(originalLines.length, modifiedLines.length);
    let addedLines = 0;
    let deletedLines = 0;
    let modifiedLinesCount = 0;
    let unchangedLines = 0;

    // 使用简单的算法比较行
    for (let i = 0; i < maxLines; i++) {
        const originalLine = originalLines[i] || '';
        const modifiedLine = modifiedLines[i] || '';

        if (i >= originalLines.length) {
            addedLines++;
        } else if (i >= modifiedLines.length) {
            deletedLines++;
        } else if (originalLine !== modifiedLine) {
            if (shouldIgnoreWhitespace() && originalLine.trim() === modifiedLine.trim()) {
                unchangedLines++;
            } else if (shouldIgnoreCase() && originalLine.toLowerCase() === modifiedLine.toLowerCase()) {
                unchangedLines++;
            } else {
                modifiedLinesCount++;
            }
        } else {
            unchangedLines++;
        }
    }

    // 更新统计显示
    $('#addedLines').text(addedLines);
    $('#deletedLines').text(deletedLines);
    $('#modifiedLines').text(modifiedLinesCount);
    $('#unchangedLines').text(unchangedLines);

    // 更新差异统计标签
    const totalChanges = addedLines + deletedLines + modifiedLinesCount;
    $('#diffStats').text(`${totalChanges} 处差异`);
}

function shouldIgnoreWhitespace() {
    return $('#ignoreWhitespace').is(':checked');
}

function shouldIgnoreCase() {
    return $('#ignoreCase').is(':checked');
}

function swapTexts() {
    if (!originalEditor || !modifiedEditor) {
        showAlert('编辑器未初始化完成', 'warning');
        return;
    }

    const originalText = originalEditor.getValue();
    const modifiedText = modifiedEditor.getValue();

    originalEditor.setValue(modifiedText);
    modifiedEditor.setValue(originalText);

    showAlert('文本已交换', 'info');
}

function clearText(type) {
    if (type === 'original' && originalEditor) {
        originalEditor.setValue('');
    } else if (type === 'modified' && modifiedEditor) {
        modifiedEditor.setValue('');
    }

    // 清空后重置语言为自动检测
    if ($('#languageType').val() === 'auto') {
        originalEditor.getModel().setLanguage('plaintext');
        modifiedEditor.getModel().setLanguage('plaintext');
    }

    showAlert(`${type === 'original' ? '原始' : '修改'}文本已清空`, 'info');
}

function loadSample(type) {
    const sampleTexts = {
        javascript: {
            original: `function calculateTotal(items) {
    let total = 0;
    for (let i = 0; i < items.length; i++) {
        total += items[i].price;
    }
    return total;
}

const items = [
    { name: 'Apple', price: 1.99 },
    { name: 'Banana', price: 0.99 },
    { name: 'Orange', price: 2.49 }
];

console.log(calculateTotal(items));`,
            modified: `function calculateTotal(items) {
    return items.reduce((total, item) => total + item.price, 0);
}

const items = [
    { name: 'Apple', price: 1.99 },
    { name: 'Banana', price: 0.99 },
    { name: 'Orange', price: 2.49 },
    { name: 'Grape', price: 3.99 }
];

const total = calculateTotal(items);
console.log('Total price:', total);`
        },
        html: {
            original: `<!DOCTYPE html>
<html>
<head>
    <title>Sample Page</title>
</head>
<body>
    <h1>Welcome</h1>
    <p>This is a sample page.</p>
    <ul>
        <li>Item 1</li>
        <li>Item 2</li>
    </ul>
</body>
</html>`,
            modified: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Updated Sample Page</title>
    <style>
        body { font-family: Arial, sans-serif; }
    </style>
</head>
<body>
    <header>
        <h1>Welcome to Our Site</h1>
    </header>
    <main>
        <p>This is an updated sample page with better structure.</p>
        <ul>
            <li>Item 1</li>
            <li>Item 2</li>
            <li>Item 3</li>
        </ul>
    </main>
</body>
</html>`
        }
    };

    const language = $('#languageType').val();
    const samples = sampleTexts[language] || sampleTexts.javascript;

    if (type === 'original' && originalEditor) {
        originalEditor.setValue(samples.original);
    } else if (type === 'modified' && modifiedEditor) {
        modifiedEditor.setValue(samples.modified);
    }

    showAlert('示例文本已加载', 'success');

    // 安全地替换Feather图标
    // if (typeof feather !== 'undefined' && feather.replace) {
    //     feather.replace();
    // }
}


function exportReport() {
    if (!originalEditor || !modifiedEditor) {
        showAlert('无法导出报告，编辑器未初始化', 'warning');
        return;
    }

    const originalText = originalEditor.getValue();
    const modifiedText = modifiedEditor.getValue();

    if (!originalText.trim() && !modifiedText.trim()) {
        showAlert('无内容可导出', 'warning');
        return;
    }

    // 生成差异报告
    const report = generateDiffReport(originalText, modifiedText);

    // 创建并下载文件
    const blob = new Blob([report], { type: 'text/html;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diff-report-${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showAlert('差异报告已导出', 'success');
}

function generateDiffReport(originalText, modifiedText) {
    const timestamp = new Date().toLocaleString();
    const language = $('#languageType').val();
    const addedLines = $('#addedLines').text();
    const deletedLines = $('#deletedLines').text();
    const modifiedLines = $('#modifiedLines').text();
    const unchangedLines = $('#unchangedLines').text();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>文本差异比较报告</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; line-height: 1.6; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .stats { display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap; }
        .stat-card { flex: 1; min-width: 150px; padding: 15px; border-radius: 8px; text-align: center; }
        .added { background-color: #d4edda; border-left: 4px solid #28a745; }
        .deleted { background-color: #f8d7da; border-left: 4px solid #dc3545; }
        .modified { background-color: #fff3cd; border-left: 4px solid #ffc107; }
        .unchanged { background-color: #e2e3e5; border-left: 4px solid #6c757d; }
        .stat-number { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
        .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
        .content-section { margin-bottom: 30px; }
        .content-title { color: #495057; border-bottom: 2px solid #dee2e6; padding-bottom: 10px; }
        .text-content { background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 15px; font-family: 'Courier New', monospace; white-space: pre-wrap; max-height: 400px; overflow: auto; }
        .footer { text-align: center; color: #6c757d; font-size: 14px; margin-top: 40px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📄 文本差异比较报告</h1>
        <p>生成时间: ${timestamp}</p>
        <p>语言类型: ${language}</p>
    </div>

    <div class="stats">
        <div class="stat-card added">
            <div class="stat-number">${addedLines}</div>
            <div class="stat-label">新增行数</div>
        </div>
        <div class="stat-card deleted">
            <div class="stat-number">${deletedLines}</div>
            <div class="stat-label">删除行数</div>
        </div>
        <div class="stat-card modified">
            <div class="stat-number">${modifiedLines}</div>
            <div class="stat-label">修改行数</div>
        </div>
        <div class="stat-card unchanged">
            <div class="stat-number">${unchangedLines}</div>
            <div class="stat-label">未变化行数</div>
        </div>
    </div>

    <div class="content-section">
        <h3 class="content-title">📝 原始文本</h3>
        <div class="text-content">${originalText || '(空白文本)'}</div>
    </div>

    <div class="content-section">
        <h3 class="content-title">✏️ 修改文本</h3>
        <div class="text-content">${modifiedText || '(空白文本)'}</div>
    </div>

    <div class="footer">
        <p>此报告由 AIBot Pro 文本差异比较器生成</p>
    </div>
</body>
</html>`;
}

function showAlert(message, type = 'info') {
    // 创建或更新alert元素
    let alertElement = $('#diffComparatorAlert');

    if (alertElement.length === 0) {
        alertElement = $(`
            <div id="diffComparatorAlert" class="alert" style="position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
                <span id="alertMessage"></span>
                <button type="button" class="close ml-3" onclick="$('#diffComparatorAlert').fadeOut()">
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