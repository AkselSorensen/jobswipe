/**
 * Moteur de scoring CV ↔ offre.
 *
 * Porté depuis `scoring.py` du projet local. Trois principes conservés :
 *
 *  1. Quatre composantes pondérées (titre, compétences, séniorité, secteur),
 *     normalisées sur 100 — les poids sont modifiables sans casser l'échelle.
 *  2. Les compétences REQUISES pèsent plus lourd que les SOUHAITÉES, et la
 *     distinction se fait par le contexte textuel autour de la mention.
 *  3. Quand une information manque, on reste neutre plutôt que de pénaliser :
 *     une offre sans compétence identifiable obtient 0,5, pas 0.
 */
import {
  COMPETENCES_CONNUES,
  POSTES_VISES,
  SECTEURS,
} from "./dictionnaires";

// ---------------------------------------------------------------------
//  Normalisation
// ---------------------------------------------------------------------

/** Minuscules, sans accents, espaces réduits. Brique de base de tout le reste. */
export function normaliser(texte: string | null | undefined): string {
  if (!texte) return "";
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------

export interface CvProfil {
  competences: string[];
  anneesExperience: number;
  postesVises?: string[];
  secteurs?: string[];
}

export interface OffreAScorer {
  titre: string;
  entreprise: string;
  description: string;
}

export interface Poids {
  titre: number;
  competences: number;
  seniorite: number;
  secteur: number;
}

export const POIDS_DEFAUT: Poids = {
  titre: 30,
  competences: 45,
  seniorite: 15,
  secteur: 10,
};

export interface DetailsScore {
  titre: number;
  competences: number;
  seniorite: number;
  secteur: number;
  motifTitre: string;
  secteurDetecte: string;
  competencesRequises: string[];
  competencesSouhaitees: string[];
  competencesCouvertes: string[];
  competencesManquantes: string[];
  senioriteOffre: string;
  anneesDemandees: number | null;
}

export interface ResultatScore {
  score: number;
  details: DetailsScore;
}

export type NiveauSeniorite = "junior" | "confirme" | "senior" | "lead";

// ---------------------------------------------------------------------
//  Détection des compétences dans une offre
// ---------------------------------------------------------------------

/** Mots qui, dans le voisinage d'une compétence, la rendent obligatoire. */
const INDICES_REQUIS = [
  "maitrise", "maîtrise", "exige", "exigé", "requis", "obligatoire",
  "indispensable", "solide", "expertise", "experience avec", "compétence",
  "proficiency", "required", "must have", "strong",
];

/** Mots qui la rendent optionnelle. */
const INDICES_SOUHAITES = [
  "apprecie", "apprécié", "plus", "atout", "souhaite", "souhaité",
  "nice to have", "bonus", "idealement", "idéalement", "serait un plus",
];

/**
 * Sépare les compétences d'une offre en « requises » et « souhaitées ».
 *
 * La distinction se fait par une fenêtre de 120 caractères autour de chaque
 * mention : c'est approximatif, mais bien plus utile qu'une liste unique.
 * En cas d'ambiguïté, on classe en « souhaité » (prudent : on ne surestime
 * pas l'exigence d'une offre).
 */
export function detecterCompetencesOffre(description: string): {
  requises: string[];
  souhaitees: string[];
} {
  const texte = normaliser(description);
  const requises: string[] = [];
  const souhaitees: string[] = [];

  for (const liste of Object.values(COMPETENCES_CONNUES)) {
    for (const comp of liste) {
      const idx = texte.indexOf(comp);
      if (idx < 0) continue;

      const contexte = texte.slice(
        Math.max(0, idx - 120),
        idx + comp.length + 120
      );

      if (INDICES_SOUHAITES.some((i) => contexte.includes(i))) {
        if (!souhaitees.includes(comp)) souhaitees.push(comp);
      } else if (INDICES_REQUIS.some((i) => contexte.includes(i))) {
        if (!requises.includes(comp)) requises.push(comp);
      } else if (!souhaitees.includes(comp)) {
        souhaitees.push(comp);
      }
    }
  }

  // Une compétence ne peut pas être à la fois requise et souhaitée :
  // le « requis » l'emporte.
  return {
    requises,
    souhaitees: souhaitees.filter((c) => !requises.includes(c)),
  };
}

// ---------------------------------------------------------------------
//  Séniorité
// ---------------------------------------------------------------------

/** Niveau de séniorité attendu par une offre. */
export function extraireSenioriteOffre(
  titre: string,
  description: string
): NiveauSeniorite {
  const t = normaliser(`${titre} ${description.slice(0, 1500)}`);

  if (
    ["lead", "principal", "staff", "head of", "manager", "directeur"].some(
      (m) => t.includes(m)
    )
  ) {
    return "lead";
  }
  if (
    ["senior", "sr.", "confirme", "expert"].some((m) => t.includes(m))
  ) {
    return "senior";
  }
  if (
    ["junior", "debutant", "entry", "stagiaire", "alternant"].some((m) =>
      t.includes(m)
    )
  ) {
    return "junior";
  }
  return "confirme";
}

/** Années d'expérience explicitement demandées, ou null si non mentionné. */
export function extraireAnneesDemandees(
  description: string
): number | null {
  const texte = normaliser(description);
  const motifs = [
    /(\d{1,2})\s*(?:\+|\s)?\s*ans?\s+d.experience/,
    /experience\s+(?:de\s+)?(\d{1,2})\s*(?:\+|\s)?\s*ans?/,
    /(\d{1,2})\s*\+\s*years?/,
    /minimum\s+(\d{1,2})\s*years?/,
  ];
  for (const motif of motifs) {
    const m = texte.match(motif);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

// ---------------------------------------------------------------------
//  Scoreur
// ---------------------------------------------------------------------

export class Scorer {
  private competencesCv: Set<string>;
  private postesCibles: string[];
  private poids: Poids;
  private anneesCv: number;
  private scoreMinimum: number;

  constructor(
    cv: CvProfil,
    options?: { poids?: Partial<Poids>; scoreMinimum?: number }
  ) {
    this.competencesCv = new Set(cv.competences.map(normaliser));
    this.anneesCv = cv.anneesExperience || 0;
    this.postesCibles = POSTES_VISES.map(normaliser);
    this.poids = { ...POIDS_DEFAUT, ...(options?.poids ?? {}) };
    this.scoreMinimum = options?.scoreMinimum ?? 50;
  }

  // -- Composante 1 : correspondance du titre ------------------------
  private scoreTitre(titre: string): { score: number; motif: string } {
    const t = normaliser(titre);
    let meilleur = 0;
    let motif = "";

    for (const poste of this.postesCibles) {
      if (t.includes(poste)) {
        // Un poste visé trouvé tel quel vaut le maximum
        return { score: 1, motif: poste };
      }
      const motsPoste = new Set(poste.split(" "));
      const motsTitre = new Set(t.split(" "));
      const communs = [...motsPoste].filter((m) => motsTitre.has(m));
      if (communs.length >= 2) {
        const ratio = communs.length / motsPoste.size;
        if (ratio > meilleur) {
          meilleur = ratio * 0.85;
          motif = `mots communs : ${communs.join(", ")}`;
        }
      }
    }

    // Repli : le titre évoque le domaine même sans correspondre à un poste
    if (meilleur === 0 && /\b(ia|ai|ml|machine learning|data)\b/.test(t)) {
      return { score: 0.55, motif: "domaine IA / data" };
    }
    return { score: meilleur, motif };
  }

  // -- Composante 2 : compétences ------------------------------------
  private scoreCompetences(
    requises: string[],
    souhaitees: string[]
  ): {
    score: number;
    couvertes: string[];
    manquantes: string[];
  } {
    const couvertesReq = requises.filter((c) => this.competencesCv.has(c));
    const couvertesSouh = souhaitees.filter((c) => this.competencesCv.has(c));
    const manquantes = requises.filter((c) => !this.competencesCv.has(c));

    const totalIdentifiees = requises.length + souhaitees.length;

    let score: number;
    if (requises.length > 0) {
      // Requises 75 %, souhaitées 25 %. Si aucune souhaitée n'est listée,
      // le ratio des requises sert de référence aux deux.
      const ratioReq = couvertesReq.length / requises.length;
      const ratioSouh =
        souhaitees.length > 0
          ? couvertesSouh.length / souhaitees.length
          : ratioReq;
      score = 0.75 * ratioReq + 0.25 * ratioSouh;
    } else if (souhaitees.length > 0) {
      score = couvertesSouh.length / souhaitees.length;
    } else {
      // Aucune compétence identifiable dans l'offre.
      //
      // On ne peut PAS se contenter d'une valeur neutre à 0,5 : une offre
      // hors sujet (« Chauffeur livreur ») n'a elle non plus aucune
      // compétence technique identifiable, et se retrouverait gratifiée
      // d'un score moyen. On se rabat donc sur un signal faible mais
      // disponible : le titre de l'offre contient-il un terme du domaine ?
      score = this.offreEvoqueLeDomaine() ? 0.45 : 0.1;
    }

    return {
      score,
      couvertes: [...couvertesReq, ...couvertesSouh],
      manquantes,
    };
  }

  /**
   * Le titre de l'offre en cours évoque-t-il le domaine du CV ?
   *
   * Sert de repli quand aucune compétence n'est identifiable. Le titre est
   * positionné par `scorer()` avant l'appel.
   */
  private titreCourant = "";

  private offreEvoqueLeDomaine(): boolean {
    const t = normaliser(this.titreCourant);
    if (/\b(ia|ai|ml|machine learning|data|nlp|llm|informatique|logiciel|software|dev)\b/.test(t)) {
      return true;
    }
    // Un titre qui correspond à un poste visé compte aussi
    return this.postesCibles.some((p) => t.includes(p));
  }

  // -- Composante 3 : séniorité --------------------------------------
  private scoreSeniorite(titre: string, description: string): number {
    const niveau = extraireSenioriteOffre(titre, description);
    const demandees = extraireAnneesDemandees(description);

    if (demandees !== null) {
      if (this.anneesCv >= demandees) return 1;
      const ecart = demandees - this.anneesCv;
      return Math.max(0.2, 1 - 0.2 * ecart);
    }

    const seuil: Record<NiveauSeniorite, number> = {
      junior: 0,
      confirme: 2,
      senior: 5,
      lead: 7,
    };
    return this.anneesCv >= seuil[niveau] ? 1 : 0.5;
  }

  // -- Composante 4 : secteur ----------------------------------------
  private scoreSecteur(
    titre: string,
    description: string,
    entreprise: string
  ): { score: number; secteur: string } {
    const texte = normaliser(
      `${titre} ${entreprise} ${description.slice(0, 3000)}`
    );
    for (const [secteur, mots] of Object.entries(SECTEURS)) {
      if (mots.some((m) => texte.includes(normaliser(m)))) {
        return { score: 1, secteur };
      }
    }
    // Aucun secteur reconnu. On distingue deux cas : une offre du domaine
    // sans secteur identifiable mérite une valeur moyenne, une offre hors
    // sujet mérite le minimum.
    return this.offreEvoqueLeDomaine()
      ? { score: 0.4, secteur: "" }
      : { score: 0.05, secteur: "" };
  }

  // -- Score global ---------------------------------------------------
  scorer(offre: OffreAScorer): ResultatScore {
    // Le titre sert de repli quand une composante n'a rien à exploiter :
    // on le positionne avant tout calcul.
    this.titreCourant = offre.titre;

    const { requises, souhaitees } = detecterCompetencesOffre(
      offre.description
    );

    const sTitre = this.scoreTitre(offre.titre);
    const sComp = this.scoreCompetences(requises, souhaitees);
    const sSenior = this.scoreSeniorite(offre.titre, offre.description);
    const sSecteur = this.scoreSecteur(
      offre.titre,
      offre.description,
      offre.entreprise
    );

    const p = this.poids;
    const somme =
      p.titre + p.competences + p.seniorite + p.secteur || 100;
    const brut =
      sTitre.score * p.titre +
      sComp.score * p.competences +
      sSenior * p.seniorite +
      sSecteur.score * p.secteur;

    const score = Math.round((brut / somme) * 100 * 10) / 10;

    return {
      score,
      details: {
        titre: Math.round(sTitre.score * 100),
        competences: Math.round(sComp.score * 100),
        seniorite: Math.round(sSenior * 100),
        secteur: Math.round(sSecteur.score * 100),
        motifTitre: sTitre.motif,
        secteurDetecte: sSecteur.secteur,
        competencesRequises: requises.slice(0, 12),
        competencesSouhaitees: souhaitees.slice(0, 12),
        competencesCouvertes: sComp.couvertes.slice(0, 15),
        competencesManquantes: sComp.manquantes.slice(0, 8),
        senioriteOffre: extraireSenioriteOffre(offre.titre, offre.description),
        anneesDemandees: extraireAnneesDemandees(offre.description),
      },
    };
  }

  /** Le score dépasse-t-il le seuil configuré ? */
  estRetenue(score: number): boolean {
    return score >= this.scoreMinimum;
  }

  /**
   * Applique les exclusions définies par l'utilisateur.
   *
   * Le filtre sur la description sert notamment à écarter les missions
   * freelance, qui se cachent derrière des libellés de contrat standards.
   */
  estExclue(
    offre: OffreAScorer,
    exclusions: { titres?: string[]; description?: string[] }
  ): { exclue: boolean; raison: string } {
    const titre = normaliser(offre.titre);
    const desc = normaliser(offre.description);

    for (const mot of exclusions.titres ?? []) {
      const motif = normaliser(mot);
      if (motif && titre.includes(motif)) {
        return { exclue: true, raison: `titre contient « ${mot} »` };
      }
    }

    for (const mot of exclusions.description ?? []) {
      const motif = normaliser(mot);
      if (!motif) continue;
      // « TJM » seul, pour éviter les faux positifs sur des mots proches
      if (motif === "tjm" || motif === "tj m") {
        if (/\btj\s?m\b/.test(desc)) {
          return { exclue: true, raison: "mention d'un TJM (freelance)" };
        }
        continue;
      }
      if (desc.includes(motif)) {
        return { exclue: true, raison: `offre mentionne « ${mot} »` };
      }
    }

    return { exclue: false, raison: "" };
  }
}
