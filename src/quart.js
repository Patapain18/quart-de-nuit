// Quart de nuit — le jeu : une nuit de tempête, seul à bord, de minuit à six heures.
//
// Tu ne barres pas : le pilote automatique tient le bateau vent arrière, les vagues dans le
// dos. Toi, tu le gardes en vie : tu pompes l'eau qui entre, tu réarmes le pilote quand il
// lâche, tu fermes la porte, tu sors rouler le foc qui bat… Chaque heure est pire que la
// précédente (quart/nuit.js décide de tout ce qui arrive ; ce fichier le montre, le fait
// entendre, et laisse le marin agir).
//
// Deux façons d'être à bord :
//  - ASSIS AU POSTE, dans la timonerie : on regarde autour de soi (la souris), on agit sur ce
//    qui est à portée de main (E : le radar, le traceur, la VHF, le tableau électrique) ;
//    Espace pour se lever ;
//  - À PIED : Z Q S D pour marcher, la souris pour regarder, E pour agir sur ce que l'on
//    regarde (Maj + E : l'action inverse), Maj pour se tenir, C pour s'accroupir, X pour
//    accrocher son harnais à la ligne de vie.
// Le voilier est mené par la vraie physique (physique/voilier.js) ; le marin vit dans le
// repère du bateau (joueur/marin.js) : il sent le bateau bouger, peut glisser, et passer
// par-dessus bord s'il n'est pas attaché quand le bateau se couche.
import * as THREE from 'three';
import { Monde3D, QUALITES } from './rendu/monde3d.js';
import { Regulateur, CRANS, DERNIER_CRAN } from './rendu/regulateur.js';
import { nomCarteGraphique, sansCarteGraphique, derniereVerification } from './rendu/capacites.js';
import { Vent } from './monde/vent.js';
import { Grains } from './monde/grains.js';
import { Foudre, REGLAGES_FOUDRE } from './monde/foudre.js';
import { Barometre, pressionDuJour, tendanceRecente } from './monde/pression.js';
import { PhysiqueVoilier } from './physique/voilier.js';
import { reglerAutomatiquement } from './physique/regleur.js';
import { Commandes, TOUCHES } from './quart/commandes.js';
import { Audio } from './son/audio.js';
import { Marin } from './joueur/marin.js';
import { construireEncombrement } from './joueur/encombrement.js';
import { ouvrirDescente, ouvrirTrappe } from './joueur/pont.js';
import { creerGestes, gesteVise } from './joueur/gestes.js';
import { Radio } from './quart/radio.js';
import { FEUX } from './monde/feux.js';
import {
  Nuit, EAU, HEURE_DEBUT, HEURE_AUBE, HEURE_LEVER, NOM_BATEAU, meteoDeLaNuit, directionRelative, heureEnTexte, heureRonde,
} from './quart/nuit.js';
import { TOILE_DE_NUIT, ANGLE_PILOTE, piloter } from './quart/veilleurs.js';
import { positionCrete } from './mer/scelerate.js';
import { angleVu, PORTE_CABINE } from './quart/peur.js';
import { Apparitions } from './rendu/apparitions.js';
import { distanceALaTerre } from './rendu/cote.js';
import { lireOptions, changerOptions, quandOptionsChangent } from './quart/options.js';
import { COCKPIT, MAT, TIMONERIE } from './bateau/forme.js';
import { SIEGE, YEUX_POSTE, COTES_VOLETS } from './bateau/interieur-timonerie.js';
import { NOMS_DISJONCTEURS, BATTERIE, PILOTE, EAU_BATTERIES } from './quart/systemes.js';
import { pagesLisibles, PROPRIETAIRE } from './quart/livre-de-bord.js';

const parametres = new URLSearchParams(location.search);
const canvas = document.getElementById('scene');
const monde = new Monde3D(canvas);
// (l'accueil : la nuit de tempête, déjà — le bateau seul dans le noir, les éclairs)
let meteo = meteoDeLaNuit(25.2);
monde.regler(meteo);
const bateau = monde.ajouterBateau();
const physique = new PhysiqueVoilier();
const vent = new Vent(5);
// (ses risées, la mer les dessine)
monde.etatRisees = vent.risees;
// les grains (monde/grains.js) : pendant la nuit, ceux de la nuit (quart/nuit.js) ; sur
// l'écran d'accueil, ceux du décor, qui vivent ici
const grainsDuDecor = new Grains(13);
const grainsActifs = () => nuit?.grains ?? grainsDuDecor;
const _grains = new THREE.Vector3();
// (ce que les grains font là où est le bateau : la pluie, leur vent, l'ombre de leur nuage…)
let ici = grainsDuDecor.mesurer(0, 0, {});
// la foudre (monde/foudre.js) : elle part des nuages des grains
const foudreDuDecor = new Foudre(17);
const foudreActive = () => nuit?.foudre ?? foudreDuDecor;
// les rideaux de pluie sous les grains ne sont plus dessinés : la pluie reste autour du bateau
// (sur les vitres, dans la lampe, sous les éclairs)
monde.ciel.grains.masque.rideaux = false;
// le baromètre du bord (monde/pression.js)
const barometre = new Barometre();
const commandes = new Commandes(canvas);
const audio = new Audio();
// (les vrais enregistrements se chargent en arrière-plan dès maintenant ; le son ne démarre
// qu'au premier clic, comme l'exigent les navigateurs)
audio.precharger(`${import.meta.env.BASE_URL}sons/`);
// (où sont les choses à bord, pour le son : chacune sonne à sa place — repère du bateau)
audio.fixerLieux({
  moteur: new THREE.Vector3(0, 0.35, 4.6), // (le diesel, sous le cockpit)
  cale: bateau.interieur.positionTrappe.clone().setY(0.35),
  pompe: bateau.interieur.positionPompe,
  console: bateau.interieur.positionCompas,
  vhf: bateau.interieur.positionRadio,
  safran: new THREE.Vector3(0, 0.6, 6.1),
  volets: new THREE.Vector3(0, 3.0, 2.2),
  dalots: bateau.dalots[0].clone().setX(0),
  etrave: new THREE.Vector3(0, 1.0, -7.2),
  foc: new THREE.Vector3(0, 5, -5.5),
});
// (le milieu de chaque vitre de la timonerie : d'où l'on entend le verre se fendre)
const centresVitres = bateau.carreaux.map(({ verre }) => {
  verre.geometry.computeBoundingBox();
  return verre.geometry.boundingBox.getCenter(new THREE.Vector3());
});
const marin = new Marin();
// (ce qui est dur à bord, tiré du modèle 3D : le marin n'y entre pas, la caméra non plus)
marin.encombrement = construireEncombrement(bateau);
// (jeu.html?perf : le compteur de fluidité, en haut à gauche)
if (parametres.has('perf')) import('./atelier/fluidite.js').then((m) => m.afficherFluidite(monde, { etat: etatQualite }));
// (jeu.html?frein-carte=3&frein-processeur=2 : un faux ordinateur lent, pour les essais — la
// carte graphique fait trois fois son plus gros travail (monde3d.js, freiner), et tout le
// calcul du processeur prend deux fois plus de temps : ici, dans la boucle, et dans le fil
// de la houle)
const freinCarte = Number(parametres.get('frein-carte'));
if (freinCarte > 1) monde.frein = freinCarte;
const freinProcesseur = Number(parametres.get('frein-processeur')) || 1;
if (freinProcesseur > 1) monde.houle.freinerFil(freinProcesseur);
// (jeu.html?peur : l'atelier de la peur, à droite)
if (parametres.has('peur')) import('./atelier/atelier-peur.js').then((m) => m.ouvrirAtelierPeur(window.__jeu));
// (jeu.html?trombe=fil : une autre trombe que celle du jeu — voir l'atelier de la trombe)
if (parametres.has('trombe')) monde.trombe.choisirVariante(parametres.get('trombe'));
// (la peur : ce qu'on voit du coin de l'œil — quart/peur.js décide, ceci le montre)
const apparitions = new Apparitions(monde.scene, bateau, monde.houle, monde.eau);
monde.aPrecompiler.push(...apparitions.objets);
let nuit = null; // la nuit de tempête
let options = lireOptions();

// Le bateau sur l'écran d'accueil : à la cape dans la tempête, vu de loin
function mettreALaCape() {
  physique.placer(0, 0, (meteo.directionVent - ANGLE_PILOTE + 360) % 360, monde.houle);
  physique.vitesse.copy(physique.avant).multiplyScalar(2.5);
  Object.assign(physique, TOILE_DE_NUIT);
}
mettreALaCape();

// ---------- État du jeu ----------
const etat = {
  mode: 'accueil', // accueil, poste, pied, pause, fin
  avantPause: 'poste',
  lampe: false,
  aide: true,
  orbite: 0,
  pilote: true, // le pilote automatique tient le bateau (il lâche : quart/nuit.js)
  feux: true,
  eclairage: 'rouge',
  geste: null,
  action: null, // { geste, cle, progression }
  eauCale: 0,
  attenteClaque: 0,
  gilet: true, // ciré et gilet de sauvetage enfilés
  evenements: new Set(),
  majCiel: 0,
  majMer: 0,
  carnet: false,
};

