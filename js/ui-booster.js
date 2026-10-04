// Booster: il pacchetto disegnato, l'apertura (tre carte che si girano una alla volta) e la scelta del premio
// dopo una vittoria. La logica (che carte escono, doppie rivendute) sta in profilo.js.
(function (radice) {
  'use strict';
  var el = UI.el;
  // tinta di fondo di ogni pacchetto: scelte a mano perche' siano tutte diverse fra loro (i colori delle icone
  // da soli davano otto pacchetti grigi)
  var TINTA = {
    'kw-alliance': '#2f7d4f', 'kw-aqua': '#3b5fb0', 'kw-aria': '#138a8a', 'kw-banish': '#6b3e75', 'kw-barbarian': '#8f3f2f',
    'kw-beast': '#b4612f', 'kw-brigand': '#7a6a2a', 'kw-burning': '#c0402a', 'kw-charge': '#a22a3c', 'kw-cursed': '#3d4a44',
    'kw-demonic': '#6e2727', 'kw-destruction': '#3f3f7a', 'kw-dragon': '#165a4c', 'kw-durable': '#5d5466', 'kw-enduring': '#5a4326',
    'kw-far_sight': '#3d7fbf', 'kw-frenzy': '#b8284e', 'kw-holy': '#c8902a', 'kw-horde': '#7a3045', 'kw-illusion': '#7d4f98',
    'kw-legend': '#8a6a1e', 'kw-mage': '#2f3a6e', 'kw-nature': '#2f8f4f', 'kw-quick': '#7f852a', 'kw-rebirth': '#c8541a',
    'kw-restoration': '#a24b6f', 'kw-runic': '#4f6f5c', 'kw-siege': '#6a4f60', 'kw-skirmisher': '#3a3f44', 'kw-soldier': '#3e5f8a',
    'kw-swift': '#0e8f80', 'kw-titan': '#6d6a50', 'kw-undead': '#2e222f', 'kw-unliving': '#9a6232',
    'senza': '#6b6157', 'col-b': '#b8553d', 'col-g': '#3f79c2', 'col-r': '#4f9b58', 'col-z': '#a9a49a', 'col-m': '#b08b40', 'raro': '#c9953f'
  };
  var ICO = { b: 'brick-pile', g: 'crystal-growth', r: 'crested-helmet' };

  function icona(b, lato) {
    if (b.kw) return '<img src="' + UI.kwIcona(b.kw) + '" alt="" style="width:' + lato + 'px;height:' + lato + 'px">';
    if (b.costo === 'z') return '<i class="b-zero">0</i>';
    if (b.costo === 'm') return '<i class="b-tre"><u class="b"></u><u class="g"></u><u class="r"></u></i>';
    if (b.costo) return UI.icona(ICO[b.costo]);
    if (b.raro) return '<i class="b-rombo"></i>';
    return '<i class="b-bianca"></i>';            // senza keyword: una carta liscia
  }
  function nome(b) { return b.raro ? 'Rare' : b.nome; }
  function conta(tipo) { return radice.App && App.profilo ? Booster.conta(tipo, App.profilo.d.collezione) : null; }
  // "12 of 40 found · C 8/20 · U 3/14 · R 1/6"
  function riepilogo(tipo) {
    var c = conta(tipo); if (!c) return '';
    var r = ['C', 'U', 'R'].filter(function (k) { return c[k][1]; }).map(function (k) {
      return '<span class="bc-r"><i class="rar ' + k + '"></i>' + c[k][0] + '/' + c[k][1] + '</span>'; }).join(' ');
    return '<span class="bc">' + (c.ho >= c.tot ? 'All ' + c.tot + ' found' : c.ho + ' of ' + c.tot + ' found') + '</span> ' + r;
  }
  function descrizione(b) {
    if (b.raro) return 'Three rare cards.';
    if (b.kw) return 'Three random ' + b.kw + ' cards, support cards included.';
    if (b.costo) return 'Three random ' + { b: 'bricks-cost', g: 'gems-cost', r: 'recruits-cost', z: 'zero-cost', m: 'mixed-cost' }[b.costo] + ' cards.';
    return 'Three random cards without keywords.';
  }

  // il pacchetto. grande = per l'apertura
  function pacchetto(tipo, grande) {
    var b = Booster.tipo(tipo);
    var e = el('div', 'booster' + (b.raro ? ' raro' : '') + (grande ? ' grande' : ''));
    e.style.setProperty('--t', TINTA[tipo] || '#6b6157');
    // l'icona della keyword a un multiplo intero di pixel fisici, come sulle carte
    var lato = UI.kwPx(grande ? 44 : 28);
    // carte gia' trovate su quelle che il booster puo' dare: dice se conviene ancora aprirlo
    var c = conta(tipo), completo = c && c.ho >= c.tot;
    e.innerHTML = '<div class="b-icona">' + icona(b, lato) + '</div><div class="b-nome">' + nome(b) + '</div><div class="b-sotto">Booster</div>' +
      (c ? '<div class="b-conta' + (completo ? ' completo' : '') + '">' + (completo ? '✓ ' : '') + c.ho + '/' + c.tot + '</div>' : '');
    e.dataset.tipo = tipo;
    return e;
  }

  // apertura: il pacchetto vibra e si strappa, poi le tre carte si girano una alla volta.
  // esito = [{ id, doppia, rimborso }] da Profilo.apriBooster; poi() a fine visione.
  function apri(tipo, esito, poi) {
    var b = Booster.tipo(tipo);
    var o = el('div', 'apertura');
    o.innerHTML = '<div class="ap-titolo">' + nome(b) + ' booster</div><div class="ap-palco"></div>' +
      '<div class="ap-riepilogo"></div><div class="azioni"><button class="btn oro ap-via">Continue</button></div>';
    document.body.appendChild(o);
    document.body.classList.add('booster-aperto');
    var palco = o.querySelector('.ap-palco'), pk = pacchetto(tipo, true);
    palco.appendChild(pk);
    var via = o.querySelector('.ap-via');
    via.disabled = true;
    setTimeout(function () { pk.classList.add('strappa'); }, 650);
    setTimeout(function () {
      palco.innerHTML = '';
      var fila = el('div', 'ap-carte');
      palco.appendChild(fila);
      setTimeout(function () { UI.adattaTesto(fila); }, 0);
      esito.forEach(function (r, i) {
        var s = el('div', 'ap-posto'), giro = el('div', 'ap-giro');
        giro.appendChild(el('div', 'ap-retro dorso'));
        var c = UI.carta(r.id);
        c.classList.add('ap-fronte');
        giro.appendChild(c);
        s.appendChild(giro);
        s.appendChild(el('div', 'ap-tag ' + (r.doppia ? 'doppia' : 'nuova'), r.doppia ? 'Duplicate · +' + UI.moneta(r.rimborso) : 'New'));
        c.addEventListener('click', function () { UI.apriLente(r.id); });
        fila.appendChild(s);
        setTimeout(function () { s.classList.add('girata'); }, 250 + i * 380);
      });
      setTimeout(function () {
        var nuove = esito.filter(function (r) { return !r.doppia; }).length, doppie = esito.length - nuove;
        var monete = esito.reduce(function (a, r) { return a + r.rimborso; }, 0);
        o.querySelector('.ap-riepilogo').innerHTML = nuove + (nuove === 1 ? ' new card' : ' new cards') +
          (doppie ? ' · ' + doppie + (doppie === 1 ? ' duplicate' : ' duplicates') + ' sold for ' + UI.moneta(monete) : '') +
          '<div class="ap-conta">' + riepilogo(tipo) + '</div>';
        via.disabled = false;
      }, 250 + esito.length * 380 + 300);
    }, 1050);
    via.addEventListener('click', function () {
      if (via.disabled) return;
      UI.chiudiLente();
      o.remove();
      document.body.classList.remove('booster-aperto');
      if (poi) poi();
    });
  }

  // i booster del premio dentro un contenitore: un tocco ne sceglie uno e lo apre
  function sceltaPremio(contenitore, app, poi) {
    var pr = app.profilo, tipi = pr.d.premio;
    if (!tipi) return false;
    var fila = el('div', 'pacchi');
    tipi.forEach(function (tipo) {
      var pk = pacchetto(tipo);
      if (tipo === pr.d.premioPreferito) { pk.classList.add('preferito'); pk.appendChild(el('div', 'b-pref', 'Favourite')); }
      pk.addEventListener('click', function () {
        var esito = pr.scegliPremio(tipo);
        if (!esito) return;
        apri(tipo, esito, poi);
      });
      fila.appendChild(pk);
    });
    contenitore.appendChild(fila);
    return true;
  }

  // la stessa scelta a tutto schermo (dalla home, se il premio e' rimasto in sospeso)
  function finestraPremio(app, poi) {
    var f = el('div', 'finale'), r = el('div', 'riquadro pannello');
    r.innerHTML = '<h2 class="vinta">Reward</h2><p>Choose one booster to open.</p>';
    sceltaPremio(r, app, function () { if (poi) poi(); });
    var az = el('div', 'azioni'), dopo = el('button', 'btn', 'Later');
    dopo.addEventListener('click', function () { f.remove(); });
    az.appendChild(dopo); r.appendChild(az);
    r.addEventListener('click', function (e) { if (e.target.closest('.booster')) f.remove(); });
    f.appendChild(r); document.body.appendChild(f);
  }

  // i booster in regalo (traguardi), uno dopo l'altro; poi() quando sono finiti
  function apriRegali(app, poi) {
    var r = app.profilo.apriRegalo();
    if (!r) { if (poi) poi(); return; }
    apri(r.tipo, r.esito, function () { apriRegali(app, poi); });
  }

  radice.UIBooster = { pacchetto: pacchetto, apri: apri, sceltaPremio: sceltaPremio, finestraPremio: finestraPremio, descrizione: descrizione, riepilogo: riepilogo, apriRegali: apriRegali };
})(window);
