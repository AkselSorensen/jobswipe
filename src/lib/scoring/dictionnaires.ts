/**
 * Dictionnaires métier — compétences, postes visés, secteurs.
 *
 * Portés depuis le projet local (`cv_parser.py`). Ils sont volontairement
 * en dur plutôt qu'en base : ils changent rarement, et les garder dans le
 * code permet de les versionner avec le moteur de scoring qui les utilise.
 *
 * Pour ajouter une compétence, il suffit de l'ajouter ici : le scoring et le
 * parsing de CV la prendront en compte automatiquement.
 */

/** Compétences reconnues, par catégorie. Sert au parsing CV ET au scoring. */
export const COMPETENCES_CONNUES: Record<string, string[]> = {
  "IA / ML": [
    "llm", "large language model", "fine-tuning", "finetuning", "ollama",
    "prompt engineering", "agents ia", "ai agents", "rag", "embeddings",
    "computer vision", "deep learning", "machine learning", "gnn",
    "graph neural network", "lstm", "nlp", "transformer", "xgboost",
    "scikit-learn", "sklearn", "pytorch", "tensorflow", "keras",
    "model drift", "benchmarking", "feature engineering", "data mining",
    "random forest", "gradient boosting", "reinforcement learning",
    "generative ai", "genai", "ia generative", "mistral", "langchain",
    "vector database", "qdrant", "pinecone", "faiss", "hugging face",
  ],
  Backend: [
    "python", "fastapi", "flask", "django", "java", "spring boot", "go",
    "golang", "node.js", "nodejs", "express", "symfony", "php", "c#",
    ".net", "rust", "graphql", "api rest", "rest api", "grpc",
    "microservices", "websocket", "celery", "sqlalchemy",
  ],
  Frontend: [
    "react", "react 19", "vue", "vue.js", "angular", "typescript",
    "javascript", "next.js", "tailwind", "maplibre", "webgl", "html",
    "css", "sass", "vite", "webpack",
  ],
  "Data / BDD": [
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "sqlite",
    "neo4j", "clickhouse", "sql", "etl", "airflow", "spark", "kafka",
    "pandas", "numpy", "databricks", "dbt", "snowflake", "bigquery",
  ],
  "DevOps / Cloud": [
    "docker", "kubernetes", "k8s", "aws", "s3", "gcp", "azure",
    "terraform", "ansible", "ci/cd", "github actions", "gitlab ci",
    "jenkins", "nginx", "traefik", "linux", "git", "serverless",
    "vercel", "supabase",
  ],
  Observabilité: [
    "prometheus", "grafana", "cadvisor", "blackbox exporter", "loki",
    "opentelemetry", "elk", "kibana", "datadog", "sentry",
  ],
  "Sécurité / OSINT": [
    "osint", "cybersécurité", "cybersecurity", "soc", "siem",
    "renseignement", "geospatial", "defense tech", "blockchain",
    "systèmes distribués", "chiffrement",
  ],
};

/** Postes visés : sert à évaluer la correspondance d'un titre d'offre. */
export const POSTES_VISES: string[] = [
  "ingénieur ia",
  "ingenieur ia",
  "ingénieur intelligence artificielle",
  "lead ia",
  "tech lead ia",
  "architecte solutions ia",
  "architecte ia",
  "architecte logiciel",
  "architecte solutions",
  "ingénieur r&d ia",
  "machine learning engineer",
  "ai engineer",
  "ml engineer",
  "data scientist",
  "ai architect",
  "lead data scientist",
  "ingénieur machine learning",
  "ingénieur données",
  "ai tech lead",
];

/** Secteurs détectés dans le texte d'une offre. */
export const SECTEURS: Record<string, string[]> = {
  "Defense Tech": [
    "defense", "défense", "militaire", "armement", "aero", "aérospatial",
    "spatial", "thales", "safran", "dassault", "naval group", "mbda",
  ],
  "OSINT / Renseignement": [
    "osint", "renseignement", "intelligence", "veille", "geopolitique",
    "géopolitique",
  ],
  FinTech: [
    "fintech", "banque", "bank", "paiement", "payment", "assurance",
    "finance", "credit", "crédit", "trading",
  ],
  Santé: [
    "santé", "sante", "health", "medical", "médical", "medtech", "e-santé",
    "hôpital", "hopital", "pharma",
  ],
  "Tourisme / Voyage": [
    "tourisme", "voyage", "travel", "hotel", "hôtel", "booking",
    "aviation",
  ],
  Industrie: [
    "industrie", "industriel", "manufacturing", "usine", "production",
    "automobile", "automotive", "énergie", "energie",
  ],
  "Tech / SaaS": [
    "saas", "startup", "scale-up", "editeur", "éditeur", "logiciel",
    "cloud", "plateforme",
  ],
  Conseil: [
    "conseil", "consulting", "cabinet", "esn", "integration", "intégration",
  ],
};

/** Liste plate de toutes les compétences, pour les recherches rapides. */
export const TOUTES_COMPETENCES: string[] = Object.values(
  COMPETENCES_CONNUES
).flat();

/** Catégorie d'une compétence, ou undefined si inconnue. */
export function categorieCompetence(competence: string): string | undefined {
  for (const [categorie, liste] of Object.entries(COMPETENCES_CONNUES)) {
    if (liste.includes(competence)) return categorie;
  }
  return undefined;
}
