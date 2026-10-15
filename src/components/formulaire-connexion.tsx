"use client";

/**
 * Formulaire de connexion.
 *
 * Deux onglets : mot de passe et lien magique. Le lien magique est mis en
 * avant car il évite de gérer un mot de passe — moins de friction à
 * l'inscription, et moins de risques.
 */
import { useActionState, useState } from "react";
import Link from "next/link";
import { connexion, lienMagique, type EtatFormulaire } from "@/lib/auth-actions";
import { bouton, champ, surface } from "@/lib/design";

const ETAT_INITIAL: EtatFormulaire = {};

export function FormulaireConnexion() {
  const [mode, setMode] = useState<"motdepasse" | "lien">("lien");

  const [etatMdp, actionMdp, enCoursMdp] = useActionState(
    connexion,
    ETAT_INITIAL
  );
  const [etatLien, actionLien, enCoursLien] = useActionState(
    lienMagique,
    ETAT_INITIAL
  );

  const etat = mode === "motdepasse" ? etatMdp : etatLien;
  const enCours = mode === "motdepasse" ? enCoursMdp : enCoursLien;
  const action = mode === "motdepasse" ? actionMdp : actionLien;

  return (
    <div className={`${surface.carte} p-7 sm:p-9`}>
      {/* Onglets */}
      <div className="flex gap-1 mb-7 p-1 bg-[#0d141c] rounded-lg border border-[#1e2833]">
        <button
          type="button"
          onClick={() => setMode("lien")}
          className={`flex-1 text-sm py-2 rounded-md transition-colors ${
            mode === "lien"
              ? "bg-[#16202c] text-slate-100 font-medium"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Lien par email
        </button>
        <button
          type="button"
          onClick={() => setMode("motdepasse")}
          className={`flex-1 text-sm py-2 rounded-md transition-colors ${
            mode === "motdepasse"
              ? "bg-[#16202c] text-slate-100 font-medium"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Mot de passe
        </button>
      </div>

      <form action={action} className="space-y-5">
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
        </div>

        {mode === "motdepasse" && (
          <div className="anim-fondu">
            <label htmlFor="motDePasse" className={champ.label}>
              Mot de passe
            </label>
            <input
              id="motDePasse"
              name="motDePasse"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className={champ.base}
            />
          </div>
        )}

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
          className={classesBoutonPrimaire()}
        >
          {enCours
            ? "Envoi…"
            : mode === "lien"
              ? "Recevoir un lien de connexion"
              : "Se connecter"}
        </button>
      </form>

      {mode === "lien" && (
        <p className={champ.aide}>
          Aucun mot de passe à retenir : nous t&apos;envoyons un lien
          d&apos;accès à usage unique.
        </p>
      )}

      <p className="text-sm text-slate-500 mt-7 pt-6 border-t border-[#1e2833]">
        Pas encore de compte ?{" "}
        <Link
          href="/inscription"
          className="text-emerald-400 hover:text-emerald-300 font-medium"
        >
          Créer un compte
        </Link>
      </p>
    </div>
  );
}

function classesBoutonPrimaire(): string {
  return [
    bouton.base,
    bouton.primaire,
    bouton.taille.lg,
    "w-full",
  ].join(" ");
}
