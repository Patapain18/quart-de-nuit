// Atelier des feux : les feux de la côte de Kervalen (monde/feux.js, rendu/feux.js). Le phare de
// la pointe du Bec et ses trois faisceaux qui balaient la nuit, la bouée de la Basse du Bec, les
// deux feux de l'entrée de Port-Kervalen, la fenêtre du sémaphore ; ce qu'on en voit d'où l'on
// est (la distance, la brume, la pluie d'un grain entre eux et nous, les vagues devant) ; leurs
// éclats des vingt dernières secondes ; le livre des feux.
//
// Adresse : atelier-feux.html?heure=21.5&vue=depart
// Dans la console : __feux (voir en bas : heure, vue, grain, photo, planche, film, mesurer).
import * as THREE from 'three';
import { Monde3D } from './rendu/monde3d.js';
import { meteoDeLaNuit } from './jeu/nuit.js';
import { heureEnTexte } from './jeu/journee.js';
import { Bateau } from './bateau/bateau.js';
import { Grains } from './monde/grains.js';
import { FEUX, SEMAPHORE, COULEURS, MILLE, rythme } from './monde/feux.js';
import { LIEUX } from './rendu/cote.js';
import { pageDesFeux, SIGNES } from './jeu/livre-des-feux.js';
import { REGLAGES_FEUX } from './rendu/feux.js';

const parametres = new URLSearchParams(location.search);
const canvas = document.getElementById('scene');
const monde = new Monde3D(canvas);
const bateau = monde.ajouterBateau();
const grains = new Grains(9);
grains.peuple = true;
grains.attente = 1e9;
monde.etatGrains = grains;
const lisse = THREE.MathUtils.smoothstep;
const phare = FEUX.find((f) => f.id === 'phare');

// ---------- L'heure et le temps ----------
const reglage = {
  heure: Math.min(30.6, Math.max(18.4, Number(parametres.get('heure') ?? 21.5))),
  brume: parametres.has('brume'),
  merPlate: parametres.has('merPlate'),
  grain: parametres.has('grain'),
};
function meteoA(h) {
  const m = meteoDeLaNuit(h);
  if (reglage.brume) m.brume = Math.min(1, m.brume + 0.4);
  if (reglage.merPlate) Object.assign(m, { vent: 4, houle: { hs: 0.2, periode: 8, direction: 250 } });
  return m;
}
let meteo = meteoA(reglage.heure);
const MOMENTS = {
  18.75: 'Le coucher',
  19.4: 'Le crépuscule',
  21: '21 h',
  23.5: 'La tempête',
  26: '2 h',
  28.6: 'L\'accalmie',
  29.8: 'L\'aube',
};

