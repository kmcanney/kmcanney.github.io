
/*!
 * Copyright MadCap Software
 * http://www.madcapsoftware.com/
 * Unlicensed use is strictly prohibited
 *
 * v18.1.8353.25537
 */

/* Due HTML Help targets support micro content skins, this script file should be compatible with IE browser. */

var isSkinPreview;

(function () {

    var isTriPane;
    var _isTopicPreview;

    // In HTML Help targets MadCap.Utilities might be undefined
    if (MadCap.Utilities) {
        isSkinPreview = MadCap.Utilities.HasRuntimeFileType("SkinPreview");
        isTriPane = MadCap.Utilities.HasRuntimeFileType("TriPane");
    }

    MadCap.MicroContentHelper = MadCap.CreateNamespace("MicroContentHelper");
    $.extend(MadCap.MicroContentHelper, {
        ApplyMicroContentViewMode: function (viewMode, containerSelector) {
            var $container = $(containerSelector);
            SetViewMode($container, viewMode);

            $container.each(function () {
                MadCap.MicroContentHelper.InitContainer($(this));
            });
        },

        AdjustMicroContentContainers: function () {
            var $cards = $('.knowledge-panel-container');
            if ($cards.length) {
                var $x = $('#knowledge-panel');
                var $y = $('#knowledge-panel-middle');
                if ($cards.parent()[0] !== $x[0] && $x.css('display') !== 'none')
                    $cards.appendTo($x);
                else if ($cards.parent()[0] !== $y[0] && $y.css('display') !== 'none')
                    $cards.appendTo($y);
            }

            AdjustTruncatedCardsOnLayoutChange();
        },

        BuildCard: function (microContent, previewStylesTable, linkPrefix, viewMode) {
            var $div = $('<div>').addClass("micro-content");
            if (isSkinPreview && isTriPane)
                MadCap.SkinHelper.SetSkinPreviewStyle($div[0], previewStylesTable["card"]);
            
            var hasDropDown = isSkinPreview || viewMode === 'DropDown';
            var hasExpandButton = isSkinPreview || viewMode === 'Truncated';

            var $divPhrase = $('<div>').addClass("micro-content-phrase").appendTo($div);
            var $spanPhrase = $('<span>').text(microContent.phrases[0]).appendTo($divPhrase);
            if (isSkinPreview && isTriPane)
                MadCap.SkinHelper.SetSkinPreviewStyle($spanPhrase[0], previewStylesTable["phrase"]);

            var $divResponse = $('<div>').addClass("micro-response").appendTo($div);
            if (isSkinPreview && isTriPane)
                MadCap.SkinHelper.SetSkinPreviewStyle($divResponse[0], previewStylesTable["response"]);

            $(microContent.html).appendTo($divResponse);

            if (hasDropDown) {
                $('<button>').text('\xa0').addClass("micro-content-drop-down-button").insertBefore($spanPhrase);
            }

            if (hasExpandButton) {
                var $divTruncateTransitionWrapper = $('<div>').addClass("micro-content-expand-transition-wrapper").appendTo($div);
                var $divTruncateTransition = $('<div>').addClass("micro-content-expand-transition").appendTo($divTruncateTransitionWrapper);
                if (isSkinPreview && isTriPane)
                    MadCap.SkinHelper.SetSkinPreviewStyle($divTruncateTransition[0], previewStylesTable["truncated-fade"]);

                $('<button>').addClass("micro-content-expand").appendTo($div);
            }

            if (microContent.source) { // micro content related topic link
                var topicHref = linkPrefix + microContent.source;

                var $divTopicTitle = $('<div>').addClass('micro-response-title').appendTo($div);
                if (isSkinPreview && isTriPane)
                    MadCap.SkinHelper.SetSkinPreviewStyle($divTopicTitle[0], previewStylesTable["link"]);
                $('<a>').attr("href", topicHref).text(microContent.sourceTitle).appendTo($divTopicTitle);

                var $divUrl = $('<div>').addClass('micro-response-url').appendTo($div);
                if (isSkinPreview && isTriPane)
                    MadCap.SkinHelper.SetSkinPreviewStyle($divUrl[0], previewStylesTable["path"]);
                $('<cite>').addClass('').text(microContent.source).appendTo($divUrl);
            }

            return $div;
        },

        BuildContainer: function (viewMode, additionalContainerClass) {
            var $container = $('<div>').addClass("micro-content-container");

            if (viewMode === 'DropDown') {
                $container.addClass('micro-content-drop-down-mode');
            } else {
                $container.addClass('micro-content-optional-phrase');
                if (viewMode === 'Truncated')
                    $container.addClass('micro-content-truncated-mode');
            }

            if (additionalContainerClass) {
                $container.addClass(additionalContainerClass); // e.g. "featured-snippets-container"
            }
            return $container;
        },

        InitCard: function ($microContent) {
            var $divResponse = $microContent.children('.micro-response');
            MadCap.Utilities.InitContent($divResponse[0]);
            MadCap.Accessibility.initTextEffectsAccessibility($microContent);

            // add copy code handlers
            $microContent.find(".codeSnippetCopyButton").on('click', function (e) {
                e.preventDefault();
                MadCap.Utilities.CopyToClipboard($('code', $(this).parents(".codeSnippet")));
            });
        },

        // Update base collection of stylesheets with new stylesheets.
        JoinDynamicStylesheets: function (base, stylesheets) {
            if (!stylesheets || !stylesheets.length) return;

            var i, stylesheet;
            for (i = 0; i < stylesheets.length; i++) {
                stylesheet = new MadCap.Utilities.Url(stylesheets[i]);
                if (MadCap.String.StartsWith(stylesheet.Extension, "micro-response")) {
                    // "<Path>/Topic.micro-content.css.micro-response-1406689283"
                    stylesheet = stylesheet.ToFolder().AddFile(stylesheet.Name);
                }
                if (stylesheet.IsRootRelative)
                    stylesheet = new MadCap.Utilities.Url('.').CombinePath(stylesheet.FullPath);
                base.push(stylesheet.FullPath);
            }
        },

        // Add classes to the child element <div class="micro-response"...
        UpdateResponseClasses: function ($microContent, stylesheets, enableMicroContentStylesheets) {
            if (!stylesheets || !stylesheets.length) return;

            var $response = $microContent.children(".micro-response");

            var i, name, stylesheet, extension;
            for (i = 0; i < stylesheets.length; i++) {
                stylesheet = new MadCap.Utilities.Url(stylesheets[i]);
                name = stylesheet.Name;
                extension = stylesheet.Extension;
                
                if (MadCap.String.StartsWith(name,"micro-response")) {
                    if (enableMicroContentStylesheets) {
                        // "<Path>/micro-response1307366865.css"
                        $response.addClass(name);
                    }
                    continue;
                }                
                if (MadCap.String.StartsWith(extension, "micro-response")) {
                    // "<Path>/Topic.micro-content.css.micro-response-1406689283"
                    $response.addClass(extension);
                    continue;
                }
                // "<Path>/TableStyle.css"
                $response.addClass(extension);
            }
        },

        PopulateContainer: function ($container, viewMode, data, linkPrefix, dynamicStylesheets) {
            var previewStylesTable = MicroContentProxyPreviewStyles;
            if (isSkinPreview && isTriPane) {
                if ($container.hasClass('featured-snippets-container')) {
                    previewStylesTable = FeaturedSnippetsPreviewStyles;
                } else if ($container.hasClass('knowledge-panel-container')) {
                    previewStylesTable = KnowledgePanelPreviewStyles;
                }
            }
            var i, $microContent;
            var enableMicroContentStylesheets = !($container.attr('data-mc-disable-micro-content-stylesheets') > '');
            for (i = 0; i < data.length; i += 1) {
                $microContent = MadCap.MicroContentHelper.BuildCard(data[i], previewStylesTable, linkPrefix, viewMode).
                    appendTo($container);
                MadCap.MicroContentHelper.InitCard($microContent);
                MadCap.MicroContentHelper.UpdateResponseClasses($microContent, data[i].stylesheets, enableMicroContentStylesheets);
                MadCap.MicroContentHelper.JoinDynamicStylesheets(dynamicStylesheets, data[i].stylesheets);
            }            
        },

        // For dynamic content consider calling this method after a small delay.
        // To setup truncated cards the scrollHeight property is used and without delay scrollHeight
        // can return wrong values in Chrome if micro content ends with an image.
        InitContainer: function ($container) {
            var previewStylesTable = MicroContentProxyPreviewStyles;
            if (isSkinPreview && isTriPane) {
                if ($container.hasClass('featured-snippets-container')) {
                    previewStylesTable = FeaturedSnippetsPreviewStyles;
                } else if ($container.hasClass('knowledge-panel-container')) {
                    previewStylesTable = KnowledgePanelPreviewStyles;
                }
            }

            if ($container.hasClass('micro-content-drop-down-mode')) {
                $container.children(".micro-content").each(function () {
                    InitDropDownCard($(this), previewStylesTable);
                });
            } else if ($container.hasClass('micro-content-truncated-mode')) {
                $container.children(".micro-content").each(function () {
                    InitTruncatedCard($(this), previewStylesTable);
                });
            }
        },

        // Expands or collapses micro content items with drop-down mode
        ExpandAll: function (swapType) {
            $('.micro-content-drop-down-button').each(function () {
                var collapsed = $(this).closest('.micro-content').hasClass('micro-content-collapsed');
                if (swapType === "open" && collapsed || swapType === "close" && !collapsed)
                    $(this).click();
            });
        }
    });

    $.extend(MadCap.SkinHelper, {
        ApplyMicroContentSkin: function (skin) {
            if (!skin || !skin.SkinOptions) return;

            var viewMode;
            if (skin.SkinOptions.MicroContentViewMode) {
                viewMode = skin.SkinOptions.MicroContentViewMode;
                $('.micro-content-proxy').attr('data-mc-micro-content-view-mode', viewMode);
                MadCap.MicroContentHelper.ApplyMicroContentViewMode(viewMode, '.micro-content-proxy');
            }

            if (skin.SkinOptions.FeaturedSnippetsViewMode) {
                viewMode = skin.SkinOptions.FeaturedSnippetsViewMode;
                $('#searchPane').attr('data-mc-featured-snippets-view-mode', viewMode);
                MadCap.MicroContentHelper.ApplyMicroContentViewMode(viewMode, '.featured-snippets-container');
            }

            if (skin.SkinOptions.KnowledgePanelViewMode) {
                viewMode = skin.SkinOptions.KnowledgePanelViewMode;
                $('#searchPane').attr('data-mc-knowledge-panel-view-mode', viewMode);
                MadCap.MicroContentHelper.ApplyMicroContentViewMode(viewMode, '.knowledge-panel-container');
            }

            if (skin.SkinOptions.FAQProxyViewMode) {
                viewMode = skin.SkinOptions.FAQProxyViewMode;
                $('.micro-content-proxy.faq').attr('data-mc-micro-content-view-mode', viewMode);
                MadCap.MicroContentHelper.ApplyMicroContentViewMode(viewMode, '.micro-content-proxy.faq');
            }

            if (skin.SkinOptions.KnowledgeProxyViewMode) {
                viewMode = skin.SkinOptions.KnowledgeProxyViewMode;
                $('.micro-content-proxy.knowledge').attr('data-mc-micro-content-view-mode', viewMode);
                MadCap.MicroContentHelper.ApplyMicroContentViewMode(viewMode, '.micro-content-proxy.knowledge');
            }

            if (skin.SkinOptions.PromotionProxyViewMode) {
                viewMode = skin.SkinOptions.PromotionProxyViewMode;
                $('.micro-content-proxy.promotion').attr('data-mc-micro-content-view-mode', viewMode);
                MadCap.MicroContentHelper.ApplyMicroContentViewMode(viewMode, '.micro-content-proxy.promotion');
            }            
        }
    });

    $(InitMicroContentProxies);

    // Styles used by the Highlight feature of the Skin Editor
    var FeaturedSnippetsPreviewStyles = {
        "card": "Search Micro Content Result",
        "phrase": "Search Micro Content Phrase",
        "response": "Search Micro Content Response",
        "link": "Search Micro Content Response Link",
        "path": "Search Micro Content Response Path",
        "drop-down-collapsed": "Search Micro Content Drop-Down Expand",
        "drop-down-expanded": "Search Micro Content Drop-Down Collapse",
        "truncated-collapsed": "Search Micro Content Response Expand",
        "truncated-expanded": "Search Micro Content Response Collapse",
        "truncated-fade": "Search Micro Content Response Fade"
    };
    var KnowledgePanelPreviewStyles = {
        "card": "Knowledge Panel Result",
        "phrase": "Knowledge Panel Phrase",
        "response": "Knowledge Panel Response",
        "link": "Knowledge Panel Response Link",
        "path": "Knowledge Panel Response Path",
        "drop-down-collapsed": "Knowledge Panel Drop-Down Expand",
        "drop-down-expanded": "Knowledge Panel Drop-Down Collapse",
        "truncated-collapsed": "Knowledge Panel Truncated Response Expand",
        "truncated-expanded": "Knowledge Panel Truncated Response Collapse",
        "truncated-fade": "Knowledge Panel Truncated Response Fade"
    };
    var MicroContentProxyPreviewStyles = {
        "card": "Item",
        "phrase": "Phrase",
        "response": "Response",
        "link": "Response Link",
        "path": "Response Path",
        "drop-down-collapsed": "Drop-Down Expand",
        "drop-down-expanded": "Drop-Down Collapse",
        "truncated-collapsed": "Truncated Response Expand",
        "truncated-expanded": "Truncated Response Collapse",
        "truncated-fade": "Truncated Response Fade"
    };

    function InitMicroContentProxies() {
        _isTopicPreview = $("html").attr("data-mc-in-preview-mode") === "true";
        InitFaqProxies();
        InitKnowledgeProxies();
        InitPromotionProxies();
    }

    function InitDropDownCard($card, previewStylesTable) {
        var $button = $('.micro-content-drop-down-button', $card);
        if ($button.length !== 1) return;

        $card.addClass('micro-content-collapsed');
        if (isSkinPreview && isTriPane)
            MadCap.SkinHelper.SetSkinPreviewStyle($button[0], previewStylesTable["drop-down-collapsed"]);

        // use whole phrase to collapse and expand drop-down
        var $phrase = $button.closest('.micro-content-phrase');
        $phrase.off("click");
        $phrase.click(function () {
            $card.toggleClass('micro-content-collapsed micro-content-expanded');
            if (isSkinPreview && isTriPane) {
                if ($card.hasClass('micro-content-collapsed'))
                    MadCap.SkinHelper.SetSkinPreviewStyle($button[0], previewStylesTable["drop-down-collapsed"]);
                else
                    MadCap.SkinHelper.SetSkinPreviewStyle($button[0], previewStylesTable["drop-down-expanded"]);
            }
        });
    }

    function InitTruncatedCard($card, previewStylesTable) {
        var $response = $card.children('.micro-response');
        var x = $response.css('max-height');
        var maxHeight = parseFloat(x);

        // x will be a value in pixels except for percents; from user's perspective
        // value in percents doesn't make much sense, so treat it as none
        if (isNaN(maxHeight) || x[x.length - 1] === '%')
            $card.attr('data-mc-truncated-mode-max-height', 'none');
        else
            $card.attr('data-mc-truncated-mode-max-height', maxHeight);

        SetupExpandButton($card, previewStylesTable);
        HideShowExpandButton($card);
    }

    function AdjustTruncatedCardsOnLayoutChange() {
        $('.micro-content-truncated-mode').each(function () {
            var $container = $(this);

            // on layout changes we have to update cards that are in the truncated
            // mode: their appearance depends on height of the content and value of the
            // max-height property which itself depends on the current medium
            $container.children(".micro-content").each(function () {
                var $card = $(this);
                // ensure that the card was initialized
                if ($card.attr('data-mc-truncated-mode-max-height') === undefined)
                    return;

                UpdateMaxHeightAttr($card);
                HideShowExpandButton($card);
            });
        });
    }

    function UpdateMaxHeightAttr($card) {
        var $response = $card.children('.micro-response');

        var x = $response.css('max-height');
        var maxHeight = parseFloat(x);

        // if card is collapsed then value of the max-height property is not overridden
        // otherwise value can be overridden
        if (!$card.hasClass('micro-content-collapsed')) {
            $response.css('max-height', '');
            x = $response.css('max-height');
            $response.css('max-height', 'none');
            maxHeight = parseFloat(x);
        }

        if (isNaN(maxHeight) || x[x.length - 1] === '%')
            $card.attr('data-mc-truncated-mode-max-height', 'none');
        else
            $card.attr('data-mc-truncated-mode-max-height', maxHeight);
    }

    function HideShowExpandButton($card) {
        var x = $card.attr('data-mc-truncated-mode-max-height');
        var maxHeight = parseFloat(x);

        var $response = $card.children('.micro-response');
        var $button = $card.children('.micro-content-expand');
        var $transition = $('.micro-content-expand-transition', $card);

        var scrollHeight = $response.prop('scrollHeight');
        // if button was visible then the scrollHeight couldn't be zero; and if it is
        // then this event can be ignored because the proper event is coming later
        if (scrollHeight === 0 && $button.css('display') !== 'none')
            return;

        if (isNaN(maxHeight) || scrollHeight < maxHeight) {
            $response.css('max-height', 'none');
            $card.removeClass('micro-content-collapsed').addClass('micro-content-expanded');
            $button.hide();
            $transition.hide();
            return;
        }

        if ($button.css('display') !== 'none')
            return;

        $response.css('max-height', '');
        $card.addClass('micro-content-collapsed').removeClass('micro-content-expanded');
        $button.show();
        $transition.show();
    }

    function SetupExpandButton($card, previewStylesTable) {
        var $button = $card.children('.micro-content-expand');
        var $response = $card.children('.micro-response');
        var $transition = $('.micro-content-expand-transition', $card);

        var collapsedClassName = 'micro-content-collapsed';
        var expandedClassName = 'micro-content-expanded';
        $card.addClass(collapsedClassName).removeClass(expandedClassName);
        if (isSkinPreview && isTriPane)
            MadCap.SkinHelper.SetSkinPreviewStyle($button[0], previewStylesTable["truncated-collapsed"]);

        $button.off("click");
        $button.click(function () {
            var scrollHeight = $response.prop('scrollHeight');
            var maxHeight = parseFloat($card.attr('data-mc-truncated-mode-max-height'));

            $card.toggleClass(collapsedClassName).toggleClass(expandedClassName);
            if ($card.hasClass(collapsedClassName)) {
                $response.css('max-height', scrollHeight);
                $response.animate({ 'max-height': maxHeight }, function () {
                    $response.css('max-height', '');
                });
                $transition.show();
                if (isSkinPreview && isTriPane)
                    MadCap.SkinHelper.SetSkinPreviewStyle($button[0], previewStylesTable["truncated-collapsed"]);
            } else {
                $transition.hide();
                $response.animate({ 'max-height': scrollHeight }, function () {
                    $response.css('max-height', 'none');
                });
                if (isSkinPreview && isTriPane)
                    MadCap.SkinHelper.SetSkinPreviewStyle($button[0], previewStylesTable["truncated-expanded"]);
            }
        });
    }

    function InitFaqProxies() {
        if (MadCap.WebHelp && MadCap.WebHelp.HelpSystem) {
            MadCap.WebHelp.HelpSystem.LoadHelpSystemDefault().done(function (helpSystem) {

                // get default view mode from the skin
                var currentSkin = helpSystem.GetCurrentSkin();
                var defaultViewMode;
                if (currentSkin && currentSkin.ProxyOptions) {
                    defaultViewMode = currentSkin.ProxyOptions.FAQProxyViewMode;
                }

                $('.faq-proxy-container').each(function () {
                    var $container = $(this);
                    $container.removeClass('faq-proxy-container');
                    $container.addClass('micro-content-container');


                    var viewMode = $container.attr('data-mc-micro-content-view-mode');
                    if (!viewMode) viewMode = defaultViewMode;

                    SetViewMode($container, viewMode);
                    MadCap.MicroContentHelper.InitContainer($container);
                });
            });
        }
    }

    function InitKnowledgeProxies() {
        if (MadCap.WebHelp && MadCap.WebHelp.HelpSystem) {
            MadCap.WebHelp.HelpSystem.LoadHelpSystemDefault().done(function (helpSystem) {

                // get default view mode from the skin
                var currentSkin = helpSystem.GetCurrentSkin();
                var defaultViewMode;
                if (currentSkin && currentSkin.ProxyOptions) {
                    defaultViewMode = currentSkin.ProxyOptions.KnowledgeProxyViewMode;
                }

                $('.knowledge-proxy-container').each(function () {
                    var $proxyContainer = $(this);
                    $proxyContainer.removeClass('knowledge-proxy-container');
                    $proxyContainer.addClass('micro-content-container');

                    if (_isTopicPreview) {
                        var proxyTitle = $proxyContainer.attr('data-mc-proxy-title');
                        if (proxyTitle)
                            $('<h3>').text(proxyTitle).appendTo($proxyContainer);
                        return;
                    }

                    var searchQuery = GetProxySearchQuery($proxyContainer);
                    if (!searchQuery) {
                        $proxyContainer.remove();
                        return;
                    }

                    var scopeID = $proxyContainer.attr('data-mc-scope-id');
                    var resultsLimit = parseInt($proxyContainer.attr('data-mc-results-limit'));

                    MadCap.SearchHelper
                        .DoMicroContentSearch($proxyContainer, scopeID, resultsLimit, false, searchQuery)
                        .then(function(results) {
                            if (results && results.microContent && results.microContent.length > 0) {
                                var viewMode = $proxyContainer.attr('data-mc-micro-content-view-mode');
                                if (!viewMode) viewMode = defaultViewMode;
                                SetViewMode($proxyContainer, viewMode);

                                var proxyTitle = $proxyContainer.attr('data-mc-proxy-title');
                                if (proxyTitle)
                                    $('<div>').addClass("proxy-title").text(proxyTitle).appendTo($proxyContainer);

                                BuildMicroContentProxyResult($proxyContainer, results.microContent, viewMode);
                            } else {
                                $proxyContainer.remove();
                            }
                        });
                });
            });
        }
    }

    function GetProxySearchQuery($proxyContainer) {
        var queryType = $proxyContainer.attr('data-mc-query-type');
        switch (queryType) {
            case "NotSet":
                return "*";
            case "SearchQuery":
                var url = MadCap.Utilities.Url.GetDocumentUrl();
                var searchQuery = url.QueryMap.GetItem("q");
                return searchQuery;
            case "TopicTitle":
                var title = $('title').text();
                return title;
            case "StaticString":
                var staticString = $proxyContainer.attr('data-mc-query-source');
                return staticString;
            case "MetaTagValue":
                var metaTagName = $proxyContainer.attr('data-mc-query-source');
                // join all meta tags with comma and replace CR LF with spaces
                var rawQuery = $('meta[name="' + metaTagName + '"]').map(function() {
                    return $(this).attr('content');
                }).get().join(',').replace(new RegExp('\r', 'g'), ' ').replace(new RegExp('\n', 'g'), ' ');
                // split query by comma and remove empty items
                var parts = rawQuery.split(',').filter(function (x) {
                    x = MadCap.String.Trim(x || '');
                    return !MadCap.String.IsNullOrEmpty(x);
                });
                // combine all parts as '(query1) OR (query2) ...'
                // it works with both MadCap and Elastic Search
                return parts.map(function(item) {
                    return '(' + item + ')';
                }).join(' OR ');
        }
    }

    function InitPromotionProxies() {
        if (MadCap.WebHelp && MadCap.WebHelp.HelpSystem) {
            MadCap.WebHelp.HelpSystem.LoadHelpSystemDefault().done(function (helpSystem) {

                // get default view mode from the skin
                var currentSkin = helpSystem.GetCurrentSkin();
                var defaultViewMode;
                if (currentSkin && currentSkin.ProxyOptions) {
                    defaultViewMode = currentSkin.ProxyOptions.PromotionProxyViewMode;
                }

                $('.promotion-proxy-container').each(function () {
                    var $proxyContainer = $(this);
                    $proxyContainer.removeClass('promotion-proxy-container');
                    $proxyContainer.addClass('micro-content-container');

                    if (_isTopicPreview) {
                        var proxyTitle = $proxyContainer.attr('data-mc-proxy-title');
                        if (proxyTitle)
                            $('<h3>').text(proxyTitle).appendTo($proxyContainer);
                        return;
                    }

                    var searchQuery = GetProxySearchQuery($proxyContainer);
                    if (!searchQuery) {
                        $proxyContainer.remove();
                        return;
                    }

                    var scopeID = $proxyContainer.attr('data-mc-scope-id');
                    var resultsLimit = parseInt($proxyContainer.attr('data-mc-results-limit'));

                    MadCap.SearchHelper
                        .DoMicroContentSearch($proxyContainer, scopeID, resultsLimit, true, searchQuery)
                        .then(function(results) {
                            if (results && results.microContent && results.microContent.length > 0) {
                                var viewMode = $proxyContainer.attr('data-mc-micro-content-view-mode');
                                if (!viewMode) viewMode = defaultViewMode;
                                SetViewMode($proxyContainer, viewMode);

                                var proxyTitle = $proxyContainer.attr('data-mc-proxy-title');
                                if (proxyTitle)
                                    $('<div>').addClass("proxy-title").text(proxyTitle).appendTo($proxyContainer);

                                BuildMicroContentProxyResult($proxyContainer, results.microContent, viewMode);
                            } else {
                                $proxyContainer.remove();
                            }
                        });
                });
            });
        }
    }

    function SetViewMode($microContentContainer, viewMode) {
        $microContentContainer.removeClass('micro-content-drop-down-mode');
        $microContentContainer.removeClass('micro-content-optional-phrase');
        $microContentContainer.removeClass('micro-content-truncated-mode');

        var $microContents = $microContentContainer.children('.micro-content');
        $microContents.removeClass('micro-content-collapsed micro-content-expanded');
        $microContents.removeAttr('data-mc-truncated-mode-max-height');

        if (viewMode === 'DropDown') {
            $microContentContainer.addClass('micro-content-drop-down-mode');
        } else {
            $microContentContainer.addClass('micro-content-optional-phrase');
            if (viewMode === 'Truncated')
                $microContentContainer.addClass('micro-content-truncated-mode');
        }
    }

    function BuildMicroContentProxyResult($proxyContainer, microContent, viewMode) {
        if (!MadCap.Utilities) return;

        MadCap.Utilities.RemoveDynamicStylesheets($proxyContainer[0]);
        var dynamicStylesheets = [];

        if (microContent) {
            var linkPrefix = isTriPane ? "#" : "";

            if (microContent.length > 0) {
                MadCap.MicroContentHelper.PopulateContainer($proxyContainer,
                    viewMode,
                    microContent,
                    linkPrefix,
                    dynamicStylesheets);

                if (viewMode === 'Truncated')
                    setTimeout(function () {
                        MadCap.MicroContentHelper.InitContainer($proxyContainer);
                    }, 100);
                else {
                    MadCap.MicroContentHelper.InitContainer($proxyContainer);
                }
            }
        }

        if (dynamicStylesheets.length) {
            MadCap.Utilities.LoadDynamicStylesheets(dynamicStylesheets, $proxyContainer[0]);
        }
    }
})();

