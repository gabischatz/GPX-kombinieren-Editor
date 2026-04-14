/**
 * Projekt: Alle Webseiten
 * Version: 1.1.0
 * Autor: Lutz Müller
 * Programmiersprache: JavaScript
 *
 * Scrollverhalten für Seiten mit versteckter Scrollbar.
 * Funktioniert auch dann, wenn die frühere Datei "scrollBehavior.css"
 * in eine Sammeldatei wie "app.css" integriert wurde.
 */
document.addEventListener('DOMContentLoaded', function() {
    const body = document.body;
    let isScrolling = false;
    let scrollTimeout;

    const hasAnyStylesheet = Array.from(document.styleSheets).some(function(sheet) {
        return !!sheet.href;
    });

    if (!hasAnyStylesheet) {
        console.error('Es wurde kein Stylesheet geladen. Das Scroll-Skript wird nicht ausgeführt.');
        body.style.overflow = 'auto';
        return;
    }

    body.style.overflow = 'hidden';

    window.addEventListener('wheel', function() {
        if (!isScrolling) {
            body.style.overflow = 'auto';
            isScrolling = true;
        }
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(function() {
            body.style.overflow = 'hidden';
            isScrolling = false;
        }, 1000);
    }, { passive: false });
});
