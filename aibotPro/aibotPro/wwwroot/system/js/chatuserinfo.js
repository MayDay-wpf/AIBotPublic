// 用户信息面板管理
let userInfoExpanded = false;

/**
 * 切换用户信息面板展开/收起状态
 */
function toggleUserInfo() {
    // 确保面板已创建
    createUserInfoPanel();
    
    const panel = document.getElementById('userInfoPanel');
    const icon = document.getElementById('userInfoIcon');

    if (!userInfoExpanded) {
        // 展开面板
        userInfoExpanded = true;
        panel.style.display = 'block';

        // 使用setTimeout确保显示后再应用动画
        setTimeout(() => {
            panel.classList.add('show');
        }, 10);

        // 更换图标为向下箭头（表示可以收起）
        icon.className = 'fas fa-angle-double-down';

        // 加载用户信息
        loadUserInfo();

        // 添加全局事件监听器
        setTimeout(() => {
            document.addEventListener('click', handleOutsideClick);
            document.addEventListener('keydown', handleKeyDown);
            window.addEventListener('scroll', handleScroll);
        }, 100);
    } else {
        // 收起面板
        hideUserInfo();
    }
}

/**
 * 隐藏用户信息面板
 */
function hideUserInfo() {
    if (!userInfoExpanded) return;

    const panel = document.getElementById('userInfoPanel');
    const icon = document.getElementById('userInfoIcon');

    userInfoExpanded = false;
    panel.classList.remove('show');

    // 等待动画完成后隐藏元素
    setTimeout(() => {
        panel.style.display = 'none';
    }, 300);

    // 更换图标为向上箭头（表示可以展开）
    icon.className = 'fas fa-angle-double-up';

    // 移除全局事件监听器
    document.removeEventListener('click', handleOutsideClick);
    document.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('scroll', handleScroll);
}

/**
 * 处理点击面板外部区域的事件
 */
function handleOutsideClick(event) {
    const panel = document.getElementById('userInfoPanel');
    const userInfoIcon = document.getElementById('userInfoIcon');

    // 检查点击的目标是否在面板内部或是触发按钮
    if (panel && userInfoIcon) {
        const isInsidePanel = panel.contains(event.target);
        const isIconClick = userInfoIcon.contains(event.target) || userInfoIcon === event.target;
        const isIconParentClick = userInfoIcon.parentElement && userInfoIcon.parentElement.contains(event.target);

        // 如果点击的不是面板内部、图标或图标的父元素，则隐藏面板
        if (!isInsidePanel && !isIconClick && !isIconParentClick) {
            hideUserInfo();
        }
    }
}

/**
 * 处理键盘事件
 */
function handleKeyDown(event) {
    // ESC键隐藏面板
    if (event.key === 'Escape' || event.keyCode === 27) {
        hideUserInfo();
    }
}

/**
 * 处理页面滚动事件
 */
function handleScroll(event) {
    // 页面滚动时隐藏面板
    hideUserInfo();
}

/**
 * 加载用户信息
 */
function loadUserInfo() {
    const loadingEl = document.getElementById('userInfoLoading');
    const dataEl = document.getElementById('userInfoData');

    // 显示加载状态
    loadingEl.style.display = 'block';
    dataEl.style.display = 'none';

    // 获取token
    const token = localStorage.getItem('aibotpro_userToken');
    if (!token) {
        console.error('未找到用户令牌');
        showUserInfoError('请先登录');
        return;
    }

    // 调用API获取最新信息
    $.ajax({
        url: '/Users/GetCompleteUserInfo',
        type: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        success: function (response) {
            if (response.success) {
                // 显示用户信息
                displayUserInfo(response.data);
            } else {
                showUserInfoError(response.msg || '获取用户信息失败');
            }
        },
        error: function (xhr, status, error) {
            console.error('获取用户信息失败:', error);
            showUserInfoError('网络错误，请稍后重试');
        },
        complete: function () {
            loadingEl.style.display = 'none';
            dataEl.style.display = 'block';
        }
    });
}

/**
 * 显示用户信息
 * @param {Object} data - 用户信息数据
 */
