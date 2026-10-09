// L'électronique de la timonerie, sur le pupitre de la console (à côté de l'écran du radar) :
//  - le traceur de cartes : la carte électronique, le nord en haut, centrée sur le bateau ;
//    la côte de Kervalen et l'île Brune, ses feux (une goutte magenta et leur signature,
//    comme sur les cartes : monde/feux.js), le trajet parcouru, les bouées, la ligne du cap ;
//    en bas, la vitesse et la route sur le fond, et la sonde (la profondeur sous la quille) ;
//  - la commande du pilote automatique : son mode (veille, auto, ALARME), le cap voulu, le
//    cap suivi, et l'angle de la barre ;
//  - deux répétiteurs des afficheurs du cockpit (la vitesse et le cap, le vent apparent) : la
//    même image, sur la cloison de la console.
import * as THREE from 'three';
import { rivage, COTE, distanceALaTerre } from '../rendu/cote.js';
import { FEUX } from '../monde/feux.js';
import { poserSurPupitre, surPlafonnier } from './interieur-timonerie.js';

const MILLE = 1852;
const _qRose = new THREE.Quaternion();
const _axeZ = new THREE.Vector3(0, 0, 1);

function ecran(largeur, hauteur) {
  const canvas = document.createElement('canvas');
  canvas.width = largeur;
  canvas.height = hauteur;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, ctx: canvas.getContext('2d'), texture };
}

// Un écran posé sur le pupitre : un boîtier noir et la dalle lumineuse
function poserEcran(groupe, noir, e, largeur, hauteur, x, t) {
  const g = new THREE.Group();
  const boitier = new THREE.Mesh(new THREE.BoxGeometry(largeur + 0.03, hauteur + 0.03, 0.035), noir);
  const materiau = new THREE.MeshStandardMaterial({
    color: 0x000000, roughness: 0.15, metalness: 0, emissive: 0xffffff, emissiveMap: e.texture, emissiveIntensity: 1,
  });
  const dalle = new THREE.Mesh(new THREE.PlaneGeometry(largeur, hauteur), materiau);
  dalle.position.z = 0.0178;
  g.add(boitier, dalle);
  poserSurPupitre(g, x, t, 0.018);
  groupe.add(g);
  return { groupe: g, materiau };
}

// La profondeur sous la quille (m) : le fond remonte vers la côte (60 à 90 m au large)
export function sonde(x, z) {
  const d = distanceALaTerre(x, z);
  if (!Number.isFinite(d)) return 88;
  return Math.max(2.5, Math.min(92, 6 + d * 0.028 + 8 * Math.sin(x / 700) * Math.sin(z / 900)));
}

