// Vérifie le plan de pont : node scripts/test-pont.js
import { solEn, surfacesEn, ouvrirDescente } from '../src/joueur/pont.js';
import { zDe } from '../src/bateau/forme.js';

let echecs = 0;
const verifier = (c, m) => { console.log(`${c ? '  ✓' : '  ✗'} ${m}`); if (!c) echecs++; };
const nom = (x, z, y) => solEn(x, z, y)?.nom ?? 'rien';

console.log('Hauteurs');
verifier(Math.abs(solEn(0, zDe(0.18), 0.45).y - 0.45) < 1e-6, 'plancher du cockpit à 0,45 m');
verifier(nom(0.6, zDe(0.18), 0.45) === 'banc', 'on monte sur le banc depuis le plancher');
verifier(nom(0.88, zDe(0.18), 0.82) === 'hiloire', 'du banc, on enjambe l\'hiloire');
verifier(nom(1.2, zDe(0.18), 1.17) === 'passavant', 'puis on descend sur le passavant');
verifier(nom(0.88, zDe(0.18), 0.45) === 'rien', 'mais pas d\'un coup depuis le plancher (mur)');
verifier(nom(0.7, zDe(0.45), 0.97) === 'rouf', 'du passavant, on grimpe sur le toit du rouf');
verifier(nom(0.3, zDe(0.8), 1.05) === 'pont-avant', 'le pont avant');
verifier(nom(1.6, zDe(0.38), 0.97) === 'rien', 'les filières arrêtent au bord');
verifier(nom(0, zDe(0.6), 1.4) === 'rien', 'le mât est un obstacle');

console.log('La descente');
verifier(nom(0, 1.35, 0.45) === 'descente', 'du cockpit, on descend la première marche');
verifier(nom(0, 0.9, -0.05) === 'carre', 'puis on arrive dans le carré');
verifier(nom(0, 0.0, -0.3) === 'carre' && nom(0, -0.7, -0.3) === 'rien', 'la table du carré est un obstacle');
verifier(nom(0.4, -0.7, -0.3) === 'carre', 'on passe à côté de la table');
ouvrirDescente(false);
verifier(nom(0, 1.35, 0.45) === 'rien', 'planches de descente en place : on ne passe pas');
ouvrirDescente(true);

console.log('Un tour du pont, du cockpit à l\'étrave par tribord, sans jamais être bloqué');
{
  let x = 0;
  let z = zDe(0.15);
  let y = 0.45;
  const chemin = [[0.6, zDe(0.15)], [0.88, zDe(0.15)], [1.15, zDe(0.15)], [1.2, zDe(0.4)], [1.0, zDe(0.62)], [0.4, zDe(0.85)], [0.1, zDe(0.92)]];
  let bloque = null;
  for (const [cx, cz] of chemin) {
    const n = 60;
    const x0 = x;
    const z0 = z;
    for (let i = 1; i <= n; i++) {
      const px = x0 + ((cx - x0) * i) / n;
      const pz = z0 + ((cz - z0) * i) / n;
      const s = solEn(px, pz, y);
      if (!s) { bloque = `bloqué en (${px.toFixed(2)}, ${pz.toFixed(2)}) à y ${y.toFixed(2)} : ${JSON.stringify(surfacesEn(px, pz))}`; break; }
      x = px; z = pz; y = s.y;
    }
    if (bloque) break;
  }
  verifier(!bloque, bloque ?? `arrivé à l'étrave (y ${y.toFixed(2)} m)`);
}
console.log(echecs ? `\n${echecs} échec(s)` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
