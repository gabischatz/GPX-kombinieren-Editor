/**
 * Projekt: GPX-kombinieren-Editor
 * Version: 2.6
 * waypoint-manager.js
 * Zentrale Verwaltung aller Wegpunkte
 * Erstellt: Lutz Müller (2025)
 */

class WaypointManager {
    constructor() {
        this.allWaypoints = [];
        this.generatedRoute = [];
        this.originalRoutes = { route1: [], route2: [] };
        this.editingWaypointId = null;
        this.intersectionPoints = [];
    }

    // Fügt Wegpunkte aus GPX-Dateien hinzu
    addGpxWaypoints(gpxWaypoints, source) {
        const self = this;
        console.log(`=== FÜGE WEGPUNKTE AUS ${source} HINZU ===`);
        console.log(`Anzahl: ${gpxWaypoints.length}`, gpxWaypoints);
        
        gpxWaypoints.forEach(function(wp, index) {
            // Stelle sicher, dass alle Felder vorhanden sind
            const waypoint = {
                id: self.generateId(),
                lat: wp.lat || wp.latitude,
                lon: wp.lon || wp.longitude,
                ele: wp.ele || wp.elevation || 0,
                name: wp.name || '',
                desc: wp.desc || wp.cmt || '',
                link: wp.link || '',
                sym: wp.sym || '',
                type: wp.type || 'Waypoint',
                source: source,
                originalData: wp
            };
            
            // Detailliertes Logging für Links
            if (waypoint.link) {
                console.log(`🔗 Wegpunkt ${index} mit Link: "${waypoint.name}" -> ${waypoint.link}`);
            }
            if (waypoint.desc && waypoint.desc.length > 0) {
                console.log(`📝 Wegpunkt ${index} mit Beschreibung: "${waypoint.name}" -> ${waypoint.desc.substring(0, 50)}...`);
            }
            if (waypoint.sym) {
                console.log(`🎯 Wegpunkt ${index} mit Symbol: "${waypoint.name}" -> ${waypoint.sym}`);
            }
            
            self.allWaypoints.push(waypoint);
            
            // Sofort Marker hinzufügen
            if (window.waypointMapHandler) {
                window.waypointMapHandler.addWaypointMarker(waypoint);
            }
        });
        
        this.renderWaypointList();
        console.log(`Insgesamt ${this.allWaypoints.length} Wegpunkte im Manager`);
        
        // Erweiterte Debug-Ausgabe
        this.debugWaypoints();
    }

    // Fügt benutzerdefinierten Wegpunkt hinzu
    addCustomWaypoint(waypointData) {
        const waypoint = {
            id: this.generateId(),
            lat: waypointData.lat,
            lon: waypointData.lon,
            ele: waypointData.ele || 0,
            name: waypointData.name || '',
            desc: waypointData.desc || '',
            link: waypointData.link || '',
            sym: waypointData.sym || '',
            type: waypointData.type || 'Waypoint',
            source: 'custom',
            originalData: waypointData
        };
        this.allWaypoints.push(waypoint);
        this.renderWaypointList();
        
        // Marker zur Karte hinzufügen
        if (window.waypointMapHandler) {
            window.waypointMapHandler.addWaypointMarker(waypoint);
        }
        
        // KEINE automatische GPX-Aktualisierung
        return waypoint;
    }

    // Aktualisiert einen Wegpunkt
    updateWaypoint(id, updatedData) {
        const index = this.allWaypoints.findIndex(function(wp) { return wp.id === id; });
        if (index !== -1) {
            this.allWaypoints[index] = {...this.allWaypoints[index], ...updatedData};
            this.renderWaypointList();
            
            // Marker aktualisieren
            if (window.waypointMapHandler) {
                window.waypointMapHandler.updateWaypointMarker(this.allWaypoints[index]);
            }
            
            // KEINE automatische GPX-Aktualisierung
        }
    }

    // Löscht einen Wegpunkt
    deleteWaypoint(id) {
        // Marker entfernen
        if (window.waypointMapHandler) {
            window.waypointMapHandler.removeWaypointMarker(id);
        }
        
        this.allWaypoints = this.allWaypoints.filter(function(wp) { return wp.id !== id; });
        this.renderWaypointList();
        // KEINE automatische GPX-Aktualisierung
    }

    // Setzt die generierte Route für Abgleich
    setGeneratedRoute(routePoints) {
        this.generatedRoute = routePoints;
        this.checkWaypointDistances();
        this.findIntersectionPoints();
        this.updateGPXOutput();
    }

    // Setzt Originalrouten
    setOriginalRoutes(route1, route2) {
        this.originalRoutes.route1 = route1;
        this.originalRoutes.route2 = route2;
        this.findIntersectionPoints();
    }

