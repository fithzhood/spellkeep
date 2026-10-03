// Musica: loop chiptune generati con Suno (Documenti\app\assets\20-musica\suno-2026), SPENTA di serie.
// Si accende dalle impostazioni; la scelta sta in localStorage 'spellkeep.musica' ('on' accende, tutto il resto no).
//
// Ogni schermata chiede una scena (menu, negozio, partita, sfida) e i brani si passano in dissolvenza: menu, tema e
// negozio sono in Do maggiore, il boss delle sfide in La minore (la relativa), quindi si incrociano senza stonare.
// A fine partita si spegne il loop e suona una volta sola il congedo (vittoria o sconfitta).
//
// Web Audio e non <audio loop>: il giro si richiude al campione (Ogg Opus, lunghezza esatta) e serve la dissolvenza.
// Il modulo e' quello di Element Battle (Documenti\app\Element\element.js), riscritto per le scene di SpellKeep.
(function (radice) {
  'use strict';
  var VER = (function () {
    var s = document.querySelector('script[src*="musica.js"]'), m = s && /[?&]v=(\d+)/.exec(s.getAttribute('src'));
    return m ? '?v=' + m[1] : '';
  })();
  var CHIAVE = 'spellkeep.musica';
  var LOOP = { menu: 1, negozio: 1, partita: 1, sfida: 1 };       // gli altri brani sono congedi: una volta e basta

  function leggi() { try { return localStorage.getItem(CHIAVE) === 'on'; } catch (e) { return false; } }

  var M = {
    on: leggi(),
    ctx: null, master: null,
    voci: {},          // nome -> { src, gain, chiudi } dei loop che stanno suonando
    buf: {}, chiesti: {},
    voluta: null,      // la scena che la schermata chiede adesso
    sospesa: false,    // telefono in tasca
    INCROCIO: 1.4,

    contesto: function () {
      if (this.ctx) return this.ctx;
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      this.ctx = new C();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      return this.ctx;
    },

    carica: function (nome) {
      var self = this;
      if (this.buf[nome]) return Promise.resolve(this.buf[nome]);
      if (this.chiesti[nome]) return this.chiesti[nome];
      if (!this.ctx) return Promise.resolve(null);
      this.chiesti[nome] = fetch('audio/' + nome + '.ogg' + VER)
        .then(function (r) { return r.ok ? r.arrayBuffer() : Promise.reject(r.status); })
        .then(function (a) { return new Promise(function (ok, no) { self.ctx.decodeAudioData(a, ok, no); }); })
        .then(function (b) { self.buf[nome] = b; return b; })
        // un brano che non scende non ferma il gioco, e si potra' riprovare
        .catch(function () { self.chiesti[nome] = null; return null; });
      return this.chiesti[nome];
    },

    // rampa a potenza costante (curva a seno, come il qsin di ffmpeg): due rampe lineari incrociate fanno un buco
    // di 3 dB a meta'. Riparte dal punto in cui la curva si trova, cosi' un passaggio interrotto non fa scalini.
    rampa: function (param, meta, quanto) {
      var t = this.ctx.currentTime, v = Math.min(1, Math.max(0, param.value));
      var x0 = (meta ? Math.asin(v) : Math.acos(v)) / (Math.PI / 2);
      var durata = Math.max(0.04, quanto * (1 - x0)), n = 32, c = new Float32Array(n);
      for (var i = 0; i < n; i++) {
        var x = x0 + (1 - x0) * (i / (n - 1));
        c[i] = meta ? Math.sin(x * Math.PI / 2) : Math.cos(x * Math.PI / 2);
      }
      c[n - 1] = meta ? 1 : 0.0001;
      // cancelScheduledValues non ferma una curva gia' partita: serve cancelAndHoldAtTime
      if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t); else param.cancelScheduledValues(t);
      try { param.setValueCurveAtTime(c, t, durata); } catch (e) { param.linearRampToValueAtTime(c[n - 1], t + durata); }
      return durata;
    },

    accendi: function (nome, quanto) {
      var gia = this.voci[nome];
      if (gia) {   // stava sfumando: si riporta su da dov'e', senza una seconda copia sovrapposta
        clearTimeout(gia.chiudi); gia.chiudi = 0;
        this.rampa(gia.gain.gain, 1, quanto);
        return;
      }
      var src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      src.buffer = this.buf[nome]; src.loop = true;
      g.gain.value = 0.0001;
      src.connect(g); g.connect(this.master);
      src.start();
      this.voci[nome] = { src: src, gain: g, chiudi: 0 };
      this.rampa(g.gain, 1, quanto);
    },

    spegni: function (nome, quanto) {
      var self = this, v = this.voci[nome];
      if (!v || v.chiudi) return;
      var durata = this.rampa(v.gain.gain, 0, quanto);
      v.chiudi = setTimeout(function () {
        if (self.voci[nome] === v) delete self.voci[nome];
        try { v.src.stop(); } catch (e) {}
      }, durata * 1000 + 80);
    },

    // porta i loop a combaciare con la scena voluta
    aggiorna: function () {
      var self = this, vuole = this.voluta;
      if (!this.on || this.sospesa || !this.contesto()) return;
      var sistema = function () {
        if (vuole) self.accendi(vuole, self.INCROCIO);
        Object.keys(self.voci).forEach(function (n) { if (n !== vuole) self.spegni(n, self.INCROCIO); });
      };
      if (!vuole || this.buf[vuole]) return sistema();
      this.carica(vuole).then(function (b) { if (b && self.voluta === vuole) sistema(); });
    },

    scena: function (nome) {
      if (!LOOP[nome] || nome === this.voluta) return;
      this.voluta = nome;
      this.aggiorna();
    },

    // fine partita: via il loop, poi il congedo una volta sola (null = pareggio: solo silenzio)
    congedo: function (nome) {
      var self = this;
      this.voluta = null;
      if (!this.on || this.sospesa || !this.contesto()) return;
      Object.keys(this.voci).forEach(function (n) { self.spegni(n, 0.35); });
      if (!nome) return;
      this.carica(nome).then(function (b) {
        if (!b || self.voluta) return;     // nel frattempo si e' gia' passati a un'altra schermata
        var src = self.ctx.createBufferSource();
        src.buffer = b; src.connect(self.master);
        src.start(self.ctx.currentTime + 0.3);
      });
    },

    fermaTutto: function () {
      var self = this;
      Object.keys(this.voci).forEach(function (n) {
        var v = self.voci[n];
        clearTimeout(v.chiudi);
        delete self.voci[n];
        try { v.src.stop(); } catch (e) {}
      });
    },

    imposta: function (on) {
      this.on = !!on;
      try { localStorage.setItem(CHIAVE, this.on ? 'on' : 'off'); } catch (e) {}
      if (this.on) {
        if (this.contesto() && this.ctx.state === 'suspended') this.ctx.resume();
        this.aggiorna();
      } else this.fermaTutto();
      return this.on;
    }
  };

  // i browser tengono l'audio sospeso fino al primo tocco: lo si sblocca li'
  document.addEventListener('pointerdown', function () {
    if (M.on && M.contesto() && M.ctx.state === 'suspended') { M.ctx.resume(); M.aggiorna(); }
  }, true);
  // col telefono in tasca la musica non continua, e i decodificatori si fermano davvero
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { M.sospesa = true; M.fermaTutto(); }
    else if (M.sospesa) { M.sospesa = false; M.aggiorna(); }
  });

  radice.Musica = M;
})(window);
