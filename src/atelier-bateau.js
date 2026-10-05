// Atelier du bateau : la polaire, dessinée à partir des mesures de la physique
// (src/physique/polaire.json, fabriqué par « npm run polaire »).
import polaire from './physique/polaire.json';

const { vents, angles, resultats } = polaire;
const COULEURS = ['--vent-1', '--vent-2', '--vent-3', '--vent-4', '--vent-5'];
const svg = document.getElementById('polaire');
const NS = 'http://www.w3.org/2000/svg';
const style = getComputedStyle(document.querySelector('.viz-root'));
const couleur = (i) => style.getPropertyValue(COULEURS[i]).trim();

// géométrie : le vent vient du haut ; un angle θ (0 → 180°) se lit en tournant vers la droite
const L = 420;
const H = 560;
svg.setAttribute('viewBox', `0 0 ${L} ${H}`);
svg.style.maxWidth = '460px';
svg.style.margin = '0 auto';
const cx = 70;
const cy = 280;
const vMax = 9;
const R = 245;
const rayon = (v) => (v / vMax) * R;
const point = (v, angle) => {
  const a = (angle * Math.PI) / 180;
  return [cx + rayon(v) * Math.sin(a), cy - rayon(v) * Math.cos(a)];
};
const el = (nom, attributs, parent = svg) => {
  const e = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attributs)) e.setAttribute(k, v);
  parent.append(e);
  return e;
};

// zone face au vent (on n'y avance pas) : de 0 à 38°
{
  const [x1, y1] = point(vMax, 0);
  const [x2, y2] = point(vMax, 38);
  el('path', { d: `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2} Z`, class: 'zone-morte' });
  const [xt, yt] = point(vMax * 0.93, 19);
  const t = el('text', { x: xt - 8, y: yt + 4, class: 'etiquette-forte', 'text-anchor': 'middle' });
  t.textContent = 'face au vent';
}
// cercles de vitesse (tous les 2 nœuds) et rayons d'angle (tous les 30°)
for (let v = 2; v <= 8; v += 2) {
  const [x1, y1] = point(v, 0);
  const [x2, y2] = point(v, 180);
  el('path', { d: `M ${x1} ${y1} A ${rayon(v)} ${rayon(v)} 0 0 1 ${x2} ${y2}`, class: 'grille' });
  const t = el('text', { x: cx - 6, y: cy - rayon(v) + 4, class: 'etiquette', 'text-anchor': 'end' });
  t.textContent = v;
}
{
  const t = el('text', { x: cx - 6, y: cy - rayon(8) - 16, class: 'etiquette', 'text-anchor': 'end' });
  t.textContent = 'nœuds';
}
for (let a = 0; a <= 180; a += 30) {
  const [x, y] = point(vMax, a);
  el('line', { x1: cx, y1: cy, x2: x, y2: y, class: a === 0 || a === 180 ? 'axe' : 'grille' });
  const [xt, yt] = point(vMax + 0.55, a);
  const t = el('text', { x: xt, y: yt + 4, class: 'etiquette', 'text-anchor': a === 0 || a === 180 ? 'start' : 'middle' });
  t.textContent = `${a}°`;
}

// meilleur angle pour remonter au vent et pour descendre (VMG : la vitesse « utile »
// vers le vent, ou à l'opposé)
function meilleurs(v) {
  let haut = { vmg: -1 };
  let bas = { vmg: -1 };
  for (const a of angles) {
    const vit = resultats[v][a].vitesse;
    const utile = vit * Math.cos((a * Math.PI) / 180);
    if (utile > haut.vmg) haut = { vmg: utile, angle: a, vitesse: vit };
    if (-utile > bas.vmg) bas = { vmg: -utile, angle: a, vitesse: vit };
  }
  return { haut, bas };
}

