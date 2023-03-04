/*!
 * Copyright MadCap Software
 * http://www.madcapsoftware.com/
 * Unlicensed use is strictly prohibited
 *
 * v18.1.8353.25537
 */

(function () {
    MadCap.Utilities.MessageBus = {};

    var MessageBus = MadCap.Utilities.MessageBus;
    MessageBus._MessageHandlerFuncs = [];
    MessageBus._MessageInfos = [];
    MessageBus._MessageID = 0;

    MessageBus.AddMessageHandler = function (HandlerFunc, contextObj) {
        MessageBus._MessageHandlerFuncs.push({ HandlerFunc: HandlerFunc, ContextObj: contextObj });
    };

    MessageBus.PostMessageRequest = function (win, message, dataValues, callbackFunc) {
        MessageBus._MessageInfos[MessageBus._MessageID] = callbackFunc;
        MessageBus._OnMessage("request", message, dataValues, window, MessageBus._MessageID);
        MessageBus._MessageID++;
    };

    MessageBus._PostMessageResponse = function (win, message, dataValues, messageID) {
        MessageBus._OnMessage("response", message, dataValues, window, messageID);
        MessageBus._MessageID++;
    };

    MessageBus._OnMessage = function (messageType, message, dataValues, eventSource, messageID) {
        if (messageType === "request") {
            OnRequests(message, dataValues, eventSource, messageID);
        } else if (messageType === "response") {
            if (MessageBus._MessageInfos[messageID] != null)
                MessageBus._MessageInfos[messageID](dataValues);
        }
    };

    MessageBus.GetIsCrossFrame = function () {
        return false;
    };

    function OnRequests(message, dataValues, eventSource, messageID) {
        var responseData = [];

        var handlerReturnData = UseMessageHandlerFuncs(message, dataValues, responseData, eventSource, messageID);

        if (!handlerReturnData.Handled) {
            handlerReturnData = UseDefaultMessageHandlers(message, dataValues, responseData);
        }

        if (handlerReturnData.FireResponse)
            MessageBus._PostMessageResponse(eventSource, message, responseData.length > 0 ? responseData : null, messageID);
    }

    function UseMessageHandlerFuncs(message, dataValues, responseData, eventSource, messageID) {
        var handlerReturnData = {
            Handled: false,
            FireResponse: false
        };

        for (var i = 0, length = MessageBus._MessageHandlerFuncs.length; i < length; i++) {
            var handlerData = MessageBus._MessageHandlerFuncs[i];
            var HandlerFunc = handlerData.HandlerFunc;
            var contextObj = handlerData.ContextObj;

            if (contextObj != null)
                handlerReturnData = HandlerFunc.call(contextObj, message, dataValues, responseData, eventSource, messageID);
            else
                handlerReturnData = HandlerFunc(message, dataValues, responseData, eventSource, messageID);

            handled = handlerReturnData.Handled;

            if (handled)
                break;
        }

        return handlerReturnData;
    }

    function UseDefaultMessageHandlers(message, dataValues, responseData) {
        var returnData = {
            Handled: false,
            FireResponse: false
        }

        if (message == "DEBUG-AddLine") {
            message = dataValues[0];
            MadCap.DEBUG.Log.AddLine(message);

            returnData.Handled = true;
        }
        else if (message == "url") {
            responseData.push(document.location.href);

            returnData.Handled = true;
            returnData.FireResponse = true;
        }
        else if (message == "get-title") {
            responseData.push(document.title);

            returnData.Handled = true;
            returnData.FireResponse = true;
        }
        else if (message == "navigate") {
            var path = dataValues[0];
            document.location.href = encodeURI(path);

            returnData.Handled = true;
        }
        else if (message == "get-href") {
            responseData.push(document.location.href);

            returnData.Handled = true;
            returnData.FireResponse = true;
        }
        else if (message == "get-return-url") {
            var url = new MadCap.Utilities.Url(document.location.href);
            var returnUrl = null;

            if (url.Fragment.length > 1) {
                returnUrl = url.QueryMap.GetItem('returnUrl');
            }

            responseData.push(returnUrl);

            returnData.Handled = true;
            returnData.FireResponse = true;
        }
        else if (message == "get-parent-window-width") {
            responseData.push(window.innerWidth);

            returnData.Handled = true;
            returnData.FireResponse = true;
        }
        else if (message == "set-topic-content") {
            LoadTopicContent(dataValues);

            returnData.Handled = true;
        }
        else if (message == "hash-changed") {
            var newHash = dataValues[0];
            newHash = newHash.substring(1);

            history.pushState(null, null, document.location.pathname + document.location.hash + "$" + newHash);

            returnData.Handled = true;
        }
        else if (message == "get-csh-id") {
            responseData.push(MadCap.Default.LoadVarMap().GetItem("cshid"));

            returnData.Handled = true;
            returnData.FireResponse = true;
        }

        return returnData;
    }
})();