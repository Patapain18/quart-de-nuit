// La nuit de tempête : du coucher du soleil (18 h 45) à l'aube (6 h). Le temps se gâte
// d'heure en heure (le vent monte jusqu'à ~42 nœuds vers 2 h 30, rafales à 55), puis le
// front passe et tout s'apaise. Pendant ce temps :
//  - les déferlantes frappent le bateau (on les entend venir quelques secondes avant) ;
//  - l'eau embarque : le cockpit se remplit et se vide par ses nables, la cabine prend
//    l'eau si la descente est ouverte, le bateau « travaille » et suinte ; on pompe ;
//  - des avaries : l'écoute de foc qui casse (usée contre le hauban), une voile qui se
//    déchire quand on en garde trop, le pilote automatique qui lâche ;
//  - une trombe marine au crépuscule — la bête, née d'un grain qu'on a vu arriver au
//    radar —, un cargo qui croise la route vers 22 h 30 ;
//  - des grains : des averses d'orage qui passent, chacune avec sa rafale (monde/grains.js) ;
//    trois ou quatre passent sur le bateau, Jos les annonce ;
//  - la foudre, qui part de leurs nuages (monde/foudre.js) : on compte les secondes jusqu'au
//    tonnerre, le feu de Saint-Elme s'allume en tête de mât, et elle peut tomber tout près —
//    ou sur le mât ;
//  - deux ou trois vagues scélérates de 18 à 22 m (annoncées : le grondement, Jos, le
//    radar) : à prendre droit dans l'arrière, sinon elles couchent le bateau ;
//  - Jos veille à la radio, depuis son sémaphore, et conseille quand ça va mal.
// On a gagné si le bateau est encore à flot, et le marin à bord, quand le jour se lève.
//
// Comme la journée (journee.js), ce fichier ne dessine rien et ne parle pas lui-même : il
// dit au jeu ce qui se passe (ses événements) et demande à la radio de parler. On peut
// donc faire jouer toute la nuit par un programme (scripts/test-nuit.js).
//
// ctx, ce que l'on sait à chaque image (fabriqué par le jeu) : dt, m (les mesures du
// bateau), physique, pilote (le pilote automatique est-il embrayé ?), mode ('barre' ou
// 'pied'), aBord (feux, gilet, descenteOuverte, attache, dehors), evenements.
import { Vector3 } from 'three';
import { AMBIANCES, etatMeteo, interpoler, angleVers } from '../monde/meteo.js';
import { Deferlantes } from '../monde/deferlantes.js';
import { Scelerates, chocScelerate } from '../monde/scelerates.js';
import { Grains, PORTEUR } from '../monde/grains.js';
import { Foudre } from '../monde/foudre.js';
import { pressionDuJour, tendance, tendanceEnMots } from '../monde/pression.js';
import { Peur } from './peur.js';
import { directionEnMots, aLaDirection } from './radio.js';
import { NOM_BATEAU, JOS, HEURE_COUCHER, heureEnTexte } from './journee.js';
import { LISTE_NUIT } from './lecons.js';

export const HEURE_AUBE = 30; // 6 h du matin (le lendemain : 24 + 6)
export const HEURE_LEVER = 30.8; // le soleil se lève (après la nuit, un accéléré de 20 s)
const DUREE_LEVER = 20;

// Les chapitres de la nuit : l'heure n'avance pas toujours au même pas (≈ 19 min en tout)
export const CHAPITRES = [
  {
    id: 'crepuscule', titre: 'Le crépuscule', de: HEURE_COUCHER, a: 21, duree: 190,
    dire: [
      `${NOM_BATEAU}, ici ${JOS}, sur le soixante-douze. Le soleil est couché, la nuit va être longue. Mais ton bateau est solide, et toi aussi.`,
      'Rappelle-toi : moins de toile, les vagues sur l\'arrière, le harnais toujours accroché et la porte de la timonerie fermée. Je veille toute la nuit.',
    ],
  },
  {
    id: 'montee', titre: 'Le vent monte', de: 21, a: 24, duree: 300,
    bulletin: [
      'Avis de tempête pour la zone du large.',
      'Vent de sud-ouest force neuf, rafales à cinquante-cinq nœuds. Mer très grosse.',
    ],
    // (le baromètre l'annonçait : il dégringole)
    dire: (n) => [
      `Tu as entendu ? Ça forcit. Et ton baromètre dégringole : ${Math.round(-tendance(n.heure))} hectopascals en trois heures, c'est la tempête qui vient.`,
      'Deux ris dans la grand-voile et le foc presque roulé, c\'est le moment ou jamais.',
    ],
  },
  {
    id: 'pic', titre: 'Au cœur de la tempête', de: 24, a: 27.5, duree: 420,
    dire: (n, ctx) => {
      const p = pressionDuJour(n.heure);
      // (si l'on a calé l'aiguille témoin avant la nuit : de combien il a baissé depuis)
      const t = ctx?.barometre?.temoin;
      const depuis = t != null && t - p > 5 ? ` Depuis que tu as calé ton aiguille, il a perdu ${Math.round(t - p)} hectopascals.` : '';
      return [
        `Minuit, ${NOM_BATEAU}. Ton baromètre est à ${Math.round(p)}, et il baisse encore.${depuis} Le plus dur arrive : quarante nœuds, et plus dans les grains.`,
        'Le mieux maintenant : affaler la grand-voile, et fuir sous un mouchoir de foc, les vagues bien dans l\'arrière. Et pompe de temps en temps.',
      ];
    },
  },
  {
    id: 'accalmie', titre: 'L\'accalmie', de: 27.5, a: HEURE_AUBE, duree: 270,
    dire: [
      'Le vent tourne à l\'ouest, et ton baromètre remonte, vite : le front est passé.',
      'Ça va tomber peu à peu. Tiens encore un peu, l\'aube est à six heures.',
    ],
  },
];

// Ce que Jos dit à certaines heures (une seule fois)
const MOMENTS = [
  { heure: 26.05, dire: ['Ici, sur la pointe, l\'anémomètre vient de marquer cinquante-cinq nœuds. C\'est le plus fort. Tiens bon.'] },
  { heure: 28.9, dire: ['Regarde vers l\'ouest : on revoit des étoiles. Le plus dur est derrière toi.'] },
  { heure: 29.55, dire: ['À l\'est, le ciel pâlit. Encore un petit effort.'] },
  // (à la fin de la liste : les nuits gardées avant le radar retrouvent leurs moments)
  { heure: 20.9, dire: ['Une chose encore : la nuit, regarde ton radar. L\'écran est sur la console de la timonerie, et il y en a un petit dans le cockpit, au-dessus du compas.', 'Tu y verras les grains arriver, et les bateaux. Ce qui est près de toi, c\'est le fouillis des vagues : ne t\'en inquiète pas. Et de la timonerie, tu peux tenir ton cap au pilote, à l\'abri.'] },
];

// La difficulté (l'atelier de la tempête sert à la régler)
export const DIFFICULTES = {
  matelot: { nom: 'Matelot', deferlantes: 0.6, force: 0.85, fuite: 0.6, avaries: 0.7, vent: -3, scelerates: 2, hauteurScelerate: 18, grains: 0.8 },
  marin: { nom: 'Marin', deferlantes: 1, force: 1, fuite: 1, avaries: 1, vent: 0, scelerates: 3, hauteurScelerate: 20, grains: 1 },
  caphornier: { nom: 'Cap-hornier', deferlantes: 1.5, force: 1.12, fuite: 1.4, avaries: 1.3, vent: 4, scelerates: 3, hauteurScelerate: 22, grains: 1.15 },
};

// ---------- Le temps qu'il fait pendant la nuit ----------
const COUCHER = AMBIANCES['coucher-menacant'];
const TEMPETE = AMBIANCES['nuit-tempete'];
const ETAPES_METEO = [
  [HEURE_COUCHER, { ...COUCHER, vent: 25, directionVent: 222, nuages: 0.68, orage: 0.6, pluie: 0.08, brume: 0.28, front: 0.76, houle: { hs: 2.2, periode: 12, direction: 252 } }],
  // (le front orageux couvre le ciel peu après le coucher du soleil : la lune disparaît)
  [19.6, { ...COUCHER, vent: 27, directionVent: 221, nuages: 0.95, orage: 0.72, pluie: 0.22, brume: 0.32, front: 0.95, houle: { hs: 2.25, periode: 12, direction: 250 } }],
  [20.5, { ...COUCHER, vent: 30, directionVent: 220, nuages: 0.97, orage: 0.8, pluie: 0.4, brume: 0.36, front: 1, houle: { hs: 2.3, periode: 12, direction: 248 } }],
  [22.5, { ...TEMPETE, vent: 35, directionVent: 217, nuages: 0.97, orage: 0.92, pluie: 0.75, brume: 0.48 }],
  [24.5, { ...TEMPETE, vent: 39 }],
  [26.3, { ...TEMPETE, vent: 42 }],
  [27.4, { ...TEMPETE, vent: 38, directionVent: 230, houle: { ...TEMPETE.houle, direction: 244 } }],
  // (le front est passé : on le revoit de l'autre côté, au nord-nord-est, qui s'éloigne ;
  // il tourne pendant qu'il est encore au-dessus de nous, quand on ne le voit pas)
  [27.5, { ...TEMPETE, vent: 37, directionVent: 231, front: 0.975, directionFront: 28, largeurFront: 45, houle: { ...TEMPETE.houle, direction: 244 } }],
  [28.4, { ...TEMPETE, vent: 27, directionVent: 245, nuages: 0.72, orage: 0.3, pluie: 0.3, brume: 0.4, front: 0.8, directionFront: 28, largeurFront: 45, houle: { hs: 3.0, periode: 13, direction: 245 } }],
  [29.4, { ...AMBIANCES.aube, vent: 17 }],
  [HEURE_AUBE, AMBIANCES.aube],
  // (le matin après la tempête : le ciel se dégage, la mer reste formée)
  [HEURE_LEVER, { ...AMBIANCES.aube, vent: 12, directionVent: 265, nuages: 0.3, orage: 0, pluie: 0, brume: 0.22, front: 0.32, houle: { hs: 2.8, periode: 14, direction: 250 } }],
];
export function meteoDeLaNuit(heure, niveau = DIFFICULTES.marin) {
  let i = 0;
  while (i < ETAPES_METEO.length - 2 && heure > ETAPES_METEO[i + 1][0]) i++;
  const [h0, a] = ETAPES_METEO[i];
  const [h1, b] = ETAPES_METEO[i + 1];
  const t = Math.min(1, Math.max(0, (heure - h0) / (h1 - h0)));
  const m = interpoler(etatMeteo(a), etatMeteo(b), t);
  m.heure = heure % 24;
  // (la difficulté ajoute ou retire du vent, surtout au plus fort)
  m.vent += niveau.vent * Math.max(0, (m.vent - 24) / 18);
  return m;
}

// L'heure du jeu au bout de t secondes de nuit (les chapitres n'avancent pas au même pas)
export function heureA(t) {
  let reste = Math.max(0, t);
  for (const ch of CHAPITRES) {
    if (reste <= ch.duree) return ch.de + (reste / ch.duree) * (ch.a - ch.de);
    reste -= ch.duree;
  }
  return HEURE_AUBE;
}

// ---------- Les grains qui viendront sur le bateau ----------
// Les autres naissent et passent au loin, au gré du temps (monde/grains.js). Ceux-ci sont
// lancés exprès, quatre minutes avant d'arriver (on les voit venir au radar, Jos les
// annonce) ; chacun quand rien d'autre n'arrive, pour qu'on le vive pour lui-même : le
// premier porte la bête (il est là dès le coucher du soleil : voir lancerGrainBete) ; le
// plus fort au cœur de la tempête ; le dernier, plus faible, quand elle s'en va.
// (arrivee : s de nuit, quand son cœur passe ; force, orage : 0 → 1 ; ecart : m, au plus
// près ; annonce : Jos le dit)
export const DANS_GRAIN = 240;
const GRAINS_DE_LA_NUIT = [
  { bete: true, arrivee: 360, force: 0.6, orage: 1, ecart: 1100 },
  { arrivee: 650, force: 0.8, orage: 0.6, ecart: 250 },
  { arrivee: 820, force: 0.9, orage: 1, ecart: 120 },
  { arrivee: 1010, force: 0.55, orage: 0.3, ecart: 450 },
];

// La trombe touche le bateau à moins de RAYON_TOUCHE mètres de son axe : dans le plus
// épais de sa gerbe d'embruns (celle de la bête, rendu/trombe.js, a 52 m de cœur)
export const RAYON_TOUCHE = 95;

// La bête (la trombe du crépuscule) : elle vit 260 s ; quand elle naît, elle est à moins
// d'un kilomètre du bateau, et s'il garde sa route, elle passe derrière lui à 250 m, une
// minute trois quarts à deux minutes et demie plus tard (selon qu'elle le rattrape ou
// qu'elle croise sa route) ; son tourbillon (de Rankine) : un cœur de 50 m (son entonnoir
// fait 100 m de large au pied), 38 m/s à son bord (74 nœuds). Son grain : force 0,6, plein
// d'éclairs.
export const BETE = { duree: 260, loin: 850, passe: [100, 150], ecart: 250, coeur: 50, vmax: 38, force: 0.6, orage: 1 };

// Où doit naître la bête pour passer derrière le bateau, à « ecart » mètres, s'il garde sa
// route : on se place dans le repère du bateau (elle y avance à w = sa vitesse − celle du
// bateau) ; elle doit y passer au plus près à « ecart » mètres, du côté opposé à sa marche
// (derrière lui), dans T secondes (le temps de venir de 850 m, entre une minute quarante et
// deux minutes et demie). Rend la position où elle sera à sa naissance, depuis le bateau
// (m), la perpendiculaire n, et T
function placeDeLaBete(ux, uz, V, v, ecart) {
  const wx = V * ux - v.x;
  const wz = V * uz - v.z;
  const w = Math.hypot(wx, wz) || 1;
  // (la perpendiculaire à sa route relative, du côté opposé à la marche du bateau)
  let nx = -wz / w;
  let nz = wx / w;
  if (nx * v.x + nz * v.z > 0) {
    nx = -nx;
    nz = -nz;
  }
  const T = Math.min(BETE.passe[1], Math.max(BETE.passe[0], BETE.loin / w));
  return { x: ecart * nx - wx * T, z: ecart * nz - wz * T, nx, nz, T };
}

