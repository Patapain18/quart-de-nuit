// La nuit de tempête : de minuit à six heures. Seul à bord, pas de radio pour t'aider : le
// pilote tient le bateau vent arrière, les vagues dans le dos, et toi, tu le gardes en vie
// jusqu'à l'aube. Six heures de deux minutes chacune (douze minutes en tout) ; chaque heure
// est pire que la précédente, comme les nuits de FNAF (HEURES) : le vent monte de 32 à 46
// nœuds, la mer se creuse, les déferlantes viennent plus souvent et plus grosses, les fuites se
// multiplient, les grains passent, chargés d'éclairs.
//
// Ce qui arrive pendant la nuit :
//  - les déferlantes frappent le bateau ; chacune s'annonce par ses signes : son grondement,
//    de son côté, quelques secondes avant (les plus grosses, plus tôt ; le moteur le couvre :
//    on ne l'entend plus qu'au dernier moment), et pour les plus grosses, un éclair qui montre
//    leur crête ;
//  - l'eau embarque : le cockpit se remplit et se vide par ses dalots, la cabine prend l'eau
//    si la porte de la timonerie est ouverte (et sous la porte fermée, quand le cockpit est
//    plein), le bateau « travaille » et suinte de plus en plus ; on pompe ;
//  - les systèmes du bord (quart/systemes.js) : la batterie que tout vide, le moteur qui la
//    recharge mais chauffe et couvre les bruits, le pilote qui chauffe et disjoncte (on le
//    réarme au tableau, une fois refroidi), la pompe électrique, les vitres que les vagues
//    fendent puis brisent si leurs volets sont ouverts ;
//  - des avaries, et deux sorties forcées dans la tempête : l'écoute du foc qui casse vers 3 h
//    (le foc bat, il secoue le bateau et fait forcer le pilote : il faut sortir le rouler) ; les
//    dalots du cockpit bouchés vers 4 h 30 (le cockpit ne se vide plus, l'eau passe sous la
//    porte : il faut sortir les dégager) ; la foudre ou une vague scélérate qui font sauter le
//    pilote ;
//  - des grains : des averses d'orage qui passent, chacune avec sa rafale (monde/grains.js) ;
//  - la foudre, qui part de leurs nuages (monde/foudre.js), et peut tomber tout près — ou sur
//    le mât ;
//  - la trombe, vers 3 h 30 : la bête, née sous un grain plein d'éclairs ; dans le noir, on
//    ne la voit qu'à la lueur des éclairs ;
//  - deux vagues scélérates de 20 m : la première vers 2 h 30, la seconde au plus fort, vers
//    5 h 20 ;
//  - l'étrange, jamais expliqué (une lumière sur l'eau, une voix sur le 16, des coups contre
//    la coque, et tout ce que décide quart/peur.js).
// On a gagné si le bateau est encore à flot, et le marin à bord, quand sonne six heures.
//
// Ce fichier ne dessine rien et ne fait aucun bruit : il dit au jeu ce qui se passe (ses
// événements). On peut donc faire jouer toute la nuit par un programme (scripts/test-nuit.js).
//
// ctx, ce que l'on sait à chaque image (fabriqué par le jeu) : dt, m (les mesures du
// bateau), physique, houle, mode, aBord (feux, descenteOuverte, attache, dehors),
// evenements ; et pour la peur : lieu, yeux, regard, haut, tanX, tanY, lampe, eclairage,
// eclair, noir, danger, calme. (Le pilote, le moteur, la batterie : this.systemes.)
import { Vector3 } from 'three';
import { AMBIANCES, etatMeteo, interpoler, angleVers } from '../monde/meteo.js';
import { Deferlantes, preavis } from '../monde/deferlantes.js';
import { Scelerates, chocScelerate } from '../monde/scelerates.js';
import { Grains, PORTEUR } from '../monde/grains.js';
import { Foudre } from '../monde/foudre.js';
import { pressionDuJour } from '../monde/pression.js';
import { Peur } from './peur.js';
import { Systemes } from './systemes.js';

export const NOM_BATEAU = 'Morgane';
export const HEURE_DEBUT = 24; // minuit (les heures de la nuit comptent après 24 : 1 h = 25)
export const HEURE_AUBE = 30; // six heures
export const DUREE_HEURE = 120; // secondes de jeu pour une heure de la nuit
export const HEURE_LEVER = 30.8; // le soleil se lève (après la nuit, un accéléré de 20 s)
const DUREE_LEVER = 20;
const DECALAGE_PRESSION = 1.15; // h (voir suivreBarometre)

// « 3 h 05 »
export function heureEnTexte(h) {
  const minutes = Math.round(h * 60);
  return `${Math.floor(minutes / 60) % 24} h ${String(minutes % 60).padStart(2, '0')}`;
}
// « 3 h » (l'heure de la nuit, comme sur l'écran)
export const heureRonde = (h) => `${Math.floor(h + 1e-6) % 24} h`;

// L'heure de la nuit au bout de t secondes (et l'inverse)
export const heureA = (t) => Math.min(HEURE_AUBE, HEURE_DEBUT + Math.max(0, t) / DUREE_HEURE);
const secondesDe = (heures) => heures * DUREE_HEURE;

// Ce que la nuit fait au bateau, en plus ou en moins (un seul réglage pour l'instant ; il
// servira à d'autres nuits : la première, la plus dure…)
export const NIVEAU = { deferlantes: 1, force: 1, fuite: 1, avaries: 1, scelerates: 2, hauteurScelerate: 20, grains: 1 };

// ---------- Les heures ----------
// Comme les nuits de FNAF, chaque heure est plus dure que la précédente. Pour chacune : le
// signe qu'on remarque quand elle sonne (dit à l'écran et noté au journal), et ce qu'elle fait
// à la mer — une déferlante toutes les « periode » secondes, en moyenne (de 40 s à minuit à
// 12 s à 5 h), et leur taille (× leur force). (Quand une vague scélérate arrive, les autres se
// taisent un bon quart d'heure — vers 3 h, puis vers 5 h 40 — : le reste de ces heures-là,
// elles viennent plus serrées.)
export const HEURES = [
  { signe: 'La mer est déjà grosse.', periode: 40, force: 0.85 }, // minuit : on prend ses marques
  { signe: 'Le baromètre baisse.', periode: 32, force: 0.9 },
  { signe: 'La mer se creuse.', periode: 26, force: 0.95 },
  { signe: 'Des éclairs, tout autour.', periode: 15, force: 1 },
  { signe: 'Le baromètre n\'a jamais été si bas.', periode: 17, force: 1.05 },
  { signe: 'Le vent hurle dans le gréement.', periode: 12, force: 1.1 }, // le plus fort
];
export const programmeDe = (heure) => HEURES[Math.min(HEURES.length - 1, Math.max(0, Math.floor(heure + 1e-6) - HEURE_DEBUT))];
const FORCE_MAX = 1.25; // (la plus grosse déferlante)

// Ce qu'on entend venir. Une déferlante gronde dès qu'elle s'annonce (monde/deferlantes.js :
// preavis) ; quand le moteur tourne, on ne l'entend plus que dans le dernier tiers (son
// grondement est couvert : trop tard pour fermer les volets, qui mettent 2,5 s à descendre).
// La vague scélérate : on l'entend gronder à 980 m ; le moteur en marche, à 600 m seulement.
// (Le jeu le fait entendre ainsi ; les veilleurs automatiques n'en savent pas plus.)
export const ENTENDRE = { moteur: 0.35, scelerate: 980, scelerateMoteur: 600 };
// L'éclair qui montre la vague : la nuit, sous l'orage, les plus grosses déferlantes (force
// 0,8 et plus) se découpent sur un éclair trois secondes avant de frapper (trois fois sur
// quatre) — même quand le moteur couvre leur grondement, on peut les voir venir… volets ouverts
export const ECLAIR_VAGUE = { force: 0.8, avant: 3.2, chance: 0.75, orage: 0.4 };

