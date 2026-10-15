import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/auth";
import { FormulaireInscription } from "@/components/formulaire-inscription";

export const metadata: Metadata = {
  title: "Créer un compte",
};

export default async function PageInscription() {
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
            Créer ton compte
          </h1>
          <p className="text-slate-400 text-sm">
            Deux minutes pour déposer ton CV, et tu commences à swiper.
          </p>
        </div>

        <FormulaireInscription />
      </div>
    </main>
  );
}
