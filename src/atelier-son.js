// L'atelier du son : écouter chaque situation de la nuit, régler à la main ce que le jeu donne
// au son, voir le mélange en direct, mesurer le volume ressenti de chaque situation — et les
// signes : la grosse vague qu'on doit entendre venir (assez tôt pour fermer ses volets, sauf
// quand le moteur la couvre : on ne l'entend alors que dans son dernier tiers), et de son côté ;
// le silence avant les coups — et parcourir la sonothèque (d'où vient chaque enregistrement).
import { Audio } from './son/audio.js';
import { Sonotheque } from './son/sonotheque.js';
import { lufs } from './son/mesure.js';
import { preavis } from './monde/deferlantes.js';
import { ENTENDRE } from './quart/nuit.js';

const BASE = `${import.meta.env.BASE_URL}sons/`;
const pct = (v) => `${Math.round(v * 100)} %`;
const virgule = (x, n = 1) => x.toFixed(n).replace('.', ',');

// Où sont les choses à bord (comme dans le jeu : quart.js), et l'oreille : assis au poste, face
// au pare-brise (repère du bateau : tribord vers +x, le haut vers +y, l'arrière vers +z)
const LIEUX = {
  moteur: { x: 0, y: 0.35, z: 4.6 }, cale: { x: -0.65, y: 0.35, z: 2.9 }, pompe: { x: -1.2, y: 1.6, z: 3.2 },
  console: { x: 0, y: 1.85, z: 1.1 }, vhf: { x: -0.3, y: 2.95, z: 1.35 }, safran: { x: 0, y: 0.6, z: 6.1 },
  volets: { x: 0, y: 3, z: 2.2 }, dalots: { x: 0, y: 0.8, z: 5.97 }, etrave: { x: 0, y: 1, z: -7.2 }, foc: { x: 0, y: 5, z: -5.5 },
};
const AU_POSTE = { position: { x: 0, y: 2.44, z: 1.88 }, avant: { x: 0, y: -0.15, z: -0.99 }, haut: { x: 0, y: 0.99, z: -0.15 } };
const TOURNE = { ...AU_POSTE, avant: { x: 0, y: -0.15, z: 0.99 }, haut: { x: 0, y: 0.99, z: 0.15 } }; // (la tête tournée vers l'arrière)
const PORTE_CABINE = { x: -1.1, y: 1.37, z: 0.78 };

// ce que le jeu donne au son (voir Audio.maj)
const CURSEURS = [
  ['vent', 'Vent apparent', 0, 50, 1, (v) => `${v} nœuds`],
  ['pluie', 'La pluie', 0, 1, 0.05, pct],
  ['houle', 'Les vagues (hauteur)', 0, 6, 0.1, (v) => `${virgule(v)} m`],
  ['vitesse', 'La vitesse du bateau', 0, 9, 0.5, (v) => `${v} nœuds`],
  ['mouvement', 'Le bateau est secoué', 0, 1, 0.05, pct],
  ['heure', 'L\'heure de la nuit', 24, 30, 0.25, (v) => `${Math.floor(v) % 24} h ${String(Math.round((v % 1) * 60)).padStart(2, '0')}`],
  ['moteur', 'Le moteur', 0, 1, 1, (v) => (v ? 'en marche' : 'arrêté')],
  ['porte', 'La porte de la timonerie', 0, 1, 1, (v) => (v ? 'ouverte' : 'fermée')],
  ['volets', 'Les volets fermés', 0, 4, 1, (v) => `${v} côté${v > 1 ? 's' : ''} sur 4`],
];