// les courbes
const bulle = document.getElementById('bulle');
const graphe = svg.parentElement;
vents.forEach((v, i) => {
  const pts = angles.map((a) => point(resultats[v][a].vitesse, a));
  const d = pts.map(([x, y], k) => `${k ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  el('path', { d, class: 'courbe', stroke: couleur(i) });
  const { haut, bas } = meilleurs(v);
  for (const m of [haut, bas]) {
    const [x, y] = point(m.vitesse, m.angle);
    el('circle', { cx: x, cy: y, r: 7, class: 'vmg' });
  }
  angles.forEach((a, k) => {
    const [x, y] = pts[k];
    el('circle', { cx: x, cy: y, r: 4, fill: couleur(i), class: 'point' });
    const cible = el('circle', { cx: x, cy: y, r: 11, class: 'cible' });
    const r = resultats[v][a];
    const montrer = () => {
      const boite = svg.getBoundingClientRect();
      const echelle = boite.width / L;
      bulle.hidden = false;
      bulle.style.left = `${x * echelle + (boite.left - graphe.getBoundingClientRect().left)}px`;
      bulle.style.top = `${y * echelle}px`;
      bulle.innerHTML = `Vent de <strong>${v} nœuds</strong> à ${a}° : <strong>${r.vitesse.toFixed(1)} nœuds</strong><br><span class="detail">gîte ${Math.round(r.gite)}°</span>`;
    };
    cible.addEventListener('pointerenter', montrer);
    cible.addEventListener('pointerleave', () => { bulle.hidden = true; });
  });
});
// étiquettes directes, au bout de chaque courbe (vent arrière, en bas), où elles ont la place
let dernierY = -Infinity;
for (const v of vents) {
  const [x, y] = point(resultats[v][180].vitesse, 180);
  const yt = Math.max(y + 4, dernierY + 15);
  dernierY = yt;
  const t = el('text', { x: x - 10, y: yt, class: 'etiquette-forte', 'text-anchor': 'end' });
  t.textContent = `${v} nds`;
}

// la légende
document.getElementById('legende').innerHTML = vents
  .map((v, i) => `<li><i style="background:${couleur(i)}"></i>${v} nœuds de vent</li>`)
  .join('') + '<li><i style="height:12px;width:12px;border:1.5px solid var(--texte);border-radius:50%;background:none"></i>meilleur angle pour remonter ou descendre le vent</li>';

// le tableau
const tableau = document.getElementById('tableau');
tableau.innerHTML = `<caption class="aide" style="text-align:left">Vitesse (nœuds) ; en gras, le meilleur angle pour remonter et pour descendre le vent</caption>
<thead><tr><th scope="col">Vent</th>${angles.map((a) => `<th scope="col">${a}°</th>`).join('')}</tr></thead>
<tbody>${vents.map((v) => {
  const { haut, bas } = meilleurs(v);
  return `<tr><th scope="row">${v} nds</th>${angles.map((a) => `<td class="${a === haut.angle || a === bas.angle ? 'mieux' : ''}">${resultats[v][a].vitesse.toFixed(1)}</td>`).join('')}</tr>`;
}).join('')}</tbody>`;

// les leçons, tirées des chiffres
const v14 = meilleurs(14);
const plusVite = (v) => angles.reduce((m, a) => (resultats[v][a].vitesse > resultats[v][m].vitesse ? a : m), angles[0]);
const giteMax = (v) => Math.max(...angles.map((a) => resultats[v][a].gite));
document.getElementById('lecons').innerHTML = [
  `<strong>Le plus rapide, c'est le vent de travers</strong> : par 14 nœuds de vent, ${resultats[14][plusVite(14)].vitesse.toFixed(1)} nœuds à ${plusVite(14)}°.`,
  `<strong>On ne remonte pas droit au vent.</strong> Pour aller vers le vent, le meilleur compromis est de viser ${v14.haut.angle}° du vent (${v14.haut.vitesse.toFixed(1)} nœuds), puis de virer de bord pour repartir de l'autre côté : c'est louvoyer.`,
  `<strong>Le vent arrière n'est pas le plus rapide</strong> : pour descendre le vent, mieux vaut des bords de grand largue vers ${v14.bas.angle}° qu'un vent arrière plein (${resultats[14][180].vitesse.toFixed(1)} nœuds à 180°).`,
  `<strong>Au-delà de 20 nœuds, le bateau ne va presque plus vite</strong> (${resultats[26][90].vitesse.toFixed(1)} nœuds au maximum : il bute sur sa propre vague), mais il gîte jusqu'à ${Math.round(giteMax(26))}° au près : c'est l'heure de réduire la toile.`,
].map((l) => `<li>${l}</li>`).join('');
