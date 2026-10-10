// Atelier de la mer : régler la mer, le ciel et la lumière, et comparer les ambiances.
//
// Adresse : atelier-mer.html?ambiance=midi&vue=pont&cap=200
//   ambiance : une des ambiances de monde/meteo.js · vue : pont, large ou ras
//   cap : direction du regard en degrés (0 = nord)
import * as THREE from 'three';
import { Monde3D } from './rendu/monde3d.js';
import { AMBIANCES, etatMeteo } from './monde/meteo.js';
import { Bateau } from './bateau/bateau.js';
import { Scelerates } from './monde/scelerates.js';
import { positionCrete, LONGUEUR_PAR_METRE } from './mer/scelerate.js';

const parametres = new URLSearchParams(location.search);
const canvas = document.getElementById('scene');
const monde = new Monde3D(canvas);
let meteo = etatMeteo(AMBIANCES[parametres.get('ambiance')] ?? AMBIANCES.midi);
monde.regler(meteo);
const bateau = monde.ajouterBateau();

// ---------- Point de vue ----------
const regard = { cap: Number(parametres.get('cap') ?? 230), site: Number(parametres.get('site') ?? 4) }; // degrés
let vue = parametres.get('vue') ?? 'pont';
let distanceOrbite = Number(parametres.get('distance') ?? 24);
let hauteurLissee = 0;

function directionRegard() {
  const cap = THREE.MathUtils.degToRad(regard.cap);
  const site = THREE.MathUtils.degToRad(regard.site);
  return new THREE.Vector3(Math.sin(cap) * Math.cos(site), Math.sin(site), -Math.cos(cap) * Math.cos(site));
}

// Réglage automatique des voiles selon l'angle du vent (en attendant les commandes) :
// plus le vent vient de l'arrière, plus on choque (on laisse partir) les voiles.
function reglerVoiles() {
  const r = bateau.reglage;
  const twa = ((meteo.directionVent - bateau.cap + 540) % 360) - 180; // + : vent venant de tribord
  const a = Math.abs(twa);
  const cote = twa >= 0 ? -1 : 1; // la grand-voile part du côté opposé au vent
  const rad = THREE.MathUtils.degToRad;
  r.cote = cote;
  r.coteFoc = cote;
  r.angleBome = cote * rad(THREE.MathUtils.clamp(0.5 * (a - 25), 3, 85));
  r.angleFoc = cote * rad(THREE.MathUtils.clamp(0.33 * (a - 18), 7, 32));
  // trop face au vent : les voiles faseyent
  const fas = THREE.MathUtils.smoothstep(a, 25, 42);
  r.faseyement = 1 - fas;
  r.faseyementFoc = Math.min(1, 1 - fas + (a > 150 ? (a - 150) / 30 : 0)); // vent arrière : le foc est déventé
  // par gros temps, on réduit la toile
  r.ris = meteo.vent > 30 ? 2 : meteo.vent > 20 ? 1 : 0;
  r.deroule = meteo.vent > 30 ? 0.35 : meteo.vent > 22 ? 0.7 : 1;
  // la gîte : le vent de travers fait pencher le bateau sous le vent
  const force = Math.min(1, meteo.vent / 22) * Math.sin(rad(Math.min(a, 100))) * fas;
  // (gîte > 0 : le bateau penche sur tribord ; vent de tribord → il penche sur bâbord)
  bateau.gite = (twa >= 0 ? -1 : 1) * rad(24) * force;
  r.force = force;
  // les instruments (des valeurs approchées : l'atelier n'a pas la vraie physique)
  bateau.instruments.maj(1 / 60, {
    vitesse: balade.vitesse / 0.5144, cap: bateau.cap, angleVentApparent: twa * 0.75, ventApparent: meteo.vent * 1.1,
    incidenceFoc: a < 35 ? 4 : 20, incidenceGV: 20,
  }, monde.ecl.nuit);
  // la nuit : feux de navigation et lampe frontale
  const nuit = monde.ecl.nuit;
  bateau.allumerFeux(nuit);
  monde.lampeFrontale(nuit > 0.6);
  // la cabine : le jour par les hublots, les plafonniers allumés la nuit
  bateau.interieur.regler({
    eclairage: nuit > 0.6 ? 'blanc' : 'eteint', feux: nuit > 0.5, ciel: monde.ecl.ambiance, eclair: monde.eclair.intensite,
    pression: 1024 - 6 * meteo.nuages - 34 * meteo.orage, heure: meteo.heure, nuit,
  });
}

