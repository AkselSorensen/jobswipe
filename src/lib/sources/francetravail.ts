/**
 * Client France Travail — API officielle « Offres d'emploi v2 ».
 *
 * Aucun scraping : on utilise l'API partenaire publique, gratuite, avec des
 * identifiants obtenus sur https://francetravail.io. C'est ce qui rend le
 * service hébergeable et conforme aux conditions d'utilisation.
 *
 * DEUX PIÈGES CONNUS, à ne pas réintroduire :
 *
 *  1. Le scope doit contenir DEUX valeurs — « api_offresdemploiv2 o2dsoffre ».
 *     Avec seulement la première, l'API renvoie un token valide puis 403 sur
 *     chaque recherche. C'est déroutant parce que l'authentification réussit.
 *
 *  2. La pagination est plafonnée : la fenêtre maximale est 0-999, soit
 *     1 000 résultats. Au-delà, l'API renvoie une erreur 500. Pour couvrir
 *     davantage de marché, il faut multiplier les mots-clés et les zones.
 */
import { z } from "zod";

const URL_TOKEN =
  "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire";
const URL_RECHERCHE =
  "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search";
const SCOPE = "api_offresdemploiv2 o2dsoffre";

/** Nombre maximal de résultats accessibles par requête (fenêtre 0-999). */
export const MAX_RESULTATS = 1000;

// ---------------------------------------------------------------------
//  Schémas de réponse (validation à la frontière)
// ---------------------------------------------------------------------

const SchemaEntreprise = z
  .object({ nom: z.string().optional() })
  .partial()
  .optional();

const SchemaLieu = z
  .object({
    libelle: z.string().optional(),
    codePostal: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    commune: z.string().optional(),
  })
  .partial()
  .optional();

const SchemaSalaire = z
  .object({
    libelle: z.string().optional(),
    commentaire: z.string().optional(),
  })
  .partial()
  .optional();

const SchemaOrigine = z
  .object({ urlOrigine: z.string().optional() })
  .partial()
  .optional();

const SchemaOffre = z
  .object({
    id: z.string(),
    intitule: z.string().default(""),
    description: z.string().default(""),
    entreprise: SchemaEntreprise,
    lieuTravail: SchemaLieu,
    salaire: SchemaSalaire,
    origineOffre: SchemaOrigine,
    typeContrat: z.string().optional(),
    typeContratLibelle: z.string().optional(),
    natureContrat: z.string().optional(),
    experienceLibelle: z.string().optional(),
    experienceExige: z.string().optional(),
    secteurActiviteLibelle: z.string().optional(),
    trancheEffectifEtab: z.string().optional(),
    qualificationLibelle: z.string().optional(),
    romeLibelle: z.string().optional(),
    appellationlibelle: z.string().optional(),
    compétences: z.array(z.unknown()).optional(),
    competences: z
      .array(
        z.object({
          libelle: z.string().optional(),
          exigence: z.string().optional(),
        })
      )
      .optional(),
    dateCreation: z.string().optional(),
    dateActualisation: z.string().optional(),
    nombrePostes: z.number().optional(),
  })
  .passthrough();

const SchemaRecherche = z.object({
  resultats: z.array(SchemaOffre).default([]),
});

export type OffreBrute = z.infer<typeof SchemaOffre>;

// ---------------------------------------------------------------------
//  Offre normalisée (indépendante de la source)
// ---------------------------------------------------------------------

export interface OffreNormalisee {
  source: "francetravail";
  sourceId: string;
  url: string;
  titre: string;
  entreprise: string;
  lieu: string | null;
  latitude: number | null;
  longitude: number | null;
  contrat: string | null;
  natureContrat: string | null;
  salaire: string | null;
  description: string;
  competences: string[];
  experienceLibelle: string | null;
  secteurActivite: string | null;
  trancheEffectif: string | null;
  qualification: string | null;
  dateCreation: Date | null;
  dateActualisation: Date | null;
}

// ---------------------------------------------------------------------
//  Jeton OAuth (mis en cache en mémoire)
// ---------------------------------------------------------------------

interface JetonEnCache {
  valeur: string;
  expireLe: number;
}

// Le jeton dure ~25 minutes : on le garde en mémoire du processus. Sur
// Vercel, chaque instance serverless a son propre cache — c'est acceptable,
// l'obtention d'un jeton étant rapide.
let jetonEnCache: JetonEnCache | null = null;

async function obtenirJeton(): Promise<string> {
  const maintenant = Date.now();
  if (jetonEnCache && jetonEnCache.expireLe > maintenant + 60_000) {
    return jetonEnCache.valeur;
  }

  const clientId = process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const clientSecret = process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Identifiants France Travail manquants (FRANCE_TRAVAIL_CLIENT_ID / _SECRET)."
    );
  }

  const reponse = await fetch(URL_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: SCOPE,
    }),
    cache: "no-store",
  });

  if (!reponse.ok) {
    const corps = await reponse.text();
    throw new Error(
      `France Travail — échec d'authentification (${reponse.status}) : ${corps.slice(0, 200)}`
    );
  }

  const donnees = (await reponse.json()) as {
    access_token: string;
    expires_in: number;
  };

  jetonEnCache = {
    valeur: donnees.access_token,
    expireLe: maintenant + (donnees.expires_in ?? 1500) * 1000,
  };
  return jetonEnCache.valeur;
}

