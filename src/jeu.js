// Quart de nuit — le jeu (étapes 2 à 5 : naviguer, vivre à bord, la journée
// d'apprentissage avec Jos à la radio, la nuit de tempête).
//
// Deux façons d'être à bord :
//  - À LA BARRE, assis au vent : Q/D la barre, Z/S la grand-voile, A/E le foc,
//    C/V l'enrouleur, P le pilote automatique, Espace pour se lever ;
//  - À PIED : Z Q S D pour marcher, la souris pour regarder, E pour agir sur ce que l'on
//    regarde (Maj + E : l'action inverse), Maj pour se tenir, C pour s'accroupir,
//    X pour accrocher son harnais à la ligne de vie.
// Le voilier est mené par la vraie physique (physique/voilier.js) ; le marin vit dans le
// repère du bateau (joueur/marin.js) : il sent le bateau bouger, peut glisser, se faire
// frapper par la bôme pendant un empannage, et passer par-dessus bord s'il n'est pas
// attaché quand le bateau se couche.
import * as THREE from 'three';
import { Monde3D, QUALITES } from './rendu/monde3d.js';
import { AMBIANCES, etatMeteo } from './monde/meteo.js';
import { Vent } from './monde/vent.js';
import { Grains } from './monde/grains.js';
import { Foudre, REGLAGES_FOUDRE } from './monde/foudre.js';
import { Barometre, pressionDuJour, pressionDuTemps, tendance, tendanceRecente, tendanceEnMots, fleche } from './monde/pression.js';
import { PhysiqueVoilier } from './physique/voilier.js';
import { reglerAutomatiquement, etatReglage } from './physique/regleur.js';
import { Commandes, TOUCHES } from './jeu/commandes.js';
import { Bateau } from './bateau/bateau.js';
import { Audio } from './son/audio.js';
import { Marin } from './joueur/marin.js';
import { construireEncombrement } from './joueur/encombrement.js';
import { BarreAssistee } from './jeu/barre-assistee.js';
import { Compas } from './jeu/compas.js';
import { ouvrirDescente } from './joueur/pont.js';
import { creerGestes, gesteVise } from './joueur/gestes.js';
import { Radio } from './jeu/radio.js';
import { Journee, meteoDuJour, heureEnTexte, JOS, NOM_BATEAU } from './jeu/journee.js';
import { LECONS } from './jeu/lecons.js';
import { Nuit, DIFFICULTES, EAU, HEURE_LEVER, directionRelative } from './jeu/nuit.js';
import { positionCrete } from './mer/scelerate.js';
import { Apparitions } from './rendu/apparitions.js';
import { lireOptions, changerOptions, quandOptionsChangent } from './jeu/options.js';
import { Bouees } from './rendu/bouees.js';
import { distanceALaTerre } from './rendu/cote.js';
import { COCKPIT, MAT, TIMONERIE, zDe } from './bateau/forme.js';
import { SIEGE, YEUX_POSTE } from './bateau/interieur-timonerie.js';

const parametres = new URLSearchParams(location.search);
const canvas = document.getElementById('scene');
const monde = new Monde3D(canvas);
// (l'accueil, sur le coucher de soleil menaçant : la nuit qui vient)
let idAmbiance = AMBIANCES[parametres.get('ambiance')] ? parametres.get('ambiance') : 'coucher-menacant';
let meteo = etatMeteo(AMBIANCES[idAmbiance]);
monde.regler(meteo);
const bateau = monde.ajouterBateau();
const physique = new PhysiqueVoilier();
const vent = new Vent(5);
// (ses risées, la mer les dessine)
monde.etatRisees = vent.risees;
// les grains (monde/grains.js) : la nuit, ceux de la nuit (jeu/nuit.js) ; le jour et sur
// l'écran d'accueil, ceux du décor, qui vivent ici
const grainsDuDecor = new Grains(13);
const grainsActifs = () => nuit?.grains ?? grainsDuDecor;
const _grains = new THREE.Vector3();
// (ce que les grains font là où est le bateau : la pluie, leur vent, l'ombre de leur nuage…)
let ici = grainsDuDecor.mesurer(0, 0, {});
// la foudre (monde/foudre.js) : elle part des nuages des grains — la nuit, ceux de la nuit ;
// le jour et sur l'écran d'accueil, ceux du décor
const foudreDuDecor = new Foudre(17);
const foudreActive = () => nuit?.foudre ?? foudreDuDecor;
// le baromètre du bord (monde/pression.js) : son aiguille, et l'aiguille témoin qu'on cale
const barometre = new Barometre();
const commandes = new Commandes(canvas);
const audio = new Audio();
// (les vrais enregistrements se chargent en arrière-plan dès maintenant ; le son ne
// démarre qu'au premier clic, comme l'exigent les navigateurs)
audio.precharger(`${import.meta.env.BASE_URL}sons/`);
const marin = new Marin();
// (ce qui est dur à bord, tiré du modèle 3D : le marin n'y entre pas, la caméra non plus)
marin.encombrement = construireEncombrement(bateau);
// (jeu.html?perf : le compteur de fluidité, en haut à gauche)
if (parametres.has('perf')) import('./atelier/fluidite.js').then((m) => m.afficherFluidite(monde));
// (jeu.html?peur : l'atelier de la peur, à droite)
if (parametres.has('peur')) import('./atelier/atelier-peur.js').then((m) => m.ouvrirAtelierPeur(window.__jeu));
// (jeu.html?trombe=fil : une autre trombe que celle du jeu — voir l'atelier de la trombe)
if (parametres.has('trombe')) monde.trombe.choisirVariante(parametres.get('trombe'));
const bouees = new Bouees(monde.scene, monde.houle);
// (la peur : ce qu'on voit du coin de l'œil — jeu/peur.js décide, ceci le montre)
const apparitions = new Apparitions(monde.scene, bateau, monde.houle, monde.eau);
monde.aPrecompiler.push(...apparitions.objets);
let journee = null; // la journée d'apprentissage (null : navigation libre)
let nuit = null; // la nuit de tempête
let journeeFaite = null; // la journée, une fois finie (pour le carnet : ses réflexes, son journal)
let options = lireOptions();
let difficulte = options.difficulte;

function mettreALeau() {
  physique.placer(0, 0, (meteo.directionVent + 60) % 360, monde.houle);
  physique.vitesse.copy(physique.avant).multiplyScalar(2.5);
  physique.ris = 0;
  physique.deroule = 1;
}
mettreALeau();

// ---------- État du jeu ----------
const etat = {
  mode: 'accueil', // accueil, barre, pied, pause, fin
  avantPause: 'barre',
  regleurAuto: false,
  lampe: false,
  aide: true,
  orbite: 0,
  pilote: null,
  feux: monde.ecl.nuit > 0.5,
  eclairage: 'eteint',
  geste: null,
  action: null, // { geste, cle, progression }
  eauCale: 0, // litres (la tempête en apportera, étape 5)
  attenteClaque: 0,
  dejaEmbarque: false,
  bordage: 0,
  gilet: false, // ciré et gilet de sauvetage enfilés
  lampeEssayee: false,
  evenements: new Set(), // ce que le joueur vient de faire (pour les leçons)
  majCiel: 0,
  majMer: 0,
  carnet: false,
};
const siege = { x: -0.76 }; // à la barre, assis au vent (au bord du banc)

// ---------- Ce que le jeu sait faire (appelé par les gestes) ----------
const VITESSE_ECOUTE = 0.45;
// Ce que Jos n'a pas encore appris : le jeu le dit gentiment
const PAS_ENCORE = {
  grandVoile: 'La grand-voile, c\'est la leçon 3 : pour l\'instant, le réglage automatique s\'en charge',
  regleur: 'Garde le réglage automatique pour l\'instant : Jos te dira quand le couper',
  foc: 'Le foc, c\'est la leçon 4',
  enrouleur: 'Le foc, c\'est la leçon 4',
};
let dernierRefus = 0;
function refuser(nom) {
  if (performance.now() - dernierRefus < 3000) return;
  dernierRefus = performance.now();
  afficherMessage(PAS_ENCORE[nom] ?? 'Pas encore : Jos te le montrera');
}
const jeu = {
  physique, bateau, etat, meteo, marin, barometre,
  get journee() { return journee; },
  get nuit() { return nuit; },
  autorise(nom) { return !journee || journee.autorise(nom); },
  basculerGilet() {
    etat.gilet = !etat.gilet;
    bateau.interieur.cire.visible = !etat.gilet;
    afficherMessage(etat.gilet ? 'Ciré et gilet de sauvetage enfilés' : 'Ciré et gilet raccrochés');
  },
  // pendant la journée, on peut appeler Jos à la radio : il redit ce qu'il faut faire ;
  // la nuit, il donne des nouvelles (ou le conseil le plus urgent), et quand un cargo
  // arrive, c'est lui qu'on appelle, sur le 16
  appelerJos() {
    if (nuit) {
      if (nuit.cargo?.etat === 'route') nuit.appelerCargo(contexteNuit(0));
      else nuit.appelerJos(contexteNuit(0));
      return;
    }
    if (!journee) return;
    const objectif = journee.objectif.replace(/\s*\([^)]*\)/g, '');
    journee.dire([objectif
      ? `Ici ${JOS}, je te reçois. Pour l'instant : ${objectif.charAt(0).toLowerCase()}${objectif.slice(1)}.`
      : `Ici ${JOS}, je te reçois cinq sur cinq. Tout va bien à bord ?`]);
  },
  // la radio : le bulletin de Kervalen Radio (le vent, la mer, et la pression, avec ce
  // qu'elle annonce)
  ecouterMeteo() {
    const h = heureIci();
    jeu.radio.bulletin(meteo, monde.houle.hauteurSignificative, { pression: pressionIci(), tendance: h === null ? null : tendance(h) });
  },
  // le baromètre : une tape sur le verre (l'aiguille colle un peu), puis on cale l'aiguille
  // témoin sur la noire, une fois posée — on verra plus tard de combien elle a bougé
  lireBarometre() {
    barometre.tapoter();
    etat.calerTemoin = 1.2;
    const h = heureIci();
    const avant = barometre.temoin;
    const p = pressionIci();
    const dp = h === null ? null : tendance(h);
    const nombre = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1).replace('.', ',')}`;
    const depuis = barometre.calee !== null && avant !== null && Math.abs(p - avant) >= 0.5 ? ` ; ${nombre(p - avant)} hPa depuis l'aiguille témoin` : '';
    afficherMessage(`Baromètre : ${Math.round(p)} hPa${dp === null ? '' : `, ${tendanceEnMots(dp)} (${nombre(dp)} en 3 h)`}${depuis}`);
  },
  titreBarometre() {
    const t = barometre.calee !== null ? ` · aiguille témoin ${Math.round(barometre.temoin)}` : '';
    return `Baromètre : ${Math.round(barometre.aiguille ?? pressionIci())} hPa${t}`;
  },
  // le radar : la portée suivante, le filtre de mer
  radarPortee() {
    bateau.radar.changerPortee(1);
    afficherMessage(`Radar : portée ${String(bateau.radar.milles).replace('.', ',')} milles`);
  },
  radarFiltre() {
    bateau.radar.filtreMer = !bateau.radar.filtreMer;
    afficherMessage(bateau.radar.filtreMer ? 'Radar : filtre de mer (le fouillis des vagues proches est atténué)' : 'Radar : filtre de mer coupé (attention au fouillis près du bateau)');
  },
  // le traceur : l'échelle de la carte (0,75 à 12 milles)
  zoomTraceur(sens) {
    const e = bateau.electronique;
    const echelles = [0.75, 1.5, 3, 6, 12];
    const k = Math.max(0, Math.min(echelles.length - 1, echelles.indexOf(e.milles) + sens));
    e.milles = echelles[k];
    e.age = 1;
    afficherMessage(`Traceur : ${String(e.milles).replace('.', ',')} milles`);
  },
  // s'asseoir au poste de pilotage de la timonerie : à l'abri, on règle le cap du pilote
  allerAuPoste() {
    etat.mode = 'poste';
    etat.action = null;
    marin.lacet = 0;
    marin.site = -0.18;
    afficherMessage(etat.pilote !== null
      ? `Au poste : le pilote tient le ${String(etat.pilote).padStart(3, '0')}° (Q / D : 1° de plus ou de moins, Maj : 10°)`
      : 'Au poste : enclenche le pilote (P), puis Q / D pour régler son cap');
    majAide();
  },
  prendreBarre() {
    etat.mode = 'barre';
    etat.action = null;
    barreAssistee.reprendre(physique.mesures.cap);
    // (assis à la barre, on regarde devant soi, pas la barre que l'on vient de saisir)
    marin.lacet = 0;
    marin.site = -0.12;
    afficherMessage('Tu as la barre (Espace pour te lever)');
    majAide();
  },
  borderFoc(cote, sens) {
    if (!jeu.autorise('foc')) { refuser('foc'); etat.action = null; return; }
    // seul le winch sous le vent travaille ; celui au vent tient l'écoute « molle »
    const coteFoc = physique.angleFoc >= 0 ? 1 : -1;
    if (cote !== coteFoc) {
      afficherMessage('Cette écoute est au vent : elle ne travaille pas. Va au winch de l\'autre bord.');
      etat.action = null;
      return;
    }
    physique.ecouteFoc = THREE.MathUtils.clamp(physique.ecouteFoc + sens * VITESSE_ECOUTE, 0.17, 1.2);
    if (sens < 0) {
      etat.bordage = 1;
      etat.evenements.add('winch-borde');
    }
  },
  borderGrandVoile(sens) {
    if (!jeu.autorise('grandVoile')) { refuser('grandVoile'); etat.action = null; return; }
    physique.ecouteGV = THREE.MathUtils.clamp(physique.ecouteGV + sens * VITESSE_ECOUTE, 0.02, 1.45);
    if (sens < 0) etat.bordage = 1;
  },
  enrouler(sens) {
    if (!jeu.autorise('enrouleur')) { refuser('enrouleur'); etat.action = null; return; }
    if (sens > 0 && physique.focDechire) {
      if (performance.now() - dernierRefus > 3000) afficherMessage('Le foc est déchiré : il reste roulé');
      dernierRefus = performance.now();
      return;
    }
    physique.deroule = THREE.MathUtils.clamp(physique.deroule + sens * 0.22, 0, 1);
    etat.bordage = sens < 0 ? 1 : 0.4;
  },
  // un ris de plus (n = 1) ou de moins (n = -1) ; le « troisième », c'est la grand-voile
  // affalée, roulée sur la bôme (on la ferle)
  prendreRis(n) {
    physique.ris = THREE.MathUtils.clamp(physique.ris + n, 0, 3);
    afficherMessage(n > 0
      ? (physique.ris === 3 ? 'Grand-voile affalée et ferlée sur la bôme' : `Ris pris : ${physique.ris} ris dans la grand-voile`)
      : physique.ris === 0 ? 'Grand-voile haute, sans ris' : physique.ris === 2 ? 'Grand-voile rehissée, avec deux ris' : `Un ris largué : il en reste ${physique.ris}`);
  },
  // la nuit : passer une nouvelle écoute de foc (à l'avant), réarmer le pilote (au tableau)
  reparer(nom) {
    if (nuit?.reparer(nom, contexteNuit(0))) {
      afficherMessage(nom === 'pilote' ? 'Disjoncteur réarmé : le pilote automatique remarche (P)' : 'Nouvelle écoute de foc passée : tu peux dérouler le foc');
      audio.clic?.();
    }
  },
  basculerDescente() {
    bateau.ouvrirDescente(!bateau.descenteOuverte);
    ouvrirDescente(bateau.descenteOuverte);
    audio.clic?.();
    afficherMessage(bateau.descenteOuverte ? 'Porte de la timonerie ouverte' : 'Porte fermée : l\'eau du cockpit n\'entrera pas à l\'intérieur');
  },
  pomper(dt) {
    const avant = Math.floor((etat.phasePompe ?? 0) / Math.PI);
    etat.phasePompe = (etat.phasePompe ?? 0) + dt * 5;
    if (Math.floor(etat.phasePompe / Math.PI) !== avant) {
      // ~2,5 litres par coup de pompe (un grand levier, une pompe à membrane) : 4 L/s
      const litres = nuit ? nuit.pomper(2.5) : Math.min(etat.eauCale, 2.5);
      etat.eauCale = Math.max(0, etat.eauCale - litres);
      audio.coupDePompe(litres > 0.1);
    }
    bateau.pomper(Math.sin(etat.phasePompe) * 0.7);
  },
  basculerFeux() {
    etat.feux = !etat.feux;
    afficherMessage(etat.feux ? 'Feux de navigation allumés' : 'Feux de navigation éteints');
  },
  basculerEclairage() {
    etat.eclairage = { eteint: 'blanc', blanc: 'rouge', rouge: 'eteint' }[etat.eclairage];
    afficherMessage({ blanc: 'Éclairage du carré : blanc', rouge: 'Éclairage du carré : rouge (pour garder sa vision de nuit)', eteint: 'Éclairage du carré éteint' }[etat.eclairage]);
  },
};
const gestes = creerGestes(jeu, bateau.interieur);
const sousTitres = document.getElementById('sous-titres');
jeu.radio = new Radio({
  // (sans la voix de Jos, les sous-titres restent toujours affichés)
  afficher: (t) => { sousTitres.textContent = t; sousTitres.hidden = !t || (options.voix && !options.sousTitres); },
  audio,
  ecran: bateau.interieur.radio,
});
const bulletinRadio = jeu.radio.bulletin.bind(jeu.radio);
jeu.radio.bulletin = (m) => bulletinRadio(m, monde.houle.hauteurSignificative);

