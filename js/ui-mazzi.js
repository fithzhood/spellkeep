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
    this.F = app.filtriEditor || (app.filtriEditor = { q: '', rar: [], tipi: [], kw: [], fuori: false, ordina: 'rar' });
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
      var m = self.pr.mazzo(self.i), nome = window.prompt('Deck name', m.nome);
      if (nome && nome.trim()) { m.nome = nome.trim().slice(0, 24); self.pr.salva(); self.disegna(); }
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
    carte.forEach(function (d) {
      var c = UI.carta(d.id, { mini: true });
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
    // segnalino: uno solo per mazzo; tocco = passa alla keyword successiva fra quelle con segnalino.
    // Scelto a mano, resta anche aggiungendo o togliendo carte.
    var seg = s.querySelector('.segnalini-mazzo'); seg.innerHTML = '<span class="etic">Token</span>';
    var nome = (m.segnalini || [])[0] || 'none';
    var bt = el('button', '', nome === 'none' ? '—' : '<img src="' + UI.kwIcona(nome) + '" alt="">' + nome);
    bt.addEventListener('click', function () {
      var giro = ['none'].concat(Motore.SEGNALINI), j = (giro.indexOf(nome) + 1) % giro.length;
      m.segnalini = giro[j] === 'none' ? [] : [giro[j]];
      m.segnaliniScelti = true;
      self.pr.salva(); self.disegna();
      if (giro[j] !== 'none') { var e = Segnalini.effetto(giro[j]); UI.avviso(giro[j] + ' token at 100 · ' + e.nome + ': ' + e.testo); }
    });
    seg.appendChild(bt);
    var vis = el('button', 'vista-mazzo', aCarte ? 'List' : 'Cards');
    vis.addEventListener('click', function () { self.pr.d.imp.mazzoCarte = !aCarte; self.pr.salva(); self.disegna(); });
    seg.appendChild(vis);
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
  // ordine), Spare (solo le carte non ancora nel mazzo) e la X che azzera tutto.
  var TIPI_F = [['b', 'Bricks'], ['g', 'Gems'], ['r', 'Recruits'], ['m', 'Mixed'], ['z', 'Free']];
  var ICO_T = { b: 'brick-pile', g: 'crystal-growth', r: 'crested-helmet' };
  var ORDINI = [['rar', 'Rarity'], ['costo', 'Cost'], ['nome', 'Name']];
  var NESSUNA = '(none)';
  function totale(d) { return d.costo.b + d.costo.g + d.costo.r; }
  function alterna(a, x) { var i = a.indexOf(x); if (i >= 0) a.splice(i, 1); else a.push(x); }
  function icoTipo(k) {
    return ICO_T[k] ? UI.icona(ICO_T[k]) : k === 'm' ? '<i class="tre"><u class="b"></u><u class="g"></u><u class="r"></u></i>' : '<i class="zero">0</i>';
  }

  Editor.prototype.quantiFiltri = function () {
    var F = this.F;
    return F.rar.length + F.tipi.length + F.kw.length + (F.q.trim() ? 1 : 0) + (F.fuori ? 1 : 0);
  };

  Editor.prototype.carteFiltrate = function (dentro) {
    var F = this.F, q = F.q.trim().toLowerCase();
    return this.pr.d.collezione.map(UI.dati).filter(function (d) {
      if (F.rar.length && F.rar.indexOf(d.rarita) < 0) return false;
      if (F.tipi.length && F.tipi.indexOf(UI.tipo(d)) < 0) return false;
      if (F.kw.length && !F.kw.some(function (k) { return k === NESSUNA ? !d.keyword.length : d.keyword.map(UI.kwNome).indexOf(k) >= 0; })) return false;
      if (F.fuori && dentro[d.id]) return false;
      if (q && d.nome.toLowerCase().indexOf(q) < 0 && d.effetto.toLowerCase().indexOf(q) < 0 && d.kw.toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) {
      var ra = 'CUR'.indexOf(a.rarita) - 'CUR'.indexOf(b.rarita), ca = totale(a) - totale(b), na = a.nome.localeCompare(b.nome);
      if (F.ordina === 'costo') return ca || ra || na;
      if (F.ordina === 'nome') return na;
      return ra || ca || na;
    });
  };

  Editor.prototype.impostaFiltri = function () {
    var self = this, f = this.s.querySelector('.filtri');
    f.innerHTML = '<label class="cerca">' + '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>' + '<input type="search" placeholder="Search" enterkeyhint="search" autocomplete="off"></label>' +
      '<button class="apri-filtri">Filters<b class="n"></b></button><button class="spare">Spare</button>' +
      '<button class="azzera" aria-label="Clear filters">×</button>';
    var inp = f.querySelector('input');
    inp.value = this.F.q;
    inp.addEventListener('input', function () { self.F.q = inp.value; self.disegna(); });
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') inp.blur(); });
    f.querySelector('.apri-filtri').addEventListener('click', function () { self.pannelloFiltri(); });
    f.querySelector('.spare').addEventListener('click', function () { self.F.fuori = !self.F.fuori; self.disegna(); });
    f.querySelector('.azzera').addEventListener('click', function () {
      var F = self.F; F.q = ''; F.rar.length = 0; F.tipi.length = 0; F.kw.length = 0; F.fuori = false;
      inp.value = ''; self.disegna();
    });
  };

  // solo lo stato dei pulsanti: la barra non si ridisegna, cosi' la casella di ricerca non perde il cursore
  Editor.prototype.statoFiltri = function () {
    var f = this.s.querySelector('.filtri'), F = this.F, n = F.rar.length + F.tipi.length + F.kw.length;
    f.querySelector('.apri-filtri').classList.toggle('su', n > 0);
    f.querySelector('.apri-filtri .n').textContent = n ? n : '';
    f.querySelector('.spare').classList.toggle('su', F.fuori);
    f.querySelector('.azzera').hidden = !this.quantiFiltri();
  };

  Editor.prototype.pannelloFiltri = function () {
    var self = this, F = this.F, v = el('div', 'velo-filtri'), p = el('div', 'pannello pannello-filtri');
    // keyword presenti nella collezione, con quante carte ne hanno
    var conta = {}, senza = 0;
    this.pr.d.collezione.forEach(function (id) {
      var d = UI.dati(id);
      if (!d.keyword.length) senza++;
      d.keyword.map(UI.kwNome).filter(function (k, i, l) { return l.indexOf(k) === i; }).forEach(function (k) { if (k !== 'Forbidden') conta[k] = (conta[k] || 0) + 1; });
    });
    var kws = Object.keys(conta).sort();
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
    kws.concat([NESSUNA]).forEach(function (n) {
      var html = n === NESSUNA ? 'No keyword <small>' + senza + '</small>' : '<img src="' + UI.kwIcona(n) + '" alt="">' + n + ' <small>' + conta[n] + '</small>';
      k[1].appendChild(gett(html, 'kw-g', function () { return F.kw.indexOf(n) >= 0; }, function () { alterna(F.kw, n); }));
    });
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
