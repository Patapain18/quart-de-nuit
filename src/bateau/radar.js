// Le radar du bord : l'écran principal sur la console de la timonerie, et un répétiteur dans le
// cockpit, au-dessus du compas (les deux montrent la même image).
//
// Comment marche un radar : l'antenne, en haut du mât, tourne sur elle-même (24 tours
// par minute : un tour en 2,5 s) en envoyant de brèves impulsions d'ondes ; tout ce qui
// les renvoie (une côte, un navire, une bouée, la pluie, les vagues proches) fait un
// « écho », dessiné à sa distance et dans sa direction. L'écran est centré sur le bateau,
// l'avant en haut ; les échos s'allument quand la ligne de balayage passe, puis
// s'estompent jusqu'au tour suivant.
// Ce qu'on y voit : la côte de Kervalen, les bouées, le cargo, les grains de pluie (des
// taches qui dérivent avec le vent), la trombe (une masse dense) et, tout autour du
// bateau, le « fouillis de mer » : les crêtes des vagues proches, d'autant plus qu'elles
// sont hautes (le filtre de mer l'atténue, mais il peut cacher un petit écho).
// Les réglages : la portée (0,75 ; 1,5 ; 3 ; 6 milles), le filtre de mer. (Le gain est
// réglé tout seul.)
import * as THREE from 'three';
import { zDe, ROUF } from './forme.js';
import { poserSurPupitre } from './interieur-timonerie.js';

export const PORTEES = [0.75, 1.5, 3, 6]; // milles nautiques
const MILLE = 1852;
const TOUR = 2.5; // secondes par tour d'antenne
const CASES = 150; // cases de distance le long d'un rayon
const PAS = (0.7 * Math.PI) / 180; // un rayon tous les 0,7°
const TAILLE = 512; // l'écran
const ECHOS = 256; // la mémoire des échos (une image de 256 × 256, agrandie sur l'écran)

