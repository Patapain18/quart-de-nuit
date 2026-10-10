// Fabrique les sons du jeu : node scripts/preparer-sons.mjs (npm run sons)
// (npm run sons -- pas porte-grince : seulement ces sons-là ; la fiche garde les autres)
//
// Suit la recette (scripts/sons/recette.mjs) : télécharge les enregistrements d'origine
// (une seule fois, dans sons-bruts/), en coupe les morceaux choisis, règle leur volume, et
// écrit les fichiers du jeu dans public/sons/ avec leur fiche (public/sons/sons.json).
// Il faut ffmpeg (sur Mac : brew install ffmpeg).
//
// Les boucles sans couture : un MP3 commence et finit par un peu de silence (le codeur en
// ajoute), et chaque navigateur ne l'enlève pas de la même façon. On encadre donc la boucle
// de 0,25 s de son de part et d'autre (la fin de la boucle avant, son début après) : le jeu
// boucle entre les deux repères, au milieu du son, et le décalage éventuel du décodeur
// tombe toujours sur du son qui raccorde.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { SOURCES, SONS } from './sons/recette.mjs';

const BRUTS = 'sons-bruts';
const SORTIE = 'public/sons';
const TRAVAIL = path.join(BRUTS, 'travail');
const MARGE = 0.25;
const SILENCE = 0.4; // entre deux morceaux d'une planche
const TAUX = 44100;

fs.mkdirSync(TRAVAIL, { recursive: true });
fs.mkdirSync(SORTIE, { recursive: true });

const ffmpeg = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'inherit'] });

// Le volume ressenti d'un fichier (LUFS intégrés), mesuré par ffmpeg
function volume(fichier) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', fichier, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = [...r.stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1);
  if (!m) throw new Error(`volume illisible : ${fichier}`);
  return Number(m[1]);
}

function duree(fichier) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', fichier], { encoding: 'utf8' }));
}

async function brut(cle) {
  const fichier = path.join(BRUTS, `${cle}.mp3`);
  if (fs.existsSync(fichier) && fs.statSync(fichier).size > 10000) return fichier;
  const source = SOURCES[cle];
  console.log(`  téléchargement : ${source.titre} (${source.site})`);
  const reponse = await fetch(source.fichier, { headers: { 'User-Agent': 'Mozilla/5.0 (quart-de-nuit, npm run sons)' } });
  if (!reponse.ok) throw new Error(`${source.fichier} : ${reponse.status}`);
  fs.writeFileSync(fichier, Buffer.from(await reponse.arrayBuffer()));
  await new Promise((r) => setTimeout(r, 1500)); // (poliment : pas de rafale de téléchargements)
  return fichier;
}

const encoder = (entree, sortie, canaux, gainDb) => ffmpeg([
  '-i', entree, '-af', `volume=${gainDb.toFixed(2)}dB,alimiter=limit=0.95:level=false`,
  '-ac', String(canaux), '-ar', String(TAUX), '-c:a', 'libmp3lame', '-b:a', canaux === 2 ? '112k' : '72k', sortie,
]);

const credit = (cle) => {
  const s = SOURCES[cle];
  return { titre: s.titre, auteur: s.auteur, site: s.site, page: s.page, licence: 'CC0 1.0' };
};

async function boucle(son) {
  const source = await brut(son.source);
  const { debut, duree: L, fondu: F, canaux } = son;
  const morceau = path.join(TRAVAIL, `${son.nom}-morceau.wav`);
  const avecMarges = path.join(TRAVAIL, `${son.nom}-boucle.wav`);
  // 1. le morceau choisi, un peu plus long que la boucle (de quoi faire le fondu)
  ffmpeg(['-ss', String(debut), '-t', String(L + F), '-i', source, '-ac', String(canaux), '-ar', String(TAUX), morceau]);
  // 2. la boucle : le corps, puis la fin du morceau qui s'efface pendant que son début
  // revient (à puissance égale) ; 3. les marges
  const f = [
    '[0:a]asplit=3[a][b][c]',
    `[a]atrim=start=${F}:end=${L},asetpts=PTS-STARTPTS[corps]`,
    `[b]atrim=start=${L}:end=${L + F},asetpts=PTS-STARTPTS,afade=t=out:st=0:d=${F}:curve=qsin[queue]`,
    `[c]atrim=start=0:end=${F},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${F}:curve=qsin[tete]`,
    '[queue][tete]amix=inputs=2:normalize=0:duration=longest[joint]',
    '[corps][joint]concat=n=2:v=0:a=1[boucle]',
    '[boucle]asplit=3[r1][r2][r3]',
    `[r1]atrim=start=${L - MARGE}:end=${L},asetpts=PTS-STARTPTS[avant]`,
    `[r3]atrim=start=0:end=${MARGE},asetpts=PTS-STARTPTS[apres]`,
    '[avant][r2][apres]concat=n=3:v=0:a=1[fin]',
  ].join(';');
  ffmpeg(['-i', morceau, '-filter_complex', f, '-map', '[fin]', avecMarges]);
  const sortie = path.join(SORTIE, `${son.nom}.mp3`);
  encoder(avecMarges, sortie, canaux, son.lufs - volume(avecMarges));
  return { fichier: `${son.nom}.mp3`, sorte: 'boucle', role: son.role, boucle: [MARGE, MARGE + L], duree: duree(sortie), credits: [credit(son.source)] };
}