// les situations de la nuit ; cible : le volume ressenti visé (LUFS, de … à …)
const NUIT = { pluie: 0.6, vitesse: 5.5, nuit: 1, voiles: 0.15, moteur: 0, porte: 0, volets: 0 };
const SITUATIONS = [
  { id: 'minuit', nom: 'Minuit, au poste', dedans: true, e: { ...NUIT, vent: 29, houle: 3, mouvement: 0.35, heure: 24.2 }, cible: [-33, -27] },
  { id: 'trois', nom: '3 h, au poste', dedans: true, e: { ...NUIT, vent: 36, pluie: 0.7, houle: 4.2, mouvement: 0.5, heure: 27.2 }, cible: [-31, -25] },
  { id: 'cinq', nom: '5 h, au plus fort, au poste', dedans: true, e: { ...NUIT, vent: 42, pluie: 0.9, houle: 5.4, vitesse: 7, mouvement: 0.7, heure: 29.2 }, cible: [-29, -23] },
  { id: 'moteur', nom: '5 h, au poste, le moteur en marche', dedans: true, e: { ...NUIT, vent: 42, pluie: 0.9, houle: 5.4, vitesse: 7, mouvement: 0.7, heure: 29.2, moteur: 1 }, cible: [-26, -20] },
  { id: 'porte', nom: '5 h, au poste, la porte ouverte', dedans: true, e: { ...NUIT, vent: 42, pluie: 0.9, houle: 5.4, vitesse: 7, mouvement: 0.7, heure: 29.2, porte: 1 }, cible: [-25, -19] },
  { id: 'volets', nom: '5 h, au poste, tous les volets fermés', dedans: true, e: { ...NUIT, vent: 42, pluie: 0.9, houle: 5.4, vitesse: 7, mouvement: 0.7, heure: 29.2, volets: 4 }, cible: [-32, -25] },
  { id: 'cockpit', nom: '4 h 30, dehors, dans le cockpit', e: { ...NUIT, vent: 40, pluie: 0.85, houle: 5, vitesse: 6.5, mouvement: 0.65, heure: 28.5 }, cible: [-20, -14] },
];

// Une déferlante, comme dans le jeu (quart.js) : elle part de son côté, à 12 × préavis mètres
// (sa crête court à 12 m/s), et vient frapper à 3 m ; on commence à l'entendre tout de suite —
// ou, le moteur en marche, dans son dernier tiers (ENTENDRE) : devant les plus grosses, le fond se
// retire alors (grondementEntendu). cote : 1 tribord, −1 bâbord, 0 par l'arrière ; plusTard
// (secondes, quoi) : ce qui doit arriver ensuite
function vague(a, plusTard, { force = 1, cote = 1, moteur = false } = {}) {
  const d = preavis(force);
  const entendue = d * (moteur ? ENTENDRE.moteur : 1);
  const loin = 12 * d + 8;
  const de = cote ? { x: cote * loin, y: 1.5, z: 1.5 } : { x: 0, y: 1.5, z: loin };
  const vers = cote ? { x: cote * 3, y: 1.2, z: 1.5 } : { x: 0, y: 1.2, z: 4.5 };
  a.deferlante(force, d, de, entendue, vers);
  plusTard(d - entendue, () => a.grondementEntendu(force, entendue));
  return d;
}
// L'étrange, comme dans le jeu (quart.js : vivreEtrange, vivrePeur) : le monde se tait d'abord,
// longtemps, puis…
const troisCoups = (a) => { a.etouffer(5.2, 0.82); a.coupsCoque(PORTE_CABINE, 2.6); };
const porteQuiSOuvre = (a) => { a.etouffer(5, 0.65); a.porteAvant(true, PORTE_CABINE, 1.1); };
const SUR_LE_TOIT = { de: { x: -0.9, y: 3.35, z: 1.6 }, a: { x: 0.9, y: 3.35, z: 3.1 } };
const pasSurLeToit = (a) => { a.etouffer(7.8, 0.55); a.pasSurLePont(SUR_LE_TOIT); };
const EVENEMENTS = [
  ['Une grosse déferlante de tribord', (a, plusTard) => vague(a, plusTard, { moteur: !!valeurs.moteur })],
  ['Une grosse déferlante de bâbord', (a, plusTard) => vague(a, plusTard, { cote: -1, moteur: !!valeurs.moteur })],
  ['Une déferlante par l\'arrière', (a, plusTard) => vague(a, plusTard, { force: 0.7, cote: 0, moteur: !!valeurs.moteur })],
  ['Tonnerre tout près, devant', (a) => a.tonnerre({ distance: 500, force: 1, ou: { x: 0, y: 300, z: -500 } })],
  ['Tonnerre au loin, à bâbord', (a) => a.tonnerre({ distance: 7000, force: 1, ou: { x: -7000, y: 900, z: 0 } })],
  ['Un creux du vent', (a) => { a.creux.prochain = 0; a.respirer(0, valeurs.heure); }],
  // l'étrange de la nuit (jamais expliqué)
  ['Une voix sur le 16', (a) => a.voixFantome(7.5)],
  ['Trois coups, derrière la porte basse', (a) => troisCoups(a)],
  ['La porte basse s\'entrouvre', (a) => porteQuiSOuvre(a)],
  ['Des pas sur le toit', (a) => pasSurLeToit(a)],
  ['Le cœur qui bat', (a) => { for (let k = 0; k < 8; k++) setTimeout(() => a.battement(0.4 + k * 0.08), k * 650); }],
];