const _q = new THREE.Quaternion();
function placerCamera(dt) {
  const cam = monde.camera;
  const direction = directionRegard();
  if (vue === 'cargo' && monde.etatCargo) {
    // en orbite autour du cargo (quand il est là)
    const cible = new THREE.Vector3(monde.etatCargo.x, 12, monde.etatCargo.z);
    cam.position.copy(cible).addScaledVector(direction, -distanceOrbite);
    cam.position.y = Math.max(cam.position.y, monde.houle.hauteur(cam.position.x, cam.position.z) + 3);
    cam.lookAt(cible);
    return;
  }
  if (vue === 'large' || vue === 'cargo') {
    // en orbite autour du bateau
    const cible = bateau.groupe.position.clone().add(new THREE.Vector3(0, 3.5, 0));
    cam.position.copy(cible).addScaledVector(direction, -distanceOrbite);
    cam.position.y = Math.max(cam.position.y, monde.houle.hauteur(cam.position.x, cam.position.z) + 3);
    cam.lookAt(cible);
    return;
  }
  if (vue === 'ras') {
    // au ras de l'eau, à quelques mètres du bateau
    const p = bateau.groupe.position.clone().add(new THREE.Vector3(-8, 0, 6));
    const h = monde.houle.hauteur(p.x, p.z);
    hauteurLissee += (h - hauteurLissee) * Math.min(1, dt * 6);
    cam.position.set(p.x, hauteurLissee + 0.7, p.z);
    cam.lookAt(cam.position.clone().add(direction));
    return;
  }
  // à bord, assis à la barre : la tête suit le bateau, mais compense une partie du roulis
  cam.position.copy(Bateau.POSTES.barreur).applyMatrix4(bateau.groupe.matrixWorld);
  cam.lookAt(cam.position.clone().add(direction));
  _q.copy(bateau.groupe.quaternion);
  const roulis = new THREE.Euler().setFromQuaternion(_q, 'YXZ');
  cam.rotateZ(roulis.z * 0.55);
}

// glisser pour regarder autour de soi
let glisse = null;
canvas.addEventListener('pointerdown', (e) => {
  glisse = { x: e.clientX, y: e.clientY, cap: regard.cap, site: regard.site };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!glisse) return;
  const sensibilite = monde.camera.fov / canvas.clientHeight;
  regard.cap = glisse.cap - (e.clientX - glisse.x) * sensibilite;
  regard.site = THREE.MathUtils.clamp(glisse.site + (e.clientY - glisse.y) * sensibilite, -60, 80);
});
canvas.addEventListener('pointerup', () => { glisse = null; });

// ---------- La balade : barrer avec le clavier ----------
// Flèches ← → (ou Q et D sur un clavier français : on lit la position de la touche,
// pas la lettre). Le bateau avance selon l'angle du vent : arrêté face au vent,
// le plus vite par vent de travers. (Une vraie physique viendra à l'étape 2.)
const touches = new Set();
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  touches.add(e.code);
});
addEventListener('keyup', (e) => touches.delete(e.code));
addEventListener('blur', () => touches.clear());
const balade = { vitesse: 0, barre: 0 };

// Vitesse (nœuds) d'un croiseur de 9 m selon le vent réel (nœuds) et l'angle du vent
function vitessePolaire(vent, angle) {
  const a = Math.abs(angle);
  const forme = a < 32 ? 0 : a < 52 ? (a - 32) / 20 * 0.82 : a < 100 ? 0.82 + (a - 52) / 48 * 0.18 : 1 - (a - 100) / 80 * 0.22;
  return Math.min(7.4, 0.42 * vent + 1.4) * forme * (vent > 1 ? 1 : vent);
}