// ---------- Les options (src/jeu/options.js) ----------
function appliquerOptions(o, changements = o) {
  if ('qualite' in changements) monde.appliquerQualite(o.qualite);
  monde.camera.fov = o.champ;
  monde.camera.updateProjectionMatrix();
  audio.regler(o.volume);
  jeu.radio.muette = !o.voix;
  if (!o.voix || o.sousTitres) sousTitres.hidden = !sousTitres.textContent;
  else sousTitres.hidden = true;
  etat.aide = o.aide;
  document.getElementById('aide-touches').classList.toggle('cache', !o.aide);
  monde.gouttesActives = o.gouttes;
  monde.eclairsDoux = !o.clignotements;
  // (la nuit d'orage : noir d'encre, ou un peu moins pour un écran peu lumineux)
  monde.noirMax = { encre: 1, 'tres-sombre': 0.8, sombre: 0.6 }[o.nuit] ?? 1;
  if ('nuit' in changements && monde.meteo) monde.regler(monde.meteo, { recalculerMer: false, brusque: false });
  difficulte = o.difficulte;
  majDifficultes();
  majFenetreOptions();
}
quandOptionsChangent((o, changements) => {
  options = o;
  appliquerOptions(o, changements);
});

// ---------- À la barre ----------
const VITESSE_BARRE = 0.9;
const BARRE_MAX = 0.6;
// la barre assistée (voir jeu/barre-assistee.js) : Q et D donnent le cap, elle le tient
const barreAssistee = new BarreAssistee();
function tenirLaBarre(dt) {
  const axe = commandes.axe('barreGauche', 'barreDroite');
  if (axe !== 0 && etat.pilote !== null) {
    etat.pilote = null;
    barreAssistee.reprendre(physique.mesures.cap);
    afficherMessage('Pilote automatique débrayé : tu as la barre');
  }
  if (options.barreAssistee) {
    if (etat.pilote === null) barreAssistee.maj(dt, axe, physique);
  } else if (axe !== 0) {
    physique.barre = THREE.MathUtils.clamp(physique.barre + axe * VITESSE_BARRE * dt, -BARRE_MAX, BARRE_MAX);
  }
  // (pendant la journée, les écoutes et l'enrouleur viennent au fil des leçons)
  const permis = (nom, valeur) => {
    if (valeur && !jeu.autorise(nom)) {
      refuser(nom);
      return 0;
    }
    return valeur;
  };
  const gv = permis('grandVoile', commandes.axe('borderGV', 'choquerGV'));
  physique.ecouteGV = THREE.MathUtils.clamp(physique.ecouteGV + gv * VITESSE_ECOUTE * dt, 0.02, 1.45);
  const foc = permis('foc', commandes.axe('borderFoc', 'choquerFoc'));
  physique.ecouteFoc = THREE.MathUtils.clamp(physique.ecouteFoc + foc * VITESSE_ECOUTE * dt, 0.17, 1.2);
  const enrouleur = permis('enrouleur', commandes.axe('enrouler', 'derouler'));
  if (enrouleur) jeu.enrouler(enrouleur * dt);
  etat.bordage = Math.max(etat.bordage, gv < 0 ? 1 : 0, foc < 0 ? 1 : 0);
}

// Le pilote automatique (un vérin qui pousse la barre pour garder le cap) ; sinon, sans
// personne à la barre, elle revient au milieu et le bateau finit par lofer
function piloteOuBarreLibre(dt, tenue) {
  if (etat.pilote !== null) {
    const erreur = ((physique.mesures.cap - etat.pilote + 540) % 360) - 180;
    // (si une vague a fait reculer le bateau, le safran agit à l'envers : le pilote aussi)
    const sens = physique.vitesse.dot(physique.avant) < -0.2 ? -1 : 1;
    const voulu = sens * THREE.MathUtils.clamp(-erreur * 0.035 + physique.rotation.y * 1.6, -0.45, 0.45);
    physique.barre += THREE.MathUtils.clamp(voulu - physique.barre, -0.6 * dt, 0.6 * dt);
  } else if (!tenue) {
    physique.barre -= Math.sign(physique.barre) * Math.min(Math.abs(physique.barre), 0.5 * dt);
  }
}

// Les touches que l'on vient d'enfoncer
function touchesAppuyees() {
  for (const { code, maj } of commandes.lireAppuis()) {
    if (code === TOUCHES.lampe.code) {
      etat.lampe = !etat.lampe;
      if (etat.lampe) etat.lampeEssayee = true;
      afficherMessage(etat.lampe ? 'Lampe frontale allumée' : 'Lampe frontale éteinte');
    } else if (code === TOUCHES.carnet.code) {
      basculerCarnet();
    } else if (code === TOUCHES.passerPhrase.code) {
      jeu.radio.passerPhrase();
    } else if (code === TOUCHES.regleur.code) {
      if (!jeu.autorise('regleur')) {
        refuser('regleur');
        continue;
      }
      etat.regleurAuto = !etat.regleurAuto;
      afficherMessage(etat.regleurAuto ? 'Réglage automatique des voiles : activé' : 'Réglage automatique : désactivé, à toi les écoutes');
    } else if (code === TOUCHES.pilote.code) {
      if (etat.pilote === null && nuit?.avaries.pilote === 'panne') {
        afficherMessage('Le pilote est en panne : réarme son disjoncteur au tableau électrique (sur la console de la timonerie)');
        continue;
      }
      etat.pilote = etat.pilote === null ? Math.round(physique.mesures.cap) : null;
      if (etat.pilote === null) barreAssistee.reprendre(physique.mesures.cap);
      afficherMessage(etat.pilote !== null ? `Pilote automatique : il tient le cap ${String(etat.pilote).padStart(3, '0')}°` : 'Pilote automatique débrayé');
    } else if (code === TOUCHES.aide.code) {
      changerOptions({ aide: !etat.aide });
    } else if (etat.mode === 'poste' && (code === TOUCHES.barreGauche.code || code === TOUCHES.barreDroite.code)) {
      reglerPilote((code === TOUCHES.barreDroite.code ? 1 : -1) * (maj ? 10 : 1));
    } else if (etat.mode === 'poste' && code === TOUCHES.lever.code) {
      quitterLePoste();
    } else if (etat.mode === 'barre' && code === TOUCHES.lever.code) {
      seLever();
    } else if (etat.mode === 'barre' && code === TOUCHES.ris.code) {
      afficherMessage('Pour prendre un ris, va au pied du mât (Espace pour te lever)');
    } else if ((etat.mode === 'pied' || etat.mode === 'barre') && code === TOUCHES.harnais.code) {
      basculerHarnais();
    } else if ((etat.mode === 'pied' || etat.mode === 'poste') && code === TOUCHES.agir.code) {
      commencerAction(maj ? 'secondaire' : 'principal');
    }
  }
}

// Au poste de pilotage : le cap du pilote, degré par degré (ou par dizaines)
function reglerPilote(ecart) {
  if (etat.pilote === null) {
    afficherMessage('Le pilote n\'est pas enclenché : appuie sur P');
    return;
  }
  etat.pilote = (etat.pilote + ecart + 360) % 360;
  audio.clic?.();
  afficherMessage(`Pilote : cap ${String(Math.round(etat.pilote)).padStart(3, '0')}°`);
}
function quitterLePoste() {
  etat.mode = 'pied';
  // debout, à côté du siège (à bâbord : dans le passage entre la porte et l'escalier)
  marin.placer(SIEGE.x - SIEGE.demiLargeur - 0.2, TIMONERIE.plancher, SIEGE.z + 0.05);
  majAide();
}

function seLever() {
  etat.mode = 'pied';
  // debout sur le plancher du cockpit, à côté de la barre
  marin.placer(siege.x * 0.5, COCKPIT.plancher, zDe(0.17));
  if (etat.pilote === null) afficherMessage('Personne à la barre : sans le pilote (P), le bateau va lofer');
  majAide();
}

function basculerHarnais() {
  if (etat.mode === 'pied' && !marin.dehors) {
    afficherMessage('Dans la cabine, pas besoin du harnais');
    return;
  }
  marin.attache = !marin.attache;
  afficherMessage(marin.attache ? 'Harnais accroché à la ligne de vie' : 'Harnais décroché : attention à toi');
}

// ---------- Les gestes (E et Maj + E sur ce que l'on regarde) ----------
// (la porte fermée n'est pas dans l'encombrement — elle bouge — mais on ne passe pas la
// main au travers : le regard la traverse-t-il avant d'atteindre la chose, à t mètres ?)
function porteFermeeEntre(oeil, direction, t, g) {
  if (bateau.descenteOuverte || g.id === 'descente' || Math.abs(direction.z) < 1e-6) return false;
  const s = (TIMONERIE.zArriere - oeil.z) / direction.z;
  if (s <= 0 || s >= t) return false;
  const y = oeil.y + direction.y * s;
  return Math.abs(oeil.x + direction.x * s) < TIMONERIE.porte.demiLargeur && y > COCKPIT.plancher && y < TIMONERIE.porte.haut;
}
function commencerAction(cle) {
  const g = etat.geste;
  if (!g || !g[cle]) return;
  const a = g[cle];
  if (a.possible && !a.possible()) {
    afficherMessage(a.refus?.() ?? (cle === 'principal' ? 'Ce n\'est pas possible maintenant' : 'Rien à faire ici'));
    return;
  }
  if (!a.maintenir && !a.duree) {
    a.faire(0);
    return;
  }
  etat.action = { geste: g, cle, progression: 0 };
}

function poursuivreAction(dt) {
  const act = etat.action;
  if (!act) return;
  const a = act.geste[act.cle];
  const tenue = commandes.enfoncee('agir') && (act.cle === 'secondaire') === commandes.maj;
  if (!tenue || etat.geste !== act.geste) {
    etat.action = null;
    return;
  }
  if (a.maintenir) {
    a.faire(dt);
  } else if (a.duree) {
    act.progression += dt / a.duree;
    etat.bordage = Math.max(etat.bordage, 0.6); // le bruit des bosses et des drisses
    if (act.progression >= 1) {
      a.faire(0);
      etat.action = null;
    }
  }
}

// ---------- La pesanteur ressentie par le marin ----------
// accélération d'un point du bateau = accélération du centre + effets de la rotation
const pesanteur = new THREE.Vector3(0, -9.81, 0);
const avantPhys = { v: new THREE.Vector3(), w: new THREE.Vector3(), pret: false };
function sentirLeBateau(dt) {
  const q = physique.orientation;
  const r = marin.position.clone().sub(physique.centreGravite).applyQuaternion(q);
  const a = new THREE.Vector3();
  if (avantPhys.pret && dt > 0) {
    a.subVectors(physique.vitesse, avantPhys.v).divideScalar(dt);
    const alpha = new THREE.Vector3().subVectors(physique.rotation, avantPhys.w).divideScalar(dt);
    a.add(alpha.cross(r.clone()));
    const w = physique.rotation;
    a.add(w.clone().cross(w.clone().cross(r)));
  }
  avantPhys.v.copy(physique.vitesse);
  avantPhys.w.copy(physique.rotation);
  avantPhys.pret = true;
  const ressentie = new THREE.Vector3(0, -9.81, 0).sub(a).applyQuaternion(q.clone().invert());
  pesanteur.lerp(ressentie, Math.min(1, dt * 10));
  return pesanteur;
}

// ---------- Les dangers ----------
const _tete = new THREE.Vector3();
function dangers() {
  if (etat.mode !== 'pied') return;
  // la bôme qui balaie le cockpit pendant un empannage
  const pivot = bateau.pivotBome.position;
  const a = physique.angleBome;
  const bout = new THREE.Vector3(Math.sin(a) * MAT.bome, 0, Math.cos(a) * MAT.bome).add(pivot);
  _tete.copy(marin.position);
  _tete.y += marin.hauteurYeux() + 0.08;
  const seg = bout.clone().sub(pivot);
  const t = THREE.MathUtils.clamp(_tete.clone().sub(pivot).dot(seg) / seg.lengthSq(), 0, 1);
  const proche = pivot.clone().addScaledVector(seg, t).distanceTo(_tete);
  if (proche < 0.3 && Math.abs(physique.vitesseBome) > 0.8 && marin.etourdi === 0) {
    audio.choc(1);
    marin.etourdi = 2.2;
    secousse(0.6);
    // la bôme le pousse dans le sens où elle va
    marin.glissade.x += Math.sign(physique.vitesseBome) * 2.4;
    afficherMessage('La bôme t\'a frappé ! Pendant un empannage, accroupis-toi (C) ou reste à l\'écart.');
    if (marin.surLePont && !marin.attache && Math.random() < 0.5) finir('bome');
  }
}

let secousseForce = 0;
function secousse(force) { secousseForce = Math.max(secousseForce, force); }
// (le grondement d'une vague scélérate : 0 loin → 1 sur nous, puis il s'éloigne)
function sonScelerate() {
  const w = nuit?.scelerates?.vague;
  if (!w || !w.faites.has('grondement')) return { scelerate: 0, deferle: 0 };
  const d = w.distance;
  return { scelerate: d >= 0 ? 1 - Math.min(1, d / 1000) : Math.max(0, 1 + d / 260), deferle: w.v.deferle };
}

