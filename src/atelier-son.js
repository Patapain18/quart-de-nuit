// L'atelier du son : écouter chaque situation du jeu, régler à la main ce que le jeu donne
// au son, voir le mélange en direct, mesurer le volume ressenti de chaque situation, et
// parcourir la sonothèque (d'où vient chaque enregistrement).
import { Audio } from './son/audio.js';
import { Sonotheque } from './son/sonotheque.js';
import { lufs } from './son/mesure.js';

const BASE = `${import.meta.env.BASE_URL}sons/`;
const pct = (v) => `${Math.round(v * 100)} %`;

// ce que le jeu donne au son (voir Audio.maj)
const CURSEURS = [
  ['vent', 'Vent apparent', 0, 50, 1, (v) => `${v} nœuds`],
  ['pluie', 'La pluie', 0, 1, 0.05, pct],
  ['houle', 'Les vagues (hauteur)', 0, 6, 0.1, (v) => `${v.toFixed(1)} m`],
  ['vitesse', 'La vitesse du bateau', 0, 9, 0.5, (v) => `${v} nœuds`],
  ['faseyement', 'Les voiles faseyent', 0, 1, 0.05, pct],
  ['mouvement', 'Le bateau est secoué', 0, 1, 0.05, pct],
  ['nuit', 'La nuit', 0, 1, 0.1, pct],
  ['voiles', 'La toile hissée', 0, 1, 0.1, pct],
];

// les situations du jeu ; cible : le volume ressenti visé (LUFS, de … à …)
const SITUATIONS = [
  { id: 'matin', nom: 'Matin calme', e: { vent: 8, pluie: 0, houle: 1.1, vitesse: 4, faseyement: 0, mouvement: 0.05, nuit: 0, voiles: 1 }, cible: [-32, -26] },
  { id: 'midi', nom: 'Midi, bonne brise', e: { vent: 15, pluie: 0, houle: 1.3, vitesse: 6, faseyement: 0, mouvement: 0.1, nuit: 0, voiles: 1 }, cible: [-29, -23] },
  { id: 'frais', nom: 'Fin d\'après-midi, vent frais', e: { vent: 21, pluie: 0, houle: 1.8, vitesse: 6.5, faseyement: 0, mouvement: 0.2, nuit: 0, voiles: 0.9 }, cible: [-27, -21] },
  { id: 'faseye', nom: 'Face au vent : les voiles battent', e: { vent: 16, pluie: 0, houle: 1.3, vitesse: 1, faseyement: 1, mouvement: 0.1, nuit: 0, voiles: 1 }, cible: [-27, -21] },
  { id: 'coucher', nom: 'Coucher menaçant', e: { vent: 27, pluie: 0.25, houle: 2.6, vitesse: 6, faseyement: 0, mouvement: 0.3, nuit: 0.4, voiles: 0.7 }, cible: [-25, -19] },
  { id: 'tempete', nom: 'Nuit de tempête, sur le pont', e: { vent: 38, pluie: 0.8, houle: 4.5, vitesse: 7, faseyement: 0, mouvement: 0.55, nuit: 1, voiles: 0.4 }, cible: [-20, -15] },
  { id: 'tempete-cabine', nom: 'Nuit de tempête, dans la cabine', dedans: true, e: { vent: 38, pluie: 0.8, houle: 4.5, vitesse: 7, faseyement: 0, mouvement: 0.55, nuit: 1, voiles: 0.4 }, cible: [-26, -20] },
  { id: 'fort', nom: 'Au plus fort (46 nœuds), sur le pont', e: { vent: 46, pluie: 1, houle: 5.5, vitesse: 8, faseyement: 0, mouvement: 0.8, nuit: 1, voiles: 0.2 }, cible: [-18, -13] },
  { id: 'fort-cabine', nom: 'Au plus fort, dans la cabine', dedans: true, e: { vent: 46, pluie: 1, houle: 5.5, vitesse: 8, faseyement: 0, mouvement: 0.8, nuit: 1, voiles: 0.2 }, cible: [-24, -18] },
];

const EVENEMENTS = [
  ['Le bois craque', (a) => a.craquement(0.8)],
  ['L\'étrave tape (petite)', (a) => a.claque(0.3)],
  ['L\'étrave tape (grosse)', (a) => a.claque(0.9)],
  ['Une déferlante (dans 3 s)', (a) => a.deferlante(0.9, 3)],
  ['Tonnerre tout près', (a) => a.tonnerre(500, 1)],
  ['Tonnerre au loin', (a) => a.tonnerre(7000, 1)],
  ['La corne du cargo', (a) => a.corne(5)],
  ['La radio grésille', (a) => a.gresillement()],
  ['Des parasites sur la radio', (a) => a.parasites(2.5)],
];

