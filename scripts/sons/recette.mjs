// La recette des sons du jeu : d'où vient chaque enregistrement, et quel morceau on en
// garde. `npm run sons` télécharge les enregistrements d'origine (dans sons-bruts/, que le
// dépôt ne garde pas) et fabrique les fichiers du jeu dans public/sons/.
//
// Tous les enregistrements sont dans le domaine public (licence CC0 1.0) : on peut les
// copier, les couper, les publier, sans rien demander ni payer. On cite quand même leurs
// auteurs (public/sons/sons.json, la page « À propos », le README).
//
// Deux sortes de sons :
//  - les boucles (« boucle ») : une ambiance qui tourne sans fin (le vent, la pluie, la
//    mer…). On garde un morceau de `duree` secondes à partir de `debut`, et ses dernières
//    secondes (`fondu`) se fondent dans les premières : la boucle ne s'entend pas ;
//  - les coups (« coups ») : des sons brefs (un grincement, une vague qui frappe, un coup
//    de tonnerre), rangés bout à bout dans un seul fichier (une « planche ») ; le jeu en
//    tire un au hasard.
// lufs : le volume visé (la mesure de volume ressenti des radios et du cinéma) ; le jeu
// règle ensuite chaque son en direct.

export const SOURCES = {
  'fs-616222': { titre: 'storm_sea_close.WAV', auteur: 'frodeims', site: 'Freesound', page: 'https://freesound.org/people/frodeims/sounds/616222/', fichier: 'https://cdn.freesound.org/previews/616/616222_3755886-hq.mp3' },
  'fs-529017': { titre: 'Blowing storm.wav', auteur: 'SiriusParsec', site: 'Freesound', page: 'https://freesound.org/people/SiriusParsec/sounds/529017/', fichier: 'https://cdn.freesound.org/previews/529/529017_11066904-hq.mp3' },
  'fs-371172': { titre: 'Sailboat, cockpit at 12kn wind speed', auteur: 'borralbi', site: 'Freesound', page: 'https://freesound.org/people/borralbi/sounds/371172/', fichier: 'https://cdn.freesound.org/previews/371/371172_2774517-hq.mp3' },
  'fs-166753': { titre: 'Havlyd fra køje', auteur: 'Supertyv2', site: 'Freesound', page: 'https://freesound.org/people/Supertyv2/sounds/166753/', fichier: 'https://cdn.freesound.org/previews/166/166753_2570729-hq.mp3' },
  'fs-760338': { titre: 'sailboat contact mics', auteur: 'bruno.auzet', site: 'Freesound', page: 'https://freesound.org/people/bruno.auzet/sounds/760338/', fichier: 'https://cdn.freesound.org/previews/760/760338_11519060-hq.mp3' },
  'fs-849790': { titre: 'Rainfall on roof of sailboat at the dock', auteur: 'douglasbruce@look.ca', site: 'Freesound', page: 'https://freesound.org/people/douglasbruce%40look.ca/sounds/849790/', fichier: 'https://cdn.freesound.org/previews/849/849790_7581660-hq.mp3' },
  'fs-117611': { titre: 'wind_howl2_stereo.wav', auteur: 'swiftoid', site: 'Freesound', page: 'https://freesound.org/people/swiftoid/sounds/117611/', fichier: 'https://cdn.freesound.org/previews/117/117611_854782-hq.mp3' },
  'fs-426076': { titre: 'Storm waves breaking on sandy beach in Bournemouth', auteur: 'chris_dagorne', site: 'Freesound', page: 'https://freesound.org/people/chris_dagorne/sounds/426076/', fichier: 'https://cdn.freesound.org/previews/426/426076_3380363-hq.mp3' },
  'fs-460061': { titre: 'sailboat underway.wav', auteur: 'canoeCG', site: 'Freesound', page: 'https://freesound.org/people/canoeCG/sounds/460061/', fichier: 'https://cdn.freesound.org/previews/460/460061_9319459-hq.mp3' },
  'fs-630431': { titre: 'Sail boat_Autopilot (contact mic).wav', auteur: 'KaleidacousticsAudio', site: 'Freesound', page: 'https://freesound.org/people/KaleidacousticsAudio/sounds/630431/', fichier: 'https://cdn.freesound.org/previews/630/630431_13875907-hq.mp3' },
  'fs-630432': { titre: 'Sail boat_Boom squeaking (contact mic).wav', auteur: 'KaleidacousticsAudio', site: 'Freesound', page: 'https://freesound.org/people/KaleidacousticsAudio/sounds/630432/', fichier: 'https://cdn.freesound.org/previews/630/630432_13875907-hq.mp3' },
  'fs-384359': { titre: 'Waves Crashing Against Wall/Breakwater.wav', auteur: 'Ali_6868', site: 'Freesound', page: 'https://freesound.org/people/Ali_6868/sounds/384359/', fichier: 'https://cdn.freesound.org/previews/384/384359_984733-hq.mp3' },
  'fs-509322': { titre: 'Kayaking in rough weather', auteur: 'AugustSandberg', site: 'Freesound', page: 'https://freesound.org/people/AugustSandberg/sounds/509322/', fichier: 'https://cdn.freesound.org/previews/509/509322_1934171-hq.mp3' },
  'bsb-0595': { titre: 'Wind', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/wind-s0595.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/0595.mp3' },
  'bsb-2443': { titre: 'Masts Whistling #1', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/masts-whistling-1-s2443.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/2443.mp3' },
  'bsb-2444': { titre: 'Masts Whistling #2', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/masts-whistling-2-s2444.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/2444.mp3' },
  'bsb-1292': { titre: 'Rain on plastic tarpaulin', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/rain-on-plastic-tarpaulin-s1292.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/1292.mp3' },
  'bsb-1715': { titre: 'Wind from inside #2', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/wind-from-inside-2-s1715.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/1715.mp3' },
  'bsb-1632': { titre: 'Flag in the Wind #1', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/flag-in-the-wind-1-s1632.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/1632.mp3' },
  'bsb-1094': { titre: 'Swing, Lightly Loaded', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/swing-lightly-loaded-s1094.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/1094.mp3' },
  'bsb-0518': { titre: 'Floating Floor Squeaks', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/floating-floor-squeaks-s0518.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/0518.mp3' },
  'bsb-3426': { titre: 'Big Rope', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/big-rope-s3426.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/3426.mp3' },
  'bsb-2570': { titre: 'Cliff #1', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/cliff-1-s2570.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/2570.mp3' },
  'bsb-2718': { titre: 'Thunder #1', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/thunder-s2718.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/2718.mp3' },
  'bsb-3113': { titre: 'Thunder #2', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/thunder-2-s3113.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/3113.mp3' },
  'bsb-3115': { titre: 'Thunder #4', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/thunder-4-s3115.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/3115.mp3' },
  'bsb-3181': { titre: 'Thunder #8', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/thunder-8-s3181.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/3181.mp3' },
  'bsb-3182': { titre: 'Thunder #9', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/thunder-9-s3182.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/3182.mp3' },
  'bsb-3184': { titre: 'Thunder #11', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/thunder-11-s3184.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/3184.mp3' },
  'bsb-0261': { titre: 'Ocean Liner Horn #1', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/horn-of-a-ship-1-s0261.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/0261.mp3' },
  'bsb-3507': { titre: 'Ocean Liner Horn #3', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/ocean-liner-horn-3-s3507.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/3507.mp3' },
  'bsb-0312': { titre: 'Crackling Radio #1', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/crackling-radio-1-s0312.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/0312.mp3' },
  'bsb-0313': { titre: 'Crackling Radio #2', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/crackling-radio-2-s0313.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/0313.mp3' },
  'bsb-0311': { titre: 'Radio Interference #2', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/radio-interference-2-s0311.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/0311.mp3' },
  'bsb-0310': { titre: 'Radio Interference #1', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/radio-interference-1-s0310.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/0310.mp3' },
  // (l'étape 6 de la nuit seule : la porte basse, les trois coups, les pas)
  'bsb-3205': { titre: 'Creaking Door #2', auteur: 'Joseph Sardin et Axeline T.', site: 'BigSoundBank', page: 'https://bigsoundbank.com/creaking-door-2-s3205.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/3205.mp3' },
  'bsb-0015': { titre: 'Door', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/door-s0015.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/0015.mp3' },
  'bsb-1515': { titre: 'Steps on a Wooden Floor #1', auteur: 'Joseph Sardin', site: 'BigSoundBank', page: 'https://bigsoundbank.com/steps-on-a-wooden-floor-1-s1515.html', fichier: 'https://bigsoundbank.com/UPLOAD/mp3/1515.mp3' },
};

// Les sons du jeu (nom du fichier : public/sons/<nom>.mp3)
export const SONS = [
  // ----- les boucles : dehors -----
  { nom: 'vent-doux', role: 'le vent, de la brise au vent frais', sorte: 'boucle', source: 'bsb-0595', debut: 10, duree: 30, fondu: 3, canaux: 1, lufs: -20 },
  { nom: 'vent-fort', role: 'le vent de tempête, régulier', sorte: 'boucle', source: 'fs-616222', debut: 90, duree: 24, fondu: 3, canaux: 2, lufs: -20 },
  { nom: 'vent-rafales', role: 'le vent de tempête, par rafales', sorte: 'boucle', source: 'fs-529017', debut: 0.5, duree: 54, fondu: 4, canaux: 2, lufs: -20 },
  { nom: 'greement', role: 'le vent qui siffle dans le gréement', sorte: 'boucle', source: 'bsb-2443', debut: 18, duree: 30, fondu: 3, canaux: 1, lufs: -20 },
  { nom: 'greement-aigu', role: 'le gréement qui hurle, au plus fort', sorte: 'boucle', source: 'bsb-2444', debut: 40, duree: 32, fondu: 3, canaux: 1, lufs: -20 },
  { nom: 'mer-forte', role: 'la mer qui déferle tout autour', sorte: 'boucle', source: 'fs-426076', debut: 12, duree: 30, fondu: 3, canaux: 2, lufs: -20 },
  { nom: 'cockpit-jour', role: 'le cockpit par beau temps : l\'eau, les écoutes, la brise', sorte: 'boucle', source: 'fs-371172', debut: 28, duree: 40, fondu: 3, canaux: 2, lufs: -20 },
  { nom: 'sous-voiles', role: 'les voiles pleines, les bouts qui tirent', sorte: 'boucle', source: 'fs-460061', debut: 52, duree: 36, fondu: 3, canaux: 2, lufs: -20 },
  { nom: 'pluie-pont', role: 'la pluie sur le pont et sur les cirés', sorte: 'boucle', source: 'bsb-1292', debut: 1, duree: 20, fondu: 2, canaux: 1, lufs: -20 },
  { nom: 'voile-bat', role: 'une voile qui faseye (qui bat comme un drapeau)', sorte: 'boucle', source: 'bsb-1632', debut: 40, duree: 34, fondu: 2, canaux: 1, lufs: -20 },
  { nom: 'pilote', role: 'le moteur du pilote automatique', sorte: 'boucle', source: 'fs-630431', debut: 20, duree: 20, fondu: 2, canaux: 1, lufs: -22 },
  // ----- les boucles : dedans (la cabine) -----
  { nom: 'cabine-mer', role: 'la mer entendue de la couchette, à travers la coque', sorte: 'boucle', source: 'fs-166753', debut: 78, duree: 40, fondu: 3, canaux: 2, lufs: -20 },
  { nom: 'coque', role: 'l\'eau contre la coque (micros collés à la coque)', sorte: 'boucle', source: 'fs-760338', debut: 20, duree: 30, fondu: 3, canaux: 2, lufs: -20 },
  { nom: 'pluie-toit', role: 'la pluie sur le toit de la cabine', sorte: 'boucle', source: 'fs-849790', debut: 1, duree: 28, fondu: 2, canaux: 2, lufs: -20 },
  { nom: 'vent-dedans', role: 'la tempête entendue de l\'intérieur', sorte: 'boucle', source: 'bsb-1715', debut: 84, duree: 40, fondu: 3, canaux: 2, lufs: -20 },
  { nom: 'hurlement', role: 'le vent qui hurle dans les ouvertures', sorte: 'boucle', source: 'fs-117611', debut: 4, duree: 27, fondu: 3, canaux: 2, lufs: -20 },
  // ----- les coups (planches de sons brefs) -----
  {
    nom: 'craquements', role: 'le bois et les cordages qui travaillent', sorte: 'coups', canaux: 1, lufs: -20,
    morceaux: [
      ['bsb-1094', 2.7, 1.2], ['bsb-1094', 5.4, 1.3], ['bsb-1094', 9.4, 1.4], ['bsb-1094', 13.7, 1.2],
      ['bsb-1094', 17.7, 1.4], ['bsb-1094', 30.0, 1.3], ['bsb-1094', 38.2, 1.2], ['bsb-1094', 43.7, 1.4],
      ['bsb-0518', 4.7, 0.7], ['bsb-0518', 6.4, 0.9], ['bsb-0518', 8.2, 1.0], ['bsb-0518', 15.2, 0.7],
      ['bsb-3426', 1.8, 2.0], ['bsb-3426', 7.3, 2.2], ['bsb-3426', 32.6, 2.0], ['bsb-3426', 40.0, 2.4],
    ],
  },
  {
    nom: 'vagues', role: 'les vagues qui frappent la coque et s\'écrasent sur le pont', sorte: 'coups', canaux: 1, lufs: -16,
    morceaux: [
      ['fs-384359', 33.6, 4.5], ['fs-384359', 53.6, 4.4], ['fs-384359', 59.6, 4.4], ['fs-384359', 67.6, 4.5],
      ['fs-384359', 82.6, 4.4], ['bsb-2570', 104, 8], ['bsb-2570', 192, 9], ['bsb-2570', 205, 8],
      ['bsb-2570', 291, 8], ['fs-509322', 16.6, 2.4], ['fs-509322', 90.6, 2.6],
    ],
  },
  {
    nom: 'tonnerres', role: 'les coups de tonnerre, proches et lointains', sorte: 'coups', canaux: 1, lufs: -16,
    morceaux: [['bsb-3113', 0, 5], ['bsb-3115', 0, 17], ['bsb-2718', 0, 22], ['bsb-3182', 0, 22], ['bsb-3184', 0, 25], ['bsb-3181', 0, 26]],
  },
  {
    nom: 'cornes', role: 'la corne du cargo', sorte: 'coups', canaux: 1, lufs: -16,
    morceaux: [['bsb-3507', 0, 4.5], ['bsb-0261', 0, 8.5]],
  },
  {
    nom: 'radio', role: 'la radio qui grésille', sorte: 'coups', canaux: 1, lufs: -22,
    morceaux: [['bsb-0312', 0, 4.4], ['bsb-0313', 0, 3.8], ['bsb-0311', 0, 5.8], ['bsb-0310', 0, 8]],
  },
  // (les morceaux de ces trois-là ont été trouvés à la mesure du volume, tranche par tranche :
  // chaque coup, chaque pas commence 3 centièmes avant que le son monte d'un coup — l'impact)
  {
    nom: 'porte-grince', role: 'la porte basse de la cabine avant qui s\'ouvre toute seule, en deux fois', sorte: 'coups', canaux: 1, lufs: -20,
    morceaux: [['bsb-3205', 0.17, 1.62], ['bsb-3205', 1.79, 1.4]],
  },
  {
    nom: 'coups-porte', role: 'les trois coups, derrière la porte basse (un coup par morceau)', sorte: 'coups', canaux: 1, lufs: -18,
    morceaux: [['bsb-0015', 0.15, 0.55], ['bsb-0015', 0.89, 0.55], ['bsb-0015', 1.52, 0.55], ['bsb-0015', 2.17, 0.55], ['bsb-0015', 2.85, 0.5]],
  },
  {
    nom: 'pas', role: 'quelqu\'un qui marche, au-dessus (un pas par morceau)', sorte: 'coups', canaux: 1, lufs: -20,
    morceaux: [
      ['bsb-1515', 2.01, 0.6], ['bsb-1515', 2.94, 0.6], ['bsb-1515', 4.85, 0.6], ['bsb-1515', 8.6, 0.6], ['bsb-1515', 14.11, 0.6],
      ['bsb-1515', 20.54, 0.6], ['bsb-1515', 21.45, 0.6], ['bsb-1515', 30.44, 0.6], ['bsb-1515', 33.19, 0.6], ['bsb-1515', 34.11, 0.6],
    ],
  },
];