function naviguer(dt) {
  let ordre = 0;
  if (touches.has('ArrowLeft') || touches.has('KeyA')) ordre -= 1;
  if (touches.has('ArrowRight') || touches.has('KeyD')) ordre += 1;
  balade.barre += (ordre - balade.barre) * Math.min(1, dt * 3);
  const twa = ((meteo.directionVent - bateau.cap + 540) % 360) - 180;
  const cible = vitessePolaire(meteo.vent, twa) * 0.5144;
  balade.vitesse += (cible - balade.vitesse) * Math.min(1, dt * 0.18);
  // le bateau tourne d'autant mieux qu'il avance (le safran a besoin d'eau qui coule)
  const virage = balade.barre * (5 + balade.vitesse * 3.2) * dt;
  bateau.cap = (bateau.cap + virage + 360) % 360;
  if (vue !== 'large') regard.cap += virage;
  const cap = THREE.MathUtils.degToRad(bateau.cap);
  bateau.groupe.position.x += Math.sin(cap) * balade.vitesse * dt;
  bateau.groupe.position.z -= Math.cos(cap) * balade.vitesse * dt;
  // barre franche : pour aller à droite, on pousse la barre à gauche
  bateau.reglage.barre = -balade.barre;
}

// ---------- Panneau ----------
const CURSEURS = [
  { cle: 'heure', nom: 'Heure', min: 0, max: 24, pas: 0.05, format: (v) => `${Math.floor(v)} h ${String(Math.floor((v % 1) * 60)).padStart(2, '0')}`, mer: false },
  { cle: 'vent', nom: 'Vent', min: 0, max: 60, pas: 1, format: (v) => `${v} nœuds`, mer: true },
  { cle: 'directionVent', nom: 'Le vent vient du', min: 0, max: 359, pas: 1, format: (v) => `${v}°`, mer: true },
  { cle: 'nuages', nom: 'Nuages', min: 0, max: 1, pas: 0.01, format: (v) => `${Math.round(v * 100)} %`, mer: false },
  { cle: 'orage', nom: 'Orage', min: 0, max: 1, pas: 0.01, format: (v) => `${Math.round(v * 100)} %`, mer: false },
  { cle: 'pluie', nom: 'Pluie', min: 0, max: 1, pas: 0.01, format: (v) => `${Math.round(v * 100)} %`, mer: false },
  { cle: 'brume', nom: 'Brume', min: 0, max: 1, pas: 0.01, format: (v) => `${Math.round(v * 100)} %`, mer: false },
  { cle: 'front', nom: 'Front orageux (approche)', min: 0, max: 1, pas: 0.01, format: (v) => `${Math.round(v * 100)} %`, mer: false },
  { cle: 'directionFront', nom: 'Le front est au', min: 0, max: 359, pas: 1, format: (v) => `${v}°`, mer: false },
  { cle: 'largeurFront', nom: 'Largeur du front', min: 15, max: 90, pas: 1, format: (v) => `± ${v}°`, mer: false },
  { cle: 'houle.hs', nom: 'Houle de fond (hauteur)', min: 0, max: 6, pas: 0.1, format: (v) => `${v.toFixed(1)} m`, mer: true },
  { cle: 'houle.periode', nom: 'Houle de fond (période)', min: 6, max: 18, pas: 0.5, format: (v) => `${v} s`, mer: true },
];
const lire = (cle) => cle.split('.').reduce((o, k) => o[k], meteo);
const ecrire = (cle, v) => {
  const morceaux = cle.split('.');
  const dernier = morceaux.pop();
  morceaux.reduce((o, k) => o[k], meteo)[dernier] = v;
};

