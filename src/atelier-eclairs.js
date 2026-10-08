// Atelier des éclairs : la foudre part des nuages d'orage (monde/foudre.js). Un grain
// orageux posé à la distance voulue, ou qui passe sur le bateau ; des éclairs qu'on envoie là
// où l'on regarde (dans le nuage, jusqu'à la mer, en araignée, tout près, sur le mât) ; le
// temps qu'on ralentit pour voir chaque éclat ; le tonnerre qu'on entend arriver (on compte
// les secondes) ; le feu de Saint-Elme ; la carte vue d'en haut, avec les nuages d'orage et
// là où tombent les éclairs.
//
// Adresse : atelier-eclairs.html?moment=nuit&vue=cockpit&distance=4000
// Dans la console : __eclairs (voir en bas : lancer, poser, venir, photo, planche, film,
// couts, statistiques…).
import * as THREE from 'three';
import { Monde3D } from './rendu/monde3d.js';
import { AMBIANCES, etatMeteo } from './monde/meteo.js';
import { meteoDeLaNuit } from './jeu/nuit.js';
import { Bateau } from './bateau/bateau.js';
import { Grains, REGLAGES_GRAINS } from './monde/grains.js';
import { Foudre, REGLAGES_FOUDRE, activiteDuGrain, lumiereEclair } from './monde/foudre.js';
import { Audio } from './son/audio.js';

const parametres = new URLSearchParams(location.search);
const canvas = document.getElementById('scene');
const monde = new Monde3D(canvas);
const bateau = monde.ajouterBateau();
const audio = new Audio();
audio.precharger(`${import.meta.env.BASE_URL}sons/`);

// ---------- Les moments ----------
// (l'après-midi d'orage : pour voir les éclairs en plein jour ; les autres : des heures de
// la nuit du jeu)
const MOMENTS = {
  jour: { nom: 'Après-midi d\'orage', meteo: () => etatMeteo({ ...AMBIANCES['fin-apres-midi'], heure: 16.3, nuages: 0.6, orage: 0.7, pluie: 0.2, brume: 0.22, vent: 25, directionVent: 222, front: 0.3 }) },
  coucher: { nom: 'Coucher du soleil, le front au loin', meteo: () => meteoDeLaNuit(18.95) },
  soir: { nom: 'Le soir tombe, le front approche', meteo: () => meteoDeLaNuit(19.3) },
  crepuscule: { nom: 'Début de nuit', meteo: () => meteoDeLaNuit(19.7) },
  nuit: { nom: 'Nuit noire', meteo: () => meteoDeLaNuit(23.5) },
  fort: { nom: 'Au plus fort', meteo: () => meteoDeLaNuit(26.6) },
};
let moment = MOMENTS[parametres.get('moment')] ? parametres.get('moment') : 'nuit';
let meteo = MOMENTS[moment].meteo();
monde.regler(meteo);

