// Atelier du baromètre : le baromètre annonce le temps (monde/pression.js). La dépression qui
// arrive, de la matinée au lendemain matin : la pression qui baisse de plus en plus vite bien
// avant le vent, le fond quand le front passe, la remontée ; le bond d'un grain qui passe
// sur le bateau ; le cadran de la timonerie, son aiguille qui colle (on tapote le verre) et
// son aiguille témoin (on la cale) ; le barographe du traceur ; et trois courbes : la
// pression, ce qu'elle a fait en trois heures, le vent.
//
// Adresse : atelier-barometre.html?heure=16.5&vue=cadran
// Dans la console : __barometre (voir en bas : heure, tapoter, caler, grain, photo, planche).
import * as THREE from 'three';
import { Monde3D } from './rendu/monde3d.js';
import { meteoDuJour, HEURE_COUCHER, heureEnTexte } from './jeu/journee.js';
import { meteoDeLaNuit } from './jeu/nuit.js';
import { Bateau } from './bateau/bateau.js';
import { YEUX_POSTE } from './bateau/interieur-timonerie.js';
import { Grains } from './monde/grains.js';
import {
  Barometre, PRESSIONS, HEURE_DU_FRONT, pressionDuJour, tendance, tendanceRecente, tendanceEnMots, annonce, fleche,
} from './monde/pression.js';

const parametres = new URLSearchParams(location.search);
const canvas = document.getElementById('scene');
const monde = new Monde3D(canvas);
const bateau = monde.ajouterBateau();
const barometre = new Barometre();
const grains = new Grains(5);
monde.etatGrains = grains;

// ---------- L'heure ----------
const DEBUT = 9;
const FIN = 31;
const meteoA = (h) => (h < HEURE_COUCHER ? meteoDuJour(h) : meteoDeLaNuit(h));
const reglage = {
  heure: Math.min(FIN, Math.max(DEBUT, Number(parametres.get('heure') ?? 16.5))),
  vitesse: 0, // (heures du jeu par seconde : 0, ou 1/6 — une heure en six secondes)
};
let meteo = meteoA(reglage.heure);
let ageMeteo = 0;
const MOMENTS = {
  9: '9 h',
  12.5: 'Midi et demi',
  16.75: '16 h 45 (Jos)',
  18.75: 'Le coucher',
  21: '21 h',
  24: 'Minuit',
  [HEURE_DU_FRONT]: 'Le front',
  28.4: '4 h 25',
  30: 'L\'aube',
};

// la pression ici : celle de la dépression qui arrive, et les grains
const pressionIci = () => pressionDuJour(reglage.heure) + grains.pressionEn(bateau.groupe.position.x, bateau.groupe.position.z);

// ---------- Un grain sur le bateau ----------
function grainSurNous() {
  grains.vider();
  grains.maj(0, meteo, bateau.groupe.position.x, bateau.groupe.position.z);
  grains.liste = [];
  grains.peuple = true;
  grains.attente = 1e9;
  const b = bateau.groupe.position;
  grains.lancer({ x: b.x, z: b.z, dans: 100, force: 0.9, orage: 0.8, ecart: 60 });
}

// ---------- Le bateau, la cabine ----------
function orienterBateau() {
  bateau.cap = (meteo.directionVent + 155) % 360;
  Object.assign(bateau.reglage, { ris: 2, deroule: 0.3, cote: 1, coteFoc: 1, angleBome: 1.0, angleFoc: 0.7, faseyement: 0, faseyementFoc: 0, force: 0.6 });
  bateau.gite = 0.06;
}
function eclairerBateau() {
  const nuit = monde.ecl.nuit;
  bateau.allumerFeux(nuit);
  // (la nuit, la lumière blanche de la cabine : pour lire le cadran)
  bateau.interieur.regler({
    eclairage: nuit > 0.5 ? 'blanc' : 'eteint', feux: nuit > 0.5, ciel: monde.ecl.ambiance, eclair: monde.eclair.intensite,
    pression: barometre.aiguille ?? pressionIci(), temoin: barometre.temoin, heure: reglage.heure % 24, nuit,
  });
  bateau.instruments.maj(1 / 60, { vitesse: 6, cap: bateau.cap, angleVentApparent: 150, ventApparent: meteo.vent, incidenceFoc: 18, incidenceGV: 20 }, nuit);
  const b = bateau.groupe.position;
  bateau.electronique.maj(1 / 60, {
    x: b.x, z: b.z, cap: bateau.cap, vitesse: 6, route: bateau.cap, pilote: bateau.cap, panne: false, barre: 0, bouees: [], nuit,
    baro: barometre.aiguille === null ? null : { p: barometre.aiguille, dp: tendance(reglage.heure), historique: barometre.historique, heure: reglage.heure },
    vacille: 1,
  });
}

