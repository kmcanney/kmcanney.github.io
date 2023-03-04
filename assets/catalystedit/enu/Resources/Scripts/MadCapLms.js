/*!
 * Copyright MadCap Software
 * http://www.madcapsoftware.com/
 * Unlicensed use is strictly prohibited
 *
 * v17.2.8047.30191
 */

(function () {
    if (MadCap.Utilities.IsIE()) {
        console.error("eLearning and LMS functionality not supported in Internet Explorer");
        return;
    }

    var _inWrapper = MadCap.Utilities.HasRuntimeFileType("SCORM") || MadCap.Utilities.HasRuntimeFileType("TriPane");
    var _isTopicPreview;
    var _lmsDataPromise;

    // when using SCORM / TriPane we're just going to redirect to the parent's API, since in the iframe,
    // we don't have a connection with the LMS
    if (NeedGetParentLms()) {
        MadCap.LMS = window.parent.MadCap.LMS;
        return;
    }

    function NeedGetParentLms() {
        var sameOrigin = document.domain != "" && MadCap.Utilities.SameOriginAsParent()
        if (!_inWrapper && sameOrigin) {
            return window.parent.MadCap && window.parent.MadCap.LMS;
        }

        return false;
    }

    var LMS = MadCap.CreateNamespace('LMS');
    LMS.Load = GetLmsDataPromise;

    LMS.Resume = function (fallback) {
        RunApiFunction(function (api) {
            api.Resume(fallback);
        });
    }

    LMS.ResetTest = function () {
        RunApiFunction(function (api) {
            api.ResetTest();
        })
    }

    function LmsApi(apiHandler, eLearningData) {
        const SUS_DATA_KEY = "mc-suspend-data-" + encodeURIComponent(eLearningData.testData.id);
        const _inLaunchPage = !MadCap.Utilities.HasRuntimeFileType("Topic");

        let _suspendData; 
        let _hasSubmitted = false;

        InitSuspendData();

        this.Resume = function (fallback) {
            const visited = _suspendData.visited;
            const page = visited[visited.length - 1];
            const root = new MadCap.Utilities.Url(window.location.href).Path;

            if (!apiHandler.IsEmpty && page && page.startsWith(root)) {
                apiHandler.Navigate(page);
            } else {
                fallback();
            }
        }

        this.SubmitTest = function (scoreData) {
            if (_hasSubmitted)
                return $.when();

            _hasSubmitted = true
            _suspendData.passed = scoreData.passed;
            _suspendData.testAttempts++;
            UpdateSuspendData();

            if (eLearningData.useQuizForSuccess)
                return $.when(apiHandler.SubmitTest(scoreData));
            else
                return $.when();
        }

        this.ResetSuspendData = function () {
            if (Object.keys(_suspendData.questions).length > 0)
                _suspendData.submittedQuestions = _suspendData.questions;
            _suspendData.questions = {};
            _suspendData.visited = [];
            _suspendData.completed = false;
            _hasSubmitted = false;
            UpdateSuspendData();
        }

        this.ResetTest = function () {
            _suspendData = CreateSuspendData();
            UpdateSuspendData();
        }

        this.TrackUserLocation = function () {
            const href = GetPageLink();
            const visited = _suspendData.visited;
            if (!visited.includes(href))
                visited.push(href);

            var completion = eLearningData.useQuizForSuccess ? null : HasCompleted();
            apiHandler.TrackUserLocation(completion);
            if (NeedTrackCompleteLesson())
                CompleteLesson();

            UpdateSuspendData();
        }

        this.RecordAnswers = function (data) {
            const questions = _suspendData.questions;
            for (var id in data) {
                questions[id] = data[id];
                apiHandler.RecordAnswer(id, data[id]);
            }
            UpdateSuspendData();
        }

        this.GetUserAnswerData = function () { return _suspendData.questions; }

        this.GetSubmittedAnswerData = function () { return _suspendData.submittedQuestions; }

        this.GetPercentageCompleted = function (callback) {
            var percentage = (_suspendData.visited.length / eLearningData.numTopics) * 100;
            callback(percentage);
        }

        this.GetTestAttempts = function () { return _suspendData.testAttempts; }

        this.GetPassedTest = function () { return _suspendData.passed; }

        function GetPageLink() {
            var link = apiHandler.GetPageLink();
            link = link ? link : window.location.href;
            return new MadCap.Utilities.Url(link).PlainPath;
        }

        function CompleteLesson() {
            _suspendData.completed = true;
            apiHandler.CompleteLesson();
        }

        function InitSuspendData() {
            if (!_inLaunchPage && sessionStorage[SUS_DATA_KEY]) {
                _suspendData = JSON.parse(sessionStorage[SUS_DATA_KEY]);
                return;
            }

            _suspendData = apiHandler.GetSuspendData();
            if (!_suspendData) {
                _suspendData = CreateSuspendData();
                UpdateSuspendData();
            }
        }

        function CreateSuspendData() {
            return {
                visited: [], questions: {}, submittedQuestions: {},
                testAttempts: 0, completed: false, passed: false
            };
        }

        function UpdateSuspendData() {
            const suspendString = JSON.stringify(_suspendData);
            sessionStorage[SUS_DATA_KEY] = suspendString;

            apiHandler.UpdateSuspendData(_suspendData);
        }

        function NeedTrackCompleteLesson() {
            return !eLearningData.useQuizForSuccess && !_hasSubmitted && IsCompleted();
        }

        function IsCompleted() {
            return (_suspendData.visited.length / eLearningData.numTopics) >= eLearningData.testData.percComplete;
        }

        function HasCompleted() {
            return _suspendData.completed || IsCompleted();
        }
    }

    function RunApiFunction(callback) {
        GetLmsDataPromise().done(function (api) {
            callback(api);
        });
    }

    function GetLmsDataPromise() {
        if (_isTopicPreview)
            return;

        if (!_lmsDataPromise) {
            _lmsDataPromise = $.Deferred();

            MadCap.WebHelp.HelpSystem.LoadHelpSystemDefault().done(function (helpSystem) {
                $.when(LoadLmsApi(helpSystem), helpSystem.GetTestData()).done(function (api, eLearningData) {
                    let apiHandler = null;
                    if (api && api.SCORM)
                        apiHandler = new ScormHandler(api.SCORM, eLearningData);
                    else if (window.ADL)
                        apiHandler = new XApiHandler(eLearningData);
                    else
                        apiHandler = EmptyApiHandler;

                    apiHandler.Init();

                    _lmsDataPromise.resolve(new LmsApi(apiHandler, eLearningData, helpSystem), eLearningData);
                })
            });
        }

        return _lmsDataPromise.promise();
    }

    function LoadLmsApi(helpSystem) {
        const def = $.Deferred();
        if (helpSystem.HasELearning) {
            var path = helpSystem.GetPath() + "Resources/Scripts/lmsapiwrapper.js";
            require([path], function (wrapper) {
                def.resolve(wrapper)
            }, function () {
                def.resolve();
            });
        } else {
            def.resolve();
        }
        return def.promise();
    }

    /**
     * API Handler region. XApi and SCORM. Currently implement
     *      - SubmitTest(scoreData) - submits quiz data to LMS
     *      - CompleteLesson() - tells LMS that user has completed enough of the course
     *      - GetPageLink() - gets link of the current page
     *      - Navigate(href) - Redirects to the given href
     *      - TrackUserLocation() - tracks the pages that the user experienced
     *      - RecordAnswer(id, indeces) - records questions ids and the indeces of their answers
     *      - GetSuspendData() - returns the suspend data for the test
     *      - UpdateSuspendData(suspendData) - updates lms suspend data with the given data
     */
    var EmptyApiHandler = {
        Init: function () { },
        SubmitTest: function () { },
        CompleteLesson: function () { },
        GetPageLink: function () { },
        Navigate: function () { },
        TrackUserLocation: function () { },
        RecordAnswer: function () { },
        GetSuspendData: function () { },
        UpdateSuspendData: function () { },
        IsEmpty: true
    }

    /**
     * Useful Information:
     *     Standard Verbs by Big Brother himself: https://github.com/adlnet-archive/xAPIVerbs/blob/master/verbs.js
     *      - Access by calling "ADL.verbs.{verb name}"
     */
    function XApiHandler(eLearningData) {
        const ID_ENCODED = encodeURIComponent(eLearningData.testData.id);
        const TIME_KEY = "mc-time-key-" + ID_ENCODED;
        const TCKEY = "mc-tc-key-" + ID_ENCODED;
        const SUSPEND_KEY = "mc-test-suspend";

        var _inLaunchPage = !MadCap.Utilities.HasRuntimeFileType("Topic"); // ideally we have a runtime type for launch pages

        let startTimestamp;
        let tinCan = null;

        this.Init = function () {
            if (typeof TinCan !== "undefined")
                tinCan = GetTinCan();
            else
                InitCmi5();

            startTimestamp = GetStartTimestamp();
            if (_inLaunchPage) {
                let statement = MakeTestStatement(ADL.verbs.initialized);
                SendStatement(statement);
            }
        }

        this.SubmitTest = function (scoreData) {
            var statement = MakeScoreStatement(scoreData);
            if (scoreData.passed)
                return $.when(this.CompleteLesson(), SendStatement(statement), Terminate());
            else
                return $.when(SendStatement(statement), Terminate());
        }

        this.CompleteLesson = function () {
            var statement = MakeCompletedStatement();
            return SendStatement(statement);
        }

        this.GetPageLink = function () { return window.location.href; }

        this.Navigate = function (href) { window.location.href = href; }

        this.TrackUserLocation = function (hasCompleted) {
            let exp = SendStatement(MakeExperiencedStatement());
            let attempt = SendStatement(MakeAttemptedStatement(hasCompleted));
            return $.when(exp, attempt);
        }

        this.RecordAnswer = function (id, indeces) {
            const statement = MakeAnsweredStatement(id, indeces);
            return SendStatement(statement);
        }

        this.GetSuspendData = function () {
            if (tinCan) {
                const stateResult = tinCan.getState(SUSPEND_KEY);
                if (stateResult.err === null && stateResult.state !== null && stateResult.state.contents !== "") {
                    return JSON.parse(stateResult.state.contents);
                }
                return null;
            } else {
                const id = eLearningData.testData.id;
                const actor = JSON.parse(ADL.XAPIWrapper.lrs.actor);
                return cmi5Controller.getAllowedState(id, actor, SUSPEND_KEY);
            }
        }

        this.UpdateSuspendData = function (data) {
            if (tinCan)
                tinCan.setState(SUSPEND_KEY, JSON.stringify(data));
            else
                cmi5Controller.sendAllowedState(SUSPEND_KEY, data);
        }

        function Terminate() {
            let statement = MakeTerminatedStatement();
            return SendStatement(statement);
        }

        function ConvertToISO(timeInMS) {
            let seconds = timeInMS / 1000;
            if (seconds > 60) {
                if (seconds > 3600) {
                    const hours = Math.floor(seconds / 3600);
                    const minutes = Math.floor((seconds % 3600) / 60);
                    seconds = (seconds % 3600) % 60;
                    return "PT" + hours + "H" + minutes + "M" + seconds + "S";
                } else {
                    const minutes = Math.floor(seconds / 60);
                    seconds %= 60;
                    return "PT" + minutes + "M" + seconds + "S";
                }
            } else {
                return "PT" + seconds + "S";
            }
        }

        function GetStartTimestamp() {
            if (_inLaunchPage) {
                sessionStorage[TIME_KEY] = new Date();
            }
            return sessionStorage[TIME_KEY];
        }

        // stores the lrs object on the loading / wrapper page, since lrs data isn't stored between pages
        function GetTinCan() {
            if (_inLaunchPage)
                sessionStorage[TCKEY] = window.location.href;
            const url = sessionStorage[TCKEY];

            return new TinCan({
                url: url,
                activity: {
                    id: eLearningData.testData.id,
                    definition: {
                        name: {
                            und: eLearningData.testData.title
                        },
                        description: {
                            und: eLearningData.testData.description
                        },
                        type: "http://adlnet.gov/expapi/activities/assessment"
                    }
                }
            });
        }

        function InitCmi5() {
            cmi5Controller.setEndPoint(parse("endpoint"));
            cmi5Controller.setFetchUrl(parse("fetch"));
            cmi5Controller.setRegistration(parse("registration"));
            cmi5Controller.setActivityId(parse("activityid"));
            cmi5Controller.setActor(parse("actor"));

            let def = $.Deferred();
            cmi5Controller.startUp(function () {
                const statement = MakeLaunchedStatement();
                SendStatement(statement);
                def.resolve();
            }, function (e) { console.error(e) });

            return def.promise();
        }

        function MakeLaunchedStatement() {
            return MakeTestStatement(ADL.verbs.launched);
        }

        function MakeTestStatement(verb) {
            return {
                verb: verb,
                object: {
                    id: eLearningData.testData.id,
                    definition: {
                        name: {
                            und: eLearningData.testData.title
                        }
                    }
                }
            };
        }

        function MakeCompletedStatement() {
            let statement = MakeTestStatement(ADL.verbs.completed);
            statement.result = {
                "success": true,
                "completion": true,
                duration: GetDuration()
            }
            return statement;
        }

        function MakeAttemptedStatement(hasCompleted) {
            let statement = MakeTestStatement(ADL.verbs.attempted);
            statement.result = {
                duration: GetDuration()
            }

            if (hasCompleted !== null)
                statement.result.completion = hasCompleted;

            return statement;
        }

        function MakeTerminatedStatement() {
            let statement = MakeTestStatement(ADL.verbs.terminated);
            statement.result = {
                duration: GetDuration()
            }

            return statement;
        }

        let GetDuration = function () { return ConvertToISO(new Date() - new Date(startTimestamp)); }

        function MakeScoreStatement(scoreData) {
            let verb = scoreData.passed ? ADL.verbs.passed : ADL.verbs.failed;
            let statement = MakeTestStatement(verb);
            statement.result = {
                score: {
                    scaled: scoreData.percentage,
                    raw: scoreData.current,
                    min: 0,
                    max: scoreData.max
                },
                success: scoreData.passed,
                completion: true
            };
            return statement;
        }

        function MakeExperiencedStatement() {
            var verb = ADL.verbs.experienced;
            return {
                verb: verb,
                object: {
                    id: GetActivityId(),
                    definition: {
                        name: {
                            und: document.title
                        }
                    }
                }
            };
        }

        function MakeAnsweredStatement(id, indeces) {
            return {
                verb: ADL.verbs.answered,
                object: {
                    id: CreateXApiQuestionId(id),
                },
                result: {
                    response: JSON.stringify(indeces)
                }
            }
        }

        function CreateXApiQuestionId(questionId) {
            return eLearningData.testData.id + "/" + questionId;
        }

        function SendStatement(statement) {
            const handler = tinCan ? tinCan : cmi5Controller;
            const def = $.Deferred();
            handler.sendStatement(statement, function (resp, obj) {
                console.log("response: ", resp, "\nobject: ", obj);
                def.resolve();
            });
            return def.promise();
        }

        function GetActivityId() {
            var url = new MadCap.Utilities.Url(window.location.href);
            return url.PlainPath;
        }
    }

    /**
     * Interacts with the SCORM api given by the LMS.
     * Datamodel reference: https://scorm.com/scorm-explained/technical-scorm/run-time/run-time-reference/
     */
    function ScormHandler(scormApiObject) {
        // Scorm data models. 
        const SDM_2004 = {
            scaled_score: "cmi.score.scaled",
            raw_score: "cmi.core.score.raw",
            min_score: "cmi.score.min",
            max_score: "cmi.score.max",
            location: "cmi.location",
            passing_score: "cmi.scaled_passing_score",
            success_status: "cmi.success_status",
            completion_status: "cmi.completion_status",
            suspend_data: "cmi.suspend_data", // used for page history
            exit: "cmi.exit"
        }

        const SDM_1_2 = {
            raw_score: "cmi.core.score.raw",
            min_score: "cmi.core.score.min",
            max_score: "cmi.core.score.max",
            location: "cmi.core.lesson_location",
            success_status: "cmi.core.lesson_status",
            completion_status: "cmi.core.lesson_status",
            suspend_data: "cmi.suspend_data", // used for page history
            exit: "cmi.core.exit"
        }

        if (!_inWrapper) {
            window.SCORM = window.parent.SCORM;
            return;
        }

        window.SCORM = scormApiObject;
        $(window).on("beforeunload", function () {
            SCORM.quit();
        });

        let is12, DataModel;

        this.Init = function () {
            SCORM.connection.initialize();
            is12 = SCORM.version === "1.2";
            DataModel = is12 ? SDM_1_2 : SDM_2004;
        }

        this.SubmitTest = function (scoreData) {
            SetScore(scoreData.percentage);
            SetRawScore(scoreData.percentage);
            SetMinScore(0);
            SetMaxScore(100);
            SetPassingScore(scoreData.passScore);
            SetSuccessStatus(scoreData.passed);
            EndSession();

            if (!is12)
                SetCompletionStatus(true);
        }

        this.CompleteLesson = function () {
            SetCompletionStatus(true);

            if(!is12)
                SetSuccessStatus(true);
        }

        this.Navigate = function (href) {
            $('#topic').attr('src', href);
        }

        this.GetPageLink = function () {
            return $('#topic').contents().get(0).location.href;
        }

        this.TrackUserLocation = function () {
            var link = $('#topic').contents().get(0).location.href;
            SetScormValue(DataModel.location, link);
            SCORM.save();
        }

        this.RecordAnswer = function () { };

        this.GetSuspendData = function () {
            const data = SCORM.get(DataModel.suspend_data);
            if (data)
                return JSON.parse(data);
        }

        this.UpdateSuspendData = function (suspendData) {
            SetScormValue(DataModel.suspend_data, JSON.stringify(suspendData));
        }

        function SetScore(percentage) {
            SetScormValue(DataModel.scaled_score, percentage);
        }

        function SetRawScore(rawScore) {
            SetScormValue(DataModel.raw_score, rawScore * 100);
        }

        function EndSession() {
            SetScormValue(DataModel.exit, "");
        }

        function SetMinScore(minScore) {
            SetScormValue(DataModel.min_score, minScore);
        }

        function SetMaxScore(maxScore) {
            SetScormValue(DataModel.max_score, maxScore);
        }

        function SetPassingScore(passingScore) {
            SetScormValue(DataModel.passing_score, passingScore);
        }

        function SetSuccessStatus(passed) {
            var successString = passed ? "passed" : "failed";
            SetScormValue(DataModel.success_status, successString);
        }

        function SetCompletionStatus(completed) {
            var completeString = completed ? "completed" : "incomplete";
            SetScormValue(DataModel.completion_status, completeString);
        }

        // allows easy use of different scorm versions, since they don't all support all properties
        function SetScormValue(property, value) {
            if (property != null)
                SCORM.set(property, value);
        }
    }
})();