function displayUserInfo(data) {
    try {
        // 基本信息
        document.getElementById('userAvatar').src = data.avatar || '/static/picture/fff.png';
        document.getElementById('userNickname').textContent = data.nickname || '未设置昵称';
        document.getElementById('userAccount').textContent = data.account || '--';
        document.getElementById('userBalance').textContent = formatBalance(data.balance);

        // VIP信息
        displayVipInfo(data.vipInfo);

        // Token包信息
        displayTokenPackages(data.tokenPackages);

        // 更新侧边栏的余额显示
        updateSidebarBalance(data.balance);

    } catch (error) {
        console.error('显示用户信息时出错:', error);
        showUserInfoError('数据解析失败');
    }
}

/**
 * 显示VIP信息
 * @param {Object} vipInfo - VIP信息
 */
function displayVipInfo(vipInfo) {
    const vipStatus = document.getElementById('vipStatus');
    const vipDetails = document.getElementById('vipDetails');
    const vipEndTime = document.getElementById('vipEndTime');
    const vipRemaining = document.getElementById('vipRemaining');

    if (vipInfo.isVip) {
        vipStatus.className = 'vip-status is-vip';
        vipStatus.querySelector('.vip-text').textContent = `VIP会员 (${vipInfo.vipType})`;

        vipEndTime.textContent = vipInfo.endTime;
        vipRemaining.textContent = vipInfo.remainingDays;

        vipDetails.style.display = 'block';
    } else {
        vipStatus.className = 'vip-status non-vip';
        vipStatus.querySelector('.vip-text').textContent = '普通用户';
        vipDetails.style.display = 'none';
    }
}

// 当前显示的Token包索引
let currentTokenPackageIndex = 0;
let totalTokenPackages = 0;

/**
 * 创建用户信息面板HTML
 */
