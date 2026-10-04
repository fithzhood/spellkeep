// Tastiera del gioco: una finestra nello stile di SpellKeep con una tastiera propria, al posto della finestra di sistema
// e della tastiera del telefono (che rompevano l'immersione). Va bene anche la tastiera fisica, sul PC.
//   Tastiera.apri({ titolo: 'Deck name', valore: 'Starter deck', max: 24, ok: function (testo) { ... } })
(function (radice) {
  'use strict';
  var el = UI.el;
  var RIGHE = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

  function apri(opz) {
    var testo = String(opz.valore || ''), max = opz.max || 24, maiusc = !testo.length;
    var velo = el('div', 'tastiera-velo'), p = el('div', 'pannello tastiera');
    p.innerHTML = '<div class="tk-testa"><span class="tk-titolo">' + (opz.titolo || '') + '</span><div class="tk-campo"><span class="tk-testo"></span><i class="tk-cursore"></i></div>' +
      '<button class="tk-chiudi" aria-label="Cancel">×</button></div><div class="tk-tasti"></div>';
    var campo = p.querySelector('.tk-testo'), tasti = p.querySelector('.tk-tasti');
    function mostra() {
      campo.textContent = testo;
      p.querySelectorAll('.tk-lettera').forEach(function (b) { b.textContent = maiusc ? b.dataset.c.toUpperCase() : b.dataset.c; });
      p.querySelector('.tk-maiusc').classList.toggle('su', maiusc);
      p.querySelector('.tk-ok').classList.toggle('spento', !testo.trim());
    }
    function scrivi(c) {
      if (testo.length >= max) { UI.scuoti(p.querySelector('.tk-campo')); return; }
      testo += maiusc ? c.toUpperCase() : c;
      maiusc = false; mostra();
    }
    function cancella() { testo = testo.slice(0, -1); if (!testo.length) maiusc = true; mostra(); }
    function conferma() {
      if (!testo.trim()) { UI.scuoti(p.querySelector('.tk-ok')); return; }
      chiudi(); if (opz.ok) opz.ok(testo.trim());
    }
    function chiudi() { velo.remove(); document.removeEventListener('keydown', fisica, true); }
    function tasto(etichetta, cls, fai) {
      var b = el('button', 'tk-tasto ' + (cls || ''), etichetta);
      b.addEventListener('click', function (ev) { ev.stopPropagation(); fai(); });
      return b;
    }
    RIGHE.forEach(function (riga, k) {
      var r = el('div', 'tk-riga');
      riga.split('').forEach(function (c) {
        var b = tasto(c, k ? 'tk-lettera' : 'tk-cifra', function () { scrivi(c); });
        b.dataset.c = c; r.appendChild(b);
      });
      if (k === 3) { r.insertBefore(tasto('⇧', 'tk-maiusc tk-largo', function () { maiusc = !maiusc; mostra(); }), r.firstChild); r.appendChild(tasto('⌫', 'tk-largo', cancella)); }
      tasti.appendChild(r);
    });
    var ultima = el('div', 'tk-riga');
    ultima.appendChild(tasto("'", '', function () { scrivi("'"); }));
    ultima.appendChild(tasto('-', '', function () { scrivi('-'); }));
    ultima.appendChild(tasto('space', 'tk-spazio', function () { if (testo && testo.slice(-1) !== ' ') scrivi(' '); }));
    ultima.appendChild(tasto('.', '', function () { scrivi('.'); }));
    ultima.appendChild(tasto('OK', 'tk-ok btn oro', conferma));
    tasti.appendChild(ultima);
    p.querySelector('.tk-chiudi').addEventListener('click', chiudi);
    velo.addEventListener('click', function (ev) { if (ev.target === velo) chiudi(); });
    // tastiera fisica (PC)
    function fisica(ev) {
      if (ev.key === 'Escape') { chiudi(); ev.preventDefault(); return; }
      if (ev.key === 'Enter') { conferma(); ev.preventDefault(); return; }
      if (ev.key === 'Backspace') { cancella(); ev.preventDefault(); return; }
      if (ev.key.length === 1 && /[\w '.\-]/.test(ev.key)) {
        if (testo.length < max) { testo += ev.key; maiusc = false; mostra(); }
        ev.preventDefault();
      }
    }
    document.addEventListener('keydown', fisica, true);
    velo.appendChild(p); document.body.appendChild(velo);
    mostra();
  }

  radice.Tastiera = { apri: apri };
})(window);
