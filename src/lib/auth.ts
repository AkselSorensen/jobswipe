/**
 * Authentification — helpers serveur.
 *
 * L'authentification est déléguée à Supabase Auth. Ce module fournit les
 * deux fonctions dont l'application a besoin :
 *
 *  - `utilisateurCourant()` : l'utilisateur connecté, ou null.
 *  - `utilisateurRequis()` : idem, mais redirige vers /connexion si absent.
 *
 * Point important : on synchronise paresseusement le compte Supabase avec
 * notre table `users`. À la première connexion, on crée la ligne Prisma
 * correspondante. Cela évite d'avoir à gérer un webhook d'inscription, au
 * prix d'un appel supplémentaire à la première requête.
 */
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { clientServeur } from "./supabase";

export interface UtilisateurApp {
  id: string;
  supabaseId: string;
  email: string;
  nom: string | null;
  /** L'utilisateur a-t-il terminé son onboarding (CV + préférences) ? */
  onboardingFait: boolean;
}

/** Utilisateur connecté, ou null. */
export async function utilisateurCourant(): Promise<UtilisateurApp | null> {
  const supabase = await clientServeur();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  return synchroniserUtilisateur(user.id, user.email);
}

/** Utilisateur connecté, ou redirection vers la page de connexion. */
export async function utilisateurRequis(): Promise<UtilisateurApp> {
  const utilisateur = await utilisateurCourant();
  if (!utilisateur) redirect("/connexion");
  return utilisateur;
}

/**
 * Crée la ligne `users` si elle n'existe pas, et retourne l'utilisateur.
 *
 * On utilise `upsert` sur `supabaseId` : c'est idempotent, donc sans risque
 * même si deux requêtes concurrentes arrivent à la première connexion.
 */
async function synchroniserUtilisateur(
  supabaseId: string,
  email: string
): Promise<UtilisateurApp> {
  const enregistrement = await prisma.user.upsert({
    where: { supabaseId },
    create: { supabaseId, email },
    update: {}, // rien à mettre à jour : l'email est géré par Supabase
    include: {
      cv: { select: { id: true } },
      preferences: { select: { id: true } },
    },
  });

  return {
    id: enregistrement.id,
    supabaseId: enregistrement.supabaseId,
    email: enregistrement.email,
    nom: enregistrement.nom,
    onboardingFait: Boolean(enregistrement.cv && enregistrement.preferences),
  };
}

/**
 * Redirige vers l'onboarding si le profil est incomplet.
 *
 * Utilisé par les pages qui n'ont pas de sens sans CV ni préférences :
 * le swipe, les likés, les candidatures.
 */
export async function utilisateurPret(): Promise<UtilisateurApp> {
  const utilisateur = await utilisateurRequis();
  if (!utilisateur.onboardingFait) redirect("/onboarding");
  return utilisateur;
}
