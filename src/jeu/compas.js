// Le compas, en haut de l'écran quand on est à la barre : une bande graduée qui défile
// (comme le compas d'un vrai bateau vu de côté), centrée sur le cap du bateau.
//
// Dessus :
//  - le cap du bateau, au milieu (le trait fixe, la « ligne de foi ») ;
//  - le cap voulu (le triangle jaune) : celui que la barre assistée tient, ou celui du
//    pilote automatique (cyan) ;
//  - le vent : d'où il vient (la flèche), et le « cône interdit » en rouge, à moins de
//    44° du vent, là où un voilier ne peut pas aller ;
//  - la nuit de tempête, la zone verte de la fuite : le vent dans le dos (155° à 180°),
//    les vagues bien dans l'arrière.
import { ANGLE_MIN, ecartCap } from './barre-assistee.js';

const CHAMP = 110; // degrés visibles sur la bande
const NOMS = { 0: 'N', 90: 'E', 180: 'S', 270: 'O' };

export class Compas {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.largeur = 0;
    this.hauteur = 0;
  }

  // etat : { cap, capVoulu (ou null), pilote (true si c'est le pilote), vent (d'où il vient, ou null), fuite }
  dessiner({ cap, capVoulu = null, pilote = false, vent = null, fuite = false }) {
    const c = this.canvas;
    const ratio = Math.min(2, devicePixelRatio || 1);
    const l = c.clientWidth;
    const h = c.clientHeight;
    if (!l || !h) return;
    if (l !== this.largeur || h !== this.hauteur) {
      this.largeur = l;
      this.hauteur = h;
      c.width = Math.round(l * ratio);
      c.height = Math.round(h * ratio);
    }
    const g = this.g;
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, l, h);
    const px = l / CHAMP; // pixels par degré
    const x = (degres) => l / 2 + ecartCap(degres, cap) * px; // où tombe un cap sur la bande
    const yBande = 18;

    // le fond
    g.fillStyle = 'rgba(8, 14, 18, 0.55)';
    arrondi(g, 0, yBande - 4, l, h - yBande + 4, 6);
    g.fill();

    // les zones du vent
    if (vent !== null) {
      zone(g, x, px, vent, ANGLE_MIN, 'rgba(232, 68, 58, 0.30)', yBande - 4, h);
      if (fuite) zone(g, x, px, (vent + 180) % 360, 25, 'rgba(79, 190, 110, 0.30)', yBande - 4, h);
    }

    // les graduations : tous les 5°, plus longues tous les 10°, un nom tous les 30°
    g.strokeStyle = 'rgba(230, 238, 240, 0.75)';
    g.fillStyle = 'rgba(230, 238, 240, 0.9)';
    g.font = '600 11px system-ui, sans-serif';
    g.textAlign = 'center';
    g.lineWidth = 1;
    const debut = Math.floor((cap - CHAMP / 2) / 5) * 5;
    g.beginPath();
    for (let d = debut; d <= cap + CHAMP / 2 + 5; d += 5) {
      const deg = ((d % 360) + 360) % 360;
      const xx = x(deg);
      const long = deg % 30 === 0 ? 11 : deg % 10 === 0 ? 7 : 4;
      g.moveTo(xx + 0.5, h - 2);
      g.lineTo(xx + 0.5, h - 2 - long);
      if (deg % 30 === 0) {
        // (les points cardinaux en ambre : le O de l'ouest ne se confond pas avec un zéro)
        g.fillStyle = NOMS[deg] ? '#f0c25a' : 'rgba(230, 238, 240, 0.9)';
        g.fillText(NOMS[deg] ?? String(deg).padStart(3, '0'), xx, h - 17);
      }
    }
    g.stroke();

    // d'où vient le vent : une flèche qui pointe vers le bas, posée sur la bande
    if (vent !== null && Math.abs(ecartCap(vent, cap)) < CHAMP / 2) {
      const xv = x(vent);
      g.fillStyle = '#9fd3ff';
      g.beginPath();
      g.moveTo(xv - 6, yBande - 2);
      g.lineTo(xv + 6, yBande - 2);
      g.lineTo(xv, yBande + 8);
      g.closePath();
      g.fill();
      g.font = '600 10px system-ui, sans-serif';
      g.fillText('vent', xv, yBande - 6);
    }

    // le cap voulu (barre assistée ou pilote)
    if (capVoulu !== null) {
      const ecart = ecartCap(capVoulu, cap);
      const xv = l / 2 + Math.max(-CHAMP / 2, Math.min(CHAMP / 2, ecart)) * px;
      g.fillStyle = pilote ? '#5fd4e8' : '#f0c25a';
      g.beginPath();
      g.moveTo(xv - 7, h - 1);
      g.lineTo(xv + 7, h - 1);
      g.lineTo(xv, h - 12);
      g.closePath();
      g.fill();
    }

    // la ligne de foi et le cap, au milieu
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(l / 2, yBande - 2);
    g.lineTo(l / 2, h);
    g.stroke();
    const texte = `${String(Math.round(cap) % 360).padStart(3, '0')}°`;
    g.font = '700 14px system-ui, sans-serif';
    const lt = g.measureText(texte).width + 14;
    g.fillStyle = 'rgba(8, 14, 18, 0.85)';
    arrondi(g, l / 2 - lt / 2, 0, lt, 18, 4);
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillText(texte, l / 2, 14);
  }
}

function arrondi(g, x, y, l, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + l, y, x + l, y + h, r);
  g.arcTo(x + l, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + l, y, r);
  g.closePath();
}

// une zone de caps (centre ± demi) ; coupée par les bords de la bande s'il le faut (une
// zone dans le dos du bateau tombe hors de la bande : rien ne se dessine)
function zone(g, x, px, centre, demi, couleur, haut, bas) {
  g.fillStyle = couleur;
  g.fillRect(x((centre - demi + 360) % 360), haut, 2 * demi * px, bas - haut);
}
