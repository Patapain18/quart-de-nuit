// Atelier de la tempête : la nuit rejouée en accéléré par les marins automatiques
// (src/jeu/marins.js, calculée dans un fil à part : src/atelier/nuit-worker.js), pour
// comparer les tactiques et régler la difficulté ; et tes propres nuits, que le jeu
// enregistre sur cet ordinateur (localStorage).
import { DIFFICULTES, HEURE_AUBE } from './jeu/nuit.js';
import { MARINS } from './jeu/marins.js';
import { heureEnTexte, HEURE_COUCHER } from './jeu/journee.js';

const CLE_NUITS = 'quart-de-nuit:nuits';
const NS = 'http://www.w3.org/2000/svg';
const racine = document.querySelector('.viz-root');
const style = getComputedStyle(racine);
const couleur = (nom) => style.getPropertyValue(nom).trim();
const COULEURS = { prudent: '--marin-1', moyen: '--marin-2', imprudent: '--marin-3', toi: '--toi' };

const etat = {
  difficulte: 'marin',
  niveau: { ...DIFFICULTES.marin },
  marins: new Set(Object.keys(MARINS)),
  resultats: null, // ce que les marins ont fait
  toi: null, // une de tes nuits (enregistrée par le jeu)
  journal: null, // le marin dont on lit le journal
};

// ---------- Les réglages ----------
const TEXTES_DIFFICULTE = {
  matelot: 'moins de déferlantes',
  marin: 'la vraie nuit',
  caphornier: 'plus de tout',
  mesure: 'règle toi-même',
};
function remplirDifficultes() {
  const zone = document.getElementById('choix-difficulte');
  zone.innerHTML = '';
  for (const id of [...Object.keys(DIFFICULTES), 'mesure']) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `${id === 'mesure' ? 'Sur mesure' : DIFFICULTES[id].nom}<small>${TEXTES_DIFFICULTE[id]}</small>`;
    b.setAttribute('aria-pressed', String(id === etat.difficulte));
    b.addEventListener('click', () => {
      etat.difficulte = id;
      if (id !== 'mesure') etat.niveau = { ...DIFFICULTES[id] };
      remplirDifficultes();
      majCurseurs();
    });
    zone.append(b);
  }
  document.getElementById('sur-mesure').hidden = etat.difficulte !== 'mesure';
}

const CURSEURS = [
  ['deferlantes', (v) => `× ${v.toFixed(1)}`],
  ['force', (v) => `× ${v.toFixed(2)}`],
  ['fuite', (v) => `× ${v.toFixed(1)}`],
  ['avaries', (v) => `× ${v.toFixed(1)}`],
  ['vent', (v) => `${v > 0 ? '+' : ''}${v} nœuds`],
];
function majCurseurs() {
  for (const [cle, texte] of CURSEURS) {
    document.getElementById(`r-${cle}`).value = etat.niveau[cle];
    document.getElementById(`v-${cle}`).textContent = texte(etat.niveau[cle]);
  }
  majCode();
}
for (const [cle, texte] of CURSEURS) {
  document.getElementById(`r-${cle}`).addEventListener('input', (e) => {
    etat.niveau[cle] = Number(e.target.value);
    document.getElementById(`v-${cle}`).textContent = texte(etat.niveau[cle]);
    majCode();
  });
}
function majCode() {
  const n = etat.niveau;
  const nom = etat.difficulte === 'mesure' ? 'surMesure' : etat.difficulte;
  document.getElementById('code').textContent = `${nom}: { nom: '${n.nom ?? 'Sur mesure'}', deferlantes: ${n.deferlantes}, force: ${n.force}, fuite: ${n.fuite}, avaries: ${n.avaries}, vent: ${n.vent} },`;
}

