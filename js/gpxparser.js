/**
 * Lightweight GPX Parser (Browser-Optimiert)
 * -----------------------------------------
 * Unterstützt: Tracks, Routen, Wegpunkte, Distanz-, Höhen- & Steigungsberechnung
 * Kompatibel mit: GPX-kombinieren.html
 * Autor: Persönlicher Assistent & ChatGPT
 */

class GpxParser {
  constructor() {
    this.xmlSource = "";
    this.metadata = {};
    this.waypoints = [];
    this.tracks = [];
    this.routes = [];
  }

  /**
   * Parse a GPX string into structured data
   * @param {string} gpxstring
   */
  parse(gpxstring) {
    const domParser = new DOMParser();
    this.xmlSource = domParser.parseFromString(gpxstring, "application/xml");

    const errorNode = this.xmlSource.querySelector("parsererror");
    if (errorNode) throw new Error("Ungültige oder beschädigte GPX-Datei.");

    this.metadata = this._parseMetadata();
    this.waypoints = this._parseWaypoints();
    this.routes = this._parseRoutes();
    this.tracks = this._parseTracks();
  }

  /**
   * Prüft ob Koordinaten innerhalb Deutschlands liegen
   * @param {number} lat - Breitengrad
   * @param {number} lon - Längengrad
   * @returns {boolean}
   */
  _isInGermany(lat, lon) {
    // Deutschland liegt ungefähr zwischen:
    // Breitengrad: 47.2°N - 55.1°N
    // Längengrad: 5.8°E - 15.0°E
    return lat >= 47.0 && lat <= 55.5 && lon >= 5.5 && lon <= 15.5;
  }

  // === PARSE HELPERS ===
  _parseMetadata() {
    const meta = {};
    const metadata = this.xmlSource.querySelector("metadata");
    if (!metadata) return meta;

    meta.name = this._getValue(metadata, "name");
    meta.desc = this._getValue(metadata, "desc");
    meta.time = this._getValue(metadata, "time");

    const authorEl = metadata.querySelector("author");
    if (authorEl) {
      const author = {
        name: this._getValue(authorEl, "name"),
        email: {},
        link: {}
      };
      const emailEl = authorEl.querySelector("email");
      if (emailEl) {
        author.email.id = emailEl.getAttribute("id");
        author.email.domain = emailEl.getAttribute("domain");
      }
      const linkEl = authorEl.querySelector("link");
      if (linkEl) {
        author.link.href = linkEl.getAttribute("href");
        author.link.text = this._getValue(linkEl, "text");
        author.link.type = this._getValue(linkEl, "type");
      }
      meta.author = author;
    }

    const linkEl = metadata.querySelector("link");
    if (linkEl) {
      meta.link = {
        href: linkEl.getAttribute("href"),
        text: this._getValue(linkEl, "text"),
        type: this._getValue(linkEl, "type")
      };
    }

    return meta;
  }

  _parseWaypoints() {
    const wpts = [];
    this.xmlSource.querySelectorAll("wpt").forEach(wpt => {
      const point = this._parsePoint(wpt);
      if (point) wpts.push(point);
    });
    return wpts;
  }

  _parseRoutes() {
    const routes = [];
    this.xmlSource.querySelectorAll("rte").forEach(rte => {
      const routePoints = [];
      rte.querySelectorAll("rtept").forEach(pt => {
        const point = this._parsePoint(pt);
        if (point) routePoints.push(point);
      });
      
      // Nur Routen mit mindestens 2 Punkten behalten
      if (routePoints.length >= 2) {
        const route = {
          name: this._getValue(rte, "name"),
          cmt: this._getValue(rte, "cmt"),
          desc: this._getValue(rte, "desc"),
          src: this._getValue(rte, "src"),
          number: this._getValue(rte, "number"),
          link: this._parseLink(rte),
          points: routePoints
        };
        route.distance = this._calcDistance(route.points);
        route.elevation = this._calcElevation(route.points);
        route.slopes = this._calcSlope(route.points, route.distance.cumul);
        routes.push(route);
      }
    });
    return routes;
  }

