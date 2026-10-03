// Editor dei mazzi: collezione a sinistra (con filtri), mazzo a destra diviso per rarita', segnalini.
// Tocco = aggiungi/togli, tocco lungo = carta grande.
(function (radice) {
  'use strict';
  var el = UI.el;
  var RARITA = { C: 'Common', U: 'Uncommon', R: 'Rare' };
  var TIPI = [['tutti', 'All', ''], ['b', '', 'var(--mat)'], ['g', '', 'var(--gem)'], ['r', '', 'var(--rec)'], ['m', '', 'var(--mix)'], ['z', '', 'var(--zero)']];

  function Editor(app, indice) {
    this.app = app; this.pr = app.profilo; this.i = indice || 0;
    this.filtroR = 'tutti'; this.filtroT = 'tutti'; this.scheda = 'C'; this.soloFuori = false;
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
    s.querySelector('.indietro').addEventListener('click', function () { self.app.home(); });
    s.querySelector('.vista').addEventListener('click', function () { self.pr.d.imp.testo = !self.pr.d.imp.testo; self.pr.salva(); self.disegna(); });
    s.querySelector('h2').addEventListener('click', function () {
      var m = self.pr.mazzo(self.i), nome = window.prompt('Deck name', m.nome);
      if (nome && nome.trim()) { m.nome = nome.trim().slice(0, 24); self.pr.salva(); self.disegna(); }
    });
    this.impostaGriglia();
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
    // filtri
    var f = s.querySelector('.filtri'); f.innerHTML = '';
    [['tutti', 'All'], ['C', 'C'], ['U', 'U'], ['R', 'R']].forEach(function (x) {
      var b = el('button', self.filtroR === x[0] ? 'su' : '', x[0] === 'tutti' ? x[1] : '<span class="rombo ' + x[0] + '"></span>' + x[1]);
      b.addEventListener('click', function () { self.filtroR = x[0]; self.disegna(); });
      f.appendChild(b);
    });
    TIPI.forEach(function (x) {
      var b = el('button', self.filtroT === x[0] ? 'su' : '', x[2] ? '<span class="pallino" style="background:' + x[2] + '"></span>' : x[1]);
      b.setAttribute('aria-label', x[0]);
      b.addEventListener('click', function () { self.filtroT = x[0]; self.disegna(); });
      f.appendChild(b);
    });
    var fuori = el('button', this.soloFuori ? 'su' : '', 'Spare');
    fuori.addEventListener('click', function () { self.soloFuori = !self.soloFuori; self.disegna(); });
    f.appendChild(fuori);
    if (!f.sfumata) { UI.sfuma(f); f.sfumata = true; }

    // griglia della collezione, ordinata per rarita' e costo
    var g = s.querySelector('.griglia'), dentro = {};
    ['C', 'U', 'R'].forEach(function (r) { m[r].forEach(function (id) { dentro[id] = 1; }); });
    var carte = this.pr.d.collezione.map(UI.dati).filter(function (d) {
      if (self.filtroR !== 'tutti' && d.rarita !== self.filtroR) return false;
      if (self.filtroT !== 'tutti' && UI.tipo(d) !== self.filtroT) return false;
      if (self.soloFuori && dentro[d.id]) return false;
      return true;
    }).sort(function (a, b) {
      var ra = 'CUR'.indexOf(a.rarita), rb = 'CUR'.indexOf(b.rarita);
      if (ra !== rb) return ra - rb;
      var ca = a.costo.b + a.costo.g + a.costo.r, cb = b.costo.b + b.costo.g + b.costo.r;
      return ca - cb || a.nome.localeCompare(b.nome);
    });
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
        RARITA[r] + ' <span class="' + (n === 15 ? 'pieno' : 'vuoto') + '">' + n + '/15</span>');
      b.addEventListener('click', function () { self.scheda = r; self.disegna(); });
      sch.appendChild(b);
    });
    var righe = s.querySelector('.righe'); righe.innerHTML = '';
    var lista = m[this.scheda].map(UI.dati).sort(function (a, b) { return (a.costo.b + a.costo.g + a.costo.r) - (b.costo.b + b.costo.g + b.costo.r) || a.nome.localeCompare(b.nome); });
    if (!lista.length) righe.appendChild(el('div', 'vuoto-msg', 'Tap cards on the left to add them.'));
    lista.forEach(function (d) {
      var costi = ['b', 'g', 'r'].filter(function (n) { return d.costo[n] > 0; }).map(function (n) { return '<span class="costo ' + n + '">' + d.costo[n] + '</span>'; }).join('') || '<span class="costo z">0</span>';
      var r = el('button', 'riga-carta', '<span class="costi">' + costi + '</span><span class="nome">' + d.nome + '</span>');
      r.addEventListener('click', function () { self.lente(d.id); });
      righe.appendChild(r);
    });
    // segnalini: tocco = passa alla keyword successiva fra quelle con segnalino
    var seg = s.querySelector('.segnalini-mazzo'); seg.innerHTML = '<span class="etic">Tokens</span>';
    var t = (m.segnalini || []).slice(); while (t.length < 3) t.push('none');
    t.forEach(function (nome, k) {
      var b = el('button', '', nome === 'none' ? '—' : '<img src="' + UI.kwIcona(nome) + '" alt="">' + nome);
      b.addEventListener('click', function () {
        var giro = ['none'].concat(Motore.SEGNALINI), j = giro.indexOf(nome), prossimo;
        do { j = (j + 1) % giro.length; prossimo = giro[j]; } while (prossimo !== 'none' && t.indexOf(prossimo) >= 0);
        t[k] = prossimo;
        m.segnalini = t.filter(function (x) { return x !== 'none'; });
        self.pr.salva(); self.disegna();
      });
      seg.appendChild(b);
    });
  };

  // un tocco apre la carta (con Aggiungi/Togli); il trascinamento fa solo scorrere la griglia
  Editor.prototype.impostaGriglia = function () {
    var self = this, g = this.s.querySelector('.griglia'), partito = null;
    g.addEventListener('pointerdown', function (ev) {
      var c = ev.target.closest('.carta'); if (!c) return;
      partito = { x: ev.clientX, y: ev.clientY, id: +c.dataset.id };
    });
    g.addEventListener('pointermove', function (ev) {
      if (partito && (Math.abs(ev.clientX - partito.x) > 10 || Math.abs(ev.clientY - partito.y) > 10)) partito = null;
    });
    g.addEventListener('pointerup', function () { var p = partito; partito = null; if (p) self.lente(p.id); });
    g.addEventListener('pointercancel', function () { partito = null; });
    g.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
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
