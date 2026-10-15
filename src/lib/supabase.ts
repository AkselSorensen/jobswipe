/**
 * Client Supabase — navigateur et serveur.
 *
 * Trois clients distincts, et la distinction est essentielle :
 *
 *  - `createBrowserClient` : côté navigateur, soumis aux Row Level Security.
 *    C'est le client par défaut pour les composants client.
 *
 *  - `createServerClient` : côté serveur, lit les cookies de session pour
 *    connaître l'utilisateur courant. Reste soumis aux RLS — c'est ce qu'on
 *    veut pour tout ce qui touche aux données de l'utilisateur.
 *
 *  - `createAdminClient` : utilise la clé secrète et CONTOURNE les RLS.
 *    Réservé aux traitements de fond (collecte d'offres, cron) qui n'ont pas
 *    de session utilisateur. Ne doit jamais être importé dans un composant
 *    client.
 */
import { createBrowserClient } from "@supabase/ssr";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const CLE_PUBLIQUE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/** Client navigateur — à utiliser dans les composants "use client". */
export function clientNavigateur() {
  return createBrowserClient(URL_SUPABASE, CLE_PUBLIQUE);
}

/** Client serveur — lit la session depuis les cookies de la requête. */
export async function clientServeur() {
  const stockageCookies = await cookies();

  return createServerClient(URL_SUPABASE, CLE_PUBLIQUE, {
    cookies: {
      getAll() {
        return stockageCookies.getAll();
      },
      setAll(cookiesAecrire) {
        try {
          for (const { name, value, options } of cookiesAecrire) {
            stockageCookies.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component en lecture seule : on ignore.
          // Le rafraîchissement de session est géré par le middleware.
        }
      },
    },
  });
}

/**
 * Client administrateur — CONTOURNE les RLS.
 *
 * Réservé aux traitements sans session utilisateur : cron de collecte,
 * maintenance. Toute fuite de cette clé donne un accès total à la base.
 */
export function clientAdmin() {
  const cleSecrete = process.env.SUPABASE_SECRET_KEY;
  if (!cleSecrete) {
    throw new Error(
      "SUPABASE_SECRET_KEY manquante : impossible de créer le client admin."
    );
  }
  return createClient(URL_SUPABASE, cleSecrete, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
