// Tutorial: lezioni brevi, ognuna su un concetto. Sono partite vere del motore pilotate da un copione:
// un riflettore animato si sposta sugli elementi, un "dito" mostra i tocchi, le mosse le esegue il motore e il
// fumetto spiega cosa e' successo. Si avanza con Next; in alcune lezioni l'ultimo passo lo fa il giocatore.
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

  // ------------------------------------------------------------------ il regista
  function Regia(app, lezione) {
    this.app = app; this.lez = lezione; this.i = -1; this.b = null; this.chiuso = false;
    var self = this;
    this.coach = el('div', 'coach');
    this.coach.innerHTML = '<div class="faro"></div><div class="dito"></div>' +
      '<div class="fumetto"><div class="f-testa"><span class="f-num"></span><button class="f-esci" aria-label="Exit tutorial">Exit</button></div>' +
      '<h3></h3><p></p><div class="f-piede"><div class="f-punti"></div><button class="btn oro f-avanti">Next</button></div></div>';
    this.faro = this.coach.querySelector('.faro');
    this.dito = this.coach.querySelector('.dito');
    this.fum = this.coach.querySelector('.fumetto');
    this.avanti = this.coach.querySelector('.f-avanti');
    this.avanti.addEventListener('click', function () { if (!self.avanti.disabled) self.passo(self.i + 1); });
    this.coach.querySelector('.f-esci').addEventListener('click', function () { self.esci(); });
    this.suRidimensiona = function () { self.posiziona(); };
    window.addEventListener('resize', this.suRidimensiona);
  }

  // il campo di gioco della lezione: mani e numeri decisi dal copione
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
      tutorial: {
        mossa: function (b, r, id) { self.dopoProva(r, id); },
        esci: function () { self.esci(); }
      } });
    this.b.bloccato = true;
    this.b.aggiorna();
    return this.b;
  };

  Regia.prototype.avvia = function () {
    if (this.lez.palco) this.lez.palco(this); else this.campo(this.lez.campo);
    document.body.appendChild(this.coach);
    this.passo(0);
  };

  Regia.prototype.passo = function (i) {
    var self = this, passi = this.lez.passi;
    if (this.chiuso) return;
    if (i >= passi.length) return this.fine();
    this.i = i;
    var s = passi[i];
    this.coach.classList.toggle('prova', !!s.prova);
    this.fum.querySelector('h3').textContent = s.t || '';
    this.fum.querySelector('p').innerHTML = s.x || '';
    this.fum.querySelector('.f-num').textContent = this.lez.titolo + ' · ' + (i + 1) + '/' + passi.length;
    this.fum.querySelector('.f-punti').innerHTML = passi.map(function (x, k) { return '<i class="' + (k < i ? 'fatto' : k === i ? 'qui' : '') + '"></i>'; }).join('');
    this.avanti.textContent = s.prova ? 'Skip' : i === passi.length - 1 ? 'Finish' : 'Next';
    this.fum.classList.remove('entra'); void this.fum.offsetWidth; this.fum.classList.add('entra');
    this.bersaglio = s.faro || null;
    this.dito.classList.remove('tocca');
    if (this.b) {
      this.b.bloccato = !s.prova;
      // nel passo "prova" tocca a te, qualunque cosa abbia fatto la dimostrazione prima
      if (s.prova && this.b.p.stato === 'in corso') { this.b.p.corrente = 1; this.b.aggiorna(); }
    }
    this.posiziona();
    if (s.fai) {
      // la parte "video": parte da sola dopo un attimo, e Next aspetta che finisca
      this.avanti.disabled = true;
      attendi(650, function () {
        if (self.chiuso || self.i !== i) return;
        s.fai(self, function () { if (self.i === i) { self.avanti.disabled = false; self.posiziona(); if (s.dopo) self.fum.querySelector('p').innerHTML += ' ' + s.dopo; self.posiziona(); } });
      });
    } else this.avanti.disabled = false;
  };

  function rettangolo(b) {
    if (!b) return null;
    var e = typeof b === 'function' ? b() : document.querySelector(b);
    if (!e) return null;
    if (e.getBoundingClientRect) { var r = e.getBoundingClientRect(); return r.width ? r : null; }
    return e;
  }

  // riflettore sul bersaglio, fumetto dove non lo copre
  Regia.prototype.posiziona = function () {
    var r = rettangolo(this.bersaglio), W = innerWidth, H = innerHeight, m = 6;
    if (r) {
      this.faro.style.cssText = 'opacity:1;left:' + (r.left - m) + 'px;top:' + (r.top - m) + 'px;width:' + (r.width + 2 * m) + 'px;height:' + (r.height + 2 * m) + 'px';
    } else this.faro.style.cssText = 'opacity:1;left:' + (W / 2) + 'px;top:' + (H / 2) + 'px;width:0;height:0';
    var f = this.fum, fw = f.offsetWidth, fh = f.offsetHeight, pos = [];
    pos.push([(W - fw) / 2, (H - fh) / 2]);              // al centro
    pos.push([(W - fw) / 2, 8]);                         // in alto
    pos.push([(W - fw) / 2, H - fh - 8]);                // in basso
    pos.push([8, (H - fh) / 2]); pos.push([W - fw - 8, (H - fh) / 2]);
    var scelta = pos[0];
    if (r) {
      for (var k = 0; k < pos.length; k++) {
        var x = pos[k][0], y = pos[k][1];
        var tocca = !(x + fw < r.left - m || x > r.right + m || y + fh < r.top - m || y > r.bottom + m);
        if (!tocca) { scelta = pos[k]; break; }
      }
    }
    f.style.left = Math.round(scelta[0]) + 'px'; f.style.top = Math.round(scelta[1]) + 'px';
  };

  // il dito: va sul bersaglio e "tocca", poi fn
  Regia.prototype.tocca = function (bers, fn) {
    var r = rettangolo(bers), d = this.dito, self = this;
    if (!r) return fn();
    d.style.left = (r.left + r.width / 2) + 'px'; d.style.top = (r.top + r.height / 2) + 'px';
    d.classList.remove('tocca'); void d.offsetWidth; d.classList.add('tocca');
    attendi(700, function () { if (!self.chiuso) fn(); });
  };

  function posizione(b, chi, nome) {
    var g = b.p.g[chi], id = idDi(nome);
    for (var i = 1; i <= 8; i++) if (+g.Hand.get(i) === id) return i;
    return 0;
  }
  // una mossa del copione: il dito tocca la carta (se e' mia), poi la carta entra e il motore la esegue
  Regia.prototype.gioca = function (chi, nome, fn, azione, modo) {
    var self = this, b = this.b, pos = posizione(b, chi, nome), id = b.p.g[chi].Hand.get(pos);
    azione = azione || 'play';
    var esegui = function () {
      UI.chiudiLente();
      b.mostraEntrata(id, chi === 1 ? (azione === 'play' ? 'You play' : 'You discard') : 'Opponent plays', 1000, function () {
        if (self.chiuso) return;
        b.p.corrente = chi;
        var r = b.p.usaCarta(chi, azione, pos, modo || 0);
        b.aggiorna();
        b.scatti(r.segnalini, id, chi, function () { attendi(350, fn); });
      });
    };
    if (chi === 1) this.tocca('.mano .carta[data-pos="' + pos + '"]', esegui); else esegui();
  };
  // aggiunge una frase al fumetto (i numeri veri di cio' che e' appena successo)
  Regia.prototype.dici = function (html) { this.fum.querySelector('p').innerHTML += ' <b>' + html + '</b>'; this.posiziona(); };
  // gioca e poi racconta muro e torre del bersaglio, prima e dopo
  Regia.prototype.giocaEConta = function (chi, nome, ok) {
    var self = this, o = chi === 1 ? 2 : 1, g = this.b.p.g[o], m0 = g.Wall, t0 = g.Tower;
    this.gioca(chi, nome, function () {
      var dm = m0 - g.Wall, dt = t0 - g.Tower, chiS = o === 2 ? 'Enemy' : 'Your';
      self.dici(chiS + ' wall ' + (dm ? '−' + dm : 'untouched') + ', tower ' + (dt ? '−' + dt : 'untouched') + '.');
      ok();
    });
  };
  // apre la carta grande come farebbe un tocco
  Regia.prototype.apri = function (nome, fn) {
    var self = this, pos = posizione(this.b, 1, nome);
    this.tocca('.mano .carta[data-pos="' + pos + '"]', function () { self.b.apri(pos); attendi(450, fn); });
  };
  // da' la mano al giocatore per un passo "prova"
  Regia.prototype.dopoProva = function (r, id) {
    var self = this, b = this.b;
    b.aggiorna();
    b.scatti(r.segnalini, id, 1, function () {
      var s = self.lez.passi[self.i];
      if (s && s.prova) self.passo(self.i + 1);
    });
  };

  Regia.prototype.fine = function () {
    var self = this, pr = this.app.profilo;
    pr.d.tutorial = pr.d.tutorial || {};
    pr.d.tutorial[this.lez.id] = true; pr.salva();
    var k = LEZIONI.indexOf(this.lez), dopo = LEZIONI[k + 1];
    this.coach.classList.remove('prova');
    this.bersaglio = null;
    this.fum.querySelector('h3').textContent = 'Lesson complete';
    this.fum.querySelector('p').innerHTML = '“' + this.lez.titolo + '” done.' + (dopo ? ' Next up: <b>' + dopo.titolo + '</b>.' : ' You know the basics: go and play!');
    this.fum.querySelector('.f-punti').innerHTML = '';
    var piede = this.fum.querySelector('.f-piede');
    piede.innerHTML = '';
    var lista = el('button', 'btn', 'Lessons'), avanti = el('button', 'btn oro', dopo ? 'Next lesson' : 'Play');
    lista.addEventListener('click', function () { self.chiudi(); Tutorial.menu(self.app); });
    avanti.addEventListener('click', function () { self.chiudi(); if (dopo) Tutorial.avvia(self.app, dopo.id); else self.app.preparazione(); });
    piede.appendChild(lista); piede.appendChild(avanti);
    this.posiziona();
  };
  Regia.prototype.chiudi = function () {
    this.chiuso = true;
    window.removeEventListener('resize', this.suRidimensiona);
    this.coach.remove();
    document.querySelectorAll('.entrata, .scatto-seg, .velo-seg, .tut-palco-x').forEach(function (x) { x.remove(); });
    UI.chiudiLente();
    if (this.b) this.b.chiuso = true;
  };
  Regia.prototype.esci = function () { this.chiudi(); Tutorial.menu(this.app); };

  // ------------------------------------------------------------------ le lezioni
  var MANO_BASE = ['Scout tower', 'Fortified wall', 'Knight', 'Archer', 'Sculptor', 'Chapel', 'Poison frog', 'Catapult'];
  var LEZIONI = [
    { id: 'scopo', titolo: 'The goal', sotto: 'Three ways to win a game.',
      campo: { mano: MANO_BASE, manoLui: MANO_BASE, io: { Bricks: 15, Gems: 15, Recruits: 15 }, lui: { Tower: 3, Wall: 0 } },
      passi: [
        { t: 'Two castles', x: 'Each side has a <b>tower</b> and a <b>wall</b> in front of it. You are on the left, the opponent on the right.', faro: '.rocca.io' },
        { t: 'Build up', x: 'If your tower reaches <b>100</b>, you win.', faro: '.rocca.io .torre .targa' },
        { t: 'Or knock down', x: 'If the enemy tower falls to <b>0</b>, you win too. This one is almost gone: 3 left, and no wall.', faro: '.rocca.lui' },
        { t: 'Watch', x: 'The <b>Archer</b> hits the enemy tower for 3.', faro: '.rocca.lui',
          fai: function (T, ok) { T.gioca(1, 'Archer', ok); }, dopo: '<b>The tower is down: that is a win.</b>' },
        { t: 'Or get rich', x: 'The third way: gather <b>400 resources</b> in total (bricks + gems + recruits). It happens rarely, but it happens.', faro: '.ris-io' }
      ] },
    { id: 'risorse', titolo: 'Resources', sotto: 'Bricks, gems, recruits and the buildings that make them.',
      campo: { mano: MANO_BASE, manoLui: MANO_BASE, io: { Bricks: 12, Gems: 10, Recruits: 9 } },
      passi: [
        { t: 'Three resources', x: '<b>Bricks</b> (red), <b>gems</b> (blue) and <b>recruits</b> (green). Cards cost these.', faro: '.ris-io' },
        { t: 'Production', x: 'Under each number is its building: <b>Mine</b>, <b>Altar</b>, <b>Lair</b>. Level 3 means +3 of that resource every turn.', faro: '.ris-io .ris.b' },
        { t: 'Card costs', x: 'The coloured gems on a card are its cost: red = bricks, blue = gems, green = recruits.', faro: '.mano .carta[data-pos="5"] .costi' },
        { t: 'Grow your economy', x: '<b>Sculptor</b> raises your Mine by one, for the rest of the game.', faro: '.ris-io .ris.b',
          fai: function (T, ok) { T.gioca(1, 'Sculptor', ok); }, dopo: 'Mine 4: from now on +4 bricks per turn.' },
        { t: 'End of turn', x: 'After your card you collect production: the small green numbers show what came in this turn.', faro: '.ris-io' }
      ] },
    { id: 'carte', titolo: 'Playing cards', sotto: 'Your hand, playing, discarding.',
      campo: { mano: ['Scout tower', 'Fortified wall', 'Catapult', 'Archer', 'Sculptor', 'Chapel', 'Poison frog', 'Knight'], manoLui: MANO_BASE,
        io: { Bricks: 9, Gems: 4, Recruits: 6 } },
      passi: [
        { t: 'Your hand', x: 'Eight cards. Every turn you <b>play one</b> or <b>discard one</b>, then you draw a new one.', faro: '.mano' },
        { t: 'Can’t afford it', x: 'A <b>dashed border</b> means you don’t have the resources yet. The gem you’re missing has a red ring.', faro: '.mano .carta[data-pos="3"]' },
        { t: 'Look before you play', x: 'Tapping a card shows it big. Behind it, the numbers next to the castles preview what it will do.',
          faro: '.lente', fai: function (T, ok) { T.apri('Fortified wall', ok); } },
        { t: 'Play it', x: 'Play: the wall grows by 8.', faro: '.rocca.io .muro',
          fai: function (T, ok) { T.gioca(1, 'Fortified wall', ok); }, dopo: 'A new card has been drawn in its place.' },
        { t: 'Your turn', x: 'Try it: tap a card you can afford and press <b>Play</b> (or <b>Discard</b>).', faro: '.mano', prova: true }
      ] },
    { id: 'attacco', titolo: 'Attacks', sotto: 'Damage hits the wall first, then the tower.',
      campo: { mano: MANO_BASE, manoLui: ['Orc grunt', 'Knight', 'Archer', 'Gate', 'Scout tower', 'Catapult', 'Chapel', 'Sculptor'],
        io: { Bricks: 15, Gems: 15, Recruits: 20 }, lui: { Wall: 5, Recruits: 20 } },
      passi: [
        { t: 'The wall protects', x: 'An attack hits the <b>wall</b> first. Only what is left over reaches the tower.', faro: '.rocca.lui' },
        { t: 'Watch', x: 'The <b>Knight</b> attacks. The enemy wall is only 5.', faro: '.rocca.lui',
          fai: function (T, ok) { T.giocaEConta(1, 'Knight', ok); } },
        { t: 'Straight to the tower', x: 'Cards that say <b>Enemy tower</b> ignore the wall. The <b>Archer</b> hits the tower directly.', faro: '.rocca.lui .torre',
          fai: function (T, ok) { T.giocaEConta(1, 'Archer', ok); } },
        { t: 'They attack too', x: 'Now the opponent plays an <b>Orc grunt</b>.', faro: '.rocca.io',
          fai: function (T, ok) { T.giocaEConta(2, 'Orc grunt', function () { T.dici('Keep your wall high!'); ok(); }); } }
      ] },
    { id: 'keyword', titolo: 'Keywords', sotto: 'Icons on cards and the “play again” cards.',
      campo: { mano: MANO_BASE, manoLui: MANO_BASE, io: { Bricks: 15, Gems: 15, Recruits: 15 } },
      passi: [
        { t: 'Keywords', x: 'The small icons at the bottom right of the art are <b>keywords</b>: families of cards with an extra rule.', faro: '.mano .carta[data-pos="7"] .kw' },
        { t: 'Read them', x: 'Tap the card: every keyword is explained next to it.', faro: '.lente .kwlista',
          fai: function (T, ok) { T.apri('Poison frog', ok); } },
        { t: 'Play again', x: '<b>Quick</b> and <b>Swift</b> cards let you play another card in the same turn.', faro: '.ris-lui',
          fai: function (T, ok) { T.gioca(1, 'Poison frog', ok); }, dopo: '“Play again!”: it is still your turn.' },
        { t: 'Families', x: 'Many keywords reward you for playing cards of the same family: building a deck around one is a good plan.', faro: '.mano' }
      ] },
    { id: 'token', titolo: 'Keyword token', sotto: 'The ring that fills up to 100.',
      campo: { mano: ['Chapel', 'Scout tower', 'Fortified wall', 'Knight', 'Archer', 'Sculptor', 'Poison frog', 'Catapult'], manoLui: MANO_BASE,
        io: { Bricks: 20, Gems: 15, Recruits: 15 }, segnalino: ['Holy', 40] },
      passi: [
        { t: 'Your token', x: 'Every deck has one <b>keyword token</b>: this ring. Yours is <b>Holy</b>, now at 40.', faro: '.ris-io .seg' },
        { t: 'It fills up', x: 'Playing a <b>Holy</b> card fills it (more if you hold other Holy cards). <b>Chapel</b> is Holy.', faro: '.ris-io .seg',
          fai: function (T, ok) { T.gioca(1, 'Chapel', ok); } },
        { t: 'At 100 it fires', x: 'Let’s jump ahead: the ring is almost full.', faro: '.ris-io .seg',
          fai: function (T, ok) {
            var b = T.b, g = b.p.g[1]; g.TokenValues.set(1, 90); b.p.corrente = 1;
            var pos = 0; for (var i = 1; i <= 8; i++) if (+g.Hand.get(i) !== idDi('Chapel')) { pos = i; break; }
            g.Hand.set(pos, idDi('Chapel')); g.Bricks = 20; b.aggiorna();
            attendi(600, function () { T.gioca(1, 'Chapel', ok); });
          }, dopo: 'Each token has its own effect, and starts again from 0.' },
        { t: 'Read it any time', x: 'Tap the ring during a game to see how full it is and what it does. In the deck editor you choose which token your deck uses.', faro: '.ris-io .seg' }
      ] },
    { id: 'mazzi', titolo: 'Decks and boosters', sotto: 'Your collection, the shop, the opponents.',
      palco: function (T) { palcoMazzi(T); },
      passi: [
        { t: 'A deck', x: 'A deck is <b>15 common</b>, <b>15 uncommon</b> and <b>15 rare</b> cards: 45 in all.', faro: '.tp-colonne',
          fai: function (T, ok) { T.anima('mazzo', ok); } },
        { t: 'Win, earn', x: 'Winning gives you <b>coins</b> and lets you open one of three <b>boosters</b>.', faro: '.tp-booster',
          fai: function (T, ok) { T.anima('booster', ok); } },
        { t: 'Each booster', x: 'A booster gives 3 cards of its kind. The number on it says how many of that kind you already own.', faro: '.tp-booster .booster' },
        { t: 'Duplicates', x: 'A card you already have is <b>sold automatically</b>: you get coins instead.', faro: '.tp-doppia',
          fai: function (T, ok) { T.anima('doppia', ok); } },
        { t: 'Opponents', x: '<b>Basic</b> opponents are always open. <b>Medium</b> and <b>Advanced</b> ones are unlocked in the shop, and pay more.', faro: '.tp-avv',
          fai: function (T, ok) { T.anima('avversari', ok); } }
      ] }
  ];

  // la lezione sui mazzi non ha campo: un palco con carte e pacchetti che si muovono
  function palcoMazzi(T) {
    var s = el('div', 'schermo tut-palco');
    s.innerHTML = '<div class="tp-colonne"><div class="tp-col" data-r="C"><b>Common</b><div></div></div><div class="tp-col" data-r="U"><b>Uncommon</b><div></div></div>' +
      '<div class="tp-col" data-r="R"><b>Rare</b><div></div></div></div><div class="tp-lato"><div class="tp-booster"></div><div class="tp-doppia"></div><div class="tp-avv"></div></div>';
    T.app.monta(s);
    T.palco = s;
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
        var m = el('div', 'tp-moneta', UI.moneta(4)); dd.appendChild(m);
        attendi(300, function () { c.classList.add('tp-vende'); m.classList.add('su'); });
        attendi(1500, ok);
      } else if (cosa === 'avversari') {
        var a = s.querySelector('.tp-avv'); a.innerHTML = '';
        [['Basic', 'giullare'], ['Medium', 'gruk'], ['Advanced', null]].forEach(function (x, j) {
          var av = x[1] ? Avversari.tutti().filter(function (v) { return v.avatar === x[1]; })[0] : Avversari.tutti().filter(function (v) { return v.tipo === 'sfidante'; })[0];
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
