/**
 * Callback d'authentification.
 *
 * Supabase redirige ici après :
 *  - une confirmation d'adresse email
 *  - un clic sur un lien magique
 *  - une réinitialisation de mot de passe
 *
 * Le paramètre `code` doit être échangé contre une session avant de
 * rediriger : sans cet échange, l'utilisateur arrive connecté « à moitié »,
 * avec des cookies de session invalides.
 */
import { NextResponse, type NextRequest } from "next/server";
import { clientServeur } from "@/lib/supabase";

export async function GET(requete: NextRequest) {
  const { searchParams, origin } = new URL(requete.url);
  const code = searchParams.get("code");
  const suivant = searchParams.get("suivant") ?? "/onboarding";

  if (!code) {
    return NextResponse.redirect(`${origin}/connexion?erreur=code_absent`);
  }

  const supabase = await clientServeur();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/connexion?erreur=${encodeURIComponent(error.message)}`
    );
  }

  // `suivant` vient de l'URL : on n'accepte qu'un chemin interne, jamais
  // une URL absolue, pour éviter une redirection ouverte.
  const destination = suivant.startsWith("/") ? suivant : "/onboarding";
  return NextResponse.redirect(`${origin}${destination}`);
}
