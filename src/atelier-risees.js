// Atelier des risées : les taches de vent plus fort qui courent sur l'eau (et les molles,
// où il faiblit). On les voit venir de loin ; quand l'une arrive sur le bateau, il gîte,
// il accélère, le vent tourne un peu — le matin par petit temps, l'après-midi à la belle
// brise, au coucher quand ça forcit, dans un coup de vent de jour, dans la tempête.
// Le bateau navigue tout seul (la vraie physique, un pilote qui garde l'allure choisie, les
// voiles réglées automatiquement).
//
// Adresse : atelier-risees.html?moment=apres-midi&vue=cockpit&allure=pres
// Dans la console : __risees (voir en bas : envoyer, photo, planche, film, statistiques…).
import * as THREE from 'three';
import { Monde3D } from './rendu/monde3d.js';
import { AMBIANCES, etatMeteo, NOEUD } from './monde/meteo.js';
import { meteoDuJour } from './jeu/journee.js';
import { meteoDeLaNuit } from './jeu/nuit.js';
import { Bateau } from './bateau/bateau.js';
import { PhysiqueVoilier } from './physique/voilier.js';
import { reglerAutomatiquement } from './physique/regleur.js';
import { Vent } from './monde/vent.js';
import { REGLAGES_RISEES } from './monde/risees.js';

const parametres = new URLSearchParams(location.search);
const canvas = document.getElementById('scene');
const monde = new Monde3D(canvas);
const bateau = monde.ajouterBateau();
const physique = new PhysiqueVoilier();
const vent = new Vent(9);
const risees = vent.risees;
monde.etatRisees = risees;

// ---------- Les moments ----------
// (le coup de vent de jour n'existe pas dans le jeu : pour voir les risées de la tempête
// en plein jour)
const MOMENTS = {
  matin: { nom: 'Le matin, petit temps', meteo: () => meteoDuJour(10.2), toile: { ris: 0, deroule: 1 } },
  'apres-midi': { nom: 'L\'après-midi, belle brise', meteo: () => meteoDuJour(15.5), toile: { ris: 0, deroule: 1 } },
  coucher: { nom: 'Au coucher, ça forcit', meteo: () => meteoDeLaNuit(18.95), toile: { ris: 2, deroule: 0.45 } },
  'coup-de-vent': {
    nom: 'Un coup de vent, de jour',
    meteo: () => etatMeteo({ ...AMBIANCES['fin-apres-midi'], heure: 16.2, vent: 34, orage: 0.65, nuages: 0.72, pluie: 0.05, brume: 0.3 }),
    toile: { ris: 2, deroule: 0.3 },
  },
  tempete: { nom: 'Dans la tempête, la nuit', meteo: () => meteoDeLaNuit(26.6), toile: { ris: 3, deroule: 0.18 } },
};
let moment = MOMENTS[parametres.get('moment')] ? parametres.get('moment') : 'apres-midi';
let meteo = MOMENTS[moment].meteo();
monde.regler(meteo);

// ---------- L'allure (l'angle du vent que garde le pilote) ----------
const ALLURES = {
  pres: { nom: 'Au près (50°)', angle: 50 },
  travers: { nom: 'Au travers (90°)', angle: 90 },
  largue: { nom: 'Au largue (130°)', angle: 130 },
  fuite: { nom: 'En fuite (160°)', angle: 160 },
};
let allure = ALLURES[parametres.get('allure')] ? parametres.get('allure') : 'pres';

const reglage = {
  force: 0.3, // (la force des risées qu'on envoie)
  couverture: 1, // (combien il y en a : × la couverture du jeu)
  vitesse: 1, // (0 : le temps s'arrête)
};
const COUVERTURE = { couverture: REGLAGES_RISEES.couverture, couvertureOrage: REGLAGES_RISEES.couvertureOrage, molles: REGLAGES_RISEES.molles };
function couvrir(k) {
  reglage.couverture = k;
  REGLAGES_RISEES.couverture = COUVERTURE.couverture * k;
  REGLAGES_RISEES.couvertureOrage = COUVERTURE.couvertureOrage * k;
  REGLAGES_RISEES.molles = COUVERTURE.molles * k;
}

