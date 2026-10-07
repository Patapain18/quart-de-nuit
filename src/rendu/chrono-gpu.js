// Le chronomètre de la carte graphique : combien de temps elle passe sur chaque morceau
// de l'image (la mer, le ciel, la trombe, la scène…).
//
// La carte graphique travaille en décalé : quand le programme lui demande de dessiner, elle
// le fera un peu plus tard. Mesurer l'horloge du programme ne dit donc rien de son travail.
// WebGL 2 sait lui poser des « requêtes de minutage » (EXT_disjoint_timer_query_webgl2) :
// elle note elle-même le temps passé entre deux repères, et on lit la réponse quelques
// images plus tard. Une seule requête à la fois : les morceaux mesurés se suivent, ils ne
// s'emboîtent pas.
export class ChronoGPU {
  constructor(gl) {
    this.gl = gl;
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.disponible = !!this.ext;
    this.actif = false;
    this.enCours = []; // les requêtes dont on attend la réponse
    this.mesures = {}; // nom → liste des durées (ms)
  }

  // Mesure ce que f() demande à la carte graphique
  mesurer(nom, f) {
    if (!this.actif || !this.ext) return f();
    const gl = this.gl;
    const requete = gl.createQuery();
    gl.beginQuery(this.ext.TIME_ELAPSED_EXT, requete);
    try {
      return f();
    } finally {
      gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      this.enCours.push({ nom, requete });
    }
  }

  // Relève les réponses arrivées (à appeler à chaque image)
  relever() {
    if (!this.ext || !this.enCours.length) return;
    const gl = this.gl;
    // (si la carte graphique a été interrompue, les mesures en cours ne valent rien)
    const interrompue = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    this.enCours = this.enCours.filter(({ nom, requete }) => {
      if (!gl.getQueryParameter(requete, gl.QUERY_RESULT_AVAILABLE)) return true;
      if (!interrompue) (this.mesures[nom] ??= []).push(gl.getQueryParameter(requete, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(requete);
      return false;
    });
  }

  vider() {
    this.mesures = {};
  }

  // La moyenne (et le pire) de chaque morceau, en millisecondes
  bilan() {
    const b = {};
    for (const [nom, liste] of Object.entries(this.mesures)) {
      const tri = [...liste].sort((a, c) => a - c);
      b[nom] = {
        moyenne: liste.reduce((s, v) => s + v, 0) / liste.length,
        mediane: tri[Math.floor(tri.length / 2)],
        pire: tri.at(-1),
        n: liste.length,
      };
    }
    return b;
  }
}
