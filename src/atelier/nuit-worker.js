// L'atelier de la tempête fait jouer la nuit ici, dans un fil de calcul à part (un
// « worker ») : la page reste fluide pendant la minute que dure le calcul.
import { jouerLaNuit } from '../jeu/marins.js';

self.onmessage = ({ data }) => {
  const debut = performance.now();
  const resultats = jouerLaNuit({
    ...data,
    surProgres: (nuit) => self.postMessage({ type: 'progres', heure: nuit.heure }),
  });
  // (l'objet Nuit lui-même ne peut pas passer d'un fil à l'autre : on n'envoie que ses chiffres)
  self.postMessage({
    type: 'fin',
    duree: (performance.now() - debut) / 1000,
    resultats: resultats.map(({ nuit, ...r }) => r),
  });
};