// ---------- La simulation (appelée par le monde 3D une fois la houle calculée) ----------
const _origine = new THREE.Vector3();
const _trombe = new THREE.Vector3();
function simuler(dt) {
  etat.bordage = 0;
  const enJeu = etat.mode === 'barre' || etat.mode === 'pied' || etat.mode === 'poste';
  if (!enJeu) {
    commandes.lireAppuis();
    // un pilote automatique garde le bateau à 60° du vent
    const m = physique.mesures;
    const erreur = (Math.abs(m.angleVentReel) - 60) * Math.sign(m.angleVentReel || 1);
    physique.barre = THREE.MathUtils.clamp(erreur * 0.02 + physique.rotation.y * 1.4, -0.4, 0.4);
    reglerAutomatiquement(physique, dt);
  } else {
    touchesAppuyees();
    if (etat.mode === 'barre') tenirLaBarre(dt);
    // (la barre est tenue : par la main du joueur, ou par la barre assistée)
    piloteOuBarreLibre(dt, etat.mode === 'barre' && (options.barreAssistee || commandes.axe('barreGauche', 'barreDroite') !== 0));
    if (etat.regleurAuto) reglerAutomatiquement(physique, dt);
    if (journee) vivreLaJournee(dt);
    if (nuit) vivreLaNuit(dt);
  }
  // les grains : ceux de la nuit vivent avec elle (nuit.maj) ; ceux du décor, ici
  const p = physique.position;
  if (!nuit) {
    // (sur l'écran d'accueil, deux averses de plus à l'horizon : la nuit qui vient)
    grainsDuDecor.renfort = etat.mode === 'accueil' ? 2 : 0;
    grainsDuDecor.maj(dt, meteo, p.x, p.z, physique.vitesse.x, physique.vitesse.z);
    ici = grainsDuDecor.mesurer(p.x, p.z, ici);
    foudreDuDecor.maj(dt, { meteo, grains: grainsDuDecor, x: p.x, z: p.z, ecoute: monde.camera.position });
  } else if (nuit.ici) ici = nuit.ici;
  // le vent : le vent du moment, et ses risées (elles vivent autour du bateau ; on les voit
  // venir sur l'eau ; sous un grain, il y en a bien plus), et l'air froid qui tombe des
  // grains (la rafale qui les précède, le vent qui tourne sur leurs côtés)
  const v = vent.maj(monde.temps, dt, meteo, ici.agitation, p.x, p.z, grainsActifs());
  // (la risée où l'on est, et celle qui arrive : on l'entend, Jos en parle le matin)
  etat.risee = vent.risees.mesurer(p.x, p.z, physique.vitesse.x, physique.vitesse.z, etat.risee ?? {});
  v.add(grainsActifs().ventEn(p.x, p.z, _grains));
  // (au crépuscule, le tourbillon de la trombe, quand elle passe près : il souffle sur le
  // bateau, le secoue, et lui jette l'eau qu'il arrache à la mer)
  if (nuit?.trombe) {
    v.add(nuit.ventTrombe(physique.position.x, physique.position.z, _trombe));
    const fort = _trombe.length();
    if (fort > 6) {
      secousse(Math.min(0.55, fort / 55));
      const n = Math.floor(fort * dt * 6);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const r = 4 + Math.random() * 14;
        _origine.set(physique.position.x + Math.cos(a) * r, physique.position.y + 0.5 + Math.random() * 3, physique.position.z + Math.sin(a) * r);
        monde.embruns.emettre(_origine, { vx: _trombe.x + v.x * 0.3, vy: 1 + Math.random() * 4, vz: _trombe.z + v.z * 0.3, vie: 1 + Math.random(), taille: 0.4 + Math.random() * 1.2, opacite: 0.18 });
      }
      if (fort > 18 && !monde.dansLaCabine && Math.random() < dt * 2) monde.gouttes.eclabousser(0.4);
    }
  }
  etat.ventVrai = v.length() / 0.5144;
  monde.mesurer('physique', () => physique.avancer(dt, monde.houle, v, Math.max(2, Math.ceil(dt * 240))));
  apparitions.maj(nuit?.peur ?? null, {
    temps: monde.temps, eclairage: etat.eclairage, ambiance: monde.ecl.ambiance, eclair: monde.eclair.eclaire, lampe: etat.lampe,
    faisceau: monde.lampe,
  });

  // à pied : le marin bouge, sent le bateau, vise et agit
  const ressentie = sentirLeBateau(dt);
  if (etat.mode === 'pied') {
    const avance = (commandes.enfoncee('avancer') ? 1 : 0) - (commandes.enfoncee('reculer') ? 1 : 0);
    const lateral = (commandes.enfoncee('droite') ? 1 : 0) - (commandes.enfoncee('gauche') ? 1 : 0);
    marin.suivrePieces(bateau);
    const ev = marin.maj(dt, {
      avance, lateral, tenir: commandes.maj, accroupir: commandes.enfoncee('accroupir') || commandes.ctrl,
    }, ressentie);
    if (ev.horsBord) finir('horsBord');
    if (ev.chute) {
      // (sauté du toit dans le cockpit…)
      audio.choc(Math.min(1, ev.chute * 0.5));
      secousse(Math.min(0.6, ev.chute * 0.4));
    }
    if (ev.retenu && !(etat.attenteRetenu > 0)) {
      afficherMessage('Le harnais t\'a retenu au bord ! Tiens-toi (Maj) et remonte vers l\'axe du bateau.');
      secousse(0.5);
      etat.attenteRetenu = 4;
    }
    etat.attenteRetenu = Math.max(0, (etat.attenteRetenu ?? 0) - dt);
    // (il pousse contre la porte fermée de la timonerie : on lui dit comment l'ouvrir — une
    // fois, puis plus avant six secondes)
    const contreLaPorte = !bateau.descenteOuverte && avance > 0 && marin.vitesseMarche < 0.15
      && Math.abs(marin.position.x) < 0.35 && Math.abs(marin.position.z - TIMONERIE.zArriere) < 0.45;
    etat.contreLaPorte = contreLaPorte ? (etat.contreLaPorte ?? 0) + dt : Math.min(0, (etat.contreLaPorte ?? 0) + dt);
    if (etat.contreLaPorte > 0.6) {
      afficherMessage('La porte de la timonerie est fermée : regarde-la et appuie sur E pour l\'ouvrir');
      etat.contreLaPorte = -6;
    }
    const oeil = marin.position.clone();
    oeil.y += marin.hauteurYeux();
    etat.geste = gesteVise(gestes, oeil, marin.direction(), { encombrement: marin.encombrement, obstacle: porteFermeeEntre });
    poursuivreAction(dt);
    dangers();
  } else if (etat.mode === 'poste') {
    // assis au poste de la timonerie : on peut aussi agir sur ce que l'on regarde (la VHF,
    // le radar, le traceur, le tableau électrique…), sans se lever
    etat.geste = gesteVise(gestes.filter((g) => g.id !== 'poste' && g.id !== 'siege'), YEUX_POSTE, marin.direction(), {
      portee: 1.1, encombrement: marin.encombrement, obstacle: porteFermeeEntre,
    });
    poursuivreAction(dt);
  } else {
    etat.geste = null;
  }

  // les bouées de la journée flottent (et s'allument au crépuscule)
  bouees.maj(journee?.bouees, monde.temps, monde.ecl.nuit);
  if (enJeu) surveillerLaCote(dt);

  // (les lumières du bord vacillent quand l'étrange arrive, ou quand la foudre tombe tout
  // près ; sur le mât, les écrans s'éteignent quelques secondes)
  etat.coupure = Math.max(0, (etat.coupure ?? 0) - dt);
  const vacille = etat.coupure > 0 ? 0 : facteurVacille(dt);
  bateau.radar.vacille = vacille;
  // le modèle 3D suit la physique
  physique.origine(_origine);
  bateau.groupe.position.copy(_origine);
  bateau.groupe.quaternion.copy(physique.orientation);
  const m = physique.mesures;
  const r = bateau.reglage;
  const faseye = (incidence) => THREE.MathUtils.clamp((9 - incidence) / 9, 0, 1);
  r.angleBome = physique.angleBome;
  r.cote = physique.angleBome >= 0 ? 1 : -1;
  r.faseyement = faseye(m.incidenceGV);
  r.force = 1 - r.faseyement;
  r.ris = physique.ris;
  r.angleFoc = physique.angleFoc;
  r.coteFoc = physique.angleFoc >= 0 ? 1 : -1;
  r.faseyementFoc = faseye(m.incidenceFoc);
  // (les avaries : la grand-voile déchirée bat ; le foc sans écoute bat comme un drapeau)
  r.dechiree = physique.grandVoileDechiree;
  if (physique.grandVoileDechiree) r.faseyement = Math.max(r.faseyement, 0.7);
  if (physique.ecouteFocLibre) r.faseyementFoc = 1;
  r.deroule = Math.max(0.02, physique.deroule);
  r.angleSafran = physique.barre;
  bateau.instruments.maj(dt, m, monde.ecl.nuit);
  majRadar(dt);
  // le traceur de cartes et la commande du pilote, sur la console de la timonerie
  const fond = physique.vitesse;
  bateau.electronique.maj(dt, {
    x: physique.position.x, z: physique.position.z, cap: m.cap, vitesse: m.vitesse,
    route: (Math.atan2(fond.x, -fond.z) * 180 / Math.PI + 360) % 360,
    pilote: etat.pilote, panne: nuit?.avaries.pilote === 'panne', barre: physique.barre,
    bouees: [...(journee?.bouees?.values() ?? [])].map((b) => ({ x: b.x, z: b.z, couleur: { jaune: '#ffd23a', rouge: '#ff4a3a', verte: '#3ad06a' }[b.couleur] })),
    nuit: monde.ecl.nuit,
    // (la chose sous la coque : le sondeur la voit, lui)
    sonde: nuit?.peur?.chose?.sonde ?? null,
    // (le baromètre électronique : la pression, ce qu'elle a fait en trois heures, sa courbe)
    baro: barometre.aiguille === null ? null : { p: barometre.aiguille, dp: heureIci() === null ? null : tendance(heureIci()), historique: barometre.historique, heure: heureIci() },
    vacille,
  });
  // les essuie-glaces : sous la pluie, ou quand les embruns arrosent le pare-brise ; et
  // l'eau qui ruisselle sur les vitres de la timonerie
  const eauDansLAir = Math.min(1, ici.pluie * 1.3 + (monde.embruns.densiteAutour ?? 0) * 2.5 + Math.max(0, meteo.vent - 28) / 30);
  bateau.balayage = eauDansLAir > 0.05 ? Math.min(1, eauDansLAir * 1.2) : 0;
  bateau.pluieSurLesVitres = eauDansLAir;
  mouillerLePont(dt);
  // l'eau embarquée : dans le cockpit, et dans la cabine au-dessus des planchers
  bateau.eauABord.maj(dt, bateau.groupe, {
    litresCockpit: physique.eauCockpit,
    litresCabine: Math.max(0, etat.eauCale - EAU.planchers),
    pesanteur,
    temps: monde.temps,
  });
  bateau.allumerFeux(etat.feux ? 1 : 0);
  // le baromètre du bord : il montre la pression d'ici (monde/pression.js : elle annonce le
  // temps au lieu de le suivre) ; le bateau qui tape dans la mer décolle son aiguille ; une
  // fois tapoté, on cale l'aiguille témoin quand la noire s'est posée
  barometre.maj(dt, pressionIci(), { secousse: etat.mouvement ?? 0, heure: heureIci(), passe: pressionDuJour });
  if (etat.calerTemoin > 0) {
    etat.calerTemoin -= dt;
    if (etat.calerTemoin <= 0) {
      barometre.caler(heureIci());
      etat.barometreLu = true;
    }
  }
  // la cabine : sa lumière (le jour par les hublots, le panneau et la descente, ou les
  // plafonniers), le baromètre et la pendule
  bateau.interieur.regler({
    eclairage: etat.eclairage,
    feux: etat.feux,
    ciel: monde.ecl.ambiance,
    eclair: monde.eclair.eclaire,
    descente: bateau.descenteOuverte ? 1 : 0,
    pression: barometre.aiguille,
    temoin: barometre.temoin,
    // (la pendule donne l'heure de l'horloge : la lumière du ciel, elle, peut retarder —
    // le crépuscule s'attarde pendant le passage de la trombe, jeu/nuit.js)
    heure: nuit ? nuit.heure % 24 : meteo.heure,
    vacille,
    pilotePanne: nuit?.avaries.pilote === 'panne',
    nuit: monde.ecl.nuit,
    dt,
  });
  const dedans = (etat.mode === 'pied' && !marin.dehors) || etat.mode === 'poste';
  const enTimonerie = etat.mode === 'poste' || (etat.mode === 'pied' && marin.dansLaTimonerie);
  // l'œil s'habitue à la pénombre de la cabine (et le dehors paraît éblouissant) :
  // dedans, l'exposition dépend de la lumière de la cabine ; dans la timonerie, on voit
  // surtout dehors, par les vitres : l'œil ne s'y habitue qu'à moitié
  const expositionCabine = bateau.interieur.exposition(monde.ecl.nuit, enTimonerie);
  const adaptationVoulue = dedans ? (enTimonerie ? 0.5 : 1) : 0;
  etat.adaptation = (etat.adaptation ?? 0) + (adaptationVoulue - (etat.adaptation ?? 0)) * Math.min(1, dt * (dedans ? 0.9 : 2.2));
  const reglages = monde.post.reglages;
  // (on mélange les expositions « en photographe » : en diaphragmes, pas en valeurs)
  reglages.uExposition.value = Math.exp(THREE.MathUtils.lerp(Math.log(monde.ecl.exposition), Math.log(expositionCabine), etat.adaptation));
  // (quand la peur monte, la nuit se referme : l'œil ne s'habitue plus aussi bien au noir)
  const peurNuit = (nuit?.peur?.tension ?? 0) ** 2 * monde.ecl.nuit;
  reglages.uExposition.value *= 1 - 0.3 * peurNuit;
  // (sous le nuage-mur de la trombe, il fait un peu plus sombre — un peu seulement : elle
  // vient à la tombée de la nuit, il faut encore la voir)
  if (nuit?.trombe) reglages.uExposition.value *= 1 - 0.12 * nuit.trombe.force * (1 - THREE.MathUtils.smoothstep(nuit.trombe.distance, 150, 900));
  // (sous le nuage d'un grain aussi)
  reglages.uExposition.value *= 1 - 0.15 * ici.ombre;
  // (et les couleurs de la nuit — bleues, délavées — ne valent que dehors)
  const et = monde.etalonnage;
  reglages.uSaturation.value = THREE.MathUtils.lerp(et.saturation, 1.05, etat.adaptation);
  reglages.uBalance.value.set(...et.balance.map((b) => THREE.MathUtils.lerp(b, 1, etat.adaptation)));
  // (la peur resserre la vue — les bords s'assombrissent — et pâlit les couleurs)
  const tension = nuit?.peur?.tension ?? 0;
  reglages.uVignettage.value = et.vignettage + 0.5 * tension * tension;
  reglages.uSaturation.value *= 1 - 0.25 * tension;
  monde.lampeFrontale(etat.lampe || (etat.mode === 'accueil' && monde.ecl.nuit > 0.6));
  // (dans la timonerie, on voit la pluie par les vitres ; dans le carré, plus du tout)
  monde.pluie.mesh.visible = (!dedans || enTimonerie) && (monde.ici?.pluie ?? ici.pluie) > 0.01;
  monde.dansLaCabine = dedans;
  // (des gouttes sur l'écran seulement quand on est à bord, pas sur l'écran d'accueil)
  monde.gouttesActives = options.gouttes && (etat.mode === 'barre' || etat.mode === 'pied');
  monde.etatCargo = nuit?.cargo ?? null;
  monde.etatTrombe = nuit?.trombe ?? null;
  monde.etatGrains = grainsActifs();
  monde.etatFoudre = foudreActive();
  entendreLaFoudre(foudreActive(), dedans);

  // le son du bord
  // (le bateau secoué : la vitesse de rotation qui change d'un coup, lissée ; le vérin du
  // pilote : la barre qu'il pousse)
  const rot = physique.rotation;
  etat.rotationAvant ??= rot.clone();
  const secousseBateau = Math.min(1, rot.distanceTo(etat.rotationAvant) / Math.max(dt, 1e-3) / 1.2);
  etat.rotationAvant.copy(rot);
  etat.mouvement = (etat.mouvement ?? 0) + (secousseBateau - (etat.mouvement ?? 0)) * Math.min(1, dt * 4);
  const vitesseBarre = Math.abs(physique.barre - (etat.barreAvant ?? physique.barre)) / Math.max(dt, 1e-3);
  etat.barreAvant = physique.barre;
  audio.dansLaCabine(dedans);
  audio.maj(dt, {
    nuit: monde.ecl.nuit,
    mouvement: etat.mouvement,
    pilote: etat.pilote !== null ? Math.min(1, vitesseBarre / 0.35) : 0,
    voiles: (physique.ris >= 3 ? 0.2 : 1 - 0.2 * physique.ris) * (0.4 + 0.6 * physique.deroule),
    ventApparent: m.ventApparent,
    vitesse: m.vitesse,
    faseyement: Math.max(r.faseyement, r.faseyementFoc * physique.deroule),
    // la pluie qui tombe ici, et l'averse d'un grain qui arrive (on l'entend sur la mer)
    pluie: ici.pluie,
    averse: ici.approche,
    // (la risée qui arrive : l'eau froissée qui chuinte)
    risee: etat.risee?.niveau ?? 0,
    bordage: etat.bordage,
    houle: monde.houle.hauteurSignificative,
    // la nuit : l'eau à bord, la trombe et le cargo (0 : loin → 1 : sur nous)
    eauCale: etat.eauCale,
    eauCockpit: physique.eauCockpit,
    roulis: physique.rotation.length(),
    // (on l'entend gronder de loin : à 1,5 km un murmure, à 300 m un fracas)
    trombe: nuit?.trombe ? nuit.trombe.force * (1 - THREE.MathUtils.smoothstep(nuit.trombe.distance, 60, 1600)) : 0,
    cargo: nuit?.cargo ? 1 - THREE.MathUtils.smoothstep(nuit.cargo.distance, 60, 900) : 0,
    // la vague scélérate : on l'entend gronder dès un kilomètre ; sa crête rugit en s'écroulant
    ...sonScelerate(),
    tension: nuit?.peur?.tension ?? 0,
    // (le feu de Saint-Elme : l'air chargé grésille en tête de mât)
    saintElme: dedans ? 0 : THREE.MathUtils.smoothstep(foudreActive().champ, 0.55, 0.85),
  });
  etat.attenteClaque = Math.max(0, etat.attenteClaque - dt);
  if (m.impactEtrave > 0.05 && etat.attenteClaque === 0) {
    audio.claque(m.impactEtrave);
    secousse(m.impactEtrave * 0.25);
    monde.embruns.etrave(m.impactEtrave, physique);
    // (une grosse gerbe d'étrave arrive jusqu'au cockpit quand on fait face à l'avant)
    if (m.impactEtrave > 0.5 && meteo.vent > 22 && !dedans) monde.gouttes.eclabousser(m.impactEtrave * 0.5);
    etat.attenteClaque = 0.6;
  }
}

// ---------- La côte : gare aux cailloux ----------
function surveillerLaCote(dt) {
  etat.attenteCote = Math.max(0, (etat.attenteCote ?? 0) - dt);
  const d = distanceALaTerre(physique.position.x, physique.position.z);
  if (d < 35) {
    finir('cailloux');
  } else if (d < 650 && etat.attenteCote === 0) {
    etat.attenteCote = 20;
    afficherMessage(`Attention : la côte est à ${Math.round(d / 10) * 10} m. Des cailloux partout : éloigne-toi !`);
    (journee ?? nuit)?.dire(['Attention, tu t\'approches trop de la côte, il y a des cailloux partout par ici. Éloigne-toi, vers le large !'], { siLibre: true });
  }
}

// ---------- La journée d'apprentissage ----------
// Ce que les leçons ont besoin de savoir, à chaque image
function contexteJournee(dt) {
  return {
    dt,
    m: physique.mesures,
    physique,
    meteo,
    ventDe: meteo.directionVent,
    pilote: etat.pilote !== null,
    regleurAuto: etat.regleurAuto,
    mode: etat.mode,
    aBord: {
      feux: etat.feux,
      lampeEssayee: etat.lampeEssayee,
      gilet: etat.gilet,
      descenteOuverte: bateau.descenteOuverte,
      attache: marin.attache,
      dehors: marin.dehors,
      zone: marin.zone,
      barometreLu: !!etat.barometreLu,
    },
    evenements: etat.evenements,
    // la risée où l'on est, et celle qui arrive ; en envoyer une sur le bateau (Jos la montre)
    risee: etat.risee,
    envoyerRisee: (o) => vent.risees.envoyer({ x: physique.position.x, z: physique.position.z, vbx: physique.vitesse.x, vbz: physique.vitesse.z, ...o }),
  };
}

