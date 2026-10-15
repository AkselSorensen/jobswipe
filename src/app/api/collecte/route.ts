/**
 * Collecte périodique — à déclencher par un cron (Vercel Cron, GitHub Actions…).
 *
 * Protégé par `CRON_SECRET` : sans le bon jeton Bearer, la route répond 401.
 * Une collecte est lancée par jeu de préférences, pour que chaque utilisateur
 * alimente la base avec ses critères sans partager ses décisions.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { collecterPourPreferences } from "@/lib/collecte";

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { erreur: "CRON_SECRET non configuré." },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });
  }

  const listePreferences = await prisma.preferences.findMany();

  const bilans = [];
  for (const preferences of listePreferences) {
    const bilan = await collecterPourPreferences(preferences);
    bilans.push(bilan);
  }

  return NextResponse.json({ collectes: bilans.length, bilans });
}