export class Electronique {
  // bateau : pour les matériaux ; interieur : son groupe (le pupitre est dedans) ;
  // instruments : leurs textures (les répétiteurs montrent la même image)
  constructor(bateau, interieur, instruments) {
    const noir = bateau.materiaux.noir;
    const groupe = interieur.groupe;
    this.traceur = ecran(512, 384);
    this.pilote = ecran(256, 128);
    const tr = poserEcran(groupe, noir, this.traceur, 0.2, 0.15, 0.37, 0.62);
    const pi = poserEcran(groupe, noir, this.pilote, 0.11, 0.055, 0.08, 0.14);
    this.materiaux = [tr.materiau, pi.materiau];
    this.positionTraceur = tr.groupe.position.clone();
    this.positionPilote = pi.groupe.position.clone();
    // les répétiteurs : sur la console du plafond, côte à côte
    for (const [k, x] of [[0, 0.1], [1, 0.3]]) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.03), noir));
      const dalle = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.13), instruments.materiauxEcrans[k]);
      dalle.position.z = 0.0155;
      g.add(dalle);
      const { position, quaternion } = surPlafonnier(x, 0.016);
      g.position.copy(position);
      g.quaternion.copy(quaternion);
      groupe.add(g);
    }
    // le compas du pupitre : sa rose (la même que celle du cockpit) tourne avec le cap
    this.rose = new THREE.Mesh(new THREE.CircleGeometry(0.047, 40), instruments.rose.material);
    poserSurPupitre(this.rose, 0.45, 0.17, 0.03);
    this.roseQuaternion = this.rose.quaternion.clone();
    groupe.add(this.rose);
    this.trajet = []; // les positions passées (une toutes les 10 s)
    this.age = 1;
    this.ageTrajet = 0;
    this.milles = 3; // le rayon de la carte
    this.clignote = 0;
  }

  // dt ; etat : { x, z, cap, vitesse (nds), route (degrés, sur le fond), pilote (null : en
  // veille, ou le cap voulu), panne (le pilote a lâché), barre (-1 → 1), bouees : [{x, z}],
  // nuit (0 → 1), baro : { p (hPa), dp (hPa en trois heures, ou null), historique : [{ heure,
  // p }], heure } ou null }
  maj(dt, etat) {
    // (la rose garde le nord : elle tourne dans l'autre sens que le bateau)
    this.rose.quaternion.copy(this.roseQuaternion).multiply(_qRose.setFromAxisAngle(_axeZ, (etat.cap * Math.PI) / 180));
    this.age += dt;
    this.clignote += dt;
    this.ageTrajet += dt;
    if (this.ageTrajet > 10 || !this.trajet.length) {
      this.ageTrajet = 0;
      const dernier = this.trajet.at(-1);
      // (un saut de plus d'un mille : le bateau a été replacé, on efface)
      if (dernier && Math.hypot(dernier.x - etat.x, dernier.z - etat.z) > MILLE) this.trajet.length = 0;
      this.trajet.push({ x: etat.x, z: etat.z });
      if (this.trajet.length > 360) this.trajet.shift();
    }
    // (l'éclat des écrans : plus faible la nuit ; il hésite quand le courant hésite)
    for (const m of this.materiaux) m.emissiveIntensity = (1 - 0.78 * etat.nuit) * (etat.vacille ?? 1);
    if (this.age < 0.25) return;
    this.age = 0;
    this.dessinerTraceur(etat);
    this.dessinerPilote(etat);
  }

  dessinerTraceur(e) {
    const { ctx, canvas, texture } = this.traceur;
    const L = canvas.width;
    const H = canvas.height;
    const bas = 64; // la bande des données
    const hc = H - bas;
    const echelle = (hc / 2) / (this.milles * MILLE); // pixels par mètre
    const cx = L / 2;
    const cy = hc / 2;
    const px = (x) => cx + (x - e.x) * echelle;
    const py = (z) => cy + (z - e.z) * echelle; // (nord en haut : z plus petit = plus haut)
    // la mer, d'un bleu qui fonce vers le large
    ctx.fillStyle = '#0b2338';
    ctx.fillRect(0, 0, L, H);
    // la terre : on remplit au-dessus du rivage
    const pas = 6;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    for (let sx = 0; sx <= L; sx += pas) {
      const x = e.x + (sx - cx) / echelle;
      const z = x > COTE.xOuest && x < COTE.xEst ? rivage(x) : -1e6;
      ctx.lineTo(sx, Math.max(-10, py(z)));
    }
    ctx.lineTo(L, -10);
    ctx.closePath();
    // (les petits fonds : une bande plus claire le long de la côte)
    ctx.strokeStyle = '#1d4a68';
    ctx.lineWidth = 26;
    ctx.stroke();
    ctx.fillStyle = '#c9a65a';
    ctx.fill();
    ctx.strokeStyle = '#6b5326';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // l'île Brune
    const { x: ix, z: iz, rayon } = COTE.ile;
    ctx.beginPath();
    ctx.arc(px(ix), py(iz), rayon * echelle, 0, Math.PI * 2);
    ctx.fillStyle = '#c9a65a';
    ctx.fill();
    ctx.stroke();
    // le quadrillage : un mille
    ctx.strokeStyle = 'rgba(160, 200, 230, 0.12)';
    ctx.lineWidth = 1;
    const m = MILLE * echelle;
    for (let gx = ((cx - e.x * echelle) % m + m) % m; gx < L; gx += m) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, hc); ctx.stroke();
    }
    for (let gy = ((cy - e.z * echelle) % m + m) % m; gy < hc; gy += m) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(L, gy); ctx.stroke();
    }
    // les feux de la côte : la goutte magenta des cartes, et leur signature (quand elle a la
    // place : à petite échelle, les feux du port se touchent presque)
    ctx.font = '600 11px ui-monospace, Menlo, monospace';
    const etiquettes = [];
    for (const f of FEUX) {
      const x = px(f.x);
      const y = py(f.z);
      if (x < -40 || x > L + 40 || y < -20 || y > hc + 20) continue;
      ctx.fillStyle = 'rgba(222, 70, 170, 0.85)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 10, y - 8);
      ctx.arc(x + 7, y - 11, 4, 0.8, 0.8 + Math.PI * 1.6, true);
      ctx.closePath();
      ctx.fill();
      const l = ctx.measureText(f.caractere).width;
      const r = [x + 14, y - 7, x + 14 + l, y + 6];
      if (etiquettes.some((e) => r[0] < e[2] && r[2] > e[0] && r[1] < e[3] && r[3] > e[1])) continue;
      etiquettes.push(r);
      ctx.fillStyle = '#f0c8e4';
      ctx.fillText(f.caractere, x + 14, y + 4);
    }
    // les bouées
    for (const b of e.bouees ?? []) {
      ctx.fillStyle = b.couleur ?? '#ffcc33';
      ctx.beginPath();
      ctx.arc(px(b.x), py(b.z), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // le trajet parcouru
    if (this.trajet.length > 1) {
      ctx.strokeStyle = '#e6e04a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      this.trajet.forEach((p, k) => (k ? ctx.lineTo(px(p.x), py(p.z)) : ctx.moveTo(px(p.x), py(p.z))));
      ctx.lineTo(cx, cy);
      ctx.stroke();
    }
    // le bateau : un triangle, et la ligne de son cap (6 minutes de route)
    const a = (e.cap * Math.PI) / 180;
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    ctx.strokeStyle = '#ff5b4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx * (e.vitesse * 0.5144 * 360 * echelle + 18), cy + dy * (e.vitesse * 0.5144 * 360 * echelle + 18));
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx + dx * 11, cy + dy * 11);
    ctx.lineTo(cx - dx * 6 - dy * 6, cy - dy * 6 + dx * 6);
    ctx.lineTo(cx - dx * 6 + dy * 6, cy - dy * 6 - dx * 6);
    ctx.closePath();
    ctx.fill();
    // la bande des données
    ctx.fillStyle = '#05080b';
    ctx.fillRect(0, hc, L, bas);
    ctx.fillStyle = '#9fd3ff';
    ctx.font = '600 15px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('VITESSE', 14, hc + 22);
    ctx.fillText('ROUTE FOND', 134, hc + 22);
    ctx.fillText('SONDE', 262, hc + 22);
    if (e.baro) ctx.fillText(e.baro.dp === null ? 'BARO' : `BARO ${e.baro.dp >= 0 ? '+' : '−'}${Math.abs(e.baro.dp).toFixed(1)}/3h`, 378, hc + 22);
    ctx.font = '700 26px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${e.vitesse.toFixed(1)} nd`, 14, hc + 52);
    ctx.fillText(`${String(Math.round(e.route) % 360).padStart(3, '0')}°`, 134, hc + 52);
    const p = e.sonde ?? sonde(e.x, e.z);
    ctx.fillStyle = p < 10 ? '#ff6b5b' : '#ffffff';
    ctx.fillText(`${p.toFixed(1)} m`, 262, hc + 52);
    if (e.baro) {
      // (en baisse rapide : en orange, comme une alarme douce)
      ctx.fillStyle = e.baro.dp !== null && e.baro.dp <= -3.6 ? '#ffb05a' : '#ffffff';
      ctx.fillText(`${Math.round(e.baro.p)}`, 378, hc + 52);
      this.dessinerBarographe(ctx, e.baro, L);
    }
    // l'échelle, en haut à gauche
    ctx.fillStyle = 'rgba(5, 8, 11, 0.7)';
    ctx.fillRect(8, 8, 104, 24);
    ctx.fillStyle = '#9fd3ff';
    ctx.font = '600 14px ui-monospace, Menlo, monospace';
    ctx.fillText(`${this.milles} mn · N↑`, 16, 25);
    texture.needsUpdate = true;
  }

  // Le barographe : la courbe de la pression des douze dernières heures, dans un coin de la
  // carte (on y voit la baisse qui s'accélère, le fond quand le front passe, les bonds des
  // grains, la remontée)
  dessinerBarographe(ctx, baro, L) {
    const points = baro.historique.filter((x) => baro.heure === null || x.heure > baro.heure - 12);
    const l = 150;
    const h = 64;
    const x0 = L - l - 8;
    const y0 = 8;
    ctx.fillStyle = 'rgba(5, 8, 11, 0.72)';
    ctx.fillRect(x0, y0, l, h);
    ctx.fillStyle = '#9fd3ff';
    ctx.font = '600 12px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('BARO 12 h', x0 + 6, y0 + 14);
    if (points.length < 2) return;
    let min = Infinity;
    let max = -Infinity;
    for (const x of points) {
      min = Math.min(min, x.p);
      max = Math.max(max, x.p);
    }
    // (au moins 6 hPa de haut : un trait plat ne dit rien)
    const milieu = (min + max) / 2;
    const demi = Math.max(3, (max - min) / 2 + 0.5);
    const debut = baro.heure === null ? points[0].heure : baro.heure - 12;
    const X = (heure) => x0 + 6 + ((heure - debut) / 12) * (l - 12);
    const Y = (pr) => y0 + 20 + (1 - (pr - (milieu - demi)) / (2 * demi)) * (h - 26);
    // (les bornes : en haut à droite, en bas à gauche — la courbe finit souvent en bas à
    // droite, quand ça baisse)
    ctx.fillStyle = 'rgba(159, 211, 255, 0.7)';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(milieu + demi)}`, x0 + l - 4, y0 + 14);
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(milieu - demi)}`, x0 + 6, y0 + h - 3);
    ctx.strokeStyle = '#9fd3ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((x, k) => (k ? ctx.lineTo(X(x.heure), Y(x.p)) : ctx.moveTo(X(x.heure), Y(x.p))));
    ctx.stroke();
  }

  dessinerPilote(e) {
    const { ctx, canvas, texture } = this.pilote;
    const L = canvas.width;
    const H = canvas.height;
    // un écran à cristaux liquides, vert-gris, rétroéclairé en ambre la nuit
    ctx.fillStyle = e.nuit > 0.5 ? '#2a1a06' : '#9ba88a';
    ctx.fillRect(0, 0, L, H);
    const encre = e.nuit > 0.5 ? '#ffb347' : '#1a2014';
    ctx.fillStyle = encre;
    ctx.strokeStyle = encre;
    ctx.textAlign = 'left';
    ctx.font = '700 20px ui-monospace, Menlo, monospace';
    const mode = e.panne ? 'ALARME' : e.pilote === null ? 'VEILLE' : 'AUTO';
    if (!(e.panne && Math.floor(this.clignote * 2) % 2)) ctx.fillText(mode, 12, 28);
    ctx.font = '600 15px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`CAP ${String(Math.round(e.cap) % 360).padStart(3, '0')}°`, L - 12, 26);
    ctx.textAlign = 'center';
    ctx.font = '700 52px ui-monospace, Menlo, monospace';
    ctx.fillText(e.pilote === null || e.panne ? '---' : `${String(Math.round(e.pilote) % 360).padStart(3, '0')}°`, L / 2, 86);
    // l'angle de barre : une petite échelle en bas
    const y = 108;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(L - 40, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(L / 2, y - 6);
    ctx.lineTo(L / 2, y + 6);
    ctx.stroke();
    const xb = L / 2 + Math.max(-1, Math.min(1, e.barre / 0.6)) * (L / 2 - 44);
    ctx.fillRect(xb - 5, y - 9, 10, 18);
    texture.needsUpdate = true;
  }
}
