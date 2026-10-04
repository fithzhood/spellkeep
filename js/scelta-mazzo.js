// Scelta del mazzo: al posto dei bottoni numerati (a 30 mazzi bisognava ricordarsi quale numero era quale), un pulsante
// con il mazzo attuale che apre una griglia di tutti i mazzi. Ogni casella si riconosce a colpo d'occhio: nome, token,
// tre carte di punta, barretta dei colori di costo e stato (completo o quante carte mancano). Usato nell'editor e nella
// scelta dell'avversario.
//   SceltaMazzo.pulsante(app, i, function (k) { ... })   -> elemento da mettere in pagina
//   SceltaMazzo.apri(app, i, function (k) { ... })
(function (radice) {
  'use strict';
  var el = UI.el;
  var COLORI = [['b', 'var(--mat)'], ['g', 'var(--gem)'], ['r', 'var(--rec)'], ['m', 'var(--mix)'], ['z', 'var(--zero)']];

  function arte(id) {
    return window.ARTE && window.ARTE.has(id) ? 'img/arte/card_' + id + '.jpg?h=' + ((window.ARTE_H || {})[id] || '') : 'img/carte/card_' + id + '.png';
  }
  function tutte(m) { return m.C.concat(m.U, m.R); }
  function costo(d) { return d.costo.b + d.costo.g + d.costo.r; }
  // le carte di punta: rare (poi non comuni) piu' costose
  function punta(m) {
    var l = tutte(m).map(UI.dati).sort(function (a, b) { return 'RUC'.indexOf(a.rarita) - 'RUC'.indexOf(b.rarita) || costo(b) - costo(a); });
    return l.slice(0, 3);
  }
  function barra(m) {
    var n = {}, tot = 0;
    tutte(m).forEach(function (id) { var t = UI.tipo(UI.dati(id)); n[t] = (n[t] || 0) + 1; tot++; });
    if (!tot) return '<div class="sm-barra vuota"></div>';
    return '<div class="sm-barra">' + COLORI.filter(function (c) { return n[c[0]]; }).map(function (c) {
      return '<i style="flex:' + n[c[0]] + ';background:' + c[1] + '"></i>'; }).join('') + '</div>';
  }
  function stato(pr, m) {
    var n = m.C.length + m.U.length + m.R.length;
    return pr.mazzoValido(m) ? '<span class="sm-ok">45/45 ✓</span>' : '<span class="sm-no">' + n + '/45</span>';
  }
  function token(m) {
    var t = (m.segnalini || [])[0];
    return t ? '<img class="sm-tok" src="' + UI.kwIcona(t) + '" alt="" title="' + t + ' token">' : '';
  }

  function pulsante(app, i, scegli) {
    var pr = app.profilo, m = pr.mazzo(i);
    var b = el('button', 'sm-pulsante' + (pr.mazzoValido(m) ? '' : ' no'),
      token(m) + '<span class="sm-nome">' + m.nome + '</span>' + stato(pr, m) + '<i class="sm-freccia">▾</i>');
    b.addEventListener('click', function () { apri(app, i, scegli); });
    return b;
  }

  function apri(app, i, scegli) {
    var pr = app.profilo, d = pr.d;
    var velo = el('div', 'velo-mazzi'), p = el('div', 'pannello scelta-mazzi');
    p.innerHTML = '<div class="sm-testa"><b>Your decks</b><small>' + d.mazzi.length + ' of ' + ECONOMIA_SLOT() + ' slots' +
      (d.mazzi.length < ECONOMIA_SLOT() ? ' · more in the Shop' : '') + '</small><button class="sm-chiudi" aria-label="Close">×</button></div><div class="sm-griglia"></div>';
    var g = p.querySelector('.sm-griglia');
    d.mazzi.forEach(function (m, k) {
      var c = el('button', 'sm-casella' + (k === i ? ' su' : '') + (pr.mazzoValido(m) ? '' : ' no'));
      c.innerHTML = '<div class="sm-riga">' + token(m) + '<span class="sm-nome">' + m.nome + '</span></div>' +
        '<div class="sm-carte">' + punta(m).map(function (x) { return '<img src="' + arte(x.id) + '" alt="" loading="lazy">'; }).join('') + '</div>' +
        barra(m) + '<div class="sm-piede">' + stato(pr, m) + (k === i ? '<span class="sm-attivo">Selected</span>' : '') + '</div>';
      c.addEventListener('click', function () { velo.remove(); if (k !== i) scegli(k); });
      g.appendChild(c);
    });
    p.querySelector('.sm-chiudi').addEventListener('click', function () { velo.remove(); });
    velo.addEventListener('click', function (ev) { if (ev.target === velo) velo.remove(); });
    velo.appendChild(p); document.body.appendChild(velo);
    var su = g.querySelector('.su'); if (su) su.scrollIntoView({ block: 'nearest' });
  }
  function ECONOMIA_SLOT() { return (window.Profilo && Profilo.ECONOMIA && Profilo.ECONOMIA.slotMassimi) || 30; }

  radice.SceltaMazzo = { pulsante: pulsante, apri: apri };
})(window);
