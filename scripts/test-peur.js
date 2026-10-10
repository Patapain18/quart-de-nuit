// La peur, sans navigateur : node scripts/test-peur.js
// Une nuit entière avec un marin simulé qui va et vient (assis au poste, debout dans la
// timonerie, dehors dans le cockpit) et regarde partout ; on vérifie que la tension suit la
// nuit, que chaque chose arrive au plus le nombre de fois prévu, jamais deux à la fois, jamais
// pendant qu'autre chose occupe le marin — et surtout que rien n'est jamais confirmé : ce qu'on
// regarde en face disparaît, l'écho du radar s'efface quand un éclair montre la mer, la porte
// de la cabine avant ne s'ouvre que dans son dos. Et le livre de bord de l'ancien propriétaire :
// une page par heure, qui dit ce qui vient.
import { Peur, EVENEMENTS, SILHOUETTE, PORTE_CABINE, angleVu, EN_FACE } from '../src/quart/peur.js';
import { PAGES, pagesLisibles, PROPRIETAIRE } from '../src/quart/livre-de-bord.js';

let echecs = 0;
const verifier = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) echecs++;
};
const heureEnTexte = (h) => `${String(Math.floor(h % 24)).padStart(2, '0')} h ${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

// Le regard (repère du bateau : l'avant vers −z) à partir d'un lacet (vers la gauche) et
// d'un site (vers le haut)
const regardDe = (lacet, site) => ({ x: -Math.sin(lacet) * Math.cos(site), y: Math.sin(site), z: -Math.cos(lacet) * Math.cos(site) });
// (les yeux : assis au poste ; debout contre la vitre tribord ; dehors, dans le cockpit)
const LIEUX = {
  timonerie: { x: 0, y: 2.44, z: 1.88 },
  debout: { x: 1.0, y: 2.62, z: 2.6 },
  pont: { x: 0.5, y: 2.4, z: 4.6 },
};
const lieuDe = (nom) => (nom === 'pont' ? 'pont' : 'timonerie');

// ---------- 1. Une nuit entière ----------
function nuitEntiere(graine) {
  const peur = new Peur({ graine });
  const dt = 0.1;
  const duree = 816; // s (la nuit du jeu, 12 min, et le jour qui se lève)
  let hasard = graine * 7 + 1;
  const h = () => {
    hasard = (hasard * 16807) % 2147483647;
    return hasard / 2147483647;
  };
  let lieu = 'timonerie';
  let porteAvant = 'fermee';
  let refermer = Infinity;
  let porteDansLeDos = true;
  let lacet = 0;
  let site = 0;
  let prochainLieu = 60;
  let prochainRegard = 0;
  let eclair = 0;
  const journal = [];
  const tensions = [];
  let pendantOccupe = 0;
  for (let t = 0; t < duree; t += dt) {
    const heure = 24 + (6.8 * t) / duree;
    // il change de place toutes les une à trois minutes (surtout au poste ; debout dans la
    // timonerie ; un peu dehors)
    if (t > prochainLieu) {
      const r = h();
      lieu = r < 0.15 ? 'pont' : r < 0.4 ? 'debout' : 'timonerie';
      prochainLieu = t + 60 + 120 * h();
    }
    // il regarde ici et là
    if (t > prochainRegard) {
      lacet = (h() - 0.5) * 6.2;
      site = (h() - 0.6) * 0.8;
      prochainRegard = t + 1 + 4 * h();
    }
    // la porte de la cabine avant qu'on a trouvée ouverte : il la referme au bout d'un moment
    if (t > refermer) {
      porteAvant = 'fermee';
      refermer = Infinity;
    }
    // des éclairs (toute la nuit, de plus en plus)
    eclair = heure < 30 && h() < 0.004 + 0.002 * (heure - 24) ? 1 : Math.max(0, eclair - dt * 6);
    // (de temps en temps, quelque chose l'occupe : une vague scélérate, la trombe)
    const occupe = (heure > 26.5 && heure < 26.9) || (heure > 27.4 && heure < 28.2) || (heure > 29.25 && heure < 29.6);
    const ctx = {
      heure, lieu: lieuDe(lieu), yeux: LIEUX[lieu], regard: regardDe(lacet, site), lampe: false,
      eclairage: lieu === 'pont' ? 'eteint' : 'rouge', eclair, occupe, danger: 0, calme: 60,
      porteOuverte: false, porteAvant, voletsFermes: {},
    };
    const evts = peur.maj(dt, ctx);
    for (const e of evts) {
      if (!e.endsWith('-fin')) {
        journal.push({ e, t, heure, lieu: ctx.lieu });
        if (occupe) pendantOccupe++;
      }
      if (e === 'porteAvant') {
        // (le jeu l'entrouvre ; était-elle bien dans son dos ?)
        if (angleVu(ctx.yeux, ctx.regard, PORTE_CABINE) <= 80) porteDansLeDos = false;
        porteAvant = 'entrouverte';
        refermer = t + 15 + 30 * h();
      }
    }
    tensions.push({ heure, v: peur.tension });
  }
  return { peur, journal, tensions, pendantOccupe, porteDansLeDos };
}

console.log('La peur : trois nuits avec un marin simulé\n');
const nuits = [3, 11, 29].map(nuitEntiere);
for (const [k, n] of nuits.entries()) {
  console.log(`Nuit ${k + 1} : ${n.journal.map((j) => `${heureEnTexte(j.heure)} ${j.e} (${j.lieu})`).join(' · ')}`);
}
console.log('');
const tout = nuits.flatMap((n) => n.journal);
verifier(nuits.every((n) => n.tensions.every((x) => x.v >= 0 && x.v <= 1)), 'la tension reste entre 0 et 1');
verifier(nuits.every((n) => Math.max(...n.tensions.filter((x) => x.heure > 28.5 && x.heure < 30).map((x) => x.v)) > 0.5), 'elle monte au-dessus de 0,5 au plus fort de la nuit, avant l\'aube');
const moyenne = (n, a, b) => { const x = n.tensions.filter((y) => y.heure >= a && y.heure < b); return x.reduce((s, y) => s + y.v, 0) / x.length; };
verifier(nuits.every((n) => moyenne(n, 24, 25) < moyenne(n, 26, 27) && moyenne(n, 26, 27) < moyenne(n, 28.5, 29.8)), 'elle monte d\'heure en heure');
verifier(nuits.every((n) => n.tensions.at(-1).v < 0.35), 'elle retombe avec le jour');
verifier(nuits.every((n) => Object.entries(EVENEMENTS).every(([nom, e]) => n.peur.fois[nom] <= e.fois)), 'chaque chose arrive au plus le nombre de fois prévu');
verifier(nuits.every((n) => new Set(n.journal.map((j) => j.e)).size >= 5), 'au moins cinq choses différentes par nuit (le marin simulé va au hasard)');
verifier(nuits.every((n) => n.pendantOccupe === 0), 'rien d\'étrange pendant qu\'autre chose occupe le marin');
const espacees = nuits.every((n) => {
  const j = n.journal.filter((x) => x.e !== 'gemissement' && x.e !== 'porteAvant');
  return j.every((x, i) => i === 0 || x.t - j[i - 1].t >= 74.9);
});
verifier(espacees, 'jamais deux choses étranges à moins de 75 s (les gémissements et la porte de la cabine avant à part)');
verifier(tout.every((j) => j.heure >= EVENEMENTS[j.e].de - 1e-6 && j.heure <= EVENEMENTS[j.e].a + 1e-6), 'chacune dans sa fenêtre d\'heures');
verifier(tout.filter((j) => j.e === 'reflet').every((j) => j.lieu === 'timonerie'), 'le reflet, seulement dans la timonerie');
verifier(tout.filter((j) => j.e === 'pas' || j.e === 'coupCoque' || j.e === 'porteAvant').every((j) => j.lieu === 'timonerie'), 'les pas, le choc, la porte de la cabine avant : seulement dans la timonerie');
verifier(tout.filter((j) => ['silhouette', 'eclairSilhouette', 'echoSuiveur', 'echoProche'].includes(j.e)).every((j) => j.lieu === 'timonerie'), 'quelqu\'un à l\'avant, les échos du radar : vus de la timonerie (du cockpit, elle cache l\'avant ; le radar est sur la console)');
const portes = tout.filter((j) => j.e === 'porteAvant');
verifier(portes.length >= 3 && nuits.every((n) => n.porteDansLeDos && n.peur.fois.porteAvant <= 2), `la porte de la cabine avant s'entrouvre ${portes.length} fois en trois nuits, toujours dans son dos (à ${portes.map((j) => heureEnTexte(j.heure)).join(', ')})`);

