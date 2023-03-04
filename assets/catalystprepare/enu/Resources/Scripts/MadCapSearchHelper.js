/// <reference path="MadCapMicroContentComponent.js" />

/*!
 * Copyright MadCap Software
 * http://www.madcapsoftware.com/
 * Unlicensed use is strictly prohibited
 *
 * v18.1.8353.25537
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
        DoMicroContentSearch: DoMicroContentSearch,
        MicroContentSearch: MicroContentSearch, //gets overriden in MadCap.Search.Elastic.js
        SetSelectedSearchQuery: SetSelectedSearchQuery,
        SearchPrefixTri: _searchPrefixTri,
        SkinPreviewPhraseSuggestion: {
            SearchQuery: "",
            AutoSuggestion: "",
            SearchResults: []
        }
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

    function SearchHandler(targetName, searchQuery, options) {
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

        $("#resultList, .featured-snippets-container, #knowledge-panel, #knowledge-panel-middle").remove();

        if (isTriPane)
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

        var searchHandler = isSkinPreview ? SearchHandler : MadCap.SearchHelper.SearchHandler;
        searchHandler(_HelpSystem.TargetName, searchQuery, options).then(function (results) {
            BuildSearchResults(searchQuery, results, resultStartNum);
        });

        // show search results
        $("body").removeClass("active");
    }

    function SearchFormSubmit(e) {
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

    function DoMicroContentSearch($microContentContainer, scopeID, resultsLimit, isRandomResults, searchQuery) {
        var searchPane = new MadCap.WebHelp.SearchPane(_HelpSystem, $microContentContainer);
        var searchHandler = isSkinPreview ? MicroContentSearch : MadCap.SearchHelper.MicroContentSearch;
        return searchHandler(searchPane, scopeID, resultsLimit, isRandomResults, searchQuery);
    }

    function MicroContentSearch(searchPane, scopeID, resultsLimit, isRandomResults, searchQuery) {
        return searchPane.MicroContentSearch(scopeID, resultsLimit, isRandomResults, searchQuery);
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

    // curPage is the clicked on page number
    // resultsPerPage is the number of results shown per page
    function BuildSearchResults(searchQuery, results, curPage) {
        var currentSkin = _HelpSystem.GetCurrentSkin();
        var displayCommunityResults = (!currentSkin && _HelpSystem.DisplayCommunitySearchResults) ||
            (currentSkin && currentSkin.DisplayCommunitySearchResults != "false");

        var featuredSnippetsViewMode, knowledgePanelViewMode;
        if (curPage === 1 && currentSkin && currentSkin.MicroContentOptions) {
            featuredSnippetsViewMode = currentSkin.MicroContentOptions.FeaturedSnippetsViewMode;
            knowledgePanelViewMode = currentSkin.MicroContentOptions.KnowledgePanelViewMode;
        }

        var $searchPane = $("#searchPane");
        var $resultsHeading = $("#results-heading");
        var headingEl = $resultsHeading[0];
        var paginationEl = $("#pagination");
        var linkPrefix = isTriPane ? "#" : "";

        var length = results.contentTotal;
        var microContentLength = results.microContent ? results.microContent[0].length + results.microContent[1].length : 0;
        var totalLength = length;
        totalLength += (displayCommunityResults && results.community != null) ? results.community.TotalRecords : 0;
        totalLength += results.glossary ? 1 : 0;
        totalLength += microContentLength;

        MadCap.SkinHelper.SetSkinPreviewStyle(headingEl, "Search Heading");

        $(".query", headingEl).text("\"" + decodeURIComponent(searchQuery) + "\"");
        $(".total-results", headingEl).text(totalLength);

        if (curPage < 1 || curPage > Math.ceil(length / _HelpSystem.ResultsPerPage)) {
            paginationEl.css("display", "none");
        }

        MadCap.Utilities.RemoveDynamicStylesheets($searchPane[0]);
        var dynamicStylesheets = [];

        if (curPage === 1 && results.microContent) {
            var i, $fsContainer, $kpContainer, $kpmContainer, viewMode;

            if (results.microContent[0].length > 0) {
                viewMode = $(_SearchPane._Container).attr('data-mc-featured-snippets-view-mode');
                if (!viewMode) viewMode = featuredSnippetsViewMode;

                $fsContainer = MadCap.MicroContentHelper.BuildContainer(viewMode, "featured-snippets-container");
                $fsContainer.insertAfter($resultsHeading);
                MadCap.MicroContentHelper.PopulateContainer($fsContainer, viewMode,
                    results.microContent[0], linkPrefix, dynamicStylesheets);

                if (viewMode === 'Truncated')
                    setTimeout(function () {
                        MadCap.MicroContentHelper.InitContainer($fsContainer);
                    }, 100);
                else {
                    MadCap.MicroContentHelper.InitContainer($fsContainer);
                }
            }

            if (results.microContent[1].length > 0) {
                viewMode = $(_SearchPane._Container).attr('data-mc-knowledge-panel-view-mode');
                if (!viewMode) viewMode = knowledgePanelViewMode;

                var $x = $('<div>').attr("id", "knowledge-panel").insertBefore($searchPane);
                var $y = $('<div>').attr("id", "knowledge-panel-middle").insertAfter($resultsHeading);

                $kpContainer = MadCap.MicroContentHelper.BuildContainer(viewMode, "knowledge-panel-container");
                if ($x.css('display') === 'none')
                    $kpContainer.appendTo($y);
                else
                    $kpContainer.appendTo($x);
                MadCap.MicroContentHelper.PopulateContainer($kpContainer, viewMode,
                    results.microContent[1], linkPrefix, dynamicStylesheets);

                if (viewMode === 'Truncated')
                    setTimeout(function () {
                        MadCap.MicroContentHelper.InitContainer($kpContainer);
                        if ($kpmContainer) MadCap.MicroContentHelper.InitContainer($kpmContainer);
                    }, 100);
                else {
                    MadCap.MicroContentHelper.InitContainer($kpContainer);
                    if ($kpmContainer) MadCap.MicroContentHelper.InitContainer($kpmContainer);
                }
            }
        }

        if (dynamicStylesheets.length) {
            MadCap.Utilities.LoadDynamicStylesheets(dynamicStylesheets, $searchPane[0]);
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
                MadCap.SkinHelper.SetSkinPreviewStyle(div, "Search Glossary Result");

                var divTerm = document.createElement("div");
                $(divTerm).addClass("term");
                MadCap.SkinHelper.SetSkinPreviewStyle(divTerm, "Search Glossary Term");
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
                    MadCap.SkinHelper.SetSkinPreviewStyle(divDef, "Search Glossary Definition");
                    div.appendChild(divDef);
                }

                li.appendChild(div);
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
                    MadCap.SkinHelper.SetSkinPreviewStyle(a, "Search Result Link");
                    AssembleSearchResultTextNode(highlighted, a, title, results);
                    h3.appendChild(a);

                    if (abstractText != null) {
                        var divDesc = document.createElement("div");
                        $(divDesc).addClass("description");
                        MadCap.SkinHelper.SetSkinPreviewStyle(divDesc, "Search Result Abstract");
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
                    MadCap.SkinHelper.SetSkinPreviewStyle(cite, "Search Result Path");
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
