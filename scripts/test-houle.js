// Vérifie la simulation de la houle, sans navigateur : node scripts/test-houle.js
//   1. une vague seule avance dans le bon sens et a des crêtes pointues (pas des creux pointus)
//   2. la hauteur des vagues correspond au spectre (mer de vent seule)
//   3. hauteur(x, z) retrouve bien le point d'eau déplacé
//   4. le temps de calcul d'une image
import { Houle, CASCADES } from '../src/mer/houle.js';
import { hauteurSignificativeVent } from '../src/mer/spectre.js';

let echecs = 0;
const verifier = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) echecs++;
};

// ---------- 1. Une vague seule ----------
console.log('1. Une vague seule (5 longueurs d\'onde sur le carreau de la cascade 2)');
{
  const houle = new Houle({ graine: 3, cascades: [{ ...CASCADES[2], min: 0, max: 99 }] });
  const c = houle.cascades[0];
  c.h0Re.fill(0);
  c.h0Im.fill(0);
  c.energie = 0;
  const n = c.n;
  c.h0Re[0 * n + 5] = 0.5; // une seule vague, vers +x, amplitude totale 2 × 0,5 = 1 m
  houle.choppy = 1;
  const profil = (t) => {
    houle.calculer(t, 1 / 60);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const d = c.donnees;
      pts.push({ x: i * c.pas + d[i * 4], h: d[i * 4 + 1] });
    }
    return pts;
  };
  const crete = (pts) => pts.reduce((m, p) => (p.h > m.h ? p : m), pts[0]);
  const p0 = profil(0);
  const p1 = profil(0.4);
  const avance = crete(p1).x - crete(p0).x;
  verifier(Math.abs(crete(p0).h - 1) < 0.02, `amplitude ${crete(p0).h.toFixed(3)} m (attendu 1)`);
  verifier(avance > 0, `la crête avance vers +x (${avance.toFixed(2)} m en 0,4 s)`);
  // Les crêtes doivent être plus étroites que les creux : on mesure la part de la
  // longueur où l'eau est au-dessus du niveau moyen (< 50 % si crêtes pointues).
  const pts = p0.slice().sort((a, b) => a.x - b.x);
  let dessus = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const largeur = ((b.x - a.x) + c.taille) % c.taille;
    if ((a.h + b.h) / 2 > 0) dessus += largeur;
  }
  const part = dessus / c.taille;
  verifier(part < 0.47, `crêtes pointues : l'eau est au-dessus du niveau moyen sur ${(part * 100).toFixed(1)} % de la longueur`);
}

// ---------- 2. Hauteur des vagues ----------
console.log('2. Hauteur significative (mer de vent seule)');
for (const [nom, mer] of [
  ['brise de 10 nœuds', { vent: 5.1, fetch: 60000, directionVent: 0 }],
  ['grand frais de 30 nœuds', { vent: 15.4, fetch: 150000, directionVent: 0 }],
  ['tempête de 50 nœuds', { vent: 25.7, fetch: 200000, directionVent: 0 }],
]) {
  const houle = new Houle({ graine: 7 });
  houle.regler(mer);
  const attendu = hauteurSignificativeVent(mer);
  const spectre = houle.hauteurSignificative;
  // mesure sur la vraie surface : variance de la hauteur sur une grande grille
  houle.calculer(12.3);
  let somme = 0;
  let somme2 = 0;
  let nb = 0;
  for (let z = 0; z < 1777; z += 3.7) {
    for (let x = 0; x < 1777; x += 3.7) {
      let h = 0;
      const s = [0, 0, 0];
      for (const c of houle.cascades) c.ajouter(x, z, s);
      h = s[1];
      somme += h;
      somme2 += h * h;
      nb++;
    }
  }
  const variance = somme2 / nb - (somme / nb) ** 2;
  const mesure = 4 * Math.sqrt(variance);
  console.log(`  ${nom} : spectre ${attendu.toFixed(2)} m · grilles ${spectre.toFixed(2)} m · surface ${mesure.toFixed(2)} m`);
  verifier(Math.abs(spectre / attendu - 1) < 0.12, `${nom} : les cascades couvrent le spectre (écart ${((spectre / attendu - 1) * 100).toFixed(1)} %)`);
  verifier(Math.abs(mesure / spectre - 1) < 0.2, `${nom} : la surface a la bonne hauteur (écart ${((mesure / spectre - 1) * 100).toFixed(1)} %)`);
}

// ---------- 3. hauteur(x, z) ----------
console.log('3. Retrouver le point d\'eau déplacé');
{
  const houle = new Houle({ graine: 11 });
  houle.regler({ vent: 18, fetch: 150000, directionVent: 0.4, houle: { hs: 2, periode: 11, direction: 1.2 } });
  houle.calculer(40);
  let pire = 0;
  // des points « au hasard » mais toujours les mêmes (le test doit donner le même résultat)
  let graine = 12345;
  const hasard = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };
  for (let essai = 0; essai < 400; essai++) {
    const x = hasard() * 3000 - 1500;
    const z = hasard() * 3000 - 1500;
    // point de départ trouvé par hauteur() : on refait le chemin à l'endroit
    let px = x;
    let pz = z;
    for (let i = 0; i < 5; i++) {
      const s = houle.lire(px, pz);
      px = x - s[0];
      pz = z - s[2];
    }
    const s = houle.lire(px, pz);
    pire = Math.max(pire, Math.hypot(px + s[0] - x, pz + s[2] - z));
  }
  verifier(pire < 0.05, `écart horizontal max ${pire.toFixed(4)} m sur 400 points (Hs ${houle.hauteurSignificative.toFixed(1)} m)`);
}

// ---------- 4. Temps de calcul ----------
console.log('4. Temps de calcul d\'une image');
{
  const houle = new Houle({ graine: 5 });
  houle.regler({ vent: 12, fetch: 100000, directionVent: 0 });
  for (let i = 0; i < 20; i++) houle.calculer(i / 60);
  const debut = performance.now();
  const images = 120;
  for (let i = 0; i < images; i++) houle.calculer(i / 60);
  const ms = (performance.now() - debut) / images;
  console.log(`  ${ms.toFixed(2)} ms par image (${CASCADES.length} cascades)`);
  const t0 = performance.now();
  for (let i = 0; i < 10000; i++) houle.hauteur(i * 0.37, i * 0.21);
  console.log(`  hauteur(x, z) : ${(((performance.now() - t0) / 10000) * 1000).toFixed(2)} µs par point`);
  const t1 = performance.now();
  houle.regler({ vent: 20, fetch: 100000, directionVent: 0.3 });
  console.log(`  regler() : ${(performance.now() - t1).toFixed(1)} ms`);
}

console.log(echecs ? `\n${echecs} vérification(s) en échec` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
