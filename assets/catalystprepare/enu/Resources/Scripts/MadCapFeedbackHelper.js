/*!
 * Copyright MadCap Software
 * http://www.madcapsoftware.com/
 * Unlicensed use is strictly prohibited
 *
 * v18.1.8353.25537
 */

var _FeedbackController = null;
var _OutputAnalyticsController = null;
var _HelpSystem = null;
var _UserGuid = null;
var _LoginDialog = null;
var _TopicID = null;
var isTriPane = false;

(function () {
    isTriPane = MadCap.Utilities.HasRuntimeFileType("TriPane");
    var isSkinPreview = MadCap.Utilities.HasRuntimeFileType("SkinPreview");
    MadCap.WebHelp.HelpSystem.LoadHelpSystemDefault().done(function (helpSystem) {
        if (!helpSystem.LiveHelpEnabled && !isSkinPreview) {
            return;
        }
        _HelpSystem = helpSystem;

        if (_HelpSystem.LiveHelpEnabled) {
            if (_HelpSystem.IsCentralLiveHelpServerType())
                _OutputAnalyticsController = MadCap.WebHelp.LoadOutputAnalyticsController(_HelpSystem.OutputAnalyticsServer);
            else
                _FeedbackController = MadCap.WebHelp.LoadFeedbackController(_HelpSystem.LiveHelpServer);
        } else if (isSkinPreview)
            _FeedbackController = new MadCap.WebHelp.MockFeedbackController();

        if (_FeedbackController != null) {
            InitFeedbackController();
        }
    });

    MadCap.FeedbackHelper = MadCap.CreateNamespace('FeedbackHelper');

    MadCap.Utilities.MessageBus.AddMessageHandler(FeedbackMessageHandler);

    $.extend(MadCap.FeedbackHelper, {
        UpdateLoginButton: UpdateLoginButton,
        CloseLoginDialog: CloseLoginDialog,
        InitLoginDialog: InitLoginDialog,
        LoadStream: LoadStream,
        NavigateStream: NavigateStream,
        SetPulseLoginID: SetPulseLoginID,
        UpdateRating: UpdateRating,
        UpdateCommentsInTopic: UpdateCommentsInTopic,
        SetCommunitySource: SetCommunitySource,
        FeedbackMessageHandler: FeedbackMessageHandler,
        GetUserGuid: function () { return _UserGuid; },
        GetController: function () { return _FeedbackController; }
    });
})();

function InitFeedbackController() {
    _FeedbackController.Init(function () {
        if (_FeedbackController.PulseActive) {
            $(document.documentElement).addClass('pulse-active');

            // extra call to adjust tabs for community tab
            if(isTriPane)
                MadCap.TriPane.AdjustTabs(parseInt($("#navigation").css("width")));

            var serverUrl = new MadCap.Utilities.Url(_FeedbackController.PulseServer);
            MadCap.Utilities.MessageBus.AddVerifiedOrigin(serverUrl.Origin);
        }

        if (_FeedbackController.FeedbackActive) {
            $(document.documentElement).addClass('feedback-active');

            InitCommunityFeatures();

            if (!isTriPane) {
                UpdateRating();
                if (!MadCap.Utilities.HasRuntimeFileType("Search"))
                    UpdateCommentsInTopic();
            }
        }
    });
}

function InitCommunityFeatures() {
    // Set up topic rating mouse click event
    $(".star-buttons").on('click', FeedbackRating_Click);

    // Set the login/edit user profile button depending if the user is logged in
    UpdateLoginButton();

    $(".buttons").on("click", ".login-button", function (e) {
        if (isSkinPreview) {
            MadCap.Utilities.SetButtonState($(".login-button"), 2);
        }
        else {
            _LoginDialog = new MadCap.Feedback.LoginDialog(_FeedbackController, _FeedbackController.PulseEnabled ? "pulse" : "new");

            if (!_FeedbackController.PulseEnabled) {
                $(_LoginDialog).bind("closed", function () {
                    UpdateLoginButton();
                });
            }

            _LoginDialog.Show();
        }
    });

    $(".buttons").on("click", ".edit-user-profile-button", function (e) {
        if (isSkinPreview) {
            MadCap.Utilities.SetButtonState($(".edit-user-profile-button"), 1);
        }
        else {
            if (_FeedbackController.PulseEnabled) {
                var hash = '#!streams/' + (isTriPane ? _FeedbackController.PulseUserGuid + '/settings' : 'my');
                NavigateStream(hash);
            }
            else {
                _LoginDialog = new MadCap.Feedback.LoginDialog(_FeedbackController, "edit");

                $(_LoginDialog).bind("closed", function () {
                    UpdateLoginButton();
                });

                _LoginDialog.Show();
            }
        }
    });
}

