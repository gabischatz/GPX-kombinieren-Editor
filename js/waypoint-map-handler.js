 /**
 * Wegpunkt-Map-Handler für Karteninteraktionen
 * Version: 1.0
 * waypoint-map-handler.js
 * Erstellt: Lutz Müller (2025)
 */

class WaypointMapHandler {
    constructor() {
        this.waypointMarkers = [];
        this.contextMenu = null;
        this.selectedWaypointId = null;
    }

    // Initialisiert Wegpunkt-Marker auf der Karte

    
initWaypointMarkers() {
    // PRÜFUNG: Stelle sicher, dass die Karte verfügbar ist
        if (!window.gpxEditor || !window.gpxEditor.map) {
            console.warn('Karte nicht verfügbar für Wegpunkt-Marker');
            return;
        }
    
        this.clearWaypointMarkers();
        this.addWaypointsToMap();
        this.setupMapRightClick();
    // Rest der bestehenden initWaypointMarkers Methode...
    // [Ihr vorhandener Code hier]
}

    // Fügt alle Wegpunkte zur Karte hinzu
addWaypointsToMap() {
    if (!window.waypointManager) {
        console.warn('WaypointManager nicht verfügbar');
        return;
    }

    console.log(`Füge ${window.waypointManager.allWaypoints.length} Wegpunkte zur Karte hinzu`);
    
    const self = this;
    window.waypointManager.allWaypoints.forEach(function(wp) {
        // Prüfe ob Marker bereits existiert
        const existingMarker = self.waypointMarkers.find(wm => wm.id === wp.id);
        if (!existingMarker) {
            self.addWaypointMarker(wp);
        }
    });
    
    console.log(`${this.waypointMarkers.length} Marker auf der Karte`);
}

    // Fügt einzelnen Wegpunkt-Marker hinzu
    addWaypointMarker(waypoint) {
        if (!window.gpxEditor || !window.gpxEditor.map) {
            console.warn('Karte nicht verfügbar für Wegpunkt-Marker');
            return null;
        }

        // Prüfe ob Marker bereits existiert
        const existingMarker = this.waypointMarkers.find(wm => wm.id === waypoint.id);
        if (existingMarker) {
            console.log(`Marker für Wegpunkt ${waypoint.id} bereits vorhanden`);
            return existingMarker.marker;
        }

        // Erstelle ein benutzerdefiniertes Icon mit dem 📍-Symbol
        const waypointIcon = L.divIcon({
            html: '<div style="font-size: 24px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); cursor: pointer; z-index: 1000;">📍</div>',
            iconSize: [24, 24],
            iconAnchor: [12, 24], // Punkt der Pin-Spitze
            popupAnchor: [0, -24], // Popup über dem Marker
            className: 'waypoint-marker-icon'
        });

        const marker = L.marker([waypoint.lat, waypoint.lon], {
            icon: waypointIcon,
            zIndexOffset: 1000, // Marker über den Routen anzeigen
            riseOnHover: true // Marker hebt sich beim Hovern hervor
        }).addTo(window.gpxEditor.map);

        // Popup-Inhalt
        const popupContent = `
            <div style="min-width: 200px;">
                <h4 style="margin: 0 0 8px 0;">${waypoint.name || 'Unbenannter Wegpunkt'}</h4>
                <p style="margin: 4px 0;"><strong>Typ:</strong> ${waypoint.type}</p>
                <p style="margin: 4px 0;"><strong>Höhe:</strong> ${waypoint.ele || 0} m</p>
                ${waypoint.desc ? `<p style="margin: 4px 0;"><strong>Beschreibung:</strong> ${waypoint.desc}</p>` : ''}
                ${waypoint.link ? `<p style="margin: 4px 0;"><strong>Link:</strong> <a href="${waypoint.link}" target="_blank">${waypoint.link}</a></p>` : ''}
                <div style="margin-top: 10px; text-align: center;">
                    <button onclick="waypointMapHandler.editWaypointFromPopup('${waypoint.id}')" 
                            style="background: #007bff; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin: 2px;">
                        ✏️ Bearbeiten
                    </button>
                    <button onclick="waypointMapHandler.moveToRouteFromPopup('${waypoint.id}')" 
                            style="background: #28a745; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin: 2px;">
                        📍 Auf Route
                    </button>
                    <button onclick="waypointMapHandler.deleteWaypointFromPopup('${waypoint.id}')" 
                            style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin: 2px;">
                        🗑️ Löschen
                    </button>
                </div>
            </div>
        `;

        marker.bindPopup(popupContent);
        
        // Rechtsklick-Event für Kontextmenü
        marker.on('contextmenu', function(e) {
            e.originalEvent.preventDefault();
            self.openContextMenu(waypoint.id, e.latlng);
        });

        // Hover-Effekt
        marker.on('mouseover', function() {
            marker.setZIndexOffset(2000); // Noch weiter nach oben beim Hovern
        });

        marker.on('mouseout', function() {
            marker.setZIndexOffset(1000); // Zurück zur normalen Position
        });

        // Speichere Marker-Referenz
        this.waypointMarkers.push({
            id: waypoint.id,
            marker: marker
        });

        console.log(`Wegpunkt-Marker hinzugefügt: ${waypoint.name || waypoint.id}`);
        return marker;
    }

