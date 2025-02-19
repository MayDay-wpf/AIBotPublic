$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#aibook-nav").addClass('active');
    $("#isPublic").prop("checked", false);
})
var bookimg = "/system/images/newbook.png"
var bookimgthumbnails = "/system/images/newbookthumbnails.png"

// 二级分类数据
const categories = {
    "男生": [
        "东方玄幻",
        "异世大陆",
        "西方奇幻",
        "史诗奇幻",
        "黑暗奇幻",
        "蒸汽朋克",
        "废土朋克",
        "传统武侠",
        "新派武侠",
        "国术",
        "古典仙侠",
        "仙侠幻想",
        "都市生活",
        "都市娱乐",
        "都市异能",
        "现实百态",
        "人间烟火",
        "军旅生涯",
        "抗战烽火",
        "谍战风云",
        "架空历史",
        "两宋元明",
        "秦汉三国",
        "虚拟网游",
        "电子竞技",
        "体育竞技",
        "篮球运动",
        "足球运动",
        "硬科幻",
        "星际文明",
        "进化变异",
        "末世危机",
        "灵异神怪",
        "推理探案",
        "悬疑惊悚",
        "日系轻小说",
        "搞笑轻小说",
        "衍生同人",
        "原作同人"
    ],
    "女生": [
        "古代言情",
        "宫闱宅斗",
        "经商种田",
        "女尊王朝",
        "现代言情",
        "豪门总裁",
        "娱乐明星",
        "婚恋职场",
        "青春校园",
        "纯爱",
        "现代纯爱",
        "古代纯爱",
        "玄幻奇幻",
        "东方玄幻",
        "西方奇幻",
        "科幻",
        "星际科幻",
        "末世科幻",
        "悬疑",
        "推理悬疑",
        "灵异悬疑",
        "仙侠",
        "修真仙侠",
        "幻想仙侠",
        "游戏竞技",
        "电子竞技",
        "虚拟网游",
        "现实",
        "人间百态",
        "家庭生活",
        "轻小说",
        "日系轻小说",
        "少女漫风",
        "同人",
        "动漫同人",
        "影视同人"
    ]
};


// 初始化二级分类
updateCategory2();

// 一级分类改变事件
$("#category1").change(function () {
    updateCategory2();
});

// 更新二级分类选项
function updateCategory2() {
    const category1 = $("#category1").val();
    const category2Options = categories[category1];
    $("#category2").empty();
    category2Options.forEach(option => {
        $("#category2").append(`<option value="${option}">${option}</option>`);
    });
}
// 图片预览
$("#bookCover").change(function (e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            $("#coverPreview").attr("src", e.target.result);
        }
        reader.readAsDataURL(file);
        var formData = new FormData();
        formData.append('file', file);
        $.ajax({
            url: '/AiBook/UploadBookImg',
            type: 'post',
            data: formData,
            contentType: false,
            processData: false,
            success: function (res) {
                if (res.success) {
                    bookimg = res.filePath.replace('wwwroot', '');
                    bookimgthumbnails = res.thumbnailFilePath.replace('wwwroot', '');
                }
                else {
                    balert(res.msg, 'danger', false, 1500, 'center');
                }
            }
        });
    }
});

// 标签处理
let tags = [];
$("#bookTag").keypress(function (e) {
    if (e.which === 13) { // Enter key
        e.preventDefault();
        let tag = $("#bookTag").val().trim();
        if (tag && tags.length < 3 && !tags.includes(tag)) {
            tags.push(tag);
            renderTags();
            $("#bookTag").val("");
        }
    }
});

// 渲染标签
function renderTags() {
    $("#selectedTags").empty();
    tags.forEach((tag, index) => {
        $("#selectedTags").append(`
                <span class="badge badge-success">${tag} <span class="remove-tag" data-index="${index}">&times;</span></span>
            `);
    });

    // 移除标签
    $(".remove-tag").click(function () {
        const index = $(this).data("index");
        tags.splice(index, 1);
        renderTags();
    });
}

// 表单提交 (这里添加你的表单提交逻辑)
$(".createBookBtn").on("click", function (e) {
    e.preventDefault();

    // 获取是否公开的值
    let isPublic = $("#isPublic").is(":checked");
    let bookName = $("#bookName").val().trim();
    if (!bookName) {
        balert('请输入书籍名称', 'warning', false, 1500, 'center');
        return;
    }
    let bookRemark = $("#bookRemark").val().trim();
    if (!bookRemark) {
        balert('请输入书籍简介', 'warning', false, 1500, 'center');
        return;
    }
    if (!tags.length) {
        balert('请输入书籍标签', 'warning', false, 1500, 'center');
        return;
    }
    let bookType = `${$("#category1").val()},${$("#category2").val()}`;
    // 添加你的表单提交逻辑，例如使用FormData发送数据
    var formData = new FormData();
    formData.append("bookTag", tags.join(","));
    //formData.append("isPublic", isPublic);
    formData.append("bookimg", bookimg);
    formData.append("bookimgthumbnails", bookimgthumbnails);
    formData.append("bookName", bookName);
    formData.append("bookType", bookType);
    formData.append("bookRemark", bookRemark);
    loadingBtn('.createBookBtn');
    $.ajax({
        url: "/AiBook/AddNewBook",
        type: "POST",
        data: formData,
        processData: false,
        contentType: false,
        success: function (res) {
            unloadingBtn('.createBookBtn');
            if (res.success) {
                window.location.href = '/AiBook/Index';
            }
            else {
                balert(res.msg, 'danger', false, 1500, 'center');
            }
        },
        error: function (error) {
            unloadingBtn('.createBookBtn');
            balert('提交失败' + error, 'danger', false, 3000, 'center');
        }
    });
});