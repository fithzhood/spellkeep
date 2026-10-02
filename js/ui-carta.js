// Pezzi d'interfaccia comuni: disegno delle carte, lente (carta grande con le keyword spiegate a lato),
// icone, avvisi, piccoli aiuti.
(function (radice) {
  'use strict';
  var KW = {};
  (window.KEYWORD || []).forEach(function (k) { KW[k.nome] = k; });

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function icona(nome) {
    return '<svg viewBox="0 0 512 512" aria-hidden="true">' + (window.ICONE[nome] || []).map(function (d) {
      return '<path fill="currentColor" d="' + d + '"/>'; }).join('') + '</svg>';
  }
  function segno(v, cls) {
    v = Math.round(v || 0);
    return v ? '<span class="' + cls + ' ' + (v > 0 ? 'su' : 'giu') + '">' + (v > 0 ? '+' : '−') + Math.abs(v) + '</span>' : '';
  }
  function moneta(n) { return '<span class="moneta"><i></i>' + n + '</span>'; }
  function avviso(testo) {
    var a = el('div', 'avviso', testo);
    document.body.appendChild(a);
    setTimeout(function () { a.remove(); }, 2300);
  }
  function scuoti(e) { e.classList.remove('scuoti'); void e.offsetWidth; e.classList.add('scuoti'); }

  function dati(id) { return window.Motore.catalogo.perId[id]; }
  function tipo(d) {
    var k = ['b', 'g', 'r'].filter(function (n) { return d.costo[n] > 0; });
    return k.length === 0 ? 'z' : k.length > 1 ? 'm' : k[0];
  }
  function kwNome(k) { return k.replace(/\s*\(.*\)$/, ''); }
  function kwFile(k) { return kwNome(k).toLowerCase().replace(/ /g, '_') + '.png'; }
  function kwIcona(k) { return 'img/keyword/' + kwFile(k); }
  // testo della carta: le keyword citate in grassetto
  function testoEffetto(d) {
    var t = d.effetto.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    Object.keys(KW).forEach(function (k) { t = t.replace(new RegExp('\\b(' + k + ')\\b', 'g'), '<b>$1</b>'); });
    return t;
  }

  // opz: { risorse: {b,g,r} per colorare i costi che mancano, spenta, nuova, mini }
  function carta(id, opz) {
    opz = opz || {};
    var d = dati(id), e = el('div', 'carta ' + tipo(d) + (opz.mini ? ' mini' : '') + (opz.spenta ? ' spenta' : '') + (opz.nuova ? ' nuova' : ''));
    var costi = ['b', 'g', 'r'].filter(function (n) { return d.costo[n] > 0; }).map(function (n) {
      var manca = opz.risorse && d.costo[n] > opz.risorse[n];
      return '<span class="costo ' + n + (manca ? ' manca' : '') + '">' + d.costo[n] + '</span>';
    }).join('') || '<span class="costo z">0</span>';
    // illustrazione nuova se c'e' (dati/arte.js), altrimenti quella originale 80x60
    var arte = window.ARTE && window.ARTE.has(d.id) ? 'img/arte/card_' + d.id + '.jpg?h=' + ((window.ARTE_H || {})[d.id] || '') : 'img/carte/card_' + d.id + '.png';
    e.innerHTML = '<div class="arte"><img src="' + arte + '" alt="" loading="lazy">' +
      '<div class="costi">' + costi + '</div><div class="rar ' + d.rarita + '"></div>' +
      '<div class="kw">' + d.keyword.map(function (k) { return '<img src="' + kwIcona(k) + '" alt="">'; }).join('') + '</div></div>' +
      '<div class="nomec">' + d.nome + '</div><div class="eff">' + testoEffetto(d) + '</div>';
    e.dataset.id = d.id;
    return e;
  }

  // lente: carta grande + spiegazioni delle keyword + azioni. opz.azioni(lato) disegna i pulsanti.
  var lenteAperta = null;
  function chiudiLente() {
    if (!lenteAperta) return;
    lenteAperta.velo.remove(); lenteAperta.lente.remove();
    var cb = lenteAperta.chiusa; lenteAperta = null;
    if (cb) cb();
  }
  function apriLente(id, opz) {
    chiudiLente();
    opz = opz || {};
    var d = dati(id);
    var velo = el('div', 'velo'), lente = el('div', 'lente');
    velo.addEventListener('click', chiudiLente);
    lente.appendChild(carta(id, { risorse: opz.risorse }));
    var lato = el('div', 'lato');
    if (opz.nota) lato.appendChild(el('div', 'nota' + (opz.notaNeutra ? ' neutra' : ''), opz.nota));
    var lista = el('div', 'kwlista');
    d.keyword.forEach(function (k) {
      var info = KW[kwNome(k)];
      lista.appendChild(el('div', 'kwbox', '<b><img src="' + kwIcona(k) + '" alt="">' + k + '</b>' + (info ? info.descrizione : '')));
    });
    lato.appendChild(lista);
    if (opz.azioni) opz.azioni(lato);
    lente.appendChild(lato);
    document.body.appendChild(velo); document.body.appendChild(lente);
    lenteAperta = { velo: velo, lente: lente, chiusa: opz.chiusa };
    return { lato: lato, lente: lente };
  }

  radice.UI = { el: el, icona: icona, segno: segno, moneta: moneta, avviso: avviso, scuoti: scuoti, carta: carta, dati: dati, tipo: tipo,
    kwIcona: kwIcona, kwNome: kwNome, apriLente: apriLente, chiudiLente: chiudiLente, lenteAperta: function () { return !!lenteAperta; } };
})(window);