// ---------- Ce que le jeu sait faire (appelé par les gestes) ----------
let dernierRefus = 0;
const jeu = {
  physique, bateau, etat, meteo, marin, barometre,
  get nuit() { return nuit; },
  // (les gestes de l'ancien jeu demandent si une chose est permise : tout l'est, la nuit)
  autorise() { return true; },
  basculerGilet() {
    etat.gilet = !etat.gilet;
    bateau.interieur.cire.visible = !etat.gilet;
    afficherMessage(etat.gilet ? 'Ciré et gilet de sauvetage enfilés' : 'Ciré et gilet raccrochés');
  },
  // la VHF : personne ne répond. Rien que des parasites, la nuit…
  ecouterMeteo() {
    audio.parasites?.(2.2, 0.5);
    afficherMessage('Canal 16 : rien que des parasites.');
  },
  appelerLe16() {
    audio.parasites?.(3, 0.6);
    afficherMessage('Tu appelles sur le 16. Personne ne répond.');
  },
  // le baromètre : une tape sur le verre (l'aiguille colle un peu)
  lireBarometre() {
    barometre.tapoter();
    etat.calerTemoin = 1.2;
    const h = heureIci();
    const recente = h === null ? 0 : tendanceRecente(h);
    afficherMessage(`Baromètre : ${Math.round(pressionIci())} hPa${Math.abs(recente) > 0.6 ? (recente < 0 ? ', il baisse' : ', il remonte') : ''}`);
  },
  titreBarometre() {
    return `Baromètre : ${Math.round(barometre.aiguille ?? pressionIci())} hPa`;
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
  // s'asseoir au poste de la timonerie : à l'abri, devant les écrans
  allerAuPoste() {
    etat.mode = 'poste';
    etat.action = null;
    marin.lacet = 0;
    marin.site = -0.18;
    majAide();
  },
  // rouler le foc (la bosse d'enrouleur, dans le cockpit) : quand son écoute a cassé, il bat
  enrouler(sens) {
    if (sens > 0) {
      if (performance.now() - dernierRefus > 3000) afficherMessage(physique.focDechire ? 'Le foc est déchiré : il reste roulé' : 'Cette nuit, le foc reste presque roulé');
      dernierRefus = performance.now();
      return;
    }
    physique.deroule = THREE.MathUtils.clamp(physique.deroule + sens * 0.22, 0, 1);
  },
  // passer une nouvelle écoute de foc (à l'avant), réarmer le pilote (au tableau), dégager les
  // dalots (dans le cockpit, derrière la roue)
  reparer(nom) {
    if (!nuit?.reparer(nom, contexteNuit(0))) return false;
    afficherMessage({
      pilote: 'Disjoncteur réarmé : le pilote reprend la barre',
      dalots: 'Dalots dégagés : le cockpit se vide. Attends qu\'il soit vide pour rouvrir la porte : son eau entrerait avec toi',
    }[nom] ?? 'Nouvelle écoute de foc passée');
    audio.clic?.();
    return true;
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
      const litres = nuit ? nuit.pomper(2.5) : 0;
      etat.eauCale = Math.max(0, etat.eauCale - litres);
      audio.coupDePompe(litres > 0.1);
    }
    bateau.pomper(Math.sin(etat.phasePompe) * 0.7);
  },
  // le livre de bord de l'ancien propriétaire (comme la touche L)
  lireLivre() {
    if (!etat.carnet) basculerCarnet();
  },
  // la porte basse de la cabine avant : on l'ouvre (pour regarder dedans), on la referme
  basculerPorteAvant() {
    const i = bateau.interieur;
    const fermer = i.porteAvantEtat !== 'fermee';
    if (fermer && i.porteAvantEtat === 'entrouverte' && nuit) nuit.ecrire('Refermé la porte de la cabine avant.');
    i.ouvrirPorteAvant(fermer ? 'fermee' : 'ouverte');
    audio.porteAvant?.(!fermer, i.positionPorteAvant);
  },
  // la trappe de la cale : on la soulève pour voir l'eau (la baladeuse s'allume avec elle)
  basculerTrappe() {
    const ouverte = !bateau.interieur.trappeOuverte;
    bateau.interieur.ouvrirTrappe(ouverte);
    ouvrirTrappe(ouverte);
    if (nuit) nuit.systemes.baladeuse = ouverte;
    audio.clic?.();
    afficherMessage(ouverte ? 'Trappe de la cale ouverte' : 'Trappe refermée');
  },
  // les volets de tempête d'un côté de la timonerie (leurs moteurs ont besoin de courant)
  basculerVolets(cote) {
    const sy = nuit?.systemes;
    if (!sy) return;
    const fermer = !sy.voletsFermes(cote);
    audio.clic?.();
    if (!sy.fermerVolets(cote, fermer)) {
      afficherMessage(sy.courant ? 'Les moteurs des volets sont coupés, au tableau' : 'Plus de courant : les volets ne bougent pas');
      return;
    }
    const nom = { avant: 'du pare-brise', tribord: 'de tribord', babord: 'de bâbord', arriere: 'de l\'arrière' }[cote];
    afficherMessage(fermer ? `Les volets ${nom} descendent : les vitres sont protégées, mais on ne voit plus dehors` : `Les volets ${nom} remontent`);
  },
  // l'éclairage de la timonerie : rouge (une veilleuse, qui garde la vision de nuit), blanc,
  // éteint (le blanc tire cinq fois plus sur la batterie)
  basculerEclairage() {
    const sy = nuit?.systemes;
    etat.eclairage = { eteint: 'rouge', rouge: 'blanc', blanc: 'eteint' }[etat.eclairage];
    if (sy) sy.eclairage = etat.eclairage;
    afficherMessage({ blanc: 'Éclairage : blanc (il tire sur la batterie)', rouge: 'Éclairage : rouge (pour garder ta vision de nuit)', eteint: 'Éclairage éteint' }[etat.eclairage]);
  },
  // ---------- les systèmes du bord (quart/systemes.js) ----------
  // un disjoncteur du tableau : on le coupe, on le remet (celui du pilote, sauté, se réarme…
  // une fois le pilote refroidi)
  basculerDisjoncteur(nom) {
    const sy = nuit?.systemes;
    if (!sy) return;
    audio.clic?.();
    if (nom === 'pilote' && sy.pilote.disjoncte) {
      if (jeu.reparer('pilote')) return;
      afficherMessage(`Le disjoncteur du pilote ressaute : son moteur est encore trop chaud (${Math.round(sy.pilote.temperature * 100)} %, il faut moins de ${Math.round(PILOTE.rearmement * 100)} %)`);
      return;
    }
    const mis = sy.basculerDisjoncteur(nom);
    if (nom === 'feux') etat.feux = mis;
    const nomCircuit = NOMS_DISJONCTEURS[nom];
    const suite = !mis && nom === 'pilote' ? ' : plus personne ne tient la barre !' : !mis && nom === 'pompe' ? ' : l\'eau va monter dans la cale' : '';
    afficherMessage(`${nomCircuit.charAt(0).toUpperCase()}${nomCircuit.slice(1)} : ${mis ? 'remis' : 'coupé'}${suite}`);
  },
  // le moteur : le démarrer (il recharge la batterie, soulage le pilote… et couvre tous les
  // bruits du dehors) ou l'arrêter
  basculerMoteur() {
    const sy = nuit?.systemes;
    if (!sy) return;
    audio.clic?.();
    if (sy.moteur.etat !== 'arrete') {
      sy.arreterMoteur();
      afficherMessage('Moteur arrêté : on entend de nouveau la mer');
      return;
    }
    const r = sy.demarrerMoteur();
    if (r === 'chaud') afficherMessage(`Le moteur est encore trop chaud pour repartir (${Math.round(20 + 90 * sy.moteur.temperature)} °C) : attends qu'il refroidisse`);
    else if (r === 'batterie') afficherMessage(sy.courant ? 'Le démarreur tourne à peine : la batterie est trop faible pour lancer le moteur' : 'Plus de courant : le démarreur ne tourne pas');
  },
  // le pilote : en veille (il refroidit, mais plus personne ne tient la barre) ou enclenché
  basculerPilote() {
    const sy = nuit?.systemes;
    if (!sy) return;
    audio.clic?.();
    const engage = sy.basculerPilote();
    afficherMessage(engage ? 'Pilote enclenché : il reprend la barre' : 'Pilote en veille : il refroidit… mais plus personne ne tient la barre');
  },
  // le coupe-batterie : l'eau l'a fait sauter ; on le réarme une fois l'eau redescendue
  rearmerBatterie() {
    const sy = nuit?.systemes;
    if (!sy) return;
    audio.clic?.();
    const r = sy.rearmerBatterie(nuit.eau.cale);
    if (r === 'eau') afficherMessage('L\'eau baigne encore les batteries : pompe d\'abord, sous leur étagère');
    else if (sy.batterie.coupee === false && r === 'ok') afficherMessage(`Coupe-batterie réarmé : le courant revient (la batterie a perdu sa charge dans l'eau : ${Math.round(sy.batterie.charge * 100)} %)`);
  },
};
const gestes = creerGestes(jeu, bateau.interieur);
const gestesDehors = gestes.filter((g) => !g.dedans);
const gestesAuPoste = gestes.filter((g) => g.id !== 'siege');
const sousTitres = document.getElementById('sous-titres');
jeu.radio = new Radio({
  afficher: (t) => { sousTitres.textContent = t; sousTitres.hidden = !t || !options.sousTitres; },
  audio,
  ecran: bateau.interieur.radio,
});
jeu.radio.canal = 16;

// ---------- La qualité « Auto » (rendu/regulateur.js) ----------
// Le jeu choisit lui-même la qualité de l'image et sa finesse, et les règle en jouant pour
// rester fluide (le régulateur juge chaque image, dans la boucle). Le cran trouvé est
// gardé d'une partie à l'autre : on repart de là.
const CLE_AUTO = 'quart-de-nuit:auto';
let regulateur = null;
let cranGarde = null;
function cranDeDepart() {
  try {
    const garde = JSON.parse(localStorage.getItem(CLE_AUTO));
    if (Number.isInteger(garde?.cran) && garde.cran >= 0 && garde.cran <= DERNIER_CRAN) return (cranGarde = garde.cran);
  } catch { /* rien de gardé, ou illisible */ }
  // la première fois : selon la carte graphique, quand le navigateur dit son nom (sans
  // carte graphique : le plus léger ; une carte Intel intégrée : économique ; sinon, moyenne)
  const carte = nomCarteGraphique(monde.renderer.getContext());
  if (derniereVerification?.sansCarteGraphique || sansCarteGraphique(carte)) return DERNIER_CRAN;
  if (/intel/i.test(carte) && !/\barc\b/i.test(carte)) return 2;
  return 1;
}
function appliquerCran(cran) {
  const { qualite, finesse } = CRANS[cran];
  if (monde.qualite !== qualite) monde.appliquerQualite(qualite, finesse);
  else monde.changerFinesse(finesse);
}
// (le cran est gardé une fois qu'il n'a pas bougé depuis 20 secondes)
function garderCran(maintenant) {
  if (regulateur.cran === cranGarde || maintenant - regulateur.changeDepuis < 20000) return;
  cranGarde = regulateur.cran;
  try {
    localStorage.setItem(CLE_AUTO, JSON.stringify({ cran: cranGarde }));
  } catch { /* stockage refusé : on cherchera de nouveau la prochaine fois */ }
}
function appliquerQualiteChoisie(nom) {
  if (nom === 'auto') {
    regulateur ??= new Regulateur({ cran: cranDeDepart(), maintenant: performance.now() });
    appliquerCran(regulateur.cran);
  } else {
    regulateur = null;
    monde.appliquerQualite(nom, 1);
  }
}
// (ce qu'on dit de la qualité en ce moment : les options, et le compteur de fluidité)
function etatQualite() {
  if (!regulateur) return `Qualité ${QUALITES[monde.qualite]?.nom ?? monde.qualite} (choisie)`;
  const { qualite, finesse } = CRANS[regulateur.cran];
  const { ips, limite } = regulateur.dernier;
  let t = `En ce moment : qualité ${QUALITES[qualite].nom}`;
  if (finesse < 1) t += `, image dessinée à ${Math.round(finesse * 100)} % puis agrandie`;
  if (ips) t += ` — ${Math.round(ips)} images par seconde`;
  t += '.';
  if (limite === 'processeur') t += ' C\'est le processeur qui ne suit pas : baisser l\'image n\'y changerait rien.';
  else if (limite === 'carte' && regulateur.cran === DERNIER_CRAN) t += ' Ton ordinateur est un peu juste pour ce jeu : c\'est déjà l\'image la plus légère.';
  return t;
}

// ---------- Les options (src/quart/options.js) ----------
function appliquerOptions(o, changements = o) {
  if ('qualite' in changements) appliquerQualiteChoisie(o.qualite);
  monde.camera.fov = o.champ;
  monde.camera.updateProjectionMatrix();
  audio.regler(o.volume);
  audio.regler3D(o.casque);
  jeu.radio.muette = true; // (plus de voix : la radio ne parle plus, elle grésille)
  sousTitres.hidden = !o.sousTitres || !sousTitres.textContent;
  etat.aide = o.aide;
  document.getElementById('aide-touches').classList.toggle('cache', !o.aide);
  monde.gouttesActives = o.gouttes;
  monde.eclairsDoux = !o.clignotements;
  // (la nuit d'orage : noir d'encre, ou un peu moins pour un écran peu lumineux)
  monde.noirMax = { encre: 1, 'tres-sombre': 0.8, sombre: 0.6 }[o.nuit] ?? 1;
  if ('nuit' in changements && monde.meteo) monde.regler(monde.meteo, { recalculerMer: false, brusque: false });
  majFenetreOptions();
}
quandOptionsChangent((o, changements) => {
  options = o;
  appliquerOptions(o, changements);
});

// Le pilote automatique : il garde l'angle du vent (vent arrière, les vagues dans le dos) ;
// quand il a lâché, plus personne ne tient la barre (elle revient au milieu, et le bateau
// finit par se mettre en travers)
function tenirLeBateau(dt) {
  piloter(physique, nuit ? nuit.systemes.piloteEnMarche : etat.pilote, dt);
}

// Les touches que l'on vient d'enfoncer
function touchesAppuyees() {
  for (const { code, maj } of commandes.lireAppuis()) {
    if (code === TOUCHES.lampe.code) {
      etat.lampe = !etat.lampe;
      afficherMessage(etat.lampe ? 'Lampe frontale allumée' : 'Lampe frontale éteinte');
    } else if (code === TOUCHES.carnet.code) {
      basculerCarnet();
    } else if (code === TOUCHES.passerPhrase.code) {
      jeu.radio.passerPhrase();
    } else if (code === TOUCHES.aide.code) {
      changerOptions({ aide: !etat.aide });
    } else if (etat.mode === 'poste' && code === TOUCHES.lever.code) {
      quitterLePoste();
    } else if (etat.mode === 'pied' && code === TOUCHES.harnais.code) {
      basculerHarnais();
    } else if ((etat.mode === 'pied' || etat.mode === 'poste') && code === TOUCHES.agir.code) {
      commencerAction(maj ? 'secondaire' : 'principal');
    }
  }
}

