/**
 * ClinePass model definitions, dynamic discovery, and opencode.json config
 * generation.
 *
 * @module models
 */

import { CLINE_CLIENT_HEADERS, resolveApiBase } from "./env.js"

/** Pi thinking levels that models map to provider-specific reasoning_effort. */
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh"

/**
 * Maps every thinking level to a provider-specific `reasoning_effort` string
 * or `null` (unsupported). Every model must declare all six levels — there are
 * no implicit defaults.
 */
export type ThinkingLevelMap = Readonly<Record<ThinkingLevel, string | null>>

/** Default thinking level map for remote models without a static fallback. */
export const DEFAULT_THINKING_LEVEL_MAP: ThinkingLevelMap = {
  off: "none",
  minimal: null,
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: null,
}

export interface ModelDef {
  id: string
  name: string
  context: number
  output: number
  /** Whether the model supports reasoning (extended thinking). */
  reasoning: boolean
  /**
   * Maps every thinking level to a provider-specific reasoning_effort string,
   * or `null` to mark a level as unsupported. All six levels must be declared.
   */
  thinkingLevelMap: ThinkingLevelMap
  /** A rotating Cline free-tier model (no ClinePass subscription needed). */
  free?: boolean
}

/** Model config shape produced by modelsToConfig / fetchRecommendedModels. */
export interface ModelConfigEntry {
  name: string
  limit: { context: number; output: number }
  reasoning: boolean
  thinkingLevelMap: ThinkingLevelMap
}

/** Reasoning effort matrices reused by the curated list below. */
const REASONING_FULL: ThinkingLevelMap = {
  off: "none",
  minimal: null,
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "xhigh",
}

const REASONING_NO_OFF: ThinkingLevelMap = {
  off: null,
  minimal: null,
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: null,
}

const REASONING_HIGH_ONLY: ThinkingLevelMap = {
  off: null,
  minimal: null,
  low: null,
  medium: null,
  high: "high",
  xhigh: "high",
}

/**
 * The current ClinePass catalog plus Cline's rotating free-tier models.
 *
 * Free IDs are sent to Cline exactly as advertised (no `cline-pass/` prefix)
 * and ride usage billing at $0. This list is the fallback; the live catalog at
 * /api/v1/ai/cline/recommended-models replaces it when reachable.
 */
export const MODELS: readonly ModelDef[] = [
  // ── ClinePass subscription models ─────────────────────────────────────
  {
    id: "cline-pass/kimi-k3.1-pro",
    name: "Kimi K3.1 Pro (ClinePass)",
    context: 1_048_576,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: REASONING_FULL,
  },
  {
    id: "cline-pass/kimi-k3",
    name: "Kimi K3 (ClinePass)",
    context: 1_048_576,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: REASONING_FULL,
  },
  {
    id: "cline-pass/glm-5.3",
    name: "GLM-5.3 (ClinePass)",
    context: 1_048_576,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: REASONING_FULL,
  },
  {
    id: "cline-pass/glm-5.3-flash",
    name: "GLM-5.3 Flash (ClinePass)",
    context: 1_048_576,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: REASONING_FULL,
  },
  {
    id: "cline-pass/deepseek-v4-pro",
    name: "DeepSeek V4 Pro (ClinePass)",
    context: 1_000_000,
    output: 384_000,
    reasoning: true,
    // DeepSeek only supports high reasoning; off/minimal/low/medium are unsupported.
    thinkingLevelMap: REASONING_HIGH_ONLY,
  },
  {
    id: "cline-pass/deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash (ClinePass)",
    context: 1_000_000,
    output: 384_000,
    reasoning: true,
    thinkingLevelMap: REASONING_HIGH_ONLY,
  },
  {
    id: "cline-pass/deepseek-v4.1-flash-1017",
    name: "DeepSeek V4.1 Flash 1017 (ClinePass)",
    context: 1_000_000,
    output: 384_000,
    reasoning: true,
    thinkingLevelMap: REASONING_HIGH_ONLY,
  },
  {
    id: "cline-pass/mimo-v2.6-pro",
    name: "MiMo V2.6 Pro (ClinePass)",
    context: 1_048_576,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: REASONING_NO_OFF,
  },
  {
    id: "cline-pass/mimo-v2.6-flash",
    name: "MiMo V2.6 Flash (ClinePass)",
    context: 1_048_576,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: REASONING_NO_OFF,
  },
  {
    id: "cline-pass/minimax-m3",
    name: "MiniMax M3 (ClinePass)",
    context: 1_048_576,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: REASONING_NO_OFF,
  },
  {
    id: "cline-pass/minimax-m3.1-flash",
    name: "MiniMax M3.1 Flash (ClinePass)",
    context: 1_048_576,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: REASONING_NO_OFF,
  },
  {
    id: "cline-pass/muse-spark-1.3-contributor",
    name: "Muse Spark 1.3 Contributor (ClinePass)",
    context: 1_048_576,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: REASONING_NO_OFF,
  },
  {
    id: "cline-pass/qwen3.7-max",
    name: "Qwen3.7 Max (ClinePass)",
    context: 1_000_000,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: REASONING_NO_OFF,
  },
  {
    id: "cline-pass/qwen3.7-plus",
    name: "Qwen3.7 Plus (ClinePass)",
    context: 1_048_576,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: REASONING_NO_OFF,
  },
  {
    id: "cline-pass/qwen3.8-max",
    name: "Qwen3.8 Max (ClinePass)",
    context: 1_048_576,
    output: 131_072,
    reasoning: true,
    thinkingLevelMap: REASONING_NO_OFF,
  },

  // ── Cline free-tier models (rotating; no subscription required) ────────
  {
    id: "reflection/beam-free",
    name: "Beam 1.0 (Free)",
    context: 131_072,
    output: 32_768,
    reasoning: true,
    thinkingLevelMap: REASONING_FULL,
    free: true,
  },
  {
    id: "cline-free/nemotron-3.5-super-vl",
    name: "Nemotron 3.5 Super VL (Free)",
    context: 131_072,
    output: 32_768,
    reasoning: true,
    thinkingLevelMap: REASONING_FULL,
    free: true,
  },
  {
    id: "nvidia/nemotron-3.5-lightning-free",
    name: "Nemotron 3.5 Lightning (Free)",
    context: 131_072,
    output: 32_768,
    reasoning: true,
    thinkingLevelMap: REASONING_FULL,
    free: true,
  },
  {
    id: "cline-free/solar-mini4",
    name: "Solar Mini 4 (Free)",
    context: 131_072,
    output: 32_768,
    reasoning: true,
    thinkingLevelMap: REASONING_FULL,
    free: true,
  },
]

