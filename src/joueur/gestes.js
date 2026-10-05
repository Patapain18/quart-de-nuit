// Les gestes du bord : ce que l'on peut faire en regardant une chose et en appuyant sur E.
//
// Chaque geste a une place sur le bateau (repère du bateau), une portée (on doit être à
// moins d'un pas ou deux), et une ou deux actions :
//  - E : l'action principale (border, prendre la barre, prendre un ris…)
//  - Maj + E : l'action inverse (choquer, larguer un ris…)
// Une action est soit instantanée (un appui), soit « maintenue » (tant qu'on tient la
// touche : border un winch, pomper), soit « longue » (il faut tenir un certain temps
// pour qu'elle aboutisse : prendre un ris demande 4 secondes au pied du mât).
import { Vector3 } from 'three';
import { COCKPIT, MAT, zDe, hauteurPont, hauteurRouf, hauteurLivet } from '../bateau/forme.js';

// jeu : l'objet qui sait agir (voir jeu.js) ; interieur : pour placer radio et tableau
export function creerGestes(jeu, interieur) {
  const yHiloire = hauteurPont(0.27, COCKPIT.demiLargeur) + COCKPIT.hiloire;
  const winch = (cote) => ({
    id: cote > 0 ? 'winch-tribord' : 'winch-babord',
    point: new Vector3(cote * (COCKPIT.demiLargeur + 0.04), yHiloire + 0.1, zDe(0.27)),
    rayon: 0.2,
    titre: () => `Winch ${cote > 0 ? 'tribord' : 'bâbord'} : écoute de foc`,
    principal: {
      texte: 'border', maintenir: true,
      faire: (dt) => jeu.borderFoc(cote, -dt),
    },
    secondaire: {
      texte: 'choquer', maintenir: true,
      faire: (dt) => jeu.borderFoc(cote, dt),
    },
  });
  return [
    {
      id: 'barre',
      point: new Vector3(0, 1.0, 2.47),
      rayon: 0.32,
      titre: () => 'La barre',
      principal: { texte: 'prendre la barre', faire: () => jeu.prendreBarre() },
    },
    winch(1),
    winch(-1),
    {
      id: 'ecoute-gv',
      point: new Vector3(0, hauteurPont(0.03, 0) + 0.12, zDe(0.03)),
      rayon: 0.3,
      titre: () => 'Écoute de grand-voile',
      principal: { texte: 'border', maintenir: true, faire: (dt) => jeu.borderGrandVoile(-dt) },
      secondaire: { texte: 'choquer', maintenir: true, faire: (dt) => jeu.borderGrandVoile(dt) },
    },
    {
      id: 'enrouleur',
      point: new Vector3(0.55, hauteurRouf(0.335, 0.55) + 0.12, zDe(0.335)),
      rayon: 0.2,
      titre: () => 'Bosse d\'enrouleur (le foc)',
      principal: { texte: 'enrouler le foc', maintenir: true, faire: (dt) => jeu.enrouler(-dt) },
      secondaire: { texte: 'dérouler', maintenir: true, faire: (dt) => jeu.enrouler(dt) },
    },
    {
      id: 'mat',
      point: new Vector3(0, hauteurRouf(MAT.u, 0) + 0.55, zDe(MAT.u) + 0.12),
      rayon: 0.35,
      titre: () => 'Pied de mât : les bosses de ris, la drisse de grand-voile',
      // après deux ris, on peut encore affaler la grand-voile (la descendre entièrement et
      // la ferler sur la bôme) : par très gros temps, on fuit sous un bout de foc
      principal: {
        texte: () => (jeu.physique.ris >= 2 ? 'affaler la grand-voile' : 'prendre un ris'),
        duree: 4,
        possible: () => jeu.autorise('ris') && (jeu.physique.ris < 2 || (jeu.physique.ris === 2 && jeu.autorise('affaler'))),
        refus: () => (!jeu.autorise('ris') ? 'Jos te montrera comment prendre un ris cet après-midi'
          : jeu.physique.ris >= 3 ? 'La grand-voile est déjà affalée'
            : 'Deux ris : la grand-voile est au plus petit. (On ne l\'affale que dans la tempête)'),
        faire: () => jeu.prendreRis(1),
      },
      secondaire: {
        texte: () => (jeu.physique.ris >= 3 ? 'rehisser la grand-voile (2 ris)' : 'larguer un ris'),
        duree: 3,
        possible: () => jeu.physique.ris > 0 && !(jeu.physique.ris >= 3 && jeu.physique.grandVoileDechiree),
        refus: () => (jeu.physique.grandVoileDechiree ? 'La grand-voile est déchirée : elle reste affalée' : 'Pas de ris à larguer'),
        faire: () => jeu.prendreRis(-1),
      },
    },
    {
      // tout à l'avant, au pied de l'étai : le tambour de l'enrouleur et le point d'écoute
      // du foc roulé (pour passer une nouvelle écoute quand elle a cassé)
      id: 'etai',
      point: new Vector3(0, hauteurLivet(0.965) + 0.3, zDe(0.965)),
      rayon: 0.3,
      titre: () => 'Pied de l\'étai : l\'enrouleur du foc',
      principal: {
        texte: 'passer une nouvelle écoute de foc',
        duree: 6,
        possible: () => jeu.nuit?.avaries.ecouteFoc === 'cassee' && jeu.physique.deroule < 0.05 && jeu.marin.attache,
        refus: () => (jeu.nuit?.avaries.ecouteFoc !== 'cassee' ? 'L\'écoute de foc est en bon état'
          : jeu.physique.deroule >= 0.05 ? 'Roule d\'abord le foc entièrement : il bat trop pour l\'attraper'
            : 'Accroche d\'abord ton harnais (X) : tout à l\'avant, une vague t\'emporterait'),
        faire: () => jeu.reparer('ecouteFoc'),
      },
    },
    {
      id: 'descente',
      point: new Vector3(0, 1.0, zDe(0.31) + 0.04),
      rayon: 0.32,
      titre: () => 'La descente',
      principal: { texte: () => (jeu.bateau.descenteOuverte ? 'mettre les planches (fermer)' : 'enlever les planches (ouvrir)'), faire: () => jeu.basculerDescente() },
    },
    {
      id: 'pompe',
      point: new Vector3(-COCKPIT.demiLargeurPuits, COCKPIT.plancher + 0.25, zDe(0.12)),
      rayon: 0.2,
      titre: () => 'Pompe de cale',
      principal: { texte: 'pomper', maintenir: true, faire: (dt) => jeu.pomper(dt) },
    },
    {
      id: 'radio',
      point: interieur.positionRadio.clone(),
      rayon: 0.16,
      titre: () => `Radio VHF (canal ${jeu.radio.canal})`,
      principal: { texte: 'écouter la météo', faire: () => jeu.radio.bulletin(jeu.meteo) },
      // pendant la journée et la nuit, on appelle Jos ; quand un cargo arrive sur nous, on
      // l'appelle, lui, sur le canal 16
      secondaire: {
        texte: () => (jeu.nuit?.cargo?.etat === 'route' ? 'appeler le cargo (canal 16)' : jeu.journee || jeu.nuit ? 'appeler Jos' : 'appeler'),
        faire: () => (jeu.journee || jeu.nuit ? jeu.appelerJos() : jeu.radio.appeler()),
      },
    },
    {
      id: 'cire',
      point: interieur.positionCire.clone(),
      rayon: 0.3,
      titre: () => 'Ton ciré et ton gilet de sauvetage',
      principal: { texte: () => (jeu.etat.gilet ? 'les ôter' : 'les enfiler'), faire: () => jeu.basculerGilet() },
    },
    // le radar : l'écran de la table à cartes, et son répétiteur dans le cockpit
    ...[['radar', jeu.bateau.radar.positionPrincipal, 0.14, 'Radar (table à cartes)'], ['radar-cockpit', jeu.bateau.radar.positionRepetiteur, 0.12, 'Radar (répétiteur du cockpit)']]
      .map(([id, point, rayon, nom]) => ({
        id,
        point: point.clone(),
        rayon,
        titre: () => `${nom} : ${String(jeu.bateau.radar.milles).replace('.', ',')} milles`,
        principal: { texte: 'changer de portée', faire: () => jeu.radarPortee() },
        secondaire: { texte: () => (jeu.bateau.radar.filtreMer ? 'couper le filtre de mer' : 'remettre le filtre de mer'), faire: () => jeu.radarFiltre() },
      })),
    {
      id: 'tableau',
      point: interieur.positionTableau.clone(),
      rayon: 0.16,
      titre: () => 'Tableau électrique',
      // (le pilote en panne : son disjoncteur a sauté, on le réarme ici)
      principal: {
        texte: () => (jeu.nuit?.avaries.pilote === 'panne' ? 'réarmer le disjoncteur du pilote'
          : jeu.etat.feux ? 'éteindre les feux de navigation' : 'allumer les feux de navigation'),
        faire: () => (jeu.nuit?.avaries.pilote === 'panne' ? jeu.reparer('pilote') : jeu.basculerFeux()),
      },
      secondaire: { texte: 'éclairage du carré', faire: () => jeu.basculerEclairage() },
    },
  ];
}

// Le geste que l'on regarde : le plus proche dont la boule est traversée par le regard
export function gesteVise(gestes, oeil, direction, portee = 1.9) {
  let meilleur = null;
  let tMin = Infinity;
  const v = new Vector3();
  for (const g of gestes) {
    v.subVectors(g.point, oeil);
    const t = v.dot(direction);
    if (t < 0.05 || t > portee) continue;
    const ecart = v.addScaledVector(direction, -t).length();
    if (ecart < g.rayon && t < tMin) {
      tMin = t;
      meilleur = g;
    }
  }
  return meilleur;
}
