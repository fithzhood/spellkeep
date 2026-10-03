// Interprete del sottoinsieme di PHP usato dal codice delle carte e delle keyword di MArcomage.
// Le carte eseguono il loro codice originale: la fedelta' la garantisce la sorgente, non una
// traduzione a mano di 790 frammenti.
//
// Copre: variabili, array PHP (mappe ordinate, indici interi o stringa, push con []), if/elseif/else,
// for, foreach (con chiave), while, break/continue/return, ternario, && || and or !, confronti
// "larghi" alla PHP, + - * / % . ++ --, assegnazioni composte, chiamate di metodo e proprieta' su
// oggetti host (JS), e le funzioni di libreria che le carte usano davvero.
(function (radice) {
  'use strict';

  // ------------------------------------------------------------------ array PHP
  function chiave(k) {
    if (typeof k === 'number') return Math.trunc(k);
    if (typeof k === 'boolean') return k ? 1 : 0;
    if (k === null || k === undefined) return '';
    if (typeof k === 'string' && /^(0|-?[1-9]\d*)$/.test(k)) return Number(k);
    return String(k);
  }
  function PArr() { this.m = new Map(); this.next = 0; }
  PArr.prototype.get = function (k) { var v = this.m.get(chiave(k)); return v === undefined ? null : v; };
  PArr.prototype.has = function (k) { return this.m.has(chiave(k)); };
  PArr.prototype.set = function (k, v) {
    k = chiave(k); this.m.set(k, v);
    if (typeof k === 'number' && k >= this.next) this.next = k + 1;
    return v;
  };
  PArr.prototype.push = function (v) { return this.set(this.next, v); };
  PArr.prototype.del = function (k) { this.m.delete(chiave(k)); };
  PArr.prototype.size = function () { return this.m.size; };
  PArr.prototype.keys = function () { return Array.from(this.m.keys()); };
  PArr.prototype.values = function () { return Array.from(this.m.values()); };
  PArr.prototype.entries = function () { return Array.from(this.m.entries()); };
  PArr.prototype.ricalcola = function () {
    var n = 0; this.m.forEach(function (v, k) { if (typeof k === 'number' && k >= n) n = k + 1; }); this.next = n;
  };
  PArr.prototype.clone = function () {
    var a = new PArr();
    this.m.forEach(function (v, k) { a.m.set(k, v instanceof PArr ? v.clone() : v); });
    a.next = this.next; return a;
  };
  // da array JS: indici da `inizio` (0 per le liste PHP, 1 per mano e mazzi)
  PArr.lista = function (arr, inizio) {
    var a = new PArr(); inizio = inizio || 0;
    for (var i = 0; i < arr.length; i++) a.set(i + inizio, arr[i]);
    return a;
  };
  PArr.mappa = function (obj) { var a = new PArr(); Object.keys(obj).forEach(function (k) { a.set(k, obj[k]); }); return a; };

  // ------------------------------------------------------------------ valori alla PHP
  function numerico(v) { return typeof v === 'number' || (typeof v === 'string' && /^\s*-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(v)); }
  function num(v) {
    if (typeof v === 'number') return v;
    if (v === null || v === undefined || v === false) return 0;
    if (v === true) return 1;
    if (typeof v === 'string') { var f = parseFloat(v); return isNaN(f) ? 0 : f; }
    if (v instanceof PArr) return v.size() ? 1 : 0;
    return 1;
  }
  function str(v) {
    if (v === null || v === undefined || v === false) return '';
    if (v === true) return '1';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(+v.toPrecision(14));
    if (v instanceof PArr) return 'Array';
    return String(v);
  }
  function vero(v) {
    if (v === null || v === undefined || v === false) return false;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return v !== '' && v !== '0';
    if (v instanceof PArr) return v.size() > 0;
    return true;
  }
  function uguale(a, b) {
    if (a === b) return true;
    if (a === undefined) a = null; if (b === undefined) b = null;
    if (typeof a === 'boolean' || typeof b === 'boolean') return vero(a) === vero(b);
    if (a === null || b === null) {
      var o = a === null ? b : a;
      if (typeof o === 'string') return o === '';
      if (o instanceof PArr) return o.size() === 0;
      return !vero(o);
    }
    if (numerico(a) && numerico(b)) return num(a) === num(b);
    if (typeof a === 'number' || typeof b === 'number') {
      // PHP 8: numero contro stringa non numerica si confronta come stringhe
      return str(a) === str(b);
    }
    if (typeof a === 'string' && typeof b === 'string') return a === b;
    if (a instanceof PArr && b instanceof PArr) {
      if (a.size() !== b.size()) return false;
      return a.entries().every(function (e) { return b.has(e[0]) && uguale(e[1], b.get(e[0])); });
    }
    return false;
  }
  function confronta(a, b) {   // -1 / 0 / 1
    if ((numerico(a) || a === null || typeof a === 'boolean') && (numerico(b) || b === null || typeof b === 'boolean')) {
      var x = num(a), y = num(b); return x < y ? -1 : x > y ? 1 : 0;
    }
    var s = str(a), t = str(b); return s < t ? -1 : s > t ? 1 : 0;
  }
  function copia(v) { return v instanceof PArr ? v.clone() : v; }

  // ------------------------------------------------------------------ lessico
  var PUNTI = ['===', '!==', '<=>', '**=', '...', '==', '!=', '<>', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=',
    '.=', '%=', '->', '=>', '::', '??', '+', '-', '*', '/', '%', '.', '=', '<', '>', '!', '?', ':', '(', ')', '[', ']', '{',
    '}', ',', ';', '&', '|', '@'];
  function lessico(src) {
    var t = [], i = 0, n = src.length;
    while (i < n) {
      var c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '/' && src[i + 1] === '/' || c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2); if (i < 0) i = n; else i += 2; continue; }
      if (c === '$' && /[A-Za-z_]/.test(src[i + 1])) {
        var j = i + 1; while (j < n && /\w/.test(src[j])) j++;
        t.push({ t: 'var', v: src.slice(i + 1, j) }); i = j; continue;
      }
      if (/\d/.test(c) || (c === '.' && /\d/.test(src[i + 1]))) {
        var m = /^\d*\.?\d+([eE][+-]?\d+)?|^\d+/.exec(src.slice(i));
        t.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        var k = i; while (k < n && /\w/.test(src[k])) k++;
        t.push({ t: 'id', v: src.slice(i, k) }); i = k; continue;
      }
      if (c === "'" || c === '"') {
        var q = c, s = '', p = i + 1;
        while (p < n && src[p] !== q) {
          if (src[p] === '\\' && p + 1 < n) {
            var e = src[p + 1];
            if (q === "'") { s += (e === "'" || e === '\\') ? e : '\\' + e; }
            else s += ({ n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', $: '$' })[e] || ('\\' + e);
            p += 2;
          } else s += src[p++];
        }
        t.push({ t: 'str', v: s }); i = p + 1; continue;
      }
      var trovato = null;
      for (var z = 0; z < PUNTI.length; z++) { if (src.startsWith(PUNTI[z], i)) { trovato = PUNTI[z]; break; } }
      if (!trovato) throw new Error('PHP: carattere inatteso ' + JSON.stringify(c) + ' in ' + src.slice(Math.max(0, i - 30), i + 30));
      t.push({ t: 'op', v: trovato }); i += trovato.length;
    }
    t.push({ t: 'eof' });
    return t;
  }

  // ------------------------------------------------------------------ sintassi
  function Parser(tok) { this.k = tok; this.i = 0; }
  Parser.prototype.pk = function (o) { return this.k[this.i + (o || 0)]; };
  Parser.prototype.is = function (tipo, v) {
    var x = this.k[this.i];
    if (tipo === 'id') return x.t === 'id' && (v === undefined || x.v.toLowerCase() === v);
    return x.t === tipo && (v === undefined || x.v === v);
  };
  Parser.prototype.op = function (v) { return this.is('op', v); };
  Parser.prototype.mangia = function (tipo, v) {
    if (!this.is(tipo, v)) {
      var x = this.k[this.i];
      throw new Error('PHP: atteso ' + (v || tipo) + ' ma trovato ' + (x.v !== undefined ? x.v : x.t) + ' (token ' + this.i + ')');
    }
    return this.k[this.i++];
  };
  Parser.prototype.programma = function () {
    var s = [];
    while (!this.is('eof')) s.push(this.istruzione());
    return { k: 'blocco', s: s };
  };
  Parser.prototype.blocco = function () {
    if (this.op('{')) {
      this.i++; var s = [];
      while (!this.op('}')) s.push(this.istruzione());
      this.i++; return { k: 'blocco', s: s };
    }
    return this.istruzione();
  };
  Parser.prototype.istruzione = function () {
    if (this.op('{')) return this.blocco();
    if (this.op(';')) { this.i++; return { k: 'vuoto' }; }
    if (this.is('id', 'if')) {
      this.i++; this.mangia('op', '('); var c = this.espr(); this.mangia('op', ')');
      var allora = this.blocco(), altrimenti = null;
      if (this.is('id', 'elseif')) { this.k[this.i] = { t: 'id', v: 'if' }; altrimenti = this.istruzione(); }
      else if (this.is('id', 'else')) {
        this.i++;
        altrimenti = this.blocco();
      }
      return { k: 'if', c: c, a: allora, b: altrimenti };
    }
    if (this.is('id', 'for')) {
      this.i++; this.mangia('op', '(');
      var ini = this.lista(';'); this.mangia('op', ';');
      var cond = this.lista(';'); this.mangia('op', ';');
      var passo = this.lista(')'); this.mangia('op', ')');
      return { k: 'for', ini: ini, c: cond, p: passo, s: this.blocco() };
    }
    if (this.is('id', 'foreach')) {
      this.i++; this.mangia('op', '('); var sorg = this.espr(); this.mangia('id', 'as');
      var kv = null, vv = this.mangia('var').v;
      if (this.op('=>')) { this.i++; kv = vv; vv = this.mangia('var').v; }
      this.mangia('op', ')');
      return { k: 'foreach', e: sorg, kv: kv, vv: vv, s: this.blocco() };
    }
    if (this.is('id', 'while')) {
      this.i++; this.mangia('op', '('); var w = this.espr(); this.mangia('op', ')');
      return { k: 'while', c: w, s: this.blocco() };
    }
    if (this.is('id', 'break') || this.is('id', 'continue')) {
      var tipo = this.k[this.i++].v.toLowerCase(), liv = 1;
      if (this.is('num')) liv = this.k[this.i++].v;
      this.mangia('op', ';');
      return { k: tipo, n: liv };
    }
    if (this.is('id', 'return')) {
      this.i++; var r = this.op(';') ? null : this.espr(); this.mangia('op', ';');
      return { k: 'return', e: r };
    }
    var e = this.espr(); this.mangia('op', ';');
    return { k: 'espr', e: e };
  };
  Parser.prototype.lista = function (fine) {
    var l = [];
    if (this.op(fine)) return l;
    l.push(this.espr());
    while (this.op(',')) { this.i++; l.push(this.espr()); }
    return l;
  };
  // precedenza: or < and < = < ?: < || < && < == < relazionali < + - . < * / % < unari < postfissi
  Parser.prototype.espr = function () { return this.bassoOr(); };
  Parser.prototype.bassoOr = function () {
    var a = this.bassoAnd();
    while (this.is('id', 'or') || this.is('id', 'xor')) { var o = this.k[this.i++].v.toLowerCase(); a = { k: 'bin', o: o === 'or' ? '||' : 'xor', a: a, b: this.bassoAnd() }; }
    return a;
  };
  Parser.prototype.bassoAnd = function () {
    var a = this.assegna();
    while (this.is('id', 'and')) { this.i++; a = { k: 'bin', o: '&&', a: a, b: this.assegna() }; }
    return a;
  };
  var ASSEGNA = { '=': 1, '+=': 1, '-=': 1, '*=': 1, '/=': 1, '.=': 1, '%=': 1 };
  Parser.prototype.assegna = function () {
    var a = this.ternario();
    if (this.is('op') && ASSEGNA[this.pk().v]) {
      var o = this.k[this.i++].v;
      if (['var', 'idx', 'prop'].indexOf(a.k) < 0) throw new Error('PHP: assegnazione a un valore non assegnabile');
      return { k: 'ass', o: o, a: a, b: this.assegna() };
    }
    return a;
  };
  Parser.prototype.ternario = function () {
    var c = this.or();
    while (this.op('?')) {
      this.i++;
      if (this.op(':')) { this.i++; c = { k: 'elvis', a: c, b: this.assegna() }; continue; }
      var a = this.assegna(); this.mangia('op', ':'); var b = this.assegna();
      c = { k: 'tern', c: c, a: a, b: b };
    }
    return c;
  };
  function binario(sotto, ops) {
    return function () {
      var a = this[sotto]();
      while (this.is('op') && ops.indexOf(this.pk().v) >= 0) { var o = this.k[this.i++].v; a = { k: 'bin', o: o, a: a, b: this[sotto]() }; }
      return a;
    };
  }
  Parser.prototype.or = binario('and', ['||']);
  Parser.prototype.and = binario('ugu', ['&&']);
  Parser.prototype.ugu = binario('rel', ['==', '!=', '<>', '===', '!==']);
  Parser.prototype.rel = binario('som', ['<', '>', '<=', '>=']);
  Parser.prototype.som = binario('mol', ['+', '-', '.']);
  Parser.prototype.mol = binario('una', ['*', '/', '%']);
  Parser.prototype.una = function () {
    if (this.op('!')) { this.i++; return { k: 'non', e: this.una() }; }
    if (this.op('-')) { this.i++; return { k: 'neg', e: this.una() }; }
    if (this.op('+')) { this.i++; return { k: 'pos', e: this.una() }; }
    if (this.op('@')) { this.i++; return this.una(); }
    if (this.op('++') || this.op('--')) { var o = this.k[this.i++].v; return { k: 'pre', o: o, e: this.una() }; }
    if (this.op('(') && this.pk(1).t === 'id' && /^(int|integer|float|string|bool|array)$/i.test(this.pk(1).v) && this.pk(2).v === ')') {
      var tipo = this.pk(1).v.toLowerCase(); this.i += 3; return { k: 'cast', t: tipo, e: this.una() };
    }
    return this.post();
  };
  Parser.prototype.post = function () {
    var e = this.primario();
    for (;;) {
      if (this.op('[')) {
        this.i++;
        if (this.op(']')) { this.i++; e = { k: 'idx', b: e, e: null }; continue; }
        var x = this.espr(); this.mangia('op', ']'); e = { k: 'idx', b: e, e: x }; continue;
      }
      if (this.op('->')) {
        this.i++;
        var nome, dyn = null;
        if (this.is('var')) dyn = { k: 'var', n: this.k[this.i++].v };      // $obj->$nome
        else nome = this.mangia('id').v;
        if (this.op('(')) { this.i++; var args = this.lista(')'); this.mangia('op', ')'); e = { k: 'met', o: e, n: nome, dn: dyn, a: args }; }
        else e = { k: 'prop', o: e, n: nome, dn: dyn };
        continue;
      }
      if (this.op('++') || this.op('--')) { e = { k: 'postinc', o: this.k[this.i++].v, e: e }; continue; }
      return e;
    }
  };
  Parser.prototype.arrayLett = function (chiusa) {
    var el = [];
    while (!this.op(chiusa)) {
      var v = this.espr(), k = null;
      if (this.op('=>')) { this.i++; k = v; v = this.espr(); }
      el.push({ k: k, v: v });
      if (this.op(',')) this.i++; else break;
    }
    this.mangia('op', chiusa);
    return { k: 'arr', el: el };
  };
  Parser.prototype.primario = function () {
    var x = this.pk();
    if (x.t === 'num') { this.i++; return { k: 'lett', v: x.v }; }
    if (x.t === 'str') { this.i++; return { k: 'lett', v: x.v }; }
    if (x.t === 'var') { this.i++; return { k: 'var', n: x.v }; }
    if (this.op('(')) { this.i++; var e = this.espr(); this.mangia('op', ')'); return e; }
    if (this.op('[')) { this.i++; return this.arrayLett(']'); }
    if (x.t === 'id') {
      var low = x.v.toLowerCase();
      this.i++;
      if (low === 'true') return { k: 'lett', v: true };
      if (low === 'false') return { k: 'lett', v: false };
      if (low === 'null') return { k: 'lett', v: null };
      if (low === 'array' && this.op('(')) { this.i++; return this.arrayLett(')'); }
      if (this.op('(')) { this.i++; var a = this.lista(')'); this.mangia('op', ')'); return { k: 'fun', n: low, a: a }; }
      return { k: 'lett', v: x.v };   // costante sconosciuta: PHP la tratta come stringa
    }
    throw new Error('PHP: espressione inattesa ' + (x.v !== undefined ? x.v : x.t));
  };

  // ------------------------------------------------------------------ esecuzione
  function Interrompi(n) { this.n = n; }
  function Continua(n) { this.n = n; }
  function Ritorna(v) { this.v = v; }

  function Esecutore(ambiente) {
    this.v = new Map();                 // variabili locali
    this.rng = ambiente.rng;            // () -> [0,1)
    this.passi = 0;
    var self = this;
    Object.keys(ambiente.variabili || {}).forEach(function (k) { self.v.set(k, ambiente.variabili[k]); });
  }
  Esecutore.prototype.intero = function (a, b) { return a + Math.floor(this.rng() * (b - a + 1)); };

  Esecutore.prototype.esegui = function (n) {
    switch (n.k) {
      case 'blocco': for (var i = 0; i < n.s.length; i++) this.esegui(n.s[i]); return;
      case 'vuoto': return;
      case 'espr': this.val(n.e); return;
      case 'if': if (vero(this.val(n.c))) this.esegui(n.a); else if (n.b) this.esegui(n.b); return;
      case 'for':
        var j;
        for (j = 0; j < n.ini.length; j++) this.val(n.ini[j]);
        for (;;) {
          var ok = true;
          for (j = 0; j < n.c.length; j++) ok = vero(this.val(n.c[j]));
          if (!ok) break;
          if (this.ciclo(n.s)) break;
          for (j = 0; j < n.p.length; j++) this.val(n.p[j]);
        }
        return;
      case 'while':
        while (vero(this.val(n.c))) { if (this.ciclo(n.s)) break; }
        return;
      case 'foreach':
        var sorg = this.val(n.e);
        if (!(sorg instanceof PArr)) return;
        var voci = sorg.entries();         // PHP itera su una copia
        for (var q = 0; q < voci.length; q++) {
          if (n.kv) this.v.set(n.kv, voci[q][0]);
          this.v.set(n.vv, copia(voci[q][1]));
          if (this.ciclo(n.s)) break;
        }
        return;
      case 'break': throw new Interrompi(n.n);
      case 'continue': throw new Continua(n.n);
      case 'return': throw new Ritorna(n.e ? this.val(n.e) : null);
    }
    throw new Error('PHP: istruzione sconosciuta ' + n.k);
  };
  // esegue il corpo di un ciclo; true = uscire dal ciclo
  Esecutore.prototype.ciclo = function (corpo) {
    if (++this.passi > 200000) throw new Error('PHP: ciclo senza fine');
    try { this.esegui(corpo); }
    catch (e) {
      if (e instanceof Interrompi) { if (e.n > 1) throw new Interrompi(e.n - 1); return true; }
      if (e instanceof Continua) { if (e.n > 1) throw new Continua(e.n - 1); return false; }
      throw e;
    }
    return false;
  };

  // contenitore da scrivere (crea l'array se manca, come fa PHP)
  Esecutore.prototype.contenitore = function (n) {
    var c;
    if (n.k === 'var') {
      c = this.v.get(n.n);
      if (!(c instanceof PArr)) { c = new PArr(); this.v.set(n.n, c); }
      return c;
    }
    if (n.k === 'idx') {
      var padre = this.contenitore(n.b);
      if (n.e === null) { c = new PArr(); padre.push(c); return c; }
      var k = this.val(n.e);
      c = padre.get(k);
      if (!(c instanceof PArr)) { c = new PArr(); padre.set(k, c); }
      return c;
    }
    if (n.k === 'prop') {
      var o = this.val(n.o), pn = this.nomeProp(n);
      c = o[pn];
      if (!(c instanceof PArr)) { c = new PArr(); o[pn] = c; }
      return c;
    }
    throw new Error('PHP: non e\' un contenitore');
  };
  Esecutore.prototype.scrivi = function (n, v) {
    v = copia(v);
    if (n.k === 'var') { this.v.set(n.n, v); return v; }
    if (n.k === 'idx') {
      var c = this.contenitore(n.b);
      if (n.e === null) c.push(v); else c.set(this.val(n.e), v);
      return v;
    }
    if (n.k === 'prop') { var o = this.val(n.o); o[this.nomeProp(n)] = v; return v; }
    throw new Error('PHP: non assegnabile');
  };
  Esecutore.prototype.nomeProp = function (n) { return n.dn ? str(this.val(n.dn)) : n.n; };
  Esecutore.prototype.aritmetica = function (o, a, b) {
    switch (o) {
      case '+':
        if (a instanceof PArr && b instanceof PArr) { var u = a.clone(); b.entries().forEach(function (e) { if (!u.has(e[0])) u.set(e[0], copia(e[1])); }); return u; }
        return num(a) + num(b);
      case '-': return num(a) - num(b);
      case '*': return num(a) * num(b);
      case '/': if (num(b) === 0) throw new Error('PHP: divisione per zero'); return num(a) / num(b);
      case '%': var d = Math.trunc(num(b)); if (d === 0) throw new Error('PHP: modulo per zero'); return Math.trunc(num(a)) % d;
      case '.': return str(a) + str(b);
    }
    throw new Error('PHP: operatore ' + o);
  };
  Esecutore.prototype.val = function (n) {
    switch (n.k) {
      case 'lett': return n.v;
      case 'var': var x = this.v.get(n.n); return x === undefined ? null : x;
      case 'arr':
        var a = new PArr();
        for (var i = 0; i < n.el.length; i++) {
          var v = copia(this.val(n.el[i].v));
          if (n.el[i].k) a.set(this.val(n.el[i].k), v); else a.push(v);
        }
        return a;
      case 'idx':
        if (n.e === null) throw new Error('PHP: [] in lettura');
        var b = this.val(n.b), k = this.val(n.e);
        if (b instanceof PArr) return b.get(k);
        if (typeof b === 'string') return b.charAt(num(k)) || null;
        return null;
      case 'prop':
        var o = this.val(n.o);
        if (o === null || o === undefined) return null;
        var pv = o[this.nomeProp(n)]; return pv === undefined ? null : pv;
      case 'met':
        var ogg = this.val(n.o), mn = this.nomeProp(n);
        if (!ogg || typeof ogg[mn] !== 'function') throw new Error('PHP: metodo sconosciuto ' + mn);
        var args = [];
        for (var z = 0; z < n.a.length; z++) args.push(this.val(n.a[z]));
        return ogg[mn].apply(ogg, args);
      case 'fun': return this.funzione(n.n, n.a);
      case 'ass':
        if (n.o === '=') return this.scrivi(n.a, this.val(n.b));
        var att = this.val(n.a), dx = this.val(n.b);
        return this.scrivi(n.a, this.aritmetica(n.o.charAt(0), att, dx));
      case 'pre':
        var nuovo = num(this.val(n.e)) + (n.o === '++' ? 1 : -1);
        return this.scrivi(n.e, nuovo);
      case 'postinc':
        var vecchio = this.val(n.e);
        this.scrivi(n.e, num(vecchio) + (n.o === '++' ? 1 : -1));
        return vecchio === null ? null : num(vecchio);
      case 'non': return !vero(this.val(n.e));
      case 'neg': return -num(this.val(n.e));
      case 'pos': return num(this.val(n.e));
      case 'cast':
        var cv = this.val(n.e);
        if (n.t === 'int' || n.t === 'integer') return Math.trunc(num(cv));
        if (n.t === 'float') return num(cv);
        if (n.t === 'string') return str(cv);
        if (n.t === 'bool') return vero(cv);
        return cv instanceof PArr ? cv : PArr.lista(cv === null ? [] : [cv]);
      case 'tern': return vero(this.val(n.c)) ? this.val(n.a) : this.val(n.b);
      case 'elvis': var ev = this.val(n.a); return vero(ev) ? ev : this.val(n.b);
      case 'bin':
        switch (n.o) {
          case '&&': return vero(this.val(n.a)) && vero(this.val(n.b));
          case '||': return vero(this.val(n.a)) || vero(this.val(n.b));
          case 'xor': return vero(this.val(n.a)) !== vero(this.val(n.b));
        }
        var l = this.val(n.a), r = this.val(n.b);
        switch (n.o) {
          case '==': return uguale(l, r);
          case '!=': case '<>': return !uguale(l, r);
          case '===': return l === r || (l instanceof PArr && r instanceof PArr && uguale(l, r));
          case '!==': return !(l === r);
          case '<': return confronta(l, r) < 0;
          case '>': return confronta(l, r) > 0;
          case '<=': return confronta(l, r) <= 0;
          case '>=': return confronta(l, r) >= 0;
        }
        return this.aritmetica(n.o, l, r);
    }
    throw new Error('PHP: nodo sconosciuto ' + n.k);
  };

  // ------------------------------------------------------------------ libreria
  function arrotonda(x, p) {
    var f = Math.pow(10, p || 0), y = Math.abs(x) * f;
    var r = Math.floor(y + 0.5 + 1e-9);
    return (x < 0 ? -r : r) / f;
  }
  Esecutore.prototype.arr = function (n, nome) {
    var v = this.val(n);
    if (!(v instanceof PArr)) throw new Error('PHP: ' + nome + '() vuole un array');
    return v;
  };
  Esecutore.prototype.mescola = function (lista) {
    for (var i = lista.length - 1; i > 0; i--) { var j = this.intero(0, i), t = lista[i]; lista[i] = lista[j]; lista[j] = t; }
    return lista;
  };
  Esecutore.prototype.funzione = function (nome, a) {
    var self = this, r, i, v;
    switch (nome) {
      case 'isset':
        for (i = 0; i < a.length; i++) { v = this.val(a[i]); if (v === null || v === undefined) return false; }
        return true;
      case 'empty': return !vero(this.val(a[0]));
      case 'unset':
        a.forEach(function (x) {
          if (x.k === 'var') self.v.delete(x.n);
          else if (x.k === 'idx') { var c = self.val(x.b); if (c instanceof PArr) c.del(self.val(x.e)); }
          else if (x.k === 'prop') { var o = self.val(x.o); if (o) o[self.nomeProp(x)] = null; }
        });
        return null;
      case 'count': case 'sizeof': v = this.val(a[0]); return v instanceof PArr ? v.size() : (v === null ? 0 : 1);
      case 'min': case 'max':
        var vals = a.length === 1 ? this.arr(a[0], nome).values() : a.map(function (x) { return self.val(x); });
        if (!vals.length) throw new Error('PHP: ' + nome + '() di un array vuoto');
        r = vals[0];
        for (i = 1; i < vals.length; i++) {
          var c = confronta(vals[i], r);
          if (nome === 'min' ? c < 0 : c > 0) r = vals[i];
        }
        return r;
      case 'round': return arrotonda(num(this.val(a[0])), a[1] ? num(this.val(a[1])) : 0);
      case 'floor': return Math.floor(num(this.val(a[0])));
      case 'ceil': return Math.ceil(num(this.val(a[0])));
      case 'abs': return Math.abs(num(this.val(a[0])));
      case 'intval': return Math.trunc(num(this.val(a[0])));
      case 'mt_rand': case 'rand':
        if (!a.length) return this.intero(0, 2147483647);
        return this.intero(Math.trunc(num(this.val(a[0]))), Math.trunc(num(this.val(a[1]))));
      case 'pow': return Math.pow(num(this.val(a[0])), num(this.val(a[1])));
      case 'shuffle':
        v = this.arr(a[0], nome);
        var mescolati = this.mescola(v.values());
        v.m.clear(); v.next = 0; mescolati.forEach(function (x) { v.push(x); });
        return true;
      case 'sort': case 'rsort':
        v = this.arr(a[0], nome);
        var ord = v.values().sort(confronta); if (nome === 'rsort') ord.reverse();
        v.m.clear(); v.next = 0; ord.forEach(function (x) { v.push(x); });
        return true;
      case 'asort': case 'arsort':
        v = this.arr(a[0], nome);
        var voci = v.entries().sort(function (p, q) { return confronta(p[1], q[1]); }); if (nome === 'arsort') voci.reverse();
        v.m.clear(); voci.forEach(function (e) { v.m.set(e[0], e[1]); });
        return true;
      case 'array_merge':
        r = new PArr();
        a.forEach(function (x) {
          var src = self.val(x); if (!(src instanceof PArr)) throw new Error('PHP: array_merge() vuole array');
          src.entries().forEach(function (e) { if (typeof e[0] === 'number') r.push(copia(e[1])); else r.set(e[0], copia(e[1])); });
        });
        return r;
      case 'in_array':
        var ago = this.val(a[0]), pagliaio = this.arr(a[1], nome), stretto = a[2] ? vero(this.val(a[2])) : false;
        return pagliaio.values().some(function (x) { return stretto ? x === ago : uguale(x, ago); });
      case 'array_search':
        var cerca = this.val(a[0]), dove = this.arr(a[1], nome);
        var trov = dove.entries().find(function (e) { return uguale(e[1], cerca); });
        return trov ? trov[0] : false;
      case 'array_pop':
        v = this.arr(a[0], nome); if (!v.size()) return null;
        var ku = v.keys()[v.size() - 1]; r = v.get(ku); v.del(ku); v.ricalcola(); return r;
      case 'array_shift':
        v = this.arr(a[0], nome); if (!v.size()) return null;
        var vv = v.entries(); r = vv[0][1];
        v.m.clear(); v.next = 0;
        vv.slice(1).forEach(function (e) { if (typeof e[0] === 'number') v.push(e[1]); else v.m.set(e[0], e[1]); });
        return r;
      case 'array_diff':
        var base = this.arr(a[0], nome), altri = a.slice(1).map(function (x) { return self.arr(x, nome).values().map(str); });
        r = new PArr();
        base.entries().forEach(function (e) { if (!altri.some(function (l) { return l.indexOf(str(e[1])) >= 0; })) r.set(e[0], copia(e[1])); });
        return r;
      case 'array_intersect':
        var b1 = this.arr(a[0], nome), others = a.slice(1).map(function (x) { return self.arr(x, nome).values().map(str); });
        r = new PArr();
        b1.entries().forEach(function (e) { if (others.every(function (l) { return l.indexOf(str(e[1])) >= 0; })) r.set(e[0], copia(e[1])); });
        return r;
      case 'array_unique':
        var visti = {}; r = new PArr();
        this.arr(a[0], nome).entries().forEach(function (e) { var s = str(e[1]); if (!visti[s]) { visti[s] = 1; r.set(e[0], copia(e[1])); } });
        return r;
      case 'array_rand':
        v = this.arr(a[0], nome); var quanti = a[1] ? Math.trunc(num(this.val(a[1]))) : 1, chiavi = v.keys();
        if (!chiavi.length || quanti > chiavi.length) throw new Error('PHP: array_rand() su array troppo corto');
        if (quanti === 1) return chiavi[this.intero(0, chiavi.length - 1)];
        var scelti = this.mescola(chiavi.map(function (x, j) { return j; })).slice(0, quanti).sort(function (p, q) { return p - q; });
        return PArr.lista(scelti.map(function (j) { return chiavi[j]; }));
      case 'array_keys': return PArr.lista(this.arr(a[0], nome).keys());
      case 'array_values': return PArr.lista(this.arr(a[0], nome).values().map(copia));
      case 'array_sum': return this.arr(a[0], nome).values().reduce(function (s, x) { return s + num(x); }, 0);
      case 'array_fill':
        var da = Math.trunc(num(this.val(a[0]))), nn = Math.trunc(num(this.val(a[1]))), riemp = this.val(a[2]);
        r = new PArr(); for (i = 0; i < nn; i++) r.set(da + i, copia(riemp)); return r;
      case 'range':
        var ra = num(this.val(a[0])), rb = num(this.val(a[1])); r = new PArr();
        if (ra <= rb) for (i = ra; i <= rb; i++) r.push(i); else for (i = ra; i >= rb; i--) r.push(i);
        return r;
      case 'is_array': return this.val(a[0]) instanceof PArr;
      case 'is_numeric': return numerico(this.val(a[0]));
      case 'strpos':
        var pos = str(this.val(a[0])).indexOf(str(this.val(a[1]))); return pos < 0 ? false : pos;
      case 'strtolower': return str(this.val(a[0])).toLowerCase();
      case 'implode': return this.arr(a[1], nome).values().map(str).join(str(this.val(a[0])));
    }
    throw new Error('PHP: funzione non supportata ' + nome + '()');
  };

  // ------------------------------------------------------------------ interfaccia
  var cache = new Map();
  function compila(codice) {
    var ast = cache.get(codice);
    if (!ast) { ast = new Parser(lessico(codice)).programma(); cache.set(codice, ast); }
    return ast;
  }
  // esegue il codice con le variabili date (es. { t: contesto, this: contesto }) e un generatore casuale
  function esegui(codice, variabili, rng) {
    if (!codice) return null;
    var ex = new Esecutore({ variabili: variabili, rng: rng || Math.random });
    try { ex.esegui(compila(codice)); }
    catch (e) { if (e instanceof Ritorna) return e.v; throw e; }
    finally { if (PHP.osserva) PHP.osserva(codice, ex.v); }   // solo per le prove (strumenti/prova-variabili.js)
    return null;
  }

  var PHP = { PArr: PArr, esegui: esegui, compila: compila, vero: vero, uguale: uguale, num: num, str: str, arrotonda: arrotonda };
  if (typeof module !== 'undefined' && module.exports) module.exports = PHP;
  else radice.PHP = PHP;
})(typeof window !== 'undefined' ? window : globalThis);
