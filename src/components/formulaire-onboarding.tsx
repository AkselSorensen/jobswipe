"use client";

/**
 * Formulaire d'onboarding : CV collé en texte, postes recherchés, zone.
 */
import { useActionState } from "react";
import {
  enregistrerProfil,
  type EtatOnboarding,
} from "@/lib/onboarding-actions";
import { bouton, champ, surface } from "@/lib/design";

const ETAT_INITIAL: EtatOnboarding = {};

export function FormulaireOnboarding() {
  const [etat, action, enCours] = useActionState(
    enregistrerProfil,
    ETAT_INITIAL
  );

  return (
    <form action={action} className={`${surface.carte} p-7 sm:p-9 space-y-6`}>
      <div>
        <label htmlFor="texteCv" className={champ.label}>
          Ton CV (texte complet)
        </label>
        <textarea
          id="texteCv"
          name="texteCv"
          required
          rows={10}
          placeholder="Colle ici le texte de ton CV…"
          className={`${champ.base} resize-y`}
        />
        <p className={champ.aide}>
          Copie-colle le contenu de ton CV. L&apos;import PDF viendra ensuite.
        </p>
      </div>

      <div>
        <label htmlFor="motsCles" className={champ.label}>
          Postes recherchés
        </label>
        <input
          id="motsCles"
          name="motsCles"
          required
          placeholder="ingénieur ia, ml engineer"
          className={champ.base}
        />
        <p className={champ.aide}>Sépare les intitulés par des virgules.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="communes" className={champ.label}>
            Codes INSEE des communes
          </label>
          <input
            id="communes"
            name="communes"
            placeholder="75056, 69123"
            className={champ.base}
          />
          <p className={champ.aide}>Laisse vide pour chercher partout en France.</p>
        </div>

        <div>
          <label htmlFor="rayonKm" className={champ.label}>
            Rayon (km)
          </label>
          <input
            id="rayonKm"
            name="rayonKm"
            type="number"
            min={1}
            max={200}
            defaultValue={35}
            className={champ.base}
          />
        </div>

        <div>
          <label htmlFor="contrat" className={champ.label}>
            Type de contrat
          </label>
          <select id="contrat" name="contrat" defaultValue="CDI" className={champ.base}>
            <option value="CDI">CDI</option>
            <option value="CDD">CDD</option>
            <option value="MIS">Intérim (MIS)</option>
          </select>
        </div>

        <div>
          <label htmlFor="salaireMin" className={champ.label}>
            Salaire annuel minimum (€)
          </label>
          <input
            id="salaireMin"
            name="salaireMin"
            type="number"
            min={0}
            placeholder="Facultatif"
            className={champ.base}
          />
        </div>
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
        {enCours ? "Analyse de ton profil…" : "Commencer à swiper"}
      </button>
    </form>
  );
}