function vivreLaJournee(dt) {
  journee.maj(dt, contexteJournee(dt));
  etat.evenements = new Set();
  // le temps qu'il fait suit l'heure : le ciel dix fois par seconde, la mer toutes les
  // trois secondes (la recalculer coûte 5 ms)
  etat.majCiel += dt;
  etat.majMer += dt;
  if (etat.majCiel > 0.1) {
    etat.majCiel = 0;
    const mer = etat.majMer > 3;
    if (mer) etat.majMer = 0;
    meteo = meteoDuJour(journee.heure);
    jeu.meteo = meteo;
    monde.regler(meteo, { recalculerMer: mer, brusque: false });
    if (monde.ecl.nuit > 0.45 && !etat.feuxRappel) {
      etat.feuxRappel = true;
      if (!etat.feux) afficherMessage('La nuit tombe : allume tes feux de navigation (tableau électrique)');
    }
  }
}

function commencerJournee({ reprise = null } = {}) {
  jeu.radio.taire();
  nuit = null;
  journeeFaite = null;
  journee = new Journee({ radio: jeu.radio });
  if (reprise) journee.restaurer(reprise);
  meteo = meteoDuJour(journee.heure);
  jeu.meteo = meteo;
  monde.regler(meteo);
  // on part le foc à moitié roulé (sous grand-voile seule, le bateau serait trop ardent :
  // il remonterait au vent malgré la barre), le pilote à la barre, les voiles réglées
  // automatiquement : Jos va tout montrer, une chose après l'autre
  // (cap au sud, vers le large : la côte de Kervalen est dans le dos)
  physique.placer(0, 0, (meteo.directionVent - 65 + 360) % 360, monde.houle);
  physique.vitesse.copy(physique.avant).multiplyScalar(2);
  physique.rotation.set(0, 0, 0);
  physique.ris = 0;
  physique.deroule = 0.5;
  physique.ecouteGV = 0.5;
  physique.ecouteFoc = 0.35;
  Object.assign(etat, {
    regleurAuto: true, pilote: Math.round((meteo.directionVent - 65 + 360) % 360),
    feux: false, lampe: false, lampeEssayee: false, gilet: false, eclairage: 'eteint', barometreLu: false, calerTemoin: 0,
    feuxRappel: false, dejaEmbarque: true, evenements: new Set(), majCiel: 0, majMer: 0, soirEnAttente: false,
  });
  // (une nouvelle journée : l'aiguille témoin n'est pas calée, le barographe repart)
  barometre.calee = null;
  barometre.historique.length = 0;
  bateau.interieur.cire.visible = true;
  bateau.ouvrirDescente(true);
  ouvrirDescente(true);
  marin.placer(-0.2, COCKPIT.plancher, zDe(0.17));
  marin.attache = false;
  marin.lacet = 0;
  marin.site = -0.12;
  siege.x = physique.mesures.angleVentApparent >= 0 ? 0.76 : -0.76;
  if (reprise) appliquerBateau(reprise.bateau);
  journee
    .on('journal', majCarnet)
    .on('lecon', (lecon, i) => {
      annoncer(`Leçon ${i + 1} sur ${LECONS.length}`, lecon.titre);
      majCarnet();
      // (la partie est gardée au début de chaque leçon)
      garderPartie({
        type: 'journee', lecon: i, titre: lecon.titre, reussies: journee.reussies, passees: journee.passees,
        compteurs: journee.compteurs, journal: journee.journal.slice(-40),
      });
    })
    .on('reussie', () => {
      const panneau = document.getElementById('lecon');
      panneau.classList.remove('reussie');
      void panneau.offsetWidth; // (pour relancer l'animation)
      panneau.classList.add('reussie');
      audio.clic?.();
    })
    .on('leconReussie', () => majCarnet())
    .on('finie', () => {
      etat.soirEnAttente = true;
      majCarnet();
      garderPartie({ type: 'soir', resumeJournee: resumer(journee) });
    });
  document.getElementById('carnet-journal').innerHTML = '';
  etat.mode = 'pause';
  etat.avantPause = 'barre';
  embarquer();
  majCarnet();
  afficherMessage('Le pilote tient la barre. Écoute Jos, à la radio…');
}

// ---------- La nuit de tempête ----------
// Où commence la nuit : au coucher du soleil, Morgane a fait route au large, à 6 milles
// au sud de Kervalen. La côte est au nord, et le vent de la tempête souffle vers elle : il
// faut de « l'eau à courir » pour fuir devant le temps.
const DEPART_NUIT = { x: 1500, z: 7000 };

const _inverse = new THREE.Matrix4();
const _qInverse = new THREE.Quaternion();
function regardDansLeBateau() {
  const g = bateau.groupe;
  _inverse.copy(g.matrixWorld).invert();
  _qInverse.copy(g.quaternion).invert();
  const cam = monde.camera;
  const yeux = cam.position.clone().applyMatrix4(_inverse);
  const regard = cam.getWorldDirection(new THREE.Vector3()).applyQuaternion(_qInverse);
  const haut = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion).applyQuaternion(_qInverse);
  const tanY = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  const lieu = etat.mode === 'barre' ? 'barre' : etat.mode === 'poste' || marin.dansLaTimonerie ? 'timonerie' : marin.dehors ? 'pont' : 'carre';
  return { yeux, regard, haut, tanX: tanY * cam.aspect, tanY, lieu };
}
function contexteNuit(dt) {
  return {
    dt,
    m: physique.mesures,
    physique,
    houle: monde.houle,
    meteo,
    ventDe: meteo.directionVent,
    // (pour la peur : où l'on est, d'où et vers où l'on regarde — dans le repère du bateau)
    ...regardDansLeBateau(),
    lampe: etat.lampe,
    eclairage: etat.eclairage,
    eclair: monde.eclair.eclaire,
    noir: monde.ecl.noir ?? 0,
    danger: etat.danger ?? 0,
    calme: etat.calme ?? 0,
    pilote: etat.pilote !== null,
    regleurAuto: etat.regleurAuto,
    mode: etat.mode,
    aBord: {
      feux: etat.feux,
      lampeEssayee: etat.lampeEssayee,
      gilet: etat.gilet,
      descenteOuverte: bateau.descenteOuverte,
      attache: marin.attache,
      // (à la barre, on est dans le cockpit : dehors)
      dehors: etat.mode === 'barre' || marin.dehors,
      zone: marin.zone,
      barometreLu: !!etat.barometreLu,
    },
    evenements: etat.evenements,
    // (là où l'on entend : le tonnerre arrive d'autant plus tard que l'éclair est loin d'ici)
    ecoute: monde.camera.position,
    // (le baromètre : ce que montre son aiguille, et l'aiguille témoin si on l'a calée)
    barometre: { aiguille: barometre.aiguille, temoin: barometre.calee !== null ? barometre.temoin : null },
  };
}

// La pression ici (hPa) : la nuit, celle de la nuit (la dépression qui arrive, et le bond des
// grains quand arrive leur rafale) ; le jour, celle de la journée ; sans journée ni nuit (la
// navigation libre), celle qui va avec le temps qu'il fait
function heureIci() {
  return nuit ? nuit.heure : (journee ?? journeeFaite)?.heure ?? null;
}
function pressionIci() {
  if (nuit) return nuit.pression;
  const p = physique.position;
  const grains = grainsDuDecor.pressionEn(p.x, p.z);
  const h = heureIci();
  return (h === null ? pressionDuTemps(meteo) : pressionDuJour(h)) + grains;
}

// La nuit est enregistrée (toutes les 2 s) : l'atelier de la tempête sait la redessiner,
// à côté des marins automatiques (atelier-tempete.html, « Tes nuits »)
const CLE_NUITS = 'quart-de-nuit:nuits';
let enregistrement = null;
function nouvelEnregistrement() {
  enregistrement = {
    date: Date.now(), difficulte, fin: null, heureFin: null, stats: null, age: 0,
    serie: { heure: [], vent: [], rafale: [], pluie: [], hs: [], gite: [], twa: [], vitesse: [], cale: [], cockpit: [] },
    deferlantes: [], avaries: [], journal: [],
  };
}
function enregistrer(dt) {
  const e = enregistrement;
  if (!e) return;
  const m = physique.mesures;
  for (const d of e.deferlantes) {
    if (d.suivi > 0) {
      d.suivi -= dt;
      d.gite = Math.max(d.gite, Math.abs(m.gite));
    }
  }
  e.age += dt;
  if (e.age < 2) return;
  e.age = 0;
  const r = (v, k = 10) => Math.round(v * k) / k;
  const s = e.serie;
  s.heure.push(r(nuit.heure, 1000));
  s.vent.push(r(nuit.meteo.vent));
  s.rafale.push(r(etat.ventVrai ?? vent.vitesse));
  s.pluie.push(r(ici.pluie, 100));
  s.hs.push(r(monde.houle.hauteurSignificative, 100));
  s.gite.push(r(Math.abs(m.gite)));
  s.twa.push(Math.round(Math.abs(m.angleVentReel)));
  s.vitesse.push(r(m.vitesse));
  s.cale.push(Math.round(nuit.eau.cale));
  s.cockpit.push(Math.round(nuit.eau.cockpit));
}
function sauverEnregistrement() {
  const e = enregistrement;
  if (!e || !nuit) return;
  e.fin = nuit.etat === 'aube' ? 'aube' : nuit.raison;
  e.heureFin = nuit.heure;
  e.stats = { ...nuit.stats };
  e.journal = nuit.journal.map((j) => ({ heure: j.heure, texte: j.texte }));
  const propre = { ...e, deferlantes: e.deferlantes.map(({ heure, force, angle, gite }) => ({ heure, force, angle, gite })) };
  delete propre.age;
  try {
    const nuits = JSON.parse(localStorage.getItem(CLE_NUITS) ?? '[]').filter((n) => n.date !== e.date);
    nuits.push(propre);
    localStorage.setItem(CLE_NUITS, JSON.stringify(nuits.slice(-6)));
  } catch {
    // (pas de stockage : tant pis, la nuit ne sera pas dans l'atelier)
  }
}

function vivreLaNuit(dt) {
  nuit.maj(dt, contexteNuit(dt));
  if (nuit) enregistrer(dt);
  etat.evenements = new Set();
  if (!nuit) return;
  // la tempête brouille la radio (et Jos revient de son silence dans les parasites)
  const brouillage = THREE.MathUtils.smoothstep(nuit.meteo.vent, 30, 42) * 0.55;
  etat.retourJos = nuit.faits.has('silence') && !nuit.silence ? Math.max(0, (etat.retourJos ?? 1) - dt / 60) : (etat.retourJos ?? 1);
  jeu.radio.brouillage = Math.min(1, brouillage + (nuit.faits.has('silence') && !nuit.silence ? 0.35 * etat.retourJos : 0));
  // le cœur qui bat, quand ça devient grave : couché sur l'eau, la trombe sur nous, le
  // bateau qui se remplit
  const m = physique.mesures;
  const trombe = nuit.trombe ? nuit.trombe.force * (1 - THREE.MathUtils.smoothstep(nuit.trombe.distance, 60, 260)) : 0;
  const danger = Math.max(THREE.MathUtils.smoothstep(Math.abs(m.gite), 48, 80), trombe, THREE.MathUtils.smoothstep(etat.eauCale ?? 0, 1100, 1700));
  etat.danger = danger;
  etat.calme = (etat.calme ?? 0) + dt;
  // (et quand la peur monte, sans danger visible : un cœur lent, sourd)
  const coeur = Math.max(danger, 0.55 * THREE.MathUtils.smoothstep(nuit.peur.tension, 0.7, 1));
  etat.attenteCoeur = (etat.attenteCoeur ?? 0) - dt;
  if (coeur > 0.25 && etat.attenteCoeur <= 0) {
    audio.battement?.(coeur);
    etat.attenteCoeur = 60 / (72 + 70 * coeur);
  }
  // la chose sous la coque : quand elle passe dessous, quelque chose d'immense frotte la
  // quille et soulève le bateau
  const chose = nuit.peur.chose;
  if (chose?.sous && !chose.secoue) {
    chose.secoue = true;
    audio.raclement?.(chose.cote);
    physique.rotation.addScaledVector(physique.avant, 0.2 * chose.cote);
    physique.vitesse.y += 0.45;
    secousse(0.35);
  }
  etat.eauCale = nuit.eau.cale;
  // le pilote a lâché : plus personne ne tient la barre
  if (nuit.avaries.pilote === 'panne' && etat.pilote !== null) etat.pilote = null;
  // le temps qu'il fait suit l'heure (comme le jour : le ciel dix fois par seconde, la
  // mer toutes les trois secondes)
  etat.majCiel += dt;
  etat.majMer += dt;
  if (etat.majCiel > 0.1) {
    etat.majCiel = 0;
    const mer = etat.majMer > 3;
    if (mer) etat.majMer = 0;
    meteo = nuit.meteo;
    jeu.meteo = meteo;
    monde.regler(meteo, { recalculerMer: mer, brusque: false });
  }
}

// ---------- Le pont mouillé ----------
// Sous la pluie et dans les embruns, tout ce qui est à bord ruisselle : le gelcoat et
// l'antidérapant deviennent brillants (la lampe et les éclairs s'y reflètent), le teck
// fonce. (Seulement la rugosité et la teinte des matériaux : aucun shader à refaire.)
const materiauxSecs = new Map();
function mouillerLePont(dt) {
  const vise = Math.min(1, ici.pluie * 1.3 + Math.max(0, (meteo.vent - 25) / 20) * 0.5);
  etat.mouille = (etat.mouille ?? 0) + (vise - (etat.mouille ?? 0)) * Math.min(1, dt * (vise > (etat.mouille ?? 0) ? 0.5 : 0.05));
  const w = etat.mouille;
  if (Math.abs(w - (etat.mouilleApplique ?? -1)) < 0.01) return;
  etat.mouilleApplique = w;
  const mat = bateau.materiaux;
  for (const [nom, rugueuxMouille, assombri] of [['gelcoat', 0.08, 0.92], ['coque', 0.08, 0.95], ['antiderapant', 0.28, 0.85], ['teck', 0.32, 0.62]]) {
    const m = mat[nom];
    if (!m) continue;
    if (!materiauxSecs.has(nom)) materiauxSecs.set(nom, { rugosite: m.roughness, couleur: m.color.clone() });
    const sec = materiauxSecs.get(nom);
    m.roughness = THREE.MathUtils.lerp(sec.rugosite, rugueuxMouille, w);
    m.color.copy(sec.couleur).multiplyScalar(THREE.MathUtils.lerp(1, assombri, w));
  }
}

// ---------- Le radar ----------
// ce qu'il voit : la côte, les bouées, le cargo, la trombe, les grains, la mer… et parfois
// un écho que personne d'autre ne voit
const radarMonde = { hs: 1, pluie: 0, vent: { x: 0, z: 0 }, temps: 0, terre: distanceALaTerre, cibles: [] };
function majRadar(dt) {
  const r = radarMonde;
  r.hs = monde.houle.hauteurSignificative;
  r.pluie = meteo.pluie;
  r.grains = grainsActifs();
  const versOu = THREE.MathUtils.degToRad(meteo.directionVent + 180);
  const vitesseGrains = meteo.vent * 0.5144 * 0.6;
  r.vent.x = Math.sin(versOu) * vitesseGrains;
  r.vent.z = -Math.cos(versOu) * vitesseGrains;
  r.temps = monde.temps;
  r.cibles.length = 0;
  for (const b of journee?.bouees?.values() ?? []) r.cibles.push({ x: b.x, z: b.z, rayon: 6, force: 0.75 });
  if (nuit?.cargo) r.cibles.push({ x: nuit.cargo.x, z: nuit.cargo.z, rayon: 90, force: 1 });
  if (nuit?.trombe?.force > 0.1) r.cibles.push({ x: nuit.trombe.x, z: nuit.trombe.z, rayon: 170, force: 0.4 + 0.45 * nuit.trombe.force });
  // la crête d'une vague scélérate : une longue ligne qui avance (elle renvoie l'onde)
  const v = monde.houle.scelerates[0];
  if (v && v.force > 0.05) {
    const [cx, cz] = positionCrete(v, monde.houle.temps);
    r.cibles.push({ x: cx, z: cz, ligne: 1.5 * v.largeur, lx: -v.dz, lz: v.dx, largeurLigne: v.largeur, rayon: 16, force: 0.3 + 0.7 * v.force });
  }
  // l'écho que personne d'autre ne voit (jeu/peur.js) : il garde son relèvement depuis
  // l'avant, quoi qu'on fasse ; tout près, il fait sonner l'alarme de la zone de garde
  const e = nuit?.peur?.echo;
  if (e && e.force > 0.02) {
    const releve = THREE.MathUtils.degToRad(physique.mesures.cap) + e.releve;
    // (un gros écho, net, qui tient tour après tour : pas un retour de mer)
    r.cibles.push({ x: physique.position.x + Math.sin(releve) * e.distance, z: physique.position.z - Math.cos(releve) * e.distance, rayon: e.nom === 'echoProche' ? 26 : 32, force: 0.95 * e.force });
  }
  bateau.radar.alarme = !!e?.alarme;
  etat.bipRadar = e?.alarme ? (etat.bipRadar ?? 0) - dt : 0;
  if (e?.alarme && etat.bipRadar <= 0) {
    audio.alarmeRadar?.();
    etat.bipRadar = 1.2;
  }
  bateau.radar.maj(dt, { x: physique.position.x, z: physique.position.z, cap: physique.mesures.cap }, r, monde.ecl.nuit);
}

