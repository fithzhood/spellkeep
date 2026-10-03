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
  // i ritratti (arte/avatar/prompt.json, fatti con Gemini): avversari img/avatar/<nome>.jpg e il giocatore giocatore.jpg
  function avatar(nome) { return 'img/avatar/' + (nome === 'giocatore' ? 'giocatore' : Avversari.trova(nome).avatar) + '.jpg'; }

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
        '<span><b>' + d.sfide.length + '/' + Avversari.tutti().filter(function (a) { return a.tipo !== 'base'; }).length + '</b> opponents</span></div></div><nav></nav>' + this.cassa() +
        '<div class="build">build ' + BUILD + '</div>';
      var nav = s.querySelector('nav');
      function voce(testo, oro, fn) { var b = el('button', 'btn' + (oro ? ' oro' : ''), testo); b.addEventListener('click', fn); nav.appendChild(b); }
      if (d.partita) voce('Continue game', true, function () { self.riprendi(); });
      else if (d.premio) voce('Open reward', true, function () { UIBooster.finestraPremio(self, function () { self.home(); }); });
      if (d.regali && d.regali.length) voce('Open gift (' + d.regali.length + ')', true, function () { UIBooster.apriRegali(self, function () { self.home(); }); });
      voce('Play', !d.partita, function () { self.preparazione(); });
      voce('Decks', false, function () { new Editor(self, d.mazzoAttivo); });
      voce('Shop', false, function () { self.negozio(); });
      voce('Tutorial' + (Tutorial.fatte(self) ? ' <small>' + Tutorial.fatte(self) + '/' + Tutorial.lezioni.length + '</small>' : ''), false, function () { Tutorial.menu(self); });
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
      // caselle in una griglia che scorre in verticale, divise per fascia; la posizione di scorrimento resta fra un
      // tocco e l'altro (prima la lista orizzontale ripartiva sempre dall'inizio)
      var lista = s.querySelector('.avversari');
      var voci = Avversari.tutti().map(function (a) { return Object.assign({ chiusa: a.tipo !== 'base' && d.sfide.indexOf(a.nome) < 0 }, a); });
      var FASCE = [['base', 'Basic'], ['rivale', 'Medium'], ['sfidante', 'Advanced']];
      FASCE.forEach(function (f) {
        var qui = voci.filter(function (v) { return v.tipo === f[0]; });
        if (!qui.length) return;
        var aperti = qui.filter(function (v) { return !v.chiusa; }).length, fa = pr.fasce()[f[0]];
        lista.appendChild(el('div', 'fascia-t', f[1] + ' <small>' + aperti + '/' + qui.length + ' unlocked · ' + fa.battuti + '/' + fa.tot + ' beaten</small>' +
          '<span class="fascia-premio' + (fa.dato ? ' preso' : '') + '">' + (fa.dato ? '✓ Tier reward claimed' : 'Beat all: + ' + UI.moneta(fa.premio.monete) + ' + ' + fa.premio.booster + ' rare boosters') + '</span>'));
        var g = el('div', 'caselle');
        qui.forEach(function (v) {
          var vinte = pr.battuto(v.nome);
          var b = el('button', 'avv pannello' + (v.chiusa ? ' chiuso' : '') + (vinte ? ' battuto' : '') + (self.sceltaAvv === v.nome ? ' su' : ''));
          var tipo = v.tipo === 'rivale' ? v.tribu : v.tipo === 'sfidante' ? 'Challenger' : v.mazzoCasuale ? 'Random deck' : 'Starter deck';
          b.innerHTML = '<img src="' + avatar(v.nome) + '" alt=""><span class="t"><span class="nome">' + v.titolo + '</span>' +
            '<span class="tipo">' + (v.chiusa ? '🔒 ' : '') + tipo + '</span><span class="premio">' + UI.moneta(v.premio) + '</span></span>' +
            (vinte ? '<span class="vinto" title="Beaten ' + vinte + '×">✓' + (vinte > 1 ? '<small>' + vinte + '</small>' : '') + '</span>' : '');
          b.addEventListener('click', function () {
            if (v.chiusa) { UI.avviso('Unlock this opponent in the shop'); UI.scuoti(b); return; }
            self.preparazione(v.nome);
          });
          g.appendChild(b);
        });
        lista.appendChild(g);
      });
      lista.addEventListener('scroll', function () { self.scrollAvv = lista.scrollTop; });
      if (this.scrollAvv) lista.scrollTop = this.scrollAvv;
      else setTimeout(function () { var su = lista.querySelector('.avv.su'); if (su) su.scrollIntoView({ block: 'nearest' }); }, 0);
      var o = s.querySelector('.opzioni');
      var sf = this.sceltaAvv ? Avversari.trova(this.sceltaAvv).sfida : null;
      var av = Avversari.trova(this.sceltaAvv);
      o.appendChild(el('div', 'pannello scheda-avv', '<img src="' + avatar(av.nome) + '" alt=""><div><b>' + av.titolo + '</b>' +
        '<p>' + av.descrizione + '</p>' + (sf ? '<p class="regole">Challenge: no rare cards; own castle and deck.</p>' : '') +
        '<span class="premio">Win: ' + UI.moneta(av.premio) +
        (pr.battuto(av.nome) ? ' · beaten ' + pr.battuto(av.nome) + '×' : ' · <b class="primo">first win + ' + UI.moneta(av.premio * 2) + ' & booster</b>') + '</span></div>'));
      var mz = el('div', 'pannello riga', '<span>Deck<small>' + (pr.mazzoValido() ? pr.mazzo().nome : 'Incomplete deck') + '</small></span>');
      var sm = el('div', 'scegli-mazzo');
      d.mazzi.forEach(function (m, k) {
        var b = el('button', (k === d.mazzoAttivo ? 'su' : '') + (pr.mazzoValido(m) ? '' : ' no'), String(k + 1));
        b.addEventListener('click', function () { d.mazzoAttivo = k; pr.salva(); self.preparazione(); });
        sm.appendChild(b);
      });
      mz.appendChild(sm); o.appendChild(mz);
      setTimeout(function () { UI.sfuma(sm); var su = sm.querySelector('.su'); if (su) su.scrollIntoView({ inline: 'nearest', block: 'nearest' }); }, 0);
      // le due opzioni affiancate: una sotto l'altra il pannello superava l'altezza del telefono e Start copriva Long game
      var fila = el('div', 'opzioni-fila');
      function interruttore(testo, sotto, chiave) {
        var r = el('button', 'pannello riga', '<span>' + testo + '<small>' + sotto + '</small></span><span class="interruttore' + (d.imp[chiave] ? ' su' : '') + '"></span>');
        r.addEventListener('click', function () { d.imp[chiave] = !d.imp[chiave]; pr.salva(); self.preparazione(); });
        fila.appendChild(r);
      }
      interruttore('Hidden cards', 'Secret hand', 'nascoste');
      interruttore('Long game', '×1.5 coins', 'lunga');
      o.appendChild(fila);
      var via = el('button', 'btn oro avvia' + (pr.mazzoValido() ? '' : ' spento'), 'Start');
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
      var av = Avversari.trova(conf.sfida), sf = av.sfida || null;
      var caso = new Motore.Caso((Date.now() ^ (Math.random() * 1e9)) >>> 0);
      // sfidanti: il loro segnalino originale, o (se non ne hanno) quello della keyword piu' presente nel mazzo
      var mio = pr.mazzo(), suo = sf ? { C: sf.mazzo.C, U: sf.mazzo.U, R: sf.mazzo.R,
          segnalini: sf.segnalini && sf.segnalini.length ? sf.segnalini.slice(0, 1) : Motore.segnaliniAuto(sf.mazzo) }
        : av.mazzo ? { C: av.mazzo.C, U: av.mazzo.U, R: av.mazzo.R, segnalini: av.mazzo.segnalini } : Motore.mazzoCasuale(caso);
      var p = new Motore.Partita({
        mazzi: [{ C: mio.C, U: mio.U, R: mio.R, segnalini: mio.segnalini }, suo],
        nascoste: d.imp.nascoste, lunga: d.imp.lunga, sfida: sf, seme: caso.intero(1, 2147483646)
      });
      this.avvia({ partita: p, sfida: conf.sfida, titolo: av.titolo, rivincita: conf, nuova: true });
    },
    avvia: function (opz) {
      this.battaglia = null;
      this.battaglia = new Battaglia(this, opz);
      this.salvaPartita(this.battaglia);
    },
    salvaPartita: function (b) {
      var pr = this.profilo;
      if (b.opz.tutorial) return;
      if (b.p.stato !== 'in corso') return;
      pr.d.partita = { stato: b.p.esporta(), sfida: b.opz.sfida, titolo: b.opz.titolo, rivincita: b.opz.rivincita };
      pr.salva();
    },
    riprendi: function () {
      var sp = this.profilo.d.partita;
      try {
        var p = Motore.Partita.importa(sp.stato);
        if (sp.sfida && Avversari.trova(sp.sfida).sfida) p.sfida = Avversari.trova(sp.sfida).sfida;
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
      s.innerHTML = '<div class="testa"><button class="btn indietro">Home</button><h2>Shop</h2>' + this.cassa() + '<button class="btn mazzi">Decks</button><button class="btn oro gioca">Play</button></div>' +
        '<div class="corpo"><div class="negozio"><div class="vetrina-col"><div class="vetrina"></div><div class="vetrina-booster"></div></div><div class="banco"></div></div></div>';
      this.monta(s);
      s.querySelector('.indietro').addEventListener('click', function () { self.home(); });
      s.querySelector('.gioca').addEventListener('click', function () { self.preparazione(); });
      s.querySelector('.mazzi').addEventListener('click', function () { new Editor(self, d.mazzoAttivo); });
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
      UI.adattaTesto(v);
      // tre booster: si possono comprare tutti, e si aprono subito
      var vb = s.querySelector('.vetrina-booster');
      (n.booster || []).forEach(function (tipo, i) {
        var aperto = n.aperti.indexOf(i) >= 0, prezzo = pr.prezzoBooster(tipo), b = Booster.tipo(tipo);
        var o = el('div', 'offerta-booster' + (aperto ? ' aperto' : '')), pk = UIBooster.pacchetto(tipo);
        pk.addEventListener('click', function () { UI.avviso(b.nome + ' booster · ' + UIBooster.descrizione(b)); });
        var lato = el('div', 'lato', '<small>' + UIBooster.descrizione(b) + '</small><small class="conta-b">' + UIBooster.riepilogo(tipo) + '</small>');
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
        var sf = Avversari.trova(n.sfida), pz = pr.prezzoSfida(n.sfida);
        var va = el('div', 'voce pannello', '<img src="' + avatar(sf.nome) + '" alt=""><div class="t">' + sf.titolo + '</div><div class="s">' +
          (sf.tipo === 'rivale' ? 'Medium · ' + sf.tribu : 'Advanced') + ' · wins pay ' + UI.moneta(sf.premio) + '</div>');
        var ba = el('button', 'btn' + (d.monete < pz ? ' spento' : ' oro'), 'Unlock · ' + UI.moneta(pz));
        ba.addEventListener('click', function () { self.compra(function () { return pr.compraSfida(); }, ba); });
        va.appendChild(ba); banco.appendChild(va);
      } else if (!Avversari.tutti().some(function (a) { return a.tipo !== 'base' && d.sfide.indexOf(a.nome) < 0; })) banco.appendChild(el('div', 'voce pannello', '<div class="t">Every opponent unlocked</div>'));
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

  App.avatar = avatar;
  window.App = App;
  if (App.profilo.d.partita) App.riprendi(); else App.home();
})();
