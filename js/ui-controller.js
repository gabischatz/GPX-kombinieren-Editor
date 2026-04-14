/**
 * Projekt: GPX-kombinieren-Editor
 * Version: 2.6
 * ui-controller.js
 * Steuerung der Benutzeroberfläche
 * Erstellt: Lutz Müller (2025)
 */

class UIController {
    constructor() {
        this.showGeneratedRoute = false;
        this.pendingDownloadData = null;
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.setupDirectionSelect();
        this.setupTextFieldsDragDrop();
        this.initDictationForDescription(); // 🟩 NEU: Diktierfunktion initialisieren
    }

    setupEventListeners() {
        const self = this;
        
        // Waypoint-Formular
        document.getElementById('btn_add_waypoint').addEventListener('click', function() { 
            self.addWaypoint(); 
        });
        
        document.getElementById('btn_update_waypoint').addEventListener('click', function() { 
            if (window.waypointManager) {
                window.waypointManager.updateWaypointFromForm(); 
            }
        });
        
        document.getElementById('btn_cancel_edit').addEventListener('click', function() { 
            if (window.waypointManager) {
                window.waypointManager.cancelEdit(); 
            }
        });

        // Route Operationen
        document.getElementById('btn_generate').addEventListener('click', function() { 
            self.generateRoute(); 
        });
        
        document.getElementById('btn_download').addEventListener('click', function() { 
            self.downloadGPX(); 
        });

        document.getElementById('btn_clear_route1').addEventListener('click', function() {
            if (window.gpxEditor) window.gpxEditor.clearRoute(1);
        });

        document.getElementById('btn_clear_route2').addEventListener('click', function() {
            if (window.gpxEditor) window.gpxEditor.clearRoute(2);
        });

        document.getElementById('btn_reverse_route1').addEventListener('click', function() {
            if (window.gpxEditor) window.gpxEditor.reverseRoute(1);
        });

        document.getElementById('btn_reverse_route2').addEventListener('click', function() {
            if (window.gpxEditor) window.gpxEditor.reverseRoute(2);
        });

        document.getElementById('btn_toggle_routes').addEventListener('click', function() {
            self.toggleRouteDisplay();
        });

        document.getElementById('btn_clear_waypoints').addEventListener('click', function() {
            if (window.waypointManager) window.waypointManager.clearAllWaypoints();
        });
    }

    // 🟩 NEU: Diktierfunktion für Beschreibungsfeld initialisieren
    initDictationForDescription() {
        console.log('[Dictation] Initialisiere Diktierfunktion für Beschreibungsfeld');
        
        // Warte bis das Formular geladen ist
        setTimeout(() => {
            const descTextarea = document.getElementById('wp_desc');
            
            if (!descTextarea) {
                console.warn('[Dictation] Beschreibungsfeld (wp_desc) nicht gefunden');
                return;
            }

            console.log('[Dictation] Beschreibungsfeld gefunden, initialisiere Diktierfunktion');
            
            // Diktier-Controller initialisieren und anhängen
            this.dictationController = new DictationController();
            this.dictationController.attachToTextarea(descTextarea, {
                lang: 'de-DE',
                hotkey: { ctrlKey: true, shiftKey: true, key: '.' }, // Strg+Umschalt+.
                onToggle: (isOn) => {
                    console.log('[Dictation]', isOn ? 'gestartet' : 'gestoppt');
                    // Visuelles Feedback
                    if (isOn) {
                        descTextarea.style.borderColor = '#28a745';
                        descTextarea.style.boxShadow = '0 0 10px rgba(40, 167, 69, 0.5)';
                    } else {
                        descTextarea.style.borderColor = '';
                        descTextarea.style.boxShadow = '';
                    }
                }
            });

        }, 500);
    }
    
