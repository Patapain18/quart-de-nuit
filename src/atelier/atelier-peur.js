// L'atelier de la peur : un panneau, à droite du jeu, pour régler et vérifier ce que fait
// jeu/peur.js. On l'ouvre en ajoutant ?peur à l'adresse du jeu (jeu.html?peur).
//
// On y voit :
//  - la tension (et on peut la forcer) ;
//  - chaque chose étrange : combien de fois elle est arrivée, sa fenêtre d'heures, si elle
//    pourrait arriver maintenant (et sinon, pourquoi), où est sa cible sur l'écran ; un
//    bouton pour la provoquer (elle arrive dès que ses conditions sont réunies) ;
//  - où l'on est, ce que l'on regarde ;
//  - la frise de la nuit : le silence de Jos, les vagues scélérates, la trombe, le cargo,
//    l'étrange ancien, les fenêtres de la peur et ce qui est arrivé.
// Des boutons pour commencer la nuit et sauter à une heure.
import { EVENEMENTS, surEcran, coinDeLOeil, enFace } from '../jeu/peur.js';

const NOMS = {
  gemissement: 'La mer gémit', silhouette: 'Quelqu\'un à l\'avant', reflet: 'Le reflet dans la vitre', forme: 'La forme dans l\'eau',
  chose: 'La chose sous la coque', pas: 'Des pas sur le pont', nom: 'Ton nom sur le 16', coupCoque: 'Le choc (sursaut)',
  eclairSilhouette: 'Dans l\'éclair (sursaut)',
};
// (pourquoi une chose ne peut pas arriver maintenant)
const CONDITIONS = {
  silhouette: 'dehors ou dans la timonerie, l\'avant du bateau au bord de la vue',
  eclairSilhouette: 'un éclair, l\'avant du bateau dans la vue',
  reflet: 'dans la timonerie, la lumière allumée, en regardant le pare-brise',
  forme: 'dehors, l\'eau le long de la coque au bord de la vue',
  pas: 'dans le carré ou la timonerie, la porte fermée',
  coupCoque: 'dedans, 40 s sans déferlante',
  nom: 'pendant le silence de Jos (ou à la fin de sa fenêtre)',
};
const heure = (h) => `${String(Math.floor(h % 24)).padStart(2, '0')} h ${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

export function ouvrirAtelierPeur(jeu) {
  const style = document.createElement('style');
  style.textContent = `
  #atelier-peur { position: fixed; right: 8px; top: 8px; bottom: 8px; width: 340px; z-index: 60; overflow: auto;
    background: rgba(10, 12, 15, 0.86); color: #e8e4dc; font: 13px/1.35 system-ui, sans-serif; border-radius: 8px; padding: 12px; }
  #atelier-peur h2 { font-size: 15px; margin: 0 0 8px; }
  #atelier-peur h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #9aa3ad; margin: 14px 0 6px; }
  #atelier-peur button { font: inherit; background: #262c33; color: inherit; border: 1px solid #3b444e; border-radius: 5px; padding: 3px 8px; cursor: pointer; }
  #atelier-peur button:hover { background: #313942; }
  #atelier-peur .ligne { display: grid; grid-template-columns: 12px 1fr auto; gap: 6px; align-items: center; padding: 4px 0; border-bottom: 1px solid #222830; }
  #atelier-peur .point { width: 9px; height: 9px; border-radius: 50%; background: #555; }
  #atelier-peur .point.oui { background: #59c27a; }
  #atelier-peur .point.fini { background: #3a4048; }
  #atelier-peur .detail { color: #9aa3ad; font-size: 11.5px; }
  #atelier-peur .barre { height: 8px; background: #222830; border-radius: 4px; overflow: hidden; margin: 4px 0; }
  #atelier-peur .barre > div { height: 100%; background: linear-gradient(90deg, #6b7f95, #c0504d); }
  #atelier-peur .boutons { display: flex; flex-wrap: wrap; gap: 4px; }
  #atelier-peur svg text { fill: #9aa3ad; font-size: 9px; }
  `;
  document.head.append(style);
  const panneau = document.createElement('aside');
  panneau.id = 'atelier-peur';
  panneau.setAttribute('aria-label', 'Atelier de la peur');
  panneau.innerHTML = `
    <h2>Atelier de la peur</h2>
    <div class="boutons" id="ap-heures"></div>
    <h3>La tension</h3>
    <div class="barre"><div id="ap-tension" style="width:0%"></div></div>
    <div class="detail" id="ap-tension-texte"></div>
    <label class="detail">Forcer : <input type="range" id="ap-forcer" min="-0.05" max="1" step="0.05" value="-0.05"> <span id="ap-forcer-v">non</span></label>
    <h3>Ce qui peut arriver</h3>
    <div id="ap-liste"></div>
    <h3>Le marin</h3>
    <div class="detail" id="ap-marin"></div>
    <h3>La nuit</h3>
    <svg id="ap-frise" width="316" height="190" role="img" aria-label="La frise de la nuit"></svg>`;
  document.body.append(panneau);

  // sauter à une heure (et commencer la nuit s'il le faut)
  const zoneHeures = panneau.querySelector('#ap-heures');
  for (const [texte, h] of [['Commencer la nuit', null], ['22 h', 22], ['0 h', 24], ['1 h 45', 25.75], ['3 h', 27], ['5 h', 29]]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = texte;
    b.addEventListener('click', () => {
      if (!jeu.nuit) jeu.commencerNuit();
      if (h !== null) jeu.nuit.allerA(h);
    });
    zoneHeures.append(b);
  }
  // forcer la tension
  const forcer = panneau.querySelector('#ap-forcer');
  forcer.addEventListener('input', () => {
    const v = Number(forcer.value);
    if (jeu.nuit) jeu.nuit.peur.tensionForcee = v < 0 ? null : v;
    panneau.querySelector('#ap-forcer-v').textContent = v < 0 ? 'non' : v.toFixed(2);
  });
  // la liste des choses
  const liste = panneau.querySelector('#ap-liste');
  const lignes = {};
  for (const nom of Object.keys(EVENEMENTS)) {
    const l = document.createElement('div');
    l.className = 'ligne';
    l.innerHTML = `<span class="point"></span><div><div>${NOMS[nom]}</div><div class="detail"></div></div><button type="button">Provoquer</button>`;
    l.querySelector('button').addEventListener('click', () => jeu.nuit?.peur.provoquer(nom));
    liste.append(l);
    lignes[nom] = { point: l.querySelector('.point'), detail: l.querySelector('.detail') };
  }

  let age = 0;
  let dernier = performance.now();
  const maj = (t) => {
    requestAnimationFrame(maj);
    age += (t - dernier) / 1000;
    dernier = t;
    if (age < 0.2) return;
    age = 0;
    const nuit = jeu.nuit;
    if (!nuit) {
      panneau.querySelector('#ap-tension-texte').textContent = 'Pas de nuit en cours : « Commencer la nuit ».';
      return;
    }
    const p = nuit.peur;
    const ctx = p.dernierCtx;
    panneau.querySelector('#ap-tension').style.width = `${Math.round(p.tension * 100)}%`;
    panneau.querySelector('#ap-tension-texte').textContent = `${p.tension.toFixed(2)} · ${heure(nuit.heure)}${ctx?.occupe ? ' · occupé (vague, trombe, cargo, danger)' : ''}${nuit.silence ? ' · Jos ne répond plus' : ''}`;
    for (const [nom, e] of Object.entries(EVENEMENTS)) {
      const l = lignes[nom];
      const possible = ctx ? p.possible(nom, ctx) : false;
      const fini = p.fois[nom] >= e.fois;
      l.point.className = `point${fini ? ' fini' : possible ? ' oui' : ''}`;
      let cible = '';
      if (ctx && (nom === 'silhouette' || nom === 'eclairSilhouette')) {
        const s = surEcran(ctx, p.pointSilhouette(ctx, 1.1));
        cible = s ? ` · à l'écran ${s.x.toFixed(2)}, ${s.y.toFixed(2)}${coinDeLOeil(s) ? ' (coin de l\'œil)' : enFace(s) ? ' (en face)' : ''}` : ' · hors de la vue';
      } else if (ctx && nom === 'forme') {
        const f = p.pointForme(ctx);
        const s = surEcran(ctx, { x: f.x, y: 0.2, z: f.z });
        cible = s ? ` · à l'écran ${s.x.toFixed(2)}, ${s.y.toFixed(2)}${coinDeLOeil(s) ? ' (coin de l\'œil)' : ''}` : ' · hors de la vue';
      }
      l.detail.textContent = `${p.fois[nom]} / ${e.fois} · ${heure(e.de)} – ${heure(e.a)}${p.enCours(nom) ? ' · EN COURS' : ''}${!possible && CONDITIONS[nom] ? ` · il faut : ${CONDITIONS[nom]}` : ''}${cible}`;
    }
    if (ctx) {
      const lacet = Math.round((Math.atan2(-ctx.regard.x, -ctx.regard.z) * 180) / Math.PI);
      const site = Math.round((Math.asin(Math.max(-1, Math.min(1, ctx.regard.y))) * 180) / Math.PI);
      panneau.querySelector('#ap-marin').textContent = `${ctx.lieu} · regard ${lacet}° (gauche +), ${site}° (haut +) · lampe ${ctx.lampe ? 'allumée' : 'éteinte'} · éclairage ${ctx.eclairage}${ctx.eclair > 0.1 ? ' · ÉCLAIR' : ''}`;
    }
    dessinerFrise(panneau.querySelector('#ap-frise'), nuit);
  };
  requestAnimationFrame(maj);
}

// La frise de la nuit (18 h 45 → 6 h) : une rangée par sorte de chose
function dessinerFrise(svg, nuit) {
  const L = 316;
  const x0 = 70;
  const x = (h) => x0 + ((h - 18.75) / 11.25) * (L - x0 - 4);
  const pr = nuit.prevu;
  const rangs = [
    ['Jos se tait', [[pr.silence, pr.silence + 0.55]]],
    ['Scélérates', [0, 1, 2].filter((k) => Number.isFinite(pr[`scelerate${k}`])).map((k) => [pr[`scelerate${k}`], pr[`scelerate${k}`] + 0.9])],
    ['Trombe, cargo', [[pr.trombe, pr.trombe + 2.2], [pr.cargo, pr.cargo + 2.2]]],
    ['Étrange', ['lumiere', 'voix16', 'echo', 'coups'].map((n) => [pr[n], pr[n] + 0.15])],
    ...Object.keys(EVENEMENTS).map((nom) => [NOMS[nom].replace(/ \(sursaut\)/, ' !'), [[EVENEMENTS[nom].de, EVENEMENTS[nom].a]], nom]),
  ];
  const h = 13;
  let html = '';
  rangs.forEach(([nom, plages, cle], i) => {
    const y = 4 + i * h;
    html += `<text x="0" y="${y + 9}">${nom.length > 15 ? `${nom.slice(0, 14)}…` : nom}</text>`;
    for (const [a, b] of plages) {
      if (!Number.isFinite(a)) continue;
      html += `<rect x="${x(a)}" y="${y + 2}" width="${Math.max(2, x(Math.min(30, b)) - x(a))}" height="${h - 4}" rx="2" fill="${cle ? '#2c3540' : '#5b6b7d'}"/>`;
    }
    // (ce qui est arrivé : un trait clair)
    if (cle) {
      for (const j of nuit.peur.journal.filter((e) => e.nom === cle)) html += `<rect x="${x(j.heure) - 1}" y="${y}" width="3" height="${h}" fill="${j.regardee ? '#e0b44a' : '#c0504d'}"/>`;
    }
  });
  // l'heure qu'il est
  html += `<line x1="${x(nuit.heure)}" x2="${x(nuit.heure)}" y1="0" y2="${4 + rangs.length * h}" stroke="#e8e4dc" stroke-width="1"/>`;
  svg.setAttribute('height', String(8 + rangs.length * h));
  svg.innerHTML = html;
}
