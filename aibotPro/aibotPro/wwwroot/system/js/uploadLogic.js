$(document).ready(function () {
    $('#uploadBtn').click(async function () {
        var file = $('#fileInput')[0].files[0];
        if (!file) {
            balert('请选择文件', 'danger', false, 1000, "center");
            return;
        }
        if (!file.type.match('image.*')) {
            balert('请选择一个图像文件', 'danger', false, 1000, "center");
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            balert('文件大小不能超过10兆', 'danger', false, 1000, "center");
            return;
        }
        var chunkSize = 100 * 1024; // 100KB
        var chunks = Math.ceil(file.size / chunkSize);
        var chunk = 0;

        async function uploadChunk(start) {
            var end = Math.min(start + chunkSize, file.size);
            var chunkBlob = file.slice(start, end);
            var formData = new FormData();
            formData.append('file', chunkBlob);
            formData.append('chunkNumber', ++chunk);
            formData.append('fileName', file.name);

            await $.ajax({
                url: '/AIdraw/Upload',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: function (data) {
                    var progress = (chunk / chunks) * 100;
                    $('#p1').css('width', progress + '%').attr('aria-valuenow', progress).text(Math.round(progress) + '%');
                }
            });

            if (chunk < chunks) {
                await uploadChunk(end);
            } else {
                // 在所有切片上传完成后触发
                $.ajax({
                    url: '/AIdraw/MergeFiles',
                    type: 'POST',
                    data: JSON.stringify({ fileName: file.name, totalChunks: chunks }),
                    contentType: 'application/json',
                    success: function (response) {
                        console.log('合并成功，文件路径:', response.path);
                        referenceImgPath = response.path;
                        $('#p1').text('上传完成');
                        //清除文件框
                        $('#fileInput').val('');
                        $('.custom-file-label').removeClass('selected').html('选择文件');
                    }
                });
            }
        }

        await uploadChunk(0);
    });
});