// L'état des réglages (la situation choisie, modifiable aux curseurs)
let situation = SITUATIONS[0];
const valeurs = { ...situation.e };
let dedans = false;

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
caseDedans.innerHTML = '<input type="checkbox" id="c-dedans"> Dans la cabine';
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

// ----- écouter -----
let audio = null;
let minuterie = null;
const boutonEcouter = document.getElementById('ecouter');
const entrees = () => ({
  ventApparent: valeurs.vent, vitesse: valeurs.vitesse, faseyement: valeurs.faseyement, pluie: valeurs.pluie,
  bordage: 0, houle: valeurs.houle, eauCale: 0, eauCockpit: 0, roulis: valeurs.mouvement * 0.3,
  mouvement: valeurs.mouvement, nuit: valeurs.nuit, voiles: valeurs.voiles, pilote: 0, trombe: 0, cargo: 0,
});
boutonEcouter.addEventListener('click', () => {
  if (!audio) {
    audio = new Audio();
    audio.demarrer(null, BASE);
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
    audio.dansLaCabine(dedans);
    audio.maj(1 / 30, entrees());
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
    f(audio);
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
const DUREE = 9;
let sonothequeMesure = null;
async function mesurer(s) {
  const ctx = new OfflineAudioContext(2, 44100 * DUREE, 44100);
  const a = new Audio();
  a.demarrer(ctx, BASE, { sonotheque: sonothequeMesure });
  a.dansLaCabine(!!s.dedans);
  const e = {
    ventApparent: s.e.vent, vitesse: s.e.vitesse, faseyement: s.e.faseyement, pluie: s.e.pluie, bordage: 0,
    houle: s.e.houle, roulis: s.e.mouvement * 0.3, mouvement: s.e.mouvement, nuit: s.e.nuit, voiles: s.e.voiles,
  };
  // (le jeu met le son à jour trente fois par seconde ; ici, dix suffisent)
  for (let t = 0.1; t < DUREE - 0.05; t += 0.1) {
    ctx.suspend(t).then(() => { a.maj(0.1, e); ctx.resume(); });
  }
  a.maj(0.1, e);
  const rendu = await ctx.startRendering();
  // les couches qui comptent le plus (estimées : chaque enregistrement est réglé à −20 LUFS)
  const couches = Object.entries(a.niveaux)
    .filter(([, n]) => n > 0.02)
    .map(([nom, n]) => [nom, 20 * Math.log10(n) - (s.dedans && !BUS_DEDANS.has(nom) ? 9 : 0)])
    .sort((x, y) => y[1] - x[1]).slice(0, 3).map(([nom]) => nom);
  return { volume: lufs(rendu, 3, DUREE), couches };
}

const MIN = -40;
const MAX = -10;
const x = (v) => `${((Math.max(MIN, Math.min(MAX, v)) - MIN) / (MAX - MIN)) * 100}%`;
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
    zone.innerHTML = `<div class="echelle"><span></span><div class="graduations">${[-40, -30, -23, -14].map((v) => `<span style="left:${x(v)}">${v}</span>`).join('')}</div></div>`;
    for (const [k, s] of SITUATIONS.entries()) {
      etat.textContent = `Mesure ${k + 1} / ${SITUATIONS.length} : ${s.nom}…`;
      const r = await mesurer(s);
      const dans = r.volume >= s.cible[0] && r.volume <= s.cible[1];
      const ligne = document.createElement('div');
      ligne.className = 'mesure';
      ligne.innerHTML = `<span class="nom">${s.nom}</span>
        <div class="piste" role="img" aria-label="${s.nom} : ${r.volume.toFixed(1)} LUFS, cible ${s.cible[0]} à ${s.cible[1]}">
          <span class="cible" style="left:${x(s.cible[0])}; width:calc(${x(s.cible[1])} - ${x(s.cible[0])})"></span>
          <span class="barre" style="width:${x(r.volume)}"></span>
          <span class="chiffre" style="left:min(calc(${x(r.volume)} + 6px), calc(100% - 150px))">${r.volume.toFixed(1)} LUFS ${dans ? '✓' : r.volume > s.cible[1] ? '· trop fort' : '· trop faible'}</span>
        </div>
        <span class="detail">surtout : ${r.couches.join(', ') || '—'}</span>`;
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
