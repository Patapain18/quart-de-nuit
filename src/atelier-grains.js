// Atelier des grains : un grain qui arrive, passe sur le bateau et s'en va — l'après-midi,
// au coucher du soleil, au début de la nuit, dans la nuit noire, sous ses éclairs. Ce qu'il
// fait au bateau (la pluie, la rafale, le vent qui tourne, l'averse qu'on entend venir), en
// chiffres et en courbes, et ce que montre le radar.
//
// Adresse : atelier-grains.html?moment=jour&vue=fixe&distance=3000
// Dans la console : __grains (voir en bas : photo, planche, film, couts…).
import * as THREE from 'three';
import { Monde3D } from './rendu/monde3d.js';
import { AMBIANCES, etatMeteo, angleVers, NOEUD } from './monde/meteo.js';
import { meteoDeLaNuit } from './quart/nuit.js';
import { Bateau } from './bateau/bateau.js';
import { Grains, REGLAGES_GRAINS } from './monde/grains.js';
import { distanceALaTerre } from './rendu/cote.js';

const parametres = new URLSearchParams(location.search);
const canvas = document.getElementById('scene');
const monde = new Monde3D(canvas);
const bateau = monde.ajouterBateau();

// ---------- Les moments ----------
// (l'après-midi d'orage : le ciel n'est pas encore bouché, on voit les grains de loin, leurs
// rideaux de pluie sur le ciel clair ; les autres : des heures de la nuit du jeu)
const MOMENTS = {
  jour: { nom: 'Après-midi d\'orage', meteo: () => etatMeteo({ ...AMBIANCES['fin-apres-midi'], heure: 16.3, nuages: 0.6, orage: 0.7, pluie: 0.2, brume: 0.22, vent: 25, directionVent: 222, front: 0.3 }) },
  coucher: { nom: 'Coucher du soleil', meteo: () => etatMeteo({ ...AMBIANCES['coucher-menacant'], heure: 18.95, vent: 25.5, directionVent: 222, nuages: 0.74, orage: 0.62, pluie: 0.1, brume: 0.29, front: 0.8, houle: { hs: 2.2, periode: 12, direction: 252 } }) },
  crepuscule: { nom: 'Minuit', meteo: () => meteoDeLaNuit(24.2) },
  nuit: { nom: '3 h', meteo: () => meteoDeLaNuit(27) },
  fort: { nom: 'Au plus fort (5 h 20)', meteo: () => meteoDeLaNuit(29.35) },
};
let moment = MOMENTS[parametres.get('moment')] ? parametres.get('moment') : 'jour';
let meteo = MOMENTS[moment].meteo();
monde.regler(meteo);

// ---------- Les grains ----------
const grains = new Grains(7);
monde.etatGrains = grains;
let principal = null; // le grain qu'on regarde
const reglage = {
  force: 0.9,
  orage: 0.8,
  distance: Number(parametres.get('distance') ?? 3000),
  cap: null, // (d'où on le voit, depuis le bateau ; par défaut : d'où il vient, au vent)
  vitesse: 1, // (le temps des grains : 0, 1 ou 4)
  alentour: false,
};
let sansGrains = false; // (le banc d'essai : une image sans eux)
function seulement() {
  grains.maj(0, meteo, 0, 0);
  grains.liste = grains.liste.filter((g) => g === principal);
  grains.peuple = true;
  grains.attente = 1e9;
}
seulement();
const capDuGrain = () => reglage.cap ?? (meteo.directionVent + REGLAGES_GRAINS.derive + 360) % 360;
const centreBateau = () => bateau.groupe.position;
// (un grain posé là, immobile, à pleine force : pour les photos)
function poser() {
  if (principal) grains.liste = grains.liste.filter((g) => g !== principal);
  const r = THREE.MathUtils.degToRad(capDuGrain());
  const c = centreBateau();
  grains.orienter(meteo);
  principal = grains.creer({
    x: c.x + Math.sin(r) * reglage.distance, z: c.z - Math.cos(r) * reglage.distance,
    rayon: 650 + reglage.force * 450, force: reglage.force, orage: reglage.orage, duree: 1e9, age: 400, prevu: true,
  });
  tempsDesGrains(0);
}
// (un grain qui vient sur le bateau, ou qui passe à côté : il naît à 2,5 km)
function lancer(ecart) {
  if (principal) grains.liste = grains.liste.filter((g) => g !== principal);
  const c = centreBateau();
  principal = grains.lancer({ x: c.x, z: c.z, dans: 170, force: reglage.force, orage: reglage.orage, ecart });
  historique.length = 0;
  tempsDesGrains(Math.max(1, reglage.vitesse));
}
function alentour(oui) {
  reglage.alentour = oui;
  document.getElementById('alentour').checked = oui;
  if (oui) {
    grains.peuple = false;
    grains.attente = 0;
  } else seulement();
}