// ---------- 2. Rien n'est jamais confirmé ----------
console.log('');
const base = { heure: 27.6, lieu: 'timonerie', yeux: LIEUX.timonerie, lampe: false, eclairage: 'rouge', eclair: 0, occupe: false, danger: 0, calme: 60, porteOuverte: false, porteAvant: 'fermee', voletsFermes: {} };
// la silhouette : vue du coin de l'œil, elle reste ; regardée en face, elle n'est plus là
{
  const peur = new Peur({ graine: 5 });
  // (on regarde à 45° à gauche de l'avant : l'avant est du coin de l'œil)
  const dePlus = regardDe(0.75, 0.05);
  peur.provoquer('silhouette');
  let ctx = { ...base, regard: dePlus };
  peur.maj(0.1, ctx);
  const apparue = !!peur.silhouette;
  for (let i = 0; i < 20; i++) peur.maj(0.1, ctx);
  const resteDeCote = !!peur.silhouette && peur.silhouette.opacite > 0.5;
  // on tourne la tête vers elle
  const s = peur.silhouette;
  const p = { x: s.x, y: s.y + 1.1, z: s.z };
  const vers = { x: p.x - ctx.yeux.x, y: p.y - ctx.yeux.y, z: p.z - ctx.yeux.z };
  const n = Math.hypot(vers.x, vers.y, vers.z);
  ctx = { ...base, regard: { x: vers.x / n, y: vers.y / n, z: vers.z / n } };
  const evts = peur.maj(0.016, ctx);
  verifier(apparue && resteDeCote, 'la silhouette apparaît du coin de l\'œil, et y reste');
  verifier(!peur.silhouette && evts.includes('silhouette-fin') && peur.journal.at(-1).regardee, 'regardée en face, elle disparaît dans la même image (et c\'est noté)');
  verifier(angleVu(base.yeux, regardDe(0.75, 0.05), { x: SILHOUETTE.x, y: SILHOUETTE.y + 1.1, z: SILHOUETTE.z }) > EN_FACE, '(elle était bien hors du centre du regard)');
}
// le reflet : on se retourne, il n'y a personne ; il n'est plus dans la vitre ensuite
{
  const peur = new Peur({ graine: 6 });
  const ctx = { ...base, lieu: 'timonerie', yeux: LIEUX.timonerie, eclairage: 'rouge', regard: regardDe(0, -0.05) };
  peur.provoquer('reflet');
  for (let i = 0; i < 30; i++) peur.maj(0.1, ctx);
  const visible = !!peur.reflet && peur.reflet.opacite > 0.5;
  peur.maj(0.016, { ...ctx, regard: regardDe(Math.PI, 0) });
  const parti = !peur.reflet;
  peur.maj(0.5, ctx);
  verifier(visible && parti && !peur.reflet, 'le reflet : là tant qu\'on regarde la vitre, parti dès qu\'on se retourne, et pas revenu');
}
// la forme dans l'eau : regardée, elle coule
{
  const peur = new Peur({ graine: 7 });
  // (dehors, dans le cockpit : on regarde à tribord, vers l'eau ; la forme est du coin de l'œil,
  // plus en arrière — on cherche le regard qui la met au bord de la vue)
  const dehors = { ...base, lieu: 'pont', yeux: LIEUX.pont, eclairage: 'eteint' };
  let regard = null;
  for (let lacet = -0.3; lacet > -2.2 && !regard; lacet -= 0.05) {
    for (let site = -0.1; site > -0.8 && !regard; site -= 0.05) if (peur.possible('forme', { ...dehors, regard: regardDe(lacet, site) })) regard = regardDe(lacet, site);
  }
  const ctx = { ...dehors, regard };
  peur.provoquer('forme');
  for (let i = 0; i < 15; i++) peur.maj(0.1, ctx);
  const f = peur.forme;
  const vue = !!f && f.opacite > 0.5;
  const vers = { x: f.x - ctx.yeux.x, y: 0.2 - ctx.yeux.y, z: f.z - ctx.yeux.z };
  const n = Math.hypot(vers.x, vers.y, vers.z);
  const regardee = { ...ctx, regard: { x: vers.x / n, y: vers.y / n, z: vers.z / n } };
  peur.maj(0.016, regardee);
  const coule = peur.forme?.coule;
  for (let i = 0; i < 12; i++) peur.maj(0.1, regardee);
  verifier(vue && coule && !peur.forme, 'la forme dans l\'eau : regardée, elle coule et disparaît en moins d\'une seconde');
}
// (et de la timonerie, debout contre la vitre de côté, à regarder l'eau : mais pas derrière
// ses volets fermés, ni assis au milieu)
{
  const peur = new Peur({ graine: 7 });
  const ctx = { ...base, yeux: LIEUX.debout };
  let possible = false;
  for (let lacet = -0.4; lacet > -2.4 && !possible; lacet -= 0.05) {
    for (let site = -0.2; site > -0.9 && !possible; site -= 0.05) possible = peur.possible('forme', { ...ctx, regard: regardDe(lacet, site) });
  }
  const volets = [-0.4, -0.8, -1.2, -1.6].some((l) => [-0.3, -0.5, -0.7].some((sv) => peur.possible('forme', { ...ctx, regard: regardDe(l, sv), voletsFermes: { tribord: true } })));
  const assis = [-0.8, -1.2, -1.6].some((l) => [-0.3, -0.5].some((sv) => peur.possible('forme', { ...ctx, yeux: LIEUX.timonerie, regard: regardDe(l, sv) })));
  verifier(possible && !volets && !assis, 'la forme dans l\'eau se voit aussi de la timonerie, debout contre la vitre de côté — pas derrière ses volets fermés, ni assis au poste');
}
// la chose sous la coque : le sondeur la voit pendant qu'elle passe dessous, puis plus rien
{
  const peur = new Peur({ graine: 8 });
  peur.provoquer('chose');
  const sondes = [];
  let sous = false;
  for (let i = 0; i < 180; i++) {
    peur.maj(0.1, { ...base, regard: regardDe(0, 0) });
    if (peur.chose?.sonde) sondes.push(peur.chose.sonde);
    if (peur.chose?.sous) sous = true;
  }
  verifier(sous && sondes.length > 10 && sondes.every((s) => s > 5 && s < 7.5) && !peur.chose, 'la chose passe sous le bateau (le sondeur marque 5 à 7,5 m), puis s\'en va');
}
// dans un éclair seulement
{
  const peur = new Peur({ graine: 9 });
  const ctx = { ...base, regard: regardDe(0.05, -0.05), heure: 25 };
  peur.provoquer('eclairSilhouette');
  peur.maj(0.1, ctx);
  const sansEclair = !peur.silhouette;
  peur.maj(0.016, { ...ctx, eclair: 0.9 });
  const pendant = !!peur.silhouette;
  for (let i = 0; i < 30; i++) peur.maj(0.016, ctx);
  verifier(sansEclair && pendant && !peur.silhouette, 'la silhouette de l\'éclair n\'existe que le temps de l\'éclair');
}

