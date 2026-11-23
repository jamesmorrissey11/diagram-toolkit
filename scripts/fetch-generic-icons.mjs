// Regenerates the bundled, redistributable icon catalog from Iconify (run with network access).
//   generic: Lucide (ISC)  -> engine/icons/generic/<name>.svg, recoloured to a neutral ink
//   logos:   SVG Logos (CC0-1.0) -> engine/icons/logos/<name>.svg (brand colours kept; trademarks remain their owners')
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "skills/arch-diagram/engine/icons");
const INK = "#343a40";
const GENERIC = {
  user: "person, client, customer, human", users: "people, team, clients", globe: "web, internet, browser, website",
  "app-window": "web app, frontend, ui, application", smartphone: "mobile, phone, app", laptop: "desktop, client, workstation",
  monitor: "screen, dashboard, display", server: "server, host, vm, compute, backend, endpoint", "server-cog": "service, backend config",
  database: "database, db, sql, storage, data store", "hard-drive": "disk, storage, volume", cloud: "cloud, saas, hosted",
  "cloud-upload": "upload, ingest", "cloud-download": "download, export", cpu: "compute, processor, cpu",
  microchip: "gpu, accelerator, chip, hardware", brain: "model, ai, ml, intelligence", "brain-circuit": "neural network, training, ml model, deep learning",
  bot: "agent, llm, chatbot, assistant, ai", sparkles: "ai, generative, genai, magic", "message-square": "chat, message, conversation",
  "messages-square": "chat history, conversations, threads", workflow: "pipeline, orchestration, workflow, dag, etl",
  layers: "feature store, layers, stack, platform", package: "artifact, model registry, package, release", boxes: "containers, microservices",
  container: "container, docker, pod", network: "network, vpc, topology", router: "router, gateway, network edge",
  "shield-check": "security, guardrails, policy, safety", lock: "auth, encryption, private", "key-round": "secret, key, vault, credentials",
  "file-text": "document, file, pdf, text", files: "documents, corpus, files", folder: "folder, bucket, directory",
  search: "search, query, retrieval, index", "scan-search": "retriever, semantic search, vector search", activity: "monitoring, telemetry, metrics, drift",
  gauge: "performance, latency, slo", "chart-column": "analytics, metrics, chart, bi", bell: "alerts, notification",
  "calendar-clock": "schedule, cron, batch, nightly", timer: "timer, latency", "radio-tower": "events, stream, broadcast, kafka, pubsub",
  webhook: "webhook, callback, event", plug: "plugin, connector, integration", braces: "api, json, code", "square-terminal": "cli, terminal, shell",
  "git-branch": "git, version control, ci, branch", rocket: "deploy, release, launch", "clipboard-check": "eval, tests, checklist, qa",
  "flask-conical": "experiment, research, lab", "list-checks": "tasks, todo, checks", filter: "filter, rerank, guardrail",
  split: "router, fan-out, split", merge: "merge, aggregate, fan-in", repeat: "loop, retry, feedback", inbox: "queue, inbox, buffer",
  send: "send, publish, output", mail: "email, mail, notification", "credit-card": "payments, billing", "shopping-cart": "commerce, cart, orders",
  "layout-dashboard": "dashboard, admin, portal", table: "table, dataset, warehouse", binary: "embeddings, vectors, binary",
  "memory-stick": "memory, cache, ram", zap: "function, serverless, fast, trigger", "hand-helping": "human in the loop, review, support",
  "user-check": "approval, human review, reviewer", "scroll-text": "logs, audit, transcript", "notebook-pen": "notebook, jupyter, analysis",
};
const LOGOS = {
  "openai-icon": "openai, gpt, chatgpt", "anthropic-icon": "anthropic, claude", "hugging-face-icon": "hugging face, transformers, hf",
  "pytorch-icon": "pytorch, torch", tensorflow: "tensorflow, tf", "meta-icon": "meta, llama", 
  "microsoft-azure": "azure, microsoft", aws: "aws, amazon web services", "google-cloud": "gcp, google cloud", kubernetes: "kubernetes, k8s",
  "docker-icon": "docker", postgresql: "postgres, postgresql, pgvector", redis: "redis, cache", "mongodb-icon": "mongodb",
  elasticsearch: "elasticsearch, elastic", kafka: "apache kafka", "apache-spark": "spark", python: "python", "nodejs-icon": "node, nodejs",
  "react": "react, frontend", "github-icon": "github", "github-actions": "github actions, ci", "slack-icon": "slack", "snowflake-icon": "snowflake",
  "databricks-icon": "databricks", "claude-icon": "claude", "google-gemini-icon": "gemini", "mistral-ai-icon": "mistral",
  "cohere-icon": "cohere", ollama: "ollama, local llm", "weaviate-icon": "weaviate, vector db", "qdrant-icon": "qdrant, vector db",
  "milvus-icon": "milvus, vector db", chroma: "chroma, chromadb, vector db", "airflow-icon": "airflow", "terraform-icon": "terraform",
  "fastapi-icon": "fastapi", "pinecone-icon": "pinecone, vector db", "langchain-icon": "langchain", "nvidia": "nvidia, cuda, gpu", "grafana": "grafana",
  "prometheus": "prometheus", "vercel-icon": "vercel", "cloudflare-icon": "cloudflare", "stripe": "stripe",
};
// Source: iconify/icon-sets JSON (one download per set, licence metadata included; avoids the rate-limited CDN API).
import { readFile, stat } from "node:fs/promises";
const CACHE = path.join(ROOT, ".cache");
async function iconSet(prefix) {
  const file = path.join(CACHE, `iconify-${prefix}.json`);
  try { await stat(file); } catch {
    await mkdir(CACHE, { recursive: true });
    const r = await fetch(`https://raw.githubusercontent.com/iconify/icon-sets/master/json/${prefix}.json`);
    if (!r.ok) throw new Error(`download ${prefix}: ${r.status}`);
    await writeFile(file, await r.text());
  }
  return JSON.parse(await readFile(file, "utf8"));
}
function toSvg(set, name, color) {
  let icon = set.icons[name], n = name, extra = {};
  while (!icon && set.aliases?.[n]) { extra = { ...set.aliases[n], ...extra }; n = set.aliases[n].parent; icon = set.icons[n]; }
  if (!icon) return null;
  const w = extra.width ?? icon.width ?? set.width ?? 16, h = extra.height ?? icon.height ?? set.height ?? 16;
  let body = icon.body;
  if (color) body = body.replaceAll("currentColor", color);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${icon.left ?? 0} ${icon.top ?? 0} ${w} ${h}">${body}</svg>`;
}
for (const [ns, prefix, map, color] of [["generic", "lucide", GENERIC, INK], ["logos", "logos", LOGOS, null]]) {
  const set = await iconSet(prefix);
  const license = `${set.info?.license?.spdx || set.info?.license?.title} (${set.info?.name})${ns === "logos" ? "; trademarks belong to their owners" : ""}`;
  await mkdir(path.join(OUT, ns), { recursive: true });
  const index = {};
  for (const [name, tags] of Object.entries(map)) {
    const svg = toSvg(set, name, color);
    if (!svg) { console.error("missing", prefix, name); continue; }
    const slug = name.replace(/-icon$/, "");
    await writeFile(path.join(OUT, ns, `${slug}.svg`), svg);
    index[slug] = { title: slug.replace(/-/g, " "), tags: tags.split(",").map((s) => s.trim()), source: `iconify:${prefix}:${name}`, license };
  }
  await writeFile(path.join(OUT, ns, "index.json"), JSON.stringify(index, null, 1));
  console.log(ns, Object.keys(index).length);
}
