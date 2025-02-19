let currentPage = 1;
let pageSize = 20;
let totalBooks = 0;
let currentKeyword = "";
$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#aibook-nav").addClass('active');
    loadBooks(currentPage, pageSize, currentKeyword);
})


$('#searchKey').on('keyup', function (e) {
    if (e.key === 'Enter') {
        currentKeyword = $(this).val();
        currentPage = 1;
        loadBooks(currentPage, pageSize, currentKeyword);
    }
});

function loadBooks(page, size, keyword) {
    loadingOverlay.show();
    $.ajax({
        url: '/AiBook/GetBookList',
        type: 'POST',
        data: {
            keyword: keyword,
            page: page,
            pageSize: size
        },
        success: function (response) {
            loadingOverlay.hide();
            if (response.success) {
                $('#bookList').empty();
                totalBooks = response.total;

                if (response.data.length === 0) {
                    $('#bookList').append(`<div class="col-12 text-center"><p><b>没有正在创作的书籍<br />点击创建新书按钮开始创作吧🤗</b></p>
                    <img src="/system/images/nothing.png"/>
                    </div > `);
                } else {
                    $.each(response.data, function (index, book) {
                        let isPublic = book.isPublic;
                        let publishButton = isPublic
                            ? `<button class="book-card-button btn-unpublish" data-id="${book.id}" title="下架"><i class="fas fa-arrow-down"></i> 下架</button>`
                            : `<button class="book-card-button btn-publish" data-id="${book.id}" title="上架"><i class="fas fa-arrow-up"></i> 上架</button>`;

                        // 处理书籍类型
                        let bookTypeBadges = '';
                        if (book.bookType) {
                            let types = book.bookType.split(',');
                            $.each(types, function (index, type) {
                                bookTypeBadges += `<span class="badge badge-info">${type.trim()}</span>`;
                            });
                        }
                        // 处理书籍标签
                        let bookTagBadges = '';
                        if (book.bookTag) {
                            let tags = book.bookTag.split(',');
                            $.each(tags, function (index, tag) {
                                bookTagBadges += `<span class="badge badge-secondary">${tag.trim()}</span>`;
                            });
                        }
                        //${publishButton}
                        let bookCard = `
                                    <div class="book-card">
                                        <img src="${book.bookThumbnail || '/system/images/newbook.png'}" class="book-card-img" alt="${book.bookName}">
                                        <div class="book-card-body">
                                            <div class="book-title">${book.bookName}</div>
                                            <div class="book-type">${bookTypeBadges}</div>
                                            <div class="book-tag">${bookTagBadges}</div>
                                            <div class="book-remark">${book.bookRemark || ''}</div>
                                            <div class="book-word-count">字数：${book.bookWordCount || 0}</div>
                                            <div class="book-card-buttons">
                                                <button class="book-card-button btn-danger" data-id="${book.id}" title="删除"><i class="fas fa-trash-alt"></i></button>
                                                <button class="book-card-button btn-continue" data-code="${book.bookCode}" title="继续创作"><i class="fas fa-pencil-alt"></i> 创作</button>
                                            </div>
                                        </div>
                                    </div>
                                `;
                        $('#bookList').append(bookCard);
                    });

                    // 删除按钮事件
                    $('.book-card-button.btn-danger').click(function () {
                        let bookId = $(this).data('id');
                        showConfirmationModal("提示", `确定要<b style="color:red;">删除</b>这本书吗？ `, function () {
                            deleteBook(bookId);
                        });
                    });

                    // 上架/下架按钮事件
                    $('.book-card-button.btn-publish, .book-card-button.btn-unpublish').click(function () {
                        let bookId = $(this).data('id');
                        let isPublic = $(this).hasClass('btn-publish');
                        showConfirmationModal("提示", `确定要<b style="color:red;">${isPublic ? '上架' : '下架'}</b>这本书吗？`, function () {
                            publishUnpublishBook(bookId, isPublic);
                        });
                    });
                    //继续创作
                    $('.book-card-button.btn-continue').click(function () {
                        let bookCode = $(this).data('code');
                        window.location.href = '/AiBook/Writer?code=' + bookCode;

                    });
                }

                loadPagination(page, size, totalBooks);
            } else {
                loadingOverlay.hide();
                balert('Failed to load books.', 'danger', false, 1500, 'center');
            }
        },
        error: function () {
            loadingOverlay.hide();
            balert('Error loading books.', 'danger', false, 1500, 'center');
        }
    });
}

// 删除书籍函数
function deleteBook(bookId) {
    $.ajax({
        url: '/AiBook/DeleteBook',
        type: 'POST',
        data: { id: bookId },
        success: function (response) {
            if (response.success) {
                loadBooks(currentPage, pageSize, currentKeyword);
            } else {
                balert('删除失败：' + response.msg, 'danger', false, 1500, 'center');
            }
        },
        error: function () {
            balert('删除出错！', 'danger', false, 1500, 'center');
        }
    });
}

// 上架/下架书籍函数
function publishUnpublishBook(bookId, isPublic) {
    $.ajax({
        url: '/AiBook/PublishUnPublishBook',
        type: 'POST',
        data: {
            id: bookId,
            isPublic: isPublic
        },
        success: function (response) {
            if (response.success) {
                loadBooks(currentPage, pageSize, currentKeyword);
            } else {
                balert('操作失败：' + response.msg, 'danger', false, 1500, 'center');
            }
        },
        error: function () {
            balert('操作出错！', 'danger', false, 1500, 'center');
        }
    });
}
function loadPagination(page, size, total) {
    let totalPages = Math.ceil(total / size);
    $('#pagination').empty();

    let prevDisabled = page === 1 ? 'disabled' : '';
    $('#pagination').append(`<li class="page-item ${prevDisabled}"><a class="page-link" href="#" data-page="${page - 1}">上一页</a></li>`);

    for (let i = 1; i <= totalPages; i++) {
        let active = i === page ? 'active' : '';
        $('#pagination').append(`<li class="page-item ${active}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`);
    }

    let nextDisabled = page === totalPages ? 'disabled' : '';
    $('#pagination').append(`<li class="page-item ${nextDisabled}"><a class="page-link" href="#" data-page="${page + 1}">下一页</a></li>`);

    $('.page-link').click(function (e) {
        e.preventDefault();
        let targetPage = $(this).data('page');
        if (targetPage >= 1 && targetPage <= totalPages) {
            currentPage = targetPage;
            loadBooks(currentPage, pageSize, currentKeyword);
        }
    });
}