// Les dalots du cockpit (ses deux trous d'évacuation, à l'arrière, derrière la roue). Vers 4 h 30,
// quand le front est passé et que la mer croise, une déferlante qui remplit le cockpit y jette
// des débris (un bout de cordage arraché, des morceaux de la housse de la roue) : les dalots se
// bouchent. Le cockpit ne se vide presque plus ; plein, son eau passe sous la porte fermée
// (au-delà de 300 L, un litre par seconde tous les 90 L), et l'arrière alourdi fait forcer le
// pilote (quart/systemes.js). Il faut sortir les dégager.
export const DALOTS = { heure: [28.45, 28.65], litres: 60, vidange: 0.06, suinte: [300, 90] };

// ---------- Le temps qu'il fait pendant la nuit ----------
// Le vent monte d'heure en heure ; vers 4 h 30 le front passe : le vent tourne de 25° (la mer
// croise, les déferlantes viennent de plus de côtés) et forcit encore ; à 6 h, la première
// lueur à l'est, et le vent tombe enfin.
const TEMPETE = AMBIANCES['nuit-tempete'];
const ETAPES_METEO = [
  [24, { ...TEMPETE, vent: 32, directionVent: 222, nuages: 0.97, orage: 0.82, pluie: 0.55, brume: 0.46, houle: { ...TEMPETE.houle, hs: 2.4 } }],
  [25, { ...TEMPETE, vent: 35, directionVent: 221, nuages: 0.97, orage: 0.88, pluie: 0.65, brume: 0.48 }],
  [26, { ...TEMPETE, vent: 38, directionVent: 219 }],
  [27, { ...TEMPETE, vent: 41, directionVent: 218 }],
  [28.3, { ...TEMPETE, vent: 43, directionVent: 222 }],
  // (le front : le vent tourne pendant qu'il passe au-dessus de nous)
  [28.7, { ...TEMPETE, vent: 44, directionVent: 244, houle: { ...TEMPETE.houle, direction: 250 } }],
  [29.4, { ...TEMPETE, vent: 46, directionVent: 246, houle: { ...TEMPETE.houle, direction: 252 } }],
  [29.85, { ...TEMPETE, vent: 45, directionVent: 248, houle: { ...TEMPETE.houle, direction: 252 } }],
  // (six heures : la première lueur ; le vent faiblit d'un coup derrière le front)
  [HEURE_AUBE, { ...AMBIANCES.aube, vent: 30, directionVent: 252, nuages: 0.8, orage: 0.3, pluie: 0.25, brume: 0.42, houle: { hs: 3.2, periode: 13, direction: 250 } }],
  [HEURE_LEVER, { ...AMBIANCES.aube, vent: 18, directionVent: 262, nuages: 0.45, orage: 0, pluie: 0, brume: 0.28, front: 0.4, houle: { hs: 3, periode: 14, direction: 250 } }],
];
// (la nuit du 10 octobre : la déclinaison du soleil est de −7° ; il se lève à 6 h 30, la nuit
// reste noire jusqu'à 5 h 20, et la première lueur paraît à 6 h — avec la déclinaison de la fin
// août de l'ancien jeu, le ciel pâlissait dès 4 h 10, et les deux heures les plus dures se
// jouaient dans l'aube)
const DECLINAISON_NUIT = -7;
for (const [, etape] of ETAPES_METEO) etape.declinaison = DECLINAISON_NUIT;
export function meteoDeLaNuit(heure, niveau = NIVEAU) {
  let i = 0;
  while (i < ETAPES_METEO.length - 2 && heure > ETAPES_METEO[i + 1][0]) i++;
  const [h0, a] = ETAPES_METEO[i];
  const [h1, b] = ETAPES_METEO[i + 1];
  const t = Math.min(1, Math.max(0, (heure - h0) / (h1 - h0)));
  const m = interpoler(etatMeteo(a), etatMeteo(b), t);
  m.heure = heure % 24;
  m.vent += (niveau.vent ?? 0) * Math.max(0, (m.vent - 24) / 18);
  return m;
}

// ---------- Les grains qui viendront sur le bateau ----------
// Les autres naissent et passent au loin, au gré du temps (monde/grains.js). Ceux-ci sont
// lancés exprès, quatre minutes avant d'arriver (on les voit venir au radar) : de plus en
// plus forts et chargés d'éclairs à mesure que la nuit avance. (arrivee : s de nuit, quand
// son cœur passe ; force, orage : 0 → 1 ; ecart : m, au plus près)
export const DANS_GRAIN = 240;
const GRAINS_DE_LA_NUIT = [
  { arrivee: secondesDe(1.35), force: 0.6, orage: 0.5, ecart: 380 },
  { arrivee: secondesDe(2.9), force: 0.8, orage: 0.8, ecart: 200 },
  { arrivee: secondesDe(4.65), force: 0.95, orage: 1, ecart: 120 },
];

// La trombe touche le bateau à moins de RAYON_TOUCHE mètres de son axe : dans le plus
// épais de sa gerbe d'embruns (celle de la bête, rendu/trombe.js, a 52 m de cœur)
export const RAYON_TOUCHE = 95;

// La bête (la trombe de la nuit) : elle vit 200 s (une heure trois quarts de la nuit) ; quand elle naît, elle est à moins d'un
// kilomètre du bateau, et s'il garde sa route, elle passe derrière lui à 250 m, une minute
// trois quarts à deux minutes et demie plus tard ; son tourbillon (de Rankine) : un cœur de
// 50 m, 38 m/s à son bord (74 nœuds). Son grain : force 0,6, plein d'éclairs. Personne ne barre :
// si le bateau change d'allure (le moteur qu'on lance ou qu'on arrête), elle s'écarte doucement
// de sa route pour passer à au moins 150 m (passeMin) — on la sent, mais elle ne vient pas sur
// lui.
export const BETE = { duree: 200, loin: 850, passe: [100, 150], ecart: 250, coeur: 50, vmax: 38, force: 0.6, orage: 1, passeMin: 150 };

