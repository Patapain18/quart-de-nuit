// Atelier de la trombe : comparer les trombes possibles, de leur naissance à leur fin,
// au crépuscule (comme dans le jeu), dans la nuit noire, sous les éclairs, de près, de
// loin, d'en haut.
//
// Adresse : atelier-trombe.html?variante=bete&moment=jeu&vue=cockpit&distance=900&age=120
// Dans la console : __trombe (voir en bas : photo, planche, film).
import * as THREE from 'three';
import { Monde3D } from './rendu/monde3d.js';
import { AMBIANCES, etatMeteo, angleVers } from './monde/meteo.js';
import { meteoDeLaNuit } from './jeu/nuit.js';
import { Bateau } from './bateau/bateau.js';
import { VARIANTES, VARIANTE_DU_JEU, vieDeLaTrombe } from './rendu/trombe.js';
import { TrombeAncienne } from './rendu/trombe-ancienne.js';

const parametres = new URLSearchParams(location.search);
const canvas = document.getElementById('scene');
const monde = new Monde3D(canvas);
const bateau = monde.ajouterBateau();
const lisse = THREE.MathUtils.smoothstep;
const DUREE = 260;

// ---------- Les moments ----------
// (le début de nuit : la lumière quand la trombe passe près du bateau, dans le jeu — elle
// vient vers 19 h 30 et le crépuscule s'attarde pendant son passage, jeu/nuit.js)
const MOMENTS = {
  jeu: { nom: 'Début de nuit (le jeu)', meteo: () => meteoDeLaNuit(19.7) },
  crepuscule: { nom: 'Crépuscule', meteo: () => meteoDeLaNuit(19.15) },
  nuit: { nom: 'Nuit noire', meteo: () => meteoDeLaNuit(23.2) },
  jour: { nom: 'Jour d\'orage', meteo: () => etatMeteo({ ...AMBIANCES['fin-apres-midi'], heure: 15.2, nuages: 0.9, orage: 0.7, pluie: 0.15, brume: 0.3, vent: 26, directionVent: 222 }) },
};
let moment = MOMENTS[parametres.get('moment')] ? parametres.get('moment') : 'jeu';
let meteo = MOMENTS[moment].meteo();
monde.regler(meteo);

// ---------- La trombe ----------
const ancienne = new TrombeAncienne(monde.scene, monde.houle, monde.eau, monde.ciel, monde.embruns);
let variante = parametres.get('variante') ?? VARIANTE_DU_JEU;
const etat = { x: 0, z: 0, force: 1, age: Number(parametres.get('age') ?? 120), duree: DUREE, distance: 900 };
const reglage = {
  distance: Number(parametres.get('distance') ?? 900),
  cap: null, // d'où on la voit (le cap du bateau vers elle) : par défaut, au vent, comme dans le jeu
  vit: false, // son âge avance
  vitesseVie: 1,
  avance: false, // elle se déplace avec le vent
  eclairs: true,
};
function capTrombe() {
  return reglage.cap ?? (meteo.directionVent + 8) % 360;
}
// (on la place au vent du bateau, à la distance choisie)
function placerTrombe() {
  const r = THREE.MathUtils.degToRad(capTrombe());
  const c = bateau.groupe.position;
  etat.x = c.x + Math.sin(r) * reglage.distance;
  etat.z = c.z - Math.cos(r) * reglage.distance;
}
function majEtat(dt) {
  if (reglage.vit) {
    etat.age += dt * reglage.vitesseVie;
    if (etat.age > DUREE) etat.age = 0;
    afficherAge();
  }
  if (reglage.avance) {
    const a = angleVers(meteo.directionVent);
    etat.x += Math.cos(a) * 7 * dt;
    etat.z += Math.sin(a) * 7 * dt;
  }
  etat.force = lisse(etat.age, 0, 15) * (1 - lisse(etat.age, DUREE - 30, DUREE));
  etat.distance = Math.hypot(etat.x - bateau.groupe.position.x, etat.z - bateau.groupe.position.z);
}
function choisirVariante(nom) {
  variante = nom;
  if (nom !== 'ancienne') monde.trombe.choisirVariante(nom);
  for (const [id, b] of boutonsVariante) b.setAttribute('aria-pressed', String(id === nom));
  document.getElementById('resume').textContent = nom === 'ancienne'
    ? 'Celle d\'avant (étape 10) : un tube, des voiles d\'embruns, une soucoupe de nuage.'
    : VARIANTES[nom].resume;
  legende();
}

