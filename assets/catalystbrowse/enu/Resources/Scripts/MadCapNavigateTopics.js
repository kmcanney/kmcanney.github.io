/*!
 * Copyright MadCap Software
 * http://www.madcapsoftware.com/
 * Unlicensed use is strictly prohibited
 *
 * v18.1.8353.25537
 */

(function () {
    var _HelpSystem;
    var isTriPane = MadCap.Utilities.HasRuntimeFileType("TriPane");

    var Navigate = MadCap.CreateNamespace("Navigate");
    Navigate.NextTopic = NextTopic;
    Navigate.PreviousTopic = PreviousTopic;
    Navigate.SetButtonState = SetButtonState;

    MadCap.WebHelp.HelpSystem.LoadHelpSystemDefault().done(function (helpSystem) {
        _HelpSystem = helpSystem;
        MadCap.Utilities.MessageBus.AddMessageHandler(NavigateMessageHandler);


        if (isTriPane) {
            // this happens in MadCapTopic.js for non-iframe
            $(document).ready(function () {
                InitButtons();
            });
        } else {
            SetButtonState($(".previous-topic-button"), "previous");
            SetButtonState($(".topicToolbarProxy .next-topic-button"), "next");
        }
    });

    function InitButtons() {
        $(".previous-topic-button").on('click', function (e) {
            PreviousTopic();
            $("#topic").focus();
        });

        $(".next-topic-button").on('click', function (e) {
            NextTopic();
            $("#topic").focus();
        });

        $(".button").removeAttr("disabled");
    }

    function SetButtonState($el, moveType) {
        if (typeof moveType === "undefined")
            moveType = $el.hasClass("previous-topic-button") ? "previous" : "next";

        MadCap.WebHelp.HelpSystem.LoadHelpSystemDefault().done(function () {
            GetAdvanceUrl(moveType, function (href) {
                if (href)
                    $el.prop("disabled", false);
            }, true);
        });
    }

    function PreviousTopic() {
        AdvanceTopic("previous");
    }

    function NextTopic() {
        AdvanceTopic("next");
    }

    function AdvanceTopic(moveType) {
        if (MadCap.ELearning)
            MadCap.ELearning.RecordQuestionAnswerData();

        GetAdvanceUrl(moveType, function (href) {
            if (href) {
                if (isTriPane)
                    document.location.hash = href;
                else {
                    var result = _HelpSystem.GetAppliedSkinPath(href);
                    document.location.href = MadCap.Utilities.Url.EnsureUrlSafety(result);
                }
            }
        });
    }

    function GetAdvanceUrl(moveType, CallBackFunc, waitOnLoad) {
        var win = isTriPane ? frames["topic"] : window;
        if (isTriPane && waitOnLoad)
            $("#topic").on("load", GetUrl);
        else
            GetUrl();

        function GetUrl() {
            MadCap.Utilities.MessageBus.PostMessageRequest(win, "get-topic-url", null, function (data) {
                ProcessAdvanceUrl(data, moveType, CallBackFunc);
            });
        };
    }

    function ProcessAdvanceUrl(data, moveType, callback) {
        var href = new MadCap.Utilities.Url(data[0]);
        var root = isTriPane ? new MadCap.Utilities.Url(decodeURIComponent(document.location.href)) : new MadCap.Utilities.Url(document.location.href);
        var appendTocPath = isTriPane || _HelpSystem.TopNavTocPath;

        var queryMapUrl = (isTriPane && !(root.QueryMap.GetItem('TocPath') || root.QueryMap.GetItem('BrowseSequencesPath')) && !MadCap.String.IsNullOrEmpty(root.Fragment)) ? new MadCap.Utilities.Url(root.Fragment) : root;

        var tocPath = queryMapUrl.QueryMap.GetItem('TocPath');
        var bsPath = queryMapUrl.QueryMap.GetItem('BrowseSequencesPath');

        root = root.ToPlainPath();
        if (!root.IsFolder)
            root = root.ToFolder();

        if (isTriPane) {
            var query = href.Query;
            var plainPath = decodeURIComponent(href.PlainPath);
            href = new MadCap.Utilities.Url(plainPath + query);
        }
        var contentFolder = root.CombinePath(_HelpSystem.GetMasterHelpSystem().GetContentPath());
        href = href.ToRelative(contentFolder);

        if (bsPath != null) {
            _HelpSystem.AdvanceTopic("BrowseSequences", moveType, bsPath, appendTocPath, href, callback);
        } else {
            _HelpSystem.AdvanceTopic("Toc", moveType, tocPath, appendTocPath, href, callback);
        }
    }

    function NavigateMessageHandler(message, dataValues) {
        var returnData = { Handled: false, FireResponse: false };

        if (message == "navigate") {
            var path = dataValues[0];

            if (path)
                MadCap.Utilities.Url.NavigateHash(path);

            returnData.Handled = true;
            returnData.FireResponse = true;
        }
        else if (message == "navigate-topic") {
            var path = dataValues[0];

            if (!MadCap.Utilities.HasRuntimeFileType("TriPane")) {
                var abs = _HelpSystem.GetAbsoluteTopicPath("../" + _HelpSystem.ContentFolder + path);
                MadCap.Utilities.Url.Navigate(abs.FullPath);
            }

            var href = new MadCap.Utilities.Url(path);

            if (href.IsAbsolute) {
                // path will be absolute so make it relative to the home folder
                var homeUrl = new MadCap.Utilities.Url(document.location.href);
                homeUrl = new MadCap.Utilities.Url(homeUrl.PlainPath);
                var homeFolder = MadCap.String.EndsWith(homeUrl.FullPath, "/") ? homeUrl : homeUrl.ToFolder(); // Don't need .ToFolder() in the case that the page URL ends in a '/' (could happen when located on a web server: http://mydomain.com/WebHelp2/)
                var contentFolder = homeFolder.CombinePath(_HelpSystem.ContentFolder);
                href = href.ToRelative(contentFolder);
            }

            if (href.FullPath) {
                var newHash = MadCap.Utilities.Url.EnsureUrlSafety(href.FullPath);
                var currentHash = MadCap.Utilities.Url.CurrentHash();

                // if clicking link to currently displayed topic, reset the hash to trigger Window_Onhashchange
                if (currentHash.substring(1) == newHash)
                    document.location.hash = null;

                document.location.hash = newHash;
            }

            returnData.Handled = true;
        }
        else if (message == "navigate-home") {
            var defaultUrl = isTriPane ? new MadCap.Utilities.Url(document.location.href)
                : _HelpSystem.GetAbsoluteTopicPath("../" + _HelpSystem.DefaultStartTopic);

            MadCap.Utilities.Url.Navigate(defaultUrl.PlainPath);

            returnData.Handled = true;
        }
        else if (message == "navigate-previous") {
            PreviousTopic();
            returnData.Handled = true;
        }
        else if (message == "navigate-next") {
            NextTopic();
            returnData.Handled = true;
        }

        return returnData;
    }
})();