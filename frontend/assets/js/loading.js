/*
  System: AXIS PRODUCTION SYSTEM
  Owner : CRONIT SOLLUTIONS
  Author: JMR Prasanna
*/
(function () {
    "use strict";

    var LOADER_DELAY_MS = 1800;
    var MAX_WAIT_FOR_LOGO_MS = 3200;
    var titleEl = document.querySelector(".loading-text");
    var logoEl = document.querySelector(".loading-logo");
    var baseText = titleEl ? titleEl.textContent.replace(/\.+\s*$/, "").trim() : "Starting AXIS PRODUCTION SYSTEM";
    var dotFrame = 0;

    if (titleEl) {
        window.setInterval(function () {
            dotFrame = (dotFrame + 1) % 4;
            titleEl.textContent = baseText + ".".repeat(dotFrame);
        }, 350);
    }

    var startedAt = Date.now();
    var redirected = false;
    var redirectWhenReady = function () {
        if (redirected) return;
        redirected = true;
        var elapsed = Date.now() - startedAt;
        var remain = Math.max(0, LOADER_DELAY_MS - elapsed);
        window.setTimeout(function () {
            window.location.replace("login.html");
        }, remain);
    };

    if (!logoEl || (logoEl.complete && logoEl.naturalWidth > 0)) {
        redirectWhenReady();
        return;
    }

    logoEl.addEventListener("load", redirectWhenReady, { once: true });
    logoEl.addEventListener("error", redirectWhenReady, { once: true });
    window.setTimeout(redirectWhenReady, MAX_WAIT_FOR_LOGO_MS);
})();
