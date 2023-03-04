/*!
* Copyright MadCap Software
* http://www.madcapsoftware.com/
* Unlicensed use is strictly prohibited
*
* v17.2.8047.30191
*/

(function () {
    var isTriPane;
    var isSkinPreview;

    var _OutputAnalyticsController = null;
    var _searchPrefixTri = "search-";
    var _searchPrefixTop = "q=";
    var _SearchPane;
    var _HelpSystem;
    var timer;

    MadCap.SearchHelper = MadCap.CreateNamespace('SearchHelper');

    $.extend(MadCap.SearchHelper, {
        SearchFormSubmit: SearchFormSubmit,
        DoSearch: DoSearch,
        DoSearchOrRedirect: DoSearchOrRedirect,
        SearchHandler: SearchHandler, //gets overriden in MadCap.Search.Elastic.js
        SetSelectedSearchQuery: SetSelectedSearchQuery,
        SearchPrefixTri: _searchPrefixTri
    });

    isTriPane = MadCap.Utilities.HasRuntimeFileType("TriPane");
    isSkinPreview = MadCap.Utilities.HasRuntimeFileType("SkinPreview");

    if (MadCap.WebHelp && MadCap.WebHelp.HelpSystem) {
        MadCap.WebHelp.HelpSystem.LoadHelpSystemDefault().done(function (helpSystem) {
            _HelpSystem = helpSystem;

            if (_HelpSystem.LiveHelpEnabled)
                _OutputAnalyticsController = MadCap.WebHelp.LoadOutputAnalyticsController(_HelpSystem.OutputAnalyticsServer);

            LoadSearchFilters();
            _SearchPane = new MadCap.WebHelp.SearchPane(_HelpSystem, $("#searchPane"));
            MadCap.SearchHelper.SearchPane = _SearchPane;
        });

        $(document).ready(function () {
            SetupSearch();
        });
    } else {
        HookupSearchFilters();
    }

    $(SearchHelperOnLoad);

    function SearchHelperOnLoad() {
        if (isSkinPreview) {
            MicroContentDropDownInit();
        }
    }

    function SearchHandler (targetName, searchQuery, options) {
        return _SearchPane.Search(searchQuery, options);
    };

    function DoSearch(searchQuery, filterName, resultStartNum, searchTopics, searchCommunity, communityPageSize, communityPageIndex) {
        var currentSkin = _HelpSystem.GetCurrentSkin();
        if (typeof searchTopics == "undefined")
            searchTopics = true;
        if (typeof searchCommunity == "undefined")
            searchCommunity = (!currentSkin && _HelpSystem.DisplayCommunitySearchResults) ||
                (currentSkin && currentSkin.DisplayCommunitySearchResults != "false");
        if (typeof communityPageSize == "undefined")
            communityPageSize = _HelpSystem.CommunitySearchResultsCount;
        if (typeof communityPageIndex == "undefined")
            communityPageIndex = 0;

        if (!resultStartNum)
            resultStartNum = 1;

        $("#resultList, .micro-content-container").remove();

        if(isTriPane)
            MadCap.TriPane.ShowPane("search");

        var isFirstPage = resultStartNum === 1;
        var options = {};

        if (searchTopics) {
            options.searchContent = true;
            options.searchGlossary = _HelpSystem.IncludeGlossarySearchResults && isFirstPage;
            options.content = { filterName: filterName, pageSize: _HelpSystem.ResultsPerPage, pageIndex: resultStartNum - 1 };
        }

        if (searchCommunity && (isFirstPage || !searchTopics)) {
            options.searchCommunity = true;
            options.community = { pageSize: communityPageSize, pageIndex: communityPageIndex };
        }

        MadCap.SearchHelper.SearchHandler(_HelpSystem.TargetName, searchQuery, options).then(function (results) {
            BuildSearchResults(searchQuery, results, resultStartNum);
        });

        // show search results
        $("body").removeClass("active");
    }

    function SearchFormSubmit(e) {
        if (isSkinPreview && !isTriPane) return;

        var searchQuery = GetSearchQuery(e);

        if (!MadCap.String.IsNullOrEmpty(searchQuery.Query)) {
            var searchModifier = _searchPrefixTri + searchQuery.ToString();

            if (isTriPane) {
                document.location.hash = MadCap.Utilities.Url.EnsureUrlSafety(searchModifier);
            }
            else {
                searchModifier = _searchPrefixTop + searchQuery.ToString();
                MadCap.Utilities.Url.NavigateTopic(new MadCap.Utilities.Url(_HelpSystem.SearchUrl + "?" + searchModifier));
            }
        }
    }

    function DoSearchOrRedirect(query, skinName) {
        var searchQuery = MadCap.WebHelp.Search.SearchQuery.Parse(query);

        if (!isTriPane && !MadCap.Utilities.HasRuntimeFileType("Search")) {
            var url;
            if (skinName) {
                url = new MadCap.Utilities.Url(_HelpSystem.SearchUrl + "?skinName=" + skinName + "&" + _searchPrefixTop + searchQuery.ToString());
            } else {
                url = new MadCap.Utilities.Url(_HelpSystem.SearchUrl + "?" + _searchPrefixTop + searchQuery.ToString());
            }
            MadCap.Utilities.Url.NavigateTopic(url);
        }
        else {
            // set the value of the search field. This needs to happen when the search originated directly from the URL rather than by typing in the search field and submitting.
            SetSelectedSearchQuery(searchQuery.Query);

            if (!MadCap.String.IsNullOrEmpty(searchQuery.Filter)) {
                SetSelectedSearchFilter(searchQuery.Filter);
                UpdateSearchFilterState(searchQuery.Filter, document);
            }

            DoSearch(searchQuery.Query, searchQuery.Filter, searchQuery.PageIndex);
        }
    }

    function SetSelectedSearchQuery(query) {
        var decoded = decodeURIComponent(query);
        $(".search-field").val(decoded);
        $("#search-field-sidebar").val(decoded);
    }

    // Private Functions
    function RedoSearch(searchQuery, searchFilter) {
        if (!isTriPane && isSkinPreview)
            return;

        // if the search pane is currently active, redo the search to refresh the search results with the new filter applied
        if ($("#searchPane").is(":visible") && !MadCap.String.IsNullOrEmpty(searchQuery))
            SetSearchHash(new MadCap.WebHelp.Search.SearchQuery(searchQuery, GetSearchFilterValue(searchFilter), null));
    }

    function SetupSearch() {
        $(".search-submit").on('click', function (e) {
            SearchFormSubmit(e);
        });

        $("#search-field, #search-field-sidebar, .search-field").on('keypress', function (e) {
            if (e.which != 13)
                return;

            SearchFormSubmit(e);

            e.preventDefault();
        });

        $(".search-filter-wrapper").on('click', function (e) {
            var $self = $(this);
            var $filterContent = $(".search-filter-content", this);

            if ($self.hasClass("open"))
                CloseSearchFilter(0, 0, $filterContent, $self);
            else {
                $(this).addClass("open");

                if (window.PIE) {
                    // When a filter is selected it causes the search bar width to change. PIE wasn't automatically detecting this and re-rendering as it should have been.
                    // So instead, manually detach and re-attach to workaround this.
                    $(".search-submit-wrapper").each(function () {
                        PIE.detach(this);
                        PIE.attach(this);
                    });
                }

                $self.children(".search-filter").attr("aria-expanded", "true");
                $filterContent.fadeIn(200);
                $filterContent.css("max-height", $(window).height() - $filterContent.offset().top);
            }
        });

        if (!MadCap.Utilities.IsTouchDevice()) {
            $(".search-filter-wrapper").on('mouseenter', function (e) {
                clearTimeout(timer);
            });
            $(".search-filter-wrapper").on('mouseleave', function (e) {
                var $searchFilter = $(this);
                var $searchFilterContent = $(".search-filter-content", this.parentElement);

                CloseSearchFilter(200, 500, $searchFilterContent, $searchFilter);
            });
        }
    }

    function LoadSearchFilters() {
        _HelpSystem.LoadSearchFilters().then(function (filters) {
            var filterMap = filters ? filters.map : null;
            var filterNames = [];
            var hasCustomOrder = false;

            if (filterMap) {
                for (var filterName in filterMap) {
                    var filter = filterMap[filterName];
                    if (!MadCap.String.IsNullOrEmpty(filter.c)) { // ignore filters with no concepts
                        filterNames.push(filterName);
                        hasCustomOrder |= filter.o != -1;
                    }
                }
            }

            if (filterNames.length == 0) {
                if (window.PIE) {
                    $(".search-submit-wrapper").each(function () {
                        PIE.attach(this);
                    });
                }

                $("#SearchTab").closest('div').empty();
                return;
            }

            $(".search-filter-wrapper").show();

            if (window.PIE) {
                $(".search-filter, .search-submit-wrapper").each(function () {
                    PIE.attach(this);
                });
            }

            var orderToNameMap = {};

            filterNames.forEach(function (key) {
                var filter = filterMap[key];
                if (filter.o > -1)
                    orderToNameMap[filter.o] = key;
            });

            if (hasCustomOrder) {
                var sortedList = filterNames.sort(function (name1, name2) {
                    // sort priority 1: group
                    if (filterMap[name1].group != filterMap[name2].group) {
                        return filterMap[name1].group - filterMap[name2].group;
                    }
                    // sort priority 2: order within the group
                    if (filterMap[name1].o != filterMap[name2].o) {
                        return filterMap[name1].o - filterMap[name2].o;
                    }
                    // sort priority 3: ABC
                    return (name1 < name2 ? -1 : name1 > name2 ? 1 : 0);
                });
                filterNames = sortedList;
            }
            // else simple ABC sort
            else {
                var sortedList = filterNames.sort();
                filterNames = sortedList;
            }

            if (isTriPane && $(".search-bar").css('display') == 'none') {
                $("#SearchTab").closest(".tab").remove();
                return;
            }

            var $ul = $("#search ul");
            for (var i = 0, length = filterNames.length; i < length; i++) {

                var filterSelectorLabelId = MadCap.Utilities.GenerateRandomGUID();
                var $filterSelectorButtonLabel = $('<span></span>').append(filterNames[i]).attr("id", filterSelectorLabelId);
                var $filterSelectorButton = $('<button class="mc-dropdown-item"></button>')
                    .append($filterSelectorButtonLabel)
                    .attr("aria-labelledby", "search-filters-label " + filterSelectorLabelId);

                MadCap.Accessibility.initMenuDropdownAccessibility($filterSelectorButton);

                $(".search-filter-content ul").append(
                    $('<li></li>').append($filterSelectorButton));

                var $li = $('<li/>');
                $li.addClass('SearchFilterEntry tree-node tree-node-leaf');

                var $item = $('<div class="SearchFilter" />');
                var $span = $('<span class="label" />')
                $span.text(filterNames[i]);

                $item.append($span);

                $li.append($item);
                $ul.append($li);
            }

            HookupSearchFilters();
        });
    }

    function HookupSearchFilters() {
        // standard search bar
        $(".search-filter-content button").on('click', function (e) {
            e.preventDefault();
            var $searchFilterLi = $(e.target);
            var filterName = $searchFilterLi.text().trim();
            var $searchField = $searchFilterLi.closest(".search-bar").children(".search-field");
            var searchQuery = $searchField.val();
            var $searchFilterWrapper = $searchFilterLi.closest(".search-filter-wrapper");
            var $searchFilter = $searchFilterWrapper.children(".search-filter");
            var $searchFilterContent = $searchFilterLi.closest(".search-filter-content");

            SetSelectedSearchFilter(filterName);
            UpdateSearchFilterState(filterName, $searchFilterWrapper);
            $searchFilter.attr("title", filterName);

            CloseSearchFilter(0, 0, $searchFilterContent, $searchFilter);

            RedoSearch(searchQuery, filterName);
        });

        // responsive side bar
        $(".SearchFilter").on('click', function (e) {
            var $target = $(e.target).closest('.SearchFilterEntry');
            var searchQuery = $('#search-field-sidebar').val();

            $('.SearchFilterEntry.tree-node-selected').removeClass('tree-node-selected');

            if ($target.hasClass('SearchFilterEntry')) {
                $target.addClass('tree-node-selected');

                var filterName = $target.find('.SearchFilter').text().trim();

                var $searchField = $('#search-field-sidebar');
                if (!$searchField.attr('data-placeholder'))
                    $searchField.attr('data-placeholder', $searchField.attr('placeholder'));

                var encodedPlaceholder = MadCap.Utilities.EncodeHtml($searchField.attr('data-placeholder') + ' ' + filterName);
                $searchField.attr('placeholder', encodedPlaceholder);

                SetSelectedSearchFilter(filterName, this);
                if (searchQuery) {
                    RedoSearch(searchQuery, filterName);
                } else {
                    $(".search-filter").focus();
                }
            }
        });
    }

    function CloseSearchFilter(fadeoutTime, displayTime, searchFilterContent, searchFilter) {
        if (timer)
            clearTimeout(timer);

        timer = setTimeout(function () {
            $(searchFilterContent).fadeOut(fadeoutTime, function () {
                $(searchFilter).removeClass("open");
                $(searchFilter).children(".search-filter").attr("aria-expanded", "false");
            });
        }, displayTime);
    }

    function SetSelectedSearchFilter(filterName) {
        $('.search-filter').data('filter', filterName);

        if (!isTriPane) {
            var $searchField = $('.search-field');
            if (!$searchField.attr('data-placeholder'))
                $searchField.attr('data-placeholder', $searchField.attr('placeholder'));

            var encodedPlaceholder = MadCap.Utilities.EncodeHtml($searchField.attr('data-placeholder') + ' ' + filterName);
            $searchField.attr('placeholder', encodedPlaceholder);
            $(".search-filter").attr("title", filterName);
        }
        else
            $('.search-filter > span').text(filterName);
    }

    function UpdateSearchFilterState(filterName, context) {
        // also set the state to selected
        var $searchFilterContent = $('.search-filter-content', context);
        var searchFilterContentUl = $searchFilterContent.children()[0];
        var allFilesSelection = $(searchFilterContentUl).children()[0];
        var allFilesText = $(allFilesSelection).text().trim();

        filterName !== allFilesText ? $('.search-filter').addClass('selected') : $('.search-filter').removeClass('selected');
    }

    function GetSearchQuery(e) {
        var $searchBar = $(e.target).closest(".search-bar-container");
        var $searchField = $("input", $searchBar).first();
        var $searchFilter = $(".search-filter", $searchBar);

        var searchQuery = $searchField.val();
        if (searchQuery) {
            searchQuery = MadCap.Utilities.Url.StripInvalidCharacters(searchQuery);
            searchQuery = encodeURIComponent(searchQuery);
        }

        var searchFilterText;
        var searchBarId = $searchBar.attr('id');

        if (isTriPane && searchBarId && searchBarId.indexOf('sidebar') != -1)
            searchFilterText = $('.SearchFilterEntry.tree-node-selected').text();
        else
            searchFilterText = $searchFilter.data('filter');

        if (!searchFilterText) {
            var hash = MadCap.Utilities.Url.CurrentHash();
            var index = hash.lastIndexOf('?f=');
            if (index !== -1) {
                var filter = hash.substr(index + 3); // 3 = 2 (positions til =) + 1 (start of filter)

                if (filter)
                    searchFilterText = filter;
            }
        }

        searchFilterText = searchFilterText ? searchFilterText.trim() : searchFilterText;

        var searchFilter = GetSearchFilterValue(searchFilterText, $searchBar);

        return new MadCap.WebHelp.Search.SearchQuery(searchQuery, searchFilter, null);
    }

    function GetSearchFilterValue(searchFilter) {
        var defaultSearchFilter = $.trim($("#sf-content li").first().text());
        if (searchFilter && searchFilter != defaultSearchFilter) {
            var searchFilterEncoded = MadCap.Utilities.Url.StripInvalidCharacters(searchFilter);
            return encodeURIComponent(searchFilterEncoded); // encode special characters in search filter
        }

        return null;
    }

    function CreateSearchPagination(curPage, total, results) {
        var paginationDiv = $("#pagination");

        // hide search pagination
        paginationDiv.css("display", "none");

        // clear previous links
        $('a.specificPage', paginationDiv).remove();

        // create search results pagination div
        if (total > 0) {
            var totalPages = Math.ceil(total / _HelpSystem.ResultsPerPage);
            var maxPagesShown = 10;
            var slidingStartPoint = 5;
            var pageStart = Math.max(Math.min(curPage - slidingStartPoint, totalPages - maxPagesShown + 1), 1);
            var pageEnd = Math.min(pageStart + maxPagesShown - 1, totalPages);

            var previousLink = $("a.previousPage", paginationDiv);
            if (curPage > 1) {
                previousLink.off("click");
                previousLink.on("click", { value: curPage - 1 }, GoToSearchResults);
                previousLink.css("display", "inline");
            }
            else {
                previousLink.css("display", "none");
            }

            var nextLink = $("a.nextPage", paginationDiv);
            if (curPage < totalPages) {
                nextLink.off("click");
                nextLink.on("click", { value: curPage + 1 }, GoToSearchResults);
                nextLink.css("display", "inline");
            }
            else {
                nextLink.css("display", "none");
            }

            for (var i = pageStart; i <= pageEnd; i++) {
                var pageLink = $("<a href=\"#\" class='specificPage'><span style=\"display: none;\">page</span>" + i + "</a>");

                if (i == curPage)
                    pageLink.attr('id', 'selected');

                nextLink.before(pageLink);
                pageLink.on("click", { value: i }, GoToSearchResults);
            }

            paginationDiv.css("display", "block");
        }
    }

    function GoToSearchResults(e) {
        e.preventDefault();

        var currentUrl = MadCap.Utilities.Url.GetDocumentUrl();
        var searchRegex = isTriPane ? '#' + _searchPrefixTri : '[?&]' + _searchPrefixTop;
        var hash = isTriPane ? MadCap.Utilities.Url.CurrentHash() : currentUrl.Query;
        var match = hash.match(searchRegex);

        if (match) {
            var searchQuery = MadCap.WebHelp.Search.SearchQuery.Parse(hash.substring(match.index + match[0].length));
            searchQuery.PageIndex = e.data.value;

            SetSearchHash(searchQuery);
        }
    }

    function SetSearchHash(searchQuery, searchFilter, pageIndex) {
        var searchQueryString;
        if (isTriPane) {
            searchQueryString = searchQuery.ToString();
        } else {
            searchQueryString = _searchPrefixTop + searchQuery.Query;

            if (searchQuery.Filter)
                searchQueryString += '&f=' + searchQuery.Filter;
            if (searchQuery.PageIndex)
                searchQueryString += '&p=' + searchQuery.PageIndex;
        }

        searchQueryString = MadCap.Utilities.Url.StripInvalidCharacters(searchQueryString);

        if (isTriPane) {
            document.location.hash = MadCap.Utilities.Url.EnsureUrlSafety('#' + _searchPrefixTri + searchQueryString);
        } else {
            var url = new MadCap.Utilities.Url(_HelpSystem.SearchUrl + "?" + searchQueryString);
            MadCap.Utilities.Url.NavigateTopic(url);
        }
    }

    function MicroContentDropDownInit() {
        var $divResponse = $('div.micro-response');
        if ($divResponse.length) {
            var $divExpandTransition = $('div.micro-content-expand-transition');
            var $buttonExpand = $('button.micro-content-expand');

            // without setTimeout scrollHeight can return wrong values in Chrome if micro content ends with an image
            var mh = 0;
            $buttonExpand.hide();
            $divExpandTransition.hide();
            setTimeout(function () {
                mh = parseFloat($divResponse.css('max-height'));
                var sh = $divResponse.prop('scrollHeight');
                if (sh < mh) {
                    $divResponse.css('max-height', 'none');
                } else {
                    $buttonExpand.show();
                    $divExpandTransition.show();
                }
            }, 100);

            $buttonExpand.click(function () {
                var sh = $divResponse.prop('scrollHeight');
                if ($buttonExpand.hasClass('expanded')) {
                    $divResponse.css('max-height', sh);
                    $divResponse.animate({ 'max-height': mh }, function () {
                        $divResponse.css('max-height', '');
                    });
                    $buttonExpand.removeClass('expanded');
                    $divExpandTransition.show();
                    SetSkinPreviewStyle($buttonExpand[0], "Search Micro Content Response Expand");
                } else {
                    $divExpandTransition.hide();
                    $divResponse.animate({ 'max-height': sh }, function () {
                        $divResponse.css('max-height', 'none');
                    });
                    $buttonExpand.addClass('expanded');
                    SetSkinPreviewStyle($buttonExpand[0], "Search Micro Content Response Collapse");
                }
            });

            $(".codeSnippetCopyButton").on('click', function (e) {
                e.preventDefault();
                MadCap.Utilities.CopyToClipboard($('code', $(this).parents(".codeSnippet")));
            });
        }
    }

    // curPage is the clicked on page number
    // resultsPerPage is the number of results shown per page
    function BuildSearchResults(searchQuery, results, curPage) {
        var currentSkin = _HelpSystem.GetCurrentSkin();
        var displayCommunityResults = (!currentSkin && _HelpSystem.DisplayCommunitySearchResults) ||
            (currentSkin && currentSkin.DisplayCommunitySearchResults != "false");
        var headingEl = $("#results-heading")[0];
        var paginationEl = $("#pagination");
        var length = results.contentTotal;
        var communityLength = (displayCommunityResults && results.community != null) ? results.community.TotalRecords : 0;
        var glossaryLength = results.glossary ? 1 : 0;
        var microContentLength = results.microContent ? 1 : 0;
        var totalLength = length + communityLength + Math.max(glossaryLength, microContentLength);
        var linkPrefix = isTriPane ? "#" : "";

        SetSkinPreviewStyle(headingEl, "Search Heading");

        $(".query", headingEl).text("\"" + decodeURIComponent(searchQuery) + "\"");
        $(".total-results", headingEl).text(totalLength);

        if (curPage < 1 || curPage > Math.ceil(length / _HelpSystem.ResultsPerPage)) {
            paginationEl.css("display", "none");
        }

        if (totalLength > 0) {
            var ul = document.createElement("ul");
            ul.setAttribute("id", "resultList");

            if (!results.content)
                ul.setAttribute("class", "communitySearch");

            // glossary result
            if (results.glossary) {
                var li = document.createElement("li");
                ul.appendChild(li);

                var div = document.createElement("div");
                $(div).addClass("glossary");
                SetSkinPreviewStyle(div, "Search Glossary Result");

                var divTerm = document.createElement("div");
                $(divTerm).addClass("term");
                SetSkinPreviewStyle(divTerm, "Search Glossary Term");
                var term = document.createTextNode(results.glossary.term);

                if (results.glossary.link) { // term links to a topic
                    var linkTerm = document.createElement("a");
                    $(linkTerm).attr("href", linkPrefix + results.glossary.link);
                    linkTerm.appendChild(term);
                    divTerm.appendChild(linkTerm);
                }
                else {
                    divTerm.appendChild(term);
                }

                div.appendChild(divTerm);

                var definition = results.glossary.definition || results.glossary.abstractText;
                if (definition) {
                    var divDef = document.createElement("div");
                    $(divDef).addClass("definition");
                    divDef.appendChild(document.createTextNode(definition));
                    SetSkinPreviewStyle(divDef, "Search Glossary Definition");
                    div.appendChild(divDef);
                }

                li.appendChild(div);
            }
            // micro content result
            if (results.microContent) {
                var $li = $('<div>').addClass("micro-content-container").insertAfter($('#results-heading'));
                var $div = $('<div>').addClass("micro-content").appendTo($li);
                SetSkinPreviewStyle($div[0], "Search Micro Content Result");

                var $divResponse = $('<div>').addClass("micro-response").appendTo($div);
                SetSkinPreviewStyle($divResponse[0], "Search Micro Content Response");

                $(results.microContent.html).appendTo($divResponse);

                var $buttonExpand = $('<button>').addClass("micro-content-expand").appendTo($div);
                SetSkinPreviewStyle($buttonExpand[0], "Search Micro Content Response Expand");

                var $divExpandTransitionWrapper = $('<div>').addClass("micro-content-expand-transition-wrapper").insertBefore($buttonExpand);
                var $divExpandTransition = $('<div>').addClass("micro-content-expand-transition").appendTo($divExpandTransitionWrapper);
                SetSkinPreviewStyle($divExpandTransition[0], "Search Micro Content Response Fade");

                if (results.microContent.source) { // micro content related topic link
                    var topicHref = linkPrefix + results.microContent.source;

                    var $divTopicTitle = $('<div>').addClass('micro-response-title').appendTo($div);
                    var $divTopicLink = $('<a>').attr("href", topicHref).text(results.microContent.sourceTitle).appendTo($divTopicTitle);
                    SetSkinPreviewStyle($divTopicTitle[0], "Search Micro Content Response Link");
                    var $divUrl = $('<div>').addClass('micro-response-url').appendTo($div);
                    var $cite = $('<cite>').addClass('').text(results.microContent.source).appendTo($divUrl);
                    SetSkinPreviewStyle($divUrl[0], "Search Micro Content Response Path");
                }

                var stylesheets = results.microContent.stylesheets;
                if (stylesheets) {
                    var stylesheetHrefs = [];
                    for (var i = 0; i < stylesheets.length; i++) {
                        var stylesheet = new MadCap.Utilities.Url(stylesheets[i]);
                        var microContentStylesheet = stylesheet.ToFolder().AddFile(stylesheet.Name + ".micro-content." + stylesheet.Extension);
                        if (microContentStylesheet.IsRootRelative) {
                            microContentStylesheet = new MadCap.Utilities.Url('.').CombinePath(microContentStylesheet.FullPath);
                        }
                        stylesheetHrefs.push(microContentStylesheet.FullPath);
                    }
                    MadCap.Utilities.UpdateDynamicStylesheets(stylesheetHrefs);
                }

                MadCap.Utilities.InitContent($divResponse[0]);

                MicroContentDropDownInit();
                MadCap.Accessibility.initTextEffectsAccessibility($div);
            }
            else {
                MadCap.Utilities.RemoveDynamicStylesheets();
            }

            if (results.community != null && results.community.Activities.length > 0 && displayCommunityResults) {
                BuildCommunitySearchResults(ul, searchQuery, results.community);
            }

            var resultsLength = _HelpSystem.ResultsPerPage;
            if (results.content != null && resultsLength > 0) {
                var startResultIndex = 0,
                    endResultIndex = Math.min(resultsLength, results.content.length);

                if (results.clientPaging) {
                    startResultIndex = (curPage - 1) * resultsLength;
                    endResultIndex = Math.min(startResultIndex + resultsLength, results.contentTotal);
                }

                for (var i = startResultIndex; i < endResultIndex; i++) {
                    var result = results.content[i];
                    var title = result.Title;
                    var link = result.Link;
                    var abstractText = result.AbstractText;
                    var highlighted = result.Highlighted;

                    var li = document.createElement("li");
                    ul.appendChild(li);

                    var h3 = document.createElement("h3");
                    $(h3).addClass("title");
                    li.appendChild(h3);

                    var a = document.createElement("a");
                    a.setAttribute("href", linkPrefix + link + "?Highlight=" + encodeURIComponent(searchQuery));
                    SetSkinPreviewStyle(a, "Search Result Link");
                    AssembleSearchResultTextNode(highlighted, a, title, results);
                    h3.appendChild(a);

                    if (abstractText != null) {
                        var divDesc = document.createElement("div");
                        $(divDesc).addClass("description");
                        SetSkinPreviewStyle(divDesc, "Search Result Abstract");
                        AssembleSearchResultTextNode(highlighted, divDesc, abstractText, results);
                        li.appendChild(divDesc);
                    }

                    if (_HelpSystem.DebugMode) {
                        var divDebug = document.createElement("div");
                        $(divDebug).addClass("description");
                        divDebug.innerHTML = "<b>Score:</b> " + result.Score + ", <b>Rank:</b> " + result.Rank;
                        li.appendChild(divDebug);
                    }

                    var divUrl = document.createElement("div");
                    $(divUrl).addClass("url");
                    li.appendChild(divUrl);

                    var cite = document.createElement("cite");
                    SetSkinPreviewStyle(cite, "Search Result Path");
                    cite.appendChild(document.createTextNode(link));
                    divUrl.appendChild(cite);
                }
            }

            paginationEl.before(ul);
        }

        if (_HelpSystem.LiveHelpEnabled) {

            if (_HelpSystem.IsCentralLiveHelpServerType())
                _OutputAnalyticsController.LogSearch(_HelpSystem.OutputAnalyticsId, length, microContentLength, null, searchQuery);
            else
                _FeedbackController.LogSearch(_HelpSystem.LiveHelpOutputId, null, length, null, searchQuery);
        }

        if (length > _HelpSystem.ResultsPerPage)
            CreateSearchPagination(curPage, results.contentTotal, results.content);
        else
            paginationEl.css("display", "none");

        // Bug #99223 - Cannot scroll search results on iOS on initial load
        if (MadCap.IsIOS())
            $('.off-canvas-wrapper').scrollTop(1);

        // scroll to top
        $("#contentBodyInner, .off-canvas-wrapper").scrollTop(0);

        function AssembleSearchResultTextNode(highlighted, element, text, results) {
            if (highlighted) {
                element.innerHTML = text;
            }
            else {
                element.appendChild(document.createTextNode(text));
                BoldSearchTerms(element, results.includedTerms);
            }
        }
    }

    function SetSkinPreviewStyle(el, styleName) {
        if (isSkinPreview)
            el.setAttribute("data-mc-style", styleName);
    }

    function BoldSearchTerms(parentNode, terms) {
        var $parentNode = $(parentNode);

        if (terms) {
            for (var i = 0; i < terms.length; i++) {
                $parentNode.highlight(terms[i], null, 'b');
            }
        }
    }

    function BuildCommunitySearchResults(ul, searchQuery, communityResults) {
        var linkPrefix = (_HelpSystem.PulsePage || "") + "#pulse-";
        var topicPrefix = isTriPane ? "#" : _HelpSystem.GetTopicPath("../" + _HelpSystem.ContentFolder).FullPath;

        var li = document.createElement("li");
        li.setAttribute("id", "community-results");
        ul.appendChild(li);

        var h3 = document.createElement("h3");
        h3.setAttribute("class", "title");

        var communitySearchLink = document.createElement("a");
        communitySearchLink.setAttribute("href", "#communitysearch-" + encodeURIComponent(searchQuery));
        communitySearchLink.appendChild(document.createTextNode("Community Results"));

        h3.appendChild(communitySearchLink);

        var communitySearchInfo = document.createElement("span");
        communitySearchInfo.appendChild(document.createTextNode(" (" + communityResults.TotalRecords + ")"));
        h3.appendChild(communitySearchInfo);

        var communityUl = document.createElement("ul");
        communityUl.setAttribute("id", "communityResultList");

        li.appendChild(h3);
        li.appendChild(communityUl);

        var now = new Date();
        var utcNow = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());

        for (var i = 0; i < communityResults.Activities.length; i++) {
            var communityResult = communityResults.Activities[i];

            var communityLi = document.createElement("li");
            communityUl.appendChild(communityLi);

            var communityLink = document.createElement("a");
            communityLink.setAttribute("class", "activityText");
            communityLink.setAttribute("href", linkPrefix + "#!streams/" + communityResult.FeedId + "/activities/" + communityResult.Id);
            communityLink.appendChild(document.createTextNode(communityResult.Text));

            var communityLinkInfo = document.createElement("div");
            communityLinkInfo.setAttribute("class", "activityInfo");

            var createdByA = document.createElement("a");
            createdByA.setAttribute("class", "activityCreator");
            createdByA.setAttribute("href", linkPrefix + "#!streams/" + communityResult.CreatedBy + "/activities");
            createdByA.appendChild(document.createTextNode(communityResult.CreatedByDisplayName));

            var toSpan = document.createElement("span");
            toSpan.appendChild(document.createTextNode(" to "));

            var feedUrl = communityResult.FeedUrl != null ? topicPrefix + communityResult.FeedUrl : linkPrefix + "#!streams/" + communityResult.FeedId + "/activities";

            var pageA = document.createElement("a");
            pageA.setAttribute("class", "activityFeed");
            pageA.setAttribute("href", feedUrl);
            pageA.appendChild(document.createTextNode(communityResult.FeedName));

            var postedOn = new MadCap.Utilities.DateTime(communityResult.PostedUtc);
            var postedTimeSpan = new MadCap.Utilities.TimeSpan(postedOn.Date, utcNow);

            var postedOnSpan = document.createElement("span");
            postedOnSpan.setAttribute("class", "activityTime");
            postedOnSpan.appendChild(document.createTextNode(postedTimeSpan.ToDurationString()));

            communityLinkInfo.appendChild(createdByA);
            communityLinkInfo.appendChild(toSpan);
            communityLinkInfo.appendChild(pageA);
            communityLinkInfo.appendChild(postedOnSpan);

            communityLi.appendChild(communityLink);
            communityLi.appendChild(communityLinkInfo);
        }
    }
})();