// L'état des réglages (la situation choisie, modifiable aux curseurs)
let situation = SITUATIONS[0];
const valeurs = { ...situation.e };
let dedans = true;

// ----- les curseurs -----
const zoneCurseurs = document.getElementById('curseurs');
for (const [cle, nom, min, max, pas, texte] of CURSEURS) {
  const l = document.createElement('label');
  l.innerHTML = `<span>${nom} <output id="v-${cle}"></output></span><input type="range" id="c-${cle}" min="${min}" max="${max}" step="${pas}">`;
  zoneCurseurs.append(l);
  l.querySelector('input').addEventListener('input', (ev) => {
    valeurs[cle] = Number(ev.target.value);
    l.querySelector('output').textContent = texte(valeurs[cle]);
  });
}
const caseDedans = document.createElement('label');
caseDedans.className = 'case';
caseDedans.innerHTML = '<input type="checkbox" id="c-dedans"> Dans la timonerie';
zoneCurseurs.append(caseDedans);
caseDedans.querySelector('input').addEventListener('change', (ev) => { dedans = ev.target.checked; });
function majCurseurs() {
  for (const [cle, , , , , texte] of CURSEURS) {
    document.getElementById(`c-${cle}`).value = valeurs[cle];
    document.getElementById(`v-${cle}`).textContent = texte(valeurs[cle]);
  }
  document.getElementById('c-dedans').checked = dedans;
}

// ----- les situations -----
const zoneSituations = document.getElementById('situations');
for (const s of SITUATIONS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = s.nom;
  b.dataset.id = s.id;
  b.addEventListener('click', () => {
    situation = s;
    Object.assign(valeurs, s.e);
    dedans = !!s.dedans;
    majCurseurs();
    for (const x of zoneSituations.children) x.setAttribute('aria-pressed', String(x === b));
  });
  zoneSituations.append(b);
}
zoneSituations.children[0].setAttribute('aria-pressed', 'true');
majCurseurs();

// ce que le jeu donne au son, à partir des réglages
const entrees = (v, ecoute = AU_POSTE) => ({
  ventApparent: v.vent, vitesse: v.vitesse, faseyement: 0, pluie: v.pluie,
  bordage: 0, houle: v.houle, eauCale: 0, eauCockpit: 0, roulis: v.mouvement * 0.3,
  mouvement: v.mouvement, nuit: v.nuit ?? 1, voiles: v.voiles ?? 0.15, pilote: 0.3, trombe: 0, cargo: 0,
  regimeMoteur: v.moteur ? 1 : 0, heure: v.heure, ecoute,
});
const preparer = (a, s, ecoute) => {
  a.fixerLieux(LIEUX);
  a.ecouter(ecoute);
  a.dansLaCabine(!!s.dedans, { porte: s.e.porte ?? 0, volets: s.e.volets ?? 0 });
};