// ---------- Les nuages d'orage, et la foudre ----------
const grains = new Grains(7);
monde.etatGrains = grains;
const foudre = new Foudre(5);
monde.etatFoudre = foudre;
let principal = null; // le grain qu'on regarde
const reglage = {
  distance: Number(parametres.get('distance') ?? 4000),
  orage: 1,
  force: 0.9,
  lancerA: 2000, // (la distance des éclairs qu'on envoie)
  vitesse: 1, // (le temps : 0, 0,1 ou 1)
  alentour: false,
  saintElme: false,
};
const centreBateau = () => bateau.groupe.position;
// (le grain vient du vent, un peu à droite : comme ceux de la nuit)
const capDuGrain = () => (meteo.directionVent + REGLAGES_GRAINS.derive + 360) % 360;
function seulement() {
  grains.maj(0, meteo, centreBateau().x, centreBateau().z);
  grains.liste = grains.liste.filter((g) => g === principal);
  grains.peuple = true;
  grains.attente = 1e9;
}
// un grain orageux posé là, immobile, à pleine force
function poser() {
  if (principal) grains.liste = grains.liste.filter((g) => g !== principal);
  const r = THREE.MathUtils.degToRad(capDuGrain());
  const c = centreBateau();
  grains.orienter(meteo);
  principal = grains.creer({
    x: c.x + Math.sin(r) * reglage.distance, z: c.z - Math.cos(r) * reglage.distance,
    rayon: 650 + reglage.force * 450, force: reglage.force, orage: reglage.orage, duree: 1e9, age: 400, prevu: true,
  });
  principal.vx = 0;
  principal.vz = 0;
  regarderLeGrain();
}
// un grain qui vient sur le bateau : il naît à 2,5 km, au vent
function venir() {
  if (principal) grains.liste = grains.liste.filter((g) => g !== principal);
  const c = centreBateau();
  principal = grains.lancer({ x: c.x, z: c.z, dans: 170, force: reglage.force, orage: reglage.orage, ecart: 80 });
  regarderLeGrain();
}
function aucun() {
  if (principal) grains.liste = grains.liste.filter((g) => g !== principal);
  principal = null;
}
function alentour(oui) {
  reglage.alentour = oui;
  document.getElementById('alentour').checked = oui;
  if (oui) {
    grains.peuple = false;
    grains.attente = 0;
  } else seulement();
}
// (le cœur du grain : là où sa pluie est la plus dense)
function coeur() {
  if (!principal) return null;
  return grains.noyau(principal, principal.noyaux[0], {});
}

// ---------- Le bateau : il fuit, le vent sur la hanche (comme dans la nuit du jeu) ----------
function orienterBateau() {
  bateau.cap = (meteo.directionVent + 155) % 360;
  const r = bateau.reglage;
  Object.assign(r, { ris: 2, deroule: 0.3, cote: 1, coteFoc: 1, angleBome: 1.0, angleFoc: 0.7, faseyement: 0, faseyementFoc: 0, force: 0.6 });
  bateau.gite = 0.06;
}
function eclairerBateau() {
  const nuit = monde.ecl.nuit;
  bateau.allumerFeux(nuit);
  bateau.interieur.regler({
    eclairage: nuit > 0.6 ? 'rouge' : 'eteint', feux: nuit > 0.5, ciel: monde.ecl.ambiance, eclair: monde.eclair.intensite,
    pression: 1024 - 6 * meteo.nuages - 34 * meteo.orage, heure: meteo.heure, nuit,
  });
  bateau.instruments.maj(1 / 60, { vitesse: 6, cap: bateau.cap, angleVentApparent: 150, ventApparent: meteo.vent, incidenceFoc: 18, incidenceGV: 20 }, nuit);
}

