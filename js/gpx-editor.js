/**
 * Projekt: GPX-kombinieren-Editor
 * Version: 2.6
 * gpx-editor.js
 * Hauptmodul für GPX-Verarbeitung und Routengenerierung
 * Erstellt: Lutz Müller (2025)
 * !!! Nicht ändern nur erweitern !!!
 */

class GpxEditor {
    constructor() {
        this.currentWaypoints1 = [];
        this.currentWaypoints2 = [];
        this.generatedRoute = [];
        this.map = null;
        this.routeLayers = {
            route1: null,
            route2: null,
            generated: null,
            intersections: null
        };
        this.routeBounds = null;
        this.selectedSegments = {
            route1: { start: 0, end: null },
            route2: { start: 0, end: null }
        };
        this.coordPopup = null;
    }

    // Initialisiert die Karte
    initMap() {
        if (!this.map) {
            this.map = L.map('map', {fullscreenControl: { pseudoFullscreen: false}}).setView([51, 10], 6);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                //attribution: '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8" class="leaflet-attribution-flag"><path fill="#4C7BE1" d="M0 0h12v4H0z"></path><path fill="#FFD500" d="M0 4h12v3H0z"></path><path fill="#E0BC00" d="M0 7h12v1H0z"></path></svg> © OpenStreetMap '
            }).addTo(this.map);
            
            // Koordinaten-Popup initialisieren
            this.initCoordPopup();
            