const zoneCurseurs = document.getElementById('curseurs');
const champs = new Map();
let merAChanger = false;
for (const c of CURSEURS) {
  const id = `curseur-${c.cle.replace('.', '-')}`;
  const bloc = document.createElement('div');
  bloc.className = 'curseur';
  bloc.innerHTML = `<label for="${id}">${c.nom}</label><output for="${id}"></output>
    <input type="range" id="${id}" min="${c.min}" max="${c.max}" step="${c.pas}">`;
  const champ = bloc.querySelector('input');
  const sortie = bloc.querySelector('output');
  champ.addEventListener('input', () => {
    ecrire(c.cle, Number(champ.value));
    sortie.textContent = c.format(Number(champ.value));
    if (c.mer) merAChanger = true;
    monde.regler(meteo, { recalculerMer: false });
    marquerAmbiance(null);
  });
  champs.set(c.cle, { champ, sortie, c });
  zoneCurseurs.append(bloc);
}
function afficherCurseurs() {
  for (const { champ, sortie, c } of champs.values()) {
    const v = lire(c.cle);
    champ.value = v;
    sortie.textContent = c.format(Number(champ.value));
  }
}
afficherCurseurs();

const zoneAmbiances = document.getElementById('ambiances');
const boutonsAmbiance = new Map();
for (const [id, a] of Object.entries(AMBIANCES)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = a.nom;
  b.addEventListener('click', () => choisirAmbiance(id));
  boutonsAmbiance.set(id, b);
  zoneAmbiances.append(b);
}
function marquerAmbiance(choisie) {
  for (const [id, b] of boutonsAmbiance) b.setAttribute('aria-pressed', String(id === choisie));
}
// Tourne le regard comme le propose l'ambiance (un cap, ou face au soleil)
function orienter(r) {
  if (!r) return;
  if (r.soleil !== undefined) {
    const s = monde.ecl.dirSoleil;
    regard.cap = THREE.MathUtils.radToDeg(Math.atan2(s[0], -s[2])) + r.soleil;
  } else if (r.cap !== undefined) regard.cap = r.cap;
  if (r.site !== undefined) regard.site = r.site;
  bateau.cap = capDeDepart(regard.cap);
}

// Le bateau part « au près bon plein » (le vent à 60° de l'avant), du côté le plus
// proche de la direction du regard : il avance, et la photo montre ses voiles gonflées
function capDeDepart(versOu) {
  const ecart = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  const a = (meteo.directionVent + 60) % 360;
  const b = (meteo.directionVent + 300) % 360;
  return ecart(a, versOu) < ecart(b, versOu) ? a : b;
}

function choisirAmbiance(id) {
  meteo = etatMeteo(AMBIANCES[id]);
  monde.regler(meteo);
  orienter(AMBIANCES[id].regard);
  afficherCurseurs();
  marquerAmbiance(id);
  toutLeCube = true;
}
marquerAmbiance(parametres.get('ambiance') ?? 'midi');
bateau.cap = parametres.has('capBateau') ? Number(parametres.get('capBateau')) : capDeDepart(regard.cap);
balade.vitesse = vitessePolaire(meteo.vent, 60) * 0.5144;

const VUES = { pont: 'Sur le pont', ras: 'Au ras de l\'eau', large: 'Du large', cargo: 'Autour du cargo' };
const zoneVues = document.getElementById('vues');
const boutonsVue = new Map();
for (const [id, nom] of Object.entries(VUES)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = nom;
  b.addEventListener('click', () => { vue = id; marquerVue(); });
  boutonsVue.set(id, b);
  zoneVues.append(b);
}
function marquerVue() { for (const [id, b] of boutonsVue) b.setAttribute('aria-pressed', String(id === vue)); }
marquerVue();

