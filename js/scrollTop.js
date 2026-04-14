/**
 * Projekt: Alle Webseiten
 * Version: 1.0.0
 * Autor: Lutz Müller
 * Programmiersprache: JavaScript
 * Datum: 13.3.2025, 15:07:22
 *
 * Setzt die Scrollposition nach dem Laden der Seite auf den Anfang (x=0, y=0).
 *
 * - `history.scrollRestoration` wird auf 'manual' gesetzt, um das automatische Zurücksetzen durch den Browser zu verhindern.
 * - `window.scrollTo(0, 0)` sorgt dafür, dass die Seite immer ganz oben beginnt.
 *
 * Vorteile:
 * - Verhindert, dass der Browser die letzte Scrollposition speichert.
 * - Nützlich für Single Page Applications (SPA) oder Landing Pages.
 *
 * @listens DOMContentLoaded
 */
document.addEventListener('DOMContentLoaded', function() {
    if (history.scrollRestoration) {
        history.scrollRestoration = 'manual';
    }
    window.onbeforeunload = function() {
        window.scrollTo(0, 0);
    };
    window.onload = function() {
        setTimeout(function() {
            window.scrollTo(0, 0);
        }, 100);
    };
});
