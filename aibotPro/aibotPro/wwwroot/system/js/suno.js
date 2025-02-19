$(function () {
    $('.nav-sub-link').removeClass('active');
    $('.nav-link').removeClass('active');
    $("#ai-main-menu").addClass('active');
    $("#ai-main-menu").parent().toggleClass('show');
    $("#ai-main-menu").parent().siblings().removeClass('show');
    $("#suno-nav").addClass('active');
    $("#mode").val("inspiration");
});
let audio, playPauseBtn, progress, currentTime, duration, record, tonearm, lyrics, albumCover;
let isPlaying = false;
let currentSongIndex = -1;
let songList = [];
let isRandomPlay = false;
$(document).ready(function () {
    audio = new Audio();
    audio.src = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
    playPauseBtn = $('#playPause');
    progress = $('#progress');
    currentTime = $('#currentTime');
    duration = $('#duration');
    record = $('#record');
    tonearm = $('#tonearm');
    lyrics = $('#lyrics');
    albumCover = $('.album-cover');
    // 为播放模式下拉菜单项添加点击事件
    $('.dropdown-item').click(function (e) {
        e.preventDefault();
        isRandomPlay = ($(this).data('mode') === 'random');

        // 更新按钮文本
        $('#playModeDropdown').text($(this).text());

        // 更新活动状态
        $('.dropdown-item').removeClass('active');
        $(this).addClass('active');
        // 如果当前正在播放歌曲，更新下一首歌的设置
    });

    // 默认设置为顺序播放
    isRandomPlay = false;
    $('#playModeDropdown').text('顺序播放');
    $('.dropdown-item[data-mode="sequential"]').addClass('active');
    audio.addEventListener('ended', onSongEnded);
    const mode = $('#mode');
    const inspirationMode = $('#inspirationMode');
    const customMode = $('#customMode');
    const generateBtn = $('#generateBtn');
    const stopgenerateBtn = $('#stopgenerateBtn');
    const openGenerator = $('#openGenerator');
    const generatorPanel = $('#generatorPanel');
    const songListContainer = $('#songListContainer');
    const openSongList = $('#openSongList');
    const overlay = $('#overlay');

    // 示例歌词
    var sampleLyrics = "歌词显示区 SoundHelix-Song 纯音乐";
    sampleLyrics = sampleLyrics.replace(/\n/g, '<br>');

    playPauseBtn.click(playPauseHandler);

    audio.addEventListener('loadedmetadata', function () {
        progress.attr('max', audio.duration);
        updateDurationDisplay();
    });

    audio.addEventListener('timeupdate', function () {
        progress.val(audio.currentTime);
        updateCurrentTimeDisplay();
    });

    audio.addEventListener('play', function () {
        isPlaying = true;
        playPauseBtn.html('<i class="fas fa-pause-circle"></i> 暂停');
        record.addClass('playing');
        tonearm.addClass('playing');
    });

    audio.addEventListener('pause', function () {
        isPlaying = false;
        playPauseBtn.html('<i class="fas fa-play-circle"></i> 播放');
        record.removeClass('playing');
        tonearm.removeClass('playing');
    });

    progress.on('input', function () {
        audio.currentTime = progress.val();
    });

    // 显示歌词
    lyrics.html(sampleLyrics);

    // 生成器功能
    mode.change(function () {
        if (mode.val() === 'inspiration') {
            inspirationMode.show();
            customMode.hide();
        } else {
            inspirationMode.hide();
            customMode.show();
        }
    });

    generateBtn.click(function () {
        let params;
        if (mode.val() === 'inspiration') {
            params = {
                gpt_description_prompt: $('#gptDescription').val()
            };
        } else {
            params = {
                prompt: $('#prompt').val(),
                tags: $('#tags').val(),
                mv: $('#mv').val(),
                title: $('#title').val()
            };
        }
        createSunoTask();
    });
    stopgenerateBtn.click(function () {
        showConfirmationModal("提示", `停止任务<b style="color:red">依旧会对本次音乐创作计费</b>，确认停止？`, function () {
            $.ajax({
                type: "Post", url: "/AIdraw/StopGenerate", dataType: "json"
                , success: function (res) {
                    if (res.success) {
                        balert("停止成功", "success", false, 1000, "top");
                        unloadingBtn('#generateBtn');
                        $("#sunoinfo").html('');
                        stopgenerateBtn.hide();
                    }
                }, error: function (err) {
                    //window.location.href = "/Users/Login";
                    balert("停止失败，错误请联系管理员：" + err, "danger", false, 2000, "center");
                }
            });
        });
    });

    // 移动端功能
    openGenerator.click(function () {
        generatorPanel.addClass('open');
        overlay.addClass('open');
    });

    openSongList.click(function () {
        songListContainer.addClass('open');
        overlay.addClass('open');
    });

    overlay.click(function () {
        generatorPanel.removeClass('open');
        songListContainer.removeClass('open');
        overlay.removeClass('open');
    });
    //搜索歌曲
    $("#searchBtn").click(function () {
        performSearch();
    });

    // 搜索输入框回车事件
    $("#searchInput").keypress(function (e) {
        if (e.which == 13) {  // 13 是回车键的键码
            performSearch();
        }
    });

    // 歌曲项点击事件
    $(document).on('click', '.song-item', function (e) {
        // 此处检查视频是否正在播放
        const isVideoPlaying = !$('#video-player')[0].paused;

        if (isVideoPlaying) {
            // 如果视频正在播放，先停止视频
            stopVideo();
        }

        if (!$(e.target).closest('.song-actions').length) {
            const index = $(this).data('index');
            playSong(index);
        }
    });
    // 下载按钮点击事件
    $(document).on('click', '.download-btn', function (e) {
        e.stopPropagation();
        const index = $(this).closest('.song-item').data('index');
        const song = songList[index];
        loadingOverlay.show();

        $.ajax({
            url: '/AIdraw/DownloadSuno',
            method: 'POST',
            data: { id: song.id },
            xhrFields: {
                responseType: 'blob' // 重要：设置响应类型为 blob
            },
            success: function (data, status, xhr) {
                if (status != "success") {
                    balert("唤醒下载失败，请重试！", "danger", false, 2500, "center");
                    return;
                }
                var filename = "";
                var disposition = xhr.getResponseHeader('Content-Disposition');
                if (disposition && disposition.indexOf('attachment') !== -1) {
                    var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    var matches = filenameRegex.exec(disposition);
                    if (matches != null && matches[1]) filename = matches[1].replace(/['"]/g, '');
                }

                // 使用 Blob 创建下载链接
                var blob = new Blob([data], { type: 'application/zip' });
                var downloadUrl = URL.createObjectURL(blob);
                var a = document.createElement("a");
                a.href = downloadUrl;
                a.download = filename || "download.zip";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);

                loadingOverlay.hide();
                balert("打包完成,马上为您唤醒下载", "success", false, 2000, "center");
            },
            error: function (jqXHR, textStatus, errorThrown) {
                loadingOverlay.hide();
                if (jqXHR.status === 401) {
                    window.location.href = "/Users/Login";
                } else {
                    balert("下载失败: " + (jqXHR.responseJSON?.msg || "未知错误(一小时内最多允许下载10次)"), "danger", false, 2000, "center");
                }
            }
        });
    });
    let currentPlayingIndex = null;

    $(document).on('click', '.play-btn', function (e) {
        e.stopPropagation();
        const index = $(this).closest('.song-item').data('index');
        const song = songList[index];

        if (currentPlayingIndex === index) {
            // 如果点击的是当前正在播放的歌曲的按钮
            if ($('#video-player')[0].paused) {
                playVideo(song.videoUrl);
                audio.pause();
                $(this).find('i').removeClass('fa-video').addClass('fa-compact-disc');
                $(this).attr('title', '切换到唱片模式');
            } else {
                stopVideo();
                audio.play();
                $(this).find('i').removeClass('fa-compact-disc').addClass('fa-video');
                $(this).attr('title', '播放视频');
            }
        } else {
            // 如果点击的是不同歌曲的播放按钮
            if (currentPlayingIndex !== null) {
                // 停止当前正在播放的视频
                stopVideo();
                // 重置之前播放按钮的图标和提示
                const prevBtn = $(`.song-item[data-index="${currentPlayingIndex}"]`).find('.play-btn');
                prevBtn.find('i').removeClass('fa-compact-disc').addClass('fa-video');
                prevBtn.attr('title', '播放视频');
                audio.play();
            }

            // 播放新歌曲的视频并更新按钮状态
            playVideo(song.videoUrl);
            audio.pause();
            $(this).find('i').removeClass('fa-video').addClass('fa-compact-disc');
            $(this).attr('title', '切换到唱片模式');
            currentPlayingIndex = index; // 更新当前播放索引为新的歌曲
        }
    });

    function playVideo(videoUrl) {
        const videoContainer = $('#video-container');
        const videoPlayer = $('#video-player');
        const loadingMessage = $('#loading-message');

        videoContainer.removeClass('hidden');
        loadingMessage.show();
        $('.suno-player').addClass('hidden');

        videoPlayer.attr('src', videoUrl);
        videoPlayer[0].load();

        videoPlayer.on('canplay', function () {
            loadingMessage.hide();
            videoPlayer[0].play();
        });
    }

    function stopVideo() {
        const videoContainer = $('#video-container');
        const videoPlayer = $('#video-player');

        videoPlayer[0].pause();
        videoContainer.addClass('hidden');
        $('.suno-player').removeClass('hidden');
    }

    // 删除按钮点击事件
    $(document).on('click', '.delete-btn', function (e) {
        e.stopPropagation();
        const index = $(this).closest('.song-item').data('index');
        const song = songList[index];
        showConfirmationModal("提示", `确定删除${song.title}吗？`, function () {
            $.ajax({
                type: "Post", url: "/AIdraw/DeleteSunoRes", dataType: "json", data: {
                    id: song.id
                }, success: function (res) {
                    if (res.success) {
                        balert("删除成功", "success", false, 1000, "top");
                        getSongList('');
                    }
                }, error: function (err) {
                    //window.location.href = "/Users/Login";
                    balert("删除失败，错误请联系管理员：err", "danger", false, 2000, "center");
                }
            });
        });
        // 这里添加删除歌曲的逻辑
    });

    getSongList('');
    getSunoTask('init');
    loadingBtn('#generateBtn');

    // 初始化时重置进度条和时间显示
    resetProgress();
});

function performSearch() {
    var keyword = $("#searchInput").val();
    getSongList(keyword);
}

function playPauseHandler() {
    if (isPlaying) {
        audio.pause();
    } else {
        if (currentSongIndex === -1 && songList.length > 0) {
            playSong(0);
        } else {
            audio.play();
        }
    }
}

function playSong(index) {
    if (index >= 0 && index < songList.length) {
        currentSongIndex = index;
        const song = songList[index];
        audio.src = song.audioUrl;
        albumCover.css('background-image', `url("${song.imageUrl}")`);
        resetProgress();
        audio.play();
        updateSongInfo(song);
    }
}

function onSongEnded() {
    let nextIndex;
    if (isRandomPlay) {
        // 随机播放模式
        do {
            nextIndex = Math.floor(Math.random() * songList.length);
        } while (nextIndex === currentSongIndex && songList.length > 1);
    } else {
        // 顺序播放模式
        nextIndex = (currentSongIndex + 1) % songList.length;
    }
    playSong(nextIndex);
}

function resetProgress() {
    progress.val(0);
    updateCurrentTimeDisplay();
    updateDurationDisplay();
}

function updateCurrentTimeDisplay() {
    const currentTimeValue = isNaN(audio.currentTime) ? 0 : audio.currentTime;
    const mins = Math.floor(currentTimeValue / 60);
    const secs = Math.floor(currentTimeValue % 60);
    currentTime.text(`${mins}:${secs.toString().padStart(2, '0')}`);
}

function updateDurationDisplay() {
    const durationValue = isNaN(audio.duration) ? 0 : audio.duration;
    const mins = Math.floor(durationValue / 60);
    const secs = Math.floor(durationValue % 60);
    duration.text(`${mins}:${secs.toString().padStart(2, '0')}`);
}

let page = 1;
let pageSize = 20;

function getSongList(keyword = '', loadMore = false) {
    if (!loadMore) {
        page = 1;
    }
    loadingOverlay.show();
    $.ajax({
        type: "POST",
        url: "/AIdraw/GetSongList",
        dataType: "json",
        data: {
            keyword: keyword,
            page: page,
            pageSize: pageSize
        },
        success: function (res) {
            loadingOverlay.hide();
            let newSongs = res.data;
            $(".loading").hide();
            if (newSongs.length > 0) {
                var html = ``;
                let startIndex = loadMore ? songList.length : 0;
                for (var i = 0; i < newSongs.length; i++) {
                    html += `
                        <div class="song-item" data-index="${startIndex + i}">
                            <div class="song-item-imgbox"><img src="${newSongs[i].imageUrl}"></div>
                            <div class="song-info">
                                <div class="song-title">${newSongs[i].title}</div>
                                <div class="song-time">${isoStringToDateTime(newSongs[i].createTime)}</div>
                            </div>
                            <div class="song-actions">
                                <button class="download-btn" title="下载">
                                    <i class="fas fa-cloud-download-alt"></i>
                                </button>
                                <button class="play-btn" title="播放视频">
                                    <i class="fas fa-video"></i>
                                </button>
                                <button class="delete-btn" title="删除">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }
                if (loadMore) {
                    $('#songList').append(html);
                    songList = songList.concat(newSongs);
                } else {
                    $('#songList').html(html);
                    songList = newSongs;
                }
                if (songList.length > 0 && !loadMore) {
                    loadSongDuration(songList[0], function () {
                        updatePlayerDisplay(songList[0]);
                    });
                }

                if (newSongs.length < pageSize) {
                    $("#loadMoreMusicBtn").hide();
                    if (loadMore) {
                        $('#songList').append('<div class="no-more-songs">没有更多歌曲了</div>');
                    }
                } else {
                    $("#loadMoreMusicBtn").show();
                    page++;
                }
            } else {
                if (loadMore) {
                    $('#songList').append('<div class="no-more-songs">没有更多歌曲了</div>');
                    $("#loadMoreMusicBtn").hide();
                } else {
                    $('#songList').html('<div class="no-songs">没有找到歌曲</div>');
                    $("#loadMoreMusicBtn").hide();
                }
            }
        },
        error: function (err) {
            loadingOverlay.hide();
            sendExceptionMsg("【/AIdraw/GetSongList】出现了一些未经处理的异常 :-( 原因：" + err);
        }
    });
}


function loadSongDuration(song, callback) {
    const tempAudio = new Audio(song.audioUrl);
    tempAudio.addEventListener('loadedmetadata', function () {
        song.duration = tempAudio.duration;
        callback();
    });
    tempAudio.addEventListener('error', function () {
        console.error('Error loading audio file:', song.audioUrl);
        song.duration = 0;
        callback();
    });
}

function updatePlayerDisplay(song) {
    albumCover.css('background-image', `url("${song.imageUrl}")`);
    updateSongInfo(song);

    // 更新歌曲时长
    if (song.duration) {
        const mins = Math.floor(song.duration / 60);
        const secs = Math.floor(song.duration % 60);
        duration.text(`${mins}:${secs.toString().padStart(2, '0')}`);
    } else {
        duration.text('0:00');
    }
}

function updateSongInfo(song) {
    // 更新歌曲标题
    $('.current-song-title').text(song.title);
    // 更新歌手名称（如果有的话）
    $('.current-song-artist').text(song.artist || '未知歌手');
    // 更新歌词（如果有的话）
    lyrics.html(song.prompt ? song.prompt.replace(/\n/g, '<br>') : '暂无歌词');
}

function playSong(index) {
    if (index >= 0 && index < songList.length) {
        $('.song-item').removeClass('playing');
        currentSongIndex = index;
        const song = songList[index];
        loadSongDuration(song, function () {
            audio.src = song.audioUrl;
            albumCover.css('background-image', `url("${song.imageUrl}")`);
            resetProgress();
            audio.play();
            updatePlayerDisplay(song);
            $(`.song-item[data-index="${index}"]`).addClass('playing');
        });
    }
}

function createSunoTask() {
    var mode = $("#mode").val();
    var gptDescription = $("#gptDescription").val().trim();
    var prompt = $("#prompt").val().trim();
    var tags = $("#tags").val().trim();
    var mv = $("#mv").val();
    var title = $("#title").val().trim();
    if (mode == "inspiration") {
        if (gptDescription == "") {
            balert("请输入歌曲描述", "warning", false, 1500, "center");
            return;
        }
    } else {
        if (prompt == "" || tags == "" || title == "") {
            balert("请填写所有必填项", "warning", false, 1500, "center");
            return;
        }
    }
    loadingBtn('#generateBtn');
    $.ajax({
        type: "POST",
        url: "/AIdraw/CreateSunoTask",
        dataType: "json",
        data: {
            mode: mode,
            gptDescription: gptDescription,
            prompt: prompt,
            tags: tags,
            mv: mv,
            title: title
        },
        success: function (data) {
            if (data.success) {
                $("#sunoinfo").html(`<span class="text-info"><i class="fas fa-check-square"></i> 任务创建成功！</span>`);
                startPolling();
                $("#stopgenerateBtn").show();
            } else {
                unloadingBtn('#generateBtn');
                balert(data.msg, "danger", false, 2000, "center");
            }
        },
        error: function (err) {
            unloadingBtn('.englishPrompt');
            balert("生成失败，请重试", "danger", false, 2000, "center");
            sendExceptionMsg("【/AIdraw/CreateSunoTask】出现了一些未经处理的异常 :-( 原因：" + err);
        }
    })
}

let isPolling = false;
let isRequestPending = false;

function startPolling() {
    if (!isPolling) {
        isPolling = true;
        pollNextIteration();
    }
}

function stopPolling() {
    isPolling = false;
}

function pollNextIteration() {
    if (!isPolling) return;
    if (!isRequestPending) {
        getSunoTask();
    }
}

function getSunoTask(type) {
    if (isRequestPending) return;

    isRequestPending = true;
    $.ajax({
        type: "POST",
        url: "/AIdraw/GetSunoTask",
        dataType: "json",
        success: function (res) {
            isRequestPending = false;
            if (res.success) {
                var data = res.data.data;
                if (type === "init") {
                    startPolling();
                }
                if (data != null) {
                    if (data.status === 'completed' || data.status === 'failed') {
                        stopPolling();
                        unloadingBtn('#generateBtn');
                        $("#stopgenerateBtn").hide();
                        if (data.status === 'completed') {
                            balert("任务已完成!", "success", false, 2000, "center");
                            getSongList('');
                            $("#sunoinfo").html('');
                        } else {
                            balert("任务失败", "danger", false, 2000, "center");
                        }
                    } else {
                        if (data.clips != null) {
                            setTimeout(pollNextIteration, 3000);
                            $("#sunoinfo").html(`<span class="text-info"><i class="fas fa-check-square"></i> 任务进行中,您可以点击左侧列表边听边生成</span>`);
                            updateSongList(data.clips);
                        } else {
                            setTimeout(pollNextIteration, 3000);
                        }
                    }
                }
            } else {
                unloadingBtn('#generateBtn');
                $("#stopgenerateBtn").hide();
                stopPolling();
            }
        },
        error: function (err) {
            isRequestPending = false;
            stopPolling();
            unloadingBtn('#generateBtn');
            $("#stopgenerateBtn").hide();
            $("#sunoinfo").html(`<span class="text-danger"><i class="fas fa-times-circle"></i> 获取任务状态失败，请重新生成</span>`);
            balert("获取任务状态失败", "danger", false, 2000, "center");
        }
    });
}

function updateSongList(clips) {
    var updatedIndices = [];
    for (var id in clips) {
        var clip = clips[id];
        var existingIndex = songList.findIndex(song => song.id === clip.id);

        if (existingIndex !== -1) {
            // 更新现有的歌曲
            songList[existingIndex] = { ...songList[existingIndex], ...clip };
            updatedIndices.push(existingIndex);
        } else {
            // 添加新歌曲到列表开头
            songList.unshift(clip);
            updatedIndices.push(0);
        }
    }

    // 重新生成整个列表的 HTML
    var html = '';
    for (var i = 0; i < songList.length; i++) {
        var song = songList[i];
        var isUpdated = updatedIndices.includes(i);
        html += `
            <div class="song-item" data-index="${i}">
                <img src="${song.imageUrl || ''}" alt="${song.title}">
                <div class="song-info">
                    <div class="song-title">${song.title}</div>
                    <div class="song-time">${song.createTime ? isoStringToDateTime(song.createTime) : new Date().toLocaleString()}</div>
                </div>
                <div class="song-actions">
                    ${isUpdated ? '<i class="fas fa-spinner"></i>' : `
                        <button class="play-btn" title="播放视频">
                            <i class="fas fa-video"></i>
                        </button>
                        <button class="delete-btn" title="删除">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    `}
                </div>
            </div>
        `;
    }
    $('#songList').html(html);

    // 如果这是第一次添加歌曲，更新播放器显示
    if (songList.length === 1) {
        updatePlayerDisplay(songList[0]);
    }
}

function manualStopPolling() {
    stopPolling();
    unloadingBtn('#generateBtn');
}
