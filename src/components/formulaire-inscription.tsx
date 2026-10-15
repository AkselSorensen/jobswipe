"use client";

/** Formulaire d'inscription : nom, email, mot de passe. */
import { useActionState } from "react";
import Link from "next/link";
import { inscription, type EtatFormulaire } from "@/lib/auth-actions";
import { bouton, champ, surface } from "@/lib/design";

const ETAT_INITIAL: EtatFormulaire = {};

export function FormulaireInscription() {
  const [etat, action, enCours] = useActionState(inscription, ETAT_INITIAL);

  return (
    <div className={`${surface.carte} p-7 sm:p-9`}>
      <form action={action} className="space-y-5">
        <div>
          <label htmlFor="nom" className={champ.label}>
            Nom complet
          </label>
          <input
            id="nom"
            name="nom"
            type="text"
            required
            autoComplete="name"
            placeholder="Aksel Sorensen"
            className={champ.base}
          />
        </div>

        <div>
          <label htmlFor="email" className={champ.label}>
            Adresse email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="prenom.nom@exemple.fr"
            className={champ.base}
          />
          <p className={champ.aide}>
            Sert uniquement à te connecter et à t&apos;envoyer tes rappels.
          </p>
        </div>

        <div>
          <label htmlFor="motDePasse" className={champ.label}>
            Mot de passe
          </label>
          <input
            id="motDePasse"
            name="motDePasse"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="8 caractères minimum"
            className={champ.base}
          />
        </div>

        {etat.erreur && (
          <p className="anim-fondu text-sm text-red-400 bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-3">
            {etat.erreur}
          </p>
        )}
        {etat.succes && (
          <p className="anim-fondu text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-4 py-3">
            {etat.succes}
          </p>
        )}

        <button
          type="submit"
          disabled={enCours}
          className={[bouton.base, bouton.primaire, bouton.taille.lg, "w-full"].join(
            " "
          )}
        >
          {enCours ? "Création…" : "Créer mon compte"}
        </button>
      </form>

      <p className="text-xs text-slate-600 mt-5 leading-relaxed">
        Ton CV et tes données restent privés. Tu peux supprimer ton compte et
        l&apos;intégralité de tes données à tout moment.
      </p>

      <p className="text-sm text-slate-500 mt-7 pt-6 border-t border-[#1e2833]">
        Déjà inscrit ?{" "}
        <Link
          href="/connexion"
          className="text-emerald-400 hover:text-emerald-300 font-medium"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}