// ---------- Le point de vue ----------
const VUES = {
  cockpit: 'Du cockpit',
  fixe: 'Immobile (pour filmer)',
  loin: 'De loin, de côté',
  haut: 'D\'en haut',
  mat: 'Vers la tête du mât',
};
let vue = VUES[parametres.get('vue')] ? parametres.get('vue') : 'cockpit';
// (cap : d'où l'on regarde, en degrés compas ; par défaut, vers le grain)
const regard = { cap: capDuGrain(), site: 6 };
function regarderLeGrain() {
  const c = coeur();
  const b = centreBateau();
  regard.cap = c ? (Math.atan2(c.x - b.x, -(c.z - b.z)) * 180) / Math.PI : capDuGrain();
}
function directionDepuisCap(cap, site) {
  const c = THREE.MathUtils.degToRad(cap);
  const s = THREE.MathUtils.degToRad(site);
  return new THREE.Vector3(Math.sin(c) * Math.cos(s), Math.sin(s), -Math.cos(c) * Math.cos(s));
}
let hauteurLissee = 0;
function placerCamera() {
  const cam = monde.camera;
  cam.up.set(0, 1, 0);
  const b = bateau.groupe;
  const d = directionDepuisCap(regard.cap, regard.site);
  if (vue === 'loin') {
    // à 120 m du bateau, de côté et en arrière, à 14 m : le bateau devant l'orage
    const cote = new THREE.Vector3(-d.z, 0, d.x).normalize();
    cam.position.copy(b.position).addScaledVector(new THREE.Vector3(d.x, 0, d.z).normalize(), -110).addScaledVector(cote, 45);
    cam.position.y = 14;
    cam.lookAt(cam.position.clone().add(d));
    return;
  }
  if (vue === 'haut') {
    cam.position.copy(b.position).addScaledVector(new THREE.Vector3(d.x, 0, d.z).normalize(), -300);
    cam.position.y = 160;
    cam.lookAt(cam.position.clone().add(directionDepuisCap(regard.cap, regard.site - 8)));
    return;
  }
  if (vue === 'mat') {
    // (assis à la barre, on lève les yeux vers la tête du mât : le feu de Saint-Elme)
    cam.position.copy(Bateau.POSTES.barreur).applyMatrix4(b.matrixWorld);
    cam.lookAt(monde.teteDeMat(new THREE.Vector3()));
    return;
  }
  if (vue === 'fixe') {
    // (le bateau bouge, la caméra non : à 3 m au-dessus de la mer moyenne, 12 m derrière
    // lui — hors de sa coque —, le bateau devant nous)
    hauteurLissee += (b.position.y - hauteurLissee) * 0.02;
    const recul = new THREE.Vector3(d.x, 0, d.z).normalize().multiplyScalar(-12);
    cam.position.set(b.position.x + recul.x, hauteurLissee + 3, b.position.z + recul.z);
    cam.lookAt(cam.position.clone().add(d));
    return;
  }
  cam.position.copy(Bateau.POSTES.barreur).applyMatrix4(b.matrixWorld);
  cam.lookAt(cam.position.clone().add(d));
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
  regard.site = THREE.MathUtils.clamp(glisse.site + (e.clientY - glisse.y) * sensibilite, -60, 85);
});
canvas.addEventListener('pointerup', () => { glisse = null; });

// ---------- Les éclairs qu'on envoie ----------
// là où l'on regarde, à la distance voulue (en araignée : en travers du regard, depuis le
// grain s'il y en a un ; tout près : à 150 m ; sur le mât : sur nous)
function lancer(sorte = 'mer', { distance = reglage.lancerA, cap = regard.cap, eclats = null, force = null } = {}) {
  const b = centreBateau();
  const d = directionDepuisCap(cap, 0);
  if (sorte === 'mat') return foudre.lancer({ type: 'mer', surLeMat: true, eclats: eclats ?? 3, force: force ?? 1.3 });
  if (sorte === 'proche') distance = 150;
  const x = b.x + d.x * distance;
  const z = b.z + d.z * distance;
  if (sorte === 'araignee') {
    // (elle part d'un côté du regard et court en travers, sur 8 km)
    const travers = Math.atan2(d.x, -d.z);
    const depart = { x: x - Math.cos(travers) * 4000, z: z - Math.sin(travers) * 4000 };
    return foudre.lancer({ type: 'araignee', x: depart.x, z: depart.z, angle: travers, longueur: 8000, finitALaMer: true, eclats: eclats ?? 1, force: force ?? 1.2 });
  }
  return foudre.lancer({ type: sorte === 'proche' ? 'mer' : sorte, x, z, eclats, force });
}

// ---------- Ce qu'on entend ----------
let sonActif = false;
let dernier = null; // { eclair, tonnerre (s, l'heure de la foudre où il est arrivé) }
const recents = []; // (les éclairs de la dernière minute, pour la carte)
const _droite = new THREE.Vector3();
function entendre(ev) {
  if (ev.type === 'eclair') {
    if (ev.eclair.type !== 'front') {
      dernier = { eclair: ev.eclair, tonnerre: null };
      recents.push(ev.eclair);
    }
    if (sonActif) {
      const f = 1 - THREE.MathUtils.smoothstep(ev.distance, 1500, REGLAGES_FOUDRE.parasites);
      if (f > 0.03) audio.parasiteEclair(f);
    }
  } else if (ev.type === 'tonnerre') {
    if (dernier?.eclair.id === ev.id) dernier.tonnerre = foudre.t;
    if (!sonActif) return;
    const cam = monde.camera;
    const dx = ev.x - cam.position.x;
    const dz = ev.z - cam.position.z;
    const droite = _droite.setFromMatrixColumn(cam.matrixWorld, 0);
    const pan = THREE.MathUtils.clamp((dx * droite.x + dz * droite.z) / Math.max(1, Math.hypot(dx, dz)), -1, 1) * 0.85;
    audio.tonnerre({ distance: ev.distance, duree: ev.duree, force: ev.force, pan, claque: ev.claque });
  } else if (ev.type === 'frappe' && sonActif) {
    const pres = ev.surLeMat ? 1 : 1 - THREE.MathUtils.smoothstep(ev.distance, 60, REGLAGES_FOUDRE.proche);
    audio.claquementFoudre(pres, false);
    if (pres > 0.35) {
      audio.etouffer(1.5 + 3 * pres, 0.45 + 0.4 * pres);
      audio.acouphene(3 + 5 * pres, pres);
    }
  }
}

