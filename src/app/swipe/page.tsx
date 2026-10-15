import type { Metadata } from "next";
import { utilisateurPret } from "@/lib/auth";
import { pileDeSwipe } from "@/lib/swipe";
import { PileSwipe } from "@/components/pile-swipe";

export const metadata: Metadata = {
  title: "Swipe",
};

// La pile dépend de l'utilisateur et des décisions : jamais de cache
export const dynamic = "force-dynamic";

export default async function PageSwipe() {
  const utilisateur = await utilisateurPret();
  const offres = await pileDeSwipe(utilisateur.id);

  return (
    <main className="flex-1 flex flex-col items-center px-5 py-10">
      <div className="w-full max-w-md">
        <PileSwipe offres={offres} />
      </div>
    </main>
  );
}
