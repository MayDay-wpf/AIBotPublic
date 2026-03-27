/// <reference path="pdfjs/pdf.worker.min.js" />
/// <reference path="pdfjs/pdf.worker.min.js" />
var textarea = document.getElementById("Q");
var $Q = $("#Q");
var chatBody = $(".chat-body-main");
var thisAiModel = "gpt-4.1-nano-openai"; //当前AI模型
var thisAiModelNick = `<i class='icon icon-gpt'></i> ChatGPT-4.1-Nano🚀✨🖼️`;
var processOver = true; //是否处理完毕
var image_path = [];
var file_list = [];
var chatid = "";
var chatgroupid = "";
var assistansBoxId = "";
let pageIndex = 1;
let pageSize = 20;
let useMemory = false;
let pure = false;
let grouping = false;
let createAiPrompt = false;
let seniorSetting = false;
let shortcuts = true;
let stream = true;
let readingMode = false;
let autoChange = true;
var markdownHis = [];
let roleAvatar = 'A';
var systemPrompt = "";
let roleName = "AIBot";
let modelList = [];
let currentZoomLevel = 1.0;
$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#chatpdf-product-nav").addClass('active');
    getAIModelList();
    $('#pdf-upload').val('');
    $('<style>')
        .prop('type', 'text/css')
        .html(`
        .ocr-text {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            color: transparent;
            pointer-events: auto;
            z-index: 2;
            user-select: text;
            overflow: hidden;
        }
        .ocr-text.active {
            color: rgba(0, 0, 0, 0.7);
            background: rgba(255, 255, 255, 0.8);
        }
        .ocr-text .highlight {
            background-color: rgba(255, 255, 0, 0.4);
            color: black;
        }
        .ocr-text-word {
            position: absolute;
            white-space: pre;
            cursor: text;
            transform-origin: 0% 0%;
        }
        #pdf-viewer .page-container:hover .ocr-text {
            color: rgba(0, 0, 0, 0.3);
        }
        #ocr-toggle {
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 1000;
            padding: 5px 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        #ocr-processing-indicator {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 10px;
            border-radius: 4px;
            z-index: 9999;
        }
    `)
        .appendTo('head');

    // 添加OCR切换按钮
    $('body').append('<button id="ocr-toggle">显示/隐藏OCR文本</button>');

    // OCR文本显示切换
    $('#ocr-toggle').on('click', function () {
        $('.ocr-text').toggleClass('active');
    });
});
function getAIModelList() {
    $.ajax({
        type: "Post", url: "/Home/GetAImodel", dataType: "json", success: function (res) {
            var html = "";
            if (res.success) {
                modelPriceInfo(res.data[0].modelName);
                $("#firstModel").html(res.data[0].modelNick);
                thisAiModel = res.data[0].modelName;
                for (var i = 0; i < res.data.length; i++) {
                    var modelNick = stripHTML(res.data[i].modelNick);
                    var modelName = res.data[i].modelName;
                    modelList.push({
                        model: modelName,
                        modelNick: res.data[i].modelNick
                    });
                    html += `<a class="dropdown-item font-14" href="#" data-model-name="${modelName}" data-model-nick="${modelNick}" data-seq="${res.data[i].seq}">${res.data[i].modelNick}</a>`;
                }
                $('#modelList').html(html);
                bindClickEvent();
                if (!isMobile()) {
                    var originalOrder;
                    // 首先销毁之前的sortable实例
                    if ($("#modelList").data('uiSortable')) {
                        $("#modelList").sortable("destroy");
                    }
                    // 初始化拖动排序
                    $("#modelList").sortable({
                        revert: 100, start: function (event, ui) {
                            // 记录原始顺序
                            originalOrder = $("#modelList").sortable("toArray", { attribute: "data-model-name" });
                            // 在拖动开始时禁用点击事件
                            $('#modelList a').off('click');
                        }, stop: function (event, ui) {
                            var newOrder = $("#modelList").sortable("toArray", { attribute: "data-model-name" });
                            // 比较新旧顺序
                            if (!arraysEqual(originalOrder, newOrder)) {
                                saveModelSeq();
                            }
                            bindClickEvent();
                            bindHoverEvent();
                        }
                    }).disableSelection();
                    bindHoverEvent();
                }
                $(".dropdown-item").css("margin-left", 0);
            }
        }, error: function (err) {
            // balert("系统未配置AI模型", "info", false, 2000, "center");
        }
    });
}
function bindClickEvent() {
    $('#modelList a').on('click', function (e) {
        e.preventDefault();
        var modelName = $(this).data('model-name');
        var modelNick = $(this).html();
        changeModel(modelName, modelNick);
    });
}

function bindHoverEvent() {
    $('#modelList a').on('mouseenter', function (e) {
        var modelName = $(this).data('model-name');
        showTooltip(modelName, e);
    }).on('mouseleave', function () {
        hideTooltip();
    }).on('mousemove', function (e) {
        moveTooltip(e);
    });
}

function showTooltip(text, e) {
    $('body').append('<div id="customTooltip" style="position: fixed; background: #333; color: #fff; padding: 5px 10px; border-radius: 4px; font-size: 12px; z-index: 9999;">' + text + '</div>');
    moveTooltip(e);
}

function moveTooltip(e) {
    $('#customTooltip').css({
        left: e.pageX + 10,
        top: e.pageY + 10
    });
}

function hideTooltip() {
    $('#customTooltip').remove();
}

function modelPriceInfo(modelName) {
    $.ajax({
        url: "/Home/GetModelPrice", type: "post", dataType: "json",//返回对象
        data: {
            modelName: modelName
        }, success: function (res) {
            if (res.success) {
                res = res.data;
                var str = ``;
                if (res.length > 0) {
                    var data = res[0];
                    if (data.modelPrice.onceFee > 0) {
                        if (topVipType == "VIP|15") {
                            str = `<span class="badge badge-pill badge-success">输出：${data.modelPrice.vipOnceFee}/次</span>`;
                        }
                        if (topVipType == "VIP|50" || topVipType == "VIP|90") {
                            str = `<span class="badge badge-pill badge-success">输出：${data.modelPrice.svipOnceFee}/次</span>`;
                        } else {
                            str = `<span class="badge badge-pill badge-success">输出：${data.modelPrice.onceFee}/次</span>`;
                        }
                    } else {
                        if (topVipType == "VIP|15") {
                            if (data.modelPrice.vipModelPriceInput > 0 && data.modelPrice.vipModelPriceOutput > 0) {
                                str = `<span class="badge badge-pill badge-info">输入：${data.modelPrice.vipModelPriceInput}/1k token</span>
                                   <span class="badge badge-pill badge-success">输出：${data.modelPrice.vipModelPriceOutput}/1k token</span>`;
                            } else {
                                str = '<span class="badge badge-pill badge-success">免费</span>';
                            }
                        } else if (topVipType == "VIP|50" || topVipType == "VIP|90") {
                            if (data.modelPrice.svipModelPriceInput > 0 && data.modelPrice.svipModelPriceOutput > 0) {
                                str = `<span class="badge badge-pill badge-info">输入：${data.modelPrice.svipModelPriceInput}/1k token</span>
                                   <span class="badge badge-pill badge-success">输出：${data.modelPrice.svipModelPriceOutput}/1k token</span>`;
                            } else {
                                str = '<span class="badge badge-pill badge-success">免费</span>';
                            }
                        } else {
                            if (data.modelPrice.modelPriceInput > 0 && data.modelPrice.modelPriceOutput > 0) {
                                str = `<span class="badge badge-pill badge-info">输入：${data.modelPrice.modelPriceInput}/1k token</span>
                                   <span class="badge badge-pill badge-success">输出：${data.modelPrice.modelPriceOutput}/1k token</span>`;
                            } else {
                                str = '<span class="badge badge-pill badge-success">免费</span>';
                            }
                        }
                    }
                } else {
                    str = '<span class="badge badge-pill badge-success">免费</span>';
                }
                $('#priceInfo').html(str);
            }
        }
    });
}

// 辅助函数：比较两个数组是否相等
function arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (var i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }
    return true;
}