// ---------- Le point de vue ----------
const VUES = {
  cadran: 'Le cadran, de près',
  timonerie: 'Du siège de la timonerie',
  traceur: 'Le traceur (son barographe)',
  dehors: 'Dehors, vers le vent',
};
let vue = VUES[parametres.get('vue')] ? parametres.get('vue') : 'cadran';
const CHAMP = monde.camera.fov;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
function placerCamera() {
  const cam = monde.camera;
  cam.up.set(0, 1, 0);
  const g = bateau.groupe;
  const i = bateau.interieur;
  let champ = CHAMP;
  if (vue === 'cadran') {
    // (à 25 cm du verre, un peu de côté : le cadran regarde vers bâbord)
    _b.copy(i.positionBarometre);
    cam.position.copy(_b).add(_a.set(-0.25, 0.03, -0.04)).applyMatrix4(g.matrixWorld);
    cam.lookAt(_b.applyMatrix4(g.matrixWorld));
    champ = 34;
  } else if (vue === 'timonerie') {
    cam.position.copy(YEUX_POSTE).applyMatrix4(g.matrixWorld);
    cam.lookAt(_b.copy(i.positionBarometre).applyMatrix4(g.matrixWorld));
    champ = 60;
  } else if (vue === 'traceur') {
    // (des yeux du siège vers l'écran, aux deux tiers du chemin)
    const ecran = _b.copy(bateau.electronique.positionTraceur);
    cam.position.copy(YEUX_POSTE).lerp(ecran, 0.62).applyMatrix4(g.matrixWorld);
    cam.lookAt(ecran.applyMatrix4(g.matrixWorld));
    champ = 40;
  } else {
    cam.position.copy(Bateau.POSTES.barreur).applyMatrix4(g.matrixWorld);
    const r = THREE.MathUtils.degToRad(meteo.directionVent);
    cam.lookAt(cam.position.clone().add(_a.set(Math.sin(r), 0.12, -Math.cos(r))));
  }
  if (cam.fov !== champ) {
    cam.fov = champ;
    cam.updateProjectionMatrix();
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
  if (reglage.vitesse > 0) changerHeure(Math.min(FIN, reglage.heure + reglage.vitesse * dt), { brusque: false });
  // (le temps qu'il fait suit l'heure, dix fois par seconde)
  ageMeteo += dt;
  if (ageMeteo > 0.1) {
    ageMeteo = 0;
    const m = meteoA(reglage.heure);
    meteo = m;
    monde.regler(m, { recalculerMer: false, brusque: false });
  }
  const b = bateau.groupe.position;
  grains.maj(dt, meteo, b.x, b.z);
  grains.attente = 1e9;
  barometre.maj(dt, pressionIci(), { heure: reglage.heure, passe: pressionDuJour });
  eclairerBateau();
  monde.image(dt, { toutLeCube, placerCamera });
  toutLeCube = false;
}
function changerHeure(h, { brusque = true } = {}) {
  reglage.heure = Math.min(FIN, Math.max(DEBUT, h));
  if (brusque) {
    meteo = meteoA(reglage.heure);
    monde.regler(meteo);
    orienterBateau();
    toutLeCube = true;
    grains.vider();
    grains.peuple = true;
    grains.attente = 1e9;
  }
  document.getElementById('heure').value = String(reglage.heure);
  document.getElementById('heure-texte').textContent = heureEnTexte(reglage.heure);
}

// ---------- Le panneau ----------
function boutons(zone, liste, choisir) {
  const carte = new Map();
  for (const [id, x] of Object.entries(liste)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = x;
    b.addEventListener('click', () => choisir(id));
    carte.set(id, b);
    document.getElementById(zone).append(b);
  }
  return carte;
}
boutons('moments', MOMENTS, (h) => changerHeure(Number(h)));
const boutonsVue = boutons('vues', VUES, (id) => choisirVue(id));
function choisirVue(id) {
  vue = id;
  for (const [k, b] of boutonsVue) b.setAttribute('aria-pressed', String(k === id));
  legende();
}
const boutonsTemps = { 0: 'temps-pause', [1 / 6]: 'temps-vite' };
function temps(v) {
  reglage.vitesse = v;
  for (const [k, id] of Object.entries(boutonsTemps)) document.getElementById(id).setAttribute('aria-pressed', String(Math.abs(Number(k) - v) < 1e-9));
}
for (const [k, id] of Object.entries(boutonsTemps)) document.getElementById(id).addEventListener('click', () => temps(Number(k)));
document.getElementById('heure').addEventListener('input', (e) => changerHeure(Number(e.currentTarget.value)));
document.getElementById('tapoter').addEventListener('click', () => barometre.tapoter());
document.getElementById('caler').addEventListener('click', () => barometre.caler(reglage.heure));
document.getElementById('grain').addEventListener('click', () => grainSurNous());
const panneau = document.getElementById('panneau');
document.getElementById('replier').addEventListener('click', (e) => {
  const replie = panneau.classList.toggle('replie');
  e.currentTarget.setAttribute('aria-expanded', String(!replie));
  e.currentTarget.textContent = replie ? 'Déplier' : 'Replier';
});
if (parametres.has('replie')) panneau.classList.add('replie');
const zoneLegende = document.getElementById('legende');
function legende() {
  zoneLegende.textContent = `${heureEnTexte(reglage.heure)} · ${Math.round(meteo.vent)} nœuds · ${VUES[vue]}`;
}

// Ce que montre le baromètre, et ce qu'il annonce
const zoneLecture = document.getElementById('lecture');
const nombre = (x, n = 1) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(n).replace('.', ',')}`;
function afficherLecture() {
  const h = reglage.heure;
  const dp = tendance(h);
  const lignes = [
    ['La pression', `${pressionIci().toFixed(1).replace('.', ',')} hPa`],
    ['L\'aiguille', `${(barometre.aiguille ?? 0).toFixed(1).replace('.', ',')} hPa${Math.abs(pressionIci() - (barometre.aiguille ?? 0)) > 0.15 ? ' (elle colle : tapote le verre)' : ''}`],
    ['L\'aiguille témoin', barometre.calee === null ? 'pas calée' : `${barometre.temoin.toFixed(1).replace('.', ',')} hPa, calée à ${heureEnTexte(barometre.calee)} (${nombre(barometre.depuisLaTemoin)} depuis)`],
    ['En trois heures', `${nombre(dp)} hPa : ${tendanceEnMots(dp)} ${fleche(tendanceRecente(h))}`],
    ['Ce qu\'il annonce', annonce(dp) ?? (dp > 2 ? 'le front est passé : le temps se lève' : 'rien de particulier')],
    ['Le bond du grain', grains.liste.length ? `${nombre(grains.pressionEn(bateau.groupe.position.x, bateau.groupe.position.z))} hPa` : 'pas de grain'],
  ];
  zoneLecture.innerHTML = lignes.map(([x, y]) => `<dt>${x}</dt><dd>${y}</dd>`).join('');
}

// Les trois courbes, de 9 h au lendemain 7 h (chacune son échelle ; le même temps en bas)
const zoneCourbes = document.getElementById('courbes');
const SERIES = (() => {
  const heures = [];
  for (let h = DEBUT; h <= FIN + 1e-9; h += 0.1) heures.push(h);
  return {
    heures,
    pression: heures.map((h) => pressionDuJour(h)),
    tendance: heures.map((h) => tendance(h)),
    vent: heures.map((h) => meteoA(h).vent),
  };
})();
// (les bandes de la tendance : ce que disent les bulletins)
const BANDES = [
  [-12, -6, 'très rapide', 'rgba(232, 92, 70, 0.22)'],
  [-6, -3.6, 'rapide', 'rgba(232, 150, 70, 0.18)'],
  [-3.6, -1.6, 'en baisse', 'rgba(232, 200, 90, 0.13)'],
  [1.6, 12, 'en hausse', 'rgba(110, 180, 230, 0.15)'],
];
function dessinerCourbes() {
  const L = 300;
  const H = 54;
  const x = (h) => 4 + ((h - DEBUT) / (FIN - DEBUT)) * (L - 8);
  const COURBES = [
    { cle: 'pression', titre: 'Pression (hPa)', min: 980, max: 1018, couleur: '#9fd3ff', valeur: pressionDuJour(reglage.heure).toFixed(1).replace('.', ',') },
    { cle: 'tendance', titre: 'En trois heures (hPa)', min: -9, max: 9, couleur: '#e8a24a', valeur: nombre(tendance(reglage.heure)), bandes: true },
    { cle: 'vent', titre: 'Vent (nœuds)', min: 0, max: 45, couleur: '#c792ea', valeur: `${Math.round(meteoA(reglage.heure).vent)}` },
  ];
  let svg = `<svg viewBox="0 0 ${L} ${COURBES.length * (H + 18) + 14}" xmlns="http://www.w3.org/2000/svg">`;
  COURBES.forEach((c, k) => {
    const y0 = k * (H + 18) + 14;
    const y = (v) => y0 + H - ((Math.min(c.max, Math.max(c.min, v)) - c.min) / (c.max - c.min)) * H;
    if (c.bandes) {
      for (const [a, b, nom, couleur] of BANDES) {
        svg += `<rect class="bande" x="0.5" y="${y(b).toFixed(1)}" width="${L - 1}" height="${(y(a) - y(b)).toFixed(1)}" fill="${couleur}"/>`;
        svg += `<text class="bande-texte" x="${L - 6}" y="${(y((Math.max(a, c.min) + Math.min(b, c.max)) / 2) + 3).toFixed(1)}" text-anchor="end">${nom}</text>`;
      }
    }
    const points = SERIES[c.cle].map((v, i) => `${x(SERIES.heures[i]).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    svg += `<text class="titre" x="4" y="${y0 - 3}">${c.titre}</text>`;
    svg += `<text class="valeur" x="${L - 4}" y="${y0 - 3}" text-anchor="end">${c.valeur}</text>`;
    svg += `<rect class="cadre" x="0.5" y="${y0}" width="${L - 1}" height="${H}" rx="3"/>`;
    svg += `<polyline class="trait" stroke="${c.couleur}" points="${points}"/>`;
  });
  // les repères : le coucher, minuit, le front, l'aube ; et l'heure qu'il est
  const bas = COURBES.length * (H + 18) + 6;
  for (const [h, nom] of [[HEURE_COUCHER, 'coucher'], [24, 'minuit'], [HEURE_DU_FRONT, 'front'], [30, 'aube']]) {
    svg += `<line class="repere" x1="${x(h).toFixed(1)}" x2="${x(h).toFixed(1)}" y1="10" y2="${bas}"/>`;
    svg += `<text class="repere-texte" x="${x(h).toFixed(1)}" y="${bas + 8}" text-anchor="middle">${nom}</text>`;
  }
  svg += `<line class="maintenant" x1="${x(reglage.heure).toFixed(1)}" x2="${x(reglage.heure).toFixed(1)}" y1="10" y2="${bas}"/>`;
  zoneCourbes.innerHTML = `${svg}</svg>`;
}