// ----- écouter -----
let audio = null;
let minuterie = null;
const boutonEcouter = document.getElementById('ecouter');
boutonEcouter.addEventListener('click', () => {
  if (!audio) {
    audio = new Audio();
    audio.demarrer(null, BASE);
    audio.fixerLieux(LIEUX);
  }
  if (minuterie) {
    clearInterval(minuterie);
    minuterie = null;
    audio.ctx.suspend();
    boutonEcouter.textContent = 'Écouter';
    return;
  }
  audio.ctx.resume();
  minuterie = setInterval(() => {
    audio.dansLaCabine(dedans, { porte: valeurs.porte, volets: valeurs.volets });
    audio.maj(1 / 30, entrees(valeurs));
  }, 1000 / 30);
  boutonEcouter.textContent = 'Arrêter';
});

const zoneEvenements = document.getElementById('evenements');
for (const [nom, f] of EVENEMENTS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = nom;
  b.addEventListener('click', () => {
    if (!audio || !minuterie) boutonEcouter.click();
    f(audio, (dans, quoi) => setTimeout(quoi, dans * 1000));
  });
  zoneEvenements.append(b);
}

// ----- le mélange en direct -----
const BUS_DEDANS = new Set(['cabine-mer', 'coque', 'pluie-toit', 'vent-dedans']);
const zoneMelange = document.getElementById('melange');
const jauges = new Map();
function majMelange() {
  if (audio) {
    for (const [nom, niveau] of Object.entries(audio.niveaux)) {
      let j = jauges.get(nom);
      if (!j) {
        j = document.createElement('div');
        j.className = 'jauge-son';
        j.setAttribute('role', 'listitem');
        j.dataset.bus = BUS_DEDANS.has(nom) ? 'dedans' : 'dehors';
        j.innerHTML = `<span class="nom">${nom}</span><span class="fond"><i></i></span><span class="valeur"></span>`;
        zoneMelange.append(j);
        jauges.set(nom, j);
      }
      j.querySelector('i').style.width = `${Math.min(1, niveau) * 100}%`;
      j.querySelector('.valeur').textContent = niveau.toFixed(2);
    }
  }
  requestAnimationFrame(majMelange);
}
requestAnimationFrame(majMelange);