// ---------- La trombe (celle de la nuit, à la demande) ----------
const trombe = { active: parametres.has('trombe'), distance: Number(parametres.get('trombe') ?? 900), angle: 0, force: 1, fin: 0 };
const CURSEURS_TROMBE = [
  { cle: 'distance', nom: 'Distance', min: 40, max: 4000, pas: 10, format: (v) => `${v} m` },
  { cle: 'angle', nom: 'Décalée du regard', min: -90, max: 90, pas: 1, format: (v) => `${v}°` },
  { cle: 'force', nom: 'Force', min: 0, max: 1, pas: 0.01, format: (v) => `${Math.round(v * 100)} %` },
  { cle: 'fin', nom: 'Sa fin (la corde)', min: 0, max: 1, pas: 0.01, format: (v) => `${Math.round(v * 100)} %` },
];
const caseTrombe = document.getElementById('trombe-active');
caseTrombe.checked = trombe.active;
caseTrombe.addEventListener('change', () => { trombe.active = caseTrombe.checked; });
for (const c of CURSEURS_TROMBE) {
  const id = `trombe-${c.cle}`;
  const bloc = document.createElement('div');
  bloc.className = 'curseur';
  bloc.innerHTML = `<label for="${id}">${c.nom}</label><output for="${id}">${c.format(trombe[c.cle])}</output>
    <input type="range" id="${id}" min="${c.min}" max="${c.max}" step="${c.pas}" value="${trombe[c.cle]}">`;
  const champ = bloc.querySelector('input');
  champ.addEventListener('input', () => {
    trombe[c.cle] = Number(champ.value);
    bloc.querySelector('output').textContent = c.format(trombe[c.cle]);
  });
  document.getElementById('curseurs-trombe').append(bloc);
}
// (là où elle est : dans la direction du regard, à la distance choisie, autour du bateau)
const etatTrombe = { x: 0, z: 0, force: 1, age: 60, duree: 260, distance: 900 };
function placerTrombe() {
  if (!trombe.active) {
    monde.etatTrombe = null;
    return;
  }
  const cap = THREE.MathUtils.degToRad(regard.cap + trombe.angle);
  const centre = bateau.groupe.position;
  etatTrombe.x = centre.x + Math.sin(cap) * trombe.distance;
  etatTrombe.z = centre.z - Math.cos(cap) * trombe.distance;
  etatTrombe.force = trombe.force;
  etatTrombe.age = trombe.fin > 0 ? etatTrombe.duree - 45 + trombe.fin * 40 : 60;
  etatTrombe.distance = trombe.distance;
  monde.etatTrombe = etatTrombe;
}
window.__trombe = trombe;

// ---------- Le cargo (celui de la nuit, à la demande) ----------
// Il passe devant le regard, de gauche à droite, à la distance choisie ; « Il vire » lui
// fait prendre 50° sur tribord, pour voir son sillage suivre le virage.
const cargoAtelier = { active: parametres.has('cargo'), distance: Number(parametres.get('cargo') ?? 400), vitesse: 7.5 };
const CURSEURS_CARGO = [
  { cle: 'distance', nom: 'Il passe à', min: 60, max: 3000, pas: 10, format: (v) => `${v} m` },
  { cle: 'vitesse', nom: 'Vitesse', min: 0, max: 10, pas: 0.1, format: (v) => `${(v / 0.5144).toFixed(1)} nœuds` },
];
const caseCargo = document.getElementById('cargo-actif');
caseCargo.checked = cargoAtelier.active;
caseCargo.addEventListener('change', () => {
  cargoAtelier.active = caseCargo.checked;
  if (cargoAtelier.active) replacerCargo();
});
for (const c of CURSEURS_CARGO) {
  const id = `cargo-${c.cle}`;
  const bloc = document.createElement('div');
  bloc.className = 'curseur';
  bloc.innerHTML = `<label for="${id}">${c.nom}</label><output for="${id}">${c.format(cargoAtelier[c.cle])}</output>
    <input type="range" id="${id}" min="${c.min}" max="${c.max}" step="${c.pas}" value="${cargoAtelier[c.cle]}">`;
  const champ = bloc.querySelector('input');
  champ.addEventListener('input', () => {
    cargoAtelier[c.cle] = Number(champ.value);
    bloc.querySelector('output').textContent = c.format(cargoAtelier[c.cle]);
  });
  document.getElementById('curseurs-cargo').append(bloc);
}
const etatCargo = { x: 0, z: 0, cap: 0, capVise: 0 };
// (le point où il croise le regard, puis 900 m en amont sur sa route)
function replacerCargo() {
  const r = THREE.MathUtils.degToRad(regard.cap);
  const centre = bateau.groupe.position;
  const cx = centre.x + Math.sin(r) * cargoAtelier.distance;
  const cz = centre.z - Math.cos(r) * cargoAtelier.distance;
  etatCargo.cap = etatCargo.capVise = (regard.cap + 90 + 360) % 360;
  const rc = THREE.MathUtils.degToRad(etatCargo.cap);
  etatCargo.x = cx - Math.sin(rc) * 900;
  etatCargo.z = cz + Math.cos(rc) * 900;
  monde.etatCargo = null; // (son ancien sillage s'efface)
}
function virerCargo() { etatCargo.capVise = (etatCargo.capVise + 50) % 360; }
function deplacerCargo(dt) {
  if (!cargoAtelier.active) {
    monde.etatCargo = null;
    return;
  }
  const e = etatCargo;
  const ecart = ((e.capVise - e.cap + 540) % 360) - 180;
  e.cap = (e.cap + THREE.MathUtils.clamp(ecart, -1.2 * dt, 1.2 * dt) + 360) % 360;
  const rc = THREE.MathUtils.degToRad(e.cap);
  e.x += Math.sin(rc) * cargoAtelier.vitesse * dt;
  e.z -= Math.cos(rc) * cargoAtelier.vitesse * dt;
  monde.etatCargo = e;
}
document.getElementById('cargo-replacer').addEventListener('click', replacerCargo);
document.getElementById('cargo-virer').addEventListener('click', virerCargo);
if (cargoAtelier.active) replacerCargo();
window.__cargo = { reglages: cargoAtelier, etat: etatCargo, replacer: replacerCargo, virer: virerCargo, activer: (oui = true) => { cargoAtelier.active = oui; caseCargo.checked = oui; if (oui) replacerCargo(); } };
window.__regard = regard; // (pour les photos : la direction du regard, en degrés)
window.__vue = (v) => { vue = v; marquerVue(); };

