// La journée d'apprentissage jouée par un « élève » automatique, sans navigateur :
//   node scripts/test-journee.js
// L'élève fait ce que Jos demande, étape par étape, avec la vraie physique du voilier, la
// vraie houle et le vrai vent (qui forcit d'heure en heure). On vérifie que :
//   1. chaque leçon se réussit (aucune étape ne reste bloquée) ;
//   2. les manœuvres sont bien reconnues (virements, empannages, tours de bouée) ;
//   3. la journée a la bonne durée, et l'heure avance de 9 h au coucher du soleil.
// L'élève est un programme : il barre comme un pilote automatique et règle ses voiles
// au mieux (sauf quand la leçon demande de les dérégler).
import { PhysiqueVoilier } from '../src/physique/voilier.js';
import { reglerAutomatiquement } from '../src/physique/regleur.js';
import { Houle } from '../src/mer/houle.js';
import { Vent } from '../src/monde/vent.js';
import { etatMer } from '../src/monde/meteo.js';
import { Journee, meteoDuJour, heureEnTexte } from '../src/jeu/journee.js';
import { LECONS } from '../src/jeu/lecons.js';

let echecs = 0;
const verifier = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) echecs++;
};

// La radio : ici, Jos parle instantanément (on compte seulement ses conseils)
const paroles = [];
const radio = {
  libre: true,
  parler(phrases) {
    paroles.push(...phrases);
    return { then: (f) => f(true) };
  },
  taire() {},
};

const DT = 1 / 30;
const houle = new Houle({ graine: 4 });
let meteo = meteoDuJour(9);
houle.regler(etatMer(meteo));
const b = new PhysiqueVoilier();
const vent = new Vent(3);
b.placer(0, 0, (meteo.directionVent - 65 + 360) % 360, houle);
b.vitesse.copy(b.avant).multiplyScalar(2);
b.deroule = 0.5;
const etat = {
  pilote: true, regleurAuto: true, mode: 'barre', feux: false, lampeEssayee: false, gilet: false, barometreLu: false,
  descenteOuverte: true, attache: false, dehors: true, zone: 'cockpit', evenements: new Set(),
};
const j = new Journee({ radio });

// ---------- L'élève ----------
const tour = (a) => ((a % 360) + 540) % 360 - 180;
let capVise = null;
// Barrer vers un cap (comme le pilote automatique du jeu)
function barrer(cap) {
  const erreur = tour(b.mesures.cap - cap);
  const voulu = Math.max(-0.5, Math.min(0.5, -erreur * 0.04 + b.rotation.y * 1.6));
  b.barre += Math.max(-0.9 * DT, Math.min(0.9 * DT, voulu - b.barre));
}
// Le cap qui met le vent à « angle » du côté « cote » (+1 : le vent vient de tribord)
function capPourVent(angle, cote) {
  const a = b.mesures.angleVentReel;
  return (b.mesures.cap + (a - cote * angle) + 360) % 360;
}
const coteActuel = () => (b.mesures.angleVentReel >= 0 ? 1 : -1);
// Le vent tel qu'on le mesure à bord (avec ses bascules) : d'où il vient, en degrés
const ventMesure = () => (b.mesures.cap + b.mesures.angleVentReel + 360) % 360;
// Aller vers un point : tout droit si on peut, en tirant des bords s'il est au vent
function allerVers(x, z, nav) {
  const p = b.position;
  const vers = ((Math.atan2(x - p.x, -(z - p.z)) * 180) / Math.PI + 360) % 360;
  const vent = ventMesure();
  const rel = tour(vers - vent); // où est le but par rapport au vent
  if (Math.abs(rel) >= 50) {
    nav.louvoie = false;
    return vers;
  }
  // le but est dans la zone interdite : on louvoie (au près, à 46° du vent)
  if (!nav.louvoie) Object.assign(nav, { louvoie: true, cote: rel < 0 ? 1 : -1, depuis: 0 });
  nav.depuis += DT;
  if (nav.depuis > 15 && -nav.cote * rel > 10) {
    nav.cote *= -1;
    nav.depuis = 0;
  }
  return (vent - nav.cote * 46 + 360) % 360;
}
// Contourner une bouée : on passe par quatre points autour d'elle, à 35 m, dans le sens
// inverse des aiguilles d'une montre
function contourner(id, nav) {
  const bouee = j.bouees.get(id);
  const p = b.position;
  if (nav.angle === undefined) nav.angle = Math.atan2(p.z - bouee.z, p.x - bouee.x);
  const px = bouee.x + Math.cos(nav.angle + Math.PI / 2) * 35;
  const pz = bouee.z + Math.sin(nav.angle + Math.PI / 2) * 35;
  if (Math.hypot(px - p.x, pz - p.z) < 18) nav.angle += Math.PI / 2;
  return allerVers(px, pz, nav);
}
function versBouee(id, nav) {
  const bouee = j.bouees.get(id);
  return allerVers(bouee.x, bouee.z, nav);
}