// ---------- Le point de vue ----------
const VUES = {
  cockpit: 'Du cockpit',
  fixe: 'Immobile (pour filmer)',
  ras: 'Au ras de l\'eau',
  drone: 'D\'en haut',
  loin: 'De loin, de côté',
  dedans: 'Dans ses embruns',
};
let vue = VUES[parametres.get('vue')] ? parametres.get('vue') : 'cockpit';
// le regard : un décalage (degrés) par rapport à la direction de la trombe
const regard = { cap: 0, site: 0 };
let hauteurLissee = 0;
function directionDepuisCap(cap, site) {
  const c = THREE.MathUtils.degToRad(cap);
  const s = THREE.MathUtils.degToRad(site);
  return new THREE.Vector3(Math.sin(c) * Math.cos(s), Math.sin(s), -Math.cos(c) * Math.cos(s));
}
// (le cap, vu d'un point, vers le pied de la trombe)
function capVers(depuis) {
  return THREE.MathUtils.radToDeg(Math.atan2(etat.x - depuis.x, -(etat.z - depuis.z)));
}
function placerCamera(dt) {
  const cam = monde.camera;
  const pied = new THREE.Vector3(etat.x, 0, etat.z);
  if (vue === 'drone') {
    // en hauteur, en orbite lente autour d'elle : on voit les spirales sur la mer
    const a = THREE.MathUtils.degToRad(capTrombe() + 180 + regard.cap);
    const d = Math.max(600, reglage.distance * 0.8);
    cam.position.set(etat.x + Math.sin(a) * d, 260 + regard.site * 10, etat.z - Math.cos(a) * d);
    cam.lookAt(pied.x, 60, pied.z);
    return;
  }
  if (vue === 'loin') {
    // loin, de côté (le vent de travers) : sa silhouette entière, courbée par le vent
    const a = THREE.MathUtils.degToRad(meteo.directionVent + 90 + regard.cap);
    const d = Math.max(2600, reglage.distance);
    cam.position.set(etat.x + Math.sin(a) * d, 12, etat.z - Math.cos(a) * d);
    cam.position.y = Math.max(cam.position.y, monde.houle.hauteur(cam.position.x, cam.position.z) + 6);
    const cible = new THREE.Vector3(etat.x, 330 + regard.site * 8, etat.z);
    cam.lookAt(cible);
    return;
  }
  if (vue === 'dedans') {
    // à quelques dizaines de mètres de son cœur, au ras de l'eau
    const R = monde.trombe.variante.emb.coeur;
    const a = THREE.MathUtils.degToRad(capTrombe() + 180);
    const p = new THREE.Vector3(etat.x + Math.sin(a) * R * 2.2, 0, etat.z - Math.cos(a) * R * 2.2);
    const h = monde.houle.hauteur(p.x, p.z);
    hauteurLissee += (h - hauteurLissee) * Math.min(1, dt * 6);
    cam.position.set(p.x, hauteurLissee + 3, p.z);
    cam.lookAt(cam.position.clone().add(directionDepuisCap(capVers(cam.position) + regard.cap, 18 + regard.site)));
    return;
  }
  if (vue === 'fixe') {
    // immobile, à 6 m au-dessus de la mer, à la distance choisie (du côté du bateau) : pour
    // les films et les mesures de mouvement, rien ne bouge que la trombe
    const a = THREE.MathUtils.degToRad(capTrombe() + 180);
    cam.position.set(etat.x + Math.sin(a) * reglage.distance, 6, etat.z - Math.cos(a) * reglage.distance);
    const site = THREE.MathUtils.radToDeg(Math.atan2(300, reglage.distance)) * 0.85;
    cam.lookAt(cam.position.clone().add(directionDepuisCap(capVers(cam.position) + regard.cap, site + regard.site)));
    return;
  }
  if (vue === 'ras') {
    const p = bateau.groupe.position.clone().add(new THREE.Vector3(-8, 0, 6));
    const h = monde.houle.hauteur(p.x, p.z);
    hauteurLissee += (h - hauteurLissee) * Math.min(1, dt * 6);
    cam.position.set(p.x, hauteurLissee + 0.8, p.z);
    const site = THREE.MathUtils.radToDeg(Math.atan2(260, reglage.distance)) * 0.9;
    cam.lookAt(cam.position.clone().add(directionDepuisCap(capVers(cam.position) + regard.cap, site + regard.site)));
    return;
  }
  // assis à la barre, comme dans le jeu : la tête suit le bateau, et compense un peu le roulis
  cam.position.copy(Bateau.POSTES.barreur).applyMatrix4(bateau.groupe.matrixWorld);
  const site = THREE.MathUtils.radToDeg(Math.atan2(300, reglage.distance)) * 0.85;
  cam.lookAt(cam.position.clone().add(directionDepuisCap(capVers(cam.position) + regard.cap, site + regard.site)));
  const roulis = new THREE.Euler().setFromQuaternion(bateau.groupe.quaternion, 'YXZ');
  cam.rotateZ(roulis.z * 0.55);
}
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

