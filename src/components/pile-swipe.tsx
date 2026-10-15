"use client";

/**
 * Pile de swipe, style Tinder.
 *
 * Une carte plein format, la suivante visible derrière. On glisse la carte
 * à droite (intéressé), à gauche (passer), ou on utilise les boutons ronds
 * (★ favori au centre). L'enregistrement part en arrière-plan : la carte
 * suivante s'affiche tout de suite.
 *
 * Raccourcis clavier : ← passer, → intéressé, F favori.
 */
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { decider } from "@/lib/swipe-actions";
import type { Decision, OffrePile } from "@/lib/swipe";
import { libelleSource } from "@/lib/design";

interface Props {
  offres: OffrePile[];
}

/** Distance de glissement (px) au-delà de laquelle la carte est validée. */
const SEUIL = 110;
/** Durée de l'animation de sortie, en ms. */
const DUREE_SORTIE = 320;

export function PileSwipe({ offres }: Props) {
  const [index, setIndex] = useState(0);
  const [dx, setDx] = useState(0);
  const [sortie, setSortie] = useState<Decision | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [glisse, setGlisse] = useState(false);
  const [enCours, startTransition] = useTransition();
  const depart = useRef<number | null>(null);

  const offre = offres[index];
  const suivante = offres[index + 1];

  function valider(decision: Decision) {
    if (!offre || sortie) return;
    setSortie(decision);
    setErreur(null);

    startTransition(async () => {
      const resultat = await decider(offre.id, decision);
      if (resultat.erreur) setErreur(resultat.erreur);
    });

    window.setTimeout(() => {
      setIndex((i) => i + 1);
      setSortie(null);
      setDx(0);
    }, DUREE_SORTIE);
  }

  // Raccourcis clavier
  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") valider("PASS");
      else if (e.key === "ArrowRight") valider("LIKE");
      else if (e.key.toLowerCase() === "f") valider("FAVORI");
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
    // `valider` change à chaque rendu ; on réenregistre quand la carte change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offre, sortie]);

  // -- Glisser -------------------------------------------------------
  function debutGlisse(e: ReactPointerEvent<HTMLDivElement>) {
    if (sortie) return;
    depart.current = e.clientX;
    setGlisse(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function enGlisse(e: ReactPointerEvent<HTMLDivElement>) {
    if (depart.current === null) return;
    setDx(e.clientX - depart.current);
  }

  function finGlisse() {
    if (depart.current === null) return;
    depart.current = null;
    setGlisse(false);
    if (dx > SEUIL) valider("LIKE");
    else if (dx < -SEUIL) valider("PASS");
    else setDx(0);
  }

  // -- Fin de pile ---------------------------------------------------
  if (!offre) {
    return (
      <div className="h-[72vh] min-h-[480px] max-h-[660px] flex flex-col items-center justify-center text-center gap-4 px-8 rounded-[28px] bg-[#111820] border border-[#1e2833]">
        <div className="text-6xl">🔥</div>
        <p className="text-xl font-bold">Tu as tout parcouru</p>
        <p className="text-sm text-slate-400">
          Plus d&apos;offres au-dessus de ton seuil pour le moment. Les nouvelles
          arrivent au fil des collectes.
        </p>
        {erreur && <p className="text-sm text-red-400">{erreur}</p>}
      </div>
    );
  }

  const rotation = dx / 20;
  const opaciteLike = Math.min(1, Math.max(0, dx / SEUIL));
  const opacitePasse = Math.min(1, Math.max(0, -dx / SEUIL));

  // Position pendant la sortie (animation), sinon suit le doigt
  let transformCarte = `translate3d(${dx}px, 0, 0) rotate(${rotation}deg)`;
  if (sortie === "LIKE") transformCarte = "translate3d(140%, 0, 0) rotate(22deg)";
  if (sortie === "PASS") transformCarte = "translate3d(-140%, 0, 0) rotate(-22deg)";
  if (sortie === "FAVORI") transformCarte = "translate3d(0, -140%, 0) scale(0.9)";

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xl font-extrabold tracking-tight bg-linear-to-r from-[#fd5564] to-[#ff8a5b] bg-clip-text text-transparent">
          JobSwipe
        </span>
        <span className="text-xs text-slate-500 tabular-nums">
          {index + 1} / {offres.length}
        </span>
      </div>

      {/* Pile */}
      <div className="relative h-[72vh] min-h-[480px] max-h-[660px] select-none touch-none">
        {suivante && (
          <div
            aria-hidden
            className="absolute inset-0 rounded-[28px] overflow-hidden scale-[0.95] translate-y-4 opacity-70"
          >
            <FondCarte entreprise={suivante.entreprise} />
          </div>
        )}

        <article
          key={offre.id}
          onPointerDown={debutGlisse}
          onPointerMove={enGlisse}
          onPointerUp={finGlisse}
          onPointerCancel={finGlisse}
          style={{
            transform: transformCarte,
            transition: glisse ? "none" : `transform ${DUREE_SORTIE}ms ease-out`,
          }}
          className="absolute inset-0 rounded-[28px] overflow-hidden shadow-2xl shadow-black/50 cursor-grab active:cursor-grabbing"
        >
          <FondCarte entreprise={offre.entreprise} />

          {/* Tampons */}
          <div
            className="absolute top-10 left-6 -rotate-12 border-[3px] border-[#00d68f] text-[#00d68f] rounded-lg px-3 py-1 text-3xl font-extrabold tracking-wide pointer-events-none"
            style={{ opacity: opaciteLike }}
          >
            INTÉRESSÉ
          </div>
          <div
            className="absolute top-10 right-6 rotate-12 border-[3px] border-[#ff4d6d] text-[#ff4d6d] rounded-lg px-3 py-1 text-3xl font-extrabold tracking-wide pointer-events-none"
            style={{ opacity: opacitePasse }}
          >
            PASSER
          </div>

          {/* Score */}
          <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md rounded-full px-3 py-1 text-xs font-semibold text-white">
            {Math.round(offre.score)}% pertinent
          </div>

          {/* Infos */}
          <div className="absolute inset-x-0 bottom-0 p-6 pt-24 bg-linear-to-t from-black via-black/80 to-transparent text-white space-y-3">
            <div>
              <p className="text-sm text-white/70 truncate">{offre.entreprise}</p>
              <h2 className="text-2xl font-bold leading-tight line-clamp-2">
                {offre.titre}
              </h2>
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs">
              {offre.lieu && <Pastille>📍 {offre.lieu}</Pastille>}
              {offre.contrat && <Pastille>{offre.contrat}</Pastille>}
              {offre.salaire && <Pastille>💶 {offre.salaire}</Pastille>}
              <Pastille>{libelleSource(offre.source).nom}</Pastille>
            </div>

            {offre.details.competencesCouvertes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 text-xs">
                {offre.details.competencesCouvertes.slice(0, 4).map((c) => (
                  <span
                    key={c}
                    className="px-2 py-0.5 rounded-full bg-[#fd5564]/20 text-[#ffb3bc] border border-[#fd5564]/40"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}

            <p className="text-sm text-white/75 line-clamp-2">{offre.description}</p>

            <a
              href={offre.url}
              target="_blank"
              rel="noopener noreferrer"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="inline-block text-sm font-semibold text-white underline underline-offset-4"
            >
              Voir l&apos;offre ↗
            </a>
          </div>
        </article>
      </div>

      {/* Boutons */}
      <div className="flex items-center justify-center gap-6">
        <BoutonRond
          label="Passer"
          onClick={() => valider("PASS")}
          disabled={enCours || !!sortie}
          taille="h-16 w-16"
          classe="bg-white text-[#ff4d6d]"
        >
          <IconeX />
        </BoutonRond>
        <BoutonRond
          label="Favori"
          onClick={() => valider("FAVORI")}
          disabled={enCours || !!sortie}
          taille="h-12 w-12"
          classe="bg-white text-[#ffb400]"
        >
          <IconeEtoile />
        </BoutonRond>
        <BoutonRond
          label="Intéressé"
          onClick={() => valider("LIKE")}
          disabled={enCours || !!sortie}
          taille="h-16 w-16"
          classe="bg-linear-to-br from-[#fd5564] to-[#ff8a5b] text-white"
        >
          <IconeCoeur />
        </BoutonRond>
      </div>

      {erreur && <p className="text-sm text-red-400 text-center">{erreur}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------
//  Morceaux d'interface
// ---------------------------------------------------------------------

/**
 * Fond de carte : dégradé dont la teinte dépend de l'entreprise, et initiale
 * en grand. Remplace la photo de profil de Tinder.
 */
function FondCarte({ entreprise }: { entreprise: string }) {
  const teinte = [...entreprise].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const initiale = entreprise.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{
        background: `linear-gradient(160deg, hsl(${teinte} 70% 45%), hsl(${(teinte + 50) % 360} 60% 22%))`,
      }}
    >
      <span className="text-[9rem] font-black text-white/15 select-none">
        {initiale}
      </span>
    </div>
  );
}

function Pastille({ children }: { children: ReactNode }) {
  return (
    <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white/90 truncate max-w-full">
      {children}
    </span>
  );
}

function BoutonRond({
  label,
  onClick,
  disabled,
  taille,
  classe,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  taille: string;
  classe: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`${taille} ${classe} rounded-full shadow-lg shadow-black/40 flex items-center justify-center transition-transform active:scale-90 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100`}
    >
      {children}
    </button>
  );
}

function IconeX() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function IconeEtoile() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" />
    </svg>
  );
}

function IconeCoeur() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21s-7.5-4.6-9.6-9.1C.9 8.6 2.9 5 6.5 5c2 0 3.5 1.1 4.5 2.6C12 6.1 13.5 5 15.5 5c3.6 0 5.6 3.6 4.1 6.9C19.5 16.4 12 21 12 21z" />
    </svg>
  );
}
