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
    premioMedio: 55,                                  // vittoria contro un rivale (fascia media)
    prezzoCarta: { C: 12, U: 30, R: 70 },
    prezzoSlot: function (slot) { return 100 + 50 * (slot - 1); },   // slot = quanti ne hai gia'
    prezzoSfida: function (nome) { return Math.round(avversario(nome).premio * 1.1); },
    cartePerNegozio: 5,
    probRarita: { C: 65, U: 29, R: 6 },              // come la pescata dal mazzo
    slotPartenza: 1, slotMassimi: 30,
    // booster: tre carte. Rarita' estratte come dal mazzo (probRarita), tranne il booster raro (tre rare).
    prezzoBooster: 40, prezzoBoosterRaro: 150,
    boosterPerNegozio: 3, boosterPremio: 3,           // nel negozio, e fra cui scegliere dopo una vittoria
    probBoosterRaro: 0.05,                            // per ogni posto: quanto spesso esce il booster raro
    rivendita: { C: 4, U: 10, R: 25 },                // una carta doppia trovata in un booster si rivende da sola
    // traguardi (richiesta di Luca, 4/10, "sii generoso"): prima vittoria contro un avversario = il doppio della sua
    // vincita in piu' e un booster in regalo; fascia completata e tutti battuti = monete e booster rari in regalo
    primaVittoria: { moltiplica: 2, booster: 1 },
    fascia: { base: { monete: 300, booster: 2 }, rivale: { monete: 1500, booster: 3 }, sfidante: { monete: 2500, booster: 3 } },
    tutti: { monete: 5000, booster: 5 }
  };
  var NOMI_FASCIA = { base: 'Basic', rivale: 'Medium', sfidante: 'Advanced' };

  // ------------------------------------------------------------------ avversari
  // Tre fasce (scelta di Luca, 3/10/2026), senza livelli dentro la fascia:
  //  - BASE: il giullare (mazzo casuale) e i tre mazzi di partenza di MArcomage; sbloccati, CPU originale;
  //  - MEDIA: i rivali per tribu' (dati/rivali.js, mazzi legali); si sbloccano nel negozio, CPU nuova (Ashkar: Titano);
  //  - AVANZATA: gli sfidanti dell'originale (castelli e mazzi speciali, fortissimi), dopo tutta la fascia media.
  var GIULLARE = { nome: null, titolo: 'The Jester', tipo: 'base', mazzoCasuale: true, avatar: 'giullare',
    descrizione: 'A wandering fool with a deck of random cards. Nobody knows what he will play next, not even him.' };
  function avversari() {
    var l = [Object.assign({ premio: ECONOMIA.vittoria }, GIULLARE)];
    (window.MAZZI_BASE || []).forEach(function (b) {
      l.push({ nome: b.nome, titolo: b.titolo, tipo: 'base', avatar: b.nome.toLowerCase(), descrizione: b.descrizione,
        mazzo: b.mazzo, premio: ECONOMIA.vittoria });
    });
    (window.RIVALI || []).forEach(function (r) {
      l.push({ nome: r.nome, titolo: r.titolo, tipo: 'rivale', avatar: r.nome.toLowerCase(), descrizione: r.descrizione,
        tribu: r.tribu, cpu: r.cpu, mazzo: r.mazzo, premio: ECONOMIA.premioMedio });
    });
    (window.SFIDE || []).forEach(function (s) {
      l.push({ nome: s.nome, titolo: s.titolo, tipo: 'sfidante', avatar: s.nome.toLowerCase(), descrizione: s.descrizione,
        sfida: s, premio: ECONOMIA.sfide[s.nome] || 100 });
    });
    return l;
  }
  function avversario(nome) {
    return avversari().filter(function (a) { return a.nome === (nome || null); })[0] || avversari()[0];
  }

  function Profilo(dati) { this.d = dati; }

  function mescola(l, caso) {
    for (var i = l.length - 1; i > 0; i--) { var j = Math.floor(caso() * (i + 1)), t = l[i]; l[i] = l[j]; l[j] = t; }
    return l;
  }
  function vendibili(r) {
    return Motore.catalogo.lista.filter(function (d) { return d.rarita === r && d.kw.indexOf('Forbidden') < 0; }).map(function (d) { return d.id; });
  }

  // ------------------------------------------------------------------ booster
  // Un tipo per ogni keyword (tranne Forbidden e Flare blitz), uno per le carte senza keyword, uno per colore di
  // costo (rosso = mattoni, blu = gemme, verde = reclute, bianco = costo zero, multicolore = misto) e il raro.
  // Le carte Forbidden non escono mai: nei mazzi non si possono usare.
  var TIPI_BOOSTER = null;
  function tipoCosto(d) {
    var k = ['b', 'g', 'r'].filter(function (n) { return d.costo[n] > 0; });
    return k.length === 0 ? 'z' : k.length > 1 ? 'm' : k[0];
  }
  function nomeKw(k) { return k.replace(/\s*\(.*\)$/, ''); }
  function tipiBooster() {
    if (TIPI_BOOSTER) return TIPI_BOOSTER;
    var l = [];
    (window.KEYWORD || []).map(function (k) { return k.nome; }).filter(function (n) { return n !== 'Forbidden' && n !== 'Flare blitz'; })
      .sort().forEach(function (n) {
        l.push({ id: 'kw-' + n.toLowerCase().replace(/ /g, '_'), nome: n, kw: n,
          filtro: function (d) { return d.keyword.some(function (k) { return nomeKw(k) === n; }); } });
      });
    l.push({ id: 'senza', nome: 'No keyword', filtro: function (d) { return !d.keyword.length; } });
    [['b', 'Red'], ['g', 'Blue'], ['r', 'Green'], ['z', 'White'], ['m', 'Multicolor']].forEach(function (c) {
      l.push({ id: 'col-' + c[0], nome: c[1], costo: c[0], filtro: function (d) { return tipoCosto(d) === c[0]; } });
    });
    l.push({ id: 'raro', nome: 'Rare', raro: true, filtro: function (d) { return d.rarita === 'R'; } });
    TIPI_BOOSTER = l;
    return l;
  }
  function tipoBooster(id) { return tipiBooster().filter(function (b) { return b.id === id; })[0]; }
  // n tipi diversi; il raro esce di rado
  function estraiTipi(n, caso) {
    caso = caso || Math.random;
    var comuni = mescola(tipiBooster().filter(function (b) { return !b.raro; }).map(function (b) { return b.id; }), caso), out = [];
    for (var i = 0; i < n; i++) out.push(out.indexOf('raro') < 0 && caso() < ECONOMIA.probBoosterRaro ? 'raro' : comuni.pop());
    return out;
  }
  // tre carte diverse del tipo: la rarita' si estrae come dal mazzo e, se quel tipo non ne ha piu', si passa
  // alla vicina (come nel negozio). Il booster raro da' tre rare.
  function estraiCarte(id, caso) {
    caso = caso || Math.random;
    var b = tipoBooster(id), e = ECONOMIA, pool = { C: [], U: [], R: [] }, carte = [];
    Motore.catalogo.lista.forEach(function (d) { if (d.kw.indexOf('Forbidden') < 0 && b.filtro(d)) pool[d.rarita].push(d.id); });
    ['C', 'U', 'R'].forEach(function (r) { mescola(pool[r], caso); });
    for (var i = 0; i < 3; i++) {
      var r = 'R';
      if (!b.raro) { var x = caso() * 100; r = x < e.probRarita.C ? 'C' : x < e.probRarita.C + e.probRarita.U ? 'U' : 'R'; }
      var ordine = { C: ['C', 'U', 'R'], U: ['U', 'R', 'C'], R: ['R', 'U', 'C'] }[r];
      for (var k = 0; k < 3; k++) { if (pool[ordine[k]].length) { carte.push(pool[ordine[k]].pop()); break; } }
    }
    return carte;
  }

  // quante carte di un tipo di booster sono gia' nella collezione, su quante ne puo' dare (totale e per rarita')
  function contaBooster(id, collezione) {
    var b = tipoBooster(id), ho = {}, r = { tot: 0, ho: 0, C: [0, 0], U: [0, 0], R: [0, 0] };
    (collezione || []).forEach(function (x) { ho[x] = 1; });
    Motore.catalogo.lista.forEach(function (d) {
      if (d.kw.indexOf('Forbidden') >= 0 || !b.filtro(d)) return;
      r.tot++; r[d.rarita][1]++;
      if (ho[d.id]) { r.ho++; r[d.rarita][0]++; }
    });
    return r;
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
      if (s) {
        var d = JSON.parse(s);
        if (d && d.versione === VERSIONE) {
          // profili di prima dei booster: il negozio in corso li riceve subito
          if (d.negozio && !d.negozio.booster) { d.negozio.booster = estraiTipi(ECONOMIA.boosterPerNegozio); d.negozio.aperti = []; }
          return new Profilo(d);
        }
      }
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
  // chiave di un avversario nelle statistiche (il giullare non ha nome)
  function chiaveAvv(nome) { return nome || 'Jester'; }
  Profilo.prototype.battuto = function (nome) { return (this.d.stat.sfideVinte[chiaveAvv(nome)] || 0); };
  // per fascia: quanti battuti su quanti, e se il premio e' gia' stato dato
  Profilo.prototype.fasce = function () {
    var self = this, r = {};
    avversari().forEach(function (a) {
      var f = r[a.tipo] = r[a.tipo] || { tot: 0, battuti: 0, nome: NOMI_FASCIA[a.tipo], premio: ECONOMIA.fascia[a.tipo] };
      f.tot++; if (self.battuto(a.nome)) f.battuti++;
    });
    var dati = this.d.traguardi || {};
    Object.keys(r).forEach(function (k) { r[k].dato = !!dati[k]; });
    return r;
  };
  // dopo una vittoria: prima vittoria, fasce completate, tutti battuti. Restituisce l'elenco dei bonus dati.
  Profilo.prototype.traguardi = function (nome, prima, lunga) {
    var self = this, e = ECONOMIA, bonus = [], t = this.d.traguardi = this.d.traguardi || {};
    this.d.regali = this.d.regali || [];
    if (prima) {
      var m = avversario(nome).premio * e.primaVittoria.moltiplica;
      if (lunga) m = Math.round(m * e.moltiplicaLunga);
      bonus.push({ testo: 'First victory against ' + avversario(nome).titolo, monete: m, booster: e.primaVittoria.booster, comune: true });
    }
    var fasce = this.fasce(), tutte = true;
    Object.keys(fasce).forEach(function (k) {
      var f = fasce[k];
      if (f.battuti < f.tot) { tutte = false; return; }
      if (t[k]) return;
      t[k] = true;
      bonus.push({ testo: f.nome + ' tier complete!', monete: f.premio.monete, booster: f.premio.booster });
    });
    if (tutte && !t.tutti) {
      t.tutti = true;
      bonus.push({ testo: 'Every opponent beaten!', monete: e.tutti.monete, booster: e.tutti.booster });
    }
    bonus.forEach(function (b) {
      self.d.monete += b.monete;
      for (var i = 0; i < b.booster; i++) self.d.regali.push(b.comune ? estraiTipi(1)[0] : 'raro');
    });
    return bonus;
  };
  // booster in regalo (traguardi): si aprono uno alla volta
  Profilo.prototype.apriRegalo = function () {
    if (!this.d.regali || !this.d.regali.length) return null;
    var tipo = this.d.regali.shift();
    return { tipo: tipo, esito: this.apriBooster(tipo) };
  };

  Profilo.prototype.registraPartita = function (esito, opz) {
    var e = ECONOMIA, premio;
    if (opz.sfida) premio = esito === 1 ? avversario(opz.sfida).premio : esito === 0 ? e.pareggio : e.sconfitta;
    else premio = esito === 1 ? e.vittoria : esito === 0 ? e.pareggio : e.sconfitta;
    if (opz.lunga) premio = Math.round(premio * e.moltiplicaLunga);
    this.d.monete += premio;
    var s = this.d.stat;
    s.partite++;
    if (esito === 1) s.vinte++; else if (esito === 2) s.perse++; else s.pari++;
    var prima = esito === 1 && !this.battuto(opz.sfida);
    if (esito === 1) s.sfideVinte[chiaveAvv(opz.sfida)] = (s.sfideVinte[chiaveAvv(opz.sfida)] || 0) + 1;
    this.ultimiBonus = esito === 1 ? this.traguardi(opz.sfida, prima, opz.lunga) : [];
    // dopo una vittoria: tre booster fra cui sceglierne uno. Resta in attesa finche' non lo si apre.
    if (esito === 1) this.d.premio = estraiTipi(ECONOMIA.boosterPremio);
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
    var chiusi = avversari().filter(function (a) { return a.tipo !== 'base' && self.d.sfide.indexOf(a.nome) < 0; });
    var rivali = chiusi.filter(function (a) { return a.tipo === 'rivale'; });
    var bloccate = (rivali.length ? rivali : chiusi).map(function (a) { return a.nome; });
    this.d.negozio = {
      carte: carte, vendute: [],
      booster: estraiTipi(e.boosterPerNegozio, caso), aperti: [],
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

  // apre un booster: le carte nuove entrano nella collezione, le doppie si rivendono da sole.
  // Restituisce [{ id, doppia, rimborso }].
  Profilo.prototype.apriBooster = function (tipo) {
    var self = this, visti = {};
    var esito = estraiCarte(tipo).map(function (id) {
      var r = Motore.catalogo.perId[id].rarita, doppia = self.possiede(id) || visti[id];
      visti[id] = 1;
      if (doppia) { self.d.monete += ECONOMIA.rivendita[r]; return { id: id, doppia: true, rimborso: ECONOMIA.rivendita[r] }; }
      self.d.collezione.push(id);
      return { id: id, doppia: false, rimborso: 0 };
    });
    var st = this.d.stat;
    st.booster = (st.booster || 0) + 1;
    this.salva();
    return esito;
  };
  Profilo.prototype.prezzoBooster = function (tipo) { return tipo === 'raro' ? ECONOMIA.prezzoBoosterRaro : ECONOMIA.prezzoBooster; };
  // il booster scelto fra quelli del premio: il premio si consuma
  Profilo.prototype.scegliPremio = function (tipo) {
    if (!this.d.premio || this.d.premio.indexOf(tipo) < 0) return null;
    this.d.premio = null;
    return this.apriBooster(tipo);
  };
  // i booster del negozio si possono comprare tutti; i restituisce l'esito, o una stringa d'errore
  Profilo.prototype.compraBooster = function (i) {
    var n = this.d.negozio, tipo = n && n.booster && n.booster[i];
    if (!tipo || n.aperti.indexOf(i) >= 0) return 'Not on sale';
    var prezzo = this.prezzoBooster(tipo);
    if (this.d.monete < prezzo) return 'Not enough coins';
    this.d.monete -= prezzo; n.aperti.push(i);
    return this.apriBooster(tipo);
  };

  // ------------------------------------------------------------------ mazzi
  Profilo.prototype.aggiungiAlMazzo = function (i, id) {
    var m = this.mazzo(i), d = Motore.catalogo.perId[id];
    if (!this.possiede(id)) return 'Not in your collection';
    if (d.kw.indexOf('Forbidden') >= 0) return 'Forbidden cards cannot be used in a deck';
    if (m[d.rarita].indexOf(id) >= 0) return 'Already in the deck';
    // oltre 15 si puo' andare mentre si costruisce (mazzoValido decide se si gioca); un tetto solo contro gli eccessi
    if (m[d.rarita].length >= 40) return 'Too many ' + { C: 'common', U: 'uncommon', R: 'rare' }[d.rarita] + ' cards';
    m[d.rarita].push(id);
    if (!m.segnaliniScelti) m.segnalini = Motore.segnaliniAuto(m);    // quello scelto a mano resta
    this.salva(); return null;
  };
  Profilo.prototype.togliDalMazzo = function (i, id) {
    var m = this.mazzo(i), r = Motore.catalogo.perId[id].rarita, k = m[r].indexOf(id);
    if (k >= 0) { m[r].splice(k, 1); if (!m.segnaliniScelti) m.segnalini = Motore.segnaliniAuto(m); this.salva(); }
  };

  radice.Profilo = Profilo;
  radice.ECONOMIA = ECONOMIA;
  radice.Avversari = { tutti: avversari, trova: avversario };
  radice.Booster = { tipi: tipiBooster, tipo: tipoBooster, estraiTipi: estraiTipi, estraiCarte: estraiCarte, tipoCosto: tipoCosto, conta: contaBooster };
})(window);
