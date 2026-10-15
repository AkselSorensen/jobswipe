/**
 * Design system — classes utilitaires partagées.
 *
 * Plutôt que de disperser des chaînes Tailwind dans chaque composant, on
 * centralise ici les styles qui reviennent. Changer l'apparence d'un bouton
 * se fait alors à un seul endroit.
 */

// ---------------------------------------------------------------------
//  Boutons
// ---------------------------------------------------------------------
export const bouton = {
  base:
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium " +
    "transition-all duration-150 disabled:opacity-50 " +
    "disabled:cursor-not-allowed focus-visible:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-[#0a0e13]",

  primaire:
    "bg-emerald-500 text-emerald-950 hover:bg-emerald-400 " +
    "focus-visible:ring-emerald-400 font-semibold",

  secondaire:
    "bg-[#16202c] text-slate-200 border border-[#243040] " +
    "hover:bg-[#1d2a38] hover:border-[#33465c] focus-visible:ring-slate-500",

  danger:
    "bg-red-500/10 text-red-400 border border-red-500/30 " +
    "hover:bg-red-500/20 focus-visible:ring-red-400",

  fantome:
    "text-slate-400 hover:text-slate-100 hover:bg-[#16202c] " +
    "focus-visible:ring-slate-500",

  taille: {
    sm: "text-xs px-3 py-1.5",
    md: "text-sm px-4 py-2.5",
    lg: "text-base px-6 py-3",
  },
} as const;

/** Compose les classes d'un bouton. */
export function classesBouton(
  variante: keyof typeof bouton = "secondaire",
  taille: keyof typeof bouton.taille = "md",
  extra = ""
): string {
  const v = bouton[variante];
  return [
    bouton.base,
    typeof v === "string" ? v : "",
    bouton.taille[taille],
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

// ---------------------------------------------------------------------
//  Surfaces
// ---------------------------------------------------------------------
export const surface = {
  carte: "bg-[#0e141c] border border-[#1e2833] rounded-2xl",
  carteSurvol: "hover:border-[#2b3a4a] hover:bg-[#111823]",
  panneau: "bg-[#0b1016] border border-[#1b242f] rounded-xl",
  encart: "bg-[#0d141c] border border-[#1e2833] rounded-xl p-4",
} as const;

// ---------------------------------------------------------------------
//  Champs de formulaire
// ---------------------------------------------------------------------
export const champ = {
  base:
    "w-full bg-[#0d141c] border border-[#243040] rounded-lg px-4 py-2.5 " +
    "text-sm text-slate-100 placeholder:text-slate-600 " +
    "focus:outline-none focus:border-emerald-500/60 " +
    "focus:ring-2 focus:ring-emerald-500/15 transition-colors",

  erreur: "border-red-500/60 focus:border-red-500 focus:ring-red-500/15",

  label: "block text-xs font-medium text-slate-400 mb-1.5",
  aide: "text-xs text-slate-600 mt-1.5",
  erreurTexte: "text-xs text-red-400 mt-1.5",
} as const;

// ---------------------------------------------------------------------
//  Scores
// ---------------------------------------------------------------------
/** Couleur d'un score, cohérente dans toute l'application. */
export function couleurScore(score: number): {
  texte: string;
  fond: string;
  bordure: string;
} {
  if (score >= 85) {
    return {
      texte: "text-amber-300",
      fond: "bg-amber-500/10",
      bordure: "border-amber-500/30",
    };
  }
  if (score >= 75) {
    return {
      texte: "text-emerald-400",
      fond: "bg-emerald-500/10",
      bordure: "border-emerald-500/30",
    };
  }
  if (score >= 60) {
    return {
      texte: "text-sky-400",
      fond: "bg-sky-500/10",
      bordure: "border-sky-500/30",
    };
  }
  return {
    texte: "text-slate-400",
    fond: "bg-slate-500/10",
    bordure: "border-slate-500/25",
  };
}

// ---------------------------------------------------------------------
//  Libellés de sources
// ---------------------------------------------------------------------
export const SOURCES: Record<string, { nom: string; classe: string }> = {
  francetravail: {
    nom: "France Travail",
    classe: "bg-sky-500/10 text-sky-300 border-sky-500/25",
  },
  adzuna: {
    nom: "Adzuna",
    classe: "bg-violet-500/10 text-violet-300 border-violet-500/25",
  },
};

export function libelleSource(source: string): { nom: string; classe: string } {
  return (
    SOURCES[source] ?? {
      nom: source,
      classe: "bg-slate-500/10 text-slate-300 border-slate-500/25",
    }
  );
}

// ---------------------------------------------------------------------
//  Statuts de candidature
// ---------------------------------------------------------------------
export const STATUTS: Record<
  string,
  { nom: string; classe: string; icone: string }
> = {
  A_POSTULER: {
    nom: "À postuler",
    classe: "bg-sky-500/10 text-sky-300 border-sky-500/25",
    icone: "○",
  },
  EN_ATTENTE: {
    nom: "En attente",
    classe: "bg-amber-500/10 text-amber-300 border-amber-500/25",
    icone: "⏳",
  },
  ENVOYEE: {
    nom: "Envoyée",
    classe: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
    icone: "✓",
  },
  RELANCE: {
    nom: "Relancée",
    classe: "bg-cyan-500/10 text-cyan-300 border-cyan-500/25",
    icone: "↻",
  },
  ENTRETIEN: {
    nom: "Entretien",
    classe: "bg-violet-500/10 text-violet-300 border-violet-500/25",
    icone: "★",
  },
  OFFRE: {
    nom: "Offre reçue",
    classe: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
    icone: "🎉",
  },
  REFUS: {
    nom: "Refus",
    classe: "bg-red-500/10 text-red-400 border-red-500/25",
    icone: "✕",
  },
  ABANDON: {
    nom: "Abandonnée",
    classe: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    icone: "—",
  },
};

export function libelleStatut(statut: string) {
  return (
    STATUTS[statut] ?? {
      nom: statut,
      classe: "bg-slate-500/10 text-slate-400 border-slate-500/25",
      icone: "?",
    }
  );
}
