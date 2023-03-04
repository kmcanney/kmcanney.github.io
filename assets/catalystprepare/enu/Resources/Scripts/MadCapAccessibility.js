/// <reference path="MadCapGlobal.js" />

(function () {
    const KEYCODE_ENTER = 13;
    const KEYCODE_SPACE = 32;
    const KEYCODE_ESC = 27;
    const KEYCODE_ARR_UP = 38;
    const KEYCODE_ARR_DOWN = 40;

    var elsThatNeedTransparentImg = []; //holds object w/ jquery element, and alt text desired
    var transparentUrl;
    var helpSystem;
    var isTriPane;

    MadCap.Accessibility = MadCap.CreateNamespace("Accessibility");

    MadCap.Accessibility.makeAccessibleButton = makeAccessibleButton;
    MadCap.Accessibility.setAriaControls = setAriaControls;
    MadCap.Accessibility.appendTransparentImg = appendTransparentImg;

    MadCap.Accessibility.initTextEffectsAccessibility = initTextEffectsAccessibility;
    MadCap.Accessibility.initPopupTopicAccessibility = initPopupTopicAccessibility;
    MadCap.Accessibility.initTopNavMenuButtons = initTopNavMenuButtons;
    MadCap.Accessibility.initTopNavSubmenuAccessibility = initTopNavSubmenuAccessibility;
    MadCap.Accessibility.initMenuDropdownAccessibility = initMenuDropdownAccessibility;
    MadCap.Accessibility.tripaneTopicFrameSkip = tripaneTopicFrameSkip;
    MadCap.Accessibility.tripaneGlossarySkip = tripaneGlossarySkip;
    MadCap.Accessibility.makeAccessibleMCSlideshow = makeAccessibleMCSlideshow;

    MadCap.Accessibility.getPulseLabel = getPulseLabel;
    MadCap.Accessibility.getElasticSearchHistoryLabel = getElasticSearchHistoryLabel;
    MadCap.Accessibility.getElasticSearchContentLabel = getElasticSearchContentLabel;

    $(document).ready(function () {
        disallowLinkHiddenByNav();
        makeAccessibleButton($(".search-filter"));
        makeAccessibleButton($(".search-submit"));
        initTextEffectsAccessibility();
        initTableAccessibility();

        isTriPane = MadCap.Utilities.HasRuntimeFileType("TriPane");
        if (isTriPane) {
            // 508 Compliance Fixes for Tripane
            triPaneSkipToContent();
            initTripaneSidebarAccessibility();
            initTripaneSearchAccessibility();

            makeAccessibleButton($('div.button'));

            $("#tripane-iframe-title").on('focusout blur', function () {
                $(this).attr({
                    'tabindex': '',
                    'aria-hidden': 'true'
                });
            });

        } else {
            // logo transparent img
            var $logo = $("a.logo");
            appendTransparentImg($logo, $logo.attr("alt"))
            $logo.removeAttr("alt");

            assureMainContent();
            nonTripaneSkipToContent();
        }

        getHelpSystem(function () {
            initExpandCollapseAccessibility();
            transparentUrl = helpSystem.GetTransparentImagePath();

            // adds transparent images in buffer waiting for helpSystem init
            elsThatNeedTransparentImg.forEach(function (val) {
                addTransparentImg(val.$el, val.altText);
            })
        });

        // for first selector that is generated compile time
        initMenuDropdownAccessibility($('.mc-dropdown-item'));

        initSkipLinks();
        customTooltip();
    });

    function initTripaneSearchAccessibility() {
        var $searchField = $("#search-field");
        var $searchSidebar = $("#search-field-sidebar");
        var $searchSubmit = $(".search-submit");

        tripaneSearchFrameSkip($searchField, function () { return $searchField.val(); }, "keyup");
        tripaneSearchFrameSkip($searchSidebar, function () { return $searchField.val(); }, "keyup");
        tripaneSearchFrameSkip($searchSubmit, function () { return $searchSubmit.val(); }, "click");
    }

    function initMenuDropdownAccessibility($item) {
        $item.on('keydown', function (e) {
            var $this = $(this);
            var $next;
            if (e.keyCode === KEYCODE_ARR_DOWN) {
                $next = $this.parent().next().children().first();
            } else if (e.keyCode === KEYCODE_ARR_UP) {
                $next = $this.parent().prev().children().first();
            }
            if ($next)
                $next.focus();
        })
    }

    function initTextEffectsAccessibility(context) {
        initDropDownAccessibility(context);
        initTogglerAccessibility(context);
        initExpandingAccessibility(context);
        initPopupAccessibility(context);
        initConceptLinkAccessibility(context);
    }

    function initTableAccessibility() {
        $("thead th").each(function () {
            if ((typeof $(this).attr("scope")) === "undefined") {
                $(this).attr("scope", "col");
            }
        });

        $("tbody th").each(function () {
            if ((typeof $(this).attr("scope")) === "undefined") {
                $(this).attr("scope", "row");
            }
        });
    }

    // initializes help system and runs helpSystemFunction after helpSystem is initialized
    function getHelpSystem(helpSystemFunction) {
        if (!helpSystemFunction) {
            // only runs rest of code if we actually need the help system
            return;
        }

        var pathToHelpSystem = $(document.documentElement).attr('data-mc-path-to-help-system');
        var helpSystemPath = "Data/HelpSystem.xml";

        if (pathToHelpSystem)
            helpSystemPath = pathToHelpSystem + helpSystemPath;

        if (MadCap.WebHelp && MadCap.WebHelp.HelpSystem) {
            MadCap.WebHelp.HelpSystem.LoadHelpSystem(helpSystemPath).done(function (helpSys) {
                helpSystem = helpSys;
                helpSystemFunction();
            });
        }
    }

    // appends transparent img to $el w/ alt=altText. if helpSystem isn't yet initialized, adds
    // object to array to inialize transparent image later
    function appendTransparentImg($el, altText) {
        if (helpSystem) {
            addTransparentImg($el, altText);
        } else {
            elsThatNeedTransparentImg.push({
                $el: $el,
                altText: altText
            });
        }
    }

    // appends transparent img to $el w/ altText. MUST be run after helpSystem is initialized, else
    // does nothing
    function addTransparentImg($el, altText) {
        if (helpSystem && transparentUrl) {
            var $transparentImg = $("<img></img>").attr({
                "src": transparentUrl,
                "alt": altText
            }).addClass("invisible-label"); //invisible-label pretty much makes it super small
            $el.append($transparentImg);
        } else {
            Console.error("Error: Tried to add transparentImg before helpSystem was initialized.")
        }
    }

    // total hack, but works. Put buttons before and after iframe in taborder to trap focus. Put one button within the other
    // in the HTML so that the focus box looks the same
    function initPopupTopicAccessibility($containerEl, $popupFrame, topicPopup) {
        var ariaLabel = getTopicCloseButtonLabel();

        var $closeButtonContainer = $("<span class='CloseTopicPopupButtonContainer'></span>");
        var $outerCloseButton = $("<button tabindex='1' class='CloseTopicPopupButton CloseTopicOuter' aria-label='" + ariaLabel + "'></button>");
        var $innerCloseButton = $("<button tabindex='3' class='CloseTopicPopupButton CloseTopicInner' aria-label='" + ariaLabel + "'>&#215;</button>");

        $outerCloseButton.on("focus", function () {
            $innerCloseButton.focus();
        });

        $innerCloseButton.on("click", function () {
            topicPopup.Close();
        }).on("keydown", function (e) {
            // if tab out of popup, refocus into the topic frame
            var key = e.keyCode || e.which;
            if (key == 9 && !e.shiftKey) {
                $popupFrame.focus();
            }
        });

        $outerCloseButton.append($innerCloseButton);
        $closeButtonContainer.append($outerCloseButton);
        $containerEl.prepend($closeButtonContainer);

        $popupFrame.attr('tabindex', '2');
        $popupFrame.focus();
        $popupFrame.on("load", function () {
            MadCap.Utilities.MessageBus.PostMessageRequest(this.contentWindow, "get-title", null, function (data) {
                var topicTitle = data[0];
                if (topicTitle) {
                    $innerCloseButton.attr("aria-label", getTopicCloseButtonLabel(topicTitle));
                }
            });
        });
    }

    function initConceptLinkAccessibility(context) {
        var $conceptLink = $(".conceptLink", context);
        makeAccessibleButton($conceptLink);
        $conceptLink.attr("aria-expanded", false);
    }

    function initDropDownAccessibility(context) {
        $(".MCDropDown", context).each(function () {
            var $root = $(this);
            var $head = $root.find('.MCDropDownHead > a').first();
            var $body = $root.find('.MCDropDownBody').first();

            setAriaControls($head, $body, "mc-dropdown-body");
            makeAccessibleButton($head);
        })
    }

    function initTogglerAccessibility(context) {
        $(".MCToggler", context).each(function () {
            var $toggler = $(this);
            var target = $toggler.attr("data-mc-targets");

            $toggler.attr({
                "aria-expanded": "false",
                "aria-controls": target
            });
            makeAccessibleButton($toggler);
            $('[data-mc-target-name="' + target + '"]').attr("id", target);
        });
    }

    function initExpandingAccessibility(context) {
        $(".MCExpanding", context).each(function () {
            var $root = $(this);
            var $head = $root.find('a.MCExpandingHead').first();
            var $body = $root.find('.MCExpandingBody').first();

            setAriaControls($head, $body, "mc-expanding");
            makeAccessibleButton($head);
        });
    }

    function initPopupAccessibility(context) {
        $(".MCTextPopup", context).each(function () {
            var $this = $(this);
            var $body = $this.parent().find(".MCTextPopupBody").first();
            var bodyId = MadCap.Utilities.GenerateRandomGUID();

            $body.attr({
                "role": "tooltip",
                "id": bodyId
            });
            $this.attr("data-aria-describedby", bodyId);

            makeAccessibleButton($this, function () {
                $this.focus();
                if ($body.is(":visible")) {
                    $this.trigger("mouseleave");
                } else {
                    $this.trigger("mouseenter");
                }
            })

            $this.on("focusout keydown", function (e) {
                var code = e.keyCode || e.which;
                if (code && code != KEYCODE_ESC) {
                    return;
                }
                $this.trigger("mouseleave");
            })
        })
    }

    function initTripaneSidebarAccessibility() {
        var $home = $("#home");
        var $tabs = $(".tab");

        makeAccessibleButton($home);

        $tabs.each(function () {
            var $tab = $(this);
            var $tabButton = $tab.find("li").first();
            var $tabBody = $tab.find(".tabs-panel");

            setAriaControls($tabButton, $tabBody, "tripane-side-tab");
            $tabButton.attr("aria-expanded", "false");
            makeAccessibleButton($tabButton);
        });

        $("#sidebarButton").on("click", function () {
            var $navigation = $('#navigation');
            var tabIndex = (($navigation.is(":hidden")) ? "-1" : "0");
            $navigation.attr("tabindex", tabIndex).focus();
            $home.attr("tabindex", tabIndex);
            $(".tab > ul > li").attr("tabindex", tabIndex);
        });

        handleNavExpand($('#sidebarButton'));
    }

    function initExpandCollapseAccessibility() {
        var $button = $('.expand-all-button');

        if ($button.length === 0)
            return;

        var isComponent = $button.parents('.mc-component').length > 0;
        var expandAllText = getAltText("ToolbarItem.ExpandAll", isComponent, "TopicToolbar");
        var collapseAllText = getAltText("ToolbarItem.CollapseAll", isComponent, "TopicToolbar");
        $button.children('img').attr("alt", expandAllText);

        $button.on('click', function () {
            var $img = $(this).children('img');
            var newAlt = $img.attr('alt') === expandAllText ? collapseAllText : expandAllText;
            $img.attr('alt', newAlt);
        });
    }

    function nonTripaneSkipToContent() {
        var $skip = $(".skip-to-content");
        $skip.attr("href", "#mc-main-content");

        $skip.on('focusin', function () {
            var topOffset = "-" + $skip.parent().css("padding-top");
            $skip.css('top', topOffset);
        }).on('focusout', function () {
            $skip.css('top', '');
        });
    }

    function triPaneSkipToContent() {
        $(".skip-to-content").on('click', function (e) {
            e.preventDefault();

            var $mainContent = $("#topic");
            if ($mainContent.css("display") == "none")
                $mainContent = $("#results-heading");
            else if (MadCap.Utilities.IsIE()) {
                tripaneTopicFrameSkipHandler($("title").text());
                return;
            }

            makeTempFocusableAndFocus($mainContent);
        });
    }

    function disallowLinkHiddenByNav() {
        var $titlebar = $(".title-bar.sticky");
        if ($titlebar.length > 0) {
            $('.body-container a').on("focus", function (e) {
                var $this = $(this);

                var topOffset = $this.offset().top;
                var titleBarBottom = $titlebar.offset().top + $titlebar.outerHeight();

                if (topOffset < titleBarBottom) {
                    window.scrollTo({
                        top: topOffset - ($titlebar.outerHeight() + 20),
                        behavior: "smooth"
                    });
                }
            });
        }
    }

    function makeAccessibleButton($selector, onClickFunction) {
        $selector.attr("role", "button");

        if (!$selector.is("a") || $selector.attr("href") === undefined)
            $selector.attr("tabindex", 0);

        if (onClickFunction) {
            $selector.on("click", function (e) {
                e.preventDefault();
                onClickFunction();
            })
        }

        $selector.on("keydown", function (e) {
            var code = e.keyCode || e.which;
            if (code == KEYCODE_ENTER || code == KEYCODE_SPACE) {
                e.preventDefault();
                $(this).click();
            }
        })
    }

    function makeAccessibleMCSlideshow(context) {
        appendTransparentImg($('.mc-prev', context), "previous");
        appendTransparentImg($('.mc-next', context), "next");
        makeAccessibleButton($('.mc-prev, .mc-next, .mc-stop, .mc-start, .mc-pager-link', context));
    }

    function customTooltip($selector) {
        // default to selecting everything
        if ($selector === undefined)
            $selector = $("[title]:not(.MCSlide)");

        $selector.on("mouseover focusin", function (e) {
            var $this = $(this);
            var title = $this.attr('title');
            if (!title) return;

            $this.data('data-title', title).removeAttr('title');

            var $tooltip = $('<p class="tooltip"></p>')
                .text(title)
                .appendTo('body')
                .css({
                    display: "none"
                });

            placeAndShowTooltip($tooltip, $this, e);
        }).on("mouseleave focusout", function () {
            var $this = $(this);
            var currentState = $this.attr("data-current-state");
            var title = currentState ? $this.attr("data-state" + currentState + "-title") : $this.data('data-title');

            // BUG #131920 - set timeout because JAWS cursor moves slower than browser focus 
            // so w/o timeout JAWS is reading the title as it is being reset to the original element
            // and 50ms seems to be a good time where JAWS stops reading (where less JAWS reads the title sometimes)
            setTimeout(function () {
                $this.attr('title', title);
            }, 50);
            $('.tooltip').remove();
        });
    }

    function placeAndShowTooltip($tooltip, $element, event) {
        // if image map, move tooltip as if it were for the image
        if ($element.parent() && $element.parent().is("map")) {
            $element = $('[usemap="#' + $element.parent().attr("id") + '"]');
        }

        if (event.type == "mouseover")
            placeAndShowMouseTooltip($tooltip, $element, event);
        else
            placeAndShowFocusTooltip($tooltip, $element);
    }

    function placeAndShowMouseTooltip($tooltip, $element, originalEvent) {
        // keeps track of mouse location until timer is up at 350ms
        var lastMouseEvent = originalEvent;

        setTimeout(function () {
            $element.unbind("mousemove");
            applyCoordinates();
            $tooltip.fadeIn(250);
        }, 350);

        $element.on("mousemove", function (event) {
            lastMouseEvent = event;
        });

        function applyCoordinates() {
            var POINTER_SIZE = 16;
            var xco = lastMouseEvent.pageX;
            var yco = lastMouseEvent.pageY + POINTER_SIZE;

            function flipX() {
                return xco - $tooltip.outerWidth();
            }

            function flipY() {
                return yco - POINTER_SIZE * 2;
            }

            applyCoordinatesToTooltip($tooltip, xco, yco, flipX, flipY);
        }
    }

    function placeAndShowFocusTooltip($tooltip, $element) {
        var xco = $element.offset().left;
        var yco = $element.offset().top + $element.outerHeight() - 5;

        function flipX() {
            return xco - ($tooltip.outerWidth() - $element.outerWidth());
        }

        function flipY() {
            return $element.offset().top - $tooltip.outerHeight() - 15;
        }

        applyCoordinatesToTooltip($tooltip, xco, yco, flipX, flipY);
        $tooltip.fadeIn(250);
    }

    function applyCoordinatesToTooltip($tooltip, xco, yco, flipXFunc, flipYFunc) {
        var tooltipBot = yco + $tooltip.outerHeight();
        var tooltipRight = xco + $tooltip.outerWidth();

        var $window = $(window);
        var viewBot = $window.scrollTop() + $window.height();

        if (tooltipBot > viewBot) {
            yco = flipYFunc();
        }

        if (tooltipRight > $window.width()) {
            xco = flipXFunc();
        }

        $tooltip.css({
            left: xco,
            top: yco
        });
    }

    function handleNavExpand($button) {
        $button.on('click', function () {

            $this = $(this);
            if ($this.attr('aria-expanded') === "true") {
                $this.attr('aria-expanded', 'false');
                $("#navigation").focus();
            } else {
                $this.attr('aria-expanded', 'true');
            }
        });
    }

    function setAriaControls($controller, $controlled, startingString) {
        var random = MadCap.Utilities.GenerateRandomGUID();
        var id = startingString ? startingString + random : random;
        $controller.attr("aria-controls", id);
        $controlled.attr("id", id);
    }

    function initSkipLinks() {
        $("a[href^='#']").on("click", function () {
            var sectionName = $(this).attr("href").slice(1);
            if (sectionName === "" || sectionName === "!") return;

            var $el = $("#" + sectionName);
            if (!$el.attr("tabindex")) {
                makeTempFocusable($el);
            }
            $el.focus();
        });
    }

    // moves focus to the iframe after clicking on TOC
    function tripaneTopicFrameSkip($a, topicTitle) {
        $a.on("click", function () {
            tripaneTopicFrameSkipHandler(topicTitle);
        });
    }

    // actually skips to an element right next to the iframe so that
    // iframe page has time to load / IE compatibility + the next 
    // thing that JAWS reads is the iframe content.
    function tripaneTopicFrameSkipHandler(topicTitle) {
        var $title = $("#tripane-iframe-title");
        $title.attr({
            'tabindex': '-1',
            'aria-hidden': 'false'
        });
        $title.text(getTopicFrameDescriptionLabel(topicTitle));
        $title.focus();
    }

    function tripaneSearchFrameSkip($el, getQueryFunction, event) {
        var $title = $("#tripane-iframe-title");
        $el.on(event, function (e) {
            if (e.type === "keyup" && e.keyCode !== KEYCODE_ENTER)
                return;

            $title.attr({
                'tabindex': '-1',
                'aria-hidden': 'false'
            });
            $title.text(getSearchFrameDescriptionLabel(getQueryFunction()))
            $title.focus();
        });
    }

    function tripaneGlossarySkip($a, title) {
        $a.attr("aria-label", getGlossarySkipLabel(title));
        $a.removeAttr('role');

        $a.on('blur', function () {
            $a.removeAttr('aria-label');
        });

        tripaneTopicFrameSkip($a, "Topic with" + title);
    }

    function initTopNavMenuButtons(parent, toc_obj, $siblingLink, nodeDepth) {
        var $expandButton = $("<button class='topnav-expand showOnFocus'/>");

        // top level menu vs submenus
        if (nodeDepth == 2) {
            $expandButton.html("&raquo;");
            $expandButton.addClass('topnav-expand-toplevel');
        }
        else if (nodeDepth > 2)
            $expandButton.addClass('topnav-expand-submenu');

        $(parent).append($expandButton);
        $expandButton.attr({
            "aria-label": $siblingLink.text(),
            "aria-expanded": "false",
            "aria-haspopup": "true"
        });

        $expandButton[0].hasExpanded = false;

        $expandButton.on('click', function (e) {
            e.preventDefault();
            var $current = $(this);
            toc_obj.TreeNode_Expand(e);

            if (!this.hasExpanded) {
                setTimeout(function () {
                    accessibleExpandSubMenu($current);
                }, 100);

                this.hasExpanded = true;
            } else {
                accessibleExpandSubMenu($current);
            }
        }).on('keyup', function (e) {
            if (e.keyCode == KEYCODE_ESC) {
                $expandButton.siblings('.sub-menu').removeClass('focus-within-expanded');
                $expandButton.attr('aria-expanded', false);
            }
        });
    }

    function makeTempFocusable($el) {
        $el.attr('tabindex', '-1');
        $el.one("focusout blur", function () {
            $(this).removeAttr('tabindex');
        });
        return $el;
    }

    function assureMainContent() {
        var $main = $("#mc-main-content");
        if ($main.length === 0)
            $main = $("[role='main']");
        if ($main.length === 0)
            $main = $("main");
        if ($main.length === 0)
            $main = $("body");

        $main.attr({
            "id": "mc-main-content",
            "role": "main"
        });

        return $main;
    }

    function makeTempFocusableAndFocus($el) {
        makeTempFocusable($el);
        $el.focus();
    }

    function accessibleExpandSubMenu($expandButton) {
        $expandButton.siblings('.sub-menu').addClass('focus-within-expanded')
        $expandButton.attr('aria-expanded', true);
    }

    function initTopNavSubmenuAccessibility($parent, $submenu) {
        var $expandButton = $parent.children(".topnav-expand").attr("aria-expanded", "true");
        setAriaControls($expandButton, $submenu, "topnav-submenu");

        $submenu.find("a, button").focus(function () {
            var $superSubMenus = $(this).parents('.sub-menu');
            $superSubMenus.addClass("focus-within-expanded");
            $superSubMenus.siblings("button").attr("aria-expanded", "true");
        }).focusout(function () {
            $(this).parents('.sub-menu').removeClass("focus-within-expanded");
            $(this).siblings('.sub-menu').removeClass("focus-within-expanded");
            $parent.trigger("mouseleave");
        }).on('keydown', function (e) {
            // close submenu on pressing "escape"
            if (e.keyCode == KEYCODE_ESC) {
                e.stopImmediatePropagation();
                $expandButton.focus();
            }
        });
    }

    function getAltText(elementName, isComponent, componentName) {
        return helpSystem.GetLanguageString(elementName, isComponent, componentName, "AltText");
    }

    function getAccessibilityLabel(elementName, isComponent, componentName) {
        return helpSystem.GetLanguageString(elementName, isComponent, componentName, "Accessibility Label");
    }

    function getGlossarySkipLabel(title) {
        return makeAccessibilityLabel("Navigation Panel Item Definition", title, "title");
    }

    function getTopicCloseButtonLabel(title) {
        return makeAccessibilityLabel("Topic Popup Close Button", title, "title");
    }

    function getPulseLabel() {
        return getAccessibilityLabel("Pulse Frame");
    }

    function getElasticSearchHistoryLabel(term, element) {
        var isComponent = $(element).parents('.mc-component').length > 0;
        return makeAccessibilityLabel("Search Auto-complete Item.Search History", term, "term", isComponent, "SearchBar");
    }

    function getElasticSearchContentLabel(title, element) {
        var isComponent = $(element).parents('.mc-component').length > 0;
        return makeAccessibilityLabel("Search Auto-complete Item.Project Content", title, "title", isComponent, "SearchBar");
    }

    function getTopicFrameDescriptionLabel(title) {
        return makeAccessibilityLabel("Topic Frame Description", title, "topic title");
    }

    function getSearchFrameDescriptionLabel(query) {
        return makeAccessibilityLabel("Search Frame Description", query, "query");
    }

    function makeAccessibilityLabel(elementName, insertTerm, splitTerm, isComponent, componentName) {
        var label = getAccessibilityLabel(elementName, isComponent, componentName);
        if (label) {
            var split = label.split("{" + splitTerm + "}");
            if (split.length === 2)
                return split[0] + (insertTerm ? insertTerm : "") + split[1];
        }
        return label;
    }
})();