// Le bateau : au près, la trombe au vent, par le travers avant tribord (on la voit
// par-dessus le pont, comme dans le jeu) ; les voiles sous le vent, à bâbord
function orienterBateau() {
  bateau.cap = (capTrombe() - 50 + 360) % 360;
  const r = bateau.reglage;
  r.ris = 2;
  r.deroule = 0.35;
  r.cote = -1;
  r.coteFoc = -1;
  r.angleBome = -0.35;
  r.angleFoc = -0.2;
  r.faseyement = 0;
  r.faseyementFoc = 0;
  r.force = 0.6;
  bateau.gite = -0.12;
}

function eclairerBateau() {
  const nuit = monde.ecl.nuit;
  bateau.allumerFeux(nuit);
  bateau.interieur.regler({
    eclairage: nuit > 0.6 ? 'rouge' : 'eteint', feux: nuit > 0.5, ciel: monde.ecl.ambiance, eclair: monde.eclair.intensite,
    pression: 1024 - 6 * meteo.nuages - 34 * meteo.orage, heure: meteo.heure, nuit,
  });
  bateau.instruments.maj(1 / 60, { vitesse: 2, cap: bateau.cap, angleVentApparent: 60, ventApparent: meteo.vent, incidenceFoc: 18, incidenceGV: 20 }, nuit);
}

// ---------- Le panneau ----------
const boutonsVariante = new Map();
const zoneVariantes = document.getElementById('variantes');
for (const [id, v] of [...Object.entries(VARIANTES), ['ancienne', { nom: 'L\'ancienne' }]]) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = v.nom;
  b.addEventListener('click', () => choisirVariante(id));
  boutonsVariante.set(id, b);
  zoneVariantes.append(b);
}
const boutonsMoment = new Map();
const zoneMoments = document.getElementById('moments');
for (const [id, m] of Object.entries(MOMENTS)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = m.nom;
  b.addEventListener('click', () => choisirMoment(id));
  boutonsMoment.set(id, b);
  zoneMoments.append(b);
}
// (n'importe quelle heure de la nuit du jeu : __trombe.heure(19.6))
function choisirHeure(h) {
  MOMENTS.heure = { nom: `${Math.floor(h % 24)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}`, meteo: () => meteoDeLaNuit(h) };
  choisirMoment('heure');
}
function choisirMoment(id) {
  moment = id;
  meteo = MOMENTS[id].meteo();
  monde.regler(meteo);
  for (const [k, b] of boutonsMoment) b.setAttribute('aria-pressed', String(k === id));
  toutLeCube = true;
  placerTrombe();
  orienterBateau();
  legende();
}
const boutonsVue = new Map();
const zoneVues = document.getElementById('vues');
for (const [id, nom] of Object.entries(VUES)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = nom;
  b.addEventListener('click', () => choisirVue(id));
  boutonsVue.set(id, b);
  zoneVues.append(b);
}
function choisirVue(id) {
  vue = id;
  regard.cap = 0;
  regard.site = 0;
  for (const [k, b] of boutonsVue) b.setAttribute('aria-pressed', String(k === id));
  legende();
}

const champAge = document.getElementById('age');
const texteAge = document.getElementById('age-texte');
const texteEtape = document.getElementById('etape-vie');
function etapeDeVie() {
  const v = vieDeLaTrombe(etat.age, DUREE);
  if (v.fin > 0.05) return 'Elle meurt : sa vapeur remonte dans le nuage, la gerbe retombe.';
  if (v.corde > 0.05) return 'La corde : elle s\'amincit, se couche et se tord.';
  if (v.naissance < 0.12) return 'Une tache sombre sur l\'eau, sous le nuage qui s\'abaisse.';
  if (v.naissance < 0.3) return 'Des spirales d\'écume s\'enroulent sur la mer.';
  if (v.naissance < 0.7) return 'L\'anneau d\'embruns se lève ; l\'entonnoir descend du nuage.';
  if (v.naissance < 1) return 'L\'entonnoir touche la mer.';
  return 'Pleine force.';
}
function afficherAge() {
  champAge.value = etat.age;
  texteAge.textContent = `${Math.floor(etat.age / 60)} min ${String(Math.floor(etat.age % 60)).padStart(2, '0')} s`;
  texteEtape.textContent = etapeDeVie();
}
champAge.addEventListener('input', () => {
  etat.age = Number(champAge.value);
  afficherAge();
});
for (const b of document.querySelectorAll('[data-age]')) {
  b.addEventListener('click', () => {
    etat.age = Number(b.dataset.age);
    afficherAge();
  });
}
const boutonVivre = document.getElementById('vivre');
const boutonVite = document.getElementById('vivre-vite');
function vivre(oui, vitesse = 1) {
  reglage.vit = oui;
  reglage.vitesseVie = vitesse;
  boutonVivre.setAttribute('aria-pressed', String(oui && vitesse === 1));
  boutonVite.setAttribute('aria-pressed', String(oui && vitesse !== 1));
}
boutonVivre.addEventListener('click', () => vivre(!(reglage.vit && reglage.vitesseVie === 1), 1));
boutonVite.addEventListener('click', () => vivre(!(reglage.vit && reglage.vitesseVie !== 1), 6));

