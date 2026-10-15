/**
 * Parsing de CV — PDF vers profil structuré.
 *
 * Porté depuis `cv_parser.py`. La démarche reste la même : on extrait le
 * texte, on le nettoie des artefacts d'extraction, puis on repère des
 * sections et des entités par motifs.
 *
 * Choix assumé : c'est du repérage par motifs, pas du NLP. C'est imparfait
 * mais prévisible, rapide, gratuit, et suffisant — les compétences trouvées
 * alimentent un scoring qui reste lisible et ajustable par l'utilisateur.
 *
 * Après extraction, l'utilisateur peut TOUJOURS corriger le résultat dans
 * l'interface : le parsing propose, l'humain dispose. C'est ce qui rend
 * l'imprécision acceptable.
 */
import {
  COMPETENCES_CONNUES,
  POSTES_VISES,
  SECTEURS,
} from "../scoring/dictionnaires";
import { normaliser } from "../scoring/moteur";

// ---------------------------------------------------------------------
//  Nettoyage du texte extrait
// ---------------------------------------------------------------------

/** Corrige les artefacts classiques d'une extraction PDF. */
export function nettoyerTexte(texte: string): string {
  if (!texte) return "";

  let t = texte;

  // Ligatures et caractères mal décodés
  const remplacements: [RegExp, string][] = [
    [/\ufb01/g, "fi"],
    [/\ufb02/g, "fl"],
    [/\ufb00/g, "ff"],
    [/[\u2018\u2019]/g, "'"],
    [/[\u201c\u201d]/g, '"'],
    [/[\u2013\u2014]/g, "-"],
    [/\u00a0/g, " "],
    [/\u2022/g, "-"],
  ];
  for (const [motif, remplacement] of remplacements) {
    t = t.replace(motif, remplacement);
  }

  // Recoller les mots coupés en fin de ligne : « dévelop-\npement »
  t = t.replace(/(\w)-\s*\n\s*(\w)/g, "$1$2");
  // Recoller les lignes qui prolongent une phrase
  t = t.replace(/(?<=[a-zéèêàâôû,;:])\n(?=[a-zéèêàâôû(])/g, " ");
  // Espaces et lignes vides
  t = t.replace(/[ \t]+/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");

  return t.trim();
}

// ---------------------------------------------------------------------
//  Sections
// ---------------------------------------------------------------------

const MOTIFS_SECTIONS: Record<string, RegExp> = {
  resume: /R[EÉ]SUM[EÉ]\s+PROFESSIONNEL/i,
  competences: /COMP[EÉ]TENCES/i,
  experience: /EXP[EÉ]RIENCE\s+PROFESSIONNELLE|EXP[EÉ]RIENCES/i,
  projets: /PROJETS?\s+(IA|PERSONNELS?|TECHNIQUES?)?/i,
  formation: /FORMATION/i,
  langues: /LANGUES/i,
  postes: /POSTES?\s+VIS[EÉ]S/i,
};

export function detecterSections(texte: string): Record<string, string> {
  const positions: { debut: number; nom: string }[] = [];

  for (const [nom, motif] of Object.entries(MOTIFS_SECTIONS)) {
    const global = new RegExp(motif.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = global.exec(texte)) !== null) {
      positions.push({ debut: m.index, nom });
    }
  }
  positions.sort((a, b) => a.debut - b.debut);

  const sections: Record<string, string> = {};
  for (let i = 0; i < positions.length; i++) {
    const { debut, nom } = positions[i];
    const fin = i + 1 < positions.length ? positions[i + 1].debut : texte.length;
    const contenu = texte.slice(debut, fin).trim();
    // Une section peut apparaître sur plusieurs pages : on concatène
    sections[nom] = sections[nom] ? `${sections[nom]}\n${contenu}` : contenu;
  }
  return sections;
}

// ---------------------------------------------------------------------
//  Extraction d'entités
// ---------------------------------------------------------------------

/** Compétences connues présentes dans le texte. */
export function extraireCompetences(texte: string): string[] {
  const norm = normaliser(texte);
  const trouvees = new Set<string>();
  for (const liste of Object.values(COMPETENCES_CONNUES)) {
    for (const comp of liste) {
      if (norm.includes(comp)) trouvees.add(comp);
    }
  }
  return [...trouvees].sort();
}

export interface Experience {
  entreprise: string;
  poste: string;
  dates: string;
}

/**
 * Repère les blocs « ENTREPRISE - Poste | Dates ».
 *
 * Le format attendu est celui d'un CV structuré : une ligne par poste,
 * avec un séparateur `|` avant les dates.
 */
export function extraireExperiences(texteExperience: string): Experience[] {
  const blocs: Experience[] = [];

  for (const ligne of texteExperience.split("\n")) {
    if (!ligne.includes("|")) continue;
    if (!/20\d{2}/.test(ligne)) continue;

    const parties = ligne.split("|").map((p) => p.trim());
    const gauche = parties[0];
    const dates = parties.slice(1).join(" | ").trim();

    let entreprise: string;
    let poste: string;
    if (gauche.includes(" - ")) {
      const idx = gauche.indexOf(" - ");
      entreprise = gauche.slice(0, idx);
      poste = gauche.slice(idx + 3);
    } else {
      entreprise = gauche;
      poste = "";
    }

    entreprise = entreprise.replace(/^[-\s]+|[-\s]+$/g, "");
    if (!entreprise || entreprise.length > 80) continue;

    blocs.push({
      entreprise,
      poste: poste.replace(/^[-\s]+|[-\s]+$/g, ""),
      dates: dates.replace(/\s+/g, " "),
    });
  }
  return blocs;
}

/** Estime le nombre d'années d'expérience depuis les dates des postes. */
export function estimerAnneesExperience(experiences: Experience[]): number {
  const annees: number[] = [];
  for (const e of experiences) {
    // On récupère toutes les années à 4 chiffres de la ligne de dates
    const trouvees = e.dates.match(/20\d{2}|19\d{2}/g);
    if (trouvees) {
      annees.push(...trouvees.map((a) => parseInt(a, 10)));
    }
  }
  if (annees.length === 0) return 0;

  const debut = Math.min(...annees);
  const finBrute = Math.max(...annees);
  const maintenant = new Date().getFullYear();

  // Une date de fin dans le futur ou égale à l'année courante signifie
  // « poste en cours » : on plafonne à l'année courante.
  const fin = Math.min(finBrute, maintenant);
  return Math.max(0, fin - debut);
}

/** Postes visés détectés dans le CV. */
export function extrairePostesVises(texte: string): string[] {
  const norm = normaliser(texte);
  return POSTES_VISES.filter((p) => norm.includes(normaliser(p)));
}

/** Secteurs évoqués par le CV. */
export function extraireSecteurs(texte: string): string[] {
  const norm = normaliser(texte);
  const trouves: string[] = [];
  for (const [secteur, mots] of Object.entries(SECTEURS)) {
    if (mots.some((m) => norm.includes(normaliser(m)))) {
      trouves.push(secteur);
    }
  }
  return trouves;
}

/** Niveaux de séniorité que le CV permet de viser. */
export function deduireSeniorites(annees: number): string[] {
  if (annees >= 8) return ["senior", "lead"];
  if (annees >= 5) return ["confirme", "senior"];
  if (annees >= 2) return ["junior", "confirme"];
  return ["junior"];
}

// ---------------------------------------------------------------------
//  Résultat complet
// ---------------------------------------------------------------------

export interface ProfilExtrait {
  texteBrut: string;
  competences: string[];
  competencesParCategorie: Record<string, string[]>;
  experiences: Experience[];
  anneesExperience: number;
  postesVises: string[];
  secteurs: string[];
  seniorites: string[];
  sections: string[];
  /** Avertissements à afficher à l'utilisateur pour qu'il corrige. */
  alertes: string[];
}

/**
 * Analyse un texte de CV et retourne un profil structuré.
 *
 * Les `alertes` listent ce qui n'a PAS pu être extrait : c'est ce qui
 * déclenche l'écran de correction dans l'onboarding. Un CV mal parsé ne doit
 * jamais passer silencieusement — l'utilisateur doit savoir quoi corriger.
 */
export function analyserCv(texteBrut: string): ProfilExtrait {
  const texte = nettoyerTexte(texteBrut);
  const sections = detecterSections(texte);

  const competences = extraireCompetences(texte);
  const experiences = extraireExperiences(
    sections.experience ?? texte
  );
  const anneesExperience = estimerAnneesExperience(experiences);
  const postesVises = extrairePostesVises(
    sections.postes ? `${sections.postes}\n${texte}` : texte
  );
  const secteurs = extraireSecteurs(texte);
  const seniorites = deduireSeniorites(anneesExperience);

  // Regroupement par catégorie, pour l'affichage en colonnes
  const competencesParCategorie: Record<string, string[]> = {};
  for (const [categorie, liste] of Object.entries(COMPETENCES_CONNUES)) {
    const presentes = liste.filter((c) => competences.includes(c));
    if (presentes.length) competencesParCategorie[categorie] = presentes;
  }

  // -- Alertes -------------------------------------------------------
  const alertes: string[] = [];
  if (texte.trim().length < 200) {
    alertes.push(
      "Le texte extrait est très court : le PDF est peut-être un scan " +
        "sans couche texte. Vérifie et corrige les informations ci-dessous."
    );
  }
  if (competences.length === 0) {
    alertes.push(
      "Aucune compétence technique reconnue. Ajoute-les manuellement : " +
        "elles pèsent 45 % du score de compatibilité."
    );
  }
  if (experiences.length === 0) {
    alertes.push(
      "Aucune expérience détectée. Le format attendu est " +
        "« Entreprise - Poste | 2020-2023 »."
    );
  }
  if (anneesExperience === 0) {
    alertes.push(
      "Impossible d'estimer ton expérience. Renseigne-la manuellement."
    );
  }
  if (postesVises.length === 0) {
    alertes.push(
      "Aucun poste visé reconnu. Précise-les : ils pèsent 30 % du score."
    );
  }

  return {
    texteBrut: texte,
    competences,
    competencesParCategorie,
    experiences,
    anneesExperience,
    postesVises,
    secteurs,
    seniorites,
    sections: Object.keys(sections),
    alertes,
  };
}
