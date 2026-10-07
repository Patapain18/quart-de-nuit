// Assembler un film à partir des images enregistrées par l'atelier de la trombe
// (__trombe.film('nom') : captures/film-nom-0001.jpg, -0002.jpg…) :
//   node scripts/film.mjs nom [images par seconde] [--garder]
// → captures/film-nom.mp4 (H.264, lisible partout). Les images sont effacées ensuite,
// sauf avec --garder.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [nom, ipsTexte = '30'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const garder = process.argv.includes('--garder');
if (!nom || !/^[\w-]+$/.test(nom)) {
  console.error('Usage : node scripts/film.mjs nom [images par seconde] [--garder]');
  process.exit(1);
}
const ips = Number(ipsTexte) || 30;
const dossier = 'captures';
// (seulement film-nom-0001.jpg… : pas les images d'un autre film dont le nom commence pareil)
const motif = new RegExp(`^film-${nom}-\\d{4}\\.jpg$`);
const images = fs.readdirSync(dossier).filter((f) => motif.test(f)).sort();
if (!images.length) {
  console.error(`Aucune image captures/film-${nom}-XXXX.jpg`);
  process.exit(1);
}
const sortie = path.join(dossier, `film-${nom}.mp4`);
const r = spawnSync('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-framerate', String(ips),
  '-i', path.join(dossier, `film-${nom}-%04d.jpg`),
  // (1280 pixels de large au plus, dimensions paires, couleurs lisibles par tous les
  // lecteurs, bonne qualité pour un fichier léger)
  '-vf', 'scale=min(1280\\,iw):-2',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-preset', 'slow', '-movflags', '+faststart',
  sortie,
], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);
if (!garder) for (const f of images) fs.unlinkSync(path.join(dossier, f));
const taille = fs.statSync(sortie).size;
console.log(`${sortie} : ${images.length} images, ${(images.length / ips).toFixed(1)} s, ${(taille / 1e6).toFixed(1)} Mo`);
