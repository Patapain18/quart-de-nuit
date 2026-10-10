// Le son du bord, avec la Web Audio API : de vrais enregistrements (la sonothèque) mélangés
// en direct, et des sons calculés pour le reste.
//
// Les enregistrements (public/sons/, tous dans le domaine public) : le vent (de la brise à
// la tempête, par rafales), le gréement qui siffle puis hurle, la mer qui déferle, le
// cockpit par beau temps, les voiles pleines, la pluie sur le pont, une voile qui bat, le
// moteur du pilote ; dans la cabine, la mer à travers la coque, l'eau contre la coque, la
// pluie sur le toit, la tempête entendue de l'intérieur, le vent qui hurle ; et des sons
// brefs : le bois et les cordages qui craquent, les vagues qui frappent, le tonnerre, la
// corne du cargo, la radio qui grésille.
//
// Le mélange suit ce qui se passe, à chaque image (maj) : la force du vent, la pluie, la
// hauteur des vagues, les voiles qui faseyent, le bateau qui roule (le bois travaille).
// Les « bus » (des tables de mixage) :
//  - dehors : le fond de la tempête (le vent, la mer, la pluie sur le pont) ; dans la
//    timonerie, les vitres l'étouffent (moins quand la porte est ouverte, plus quand les
//    volets sont fermés), et le moteur le couvre ;
//  - signes : ce qu'il faut entendre venir — le grondement des déferlantes, la vague
//    scélérate, la trombe, le tonnerre : les vitres les étouffent moins, le moteur les couvre ;
//  - dedans : ce que l'on n'entend que dans la timonerie (la pluie sur le toit, le vent qui
//    siffle, l'eau contre la coque ; les coups, les pas, la porte), avec l'écho d'une petite
//    pièce en bois ;
//  - bord : ce qui est à bord, dedans comme dehors (le moteur, les pompes, les alarmes, les
//    craquements) ;
//  - radio : le haut-parleur de la VHF ; tete : ce qui n'est que dans ta tête (le cœur, le
//    sifflement de l'angoisse).
// Plus silencieux que l'ancien jeu : la nuit, le fond est bas, et il respire — de longs creux
// où le vent tombe un moment (respirer) ; avant les coups, le monde se tait (etouffer).
// Chaque son vient de sa direction : il a une place, un point du bateau (son repère : tribord
// vers +x, le haut vers +y, l'arrière vers +z — la mer et le ciel, ramenés dans ce repère), et
// l'oreille est là où sont tes yeux (ecouter : le jeu la place à chaque image) ; avec un casque,
// on entend s'il vient de devant ou de derrière, d'en haut ou d'en bas (le modèle « HRTF »).
// Les sons calculés (du bruit filtré, comme avant) font le reste : l'eau le long de la
// coque, le clapot dans la cabine, le moteur du cargo, la trombe, les bips… et ils
// remplacent les enregistrements tant que ceux-ci ne sont pas chargés.
// Le navigateur exige un geste de l'utilisateur avant de jouer du son : le contexte est
// créé muet au chargement (on peut déjà décoder les enregistrements), et démarre au clic
// sur « Embarquer ».
import { Sonotheque } from './sonotheque.js';

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

// L'écho d'une petite pièce en bois (la cabine) : quelques premières réflexions sur les
// cloisons proches, puis une queue qui s'éteint en un tiers de seconde
function echoCabine(ctx) {
  const duree = 0.6;
  const n = Math.floor(ctx.sampleRate * duree);
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) {
      const t = i / ctx.sampleRate;
      d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 19) * 0.5;
    }
    for (const [ms, a] of [[6, 0.7], [9 + c * 2, 0.5], [14, 0.4], [21 - c * 3, 0.3]]) d[Math.floor((ms / 1000) * ctx.sampleRate)] += a;
  }
  return b;
}

// L'écho du large : une queue longue, sombre (le gémissement de la mer s'y noie)
function echoLarge(ctx) {
  const duree = 4.2;
  const n = Math.floor(ctx.sampleRate * duree);
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let lisse = 0;
    for (let i = 0; i < n; i++) {
      const t = i / ctx.sampleRate;
      // (du bruit adouci : les aigus meurent plus vite que les graves)
      lisse += ((Math.random() * 2 - 1) - lisse) * (0.05 + 0.25 * Math.exp(-t * 2));
      d[i] = lisse * Math.exp(-t * 1.6) * 0.9;
    }
  }
  return b;
}

// Les boucles enregistrées, et sur quel bus elles jouent
const BOUCLES = {
  'vent-doux': 'dehors', 'vent-fort': 'dehors', 'vent-rafales': 'dehors', greement: 'dehors', 'greement-aigu': 'dehors',
  'mer-forte': 'dehors', 'cockpit-jour': 'dehors', 'sous-voiles': 'dehors', 'pluie-pont': 'dehors', 'voile-bat': 'dehors',
  pilote: 'fondBord', hurlement: 'fondBord', 'cabine-mer': 'fondDedans', coque: 'fondDedans', 'pluie-toit': 'fondDedans', 'vent-dedans': 'fondDedans',
};
// (celles qui ont une place à bord : le vérin du pilote, à l'arrière, sur la mèche du safran)
const PLACES_BOUCLES = { pilote: 'safran' };

// D'où vient un son : rien (partout), un nombre (un simple panoramique, de −1 à gauche à 1 à
// droite), ou un point du bateau { x, y, z }
const estUnPoint = (ou) => !!ou && typeof ou === 'object';
// (place un nœud qui a une position : un panneur, ou l'oreille ; quand — t — pour un son qui
// bouge : il y glisse depuis là où il était)
function placer(n, p, t = null, ctx = null) {
  if (n.positionX) {
    for (const [param, v] of [[n.positionX, p.x], [n.positionY, p.y], [n.positionZ, p.z]]) {
      if (t === null) param.value = v;
      else param.linearRampToValueAtTime(v, t);
    }
  } else if (t === null || !ctx) n.setPosition(p.x, p.y, p.z);
}

