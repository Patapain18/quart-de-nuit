// Les gouttes sur « l'objectif » : quand une vague nous arrive dessus, ou quand on regarde
// face à la pluie, des gouttes se posent devant nos yeux. Chacune est une petite lentille :
// elle déforme et brouille ce qu'il y a derrière. Les grosses glissent vers le bas en
// laissant une traînée de gouttelettes, puis tout sèche (ou le vent les chasse).
//
// On les dessine dans une petite image (un canvas 2D) où chaque pixel dit comment la
// lumière est déviée (la « normale » de la goutte : rouge = vers la droite, vert = vers le
// haut, bleu = son épaisseur, alpha = s'il y a de l'eau). Le développement de l'image
// (post.js) lit cette carte et décale la scène derrière chaque goutte.
import * as THREE from 'three';

const HAUTEUR = 270; // pixels de la carte des gouttes (la largeur suit l'écran)
const MAX = 260;

// Le dessin d'une goutte, une fois pour toutes (64 × 64) : une calotte d'eau vue de face
function dessinerGoutte() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const img = g.createImageData(64, 64);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const nx = (x + 0.5) / 32 - 1;
      const ny = 1 - (y + 0.5) / 32; // (vers le haut)
      const r2 = nx * nx + ny * ny;
      const k = (y * 64 + x) * 4;
      if (r2 >= 1) continue;
      // (une goutte qui coule est un peu plus épaisse en bas)
      const h = Math.sqrt(1 - r2);
      img.data[k] = Math.round(127.5 + nx * 127);
      img.data[k + 1] = Math.round(127.5 + ny * 127);
      img.data[k + 2] = Math.round(h * 255);
      img.data[k + 3] = Math.round(255 * Math.min(1, (1 - r2) * 6));
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export class Gouttes {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.height = HAUTEUR;
    this.canvas.width = Math.round(HAUTEUR * 16 / 9);
    this.contexte = this.canvas.getContext('2d');
    this.modele = dessinerGoutte();
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.gouttes = [];
    this.vide = true;
    this.attentePluie = 0;
  }

  redimensionner(largeur, hauteur) {
    this.canvas.width = Math.max(64, Math.round(HAUTEUR * largeur / Math.max(1, hauteur)));
    this.canvas.height = HAUTEUR;
    this.texture.dispose();
    this.texture.image = this.canvas;
    this.texture.needsUpdate = true;
  }

  // Une goutte (x, y en pixels de la carte ; r : rayon)
  ajouter(x, y, r) {
    if (this.gouttes.length >= MAX) this.gouttes.shift();
    this.gouttes.push({ x, y, r, vy: 0, vie: 1, duree: 2.5 + Math.random() * 4 + r * 0.25, colle: Math.random() * 0.8, age: 0 });
  }

  // Une vague nous arrive dessus (force 0 → 1,5) : une poignée de gouttes de toutes tailles
  eclabousser(force = 1) {
    const { width: l, height: h } = this.canvas;
    const n = Math.round(8 + 24 * force);
    for (let k = 0; k < n; k++) {
      const r = 1.2 + Math.random() ** 3 * 7 * Math.min(1.4, force);
      this.ajouter(Math.random() * l, Math.random() * h * 0.95, r);
    }
  }

  // pluie : 0 → 1 ; face : 0 → 1 (on regarde vers où va le vent : la pluie arrive dans
  // les yeux) ; dehors : sinon, rien ne se pose (et les gouttes sèchent vite)
  maj(dt, { pluie = 0, face = 0, dehors = true }) {
    const { width: l, height: h } = this.canvas;
    if (dehors && pluie > 0.05) {
      this.attentePluie -= dt * pluie * (0.5 + 5 * face);
      while (this.attentePluie < 0) {
        this.attentePluie += 1;
        this.ajouter(Math.random() * l, Math.random() * h, 1.2 + Math.random() ** 3 * 4);
      }
    }
    const traces = [];
    for (const g of this.gouttes) {
      g.age += dt;
      g.vie -= dt / (dehors ? g.duree : 0.8);
      // les grosses gouttes glissent, par à-coups (elles accrochent puis lâchent)
      if (g.r > 4.5) {
        g.colle -= dt;
        if (g.colle <= 0) {
          g.vy = Math.min(g.vy + dt * (g.r - 4) * 18, 90);
          if (Math.random() < dt * 2.5) g.colle = Math.random() * 0.5;
        } else {
          g.vy *= 0.85;
        }
        const avant = g.y;
        g.y += g.vy * dt;
        // elles laissent derrière elles une traînée de gouttelettes, et maigrissent
        if (Math.floor(avant / 9) !== Math.floor(g.y / 9) && Math.random() < 0.6) {
          traces.push([g.x + (Math.random() - 0.5) * g.r * 0.4, avant, 1 + Math.random() * g.r * 0.25]);
          g.r *= 0.985;
        }
      }
    }
    for (const [x, y, r] of traces) this.ajouter(x, y, r);
    this.gouttes = this.gouttes.filter((g) => g.vie > 0 && g.y < h + g.r * 2);
    // on redessine la carte
    const c = this.contexte;
    if (!this.gouttes.length) {
      if (!this.vide) {
        c.clearRect(0, 0, l, h);
        this.texture.needsUpdate = true;
        this.vide = true;
      }
      return;
    }
    this.vide = false;
    c.clearRect(0, 0, l, h);
    for (const g of this.gouttes) {
      c.globalAlpha = Math.min(1, g.vie * 3);
      // (une goutte qui coule s'étire un peu vers le bas)
      const etire = 1 + Math.min(0.5, g.vy / 120);
      c.drawImage(this.modele, g.x - g.r, g.y - g.r, g.r * 2, g.r * 2 * etire);
    }
    c.globalAlpha = 1;
    this.texture.needsUpdate = true;
  }
}
