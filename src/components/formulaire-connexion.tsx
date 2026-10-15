"use client";

/**
 * Formulaire de connexion : email et mot de passe.
 */
import { useActionState } from "react";
import Link from "next/link";
import { connexion, type EtatFormulaire } from "@/lib/auth-actions";
import { bouton, champ, surface } from "@/lib/design";

const ETAT_INITIAL: EtatFormulaire = {};

export function FormulaireConnexion() {
  const [etat, action, enCours] = useActionState(connexion, ETAT_INITIAL);

  return (
    <form action={action} className={`${surface.carte} p-7 sm:p-9 space-y-5`}>
      <div>
        <label htmlFor="email" className={champ.label}>
          Adresse email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="prenom.nom@exemple.fr"
          className={champ.base}
        />
      </div>

      <div>
        <label htmlFor="motDePasse" className={champ.label}>
          Mot de passe
        </label>
        <input
          id="motDePasse"
          name="motDePasse"
          type="password"
          autoComplete="current-password"
          required
          className={champ.base}
        />
      </div>

      {etat.erreur && (
        <p role="alert" className={champ.erreurTexte}>
          {etat.erreur}
        </p>
      )}

      <button
        type="submit"
        disabled={enCours}
        className={`${bouton.base} ${bouton.primaire} ${bouton.taille.lg} w-full`}
      >
        {enCours ? "Connexion…" : "Se connecter"}
      </button>

      <p className="text-sm text-center text-slate-500">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="text-emerald-400 hover:text-emerald-300">
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