/** Pre-built Map for O(1) static model fallback lookups. */
const STATIC_MODELS_BY_ID = new Map(MODELS.map((m) => [m.id, m]))

/** Default limits used when neither API nor static data provides them. */
const FALLBACK_CONTEXT = 128_000
const FALLBACK_OUTPUT = 8_192

/** Extract the model array from the API response (handles both { data: [...] } and bare [...] formats). */
function extractModelList(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) return json
  if (typeof json !== "object" || json === null) return []
  const obj = json as Record<string, unknown>
  if (obj.data !== undefined && Array.isArray(obj.data)) return obj.data as Array<Record<string, unknown>>
  return []
}

/** Build the opencode.json `provider.clinepass.models` object from MODELS. */
export function modelsToConfig(models: readonly ModelDef[] = MODELS): Record<string, ModelConfigEntry> {
  const out: Record<string, ModelConfigEntry> = {}
  for (const m of models) {
    out[m.id] = {
      name: m.name,
      limit: { context: m.context, output: m.output },
      reasoning: m.reasoning,
      thinkingLevelMap: m.thinkingLevelMap,
    }
  }
  return out
}

/**
 * Fetch the model list from the Cline API `/api/v1/models` endpoint (OpenAI-compatible
 * format: `{ data: [{ id, name, context_length, max_output_tokens, ... }] }`).
 * Returns a record keyed by model id, or `undefined` on any error (network, auth, parse).
 *
 * The returned objects carry enough fields for Opencode to use them as provider models
 * — name, limit, and api info. The caller should map these into the shape Opencode expects.
 */