// ---------- D'où on les voit ----------
// (bateau : le bateau est là, on regarde depuis la barre ; sinon, une caméra libre)
const entree = { x: (LIEUX.jetee.musoir.x + LIEUX.roche.x) / 2, z: (LIEUX.jetee.musoir.z + LIEUX.roche.z) / 2 };
const VUES = {
  depart: { nom: 'Au départ de la nuit (5 milles)', bateau: { x: 1500, z: 7000 }, cible: () => phare },
  large: { nom: 'À deux milles du phare', bateau: { x: 900, z: 800 }, cible: () => phare },
  entree: { nom: 'Devant l\'entrée du port', bateau: { x: entree.x + 60, z: entree.z + 1100 }, cible: () => ({ x: entree.x, y: 6, z: entree.z }) },
  bouee: { nom: 'Près de la Basse du Bec', bateau: { x: LIEUX.basse.x + 260, z: LIEUX.basse.z + 330 }, cible: () => ({ x: LIEUX.basse.x, y: 3, z: LIEUX.basse.z }) },
  cote: { nom: 'De côté, à trois kilomètres', camera: { x: phare.x + 2500, y: 14, z: phare.z + 1700 }, cible: () => ({ x: phare.x, y: phare.y + 120, z: phare.z }) },
  haut: { nom: 'D\'en haut', camera: { x: phare.x + 900, y: 260, z: phare.z + 4200 }, cible: () => phare },
};
let vue = VUES[parametres.get('vue')] ? parametres.get('vue') : 'depart';
const regard = { cap: 0, site: 0 };
function placerBateau() {
  const v = VUES[vue];
  const p = v.bateau ?? VUES.depart.bateau;
  bateau.groupe.position.set(p.x, 0, p.z);
  // (le bateau au largue, l'étrave à 60° de la cible : on la voit par-dessus le pont)
  const c = v.cible();
  const versCible = THREE.MathUtils.radToDeg(Math.atan2(c.x - p.x, -(c.z - p.z)));
  bateau.cap = (versCible - 60 + 360) % 360;
  Object.assign(bateau.reglage, { ris: 2, deroule: 0.3, cote: -1, coteFoc: -1, angleBome: -0.6, angleFoc: -0.4, faseyement: 0, faseyementFoc: 0, force: 0.5 });
  bateau.gite = -0.08;
}
const _c = new THREE.Vector3();
function placerCamera() {
  const cam = monde.camera;
  const v = VUES[vue];
  if (v.camera) cam.position.set(v.camera.x, v.camera.y, v.camera.z);
  else cam.position.copy(Bateau.POSTES.barreur).applyMatrix4(bateau.groupe.matrixWorld);
  const c = v.cible();
  const cap = Math.atan2(c.x - cam.position.x, -(c.z - cam.position.z)) + THREE.MathUtils.degToRad(regard.cap);
  const d = Math.hypot(c.x - cam.position.x, c.z - cam.position.z);
  const site = Math.atan2((c.y ?? 0) - cam.position.y, d) + THREE.MathUtils.degToRad(regard.site);
  cam.lookAt(_c.set(cam.position.x + Math.sin(cap) * Math.cos(site), cam.position.y + Math.sin(site), cam.position.z - Math.cos(cap) * Math.cos(site)));
}
let glisse = null;
canvas.addEventListener('pointerdown', (e) => {
  glisse = { x: e.clientX, y: e.clientY, cap: regard.cap, site: regard.site };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!glisse) return;
  const s = monde.camera.fov / canvas.clientHeight;
  regard.cap = glisse.cap - (e.clientX - glisse.x) * s;
  regard.site = THREE.MathUtils.clamp(glisse.site + (e.clientY - glisse.y) * s, -60, 80);
});
canvas.addEventListener('pointerup', () => { glisse = null; });

// ---------- Un grain entre nous et le phare ----------
function placerGrain() {
  grains.vider();
  grains.peuple = true;
  grains.attente = 1e9;
  grains.meteo = meteo;
  if (!reglage.grain) return;
  const o = VUES[vue].bateau ?? VUES[vue].camera;
  const f = 0.5;
  grains.creer({ x: o.x + (phare.x - o.x) * f, z: o.z + (phare.z - o.z) * f, rayon: 900, force: 0.85, orage: 0.4, duree: 1e9, age: 400, prevu: true });
}

