// L'entrée du jeu (jeu.html). Avant de lancer quoi que ce soit, on vérifie que ce navigateur
// sait faire tourner le jeu (rendu/capacites.js) : sinon, au lieu d'une page noire, on dit
// pourquoi, et quoi faire. Un navigateur qui dessine sans carte graphique peut jouer, mais on
// le prévient : ce sera très lent.
import { verifierCapacites } from './rendu/capacites.js';

const parametres = new URLSearchParams(location.search);
// (pour voir ces messages sans changer de navigateur : jeu.html?impossible=webgl2,
// ?impossible=flottants, ou ?sans-carte)
const capacites = parametres.has('impossible')
  ? { ok: false, raison: parametres.get('impossible') }
  : verifierCapacites();
if (parametres.has('sans-carte')) capacites.sansCarteGraphique = true;

// (la même phrase, dans les deux messages : où réactiver l'accélération graphique)
const ACCELERATION = 'Dans Chrome ou Edge : Paramètres → Système → « Utiliser l\'accélération graphique si disponible » ; dans Firefox : Paramètres → Général → Performances. Puis relance le navigateur.';

const IMPOSSIBLE = {
  webgl2: {
    titre: 'Ce navigateur ne peut pas faire tourner le jeu',
    pourquoi: 'Le jeu dessine la mer et la tempête en 3D avec WebGL 2, et ton navigateur ne le lui permet pas : il est trop ancien, ou il a coupé l\'accélération graphique (ou refusé ta carte graphique).',
    faire: ['Essaie avec un navigateur à jour : Chrome, Edge, Firefox ou Safari.', `Si c'en est déjà un, réactive l'accélération graphique. ${ACCELERATION}`],
  },
  flottants: {
    titre: 'Ta carte graphique ne peut pas faire tourner le jeu',
    pourquoi: 'Pour la lumière de la nuit, du noir d\'encre à l\'éclair des milliers de fois plus fort, le jeu dessine dans des images « à virgule », qui gardent toutes ces nuances : ta carte graphique, ou ce navigateur, ne sait pas le faire.',
    faire: ['Essaie avec un autre navigateur à jour (Chrome ou Firefox), ou mets à jour le pilote de ta carte graphique.', 'Sinon, essaie sur un autre ordinateur.'],
  },
};

if (capacites.ok) {
  if (capacites.sansCarteGraphique) {
    const avertir = document.getElementById('sans-carte');
    avertir.textContent = `Attention : ton navigateur dessine le jeu sans ta carte graphique (l'accélération graphique est coupée, ou ta carte graphique refusée). Il tournera, mais très lentement. ${ACCELERATION}`;
    avertir.hidden = false;
  }
  import('./quart.js');
} else {
  montrerImpossible(IMPOSSIBLE[capacites.raison] ?? IMPOSSIBLE.webgl2);
}

// L'accueil devient le message : ce qui ne va pas, et quoi faire
function montrerImpossible({ titre, pourquoi, faire }) {
  const carte = document.querySelector('#accueil .carte');
  const element = (nom, texte, classe) => {
    const e = document.createElement(nom);
    if (texte) e.textContent = texte;
    if (classe) e.className = classe;
    return e;
  };
  const liste = element('ul', null, 'que-faire');
  for (const f of faire) liste.append(element('li', f));
  const retour = element('a', 'Retour au site', 'retour');
  retour.href = './index.html';
  carte.replaceChildren(
    element('h1', 'Quart de nuit'),
    element('p', titre, 'sous-titre impossible'),
    element('p', pourquoi),
    liste,
    retour,
  );
  document.title = `${titre} · Quart de nuit`;
}
