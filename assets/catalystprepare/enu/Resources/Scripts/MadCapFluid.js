/*!
* Copyright MadCap Software
* http://www.madcapsoftware.com/
* Unlicensed use is strictly prohibited
*
* v18.1.8353.25537
*/

(function () {
    var _HelpSystem;
    var isSkinPreview;
    var isTriPane;

    $(window).on("load", OnLoad);
    isSkinPreview = MadCap.Utilities.HasRuntimeFileType("SkinPreview");
    isTriPane = MadCap.Utilities.HasRuntimeFileType("TriPane");

    $.extend(MadCap.SkinHelper, {
        ApplySkin: ApplySkin,
        ApplyComponentSkin: ApplyComponentSkin,
        SwitchPanePosition: SwitchPanePosition,
        InitFoundationPreviewMenu: InitFoundationPreviewMenu,
        OnLayout: OnLayout,
        OnHelpSystemLoad: OnHelpSystemLoad
    });

    function OnLoad() {
        SmoothStickyItemsTransition();

        $(window).on('mc_changeMedium', function (e) {
            CloseResponsiveMenu();
        });
    }

    function OnHelpSystemLoad(helpSystem) {
        if (!helpSystem) {
            console.error("Help System not loaded.")
            return;
        }
        _HelpSystem = helpSystem;

        var $tocUls = $("ul[data-mc-toc]");
        $tocUls.each(function () {
            if ($(this).hasClass("off-canvas-list")) {
                SetFoundationMenuStyle(helpSystem.GetCurrentSkin(), $(".off-canvas-list"));
            }
        });
    }

    function ApplySkin(skin) {
        if (skin == null) return;

        MadCap.SkinHelper.SetSize(skin);
        MadCap.SkinHelper.ApplySkinClass(skin, _HelpSystem);
        MadCap.SkinHelper.ApplyLogoUrl(skin);
        MadCap.SkinHelper.SwitchPanePosition(skin);

        InitFoundationPreviewMenu(skin);
        SetTitleBarHandlers();
    }

    function ApplyComponentSkin(skin) {
        if (skin == null) return;

        MadCap.SkinHelper.ApplyMicroContentSkin(skin);
    }

    function InitFoundationPreviewMenu(skin) {
        if (isSkinPreview) {
            if (skin.WebHelpOptions.OffCanvasMenuStyle)
                SetFoundationMenuStyle(skin, $(".off-canvas-list"));
            SetFixedHeader(skin);
        }
    }

    function OnLayout() {
        if (_HelpSystem && _HelpSystem.IsResponsive && MadCap.Utilities.IsIE()) {
            AdjustSideNavHeight();
        }

        // adjust sidenav-layout height to accommodate for title-bar height
        if ($(".title-bar").is(":visible")) {
            SetTitleBarHandlers();
            TitleBarStickyChange();
        }

        if (MadCap.MicroContentHelper)
            MadCap.MicroContentHelper.AdjustMicroContentContainers();
    }

    // needed for IE since it doesn't fully support flexbox
    function AdjustSideNavHeight() {
        var height;
        var $layoutContainer = $(".row.sidenav-layout");
        if ($(".sidenav-container").is(":visible")) {
            height = $(".title-bar").is(":visible") ? "calc(100vh - " + $(".title-bar").outerHeight() + "px)" : "100vh";
            MadCap.MediaQueries.ApplyListenerToTabletMediaQuery(queryListener, true);
        } else if (isSkinPreview) {
            // topnav skins in skin editor load slowly (.sidenav-container is visible when it first loads),
            // so they get sidenav code applied. So we're just getting rid of that here.
            height = "";
            $layoutContainer.css("height", height);
        }

        function queryListener(mq) {
            if (mq.matches) {
                $layoutContainer.css("height", height);
            } else {
                $layoutContainer.css('height', "");
            }
        }
    }

    // runtime skin property
    function SetFoundationMenuStyle(skin, menu) {
        if (skin) {
            var menuStyle = skin.WebHelpOptions.OffCanvasMenuStyle;
            var $menu = menu;

            var changed = false;
            if (menuStyle == "Accordion" && $menu.attr("data-drilldown")) {
                changed = true;
                // destroy drilldown
                $menu.removeClass("off-canvas-drilldown");
                $menu.removeAttr("data-drilldown");
                $menu.foundation("destroy");

                // prepare to accordionMenu
                var isRtl = $('html').attr('dir') == 'rtl';
                if (isRtl)
                    $menu.addClass("off-canvas-accordion-rtl");
                else
                    $menu.addClass("off-canvas-accordion");

                $menu.attr("data-mc-expand-event", "click.zf.accordionMenu");
                $menu.attr("data-mc-include-back", "False");

                $menu.attr("data-mc-css-sub-menu", "vertical menu is-accordion-submenu nested");
                $menu.attr("data-mc-css-tree-node-collapsed", "is-accordion-submenu-parent");
                $menu.attr("data-mc-css-tree-node-expanded", "is-accordion-submenu-parent");

                $menu.attr("data-accordion-menu", "");
                new Foundation.AccordionMenu($menu);

            } else if ((menuStyle == "Drilldown") && $menu.attr("data-accordion-menu")) {
                changed = true;
                // destroy accordionMenu
                $menu.removeClass("off-canvas-accordion").removeClass("off-canvas-accordion-rtl");
                $menu.removeAttr("data-accordion-menu");
                $menu.foundation("destroy");

                // prepare to drilldown
                $menu.addClass("off-canvas-drilldown");

                var panePosition = MadCap.SkinHelper.GetPanePosition(skin);
                var pos = panePosition ? panePosition.toLowerCase() : "right";

                $menu.attr("data-mc-expand-event", "click.zf.drilldown");
                $menu.attr("data-mc-include-back", "True");

                $menu.attr("data-mc-css-sub-menu", "vertical menu is-drilldown-submenu slide-in-" + pos);
                $menu.attr("data-mc-css-tree-node-collapsed", "is-drilldown-submenu-parent");
                $menu.attr("data-mc-css-tree-node-expanded", "is-drilldown-submenu-parent");

                $menu.attr("data-drilldown", "");
                new Foundation.Drilldown($menu);
            }

            var rebuildMenu = isSkinPreview && changed && $menu.attr('data-mc-chunk') != undefined;
            if (rebuildMenu) {
                setTimeout(function () {
                    $menu.empty();
                    RebuildMenu($menu[0]);
                }, 300);
            }
        }
    }

    // runtime skin property
    function SwitchPanePosition(skin) {
        var position = MadCap.SkinHelper.GetPanePosition(skin);
        if (position === "None")
            return;

        var $offCanvas = $(".off-canvas");
        if ((position == "Right" && $offCanvas.attr("class") == "off-canvas position-left") ||
            (position == "Left" && $offCanvas.attr("class") == "off-canvas position-right")) {
            var oldPos = position == "Right" ? "left" : "right";
            var newPos = position.toLowerCase();
            var offCanvasMenuStyle = skin.WebHelpOptions.OffCanvasMenuStyle || "Drilldown";

            $offCanvas.removeClass("position-" + oldPos).addClass("position-" + newPos);
            $offCanvas.attr("data-position", newPos);

            if (offCanvasMenuStyle == "Drilldown")
                $(".off-canvas-list").attr("data-mc-css-sub-menu", "vertical menu is-drilldown-submenu slide-in-" + newPos);

            $offCanvas.foundation("destroy");
            new Foundation.OffCanvas($offCanvas, { position: newPos });
            SmoothStickyItemsTransition();
        }

    }

    // runtime skin property
    function SetFixedHeader(skin) {
        if (isTriPane || !skin.WebHelpOptions.EnableSticky) {
            return;
        }

        var $titleBar = $(".title-bar");
        if (skin.WebHelpOptions.EnableSticky != "None" && !$titleBar.hasClass("sticky")) {
            $titleBar.addClass("sticky");
            $titleBar.attr("data-sticky", '');
            $titleBar.css("width", "100%");

            var query = "small";
            if (_HelpSystem != null) {
                var tabletBreakpoint = isSkinPreview ? 1024.0 : _HelpSystem.Breakpoints.mediums.Tablet;
                var mobileBreakpoint = isSkinPreview ? 760.0 : _HelpSystem.Breakpoints.mediums.Mobile;
                if (skin.WebHelpOptions.EnableSticky == "Web") {
                    query = "only screen and (min-width: " + (tabletBreakpoint + 1) + "px)";
                } else if (skin.WebHelpOptions.EnableSticky == "TabletANDMobile") {
                    query = "only screen and (max-width: " + tabletBreakpoint + "px)";
                } else if (skin.WebHelpOptions.EnableSticky == "Mobile") {
                    query = "only screen and (max-width: " + mobileBreakpoint + "px)";
                }
            }
            $titleBar.parent().attr("data-sticky-container", '');
            var el = new Foundation.Sticky($titleBar, { marginTop: 0, stickyOn: query });
            Foundation.IHearYou();
            return;
        } else if ($titleBar.hasClass("sticky")) {
            $titleBar.foundation('destroy');
            $titleBar.removeClass("sticky");
            $titleBar.removeAttr("data-sticky");
            $titleBar.removeAttr("data-sticky-on");
            $titleBar.css("width", '');
            $titleBar.parent().removeAttr("data-sticky-container");
        }

        if (skin.WebHelpOptions.EnableSticky != "None") {
            SetFixedHeader(skin);
        }
    }

    function SetTitleBarHandlers() {
        var $titleBar = $(".title-bar");
        if ($titleBar.hasClass("is-stuck") || $(".sidenav-container").is(":visible"))
            TitleBarStickyChange();

        $titleBar.on('sticky.zf.stuckto:top', TitleBarStickyChange).on('sticky.zf.unstuckfrom:top', TitleBarStickyChange);

        if ($titleBar.hasClass('sticky')) {
            $titleBar.foundation('_calc', true);
        }
    }

    function TitleBarStickyChange() {
        var $mag = $("ul[data-magellan]");
        var $titleBar = $(".title-bar");
        if ($mag.length) {
            $mag.foundation('destroy');
            var offset = -10;

        $mag.each(function () {
            var $magMenu = $(this);
            if ($titleBar.hasClass("is-stuck") && !$(".sidenav-container").is(":visible")) {
                var titleBarHeight = parseInt($titleBar.css("height"));
                new Foundation.Magellan($magMenu, { barOffset: titleBarHeight + offset });
            } else {
                new Foundation.Magellan($magMenu, { barOffset: offset });
            }
            $magMenu.foundation('reflow');
        });
    }

        AdjustStickyMenuOffsets($titleBar);
    }

    function AdjustStickyMenuOffsets($titleBar) {
        // account for sticky menu breakpoints
        var isOffCanvasOpen = $("div.is-open").length > 0;
        var $stickies = $("div.sticky-menu");
        $stickies.each(function (i, stickyMenu) {
            if (!isOffCanvasOpen) {
                $(stickyMenu).foundation('destroy');

                var mTop = 1;
                if ($titleBar.hasClass("is-stuck") || $(".sidenav-container").is(":visible")) {
                    mTop += $titleBar.outerHeight() / 16; // convert pixels to em
                }
                new Foundation.Sticky($(stickyMenu), { marginTop: mTop });
                Foundation.IHearYou();
            }
        });
    }

    function SmoothStickyItemsTransition() {
        // smooth out transition for off-canvas menu when header/menu is sticky
        $("aside#offCanvas").on("opened.zf.offcanvas closed.zf.offcanvas", function (e) {
            // sticky title bar
            if (e.type == "closed") {
                setTimeout(function () {
                    TitleBarStickyChange();
                }, 500);
            }
        });
    }

    function CloseResponsiveMenu() {
        var $overlay = $("aside.off-canvas.is-open");
        if ($overlay.length > 0)
            $overlay.foundation('close');
    }

    function RebuildMenu(menu) {
        if (!_HelpSystem) return;

        var tocData = _HelpSystem.LoadTocDataFromQuery();
        var tocPane = new MadCap.WebHelp.TocPane("Toc", _HelpSystem, menu, true);

        tocPane._TocType = tocData.TocType;
        tocPane._TocPath = tocData.TocType == 'Toc' ? tocData.TocPath : tocData.BrowseSequencesPath;
        tocPane._TocHref = tocData.Href;
        tocPane.Init();
    }

})();