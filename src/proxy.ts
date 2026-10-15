/**
 * Proxy — rafraîchissement de session Supabase.
 *
 * Nommé `proxy.ts` et non `middleware.ts` : depuis Next.js 16, la convention
 * `middleware` est dépréciée au profit de `proxy` (même comportement, même
 * emplacement). Garder l'ancien nom produit un avertissement à chaque build.
 *
 * Supabase stocke la session dans des cookies à durée limitée. Sans ce
 * rafraîchissement, un utilisateur dont le jeton a expiré se retrouve
 * déconnecté au milieu de sa navigation.
 *
 * IMPORTANT : ne pas insérer de logique entre la création du client et
 * `getUser()`, sinon les cookies rafraîchis ne seront pas propagés.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(requete: NextRequest) {
  let reponse = NextResponse.next({ request: requete });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return requete.cookies.getAll();
        },
        setAll(cookiesAecrire) {
          for (const { name, value } of cookiesAecrire) {
            requete.cookies.set(name, value);
          }
          reponse = NextResponse.next({ request: requete });
          for (const { name, value, options } of cookiesAecrire) {
            reponse.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Déclenche le rafraîchissement du jeton si nécessaire
  await supabase.auth.getUser();

  return reponse;
}

export const config = {
  matcher: [
    /*
     * Toutes les routes sauf :
     *  - _next/static, _next/image : ressources statiques
     *  - favicon et fichiers d'images
     *  - /api/cron : appelé par le planificateur, sans session utilisateur
     */
    "/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
