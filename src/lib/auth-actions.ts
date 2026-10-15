"use server";

/**
 * Actions d'authentification : inscription, connexion, déconnexion.
 *
 * Email + mot de passe, sessions maison (voir lib/auth.ts). Le message
 * d'erreur à la connexion est volontairement le même que l'email existe ou
 * non, pour ne pas révéler quels comptes existent.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  creerSession,
  detruireSession,
  hacherMotDePasse,
  verifierMotDePasse,
} from "@/lib/auth";

export interface EtatFormulaire {
  erreur?: string;
  succes?: string;
}

const SchemaInscription = z.object({
  email: z.string().trim().toLowerCase().email("Adresse email invalide"),
  motDePasse: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  nom: z.string().trim().min(1, "Le nom est requis").max(80),
});

const SchemaConnexion = z.object({
  email: z.string().trim().toLowerCase().email("Adresse email invalide"),
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

  const existant = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existant) {
    return { erreur: "Un compte existe déjà avec cette adresse email." };
  }

  const utilisateur = await prisma.user.create({
    data: { email, nom, passwordHash: await hacherMotDePasse(motDePasse) },
  });

  await creerSession(utilisateur.id);
  revalidatePath("/", "layout");
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
  const { email, motDePasse } = analyse.data;

  const utilisateur = await prisma.user.findUnique({
    where: { email },
    include: {
      cv: { select: { id: true } },
      preferences: { select: { id: true } },
    },
  });

  const valide =
    utilisateur !== null &&
    (await verifierMotDePasse(motDePasse, utilisateur.passwordHash));
  if (!utilisateur || !valide) {
    return { erreur: "Email ou mot de passe incorrect." };
  }

  await creerSession(utilisateur.id);
  revalidatePath("/", "layout");

  const profilComplet = Boolean(utilisateur.cv && utilisateur.preferences);
  redirect(profilComplet ? "/swipe" : "/onboarding");
}

// ---------------------------------------------------------------------
//  Déconnexion
// ---------------------------------------------------------------------

export async function deconnexion() {
  await detruireSession();
  revalidatePath("/", "layout");
  redirect("/");
}
