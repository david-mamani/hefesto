import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptJson } from "@/lib/crypto";
import { datasets, permissions, principals } from "@/lib/cognee";

/*
 * Per-user memory provisioning (runs on first login).
 *
 * Isolation pattern comes from ISOLATION_PATTERN (set after the smoke-test verdict):
 *   p1 — one master principal; each user gets dataset user_{id}; the app enforces scoping.
 *   p2 — the backend creates an internal Cognee principal per user, revokes the
 *        default tenant-wide grant on their dataset and grants read|write to that
 *        principal only, so the platform enforces isolation. Synthetic credentials
 *        are stored encrypted with APP_SECRET. If any P2 step fails, provisioning
 *        automatically degrades to p1 for that user.
 */

export type UserMemory = {
  userId: string;
  datasetId: string;
  datasetName: string;
  isolationPattern: "p1" | "p2";
  cogneePrincipalId: string | null;
};

type UsersCogneeRow = {
  user_id: string;
  cognee_principal_id: string | null;
  dataset_id: string | null;
  dataset_name: string | null;
  isolation_pattern: "p1" | "p2" | null;
  principal_credentials: string | null;
};

function datasetNameFor(userId: string): string {
  return `user_${userId.replaceAll("-", "")}`;
}

function configuredPattern(): "p1" | "p2" {
  return process.env.ISOLATION_PATTERN === "p2" ? "p2" : "p1";
}

export async function ensureProvisioned(userId: string): Promise<UserMemory> {
  const supabase = createAdminClient();

  const { data: existing, error: readError } = await supabase
    .from("users_cognee")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<UsersCogneeRow>();
  if (readError) throw new Error(`users_cognee read failed: ${readError.message}`);

  if (existing?.dataset_id && existing.dataset_name && existing.isolation_pattern) {
    return {
      userId,
      datasetId: existing.dataset_id,
      datasetName: existing.dataset_name,
      isolationPattern: existing.isolation_pattern,
      cogneePrincipalId: existing.cognee_principal_id,
    };
  }

  const datasetName = datasetNameFor(userId);
  const dataset = await datasets.getOrCreate(datasetName);

  let pattern: "p1" | "p2" = configuredPattern();
  let principalId: string | null = null;
  let encryptedCredentials: string | null = null;

  if (pattern === "p2") {
    try {
      const email = `u_${userId.replaceAll("-", "")}@principals.hefesto.org`;
      const password = randomBytes(24).toString("base64url");
      const principal = (await principals.register(email, password)) as { id?: string };
      if (!principal?.id) throw new Error("auth/register returned no principal id");
      principalId = principal.id;

      await permissions.grant(principalId, "read", [dataset.id]);
      await permissions.grant(principalId, "write", [dataset.id]);

      encryptedCredentials = encryptJson({ email, password });
    } catch {
      // Automatic degradation: same UX, app-enforced scoping for this user
      pattern = "p1";
      principalId = null;
      encryptedCredentials = null;
    }
  }

  const { error: upsertError } = await supabase.from("users_cognee").upsert({
    user_id: userId,
    cognee_principal_id: principalId,
    dataset_id: dataset.id,
    dataset_name: datasetName,
    isolation_pattern: pattern,
    principal_credentials: encryptedCredentials,
  });
  if (upsertError) throw new Error(`users_cognee upsert failed: ${upsertError.message}`);

  return {
    userId,
    datasetId: dataset.id,
    datasetName,
    isolationPattern: pattern,
    cogneePrincipalId: principalId,
  };
}
