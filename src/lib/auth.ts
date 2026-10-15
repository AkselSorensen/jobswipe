/**
 * Authentification maison — mots de passe et sessions.
 *
 *  - Mot de passe : haché avec scrypt (sel aléatoire de 16 octets, clé de 64).
 *    Stocké au format « sel:clé » en hexadécimal.
 *  - Session : un jeton aléatoire de 32 octets part dans un cookie HTTP-only.
 *    La base ne garde que son empreinte SHA-256 ; une fuite de la table
 *    `sessions` ne permet donc pas de se connecter.
 *
 * Fonctions exposées aux pages et aux actions :
 *  - `utilisateurCourant()` : l'utilisateur connecté, ou null.
 *  - `utilisateurRequis()` : idem, mais redirige vers /connexion si absent.
 *  - `utilisateurPret()` : idem, mais redirige vers /onboarding si le profil
 *    est incomplet (pas de CV ni de préférences).
 */
import {
  createHash,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

const scrypt = promisify(scryptCb) as (
  motDePasse: string,
  sel: Buffer,
  longueur: number
) => Promise<Buffer>;

const NOM_COOKIE = "jobswipe_session";
const DUREE_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export interface UtilisateurApp {
  id: string;
  email: string;
  nom: string | null;
  /** L'utilisateur a-t-il terminé son onboarding (CV + préférences) ? */
  onboardingFait: boolean;
}

// ---------------------------------------------------------------------
//  Mots de passe
// ---------------------------------------------------------------------

export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  const sel = randomBytes(16);
  const cle = await scrypt(motDePasse, sel, 64);
  return `${sel.toString("hex")}:${cle.toString("hex")}`;
}

export async function verifierMotDePasse(
  motDePasse: string,
  stocke: string
): Promise<boolean> {
  const [selHex, cleHex] = stocke.split(":");
  if (!selHex || !cleHex) return false;

  const attendue = Buffer.from(cleHex, "hex");
  const calculee = await scrypt(motDePasse, Buffer.from(selHex, "hex"), 64);
  return (
    attendue.length === calculee.length && timingSafeEqual(attendue, calculee)
  );
}

// ---------------------------------------------------------------------
//  Sessions
// ---------------------------------------------------------------------

function empreinte(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

/** Ouvre une session pour l'utilisateur et pose le cookie. */
export async function creerSession(userId: string): Promise<void> {
  const jeton = randomBytes(32).toString("base64url");
  const expireLe = new Date(Date.now() + DUREE_SESSION_MS);

  await prisma.session.create({
    data: { jetonHash: empreinte(jeton), userId, expireLe },
  });

  const magasin = await cookies();
  magasin.set(NOM_COOKIE, jeton, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expireLe,
  });
}

/** Ferme la session courante et supprime le cookie. */
export async function detruireSession(): Promise<void> {
  const magasin = await cookies();
  const jeton = magasin.get(NOM_COOKIE)?.value;
  if (jeton) {
    await prisma.session.deleteMany({ where: { jetonHash: empreinte(jeton) } });
  }
  magasin.delete(NOM_COOKIE);
}

// ---------------------------------------------------------------------
//  Lecture de l'utilisateur courant
// ---------------------------------------------------------------------

/** Utilisateur connecté, ou null. */
export async function utilisateurCourant(): Promise<UtilisateurApp | null> {
  const jeton = (await cookies()).get(NOM_COOKIE)?.value;
  if (!jeton) return null;

  const session = await prisma.session.findUnique({
    where: { jetonHash: empreinte(jeton) },
    include: {
      user: {
        include: {
          cv: { select: { id: true } },
          preferences: { select: { id: true } },
        },
      },
    },
  });

  if (!session || session.expireLe < new Date()) return null;

  const utilisateur = session.user;
  return {
    id: utilisateur.id,
    email: utilisateur.email,
    nom: utilisateur.nom,
    onboardingFait: Boolean(utilisateur.cv && utilisateur.preferences),
  };
}

/** Utilisateur connecté, ou redirection vers la page de connexion. */
export async function utilisateurRequis(): Promise<UtilisateurApp> {
  const utilisateur = await utilisateurCourant();
  if (!utilisateur) redirect("/connexion");
  return utilisateur;
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