            console.log('Karte initialisiert');
        }
    }

    // Initialisiert das Koordinaten-Popup
    initCoordPopup() {
        this.coordPopup = L.popup({
            closeButton: true,
            autoClose: false,
            closeOnEscapeKey: true,
            className: 'coord-popup'
        });
    }

    // Lädt GPX-Datei
    async loadGpx(gpxNum, content) {
        try {
            console.log(`Lade GPX ${gpxNum} mit eigenem Parser...`);
            
            // Verwende DOMParser für vollständige Kontrolle
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(content, "text/xml");
            
            let trackPoints = [];
            const gpxWaypoints = [];

            // Parse Wegpunkte (wpt elements) - VERBESSERTES PARSING
            const wptElements = xmlDoc.getElementsByTagName("wpt");
            console.log(`GPX ${gpxNum}: ${wptElements.length} wpt-Elemente gefunden`);

            for (let i = 0; i < wptElements.length; i++) {
                const wpt = wptElements[i];
                const lat = parseFloat(wpt.getAttribute("lat"));
                const lon = parseFloat(wpt.getAttribute("lon"));
                
                if (isNaN(lat) || isNaN(lon)) continue;

                // Extrahiere alle Unterelemente mit verbessertem Parsing
                const ele = this.getXmlValue(wpt, "ele");
                const name = this.getXmlValue(wpt, "name");
                const desc = this.getXmlValue(wpt, "desc");
                const cmt = this.getXmlValue(wpt, "cmt");
                const sym = this.getXmlValue(wpt, "sym");
                const type = this.getXmlValue(wpt, "type");
                
                // VERBESSERT: Korrektes Link-Parsing
                let link = "";
                const linkElements = wpt.getElementsByTagName("link");
                if (linkElements.length > 0) {
                    const linkElement = linkElements[0];
                    link = linkElement.getAttribute("href") || "";
                    console.log(`Link gefunden für ${name}: ${link}`);
                }

                const waypoint = {
                    lat: lat,
                    lon: lon,
                    ele: parseFloat(ele) || 0,
                    name: name || '',
                    desc: desc || cmt || '',
                    link: link,
                    sym: sym || '',
                    type: type || 'Waypoint',
                    originalData: {
                        lat: lat,
                        lon: lon,
                        ele: parseFloat(ele) || 0,
                        name: name,
                        desc: desc,
                        cmt: cmt,
                        link: link,
                        sym: sym,
                        type: type
                    }
                };

                gpxWaypoints.push(waypoint);
                console.log(`Wegpunkt ${i} geparst:`, {
                    name: waypoint.name,
                    desc: waypoint.desc?.substring(0, 50) + '...',
                    link: waypoint.link,
                    sym: waypoint.sym
                });
            }

            // Parse Trackpunkte für die Routen
            const trkptElements = xmlDoc.getElementsByTagName("trkpt");
            console.log(`GPX ${gpxNum}: ${trkptElements.length} Trackpunkte gefunden`);
            
            for (let i = 0; i < trkptElements.length; i++) {
                const trkpt = trkptElements[i];
                const lat = parseFloat(trkpt.getAttribute("lat"));
                const lon = parseFloat(trkpt.getAttribute("lon"));
                
                if (isNaN(lat) || isNaN(lon)) continue;

                trackPoints.push({
                    latitude: lat,
                    longitude: lon,
                    elevation: parseFloat(this.getXmlValue(trkpt, "ele")) || 0,
                    name: this.getXmlValue(trkpt, "name") || '',
                    type: 'trackpoint'
                });
            }

            // Füge Wegpunkte zum Manager hinzu
            if (window.waypointManager && gpxWaypoints.length > 0) {
                console.log(`Füge ${gpxWaypoints.length} Wegpunkte zu WaypointManager hinzu`);
                window.waypointManager.addGpxWaypoints(gpxWaypoints, 'gpx' + gpxNum);
            } else {
                console.warn(`Keine Wegpunkte für GPX ${gpxNum} gefunden oder WaypointManager nicht verfügbar`);
            }

            // Setze Trackpunkte für die Route
            if (gpxNum === 1) {
                this.currentWaypoints1 = trackPoints;
                this.selectedSegments.route1.end = trackPoints.length - 1;
            } else {
                this.currentWaypoints2 = trackPoints;
                this.selectedSegments.route2.end = trackPoints.length - 1;
            }

            this.drawRoutesOnMap();
            this.updateRouteSelectionDisplays();
            this.setupMapClick();
            this.updateGPXOutput();
            
            console.log(`GPX ${gpxNum} erfolgreich geladen: ${trackPoints.length} Trackpunkte, ${gpxWaypoints.length} Wegpunkte`);
            return true;
        } catch (error) {
            console.error('Fehler beim Laden der GPX:', error);
            return false;
        }
    }
    
    // Hilfsfunktion für XML-Parsing
    getXmlValue(parentElement, tagName) {
        try {
            const elements = parentElement.getElementsByTagName(tagName);
            if (elements.length > 0 && elements[0].textContent) {
                return elements[0].textContent.trim();
            }
            return '';
        } catch (error) {
            console.error(`Fehler beim Parsing von ${tagName}:`, error);
            return '';
        }
    }
    
    // Temporäre Debug-Funktion zum Testen des GPX-Inhalts
    debugGpxContent(content, filename) {
        console.log(`=== DEBUG GPX CONTENT: ${filename} ===`);
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, "text/xml");
        
        // Finde alle wpt-Elemente
        const wptElements = xmlDoc.getElementsByTagName("wpt");
        console.log(`Anzahl wpt-Elemente: ${wptElements.length}`);
        
        for (let i = 0; i < wptElements.length; i++) {
            const wpt = wptElements[i];
            const name = this.getXmlValue(wpt, "name");
            
            // Prüfe auf Link-Elemente
            const linkElements = wpt.getElementsByTagName("link");
            console.log(`Wegpunkt ${i}: "${name}" - ${linkElements.length} Link(s)`);
            
            for (let j = 0; j < linkElements.length; j++) {
                const link = linkElements[j];
                const href = link.getAttribute("href");
                console.log(`  Link ${j}: ${href}`);
            }
            
            // Prüfe auf andere Elemente
            const desc = this.getXmlValue(wpt, "desc");
            const cmt = this.getXmlValue(wpt, "cmt");
            const sym = this.getXmlValue(wpt, "sym");
            
            if (desc) console.log(`  Desc: ${desc.substring(0, 50)}...`);
            if (cmt) console.log(`  Cmt: ${cmt.substring(0, 50)}...`);
            if (sym) console.log(`  Sym: ${sym}`);
        }
        
        console.log('================================');
    }

    // Zeichnet Routen auf Karte
    drawRoutesOnMap() {
        // Entferne vorhandene Routen
        Object.values(this.routeLayers).forEach(layer => {
            if (layer) this.map.removeLayer(layer);
        });

        let allBounds = [];

        // Zeichne Route 1 (blau)
        if (this.currentWaypoints1.length > 0) {
            const segment1 = this.getSelectedSegment(1);
            const coords1 = segment1.map(p => [p.latitude, p.longitude]);
            this.routeLayers.route1 = L.polyline(coords1, {
                color: 'blue', 
                weight: 6,
                opacity: 0.7
            }).addTo(this.map);
            allBounds = allBounds.concat(coords1);
        }
        
        // Zeichne Route 2 (rot)
        if (this.currentWaypoints2.length > 0) {
            const segment2 = this.getSelectedSegment(2);
            const coords2 = segment2.map(p => [p.latitude, p.longitude]);
            this.routeLayers.route2 = L.polyline(coords2, {
                color: 'red', 
                weight: 6,
                opacity: 0.7
            }).addTo(this.map);
            allBounds = allBounds.concat(coords2);
        }

        // Zeichne Schnittpunkte
        if (window.waypointManager && window.waypointManager.intersectionPoints.length > 0) {
            const intersectionLayer = L.layerGroup();
            window.waypointManager.intersectionPoints.forEach(point => {
                L.circleMarker([point.lat, point.lon], {
                    color: 'green',
                    fillColor: '#00ff00',
                    fillOpacity: 0.8,
                    radius: 8
                }).bindPopup(`<b>${point.name}</b><br>Schnittpunkt`).addTo(intersectionLayer);
            });
            this.routeLayers.intersections = intersectionLayer.addTo(this.map);
        }

        // Setze Kartenansicht nur beim ersten Laden
        if (allBounds.length > 0 && !this.routeBounds) {
            this.routeBounds = L.latLngBounds(allBounds);
            this.map.fitBounds(this.routeBounds, { padding: [20, 20] });
        }
    }

    // Gibt ausgewählten Segment zurück
    getSelectedSegment(routeNum) {
        const route = routeNum === 1 ? this.currentWaypoints1 : this.currentWaypoints2;
        const segment = this.selectedSegments[`route${routeNum}`];
        return route.slice(segment.start, segment.end + 1);
    }

    // Aktualisiert Segment-Anzeigen mit Schiebereglern und Mausrad
    updateRouteSelectionDisplays() {
        this.updateRouteSelectionDisplay(1);
        this.updateRouteSelectionDisplay(2);
    }

    updateRouteSelectionDisplay(routeNum) {
        const route = routeNum === 1 ? this.currentWaypoints1 : this.currentWaypoints2;
        const segment = this.selectedSegments[`route${routeNum}`];
        const display = document.getElementById(`route${routeNum}_selection`);
        
        if (display && route.length > 0) {
            display.innerHTML = `
                <h3>Route ${routeNum}</h3>
                <div style="margin: 10px 0;">
                    <strong>Segment:</strong> Punkte ${segment.start + 1} - ${segment.end + 1} 
                    (${segment.end - segment.start + 1} von ${route.length} Punkten)
                </div>
                <div style="display: flex; gap: 10px; align-items: center; margin: 10px 0;">
                    <div style="flex: 1;">
                        <label style="font-size: 12px;">Start:</label>
                        <input type="range" id="route${routeNum}_start" min="0" max="${route.length - 1}" 
                               value="${segment.start}" style="width: 100%">
                        <span id="route${routeNum}_start_value" style="font-size: 11px; color: #666;">${segment.start + 1}</span>
                    </div>
                    <div style="flex: 1;">
                        <label style="font-size: 12px;">Ende:</label>
                        <input type="range" id="route${routeNum}_end" min="0" max="${route.length - 1}" 
                               value="${segment.end}" style="width: 100%">
                        <span id="route${routeNum}_end_value" style="font-size: 11px; color: #666;">${segment.end + 1}</span>
                    </div>
                </div>
            `;

            // Event-Listener für Slider - OHNE Zoom!
            const startSlider = document.getElementById(`route${routeNum}_start`);
            const endSlider = document.getElementById(`route${routeNum}_end`);
            const startValue = document.getElementById(`route${routeNum}_start_value`);
            const endValue = document.getElementById(`route${routeNum}_end_value`);

            const updateSlider = (slider, valueElement, isStart) => {
                const value = parseInt(slider.value);
                valueElement.textContent = value + 1;
                
                if (isStart) {
                    this.selectedSegments[`route${routeNum}`].start = value;
                } else {
                    this.selectedSegments[`route${routeNum}`].end = value;
                }
                
                this.drawRoutesOnMap(); // Kein Zoom bei Slider-Bewegung
                this.updateGPXOutput(); // GPX-Ausgabe aktualisieren
            };

            startSlider.addEventListener('input', (e) => {
                updateSlider(e.target, startValue, true);
            });

            endSlider.addEventListener('input', (e) => {
                updateSlider(e.target, endValue, false);
            });

            // Mausrad-Event für feine Justierung
            [startSlider, endSlider].forEach(slider => {
                slider.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    const step = e.shiftKey ? 10 : 1; // Größere Schritte mit Shift
                    let newValue = parseInt(slider.value);
                    
                    if (e.deltaY < 0) {
                        newValue += step; // Mausrad nach oben
                    } else {
                        newValue -= step; // Mausrad nach unten
                    }
                    
                    // Begrenze den Wert
                    newValue = Math.max(parseInt(slider.min), Math.min(parseInt(slider.max), newValue));
                    slider.value = newValue;
                    
                    // Trigger das Input-Event
                    const event = new Event('input');
                    slider.dispatchEvent(event);
                });
            });
        } else if (display) {
            display.innerHTML = `<h3>Route ${routeNum}</h3><p>Noch nicht geladen</p>`;
        }
    }

    // Klick-Event für Koordinaten-Übernahme
    setupMapClick() {
        if (!this.map) return;

        // Entferne vorherige Klick-Listener
        this.map.off('click');
        
        this.map.on('click', (e) => {
            this.showCoordinatePopup(e.latlng);
        });
    }

    // Zeigt Popup mit Koordinaten zur Übernahme