// ---------- La vague scélérate (celles de la nuit, à la demande) ----------
// Elle naît dans la direction du regard (l'angle la décale) et vient droit sur le bateau ;
// la même que dans le jeu (monde/scelerates.js : sa force qui monte, sa crête qui s'écroule).
const sceleratesAtelier = new Scelerates(monde.houle);
// (la longueur d'onde suit la hauteur, comme dans le jeu, tant qu'on ne la règle pas)
const hauteurDemandee = Number(parametres.get('scelerate')) || 20;
const reglageScelerate = { hauteur: hauteurDemandee, longueur: Math.round(hauteurDemandee * LONGUEUR_PAR_METRE), angle: 0 };
const CURSEURS_SCELERATE = [
  { cle: 'hauteur', nom: 'Hauteur (creux-crête)', min: 8, max: 28, pas: 0.5, format: (v) => `${v.toFixed(1).replace('.', ',')} m` },
  { cle: 'longueur', nom: 'Longueur d\'onde', min: 70, max: 240, pas: 5, format: (v) => `${v} m` },
  { cle: 'angle', nom: 'D\'où elle vient (par rapport au regard)', min: -90, max: 90, pas: 5, format: (v) => `${v > 0 ? '+' : ''}${v}°` },
];
for (const c of CURSEURS_SCELERATE) {
  const id = `scelerate-${c.cle}`;
  const bloc = document.createElement('div');
  bloc.className = 'curseur';
  bloc.innerHTML = `<label for="${id}">${c.nom}</label><output for="${id}">${c.format(reglageScelerate[c.cle])}</output>
    <input type="range" id="${id}" min="${c.min}" max="${c.max}" step="${c.pas}" value="${reglageScelerate[c.cle]}">`;
  const champ = bloc.querySelector('input');
  champ.addEventListener('input', () => {
    reglageScelerate[c.cle] = Number(champ.value);
    bloc.querySelector('output').textContent = c.format(reglageScelerate[c.cle]);
  });
  document.getElementById('curseurs-scelerate').append(bloc);
}
function envoyerScelerate(distance = 1150) {
  const r = THREE.MathUtils.degToRad(regard.cap + reglageScelerate.angle); // (le cap d'où elle vient)
  const c = bateau.groupe.position;
  sceleratesAtelier.lancer({
    x: c.x, z: c.z, dx: -Math.sin(r), dz: Math.cos(r), hauteur: reglageScelerate.hauteur, longueur: reglageScelerate.longueur, distance,
  });
}
const etatScelerate = document.getElementById('scelerate-etat');
let ageEtatScelerate = 0;
function majScelerate(dt) {
  const c = bateau.groupe.position;
  const etapes = sceleratesAtelier.maj(dt, c.x, c.z);
  // (la nuit, un éclair derrière elle au dernier moment, comme dans le jeu)
  const v = sceleratesAtelier.vague?.v;
  if (v && etapes.includes('eclair') && monde.ecl.nuit > 0.3) {
    const [cx, cz] = positionCrete(v, monde.houle.temps);
    monde.eclairSur(cx - v.dx * 650, cz - v.dz * 650);
  }
  ageEtatScelerate += dt;
  if (ageEtatScelerate < 0.25) return;
  ageEtatScelerate = 0;
  const w = sceleratesAtelier.vague;
  etatScelerate.textContent = !w ? 'Pas de vague en vue.'
    : `${w.distance > 0 ? `À ${Math.round(w.distance)} m` : `Passée (${Math.round(-w.distance)} m)`} · ${w.v.hauteur.toFixed(1).replace('.', ',')} m · force ${Math.round(w.v.force * 100)} % · crête qui s'écroule ${Math.round(w.v.deferle * 100)} %`;
}
document.getElementById('scelerate-envoyer').addEventListener('click', () => envoyerScelerate());
document.getElementById('scelerate-proche').addEventListener('click', () => envoyerScelerate(300));
if (parametres.has('scelerate')) setTimeout(() => envoyerScelerate(), 1500);
window.__scelerate = { envoyer: envoyerScelerate, reglages: reglageScelerate, scelerates: sceleratesAtelier };

