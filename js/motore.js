// Motore di gioco: traduzione fedele di GameUseCard.php, CGamePlayerData.php, CDeckData.php e
// GameProduction.php dell'originale. Il codice delle carte e delle keyword gira nell'interprete
// PHP (php.js) cosi' com'e' scritto nel database originale; i nomi dei metodi qui sotto sono quelli
// che quel codice chiama, e per questo restano in inglese.
(function (radice) {
  'use strict';
  var PHP = radice.PHP || (typeof require !== 'undefined' ? require('./php.js') : null);
  var PArr = PHP.PArr;

  // ------------------------------------------------------------------ caso con seme (sfc32)
  function Caso(seme) {
    var s = seme >>> 0 || 1;
    this.s = [0x9e3779b9 ^ s, 0x243f6a88 + s, 0xb7e15162 ^ (s << 7), s ^ 0x85ebca6b];
    for (var i = 0; i < 12; i++) this.prossimo();
  }
  Caso.prototype.prossimo = function () {
    var a = this.s[0] >>> 0, b = this.s[1] >>> 0, c = this.s[2] >>> 0, d = this.s[3] >>> 0;
    var t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
    this.s = [a, b, c, d];
    return (t >>> 0) / 4294967296;
  };
  Caso.prototype.fn = function () { var self = this; return function () { return self.prossimo(); }; };
  Caso.prototype.clone = function () { var c = Object.create(Caso.prototype); c.s = this.s.slice(); return c; };
  Caso.prototype.intero = function (a, b) { return a + Math.floor(this.prossimo() * (b - a + 1)); };

  // ------------------------------------------------------------------ carte
  var RARITA = { C: 'Common', U: 'Uncommon', R: 'Rare' };
  function Carta(d) {
    this.d = d;
    this.rar = d.id === 0 ? 'None' : RARITA[d.rarita];
  }
  Carta.prototype.id = function () { return this.d.id; };
  Carta.prototype.getRarity = function () { return this.rar; };
  Carta.prototype.hasKeyword = function (k) {
    if (k !== 'any') return this.d.kw.indexOf(PHP.str(k)) >= 0;      // come strpos dell'originale
    return this.d.kw !== '';
  };
  Carta.prototype.isPlayAgainCard = function () { return this.hasKeyword('Quick') || this.hasKeyword('Swift'); };
  Carta.prototype.getResources = function (tipo) {
    tipo = PHP.str(tipo).toLowerCase();
    var c = this.d.costo;
    if (tipo === 'bricks') return c.b; if (tipo === 'gems') return c.g; if (tipo === 'recruits') return c.r;
    return c.b + c.g + c.r;
  };
  Carta.prototype.getData = function (campo) {
    var d = this.d, c = d.costo;
    var v = { id: d.id, name: d.nome, rarity: this.rar, bricks: c.b, gems: c.g, recruits: c.r, modes: d.modi || 0,
      level: d.livello || 0, keywords: d.kw, effect: d.html || '', code: d.codice || '' };
    if (!campo) return PArr.mappa(v);
    return v[PHP.str(campo).toLowerCase()];
  };

  var CATALOGO = { lista: [], perId: {}, carte: {} };
  function caricaCarte(lista) {
    CATALOGO.lista = lista;
    CATALOGO.perId = {};
    CATALOGO.carte = {};
    var vuota = { id: 0, nome: 'Empty', rarita: 'C', costo: { b: 0, g: 0, r: 0 }, modi: 0, kw: '', html: '', codice: '' };
    CATALOGO.perId[0] = vuota; CATALOGO.carte[0] = new Carta(vuota);
    lista.forEach(function (d) { CATALOGO.perId[d.id] = d; CATALOGO.carte[d.id] = new Carta(d); });
  }
  function carta(id) {
    var c = CATALOGO.carte[id];
    if (!c) throw new Error('carta sconosciuta ' + id);
    return c;
  }
  var KEYWORD = {};
  function caricaKeyword(lista) { KEYWORD = {}; lista.forEach(function (k) { KEYWORD[k.nome] = k; }); }

  var SEGNALINI = ['Alliance', 'Barbarian', 'Brigand', 'Beast', 'Burning', 'Holy', 'Mage', 'Soldier', 'Titan', 'Undead', 'Unliving'];
  var ORDINE_KW = ['Alliance', 'Aqua', 'Barbarian', 'Beast', 'Brigand', 'Burning', 'Demonic', 'Destruction', 'Dragon', 'Holy',
    'Illusion', 'Legend', 'Mage', 'Nature', 'Restoration', 'Runic', 'Soldier', 'Titan', 'Undead', 'Unliving', 'Durable',
    'Quick', 'Swift', 'Far sight', 'Banish', 'Skirmisher', 'Horde', 'Rebirth', 'Flare blitz', 'Frenzy', 'Aria', 'Enduring',
    'Charge', 'Siege', 'Cursed', 'Forbidden'];

  // filtri di XmlCard::getList
  function getList(f) {
    var g = function (k) { return f instanceof PArr ? f.get(k) : f[k]; };
    var ha = function (k) { var v = g(k); return v !== null && v !== undefined; };
    var forbidden = ha('forbidden') ? g('forbidden') : false;
    var out = new PArr();
    CATALOGO.lista.forEach(function (d) {
      var c = CATALOGO.carte[d.id], k = d.kw, html = d.html || '', b = d.costo.b, ge = d.costo.g, r = d.costo.r;
      if (ha('name') && d.nome.indexOf(g('name')) < 0) return;
      if (ha('rarity') && c.rar !== g('rarity')) return;
      if (ha('keyword')) {
        var kf = g('keyword');
        if (kf === 'Any keyword') { if (k === '') return; }
        else if (kf === 'No keywords') { if (k !== '') return; }
        else if (k.indexOf(kf) < 0) return;
      }
      if (ha('cost')) {
        var cf = g('cost');
        if (cf === 'Red' && (b === 0 || ge > 0 || r > 0)) return;
        if (cf === 'Blue' && (b > 0 || ge === 0 || r > 0)) return;
        if (cf === 'Green' && (b > 0 || ge > 0 || r === 0)) return;
        if (cf === 'Zero' && (b > 0 || ge > 0 || r > 0)) return;
        if (cf === 'Mixed' && ((b > 0) + (ge > 0) + (r > 0)) < 2) return;
      }
      if (ha('advanced')) { var af = PHP.str(g('advanced')); if (html.indexOf(af) < 0 && html.indexOf(af.toLowerCase()) < 0) return; }
      if (ha('support')) {
        var sf = g('support');
        if (sf === 'Any keyword') { if (html.indexOf('<b>') < 0) return; }
        else if (sf === 'No keywords') { if (html.indexOf('<b>') >= 0) return; }
        else if (html.indexOf('<b>' + sf) < 0) return;
      }
      if (ha('level')) {
        var op = g('level_op') === '=' ? '=' : '<=';
        if (op === '=' ? (d.livello || 0) !== g('level') : (d.livello || 0) > g('level')) return;
      }
      if (!PHP.vero(forbidden) && k.indexOf('Forbidden') >= 0) return;
      out.push(d.id);
    });
    return out;
  }

  // ------------------------------------------------------------------ mazzo (CDeckData)
  function Mazzo(dati, caso) {
    this.Common = PArr.lista(dati.C, 1);
    this.Uncommon = PArr.lista(dati.U, 1);
    this.Rare = PArr.lista(dati.R, 1);
    // un solo segnalino per mazzo (scelta di Luca, 3/10/2026: tre si attivavano di rado); gli altri due posti restano 'none'
    var t = (dati.segnalini || []).slice(0, 1);
    while (t.length < 3) t.push('none');
    this.Tokens = PArr.lista(t, 1);
    this._caso = caso;
  }
  Mazzo.prototype.drawCardRandom = function () {
    var i = this._caso.intero(1, 100);
    if (i <= 65) return this.Common.get(this._caso.intero(1, 15));
    if (i <= 65 + 29) return this.Uncommon.get(this._caso.intero(1, 15));
    return this.Rare.get(this._caso.intero(1, 15));
  };
  Mazzo.prototype.drawCardDifferent = function (id) {
    var c, giri = 0;
    do { c = this.drawCardRandom(); } while (PHP.uguale(c, id) && ++giri < 10000);
    return c;
  };
  Mazzo.prototype.drawCardNoRare = function () {
    var i = this._caso.intero(1, 94);
    if (i <= 65) return this.Common.get(this._caso.intero(1, 15));
    return this.Uncommon.get(this._caso.intero(1, 15));
  };
  Mazzo.prototype.clone = function (caso) {
    var m = Object.create(Mazzo.prototype);
    m.Common = this.Common.clone(); m.Uncommon = this.Uncommon.clone(); m.Rare = this.Rare.clone(); m.Tokens = this.Tokens.clone();
    m._caso = caso; return m;
  };

  // ------------------------------------------------------------------ produzione (GameProduction)
  function Produzione() { this.b = 1; this.g = 1; this.r = 1; }
  Produzione.prototype.bricks = function () { return this.b; };
  Produzione.prototype.gems = function () { return this.g; };
  Produzione.prototype.recruits = function () { return this.r; };
  Produzione.prototype.multiply = function (f, tipo) {
    f = PHP.num(f); tipo = PHP.str(tipo);
    if (f < 0) return this;
    if (tipo === 'Bricks' || tipo === 'Quarry') this.b *= f;
    else if (tipo === 'Gems' || tipo === 'Magic') this.g *= f;
    else if (tipo === 'Recruits' || tipo === 'Dungeons') this.r *= f;
    else { this.b *= f; this.g *= f; this.r *= f; }
    return this;
  };
  Produzione.prototype.multiplyBricks = function (f) { return this.multiply(f, 'Bricks'); };
  Produzione.prototype.multiplyGems = function (f) { return this.multiply(f, 'Gems'); };
  Produzione.prototype.multiplyRecruits = function (f) { return this.multiply(f, 'Recruits'); };

  // ------------------------------------------------------------------ giocatore (CGamePlayerData)
  var ATTR = ['Quarry', 'Magic', 'Dungeons', 'Bricks', 'Gems', 'Recruits', 'Tower', 'Wall'];
  function zeri() { return { Quarry: 0, Magic: 0, Dungeons: 0, Bricks: 0, Gems: 0, Recruits: 0, Tower: 0, Wall: 0 }; }

  function Giocatore(caso) {
    this._caso = caso;
    this.Deck = null; this.Hand = null;
    this.LastCard = null; this.LastMode = null; this.LastAction = null;
    this.NewCards = null; this.Revealed = null; this.Changes = zeri();
    // carte spostate da un rimescolamento o uno scambio (Whirlwind, Magic portal...): solo per l'etichetta New
    // dell'interfaccia. NewCards resta quello dell'originale, perche' alcune carte lo leggono ("If New")
    this.Moved = null;
    this.DisCards = PArr.lista([null, null], 0);
    this.TokenNames = null; this.TokenValues = null; this.TokenChanges = null;
    this.Tower = 0; this.Wall = 0; this.Quarry = 0; this.Magic = 0; this.Dungeons = 0; this.Bricks = 0; this.Gems = 0; this.Recruits = 0;
  }
  Giocatore.prototype.clone = function (caso) {
    var g = new Giocatore(caso), self = this;
    ['LastCard', 'LastMode', 'LastAction', 'NewCards', 'Moved', 'Revealed', 'TokenNames', 'TokenValues', 'TokenChanges', 'Hand', 'DisCards']
      .forEach(function (k) { g[k] = self[k] instanceof PArr ? self[k].clone() : self[k]; });
    g.Deck = this.Deck.clone(caso);
    g.Changes = Object.assign({}, this.Changes);
    ATTR.forEach(function (a) { g[a] = self[a]; });
    return g;
  };
  Giocatore.prototype.scegli = function (valori) {        // Random::arrayMtRand su una mappa
    var chiavi = Object.keys(valori);
    return chiavi[this._caso.intero(0, chiavi.length - 1)];
  };
  Giocatore.prototype.detectResource = function (tipo) {
    var cur = tipo === 'highest' ? Math.max(this.Bricks, this.Gems, this.Recruits) : Math.min(this.Bricks, this.Gems, this.Recruits);
    var t = {}, self = this;
    ['Bricks', 'Gems', 'Recruits'].forEach(function (r) { if (self[r] === cur) t[r] = 1; });
    return this.scegli(t);
  };
  Giocatore.prototype.detectFacility = function (tipo) {
    var cur = tipo === 'highest' ? Math.max(this.Quarry, this.Magic, this.Dungeons) : Math.min(this.Quarry, this.Magic, this.Dungeons);
    var t = {}, self = this;
    ['Quarry', 'Magic', 'Dungeons'].forEach(function (r) { if (self[r] === cur) t[r] = 1; });
    return this.scegli(t);
  };
  Giocatore.prototype.detectHighestResource = function () { return this.detectResource('highest'); };
  Giocatore.prototype.detectLowestResource = function () { return this.detectResource('lowest'); };
  Giocatore.prototype.detectHighestFacility = function () { return this.detectFacility('highest'); };
  Giocatore.prototype.detectLowestFacility = function () { return this.detectFacility('lowest'); };
  Giocatore.prototype.addHighestResource = function (n) { n = PHP.num(n); if (n) { var c = this.detectResource('highest'); this[c] += n; } return this; };
  Giocatore.prototype.addLowestResource = function (n) { n = PHP.num(n); if (n) { var c = this.detectResource('lowest'); this[c] += n; } return this; };
  Giocatore.prototype.addHighestFacility = function (n) { n = PHP.num(n); if (n) { var c = this.detectFacility('highest'); this[c] += n; } return this; };
  Giocatore.prototype.addLowestFacility = function (n) { n = PHP.num(n); if (n) { var c = this.detectFacility('lowest'); this[c] += n; } return this; };
  ATTR.forEach(function (a) {
    Giocatore.prototype['add' + a] = function (n) { this[a] += PHP.num(n); return this; };
    Giocatore.prototype['set' + a] = function (n) { this[a] = PHP.num(n); return this; };
  });
  Giocatore.prototype.attack = function (forza) {
    forza = PHP.num(forza);
    var danno = forza;
    if (this.Wall > 0) {
      danno -= this.Wall;
      this.Wall -= forza;
      if (this.Wall < 0) this.Wall = 0;
    }
    if (danno > 0) this.Tower -= danno;
    return this;
  };
  Giocatore.prototype.addStock = function (n) { n = PHP.num(n); if (n) { this.Bricks += n; this.Gems += n; this.Recruits += n; } return this; };
  Giocatore.prototype.setStock = function (n) { n = Math.max(0, PHP.num(n)); this.Bricks = n; this.Gems = n; this.Recruits = n; return this; };
  Giocatore.prototype.addFacilities = function (n) { n = PHP.num(n); if (n) { this.Quarry += n; this.Magic += n; this.Dungeons += n; } return this; };
  Giocatore.prototype.addRandomResources = function (n) {
    n = PHP.num(n);
    if (!n) return this;
    var i, b, g, r, tot, x;
    if (n > 0) {
      for (i = 1; i <= n; i++) {
        b = Math.max(0, this.Bricks); g = Math.max(0, this.Gems); r = Math.max(0, this.Recruits);
        var zero = [];
        if (b === 0) zero.push('Bricks'); if (g === 0) zero.push('Gems'); if (r === 0) zero.push('Recruits');
        if (zero.length) { this[zero[this._caso.intero(0, zero.length - 1)]]++; continue; }
        tot = b + g + r;
        b = Math.ceil(1000 * tot / b); g = Math.ceil(1000 * tot / g); r = Math.ceil(1000 * tot / r);
        x = this._caso.intero(1, b + g + r);
        if (x <= b) this.Bricks++; else if (x <= b + g) this.Gems++; else this.Recruits++;
      }
    } else {
      n = Math.abs(n);
      for (i = 1; i <= n; i++) {
        b = Math.max(0, this.Bricks); g = Math.max(0, this.Gems); r = Math.max(0, this.Recruits);
        tot = b + g + r; x = tot > 0 ? this._caso.intero(1, tot) : 0;
        if (x <= b && b > 0) this.Bricks--;
        else if (x <= b + g && g > 0) this.Gems--;
        else if (x <= b + g + r && r > 0) this.Recruits--;
      }
    }
    return this;
  };
  Giocatore.prototype.setCard = function (pos, id, opz) {
    pos = PHP.num(pos);
    if (!(pos >= 1 && pos <= 8 && Number.isInteger(pos))) return this;
    opz = opz || {};
    this.Hand.set(pos, id);
    if (opz['new'] === undefined || opz['new']) { if (!this.NewCards) this.NewCards = new PArr(); this.NewCards.set(pos, 1); }
    if (opz.reveal) { if (!this.Revealed) this.Revealed = new PArr(); this.Revealed.set(pos, 1); }
    else if (this.Revealed && this.Revealed.has(pos)) this.Revealed.del(pos);
    return this;
  };
  Giocatore.prototype.shuffleHand = function () {
    var chiavi = [1, 2, 3, 4, 5, 6, 7, 8], tr = chiavi.slice();
    for (var i = tr.length - 1; i > 0; i--) { var j = this._caso.intero(0, i), t = tr[i]; tr[i] = tr[j]; tr[j] = t; }
    var mano = new PArr(), flag = new PArr();
    for (var p = 1; p <= 8; p++) {
      var da = tr[p - 1];
      mano.set(p, this.Hand.get(da));
      if (this.NewCards && this.NewCards.has(da)) flag.set(p, 1);
      if (this.Revealed && this.Revealed.has(p)) this.Revealed.del(p);
    }
    for (p = 1; p <= 8; p++) if (PHP.num(mano.get(p)) !== PHP.num(this.Hand.get(p))) this.segnaSpostata(p);
    this.Hand = mano;
    if (flag.size()) this.NewCards = flag;
    return this;
  };
  Giocatore.prototype.segnaSpostata = function (pos) { if (!this.Moved) this.Moved = new PArr(); this.Moved.set(pos, 1); };
  Giocatore.prototype.switchCards = function (a, b) {
    a = PHP.num(a); b = PHP.num(b);
    if (a < 1 || a > 8 || b < 1 || b > 8 || a === b) return this;
    var c1 = this.Hand.get(a), c2 = this.Hand.get(b);
    var n1 = !!(this.NewCards && this.NewCards.has(a)), n2 = !!(this.NewCards && this.NewCards.has(b));
    this.Hand.set(a, c2); this.Hand.set(b, c1);
    if (PHP.num(c1) !== PHP.num(c2)) { this.segnaSpostata(a); this.segnaSpostata(b); }
    if (!this.NewCards) this.NewCards = new PArr();
    if (n1) this.NewCards.set(b, 1); else this.NewCards.del(b);
    if (n2) this.NewCards.set(a, 1); else this.NewCards.del(a);
    if (this.Revealed) { this.Revealed.del(a); this.Revealed.del(b); }
    return this;
  };
  Giocatore.prototype.findToken = function (nome) {
    var e = this.TokenNames.entries().find(function (x) { return PHP.uguale(x[1], nome); });
    return e ? e[0] : 0;
  };
  Giocatore.prototype.getToken = function (nome) { var i = this.findToken(nome); return i ? this.TokenValues.get(i) : false; };
  Giocatore.prototype.setToken = function (nome, n) {
    n = PHP.num(n); if (n < 0) return this;
    var i = this.findToken(nome); if (i) this.TokenValues.set(i, n); return this;
  };
  Giocatore.prototype.addToken = function (nome, n) {
    var i = this.findToken(nome); if (i) this.TokenValues.set(i, PHP.num(this.TokenValues.get(i)) + PHP.num(n)); return this;
  };
  Giocatore.prototype.applyGameLimits = function (cfg) {
    this.Quarry = Math.max(this.Quarry, 1); this.Magic = Math.max(this.Magic, 1); this.Dungeons = Math.max(this.Dungeons, 1);
    this.Bricks = Math.max(this.Bricks, 0); this.Gems = Math.max(this.Gems, 0); this.Recruits = Math.max(this.Recruits, 0);
    this.Tower = Math.min(Math.max(this.Tower, 0), cfg.max_tower);
    this.Wall = Math.min(Math.max(this.Wall, 0), cfg.max_wall);
    var tv = this.TokenValues;
    tv.keys().forEach(function (k) { tv.set(k, Math.max(Math.min(PHP.num(tv.get(k)), 100), 0)); });
    return this;
  };
  Giocatore.prototype.risorse = function () { return this.Bricks + this.Gems + this.Recruits; };

  // ------------------------------------------------------------------ configurazione
  var CONFIG = {
    normale: { init_tower: 30, max_tower: 100, init_wall: 25, max_wall: 150, res_victory: 400, time_victory: 250 },
    lunga: { init_tower: 45, max_tower: 150, init_wall: 38, max_wall: 225, res_victory: 600, time_victory: 375 }
  };

  // ------------------------------------------------------------------ partita
  // opz: { mazzi: [m1, m2] ({C,U,R,segnalini}), nascoste, lunga, sfida (oggetto SFIDE), seme, primo (1|2) }
  // Il giocatore 1 e' la persona, il 2 la CPU.
  function Partita(opz) {
    if (!opz) return;          // per clone()
    this.caso = new Caso(opz.seme || (Date.now() ^ (Math.random() * 1e9)));
    this.nascoste = !!opz.nascoste;
    this.lunga = !!opz.lunga;
    this.cfg = this.lunga ? CONFIG.lunga : CONFIG.normale;
    this.sfida = opz.sfida || null;
    this.stato = 'in corso';
    this.vincitore = null;      // 1, 2 o 0 (pareggio)
    this.esito = '';
    this.round = 1;
    this.corrente = opz.primo || (this.caso.intero(0, 1) === 1 ? 1 : 2);
    this.istantanea = null;     // variazioni del turno avversario, conservate durante le catene di Quick/Swift
    this.registro = [];         // cronologia delle azioni, per l'interfaccia

    var self = this;
    this.g = { 1: new Giocatore(this.caso), 2: new Giocatore(this.caso) };
    [1, 2].forEach(function (n) {
      var p = self.g[n];
      p.Deck = new Mazzo(opz.mazzi[n - 1], self.caso);
      p.LastCard = PArr.lista([0], 1); p.LastMode = PArr.lista([0], 1); p.LastAction = PArr.lista(['play'], 1);
      p.NewCards = null; p.Revealed = null;
      p.DisCards = PArr.lista([null, null], 0);
      p.Changes = zeri();
      p.Tower = self.cfg.init_tower; p.Wall = self.cfg.init_wall;
      p.Quarry = 3; p.Magic = 3; p.Dungeons = 3;
      p.Bricks = 15; p.Gems = 5; p.Recruits = 10;
    });
    // chi gioca per secondo parte con un punto in piu' di ogni risorsa
    var sec = this.g[this.corrente === 1 ? 2 : 1];
    sec.Bricks += 1; sec.Gems += 1; sec.Recruits += 1;
    [1, 2].forEach(function (n) {
      var p = self.g[n];
      p.TokenNames = p.Deck.Tokens.clone();
      p.TokenValues = PArr.lista([0, 0, 0], 1);
      p.TokenChanges = PArr.lista([0, 0, 0], 1);
    });
    var ctx = new Contesto(this, 1);
    this.g[1].Hand = ctx.drawHandInitial(this.g[1].Deck);
    this.g[2].Hand = ctx.drawHandInitial(this.g[2].Deck);
    if (this.sfida) {
      // "mine" della sfida e' la CPU (giocatore 2), "his" e' la persona
      var ini = this.sfida.init || {};
      Object.keys(ini.giocatore || {}).forEach(function (a) { self.g[1][a] = ini.giocatore[a]; });
      Object.keys(ini.cpu || {}).forEach(function (a) { self.g[2][a] = ini.cpu[a]; });
    }
  }
  Partita.prototype.clone = function (casoNuovo) {
    var p = Object.create(Partita.prototype), self = this;
    Object.keys(this).forEach(function (k) { p[k] = self[k]; });
    p.caso = casoNuovo || this.caso.clone();
    p.g = { 1: this.g[1].clone(p.caso), 2: this.g[2].clone(p.caso) };
    p.istantanea = this.istantanea ? { my: Object.assign({}, this.istantanea.my), his: Object.assign({}, this.istantanea.his) } : null;
    p.registro = this.registro.slice();
    return p;
  };
  Partita.prototype.avversario = function (n) { return n === 1 ? 2 : 1; };
  Partita.prototype.config = function (nome) { return this.cfg[nome]; };

  // ------------------------------------------------------------------ contesto: il "$t" delle carte
  function Contesto(partita, n) {
    this.p = partita; this.n = n; this.o = partita.avversario(n);
    this.caso = partita.caso;
    this.playedCardPos = 0; this.playedCardMode = 0; this.playedCardId = 0;
    this.nextPlayer = this.o;
    this.myDataInitial = {}; this.hisDataInitial = {};
    this.myNewCardsInitial = null; this.hisNewCardsInitial = null; this.myDiscardedCardsInitial = null;
    this.myChanges = zeri(); this.hisChanges = zeri();
    this._next = -1; this.isNextCardRevealed = false;
    this.prod = new Produzione();
  }
  var C = Contesto.prototype;
  C.addExtraTurn = function () { this.nextPlayer = this.n; };
  C.config = function (k) { return this.p.config(k); };
  C.round = function () { return this.p.round; };
  C.myData = function () { return this.p.g[this.n]; };
  C.hisData = function () { return this.p.g[this.o]; };
  C.myDataInit = function () { return PArr.mappa(this.myDataInitial); };
  C.hisDataInit = function () { return PArr.mappa(this.hisDataInitial); };
  C.myDeck = function () { return this.myData().Deck; };
  C.hisDeck = function () { return this.hisData().Deck; };
  C.cardPos = function () { return this.playedCardPos; };
  C.mode = function () { return this.playedCardMode; };
  C.card = function () { return carta(this.playedCardId); };
  C.myLastCardIndex = function () { return this.myData().LastCard.size(); };
  C.hisLastCardIndex = function () { return this.hisData().LastCard.size(); };
  C.myLastAction = function () { return this.myData().LastAction.get(this.myLastCardIndex()); };
  C.myLastCard = function () { return carta(this.myData().LastCard.get(this.myLastCardIndex())); };
  C.hisLastAction = function () { return this.hisData().LastAction.get(this.hisLastCardIndex()); };
  C.hisLastCard = function () { return carta(this.hisData().LastCard.get(this.hisLastCardIndex())); };
  C.hiddenCards = function () { return this.p.nascoste; };
  C.isMyNew = function (pos) { return !!(this.myNewCardsInitial && this.myNewCardsInitial.has(pos)); };
  C.isHisNew = function (pos) { return !!(this.hisNewCardsInitial && this.hisNewCardsInitial.has(pos)); };
  C.myDiscardedCards = function () { return this.myDiscardedCardsInitial; };
  C.myChange = function (k) { return this.myChanges[k]; };
  C.hisChange = function (k) { return this.hisChanges[k]; };
  C.nextCard = function (id, rivelata) {
    id = PHP.num(id || 0);
    if (id > 0) { this._next = id; if (rivelata) this.isNextCardRevealed = true; }
    return this._next;
  };
  C.noNextCard = function () { this._next = 0; };
  C.production = function () { return this.prod; };
  C.handSize = function () { return 8; };
  C.chi = function (tipo) { return tipo === 'my' ? this.n : this.o; };
  C.stealStock = function (tipo, n) { var self = this; ['Bricks', 'Gems', 'Recruits'].forEach(function (r) { self.stealResource(tipo, r, n); }); };
  C.stealResource = function (tipo, ris, n) {
    if (['Bricks', 'Gems', 'Recruits'].indexOf(ris) < 0) throw new Error('risorsa non valida ' + ris);
    var src = this.p.g[tipo === 'my' ? this.o : this.n], dst = this.p.g[tipo === 'my' ? this.n : this.o];
    var rubate = Math.max(0, Math.min(PHP.num(n), src[ris]));
    src[ris] -= rubate; dst[ris] += rubate;
  };
  C.stealRandomResources = function (tipo, n) {
    var src = this.p.g[tipo === 'my' ? this.o : this.n], dst = this.p.g[tipo === 'my' ? this.n : this.o];
    for (var i = 1; i <= PHP.num(n); i++) {
      var b = Math.max(0, src.Bricks), g = Math.max(0, src.Gems), r = Math.max(0, src.Recruits), tot = b + g + r;
      var x = tot > 0 ? this.caso.intero(1, tot) : 0;
      if (x <= b && b > 0) { src.Bricks--; dst.Bricks++; }
      else if (x <= b + g && g > 0) { src.Gems--; dst.Gems++; }
      else if (x <= b + g + r && r > 0) { src.Recruits--; dst.Recruits++; }
    }
  };
  C.setCard = function (tipo, pos, id, opz) {
    opz = opz instanceof PArr ? { reveal: opz.get('reveal'), discard: opz.get('discard'), 'new': opz.has('new') ? opz.get('new') : undefined } : Object.assign({}, opz || {});
    pos = PHP.num(pos);
    var dati = this.p.g[this.chi(tipo)];
    var scartata = dati.Hand.get(pos);
    if (!this.p.nascoste && opz.reveal) delete opz.reveal;
    if (PHP.num(scartata) > 0 && !opz.discard) {
      if (carta(scartata).hasKeyword('Cursed')) {
        id = scartata;
        if (this.p.nascoste && dati.Revealed && dati.Revealed.get(pos)) opz.reveal = true;
      }
    }
    dati.setCard(pos, id, opz);
    if (PHP.num(scartata) > 0 && (tipo !== 'my' || this.playedCardPos !== pos)) {
      var mio = this.p.g[this.n], idx = tipo === 'my' ? 0 : 1;
      var l = mio.DisCards.get(idx);
      if (!(l instanceof PArr)) { l = new PArr(); mio.DisCards.set(idx, l); }
      l.set(l.size() + 1, scartata);
    }
  };
  C.replaceCard = function (tipo, pos, id) {
    var opz = { 'new': false };
    if (tipo === 'my' && this.playedCardPos !== PHP.num(pos) && this.p.nascoste) opz.reveal = true;
    this.setCard(tipo, pos, id, opz);
  };
  C.revealCard = function (tipo, pos) {
    if (!this.p.nascoste) return;
    var d = this.p.g[this.chi(tipo)];
    if (!d.Revealed) d.Revealed = new PArr();
    d.Revealed.set(pos, 1);
  };
  C.setHand = function (tipo, mano) {
    var v = mano instanceof PArr ? mano.values() : mano;
    if (v.length !== 8) return;
    for (var i = 1; i <= 8; i++) this.setCard(tipo, i, v[i - 1]);
  };
  C.setHandShuffled = function (tipo, mano) {
    var v = (mano instanceof PArr ? mano.values() : mano).slice();
    for (var i = v.length - 1; i > 0; i--) { var j = this.caso.intero(0, i), t = v[i]; v[i] = v[j]; v[j] = t; }
    this.setHand(tipo, v);
  };
  C.getCard = function (id) { return carta(PHP.num(id)); };
  C.getList = function (filtri) { return getList(filtri); };
  C.keywordCount = function (mano, kw) {
    var n = 0; (mano instanceof PArr ? mano.values() : mano).forEach(function (id) { if (carta(PHP.num(id)).hasKeyword(kw)) n++; }); return n;
  };
  C.keywordValue = function (keywords, kw) {
    var m = new RegExp(PHP.str(kw) + ' \\((\\d+)\\)').exec(PHP.str(keywords));
    return m ? parseInt(m[1], 10) : 0;
  };
  C.countDistinctKeywords = function (mano) {
    var visti = {};
    (mano instanceof PArr ? mano.values() : mano).forEach(function (id) {
      var k = carta(PHP.num(id)).d.kw;
      if (k === '') return;
      k.split(',').forEach(function (w) { visti[w.split(' (')[0]] = 1; });
    });
    return Object.keys(visti).length;
  };
  C.arrayMtRand = function (arr) {
    var chiavi = arr instanceof PArr ? arr.keys() : Object.keys(arr);
    if (!chiavi.length) return false;
    return chiavi[this.caso.intero(0, chiavi.length - 1)];
  };
  C.arrayRand = function (arr, quanti) {
    quanti = quanti ? PHP.num(quanti) : 1;
    var chiavi = arr instanceof PArr ? arr.keys() : [];
    if (!chiavi.length || chiavi.length < quanti) return false;
    if (quanti === 1) return chiavi[this.caso.intero(0, chiavi.length - 1)];
    var disp = chiavi.slice(), presi = [];
    for (var i = 0; i < quanti; i++) { var j = this.caso.intero(0, disp.length - 1); presi.push(disp[j]); disp.splice(j, 1); }
    return PArr.lista(presi, 0);
  };
  C.drawCard = function (sorgente, mano, pos, funzione) {
    pos = PHP.num(pos);
    if (!(pos >= 1 && pos <= 8)) throw new Error('posizione non valida ' + pos);
    for (var giri = 0; giri < 100000; giri++) {
      var attuale = mano.get(pos);
      var prossima = this[funzione](sorgente, attuale);
      var uguali = 0;
      for (var i = 1; i <= 8; i++) if (PHP.uguale(mano.get(i), prossima) && pos !== i) uguali++;
      if (this.caso.intero(1, Math.pow(2, uguali)) === 1) return prossima;
    }
    throw new Error('pescata impossibile');
  };
  C.drawHand = function (sorgente, funzione) {
    var mano = PArr.lista([0, 0, 0, 0, 0, 0, 0, 0], 1);
    for (var i = 1; i <= 8; i++) mano.set(i, this.drawCard(sorgente, mano, i, funzione));
    return mano;
  };
  C.drawHandInitial = function (mazzo) {
    var mano = PArr.lista([0, 0, 0, 0, 0, 0, 0, 0], 1), i;
    for (i = 1; i <= 6; i++) mano.set(i, this.drawCard(mazzo.Common, mano, i, 'drawCardList'));
    for (i = 7; i <= 8; i++) mano.set(i, this.drawCard(mazzo.Uncommon, mano, i, 'drawCardList'));
    var v = mano.values();
    for (i = v.length - 1; i > 0; i--) { var j = this.caso.intero(0, i), t = v[i]; v[i] = v[j]; v[j] = t; }
    return PArr.lista(v, 1);
  };
  C.drawCardRandom = function (mazzo) { return mazzo.drawCardRandom(); };
  C.drawCardDifferent = function (mazzo, id) { return mazzo.drawCardDifferent(id); };
  C.drawCardNoRare = function (mazzo) { return mazzo.drawCardNoRare(); };
  C.drawCardList = function (lista) {
    if (!(lista instanceof PArr)) lista = PArr.lista(lista || [], 0);
    if (!lista.size()) return 0;
    return lista.get(this.arrayMtRand(lista));
  };
  C.drawHandRandom = function (mazzo) { return this.drawHand(mazzo, 'drawCardRandom'); };
  C.drawHandNoRare = function (mazzo) { return this.drawHand(mazzo, 'drawCardNoRare'); };
  C.drawHandList = function (lista) { return this.drawHand(lista, 'drawCardList'); };
  C.executeCode = function (codice) {
    if (!codice) return true;
    PHP.esegui(codice, { t: this, 'this': this }, this.caso.fn());
    return true;
  };

  // ------------------------------------------------------------------ usaCarta (GameUseCard::useCard)
  // azione: 'play' | 'discard' | 'preview'. Restituisce {errore} oppure {} (o {anteprima} per preview).
  Partita.prototype.usaCarta = function (n, azione, pos, modo) {
    var P = this, ris = {};
    modo = modo || 0;
    if (['play', 'discard', 'preview'].indexOf(azione) < 0) return { errore: 'Invalid action' };
    if (this.stato !== 'in corso') return { errore: 'The game is over' };
    if (this.corrente !== n) return { errore: 'Not your turn' };
    if (!(pos >= 1 && pos <= 8)) return { errore: 'Wrong card position' };

    var t = new Contesto(this, n);
    t.playedCardPos = pos; t.playedCardMode = modo;
    var io = t.myData(), lui = t.hisData();
    var id = io.Hand.get(pos);
    t.playedCardId = id;
    var c = carta(id), gioca = azione !== 'discard';

    if (gioca && (io.Bricks < c.d.costo.b || io.Gems < c.d.costo.g || io.Recruits < c.d.costo.r)) return { errore: 'Insufficient resources' };
    var modi = c.d.modi || 0;
    if (gioca && (modo < 0 || modo > modi || (modo === 0 && modi > 0))) return { errore: 'Choose a mode' };

    var ultimaAzione = t.myLastAction(), ultima = t.myLastCard();
    var catena = ultima.isPlayAgainCard() && ultimaAzione === 'play';

    t.myNewCardsInitial = io.NewCards ? io.NewCards.clone() : null;
    t.hisNewCardsInitial = lui.NewCards ? lui.NewCards.clone() : null;
    t.myDiscardedCardsInitial = io.DisCards.clone();

    function fotografa() { ATTR.forEach(function (a) { t.myDataInitial[a] = io[a]; t.hisDataInitial[a] = lui[a]; }); }
    fotografa();

    // variazioni del turno precedente dell'avversario: durante una catena di Quick/Swift restano quelle
    // di inizio catena (l'originale le ripescava dal replay)
    if (catena && this.istantanea) { t.myChanges = this.istantanea.my; t.hisChanges = this.istantanea.his; }
    else { t.myChanges = Object.assign({}, io.Changes); t.hisChanges = Object.assign({}, lui.Changes); }
    if (!catena) {
      this.istantanea = { my: Object.assign({}, io.Changes), his: Object.assign({}, lui.Changes) };
      io.NewCards = null; io.Moved = null;
      io.Changes = zeri(); lui.Changes = zeri();
      io.DisCards = PArr.lista([null, null], 0);
      io.TokenChanges = PArr.lista([0, 0, 0], 1); lui.TokenChanges = PArr.lista([0, 0, 0], 1);
    }

    t.nextPlayer = this.avversario(n);
    t._next = -1; t.isNextCardRevealed = false;
    t.prod = new Produzione();

    var manoIo = null, manoLui = null, tokIo = null, tokLui = null, scattati = {};
    if (gioca) {
      io.Bricks -= c.d.costo.b; io.Gems -= c.d.costo.g; io.Recruits -= c.d.costo.r;
      fotografa();
      tokIo = io.TokenValues.clone(); tokLui = lui.TokenValues.clone();
      manoIo = io.Hand.clone(); manoLui = lui.Hand.clone();

      // i segnalini keyword crescono prima dell'effetto
      if (c.d.kw !== '') {
        SEGNALINI.forEach(function (kw) {
          if (c.hasKeyword(kw)) {
            var k = KEYWORD[kw], quante = t.keywordCount(io.Hand, kw) - 1;
            io.addToken(kw, k.guadagno + quante * k.bonus);
          }
        });
      }
      t.executeCode(c.d.codice);
      io.applyGameLimits(this.cfg); lui.applyGameLimits(this.cfg);

      if (c.d.kw !== '') {
        ORDINE_KW.forEach(function (kw) {
          if (!c.hasKeyword(kw)) return;
          var k = KEYWORD[kw];
          if (SEGNALINI.indexOf(kw) >= 0) {
            if (PHP.num(io.getToken(kw)) >= 100) {
              io.setToken(kw, 0);
              scattati[io.findToken(kw)] = 1;
              ris.segnalini = (ris.segnalini || []).concat([kw]);   // per l'interfaccia: quale segnalino e' scattato
              t.executeCode(k.codice);
            }
          } else t.executeCode(k.codice);
        });
      }
      io.applyGameLimits(this.cfg); lui.applyGameLimits(this.cfg);

      tokIo.keys().forEach(function (i) {
        io.TokenChanges.set(i, PHP.num(io.TokenChanges.get(i)) + PHP.num(io.TokenValues.get(i)) - PHP.num(tokIo.get(i)));
        lui.TokenChanges.set(i, PHP.num(lui.TokenChanges.get(i)) + PHP.num(lui.TokenValues.get(i)) - PHP.num(tokLui.get(i)));
        if (scattati[i] && io.TokenChanges.get(i) === 0) io.TokenChanges.set(i, -100);
      });
    }

    // produzione a fine turno
    io.Bricks += t.prod.bricks() * io.Quarry;
    io.Gems += t.prod.gems() * io.Magic;
    io.Recruits += t.prod.recruits() * io.Dungeons;

    ATTR.forEach(function (a) {
      io.Changes[a] += io[a] - t.myDataInitial[a];
      lui.Changes[a] += lui[a] - t.hisDataInitial[a];
    });

    if (azione === 'preview') {
      if (t._next > 0) {
        io.Hand.set(pos, t._next);
        if (t.isNextCardRevealed) { if (!io.Revealed) io.Revealed = new PArr(); io.Revealed.set(pos, 1); }
      }
      var camb = function (prima, dopo) { var r = {}; for (var i = 1; i <= 8; i++) if (!PHP.uguale(prima.get(i), dopo.get(i))) r[i] = dopo.get(i); return r; };
      var attr = function (d) { var r = {}; ATTR.forEach(function (a) { r[a] = d[a]; }); return r; };
      ris.anteprima = {
        io: { attr: attr(io), cambi: camb(manoIo, io.Hand), variazioni: Object.assign({}, io.Changes), segnalini: io.TokenValues.values() },
        lui: { attr: attr(lui), cambi: camb(manoLui, lui.Hand), variazioni: Object.assign({}, lui.Changes), segnalini: lui.TokenValues.values() },
        scatta: ris.segnalini || [], turnoExtra: t.nextPlayer === n
      };
      return ris;
    }

    // pescata a fine turno
    if (t._next > 0) t.setCard('my', pos, t._next, { reveal: t.isNextCardRevealed, discard: gioca });
    else if (t._next === -1) {
      var tipoPesca = azione === 'play' ? (c.isPlayAgainCard() ? 'drawCardNoRare' : 'drawCardRandom') : 'drawCardDifferent';
      t.setCard('my', pos, t.drawCard(io.Deck, io.Hand, pos, tipoPesca), { discard: gioca });
    }

    // cronologia delle giocate del turno
    var idx;
    if (catena) idx = t.myLastCardIndex() + 1;
    else { io.LastCard = new PArr(); io.LastMode = new PArr(); io.LastAction = new PArr(); idx = 1; }
    io.LastCard.set(idx, id); io.LastMode.set(idx, modo); io.LastAction.set(idx, azione);

    if (azione === 'discard') {
      if (!io.NewCards) io.NewCards = new PArr();
      io.NewCards.set(pos, 1);
      if (io.Revealed) io.Revealed.del(pos);
    }

    this.registro.push({ giocatore: n, azione: azione, carta: id, modo: modo, round: this.round });
    this.controllaVittoria(n);

    this.corrente = t.nextPlayer;
    if (t.nextPlayer !== n) this.round++;
    return ris;
  };

  Partita.prototype.controllaVittoria = function (n) {
    var io = this.g[n], lui = this.g[this.avversario(n)], o = this.avversario(n);
    var mt = this.cfg.max_tower, rv = this.cfg.res_victory, P = this;
    function fine(v, e) { P.vincitore = v; P.esito = e; P.stato = 'finita'; }
    if (io.Tower > 0 && lui.Tower <= 0) fine(n, 'Destruction');
    else if (io.Tower <= 0 && lui.Tower > 0) fine(o, 'Destruction');
    else if (io.Tower <= 0 && lui.Tower <= 0) fine(0, 'Draw');
    else if (io.Tower >= mt && lui.Tower < mt) fine(n, 'Construction');
    else if (io.Tower < mt && lui.Tower >= mt) fine(o, 'Construction');
    else if (io.Tower >= mt && lui.Tower >= mt) fine(0, 'Draw');
    else if (io.risorse() >= rv && !(lui.risorse() >= rv)) fine(n, 'Resource');
    else if (lui.risorse() >= rv && !(io.risorse() >= rv)) fine(o, 'Resource');
    else if (io.risorse() >= rv && lui.risorse() >= rv) fine(0, 'Draw');
    else if (this.round >= this.cfg.time_victory) {
      var conf = [[io.Tower, lui.Tower], [io.Wall, lui.Wall], [io.Quarry + io.Magic + io.Dungeons, lui.Quarry + lui.Magic + lui.Dungeons], [io.risorse(), lui.risorse()]];
      for (var i = 0; i < conf.length; i++) {
        if (conf[i][0] > conf[i][1]) return fine(n, 'Timeout');
        if (conf[i][0] < conf[i][1]) return fine(o, 'Timeout');
      }
      fine(0, 'Draw');
    }
  };

  // ------------------------------------------------------------------ salvataggio
  // la partita in corso diventa JSON (per riprenderla se Android chiude l'app) e torna indietro
  function aJson(v) {
    if (v instanceof PArr) return { __p: v.entries().map(function (e) { return [e[0], aJson(e[1])]; }), n: v.next };
    return v;
  }
  function daJson(v) {
    if (v && typeof v === 'object' && v.__p) {
      var a = new PArr(); v.__p.forEach(function (e) { a.m.set(e[0], daJson(e[1])); }); a.next = v.n; return a;
    }
    return v;
  }
  var CAMPI_G = ['Hand', 'LastCard', 'LastMode', 'LastAction', 'NewCards', 'Moved', 'Revealed', 'DisCards', 'TokenNames', 'TokenValues', 'TokenChanges'];
  Partita.prototype.esporta = function () {
    var self = this, o = {};
    ['nascoste', 'lunga', 'sfida', 'stato', 'vincitore', 'esito', 'round', 'corrente', 'istantanea', 'registro', 'extra'].forEach(function (k) { o[k] = self[k]; });
    o.caso = this.caso.s.slice();
    o.g = {};
    [1, 2].forEach(function (n) {
      var p = self.g[n], d = { Changes: p.Changes };
      ATTR.forEach(function (a) { d[a] = p[a]; });
      CAMPI_G.forEach(function (k) { d[k] = aJson(p[k]); });
      d.Deck = { C: p.Deck.Common.values(), U: p.Deck.Uncommon.values(), R: p.Deck.Rare.values(), T: p.Deck.Tokens.values() };
      o.g[n] = d;
    });
    return o;
  };
  Partita.importa = function (o) {
    var p = Object.create(Partita.prototype);
    Object.keys(o).forEach(function (k) { if (k !== 'g' && k !== 'caso') p[k] = o[k]; });
    p.cfg = p.lunga ? CONFIG.lunga : CONFIG.normale;
    p.caso = Object.create(Caso.prototype); p.caso.s = o.caso.slice();
    p.g = {};
    [1, 2].forEach(function (n) {
      var d = o.g[n], g = new Giocatore(p.caso);
      ATTR.forEach(function (a) { g[a] = d[a]; });
      CAMPI_G.forEach(function (k) { g[k] = daJson(d[k]); });
      g.Changes = d.Changes;
      g.Deck = new Mazzo({ C: d.Deck.C, U: d.Deck.U, R: d.Deck.R, segnalini: d.Deck.T.filter(function (x) { return x !== 'none'; }) }, p.caso);
      p.g[n] = g;
    });
    return p;
  };

  // anteprima di una giocata su una copia della partita (con un caso a parte: non tocca quello vero)
  Partita.prototype.anteprima = function (n, pos, modo, seme) {
    var copia = this.clone(new Caso(seme || 12345));
    return copia.usaCarta(n, 'preview', pos, modo || 0);
  };
  Partita.prototype.giocabile = function (n, pos) {
    var c = carta(this.g[n].Hand.get(pos)), p = this.g[n];
    if (p.Bricks < c.d.costo.b || p.Gems < c.d.costo.g || p.Recruits < c.d.costo.r) return false;
    return true;
  };

  // ------------------------------------------------------------------ CPU (GameAi::determineMove)
  var PESI_BASE = {
    mine: { Quarry: 80, Magic: 120, Dungeons: 100, Bricks: 4, Gems: 6, Recruits: 5, Tower: 7.5, Wall: 5 },
    his: { Quarry: 96, Magic: 144, Dungeons: 120, Bricks: 4.8, Gems: 7.2, Recruits: 6, Tower: 9, Wall: 6 }
  };
  var VARIE_BASE = { play_again: 300, summon: 150, discard: 250, cleanup: 50, poison: 50 };
  function pesi(partita, n, statici) {
    var cfg = partita.cfg, io = partita.g[n], lui = partita.g[partita.avversario(n)];
    var fac = function (x) { return Math.min(2.5, (6 / Math.pow(x, 2)) + 0.6); };
    var res = function (x) { return (20 / (x + 40)) + 0.8; };
    var tor = function (x) { var r = x / cfg.max_tower * 100; return Math.pow(r - 50, 2) / 3000 + 0.9; };
    var mur = function (x) { var r = x / cfg.max_wall * 100; return Math.min(1.5, 5 / (r + 5) + 0.85); };
    var din = function (d) {
      return { Quarry: fac(d.Quarry), Magic: fac(d.Magic), Dungeons: fac(d.Dungeons), Bricks: res(d.Bricks), Gems: res(d.Gems),
        Recruits: res(d.Recruits), Tower: tor(d.Tower), Wall: mur(d.Wall) };
    };
    var dm = din(io), dh = din(lui), out = { mine: {}, his: {} };
    ATTR.forEach(function (a) { out.mine[a] = statici.mine[a] * dm[a]; out.his[a] = statici.his[a] * dh[a]; });
    return out;
  }
  function inLista(pa, id) { return pa.values().some(function (x) { return PHP.uguale(x, id); }); }

  // restituisce { azione: 'play'|'discard', pos, modo }
  function mossaCpu(partita, n, opz) {
    opz = opz || {};
    var statici = opz.pesi || ((partita.sfida && partita.sfida.pesi && n === 2) ? partita.sfida.pesi : PESI_BASE);
    var VARIE = opz.varie || VARIE_BASE;
    var io = partita.g[n], lui = partita.g[partita.avversario(n)];
    var aIo = {}, aLui = {};
    ATTR.forEach(function (a) { aIo[a] = io[a]; aLui[a] = lui[a]; });
    var manoIo = io.Hand.values().map(function (id) { return carta(id); });
    var manoLui = lui.Hand.values().map(function (id) { return carta(id); });
    var giocabili = [];
    for (var p = 1; p <= 8; p++) if (partita.giocabile(n, p)) giocabili.push(p);
    var scelta = null;
    if (giocabili.length) {
      var w = pesi(partita, n, statici), max = 0, scelte = [];
      giocabili.forEach(function (pos) {
        var c = manoIo[pos - 1], ancora = c.isPlayAgainCard();
        var modi = c.d.modi > 0 ? Array.from({ length: c.d.modi }, function (x, i) { return i + 1; }) : [0];
        modi.forEach(function (m) {
          var r = partita.anteprima(n, pos, m, (opz.seme || 777) + pos * 31 + m);
          if (r.errore) return;
          var dopoIo = r.anteprima.io.attr, dopoLui = r.anteprima.lui.attr, punti = 0;
          ATTR.forEach(function (a) {
            punti += (dopoIo[a] - aIo[a]) * w.mine[a];
            punti += (aLui[a] - dopoLui[a]) * w.his[a];
          });
          if (ancora) punti += VARIE.play_again;
          Object.keys(r.anteprima.io.cambi).forEach(function (k) {
            var cp = +k, prima = manoIo[cp - 1], nuova = carta(r.anteprima.io.cambi[k]), cls = nuova.rar;
            if (cls === 'Rare') punti += VARIE.summon;
            if (cp !== pos && prima.rar === 'Rare') {
              var serve = prima.d.costo.b + prima.d.costo.g + prima.d.costo.r;
              var manca = Math.max(0, prima.d.costo.b - aIo.Bricks) + Math.max(0, prima.d.costo.g - aIo.Gems) + Math.max(0, prima.d.costo.r - aIo.Recruits);
              punti -= VARIE.discard * (serve > 0 ? (serve - manca) / serve : 1);
            }
            if (prima.rar === 'Common' && !inLista(io.Deck.Common, prima.d.id) && io.Deck[cls] && inLista(io.Deck[cls], nuova.d.id)) punti += VARIE.cleanup;
            if (cls === 'Common' && !inLista(io.Deck.Common, nuova.d.id) && io.Deck[prima.rar] && inLista(io.Deck[prima.rar], prima.d.id)) punti -= VARIE.poison;
          });
          Object.keys(r.anteprima.lui.cambi).forEach(function (k) {
            var cp = +k, prima = manoLui[cp - 1], nuova = carta(r.anteprima.lui.cambi[k]), cls = nuova.rar;
            if (cls === 'Rare') punti -= VARIE.summon;
            if (prima.rar === 'Rare') {
              var serve = prima.d.costo.b + prima.d.costo.g + prima.d.costo.r;
              var manca = Math.max(0, prima.d.costo.b - aLui.Bricks) + Math.max(0, prima.d.costo.g - aLui.Gems) + Math.max(0, prima.d.costo.r - aLui.Recruits);
              punti += VARIE.discard * (serve > 0 ? (serve - manca) / serve : 1);
            }
            if (prima.rar === 'Common' && !inLista(lui.Deck.Common, prima.d.id) && lui.Deck[cls] && inLista(lui.Deck[cls], nuova.d.id)) punti -= VARIE.cleanup;
            if (cls === 'Common' && !inLista(lui.Deck.Common, nuova.d.id) && lui.Deck[prima.rar] && inLista(lui.Deck[prima.rar], prima.d.id)) punti += VARIE.poison;
          });
          var prima = aIo.Bricks + aIo.Gems + aIo.Recruits, costo = c.d.costo.b + c.d.costo.g + c.d.costo.r;
          punti += punti * (prima > 0 ? costo / prima : 1);
          var cfg = partita.cfg;
          var vince = dopoLui.Tower <= 0 || dopoIo.Tower >= cfg.max_tower || (dopoIo.Bricks + dopoIo.Gems + dopoIo.Recruits) >= cfg.res_victory;
          var perde = dopoIo.Tower <= 0 || dopoLui.Tower >= cfg.max_tower || (dopoLui.Bricks + dopoLui.Gems + dopoLui.Recruits) >= cfg.res_victory;
          if (vince && !perde) punti = 99999; else if (!vince && perde) punti = 0;
          max = Math.max(max, punti);
          scelte.push({ pos: pos, modo: m, punti: punti });
        });
      });
      if (max > 0) {
        var migliori = scelte.filter(function (s) { return s.punti === max; });
        var b = migliori[partita.caso.intero(0, migliori.length - 1)];
        scelta = { azione: 'play', pos: b.pos, modo: b.modo };
      }
    }
    if (!scelta) {
      var rare = [], resto = [];
      manoIo.forEach(function (c, i) { (c.rar === 'Rare' ? rare : resto).push(i + 1); });
      var sel = resto.length ? resto : rare, mancanti = {}, mx = 0;
      sel.forEach(function (pos) {
        var c = manoIo[pos - 1];
        var m = Math.max(0, c.d.costo.b - io.Bricks) + Math.max(0, c.d.costo.g - io.Gems) + Math.max(0, c.d.costo.r - io.Recruits);
        mancanti[pos] = m; mx = Math.max(mx, m);
      });
      var gruppi = { Common: [], Uncommon: [], Rare: [] };
      sel.forEach(function (pos) { if (mancanti[pos] === mx) gruppi[manoIo[pos - 1].rar].push(pos); });
      var mescola = function (l) { for (var i = l.length - 1; i > 0; i--) { var j = partita.caso.intero(0, i), t = l[i]; l[i] = l[j]; l[j] = t; } return l; };
      var tutti = mescola(gruppi.Common).concat(mescola(gruppi.Uncommon), mescola(gruppi.Rare));
      scelta = { azione: 'discard', pos: tutti[0], modo: 0 };
    }
    return scelta;
  }

  // ------------------------------------------------------------------ mazzi
  // segnalini automatici: le keyword con segnalino piu' presenti nel mazzo (Deck::setAutoTokens)
  function segnaliniAuto(m) {
    var conta = {};
    SEGNALINI.forEach(function (k) { conta[k] = 0; });
    ['C', 'U', 'R'].forEach(function (r) {
      (m[r] || []).forEach(function (id) {
        if (!(id > 0)) return;
        carta(id).d.kw.split(',').forEach(function (w) { w = w.split(' (')[0]; if (conta[w] !== undefined) conta[w]++; });
      });
    });
    return SEGNALINI.filter(function (k) { return conta[k] > 0; })
      .sort(function (a, b) { return conta[b] - conta[a]; }).slice(0, 1);
  }
  // un mazzo casuale legale: 15 carte per rarita', niente doppioni, niente Forbidden
  function mazzoCasuale(caso, pool) {
    var m = {};
    ['C', 'U', 'R'].forEach(function (r) {
      var l = (pool || CATALOGO.lista).filter(function (d) { return d.rarita === r && d.kw.indexOf('Forbidden') < 0; }).map(function (d) { return d.id; });
      for (var i = l.length - 1; i > 0; i--) { var j = caso.intero(0, i), t = l[i]; l[i] = l[j]; l[j] = t; }
      m[r] = l.slice(0, 15);
    });
    m.segnalini = segnaliniAuto(m);
    return m;
  }

  var Motore = {
    PArr: PArr, Caso: Caso, Partita: Partita, mossaCpu: mossaCpu, carta: carta, caricaCarte: caricaCarte,
    caricaKeyword: caricaKeyword, getList: getList, segnaliniAuto: segnaliniAuto, mazzoCasuale: mazzoCasuale,
    CONFIG: CONFIG, SEGNALINI: SEGNALINI, ATTR: ATTR, catalogo: CATALOGO, PESI_BASE: PESI_BASE, VARIE_BASE: VARIE_BASE
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Motore;
  else radice.Motore = Motore;
})(typeof window !== 'undefined' ? window : globalThis);
