"use server";

/**
 * Actions d'authentification.
 *
 * On utilise des Server Actions plutôt que des routes API : moins de
 * code, pas de sérialisation manuelle, et les erreurs remontent
 * directement au formulaire.
 *
 * Deux modes de connexion sont proposés :
 *  - mot de passe (classique)
 *  - lien magique par email (sans mot de passe, plus simple et plus sûr)
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clientServeur } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

export interface EtatFormulaire {
  erreur?: string;
  succes?: string;
}

const SchemaInscription = z.object({
  email: z.string().email("Adresse email invalide"),
  motDePasse: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  nom: z.string().min(1, "Le nom est requis").max(80),
});

const SchemaConnexion = z.object({
  email: z.string().email("Adresse email invalide"),
  motDePasse: z.string().min(1, "Le mot de passe est requis"),
});

// ---------------------------------------------------------------------
//  Inscription
// ---------------------------------------------------------------------

export async function inscription(
  _etatPrecedent: EtatFormulaire,
  donnees: FormData
): Promise<EtatFormulaire> {
  const analyse = SchemaInscription.safeParse({
    email: donnees.get("email"),
    motDePasse: donnees.get("motDePasse"),
    nom: donnees.get("nom"),
  });

  if (!analyse.success) {
    return { erreur: analyse.error.issues[0].message };
  }

  const { email, motDePasse, nom } = analyse.data;
  const supabase = await clientServeur();

  const { data, error } = await supabase.auth.signUp({
    email,
    password: motDePasse,
    options: {
      // Ces métadonnées sont récupérées par Supabase et disponibles dans
      // le jeton : elles évitent une requête supplémentaire à la connexion.
      data: { nom },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    // On traduit les messages Supabase en français lisible
    if (error.message.includes("already registered")) {
      return { erreur: "Un compte existe déjà avec cette adresse email." };
    }
    return { erreur: `Inscription impossible : ${error.message}` };
  }

  // Création de la ligne applicative dès maintenant, pour que l'onboarding
  // dispose d'un utilisateur même si la confirmation email est désactivée.
  if (data.user?.id) {
    await prisma.user.upsert({
      where: { supabaseId: data.user.id },
      create: {
        supabaseId: data.user.id,
        email,
        nom,
      },
      update: { nom },
    });
  }

  // Si Supabase exige une confirmation email, il n'y a pas de session
  if (!data.session) {
    return {
      succes:
        "Compte créé. Vérifie ta boîte email pour confirmer ton adresse, " +
        "puis connecte-toi.",
    };
  }

  redirect("/onboarding");
}

// ---------------------------------------------------------------------
//  Connexion
// ---------------------------------------------------------------------

export async function connexion(
  _etatPrecedent: EtatFormulaire,
  donnees: FormData
): Promise<EtatFormulaire> {
  const analyse = SchemaConnexion.safeParse({
    email: donnees.get("email"),
    motDePasse: donnees.get("motDePasse"),
  });

  if (!analyse.success) {
    return { erreur: analyse.error.issues[0].message };
  }

  const supabase = await clientServeur();
  const { email, motDePasse } = analyse.data;
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: motDePasse,
  });

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      return { erreur: "Email ou mot de passe incorrect." };
    }
    if (error.message.includes("Email not confirmed")) {
      return {
        erreur:
          "Ton adresse email n'est pas encore confirmée. " +
          "Vérifie ta boîte de réception.",
      };
    }
    return { erreur: `Connexion impossible : ${error.message}` };
  }

  revalidatePath("/", "layout");
  redirect("/swipe");
}

// ---------------------------------------------------------------------
//  Lien magique
// ---------------------------------------------------------------------

export async function lienMagique(
  _etatPrecedent: EtatFormulaire,
  donnees: FormData
): Promise<EtatFormulaire> {
  const email = donnees.get("email");
  const analyse = z.string().email().safeParse(email);
  if (!analyse.success) {
    return { erreur: "Adresse email invalide." };
  }

  const supabase = await clientServeur();
  const { error } = await supabase.auth.signInWithOtp({
    email: analyse.data,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    return { erreur: `Envoi impossible : ${error.message}` };
  }

  return {
    succes:
      "Lien envoyé. Ouvre le message reçu et clique sur le lien pour " +
      "te connecter — aucun mot de passe à retenir.",
  };
}

// ---------------------------------------------------------------------
//  Déconnexion
// ---------------------------------------------------------------------

export async function deconnexion() {
  const supabase = await clientServeur();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