function quitterLePoste() {
  etat.mode = 'pied';
  // debout, à côté du siège (à bâbord, du côté de la pompe et de la trappe)
  marin.placer(SIEGE.x - SIEGE.demiLargeur - 0.2, TIMONERIE.plancher, SIEGE.z + 0.05);
  majAide();
}

function basculerHarnais() {
  if (!marin.dehors) {
    afficherMessage('À l\'intérieur, pas besoin du harnais');
    return;
  }
  marin.attache = !marin.attache;
  afficherMessage(marin.attache ? 'Harnais accroché à la ligne de vie' : 'Harnais décroché : attention à toi');
}

// ---------- Les gestes (E et Maj + E sur ce que l'on regarde) ----------
// (la porte fermée n'est pas dans l'encombrement — elle bouge — mais on ne passe pas la main
// au travers : le regard la traverse-t-il avant d'atteindre la chose, à t mètres ?)
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
// (la bôme : même grand-voile affalée, elle peut balayer le cockpit quand le bateau empanne)
const _tete = new THREE.Vector3();
function dangers() {
  if (etat.mode !== 'pied') return;
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
    marin.glissade.x += Math.sign(physique.vitesseBome) * 2.4;
    afficherMessage('La bôme t\'a frappé ! Accroupis-toi (C) quand le bateau empanne.');
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
  return {
    scelerate: d >= 0 ? 1 - Math.min(1, d / 1000) : Math.max(0, 1 + d / 260), deferle: w.v.deferle,
    // (on l'entend venir de son côté)
    ouScelerate: depuisBateau(nuit.scelerates.direction(), Math.max(25, Math.min(220, d)), 4),
  };
}

// ---------- La simulation (appelée par le monde 3D une fois la houle calculée) ----------
const _origine = new THREE.Vector3();
const _trombe = new THREE.Vector3();
function simuler(dt) {
  const enJeu = etat.mode === 'pied' || etat.mode === 'poste';
  if (!enJeu) {
    commandes.lireAppuis();
    // (à l'accueil, en pause : le pilote tient toujours le bateau)
    tenirLeBateau(dt);
    reglerAutomatiquement(physique, dt);
  } else {
    touchesAppuyees();
    tenirLeBateau(dt);
    reglerAutomatiquement(physique, dt);
    if (nuit) vivreLaNuit(dt);
  }
  // les grains : ceux de la nuit vivent avec elle (nuit.maj) ; ceux du décor, ici
  const p = physique.position;
  if (!nuit) {
    grainsDuDecor.renfort = etat.mode === 'accueil' ? 2 : 0;
    grainsDuDecor.maj(dt, meteo, p.x, p.z, physique.vitesse.x, physique.vitesse.z);
    ici = grainsDuDecor.mesurer(p.x, p.z, ici);
    foudreDuDecor.maj(dt, { meteo, grains: grainsDuDecor, x: p.x, z: p.z, ecoute: monde.camera.position });
  } else if (nuit.ici) ici = nuit.ici;
  // le vent : le vent du moment, et ses risées, et l'air froid qui tombe des grains
  const v = vent.maj(monde.temps, dt, meteo, ici.agitation, p.x, p.z, grainsActifs());
  etat.risee = vent.risees.mesurer(p.x, p.z, physique.vitesse.x, physique.vitesse.z, etat.risee ?? {});
  v.add(grainsActifs().ventEn(p.x, p.z, _grains));
  // (le tourbillon de la trombe, quand elle passe près : il souffle sur le bateau, le secoue,
  // et lui jette l'eau qu'il arrache à la mer)
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
      audio.choc(Math.min(1, ev.chute * 0.5));
      secousse(Math.min(0.6, ev.chute * 0.4));
    }
    if (ev.retenu && !(etat.attenteRetenu > 0)) {
      afficherMessage('Le harnais t\'a retenu au bord ! Tiens-toi (Maj) et remonte vers l\'axe du bateau.');
      secousse(0.5);
      etat.attenteRetenu = 4;
    }
    etat.attenteRetenu = Math.max(0, (etat.attenteRetenu ?? 0) - dt);
    // (il pousse contre la porte fermée de la timonerie : on lui dit comment l'ouvrir — une fois,
    // puis plus avant six secondes)
    const contreLaPorte = !bateau.descenteOuverte && avance > 0 && marin.vitesseMarche < 0.15
      && Math.abs(marin.position.x) < 0.35 && Math.abs(marin.position.z - TIMONERIE.zArriere) < 0.45;
    etat.contreLaPorte = contreLaPorte ? (etat.contreLaPorte ?? 0) + dt : Math.min(0, (etat.contreLaPorte ?? 0) + dt);
    if (etat.contreLaPorte > 0.6) {
      afficherMessage('La porte de la timonerie est fermée : regarde-la et appuie sur E pour l\'ouvrir');
      etat.contreLaPorte = -6;
    }
    const oeil = marin.position.clone();
    oeil.y += marin.hauteurYeux();
    etat.geste = gesteVise(marin.dansLaTimonerie ? gestes : gestesDehors, oeil, marin.direction(), { encombrement: marin.encombrement, obstacle: porteFermeeEntre });
    poursuivreAction(dt);
    dangers();
  } else if (etat.mode === 'poste') {
    // assis au poste de la timonerie : on agit sur ce qui est à portée de main (la VHF, le
    // radar, le traceur, le tableau électrique…), sans se lever
    etat.geste = gesteVise(gestesAuPoste, YEUX_POSTE, marin.direction(), {
      portee: 1.25, encombrement: marin.encombrement, obstacle: porteFermeeEntre,
    });
    poursuivreAction(dt);
  } else {
    etat.geste = null;
  }

  // (les lumières du bord vacillent quand l'étrange arrive, ou quand la foudre tombe tout près ;
  // sur le mât, les écrans s'éteignent quelques secondes)
  etat.coupure = Math.max(0, (etat.coupure ?? 0) - dt);
  const sy = nuit?.systemes ?? null;
  // (la batterie presque vide : la lumière faiblit et hésite)
  const faible = sy && sy.courant && sy.batterie.charge < BATTERIE.vide ? (0.45 + 0.55 * sy.batterie.charge / BATTERIE.vide) * (Math.random() < 0.08 ? 0.4 : 1) : 1;
  const vacille = etat.coupure > 0 ? 0 : facteurVacille(dt) * faible;
  bateau.radar.vacille = vacille;
  bateau.radar.alimente = !sy || sy.alimente('radar');
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
  // (le foc sans écoute bat comme un drapeau)
  r.dechiree = false;
  if (physique.ecouteFocLibre) r.faseyementFoc = 1;
  r.deroule = Math.max(0.02, physique.deroule);
  r.angleSafran = physique.barre;
  bateau.instruments.maj(dt, m, monde.ecl.nuit, !sy || sy.courant);
  majRadar(dt);
  // le traceur de cartes et la commande du pilote, sur la console de la timonerie
  const fond = physique.vitesse;
  const piloteEnMarche = sy ? sy.piloteEnMarche : etat.pilote;
  bateau.electronique.maj(dt, {
    x: physique.position.x, z: physique.position.z, cap: m.cap, vitesse: m.vitesse,
    route: (Math.atan2(fond.x, -fond.z) * 180 / Math.PI + 360) % 360,
    pilote: piloteEnMarche ? m.cap : null, panne: nuit?.avaries.pilote === 'panne', barre: physique.barre,
    temperature: sy?.pilote.temperature ?? 0.3,
    alimente: { traceur: !sy || sy.alimente('traceur'), pilote: !sy || sy.alimente('pilote'), compas: !sy || sy.courant },
    bouees: [], nuit: monde.ecl.nuit,
    // (la chose sous la coque : le sondeur la voit, lui)
    sonde: nuit?.peur?.chose?.sonde ?? null,
    baro: barometre.aiguille === null ? null : { p: barometre.aiguille, dp: null, historique: barometre.historique, heure: heureIci() },
    vacille,
  });
  // les essuie-glaces : sous la pluie, ou quand les embruns arrosent le pare-brise ; et l'eau
  // qui ruisselle sur les vitres de la timonerie
  const eauDansLAir = Math.min(1, ici.pluie * 1.3 + (monde.embruns.densiteAutour ?? 0) * 2.5 + Math.max(0, meteo.vent - 28) / 30);
  bateau.balayage = eauDansLAir > 0.05 ? Math.min(1, eauDansLAir * 1.2) : 0;
  bateau.pluieSurLesVitres = eauDansLAir;
  mouillerLePont(dt);
  // l'eau embarquée : dans le cockpit, et dans la cale (au naufrage, elle passe sur le
  // plancher de la timonerie)
  bateau.eauABord.maj(dt, bateau.groupe, {
    litresCockpit: physique.eauCockpit,
    litresCale: etat.eauCale,
    plein: EAU.naufrage,
    pesanteur,
    temps: monde.temps,
  });
  bateau.allumerFeux((sy ? sy.alimente('feux') : etat.feux) ? 1 : 0);
  // les vitres de la timonerie (fendues, brisées) ; les dalots du cockpit (bouchés)
  if (sy) bateau.montrerVitres(sy.vitres.map((v) => v.etat));
  bateau.montrerDalots(nuit?.avaries.dalots === 'bouches', physique.eauCockpit);
  // le baromètre du bord : il montre la pression d'ici ; le bateau qui tape dans la mer décolle
  // son aiguille
  barometre.maj(dt, pressionIci(), { secousse: etat.mouvement ?? 0, heure: heureIci(), passe: (h) => pressionDuJour(h - 1.15) });
  if (etat.calerTemoin > 0) {
    etat.calerTemoin -= dt;
    if (etat.calerTemoin <= 0) barometre.caler(heureIci());
  }
  // l'intérieur : sa lumière (les plafonniers), le baromètre et la pendule
  bateau.interieur.regler({
    systemes: sy,
    eclairage: etat.eclairage,
    feux: etat.feux,
    ciel: monde.ecl.ambiance,
    eclair: monde.eclair.eclaire,
    descente: bateau.descenteOuverte ? 1 : 0,
    pression: barometre.aiguille,
    temoin: barometre.temoin,
    heure: nuit ? nuit.heure % 24 : meteo.heure,
    vacille,
    nuit: monde.ecl.nuit,
    gite: m.gite,
    dt,
  });
  const dedans = (etat.mode === 'pied' && !marin.dehors) || etat.mode === 'poste';
  const enTimonerie = etat.mode === 'poste' || (etat.mode === 'pied' && marin.dansLaTimonerie);
  // l'œil s'habitue à la pénombre de l'intérieur (et le dehors paraît éblouissant) : dans la
  // timonerie, on voit surtout dehors, par les vitres : l'œil ne s'y habitue qu'à moitié
  const expositionCabine = bateau.interieur.exposition(monde.ecl.nuit, enTimonerie);
  const adaptationVoulue = dedans ? (enTimonerie ? 0.5 : 1) : 0;
  etat.adaptation = (etat.adaptation ?? 0) + (adaptationVoulue - (etat.adaptation ?? 0)) * Math.min(1, dt * (dedans ? 0.9 : 2.2));
  const reglages = monde.post.reglages;
  reglages.uExposition.value = Math.exp(THREE.MathUtils.lerp(Math.log(monde.ecl.exposition), Math.log(expositionCabine), etat.adaptation));
  // (quand la peur monte, la nuit se referme : l'œil ne s'habitue plus aussi bien au noir)
  const peurNuit = (nuit?.peur?.tension ?? 0) ** 2 * monde.ecl.nuit;
  reglages.uExposition.value *= 1 - 0.3 * peurNuit;
  // (sous le nuage-mur de la trombe, il fait un peu plus sombre)
  if (nuit?.trombe) reglages.uExposition.value *= 1 - 0.12 * nuit.trombe.force * (1 - THREE.MathUtils.smoothstep(nuit.trombe.distance, 150, 900));
  reglages.uExposition.value *= 1 - 0.15 * ici.ombre;
  // (les couleurs de la nuit — bleues, délavées — ne valent que dehors)
  const et = monde.etalonnage;
  reglages.uSaturation.value = THREE.MathUtils.lerp(et.saturation, 1.05, etat.adaptation);
  reglages.uBalance.value.set(...et.balance.map((b) => THREE.MathUtils.lerp(b, 1, etat.adaptation)));
  // (la peur resserre la vue — les bords s'assombrissent — et pâlit les couleurs)
  const tension = nuit?.peur?.tension ?? 0;
  reglages.uVignettage.value = et.vignettage + 0.5 * tension * tension;
  reglages.uSaturation.value *= 1 - 0.25 * tension;
  monde.lampeFrontale(etat.lampe);
  // (dans la timonerie, on voit la pluie par les vitres)
  monde.pluie.mesh.visible = (!dedans || enTimonerie) && (monde.ici?.pluie ?? ici.pluie) > 0.01;
  monde.dansLaCabine = dedans;
  monde.gouttesActives = options.gouttes && etat.mode === 'pied';
  monde.etatCargo = null;
  monde.etatTrombe = nuit?.trombe ?? null;
  monde.etatGrains = grainsActifs();
  monde.etatFoudre = foudreActive();
  entendreLaFoudre(foudreActive(), dedans);

  // le son du bord
  const rot = physique.rotation;
  etat.rotationAvant ??= rot.clone();
  const secousseBateau = Math.min(1, rot.distanceTo(etat.rotationAvant) / Math.max(dt, 1e-3) / 1.2);
  etat.rotationAvant.copy(rot);
  etat.mouvement = (etat.mouvement ?? 0) + (secousseBateau - (etat.mouvement ?? 0)) * Math.min(1, dt * 4);
  const vitesseBarre = Math.abs(physique.barre - (etat.barreAvant ?? physique.barre)) / Math.max(dt, 1e-3);
  etat.barreAvant = physique.barre;
  audio.dansLaCabine(dedans, {
    porte: bateau.descenteOuverte ? 1 : 0,
    volets: sy ? COTES_VOLETS.filter((c) => sy.volets[c].fraction > 0.95).length : 0,
  });
  audio.maj(dt, {
    nuit: monde.ecl.nuit,
    mouvement: etat.mouvement,
    pilote: piloteEnMarche ? Math.min(1, vitesseBarre / 0.35) : 0,
    voiles: 0.2 + 0.8 * physique.deroule,
    ventApparent: m.ventApparent,
    vitesse: m.vitesse,
    faseyement: Math.max(r.faseyement * 0.2, r.faseyementFoc * physique.deroule),
    pluie: ici.pluie,
    averse: ici.approche,
    risee: etat.risee?.niveau ?? 0,
    bordage: 0,
    houle: monde.houle.hauteurSignificative,
    eauCale: etat.eauCale,
    eauCockpit: physique.eauCockpit,
    roulis: physique.rotation.length(),
    trombe: nuit?.trombe ? nuit.trombe.force * (1 - THREE.MathUtils.smoothstep(nuit.trombe.distance, 60, 1600)) : 0,
    cargo: 0,
    ...sonScelerate(),
    tension: nuit?.peur?.tension ?? 0,
    saintElme: dedans ? 0 : THREE.MathUtils.smoothstep(foudreActive().champ, 0.55, 0.85),
    // les systèmes du bord : le moteur (il couvre le dehors), la pompe électrique, les volets,
    // les alarmes
    regimeMoteur: sy?.moteurEnMarche ? 1 : 0,
    pompeElectrique: sy?.pompe.marche ?? false,
    voletsBougent: !!sy && sy.alimente('volets') && COTES_VOLETS.some((c) => sy.volets[c].fraction !== sy.volets[c].cible),
    alarmes: sy?.alarmes ?? null,
    dalotsBouches: nuit?.avaries.dalots === 'bouches',
    // (l'oreille : là où sont les yeux ; l'heure : le vent respire moins au plus fort ; la trombe :
    // d'où elle gronde)
    ecoute: ecouteDansLeBateau(),
    heure: nuit?.heure ?? null,
    ouTrombe: nuit?.trombe ? versBateau(new THREE.Vector3(nuit.trombe.x, 25, nuit.trombe.z)) : null,
  });
  etat.attenteClaque = Math.max(0, etat.attenteClaque - dt);
  if (m.impactEtrave > 0.05 && etat.attenteClaque === 0) {
    audio.claque(m.impactEtrave);
    secousse(m.impactEtrave * 0.25);
    monde.embruns.etrave(m.impactEtrave, physique);
    if (m.impactEtrave > 0.5 && meteo.vent > 22 && !dedans) monde.gouttes.eclabousser(m.impactEtrave * 0.5);
    etat.attenteClaque = 0.6;
  }
}

