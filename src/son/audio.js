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
// Trois « bus » (des tables de mixage) :
//  - dehors : ce que l'on entend sur le pont ; dans la cabine, la coque l'étouffe (un
//    filtre ne laisse passer que les graves) ;
//  - dedans : ce que l'on n'entend que dans la cabine (la coque, le toit), avec l'écho d'une
//    petite pièce en bois ;
//  - bord : ce qui est à bord, dedans comme dehors (les craquements, le winch, la pompe).
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

// Les boucles enregistrées, et sur quel bus elles jouent
const BOUCLES = {
  'vent-doux': 'dehors', 'vent-fort': 'dehors', 'vent-rafales': 'dehors', greement: 'dehors', 'greement-aigu': 'dehors',
  'mer-forte': 'dehors', 'cockpit-jour': 'dehors', 'sous-voiles': 'dehors', 'pluie-pont': 'dehors', 'voile-bat': 'dehors',
  pilote: 'bord', hurlement: 'bord', 'cabine-mer': 'dedans', coque: 'dedans', 'pluie-toit': 'dedans', 'vent-dedans': 'dedans',
};

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
    this.bus = { dehors: gain(1), dedans: gain(0), bord: gain(1), radio: gain(1) };
    this.bus.dehors.connect(this.filtreCabine).connect(this.compresseur);
    this.bus.dedans.connect(this.compresseur);
    this.bus.bord.connect(this.compresseur);
    this.bus.radio.connect(this.sortie);
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
    source(this.brun, 1.3).connect(this.clapotis.filtre).connect(this.clapotis.gain).connect(this.bus.bord);
    this.gargouille = { filtre: filtre('bandpass', 520, 3), gain: gain() };
    source(this.rose, 1.6).connect(this.gargouille.filtre).connect(this.gargouille.gain).connect(this.bus.bord);
    // la trombe : un rugissement grave et un sifflement
    this.trombe = { filtre: filtre('lowpass', 260, 0.7), gain: gain(), sifflement: filtre('bandpass', 900, 2), gainSifflement: gain() };
    source(this.brun, 0.7).connect(this.trombe.filtre).connect(this.trombe.gain).connect(this.bus.dehors);
    source(this.blanc, 0.8).connect(this.trombe.sifflement).connect(this.trombe.gainSifflement).connect(this.bus.dehors);
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
    s.connect(g).connect(this.bus[BOUCLES[nom]]);
    // (chaque boucle part d'un endroit au hasard : deux parties ne sonnent pas pareil)
    s.start(0, infos.boucle[0] + Math.random() * (infos.boucle[1] - infos.boucle[0]));
    this.boucles[nom] = { source: s, gain: g };
  }

  a(nom) { return !!this.boucles[nom]; }

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

  // e : { ventApparent (nds), vitesse (nds), faseyement (0 → 1), pluie (0 → 1),
  //       bordage (vitesse de rotation d'un winch, 0 → 1), houle (m, hauteur significative),
  //       eauCale, eauCockpit (litres), roulis (rad/s), mouvement (secousses du bateau, 0 → 1),
  //       trombe, cargo (0 : loin → 1 : sur nous), pilote (le vérin travaille, 0 → 1),
  //       nuit (0 → 1), voiles (toile hissée, 0 → 1) }
  maj(dt, e) {
    if (!this.actif()) return;
    const t = this.ctx.currentTime;
    const vent = Math.max(0, e.ventApparent);
    const fv = Math.min(1, vent / 45);
    const hs = e.houle ?? 1;
    // (quand un enregistrement est là, le son calculé correspondant s'efface presque)
    const calcul = (nom, reste) => (this.a(nom) ? reste : 1);

    // ----- dehors -----
    // le vent : la brise (enregistrée en studio, régulière), puis la tempête, puis ses rafales
    this.boucle('vent-doux', 0.4 * lisse(2, 14, vent) * (1 - 0.6 * lisse(24, 36, vent)), 0.5, 0.85 + 0.35 * fv);
    this.boucle('vent-fort', 0.75 * lisse(18, 34, vent), 0.6);
    this.boucle('vent-rafales', 0.75 * lisse(24, 40, vent), 0.6);
    this.vers(this.vent.gain.gain, (0.04 + 0.5 * fv * fv + 0.05 * fv) * calcul('vent-doux', 0.2));
    this.vers(this.vent.filtre.frequency, 280 + 900 * fv);
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

    // ----- dedans (la cabine) -----
    const d = this.dedans ? 1 : 0;
    this.boucle('cabine-mer', d * (0.18 + 0.3 * lisse(1, 4.5, hs)), 0.6);
    this.boucle('coque', d * 0.4 * lisse(1, 7, e.vitesse), 0.6);
    this.boucle('pluie-toit', d * 0.5 * e.pluie, 0.8);
    this.boucle('vent-dedans', d * 0.42 * lisse(16, 34, vent), 0.6);

    // ----- à bord -----
    // le vent qui hurle, la nuit, au plus fort (plus fort dans la cabine, par les ouvertures)
    this.boucle('hurlement', (this.dedans ? 0.5 : 0.22) * lisse(26, 42, vent) * (0.4 + 0.6 * (e.nuit ?? 0)), 1.2);
    // le moteur du pilote, quand il pousse la barre
    this.boucle('pilote', 0.5 * Math.min(1, e.pilote ?? 0), 0.08);
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
    // le bois et les cordages travaillent : d'autant plus que le bateau est secoué et que
    // le vent forcit (un craquement de temps en temps par beau temps, sans cesse dans la tempête)
    this.ageCraquement += dt;
    const secoue = Math.min(1, e.mouvement ?? roule);
    const parSeconde = 0.06 + 1.6 * secoue * secoue + 0.5 * lisse(20, 40, vent);
    if (this.ageCraquement > 0.3 && Math.random() < parSeconde * dt) {
      this.ageCraquement = 0;
      this.craquement(0.35 + 0.65 * Math.max(secoue, lisse(25, 42, vent) * Math.random()));
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
  // o : { index, gain, vitesse (hauteur), pan (-1 → 1), bus, dans (secondes), duree, grave (Hz : filtre) }
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
    if (o.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = o.pan;
      sortie = sortie.connect(p);
    }
    sortie.connect(this.bus[o.bus ?? 'bord']);
    s.start(quand, Math.max(0, debut - 0.02), duree + 0.08);
    return true;
  }

  // Un craquement du bois ou d'un cordage (force 0 → 1) : plus grave quand c'est fort (la
  // coque, le mât), plus aigu pour un petit grincement ; d'un côté ou de l'autre
  craquement(force = 0.5) {
    this.jouer('craquements', {
      gain: 0.25 + 0.75 * force,
      vitesse: 1.05 - 0.5 * force * Math.random() - 0.1 * Math.random(),
      pan: (Math.random() * 2 - 1) * 0.8,
      bus: 'bord',
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
      pan: (Math.random() - 0.5) * 0.6,
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
    s.connect(f).connect(g).connect(this.bus.dehors);
    s.start(t, Math.random() * 3, 1.4);
  }

  // le tonnerre : le craquement puis le grondement, d'autant plus tard et plus sourd
  // que l'éclair est loin (le son va moins vite que la lumière : 3 s par kilomètre)
  tonnerre(distance, force = 1) {
    if (!this.actif()) return;
    const proche = Math.max(0, 1 - distance / 9000);
    const dans = distance / 340;
    // proche : un claquement sec (morceaux 0-1) ; loin : un long roulement (4-5)
    const index = proche > 0.75 ? Math.floor(Math.random() * 2) : proche > 0.45 ? 2 + Math.floor(Math.random() * 2) : 4 + Math.floor(Math.random() * 2);
    if (this.jouer('tonnerres', {
      index, dans, bus: 'dehors',
      gain: Math.min(1.3, (0.3 + 0.9 * proche) * force),
      grave: 400 + 9000 * proche * proche,
      vitesse: 0.85 + 0.2 * Math.random(),
      pan: (Math.random() - 0.5) * 0.8,
    })) return;
    // (pas encore d'enregistrement : le tonnerre calculé)
    const ctx = this.ctx;
    const t = ctx.currentTime + dans;
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
    s.connect(f).connect(g).connect(this.bus.dehors);
    s.start(t, Math.random() * 2);
    s.stop(t + 9);
  }

  // en bas, dans la cabine : la tempête n'arrive plus qu'étouffée par la coque ; ce qui est
  // à bord résonne dans la petite pièce en bois
  dansLaCabine(dedans) {
    if (!this.actif()) return;
    this.dedans = dedans;
    this.vers(this.filtreCabine.frequency, dedans ? 520 : 18000, 0.35);
    this.vers(this.bus.dehors.gain, dedans ? 0.3 : 1, 0.35);
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
    s.connect(f).connect(g).connect(this.bus.bord);
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
    g1.connect(f1).connect(a1).connect(this.bus.dehors);
    g1.start(t, Math.random() * 2);
    g1.stop(impact + 3);
    // le fracas : une vague de falaise enregistrée (morceaux 5 à 8), ou le souffle calculé
    const enregistre = this.jouer('vagues', {
      index: 5 + Math.floor(Math.random() * 4), dans: Math.max(0, dans - 0.15), gain: 0.6 + 0.8 * force, bus: 'dehors',
      vitesse: 0.85 + 0.15 * Math.random(),
    });
    if (!enregistre) {
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
      g2.connect(f2).connect(a2).connect(this.bus.dehors);
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
    s.connect(f).connect(g).connect(this.bus.dehors);
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
