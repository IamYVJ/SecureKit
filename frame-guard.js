// ============================================
// FRAME GUARD - SecureKit
// ============================================
//
// The CSP on every page used to declare `frame-ancestors 'none'`, but that
// directive is ignored when the policy is delivered in a <meta> tag - it is
// header-only by spec. Browsers say so in the console, and the pages were in
// fact fully frameable: the Secure tool, password field and all, rendered
// inside a third-party iframe.
//
// A static site cannot send headers, so the check happens here instead. The
// real fix is a `Content-Security-Policy: frame-ancestors 'none'` response
// header where one can be configured; this stays useful regardless, and is
// what protects the app on a plain static host.
//
// Loaded first in <head>, before any content is parsed, so a framed page never
// paints. It is a separate file rather than an inline script because
// `script-src 'self'` blocks inline code.

(function () {
    'use strict';

    // Comparing against window.top is allowed cross-origin; reading its
    // location is not, which is why the escape below is guarded.
    var framed;
    try {
        framed = window.self !== window.top;
    } catch (error) {
        // Even the comparison being blocked means something is wrapping us.
        framed = true;
    }

    if (!framed) {
        return;
    }

    // Hide first, ask questions later: documentElement already exists while
    // <head> is being parsed, so nothing of the page is ever shown.
    try {
        document.documentElement.style.setProperty('display', 'none', 'important');
    } catch (error) {
        /* Nothing useful to do; the escape attempt below is the fallback. */
    }

    // Try to replace the framing page. A sandboxed iframe can block this, in
    // which case the page simply stays hidden - the safe outcome either way.
    try {
        window.top.location = window.self.location;
    } catch (error) {
        console.warn('SecureKit refused to run inside a frame, and could not navigate out.');
    }
})();