// ----- mesurer -----
let sonothequeMesure = null;
// Calcule « duree » secondes d'une situation, sans la jouer (evenement(audio, plusTard) : ce
// qu'on fait à « quand » secondes ; ecoute : où est l'oreille ; muet : les bus qu'on n'écoute
// pas — pour mesurer un son seul, ou tout sauf lui) ; rend le son calculé, et l'audio
async function rendre(s, { duree = 9, quand = 3, evenement = null, ecoute = AU_POSTE, muet = [] } = {}) {
  const ctx = new OfflineAudioContext(2, 44100 * duree, 44100);
  const a = new Audio();
  a.demarrer(ctx, BASE, { sonotheque: sonothequeMesure });
  preparer(a, s, ecoute);
  for (const bus of muet) a.bus[bus].gain.value = 0;
  const e = entrees(s.e, ecoute);
  // (ce qui doit arriver, et à quel moment : [secondes, quoi])
  const aVenir = [];
  const plusTard = (dans, quoi) => aVenir.push([ctx.currentTime + dans, quoi]);
  if (evenement) aVenir.push([quand, () => evenement(a, plusTard)]);
  // (le jeu met le son à jour trente fois par seconde ; ici, dix suffisent)
  for (let t = 0.1; t < duree - 0.05; t += 0.1) {
    ctx.suspend(t).then(() => {
      a.maj(0.1, e);
      for (const x of aVenir.filter(([q]) => q <= ctx.currentTime + 0.01)) {
        aVenir.splice(aVenir.indexOf(x), 1);
        x[1]();
      }
      ctx.resume();
    });
  }
  a.maj(0.1, e);
  return { rendu: await ctx.startRendering(), audio: a };
}
async function mesurer(s) {
  const { rendu, audio: a } = await rendre(s);
  // les couches qui comptent le plus (estimées : chaque enregistrement est réglé à −20 LUFS)
  const couches = Object.entries(a.niveaux)
    .filter(([, n]) => n > 0.02)
    .map(([nom, n]) => [nom, 20 * Math.log10(n) - (s.dedans && !BUS_DEDANS.has(nom) ? 8 : 0)])
    .sort((x, y) => y[1] - x[1]).slice(0, 3).map(([nom]) => nom);
  return { volume: lufs(rendu, 3, 9), couches };
}
// (l'énergie de chaque oreille sur un moment : la gauche, la droite)
function oreilles(tampon, debut, fin) {
  const i0 = Math.floor(debut * tampon.sampleRate);
  const i1 = Math.floor(fin * tampon.sampleRate);
  return [0, 1].map((c) => {
    const x = tampon.getChannelData(c);
    let m = 0;
    for (let i = i0; i < i1; i++) m += x[i] * x[i];
    return 10 * Math.log10(m / (i1 - i0) + 1e-12);
  });
}
// Les signes : chacun rend un nombre (en dB) et ce qu'on attend de lui
const CINQ = SITUATIONS.find((x) => x.id === 'cinq');
const MOTEUR = SITUATIONS.find((x) => x.id === 'moteur');
const TOUS_LES_BUS = ['dehors', 'signes', 'fondDedans', 'fondBord', 'bord', 'radio', 'tete'];
// (une grosse déferlante de tribord à 3 s : de combien son grondement sort de tout le reste —
// on calcule l'un sans l'autre —, sur le moment que dit moment(choc, preavis))
async function grondementSurLeReste(s, moteur, moment) {
  const evenement = (a, plusTard) => vague(a, plusTard, { moteur });
  const seul = await rendre(s, { duree: 10, evenement, muet: TOUS_LES_BUS.filter((b) => b !== 'signes') });
  const reste = await rendre(s, { duree: 10, evenement, muet: ['signes'] });
  const d = preavis(1);
  const [de, a] = moment(3 + d, d);
  return Math.max(-60, lufs(seul.rendu, de, a) - lufs(reste.rendu, de, a));
}
// (la première seconde de son grondement, et son dernier tiers — ce qu'on en entend, le moteur en
// marche)
const PREMIERE_SECONDE = (choc, d) => [choc - d + 0.5, choc - d + 1.5];
const DERNIER_TIERS = (choc, d) => [choc - d * ENTENDRE.moteur + 0.3, choc - 0.3];
// (de quel côté on l'entend : l'oreille droite moins la gauche, pendant qu'elle gronde)
async function droiteMoinsGauche(ecoute) {
  const d = preavis(1);
  const { rendu } = await rendre(CINQ, { duree: 10, ecoute, evenement: (a, plusTard) => vague(a, plusTard) });
  const [g, dr] = oreilles(rendu, 3 + 0.5, 3 + d - 0.5);
  return dr - g;
}
// (les trois coups derrière la porte basse, comme dans le jeu, quart.js : le monde se tait,
// puis on frappe — calculés une fois pour les deux signes)
let rendusCoups = null;
const coups = () => (rendusCoups ??= rendre(CINQ, { duree: 10, evenement: troisCoups }));
// (le creux seul, sans rien dedans : à quoi comparer ce qu'on entend dans le silence)
let rendusCreux = {};
const creuxSeul = (duree, profondeur) => (rendusCreux[`${duree}:${profondeur}`] ??= rendre(CINQ, { duree: 12, evenement: (a) => a.etouffer(duree, profondeur) }));
const SIGNES = [
  {
    nom: 'Une grosse déferlante de tribord, moteur arrêté : dès qu\'elle gronde, le fond se retire — on n\'entend plus qu\'elle, assez tôt pour fermer les volets (il leur faut 2,5 s)',
    attendu: (d) => d >= 5, unite: 'au-dessus de tout le reste, dans sa première seconde',
    mesure: () => grondementSurLeReste(CINQ, false, PREMIERE_SECONDE),
  },
  {
    nom: 'La même, le moteur en marche : on ne l\'entend pas venir',
    attendu: (d) => d <= -40, unite: 'au-dessus du reste, quand elle commence à gronder',
    mesure: () => grondementSurLeReste(MOTEUR, true, PREMIERE_SECONDE),
  },
  {
    nom: '… seulement dans son dernier tiers, sous le moteur — trop tard pour les volets',
    attendu: (d) => d >= -6 && d <= 0, unite: 'par rapport au reste, dans son dernier tiers',
    mesure: () => grondementSurLeReste(MOTEUR, true, DERNIER_TIERS),
  },
  {
    nom: 'Elle vient de tribord : à droite, quand on regarde devant',
    attendu: (d) => d >= 6, unite: 'de plus à droite qu\'à gauche',
    mesure: () => droiteMoinsGauche(AU_POSTE),
  },
  {
    nom: '… et à gauche, la tête tournée vers l\'arrière',
    attendu: (d) => d <= -6, unite: 'de plus à droite qu\'à gauche',
    mesure: () => droiteMoinsGauche(TOURNE),
  },
  {
    nom: 'Avant les trois coups, le monde se tait',
    attendu: (d) => d <= -6, unite: 'pendant le creux, par rapport à avant',
    mesure: async () => {
      const { rendu } = await coups();
      return lufs(rendu, 4.1, 5.5) - lufs(rendu, 1.4, 2.9);
    },
  },
  {
    nom: '… puis les coups, dans ce silence',
    attendu: (d) => d >= 8, unite: 'au-dessus du creux',
    mesure: async () => {
      const { rendu } = await coups();
      return lufs(rendu, 5.55, 6.05) - lufs(rendu, 4.1, 5.5);
    },
  },
  {
    nom: 'Des pas sur le toit, dans le silence : on les entend marcher, au-dessus',
    attendu: (d) => d >= 6, unite: 'au-dessus du creux, pendant qu\'ils marchent',
    mesure: async () => {
      const { rendu } = await rendre(CINQ, { duree: 12, evenement: pasSurLeToit });
      const { rendu: creux } = await creuxSeul(7.8, 0.55);
      return lufs(rendu, 3.5, 6.8) - lufs(creux, 3.5, 6.8);
    },
  },
  {
    nom: 'La porte basse s\'entrouvre : son grincement sort du silence',
    attendu: (d) => d >= 6, unite: 'au-dessus du creux, pendant qu\'elle grince',
    mesure: async () => {
      const { rendu } = await rendre(CINQ, { duree: 12, evenement: porteQuiSOuvre });
      const { rendu: creux } = await creuxSeul(5, 0.65);
      return lufs(rendu, 4.3, 6.1) - lufs(creux, 4.3, 6.1);
    },
  },
];