async function coups(son) {
  const pieces = [];
  const morceaux = [];
  let t = SILENCE / 2;
  for (const [k, [cle, debut, d]] of son.morceaux.entries()) {
    const source = await brut(cle);
    const piece = path.join(TRAVAIL, `${son.nom}-${k}.wav`);
    // un fondu très court à l'attaque, plus long à la fin (pas de clic)
    const finFondu = Math.min(0.4, d * 0.25);
    ffmpeg(['-ss', String(debut), '-t', String(d), '-i', source, '-ac', String(son.canaux), '-ar', String(TAUX),
      '-af', `afade=t=in:st=0:d=0.006,afade=t=out:st=${(d - finFondu).toFixed(3)}:d=${finFondu.toFixed(3)}`, piece]);
    // chaque morceau au même volume ressenti
    const regle = path.join(TRAVAIL, `${son.nom}-${k}-regle.wav`);
    ffmpeg(['-i', piece, '-af', `volume=${(son.lufs - volume(piece)).toFixed(2)}dB`, regle]);
    pieces.push(regle);
    morceaux.push([Number(t.toFixed(3)), d]);
    t += d + SILENCE;
  }
  // la planche : silence, morceau, silence, morceau…
  const silence = path.join(TRAVAIL, `silence-${son.canaux}.wav`);
  ffmpeg(['-f', 'lavfi', '-i', `anullsrc=r=${TAUX}:cl=${son.canaux === 2 ? 'stereo' : 'mono'}`, '-t', String(SILENCE / 2), silence]);
  const liste = path.join(TRAVAIL, `${son.nom}-liste.txt`);
  const lignes = [`file '${path.resolve(silence)}'`];
  for (const p of pieces) lignes.push(`file '${path.resolve(p)}'`, `file '${path.resolve(silence)}'`, `file '${path.resolve(silence)}'`);
  fs.writeFileSync(liste, lignes.join('\n'));
  const planche = path.join(TRAVAIL, `${son.nom}-planche.wav`);
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', liste, planche]);
  const sortie = path.join(SORTIE, `${son.nom}.mp3`);
  encoder(planche, sortie, son.canaux, 0);
  const sources = [...new Set(son.morceaux.map((m) => m[0]))];
  return { fichier: `${son.nom}.mp3`, sorte: 'coups', role: son.role, morceaux, duree: duree(sortie), credits: sources.map(credit) };
}

// (des noms donnés : on ne refait qu'eux, et la fiche garde les autres tels quels)
const choisis = process.argv.slice(2);
const inconnus = choisis.filter((nom) => !SONS.some((s) => s.nom === nom));
if (inconnus.length) throw new Error(`sons inconnus : ${inconnus.join(', ')}`);
const aFaire = choisis.length ? SONS.filter((s) => choisis.includes(s.nom)) : SONS;
const cheminFiche = path.join(SORTIE, 'sons.json');
const fiche = choisis.length && fs.existsSync(cheminFiche)
  ? JSON.parse(fs.readFileSync(cheminFiche, 'utf8'))
  : { licence: 'Tous ces enregistrements sont dans le domaine public (CC0 1.0).', sons: {} };
let total = 0;
for (const son of aFaire) {
  process.stdout.write(`${son.nom}… `);
  fiche.sons[son.nom] = son.sorte === 'boucle' ? await boucle(son) : await coups(son);
  const taille = fs.statSync(path.join(SORTIE, `${son.nom}.mp3`)).size;
  total += taille;
  console.log(`${fiche.sons[son.nom].duree.toFixed(1)} s, ${(taille / 1024).toFixed(0)} Ko`);
}
// (dans l'ordre de la recette)
fiche.sons = Object.fromEntries(SONS.filter((s) => fiche.sons[s.nom]).map((s) => [s.nom, fiche.sons[s.nom]]));
fs.writeFileSync(cheminFiche, JSON.stringify(fiche, null, 1));
console.log(`\n${aFaire.length} sons, ${(total / 1024 / 1024).toFixed(1)} Mo en tout, dans ${SORTIE}/`);
