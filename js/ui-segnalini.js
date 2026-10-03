// Segnalini keyword (token): cosa fanno quando arrivano a 100, detto in chiaro.
// Quando un segnalino scatta compare al centro un riquadro con l'icona, il nome dell'effetto e cosa ha fatto
// con i numeri della carta appena giocata (dipendono dalla sua rarita'); l'anello del segnalino esplode.
// Toccando un anello in partita si legge a che punto e' e cosa fara'.
(function (radice) {
  'use strict';
  var el = UI.el;
  var R3 = function (r, c, u, ra) { return r === 'C' ? c : r === 'U' ? u : ra; };
  // PHP round: 1.5 -> 2
  function tondo(x) { return Math.sign(x) * Math.round(Math.abs(x)); }

  // nome dell'effetto e testo: con la carta (id) i numeri sono quelli veri, senza si danno per rarita'
  var EFFETTI = {
    Alliance: ['Arcane knowledge', function () { return 'All your production is doubled this turn.'; }],
    Barbarian: ['Devastation', function (r) {
      return r ? 'Enemy wall −' + R3(r, 3, 8, 15) + ' (no wall left: enemy stock −' + tondo(R3(r, 3, 8, 15) / 2) + ').'
        : 'Enemy wall −3 / −8 / −15 by the card’s rarity (no wall left: enemy stock −2 / −4 / −8).';
    }],
    Brigand: ['Robbery', function (r) {
      return r ? 'Steals ' + R3(r, 1, 2, 3) + ' more stock from the enemy.' : 'Steals 1 / 2 / 3 more stock from the enemy, by the card’s rarity.';
    }],
    Beast: ['Breeding', function (r) {
      return 'Recruit production doubled this turn, and extra damage to the enemy (up to ' + (r ? R3(r, 2, 5, 10) : '2 / 5 / 10 by rarity') + ').';
    }],
    Burning: ['Fire blast', function () { return 'An enemy card in hand (same rarity or lower) burns into Searing fire.'; }],
    Holy: ['Holy song', function (r) {
      var n = r ? R3(r, 1, 2, 5) : '1 / 2 / 5'; return '+' + n + ' random resource' + (n === 1 ? '' : 's') + ', and an enemy Demonic or Undead card in hand turns to ashes.';
    }],
    Mage: ['Willpower', function () { return 'Altar +1 (or Gems +10 if your Altar is already 2 or more ahead).'; }],
    Soldier: ['Veteran troops', function (r, d) {
      return d ? (d.costo.r ? 'Half the recruit cost comes back: +' + tondo(d.costo.r / 2) + ' Recruits.' : 'Half the recruit cost comes back (this card costs no recruits).')
        : 'Half the recruit cost of the card comes back.';
    }],
    Titan: ['Titan’s will', function () { return 'A Titan you don’t hold comes into your hand.'; }],
    Undead: ['Eternal servitude', function (r, d) {
      if (!d) return 'Part of the card’s cost comes back (2/3, 1/2 or 1/3 with one, two or three resource types).';
      var tipi = ['b', 'g', 'r'].filter(function (k) { return d.costo[k] > 0; }), f = [0, 2 / 3, 1 / 2, 1 / 3][tipi.length];
      var nomi = { b: 'Bricks', g: 'Gems', r: 'Recruits' };
      var v = tipi.map(function (k) { return '+' + tondo(d.costo[k] * f) + ' ' + nomi[k]; }).filter(function (s) { return s.indexOf('+0 ') < 0; });
      return v.length ? 'Part of the card’s cost comes back: ' + v.join(', ') + '.' : 'Part of the card’s cost comes back (this card is free).';
    }],
    Unliving: ['Artificial workers', function (r) {
      return 'Brick production ×' + (r ? R3(r, 2, 3, 4) : '2 / 3 / 4 by rarity') + ' this turn.';
    }]
  };

  function effetto(kw, id) {
    var e = EFFETTI[kw]; if (!e) return { nome: kw, testo: '' };
    var d = id ? UI.dati(id) : null;
    return { nome: e[0], testo: e[1](d ? d.rarita : null, d) };
  }

  // come cresce: +guadagno per ogni carta della keyword, +bonus per ogni altra carta della keyword in mano
  function crescita(kw) {
    var k = (window.KEYWORD || []).filter(function (x) { return x.nome === kw; })[0];
    return k ? '+' + k.guadagno + ' when you play a ' + kw + ' card, +' + k.bonus + ' more for each other ' + kw + ' card in your hand.' : '';
  }

  // il riquadro grande: si chiude da solo, o al tocco
  function scatto(kw, id, chi, poi) {
    var e = effetto(kw, id), v = el('div', 'scatto-seg ' + (chi === 1 ? 'mio' : 'suo'));
    v.innerHTML = '<div class="onde"><i></i><i></i><i></i></div>' +
      '<div class="riq pannello">' +
        '<div class="ico"><img src="' + UI.kwIcona(kw) + '" alt=""></div>' +
        '<div class="testi"><div class="chi">' + (chi === 1 ? 'Your' : 'Enemy') + ' ' + kw + ' token · <b>100</b></div>' +
        '<h3>' + e.nome + '</h3><p>' + e.testo + '</p></div>' +
      '</div>';
    document.body.appendChild(v);
    // l'anello del segnalino, nella colonna di chi gioca, esplode
    var anello = document.querySelector('.ris-' + (chi === 1 ? 'io' : 'lui') + ' .seg[data-kw="' + kw + '"]');
    if (anello) { anello.classList.remove('esplode'); void anello.offsetWidth; anello.classList.add('esplode'); }
    var fatto = false;
    function chiudi() {
      if (fatto) return; fatto = true;
      v.classList.add('via'); setTimeout(function () { v.remove(); }, 260);
      if (poi) poi();
    }
    v.addEventListener('click', chiudi);
    setTimeout(chiudi, 2600);
  }

  function spiega(kw, valore) {
    var e = effetto(kw);
    var v = el('div', 'velo-seg'), r = el('div', 'pannello spiega-seg');
    r.innerHTML = '<div class="testa-s"><img src="' + UI.kwIcona(kw) + '" alt=""><div><b>' + kw + ' token</b><small>' + valore + ' / 100</small></div></div>' +
      '<div class="barra"><i style="width:' + Math.min(100, valore) + '%"></i></div>' +
      '<p><b>At 100 — ' + e.nome + ':</b> ' + e.testo + '</p><p class="piccolo">' + crescita(kw) +
      ' It fires when a ' + kw + ' card fills it, then starts again from 0.</p>';
    v.appendChild(r);
    v.addEventListener('click', function () { v.remove(); });
    document.body.appendChild(v);
  }

  radice.Segnalini = { effetto: effetto, crescita: crescita, scatto: scatto, spiega: spiega };
})(window);