const MIN = -40;
const MAX = -10;
const x = (v) => `${((Math.max(MIN, Math.min(MAX, v)) - MIN) / (MAX - MIN)) * 100}%`;
const chiffre = (v, n = 1) => `${v < 0 ? '−' : ''}${virgule(Math.abs(v), n)}`; // (à la française : −28,6)
document.getElementById('mesurer').addEventListener('click', async (ev) => {
  const bouton = ev.currentTarget;
  bouton.disabled = true;
  const etat = document.getElementById('etat-mesure');
  const zone = document.getElementById('mesures');
  try {
    if (!sonothequeMesure) {
      etat.textContent = 'Chargement des enregistrements…';
      sonothequeMesure = new Sonotheque(new OfflineAudioContext(2, 44100, 44100), BASE);
      await sonothequeMesure.charger();
    }
    zone.hidden = false;
    rendusCoups = null;
    rendusCreux = {};
    zone.innerHTML = `<div class="echelle"><span></span><div class="graduations">${[-40, -30, -23, -14].map((v) => `<span style="left:${x(v)}">${chiffre(v, 0)}</span>`).join('')}</div></div>`;
    for (const [k, s] of SITUATIONS.entries()) {
      etat.textContent = `Mesure ${k + 1} / ${SITUATIONS.length + SIGNES.length} : ${s.nom}…`;
      const r = await mesurer(s);
      const dans = r.volume >= s.cible[0] && r.volume <= s.cible[1];
      const ligne = document.createElement('div');
      ligne.className = 'mesure';
      ligne.dataset.id = s.id;
      ligne.dataset.lufs = r.volume.toFixed(1);
      ligne.innerHTML = `<span class="nom">${s.nom}</span>
        <div class="piste" role="img" aria-label="${s.nom} : ${chiffre(r.volume)} LUFS, cible ${chiffre(s.cible[0], 0)} à ${chiffre(s.cible[1], 0)}">
          <span class="cible" style="left:${x(s.cible[0])}; width:calc(${x(s.cible[1])} - ${x(s.cible[0])})"></span>
          <span class="barre" style="width:${x(r.volume)}"></span>
          <span class="chiffre" style="left:min(calc(${x(r.volume)} + 6px), calc(100% - 150px))">${chiffre(r.volume)} LUFS ${dans ? '✓' : r.volume > s.cible[1] ? '· trop fort' : '· trop faible'}</span>
        </div>
        <span class="detail">surtout : ${r.couches.join(', ') || '—'}</span>`;
      zone.append(ligne);
    }
    const titre = document.createElement('h3');
    titre.textContent = 'Les signes';
    zone.append(titre);
    for (const [k, signe] of SIGNES.entries()) {
      etat.textContent = `Mesure ${SITUATIONS.length + k + 1} / ${SITUATIONS.length + SIGNES.length} : ${signe.nom}…`;
      const d = await signe.mesure();
      const ok = signe.attendu(d);
      const ligne = document.createElement('p');
      ligne.className = 'signe';
      ligne.dataset.ok = String(ok);
      ligne.dataset.db = d.toFixed(1);
      ligne.textContent = `${ok ? '✓' : '✗'} ${signe.nom} — ${d <= -40 ? 'on n\'entend rien' : `${d >= 0 ? '+' : '−'}${virgule(Math.abs(d))} dB ${signe.unite}`}`;
      zone.append(ligne);
    }
    etat.textContent = 'Mesuré. (Chaque mesure varie un peu : les craquements tombent au hasard.)';
  } catch (e) {
    etat.textContent = `La mesure a échoué : ${e.message}`;
  } finally {
    bouton.disabled = false;
  }
});

