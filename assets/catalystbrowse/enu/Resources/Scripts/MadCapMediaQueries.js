(function () {
    MadCap.MediaQueries = MadCap.CreateNamespace("MediaQueries");

    var MQ = MadCap.MediaQueries;
    var _MobileQuery = null;
    var _TabletQuery = null;
    var _HelpSystem = null;
    var isSkinPreview = MadCap.Utilities.HasRuntimeFileType("SkinPreview");

    var DEFAULT_TABLET_SIZE = 1024; 
    var DEFAULT_MOBILE_SIZE = 760; 

    $(function () {
        MadCap.WebHelp.HelpSystem.LoadHelpSystemDefault().done(function (helpSystem) {
            _HelpSystem = helpSystem;

            if (helpSystem.IsResponsive)
                SetMediumChangeEvents();
        });
    });

    MQ.ApplyListenerToTabletMediaQuery = function (listener, runImmmediately) {
        if (_TabletQuery == null) {
            var breakpoint = isSkinPreview ? DEFAULT_TABLET_SIZE + 1 : _HelpSystem.Breakpoints.mediums.Tablet;
            _TabletQuery = SetMediaQuery(breakpoint);
        }

        _TabletQuery.addListener(listener);

        if(runImmmediately)
            listener(_TabletQuery);
    };

    MQ.ApplyListenerToMobileMediaQuery = function (listener, runImmmediately) {
        if (_MobileQuery == null) {
            var breakpoint = isSkinPreview ? DEFAULT_MOBILE_SIZE + 1 : _HelpSystem.Breakpoints.mediums.Mobile;
            _MobileQuery = SetMediaQuery(breakpoint);
        }

        _MobileQuery.addListener(listener);

        if(runImmmediately)
            listener(_MobileQuery);
    };

    function SetMediaQuery(breakpoint) {
        var query = "only screen and (min-width: " + breakpoint + "px)";
        return window.matchMedia(query);
    }

    function SetMediumChangeEvents() {
        var width = $(window).width();

        var eventObject = {
            bubbles: false,
            detail: {
                medium: _HelpSystem.getLayout(width)
            }
        };
        var event = MadCap.Utilities.CreateEvent('mc_changeMedium', eventObject);

        function onChangeMedium() {
            window.dispatchEvent(event);
        }

        MQ.ApplyListenerToTabletMediaQuery(onChangeMedium);
        MQ.ApplyListenerToMobileMediaQuery(onChangeMedium);
    }
})();