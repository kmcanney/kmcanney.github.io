/*!
 * Copyright MadCap Software
 * http://www.madcapsoftware.com/
 * Unlicensed use is strictly prohibited
 *
 * v18.1.8353.25537
 */

(function () {
    if (MadCap.Utilities.IsIE()) {
        return;
    }

    var ID_ATTR = "data-mc-question-id";
    var _isTopicPreview;
    var _helpSystem;
    var _lms;
    var _recordedAnswerData = false;

    var TestData = {};

    var ELearning = MadCap.CreateNamespace('ELearning');
    ELearning.RecordQuestionAnswerData = RecordQuestionAnswerData;

    LoadELearningData();

    function LoadELearningData() {
        $.when(MadCap.LMS.Load(), MadCap.WebHelp.HelpSystem.LoadHelpSystemDefault()).done(function (lmsData, helpSystem) {
            _lms = lmsData[0];
            data = lmsData[1];
            TestData = data.testData;
            _helpSystem = helpSystem;
            InitPage(data);
        });
    }

    function InitPage(data) {
        $(function () {
            _isTopicPreview = $("html").attr("data-mc-in-preview-mode") === "true";

            if (!_isTopicPreview) {
                if (origin === "null" && _helpSystem.HasELearning && !MadCap.Utilities.IsChromium())
                    console.error("Viewing local eLearning content in non-Chromium browser. Some features may not be supported.");

                if (NeedRedirectToResultsPage(data))
                    NavigateToEndingPage(_lms.GetPassedTest());

                // only track topic pages
                if (MadCap.Utilities.HasRuntimeFileType("Topic"))
                    _lms.TrackUserLocation();
            }

            if ($(".testResultsProxy").length === 0)
                InitMultipleChoice(data.testData);

            if (!_isTopicPreview)
                InitNextTopicButton();

            InitProgressBar(_helpSystem, data.testData);
            InitResultsProxy(data);
        });
    }

    // changes next topic button to complete button on the last page.
    function CreateCompleteButton(jumpToResultsPage) {
        function GetString(prop) {
            return _helpSystem.GetLanguageString('ToolbarItem.Complete', true, 'ELearningToolbar', prop, 'Complete');
        }

        let $buttons = $('.eLearningToolbarProxy .next-topic-button');
        $buttons.off();
        $buttons.removeClass("next-topic-button").addClass("complete-button");
        $buttons.attr('title', GetString("Tooltip"));

        $buttons.find(".button-icon-wrapper").attr('aria-label', GetString("AltText"));
        $buttons.find('.button-text').text(GetString("Label"));

        $buttons.on('click', function (e) {
            RecordQuestionAnswerData();
            let scoreData = GetScoreData();

            _lms.SubmitTest(scoreData).done(function () {
                if (jumpToResultsPage)
                    NavigateToEndingPage(scoreData.passed);
                else
                    MadCap.Navigate.NextTopic();
            });
        });
    }

    function ShowQuestionFeedback($submit, $question) {
        var id = $question.attr(ID_ATTR);

        var $visible = $submit.siblings(".topicQuestionFeedback:visible");
        if ($visible.length > 0) {
            $visible.fadeOut(fadeInFeedback);
        } else {
            fadeInFeedback();
        }

        function fadeInFeedback() {
            var isCorrect = _isTopicPreview ? IsCorrectPreviewAnswer($question) : IsCorrectAnswer(GetSelectedAnswers($question), id);
            var cls = isCorrect ? ".correctFeedback" : ".incorrectFeedback";
            $submit.siblings(cls).fadeIn();
        }
    }

    function IsCorrectPreviewAnswer($multiChoice) {
        var selected = GetSelectedAnswers($multiChoice);
        var correct = GetChoiceValues($multiChoice.find("[data-mc-correct-answer='true'] input"));
        return JSON.stringify(selected) === JSON.stringify(correct);
    }

    function InitMultipleChoiceListeners($question, $submit) {
        $question.find("input").on("click", function () {
            let hasValue = $question.find("input:checked").length > 0;
            if (!hasValue) {
                $submit.prop("disabled", true);
                $question.prop("submitted", false);
                UpdateNextTopicButtonStatus();
                return;
            }

            if ($submit.length > 0)
                $submit.prop("disabled", false);
            else {
                $question.prop("submitted", true);
                UpdateNextTopicButtonStatus();
            }
        });

        $submit.on("click", function (e) {
            e.preventDefault();

            $question.prop("submitted", true)
            UpdateNextTopicButtonStatus();
            ShowQuestionFeedback($submit, $question);
        });
    }

    function SetAnswerFromSaveData($question, $submit, id) {
        var answerValues = _lms.GetUserAnswerData()[id];
        if (answerValues) {
            $question.prop("submitted", true);
            $submit.prop("disabled", false);
            $.each(answerValues, function (i, val) {
                $question.find('input[value=' + val + ']').prop('checked', true);
            });
        }
    }

    function InitMultipleChoice(testData) {
        $(".multipleChoice").each(function () {
            let $question = $(this);
            let $submit = $question.find("button.submitQuestionButton");
            let id = $question.attr(ID_ATTR);

            if (testData.testQuestionAnswer[id] && testData.randomize) {
                $question.find('input').prop('checked', false);
                $question.randomize(".multipleChoiceItem");
            }

            FadeInHiddenEl(".multipleChoiceItem");
            InitMultipleChoiceListeners($question, $submit);
            SetAnswerFromSaveData($question, $submit, id);
        });
    }

    function InitNextTopicButton() {
        var jumpToResultsPage = GetIsLastCoursePageData();
        if (typeof jumpToResultsPage !== "undefined")
            CreateCompleteButton(jumpToResultsPage);
        UpdateNextTopicButtonStatus();
    }

    function UpdateNextTopicButtonStatus() {
        if (_isTopicPreview)
            return;

        let answered = AnsweredAllRequiredPageQuestions();
        let $complete = $(".eLearningToolbarProxy .complete-button");
        let $nextTopic = $(".eLearningToolbarProxy .next-topic-button");

        if (answered) {
            $complete.prop("disabled", false);
            MadCap.Navigate.SetButtonState($nextTopic);
        } else {
            $complete.prop("disabled", true);
            $nextTopic.prop("disabled", true);
        }
    }

    // Session Storage Region
    function RecordQuestionAnswerData() {
        if (_recordedAnswerData)
            return;
        else
            _recordedAnswerData = true;

        let $questions = $('.multipleChoice');
        let data = {};
        $questions.each(function () {
            let $this = $(this);
            if (typeof $this.prop("submitted") === "undefined")
                return;

            let currentId = $(this).attr(ID_ATTR);
            let selectedAnswers = GetSelectedAnswers($(this));

            if (selectedAnswers.length > 0)
                data[currentId] = selectedAnswers;
        });

        _lms.RecordAnswers(data);
    }

    function NeedRedirectToResultsPage(data) {
        let url = new MadCap.Utilities.Url(window.location.href).PlainPath;
        let inTestTopic = data.testTopics.includes(url);
        if (!inTestTopic)
            return false;

        return HasMaxedAttempts(data);
    }

    function HasMaxedAttempts(data) {
        const testRetries = data.testData.testRetries;
        return testRetries !== -1 && ((_lms.GetTestAttempts() - 1) >= testRetries);
    }

    // Test Scoring Region

    function GetScoreData() {
        var current = GetScore(false);
        var percentage = current / TestData.max;
        var passed = percentage >= TestData.passScore;
        return {
            current: current,
            percentage: percentage,
            passed: passed,
            max: TestData.max,
            passScore: TestData.passScore,
        };
    }

    function AnsweredAllLessonQuestions() {
        var answeredKeys = Object.keys(_lms.GetUserAnswerData());
        var testKeys = Object.keys(TestData.testQuestionAnswer);

        if (answeredKeys.length < testKeys)
            return false;

        return testKeys.every(function (val) {
            return answeredKeys.indexOf(val) >= 0;
        });
    }

    function GetIncompleteTopics() {
        var incomplete = [];
        $.each(TestData.testQuestionAnswer, function (id, data) {
            if (_lms.GetUserAnswerData().hasOwnProperty(id))
                return;

            var topic = {
                url: data.sourceUrl,
                title: data.title
            }
            if (!incomplete.includes(topic))
                incomplete.push(topic);
        });
        return incomplete;
    }

    function AnsweredAllRequiredPageQuestions() {
        return $('.multipleChoice').toArray().every(function (el) {
            let $el = $(el);
            if ($el.parent('.mc-clone').length > 0)
                return true;

            let id = el.attributes[ID_ATTR].value;
            let questionData = GetAllQuestionAnswer(id);
            let required = questionData ? questionData.r : false;
            return !required || AnsweredQuestion($el);
        });
    }

    function AnsweredQuestion($question) {
        return $question.prop("submitted");
    }

    function GetScore(useSubmitted) {
        var correctAnswers = 0;
        const userAnswerData = useSubmitted ? _lms.GetSubmittedAnswerData() : _lms.GetUserAnswerData();
        $.each(userAnswerData, function (id) {
            if (typeof TestData.testQuestionAnswer[id] !== "undefined" && IsCorrectAnswer(userAnswerData[id], id))
                correctAnswers++;
        });
        return correctAnswers;
    }

    function IsCorrectAnswer(userAnswer, id) {
        var correctAnswer = GetAllQuestionAnswer(id);
        return correctAnswer && JSON.stringify(userAnswer.sort()) == JSON.stringify(correctAnswer.i.sort());
    }

    function GetAllQuestionAnswer(id) {
        let qa = TestData.testQuestionAnswer[id];
        if (!qa) {
            qa = TestData.nonTestQuestionAnswer[id];
            if (!qa)
                qa = TestData.nonTocQuestionAnswer[id];
        }
        return qa;
    }
    
    function GetSelectedAnswers($question) {
        var $currentSelected = $question.find('input:checked');
        return GetChoiceValues($currentSelected);
    }

    function GetChoiceValues($choices) {
        var selectedAnswers = [];
        $choices.each(function () {
            var val = parseInt($(this).val())
            selectedAnswers.push(val);
        });

        return selectedAnswers.sort(function (ans1, ans2) { return ans1 > ans2; });
    }

    // Page Navigation
    function GetIsLastCoursePageData() {
        if (_isTopicPreview)
            return false;

        var path = _helpSystem.GetPatchedPath(decodeURI(_helpSystem.GetCurrentTopicPath()));
        var currentPage = new MadCap.Utilities.Url(path);

        return TestData.lastTopics[currentPage.PlainPath];
    }

    function NavigateToEndingPage(passed) {
        var url = passed ? TestData.passedUrl : TestData.failedUrl;
        var href = _helpSystem.GetPath() + encodeURI(url);
        window.location.href = _helpSystem.GetAppliedSkinPath(href);
    }

    //  Progress Bar
    function InitProgressBar(helpSystem, testData) {
        GetProgressBarData(helpSystem, testData, function (index, total) {
            var $element = InitializeProgressBar(index, total);
            $(function () {
                $('.next-topic-button').parent().append($element);
                FadeInHiddenEl(".elearning-progress-wrapper");
            });
        });
    }

    function FadeInHiddenEl(selector) {
        let cls = selector + ".mc-el-hidden";
        $(cls).animate({ opacity: 1 }, "fast");
    }

    function GetProgressBarData(helpSystem, testData, callback) {
        var tocData = helpSystem.LoadTocDataFromQuery();
        helpSystem.FindNode("Toc", tocData.TocPath, tocData.Href, function (tocNode) {
            if (typeof tocNode === "undefined")
                return;

            var index = tocNode.i;
            var prevUnlinkedEntries = 0;

            while (testData.unlinkedEntries[prevUnlinkedEntries] < index) {
                prevUnlinkedEntries++;
            }

            if (prevUnlinkedEntries >= testData.numOfTopics) {
                console.error("Error calculating progress percentage");
                return;
            }

            var linkedIndex = index - prevUnlinkedEntries + 1;
            var totalLinked = testData.numOfTopics - (testData.unlinkedEntries.length + 1);
            if (totalLinked === 0)
                totalLinked = 1;

            callback(linkedIndex, totalLinked);
        });
    }

    function InitializeProgressBar(index, total) {
        let string = _helpSystem.GetLanguageString('Progress Text', true, 'ELearningToolbar', 'Label', "Page {index} of {total}");
        let formatted = string.replace("{index}", index).replace("{total}", total);

        $(".elearning-progress-bar-inner").css("width", (index / total * 100) + "%");
        $(".elearning-progress-text").text(formatted);
    }

    // Results Proxy
    function InitResultsProxy(data) {
        var $proxy = $(".testResultsProxy");
        if ($proxy.length === 0)
            return;

        if (!AnsweredAllLessonQuestions()) {
            let maxedAttempts = HasMaxedAttempts(data);
            if (maxedAttempts) {
                // case where there was a redirect to the results page
                let $warning = CreateMaxedRetriesWarning();
                $proxy.append($warning);
            } else {
                let incompleteTopics = GetIncompleteTopics();
                let $warning = CreateTestWarningEl(incompleteTopics);
                $(".testResultsProxy").append($warning);
                return;
            }
        }

        _lms.ResetSuspendData();

        var initData = data.resultsConfig;
        var $results = CreateResultsElement(initData);
        $proxy.append($results);

        MadCap.TextEffects.Init($results)
        MadCap.Topic.Init($results);

        function CreateResultsElement(initData) {
            var $container = $("<div>");
            var append = function ($el) { $container.append($el) };

            const passed = _lms.GetPassedTest();
            append(GetResultsTitleElement());

            if (initData.ShowScore)
                append(GetResultsScoreElement(initData));

            append(GetResultsStatus(passed, initData.ShowPassFail));

            if (initData.ShowQuestions) {
                let $questionResultBlock = $("<div class='results-questions-block'>");
                $.each(TestData.testQuestionAnswer, function (id, questionData) {
                    let $element = GetQuestionElement(id, questionData, initData);
                    if ($element !== null)
                        $questionResultBlock.append($element);
                });
                append($questionResultBlock);
            }

            return $container;
        }

        function GetResultsTitleElement() {
            return $("<p class='results-title' role='heading'>").html(GetTitleText());
        }

        function GetResultsStatus(passed, showPassFail) {
            let $resultBlock = $("<div class='results-status'>");

            if (showPassFail) {
                var cls = passed ? "passed" : "failed";
                var statusText = passed ? GetPassedText() : GetFailedText();
                var $status = $("<div>").addClass(cls).html(" " + statusText);
                $resultBlock.append($status);
            }

            return $resultBlock;
        }

        function CreateMaxedRetriesWarning() {
            let string = GetResultsLanguageString("Maxed Attempts Warning", 'You have reached the maximum number of attempts');
            let $div = $("<div class='elearning-warning elearning-maxed-attempts-warning'>")
            $div.text(string);

            return $div;
        }

        function GetResultsScoreElement(initData) {
            let $score = $("<p class='results-score'>").text(GetScoreText());
            let $el = GetScoreCorrectnessSpan(initData);
            $score.append($el);

            return $score;
        }

        function GetScoreCorrectnessSpan(initData) {
            let score = GetScore(true);
            let max = data.testData.max;
            let usePercentage = initData.UsePercentage && max !== 0;

            let text = usePercentage ? GetScorePercentageText(score, max) : GetScoreTotalText(score, max);
            return $("<span>").text(text);
        }

        function GetQuestionElement(id, questionData, initData) {
            const submittedAnswerData = _lms.GetSubmittedAnswerData();
            var userAnswer = submittedAnswerData[id];
            if (!questionData)
                return null;

            var answers = questionData.a;
            var $container = $("<div class='results-question-wrapper'>");
            $container.append("<div class='results-question'>" + MadCap.Utilities.SanitizeHtml(questionData.q) + "</div>");

            if (initData.ShowUserAnswers) {
                let $el = CreateAnswerElement("results-user-answer",
                    GetUserAnswerTitleText(), GetAnswersString(answers, userAnswer));
                $container.append($el);
            }

            if (initData.ShowCorrectAnswers) {
                let $el = CreateAnswerElement("results-correct-answer",
                    GetCorrectAnswerTitleText(), GetAnswersString(answers, questionData.i));
                $container.append($el);
            }

            if (initData.ShowQuestionFeedback) {
                var correct = IsCorrectAnswer(userAnswer, id);
                var text = MadCap.Utilities.SanitizeHtml(correct ? questionData.cf : questionData.icf);
                var cls = "questionFeedback resultsQuestionFeedback " + (correct ? "correctFeedback" : "incorrectFeedback");
                if (text !== "") {
                    var $feedback = $("<div class='" + cls + "'>" + text + "</div>");
                    $container.append($feedback);
                }
            }

            FixLinks($container, questionData)
            return $container;
        }

        function CreateAnswerElement(cls, title, content) {
            var $userAnswer = $('<div class="results-answer">');
            $userAnswer.addClass(cls);

            var $title = $("<div class='answer-title'>").text(title);
            var $content = $("<div class='answer-content'>").html(content);

            $userAnswer.append($title);
            $userAnswer.append($content);
            return $userAnswer;
        }

        function GetAnswersString(answers, selected) {
            var arr = [];
            for (var i = 0; i < selected.length; i++) {
                let $answerItem = $("<div class='answer-content-item'>").html(answers[selected[i]]);
                arr.push($answerItem[0].outerHTML);
            }

            return arr.join('');
        }

        function FixLinks($el, questionData) {
            let topicFolder = new MadCap.Utilities.Url(questionData.sourceUrl).Path;

            fix("src");
            fix("href");

            function fix(attr) {
                var $elements = $el.find("[" + attr + "]");
                $elements.each(function () {
                    var $this = $(this);
                    var original = $this.attr(attr);
                    if (original === "#" || new MadCap.Utilities.Url(original).IsAbsolute)
                        return;

                    var newLink = topicFolder + original;
                    $this.attr(attr, newLink);
                })
            }
        }

        function CreateTestWarningEl(incompleteTopics) {
            $('.elearning-incomplete-warning').remove();

            let cls = "elearning-warning elearning-incomplete-warning";
            let $warning = $('<div>').addClass(cls).text(GetIncompleteTextString());

            if (typeof incompleteTopics !== 'undefined')
                $warning.append(GetIncompleteTopicsWarning());

            return $warning;

            function GetIncompleteTextString() {
                let def = "You have not completed all of the questions in this test.";
                return GetResultsLanguageString('Incomplete Test Warning', def);
            }

            function GetIncompleteTopicsWarning() {
                var $wrapper = $("<ul>");
                incompleteTopics.forEach(function (el) {
                    $wrapper.append(CreateIncompleteTopicWarning(el.title, el.url));
                });
                return $wrapper;
            }

            function CreateIncompleteTopicWarning(title, url) {
                if (typeof title === 'undefined') //temporary
                    console.error("Topic title not found");
                var $link = $("<a>").attr('href', url).text(title);
                return $('<li>').append($link);
            }
        }

        // Localized strings from skin
        function GetTitleText() {
            let def = "{Course Name}";
            let title = GetResultsLanguageString('Title', def);
            return title.replace(def, TestData.title)
        }

        function GetFailedText() {
            return GetResultsLanguageString('Result.Failed', 'Failed');
        }

        function GetPassedText() {
            return GetResultsLanguageString('Result.Passed', 'Passed');
        }

        function GetScorePercentageText(score, max) {
            var displayPercentage = MadCap.Utilities.Round((score / max) * 100, 2);
            let text = GetResultsLanguageString('Score.Percentage', '{Percentage}%');
            return text.replace("{Percentage}", displayPercentage);
        }

        function GetScoreTotalText(score, max) {
            let text = GetResultsLanguageString('Score.Total Correct', '{Correct} of {Total} Correct');
            return text.replace("{Correct}", score).replace("{Total}", max);
        }

        function GetScoreText() {
            return GetResultsLanguageString('Score Title', 'Score: ');
        }

        function GetUserAnswerTitleText() {
            return GetResultsLanguageString('Answer Title.User Answer', 'Your Answer: ');
        }

        function GetCorrectAnswerTitleText() {
            return GetResultsLanguageString('Answer Title.Correct Answer', 'Correct Answer: ');
        }

        function GetResultsLanguageString(elementName, def) {
            return _helpSystem.GetLanguageString(elementName, true, 'TestResults', 'Label', def);
        }
    }
})();