async showCoordinatePopup(latlng) {
    // Höhe asynchron abrufen
    const elevation = await this.getElevation(latlng.lat, latlng.lng);

    const popupContent = `
        <div style="min-width: 250px;">
            <h4 style="margin: 0 0 10px 0;">Koordinaten übernehmen</h4>
            <div style="margin-bottom: 10px;">
                <strong>Breitengrad:</strong> ${latlng.lat.toFixed(6)}<br>
                <strong>Längengrad:</strong> ${latlng.lng.toFixed(6)}<br>
                <strong>Höhe:</strong> 
                <input type="number" id="popup_ele" value="${elevation !== null ? elevation.toFixed(1) : '0'}" step="0.1" style="width: 80px; margin-left: 5px;">
                m
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="popup_cancel" style="padding: 5px 10px; background: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer;">Abbrechen</button>
                <button id="popup_apply" style="padding: 5px 10px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">Übernehmen</button>
            </div>
        </div>
    `;

    this.coordPopup
        .setLatLng(latlng)
        .setContent(popupContent)
        .openOn(this.map);

    // Event-Listener für die Buttons
    setTimeout(() => {
        const cancelBtn = document.getElementById('popup_cancel');
        const applyBtn = document.getElementById('popup_apply');
        
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                this.map.closePopup(this.coordPopup);
            };
        }
        
        if (applyBtn) {
            applyBtn.onclick = () => {
                const elevationInput = document.getElementById('popup_ele').value;
                this.applyCoordinates(latlng, parseFloat(elevationInput) || 0);
                this.map.closePopup(this.coordPopup);
                
                // Sofort zum Wegpunkt-Editor scrollen
                if (window.uiController) {
                    window.uiController.scrollToWaypointEditor();
                }
            };
        }
    }, 100);
}