// ---------- Une image ----------
let toutLeCube = true;
let tournage = 0;
let horloge = performance.now();
async function enTournage(f) {
  tournage++;
  try {
    return await f();
  } finally {
    tournage--;
    horloge = performance.now();
  }
}
const historique = new Map([...FEUX, SEMAPHORE].map((f) => [f.id, []]));
let ageHistorique = 0;
function uneImage(dt) {
  grains.meteo = meteo;
  const nuit = monde.ecl.nuit;
  bateau.allumerFeux(nuit);
  bateau.interieur.regler({ eclairage: nuit > 0.6 ? 'rouge' : 'eteint', feux: nuit > 0.5, ciel: monde.ecl.ambiance, eclair: monde.eclair.intensite, heure: reglage.heure % 24, nuit });
  monde.image(dt, { toutLeCube, placerCamera });
  toutLeCube = false;
  // (l'historique : ce qui arrive de chaque feu, trente fois par seconde)
  ageHistorique += dt;
  if (ageHistorique >= 1 / 30) {
    ageHistorique = 0;
    for (const v of monde.feux.vus) {
      const h = historique.get(v.feu.id);
      h.push({ t: monde.temps, recu: v.recu, cache: v.cache });
      while (h.length && h[0].t < monde.temps - 20) h.shift();
    }
  }
}
function changerHeure(h) {
  reglage.heure = Math.min(30.6, Math.max(18.4, h));
  meteo = meteoA(reglage.heure);
  monde.regler(meteo);
  toutLeCube = true;
  placerGrain();
  document.getElementById('heure').value = String(reglage.heure);
  document.getElementById('heure-texte').textContent = heureEnTexte(reglage.heure);
  legende();
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
boutons('moments', MOMENTS, (h) => changerHeure(Number(h)));
const boutonsVue = boutons('vues', VUES, (id) => choisirVue(id));
function choisirVue(id) {
  vue = id;
  regard.cap = 0;
  regard.site = 0;
  for (const [k, b] of boutonsVue) b.setAttribute('aria-pressed', String(k === id));
  placerBateau();
  placerGrain();
  for (const h of historique.values()) h.length = 0;
  legende();
}
function bascule(id, cle, apres) {
  const b = document.getElementById(id);
  b.setAttribute('aria-pressed', String(reglage[cle]));
  b.addEventListener('click', () => {
    reglage[cle] = !reglage[cle];
    b.setAttribute('aria-pressed', String(reglage[cle]));
    apres();
  });
}
bascule('grain', 'grain', () => placerGrain());
bascule('brume', 'brume', () => changerHeure(reglage.heure));
bascule('mer-plate', 'merPlate', () => changerHeure(reglage.heure));
document.getElementById('heure').addEventListener('input', (e) => changerHeure(Number(e.currentTarget.value)));
const panneau = document.getElementById('panneau');
document.getElementById('replier').addEventListener('click', (e) => {
  const replie = panneau.classList.toggle('replie');
  e.currentTarget.setAttribute('aria-expanded', String(!replie));
  e.currentTarget.textContent = replie ? 'Déplier' : 'Replier';
});
if (parametres.has('replie')) panneau.classList.add('replie');
const zoneLegende = document.getElementById('legende');
function legende() {
  zoneLegende.textContent = `${heureEnTexte(reglage.heure)} · ${VUES[vue].nom}${reglage.grain ? ' · un grain sur la ligne' : ''}${reglage.brume ? ' · brume' : ''}`;
}

// le livre des feux
const { entrees, carte } = pageDesFeux();
document.getElementById('livre').innerHTML = `${carte}<p class="signes">${SIGNES.map(([a, b]) => `<b>${a}</b> ${b}`).join(' · ')}</p>${entrees}`;

// Ce qu'on voit de chaque feu, d'ici
const css = (c) => `rgb(${c.map((v) => Math.round(255 * Math.min(1, v) ** (1 / 2.2))).join(',')})`;
// (pic : la lumière reçue au plus fort de son dernier éclat ; entre deux éclats, il ne nous
// arrive rien, mais le feu n'en est pas moins visible)
function etatDuFeu(v, pic) {
  if (v.eclat === 0 && monde.ecl.hauteurSoleil > 0.035) return 'éteint (le jour)';
  if (v.horizon) return 'sous l\'horizon';
  if (v.transmission < 0.002) return 'perdu dans la pluie';
  if (v.cache > 0.9) return 'caché par une vague';
  if (pic < 1) return 'trop faible';
  return v.eclat < 0.05 ? 'entre deux éclats' : 'visible';
}
const tableVus = document.getElementById('vus');
const zoneEclats = document.getElementById('eclats');
function afficherVus() {
  const vus = monde.feux.vus;
  const lignes = vus.map((v) => {
    const h = historique.get(v.feu.id);
    const cache = h.length ? Math.round((100 * h.filter((x) => x.cache > 0.5).length) / h.length) : 0;
    // (au plus fort de la dernière période : son dernier éclat)
    const depuis = monde.temps - rythme(v.feu).periode - 0.2;
    const pic = h.reduce((m, x) => (x.t >= depuis ? Math.max(m, x.recu) : m), v.recu);
    return `<tr><td><span class="pastille" style="background:${css(COULEURS[v.feu.couleur])}"></span>${v.feu.caractere ?? 'fixe'}</td>`
      + `<td class="nombre">${(v.distance / MILLE).toFixed(1).replace('.', ',')} M</td>`
      + `<td class="nombre">${pic >= 10 ? Math.round(pic) : pic.toFixed(1).replace('.', ',')}</td>`
      + `<td class="nombre">${Math.round(v.transmission * 100)} %</td>`
      + `<td class="nombre">${cache} %</td><td>${etatDuFeu(v, pic)}</td></tr>`;
  });
  tableVus.innerHTML = `<tr><th>Feu</th><th>Distance</th><th>Reçu</th><th>Air</th><th>Vagues</th><th></th></tr>${lignes.join('')}`;
  // les éclats des vingt dernières secondes (échelle logarithmique : de 1 à 10 000 fois le seuil)
  const L = 300;
  const H = 22;
  let svg = `<svg viewBox="0 0 ${L} ${vus.length * (H + 6)}" xmlns="http://www.w3.org/2000/svg">`;
  vus.forEach((v, k) => {
    const y0 = k * (H + 6);
    const h = historique.get(v.feu.id);
    svg += `<rect x="0" y="${y0}" width="${L}" height="${H}" rx="2" fill="#0d141a"/>`;
    if (h.length > 1) {
      const t1 = h.at(-1).t;
      const pts = h.map((p) => `${(L - ((t1 - p.t) / 20) * L).toFixed(1)},${(y0 + H - Math.min(1, Math.log10(1 + p.recu) / 4) * (H - 2)).toFixed(1)}`).join(' ');
      svg += `<polyline points="${pts}" fill="none" stroke="${css(COULEURS[v.feu.couleur])}" stroke-width="1.2"/>`;
    }
    svg += `<text class="nom" x="4" y="${y0 + 10}">${v.feu.nom}</text>`;
  });
  zoneEclats.innerHTML = `${svg}</svg>`;
}

// ---------- Mesures, photos, planches, films (enregistrés dans captures/) ----------
// (ce que coûte le calcul de ce qu'on voit des feux, par image : µs)
function mesurer(n = 200) {
  const f = monde.feux;
  const opts = { temps: monde.temps, camera: monde.camera, meteo, grains, hauteurSoleil: monde.ecl.hauteurSoleil };
  const t0 = performance.now();
  for (let i = 0; i < n; i++) f.maj(0, opts);
  return Math.round(((performance.now() - t0) / n) * 1000);
}
function afficherMesures() {
  const m = monde.mesures;
  document.getElementById('mesures').innerHTML = [
    ['Images par seconde', m.ips.toFixed(0)],
    ['Une image (processeur)', `${m.imageMs.toFixed(1)} ms`],
  ].map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('');
}
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
// (eclat : on attend qu'un faisceau du phare nous balaie, et qu'aucune vague ne le cache)
async function attendreEclat(max = 16) {
  for (let i = 0; i < max * 60; i++) {
    const v = monde.feux.vus.find((x) => x.feu.id === 'phare');
    if (v && v.eclat > 0.7 && v.cache < 0.1) return true;
    uneImage(1 / 60);
    if (i % 20 === 19) await new Promise((r) => setTimeout(r, 0));
  }
  return false;
}
async function photo(nom = `feux-${vue}-${Date.now()}`, { images = 40, eclat = false } = {}) {
  return enTournage(async () => {
    for (let i = 0; i < images; i++) {
      uneImage(1 / 60);
      if (i % 20 === 19) await new Promise((r) => setTimeout(r, 0));
    }
    if (eclat) await attendreEclat();
    // (une image de plus juste avant de copier : après une attente, la toile est vide)
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

// La planche : des cases [{ titre, heure, vue, grain, brume, cap, site, attendre (s : on laisse
// tourner le phare), eclat (true : on attend qu'un faisceau nous balaie) }]
async function planche(nom, options) {
  return enTournage(() => plancheSansPause(nom, options));
}
async function plancheSansPause(nom, { cases, colonnes = 2, largeur = 640, images = 40 } = {}) {
  const hauteurCase = Math.round((largeur * 9) / 16);
  const toile = document.createElement('canvas');
  toile.width = largeur * colonnes;
  toile.height = hauteurCase * Math.ceil(cases.length / colonnes);
  const ctx = toile.getContext('2d');
  const avant = { heure: reglage.heure, vue, grain: reglage.grain, brume: reglage.brume, regard: { ...regard } };
  for (const [k, c] of cases.entries()) {
    reglage.grain = !!c.grain;
    reglage.brume = !!c.brume;
    if (c.vue && c.vue !== vue) choisirVue(c.vue);
    changerHeure(c.heure ?? reglage.heure);
    regard.cap = c.cap ?? 0;
    regard.site = c.site ?? 0;
    const n = images + Math.round((c.attendre ?? 0) * 60);
    for (let i = 0; i < n; i++) {
      uneImage(1 / 60);
      if (i % 20 === 19) await new Promise((r) => setTimeout(r, 0));
    }
    if (c.eclat) await attendreEclat();
    uneImage(1 / 60);
    const image = copierImage();
    const x = (k % colonnes) * largeur;
    const y = Math.floor(k / colonnes) * hauteurCase;
    let sl = image.width;
    let sh = image.height;
    if (sl / sh > 16 / 9) sl = sh * (16 / 9); else sh = sl / (16 / 9);
    ctx.drawImage(image, (image.width - sl) / 2, (image.height - sh) / 2, sl, sh, x, y, largeur, hauteurCase);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y + hauteurCase - 26, Math.min(largeur, ctx.measureText(c.titre).width + 20), 26);
    ctx.fillStyle = '#fff';
    ctx.fillText(c.titre, x + 10, y + hauteurCase - 8);
  }
  reglage.grain = avant.grain;
  reglage.brume = avant.brume;
  choisirVue(avant.vue);
  changerHeure(avant.heure);
  Object.assign(regard, avant.regard);
  return envoyerCapture(nom, toile.toDataURL('image/jpeg', 0.9));
}

// Le film : des images enregistrées une à une (captures/film-<nom>-0001.jpg…), à assembler
// avec : node scripts/film.mjs <nom>
async function film(nom, { secondes = 8, ips = 30, avant = 40 } = {}) {
  return enTournage(async () => {
    for (let i = 0; i < avant; i++) uneImage(1 / 60);
    const n = Math.round(secondes * ips);
    for (let i = 0; i < n; i++) {
      uneImage(1 / ips);
      await envoyerCapture(`film-${nom}-${String(i + 1).padStart(4, '0')}`, copierImage().toDataURL('image/jpeg', 0.88));
    }
    return n;
  });
}

window.__feux = {
  monde, bateau, grains, reglage, regard, historique, uneImage, mesurer, photo, planche, film, reglages: REGLAGES_FEUX,
  heure: changerHeure, vue: choisirVue,
  grain: (oui) => { reglage.grain = oui; document.getElementById('grain').setAttribute('aria-pressed', String(oui)); placerGrain(); },
  get vus() { return monde.feux.vus; },
};

// ---------- La boucle ----------
choisirVue(vue);
changerHeure(reglage.heure);
let ageAffichage = 0;
function boucle(maintenant) {
  const dt = Math.min((maintenant - horloge) / 1000, 0.05);
  horloge = maintenant;
  if (!tournage) uneImage(dt);
  ageAffichage += dt;
  if (ageAffichage > 0.25) {
    ageAffichage = 0;
    afficherVus();
    afficherMesures();
  }
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);