export async function fetchRemoteModels(
  apiKey: string | undefined,
  options: { apiBase?: string; fetch?: typeof globalThis.fetch; timeoutMs?: number } = {},
): Promise<Record<string, ModelConfigEntry> | undefined> {
  const fetchFn = options.fetch ?? globalThis.fetch
  const apiBase = options.apiBase ?? resolveApiBase()
  const timeoutMs = options.timeoutMs ?? 5_000

  if (!apiKey || !fetchFn) return undefined

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchFn(`${apiBase}/api/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    })

    if (!response.ok) return undefined

    const json: unknown = await response.json()
    const rawList = extractModelList(json)

    if (rawList.length === 0) return undefined

    // Use the pre-built module-level Map for O(1) static fallback lookups
    const staticById = STATIC_MODELS_BY_ID

    // Only include models with the "cline-pass/" prefix
    const out: Record<string, ModelConfigEntry> = {}
    for (const raw of rawList) {
      const id = typeof raw.id === "string" ? raw.id : undefined
      if (!id || !id.startsWith("cline-pass/")) continue

      const name = typeof raw.name === "string" ? raw.name : id
      const context = typeof raw.context_length === "number" ? raw.context_length : undefined
      const output = typeof raw.max_output_tokens === "number" ? raw.max_output_tokens : undefined
      const reasoning = typeof raw.reasoning === "boolean" ? raw.reasoning : undefined

      // Fall back to static data if the API doesn't provide these fields
      const staticFallback = staticById.get(id)
      out[id] = {
        name,
        limit: {
          context: context ?? staticFallback?.context ?? FALLBACK_CONTEXT,
          output: output ?? staticFallback?.output ?? FALLBACK_OUTPUT,
        },
        reasoning: reasoning ?? staticFallback?.reasoning ?? true,
        thinkingLevelMap: staticFallback?.thinkingLevelMap ?? DEFAULT_THINKING_LEVEL_MAP,
      }
    }

    return Object.keys(out).length > 0 ? out : undefined
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Turn a model id into a readable label, e.g. `cline-free/solar-mini4` →
 * `Solar Mini4`.
 */
function labelFromId(id: string): string {
  const tail = id.slice(id.lastIndexOf("/") + 1)
  return tail
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

/** Read one array bucket (`clinePass`, `free`, …) from the catalog response. */
function recommendedBucket(json: unknown, key: string): Array<Record<string, unknown>> {
  if (typeof json !== "object" || json === null) return []
  const value = (json as Record<string, unknown>)[key]
  return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : []
}

/** Build a config entry from a catalog row, reusing curated metadata if known. */
function recommendedEntry(
  raw: Record<string, unknown>,
  free: boolean,
): [string, ModelConfigEntry] | undefined {
  const id = typeof raw.id === "string" ? raw.id.trim() : ""
  if (!id) return undefined

  const staticFallback = STATIC_MODELS_BY_ID.get(id)
  const advertised = typeof raw.name === "string" ? raw.name.trim() : ""
  const advertisedName = advertised && advertised !== id ? advertised : undefined

  let name = staticFallback?.name ?? advertisedName ?? labelFromId(id)
  if (free && !/\(free\)/i.test(name)) name += " (Free)"

  return [
    id,
    {
      name,
      limit: {
        context: staticFallback?.context ?? FALLBACK_CONTEXT,
        output: staticFallback?.output ?? FALLBACK_OUTPUT,
      },
      reasoning: staticFallback?.reasoning ?? true,
      thinkingLevelMap: staticFallback?.thinkingLevelMap ?? DEFAULT_THINKING_LEVEL_MAP,
    },
  ]
}

/**
 * Fetch Cline's recommended catalog (`/api/v1/ai/cline/recommended-models`).
 *
 * The response has several buckets; ClinePass subscription models live under
 * `clinePass` and the rotating zero-cost models under `free`. Both are merged
 * so free entries such as “Beam 1.0 (Free)” appear next to paid ones.
 *
 * The endpoint is public, but an API key is sent when available. Returns
 * `undefined` on any error so the curated static list remains the fallback.
 */
export async function fetchRecommendedModels(
  apiKey?: string,
  options: { apiBase?: string; fetch?: typeof globalThis.fetch; timeoutMs?: number } = {},
): Promise<Record<string, ModelConfigEntry> | undefined> {
  const fetchFn = options.fetch ?? globalThis.fetch
  const apiBase = options.apiBase ?? resolveApiBase()
  const timeoutMs = options.timeoutMs ?? 5_000

  if (!fetchFn) return undefined

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const headers: Record<string, string> = {
      accept: "application/json",
      ...CLINE_CLIENT_HEADERS,
    }
    if (apiKey) headers.authorization = `Bearer ${apiKey}`

    const response = await fetchFn(`${apiBase}/api/v1/ai/cline/recommended-models`, {
      headers,
      signal: controller.signal,
    })

    if (!response.ok) return undefined

    const json: unknown = await response.json()
    const out: Record<string, ModelConfigEntry> = {}
    let subscriptionModels = 0

    for (const [bucket, free] of [
      ["clinePass", false],
      ["free", true],
    ] as const) {
      for (const raw of recommendedBucket(json, bucket)) {
        const entry = recommendedEntry(raw, free)
        if (!entry) continue
        if (!free) subscriptionModels++
        out[entry[0]] = entry[1]
      }
    }

    // A catalog without subscription entries is not authoritative — let the
    // curated list (which also carries free models) stand instead.
    if (subscriptionModels === 0) return undefined

    return Object.keys(out).length > 0 ? out : undefined
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Build the full `provider.clinepass` config block that the `config` hook
 * injects into opencode's config at startup. Exported for testing.
 */
export function buildProviderConfig(env: Record<string, string | undefined> = process.env): {
  npm: string
  name: string
  options: { baseURL: string }
  models: Record<string, ModelConfigEntry>
} {
  return {
    npm: "@ai-sdk/openai-compatible",
    name: "ClinePass",
    options: { baseURL: `${resolveApiBase(env)}/api/v1` },
    models: modelsToConfig(),
  }
}

/**
 * Inject the clinepass provider config into a config object (in-place), but
 * only if the user hasn't already declared a `clinepass` provider themselves.
 * Exported for testing the `config` hook logic without a plugin runtime.
 */
export function injectProviderConfig<T extends { provider?: Record<string, unknown> }>(
  input: T,
  env: Record<string, string | undefined> = process.env,
): void {
  const provider = input.provider ?? {}
  if (provider.clinepass) return // respect user's manual config
  provider.clinepass = buildProviderConfig(env)
  input.provider = provider
}
