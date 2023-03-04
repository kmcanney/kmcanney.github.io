/// <reference path="../../Scripts/jquery.js" />
/// <reference path="../../Scripts/MadCapGlobal.js" />
/// <reference path="../../Scripts/MadCapUtilities.js" />
/// <reference path="../../Scripts/MadCapDom.js" />
/// <reference path="../../Scripts/MadCapXhr.js" />
/// <reference path="../../Scripts/MadCapFeedback.js" />
/// <reference path="../../Scripts/MadCapTextEffects.js" />
/// <reference path="../Scripts/MadCapHelpSystem.js" />

/*!
 * Copyright MadCap Software
 * http://www.madcapsoftware.com/
 * Unlicensed use is strictly prohibited
 *
 * v17.2.8047.30191
 */

(function () {
    MadCap.CreateNamespace("Topic");

    /* Note: Check changeset 44920: [Flare 8] 
    Fixed CSH bug where MadCapAll.js was loading code from MadCapTopic.js into non-topic files. 
    Needed to add a runtime-file-type check. This was breaking the CSH tester in Chrome because the MadCapTopic.js 
    code would attempt to load the Help system which would try to load HelpSystem.xml in the current directory. The 
    CSH tester is copied to the temp folder so this file doesn't exist. This only affected Chrome because it used HelpSystem.js 
    rather than .xml. The other browsers catch the missing XML file and continue. */
    var isTopic = MadCap.Utilities.HasRuntimeFileType("Topic");
    var isTriPane = MadCap.Utilities.HasRuntimeFileType("TriPane");

    var Topic = MadCap.Topic;
    var TextEffects = MadCap.TextEffects;
    var _HideComments;

    Topic.IsTopicPopup = IsTopicPopup;
    Topic.IsEmbeddedTopic = IsEmbeddedTopic;
    Topic.IsTemplateTopic = IsTemplateTopic;

    Topic.GetHideComments = function () { return _HideComments; }

    // Statics
    Topic.HelpControl_Click = function (e) {
        var aEl = this;

        Topic.GetHelpControlLinks(this, function (topics) {
            // Make the links relative to the current topic
            var url = new MadCap.Utilities.Url(document.location.href);

            for (var i = topics.length - 1; i >= 0; i--) {
                var topic = topics[i];
                topic.Title = "t" in topic ? topic.t : "Title" in topic ? topic.Title : null;

                var link = "Url" in topic ? topic.Url : "Link" in topic ? topic.Link : null;
                if (link != null && typeof link != "string") {
                    if (link.FullPath == url.FullPath)
                        topics.Remove(i);

                    link = link.ToRelative(url);

                    topic.Link = link.FullPath;
                }
            }

            // Sort them by title
            if (!$(aEl).hasClass("MCHelpControl-Related")) {
                topics.sort(function (a, b) {
                    return a.Title.localeCompare(b.Title);
                });
            }

            // Remove duplicates
            var map = new MadCap.Utilities.Dictionary();

            for (var i = topics.length - 1; i >= 0; i--) {
                var currTopic = topics[i];
                var link = currTopic.Link;

                if (map.GetItem(link)) {
                    topics.Remove(i);
                    continue;
                }

                map.Add(currTopic.Link, true);
            }


            // Create the list
            TextEffects.CreateLinkListPopup(topics, document.body, e.pageY, e.pageX, aEl);

        }, null);

        e.preventDefault();
        e.stopPropagation();
    };

    Topic.GetHelpControlLinks = function (node, callbackFunc) {
        var links = new Array();
        var $node = $(node);

        if (_HelpSystem && !_HelpSystem.InPreviewMode && IsEmbeddedTopic()) {
            var indexKeywords = $node.attr("data-mc-keywords");

            if (indexKeywords != null) {
                GetIndexLinksAndSort(indexKeywords);
                return;
            } else {
                var concepts = $node.attr("data-mc-concepts");

                if (concepts != null) {
                    _HelpSystem.GetConceptsLinks(concepts).then(callbackFunc);
                    return;
                }
            }
        }

        var topics = $node.attr("data-mc-topics");

        if (topics != null) {
            topicPairs = topics.split("||");

            if (topicPairs == "") {
                callbackFunc(links);
            }

            for (var i = 0, length = topicPairs.length; i < length; i++) {
                var topicAndPath = topicPairs[i].split("|");

                links[links.length] = { Title: topicAndPath[0], Link: topicAndPath[1] };
            }
        }

        callbackFunc(links);

        function GetIndexLinksAndSort(indexKeywords) {
            if (indexKeywords == "")
                callbackFunc(links);

            var keywords = indexKeywords.split(";");

            MadCap.Utilities.AsyncForeach(keywords, ConcatIndexLinks, RunCallbackOnSortedList);
        }

        function ConcatIndexLinks(keyword, callback) {
            _HelpSystem.FindIndexEntry(keyword, function (rootEntry, entry) {
                if (entry != null && entry.linkList) {
                    links = links.concat(entry.linkList);
                }
                callback();
            });
        }

        function RunCallbackOnSortedList() {
            callbackFunc(_HelpSystem.SortLinkList(links));
        }
    };

    Topic.Hyperlink_Onclick = function (e) {
        var $this = $(this);

        if ($this.hasClass("MCTopicPopup") || $this.hasClass("MCPopupThumbnailLink") || $this.hasClass("MCHelpControl") || $this.hasClass("MCCentralLink") || $this.hasClass("reply-comment-button"))
            return;

        var href = MadCap.Dom.GetAttribute(this, "href");
        var target = MadCap.Dom.GetAttribute(this, "target");
        var redirect = href && !href.startsWith("#") && !href.startsWith("javascript:") &&
            (target == null || target == "_self" || target == "_parent" || target == "_top");

        if (MadCap.ELearning && redirect)
            MadCap.ELearning.RecordQuestionAnswerData();

        if (href == null || MadCap.String.StartsWith(href, "http:") || MadCap.String.StartsWith(href, "https:"))
            return;

        if (target != null)
            return;

        if (IsEmbeddedTopic()) {
            var url = new MadCap.Utilities.Url(document.location.href);

            if (MadCap.String.StartsWith(href, '#')) {
                url = new MadCap.Utilities.Url(url.PlainPath + href);
            }
            else if (MadCap.String.Contains(href, "javascript:void(0)")) {
                return;
            }
            else {
                url = url.ToFolder().CombinePath(href);
            }

            MadCap.Utilities.MessageBus.PostMessageRequest(parent, "navigate-topic", [url.FullPath], null);

            e.preventDefault(); // prevents link from navigating
        }
        else if (isTriPane && MadCap.String.StartsWith(href, '#') && !MadCap.Dom.GetAttributeBool(this, "data-mc-processed-link")) { // handle bookmark links in micro content in tripane
            if (href.length > 1) {
                Topic.ScrollToBookmark(href.substring(1));
            }
            e.preventDefault();
        }
        else {
            MadCap.Utilities.Url.OnNavigateTopic.call($this, e);
        }
    };

    Topic.ScrollToBookmark = function (id) {
        id = decodeURI(id).replace(/([ #;?%&,.+*~\':"!^$[\]()=>|\/@])/g, '\\$1'); // escape invalid jquery characters

        if (!id) { return; }

        // prefer using name first because that's what we use for bookmarks
        var $target = $("[name = '" + id + "']");
        if ($target.length == 0)
            $target = $("#" + id);

        if ($target.length > 0) {
            Unhide($target[0], false);
            var $menus = $("ul[data-mc-toc]");
            var menusLoaded = 0;
            if ($menus.length > 0) {
                $menus.each(function () {
                    if (!this.innerHTML.replace(/\s/g, '').length) { // menu not loaded yet
                        $(this).on("loaded", function () {
                            menusLoaded++;
                            if (menusLoaded === $menus.length)
                                ScrollToOffset(GetTargetOffset($target));
                        });
                    } else {
                        menusLoaded++;
                        if (menusLoaded === $menus.length)
                            ScrollToOffset(GetTargetOffset($target));
                    }
                });
            } else {
                ScrollToOffset(GetTargetOffset($target));
            }
        }
    };

    function GetTargetOffset($target) {
        var offsetParentOffset = $target.offsetParent().offset().top;
        var offset = $target.parents('table').length > 0 ? $target.offset().top - offsetParentOffset : $target[0].offsetTop;

        if ($(".title-bar.sticky.is-stuck").length == 0 && !$(".sidenav-container").is(":visible"))
            offset += offsetParentOffset;

        return offset;
    }

    function ScrollToOffset(targetOffset) {
        var $scrollContainer = isTriPane ? $("#contentBodyInner") : $(".sidenav-container").is(":visible") ? $(".body-container") : $("html, body");
        $scrollContainer.scrollTop(targetOffset);
    }

    function Window_OnResize(e) {
        if (Topic.ShowFeedback)
            Topic.ShowFeedback();
    }

    function Window_Onload(e) {
        $(window).on('resize', Window_OnResize);
        $(window).on('hashchange', Window_Onhashchange);

        Topic.Init(document);

        if (MadCap.String.Contains(navigator.userAgent, "iphone", false)) {
            window.scrollTo(0, 1);
        }

        // iPad scrolling issue with iframe. The iframe contents that aren't visible don't render after scrolling.
        // http://stackoverflow.com/questions/10805301/how-can-i-scroll-an-iframe-in-ios-4-with-2-fingers/10807318#10807318
        if (MadCap.IsIOS() && isTriPane) {
            // Can't use jQuery here because append() will cause any inline <script> to be executed again.
            //var $wrapperDiv = $("<div id='ios-wrapper'></div>");
            //$wrapperDiv.append($(document.body).children()).appendTo(document.body);
            var $wrapperDiv = $("<div id='ios-wrapper'></div>").appendTo(document.body);
            var wrapperDiv = $wrapperDiv[0];

            for (var i = document.body.childNodes.length - 2; i >= 0; i--) {
                var child = document.body.childNodes[i];

                wrapperDiv.insertBefore(child, wrapperDiv.firstChild);
            }
        }

        HighlightSearchTerms();

        MadCap.WebHelp.HelpSystem.LoadHelpSystemDefault().done(function (helpSystem) {
            _HelpSystem = helpSystem;

            OnHelpSystemLoaded();
        });
    }

    Topic.Init = function (context) {
        // Apply placeholder polyfill
        if ($().placeholder)
            $("input, textarea", context).placeholder();

        // if embedded topic or topic popup, hide any MCWebHelpFramesetLinks
        if (IsEmbeddedTopic() || IsTopicPopup()) {
            $(".MCWebHelpFramesetLink", context).hide();
        }

        // Handle clicks to anchors using event delegation. This way, anchors added dynamically (via help controls, etc.) will be handled without needing to attach the handler then.
        $(context).on("click", "a, area", MadCap.Topic.Hyperlink_Onclick);

        // Set up thumbnail popups and hovers
        $(".MCPopupThumbnailPopup", context).on('click', MadCap.Topic.ThumbPopup_Click);
        $(".MCPopupThumbnailHover", context).on('mouseover', MadCap.Topic.ThumbPopup_Hover);

        $("a.MCHelpControl", context).on('click', MadCap.Topic.HelpControl_Click);

        InitTopicButtons(context);
    }

    function OnHelpSystemLoaded() {
        var hash = MadCap.Utilities.Url.CurrentHash();
        if (hash.length > 0) {
            var href = new MadCap.Utilities.Url(hash.substring(1));
            ProcessBookmark(href.ToNoQuery().FullPath);
            if (!$("html").hasClass("pulseTopic")) {
                $(window).trigger("hashchange");
            }
        }

        UpdateCurrentTopicIndex();
    }

    function Window_Onhashchange(e) {
        var url = new MadCap.Utilities.Url(document.location.href);

        if (!MadCap.String.IsNullOrEmpty(url.Fragment)) {
            var id = url.Fragment.substring(1);
            id = MadCap.Utilities.Url.StripInvalidCharacters(id);

            Topic.ScrollToBookmark(id);
        }
    }

    function InitTopicButtons(context) {
        $(".print-button", context).on('click', function (e) {
            window.print();
        });

        $(".expand-all-button", context).on('click', function (e) {
            var $this = $(this);

            if ($this.hasClass("expand-all-button"))
                MadCap.TextEffects.TextEffectControl.ExpandAll("open");
            else if ($this.hasClass("collapse-all-button"))
                MadCap.TextEffects.TextEffectControl.ExpandAll("close");

            MadCap.Utilities.ToggleButtonState(this);
        });
        $(".remove-highlight-button", context).on('click', function (e) {
            RemoveHighlight();
        });

        $(".previous-topic-button", context).on('click', function (e) {
            if (MadCap.ELearning)
                MadCap.ELearning.RecordQuestionAnswerData();
            MadCap.Utilities.MessageBus.PostMessageRequest(parent, "navigate-previous");
        });

        $(".next-topic-button", context).on('click', function (e) {
            if (MadCap.ELearning)
                MadCap.ELearning.RecordQuestionAnswerData();
            MadCap.Utilities.MessageBus.PostMessageRequest(parent, "navigate-next");
        });

        $(".codeSnippetCopyButton", context).on('click', function (e) {
            e.preventDefault();
            MadCap.Utilities.CopyToClipboard($('code', $(this).parents(".codeSnippet")));
        });
    }

    function ProcessBookmark(bookmarkName) {
        bookmarkName = MadCap.Utilities.Url.StripInvalidCharacters(bookmarkName);

        // escape apostrophe so it doesn't close the jquery query
        bookmarkName = bookmarkName.replace('\'', '\\\'');

        var el = $("[name='" + bookmarkName + "']");

        if (el.length > 0) {
            Unhide(el[0], false);
        }
    }

    function IsEmbeddedTopic() {
        return window.name == "topic" && !MadCap.Utilities.HasRuntimeFileType("Default");
    }

    function IsTopicPopup() {
        return window.name == "MCPopup" && !MadCap.Utilities.HasRuntimeFileType("Default");
    }

    function IsTemplateTopic() {
        return $('html').hasClass('templateTopic');
    }

    function UpdateCurrentTopicIndex() {
        MadCap.Utilities.MessageBus.PostMessageRequest(parent, "get-href", null, function (data) {
            if (data) {
                var url = new MadCap.Utilities.Url(data[0]);

                var href = new MadCap.Utilities.Url(url.Fragment.substring(1));
                var bsPath = url.QueryMap.GetItem('BrowseSequencesPath');

                _HelpSystem.SetBrowseSequencePath(bsPath, href);
            }
        });
    }

    function RemoveHighlight() {
        for (var index = 1; index <= 10; index++) {
            $('body').removeHighlight('SearchHighlight' + index);
        }
    }

    function HighlightSearchTerms() {
        function findNextSibling(child) {
            if (typeof child.nextElementSibling == 'undefined') {
                return child.nextSibling == null || child.nextSibling.nodeType == 1 ? child.nextSibling : findNextSibling(child.nextSibling);
            } else {
                return child.nextElementSibling;
            }
        };
        MadCap.Utilities.MessageBus.PostMessageRequest(parent, "get-href", null, function (data) {
            if (data) {
                var url = new MadCap.Utilities.Url(data[0]);
                var highlight = url.QueryMap.GetItem("Highlight");

                if (MadCap.String.IsNullOrEmpty(highlight)) {
                    return;
                }

                var phrases = highlight.match(/"[^"]*"/g);
                if (phrases != null) {
                    for (var phrase = 0; phrase < phrases.length; phrase++) {
                        highlight = highlight.replace(phrases[phrase], "");
                    }
                }
                var terms = highlight.replace('"', "").split(" ");
                for (var term = 0; term < terms.length; term++) {
                    if (terms[term] == "") {
                        terms.splice(terms[term], 1);
                        term--;
                    }
                }

                if (phrases != null) {
                    for (var phrase = 0; phrase < phrases.length; phrase++) {
                        terms.push(phrases[phrase].replace(/"/g, ""));
                    }
                }

                for (var term = 0; term < terms.length; term++) {
                    if ($.inArray(terms[term].toLowerCase(), MadCap.Utilities.StopWords) != -1) {
                        terms.splice(term, 1);
                        term--;
                    }
                }

                for (var index = 0; index < terms.length; index++) {
                    var termElements = Array("*[class*='MCExpandingBody']", "*[class*='MCDropDownHotSpot']", "*[data-mc-target-name]");
                    for (var termElement = 0; termElement < termElements.length; termElement++) {
                        var elems = $(termElements[termElement]);
                        for (var elem = 0; elem < elems.length; elem++) {

                            var nextParentSibling = findNextSibling(elems[elem].parentElement);
                            if ((elems[elem].textContent != null && elems[elem].textContent.toLowerCase().indexOf(terms[index].toLowerCase()) >= 0) ||
                                (nextParentSibling != null && nextParentSibling.textContent != null &&
                                    nextParentSibling.textContent.toLowerCase().indexOf(terms[index].toLowerCase()) >= 0)) {
                                Unhide(termElement != 2 ? elems[elem] : elems[elem].firstChild);
                            }
                        }
                    }
                    $('body').highlight(terms[index], 'SearchHighlight SearchHighlight' + (index + 1));
                }
            }
        });
    }

    function Highlight(term, color, caseSensitive, searchType) {
        if (term == "") {
            return;
        }

        ApplyHighlight(document.body, term, color, caseSensitive, searchType);

        // Scroll to first highlighted term

        if (_FirstHighlight && _FirstHighlight.offsetTop > document.documentElement.clientHeight) {
            document.documentElement.scrollTop = _FirstHighlight.offsetTop;
        }
    }

    function MergeTextNodes(node) {
        for (var i = node.childNodes.length - 1; i >= 1; i--) {
            var currNode = node.childNodes[i];
            var prevNode = currNode.previousSibling;

            if (currNode.nodeType == 3 && prevNode.nodeType == 3) {
                prevNode.nodeValue = prevNode.nodeValue + currNode.nodeValue;
                node.removeChild(currNode);
            }
        }

        for (var i = 0; i < node.childNodes.length; i++) {
            MergeTextNodes(node.childNodes[i]);
        }
    }

    function ApplyHighlight(root, term, color, caseSensitive, searchType) {
        var re = null;

        if (searchType == "NGram") {
            re = new RegExp(term, "g" + (caseSensitive ? "" : "i"));
        }
        else {
            var escTerm = term.replace(/([*^$+?.()[\]{}|\\])/g, "\\$1"); // Escape regex

            re = new RegExp("(^|\\s|[.,;!#$/:?'\"()[\\]{}|=+*_\\-\\\\])" + escTerm + "($|\\s|[.,;!#$/:?'\"()[\\]{}|=+*_\\-\\\\])", "g" + (caseSensitive ? "" : "i"));
        }

        for (var i = root.childNodes.length - 1; i >= 0; i--) {
            var node = root.childNodes[i];

            ApplyHighlight(node, term, color, caseSensitive, searchType);

            if (node.nodeType != 3 || node.parentNode.nodeName == "SCRIPT") {
                continue;
            }

            var currNode = node;
            var text = currNode.nodeValue;

            for (var match = re.exec(text); match != null; match = re.exec(text)) {
                var pos = match.index + (searchType == "NGram" ? 0 : match[1].length);
                var posEnd = pos + term.length;
                var span = document.createElement("span");

                span.className = "highlight";
                span.style.fontWeight = "bold";
                span.style.backgroundColor = color.split(",")[0];
                span.style.color = color.split(",")[1];

                var span2 = document.createElement("span");

                span2.className = "SearchHighlight" + (_ColorIndex + 1);
                span2.appendChild(document.createTextNode(text.substring(pos, posEnd)));

                span.appendChild(span2);

                currNode.nodeValue = text.substring(0, pos);
                currNode.parentNode.insertBefore(span, currNode.nextSibling);
                currNode.parentNode.insertBefore(document.createTextNode(text.substring(posEnd, text.length)), span.nextSibling);

                currNode = currNode.nextSibling.nextSibling;
                text = currNode.nodeValue;

                //

                if (_FirstHighlight == null || span.offsetTop < _FirstHighlight.offsetTop) {
                    _FirstHighlight = span;
                }

                //

                Unhide(span);
            }
        }
    }

    function Unhide(el, animate) {
        if (typeof animate == 'undefined')
            animate = true;

        var didOpen = false;

        for (var currNode = el.parentNode; currNode.nodeName != "BODY"; currNode = currNode.parentNode) {
            var $currNode = $(currNode);

            if ($currNode.hasClass("MCExpanding")) {
                var control = TextEffects.TextEffectControl.FindControl($currNode[0]);
                if (control == null) {
                    control = new MadCap.Topic.ExpandingControl(currNode);
                }
                control.Open(animate);
                didOpen = true;
            }
            else if ($currNode.hasClass("MCDropDown")) {
                var control = TextEffects.TextEffectControl.FindControl($currNode[0]);
                if (control == null) {
                    control = new MadCap.Topic.DropDownControl(currNode);
                }
                control.Open(animate);
                didOpen = true;
            }
            else {
                var targetName = $(currNode).attr("data-mc-target-name");

                if (targetName != null) {
                    var togglerNodes = MadCap.Dom.GetElementsByClassName("MCToggler", null, document.body);

                    for (var i = 0, length = togglerNodes.length; i < length; i++) {
                        var targets = $(togglerNodes[i]).attr("data-mc-targets").split(";");
                        var found = false;

                        for (var j = 0; j < targets.length; j++) {
                            if (targets[j] == targetName) {
                                found = true;

                                break;
                            }
                        }

                        if (!found)
                            continue;

                        var control = TextEffects.TextEffectControl.FindControl(togglerNodes[i]);
                        if (control == null) {
                            control = new MadCap.Topic.TogglerControl(togglerNodes[i]);
                        }
                        control.Open(animate);
                        didOpen = true;

                        break;
                    }
                }
            }
        }

        return didOpen;
    }

    $(function (e) {
        MadCap.Utilities.LoadHandlers["MadCapTopic"] = Topic.Init;

        if (isTopic) {
            Window_Onload(e);
        }
    });

    if (isTopic) {
        MadCap.Utilities.MessageBus.AddMessageHandler(function (message, dataValues, responseData) {
            var returnData = { Handled: false, FireResponse: true };

            if (message == "print") {
                window.print();

                returnData.Handled = true;
            }
            else if (message == "expand-all") {
                MadCap.TextEffects.TextEffectControl.ExpandAll("open");

                returnData.Handled = true;
            }
            else if (message == "collapse-all") {
                MadCap.TextEffects.TextEffectControl.ExpandAll("close");

                returnData.Handled = true;
            }
            else if (message == "get-topic-id") {
                responseData[responseData.length] = _TopicID;

                returnData.Handled = true;
            }
            else if (message == "get-topic-url") {
                responseData[responseData.length] = document.location.href;

                returnData.Handled = true;
            }
            else if (message == "remove-highlight") {
                RemoveHighlight();
                returnData.Handled = true;
            }
            else if (message == "get-bs-path") {
                var url = new MadCap.Utilities.Url(document.location.href);
                var bsPath = url.QueryMap.GetItem("BrowseSequencePath");

                if (bsPath == null)
                    bsPath = MadCap.Dom.Dataset(document.documentElement, "mcBrowseSequencePath");

                responseData[responseData.length] = bsPath;
                responseData[responseData.length] = url.FullPath;

                //

                returnData.Handled = true;
            }
            else if (message == "reload-pulse") {
                MadCap.Utilities.MessageBus.PostMessageRequest(frames["topiccomments-html5"], "reload");

                //

                returnData.Handled = true;
            }
            else if (message == "logout-complete") {
                MadCap.Utilities.MessageBus.PostMessageRequest(parent, "logout-complete");

                returnData.Handled = true;
            }
            else if (message == "set-pulse-login-id") {
                if (_FeedbackController != null)
                    _FeedbackController.PulseUserGuid = dataValues[0];

                MadCap.Utilities.MessageBus.PostMessageRequest(parent, "set-pulse-login-id", dataValues);

                returnData.Handled = true;
            }
            else if (message == "resize-pulse") {
                var $pulseFrame = $('.pulse-frame');
                $pulseFrame.attr('scrolling', 'no');
                $pulseFrame.css('overflow', 'hidden');
                $pulseFrame.height(dataValues[1]);

                returnData.Handled = true;
            }
            else if (message == "show-comments") {
                _HideComments = false;
                returnData.Handled = true;
            }
            else if (message == "hide-comments") {
                _HideComments = true;
                returnData.Handled = true;
            }

            return returnData;
        }, null);
    }

    var _ColorIndex = 0;
    var _FirstHighlight = null;
    var _HelpSystem = null;
    var _FeedbackController = null;
    var _TopicID = MadCap.Dom.Dataset(document.documentElement, "mcLiveHelp");
})();