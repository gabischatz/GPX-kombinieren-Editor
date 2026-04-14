# GPX-kombinieren-Editor

Ein Webwerkzeug zum Laden, Kombinieren, Bearbeiten und Exportieren von zwei GPX-Strecken inklusive Wegpunkten, Kartendarstellung und Demo-Dateien.

## Änderungen dieser Repository-Version

- beide CSS-Dateien zu `css/app.css` zusammengefasst
- JavaScript-Dateien direkt in `js/` verschoben
- Demo-Button oben rechts eingebaut
- Demo-Dateien in `demo/` aufgenommen
- feste Domain-Bindung entfernt
- doppelte Leaflet-Einbindung bereinigt

## Struktur

```text
/
├─ index.html
├─ README.md
├─ LICENSE.md
├─ .gitignore
├─ favicon.png
├─ css/
│  └─ app.css
├─ js/
│  ├─ gpxparser.js
│  ├─ togpx.js
│  ├─ speech-dictation.js
│  ├─ waypoint-map-handler.js
│  ├─ gpx-editor.js
│  ├─ waypoint-manager.js
│  ├─ ui-controller.js
│  ├─ scrollBehavior.js
│  └─ scrollTop.js
└─ demo/
   ├─ Gelbe-Route.gpx
   └─ Rote-Route.gpx
```

## Demo

Mit dem Button **„Demo-Strecken laden“** oben rechts werden beide Beispielstrecken automatisch geladen.
