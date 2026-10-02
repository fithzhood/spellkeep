// Profilo del giocatore: monete, collezione, mazzi, avversari sbloccati, negozio, impostazioni.
// Tutto sta in localStorage sotto una chiave sola, e si salva a ogni cambiamento.
(function (radice) {
  'use strict';
  var CHIAVE = 'arcomage.profilo';
  var VERSIONE = 1;

  // ------------------------------------------------------------------ economia (si tara qui)
  var ECONOMIA = {
    monetePartenza: 60,
    vittoria: 30, sconfitta: 8, pareggio: 12,         // contro la CPU normale
    moltiplicaLunga: 1.5,                             // partita lunga
    sfide: { Grofgul: 90, Marquis: 100, Demetrios: 110, Sophie: 120, Myr: 130, Duroth: 150, Gilgamesh: 180 },
    prezzoCarta: { C: 12, U: 30, R: 70 },
    prezzoSlot: function (slot) { return 100 + 50 * (slot - 1); },   // slot = quanti ne hai gia'
    prezzoSfida: function (nome) { return Math.round((ECONOMIA.sfide[nome] || 100) * 1.1); },
    cartePerNegozio: 5,
    probRarita: { C: 65, U: 29, R: 6 },              // come la pescata dal mazzo
    slotPartenza: 1, slotMassimi: 8
  };

  function Profilo(dati) { this.d = dati; }

  function mescola(l, caso) {
    for (var i = l.length - 1; i > 0; i--) { var j = Math.floor(caso() * (i + 1)), t = l[i]; l[i] = l[j]; l[j] = t; }
    return l;
  }
  function vendibili(r) {
    return Motore.catalogo.lista.filter(function (d) { return d.rarita === r && d.kw.indexOf('Forbidden') < 0; }).map(function (d) { return d.id; });
  }

  Profilo.nuovo = function (caso) {
    caso = caso || Math.random;
    var coll = [], mazzo = { nome: 'Starter deck', C: [], U: [], R: [], segnalini: [] };
    ['C', 'U', 'R'].forEach(function (r) {
      var scelte = mescola(vendibili(r), caso).slice(0, 15);
      coll = coll.concat(scelte);
      mazzo[r] = scelte.slice();
    });
    mazzo.segnalini = Motore.segnaliniAuto(mazzo);
    var p = new Profilo({
      versione: VERSIONE, monete: ECONOMIA.monetePartenza, collezione: coll,
      mazzi: [mazzo], slot: ECONOMIA.slotPartenza, mazzoAttivo: 0,
      sfide: [],                                  // nomi delle sfide sbloccate
      negozio: null,
      stat: { vinte: 0, perse: 0, pari: 0, partite: 0, sfideVinte: {} },
      imp: { nascoste: true, lunga: false },
      partita: null                               // partita in corso salvata
    });
    p.rinnovaNegozio(caso);
    return p;
  };
  Profilo.carica = function () {
    try {
      var s = localStorage.getItem(CHIAVE);
      if (s) { var d = JSON.parse(s); if (d && d.versione === VERSIONE) return new Profilo(d); }
    } catch (e) { /* profilo illeggibile: si riparte */ }
    var p = Profilo.nuovo(); p.salva(); return p;
  };
  Profilo.prototype.salva = function () {
    try { localStorage.setItem(CHIAVE, JSON.stringify(this.d)); } catch (e) { /* spazio pieno o storage negato */ }
  };
  Profilo.prototype.azzera = function () { var n = Profilo.nuovo(); this.d = n.d; this.salva(); };

  Profilo.prototype.possiede = function (id) { return this.d.collezione.indexOf(id) >= 0; };
  Profilo.prototype.mazzo = function (i) { return this.d.mazzi[i === undefined ? this.d.mazzoAttivo : i]; };
  Profilo.prototype.mazzoValido = function (m) {
    m = m || this.mazzo();
    return !!m && ['C', 'U', 'R'].every(function (r) { return m[r].length === 15; });
  };

  // ------------------------------------------------------------------ fine partita
  // esito: 1 vinta, 2 persa, 0 pari. Restituisce le monete guadagnate.
  Profilo.prototype.registraPartita = function (esito, opz) {
    var e = ECONOMIA, premio;
    if (opz.sfida) premio = esito === 1 ? e.sfide[opz.sfida] || 100 : esito === 0 ? e.pareggio : e.sconfitta;
    else premio = esito === 1 ? e.vittoria : esito === 0 ? e.pareggio : e.sconfitta;
    if (opz.lunga) premio = Math.round(premio * e.moltiplicaLunga);
    this.d.monete += premio;
    var s = this.d.stat;
    s.partite++;
    if (esito === 1) s.vinte++; else if (esito === 2) s.perse++; else s.pari++;
    if (esito === 1 && opz.sfida) s.sfideVinte[opz.sfida] = (s.sfideVinte[opz.sfida] || 0) + 1;
    this.d.partita = null;
    this.rinnovaNegozio();
    this.salva();
    return premio;
  };

  // ------------------------------------------------------------------ negozio
  // 5 carte non ancora possedute: la rarita' si estrae come dal mazzo (65/29/6); se quella rarita' e'
  // esaurita si sale alla successiva, cosi' il negozio migliora da solo man mano che la collezione cresce.
  Profilo.prototype.rinnovaNegozio = function (caso) {
    caso = caso || Math.random;
    var self = this, e = ECONOMIA;
    var pool = {};
    ['C', 'U', 'R'].forEach(function (r) { pool[r] = mescola(vendibili(r).filter(function (id) { return !self.possiede(id); }), caso); });
    var carte = [];
    for (var i = 0; i < e.cartePerNegozio; i++) {
      var x = caso() * 100, r = x < e.probRarita.C ? 'C' : x < e.probRarita.C + e.probRarita.U ? 'U' : 'R';
      var ordine = { C: ['C', 'U', 'R'], U: ['U', 'R', 'C'], R: ['R', 'U', 'C'] }[r];
      for (var k = 0; k < 3; k++) { if (pool[ordine[k]].length) { carte.push(pool[ordine[k]].pop()); break; } }
    }
    var bloccate = (window.SFIDE || []).map(function (s) { return s.nome; }).filter(function (n) { return self.d.sfide.indexOf(n) < 0; });
    this.d.negozio = {
      carte: carte, vendute: [],
      sfida: bloccate.length ? bloccate[Math.floor(caso() * bloccate.length)] : null
    };
  };
  Profilo.prototype.prezzoCarta = function (id) { return ECONOMIA.prezzoCarta[Motore.catalogo.perId[id].rarita]; };
  Profilo.prototype.prezzoSlot = function () { return ECONOMIA.prezzoSlot(this.d.slot); };
  Profilo.prototype.prezzoSfida = function (n) { return ECONOMIA.prezzoSfida(n); };
  Profilo.prototype.compraCarta = function (id) {
    var n = this.d.negozio, prezzo = this.prezzoCarta(id);
    if (!n || n.carte.indexOf(id) < 0 || n.vendute.indexOf(id) >= 0) return 'Not on sale';
    if (this.d.monete < prezzo) return 'Not enough coins';
    this.d.monete -= prezzo; this.d.collezione.push(id); n.vendute.push(id);
    this.salva(); return null;
  };
  Profilo.prototype.compraSlot = function () {
    var prezzo = this.prezzoSlot();
    if (this.d.slot >= ECONOMIA.slotMassimi) return 'All deck slots unlocked';
    if (this.d.monete < prezzo) return 'Not enough coins';
    this.d.monete -= prezzo; this.d.slot++;
    this.d.mazzi.push({ nome: 'Deck ' + this.d.slot, C: [], U: [], R: [], segnalini: [] });
    this.salva(); return null;
  };
  Profilo.prototype.compraSfida = function () {
    var n = this.d.negozio, nome = n && n.sfida;
    if (!nome) return 'Nothing to unlock';
    var prezzo = this.prezzoSfida(nome);
    if (this.d.monete < prezzo) return 'Not enough coins';
    this.d.monete -= prezzo; this.d.sfide.push(nome); n.sfida = null;
    this.salva(); return null;
  };

  // ------------------------------------------------------------------ mazzi
  Profilo.prototype.aggiungiAlMazzo = function (i, id) {
    var m = this.mazzo(i), d = Motore.catalogo.perId[id];
    if (!this.possiede(id)) return 'Not in your collection';
    if (d.kw.indexOf('Forbidden') >= 0) return 'Forbidden cards cannot be used in a deck';
    if (m[d.rarita].indexOf(id) >= 0) return 'Already in the deck';
    if (m[d.rarita].length >= 15) return { C: 'Common', U: 'Uncommon', R: 'Rare' }[d.rarita] + ' section is full';
    m[d.rarita].push(id);
    m.segnalini = Motore.segnaliniAuto(m);
    this.salva(); return null;
  };
  Profilo.prototype.togliDalMazzo = function (i, id) {
    var m = this.mazzo(i), r = Motore.catalogo.perId[id].rarita, k = m[r].indexOf(id);
    if (k >= 0) { m[r].splice(k, 1); m.segnalini = Motore.segnaliniAuto(m); this.salva(); }
  };

  radice.Profilo = Profilo;
  radice.ECONOMIA = ECONOMIA;
})(window);