const champDistance = document.getElementById('distance');
const texteDistance = document.getElementById('distance-texte');
champDistance.value = reglage.distance;
function afficherDistance() { texteDistance.textContent = `${Math.round(reglage.distance)} m`; }
champDistance.addEventListener('input', () => {
  reglage.distance = Number(champDistance.value);
  afficherDistance();
  placerTrombe();
});
document.getElementById('avance').addEventListener('change', (e) => {
  reglage.avance = e.currentTarget.checked;
  if (!reglage.avance) placerTrombe();
});
document.getElementById('eclair').addEventListener('click', () => {
  const v = monde.trombe.variante;
  const a = Math.random() * Math.PI * 2;
  monde.eclairSur(etat.x + Math.cos(a) * v.mur.rayon * 0.4, etat.z + Math.sin(a) * v.mur.rayon * 0.4);
});
const boutonEclairs = document.getElementById('eclairs');
boutonEclairs.addEventListener('click', () => {
  reglage.eclairs = !reglage.eclairs;
  boutonEclairs.setAttribute('aria-pressed', String(reglage.eclairs));
});

const panneau = document.getElementById('panneau');
document.getElementById('replier').addEventListener('click', (e) => {
  const replie = panneau.classList.toggle('replie');
  e.currentTarget.setAttribute('aria-expanded', String(!replie));
  e.currentTarget.textContent = replie ? 'Déplier' : 'Replier';
});

const zoneLegende = document.getElementById('legende');
function legende() {
  const nom = variante === 'ancienne' ? 'L\'ancienne trombe' : VARIANTES[variante].nom;
  zoneLegende.textContent = `${nom} · ${MOMENTS[moment].nom} · ${VUES[vue]} · à ${Math.round(etat.distance || reglage.distance)} m`;
}

// ---------- Les mesures ----------
const zoneMesures = document.getElementById('mesures');
const mesuresGpu = { trombe: null, rendu: null, total: null };
function afficherMesures() {
  const m = monde.mesures;
  const lignes = [
    ['Images par seconde', m.ips.toFixed(0)],
    ['Une image (processeur)', `${m.imageMs.toFixed(1)} ms`],
    ['Le volume', `${monde.trombe.cible.width} × ${monde.trombe.cible.height} px`],
  ];
  if (mesuresGpu.trombe !== null) {
    lignes.push(['La trombe (carte graphique)', `${mesuresGpu.trombe.toFixed(2)} ms`]);
    lignes.push(['La scène (carte graphique)', `${mesuresGpu.rendu.toFixed(2)} ms`]);
    lignes.push(['Toute l\'image (carte graphique)', `${mesuresGpu.total.toFixed(2)} ms`]);
  }
  zoneMesures.innerHTML = lignes.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
}
// (la carte graphique note elle-même le temps de chaque morceau : chrono-gpu.js ; on
// dessine les images d'affilée, sans attendre l'écran)
async function mesurer(images = 60) {
  const c = monde.chronoGPU;
  if (!c.disponible) return null;
  c.vider();
  c.actif = true;
  for (let i = 0; i < images; i++) {
    uneImage(1 / 60);
    if (i % 10 === 9) await new Promise((r) => setTimeout(r, 0));
  }
  c.actif = false;
  // (les dernières réponses arrivent un peu plus tard)
  for (let i = 0; i < 20 && c.enCours.length; i++) {
    await new Promise((r) => setTimeout(r, 16));
    c.relever();
  }
  const b = c.bilan();
  const total = Object.values(b).reduce((s, x) => s + x.mediane, 0);
  mesuresGpu.trombe = b.trombe?.mediane ?? 0;
  mesuresGpu.rendu = b.rendu?.mediane ?? 0;
  mesuresGpu.total = total;
  afficherMesures();
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, `${v.mediane.toFixed(2)} ms (pire ${v.pire.toFixed(2)})`]));
}
const zoneEtat = document.getElementById('etat');
document.getElementById('mesurer').addEventListener('click', async (e) => {
  e.currentTarget.disabled = true;
  zoneEtat.textContent = 'Mesure en cours…';
  try {
    await mesurer();
    zoneEtat.textContent = 'Mesuré sur 60 images (la médiane).';
  } finally {
    e.currentTarget.disabled = false;
  }
});