// ---------- La nuit de tempête ----------
// Où commence la nuit : à minuit, Morgane fuit devant la tempête, au large de Kervalen (la côte
// est à cinq milles au nord : on la devine à ses feux, quand la pluie les laisse passer).
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
  const lieu = etat.mode === 'poste' || (etat.mode === 'pied' && marin.dansLaTimonerie) ? 'timonerie' : 'pont';
  return { lieu, yeux, regard, haut, tanX: tanY * cam.aspect, tanY };
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
    mode: etat.mode,
    aBord: {
      feux: etat.feux,
      gilet: etat.gilet,
      descenteOuverte: bateau.descenteOuverte,
      trappeOuverte: bateau.interieur.trappeOuverte,
      porteAvant: bateau.interieur.porteAvantEtat,
      voletsFermes: nuit ? Object.fromEntries(COTES_VOLETS.map((c) => [c, nuit.systemes.volets[c].fraction > 0.95])) : null,

      attache: marin.attache,
      dehors: etat.mode === 'pied' && marin.dehors,
      zone: marin.zone,
    },
    evenements: etat.evenements,
    // (là où l'on entend : le tonnerre arrive d'autant plus tard que l'éclair est loin d'ici)
    ecoute: monde.camera.position,
  };
}

// La pression ici (hPa) : celle de la nuit (la dépression qui arrive, le bond des grains, le
// creux de la trombe) ; sur l'écran d'accueil, celle de minuit
function heureIci() {
  return nuit ? nuit.heure : null;
}
function pressionIci() {
  return nuit ? nuit.pression : pressionDuJour(HEURE_DEBUT - 1.15);
}

