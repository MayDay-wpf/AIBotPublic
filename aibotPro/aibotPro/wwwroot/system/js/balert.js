// 提醒框
function balert(message, type, dismissible, autoCloseTime, position, callback) {
    var positionStyle = {};

    // Determine alert position style based on input
    switch (position) {
        case 'top':
            positionStyle = {
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)'
            };
            break;
        case 'right':
            positionStyle = {
                top: '20px',
                right: '20px'
            };
            break;
        case 'left':
            positionStyle = {
                top: '20px',
                left: '20px'
            };
            break;
        case 'center':
            positionStyle = {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)'
            };
            break;
        default:
            positionStyle = {
                top: '20px',
                left: '50%',
                transform: 'translate(-50%)'
            };
    }

    // Ensure alertContainer exists in the body
    if ($("#alertContainer").length === 0) {
        $('body').prepend('<div id="alertContainer"></div>');
    }

    // Set alertContainer styles based on position
    var alertContainerDefaultStyle = {
        position: 'fixed',
        zIndex: 9999,
        width: 'auto' // or 'auto' if you want it to fit content
    };
    $('#alertContainer').css($.extend({}, alertContainerDefaultStyle, positionStyle));

    // Create alert element
    var $alert = $('<div>')
        .addClass('alert alert-' + type + (dismissible ? ' alert-dismissible' : '') + ' fade show slide-in d-flex align-items-center')
        .attr('role', 'alert');
    if (type == "info")
        $alert.html('<i data-feather="alert-circle" class="mr-2"></i> ' + message);
    if (type == "warning")
        $alert.html('<i data-feather="alert-triangle" class="mr-2"></i> ' + message);
    if (type == "success")
        $alert.html('<i data-feather="check-circle" class="mr-2"></i> ' + message);
    if (type == "danger")
        $alert.html('<i data-feather="x-circle" class="mr-2"></i> ' + message);

    // If dismissible, add dismiss button
    if (dismissible) {
        var $dismissBtn = $('<button>', {
            type: 'button',
            html: '&times;',
            class: 'close',
            'data-dismiss': 'alert',
            'aria-label': 'Close'
        });

        $alert.append($dismissBtn);
    }

    // Append alert to container
    $("#alertContainer").prepend($alert);

    // Initialize feather icons
    feather.replace();

    // If autoCloseTime is set, then set a timeout to close the alert
    if (typeof autoCloseTime === 'number' && autoCloseTime > 0) {
        setTimeout(function () {
            $alert.fadeOut(function () {
                $(this).alert('close'); // 关闭提醒框
            });
        }, autoCloseTime);
    } else if (autoCloseTime == 0) {
        //需要手动关闭
    } else {
        setTimeout(function () {
            $alert.fadeOut(function () {
                $(this).alert('close'); // 关闭提醒框
            });
        }, 2000);
    }

    // Attach callback when alert is closed
    if (typeof callback === 'function') {
        $alert.on('closed.bs.alert', callback);
    }

    // Function to manually destroy the alert
    function destroyAlert() {
        $alert.fadeOut(function () {
            $(this).alert('close'); // 关闭提醒框
        });
    }

    // Return the function to allow manual closure of the alert
    return destroyAlert;
}


// 创建二次确认框的函数
function createConfirmationModal(title, content) {
    // 如果已经存在，则删除
    $('#confirmationModal').remove();

    // 创建模态框结构
    var modalHtml = `
      <div class="modal fade" id="confirmationModal" tabindex="-1" role="dialog" aria-labelledby="confirmationModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="confirmationModalLabel">`+ title + `</h5>
              <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div class="modal-body">
                `+ content + `
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-dismiss="modal" id="cancelBtn">取消</button>
              <button type="button" class="btn btn-primary" id="confirmBtn">确认</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // 将模态框添加到body中
    $('body').append(modalHtml);
}

// 显示确认框并设置确认和取消按钮的回调函数
function showConfirmationModal(title, content, confirmCallback, cancelCallback) {
    createConfirmationModal(title, content); // 确保创建了模态框

    // 在点击确认按钮时执行的操作
    $('#confirmationModal').find('#confirmBtn').off('click').on('click', function () {
        if (typeof confirmCallback === 'function') {
            confirmCallback();
        }
        $('#confirmationModal').modal('hide');
    });

    // 在点击取消按钮或关闭模态框时执行的操作
    $('#confirmationModal').find('#cancelBtn').off('click').on('click', function () {
        if (typeof cancelCallback === 'function') {
            cancelCallback();
        }
        $('#confirmationModal').modal('hide');
    });
    $('#confirmationModal').on('hide.bs.modal', function () {
        if (typeof cancelCallback === 'function') {
            cancelCallback();
        }
    });

    // 显示模态框
    $('#confirmationModal').modal('show');
}

//创建（带输入的）提示框的函数
function createPromptModal(title, content) {
    // 如果已经存在，则删除
    $('#confirmationModal').remove();

    // 创建模态框结构
    var modalHtml = `
      <div class="modal fade" id="confirmationModal" tabindex="-1" role="dialog" aria-labelledby="confirmationModalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
          <div class="modal-content">
          <div class="modal-header">
              <h5 class="modal-title" id="confirmationModalLabel">`+ title + `</h5>
              <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div class="modal-body">
                `+ content + `
                <br/>
                <input type="text" class="form-control" id="promptInput" placeholder="请输入内容">
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-dismiss="modal" id="cancelBtn">取消</button>
              <button type="button" class="btn btn-primary" id="confirmBtn">确认</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // 将模态框添加到body中
    $('body').append(modalHtml);
}

//显示（带输入的）提示框并设置确认和取消按钮的回调函数
function showPromptModal(title, content, confirmCallback, cancelCallback) {
    createPromptModal(title, content); // 确保创建了模态框

    // 在点击确认按钮时执行的操作并获取输入的内容
    $('#confirmationModal').find('#confirmBtn').off('click').on('click', function () {
        if (typeof confirmCallback === 'function') {
            confirmCallback($('#promptInput').val());
        }
        $('#confirmationModal').modal('hide');
    });
    // 在点击取消按钮或关闭模态框时执行的操作
    $('#confirmationModal').find('#cancelBtn').off('click').on('click', function () {
        if (typeof cancelCallback === 'function') {
            cancelCallback();
        }
        $('#confirmationModal').modal('hide');
    });
    $('#confirmationModal').on('hide.bs.modal', function () {
        if (typeof cancelCallback === 'function') {
            cancelCallback();
        }
    });

    // 显示模态框
    $('#confirmationModal').modal('show');
}
function openModal(title, html) {
    if ($("#customModal").length > 0) {
        $("#customModal").remove(); //确保只有一个弹窗实例
    }

    var modalHtml =
        '<div class="modal" tabindex="-1" role="dialog" id="customModal">' +
        '<div class="modal-dialog" role="document">' +
        '<div class="modal-content">' +
        '<div class="modal-header">' +
        '<h5 class="modal-title">' + title + '</h5>' +
        '</div>' +
        '<div class="modal-body">' + html + '</div>' +
        '</div>' +
        '</div>' +
        '</div>';

    $("body").append(modalHtml);
    $('#customModal').modal({
        backdrop: 'static', //设置背景不可点
        keyboard: false     //禁用esc关闭
    });
}

function closeModal() {
    $("#customModal").modal('hide');
}

// Usage example
//$(document).ready(function () {
//    balert('This is an info alert', 'info', true);
//    balert('This is a danger alert', 'danger', true);
//});