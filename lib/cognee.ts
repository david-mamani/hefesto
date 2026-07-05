/*
 * Cognee Cloud REST client (server-side only — the API key never reaches the browser).
 *
 * Base URL comes from COGNEE_BASE_URL and every path is prefixed with /api/v1.
 * Known platform behaviors handled here:
 *   - 409: an errored pipeline blocks the dataset → recover with forget(memory_only) + re-cognify
 *   - 422 on search/recall: the graph does not exist yet (cognify still running)
 *   - permission denied reads return 200 with an empty array, not 403
 */

const API_PREFIX = "/api/v1";
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 600;

export class CogneeError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: string,
    public path: string
  ) {
    super(message);
    this.name = "CogneeError";
  }
}

export class StillMemorizingError extends CogneeError {
  constructor(status: number, body: string, path: string) {
    super("The graph for this dataset is still being built", status, body, path);
    this.name = "StillMemorizingError";
  }
}

export class PipelineBlockedError extends CogneeError {
  constructor(status: number, body: string, path: string) {
    super("An errored pipeline run is blocking this dataset", status, body, path);
    this.name = "PipelineBlockedError";
  }
}

type RequestOptions = {
  method?: string;
  json?: unknown;
  form?: FormData;
  query?: Record<string, string | string[] | number | boolean | undefined>;
  apiKey?: string;
  bearer?: string;
  retries?: number;
};

function baseUrl(): string {
  const url = process.env.COGNEE_BASE_URL;
  if (!url) throw new Error("COGNEE_BASE_URL is not set");
  return url.replace(/\/+$/, "");
}

function defaultApiKey(): string {
  const key = process.env.COGNEE_API_KEY;
  if (!key) throw new Error("COGNEE_API_KEY is not set");
  return key;
}

function buildQuery(query: RequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else {
      params.set(key, String(value));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function cogneeRequest<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", json, form, query, apiKey, bearer } = options;
  const retries = options.retries ?? MAX_RETRIES;
  const url = `${baseUrl()}${API_PREFIX}${path}${buildQuery(query)}`;

  const headers: Record<string, string> = {};
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  else headers["X-Api-Key"] = apiKey ?? defaultApiKey();
  if (json !== undefined) headers["Content-Type"] = "application/json";

  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: json !== undefined ? JSON.stringify(json) : form,
        cache: "no-store",
      });
    } catch (networkError) {
      lastError = networkError;
      continue;
    }

    if (res.ok) {
      const text = await res.text();
      if (!text) return undefined as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        return text as T;
      }
    }

    const body = await res.text().catch(() => "");
    if (res.status === 409) throw new PipelineBlockedError(res.status, body, path);
    if (res.status === 422) throw new StillMemorizingError(res.status, body, path);
    if (res.status === 429 || res.status >= 500) {
      lastError = new CogneeError(`Cognee ${res.status} on ${path}`, res.status, body, path);
      continue;
    }
    throw new CogneeError(`Cognee ${res.status} on ${path}`, res.status, body, path);
  }

  if (lastError instanceof CogneeError) throw lastError;
  throw new CogneeError(
    `Cognee request failed after ${retries} attempts: ${String(lastError)}`,
    0,
    "",
    path
  );
}

// ---------- Datasets ----------

export type CogneeDataset = {
  id: string;
  name: string;
  [key: string]: unknown;
};

export type CogneeDataItem = {
  id: string;
  name: string;
  created_at?: string;
  extension?: string;
  mime_type?: string;
  [key: string]: unknown;
};

export type CogneeGraph = {
  nodes: { id: string; label: string; properties?: Record<string, unknown> }[];
  edges: { source: string; target: string; label: string }[];
};

export const datasets = {
  list: (opts?: { apiKey?: string; bearer?: string }) =>
    cogneeRequest<CogneeDataset[]>("/datasets/", opts),

  // POST /datasets/ {name} is get-or-create idempotent
  getOrCreate: (name: string, opts?: { apiKey?: string; bearer?: string }) =>
    cogneeRequest<CogneeDataset>("/datasets/", { method: "POST", json: { name }, ...opts }),

  data: (datasetId: string, opts?: { apiKey?: string; bearer?: string }) =>
    cogneeRequest<CogneeDataItem[]>(`/datasets/${datasetId}/data`, opts),

  graph: (datasetId: string, opts?: { apiKey?: string; bearer?: string }) =>
    cogneeRequest<CogneeGraph>(`/datasets/${datasetId}/graph`, opts),

  // Batch status: {dataset_id: "pending"|"running"|"completed"|"failed"} (or nested per pipeline)
  status: (datasetIds: string[], pipeline?: string[]) =>
    cogneeRequest<Record<string, unknown>>("/datasets/status", {
      query: { dataset: datasetIds, pipeline },
    }),

  delete: (datasetId: string) =>
    cogneeRequest(`/datasets/${datasetId}`, { method: "DELETE" }),

  deleteData: (datasetId: string, dataId: string) =>
    cogneeRequest(`/datasets/${datasetId}/data/${dataId}`, { method: "DELETE" }),
};