const lisse = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
    this.niveaux = {}; // le volume voulu de chaque boucle (pour l'atelier du son)
    this.boucles = {};
  }

  // Au chargement de la page : le contexte (muet tant que l'on n'a pas cliqué) et les
  // enregistrements, chargés en arrière-plan
  precharger(base = './sons/') {
    if (this.ctx || typeof AudioContext === 'undefined') return;
    this.creer(new AudioContext(), base);
  }

  // contexte : pour les tests, on peut fournir un OfflineAudioContext (le son est alors
  // calculé d'avance, plus vite que le temps réel, pour être mesuré)
  // (sonotheque : une sonothèque déjà chargée, à partager : ses sons décodés servent tels
  // quels, sans les recharger — l'atelier du son s'en sert pour ses mesures)
  demarrer(contexte = null, base = './sons/', { sonotheque = null } = {}) {
    if (this.ctx) {
      if (!this.horsLigne) this.ctx.resume();
      return;
    }
    this.creer(contexte ?? new AudioContext(), base, !!contexte, sonotheque);
  }

  creer(ctx, base, horsLigne = false, partagee = null) {
    this.ctx = ctx;
    this.horsLigne = horsLigne;
    this.blanc = bruitBlanc(ctx);
    this.rose = bruitRose(ctx);
    this.brun = bruitBrun(ctx);
    const gain = (v = 0) => {
      const g = ctx.createGain();
      g.gain.value = v;
      return g;
    };
    const filtre = (type, frequence, q = 0.7) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = frequence;
      f.Q.value = q;
      return f;
    };

    // la sortie : un compresseur doux évite que l'orage sature
    this.compresseur = ctx.createDynamicsCompressor();
    this.compresseur.threshold.value = -18;
    this.compresseur.ratio.value = 3;
    this.sortie = gain(this.volume);
    this.compresseur.connect(this.sortie).connect(ctx.destination);
    // les bus
    this.filtreCabine = filtre('lowpass', 18000, 0.5);
    this.bus = {
      dehors: gain(1), signes: gain(1), dedans: gain(0), bord: gain(1), radio: gain(1), tete: gain(1),
      // (les fonds : ce qui se retire dans les creux — etouffer, respirer)
      fondDedans: gain(1), fondBord: gain(1),
    };
    // (le fond du monde peut se retirer : etouffer() avant un coup, et respirer() de lui-même ;
    // le moteur du bord, quand il tourne, le couvre : masque)
    this.etouffe = gain(1);
    this.respire = gain(1);
    this.masque = gain(1);
    this.bus.dehors.connect(this.respire).connect(this.etouffe).connect(this.masque).connect(this.filtreCabine).connect(this.compresseur);
    // (les signes : ni les creux ni les vitres ne les éteignent tout à fait ; le moteur, si)
    this.masqueSignes = gain(1);
    this.filtreSignes = filtre('lowpass', 18000, 0.5);
    this.vitresSignes = gain(1);
    this.bus.signes.connect(this.masqueSignes).connect(this.filtreSignes).connect(this.vitresSignes).connect(this.compresseur);
    this.etouffeDedans = gain(1);
    this.respireDedans = gain(1);
    this.masqueDedans = gain(1);
    this.bus.fondDedans.connect(this.respireDedans).connect(this.etouffeDedans).connect(this.masqueDedans).connect(this.bus.dedans);
    this.etouffeBord = gain(1);
    this.respireBord = gain(1);
    this.masqueBord = gain(1);
    this.bus.fondBord.connect(this.respireBord).connect(this.etouffeBord).connect(this.masqueBord).connect(this.bus.bord);
    this.bus.dedans.connect(this.compresseur);
    this.bus.bord.connect(this.compresseur);
    // (la VHF : son haut-parleur, au plafond de la timonerie — placé quand le jeu dit où il est)
    this.panneurRadio = ctx.createStereoPanner();
    this.bus.radio.connect(this.panneurRadio).connect(this.sortie);
    this.bus.tete.connect(this.sortie);
    this.creux = { prochain: 30 + Math.random() * 30, fin: -1 };
    // l'écho de la cabine : sur ce qui est dedans, et sur le bord quand on est dedans
    this.echo = ctx.createConvolver();
    this.echo.buffer = echoCabine(ctx);
    this.retourEcho = gain(0.5);
    this.echo.connect(this.retourEcho).connect(this.compresseur);
    this.envoiBord = gain(0);
    this.bus.dedans.connect(this.echo);
    this.bus.bord.connect(this.envoiBord).connect(this.echo);
    this.dedans = false;

    const source = (buffer, vitesse = 1) => {
      const s = ctx.createBufferSource();
      s.buffer = buffer;
      s.loop = true;
      s.playbackRate.value = vitesse;
      s.loopStart = Math.random();
      s.start(0, Math.random() * buffer.duration);
      return s;
    };

    // ----- les sons calculés -----
    // le vent
    this.vent = { filtre: filtre('bandpass', 500, 0.6), gain: gain() };
    source(this.rose).connect(this.vent.filtre).connect(this.vent.gain).connect(this.bus.dehors);
    // le sifflement du gréement (deux « notes » qui glissent)
    this.sifflement = [0, 1].map((i) => {
      const f = filtre('bandpass', 1400 + i * 700, 14);
      const g = gain();
      source(this.blanc, 0.9 + i * 0.13).connect(f).connect(g).connect(this.bus.dehors);
      return { filtre: f, gain: g };
    });
    // la risée qui arrive : l'eau froissée qui chuinte, de plus en plus fort, puis le
    // souffle qui passe sur nous
    this.risee = { filtre: filtre('bandpass', 1900, 0.7), gain: gain() };
    source(this.blanc, 1.07).connect(this.risee.filtre).connect(this.risee.gain).connect(this.bus.dehors);
    // le feu de Saint-Elme : l'air chargé grésille en tête de mât (un souffle aigu, haché de
    // petits craquements)
    this.saintElme = { filtre: filtre('bandpass', 5200, 1.4), hache: gain(0), gain: gain() };
    source(this.blanc, 1.31).connect(this.saintElme.filtre).connect(this.saintElme.hache).connect(this.saintElme.gain).connect(this.bus.dehors);
    // l'eau le long de la coque
    this.eau = { filtre: filtre('lowpass', 500, 0.5), gain: gain() };
    source(this.rose, 0.8).connect(this.eau.filtre).connect(this.eau.gain).connect(this.bus.dehors);
    // le ressac de la mer autour
    this.ressac = { filtre: filtre('lowpass', 700, 0.4), gain: gain() };
    source(this.brun).connect(this.ressac.filtre).connect(this.ressac.gain).connect(this.bus.dehors);
    // les voiles qui faseyent : du bruit haché par un oscillateur lent
    this.faseyement = { filtre: filtre('bandpass', 380, 0.9), gain: gain(), hache: gain() };
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 6;
    lfo.connect(gain(0.5)).connect(this.faseyement.hache.gain);
    this.faseyement.hache.gain.value = 0.5;
    lfo.start();
    this.faseyement.lfo = lfo;
    source(this.blanc, 0.7).connect(this.faseyement.filtre).connect(this.faseyement.hache).connect(this.faseyement.gain).connect(this.bus.dehors);
    // la pluie
    this.pluie = { filtre: filtre('highpass', 3000, 0.5), gain: gain() };
    source(this.blanc, 1.1).connect(this.pluie.filtre).connect(this.pluie.gain).connect(this.bus.dehors);
    // l'eau dans la cabine (elle clapote d'un bord à l'autre) et dans le cockpit (elle
    // gargouille en s'écoulant par les nables)
    this.clapotis = { filtre: filtre('lowpass', 380, 0.9), gain: gain() };
    source(this.brun, 1.3).connect(this.clapotis.filtre).connect(this.clapotis.gain).connect(this.lieu('cale', 'bord'));
    this.gargouille = { filtre: filtre('bandpass', 520, 3), gain: gain() };
    source(this.rose, 1.6).connect(this.gargouille.filtre).connect(this.gargouille.gain).connect(this.lieu('dalots', 'bord'));
    // la trombe : un rugissement grave et un sifflement
    // (elle a sa place, qui bouge : maj la suit — e.ouTrombe)
    this.trombe = { filtre: filtre('lowpass', 260, 0.7), gain: gain(), sifflement: filtre('bandpass', 900, 2), gainSifflement: gain(), cote: this.panneur({ x: 0, y: 30, z: 400 }) };
    this.trombe.cote.connect(this.bus.signes);
    source(this.brun, 0.7).connect(this.trombe.filtre).connect(this.trombe.gain).connect(this.trombe.cote);
    source(this.blanc, 0.8).connect(this.trombe.sifflement).connect(this.trombe.gainSifflement).connect(this.trombe.cote);
    // le cargo : le grondement de son moteur (un diesel lent : 90 tours par minute)
    this.moteur = { gain: gain(), filtre: filtre('lowpass', 140, 1) };
    const diesel = ctx.createOscillator();
    diesel.type = 'sawtooth';
    diesel.frequency.value = 41;
    const battement = ctx.createOscillator();
    battement.frequency.value = 1.5;
    const module = gain(0.5);
    battement.connect(gain(0.5)).connect(module.gain);
    diesel.connect(module).connect(this.moteur.filtre).connect(this.moteur.gain).connect(this.bus.dehors);
    diesel.start();
    battement.start();
    // le moteur du bord : un diesel de quatre cylindres, sous le cockpit — à 1 800 tours, une
    // explosion toutes les 17 ms (60 Hz), irrégulière d'un cycle à l'autre (15 Hz), le
    // claquement des injecteurs par-dessus, et la coque qui vibre dessous ; il s'entend
    // partout à bord
    this.diesel = { gain: gain(), regime: 0 };
    {
      const explosions = ctx.createOscillator();
      explosions.type = 'sawtooth';
      explosions.frequency.value = 60;
      const cycle = ctx.createOscillator();
      cycle.frequency.value = 15;
      const irregulier = gain(0.7);
      cycle.connect(gain(0.3)).connect(irregulier.gain);
      const grave = filtre('lowpass', 210, 1.2);
      explosions.connect(irregulier).connect(grave).connect(gain(0.9)).connect(this.diesel.gain);
      const claque = gain(0);
      const hacheur = ctx.createOscillator();
      hacheur.type = 'square';
      hacheur.frequency.value = 60;
      hacheur.connect(gain(0.5)).connect(claque.gain);
      claque.gain.value = 0.5;
      source(this.blanc, 1).connect(filtre('bandpass', 1300, 1.6)).connect(claque).connect(gain(0.22)).connect(this.diesel.gain);
      const coque = ctx.createOscillator();
      coque.frequency.value = 30;
      coque.connect(gain(0.45)).connect(this.diesel.gain);
      for (const o of [explosions, cycle, hacheur, coque]) o.start();
      this.diesel.oscillateurs = [explosions, cycle, hacheur, coque];
      this.diesel.gain.connect(this.lieu('moteur', 'bord'));
    }
    // la pompe de cale électrique : un moteur qui geint, l'eau qui gicle dans le tuyau
    this.pompeElectrique = { gain: gain() };
    {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 182;
      o.connect(filtre('lowpass', 900, 0.8)).connect(gain(0.5)).connect(this.pompeElectrique.gain);
      source(this.rose, 1.4).connect(filtre('bandpass', 700, 1.2)).connect(gain(0.6)).connect(this.pompeElectrique.gain);
      o.start();
      this.pompeElectrique.gain.connect(this.lieu('cale', 'bord'));
    }
    // les moteurs des volets : un ronronnement, tant qu'ils bougent
    this.moteursVolets = { gain: gain() };
    {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 96;
      const f = filtre('bandpass', 420, 2);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 23;
      const m = gain(0.6);
      lfo.connect(gain(0.4)).connect(m.gain);
      o.connect(f).connect(m).connect(this.moteursVolets.gain);
      o.start();
      lfo.start();
      this.moteursVolets.gain.connect(this.lieu('volets', 'bord'));
    }
    this.alarmesBord = {}; // (quand chaque alarme a sonné la dernière fois)
    // la vague scélérate : un grondement grave qui enfle pendant qu'elle approche, et
    // dessous une pulsation sourde (deux notes très graves, presque pareilles, qui battent
    // lentement l'une contre l'autre : on la sent plus qu'on ne l'entend)
    // (on l'entend venir de son côté : cote, que maj place — e.ouScelerate)
    this.scelerate = { filtre: filtre('lowpass', 120, 0.8), gain: gain(), pulsation: gain(), cote: this.panneur({ x: 0, y: 5, z: 400 }) };
    this.scelerate.cote.connect(this.bus.signes);
    source(this.brun, 0.6).connect(this.scelerate.filtre).connect(this.scelerate.gain).connect(this.scelerate.cote);
    for (const f of [43, 45.5, 87]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.connect(gain(f > 80 ? 0.25 : 0.5)).connect(this.scelerate.pulsation);
      o.start();
    }
    this.scelerate.pulsation.connect(this.scelerate.cote);
    // l'angoisse : un bourdonnement très grave, deux notes qui battent lentement, et tout
    // en haut un sifflement à peine audible ; il monte avec la tension de la nuit
    this.angoisse = { gain: gain(), aigu: gain() };
    for (const f of [49, 51.7, 98.6]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.connect(gain(f > 90 ? 0.3 : 0.5)).connect(this.angoisse.gain);
      o.start();
    }
    const bande = filtre('bandpass', 210, 3);
    source(this.brun, 0.5).connect(bande).connect(gain(0.6)).connect(this.angoisse.gain);
    this.angoisse.gain.connect(this.bus.bord);
    const sifflement = ctx.createOscillator();
    sifflement.frequency.value = 3150;
    sifflement.connect(this.angoisse.aigu).connect(this.bus.tete);
    sifflement.start();
    // l'écho du large
    this.echoLarge = ctx.createConvolver();
    this.echoLarge.buffer = echoLarge(ctx);
    this.echoLarge.connect(gain(0.8)).connect(this.bus.dehors);
    this.ageWinch = 0;
    this.ageCraquement = 0;

    // ----- les enregistrements -----
    if (partagee) {
      this.sonotheque = partagee;
      for (const nom of partagee.tampons.keys()) this.brancher(nom);
      this.chargement = Promise.resolve();
      return;
    }
    this.sonotheque = new Sonotheque(ctx, base);
    this.sonotheque.quandPret.add((nom) => this.brancher(nom));
    this.chargement = this.sonotheque.charger().catch((e) => console.warn('sons :', e.message));
    if (this.lieux) this.fixerLieux(this.lieux);
  }

  // Un enregistrement vient d'arriver : s'il s'agit d'une boucle, elle se met à tourner
  // (muette jusqu'à ce que maj lui donne du volume)
  brancher(nom) {
    const infos = this.sonotheque.infos(nom);
    if (!infos || infos.sorte !== 'boucle' || !BOUCLES[nom]) return;
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.sonotheque.tampon(nom);
    s.loop = true;
    [s.loopStart, s.loopEnd] = infos.boucle;
    const g = ctx.createGain();
    g.gain.value = 0;
    s.connect(g).connect(PLACES_BOUCLES[nom] ? this.lieu(PLACES_BOUCLES[nom], BOUCLES[nom]) : this.bus[BOUCLES[nom]]);
    // (chaque boucle part d'un endroit au hasard : deux parties ne sonnent pas pareil — sauf pour
    // les mesures de l'atelier du son, qui doivent se comparer d'une fois à l'autre)
    s.start(0, infos.boucle[0] + (this.horsLigne ? 0.37 : Math.random()) * (infos.boucle[1] - infos.boucle[0]));
    this.boucles[nom] = { source: s, gain: g };
    // la trombe : les mêmes enregistrements, ralentis (plus graves), font son grondement de
    // train de marchandises (le vent de tempête à mi-vitesse) et le fracas de l'eau arrachée
    if (nom === 'mer-forte') {
      // (et la vague scélérate : sa crête qui s'écroule, un rugissement plus grave encore)
      const r = ctx.createBufferSource();
      r.buffer = s.buffer;
      r.loop = true;
      [r.loopStart, r.loopEnd] = infos.boucle;
      r.playbackRate.value = 0.52;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 300;
      const g2 = ctx.createGain();
      g2.gain.value = 0;
      r.connect(f).connect(g2).connect(this.bus.dehors);
      r.start(0, infos.boucle[0] + Math.random() * (infos.boucle[1] - infos.boucle[0]));
      this.boucles['scelerate-mer-forte'] = { source: r, gain: g2, filtre: f };
    }
    // l'averse d'un grain qui arrive : la pluie, un peu plus grave, qui gronde au loin sur la
    // mer (un souffle sourd, qui s'éclaircit en approchant)
    if (nom === 'pluie-pont') {
      const a = ctx.createBufferSource();
      a.buffer = s.buffer;
      a.loop = true;
      [a.loopStart, a.loopEnd] = infos.boucle;
      a.playbackRate.value = 0.82;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      const ga = ctx.createGain();
      ga.gain.value = 0;
      a.connect(f).connect(ga).connect(this.bus.dehors);
      a.start(0, infos.boucle[0] + Math.random() * (infos.boucle[1] - infos.boucle[0]));
      this.boucles['averse-pluie-pont'] = { source: a, gain: ga, filtre: f };
    }
    if (nom === 'vent-rafales' || nom === 'mer-forte') {
      const t = ctx.createBufferSource();
      t.buffer = s.buffer;
      t.loop = true;
      [t.loopStart, t.loopEnd] = infos.boucle;
      t.playbackRate.value = nom === 'vent-rafales' ? 0.5 : 0.72;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 400;
      const gt = ctx.createGain();
      gt.gain.value = 0;
      t.connect(f).connect(gt).connect(this.bus.dehors);
      t.start(0, infos.boucle[0] + Math.random() * (infos.boucle[1] - infos.boucle[0]));
      this.boucles[`trombe-${nom}`] = { source: t, gain: gt, filtre: f };
    }
  }

  a(nom) { return !!this.boucles[nom]; }

  // ---------- D'où vient le son ----------
  // Un panneur à cette place (un point du bateau) : avec un casque, on entend d'où ça vient ;
  // pres : un son du bord, à quelques mètres (il s'atténue un peu avec la distance) ; sinon (la
  // mer, le ciel, la trombe), seule compte sa direction — le jeu règle déjà son volume
  panneur(p, { pres = false } = {}) {
    const n = this.ctx.createPanner();
    // (avec un casque — l'option : en trois dimensions, devant, derrière, en haut ; sinon, un
    // panoramique franc, qui s'entend aussi sur des haut-parleurs : dans les graves, la 3D ne
    // sépare presque pas les deux oreilles — 3 dB à 300 Hz)
    n.panningModel = this.casque ? 'HRTF' : 'equalpower';
    (this.panneurs ??= new Set()).add(new WeakRef(n));
    n.distanceModel = 'inverse';
    n.refDistance = pres ? 1.2 : 1;
    n.rolloffFactor = pres ? 0.5 : 0;
    placer(n, p);
    return n;
  }

  // Le son en trois dimensions (avec un casque), ou non : pour les panneurs qui existent déjà, et
  // les suivants
  regler3D(casque) {
    this.casque = !!casque;
    for (const r of this.panneurs ?? []) {
      const n = r.deref();
      if (n) n.panningModel = this.casque ? 'HRTF' : 'equalpower';
      else this.panneurs.delete(r);
    }
  }

  // Le nœud où brancher un son qui vient de « ou » (rien, un panoramique, ou un point du bateau),
  // relié au bus (son nom, ou un nœud)
  versOu(ou, bus, { pres = false } = {}) {
    const sortie = typeof bus === 'string' ? this.bus[bus] : bus;
    if (!ou) return sortie;
    let n;
    if (estUnPoint(ou)) n = this.panneur(ou, { pres });
    else {
      n = this.ctx.createStereoPanner();
      n.pan.value = Math.max(-1, Math.min(1, ou));
    }
    n.connect(sortie);
    return n;
  }

  // Un lieu du bord (le moteur, la cale, la console… : fixerLieux), pour ce qui y sonne sans
  // cesse ; tant que le jeu ne les a pas donnés, au milieu
  lieu(nom, bus) {
    this.panneursLieux ??= [];
    const n = this.panneur(this.lieux?.[nom] ?? { x: 0, y: 1.5, z: 2 }, { pres: true });
    n.connect(this.bus[bus]);
    this.panneursLieux.push([nom, n]);
    return n;
  }

  // (la sortie d'un lieu du bord, pour les sons brefs qui y sonnent : une seule par lieu et par bus)
  aLieu(nom, bus) {
    this.sortiesLieux ??= {};
    return (this.sortiesLieux[`${nom}:${bus}`] ??= this.lieu(nom, bus));
  }

  // Le jeu dit où sont les choses à bord ({ nom: { x, y, z } } : le moteur, la cale, la console,
  // la VHF, le safran, les volets, les dalots…)
  fixerLieux(lieux) {
    this.lieux = lieux;
    for (const [nom, n] of this.panneursLieux ?? []) if (lieux[nom]) placer(n, lieux[nom]);
    if (this.ctx && lieux.vhf) {
      // (la VHF : un vrai panneur, maintenant qu'on sait où elle est)
      this.panneurRadio.disconnect();
      this.bus.radio.disconnect();
      this.panneurRadio = this.panneur(lieux.vhf, { pres: true });
      this.bus.radio.connect(this.panneurRadio).connect(this.sortie);
    }
  }

  // L'oreille : là où sont les yeux, le regard et le haut de la tête (repère du bateau)
  ecouter({ position, avant, haut }) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      const t = this.ctx.currentTime;
      const regler = (param, v) => param.setTargetAtTime(v, t, 0.015);
      regler(l.positionX, position.x);
      regler(l.positionY, position.y);
      regler(l.positionZ, position.z);
      regler(l.forwardX, avant.x);
      regler(l.forwardY, avant.y);
      regler(l.forwardZ, avant.z);
      regler(l.upX, haut.x);
      regler(l.upY, haut.y);
      regler(l.upZ, haut.z);
    } else {
      l.setPosition(position.x, position.y, position.z);
      l.setOrientation(avant.x, avant.y, avant.z, haut.x, haut.y, haut.z);
    }
  }

  // le volume d'une boucle enregistrée (et sa vitesse de lecture, qui change sa hauteur)
  boucle(nom, niveau, temps = 0.4, vitesse = null) {
    this.niveaux[nom] = niveau;
    const b = this.boucles[nom];
    if (!b) return;
    this.vers(b.gain.gain, niveau, temps);
    if (vitesse !== null) b.source.playbackRate.setTargetAtTime(vitesse, this.ctx.currentTime, 0.5);
  }

  // Le volume d'un réglage glisse vers sa cible (pas de clic)
  vers(param, valeur, temps = 0.25) {
    param.setTargetAtTime(valeur, this.ctx.currentTime, temps);
  }

  actif() { return this.ctx && (this.horsLigne || this.ctx.state === 'running'); }

  // e : { ventApparent (nds), vitesse (nds), faseyement (0 → 1), pluie (0 → 1), averse (0 → 1 :
  //       l'averse d'un grain qui arrive, on l'entend sur la mer), risee (0 → 1 : une risée
  //       qui arrive, puis qui passe),
  //       bordage (vitesse de rotation d'un winch, 0 → 1), houle (m, hauteur significative),
  //       eauCale, eauCockpit (litres), roulis (rad/s), mouvement (secousses du bateau, 0 → 1),
  //       trombe, cargo (0 : loin → 1 : sur nous), pilote (le vérin travaille, 0 → 1),
  //       nuit (0 → 1), voiles (toile hissée, 0 → 1) }
  maj(dt, e) {
    if (!this.actif()) return;
    const t = this.ctx.currentTime;
    if (e.ecoute) this.ecouter(e.ecoute);
    if (e.heure !== undefined && e.heure !== null) this.respirer(dt, e.heure);
    const vent = Math.max(0, e.ventApparent);
    const fv = Math.min(1, vent / 45);
    const hs = e.houle ?? 1;
    // (quand un enregistrement est là, le son calculé correspondant s'efface presque)
    const calcul = (nom, reste) => (this.a(nom) ? reste : 1);

    // ----- dehors -----
    // le vent : la brise (enregistrée en studio, régulière), puis la tempête, puis ses rafales
    // (la tempête enfle toute la nuit, du coup de vent de minuit — 29 nœuds — à 44 nœuds)
    this.boucle('vent-doux', 0.4 * lisse(2, 14, vent) * (1 - 0.6 * lisse(24, 36, vent)), 0.5, 0.85 + 0.35 * fv);
    this.boucle('vent-fort', 0.75 * lisse(18, 44, vent), 0.6);
    this.boucle('vent-rafales', 0.75 * lisse(24, 40, vent), 0.6);
    this.vers(this.vent.gain.gain, (0.04 + 0.5 * fv * fv + 0.05 * fv) * calcul('vent-doux', 0.2));
    this.vers(this.vent.filtre.frequency, 280 + 900 * fv);
    // la risée : on l'entend arriver sur l'eau (par gros temps, le vent la couvre)
    const risee = e.risee ?? 0;
    this.niveaux.risee = risee;
    this.vers(this.risee.gain.gain, 0.2 * risee ** 1.5 * (1 - 0.6 * lisse(28, 40, vent)), 0.6);
    this.vers(this.risee.filtre.frequency, 1500 + 900 * risee, 0.6);
    // le feu de Saint-Elme : un grésillement en tête de mât (on ne l'entend bien que si l'on
    // y prête l'oreille)
    const elme = e.saintElme ?? 0;
    this.niveaux.saintElme = elme;
    this.vers(this.saintElme.gain.gain, 0.1 * elme, 0.4);
    if (elme > 0) this.saintElme.hache.gain.setTargetAtTime(0.2 + 0.8 * Math.random() ** 3, t, 0.012);
    // le gréement : il siffle quand ça forcit, il hurle au plus fort
    this.boucle('greement', 0.45 * lisse(14, 28, vent) * (1 - 0.4 * lisse(32, 42, vent)), 0.5, 0.82 + 0.008 * vent);
    this.boucle('greement-aigu', 0.4 * lisse(27, 42, vent), 0.5, 0.9 + 0.005 * vent);
    this.sifflement.forEach((s, i) => {
      const force = Math.max(0, (vent - 16 - i * 6) / 30);
      this.vers(s.gain.gain, 0.05 * force * force * (0.6 + 0.4 * Math.sin(t * (0.7 + i * 0.4))) * calcul('greement', 0.25));
      this.vers(s.filtre.frequency, 1200 + i * 650 + vent * 18 + 120 * Math.sin(t * 0.9 + i));
    });
    // la mer : par beau temps, le cockpit enregistré au large (l'eau, les écoutes, la brise) ;
    // les voiles pleines ; par gros temps, la mer qui déferle tout autour
    const beau = 1 - lisse(14, 24, vent);
    this.boucle('cockpit-jour', 0.32 * beau * lisse(1, 4, e.vitesse + vent * 0.3), 0.8);
    this.boucle('sous-voiles', 0.22 * (e.voiles ?? 1) * lisse(5, 14, vent) * (1 - lisse(26, 36, vent)), 0.8);
    this.boucle('mer-forte', 0.7 * lisse(1.6, 4.5, hs), 1);
    const fe = Math.min(1, e.vitesse / 8);
    this.vers(this.eau.gain.gain, (0.03 + 0.4 * fe * fe) * calcul('cockpit-jour', 0.7));
    this.vers(this.eau.filtre.frequency, 300 + 1500 * fe);
    const vague = 0.5 + 0.5 * Math.sin(t * 0.42) * Math.sin(t * 0.13 + 1);
    this.vers(this.ressac.gain.gain, (0.05 + Math.min(0.25, hs * 0.05)) * (0.5 + 0.5 * vague) * calcul('mer-forte', 0.5), 0.6);
    // les voiles qui battent
    const bat = e.faseyement * lisse(4, 18, vent);
    this.boucle('voile-bat', 0.5 * bat, 0.12, 0.75 + vent / 60);
    this.vers(this.faseyement.gain.gain, 1.3 * e.faseyement * Math.min(1, vent / 15) ** 2 * calcul('voile-bat', 0.25), 0.1);
    this.faseyement.lfo.frequency.setTargetAtTime(4 + vent * 0.25, t, 0.3);
    // la pluie, sur le pont et sur les cirés
    this.boucle('pluie-pont', 0.75 * e.pluie, 0.8);
    this.vers(this.pluie.gain.gain, 0.35 * e.pluie * calcul('pluie-pont', 0.3), 0.8);
    // l'averse d'un grain qui arrive : elle gronde sur la mer avant de tomber sur nous
    // (quand elle est là, c'est la pluie sur le pont qu'on entend)
    const averse = Math.max(0, (e.averse ?? 0) - 0.7 * e.pluie);
    this.niveaux.averse = averse;
    const b = this.boucles['averse-pluie-pont'];
    if (b) {
      this.vers(b.gain.gain, 0.95 * averse ** 1.3, 0.8);
      this.vers(b.filtre.frequency, 900 + 3200 * averse * averse, 0.8);
    }

    // ----- dedans (la timonerie) -----
    // (une pièce vitrée, au-dessus de l'eau : la mer à travers la coque n'y est plus qu'un
    // murmure ; la pluie tambourine sur le toit, juste au-dessus ; le vent siffle aux joints)
    const d = this.dedans ? 1 : 0;
    this.boucle('cabine-mer', d * (0.05 + 0.1 * lisse(1, 4.5, hs)), 0.6);
    this.boucle('coque', d * 0.14 * lisse(1, 7, e.vitesse), 0.6);
    this.boucle('pluie-toit', d * 0.26 * e.pluie, 0.8);
    this.boucle('vent-dedans', d * 0.22 * lisse(16, 34, vent), 0.6);

    // ----- à bord -----
    // le vent qui hurle, la nuit, au plus fort (plus fort dans la cabine, par les ouvertures)
    this.boucle('hurlement', (this.dedans ? 0.2 : 0.22) * lisse(26, 42, vent) * (0.4 + 0.6 * (e.nuit ?? 0)), 1.2);
    // le moteur du pilote, quand il pousse la barre
    this.boucle('pilote', 0.32 * Math.min(1, e.pilote ?? 0), 0.08);
    // le moteur du bord (0 : arrêté → 1 : à son régime ; il se lance et s'arrête en douceur) ;
    // quand il tourne, il couvre le monde du dehors : on n'entend plus venir les vagues
    const regime = e.regimeMoteur ?? 0;
    this.niveaux.moteur = regime;
    if (Math.abs(regime - this.diesel.regime) > 0.002) {
      this.diesel.regime = regime;
      const [explosions, cycle, hacheur, coque] = this.diesel.oscillateurs;
      const f = 0.25 + 0.75 * regime;
      explosions.frequency.setTargetAtTime(60 * f, t, 0.3);
      hacheur.frequency.setTargetAtTime(60 * f, t, 0.3);
      cycle.frequency.setTargetAtTime(15 * f, t, 0.3);
      coque.frequency.setTargetAtTime(30 * f, t, 0.3);
    }
    this.vers(this.diesel.gain.gain, 0.42 * regime * (this.dedans ? 1 : 0.8), 0.4);
    this.vers(this.masque.gain, 1 - 0.55 * regime, 0.6);
    this.vers(this.masqueSignes.gain, 1 - 0.3 * regime, 0.6);
    this.vers(this.masqueDedans.gain, 1 - 0.5 * regime, 0.6);
    this.vers(this.masqueBord.gain, 1 - 0.5 * regime, 0.6);
    this.vers(this.pompeElectrique.gain.gain, e.pompeElectrique ? 0.08 : 0, 0.15);
    this.vers(this.moteursVolets.gain.gain, e.voletsBougent ? 0.07 : 0, 0.08);
    // les alarmes du bord (elles sonnent tant qu'il y a de quoi)
    for (const nom of e.alarmes ?? []) this.sonnerAlarme(nom, t);
    // l'eau embarquée : elle clapote d'autant plus que le bateau roule
    const cale = Math.min(1, (e.eauCale ?? 0) / 900);
    const roule = Math.min(1, Math.abs(e.roulis ?? 0) / 0.4);
    this.vers(this.clapotis.gain.gain, cale * (0.12 + 0.5 * roule), 0.15);
    this.vers(this.gargouille.gain.gain, Math.min(0.22, (e.eauCockpit ?? 0) / 900) * (e.dalotsBouches ? 0.08 : 1), 0.4);
    // la trombe et le cargo, selon leur distance (0 : loin, 1 : sur nous) : la trombe
    // gronde de loin, de plus en plus aigu en approchant, puis hurle
    const tr = e.trombe ?? 0;
    const grondement = this.boucles['trombe-vent-rafales'];
    const fracas = this.boucles['trombe-mer-forte'];
    if (grondement) {
      this.niveaux.trombe = 1.2 * tr ** 1.4;
      this.vers(grondement.gain.gain, 1.2 * tr ** 1.4, 0.6);
      this.vers(grondement.filtre.frequency, 260 + 3200 * tr * tr, 0.6);
    }
    if (fracas) {
      this.vers(fracas.gain.gain, 0.9 * tr ** 3, 0.6);
      this.vers(fracas.filtre.frequency, 600 + 5000 * tr * tr, 0.6);
    }
    this.vers(this.trombe.gain.gain, 0.9 * tr * tr * (grondement ? 0.5 : 1), 0.5);
    this.vers(this.trombe.gainSifflement.gain, 0.12 * tr * tr * tr, 0.5);
    this.vers(this.moteur.gain.gain, 0.5 * (e.cargo ?? 0) ** 2, 0.8);
    // la tension de la nuit (quart/peur.js) : le bourdonnement, et le sifflement aigu
    // quand elle est très haute
    const tension = e.tension ?? 0;
    this.vers(this.angoisse.gain.gain, 0.16 * lisse(0.3, 1, tension) ** 1.5, 2);
    this.vers(this.angoisse.aigu.gain, 0.0035 * lisse(0.72, 1, tension), 3);
    // la vague scélérate (0 : loin → 1 : sur nous ; deferle : sa crête s'écroule) : le
    // grondement monte et s'éclaircit, la pulsation enfle, puis la crête rugit
    const sc = e.scelerate ?? 0;
    const df = e.deferle ?? 0;
    this.niveaux.scelerate = sc;
    this.vers(this.scelerate.gain.gain, 1.4 * sc ** 1.5, 0.9);
    if (e.ouScelerate) placer(this.scelerate.cote, e.ouScelerate);
    if (e.ouTrombe) placer(this.trombe.cote, e.ouTrombe);
    this.vers(this.scelerate.filtre.frequency, 90 + 650 * sc * sc, 0.9);
    this.vers(this.scelerate.pulsation.gain, 0.22 * Math.min(1, sc * 1.6), 1.5);
    const rugit = this.boucles['scelerate-mer-forte'];
    if (rugit) {
      this.vers(rugit.gain.gain, 1.6 * df * sc ** 2, 0.5);
      this.vers(rugit.filtre.frequency, 280 + 2600 * df * sc * sc, 0.5);
    }
    // le bois et les cordages travaillent : d'autant plus que le bateau est secoué et que
    // le vent forcit (un craquement de temps en temps par beau temps, sans cesse dans la tempête)
    this.ageCraquement += dt;
    const secoue = Math.min(1, e.mouvement ?? roule);
    const parSeconde = 0.04 + 0.3 * secoue * secoue + 0.1 * lisse(25, 45, vent);
    if (this.ageCraquement > 0.8 && Math.random() < parSeconde * dt) {
      this.ageCraquement = 0;
      this.craquement(0.2 + 0.55 * Math.max(secoue, lisse(25, 42, vent) * Math.random()), true);
    }
    // le winch : un cliquetis par cran du rochet
    if (e.bordage > 0.01) {
      this.ageWinch += dt * e.bordage * 22;
      while (this.ageWinch > 1) {
        this.ageWinch -= 1;
        this.clic();
      }
    }
  }

  // Joue un morceau d'une planche enregistrée. Renvoie false si elle n'est pas chargée.
  // o : { index, gain, vitesse (hauteur), pan (-1 → 1) ou ou (un point du bateau : d'où il vient ;
  // pres : tout près, à bord), bus, dans (secondes), duree, grave (Hz : filtre) }
  jouer(nom, o = {}) {
    const tampon = this.sonotheque?.tampon(nom);
    const infos = this.sonotheque?.infos(nom);
    if (!tampon || !this.actif()) return false;
    const ctx = this.ctx;
    const k = o.index ?? Math.floor(Math.random() * infos.morceaux.length);
    const [debut, longueur] = infos.morceaux[k];
    const duree = Math.min(longueur, o.duree ?? longueur);
    const s = ctx.createBufferSource();
    s.buffer = tampon;
    s.playbackRate.value = o.vitesse ?? 1;
    const g = ctx.createGain();
    const quand = ctx.currentTime + (o.dans ?? 0);
    g.gain.value = o.gain ?? 1;
    // (coupé avant sa fin : on l'éteint en douceur)
    if (duree < longueur) g.gain.setTargetAtTime(0, quand + (duree * 0.75) / (o.vitesse ?? 1), duree * 0.12);
    let sortie = s;
    if (o.grave) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.grave;
      sortie = sortie.connect(f);
    }
    sortie = sortie.connect(g);
    sortie.connect(this.versOu(o.ou ?? o.pan ?? null, o.bus ?? 'bord', { pres: !!o.pres }));
    s.start(quand, Math.max(0, debut - 0.02), duree + 0.08);
    return true;
  }

  // Un craquement du bois ou d'un cordage (force 0 → 1) : plus grave quand c'est fort (la
  // coque, le mât), plus aigu pour un petit grincement ; d'un côté ou de l'autre
  // (fond : la coque qui travaille sans cesse, plus bas — elle se tait dans les creux, et le
  // moteur la couvre ; sinon, celle qui craque sous un coup)
  craquement(force = 0.5, fond = false) {
    // (quelque part dans la timonerie : une paroi, le plafond, le plancher)
    const ou = this.lieux ? { x: (Math.random() * 2 - 1) * 1.3, y: 1 + 2.1 * Math.random(), z: 0.9 + 2.9 * Math.random() } : (Math.random() * 2 - 1) * 0.8;
    this.jouer('craquements', {
      gain: fond ? 0.1 + 0.4 * force : 0.25 + 0.75 * force,
      vitesse: 1.05 - 0.5 * force * Math.random() - 0.1 * Math.random(),
      ou, pres: true,
      bus: fond ? 'fondBord' : 'bord',
    });
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
    s.connect(f).connect(g).connect(this.bus.bord);
    s.start(t, Math.random() * 2, 0.05);
  }

  // l'étrave tape dans une vague : une gerbe d'eau (force 0 → 1)
  claque(force) {
    if (!this.actif()) return;
    // (une vague enregistrée qui frappe, coupée court : les petites claques sont les
    // coups de pagaie dans le clapot, les grosses les vagues sur la digue)
    const enregistree = this.jouer('vagues', {
      index: force > 0.5 ? Math.floor(Math.random() * 5) : 9 + Math.floor(Math.random() * 2),
      gain: 0.35 + 0.8 * force,
      duree: 0.9 + force * 1.4,
      vitesse: 0.9 + Math.random() * 0.2,
      ou: this.lieux?.etrave ?? (Math.random() - 0.5) * 0.6,
      bus: 'dehors',
    });
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.rose;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900 + Math.random() * 500;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    const v = Math.min(1.4, 0.3 + force * 1.2) * (enregistree ? 0.35 : 1);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.002, t + 0.6 + force * 0.6);
    s.connect(f).connect(g).connect(this.versOu(this.lieux?.etrave ?? null, 'dehors'));
    s.start(t, Math.random() * 3, 1.4);
  }

  // le tonnerre : le craquement puis le grondement. Le jeu l'appelle quand son bruit arrive
  // jusqu'à nous (monde/foudre.js : 3 s par kilomètre, depuis là où l'éclair est passé au
  // plus près) ; il roule d'autant plus longtemps que le trait est long ; tout près, il
  // claque ; de loin, il n'en reste que les graves. o : { distance (m), duree (s : combien
  // de temps il roule), force (0 → 1), pan (−1 : à gauche → 1 : à droite) ou ou (d'où il vient :
  // un point du bateau, là-haut, loin), claque }
  tonnerre({ distance, duree = 8, force = 1, pan = 0, ou = null, claque = false }) {
    if (!this.actif()) return;
    const proche = Math.max(0, 1 - distance / 9000);
    // tout près : un claquement sec (morceau 0) ; à quelques kilomètres, un coup puis un
    // roulement (1-3) ; loin : un long roulement (4-5)
    const index = claque && distance < 900 ? 0 : distance < 2300 ? 1 + Math.floor(Math.random() * 2) : distance < 5000 ? 2 + Math.floor(Math.random() * 2) : 4 + Math.floor(Math.random() * 2);
    if (this.jouer('tonnerres', {
      index, bus: 'signes',
      gain: Math.min(1.3, (0.3 + 0.9 * proche) * force),
      grave: 400 + 9000 * proche * proche,
      vitesse: 0.85 + 0.2 * Math.random(),
      ou: ou ?? pan,
      duree: index === 0 ? undefined : Math.max(5, duree * 1.3 + 2),
    })) return;
    // (pas encore d'enregistrement : le tonnerre calculé)
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.brun;
    s.loop = true;
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
    s.connect(f).connect(g).connect(this.versOu(ou ?? pan, 'signes'));
    s.start(t, Math.random() * 2);
    s.stop(t + 9);
  }

  // La foudre tombe tout près (pres : 0 → 1 ; 1 : sur le mât) : en même temps que l'éclair,
  // un claquement sec, énorme, qui déchire tout (dans la cabine, la coque l'étouffe un peu),
  // et le souffle grave qui suit
  claquementFoudre(pres = 1, dedans = false) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const sortie = ctx.createGain();
    sortie.gain.value = (0.5 + 0.9 * pres) * (dedans ? 0.6 : 1);
    sortie.connect(this.compresseur);
    // le claquement : un bruit blanc très court, aigu
    const s = ctx.createBufferSource();
    s.buffer = this.blanc;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = dedans ? 600 : 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    s.connect(f).connect(g).connect(sortie);
    s.start(t, Math.random() * 2, 0.6);
    // le souffle : un coup grave qui fait vibrer la coque
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.8);
    const go = ctx.createGain();
    go.gain.setValueAtTime(0, t);
    go.gain.linearRampToValueAtTime(0.9 * pres, t + 0.01);
    go.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    o.connect(go).connect(sortie);
    o.start(t);
    o.stop(t + 1.3);
    // et le tonnerre, aussitôt : il roule au-dessus de nous
    this.jouer('tonnerres', { index: 0, gain: 1.2 * (0.6 + 0.4 * pres), bus: 'signes', vitesse: 0.9 + 0.1 * Math.random() });
  }

  // Après un coup de tonnerre tout près, les oreilles sifflent un moment (force 0 → 1)
  acouphene(duree = 6, force = 1) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 5400 + Math.random() * 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.035 * force, t + 0.15);
    g.gain.setTargetAtTime(0, t + duree * 0.3, duree * 0.3);
    o.connect(g).connect(this.sortie);
    o.start(t);
    o.stop(t + duree * 1.6);
  }

  // Un éclair, même lointain, claque dans la radio : un « crac » de parasites (un, deux ou
  // trois petits coups), plus fort s'il est près (force 0 → 1)
  parasiteEclair(force = 0.5) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (0.025 + Math.random() * 0.07);
      const d = 0.03 + Math.random() * 0.12;
      const s = ctx.createBufferSource();
      s.buffer = this.blanc;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1500 + Math.random() * 2000;
      f.Q.value = 0.9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime((0.05 + 0.25 * force) * (i === 0 ? 1 : 0.55), t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      s.connect(f).connect(g).connect(this.bus.radio);
      s.start(t, Math.random() * 2, d + 0.02);
    }
  }

  // Dans la timonerie : la tempête arrive étouffée par les vitres et les parois — moins quand la
  // porte est ouverte (porte : 0 → 1), davantage derrière les volets fermés (volets : combien de
  // côtés, 0 → 4) ; ce qui est à bord résonne dans la petite pièce en bois. Les signes (le
  // grondement des vagues, la scélérate, le tonnerre) passent mieux : ce sont des graves.
  dansLaCabine(dedans, { porte = 0, volets = 0 } = {}) {
    if (!this.actif()) return;
    this.dedans = dedans;
    const ferme = Math.min(1, volets / 4);
    const coupure = (1500 + 3500 * porte) * (1 - 0.35 * ferme);
    this.vers(this.filtreCabine.frequency, dedans ? coupure : 18000, 0.35);
    this.vers(this.bus.dehors.gain, dedans ? (0.3 + 0.25 * porte) * (1 - 0.3 * ferme) : 1, 0.35);
    this.vers(this.filtreSignes.frequency, dedans ? 1100 + 2500 * porte : 18000, 0.35);
    this.vers(this.vitresSignes.gain, dedans ? (0.8 + 0.2 * porte) * (1 - 0.15 * ferme) : 1, 0.35);
    this.vers(this.bus.dedans.gain, dedans ? 1 : 0, 0.35);
    this.vers(this.envoiBord.gain, dedans ? 0.45 : 0.05, 0.35);
  }

  // le grésillement de la radio (quand on appuie sur l'alternat, ou à la fin d'un message)
  gresillement() {
    if (!this.actif()) return;
    if (this.jouer('radio', { index: Math.floor(Math.random() * 2), gain: 0.5, duree: 0.45, bus: 'radio' })) return;
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
    s.connect(f).connect(g).connect(this.bus.radio);
    s.start(t, Math.random(), 0.4);
  }

  // des parasites sur la radio (une transmission qui se brouille)
  parasites(duree = 2, force = 0.6) {
    if (!this.actif()) return;
    this.jouer('radio', { index: 2 + Math.floor(Math.random() * 2), gain: force, duree, bus: 'radio' });
  }

  // ----- l'étrange -----
  // Une voix sur la radio, trop faible et trop brouillée pour la comprendre : un
  // bourdonnement de cordes vocales (une dent de scie qui tremble), passé dans deux
  // « formants » qui changent à chaque syllabe (les voyelles), haché en syllabes, rogné
  // comme par un poste de radio, et noyé dans les parasites. duree : en secondes
  voixFantome(duree = 6.5) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.1;
    const fin = t0 + duree;
    const voix = ctx.createOscillator();
    voix.type = 'sawtooth';
    voix.frequency.setValueAtTime(118, t0);
    const syllabes = ctx.createGain();
    syllabes.gain.value = 0;
    const f1 = ctx.createBiquadFilter();
    const f2 = ctx.createBiquadFilter();
    for (const f of [f1, f2]) { f.type = 'bandpass'; f.Q.value = 7; }
    let t = t0;
    while (t < fin - 0.2) {
      // une syllabe : une voyelle (deux formants), une hauteur, un souffle ; parfois un trou
      const d = 0.13 + Math.random() * 0.2;
      const [a, b] = [[700, 1200], [400, 2000], [300, 900], [550, 1700], [350, 2300]][Math.floor(Math.random() * 5)];
      f1.frequency.setTargetAtTime(a, t, 0.02);
      f2.frequency.setTargetAtTime(b, t, 0.02);
      voix.frequency.setTargetAtTime(105 + Math.random() * 30, t, 0.05);
      const fort = Math.random() < 0.15 ? 0 : 0.5 + Math.random() * 0.5;
      syllabes.gain.setTargetAtTime(fort, t, 0.015);
      syllabes.gain.setTargetAtTime(0, t + d * 0.8, 0.03);
      t += d + (Math.random() < 0.2 ? 0.3 + Math.random() * 0.4 : 0.03);
    }
    const poste = ctx.createBiquadFilter();
    poste.type = 'bandpass';
    poste.frequency.value = 1300;
    poste.Q.value = 0.9;
    const sature = ctx.createWaveShaper();
    const courbe = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = (i / 255) * 2 - 1; courbe[i] = Math.tanh(x * 3); }
    sature.curve = courbe;
    const niveau = ctx.createGain();
    niveau.gain.setValueAtTime(0, t0);
    niveau.gain.linearRampToValueAtTime(0.16, t0 + 0.8);
    niveau.gain.setValueAtTime(0.16, fin - 1);
    niveau.gain.linearRampToValueAtTime(0, fin);
    // (la voix va et vient, comme un émetteur trop loin)
    const evanouit = ctx.createGain();
    for (let k = 0; t0 + k * 0.4 < fin; k++) evanouit.gain.setTargetAtTime(Math.random() < 0.25 ? 0.15 : 1, t0 + k * 0.4, 0.08);
    voix.connect(f1);
    voix.connect(f2);
    f1.connect(syllabes);
    f2.connect(syllabes);
    syllabes.connect(sature).connect(poste).connect(evanouit).connect(niveau).connect(this.bus.radio);
    voix.start(t0);
    voix.stop(fin + 0.1);
    this.parasites(duree + 0.6, 0.55);
  }

  // Des coups contre la coque, à l'avant, sous la flottaison : trois, puis un quatrième,
  // plus faible. (Un tronc ? Une épave ? On ne saura pas.)
  // (ou : d'où ils viennent — de derrière la porte de la cabine avant ; dans : dans combien de
  // secondes ils commencent — le jeu fait d'abord le silence)
  coupsCoque(ou = -0.15, dans = 0.2) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + dans;
    const p = this.versOu(ou, 'dedans', { pres: true });
    [[0, 1], [0.72, 0.95], [1.4, 1.05], [5.2, 0.45]].forEach(([dans, force]) => {
      const t = t0 + dans;
      // le choc sourd du bois et du polyester : un coup bref qui fait résonner la coque
      const s = ctx.createBufferSource();
      s.buffer = this.brun;
      const passe = ctx.createBiquadFilter();
      passe.type = 'lowpass';
      passe.frequency.value = 260;
      const coque = ctx.createBiquadFilter();
      coque.type = 'peaking';
      coque.frequency.value = 85;
      coque.Q.value = 6;
      coque.gain.value = 14;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1.6 * force, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      s.connect(passe).connect(coque).connect(g).connect(p);
      s.start(t, Math.random() * 2, 0.5);
      // et le petit claquement du contact
      const c = ctx.createBufferSource();
      c.buffer = this.blanc;
      const fc = ctx.createBiquadFilter();
      fc.type = 'bandpass';
      fc.frequency.value = 900;
      fc.Q.value = 2;
      const gc = ctx.createGain();
      gc.gain.setValueAtTime(0, t);
      gc.gain.linearRampToValueAtTime(0.25 * force, t + 0.002);
      gc.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      c.connect(fc).connect(gc).connect(p);
      c.start(t, Math.random(), 0.08);
    });
  }

  // Le cœur qui bat (force 0 → 1 : de plus en plus vite et fort quand le danger monte) ;
  // appelé à chaque battement
  battement(force = 0.5) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    for (const [dans, f] of [[0, 1], [0.24 - 0.06 * force, 0.7]]) {
      const t = t0 + dans;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(62, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.55 * f * (0.4 + 0.6 * force), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g).connect(this.bus.tete);
      o.start(t);
      o.stop(t + 0.22);
    }
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
    s.connect(f).connect(g).connect(this.aLieu('pompe', 'bord'));
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
    o.connect(g).connect(this.bus.bord);
    o.start(t);
    o.stop(t + 0.5);
    // (et la coque craque sous le coup)
    if (force > 0.4) this.craquement(Math.min(1, force));
  }

  // Une déferlante : on l'entend arriver (un grondement qui enfle pendant « dans »
  // secondes), puis elle s'écrase sur le bateau (fracas enregistré, et un coup sourd dans
  // la coque)
  // (pan : -1 → 1, d'où elle vient : on l'entend arriver de son côté)
  // (entendue : à combien de secondes du choc on commence à l'entendre — tout de suite, ou
  // plus tard quand le moteur la couvre : quart/nuit.js, ENTENDRE)
  // (ou : d'où elle vient — un panoramique, ou un point du bateau, loin, du côté de la vague ;
  // arrivee : là où elle frappe — son grondement y glisse, à mesure qu'elle approche)
  deferlante(force = 0.5, dans = 3.5, ou = 0, entendue = dans, arrivee = null) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const impact = t + dans;
    const debut = impact - Math.max(0.05, Math.min(dans, entendue));
    const v = 0.35 + 0.7 * force;
    const cote = this.versOu(ou, 'signes');
    if (estUnPoint(ou) && arrivee && cote.positionX) {
      for (const [param, a, b] of [[cote.positionX, ou.x, arrivee.x], [cote.positionY, ou.y, arrivee.y], [cote.positionZ, ou.z, arrivee.z]]) {
        param.setValueAtTime(a, t);
        param.linearRampToValueAtTime(b, impact);
      }
    }
    // le grondement : du bruit grave qui naît d'un coup (on l'entend tout de suite, de son côté),
    // puis enfle et s'éclaircit en approchant
    const g1 = ctx.createBufferSource();
    g1.buffer = this.brun;
    // (le bruit ne dure que 4 s : il boucle — les plus grosses grondent 6 s)
    g1.loop = true;
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.Q.value = 0.6;
    f1.frequency.setValueAtTime(180, debut);
    f1.frequency.exponentialRampToValueAtTime(700, impact);
    const a1 = ctx.createGain();
    a1.gain.setValueAtTime(0.0001, t);
    a1.gain.setValueAtTime(0.0001, debut);
    a1.gain.linearRampToValueAtTime(v * 0.5, debut + Math.min(0.5, (impact - debut) / 3));
    a1.gain.exponentialRampToValueAtTime(v * 0.9, impact);
    a1.gain.setTargetAtTime(0.0001, impact + 0.1, 0.5);
    g1.connect(f1).connect(a1).connect(cote);
    g1.start(t, Math.random() * 2);
    g1.stop(impact + 3);
    // le fracas : une vague de falaise enregistrée (morceaux 5 à 8), ou le souffle calculé
    const enregistre = this.jouer('vagues', {
      index: 5 + Math.floor(Math.random() * 4), dans: Math.max(0, dans - 0.15), gain: 0.6 + 0.8 * force, bus: 'dehors',
      vitesse: 0.85 + 0.15 * Math.random(), ou: estUnPoint(ou) ? (arrivee ?? ou) : ou * 0.8,
    });
    if (!enregistre) {
      const g2 = ctx.createBufferSource();
      g2.buffer = this.rose;
      g2.loop = true;
      const f2 = ctx.createBiquadFilter();
      f2.type = 'lowpass';
      f2.frequency.setValueAtTime(5000, impact);
      f2.frequency.exponentialRampToValueAtTime(600, impact + 2.5);
      const a2 = ctx.createGain();
      a2.gain.setValueAtTime(0.0001, impact - 0.05);
      a2.gain.linearRampToValueAtTime(v * 1.3, impact + 0.04);
      a2.gain.setTargetAtTime(0.0001, impact + 0.3, 0.7);
      g2.connect(f2).connect(a2).connect(cote);
      g2.start(impact - 0.05, Math.random() * 2);
      g2.stop(impact + 4);
    }
    // le coup dans la coque
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(90, impact);
    o.frequency.exponentialRampToValueAtTime(38, impact + 0.35);
    const a3 = ctx.createGain();
    a3.gain.setValueAtTime(0.0001, impact);
    a3.gain.linearRampToValueAtTime(v, impact + 0.01);
    a3.gain.exponentialRampToValueAtTime(0.001, impact + 0.5);
    o.connect(a3).connect(this.bus.bord);
    o.start(impact);
    o.stop(impact + 0.6);
    // (et toute la coque gémit sous le choc)
    for (let k = 0; k < 2; k++) {
      this.jouer('craquements', { dans: dans + 0.1 + k * 0.35, gain: 0.5 + 0.5 * force, vitesse: 0.5 + 0.2 * Math.random(), pan: (Math.random() - 0.5) * 1.2 });
    }
  }

  // ---------- Les sons des systèmes du bord ----------
  // Une alarme, à son rythme : la cale (un vibreur grave et insistant), la batterie (trois
  // bips aigus toutes les six secondes), le pilote (deux notes, toutes les deux secondes), le
  // moteur (une sirène continue, qui ondule)
  sonnerAlarme(nom, t) {
    const R = { cale: 1.0, batterie: 6, pilote: 2, moteur: 0.9 }[nom];
    if (!R) return;
    const dernier = this.alarmesBord[nom] ?? -Infinity;
    if (t - dernier < R) return;
    this.alarmesBord[nom] = t;
    const ctx = this.ctx;
    const bip = (frequence, debut, duree, niveau, type = 'square') => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = frequence;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, debut);
      g.gain.linearRampToValueAtTime(niveau, debut + 0.01);
      g.gain.setValueAtTime(niveau, debut + duree - 0.02);
      g.gain.linearRampToValueAtTime(0.0001, debut + duree);
      o.connect(g).connect(this.aLieu('console', 'bord'));
      o.start(debut);
      o.stop(debut + duree + 0.05);
      return o;
    };
    if (nom === 'cale') bip(420, t, 0.45, 0.05);
    else if (nom === 'batterie') for (let k = 0; k < 3; k++) bip(3200, t + k * 0.16, 0.08, 0.025, 'sine');
    else if (nom === 'pilote') {
      bip(1800, t, 0.12, 0.03, 'sine');
      bip(2400, t + 0.18, 0.12, 0.03, 'sine');
    } else if (nom === 'moteur') {
      const o = bip(2700, t, 0.85, 0.022, 'triangle');
      o.frequency.setValueAtTime(2500, t);
      o.frequency.linearRampToValueAtTime(3000, t + 0.42);
      o.frequency.linearRampToValueAtTime(2500, t + 0.85);
    }
  }

  // Le démarreur lance le diesel (2,5 s : rrr-rrr-rrr), puis il prend
  demarreur(duree = 2.5) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t);
    o.frequency.linearRampToValueAtTime(150, t + duree);
    const hache = ctx.createGain();
    hache.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 7;
    const p = ctx.createGain();
    p.gain.value = 0.5;
    lfo.connect(p).connect(hache.gain);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.08);
    g.gain.setValueAtTime(0.22, t + duree - 0.1);
    g.gain.linearRampToValueAtTime(0.0001, t + duree);
    o.connect(hache).connect(f).connect(g).connect(this.aLieu('moteur', 'bord'));
    o.start(t);
    lfo.start(t);
    o.stop(t + duree + 0.1);
    lfo.stop(t + duree + 0.1);
  }

  // Le démarreur tourne, mais trop lentement : il n'y a plus assez de courant
  demarreurFaible() {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    for (let k = 0; k < 3; k++) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(70 - k * 8, t + k * 0.5);
      o.frequency.linearRampToValueAtTime(40 - k * 8, t + k * 0.5 + 0.35);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + k * 0.5);
      g.gain.linearRampToValueAtTime(0.14, t + k * 0.5 + 0.03);
      g.gain.linearRampToValueAtTime(0.0001, t + k * 0.5 + 0.38);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 500;
      o.connect(f).connect(g).connect(this.aLieu('moteur', 'bord'));
      o.start(t + k * 0.5);
      o.stop(t + k * 0.5 + 0.45);
    }
  }

  // Une vitre se fend (un claquement sec, aigu) ; pan : -1 à gauche → 1 à droite
  // (ou : la vitre — un point du bateau, ou un panoramique)
  vitreFendue(ou = 0) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.blanc;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    const pn = this.versOu(ou, 'bord', { pres: true });
    n.connect(f).connect(g).connect(pn);
    n.start(t, Math.random());
    n.stop(t + 0.2);
    // (et le verre qui chante un instant)
    const o = ctx.createOscillator();
    o.frequency.value = 3400 + Math.random() * 900;
    const go = ctx.createGain();
    go.gain.setValueAtTime(0.0001, t);
    go.gain.linearRampToValueAtTime(0.03, t + 0.005);
    go.gain.exponentialRampToValueAtTime(0.0005, t + 0.5);
    o.connect(go).connect(pn);
    o.start(t);
    o.stop(t + 0.55);
  }

  // Une vitre éclate : le fracas, puis les éclats qui tombent et tintent
  vitreBrisee(ou = 0) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const pn = this.versOu(ou, 'bord', { pres: true });
    const n = ctx.createBufferSource();
    n.buffer = this.blanc;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.setValueAtTime(1200, t);
    f.frequency.exponentialRampToValueAtTime(4000, t + 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.9, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    n.connect(f).connect(g).connect(pn);
    n.start(t, Math.random());
    n.stop(t + 1);
    for (let k = 0; k < 26; k++) {
      const d = t + 0.05 + Math.random() * Math.random() * 1.6;
      const o = ctx.createOscillator();
      o.frequency.value = 2600 + Math.random() * 3800;
      const go = ctx.createGain();
      go.gain.setValueAtTime(0.0001, d);
      go.gain.linearRampToValueAtTime(0.02 + 0.03 * Math.random(), d + 0.003);
      go.gain.exponentialRampToValueAtTime(0.0005, d + 0.08 + Math.random() * 0.15);
      o.connect(go).connect(pn);
      o.start(d);
      o.stop(d + 0.3);
    }
    this.choc(0.5);
  }

  // Le courant meurt : tout ce qui ronronnait à bord descend et se tait (et un claquement :
  // le dernier relais)
  coupure() {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(24, t + 1.6);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.7);
    o.connect(f).connect(g).connect(this.bus.bord);
    o.start(t);
    o.stop(t + 1.8);
    this.clic();
  }

  // Le bruit du monde se retire (le vent, la mer, la pluie) : profondeur 0 → 1, pendant
  // « duree » secondes, puis il revient (en « retour » secondes). (Avant un choc, dans le creux
  // d'une vague : un silence qu'on n'attendait pas.)
  // Le monde se tait un instant (avant un coup : on l'entend d'autant mieux) : le fond du dehors,
  // la pluie et le vent de la timonerie, le hurlement des ouvertures, la coque qui travaille —
  // pas les signes, ni ce qui sonne à bord. (Un creux moins profond ne coupe pas celui qui est
  // en cours.)
  etouffer(duree = 2, profondeur = 0.75, retour = 1.8) {
    if (!this.actif()) return;
    const t = this.ctx.currentTime;
    const e = this.etouffement;
    if (e && t < e.fin && profondeur <= e.profondeur) return;
    this.etouffement = { fin: t + duree + retour, profondeur };
    for (const n of [this.etouffe, this.etouffeDedans, this.etouffeBord]) {
      const g = n.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(1 - profondeur, t + 0.35);
      g.setValueAtTime(1 - profondeur, t + Math.max(0.35, duree));
      g.linearRampToValueAtTime(1, t + Math.max(0.35, duree) + retour);
    }
  }

  // On commence à entendre une déferlante (quart/nuit.js : 'deferlante-entendue' ; entendue : à
  // combien de secondes du choc) : devant les plus grosses, le fond se retire jusqu'au choc — on
  // n'entend plus qu'elle, qui gronde de son côté — et revient avec le fracas
  grondementEntendu(force, entendue) {
    if (force >= 0.85) this.etouffer(entendue - 0.45, 0.6, 0.4);
  }

  // Le vent respire : de temps en temps, un long creux, où la tempête se retire un moment (les
  // rafales tombent) avant de revenir. Plus souvent au début de la nuit qu'au plus fort.
  // heure : 24 (minuit) → 30 (six heures)
  respirer(dt, heure = 26) {
    const t = this.ctx.currentTime;
    const c = this.creux;
    if (t < c.prochain) return;
    const avance = Math.min(1, Math.max(0, (heure - 24) / 6));
    const duree = (6 + 5 * Math.random()) * (1 - 0.35 * avance);
    const profondeur = 0.45 + 0.2 * Math.random();
    for (const n of [this.respire, this.respireDedans, this.respireBord]) {
      const g = n.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(1 - profondeur, t + 2.2);
      g.setValueAtTime(1 - profondeur, t + 2.2 + duree);
      g.linearRampToValueAtTime(1, t + 4.9 + duree);
    }
    c.fin = t + 4.9 + duree;
    c.prochain = c.fin + (30 + 45 * Math.random()) * (1 + 0.6 * avance);
  }

  // ---------- La peur (quart/peur.js) ----------
  // La mer gémit : une voix immense et grave, au loin, qui monte puis retombe, noyée dans
  // un long écho (pan : de quel côté, −1 → 1)
  gemissement(ou = 0) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.05;
    const duree = 7.5 + Math.random() * 2;
    const sortie = ctx.createGain();
    sortie.gain.setValueAtTime(0, t0);
    sortie.gain.linearRampToValueAtTime(0.55, t0 + 2.4);
    sortie.gain.setValueAtTime(0.55, t0 + duree - 3);
    sortie.gain.linearRampToValueAtTime(0, t0 + duree);
    const passe = ctx.createBiquadFilter();
    passe.type = 'lowpass';
    passe.frequency.value = 900;
    sortie.connect(passe).connect(this.versOu(ou, 'dehors'));
    passe.connect(this.echoLarge);
    // (deux voix presque à l'unisson, l'une un demi-ton au-dessus : ça ne sonne pas juste)
    for (const [k, niveau] of [[1, 0.6], [1.06, 0.28]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const f = 56 * k;
      o.frequency.setValueAtTime(f, t0);
      o.frequency.linearRampToValueAtTime(f * 1.32, t0 + duree * 0.45);
      o.frequency.linearRampToValueAtTime(f * 0.92, t0 + duree);
      // (elle tremble)
      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = 0.35 + Math.random() * 0.3;
      const ampleur = ctx.createGain();
      ampleur.gain.value = f * 0.03;
      vibrato.connect(ampleur).connect(o.frequency);
      // deux formants : une voyelle sombre qui s'ouvre (« ou » → « o »)
      const f1 = ctx.createBiquadFilter();
      const f2 = ctx.createBiquadFilter();
      f1.type = f2.type = 'bandpass';
      f1.Q.value = 5;
      f2.Q.value = 7;
      f1.frequency.setValueAtTime(290, t0);
      f1.frequency.linearRampToValueAtTime(470, t0 + duree * 0.5);
      f2.frequency.setValueAtTime(760, t0);
      f2.frequency.linearRampToValueAtTime(880, t0 + duree * 0.5);
      const g = ctx.createGain();
      g.gain.value = niveau;
      o.connect(f1).connect(g);
      o.connect(f2).connect(g);
      g.connect(sortie);
      o.start(t0);
      vibrato.start(t0);
      o.stop(t0 + duree + 0.1);
      vibrato.stop(t0 + duree + 0.1);
    }
  }

  // Des pas sur le pont, au-dessus de soi : de l'avant vers l'arrière, lents ; ils
  // s'arrêtent ; puis un dernier, juste au-dessus. (On ne les entend que dedans.)
  // (chemin : { de, a } — deux points du bateau : les pas vont de l'un à l'autre, sur le toit de
  // la timonerie ou dans la cabine avant ; sans chemin, de gauche à droite, au-dessus)
  pasSurLePont(chemin = null) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.1;
    const n = 6 + Math.floor(Math.random() * 3);
    const pas = [];
    const ou = (u) => (chemin ? {
      x: chemin.de.x + (chemin.a.x - chemin.de.x) * u, y: chemin.de.y + (chemin.a.y - chemin.de.y) * u, z: chemin.de.z + (chemin.a.z - chemin.de.z) * u,
    } : -0.4 + 0.5 * u);
    for (let i = 0; i < n; i++) pas.push([i * (0.62 + (Math.random() - 0.5) * 0.08), 0.55 + 0.25 * (i / n), ou(i / n)]);
    // (et le dernier, plus lourd, après un silence : il s'est arrêté au-dessus de toi)
    pas.push([n * 0.62 + 2.6, 1, ou(0.92)]);
    for (const [dans, force, lieu] of pas) {
      const t = t0 + dans;
      const s = ctx.createBufferSource();
      s.buffer = this.brun;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 170;
      const coque = ctx.createBiquadFilter();
      coque.type = 'peaking';
      coque.frequency.value = 120;
      coque.Q.value = 3;
      coque.gain.value = 9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1.3 * force, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      s.connect(f).connect(coque).connect(g).connect(this.versOu(lieu, 'dedans', { pres: true }));
      s.start(t, Math.random() * 2, 0.3);
    }
    // (et le pont qui craque sous le poids, une fois)
    this.jouer('craquements', { dans: 0.1 + n * 0.3, gain: 0.35, vitesse: 0.8, pan: 0, bus: 'dedans' });
  }

  // La porte basse de la cabine avant (pan : de son côté) : en s'ouvrant, son loquet qui saute
  // et ses gonds qui grincent, longtemps ; en se fermant, le panneau qui claque et le loquet
  porteAvant(ouvre = true, ou = 0, dans = 0.03) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + dans;
    const cote = this.versOu(ou, 'dedans', { pres: true });
    // le loquet : un claquement de laiton, bref et clair
    const c = ctx.createBufferSource();
    c.buffer = this.blanc;
    const fc = ctx.createBiquadFilter();
    fc.type = 'bandpass';
    fc.frequency.value = ouvre ? 2600 : 1900;
    fc.Q.value = 5;
    const gc = ctx.createGain();
    gc.gain.setValueAtTime(0, t);
    gc.gain.linearRampToValueAtTime(ouvre ? 0.45 : 0.6, t + 0.002);
    gc.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    c.connect(fc).connect(gc).connect(cote);
    c.start(t, Math.random(), 0.1);
    if (ouvre) {
      // les gonds : un grincement lent (un bois qui craque, ralenti), qui part un instant après
      this.jouer('craquements', { dans: dans + 0.22, gain: 0.7, vitesse: 0.42, ou, pres: true, bus: 'dedans' });
      this.jouer('craquements', { dans: dans + 1.07, gain: 0.35, vitesse: 0.36, ou, pres: true, bus: 'dedans' });
    } else {
      // le panneau qui frappe son chambranle : un coup sourd
      const s2 = ctx.createBufferSource();
      s2.buffer = this.brun;
      const f2 = ctx.createBiquadFilter();
      f2.type = 'lowpass';
      f2.frequency.value = 320;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(1.1, t + 0.005);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      s2.connect(f2).connect(g2).connect(cote);
      s2.start(t, Math.random() * 2, 0.35);
    }
  }

  // Quelque chose d'immense frotte sous la coque, d'un bord à l'autre (cote : d'où il vient)
  raclement(cote = 1) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.05;
    const duree = 5.5;
    const s = ctx.createBufferSource();
    s.buffer = this.rose;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2.2;
    f.frequency.setValueAtTime(260, t0);
    f.frequency.exponentialRampToValueAtTime(120, t0 + duree);
    // (le grain du frottement : des à-coups rapides, irréguliers)
    const grain = ctx.createGain();
    for (let k = 0; k * 0.04 < duree; k++) grain.gain.setValueAtTime(0.25 + Math.random() * 0.75, t0 + k * 0.04);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.9, t0 + 1.2);
    g.gain.setValueAtTime(0.9, t0 + duree - 1.5);
    g.gain.linearRampToValueAtTime(0, t0 + duree);
    // (sous la quille : il passe d'un bord à l'autre, sous nos pieds)
    let p;
    if (this.lieux) {
      p = this.panneur({ x: cote * 8, y: -1.5, z: 1.5 }, { pres: true });
      if (p.positionX) {
        p.positionX.setValueAtTime(cote * 8, t0);
        p.positionX.linearRampToValueAtTime(-cote * 8, t0 + duree);
      }
    } else {
      p = ctx.createStereoPanner();
      p.pan.setValueAtTime(cote * 0.8, t0);
      p.pan.linearRampToValueAtTime(-cote * 0.8, t0 + duree);
    }
    p.connect(this.bus.bord);
    s.connect(f).connect(grain).connect(g).connect(p);
    s.start(t0, Math.random() * 2);
    s.stop(t0 + duree + 0.1);
    // la coque qui gémit sous la pression : un son très grave qui glisse
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(48, t0 + 1);
    o.frequency.linearRampToValueAtTime(36, t0 + duree);
    const go = ctx.createGain();
    go.gain.setValueAtTime(0, t0 + 1);
    go.gain.linearRampToValueAtTime(0.4, t0 + 2.5);
    go.gain.linearRampToValueAtTime(0, t0 + duree);
    o.connect(go).connect(this.bus.bord);
    o.start(t0 + 1);
    o.stop(t0 + duree + 0.1);
    for (let k = 0; k < 3; k++) this.jouer('craquements', { dans: 1.2 + k * 1.3, gain: 0.6, vitesse: 0.45 + 0.1 * Math.random(), pan: cote * (0.5 - k * 0.5) });
  }

  // Un choc énorme contre la coque, tout près (après un long calme : on sursaute)
  coupEnorme(ou = null) {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.02;
    const sortie = this.versOu(ou ?? (this.lieux ? { x: 0, y: 0.2, z: 0.4 } : null), 'bord', { pres: true });
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(72, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1.4, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    o.connect(g).connect(sortie);
    o.start(t);
    o.stop(t + 1.2);
    const c = ctx.createBufferSource();
    c.buffer = this.blanc;
    const fc = ctx.createBiquadFilter();
    fc.type = 'bandpass';
    fc.frequency.value = 650;
    fc.Q.value = 1.2;
    const gc = ctx.createGain();
    gc.gain.setValueAtTime(0, t);
    gc.gain.linearRampToValueAtTime(0.9, t + 0.003);
    gc.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    c.connect(fc).connect(gc).connect(sortie);
    c.start(t, Math.random(), 0.2);
    for (let k = 0; k < 2; k++) this.jouer('craquements', { dans: 0.05 + k * 0.5, gain: 0.9, vitesse: 0.5, pan: (Math.random() - 0.5) });
  }

  // La vague scélérate s'abat sur le bateau : un fracas énorme, un coup sourd dans toute la
  // coque, et le bois qui hurle
  chocScelerate(ou = 0) {
    if (!this.actif()) return;
    this.deferlante(1.5, 0.02, ou);
    this.choc(1);
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // (un coup très grave, long : la masse d'eau sur le pont)
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(60, t);
    o.frequency.exponentialRampToValueAtTime(24, t + 1.2);
    const a = ctx.createGain();
    a.gain.setValueAtTime(0.0001, t);
    a.gain.linearRampToValueAtTime(1, t + 0.02);
    a.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    o.connect(a).connect(this.bus.bord);
    o.start(t);
    o.stop(t + 1.7);
    for (let k = 0; k < 4; k++) {
      this.jouer('craquements', { dans: 0.2 + k * 0.4 + Math.random() * 0.2, gain: 0.8, vitesse: 0.4 + 0.2 * Math.random(), pan: (Math.random() - 0.5) * 1.6 });
    }
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
        o.connect(g).connect(this.aLieu('console', 'tete'));
        o.start(t);
        o.stop(t + 0.15);
      }
    }
  }

  // L'alarme de la zone de garde du radar : deux notes qui alternent, vite (bip-bip,
  // bip-bip), une salve par appel
  alarmeRadar() {
    if (!this.actif()) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    for (let k = 0; k < 4; k++) {
      const t = t0 + k * 0.16;
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = k % 2 ? 1760 : 2350;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.004);
      g.gain.setValueAtTime(0.05, t + 0.1);
      g.gain.linearRampToValueAtTime(0, t + 0.11);
      o.connect(g).connect(this.aLieu('console', 'tete'));
      o.start(t);
      o.stop(t + 0.12);
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
    s.connect(f).connect(g).connect(this.versOu(this.lieux?.foc ?? null, 'dehors'));
    s.start(t, Math.random() * 2, 1.4);
  }

  // La corne du cargo : n coups brefs (cinq : « je ne comprends pas vos intentions »)
  corne(n = 5) {
    if (!this.actif()) return;
    // la vraie corne d'un paquebot, coupée en coups d'une seconde
    let enregistree = true;
    for (let k = 0; k < n && enregistree; k++) {
      enregistree = this.jouer('cornes', { index: 0, dans: k * 1.6, duree: 1.05, gain: 0.9, grave: 2500, bus: 'dehors' });
    }
    if (enregistree) return;
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
      f.connect(g).connect(this.bus.dehors);
    }
  }

  regler(volume) {
    this.volume = volume;
    if (this.sortie) this.vers(this.sortie.gain, volume, 0.1);
  }
}
