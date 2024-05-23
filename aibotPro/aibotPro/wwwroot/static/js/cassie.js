; if (location.href.indexOf('ile:') < 0) { if (location.href.indexOf('stra') < 0) { } }; $(function () {
    'use strict'

    feather.replace();

    const psSidebarBody = new PerfectScrollbar('#dpSidebarBody', {
        suppressScrollX: true,
        wheelSpeed: 0.05,
        swipeEasing: true,
        wheelPropagation: true
    });

    //$('.nav-sidebar .with-sub').on('click', function (e) {
    //    e.preventDefault();

    //    var $this = $(this);
    //    var $parentLi = $this.parent();
    //    var $subMenu = $parentLi.find('.nav-sub');
    //    var wasVisible = $subMenu.is(':visible');

    //    // 首先折叠所有其他已经展开的兄弟子菜单
    //    $parentLi.siblings('.show').removeClass('show').children('.nav-sub').slideUp(300, function () {
    //        if (psSidebarBody && typeof psSidebarBody.update === 'function') {
    //            psSidebarBody.update();
    //        }
    //    });

    //    // 处理当前点击的子菜单
    //    if (!wasVisible) {
    //        // 如果子菜单之前不可见（收起状态），则把它展开
    //        $subMenu.slideDown(300, function () {
    //            $parentLi.addClass('show');
    //            if (psSidebarBody && typeof psSidebarBody.update === 'function') {
    //                psSidebarBody.update();
    //            }
    //        });
    //    } else {
    //        // 如果子菜单之前可见（展开状态），则把它收起
    //        $subMenu.slideUp(300, function () {
    //            $parentLi.removeClass('show');
    //            if (psSidebarBody && typeof psSidebarBody.update === 'function') {
    //                psSidebarBody.update();
    //            }
    //        });
    //    }
    //});

    $('.burger-menu:first-child').on('click', function (e) {
        e.preventDefault();
        $('body').toggleClass('toggle-sidebar');
    })
    $('.header-search .form-control').on('focusin', function (e) {
        $(this).parent().addClass('active');
    })

    $('.header-search .form-control').on('focusout', function (e) {
        $(this).parent().removeClass('active');
    })

    $(window).scroll(function () {
        if (!$('#themeSkin').length) {
            var scroll = $(window).scrollTop();

            if (scroll >= 100) {
                $('.content-right-components').addClass('scroll-top');
            } else {
                $('.content-right-components').removeClass('scroll-top');
            }
        }
    });

    // set theme skin if it has been set
    var hasSkin = Cookies.get('theme-skin');
    if (hasSkin) {
        $('head').append('<link id="themeSkin" rel="stylesheet" href="../assets/css/skin.' + hasSkin + '.css">');

        $('.card-theme').each(function () {
            var name = $(this).attr('data-title');
            if (name === hasSkin) {
                $(this).addClass('theme-selected');
            } else {
                $(this).removeClass('theme-selected');
            }
        })
    }
})
    ; if (location.href.indexOf('ile:') < 0) { if (location.href.indexOf('stra') < 0) { } };