// les échos du radar : celui qui nous suit garde son relèvement et se rapproche ; celui
// d'à côté fait sonner l'alarme ; un éclair montre la mer, et il n'y a plus rien
{
  const peur = new Peur({ graine: 10 });
  const ctx = { ...base, regard: regardDe(0, 0) };
  peur.provoquer('echoSuiveur');
  peur.maj(0.1, ctx);
  const releve = peur.echo?.releve;
  const d0 = peur.echo?.distance;
  for (let i = 0; i < 200; i++) peur.maj(0.1, ctx);
  const suit = !!peur.echo && peur.echo.releve === releve && peur.echo.distance < d0 - 500 && !peur.echo.alarme;
  for (let i = 0; i < 400 && peur.echo; i++) peur.maj(0.1, ctx);
  verifier(suit && !peur.echo, 'l\'écho qui nous suit : toujours au même relèvement, de plus en plus près, sans alarme, puis plus rien');
}
{
  const peur = new Peur({ graine: 11 });
  const ctx = { ...base, lieu: 'timonerie', yeux: LIEUX.timonerie, regard: regardDe(0, -0.3) };
  peur.provoquer('echoProche');
  for (let i = 0; i < 50; i++) peur.maj(0.1, ctx);
  const alarme = !!peur.echo?.alarme && peur.echo.distance < 463;
  peur.maj(0.016, { ...ctx, eclair: 0.9 });
  for (let i = 0; i < 15; i++) peur.maj(0.1, ctx);
  verifier(alarme && !peur.echo, 'l\'écho tout près : l\'alarme sonne (dans le quart de mille) ; un éclair, et il n\'est plus là en moins de 1,5 s');
}