// ---------- Une image ----------
let toutLeCube = true;
let tournage = 0;
async function enTournage(f) {
  tournage++;
  try {
    return await f();
  } finally {
    tournage--;
    horloge = performance.now();
  }
}
function uneImage(dt) {
  const pas = dt * reglage.vitesse;
  const b = centreBateau();
  grains.maj(pas, meteo, b.x, b.z);
  foudre.maj(pas, { meteo, grains, x: b.x, z: b.z, ecoute: monde.camera.position });
  for (const ev of foudre.evenements) entendre(ev);
  // (le feu de Saint-Elme : l'air chargé, quand on le demande)
  if (reglage.saintElme) foudre.champ = 1;
  eclairerBateau();
  audio.maj(dt, { ventApparent: meteo.vent, vitesse: 6, faseyement: 0, bordage: 0, houle: monde.houle.hauteurSignificative, pluie: monde.ici.pluie, nuit: monde.ecl.nuit, voiles: 0.5, saintElme: THREE.MathUtils.smoothstep(foudre.champ, 0.55, 0.85) });
  monde.image(pas, { toutLeCube, placerCamera });
  toutLeCube = false;
}

// ---------- Le panneau ----------
function boutons(zone, liste, choisir) {
  const carte = new Map();
  for (const [id, x] of Object.entries(liste)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = typeof x === 'string' ? x : x.nom;
    b.addEventListener('click', () => choisir(id));
    carte.set(id, b);
    document.getElementById(zone).append(b);
  }
  return carte;
}
const boutonsMoment = boutons('moments', MOMENTS, (id) => choisirMoment(id));
const boutonsVue = boutons('vues', VUES, (id) => choisirVue(id));
function choisirMoment(id) {
  moment = id;
  meteo = MOMENTS[id].meteo();
  monde.regler(meteo);
  orienterBateau();
  for (const [k, b] of boutonsMoment) b.setAttribute('aria-pressed', String(k === id));
  toutLeCube = true;
  foudre.vider();
  recents.length = 0;
  if (!reglage.alentour) seulement();
  legende();
}
function choisirVue(id) {
  vue = id;
  for (const [k, b] of boutonsVue) b.setAttribute('aria-pressed', String(k === id));
  legende();
}
const boutonsTemps = { 0: 'temps-pause', 0.1: 'temps-ralenti', 1: 'temps-x1' };
function temps(v) {
  reglage.vitesse = v;
  for (const [k, id] of Object.entries(boutonsTemps)) document.getElementById(id).setAttribute('aria-pressed', String(Number(k) === v));
}
for (const [k, id] of Object.entries(boutonsTemps)) document.getElementById(id).addEventListener('click', () => temps(Number(k)));
for (const b of document.querySelectorAll('[data-eclair]')) b.addEventListener('click', () => lancer(b.dataset.eclair));
document.getElementById('poser').addEventListener('click', () => poser());
document.getElementById('venir').addEventListener('click', () => venir());
document.getElementById('aucun').addEventListener('click', () => aucun());
document.getElementById('alentour').addEventListener('change', (e) => alentour(e.currentTarget.checked));
function naturels(oui) {
  document.getElementById('naturels').checked = oui;
  if (oui) foudre.liberer();
  else foudre.retenir(1e9);
}
document.getElementById('naturels').addEventListener('change', (e) => naturels(e.currentTarget.checked));
document.getElementById('saint-elme').addEventListener('change', (e) => { reglage.saintElme = e.currentTarget.checked; });
document.getElementById('son').addEventListener('click', (e) => {
  audio.demarrer(null, `${import.meta.env.BASE_URL}sons/`);
  sonActif = true;
  e.currentTarget.setAttribute('aria-pressed', 'true');
  e.currentTarget.textContent = 'Le son est là';
});
const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m / 10) * 10} m`);
for (const [id, format, changer] of [
  ['lancer-a', km, (v) => { reglage.lancerA = v; }],
  ['distance', km, (v) => { reglage.distance = v; if (principal?.duree === 1e9) poser(); }],
  ['orage', (v) => `${Math.round(v * 100)} %`, (v) => { reglage.orage = v; if (principal) principal.orage = v; }],
]) {
  const champ = document.getElementById(id);
  const texte = document.getElementById(`${id}-texte`);
  if (id === 'distance') champ.value = reglage.distance;
  texte.textContent = format(Number(champ.value));
  changer(Number(champ.value));
  champ.addEventListener('input', () => {
    changer(Number(champ.value));
    texte.textContent = format(Number(champ.value));
  });
}
const panneau = document.getElementById('panneau');
document.getElementById('replier').addEventListener('click', (e) => {
  const replie = panneau.classList.toggle('replie');
  e.currentTarget.setAttribute('aria-expanded', String(!replie));
  e.currentTarget.textContent = replie ? 'Déplier' : 'Replier';
});
if (parametres.has('replie')) panneau.classList.add('replie');
const zoneLegende = document.getElementById('legende');
function legende() {
  zoneLegende.textContent = `${MOMENTS[moment].nom} (${Math.round(meteo.vent)} nœuds) · ${VUES[vue]}`;
}

// Le dernier éclair, et son tonnerre qui arrive (on compte)
const SORTES = { mer: 'jusqu\'à la mer', nuage: 'dans le nuage', araignee: 'en araignée', front: 'dans le front, au loin' };
const zoneDernier = document.getElementById('dernier');
const zoneResume = document.getElementById('resume');
function afficherDernier() {
  const lignes = [];
  if (dernier) {
    const e = dernier.eclair;
    const arrivee = e.t0 + e.distance / REGLAGES_FOUDRE.son;
    lignes.push(['Sorte', `${SORTES[e.type]}${e.surLeMat ? ', sur le mât !' : e.avantLaPluie ? ', devant le grain' : ''}`]);
    lignes.push(['Au plus près', km(e.distance)]);
    lignes.push(['Éclats', `${e.eclats.length}`]);
    if (e.distance > REGLAGES_FOUDRE.audible) lignes.push(['Le tonnerre', 'trop loin pour l\'entendre']);
    else if (dernier.tonnerre === null) lignes.push(['Le tonnerre', `arrive dans ${Math.max(0, arrivee - foudre.t).toFixed(1).replace('.', ',')} s`]);
    else lignes.push(['Le tonnerre', `entendu ${(arrivee - e.t0).toFixed(1).replace('.', ',')} s après l'éclair : ${km(e.distance)}`]);
  } else lignes.push(['', 'Pas encore d\'éclair']);
  lignes.push(['L\'air autour du bateau', `${Math.round(foudre.champ * 100)} % ${foudre.champ > 0.55 ? '(le feu de Saint-Elme)' : ''}`]);
  zoneDernier.innerHTML = lignes.map(([x, y]) => `<dt>${x}</dt><dd>${y}</dd>`).join('');
  const c = foudre.compte;
  const minute = recents.filter((e) => e.t0 > foudre.t - 60).length;
  const g = principal ? `Le grain : ${km(Math.hypot(principal.x - centreBateau().x, principal.z - centreBateau().z))}, électricité ${Math.round(activiteDuGrain(principal, meteo.orage) * 100)} %. ` : '';
  zoneResume.textContent = `${g}${minute} éclairs dans la dernière minute ; en tout ${c.mer} jusqu'à la mer, ${c.nuage} dans le nuage, ${c.araignee} en araignée, ${c.front} dans le front.`;
}