// ---------- L'étrange (jamais expliqué) ----------
// nuit.js décide quand ; ici, ce que l'on voit et entend
function vivreEtrange(nom) {
  if (nom === 'lumiere') {
    // un feu blanc, au loin, par le travers (d'un côté ou de l'autre), dans le creux des vagues
    const cap = THREE.MathUtils.degToRad(physique.mesures.cap + (Math.random() < 0.5 ? -1 : 1) * (45 + Math.random() * 40));
    const d = 650 + Math.random() * 300;
    monde.lumiereEtrange.montrer(physique.position.x + Math.sin(cap) * d, physique.position.z - Math.cos(cap) * d, 11);
  } else if (nom === 'voix16') {
    jeu.radio.fantome('Canal 16 : une voix, très faible, noyée dans les parasites… « …ayday… mayday… ici… » … puis plus rien.', { duree: 7.5 });
  } else if (nom === 'sansReponse') {
    audio.parasites?.(2.5, 0.6);
    afficherMessage('Pas de réponse. Rien que des parasites.');
  } else if (nom === 'coups') {
    audio.coupsCoque?.();
  }
}

// La peur (jeu/peur.js, par la nuit) : ce qu'on entend, ce qui secoue. (Ce qu'on voit :
// rendu/apparitions.js, à chaque image.)
function vivrePeur(e) {
  const p = nuit?.peur;
  if (e === 'gemissement') audio.gemissement?.((Math.random() - 0.5) * 1.6);
  else if (e === 'pas') {
    // (le monde se tait un instant : on les entend d'autant mieux ; la lumière hésite)
    audio.etouffer?.(5.5, 0.55);
    audio.pasSurLePont?.();
    etat.vacille = 1.2;
  } else if (e === 'nom') {
    audio.etouffer?.(4, 0.5);
    etat.vacille = 2;
    jeu.radio.chuchoter?.(`${NOM_BATEAU}… ${NOM_BATEAU}…`, { canal: 16, sousTitre: `Canal 16 : une voix, tout près du micro, très lente : « ${NOM_BATEAU}… »` });
  } else if (e === 'coupCoque') {
    // (un silence, d'abord : le vent, la mer se retirent… puis le choc)
    audio.etouffer?.(1.9, 0.8);
    setTimeout(() => {
      if (!nuit) return;
      audio.coupEnorme?.();
      secousse(0.9);
      audio.battement?.(1);
      etat.vacille = 1.6;
    }, 1700);
  } else if (e === 'chose') etat.vacille = 2.5;
  else if (e === 'eclairSilhouette') audio.battement?.(1);
  // (l'alarme du radar : les écrans hésitent quand elle se met à sonner ; l'écho qui nous
  // suit, lui, ne s'annonce pas — on ne le voit que si l'on regarde le radar)
  else if (e === 'echoProche') etat.vacille = 0.8;
  else if (e.endsWith('-fin') && p?.journal.at(-1)?.regardee) {
    audio.battement?.(0.8);
    etat.vacille = 0.7;
  }
}

// Les lumières du bord (les plafonniers, les écrans) quand le courant hésite : elles
// faiblissent, presque jusqu'au noir, ou reviennent. Quand
// l'étrange arrive, et parfois, quand la peur est haute.
// (au plus trois changements par seconde : plus vite, des éclats de lumière peuvent être
// dangereux pour les personnes photosensibles ; et rien du tout si l'option est décochée)
function facteurVacille(dt) {
  if (!options.clignotements) return 1;
  if ((nuit?.peur?.tension ?? 0) > 0.7 && Math.random() < dt / 55) etat.vacille = Math.max(etat.vacille ?? 0, 0.9 + 0.8 * Math.random());
  etat.vacille = Math.max(0, (etat.vacille ?? 0) - dt);
  if (etat.vacille <= 0) return 1;
  etat.ageVacille = (etat.ageVacille ?? 0) + dt;
  if (etat.ageVacille > 0.34 || etat.valeurVacille === undefined) {
    etat.ageVacille = 0;
    etat.valeurVacille = Math.random() < 0.4 ? 0.05 + 0.3 * Math.random() : 0.75 + 0.25 * Math.random();
  }
  return etat.valeurVacille;
}

// La foudre (monde/foudre.js) : ce qu'on en entend et ce qu'on en sent. La radio claque à
// chaque éclair, même lointain ; le tonnerre arrive quand son bruit a fait le chemin (trois
// secondes par kilomètre), de là où l'éclair est passé au plus près — à droite ou à gauche
// de là où l'on regarde ; une frappe tout près éblouit, assourdit, fait sauter les écrans.
// (La nuit en tire le reste : le journal, Jos, le pilote qui disjoncte.)
function entendreLaFoudre(foudre, dedans) {
  // (une seule fois chaque événement : en pause, la foudre ne bouge plus, ses derniers
  // événements restent là)
  if (foudre.t === etat.foudreLue) return;
  etat.foudreLue = foudre.t;
  for (const ev of foudre.evenements) {
    if (ev.type === 'eclair') {
      const f = 1 - THREE.MathUtils.smoothstep(ev.distance, 1500, REGLAGES_FOUDRE.parasites);
      if (f > 0.03) audio.parasiteEclair?.(f);
    } else if (ev.type === 'tonnerre') {
      const cam = monde.camera;
      const dx = ev.x - cam.position.x;
      const dz = ev.z - cam.position.z;
      const droite = _droite.setFromMatrixColumn(cam.matrixWorld, 0);
      const pan = THREE.MathUtils.clamp((dx * droite.x + dz * droite.z) / Math.max(1, Math.hypot(dx, dz)), -1, 1) * 0.85;
      audio.tonnerre({ distance: ev.distance, duree: ev.duree, force: ev.force, pan, claque: ev.claque });
    } else if (ev.type === 'frappe') frappeProche(ev, dedans);
  }
}
const _droite = new THREE.Vector3();

// La foudre tombe tout près (ou sur le mât) : le claquement en même temps que l'éclair, le
// souffle qui secoue, les oreilles qui sifflent (le monde s'étouffe), les écrans qui
// hésitent ; sur le mât, ils s'éteignent, et le radar redémarre
function frappeProche(ev, dedans) {
  const pres = ev.surLeMat ? 1 : 1 - THREE.MathUtils.smoothstep(ev.distance, 60, REGLAGES_FOUDRE.proche);
  audio.claquementFoudre?.(pres, dedans);
  if (pres > 0.35) {
    audio.etouffer?.(1.5 + 3 * pres, 0.45 + 0.4 * pres);
    audio.acouphene?.(3 + 5 * pres, pres);
  }
  secousse(0.15 + 0.5 * pres);
  etat.vacille = Math.max(etat.vacille ?? 0, 0.5 + 0.8 * pres);
  if (ev.surLeMat) {
    etat.coupure = 2.5;
    bateau.radar.redemarrer?.(25);
    afficherMessage('La foudre est tombée sur le mât !');
  } else if (pres > 0.5) afficherMessage(`La foudre est tombée à ${Math.max(10, Math.round(ev.distance / 10) * 10)} m !`);
}

// D'où vient une déferlante, vue du bateau (« par le travers tribord »…)
function cotePar(vers) {
  const origine = (Math.atan2(-vers.x, vers.z) * 180) / Math.PI; // le cap d'où elle vient
  const relatif = ((origine - physique.mesures.cap + 540) % 360) - 180;
  const a = Math.abs(relatif);
  const bord = relatif >= 0 ? 'tribord' : 'bâbord';
  return a < 30 ? 'de face' : a < 70 ? `par l'avant ${bord}` : a < 115 ? `de travers, à ${bord}` : a < 155 ? `par la hanche ${bord}` : 'par l\'arrière';
}

// depuisJournee : le bateau tel qu'on l'a préparé ; bateau : un état du bateau gardé (une
// partie reprise) ; reprise : une nuit gardée par le navigateur (au début d'un chapitre)
let resumeJourneeNuit = null; // (la journée qui a précédé la nuit, pour le bilan de l'aube)
let bateauDebutNuit = null; // (pour « rejouer la nuit » avec le bateau du coucher du soleil)
function commencerNuit({ depuisJournee = false, bateau: bateauGarde = null, reprise = null, resumeJournee = null } = {}) {
  jeu.radio.taire();
  if (journee) journeeFaite = journee;
  journee = null;
  resumeJourneeNuit = resumeJournee ?? reprise?.resumeJournee ?? (journeeFaite ? resumer(journeeFaite) : null);
  nuit = new Nuit({ radio: jeu.radio, difficulte: reprise?.difficulte ?? difficulte, graine: reprise?.graine ?? Math.floor(Math.random() * 1e6) });
  if (bateauGarde) depuisJournee = true;
  meteo = nuit.meteo;
  jeu.meteo = meteo;
  monde.regler(meteo);
  // au large, vent sur tribord à 140° : on file vers l'est, loin de la côte
  const cap = Math.round((meteo.directionVent - 140 + 360) % 360);
  physique.placer(DEPART_NUIT.x, DEPART_NUIT.z, cap, monde.houle);
  physique.vitesse.copy(physique.avant).multiplyScalar(3);
  physique.rotation.set(0, 0, 0);
  Object.assign(physique, { eauCale: 0, eauCockpit: 0, ecouteFocLibre: false, grandVoileDechiree: false, focDechire: false, ecouteGV: 0.8, ecouteFoc: 0.6 });
  if (!depuisJournee) {
    // directement la nuit : le bateau n'est pas prêt (un ris, le foc aux deux tiers, la
    // descente ouverte…) ; Jos donne la liste
    physique.ris = 1;
    physique.deroule = 0.6;
    Object.assign(etat, { feux: false, gilet: false, lampeEssayee: false, eclairage: 'eteint', regleurAuto: true, barometreLu: false, calerTemoin: 0 });
    barometre.calee = null;
    bateau.interieur.cire.visible = true;
    bateau.ouvrirDescente(true);
    ouvrirDescente(true);
    marin.attache = false;
    nuit.dire([
      `${JOS} pour Morgane. Tu pars pour la nuit sans avoir préparé ton bateau ? Alors vite, avant que ça souffle :`,
      'deux ris dans la grand-voile, le foc roulé aux deux tiers, ton gilet et ton ciré, les feux, la porte de la timonerie fermée, et ton harnais. La liste est en haut à gauche.',
    ]);
  }
  if (bateauGarde) appliquerBateau(bateauGarde);
  bateauDebutNuit = etatDuBateau();
  Object.assign(etat, {
    pilote: cap, dejaEmbarque: true, evenements: new Set(), majCiel: 0, majMer: 0,
    aubeEnAttente: false, soirEnAttente: false, eauCale: 0, feuxRappel: true,
  });
  if (reprise) {
    // (une nuit reprise : son heure, son eau, ses avaries, ce qui est déjà arrivé)
    nuit.restaurer(reprise.sauvegarde, contexteNuit(0));
    nuit.journal = (reprise.journal ?? []).map((e) => ({ ...e }));
    meteo = nuit.meteo;
    jeu.meteo = meteo;
    monde.regler(meteo);
    etat.eauCale = nuit.eau.cale;
  }
  marin.placer(-0.2, COCKPIT.plancher, zDe(0.17));
  marin.lacet = 0;
  marin.site = -0.12;
  siege.x = physique.mesures.angleVentApparent >= 0 ? 0.76 : -0.76;
  nuit
    .on('journal', majCarnet)
    .on('chapitre', (ch) => {
      annoncer(`Nuit · ${heureEnTexte(nuit.heure)}`, ch.titre);
      majCarnet();
      // (la partie est gardée au début de chaque chapitre)
      garderPartie({
        type: 'nuit', titre: ch.titre, heure: nuit.heure, difficulte: nuit.difficulte, graine: nuit.graine,
        sauvegarde: nuit.instantaneAGarder(), journal: nuit.journal.slice(-40), resumeJournee: resumeJourneeNuit,
      });
    })
    .on('deferlante-annonce', (a) => {
      audio.deferlante?.(a.force, a.dans);
      monde.deferlantes.annoncer(a);
      if (a.force > 0.7) afficherMessage(`Une grosse déferlante arrive ${cotePar(a.vers)} ! Tiens-toi (Maj)`);
    })
    .on('deferlante', (f) => {
      etat.calme = 0;
      enregistrement?.deferlantes.push({ heure: nuit.heure, force: f.force, angle: f.angle, gite: 0, suivi: 4 });
      secousse(0.35 + f.force * 0.9);
      monde.embruns.gerbe(f, physique);
      // l'eau verte passe par-dessus le livet et balaie le pont
      bateau.paquet.frapper(f.vers.clone().transformDirection(bateau.groupe.matrixWorld.clone().invert()), f.force);
      if (!monde.dansLaCabine) monde.gouttes.eclabousser(0.4 + f.force);
      // l'eau balaie le pont : elle pousse le marin (s'il ne se tient pas)
      if (etat.mode === 'pied' && marin.dehors && !commandes.maj) {
        const d = f.vers.clone().applyQuaternion(physique.orientation.clone().invert());
        marin.glissade.x += d.x * f.force * 3.2;
        marin.glissade.z += d.z * f.force * 3.2;
      }
    })
    .on('avarie', (nom) => {
      enregistrement?.avaries.push({ heure: nuit.heure, nom });
      if (nom === 'pilote') audio.alarme?.();
      else audio.dechirure?.(nom === 'ecouteFoc' ? 'claque' : 'dechire');
      afficherMessage({
        ecouteFoc: 'L\'écoute de foc a cassé ! Roule le foc (C, ou la bosse d\'enrouleur)',
        grandVoile: 'La grand-voile s\'est déchirée ! Affale-la au pied du mât',
        foc: 'Le foc s\'est déchiré ! Roule-le entièrement',
        pilote: 'Alarme : le pilote automatique a lâché ! Prends la barre (Q ou D)',
      }[nom]);
    })
    .on('etrange', (nom) => vivreEtrange(nom))
    .on('peur', (e) => vivrePeur(e))
    .on('scelerate', (w) => afficherMessage(`Une vague énorme arrive ${directionRelative(w.relatif)} ! Mets-la droit dans ton arrière, et accroche-toi (X)`))
    .on('scelerate-trou', () => audio.etouffer?.(2.6, 0.55))
    .on('scelerate-proche', () => {
      afficherMessage('La voilà ! Tiens-toi (Maj) !');
      audio.battement?.(1);
    })
    .on('scelerate-eclair', () => {
      // un éclair derrière elle : sa crête noire se découpe sur le ciel
      const v = monde.houle.scelerates[0];
      if (!v || monde.ecl.nuit < 0.3) return;
      const [cx, cz] = positionCrete(v, monde.houle.temps);
      monde.eclairSur(cx - v.dx * 650, cz - v.dz * 650);
    })
    .on('scelerate-choc', (c) => {
      etat.calme = 0;
      enregistrement?.deferlantes.push({ heure: nuit.heure, force: 1.6, angle: c.angle, gite: 0, suivi: 6, scelerate: true });
      secousse(1.6);
      audio.chocScelerate?.();
      monde.embruns.gerbe({ vers: c.vers, force: 1.6 }, physique);
      bateau.paquet.frapper(c.vers.clone().transformDirection(bateau.groupe.matrixWorld.clone().invert()), 1.7);
      if (!monde.dansLaCabine) monde.gouttes.eclabousser(2.2);
      // l'eau balaie le pont : elle emporte le marin qui ne se tient pas
      if (etat.mode === 'pied' && marin.dehors) {
        const d = c.vers.clone().applyQuaternion(physique.orientation.clone().invert());
        const k = commandes.maj ? 1.5 : 4.5;
        marin.glissade.x += d.x * k;
        marin.glissade.z += d.z * k;
        if (!marin.attache) marin.etourdi = Math.max(marin.etourdi, 1.2);
      }
    })
    .on('grain', (g) => {
      if (g.grain.faits.annoncer) afficherMessage(`Un grain arrive ${directionRelative(g.relatif)}, à ${(g.distance / 1852).toFixed(1).replace('.', ',')} mille : réduis la toile avant sa rafale`);
    })
    .on('grain-rafale', (g) => afficherMessage(g.faits.annoncer ? 'La rafale du grain ! Tiens ta barre, les vagues dans l\'arrière' : 'La rafale d\'un grain qui passe tout près ! Tiens ta barre'))
    .on('cargo', () => afficherMessage('Un cargo en route de collision ! Appelle-le à la radio (canal 16), dans la timonerie'))
    .on('cargo-klaxon', () => audio.corne?.(5))
    .on('trombe', () => afficherMessage('Une trombe marine ! Écarte-toi de sa route : lofe et file de travers au vent'))
    .on('trombe-proche', () => afficherMessage('La trombe arrive sur toi ! Harnais (X), et tiens-toi (Maj)'))
    .on('trombe-touche', ({ force }) => {
      // le tourbillon passe sur le bateau : il le couche et le fait tourner sur lui-même,
      // l'eau arrachée à la mer s'abat sur le pont, tout craque
      const vt = nuit.ventTrombe(physique.position.x, physique.position.z, new THREE.Vector3());
      if (vt.lengthSq() > 0.01) physique.deferlante(vt, 1.1 * force);
      physique.rotation.y += (Math.random() < 0.5 ? -1 : 1) * 0.8 * force;
      physique.eauCockpit = Math.min(EAU.cockpitMax, physique.eauCockpit + 220 * force);
      if (vt.lengthSq() > 0.01) bateau.paquet.frapper(vt.clone().normalize().transformDirection(bateau.groupe.matrixWorld.clone().invert()), force);
      secousse(1);
      audio.deferlante?.(1, 0.05);
      if (!monde.dansLaCabine) monde.gouttes.eclabousser(1.3);
      if (etat.mode === 'pied' && marin.dehors) {
        marin.glissade.addScaledVector(vt.setY(0).normalize(), 3.5 * force);
        if (!marin.attache) marin.etourdi = Math.max(marin.etourdi, 1.5);
      }
      afficherMessage('La trombe est sur le bateau !');
    })
    .on('eau', (seuil) => afficherMessage(seuil >= 1300 ? 'Le bateau s\'alourdit : pompe, vite !' : seuil >= 700 ? 'L\'eau monte dans la cabine : pompe !' : 'De l\'eau au-dessus des planchers : pompe (dans le cockpit, à bâbord)'))
    .on('perdue', (raison) => {
      sauverEnregistrement();
      finir(raison);
    })
    .on('aube', () => {
      sauverEnregistrement();
      oublierPartie(); // (la partie est finie : elle n'est plus à reprendre)
      etat.aubeEnAttente = true;
    });
  nouvelEnregistrement();
  document.getElementById('carnet-journal').innerHTML = '';
  leconAffichee = '';
  etat.mode = 'pause';
  etat.avantPause = 'barre';
  embarquer();
  majCarnet();
  afficherMessage(depuisJournee ? 'La nuit tombe. Le pilote tient la barre.' : 'La nuit tombe, et le bateau n\'est pas prêt : écoute Jos !');
}

