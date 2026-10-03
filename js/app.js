// L'app: schermate (home, preparazione, negozio, impostazioni), partite, salvataggi.
(function () {
  'use strict';
  var BUILD = (function () {
    var s = document.querySelector('script[src*="app.js"]'), m = s && /[?&]v=(\d+)/.exec(s.getAttribute('src'));
    return m ? m[1] : '?';
  })();
  var el = UI.el;
  Motore.caricaCarte(window.CARTE);
  Motore.caricaKeyword(window.KEYWORD);
  var SFIDE = window.SFIDE || [];
  function sfida(nome) { return SFIDE.find(function (s) { return s.nome === nome; }); }
  function avatar(nome) { return 'img/avatar/' + (nome ? nome.toLowerCase() : 'ai') + '.png'; }

  var App = {
    profilo: Profilo.carica(),
    radice: document.getElementById('app'),
    battaglia: null,
    monta: function (schermo) {
      UI.chiudiLente();
      document.querySelectorAll('.finale, .entrata, .fantasma').forEach(function (x) { x.remove(); });
      if (this.battaglia && this.battaglia.s !== schermo) { this.battaglia.chiuso = true; this.battaglia = null; }
      this.radice.innerHTML = '';
      this.radice.appendChild(schermo);
      if (window.Musica && !schermo.classList.contains('gioco')) Musica.scena(schermo.classList.contains('schermo-negozio') ? 'negozio' : 'menu');
    },
    cassa: function () { return '<div class="cassa pannello">' + UI.moneta(this.profilo.d.monete) + '</div>'; },

    // ---------------------------------------------------------------- home
    home: function () {
      var self = this, d = this.profilo.d, s = el('div', 'schermo home');
      var st = d.stat;
      s.innerHTML = '<div class="marchio"><h1>SPELLKEEP</h1><p>Build your tower, break theirs. A single-player remake of MArcomage.</p>' +
        '<div class="stat"><span><b>' + st.vinte + '</b> won</span><span><b>' + st.perse + '</b> lost</span><span><b>' + d.collezione.length + '</b> cards</span>' +
        '<span><b>' + d.sfide.length + '/' + SFIDE.length + '</b> challengers</span></div></div><nav></nav>' + this.cassa() +
        '<div class="build">build ' + BUILD + '</div>';
      var nav = s.querySelector('nav');
      function voce(testo, oro, fn) { var b = el('button', 'btn' + (oro ? ' oro' : ''), testo); b.addEventListener('click', fn); nav.appendChild(b); }
      if (d.partita) voce('Continue game', true, function () { self.riprendi(); });
      else if (d.premio) voce('Open reward', true, function () { UIBooster.finestraPremio(self, function () { self.home(); }); });
      voce('Play', !d.partita, function () { self.preparazione(); });
      voce('Decks', false, function () { new Editor(self, d.mazzoAttivo); });
      voce('Shop', false, function () { self.negozio(); });
      voce('Settings', false, function () { self.impostazioni(); });
      this.monta(s);
    },

    // ---------------------------------------------------------------- scelta di avversario e mazzo
    preparazione: function (scelta) {
      var self = this, pr = this.profilo, d = pr.d, s = el('div', 'schermo');
      if (d.partita) { UI.avviso('Finish or surrender the current game first'); return this.riprendi(); }
      this.sceltaAvv = scelta !== undefined ? scelta : (this.sceltaAvv || null);
      s.innerHTML = '<div class="testa"><button class="btn indietro">Back</button><h2>Choose your opponent</h2>' + this.cassa() + '</div>' +
        '<div class="corpo"><div class="preparazione"><div class="avversari"></div><div class="opzioni"></div></div></div>';
      this.monta(s);
      s.querySelector('.indietro').addEventListener('click', function () { self.home(); });
      var lista = s.querySelector('.avversari');
      var voci = [{ nome: null, titolo: 'Standard opponent', descrizione: 'A computer player with a random deck. Plays by the original MArcomage AI.', premio: ECONOMIA.vittoria }]
        .concat(SFIDE.map(function (x) { return { nome: x.nome, titolo: x.titolo, descrizione: x.descrizione, premio: ECONOMIA.sfide[x.nome] || 100, chiusa: d.sfide.indexOf(x.nome) < 0 }; }));
      voci.forEach(function (v) {
        var b = el('div', 'avv pannello' + (v.chiusa ? ' chiuso' : '') + (self.sceltaAvv === v.nome ? ' su' : ''));
        b.innerHTML = '<img src="' + avatar(v.nome) + '" alt=""><div class="nome">' + v.titolo + '</div><div class="desc">' + v.descrizione + '</div>' +
          '<div class="premio">' + UI.moneta(v.premio) + '</div>';
        b.addEventListener('click', function () {
          if (v.chiusa) { UI.avviso('Unlock this challenger in the shop'); UI.scuoti(b); return; }
          self.preparazione(v.nome);
        });
        lista.appendChild(b);
      });
      var o = s.querySelector('.opzioni');
      var sf = this.sceltaAvv ? sfida(this.sceltaAvv) : null;
      var mz = el('div', 'pannello riga', '<span>Deck<small>' + (pr.mazzoValido() ? pr.mazzo().nome : 'The deck needs 15 cards per rarity') + '</small></span>');
      var sm = el('div', 'scegli-mazzo');
      d.mazzi.forEach(function (m, k) {
        var b = el('button', (k === d.mazzoAttivo ? 'su' : '') + (pr.mazzoValido(m) ? '' : ' no'), String(k + 1));
        b.addEventListener('click', function () { d.mazzoAttivo = k; pr.salva(); self.preparazione(); });
        sm.appendChild(b);
      });
      mz.appendChild(sm); o.appendChild(mz);
      function interruttore(testo, sotto, chiave) {
        var r = el('button', 'pannello riga', '<span>' + testo + '<small>' + sotto + '</small></span><span class="interruttore' + (d.imp[chiave] ? ' su' : '') + '"></span>');
        r.addEventListener('click', function () { d.imp[chiave] = !d.imp[chiave]; pr.salva(); self.preparazione(); });
        o.appendChild(r);
      }
      interruttore('Hidden cards', 'The opponent\'s hand stays secret', 'nascoste');
      interruttore('Long game', 'Taller tower, more rounds, ×1.5 coins', 'lunga');
      if (sf) o.appendChild(el('div', 'pannello riga', '<span>Challenge rules<small>You can\'t play rare cards. The challenger starts with its own castle and deck.</small></span>'));
      var via = el('button', 'btn oro' + (pr.mazzoValido() ? '' : ' spento'), 'Start');
      via.addEventListener('click', function () {
        if (!pr.mazzoValido()) { UI.avviso('Complete your deck first: 15 cards per rarity'); UI.scuoti(via); return; }
        self.nuovaPartita({ sfida: self.sceltaAvv });
      });
      o.appendChild(via);
    },

    // ---------------------------------------------------------------- partite
    nuovaPartita: function (conf) {
      var pr = this.profilo, d = pr.d;
      conf = conf || { sfida: null };
      if (!pr.mazzoValido()) { UI.avviso('Your deck is incomplete'); return this.preparazione(); }
      var sf = conf.sfida ? sfida(conf.sfida) : null;
      var caso = new Motore.Caso((Date.now() ^ (Math.random() * 1e9)) >>> 0);
      var mio = pr.mazzo(), suo = sf ? { C: sf.mazzo.C, U: sf.mazzo.U, R: sf.mazzo.R, segnalini: sf.segnalini } : Motore.mazzoCasuale(caso);
      var p = new Motore.Partita({
        mazzi: [{ C: mio.C, U: mio.U, R: mio.R, segnalini: mio.segnalini }, suo],
        nascoste: d.imp.nascoste, lunga: d.imp.lunga, sfida: sf, seme: caso.intero(1, 2147483646)
      });
      this.avvia({ partita: p, sfida: conf.sfida, titolo: sf ? sf.titolo : 'Standard opponent', rivincita: conf });
    },
    avvia: function (opz) {
      this.battaglia = null;
      this.battaglia = new Battaglia(this, opz);
      this.salvaPartita(this.battaglia);
    },
    salvaPartita: function (b) {
      var pr = this.profilo;
      if (b.p.stato !== 'in corso') return;
      pr.d.partita = { stato: b.p.esporta(), sfida: b.opz.sfida, titolo: b.opz.titolo, rivincita: b.opz.rivincita };
      pr.salva();
    },
    riprendi: function () {
      var sp = this.profilo.d.partita;
      try {
        var p = Motore.Partita.importa(sp.stato);
        if (sp.sfida) p.sfida = sfida(sp.sfida);
        this.battaglia = new Battaglia(this, { partita: p, sfida: sp.sfida, titolo: sp.titolo, rivincita: sp.rivincita });
      } catch (e) {
        console.error(e);
        this.profilo.d.partita = null; this.profilo.salva();
        UI.avviso('The saved game could not be restored');
        this.home();
      }
    },

    // ---------------------------------------------------------------- negozio
    negozio: function () {
      var self = this, pr = this.profilo, d = pr.d, n = d.negozio, s = el('div', 'schermo schermo-negozio');
      if (!n) { pr.rinnovaNegozio(); pr.salva(); n = d.negozio; }
      s.innerHTML = '<div class="testa"><button class="btn indietro">Home</button><h2>Shop</h2>' + this.cassa() + '<button class="btn oro gioca">Play</button></div>' +
        '<div class="corpo"><div class="negozio"><div class="vetrina-col"><div class="vetrina"></div><div class="vetrina-booster"></div></div><div class="banco"></div></div></div>';
      this.monta(s);
      s.querySelector('.indietro').addEventListener('click', function () { self.home(); });
      s.querySelector('.gioca').addEventListener('click', function () { self.preparazione(); });
      var v = s.querySelector('.vetrina');
      if (!n.carte.length) v.appendChild(el('div', 'vuoto-msg', 'You own every card. Impressive.'));
      n.carte.forEach(function (id) {
        var venduta = n.vendute.indexOf(id) >= 0, prezzo = pr.prezzoCarta(id);
        var o = el('div', 'offerta' + (venduta ? ' venduta' : ''));
        var c = UI.carta(id);
        c.addEventListener('click', function () {
          UI.apriLente(id, {
            nota: venduta ? 'Sold' : '', notaNeutra: true,
            azioni: venduta ? null : function (lato) {
              var az = el('div', 'azioni'), b = el('button', 'btn oro' + (d.monete < prezzo ? ' spento' : ''), 'Buy · ' + UI.moneta(prezzo));
              b.addEventListener('click', function () { UI.chiudiLente(); self.compra(function () { return pr.compraCarta(id); }); });
              az.appendChild(b); lato.appendChild(az);
            }
          });
        });
        o.appendChild(c);
        var b = el('button', 'btn' + (venduta ? ' spento' : d.monete < prezzo ? ' spento' : ' oro'), venduta ? 'Sold' : UI.moneta(prezzo));
        b.addEventListener('click', function () { if (!venduta) self.compra(function () { return pr.compraCarta(id); }, b); });
        o.appendChild(b);
        v.appendChild(o);
      });
      // tre booster: si possono comprare tutti, e si aprono subito
      var vb = s.querySelector('.vetrina-booster');
      (n.booster || []).forEach(function (tipo, i) {
        var aperto = n.aperti.indexOf(i) >= 0, prezzo = pr.prezzoBooster(tipo), b = Booster.tipo(tipo);
        var o = el('div', 'offerta-booster' + (aperto ? ' aperto' : '')), pk = UIBooster.pacchetto(tipo);
        pk.addEventListener('click', function () { UI.avviso(b.nome + ' booster · ' + UIBooster.descrizione(b)); });
        var lato = el('div', 'lato', '<small>' + UIBooster.descrizione(b) + '</small>');
        var bt = el('button', 'btn' + (aperto || d.monete < prezzo ? ' spento' : ' oro'), aperto ? 'Opened' : UI.moneta(prezzo));
        bt.addEventListener('click', function () {
          if (aperto) return;
          var esito = pr.compraBooster(i);
          if (typeof esito === 'string') { UI.avviso(esito); UI.scuoti(bt); return; }
          UIBooster.apri(tipo, esito, function () { self.negozio(); });
        });
        lato.appendChild(bt); o.appendChild(pk); o.appendChild(lato); vb.appendChild(o);
      });
      var banco = s.querySelector('.banco');
      // slot per un mazzo in piu'
      var ps = pr.prezzoSlot(), pieno = d.slot >= ECONOMIA.slotMassimi;
      var vs = el('div', 'voce pannello', '<div class="icona-slot">' + (d.slot + 1) + '</div><div class="t">Deck slot</div><div class="s">You have ' + d.slot + ' of ' + ECONOMIA.slotMassimi + '</div>');
      var bs = el('button', 'btn' + (pieno || d.monete < ps ? ' spento' : ' oro'), pieno ? 'All unlocked' : UI.moneta(ps));
      bs.addEventListener('click', function () { if (!pieno) self.compra(function () { return pr.compraSlot(); }, bs); });
      vs.appendChild(bs); banco.appendChild(vs);
      // avversario da sbloccare
      if (n.sfida) {
        var sf = sfida(n.sfida), pz = pr.prezzoSfida(n.sfida);
        var va = el('div', 'voce pannello', '<img src="' + avatar(sf.nome) + '" alt=""><div class="t">' + sf.titolo + '</div><div class="s">Challenger · wins pay ' + UI.moneta(ECONOMIA.sfide[sf.nome] || 100) + '</div>');
        var ba = el('button', 'btn' + (d.monete < pz ? ' spento' : ' oro'), 'Unlock · ' + UI.moneta(pz));
        ba.addEventListener('click', function () { self.compra(function () { return pr.compraSfida(); }, ba); });
        va.appendChild(ba); banco.appendChild(va);
      } else if (d.sfide.length >= SFIDE.length) banco.appendChild(el('div', 'voce pannello', '<div class="t">Every challenger unlocked</div>'));
      banco.appendChild(el('div', 'vuoto-msg', 'New offers after every game.'));
    },
    compra: function (fn, bottone) {
      var err = fn();
      if (err) { UI.avviso(err); if (bottone) UI.scuoti(bottone); return; }
      this.negozio();
    },

    // ---------------------------------------------------------------- impostazioni
    impostazioni: function () {
      var self = this, pr = this.profilo, s = el('div', 'schermo');
      s.innerHTML = '<div class="testa"><button class="btn indietro">Back</button><h2>Settings</h2>' + this.cassa() + '</div>' +
        '<div class="corpo"><div class="impostazioni"><div class="opzioni"></div><div class="crediti pannello">' +
        '<b>SpellKeep</b> · build ' + BUILD + '<br>Cards, keywords, challengers and the computer player come from <b>MArcomage</b> ' +
        '(arcomage.net) by Mojmír Fendek and its community, released under the GNU GPL. Card art by the MArcomage contributors. ' +
        'Castle textures from Quaternius (CC0). Icons from game-icons.net (CC BY 3.0). Fonts: Cinzel and Alegreya Sans (OFL). Music: chiptune loops made with Suno.' +
        '</div></div></div>';
      this.monta(s);
      s.querySelector('.indietro').addEventListener('click', function () { self.home(); });
      var o = s.querySelector('.opzioni');
      var r = el('button', 'pannello riga', '<span>Reset progress<small>Coins, cards, decks and unlocks start over</small></span>');
      var conferma = 0;
      r.addEventListener('click', function () {
        if (++conferma < 2) { UI.avviso('Tap again to erase everything'); return; }
        pr.azzera(); UI.avviso('Progress reset'); self.home();
      });
      o.appendChild(r);
      var mu = el('button', 'pannello riga', '');
      function scriviMusica() { mu.innerHTML = '<span>Music: ' + (Musica.on ? 'on' : 'off') + '<small>Chiptune loops, off by default</small></span>'; }
      scriviMusica();
      mu.addEventListener('click', function () { Musica.imposta(!Musica.on); scriviMusica(); });
      o.insertBefore(mu, r);
    }
  };

  window.App = App;
  if (App.profilo.d.partita) App.riprendi(); else App.home();
})();
