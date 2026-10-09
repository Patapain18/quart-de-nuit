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
import { EclairsRendu } from './eclairs.js';
import { Foudre, lumiereEclair } from '../monde/foudre.js';
import { Cote } from './cote.js';
import { FeuxRendu } from './feux.js';
import { Embruns } from './embruns.js';
import { Deferlantes3D } from './deferlantes.js';
import { Scelerate3D } from './scelerate.js';
import { Gouttes } from './gouttes.js';
import { Cargo3D } from './cargo.js';
import { Trombe3D } from './trombe.js';
import { LumiereEtrange } from './lumiere-etrange.js';
import { SaintElme } from './saint-elme.js';
import { ChronoGPU } from './chrono-gpu.js';
import { REGLAGES_GRAINS } from '../monde/grains.js';

// Les niveaux de qualité de l'image (les options du jeu) : la finesse de l'image (au plus
// tant de pixels par point de l'écran), l'anticrénelage, la taille de la carte des
// ombres, les nuages (leur résolution et le nombre de pas pour les traverser), le
// nombre de rayons de la toile d'araignée de la mer, la pluie et les embruns.
// (trombe : la taille de son volume par rapport à l'écran, le nombre de pas pour le
// traverser, et si la matière fait de l'ombre sur elle-même)
export const QUALITES = {
  economique: { nom: 'Économique', pixels: 1, msaa: 0, ombres: 1024, nuages: 0.34, pas: 22, mer: 256, pluie: 0.45, particules: 0.4, trombe: { echelle: 0.33, pas: 72, ombres: false } },
  moyenne: { nom: 'Moyenne', pixels: 1.25, msaa: 2, ombres: 2048, nuages: 0.42, pas: 28, mer: 320, pluie: 0.7, particules: 0.7, trombe: { echelle: 0.4, pas: 96, ombres: true } },
  haute: { nom: 'Haute', pixels: 1.5, msaa: 4, ombres: 2048, nuages: 0.5, pas: 36, mer: 384, pluie: 1, particules: 1, trombe: { echelle: 0.5, pas: 128, ombres: true } },
  superbe: { nom: 'Superbe', pixels: 2, msaa: 4, ombres: 4096, nuages: 0.6, pas: 44, mer: 448, pluie: 1, particules: 1, trombe: { echelle: 0.6, pas: 160, ombres: true } },
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
    // (les vagues sont calculées dans un fil à part : 2,6 ms de moins par image ici)
    this.houle = new Houle({ graine, fil: true });
    this.ciel = new Ciel(this.renderer);
    this.eau = new Eau(this.renderer, this.houle, this.ciel);
    this.post = new Post(this.renderer);
    this.scene.add(this.ciel.fond, this.eau.mesh);
    // la côte de Kervalen, au nord, à l'horizon, et ses feux (le phare, le port, la bouée)
    this.cote = new Cote(this.scene, this.eau);
    this.feux = new FeuxRendu(this.scene, this.houle, this.ciel.grains.uniforms);

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
    this.eclairs = new EclairsRendu();
    this.scene.add(this.pluie.mesh, this.eclairs.groupe);
    // la tempête : les embruns, les déferlantes qu'on voit venir, l'eau sur l'objectif
    this.embruns = new Embruns(this.scene);
    this.deferlantes = new Deferlantes3D(this.scene, this.houle, this.eau, this.embruns);
    // (la vague scélérate : sa forme est dans la mer ; ici, la lèvre de sa crête)
    this.scelerate = new Scelerate3D(this.scene, this.houle, this.eau, this.embruns);
    this.gouttes = new Gouttes();
    this.post.reglages.uGouttes.value = this.gouttes.texture;
    this.dansLaCabine = false; // (le jeu le dit : dedans, pas de gouttes sur l'objectif)
    this.noirMax = 1; // (le noir d'encre de la nuit d'orage : 1 ; moins, pour un écran peu lumineux)
    this.gouttesActives = true; // (les options : on peut ne pas en vouloir)
    // le cargo et la trombe de la nuit (le jeu donne leur état : jeu/nuit.js)
    this.cargo = new Cargo3D(this.scene, this.houle, this.eau);
    this.trombe = new Trombe3D(this.scene, this.houle, this.eau, this.ciel, this.embruns);
    // (l'étrange : une lumière sur l'eau, au loin, que personne n'explique)
    this.lumiereEtrange = new LumiereEtrange(this.scene, this.houle);
    // (le feu de Saint-Elme, en tête de mât, quand l'air est chargé d'électricité)
    this.saintElme = new SaintElme(this.scene);
    this.etatCargo = null;
    this.etatTrombe = null;
    // les grains (monde/grains.js : le jeu donne ceux de la nuit, ou ceux du décor) ; et ce
    // qu'ils font là où est la caméra (la pluie qui tombe ici, leur vent…)
    this.etatGrains = null;
    // les risées (monde/risees.js : le jeu donne celles qui vivent autour du bateau)
    this.etatRisees = null;
    this.ici = { pluie: 0, agitation: 0, ombre: 0, approche: 0, vent: { x: 0, y: 0, z: 0 }, grain: null };
    this.bateau = null;
    this.aPrecompiler = []; // (d'autres objets qui n'apparaissent que plus tard : le jeu les ajoute)

    this.temps = 0;
    // le chronomètre (l'atelier des performances) : le temps passé dans chaque morceau du
    // calcul, image par image ; gpu : on attend la carte graphique après chaque morceau
    // (plus lent, mais on voit son vrai travail)
    this.chrono = { actif: false, gpu: false, image: null, images: [] };
    // (le vrai temps de la carte graphique, morceau par morceau : chrono-gpu.js)
    this.chronoGPU = new ChronoGPU(this.renderer.getContext());
    // la foudre (monde/foudre.js : le jeu donne la sienne ; sinon, un atelier, le monde a la
    // sienne), et l'éclair du moment : son intensité, ce qu'il éclaire autour de nous, lui
    this.etatFoudre = null;
    this.foudreLocale = new Foudre(11);
    this.eclair = { intensite: 0, eclaire: 0, actif: null, centre: null, trait: null };
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
    this.trombe.reglerQualite(q.trombe);
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
    for (const o of [this.cargo.groupe, this.trombe.groupe, this.embruns.mesh, this.lumiereEtrange.sprite, this.scelerate.mesh, this.eclairs.groupe, this.saintElme.maille, ...this.aPrecompiler, ...this.deferlantes.cretes.map((c) => c.mesh), ...this.feux.faisceaux, ...this.feux.feux.flatMap((f) => [f.point, f.aureole])]) montrer(o);
    if (this.bateau) {
      montrer(this.bateau.eauABord.cockpit.mesh);
      montrer(this.bateau.eauABord.cabine.mesh);
      montrer(this.bateau.voileFerlee);
    }
    // (attention : le jeu dessine la scène dans l'image intermédiaire du développement,
    // en couleurs linéaires ; préparés pour l'écran, les shaders seraient les mauvais, et
    // compilés de nouveau en plein jeu — les petits gels)
    const r = this.renderer;
    const ancienne = r.getRenderTarget();
    try {
      // (les passes de la trombe, calculées hors de la scène)
      await this.trombe.precompiler(this.camera);
      r.setRenderTarget(this.post.cible);
      await r.compileAsync(this.scene, this.camera);
      // puis une vraie image, cachée (dans l'image intermédiaire, pas à l'écran) : elle
      // prépare aussi ce que la compilation oublie (les ombres, les deux passes des
      // surfaces transparentes vues des deux côtés)
      r.setRenderTarget(this.post.cible);
      r.render(this.scene, this.camera);
    } finally {
      r.setRenderTarget(ancienne);
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
    this.trombe?.redimensionner(taille.x, taille.y);
    this.camera.userData.hauteurPixels = taille.y;
    if (this.gouttes) {
      this.gouttes.redimensionner(taille.x, taille.y);
      this.post.reglages.uGouttes.value = this.gouttes.texture;
    }
  }

  // Change le temps qu'il fait. recalculerMer : la mer change de forme (coûte ~5 ms)
  regler(meteo, { recalculerMer = true, brusque = true } = {}) {
    this.mesurer(recalculerMer ? 'regler (mer)' : 'regler', () => this.reglerSansMesure(meteo, { recalculerMer, brusque }));
  }

  reglerSansMesure(meteo, { recalculerMer, brusque }) {
    this.meteo = meteo;
    if (recalculerMer) this.houle.regler(etatMer(meteo), { progressif: !brusque });
    if (brusque && recalculerMer) this.houle.effacerEcume();
    // (noirMax : les options peuvent adoucir le noir d'encre de la nuit d'orage)
    this.ecl = eclairage(this.noirMax < 1 ? { ...meteo, noirMax: this.noirMax } : meteo);
    this.ciel.regler(meteo, this.ecl, this.temps, { brusque });
    // (la pluie des grains a ses propres rideaux : la brume ne compte que celle de partout)
    this.eau.regler(meteo, this.ecl, { pluie: this.etatGrains ? meteo.pluie * REGLAGES_GRAINS.pluieFond : meteo.pluie });
    const r = this.post.reglages;
    r.uExposition.value = this.ecl.exposition;
    const e = etalonnage(meteo, this.ecl);
    this.etalonnage = e;
    r.uSaturation.value = e.saturation;
    r.uContraste.value = e.contraste;
    r.uBalance.value.fromArray(e.balance);
    r.uVignettage.value = e.vignettage;
  }

  // Les éclairs : monde/foudre.js dit où et quand ils partent (des nuages d'orage : les
  // grains, le nuage de la bête, le front au loin) ; on dessine le plus fort du moment —
  // son trait, s'il descend sous les nuages ; le nuage qu'il allume de l'intérieur, tout
  // le long de son trajet ; la pluie que son trait traverse ; la mer, où il se reflète et
  // qu'il allume à son pied ; le bateau, qu'il éclaire de son côté.
  majEclairs(dt) {
    let foudre = this.etatFoudre;
    if (!foudre) {
      // (un atelier : la foudre vit ici, avec les grains et la trombe qu'on donne au monde ;
      // sans grains, elle a ses propres nuages d'orage, qu'on ne voit pas)
      foudre = this.foudreLocale;
      const cam = this.camera.position;
      const b = this.bateau?.groupe.position ?? cam;
      foudre.maj(dt, { meteo: this.meteo, grains: this.etatGrains, trombe: this.etatTrombe, x: b.x, z: b.z, ecoute: cam });
      for (const ev of foudre.evenements) this.surFoudre?.(ev);
    }
    const t = foudre.t;
    const doux = this.eclairsDoux;
    const l = (this._lumiere ??= {});
    let actif = null;
    let v = 0;
    let k = -1;
    let eclaire = 0;
    let front = null;
    let vFront = 0;
    // (un éclair figé à son plus fort : l'atelier des éclairs, pour ses photos et ses mesures)
    const fige = this.eclairFige;
    if (fige) {
      actif = fige.eclair;
      v = fige.v;
      k = fige.eclat ?? 0;
      eclaire = v * actif.eclaire;
    }
    for (const x of fige ? [] : foudre.eclairs) {
      if (t < x.t0) continue;
      lumiereEclair(x, t, doux, l);
      if (x.type === 'front') {
        if (l.v > vFront) {
          vFront = l.v;
          front = x;
        }
        continue;
      }
      eclaire = Math.max(eclaire, l.v * x.eclaire);
      if (l.v > v) {
        v = l.v;
        actif = x;
        k = l.k;
      }
    }
    // (le trait reste lumineux un peu plus longtemps que l'éclair n'éclaire tout : le courant
    // continue de passer ; l'araignée, elle, s'allume en courant)
    let trait = 0;
    if (actif?.visible) {
      if (doux || fige || actif.type === 'araignee') trait = v;
      else {
        for (const ec of actif.eclats) {
          const age = t - ec.t;
          if (age < 0) break;
          trait = Math.max(trait, ec.force * Math.exp(-age * 10) * (age < 0.02 ? age / 0.02 : 1));
        }
      }
    }
    const e = this.eclair;
    e.intensite = v;
    e.eclaire = eclaire;
    e.actif = actif;
    e.centre = actif?.proche ?? null;
    // (le trait d'un éclair qui tombe : il traverse la pluie, de la base du nuage à la mer)
    e.trait = actif ? (actif.bas ? [actif.type === 'araignee' ? actif.bout : actif.haut, actif.bas] : actif.nuage) : null;
    this.ciel.eclair(actif?.nuage[0], actif?.nuage[1], v, actif?.type === 'araignee' ? 550 : 750);
    const base = this.ciel.uniformsNuages.uBaseNuages.value;
    this.eclairs.maj(actif, {
      trait, eclat: k, age: fige ? 1 : actif ? t - actif.t0 : 0,
      resolution: this.renderer.getDrawingBufferSize(this._taille ??= new THREE.Vector2()),
      camera: this.camera, base, brume: this.eau.uniforms.uBrume.value, grains: this.etatGrains, mat: this.teteDeMat(),
    });
    const ue = this.eau.uniforms;
    ue.uEclair.value = eclaire * 0.25;
    this.post.reglages.uFlash.value = eclaire * 0.006;
    if (actif) {
      const p = actif.proche;
      ue.uDirEclair.value.set(p.x, p.y, p.z).sub(this.camera.position).normalize();
      this.lumiereEclair.position.set(p.x, p.y, p.z);
      this.lumiereEclair.target.position.copy(this.camera.position);
      this.lumiereEclair.target.updateMatrixWorld();
    }
    this.lumiereEclair.intensity = eclaire * 1.3;
    // son trait se reflète dans la mer, et son pied l'allume
    if (actif?.bas && trait > 0.01) {
      ue.uEclairTrait.value.set(actif.bas.x, actif.bas.z, base, trait * 2);
      ue.uEclairImpact.value.set(actif.bas.x, actif.bas.y + 25, actif.bas.z, trait * 6e4);
    } else {
      ue.uEclairTrait.value.w = 0;
      ue.uEclairImpact.value.w = 0;
    }
    // le front, au loin : une boule de ses nuages s'allume
    const uf = this.ciel.uniformsFront;
    if (front) uf.uFrontEclair.value.set(front.az, front.el, front.rayon, vFront * uf.uFront.value.w);
    else uf.uFrontEclair.value.w = 0;
  }

  // La foudre du moment (celle du jeu, ou celle du monde dans un atelier)
  get foudre() { return this.etatFoudre ?? this.foudreLocale; }

  // Un éclair tout de suite, au-dessus du point (x, z) du monde, en trois éclats (pour
  // montrer une vague scélérate : derrière elle, sa crête noire se découpe sur le ciel)
  eclairSur(x, z) {
    return this.foudre.eclairSur(x, z);
  }

  // Où est la tête du mât, dans le monde (là où la foudre tombe, quand elle tombe sur nous)
  teteDeMat(sortie = (this._tete ??= new THREE.Vector3())) {
    if (!this.bateau) return null;
    const m = this.bateau.mesures;
    return this.bateau.groupe.localToWorld(sortie.set(0, m.tete + 0.3, m.zMat));
  }

  // (le chronomètre : mesure une partie du calcul, si on l'a demandé)
  mesurer(nom, f) {
    if (this.chronoGPU.actif) return this.chronoGPU.mesurer(nom, f);
    const c = this.chrono;
    if (!c.actif || !c.image) return f();
    const gl = this.renderer.getContext();
    if (c.gpu) gl.finish();
    const t0 = performance.now();
    const r = f();
    if (c.gpu) gl.finish();
    c.image[nom] = (c.image[nom] ?? 0) + performance.now() - t0;
    return r;
  }

  // Une image : la mer avance, le ciel se prépare, on dessine
  // simuler : appelé une fois la houle calculée, pour faire bouger le bateau
  //   (flottaison simple dans l'atelier, vraie physique dans le jeu)
  // placerCamera : appelé une fois le bateau bougé (sinon la caméra a une image de retard)
  image(dt, { toutLeCube = false, placerCamera = null, simuler = null } = {}) {
    const debut = performance.now();
    const chrono = this.chrono;
    if (chrono.actif) chrono.image = { temps: this.temps };
    this.chronoGPU.relever();
    this.temps += dt;
    const m = this.meteo;
    const t0 = performance.now();
    this.mesurer('houle', () => this.houle.calculer(this.temps, dt));
    this.mesures.houleMs = this.mesures.houleMs * 0.95 + (performance.now() - t0) * 0.05;

    this.ciel.uniformsNuages.uTemps.value = this.temps;
    // les nuages vont avec le vent (plus vite en altitude)
    this.ciel.deriver(dt, m.vent * NOEUD * 1.6 + 3, angleVers(m.directionVent));
    this.majEclairs(dt);
    this.post.reglages.uTemps.value = this.temps;

    if (this.bateau) {
      this.mesurer('simulation', () => {
        if (simuler) simuler(dt);
        else this.bateau.flotter(dt, this.houle);
      });
      this.mesurer('bateau', () => {
        this.bateau.maj(dt);
        this.bateau.groupe.updateMatrixWorld();
        this.eau.suivreBateau(this.bateau.groupe, this.temps, dt);
        this.bateau.paquet?.maj(dt, this.bateau.groupe, this.ecl.nuit);
        this.eau.uniforms.uPlancton.value = this.ecl.nuit;
        // la cabine : ses lumières sont dans le repère du bateau
        this.bateau.interieur.suivre(this.bateau.groupe);
        this.bateau.interieur.fixerEnvironnement(this.scene.environment);
      });
    }
    placerCamera?.(dt);
    this.camera.updateMatrixWorld();
    // les feux de la côte : ce qu'on en voit d'ici (la distance, la brume, la pluie entre eux
    // et nous, la crête des vagues devant)
    this.mesurer('feux', () => this.feux.maj(dt, { temps: this.temps, camera: this.camera, meteo: m, grains: this.etatGrains, hauteurSoleil: this.ecl.hauteurSoleil }));
    // le feu de Saint-Elme, en tête de mât : sous un nuage d'orage, dans le noir
    const s = THREE.MathUtils.smoothstep;
    this.saintElme.maj(dt, this.temps, s(this.foudre.champ, 0.55, 0.85) * s(this.ecl.nuit, 0.3, 0.8), this.teteDeMat(), this.camera);
    this.mesurer('lumiere', () => this.majLumiere(dt));
    const vent = new THREE.Vector3(Math.cos(angleVers(m.directionVent)), 0, Math.sin(angleVers(m.directionVent))).multiplyScalar(m.vent * NOEUD);
    // les grains : ce qu'ils font ici (la pluie qui tombe sur nous, leur vent), et ce que les
    // shaders doivent savoir d'eux (leurs rideaux de pluie, leurs rafales, leur nuage)
    const grains = this.etatGrains;
    const ici = this.ici;
    const cam = this.camera.position;
    if (grains) grains.mesurer(cam.x, cam.z, ici);
    else {
      Object.assign(ici, { pluie: m.pluie, agitation: 0, ombre: 0, approche: 0, grain: null });
      ici.vent.x = 0;
      ici.vent.z = 0;
    }
    this.ciel.grains.maj(dt, grains, this.camera, { base: this.ciel.uniformsNuages.uBaseNuages.value, temps: this.temps, ecl: this.ecl, eclair: this.eclair });
    // (la pluie penche avec le vent d'ici : celui du moment, et celui du grain)
    const ventIci = new THREE.Vector3(vent.x + ici.vent.x, 0, vent.z + ici.vent.z);
    this.pluie.maj(this.temps, this.camera, {
      intensite: ici.pluie, vent: ventIci, ambiance: new THREE.Vector3().fromArray(this.ecl.ambiance), eclair: this.eclair.eclaire,
      lampe: this.lampe,
      versBateau: this.bateau ? this.eau.uniforms.uBateauInverse.value : null,
    });
    // la lampe frontale suit le regard
    const regard = this.camera.getWorldDirection(new THREE.Vector3());
    this.lampe.position.copy(this.camera.position);
    this.lampe.target.position.copy(this.camera.position).addScaledVector(regard, 10);
    this.lampe.target.updateMatrixWorld();
    // (la mer reçoit la lumière du bord : la frontale, les feux de navigation)
    this.eau.eclairerParLeBord(this.lampe, this.bateau?.feux ?? []);
    // la tempête : les déferlantes qui arrivent, les embruns, les gouttes sur l'objectif
    const ambiance = new THREE.Vector3().fromArray(this.ecl.ambiance);
    const centre = this.bateau ? this.bateau.groupe.position : this.camera.position;
    this.deferlantes.maj(dt, this.temps, centre, { nuit: this.ecl.nuit, vent });
    this.scelerate.maj(dt, this.temps, { centre: this.bateau ? centre : null, nuit: this.ecl.nuit, vent });
    this.embruns.maj(dt, {
      vent, camera: this.camera, lampe: this.lampe, ambiance, eclair: this.eclair.eclaire, nuit: this.ecl.nuit,
      niveauEau: centre.y - 3,
    });
    this.cargo.maj(this.etatCargo, this.camera);
    // (son sillage : c'est la mer qui le dessine)
    if (this.etatCargo) this.cargo.groupe.updateMatrixWorld();
    this.eau.suivreCargo(this.etatCargo ? this.cargo.groupe : null, this.temps, dt);
    this.trombe.maj(dt, this.etatTrombe, {
      temps: this.temps, directionVent: angleVers(m.directionVent), camera: this.camera, nuit: this.ecl.nuit, noir: this.ecl.noir ?? 0, eclaire: this.eclair.eclaire,
    });
    if (this.eau.brumeDeBase) this.eau.uniforms.uBrume.value = this.eau.brumeDeBase * (1 + 160 * this.trombe.brouillard ** 1.5);
    this.ciel.grains.uniforms.uRideauxReglages.value.z = this.eau.uniforms.uBrume.value;
    this.post.reglages.uEmbruns.value = this.dansLaCabine ? 0 : this.trombe.brouillard ** 1.5;
    this.lumiereEtrange.maj(dt, this.camera);
    // le faisceau de la lampe frontale se voit dans la pluie, les embruns, la brume
    const eauDansLAir = Math.min(1, ici.pluie * 0.8 + (this.embruns.densiteAutour ?? 0) + this.trombe.brouillard + m.brume * 0.3);
    this.post.reglages.uLampeVoile.value = this.lampe.intensity > 0 && !this.dansLaCabine ? 0.0045 * eauDansLAir * this.lampe.intensity : 0;
    const face = Math.max(0, -regard.dot(vent.clone().normalize()));
    this.gouttes.maj(dt, { pluie: ici.pluie * Math.min(1, m.vent / 20), face, dehors: !this.dansLaCabine });
    this.post.reglages.uForceGouttes.value = this.dansLaCabine || !this.gouttesActives ? 0 : 1;
    this.eau.risees.maj(dt, this.etatRisees, this.camera, m);
    this.mesurer('eau', () => this.eau.preparer(this.camera));
    this.mesurer('ciel', () => this.ciel.preparer(this.camera, { toutLeCube }));
    this.mesurer('trombe', () => this.trombe.preparer(this.camera));
    this.mesurer('rendu', () => this.post.rendre(this.scene, this.camera));

    if (chrono.actif && chrono.image) {
      chrono.image.total = performance.now() - debut;
      chrono.images.push(chrono.image);
      if (chrono.images.length > 30000) chrono.images.shift();
    }
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