// Après un naufrage : on reprend au début du chapitre (l'heure, l'eau, les avaries d'alors)
function recommencerNuit() {
  nuit.reprendre(contexteNuit(0));
  if (enregistrement) {
    const s = enregistrement.serie;
    const garder = s.heure.findIndex((h) => h > nuit.heure);
    if (garder >= 0) for (const cle of Object.keys(s)) s[cle].length = garder;
    enregistrement.deferlantes = enregistrement.deferlantes.filter((d) => d.heure <= nuit.heure);
    enregistrement.avaries = enregistrement.avaries.filter((a) => a.heure <= nuit.heure);
  }
  const p = physique.origine(new THREE.Vector3());
  if (distanceALaTerre(p.x, p.z) < 2000) p.z += 2500;
  const cap = Math.round((nuit.meteo.directionVent - 150 + 360) % 360);
  physique.placer(p.x, p.z, cap, monde.houle);
  physique.vitesse.copy(physique.avant).multiplyScalar(3);
  physique.rotation.set(0, 0, 0);
  physique.ecouteGV = 0.8;
  physique.ecouteFoc = 0.6;
  meteo = nuit.meteo;
  jeu.meteo = meteo;
  monde.regler(meteo);
  marin.placer(-0.2, COCKPIT.plancher, zDe(0.17));
  marin.attache = true;
  bateau.ouvrirDescente(false);
  ouvrirDescente(false);
  etat.pilote = nuit.avaries.pilote === 'panne' ? null : cap;
  etat.mode = 'pause';
  etat.avantPause = 'barre';
  embarquer();
  afficherMessage('On reprend au début du chapitre : harnais accroché, descente fermée');
}

// L'aube : le bilan de la nuit
function afficherAube() {
  etat.aubeEnAttente = false;
  document.exitPointerLock?.();
  etat.avantPause = etat.mode === 'pied' ? 'pied' : 'barre';
  etat.mode = 'pause';
  const lignes = nuit.bilan();
  // (si on a fait la journée avant : ses leçons)
  const r = resumeJourneeNuit;
  if (r) lignes.unshift(['La journée', `${r.reussies} leçon${r.reussies > 1 ? 's' : ''} réussie${r.reussies > 1 ? 's' : ''} sur ${r.total}${r.passees ? ` (${r.passees} passée${r.passees > 1 ? 's' : ''})` : ''}`]);
  document.getElementById('bilan-nuit').innerHTML = lignes.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  document.getElementById('difficulte-aube').textContent = DIFFICULTES[nuit.difficulte].nom;
  const note = nuit.note();
  const etoiles = document.getElementById('etoiles-aube');
  etoiles.innerHTML = '★'.repeat(note.etoiles) + `<span class="vide">${'★'.repeat(3 - note.etoiles)}</span>`;
  etoiles.setAttribute('aria-label', `${note.etoiles} étoile${note.etoiles > 1 ? 's' : ''} sur 3`);
  document.getElementById('titre-note').textContent = note.titre;
  document.getElementById('mot-jos').textContent = `« ${note.mot} » — Jos`;
  hud.hidden = true;
  document.getElementById('aube').hidden = false;
}