    // Neue Methoden für Popup-Interaktionen
    editWaypointFromPopup(waypointId) {
        this.selectedWaypointId = waypointId;
        this.editWaypoint();
        
        // Schließe das Popup
        const marker = this.waypointMarkers.find(wm => wm.id === waypointId);
        if (marker && marker.marker.closePopup) {
            marker.marker.closePopup();
        }
    }

    moveToRouteFromPopup(waypointId) {
        this.selectedWaypointId = waypointId;
        this.moveToRoute();
        
        // Schließe das Popup
        const marker = this.waypointMarkers.find(wm => wm.id === waypointId);
        if (marker && marker.marker.closePopup) {
            marker.marker.closePopup();
        }
    }

    deleteWaypointFromPopup(waypointId) {
        this.selectedWaypointId = waypointId;
        this.deleteWaypoint();
        
        // Schließe das Popup
        const marker = this.waypointMarkers.find(wm => wm.id === waypointId);
        if (marker && marker.marker.closePopup) {
            marker.marker.closePopup();
        }
    }

    // Öffnet Kontextmenü für Wegpunkt
    openContextMenu(waypointId, latlng = null) {
        this.selectedWaypointId = waypointId;
        const waypoint = window.waypointManager.allWaypoints.find(wp => wp.id === waypointId);
        
        if (!waypoint) return;

        // Verwende vorhandenes Popup oder erstelle neues
        let popupContent = `
            <div style="min-width: 180px; text-align: center;">
                <h4 style="margin: 0 0 10px 0;">${waypoint.name || 'Wegpunkt'}</h4>
                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <button onclick="waypointMapHandler.editWaypoint()" 
                            style="background: #007bff; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">
                        ✏️ Bearbeiten
                    </button>
                    <button onclick="waypointMapHandler.moveToRoute()" 
                            style="background: #28a745; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">
                        📍 Auf Route verschieben
                    </button>
                    <button onclick="waypointMapHandler.deleteWaypoint()" 
                            style="background: #dc3545; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">
                        🗑️ Löschen
                    </button>
                    <button onclick="waypointMapHandler.closeContextMenu()" 
                            style="background: #6c757d; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">
                        ❌ Schließen
                    </button>
                </div>
            </div>
        `;

        if (this.contextMenu) {
            window.gpxEditor.map.closePopup(this.contextMenu);
        }

        this.contextMenu = L.popup()
            .setLatLng(latlng || [waypoint.lat, waypoint.lon])
            .setContent(popupContent)
            .openOn(window.gpxEditor.map);
    }

    // Schließt Kontextmenü
    closeContextMenu() {
        if (this.contextMenu) {
            window.gpxEditor.map.closePopup(this.contextMenu);
            this.contextMenu = null;
        }
    }

    // Bearbeitet Wegpunkt
    editWaypoint() {
        if (this.selectedWaypointId && window.waypointManager) {
            window.waypointManager.editWaypoint(this.selectedWaypointId);
            this.closeContextMenu();
            
            // Zum Wegpunkt-Editor scrollen
            if (window.uiController) {
                setTimeout(() => {
                    window.uiController.scrollToWaypointEditor();
                }, 100);
            }
        }
    }

    // Verschiebt Wegpunkt auf Route
    moveToRoute() {
        if (this.selectedWaypointId && window.waypointManager) {
            window.waypointManager.moveWaypointToRoute(this.selectedWaypointId);
            this.closeContextMenu();
        }
    }

    // Löscht Wegpunkt
    deleteWaypoint() {
        if (this.selectedWaypointId && window.waypointManager) {
            if (confirm('Wegpunkt wirklich löschen?')) {
                window.waypointManager.deleteWaypoint(this.selectedWaypointId);
                this.removeWaypointMarker(this.selectedWaypointId);
            }
            this.closeContextMenu();
        }
    }

    // Entfernt Wegpunkt-Marker
    removeWaypointMarker(waypointId) {
        const index = this.waypointMarkers.findIndex(wm => wm.id === waypointId);
        if (index !== -1) {
            window.gpxEditor.map.removeLayer(this.waypointMarkers[index].marker);
            this.waypointMarkers.splice(index, 1);
        }
    }

    // Löscht alle Wegpunkt-Marker
    clearWaypointMarkers() {
        this.waypointMarkers.forEach(wm => {
            window.gpxEditor.map.removeLayer(wm.marker);
        });
        this.waypointMarkers = [];
    }

    // Aktualisiert Wegpunkt-Marker
    updateWaypointMarker(waypoint) {
        this.removeWaypointMarker(waypoint.id);
        this.addWaypointMarker(waypoint);
    }

    // Setzt Map-Click-Listener für neue Wegpunkte
    setupMapRightClick() {
        if (!window.gpxEditor || !window.gpxEditor.map) return;

        // Entferne vorherige Listener
        window.gpxEditor.map.off('click');

        window.gpxEditor.map.on('click', function(e) {
            // Nur Koordinaten-Popup anzeigen, wenn nicht auf einem Marker geklickt wurde
            const isMarkerClick = e.originalEvent && 
                                e.originalEvent.target && 
                                e.originalEvent.target.classList.contains('leaflet-marker-icon');
            
            if (!isMarkerClick) {
                window.gpxEditor.showCoordinatePopup(e.latlng);
            }
        });
    }
}

// Globale Instanz
window.waypointMapHandler = new WaypointMapHandler();