// un petit hasard reproductible (le fouillis de mer change à chaque tour, pas à chaque image)
function hachage(a, b, c) {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
// un bruit doux, pour les grains de pluie (des taches de quelques centaines de mètres)
function bruit2(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const h = (i, j) => hachage(ix + i, iz + j, 3.3);
  const lx = fx * fx * (3 - 2 * fx);
  const lz = fz * fz * (3 - 2 * fz);
  return (h(0, 0) * (1 - lx) + h(1, 0) * lx) * (1 - lz) + (h(0, 1) * (1 - lx) + h(1, 1) * lx) * lz;
}

export class Radar {
  constructor(bateau, interieur) {
    this.portee = 1; // l'indice dans PORTEES
    this.filtreMer = true;
    this.angle = 0; // l'antenne (rad, relatif à l'avant du bateau)
    this.tour = 0; // combien de tours depuis le début
    // les échos : une image en nombres à virgule (ils s'estompent doucement, sans laisser
    // de traces comme le feraient des couleurs arrondies), recopiée dans un petit canvas
    this.intensites = new Float32Array(ECHOS * ECHOS);
    this.echos = document.createElement('canvas');
    this.echos.width = this.echos.height = ECHOS;
    this.ce = this.echos.getContext('2d');
    this.pixels = this.ce.createImageData(ECHOS, ECHOS);
    this.ecran = document.createElement('canvas');
    this.ecran.width = this.ecran.height = TAILLE;
    this.cx = this.ecran.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.ecran);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.materiau = new THREE.MeshStandardMaterial({
      color: 0x000000, roughness: 0.15, metalness: 0, emissive: 0xffffff, emissiveMap: this.texture, emissiveIntensity: 1,
    });
    const noir = bateau.materiaux.noir;
    // l'écran principal : sur le pupitre de la console de la timonerie, à gauche du traceur,
    // tourné vers le siège de quart
    const principal = new THREE.Group();
    const boitier = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.04), noir);
    const vitre = new THREE.Mesh(new THREE.PlaneGeometry(0.165, 0.165), this.materiau);
    vitre.position.z = 0.0205;
    principal.add(boitier, vitre);
    poserSurPupitre(principal, 0.1, 0.6, 0.02);
    interieur.groupe.add(principal);
    this.positionPrincipal = principal.position.clone();
    // le répétiteur du cockpit, sur la cloison, au-dessus du compas
    const repetiteur = new THREE.Group();
    const boitier2 = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.18, 0.03), noir);
    const vitre2 = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15), this.materiau);
    vitre2.position.z = 0.0155;
    repetiteur.add(boitier2, vitre2);
    repetiteur.position.set(0.58, 1.255, zDe(ROUF.uArriere) + 0.03);
    bateau.groupe.add(repetiteur);
    this.positionRepetiteur = repetiteur.position.clone();
    this.ageEcran = 1;
  }

  get milles() { return PORTEES[this.portee]; }

  changerPortee(sens = 1) {
    this.portee = (this.portee + sens + PORTEES.length) % PORTEES.length;
    // (à la nouvelle échelle, les vieux échos n'ont plus de sens : on efface)
    this.intensites.fill(0);
  }

  // dt ; m : { x, z (la position du bateau), cap (degrés) } ; monde : {
  //   hs (hauteur des vagues), pluie (0 → 1), vent : { x, z } (m/s, vers où il va),
  //   temps (s), terre(x, z) → distance à la côte (négative : à terre),
  //   cibles : [{ x, z, rayon, force }] (les navires, les bouées, la trombe, l'écho fantôme ;
  //     avec ligne, lx, lz, largeurLigne : un segment de ±ligne m le long de (lx, lz), dont
  //     l'écho faiblit vers les bouts — la crête d'une vague scélérate) }
  // nuit : 0 → 1 (l'écran baisse son éclat)
  maj(dt, m, monde, nuit = 0) {
    const R = this.milles * MILLE;
    const c = ECHOS / 2;
    const rayonEcran = ECHOS * 0.46;
    const cap = (m.cap * Math.PI) / 180;
    // les vieux échos s'estompent (en un tour et demi)
    const f = Math.exp(-dt / (TOUR * 0.6));
    const t = this.intensites;
    for (let i = 0; i < t.length; i++) t[i] *= f;
    // l'antenne tourne : on calcule chaque rayon balayé depuis l'image d'avant
    const avant = this.angle;
    this.angle += (dt / TOUR) * Math.PI * 2;
    const premier = Math.ceil(avant / PAS);
    const dernier = Math.floor(this.angle / PAS);
    for (let k = premier; k <= dernier; k++) this.rayon(k * PAS, m, monde, R, cap, c, rayonEcran);
    if (this.angle > Math.PI * 2) {
      this.angle -= Math.PI * 2;
      this.tour++;
    }
    // l'écran, dix-huit fois par seconde
    this.ageEcran += dt;
    if (this.ageEcran < 1 / 18) return;
    this.ageEcran = 0;
    this.copierEchos();
    this.dessinerEcran(TAILLE / 2, TAILLE * 0.46);
    this.materiau.emissiveIntensity = (1.1 - 0.6 * nuit) * (this.vacille ?? 1);
  }

  // Un rayon de l'antenne (a : relatif à l'avant, sens des aiguilles d'une montre)
  rayon(a, m, monde, R, cap, c, rayonEcran) {
    const t = this.intensites;
    const dirMonde = cap + a;
    const dx = Math.sin(dirMonde);
    const dz = -Math.cos(dirMonde);
    const sx = Math.sin(a);
    const sy = -Math.cos(a);
    const pas = R / CASES;
    // le fouillis de mer : jusqu'à quelques centaines de mètres, selon la hauteur des vagues
    const porteeMer = 250 + 260 * monde.hs;
    let rivage = -1; // (la distance du rivage sur ce rayon, quand on l'a trouvé)
    for (let i = 1; i < CASES; i++) {
      const r = i * pas;
      const x = m.x + dx * r;
      const z = m.z + dz * r;
      let e = 0;
      // la côte : un écho fort sur le rivage, puis les premières collines, de plus en plus
      // faibles ; derrière, l'ombre (l'onde ne passe pas au-delà du relief)
      if (rivage < 0 && monde.terre(x, z) < 0) rivage = r;
      if (rivage >= 0) {
        const dedans = r - rivage;
        e = dedans < pas * 1.5 ? 1 : (0.25 + 0.5 * hachage(i, Math.round(dirMonde * 300), 1)) * Math.exp(-dedans / 450);
      }
      // les cibles (navires, bouées, trombe, l'écho fantôme)
      for (const t of monde.cibles) {
        let d;
        let k = 1;
        if (t.ligne) {
          const qx = x - t.x;
          const qz = z - t.z;
          const le = Math.max(-t.ligne, Math.min(t.ligne, qx * t.lx + qz * t.lz));
          d = Math.hypot(qx - t.lx * le, qz - t.lz * le);
          k = Math.exp(-((le / t.largeurLigne) ** 2));
        } else d = Math.hypot(x - t.x, z - t.z);
        if (d < t.rayon + pas) e += k * t.force * (1 - 0.4 * (d / (t.rayon + pas)));
      }
      // les grains : des taches de pluie qui dérivent avec le vent (seuls les plus
      // denses renvoient l'onde)
      if (monde.pluie > 0.05) {
        const n = bruit2((x - monde.vent.x * monde.temps) / 1100, (z - monde.vent.z * monde.temps) / 1100);
        e += monde.pluie * 0.5 * Math.max(0, n - 0.6) * 2.5 * (0.5 + 0.5 * hachage(i, this.tour, dirMonde));
      }
      // le fouillis de mer : des crêtes au hasard, plus près, plus fortes (le filtre en
      // retire la plus grande part, près du bateau)
      if (r < porteeMer * 1.4) {
        const crete = hachage(i * 1.7, Math.round(dirMonde / PAS), this.tour) ** 4;
        const mer = Math.min(1, monde.hs / 4) * Math.exp(-r / porteeMer) * crete;
        e += mer * (this.filtreMer ? 0.2 + 0.8 * Math.min(1, r / porteeMer) ** 2 : 1);
      }
      // le bruit de fond du récepteur
      e += 0.04 * hachage(i, dirMonde * 97, this.tour) ** 8;
      if (e < 0.08) continue;
      // (l'écho occupe la case : d'autant plus large qu'elle est loin, le faisceau s'ouvre)
      const v = Math.min(1, e);
      const px = c + (sx * r * rayonEcran) / R;
      const py = c + (sy * r * rayonEcran) / R;
      const demi = Math.max(0.5, ((r * PAS * rayonEcran) / R) * 0.6);
      for (let yy = Math.floor(py - demi); yy <= Math.floor(py + demi); yy++) {
        if (yy < 0 || yy >= ECHOS) continue;
        for (let xx = Math.floor(px - demi); xx <= Math.floor(px + demi); xx++) {
          if (xx < 0 || xx >= ECHOS) continue;
          const k = yy * ECHOS + xx;
          if (t[k] < v) t[k] = v;
        }
      }
    }
  }

  // les intensités → les couleurs (orange franc pour les échos forts, ambre sombre pour les faibles)
  copierEchos() {
    const t = this.intensites;
    const d = this.pixels.data;
    for (let k = 0; k < t.length; k++) {
      const v = t[k];
      const i = k * 4;
      if (v < 0.03) {
        d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 0;
        continue;
      }
      d[i] = 255 * Math.min(1, 0.45 + v);
      d[i + 1] = 70 + 150 * v;
      d[i + 2] = 20 * v;
      d[i + 3] = 255 * Math.min(1, v * 1.6);
    }
    this.ce.putImageData(this.pixels, 0, 0);
  }

  dessinerEcran(c, rayonEcran) {
    const g = this.cx;
    g.fillStyle = '#05080b';
    g.fillRect(0, 0, TAILLE, TAILLE);
    g.save();
    g.beginPath();
    g.arc(c, c, rayonEcran, 0, Math.PI * 2);
    g.clip();
    g.imageSmoothingEnabled = true;
    g.drawImage(this.echos, 0, 0, TAILLE, TAILLE);
    // la ligne de balayage, et sa traîne
    const a = this.angle;
    const traine = g.createConicGradient?.(a - Math.PI / 2 - 0.5, c, c);
    if (traine) {
      traine.addColorStop(0, 'rgba(120, 200, 255, 0)');
      traine.addColorStop(0.079, 'rgba(120, 200, 255, 0.10)');
      traine.addColorStop(0.08, 'rgba(120, 200, 255, 0)');
      g.fillStyle = traine;
      g.fillRect(0, 0, TAILLE, TAILLE);
    }
    g.strokeStyle = 'rgba(150, 215, 255, 0.85)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(c, c);
    g.lineTo(c + Math.sin(a) * rayonEcran, c - Math.cos(a) * rayonEcran);
    g.stroke();
    g.restore();
    // les cercles de distance, la ligne de l'avant, le bateau au centre
    g.strokeStyle = 'rgba(120, 180, 210, 0.35)';
    g.lineWidth = 1;
    for (let k = 1; k <= 4; k++) {
      g.beginPath();
      g.arc(c, c, (rayonEcran * k) / 4, 0, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(c, c);
    g.lineTo(c, c - rayonEcran);
    g.stroke();
    g.fillStyle = '#d8eef8';
    g.beginPath();
    g.moveTo(c, c - 7);
    g.lineTo(c - 5, c + 6);
    g.lineTo(c + 5, c + 6);
    g.closePath();
    g.fill();
    // le texte : la portée, l'écart entre deux cercles, le filtre
    g.fillStyle = '#9fd7f0';
    g.font = '600 22px ui-monospace, Menlo, monospace';
    g.textAlign = 'left';
    g.fillText(`${String(this.milles).replace('.', ',')} mn`, 14, 30);
    g.textAlign = 'right';
    g.fillText('AVANT EN HAUT', TAILLE - 14, 30);
    g.font = '500 18px ui-monospace, Menlo, monospace';
    g.textAlign = 'left';
    g.fillText(`cercles ${String(this.milles / 4).replace('.', ',')} mn`, 14, TAILLE - 16);
    g.textAlign = 'right';
    g.fillText(this.filtreMer ? 'FILTRE MER' : 'filtre coupé', TAILLE - 14, TAILLE - 16);
    // l'alarme de la zone de garde : son anneau (un quart de mille), qui clignote une fois
    // par seconde, et l'alerte
    if (this.alarme) {
      const r = (0.25 / this.milles) * rayonEcran;
      const allume = (performance.now() / 500) % 2 < 1;
      g.strokeStyle = `rgba(255, 90, 60, ${allume ? 0.9 : 0.35})`;
      g.lineWidth = 2;
      g.setLineDash([6, 6]);
      g.beginPath();
      g.arc(c, c, Math.min(r, rayonEcran), 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#ff5a3c';
      g.font = '700 26px ui-monospace, Menlo, monospace';
      g.textAlign = 'center';
      g.fillText('ALARME', c, 64);
      g.font = '600 18px ui-monospace, Menlo, monospace';
      g.fillText('ZONE DE GARDE', c, 86);
    }
    this.texture.needsUpdate = true;
  }
}