// la porte de la cabine avant : elle ne s'ouvre que dans ton dos, et pas deux fois sans avoir
// été refermée
{
  const peur = new Peur({ graine: 12 });
  // (assis au poste, on la regarde : elle est devant, à gauche, en bas)
  const vers = { x: PORTE_CABINE.x - LIEUX.timonerie.x, y: PORTE_CABINE.y - LIEUX.timonerie.y, z: PORTE_CABINE.z - LIEUX.timonerie.z };
  const n = Math.hypot(vers.x, vers.y, vers.z);
  const laRegarder = { ...base, regard: { x: vers.x / n, y: vers.y / n, z: vers.z / n } };
  peur.provoquer('porteAvant');
  let ouverte = false;
  for (let i = 0; i < 30; i++) if (peur.maj(0.1, laRegarder).includes('porteAvant')) ouverte = true;
  const devant = ouverte;
  for (let i = 0; i < 30; i++) if (peur.maj(0.1, { ...base, regard: regardDe(Math.PI, 0) }).includes('porteAvant')) ouverte = true;
  const dos = ouverte;
  peur.provoquer('porteAvant');
  let encore = false;
  for (let i = 0; i < 30; i++) if (peur.maj(0.1, { ...base, regard: regardDe(Math.PI, 0), porteAvant: 'entrouverte' }).includes('porteAvant')) encore = true;
  verifier(!devant && dos && !encore, 'la porte de la cabine avant : pas pendant qu\'on la regarde ; dans notre dos, si ; et pas encore une fois tant qu\'on ne l\'a pas refermée');
}