function vivreLaNuit(dt) {
  nuit.maj(dt, contexteNuit(dt));
  etat.evenements = new Set();
  if (!nuit) return;
  // la tempête brouille la radio
  jeu.radio.brouillage = THREE.MathUtils.smoothstep(nuit.meteo.vent, 30, 42) * 0.55;
  // le cœur qui bat, quand ça devient grave : couché sur l'eau, la trombe sur nous, le bateau
  // qui se remplit
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
  // la chose sous la coque : quand elle passe dessous, quelque chose d'immense frotte la quille
  // et soulève le bateau
  const chose = nuit.peur.chose;
  if (chose?.sous && !chose.secoue) {
    chose.secoue = true;
    audio.raclement?.(chose.cote);
    physique.rotation.addScaledVector(physique.avant, 0.2 * chose.cote);
    physique.vitesse.y += 0.45;
    secousse(0.35);
  }
  etat.eauCale = nuit.eau.cale;
  // la porte de la cabine avant s'est entrouverte dans ton dos : quand tu la vois (debout : assis
  // au poste, la console la cache), le journal le note (et le cœur cogne)
  if (bateau.interieur.porteAvantEtat === 'entrouverte' && !etat.porteAvantVue && etat.mode === 'pied') {
    const { lieu, yeux, regard } = regardDansLeBateau();
    if (lieu === 'timonerie' && angleVu(yeux, regard, PORTE_CABINE) < 28) {
      etat.porteAvantVue = true;
      etat.porteAvantFois = (etat.porteAvantFois ?? 0) + 1;
      nuit.ecrire(etat.porteAvantFois === 1 ? 'La porte de la cabine avant est entrouverte.' : 'La porte de la cabine avant est de nouveau entrouverte. Je l\'avais refermée.');
      audio.battement?.(0.8);
    }
  }
  // le temps qu'il fait suit l'heure (le ciel dix fois par seconde, la mer toutes les trois
  // secondes)
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
// l'antidérapant deviennent brillants (la lampe et les éclairs s'y reflètent), le teck fonce.
const materiauxSecs = new Map();
function mouillerLePont(dt) {
  const vise = Math.min(1, ici.pluie * 1.3 + Math.max(0, (meteo.vent - 25) / 20) * 0.5);
  etat.mouille = (etat.mouille ?? 0) + (vise - (etat.mouille ?? 0)) * Math.min(1, dt * (vise > (etat.mouille ?? 0) ? 0.5 : 0.05));
  const w = etat.mouille;
  if (Math.abs(w - (etat.mouilleApplique ?? -1)) < 0.01) return;
  etat.mouilleApplique = w;
  const mat = bateau.materiaux;
  for (const [nom, rugueuxMouille, assombri] of [['gelcoat', 0.08, 0.92], ['coque', 0.08, 0.95], ['antiderapant', 0.28, 0.85], ['teck', 0.32, 0.62]]) {
    const mt = mat[nom];
    if (!mt) continue;
    if (!materiauxSecs.has(nom)) materiauxSecs.set(nom, { rugosite: mt.roughness, couleur: mt.color.clone() });
    const sec = materiauxSecs.get(nom);
    mt.roughness = THREE.MathUtils.lerp(sec.rugosite, rugueuxMouille, w);
    mt.color.copy(sec.couleur).multiplyScalar(THREE.MathUtils.lerp(1, assombri, w));
  }
}

// ---------- Le radar ----------
// ce qu'il voit : la côte au loin et ses marques, la trombe, les grains, la mer… et parfois un
// écho que personne d'autre ne voit
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
  // (les marques de la côte : la bouée de la Basse du Bec, la tourelle de la Roche Rouge, le
  // musoir de la jetée — un écho net, plus fort pour ce qui est en dur)
  for (const f of FEUX) if (f.id !== 'phare') r.cibles.push({ x: f.x, z: f.z, rayon: f.flottant ? 6 : 9, force: f.flottant ? 0.75 : 0.95 });
  // (la trombe : sous son grain, un écho serré au bout du crochet de pluie qui s'enroule autour
  // d'elle — monde/grains.js)
  if (nuit?.trombe?.force > 0.1) r.cibles.push({ x: nuit.trombe.x, z: nuit.trombe.z, rayon: nuit.trombe.grain ? 80 : 170, force: 0.4 + 0.45 * nuit.trombe.force });
  // la crête d'une vague scélérate : une longue ligne qui avance (elle renvoie l'onde)
  const v = monde.houle.scelerates[0];
  if (v && v.force > 0.05) {
    const [cx, cz] = positionCrete(v, monde.houle.temps);
    r.cibles.push({ x: cx, z: cz, ligne: 1.5 * v.largeur, lx: -v.dz, lz: v.dx, largeurLigne: v.largeur, rayon: 16, force: 0.3 + 0.7 * v.force });
  }
  // l'écho que personne d'autre ne voit (quart/peur.js) : il garde son relèvement depuis
  // l'avant, quoi qu'on fasse ; tout près, il fait sonner l'alarme de la zone de garde
  const e = nuit?.peur?.echo;
  if (e && e.force > 0.02) {
    const releve = THREE.MathUtils.degToRad(physique.mesures.cap) + e.releve;
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
// quart/nuit.js décide quand ; ici, ce que l'on voit et entend
function vivreEtrange(nom) {
  if (nom === 'lumiere') {
    // un feu blanc, au loin, par le travers (d'un côté ou de l'autre), dans le creux des vagues
    const cap = THREE.MathUtils.degToRad(physique.mesures.cap + (Math.random() < 0.5 ? -1 : 1) * (45 + Math.random() * 40));
    const d = 650 + Math.random() * 300;
    monde.lumiereEtrange.montrer(physique.position.x + Math.sin(cap) * d, physique.position.z - Math.cos(cap) * d, 11);
  } else if (nom === 'voix16') {
    jeu.radio.fantome('Canal 16 : une voix, très faible, noyée dans les parasites… « …ayday… mayday… ici… » … puis plus rien.', { duree: 7.5 });
  } else if (nom === 'coups') {
    // (le monde se tait d'abord, longtemps ; puis trois coups, derrière la porte basse)
    audio.etouffer?.(5.2, 0.82);
    audio.coupsCoque?.(bateau.interieur.positionPorteAvant, 2.6);
  }
}

// ---------- D'où vient un son (dans le repère du bateau : le son le place là) ----------
const _inverse2 = new THREE.Matrix4();
const _qInverse2 = new THREE.Quaternion();
// un point du monde
function versBateau(pointMonde) {
  return pointMonde.clone().applyMatrix4(_inverse2.copy(bateau.groupe.matrixWorld).invert());
}
// d'où vient ce qui va vers « vers » (une direction du monde), à « distance » mètres, à « hauteur »
function depuisBateau(vers, distance, hauteur = 1.5) {
  const d = vers.clone().applyQuaternion(_qInverse2.copy(bateau.groupe.quaternion).invert()).setY(0).normalize();
  return new THREE.Vector3(-d.x * distance, hauteur, 1.5 - d.z * distance);
}
// l'oreille : là où sont les yeux, ce qu'ils regardent, le haut de la tête
function ecouteDansLeBateau() {
  const { yeux, regard, haut } = regardDansLeBateau();
  return { position: yeux, avant: regard, haut };
}

// La peur (quart/peur.js, par la nuit) : ce qu'on entend, ce qui secoue. (Ce qu'on voit :
// rendu/apparitions.js, à chaque image.)
function vivrePeur(e) {
  const p = nuit?.peur;
  if (e === 'gemissement') {
    const a = Math.random() * Math.PI * 2;
    audio.gemissement?.({ x: Math.sin(a) * 300, y: 2, z: Math.cos(a) * 300 });
  }
  else if (e === 'pas') {
    // (le monde se tait un instant : on les entend d'autant mieux ; la lumière hésite ; la porte
    // de la cabine avant ouverte, ils viennent de là)
    audio.etouffer?.(7.8, 0.55); // (jusqu'au dernier pas, après leur silence)
    // (sur le toit, d'un bord à l'autre ; la porte de la cabine avant ouverte : dans la cabine,
    // vers la porte)
    const sens = Math.random() < 0.5 ? 1 : -1;
    audio.pasSurLePont?.(bateau.interieur.porteAvantEtat === 'fermee'
      ? { de: { x: -0.9 * sens, y: 3.35, z: 1.6 }, a: { x: 0.9 * sens, y: 3.35, z: 3.1 } }
      : { de: { x: 0.6, y: 0.9, z: -1.3 }, a: bateau.interieur.positionPorteAvant.clone().setY(0.9).setZ(0.3) });
    etat.vacille = 1.2;
  } else if (e === 'porteAvant') {
    // (dans ton dos : le loquet qui saute, les gonds qui grincent ; on ne la voit qu'en se
    // retournant)
    bateau.interieur.ouvrirPorteAvant('entrouverte');
    // (un creux, d'abord : le monde se retire ; puis le loquet, les gonds)
    audio.etouffer?.(5, 0.65); // (jusqu'à son second grincement)
    audio.porteAvant?.(true, bateau.interieur.positionPorteAvant, 1.1);
    etat.porteAvantVue = false;
    etat.vacille = Math.max(etat.vacille ?? 0, 0.6);
  } else if (e === 'nom') {
    audio.etouffer?.(4, 0.5);
    etat.vacille = 2;
    jeu.radio.chuchoter?.(`${NOM_BATEAU}… ${NOM_BATEAU}…`, { canal: 16, sousTitre: `Canal 16 : une voix, tout près du micro, très lente : « ${NOM_BATEAU}… »` });
  } else if (e === 'coupCoque') {
    // (un long silence, d'abord : le vent, la mer se retirent… puis le choc)
    audio.etouffer?.(4.6, 0.85);
    setTimeout(() => {
      if (!nuit) return;
      audio.coupEnorme?.();
      secousse(0.9);
      audio.battement?.(1);
      etat.vacille = 1.6;
    }, 3800);
  } else if (e === 'chose') etat.vacille = 2.5;
  else if (e === 'eclairSilhouette') audio.battement?.(1);
  else if (e === 'echoProche') etat.vacille = 0.8;
  else if (e.endsWith('-fin') && p?.journal.at(-1)?.regardee) {
    audio.battement?.(0.8);
    etat.vacille = 0.7;
  }
}

// Les lumières du bord (les plafonniers, les écrans) quand le courant hésite : elles
// faiblissent, presque jusqu'au noir, ou reviennent — quand l'étrange arrive, et parfois, quand
// la peur est haute. (Au plus trois changements par seconde : plus vite, des éclats de lumière
// peuvent être dangereux pour les personnes photosensibles ; et rien du tout si l'option est
// décochée.)
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

// (le milieu d'une vitre de la timonerie : d'où l'on entend le verre)
const centreVitre = (v) => centresVitres[nuit.systemes.vitres.indexOf(v)] ?? null;
const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// Ce qui arrive aux systèmes du bord (quart/systemes.js, par la nuit) : on l'entend, on le
// lit (les conseils, une seule fois par nuit)
const premieresFois = new Set();
function vivreSysteme(nom, arg) {
  const sy = nuit.systemes;
  const une = (cle, texte) => {
    if (premieresFois.has(cle)) return;
    premieresFois.add(cle);
    afficherMessage(texte);
  };
  if (nom === 'moteur-lance') audio.demarreur?.();
  else if (nom === 'moteur-refuse') audio.demarreurFaible?.();
  else if (nom === 'moteur-demarre') une('moteur', 'Le moteur tourne : il recharge la batterie et soulage le pilote… mais on n\'entend plus venir les vagues');
  else if (nom === 'moteur-arrete' && arg === 'surchauffe') {
    audio.alarme?.(2);
    afficherMessage('Le moteur a trop chauffé : il s\'est arrêté tout seul');
  } else if (nom === 'vitre-fendue') {
    audio.vitreFendue?.(centreVitre(arg));
    afficherMessage(`${majuscule(arg.nom)} s'est fendue : à la prochaine vague, elle éclate — ferme ses volets !`);
  } else if (nom === 'vitre-brisee') {
    audio.vitreBrisee?.(centreVitre(arg));
    secousse(0.5);
    afficherMessage(`${majuscule(arg.nom)} a éclaté ! La mer entre : ferme ses volets`);
  } else if (nom === 'noir') {
    audio.coupure?.();
    afficherMessage(sy.batterie.coupee
      ? 'L\'eau a noyé les batteries : plus de courant ! Pompe à la main, puis réarme le coupe-batterie (derrière la pompe)'
      : 'Plus de courant ! La batterie est vide… et sans courant, le moteur ne démarre plus');
  } else if (nom === 'courant-revenu') afficherMessage('Le courant est revenu');
  else if (nom === 'alarme') {
    if (arg === 'cale') une('alarme-cale', 'Alarme de cale : l\'eau monte (la trappe est derrière le siège, la pompe à main juste à côté)');
    else if (arg === 'batterie') une('alarme-batterie', 'Batterie faible : démarre le moteur (son tableau est à gauche du pupitre), ou coupe ce dont tu peux te passer');
    else if (arg === 'pilote') une('alarme-pilote', 'Le pilote chauffe : le moteur le soulagerait… sinon, il va disjoncter');
    else if (arg === 'moteur') une('alarme-moteur', 'Le moteur chauffe : arrête-le avant qu\'il ne se coupe tout seul');
  }
}

// La foudre (monde/foudre.js) : ce qu'on en entend et ce qu'on en sent. La radio claque à
// chaque éclair, même lointain ; le tonnerre arrive quand son bruit a fait le chemin (trois
// secondes par kilomètre), de là où l'éclair est passé au plus près — à droite ou à gauche de
// là où l'on regarde ; une frappe tout près éblouit, assourdit, fait sauter les écrans.
function entendreLaFoudre(foudre, dedans) {
  if (foudre.t === etat.foudreLue) return;
  etat.foudreLue = foudre.t;
  for (const ev of foudre.evenements) {
    if (ev.type === 'eclair') {
      const f = 1 - THREE.MathUtils.smoothstep(ev.distance, 1500, REGLAGES_FOUDRE.parasites);
      if (f > 0.03) audio.parasiteEclair?.(f);
    } else if (ev.type === 'tonnerre') {
      // (d'où l'éclair est passé, là-haut : avec un casque, on l'entend rouler de ce côté)
      const ou = versBateau(new THREE.Vector3(ev.x, 250 + Math.min(900, ev.distance * 0.15), ev.z));
      audio.tonnerre({ distance: ev.distance, duree: ev.duree, force: ev.force, ou, claque: ev.claque });
    } else if (ev.type === 'frappe') frappeProche(ev, dedans);
  }
}

// La foudre tombe tout près (ou sur le mât) : le claquement en même temps que l'éclair, le
// souffle qui secoue, les oreilles qui sifflent (le monde s'étouffe), les écrans qui hésitent ;
// sur le mât, ils s'éteignent, et le radar redémarre
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
  }
}

// D'où vient une déferlante, vue du bateau (« par le travers tribord »…)
function cotePar(vers) {
  const origine = (Math.atan2(-vers.x, vers.z) * 180) / Math.PI; // le cap d'où elle vient
  const relatif = ((origine - physique.mesures.cap + 540) % 360) - 180;
  const a = Math.abs(relatif);
  const bord = relatif >= 0 ? 'tribord' : 'bâbord';
  return a < 30 ? 'de face' : a < 70 ? `par l'avant ${bord}` : a < 115 ? `de travers, à ${bord}` : a < 155 ? `par la hanche ${bord}` : 'par l\'arrière';
}

// La timonerie au début d'une nuit (ou d'une heure reprise) : la porte et la trappe fermées,
// les volets ouverts
function remettreLaTimonerie() {
  bateau.ouvrirDescente(false);
  ouvrirDescente(false);
  bateau.interieur.ouvrirTrappe(false);
  ouvrirTrappe(false);
  bateau.interieur.ouvrirPorteAvant('fermee');
  etat.porteAvantVue = true;
  if (nuit) {
    nuit.systemes.baladeuse = false;
    etat.eclairage = nuit.systemes.eclairage;
    etat.feux = nuit.systemes.disjoncteurs.feux;
  }
}

