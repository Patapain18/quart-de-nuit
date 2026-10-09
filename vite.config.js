// Configuration de Vite (le serveur de développement et la fabrication du site).
//
// Le plugin « outils-dev » ne sert que pendant le développement (npm run dev) :
// - /__capture : enregistre une capture d'écran du jeu dans captures/ (pour comparer
//                les rendus, et me permettre de vérifier ce que je fais)
import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const TAILLE_MAX_CAPTURE = 40_000_000; // une capture pèse quelques Mo

function lireCorps(req, tailleMax) {
  return new Promise((resoudre, rejeter) => {
    let corps = '';
    req.on('data', (morceau) => {
      corps += morceau;
      if (corps.length > tailleMax) { rejeter(new Error('trop gros')); req.destroy(); }
    });
    req.on('end', () => resoudre(corps));
    req.on('error', rejeter);
  });
}

const outilsDev = {
  name: 'outils-dev',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__capture', async (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; return res.end('POST seulement'); }
      try {
        const { nom, image } = JSON.parse(await lireCorps(req, TAILLE_MAX_CAPTURE));
        const extension = String(image).startsWith('data:image/png') ? '.png' : '.jpg';
        // un nom sûr : lettres, chiffres, tirets (impossible d'écrire ailleurs que dans captures/)
        const fichier = path.join('captures', String(nom).replace(/[^\w-]/g, '') + extension);
        fs.mkdirSync('captures', { recursive: true });
        fs.writeFileSync(fichier, Buffer.from(String(image).split(',')[1], 'base64'));
        res.end(fichier);
      } catch {
        res.statusCode = 400;
        res.end('capture illisible');
      }
    });
  },
};

export default defineConfig({
  base: './',
  plugins: [outilsDev],
  server: { port: 5190, strictPort: true },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        accueil: path.resolve('index.html'),
        jeu: path.resolve('jeu.html'),
        atelierMer: path.resolve('atelier-mer.html'),
        atelierBateau: path.resolve('atelier-bateau.html'),
        atelierTempete: path.resolve('atelier-tempete.html'),
        atelierSon: path.resolve('atelier-son.html'),
        atelierTrombe: path.resolve('atelier-trombe.html'),
        atelierGrains: path.resolve('atelier-grains.html'),
        atelierRisees: path.resolve('atelier-risees.html'),
        atelierEclairs: path.resolve('atelier-eclairs.html'),
        atelierBarometre: path.resolve('atelier-barometre.html'),
        atelierFeux: path.resolve('atelier-feux.html'),
      },
    },
  },
});