const tache = { id: null, t: 0, phase: 0 };
function eleve(ctx) {
  const id = j.etat === 'lecon' ? j.etape?.id : null;
  if (id !== tache.id) Object.assign(tache, { id, t: 0, phase: 0, cap: b.mesures.cap });
  tache.t += DT;
  let regler = true; // régler les voiles au mieux
  let cap = capVise ?? b.mesures.cap;
  switch (id) {
    case 'barrer.pilote': etat.pilote = false; break;
    case 'barrer.droite': cap = tache.cap + 40; break;
    case 'barrer.gauche': cap = tache.cap - 40; break;
    case 'barrer.bouee': cap = versBouee('jaune', tache); break;
    case 'vent.face': cap = meteo.directionVent; break;
    case 'vent.travers': cap = capPourVent(90, coteActuel()); break;
    case 'vent.largue': cap = capPourVent(140, coteActuel()); break;
    case 'vent.risee': cap = capPourVent(90, coteActuel()); break;
    case 'gv.auto': etat.regleurAuto = false; break;
    case 'gv.faseyer':
      cap = capPourVent(90, coteActuel());
      regler = false;
      b.ecouteGV = 1.45;
      break;
    case 'gv.border': cap = capPourVent(90, coteActuel()); break;
    case 'gv.pres': cap = capPourVent(52, coteActuel()); break;
    case 'gv.largue': cap = capPourVent(125, coteActuel()); break;
    case 'foc.derouler': b.deroule = Math.min(1, b.deroule + 0.22 * DT); break;
    case 'foc.winch':
      etat.pilote = true;
      etat.mode = 'pied';
      if (tache.t > 4) etat.evenements.add('winch-borde');
      break;
    case 'foc.regler':
      etat.pilote = false;
      etat.mode = 'barre';
      cap = capPourVent(52, coteActuel());
      break;
    case 'virer.virements':
      // au près, puis on vire toutes les 25 secondes
      tache.cote0 ??= coteActuel();
      if (tache.t > 20 * (tache.phase + 1)) tache.phase++;
      cap = capPourVent(46, tache.phase % 2 === 0 ? tache.cote0 : -tache.cote0);
      break;
    case 'virer.bouee': cap = contourner('rouge', tache); break;
    case 'empanner.empannage': {
      // vent arrière vers la bouée, puis on borde, on empanne, on choque
      tache.cote0 ??= coteActuel();
      if (tache.t < 15) {
        cap = capPourVent(150, tache.cote0);
      } else {
        regler = false;
        b.ecouteGV = Math.max(0.25, b.ecouteGV - 0.5 * DT);
        cap = b.ecouteGV <= 0.3 ? capPourVent(150, -tache.cote0) : capPourVent(160, tache.cote0);
      }
      break;
    }
    case 'empanner.bouee': {
      cap = contourner('verte', tache);
      // en passant le vent arrière, on borde avant (comme Jos l'a appris)
      if (Math.abs(b.mesures.angleVentReel) > 160) {
        regler = false;
        b.ecouteGV = Math.max(0.3, b.ecouteGV - 0.6 * DT);
      }
      break;
    }
    case 'ris.ris':
      etat.pilote = true;
      etat.mode = 'pied';
      etat.attache = true;
      if (tache.t > 8 && b.ris < 1) b.ris = 1;
      break;
    case 'ris.foc': b.deroule = Math.max(0.5, b.deroule - 0.22 * DT); break;
    case 'ris.barre': etat.mode = 'barre'; etat.pilote = false; break;
    case 'nuit.liste':
      etat.pilote = true;
      etat.mode = 'pied';
      if (tache.t > 6) b.ris = 2;
      b.deroule = Math.max(0.35, b.deroule - 0.22 * DT);
      if (tache.t > 10) etat.dehors = false;
      if (tache.t > 14) etat.gilet = true;
      if (tache.t > 18) etat.feux = true;
      // (dans la timonerie, aussi : le baromètre, l'aiguille témoin calée)
      if (tache.t > 19) etat.barometreLu = true;
      if (tache.t > 20) { etat.dehors = true; etat.descenteOuverte = false; }
      if (tache.t > 22) etat.lampeEssayee = true;
      if (tache.t > 24) etat.attache = true;
      break;
    default: break;
  }
  capVise = cap;
  if (etat.pilote || etat.mode === 'barre') barrer(cap);
  if (etat.regleurAuto || regler) reglerAutomatiquement(b, DT);
}