    // Findet Schnittpunkte zwischen den Routen
    findIntersectionPoints() {
        this.intersectionPoints = [];
        const route1 = this.originalRoutes.route1;
        const route2 = this.originalRoutes.route2;

        if (route1.length < 2 || route2.length < 2) return;

        for (let i = 0; i < route1.length - 1; i++) {
            for (let j = 0; j < route2.length - 1; j++) {
                const intersection = this.findLineIntersection(
                    route1[i], route1[i + 1],
                    route2[j], route2[j + 1]
                );
                if (intersection) {
                    this.intersectionPoints.push({
                        ...intersection,
                        id: this.generateId(),
                        name: `Schnittpunkt ${this.intersectionPoints.length + 1}`,
                        type: 'intersection'
                    });
                }
            }
        }
        this.updateGPXOutput();
    }

    // Berechnet Schnittpunkt zwischen zwei Liniensegmenten
    findLineIntersection(p1, p2, p3, p4) {
        const denom = (p4.lon - p3.lon) * (p2.lat - p1.lat) - (p4.lat - p3.lat) * (p2.lon - p1.lon);
        if (denom === 0) return null;

        const ua = ((p4.lat - p3.lat) * (p1.lon - p3.lon) - (p4.lon - p3.lon) * (p1.lat - p3.lat)) / denom;
        const ub = ((p2.lat - p1.lat) * (p1.lon - p3.lon) - (p2.lon - p1.lon) * (p1.lat - p3.lat)) / denom;

        if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
            return {
                lat: p1.lat + ua * (p2.lat - p1.lat),
                lon: p1.lon + ua * (p2.lon - p1.lon),
                ele: (p1.ele + p2.ele) / 2
            };
        }
        return null;
    }

    // Prüft Abstände zur Route
    checkWaypointDistances() {
        const self = this;
        this.allWaypoints.forEach(function(wp) {
            wp.distanceToRoute = self.calculateDistanceToRoute(wp);
            wp.isOnRoute = wp.distanceToRoute <= 10;
        });
        this.renderWaypointList();
    }

    // Berechnet Entfernung zur nächsten Route
    calculateDistanceToRoute(waypoint) {
        let minDistance = Infinity;
        const self = this;

        this.generatedRoute.forEach(function(routePoint) {
            const distance = self.calculateDistance(
                waypoint.lat, waypoint.lon,
                routePoint.latitude, routePoint.longitude
            );
            if (distance < minDistance) minDistance = distance;
        });
        return minDistance;
    }

    // Haversine-Formel für Entfernungsberechnung
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) ** 2 +
                Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Verschiebt Wegpunkt auf Route
    moveWaypointToRoute(waypointId) {
        const waypoint = this.allWaypoints.find(function(wp) { return wp.id === waypointId; });
        if (!waypoint || !this.generatedRoute.length) return;

        let closestPoint = null;
        let minDistance = Infinity;
        const self = this;

        this.generatedRoute.forEach(function(routePoint) {
            const distance = self.calculateDistance(
                waypoint.lat, waypoint.lon,
                routePoint.latitude, routePoint.longitude
            );
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = routePoint;
            }
        });

        if (closestPoint) {
            waypoint.lat = closestPoint.latitude;
            waypoint.lon = closestPoint.longitude;
            waypoint.ele = closestPoint.elevation || waypoint.ele;
            waypoint.distanceToRoute = 0;
            waypoint.isOnRoute = true;
            this.renderWaypointList();
            this.updateGPXOutput();
        }
    }

    // Rendert die Wegpunkt-Liste
    renderWaypointList() {
        const list = document.getElementById('waypoint_list');
        if (!list) return;

        if (this.allWaypoints.length === 0) {
            list.innerHTML = '<p><em>Noch keine Wegpunkte vorhanden.</em></p>';
            return;
        }

        let html = '<h3>🗺️ Alle Wegpunkte</h3>';
        const self = this;
        
        this.allWaypoints.forEach(function(wp) {
            const distanceInfo = wp.distanceToRoute !== undefined ? 
                `<br>📏 <strong>${wp.distanceToRoute.toFixed(1)}m</strong> von Route entfernt` : '';
            
            const statusColor = wp.isOnRoute ? '#28a745' : '#dc3545';
            const statusText = wp.isOnRoute ? 'Auf Route' : 'Nicht auf Route';
            
            const moveButton = !wp.isOnRoute ? 
                `<button onclick="waypointManager.moveWaypointToRoute('${wp.id}')" style="float:right; background:#ffc107; color:black; border:none; padding:4px 8px; border-radius:3px; font-size:12px; margin-left:5px; cursor:pointer;">Auf Route verschieben</button>` : '';
            
            // VERBESSERT: Korrekte Anzeige aller Daten
            const linkDisplay = wp.link ? 
                `<br>🔗 <a href="${wp.link}" target="_blank" style="color: #007bff; word-break: break-all;">${wp.link}</a>` : 
                "<br>🔗 –";
            
            const descDisplay = wp.desc ? 
                `<br>📝 ${wp.desc}` : 
                "<br>📝 –";
            
            const symDisplay = wp.sym ? 
                `Symbol: ${wp.sym}` : 
                "Symbol: –";
            
            html += `
            <div class="waypoint-item" style="margin-bottom:10px; padding:10px; background:#fff; border-radius:6px; border:1px solid #ddd; border-left: 4px solid ${statusColor};">
                <strong>${wp.name || "(Unbenannt)"}</strong>
                <span style="float:right; color: ${statusColor}; font-size:12px;">${statusText}</span>
                <button onclick="waypointManager.editWaypoint('${wp.id}')" style="float:right; background:#007bff; color:white; border:none; padding:4px 8px; border-radius:3px; font-size:12px; margin-left:5px; cursor:pointer;">Bearbeiten</button>
                <button onclick="waypointManager.deleteWaypoint('${wp.id}')" style="float:right; background:#dc3545; color:white; border:none; padding:4px 8px; border-radius:3px; font-size:12px; cursor:pointer;">Löschen</button>
                ${moveButton}
                <br>
                📍 ${wp.lat.toFixed(6)}, ${wp.lon.toFixed(6)} | 🏔️ ${wp.ele || 0} m
                ${distanceInfo}
                ${descDisplay}
                ${linkDisplay}
                <br><small>${symDisplay} | Typ: ${wp.type || "Waypoint"} | Quelle: ${wp.source}</small>
            </div>`;
        });

        list.innerHTML = html;
    }

    // Öffnet Bearbeitungsdialog
    editWaypoint(id) {
        const waypoint = this.allWaypoints.find(function(wp) { return wp.id === id; });
        if (!waypoint) return;

        document.getElementById('wp_lat').value = waypoint.lat;
        document.getElementById('wp_lon').value = waypoint.lon;
        document.getElementById('wp_ele').value = waypoint.ele;
        document.getElementById('wp_name').value = waypoint.name;
        document.getElementById('wp_desc').value = waypoint.desc;
        document.getElementById('wp_link').value = waypoint.link;
        document.getElementById('wp_sym').value = waypoint.sym;
        document.getElementById('wp_type').value = waypoint.type;

        this.editingWaypointId = id;
        document.getElementById('btn_add_waypoint').style.display = 'none';
        document.getElementById('btn_update_waypoint').style.display = 'block';
        document.getElementById('btn_cancel_edit').style.display = 'block';
        
        // Zum Wegpunkt-Editor scrollen
        if (window.uiController) {
            setTimeout(() => {
                window.uiController.scrollToWaypointEditor();
            }, 100);
        }
    }

    // Beendet Bearbeitungsmodus
    cancelEdit() {
        this.editingWaypointId = null;
        document.getElementById('btn_add_waypoint').style.display = 'block';
        document.getElementById('btn_update_waypoint').style.display = 'none';
        document.getElementById('btn_cancel_edit').style.display = 'none';
        this.clearForm();
    }

    // Aktualisiert Wegpunkt aus Formular
    updateWaypointFromForm() {
        if (!this.editingWaypointId) return;

        const updatedData = {
            lat: parseFloat(document.getElementById('wp_lat').value),
            lon: parseFloat(document.getElementById('wp_lon').value),
            ele: parseFloat(document.getElementById('wp_ele').value) || 0,
            name: document.getElementById('wp_name').value.trim(),
            desc: document.getElementById('wp_desc').value.trim(),
            link: document.getElementById('wp_link').value.trim(),
            sym: document.getElementById('wp_sym').value,
            type: document.getElementById('wp_type').value
        };

        this.updateWaypoint(this.editingWaypointId, updatedData);
        this.cancelEdit();
    }

    // Leert das Formular
    clearForm() {
        document.getElementById('wp_lat').value = '';
        document.getElementById('wp_lon').value = '';
        document.getElementById('wp_ele').value = '';
        document.getElementById('wp_name').value = '';
        document.getElementById('wp_desc').value = '';
        document.getElementById('wp_link').value = '';
        document.getElementById('wp_sym').value = '';
        document.getElementById('wp_type').value = 'Waypoint';
    }

    // Generiert ID
    generateId() {
        return 'wp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Exportiert alle Wegpunkte als GPX
    exportWaypointsAsGPX() {
        let gpxContent = '';
        const self = this;
        
        console.log(`Exportiere ${this.allWaypoints.length} Wegpunkte in GPX`);
        
        this.allWaypoints.forEach(function(wp) {
            // Überspringe Schnittpunkte, da sie separat behandelt werden
            if (wp.type === 'intersection') return;
            
            gpxContent += `
      <wpt lat="${wp.lat}" lon="${wp.lon}">
        <ele>${wp.ele || 0}</ele>
        <name>${self.escapeXml(wp.name)}</name>`;
        
            // Füge desc hinzu falls vorhanden
            if (wp.desc) {
                gpxContent += `
        <desc>${self.escapeXml(wp.desc)}</desc>`;
            }
            
            // Füge cmt hinzu falls im originalData vorhanden und verschieden von desc
            if (wp.originalData && wp.originalData.cmt && wp.originalData.cmt !== wp.desc) {
                gpxContent += `
        <cmt>${self.escapeXml(wp.originalData.cmt)}</cmt>`;
            }
            
            // Füge Link hinzu falls vorhanden
            if (wp.link) {
                gpxContent += `
        <link href="${self.escapeXml(wp.link)}"/>`;
            }
            
            // Füge Symbol hinzu falls vorhanden
            if (wp.sym) {
                gpxContent += `
        <sym>${self.escapeXml(wp.sym)}</sym>`;
            }
            
            gpxContent += `
        <type>${self.escapeXml(wp.type)}</type>
      </wpt>`;
        });

        console.log(`GPX-Wegpunkte generiert: ${gpxContent.length} Zeichen`);
        return gpxContent;
    }

    // Debug-Methode hinzufügen:
    debugWaypoints() {
        console.log('=== DETAILLIERTER WEGPUNKT-DEBUG ===');
        
        const wegpunkteMitLinks = this.allWaypoints.filter(wp => wp.link);
        const wegpunkteMitBeschreibung = this.allWaypoints.filter(wp => wp.desc && wp.desc.length > 0);
        const wegpunkteMitSymbol = this.allWaypoints.filter(wp => wp.sym);
        
        console.log(`Wegpunkte mit Links: ${wegpunkteMitLinks.length}`);
        wegpunkteMitLinks.forEach(wp => {
            console.log(`  - "${wp.name}": ${wp.link} (Quelle: ${wp.source})`);
        });
        
        console.log(`Wegpunkte mit Beschreibung: ${wegpunkteMitBeschreibung.length}`);
        wegpunkteMitBeschreibung.forEach(wp => {
            console.log(`  - "${wp.name}": ${wp.desc.substring(0, 80)}... (Quelle: ${wp.source})`);
        });
        
        console.log(`Wegpunkte mit Symbol: ${wegpunkteMitSymbol.length}`);
        wegpunkteMitSymbol.forEach(wp => {
            console.log(`  - "${wp.name}": ${wp.sym} (Quelle: ${wp.source})`);
        });
        
        console.log('Alle Wegpunkte nach Quelle:');
        const bySource = {};
        this.allWaypoints.forEach(wp => {
            bySource[wp.source] = (bySource[wp.source] || 0) + 1;
        });
        console.log(bySource);
        
        console.log('=====================');
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

    // Löscht alle Wegpunkte
    clearAllWaypoints() {
        // Alle Marker entfernen
        if (window.waypointMapHandler) {
            window.waypointMapHandler.clearWaypointMarkers();
        }
        
        this.allWaypoints = [];
        this.renderWaypointList();
        // KEINE automatische GPX-Aktualisierung
    }

    refreshMapMarkers() {
        if (window.waypointMapHandler) {
            window.waypointMapHandler.initWaypointMarkers();
        }
    }

    // Aktualisiert die GPX-Ausgabe automatisch
    updateGPXOutput() {
        // KEINE automatische Aktualisierung mehr
        // GPX wird nur beim Download generiert
        console.log('Wegpunkte aktualisiert - GPX wird beim Download generiert');
    }
    // Temporäre Debug-Funktion (kann später entfernt werden)
    testGpxParsing() {
        console.log('=== GPX PARSING TEST ===');
        this.allWaypoints.forEach((wp, index) => {
            if (wp.source && wp.source.startsWith('gpx')) {
                console.log(`GPX Wegpunkt ${index}:`, {
                    name: wp.name,
                    desc: wp.desc,
                    link: wp.link,
                    sym: wp.sym,
                    type: wp.type,
                    originalData: wp.originalData
                });
            }
        });
    }
}

// Globale Instanz
window.waypointManager = new WaypointManager();