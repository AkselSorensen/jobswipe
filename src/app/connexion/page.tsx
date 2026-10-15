import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/auth";
import { FormulaireConnexion } from "@/components/formulaire-connexion";

export const metadata: Metadata = {
  title: "Connexion",
};

export default async function PageConnexion() {
  // Déjà connecté : inutile de repasser par le formulaire
  const utilisateur = await utilisateurCourant();
  if (utilisateur) {
    redirect(utilisateur.onboardingFait ? "/swipe" : "/onboarding");
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm mb-8 transition-colors"
        >
          <span className="text-lg">←</span> Retour
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="text-2xl">🎯</span>
            <span className="text-lg font-semibold tracking-tight">
              JobSwipe
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            Content de te revoir
          </h1>
          <p className="text-slate-400 text-sm">
            Connecte-toi pour retrouver tes offres et tes candidatures.
          </p>
        </div>

        <FormulaireConnexion />
      </div>
    </main>
  );
}