  _parseTracks() {
    const tracks = [];
    this.xmlSource.querySelectorAll("trk").forEach(trk => {
      const track = {
        name: this._getValue(trk, "name"),
        cmt: this._getValue(trk, "cmt"),
        desc: this._getValue(trk, "desc"),
        src: this._getValue(trk, "src"),
        number: this._getValue(trk, "number"),
        link: this._parseLink(trk),
        segments: [],
        points: []
      };
      
      trk.querySelectorAll("trkseg").forEach(seg => {
        const segment = [];
        seg.querySelectorAll("trkpt").forEach(pt => {
          const p = this._parsePoint(pt);
          if (p) {
            segment.push(p);
            track.points.push(p);
          }
        });
        // Nur Segmente mit mindestens 2 Punkten behalten
        if (segment.length >= 2) {
          track.segments.push(segment);
        }
      });
      
      // Nur Tracks mit mindestens 2 Punkten behalten
      if (track.points.length >= 2) {
        track.distance = this._calcDistance(track.points);
        track.elevation = this._calcElevation(track.points);
        track.slopes = this._calcSlope(track.points, track.distance.cumul);
        tracks.push(track);
      }
    });
    return tracks;
  }

  _parseLink(parent) {
    const linkEl = parent.querySelector("link");
    if (!linkEl) return {};
    return {
      href: linkEl.getAttribute("href"),
      text: this._getValue(linkEl, "text"),
      type: this._getValue(linkEl, "type")
    };
  }

  _parsePoint(el) {
    const lat = parseFloat(el.getAttribute("lat"));
    const lon = parseFloat(el.getAttribute("lon"));
    
    // Prüfe auf gültige Koordinaten und Deutschland
    if (isNaN(lat) || isNaN(lon) || !this._isInGermany(lat, lon)) {
      console.warn(`Ungültige Koordinaten ignoriert: lat=${lat}, lon=${lon}`);
      return null;
    }
    
    const ele = parseFloat(this._getValue(el, "ele")) || 0;
    const timeStr = this._getValue(el, "time");
    const time = timeStr ? new Date(timeStr) : null;

    return {
      lat,
      lon,
      ele,
      time,
      name: this._getValue(el, "name"),
      sym: this._getValue(el, "sym"),
      cmt: this._getValue(el, "cmt"),
      desc: this._getValue(el, "desc")
    };
  }

  _getValue(parent, tag) {
    const el = parent.querySelector(tag);
    return el ? el.textContent.trim() : null;
  }

  // === CALCULATION HELPERS ===
  _calcDistance(points) {
    if (!points || points.length < 2) {
      return { total: 0, cumul: [0] };
    }
    
    let total = 0;
    const cumul = [0];
    for (let i = 1; i < points.length; i++) {
      total += this._distanceBetween(points[i - 1], points[i]);
      cumul.push(total);
    }
    return { total, cumul };
  }

  _distanceBetween(p1, p2) {
    const R = 6371000;
    const toRad = Math.PI / 180;
    const dLat = (p2.lat - p1.lat) * toRad;
    const dLon = (p2.lon - p1.lon) * toRad;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(p1.lat * toRad) * Math.cos(p2.lat * toRad) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  _calcElevation(points) {
    if (!points || points.length === 0) {
      return { pos: 0, neg: 0, avg: 0, max: 0, min: 0 };
    }
    
    const elevs = points.map(p => p.ele).filter(e => !isNaN(e));
    if (!elevs.length) return { pos: 0, neg: 0, avg: 0, max: 0, min: 0 };

    let pos = 0, neg = 0;
    for (let i = 1; i < elevs.length; i++) {
      const diff = elevs[i] - elevs[i - 1];
      if (diff > 0) pos += diff;
      if (diff < 0) neg += Math.abs(diff);
    }
    const sum = elevs.reduce((a, b) => a + b, 0);
    return {
      pos,
      neg,
      avg: sum / elevs.length,
      max: Math.max(...elevs),
      min: Math.min(...elevs)
    };
  }

  _calcSlope(points, cumul) {
    if (!points || points.length < 2) {
      return [];
    }
    
    const slopes = [];
    for (let i = 1; i < points.length; i++) {
      const dist = cumul[i] - cumul[i - 1];
      const elevDiff = points[i].ele - points[i - 1].ele;
      slopes.push(dist > 0 ? (elevDiff * 100) / dist : 0);
    }
    return slopes;
  }

  // === GEOJSON Export ===
  toGeoJSON() {
    const features = [];

    const makeFeature = (points, props) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: points.map(p => [p.lon, p.lat, p.ele])
      },
      properties: props
    });

    this.tracks.forEach(t => features.push(makeFeature(t.points, { name: t.name, type: "track" })));
    this.routes.forEach(r => features.push(makeFeature(r.points, { name: r.name, type: "route" })));
    this.waypoints.forEach(w =>
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [w.lon, w.lat, w.ele] },
        properties: { name: w.name, type: "waypoint" }
      })
    );

    return { type: "FeatureCollection", features };
  }
}

// Global verfügbar machen
if (typeof window !== "undefined") window.GpxParser = GpxParser;