function UpdateCommentsInTopic() {
    var currentSkin = _HelpSystem.GetCurrentSkin();
    if (currentSkin && currentSkin.CommentsInTopic == "false") {
        if (isTriPane) {
            MadCap.Utilities.MessageBus.PostMessageRequest(frames["topic"], "hide-comments");
        } else {
            $(".feedback-comments-wrapper").addClass("hidden");
        }
    } else {
        if (isTriPane) {
            MadCap.Utilities.MessageBus.PostMessageRequest(frames["topic"], "show-comments");
        } else {
            $(".feedback-comments-wrapper").removeClass("hidden");
        }
    }
}

function UpdateRating() {
    if (_FeedbackController == null)
        return;

    $(".star-buttons").addClass("loading");

    function UpdateAverageRating() {
        _FeedbackController.GetAverageRating(_TopicID, function (averageRating, ratingCount) {
            $(".star-buttons").removeClass("loading");

            SetFeedbackRating(averageRating);
        });
    }

    if (_TopicID == null) {
        GetTopicID(function (topicID) {
            _TopicID = topicID;

            SetFeedbackRating(0);
            UpdateAverageRating();
        });
    }
    else {
        UpdateAverageRating();
    }
}

function SetFeedbackRating(rating) {
    var $starContainer = $(".star-buttons");
    var $stars = $(".star-button", $starContainer);
    var starCount = $stars.length;
    var numIcons = Math.ceil(rating * starCount / 100);

    $stars.css("opacity", 0);

    for (var i = 0; i < starCount; i++) {
        var starButton = $stars[i];
        var $starButton = $(starButton);

        window.setTimeout((function (i, $starButton) {
            return function () {
                if (i <= numIcons - 1)
                    MadCap.Utilities.SetButtonState($starButton[0], 2);
                else
                    MadCap.Utilities.SetButtonState($starButton[0], 1);

                $starButton.animate({ opacity: 1 });
            }
        })(i, $starButton), i * 50);
    }
}

function FeedbackRating_Click(e) {
    var $target = $(e.target);

    if (e.target.tagName == "IMG")
        $target = $target.closest(".star-button");

    if ($target.hasClass("star-button")) {
        var starCount = $(".star-button", this).length;
        var rating = ($target.index() + 1) * 100 / starCount;

        _FeedbackController.SubmitRating(_TopicID, rating, null, function () {
            UpdateRating();
        });
    }
}

function UpdateLoginButton() {
    _UserGuid = _FeedbackController.GetUserGuid();

    var $el = $('.login-button');
    if ($el.length == 0)
        $el = $('.edit-user-profile-button');

    MadCap.Utilities.SetButtonState($el[0], _UserGuid == null ? 1 : 2);
}

function CloseLoginDialog() {
    if (_LoginDialog != null) {
        _LoginDialog.Hide(true);
    }
}

function InitLoginDialog(message) {
    var mode = message == "login-pulse" ? "pulse" : "new";
    _LoginDialog = new MadCap.Feedback.LoginDialog(_FeedbackController, mode);

    if (mode == "new") {
        $(_LoginDialog).bind("closed", function () {
            UpdateLoginButton();

            responseData.push(_UserGuid);

            MadCap.Utilities.MessageBus._PostMessageResponse(messageSource, message, responseData.length > 0 ? responseData : null, messageID);
        });
    }

    _LoginDialog.Show();
}

function SetPulseLoginID(id) {
    if (_FeedbackController != null)
        _FeedbackController.PulseUserGuid = id;

    UpdateLoginButton();
}

function LoadStream(url) {
    /// <summary>Loads a stream into the Pulse pane.</summary>
    /// <param name="url">The stream url.</param>

    $(document.documentElement).removeClass('has-topic');

    if(isTriPane)
        MadCap.TriPane.ShowPane("pulse");

    var hash = url.substring(url.indexOf('#'));

    MadCap.Utilities.MessageBus.PostMessageRequest(frames["community-frame-html5"], "pulse-hash-changed", [hash]);

    _FeedbackController.Init(function () {
        if (_FeedbackController.PulseActive && GetPulseFrame())
            GetPulseFrame().location.replace(_FeedbackController.PulseServer + hash);
    });
}

function GetPulseFrame() {
    if (frames["pulse"])
        return frames["pulse"];
    else if (frames["pulse-full"])
        return frames["pulse-full"];
    else
        return null;
}

function NavigateStream(url) {
    /// <summary>Navigates the help system to a stream.</summary>
    /// <param name="url">The stream url.</param>

    var hash = 'pulse-' + url;

    if (_HelpSystem.PulsePage != null)
        MadCap.Utilities.Url.Navigate(_HelpSystem.PulsePage + '#' + hash);
    else
        MadCap.Utilities.Url.NavigateHash(hash);
}

