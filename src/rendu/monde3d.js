// Le monde en 3D : tout ce qu'il faut pour dessiner la mer et le ciel, réuni en un
// seul objet que l'atelier et le jeu utilisent de la même façon.
import * as THREE from 'three';
import { Houle } from '../mer/houle.js';
import { Ciel } from './ciel.js';
import { Eau } from './eau.js';
import { Post } from './post.js';
import { eclairage, etalonnage, etatMer, angleVers, NOEUD } from '../monde/meteo.js';
import { Bateau } from '../bateau/bateau.js';
import { Pluie } from './pluie.js';
import { Eclairs } from './eclairs.js';
import { Cote } from './cote.js';
import { Embruns } from './embruns.js';
import { Deferlantes3D } from './deferlantes.js';
import { Gouttes } from './gouttes.js';
import { Cargo3D } from './cargo.js';
import { Trombe3D } from './trombe.js';

// Les niveaux de qualité de l'image (les options du jeu) : la finesse de l'image (au plus
// tant de pixels par point de l'écran), l'anticrénelage, la taille de la carte des
// ombres, les nuages (leur résolution et le nombre de pas pour les traverser), le
// nombre de rayons de la toile d'araignée de la mer, la pluie et les embruns.
export const QUALITES = {
  economique: { nom: 'Économique', pixels: 1, msaa: 0, ombres: 1024, nuages: 0.34, pas: 22, mer: 256, pluie: 0.45, particules: 0.4 },
  moyenne: { nom: 'Moyenne', pixels: 1.25, msaa: 2, ombres: 2048, nuages: 0.42, pas: 28, mer: 320, pluie: 0.7, particules: 0.7 },
  haute: { nom: 'Haute', pixels: 1.5, msaa: 4, ombres: 2048, nuages: 0.5, pas: 36, mer: 384, pluie: 1, particules: 1 },
  superbe: { nom: 'Superbe', pixels: 2, msaa: 4, ombres: 4096, nuages: 0.6, pas: 44, mer: 448, pluie: 1, particules: 1 },
};