// ---------- Photos, planches (enregistrées dans captures/) ----------
async function envoyerCapture(nom, image) {
  const reponse = await fetch('/__capture', { method: 'POST', body: JSON.stringify({ nom, image }) });
  if (!reponse.ok) throw new Error(await reponse.text());
  return reponse.text();
}
function copierImage() {
  const c = monde.renderer.domElement;
  const toile = document.createElement('canvas');
  toile.width = c.width;
  toile.height = c.height;
  toile.getContext('2d').drawImage(c, 0, 0);
  return toile;
}
async function photo(nom = `barometre-${vue}-${Date.now()}`, { images = 30 } = {}) {
  return enTournage(async () => {
    for (let i = 0; i < images; i++) uneImage(1 / 60);
    return envoyerCapture(nom, copierImage().toDataURL('image/jpeg', 0.9));
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

// La planche : des cases (une heure, un point de vue ; temoin : l'heure où l'on a calé
// l'aiguille témoin ; grain : un grain passe sur le bateau, depuis tant de secondes)
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
  const avant = { heure: reglage.heure, vue, vitesse: reglage.vitesse };
  temps(0);
  for (const [k, c] of cases.entries()) {
    changerHeure(c.heure);
    barometre.historique.length = 0;
    barometre.aiguille = null;
    if (c.temoin !== undefined) {
      barometre.temoin = pressionDuJour(c.temoin);
      barometre.calee = c.temoin;
    } else {
      barometre.temoin = null;
      barometre.calee = null;
    }
    choisirVue(c.vue ?? 'cadran');
    if (c.grain) {
      grainSurNous();
      for (let i = 0; i < c.grain * 30; i++) {
        uneImage(1 / 30);
        if (i % 30 === 29) await new Promise((r) => setTimeout(r, 0));
      }
    }
    for (let i = 0; i < images; i++) {
      uneImage(1 / 60);
      if (i % 20 === 19) await new Promise((r) => setTimeout(r, 0));
    }
    // (une image de plus, copiée tout de suite : après une attente, la toile est vide)
    uneImage(1 / 60);
    const x = (k % colonnes) * largeur;
    const y = Math.floor(k / colonnes) * (titre + hauteurCase);
    const cv = monde.renderer.domElement;
    const ratio = cv.width / cv.height;
    let sl = cv.width;
    let sh = cv.height;
    if (ratio > 16 / 9) sl = sh * (16 / 9); else sh = sl / (16 / 9);
    ctx.drawImage(cv, (cv.width - sl) / 2, (cv.height - sh) / 2, sl, sh, x, y + titre, largeur, hauteurCase);
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = '#e6eef0';
    ctx.fillText(c.titre ?? '', x + 10, y + 18);
  }
  grains.vider();
  changerHeure(avant.heure);
  choisirVue(avant.vue);
  temps(avant.vitesse);
  return envoyerCapture(nom, toile.toDataURL('image/jpeg', 0.9));
}

window.__barometre = {
  monde, barometre, grains, reglage, PRESSIONS,
  heure: changerHeure, vue: choisirVue, temps, grain: grainSurNous,
  tapoter: () => barometre.tapoter(), caler: () => barometre.caler(reglage.heure),
  photo, planche, uneImage,
  panneau() { afficherLecture(); dessinerCourbes(); legende(); },
};

// ---------- La boucle ----------
changerHeure(reglage.heure);
choisirVue(vue);
temps(0);
let horloge = performance.now();
let ageAffichage = 0;
function boucle(maintenant) {
  const dt = Math.min((maintenant - horloge) / 1000, 0.05);
  horloge = maintenant;
  if (!tournage) uneImage(dt);
  ageAffichage += dt;
  if (ageAffichage > 0.2) {
    afficherLecture();
    dessinerCourbes();
    legende();
    ageAffichage = 0;
  }
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);