function remplirMarins() {
  const zone = document.getElementById('choix-marins');
  zone.innerHTML = '';
  for (const [cle, m] of Object.entries(MARINS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span class="pastille" style="background:${couleur(COULEURS[cle])}"></span>${m.nom}`;
    b.setAttribute('aria-pressed', String(etat.marins.has(cle)));
    b.addEventListener('click', () => {
      if (etat.marins.has(cle) && etat.marins.size > 1) etat.marins.delete(cle);
      else etat.marins.add(cle);
      remplirMarins();
    });
    zone.append(b);
  }
}

document.getElementById('autre-nuit').addEventListener('click', () => {
  document.getElementById('graine').value = 1 + Math.floor(Math.random() * 9998);
});

// ---------- Rejouer la nuit (dans un fil à part) ----------
let fil = null;
function rejouer() {
  fil?.terminate();
  fil = new Worker(new URL('./atelier/nuit-worker.js', import.meta.url), { type: 'module' });
  const bouton = document.getElementById('rejouer');
  const avancement = document.getElementById('avancement');
  const barre = avancement.querySelector('i');
  const texte = document.getElementById('texte-avancement');
  bouton.disabled = true;
  avancement.hidden = false;
  barre.style.width = '0%';
  texte.textContent = 'La nuit commence…';
  const debut = performance.now();
  fil.onmessage = ({ data }) => {
    if (data.type === 'progres') {
      const p = (data.heure - HEURE_COUCHER) / (HEURE_AUBE - HEURE_COUCHER);
      barre.style.width = `${(p * 100).toFixed(1)}%`;
      const ecoule = (performance.now() - debut) / 1000;
      const reste = p > 0.03 ? Math.round((ecoule / p) * (1 - p)) : null;
      texte.textContent = `${heureEnTexte(data.heure)} à bord${reste !== null ? ` · encore ~${reste} s de calcul` : ''}`;
      return;
    }
    etat.resultats = data.resultats;
    etat.journal = data.resultats[0]?.cle ?? null;
    barre.style.width = '100%';
    texte.textContent = `Nuit rejouée en ${Math.round(data.duree)} s de calcul.`;
    bouton.disabled = false;
    fil.terminate();
    fil = null;
    afficher();
  };
  fil.onerror = (e) => {
    texte.textContent = `Le calcul a échoué : ${e.message}`;
    bouton.disabled = false;
  };
  fil.postMessage({
    difficulte: etat.difficulte === 'mesure' ? 'marin' : etat.difficulte,
    niveau: etat.difficulte === 'mesure' ? etat.niveau : null,
    graine: Number(document.getElementById('graine').value) || 3,
    marins: Object.keys(MARINS).filter((c) => etat.marins.has(c)),
    fine: document.getElementById('fine').checked,
    pas: 1 / 30,
  });
}
document.getElementById('rejouer').addEventListener('click', rejouer);

// ---------- Les courbes ----------
// Toutes les courbes ont le même axe du temps : la nuit, du coucher du soleil à l'aube.
// Elles sont dessinées à la largeur réelle de la page (les textes gardent leur taille).
const M = { g: 46, d: 70, h: 14, b: 28 };
const el = (parent, nom, attributs = {}) => {
  const e = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attributs)) e.setAttribute(k, v);
  parent.append(e);
  return e;
};
// la moyenne glissante (pour lire une tendance dans une courbe qui danse)
const lisser = (v, n) => v.map((_, i) => {
  let s = 0;
  let k = 0;
  for (let j = Math.max(0, i - n); j <= Math.min(v.length - 1, i + n); j++) { s += v[j]; k++; }
  return s / k;
});
// la valeur d'une série à une heure donnée (le point le plus proche)
function valeurA(serie, heure) {
  const h = serie.heure;
  if (!h.length || heure < h[0] - 0.05 || heure > h[h.length - 1] + 0.05) return null;
  let lo = 0;
  let hi = h.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (h[mid] < heure) lo = mid; else hi = mid;
  }
  return Math.abs(h[lo] - heure) < Math.abs(h[hi] - heure) ? serie.valeurs[lo] : serie.valeurs[hi];
}

// series : [{ nom, couleur, heure: [], valeurs: [], pointilles }] ; yMax, yPas, unite ;
// seuils : [{ y, texte }] ; points : [{ heure, y, r, couleur }]
function graphe(id, { series, yMax, yPas, unite, seuils = [], points = [], format = (v) => Math.round(v) }) {
  const svg = document.getElementById(id);
  svg.innerHTML = '';
  const L = Math.max(320, Math.round(svg.parentElement.clientWidth));
  const H = Math.round(Math.max(190, Math.min(260, L * 0.34)));
  const x = (heure) => M.g + ((heure - HEURE_COUCHER) / (HEURE_AUBE - HEURE_COUCHER)) * (L - M.g - M.d);
  const heureDe = (px) => HEURE_COUCHER + ((px - M.g) / (L - M.g - M.d)) * (HEURE_AUBE - HEURE_COUCHER);
  svg.setAttribute('viewBox', `0 0 ${L} ${H}`);
  const y = (v) => H - M.b - (Math.min(v, yMax) / yMax) * (H - M.b - M.h);
  // la grille, de bas en haut ; l'axe du temps
  for (let v = 0; v <= yMax + 1e-6; v += yPas) {
    el(svg, 'line', { x1: M.g, x2: L - M.d, y1: y(v), y2: y(v), class: v === 0 ? 'axe' : 'grille' });
    el(svg, 'text', { x: M.g - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'etiquette' }).textContent = `${v}${v === yMax - (yMax % yPas) ? ` ${unite}` : ''}`;
  }
  for (let h = 19; h <= 30; h += L < 520 ? 3 : 2) {
    el(svg, 'text', { x: x(h), y: H - 8, 'text-anchor': 'middle', class: 'etiquette' }).textContent = `${h % 24} h`;
  }
  for (const s of seuils) {
    el(svg, 'line', { x1: M.g, x2: L - M.d, y1: y(s.y), y2: y(s.y), class: 'seuil' });
    el(svg, 'text', { x: L - M.d + 4, y: y(s.y) + 4, class: 'etiquette-seuil' }).textContent = s.texte;
  }
  // les courbes, et leur nom au bout (on lit l'identité sans aller chercher la légende) ;
  // les noms ne se chevauchent pas : on les écarte s'ils sont trop proches
  const etiquettes = [];
  for (const s of series) {
    if (!s.heure.length) continue;
    const d = s.heure.map((h, i) => `${i ? 'L' : 'M'}${x(h).toFixed(1)},${y(s.valeurs[i]).toFixed(1)}`).join('');
    el(svg, 'path', { d, class: 'courbe', stroke: s.couleur, 'stroke-dasharray': s.pointilles ? '5 4' : 'none', 'stroke-width': s.fine ? 1.2 : 2 });
    if (s.etiquette) {
      const i = s.heure.length - 1;
      etiquettes.push({ x: Math.min(x(s.heure[i]) + 5, L - M.d + 4), y: y(s.valeurs[i]) + 4, texte: s.etiquette });
    }
  }
  etiquettes.sort((a, b) => a.y - b.y);
  etiquettes.forEach((e, k) => {
    const avant = etiquettes[k - 1];
    if (avant && Math.abs(avant.x - e.x) < 60 && e.y - avant.y < 13) e.y = avant.y + 13;
    el(svg, 'text', { x: e.x, y: e.y, class: 'etiquette-courbe' }).textContent = e.texte;
  });
  for (const p of points) {
    el(svg, 'circle', { cx: x(p.heure), cy: y(p.y), r: p.r, fill: p.couleur, class: 'point' });
  }
  // survoler : la ligne de visée et la bulle des valeurs à cette heure
  const viseur = el(svg, 'line', { y1: M.h, y2: H - M.b, class: 'viseur', visibility: 'hidden' });
  const zone = el(svg, 'rect', { x: M.g, y: M.h, width: L - M.g - M.d, height: H - M.b - M.h, class: 'zone' });
  const bulle = svg.parentElement.querySelector('.bulle');
  const montrer = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * L;
    const heure = heureDe(px);
    if (heure < HEURE_COUCHER || heure > HEURE_AUBE) return;
    viseur.setAttribute('x1', px);
    viseur.setAttribute('x2', px);
    viseur.setAttribute('visibility', 'visible');
    const lignes = series.filter((s) => s.bulle !== false).map((s) => {
      const v = valeurA(s, heure);
      return v === null ? '' : `<div><i style="background:${s.couleur}"></i>${s.nom} : ${format(v)} ${unite}</div>`;
    }).join('');
    bulle.innerHTML = `<span class="heure">${heureEnTexte(heure)}</span>${lignes}`;
    bulle.style.left = `${(px / L) * r.width}px`;
    bulle.style.top = `${(M.h / H) * r.height + 8}px`;
    bulle.hidden = false;
  };
  zone.addEventListener('pointermove', montrer);
  zone.addEventListener('pointerdown', montrer);
  zone.addEventListener('pointerleave', () => {
    viseur.setAttribute('visibility', 'hidden');
    bulle.hidden = true;
  });
}

// les séries de chaque marin (et la tienne) pour une grandeur
function seriesDe(grandeur, { lissage = 0 } = {}) {
  const liste = [];
  for (const r of etat.resultats ?? []) {
    liste.push({ cle: r.cle, nom: r.nom, couleur: couleur(COULEURS[r.cle]), heure: r.serie.heure, valeurs: lissage ? lisser(r.serie[grandeur], lissage) : r.serie[grandeur], etiquette: r.nom.replace(/^l'|^le /, '') });
  }
  if (etat.toi) {
    const s = etat.toi.serie;
    liste.push({ cle: 'toi', nom: 'toi', couleur: couleur('--toi'), heure: s.heure, valeurs: lissage ? lisser(s[grandeur], lissage) : s[grandeur], pointilles: true, etiquette: 'toi' });
  }
  return liste;
}

function legende(section, series) {
  const ul = section.querySelector('[data-legende]');
  if (!ul) return;
  ul.innerHTML = series.map((s) => `<li><i${s.pointilles ? ' class="pointilles"' : ''} style="background:${s.couleur}"></i>${s.nom}</li>`).join('');
}

function afficher() {
  const reference = etat.resultats?.[0] ?? etat.toi;
  if (!reference) return;
  for (const b of document.querySelectorAll('.bloc-courbes, #bloc-resultats')) b.hidden = false;
  afficherTableau();
  // le vent et la mer (les mêmes pour tous : on prend la première nuit)
  const r = reference.serie;
  // (les rafales : la plus forte de chaque tranche de 10 s)
  const rafales = r.rafale.map((_, i) => Math.max(...r.rafale.slice(Math.max(0, i - 2), i + 3)));
  graphe('graphe-vent', {
    series: [
      { nom: 'rafales', couleur: couleur('--rafale'), heure: r.heure, valeurs: rafales, fine: true, etiquette: 'rafales' },
      { nom: 'vent moyen', couleur: couleur('--vent'), heure: r.heure, valeurs: r.vent, etiquette: 'moyen' },
    ],
    yMax: 70, yPas: 10, unite: 'nœuds',
  });
  graphe('graphe-mer', {
    series: [{ nom: 'vagues', couleur: couleur('--vent'), heure: r.heure, valeurs: r.hs }],
    yMax: 8, yPas: 2, unite: 'm', format: (v) => v.toFixed(1),
  });
  const gite = seriesDe('gite', { lissage: 5 });
  const points = [];
  for (const res of etat.resultats ?? []) {
    for (const d of res.deferlantes) points.push({ heure: d.heure, y: d.gite, r: 2.5 + 3 * Math.min(1.2, d.force), couleur: couleur(COULEURS[res.cle]) });
  }
  for (const d of etat.toi?.deferlantes ?? []) points.push({ heure: d.heure, y: d.gite, r: 2.5 + 3 * Math.min(1.2, d.force), couleur: couleur('--toi') });
  graphe('graphe-gite', { series: gite, yMax: 90, yPas: 15, unite: '°', seuils: [{ y: 60, texte: 'couché' }], points });
  legende(document.getElementById('graphe-gite').closest('section'), gite);
  const eau = seriesDe('cale');
  // (l'échelle s'adapte : jusqu'à 2 000 litres, le bateau qui coule)
  const eauMax = Math.max(500, ...eau.flatMap((s) => s.valeurs));
  const yEau = eauMax > 1200 ? 2000 : eauMax > 600 ? 1200 : 600;
  graphe('graphe-eau', {
    series: eau, yMax: yEau, yPas: yEau / 4, unite: 'L',
    seuils: [{ y: 150, texte: 'planchers' }, ...(yEau >= 2000 ? [{ y: 2000, texte: 'il coule' }] : [])],
  });
  legende(document.getElementById('graphe-eau').closest('section'), eau);
  afficherJournal();
}

const metres = (d) => (d === null || d === undefined || d === Infinity ? '—' : d > 1500 ? `${(d / 1852).toFixed(1)} mille` : `${Math.round(d / 10) * 10} m`);
function afficherTableau() {
  const lignes = [...(etat.resultats ?? [])];
  if (etat.toi) lignes.push({ ...etat.toi, cle: 'toi', nom: 'toi' });
  const t = document.getElementById('tableau');
  t.innerHTML = `<thead><tr><th>Marin</th><th>Issue</th><th class="nombre">Déferlantes</th><th class="nombre">Gîte max</th><th class="nombre">Eau max</th><th class="nombre">Pompé</th><th>Avaries</th><th class="nombre">Trombe</th><th class="nombre">Cargo</th><th class="nombre">Parcouru</th></tr></thead>`
    + `<tbody>${lignes.map((r) => {
      const s = r.stats;
      const issue = r.fin === 'aube' ? 'aube' : 'perdue';
      const raison = { emporte: 'emporté', naufrage: 'coulé', chavirage: 'chaviré', collision: 'abordé', horsBord: 'à la mer', cailloux: 'sur les cailloux', bome: 'assommé', instable: 'calcul instable' }[r.fin] ?? r.fin ?? 'en cours';
      const avaries = (r.avaries ?? []).map((a) => ({ ecouteFoc: 'écoute de foc', grandVoile: 'grand-voile', foc: 'foc', pilote: 'pilote' }[a.nom] ?? a.nom));
      return `<tr><td><span class="marque${r.cle === 'toi' ? ' pointilles' : ''}" style="background:${couleur(COULEURS[r.cle])}"></span>${r.nom}</td>`
        + `<td class="issue" data-issue="${issue}">${issue === 'aube' ? 'a vu l\'aube' : `${raison} à ${heureEnTexte(r.heureFin)}`}</td>`
        + `<td class="nombre">${s.deferlantes}${s.coups ? ` (${s.coups} couché${s.coups > 1 ? 's' : ''})` : ''}</td>`
        + `<td class="nombre">${Math.round(s.giteMax)}°</td><td class="nombre">${Math.round(s.caleMax)} L</td><td class="nombre">${Math.round(s.pompee)} L</td>`
        + `<td>${avaries.join(', ') || '—'}</td><td class="nombre">${metres(s.trombeDistance)}</td><td class="nombre">${metres(s.cargoDistance)}${s.cargoAppele ? ' ☎' : ''}</td>`
        + `<td class="nombre">${(s.distance / 1852).toFixed(1)} mille${s.distance >= 3704 ? 's' : ''}</td></tr>`;
    }).join('')}</tbody>`;
}

function afficherJournal() {
  const lignes = [...(etat.resultats ?? [])];
  if (etat.toi) lignes.push({ ...etat.toi, cle: 'toi', nom: 'toi' });
  if (!lignes.some((r) => r.cle === etat.journal)) etat.journal = lignes[0]?.cle;
  const onglets = document.getElementById('onglets-journal');
  onglets.innerHTML = '';
  for (const r of lignes) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(r.cle === etat.journal));
    b.setAttribute('aria-pressed', String(r.cle === etat.journal));
    b.innerHTML = `<span class="pastille" style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;background:${couleur(COULEURS[r.cle])}"></span>${r.nom}`;
    b.addEventListener('click', () => { etat.journal = r.cle; afficherJournal(); });
    onglets.append(b);
  }
  const r = lignes.find((x) => x.cle === etat.journal);
  document.getElementById('journal').innerHTML = (r?.journal ?? []).map((j) => `<li><span class="h">${heureEnTexte(j.heure)}</span><span>${j.texte}</span></li>`).join('');
}

// ---------- Tes nuits ----------
function lireTesNuits() {
  try {
    return JSON.parse(localStorage.getItem(CLE_NUITS) ?? '[]');
  } catch {
    return [];
  }
}
function remplirTesNuits() {
  const nuits = lireTesNuits();
  const liste = document.getElementById('tes-nuits');
  if (!nuits.length) {
    liste.innerHTML = '<li class="vide">Pas encore de nuit enregistrée : joue la nuit de tempête dans le jeu, elle apparaîtra ici.</li>';
    return;
  }
  liste.innerHTML = '';
  nuits.slice().reverse().forEach((n) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    const date = new Date(n.date);
    const quand = `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}, ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    const issue = n.fin === 'aube' ? 'a vu l\'aube' : `perdue à ${heureEnTexte(n.heureFin)}`;
    b.textContent = `${quand} · ${DIFFICULTES[n.difficulte]?.nom ?? n.difficulte} · ${issue} · ${n.stats.coups} fois couché, ${Math.round(n.stats.caleMax)} L d'eau au plus`;
    b.setAttribute('aria-pressed', String(etat.toi?.date === n.date));
    b.addEventListener('click', () => {
      etat.toi = etat.toi?.date === n.date ? null : n;
      remplirTesNuits();
      afficher();
    });
    li.append(b);
    liste.append(li);
  });
}

// (à la largeur de la page : on redessine quand elle change)
let attenteRedessin = null;
addEventListener('resize', () => {
  clearTimeout(attenteRedessin);
  attenteRedessin = setTimeout(afficher, 150);
});

remplirDifficultes();
remplirMarins();
majCurseurs();
remplirTesNuits();
addEventListener('storage', (e) => { if (e.key === CLE_NUITS) remplirTesNuits(); });
