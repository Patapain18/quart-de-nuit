// Le livre des feux de la côte de Kervalen : la page qu'on lit dans la timonerie (le livre bleu,
// sur l'étagère tribord), et que montre l'atelier des feux. Pour chaque feu : son nom, sa
// signature (le caractère : la couleur, le rythme, la période), le dessin de ses éclats sur une
// période, sa hauteur, sa portée, ce qui le porte ; et, en face, une petite carte : où ils
// sont, sur la côte.
//
// Pour reconnaître un feu, la nuit : on compte ses éclats, et l'on mesure le temps entre deux
// groupes ; on cherche dans le livre celui qui fait ça.
import { FEUX, rythme } from '../monde/feux.js';
import { COTE, rivage } from '../rendu/cote.js';

const TEINTES = { blanc: '#f6ecd2', vert: '#3ccf73', rouge: '#e2453a', jaune: '#f0b45a' };

// Le dessin des éclats d'un feu sur une période (et un peu plus : on voit revenir le groupe)
export function dessinRythme(feu, { largeur = 230, hauteur = 16, periodes = 1.25 } = {}) {
  const r = rythme(feu);
  const duree = r.periode * periodes;
  const x = (t) => (t / duree) * largeur;
  let svg = `<svg class="rythme" viewBox="0 0 ${largeur} ${hauteur + 12}" width="${largeur}" height="${hauteur + 12}" role="img" aria-label="${feu.caractere}">`;
  svg += `<rect x="0" y="0" width="${largeur}" height="${hauteur}" rx="2" fill="#1b2230"/>`;
  for (let k = 0; k * r.periode < duree; k++) {
    for (const [debut, d] of r.eclats) {
      const a = k * r.periode + debut + (feu.decalage ?? 0) % r.periode;
      if (a >= duree) continue;
      // (un éclat très bref reste visible : 2 px au moins)
      svg += `<rect x="${x(a).toFixed(1)}" y="2" width="${Math.max(2, x(Math.min(d, duree - a))).toFixed(1)}" height="${hauteur - 4}" rx="1" fill="${TEINTES[feu.couleur]}"/>`;
    }
  }
  // la graduation : une marque par seconde, et la période
  for (let t = 0; t <= duree + 1e-6; t += 1) svg += `<line x1="${x(t).toFixed(1)}" x2="${x(t).toFixed(1)}" y1="${hauteur}" y2="${hauteur + (t % r.periode === 0 ? 6 : 3)}" stroke="#6d6250" stroke-width="1"/>`;
  svg += `<text x="${x(r.periode).toFixed(1)}" y="${hauteur + 11}" text-anchor="middle" font-size="9" fill="#6d6250">${r.periode} s</text>`;
  return `${svg}</svg>`;
}

// La petite carte : la côte de la pointe du Bec à Port-Kervalen, et les feux
export function carteDesFeux({ largeur = 300, hauteur = 210 } = {}) {
  const x0 = -3600;
  const x1 = 2200;
  const z0 = -4800;
  const z1 = -800;
  const px = (x) => ((x - x0) / (x1 - x0)) * largeur;
  const pz = (z) => ((z - z0) / (z1 - z0)) * hauteur;
  let terre = `M 0 0`;
  for (let k = 0; k <= 80; k++) {
    const x = x0 + ((x1 - x0) * k) / 80;
    terre += ` L ${px(x).toFixed(1)} ${Math.max(0, pz(rivage(x))).toFixed(1)}`;
  }
  terre += ` L ${largeur} 0 Z`;
  const { x: ix, z: iz, rayon } = COTE.ile;
  let svg = `<svg class="carte-feux" viewBox="0 0 ${largeur} ${hauteur}" role="img" aria-label="La côte de Kervalen et ses feux">`;
  svg += `<rect width="${largeur}" height="${hauteur}" fill="#f4efe1"/>`;
  svg += `<path d="${terre}" fill="#e8d59a" stroke="#6b5326" stroke-width="1.2"/>`;
  svg += `<ellipse cx="${px(ix).toFixed(1)}" cy="${pz(iz).toFixed(1)}" rx="${(rayon / (x1 - x0) * largeur).toFixed(1)}" ry="${(rayon / (z1 - z0) * hauteur).toFixed(1)}" fill="#e8d59a" stroke="#6b5326" stroke-width="1"/>`;
  svg += `<text x="${px(ix).toFixed(1)}" y="${(pz(iz) + 15).toFixed(1)}" text-anchor="middle" font-size="9" font-style="italic" fill="#5c4a26">Île Brune</text>`;
  svg += `<text x="${px(COTE.anse.x).toFixed(1)}" y="${(pz(rivage(COTE.anse.x)) - 24).toFixed(1)}" text-anchor="middle" font-size="9" font-style="italic" fill="#5c4a26">Port-Kervalen</text>`;
  for (const feu of FEUX) {
    const x = px(feu.x);
    const y = pz(feu.z);
    // (le signe des feux sur les cartes : une goutte magenta)
    svg += `<path d="M ${x.toFixed(1)} ${y.toFixed(1)} l 9 -7 a 4 4 0 1 0 -3 -4 Z" fill="#b0307a" opacity="0.85"/>`;
    svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8" fill="#1d1d1d"/>`;
    const gauche = feu.id === 'roche-rouge';
    svg += `<text x="${(x + (gauche ? -6 : 6)).toFixed(1)}" y="${(y + 12).toFixed(1)}" text-anchor="${gauche ? 'end' : 'start'}" font-size="8.5" fill="#26323a">${feu.caractere}</text>`;
  }
  svg += `<text x="${largeur - 6}" y="${hauteur - 6}" text-anchor="end" font-size="8.5" fill="#6d6250">N ↑ · un mille : ${(1852 / (x1 - x0) * largeur).toFixed(0)} px</text>`;
  return `${svg}</svg>`;
}

// La page : l'explication des signes, et chaque feu
export function pageDesFeux() {
  const entrees = FEUX.map((feu) => `
    <article class="feu" data-feu="${feu.id}">
      <h4>${feu.nom}</h4>
      <p class="caractere">${feu.caractere}</p>
      ${dessinRythme(feu)}
      <p class="details">${feu.structure} · ${feu.hauteur} m · ${feu.portee} milles</p>
      <p class="explication">${feu.explication}</p>
    </article>`).join('');
  return { entrees, carte: carteDesFeux() };
}

// Les signes (ce qu'il faut savoir pour lire une ligne du livre)
export const SIGNES = [
  ['Fl', 'à éclats : la lumière est plus courte que la nuit entre deux éclats'],
  ['Fl(3)', 'éclats groupés par trois'],
  ['Q', 'scintillant : un éclat par seconde'],
  ['LFl', 'éclat long : deux secondes au moins'],
  ['W · R · G', 'blanc · rouge · vert'],
  ['12s', 'la période : le temps entre le début de deux groupes'],
];
