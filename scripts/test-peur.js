// La peur, sans navigateur : node scripts/test-peur.js
// Une nuit entière avec un marin simulé qui va et vient (la barre, la timonerie, le carré)
// et regarde partout ; on vérifie que la tension suit la nuit, que chaque chose arrive au
// plus le nombre de fois prévu, jamais deux à la fois, jamais pendant qu'autre chose occupe
// le marin — et surtout que rien n'est jamais confirmé : ce qu'on regarde en face disparaît,
// et l'écho du radar s'efface quand un éclair montre la mer.
import { Peur, EVENEMENTS, SILHOUETTE, angleVu, EN_FACE } from '../src/quart/peur.js';

let echecs = 0;
const verifier = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) echecs++;
};
const heureEnTexte = (h) => `${String(Math.floor(h % 24)).padStart(2, '0')} h ${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

// Le regard (repère du bateau : l'avant vers −z) à partir d'un lacet (vers la gauche) et
// d'un site (vers le haut)
const regardDe = (lacet, site) => ({ x: -Math.sin(lacet) * Math.cos(site), y: Math.sin(site), z: -Math.cos(lacet) * Math.cos(site) });
const LIEUX = {
  barre: { x: 0.76, y: 1.9, z: 3.0 },
  timonerie: { x: 0.25, y: 1.75, z: 1.0 },
  carre: { x: 0, y: 0.7, z: -0.8 },
};

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
  let lieu = 'barre';
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
    // il change de lieu toutes les une à trois minutes (la moitié du temps dans la timonerie,
    // le reste dehors ou à l'intérieur)
    if (t > prochainLieu) {
      const r = h();
      lieu = r < 0.25 ? 'barre' : r < 0.75 ? 'timonerie' : 'carre';
      prochainLieu = t + 60 + 120 * h();
    }
    // il regarde ici et là
    if (t > prochainRegard) {
      lacet = (h() - 0.5) * (lieu === 'barre' ? 5.6 : 6.2);
      site = (h() - 0.6) * 0.8;
      prochainRegard = t + 1 + 4 * h();
    }
    // des éclairs (toute la nuit, de plus en plus)
    eclair = heure < 30 && h() < 0.004 + 0.002 * (heure - 24) ? 1 : Math.max(0, eclair - dt * 6);
    // (de temps en temps, quelque chose l'occupe : une vague scélérate, la trombe)
    const occupe = (heure > 26.5 && heure < 26.9) || (heure > 27.4 && heure < 28.2) || (heure > 29.25 && heure < 29.6);
    const ctx = {
      heure, lieu, yeux: LIEUX[lieu], regard: regardDe(lacet, site), lampe: false,
      eclairage: lieu === 'barre' ? 'eteint' : 'rouge', eclair, occupe, danger: 0, calme: 60,
      silence: true, porteOuverte: false,
    };
    const evts = peur.maj(dt, ctx);
    for (const e of evts) {
      if (!e.endsWith('-fin')) {
        journal.push({ e, t, heure, lieu });
        if (occupe) pendantOccupe++;
      }
    }
    tensions.push({ heure, v: peur.tension });
  }
  return { peur, journal, tensions, pendantOccupe };
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
  const j = n.journal.filter((x) => x.e !== 'gemissement');
  return j.every((x, i) => i === 0 || x.t - j[i - 1].t >= 74.9);
});
verifier(espacees, 'jamais deux choses étranges à moins de 75 s (les gémissements à part)');
verifier(tout.every((j) => j.heure >= EVENEMENTS[j.e].de - 1e-6 && j.heure <= EVENEMENTS[j.e].a + 1e-6), 'chacune dans sa fenêtre d\'heures');
verifier(tout.filter((j) => j.e === 'reflet').every((j) => j.lieu === 'timonerie'), 'le reflet, seulement dans la timonerie');
verifier(tout.filter((j) => j.e === 'pas' || j.e === 'coupCoque').every((j) => j.lieu !== 'barre'), 'les pas et le choc, seulement dedans');

// ---------- 2. Rien n'est jamais confirmé ----------
console.log('');
const base = { heure: 27.6, lieu: 'barre', yeux: LIEUX.barre, lampe: false, eclairage: 'eteint', eclair: 0, occupe: false, danger: 0, calme: 60, silence: false, porteOuverte: false };
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
  // (on regarde devant, à tribord, vers l'eau : la forme est du coin de l'œil, plus en arrière)
  const ctx = { ...base, regard: regardDe(-0.8, -0.35) };
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
  const ctx = { ...base, regard: regardDe(0.05, 0.05), heure: 25 };
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

console.log(echecs ? `\n${echecs} vérification(s) en échec.` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
