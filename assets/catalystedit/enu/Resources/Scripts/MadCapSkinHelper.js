/*!
 * Copyright MadCap Software
 * http://www.madcapsoftware.com/
 * Unlicensed use is strictly prohibited
 *
 * v17.2.8047.30191
 */

(function () {
    MadCap.SkinHelper = MadCap.CreateNamespace("SkinHelper");
    _HelpSystem = null;

    $.extend(MadCap.SkinHelper, {
        ApplyLogoUrl: function (skin) {
            // compute logo url relative to current page
            if (skin.LogoUrl) {
                var logoUrl = new MadCap.Utilities.Url(skin.LogoUrl);

                if (!logoUrl.IsAbsolute & !MadCap.Utilities.HasRuntimeFileType("WebApp")) {
                    var logoPath = _HelpSystem.GetPatchedPath(logoUrl.FullPath);
                    logoUrl = _HelpSystem.GetTopicPath("../" + _HelpSystem.ContentFolder + logoPath);
                }

                $("a.logo").attr("href", MadCap.Utilities.EncodeHtml(logoUrl.FullPath));
            }
        },
        ApplySkinClass: function (skin, _HelpSystem) {
            if (_HelpSystem != null) {
                $.each(_HelpSystem.GetSkins(), function (i, s) {
                    $("html").removeClass(s.SkinClass);
                });
            }

            $("html").addClass(skin.SkinClass);
        }, 
        GetPanePosition: function (skin) {
            if (skin.WebHelpOptions != null)
                return skin.WebHelpOptions.NavigationPanePosition;

            return "Left";
        },
        ApplySkinByName: function (skinName, _HelpSystem) {
            var skin = null;
            if (skinName != null) {
                skin = _HelpSystem.GetSkin(skinName) || _HelpSystem.GetSkinByName(skinName);
            }
            MadCap.SkinHelper.ApplySkin(skin || _HelpSystem.DefaultSkin);
        },
        SetSize: function (skin) {
            if (!skin)
                return;
        
            var useDefaultSize = MadCap.String.ToBool(skin.UseBrowserDefaultSize, true);
        
            if (useDefaultSize)
                return;
        
            var topPx = MadCap.String.ToInt(skin.Top, 0);
            var leftPx = MadCap.String.ToInt(skin.Left, 0);
            var bottomPx = MadCap.String.ToInt(skin.Bottom, 0);
            var rightPx = MadCap.String.ToInt(skin.Right, 0);
            var widthPx = MadCap.String.ToInt(skin.Width, 800);
            var heightPx = MadCap.String.ToInt(skin.Height, 600);
        
            var anchors = skin.Anchors;
        
            if (anchors) {
                var aTop = (anchors.indexOf("Top") > -1) ? true : false;
                var aLeft = (anchors.indexOf("Left") > -1) ? true : false;
                var aBottom = (anchors.indexOf("Bottom") > -1) ? true : false;
                var aRight = (anchors.indexOf("Right") > -1) ? true : false;
                var aWidth = (anchors.indexOf("Width") > -1) ? true : false;
                var aHeight = (anchors.indexOf("Height") > -1) ? true : false;
            }
        
            if (aLeft && aRight)
                widthPx = screen.availWidth - (leftPx + rightPx);
            else if (!aLeft && aRight)
                leftPx = screen.availWidth - (widthPx + rightPx);
            else if (aWidth)
                leftPx = (screen.availWidth / 2) - (widthPx / 2);
        
            if (aTop && aBottom)
                heightPx = screen.availHeight - (topPx + bottomPx);
            else if (!aTop && aBottom)
                topPx = screen.availHeight - (heightPx + bottomPx);
            else if (aHeight)
                topPx = (screen.availHeight / 2) - (heightPx / 2);
        
            if (window == top) {
                window.resizeTo(widthPx, heightPx);
                window.moveTo(leftPx, topPx);
            }
        },

        // functions that get overriden by MadCapTriPane and MadCapFluid
        ApplySkin: function () { },
        SwitchPanePosition: function () { },
        InitFoundationPreviewMenu: function () { },
        OnLayout: function () { },
        OnHelpSystemLoad: function () { }
    });

    if (MadCap.WebHelp && MadCap.WebHelp.HelpSystem) {
        MadCap.WebHelp.HelpSystem.LoadHelpSystemDefault().done(function (helpSystem) {
            _HelpSystem = helpSystem;
            MadCap.SkinHelper.OnHelpSystemLoad(helpSystem);
        });
    }
})();