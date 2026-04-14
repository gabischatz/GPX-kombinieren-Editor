/**
 * Projekt: GPX-Kombinieren-Editor – Diktierfunktion
 * Datei: speech-dictation.js (nomodule)
 * Version: 1.2.0
 * Datum: 10.11.2025
 *
 * - Keine ES-Module: funktioniert mit <script src=".../speech-dictation.js"></script>
 * - Kein DOM-Wrapper, keine absolute Positionierung
 * - Optionaler externer Button & Interim-Element können übergeben werden
 *
 * API (global):
 *   const dict = new window.DictationController();
 *   dict.attachToTextarea(textarea, {
 *     lang: 'de-DE',
 *     hotkey: { ctrlKey:true, shiftKey:true, key:'.' },
 *     button: HTMLElement,    // optional: vorhandener Button im Layout
 *     interimEl: HTMLElement, // optional: vorhandenes Anzeige-Element
 *     onToggle(isOn) {}       // optional
 *   });
 */
(function (global) {
  'use strict';

  function DictationController() {
    var SR = global.SpeechRecognition || global.webkitSpeechRecognition;
    this.supported = !!SR;
    this.SRClass = SR || null;
    this.active = false;
    this.recog = null;
    this.bound = new Set();
    this._globalKeyHandlerInstalled = false;
  }

  DictationController.prototype.attachToTextarea = function(textarea, opts) {
    opts = opts || {};
    if (!textarea || this.bound.has(textarea)) return;
    
    // Event-Listener für Fokus/Blur hinzufügen
    textarea.addEventListener('focus', function() {
      textarea.classList.add('active');
      // Button anzeigen, wenn Textarea aktiv ist
      if (btn) btn.style.display = 'block';
    });
    
    textarea.addEventListener('blur', function() {
      textarea.classList.remove('active');
      // Button ausblenden, wenn Textarea nicht aktiv ist
      // Aber nur, wenn der Button nicht gerade angeklickt wird
      setTimeout(function() {
        if (document.activeElement !== btn) {
          btn.style.display = 'none';
        }
      }, 100);
    });
    
    var config = {
      lang: opts.lang || 'de-DE',
      hotkey: opts.hotkey || { ctrlKey: true, shiftKey: true, key: '.' },
      onToggle: typeof opts.onToggle === 'function' ? opts.onToggle : function(){},
      button: opts.button || null,
      interimEl: opts.interimEl || null
    };

    // Button bereitstellen (extern oder erzeugen)
    var btn = config.button || this._createInlineButton(textarea);
    btn.title = this.supported
      ? 'Diktieren starten/stoppen (Strg+Umschalt+.)'
      : 'Spracherkennung nicht verfügbar';
    btn.setAttribute('aria-label', 'Diktieren');
    btn.disabled = !this.supported;
    
    // Button initial ausblenden
    btn.style.display = 'none';

    // Interim-Element bereitstellen
    var interim = config.interimEl || this._createInlineInterim(textarea);

    var self = this;

    function start() {
      if (!self.supported || self.active) return;
      self.recog = new self.SRClass();
      self.recog.lang = config.lang;
      self.recog.continuous = true;
      self.recog.interimResults = true;

      self.recog.onresult = function(e) {
        var interimText = '';
        var finalText = '';
        for (var i = e.resultIndex; i < e.results.length; i++) {
          var res = e.results[i];
          var txt = res[0].transcript;
          if (res.isFinal) finalText += txt;
          else interimText += txt;
        }
        // Interim anzeigen
        interim.style.display = interimText ? 'inline' : 'none';
        interim.textContent = interimText ? '… ' + interimText.trim() : '';

        // Final einfügen
        if (finalText) {
          var cleaned = self._applyGermanPunctuation(finalText);
          self._insertAtCursor(textarea, cleaned + ' ');
          interim.textContent = '';
          interim.style.display = 'none';
        }
      };

      self.recog.onerror = function(evt) {
        console.warn('[Dictation] error:', evt.error);
        if (['no-speech', 'aborted'].indexOf(evt.error) === -1) {
          stop();
          alert('Spracherkennung: ' + evt.error);
        }
      };

      self.recog.onend = function() {
        if (self.active) {
          try { self.recog.start(); } catch (e) {}
        }
      };

      try {
        self.recog.start();
        self.active = true;
        btn.classList.add('dictation-on');
        config.onToggle(true);
      } catch (err) {
        console.error(err);
        alert('Konnte Spracherkennung nicht starten. HTTPS/localhost & Mikrofon-Freigabe nötig.');
      }
    }

    function stop() {
      if (!self.active) return;
      try { self.recog.stop(); } catch (e) {}
      self.active = false;
      btn.classList.remove('dictation-on');
      interim.textContent = '';
      interim.style.display = 'none';
      config.onToggle(false);
    }

    btn.addEventListener('click', function(){ self.active ? stop() : start(); });

    // Verhindern, dass Button beim Klick ausgeblendet wird
    btn.addEventListener('mousedown', function(e) {
      e.preventDefault();
    });

    // Globaler Hotkey (einmalig)
    if (!this._globalKeyHandlerInstalled) {
      var onKey = function(ev) {
        var h = config.hotkey;
        if (
          (!!ev.ctrlKey === !!h.ctrlKey) &&
          (!!ev.shiftKey === !!h.shiftKey) &&
          (!!ev.altKey === !!h.altKey) &&
          (ev.key === h.key)
        ) {
          ev.preventDefault();
          (self.active ? stop() : start());
        }
      };
      document.addEventListener('keydown', onKey, { passive: false });
      this._globalKeyHandlerInstalled = true;
    }

    // Cleanup bei Unload
    var onUnload = function(){ stop(); };
    global.addEventListener('beforeunload', onUnload);

    this.bound.add(textarea);
  };

  DictationController.prototype._createInlineButton = function(textarea) {
    // Button direkt NACH dem Textarea einfügen
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'wp_desc_mic';
    btn.className = 'dictation-btn';
    btn.textContent = '🎤 Diktieren';
    textarea.insertAdjacentElement('afterend', btn);
    return btn;
  };

  DictationController.prototype._createInlineInterim = function(textarea) {
    var interim = document.createElement('span');
    interim.id = 'wp_desc_interim';
    interim.className = 'dictation-interim';
    interim.style.display = 'none';
    interim.style.marginLeft = '8px';
    interim.style.fontSize = '0.9em';
    interim.style.color = '#666';
    var next = textarea.nextElementSibling;
    if (next) {
      next.insertAdjacentElement('afterend', interim);
    } else {
      textarea.insertAdjacentElement('afterend', interim);
    }
    return interim;
  };

  DictationController.prototype._insertAtCursor = function(textarea, text) {
    var start = (textarea.selectionStart != null) ? textarea.selectionStart : textarea.value.length;
    var end   = (textarea.selectionEnd != null) ? textarea.selectionEnd : textarea.value.length;
    var before = textarea.value.slice(0, start);
    var after  = textarea.value.slice(end);
    textarea.value = before + text + after;
    var caret = start + text.length;
    textarea.setSelectionRange(caret, caret);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  };

  DictationController.prototype._applyGermanPunctuation = function(s) {
    var t = ' ' + s.trim() + ' ';
    t = t.replace(/\s+(punkt|punktum)\s+/gi, '. ');
    t = t.replace(/\s+(komma)\s+/gi, ', ');
    t = t.replace(/\s+(fragezeichen)\s+/gi, '? ');
    t = t.replace(/\s+(ausrufezeichen|rufzeichen)\s+/gi, '! ');
    t = t.replace(/\s+(neue\s+zeile|zeilenumbruch|enter)\s+/gi, '\n');
    t = t.replace(/\s{2,}/g, ' ');
    return t.trim();
  };

  // global export
  global.DictationController = DictationController;
})(window);