const panneau = document.getElementById('panneau');
document.getElementById('replier').addEventListener('click', (e) => {
  const replie = panneau.classList.toggle('replie');
  e.currentTarget.setAttribute('aria-expanded', String(!replie));
  e.currentTarget.textContent = replie ? 'Déplier' : 'Replier';
});

const zoneMesures = document.getElementById('mesures');
function afficherMesures() {
  const m = monde.mesures;
  const lignes = [
    ['Images par seconde', m.ips.toFixed(0)],
    ['Une image (processeur)', `${m.imageMs.toFixed(1)} ms`],
    ['dont la houle', `${m.houleMs.toFixed(1)} ms`],
    ['Houle calculée à part', `${Math.round(monde.houle.partDansLeFil * 100)} % des images`],
    ['Hauteur des vagues (Hs)', `${monde.houle.hauteurSignificative.toFixed(1)} m`],
    ['Vitesse du bateau', `${(balade.vitesse / 0.5144).toFixed(1)} nœuds`],
    ['Cap', `${Math.round(bateau.cap)}°`],
    ['Angle du vent (+ : tribord)', `${Math.round(((meteo.directionVent - bateau.cap + 540) % 360) - 180)}°`],
    ['Exposition', monde.ecl.exposition.toFixed(2)],
  ];
  zoneMesures.innerHTML = lignes.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
}

// ---------- Photos ----------
const etat = document.getElementById('etat');
async function envoyerCapture(nom, image) {
  const reponse = await fetch('/__capture', { method: 'POST', body: JSON.stringify({ nom, image }) });
  if (!reponse.ok) throw new Error(await reponse.text());
  return reponse.text();
}
// Avance de quelques images (la mer et le cube du ciel se mettent en place) puis photographie
async function photographier(nom, { images = 24, secondes = 0 } = {}) {
  images = Math.max(images, Math.round(secondes * 60));
  for (let i = 0; i < images; i++) {
    reglerVoiles();
    deplacerCargo(1 / 60);
    majScelerate(1 / 60);
    monde.image(1 / 60, { toutLeCube: i === 0, placerCamera });
    // (on rend la main au navigateur de temps en temps seulement : un onglet caché ne
    // rappelle qu'une fois par seconde)
    if (i % 30 === 29) await new Promise((r) => setTimeout(r, 0));
  }
  reglerVoiles();
  monde.image(1 / 60, { placerCamera });
  return monde.photo();
}
window.__capturer = async (nom, options) => envoyerCapture(nom, await photographier(nom, options));
window.__monde = monde;
window.__regard = regard;
window.__bateau = bateau;
window.__vue = (v, distance) => { vue = v; if (distance) distanceOrbite = distance; marquerVue(); };

