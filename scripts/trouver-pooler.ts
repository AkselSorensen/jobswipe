/**
 * Recherche du pooler hébergeant réellement le projet.
 *
 * Le message « ENOTFOUND tenant/user not found » du pooler signifie que le
 * pooler ne connaît pas ce projet — pas que le mot de passe est faux. Or
 * l'API REST du projet répond, donc le projet EXISTE.
 *
 * Deux explications restent :
 *   1. Le projet est sur un pooler d'une autre génération (aws-1, ou un
 *      préfixe régional différent).
 *   2. Le projet utilise la connexion directe IPv6 (db.<ref>.supabase.co),
 *      accessible uniquement si l'on a IPv6.
 *
 * On énumère donc les combinaisons de préfixe et de région, en filtrant
 * les erreurs : ENOTFOUND = pas ce pooler, autre chose = piste sérieuse.
 */
import { readFileSync } from "node:fs";

const REF = "nkpqmgwefhnmugdzlgtq";
const MDP = "jobshunnter";

const PREFIXES = ["aws-0", "aws-1"];
const REGIONS = [
  "eu-west-3", "eu-west-1", "eu-west-2", "eu-central-1", "eu-central-2",
  "eu-north-1", "eu-south-1", "eu-south-2", "us-east-1", "us-east-2",
  "us-west-1", "us-west-2", "ap-southeast-1", "ap-southeast-2",
  "ap-northeast-1", "ap-northeast-2", "ap-south-1", "sa-east-1",
  "ca-central-1", "ca-west-1", "af-south-1", "me-south-1",
];

function tester(utilisateur: string, hote: string): Promise<{
  statut: "ok" | "tenant_inconnu" | "autre";
  message: string;
}> {
  // On utilise le module pg brut pour contrôler précisément l'erreur
  return import("pg").then(
    ({ Client }) =>
      new Promise((resolve) => {
        const client = new Client({
          user: utilisateur,
          password: MDP,
          host: hote,
          port: 5432,
          database: "postgres",
          connectionTimeoutMillis: 6000,
          ssl: { rejectUnauthorized: false },
        });

        const finir = (statut: "ok" | "tenant_inconnu" | "autre", message: string) => {
          client.end().catch(() => {});
          resolve({ statut, message });
        };

        client.on("error", () => {});
        client
          .connect()
          .then(() => finir("ok", "connexion réussie"))
          .catch((e: Error) => {
            const msg = e.message ?? "";
            if (msg.includes("ENOTFOUND") || msg.includes("tenant/user")) {
              finir("tenant_inconnu", msg);
            } else {
              finir("autre", msg);
            }
          });
      })
  );
}

async function main() {
  console.log("=== Recherche du pooler du projet ===\n");
  console.log(`Projet : ${REF}\n`);

  const pistes: string[] = [];
  let trouve = false;

  for (const prefixe of PREFIXES) {
    for (const region of REGIONS) {
      const hote = `${prefixe}-${region}.pooler.supabase.com`;
      process.stdout.write(`  ${hote.padEnd(46)} `);

      const r = await tester(`postgres.${REF}`, hote);

      if (r.statut === "ok") {
        console.log("✔✔✔ CONNEXION RÉUSSIE");
        pistes.push(`TROUVÉ : ${hote}`);
        trouve = true;
      } else if (r.statut === "tenant_inconnu") {
        console.log("·");
      } else {
        console.log(`? ${r.message.slice(0, 58)}`);
        pistes.push(`${hote} → ${r.message.slice(0, 80)}`);
      }
    }
  }

  console.log("\n=== Pistes non triviales ===");
  if (pistes.length === 0) {
    console.log("  aucune — tous les poolers répondent « tenant inconnu »");
  } else {
    for (const p of pistes) console.log(`  ${p}`);
  }

  console.log(
    trouve
      ? "\n=== Pooler identifié ==="
      : "\n=== Aucun pooler ne reconnaît ce projet ===\n" +
          "  Le projet existe (API REST OK) mais aucun pooler ne le sert.\n" +
          "  Causes possibles :\n" +
          "    • projet en pause (dashboard → Restore)\n" +
          "    • projet supprimé puis recréé (nouvelle référence)\n" +
          "    • projet migré vers une infrastructure dédiée\n" +
          "  Vérifie l'état du projet dans le dashboard Supabase."
  );
}

main();