// ---------- Le bateau : il navigue tout seul ----------
const ecartAngle = (a, b) => ((a - b + 540) % 360) - 180;
function remettreLeBateau() {
  const t = MOMENTS[moment].toile;
  physique.placer(0, 0, (meteo.directionVent - ALLURES[allure].angle + 360) % 360, monde.houle);
  physique.vitesse.copy(physique.avant).multiplyScalar(3);
  physique.ris = t.ris;
  physique.deroule = t.deroule;
  risees.vider();
  historique.length = 0;
}
function simuler(dt) {
  if (reglage.vitesse === 0) return;
  const m = physique.mesures;
  const erreur = ecartAngle(Math.abs(m.angleVentReel), ALLURES[allure].angle) * Math.sign(m.angleVentReel || 1);
  const sens = physique.vitesse.dot(physique.avant) < -0.2 ? -1 : 1;
  physique.barre = sens * THREE.MathUtils.clamp(erreur * 0.025 + physique.rotation.y * 1.5, -0.55, 0.55);
  reglerAutomatiquement(physique, dt);
  const p = physique.position;
  const v = vent.maj(monde.temps, dt, meteo, 0, p.x, p.z, null);
  physique.avancer(dt, monde.houle, v, Math.max(2, Math.ceil(dt * 240)));
  suivreLaPhysique();
}
const _origine = new THREE.Vector3();
function suivreLaPhysique() {
  physique.origine(_origine);
  bateau.groupe.position.copy(_origine);
  bateau.groupe.quaternion.copy(physique.orientation);
  bateau.groupe.updateMatrixWorld();
  const m = physique.mesures;
  const r = bateau.reglage;
  const faseye = (incidence) => THREE.MathUtils.clamp((9 - incidence) / 9, 0, 1);
  r.angleBome = physique.angleBome;
  r.cote = physique.angleBome >= 0 ? 1 : -1;
  r.faseyement = faseye(m.incidenceGV);
  r.force = 1 - r.faseyement;
  r.ris = physique.ris;
  r.angleFoc = physique.angleFoc;
  r.coteFoc = physique.angleFoc >= 0 ? 1 : -1;
  r.faseyementFoc = faseye(m.incidenceFoc);
  r.deroule = Math.max(0.02, physique.deroule);
  r.angleSafran = physique.barre;
}
function eclairerBateau() {
  const nuit = monde.ecl.nuit;
  bateau.allumerFeux(nuit);
  bateau.interieur.regler({
    eclairage: nuit > 0.6 ? 'rouge' : 'eteint', feux: nuit > 0.5, ciel: monde.ecl.ambiance, eclair: monde.eclair.intensite,
    pression: 1024 - 6 * meteo.nuages - 34 * meteo.orage, heure: meteo.heure, nuit,
  });
  bateau.instruments.maj(1 / 60, physique.mesures, nuit);
}