// ----- la sonothèque -----
(async () => {
  const s = new Sonotheque(null, BASE);
  const fiche = await s.lireFiche();
  const liste = document.getElementById('sonotheque');
  let lecteur = null;
  for (const [nom, son] of Object.entries(fiche.sons)) {
    const li = document.createElement('li');
    const origines = son.credits.map((c) => `« ${c.titre} », ${c.auteur} (<a href="${c.page}" target="_blank" rel="noopener">${c.site}</a>, CC0)`).join(' ; ');
    li.innerHTML = `<button type="button" aria-label="Écouter ${nom}">▶</button>
      <span class="titre">${nom}<small>${son.sorte === 'boucle' ? 'boucle' : `${son.morceaux.length} sons brefs`} · ${son.duree.toFixed(0)} s</small></span>
      <span class="origine">${son.role}. ${origines}</span>`;
    li.querySelector('button').addEventListener('click', (ev) => {
      const b = ev.currentTarget;
      if (lecteur && !lecteur.paused && lecteur.dataset.nom === nom) {
        lecteur.pause();
        b.textContent = '▶';
        return;
      }
      if (lecteur) lecteur.pause();
      for (const autre of liste.querySelectorAll('button')) autre.textContent = '▶';
      lecteur = new window.Audio(`${BASE}${son.fichier}`);
      lecteur.dataset.nom = nom;
      lecteur.play();
      lecteur.onended = () => { b.textContent = '▶'; };
      b.textContent = '■';
    });
    liste.append(li);
  }
})();
