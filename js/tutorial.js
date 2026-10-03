// Tutorial: lezioni brevi, ognuna su un concetto. Sono partite vere del motore guidate da un copione.
// Le mosse le fa il giocatore: tutto lo schermo e' bloccato tranne il punto che il passo chiede di toccare
// (quattro riquadri trasparenti attorno al "buco" del riflettore fermano gli altri tocchi). Le mosse
// dell'avversario e i salti in avanti li esegue il copione. Il fumetto si mette dove non copre ne' il bersaglio
// ne' la carta in gioco, e mentre succede qualcosa si riduce a una striscia.
// Niente salvataggi e niente statistiche: Battaglia riceve opz.tutorial e lascia a noi il dopo-mossa.
(function (radice) {
  'use strict';
  var el = UI.el;

  function idDi(nome) {
    var d = Motore.catalogo.lista.filter(function (x) { return x.nome === nome; })[0];
    if (!d) throw new Error('carta del tutorial non trovata: ' + nome);
    return d.id;
  }
  function attendi(ms, fn) { return setTimeout(fn, ms); }
  function posizione(b, chi, nome) {
    var g = b.p.g[chi], id = idDi(nome);
    for (var i = 1; i <= 8; i++) if (+g.Hand.get(i) === id) return i;
    return 0;
  }
  function selCarta(b, nome) { return '.mano .carta[data-pos="' + posizione(b, 1, nome) + '"]'; }
  function rettangolo(b) {
    if (!b) return null;
    var e = typeof b === 'function' ? b() : document.querySelector(b);
    if (!e) return null;
    var r = e.getBoundingClientRect();
    return r.width ? r : null;
  }
  function sovrapp(a, b) {
    var w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? w * h : 0;
  }

  // ------------------------------------------------------------------ il regista
  function Regia(app, lezione) {
    this.app = app; this.lez = lezione; this.i = -1; this.b = null; this.chiuso = false; this.timer = null;
    var self = this;
    this.faro = el('div', 'tut-faro');
    this.blocchi = [0, 1, 2, 3].map(function () {
      var x = el('div', 'tut-blocco');
      x.addEventListener('click', function () { self.richiama(); });
      return x;
    });
    this.dito = el('div', 'tut-dito');
    this.fum = el('div', 'tut-fum');
    this.fum.innerHTML = '<div class="f-testa"><span class="f-num"></span><button class="f-esci">Exit</button></div>' +
      '<h3></h3><p></p><div class="f-piede"><div class="f-punti"></div><span class="f-fai">Your move</span><button class="btn oro f-avanti">Next</button></div>';
    this.avanti = this.fum.querySelector('.f-avanti');
    this.avanti.addEventListener('click', function () { if (!self.avanti.disabled) self.passo(self.i + 1); });
    this.fum.querySelector('.f-esci').addEventListener('click', function () { self.esci(); });
    this.suRidimensiona = function () { self.posiziona(); };
    window.addEventListener('resize', this.suRidimensiona);
  }

  // il campo della lezione: mani e numeri decisi dal copione
  Regia.prototype.campo = function (c) {
    var p = new Motore.Partita({ mazzi: [Motore.mazzoCasuale(new Motore.Caso(11)), Motore.mazzoCasuale(new Motore.Caso(12))],
      seme: 77, primo: 1, nascoste: false });
    function metti(g, mano, numeri, seg) {
      (mano || []).forEach(function (nome, k) { g.Hand.set(k + 1, idDi(nome)); });
      Object.keys(numeri || {}).forEach(function (k) { g[k] = numeri[k]; });
      g.NewCards = null;
      g.TokenNames.set(1, seg ? seg[0] : 'none'); g.TokenNames.set(2, 'none'); g.TokenNames.set(3, 'none');
      g.TokenValues.set(1, seg ? seg[1] : 0);
    }
    metti(p.g[1], c.mano, c.io, c.segnalino);
    metti(p.g[2], c.manoLui, c.lui, null);
    var self = this;
    this.b = new Battaglia(this.app, { partita: p, sfida: c.avversario || null, titolo: 'Tutorial', rivincita: null,
      tutorial: { mossa: function (b, r, id) { self.dopoMossa(r, id); }, esci: function () { self.esci(); } } });
    this.b.bloccato = true;
    this.b.aggiorna();
  };

  Regia.prototype.avvia = function () {
    if (this.lez.palco) this.lez.palco(this); else this.campo(this.lez.campo);
    var self = this;
    [this.faro].concat(this.blocchi, [this.fum, this.dito]).forEach(function (x) { document.body.appendChild(x); });
    // il velo scuro arriva in dissolvenza: niente lampo dello sfondo chiaro
    requestAnimationFrame(function () { self.faro.classList.add('acceso'); });
    this.passo(0);
  };

  // un passo: info (Next), azione del copione (fai: parte da sola, Next aspetta), o attesa di una mossa del giocatore
  Regia.prototype.passo = function (i) {
    var self = this, passi = this.lez.passi;
    if (this.chiuso) return;
    clearInterval(this.timer);
    if (i >= passi.length) return this.fine();
    // chiude cio' che il passo prima aveva aperto e che questo non usa
    var s = passi[i], prima = passi[i - 1];
    if (prima && prima.chiudiPoi) document.querySelectorAll(prima.chiudiPoi).forEach(function (x) { x.remove(); });
    this.i = i;
    this.nascondi();
    this.azione(false);
    this.fum.classList.toggle('attesa', !!s.attesa);
    this.fum.querySelector('h3').textContent = s.t || '';
    this.fum.querySelector('p').innerHTML = typeof s.x === 'function' ? s.x(this) : (s.x || '');
    this.fum.querySelector('.f-num').textContent = this.lez.titolo + ' · ' + (i + 1) + '/' + passi.length;
    this.fum.querySelector('.f-punti').innerHTML = passi.map(function (x, k) { return '<i class="' + (k < i ? 'fatto' : k === i ? 'qui' : '') + '"></i>'; }).join('');
    this.avanti.textContent = i === passi.length - 1 ? 'Finish' : 'Next';
    this.fum.classList.remove('entra'); void this.fum.offsetWidth; this.fum.classList.add('entra');
    this.bersaglio = s.faro ? (typeof s.faro === 'function' ? s.faro.bind(null, this) : s.faro) : null;
    this.dito.classList.remove('giro');
    if (this.b) {
      this.b.bloccato = !s.attesa;
      if (s.attesa && this.b.p.stato === 'in corso' && this.b.p.corrente !== 1) { this.b.p.corrente = 1; this.b.aggiorna(); }
    }
    if (s.prima) s.prima(this);
    if (s.attesa) this.aspetta(s);
    this.posiziona();
    if (s.fai) {
      this.avanti.disabled = true;
      attendi(500, function () {
        if (self.chiuso || self.i !== i) return;
        self.azione(true);
        s.fai(self, function () {
          if (self.i !== i) return;
          self.azione(false);
          if (s.dopo) { self.nascondi(); self.fum.querySelector('p').innerHTML += ' ' + (typeof s.dopo === 'function' ? s.dopo(self) : s.dopo); }
          self.avanti.disabled = false;
          self.posiziona();
        });
      });
    } else this.avanti.disabled = !!s.attesa;
  };

  // in attesa: il dito indica il bersaglio a ripetizione; il passo si chiude quando la condizione si avvera
  Regia.prototype.aspetta = function (s) {
    var self = this, a = s.attesa, i = this.i;
    if (a.tipo === 'apri') {
      var id = idDi(a.carta);
      this.timer = setInterval(function () {
        var c = document.querySelector('.lente .carta');
        if (c && +c.dataset.id === id) { clearInterval(self.timer); attendi(250, function () { if (self.i === i) self.passo(i + 1); }); }
      }, 120);
    } else if (a.tipo === 'seg') {
      this.timer = setInterval(function () {
        if (document.querySelector('.spiega-seg')) { clearInterval(self.timer); attendi(200, function () { if (self.i === i) self.passo(i + 1); }); }
      }, 120);
    }
    // 'gioca': lo chiude dopoMossa
  };

  // la mossa del giocatore e' fatta (Battaglia ha gia' mostrato la carta ed eseguito il motore)
  Regia.prototype.dopoMossa = function (r, id) {
    var self = this, b = this.b, s = this.lez.passi[this.i];
    b.bloccato = true;
    this.azione(true);
    b.aggiorna();
    b.scatti(r.segnalini, id, 1, function () {
      if (s && s.attesa && s.attesa.tipo === 'gioca') attendi(300, function () { self.passo(self.i + 1); });
    });
  };

  // durante una mossa: velo leggero e fumetto ridotto, cosi' si vede cosa succede
  Regia.prototype.azione = function (si) {
    if (this.fum.classList.contains('mini') !== !!si) this.nascondi();   // cambia misura: si nasconde prima
    this.inAzione = si;
    this.faro.classList.toggle('leggero', si);
    this.fum.classList.toggle('mini', si);
    if (si) this.dito.classList.remove('giro');
    this.posiziona();
  };

  // tocco fuori dal bersaglio: il dito ricorda dove toccare, o Next si fa notare
  Regia.prototype.richiama = function () {
    var s = this.lez.passi[this.i];
    if (this.inAzione) return;
    if (s && s.attesa) this.mostraDito();
    else { this.avanti.classList.remove('scuoti'); void this.avanti.offsetWidth; this.avanti.classList.add('scuoti'); }
  };
  Regia.prototype.mostraDito = function () {
    var r = rettangolo(this.bersaglio), d = this.dito;
    if (!r) return;
    d.style.left = (r.left + r.width / 2) + 'px'; d.style.top = (r.top + r.height / 2) + 'px';
    d.classList.remove('giro'); void d.offsetWidth; d.classList.add('giro');
  };

  // riflettore e blocchi attorno al bersaglio; fumetto nel posto che copre meno
  Regia.prototype.posiziona = function () {
    if (this.chiuso) return;
    var r = rettangolo(this.bersaglio), W = innerWidth, H = innerHeight, m = 5, s = this.lez.passi[this.i] || {};
    var buco = r ? { left: r.left - m, top: r.top - m, right: r.right + m, bottom: r.bottom + m } : null;
    if (buco) this.faro.style.cssText = 'left:' + buco.left + 'px;top:' + buco.top + 'px;width:' + (buco.right - buco.left) + 'px;height:' + (buco.bottom - buco.top) + 'px';
    else this.faro.style.cssText = 'left:' + (W / 2) + 'px;top:' + (H / 2) + 'px;width:0;height:0';
    // i blocchi lasciano libero solo il buco, e solo nei passi in cui si deve toccare
    var rett;
    if (s.attesa && buco && !this.inAzione) {
      rett = [[0, 0, W, buco.top], [0, buco.bottom, W, H - buco.bottom], [0, buco.top, buco.left, buco.bottom - buco.top],
        [buco.right, buco.top, W - buco.right, buco.bottom - buco.top]];
    } else rett = [[0, 0, W, H], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    this.blocchi.forEach(function (x, k) { var q = rett[k]; x.style.cssText = 'left:' + q[0] + 'px;top:' + q[1] + 'px;width:' + Math.max(0, q[2]) + 'px;height:' + Math.max(0, q[3]) + 'px'; });
    if (s.attesa && !this.inAzione) this.mostraDito();
    // fumetto: fra angoli e bordi, quello che copre meno il bersaglio e quello che sta succedendo
    var f = this.fum, g = 8, fw, fh;
    var evita = [];
    if (buco) evita.push([buco, 60]);          // il bersaglio non si copre mai, se c'e' un posto libero
    ['.lente', '.spiega-seg', '.entrata', '.scatto-seg .riq'].forEach(function (q) { var x = rettangolo(q); if (x) evita.push([x, 3]); });
    if (s.zona) s.zona.forEach(function (q) { var x = rettangolo(q); if (x) evita.push([x, 1]); });
    // larghezza piena; se non c'e' un posto che non copra niente, piu' stretto (sta nelle strisce ai lati della
    // carta aperta, che resta dov'e' nel gioco)
    var meglio = null, costo = Infinity, largo = null, vecchia = f.style.width;
    var larghezze = f.classList.contains('mini') ? [null] : [null, 220, 180];
    for (var li = 0; li < larghezze.length && costo > 20; li++) {
      f.style.width = larghezze[li] ? larghezze[li] + 'px' : '';
      fw = f.offsetWidth; fh = f.offsetHeight;
      var pos = [[g, g], [W - fw - g, g], [(W - fw) / 2, g], [g, H - fh - g], [W - fw - g, H - fh - g], [(W - fw) / 2, H - fh - g],
        [g, (H - fh) / 2], [W - fw - g, (H - fh) / 2], [(W - fw) / 2, (H - fh) / 2]];
      pos.forEach(function (p, k) {
        var box = { left: p[0], top: p[1], right: p[0] + fw, bottom: p[1] + fh }, c = k * 0.5 + li * 2;   // a parita', ordine e larghezza piena
        evita.forEach(function (e) { c += sovrapp(box, e[0]) * e[1]; });
        if (c < costo) { costo = c; meglio = p; largo = larghezze[li]; }
      });
    }
    f.style.width = largo ? largo + 'px' : '';
    fw = f.offsetWidth; fh = f.offsetHeight;
    // sempre dentro lo schermo
    var x = Math.round(Math.max(g, Math.min(meglio[0], W - fw - g))), y = Math.round(Math.max(g, Math.min(meglio[1], H - fh - g)));
    // cambiare posto: sparisce e ricompare li' (attraversare lo schermo scivolando sembrava strano)
    // misura e posto cambiano a fumetto invisibile (sparisce di colpo, ricompare in dissolvenza): mai un attimo
    // con il testo nuovo, o la misura nuova, nel posto vecchio
    var ox = parseFloat(f.style.left), oy = parseFloat(f.style.top), nuova = f.style.width;
    var fermo = !isNaN(ox) && Math.abs(ox - x) < 3 && Math.abs(oy - y) < 3 && nuova === vecchia;
    clearTimeout(this.tSposta);
    if (fermo && !f.classList.contains('sposta')) return;
    f.classList.add('sposta');
    f.style.width = nuova; f.style.left = x + 'px'; f.style.top = y + 'px';
    this.tSposta = setTimeout(function () { f.classList.remove('sposta'); }, 30);
  };
  // prima di cambiare il testo: via di colpo, cosi' il testo nuovo non si vede nel posto vecchio
  Regia.prototype.nascondi = function () { this.fum.classList.add('sposta'); };

  // una mossa del copione (avversario, o salti in avanti): la carta entra e il motore la esegue
  Regia.prototype.gioca = function (chi, nome, fn, azione) {
    var self = this, b = this.b, pos = posizione(b, chi, nome), id = b.p.g[chi].Hand.get(pos);
    azione = azione || 'play';
    UI.chiudiLente();
    b.mostraEntrata(id, chi === 1 ? (azione === 'play' ? 'You play' : 'You discard') : 'Opponent plays', 1100, function () {
      if (self.chiuso) return;
      b.p.corrente = chi;
      var r = b.p.usaCarta(chi, azione, pos, 0);
      b.aggiorna();
      b.scatti(r.segnalini, id, chi, function () { attendi(350, fn); });
    });
  };
  // fotografa i numeri prima di una mossa, per raccontarli dopo
  Regia.prototype.foto = function () {
    var g1 = this.b.p.g[1], g2 = this.b.p.g[2], f = {};
    ['Tower', 'Wall', 'Bricks', 'Gems', 'Recruits', 'Quarry'].forEach(function (k) { f['io' + k] = g1[k]; f['lui' + k] = g2[k]; });
    f.seg = +g1.TokenValues.get(1);
    this.istantanea = f;
  };
  Regia.prototype.danno = function (chi) {
    var f = this.istantanea, g = this.b.p.g[chi], k = chi === 1 ? 'io' : 'lui';
    var dm = f[k + 'Wall'] - g.Wall, dt = f[k + 'Tower'] - g.Tower;
    var parti = [];
    if (dm > 0) parti.push('wall −' + dm);
    if (dt > 0) parti.push('tower −' + dt);
    return parti.length ? parti.join(', ') : 'no damage';
  };

  Regia.prototype.fine = function () {
    var self = this, pr = this.app.profilo;
    pr.d.tutorial = pr.d.tutorial || {};
    pr.d.tutorial[this.lez.id] = true; pr.salva();
    var k = LEZIONI.indexOf(this.lez), dopo = LEZIONI[k + 1];
    this.bersaglio = null;
    this.nascondi();
    this.fum.classList.remove('attesa', 'mini');
    this.fum.querySelector('h3').textContent = 'Lesson complete';
    this.fum.querySelector('p').innerHTML = '“' + this.lez.titolo + '” done.' + (dopo ? ' Next lesson: <b>' + dopo.titolo + '</b>.' : ' That is everything: time to play!');
    this.fum.querySelector('.f-punti').innerHTML = '';
    var piede = this.fum.querySelector('.f-piede');
    piede.innerHTML = '';
    var lista = el('button', 'btn', 'All lessons'), avanti = el('button', 'btn oro', dopo ? 'Next lesson' : 'Play');
    lista.addEventListener('click', function () { self.chiudi(); Tutorial.menu(self.app); });
    avanti.addEventListener('click', function () { self.chiudi(); if (dopo) Tutorial.avvia(self.app, dopo.id); else self.app.preparazione(); });
    piede.appendChild(lista); piede.appendChild(avanti);
    this.posiziona();
  };
  Regia.prototype.chiudi = function () {
    this.chiuso = true;
    clearInterval(this.timer);
    window.removeEventListener('resize', this.suRidimensiona);
    [this.faro, this.fum, this.dito].concat(this.blocchi).forEach(function (x) { x.remove(); });
    document.querySelectorAll('.entrata, .scatto-seg, .velo-seg').forEach(function (x) { x.remove(); });
    UI.chiudiLente();
    if (this.b) this.b.chiuso = true;
  };
  Regia.prototype.esci = function () { this.chiudi(); Tutorial.menu(this.app); };

  // ------------------------------------------------------------------ passi riusabili
  // tocca una carta della mano (si apre in grande)
  function tocca(nome, t, x) {
    return { t: t, x: x, faro: function (T) { return document.querySelector(selCarta(T.b, nome)); }, attesa: { tipo: 'apri', carta: nome } };
  }
  // premi Play (o Discard) nella carta aperta
  function premi(azione, t, x) {
    return { t: t, x: x, faro: azione === 'discard' ? '.lente .azioni .btn:not(.oro)' : '.lente .azioni .btn.oro',
      attesa: { tipo: 'gioca' }, prima: function (T) { T.foto(); }, zona: ['.rocca.io', '.rocca.lui'] };
  }

  // ------------------------------------------------------------------ le lezioni
  var MANO_BASE = ['Scout tower', 'Fortified wall', 'Knight', 'Archer', 'Sculptor', 'Chapel', 'Poison frog', 'Catapult'];
  var LEZIONI = [
    { id: 'scopo', titolo: 'The goal', sotto: 'The three ways to win a game.',
      campo: { mano: MANO_BASE, manoLui: MANO_BASE, io: { Bricks: 15, Gems: 15, Recruits: 15 }, lui: { Tower: 3, Wall: 0 } },
      passi: [
        { t: 'Two castles', x: 'You are on the left, your opponent on the right. Each castle has a <b>tower</b> and, in front of it, a <b>wall</b>.', faro: '.rocca.io' },
        { t: 'Build up', x: 'If your tower reaches <b>100</b>, you win.', faro: '.rocca.io .torre .targa' },
        { t: 'Knock down', x: 'If the enemy tower drops to <b>0</b>, you also win. This one has only 3 left, and no wall to protect it.', faro: '.rocca.lui' },
        tocca('Archer', 'Tap the Archer', 'The <b>Archer</b> hits the enemy tower for 3. Tap it to see it up close.'),
        premi('play', 'Play it', 'Press <b>Play</b>.'),
        { t: 'You win!', x: 'The enemy tower has fallen: that is a victory.', faro: '.rocca.lui' },
        { t: 'Or get rich', x: 'The third way to win: collect <b>400</b> resources in total (bricks + gems + recruits). It is rare, but it happens.', faro: '.ris-io' }
      ] },
    { id: 'risorse', titolo: 'Resources', sotto: 'Bricks, gems, recruits, and the buildings that produce them.',
      campo: { mano: MANO_BASE, manoLui: MANO_BASE, io: { Bricks: 12, Gems: 10, Recruits: 9 } },
      passi: [
        { t: 'Three resources', x: 'You have three resources: <b>bricks</b> (red), <b>gems</b> (blue) and <b>recruits</b> (green). Cards cost resources.', faro: '.ris-io' },
        { t: 'Buildings', x: 'Under each resource is the building that produces it: <b>Mine</b>, <b>Altar</b>, <b>Lair</b>. “Mine 3” means you get 3 bricks every turn.', faro: '.ris-io .ris.b' },
        { t: 'What a card costs', x: 'The coloured circles in the top left corner of a card show its cost: a red circle is bricks, blue is gems, green is recruits. The <b>Sculptor</b> costs 9 bricks.',
          faro: function (T) { return document.querySelector(selCarta(T.b, 'Sculptor') + ' .costi'); } },
        tocca('Sculptor', 'Tap the Sculptor', 'The Sculptor upgrades your Mine. Tap it.'),
        premi('play', 'Play it', 'Press <b>Play</b>.'),
        { t: 'A better Mine', faro: '.ris-io .ris.b',
          x: function (T) { return 'Your Mine went from ' + T.istantanea.ioQuarry + ' to <b>' + T.b.p.g[1].Quarry + '</b>, for the rest of the game. At the end of your turn you also collected its production: the green number next to your bricks.'; } }
      ] },
    { id: 'carte', titolo: 'Playing cards', sotto: 'Your hand: playing and discarding.',
      campo: { mano: ['Scout tower', 'Fortified wall', 'Catapult', 'Archer', 'Sculptor', 'Chapel', 'Poison frog', 'Knight'], manoLui: MANO_BASE,
        io: { Bricks: 9, Gems: 4, Recruits: 6 } },
      passi: [
        { t: 'Your hand', x: 'You hold eight cards. Each turn you <b>play</b> one card or <b>discard</b> one, and then you draw a new card.', faro: '.mano' },
        { t: 'Too expensive', x: 'A <b>dashed border</b> means you can’t afford the card yet. The cost you are missing has a red ring: the Catapult needs 16 recruits, and you have 6.',
          faro: function (T) { return document.querySelector(selCarta(T.b, 'Catapult')); } },
        tocca('Fortified wall', 'Tap the Fortified wall', 'Tap it to see it up close.'),
        { t: 'Preview', x: 'While a card is selected, small numbers next to the castles show what it will do. Here: your wall +8.', faro: '.rocca.io .muro .targa', zona: ['.lente'] },
        premi('play', 'Play it', 'Press <b>Play</b>.'),
        { t: 'Done', x: function (T) { return 'Your wall went from ' + T.istantanea.ioWall + ' to <b>' + T.b.p.g[1].Wall + '</b>, and a new card took its place in your hand.'; }, faro: '.rocca.io .muro' },
        tocca('Catapult', 'Discarding', 'When no card helps, you can throw one away. Tap the <b>Catapult</b>.'),
        premi('discard', 'Discard it', 'Press <b>Discard</b>.'),
        { t: 'Discarded', x: 'The Catapult is gone and you drew another card. Discarding uses up your turn, just like playing.', faro: '.mano' }
      ] },
    { id: 'attacco', titolo: 'Attacks', sotto: 'Damage hits the wall first, then the tower.',
      campo: { mano: MANO_BASE, manoLui: ['Orc grunt', 'Knight', 'Archer', 'Gate', 'Scout tower', 'Catapult', 'Chapel', 'Sculptor'],
        io: { Bricks: 15, Gems: 15, Recruits: 20 }, lui: { Wall: 5, Recruits: 20 } },
      passi: [
        { t: 'The wall protects', x: 'Most attacks hit the <b>wall</b> first. Only the damage the wall can’t absorb reaches the tower. The enemy wall is 5.', faro: '.rocca.lui' },
        tocca('Knight', 'Tap the Knight', 'The <b>Knight</b> is an attack card. Tap it.'),
        premi('play', 'Play it', 'Press <b>Play</b>.'),
        { t: 'Wall first', faro: '.rocca.lui', x: function (T) { return 'Enemy: <b>' + T.danno(2) + '</b>. The wall took what it could; the rest went to the tower.'; } },
        tocca('Archer', 'Straight to the tower', 'Cards that say <b>Enemy tower</b> skip the wall. Tap the <b>Archer</b>.'),
        premi('play', 'Play it', 'Press <b>Play</b>.'),
        { t: 'Direct hit', faro: '.rocca.lui .torre', x: function (T) { return 'Enemy: <b>' + T.danno(2) + '</b>. The wall wasn’t touched.'; } },
        { t: 'Their turn', x: 'Now the opponent attacks you with an <b>Orc grunt</b>.', faro: '.rocca.io', zona: ['.rocca.lui'],
          fai: function (T, ok) { T.foto(); T.gioca(2, 'Orc grunt', ok); },
          dopo: function (T) { return 'You: <b>' + T.danno(1) + '</b>. A high wall keeps your tower safe.'; } }
      ] },
    { id: 'keyword', titolo: 'Keywords', sotto: 'Card icons, and cards that let you play again.',
      campo: { mano: MANO_BASE, manoLui: MANO_BASE, io: { Bricks: 15, Gems: 15, Recruits: 15 } },
      passi: [
        { t: 'Keywords', x: 'The small icons in the bottom right corner of a picture are <b>keywords</b>: each one adds a rule to the card.',
          faro: function (T) { return document.querySelector(selCarta(T.b, 'Poison frog') + ' .kw'); } },
        tocca('Poison frog', 'Tap the Poison frog', 'Tap it to read its keywords.'),
        { t: 'Read them', x: 'Every keyword is explained next to the card. <b>Quick</b> means: after this card, you play again.', faro: '.lente .kwlista' },
        premi('play', 'Play it', 'Press <b>Play</b>.'),
        { t: 'Still your turn', x: 'Thanks to <b>Quick</b> it is still your turn: you can play another card straight away.', faro: '.giro' },
        { t: 'Card families', x: 'Many keywords get stronger when you hold other cards of the same family. Building a deck around one keyword is a good plan.', faro: '.mano' }
      ] },
    { id: 'token', titolo: 'Keyword token', sotto: 'The ring that fills up to 100.',
      campo: { mano: ['Chapel', 'Scout tower', 'Fortified wall', 'Knight', 'Archer', 'Sculptor', 'Poison frog', 'Catapult'], manoLui: MANO_BASE,
        io: { Bricks: 25, Gems: 15, Recruits: 15 }, segnalino: ['Holy', 40] },
      passi: [
        { t: 'Your token', x: 'Every deck has one <b>keyword token</b>: this ring. Yours is the <b>Holy</b> token, and it is at 40.', faro: '.ris-io .seg' },
        { t: 'Tap the ring', x: 'Tap the ring to read about it.', faro: '.ris-io .seg', attesa: { tipo: 'seg' } },
        { t: 'How it works', x: 'The panel shows how full the ring is, how it grows, and what happens at 100.', faro: '.spiega-seg', chiudiPoi: '.velo-seg' },
        tocca('Chapel', 'Fill it', 'Playing a <b>Holy</b> card fills the ring. The <b>Chapel</b> is Holy: tap it.'),
        premi('play', 'Play it', 'Press <b>Play</b>.'),
        { t: 'It grew', x: function (T) { return 'The ring went from ' + T.istantanea.seg + ' to <b>' + T.b.p.g[1].TokenValues.get(1) + '</b>.'; }, faro: '.ris-io .seg' },
        { t: 'Almost full', x: 'Let’s skip ahead: the ring is at 90, and you have another Chapel.', faro: '.ris-io .seg',
          fai: function (T, ok) {
            var b = T.b, g = b.p.g[1]; g.TokenValues.set(1, 90); b.p.corrente = 1;
            for (var i = 1; i <= 8; i++) if (+g.Hand.get(i) !== idDi('Chapel')) { g.Hand.set(i, idDi('Chapel')); break; }
            g.Bricks = 25; b.aggiorna(); attendi(400, ok);
          } },
        tocca('Chapel', 'Tap the Chapel', 'Tap it: the card warns you that the ring will reach 100.'),
        premi('play', 'Play it', 'Press <b>Play</b> and watch the ring.'),
        { t: 'It fired!', x: 'At 100 the token fires its effect, then starts again from 0. Each keyword token does something different, and in the deck editor you choose which one your deck uses.', faro: '.ris-io .seg' }
      ] },
    { id: 'mazzi', titolo: 'Decks and boosters', sotto: 'Your collection, the shop, the opponents.',
      palco: function (T) { palcoMazzi(T); },
      passi: [
        { t: 'A deck', x: 'A deck has <b>15 common</b>, <b>15 uncommon</b> and <b>15 rare</b> cards: 45 in all. You build it in <b>Decks</b> from the cards you own.', faro: '.tp-colonne',
          fai: function (T, ok) { T.anima('mazzo', ok); } },
        { t: 'Win and earn', x: 'Each win gives you <b>coins</b>, and you choose one of three <b>boosters</b> to open.', faro: '.tp-booster',
          fai: function (T, ok) { T.anima('booster', ok); } },
        { t: 'Boosters', x: 'A booster gives 3 cards of its kind. The number on the pack shows how many cards of that kind you already own, out of the total.', faro: '.tp-booster .booster' },
        { t: 'Duplicates', x: 'If you get a card you already own, it is <b>sold automatically</b> and you receive coins instead.', faro: '.tp-doppia',
          fai: function (T, ok) { T.anima('doppia', ok); } },
        { t: 'Opponents', x: '<b>Basic</b> opponents are always available. <b>Medium</b> and <b>Advanced</b> ones are unlocked in the <b>Shop</b>, and pay more coins when you beat them.', faro: '.tp-avv',
          fai: function (T, ok) { T.anima('avversari', ok); } }
      ] }
  ];

  // la lezione sui mazzi non ha campo: un palco con carte e pacchetti che si muovono
  function palcoMazzi(T) {
    var s = el('div', 'schermo tut-palco');
    s.innerHTML = '<div class="tp-colonne"><div class="tp-col" data-r="C"><b>Common</b><div></div></div><div class="tp-col" data-r="U"><b>Uncommon</b><div></div></div>' +
      '<div class="tp-col" data-r="R"><b>Rare</b><div></div></div></div><div class="tp-lato"><div class="tp-booster"></div><div class="tp-doppia"></div><div class="tp-avv"></div></div>';
    T.app.monta(s);
    T.anima = function (cosa, ok) {
      var L = Motore.catalogo.lista;
      if (cosa === 'mazzo') {
        ['C', 'U', 'R'].forEach(function (r, k) {
          var col = s.querySelector('.tp-col[data-r="' + r + '"] div'), ids = L.filter(function (d) { return d.rarita === r; }).slice(k * 7, k * 7 + 6);
          ids.forEach(function (d, j) {
            var c = UI.carta(d.id, { mini: true }); c.style.animationDelay = (k * 0.25 + j * 0.12) + 's'; c.classList.add('tp-vola');
            col.appendChild(c);
          });
          col.appendChild(el('span', 'tp-n', '× 15'));
        });
        attendi(1900, ok);
      } else if (cosa === 'booster') {
        var bx = s.querySelector('.tp-booster');
        ['kw-holy', 'col-g', 'kw-dragon'].forEach(function (t, j) { var p = UIBooster.pacchetto(t); p.style.animationDelay = (j * 0.2) + 's'; p.classList.add('tp-sale'); bx.appendChild(p); });
        attendi(1300, ok);
      } else if (cosa === 'doppia') {
        var dd = s.querySelector('.tp-doppia'), c = UI.carta(L[3].id, { mini: true });
        dd.innerHTML = ''; dd.appendChild(c);
        var m = el('div', 'tp-moneta', '+ ' + UI.moneta(4)); dd.appendChild(m);
        attendi(300, function () { c.classList.add('tp-vende'); m.classList.add('su'); });
        attendi(1500, ok);
      } else if (cosa === 'avversari') {
        var a = s.querySelector('.tp-avv'); a.innerHTML = '';
        var tutti = Avversari.tutti();
        [['Basic', 'base'], ['Medium', 'rivale'], ['Advanced', 'sfidante']].forEach(function (x, j) {
          var av = tutti.filter(function (v) { return v.tipo === x[1]; })[0];
          var t = el('div', 'tp-avv-c', '<img src="' + T.app.avatar(av ? av.nome : null) + '" alt=""><b>' + x[0] + '</b>');
          t.style.animationDelay = (j * 0.2) + 's'; a.appendChild(t);
        });
        attendi(1200, ok);
      }
    };
  }

  // ------------------------------------------------------------------ menu delle lezioni
  var Tutorial = {
    lezioni: LEZIONI,
    menu: function (app) {
      var s = el('div', 'schermo tut-menu'), fatte = app.profilo.d.tutorial || {};
      s.innerHTML = '<div class="testa"><button class="btn indietro">Back</button><h2>Tutorial</h2></div><div class="corpo"><div class="tut-lista"></div></div>';
      app.monta(s);
      s.querySelector('.indietro').addEventListener('click', function () { app.home(); });
      var l = s.querySelector('.tut-lista');
      LEZIONI.forEach(function (z, k) {
        var b = el('button', 'tut-voce pannello' + (fatte[z.id] ? ' fatta' : ''),
          '<span class="n">' + (fatte[z.id] ? '✓' : k + 1) + '</span><span class="t"><b>' + z.titolo + '</b><small>' + z.sotto + '</small></span>');
        b.addEventListener('click', function () { Tutorial.avvia(app, z.id); });
        l.appendChild(b);
      });
    },
    avvia: function (app, id) {
      var z = LEZIONI.filter(function (x) { return x.id === id; })[0];
      new Regia(app, z).avvia();
    },
    fatte: function (app) { var f = app.profilo.d.tutorial || {}; return LEZIONI.filter(function (z) { return f[z.id]; }).length; }
  };
  radice.Tutorial = Tutorial;
})(window);