function createUserInfoPanel() {
    // 检查面板是否已存在
    if (document.getElementById('userInfoPanel')) {
        return;
    }

    const panelHTML = `
        <div class="user-info-panel" id="userInfoPanel" style="display: none;">
            <div class="user-info-content">
                <div class="user-info-loading" id="userInfoLoading">
                    <div class="text-center">
                        <i class="fas fa-spinner spinning"></i>
                        <p>加载中...</p>
                    </div>
                </div>
                <div class="user-info-data" id="userInfoData" style="display: none;">
                    <!-- 基本信息 -->
                    <div class="user-basic-info">
                        <div class="user-avatar-section">
                            <img src="" id="userAvatar" class="user-avatar" alt="用户头像">
                            <div class="user-basic-text">
                                <h6 class="user-nickname" id="userNickname">--</h6>
                                <p class="user-account" id="userAccount">--</p>
                            </div>
                        </div>
                    </div>
                    <div class="user-balance">
                        <i class="fas fa-coins"></i>
                        <span id="userBalance">--</span>
                    </div>
                    <!-- VIP信息 -->
                    <div class="user-vip-info" id="userVipInfo">
                        <div class="vip-status" id="vipStatus">
                            <i class="fas fa-crown"></i>
                            <span class="vip-text">--</span>
                        </div>
                        <div class="vip-details" id="vipDetails" style="display: none;">
                            <p class="vip-end-time">到期时间: <span id="vipEndTime">--</span></p>
                            <p class="vip-remaining">剩余天数: <span id="vipRemaining">--</span> 天</p>
                        </div>
                    </div>

                    <!-- Token包信息 -->
                    <div class="user-token-packages" id="userTokenPackages">
                        <div class="token-packages-header">
                            <h6 class="token-packages-title">
                                <i class="fas fa-box"></i>
                                Token包 (<span id="tokenPackageCount">0</span>)
                            </h6>
                            <div class="token-packages-nav" id="tokenPackagesNav" style="display: none;">
                                <button class="token-nav-btn" id="tokenPrevBtn" onclick="navigateTokenPackage(-1)">
                                    <i class="fas fa-chevron-left"></i>
                                </button>
                                <span class="token-nav-indicator" id="tokenNavIndicator">1/1</span>
                                <button class="token-nav-btn" id="tokenNextBtn" onclick="navigateTokenPackage(1)">
                                    <i class="fas fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                        <div class="token-packages-container">
                            <div class="token-packages-list" id="tokenPackagesList">
                                <!-- Token包列表将在这里动态生成 -->
                            </div>
                        </div>
                    </div>

                    <!-- 快捷操作 -->
                    <div class="user-quick-actions">
                        <a href="/Users/UserInfo" class="btn btn-sm btn-primary">
                            <i class="far fa-user"></i> 完整信息
                        </a>
                        <a href="/Pay/Balance" class="btn btn-sm btn-success">
                            <i class="fas fa-credit-card"></i> 充值
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 将面板添加到页面中，放在.chat-sidebar内部
    const chatSidebar = document.querySelector('.chat-sidebar');
    if (chatSidebar) {
        chatSidebar.insertAdjacentHTML('beforeend', panelHTML);
    } else {
        // 如果找不到.chat-sidebar，就添加到body
        document.body.insertAdjacentHTML('beforeend', panelHTML);
    }
}

/**
 * 显示Token包信息
 * @param {Array} tokenPackages - Token包列表
 */
function displayTokenPackages(tokenPackages) {
    const countEl = document.getElementById('tokenPackageCount');
    const listEl = document.getElementById('tokenPackagesList');
    const navEl = document.getElementById('tokenPackagesNav');
    
    // 对Token包进行排序：没用完的优先显示
    const sortedPackages = [...tokenPackages].sort((a, b) => {
        // 首先按剩余Token数量排序（降序）
        const aRemaining = a.remainingTokens || 0;
        const bRemaining = b.remainingTokens || 0;
        
        if (aRemaining !== bRemaining) {
            return bRemaining - aRemaining;
        }
        
        // 如果剩余Token数量相同，按过期时间排序（距离过期时间越近越靠前）
        return a.remainingDays - b.remainingDays;
    });
    
    totalTokenPackages = sortedPackages.length;
    currentTokenPackageIndex = 0;
    countEl.textContent = totalTokenPackages;
    
    if (totalTokenPackages === 0) {
        listEl.innerHTML = '<div class="token-package-item active"><p class="text-muted" style="font-size: 12px; margin: 10px 0; text-align: center;">暂无Token包</p></div>';
        listEl.style.height = 'auto';
        navEl.style.display = 'none';
        return;
    }
    
    // 显示/隐藏导航
    if (totalTokenPackages > 1) {
        navEl.style.display = 'flex';
        updateTokenNavigation();
    } else {
        navEl.style.display = 'none';
    }
    
    let html = '';
    sortedPackages.forEach((pkg, index) => {
        const progressPercentage = Math.min(100, pkg.usagePercentage);
        const modelsText = pkg.models.join(', ');
        const activeClass = index === 0 ? 'active' : '';
        
        // 添加一个视觉指示器来显示Token包状态
        const isAlmostEmpty = pkg.remainingTokens <= pkg.totalTokens * 0.1; // 剩余不足10%
        const isExpiringSoon = pkg.remainingDays <= 7; // 7天内过期
        
        let statusIndicator = '';
        if (pkg.remainingTokens === 0) {
            statusIndicator = '<span class="token-status-indicator empty">已用完</span>';
        } else if (isAlmostEmpty) {
            statusIndicator = '<span class="token-status-indicator low">余量不足</span>';
        } else if (isExpiringSoon) {
            statusIndicator = '<span class="token-status-indicator expiring">即将过期</span>';
        }
        
        html += `
            <div class="token-package-item ${activeClass}" data-index="${index}">
                <div class="token-package-header">
                    <span class="token-package-models">${modelsText}</span>
                    ${statusIndicator}
                </div>
                <div class="token-progress">
                    <div class="token-progress-bar" style="width: ${progressPercentage}%"></div>
                </div>
                <div class="token-stats">
                    <span>${formatNumber(pkg.usedTokens)}/${formatNumber(pkg.totalTokens)}</span>
                    <span>${pkg.remainingDays}天</span>
                </div>
            </div>
        `;
    });
    
    listEl.innerHTML = html;
    
    // 设置容器高度为第一个卡片的高度
    setTimeout(() => {
        const firstItem = listEl.querySelector('.token-package-item');
        if (firstItem) {
            listEl.style.height = firstItem.offsetHeight + 'px';
        }
    }, 0);
}

/**
 * 导航Token包
 * @param {number} direction - 方向 (-1: 上一个, 1: 下一个)
 */
function navigateTokenPackage(direction) {
    if (totalTokenPackages <= 1) return;
    
    const newIndex = currentTokenPackageIndex + direction;
    if (newIndex >= 0 && newIndex < totalTokenPackages) {
        const oldIndex = currentTokenPackageIndex;
        currentTokenPackageIndex = newIndex;
        updateTokenPackageDisplay(oldIndex, newIndex);
        updateTokenNavigation();
    }
}

/**
 * 更新Token包显示位置
 * @param {number} oldIndex - 旧的索引
 * @param {number} newIndex - 新的索引
 */
function updateTokenPackageDisplay(oldIndex, newIndex) {
    const listEl = document.getElementById('tokenPackagesList');
    const items = listEl.querySelectorAll('.token-package-item');
    
    if (items.length === 0) return;
    
    // 移除所有状态类
    items.forEach(item => {
        item.classList.remove('active', 'prev', 'next');
    });
    
    // 设置新的状态
    if (items[newIndex]) {
        items[newIndex].classList.add('active');
        
        // 动态调整容器高度
        setTimeout(() => {
            listEl.style.height = items[newIndex].offsetHeight + 'px';
        }, 0);
    }
    
    // 为其他卡片设置适当的状态
    items.forEach((item, index) => {
        if (index !== newIndex) {
            if (index < newIndex) {
                item.classList.add('prev');
            } else {
                item.classList.add('next');
            }
        }
    });
}

/**
 * 更新导航状态
 */
function updateTokenNavigation() {
    const prevBtn = document.getElementById('tokenPrevBtn');
    const nextBtn = document.getElementById('tokenNextBtn');
    const indicator = document.getElementById('tokenNavIndicator');

    if (prevBtn) prevBtn.disabled = currentTokenPackageIndex === 0;
    if (nextBtn) nextBtn.disabled = currentTokenPackageIndex === totalTokenPackages - 1;
    if (indicator) indicator.textContent = `${currentTokenPackageIndex + 1}/${totalTokenPackages}`;
}

/**
 * 更新侧边栏的余额显示
 * @param {number} balance - 余额
 */
function updateSidebarBalance(balance) {
    const mcoinEl = document.getElementById('Mcoin');
    if (mcoinEl) {
        mcoinEl.textContent = formatBalance(balance);
    }
}

/**
 * 显示错误信息
 * @param {string} message - 错误消息
 */
function showUserInfoError(message) {
    const dataEl = document.getElementById('userInfoData');
    dataEl.innerHTML = `
        <div class="text-center" style="padding: 20px;">
            <i class="fas fa-exclamation-circle" style="color: #dc3545; font-size: 24px;"></i>
            <p style="color: #dc3545; margin-top: 8px;">${message}</p>
            <button class="btn btn-sm btn-outline-primary" onclick="loadUserInfo()">
                <i class="fas fa-redo"></i> 重试
            </button>
        </div>
    `;
}

/**
 * 格式化余额显示
 * @param {number} balance - 余额
 * @returns {string} 格式化后的余额字符串
 */
function formatBalance(balance) {
    if (balance === null || balance === undefined) {
        return '--';
    }

    const num = parseFloat(balance);
    if (isNaN(num)) {
        return '--';
    }

    return num;
}

/**
 * 格式化数字显示
 * @param {number} num - 数字
 * @returns {string} 格式化后的数字字符串
 */
function formatNumber(num) {
    if (num === null || num === undefined) {
        return '0';
    }

    const number = parseInt(num);
    if (isNaN(number)) {
        return '0';
    }

    if (number >= 1000000) {
        return (number / 1000000).toFixed(1) + 'M';
    } else if (number >= 1000) {
        return (number / 1000).toFixed(1) + 'K';
    }

    return number.toString();
}



// 监听页面事件
document.addEventListener('DOMContentLoaded', function () {
    // 页面加载完成后创建用户信息面板
    createUserInfoPanel();
});

// 页面卸载时清理事件监听器
window.addEventListener('beforeunload', function () {
    if (userInfoExpanded) {
        document.removeEventListener('click', handleOutsideClick);
        document.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('scroll', handleScroll);
    }
});

// 导出函数供其他脚本使用
window.toggleUserInfo = toggleUserInfo;
window.loadUserInfo = loadUserInfo;
window.hideUserInfo = hideUserInfo;