export class Monde3D {
  constructor(canvas, { graine = 4, ratioPixelsMax = 1.5 } = {}) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.autoClear = false; // on efface nous-mêmes (le halo s'additionne image après image)
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.ratioPixelsMax = ratioPixelsMax;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 40000);
    this.houle = new Houle({ graine });
    this.ciel = new Ciel(this.renderer);
    this.eau = new Eau(this.renderer, this.houle, this.ciel);
    this.post = new Post(this.renderer);
    this.scene.add(this.ciel.fond, this.eau.mesh);
    // la côte de Kervalen, au nord, à l'horizon
    this.cote = new Cote(this.scene, this.eau);

    // La lumière directe (le soleil le jour, la lune la nuit) : elle seule fait des
    // ombres nettes, calculées sur une petite zone autour du bateau
    this.lumiere = new THREE.DirectionalLight(0xffffff, 1);
    this.lumiere.castShadow = true;
    const ombre = this.lumiere.shadow;
    ombre.mapSize.set(2048, 2048);
    ombre.camera.left = -9;
    ombre.camera.right = 9;
    ombre.camera.top = 9;
    ombre.camera.bottom = -9;
    ombre.camera.near = 1;
    ombre.camera.far = 80;
    ombre.bias = -0.0004;
    ombre.normalBias = 0.025;
    ombre.radius = 2;
    this.scene.add(this.lumiere, this.lumiere.target);
    // l'éclair éclaire tout d'un coup, d'une direction (sans ombres : trop bref pour les voir)
    this.lumiereEclair = new THREE.DirectionalLight(0xc8d4ff, 0);
    this.scene.add(this.lumiereEclair, this.lumiereEclair.target);
    // la lampe frontale du marin (la nuit)
    // (les lumières restent toujours « visibles », avec une intensité nulle quand elles
    // sont éteintes : sinon Three recompile tous les matériaux à chaque changement)
    this.lampe = new THREE.SpotLight(0xffe8c8, 0, 35, THREE.MathUtils.degToRad(32), 0.85, 1.5);
    this.scene.add(this.lampe, this.lampe.target);
    this.pluie = new Pluie();
    this.eclairs = new Eclairs();
    this.scene.add(this.pluie.mesh, this.eclairs.groupe);
    // la tempête : les embruns, les déferlantes qu'on voit venir, l'eau sur l'objectif
    this.embruns = new Embruns(this.scene);
    this.deferlantes = new Deferlantes3D(this.scene, this.houle, this.eau, this.embruns);
    this.gouttes = new Gouttes();
    this.post.reglages.uGouttes.value = this.gouttes.texture;
    this.dansLaCabine = false; // (le jeu le dit : dedans, pas de gouttes sur l'objectif)
    this.gouttesActives = true; // (les options : on peut ne pas en vouloir)
    // le cargo et la trombe de la nuit (le jeu donne leur état : jeu/nuit.js)
    this.cargo = new Cargo3D(this.scene, this.houle, this.eau);
    this.trombe = new Trombe3D(this.scene, this.houle, this.eau, this.ciel, this.embruns);
    this.etatCargo = null;
    this.etatTrombe = null;
    this.bateau = null;

    this.temps = 0;
    this.eclair = { intensite: 0, prochain: 4, flashs: [] };
    this.mesures = { houleMs: 0, imageMs: 0, ips: 0 };
    this._compteur = { images: 0, depuis: performance.now() };
    this.redimensionner();
    addEventListener('resize', () => this.redimensionner());
  }

  // Change la qualité de l'image (voir QUALITES)
  appliquerQualite(nom) {
    const q = QUALITES[nom] ?? QUALITES.haute;
    this.qualite = nom;
    this.ratioPixelsMax = q.pixels;
    this.post.changerEchantillons(q.msaa);
    const ombre = this.lumiere.shadow;
    if (ombre.mapSize.x !== q.ombres) {
      ombre.mapSize.set(q.ombres, q.ombres);
      ombre.map?.dispose();
      ombre.map = null;
    }
    this.ciel.echelleNuages = q.nuages;
    this.ciel.passeNuages.materiau.uniforms.uPas.value = q.pas;
    this.eau.changerDensite(q.mer);
    this.pluie.facteur = q.pluie;
    this.embruns.facteur = q.particules;
    this.redimensionner();
  }

  // Prépare (compile) les shaders de tout ce qui n'apparaît que plus tard : le cargo, la
  // trombe, les déferlantes, les embruns, l'eau embarquée, la grand-voile ferlée
  async precompiler() {
    const caches = [];
    const montrer = (o) => {
      if (o && !o.visible) {
        caches.push(o);
        o.visible = true;
      }
    };
    for (const o of [this.cargo.groupe, this.trombe.groupe, this.embruns.mesh, ...this.deferlantes.cretes.map((c) => c.mesh)]) montrer(o);
    if (this.bateau) {
      montrer(this.bateau.eauABord.cockpit.mesh);
      montrer(this.bateau.eauABord.cabine.mesh);
      montrer(this.bateau.voileFerlee);
    }
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } finally {
      for (const o of caches) o.visible = false;
    }
  }

  // allumer ou éteindre la lampe frontale
  lampeFrontale(allumee) {
    this.lampe.intensity = allumee ? 2.6 : 0;
  }

  ajouterBateau() {
    this.bateau = new Bateau();
    this.scene.add(this.bateau.groupe);
    return this.bateau;
  }

  // La lumière directe suit le soleil (ou la lune quand le soleil est couché)
  majLumiere(dt) {
    const e = this.ecl;
    const soleil = new THREE.Vector3().fromArray(e.soleil);
    const lune = new THREE.Vector3().fromArray(e.lune);
    const parLaLune = e.hauteurSoleil < -0.02;
    const dir = new THREE.Vector3().fromArray(parLaLune ? e.dirLune : e.dirSoleil);
    const couleur = parLaLune ? lune : soleil;
    // (convention de Three : la luminance d'un blanc éclairé vaut intensité / π)
    this.lumiere.color.setRGB(couleur.x, couleur.y, couleur.z);
    this.lumiere.intensity = Math.PI * (dir.y > -0.02 ? 1 : 0);
    const centre = this.bateau ? this.bateau.groupe.position : this.camera.position;
    this.lumiere.target.position.copy(centre);
    this.lumiere.position.copy(centre).addScaledVector(dir, 40);
    this.lumiere.target.updateMatrixWorld();
    if (this.bateau) {
      this.scene.environment = this.ciel.environnementPour(dt);
      this.bateau.voiles.eclairer(dir, new THREE.Color(couleur.x, couleur.y, couleur.z), this.camera);
    }
  }

  redimensionner() {
    const r = this.renderer;
    const canvas = r.domElement;
    const largeur = canvas.clientWidth || innerWidth;
    const hauteur = canvas.clientHeight || innerHeight;
    r.setPixelRatio(Math.min(devicePixelRatio, this.ratioPixelsMax));
    r.setSize(largeur, hauteur, false);
    this.camera.aspect = largeur / hauteur;
    this.camera.updateProjectionMatrix();
    const taille = r.getDrawingBufferSize(new THREE.Vector2());
    this.post.redimensionner(taille.x, taille.y);
    this.ciel.redimensionner(taille.x, taille.y);
    this.camera.userData.hauteurPixels = taille.y;
    if (this.gouttes) {
      this.gouttes.redimensionner(taille.x, taille.y);
      this.post.reglages.uGouttes.value = this.gouttes.texture;
    }
  }

  // Change le temps qu'il fait. recalculerMer : la mer change de forme (coûte ~5 ms)
  regler(meteo, { recalculerMer = true, brusque = true } = {}) {
    this.meteo = meteo;
    if (recalculerMer) this.houle.regler(etatMer(meteo));
    if (brusque && recalculerMer) this.houle.effacerEcume();
    this.ecl = eclairage(meteo);
    this.ciel.regler(meteo, this.ecl, this.temps, { brusque });
    this.eau.regler(meteo, this.ecl);
    const r = this.post.reglages;
    r.uExposition.value = this.ecl.exposition;
    const e = etalonnage(meteo, this.ecl);
    this.etalonnage = e;
    r.uSaturation.value = e.saturation;
    r.uContraste.value = e.contraste;
    r.uBalance.value.fromArray(e.balance);
    r.uVignettage.value = e.vignettage;
  }

  // Les éclairs : des flashs groupés par deux ou trois, de plus en plus fréquents avec l'orage
  majEclairs(dt) {
    const e = this.eclair;
    const orage = this.meteo.orage;
    e.intensite = 0;
    if (orage > 0.5) {
      e.prochain -= dt * (orage - 0.4);
      if (e.prochain <= 0) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 2000 + Math.random() * 9000;
        const centre = new THREE.Vector3(
          this.camera.position.x + Math.cos(angle) * distance,
          this.ciel.uniformsNuages.uBaseNuages.value + 400 + Math.random() * 1200,
          this.camera.position.z + Math.sin(angle) * distance,
        );
        const debut = this.temps;
        const nb = 1 + Math.floor(Math.random() * 3);
        // un éclair sur deux descend jusqu'à la mer (on voit le trait) ; les autres
        // restent dans le nuage, qu'ils illuminent de l'intérieur
        const cle = Math.floor(Math.random() * 1e9);
        const visible = Math.random() < 0.55;
        this.surEclair?.(distance, visible);
        for (let i = 0; i < nb; i++) {
          e.flashs.push({ centre, cle, visible, debut: debut + i * (0.06 + Math.random() * 0.12), force: 0.6 + Math.random() * 0.9, proche: distance < 5000 });
        }
        e.prochain = 1.5 + Math.random() * 7;
      }
    }
    let centre = null;
    let actif = null;
    e.flashs = e.flashs.filter((f) => this.temps - f.debut < 0.4);
    for (const f of e.flashs) {
      const age = this.temps - f.debut;
      if (age < 0) continue;
      const v = f.force * Math.exp(-age * 18) * (age < 0.02 ? age / 0.02 : 1);
      if (v > e.intensite) { e.intensite = v; centre = f.centre; actif = f; }
    }
    this.ciel.eclair(centre ?? new THREE.Vector3(), e.intensite);
    this.eau.uniforms.uEclair.value = e.intensite * 0.25;
    this.post.reglages.uFlash.value = e.intensite * 0.006;
    this.eclairs.maj(actif, e.intensite, this.renderer.getDrawingBufferSize(new THREE.Vector2()));
    if (centre) {
      this.lumiereEclair.position.copy(centre);
      this.lumiereEclair.target.position.copy(this.camera.position);
      this.lumiereEclair.target.updateMatrixWorld();
    }
    this.lumiereEclair.intensity = e.intensite * 1.3;
  }

  // Une image : la mer avance, le ciel se prépare, on dessine
  // simuler : appelé une fois la houle calculée, pour faire bouger le bateau
  //   (flottaison simple dans l'atelier, vraie physique dans le jeu)
  // placerCamera : appelé une fois le bateau bougé (sinon la caméra a une image de retard)
  image(dt, { toutLeCube = false, placerCamera = null, simuler = null } = {}) {
    const debut = performance.now();
    this.temps += dt;
    const m = this.meteo;
    const t0 = performance.now();
    this.houle.calculer(this.temps, dt);
    this.mesures.houleMs = this.mesures.houleMs * 0.95 + (performance.now() - t0) * 0.05;

    this.ciel.uniformsNuages.uTemps.value = this.temps;
    // les nuages vont avec le vent (plus vite en altitude)
    this.ciel.deriver(dt, m.vent * NOEUD * 1.6 + 3, angleVers(m.directionVent));
    this.majEclairs(dt);
    this.post.reglages.uTemps.value = this.temps;
    this.cote.maj(this.temps, this.ecl.nuit);

    if (this.bateau) {
      if (simuler) simuler(dt);
      else this.bateau.flotter(dt, this.houle);
      this.bateau.maj(dt);
      this.bateau.groupe.updateMatrixWorld();
      this.eau.suivreBateau(this.bateau.groupe);
      // la cabine : ses lumières sont dans le repère du bateau
      this.bateau.interieur.suivre(this.bateau.groupe);
      this.bateau.interieur.fixerEnvironnement(this.scene.environment);
    }
    placerCamera?.(dt);
    this.camera.updateMatrixWorld();
    this.majLumiere(dt);
    const vent = new THREE.Vector3(Math.cos(angleVers(m.directionVent)), 0, Math.sin(angleVers(m.directionVent))).multiplyScalar(m.vent * NOEUD);
    this.pluie.maj(this.temps, this.camera, {
      intensite: m.pluie, vent, ambiance: new THREE.Vector3().fromArray(this.ecl.ambiance), eclair: this.eclair.intensite,
      lampe: this.lampe,
    });
    // la lampe frontale suit le regard
    const regard = this.camera.getWorldDirection(new THREE.Vector3());
    this.lampe.position.copy(this.camera.position);
    this.lampe.target.position.copy(this.camera.position).addScaledVector(regard, 10);
    this.lampe.target.updateMatrixWorld();
    // la tempête : les déferlantes qui arrivent, les embruns, les gouttes sur l'objectif
    const ambiance = new THREE.Vector3().fromArray(this.ecl.ambiance);
    const centre = this.bateau ? this.bateau.groupe.position : this.camera.position;
    this.deferlantes.maj(dt, this.temps, centre, { nuit: this.ecl.nuit, vent });
    this.embruns.maj(dt, {
      vent, camera: this.camera, lampe: this.lampe, ambiance, eclair: this.eclair.intensite, nuit: this.ecl.nuit,
      niveauEau: centre.y - 3,
    });
    this.cargo.maj(this.etatCargo, this.camera);
    this.trombe.maj(dt, this.etatTrombe, { temps: this.temps, directionVent: angleVers(m.directionVent) });
    const face = Math.max(0, -regard.dot(vent.clone().normalize()));
    this.gouttes.maj(dt, { pluie: m.pluie * Math.min(1, m.vent / 20), face, dehors: !this.dansLaCabine });
    this.post.reglages.uForceGouttes.value = this.dansLaCabine || !this.gouttesActives ? 0 : 1;
    this.eau.preparer(this.camera);
    this.ciel.preparer(this.camera, { toutLeCube });
    this.post.rendre(this.scene, this.camera);

    this.mesures.imageMs = this.mesures.imageMs * 0.95 + (performance.now() - debut) * 0.05;
    const c = this._compteur;
    c.images++;
    const maintenant = performance.now();
    if (maintenant - c.depuis > 1000) {
      this.mesures.ips = (c.images * 1000) / (maintenant - c.depuis);
      c.images = 0;
      c.depuis = maintenant;
    }
  }

  // Photo de ce qui est à l'écran (à appeler juste après image(), dans la même tâche)
  photo(type = 'image/jpeg', qualite = 0.92) {
    return this.renderer.domElement.toDataURL(type, qualite);
  }
}
