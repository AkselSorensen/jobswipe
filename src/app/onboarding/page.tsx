import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { utilisateurRequis } from "@/lib/auth";
import { FormulaireOnboarding } from "@/components/formulaire-onboarding";

export const metadata: Metadata = {
  title: "Ton profil",
};

export default async function PageOnboarding() {
  const utilisateur = await utilisateurRequis();
  // Profil déjà complet : inutile de le ressaisir
  if (utilisateur.onboardingFait) redirect("/swipe");

  return (
    <main className="flex-1 flex flex-col items-center px-5 py-12">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight mb-2">
            Présente-toi en quelques lignes
          </h1>
          <p className="text-slate-400 text-sm">
            On s&apos;en sert pour trier les offres. Tu pourras changer ces
            informations plus tard.
          </p>
        </div>

        <FormulaireOnboarding />
      </div>
    </main>
  );
}