// ---------- Ingestion ----------

export type RememberInput = {
  filename: string;
  content: string;
  datasetName?: string;
  datasetId?: string;
  ontologyKey?: string;
  nodeSet?: string[];
  sessionId?: string;
  runInBackground?: boolean;
  contentType?: string;
};

export async function remember(input: RememberInput) {
  const form = new FormData();
  form.append(
    "data",
    new Blob([input.content], { type: "text/markdown" }),
    input.filename
  );
  if (input.datasetName) form.append("datasetName", input.datasetName);
  if (input.datasetId) form.append("datasetId", input.datasetId);
  if (input.ontologyKey) form.append("ontology_key", input.ontologyKey);
  if (input.nodeSet) form.append("node_set", JSON.stringify(input.nodeSet));
  if (input.sessionId) form.append("session_id", input.sessionId);
  if (input.runInBackground !== undefined)
    form.append("run_in_background", String(input.runInBackground));
  if (input.contentType) form.append("content_type", input.contentType);

  return cogneeRequest<Record<string, unknown>>("/remember", {
    method: "POST",
    form,
  });
}

// Resilience path only (ladder step 2): inline text via /add + /cognify loses the ontology
export const addAndCognify = {
  add: (text: string, datasetName: string) =>
    cogneeRequest("/add", { method: "POST", json: { data: text, datasetName } }),
  cognify: (datasetNames: string[], runInBackground = true) =>
    cogneeRequest("/cognify", {
      method: "POST",
      json: { datasets: datasetNames, run_in_background: runInBackground },
    }),
};

// Recovery for a 409-blocked dataset: wipe graph+vectors (raw data survives), then re-cognify
export async function recoverBlockedDataset(datasetName: string) {
  await forget({ dataset: datasetName, memoryOnly: true });
  await addAndCognify.cognify([datasetName]);
}

// ---------- Search / recall ----------

export type SearchType =
  | "GRAPH_COMPLETION"
  | "RAG_COMPLETION"
  | "HYBRID_COMPLETION"
  | "CHUNKS"
  | "SUMMARIES"
  | "GRAPH_SUMMARY_COMPLETION"
  | "GRAPH_COMPLETION_COT"
  | "GRAPH_COMPLETION_DECOMPOSITION"
  | "GRAPH_COMPLETION_CONTEXT_EXTENSION"
  | "TRIPLET_COMPLETION"
  | "CHUNKS_LEXICAL"
  | "TEMPORAL"
  | "CYPHER"
  | "NATURAL_LANGUAGE"
  | "FEELING_LUCKY";

export type RecallInput = {
  query: string;
  searchType?: SearchType;
  datasets?: string[];
  datasetIds?: string[];
  sessionId?: string;
  includeReferences?: boolean;
  verbose?: boolean;
  topK?: number;
  systemPrompt?: string;
  onlyContext?: boolean;
  nodeName?: string[];
  scope?: string;
  apiKey?: string;
  bearer?: string;
};

// RecallPayloadDTO / search DTO use camelCase field names (verified in the tenant Swagger)
function searchBody(input: RecallInput) {
  return {
    query: input.query,
    searchType: input.searchType,
    datasets: input.datasets,
    datasetIds: input.datasetIds,
    topK: input.topK,
    systemPrompt: input.systemPrompt,
    onlyContext: input.onlyContext,
    nodeName: input.nodeName,
  };
}

export function search(input: RecallInput) {
  return cogneeRequest<unknown>("/search", {
    method: "POST",
    json: searchBody(input),
    apiKey: input.apiKey,
    bearer: input.bearer,
  });
}

// recall = search + session memory; use this everywhere (feeds sessions + feedback)
export function recall(input: RecallInput) {
  return cogneeRequest<unknown>("/recall", {
    method: "POST",
    json: {
      ...searchBody(input),
      sessionId: input.sessionId,
      includeReferences: input.includeReferences,
      verbose: input.verbose,
      scope: input.scope,
    },
    apiKey: input.apiKey,
    bearer: input.bearer,
  });
}

