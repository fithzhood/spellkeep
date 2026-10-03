// Il sito delle carte: tutte le 754 carte del gioco, disegnate con lo stesso UI.carta della partita,
// con filtri combinabili, ordinamento, cursore della grandezza e lente a piena risoluzione.
(function () {
  'use strict';
  var BUILD = (function () {
    var s = document.querySelector('script[src*="carte-sito.js"]'), m = s && /[?&]v=(\d+)/.exec(s.getAttribute('src'));
    return m ? m[1] : 'dev';
  })();
  Motore.caricaCarte(window.CARTE);
  Motore.caricaKeyword(window.KEYWORD);

  var el = UI.el, $ = function (id) { return document.getElementById(id); };
  var CARTE = window.CARTE.slice();
  var KWINFO = {};
  (window.KEYWORD || []).forEach(function (k) { KWINFO[k.nome] = k; });
  var KWNOMI = Object.keys(KWINFO).sort();
  var RAR = { C: 'Common', U: 'Uncommon', R: 'Rare' }, RAR_ORD = { C: 0, U: 1, R: 2 };
  var TIPI = [['b', 'Bricks'], ['g', 'Gems'], ['r', 'Recruits'], ['m', 'Mixed'], ['z', 'Zero']];
  var ICO = { b: 'brick-pile', g: 'crystal-growth', r: 'crested-helmet' };
  var NESSUNA = '(none)';
  function totale(d) { return d.costo.b + d.costo.g + d.costo.r; }
  var COSTO_MAX = Math.max.apply(null, CARTE.map(totale));
  var LIV_MAX = Math.max.apply(null, CARTE.map(function (d) { return d.livello || 0; }));
  function distinti(f) { var v = {}; CARTE.forEach(function (d) { v[f(d)] = 1; }); return Object.keys(v).map(Number).sort(function (a, b) { return a - b; }); }
  var VALORI_COSTO = distinti(totale), VALORI_LIV = distinti(function (d) { return d.livello || 0; });

  // ------------------------------------------------------------------ stato (ricordato fra una visita e l'altra)
  var BASE = { q: '', dove: 'tutto', rar: [], tipi: [], kw: [], kwTutte: false, costo: [0, COSTO_MAX], liv: [0, LIV_MAX],
    ordina: 'id', giu: false, zoom: innerWidth < 600 ? 22 : 52 };
  var S = JSON.parse(JSON.stringify(BASE));
  try { var salvato = JSON.parse(localStorage.getItem('spellkeep.galleria') || 'null'); if (salvato) Object.keys(BASE).forEach(function (k) { if (k in salvato) S[k] = salvato[k]; }); } catch (e) { /* niente memoria: si parte puliti */ }
  S.costo = [Math.max(0, Math.min(S.costo[0], COSTO_MAX)), Math.max(0, Math.min(S.costo[1], COSTO_MAX))];
  S.liv = [Math.max(0, Math.min(S.liv[0], LIV_MAX)), Math.max(0, Math.min(S.liv[1], LIV_MAX))];
  function salva() { try { localStorage.setItem('spellkeep.galleria', JSON.stringify(S)); } catch (e) { /* pazienza */ } }

  // ------------------------------------------------------------------ le carte, fatte una volta sola
  var ELEM = {}, TESTO = {};
  CARTE.forEach(function (d) {
    var c = UI.carta(d.id);
    if (d.keyword.length) {
      c.appendChild(el('div', 'kwnomi', d.keyword.map(function (k) {
        return '<span><img src="' + UI.kwIcona(k) + '" alt="">' + k + '</span>'; }).join('')));
    }
    c.addEventListener('click', function () { apriLente(d.id); });
    ELEM[d.id] = c;
    TESTO[d.id] = { nome: d.nome.toLowerCase(), eff: (d.effetto + ' ' + d.keyword.join(' ')).toLowerCase() };
  });

  // ------------------------------------------------------------------ filtro e ordine
  var visibili = [];
  function passa(d) {
    var q = S.q.trim().toLowerCase();
    if (q) {
      if (/^#?\d+$/.test(q)) { if (String(d.id) !== q.replace('#', '')) return false; }
      else {
        var t = TESTO[d.id], parole = q.split(/\s+/);
        var dove = S.dove === 'nome' ? t.nome : S.dove === 'testo' ? t.eff : t.nome + ' ' + t.eff;
        if (!parole.every(function (p) { return dove.indexOf(p) >= 0; })) return false;
      }
    }
    if (S.rar.length && S.rar.indexOf(d.rarita) < 0) return false;
    if (S.tipi.length && S.tipi.indexOf(UI.tipo(d)) < 0) return false;
    var tot = totale(d);
    if (tot < S.costo[0] || tot > S.costo[1]) return false;
    var lv = d.livello || 0;
    if (lv < S.liv[0] || lv > S.liv[1]) return false;
    if (S.kw.length) {
      var sue = d.keyword.map(UI.kwNome);
      var ha = function (k) { return k === NESSUNA ? sue.length === 0 : sue.indexOf(k) >= 0; };
      if (S.kwTutte ? !S.kw.every(ha) : !S.kw.some(ha)) return false;
    }
    return true;
  }
  var CHIAVE = {
    id: function (d) { return d.id; }, nome: function (d) { return d.nome.toLowerCase(); }, costo: totale,
    rarita: function (d) { return RAR_ORD[d.rarita]; }, livello: function (d) { return d.livello || 0; }
  };
  function aggiorna() {
    var f = CHIAVE[S.ordina] || CHIAVE.id, segno = S.giu ? -1 : 1;
    visibili = CARTE.filter(passa).sort(function (a, b) {
      var x = f(a), y = f(b);
      return (x < y ? -1 : x > y ? 1 : 0) * segno || a.id - b.id;
    });
    $('griglia').replaceChildren.apply($('griglia'), visibili.map(function (d) { return ELEM[d.id]; }));
    $('vuoto').hidden = visibili.length > 0;
    $('conto').textContent = visibili.length === CARTE.length ? CARTE.length + ' cards' : visibili.length + ' / ' + CARTE.length;
    $('conto2').textContent = visibili.length;
    $('griglia').scrollTop = 0;
    riassunto();
    salva();
  }

  // ------------------------------------------------------------------ grandezza della griglia
  // il cursore sceglie una larghezza desiderata; le colonne si contano e le carte riempiono la riga
  function misura() {
    var g = $('griglia'), cs = getComputedStyle(g);
    var W = g.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), gap = 8;
    var minW = 84, maxW = Math.max(minW + 1, Math.min(420, W));
    var voluta = minW * Math.pow(maxW / minW, S.zoom / 100);
    var n = Math.max(1, Math.round((W + gap) / (voluta + gap)));
    var cw = Math.floor((W - gap * (n - 1)) / n);
    g.style.setProperty('--gw', cw + 'px');
    g.style.setProperty('--cols', n);
    g.style.setProperty('--s', Math.max(.92, 1 + (cw - 110) / 240).toFixed(3));
    var s = Math.max(.92, 1 + (cw - 110) / 240);
    g.style.setProperty('--kwg', UI.kwPx(12.5 * s) + 'px');     // icone a multipli interi di pixel fisici
    document.documentElement.style.setProperty('--kwc', UI.kwPx(16) + 'px');
  }
  if (window.ResizeObserver) new ResizeObserver(misura).observe($('griglia'));
  window.addEventListener('resize', misura);

  // ------------------------------------------------------------------ pannello dei filtri
  function sezione(titolo, corpo, extra) {
    var s = el('section', 'fsez');
    var t = el('div', 'fsez-t', '<span class="etic">' + titolo + '</span>');
    if (extra) t.appendChild(extra);
    s.appendChild(t); s.appendChild(corpo);
    return s;
  }
  function gettone(html, cls, attivo, clic) {
    var b = el('button', 'gett ' + (cls || ''), html);
    b.type = 'button';
    b.addEventListener('click', function () { clic(); });
    b.aggiorna = function () { b.classList.toggle('su', attivo()); b.setAttribute('aria-pressed', attivo() ? 'true' : 'false'); };
    return b;
  }
  function alterna(lista, v) { var i = lista.indexOf(v); if (i < 0) lista.push(v); else lista.splice(i, 1); }
  var gettoni = [];
  function rifai() { gettoni.forEach(function (g) { g.aggiorna(); }); doppi.forEach(function (d) { d.aggiorna(); }); $('cerca').value = S.q; aggiorna(); }

  // cursore a due maniglie: due range sovrapposti, le maniglie sole raccolgono il tocco.
  // Le maniglie scorrono sui valori che esistono davvero (i costi sono quasi tutti bassi: lineare non si usava)
  var doppi = [];
  function doppio(chiave, valori, fmt) {
    var w = el('div', 'doppio');
    var lab = el('div', 'doppio-v');
    var a = el('input'), b = el('input'), max = valori.length - 1;
    [a, b].forEach(function (i) { i.type = 'range'; i.min = 0; i.max = max; i.step = 1; });
    var pista = el('div', 'pista'), riemp = el('div', 'riemp');
    pista.appendChild(riemp);
    function indice(v, su) {          // il primo valore >= v (o l'ultimo <= v)
      var i = 0;
      if (su) { while (i < max && valori[i] < v) i++; return i; }
      i = max; while (i > 0 && valori[i] > v) i--; return i;
    }
    function leggi(chi) {
      var x = +a.value, y = +b.value;
      if (x > y) { if (chi === a) b.value = x; else a.value = y; }
      S[chiave] = [valori[+a.value], valori[+b.value]];
      disegna();
      aggiorna();
    }
    function disegna() {
      riemp.style.left = (+a.value / max * 100) + '%';
      riemp.style.right = (100 - +b.value / max * 100) + '%';
      lab.textContent = fmt(S[chiave][0], S[chiave][1]);
    }
    a.addEventListener('input', function () { leggi(a); });
    b.addEventListener('input', function () { leggi(b); });
    w.appendChild(pista); w.appendChild(a); w.appendChild(b);
    var tutto = el('div', 'doppio-box'); tutto.appendChild(lab); tutto.appendChild(w);
    tutto.aggiorna = function () { a.value = indice(S[chiave][0], true); b.value = indice(S[chiave][1], false); disegna(); };
    doppi.push(tutto);
    return tutto;
  }
  function segmenti(chiave, voci) {
    var w = el('div', 'segm');
    voci.forEach(function (v) {
      var g = gettone(v[1], '', function () { return S[chiave] === v[0]; }, function () { S[chiave] = v[0]; rifai(); });
      gettoni.push(g); w.appendChild(g);
    });
    return w;
  }

  function costruisciFiltri() {
    var c = $('filtri-corpo');
    c.appendChild(sezione('Search in', segmenti('dove', [['tutto', 'Name + text'], ['nome', 'Name'], ['testo', 'Text']])));

    var r = el('div', 'gruppo');
    ['C', 'U', 'R'].forEach(function (k) {
      var g = gettone('<i class="rar ' + k + '"></i>' + RAR[k], 'rar-g', function () { return S.rar.indexOf(k) >= 0; },
        function () { alterna(S.rar, k); rifai(); });
      gettoni.push(g); r.appendChild(g);
    });
    c.appendChild(sezione('Rarity', r));

    var t = el('div', 'gruppo');
    TIPI.forEach(function (p) {
      var ic = ICO[p[0]] ? UI.icona(ICO[p[0]]) : p[0] === 'm' ? '<i class="tre"><u class="b"></u><u class="g"></u><u class="r"></u></i>' : '<i class="zero">0</i>';
      var g = gettone(ic + p[1], 'tipo ' + p[0], function () { return S.tipi.indexOf(p[0]) >= 0; },
        function () { alterna(S.tipi, p[0]); rifai(); });
      gettoni.push(g); t.appendChild(g);
    });
    c.appendChild(sezione('Cost type', t));
    c.appendChild(sezione('Cost value', doppio('costo', VALORI_COSTO, function (x, y) {
      return x === y ? 'exactly ' + x : x === 0 && y === COSTO_MAX ? 'any (0 – ' + COSTO_MAX + ')' : x + ' – ' + y; })));
    c.appendChild(sezione('Level', doppio('liv', VALORI_LIV, function (x, y) {
      return x === y ? 'level ' + x : x === 0 && y === LIV_MAX ? 'any (0 – ' + LIV_MAX + ')' : x + ' – ' + y; })));

    var k = el('div', 'gruppo kwg');
    KWNOMI.concat([NESSUNA]).forEach(function (n) {
      var html = n === NESSUNA ? 'No keyword' : '<img src="' + UI.kwIcona(n) + '" alt="">' + n;
      var g = gettone(html, 'kw-g', function () { return S.kw.indexOf(n) >= 0; }, function () { alterna(S.kw, n); rifai(); });
      gettoni.push(g); k.appendChild(g);
    });
    c.appendChild(sezione('Keywords', k, segmenti('kwTutte', [[false, 'Any'], [true, 'All']])));
  }

  // filtri attivi in testa, ciascuno si toglie con un tocco
  function riassunto() {
    var v = [];
    if (S.q.trim()) v.push(['“' + S.q.trim() + '”', function () { S.q = ''; }]);
    S.rar.forEach(function (k) { v.push([RAR[k], function () { alterna(S.rar, k); }]); });
    S.tipi.forEach(function (k) { v.push([TIPI.filter(function (p) { return p[0] === k; })[0][1], function () { alterna(S.tipi, k); }]); });
    if (S.costo[0] > 0 || S.costo[1] < COSTO_MAX) v.push(['Cost ' + S.costo[0] + '–' + S.costo[1], function () { S.costo = [0, COSTO_MAX]; }]);
    if (S.liv[0] > 0 || S.liv[1] < LIV_MAX) v.push(['Level ' + S.liv[0] + '–' + S.liv[1], function () { S.liv = [0, LIV_MAX]; }]);
    S.kw.forEach(function (k) { v.push([k === NESSUNA ? 'No keyword' : k, function () { alterna(S.kw, k); }]); });
    if (S.kw.length > 1) v.push([S.kwTutte ? 'All keywords' : 'Any keyword', function () { S.kwTutte = !S.kwTutte; }]);
    var a = $('attivi');
    a.replaceChildren();
    v.forEach(function (x) {
      var b = el('button', 'via', '<span>' + x[0] + '<i>×</i></span>');
      b.type = 'button';
      b.addEventListener('click', function () { x[1](); rifai(); });
      a.appendChild(b);
    });
    var n = v.length - (S.kw.length > 1 ? 1 : 0);
    $('n-filtri').textContent = n ? n : '';
  }

  // ------------------------------------------------------------------ lente
  var lente = null;
  function apriLente(id, senzaStoria) {
    var pos = visibili.findIndex(function (d) { return d.id === id; });
    if (pos < 0) return;
    if (!lente) {
      lente = { velo: el('div', 'velo sito-velo'), box: el('div', 'lente-sito') };
      lente.velo.addEventListener('click', chiudi);
      document.body.appendChild(lente.velo); document.body.appendChild(lente.box);
      if (!senzaStoria) history.pushState({ lente: 1 }, '');
      tocchi(lente.box);
    }
    lente.id = id;
    var d = UI.dati(id), b = lente.box, c = ELEM[id];
    var hd = window.ARTE && window.ARTE.has(id);
    var piccola = c.querySelector('.arte img').getAttribute('src');
    var costi = ['b', 'g', 'r'].filter(function (n) { return d.costo[n] > 0; }).map(function (n) {
      return '<span class="ls-costo ' + n + '">' + UI.icona(ICO[n]) + d.costo[n] + '</span>'; }).join('') ||
      '<span class="ls-costo z">0</span>';
    b.className = 'lente-sito ' + UI.tipo(d);
    b.innerHTML =
      '<div class="ls-arte"><img class="lo" src="' + piccola + '" alt="">' +
        (hd ? '<img class="hi" alt="" src="img/arte-hd/card_' + id + '.webp?h=' + ((window.ARTE_H || {})[id] || '') + '">' : '') + '</div>' +
      '<div class="ls-info">' +
        '<h2 class="ls-nome">' + d.nome + '</h2>' +
        '<div class="ls-meta">' + costi + '<span class="ls-rar"><i class="rar ' + d.rarita + '"></i>' + RAR[d.rarita] + '</span>' +
          '<span class="ls-dato">Level ' + (d.livello || 0) + '</span><span class="ls-dato">#' + d.id + '</span></div>' +
        '<div class="ls-eff">' + c.querySelector('.eff').innerHTML + '</div>' +
        '<div class="ls-kw">' + d.keyword.map(function (k) {
          var info = KWINFO[UI.kwNome(k)];
          return '<div class="kwbox"><b><img src="' + UI.kwIcona(k) + '" alt="">' + k + '</b>' + (info ? info.descrizione : '') + '</div>';
        }).join('') + '</div>' +
      '</div>' +
      '<div class="ls-nav"><button class="btn" data-v="-1" type="button" aria-label="Previous card">‹</button>' +
        '<span>' + (pos + 1) + ' / ' + visibili.length + '</span>' +
        '<button class="btn" data-v="1" type="button" aria-label="Next card">›</button></div>' +
      '<button class="btn ls-chiudi" type="button" aria-label="Close">×</button>';
    var hi = b.querySelector('.hi');
    if (hi) { if (hi.complete && hi.naturalWidth) hi.classList.add('pronta'); else hi.addEventListener('load', function () { hi.classList.add('pronta'); }); }
    b.querySelector('.ls-chiudi').addEventListener('click', chiudi);
    b.querySelectorAll('.ls-nav button').forEach(function (x) { x.addEventListener('click', function () { scorri(+x.dataset.v); }); });
    b.scrollTop = 0;
    // la carta resta sotto gli occhi anche dopo, nella griglia
    c.scrollIntoView({ block: 'nearest' });
  }
  function scorri(v) {
    if (!lente) return;
    var pos = visibili.findIndex(function (d) { return d.id === lente.id; });
    var n = visibili.length, nuovo = visibili[(pos + v + n) % n];
    apriLente(nuovo.id, true);
  }
  function chiudi() {
    if (!lente) return;
    if (history.state && history.state.lente) { history.back(); return; }
    togli();
  }
  function togli() { if (!lente) return; lente.velo.remove(); lente.box.remove(); lente = null; }
  window.addEventListener('popstate', function () { togli(); });
  document.addEventListener('keydown', function (e) {
    if (!lente) return;
    if (e.key === 'Escape') chiudi();
    else if (e.key === 'ArrowRight') scorri(1);
    else if (e.key === 'ArrowLeft') scorri(-1);
  });
  // scorrimento col dito sulla lente: destra/sinistra cambia carta
  function tocchi(box) {
    var x0 = null, y0 = 0;
    box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) scorri(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  // ------------------------------------------------------------------ testa
  var attesa;
  $('cerca').addEventListener('input', function (e) { clearTimeout(attesa); attesa = setTimeout(function () { S.q = e.target.value; aggiorna(); }, 120); });
  $('ordina').addEventListener('change', function (e) { S.ordina = e.target.value; aggiorna(); });
  $('verso').addEventListener('click', function () { S.giu = !S.giu; $('verso').textContent = S.giu ? '↓' : '↑'; aggiorna(); });
  $('zoom').addEventListener('input', function (e) { S.zoom = +e.target.value; misura(); salva(); });
  // il cassetto dei filtri (telefono): si chiude con Show, toccando fuori o col tasto indietro
  function cassetto() { return document.body.classList.contains('filtri-aperti'); }
  $('apri-filtri').addEventListener('click', function () {
    document.body.classList.add('filtri-aperti');
    history.pushState({ filtri: 1 }, '');
  });
  function chiudiCassetto() {
    if (!cassetto()) return;
    if (history.state && history.state.filtri) history.back(); else document.body.classList.remove('filtri-aperti');
  }
  $('chiudi-filtri').addEventListener('click', chiudiCassetto);
  document.querySelector('.sc-corpo').addEventListener('click', function (e) { if (e.target === e.currentTarget) chiudiCassetto(); });
  window.addEventListener('popstate', function () { document.body.classList.remove('filtri-aperti'); });
  $('azzera').addEventListener('click', function () {
    var z = S.zoom, o = S.ordina, g = S.giu;
    S = JSON.parse(JSON.stringify(BASE)); S.zoom = z; S.ordina = o; S.giu = g;
    rifai();
  });

  // dentro l'APK: il tasto indietro chiude lente e filtri (stanno nella storia), e solo dalla griglia esce
  var cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.App) {
    document.body.classList.add('capacitor');
    cap.Plugins.App.addListener('backButton', function (e) { if (e.canGoBack) history.back(); else cap.Plugins.App.exitApp(); });
  }

  costruisciFiltri();
  $('ordina').value = S.ordina;
  $('verso').textContent = S.giu ? '↓' : '↑';
  $('zoom').value = S.zoom;
  $('build').textContent = 'build ' + BUILD;
  misura();
  rifai();
})();
