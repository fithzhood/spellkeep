// Quantita' variabili nel testo delle carte: "N = #Dragon in game", "Attack: #Altar", "#Beast + #Horde in hand (max 7)".
// Le calcola sullo stato della partita come farebbe la carta giocata adesso (stesse regole del codice originale:
// la carta stessa conta come "in hand", e il suo costo e' gia' pagato), e restituisce il testo con il valore fra
// parentesi: "N = #Dragon in game (N=5)", "Attack: #Altar (=4)".
// Quello che dipende dal passato (carte scartate, ultima carta giocata, cimitero...) non si calcola: niente numero
// piuttosto che un numero sbagliato. La prova contro il motore e' strumenti/prova-variabili.js.
(function (radice) {
  'use strict';
  var M = radice.Motore || (typeof require !== 'undefined' ? require('./motore.js') : null);
  var KW = {};
  function impostaKeyword(lista) { KW = {}; (lista || []).forEach(function (k) { KW[(k.nome || k).toLowerCase()] = k.nome || k; }); }
  impostaKeyword(radice.KEYWORD);

  var EDIFICI = { altar: 'Magic', mine: 'Quarry', lair: 'Dungeons' };
  var RISORSE = { bricks: ['Bricks', 'b'], gems: ['Gems', 'g'], recruits: ['Recruits', 'r'] };

  function mano(g) { return g.Hand.values().map(function (id) { return M.carta(+id); }); }

  // un termine, con il luogo gia' separato (hand, opponent's hand, game) o null
  function termine(t, luogo, c) {
    var m, coeff = 1;
    t = t.trim();
    if (/^\d+$/.test(t)) return +t;
    if ((m = /^(\d+)\s*(#.+)$/.exec(t))) { coeff = +m[1]; t = m[2]; }
    var v = termineSemplice(t, luogo, c);
    return v === null ? null : coeff * v;
  }
  function termineSemplice(t, luogo, c) {
    var io = c.io, lui = c.lui, nome = t.replace(/^#/, '').trim(), basso = nome.toLowerCase();
    if (luogo) {
      var mani = luogo === 'hand' ? [io] : luogo === 'opponent\'s hand' ? [lui] : luogo === 'game' ? [io, lui] : null;
      if (!mani) return null;
      var carte = [];
      mani.forEach(function (g) { carte = carte.concat(mano(g)); });
      if (basso === 'common cards') return carte.filter(function (x) { return x.d.rarita === 'C'; }).length;
      if (basso === 'rare cards') return carte.filter(function (x) { return x.d.rarita === 'R'; }).length - (c.senzaSe === 'rare cards' && c.d.rarita === 'R' && luogo === 'hand' ? 1 : 0);
      if (basso === 'non-common cards') return carte.filter(function (x) { return x.d.rarita !== 'C'; }).length;
      if (basso === 'zero cost cards') return carte.filter(function (x) { return !(x.d.costo.b + x.d.costo.g + x.d.costo.r); }).length;
      if (basso === 'different keywords') {
        var visti = {};
        carte.forEach(function (x) { if (x.d.kw) x.d.kw.split(',').forEach(function (w) { visti[w.split(' (')[0]] = 1; }); });
        return Object.keys(visti).length;
      }
      if (KW[basso]) return carte.filter(function (x) { return x.hasKeyword(KW[basso]); }).length + (basso === 'beast' && luogo === 'game' && c.piuBeast ? 1 : 0);
      return null;
    }
    // valori del castello
    var g = io;
    if (/^enemy /.test(basso)) { g = lui; basso = basso.replace(/^enemy /, ''); }
    if (EDIFICI[basso]) return g[EDIFICI[basso]];
    if (RISORSE[basso]) return Math.max(0, g[RISORSE[basso][0]] - (g === io ? c.d.costo[RISORSE[basso][1]] : 0));
    if (basso === 'stock') return Math.max(0, g.Bricks + g.Gems + g.Recruits - (g === io ? c.d.costo.b + c.d.costo.g + c.d.costo.r : 0));
    if (basso === 'facilities') return g.Quarry + g.Magic + g.Dungeons;
    if (basso === 'tower') return g.Tower;
    if (basso === 'wall') return g.Wall;
    if (basso === 'max wall') return c.p.cfg.max_wall;
    if (basso === 'max tower') return c.p.cfg.max_tower;
    if (basso === 'sum of all facilities') return io.Quarry + io.Magic + io.Dungeons + lui.Quarry + lui.Magic + lui.Dungeons;
    if (basso === 'sum of three highest facilities') {
      return [io.Quarry, io.Magic, io.Dungeons, lui.Quarry, lui.Magic, lui.Dungeons].sort(function (a, b) { return b - a; }).slice(0, 3)
        .reduce(function (a, b) { return a + b; }, 0);
    }
    return null;
  }

  // espressione: termini separati da + - / ; il luogo ("in hand") vale anche per i termini prima che non ne hanno;
  // "(max K)" / "(min K)" limitano quanto accumulato fino a li'
  function valuta(expr, c) {
    var parti = expr.trim().split(/\s([+\-\/])\s/), pezzi = [], ops = [];
    for (var i = 0; i < parti.length; i++) { if (i % 2) ops.push(parti[i]); else pezzi.push(parti[i]); }
    var info = pezzi.map(function (s) {
      var o = { t: s.trim(), luogo: null, cap: null }, m;
      if ((m = /\s*\((max|min) (\d+)\)$/.exec(o.t))) { o.cap = [m[1], +m[2]]; o.t = o.t.slice(0, m.index); }
      if ((m = /\s+in (hand|opponent's hand|game|your graveyard|his hand)$/.exec(o.t))) { o.luogo = m[1]; o.t = o.t.slice(0, m.index); }
      return o;
    });
    for (var k = info.length - 2; k >= 0; k--) if (!info[k].luogo && /^#/.test(info[k].t) && info[k + 1].luogo) info[k].luogo = info[k + 1].luogo;
    var val = [];
    for (var j = 0; j < info.length; j++) {
      var v = termine(info[j].t, info[j].luogo, c);
      if (v === null) return null;
      val.push(v);
    }
    // la divisione lega piu' stretto ("2 + #Enemy tower / 10" = 2 + round(torre / 10)), come nel codice delle carte
    var tv = [val[0]], to = [], tcap = [info[0].cap];
    for (var q = 0; q < ops.length; q++) {
      if (ops[q] === '/') { tv[tv.length - 1] = Math.round(tv[tv.length - 1] / val[q + 1]); if (info[q + 1].cap) tcap[tcap.length - 1] = info[q + 1].cap; }
      else { to.push(ops[q]); tv.push(val[q + 1]); tcap.push(info[q + 1].cap); }
    }
    var acc = 0;
    for (var z = 0; z < tv.length; z++) {
      acc = z === 0 ? tv[0] : to[z - 1] === '+' ? acc + tv[z] : acc - tv[z];
      if (tcap[z]) acc = tcap[z][0] === 'max' ? Math.min(acc, tcap[z][1]) : Math.max(acc, tcap[z][1]);
    }
    return Math.max(0, acc);   // nel codice delle carte le quantita' non vanno sotto zero (max(..., 0))
  }

  // testo della carta con i valori: righe "N = ..." -> (N=5); termini "#..." nel testo -> (=4).
  // Restituisce le righe con i valori fra \u0001 e \u0002, cosi' chi disegna puo' dar loro uno stile.
  // carte il cui codice fa qualcosa prima di contare, o non conta se stessa; e carte da non annotare
  var PRIMA = {
    604: function (c) { var io = Object.create(Object.getPrototypeOf(c.io)); Object.assign(io, c.io); io.Dungeons++; c.io = io; },  // Byakko: Lair +1, poi conta
    699: function (c) { c.senzaSe = 'rare cards'; },                                                                                 // Einzbern castle
    // Beastmaster: prima trasforma in Beast una carta non-Beast dell'avversario (se ce n'e' una), poi conta
    323: function (c) { if (mano(c.lui).some(function (x) { return !x.hasKeyword('Beast'); })) c.piuBeast = 1; }
  };
  var MAI = { 281: 1, 618: 1 };   // Berserker: N e' una frazione (torre / torre massima); Dwarven guard: testo originale anomalo

  function annota(d, p, chi) {
    if (!p || !p.g || !p.g[chi] || MAI[d.id]) return null;
    var c = { p: p, d: d, io: p.g[chi], lui: p.g[chi === 1 ? 2 : 1] }, cambiato = false;
    if (PRIMA[d.id]) PRIMA[d.id](c);
    var righe = d.effetto.split('\n').map(function (r) {
      var m = /^([NM]) = (.+)$/.exec(r);
      if (m) {
        var v = valuta(m[2], c);
        if (v === null) return r;
        cambiato = true; return r + ' \u0001(' + m[1] + '=' + v + ')\u0002';
      }
      if (r.indexOf('#') < 0) return r;
      // ogni tratto che comincia con # e arriva fino a un confronto (< > = and or), a "%" o alla fine della riga
      return r.replace(/#[^<>=\n]*?(?=\s(?:<|>|=|and|or)\s|%|$)/g, function (tratto) {
        var v = valuta(tratto, c);
        if (v === null) return tratto;
        cambiato = true; return tratto + ' \u0001(=' + v + ')\u0002';
      });
    });
    return cambiato ? righe.join('\n') : null;
  }

  var Variabili = { annota: annota, valuta: valuta, impostaKeyword: impostaKeyword };
  if (typeof module !== 'undefined' && module.exports) module.exports = Variabili;
  else radice.Variabili = Variabili;
})(typeof window !== 'undefined' ? window : globalThis);