document.getElementById('photo').addEventListener('click', async (e) => {
  e.currentTarget.disabled = true;
  try {
    const fichier = await window.__capturer(`mer-${Date.now()}`);
    etat.textContent = `Photo enregistrée : ${fichier}`;
  } catch (err) {
    etat.textContent = `Photo impossible : ${err.message}`;
  } finally {
    e.currentTarget.disabled = false;
  }
});

// La planche : les six ambiances côte à côte, dans une seule image
async function planche(nom = 'planche-ambiances', { vueDehors = false } = {}) {
  const ids = Object.keys(AMBIANCES);
  const colonnes = 3;
  const l = 640;
  const h = 360;
  const toile = document.createElement('canvas');
  toile.width = l * colonnes;
  toile.height = h * Math.ceil(ids.length / colonnes);
  const ctx = toile.getContext('2d');
  const ancienne = meteo;
  const regardAvant = { ...regard };
  const vueAvant = vue;
  for (const [i, id] of ids.entries()) {
    meteo = etatMeteo(AMBIANCES[id]);
    monde.regler(meteo);
    orienter(AMBIANCES[id].regard);
    if (vueDehors) {
      // vu du large, trois quarts avant, un peu en hauteur
      vue = 'large';
      distanceOrbite = 17;
      regard.cap = bateau.cap + 150;
      regard.site = 9;
    }
    const image = new Image();
    image.src = await photographier(id, { images: 30 });
    await image.decode();
    const x = (i % colonnes) * l;
    const y = Math.floor(i / colonnes) * h;
    // recadrage au format 16:9
    const ratio = image.width / image.height;
    let sl = image.width;
    let sh = image.height;
    if (ratio > 16 / 9) sl = sh * (16 / 9); else sh = sl / (16 / 9);
    ctx.drawImage(image, (image.width - sl) / 2, (image.height - sh) / 2, sl, sh, x, y, l, h);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x, y + h - 26, l, 26);
    ctx.fillStyle = '#fff';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(AMBIANCES[id].nom, x + 10, y + h - 8);
  }
  meteo = ancienne;
  monde.regler(meteo);
  Object.assign(regard, regardAvant);
  if (vueDehors) vue = vueAvant;
  return envoyerCapture(nom, toile.toDataURL('image/jpeg', 0.9));
}
window.__planche = planche;
document.getElementById('planche').addEventListener('click', async (e) => {
  e.currentTarget.disabled = true;
  etat.textContent = 'Planche en cours…';
  try {
    etat.textContent = `Planche enregistrée : ${await planche()}`;
  } catch (err) {
    etat.textContent = `Planche impossible : ${err.message}`;
  } finally {
    e.currentTarget.disabled = false;
  }
});

// ---------- La boucle ----------
let toutLeCube = true;
let dernier = performance.now();
let ageMesures = 0;
function boucle(maintenant) {
  const dt = Math.min((maintenant - dernier) / 1000, 0.05);
  dernier = maintenant;
  if (merAChanger && !glisse) {
    monde.regler(meteo);
    merAChanger = false;
  }
  naviguer(dt);
  reglerVoiles();
  placerTrombe();
  deplacerCargo(dt);
  majScelerate(dt);
  monde.image(dt, { toutLeCube, placerCamera, enDirect: true });
  toutLeCube = false;
  ageMesures += dt;
  if (ageMesures > 0.5) { afficherMesures(); ageMesures = 0; }
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);