// ---------- Le bateau : il fuit, le vent sur la hanche (comme dans la nuit du jeu) ----------
function orienterBateau() {
  bateau.cap = (meteo.directionVent + 155) % 360;
  const r = bateau.reglage;
  r.ris = 2;
  r.deroule = 0.3;
  r.cote = 1;
  r.coteFoc = 1;
  r.angleBome = 1.0;
  r.angleFoc = 0.7;
  r.faseyement = 0;
  r.faseyementFoc = 0;
  r.force = 0.6;
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
  dedans: 'Sous la pluie',
};
let vue = VUES[parametres.get('vue')] ? parametres.get('vue') : 'cockpit';
const regard = { cap: 0, site: 0 };
let hauteurLissee = 0;
function directionDepuisCap(cap, site) {
  const c = THREE.MathUtils.degToRad(cap);
  const s = THREE.MathUtils.degToRad(site);
  return new THREE.Vector3(Math.sin(c) * Math.cos(s), Math.sin(s), -Math.cos(c) * Math.cos(s));
}
// (le cœur du grain : là où sa pluie est la plus dense)
function coeur() {
  if (!principal) {
    const r = THREE.MathUtils.degToRad(capDuGrain());
    const c = centreBateau();
    return { x: c.x + Math.sin(r) * reglage.distance, z: c.z - Math.cos(r) * reglage.distance };
  }
  return grains.noyau(principal, principal.noyaux[0], {});
}
const capVers = (depuis, cible) => THREE.MathUtils.radToDeg(Math.atan2(cible.x - depuis.x, -(cible.z - depuis.z)));
function placerCamera(dt) {
  const cam = monde.camera;
  const c = coeur();
  const base = monde.ciel.uniformsNuages.uBaseNuages.value;
  if (vue === 'haut') {
    // haut, mais sous la base des nuages, à 2,5 km du grain, du côté du bateau : ses
    // rideaux, sa rafale sur la mer
    const a = THREE.MathUtils.degToRad(capVers(c, centreBateau()) + regard.cap);
    cam.position.set(c.x + Math.sin(a) * 2500, Math.max(60, base * 0.6 + regard.site * 8), c.z - Math.cos(a) * 2500);
    cam.lookAt(c.x, 0, c.z);
    return;
  }
  if (vue === 'loin') {
    // de côté, à 6 km : toute sa hauteur, de la mer au nuage
    const v = principal ? Math.atan2(principal.vx, -principal.vz) : THREE.MathUtils.degToRad(capDuGrain());
    const a = v + Math.PI / 2 + THREE.MathUtils.degToRad(regard.cap);
    cam.position.set(c.x + Math.sin(a) * 6000, 8, c.z - Math.cos(a) * 6000);
    cam.position.y = Math.max(cam.position.y, monde.houle.hauteur(cam.position.x, cam.position.z) + 6);
    cam.lookAt(new THREE.Vector3(c.x, base * 0.55 + regard.site * 40, c.z));
    return;
  }
  if (vue === 'dedans') {
    // au ras de l'eau, sous le cœur du grain
    const h = monde.houle.hauteur(c.x, c.z);
    hauteurLissee += (h - hauteurLissee) * Math.min(1, dt * 6);
    cam.position.set(c.x, hauteurLissee + 3, c.z);
    const route = principal ? THREE.MathUtils.radToDeg(Math.atan2(principal.vx, -principal.vz)) : 0;
    cam.lookAt(cam.position.clone().add(directionDepuisCap(route + regard.cap, 4 + regard.site)));
    return;
  }
  if (vue === 'fixe') {
    // immobile, à 6 m au-dessus de la mer, du côté du bateau, à la distance choisie du grain
    // posé (rien ne bouge que le grain : pour les films)
    const b = centreBateau();
    cam.position.set(b.x, 6, b.z);
    const site = THREE.MathUtils.radToDeg(Math.atan2(base * 0.5, reglage.distance));
    cam.lookAt(cam.position.clone().add(directionDepuisCap(capDuGrain() + regard.cap, site + regard.site)));
    return;
  }
  // assis à la barre : on regarde le grain (derrière nous : il vient du vent)
  cam.position.copy(Bateau.POSTES.barreur).applyMatrix4(bateau.groupe.matrixWorld);
  const d = Math.hypot(c.x - cam.position.x, c.z - cam.position.z);
  const site = THREE.MathUtils.radToDeg(Math.atan2(base * 0.45, Math.max(d, 300)));
  cam.lookAt(cam.position.clone().add(directionDepuisCap(capVers(cam.position, c) + regard.cap, site + regard.site)));
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

// ---------- Ce qu'il fait au bateau ----------
const ici = {};
const historique = []; // (toutes les demi-secondes du temps des grains : la traversée)
let ageHistorique = 0;
function ventIci() {
  // le vent du moment, plus celui des grains (nœuds, et de combien il a tourné)
  const a = angleVers(meteo.directionVent);
  const v0x = Math.cos(a) * meteo.vent * NOEUD;
  const v0z = Math.sin(a) * meteo.vent * NOEUD;
  const vx = v0x + ici.vent.x;
  const vz = v0z + ici.vent.z;
  const tourne = THREE.MathUtils.radToDeg(Math.atan2(v0x * vz - v0z * vx, v0x * vx + v0z * vz));
  return { noeuds: Math.hypot(vx, vz) / NOEUD, tourne };
}
function suivre(dtGrains) {
  const b = centreBateau();
  grains.mesurer(b.x, b.z, ici);
  ageHistorique += dtGrains;
  if (dtGrains > 0 && ageHistorique >= 0.5) {
    ageHistorique = 0;
    const v = ventIci();
    historique.push({ pluie: ici.pluie, vent: v.noeuds, tourne: v.tourne, averse: ici.approche });
    if (historique.length > 420) historique.shift();
  }
}

// ---------- Le radar (le même que dans le jeu) ----------
const radarMonde = { hs: 1, pluie: 0, vent: { x: 0, z: 0 }, temps: 0, terre: distanceALaTerre, cibles: [], grains };
const ecranRadar = document.getElementById('radar').getContext('2d');
let ageRadar = 0;
function majRadar(dt) {
  radarMonde.hs = monde.houle.hauteurSignificative;
  radarMonde.pluie = meteo.pluie;
  radarMonde.temps = monde.temps;
  radarMonde.grains = sansGrains ? null : grains;
  const b = centreBateau();
  bateau.radar.maj(dt, { x: b.x, z: b.z, cap: bateau.cap }, radarMonde, 0);
  ageRadar += dt;
  if (ageRadar > 0.1) {
    ageRadar = 0;
    ecranRadar.drawImage(bateau.radar.ecran, 0, 0, 256, 256);
  }
}
document.getElementById('portee').addEventListener('click', () => {
  bateau.radar.changerPortee(1);
  document.getElementById('portee').textContent = `Portée : ${String(bateau.radar.milles).replace('.', ',')} milles`;
});

// ---------- Le panneau ----------
const boutonsMoment = new Map();
for (const [id, m] of Object.entries(MOMENTS)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = m.nom;
  b.addEventListener('click', () => choisirMoment(id));
  boutonsMoment.set(id, b);
  document.getElementById('moments').append(b);
}
// (n'importe quelle heure de la nuit du jeu : __grains.heure(20.4))
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
  grains.orienter(meteo);
  orienterBateau();
  legende();
}
const boutonsVue = new Map();
for (const [id, nom] of Object.entries(VUES)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = nom;
  b.addEventListener('click', () => choisirVue(id));
  boutonsVue.set(id, b);
  document.getElementById('vues').append(b);
}
function choisirVue(id) {
  vue = id;
  regard.cap = 0;
  regard.site = 0;
  for (const [k, b] of boutonsVue) b.setAttribute('aria-pressed', String(k === id));
  legende();
}
const boutonsTemps = { 0: document.getElementById('temps-pause'), 1: document.getElementById('temps-x1'), 4: document.getElementById('temps-x4') };
function tempsDesGrains(v) {
  reglage.vitesse = v;
  for (const [k, b] of Object.entries(boutonsTemps)) b.setAttribute('aria-pressed', String(Number(k) === v));
}
for (const [k, b] of Object.entries(boutonsTemps)) b.addEventListener('click', () => tempsDesGrains(Number(k)));
document.getElementById('passer').addEventListener('click', () => lancer(0));
document.getElementById('cote').addEventListener('click', () => lancer(900));
document.getElementById('poser').addEventListener('click', () => poser());
document.getElementById('eclair').addEventListener('click', () => {
  const c = coeur();
  const a = Math.random() * Math.PI * 2;
  monde.eclairSur(c.x + Math.cos(a) * 250, c.z + Math.sin(a) * 250);
});
document.getElementById('alentour').addEventListener('change', (e) => alentour(e.currentTarget.checked));
for (const [id, cle, format] of [['force', 'force', (v) => v.toFixed(2)], ['orage', 'orage', (v) => v.toFixed(2)], ['distance', 'distance', (v) => `${(v / 1000).toFixed(1)} km`]]) {
  const champ = document.getElementById(id);
  const texte = document.getElementById(`${id}-texte`);
  champ.value = reglage[cle];
  texte.textContent = format(reglage[cle]);
  champ.addEventListener('input', () => {
    reglage[cle] = Number(champ.value);
    texte.textContent = format(reglage[cle]);
    if (principal) {
      principal.force = reglage.force;
      principal.orage = reglage.orage;
    }
    if (cle === 'distance' && principal && reglage.vitesse === 0) poser();
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
  const c = coeur();
  const b = centreBateau();
  const d = Math.hypot(c.x - b.x, c.z - b.z);
  zoneLegende.textContent = `${MOMENTS[moment].nom} · ${VUES[vue]} · le grain à ${d > 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d / 10) * 10} m`} du bateau`;
}

// Les chiffres, et les courbes de la traversée (quatre petites courbes, chacune son échelle)
const zoneIci = document.getElementById('ici');
const zoneCourbes = document.getElementById('courbes');
const zoneResume = document.getElementById('resume');
function afficherIci() {
  const v = ventIci();
  const b = centreBateau();
  const m = grains.menace(b.x, b.z, 0, 0, { horizon: 900, cpaMax: 2500 });
  const lignes = [
    ['Pluie', `${Math.round(ici.pluie * 100)} %`],
    ['Vent', `${Math.round(v.noeuds)} nœuds (moyen ${Math.round(meteo.vent)})`],
    ['Le vent tourne de', `${v.tourne >= 0 ? '+' : ''}${Math.round(v.tourne)}°`],
    ['Bourrasques', `${Math.round(ici.agitation * 100)} %`],
    ['L\'ombre du nuage', `${Math.round(ici.ombre * 100)} %`],
    ['L\'averse qu\'on entend', `${Math.round(ici.approche * 100)} %`],
  ];
  if (m) lignes.push(['Il arrive', `dans ${Math.round(m.dans)} s, à ${Math.round(m.cpa)} m au plus près`]);
  zoneIci.innerHTML = lignes.map(([a, b2]) => `<dt>${a}</dt><dd>${b2}</dd>`).join('');
  if (principal) {
    const I = grains.intensite(principal);
    zoneResume.textContent = `Le grain : ${Math.round(principal.rayon * 2)} m de large, force ${principal.force.toFixed(2)} (${Math.round(I * 100)} % maintenant), ${principal.orage > 0.5 ? 'plein d\'éclairs' : principal.orage > 0 ? 'quelques éclairs' : 'sans éclairs'} ; il avance à ${Math.round(Math.hypot(principal.vx, principal.vz) / NOEUD)} nœuds.`;
  } else zoneResume.textContent = 'Fais passer un grain sur le bateau, ou pose-le à la distance voulue.';
  dessinerCourbes();
}
const COURBES = [
  { cle: 'pluie', titre: 'Pluie', min: 0, max: 1, couleur: '#6aa9e8', texte: (x) => `${Math.round(x * 100)} %` },
  { cle: 'vent', titre: 'Vent (nœuds)', min: null, max: null, couleur: '#e8a24a', texte: (x) => `${Math.round(x)}` },
  { cle: 'tourne', titre: 'Le vent tourne (°)', min: -30, max: 30, couleur: '#c792ea', zero: true, texte: (x) => `${x >= 0 ? '+' : ''}${Math.round(x)}°` },
  { cle: 'averse', titre: 'L\'averse qu\'on entend', min: 0, max: 1, couleur: '#7fd1b9', texte: (x) => `${Math.round(x * 100)} %` },
];
function dessinerCourbes() {
  if (!historique.length) {
    zoneCourbes.innerHTML = '';
    return;
  }
  const L = 300;
  const H = 46;
  const n = historique.length;
  const x = (i) => 4 + (i / Math.max(1, 419)) * (L - 8);
  let svg = `<svg viewBox="0 0 ${L} ${COURBES.length * (H + 18)}" xmlns="http://www.w3.org/2000/svg">`;
  COURBES.forEach((c, k) => {
    const valeurs = historique.map((e) => e[c.cle]);
    let min = c.min ?? Math.floor(Math.min(...valeurs) / 5) * 5 - 5;
    let max = c.max ?? Math.ceil(Math.max(...valeurs) / 5) * 5 + 5;
    if (max - min < 1e-6) max = min + 1;
    const y0 = k * (H + 18) + 14;
    const y = (v) => y0 + H - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * H;
    const points = valeurs.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    svg += `<text class="titre" x="4" y="${y0 - 3}">${c.titre}</text>`;
    svg += `<text class="valeur" x="${L - 4}" y="${y0 - 3}" text-anchor="end">${c.texte(valeurs[n - 1])}</text>`;
    svg += `<rect class="cadre" x="0.5" y="${y0}" width="${L - 1}" height="${H}" rx="3"/>`;
    if (c.zero) svg += `<line class="zero" x1="0" x2="${L}" y1="${y(0)}" y2="${y(0)}"/>`;
    svg += `<polyline class="trait" stroke="${c.couleur}" points="${points}"/>`;
  });
  zoneCourbes.innerHTML = `${svg}</svg>`;
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
    dernier = performance.now();
  }
}
function uneImage(dt) {
  const dtGrains = dt * reglage.vitesse;
  const b = centreBateau();
  if (dtGrains > 0) grains.maj(dtGrains, meteo, b.x, b.z);
  else grains.meteo = meteo;
  suivre(dtGrains);
  monde.etatGrains = sansGrains ? null : grains;
  majRadar(dt);
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
async function photographier({ images = 40 } = {}) {
  for (let i = 0; i < images; i++) {
    uneImage(1 / 60);
    if (i % 20 === 19) await new Promise((r) => setTimeout(r, 0));
  }
  uneImage(1 / 60);
  return monde.photo();
}
async function photo(nom = `grain-${moment}-${vue}-${Date.now()}`, options) {
  return enTournage(async () => {
    const avant = reglage.vitesse;
    tempsDesGrains(0);
    try {
      return await envoyerCapture(nom, await photographier(options));
    } finally {
      tempsDesGrains(avant);
    }
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

// (un éclair dans le grain, juste avant la photo : la nuit, on ne le voit qu'ainsi)
function eclairDans(visible = true) {
  const c = coeur();
  const a = Math.random() * Math.PI * 2;
  const r = (principal?.rayon ?? 700) * 0.5;
  monde.foudre.lancer({ type: visible ? 'mer' : 'nuage', x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r, eclats: 1, force: 1.2 });
}

// La planche : les moments en colonnes, les points de vue en lignes, un grain posé à la
// distance voulue. eclair : un éclair dans le grain juste avant la photo, la nuit
async function planche(nom, options) {
  return enTournage(() => plancheSansPause(nom, options));
}
async function plancheSansPause(nom, { moments = ['jour', 'coucher', 'crepuscule', 'nuit'], vues = ['cockpit', 'loin', 'haut'], distance = 3000, largeur = 480, images = 50, eclairLaNuit = true } = {}) {
  const hauteurCase = Math.round(largeur * 9 / 16);
  const toile = document.createElement('canvas');
  const titre = 30;
  toile.width = largeur * moments.length;
  toile.height = titre + hauteurCase * vues.length;
  const ctx = toile.getContext('2d');
  ctx.fillStyle = '#0c1418';
  ctx.fillRect(0, 0, toile.width, toile.height);
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillStyle = '#e6eef0';
  moments.forEach((m, i) => ctx.fillText(MOMENTS[m].nom, i * largeur + 12, 21));
  const avant = { moment, vue, distance: reglage.distance, vitesse: reglage.vitesse, regard: { ...regard } };
  reglage.distance = distance;
  for (const [i, m] of moments.entries()) {
    choisirMoment(m);
    poser();
    for (const [j, v] of vues.entries()) {
      choisirVue(v);
      monde.foudre.vider();
      monde.foudre.retenir(1e9);
      const nuit = monde.ecl.nuit > 0.6;
      for (let k = 0; k < images; k++) {
        if (eclairLaNuit && nuit && k === images - 4) eclairDans(true);
        uneImage(1 / 60);
        if (k % 20 === 19) await new Promise((r) => setTimeout(r, 0));
      }
      // (la photo dans la même tâche que le rendu : après une attente, l'image serait noire)
      uneImage(1 / 60);
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
        ctx.fillRect(x, y + hauteurCase - 24, Math.min(largeur, ctx.measureText(VUES[v]).width + 20), 24);
        ctx.fillStyle = '#fff';
        ctx.font = '14px system-ui, sans-serif';
        ctx.fillText(VUES[v], x + 10, y + hauteurCase - 7);
        ctx.font = '600 16px system-ui, sans-serif';
        ctx.fillStyle = '#e6eef0';
      }
    }
  }
  reglage.distance = avant.distance;
  choisirMoment(avant.moment);
  choisirVue(avant.vue);
  Object.assign(regard, avant.regard);
  tempsDesGrains(avant.vitesse);
  monde.foudre.liberer();
  return envoyerCapture(nom, toile.toDataURL('image/jpeg', 0.9));
}

// Le film : des images enregistrées une à une (captures/film-<nom>-0001.jpg…), à assembler
// avec : node scripts/film.mjs <nom>. Le temps des grains avance à « vitesse » fois le
// temps du film. eclairsA : des éclairs dans le grain, à ces instants (s du film)
async function film(nom, options) {
  return enTournage(() => filmSansPause(nom, options));
}
async function filmSansPause(nom, { secondes = 8, ips = 30, avant = 40, vitesse = reglage.vitesse || 1, eclairsA = [] } = {}) {
  const dt = 1 / ips;
  const ancienne = reglage.vitesse;
  tempsDesGrains(0);
  for (let i = 0; i < avant; i++) uneImage(1 / 60);
  reglage.vitesse = vitesse;
  const n = Math.round(secondes * ips);
  const prevus = [...eclairsA];
  for (let i = 0; i < n; i++) {
    if (prevus.length && i * dt >= prevus[0]) eclairDans(prevus.shift() * 7 % 2 < 1);
    uneImage(dt);
    await envoyerCapture(`film-${nom}-${String(i + 1).padStart(4, '0')}`, monde.photo('image/jpeg', 0.88));
  }
  tempsDesGrains(ancienne);
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
    ['Rideaux dessinés', `${monde.ciel.grains.uniforms.uRideauxN.value}`],
  ];
  for (const [k, v] of Object.entries(mesuresGpu)) lignes.push([k, v]);
  zoneMesures.innerHTML = lignes.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
}
// Le banc d'essai d'images entières, avec et sans les grains, en alternance (la carte
// graphique change de vitesse d'un moment à l'autre : on compare côte à côte, et on garde le
// meilleur de chaque série ; on attend la carte graphique en lisant un pixel). Rend des ms
// par image.
function couts({ series = 4, images = 6 } = {}) {
  const gl = monde.renderer.getContext();
  const px = new Uint8Array(4);
  const attendre = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const vitesse = reglage.vitesse;
  reglage.vitesse = 0;
  const serie = (avec) => {
    sansGrains = !avec;
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
  sansGrains = false;
  reglage.vitesse = vitesse;
  const mieux = (l) => Math.round(Math.min(...l) * 100) / 100;
  const r = { avec: mieux(avec), sans: mieux(sans), grains: Math.round((mieux(avec) - mieux(sans)) * 100) / 100 };
  mesuresGpu['Une image, avec les grains'] = `${r.avec} ms`;
  mesuresGpu['Une image, sans eux'] = `${r.sans} ms`;
  afficherMesures();
  return r;
}
document.getElementById('mesurer').addEventListener('click', async (e) => {
  e.currentTarget.disabled = true;
  zoneEtat.textContent = 'Mesure en cours…';
  await new Promise((r) => setTimeout(r, 50));
  try {
    const r = couts();
    zoneEtat.textContent = `Les grains coûtent ${r.grains} ms par image (meilleur de 4 séries de 6 images).`;
  } finally {
    e.currentTarget.disabled = false;
  }
});

// Ce que coûte chaque morceau des grains (rideaux de pluie, rafales sur la mer, carte du
// nuage d'orage) : on le coupe, et on compare
function coutsDetailles({ series = 4, images = 8 } = {}) {
  const m = monde.ciel.grains.masque;
  const resultat = { tout: couts({ series, images }).grains };
  for (const k of ['rideaux', 'rafales', 'carte']) {
    m[k] = false;
    monde.ciel.grains.ageCarte = Infinity;
    resultat[`sans ${k}`] = couts({ series, images }).grains;
    m[k] = true;
  }
  monde.ciel.grains.ageCarte = Infinity;
  return resultat;
}

// La fluidité en vrai (la boucle de l'écran) : les images par seconde pendant quelques
// secondes, avec puis sans les grains (en alternance, plusieurs fois)
async function fluidite({ secondes = 3, fois = 2 } = {}) {
  const mesurer = async () => {
    await new Promise((r) => setTimeout(r, 300));
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
    return n / ((performance.now() - debut) / 1000);
  };
  const avec = [];
  const sans = [];
  for (let k = 0; k < fois; k++) {
    sansGrains = false;
    avec.push(await mesurer());
    sansGrains = true;
    sans.push(await mesurer());
  }
  sansGrains = false;
  const moy = (l) => Math.round((l.reduce((a, b) => a + b, 0) / l.length) * 10) / 10;
  return { avec: moy(avec), sans: moy(sans) };
}

window.__grains = {
  monde, grains, reglage, regard, bateau, ici, historique,
  get principal() { return principal; },
  moment: choisirMoment, heure: choisirHeure, vue: choisirVue, poser, lancer, alentour, temps: tempsDesGrains,
  eclair: eclairDans, photo, planche, film, couts, coutsDetailles, fluidite, uneImage,
  // (redessiner le panneau tout de suite : quand l'onglet est caché, sa boucle s'arrête)
  panneau() { afficherMesures(); afficherIci(); legende(); },
  sans(oui = true) { sansGrains = oui; },
};

// ---------- La boucle ----------
choisirMoment(moment);
choisirVue(vue);
if (parametres.has('passer')) lancer(Number(parametres.get('passer')) || 0);
else poser();
let dernier = performance.now();
let ageMesures = 0;
function boucle(maintenant) {
  const dt = Math.min((maintenant - dernier) / 1000, 0.05);
  dernier = maintenant;
  if (!tournage) uneImage(dt);
  ageMesures += dt;
  if (ageMesures > 0.25) {
    afficherMesures();
    afficherIci();
    legende();
    ageMesures = 0;
  }
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);