// The Evidence block is appended inside the answer text, not a separate JSON field
export function splitEvidence(answer: string): { text: string; evidence: string | null } {
  const marker = /\n\s*Evidence:\s*\n?/i;
  const match = answer.match(marker);
  if (!match || match.index === undefined) return { text: answer.trim(), evidence: null };
  return {
    text: answer.slice(0, match.index).trim(),
    evidence: answer.slice(match.index + match[0].length).trim(),
  };
}

// ---------- Forget ----------

export type ForgetInput = {
  dataset?: string;
  datasetId?: string;
  dataId?: string;
  memoryOnly?: boolean;
};

// ForgetPayloadDTO uses camelCase (verified in the tenant Swagger); `everything` is
// deliberately not exposed here — it wipes ALL datasets owned by the key.
export function forget(input: ForgetInput) {
  return cogneeRequest("/forget", {
    method: "POST",
    json: {
      dataset: input.dataset,
      datasetId: input.datasetId,
      dataId: input.dataId,
      memoryOnly: input.memoryOnly,
    },
  });
}

// ---------- Sessions + feedback + improve ----------

export const sessions = {
  list: (range: "24h" | "7d" | "30d" | "all" = "24h") =>
    cogneeRequest<unknown[]>("/sessions", { query: { range } }),
  get: (sessionId: string) => cogneeRequest<Record<string, unknown>>(`/sessions/${sessionId}`),
};

export type FeedbackEntryInput = {
  sessionId: string;
  qaId: string;
  score: number; // 1-5 (thumbs down = 1, thumbs up = 5)
  text?: string;
  datasetName?: string;
};

/*
 * RememberEntryRequest is a discriminated union on entry.type
 * (verified in the tenant Swagger). FeedbackEntry chains to a previous
 * QA via qa_id. Note: no /improve endpoint exists in the Cloud REST API —
 * storing feedback entries IS the REST feedback loop.
 */
export function rememberFeedbackEntry(input: FeedbackEntryInput) {
  return cogneeRequest<Record<string, unknown>>("/remember/entry", {
    method: "POST",
    json: {
      entry: {
        type: "feedback",
        qa_id: input.qaId,
        feedback_score: input.score,
        feedback_text: input.text,
      },
      dataset_name: input.datasetName,
      session_id: input.sessionId,
    },
  });
}

// ---------- Ontologies ----------

export const ontologies = {
  list: () => cogneeRequest<unknown[]>("/ontologies"),
  upload: (key: string, owlContent: string, description?: string) => {
    const form = new FormData();
    form.append("ontology_key", key);
    form.append(
      "ontology_file",
      new Blob([owlContent], { type: "application/rdf+xml" }),
      `${key}.owl`
    );
    if (description) form.append("description", description);
    return cogneeRequest("/ontologies", { method: "POST", form });
  },
  delete: (key: string) => cogneeRequest(`/ontologies/${key}`, { method: "DELETE" }),
};

// ---------- Principals + permissions (isolation pattern P2) ----------

export type PermissionName = "read" | "write" | "delete" | "share";

export const permissions = {
  // Body is a bare array of dataset UUIDs (verified in the tenant Swagger).
  // No revoke endpoint is exposed in the Cloud REST API.
  grant: (principalId: string, permission: PermissionName, datasetIds: string[]) =>
    cogneeRequest(`/permissions/datasets/${principalId}`, {
      method: "POST",
      query: { permission_name: permission },
      json: datasetIds,
    }),
};

export const principals = {
  /*
   * Probe for the P2 isolation pattern: the tenant data plane exposes no
   * /auth/register — if this 404s, provisioning degrades to P1 automatically.
   */
  register: (email: string, password: string) =>
    cogneeRequest<Record<string, unknown>>("/auth/register", {
      method: "POST",
      json: { email, password },
    }),
};

// Agent connections (same authenticated user) — platform presence, not principals
export const agents = {
  register: (input: {
    agentSessionName: string;
    sessionId?: string;
    datasetNames?: string[];
    source?: string;
  }) =>
    cogneeRequest<Record<string, unknown>>("/agents/register", {
      method: "POST",
      json: {
        agent_session_name: input.agentSessionName,
        session_id: input.sessionId,
        dataset_names: input.datasetNames,
        source: input.source,
      },
    }),
  connections: () => cogneeRequest<unknown[]>("/agents/connections"),
};

export function health() {
  return cogneeRequest("/health");
}