function contexte() {
  return {
    dt: DT, m: b.mesures, physique: b, meteo, ventDe: meteo.directionVent,
    pilote: etat.pilote, regleurAuto: etat.regleurAuto, mode: etat.mode,
    aBord: {
      feux: etat.feux, lampeEssayee: etat.lampeEssayee, gilet: etat.gilet, descenteOuverte: etat.descenteOuverte,
      attache: etat.attache, dehors: etat.dehors, zone: etat.mode === 'pied' ? 'passavant' : 'cockpit', barometreLu: etat.barometreLu,
    },
    evenements: etat.evenements,
    risee: vent.risees.mesurer(b.position.x, b.position.z, b.vitesse.x, b.vitesse.z, risee),
    envoyerRisee: (o) => vent.risees.envoyer({ x: b.position.x, z: b.position.z, vbx: b.vitesse.x, vbz: b.vitesse.z, ...o }),
  };
}
const risee = {};

// ---------- La journée ----------
const fins = [];
let t = 0;
let etapeBloquee = null;
let tEtape = 0;
let etapePrecedente = null;
const tMax = 45 * 60;
const trajet = { xMin: 0, xMax: 0, zMin: 0, zMax: 0 }; // où le bateau est allé (m)
const tempsDepart = performance.now();
for (let n = 0; t < tMax && j.etat !== 'finie'; n++) {
  t = n * DT;
  if (n % 90 === 0) {
    meteo = meteoDuJour(j.heure);
    houle.regler(etatMer(meteo));
  }
  houle.calculer(t, DT);
  eleve(contexte());
  trajet.xMin = Math.min(trajet.xMin, b.position.x);
  trajet.xMax = Math.max(trajet.xMax, b.position.x);
  trajet.zMin = Math.min(trajet.zMin, b.position.z);
  trajet.zMax = Math.max(trajet.zMax, b.position.z);
  b.avancer(DT, houle, vent.maj(t, DT, meteo, 0, b.position.x, b.position.z), 8);
  const ctx = contexte();
  const avant = j.i;
  j.maj(DT, ctx);
  etat.evenements = new Set();
  if (j.i !== avant || (j.etat === 'transition' && !fins[avant])) {
    if (!fins[avant]) {
      fins[avant] = { t, heure: j.heure };
      console.log(`  leçon ${avant + 1} « ${LECONS[avant].titre} » réussie à ${(t / 60).toFixed(1)} min (heure du bord : ${heureEnTexte(j.heure)})`);
    }
  }
  const id = j.etape?.id;
  if (id !== etapePrecedente) { etapePrecedente = id; tEtape = 0; }
  tEtape += DT;
  if (tEtape > 300 && !etapeBloquee) {
    etapeBloquee = id;
    console.log(`  … bloqué à l'étape « ${id} » depuis 5 min (vent ${meteo.vent.toFixed(0)} nds, angle au vent ${b.mesures.angleVentReel.toFixed(0)}°, vitesse ${b.mesures.vitesse.toFixed(1)} nds)`);
    break;
  }
}
const duree = (performance.now() - tempsDepart) / 1000;
console.log(`\n(simulé ${(t / 60).toFixed(1)} min de jeu en ${duree.toFixed(0)} s)`);

console.log('\n1. Toutes les leçons');
verifier(j.etat === 'finie', `la journée va jusqu'au bout (${j.reflexes.length} réflexes notés sur ${LECONS.length})`);
verifier(!etapeBloquee, etapeBloquee ? `bloqué à « ${etapeBloquee} »` : 'aucune étape ne reste bloquée');
console.log('2. Les manœuvres reconnues');
const c = j.compteurs;
console.log(`  virements ${c.virements}, empannages ${c.empannages} (maîtrisés ${c.empannagesControles}, sauvages ${c.empannagesSauvages})`);
verifier(c.virements >= 2, 'au moins deux virements');
verifier(c.empannagesControles >= 1, 'au moins un empannage maîtrisé');
verifier(j.journal.some((e) => e.texte.includes('bouée rouge')), 'la bouée rouge contournée');
verifier(j.journal.some((e) => e.texte.includes('bouée verte')), 'la bouée verte contournée');
console.log('3. La durée et l\'heure');
verifier(t / 60 > 8 && t / 60 < 30, `la journée dure ${(t / 60).toFixed(0)} min de jeu pour un élève parfait (entre 8 et 30)`);
verifier(j.heure > 18.6, `elle finit au coucher du soleil (${heureEnTexte(j.heure)})`);
console.log(`  Jos a parlé ${paroles.length} fois (consignes, bravos et conseils)`);
console.log(`  le bateau est resté entre x ${trajet.xMin.toFixed(0)} et ${trajet.xMax.toFixed(0)} m, z ${trajet.zMin.toFixed(0)} et ${trajet.zMax.toFixed(0)} m (le nord est vers les z négatifs)`);
console.log('\nLe journal de bord :');
for (const e of j.journal) console.log(`  ${heureEnTexte(e.heure).padStart(8)}  ${e.texte}`);

console.log(echecs ? `\n${echecs} vérification(s) en échec` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