// Commencer la nuit : à minuit (ou reprendre une nuit gardée, au début d'une heure)
function commencerNuit({ reprise = null, heure = null } = {}) {
  jeu.radio.taire();
  premieresFois.clear();
  nuit = new Nuit({ graine: reprise?.graine ?? Math.floor(Math.random() * 1e6) });
  meteo = nuit.meteo;
  jeu.meteo = meteo;
  monde.regler(meteo);
  // vent arrière, les vagues dans le dos (le vent à 160°, sur tribord : on fuit vers l'est,
  // loin de la côte)
  const cap = Math.round((meteo.directionVent - ANGLE_PILOTE + 360) % 360);
  physique.placer(DEPART_NUIT.x, DEPART_NUIT.z, cap, monde.houle);
  physique.vitesse.copy(physique.avant).multiplyScalar(3);
  physique.rotation.set(0, 0, 0);
  Object.assign(physique, { eauCale: 0, eauCockpit: 0, ecouteFocLibre: false, grandVoileDechiree: false, focDechire: false, ecouteGV: 0.8, ecouteFoc: 0.6 }, TOILE_DE_NUIT);
  Object.assign(etat, {
    pilote: true, feux: true, gilet: true, lampe: false, eclairage: 'rouge', evenements: new Set(), majCiel: 0, majMer: 0,
    aubeEnAttente: false, eauCale: 0, calme: 0, danger: 0, pagesLues: 0, pageNouvelle: false, porteAvantFois: 0,
  });
  bateau.interieur.cire.visible = false;
  remettreLaTimonerie();
  marin.attache = false;
  barometre.historique.length = 0;
  if (reprise) {
    // (une nuit reprise : son heure, son eau, ses avaries, ce qui est déjà arrivé)
    nuit.restaurer(reprise.sauvegarde, contexteNuit(0));
    nuit.journal = (reprise.journal ?? []).map((e) => ({ ...e }));
    meteo = nuit.meteo;
    jeu.meteo = meteo;
    monde.regler(meteo);
    etat.eauCale = nuit.eau.cale;
  } else if (heure !== null) {
    // (pour vérifier : la nuit, directement à cette heure — et gardée comme si l'heure venait
    // de commencer, pour pouvoir la reprendre)
    nuit.allerA(heure);
    nuit.sauvegarde = nuit.instantane(contexteNuit(0));
    nuit.heureSauvegarde = Math.floor(nuit.heure + 1e-6);
    meteo = nuit.meteo;
    jeu.meteo = meteo;
    monde.regler(meteo);
  }
  // (une nuit reprise : les pages des heures déjà passées sont lues)
  etat.pagesLues = nuit.heure > HEURE_DEBUT ? pagesLisibles(nuit.heure).length : 0;
  nuit
    .on('journal', majCarnet)
    .on('heure', (h, signe) => {
      if (h > HEURE_DEBUT || reprise) annoncer(h === HEURE_DEBUT ? 'Minuit' : signe, heureRonde(h));
      // (une page de plus du livre de bord se lit, maintenant que son heure est venue)
      const pages = pagesLisibles(h).length;
      if (pages > (etat.pagesLues ?? 0)) {
        afficherMessage(etat.pagesLues ? `Une page de plus dans le livre de bord : ${heureRonde(h)}, la nuit d'${PROPRIETAIRE} (L)`
          : `Sur la banquette, le livre de bord de Morgane : les consignes d'${PROPRIETAIRE}, son ancien propriétaire, et sa dernière nuit (L)`);
        etat.pagesLues = pages;
        etat.pageNouvelle = true;
      }
      majCarnet();
      // (la partie est gardée au début de chaque heure)
      garderPartie({ heure: h, graine: nuit.graine, sauvegarde: nuit.instantaneAGarder(), journal: nuit.journal.slice(-40) });
    })
    .on('deferlante-annonce', (a) => {
      // (son grondement commence quand on peut l'entendre : tout de suite, ou au dernier moment
      // quand le moteur le couvre ; sa crête, on la voit courir vers nous dès maintenant)
      // (la crête court à 12 m/s : elle part de 12 × a.dans mètres, de son côté, et vient frapper)
      audio.deferlante?.(a.force, a.dans, depuisBateau(a.vers, 12 * a.dans + 8), a.entendue, depuisBateau(a.vers, 3, 1.2));
      monde.deferlantes.annoncer(a);
    })
    .on('deferlante-entendue', (a) => {
      // (les plus grosses : le fond se retire jusqu'au choc, on n'entend plus qu'elles)
      audio.grondementEntendu?.(a.force, a.dans);
      if (a.force > 0.9 && etat.mode === 'pied' && marin.dehors) afficherMessage(`Une grosse déferlante, ${cotePar(a.vers)} ! Tiens-toi (Maj)`);
      // (la première grosse qu'on entend : ce que veut dire ce grondement — une seule fois)
      else if (a.force > 0.8 && !premieresFois.has('grondement')) {
        premieresFois.add('grondement');
        afficherMessage(`Ce grondement : une grosse déferlante arrive, ${cotePar(a.vers)}. Ferme vite les volets de ce côté (la commande est au plafond) !`);
      }
      if (a.force >= 0.6) sousTitrer(`[${a.force > 1 ? 'Une énorme déferlante gronde' : 'Une déferlante gronde'}, ${cotePar(a.vers)}]`);
    })
    .on('deferlante-eclair', (a) => {
      // un éclair loin derrière sa crête : elle se découpe, blanche, sur le ciel (la crête court
      // à 12 m/s : elle est à 12 × a.dans mètres)
      if (monde.ecl.nuit < 0.3) return;
      const p = physique.position;
      const loin = 12 * a.dans + 450;
      monde.eclairSur(p.x - a.vers.x * loin, p.z - a.vers.z * loin);
    })
    .on('scelerate', (w) => sousTitrer(`[Un grondement énorme, ${directionRelative(w.relatif)}]`, 5))
    .on('deferlante', (f) => {
      etat.calme = 0;
      secousse(0.35 + f.force * 0.9);
      monde.embruns.gerbe(f, physique);
      // l'eau verte passe par-dessus le livet et balaie le pont
      bateau.paquet.frapper(f.vers.clone().transformDirection(bateau.groupe.matrixWorld.clone().invert()), f.force);
      if (!monde.dansLaCabine) monde.gouttes.eclabousser(0.4 + f.force);
      if (etat.mode === 'pied' && marin.dehors && !commandes.maj) {
        const d = f.vers.clone().applyQuaternion(physique.orientation.clone().invert());
        marin.glissade.x += d.x * f.force * 3.2;
        marin.glissade.z += d.z * f.force * 3.2;
      }
    })
    .on('avarie', (nom, { raison } = {}) => {
      if (nom === 'pilote') audio.alarme?.();
      else audio.dechirure?.(nom === 'ecouteFoc' ? 'claque' : 'dechire');
      afficherMessage({
        ecouteFoc: 'L\'écoute du foc a cassé : il bat ! Il secoue le bateau et le pilote force : sors le rouler (la bosse d\'enrouleur, dans le cockpit)',
        dalots: 'Le cockpit ne se vide plus : ses dalots sont bouchés ! Son eau passe sous la porte : sors les dégager (à l\'arrière du cockpit, derrière la roue)',
        foc: 'Le foc s\'est déchiré',
        pilote: raison === 'surchauffe'
          ? 'Alarme : le pilote a trop chauffé, son disjoncteur a sauté ! Il se réarme au tableau… une fois refroidi'
          : 'Alarme : le pilote a lâché ! Réarme son disjoncteur au tableau électrique',
      }[nom]);
    })
    .on('systeme', (nom, arg) => vivreSysteme(nom, arg))
    .on('etrange', (nom) => vivreEtrange(nom))
    .on('peur', (e) => vivrePeur(e))
    .on('scelerate-trou', () => audio.etouffer?.(2.6, 0.55))
    .on('scelerate-proche', () => audio.battement?.(1))
    .on('scelerate-eclair', () => {
      // un éclair derrière elle : sa crête noire se découpe sur le ciel
      const v = monde.houle.scelerates[0];
      if (!v || monde.ecl.nuit < 0.3) return;
      const [cx, cz] = positionCrete(v, monde.houle.temps);
      monde.eclairSur(cx - v.dx * 650, cz - v.dz * 650);
    })
    .on('scelerate-choc', (c) => {
      etat.calme = 0;
      secousse(1.6);
      audio.chocScelerate?.(depuisBateau(c.vers, 6, 2));
      monde.embruns.gerbe({ vers: c.vers, force: 1.6 }, physique);
      bateau.paquet.frapper(c.vers.clone().transformDirection(bateau.groupe.matrixWorld.clone().invert()), 1.7);
      if (!monde.dansLaCabine) monde.gouttes.eclabousser(2.2);
      if (etat.mode === 'pied' && marin.dehors) {
        const d = c.vers.clone().applyQuaternion(physique.orientation.clone().invert());
        const k = commandes.maj ? 1.5 : 4.5;
        marin.glissade.x += d.x * k;
        marin.glissade.z += d.z * k;
        if (!marin.attache) marin.etourdi = Math.max(marin.etourdi, 1.2);
      }
    })
    .on('trombe-touche', ({ force }) => {
      // le tourbillon passe sur le bateau : il le couche et le fait tourner sur lui-même, l'eau
      // arrachée à la mer s'abat sur le pont, tout craque
      const vt = nuit.ventTrombe(physique.position.x, physique.position.z, new THREE.Vector3());
      if (vt.lengthSq() > 0.01) physique.deferlante(vt, 1.1 * force);
      physique.rotation.y += (Math.random() < 0.5 ? -1 : 1) * 0.8 * force;
      physique.eauCockpit = Math.min(EAU.cockpitMax, physique.eauCockpit + 220 * force);
      if (vt.lengthSq() > 0.01) bateau.paquet.frapper(vt.clone().normalize().transformDirection(bateau.groupe.matrixWorld.clone().invert()), force);
      secousse(1);
      audio.deferlante?.(1, 0.05, vt.lengthSq() > 0.01 ? depuisBateau(vt, 5, 2) : 0);
      if (!monde.dansLaCabine) monde.gouttes.eclabousser(1.3);
      if (etat.mode === 'pied' && marin.dehors) {
        marin.glissade.addScaledVector(vt.setY(0).normalize(), 3.5 * force);
        if (!marin.attache) marin.etourdi = Math.max(marin.etourdi, 1.5);
      }
    })
    .on('eau', (seuil) => afficherMessage(seuil >= 1300 ? 'Le bateau s\'alourdit : pompe, vite !' : seuil >= 700 ? 'L\'eau monte dans la cale : pompe !' : 'De l\'eau dans la cale : pompe (la pompe est sur la paroi bâbord de la timonerie, à côté de la trappe)'))
    .on('perdue', (raison) => finir(raison))
    .on('aube', () => {
      oublierPartie(); // (la partie est finie : elle n'est plus à reprendre)
      etat.aubeEnAttente = true;
      annoncer('La nuit est finie', '6 h');
    });
  document.getElementById('carnet-journal').innerHTML = '';
  // assis au poste, dans la timonerie : le pilote tient le bateau, les écrans devant soi
  etat.mode = 'pause';
  etat.avantPause = 'poste';
  marin.lacet = 0;
  marin.site = -0.18;
  embarquer();
  majCarnet();
  if (!reprise && heure === null) annoncer('Minuit', 'Six heures avant l\'aube');
}

// Après un naufrage : on reprend au début de l'heure (l'heure, l'eau, les avaries d'alors)
function reprendreLHeure() {
  nuit.reprendre(contexteNuit(0));
  const p = physique.origine(new THREE.Vector3());
  const cap = Math.round((nuit.meteo.directionVent - ANGLE_PILOTE + 360) % 360);
  physique.placer(p.x, p.z, cap, monde.houle);
  physique.vitesse.copy(physique.avant).multiplyScalar(3);
  physique.rotation.set(0, 0, 0);
  physique.ecouteGV = 0.8;
  physique.ecouteFoc = 0.6;
  meteo = nuit.meteo;
  jeu.meteo = meteo;
  monde.regler(meteo);
  remettreLaTimonerie();
  etat.pilote = true;
  etat.eauCale = nuit.eau.cale;
  etat.mode = 'pause';
  etat.avantPause = 'poste';
  marin.lacet = 0;
  marin.site = -0.18;
  embarquer();
  annoncer('On reprend', heureRonde(nuit.heure));
}

// Six heures : le bilan de la nuit
function afficherAube() {
  etat.aubeEnAttente = false;
  document.exitPointerLock?.();
  etat.avantPause = etat.mode === 'pied' ? 'pied' : 'poste';
  etat.mode = 'pause';
  document.getElementById('bilan-nuit').innerHTML = nuit.bilan().map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  hud.hidden = true;
  document.getElementById('aube').hidden = false;
}

