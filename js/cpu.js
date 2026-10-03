// CPU nuova: simula prima di scegliere.
// Per ogni mossa possibile (ogni carta giocabile in ogni suo modo, e ogni scarto) gioca K futuri diversi, ciascuno
// lungo D azioni, in cui entrambi i giocatori muovono con la CPU originale (Motore.mossaCpu); poi valuta dove si
// e' arrivati e sceglie la mossa con la media migliore. Una mossa che vince subito si prende sempre.
//
// Niente sbirciate: se le carte sono coperte, in ogni futuro la mano dell'avversario e' ripescata a caso dal suo
// mazzo (come la vede chi gioca). Le pescate future sono a caso in ogni futuro. Gli stessi K futuri valgono per
// tutte le mosse (stessi semi), cosi' le mosse si confrontano sugli stessi imprevisti.
(function (radice) {
  'use strict';
  var M = radice.Motore || (typeof require !== 'undefined' ? require('./motore.js') : null);

  // valori di una posizione, dal punto di vista di chi deve scegliere. Pesi della CPU originale (PESI_BASE),
  // con in piu' la vicinanza alla vittoria: una torre quasi distrutta vale molto piu' del suo numero.
  var PESI = {
    io: { Quarry: 80, Magic: 120, Dungeons: 100, Bricks: 4, Gems: 6, Recruits: 5, Tower: 7.5, Wall: 5 },
    lui: { Quarry: 96, Magic: 144, Dungeons: 120, Bricks: 4.8, Gems: 7.2, Recruits: 6, Tower: 9, Wall: 6 }
  };
  var VITTORIA = 1e6;
  var CONF = { k: 4, pericolo: 400 };

  // CPU del Titano (Ashkar): la collezione di parti DIVERSE in mano vale, e sempre di piu' man mano che si avvicina
  // a cinque (Completion ritual con tutte le parti = vittoria immediata; Wicked ritual = 30 di danno per Titano diverso).
  // Cosi' non le scarta e non le spende per altro: le usa per chiudere con uno dei due rituali.
  var PARTI = [302, 303, 310, 311, 312], RITO = 315, RITO_NERO = 482;
  var TITANO = { parte: 70, rito: 200, ritoNero: 25 };
  function valoreTitano(mano) {
    var v = mano.values().map(function (x) { return +x; }), k = 0;
    PARTI.forEach(function (id) { if (v.indexOf(id) >= 0) k++; });
    return TITANO.parte * k * k + (v.indexOf(RITO) >= 0 && k >= 3 ? TITANO.rito : 0) + (v.indexOf(RITO_NERO) >= 0 ? TITANO.ritoNero * k : 0);
  }

  // passi = quante azioni dopo la mossa scelta e' finita la partita: vincere subito vale piu' che vincere dopo
  function valuta(p, n, passi, titano) {
    if (p.stato !== 'in corso') return (p.vincitore === n ? VITTORIA : p.vincitore === 0 ? 0 : -VITTORIA) * (1 - 0.05 * (passi || 0));
    var io = p.g[n], lui = p.g[p.avversario(n)], cfg = p.cfg, v = 0;
    M.ATTR.forEach(function (a) { v += io[a] * PESI.io[a] - lui[a] * PESI.lui[a]; });
    // torre in pericolo: la difesa (torre + muro) conta di piu' quando si avvicina allo zero
    var miaDifesa = io.Tower + io.Wall * 0.6, suaDifesa = lui.Tower + lui.Wall * 0.6;
    v -= CONF.pericolo * 30 / (miaDifesa + 10);
    v += CONF.pericolo * 30 / (suaDifesa + 10);
    // vittoria per costruzione: ogni piano in cima alla torre vale di piu'
    v += Math.pow(io.Tower / cfg.max_tower, 3) * 400 - Math.pow(lui.Tower / cfg.max_tower, 3) * 400;
    if (titano) v += valoreTitano(io.Hand);
    return v;
  }

  function candidate(p, n) {
    var c = [], mano = p.g[n].Hand;
    for (var pos = 1; pos <= 8; pos++) {
      if (p.giocabile(n, pos)) {
        var d = M.carta(mano.get(pos)).d;
        if (d.modi > 0) for (var m = 1; m <= d.modi; m++) c.push({ azione: 'play', pos: pos, modo: m });
        else c.push({ azione: 'play', pos: pos, modo: 0 });
      }
    }
    for (var q = 1; q <= 8; q++) c.push({ azione: 'discard', pos: q, modo: 0 });
    return c;
  }

  // una mossa, poi la risposta dell'avversario (la CPU originale, con una mano ripescata se e' coperta), e si valuta.
  // Se la risposta gli da' un turno in piu', si segue anche quello (al massimo 3 azioni sue).
  function mossa(p, n, opz) {
    opz = opz || {};
    var K = opz.k || CONF.k, o = p.avversario(n);
    var seme = (opz.seme || 0) * 7919 + p.round * 104729 + (p.g[n].Hand.get(1) | 0);
    var cand = candidate(p, n), meglio = null, vMeglio = -Infinity;
    for (var i = 0; i < cand.length; i++) {
      var c = cand[i], tot = 0, ok = true;
      for (var k = 0; k < K; k++) {
        var q = p.clone(new M.Caso(seme + k * 31337 + 1));
        if (q.nascoste) for (var h = 1; h <= 8; h++) q.g[o].Hand.set(h, q.g[o].Deck.drawCardRandom());
        var r = q.usaCarta(n, c.azione, c.pos, c.modo);
        if (r && r.errore) { ok = false; break; }
        var passi = 0;
        // turno in piu' mio: lo gioca la CPU originale; poi le azioni dell'avversario finche' tocca a lui
        while (q.stato === 'in corso' && q.corrente === n && passi < 3) {
          var m1 = M.mossaCpu(q, n, { seme: k * 17 + passi }); q.usaCarta(n, m1.azione, m1.pos, m1.modo); passi++;
        }
        var sue = 0;
        while (q.stato === 'in corso' && q.corrente === o && sue < 3) {
          var m2 = M.mossaCpu(q, o, { seme: k * 17 + 9 + sue }); q.usaCarta(o, m2.azione, m2.pos, m2.modo); sue++; passi++;
        }
        tot += valuta(q, n, passi, opz.titano);
      }
      if (!ok) continue;
      var v = tot / K;
      if (v > vMeglio) { vMeglio = v; meglio = c; }
    }
    return meglio || M.mossaCpu(p, n, opz);
  }

  var Cpu = { mossa: mossa, valuta: valuta, CONF: CONF, PESI: PESI, TITANO: TITANO };
  if (typeof module !== 'undefined' && module.exports) module.exports = Cpu;
  else radice.Cpu = Cpu;
})(typeof window !== 'undefined' ? window : globalThis);