// Funktion zur Höhenabfrage
async getElevation(lat, lon) {
    try {
        const response = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            return data.results[0].elevation;
        } else {
            console.error('Keine Höhendaten gefunden');
            return null;
        }
    } catch (error) {
        console.error('Fehler bei der Höhenabfrage:', error);
        return null;
    }
}

    // Übernimmt Koordinaten in das Wegpunkt-Formular
    applyCoordinates(latlng, elevation) {
        document.getElementById('wp_lat').value = latlng.lat.toFixed(6);
        document.getElementById('wp_lon').value = latlng.lng.toFixed(6);
        document.getElementById('wp_ele').value = elevation;
        
        // Fokussiere das Namensfeld für schnelle Eingabe
        document.getElementById('wp_name').focus();
        
        // Zum Wegpunkt-Editor scrollen
        if (window.uiController) {
            setTimeout(() => {
                window.uiController.scrollToWaypointEditor();
            }, 100);
        }
        
        console.log(`Koordinaten übernommen: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}, ${elevation}m`);
    }

    // Verbesserte Routengenerierung mit kürzester Verbindung
    generateRoute() {
        const segment1 = this.getSelectedSegment(1);
        const segment2 = this.getSelectedSegment(2);
        
        if (segment1.length === 0 || segment2.length === 0) {
            alert('Bitte zuerst beide GPX-Dateien laden und Segmente auswählen!');
            return null;
        }

        // Finde die kürzeste Verbindung zwischen den Segmenten
        const connection = this.findShortestConnection(segment1, segment2);
        
        if (!connection) {
            alert('Keine geeignete Verbindung zwischen den Segmenten gefunden!');
            return null;
        }

        // Kombiniere Routen mit optimaler Verbindung
        const combined = [...connection.segment1, ...connection.segment2];
        this.generatedRoute = combined;

        // Setze generierte Route im Waypoint-Manager
        if (window.waypointManager) {
            window.waypointManager.setGeneratedRoute(combined);
            window.waypointManager.setOriginalRoutes(this.currentWaypoints1, this.currentWaypoints2);
        }
        
        // Zeichne generierte Route
        this.drawGeneratedRoute(combined);
        this.updateGPXOutput();
        
        alert(`Route mit ${combined.length} Punkten generiert!\nVerbindungslänge: ${connection.distance.toFixed(1)}m`);
        
        return combined;
    }

    // Findet die kürzeste Verbindung zwischen zwei Segmenten
    findShortestConnection(segment1, segment2) {
        let shortestDistance = Infinity;
        let bestCombination = null;

        // Teste verschiedene Kombinationen der Segment-Richtungen
        const combinations = [
            { s1: segment1, s2: segment2, desc: 'beide vorwärts' },
            { s1: segment1, s2: [...segment2].reverse(), desc: 'Segment 2 rückwärts' },
            { s1: [...segment1].reverse(), s2: segment2, desc: 'Segment 1 rückwärts' },
            { s1: [...segment1].reverse(), s2: [...segment2].reverse(), desc: 'beide rückwärts' }
        ];

        combinations.forEach(comb => {
            const endPoint1 = comb.s1[comb.s1.length - 1];
            const startPoint2 = comb.s2[0];
            
            const distance = this.calculateDistance(
                endPoint1.latitude, endPoint1.longitude,
                startPoint2.latitude, startPoint2.longitude
            );
            
            if (distance < shortestDistance) {
                shortestDistance = distance;
                bestCombination = {
                    segment1: comb.s1,
                    segment2: comb.s2,
                    distance: distance,
                    description: comb.desc
                };
            }
        });

        console.log(`Kürzeste Verbindung: ${bestCombination.description} (${shortestDistance.toFixed(1)}m)`);
        return bestCombination;
    }

    // Haversine-Formel für Entfernungsberechnung
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Erdradius in Metern
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) ** 2 +
                Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Zeichnet generierte Route
    drawGeneratedRoute(routePoints) {
        // Entferne vorhandene generierte Route
        if (this.routeLayers.generated) {
            this.map.removeLayer(this.routeLayers.generated);
        }

        const coords = routePoints.map(p => [p.latitude, p.longitude]);
        this.routeLayers.generated = L.polyline(coords, {
            color: '#ffc107',
            weight: 8,
            opacity: 0.9,
            dashArray: '5, 10'
        }).addTo(this.map);
    }

    // Löscht Route
    clearRoute(routeNum) {
        if (routeNum === 1) {
            this.currentWaypoints1 = [];
            this.selectedSegments.route1 = { start: 0, end: null };
        } else {
            this.currentWaypoints2 = [];
            this.selectedSegments.route2 = { start: 0, end: null };
        }
        this.generatedRoute = [];
        this.drawRoutesOnMap();
        this.updateRouteSelectionDisplays();
        this.updateGPXOutput();
    }

    // Kehrt Route um
    reverseRoute(routeNum) {
        if (routeNum === 1) {
            this.currentWaypoints1.reverse();
        } else {
            this.currentWaypoints2.reverse();
        }
        this.drawRoutesOnMap();
        this.updateRouteSelectionDisplays();
        this.updateGPXOutput();
    }

    // Wechselt zwischen Original- und generierter Route
    toggleRouteDisplay(showGenerated) {
        if (showGenerated) {
            if (this.routeLayers.route1) this.map.removeLayer(this.routeLayers.route1);
            if (this.routeLayers.route2) this.map.removeLayer(this.routeLayers.route2);
            if (this.routeLayers.generated) this.map.addLayer(this.routeLayers.generated);
        } else {
            if (this.routeLayers.generated) this.map.removeLayer(this.routeLayers.generated);
            if (this.routeLayers.route1) this.map.addLayer(this.routeLayers.route1);
            if (this.routeLayers.route2) this.map.addLayer(this.routeLayers.route2);
        }
    }

    // Exportiert komplette GPX mit allen Wegpunkten
    exportCompleteGPX(routePoints) {
        let waypointsGPX = '';
        if (window.waypointManager) {
            waypointsGPX = window.waypointManager.exportWaypointsAsGPX();
        }
        
        let trackGPX = '';
        if (routePoints && routePoints.length > 0) {
            trackGPX = `
  <trk>
    <name>Generierte Route</name>
    <desc>Kombinierte Route aus GPX-Editor</desc>
    <trkseg>`;
            
            routePoints.forEach(pt => {
                trackGPX += `
      <trkpt lat="${pt.latitude}" lon="${pt.longitude}">
        <ele>${pt.elevation || 0}</ele>
        ${pt.name ? '<name>' + this.escapeXml(pt.name) + '</name>' : ''}
      </trkpt>`;
            });
            
            trackGPX += `
    </trkseg>
  </trk>`;
        }

        // Füge Schnittpunkte als Wegpunkte hinzu
        let intersectionsGPX = '';
        if (window.waypointManager && window.waypointManager.intersectionPoints.length > 0) {
            window.waypointManager.intersectionPoints.forEach(point => {
                intersectionsGPX += `
  <wpt lat="${point.lat}" lon="${point.lon}">
    <ele>${point.ele || 0}</ele>
    <name>${this.escapeXml(point.name)}</name>
    <type>Schnittpunkt</type>
  </wpt>`;
            });
        }

        return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GPX-kombinieren-Editor" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Kombinierte Route</name>
    <desc>Erstellt mit GPX-kombinieren-Editor v2.6</desc>
  </metadata>
${waypointsGPX}
${intersectionsGPX}
${trackGPX}
</gpx>`;
    }

    // XML Escaping
    escapeXml(unsafe) {
        if (!unsafe) return '';
        return unsafe.replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    }

    // Aktualisiert die GPX-Ausgabe
    updateGPXOutput() {
        // Nur Route anzeigen, keine Wegpunkte
        if (this.generatedRoute && this.generatedRoute.length > 0) {
            const routeOnlyGPX = this.exportRouteOnlyGPX(this.generatedRoute);
            document.getElementById('generated_gpx_output').value = routeOnlyGPX;
        } else {
            document.getElementById('generated_gpx_output').value = '<!-- Route wird hier angezeigt -->';
        }
    }

    // Füge neue Methode für Route-only GPX hinzu:
    exportRouteOnlyGPX(routePoints) {
        let trackGPX = '';
        if (routePoints && routePoints.length > 0) {
            trackGPX = `
      <trk>
        <name>Generierte Route</name>
        <desc>Kombinierte Route aus GPX-Editor</desc>
        <trkseg>`;
            
            routePoints.forEach(pt => {
                trackGPX += `
          <trkpt lat="${pt.latitude}" lon="${pt.longitude}">
            <ele>${pt.elevation || 0}</ele>
            ${pt.name ? '<name>' + this.escapeXml(pt.name) + '</name>' : ''}
          </trkpt>`;
            });
            
            trackGPX += `
        </trkseg>
      </trk>`;
        }

        return `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" creator="GPX-kombinieren-Editor" xmlns="http://www.topografix.com/GPX/1/1">
      <metadata>
        <name>Kombinierte Route</name>
        <desc>Erstellt mit GPX-kombinieren-Editor v2.6</desc>
      </metadata>
    ${trackGPX}
    </gpx>`;
    }

    // Füge Methode für kompletten Download hinzu:
    exportCompleteGPXForDownload() {
        let waypointsGPX = '';
        if (window.waypointManager) {
            waypointsGPX = window.waypointManager.exportWaypointsAsGPX();
        }
        
        let trackGPX = '';
        if (this.generatedRoute && this.generatedRoute.length > 0) {
            trackGPX = `
      <trk>
        <name>Generierte Route</name>
        <desc>Kombinierte Route aus GPX-Editor</desc>
        <trkseg>`;
            
            this.generatedRoute.forEach(pt => {
                trackGPX += `
          <trkpt lat="${pt.latitude}" lon="${pt.longitude}">
            <ele>${pt.elevation || 0}</ele>
            ${pt.name ? '<name>' + this.escapeXml(pt.name) + '</name>' : ''}
          </trkpt>`;
            });
            
            trackGPX += `
        </trkseg>
      </trk>`;
        }

        // Füge Schnittpunkte als Wegpunkte hinzu
        let intersectionsGPX = '';
        if (window.waypointManager && window.waypointManager.intersectionPoints.length > 0) {
            window.waypointManager.intersectionPoints.forEach(point => {
                intersectionsGPX += `
      <wpt lat="${point.lat}" lon="${point.lon}">
        <ele>${point.ele || 0}</ele>
        <name>${this.escapeXml(point.name)}</name>
        <type>Schnittpunkt</type>
      </wpt>`;
            });
        }

        return `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" creator="GPX-kombinieren-Editor" xmlns="http://www.topografix.com/GPX/1/1">
      <metadata>
        <name>Kombinierte Route mit Wegpunkten</name>
        <desc>Erstellt mit GPX-kombinieren-Editor v2.6</desc>
      </metadata>
    ${waypointsGPX}
    ${intersectionsGPX}
    ${trackGPX}
    </gpx>`;
    }
}

// Globale Instanz
window.gpxEditor = new GpxEditor();