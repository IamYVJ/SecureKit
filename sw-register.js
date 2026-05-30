// Register the service worker so the app works offline after first visit.
// Skipped on file:// (service workers require a real HTTP origin).
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch((err) => {
            console.warn('Service worker registration failed:', err);
        });
    });
}
