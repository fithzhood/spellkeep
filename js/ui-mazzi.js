// Editor dei mazzi: collezione a sinistra (con filtri), mazzo a destra diviso per rarita', segnalini.
// Tocco = carta grande con Add/Remove. Durante la costruzione si puo' andare oltre 15 carte per rarita' (prima si
// aggiunge, poi si sceglie cosa togliere); uscendo con un mazzo non in regola compare un avviso, e il mazzo resta bozza.
(function (radice) {
  'use strict';
  var el = UI.el;
  var RARITA = { C: 'Common', U: 'Uncommon', R: 'Rare' };

  function Editor(app, indice) {
    this.app = app; this.pr = app.profilo; this.i = indice || 0;
    this.scheda = 'C';
    // i filtri restano finche' l'app e' aperta (si ritrovano riaprendo l'editor)
    // carte nuove = arrivate dopo l'ultima uscita dall'editor (etichetta New finche' non si esce)
    if (typeof this.pr.d.editorVisto !== 'number') { this.pr.d.editorVisto = this.pr.d.collezione.length; this.pr.salva(); }
    this.visto = this.pr.d.editorVisto;
    this.F = app.filtriEditor || (app.filtriEditor = { q: '', rar: [], tipi: [], kw: [], fuori: false, ordina: 'rar' });
    // ci sono carte nuove: si parte da quelle
    if (this.pr.d.collezione.length > this.visto) this.F.ordina = 'nuove';
    this.costruisci();
  }

  Editor.prototype.costruisci = function () {
    var self = this, s = el('div', 'schermo');
    s.innerHTML = '<div class="testa"><button class="btn indietro">Back</button><h2></h2>' +
      '<button class="btn vista"></button><div class="scegli-mazzo"></div><div class="cassa pannello"></div></div>' +
      '<div class="corpo"><div class="editor"><div class="collezione"><div class="filtri"></div><div class="griglia"></div></div>' +
      '<div class="lista-mazzo pannello"><div class="schede"></div><div class="righe"></div><div class="segnalini-mazzo"></div></div></div></div>';
    this.app.monta(s);
    this.s = s;
    s.querySelector('.indietro').addEventListener('click', function () { self.esci(); });
    s.querySelector('.vista').addEventListener('click', function () { self.pr.d.imp.testo = !self.pr.d.imp.testo; self.pr.salva(); self.disegna(); });
    s.querySelector('h2').addEventListener('click', function () {
      // tastiera del gioco, non la finestra di sistema del telefono
      var m = self.pr.mazzo(self.i);
      Tastiera.apri({ titolo: 'Deck name', valore: m.nome, max: 24, ok: function (nome) { m.nome = nome.slice(0, 24); self.pr.salva(); self.disegna(); } });
    });
    this.impostaGriglia();
    this.impostaFiltri();
    this.disegna();
  };

  Editor.prototype.disegna = function () {
    var self = this, s = this.s, m = this.pr.mazzo(this.i);
    s.querySelector('h2').textContent = m.nome + ' ✎';
    s.querySelector('.vista').textContent = this.pr.d.imp.testo ? 'Art' : 'Text';
    s.querySelector('.cassa').innerHTML = 'Collection ' + this.pr.d.collezione.length;
    // mazzi
    var sm = s.querySelector('.scegli-mazzo'); sm.innerHTML = '';
    this.pr.d.mazzi.forEach(function (mz, k) {
      var b = el('button', (k === self.i ? 'su' : '') + (self.pr.mazzoValido(mz) ? '' : ' no'), String(k + 1));
      b.title = mz.nome;
      b.addEventListener('click', function () { self.i = k; self.disegna(); });
      sm.appendChild(b);
    });
    if (!sm.sfumata) { UI.sfuma(sm); sm.sfumata = true; }
    var attivo = sm.querySelector('.su'); if (attivo) setTimeout(function () { attivo.scrollIntoView({ inline: 'nearest', block: 'nearest' }); }, 0);
    this.statoFiltri();

    // griglia della collezione, ordinata per rarita' e costo
    var g = s.querySelector('.griglia'), dentro = {};
    ['C', 'U', 'R'].forEach(function (r) { m[r].forEach(function (id) { dentro[id] = 1; }); });
    var carte = this.carteFiltrate(dentro);
    var top = g.scrollTop;
    g.classList.toggle('testuale', !!this.pr.d.imp.testo);
    g.innerHTML = '';
    if (!carte.length) g.appendChild(el('div', 'vuoto-msg', 'No cards match these filters.'));
    var visto = this.visto, pos = {};
    this.pr.d.collezione.forEach(function (id, i) { pos[id] = i; });
    carte.forEach(function (d) {
      var c = UI.carta(d.id, { mini: true, nuova: pos[d.id] >= visto });
      if (dentro[d.id]) c.classList.add('dentro');
      if (d.kw.indexOf('Forbidden') >= 0) c.classList.add('spenta');
      g.appendChild(c);
    });
    g.scrollTop = top;
    // lista del mazzo
    var sch = s.querySelector('.schede'); sch.innerHTML = '';
    ['C', 'U', 'R'].forEach(function (r) {
      var n = m[r].length, b = el('button', self.scheda === r ? 'su' : '',
        RARITA[r] + ' <span class="' + (n === 15 ? 'pieno' : n > 15 ? 'troppe' : 'vuoto') + '">' + n + '/15</span>');
      b.addEventListener('click', function () { self.scheda = r; self.disegna(); });
      sch.appendChild(b);
    });
    var righe = s.querySelector('.righe'); righe.innerHTML = '';
    var lista = m[this.scheda].map(UI.dati).sort(function (a, b) { return (a.costo.b + a.costo.g + a.costo.r) - (b.costo.b + b.costo.g + b.costo.r) || a.nome.localeCompare(b.nome); });
    if (!lista.length) righe.appendChild(el('div', 'vuoto-msg', 'Tap cards on the left to add them.'));
    // il mazzo come carte (illustrazioni raggruppate) o come elenco: si sceglie col pulsante in fondo alla colonna
    var aCarte = !!this.pr.d.imp.mazzoCarte;
    righe.classList.toggle('a-carte', aCarte);
    if (aCarte) {
      lista.forEach(function (d) {
        var c = UI.carta(d.id, { mini: true });
        c.addEventListener('click', function () { self.lente(d.id); });
        righe.appendChild(c);
      });
    } else lista.forEach(function (d) {
      var costi = ['b', 'g', 'r'].filter(function (n) { return d.costo[n] > 0; }).map(function (n) { return '<span class="costo ' + n + '">' + d.costo[n] + '</span>'; }).join('') || '<span class="costo z">0</span>';
      var r = el('button', 'riga-carta', '<span class="costi">' + costi + '</span><span class="nome">' + d.nome + '</span>');
      r.addEventListener('click', function () { self.lente(d.id); });
      righe.appendChild(r);
    });
    // segnalino: uno solo per mazzo, scelto da un menu a tendina (con l'effetto e quante carte del mazzo hanno
    // quella keyword). Scelto a mano, resta anche aggiungendo o togliendo carte.
    var seg = s.querySelector('.segnalini-mazzo'); seg.innerHTML = '<span class="etic">Token</span>';
    var nome = (m.segnalini || [])[0] || 'none';
    var bt = el('button', 'scegli-token', (nome === 'none' ? 'None' : '<img src="' + UI.kwIcona(nome) + '" alt="">' + nome) + '<i class="freccia">▾</i>');
    bt.addEventListener('click', function () { self.tendinaToken(bt); });
    seg.appendChild(bt);
    var vis = el('button', 'vista-mazzo', aCarte ? 'List' : 'Cards');
    vis.addEventListener('click', function () { self.pr.d.imp.mazzoCarte = !aCarte; self.pr.salva(); self.disegna(); });
    seg.appendChild(vis);
  };

  // menu a tendina dei segnalini, sopra il pulsante
  Editor.prototype.tendinaToken = function (bt) {
    var self = this, m = this.pr.mazzo(this.i), ora = (m.segnalini || [])[0] || 'none';
    var conta = {};
    ['C', 'U', 'R'].forEach(function (r) {
      m[r].forEach(function (id) {
        UI.dati(id).keyword.map(UI.kwNome).forEach(function (k) { conta[k] = (conta[k] || 0) + 1; });
      });
    });
    var velo = el('div', 'velo-tendina'), menu = el('div', 'pannello tendina-token');
    ['none'].concat(Motore.SEGNALINI).forEach(function (k) {
      var e = k === 'none' ? null : Segnalini.effetto(k);
      var v = el('button', 'voce-token' + (k === ora ? ' su' : ''),
        (k === 'none' ? '<span class="ico-vuota"></span>' : '<img src="' + UI.kwIcona(k) + '" alt="">') +
        '<span class="t"><b>' + (k === 'none' ? 'No token' : k) + '</b><small>' +
        (k === 'none' ? 'The deck plays without a token' : e.nome + ' · ' + (conta[k] || 0) + ' ' + k + ' card' + (conta[k] === 1 ? '' : 's') + ' in deck') +
        '</small></span>' + (k === ora ? '<i class="spunta">✓</i>' : ''));
      if (e) v.title = e.testo;
      v.addEventListener('click', function () {
        m.segnalini = k === 'none' ? [] : [k];
        m.segnaliniScelti = true;
        self.pr.salva(); velo.remove(); self.disegna();
      });
      menu.appendChild(v);
    });
    velo.addEventListener('click', function (ev) { if (ev.target === velo) velo.remove(); });
    velo.appendChild(menu); document.body.appendChild(velo);
    // sopra il pulsante, allineato a destra della colonna; se non c'e' spazio sopra, scorre
    var r = bt.getBoundingClientRect();
    menu.style.right = Math.max(8, innerWidth - r.right) + 'px';
    menu.style.bottom = Math.max(8, innerHeight - r.top + 6) + 'px';
    menu.style.maxHeight = (r.top - 14) + 'px';
    var su = menu.querySelector('.su'); if (su) su.scrollIntoView({ block: 'nearest' });
  };

  // un tocco apre la carta (con Aggiungi/Togli); il trascinamento fa solo scorrere la griglia.
  // Si ascolta il CLICK e non il pointerup: aprendo la lente sul pointerup, il click che segue cadeva sul velo appena
  // comparso e la richiudeva subito (per questo funzionava solo il tocco lungo, che il click non lo manda).
  Editor.prototype.impostaGriglia = function () {
    var self = this, g = this.s.querySelector('.griglia');
    g.addEventListener('click', function (ev) {
      var c = ev.target.closest('.carta'); if (c) self.lente(+c.dataset.id);
    });
    g.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
  };

  // uscendo: se un mazzo toccato non ha 15 carte per rarita', si dice cosa manca o avanza
  Editor.prototype.esci = function () {
    var self = this, m = this.pr.mazzo(this.i);
    this.pr.d.editorVisto = this.pr.d.collezione.length; this.pr.salva();
    if (this.pr.mazzoValido(m)) return this.app.home();
    var righe = ['C', 'U', 'R'].map(function (r) {
      var n = m[r].length, diff = n - 15;
      return '<li class="' + (diff ? 'no' : 'ok') + '">' + RARITA[r] + ' <b>' + n + '/15</b>' +
        (diff > 0 ? ' · remove ' + diff : diff < 0 ? ' · add ' + (-diff) : ' ✓') + '</li>';
    }).join('');
    var f = el('div', 'finale'), r = el('div', 'riquadro pannello avviso-mazzo');
    r.innerHTML = '<h2>Deck not ready</h2><p>A deck needs exactly 15 cards of each rarity to be played.</p><ul>' + righe + '</ul>' +
      '<p class="piccolo">If you leave now, "' + m.nome + '" is kept as a draft and can’t be used in games until it is fixed.</p>';
    var az = el('div', 'azioni'), resta = el('button', 'btn oro', 'Keep editing'), via = el('button', 'btn', 'Leave as draft');
    resta.addEventListener('click', function () { f.remove(); });
    via.addEventListener('click', function () { f.remove(); self.app.home(); });
    az.appendChild(via); az.appendChild(resta); r.appendChild(az); f.appendChild(r); document.body.appendChild(f);
  };

  // ------------------------------------------------------------------ filtri
  // Una riga sola, senza scorrimento: ricerca, pulsante Filters (pannello con rarita', tipo di costo, keyword,
  // ordine) e Spare (solo le carte non ancora nel mazzo). Per azzerare: Reset nel pannello (la X l'ha tolta Luca).
  var TIPI_F = [['b', 'Bricks'], ['g', 'Gems'], ['r', 'Recruits'], ['m', 'Mixed'], ['z', 'Free']];
  var ICO_T = { b: 'brick-pile', g: 'crystal-growth', r: 'crested-helmet' };
  var ORDINI = [['nuove', 'Newest'], ['rar', 'Rarity'], ['costo', 'Cost'], ['nome', 'Name']];
  var NESSUNA = '(none)';
  function totale(d) { return d.costo.b + d.costo.g + d.costo.r; }
  // la carta ha la keyword (o, con il supporto acceso, e' una sua carta di supporto: School of Nature per Nature...)
  function haKw(d, k, conSupporto) {
    return d.keyword.map(UI.kwNome).indexOf(k) >= 0 || (!!conSupporto && !!((Booster.supporto()[k] || {})[d.id]));
  }
  function alterna(a, x) { var i = a.indexOf(x); if (i >= 0) a.splice(i, 1); else a.push(x); }
  function icoTipo(k) {
    return ICO_T[k] ? UI.icona(ICO_T[k]) : k === 'm' ? '<i class="tre"><u class="b"></u><u class="g"></u><u class="r"></u></i>' : '<i class="zero">0</i>';
  }

  Editor.prototype.quantiFiltri = function () {
    var F = this.F;
    return F.rar.length + F.tipi.length + F.kw.length + (F.q.trim() ? 1 : 0);   // Spare e' un interruttore: la X non serve
  };

  Editor.prototype.carteFiltrate = function (dentro) {
    var F = this.F, q = F.q.trim().toLowerCase(), arrivo = {};
    // ordine d'arrivo: la collezione si allunga in coda (negozio, booster)
    this.pr.d.collezione.forEach(function (id, i) { arrivo[id] = i; });
    return this.pr.d.collezione.map(UI.dati).filter(function (d) {
      if (F.rar.length && F.rar.indexOf(d.rarita) < 0) return false;
      if (F.tipi.length && F.tipi.indexOf(UI.tipo(d)) < 0) return false;
      if (F.kw.length && !F.kw.some(function (k) { return k === NESSUNA ? !d.keyword.length : haKw(d, k, F.supporto); })) return false;
      if (F.fuori && dentro[d.id]) return false;
      if (q && d.nome.toLowerCase().indexOf(q) < 0 && d.effetto.toLowerCase().indexOf(q) < 0 && d.kw.toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) {
      var ra = 'CUR'.indexOf(a.rarita) - 'CUR'.indexOf(b.rarita), ca = totale(a) - totale(b), na = a.nome.localeCompare(b.nome);
      if (F.ordina === 'nuove') return arrivo[b.id] - arrivo[a.id];
      if (F.ordina === 'costo') return ca || ra || na;
      if (F.ordina === 'nome') return na;
      return ra || ca || na;
    });
  };

  Editor.prototype.impostaFiltri = function () {
    var self = this, f = this.s.querySelector('.filtri');
    f.innerHTML = '<label class="cerca">' + '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>' + '<input type="search" placeholder="Search" enterkeyhint="search" autocomplete="off"></label>' +
      '<button class="apri-filtri">Filters<b class="n"></b></button><button class="spare">Spare</button>';
    var inp = f.querySelector('input');
    inp.value = this.F.q;
    // la ricerca usa la tastiera del gioco (niente tastiera del telefono): i risultati si aggiornano mentre si scrive
    inp.readOnly = true; inp.setAttribute('inputmode', 'none');
    function cerca(ev) {
      if (ev) ev.preventDefault();
      inp.blur();
      Tastiera.apri({ titolo: 'Search', valore: self.F.q, max: 30, vuotoOk: true, minuscolo: true,
        cambia: function (q) { if (q === self.F.q) return; self.F.q = q; inp.value = q; self.disegna(); },
        info: function () { var n = self.s.querySelectorAll('.griglia .carta').length; return n + (n === 1 ? ' card' : ' cards'); },
        ok: function (q) { self.F.q = q; inp.value = q; self.disegna(); } });
    }
    f.querySelector('.cerca').addEventListener('click', cerca);
    f.querySelector('.apri-filtri').addEventListener('click', function () { self.pannelloFiltri(); });
    f.querySelector('.spare').addEventListener('click', function () { self.F.fuori = !self.F.fuori; self.disegna(); });
  };

  // solo lo stato dei pulsanti: la barra non si ridisegna, cosi' la casella di ricerca non perde il cursore
  Editor.prototype.statoFiltri = function () {
    var f = this.s.querySelector('.filtri'), F = this.F, n = F.rar.length + F.tipi.length + F.kw.length;
    f.querySelector('.apri-filtri').classList.toggle('su', n > 0);
    f.querySelector('.apri-filtri .n').textContent = n ? n : '';
    f.querySelector('.spare').classList.toggle('su', F.fuori);
  };

  Editor.prototype.pannelloFiltri = function () {
    var self = this, F = this.F, v = el('div', 'velo-filtri'), p = el('div', 'pannello pannello-filtri');
    // tutte le keyword, con quante carte ne possiedi su quante esistono (come sulle buste); con "Support cards"
    // acceso contano anche le carte di supporto
    var ho = {}; this.pr.d.collezione.forEach(function (id) { ho[id] = 1; });
    var tutte = Motore.catalogo.lista.filter(function (d) { return d.kw.indexOf('Forbidden') < 0; });
    var kws = (window.KEYWORD || []).map(function (x) { return x.nome; }).filter(function (n) { return n !== 'Forbidden'; }).sort();
    function conta(k) {
      var c = [0, 0];
      tutte.forEach(function (d) {
        var si = k === NESSUNA ? !d.keyword.length : haKw(d, k, F.supporto);
        if (si) { c[1]++; if (ho[d.id]) c[0]++; }
      });
      return c;
    }
    function gett(html, cls, attivo, fai) {
      var b = el('button', 'gett ' + cls + (attivo() ? ' su' : ''), html);
      b.addEventListener('click', function () { fai(); b.classList.toggle('su', attivo()); aggiorna(); });
      return b;
    }
    function sezione(titolo, cls) {
      var s = el('div', 'fsez ' + (cls || ''), '<div class="fsez-t">' + titolo + '</div>'), g = el('div', 'gruppo');
      s.appendChild(g); return [s, g];
    }
    var sx = el('div', 'f-sx'), dx = el('div', 'f-dx');
    var r = sezione('Rarity');
    ['C', 'U', 'R'].forEach(function (k) {
      r[1].appendChild(gett('<i class="rar ' + k + '"></i>' + RARITA[k], 'rar-g', function () { return F.rar.indexOf(k) >= 0; }, function () { alterna(F.rar, k); }));
    });
    sx.appendChild(r[0]);
    var t = sezione('Cost type');
    TIPI_F.forEach(function (x) {
      t[1].appendChild(gett(icoTipo(x[0]) + x[1], 'tipo ' + x[0], function () { return F.tipi.indexOf(x[0]) >= 0; }, function () { alterna(F.tipi, x[0]); }));
    });
    sx.appendChild(t[0]);
    var o = sezione('Sort by');
    var ordini = ORDINI.map(function (x) {
      return gett(x[1], 'ord', function () { return F.ordina === x[0]; }, function () {
        F.ordina = x[0]; ordini.forEach(function (b, j) { b.classList.toggle('su', ORDINI[j][0] === F.ordina); });
      });
    });
    ordini.forEach(function (b) { o[1].appendChild(b); });
    sx.appendChild(o[0]);
    var k = sezione('Keywords <small>any of these</small>', 'kws');
    var sup = el('button', 'gett sup-g' + (F.supporto ? ' su' : ''), '<span class="interruttore' + (F.supporto ? ' su' : '') + '"></span>Support cards');
    sup.title = 'Also count and show the cards that support a keyword (e.g. School of Nature for Nature)';
    sup.addEventListener('click', function () {
      F.supporto = !F.supporto;
      sup.classList.toggle('su', F.supporto); sup.querySelector('.interruttore').classList.toggle('su', F.supporto);
      disegnaKw(); aggiorna();
    });
    k[0].querySelector('.fsez-t').appendChild(sup);
    function disegnaKw() {
      k[1].innerHTML = '';
      kws.concat([NESSUNA]).forEach(function (n) {
        var c = conta(n), nome = n === NESSUNA ? 'No keyword' : '<img src="' + UI.kwIcona(n) + '" alt="">' + n;
        var b = gett(nome + ' <small>' + c[0] + '/' + c[1] + '</small>', 'kw-g' + (c[0] ? '' : ' nessuna'), function () { return F.kw.indexOf(n) >= 0; }, function () { alterna(F.kw, n); });
        k[1].appendChild(b);
      });
    }
    disegnaKw();
    dx.appendChild(k[0]);
    var piede = el('div', 'f-piede'), az = el('button', 'btn', 'Reset'), ok = el('button', 'btn oro', '');
    az.addEventListener('click', function () {
      F.rar.length = 0; F.tipi.length = 0; F.kw.length = 0;
      p.querySelectorAll('.rar-g.su, .tipo.su, .kw-g.su').forEach(function (b) { b.classList.remove('su'); });
      aggiorna();
    });
    function chiudi() { v.remove(); }
    ok.addEventListener('click', chiudi);
    v.addEventListener('click', function (ev) { if (ev.target === v) chiudi(); });
    piede.appendChild(az); piede.appendChild(ok);
    p.appendChild(sx); p.appendChild(dx); p.appendChild(piede);
    v.appendChild(p); document.body.appendChild(v);
    function aggiorna() {
      self.disegna();
      var n = self.s.querySelectorAll('.griglia .carta').length;
      ok.textContent = n ? 'Show ' + n + (n === 1 ? ' card' : ' cards') : 'No cards match';
    }
    aggiorna();
  };

  Editor.prototype.alterna = function (id, c) {
    var m = this.pr.mazzo(this.i), d = UI.dati(id);
    if (m[d.rarita].indexOf(id) >= 0) { this.pr.togliDalMazzo(this.i, id); this.scheda = d.rarita; this.disegna(); return; }
    var err = this.pr.aggiungiAlMazzo(this.i, id);
    if (err) { UI.avviso(err); if (c) UI.scuoti(c); return; }
    this.scheda = d.rarita;
    this.disegna();
  };

  Editor.prototype.lente = function (id) {
    var self = this, m = this.pr.mazzo(this.i), d = UI.dati(id), dentro = m[d.rarita].indexOf(id) >= 0;
    UI.apriLente(id, {
      nota: d.kw.indexOf('Forbidden') >= 0 ? 'Forbidden: cannot be used in a deck' : '',
      azioni: function (lato) {
        var az = el('div', 'azioni'), b = el('button', 'btn' + (dentro ? '' : ' oro'), dentro ? 'Remove' : 'Add to deck');
        b.addEventListener('click', function () { UI.chiudiLente(); self.alterna(id); });
        az.appendChild(b); lato.appendChild(az);
      }
    });
  };

  radice.Editor = Editor;
})(window);