    // DRAG & DROP
    setupDragAndDrop() {
        console.log("setupDragAndDrop: Initialisiere Drag & Drop");
        
        const dropZones = [
            { zone: 'drop_zone_1', input: 'file_input_1', routeNum: 1 },
            { zone: 'drop_zone_2', input: 'file_input_2', routeNum: 2 }
        ];

        dropZones.forEach(config => {
            this.setupFileInput(config.zone, config.input, config.routeNum);
        });

        // Verhindere Standardverhalten für Drag & Drop auf der gesamten Seite
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
            window.addEventListener(evt, this.preventDefaults, false);
            document.body.addEventListener(evt, this.preventDefaults, false);
        });
    }

    setupFileInput(dropZoneId, fileInputId, gpxNum) {
        const dropZone = document.getElementById(dropZoneId);
        const fileInput = document.getElementById(fileInputId);

        if (!dropZone || !fileInput) {
            console.warn(`setupFileInput: Elemente für GPX ${gpxNum} nicht gefunden.`);
            return;
        }

        // Highlight-Effekt beim Überziehen der Datei
        ['dragenter', 'dragover'].forEach(e => {
            dropZone.addEventListener(e, (ev) => {
                this.preventDefaults(ev);
                dropZone.classList.add('highlight');
                ev.dataTransfer.dropEffect = 'copy';
            }, false);
        });

        // Highlight entfernen beim Verlassen oder Ablegen
        ['dragleave', 'drop'].forEach(e => {
            dropZone.addEventListener(e, (ev) => {
                this.preventDefaults(ev);
                dropZone.classList.remove('highlight');
            }, false);
        });

        // Datei beim Ablegen verarbeiten
        dropZone.addEventListener('drop', (ev) => {
            this.preventDefaults(ev);
            const files = ev.dataTransfer.files;
            if (files && files.length > 0) {
                this.processFile(files[0], gpxNum);
            }
        }, false);

        // Klick auf Dropzone öffnet Dateiauswahldialog
        dropZone.addEventListener('click', (ev) => {
            this.preventDefaults(ev);
            fileInput.click();
        }, false);

        // Datei beim Auswählen über Input verarbeiten
        fileInput.addEventListener('change', (ev) => {
            if (ev.target.files && ev.target.files.length > 0) {
                this.processFile(ev.target.files[0], gpxNum);
            }
        });

        console.log(`setupFileInput: Drag & Drop und Dateiauswahl für GPX ${gpxNum} eingerichtet.`);
    }

    preventDefaults(e) { 
        e.preventDefault(); 
        e.stopPropagation(); 
    }

    async processFile(file, gpxNum) {
        console.log(`processFile: Verarbeite Datei für GPX ${gpxNum}: ${file.name}`);
        
        if (!file || !file.name.toLowerCase().endsWith('.gpx')) {
            alert('Bitte eine GPX-Datei auswählen.');
            console.warn(`processFile: Ungültige Datei ausgewählt: ${file ? file.name : 'keine Datei'}`);
            return;
        }

        try {
            const content = await this.readFile(file);
            
            // TEMPORÄR: Debug des originalen GPX-Inhalts
            if (window.gpxEditor && window.gpxEditor.debugGpxContent) {
                window.gpxEditor.debugGpxContent(content, file.name);
            }
            
            const success = await window.gpxEditor.loadGpx(gpxNum, content);
            
            if (success) {
                document.getElementById('drop_zone_' + gpxNum).innerHTML = 
                    `<strong>✅ ${file.name}</strong><br>Erfolgreich geladen (${(file.size/1024).toFixed(1)} KB)`;
                console.log(`processFile: GPX ${gpxNum} erfolgreich geladen.`);
            } else {
                alert('Fehler beim Laden der GPX-Datei.');
            }
        } catch (error) {
            console.error('Fehler beim Lesen der Datei:', error);
            alert('Fehler beim Lesen der Datei: ' + error.message);
        }
    }

    // Liest Datei ein
    readFile(file) {
        return new Promise(function(resolve, reject) {
            const reader = new FileReader();
            reader.onload = function(e) { resolve(e.target.result); };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    // Fügt Wegpunkt hinzu
    addWaypoint() {
        if (!window.waypointManager) {
            alert('Waypoint-Manager nicht verfügbar.');
            return;
        }

        const waypointData = {
            lat: parseFloat(document.getElementById('wp_lat').value),
            lon: parseFloat(document.getElementById('wp_lon').value),
            ele: parseFloat(document.getElementById('wp_ele').value) || 0,
            name: document.getElementById('wp_name').value.trim(),
            desc: document.getElementById('wp_desc').value.trim(),
            link: document.getElementById('wp_link').value.trim(),
            sym: document.getElementById('wp_sym').value,
            type: document.getElementById('wp_type').value
        };

        if (isNaN(waypointData.lat) || isNaN(waypointData.lon)) {
            alert('Bitte gültige Koordinaten eingeben!');
            return;
        }

        window.waypointManager.addCustomWaypoint(waypointData);
        window.waypointManager.clearForm();
    }

    // Generiert Route
    generateRoute() {
        if (!window.gpxEditor) {
            alert('GPX-Editor nicht verfügbar.');
            return;
        }

        const route = window.gpxEditor.generateRoute();
        
        if (route) {
            // Zeige GPX in Ausgabe
            const gpxOutput = window.gpxEditor.exportCompleteGPX(route);
            document.getElementById('generated_gpx_output').value = gpxOutput;
        }
    }

    // Wechselt zwischen Routen-Anzeige
    toggleRouteDisplay() {
        this.showGeneratedRoute = !this.showGeneratedRoute;
        const btn = document.getElementById('btn_toggle_routes');
        
        if (this.showGeneratedRoute) {
            btn.textContent = '🔄 Alte Routen anzeigen';
            btn.style.background = '#28a745';
        } else {
            btn.textContent = '🔄 Neue Route anzeigen';
            btn.style.background = '#007bff';
        }
        
        if (window.gpxEditor) {
            window.gpxEditor.toggleRouteDisplay(this.showGeneratedRoute);
        }
    }

    // Scrollt zum Wegpunkt-Editor
    scrollToWaypointEditor() {
        const waypointEditor = document.getElementById('waypoint-editor');
        if (!waypointEditor) {
            console.warn('Wegpunkt-Editor Container nicht gefunden');
            return;
        }

        // Smooth Scroll mit Offset für Header
        const headerOffset = 80;
        const elementPosition = waypointEditor.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });

        // Visuelles Highlight
        waypointEditor.style.transition = 'all 0.5s ease';
        waypointEditor.style.boxShadow = '0 0 0 3px #007bff';
        waypointEditor.style.backgroundColor = '#f8f9fa';
        
        setTimeout(() => {
            waypointEditor.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            waypointEditor.style.backgroundColor = '';
        }, 2000);
        
        console.log('Zum Wegpunkt-Editor gescrollt');
    }

    // Download Dialog Funktionen
    showDownloadDialog() {
        const dialog = document.getElementById('download-dialog');
        if (dialog) {
            dialog.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    hideDownloadDialog() {
        const dialog = document.getElementById('download-dialog');
        if (dialog) {
            dialog.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    // Download GPX (mit Dialog)
    downloadGPX() {
        if (!window.gpxEditor) {
            alert('GPX-Editor nicht verfügbar.');
            return;
        }

        // Komplette GPX mit Wegpunkten generieren
        const completeGPX = window.gpxEditor.exportCompleteGPXForDownload();
        
        if (!completeGPX || completeGPX.includes('<trkseg></trkseg>')) {
            alert('Keine vollständigen GPX-Daten zum Download vorhanden.');
            return;
        }

        // Zeige den Download-Dialog anstatt sofort zu downloaden
        this.showDownloadDialog();
        
        // Speichere die GPX-Daten für den späteren Download
        this.pendingDownloadData = completeGPX;
    }

    // Diese Funktion wird vom Dialog aufgerufen
    proceedWithDownload() {
        if (this.pendingDownloadData) {
            const blob = new Blob([this.pendingDownloadData], { type: 'application/gpx+xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'kombinierte_route_mit_wegpunkten.gpx';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Dialog schließen
            this.hideDownloadDialog();
            
            // Tracking für Analytics (optional)
            this.trackDownload();
            
            console.log('GPX mit Wegpunkten heruntergeladen');
        }
    }

    // Tracking für Downloads (optional)
    trackDownload() {
        console.log('Download durchgeführt');
        if (typeof gtag !== 'undefined') {
            gtag('event', 'download', {
                'event_category': 'gpx',
                'event_label': 'combined_route'
            });
        }
    }

    // Prüfe ob alle notwendigen Elemente vorhanden sind
    validateUIElements() {
        const requiredElements = [
            'waypoint-editor',
            'wp_lat', 
            'wp_lon',
            'wp_name'
        ];
        
        let allValid = true;
        
        requiredElements.forEach(id => {
            const element = document.getElementById(id);
            if (!element) {
                console.error(`Erforderliches Element nicht gefunden: #${id}`);
                allValid = false;
            }
        });
        
        if (allValid) {
            console.log('Alle UI-Elemente wurden erfolgreich geladen');
        }
        
        return allValid;
    }

    // Richtungs-Select Setup
    setupDirectionSelect() {
        const selectRichtung = document.getElementById('richtung');
        const nameInput = document.getElementById('wp_name');
        const descTextarea = document.getElementById('wp_desc');
        
        if (!selectRichtung || !nameInput || !descTextarea) return;
        
        let lastFocusedField = nameInput;

        // Merken, welches Feld zuletzt aktiv war
        [nameInput, descTextarea].forEach(elem => {
            elem.addEventListener('focus', () => {
                lastFocusedField = elem;
            });
        });

        // Auswahl aus dem Select einfügen
        selectRichtung.addEventListener('change', function() {
            const selectedText = selectRichtung.options[selectRichtung.selectedIndex].text;
            if (lastFocusedField) {
                if (lastFocusedField.value.length > 0) {
                    lastFocusedField.value += ' ' + selectedText;
                } else {
                    lastFocusedField.value = selectedText;
                }
                lastFocusedField.focus();
            }
        });
    }

    // Textfelder Drag & Drop Setup
    setupTextFieldsDragDrop() {
        const fields = document.querySelectorAll('input[type="text"], textarea');
        let scrollInterval = null;

        fields.forEach(field => {
            // Drag-Events vorbereiten
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                field.addEventListener(eventName, e => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            // Visuelle Hervorhebung
            field.addEventListener('dragenter', () => field.style.borderColor = '#0b5ed7');
            field.addEventListener('dragleave', () => field.style.borderColor = '');
            field.addEventListener('drop', e => {
                field.style.borderColor = '';
                clearInterval(scrollInterval);

                const items = e.dataTransfer.items;
                if (items && items.length > 0 && items[0].kind === 'file') {
                    const file = items[0].getAsFile();
                    const reader = new FileReader();
                    reader.onload = (evt) => field.value = evt.target.result;
                    reader.readAsText(file);
                } else {
                    const text = e.dataTransfer.getData('text');
                    if (text) field.value += text;
                }
            });

            // Automatisches Scrollen bei Drag
            field.addEventListener('dragover', e => {
                const { clientY } = e;
                const scrollSpeed = 20;
                const scrollZone = 60;

                const windowHeight = window.innerHeight;
                const distanceFromTop = clientY;
                const distanceFromBottom = windowHeight - clientY;

                clearInterval(scrollInterval);

                if (distanceFromTop < scrollZone) {
                    scrollInterval = setInterval(() => {
                        window.scrollBy(0, -scrollSpeed);
                    }, 50);
                } else if (distanceFromBottom < scrollZone) {
                    scrollInterval = setInterval(() => {
                        window.scrollBy(0, scrollSpeed);
                    }, 50);
                }
            });

            field.addEventListener('dragleave', () => clearInterval(scrollInterval));
            field.addEventListener('drop', () => clearInterval(scrollInterval));
        });
    }
}

// Initialisierung
document.addEventListener('DOMContentLoaded', function() {
    // Initialisiere Komponenten
    if (window.gpxEditor) {
        window.gpxEditor.initMap();
    }
    
    window.uiController = new UIController();
    
    // Validiere UI-Elemente
    setTimeout(() => {
        if (window.uiController.validateUIElements) {
            window.uiController.validateUIElements();
        }
    }, 500);
    
    // Wegpunkt-Marker initialisieren
    setTimeout(function() {
        if (window.waypointMapHandler) {
            window.waypointMapHandler.initWaypointMarkers();
        }
    }, 1000);
    
    console.log('GPX-kombinieren-Editor v2.6 mit verbessertem Scroll-Verhalten initialisiert');
});

// Globale Funktionen für den Dialog
function hideDownloadDialog() {
    if (window.uiController) {
        window.uiController.hideDownloadDialog();
    }
}

function proceedWithDownload() {
    if (window.uiController) {
        window.uiController.proceedWithDownload();
    }
}