// ---------- La partie gardée (pour la reprendre plus tard) ----------
// Au début de chaque heure de la nuit, le navigateur garde où l'on en est.
const CLE_PARTIE = 'quart-de-nuit:nuit-seule';
function garderPartie(partie) {
  try {
    localStorage.setItem(CLE_PARTIE, JSON.stringify({ version: 2, date: Date.now(), ...partie }));
  } catch { /* stockage refusé : tant pis, on ne pourra pas reprendre */ }
}
function lirePartie() {
  try {
    const p = JSON.parse(localStorage.getItem(CLE_PARTIE) ?? 'null');
    return p?.version === 2 && p.sauvegarde ? p : null;
  } catch {
    return null;
  }
}
function oublierPartie() {
  try { localStorage.removeItem(CLE_PARTIE); } catch { /* rien à faire */ }
}
function reprendrePartie() {
  const p = lirePartie();
  if (p) commencerNuit({ reprise: p });
}
// l'accueil : « Reprendre à 3 h » s'il y a une partie gardée
function majAccueil() {
  const p = lirePartie();
  const bouton = document.getElementById('reprendre-partie');
  bouton.hidden = !p || p.heure <= HEURE_DEBUT;
  if (!p) return;
  const d = new Date(p.date);
  const quand = `${d.toLocaleDateString('fr-FR', { weekday: 'long' })} à ${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
  document.getElementById('reprendre-detail').textContent = `à ${heureRonde(p.heure)} · ${quand}`;
}

// Revenir à l'accueil (la partie reste gardée : on pourra la reprendre)
function quitter() {
  jeu.radio.taire();
  nuit = null;
  document.exitPointerLock?.();
  etat.mode = 'accueil';
  etat.aubeEnAttente = false;
  for (const id of ['pause', 'fin', 'aube']) document.getElementById(id).hidden = true;
  hud.hidden = true;
  accueil.hidden = false;
  meteo = meteoDeLaNuit(25.2);
  jeu.meteo = meteo;
  monde.regler(meteo);
  mettreALaCape();
  physique.eauCale = 0;
  physique.eauCockpit = 0;
  etat.eauCale = 0;
  majAccueil();
}

// Une annonce au milieu de l'écran (chaque heure qui sonne)
let minuterieAnnonce = null;
function annoncer(petit, grand) {
  const a = document.getElementById('annonce');
  a.innerHTML = `<small>${petit}</small>${grand}`;
  a.classList.add('visible');
  clearTimeout(minuterieAnnonce);
  minuterieAnnonce = setTimeout(() => a.classList.remove('visible'), 3800);
}

// L'heure, en haut à droite (comme une montre qu'on regarde), et ce qui ne va pas à bord
let heureAffichee = '';
function afficherHeure() {
  const zone = document.getElementById('heure');
  if (!nuit) {
    zone.hidden = true;
    return;
  }
  zone.hidden = false;
  const alertes = [];
  const sy = nuit.systemes;
  if (!sy.courant) alertes.push(sy.batterie.coupee ? 'Batteries noyées' : 'Plus de courant');
  if (nuit.avaries.pilote === 'panne') alertes.push('Pilote en panne');
  else if (sy.alarmes.has('pilote')) alertes.push('Le pilote chauffe');
  else if (!sy.pilote.engage) alertes.push('Pilote en veille');
  if (sy.alarmes.has('moteur')) alertes.push('Le moteur chauffe');
  if (sy.alarmes.has('batterie')) alertes.push('Batterie faible');
  if (sy.alarmes.has('cale')) alertes.push('Alarme de cale');
  const brisees = sy.vitres.filter((v) => v.etat === 'brisee').length;
  const fendues = sy.vitres.filter((v) => v.etat === 'fendue').length;
  if (brisees) alertes.push(`${brisees} vitre${brisees > 1 ? 's' : ''} brisée${brisees > 1 ? 's' : ''}`);
  else if (fendues) alertes.push(`${fendues} vitre${fendues > 1 ? 's' : ''} fendue${fendues > 1 ? 's' : ''}`);
  if (nuit.avaries.ecouteFoc === 'cassee' && physique.deroule > 0.03) alertes.push('Le foc bat');
  if (nuit.avaries.dalots === 'bouches') alertes.push('Dalots bouchés');
  if (bateau.descenteOuverte) alertes.push('Porte ouverte');
  // (la batterie, sous l'heure, comme le courant qui reste dans FNAF ; le moteur qui tourne)
  const batterie = sy.courant ? `Batterie ${Math.round(sy.batterie.charge * 100)} %${sy.moteurEnMarche ? ' · moteur' : ''}` : 'Batterie —';
  const cle = `${heureRonde(nuit.heure)}|${batterie}|${alertes.join('|')}`;
  if (cle === heureAffichee) return;
  heureAffichee = cle;
  zone.querySelector('.h').textContent = heureRonde(Math.min(nuit.heure, HEURE_AUBE));
  zone.querySelector('.batterie').textContent = batterie;
  zone.querySelector('.batterie').classList.toggle('faible', !sy.courant || sy.batterie.charge < BATTERIE.faible);
  zone.querySelector('.alertes').innerHTML = alertes.map((a) => `<li>${a}</li>`).join('');
}

// Le livre de bord (L) : les consignes d'Yves Le Bihan, sa dernière nuit, et le journal de la tienne
function basculerCarnet() {
  etat.carnet = !etat.carnet;
  document.getElementById('carnet').hidden = !etat.carnet;
  if (!etat.carnet) return;
  majCarnet();
  // (une page qu'on n'a pas encore lue : le livre s'ouvre sur elle)
  if (etat.pageNouvelle) {
    etat.pageNouvelle = false;
    document.querySelector('#carnet-pages li:last-child')?.scrollIntoView({ block: 'start' });
  }
}
// (ses consignes se déroulent à la molette — même quand la souris est prise par le jeu)
document.addEventListener('wheel', (e) => {
  if (!etat.carnet || e.target.closest?.('#carnet')) return;
  document.querySelector('#carnet .gauche').scrollTop += e.deltaY;
}, { passive: true });
function majCarnet() {
  const journal = document.getElementById('carnet-journal');
  journal.innerHTML = (nuit?.journal ?? []).slice(-16).map((e) => `<li><span class="h">${heureEnTexte(e.heure)}</span><span>${e.texte}</span></li>`).join('');
  // les pages de sa dernière nuit, jusqu'à l'heure qu'il est
  const pages = document.getElementById('carnet-pages');
  const lisibles = nuit ? pagesLisibles(nuit.heure) : [];
  if (pages.childElementCount !== lisibles.length) {
    pages.innerHTML = lisibles.map((p) => `<li${p.inachevee ? ' class="inachevee"' : ''}>${p.texte}</li>`).join('');
  }
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
  // (outil de mise au point : une caméra posée n'importe où, dans le repère du bateau)
  if (etat.cameraLibre) {
    const { position, cible } = etat.cameraLibre;
    cam.position.copy(position).applyMatrix4(bateau.groupe.matrixWorld);
    cam.up.set(0, 1, 0);
    cam.lookAt(cible.clone().applyMatrix4(bateau.groupe.matrixWorld));
    return;
  }
  // la tête tourne avec la souris
  if (etat.mode === 'pied' || etat.mode === 'poste') {
    const souris = commandes.lireSouris();
    const k = 0.0022 * options.sensibilite;
    marin.lacet -= souris.dx * k;
    marin.site = THREE.MathUtils.clamp(marin.site - souris.dy * k * (options.inverser ? -1 : 1), -1.35, 1.4);
  }
  const auPoste = etat.mode === 'poste' || (etat.mode !== 'pied' && etat.avantPause === 'poste');
  let local;
  if (auPoste) {
    // assis au poste de pilotage, face au pare-brise
    local = YEUX_POSTE.clone();
  } else {
    local = marin.position.clone();
    local.y += marin.hauteurYeux();
  }
  cam.position.copy(local).applyMatrix4(bateau.groupe.matrixWorld);
  // la tête compense une partie du roulis et du tangage (debout, on se tient plus droit) ;
  // l'option « horizon stable » la fait compenser presque tout (contre le mal de mer)
  _e.setFromQuaternion(physique.orientation, 'YXZ');
  const naturel = auPoste ? 0.5 : 0.35;
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
const AIDE = {
  poste: [
    ['E', 'agir sur ce que tu regardes (radar, tableau, VHF, volets…)'],
    [TOUCHES.lever.nom, 'se lever'],
    [`${TOUCHES.lampe.nom} · ${TOUCHES.carnet.nom}`, 'lampe frontale · livre de bord'],
    [TOUCHES.aide.nom, 'cacher l\'aide'],
  ],
  pied: [
    ['Z Q S D', 'marcher'],
    ['E', 'agir sur ce que tu regardes'],
    ['Maj + E', 'l\'action inverse'],
    ['Maj', 'se tenir (on ne glisse plus)'],
    [TOUCHES.accroupir.nom, 's\'accroupir'],
    [TOUCHES.harnais.nom, 'harnais : s\'attacher, se détacher'],
    [`${TOUCHES.lampe.nom} · ${TOUCHES.carnet.nom}`, 'lampe frontale · livre de bord'],
    [TOUCHES.aide.nom, 'cacher l\'aide'],
  ],
};
let modeAide = null;
function majAide() {
  document.getElementById('viseur').hidden = etat.mode !== 'pied' && etat.mode !== 'poste';
  if (modeAide === etat.mode) return;
  modeAide = etat.mode;
  const liste = AIDE[etat.mode] ?? AIDE.poste;
  document.getElementById('aide-touches').innerHTML = liste.map(([t, d]) => `<dt>${t}</dt><dd>${d}</dd>`).join('')
    + '<dt>Échap</dt><dd>pause</dd>';
}

// Les bruits qui comptent (une vague qu'on entend venir, et d'où), écrits à l'écran : seulement
// si on l'a demandé (les options : pour jouer sans le son), au-dessus des sous-titres de la radio
let minuterieBruit = null;
function sousTitrer(texte, duree = 3.2) {
  const b = document.getElementById('bruits');
  if (!options.bruits || !b) return;
  b.textContent = texte;
  b.hidden = false;
  clearTimeout(minuterieBruit);
  minuterieBruit = setTimeout(() => { b.hidden = true; }, duree * 1000);
}

let minuterieMessage = null;
function afficherMessage(texte) {
  const m = document.getElementById('message');
  m.textContent = texte;
  m.classList.add('visible');
  clearTimeout(minuterieMessage);
  // (le temps de le lire : plus il est long, plus il reste)
  minuterieMessage = setTimeout(() => m.classList.remove('visible'), Math.min(8000, 2600 + texte.length * 40));
}

// ce que l'on vise (au centre de l'écran) : « E : pomper »
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

function afficherEtatBord() {
  const h = document.getElementById('harnais');
  h.dataset.attache = String(marin.attache);
  h.textContent = marin.attache ? 'Harnais : attaché' : `Harnais : détaché (${TOUCHES.harnais.nom})`;
  h.hidden = etat.mode !== 'pied' || !marin.dehors;
  majAide();
}

function embarquer() {
  audio.demarrer();
  if (etat.mode === 'pause') etat.mode = etat.avantPause;
  else etat.mode = 'poste';
  accueil.hidden = true;
  pause.hidden = true;
  fin.hidden = true;
  hud.hidden = false;
  commandes.capturer();
  commandes.lireAppuis();
  majAide();
}

// Fin de partie
function finir(raison) {
  if (etat.mode === 'fin') return;
  etat.mode = 'fin';
  etat.action = null;
  document.exitPointerLock?.();
  hud.hidden = true;
  const textes = {
    horsBord: ['Passé par-dessus bord', 'Le bateau s\'est couché et tu as passé les filières. Dehors, accroche toujours ton harnais à la ligne de vie (X).'],
    bome: ['Assommé par la bôme', 'Quand le bateau a empanné, la bôme a traversé le cockpit. Dans le cockpit, accroupis-toi (C).'],
    emporte: ['Emporté par une déferlante', 'Une vague a balayé le bateau couché, et tu n\'étais pas attaché. Dehors, le harnais reste accroché (X).'],
    naufrage: ['Le bateau a coulé', 'Trop d\'eau à bord : Morgane s\'est alourdie, puis enfoncée. Garde la porte fermée, les volets du côté d\'où viennent les vagues (une vitre brisée laisse entrer la mer), et pompe dès que l\'eau monte dans la cale.'],
    chavirage: ['Chaviré', 'Le bateau s\'est retourné et ne s\'est pas redressé. Sans pilote, il se met en travers des vagues : quand il chauffe, soulage-le (le moteur, le foc roulé) ; s\'il disjoncte, réarme-le au tableau dès qu\'il a refroidi.'],
  };
  const [titre, texte] = textes[raison] ?? textes.naufrage;
  document.getElementById('titre-fin').textContent = titre;
  document.getElementById('texte-fin').textContent = texte;
  document.getElementById('heure-fin').textContent = nuit ? `Il était ${heureEnTexte(nuit.heure)}.` : '';
  document.getElementById('reprendre-heure').textContent = nuit?.heureSauvegarde ? `Reprendre à ${heureRonde(nuit.heureSauvegarde)}` : 'Reprendre';
  if (nuit?.etat === 'nuit') nuit.perdre(raison, contexteNuit(0));
  fin.hidden = false;
}

document.getElementById('prendre-le-quart').addEventListener('click', () => commencerNuit());
document.getElementById('reprendre-partie').addEventListener('click', reprendrePartie);
document.getElementById('quitter').addEventListener('click', quitter);
document.getElementById('pause-carnet').addEventListener('click', () => {
  pause.hidden = true;
  if (!etat.carnet) basculerCarnet();
});
document.getElementById('recommencer-ici').addEventListener('click', () => {
  if (nuit?.etat === 'nuit') reprendreLHeure();
});
document.getElementById('reprendre').addEventListener('click', embarquer);
document.getElementById('reprendre-heure').addEventListener('click', () => { if (nuit) reprendreLHeure(); });
document.getElementById('recommencer-nuit').addEventListener('click', () => commencerNuit());
document.getElementById('accueil-fin').addEventListener('click', quitter);
document.getElementById('rejouer-nuit').addEventListener('click', () => {
  document.getElementById('aube').hidden = true;
  commencerNuit();
});
document.getElementById('accueil-aube').addEventListener('click', quitter);
canvas.addEventListener('click', () => { if (etat.mode === 'pause') embarquer(); });
document.addEventListener('pointerlockchange', () => {
  // (etat.essai : les outils de mise au point jouent sans souris capturée)
  if ((etat.mode === 'pied' || etat.mode === 'poste') && document.pointerLockElement !== canvas && !etat.essai) {
    // la souris est libérée (Échap) : pause (le bateau continue de naviguer)
    etat.avantPause = etat.mode;
    etat.mode = 'pause';
    const ici2 = document.getElementById('recommencer-ici');
    ici2.hidden = nuit?.etat !== 'nuit';
    ici2.textContent = nuit?.heureSauvegarde ? `Recommencer à ${heureRonde(nuit.heureSauvegarde)}` : 'Recommencer';
    document.getElementById('pause-ou').textContent = nuit ? `${heureEnTexte(nuit.heure)} · ${Math.round(nuit.meteo.vent)} nœuds` : '';
    pause.hidden = false;
  }
});

// ---------- La fenêtre des options ----------
const fenetreOptions = document.getElementById('options');
const TEXTES_QUALITE = {
  auto: 'Le jeu choisit lui-même selon ton ordinateur, et ajuste en jouant pour rester fluide.',
  economique: 'Pour un ordinateur modeste : moins de pixels, de nuages et de pluie.',
  moyenne: 'Un bon équilibre pour la plupart des ordinateurs.',
  haute: 'L\'image prévue : il faut un ordinateur assez récent.',
  superbe: 'Le plus fin (écran Retina) : pour un ordinateur puissant.',
};
const CASES = ['inverser', 'secousses', 'gouttes', 'clignotements', 'sousTitres', 'bruits', 'casque'];
{
  const zone = document.getElementById('choix-qualite');
  for (const id of ['auto', 'economique', 'moyenne', 'haute', 'superbe']) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.qualite = id;
    b.textContent = id === 'auto' ? 'Auto (conseillé)' : QUALITES[id].nom;
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
  for (const cle of CASES) {
    document.getElementById(`o-${cle}`).addEventListener('change', (e) => changerOptions({ [cle]: e.target.checked }));
  }
  for (const b of document.querySelectorAll('[data-nuit]')) b.addEventListener('click', () => changerOptions({ nuit: b.dataset.nuit }));
  majFenetreOptions.curseurs = curseurs;
}
// (en Auto, la note dit aussi où en est le jeu : elle se met à jour tant que la fenêtre est ouverte)
function majNoteQualite() {
  const note = document.getElementById('note-qualite');
  note.textContent = options.qualite === 'auto' ? `${TEXTES_QUALITE.auto} ${etatQualite()}` : TEXTES_QUALITE[options.qualite];
}
setInterval(() => {
  if (fenetreOptions?.open && options.qualite === 'auto') majNoteQualite();
}, 500);
function majFenetreOptions() {
  if (!fenetreOptions) return;
  for (const b of document.querySelectorAll('[data-qualite]')) b.setAttribute('aria-pressed', String(b.dataset.qualite === options.qualite));
  majNoteQualite();
  for (const [cle, texte] of Object.entries(majFenetreOptions.curseurs ?? {})) {
    document.getElementById(`o-${cle}`).value = options[cle];
    document.getElementById(`v-${cle}`).textContent = texte(options[cle]);
  }
  for (const cle of CASES) document.getElementById(`o-${cle}`).checked = options[cle];
  for (const b of document.querySelectorAll('[data-nuit]')) b.setAttribute('aria-pressed', String(b.dataset.nuit === options.nuit));
}
function ouvrirFenetre(id) {
  const f = document.getElementById(id);
  majFenetreOptions();
  if (!f.open) f.showModal();
}
document.getElementById('ouvrir-options').addEventListener('click', () => ouvrirFenetre('options'));
document.getElementById('pause-options').addEventListener('click', () => ouvrirFenetre('options'));
document.getElementById('ouvrir-apropos').addEventListener('click', () => ouvrirFenetre('apropos'));

// ---------- La carte graphique qui lâche ----------
// Trop de travail d'un coup, l'ordinateur en veille, un pilote qui redémarre : le navigateur
// reprend la carte graphique, et l'on ne peut plus rien dessiner. On le dit, et on propose
// de recharger la page (la nuit est gardée au début de chaque heure : on la reprendra là).
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  etat.cartePerdue = true;
  document.exitPointerLock?.();
  audio.ctx?.suspend?.();
  document.getElementById('detail-carte-perdue').textContent = nuit && lirePartie()
    ? 'Recharge la page : ta nuit reprendra au début de l\'heure (elle est gardée à chaque heure).'
    : 'Recharge la page pour reprendre.';
  document.getElementById('carte-perdue').hidden = false;
  document.getElementById('recharger').focus();
});
document.getElementById('recharger').addEventListener('click', () => location.reload());

// ---------- Au démarrage ----------
appliquerOptions(options);
majAccueil();
// un téléphone : le jeu se joue au clavier et à la souris
if (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) <= 520) {
  document.getElementById('telephone').hidden = false;
}
// on prépare tous les shaders (la trombe, les déferlantes… n'apparaissent qu'en pleine nuit :
// les préparer à ce moment-là ferait sauter l'image)
{
  const boutons = [...accueil.querySelectorAll('button')];
  for (const b of boutons) b.disabled = true;
  const chargement = document.getElementById('chargement');
  const pret = () => {
    for (const b of boutons) b.disabled = false;
    chargement.textContent = '';
  };
  // (après deux images : le ciel et la lumière sont en place ; mais un onglet resté en
  // arrière-plan ne dessine pas d'image : une minuterie prend le relais. Et quoi qu'il arrive,
  // au bout de 10 s, on peut jouer.)
  let lance = false;
  const lancer = () => {
    if (lance) return;
    lance = true;
    monde.precompiler().then(pret, pret);
  };
  requestAnimationFrame(() => requestAnimationFrame(lancer));
  setTimeout(lancer, 1500);
  setTimeout(pret, 10000);
}
// (jeu.html?heure=27 : commencer directement la nuit à cette heure — pour vérifier)
if (parametres.has('heure')) {
  const h = Number(parametres.get('heure'));
  if (Number.isFinite(h)) setTimeout(() => commencerNuit({ heure: h < 24 ? h + 24 : h }), 400);
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
  afficherEtatBord();
  afficherHeure();
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
  monde, physique, bateau, etat, marin, jeu, gestes, embarquer, photographier, avancer, commandes, Audio, audio, finir,
  commencerNuit, get nuit() { return nuit; }, contexteNuit, regarder, profiler, directionRelative,
  get regulateur() { return regulateur; },
  // (une caméra posée à la main : voir(x, y, z, versX, versY, versZ), dans le repère du bateau ;
  // voir() la rend au marin)
  voir: (...v) => { etat.cameraLibre = v.length ? { position: new THREE.Vector3(v[0], v[1], v[2]), cible: new THREE.Vector3(v[3], v[4], v[5]) } : null; },
  uneImage: (dt = 1 / 60) => monde.image(dt, { simuler, placerCamera }),
  // (l'étrange, à la demande, pour l'entendre et le voir : 'lumiere', 'voix16', 'coups')
  peur: (nom) => vivreEtrange(nom),
  // (l'inspection du pont : le plan où l'on marche colle-t-il au modèle 3D ?)
  inspecterPont: async (o) => (await import('./atelier/inspection-pont.js')).inspecterPont(bateau, { encombrement: marin.encombrement, ...o }),
  // (les essais de marche : un marin automatique fait le tour du bord et manie chaque chose)
  essayerLaMarche: async (o) => {
    const { essayerLaMarche } = await import('./atelier/essais-marche.js');
    etat.fige = true;
    try {
      return await essayerLaMarche({
        marin, gestes, gesteVise, commandes, seLever: quitterLePoste, bateau, regarder, obstacle: porteFermeeEntre,
        uneImage: (dt) => monde.image(dt, { simuler, placerCamera }),
        basculerDescente: () => jeu.basculerDescente(),
      }, o);
    } finally {
      etat.fige = false;
    }
  },
  // (les essais d'entrée : on vise la porte de la timonerie de plusieurs endroits, Z enfoncé)
  essayerLesEntrees: async (o) => {
    const { essayerLesEntrees, essaisEntree } = await import('./atelier/essais-marche.js');
    etat.fige = true;
    try {
      const r = await essayerLesEntrees({
        marin, commandes, seLever: quitterLePoste, bateau,
        uneImage: (dt) => monde.image(dt, { simuler, placerCamera }),
        basculerDescente: () => jeu.basculerDescente(),
      }, { essais: essaisEntree(TIMONERIE.zArriere), ...o });
      return r.map((x) => `${x.ok ? '✓' : '✗'} ${x.nom} : ${x.secondes.toFixed(1)} s${x.ok ? '' : ` — arrêté en (${x.fin.map((v) => v.toFixed(2)).join(', ')}), ${x.zone}`}`);
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
};
function boucle(maintenant) {
  const intervalle = maintenant - dernier;
  const dt = Math.min(intervalle / 1000, 0.05);
  dernier = maintenant;
  // (les outils de mise au point font avancer le jeu eux-mêmes, image par image ; et sans
  // carte graphique, il n'y a plus rien à faire)
  if (etat.fige || etat.cartePerdue) { requestAnimationFrame(boucle); return; }
  const debut = performance.now();
  monde.image(dt, { simuler, placerCamera, enDirect: true });
  ageInstruments += dt;
  if (ageInstruments > 0.12 && etat.mode !== 'accueil') {
    afficherEtatBord();
    afficherHeure();
    ageInstruments = 0;
  }
  afficherGeste();
  // (six heures : on attend que le soleil soit levé)
  if (etat.aubeEnAttente && (nuit?.heure ?? 99) >= HEURE_LEVER - 0.01) afficherAube();
  // (le faux processeur lent : tout ce calcul prend « freinProcesseur » fois plus de temps)
  if (freinProcesseur > 1) {
    const fin = performance.now() + (performance.now() - debut) * (freinProcesseur - 1);
    while (performance.now() < fin);
  }
  // (la qualité « Auto » : le régulateur juge chaque image — son intervalle, et le temps du
  // calcul, sans celui passé à donner le dessin à la carte graphique ; pas quand l'onglet est
  // caché, où le navigateur ralentit exprès les images)
  if (regulateur && document.hidden) regulateur.interrompre(maintenant);
  else if (regulateur) {
    const cran = regulateur.noter(intervalle, performance.now() - debut - monde.derniere.dessin, maintenant);
    if (cran !== null) appliquerCran(cran);
    garderCran(maintenant);
  }
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);