// ---------- L'eau à bord ----------
export const EAU = {
  planchers: 150, // litres dans la cale : au-delà, l'eau passe au-dessus des planchers
  naufrage: 2000, // litres : le bateau s'enfonce, il faut l'abandonner
  seuil: 260, // litres dans le cockpit : au-delà, elle passe par-dessus le seuil de la descente
  cockpitMax: 750,
};

function generateur(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const lisse = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const ecartAngle = (a, b) => ((a - b + 540) % 360) - 180;

// Où est une chose, vue du bateau : « droit devant », « derrière, sur bâbord »…
export function directionRelative(relatif) {
  const a = Math.abs(relatif);
  const cote = relatif >= 0 ? 'tribord' : 'bâbord';
  if (a < 20) return 'droit devant';
  if (a < 70) return `devant, sur ${cote}`;
  if (a < 110) return `par le travers ${cote}`;
  if (a < 160) return `derrière, sur ${cote}`;
  return 'droit derrière';
}

// Une distance en milles, comme Jos la dit : « un mille et demi »
export function millesEnMots(m) {
  const n = m / 1852;
  if (n < 0.75) return 'moins d\'un mille';
  if (n < 1.25) return 'un mille';
  if (n < 1.75) return 'un mille et demi';
  if (n < 2.5) return 'deux milles';
  return `${Math.round(n)} milles`;
}

// La toile est-elle prête pour ce vent ? (au-delà de 34 nœuds : la grand-voile affalée, un
// mouchoir de foc ; en dessous : deux ris, le foc presque roulé)
export function toilePrete(p, vent) {
  return vent >= 34 ? p.ris >= 3 && p.deroule <= 0.3 : p.ris >= 2 && p.deroule <= 0.45;
}

// La toile en mots : « 2 ris, foc 30 % »
export function toileEnMots(p) {
  const gv = p.ris >= 3 ? 'grand-voile affalée' : p.ris === 0 ? 'grand-voile haute' : `${p.ris} ris`;
  const foc = p.deroule < 0.03 ? 'foc roulé' : `foc ${Math.round(p.deroule * 100)} %`;
  return `${gv}, ${foc}`;
}

export class Nuit {
  // radio : { parler(phrases, options) → promesse, libre, taire() } ; difficulte : 'matelot',
  // 'marin' ou 'cap-hornier' ; graine : pour que deux nuits avec la même graine soient pareilles
  constructor({ radio, difficulte = 'marin', graine = 1 } = {}) {
    this.radio = radio;
    this.difficulte = DIFFICULTES[difficulte] ? difficulte : 'marin';
    this.niveau = DIFFICULTES[this.difficulte];
    this.graine = graine;
    this.hasard = generateur(graine * 7919 + 13);
    this.heure = HEURE_COUCHER;
    this.c = 0; // le chapitre en cours
    this.t = 0; // secondes (réelles) depuis le début de la nuit
    this.retardLumiere = 0; // (heures : de combien la lumière du ciel retarde sur l'horloge)
    this.etat = 'nuit'; // 'nuit', 'aube' (gagné) ou 'perdue'
    this.meteo = meteoDeLaNuit(this.heure, this.niveau);
    this.deferlantes = new Deferlantes(graine * 31 + 5);
    this.annonceVue = null;
    this.suiviCoup = null;
    this.eau = { cockpit: 0, cale: 0 };
    this.avaries = { ecouteFoc: 'ok', grandVoile: 'ok', foc: 'ok', pilote: 'ok' };
    this.fatigue = { grandVoile: 0, foc: 0 };
    // l'heure (du jeu) où arriveront les imprévus
    this.prevu = {
      // (la trombe vient au début de la nuit, quand il reste un peu de lumière : voir
      // retarderLumiere)
      trombe: 19.4 + this.hasard() * 0.15,
      cargo: 22.4 + this.hasard() * 0.5,
      ecouteFoc: 24.8 + this.hasard() * 1.2,
      pilote: 26.0 + this.hasard() * 0.9,
    };
    // l'étrange (jamais expliqué : la nuit, la fatigue, la peur ?) — une lumière sur l'eau,
    // une voix sur le 16, Jos qui ne répond plus, des coups contre la coque. (Un hasard à
    // part : les nuits déjà jouées et les tests gardent leurs imprévus.)
    const etrange = generateur(graine * 104729 + 7);
    Object.assign(this.prevu, {
      lumiere: 23.6 + etrange() * 0.5,
      voix16: 24.55 + etrange() * 0.45,
      silence: 25.6 + etrange() * 0.4,
      coups: 26.9 + etrange() * 0.5,
    });
    // (l'écho qui nous suit sur le radar est maintenant dans la peur : jeu/peur.js)
    // les vagues scélérates (un hasard à part, lui aussi) : la première quand le vent monte,
    // la deuxième au plus fort — pendant que Jos ne répond plus —, la dernière quand le
    // vent tourne (une vague croisée, d'une autre direction que les autres)
    const scel = generateur(graine * 15485863 + 11);
    this.hasardScelerate = scel;
    const heuresScelerates = [21.3 + scel() * 0.3, this.prevu.silence + 0.08 + scel() * 0.1, 27.75 + scel() * 0.3];
    heuresScelerates.slice(0, this.niveau.scelerates ?? 3).forEach((h, k) => { this.prevu[`scelerate${k}`] = h; });
    this.scelerates = null; // (le chef d'orchestre : monde/scelerates.js ; il lui faut la houle)
    this.aLancer = null; // (une vague à lancer tout de suite : pour vérifier)
    // les grains (monde/grains.js) : ceux qui vivent alentour, et ceux qui viendront sur nous
    // (encore un hasard à part : chaque grain prévu arrive à quelques secondes près, d'un
    // côté ou de l'autre)
    const hg = generateur(graine * 7727 + 19);
    this.grains = new Grains(graine * 31337 + 7);
    this.hasardGrains = hg;
    this.plansGrains = GRAINS_DE_LA_NUIT.map((g) => ({ ...g, arrivee: g.arrivee + (hg() - 0.5) * 40, ecart: g.ecart * (hg() < 0.5 ? -1 : 1) }));
    // (celui de la bête : dès le coucher du soleil)
    this.plansGrains.forEach((g, k) => { this.prevu[`grain${k}`] = g.bete ? HEURE_COUCHER : heureA(g.arrivee - DANS_GRAIN); });
    this.grainBete = null;
    this.hasardBete = generateur(graine * 92821 + 3);
    // (la vitesse du bateau, lissée sur vingt secondes : pour prévoir où il sera)
    this.vitesseLissee = null;
    this.ici = null; // (ce que font les grains là où est le bateau : la pluie, leur vent…)
    // la pression ici (monde/pression.js : celle de la dépression qui arrive, et le bond des
    // grains quand arrive leur rafale)
    this.pression = pressionDuJour(this.heure);
    // la foudre (monde/foudre.js) : elle part de leurs nuages, et de celui de la trombe
    this.foudre = new Foudre(graine * 6151 + 29);
    // la peur (jeu/peur.js) : la tension, et ce qu'on voit du coin de l'œil
    this.peur = new Peur({ graine });
    this.silence = false; // (Jos ne répond plus)
    this.dernierEtrange = null; // { nom, heure } : ce que Jos tentera d'expliquer si on l'appelle
    this.faits = new Set(); // les moments et les imprévus déjà passés
    this.cargo = null;
    this.trombe = null;
    this.stats = {
      deferlantes: 0, coups: 0, giteMax: 0, couche: 0, pompee: 0, distance: 0, vitesseMax: 0, caleMax: 0,
      cargoDistance: Infinity, cargoAppele: false, trombeDistance: Infinity, aLaBarre: 0,
      scelerates: 0, sceleratesCouche: 0, grains: 0, rafaleMax: 0,
      eclairs: 0, eclairPlusPres: Infinity, frappes: 0, surLeMat: 0,
      pressionMin: Infinity, heurePressionMin: null,
    };
    this.journal = [];
    this.conseils = {};
    this.dernierConseil = -999;
    this.renverse = 0; // secondes passées le mât sous l'horizontale
    this.tReprise = 0; // (les chiffres de la nuit ne comptent qu'après 5 s : le temps que le bateau se pose)
    this.sauvegarde = null;
    this.raison = null;
    this.commence = false;
    this.alertesEau = new Set();
    this.ecouteurs = {};
    this.evenements = new Set();
    this._v = new Vector3();
  }

  // ---------- Pour le jeu ----------
  on(nom, f) { (this.ecouteurs[nom] ??= []).push(f); return this; }
  emettre(nom, ...args) { for (const f of this.ecouteurs[nom] ?? []) f(...args); }
  get chapitre() { return CHAPITRES[this.c]; }
  get progression() { return (this.heure - HEURE_COUCHER) / (HEURE_AUBE - HEURE_COUCHER); }
  ecrire(texte) {
    const entree = { heure: this.heure, texte };
    this.journal.push(entree);
    this.emettre('journal', entree);
  }
  // urgent : on coupe ce qui se dit (une avarie, la trombe, le cargo n'attendent pas la
  // fin d'un long message)
  dire(phrases, { emetteur = JOS, canal = 72, siLibre = false, urgent = false } = {}) {
    // (pendant le silence, Jos n'arrive plus jusqu'au bateau)
    if (this.silence && emetteur === JOS) return Promise.resolve(false);
    if (urgent) this.radio.taire?.();
    return this.radio.parler(phrases, { emetteur, canal, siLibre });
  }

  // ---------- Chaque image ----------
  maj(dt, ctx) {
    this.evenements = new Set(ctx.evenements ?? []);
    ctx.evenements = this.evenements;
    // l'aube passée, le soleil se lève (un accéléré : le ciel se dégage, le vent tombe)
    if (this.etat === 'aube' && this.heure < HEURE_LEVER) {
      this.heure = Math.min(HEURE_LEVER, this.heure + (dt * (HEURE_LEVER - HEURE_AUBE)) / DUREE_LEVER);
      this.meteo = meteoDeLaNuit(this.heure, this.niveau);
      ctx.meteo = this.meteo;
      ctx.physique.eauCale = this.eau.cale;
      ctx.physique.eauCockpit = this.eau.cockpit;
      return;
    }
    if (this.etat !== 'nuit') return;
    if (!this.commence) {
      this.commence = true;
      this.commencerChapitre(ctx);
    }
    this.t += dt;
    this.avancerHeure(dt, ctx);
    this.retarderLumiere(dt);
    this.meteo = this.meteoIci();
    ctx.meteo = this.meteo;
    this.lisserVitesse(dt, ctx);
    this.suivreGrains(dt, ctx);
    this.suivreBarometre(dt, ctx);
    this.suivreScelerates(dt, ctx);
    this.suivreDeferlantes(dt, ctx);
    this.suivreEau(dt, ctx);
    this.suivreAvaries(dt, ctx);
    this.suivreTrombe(dt, ctx);
    this.suivreFoudre(dt, ctx);
    this.suivreCargo(dt, ctx);
    this.suivreEtrange(dt, ctx);
    this.suivrePeur(dt, ctx);
    this.suivreBateau(dt, ctx);
    if (this.etat !== 'nuit') return;
    this.suivreMoments();
    this.suivreFeux(ctx);
    this.conseiller(dt, ctx);
    if (this.heure >= HEURE_AUBE) this.leverDuJour();
  }

  // Le temps qu'il fait maintenant. La lumière peut retarder sur l'horloge : pendant que la
  // trombe est là, le crépuscule s'attarde (la hauteur du soleil, l'épaisseur de l'orage,
  // les nuages, le front, la brume sont ceux d'un moment plus tôt) ; le vent, la mer et la
  // pluie, eux, restent à l'heure.
  meteoIci() {
    const m = meteoDeLaNuit(this.heure, this.niveau);
    if (this.retardLumiere > 0) {
      const l = meteoDeLaNuit(this.heure - this.retardLumiere, this.niveau);
      Object.assign(m, { heure: l.heure, orage: l.orage, nuages: l.nuages, front: l.front, brume: l.brume });
    }
    return m;
  }

  // La trombe vient au début de la nuit, quand il reste un peu de lumière ; mais l'heure du
  // jeu avance vite (une heure en une minute et demie au crépuscule) et elle vit plus de
  // quatre minutes : pendant qu'elle est là, la lumière n'avance qu'au dixième de
  // l'horloge (on la voit encore se découper sur le ciel quand elle passe) ; une fois
  // partie, la nuit tombe, un peu plus vite que l'horloge, jusqu'à la rattraper.
  retarderLumiere(dt) {
    const ch = this.chapitre;
    const vitesse = (ch.a - ch.de) / ch.duree; // (heures de jeu par seconde)
    if (this.trombe && this.trombe.force > 0.05) this.retardLumiere = Math.min(3, this.retardLumiere + dt * vitesse * 0.9);
    else if (this.retardLumiere > 0) this.retardLumiere = Math.max(0, this.retardLumiere - dt * vitesse * 1.6);
  }

  lisserVitesse(dt, ctx) {
    const v = ctx.physique.vitesse;
    const l = (this.vitesseLissee ??= { x: v.x, z: v.z });
    const k = Math.min(1, dt / 20);
    l.x += (v.x - l.x) * k;
    l.z += (v.z - l.z) * k;
  }

  // Combien de secondes de nuit d'ici à cette heure du jeu (l'heure n'avance pas au même pas
  // dans chaque chapitre)
  secondesJusqua(heure) {
    let s = 0;
    let h = this.heure;
    for (let c = this.c; c < CHAPITRES.length && h < heure; c++) {
      const ch = CHAPITRES[c];
      const fin = Math.min(heure, ch.a);
      if (fin > h) s += ((fin - h) * ch.duree) / (ch.a - ch.de);
      h = Math.max(h, fin);
    }
    return s;
  }

  avancerHeure(dt, ctx) {
    const ch = this.chapitre;
    this.heure = Math.min(HEURE_AUBE, this.heure + (dt * (ch.a - ch.de)) / ch.duree);
    if (this.heure >= ch.a && this.c < CHAPITRES.length - 1) {
      this.c++;
      this.commencerChapitre(ctx);
    }
  }

  commencerChapitre(ctx) {
    const ch = this.chapitre;
    this.sauvegarde = this.instantane(ctx);
    if (ch.bulletin) this.dire(ch.bulletin, { emetteur: 'Kervalen Radio', canal: 16 });
    if (ch.dire) this.dire(typeof ch.dire === 'function' ? ch.dire(this, ctx) : ch.dire);
    const m = this.meteo;
    // (le carnet, comme un vrai journal de bord : le vent, et le baromètre)
    const baro = `baromètre ${Math.round(pressionDuJour(this.heure))} hPa, ${tendanceEnMots(tendance(this.heure))}`;
    this.ecrire(this.c === 0
      ? `Le soleil se couche. Vent ${directionEnMots(m.directionVent)} ${Math.round(m.vent)} nœuds, ${baro} : le front orageux approche.`
      : `${ch.titre}. Vent ${directionEnMots(m.directionVent)} ${Math.round(m.vent)} nœuds, ${baro}.`);
    this.emettre('chapitre', ch, this.c);
  }

  // Les feux de la côte (monde/feux.js) : quand le crépuscule a fini de tomber, Jos montre le
  // phare (si on ne l'a pas déjà reconnu soi-même) ; et quand on reconnaît un feu, il le
  // confirme — une fois chacun
  suivreFeux(ctx) {
    if (this.faits.has('feux') || this.heure < 21.45 || this.trombe || !this.radio.libre || this.silence) return;
    this.faits.add('feux');
    if (this.faits.has('feu-phare')) return;
    this.dire([
      'Regarde au nord, entre les grains : le phare de la pointe du Bec. Trois éclats, puis neuf secondes de nuit.',
      'Tant que tu le vois, tu sais où est la côte. Les autres feux sont dans le livre des feux, sur l\'étagère de la timonerie.',
    ], { siLibre: true });
  }

  feuReconnu(id, ctx) {
    const cle = `feu-${id}`;
    if (this.faits.has(cle) || id === 'etrange') return;
    this.faits.add(cle);
    if (this.silence || !this.radio.libre) return;
    const PHRASES = {
      phare: ['C\'est ça, le phare du Bec. Tant que tu le vois, tu sais où est la côte : au nord, à cinq ou six milles.'],
      'basse-du-bec': ['La Basse du Bec : une cardinale sud. Les roches sont au nord d\'elle. De nuit, passe toujours au sud.'],
      jetee: ['L\'entrée de Port-Kervalen : le vert à tribord, le rouge à bâbord, quand on entre. Pas cette nuit : on n\'entre pas dans un port par ce temps.'],
      'roche-rouge': ['La Roche Rouge, à l\'entrée du port : en entrant, tu la laisses à bâbord.'],
      semaphore: ['Tu vois ma fenêtre ? C\'est moi. Je ne dors pas.'],
    };
    if (PHRASES[id]) this.dire(PHRASES[id], { siLibre: true });
  }

  suivreMoments() {
    MOMENTS.forEach((mo, k) => {
      const id = `moment-${k}`;
      if (this.heure >= mo.heure && !this.faits.has(id)) {
        this.faits.add(id);
        this.dire(mo.dire, { siLibre: false });
      }
    });
  }

  // ---------- Les déferlantes ----------
  suivreDeferlantes(dt, ctx) {
    // (quand une vague scélérate arrive, les autres vagues se taisent : plus de déferlantes)
    const d = this.scelerates?.vague?.distance ?? Infinity;
    const calme = d < 420 && d > -220;
    const frappe = this.deferlantes.maj(dt, this.meteo, calme ? 0 : this.niveau.deferlantes);
    const a = this.deferlantes.annonce;
    if (a && a !== this.annonceVue) {
      this.annonceVue = a;
      a.force *= this.niveau.force;
      this.emettre('deferlante-annonce', a);
    }
    if (frappe) {
      const p = ctx.physique;
      const angle = p.deferlante(frappe.vers, frappe.force); // 0 : de face, 90 : de travers, 180 : de l'arrière
      // l'eau qui embarque : de travers, ou par l'arrière (le cockpit est « pooppé »)
      const r = (angle * Math.PI) / 180;
      const prise = angle < 90 ? 0.15 + 0.85 * Math.sin(r) : 0.75 + 0.25 * Math.sin(r);
      const litres = frappe.force * prise * 380;
      this.eau.cockpit = Math.min(EAU.cockpitMax, this.eau.cockpit + litres);
      // (et un peu passe toujours à l'intérieur : sous la porte, par les aérateurs)
      this.eau.cale += frappe.force * prise * (ctx.aBord.descenteOuverte ? 70 : 6);
      this.stats.deferlantes++;
      this.suiviCoup = { t: 4, gite: 0, force: frappe.force, angle, prise };
      this.emettre('deferlante', { ...frappe, angle, litres });
    }
    // on regarde ce qu'elle a fait au bateau dans les 4 secondes qui suivent
    const s = this.suiviCoup;
    if (s) {
      s.t -= dt;
      s.gite = Math.max(s.gite, Math.abs(ctx.m.gite));
      // emporté : le marin sur le pont, pas attaché, quand l'eau balaie le bateau couché
      if (ctx.aBord.dehors && !ctx.aBord.attache && s.prise > 0.6 && s.force > 0.5 && Math.abs(ctx.m.gite) > 65) {
        this.perdre('emporte', ctx);
        return;
      }
      if (s.t <= 0) {
        if (s.gite > 60) {
          this.stats.coups++;
          if (s.scelerate) this.stats.sceleratesCouche++;
          this.ecrire(`${s.scelerate ? 'La vague scélérate' : 'Une déferlante'} a couché le bateau à ${Math.round(s.gite)}°.`);
        } else if (s.scelerate) this.ecrire(`Passé la vague scélérate (gîte ${Math.round(s.gite)}°).`);
        if (s.scelerate && this.scelerates?.vague) this.scelerates.vague.couche = s.gite > 60;
        this.suiviCoup = null;
      }
    }
  }

  // ---------- L'eau à bord ----------
  suivreEau(dt, ctx) {
    const e = this.eau;
    const gite = Math.abs(ctx.m.gite);
    const ouverte = ctx.aBord.descenteOuverte;
    // le cockpit se vide par ses deux nables (lentement : d'autant plus vite qu'il est plein)
    e.cockpit = Math.max(0, e.cockpit - dt * 5 * Math.sqrt(e.cockpit / 500));
    // couché, il ramasse la mer par le bord qui trempe
    if (gite > 55) e.cockpit = Math.min(EAU.cockpitMax, e.cockpit + dt * (gite - 55) * 9);
    if (ouverte) {
      // descente ouverte : ce qui passe par-dessus le seuil descend dans la cabine, et le
      // bateau couché embarque des tonnes d'eau
      const coule = Math.max(0, e.cockpit - EAU.seuil) * 0.6 * dt;
      e.cockpit -= coule;
      e.cale += coule;
      if (gite > 75) e.cale += dt * (gite - 75) * 14;
    } else if (gite > 80) {
      e.cale += dt * (gite - 80) * 0.6; // les joints suintent
    }
    // le bateau « travaille » dans la tempête : il suinte de partout
    e.cale += dt * this.niveau.fuite * Math.max(0, (this.meteo.vent - 30) / 12) * 0.5;
    this.stats.caleMax = Math.max(this.stats.caleMax, e.cale);
    ctx.physique.eauCale = e.cale;
    ctx.physique.eauCockpit = e.cockpit;
    for (const [seuil, texte] of [[EAU.planchers, 'De l\'eau au-dessus des planchers.'], [700, 'L\'eau monte dans la cabine.'], [1300, 'Le bateau s\'alourdit dangereusement.']]) {
      if (e.cale > seuil && !this.alertesEau.has(seuil)) {
        this.alertesEau.add(seuil);
        this.ecrire(texte);
        this.emettre('eau', seuil);
      } else if (e.cale < seuil * 0.6) {
        this.alertesEau.delete(seuil);
      }
    }
    if (e.cale > EAU.naufrage) this.perdre('naufrage', ctx);
  }

  // un coup de pompe (le jeu sait combien de litres)
  pomper(litres) {
    const v = Math.min(this.eau.cale, litres);
    this.eau.cale -= v;
    this.stats.pompee += v;
    return v;
  }

  // ---------- Les avaries ----------
  suivreAvaries(dt, ctx) {
    const p = ctx.physique;
    const m = ctx.m;
    const av = this.avaries;
    const vent = m.ventApparent;
    const trop = Math.max(0, vent - 31) / 10;
    // trop de toile dans trop de vent : la voile se fatigue, puis se déchire ; et une
    // voile qui bat dans la tempête se déchire aussi
    if (av.grandVoile === 'ok' && p.ris < 3) {
      const surface = [1, 0.55, 0][p.ris];
      const bat = m.incidenceGV < 6 ? Math.max(0, vent - 28) / 14 : 0;
      this.fatigue.grandVoile += dt * (trop * surface / 70 + bat / 420) * this.niveau.avaries;
      if (this.fatigue.grandVoile >= 1) this.avarie('grandVoile', ctx);
    }
    if (av.foc === 'ok' && p.deroule > 0.05) {
      const surface = Math.max(0, (p.deroule - 0.4) / 0.6);
      const bat = (av.ecouteFoc === 'cassee' ? 1 : m.incidenceFoc < 6 ? 0.4 : 0) * Math.max(0, vent - 25) / 14;
      this.fatigue.foc += dt * (trop * surface / 60 + bat / 300) * this.niveau.avaries;
      if (this.fatigue.foc >= 1) this.avarie('foc', ctx);
    }
    // l'écoute de foc s'use contre le hauban, et casse au plus fort de la tempête ; le pilote
    // automatique force trop dans les vagues de l'arrière, et lâche. (Si la rafale d'un grain
    // arrive un peu avant l'heure, c'est elle qui les achève.)
    const rafale = (this.ici?.agitation ?? 0) > 0.45;
    const lHeure = (nom) => this.heure >= this.prevu[nom] || (rafale && this.heure >= this.prevu[nom] - 0.6);
    if (av.ecouteFoc === 'ok' && av.foc === 'ok' && lHeure('ecouteFoc') && p.deroule > 0.08) this.avarie('ecouteFoc', ctx, rafale);
    if (av.pilote === 'ok' && lHeure('pilote') && ctx.pilote) this.avarie('pilote', ctx, rafale);
    // ce qui est réglé (le foc roulé, la grand-voile affalée)
    if (av.ecouteFoc === 'cassee' && p.deroule < 0.03 && !this.faits.has('foc-roule')) {
      this.faits.add('foc-roule');
      this.dire(['C\'est bien, le foc est roulé, il ne battra plus. Quand tu pourras, va passer une nouvelle écoute au pied de l\'étai, tout à l\'avant. Harnais accroché !'], { siLibre: true });
    }
    if (av.grandVoile === 'dechiree' && p.ris >= 3 && !this.faits.has('gv-affalee')) {
      this.faits.add('gv-affalee');
      this.ecrire('Grand-voile déchirée affalée.');
    }
  }

  // (foudre : c'est la foudre, tombée sur le mât, qui l'a causée)
  avarie(nom, ctx, dansLaRafale = false, foudre = false) {
    const p = ctx.physique;
    this.avaries[nom] = nom === 'pilote' ? 'panne' : nom === 'ecouteFoc' ? 'cassee' : 'dechiree';
    const textes = {
      ecouteFoc: {
        journal: 'L\'écoute de foc a cassé (usée contre le hauban).',
        dire: ['Ton foc bat dans tous les sens, je l\'entends d\'ici ! L\'écoute a dû casser.', 'Roule-le entièrement, vite, avant qu\'il ne se déchire.'],
      },
      grandVoile: {
        journal: 'La grand-voile s\'est déchirée.',
        dire: ['Ta grand-voile s\'est déchirée ! Trop de vent dedans.', 'Affale-la : au pied du mât, fais-la descendre entièrement.'],
      },
      foc: {
        journal: 'Le foc s\'est déchiré.',
        dire: ['Ton foc s\'est déchiré ! Roule-le entièrement, il ne servira plus cette nuit.'],
      },
      pilote: foudre ? {
        journal: 'La foudre est tombée sur le mât : le pilote a disjoncté.',
        dire: ['La foudre est tombée sur ton mât ! Il l\'a menée jusqu\'à la quille, c\'est fait pour ça : à l\'intérieur, tu ne risques rien.', 'Mais ton pilote a disjoncté. Prends la barre, puis réarme-le au tableau électrique de la timonerie.'],
      } : {
        journal: 'Le pilote automatique a lâché.',
        dire: ['Ton pilote a lâché ? Dans cette mer, il force trop, ça arrive.', 'Prends la barre d\'abord. Ensuite, tu pourras réarmer son disjoncteur, au tableau électrique de la timonerie.'],
      },
    }[nom];
    if (nom === 'ecouteFoc') p.ecouteFocLibre = true;
    if (nom === 'grandVoile') p.grandVoileDechiree = true;
    if (nom === 'foc') p.focDechire = true;
    this.ecrire(dansLaRafale ? `${textes.journal.replace(/\.$/, '')}, dans la rafale d'un grain.` : textes.journal);
    this.dire(textes.dire, { urgent: true });
    this.emettre('avarie', nom);
  }

  // Réparer : passer une nouvelle écoute (à l'avant), réarmer le pilote (au tableau)
  reparer(nom, ctx) {
    const p = ctx.physique;
    if (nom === 'ecouteFoc' && this.avaries.ecouteFoc === 'cassee') {
      this.avaries.ecouteFoc = 'reparee';
      p.ecouteFocLibre = false;
      p.ecouteFoc = Math.min(1.2, Math.max(0.3, Math.abs(p.angleFoc)));
      this.ecrire('Nouvelle écoute de foc passée.');
      this.dire(['Bien joué, matelot. Tu peux redérouler un mouchoir de foc.'], { siLibre: true });
    } else if (nom === 'pilote' && this.avaries.pilote === 'panne') {
      this.avaries.pilote = 'ok';
      this.prevu.pilote = this.heure < 27 ? this.heure + 1.2 + this.hasard() : Infinity; // il peut relâcher…
      this.ecrire('Disjoncteur du pilote réarmé.');
    } else {
      return false;
    }
    this.emettre('reparee', nom);
    return true;
  }

  // ---------- Les vagues scélérates ----------
  suivreScelerates(dt, ctx) {
    if (!ctx.houle) return;
    this.scelerates ??= new Scelerates(ctx.houle);
    const sc = this.scelerates;
    const p = ctx.physique.position;
    if (!sc.active) {
      // l'heure venue, une vague naît au vent du bateau (elle attend que la trombe soit
      // partie, et que le cargo soit loin)
      const occupe = (this.trombe && this.trombe.force > 0.1 && this.trombe.distance < 2500) || (this.cargo && this.cargo.distance < 1800);
      for (let k = 0; k < 3 && !occupe; k++) {
        const nom = `scelerate${k}`;
        if (this.faits.has(nom) || !(this.heure >= this.prevu[nom])) continue;
        this.faits.add(nom);
        this.lancerScelerate(k, ctx);
        break;
      }
      if (this.aLancer && !sc.active) this.lancerScelerate(this.aLancer.numero, ctx, this.aLancer);
      this.aLancer = null;
    }
    if (!sc.active) return;
    for (const etape of sc.maj(dt, p.x, p.z)) this.etapeScelerate(etape, ctx);
  }

  // Une vague naît : du côté du vent (la dernière, d'un côté plus inattendu)
  lancerScelerate(k, ctx, { depuis = null, hauteur = null } = {}) {
    const h = this.hasardScelerate;
    const ecart = (k === 2 ? 34 + 14 * h() : 10 + 18 * h()) * (h() < 0.5 ? -1 : 1);
    const de = depuis ?? (this.meteo.directionVent + ecart + 360) % 360; // d'où elle vient (cap)
    const vers = ((de + 180) * Math.PI) / 180;
    const haut = hauteur ?? (this.niveau.hauteurScelerate ?? 20) + (h() - 0.5) * 1.4;
    const p = ctx.physique.position;
    const w = this.scelerates.lancer({ x: p.x, z: p.z, dx: Math.sin(vers), dz: -Math.cos(vers), hauteur: haut });
    w.depuis = de;
    w.numero = k;
    this.stats.scelerates++;
    this.emettre('scelerate-nee', w);
  }

  // Une vague tout de suite (pour vérifier) : depuis (cap d'où elle vient) et hauteur, si
  // on veut les choisir
  provoquerScelerate({ depuis = null, hauteur = null } = {}) {
    this.aLancer = { numero: 0, depuis, hauteur };
  }

  etapeScelerate(etape, ctx) {
    const w = this.scelerates.vague;
    if (!w) return;
    const relatif = ecartAngle(w.depuis, ctx.m.cap);
    const metres = Math.round(w.v.hauteur);
    if (etape === 'grondement') this.emettre('scelerate-grondement', w);
    else if (etape === 'annonce') {
      const de = directionEnMots(w.depuis);
      this.ecrire(`Une vague énorme (${metres} m) arrive ${/^[eo]/.test(de) ? 'de l\'' : 'du '}${de}.`);
      // (pendant le silence, Jos essaie… on ne reçoit que des bribes)
      if (this.silence) {
        this.radio.fantome?.('… ague … …orme … dans ton arr… … tiens-t…', { canal: 72, duree: 5 });
        this.emettre('scelerate', { ...w, relatif, sansJos: true });
        return;
      }
      this.dire([
        `${NOM_BATEAU}, ${NOM_BATEAU}, ici ${JOS} ! La bouée du large vient de mesurer une vague de ${metres} mètres. Elle arrive sur toi, ${directionRelative(relatif)}. Dans une minute !`,
        'Mets-la droit dans ton arrière, et ne la prends surtout pas de travers ! Accroche-toi, et ferme la porte !',
      ], { urgent: true });
      this.emettre('scelerate', { ...w, relatif });
    } else if (etape === 'proche') this.emettre('scelerate-proche', { ...w, relatif });
    else if (etape === 'eclair') this.emettre('scelerate-eclair', w);
    else if (etape === 'trou') this.emettre('scelerate-trou', w);
    else if (etape === 'choc') {
      const c = chocScelerate(ctx.physique, this.scelerates, { porteOuverte: ctx.aBord.descenteOuverte });
      this.eau.cockpit = Math.min(EAU.cockpitMax, this.eau.cockpit + c.cockpit);
      this.eau.cale += c.interieur;
      // (le suivi : couché ou pas, emporté si l'on est sur le pont sans harnais ; la force
      // compte comme une très grosse déferlante)
      this.suiviCoup = { t: 6, gite: 0, force: 1.3, angle: c.angle, prise: c.prise, scelerate: true };
      // (le pilote peut lâcher : la barre arrachée par la vague — moins souvent si on l'a
      // bien prise par l'arrière)
      if (ctx.pilote && this.avaries.pilote === 'ok' && this.hasardScelerate() < (c.angle > 150 ? 0.15 : 0.4)) this.avarie('pilote', ctx);
      this.emettre('scelerate-choc', { ...c, vers: this.scelerates.direction(), relatif });
    } else if (etape === 'passee') {
      this.emettre('scelerate-passee', w);
      if (this.silence) return;
      this.dire([w.couche
        ? `${NOM_BATEAU} ? ${NOM_BATEAU}, tu me reçois ? … Elle t'a couché, hein. Respire. Regarde ton bateau : pompe, et vérifie tes voiles et ton pilote.`
        : `${NOM_BATEAU} ? Tu m'entends ? … Tu es passé. Bien joué, matelot. Garde un œil derrière toi : il peut y en avoir d'autres.`], { urgent: true });
    }
  }

  // ---------- La bête : la trombe marine du crépuscule ----------
  // Elle naît de son grain (lancerGrainBete), à son heure : sous l'avant de son nuage, là où
  // l'air chaud monte, sur le bord de sa rafale — à l'endroit de cet avant d'où, avançant
  // avec lui, elle passera derrière le bateau deux minutes plus tard s'il ne change rien (à
  // 250 m : on la sent passer), et sur lui s'il ralentit ou part du mauvais côté. Il faut
  // lofer et filer de travers au vent, sur le même bord, pour la laisser loin.
  suivreTrombe(dt, ctx) {
    const p = ctx.physique.position;
    // (avant qu'elle naisse, son grain se charge : ses éclairs se multiplient — le « saut
    // d'éclairs », que les météorologues guettent avant les trombes)
    const gb = this.grainBete;
    if (gb && !this.trombe && !this.faits.has('trombe') && this.grains.liste.includes(gb)) {
      const dans = this.secondesJusqua(this.prevu.trombe);
      gb.saut = 1 + 0.6 * lisse(45, 5, dans);
      // (et il glisse, sans qu'on le voie, vers là où il doit être quand elle naîtra — selon
      // la route que le bateau a maintenant —, à 1,5 m/s au plus)
      const ici = this.placeDuGrainBete(ctx, dans, gb.rayon);
      const ex = ici.x - (gb.x + gb.vx * dans);
      const ez = ici.z - (gb.z + gb.vz * dans);
      const e = Math.hypot(ex, ez) || 1;
      const vitesse = Math.min(1.5, e / Math.max(dans, 15));
      gb.glisse = dans > 3 ? { x: (ex / e) * vitesse, z: (ez / e) * vitesse } : null;
    }
    if (!this.trombe && !this.faits.has('trombe') && this.heure >= this.prevu.trombe) {
      this.faits.add('trombe');
      this.naitreBete(ctx);
    }
    const t = this.trombe;
    if (!t) return;
    t.age += dt;
    // elle avance avec son grain (sans lui, avec le vent), en serpentant un peu sous lui
    if (t.grain && !this.grains.liste.includes(t.grain)) t.grain = null; // (un saut dans le temps l'a emporté)
    const g = t.grain;
    let ux;
    let uz;
    let V = t.vitesse;
    if (g) {
      V = Math.hypot(g.vx, g.vz) || 1;
      ux = g.vx / V;
      uz = g.vz / V;
    } else {
      const a = angleVers(this.meteo.directionVent);
      ux = Math.cos(a);
      uz = Math.sin(a);
    }
    // (de part et d'autre de sa route : ±22 m, en deux minutes et demie)
    const w = (Math.cos(t.age * 0.045) * 8 * Math.PI) / 180;
    t.vx = (ux * Math.cos(w) - uz * Math.sin(w)) * V;
    t.vz = (uz * Math.cos(w) + ux * Math.sin(w)) * V;
    t.x += t.vx * dt;
    t.z += t.vz * dt;
    t.force = lisse(0, 15, t.age) * (1 - lisse(t.duree - 30, t.duree, t.age));
    t.distance = Math.hypot(p.x - t.x, p.z - t.z);
    if (g) {
      // la pluie de son grain s'enroule autour d'elle, à mesure que son tourbillon
      // s'organise (le crochet : sur le radar, et en rideaux de pluie sur sa droite) ;
      // derrière elle, le cœur du grain, sur lequel elle se découpe
      g.crochet ??= {};
      Object.assign(g.crochet, { x: t.x, z: t.z, ux, uz, force: t.force * lisse(5, 45, t.age) });
      // (ses éclairs à elle prennent le relais du saut d'éclairs de son grain)
      g.saut = 1 + 0.6 * (1 - lisse(10, 70, t.age));
    }
    this.stats.trombeDistance = Math.min(this.stats.trombeDistance, t.distance);
    // elle approche : Jos crie (une fois), puis elle frappe, ou elle passe
    if (t.distance < 450 && t.force > 0.5 && !t.alerte) {
      t.alerte = true;
      this.dire(['Elle arrive sur toi ! Accroche ton harnais, et tiens-toi ! Écarte-toi d\'elle, vite !'], { urgent: true });
      this.emettre('trombe-proche');
    }
    if (t.distance < RAYON_TOUCHE && t.force > 0.5 && !t.touche) {
      t.touche = true;
      this.stats.trombeTouche = true;
      this.ecrire('La trombe est passée sur le bateau !');
      this.emettre('trombe-touche', { force: t.force });
      // (le tourbillon arrache tout : la grand-voile si elle est hissée ; le pilote, peut-être)
      if (ctx.physique.ris < 3 && this.avaries.grandVoile === 'ok') this.fatigue.grandVoile += 1.0;
      if (ctx.pilote && this.avaries.pilote === 'ok' && this.hasard() < 0.4) this.avarie('pilote', ctx);
    }
    if (t.alerte && !t.passee && t.distance > 320 && this.stats.trombeDistance < 260) {
      t.passee = true;
      this.dire([t.touche
        ? 'Tu m\'entends ? Elle t\'est passée dessus… Regarde si tout tient : les voiles, le pilote. Et pompe, tu as embarqué.'
        : 'Elle est passée tout près… Bien joué. Reprends ta route, mais garde un œil dessus.'], { siLibre: false });
    }
    if (t.age > t.duree) {
      this.trombe = null;
      if (g) g.crochet = null;
      this.ecrire('La trombe s\'est dissipée.');
    }
  }

  // La bête naît, sous l'avant de son grain
  naitreBete(ctx) {
    const p = ctx.physique.position;
    const v = this.vitesseLissee ?? ctx.physique.vitesse;
    const decale = (this.hasard() - 0.5) * 40;
    // (son grain — si l'on a sauté dans le temps, ou s'il est parti : il est là, maintenant)
    const g = this.grainBete && this.grains.liste.includes(this.grainBete) ? this.grainBete : this.lancerGrainBete(ctx);
    g.glisse = null;
    const V = Math.hypot(g.vx, g.vz) || 1;
    const ux = g.vx / V;
    const uz = g.vz / V;
    // où, sur l'avant du grain (b, de sa gauche à sa droite), pour qu'elle passe derrière le
    // bateau à « ecart » mètres (à « decale » près) s'il garde sa route : là où, sur la
    // perpendiculaire n à sa route relative, elle est à « ecart » mètres de lui
    const { nx, nz } = placeDeLaBete(ux, uz, V, v, 0);
    const F = this.grains.avant(g, 0, {});
    const rn = -uz * nx + ux * nz;
    const fn = (F.x - p.x) * nx + (F.z - p.z) * nz;
    const b = Math.abs(rn) < 0.05 ? 0 : Math.max(-PORTEUR.cote, Math.min(PORTEUR.cote, (BETE.ecart + decale - fn) / (g.rayon * rn)));
    const s = this.grains.avant(g, b, {});
    this.trombe = {
      x: s.x, z: s.z, vx: g.vx, vz: g.vz, vitesse: V, age: 0, duree: BETE.duree, force: 0, distance: Infinity, touche: false,
      grain: g, cote: b,
    };
    // (Jos parle d'elle : son grain n'a plus besoin d'être annoncé)
    g.faits.vu = true;
    g.faits.annonce = true;
    const relatif = ecartAngle(this.releveDe(s.x, s.z, ctx), ctx.m.cap);
    this.ecrire('Une trombe marine naît sous le grain, au vent !');
    this.dire([
      `${NOM_BATEAU} ! Le grain, ${directionRelative(relatif)} : regarde sous l'avant de son nuage, l'eau tourne… Une trombe ! Elle va avancer avec lui, vers toi.`,
      'N\'essaie pas de la distancer, elle va plus vite que toi. Écarte-toi de sa route : lofe, file de travers au vent, sans changer de bord !',
    ], { urgent: true });
    this.emettre('trombe', this.trombe);
  }

  // La route du grain de la bête (avec le vent qu'il fera quand elle naîtra)
  routeDuGrainBete() {
    const m = meteoDeLaNuit(Math.max(this.heure, this.prevu.trombe), this.niveau);
    const a = angleVers(m.directionVent + PORTEUR.derive);
    return { ux: Math.cos(a), uz: Math.sin(a) };
  }

  // Où doit être le centre du grain de la bête quand elle naîtra (dans « dans » secondes),
  // pour qu'elle naisse sous son avant à la bonne place (placeDeLaBete) — si le bateau garde
  // la route qu'il a maintenant
  placeDuGrainBete(ctx, dans, rayon) {
    const p = ctx.physique.position;
    const v = this.vitesseLissee ?? ctx.physique.vitesse;
    const { ux, uz } = this.routeDuGrainBete();
    const q = placeDeLaBete(ux, uz, PORTEUR.vitesse, v, BETE.ecart);
    return {
      x: p.x + v.x * dans + q.x - ux * PORTEUR.avant * rayon,
      z: p.z + v.z * dans + q.z - uz * PORTEUR.avant * rayon,
      rayon,
    };
  }

  // Le grain de la bête : on le découvre au coucher du soleil, au vent, déjà formé. Il est là
  // où il faut pour qu'à l'heure de la trombe, l'avant de son nuage soit à moins d'un
  // kilomètre du bateau (là d'où elle passera derrière lui s'il garde sa route :
  // naitreBete). Il traîne : moins vite que les autres grains, droit sous le vent
  // (monde/grains.js : PORTEUR)
  lancerGrainBete(ctx) {
    const dans = this.faits.has('trombe') ? 0 : Math.max(0, this.secondesJusqua(this.prevu.trombe));
    const { ux, uz } = this.routeDuGrainBete();
    const force = BETE.force * (this.niveau.grains ?? 1);
    const ici = this.placeDuGrainBete(ctx, dans, 650 + force * 450);
    const age = 150 + this.hasardBete() * 60;
    const g = this.grains.porteur({
      // (porteur() veut la place de la trombe, sous son avant : on la lui donne)
      x: ici.x - ux * PORTEUR.vitesse * dans + ux * PORTEUR.avant * ici.rayon,
      z: ici.z - uz * PORTEUR.vitesse * dans + uz * PORTEUR.avant * ici.rayon,
      ux, uz, force, orage: BETE.orage,
      age, duree: age + dans + BETE.duree + 160,
    });
    g.plan = this.plansGrains.findIndex((x) => x.bete);
    g.bete = true;
    g.faits.annoncer = true;
    g.faits.depuis = this.t;
    this.grainBete = g;
    return g;
  }

  // Le vent tourbillonnant de la trombe au point (x, z) du monde (m/s, à ajouter au vent) :
  // un tourbillon (de Rankine : il croît jusqu'au bord du cœur, puis décroît), qui tourne
  // dans le sens inverse des aiguilles d'une montre, et aspire un peu vers son centre
  ventTrombe(x, z, sortie = new Vector3()) {
    sortie.set(0, 0, 0);
    const t = this.trombe;
    if (!t || t.force <= 0) return sortie;
    const dx = x - t.x;
    const dz = z - t.z;
    const d = Math.max(1, Math.hypot(dx, dz));
    const coeur = BETE.coeur;
    const vmax = BETE.vmax * t.force; // ~74 nœuds au bord du cœur
    const v = (d < coeur ? (vmax * d) / coeur : (vmax * coeur) / d) * (1 - lisse(300, 600, d));
    return sortie.set((dz / d) * v - (dx / d) * v * 0.3, 0, (-dx / d) * v - (dz / d) * v * 0.3);
  }

  // La pression de la trombe au point (x, z) (hPa, à ajouter) : l'air qui tourne vite autour
  // d'elle est retenu par la dépression qu'elle a en son cœur (la force qui le ramène vers le
  // centre, c'est elle). Pour ce tourbillon : 17 hPa de moins en son centre ; à 150 m, un
  // hectopascal ; au-delà de 300 m, presque rien
  pressionTrombe(x, z) {
    const t = this.trombe;
    if (!t || t.force <= 0) return 0;
    const d = Math.hypot(x - t.x, z - t.z);
    if (d > 600) return 0;
    const c = BETE.coeur;
    const v = BETE.vmax * t.force;
    const k = d < c ? 1 - (d * d) / (2 * c * c) : (c * c) / (2 * d * d);
    // (ρ v², en pascals : l'air pèse 1,2 kg le mètre cube ; 100 Pa = 1 hPa)
    return (-1.2 * v * v * k * (1 - lisse(300, 600, d))) / 100;
  }

  // ---------- Les grains ----------
  suivreGrains(dt, ctx) {
    const p = ctx.physique.position;
    const v = ctx.physique.vitesse;
    // ceux qui viendront sur nous : lancés à leur heure (celui de la bête, s'il n'est pas
    // trop tard : elle n'est pas encore née)
    this.plansGrains.forEach((plan, k) => {
      const id = `grain${k}`;
      if (this.faits.has(id) || this.heure < this.prevu[id]) return;
      this.faits.add(id);
      if (!plan.bete) this.lancerGrain(plan, ctx, DANS_GRAIN, k);
      else if (!this.trombe && !this.faits.has('trombe')) this.lancerGrainBete(ctx);
    });
    this.grains.maj(dt, this.meteo, p.x, p.z, v.x, v.z);
    const ici = (this.ici = this.grains.mesurer(p.x, p.z, this.ici ?? {}));
    // celui de la bête : on le voit dès que Jos a fini de parler (au radar, et à l'œil : un
    // rideau noir au vent), et Jos l'annonce
    const gb = this.grainBete;
    if (gb && !this.trombe && this.grains.liste.includes(gb) && (this.radio.libre || this.t - gb.faits.depuis > 20)) {
      if (!gb.faits.vu) this.voirGrainBete(gb, ctx);
      if (!gb.faits.annonce) this.annoncerGrainBete(gb, ctx);
    }
    // celui qui vient sur nous : à moins de 3,3 km, on le voit (le radar, l'écran, le
    // journal) ; Jos l'annonce dès que la radio est libre, ou en coupant la parole s'il est
    // déjà près
    const m = this.grains.menace(p.x, p.z, v.x, v.z, { horizon: 260, cpaMax: 1300 });
    if (m && !m.grain.faits.vu && m.distance < 3300) this.voirGrain(m, ctx);
    this.menaceGrain = m && m.grain.faits.vu && !m.grain.faits.rafale ? m : null;
    if (m && m.grain.faits.vu && !m.grain.faits.annonce && (m.distance < 1600 || this.radio.libre)) this.annoncerGrain(m, ctx);
    // sa rafale arrive sur nous
    const g = ici.grain;
    if (g && ici.agitation > 0.3 && !g.faits.rafale) {
      g.faits.rafale = true;
      g.faits.ventMax = 0;
      this.stats.grains++;
      this.emettre('grain-rafale', g);
    }
    // (le vent le plus fort sous le grain : le vent du moment, plus celui du grain)
    if (g?.faits.rafale && !g.faits.passe) {
      const a = angleVers(this.meteo.directionVent);
      const vx = Math.cos(a) * this.meteo.vent * 0.5144 + ici.vent.x;
      const vz = Math.sin(a) * this.meteo.vent * 0.5144 + ici.vent.z;
      g.faits.ventMax = Math.max(g.faits.ventMax, Math.hypot(vx, vz) / 0.5144);
      this.stats.rafaleMax = Math.max(this.stats.rafaleMax, g.faits.ventMax);
    }
    // il est passé : on est derrière lui, sa rafale est finie, la pluie se calme
    for (const x of this.grains.liste) {
      if (!x.faits.rafale || x.faits.passe) continue;
      const derriere = (p.x - x.x) * x.vx + (p.z - x.z) * x.vz < 0;
      if (derriere && (ici.grain !== x || ici.agitation < 0.1) && ici.pluie < 0.7) {
        x.faits.passe = true;
        this.ecrire(`Le grain est passé${x.faits.ventMax ? ` (rafales à ${Math.round(x.faits.ventMax)} nœuds)` : ''}.`);
        this.emettre('grain-passe', x);
        if (x.prevu && x.faits.annonce && x.faits.annoncer && !this.silence && this.hasardGrains() < 0.6) {
          this.dire([this.hasardGrains() < 0.5
            ? 'Il est passé. Derrière lui, le vent va mollir un moment : n\'en profite pas pour renvoyer de la toile, il en viendra d\'autres.'
            : 'Le grain est passé. Bien tenu, matelot.'], { siLibre: true });
        }
      }
    }
  }

  lancerGrain(plan, ctx, dans, k) {
    const p = ctx.physique.position;
    const v = ctx.physique.vitesse;
    const g = this.grains.lancer({
      x: p.x, z: p.z, vbx: v.x, vbz: v.z, dans,
      force: plan.force * (this.niveau.grains ?? 1), orage: plan.orage, ecart: plan.ecart,
    });
    g.plan = k;
    g.dans = dans;
    g.faits.annoncer = plan.annonce !== false;
    return g;
  }

  // Où est le point (x, z), vu du bateau (degrés compas)
  releveDe(x, z, ctx) {
    const p = ctx.physique.position;
    return ((Math.atan2(x - p.x, -(z - p.z)) * 180) / Math.PI + 360) % 360;
  }

  // D'où vient le grain, vu du bateau (degrés compas)
  releveGrain(g, ctx) {
    const c = this.grains.noyau(g, g.noyaux[0], {});
    return this.releveDe(c.x, c.z, ctx);
  }

  // Un grain vient sur nous : on le voit au radar (l'écran le dit, le journal le note)
  voirGrain(m, ctx) {
    const g = m.grain;
    if (g.bete) return this.voirGrainBete(g, ctx);
    g.faits.vu = true;
    const releve = this.releveGrain(g, ctx);
    this.emettre('grain', { grain: g, releve, relatif: ecartAngle(releve, ctx.m.cap), distance: m.distance, dans: m.dans, cpa: m.cpa });
    this.ecrire(`Un grain ${aLaDirection(releve)}, à ${millesEnMots(m.distance)} : il vient sur nous.`);
  }

  // Le grain de la bête : on le voit (l'écran le dit, le journal le note)
  voirGrainBete(g, ctx) {
    g.faits.vu = true;
    const p = ctx.physique.position;
    const c = this.grains.noyau(g, g.noyaux[0], {});
    const distance = Math.hypot(c.x - p.x, c.z - p.z);
    const releve = this.releveDe(c.x, c.z, ctx);
    this.emettre('grain', { grain: g, bete: true, releve, relatif: ecartAngle(releve, ctx.m.cap), distance, dans: null, cpa: null });
    this.ecrire(`Un grain ${aLaDirection(releve)}, à ${millesEnMots(distance)}, plein d'éclairs : il avance moins vite que les autres.`);
  }

  // Jos le voit sur son radar, et il n'aime pas ça
  annoncerGrainBete(g, ctx) {
    g.faits.annonce = true;
    if (this.silence) return;
    const p = ctx.physique.position;
    const c = this.grains.noyau(g, g.noyaux[0], {});
    this.dire([
      `${NOM_BATEAU}, regarde dans ton ${directionEnMots(this.releveDe(c.x, c.z, ctx))}, à ${millesEnMots(Math.hypot(c.x - p.x, c.z - p.z))} : un grain. Tu dois le voir d'où tu es : un rideau de pluie noire, sous un gros nuage plein d'éclairs.`,
      'Celui-là, je n\'aime pas sa tête. Sur mon radar, il traîne : il avance moins vite que les autres. C\'est sous ces grains-là que naissent les trombes. Garde un œil dessus.',
    ]);
  }

  // Jos le voit sur son radar : d'où il vient, à quelle distance, ce qu'il y aura dessous,
  // et ce qu'il faut faire
  annoncerGrain(m, ctx) {
    const g = m.grain;
    if (g.bete) return this.annoncerGrainBete(g, ctx);
    g.faits.annonce = true;
    const releve = this.releveGrain(g, ctx);
    if (!g.faits.annoncer || this.silence) return;
    const rafale = this.meteo.vent + g.force * 15;
    const pret = toilePrete(ctx.physique, rafale);
    const phrases = [
      `${NOM_BATEAU}, un grain dans ton ${directionEnMots(releve)}, à ${millesEnMots(m.distance)}. ${m.cpa < 500 ? 'Il vient droit sur toi.' : 'Il va passer tout près de toi.'}`,
      pret
        ? `Dessous, ça soufflera à ${Math.round(rafale / 5) * 5} nœuds dans les rafales, et il pleuvra à verse. Ta toile est bonne : garde les vagues dans l'arrière, et laisse-le passer.`
        : `Dessous, ça soufflera à ${Math.round(rafale / 5) * 5} nœuds dans les rafales. Réduis maintenant, pas quand il sera sur toi : ${rafale >= 34 ? 'la grand-voile affalée, un mouchoir de foc' : 'deux ris, le foc presque roulé'}.`,
    ];
    if (g.orage > 0.6) phrases.push('Et il est plein d\'éclairs : quand il passera, ne touche ni au mât ni aux haubans.');
    this.dire(phrases, { siLibre: m.distance > 1600, urgent: m.distance <= 1600 });
  }

  // Le vent des grains au point (x, z) (m/s, à ajouter au vent, comme celui de la trombe)
  ventGrains(x, z, sortie = new Vector3()) {
    return this.grains.ventEn(x, z, sortie);
  }

  // ---------- Le baromètre ----------
  // La pression ici : celle de la dépression qui arrive (elle baisse bien avant que le vent
  // forcisse, touche le fond quand le front passe, puis remonte d'un coup), la marée
  // barométrique, le bond des grains, quand arrive leur rafale (monde/pression.js,
  // monde/grains.js), et le creux de la trombe, quand elle passe tout près (pressionTrombe).
  // Le baromètre du bord la montre (jeu.js) ; Jos s'en sert.
  suivreBarometre(dt, ctx) {
    const p = ctx.physique.position;
    this.pression = pressionDuJour(this.heure) + this.grains.pressionEn(p.x, p.z) + this.pressionTrombe(p.x, p.z);
    if (this.pression < (this.stats.pressionMin ?? Infinity)) {
      this.stats.pressionMin = this.pression;
      this.stats.heurePressionMin = this.heure;
    }
  }

  // ---------- La foudre ----------
  // Elle part des nuages des grains et de celui de la trombe (monde/foudre.js) ; le jeu en
  // fait le bruit et la lumière, la nuit en tire les conséquences : le journal, ce que Jos en
  // dit, et la foudre sur le mât, qui fait disjoncter le pilote.
  suivreFoudre(dt, ctx) {
    const p = ctx.physique.position;
    const f = this.foudre;
    f.maj(dt, { meteo: this.meteo, grains: this.grains, trombe: this.trombe, x: p.x, z: p.z, ecoute: ctx.ecoute ?? null });
    for (const ev of f.evenements) {
      if (ev.type === 'eclair' && ev.eclair.type !== 'front') {
        this.stats.eclairs++;
        this.stats.eclairPlusPres = Math.min(this.stats.eclairPlusPres ?? Infinity, ev.distance);
        // la première fois qu'un éclair tombe à quelques kilomètres : Jos apprend à compter
        if (!this.faits.has('compter') && ev.distance < 6000 && ev.eclair.visible && this.radio.libre && !this.silence && this.commence) {
          this.faits.add('compter');
          this.dire([
            'Tu as vu cet éclair ? Compte les secondes jusqu\'au tonnerre : trois secondes, un kilomètre.',
            'S\'il se rapproche d\'un éclair à l\'autre, l\'orage vient sur toi.',
          ], { siLibre: true });
        }
      } else if (ev.type === 'frappe') this.frappeFoudre(ev, ctx);
    }
    // le feu de Saint-Elme : sous le cœur d'un nuage d'orage, dans le noir, une lueur
    // violette s'allume en tête de mât (la première fois : le journal, et Jos s'il peut)
    if (f.champ > 0.6 && !this.faits.has('saintElme') && this.heure > 20.2 && ctx.aBord?.dehors !== false) {
      this.faits.add('saintElme');
      this.ecrire('Une lueur violette en tête de mât : le feu de Saint-Elme.');
      if (this.radio.libre && !this.silence) {
        this.dire([
          'Tu vois une lueur, en haut de ton mât ? C\'est le feu de Saint-Elme : l\'air est chargé d\'électricité.',
          'Les anciens disaient que c\'était bon signe. Moi je te dis que la foudre n\'est pas loin : ne touche pas aux haubans.',
        ], { siLibre: true });
      }
      this.emettre('saint-elme');
    }
  }

  // La foudre tombe tout près du bateau, ou sur lui
  frappeFoudre(ev, ctx) {
    this.stats.frappes++;
    this.emettre('frappe', ev);
    if (ev.surLeMat) {
      this.stats.surLeMat++;
      // (le mât l'a menée jusqu'à la quille ; le courant qui passe fait sauter le disjoncteur
      // du pilote — et le radar redémarre)
      if (this.avaries.pilote === 'ok') this.avarie('pilote', ctx, false, true);
      else {
        this.ecrire('La foudre est tombée sur le mât !');
        this.dire(['La foudre est tombée sur ton mât ! Il l\'a menée jusqu\'à la quille, c\'est fait pour ça. Tu n\'as rien ?'], { urgent: true });
      }
      return;
    }
    this.ecrire(`La foudre est tombée à ${Math.max(10, Math.round(ev.distance / 10) * 10)} m du bateau.`);
    // (tout près : Jos l'a vue tomber sur son radar… ou l'a entendue dans sa radio)
    if (ev.distance < 300 && !this.faits.has('frappeProche') && !this.silence) {
      this.faits.add('frappeProche');
      this.dire(['Ça va ? Celle-là est tombée tout près de toi. Reste à l\'abri, et ne touche à rien de métallique.'], { siLibre: true });
    }
  }

  // ---------- Le cargo (vers 22 h 30) ----------
  suivreCargo(dt, ctx) {
    const p = ctx.physique.position;
    if (!this.cargo && !this.faits.has('cargo') && this.heure >= this.prevu.cargo) {
      this.faits.add('cargo');
      this.lancerCargo(ctx);
    }
    const c = this.cargo;
    if (!c) return;
    // il vient doucement au cap voulu
    c.cap += Math.max(-c.virage * dt, Math.min(c.virage * dt, ecartAngle(c.capVise, c.cap)));
    const r = (c.cap * Math.PI) / 180;
    const vx = Math.sin(r) * c.vitesse;
    const vz = -Math.cos(r) * c.vitesse;
    c.x += vx * dt;
    c.z += vz * dt;
    // la distance au bateau : à la coque du cargo (un segment de 180 m, 28 m de large)
    const ax = Math.sin(r);
    const az = -Math.cos(r);
    const rx = p.x - c.x;
    const rz = p.z - c.z;
    const long = Math.max(-90, Math.min(90, rx * ax + rz * az));
    c.distance = Math.max(0, Math.hypot(rx - ax * long, rz - az * long) - 14);
    this.stats.cargoDistance = Math.min(this.stats.cargoDistance, c.distance);
    // le point de rapprochement (mouvement relatif)
    const v = ctx.physique.vitesse;
    const wx = vx - v.x;
    const wz = vz - v.z;
    const w2 = Math.max(1e-6, wx * wx + wz * wz);
    c.tcpa = (rx * wx + rz * wz) / w2;
    c.cpa = Math.hypot(-rx + wx * c.tcpa, -rz + wz * c.tcpa);
    // il ne nous a pas vus : à moins d'un kilomètre, sa veille aperçoit enfin nos feux
    // (s'ils sont allumés…), il sonne cinq coups brefs et vire en grand
    const vu = ctx.aBord.feux ? 950 : 420;
    if (c.etat === 'route' && c.distance < vu && c.cpa < 350 && c.tcpa > 0) {
      c.etat = 'evite';
      c.capVise = c.cap + 70 * this.cotePourPasserDerriere(c, ctx);
      c.virage = 1.6;
      this.ecrire('Le cargo a sonné cinq coups brefs et viré au dernier moment.');
      this.emettre('cargo-klaxon', c);
    }
    if (c.distance < 4) {
      this.perdre('collision', ctx);
      return;
    }
    if (c.tcpa < 0 && c.distance > 3200) {
      this.cargo = null;
      this.ecrire(`Le cargo est passé à ${Math.round(this.stats.cargoDistance / 10) * 10} m.`);
      this.emettre('cargo-passe');
    }
  }

  lancerCargo(ctx) {
    const p = ctx.physique.position;
    // sa route croise la nôtre : il serait sur nous dans 4 minutes si personne ne bouge
    const v = ctx.physique.vitesse;
    const avance = Math.hypot(v.x, v.z) > 1 ? v.clone().setY(0) : ctx.physique.avant.setY(0).normalize().multiplyScalar(3);
    const capBateau = (Math.atan2(avance.x, -avance.z) * 180) / Math.PI;
    const cap = (capBateau + (this.hasard() < 0.5 ? 90 : -90) + (this.hasard() - 0.5) * 40 + 360) % 360;
    const vitesse = 7.5; // 14,5 nœuds
    const T = 240;
    const r = (cap * Math.PI) / 180;
    this.cargo = {
      nom: 'Ar Men',
      x: p.x + avance.x * T - Math.sin(r) * vitesse * T,
      z: p.z + avance.z * T + Math.cos(r) * vitesse * T,
      cap, capVise: cap, virage: 0, vitesse, etat: 'route', distance: Infinity, cpa: 0, tcpa: T,
    };
    const c = this.cargo;
    const releve = (Math.atan2(c.x - p.x, -(c.z - p.z)) * 180) / Math.PI;
    const milles = Math.hypot(c.x - p.x, c.z - p.z) / 1852;
    this.ecrire('Un cargo en route de collision.');
    this.dire([
      `${NOM_BATEAU}, ici ${JOS}. Je vois sur mon radar un cargo à ${milles < 1.3 ? 'un mille' : `${Math.round(milles)} milles`} de toi, ${directionRelative(ecartAngle(releve, ctx.m.cap))}. Il fait route ${aLaDirection(cap)}, droit sur toi.`,
      'Dans cette mer, il ne t\'a sûrement pas vu. Appelle-le sur le canal seize : la radio, dans la timonerie, à droite du siège ! Tu le verras aussi sur ton radar.',
    ], { urgent: true });
    this.emettre('cargo', c);
  }

  // De quel côté le cargo doit-il venir pour passer derrière le voilier ? (+1 : tribord)
  // Si le voilier traverse sa route de bâbord vers tribord, il vient sur bâbord, et
  // inversement : il passe toujours là où le voilier n'est déjà plus.
  cotePourPasserDerriere(c, ctx) {
    const r = (c.cap * Math.PI) / 180;
    const v = ctx.physique.vitesse;
    const lateral = v.x * Math.cos(r) + v.z * Math.sin(r); // vers le tribord du cargo
    return lateral > 0 ? -1 : 1;
  }

  // Le joueur appelle le cargo sur le canal 16 (à la radio du bord)
  appelerCargo(ctx) {
    const c = this.cargo;
    if (!c || c.etat !== 'route') return false;
    c.etat = 'appele';
    this.stats.cargoAppele = true;
    const p = ctx.physique.position;
    const releve = (Math.atan2(p.x - c.x, -(p.z - c.z)) * 180) / Math.PI;
    const cote = ecartAngle(releve, c.cap) >= 0 ? 'tribord' : 'bâbord';
    this.radio.taire?.();
    this.dire([`Cargo faisant route ${aLaDirection(c.cap)}, ici le voilier ${NOM_BATEAU}, à un mille sur votre ${cote}. Me recevez-vous ?`], { emetteur: `Toi (${NOM_BATEAU})`, canal: 16 }).then(() => {
      if (this.cargo !== c || this.etat !== 'nuit') return;
      const sens = this.cotePourPasserDerriere(c, ctx);
      c.capVise = c.cap + 50 * sens;
      c.virage = 0.9;
      c.etat = 'detourne';
      this.ecrire('Appelé le cargo au canal 16 : il se déroute.');
      this.dire([
        `Voilier ${NOM_BATEAU}, ici le cargo ${c.nom}. Je vous reçois.`,
        `Je ne vous voyais pas dans cette mer. Je viens sur ${sens > 0 ? 'tribord' : 'bâbord'}, je passerai sur votre arrière. Bon courage, et bonne veille.`,
      ], { emetteur: `Cargo ${c.nom}`, canal: 16 });
    });
    return true;
  }

  // ---------- L'étrange ----------
  // Rien n'est jamais expliqué ni confirmé. Chaque chose arrive une fois, et seulement si
  // le marin est là pour la voir ou l'entendre (sinon, elle attend un peu, puis passe).
  suivreEtrange(dt, ctx) {
    const h = this.heure;
    const pret = (nom) => !this.faits.has(nom) && h >= this.prevu[nom];
    const arrive = (nom, journal) => {
      this.faits.add(nom);
      if (journal) this.ecrire(journal);
      this.dernierEtrange = { nom, heure: h };
      this.peur.secouer(0.3);
      this.emettre('etrange', nom);
    };
    // une lumière sur l'eau, au loin, dans le creux des vagues : il faut être dehors
    if (pret('lumiere')) {
      if (ctx.aBord.dehors) arrive('lumiere', 'Une lumière sur l\'eau, au loin. Puis plus rien.');
      else if (h > this.prevu.lumiere + 0.6) this.faits.add('lumiere');
    }
    // une voix sur le 16 (le haut-parleur de la VHF s'entend de partout)
    if (pret('voix16')) arrive('voix16', 'Une voix sur le 16. Trop brouillée pour comprendre.');
    // Jos ne répond plus (on le découvre en l'appelant), puis il revient
    if (pret('silence')) {
      this.faits.add('silence');
      this.silence = true;
      this.emettre('etrange', 'silence');
    }
    // (il ne revient qu'une fois la vague scélérate passée : on l'affronte seul)
    if (this.silence && h >= this.prevu.silence + 0.55 && !(this.scelerates?.active && this.scelerates.vague.distance > -120)) {
      this.silence = false;
      this.ecrire('Jos est revenu.');
      this.dernierEtrange = { nom: 'retour', heure: h };
      this.emettre('etrange', 'retour');
      this.dire([
        `${NOM_BATEAU}, ${NOM_BATEAU}, ici ${JOS}… Tu me reçois ? Je t'ai perdu un long moment.`,
        'Il s\'est passé… enfin, peu importe. Tout va bien, à bord ?',
      ]);
    }
    // des coups contre la coque : on ne les entend que dans la cabine
    if (pret('coups')) {
      if (!ctx.aBord.dehors) arrive('coups', 'Des coups contre la coque, à l\'avant. Trois.');
      else if (h > this.prevu.coups + 1.2) this.faits.add('coups');
    }
  }

  // ---------- La peur ----------
  // (le jeu donne ce que le marin regarde : ctx.regard ; les marins automatiques n'ont pas
  // peur)
  suivrePeur(dt, ctx) {
    if (!ctx.regard) return;
    const w = this.scelerates?.vague;
    const occupe = (w && w.distance > -250) || (this.trombe && this.trombe.force > 0.1 && this.trombe.distance < 900)
      || (this.cargo && this.cargo.distance < 1500) || (ctx.danger ?? 0) > 0.4;
    const evts = this.peur.maj(dt, {
      heure: this.heure, lieu: ctx.lieu, yeux: ctx.yeux, regard: ctx.regard, haut: ctx.haut, tanX: ctx.tanX, tanY: ctx.tanY,
      lampe: ctx.lampe, eclairage: ctx.eclairage, noir: ctx.noir ?? 0,
      eclair: ctx.eclair ?? 0, danger: ctx.danger ?? 0, calme: ctx.calme ?? 0, occupe, silence: this.silence,
      porteOuverte: ctx.aBord.descenteOuverte,
    });
    const h = this.heure;
    const noter = (nom, texte) => {
      if (texte) this.ecrire(texte);
      this.dernierEtrange = { nom, heure: h };
    };
    for (const e of evts) {
      if (e === 'gemissement' && this.peur.fois.gemissement === 1) noter('gemissement', 'La mer a gémi. Longtemps.');
      else if (e === 'chose') noter('chose', 'Le sondeur a marqué six mètres. Il y en a quatre-vingt-dix.');
      else if (e === 'pas') noter('pas', 'Des pas sur le pont, au-dessus de moi.');
      else if (e === 'nom') noter('nom', `Une voix a dit « ${NOM_BATEAU} », sur le 16.`);
      else if (e === 'coupCoque') noter('coupCoque', 'Un choc énorme contre la coque.');
      else if (e === 'eclairSilhouette') noter('eclairSilhouette', 'Dans l\'éclair, quelqu\'un à l\'avant. À l\'éclair suivant, plus personne.');
      else if (e === 'echoSuiveur-fin') noter('echoSuiveur', 'Un écho sur le radar nous a suivis, toujours au même relèvement, de plus en plus près. Puis plus rien.');
      else if (e === 'echoProche') noter('echoProche', null);
      else if (e === 'echoProche-fin') {
        const j = this.peur.journal.at(-1);
        noter('echoProche', j?.nom === 'echoProche' && j.regardee
          ? 'L\'alarme du radar : un écho à cent mètres, dans notre sillage. Dans l\'éclair, je l\'ai vu : la mer, vide.'
          : 'L\'alarme du radar a sonné : un écho à cent mètres, dans notre sillage. Puis plus rien.');
      }
      else if (e === 'silhouette-fin' || e === 'reflet-fin' || e === 'forme-fin') {
        // (ce qu'on a vu du coin de l'œil ne compte que si on l'a regardé : il n'y avait rien)
        const j = this.peur.journal.at(-1);
        if (j?.regardee) {
          if (j.nom === 'silhouette') noter('silhouette', 'Quelqu\'un, debout à l\'avant. Non : personne.');
          if (j.nom === 'reflet') noter('reflet', 'Dans la vitre, quelqu\'un se tenait derrière moi. Derrière moi : personne.');
          if (j.nom === 'forme') noter('forme', 'Une forme pâle dans l\'eau, le long de la coque. Elle a coulé.');
        }
      }
      this.emettre('peur', e);
    }
  }

  // Appeler Jos (radio, canal 72) : il donne des nouvelles, ou le conseil le plus urgent
  appelerJos(ctx) {
    // pendant le silence : rien que des parasites
    if (this.silence) {
      if (!this.faits.has('sansReponse')) {
        this.faits.add('sansReponse');
        this.ecrire('Jos ne répond plus.');
      }
      this.emettre('etrange', 'sansReponse');
      return;
    }
    // ce qu'on vient de voir ou d'entendre : Jos cherche une explication (sans conviction)
    const e = this.dernierEtrange;
    if (e && this.heure - e.heure < 0.5 && !e.explique) {
      e.explique = true;
      const explications = {
        lumiere: ['Une lumière ? Il n\'y a aucun feu de ce côté-là, ni dans le livre, ni sur ma carte. Et le cargo est loin dans le nord, maintenant : sur mon radar, il n\'y a que toi.', 'Un reflet, sans doute. Ou la fatigue. Garde les yeux sur tes vagues.'],
        voix16: ['Un appel sur le seize ? Non… Je n\'ai rien reçu, moi. Et il n\'y a aucun bateau signalé dans le secteur, à part toi.', 'La fatigue joue des tours, la nuit. Reste concentré, matelot.'],
        coups: ['Des coups contre la coque ? Un tronc, une épave… ça arrive, par gros temps.', 'Regarde si tu ne prends pas l\'eau à l\'avant. Et écoute si ça recommence.'],
        echoSuiveur: ['Un écho qui te suit, sur ton radar ? Sur le mien, il n\'y a que toi.', 'Un grain qui file avec le vent, sans doute. Ne te laisse pas impressionner, matelot.'],
        echoProche: ['Ton alarme radar ? Dans cette mer, une crête qui brise juste derrière toi renvoie l\'onde.', 'Remets le filtre de mer. Et ne te retourne pas toutes les deux secondes.'],
        gemissement: ['La mer qui gémit ? C\'est le vent dans ta mâture, matelot. Ou une bouée sifflante, loin d\'ici.', 'Il n\'y en a pas dans le secteur… mais par ce temps, le son porte loin.'],
        silhouette: ['Quelqu\'un à l\'avant ? Tu es seul à bord, matelot.', 'Ton ciré de rechange qui bat, peut-être. Ou la fatigue. Bois un peu d\'eau, mange quelque chose.'],
        eclairSilhouette: ['Dans l\'éclair ? … Tu es seul à bord. Tu le sais.', 'Ne va pas à l\'avant. Pas cette nuit. Reste attaché au cockpit.'],
        reflet: ['Ton reflet dans la vitre, matelot. Avec la lumière rouge, on se fait peur tout seul.', 'Éteins un peu, tu verras mieux dehors.'],
        forme: ['Une forme dans l\'eau ? Un sac, une bâche, un bout de filet… La mer en charrie, par gros temps.', 'Ne te penche pas pour voir. Jamais.'],
        chose: ['Ta sonde a marqué six mètres ? Il y en a quatre-vingt-dix sous toi.', 'Un banc de poissons, sans doute… Les sondeurs voient des choses, parfois. Ou une baleine. Ça arrive, ici.'],
        pas: ['Des pas ? C\'est une drisse qui cogne, ou le tangon mal saisi.', 'Va voir si tu veux. Mais attache-toi avant de sortir.'],
        nom: ['Ton nom, sur le seize ? Ce n\'était pas moi. Je n\'ai rien émis.', 'Et personne d\'autre n\'est sur le canal, à part nous deux…'],
        coupCoque: ['Un choc ? Une épave, un conteneur, un tronc… Vérifie que tu ne prends pas l\'eau.', 'Et regarde ta cale dans dix minutes.'],
      };
      if (explications[e.nom]) {
        this.dire(explications[e.nom]);
        return;
      }
    }
    const urgent = this.conseilUrgent(ctx);
    const m = this.meteo;
    const reste = HEURE_AUBE - this.heure;
    this.dire([urgent
      ? `Ici ${JOS}, je te reçois. ${urgent}`
      : `Ici ${JOS}, je te reçois cinq sur cinq. Il est ${heureEnTexte(this.heure).replace(' h ', ' heures ').replace(/ 00$/, '')}, le vent est à ${Math.round(m.vent)} nœuds. Encore ${reste > 1.5 ? `${Math.round(reste)} heures` : 'un peu'} avant l'aube. Tiens bon.`]);
  }

  // ---------- Le bateau : ce qu'on note, et ce qui fait perdre ----------
  suivreBateau(dt, ctx) {
    if (this.t - this.tReprise < 5) return;
    const m = ctx.m;
    const s = this.stats;
    const gite = Math.abs(m.gite);
    s.giteMax = Math.max(s.giteMax, gite);
    if (gite > 70) s.couche += dt;
    s.distance += m.vitesse * 0.5144 * dt;
    s.vitesseMax = Math.max(s.vitesseMax, m.vitesse);
    if (ctx.mode === 'barre' && !ctx.pilote) s.aLaBarre += dt;
    // le mât sous l'horizontale trop longtemps (ou le bateau à l'envers) : chaviré
    this.renverse = gite > 100 ? this.renverse + dt : 0;
    if (gite > 150 || this.renverse > 12) this.perdre('chavirage', ctx);
  }

  perdre(raison, ctx) {
    if (this.etat !== 'nuit') return;
    this.etat = 'perdue';
    this.raison = raison;
    this.ecrire({
      naufrage: 'Trop d\'eau à bord : le bateau s\'enfonce.',
      chavirage: 'Le bateau a chaviré.',
      collision: 'Abordé par le cargo.',
      emporte: 'Emporté par une déferlante !',
      horsBord: 'Un homme à la mer !',
      cailloux: 'Échoué sur les cailloux.',
      bome: 'Assommé par la bôme.',
    }[raison] ?? 'Naufrage.');
    this.emettre('perdue', raison);
  }

  leverDuJour() {
    this.etat = 'aube';
    this.ecrire('Le jour se lève. Tenu toute la nuit !');
    this.dire([
      `${NOM_BATEAU}, ${NOM_BATEAU}, ici ${JOS}. Le jour se lève sur la pointe, et je vois ton feu de mât au large.`,
      'Tu as tenu toute la nuit, matelot. Je suis fier de toi. Rentre doucement : le café est chaud au sémaphore.',
    ], { urgent: true });
    this.emettre('aube');
  }

  // ---------- Jos conseille (pas trop souvent, et jamais en coupant la parole) ----------
  listeConseils() {
    const toileOk = (p) => p.ris >= 2 && p.deroule <= 0.45;
    return [
      { id: 'pilote', apres: 3, repos: 30, si: (ctx) => this.avaries.pilote === 'panne' && ctx.mode !== 'barre', dire: 'Personne à la barre ! Prends-la, sinon le bateau va se mettre en travers des vagues.' },
      // (un grain annoncé arrive, et la toile n'est pas réduite)
      // (pas celui de la bête : il ne souffle guère devant lui, et il faut sa toile pour s'écarter d'elle)
      { id: 'grain', apres: 2, repos: 35, si: (ctx) => { const m = this.menaceGrain; return !!m && m.distance < 2000 && m.grain.faits.annoncer && !m.grain.bete && !toilePrete(ctx.physique, this.meteo.vent + m.grain.force * 15); }, dire: 'Le grain est presque sur toi, et tu as encore trop de toile ! Réduis, vite.' },
      // (une vague scélérate arrive, et le bateau ne lui tourne pas le dos)
      { id: 'scelerate', apres: 3, repos: 14, si: (ctx) => { const w = this.scelerates?.vague; return !!w && w.faites.has('annonce') && w.distance > 150 && w.distance < 760 && Math.abs(ecartAngle(w.depuis, ctx.m.cap)) < 140; }, dire: 'Elle va te prendre par le travers ! Abats, mets-la droit dans ton arrière, vite !' },
      { id: 'harnais', apres: 4, repos: 40, si: (ctx) => this.meteo.vent >= 25 && ctx.aBord.dehors && !ctx.aBord.attache, dire: 'Accroche ton harnais, touche X ! Une déferlante peut t\'emporter.' },
      { id: 'focBat', apres: 8, repos: 30, si: (ctx) => this.avaries.ecouteFoc === 'cassee' && ctx.physique.deroule > 0.05, dire: 'Roule ce foc qui bat, vite ! À la barre, touche C.' },
      { id: 'gvDechiree', apres: 10, repos: 40, si: (ctx) => this.avaries.grandVoile === 'dechiree' && ctx.physique.ris < 3, dire: 'Ta grand-voile déchirée bat au vent : affale-la, au pied du mât.' },
      { id: 'pompe', apres: 3, repos: 45, si: () => this.eau.cale > 230, dire: () => `Tu as ${this.eau.cale > 700 ? 'beaucoup d\'eau' : 'de l\'eau'} dans le bateau. Pompe ! La pompe de cale est dans le cockpit, à bâbord.` },
      { id: 'descente', apres: 8, repos: 45, si: (ctx) => this.meteo.vent >= 27 && ctx.aBord.descenteOuverte, dire: 'Ferme la porte de la timonerie ! Si une vague remplit le cockpit, tout entrera à l\'intérieur.' },
      { id: 'toile', apres: 8, repos: 50, si: (ctx) => this.meteo.vent >= 29 && !toileOk(ctx.physique) && this.avaries.grandVoile === 'ok', dire: 'Tu as trop de toile pour ce vent ! Deux ris dans la grand-voile, au pied du mât, et roule ton foc presque entièrement.' },
      { id: 'travers', apres: 14, repos: 45, si: (ctx) => this.meteo.vent >= 30 && Math.abs(Math.abs(ctx.m.angleVentReel) - 90) < 28, dire: 'Tu prends les vagues de travers : c\'est comme ça qu\'on se fait coucher ! Abats, mets-les un peu sur l\'arrière.' },
      { id: 'affaler', apres: 25, repos: 120, si: (ctx) => this.meteo.vent >= 34 && ctx.physique.ris < 3 && this.avaries.grandVoile === 'ok', dire: 'Le vent passe les trente-cinq nœuds. Affale la grand-voile : au pied du mât, descends-la entièrement, et fuis sous un mouchoir de foc. Avec la grand-voile, la moindre déferlante te fera partir au lof.' },
      { id: 'arriere', apres: 20, repos: 70, si: (ctx) => this.meteo.vent >= 32 && Math.abs(ctx.m.angleVentReel) > 118 && Math.abs(ctx.m.angleVentReel) < 155, dire: 'Mets les vagues bien dans l\'arrière : le vent à cent soixante, cent soixante-dix degrés. Une déferlante qui te prend par la hanche te fait partir en travers.' },
      { id: 'empannage', apres: 5, repos: 40, si: (ctx) => this.meteo.vent >= 24 && Math.abs(ctx.m.angleVentReel) > 172 && ctx.physique.ris < 3, dire: 'Attention, tu es plein vent arrière avec la grand-voile : gare à l\'empannage ! Lofe un peu, garde le vent sur la hanche.' },
      { id: 'feux', apres: 10, repos: 90, si: (ctx) => this.heure > 19.6 && !ctx.aBord.feux, dire: 'Je ne vois pas tes feux. Allume-les, au tableau électrique : sinon, les cargos ne te verront pas.' },
    ];
  }

  conseiller(dt, ctx) {
    this._conseils ??= this.listeConseils();
    for (const c of this._conseils) {
      const s = (this.conseils[c.id] ??= { vrai: 0, repos: 0 });
      s.repos = Math.max(0, s.repos - dt);
      s.vrai = c.si(ctx) ? s.vrai + dt : 0;
      if (s.vrai >= c.apres && s.repos === 0 && this.radio.libre && this.t - this.dernierConseil > 22) {
        this.dire([typeof c.dire === 'function' ? c.dire() : c.dire], { siLibre: true });
        s.repos = c.repos;
        s.vrai = 0;
        this.dernierConseil = this.t;
        this.emettre('conseil', c.id);
        break;
      }
    }
  }

  // le conseil le plus urgent maintenant (pour quand on appelle Jos)
  conseilUrgent(ctx) {
    this._conseils ??= this.listeConseils();
    const c = this._conseils.find((k) => k.si(ctx));
    return c ? (typeof c.dire === 'function' ? c.dire() : c.dire) : null;
  }

  // ---------- Ce que le jeu affiche ----------
  // Le panneau en haut à gauche : l'heure, le chapitre, l'objectif, et l'état du bord
  panneau(ctx) {
    const p = ctx.physique;
    const e = this.eau;
    const av = this.avaries;
    const liste = [];
    // la préparation de la nuit, tant qu'elle n'est pas faite (sans la toile : voir plus bas)
    for (const item of LISTE_NUIT) {
      if (item.id === 'ris' || item.id === 'foc' || item.id === 'lampe' || item.id === 'barometre') continue;
      if (!item.fait(ctx)) liste.push({ texte: item.texte, etat: 'afaire' });
    }
    const tropDeToile = this.meteo.vent >= 29 && (p.ris < 2 || p.deroule > 0.45) && av.grandVoile === 'ok';
    liste.push({ texte: `Toile : ${toileEnMots(p)}`, etat: tropDeToile ? 'alerte' : 'ok' });
    liste.push({ texte: `Eau dans la cale : ${Math.round(e.cale / 5) * 5} L`, etat: e.cale > 700 ? 'danger' : e.cale > EAU.planchers ? 'alerte' : 'ok' });
    if (e.cockpit > 40) liste.push({ texte: `Cockpit plein d'eau : ${Math.round(e.cockpit / 10) * 10} L`, etat: e.cockpit > EAU.seuil ? 'alerte' : 'ok' });
    if (av.ecouteFoc === 'cassee') liste.push({ texte: p.deroule < 0.03 ? 'Écoute de foc cassée (à remplacer, à l\'avant)' : 'Écoute de foc cassée : roule le foc !', etat: p.deroule < 0.03 ? 'alerte' : 'danger' });
    if (av.grandVoile === 'dechiree') liste.push({ texte: p.ris >= 3 ? 'Grand-voile déchirée (affalée)' : 'Grand-voile déchirée : affale-la !', etat: p.ris >= 3 ? 'alerte' : 'danger' });
    if (av.foc === 'dechiree') liste.push({ texte: p.deroule < 0.03 ? 'Foc déchiré (roulé)' : 'Foc déchiré : roule-le !', etat: p.deroule < 0.03 ? 'alerte' : 'danger' });
    if (av.pilote === 'panne') liste.push({ texte: 'Pilote en panne (disjoncteur au tableau)', etat: 'alerte' });
    if (this.cargo) liste.push({ texte: `Cargo à ${this.cargo.distance > 1000 ? `${(this.cargo.distance / 1852).toFixed(1)} mille` : `${Math.round(this.cargo.distance / 10) * 10} m`}`, etat: this.cargo.etat === 'route' && this.cargo.cpa < 400 ? 'danger' : 'alerte' });
    if (this.trombe && this.trombe.force > 0.1) liste.push({ texte: `Trombe à ${Math.round(this.trombe.distance / 10) * 10} m`, etat: this.trombe.distance < 300 ? 'danger' : 'alerte' });
    // (le grain qui vient sur nous, puis le grain sur nous)
    const ici = this.ici;
    if (ici && (ici.agitation > 0.3 || ici.pluie > 0.75)) liste.push({ texte: 'Sous le grain', etat: 'alerte' });
    else if (this.menaceGrain) liste.push({ texte: `Grain à ${(this.menaceGrain.distance / 1852).toFixed(1).replace('.', ',')} mille`, etat: 'alerte' });
    return {
      numero: `Nuit · ${heureEnTexte(this.heure)}`,
      titre: this.chapitre.titre,
      objectif: this.etat === 'aube' ? 'Le jour se lève : tu as tenu !' : 'Tenir jusqu\'à l\'aube (6 h)',
      liste,
      progression: this.progression,
    };
  }

  // La note de Jos, à l'aube : une, deux ou trois étoiles
  //  ★ : tenu jusqu'au jour ;
  //  ★★ : sans s'être fait coucher plus de deux fois, la cabine presque au sec ;
  //  ★★★ : jamais couché, le cargo appelé, tout ce qui a cassé réparé.
  note() {
    const s = this.stats;
    const av = this.avaries;
    let etoiles = 1;
    if (s.coups <= 2 && s.caleMax < 600) etoiles = 2;
    const repare = av.ecouteFoc !== 'cassee' && av.pilote !== 'panne';
    if (etoiles === 2 && s.coups === 0 && s.caleMax < 300 && repare && (s.cargoAppele || s.cargoDistance === Infinity)) etoiles = 3;
    return {
      etoiles,
      titre: ['', 'Rescapé', 'Bon marin', 'Loup de mer'][etoiles],
      mot: [
        '',
        'Tu as tenu, c\'est l\'essentiel. Mais tu as eu chaud, matelot : la prochaine fois, réduis plus tôt et garde les vagues sur l\'arrière.',
        'Belle nuit. Quelques frayeurs, mais tu as bien mené ton bateau.',
        'Une nuit de vrai marin : pas une fois couché, et tout ce qui a cassé, tu l\'as réparé. Chapeau.',
      ][etoiles],
    };
  }

  // Le bilan, à l'aube (ou au naufrage)
  bilan() {
    const s = this.stats;
    const av = this.avaries;
    const avaries = [
      av.ecouteFoc !== 'ok' && `écoute de foc ${av.ecouteFoc === 'reparee' ? 'cassée puis remplacée' : 'cassée'}`,
      av.grandVoile !== 'ok' && 'grand-voile déchirée',
      av.foc !== 'ok' && 'foc déchiré',
      av.pilote !== 'ok' && 'pilote en panne',
    ].filter(Boolean);
    const virgule = (x) => x.toFixed(1).replace('.', ',');
    const milles = (m) => `${virgule(m / 1852)} mille${m >= 2 * 1852 ? 's' : ''}`;
    const metres = (d) => (d === Infinity ? '—' : d > 1500 ? milles(d) : `${Math.round(d / 10) * 10} m`);
    return [
      ['Heure', heureEnTexte(this.heure)],
      ['Déferlantes encaissées', `${s.deferlantes}${s.coups ? ` (dont ${s.coups} qui t'ont couché)` : ''}`],
      ['Gîte la plus forte', `${Math.round(s.giteMax)}°`],
      ['Eau pompée', `${Math.round(s.pompee)} litres (au plus ${Math.round(s.caleMax)} dans la cale)`],
      ['Avaries', avaries.length ? avaries.join(', ') : 'aucune'],
      ['La trombe', s.trombeDistance === Infinity ? 'pas vue' : `passée à ${metres(s.trombeDistance)}`],
      ['Les vagues scélérates', s.scelerates ? `${s.scelerates}${s.sceleratesCouche ? ` (dont ${s.sceleratesCouche} qui t'${s.sceleratesCouche > 1 ? 'ont' : 'a'} couché)` : ', passées sans être couché'}` : 'aucune'],
      ['Le cargo', s.cargoDistance === Infinity ? 'pas vu' : `${s.cargoAppele ? 'appelé à la radio, ' : ''}passé à ${metres(s.cargoDistance)}`],
      ['Les grains', s.grains ? `${s.grains}, rafales jusqu'à ${Math.round(s.rafaleMax)} nœuds` : 'aucun sur toi'],
      ['Le baromètre', Number.isFinite(s.pressionMin ?? Infinity) ? `au plus bas ${Math.round(s.pressionMin)} hPa vers ${heureEnTexte(s.heurePressionMin)}, ${Math.round(this.pression)} hPa maintenant` : '—'],
      ['La foudre', s.surLeMat ? `${s.eclairs} éclairs, et un sur le mât !` : s.eclairs ? `${s.eclairs} éclairs, le plus proche à ${metres(s.eclairPlusPres ?? Infinity)}` : 'pas un éclair'],
      ['À la barre', `${Math.round(s.aLaBarre / 60)} min (le reste au pilote)`],
      ['Distance parcourue', `${milles(s.distance)}, jusqu'à ${virgule(s.vitesseMax)} nœuds dans les surfs`],
    ];
  }

  // ---------- Aller directement à une heure (pour l'atelier, et pour vérifier) ----------
  // Les imprévus d'avant cette heure sont considérés comme passés.
  allerA(heure) {
    this.heure = Math.min(HEURE_AUBE, Math.max(HEURE_COUCHER, heure));
    this.c = Math.max(0, CHAPITRES.findIndex((ch) => this.heure < ch.a));
    if (this.c < 0) this.c = CHAPITRES.length - 1;
    this.commence = true;
    this.tReprise = this.t;
    MOMENTS.forEach((mo, k) => { if (mo.heure <= this.heure) this.faits.add(`moment-${k}`); });
    for (const nom of ['trombe', 'cargo', 'lumiere', 'voix16', 'silence', 'coups', 'scelerate0', 'scelerate1', 'scelerate2']) if (this.prevu[nom] < this.heure) this.faits.add(nom);
    for (const nom of ['ecouteFoc', 'pilote']) if (this.prevu[nom] < this.heure) this.prevu[nom] = Infinity;
    // (les grains : ceux d'avant cette heure sont passés ; les autres naîtront — celui de la
    // bête aussi, tant qu'elle n'est pas née)
    this.plansGrains.forEach((plan, k) => {
      if (plan.bete ? this.faits.has('trombe') : this.prevu[`grain${k}`] < this.heure) this.faits.add(`grain${k}`);
      else if (plan.bete) this.faits.delete(`grain${k}`);
    });
    this.grains.vider();
    this.grainBete = null;
    this.foudre.vider();
    this.ici = null;
    this.silence = this.faits.has('silence') && this.heure < this.prevu.silence + 0.55;
    this.retardLumiere = 0;
    this.meteo = meteoDeLaNuit(this.heure, this.niveau);
  }

  // Une déferlante tout de suite (force 0 → 1,3), pour vérifier
  provoquerDeferlante(force = 1) {
    const a = angleVers(this.meteo.directionVent);
    this.deferlantes.annonce = { force, vers: new Vector3(Math.cos(a), 0, Math.sin(a)), dans: 3.5, duree: 3.5 };
    this.annonceVue = null;
    this.deferlantes.annonce.force /= this.niveau.force; // (maj() la multipliera)
  }

  // ---------- Reprendre au début du chapitre (après un naufrage) ----------
  instantane(ctx) {
    const p = ctx.physique;
    return {
      c: this.c,
      heure: this.heure,
      eau: { ...this.eau, cale: Math.min(this.eau.cale, 100), cockpit: 0 },
      avaries: { ...this.avaries },
      fatigue: { ...this.fatigue },
      prevu: { ...this.prevu },
      faits: new Set(this.faits),
      stats: { ...this.stats },
      peur: this.peur.instantane(),
      voiles: { ris: p.ris, deroule: p.deroule, ecouteFocLibre: p.ecouteFocLibre, grandVoileDechiree: p.grandVoileDechiree, focDechire: p.focDechire },
      // (les grains en route vers nous : on les relance à la reprise, d'où sera le bateau)
      grainsEnRoute: this.grains.liste.filter((g) => g.prevu && !g.faits.rafale && g.plan !== undefined && !g.bete)
        .map((g) => ({ plan: g.plan, dans: Math.max(90, (g.dans ?? DANS_GRAIN) - g.age) })),
    };
  }

  // L'instantané, prêt à être gardé par le navigateur (un Set n'y passe pas)
  instantaneAGarder() {
    const s = this.sauvegarde;
    return s ? { ...s, faits: [...s.faits] } : null;
  }

  reprendre(ctx) {
    this.restaurer(this.sauvegarde, ctx);
  }

  // Revenir à un instantané (le début du chapitre, ou une partie gardée par le navigateur)
  restaurer(s, ctx) {
    if (!s) return;
    this.radio.taire?.();
    Object.assign(this, {
      c: s.c, heure: s.heure, eau: { ...s.eau }, avaries: { ...s.avaries }, fatigue: { ...s.fatigue },
      // (une partie gardée avant les vagues scélérates : elles arrivent quand même)
      prevu: { ...this.prevu, ...s.prevu }, faits: new Set(s.faits),
      stats: {
        scelerates: 0, sceleratesCouche: 0, grains: 0, rafaleMax: 0, eclairs: 0, frappes: 0, surLeMat: 0, heurePressionMin: null, ...s.stats,
        trombeDistance: s.stats.trombeDistance ?? Infinity, cargoDistance: s.stats.cargoDistance ?? Infinity, eclairPlusPres: s.stats.eclairPlusPres ?? Infinity,
        pressionMin: s.stats.pressionMin ?? Infinity,
      },
      etat: 'nuit', raison: null, cargo: null, trombe: null, suiviCoup: null, renverse: 0, annonceVue: null, commence: true,
    });
    this.sauvegarde = { ...s, faits: new Set(s.faits) };
    for (const nom of ['trombe', 'cargo', 'ecouteFoc', 'pilote', 'lumiere', 'voix16', 'silence', 'coups', 'scelerate0', 'scelerate1', 'scelerate2', 'grain0', 'grain1', 'grain2', 'grain3']) this.prevu[nom] ??= Infinity; // (JSON : Infinity devient null)
    // (le grain de la bête : dès le coucher du soleil, même dans une partie gardée avant lui)
    this.plansGrains.forEach((plan, k) => { if (plan.bete) this.prevu[`grain${k}`] = HEURE_COUCHER; });
    this.scelerates?.finir();
    this.aLancer = null;
    // (les grains : ceux d'alentour renaîtront ; ceux qui venaient sur nous repartent)
    this.grains.vider();
    this.foudre.vider();
    this.ici = null;
    this.menaceGrain = null;
    this.grainBete = null;
    this.vitesseLissee = null;
    for (const r of s.grainsEnRoute ?? []) if (this.plansGrains[r.plan]) this.lancerGrain(this.plansGrains[r.plan], ctx, r.dans, r.plan);
    this.peur.restaurer(s.peur);
    this.silence = this.faits.has('silence') && this.heure < this.prevu.silence + 0.55;
    this.dernierEtrange = null;
    this.deferlantes.annonce = null;
    this.deferlantes.attente = 8;
    this.conseils = {};
    this.tReprise = this.t;
    const p = ctx.physique;
    Object.assign(p, s.voiles);
    p.eauCale = this.eau.cale;
    p.eauCockpit = 0;
    this.retardLumiere = 0;
    this.meteo = meteoDeLaNuit(this.heure, this.niveau);
    this.ecrire(`Reprise : ${this.chapitre.titre.toLowerCase()}.`);
    this.dire([`On reprend, ${NOM_BATEAU}. ${this.chapitre.titre} : courage.`]);
  }
}
