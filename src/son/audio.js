// Le son du bord, entièrement calculé (aucun fichier audio) avec la Web Audio API.
//
// Tout part de bruit (un « souffle » aléatoire) que l'on filtre pour lui donner une
// couleur, puis dont on fait varier le volume :
//  - le vent : un souffle filtré dont la hauteur et la force suivent le vent apparent,
//    plus un sifflement aigu dans le gréement quand ça forcit ;
//  - l'eau le long de la coque : un bruit grave qui grandit avec la vitesse, et des
//    « claques » quand l'étrave tape dans une vague ;
//  - la mer autour : un ressac lent, toujours présent ;
//  - les voiles qui faseyent : un battement rapide et sec ;
//  - le winch : des cliquetis quand on borde une écoute ;
//  - la pluie, et le tonnerre, qui arrive après l'éclair (le son va moins vite que la
//    lumière : 340 m par seconde, donc 3 s par kilomètre) ;
//  - la nuit de tempête : le grondement d'une déferlante qui arrive puis s'écrase, l'eau
//    qui clapote dans la cabine et gargouille dans le cockpit, le rugissement de la
//    trombe, le moteur et la corne du cargo, l'alarme du pilote, une voile qui se déchire.
// Le navigateur exige un geste de l'utilisateur avant de jouer du son : on démarre au
// clic sur « Embarquer ».