// ---------- Le point de vue ----------
const VUES = {
  cockpit: 'Du cockpit, face au vent',
  debout: 'Debout à la barre, face au vent',
  haut: 'D\'en haut, derrière le bateau',
  avion: 'D\'avion, face au vent',
};
let vue = VUES[parametres.get('vue')] ? parametres.get('vue') : 'cockpit';
const regard = { cap: 0, site: 0 };
function directionDepuisCap(cap, site) {
  const c = THREE.MathUtils.degToRad(cap);
  const s = THREE.MathUtils.degToRad(site);
  return new THREE.Vector3(Math.sin(c) * Math.cos(s), Math.sin(s), -Math.cos(c) * Math.cos(s));
}
function placerCamera() {
  const cam = monde.camera;
  cam.up.set(0, 1, 0);
  const b = bateau.groupe;
  // (vers le vent : là d'où viennent les risées)
  const versVent = directionDepuisCap(meteo.directionVent + regard.cap, 0);
  if (vue === 'haut') {
    cam.position.copy(b.position).addScaledVector(versVent, -90);
    cam.position.y = 45 + regard.site * 2;
    cam.lookAt(b.position.x + versVent.x * 500, 0, b.position.z + versVent.z * 500);
    return;
  }
  if (vue === 'avion') {
    // à 220 m, au-dessus du bateau, on regarde vers le vent, en biais : la mer jusqu'à 1 km
    cam.position.copy(b.position).addScaledVector(versVent, -150);
    cam.position.y = 220 + regard.site * 4;
    cam.lookAt(b.position.x + versVent.x * 450, 0, b.position.z + versVent.z * 450);
    return;
  }
  // à bord, assis à la barre ou debout derrière elle : on regarde vers le vent
  cam.position.copy(Bateau.POSTES.barreur);
  if (vue === 'debout') cam.position.y += 0.85;
  cam.position.applyMatrix4(b.matrixWorld);
  cam.lookAt(cam.position.clone().add(directionDepuisCap(meteo.directionVent + regard.cap, -3 + regard.site)));
  const roulis = new THREE.Euler().setFromQuaternion(b.quaternion, 'YXZ');
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

// ---------- Ce qu'elles font ----------
const ici = {};
const historique = []; // (toutes les quarts de seconde : deux minutes)
let ageHistorique = 0;
function suivre(dt) {
  const p = physique.position;
  risees.mesurer(p.x, p.z, physique.vitesse.x, physique.vitesse.z, ici);
  if (reglage.vitesse === 0) return;
  ageHistorique += dt;
  if (ageHistorique >= 0.25) {
    ageHistorique = 0;
    const m = physique.mesures;
    historique.push({ vent: vent.vitesse, gite: Math.abs(m.gite), vitesse: m.vitesse, niveau: ici.niveau, force: ici.force });
    if (historique.length > 480) historique.shift();
  }
}

// La risée envoyée sur le bateau : elle arrive dans 40 s (on la voit venir)
function envoyer(force = reglage.force, { dans = 40, ecart = 0 } = {}) {
  const p = physique.position;
  return risees.envoyer({ x: p.x, z: p.z, vbx: physique.vitesse.x, vbz: physique.vitesse.z, dans, force, ecart });
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
const boutonsAllure = boutons('allures', ALLURES, (id) => choisirAllure(id));
const boutonsVue = boutons('vues', VUES, (id) => choisirVue(id));
let toutLeCube = true;
function choisirMoment(id) {
  moment = id;
  meteo = MOMENTS[id].meteo();
  monde.regler(meteo);
  for (const [k, b] of boutonsMoment) b.setAttribute('aria-pressed', String(k === id));
  toutLeCube = true;
  remettreLeBateau();
  legende();
}
function choisirAllure(id) {
  allure = id;
  for (const [k, b] of boutonsAllure) b.setAttribute('aria-pressed', String(k === id));
  legende();
}
function choisirVue(id) {
  vue = id;
  regard.cap = 0;
  regard.site = 0;
  for (const [k, b] of boutonsVue) b.setAttribute('aria-pressed', String(k === id));
  legende();
}
const boutonsTemps = { 0: document.getElementById('temps-pause'), 1: document.getElementById('temps-x1') };
function temps(v) {
  reglage.vitesse = v;
  for (const [k, b] of Object.entries(boutonsTemps)) b.setAttribute('aria-pressed', String(Number(k) === v));
}
for (const [k, b] of Object.entries(boutonsTemps)) b.addEventListener('click', () => temps(Number(k)));
document.getElementById('envoyer').addEventListener('click', () => envoyer());
document.getElementById('molle').addEventListener('click', () => envoyer(-0.14));
document.getElementById('visibles').addEventListener('change', (e) => { monde.eau.risees.actif = e.currentTarget.checked; });
for (const [id, format, changer] of [
  ['force', (v) => `+${Math.round(v * 100)} %`, (v) => { reglage.force = v; }],
  ['couverture', (v) => `× ${v.toFixed(1)}`, (v) => couvrir(v)],
]) {
  const champ = document.getElementById(id);
  const texte = document.getElementById(`${id}-texte`);
  texte.textContent = format(Number(champ.value));
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
  zoneLegende.textContent = `${MOMENTS[moment].nom} (${Math.round(meteo.vent)} nœuds) · ${ALLURES[allure].nom.toLowerCase()} · ${VUES[vue]}`;
}

// Les chiffres, et les courbes (quatre petites courbes, chacune son échelle)
const zoneIci = document.getElementById('ici');
const zoneCourbes = document.getElementById('courbes');
const zoneResume = document.getElementById('resume');
const pourcent = (x) => `${x >= 0 ? '+' : '−'}${Math.round(Math.abs(x) * 100)} %`;
function afficherIci() {
  const m = physique.mesures;
  const a = ici.approche;
  const lignes = [
    ['Vent', `${Math.round(vent.vitesse)} nœuds (établi ${Math.round(meteo.vent)})`],
    ['Ici', ici.force > 0.02 ? `une risée : ${pourcent(ici.force)}` : ici.force < -0.02 ? `une molle : ${pourcent(ici.force)}` : 'ni risée ni molle'],
    ['Le vent tourne de', `${ici.bascule >= 0 ? '+' : ''}${ici.bascule.toFixed(1)}°`],
    ['La prochaine', a ? `dans ${Math.round(a.dans)} s, à ${Math.round(a.distance)} m (${pourcent(a.force)})` : 'aucune en vue'],
    ['Gîte', `${Math.round(Math.abs(m.gite))}°`],
    ['Vitesse', `${m.vitesse.toFixed(1)} nœuds`],
  ];
  zoneIci.innerHTML = lignes.map(([x, y]) => `<dt>${x}</dt><dd>${y}</dd>`).join('');
  const n = risees.liste.length;
  const molles = risees.liste.filter((r) => r.force < 0).length;
  zoneResume.textContent = `${n - molles} risées et ${molles} molles dans ${(risees.rayon / 1000).toFixed(1)} km autour du bateau ; elles vont à ${Math.round(risees.vent / NOEUD)} nœuds, comme le vent.`;
  dessinerCourbes();
}
const COURBES = [
  { cle: 'vent', titre: 'Vent (nœuds)', min: null, max: null, couleur: '#e8a24a', texte: (x) => `${Math.round(x)}` },
  { cle: 'gite', titre: 'Gîte (°)', min: 0, max: null, couleur: '#6aa9e8', texte: (x) => `${Math.round(x)}°` },
  { cle: 'vitesse', titre: 'Vitesse (nœuds)', min: 0, max: null, couleur: '#c792ea', texte: (x) => x.toFixed(1) },
  { cle: 'niveau', titre: 'L\'eau froissée qu\'on entend', min: 0, max: 1, couleur: '#7fd1b9', texte: (x) => `${Math.round(x * 100)} %` },
];
function dessinerCourbes() {
  if (!historique.length) {
    zoneCourbes.innerHTML = '';
    return;
  }
  const L = 300;
  const H = 46;
  const n = historique.length;
  const x = (i) => 4 + (i / 479) * (L - 8);
  let svg = `<svg viewBox="0 0 ${L} ${COURBES.length * (H + 18)}" xmlns="http://www.w3.org/2000/svg">`;
  COURBES.forEach((c, k) => {
    const valeurs = historique.map((e) => e[c.cle]);
    const min = c.min ?? Math.floor(Math.min(...valeurs) / 5) * 5 - 5;
    let max = c.max ?? Math.ceil(Math.max(...valeurs) / 5) * 5 + 5;
    if (max - min < 1e-6) max = min + 1;
    const y0 = k * (H + 18) + 14;
    const y = (v) => y0 + H - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * H;
    const points = valeurs.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    svg += `<text class="titre" x="4" y="${y0 - 3}">${c.titre}</text>`;
    svg += `<text class="valeur" x="${L - 4}" y="${y0 - 3}" text-anchor="end">${c.texte(valeurs[n - 1])}</text>`;
    svg += `<rect class="cadre" x="0.5" y="${y0}" width="${L - 1}" height="${H}" rx="3"/>`;
    svg += `<polyline class="trait" stroke="${c.couleur}" points="${points}"/>`;
  });
  zoneCourbes.innerHTML = `${svg}</svg>`;
}

// La carte vue d'en haut : celle que lit la mer (rendu/risees.js)
const ecranCarte = document.getElementById('carte').getContext('2d');
const imageCarte = ecranCarte.createImageData(256, 256);
function dessinerCarte() {
  const rr = monde.eau.risees;
  const d = imageCarte.data;
  for (let o = 0; o < 256 * 256; o++) {
    const f = rr.plus[o] + rr.moins[o];
    // (la mer : bleu moyen ; une risée : sombre ; une molle : clair)
    const k = Math.max(-1, Math.min(1, f / 0.3));
    d[4 * o] = 40 + (k < 0 ? -k * 120 : -k * 30);
    d[4 * o + 1] = 82 + (k < 0 ? -k * 120 : -k * 62);
    d[4 * o + 2] = 110 + (k < 0 ? -k * 110 : -k * 82);
    d[4 * o + 3] = 255;
  }
  ecranCarte.putImageData(imageCarte, 0, 0);
  // le bateau, et la flèche du vent (là où il va)
  const c = rr.uniforms.uRiseesCentre.value;
  const echelle = 256 / (2 * c.z || 1);
  const bx = 128 + (physique.position.x - c.x) * echelle;
  const bz = 128 + (physique.position.z - c.y) * echelle;
  ecranCarte.fillStyle = '#ffd38a';
  ecranCarte.beginPath();
  ecranCarte.arc(bx, bz, 3.5, 0, Math.PI * 2);
  ecranCarte.fill();
  ecranCarte.strokeStyle = '#ffd38a';
  ecranCarte.lineWidth = 2;
  ecranCarte.beginPath();
  ecranCarte.moveTo(26, 26);
  ecranCarte.lineTo(26 + risees.ux * 18, 26 + risees.uz * 18);
  ecranCarte.stroke();
  ecranCarte.beginPath();
  ecranCarte.arc(26 + risees.ux * 18, 26 + risees.uz * 18, 3, 0, Math.PI * 2);
  ecranCarte.fill();
}

// ---------- Une image ----------
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
  suivre(dt);
  eclairerBateau();
  monde.image(dt, { toutLeCube, placerCamera, simuler });
  toutLeCube = false;
}

// ---------- Photos, planches, films (enregistrés dans captures/) ----------
async function envoyerCapture(nom, image) {
  const reponse = await fetch('/__capture', { method: 'POST', body: JSON.stringify({ nom, image }) });
  if (!reponse.ok) throw new Error(await reponse.text());
  return reponse.text();
}
// (l'image juste dessinée, copiée tout de suite : après une attente, elle serait noire, et
// un aperçu caché ne décode plus les images)
function copierImage() {
  const c = monde.renderer.domElement;
  const toile = document.createElement('canvas');
  toile.width = c.width;
  toile.height = c.height;
  toile.getContext('2d').drawImage(c, 0, 0);
  return toile;
}
async function photo(nom = `risees-${moment}-${vue}-${Date.now()}`, { images = 30 } = {}) {
  return enTournage(async () => {
    for (let i = 0; i < images; i++) uneImage(1 / 60);
    uneImage(1 / 60);
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

// La planche : les moments en colonnes, les points de vue en lignes. avant : les secondes
// de navigation avant chaque photo (les risées ont bougé, le bateau est lancé) ; risee :
// une risée envoyée sur le bateau, qui arrive dans tant de secondes après la photo
async function planche(nom, options) {
  return enTournage(() => plancheSansPause(nom, options));
}
async function plancheSansPause(nom, { moments = ['matin', 'apres-midi', 'coucher', 'coup-de-vent'], vues = ['cockpit', 'haut', 'avion'], largeur = 480, avant = 20, risee = 12 } = {}) {
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
  const avantTout = { moment, vue, regard: { ...regard } };
  for (const [i, m] of moments.entries()) {
    choisirMoment(m);
    // (une risée envoyée sur le bateau, pour qu'il y en ait une qui arrive sur la photo)
    if (risee !== null) envoyer(reglage.force, { dans: avant + risee });
    for (let k = 0; k < avant * 60; k++) {
      uneImage(1 / 60);
      if (k % 60 === 59) await new Promise((r) => setTimeout(r, 0));
    }
    for (const [j, v] of vues.entries()) {
      choisirVue(v);
      uneImage(1 / 60);
      uneImage(1 / 60);
      const x = i * largeur;
      const y = titre + j * hauteurCase;
      const c = monde.renderer.domElement;
      const ratio = c.width / c.height;
      let sl = c.width;
      let sh = c.height;
      if (ratio > 16 / 9) sl = sh * (16 / 9); else sh = sl / (16 / 9);
      ctx.drawImage(c, (c.width - sl) / 2, (c.height - sh) / 2, sl, sh, x, y, largeur, hauteurCase);
      if (i === 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = '14px system-ui, sans-serif';
        ctx.fillRect(x, y + hauteurCase - 24, Math.min(largeur, ctx.measureText(VUES[v]).width + 20), 24);
        ctx.fillStyle = '#fff';
        ctx.fillText(VUES[v], x + 10, y + hauteurCase - 7);
        ctx.font = '600 16px system-ui, sans-serif';
        ctx.fillStyle = '#e6eef0';
      }
    }
  }
  choisirMoment(avantTout.moment);
  choisirVue(avantTout.vue);
  Object.assign(regard, avantTout.regard);
  return envoyerCapture(nom, toile.toDataURL('image/jpeg', 0.9));
}

// Le film : des images enregistrées une à une (captures/film-<nom>-0001.jpg…), à assembler
// avec : node scripts/film.mjs <nom>. risee : une risée envoyée sur le bateau, qui arrive
// tant de secondes après le début du film
async function film(nom, options) {
  return enTournage(() => filmSansPause(nom, options));
}
async function filmSansPause(nom, { secondes = 10, ips = 30, risee = null, accelere = 1 } = {}) {
  if (risee !== null) envoyer(reglage.force, { dans: risee });
  const n = Math.round(secondes * ips);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < accelere; k++) uneImage(1 / ips);
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
    ['Dessiner la carte', `${monde.eau.risees.ms.toFixed(2)} ms (dix fois par seconde)`],
  ];
  for (const [k, v] of Object.entries(mesuresGpu)) lignes.push([k, v]);
  zoneMesures.innerHTML = lignes.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
}
// Le banc d'essai d'images entières, avec et sans les risées dessinées sur la mer, en
// alternance (on garde le meilleur de chaque série ; on attend la carte graphique en
// lisant un pixel). Rend des ms par image.
function couts({ series = 4, images = 8 } = {}) {
  const gl = monde.renderer.getContext();
  const px = new Uint8Array(4);
  const attendre = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const avantVitesse = reglage.vitesse;
  reglage.vitesse = 0;
  const actif = monde.eau.risees.actif;
  const serie = (avec) => {
    monde.eau.risees.actif = avec;
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
  monde.eau.risees.actif = actif;
  reglage.vitesse = avantVitesse;
  const mieux = (l) => Math.round(Math.min(...l) * 100) / 100;
  const r = { avec: mieux(avec), sans: mieux(sans), risees: Math.round((mieux(avec) - mieux(sans)) * 100) / 100 };
  mesuresGpu['Une image, avec les risées'] = `${r.avec} ms`;
  mesuresGpu['Une image, sans elles'] = `${r.sans} ms`;
  afficherMesures();
  return r;
}
document.getElementById('mesurer').addEventListener('click', async (e) => {
  e.currentTarget.disabled = true;
  zoneEtat.textContent = 'Mesure en cours…';
  await new Promise((r) => setTimeout(r, 50));
  try {
    const r = couts();
    zoneEtat.textContent = `Les risées coûtent ${r.risees} ms par image (meilleur de 4 séries de 8 images).`;
  } finally {
    e.currentTarget.disabled = false;
  }
});

// Les rafales vues du bateau, sur une longue durée (sans dessiner : la physique seule) :
// la part du temps dans une risée, combien par minute, combien de temps chacune, et
// combien de secondes on l'a vue venir (sa distance quand elle était encore à 30 s)
function statistiques({ minutes = 10, pas = 1 / 30 } = {}) {
  const avantVitesse = reglage.vitesse;
  reglage.vitesse = 1;
  let dedans = 0;
  let n = 0;
  let enCours = false;
  let rafales = 0;
  const vues = [];
  const p = physique.position;
  for (let t = 0; t < minutes * 60; t += pas) {
    simuler(pas);
    risees.mesurer(p.x, p.z, physique.vitesse.x, physique.vitesse.z, ici);
    const a = ici.approche;
    if (a && a.dans < 30 && a.dans > 29.9 - pas) vues.push(a.distance);
    if (ici.force > 0.06) {
      dedans++;
      if (!enCours) rafales++;
      enCours = true;
    } else enCours = false;
    n++;
  }
  reglage.vitesse = avantVitesse;
  return {
    'temps dans une risée (%)': Math.round((100 * dedans) / n),
    'risées par minute': Math.round((rafales / minutes) * 100) / 100,
    'à 30 s, elles étaient à (m)': vues.length ? Math.round(vues.reduce((x, y) => x + y, 0) / vues.length) : null,
  };
}

window.__risees = {
  monde, vent, risees, physique, reglage, regard, ici, historique,
  moment: choisirMoment, vue: choisirVue, allure: choisirAllure, temps, couvrir,
  envoyer, photo, planche, film, couts, statistiques, uneImage,
  // (redessiner le panneau tout de suite : quand l'onglet est caché, sa boucle s'arrête)
  panneau() { afficherMesures(); afficherIci(); legende(); dessinerCarte(); },
};

// ---------- La boucle ----------
choisirMoment(moment);
choisirAllure(allure);
choisirVue(vue);
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
    dessinerCarte();
    ageMesures = 0;
  }
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);
