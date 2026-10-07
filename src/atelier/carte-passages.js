// La carte des passages : le bord vu de dessus, case par case (2 cm), avec ce que le corps
// du marin y trouve. On voit d'un coup d'œil où l'on passe, où l'on frotte, où l'on bute.
//  - vert : le corps passe librement (rien à moins de son rayon : hanches, poitrine, yeux) ;
//  - orange : il passe en frôlant (on y entre, mais pas de face) ;
//  - rouge : il bute (une paroi, un meuble, le siège…) ;
//  - gris foncé : pas de sol (un trou, le vide, un mur plein).
// Les chemins de marins automatiques peuvent y être tracés par-dessus (une ligne par essai).
// (Outil de mise au point : window.__jeu.carteDesPassages() dans le jeu ; l'image est
// enregistrée dans captures/.)
import { solEn } from '../joueur/pont.js';

export function dessinerCartePassages(marin, {
  x0 = -0.95, x1 = 0.95, z0 = -0.3, z1 = 2.7, pas = 0.02, echelle = 300, chemins = [], reperes = [],
} = {}) {
  const largeur = Math.round((x1 - x0) * echelle);
  const hauteur = Math.round((z1 - z0) * echelle);
  const canvas = document.createElement('canvas');
  canvas.width = largeur;
  canvas.height = hauteur;
  const cx = canvas.getContext('2d');
  cx.fillStyle = '#15181c';
  cx.fillRect(0, 0, largeur, hauteur);
  // (vu de dessus, l'avant en haut : x vers la droite, z vers le bas)
  const versEcran = (x, z) => [(x - x0) * echelle, (z - z0) * echelle];
  const cote = pas * echelle + 0.5;
  for (let z = z0; z < z1; z += pas) {
    for (let x = x0; x < x1; x += pas) {
      // (le sol qu'on atteint en venant du cockpit ou de la timonerie, pas le toit du rouf)
      const sol = solEn(x, z, 0.55);
      if (!sol) continue;
      const libre = marin.degagement(x, z, sol.y, marin.yeuxEn(x, z, sol.y));
      const teinte = sol.y < 0 ? 0.75 : 1; // (le carré, en bas : un peu plus sombre)
      const c = libre >= 1 ? [70, 170, 95] : libre > 0.75 ? [215, 150, 50] : [190, 60, 55];
      cx.fillStyle = `rgb(${c.map((v) => Math.round(v * teinte)).join(',')})`;
      const [ex, ez] = versEcran(x, z);
      cx.fillRect(ex, ez, cote, cote);
    }
  }
  // une grille tous les 10 cm, et les mètres plus marqués
  cx.lineWidth = 1;
  for (let x = Math.ceil(x0 * 10) / 10; x <= x1; x += 0.1) {
    cx.strokeStyle = Math.abs(x - Math.round(x)) < 1e-6 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.08)';
    const [ex] = versEcran(x, 0);
    cx.beginPath(); cx.moveTo(ex, 0); cx.lineTo(ex, hauteur); cx.stroke();
  }
  for (let z = Math.ceil(z0 * 10) / 10; z <= z1; z += 0.1) {
    cx.strokeStyle = Math.abs(z - Math.round(z)) < 1e-6 ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.08)';
    const [, ez] = versEcran(0, z);
    cx.beginPath(); cx.moveTo(0, ez); cx.lineTo(largeur, ez); cx.stroke();
  }
  // des repères nommés : [x, z, texte]
  cx.font = '13px system-ui, sans-serif';
  for (const [x, z, texte] of reperes) {
    const [ex, ez] = versEcran(x, z);
    cx.fillStyle = '#fff';
    cx.beginPath(); cx.arc(ex, ez, 3, 0, Math.PI * 2); cx.fill();
    cx.fillText(texte, ex + 6, ez + 4);
  }
  // les chemins : [{ points: [[x, z]…], ok }]
  for (const c of chemins) {
    cx.strokeStyle = c.ok ? 'rgba(120, 200, 255, 0.9)' : 'rgba(255, 90, 200, 0.95)';
    cx.lineWidth = 2;
    cx.beginPath();
    c.points.forEach(([x, z], i) => {
      const [ex, ez] = versEcran(x, z);
      if (i === 0) cx.moveTo(ex, ez); else cx.lineTo(ex, ez);
    });
    cx.stroke();
    const [fx, fz] = versEcran(...c.points.at(-1));
    cx.fillStyle = cx.strokeStyle;
    cx.fillRect(fx - 3, fz - 3, 6, 6);
  }
  return canvas.toDataURL('image/png');
}
