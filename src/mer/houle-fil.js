// Le fil à part de la houle (un « worker ») : un second fil de calcul du navigateur, qui
// tourne en même temps que le jeu, sur un autre cœur du processeur.
//
// Il garde sa propre copie de la mer (les mêmes vagues tirées au hasard, avec la même
// graine) et calcule, quand on le lui demande, la hauteur et le déplacement de l'eau à un
// instant donné, dans les tableaux qu'on lui prête et qu'il nous rend aussitôt (on se les
// passe sans les recopier). L'écume, elle, est faite par le jeu (houle.js).
import { Houle } from './houle.js';

let houle = null;
// (un faux ordinateur lent, pour les essais : chaque calcul prend « frein » fois plus de temps)
let frein = 1;

self.onmessage = ({ data: m }) => {
  if (m.type === 'debut') {
    houle = new Houle({ graine: m.graine, cascades: m.cascades });
  } else if (m.type === 'frein') {
    frein = Math.max(1, m.fois);
  } else if (m.type === 'regler') {
    houle.regler(m.mer, { progressif: m.progressif });
  } else if (m.type === 'calculer') {
    // (un nouvel état de la mer s'installe peu à peu : un morceau par calcul, comme dans le jeu)
    if (houle.aRegler?.length) {
      const [c, j0, j1] = houle.aRegler.shift();
      c.regler(houle.mer, j0, j1);
    }
    const debut = performance.now();
    houle.cascades.forEach((c, i) => c.calculerDeplacements(m.t, m.choppy, new Float32Array(m.tampons[i])));
    if (frein > 1) {
      const fin = performance.now() + (performance.now() - debut) * (frein - 1);
      while (performance.now() < fin);
    }
    self.postMessage({ type: 'resultat', t: m.t, version: m.version, tampons: m.tampons }, m.tampons);
  }
};
