/**
 * Client Prisma — singleton.
 *
 * En développement, Next.js recharge les modules à chaque modification :
 * sans ce garde-fou, chaque rechargement ouvrirait une nouvelle connexion
 * et saturerait le pool de Supabase en quelques minutes.
 */
import { PrismaClient } from "@prisma/client";

const globalPourPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalPourPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalPourPrisma.prisma = prisma;
}