// ---------- Une image ----------
let toutLeCube = true;
let sansTrombe = false; // (le banc d'essai : une image sans elle)
// (pendant une photo, une planche ou un film, la boucle de l'écran ne dessine plus : sinon,
// entre deux images du tournage, elle ferait avancer le temps elle aussi, et les films
// seraient accélérés et saccadés)
let tournage = 0;
async function enTournage(f) {
  tournage++;
  try {
    return await f();
  } finally {
    tournage--;
    dernier = performance.now();
  }
}
function uneImage(dt) {
  majEtat(dt);
  if (!reglage.eclairs) monde.foudre.retenir(5);
  if (variante === 'ancienne') {
    monde.etatTrombe = null;
    ancienne.maj(dt, etat, { temps: monde.temps + dt, directionVent: angleVers(meteo.directionVent), camera: monde.camera });
  } else {
    ancienne.groupe.visible = false;
    monde.etatTrombe = sansTrombe ? null : etat;
  }
  eclairerBateau();
  monde.image(dt, { toutLeCube, placerCamera });
  toutLeCube = false;
}

// ---------- Photos, planches, films (enregistrés dans captures/) ----------
async function envoyerCapture(nom, image) {
  const reponse = await fetch('/__capture', { method: 'POST', body: JSON.stringify({ nom, image }) });
  if (!reponse.ok) throw new Error(await reponse.text());
  return reponse.text();
}
// quelques images pour que le ciel et la mer se mettent en place, puis la photo
async function photographier({ images = 40 } = {}) {
  for (let i = 0; i < images; i++) {
    uneImage(1 / 60);
    if (i % 20 === 19) await new Promise((r) => setTimeout(r, 0));
  }
  uneImage(1 / 60);
  return monde.photo();
}
async function photo(nom = `trombe-${variante}-${moment}-${vue}-${Date.now()}`, options) {
  return enTournage(() => photoSansPause(nom, options));
}
async function photoSansPause(nom, options) {
  const ancienVit = reglage.vit;
  reglage.vit = false;
  try {
    return await envoyerCapture(nom, await photographier(options));
  } finally {
    reglage.vit = ancienVit;
  }
}
document.getElementById('photo').addEventListener('click', async (e) => {
  e.currentTarget.disabled = true;
  try {
    zoneEtat.textContent = `Photo enregistrée : ${await photo()}`;
  } catch (err) {
    zoneEtat.textContent = `Photo impossible : ${err.message}`;
  } finally {
    e.currentTarget.disabled = false;
  }
});

// La planche : des trombes (en colonnes) dans des situations (en lignes), dans une seule
// image. situations : [{ titre, moment, vue, distance, age, cap, site, eclair }]
async function planche(nom, options) {
  return enTournage(() => plancheSansPause(nom, options));
}
async function plancheSansPause(nom, { variantes = Object.keys(VARIANTES), situations, largeur = 560, images = 50 } = {}) {
  const hauteurCase = Math.round(largeur * 9 / 16);
  const toile = document.createElement('canvas');
  const titre = 30;
  toile.width = largeur * variantes.length;
  toile.height = titre + hauteurCase * situations.length;
  const ctx = toile.getContext('2d');
  ctx.fillStyle = '#0c1418';
  ctx.fillRect(0, 0, toile.width, toile.height);
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillStyle = '#e6eef0';
  variantes.forEach((v, i) => ctx.fillText(v === 'ancienne' ? 'L\'ancienne' : VARIANTES[v].nom, i * largeur + 12, 21));
  const avant = { variante, moment, vue, distance: reglage.distance, age: etat.age, vit: reglage.vit, regard: { ...regard }, eclairs: reglage.eclairs };
  reglage.vit = false;
  for (const [j, s] of situations.entries()) {
    for (const [i, v] of variantes.entries()) {
      choisirVariante(v);
      if (s.moment !== moment || i === 0) choisirMoment(s.moment);
      choisirVue(s.vue);
      reglage.distance = s.distance ?? 900;
      etat.age = s.age ?? 120;
      regard.cap = s.cap ?? 0;
      regard.site = s.site ?? 0;
      reglage.eclairs = !s.sansEclairs;
      placerTrombe();
      monde.foudre.vider();
      monde.foudre.retenir(1e9);
      // (un éclair au bon moment : il tombe juste avant la photo)
      const n = images;
      for (let k = 0; k < n; k++) {
        if (s.eclair && k === n - 4) {
          // (dans le nuage, derrière elle : elle se découpe sur la lueur)
          const c = monde.camera.position;
          const vers = new THREE.Vector3(etat.x - c.x, 0, etat.z - c.z).normalize();
          monde.foudre.lancer({ type: 'nuage', x: etat.x + vers.x * 600, z: etat.z + vers.z * 600, eclats: 1, force: 1.2 });
        }
        uneImage(1 / 60);
        if (k % 20 === 19) await new Promise((r) => setTimeout(r, 0));
      }
      const image = new Image();
      image.src = monde.photo();
      await image.decode();
      const x = i * largeur;
      const y = titre + j * hauteurCase;
      const ratio = image.width / image.height;
      let sl = image.width;
      let sh = image.height;
      if (ratio > 16 / 9) sl = sh * (16 / 9); else sh = sl / (16 / 9);
      ctx.drawImage(image, (image.width - sl) / 2, (image.height - sh) / 2, sl, sh, x, y, largeur, hauteurCase);
      if (i === 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x, y + hauteurCase - 24, Math.min(largeur, ctx.measureText(s.titre).width + 20), 24);
        ctx.fillStyle = '#fff';
        ctx.font = '14px system-ui, sans-serif';
        ctx.fillText(s.titre, x + 10, y + hauteurCase - 7);
      }
    }
  }
  // (on remet tout comme avant)
  choisirVariante(avant.variante);
  choisirMoment(avant.moment);
  choisirVue(avant.vue);
  reglage.distance = avant.distance;
  etat.age = avant.age;
  reglage.vit = avant.vit;
  reglage.eclairs = avant.eclairs;
  Object.assign(regard, avant.regard);
  monde.foudre.liberer();
  placerTrombe();
  return envoyerCapture(nom, toile.toDataURL('image/jpeg', 0.9));
}