function stripHTML(html) {
    var tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

function filterModels() {
    var input = document.getElementById("modelSearch");
    var filter = input.value.toLowerCase();
    var groups = document.querySelectorAll('.model-group');
    // 当输入框为空时，展开第一个分组，折叠其他所有分组，所有项可见
    if (groups.length > 0) {
        if (filter === '') {
            groups.forEach(function (group, index) {
                var nodes = group.querySelectorAll('a');

                nodes.forEach(function (node) {
                    node.style.display = "block";  // 显示所有模型
                });

                var collapse = group.querySelector('.collapse');
                if (index === 0) {
                    $(collapse).collapse('show');  // 展开第一个分组
                } else {
                    $(collapse).collapse('hide');  // 折叠其他分组
                }
                group.style.display = "block";  // 显示所有分组
            });
            return;
        }
        groups.forEach(function (group) {
            var nodes = group.querySelectorAll('a');
            var groupVisible = false;  // 用于判断当前组是否应当展示

            nodes.forEach(function (node) {
                var modelNick = node.getAttribute('data-model-nick').toLowerCase();
                if (modelNick.includes(filter)) {
                    node.style.display = "block";  // 显示匹配的模型
                    groupVisible = true;  // 标记分组为可见
                } else {
                    node.style.display = "none";
                }
            });

            // 如果组内有匹配的模型，则展开该组并显示，否则隐藏
            if (groupVisible) {
                var collapse = group.querySelector('.collapse');
                $(collapse).collapse('show');  // 使用jQuery来控制展开
                group.style.display = "block";  // 显示此分组
            } else {
                var collapse = group.querySelector('.collapse');
                $(collapse).collapse('hide');  // 如果没有匹配项则折叠该组
                group.style.display = "none";  // 隐藏此分组
            }
        });
    } else {
        var nodes = document.querySelectorAll('#modelList a');
        nodes.forEach(function (node) {
            var modelNick = node.getAttribute('data-model-nick').toLowerCase();
            if (modelNick.includes(filter)) {
                node.style.display = "block";
            } else {
                node.style.display = "none";
            }
        });
    }
}

function saveModelSeq() {
    var items = $("#modelList").find("a");
    var formData = new FormData();
    items.each(function (index, item) {
        var modelName = $(item).data("model-name");
        var modelNick = $(item).data("model-nick");
        var seq = index + 1;
        formData.append(`ChatModelSeq[${index}].ModelNick`, modelNick);
        formData.append(`ChatModelSeq[${index}].ModelName`, modelName);
        formData.append(`ChatModelSeq[${index}].Seq`, seq);
    });

    //loadingBtn('.saveSeq');
    $.ajax({
        type: 'POST',
        url: '/Home/SaveModelSeq',
        processData: false,
        contentType: false,
        data: formData,
        success: function (res) {
            //unloadingBtn('.saveSeq');
            if (res.success) {
                balert(res.msg, 'success', false, 1500, 'top');
            } else {
                balert(res.msg, 'danger', false, 1500, 'top');
            }
        },
        error: function (error) {
            //unloadingBtn('.saveSeq');
            sendExceptionMsg("保存排序异常");
        }
    });
}

//切换模型
function changeModel(modelName, modelNick) {
    $("#chatDropdown").html(modelNick + `<i data-feather="chevron-down" style="width:20px;"></i>`);
    feather.replace();
    $("#chatDropdown").attr("data-modelName", modelName);
    $("#chatDropdown").attr("data-modelNick", modelNick);
    thisAiModel = modelName;
    modelPriceInfo(modelName);
    balert("切换模型【" + modelNick + "】成功", "success", false, 1000);
}
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
let currentPdf = null;
let selectedText = '';
let visibleText = ''; // 全局变量，存储当前可视区域的PDF文本
let scrollTimeout = null;
let suggestedQuestionsVisible = false;
let isPdfScanned = false;
let ocrProcessing = false;

pdfjsLib.GlobalWorkerOptions.workerSrc = '/system/js/pdfjs/pdf.worker.min.js';
// 加载Tesseract.js库
function loadTesseractScript() {
    return new Promise((resolve, reject) => {
        if (window.Tesseract) {
            resolve(window.Tesseract);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
        script.onload = () => {
            // 预加载中文和英文语言包
            window.Tesseract.createWorker()
                .then(worker => {
                    return worker.loadLanguage('chi_sim+eng')
                        .then(() => worker.initialize('chi_sim+eng'))
                        .then(() => worker.terminate());
                })
                .then(() => {
                    console.log('Tesseract.js已加载，语言包已准备好');
                    resolve(window.Tesseract);
                });
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

$('#upload-button').on('click', function () {
    $('#pdf-upload').click();
});
function generateSuggestedQuestions() {
    if (visibleText == "")
        return;
    $('#loading-animation').show();
    $('#suggested-questions').hide();
    $.ajax({
        url: "/Product/CreateQuestion",
        type: "post",
        dataType: "json",
        data: {
            content: visibleText
        },
        success: function (res) {
            if (res.success) {
                res.data.forEach((question, index) => {
                    $(`#suggested-questions .suggested-question[data-question-id="${index + 1}"] .question-text`).text(question);
                });
                $('#loading-animation').hide();
                $('#suggested-questions').show();
                suggestedQuestionsVisible = true;
                adjustChatContainerHeight();
            } else if (res.msg) {
                $('#suggested-questions').html(`<h4 class="text-danger text-center"><i class="fas fa-info"></i> ${res.msg}</h4>`);
                $('#loading-animation').hide();
                $('#suggested-questions').show();
            }
        },
        error: function (xhr, status, error) {
            console.error("Error fetching notices:", error);
        }
    });
}
function changeQuestion() {
    $('#loading-animation').show();
    $('#suggested-questions').hide();

    // 获取所有现有的问题
    let existingQuestions = [];
    $('#suggested-questions .suggested-question .question-text').each(function () {
        existingQuestions.push($(this).text());
    });

    // 构建包含现有问题的提示
    let prompt = visibleText + "\n\nExisting questions (please avoid these):\n" + existingQuestions.join("\n");

    $.ajax({
        url: "/Product/CreateQuestion",
        type: "post",
        dataType: "json",
        data: {
            content: prompt
        },
        success: function (res) {
            if (res.success) {
                res.data.forEach((question, index) => {
                    let questionElement = $(`#suggested-questions .suggested-question[data-question-id="${index + 1}"] .question-text`);
                    if (existingQuestions.includes(question)) {
                        // 如果新生成的问题与现有问题重复，保留原问题
                        console.log("Duplicate question detected, keeping original:", question);
                    } else {
                        questionElement.text(question);
                    }
                });
                $('#loading-animation').hide();
                $('#suggested-questions').show();
                suggestedQuestionsVisible = true;
                adjustChatContainerHeight();
            } else if (res.msg) {
                $('#suggested-questions').html(`<h4 class="text-danger text-center"><i class="fas fa-info"></i> ${res.msg}</h4>`);
                $('#loading-animation').hide();
                $('#suggested-questions').show();
            }
        },
        error: function (xhr, status, error) {
            console.error("Error changing questions:", error);
            $('#loading-animation').hide();
        }
    });
}
// 点击建议的问题
$('#suggested-questions').on('click', '.suggested-question', function (e) {
    if (!$(e.target).hasClass('close-btn')) {
        const question = $(this).find('.question-text').text();
        $Q.val(question);
        autoResizeTextarea();
        sendMsg();
    }
});

// 关闭建议的问题
$('#suggested-questions').on('click', '.close-btn', function (e) {
    e.stopPropagation();
    $(this).closest('.suggested-question').hide();
    if ($('#suggested-questions .suggested-question:visible').length === 0) {
        $('#suggested-questions').hide();
        suggestedQuestionsVisible = false;
        adjustChatContainerHeight();
    }
});
function adjustChatContainerHeight() {
    if (suggestedQuestionsVisible) {
        const suggestedQuestionsHeight = $('#suggested-questions').outerHeight();
        $('#chat-container').css('height', `calc(100% - ${suggestedQuestionsHeight + 80}px)`);
    } else {
        $('#chat-container').css('height', 'calc(100% - 80px)');
    }
}
$('#pdf-upload').on('change', function (e) {
    const file = e.target.files[0];
    if (file.type !== 'application/pdf') {
        balert('请上传 PDF 文件。', "warning", false, 1500, "center");
        return;
    }

    const fileName = file.name;
    $('.custom-file-label').text(fileName);

    const reader = new FileReader();
    reader.onload = function (e) {
        const typedarray = new Uint8Array(e.target.result);
        loadPdf(typedarray);
    };
    reader.readAsArrayBuffer(file);
});

$('#toggle-thumbnails').on('click', function () {
    const thumbnails = $('#pdf-thumbnails');
    const icon = $(this).find('i');

    if (thumbnails.is(':visible')) {
        thumbnails.hide();
        icon.removeClass('fa-chevron-left').addClass('fa-chevron-right');
    } else {
        thumbnails.show();
        icon.removeClass('fa-chevron-right').addClass('fa-chevron-left');
    }
});

function loadPdf(data) {
    pdfjsLib.getDocument(data).promise.then(function (pdf) {
        currentPdf = pdf;
        const viewer = document.getElementById('pdf-viewer');
        const thumbnailsContainer = document.getElementById('pdf-thumbnails');

        // 清空现有内容
        viewer.innerHTML = '';
        thumbnailsContainer.innerHTML = '';
        // 检测PDF是否为扫描件
        checkIfScannedPdf(pdf).then(isScanned => {
            isPdfScanned = isScanned;
            if (isScanned) {
                balert('检测到PDF可能是扫描件，正在加载OCR功能...', "info", false, 2000, "center");
                loadTesseractScript().then(tesseract => {
                    console.log('Tesseract.js已加载，可以进行OCR识别');
                }).catch(err => {
                    console.error('加载Tesseract.js失败:', err);
                });
            }
        });
        // 重新添加切换按钮
        const toggleButton = document.createElement('button');
        toggleButton.id = 'toggle-thumbnails';
        toggleButton.className = 'btn btn-sm btn-light toggle-thumbnails';
        toggleButton.innerHTML = '<i class="fas fa-chevron-left"></i>';

        // 将按钮添加到PDF容器而不是viewer中
        document.querySelector('.pdf-container').appendChild(toggleButton);

        // 重新绑定切换按钮事件
        $('#toggle-thumbnails').on('click', function () {
            const thumbnails = $('#pdf-thumbnails');
            const icon = $(this).find('i');

            if (thumbnails.is(':visible')) {
                thumbnails.hide().addClass('hidden');
                icon.removeClass('fa-chevron-left').addClass('fa-chevron-right');
                $(this).css('left', '10px');
            } else {
                thumbnails.show().removeClass('hidden');
                icon.removeClass('fa-chevron-right').addClass('fa-chevron-left');

                // 根据屏幕大小调整按钮位置
                if ($(window).width() > 992) {
                    $(this).css('left', '130px');
                } else if ($(window).width() > 768) {
                    $(this).css('left', '120px');
                }
            }
        });

        let renderedPages = 0;
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            // 创建主视图页面容器
            const pageContainer = document.createElement('div');
            pageContainer.className = 'page-container';
            pageContainer.id = `page-${pageNum}`;
            viewer.appendChild(pageContainer);

            // 创建缩略图容器
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = 'pdf-thumbnail';
            thumbnailContainer.setAttribute('data-page', pageNum);
            thumbnailContainer.innerHTML = `
                <div class="page-number">第 ${pageNum} 页</div>
            `;
            thumbnailsContainer.appendChild(thumbnailContainer);

            // 渲染主视图页面
            renderPage(pdf, pageNum, pageContainer).then(() => {
                renderedPages++;
                if (renderedPages === pdf.numPages) {
                    updateVisibleText(); // 更新可视文本
                    generateSuggestedQuestions(); // 生成可能提出的问题
                    generateTableOfContents(pdf); // 加载目录
                    highlightVisibleThumbnails(); // 高亮当前可见页面的缩略图
                }
            });

            // 渲染缩略图
            renderThumbnail(pdf, pageNum, thumbnailContainer);
        }

        // 添加滚动事件监听器
        $('#pdf-viewer').on('scroll', function () {
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
            scrollTimeout = setTimeout(function () {
                updateVisibleText();
                highlightVisibleThumbnails();
            }, 200);
        });

        // 添加缩略图点击事件
        $(thumbnailsContainer).on('click', '.pdf-thumbnail', function () {
            const pageNum = $(this).data('page');
            document.getElementById(`page-${pageNum}`).scrollIntoView();
        });
    });
}
async function checkIfScannedPdf(pdf) {
    try {
        // 获取第一页进行检测
        const page = await pdf.getPage(1);
        const textContent = await page.getTextContent();
        
        // 如果文本内容很少或没有，可能是扫描件
        const isScanned = textContent.items.length < 10;
        
        if (isScanned) {
            // 添加OCR控制面板
            addOcrControls();
        }
        
        return isScanned;
    } catch (error) {
        console.error('检测PDF类型时出错:', error);
        return false;
    }
}
// 渲染缩略图
function renderThumbnail(pdf, pageNum, container) {
    return pdf.getPage(pageNum).then(function (page) {
        const scale = 0.2; // 缩略图比例
        const viewport = page.getViewport({ scale: scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        return page.render(renderContext).promise.then(function () {
            // 将渲染好的canvas转换为图片
            const img = document.createElement('img');
            img.src = canvas.toDataURL();

            // 将图片插入到缩略图容器的开头
            container.insertBefore(img, container.firstChild);
        });
    });
}

// 高亮当前可见页面的缩略图
function highlightVisibleThumbnails() {
    const viewer = document.getElementById('pdf-viewer');
    const viewerRect = viewer.getBoundingClientRect();

    // 移除所有高亮
    $('.pdf-thumbnail').removeClass('active');

    // 找到当前可见的页面
    $('.page-container').each(function () {
        const pageRect = this.getBoundingClientRect();
        // 如果页面在可视区域内
        if (pageRect.top < viewerRect.bottom && pageRect.bottom > viewerRect.top) {
            const pageId = $(this).attr('id');
            const pageNum = pageId.replace('page-', '');
            // 高亮对应的缩略图
            $(`.pdf-thumbnail[data-page="${pageNum}"]`).addClass('active');

            // 确保缩略图在缩略图容器的可视区域内
            const thumbnail = document.querySelector(`.pdf-thumbnail[data-page="${pageNum}"]`);
            if (thumbnail) {
                const thumbnailsContainer = document.getElementById('pdf-thumbnails');
                thumbnailsContainer.scrollTop = thumbnail.offsetTop - thumbnailsContainer.offsetHeight / 2 + thumbnail.offsetHeight / 2;
            }
        }
    });
}
function getCurrentVisiblePage() {
    const viewer = document.getElementById('pdf-viewer');
    const viewerRect = viewer.getBoundingClientRect();
    let currentPage = null;
    let maxVisibleArea = 0;

    $('.page-container').each(function () {
        const pageRect = this.getBoundingClientRect();
        // 计算页面在可视区域内的面积
        const visibleTop = Math.max(pageRect.top, viewerRect.top);
        const visibleBottom = Math.min(pageRect.bottom, viewerRect.bottom);
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);
        const visibleArea = visibleHeight * pageRect.width;

        if (visibleArea > maxVisibleArea) {
            maxVisibleArea = visibleArea;
            const pageId = $(this).attr('id');
            currentPage = pageId ? parseInt(pageId.replace('page-', '')) : null;
        }
    });

    return currentPage;
}
function renderPage(pdf, pageNum, container) {
    return renderPageWithZoom(pdf, pageNum, container, currentZoomLevel);
}
// 放大PDF
$('#zoom-in').on('click', function () {
    if (currentZoomLevel < 3.0) {  // 设置最大缩放级别为300%
        currentZoomLevel += 0.1;
        updateZoomLevel();
        reRenderPdfWithZoom();
    }
});

// 缩小PDF
$('#zoom-out').on('click', function () {
    if (currentZoomLevel > 0.5) {  // 设置最小缩放级别为50%
        currentZoomLevel -= 0.1;
        updateZoomLevel();
        reRenderPdfWithZoom();
    }
});

// 重置缩放
$('#zoom-reset').on('click', function () {
    currentZoomLevel = 1.0;
    updateZoomLevel();
    reRenderPdfWithZoom();
});

// 更新缩放级别显示
function updateZoomLevel() {
    $('#zoom-level').text(Math.round(currentZoomLevel * 100) + '%');
}

// 根据缩放级别重新渲染PDF
function reRenderPdfWithZoom() {
    if (!currentPdf) return;

    // 获取当前滚动位置和可见页面
    const currentScrollPosition = $('#pdf-viewer').scrollTop();
    const currentPage = getCurrentVisiblePage();

    // 清空PDF查看器
    const viewer = document.getElementById('pdf-viewer');
    viewer.innerHTML = '';

    // 重新渲染所有页面
    let renderedPages = 0;
    for (let pageNum = 1; pageNum <= currentPdf.numPages; pageNum++) {
        const pageContainer = document.createElement('div');
        pageContainer.className = 'page-container';
        pageContainer.id = `page-${pageNum}`;
        viewer.appendChild(pageContainer);

        renderPageWithZoom(currentPdf, pageNum, pageContainer, currentZoomLevel).then(() => {
            renderedPages++;
            if (renderedPages === currentPdf.numPages) {
                // 恢复滚动位置
                if (currentPage) {
                    document.getElementById(`page-${currentPage}`).scrollIntoView();
                } else {
                    $('#pdf-viewer').scrollTop(currentScrollPosition);
                }

                updateVisibleText();
                highlightVisibleThumbnails();
            }
        });
    }
}

// 使用指定缩放级别渲染页面
function renderPageWithZoom(pdf, pageNum, container, zoomLevel) {
    return pdf.getPage(pageNum).then(function (page) {
        // 获取容器宽度
        const containerWidth = container.clientWidth || document.getElementById('pdf-viewer').clientWidth;

        // 获取页面原始尺寸
        const originalViewport = page.getViewport({ scale: 1.0 });

        // 计算适合容器宽度的基础缩放比例
        const baseScaleFactor = (containerWidth - 20) / originalViewport.width;

        // 应用用户设置的缩放级别
        const scaleFactor = baseScaleFactor * zoomLevel;

        // 使用计算出的缩放比例创建新的视口
        const viewport = page.getViewport({ scale: scaleFactor });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        // 提高渲染质量
        const pixelRatio = window.devicePixelRatio || 1;
        canvas.height = viewport.height * pixelRatio;
        canvas.width = viewport.width * pixelRatio;
        canvas.style.height = viewport.height + 'px';
        canvas.style.width = viewport.width + 'px';

        const renderContext = {
            canvasContext: context,
            viewport: viewport,
            transform: [pixelRatio, 0, 0, pixelRatio, 0, 0]
        };

        const renderTask = page.render(renderContext);

        const textLayer = document.createElement('div');
        textLayer.className = 'text-layer';
        container.appendChild(canvas);
        container.appendChild(textLayer);

        return Promise.all([
            renderTask.promise,
            page.getTextContent().then(function (textContent) {
                return pdfjsLib.renderTextLayer({
                    textContent: textContent,
                    container: textLayer,
                    viewport: viewport,
                    textDivs: []
                }).promise.then(() => {
                    // 处理页面中的链接注释
                    return page.getAnnotations().then(function (annotations) {
                        annotations.forEach(function (annotation) {
                            if (annotation.subtype === 'Link' && annotation.url) {
                                // 创建链接元素
                                const linkRect = viewport.convertToViewportRectangle(annotation.rect);
                                const [x1, y1, x2, y2] = pdfjsLib.Util.normalizeRect(linkRect);

                                const linkElement = document.createElement('a');
                                linkElement.href = annotation.url;
                                linkElement.className = 'pdf-link-annotation';
                                linkElement.style.position = 'absolute';
                                linkElement.style.left = `${Math.min(x1, x2)}px`;
                                linkElement.style.top = `${Math.min(y1, y2)}px`;
                                linkElement.style.width = `${Math.abs(x2 - x1)}px`;
                                linkElement.style.height = `${Math.abs(y2 - y1)}px`;
                                linkElement.style.cursor = 'pointer';
                                linkElement.target = '_blank'; // 在新窗口打开
                                linkElement.title = annotation.url;

                                // 添加到容器
                                container.appendChild(linkElement);
                            }
                        });
                    });
                });
            })
        ]);
    });
}
function generateTableOfContents(pdf) {
    const pageList = document.getElementById('pageList');
    pageList.innerHTML = '';

    // 创建一个加载指示器
    const loadingIndicator = document.createElement('div');
    loadingIndicator.textContent = '加载目录中...';
    pageList.appendChild(loadingIndicator);

    let loadedPages = 0;
    const batchSize = 20; // 每批加载的页数

    function loadBatch(startPage) {
        for (let i = startPage; i < Math.min(startPage + batchSize, pdf.numPages + 1); i++) {
            pdf.getPage(i).then(function (page) {
                page.getTextContent().then(function (textContent) {
                    let pageTitle = `第 ${i} 页`;
                    for (let j = 0; j < textContent.items.length; j++) {
                        const text = textContent.items[j].str.trim();
                        if (text && text.length > 5) {
                            pageTitle = text.length > 30 ? text.substring(0, 30) + '...' : text;
                            break;
                        }
                    }

                    const link = document.createElement('a');
                    link.className = 'dropdown-item';
                    link.href = '#';
                    link.textContent = pageTitle;
                    link.onclick = function (e) {
                        e.preventDefault();
                        document.getElementById(`page-${i}`).scrollIntoView();
                    };
                    pageList.insertBefore(link, loadingIndicator);

                    loadedPages++;
                    if (loadedPages === pdf.numPages) {
                        pageList.removeChild(loadingIndicator);
                        document.getElementById('pageContents').style.display = 'block';
                    } else if (loadedPages % batchSize === 0) {
                        loadBatch(loadedPages + 1);
                    }
                });
            });
        }
    }

    loadBatch(1);
}

function updateVisibleText() {
    const viewer = document.getElementById('pdf-viewer');
    const viewerRect = viewer.getBoundingClientRect();
    let text = '';

    // 如果是扫描件且OCR未处理，则进行OCR处理
    if (isPdfScanned && !ocrProcessing) {
        ocrProcessing = true;

        // 获取可见页面的canvas元素
        const visibleCanvases = [];
        const visiblePages = [];

        $('.page-container').each(function () {
            const pageRect = this.getBoundingClientRect();
            if (pageRect.top < viewerRect.bottom && pageRect.bottom > viewerRect.top) {
                const canvas = $(this).find('canvas')[0];
                if (canvas) {
                    visibleCanvases.push(canvas);
                    visiblePages.push(this);
                }
            }
        });

        if (visibleCanvases.length > 0) {
            // 显示OCR处理中提示
            if (!$('#ocr-processing-indicator').length) {
                $('body').append('<div id="ocr-processing-indicator">OCR处理中...</div>');
            }

            // 使用Tesseract.js进行OCR识别，启用单词级别的边界框
            Promise.all(visibleCanvases.map((canvas, idx) => {
                return window.Tesseract.recognize(canvas, 'chi_sim+eng', {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            $('#ocr-processing-indicator').text(`OCR处理中... ${Math.round(m.progress * 100)}%`);
                        }
                    }
                }).then(result => {
                    return {
                        text: result.data.text,
                        words: result.data.words,
                        pageElement: visiblePages[idx],
                        canvas: canvas
                    };
                });
            })).then(results => {
                visibleText = results.map(r => r.text).join('\n\n');
                ocrProcessing = false;
                $('#ocr-processing-indicator').remove();

                // 更新OCR结果到页面，使用精确定位
                results.forEach(result => {
                    const pageContainer = $(result.pageElement);
                    let textLayer = pageContainer.find('.text-layer');

                    if (textLayer.length === 0) {
                        textLayer = $('<div class="text-layer"></div>');
                        pageContainer.append(textLayer);
                    }

                    // 清空现有OCR文本
                    textLayer.empty();

                    // 创建OCR文本容器
                    const ocrTextContainer = $('<div class="ocr-text"></div>');
                    textLayer.append(ocrTextContainer);

                    // 获取canvas尺寸
                    const canvasWidth = result.canvas.width;
                    const canvasHeight = result.canvas.height;
                    const displayWidth = $(result.canvas).width();
                    const displayHeight = $(result.canvas).height();

                    // 计算缩放比例
                    const scaleX = displayWidth / canvasWidth;
                    const scaleY = displayHeight / canvasHeight;

                    // 添加每个单词，精确定位
                    if (result.words && result.words.length > 0) {
                        result.words.forEach(word => {
                            if (word.text.trim()) {
                                const wordElement = $('<span class="ocr-text-word"></span>');
                                wordElement.text(word.text);

                                // 计算位置和尺寸
                                const left = word.bbox.x0 * scaleX;
                                const top = word.bbox.y0 * scaleY;
                                const width = (word.bbox.x1 - word.bbox.x0) * scaleX;
                                const height = (word.bbox.y1 - word.bbox.y0) * scaleY;

                                // 设置样式
                                wordElement.css({
                                    left: `${left}px`,
                                    top: `${top}px`,
                                    width: `${width}px`,
                                    height: `${height}px`,
                                    fontSize: `${height * 0.9}px`,
                                    lineHeight: `${height}px`
                                });

                                ocrTextContainer.append(wordElement);
                            }
                        });
                    }
                });

                // 生成建议问题
                generateSuggestedQuestions();
            }).catch(err => {
                console.error('OCR处理出错:', err);
                ocrProcessing = false;
                $('#ocr-processing-indicator').remove();
            });
        } else {
            ocrProcessing = false;
        }
    } else {
        // 非扫描件，使用原有逻辑
        $('.page-container').each(function () {
            const pageRect = this.getBoundingClientRect();
            if (pageRect.top < viewerRect.bottom && pageRect.bottom > viewerRect.top) {
                // 获取页面文本内容
                const pageText = $(this).find('.text-layer').text();

                // 获取页面中的链接注释
                const links = $(this).find('.pdf-link-annotation');
                let linksText = '';

                if (links.length > 0) {
                    linksText = '\n\n链接：\n';
                    links.each(function () {
                        const linkUrl = $(this).attr('href');
                        const linkTitle = $(this).attr('title') || linkUrl;
                        linksText += `- [${linkTitle}](${linkUrl})\n`;
                    });
                }

                text += pageText + linksText + '\n\n';
            }
        });

        visibleText = text.trim();
    }
}

// 添加OCR控制面板
function addOcrControls() {
    if ($('#ocr-controls').length === 0) {
        const controlsHtml = `
            <div id="ocr-controls" style="position: fixed; bottom: 60px; left: 20px; z-index: 1000; background: white; padding: 10px; border-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); display: none;">
                <div style="margin-bottom: 10px;">
                    <label for="ocr-lang">OCR语言:</label>
                    <select id="ocr-lang" class="form-control form-control-sm">
                        <option value="chi_sim+eng" selected>中文+英文</option>
                        <option value="chi_sim">仅中文</option>
                        <option value="eng">仅英文</option>
                        <option value="jpn">日文</option>
                        <option value="kor">韩文</option>
                    </select>
                </div>
                <button id="rerun-ocr" class="btn btn-sm btn-primary">重新运行OCR</button>
            </div>
        `;
        $('body').append(controlsHtml);
        
        // 修改OCR切换按钮行为
        $('#ocr-toggle').off('click').on('click', function() {
            $('.ocr-text').toggleClass('active');
            $('#ocr-controls').toggle();
        });
        
        // 重新运行OCR按钮
        $('#rerun-ocr').on('click', function() {
            const lang = $('#ocr-lang').val();
            ocrProcessing = false; // 重置OCR处理状态
            runOcrWithLanguage(lang);
        });
    }
}

// 使用指定语言运行OCR
function runOcrWithLanguage(lang) {
    // 清除现有OCR文本
    $('.text-layer').empty();
    
    // 重置处理状态
    ocrProcessing = false;
    
    // 更新可视文本，这将触发OCR处理
    updateVisibleText();
}


// Text selection and tools functionality
let selectionTimeout;

$(document).on('mouseup', '#pdf-viewer', function (e) {
    clearTimeout(selectionTimeout);
    selectionTimeout = setTimeout(function () {
        const selection = window.getSelection();
        selectedText = selection.toString().trim();

        // 清除之前的高亮
        $('.text-layer span.highlight, .ocr-text-word.highlight').removeClass('highlight');

        if (selectedText) {
            // 获取选中范围的位置
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            // 显示工具栏
            $('.selection-tools').css({
                left: rect.left + window.pageXOffset + 'px',
                top: rect.bottom + window.pageYOffset + 5 + 'px' // 稍微下移，避免遮挡文本
            }).show();

            // 高亮选中的OCR文本
            if (isPdfScanned) {
                // 找出选中范围内的所有OCR文本元素
                $('.ocr-text-word').each(function () {
                    if (selection.containsNode(this, true)) {
                        $(this).addClass('highlight');
                    }
                });
            } else {
                // 普通PDF的文本高亮处理
                if (range.commonAncestorContainer.nodeType === 3) {
                    // 文本节点
                    $(range.commonAncestorContainer.parentNode).addClass('highlight');
                } else {
                    // 元素节点
                    $(range.commonAncestorContainer).find('span').each(function () {
                        if (selection.containsNode(this, true)) {
                            $(this).addClass('highlight');
                        }
                    });
                }
            }
        } else {
            $('.selection-tools').hide();
        }
    }, 200);
});
$('#pdf-viewer').on('scroll', function () {
    if (selectedText) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            $('.selection-tools').css({
                left: rect.left + window.pageXOffset + 'px',
                top: rect.bottom + window.pageYOffset + 5 + 'px'
            });
        }
    }
});
$('#quote-btn').on('click', function () {
    if (selectedText) {
        $Q.val("# 引用内容： " + selectedText + "\n\n ---------------------------------------------------------------------- \n\n");
        autoResizeTextarea();
        $Q.focus();
    }
    hideAllTools();
});

$('#translate-btn').on('click', function (e) {
    e.stopPropagation();
    $('#translate-options').show();
});

$('#translate-confirm').on('click', function () {
    if (selectedText) {
        var sourceLang = $('#source-lang').val();
        var targetLang = $('#target-lang').val();
        var prompt = "请将以下文本从[" + (sourceLang === 'auto' ? '自动检测的语言' : sourceLang) + "]翻译成[" + targetLang + "],无需多余说明：\n\n" + selectedText;

        $Q.val(prompt);
        autoResizeTextarea();
        $Q.focus();
        sendMsg();
    }
    hideAllTools();
});

// 点击其他地方时隐藏所有工具
$(document).on('click', function (e) {
    if (!$(e.target).closest('.selection-tools, #translate-options').length) {
        hideAllTools();
    }
});

function hideAllTools() {
    $('.selection-tools').hide();
    $('#translate-options').hide();
}

// 防止点击翻译选项时隐藏
$('#translate-options').on('click', function (e) {
    e.stopPropagation();
});

// Clear chat functionality
$('#clear-chat').on('click', function () {
    newChat();
});
function newChat() {
    if (!processOver) {
        balert("对话进行中,请结束后再试", "warning", false, 2000);
        return;
    }
    chatid = "";
    chatgroupid = "";
    chatBody.html("");
    $(".chat-item").removeClass("highlight-chat-item");
    $("#Q").focus();
}
// 监听窗口大小变化
$(window).on('resize', adjustChatContainerHeight);

$Q.on('input', autoResizeTextarea);

// 处理键盘事件
$Q.on('keydown', function (e) {
    if (e.keyCode === 13) {  // Enter 键
        if (e.ctrlKey || e.shiftKey) {  // Ctrl+Enter 或 Shift+Enter
            // 插入换行符
            const start = this.selectionStart;
            const end = this.selectionEnd;
            const value = $Q.val();
            $Q.val(value.substring(0, start) + "\n" + value.substring(end));
            this.selectionStart = this.selectionEnd = start + 1;
            autoResizeTextarea();
            e.preventDefault();
        } else {  // 仅 Enter
            e.preventDefault();
            sendMsg();
        }
    }
});

$Q.on('paste', function (event) {
    for (var i = 0; i < event.originalEvent.clipboardData.items.length; i++) {
        var item = event.originalEvent.clipboardData.items[i];
        if (item.kind === 'file') {
            var blob = item.getAsFile();
            handleFileUpload(blob);
        }
    }
});



//通讯
// websocket连接设置
var connection = new signalR.HubConnectionBuilder()
    .withUrl('/chatHub', {
        accessTokenFactory: () => localStorage.getItem('aibotpro_userToken')
    })
    .withAutomaticReconnect()
    .build();

// 启动连接
connection.start()
    .then(function () {
        console.log('ChatPDF与服务器握手成功 :-)'); // 与服务器握手成功
    })
    .catch(function (error) {
        console.log('与服务器握手失败 :-( 原因: ' + error); // 与服务器握手失败
        sendExceptionMsg('与服务器握手失败 :-( 原因: ' + error);
        // 检查令牌是否过期，如果是，则跳转到登录页面
        if (isTokenExpiredError(error)) {
            window.location.href = "/Users/Login";
        }
    });

// 检查错误是否表示令牌过期的函数
// 注意：您需要根据实际的错误响应格式来调整此函数
function isTokenExpiredError(error) {
    // 这里的判断逻辑依赖于服务器返回的错误格式
    // 例如，如果服务器在令牌过期时返回特定的状态码或错误信息，您可以在这里检查
    var expiredTokenStatus = 401; // 假设401表示令牌过期
    return error.statusCode === expiredTokenStatus || error.message.includes("令牌过期");
}

// You can also handle the reconnection events if needed:
connection.onreconnecting((error) => {
    console.assert(connection.state === signalR.HubConnectionState.Reconnecting);
    console.log(`由于错误"${error}"失去连接。正在尝试重新连接。`);
    // Here you might want to inform the user that the connection is being reattempted.
});

connection.onreconnected((connectionId) => {
    console.assert(connection.state === signalR.HubConnectionState.Connected);
    console.log(`连接已重新建立。已连接到connectionId为"${connectionId}"。`);
    // Here you might want to inform the user that the connection has been successfully reestablished.
});

connection.onclose((error) => {
    console.assert(connection.state === signalR.HubConnectionState.Disconnected);
    console.log(`由于错误"${error}"连接已关闭。尝试重新启动连接。`);
    // 这里您可以尝试再次启动连接，或者通知用户连接已丢失。
    connection.start();
});
//接收消息
var md = window.markdownit();
var sysmsg = "";
var jishuqi = 0;

// 添加显示代码语言的 Labels
function addLanguageLabels() {
    $("pre code").each(function () {
        var codeBlock = $(this);
        if (codeBlock.parent('.code-container').length === 0) {
            codeBlock.wrap('<div class="code-container"></div>');
            var lang = codeBlock.attr('class').match(/language-(\w+)/);
            var language = lang ? lang[1] : "code";
            var langLabelContainer = $('<div class="code-lang-label-container"></div>');
            var langLabel = $('<span>' + language + '</span>');
            var toggleIcon = $('<span class="toggle-icon"><i class="fas fa-chevron-down"></i></span>');

            toggleIcon.on('click', function () {
                var container = $(this).parent().next('.code-container');
                container.toggleClass('open');
                $(this).find('i').toggleClass('fa-chevron-down fa-chevron-up');
            });

            langLabelContainer.append(langLabel, toggleIcon);
            codeBlock.before(langLabelContainer);
        }
    });
}

function addLanguageLabels(useSpecificId = false, assistansBoxId = '') {
    var selector = useSpecificId && assistansBoxId ? $("#" + assistansBoxId + " pre code") : $("pre code");

    selector.each(function () {
        var codeBlock = $(this);
        if (codeBlock.parent().find('.code-lang-label-container').length === 0) {
            var lang = codeBlock.attr('class').match(/language-(\w+)/);
            if (lang) {
                var langLabelContainer = $('<div class="code-lang-label-container"></div>');
                var langLabel = $('<span class="code-lang-label">' + lang[1] + '</span>');
                var toggleBtn = $('<span class="toggle-button"><i class="fas fa-chevron-up"></i> 收起</span>'); // 使用 FontAwesome 图标

                toggleBtn.on('click', function () {
                    if (codeBlock.is(':visible')) {
                        codeBlock.slideUp();
                        $(this).html('<i class="fas fa-chevron-down"></i> 展开'); // 切换到下箭头
                    } else {
                        codeBlock.slideDown();
                        $(this).html('<i class="fas fa-chevron-up"></i> 收起'); // 切换到上箭头
                    }
                });

                langLabelContainer.append(langLabel, toggleBtn);
                codeBlock.before(langLabelContainer);
            }
        }
    });
}
connection.on('ReceiveMessage', function (message) {
    message.isfinish
    if (!message.isfinish) {
        if (jishuqi == 0) {
            chatid = message.chatid;
            ClearImg();
        } else {
            if (message.message != null) {
                stopTimer(`#${assistansBoxId}_timer_first`);
                sysmsg += message.message;
                $("#" + assistansBoxId).html(md.render(sysmsg));
                MathJax.typeset();
                //hljs.highlightAll();
                $("#" + assistansBoxId + " pre code").each(function (i, block) {
                    hljs.highlightElement(block);
                });
                addLanguageLabels(true, assistansBoxId);
                addCopyBtn(assistansBoxId);
                if (Scrolling == 1) chatBody.scrollTop(chatBody[0].scrollHeight);
                applyMagnificPopup('.chat-message-box');
            }

        }
        jishuqi++;
    } else {
        stopTimer(`#${assistansBoxId}_timer_first`);
        stopTimer(`#${assistansBoxId}_timer_alltime`);
        processOver = true;
        $("#ctrl-" + assistansBoxId).show();
        feather.replace();
        $('[data-toggle="tooltip"]').tooltip();
        $(`.chat-message[data-group="${chatgroupid}"] .memory`).attr('onclick', function () {
            return `saveMemory('${chatgroupid}','${chatid}')`;
        });
        $("#send-button")
            .removeClass("btn-danger")
            .addClass("btn-primary")
            .html('<i class="fas fa-paper-plane"></i> 发送');
        $("#" + assistansBoxId).html(marked(completeMarkdown(sysmsg)));
        MathJax.typeset();
        $("#" + assistansBoxId + " pre code").each(function (i, block) {
            hljs.highlightElement(block);
        });
        addLanguageLabels(true, assistansBoxId);
        var item = {
            id: assistansBoxId, markdown: sysmsg
        };
        markdownHis.push(item);
        sysmsg = "";
        jishuqi = 0;
        $('.LDI').remove();
        addCopyBtn(assistansBoxId);
        getHistoryList(1, 20, true, false, "");
        addExportButtonToTables();
        if (Scrolling == 1) chatBody.scrollTop(chatBody[0].scrollHeight);
        applyMagnificPopup('.chat-message-box');
    }
});
//发送消息
function sendMsg(retryCount = 3) {
    if (!currentPdf) {
        balert("请先上传PDF文件", "warning", false, 2000, "center");
        return;
    }
    var msg = $("#Q").val().trim();
    if (msg == "") {
        balert("请输入问题", "warning", false, 2000);
        return;
    }
    if (!processOver) {
        balert("对话进行中,请结束后再试", "warning", false, 2000);
        return;
    }
    processOver = false;
    $("#send-button")
        .removeClass("btn-primary")
        .addClass("btn-danger")
        .html('<i class="fas fa-stop"></i> 停止生成');
    chatgroupid = generateGUID();
    var msgid_u = generateGUID();
    var msgid_g = generateGUID();
    var temperatureText = $('#temperatureValue').text();
    var temperature = parseFloat(temperatureText);
    if (isNaN(temperature)) {
        temperature = 1.00;
    }

    //var toppText = $('#topPValue').text();
    //var topp = parseFloat(toppText);
    //if (isNaN(topp)) {
    //    topp = 1.00;
    //}

    var presenceText = $('#frequencyPenaltyValue').text();
    var presence = parseFloat(presenceText);
    if (isNaN(presence)) {
        presence = 0;
    }

    var frequencyText = $('#presencePenaltyValue').text();
    var frequency = parseFloat(frequencyText);
    if (isNaN(frequency)) {
        frequency = 0;
    }
    var maxtokensText = $('#maxTokensValue').text();
    var maxtokens = parseInt(maxtokensText);
    if (isNaN(maxtokens)) {
        maxtokens = 4095;
    }
    var shortcutSystemPrompt = `# You can refer to the following text to answer: \n
                                ${visibleText}`;
    assistansBoxId = msgid_g;
    var data = {
        "msg": msg,
        "chatid": chatid,
        "aiModel": thisAiModel,
        "msgid_u": msgid_u,
        "msgid_g": msgid_g,
        "chatgroupid": chatgroupid,
        "ip": IP,
        "image_path": image_path,
        "file_list": file_list,
        "system_prompt": `${shortcutSystemPrompt}`,
        "useMemory": useMemory,
        "createAiPrompt": createAiPrompt,
        "temperature": temperature,
        "presence": presence,
        "frequency": frequency,
        "maxtokens": maxtokens,
        "seniorSetting": seniorSetting,
        "inputCacheKey": "",
        "stream": stream,
        "readingMode": readingMode
    };
    $("#Q").val("");
    $("#Q").focus();
    var isvip = false;
    isVIP(function (status) {
        isvip = status;
    });
    var vipHead = isvip ? `<div class="avatar" style="border:2px solid #FFD43B">
             <img src='${HeadImgPath}'/>
             <i class="fas fa-crown vipicon"></i>
         </div>
         <div class="nicknamevip">${UserNickText}</div>` : `<div class="avatar">
             <img src='${HeadImgPath}'/>
         </div>
         <div class="nickname">${UserNickText}</div>`;
    var html = `<div class="chat-message" data-group="${chatgroupid}">
                     <div style="display: flex; align-items: center;">
                        ${vipHead}
                     </div>
                     <div class="chat-message-box">
                       <pre id="${msgid_u}"></pre>
                     </div>
                     <div>
                      <i data-feather="refresh-cw" class="chatbtns" onclick="tryAgain('${msgid_u}')"></i>
                      <i data-feather="edit-3" class="chatbtns" onclick="editChat('${msgid_u}')"></i>
                     </div>
                </div>`;
    $(".model-icons-container").remove();
    chatBody.append(html);
    if (msg.length > 1000) {
        setInputToCache(data, function (responseData) {
            data.inputCacheKey = responseData;
            data.msg = "";
        });
    }
    $("#" + msgid_u).text(msg);
    if (image_path.length > 0) {
        image_path.forEach(function (path) {
            if (path != "") {
                $("#" + msgid_u).append(`<br /><img src="${path.replace("wwwroot", "")}" style="max-width:50%" />`);
            }
        });
    }
    applyMagnificPopup("#" + msgid_u);
    initImageFolding("#" + msgid_u);
    var gpthtml = `<div class="chat-message" data-group="${chatgroupid}">
                    <div style="display: flex; align-items: center;">
                       <div class="avatar gpt-avatar">${roleAvatar}</div>
                        <div class="nickname" style="font-weight: bold; color: black;">${roleName}</div>
                       <span class="badge badge-info ${thisAiModel.replace('.', '')}">${thisAiModel}</span>
                       <span class="badge badge-pill badge-success" id="${msgid_g}_timer_first"></span>
                       <span class="badge badge-pill badge-dark" id="${msgid_g}_timer_alltime"></span>
                    </div>
                    <div class="chat-message-box">
                        <div id="${msgid_g}"></div><div class="spinner-grow spinner-grow-sm LDI"></div>
                    </div>
                    <div id="ctrl-${msgid_g}" style="display: none;">
                        <i data-feather="copy" data-toggle="tooltip" title="复制" class="chatbtns" onclick="copyAll('${msgid_g}')"></i>
                        <i data-feather="trash-2" class="chatbtns custom-delete-btn-1" data-toggle="tooltip" title="删除" data-chatgroupid="${chatgroupid}"></i>
                        <i data-feather="codepen" class="chatbtns" data-toggle="tooltip" title="复制Markdown" onclick="toMarkdown('${msgid_g}')"></i>
                    </div>
                </div>`;
    chatBody.append(gpthtml);
    startTimer(`#${msgid_g}_timer_first`, true);
    startTimer(`#${msgid_g}_timer_alltime`);
    //adjustTextareaHeight();
    autoResizeTextarea();
    chatBody.animate({
        scrollTop: chatBody.prop("scrollHeight")
    }, 500);

    // 尝试发送消息
    function trySendMessage() {
        connection.invoke("SendMessage", data)
            .then(function () {
                // 消息发送成功
            })
            .catch(function (err) {
                console.error("Send message failed:", err);
                retryCount--;
                if (retryCount > 0) {
                    setTimeout(trySendMessage, 1000); // 1秒后重试
                } else {
                    processOver = true;
                    balert("发送消息失败,请刷新页面后重试", "danger", false, 2000, "center");
                    $('#' + assistansBoxId).html("发送消息失败,请刷新页面后重试 <a href='javascript:location.reload();'>点击刷新</a>");
                    stopTimer(`#${assistansBoxId}_timer_first`);
                    stopTimer(`#${assistansBoxId}_timer_alltime`);
                    $('.LDI').remove();
                    sendExceptionMsg("发送消息失败，请检查网络连接并重试。");
                }
            });
    }

    trySendMessage();
}
//停止生成
$("#send-button").on("click", function () {
    if (!processOver) {
        stopGenerate();
    } else sendMsg();
});
function stopGenerate() {
    if (!stream) {
        balert("非流式请求，无法中断对话", "danger", false, 2000, "center");
        return;
    }
    processOver = true;
    stopTimer(`#${assistansBoxId}_timer_first`);
    stopTimer(`#${assistansBoxId}_timer_alltime`);
    $("#sendBtn").html(`<i data-feather="send"></i>`);
    $("#ctrl-" + assistansBoxId).show();
    feather.replace();
    $("#sendBtn").removeClass("text-danger");
    $('.LDI').remove();
    if (sysmsg != '') $("#" + assistansBoxId).html(marked(completeMarkdown(sysmsg)));
    MathJax.typeset();
    $("#" + assistansBoxId + " pre code").each(function (i, block) {
        hljs.highlightElement(block);
    });
    addLanguageLabels(true, assistansBoxId);
    addCopyBtn(assistansBoxId);
    $.ajax({
        type: "Post", url: "/Home/StopGenerate", dataType: "json", data: {
            chatId: chatgroupid
        }, success: function (res) {
            console.log(`chat停止生成，Id：${chatgroupid} --${getCurrentDateTime()}`);
        }, error: function (err) {
            //window.location.href = "/Users/Login";
            balert("出现了一些未经处理的异常，请联系管理员", "danger", false, 2000, "center", function () {
                sendExceptionMsg(err.toString());
            });
        }
    });
}

// 自动调整 textarea 高度
function autoResizeTextarea() {
    $Q.css('height', 'auto');
    $Q.css('height', $Q[0].scrollHeight + 'px');
}
//重试
function tryAgain(id) {
    var $elem = $("#" + id);
    // 检查是否存在<img>标签
    if ($elem.find("img").length > 0) {
        // 如果存在，遍历所有找到的<img>标签
        $elem.find("img").each(function () {
            // 为每个<img>标签提取src属性
            var imgSrc = $(this).attr("src");
            if (isURL(imgSrc))
                image_path.push(imgSrc);
            else
                image_path.push("wwwroot" + imgSrc);
            $Q.val($elem.text());
        });
        reviewImg(image_path);
    } else {
        $Q.val($elem.text());
    }
    sendMsg();
}

//编辑
function editChat(id) {
    var $elem = $("#" + id);
    // 检查是否存在<img>标签
    if ($elem.find("img").length > 0) {
        // 如果存在，遍历所有找到的<img>标签
        $elem.find("img").each(function () {
            // 为每个<img>标签提取src属性
            var imgSrc = $(this).attr("src");
            if (isURL(imgSrc))
                image_path.push(imgSrc);
            else
                image_path.push("wwwroot" + imgSrc);
            $Q.val($elem.text());
        });
        reviewImg(image_path);
    } else {
        $Q.val($elem.text());
    }
    autoResizeTextarea();
}

//引用
function quote(id) {
    var $elem = $("#" + id);
    // 检查是否存在<img>标签
    if ($elem.find("img").length > 0) {
        // 如果存在，遍历所有找到的<img>标签
        $elem.find("img").each(function () {
            // 为每个<img>标签提取src属性
            var imgSrc = $(this).attr("src");
            if (isURL(imgSrc))
                image_path.push(imgSrc);
            else
                image_path.push("wwwroot" + imgSrc);
            $Q.val("回复：" + $elem.text());
        });
        reviewImg(image_path);
    } else {
        $Q.val("回复： " + $elem.text() + "\n\n");
    }
    $Q.focus();
    autoResizeTextarea();
}
function toMarkdown(id) {
    var item = markdownHis.find(function (element) {
        return element.id === id;
    });
    var markd = item ? item.markdown : null;
    copyText(markd);
    // 确保获取目标元素的唯一性
    var $targetElement = $('#' + id);

    if ($targetElement.length > 0) {
        // 检查是否已经存在 .markdown-content
        var $existingMarkdownDiv = $targetElement.find('.markdown-content');

        if ($existingMarkdownDiv.length > 0) {
            // 如果存在，直接执行关闭操作
            $existingMarkdownDiv.slideUp(function () {
                $existingMarkdownDiv.remove();
            });
            return; // 提前返回
        }
        if (markd) {
            // 确保获取目标元素的唯一性
            var $targetElement = $('#' + id);
            if ($targetElement.length > 0 && markd) {
                // 创建一个新的div来显示markdown内容
                var $markdownDiv = $('<div class="markdown-content"></div>').hide();

                // 插入markdown内容和关闭按钮到div
                $closeButton = $('<p class="close-button">&times</p>');
                var $contentDiv = $('<span class="badge badge-info">下方可编辑Markdown</span><textarea class="markdown-txt"></textarea>').val(markd);
                $markdownDiv.append($closeButton);
                $markdownDiv.append($contentDiv);

                // 将该div插入目标元素中
                $targetElement.append($markdownDiv);

                // 展开动画效果
                $markdownDiv.slideDown(300);
                if (chatBody.length > 0) {
                    var markdownDivOffsetTop = $markdownDiv.offset().top;
                    var markdownDivHeight = $markdownDiv.outerHeight(true);
                    var chatBodyHeight = chatBody.height();

                    // 计算滚动位置，使$markdownDiv的中部在父容器的中部显示
                    var scrollTop = markdownDivOffsetTop - chatBodyHeight / 2 + markdownDivHeight / 2 - chatBody.offset().top;

                    // 滚动 chatBody
                    chatBody.animate({
                        scrollTop: chatBody.scrollTop() + scrollTop
                    }, 'slow');   // 使用平滑滚动
                }
                // 关闭按钮功能，点击后收起div
                $closeButton.on('click', function () {
                    $markdownDiv.slideUp(function () {
                        $markdownDiv.remove(); // 在动画结束后移除div
                    });
                });
            }
        }
    }
}
function deleteChatGroup(id, type) {
    //showConfirmationModal("提示", "确定删除这条记录吗？", function () {
    $.ajax({
        type: "Post", url: "/Home/DelChatGroup", dataType: "json", data: {
            groupId: id,
            type: type
        }, success: function (res) {
            if (res.success) {
                balert("删除成功", "success", false, 1000, "top");
                if (type === 1) {
                    $('[data-group="' + id + '"]').remove();
                    if (chatBody.find('[data-group]').length <= 0) {
                        chatid = "";
                    }
                }
            }
        }, error: function (err) {
            //window.location.href = "/Users/Login";
            balert("删除失败，错误请联系管理员：err", "danger", false, 2000, "center");
        }
    });
    //});
}
//遍历添加复制按钮
function addCopyBtn(id = '') {
    var codebox;
    if (id != '') {
        codebox = $('#' + id + ' pre code.hljs, #' + id + ' pre code[class^="language-"]');
    } else {
        codebox = $('pre code.hljs, pre code[class^="language-"]');
    }

    codebox.each(function () {
        var codeBlock = $(this);

        var copyContainer = $('<div>').addClass('copy-container').css({
            'text-align': 'right',
            'background-color': 'rgb(40,44,52)',
            'padding': '4px',
            'display': 'block',
            'color': 'rgb(135,136,154)',
            'cursor': 'pointer'
        });

        var copyBtn = $('<span>').addClass('copy-btn').attr('title', 'Copy to clipboard');
        copyBtn.html(feather.icons.clipboard.toSvg());

        if ($(this).parent().find('.copy-btn').length === 0) {
            copyContainer.append(copyBtn);
            codeBlock.parent().append(copyContainer);
        }

        copyBtn.click(function () {
            var codeToCopy = codeBlock.text();
            var tempTextArea = $('<textarea>').appendTo('body').val(codeToCopy).select();
            document.execCommand('copy');
            tempTextArea.remove();
            balert("复制成功", "success", false, 1000, "top");
        });
    });
}

function copyAll(id) {
    //复制全部text
    var codeToCopy = $("#" + id).text();
    var tempTextArea = $('<textarea>').appendTo('body').val(codeToCopy).select(); // 创建临时的 textarea 并选中文本
    document.execCommand('copy'); // 执行复制操作
    tempTextArea.remove(); // 移除临时创建的 textarea
    balert("复制成功", "success", false, 1000, "top");
}

//调起摄像头&相册
function showCameraMenu() {
    $("#cameraModel").modal('show');
    if (image_path.length > 0) {
        reviewImg(image_path);
    }
}

//图片上传
$('body').on('click', '.popup-item', function () {
    var type = $(this).data('type');
    var $fileInput = $('#uploadImg');
    if (type == "camera") {
        $fileInput.attr('capture', 'environment');
        $fileInput.click();
    } else if (type == "upload") {
        $fileInput.removeAttr("capture");
        $fileInput.click();
    }
});

$("#uploadImg").on('change', function (e) {
    var destroyAlert = balert(`<i data-feather="loader" style="width:20px;"></i> 正在上传...`, "info", false, 0, "center");
    uploadIMGFile(e.target.files[0], destroyAlert);
});

function uploadIMGFile(file, destroyAlert) {
    if (image_path.length >= 4) {
        destroyAlert();
        balert("最多只能上传4张图片", "warning", false, 2000, "center");
        return;
    }

    if (!file.type.startsWith('image/')) {
        destroyAlert();
        balert("请选择图片文件", "warning", false, 2000, "center");
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        destroyAlert();
        balert("图片文件大小不能超过5M", "warning", false, 2000, "center");
        return;
    }

    var formData = new FormData();
    formData.append("file", file);
    formData.append("thisAiModel", thisAiModel);
    feather.replace();

    $.ajax({
        url: "/Home/SaveImg",
        type: "post",
        data: formData,
        contentType: false,
        processData: false,
        success: function (res) {
            destroyAlert();
            if (res.success) {
                // 检查是否已存在相同路径的图片
                if (!image_path.includes(res.data)) {
                    image_path.push(res.data);
                    balert("上传成功", "success", false, 800, "center");
                }
                reviewImg(image_path);
            } else {
                ClearImg();
            }
        },
        error: function (e) {
            sendok = true;
            console.log("失败" + e);
        }
    });
}

//预览图片
function reviewImg(paths) {
    $('.preview-img').attr('src', '');
    $('.img-container').hide();
    let uniquePaths = [...new Set(paths)]; // 去重
    image_path = uniquePaths;
    for (let i = 0; i < uniquePaths.length && i < 4; i++) {
        $('.preview-img').eq(i).attr('src', uniquePaths[i].replace("wwwroot", ""));
        $('.img-container').eq(i).show();
    }
    applyMagnificPopup('.img-container');
    $('.imgViewBox').show();
    updateRedDot(uniquePaths.length)
}


//更新红点数字或隐藏
function updateRedDot(num) {
    var imageCount = $("#imageCount");
    if (num > 0) {
        imageCount.text(num);
        imageCount.show();
    } else {
        imageCount.hide();
    }
}

// 清除图片
function ClearImg() {
    image_path = [];
    var $img = $('.preview-img');
    $img.attr('src', '').removeClass('magnified');
    if ($img.parent().is('a')) {
        $img.unwrap();
    }
    $('.img-container').hide();
    $('.imgViewBox').hide();
    updateRedDot(0);
}

// 删除单个图片
function deleteImage(index) {
    let uniquePaths = [...new Set(image_path)]; // 去重
    let deletedPath = uniquePaths[index];
    image_path = image_path.filter(path => path !== deletedPath);
    reviewImg(image_path);
    if (image_path.length === 0) {
        $('.imgViewBox').hide();
    }
}

// 添加事件监听器
$(document).ready(function () {
    $('.delete-btn').on('click', function () {
        var index = $(this).parent().index();
        deleteImage(index);
    });
    $('#loadMoreBtn').on('click', function () {
        loadingBtn("#loadMoreBtn");
        getFiles('loadmore');
    });
});

function dataURLtoFile(dataurl, filename) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]), n = bstr.length,
        u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

// 阻止浏览器默认行为
$(document).on({
    dragenter: function (e) {
        e.stopPropagation();
        e.preventDefault();
    }, dragover: function (e) {
        e.stopPropagation();
        e.preventDefault();
    }, drop: function (e) {
        e.stopPropagation();
        e.preventDefault();
        var files = e.originalEvent.dataTransfer.files;
        handleDroppedFiles(files);
    }
});

function handleDroppedFiles(files) {
    for (var i = 0; i < files.length; i++) {
        handleFileUpload(files[i]);
    }
}

function handleFileUpload(file) {
    var reader = new FileReader();

    if (/image/.test(file.type)) {
        reader.onload = function (event) {
            var base64 = event.target.result;
            var imageFile = dataURLtoFile(base64, "clipboard_image-" + new Date().toISOString() + ".png");
            var destroyAlert = balert(`<i data-feather="loader" style="width:20px;"></i> 正在上传...`, "info", false, 0, "center");
            uploadIMGFile(imageFile, destroyAlert);
        };
        reader.readAsDataURL(file);
    }
}