function GetTopicID(onComplete) {
    if (isTriPane) {
        // Request the topic ID from the topic iframe
        MadCap.Utilities.MessageBus.PostMessageRequest(frames["topic"], "get-topic-id", null, function (data) {
            onComplete(data[0]);
        });
    }
    else {
        onComplete($('html').attr("data-mc-live-help"));
    }
}

function SetCommunitySource($comFrame) {
    _FeedbackController.Init(function () {
        if (_FeedbackController.PulseActive)
            $comFrame.attr("src", _FeedbackController.PulseServer + "streams/my");
    });
}

function FeedbackMessageHandler(message, dataValues, responseData, messageSource, messageID) {
    var returnData = { Handled: false, FireResponse: true };
    switch (message) {
        case "login-user":
        case "login-pulse":
            if (_UserGuid == null) {
                MadCap.FeedbackHelper.InitLoginDialog(message);
                returnData.Handled = true;
                returnData.FireResponse = false;
            } else {
                responseData.push(_UserGuid);
                returnData.Handled = true;
                returnData.FireResponse = true;
            }
            break;
        case "get-user-guid":
            responseData.push(_UserGuid);

            returnData.Handled = true;
            returnData.FireResponse = true;
            break;
        case "login-complete":
        case "logout-complete":
            MadCap.Utilities.MessageBus.PostMessageRequest(GetPulseFrame(), "reload");
            MadCap.Utilities.MessageBus.PostMessageRequest(frames["community-frame-html5"], "reload");
            MadCap.Utilities.MessageBus.PostMessageRequest(frames["topiccomments-html5"], "reload");
            MadCap.Utilities.MessageBus.PostMessageRequest(frames["topic"], "reload-pulse");

            MadCap.FeedbackHelper.CloseLoginDialog();
            MadCap.FeedbackHelper.UpdateLoginButton();

            returnData.Handled = true;
            returnData.FireResponse = false;
            break;
        case "close-login-dialog":
            MadCap.FeedbackHelper.CloseLoginDialog();

            returnData.Handled = true;
            returnData.FireResponse = false;
            break;
        case "set-pulse-login-id":
            MadCap.FeedbackHelper.SetPulseLoginID(dataValues[0]);

            returnData.Handled = true;
            returnData.FireResponse = false;
            break;
        case "get-topic-path-by-stream-id":
            var streamID = dataValues[0];

            _FeedbackController.GetTopicPathByStreamID(streamID, function (topicPath) {
                responseData.push(topicPath);

                MadCap.Utilities.MessageBus._PostMessageResponse(messageSource, message, responseData.length > 0 ? responseData : null, messageID);
            }, null, null);

            returnData.Handled = true;
            returnData.FireResponse = false;
            break;
        case "get-topic-path-by-page-id":
            var pageID = dataValues[0];

            _FeedbackController.GetTopicPathByPageID(pageID, function (topicPath) {
                responseData.push(topicPath);

                MadCap.Utilities.MessageBus._PostMessageResponse(messageSource, message, responseData.length > 0 ? responseData : null, messageID);
            }, null, null);

            returnData.Handled = true;
            returnData.FireResponse = false;
            break;
        case "navigate-pulse":
            var path = dataValues[0];
            var hash = MadCap.Utilities.Url.CurrentHash();

            // append returnUrl if register/forgotpassword
            if (hash.length > 1 && path) {
                var lowerPath = path.toLowerCase();

                if (lowerPath === 'feedback/account/register' || path.toLowerCase() === 'forgotpassword') {
                    var url = new MadCap.Utilities.Url(hash.substring(1));
                    var returnUrl = url.QueryMap.GetItem('returnUrl');

                    if (returnUrl != null) {
                        returnUrl = escape(returnUrl);
                    }
                    else {
                        returnUrl = hash.substring(1);
                    }

                    path += '?returnUrl=' + returnUrl;
                }
            }

            if (path)
                MadCap.FeedbackHelper.NavigateStream(path);

            returnData.Handled = true;
            break; 
        case "forward-ajax-open-success":
            var data = dataValues[0];
            var status = parseInt(dataValues[1]);
            var dest = dataValues[2];

            ShowPane("pulse");

            MadCap.Utilities.MessageBus.PostMessageRequest(GetPulseFrame(), "ajax-open-success", [data, status, dest]);

            returnData.Handled = true;
            returnData.FireResponse = false;
            break;
        case message == "get-pulse-hash":
            var pulseHash = "";
            var hash = MadCap.Utilities.Url.CurrentHash();

            if (hash.indexOf('#pulse-') == 0)
                pulseHash = hash.substring('#pulse-'.length);

            responseData.push(pulseHash);

            returnData.Handled = true;
            returnData.FireResponse = true;
            break;
    }

    return returnData;
}