// Le film : des images enregistrées une à une (captures/film-<nom>-0001.jpg…), à
// assembler avec : node scripts/film.mjs <nom>
// eclairsA : des éclairs mis en scène, à ces instants (s), dans le nuage derrière elle
// (un sur deux descend jusqu'à la mer, à côté d'elle)
function eclairDerriere(visible) {
  const c = monde.camera.position;
  const vers = new THREE.Vector3(etat.x - c.x, 0, etat.z - c.z).normalize();
  const cote = new THREE.Vector3(-vers.z, 0, vers.x).multiplyScalar((Math.random() - 0.5) * 900);
  monde.foudre.lancer({ type: visible ? 'mer' : 'nuage', x: etat.x + vers.x * 500 + cote.x, z: etat.z + vers.z * 500 + cote.z, eclats: 2 + Math.floor(Math.random() * 2), force: 1.0 + Math.random() * 0.5 });
}
async function film(nom, options) {
  return enTournage(() => filmSansPause(nom, options));
}
async function filmSansPause(nom, { secondes = 8, ips = 30, avant = 40, eclairsA = [] } = {}) {
  const dt = 1 / ips;
  for (let i = 0; i < avant; i++) uneImage(1 / 60);
  const n = Math.round(secondes * ips);
  const prevus = [...eclairsA];
  for (let i = 0; i < n; i++) {
    if (prevus.length && i * dt >= prevus[0]) eclairDerriere(prevus.shift() * 7 % 2 < 1);
    uneImage(dt);
    await envoyerCapture(`film-${nom}-${String(i + 1).padStart(4, '0')}`, monde.photo('image/jpeg', 0.88));
  }
  return n;
}

// (pour regarder une pièce à la fois : seul(['ent', 'emb']) ; les pièces : ent (l'entonnoir),
// emb (la gerbe), mur (le nuage-mur), pluie, ciel (le nuage parent), mer)
function seul(pieces) {
  const k = monde.trombe.masque;
  for (const c of Object.keys(k)) k[c] = pieces.includes(c) ? 1 : 0;
}
function tout() { seul(Object.keys(monde.trombe.masque)); }
function montrerBateau(oui) { bateau.groupe.visible = oui; }
if (parametres.has('replie')) panneau.classList.add('replie');
if (parametres.has('sansBateau')) montrerBateau(false);
if (parametres.has('seul')) seul(parametres.get('seul').split(','));

// Le banc d'essai de la passe du volume : on la dessine n fois d'affilée, et on attend
// que la carte graphique ait fini en lisant un pixel (ici, la lecture est le seul moyen
// sûr d'attendre : « finish » rend la main tout de suite). Renvoie des ms par passe.
function banc(n = 4) {
  const r = monde.renderer;
  const t = monde.trombe;
  const px = new Uint16Array(4);
  const attendre = () => r.readRenderTargetPixels(t.cible, 0, 0, 1, 1, px);
  const ancienne = r.getRenderTarget();
  attendre();
  let t0 = performance.now();
  attendre();
  const lecture = performance.now() - t0;
  t0 = performance.now();
  for (let i = 0; i < n; i++) t.passeVolume.rendre(r, t.cible);
  attendre();
  const ms = (performance.now() - t0 - lecture) / n;
  r.setRenderTarget(ancienne);
  return Math.round(ms * 100) / 100;
}

