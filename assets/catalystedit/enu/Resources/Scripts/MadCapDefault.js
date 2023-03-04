/// <reference path="../../Scripts/jquery.js" />
/// <reference path="../../Scripts/MadCapGlobal.js" />
/// <reference path="../../Scripts/MadCapUtilities.js" />
/// <reference path="../../Scripts/MadCapDom.js" />
/// <reference path="../../Scripts/MadCapFeedback.js" />
/// <reference path="MadCapToc.js" />
/// <reference path="MadCapIndex.js" />
/// <reference path="MadCapHelpSystem.js" />
/// <reference path="MadCapSearch.js" />

/*!
 * Copyright MadCap Software
 * http://www.madcapsoftware.com/
 * Unlicensed use is strictly prohibited
 *
 * v17.2.8047.30191
 */

(function () {
    MadCap.Default = MadCap.CreateNamespace("Default");
    MadCap.Default.LoadVarMap = LoadVarMap;

    if (!MadCap.Utilities.HasRuntimeFileType("Default"))
        return;

    InitMadCapTriPane();

    var isTriPane = MadCap.Utilities.HasRuntimeFileType("TriPane");
    var isDefault = isTriPane || MadCap.Utilities.IsRuntimeFileType("Default");
    var isSkinPreview = MadCap.Utilities.HasRuntimeFileType("SkinPreview");
    var isCentral = MadCap.Utilities.HasRuntimeFileType("Central");

    function Window_Onload(e) {
        MadCap.DEBUG.Log.AddLine(window.name + "onload");
        MadCap.DEBUG.Log.AddLine(window.name + "hash: " + document.location.hash);
        MadCap.DEBUG.Log.AddLine(window.name + "search: " + document.location.search);

        InitializeCommonElements();

        // Load the help system
        var pathToHelpSystem = $(document.documentElement).attr('data-mc-path-to-help-system');
        var helpSystemPath = "Data/HelpSystem.xml";

        if (pathToHelpSystem)
            helpSystemPath = pathToHelpSystem + helpSystemPath;

        if (MadCap.WebHelp && MadCap.WebHelp.HelpSystem) {
            MadCap.WebHelp.HelpSystem.LoadHelpSystem(helpSystemPath).done(function (helpSystem) {
                _HelpSystem = helpSystem;

                var currentUrl = MadCap.Utilities.Url.GetDocumentUrl();

                // Load initial settings from hash
                if (document.location.hash.length > 1)
                    LoadFromHash();
                else
                    LoadInitialPage(currentUrl.Query);
                if (currentUrl.QueryMap.GetItem("cshid") != null) {
                    LoadCshFromUrl();
                }

                LoadFromQuery();

                ReinitSkinsButton();

                ReinitSelectLanguageButton();

                // default to web layout for non-responsive outputs
                if (!_HelpSystem.IsResponsive) {
                    $("body").addClass("web");
                }

                InitCentralElements();
                OnLayout(e);
            });
        }
    }

    function LoadInitialPage(query) {
        function LoadDefaultPage() {
            LoadFile(_HelpSystem.DefaultStartTopic + query);
        }

        if (MadCap.LMS && isDefault)
            MadCap.LMS.Resume(LoadDefaultPage);
        else
            LoadDefaultPage();
    }

    function InitializeCommonElements() {
        // Apply placeholder polyfill
        if($().placeholder)
            $("input, textarea").placeholder();

        // hookup navigation links
        $('a.logo, a.homeLink, a.GenConceptText, a.GlossaryPageLink').on('click', MadCap.Utilities.Url.OnNavigateTopic);
    }

    function InitCentralElements() {
        if (_HelpSystem && _HelpSystem.IsCentralHosted) {
            $('html').addClass('central-hosted');
            $('.central-dropdown-content-settings').attr('href', GetLinkWithReturnUrl(_HelpSystem.CentralSettingsLink));
            $('.central-dropdown-content-logout').attr('href', GetLinkWithReturnUrl(_HelpSystem.CentralLogoutLink));
        }
    }

    function GetLinkWithReturnUrl(link) {
        var linkUrl = new MadCap.Utilities.Url(link);
        var returnUrl;
        if (!linkUrl.IsAbsolute) {
            returnUrl = new MadCap.Utilities.Url(document.location.href).LocalPath;
        }
        else {
            returnUrl = document.location.href;
        }
        return MadCap.Utilities.Url.EnsureUrlSafety(link + '?returnUrl=') + encodeURIComponent(returnUrl);
    }

    // Creates functions that are overridden in MadCapTriPane.js
    function InitMadCapTriPane() {
        MadCap.TriPane = MadCap.CreateNamespace("TriPane");
        $.extend(MadCap.TriPane, {
            AdjustTabs: printNotTriPaneWarning,
            ShowPane: printNotTriPaneWarning,
            LoadFile: printNotTriPaneWarning,
            SetActivePane: printNotTriPaneWarning,
            LoadPane: printNotTriPaneWarning
        });

        function printNotTriPaneWarning() {
            console.error("Warning: TriPane code is being run in non-TriPane skin.")
        }
    }

    function ReinitSkinsButton() {
        var $selectSkin = $(".select-skin-button");
        if (isSkinPreview || (_HelpSystem.IsResponsive && _HelpSystem.DefaultSkin != null && _HelpSystem.GetSkins().length > 1)) {
            $selectSkin.on('click', function (e) {
                var skins = [];

                var url = new MadCap.Utilities.Url(document.location.href);
                $.each(_HelpSystem.GetSkins(), function (i, skin) {
                    var link = { Title: skin.Name, Link: url.PlainPath + '?skinName=' + skin.SkinID + url.Fragment };
                    skins[skins.length] = link;
                });
                MadCap.TextEffects.CreateToolbarDropdown(skins, e.currentTarget, 'select-skin-drop-down');

                e.preventDefault();
                e.stopPropagation();
            });
        }
        else {
            $selectSkin.hide();
        }
    }

    function ReinitSelectLanguageButton() {
        var $selectLanguage = $(".select-language-button");

        if (isSkinPreview) {
            $selectLanguage.on('click', function (e) {
                MadCap.TextEffects.CreateDummyToolbarDropdown($selectLanguage, "select-language-drop-down", "Language");
                e.preventDefault();
                e.stopPropagation();
            });
            return;
        }

        if (!_HelpSystem.IsMultilingual) {
            $selectLanguage.hide();
            return;
        }

        require([_HelpSystem.GetPath() + "../languages.js"], function (languagefile) {
            var languages = languagefile.data;
            if (languages.length > 1) {
                //var $img = $("img", $selectLanguage);
                //for (var i = 0; i < languages.length; i++) {
                //    if (languages[i].code == _HelpSystem.LanguageCode) {
                //        $img.attr("src", _HelpSystem.GetPath() + "../Resources/Images/Country/" + languages[i].flag);
                //        $img.attr("alt", languages[i].full);
                //        break;
                //    }
                //}
                $selectLanguage.on('click', function (e) {
                    var languageLinks = [];
                    var pathToRoot = _HelpSystem.GetPath();
                    var pathToCurrentTopicFromRoot = _HelpSystem.GetCurrentTopicPath();
                    var url = new MadCap.Utilities.Url(document.location.href);

                    for (var i = 0; i < languages.length; i++) {
                        var pathToNewLanguageRoot = '../' + languages[i].code + '/';
                        var linkPath = pathToRoot + pathToNewLanguageRoot + pathToCurrentTopicFromRoot;
                        //var imagePath = pathToRoot + '../Resources/Images/Country/' + languages[i].flag;
                        //var link = { Title: languages[i].full, Link: linkPath, Image: imagePath };
                        var link = { Title: languages[i].full, Link: linkPath };
                        languageLinks[languageLinks.length] = link;
                    }

                    MadCap.TextEffects.CreateToolbarDropdown(languageLinks, e.currentTarget, 'select-language-drop-down');

                    e.preventDefault();
                    e.stopPropagation();
                });
            } else {
                $selectLanguage.hide();
            }
        });
    }

    var lastWindowWidth = window.innerWidth;
    var firstLayout = true;
    var OnLayout = MadCap.Utilities.Debounce(function () {
        var windowWidth = window.innerWidth;
        MadCap.SkinHelper.OnLayout(lastWindowWidth, firstLayout);
        lastWindowWidth = windowWidth;
        firstLayout = false;
    }, 50);

    function Window_Onhashchange(e) {
        MadCap.DEBUG.Log.AddLine(window.name + "onhashchange: " + document.location.hash);

        MadCap.Utilities.Url.SanitizeHash();

        if (document.location.hash.length > 1)
            LoadFromHash();
        else if (_HelpSystem)
            LoadFile(_HelpSystem.DefaultStartTopic);
    }

    function LoadFromHash() {
        if (document.location.hash.length == 0)
            return;

        var currentUrl = MadCap.Utilities.Url.GetDocumentUrl();
        var hash = MadCap.Utilities.Url.CurrentHash();
        var path = MadCap.Utilities.Url.StripInvalidCharacters(hash);

        if (MadCap.String.IsNullOrEmpty(path)) {
            document.location.hash = "";
            return;
        }

        var encodedTopicPath = path.substring(1);
        var topicPath = decodeURIComponent(encodedTopicPath);
        topicPath = MadCap.Utilities.Url.StripInvalidCharacters(topicPath);

        if (MadCap.String.Contains(topicPath, "cshid=") || MadCap.String.Contains(topicPath, "searchQuery=") || MadCap.String.Contains(topicPath, "skinName=")) {
            LoadCshFromUrl();

            return;
        }
        else if (MadCap.String.StartsWith(encodedTopicPath, MadCap.SearchHelper.SearchPrefixTri)) {
            var searchPath = encodedTopicPath.substring(MadCap.SearchHelper.SearchPrefixTri.length);
            MadCap.SearchHelper.DoSearchOrRedirect(searchPath, null);
            return;
        }
        else if (MadCap.String.StartsWith(topicPath, "communitysearch-")) {
            var searchQuery = topicPath.substring("communitysearch-".length);

            MadCap.SearchHelper.SetSelectedSearchQuery(searchQuery);

            MadCap.SearchHelper.DoSearch(searchQuery, null, 1, false, true, -1, 0);

            return;
        }
        else if (MadCap.String.StartsWith(topicPath, "pulse-")) {
            var pulsePath = topicPath.substring("pulse-".length);

            MadCap.FeedbackHelper.LoadStream(pulsePath);

            return;
        }

        LoadTopic(topicPath);
    }

    function LoadTopic(path) {
        /// <summary>Loads a topic into the topic pane.</summary>
        /// <param name="path">The path of the topic relative to the Content folder.</param>

        var pathUrl = new MadCap.Utilities.Url(path);

        if (_HelpSystem) {
            if (pathUrl.IsAbsolute) {
                if (_HelpSystem.PreventExternalUrls) {
                    path = _HelpSystem.DefaultStartTopic;
                } else {
                    //external url support - in case such a url has a query, this will strip off just our query.
                    var iq1 = pathUrl.Query.indexOf('?');
                    var iq2 = pathUrl.Query.lastIndexOf('?');
                    var query = '';
                    if (iq1 != iq2) {
                        query = pathUrl.Query.substr(iq1, iq2);
                    }
                    if (pathUrl.FullPath.indexOf("http://") != 0) {
                        path = _HelpSystem.ContentFolder + pathUrl.ToNoQuery().FullPath + (MadCap.String.IsNullOrEmpty(query) ? "" : query);
                    } else {
                        path = pathUrl.ToNoQuery().FullPath + (MadCap.String.IsNullOrEmpty(query) ? "" : query);
                    }
                }
            } else {
                if (pathUrl.QueryMap.GetItem("tocpath")) {
                    path = _HelpSystem.ContentFolder + pathUrl.PlainPath + pathUrl.Fragment + "?";
                    pathUrl.QueryMap.ForEach(function (key, value) {
                        path += key + "=" + encodeURIComponent(value) + "&";
                    });
                    path = path.slice(0, -1);
                } else {
                    path = _HelpSystem.ContentFolder + pathUrl.ToNoQuery().FullPath;
                }
            }
        }

        LoadFile(path);
    }

    function LoadFile(path) {
        /// <summary>Loads a file into the topic pane.</summary>
        /// <param name="path">The path of the file.</param>
        if (!isDefault)
            return;

        var href = new MadCap.Utilities.Url(decodeURIComponent(document.location.href));

        if (!isTriPane) {
            var root = new MadCap.Utilities.Url(href.PlainPath);
            if (!root.IsFolder)
                root = root.ToFolder();
            var url = root.CombinePath(path);

            MadCap.Utilities.Url.Navigate(url.FullPath);
        }
        else {
            MadCap.TriPane.LoadFile(path, href);
        }
    }

    function LoadFromQuery() {
        LoadSearchFromQuery();
        LoadSkinFromQuery();
    }

    function LoadSearchFromQuery() {
        var url = MadCap.Utilities.Url.GetDocumentUrl();
        var searchQuery = url.QueryMap.GetItem("q");
        if (searchQuery)
            MadCap.SearchHelper.DoSearchOrRedirect(url.Query, null);
    }

    function LoadSkinFromQuery() {
        var url = MadCap.Utilities.Url.GetDocumentUrl();
        var skinName = url.QueryMap.GetItem("skinName");
        MadCap.SkinHelper.ApplySkinByName(skinName, _HelpSystem);
    }

    function LoadVarMap() {
        var url = new MadCap.Utilities.Url(document.location.href);
        var varMap = new MadCap.Utilities.Dictionary(true);

        $.each([url.QueryMap, url.HashMap], function (index, map) {
            map.ForEach(function (key, value) {
                varMap.Add(key, value);
            });
        });

        return varMap;
    }

    function LoadCshFromUrl() {
        var varMap = LoadVarMap();
        var searchQuery = varMap.GetItem("searchQuery".toLowerCase());
        var skinName = varMap.GetItem("skinName".toLowerCase());

        if (searchQuery != null) {
            MadCap.SearchHelper.SetSelectedSearchQuery(decodeURIComponent(searchQuery));

            var firstPick = MadCap.String.ToBool(varMap.GetItem("firstPick".toLowerCase()), false);

            if (firstPick) {
                MadCap.SearchHelper.SearchPane.Search(searchQuery, { searchContent: true }).then(function (results) {
                    var content = results.content;
                    if (content.length >= 1)
                        LoadTopic(content[0].Link.replace(/^(Content)/, ""));
                });
            }
            else {
                MadCap.SearchHelper.DoSearchOrRedirect(searchQuery, skinName);
            }
        }
        else {
            var cshid = varMap.GetItem("cshid");

            if (cshid != null) {
                _HelpSystem.LookupCSHID(cshid, function (idInfo) {
                    var varMap = LoadVarMap();
                    var cshid = varMap.GetItem("cshid");
                    var skinName = varMap.GetItem("skinName".toLowerCase());

                    if (idInfo.Found) {
                        var topicPath = idInfo.Topic;
                        var topicPathUrl = new MadCap.Utilities.Url(topicPath);
                        var url = MadCap.Utilities.Url.GetDocumentUrl();
                        var query = "?cshid=" + cshid;
                        query += skinName ? "&skinName=" + skinName : "";

                        topicPath = new MadCap.Utilities.Url(topicPathUrl.PlainPath + query + topicPathUrl.Fragment).FullPath;

                        LoadFile(topicPath);
                    }
                    else
                        LoadFile(_HelpSystem.DefaultStartTopic);

                    MadCap.SkinHelper.ApplySkinByName(skinName || idInfo.Skin, _HelpSystem);
                });

                return;
            }
            else {
                var url = MadCap.Utilities.Url.GetDocumentUrl();
                LoadFile(_HelpSystem.DefaultStartTopic + url.Fragment);
            }

        }

        MadCap.SkinHelper.ApplySkinByName(skinName, _HelpSystem);
    }

    MadCap.Utilities.Url.SanitizeHash();

    $(Window_Onload);
    $(window).on('resize', OnLayout);

    if (isTriPane || !isSkinPreview)
        $(window).on('hashchange', Window_Onhashchange);

    var _HelpSystem = null;

    if ($(document).foundation) {
        $(document).foundation();
    }
})();
