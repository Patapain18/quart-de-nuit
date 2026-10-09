// Les instruments du bord, ceux qu'un marin regarde vraiment :
//  - deux afficheurs sur la cloison : la vitesse et le cap, puis le vent apparent
//    (une aiguille autour d'une silhouette de bateau) ;
//  - le compas de route : sa rose reste tournée vers le nord pendant que le bateau
//    tourne autour d'elle ; on lit le cap sous le repère (la « ligne de foi ») ;
//  - la girouette en tête de mât : elle pointe d'où vient le vent apparent ;
//  - les penons : des brins de laine collés près de l'avant du foc, rouge côté bâbord,
//    vert côté tribord. Voile bien réglée : les deux filent vers l'arrière. Pas assez
//    bordée : celui au vent se dresse et tourbillonne. Trop bordée : celui sous le vent
//    s'affaisse et danse.
import * as THREE from 'three';
import { COCKPIT, TIMONERIE } from './forme.js';
import { ROUE } from './modele.js';

// ---------- Les afficheurs (des écrans dessinés dans un canvas) ----------
function ecran(taille = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = taille;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, ctx: canvas.getContext('2d'), texture };
}

function dessinerVitesse(e, m) {
  const { ctx, canvas } = e;
  const t = canvas.width;
  ctx.fillStyle = '#0a0f0d';
  ctx.fillRect(0, 0, t, t);
  ctx.fillStyle = '#9fe0b8';
  ctx.font = '600 28px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('VITESSE', 18, 42);
  ctx.font = '700 96px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(m.vitesse.toFixed(1), t - 20, 140);
  ctx.font = '600 24px ui-monospace, Menlo, monospace';
  ctx.fillText('nds', t - 20, 172);
  ctx.textAlign = 'left';
  ctx.font = '600 28px ui-monospace, Menlo, monospace';
  ctx.fillText('CAP', 18, 226);
  ctx.textAlign = 'right';
  ctx.font = '700 40px ui-monospace, Menlo, monospace';
  ctx.fillText(`${String(Math.round(m.cap) % 360).padStart(3, '0')}°`, t - 20, 230);
  e.texture.needsUpdate = true;
}

function dessinerVent(e, m) {
  const { ctx, canvas } = e;
  const t = canvas.width;
  const c = t / 2;
  ctx.fillStyle = '#0a0f0d';
  ctx.fillRect(0, 0, t, t);
  // le cadran : rouge à bâbord, vert à tribord (les 60 premiers degrés de chaque côté)
  const rayon = t * 0.4;
  ctx.lineWidth = 10;
  for (const [debut, fin, couleur] of [[-60, 0, '#d9534a'], [0, 60, '#3fae6a']]) {
    ctx.strokeStyle = couleur;
    ctx.beginPath();
    ctx.arc(c, c, rayon, ((debut - 90) * Math.PI) / 180, ((fin - 90) * Math.PI) / 180);
    ctx.stroke();
  }
  ctx.strokeStyle = '#9fe0b8';
  ctx.lineWidth = 3;
  for (let a = 0; a < 360; a += 30) {
    const r = (a - 90) * (Math.PI / 180);
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(r) * rayon * 0.82, c + Math.sin(r) * rayon * 0.82);
    ctx.lineTo(c + Math.cos(r) * rayon * 0.95, c + Math.sin(r) * rayon * 0.95);
    ctx.stroke();
  }
  // la silhouette du bateau
  ctx.fillStyle = '#2a3a33';
  ctx.beginPath();
  ctx.moveTo(c, c - rayon * 0.55);
  ctx.quadraticCurveTo(c + rayon * 0.28, c, c + rayon * 0.18, c + rayon * 0.45);
  ctx.lineTo(c - rayon * 0.18, c + rayon * 0.45);
  ctx.quadraticCurveTo(c - rayon * 0.28, c, c, c - rayon * 0.55);
  ctx.fill();
  // l'aiguille : d'où vient le vent apparent
  const a = ((m.angleVentApparent - 90) * Math.PI) / 180;
  ctx.strokeStyle = '#f2f6ef';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(c + Math.cos(a) * rayon * 0.2, c + Math.sin(a) * rayon * 0.2);
  ctx.lineTo(c + Math.cos(a) * rayon * 0.95, c + Math.sin(a) * rayon * 0.95);
  ctx.stroke();
  ctx.fillStyle = '#9fe0b8';
  ctx.font = '700 34px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(m.ventApparent.toFixed(0), c, c + 12);
  ctx.font = '600 18px ui-monospace, Menlo, monospace';
  ctx.fillText('VENT', c, t - 14);
  e.texture.needsUpdate = true;
}

