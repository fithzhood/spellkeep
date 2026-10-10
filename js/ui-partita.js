// La partita: campo, mano, lente, anteprima, turno della CPU, fine partita.
(function (radice) {
  'use strict';
  var el = UI.el, segno = UI.segno;
  var ICO = { b: 'brick-pile', g: 'crystal-growth', r: 'crested-helmet' };
  var FAB = { b: 'Mine', g: 'Altar', r: 'Lair' };
  var RIS = { b: 'Bricks', g: 'Gems', r: 'Recruits' }, EDI = { b: 'Quarry', g: 'Magic', r: 'Dungeons' };
  var K = 0.3;
  var ESITI = {
    Destruction: ['The enemy tower has fallen.', 'Your tower has fallen.'],
    Construction: ['Your tower reached the sky.', 'The enemy tower reached the sky.'],
    Resource: ['You gathered a fortune in resources.', 'The enemy gathered a fortune in resources.'],
    Timeout: ['Time ran out: you held the stronger castle.', 'Time ran out: the enemy held the stronger castle.'],
    Draw: ['Neither side prevailed.', 'Neither side prevailed.']
  };

  function Battaglia(app, opz) {
    this.app = app; this.opz = opz; this.p = opz.partita;
    this.sel = 0; this.modo = 0; this.selLui = 0;
    this.bloccato = false; this.manoVista = null;
    this.costruisci();
    this.av = Avversari.trova(opz.sfida);
    if (window.Musica) Musica.scena(this.av.tipo === 'sfidante' ? 'sfida' : 'partita');
    this.aggiorna();
    var self = this;
    var parti = function () { if (self.p.stato !== 'in corso') self.finale(); else if (self.p.corrente === 2) self.turnoCpu(); };
    // tutorial: il copione decide tutto (niente CPU, niente fine partita)
    if (opz.tutorial) return;
    // partita nuova: prima i due ritratti, poi si gioca
    if (opz.nuova && this.p.stato === 'in corso') this.presentazione(parti); else parti();
  }

  // l'ultima sequenza di mosse dello stesso giocatore (piu' carte se ha rigiocato), con lo stato di prima:
  // a fine partita si mostra cosa e' successo, altrimenti chi perde non vede perche' (il riquadro copre il campo)
  var CAMPI = [['Tower', 'tower'], ['Wall', 'wall'], ['Quarry', 'Mine'], ['Magic', 'Altar'], ['Dungeons', 'Lair'],
    ['Bricks', 'Bricks', 1], ['Gems', 'Gems', 1], ['Recruits', 'Recruits', 1]];
  function fotoStato(p) {
    var f = {};
    [1, 2].forEach(function (n) { f[n] = {}; CAMPI.forEach(function (c) { f[n][c[0]] = PHP.num(p.g[n][c[0]]); }); });
    return f;
  }
  Battaglia.prototype.registraMossa = function (chi, id, azione, prima) {
    if (!this.giro || this.giro.chi !== chi) this.giro = { chi: chi, mosse: [], prima: prima };
    this.giro.mosse.push({ id: id, azione: azione });
  };
  Battaglia.prototype.ultimaMossa = function () {
    var g = this.giro, p = this.p;
    if (!g || p.esito === 'Surrender') return null;
    var chi = g.chi === 1 ? 'You' : this.av.titolo, dopo = fotoStato(p), risorse = p.esito === 'Resource';
    var carte = g.mosse.map(function (m) {
      return (m.azione === 'discard' ? 'discarded ' : '') + '<a class="um-carta" data-id="' + m.id + '">' + UI.dati(m.id).nome + '</a>';
    });
    var testo = '<b>' + chi + '</b> ' + (g.mosse[0].azione === 'discard' ? '' : 'played ') + carte.join(', then ');
    var chip = [];
    [1, 2].forEach(function (n) {
      CAMPI.forEach(function (c) {
        if (c[2] && !risorse) return;
        var a = g.prima[n][c[0]], b = dopo[n][c[0]];
        if (a === b) return;
        chip.push('<span class="um-chip ' + (n === 1 ? 'mio' : 'suo') + (b < a ? ' giu' : ' su') + '">' + (n === 1 ? 'Your ' : 'Enemy ') + c[1] + ' ' + a + ' → ' + b + '</span>');
      });
    });
    return '<div class="ultima-mossa"><div class="um-testo"><span class="um-t">Last move</span> ' + testo + '</div>' +
      (chip.length ? '<div class="um-chips">' + chip.join('') + '</div>' : '') + '</div>';
  };

  function tipoAvv(av) { return av.tipo === 'rivale' ? 'Medium · ' + av.tribu : av.tipo === 'sfidante' ? 'Advanced' : av.mazzoCasuale ? 'Basic · random deck' : 'Basic · starter deck'; }
  function volto(app, chi, nome, sotto, cls) {
    return '<div class="volto ' + (cls || '') + '"><img src="' + app.avatar(chi) + '" alt=""><b>' + nome + '</b>' + (sotto ? '<small>' + sotto + '</small>' : '') + '</div>';
  }

  // inizio partita: tu contro lui, con chi comincia. Sparisce da sola o con un tocco.
  Battaglia.prototype.presentazione = function (poi) {
    var self = this, pr = this.app.profilo;
    var f = el('div', 'presenta');
    f.innerHTML = volto(this.app, 'giocatore', 'You', pr.mazzo().nome, 'io') + '<div class="pr-vs">VS</div>' +
      volto(this.app, this.av.nome, this.av.titolo, tipoAvv(this.av), 'lui') +
      '<div class="pr-sotto">' + (this.p.corrente === 1 ? 'You go first' : this.av.titolo + ' goes first') + ' · tap to start</div>';
    document.body.appendChild(f);
    var chiusa = false, chiudi = function () {
      if (chiusa) return; chiusa = true;
      f.classList.add('via'); setTimeout(function () { f.remove(); if (!self.chiuso) poi(); }, 280);
    };
    f.addEventListener('click', chiudi);
    setTimeout(chiudi, 2600);
  };

  Battaglia.prototype.costruisci = function () {
    var s = el('div', 'schermo gioco');
    s.innerHTML =
      '<div class="risorse ris-io"></div>' +
      '<div class="campo"><div class="alto"></div>' +
        '<div class="rocca io"></div><div class="centro"></div><div class="rocca lui"></div><div class="giro"></div></div>' +
      '<div class="risorse ris-lui"></div>' +
      '<div class="mano"></div>' +
      '<button class="btn-menu" aria-label="Menu">' + UI.icona('hamburger-menu') + '</button>' +
      '<button class="btn-vista" aria-label="Card text"></button>' +
      '';
    this.app.monta(s);
    this.s = s;
    this.q = function (sel) { return s.querySelector(sel); };
    var self = this;
    ['io', 'lui'].forEach(function (chi) {
      self.q('.rocca.' + chi).innerHTML =
        '<div class="pezzo torre"><div class="targa"></div><div class="t-cima"></div><div class="t-corpo"></div><div class="t-base"></div></div>' +
        '<div class="pezzo muro"><div class="targa"></div><div class="m-cima"></div><div class="m-corpo"></div></div>';
    });
    this.q('.btn-menu').addEventListener('click', function () { self.pausa(); });
    this.q('.btn-vista').addEventListener('click', function () {
      var imp = self.app.profilo.d.imp; imp.testo = !imp.testo; self.app.profilo.salva(); self.disegnaMano();
    });
    this.impostaMano();
    ['io', 'lui'].forEach(function (chi) {
      self.q('.ris-' + chi).addEventListener('click', function (ev) {
        var b = ev.target.closest('.seg'); if (b) Segnalini.spiega(b.dataset.kw, +b.dataset.v);
      });
    });
  };

  // ------------------------------------------------------------------ disegno
  Battaglia.prototype.anteprima = function () {
    if (!this.sel || this.p.corrente !== 1 || this.p.stato !== 'in corso') return null;
    var id = this.p.g[1].Hand.get(this.sel), d = UI.dati(id);
    if (!this.p.giocabile(1, this.sel) || (d.modi > 0 && !this.modo)) return null;
    var r = this.p.anteprima(1, this.sel, this.modo || 0);
    if (r.errore) return null;
    var a = { io: {}, lui: {} }, g1 = this.p.g[1], g2 = this.p.g[2];
    Motore.ATTR.forEach(function (x) { a.io[x] = r.anteprima.io.attr[x] - g1[x]; a.lui[x] = r.anteprima.lui.attr[x] - g2[x]; });
    a.io.scatta = r.anteprima.scatta;
    return a;
  };

  Battaglia.prototype.aggiorna = function () {
    var p = this.p, ant = this.anteprima(), self = this;
    // con una carta scelta, la fila delle carte avversarie si attenua: i numeri dell'anteprima restano leggibili
    this.s.classList.toggle('in-anteprima', !!ant);
    ['io', 'lui'].forEach(function (chi) {
      var n = chi === 'io' ? 1 : 2, g = p.g[n], a = ant && ant[chi];
      var box = self.q('.ris-' + chi);
      box.innerHTML = ['b', 'g', 'r'].map(function (k) {
        var v = a && a[RIS[k]], ve = a && a[EDI[k]];
        return '<div class="ris ' + k + '">' + UI.icona(ICO[k]) + '<span class="n' + (g[RIS[k]] >= 100 ? ' tre' : '') + '">' + g[RIS[k]] + '</span>' +
          '<span class="var">' + (v ? segno(v, 'ant') : segno(g.Changes[RIS[k]], 'delta')) + '</span>' +
          '<span class="prod">' + FAB[k] + ' <b>' + g[EDI[k]] + '</b>' + (ve ? ' ' + segno(ve, 'ant') : (g.Changes[EDI[k]] ? ' ' + segno(g.Changes[EDI[k]], 'delta') : '')) + '</span></div>';
      }).join('') + '<div class="ris-fondo">' + self.segnalini(g, a && a.scatta) + self.totale(g, a) + '</div>';
      self.rocca(chi, g, a);
    });
    this.disegnaAlto(); this.disegnaCentro(); this.disegnaMano();
    var giro = this.q('.giro');
    if (p.stato !== 'in corso') giro.innerHTML = '<span>Game over</span>';
    else if (p.corrente === 1) giro.innerHTML = '<span class="tuo">Your turn</span><span>Round ' + p.round + '</span>';
    else giro.innerHTML = '<span class="suo">Opponent\'s turn</span><span>Round ' + p.round + '</span>';
  };

  // totale delle risorse e obiettivo della vittoria a risorse (400, o 600 in partita lunga), con una barretta;
  // dorato quando si avvicina, e con la carta scelta mostra il totale che ne verrebbe
  Battaglia.prototype.totale = function (g, a) {
    var rv = this.p.cfg.res_victory, tot = g.Bricks + g.Gems + g.Recruits;
    var dopo = a ? tot + (a.Bricks || 0) + (a.Gems || 0) + (a.Recruits || 0) : null, mostra = dopo !== null && dopo !== tot ? dopo : tot;
    var pc = Math.max(0, Math.min(100, mostra / rv * 100));
    return '<div class="ris-tot' + (mostra >= rv * 0.75 ? ' vicino' : '') + (dopo !== null && dopo !== tot ? (dopo > tot ? ' sale' : ' scende') : '') + '" title="Resource victory at ' + rv + '">' +
      '<span class="tt"><b>' + mostra + '</b><small>/' + rv + '</small></span><i style="width:' + pc.toFixed(1) + '%"></i></div>';
  };

  // scatta = segnalini che la carta selezionata farebbe arrivare a 100 (l'anello pulsa)
  Battaglia.prototype.segnalini = function (g, scatta) {
    var h = '';
    g.TokenNames.entries().forEach(function (e) {
      if (e[1] === 'none') return;
      var v = Math.round(PHP.num(g.TokenValues.get(e[0])));
      h += '<button class="seg' + (v >= 100 ? ' pieno' : '') + (scatta && scatta.indexOf(e[1]) >= 0 ? ' scatta' : '') + '" style="--v:' + v + '" data-kw="' + e[1] + '" data-v="' + v + '" aria-label="' + e[1] + ' token">' +
        '<img src="' + UI.kwIcona(e[1]) + '" alt=""><small>' + v + '</small></button>';
    });
    return '<div class="segnalini">' + h + '</div>';
  };

  Battaglia.prototype.rocca = function (chi, g, a) {
    var r = this.q('.rocca.' + chi), campo = this.q('.campo'), h = campo.clientHeight, cfg = this.p.cfg;
    var targaT = r.querySelector('.torre .targa'), targaM = r.querySelector('.muro .targa');
    targaT.innerHTML = '<b>' + g.Tower + '</b><small>tower</small>' + (a && a.Tower ? segno(a.Tower, 'ant') : segno(g.Changes.Tower, 'delta'));
    targaM.innerHTML = '<b>' + g.Wall + '</b><small>wall</small>' + (a && a.Wall ? segno(a.Wall, 'ant') : segno(g.Changes.Wall, 'delta'));
    var alt = targaT.offsetHeight + 6, aria = 4;
    var maxT = h - 310 * K - 45 * K - alt - aria;
    var maxM = maxT + 45 * K + 125 * K - 51 * K;
    r.querySelector('.t-corpo').style.height = Math.max(2, maxT * Math.min(g.Tower, cfg.max_tower) / cfg.max_tower).toFixed(1) + 'px';
    r.querySelector('.m-corpo').style.height = (g.Wall > 0 ? Math.max(2, maxM * Math.min(g.Wall, cfg.max_wall) / cfg.max_wall) : 0).toFixed(1) + 'px';
    r.querySelector('.muro').classList.toggle('vuoto', g.Wall <= 0);
    // bollini dell'anteprima: sopra il cartellino (al centro si apre la carta, che copriva quelli di lato); se sopra
    // c'e' la fila delle carte avversarie o il bordo, sotto il cartellino, sul corpo della torre o del muro
    var alto = this.q('.alto'), limite = Math.max(alto && alto.children.length ? alto.getBoundingClientRect().bottom : 0, campo.getBoundingClientRect().top) + 4;
    [targaT, targaM].forEach(function (t) {
      var b = t.querySelector('.ant'); if (!b) return;
      b.classList.toggle('sotto', t.getBoundingClientRect().top - b.offsetHeight - 4 < limite);
    });
  };

  Battaglia.prototype.disegnaAlto = function () {
    var alto = this.q('.alto'), g = this.p.g[2], self = this;
    var ris = { b: g.Bricks, g: g.Gems, r: g.Recruits };
    alto.innerHTML = '';
    for (var i = 1; i <= 8; i++) {
      var id = g.Hand.get(i);
      var visibile = !this.p.nascoste || (g.Revealed && g.Revealed.has(i));
      if (visibile) {
        // come nella tua mano: New sulle carte pescate dopo la sua ultima mossa, tratteggio su quelle che non puo' pagare
        var c = UI.carta(id, { mini: true, risorse: ris, spenta: !this.p.giocabile(2, i), nuova: !!(g.NewCards && g.NewCards.has(i)) });
        if (i === this.selLui) c.classList.add('scelta');
        (function (pos, cid) {
          c.addEventListener('click', function () {
            if (self.bloccato) return;
            self.selLui = pos;
            UI.apriLente(cid, { nota: 'In the opponent\'s hand', partita: self.p, chi: 2, chiusa: function () { self.selLui = 0; self.disegnaAlto(); } });
            self.disegnaAlto();
          });
        })(i, id);
        alto.appendChild(c);
      } else alto.appendChild(el('div', 'dorso'));
    }
  };

  // al centro restano le carte dell'ultimo turno di ciascuno (tue a sinistra, sue a destra): alcune carte hanno
  // effetti in piu' se giocate dopo un certo tipo di carta, e cosi' si vede sempre cosa e' stato giocato per ultimo
  Battaglia.prototype.disegnaCentro = function () {
    var centro = this.q('.centro'), self = this;
    centro.innerHTML = '';
    var fila = el('div', 'ultime-due');
    [[1, 'You', 'by you'], [2, 'Opponent', 'by the opponent']].forEach(function (x) {
      var g = self.p.g[x[0]], ult = el('div', 'ultime');
      if (g.LastCard) g.LastCard.entries().forEach(function (e) {
        var id = PHP.num(e[1]); if (!id) return;
        var az = g.LastAction.get(e[0]);
        var w = el('div', 'ultima', '<span class="etic' + (az === 'discard' ? ' scartata' : '') + '">' + (az === 'discard' ? 'discarded' : 'played') + '</span>');
        var c = UI.carta(id);
        c.addEventListener('click', function () { UI.apriLente(id, { nota: (az === 'discard' ? 'Discarded ' : 'Played ') + x[2], notaNeutra: true }); });
        w.appendChild(c); ult.appendChild(w);
      });
      if (!ult.children.length) return;
      var grp = el('div', 'ultime-gruppo ' + (x[0] === 1 ? 'mie' : 'sue'), '<div class="ult-chi">' + x[1] + '</div>');
      grp.appendChild(ult); fila.appendChild(grp);
    });
    if (fila.children.length) centro.appendChild(fila);
  };

  Battaglia.prototype.disegnaMano = function () {
    var mano = this.q('.mano'), g = this.p.g[1], self = this;
    var prima = this.manoVista || [];
    var ris = { b: g.Bricks, g: g.Gems, r: g.Recruits };
    mano.innerHTML = '';
    var ora = [];
    for (var i = 1; i <= 8; i++) {
      var id = PHP.num(g.Hand.get(i)); ora.push(id);
      // nuova = pescata dopo la tua ultima mossa (il motore lo tiene in NewCards, come l'originale): resta segnata per tutto il turno
      var nuova = !!(g.NewCards && g.NewCards.has(i));
      var c = UI.carta(id, { risorse: ris, spenta: !this.p.giocabile(1, i), nuova: nuova, partita: this.p, chi: 1 });
      c.dataset.pos = i;
      if (i === this.sel) c.classList.add('scelta');
      mano.appendChild(c);
    }
    this.manoVista = ora;
    mano.classList.toggle('attesa', this.p.corrente !== 1 || this.bloccato);
    var testo = !!this.app.profilo.d.imp.testo;
    mano.classList.toggle('testuale', testo);
    this.q('.btn-vista').innerHTML = testo ? 'Art' : 'Text';
    if (testo) this.righeVisibili();
  };

  // quante righe intere di testo stanno nella parte visibile della carta: si misura, perche' la scala
  // dei caratteri del telefono cambia l'altezza delle righe; il resto si taglia con "…"
  Battaglia.prototype.righeVisibili = function () {
    var mano = this.q('.mano'), c = mano.querySelector('.carta:not(.scelta)');
    if (!c) return;
    var eff = c.querySelector('.eff'), cs = getComputedStyle(eff);
    var lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    var fondo = Math.min(window.innerHeight, c.getBoundingClientRect().bottom) - 3;
    var righe = Math.max(1, Math.floor((fondo - eff.getBoundingClientRect().top) / lh));
    mano.style.setProperty('--righe', righe);
  };

  // ------------------------------------------------------------------ mano: un tocco apre la carta
  // (niente trascinamento: si confondeva troppo con il tocco)
  Battaglia.prototype.impostaMano = function () {
    var self = this;
    this.q('.mano').addEventListener('click', function (ev) {
      var c = ev.target.closest('.carta');
      if (!c || self.bloccato || self.p.corrente !== 1) return;
      self.apri(+c.dataset.pos);
    });
  };

  // tocco: la carta grande con le azioni
  Battaglia.prototype.apri = function (pos) {
    var self = this, id = this.p.g[1].Hand.get(pos), d = UI.dati(id), g = this.p.g[1];
    this.sel = pos; this.modo = 0;
    this.aggiorna();
    var giocabile = this.p.giocabile(1, pos);
    UI.apriLente(id, {
      risorse: { b: g.Bricks, g: g.Gems, r: g.Recruits }, partita: this.p, chi: 1,
      nota: !giocabile ? 'Not enough resources' : '',
      chiusa: function () { self.sel = 0; self.modo = 0; self.aggiorna(); },
      azioni: function (lato) {
        if (d.modi > 0 && giocabile) {
          lato.classList.add('con-scelta');      // (il lato si attacca alla lente solo dopo: la classe va su di lui)
          lato.appendChild(self.sceltaModo(d, pos, function (mm) {
            self.modo = mm;
            gioca.classList.remove('spento');
            self.aggiorna();
          }));
        }
        if (giocabile) {
          var pr = self.p.anteprima(1, pos, d.modi > 0 ? 1 : 0), sc = pr && pr.anteprima ? pr.anteprima.scatta : [];
          sc.forEach(function (kw) {
            var e = Segnalini.effetto(kw, id);
            lato.appendChild(el('div', 'avvisa-seg', '<img src="' + UI.kwIcona(kw) + '" alt=""><div><b>' + kw + ' token reaches 100!</b>' +
              '<span>' + e.nome + ': ' + e.testo + '</span></div>'));
          });
        }
        var az = el('div', 'azioni');
        var scarta = el('button', 'btn', 'Discard');
        var gioca = el('button', 'btn oro' + (!giocabile || d.modi > 0 ? ' spento' : ''), 'Play');
        scarta.addEventListener('click', function () { var p = self.sel; UI.chiudiLente(); self.agisci('discard', p, 0); });
        gioca.addEventListener('click', function () {
          if (!giocabile) { UI.scuoti(gioca); return; }
          if (d.modi > 0 && !self.modo) { UI.avviso('Choose a mode'); UI.scuoti(gioca); return; }
          var p = self.sel, m = self.modo; UI.chiudiLente(); self.agisci('play', p, m);
        });
        az.appendChild(scarta); az.appendChild(gioca);
        lato.appendChild(az);
      }
    });
    document.querySelector('.velo').style.background = 'rgba(8,9,14,.22)';
  };

  // La scelta del "modo" di una carta, detta in chiaro invece di "Mode 1 ... Mode 8" (Luca, 6/10/2026). Tre famiglie:
  //  - modi veri ("Mode1: ... Mode2: ..."): un pulsante per modo con il suo effetto scritto;
  //  - evocazioni a scelta ("Evoke A, B or C", 2-3 modi): le carte evocabili in miniatura;
  //  - una carta della mano (8 modi = le 8 posizioni): la mano in miniatura, tua o dell'avversario
  //    (coperte con "?" nelle partite a carte nascoste); la carta giocata e' segnata "This card".
  function arteCarta(id) {
    return window.ARTE && window.ARTE.has(id) ? 'img/arte/card_' + id + '.jpg?h=' + ((window.ARTE_H || {})[id] || '') : 'img/carte/card_' + id + '.png';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  Battaglia.prototype.sceltaModo = function (d, pos, scegli) {
    var self = this, testo = d.effetto || '', voci = [], titolo, griglia = true;
    // modi veri: le righe dopo "ModeN:" fino al modo seguente
    var modi = {}, cur = 0;
    testo.split('\n').forEach(function (r) {
      var m = r.match(/^\s*Mode\s*(\d+)\s*:\s*(.*)$/i);
      if (m) { cur = +m[1]; modi[cur] = m[2] ? [m[2]] : []; } else if (cur && r.trim()) modi[cur].push(r.trim());
    });
    var ev = testo.match(/Evoke (?:an? )?([^\n]+)/);
    if (Object.keys(modi).length) {
      titolo = 'Choose an effect'; griglia = false;
      for (var k = 1; k <= d.modi; k++) voci.push({ testo: (modi[k] || []).join(' · ') || 'Option ' + k });
    } else if (ev && d.modi <= 3) {
      titolo = 'Choose the card to evoke';
      ev[1].split(/,\s*|\s+or\s+/).slice(0, d.modi).forEach(function (n) {
        var c = Motore.catalogo.lista.filter(function (x) { return x.nome.toLowerCase() === n.trim().toLowerCase(); })[0];
        voci.push({ id: c ? c.id : null, nome: c ? c.nome : n.trim().replace(/^last card$/i, 'Your last card') });
      });
    } else {
      var lui = /opponent's hand/i.test(testo), g = this.p.g[lui ? 2 : 1];
      titolo = lui ? 'Choose a card in the opponent\'s hand' : 'Choose a card in your hand';
      for (var i = 1; i <= d.modi; i++) {
        var cid = g.Hand.get(i), vis = !lui || !this.p.nascoste || (g.Revealed && g.Revealed.has(i));
        voci.push({ id: vis ? cid : null, nome: vis && cid ? UI.dati(cid).nome : 'Hidden card', propria: !lui && i === pos });
      }
    }
    var box = el('div', 'scelta-modo'), lista = el('div', griglia ? 'sm-mini' : 'sm-effetti');
    box.appendChild(el('div', 'sm-titolo', titolo));
    voci.forEach(function (v, j) {
      var b = griglia
        ? el('button', 'sm-t' + (v.propria ? ' propria' : ''), (v.id ? '<img src="' + arteCarta(v.id) + '" alt="">' : '<i>?</i>') +
            '<span>' + esc(v.nome) + '</span>' + (v.propria ? '<em>This card</em>' : ''))
        : el('button', 'sm-e', '<b>' + (j + 1) + '</b><span>' + esc(v.testo) + '</span>');
      b.addEventListener('click', function () {
        lista.querySelectorAll('button').forEach(function (x, n) { x.classList.toggle('su', n === j); });
        scegli(j + 1);
      });
      lista.appendChild(b);
    });
    box.appendChild(lista);
    return box;
  };

  // ------------------------------------------------------------------ azioni
  Battaglia.prototype.mostraEntrata = function (id, testo, durata, cb) {
    var e = el('div', 'entrata');
    e.appendChild(el('span', 'etic', testo));
    e.appendChild(UI.carta(id));
    document.body.appendChild(e);
    setTimeout(function () { e.classList.add('via'); setTimeout(function () { e.remove(); }, 300); cb(); }, durata);
  };

  Battaglia.prototype.agisci = function (azione, pos, modo) {
    if (this.bloccato || this.p.corrente !== 1) return;
    var self = this, id = this.p.g[1].Hand.get(pos);
    this.bloccato = true; this.sel = 0; this.modo = 0;
    this.q('.mano').classList.add('attesa');
    this.mostraEntrata(id, azione === 'play' ? 'You play' : 'You discard', 520, function () {
      var prima = fotoStato(self.p);
      var r = self.p.usaCarta(1, azione, pos, modo);
      if (r.errore) { UI.avviso(r.errore); self.bloccato = false; self.aggiorna(); return; }
      self.registraMossa(1, id, azione, prima);
      if (self.opz.tutorial) { self.bloccato = false; return self.opz.tutorial.mossa(self, r, id); }
      self.app.salvaPartita(self);
      self.aggiorna();
      self.scatti(r.segnalini, id, 1, function () {
        self.bloccato = false;
        if (self.p.stato !== 'in corso') return self.finale();
        if (self.p.corrente === 1) UI.avviso('Play again!');
        else self.turnoCpu();
      });
    });
  };

  // segnalini arrivati a 100 con l'ultima giocata: uno alla volta, poi si prosegue
  Battaglia.prototype.scatti = function (lista, id, chi, poi) {
    var self = this, l = (lista || []).slice();
    (function prossimo() {
      if (!l.length || self.chiuso) return poi();
      Segnalini.scatto(l.shift(), id, chi, prossimo);
    })();
  };

  Battaglia.prototype.turnoCpu = function () {
    var self = this;
    this.bloccato = true;
    this.aggiorna();
    setTimeout(function () {
      if (self.chiuso) return;
      // fascia media: la CPU nuova (js/cpu.js; Ashkar con la valutazione del Titano); base e avanzata: quella originale
      var m = (self.av.cpu === 'nuova' || self.av.cpu === 'titano') && window.Cpu ? Cpu.mossa(self.p, 2, { titano: self.av.cpu === 'titano' })
        : Motore.mossaCpu(self.p, 2), id = self.p.g[2].Hand.get(m.pos);
      self.mostraEntrata(id, m.azione === 'play' ? 'Opponent plays' : 'Opponent discards', m.azione === 'play' ? 1150 : 800, function () {
        if (self.chiuso) return;
        var prima = fotoStato(self.p);
        var r = self.p.usaCarta(2, m.azione, m.pos, m.modo);
        if (r.errore) { console.error('mossa della CPU rifiutata', r.errore, m); self.p.usaCarta(2, 'discard', m.pos, 0); }
        self.registraMossa(2, id, r.errore ? 'discard' : m.azione, prima);
        self.app.salvaPartita(self);
        self.aggiorna();
        self.scatti(r.segnalini, id, 2, function () {
          if (self.chiuso) return;
          self.bloccato = false;
          if (self.p.stato !== 'in corso') return self.finale();
          if (self.p.corrente === 2) self.turnoCpu();
        });
      });
    }, 650);
  };

  // ------------------------------------------------------------------ pausa e fine
  Battaglia.prototype.pausa = function () {
    var self = this;
    if (this.opz.tutorial) return this.opz.tutorial.esci();
    var f = el('div', 'finale'), r = el('div', 'riquadro pannello');
    r.innerHTML = '<h2>Paused</h2><p>' + (this.opz.titolo || 'The Jester') + ' · Round ' + this.p.round +
      (this.p.nascoste ? ' · hidden cards' : ' · open cards') + (this.p.lunga ? ' · long game' : '') + '</p>';
    var az = el('div', 'azioni');
    var riprendi = el('button', 'btn oro', 'Resume'), casa = el('button', 'btn', 'Home'), resa = el('button', 'btn', 'Surrender');
    riprendi.addEventListener('click', function () { f.remove(); });
    casa.addEventListener('click', function () { f.remove(); self.chiuso = true; self.app.home(); });
    resa.addEventListener('click', function () {
      f.remove();
      self.p.stato = 'finita'; self.p.vincitore = 2; self.p.esito = 'Surrender';
      self.finale();
    });
    az.appendChild(resa); az.appendChild(casa); az.appendChild(riprendi);
    r.appendChild(az); f.appendChild(r); document.body.appendChild(f);
  };

  Battaglia.prototype.finale = function () {
    if (this.chiusoFinale) return;
    this.chiusoFinale = true;
    this.bloccato = true;
    var self = this, p = this.p, v = p.vincitore;
    var esito = v === 1 ? 1 : v === 2 ? 2 : 0;
    if (window.Musica) Musica.congedo(esito === 1 ? 'vittoria' : esito === 2 ? (this.av.tipo === 'sfidante' ? 'sconfitta-sfida' : 'sconfitta') : null);
    var premio = this.app.profilo.registraPartita(esito, { sfida: this.opz.sfida, lunga: p.lunga });
    var f = el('div', 'finale'), r = el('div', 'riquadro pannello');
    var testo = p.esito === 'Surrender' ? 'You surrendered.' : (ESITI[p.esito] || ESITI.Draw)[esito === 2 ? 1 : 0];
    // i due ritratti: chi vince con l'anello d'oro, chi perde spento
    // (ai lati del titolo, per stare nell'altezza del telefono in orizzontale anche con i booster del premio)
    r.innerHTML = '<div class="volti">' + volto(this.app, 'giocatore', 'You', '', esito === 1 ? 'vince' : esito === 2 ? 'perde' : '') +
      '<div class="titolo-esito"><h2 class="' + (esito === 1 ? 'vinta' : esito === 2 ? 'persa' : '') + '">' + (esito === 1 ? 'Victory' : esito === 2 ? 'Defeat' : 'Draw') + '</h2>' +
      '<div class="premio">+ ' + UI.moneta(premio) + '</div></div>' +
      volto(this.app, this.av.nome, this.av.titolo, '', esito === 2 ? 'vince' : esito === 1 ? 'perde' : '') + '</div>' +
      '<p>' + testo + ' · ' + p.round + (p.round === 1 ? ' round' : ' rounds') + '</p>' + (this.ultimaMossa() || '');
    Array.prototype.forEach.call(r.querySelectorAll('.um-carta'), function (a) {
      a.addEventListener('click', function () { UI.apriLente(+a.dataset.id, { nota: 'Last move', notaNeutra: true }); });
    });
    // traguardi: prima vittoria, fascia completata, tutti battuti
    var pr = this.app.profilo, bonus = pr.ultimiBonus || [];
    // bonus e regalo a sinistra, scelta del booster a destra: in colonna non stavano nell'altezza del telefono
    var fila = el('div', 'premi-fila'), sinistra = el('div', 'premi-sx');
    if (bonus.length) {
      var lb = el('div', 'bonus-fine');
      bonus.forEach(function (b) {
        lb.appendChild(el('div', 'bonus-riga', '<span>🏆 ' + b.testo + '</span><b>' + (b.monete ? '+ ' + UI.moneta(b.monete) : '') + (b.booster ? (b.tipo ? (b.monete ? ' + ' : '+ ') + Booster.tipo(b.tipo).nome + ' booster' : ' + ' + b.booster + ' rare booster' + (b.booster > 1 ? 's' : '')) : '') + '</b>'));
      });
      sinistra.appendChild(lb);
    }
    if (pr.d.regali && pr.d.regali.length) {
      var rg = el('button', 'btn oro regalo-fine', 'Open gift booster' + (pr.d.regali.length > 1 ? ' (' + pr.d.regali.length + ')' : ''));
      rg.addEventListener('click', function () { UIBooster.apriRegali(self.app, function () { rg.remove(); }); });
      sinistra.appendChild(rg);
    }
    if (sinistra.children.length) fila.appendChild(sinistra);
    // vittoria: tre booster, se ne apre uno. Chi esce senza sceglierlo lo ritrova nella home.
    if (esito === 1 && this.app.profilo.d.premio) {
      var sc = el('div', 'scelta-premio', '<div class="scelta-t">Choose a booster</div>');
      UIBooster.sceltaPremio(sc, this.app, function () { sc.remove(); });
      fila.appendChild(sc);
    }
    if (fila.children.length) { if (fila.children.length > 1) r.classList.add('largo'); r.appendChild(fila); }
    var az = el('div', 'azioni');
    var neg = el('button', 'btn oro', 'Shop'), riv = el('button', 'btn', 'Rematch'), casa = el('button', 'btn', 'Home');
    // il campo com'e' rimasto (le ultime carte al centro si possono aprire), poi si torna al riquadro
    var campo = el('button', 'btn', 'Board');
    campo.addEventListener('click', function () {
      f.classList.add('nascosto');
      var torna = el('button', 'btn oro torna-esito', 'Back to results');
      torna.addEventListener('click', function () { torna.remove(); f.classList.remove('nascosto'); });
      document.body.appendChild(torna);
    });
    neg.addEventListener('click', function () { f.remove(); self.chiuso = true; self.app.negozio(); });
    riv.addEventListener('click', function () { f.remove(); self.chiuso = true; self.app.nuovaPartita(self.opz.rivincita); });
    casa.addEventListener('click', function () { f.remove(); self.chiuso = true; self.app.home(); });
    az.appendChild(casa); az.appendChild(campo); az.appendChild(riv); az.appendChild(neg);
    r.appendChild(az); f.appendChild(r);
    setTimeout(function () { document.body.appendChild(f); }, 1200);
    this.aggiorna();
  };

  radice.Battaglia = Battaglia;
})(window);