// Le banc d'essai d'images entières, avec et sans la trombe, en alternance (la carte
// graphique peut changer de vitesse d'un moment à l'autre : on compare côte à côte, et on
// garde le meilleur de chaque série). Renvoie des ms par image.
function bancImages({ series = 4, images = 4 } = {}) {
  const gl = monde.renderer.getContext();
  const px = new Uint8Array(4);
  const attendre = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const serie = (avec) => {
    attendre();
    const t0 = performance.now();
    sansTrombe = !avec;
    for (let i = 0; i < images; i++) uneImage(1 / 60);
    sansTrombe = false;
    attendre();
    return (performance.now() - t0) / images;
  };
  const avec = [];
  const sans = [];
  const ancienne = reglage.vit;
  reglage.vit = false;
  for (let k = 0; k < series; k++) {
    avec.push(serie(true));
    sans.push(serie(false));
  }
  reglage.vit = ancienne;
  const mieux = (l) => Math.round(Math.min(...l) * 100) / 100;
  return { avec: mieux(avec), sans: mieux(sans), trombe: mieux(avec) - mieux(sans) };
}

// Le compteur : combien de pas et d'éclairages la passe du volume fait, en moyenne par
// pixel de l'écran et par pixel où il y a de la trombe (indépendant de la vitesse de la
// carte graphique, qui varie)
function compter() {
  const r = monde.renderer;
  const t = monde.trombe;
  const u = t.uniforms;
  u.uCompter.value = 1;
  t.passeVolume.rendre(r, t.cible);
  u.uCompter.value = 0;
  const l = t.cible.width;
  const h = t.cible.height;
  const donnees = new Uint16Array(l * h * 4);
  r.readRenderTargetPixels(t.cible, 0, 0, l, h, donnees);
  const demi = THREE.DataUtils.fromHalfFloat;
  let pas = 0;
  let eclaires = 0;
  let sondes = 0;
  let touches = 0;
  for (let i = 0; i < l * h; i++) {
    const a = demi(donnees[i * 4]);
    if (a > 0) touches++;
    pas += a;
    eclaires += demi(donnees[i * 4 + 1]);
    sondes += demi(donnees[i * 4 + 2]);
  }
  t.passeVolume.rendre(r, t.cible);
  const n = l * h;
  const arrondi = (x) => Math.round(x * 10) / 10;
  // (la carte de chaleur : où partent les pas — noir 0, bleu, vert, jaune, rouge 120+ ;
  // à gauche les pas, à droite les éclairages)
  if (compter.carte) {
    const toile = document.createElement('canvas');
    toile.width = l * 2;
    toile.height = h;
    const ctx = toile.getContext('2d');
    const img = ctx.createImageData(l * 2, h);
    const couleur = (v, max) => {
      const x = Math.min(1, v / max);
      return [Math.round(255 * Math.min(1, Math.max(0, 2 * x - 0.6))), Math.round(255 * Math.min(1, x * 2) * (x < 0.85 ? 1 : 1 - (x - 0.85) * 4)), Math.round(255 * Math.max(0, 1 - 2.5 * x))];
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < l; x++) {
        const i = (h - 1 - y) * l + x;
        for (const [k, max, dx] of [[0, 120, 0], [1, 40, l]]) {
          const v = demi(donnees[i * 4 + k]);
          const [cr, cg, cb] = v > 0 ? couleur(v, max) : [0, 0, 0];
          const o = (y * l * 2 + x + dx) * 4;
          img.data[o] = cr;
          img.data[o + 1] = cg;
          img.data[o + 2] = cb;
          img.data[o + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    envoyerCapture(compter.carte, toile.toDataURL('image/png'));
    compter.carte = null;
  }
  return {
    couverture: `${Math.round((touches / n) * 100)} %`,
    pasParPixel: arrondi(pas / n), pasParPixelTouche: arrondi(pas / Math.max(1, touches)),
    eclairagesParPixelTouche: arrondi(eclaires / Math.max(1, touches)), sondesParPixelTouche: arrondi(sondes / Math.max(1, touches)),
    // (une mesure du travail : un pas vide coûte peu, un pas éclairé beaucoup plus)
    travail: Math.round((pas * 1 + eclaires * 3 + sondes * 2) / n),
  };
}

// La passe du volume comparée à celle des nuages du ciel, en alternance (même état de la
// carte graphique) : combien de fois plus chère ?
function comparerAuxNuages({ series = 5, n = 3 } = {}) {
  const r = monde.renderer;
  const t = monde.trombe;
  const c = monde.ciel;
  const px = new Uint16Array(4);
  const chrono = (passe, cible) => {
    r.readRenderTargetPixels(cible, 0, 0, 1, 1, px);
    const t0 = performance.now();
    for (let i = 0; i < n; i++) passe.rendre(r, cible);
    r.readRenderTargetPixels(cible, 0, 0, 1, 1, px);
    return (performance.now() - t0) / n;
  };
  const ancienne = r.getRenderTarget();
  const volume = [];
  const nuages = [];
  for (let k = 0; k < series; k++) {
    volume.push(chrono(t.passeVolume, t.cible));
    nuages.push(chrono(c.passeNuages, c.nuagesEcran));
  }
  r.setRenderTarget(ancienne);
  const v = Math.min(...volume);
  const nu = Math.min(...nuages);
  return { volume: Math.round(v * 10) / 10, nuages: Math.round(nu * 10) / 10, rapport: Math.round((v / nu) * 10) / 10 };
}

// Ce que coûte chaque ingrédient : on recompile la passe du volume sans lui, et on compare
// aux nuages (attention : recompiler prend une seconde ou deux)
async function couts(distance = 900) {
  const t = monde.trombe;
  const m = t.passeVolume.materiau;
  distanceTrombe(distance);
  for (let i = 0; i < 4; i++) uneImage(1 / 60);
  const resultat = {};
  for (const nom of ['', 'MESURE_SANS_CIEL', 'MESURE_SANS_SONDE', 'MESURE_SANS_DETAIL', 'MESURE_SANS_AXE']) {
    for (const k of Object.keys(m.defines)) if (k.startsWith('MESURE_')) delete m.defines[k];
    if (nom) m.defines[nom] = '';
    m.needsUpdate = true;
    uneImage(1 / 60);
    await new Promise((r) => setTimeout(r, 50));
    for (let i = 0; i < 3; i++) uneImage(1 / 60);
    resultat[nom || 'tout'] = comparerAuxNuages({ series: 5, n: 3 }).rapport;
  }
  for (const k of Object.keys(m.defines)) if (k.startsWith('MESURE_')) delete m.defines[k];
  m.needsUpdate = true;
  return resultat;
}
function distanceTrombe(d) {
  reglage.distance = d;
  champDistance.value = d;
  afficherDistance();
  placerTrombe();
}

// Plusieurs films à la suite (en tâche de fond : l'avancement est dans window.__films).
// liste : [{ nom, variante, moment, vue, distance, age, vitesseVie, secondes, eclairs, bateau, cap, site }]
async function filmer(liste) {
  const suivi = (window.__films = { faits: [], enCours: null, fini: false });
  for (const f of liste) {
    suivi.enCours = f.nom;
    choisirVariante(f.variante ?? 'colonne');
    choisirMoment(f.moment ?? 'jeu');
    choisirVue(f.vue ?? 'cockpit');
    distanceTrombe(f.distance ?? 600);
    regard.cap = f.cap ?? 0;
    regard.site = f.site ?? 0;
    montrerBateau(f.bateau ?? true);
    etat.age = f.age ?? 120;
    reglage.eclairs = f.eclairs ?? false;
    monde.foudre.vider();
    if (reglage.eclairs) monde.foudre.liberer();
    else monde.foudre.retenir(1e9);
    vivre(!!f.vitesseVie, f.vitesseVie ?? 1);
    const n = await film(f.nom, { secondes: f.secondes ?? 8, ips: f.ips ?? 30, eclairsA: f.eclairsA ?? [] });
    vivre(false);
    suivi.faits.push({ nom: f.nom, images: n });
  }
  suivi.enCours = null;
  suivi.fini = true;
  return suivi.faits;
}

// La fluidité en vrai (la boucle de l'écran) : les images par seconde pendant quelques
// secondes, avec ou sans la trombe
async function fluidite(secondes = 3) {
  const mesurer = async () => {
    const debut = performance.now();
    let n = 0;
    await new Promise((ok) => {
      const compter = () => {
        n++;
        if (performance.now() - debut < secondes * 1000) requestAnimationFrame(compter);
        else ok();
      };
      requestAnimationFrame(compter);
    });
    return Math.round((n / ((performance.now() - debut) / 1000)) * 10) / 10;
  };
  sansTrombe = true;
  await new Promise((r) => setTimeout(r, 300));
  const sans = await mesurer();
  sansTrombe = false;
  await new Promise((r) => setTimeout(r, 300));
  const avec = await mesurer();
  return { sans, avec, image: { sans: Math.round(10000 / sans) / 10, avec: Math.round(10000 / avec) / 10 } };
}

window.__trombe = {
  banc, bancImages, compter, comparerAuxNuages, couts, filmer, fluidite,
  monde, etat, reglage, regard, ancienne, seul, tout, montrerBateau,
  variante: choisirVariante, moment: choisirMoment, vue: choisirVue, heure: choisirHeure,
  age: (a) => { etat.age = a; afficherAge(); },
  distance: distanceTrombe,
  vivre, mesurer, photo, planche, film, uneImage,
  get nomVariante() { return variante; },
};

// ---------- La boucle ----------
choisirVariante(variante);
choisirMoment(moment);
choisirVue(vue);
afficherAge();
afficherDistance();
let dernier = performance.now();
let ageMesures = 0;
function boucle(maintenant) {
  const dt = Math.min((maintenant - dernier) / 1000, 0.05);
  dernier = maintenant;
  if (!tournage) uneImage(dt);
  ageMesures += dt;
  if (ageMesures > 0.5) {
    afficherMesures();
    legende();
    ageMesures = 0;
  }
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);