// La rose du compas : graduée tous les 5°, les points cardinaux, le nord en rouge
function dessinerRose(taille = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = taille;
  const ctx = canvas.getContext('2d');
  const c = taille / 2;
  ctx.fillStyle = '#121518';
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e9e4d6';
  ctx.strokeStyle = '#e9e4d6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let a = 0; a < 360; a += 5) {
    const r = ((a - 90) * Math.PI) / 180;
    const long = a % 30 === 0 ? 0.16 : a % 10 === 0 ? 0.1 : 0.06;
    ctx.lineWidth = a % 30 === 0 ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(r) * c * 0.96, c + Math.sin(r) * c * 0.96);
    ctx.lineTo(c + Math.cos(r) * c * (0.96 - long), c + Math.sin(r) * c * (0.96 - long));
    ctx.stroke();
    if (a % 30 === 0) {
      const lettres = { 0: 'N', 90: 'E', 180: 'S', 270: 'O' };
      ctx.save();
      ctx.translate(c + Math.cos(r) * c * 0.68, c + Math.sin(r) * c * 0.68);
      ctx.rotate(((a) * Math.PI) / 180);
      ctx.fillStyle = a === 0 ? '#e0473c' : '#e9e4d6';
      ctx.font = lettres[a] ? '700 64px Georgia, serif' : '600 36px ui-monospace, Menlo, monospace';
      ctx.fillText(lettres[a] ?? String(a / 10), 0, 0);
      ctx.restore();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// ---------- Les penons ----------
class Penon {
  constructor(couleur, derriere) {
    this.positions = new Float32Array(5 * 2 * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const idx = [];
    for (let k = 0; k < 4; k++) {
      const a = k * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      color: couleur, side: THREE.DoubleSide, transparent: derriere, opacity: derriere ? 0.55 : 1, depthTest: !derriere,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = derriere ? 20 : 0;
    this.phase = Math.random() * 10;
  }
  // ancre, direction de la corde (vers l'arrière de la voile), normale vers ce côté,
  // et l'agitation (0 calme → 1 tourbillon), le redressement (vers le haut)
  placer(ancre, corde, haut, agitation, dressage, temps) {
    const p = this.positions;
    const longueur = 0.2;
    const largeur = 0.012;
    let x = ancre.x;
    let y = ancre.y;
    let z = ancre.z;
    for (let k = 0; k < 5; k++) {
      const t = k / 4;
      const onde = Math.sin(temps * (14 + agitation * 10) + this.phase - t * 5) * (0.02 + agitation * 0.07) * t;
      // direction de ce morceau : vers l'arrière, relevée si le penon se dresse
      const dx = corde.x * (1 - dressage) + haut.x * dressage;
      const dy = corde.y * (1 - dressage) + haut.y * dressage;
      const dz = corde.z * (1 - dressage) + haut.z * dressage;
      if (k > 0) {
        x += dx * (longueur / 4);
        y += dy * (longueur / 4) - 0.004 * agitation;
        z += dz * (longueur / 4);
      }
      const ox = haut.x * onde;
      const oy = haut.y * onde;
      const oz = haut.z * onde;
      p.set([x + ox, y + oy - largeur, z + oz], k * 6);
      p.set([x + ox, y + oy + largeur, z + oz], k * 6 + 3);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}

export class Instruments {
  constructor(bateau) {
    this.bateau = bateau;
    const groupe = new THREE.Group();
    groupe.name = 'instruments';
    this.groupe = groupe;
    const zc = TIMONERIE.zArriere + 0.012;
    const yAff = COCKPIT.plancher + 1.12; // (les afficheurs, sur la paroi arrière de la timonerie)

    // afficheurs : écrans légèrement lumineux (on les lit aussi la nuit)
    this.ecrans = [ecran(), ecran()];
    this.materiauxEcrans = this.ecrans.map((e) => new THREE.MeshStandardMaterial({
      color: 0x000000, roughness: 0.18, metalness: 0, emissive: 0xffffff, emissiveMap: e.texture, emissiveIntensity: 0.9,
    }));
    [[-0.62, yAff], [-0.78, yAff]].forEach(([x, y], i) => {
      const plan = new THREE.Mesh(new THREE.PlaneGeometry(0.115, 0.115), this.materiauxEcrans[i]);
      plan.position.set(x, y, zc + 0.027);
      groupe.add(plan);
    });

    // le compas de route : sur le piédestal de la roue, au-dessus d'elle (le barreur le lit
    // par-dessus la jante) — un boîtier, la rose qui tourne, une ligne de foi orange
    const xc = 0;
    const yc = ROUE.y + 0.24;
    const zr = ROUE.z - 0.04;
    this.rose = new THREE.Mesh(new THREE.CircleGeometry(0.066, 48), new THREE.MeshStandardMaterial({ map: dessinerRose(), roughness: 0.4 }));
    this.rose.position.set(xc, yc, zr + 0.047);
    groupe.add(this.rose);
    const boitier = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 32), bateau.materiaux.noir);
    boitier.rotation.x = Math.PI / 2;
    boitier.position.set(xc, yc, zr + 0.015);
    groupe.add(boitier);
    const foi = new THREE.Mesh(new THREE.PlaneGeometry(0.006, 0.03), new THREE.MeshBasicMaterial({ color: 0xff8a1e }));
    foi.position.set(xc, yc + 0.055, zr + 0.05);
    groupe.add(foi);
    const verre = new THREE.Mesh(new THREE.SphereGeometry(0.07, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.12,
    }));
    verre.rotation.x = Math.PI / 2;
    verre.position.set(xc, yc, zr + 0.047);
    groupe.add(verre);

    // la girouette en tête de mât
    const m = bateau.mesures;
    this.girouette = new THREE.Group();
    this.girouette.position.set(0, m.tete + 0.1, m.zMat + 0.05);
    const tige = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.7, 6), bateau.materiaux.noir);
    tige.rotation.x = Math.PI / 2;
    tige.position.z = -0.12;
    const fleche = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.09, 8), new THREE.MeshStandardMaterial({ color: 0xe23a2a, roughness: 0.5 }));
    fleche.rotation.x = -Math.PI / 2;
    fleche.position.z = -0.5;
    const empennage = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.12, 0.16), new THREE.MeshStandardMaterial({ color: 0xe23a2a, roughness: 0.5 }));
    empennage.position.z = 0.22;
    this.girouette.add(tige, fleche, empennage);
    groupe.add(this.girouette);
    this.angleGirouette = 0;

    // trois paires de penons sur le foc (rouge à bâbord, vert à tribord)
    this.penons = [0.28, 0.5, 0.72].map((v) => ({
      v,
      babord: [new Penon(0xd63b2f, false), new Penon(0xd63b2f, true)],
      tribord: [new Penon(0x2e9d55, false), new Penon(0x2e9d55, true)],
    }));
    for (const p of this.penons) for (const pe of [...p.babord, ...p.tribord]) groupe.add(pe.mesh);

    bateau.groupe.add(groupe);
    this.temps = 0;
    this.ageEcrans = 1;
    this._a = new THREE.Vector3();
    this._n = new THREE.Vector3();
    this._c = new THREE.Vector3();
  }

  // mesures : celles de la physique ; nuit : 0 → 1 (les écrans baissent leur éclat la nuit)
  maj(dt, mesures, nuit) {
    this.temps += dt;
    this.ageEcrans += dt;
    if (this.ageEcrans > 0.2) {
      this.ageEcrans = 0;
      dessinerVitesse(this.ecrans[0], mesures);
      dessinerVent(this.ecrans[1], mesures);
      for (const mat of this.materiauxEcrans) mat.emissiveIntensity = 0.9 - 0.75 * nuit;
    }
    // la rose garde le nord : elle tourne dans l'autre sens que le bateau
    this.rose.rotation.z = (mesures.cap * Math.PI) / 180;
    // la girouette, avec un peu d'inertie
    const cible = (-mesures.angleVentApparent * Math.PI) / 180;
    let ecart = cible - this.angleGirouette;
    ecart = Math.atan2(Math.sin(ecart), Math.cos(ecart));
    this.angleGirouette += ecart * Math.min(1, dt * 4) + Math.sin(this.temps * 7) * 0.004;
    this.girouette.rotation.y = this.angleGirouette;
    this.majPenons(mesures);
  }

  majPenons(m) {
    const voile = this.bateau.voiles.foc;
    const nu = voile.nu;
    const nv = voile.nv;
    const pos = voile.positions;
    const normales = voile.geometrie.attributes.normal?.array;
    if (!normales) return;
    const incidence = m.incidenceFoc;
    // ce qui se passe de chaque côté
    const faseye = THREE.MathUtils.clamp((9 - incidence) / 9, 0, 1); // le penon au vent se dresse
    const decroche = THREE.MathUtils.clamp((incidence - 28) / 14, 0, 1); // celui sous le vent danse
    const coteVoile = this.bateau.reglage.coteFoc; // la voile est de ce côté (+1 tribord)
    const deroule = this.bateau.reglage.deroule;
    for (const p of this.penons) {
      const i = Math.max(1, Math.round(0.14 * nu));
      const j = Math.round(p.v * nv);
      const k = j * (nu + 1) + i;
      const k2 = k + 1;
      this._a.set(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
      this._c.set(pos[k2 * 3] - pos[k * 3], pos[k2 * 3 + 1] - pos[k * 3 + 1], pos[k2 * 3 + 2] - pos[k * 3 + 2]).normalize();
      this._n.set(normales[k * 3], normales[k * 3 + 1], normales[k * 3 + 2]).normalize();
      // la normale vers tribord
      if (this._n.x < 0) this._n.negate();
      const haut = new THREE.Vector3(0, 1, 0);
      for (const [cote, paire] of [[1, p.tribord], [-1, p.babord]]) {
        const ancre = this._a.clone().addScaledVector(this._n, 0.012 * cote);
        const auVent = cote !== coteVoile; // le côté au vent est celui opposé à la voile
        const agitation = auVent ? faseye : decroche;
        const dressage = auVent ? faseye * 0.8 : decroche * 0.15;
        const visible = deroule > 0.15;
        for (const pe of paire) {
          pe.mesh.visible = visible;
          if (visible) pe.placer(ancre, this._c, haut, agitation, dressage, this.temps + cote);
        }
      }
    }
  }
}