// La difficulté de la nuit (choisie sur l'accueil ou au coucher du soleil)
function remplirDifficultes(zone) {
  zone.innerHTML = '';
  const textes = {
    matelot: 'moins de déferlantes, le bateau prend moins l\'eau',
    marin: 'la vraie nuit, celle que Jos annonce',
    caphornier: 'plus de vent, plus de vagues, plus d\'avaries',
  };
  for (const [id, d] of Object.entries(DIFFICULTES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.difficulte = id;
    b.innerHTML = `${d.nom}<small>${textes[id]}</small>`;
    b.setAttribute('aria-pressed', String(id === difficulte));
    b.addEventListener('click', () => changerOptions({ difficulte: id }));
    zone.append(b);
  }
}
for (const z of document.querySelectorAll('.choix-difficulte')) remplirDifficultes(z);
function majDifficultes() {
  for (const x of document.querySelectorAll('[data-difficulte]')) x.setAttribute('aria-pressed', String(x.dataset.difficulte === difficulte));
}

// ---------- La partie gardée (pour la reprendre plus tard) ----------
// Au début de chaque leçon, au coucher du soleil, et au début de chaque chapitre de la
// nuit, le navigateur garde où l'on en est (et l'état du bateau : ris, foc, feux…).
const CLE_PARTIE = 'quart-de-nuit:partie';
function etatDuBateau() {
  return {
    ris: physique.ris, deroule: physique.deroule, feux: etat.feux, gilet: etat.gilet, lampeEssayee: etat.lampeEssayee,
    descenteOuverte: bateau.descenteOuverte, attache: marin.attache, regleurAuto: etat.regleurAuto,
  };
}
function appliquerBateau(b) {
  if (!b) return;
  physique.ris = b.ris;
  physique.deroule = b.deroule;
  Object.assign(etat, { feux: b.feux, gilet: b.gilet, lampeEssayee: b.lampeEssayee, regleurAuto: b.regleurAuto });
  bateau.interieur.cire.visible = !b.gilet;
  bateau.ouvrirDescente(b.descenteOuverte);
  ouvrirDescente(b.descenteOuverte);
  marin.attache = b.attache;
}
// ce que la journée a donné (pour le bilan de l'aube)
function resumer(j) {
  return { reussies: j.reussies.length, passees: j.passees.length, total: LECONS.length, virements: j.compteurs.virements, empannages: j.compteurs.empannages };
}
function garderPartie(partie) {
  try {
    localStorage.setItem(CLE_PARTIE, JSON.stringify({ version: 1, date: Date.now(), bateau: etatDuBateau(), ...partie }));
  } catch { /* stockage refusé : tant pis, on ne pourra pas reprendre */ }
}
function lirePartie() {
  try {
    const p = JSON.parse(localStorage.getItem(CLE_PARTIE) ?? 'null');
    return p?.version === 1 && ['journee', 'soir', 'nuit'].includes(p.type) ? p : null;
  } catch {
    return null;
  }
}
function oublierPartie() {
  try { localStorage.removeItem(CLE_PARTIE); } catch { /* rien à faire */ }
}
function reprendrePartie() {
  const p = lirePartie();
  if (!p) return;
  if (p.type === 'journee') commencerJournee({ reprise: p });
  else if (p.type === 'soir') commencerNuit({ bateau: p.bateau, resumeJournee: p.resumeJournee });
  else commencerNuit({ bateau: p.bateau, reprise: p });
}
// l'accueil : « Reprendre ta partie » s'il y en a une
function majAccueil() {
  const p = lirePartie();
  const bouton = document.getElementById('reprendre-partie');
  bouton.hidden = !p;
  if (!p) return;
  const d = new Date(p.date);
  const quand = `${d.toLocaleDateString('fr-FR', { weekday: 'long' })} à ${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
  document.getElementById('reprendre-detail').textContent = {
    journee: `La journée, leçon ${p.lecon + 1} : ${p.titre?.toLowerCase() ?? ''}`,
    soir: 'Le coucher du soleil : la nuit t\'attend',
    nuit: `La nuit, ${heureEnTexte(p.heure ?? 18.75)} : ${p.titre?.toLowerCase() ?? ''} (${DIFFICULTES[p.difficulte]?.nom ?? ''})`,
  }[p.type] + ` · ${quand}`;
}

// Revenir à l'accueil (la partie reste gardée : on pourra la reprendre)
function quitter() {
  jeu.radio.taire();
  journee = null;
  nuit = null;
  journeeFaite = null;
  document.exitPointerLock?.();
  etat.mode = 'accueil';
  etat.soirEnAttente = false;
  etat.aubeEnAttente = false;
  for (const id of ['pause', 'fin', 'soir', 'aube']) document.getElementById(id).hidden = true;
  hud.hidden = true;
  accueil.hidden = false;
  choisirAmbiance(idAmbiance);
  mettreALeau();
  physique.eauCale = 0;
  physique.eauCockpit = 0;
  etat.eauCale = 0;
  leconAffichee = '';
  afficherLecon();
  majAccueil();
}

// Une annonce au milieu de l'écran (le début d'une leçon)
let minuterieAnnonce = null;
function annoncer(petit, grand) {
  const a = document.getElementById('annonce');
  a.innerHTML = `<small>${petit}</small>${grand}`;
  a.classList.add('visible');
  clearTimeout(minuterieAnnonce);
  minuterieAnnonce = setTimeout(() => a.classList.remove('visible'), 3800);
}

// Le panneau de la leçon (en haut à gauche)
let leconAffichee = '';
function afficherLecon() {
  const panneau = document.getElementById('lecon');
  if (nuit) {
    afficherPanneau(panneau, nuit.panneau(contexteNuit(0)));
    return;
  }
  if (!journee) {
    panneau.hidden = true;
    return;
  }
  panneau.hidden = false;
  const heure = heureEnTexte(journee.heure);
  const fini = journee.etat === 'finie';
  const enTransition = journee.etat === 'transition';
  const numero = fini ? `Fin de la journée · ${heure}` : `Leçon ${journee.i + 1} / ${LECONS.length} · ${heure}`;
  const titre = journee.lecon?.titre ?? '';
  const objectif = fini ? 'Le bateau est paré pour la nuit.'
    : enTransition ? (journee.transition?.derniere ? 'Le soleil se couche…' : 'Réussi ! La suite dans un instant…')
      : journee.objectif;
  const liste = journee.liste ?? [];
  const p = enTransition || fini ? null : journee.progression;
  const cle = [numero, titre, objectif, liste.map((l) => `${l.texte}${l.fait}`).join('|'), p === null ? '' : Math.round(p * 50)].join('§');
  if (cle === leconAffichee) return;
  leconAffichee = cle;
  panneau.querySelector('.numero').textContent = numero;
  panneau.querySelector('.titre').textContent = titre;
  panneau.querySelector('.objectif').textContent = objectif;
  panneau.querySelector('.liste').innerHTML = liste.map((l) => `<li data-fait="${l.fait}">${l.texte}</li>`).join('');
  const barre = panneau.querySelector('.progression');
  barre.hidden = p === null;
  if (p !== null) barre.querySelector('i').style.width = `${Math.round(p * 100)}%`;
}

// La nuit, le même panneau : l'heure, le chapitre, l'objectif, et l'état du bord (chaque
// ligne : 'ok', 'alerte', 'danger', ou 'afaire' pour la préparation de la nuit)
function afficherPanneau(panneau, { numero, titre, objectif, liste, progression }) {
  panneau.hidden = false;
  const cle = [numero, titre, objectif, liste.map((l) => `${l.texte}${l.etat}`).join('|'), Math.round(progression * 200)].join('§');
  if (cle === leconAffichee) return;
  leconAffichee = cle;
  panneau.querySelector('.numero').textContent = numero;
  panneau.querySelector('.titre').textContent = titre;
  panneau.querySelector('.objectif').textContent = objectif;
  panneau.querySelector('.liste').innerHTML = liste.map((l) => `<li data-etat="${l.etat}">${l.texte}</li>`).join('');
  const barre = panneau.querySelector('.progression');
  barre.hidden = false;
  barre.querySelector('i').style.width = `${(progression * 100).toFixed(1)}%`;
}

// Le repère de la bouée vers laquelle on va : sur l'écran, ou au bord s'il est hors champ
const _p = new THREE.Vector3();
function afficherCible() {
  const repere = document.getElementById('cible');
  const c = journee?.cible;
  const b = c && journee.bouees.get(c.id);
  if (!b || (etat.mode !== 'barre' && etat.mode !== 'pied')) {
    repere.hidden = true;
    return;
  }
  const cam = monde.camera;
  _p.set(b.x, monde.houle.hauteur(b.x, b.z) + 4.8, b.z);
  const d = Math.hypot(b.x - physique.position.x, b.z - physique.position.z);
  _p.project(cam);
  const derriere = _p.z > 1;
  let x = (_p.x * 0.5 + 0.5) * innerWidth;
  let y = (-_p.y * 0.5 + 0.5) * innerHeight;
  let bord = '';
  if (derriere) {
    x = _p.x > 0 ? 24 : innerWidth - 24; // (derrière la caméra, la projection est inversée)
    y = innerHeight * 0.5;
  }
  if (derriere || x < 24 || x > innerWidth - 24) {
    bord = x < innerWidth / 2 ? 'gauche' : 'droite';
    x = THREE.MathUtils.clamp(x, 70, innerWidth - 70);
  }
  y = THREE.MathUtils.clamp(y, 90, innerHeight - 120);
  const nom = b.nom.replace('la bouée ', 'Bouée ');
  const texte = `${bord === 'gauche' ? '◀ ' : ''}${nom} · ${d < 1000 ? Math.round(d / 5) * 5 : (d / 1000).toFixed(1)} ${d < 1000 ? 'm' : 'km'}${bord === 'droite' ? ' ▶' : ''}`;
  const nomEl = repere.querySelector('.nom');
  if (nomEl.textContent !== texte) nomEl.textContent = texte;
  repere.dataset.bord = bord;
  repere.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
  repere.hidden = false;
}

// Le carnet de bord (touche L) : les leçons, les réflexes, le journal
function basculerCarnet() {
  etat.carnet = !etat.carnet;
  document.getElementById('carnet').hidden = !etat.carnet;
  if (etat.carnet) majCarnet();
}
function majCarnet() {
  const lecons = document.getElementById('carnet-lecons');
  const reflexes = document.getElementById('carnet-reflexes');
  const journal = document.getElementById('carnet-journal');
  if (nuit) {
    // la nuit : les leçons de la journée (si on l'a faite), ses réflexes, et le journal de la nuit
    const j = journeeFaite;
    lecons.innerHTML = j
      ? LECONS.map((l, i) => `<li data-n="${i + 1}" data-etat="${j.reussies.includes(i) ? 'faite' : 'avenir'}">${l.titre}</li>`).join('')
      : '<li data-n="·">Partie directement pour la nuit, sans les leçons.</li>';
    const liste = j?.reflexes.length ? j.reflexes : LECONS.map((l) => l.reflexe);
    reflexes.innerHTML = liste.map((r) => `<li>${r}</li>`).join('');
    journal.innerHTML = nuit.journal.slice(-14).map((e) => `<li><span class="h">${heureEnTexte(e.heure)}</span><span>${e.texte}</span></li>`).join('');
    return;
  }
  if (!journee) {
    lecons.innerHTML = '<li data-n="·">Navigation libre : pas de leçon aujourd\'hui.</li>';
    reflexes.innerHTML = '';
    journal.innerHTML = '';
    return;
  }
  lecons.innerHTML = LECONS.map((l, i) => {
    const etatLecon = i < journee.i || (i === journee.i && journee.etat !== 'lecon') ? 'faite' : i === journee.i ? 'encours' : 'avenir';
    return `<li data-n="${i + 1}" data-etat="${etatLecon}">${l.titre}</li>`;
  }).join('');
  reflexes.innerHTML = journee.reflexes.map((r) => `<li>${r}</li>`).join('');
  // (les dernières lignes du journal : la page n'est pas infinie)
  journal.innerHTML = journee.journal.slice(-14).map((e) => `<li><span class="h">${heureEnTexte(e.heure)}</span><span>${e.texte}</span></li>`).join('');
}

// Le soir : le bilan de la journée
function afficherSoir() {
  etat.soirEnAttente = false;
  document.exitPointerLock?.();
  etat.avantPause = etat.mode === 'pied' ? 'pied' : 'barre';
  etat.mode = 'pause';
  const c = journee.compteurs;
  const passees = journee.passees.length;
  const contournees = journee.journal.filter((e) => e.texte.startsWith('Contourné')).length;
  const lignes = [
    ['Leçons réussies', `${journee.reussies.length} sur ${LECONS.length}${passees ? ` (${passees} passée${passees > 1 ? 's' : ''})` : ''}`],
    ['Virements de bord', c.virements],
    ['Empannages', `${c.empannages}${c.empannagesSauvages ? ` (dont ${c.empannagesSauvages} sauvage${c.empannagesSauvages > 1 ? 's' : ''})` : ''}`],
    ['Bouées contournées', `${contournees} sur 2`],
    ['Coucher du soleil', heureEnTexte(journee.heure)],
  ];
  document.getElementById('bilan').innerHTML = lignes.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  hud.hidden = true;
  document.getElementById('soir').hidden = false;
}

// ---------- La caméra ----------
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _qTete = new THREE.Quaternion();
function placerCamera(dt) {
  const cam = monde.camera;
  if (etat.mode === 'accueil') {
    // un lent travelling autour du bateau
    etat.orbite += dt * 0.045;
    const cible = bateau.groupe.position.clone().add(new THREE.Vector3(0, 3.2, 0));
    const a = etat.orbite + 2.2;
    cam.position.set(cible.x + Math.cos(a) * 19, 0, cible.z + Math.sin(a) * 19);
    cam.position.y = Math.max(monde.houle.hauteur(cam.position.x, cam.position.z) + 3.2, cible.y + 1);
    cam.lookAt(cible.x - 4, cible.y, cible.z);
    return;
  }
  // la tête tourne avec la souris
  if (etat.mode === 'barre' || etat.mode === 'pied' || etat.mode === 'poste') {
    const souris = commandes.lireSouris();
    const k = 0.0022 * options.sensibilite;
    marin.lacet -= souris.dx * k;
    marin.site = THREE.MathUtils.clamp(marin.site - souris.dy * k * (options.inverser ? -1 : 1), -1.35, 1.4);
    if (etat.mode === 'barre') marin.lacet = THREE.MathUtils.clamp(marin.lacet, -2.9, 2.9);
  }
  const aLaBarre = etat.mode === 'barre' || (etat.mode !== 'pied' && etat.mode !== 'poste' && etat.avantPause === 'barre');
  const auPoste = etat.mode === 'poste' || (etat.mode !== 'pied' && etat.mode !== 'barre' && etat.avantPause === 'poste');
  let local;
  if (auPoste) {
    // assis au poste de pilotage, face au pare-brise
    local = YEUX_POSTE.clone();
  } else if (aLaBarre) {
    // assis au vent, la barre à la main
    const auVent = physique.mesures.angleVentApparent >= 0 ? 1 : -1;
    siege.x += (auVent * Bateau.POSTES.barreur.x - siege.x) * Math.min(1, dt * 1.1);
    local = Bateau.POSTES.barreur.clone();
    local.x = siege.x;
  } else {
    local = marin.position.clone();
    local.y += marin.hauteurYeux();
  }
  cam.position.copy(local).applyMatrix4(bateau.groupe.matrixWorld);
  // la tête compense une partie du roulis et du tangage (debout, on se tient plus droit) ;
  // l'option « horizon stable » la fait compenser presque tout (contre le mal de mer)
  _e.setFromQuaternion(physique.orientation, 'YXZ');
  const naturel = aLaBarre || auPoste ? 0.5 : 0.35;
  const compense = naturel + (0.92 - naturel) * options.stabilisation;
  _e.x *= Math.min(1, compense + 0.1);
  _e.z *= compense;
  _q.setFromEuler(_e);
  _qTete.setFromEuler(new THREE.Euler(marin.site, marin.lacet, 0, 'YXZ'));
  cam.quaternion.copy(_q).multiply(_qTete);
  // secousses (chocs, claques de vague)
  if (secousseForce > 0.001 && !options.secousses) secousseForce = 0;
  if (secousseForce > 0.001) {
    cam.rotateX((Math.random() - 0.5) * secousseForce * 0.06);
    cam.rotateY((Math.random() - 0.5) * secousseForce * 0.06);
    secousseForce *= Math.exp(-dt * 6);
  }
}

// ---------- L'interface ----------
const accueil = document.getElementById('accueil');
const hud = document.getElementById('hud');
const pause = document.getElementById('pause');
const fin = document.getElementById('fin');
const LISTE_AMBIANCES = ['matin-calme', 'midi', 'fin-apres-midi', 'coucher-menacant', 'nuit-tempete', 'aube'];
function remplirAmbiances(zone) {
  zone.innerHTML = '';
  for (const id of LISTE_AMBIANCES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = AMBIANCES[id].nom;
    b.dataset.id = id;
    b.setAttribute('aria-pressed', String(id === idAmbiance));
    b.addEventListener('click', () => choisirAmbiance(id));
    zone.append(b);
  }
}
function choisirAmbiance(id) {
  idAmbiance = id;
  meteo = etatMeteo(AMBIANCES[id]);
  jeu.meteo = meteo;
  monde.regler(meteo);
  if (monde.ecl.nuit > 0.5) etat.feux = true;
  for (const b of document.querySelectorAll('.choix button')) b.setAttribute('aria-pressed', String(b.dataset.id === id));
}
remplirAmbiances(document.getElementById('choix-ambiance'));
remplirAmbiances(document.getElementById('choix-ambiance-pause'));

const AIDE = {
  barre: [
    [`${TOUCHES.barreGauche.nom} ${TOUCHES.barreDroite.nom}`, 'tourner : à gauche, à droite'],
    [`${TOUCHES.borderGV.nom} ${TOUCHES.choquerGV.nom}`, 'grand-voile : border, choquer'],
    [`${TOUCHES.borderFoc.nom} ${TOUCHES.choquerFoc.nom}`, 'foc : border, choquer'],
    [`${TOUCHES.enrouler.nom} ${TOUCHES.derouler.nom}`, 'foc : enrouler, dérouler'],
    [TOUCHES.pilote.nom, 'pilote automatique'],
    [TOUCHES.regleur.nom, 'réglage automatique des voiles'],
    [TOUCHES.harnais.nom, 'harnais : s\'attacher, se détacher'],
    [TOUCHES.lever.nom, 'se lever (marcher sur le pont)'],
    [`${TOUCHES.lampe.nom} · ${TOUCHES.carnet.nom}`, 'lampe frontale · carnet de bord'],
    [`${TOUCHES.passerPhrase.nom} · ${TOUCHES.aide.nom}`, 'passer la phrase · cacher l\'aide'],
  ],
  poste: [
    [`${TOUCHES.barreGauche.nom} ${TOUCHES.barreDroite.nom}`, 'cap du pilote : 1° de moins, de plus'],
    ['E', 'agir sur ce que tu regardes (VHF, radar…)'],
    [`Maj + ${TOUCHES.barreGauche.nom} ${TOUCHES.barreDroite.nom}`, 'cap du pilote : 10° de moins, de plus'],
    [TOUCHES.pilote.nom, 'pilote automatique : l\'enclencher, le débrayer'],
    [TOUCHES.lever.nom, 'se lever'],
    [`${TOUCHES.lampe.nom} · ${TOUCHES.carnet.nom}`, 'lampe frontale · carnet de bord'],
    [`${TOUCHES.passerPhrase.nom} · ${TOUCHES.aide.nom}`, 'passer la phrase · cacher l\'aide'],
  ],
  pied: [
    ['Z Q S D', 'marcher'],
    ['E', 'agir sur ce que tu regardes'],
    ['Maj + E', 'l\'action inverse (choquer…)'],
    ['Maj', 'se tenir (on ne glisse plus)'],
    [TOUCHES.accroupir.nom, 's\'accroupir'],
    [TOUCHES.harnais.nom, 'harnais : s\'attacher, se détacher'],
    [TOUCHES.pilote.nom, 'pilote automatique'],
    [`${TOUCHES.lampe.nom} · ${TOUCHES.carnet.nom}`, 'lampe frontale · carnet de bord'],
    [`${TOUCHES.passerPhrase.nom} · ${TOUCHES.aide.nom}`, 'passer la phrase · cacher l\'aide'],
  ],
};
let modeAide = null;
function majAide() {
  const enMain = etat.geste && /winch|ecoute|enrouleur/.test(etat.geste.id);
  document.getElementById('viseur').hidden = etat.mode !== 'pied' && etat.mode !== 'poste';
  // (les jauges de réglage : quand on tient une écoute, et pas tant que les voiles se règlent seules)
  document.getElementById('reglages').hidden = (etat.mode !== 'barre' && !enMain) || (etat.regleurAuto && (!!journee || !!nuit));
  if (modeAide === etat.mode) return;
  modeAide = etat.mode;
  const liste = AIDE[etat.mode] ?? AIDE.barre;
  document.getElementById('aide-touches').innerHTML = liste.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')
    + '<dt>Échap</dt><dd>pause</dd>';
}

let minuterieMessage = null;
function afficherMessage(texte) {
  const m = document.getElementById('message');
  m.textContent = texte;
  m.classList.add('visible');
  clearTimeout(minuterieMessage);
  minuterieMessage = setTimeout(() => m.classList.remove('visible'), 3400);
}

function cote(angle) {
  const a = Math.round(Math.abs(angle));
  if (a < 3) return 'de face';
  if (a > 177) return 'de l\'arrière';
  return `${a}° ${angle > 0 ? 'tribord' : 'bâbord'}`;
}
function afficherInstruments() {
  const m = physique.mesures;
  const cases = [
    ['Vitesse', m.vitesse.toFixed(1), 'nds'],
    ['Cap', String(Math.round(m.cap) % 360).padStart(3, '0'), '°'],
    ['Gîte', Math.abs(m.gite).toFixed(0), '°'],
    ['Vent apparent', m.ventApparent.toFixed(0), 'nds'],
    ['… venant de', cote(m.angleVentApparent), ''],
    ['Vent réel', vent.vitesse.toFixed(0), 'nds'],
  ];
  // (le baromètre : ce que montre son aiguille ; la flèche, ce qu'il fait en ce moment)
  if (barometre.aiguille !== null) {
    const h = heureIci();
    cases.push(['Baromètre', Math.round(barometre.aiguille), ` hPa ${h === null ? '' : fleche(tendanceRecente(h))}`]);
  }
  document.getElementById('instruments').innerHTML = cases.map(([e, v, u]) =>
    `<div class="instrument"><span class="etiquette">${e}</span><span class="valeur">${v}<span class="unite">${u}</span></span></div>`).join('');
  for (const [id, incidence] of [['jauge-gv', m.incidenceGV], ['jauge-foc', m.incidenceFoc]]) {
    const j = document.getElementById(id);
    const e = etatReglage(incidence);
    j.dataset.etat = e;
    j.querySelector('i').style.left = `${THREE.MathUtils.clamp(incidence / 45, 0, 1) * 100}%`;
    j.querySelector('.etat').textContent = { faseye: 'faseye : borde', bon: 'bien réglée', 'trop-bordee': 'trop bordée : choque' }[e];
  }
  // le harnais et le pilote
  const h = document.getElementById('harnais');
  h.dataset.attache = String(marin.attache);
  h.textContent = marin.attache ? 'Harnais : attaché' : `Harnais : détaché (${TOUCHES.harnais.nom})`;
  h.hidden = etat.mode !== 'pied' || !marin.dehors;
  document.getElementById('pilote').textContent = etat.pilote !== null ? `Pilote : cap ${String(etat.pilote).padStart(3, '0')}°` : '';
  document.getElementById('regleur').textContent = etat.regleurAuto ? 'Réglage automatique des voiles' : '';
  document.getElementById('gilet').hidden = !etat.gilet;
  document.getElementById('gilet').textContent = 'Gilet de sauvetage';
  majAide();
  afficherLecon();
}

// le compas, à la barre : le cap, le cap voulu (barre assistée ou pilote), d'où vient le
// vent et le cône où l'on ne peut pas aller ; la nuit, au plus fort, la zone de la fuite
const compas = new Compas(document.getElementById('compas'));
function afficherCompas() {
  const visible = etat.mode === 'barre' || etat.mode === 'poste';
  const zone = document.getElementById('compas');
  if (zone.hidden === visible) zone.hidden = !visible;
  if (!visible) return;
  const m = physique.mesures;
  const pilote = etat.pilote !== null;
  compas.dessiner({
    cap: m.cap,
    capVoulu: pilote ? etat.pilote : options.barreAssistee ? barreAssistee.capVoulu : null,
    pilote,
    vent: vent.vitesse > 2 ? BarreAssistee.origineDuVent(m) : null,
    fuite: !!nuit && meteo.vent >= 30,
  });
}

// ce que l'on vise (au centre de l'écran) : « E : border · Maj + E : choquer »
let gesteAffiche = '';
function afficherGeste() {
  const zone = document.getElementById('geste');
  const g = etat.geste;
  if (!g || (etat.mode !== 'pied' && etat.mode !== 'poste')) {
    if (!zone.hidden) zone.hidden = true;
    gesteAffiche = '';
    return;
  }
  const texte = (a) => (typeof a.texte === 'function' ? a.texte() : a.texte);
  const actions = [];
  if (g.principal) actions.push(`<kbd>E</kbd> ${texte(g.principal)}`);
  if (g.secondaire) actions.push(`<kbd>Maj + E</kbd> ${texte(g.secondaire)}`);
  const longue = etat.action?.geste === g && etat.action.geste[etat.action.cle].duree;
  const p = longue ? Math.round(etat.action.progression * 100) : null;
  const html = `<span class="titre">${g.titre()}</span><span class="actions">${actions.join(' · ')}</span>`
    + (p !== null ? `<span class="progression"><i style="width:${p}%"></i></span>` : '');
  if (html !== gesteAffiche) {
    zone.innerHTML = html;
    gesteAffiche = html;
  }
  zone.hidden = false;
}

function embarquer() {
  audio.demarrer();
  if (etat.mode === 'pause') {
    etat.mode = etat.avantPause;
  } else {
    etat.mode = 'barre';
    marin.lacet = 0;
    marin.site = -0.12;
    siege.x = physique.mesures.angleVentApparent >= 0 ? 0.76 : -0.76;
    barreAssistee.reprendre(physique.mesures.cap);
  }
  accueil.hidden = true;
  pause.hidden = true;
  fin.hidden = true;
  document.getElementById('soir').hidden = true;
  hud.hidden = false;
  commandes.capturer();
  commandes.lireAppuis();
  if (!etat.dejaEmbarque) {
    // au premier embarquement, le pilote tient la barre le temps de prendre ses marques
    etat.dejaEmbarque = true;
    etat.pilote = Math.round(physique.mesures.cap);
    afficherMessage('Le pilote tient la barre : Q ou D pour la prendre, Espace pour te lever');
  }
  majAide();
}

// Fin de partie : par-dessus bord
function finir(raison) {
  if (etat.mode === 'fin') return;
  etat.mode = 'fin';
  etat.action = null;
  document.exitPointerLock?.();
  hud.hidden = true;
  const textes = {
    horsBord: ['Un homme à la mer', 'Le bateau s\'est couché et tu as passé les filières. Accroché à la ligne de vie (X), le harnais t\'aurait retenu.'],
    bome: ['Assommé par la bôme', 'Pendant l\'empannage, la bôme a traversé le cockpit et t\'a jeté à l\'eau. Accroupis-toi ou reste à l\'écart quand le vent passe derrière.'],
    cailloux: ['Sur les cailloux', 'Le bateau a touché les rochers de la côte. Au large, on a toujours de l\'eau sous la quille : garde tes distances avec la terre.'],
    emporte: ['Emporté par une déferlante', 'Une vague a balayé le bateau couché, et tu n\'étais pas attaché. Dans la tempête, le harnais reste accroché, même à la barre (X).'],
    naufrage: ['Le bateau a coulé', 'Trop d\'eau à bord : Morgane s\'est alourdie, puis enfoncée. Garde la porte de la timonerie fermée, et pompe dès que l\'eau passe au-dessus des planchers.'],
    chavirage: ['Chaviré', 'Le bateau s\'est retourné et n\'a pas pu se redresser. Moins de toile, et jamais les déferlantes de travers : mets-les sur l\'arrière.'],
    collision: ['Abordé par le cargo', 'Le cargo ne t\'a pas vu. La nuit, allume tes feux ; et quand un navire vient sur toi, appelle-le à la radio (canal 16) ou écarte-toi franchement.'],
  };
  const [titre, texte] = textes[raison] ?? textes.horsBord;
  document.getElementById('titre-fin').textContent = titre;
  document.getElementById('texte-fin').textContent = texte;
  document.getElementById('recommencer').textContent = nuit ? 'Reprendre au début du chapitre' : journee ? 'Reprendre la leçon' : 'Reprendre la mer';
  journee?.ecrire({ horsBord: 'Un homme à la mer !', bome: 'Assommé par la bôme.', cailloux: 'Échoué sur les cailloux.' }[raison] ?? 'Incident à bord.');
  if (nuit?.etat === 'nuit') nuit.perdre(raison, contexteNuit(0));
  fin.hidden = false;
}
function recommencer() {
  if (nuit) {
    recommencerNuit();
    return;
  }
  if (journee) {
    // pendant la journée, on reprend la leçon en cours, le bateau remis en route (et
    // éloigné des cailloux s'il les a touchés)
    const p = physique.origine(new THREE.Vector3());
    if (distanceALaTerre(p.x, p.z) < 1200) p.z += 1500;
    physique.placer(p.x, p.z, (meteo.directionVent - 65 + 360) % 360, monde.houle);
    physique.vitesse.copy(physique.avant).multiplyScalar(2);
    journee.reprendre(contexteJournee(0));
  } else {
    mettreALeau();
  }
  marin.placer(-0.2, COCKPIT.plancher, zDe(0.17));
  marin.attache = false;
  etat.pilote = Math.round(physique.mesures.cap || (meteo.directionVent + 60) % 360);
  etat.mode = 'pause';
  etat.avantPause = 'barre';
  embarquer();
}

// naviguer librement : on quitte la journée (s'il y en avait une)
function naviguerLibrement() {
  if (journee || nuit) {
    journee = null;
    nuit = null;
    jeu.radio.taire();
    choisirAmbiance(idAmbiance);
    leconAffichee = '';
    afficherLecon();
  }
  embarquer();
}
document.getElementById('embarquer').addEventListener('click', naviguerLibrement);
document.getElementById('commencer-journee').addEventListener('click', () => commencerJournee());
document.getElementById('reprendre-partie').addEventListener('click', reprendrePartie);
document.getElementById('quitter').addEventListener('click', quitter);
// (le carnet s'ouvre par-dessus le jeu : un clic sur l'image reprend, L le ferme)
document.getElementById('pause-carnet').addEventListener('click', () => {
  pause.hidden = true;
  if (!etat.carnet) basculerCarnet();
});
document.getElementById('recommencer-ici').addEventListener('click', () => {
  if (nuit) {
    if (nuit.etat === 'nuit') recommencerNuit();
    return;
  }
  journee?.reprendre();
  embarquer();
});
document.getElementById('reprendre').addEventListener('click', embarquer);
document.getElementById('recommencer').addEventListener('click', recommencer);
document.getElementById('rejouer-journee').addEventListener('click', () => {
  document.getElementById('soir').hidden = true;
  commencerJournee();
});
document.getElementById('continuer').addEventListener('click', () => {
  // on continue de naviguer dans le soir qui tombe, sans leçon
  document.getElementById('soir').hidden = true;
  journee = null;
  leconAffichee = '';
  afficherLecon();
  embarquer();
});
// la nuit : après la journée (le bateau tel qu'on l'a préparé), ou directement
document.getElementById('commencer-nuit').addEventListener('click', () => {
  document.getElementById('soir').hidden = true;
  commencerNuit({ depuisJournee: true });
});
document.getElementById('nuit-directe').addEventListener('click', () => commencerNuit());
document.getElementById('rejouer-nuit').addEventListener('click', () => {
  document.getElementById('aube').hidden = true;
  commencerNuit({ bateau: bateauDebutNuit, resumeJournee: resumeJourneeNuit });
});
document.getElementById('rejouer-journee-aube').addEventListener('click', () => {
  document.getElementById('aube').hidden = true;
  nuit = null;
  commencerJournee();
});
document.getElementById('continuer-aube').addEventListener('click', () => {
  // le jour se lève : on navigue librement sur la mer qui se calme
  document.getElementById('aube').hidden = true;
  nuit = null;
  leconAffichee = '';
  afficherLecon();
  embarquer();
});
document.getElementById('passer-lecon').addEventListener('click', () => {
  journee?.passer(contexteJournee(0));
  embarquer();
});
canvas.addEventListener('click', () => { if (etat.mode === 'pause') embarquer(); });
document.addEventListener('pointerlockchange', () => {
  // (etat.essai : les outils de mise au point jouent sans souris capturée)
  if ((etat.mode === 'barre' || etat.mode === 'pied' || etat.mode === 'poste') && document.pointerLockElement !== canvas && !etat.essai) {
    // la souris est libérée (Échap) : pause (le bateau continue de naviguer)
    etat.avantPause = etat.mode;
    etat.mode = 'pause';
    document.getElementById('temps-pause').hidden = !!journee || !!nuit;
    document.getElementById('passer-lecon').hidden = !journee || journee.etat !== 'lecon';
    const ici = document.getElementById('recommencer-ici');
    ici.hidden = !(journee?.etat === 'lecon' || nuit?.etat === 'nuit');
    ici.textContent = nuit ? 'Recommencer au début du chapitre' : 'Recommencer la leçon';
    document.getElementById('quitter').textContent = journee || nuit ? 'Quitter (la partie est gardée)' : 'Quitter';
    document.getElementById('pause-ou').textContent = nuit
      ? `Nuit · ${heureEnTexte(nuit.heure)} · ${nuit.chapitre.titre}`
      : journee ? `Leçon ${journee.i + 1} : ${journee.lecon?.titre ?? ''} · ${heureEnTexte(journee.heure)}` : 'Navigation libre';
    pause.hidden = false;
  }
});

// ---------- La fenêtre des options ----------
const fenetreOptions = document.getElementById('options');
const TEXTES_QUALITE = {
  economique: 'Pour un ordinateur modeste : moins de pixels, de nuages et de pluie.',
  moyenne: 'Un bon équilibre pour la plupart des ordinateurs.',
  haute: 'L\'image prévue : il faut un ordinateur assez récent.',
  superbe: 'Le plus fin (écran Retina) : pour un ordinateur puissant.',
};
{
  const zone = document.getElementById('choix-qualite');
  for (const [id, q] of Object.entries(QUALITES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.qualite = id;
    b.textContent = q.nom;
    b.addEventListener('click', () => changerOptions({ qualite: id }));
    zone.append(b);
  }
  const curseurs = {
    sensibilite: (v) => `× ${v.toFixed(1).replace('.', ',')}`,
    champ: (v) => `${v}°`,
    stabilisation: (v) => (v === 0 ? 'comme en vrai' : `${Math.round(v * 100)} %`),
    volume: (v) => `${Math.round(v * 100)} %`,
  };
  for (const cle of Object.keys(curseurs)) {
    document.getElementById(`o-${cle}`).addEventListener('input', (e) => changerOptions({ [cle]: Number(e.target.value) }));
  }
  for (const cle of ['inverser', 'secousses', 'gouttes', 'clignotements', 'voix', 'sousTitres', 'barreAssistee']) {
    document.getElementById(`o-${cle}`).addEventListener('change', (e) => changerOptions({ [cle]: e.target.checked }));
  }
  for (const b of document.querySelectorAll('[data-nuit]')) b.addEventListener('click', () => changerOptions({ nuit: b.dataset.nuit }));
  majFenetreOptions.curseurs = curseurs;
}
function majFenetreOptions() {
  if (!fenetreOptions) return;
  for (const b of document.querySelectorAll('[data-qualite]')) b.setAttribute('aria-pressed', String(b.dataset.qualite === options.qualite));
  document.getElementById('note-qualite').textContent = TEXTES_QUALITE[options.qualite];
  for (const [cle, texte] of Object.entries(majFenetreOptions.curseurs ?? {})) {
    document.getElementById(`o-${cle}`).value = options[cle];
    document.getElementById(`v-${cle}`).textContent = texte(options[cle]);
  }
  for (const cle of ['inverser', 'secousses', 'gouttes', 'clignotements', 'voix', 'sousTitres', 'barreAssistee']) document.getElementById(`o-${cle}`).checked = options[cle];
  for (const b of document.querySelectorAll('[data-nuit]')) b.setAttribute('aria-pressed', String(b.dataset.nuit === options.nuit));
  document.getElementById('o-sousTitres').disabled = !options.voix; // (sans la voix, les sous-titres restent)
}
function ouvrirFenetre(id) {
  const f = document.getElementById(id);
  majFenetreOptions();
  if (!f.open) f.showModal();
}
document.getElementById('ouvrir-options').addEventListener('click', () => ouvrirFenetre('options'));
document.getElementById('pause-options').addEventListener('click', () => ouvrirFenetre('options'));
document.getElementById('ouvrir-apropos').addEventListener('click', () => ouvrirFenetre('apropos'));

// ---------- Au démarrage ----------
appliquerOptions(options);
majAccueil();
// un téléphone : le jeu se joue au clavier et à la souris
if (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 520) {
  document.getElementById('telephone').hidden = false;
}
// on prépare tous les shaders (la trombe, le cargo, les déferlantes… n'apparaissent
// qu'en pleine nuit : les préparer à ce moment-là ferait sauter l'image)
{
  const boutons = [...accueil.querySelectorAll('button')];
  for (const b of boutons) b.disabled = true;
  const chargement = document.getElementById('chargement');
  const pret = () => {
    for (const b of boutons) b.disabled = false;
    chargement.textContent = '';
  };
  // (après deux images : le ciel et la lumière sont en place ; mais un onglet resté en
  // arrière-plan ne dessine pas d'image : une minuterie prend le relais. Et quoi qu'il
  // arrive, au bout de 10 s, on peut jouer.)
  let lance = false;
  const lancer = () => {
    if (lance) return;
    lance = true;
    // (les bouées de la journée aussi : trois bouées très loin, le temps de la préparation)
    const loin = new Map(['jaune', 'rouge', 'verte'].map((couleur, k) => [`preparation-${k}`, { couleur, x: k * 10, z: -90000 }]));
    bouees.maj(loin, 0, 0);
    const fin = () => {
      bouees.maj(journee?.bouees ?? new Map(), monde.temps, monde.ecl.nuit);
      pret();
    };
    monde.precompiler().then(fin, fin);
  };
  requestAnimationFrame(() => requestAnimationFrame(lancer));
  setTimeout(lancer, 1500);
  setTimeout(pret, 10000);
}

// ---------- La boucle ----------
let dernier = performance.now();
let ageInstruments = 0;
// (outils de vérification : avancer le temps et photographier, depuis la console)
async function photographier(nom, secondes = 0.5) {
  const images = Math.max(2, Math.round(secondes * 60));
  for (let i = 0; i < images - 1; i++) {
    monde.image(1 / 60, { simuler, placerCamera });
    if (i % 30 === 29) await new Promise((r) => setTimeout(r, 0));
  }
  monde.image(1 / 60, { simuler, placerCamera });
  const image = monde.photo();
  const reponse = await fetch('/__capture', { method: 'POST', body: JSON.stringify({ nom, image }) });
  return reponse.text();
}
// (faire avancer le jeu de quelques secondes, même si le navigateur ralentit l'onglet)
async function avancer(secondes) {
  const images = Math.round(secondes * 60);
  for (let i = 0; i < images; i++) {
    monde.image(1 / 60, { simuler, placerCamera });
    if (i % 30 === 29) await new Promise((r) => setTimeout(r, 0));
  }
  afficherInstruments();
  afficherCible();
}
// (l'atelier des performances : faire tourner le jeu quelques secondes en mesurant chaque
// morceau du calcul ; gpu : en attendant la carte graphique après chaque morceau)
async function profiler(secondes = 20, { gpu = true } = {}) {
  const c = monde.chrono;
  c.images = [];
  c.actif = true;
  c.gpu = gpu;
  const images = Math.round(secondes * 60);
  for (let i = 0; i < images; i++) {
    monde.image(1 / 60, { simuler, placerCamera });
    if (i % 30 === 29) await new Promise((r) => setTimeout(r, 0));
  }
  c.actif = false;
  const parSection = {};
  for (const im of c.images) {
    for (const [k, v] of Object.entries(im)) if (k !== 'temps') (parSection[k] ??= []).push(v);
  }
  const arrondi = (x) => Math.round(x * 100) / 100;
  const stats = {};
  for (const [k, v] of Object.entries(parSection)) {
    const tri = [...v].sort((a, b) => a - b);
    stats[k] = { parImage: arrondi(v.reduce((a, b) => a + b, 0) / c.images.length), p95: arrondi(tri[Math.floor(tri.length * 0.95)]), max: arrondi(tri.at(-1)), fois: v.length };
  }
  const pires = [...c.images].sort((a, b) => b.total - a.total).slice(0, 8)
    .map((im) => Object.fromEntries(Object.entries(im).map(([k, v]) => [k, arrondi(v)])));
  return { stats, pires };
}

// (tourner la tête du marin vers un point du monde)
function regarder(x, y, z) {
  const cam = monde.camera.position;
  const d = new THREE.Vector3(x - cam.x, y - cam.y, z - cam.z).applyQuaternion(physique.orientation.clone().invert());
  marin.lacet = Math.atan2(-d.x, -d.z);
  marin.site = Math.atan2(d.y, Math.hypot(d.x, d.z));
}
window.__jeu = {
  monde, physique, bateau, etat, marin, jeu, gestes, embarquer, choisirAmbiance, photographier, avancer, commandes, Audio, seLever, finir,
  commencerJournee, get journee() { return journee; }, passer: () => journee?.passer(contexteJournee(0)), bouees,
  commencerNuit, get nuit() { return nuit; }, contexteNuit, regarder, profiler,
  uneImage: (dt = 1 / 60) => monde.image(dt, { simuler, placerCamera }),
  // (l'inspection du pont : le plan où l'on marche colle-t-il au modèle 3D ?)
  // (l'étrange, à la demande, pour l'entendre et le voir : 'lumiere', 'voix16', 'coups', 'sansReponse')
  peur: (nom) => vivreEtrange(nom),
  inspecterPont: async (o) => (await import('./atelier/inspection-pont.js')).inspecterPont(bateau, { encombrement: marin.encombrement, ...o }),
  // (les essais de marche : un marin automatique fait le tour du bord et manie chaque chose)
  essayerLaMarche: async (o) => {
    const { essayerLaMarche } = await import('./atelier/essais-marche.js');
    etat.fige = true;
    try {
      return await essayerLaMarche({
        marin, gestes, gesteVise, commandes, seLever, bateau, regarder, obstacle: porteFermeeEntre,
        uneImage: (dt) => monde.image(dt, { simuler, placerCamera }),
        basculerDescente: () => jeu.basculerDescente(),
      }, o);
    } finally {
      etat.fige = false;
    }
  },
  // (les essais d'entrée : un marin automatique vise à peu près la porte ou l'escalier, de
  // plusieurs endroits ; la carte des passages les trace, vus de dessus, dans captures/)
  essayerLesEntrees: async ({ de = 0, nombre = Infinity, carte = null } = {}) => {
    const { essayerLesEntrees, essaisEntree } = await import('./atelier/essais-marche.js');
    const essais = essaisEntree(TIMONERIE.zArriere).slice(de, de + nombre);
    etat.fige = true;
    try {
      const r = await essayerLesEntrees({
        marin, commandes, seLever, bateau,
        uneImage: (dt) => monde.image(dt, { simuler, placerCamera }),
        basculerDescente: () => jeu.basculerDescente(),
      }, { essais });
      (window.__cheminsEssais ??= []).push(...r.map((x) => ({ points: x.points, ok: x.ok })));
      if (carte) await window.__jeu.carteDesPassages(carte, { chemins: window.__cheminsEssais });
      const lignes = r.map((x) => `${x.ok ? '✓' : '✗'} ${x.nom} : ${x.secondes.toFixed(1)} s, bloqué ${x.pireBlocage.toFixed(1)} s au pire${x.ok ? '' : ` — arrêté en (${x.fin.map((v) => v.toFixed(2)).join(', ')}), ${x.zone}`}`);
      // (gardées aussi dans la page : une longue série peut dépasser le temps d'attente de l'outil)
      (window.__resultatsEssais ??= []).push(...lignes);
      return lignes;
    } finally {
      etat.fige = false;
    }
  },
  // (d'où atteint-on chaque chose ? zone par zone, debout et accroupi)
  carteDesGestes: async (o) => {
    const { carteDesGestes } = await import('./atelier/essais-marche.js');
    const { surfacesEn } = await import('./joueur/pont.js');
    const r = carteDesGestes({ marin, gestes, gesteVise, obstacle: porteFermeeEntre, surfacesEn }, o);
    return Object.entries(r).map(([id, x]) => `${id} : ${Object.entries(x.zones).map(([z, n]) => `${z} ${n}`).join(', ') || 'nulle part !'} — au plus loin ${x.plusLoin.toFixed(2)} m, depuis ${x.depuis ?? '—'}`);
  },
  carteDesPassages: async (nom = 'carte-passages', o = {}) => {
    const { dessinerCartePassages } = await import('./atelier/carte-passages.js');
    const reperes = [
      [0, TIMONERIE.zArriere, 'porte'], [SIEGE.x, SIEGE.z, 'siège'], [bateau.interieur.positionCire.x, bateau.interieur.positionCire.z, 'ciré'],
      [bateau.interieur.positionTableau.x, bateau.interieur.positionTableau.z, 'tableau'], [0, 2.47, 'barre'],
    ];
    const image = dessinerCartePassages(marin, { reperes, ...o });
    return (await fetch('/__capture', { method: 'POST', body: JSON.stringify({ nom, image }) })).text();
  },
};
function boucle(maintenant) {
  const dt = Math.min((maintenant - dernier) / 1000, 0.05);
  dernier = maintenant;
  // (les outils de mise au point font avancer le jeu eux-mêmes, image par image)
  if (etat.fige) { requestAnimationFrame(boucle); return; }
  monde.image(dt, { simuler, placerCamera });
  ageInstruments += dt;
  if (ageInstruments > 0.12 && etat.mode !== 'accueil') {
    afficherInstruments();
    ageInstruments = 0;
  }
  afficherGeste();
  afficherCible();
  afficherCompas();
  if (etat.soirEnAttente && jeu.radio.libre) afficherSoir();
  // (l'aube : on attend que le soleil soit levé, et que Jos ait fini de parler)
  if (etat.aubeEnAttente && jeu.radio.libre && (nuit?.heure ?? 99) >= HEURE_LEVER - 0.01) afficherAube();
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);