// La carte vue d'en haut : les nuages d'orage, le bateau, les éclairs de la dernière minute
const ecranCarte = document.getElementById('carte').getContext('2d');
function dessinerCarte() {
  const g = ecranCarte;
  const b = centreBateau();
  const echelle = 256 / 32000;
  const X = (x) => 128 + (x - b.x) * echelle;
  const Z = (z) => 128 + (z - b.z) * echelle;
  g.fillStyle = '#070d12';
  g.fillRect(0, 0, 256, 256);
  for (const x of grains.liste) {
    const a = activiteDuGrain(x, meteo.orage);
    const I = grains.intensite(x);
    g.fillStyle = `rgba(${90 + 120 * a}, ${110 + 90 * a}, ${140 + 80 * a}, ${0.15 + 0.5 * I})`;
    g.beginPath();
    g.arc(X(x.x), Z(x.z), Math.max(3, x.rayon * echelle * 1.4), 0, Math.PI * 2);
    g.fill();
  }
  while (recents.length && recents[0].t0 < foudre.t - 60) recents.shift();
  for (const e of recents) {
    const age = Math.min(1, (foudre.t - e.t0) / 60);
    const alpha = 1 - 0.8 * age;
    if (e.type === 'araignee') {
      g.strokeStyle = `rgba(200, 150, 255, ${alpha})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(X(e.haut.x), Z(e.haut.z));
      g.lineTo(X(e.bout.x), Z(e.bout.z));
      g.stroke();
    }
    const p = e.bas ?? e.haut;
    g.fillStyle = e.bas ? `rgba(255, 250, 220, ${alpha})` : `rgba(120, 170, 255, ${alpha})`;
    g.beginPath();
    g.arc(X(p.x), Z(p.z), e.bas ? 2.6 : 2, 0, Math.PI * 2);
    g.fill();
  }
  // le bateau, et son regard
  g.fillStyle = '#ffd38a';
  g.beginPath();
  g.arc(128, 128, 3.5, 0, Math.PI * 2);
  g.fill();
  const d = directionDepuisCap(regard.cap, 0);
  g.strokeStyle = 'rgba(255, 211, 138, 0.6)';
  g.beginPath();
  g.moveTo(128, 128);
  g.lineTo(128 + d.x * 30, 128 + d.z * 30);
  g.stroke();
}

// ---------- Photos, planches, films (enregistrés dans captures/) ----------
async function envoyerCapture(nom, image) {
  const reponse = await fetch('/__capture', { method: 'POST', body: JSON.stringify({ nom, image }) });
  if (!reponse.ok) throw new Error(await reponse.text());
  return reponse.text();
}
// (l'image juste dessinée, copiée tout de suite : un aperçu caché ne décode plus les images)
function copierImage() {
  const c = monde.renderer.domElement;
  const toile = document.createElement('canvas');
  toile.width = c.width;
  toile.height = c.height;
  toile.getContext('2d').drawImage(c, 0, 0);
  return toile;
}
// Le champ de la caméra (degrés ; null : celui du jeu)
const CHAMP = monde.camera.fov;
function zoom(champ) {
  monde.camera.fov = champ ?? CHAMP;
  monde.camera.updateProjectionMatrix();
}
// Un éclair figé à son plus fort (pour une photo) : on l'envoie, on attend son premier
// éclat, et le monde le garde allumé (k : 0, le premier éclat, avec ses branches)
function figer(sorte, options = {}) {
  // (le front, au loin : un éclair dans ses nuages, sans le figer — il est tout petit)
  if (sorte === 'front') return foudre.eclairDuFront();
  const e = lancer(sorte, options);
  if (!e) return null;
  // (le trait : ce que voit l'image au plus fort de l'éclat)
  monde.eclairFige = { eclair: e, v: options.v ?? 1.1, eclat: 0 };
  return e;
}
function defiger() { monde.eclairFige = null; }
async function photo(nom = `eclairs-${moment}-${vue}-${Date.now()}`, { images = 30, sorte = null, ...options } = {}) {
  return enTournage(async () => {
    for (let i = 0; i < images; i++) uneImage(1 / 60);
    if (sorte) figer(sorte, options);
    uneImage(1 / 60);
    uneImage(1 / 60);
    const image = copierImage();
    defiger();
    return envoyerCapture(nom, image.toDataURL('image/jpeg', 0.9));
  });
}
const zoneEtat = document.getElementById('etat');
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

// La planche : des cases (une sorte d'éclair, à une distance, à un moment, d'un point de vue)
// en grille ; chaque case a son titre. cases : [{ titre, moment, vue, sorte, distance, cap,
// site, v }] ; colonnes : combien par ligne
async function planche(nom, options) {
  return enTournage(() => plancheSansPause(nom, options));
}
async function plancheSansPause(nom, { cases, colonnes = 3, largeur = 480, images = 40 } = {}) {
  const hauteurCase = Math.round(largeur * 9 / 16);
  const lignes = Math.ceil(cases.length / colonnes);
  const toile = document.createElement('canvas');
  const titre = 26;
  toile.width = largeur * colonnes;
  toile.height = (titre + hauteurCase) * lignes;
  const ctx = toile.getContext('2d');
  ctx.fillStyle = '#0c1418';
  ctx.fillRect(0, 0, toile.width, toile.height);
  const avant = { moment, vue, regard: { ...regard } };
  const naturelsAvant = foudre.retenue;
  foudre.retenir(1e9);
  for (const [k, c] of cases.entries()) {
    if (c.moment && c.moment !== moment) choisirMoment(c.moment);
    choisirVue(c.vue ?? 'cockpit');
    if (c.cap !== undefined) regard.cap = c.cap;
    else regarderLeGrain();
    regard.site = c.site ?? 6;
    reglage.saintElme = !!c.saintElme;
    if (c.grain === false) aucun();
    else if (!principal) poser();
    // (un zoom : le champ de la caméra, en degrés)
    zoom(c.champ ?? null);
    for (let i = 0; i < images; i++) {
      uneImage(1 / 60);
      if (i % 20 === 19) await new Promise((r) => setTimeout(r, 0));
    }
    if (c.sorte) figer(c.sorte, { distance: c.distance, cap: regard.cap, v: c.v });
    uneImage(1 / 60);
    uneImage(1 / 60);
    reglage.saintElme = false;
    zoom(null);
    const x = (k % colonnes) * largeur;
    const y = Math.floor(k / colonnes) * (titre + hauteurCase);
    const cv = monde.renderer.domElement;
    const ratio = cv.width / cv.height;
    let sl = cv.width;
    let sh = cv.height;
    if (ratio > 16 / 9) sl = sh * (16 / 9); else sh = sl / (16 / 9);
    ctx.drawImage(cv, (cv.width - sl) / 2, (cv.height - sh) / 2, sl, sh, x, y + titre, largeur, hauteurCase);
    defiger();
    foudre.vider();
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = '#e6eef0';
    ctx.fillText(c.titre ?? '', x + 10, y + 18);
  }
  foudre.retenue = naturelsAvant;
  choisirMoment(avant.moment);
  choisirVue(avant.vue);
  Object.assign(regard, avant.regard);
  return envoyerCapture(nom, toile.toDataURL('image/jpeg', 0.9));
}

// Le film : des images enregistrées une à une (captures/film-<nom>-0001.jpg…), à assembler
// avec : node scripts/film.mjs <nom>. eclairs : [{ a (s), sorte, distance, cap }] — des
// éclairs envoyés à ces instants
async function film(nom, options) {
  return enTournage(() => filmSansPause(nom, options));
}
async function filmSansPause(nom, { secondes = 10, ips = 30, eclairs = [] } = {}) {
  const n = Math.round(secondes * ips);
  const restants = [...eclairs].sort((p, q) => p.a - q.a);
  for (let i = 0; i < n; i++) {
    const t = i / ips;
    while (restants.length && restants[0].a <= t) {
      const x = restants.shift();
      lancer(x.sorte ?? 'mer', { distance: x.distance ?? reglage.lancerA, cap: x.cap ?? regard.cap, eclats: x.eclats ?? null });
    }
    uneImage(1 / ips);
    await envoyerCapture(`film-${nom}-${String(i + 1).padStart(4, '0')}`, copierImage().toDataURL('image/jpeg', 0.88));
  }
  return n;
}

// ---------- Les mesures ----------
const zoneMesures = document.getElementById('mesures');
const mesuresGpu = {};
function afficherMesures() {
  const m = monde.mesures;
  const lignes = [
    ['Images par seconde', m.ips.toFixed(0)],
    ['Une image (processeur)', `${m.imageMs.toFixed(1)} ms`],
  ];
  for (const [k, v] of Object.entries(mesuresGpu)) lignes.push([k, v]);
  zoneMesures.innerHTML = lignes.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
}
// Ce que coûte un éclair à l'image : des images entières, avec un éclair figé à son plus fort
// (le nuage allumé, le trait, la mer) et sans, en alternance (on garde le meilleur de chaque
// série ; on attend la carte graphique en lisant un pixel). Rend des ms par image.
function couts({ series = 4, images = 8, sorte = 'mer' } = {}) {
  const gl = monde.renderer.getContext();
  const px = new Uint8Array(4);
  const attendre = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const avantVitesse = reglage.vitesse;
  reglage.vitesse = 0;
  foudre.vider();
  const e = lancer(sorte);
  const serie = (avec) => {
    monde.eclairFige = avec && e ? { eclair: e, v: 1.1, eclat: 0 } : null;
    uneImage(1 / 60);
    attendre();
    const t0 = performance.now();
    for (let i = 0; i < images; i++) uneImage(1 / 60);
    attendre();
    return (performance.now() - t0) / images;
  };
  const avec = [];
  const sans = [];
  for (let k = 0; k < series; k++) {
    avec.push(serie(true));
    sans.push(serie(false));
  }
  monde.eclairFige = null;
  foudre.vider();
  reglage.vitesse = avantVitesse;
  const mieux = (l) => Math.round(Math.min(...l) * 100) / 100;
  const r = { avec: mieux(avec), sans: mieux(sans), eclair: Math.round((mieux(avec) - mieux(sans)) * 100) / 100 };
  mesuresGpu['Une image, pendant un éclair'] = `${r.avec} ms`;
  mesuresGpu['Une image, sans éclair'] = `${r.sans} ms`;
  afficherMesures();
  return r;
}
document.getElementById('mesurer').addEventListener('click', async (e) => {
  e.currentTarget.disabled = true;
  zoneEtat.textContent = 'Mesure en cours…';
  await new Promise((r) => setTimeout(r, 50));
  try {
    const r = couts();
    zoneEtat.textContent = `Un éclair coûte ${r.eclair} ms par image, le temps qu'il dure (meilleur de 4 séries de 8 images).`;
  } finally {
    e.currentTarget.disabled = false;
  }
});

window.__eclairs = {
  monde, foudre, grains, reglage, regard, bateau, audio,
  moment: choisirMoment, vue: choisirVue, temps, naturels, alentour,
  lancer, poser, venir, aucun, figer, defiger, photo, planche, film, couts, uneImage,
  lumiereEclair,
  // (redessiner le panneau tout de suite : quand l'onglet est caché, sa boucle s'arrête)
  panneau() { afficherMesures(); afficherDernier(); legende(); dessinerCarte(); },
};

// ---------- La boucle ----------
choisirMoment(moment);
choisirVue(vue);
poser();
let horloge = performance.now();
let ageMesures = 0;
function boucle(maintenant) {
  const dt = Math.min((maintenant - horloge) / 1000, 0.05);
  horloge = maintenant;
  if (!tournage) uneImage(dt);
  ageMesures += dt;
  if (ageMesures > 0.1) {
    afficherMesures();
    afficherDernier();
    legende();
    dessinerCarte();
    ageMesures = 0;
  }
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);