// ---------------------------------------------------------------------
//  Paramètres de recherche
// ---------------------------------------------------------------------

export interface ParametresRecherche {
  /** Mots-clés (un appel par jeu de mots-clés) */
  motsCles: string;
  /** Code INSEE de la commune (ex. 75056 pour Paris) */
  codeCommune?: string;
  /** Rayon en km autour de la commune */
  distance?: number;
  /** Code département (alternative à codeCommune) */
  departement?: string;
  /** Types de contrat : CDI, CDD, MIS, etc. */
  typesContrat?: string[];
  /** Temps plein uniquement */
  tempsPlein?: boolean;
  /** Salaire annuel minimum en euros */
  salaireMin?: number;
  /** Nombre de résultats souhaités (plafonné à MAX_RESULTATS) */
  limite?: number;
}

/**
 * Interroge l'API et retourne les offres normalisées.
 *
 * L'API pagine par intervalles (`range=0-149`). On découpe donc la demande
 * en tranches de 150, qui est la taille maximale acceptée par l'API.
 */
export async function rechercherOffres(
  params: ParametresRecherche
): Promise<OffreNormalisee[]> {
  const jeton = await obtenirJeton();
  const limite = Math.min(params.limite ?? 150, MAX_RESULTATS);
  const TAILLE_PAGE = 150;
  const resultats: OffreBrute[] = [];

  for (let debut = 0; debut < limite; debut += TAILLE_PAGE) {
    const fin = Math.min(debut + TAILLE_PAGE - 1, limite - 1);

    const query = new URLSearchParams({
      motsCles: params.motsCles,
      range: `${debut}-${fin}`,
    });
    if (params.codeCommune) query.set("codeCommune", params.codeCommune);
    if (params.distance) query.set("distance", String(params.distance));
    if (params.departement) query.set("departement", params.departement);
    if (params.tempsPlein) query.set("tempsPlein", "true");
    if (params.salaireMin) query.set("salaireMin", String(params.salaireMin));
    // L'API n'accepte qu'un seul typeContrat par appel
    if (params.typesContrat?.length) {
      query.set("typeContrat", params.typesContrat[0]);
    }

    const reponse = await fetch(`${URL_RECHERCHE}?${query}`, {
      headers: {
        Authorization: `Bearer ${jeton}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    // 204 = aucun résultat : cas normal, pas une erreur
    if (reponse.status === 204) break;

    if (!reponse.ok) {
      const corps = await reponse.text();
      // 400 sur les pages au-delà de la fenêtre : on s'arrête proprement
      if (reponse.status === 400 || reponse.status === 500) break;
      throw new Error(
        `France Travail — recherche échouée (${reponse.status}) : ${corps.slice(0, 200)}`
      );
    }

    const brut = await reponse.json();
    const valide = SchemaRecherche.safeParse(brut);
    if (!valide.success) {
      throw new Error(
        `France Travail — réponse inattendue : ${valide.error.message.slice(0, 200)}`
      );
    }

    const page = valide.data.resultats;
    resultats.push(...page);
    if (page.length < TAILLE_PAGE) break; // dernière page atteinte
  }

  return resultats.map(normaliserOffre);
}

// ---------------------------------------------------------------------
//  Normalisation
// ---------------------------------------------------------------------

function texteOuNull(v: string | undefined | null): string | null {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
}

function dateOuNull(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normaliserOffre(brute: OffreBrute): OffreNormalisee {
  const competences = (brute.competences ?? [])
    .map((c) => c.libelle?.trim())
    .filter((c): c is string => Boolean(c));

  // Repli sur l'URL d'origine si elle manque : sans URL, l'offre est
  // inutilisable puisqu'on ne peut pas postuler.
  const url =
    brute.origineOffre?.urlOrigine ??
    `https://candidat.francetravail.fr/offres/recherche/detail/${brute.id}`;

  const salaire =
    texteOuNull(brute.salaire?.libelle) ??
    texteOuNull(brute.salaire?.commentaire);

  return {
    source: "francetravail",
    sourceId: brute.id,
    url,
    titre: brute.intitule?.trim() || "(intitulé non précisé)",
    entreprise: texteOuNull(brute.entreprise?.nom) ?? "Entreprise non précisée",
    lieu: texteOuNull(brute.lieuTravail?.libelle),
    latitude: brute.lieuTravail?.latitude ?? null,
    longitude: brute.lieuTravail?.longitude ?? null,
    contrat: texteOuNull(brute.typeContratLibelle ?? brute.typeContrat),
    natureContrat: texteOuNull(brute.natureContrat),
    salaire,
    description: brute.description ?? "",
    competences,
    experienceLibelle: texteOuNull(brute.experienceLibelle),
    secteurActivite: texteOuNull(brute.secteurActiviteLibelle),
    trancheEffectif: texteOuNull(brute.trancheEffectifEtab),
    qualification: texteOuNull(brute.qualificationLibelle),
    dateCreation: dateOuNull(brute.dateCreation),
    dateActualisation: dateOuNull(brute.dateActualisation),
  };
}

/** Vérifie que les identifiants sont présents, sans appeler l'API. */
export function identifiantsPresents(): boolean {
  return Boolean(
    process.env.FRANCE_TRAVAIL_CLIENT_ID &&
      process.env.FRANCE_TRAVAIL_CLIENT_SECRET
  );
}