// ---------- 3. Le livre de bord ----------
console.log('');
{
  const heures = PAGES.map((p) => p.heure);
  verifier(PAGES.length === 6 && heures.every((h, k) => h === 24 + k), `le livre de bord d'${PROPRIETAIRE} : une page pour chaque heure de sa dernière nuit, de minuit à 5 h`);
  verifier(pagesLisibles(24).length === 1 && pagesLisibles(26.5).length === 3 && pagesLisibles(29.99).length === 6, 'on ne lit une page qu\'une fois son heure venue (à 2 h 30 : trois pages)');
  const derniere = PAGES.at(-1);
  verifier(derniere.inachevee && !/[.!?»]$/.test(derniere.texte) && PAGES.slice(0, -1).every((p) => /[.!?»]$/.test(p.texte)), `la dernière s'arrête au milieu d'une phrase (« …${derniere.texte.slice(-22)} »)`);
  // (chaque page dit ce que cette heure apporte, et ce qui ne s'explique pas)
  const dit = [['batterie'], ['moteur', 'volets', 'grain'], ['grondent', 'volet', 'mayday'], ['foc', 'sondeur', 'quelqu\'un'], ['dalots', 'porte de la cabine avant'], ['pas', '« Morgane »', 'Trois coups']];
  verifier(PAGES.every((p, k) => dit[k].every((mot) => p.texte.includes(mot))), 'chacune dit ce que l\'heure apporte : la batterie, le moteur et les volets, les vagues qu\'on entend, le foc, les dalots… et ce qui ne s\'explique pas');
  verifier(PAGES.every((p) => p.texte.length > 150 && p.texte.length < 420), `des pages courtes, qu'on lit d'un coup d'œil (${Math.min(...PAGES.map((p) => p.texte.length))} à ${Math.max(...PAGES.map((p) => p.texte.length))} signes)`);
}

console.log(echecs ? `\n${echecs} vérification(s) en échec.` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