function bruitBlanc(ctx, secondes = 3) {
  const b = ctx.createBuffer(1, ctx.sampleRate * secondes, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// bruit « rose » (plus doux, comme la mer) : méthode de Paul Kellet
function bruitRose(ctx, secondes = 4) {
  const b = ctx.createBuffer(1, ctx.sampleRate * secondes, ctx.sampleRate);
  const d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return b;
}

// bruit « brun » (très grave : le grondement du tonnerre, le ressac)
function bruitBrun(ctx, secondes = 4) {
  const b = ctx.createBuffer(1, ctx.sampleRate * secondes, ctx.sampleRate);
  const d = b.getChannelData(0);
  let dernier = 0;
  for (let i = 0; i < d.length; i++) {
    dernier = (dernier + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = dernier * 3.5;
  }
  return b;
}

export class Audio {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
  }

  // contexte : pour les tests, on peut fournir un OfflineAudioContext (le son est alors
  // calculé d'avance, plus vite que le temps réel, pour être mesuré)
  demarrer(contexte = null) {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const ctx = contexte ?? new AudioContext();
    this.ctx = ctx;
    this.horsLigne = !!contexte;
    this.blanc = bruitBlanc(ctx);
    this.rose = bruitRose(ctx);
    this.brun = bruitBrun(ctx);

    // sortie : un compresseur doux évite que l'orage sature
    this.compresseur = ctx.createDynamicsCompressor();
    this.compresseur.threshold.value = -18;
    this.compresseur.ratio.value = 3;
    this.sortie = ctx.createGain();
    this.sortie.gain.value = this.volume;
    this.cabine = ctx.createBiquadFilter();
    this.cabine.type = 'lowpass';
    this.cabine.frequency.value = 18000;
    this.compresseur.connect(this.cabine).connect(this.sortie).connect(ctx.destination);

    const source = (buffer, vitesse = 1) => {
      const s = ctx.createBufferSource();
      s.buffer = buffer;
      s.loop = true;
      s.playbackRate.value = vitesse;
      s.loopStart = Math.random();
      s.start(0, Math.random() * buffer.duration);
      return s;
    };
    const filtre = (type, frequence, q = 0.7) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = frequence;
      f.Q.value = q;
      return f;
    };
    const gain = (v = 0) => {
      const g = ctx.createGain();
      g.gain.value = v;
      return g;
    };

    // le vent
    this.vent = { filtre: filtre('bandpass', 500, 0.6), gain: gain() };
    source(this.rose).connect(this.vent.filtre).connect(this.vent.gain).connect(this.compresseur);
    // le sifflement du gréement (deux « notes » qui glissent)
    this.sifflement = [0, 1].map((i) => {
      const f = filtre('bandpass', 1400 + i * 700, 14);
      const g = gain();
      source(this.blanc, 0.9 + i * 0.13).connect(f).connect(g).connect(this.compresseur);
      return { filtre: f, gain: g };
    });
    // l'eau le long de la coque
    this.eau = { filtre: filtre('lowpass', 500, 0.5), gain: gain() };
    source(this.rose, 0.8).connect(this.eau.filtre).connect(this.eau.gain).connect(this.compresseur);
    // le ressac de la mer autour (modulé lentement)
    this.ressac = { filtre: filtre('lowpass', 700, 0.4), gain: gain(), lent: gain() };
    source(this.brun).connect(this.ressac.filtre).connect(this.ressac.gain).connect(this.compresseur);
    // les voiles qui faseyent : du bruit haché par un oscillateur lent
    this.faseyement = { filtre: filtre('bandpass', 380, 0.9), gain: gain(), hache: gain() };
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 6;
    const profondeur = gain(0.5);
    lfo.connect(profondeur).connect(this.faseyement.hache.gain);
    this.faseyement.hache.gain.value = 0.5;
    lfo.start();
    this.faseyement.lfo = lfo;
    source(this.blanc, 0.7).connect(this.faseyement.filtre).connect(this.faseyement.hache).connect(this.faseyement.gain).connect(this.compresseur);
    // la pluie
    this.pluie = { filtre: filtre('highpass', 3000, 0.5), gain: gain() };
    source(this.blanc, 1.1).connect(this.pluie.filtre).connect(this.pluie.gain).connect(this.compresseur);
    // l'eau dans la cabine (elle clapote d'un bord à l'autre) et dans le cockpit (elle
    // gargouille en s'écoulant par les nables)
    this.clapotis = { filtre: filtre('lowpass', 380, 0.9), gain: gain() };
    source(this.brun, 1.3).connect(this.clapotis.filtre).connect(this.clapotis.gain).connect(this.compresseur);
    this.gargouille = { filtre: filtre('bandpass', 520, 3), gain: gain() };
    source(this.rose, 1.6).connect(this.gargouille.filtre).connect(this.gargouille.gain).connect(this.compresseur);
    // la trombe : un rugissement grave et un sifflement
    this.trombe = { filtre: filtre('lowpass', 260, 0.7), gain: gain(), sifflement: filtre('bandpass', 900, 2), gainSifflement: gain() };
    source(this.brun, 0.7).connect(this.trombe.filtre).connect(this.trombe.gain).connect(this.compresseur);
    source(this.blanc, 0.8).connect(this.trombe.sifflement).connect(this.trombe.gainSifflement).connect(this.compresseur);
    // le cargo : le grondement de son moteur (un diesel lent : 90 tours par minute)
    this.moteur = { gain: gain(), filtre: filtre('lowpass', 140, 1) };
    const diesel = ctx.createOscillator();
    diesel.type = 'sawtooth';
    diesel.frequency.value = 41;
    const battement = ctx.createOscillator();
    battement.frequency.value = 1.5;
    const profondeurBattement = gain(0.5);
    const module = gain(0.5);
    battement.connect(profondeurBattement).connect(module.gain);
    diesel.connect(module).connect(this.moteur.filtre).connect(this.moteur.gain).connect(this.compresseur);
    diesel.start();
    battement.start();
    this.ageWinch = 0;
  }

  // Le volume d'un réglage glisse vers sa cible (pas de clic)
  vers(param, valeur, temps = 0.25) {
    param.setTargetAtTime(valeur, this.ctx.currentTime, temps);
  }

  // etat : { ventApparent (nds), vitesse (nds), faseyement (0 → 1), pluie (0 → 1),
  //          bordage (vitesse de rotation d'un winch, 0 → 1), houle (m) }
  actif() { return this.ctx && (this.horsLigne || this.ctx.state === 'running'); }

  maj(dt, e) {
    if (!this.actif()) return;
    const vent = Math.max(0, e.ventApparent);
    const fv = Math.min(1, vent / 45);
    // le vent : plus fort, et plus aigu quand il forcit (au carré de la vitesse)
    this.vers(this.vent.gain.gain, 0.04 + 0.5 * fv * fv + 0.05 * fv);
    this.vers(this.vent.filtre.frequency, 280 + 900 * fv);
    this.sifflement.forEach((s, i) => {
      const force = Math.max(0, (vent - 16 - i * 6) / 30);
      this.vers(s.gain.gain, 0.05 * force * force * (0.6 + 0.4 * Math.sin(this.ctx.currentTime * (0.7 + i * 0.4))));
      this.vers(s.filtre.frequency, 1200 + i * 650 + vent * 18 + 120 * Math.sin(this.ctx.currentTime * 0.9 + i));
    });
    // l'eau qui court le long de la coque
    const fe = Math.min(1, e.vitesse / 8);
    this.vers(this.eau.gain.gain, 0.03 + 0.4 * fe * fe);
    this.vers(this.eau.filtre.frequency, 300 + 1500 * fe);
    // le ressac, qui enfle et retombe comme les vagues
    const vague = 0.5 + 0.5 * Math.sin(this.ctx.currentTime * 0.42) * Math.sin(this.ctx.currentTime * 0.13 + 1);
    this.vers(this.ressac.gain.gain, (0.05 + Math.min(0.25, e.houle * 0.05)) * (0.5 + 0.5 * vague), 0.6);
    // les voiles qui battent
    this.vers(this.faseyement.gain.gain, 1.3 * e.faseyement * Math.min(1, vent / 15) ** 2, 0.1);
    this.faseyement.lfo.frequency.setTargetAtTime(4 + vent * 0.25, this.ctx.currentTime, 0.3);
    // la pluie
    this.vers(this.pluie.gain.gain, 0.35 * e.pluie, 0.8);
    // l'eau embarquée : elle clapote d'autant plus que le bateau roule
    const cale = Math.min(1, (e.eauCale ?? 0) / 900);
    const roule = Math.min(1, Math.abs(e.roulis ?? 0) / 0.4);
    this.vers(this.clapotis.gain.gain, cale * (0.12 + 0.5 * roule), 0.15);
    this.vers(this.gargouille.gain.gain, Math.min(0.22, (e.eauCockpit ?? 0) / 900), 0.4);
    // la trombe et le cargo, selon leur distance (0 : loin, 1 : sur nous)
    const tr = e.trombe ?? 0;
    this.vers(this.trombe.gain.gain, 0.9 * tr * tr, 0.5);
    this.vers(this.trombe.gainSifflement.gain, 0.12 * tr * tr * tr, 0.5);
    this.vers(this.moteur.gain.gain, 0.5 * (e.cargo ?? 0) ** 2, 0.8);
    // le winch : un cliquetis par cran du rochet
    if (e.bordage > 0.01) {
      this.ageWinch += dt * e.bordage * 22;
      while (this.ageWinch > 1) {
        this.ageWinch -= 1;
        this.clic();
      }
    }
  }

  // un clic de rochet de winch (métallique, très court)
  clic() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.blanc;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 3200 + Math.random() * 800;
    f.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.002, t + 0.04);
    s.connect(f).connect(g).connect(this.compresseur);
    s.start(t, Math.random() * 2, 0.05);
  }

  // l'étrave tape dans une vague : une gerbe d'eau (force 0 → 1)
  claque(force) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.rose;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900 + Math.random() * 500;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    const v = Math.min(1.4, 0.3 + force * 1.2);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.002, t + 0.6 + force * 0.6);
    s.connect(f).connect(g).connect(this.compresseur);
    s.start(t, Math.random() * 3, 1.4);
  }

  // le tonnerre : le craquement puis le grondement, d'autant plus tard et plus sourd
  // que l'éclair est loin
  tonnerre(distance, force = 1) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + distance / 340;
    const proche = Math.max(0, 1 - distance / 9000);
    const s = ctx.createBufferSource();
    s.buffer = this.brun;
    s.playbackRate.value = 0.6 + proche * 0.6;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 120 + 900 * proche;
    const g = ctx.createGain();
    const v = Math.min(1.2, (0.25 + proche * 0.9) * force);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.05 + (1 - proche) * 0.4);
    g.gain.setTargetAtTime(v * 0.5, t + 0.5, 0.6);
    g.gain.setTargetAtTime(0.0001, t + 1.6 + Math.random() * 1.5, 1.1);
    s.connect(f).connect(g).connect(this.compresseur);
    s.start(t, Math.random() * 2);
    s.stop(t + 9);
    // un craquement sec pour les éclairs proches
    if (proche > 0.55) {
      const c = ctx.createBufferSource();
      c.buffer = this.blanc;
      const fc = ctx.createBiquadFilter();
      fc.type = 'highpass';
      fc.frequency.value = 800;
      const gc = ctx.createGain();
      gc.gain.setValueAtTime(0, t);
      gc.gain.linearRampToValueAtTime(0.6 * proche, t + 0.01);
      gc.gain.exponentialRampToValueAtTime(0.002, t + 0.5);
      c.connect(fc).connect(gc).connect(this.compresseur);
      c.start(t, 0, 0.6);
    }
  }

  // en bas, dans la cabine : la tempête n'arrive plus qu'étouffée par la coque
  dansLaCabine(dedans) {
    if (!this.actif()) return;
    this.vers(this.cabine.frequency, dedans ? 650 : 18000, 0.35);
  }

  // le grésillement de la radio (quand on appuie sur l'alternat, ou à la fin d'un message)
  gresillement() {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.blanc;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2200;
    f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.02);
    g.gain.setValueAtTime(0.12, t + 0.22);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    s.connect(f).connect(g).connect(this.sortie);
    s.start(t, Math.random(), 0.4);
  }

  // un coup de pompe de cale (un « glouglou » sourd ; à sec, elle aspire de l'air)
  coupDePompe(avecEau = true) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = avecEau ? this.brun : this.rose;
    const f = ctx.createBiquadFilter();
    f.type = avecEau ? 'lowpass' : 'bandpass';
    f.frequency.value = avecEau ? 420 : 1300;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.002, t + 0.45);
    s.connect(f).connect(g).connect(this.compresseur);
    s.start(t, Math.random() * 2, 0.5);
  }

  // un choc sourd (la bôme qui frappe, une chute)
  choc(force = 1) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.7 * force, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g).connect(this.compresseur);
    o.start(t);
    o.stop(t + 0.5);
  }

  // Une déferlante : on l'entend arriver (un grondement qui enfle pendant « dans »
  // secondes), puis elle s'écrase sur le bateau (fracas, et un coup sourd dans la coque)
  deferlante(force = 0.5, dans = 3.5) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const impact = t + dans;
    const v = 0.35 + 0.7 * force;
    // le grondement : du bruit grave qui monte et s'éclaircit en approchant
    const g1 = ctx.createBufferSource();
    g1.buffer = this.brun;
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.Q.value = 0.6;
    f1.frequency.setValueAtTime(180, t);
    f1.frequency.exponentialRampToValueAtTime(700, impact);
    const a1 = ctx.createGain();
    a1.gain.setValueAtTime(0.0001, t);
    a1.gain.exponentialRampToValueAtTime(v * 0.9, impact);
    a1.gain.setTargetAtTime(0.0001, impact + 0.1, 0.5);
    g1.connect(f1).connect(a1).connect(this.compresseur);
    g1.start(t, Math.random() * 2);
    g1.stop(impact + 3);
    // le fracas de l'eau : un souffle large, qui retombe en ruisselant
    const g2 = ctx.createBufferSource();
    g2.buffer = this.rose;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'lowpass';
    f2.frequency.setValueAtTime(5000, impact);
    f2.frequency.exponentialRampToValueAtTime(600, impact + 2.5);
    const a2 = ctx.createGain();
    a2.gain.setValueAtTime(0.0001, impact - 0.05);
    a2.gain.linearRampToValueAtTime(v * 1.3, impact + 0.04);
    a2.gain.setTargetAtTime(0.0001, impact + 0.3, 0.7);
    g2.connect(f2).connect(a2).connect(this.compresseur);
    g2.start(impact - 0.05, Math.random() * 2);
    g2.stop(impact + 4);
    // le coup dans la coque
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(90, impact);
    o.frequency.exponentialRampToValueAtTime(38, impact + 0.35);
    const a3 = ctx.createGain();
    a3.gain.setValueAtTime(0.0001, impact);
    a3.gain.linearRampToValueAtTime(v, impact + 0.01);
    a3.gain.exponentialRampToValueAtTime(0.001, impact + 0.5);
    o.connect(a3).connect(this.compresseur);
    o.start(impact);
    o.stop(impact + 0.6);
  }

  // L'alarme du pilote automatique : des bips aigus, par trois
  alarme(repetitions = 4) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    for (let r = 0; r < repetitions; r++) {
      for (let k = 0; k < 3; k++) {
        const t = t0 + r * 1.1 + k * 0.22;
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = 2650;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.06, t + 0.005);
        g.gain.setValueAtTime(0.06, t + 0.13);
        g.gain.linearRampToValueAtTime(0, t + 0.14);
        o.connect(g).connect(this.sortie);
        o.start(t);
        o.stop(t + 0.15);
      }
    }
  }

  // Une voile qui se déchire (un long craquement qui monte), ou une écoute qui casse (un
  // claquement sec, puis le fouet du bout libre)
  dechirure(sorte = 'dechire') {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.blanc;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = sorte === 'claque' ? 1.5 : 4;
    const g = ctx.createGain();
    if (sorte === 'claque') {
      f.frequency.setValueAtTime(2500, t);
      f.frequency.exponentialRampToValueAtTime(700, t + 0.3);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1.1, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.002, t + 0.35);
    } else {
      f.frequency.setValueAtTime(500, t);
      f.frequency.exponentialRampToValueAtTime(3200, t + 0.9);
      g.gain.setValueAtTime(0, t);
      // (le tissu cède par à-coups)
      for (let k = 0; k < 14; k++) g.gain.setValueAtTime(0.25 + 0.6 * Math.random(), t + k * 0.065);
      g.gain.setTargetAtTime(0.0001, t + 0.95, 0.08);
    }
    s.connect(f).connect(g).connect(this.compresseur);
    s.start(t, Math.random() * 2, 1.4);
  }

  // La corne du cargo : n coups brefs (cinq : « je ne comprends pas vos intentions »)
  corne(n = 5) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    for (let k = 0; k < n; k++) {
      const t = t0 + k * 1.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.35, t + 0.08);
      g.gain.setValueAtTime(0.35, t + 0.9);
      g.gain.linearRampToValueAtTime(0, t + 1.05);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 700;
      for (const [frequence, niveau] of [[87, 1], [174, 0.6], [261, 0.3]]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = frequence;
        const a = ctx.createGain();
        a.gain.value = niveau;
        o.connect(a).connect(f);
        o.start(t);
        o.stop(t + 1.1);
      }
      f.connect(g).connect(this.compresseur);
    }
  }

  regler(volume) {
    this.volume = volume;
    if (this.sortie) this.vers(this.sortie.gain, volume, 0.1);
  }
}