// Où doit naître la bête pour passer derrière le bateau, à « ecart » mètres, s'il garde sa
// route : on se place dans le repère du bateau (elle y avance à w = sa vitesse − celle du
// bateau) ; elle doit y passer au plus près à « ecart » mètres, du côté opposé à sa marche
// (derrière lui), dans T secondes. Rend la position où elle sera à sa naissance, depuis le
// bateau (m), la perpendiculaire n, et T
function placeDeLaBete(ux, uz, V, v, ecart) {
  const wx = V * ux - v.x;
  const wz = V * uz - v.z;
  const w = Math.hypot(wx, wz) || 1;
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
  planchers: 150, // litres dans la cale : au-delà, on s'en inquiète (on la voit par la trappe)
  naufrage: 2000, // litres : le bateau s'enfonce, il faut l'abandonner
  seuil: 260, // litres dans le cockpit : au-delà, elle passe par-dessus le seuil de la porte
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
// d'où vient une vague qui va vers « vers » (monde) : 1 si elle arrive par tribord, -1 par bâbord
function cote(vers, physique) {
  const local = vers.clone().applyQuaternion(physique.orientation.clone().invert());
  return local.x > 0 ? -1 : 1;
}

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

export class Nuit {
  // graine : pour que deux nuits avec la même graine soient pareilles
  constructor({ graine = 1, niveau = NIVEAU } = {}) {
    this.niveau = { ...NIVEAU, ...niveau };
    this.graine = graine;
    this.hasard = generateur(graine * 7919 + 13);
    this.heure = HEURE_DEBUT;
    this.t = 0; // secondes (réelles) depuis minuit
    this.etat = 'nuit'; // 'nuit', 'aube' (gagné) ou 'perdue'
    this.meteo = meteoDeLaNuit(this.heure, this.niveau);
    this.deferlantes = new Deferlantes(graine * 31 + 5);
    this.annonceVue = null;
    this.suiviCoup = null;
    this.eau = { cockpit: 0, cale: 0 };
    this.avaries = { ecouteFoc: 'ok', foc: 'ok', pilote: 'ok', dalots: 'ok' };
    this.fatigue = { foc: 0 };
    // l'heure (de la nuit) où arriveront les imprévus
    this.prevu = {
      ecouteFoc: 26.9 + this.hasard() * 0.5,
      trombe: 27.35 + this.hasard() * 0.2,
    };
    // (les dalots, et les éclairs qui montrent les vagues : des hasards à part, pour que les
    // imprévus d'avant ne changent pas)
    const hd = generateur(graine * 3571 + 17);
    this.prevu.dalots = DALOTS.heure[0] + hd() * (DALOTS.heure[1] - DALOTS.heure[0]);
    this.hasardEclairs = generateur(graine * 6007 + 23);
    // les systèmes du bord (un hasard à part : pour les vitres)
    this.systemes = new Systemes({ hasard: generateur(graine * 271 + 9), dureeHeure: DUREE_HEURE });
    // l'étrange (jamais expliqué) — une lumière sur l'eau, une voix sur le 16, des coups contre
    // la coque. (Un hasard à part, pour que les autres imprévus n'en dépendent pas.)
    const etrange = generateur(graine * 104729 + 7);
    Object.assign(this.prevu, {
      lumiere: 25.1 + etrange() * 0.5,
      voix16: 26.2 + etrange() * 0.4,
      coups: 28.4 + etrange() * 0.5,
    });
    // les vagues scélérates (un hasard à part, lui aussi) : la première vers 2 h 30, la
    // seconde au plus fort, juste après le passage du front (une vague croisée, d'un côté
    // plus inattendu)
    const scel = generateur(graine * 15485863 + 11);
    this.hasardScelerate = scel;
    const heuresScelerates = [26.45 + scel() * 0.2, 29.2 + scel() * 0.2];
    heuresScelerates.slice(0, this.niveau.scelerates ?? 2).forEach((h, k) => { this.prevu[`scelerate${k}`] = h; });
    this.scelerates = null; // (le chef d'orchestre : monde/scelerates.js ; il lui faut la houle)
    this.aLancer = null; // (une vague à lancer tout de suite : pour vérifier)
    // les grains (monde/grains.js) : ceux qui vivent alentour, et ceux qui viendront sur nous
    const hg = generateur(graine * 7727 + 19);
    this.grains = new Grains(graine * 31337 + 7);
    this.hasardGrains = hg;
    this.plansGrains = GRAINS_DE_LA_NUIT.map((g) => ({ ...g, arrivee: g.arrivee + (hg() - 0.5) * 40, ecart: g.ecart * (hg() < 0.5 ? -1 : 1) }));
    this.plansGrains.forEach((g, k) => { this.prevu[`grain${k}`] = heureA(g.arrivee - DANS_GRAIN); });
    // (le grain de la bête : il arrive au vent un peu plus d'une minute avant qu'elle naisse)
    this.prevu.grainBete = this.prevu.trombe - 0.6;
    this.grainBete = null;
    this.hasardBete = generateur(graine * 92821 + 3);
    this.vitesseLissee = null; // (la vitesse du bateau, lissée sur vingt secondes)
    this.ici = null; // (ce que font les grains là où est le bateau : la pluie, leur vent…)
    this.pression = pressionDuJour(this.heure - DECALAGE_PRESSION);
    this.foudre = new Foudre(graine * 6151 + 29);
    this.peur = new Peur({ graine });
    this.dernierEtrange = null;
    this.faits = new Set(); // les moments et les imprévus déjà passés
    this.trombe = null;
    this.stats = {
      deferlantes: 0, coups: 0, giteMax: 0, couche: 0, pompee: 0, distance: 0, vitesseMax: 0, caleMax: 0,
      trombeDistance: Infinity, scelerates: 0, sceleratesCouche: 0, grains: 0, rafaleMax: 0,
      eclairs: 0, eclairPlusPres: Infinity, frappes: 0, surLeMat: 0, avaries: 0,
    };
    this.journal = [];
    this.renverse = 0; // secondes passées le mât sous l'horizontale
    this.tReprise = 0; // (les chiffres de la nuit ne comptent qu'après 5 s : le temps que le bateau se pose)
    this.sauvegarde = null;
    this.heureSauvegarde = null;
    this.raison = null;
    this.commence = false;
    this.alertesEau = new Set();
    this.ecouteurs = {};
    this.evenements = new Set();
  }

  // ---------- Pour le jeu ----------
  on(nom, f) { (this.ecouteurs[nom] ??= []).push(f); return this; }
  emettre(nom, ...args) { for (const f of this.ecouteurs[nom] ?? []) f(...args); }
  get progression() { return (this.heure - HEURE_DEBUT) / (HEURE_AUBE - HEURE_DEBUT); }
  // ce que l'heure en cours fait à la mer (HEURES)
  get programme() { return programmeDe(this.heure); }
  ecrire(texte) {
    const entree = { heure: this.heure, texte };
    this.journal.push(entree);
    this.emettre('journal', entree);
  }

  // ---------- Chaque image ----------
  maj(dt, ctx) {
    this.evenements = new Set(ctx.evenements ?? []);
    ctx.evenements = this.evenements;
    // six heures passées, le soleil se lève (un accéléré : le ciel se dégage, le vent tombe)
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
      this.commencerHeure(ctx);
    }
    this.t += dt;
    this.avancerHeure(dt, ctx);
    this.meteo = meteoDeLaNuit(this.heure, this.niveau);
    ctx.meteo = this.meteo;
    this.lisserVitesse(dt, ctx);
    this.suivreGrains(dt, ctx);
    this.suivreBarometre(dt, ctx);
    this.suivreScelerates(dt, ctx);
    this.suivreDeferlantes(dt, ctx);
    this.suivreEau(dt, ctx);
    this.suivreSystemes(dt, ctx);
    this.suivreAvaries(dt, ctx);
    this.suivreTrombe(dt, ctx);
    this.suivreFoudre(dt, ctx);
    this.suivreEtrange(dt, ctx);
    this.suivrePeur(dt, ctx);
    this.suivreBateau(dt, ctx);
    if (this.etat !== 'nuit') return;
    if (this.heure >= HEURE_AUBE) this.leverDuJour();
  }

  lisserVitesse(dt, ctx) {
    const v = ctx.physique.vitesse;
    const l = (this.vitesseLissee ??= { x: v.x, z: v.z });
    const k = Math.min(1, dt / 20);
    l.x += (v.x - l.x) * k;
    l.z += (v.z - l.z) * k;
  }

  // Combien de secondes de nuit d'ici à cette heure
  secondesJusqua(heure) {
    return Math.max(0, (heure - this.heure) * DUREE_HEURE);
  }

  avancerHeure(dt, ctx) {
    const avant = Math.floor(this.heure + 1e-6);
    this.heure = Math.min(HEURE_AUBE, this.heure + dt / DUREE_HEURE);
    if (Math.floor(this.heure + 1e-6) > avant && Math.floor(this.heure + 1e-6) < HEURE_AUBE) this.commencerHeure(ctx);
  }

  // Une heure commence : on la note (avec son signe), et la partie est gardée (on pourra la
  // reprendre là)
  commencerHeure(ctx) {
    const h = Math.floor(this.heure + 1e-6);
    this.sauvegarde = this.instantane(ctx);
    this.heureSauvegarde = h;
    const m = this.meteo;
    const { signe } = programmeDe(h);
    this.ecrire(h === HEURE_DEBUT
      ? `Minuit. Vent ${Math.round(m.vent)} nœuds, la mer est déjà grosse. Six heures avant l'aube.`
      : `${heureRonde(h)}. Vent ${Math.round(m.vent)} nœuds. ${signe}`);
    this.emettre('heure', h, signe);
  }

  // ---------- Les déferlantes ----------
  suivreDeferlantes(dt, ctx) {
    // (quand une vague scélérate arrive, les autres vagues se taisent : plus de déferlantes)
    const d = this.scelerates?.vague?.distance ?? Infinity;
    const calme = d < 420 && d > -220;
    // (chaque heure en amène davantage, et de plus grosses : HEURES — une toutes les « periode »
    // secondes, en moyenne)
    const heure = this.programme;
    const frappe = this.deferlantes.maj(dt, this.meteo, calme ? 0 : this.niveau.deferlantes, heure.periode);
    const a = this.deferlantes.annonce;
    if (a && a !== this.annonceVue) {
      this.annonceVue = a;
      a.force = Math.min(FORCE_MAX, a.force * this.niveau.force * heure.force);
      a.dans = a.duree = preavis(a.force);
      // ce qu'on en entendra : son grondement dès maintenant… ou, le moteur en marche, dans son
      // dernier tiers seulement (ENTENDRE)
      a.entendue = a.dans * (this.systemes.moteurEnMarche ? ENTENDRE.moteur : 1);
      this.emettre('deferlante-annonce', a);
    }
    if (a && !a.ouie && a.dans <= a.entendue) {
      a.ouie = true;
      this.emettre('deferlante-entendue', a);
    }
    // (les plus grosses, la nuit, sous l'orage : un éclair montre leur crête)
    if (a && !a.eclair && a.force >= ECLAIR_VAGUE.force && a.dans <= ECLAIR_VAGUE.avant) {
      a.eclair = true;
      if (this.meteo.orage > ECLAIR_VAGUE.orage && this.hasardEclairs() < ECLAIR_VAGUE.chance) this.emettre('deferlante-eclair', a);
    }
    if (frappe) {
      const p = ctx.physique;
      const angle = p.deferlante(frappe.vers, frappe.force); // 0 : de face, 90 : de travers, 180 : de l'arrière
      // l'eau qui embarque : de travers, ou par l'arrière (le cockpit est « pooppé ») ; les
      // petites soulèvent l'arrière sans presque rien jeter à bord, les grosses le remplissent
      const r = (angle * Math.PI) / 180;
      const prise = angle < 90 ? 0.15 + 0.85 * Math.sin(r) : 0.75 + 0.25 * Math.sin(r);
      const litres = 420 * prise * Math.min(1, Math.max(0, (frappe.force - 0.3) / 0.9));
      this.eau.cockpit = Math.min(EAU.cockpitMax, this.eau.cockpit + litres);
      // (vers 4 h 30, celle qui remplit le cockpit y jette des débris : ses dalots se bouchent
      // — pas avec la trombe tout près : chaque chose en son temps)
      if (this.avaries.dalots === 'ok' && this.heure >= this.prevu.dalots && (litres >= DALOTS.litres || this.heure > this.prevu.dalots + 0.35)
        && !(this.trombe && this.trombe.force > 0.1 && this.trombe.distance < 300)) this.avarie('dalots', ctx);
      // (et un peu passe toujours à l'intérieur : sous la porte, par les aérateurs)
      this.eau.cale += frappe.force * prise * (ctx.aBord.descenteOuverte ? 70 : 6);
      // les vitres de ce côté-là, volets ouverts, en prennent un coup (et la mer entre par
      // celles qui sont déjà brisées)
      this.eau.cale += this.systemes.frapper(frappe.force, angle, cote(frappe.vers, p), prise);
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
    // le cockpit se vide par ses deux dalots de 75 mm (d'autant plus vite qu'il est plein :
    // 12 L/s à 500 L, plein, il se vide en une minute trois quarts ; bouchés, presque plus)
    const vidange = this.avaries.dalots === 'bouches' ? DALOTS.vidange : 1;
    e.cockpit = Math.max(0, e.cockpit - dt * 12 * vidange * Math.sqrt(e.cockpit / 500));
    // couché, il ramasse la mer par le bord qui trempe
    if (gite > 55) e.cockpit = Math.min(EAU.cockpitMax, e.cockpit + dt * (gite - 55) * 9);
    if (ouverte) {
      // porte ouverte : ce qui passe par-dessus le seuil descend à l'intérieur, et le bateau
      // couché embarque des tonnes d'eau
      const coule = Math.max(0, e.cockpit - EAU.seuil) * 0.6 * dt;
      e.cockpit -= coule;
      e.cale += coule;
      if (gite > 75) e.cale += dt * (gite - 75) * 14;
    } else {
      // porte fermée : le cockpit plein passe sous la porte (ses joints ne tiennent pas une
      // telle charge d'eau)
      const [plein, parLitre] = DALOTS.suinte;
      const suinte = Math.min(e.cockpit, (Math.max(0, e.cockpit - plein) / parLitre) * dt);
      e.cockpit -= suinte;
      e.cale += suinte;
      if (gite > 80) e.cale += dt * (gite - 80) * 0.6; // les joints suintent
    }
    // le bateau « travaille » dans la tempête : il suinte de partout, de plus en plus d'heure
    // en heure (les joints fatiguent)
    const usure = 1 + 0.25 * (this.heure - HEURE_DEBUT);
    e.cale += dt * this.niveau.fuite * usure * Math.max(0, (this.meteo.vent - 28) / 12) * 0.45;
    // (et par les vitres brisées, la pluie et les embruns)
    e.cale += dt * this.systemes.infiltration(this.meteo.vent);
    this.stats.caleMax = Math.max(this.stats.caleMax, e.cale);
    ctx.physique.eauCale = e.cale;
    ctx.physique.eauCockpit = e.cockpit;
    for (const [seuil, texte] of [[EAU.planchers, 'De l\'eau dans la cale.'], [700, 'L\'eau monte dans la cale.'], [1300, 'Le bateau s\'alourdit dangereusement.']]) {
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

  // ---------- Les systèmes du bord ----------
  // (quart/systemes.js : la batterie, le moteur, le pilote, la pompe électrique, les volets et
  // les vitres) ; ce qu'il en arrive va au journal, et au jeu (événement 'systeme')
  suivreSystemes(dt, ctx) {
    const sy = this.systemes;
    const evts = sy.maj(dt, { physique: ctx.physique, eau: this.eau, heure: this.heure, mer: ctx.houle?.hauteurSignificative ?? 4, vent: this.meteo.vent });
    // (le moteur pousse le bateau : la physique le sait)
    ctx.physique.moteur = sy.regime;
    const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);
    for (const [nom, arg] of evts) {
      if (nom === 'pilote-disjoncte') this.avarie('pilote', ctx, false, false, 'surchauffe');
      else if (nom === 'batterie-vide') this.ecrire('La batterie est vide : tout s\'éteint.');
      else if (nom === 'batteries-noyees') this.ecrire('L\'eau a noyé les batteries : le coupe-batterie a sauté. Plus de courant.');
      else if (nom === 'courant-revenu' && this.faits.has('noir')) this.ecrire('Le courant est revenu.');
      else if (nom === 'moteur-arrete' && arg === 'surchauffe') this.ecrire('Le moteur a trop chauffé : il s\'est arrêté tout seul.');
      else if (nom === 'vitre-fendue') this.ecrire(`${majuscule(arg.nom)} s'est fendue.`);
      else if (nom === 'vitre-brisee') this.ecrire(`${majuscule(arg.nom)} a éclaté : la mer entre.`);
      if (nom === 'noir') this.faits.add('noir');
      if (nom === 'moteur-demarre') this.stats.demarrages = (this.stats.demarrages ?? 0) + 1;
      this.emettre('systeme', nom, arg);
    }
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
    // un foc qui bat dans la tempête finit par se déchirer
    if (av.foc === 'ok' && p.deroule > 0.05) {
      const surface = Math.max(0, (p.deroule - 0.4) / 0.6);
      const trop = Math.max(0, vent - 31) / 10;
      const bat = (av.ecouteFoc === 'cassee' ? 1 : m.incidenceFoc < 6 ? 0.4 : 0) * Math.max(0, vent - 25) / 14;
      this.fatigue.foc += dt * (trop * surface / 60 + bat / 300) * this.niveau.avaries;
      if (this.fatigue.foc >= 1) this.avarie('foc', ctx);
    }
    // l'écoute de foc s'use contre le hauban, et casse. (Si la rafale d'un grain arrive un peu
    // avant l'heure, c'est elle qui l'achève.) (Le pilote, lui, lâche quand il chauffe trop :
    // suivreSystemes.)
    const rafale = (this.ici?.agitation ?? 0) > 0.45;
    const lHeure = (nom) => this.heure >= this.prevu[nom] || (rafale && this.heure >= this.prevu[nom] - 0.3);
    if (av.ecouteFoc === 'ok' && av.foc === 'ok' && lHeure('ecouteFoc') && p.deroule > 0.08) this.avarie('ecouteFoc', ctx, rafale);
    if (av.ecouteFoc === 'cassee' && p.deroule < 0.03 && !this.faits.has('foc-roule')) {
      this.faits.add('foc-roule');
      this.stats.focRoule = this.heure;
      this.ecrire('Le foc qui battait est roulé.');
      this.emettre('foc-roule');
    }
  }

  // (foudre : c'est la foudre, tombée sur le mât, qui l'a causée ; raison : pour le pilote,
  // 'surchauffe' — son disjoncteur thermique a sauté —, ou 'vague' — la barre arrachée)
  avarie(nom, ctx, dansLaRafale = false, foudre = false, raison = null) {
    const p = ctx.physique;
    this.avaries[nom] = { pilote: 'panne', ecouteFoc: 'cassee', dalots: 'bouches' }[nom] ?? 'dechiree';
    if (nom === 'pilote') this.systemes.pilote.disjoncte = true;
    this.stats.avaries++;
    const journal = {
      ecouteFoc: 'L\'écoute de foc a cassé : le foc bat.',
      foc: 'Le foc s\'est déchiré.',
      pilote: foudre ? 'La foudre est tombée sur le mât : le pilote a disjoncté.'
        : raison === 'surchauffe' ? 'Le pilote a trop chauffé : son disjoncteur a sauté.' : 'Le pilote automatique a lâché.',
      dalots: 'Une déferlante a rempli le cockpit et bouché ses dalots : il ne se vide plus.',
    }[nom];
    if (nom === 'ecouteFoc') p.ecouteFocLibre = true;
    if (nom === 'foc') p.focDechire = true;
    this.ecrire(dansLaRafale ? `${journal.replace(/\.$/, '')}, dans la rafale d'un grain.` : journal);
    this.emettre('avarie', nom, { foudre, raison });
  }

  // Réparer : passer une nouvelle écoute (à l'avant), réarmer le pilote (au tableau), dégager
  // les dalots (dans le cockpit, derrière la roue)
  reparer(nom, ctx) {
    const p = ctx.physique;
    if (nom === 'dalots' && this.avaries.dalots === 'bouches') {
      this.avaries.dalots = 'degages';
      this.stats.dalotsDegages = this.heure;
      this.ecrire('Les dalots sont dégagés : le cockpit se vide.');
    } else if (nom === 'ecouteFoc' && this.avaries.ecouteFoc === 'cassee') {
      this.avaries.ecouteFoc = 'reparee';
      p.ecouteFocLibre = false;
      p.ecouteFoc = Math.min(1.2, Math.max(0.3, Math.abs(p.angleFoc)));
      this.ecrire('Nouvelle écoute de foc passée.');
    } else if (nom === 'pilote' && this.avaries.pilote === 'panne') {
      // (son disjoncteur thermique ne se réarme qu'une fois le pilote refroidi)
      if (this.systemes.rearmerPilote() !== 'ok') return false;
      this.avaries.pilote = 'ok';
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
      // l'heure venue, une vague naît au vent du bateau (elle attend que la trombe soit partie)
      const occupe = this.trombe && this.trombe.force > 0.1 && this.trombe.distance < 2500;
      for (let k = 0; k < 2 && !occupe; k++) {
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
    const ecart = (k === 1 ? 34 + 14 * h() : 10 + 18 * h()) * (h() < 0.5 ? -1 : 1);
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

  // Une vague tout de suite (pour vérifier) : depuis (cap d'où elle vient) et hauteur
  provoquerScelerate({ depuis = null, hauteur = null } = {}) {
    this.aLancer = { numero: 0, depuis, hauteur };
  }

  etapeScelerate(etape, ctx) {
    const w = this.scelerates.vague;
    if (!w) return;
    const relatif = ecartAngle(w.depuis, ctx.m.cap);
    if (etape === 'grondement') this.emettre('scelerate-grondement', w);
    else if (etape === 'annonce') {
      this.ecrire(`Un grondement énorme, ${directionRelative(relatif)}.`);
      this.emettre('scelerate', { ...w, relatif });
    } else if (etape === 'proche') this.emettre('scelerate-proche', { ...w, relatif });
    else if (etape === 'eclair') this.emettre('scelerate-eclair', w);
    else if (etape === 'trou') this.emettre('scelerate-trou', w);
    else if (etape === 'choc') {
      const c = chocScelerate(ctx.physique, this.scelerates, { porteOuverte: ctx.aBord.descenteOuverte });
      this.eau.cockpit = Math.min(EAU.cockpitMax, this.eau.cockpit + c.cockpit);
      this.eau.cale += c.interieur;
      // (ses vitres : elle brise toutes celles de son côté dont le volet est ouvert)
      this.eau.cale += this.systemes.frapper(1.3, c.angle, cote(this.scelerates.direction(), ctx.physique), c.prise, { scelerate: true });
      this.suiviCoup = { t: 6, gite: 0, force: 1.3, angle: c.angle, prise: c.prise, scelerate: true };
      // (le pilote peut lâcher : la barre arrachée par la vague — moins souvent si elle est
      // bien venue par l'arrière)
      if (this.systemes.piloteEnMarche && this.avaries.pilote === 'ok' && this.hasardScelerate() < (c.angle > 150 ? 0.15 : 0.4)) this.avarie('pilote', ctx, false, false, 'vague');
      this.emettre('scelerate-choc', { ...c, vers: this.scelerates.direction(), relatif });
    } else if (etape === 'passee') this.emettre('scelerate-passee', w);
  }

  // ---------- La bête : la trombe de la nuit ----------
  // Elle naît de son grain (lancerGrainBete), à son heure : sous l'avant de son nuage, là où
  // l'air chaud monte, sur le bord de sa rafale — à l'endroit de cet avant d'où, avançant avec
  // lui, elle passera derrière le bateau deux minutes plus tard s'il ne change rien (à 250 m :
  // on la sent passer), et sur lui s'il ralentit ou dérive du mauvais côté.
  suivreTrombe(dt, ctx) {
    const p = ctx.physique.position;
    // son grain arrive au vent, un peu plus d'une minute avant elle
    if (!this.grainBete && !this.faits.has('grainBete') && !this.faits.has('trombe') && this.heure >= this.prevu.grainBete) {
      this.faits.add('grainBete');
      this.lancerGrainBete(ctx);
    }
    // (avant qu'elle naisse, son grain se charge : ses éclairs se multiplient — le « saut
    // d'éclairs », que les météorologues guettent avant les trombes)
    const gb = this.grainBete;
    if (gb && !this.trombe && !this.faits.has('trombe') && this.grains.liste.includes(gb)) {
      const dans = this.secondesJusqua(this.prevu.trombe);
      gb.saut = 1 + 0.6 * lisse(45, 5, dans);
      // (et il glisse, sans qu'on le voie, vers là où il doit être quand elle naîtra — selon la
      // route que le bateau a maintenant —, à 1,5 m/s au plus)
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
    if (t.grain && !this.grains.liste.includes(t.grain)) t.grain = null;
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
    // (elle serpente de part et d'autre de sa route : ±22 m, en deux minutes et demie)
    const w = (Math.cos(t.age * 0.045) * 8 * Math.PI) / 180;
    t.vx = (ux * Math.cos(w) - uz * Math.sin(w)) * V;
    t.vz = (uz * Math.cos(w) + ux * Math.sin(w)) * V;
    t.x += t.vx * dt;
    t.z += t.vz * dt;
    // (si le bateau a changé d'allure — le moteur —, elle passerait sur lui : elle s'en écarte
    // doucement, de côté, pour passer à au moins BETE.passeMin mètres)
    this.ecarterBete(t, ctx, dt);
    t.force = lisse(0, 15, t.age) * (1 - lisse(t.duree - 30, t.duree, t.age));
    t.distance = Math.hypot(p.x - t.x, p.z - t.z);
    if (g) {
      // la pluie de son grain s'enroule autour d'elle (le crochet, sur le radar)
      g.crochet ??= {};
      Object.assign(g.crochet, { x: t.x, z: t.z, ux, uz, force: t.force * lisse(5, 45, t.age) });
      g.saut = 1 + 0.6 * (1 - lisse(10, 70, t.age));
    }
    this.stats.trombeDistance = Math.min(this.stats.trombeDistance, t.distance);
    if (t.distance < 450 && t.force > 0.5 && !t.alerte) {
      t.alerte = true;
      this.emettre('trombe-proche');
    }
    if (t.distance < RAYON_TOUCHE && t.force > 0.5 && !t.touche) {
      t.touche = true;
      this.stats.trombeTouche = true;
      this.ecrire('La trombe est passée sur le bateau !');
      this.emettre('trombe-touche', { force: t.force });
      if (this.systemes.piloteEnMarche && this.avaries.pilote === 'ok' && this.hasard() < 0.4) this.avarie('pilote', ctx, false, false, 'vague');
    }
    if (t.age > t.duree) {
      this.trombe = null;
      if (g) g.crochet = null;
      this.ecrire('La trombe s\'est dissipée.');
    }
  }

  // Où passera-t-elle au plus près, si le bateau (tel qu'il va maintenant : sans pilote, il
  // dérive) et elle gardent leur route ? Si c'est trop près, elle glisse de côté (à 4 m/s au
  // plus), loin du bateau ; et si elle est déjà trop près, elle s'en éloigne
  ecarterBete(t, ctx, dt) {
    const p = ctx.physique.position;
    const v = ctx.physique.vitesse;
    const rx = t.x - p.x;
    const rz = t.z - p.z;
    const d = Math.hypot(rx, rz);
    if (d < BETE.passeMin && d > 1) {
      const recule = 4 * (1 - d / BETE.passeMin);
      t.x += (rx / d) * recule * dt;
      t.z += (rz / d) * recule * dt;
    }
    const wx = t.vx - v.x;
    const wz = t.vz - v.z;
    const w2 = wx * wx + wz * wz;
    if (w2 < 0.01) return;
    const dans = -(rx * wx + rz * wz) / w2; // secondes jusqu'au plus près
    if (dans < 2) return;
    const cx = rx + wx * dans;
    const cz = rz + wz * dans;
    const cpa = Math.hypot(cx, cz);
    if (cpa >= BETE.passeMin) return;
    const w = Math.sqrt(w2);
    const [nx, nz] = cpa > 1 ? [cx / cpa, cz / cpa] : [-wz / w, wx / w];
    const pousse = Math.min(4, (BETE.passeMin - cpa) / Math.max(dans, 8));
    t.x += nx * pousse * dt;
    t.z += nz * pousse * dt;
  }

  // La bête naît, sous l'avant de son grain
  naitreBete(ctx) {
    const v = this.vitesseLissee ?? ctx.physique.vitesse;
    const p = ctx.physique.position;
    const decale = (this.hasard() - 0.5) * 40;
    const g = this.grainBete && this.grains.liste.includes(this.grainBete) ? this.grainBete : this.lancerGrainBete(ctx);
    g.glisse = null;
    const V = Math.hypot(g.vx, g.vz) || 1;
    const ux = g.vx / V;
    const uz = g.vz / V;
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
    g.faits.vu = true;
    const relatif = ecartAngle(this.releveDe(s.x, s.z, ctx), ctx.m.cap);
    this.ecrire('Une trombe, sous le grain.');
    this.emettre('trombe', { ...this.trombe, relatif });
  }

  // La route du grain de la bête (avec le vent qu'il fera quand elle naîtra)
  routeDuGrainBete() {
    const m = meteoDeLaNuit(Math.max(this.heure, this.prevu.trombe), this.niveau);
    const a = angleVers(m.directionVent + PORTEUR.derive);
    return { ux: Math.cos(a), uz: Math.sin(a) };
  }

  // Où doit être le centre du grain de la bête quand elle naîtra (dans « dans » secondes),
  // pour qu'elle naisse sous son avant à la bonne place — si le bateau garde sa route
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

  // Le grain de la bête : il arrive au vent, déjà formé, là où il faut pour qu'à l'heure de la
  // trombe, l'avant de son nuage soit à moins d'un kilomètre du bateau. Il traîne : moins
  // vite que les autres grains, droit sous le vent (monde/grains.js : PORTEUR)
  lancerGrainBete(ctx) {
    const dans = this.faits.has('trombe') ? 0 : this.secondesJusqua(this.prevu.trombe);
    const { ux, uz } = this.routeDuGrainBete();
    const force = BETE.force * (this.niveau.grains ?? 1);
    const ici = this.placeDuGrainBete(ctx, dans, 650 + force * 450);
    const age = 150 + this.hasardBete() * 60;
    const g = this.grains.porteur({
      x: ici.x - ux * PORTEUR.vitesse * dans + ux * PORTEUR.avant * ici.rayon,
      z: ici.z - uz * PORTEUR.vitesse * dans + uz * PORTEUR.avant * ici.rayon,
      ux, uz, force, orage: BETE.orage,
      age, duree: age + dans + BETE.duree + 160,
    });
    g.bete = true;
    g.faits.depuis = this.t;
    this.grainBete = g;
    return g;
  }

  // Le vent tourbillonnant de la trombe au point (x, z) du monde (m/s, à ajouter au vent) : un
  // tourbillon de Rankine, qui tourne dans le sens inverse des aiguilles d'une montre et aspire
  // un peu vers son centre
  ventTrombe(x, z, sortie = new Vector3()) {
    sortie.set(0, 0, 0);
    const t = this.trombe;
    if (!t || t.force <= 0) return sortie;
    const dx = x - t.x;
    const dz = z - t.z;
    const d = Math.max(1, Math.hypot(dx, dz));
    const coeur = BETE.coeur;
    const vmax = BETE.vmax * t.force;
    const v = (d < coeur ? (vmax * d) / coeur : (vmax * coeur) / d) * (1 - lisse(300, 600, d));
    return sortie.set((dz / d) * v - (dx / d) * v * 0.3, 0, (-dx / d) * v - (dz / d) * v * 0.3);
  }

  // La pression de la trombe au point (x, z) (hPa, à ajouter) : 17 hPa de moins en son centre,
  // un hectopascal à 150 m, presque rien au-delà de 300 m
  pressionTrombe(x, z) {
    const t = this.trombe;
    if (!t || t.force <= 0) return 0;
    const d = Math.hypot(x - t.x, z - t.z);
    if (d > 600) return 0;
    const c = BETE.coeur;
    const v = BETE.vmax * t.force;
    const k = d < c ? 1 - (d * d) / (2 * c * c) : (c * c) / (2 * d * d);
    return (-1.2 * v * v * k * (1 - lisse(300, 600, d))) / 100;
  }

  // ---------- Les grains ----------
  suivreGrains(dt, ctx) {
    const p = ctx.physique.position;
    const v = ctx.physique.vitesse;
    // ceux qui viendront sur nous : lancés à leur heure
    this.plansGrains.forEach((plan, k) => {
      const id = `grain${k}`;
      if (this.faits.has(id) || this.heure < this.prevu[id]) return;
      this.faits.add(id);
      this.lancerGrain(plan, ctx, DANS_GRAIN, k);
    });
    this.grains.maj(dt, this.meteo, p.x, p.z, v.x, v.z);
    const ici = (this.ici = this.grains.mesurer(p.x, p.z, this.ici ?? {}));
    // celui qui vient sur nous : à moins de 3,3 km, on le voit au radar
    const m = this.grains.menace(p.x, p.z, v.x, v.z, { horizon: 260, cpaMax: 1300 });
    if (m && !m.grain.faits.vu && m.distance < 3300) this.voirGrain(m, ctx);
    this.menaceGrain = m && m.grain.faits.vu && !m.grain.faits.rafale ? m : null;
    // sa rafale arrive sur nous
    const g = ici.grain;
    if (g && ici.agitation > 0.3 && !g.faits.rafale) {
      g.faits.rafale = true;
      g.faits.ventMax = 0;
      this.stats.grains++;
      this.emettre('grain-rafale', g);
    }
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
    return g;
  }

  // Où est le point (x, z), vu du bateau (degrés compas)
  releveDe(x, z, ctx) {
    const p = ctx.physique.position;
    return ((Math.atan2(x - p.x, -(z - p.z)) * 180) / Math.PI + 360) % 360;
  }

  // Un grain vient sur nous : on le voit au radar (le journal le note)
  voirGrain(m, ctx) {
    const g = m.grain;
    g.faits.vu = true;
    const c = this.grains.noyau(g, g.noyaux[0], {});
    const releve = this.releveDe(c.x, c.z, ctx);
    this.emettre('grain', { grain: g, releve, relatif: ecartAngle(releve, ctx.m.cap), distance: m.distance, dans: m.dans, cpa: m.cpa });
  }

  // Le vent des grains au point (x, z) (m/s, à ajouter au vent, comme celui de la trombe)
  ventGrains(x, z, sortie = new Vector3()) {
    return this.grains.ventEn(x, z, sortie);
  }

  // ---------- Le baromètre ----------
  // La pression ici : celle de la dépression (monde/pression.js, dont le front passait à 3 h 20 ;
  // ici, il passe vers 4 h 30 : on décale sa courbe d'une heure et quart), le bond des grains
  // quand arrive leur rafale, et le creux de la trombe quand elle passe tout près
  suivreBarometre(dt, ctx) {
    const p = ctx.physique.position;
    this.pression = pressionDuJour(this.heure - DECALAGE_PRESSION) + this.grains.pressionEn(p.x, p.z) + this.pressionTrombe(p.x, p.z);
  }

  // ---------- La foudre ----------
  // Elle part des nuages des grains et de celui de la trombe (monde/foudre.js) ; le jeu en fait
  // le bruit et la lumière, la nuit en tire les conséquences : le journal, et la foudre sur le
  // mât, qui fait disjoncter le pilote.
  suivreFoudre(dt, ctx) {
    const p = ctx.physique.position;
    const f = this.foudre;
    f.maj(dt, { meteo: this.meteo, grains: this.grains, trombe: this.trombe, x: p.x, z: p.z, ecoute: ctx.ecoute ?? null });
    for (const ev of f.evenements) {
      if (ev.type === 'eclair' && ev.eclair.type !== 'front') {
        this.stats.eclairs++;
        this.stats.eclairPlusPres = Math.min(this.stats.eclairPlusPres ?? Infinity, ev.distance);
      } else if (ev.type === 'frappe') this.frappeFoudre(ev, ctx);
    }
    // le feu de Saint-Elme : sous le cœur d'un nuage d'orage, une lueur violette en tête de mât
    if (f.champ > 0.6 && !this.faits.has('saintElme') && ctx.aBord?.dehors !== false) {
      this.faits.add('saintElme');
      this.ecrire('Une lueur violette en tête de mât : le feu de Saint-Elme.');
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
      else this.ecrire('La foudre est tombée sur le mât !');
      return;
    }
    this.ecrire(`La foudre est tombée à ${Math.max(10, Math.round(ev.distance / 10) * 10)} m du bateau.`);
  }

  // ---------- L'étrange ----------
  // Rien n'est jamais expliqué ni confirmé. Chaque chose arrive une fois, et seulement si le
  // marin est là pour la voir ou l'entendre (sinon, elle attend un peu, puis passe).
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
    // une lumière sur l'eau, au loin, dans le creux des vagues : il faut être dehors, ou dans
    // la timonerie (on voit dehors par les vitres)
    if (pret('lumiere')) {
      if (ctx.aBord.dehors || ctx.lieu === 'timonerie') arrive('lumiere', 'Une lumière sur l\'eau, au loin. Puis plus rien.');
      else if (h > this.prevu.lumiere + 0.6) this.faits.add('lumiere');
    }
    // une voix sur le 16 (le haut-parleur de la VHF s'entend de partout)
    if (pret('voix16')) arrive('voix16', 'Une voix sur le 16. Trop brouillée pour comprendre.');
    // des coups contre la coque : on ne les entend qu'à l'intérieur
    if (pret('coups')) {
      if (!ctx.aBord.dehors) arrive('coups', 'Des coups contre la coque, à l\'avant. Trois.');
      else if (h > this.prevu.coups + 0.8) this.faits.add('coups');
    }
  }

  // ---------- La peur ----------
  // (le jeu donne ce que le marin regarde : ctx.regard ; les marins automatiques n'ont pas peur)
  suivrePeur(dt, ctx) {
    if (!ctx.regard) return;
    const w = this.scelerates?.vague;
    const occupe = (w && w.distance > -250) || (this.trombe && this.trombe.force > 0.1 && this.trombe.distance < 900) || (ctx.danger ?? 0) > 0.4;
    const evts = this.peur.maj(dt, {
      heure: this.heure, lieu: ctx.lieu, yeux: ctx.yeux, regard: ctx.regard, haut: ctx.haut, tanX: ctx.tanX, tanY: ctx.tanY,
      lampe: ctx.lampe, eclairage: ctx.eclairage, noir: ctx.noir ?? 0,
      eclair: ctx.eclair ?? 0, danger: ctx.danger ?? 0, calme: ctx.calme ?? 0, occupe, silence: true,
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
      } else if (e === 'silhouette-fin' || e === 'reflet-fin' || e === 'forme-fin') {
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
      emporte: 'Emporté par une déferlante.',
      horsBord: 'Passé par-dessus bord.',
      bome: 'Assommé par la bôme.',
    }[raison] ?? 'Naufrage.');
    this.emettre('perdue', raison);
  }

  leverDuJour() {
    this.etat = 'aube';
    this.ecrire('Six heures. Le jour se lève : tenu toute la nuit.');
    this.emettre('aube');
  }

  // Le bilan, à l'aube (ou au naufrage)
  bilan() {
    const s = this.stats;
    const av = this.avaries;
    const avaries = [
      av.ecouteFoc !== 'ok' && `écoute de foc ${av.ecouteFoc === 'reparee' ? 'cassée puis remplacée' : 'cassée'}`,
      av.foc !== 'ok' && 'foc déchiré',
      av.pilote !== 'ok' && 'pilote en panne',
    ].filter(Boolean);
    const virgule = (x) => x.toFixed(1).replace('.', ',');
    const milles = (m) => `${virgule(m / 1852)} mille${m >= 2 * 1852 ? 's' : ''}`;
    const metres = (d) => (d === Infinity ? '—' : d > 1500 ? milles(d) : `${Math.round(d / 10) * 10} m`);
    return [
      ['Heure', heureEnTexte(Math.min(this.heure, HEURE_AUBE))],
      ['Déferlantes encaissées', `${s.deferlantes}${s.coups ? ` (dont ${s.coups} qui t'ont couché)` : ''}`],
      ['Gîte la plus forte', `${Math.round(s.giteMax)}°`],
      ['Eau pompée', `${Math.round(s.pompee)} litres à la main, ${Math.round(this.systemes.pompe.pompee)} par la pompe électrique (au plus ${Math.round(s.caleMax)} à bord)`],
      ['Avaries', avaries.length ? avaries.join(', ') : 'aucune'],
      ['Les sorties', this.bilanSorties()],
      ['La trombe', s.trombeDistance === Infinity ? 'pas vue' : `passée à ${metres(s.trombeDistance)}`],
      ['Les vagues scélérates', s.scelerates ? `${s.scelerates}${s.sceleratesCouche ? ` (dont ${s.sceleratesCouche} qui t'${s.sceleratesCouche > 1 ? 'ont' : 'a'} couché)` : ', passées sans être couché'}` : 'aucune'],
      ['Les grains', s.grains ? `${s.grains}, rafales jusqu'à ${Math.round(s.rafaleMax)} nœuds` : 'aucun sur toi'],
      ['La foudre', s.surLeMat ? `${s.eclairs} éclairs, et un sur le mât !` : s.eclairs ? `${s.eclairs} éclair${s.eclairs > 1 ? 's' : ''}, le plus proche à ${metres(s.eclairPlusPres ?? Infinity)}` : 'pas un éclair'],
      ...this.bilanSystemes(),
    ];
  }

  // les deux sorties forcées : le foc qui battait, les dalots bouchés
  bilanSorties() {
    const s = this.stats;
    const av = this.avaries;
    const sorties = [
      av.ecouteFoc !== 'ok' && (s.focRoule ? `le foc roulé à ${heureEnTexte(s.focRoule)}` : 'le foc a battu jusqu\'au bout'),
      av.dalots !== 'ok' && (s.dalotsDegages ? `les dalots dégagés à ${heureEnTexte(s.dalotsDegages)}` : 'les dalots sont restés bouchés'),
    ].filter(Boolean);
    return sorties.length ? sorties.join(' ; ') : 'aucune';
  }

  bilanSystemes() {
    const sy = this.systemes;
    const st = sy.stats;
    const minutes = (secondes) => Math.round((secondes * 3600) / DUREE_HEURE / 60);
    const brisees = sy.vitres.filter((v) => v.etat === 'brisee').length;
    const fendues = sy.vitres.filter((v) => v.etat === 'fendue').length;
    return [
      ['Le courant', `${Math.round(sy.batterie.charge * 100)} % à la fin, ${Math.round(st.chargeMin * 100)} % au plus bas${st.noir > 1 ? ` ; ${minutes(st.noir)} minutes dans le noir` : ''}`],
      ['Le moteur', st.moteur > 1 ? `${minutes(st.moteur)} minutes de moteur, ${this.stats.demarrages ?? 0} démarrage${(this.stats.demarrages ?? 0) > 1 ? 's' : ''}` : 'jamais démarré'],
      ['Les vitres', brisees || fendues ? [brisees && `${brisees} brisée${brisees > 1 ? 's' : ''}`, fendues && `${fendues} fendue${fendues > 1 ? 's' : ''}`].filter(Boolean).join(', ') : 'toutes intactes'],
    ];
  }

  // ---------- Aller directement à une heure (pour l'atelier, et pour vérifier) ----------
  // Les imprévus d'avant cette heure sont considérés comme passés.
  allerA(heure) {
    this.heure = Math.min(HEURE_AUBE, Math.max(HEURE_DEBUT, heure));
    this.t = (this.heure - HEURE_DEBUT) * DUREE_HEURE;
    this.commence = true;
    this.tReprise = this.t;
    for (const nom of ['trombe', 'grainBete', 'lumiere', 'voix16', 'coups', 'scelerate0', 'scelerate1']) if (this.prevu[nom] < this.heure) this.faits.add(nom);
    for (const nom of ['ecouteFoc']) if (this.prevu[nom] < this.heure) this.prevu[nom] = Infinity;
    this.plansGrains.forEach((plan, k) => { if (this.prevu[`grain${k}`] < this.heure) this.faits.add(`grain${k}`); });
    this.grains.vider();
    this.grainBete = null;
    this.foudre.vider();
    this.ici = null;
    this.meteo = meteoDeLaNuit(this.heure, this.niveau);
  }

  // Une déferlante tout de suite (force 0 → 1,3), pour vérifier
  provoquerDeferlante(force = 1) {
    const a = angleVers(this.meteo.directionVent);
    this.deferlantes.annonce = { force, vers: new Vector3(Math.cos(a), 0, Math.sin(a)), dans: preavis(force), duree: preavis(force) };
    this.annonceVue = null;
    this.deferlantes.annonce.force /= this.niveau.force * this.programme.force; // (maj() la multipliera)
  }

  // ---------- Reprendre au début de l'heure (après un naufrage) ----------
  instantane(ctx) {
    const p = ctx.physique;
    return {
      heure: Math.floor(this.heure + 1e-6),
      eau: { ...this.eau, cale: Math.min(this.eau.cale, 100), cockpit: 0 },
      avaries: { ...this.avaries },
      fatigue: { ...this.fatigue },
      prevu: { ...this.prevu },
      faits: new Set(this.faits),
      stats: { ...this.stats },
      peur: this.peur.instantane(),
      voiles: { ris: p.ris, deroule: p.deroule, ecouteFocLibre: p.ecouteFocLibre, focDechire: p.focDechire },
      systemes: this.systemes.instantane(),
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

  // Revenir à un instantané (le début de l'heure, ou une partie gardée par le navigateur)
  restaurer(s, ctx) {
    if (!s) return;
    Object.assign(this, {
      heure: s.heure, eau: { ...s.eau }, avaries: { dalots: 'ok', ...s.avaries }, fatigue: { ...s.fatigue },
      prevu: { ...this.prevu, ...s.prevu }, faits: new Set(s.faits),
      stats: {
        ...s.stats,
        trombeDistance: s.stats.trombeDistance ?? Infinity, eclairPlusPres: s.stats.eclairPlusPres ?? Infinity,
      },
      etat: 'nuit', raison: null, trombe: null, suiviCoup: null, renverse: 0, annonceVue: null, commence: true,
    });
    this.t = (this.heure - HEURE_DEBUT) * DUREE_HEURE;
    this.sauvegarde = { ...s, faits: new Set(s.faits) };
    this.heureSauvegarde = s.heure;
    // (JSON : Infinity devient null)
    for (const nom of Object.keys(this.prevu)) this.prevu[nom] ??= Infinity;
    this.scelerates?.finir();
    this.aLancer = null;
    // (les grains : ceux d'alentour renaîtront ; ceux qui venaient sur nous repartent ; celui de
    // la bête revient s'il n'est pas trop tard)
    this.grains.vider();
    this.foudre.vider();
    this.ici = null;
    this.menaceGrain = null;
    this.grainBete = null;
    if (!this.faits.has('trombe')) this.faits.delete('grainBete');
    this.vitesseLissee = null;
    for (const r of s.grainsEnRoute ?? []) if (this.plansGrains[r.plan]) this.lancerGrain(this.plansGrains[r.plan], ctx, r.dans, r.plan);
    this.peur.restaurer(s.peur);
    this.systemes.restaurer(s.systemes);
    // (le pilote : son disjoncteur suit la panne gardée)
    this.systemes.pilote.disjoncte = this.avaries.pilote === 'panne';
    this.dernierEtrange = null;
    this.deferlantes.annonce = null;
    this.deferlantes.attente = 8;
    this.tReprise = this.t;
    const p = ctx.physique;
    Object.assign(p, s.voiles);
    p.eauCale = this.eau.cale;
    p.eauCockpit = 0;
    this.meteo = meteoDeLaNuit(this.heure, this.niveau);
    this.ecrire(`Reprise à ${heureRonde(this.heure)}.`);
  }
}
