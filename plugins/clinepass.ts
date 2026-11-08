/**
 * opencode-clinepass-provider — OpenCode V2 port
 *
 * ClinePass provider for OpenCode: 11 curated open-weight coding models
 * (GLM-5.2, Kimi, DeepSeek V4, Qwen3.7, …) through Cline's OpenAI-compatible
 * API (https://api.cline.bot/api/v1).
 *
 * Two ways to authenticate, both offered by /connect → ClinePass:
 *   1. Your existing Cline CLI / ClinePass subscription (WorkOS OAuth).
 *      Credentials are read from ~/.cline/data/settings/providers.json and
 *      short-lived access tokens are refreshed through Cline's server.
 *   2. A static API key from app.cline.bot → Settings → API Keys.
 *
 * A CLINE_API_KEY environment variable is also picked up automatically.
 *
 * V2 wiring:
 *   ctx.provider.transform     → registers the provider + model list
 *   ctx.integration.transform  → registers the sign-in methods
 *   ctx.aisdk.hook("sdk", …)   → supplies the per-request key / fetch
 *   ctx.storage                 → caches rotated WorkOS refresh tokens
 *
 * The V1 implementation is kept beside this file as clinepass.v1.ts.bak.
 *
 * @module opencode-clinepass-provider
 */

import {
  extractKey,
  getCachedAuth,
  oauthExpiryMs,
  readOpencodeAuth,
  refreshClineAuthCreds,
  refreshedToAuth,
  resolveClineAuthCredentials,
  resolveClineStaticKey,
  setCachedAuth,
} from "./lib/auth.js"
import { DASHBOARD_URL, CLINE_CLIENT_HEADERS, PROVIDER_ID, resolveApiBase } from "./lib/env.js"
import { fetchRecommendedModels, modelsToConfig } from "./lib/models.js"
import { errMsg, isRecord, stringValue } from "./lib/utils.js"

const PLUGIN_ID = "opencode-clinepass-provider"
const PROVIDER_NAME = "ClinePass"

/**
 * The AI SDK package a V2 provider runs as. Pinning the version keeps V2 from
 * swapping the package for a native provider that would bypass the sdk hook.
 */
const MODEL_PACKAGE = "aisdk:@ai-sdk/openai-compatible@2.0.41"

/**
 * Placeholder key handed to the SDK when it is built. The real key (or the
 * current WorkOS bearer) is substituted per request in wrapFetch, so a key
 * read at startup can never leak onto a request after the account changes.
 */
const PLACEHOLDER = "clinepass-request-key"

const STORAGE_OAUTH = "oauth"

const BASE_URL = `${resolveApiBase()}/api/v1`

/* ── small helpers ─────────────────────────────────────────────────────── */

function log(ctx, level, message, extra) {
  try {
    const pending = ctx.app?.log?.({ body: { service: "clinepass", level, message, extra } })
    if (pending && typeof pending.catch === "function") pending.catch(() => {})
  } catch {
    /* logging must never break a request */
  }
}

function requestUrl(input) {
  if (typeof input === "string") return input
  if (typeof URL !== "undefined" && input instanceof URL) return input.href
  return input && typeof input.url === "string" ? input.url : String(input)
}

/** Convert a V2 credential (integration connection) to the V1 Auth shape. */
function credentialToAuth(value) {
  if (!isRecord(value)) return undefined

  if (value.type === "key" && typeof value.key === "string" && value.key) {
    return { type: "api", key: value.key }
  }

  if (value.type === "oauth") {
    const meta = isRecord(value.metadata) ? value.metadata : {}
    const v1 = isRecord(meta.v1) ? meta.v1 : undefined
    if (v1 && typeof v1.access === "string" && v1.access) return v1

    if (typeof value.access === "string" && value.access) {
      return {
        type: "oauth",
        access: value.access,
        refresh: stringValue(value.refresh) ?? "",
        expires: Number(value.expires) || 0,
      }
    }
  }

  return undefined
}

/** Read the active V2 connection for clinepass, if there is one. */
async function activeAuth(ctx) {
  try {
    const connection = await ctx.integration.connection.active(PROVIDER_ID)
    if (!connection) return undefined
    const value = await ctx.integration.connection.resolve(connection)
    return credentialToAuth(value)
  } catch {
    return undefined
  }
}

/** A rotated WorkOS token cached in plugin storage, if still applicable. */
async function readStoredOAuth(ctx) {
  try {
    const value = await ctx.storage.get(STORAGE_OAUTH)
    return isRecord(value) ? value : undefined
  } catch {
    return undefined
  }
}

async function writeStoredOAuth(ctx, auth) {
  try {
    await ctx.storage.set(STORAGE_OAUTH, {
      type: "oauth",
      access: auth.access,
      refresh: auth.refresh,
      expires: auth.expires,
      ...(auth.accountId ? { accountId: auth.accountId } : {}),
    })
  } catch {
    /* non-fatal: the connection still holds the original tokens */
  }
}

/**
 * Resolve the credential for the current request.
 *
 * Priority:
 *   1. CLINE_API_KEY / Cline CLI static key — always wins when set.
 *   2. The active V2 connection created by /connect.
 *   3. A rotated OAuth token cached in plugin storage (same refresh token).
 *   4. Legacy auth.json written by the V1 plugin.
 *   5. Cline CLI WorkOS login, reused without requiring /connect.
 */
async function resolveAuth(ctx) {
  const staticKey = resolveClineStaticKey()
  if (staticKey) {
    const auth = { type: "api", key: staticKey }
    setCachedAuth(PROVIDER_ID, auth)
    return auth
  }

  const connected = await activeAuth(ctx)
  if (connected) {
    if (connected.type === "oauth") {
      const stored = await readStoredOAuth(ctx)
      if (
        stored &&
        stored.refresh === connected.refresh &&
        Number(stored.expires) > Number(connected.expires || 0)
      ) {
        const merged = {
          ...connected,
          type: "oauth",
          access: stored.access,
          refresh: stored.refresh,
          expires: stored.expires,
          ...(stored.accountId ? { accountId: stored.accountId } : {}),
        }
        setCachedAuth(PROVIDER_ID, merged)
        return merged
      }
    }
    setCachedAuth(PROVIDER_ID, connected)
    return connected
  }

  const stored = readOpencodeAuth(PROVIDER_ID)
  if (stored) {
    setCachedAuth(PROVIDER_ID, stored)
    return stored
  }

  const creds = resolveClineAuthCredentials()
  if (creds) {
    const auth = {
      type: "oauth",
      access: creds.accessToken,
      refresh: creds.refreshToken,
      expires: creds.expiresAt,
      ...(creds.accountId ? { accountId: creds.accountId } : {}),
    }
    setCachedAuth(PROVIDER_ID, auth)
    return auth
  }

  return undefined
}

/**
 * Options a single SDK request needs: the bearer key and the base URL.
 * OAuth tokens are refreshed lazily and rotated tokens are cached.
 */
async function resolveRequestOptions(ctx) {
  const auth = await resolveAuth(ctx)
  if (!auth) return {}

  const key = extractKey(auth)
  if (!key) return {}

  if (auth.type === "api" || auth.type === "wellknown") {
    return { key, baseURL: BASE_URL }
  }

  try {
    const refreshed = await refreshClineAuthCreds({
      accessToken: auth.access,
      refreshToken: auth.refresh,
      expiresAt: oauthExpiryMs(auth),
    })

    if (refreshed.access !== auth.access || refreshed.refresh !== auth.refresh) {
      const updated = refreshedToAuth(refreshed, auth.accountId)
      setCachedAuth(PROVIDER_ID, updated)
      await writeStoredOAuth(ctx, updated)
      log(ctx, "info", "ClinePass: refreshed WorkOS access token.")
    }

    return { key: refreshed.access, baseURL: BASE_URL }
  } catch (e) {
    log(ctx, "error", "ClinePass: token refresh failed — re-run /connect to re-authenticate.", {
      error: errMsg(e),
    })
    // Never send a token that is already expired: that would only produce a 401.
    if (oauthExpiryMs(auth) <= Date.now()) return {}
    return { key: auth.access, baseURL: BASE_URL }
  }
}

/**
 * Wrap the SDK fetch: swap the placeholder key for the account's current key,
 * rewrite the configured base URL if an auth loader supplies a different one,
 * and merge per-request headers.
 */
function wrapFetch(next, base, options) {
  return async (input, init = {}) => {
    const o = await options()
    let url = requestUrl(input)

    const from = String(base ?? "").replace(/\/+$/, "")
    const to = o.baseURL ? String(o.baseURL).replace(/\/+$/, "") : ""
    if (from && to && from !== to && url.startsWith(from)) {
      url = to + url.slice(from.length)
    }

    const request = typeof Request !== "undefined" && input instanceof Request ? input : null
    const headers = new Headers(init.headers ?? request?.headers ?? undefined)

    for (const [name, value] of [...headers.entries()]) {
      if (!value.includes(PLACEHOLDER)) continue
      if (o.key) headers.set(name, value.replaceAll(PLACEHOLDER, o.key))
      else headers.delete(name)
    }

    // Cline accepts a plain bearer token for both key types.
    if (o.key) headers.set("authorization", `Bearer ${o.key}`)
    else headers.delete("authorization")

    // Identify as a Cline CLI client; free-tier models are only admitted there.
    for (const [name, value] of Object.entries(CLINE_CLIENT_HEADERS)) {
      headers.set(name, value)
    }

    for (const [name, value] of Object.entries(o.headers ?? {})) {
      headers.set(name, value)
    }

    const send = typeof o.fetch === "function" ? o.fetch : next ?? fetch

    if (request && init.body === undefined) {
      const body =
        request.method === "GET" || request.method === "HEAD" ? undefined : await request.text()
      return send(url, { method: request.method, headers, body, signal: init.signal ?? request.signal })
    }

    return send(url, { ...init, headers })
  }
}

/* ── models ────────────────────────────────────────────────────────────── */

/** Convert a ClinePass model entry to a V2 Model.Info. */
function toModelInfo(id, model) {
  const limit = isRecord(model.limit) ? model.limit : {}
  const context = Number(limit.context)
  const output = Number(limit.output)

  return {
    id,
    modelID: id,
    providerID: PROVIDER_ID,
    name: stringValue(model.name) ?? id,
    capabilities: {
      tools: true,
      input: ["text"],
      output: ["text"],
    },
    variants: [],
    time: { released: 0 },
    cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }],
    status: "active",
    enabled: true,
    limit: {
      context: Number.isFinite(context) && context > 0 ? context : 128_000,
      output: Number.isFinite(output) && output > 0 ? output : 8_192,
    },
  }
}

function staticModels() {
  return Object.entries(modelsToConfig()).map(([id, model]) => toModelInfo(id, model))
}

/**
 * Use Cline's live recommended catalog (ClinePass + free tier) when reachable,
 * otherwise the curated static list. Never fail setup because discovery failed.
 */
async function loadModels(ctx) {
  // Start with the static curated list so activation never fails on network errors.
  let source = modelsToConfig()

  try {
    const auth = await resolveAuth(ctx)
    const key = extractKey(auth)
    const remote = await fetchRecommendedModels(key)

    // Only replace the static list if the remote catalog has subscription models.
    // An empty or missing subscription list means the user has no active plan,
    // so we keep the guaranteed static fallback.
    if (remote && remote.clinePass && Object.keys(remote.clinePass).length > 0) {
      source = remote
    }
  } catch {
    // Any error during remote discovery — network, auth, parse — is silently
    // ignored and the static list is used instead. Never let a failed fetch
    // cause an internal server error or empty model list.
  }

  return Object.entries(source).map(([id, model]) => toModelInfo(id, model))
}

/* ── plugin ────────────────────────────────────────────────────────────── */

async function setup(ctx) {
  // Start from the curated list so activation never waits on a network call.
  // The account's own inventory replaces it once it has been read.
  let currentModels = staticModels()

  // Provider + model source. A user-declared `clinepass` provider is kept;
  // only its model inventory is filled in.
  await ctx.provider.transform((editor) => {
    const existing = editor.get(PROVIDER_ID)
    if (existing) {
      editor.models.set(PROVIDER_ID, currentModels)
      return
    }

    editor.add({
      info: {
        id: PROVIDER_ID,
        integrationID: PROVIDER_ID,
        name: PROVIDER_NAME,
        activation: "auto",
        package: MODEL_PACKAGE,
        settings: { baseURL: BASE_URL },
      },
      models: currentModels,
    })
  })

  // Sign-in methods shown by /connect → ClinePass.
  await ctx.integration.transform((editor) => {
    try {
      editor.update(PROVIDER_ID, (integration) => {
        if (integration) integration.name = PROVIDER_NAME
      })
    } catch {
      /* an integration 2.x does not know is still created by method.update */
    }

    editor.method.update({
      integrationID: PROVIDER_ID,
      method: {
        type: "key",
        label: "Static API key (app.cline.bot → Settings → API Keys)",
        form: [
          {
            key: "apiKey",
            type: "string",
            title: "Paste your ClinePass API key (create one at app.cline.bot → Settings → API Keys):",
            placeholder: "ck_…",
            required: true,
          },
        ],
      },
    })

    editor.method.update({
      integrationID: PROVIDER_ID,
      method: { type: "env", names: ["CLINE_API_KEY"] },
    })

    editor.method.update({
      integrationID: PROVIDER_ID,
      method: {
        id: "cline-cli",
        type: "oauth",
        label: "Cline CLI / ClinePass subscription (WorkOS)",
      },
      async authorize() {
        const creds = resolveClineAuthCredentials()
        if (!creds) {
          throw new Error(
            "No Cline CLI login detected. Install the Cline CLI (npm i -g cline) and run `cline auth`, then retry — or use the static API key method.",
          )
        }

        try {
          const refreshed = await refreshClineAuthCreds(creds)
          const saved = {
            type: "oauth",
            access: refreshed.access,
            refresh: refreshed.refresh,
            expires: refreshed.expires,
            ...(creds.accountId ? { accountId: creds.accountId } : {}),
          }

          return {
            url: DASHBOARD_URL,
            instructions:
              "Reusing your Cline CLI login (WorkOS). You can close the browser tab if one opened — no action needed.",
            mode: "auto",
            callback: Promise.resolve({
              type: "oauth",
              methodID: "cline-cli",
              access: refreshed.access,
              refresh: refreshed.refresh,
              expires: refreshed.expires,
              metadata: { v1: saved },
            }),
          }
        } catch (e) {
          throw new Error(
            `Could not refresh your Cline CLI token. Run \`cline auth\` again, then retry — or use the static API key method. (${errMsg(e)})`,
          )
        }
      },
    })
  })

  // Every SDK request for this provider gets the placeholder key and a fetch
  // that resolves the live credential at request time.
  await ctx.aisdk.hook(
    "sdk",
    async (evt) => {
      const options = evt?.options
      if (!options || options.__clinepass) return
      options.__clinepass = true
      options.apiKey = PLACEHOLDER
      options.fetch = wrapFetch(options.fetch, options.baseURL ?? BASE_URL, () =>
        resolveRequestOptions(ctx),
      )
    },
    { providerID: PROVIDER_ID },
  )

  // Read the account's own model list in the background; activation must not
  // wait on the network. Sign-in, sign-out and account switches trigger a
  // re-read as well.
  let refreshing = null
  let again = false

  const refreshModels = () => {
    if (refreshing) {
      again = true
      return refreshing
    }

    refreshing = (async () => {
      try {
        const next = await loadModels(ctx).catch(() => currentModels)
        currentModels = next
        await ctx.provider.reload()
        await ctx.model?.reload?.()
      } finally {
        refreshing = null
        if (again) {
          again = false
          void refreshModels()
        }
      }
    })()

    return refreshing
  }

  const controller = new AbortController()
  void (async () => {
    try {
      for await (const event of ctx.event.subscribe({
        types: ["credential.updated", "credential.switched"],
        signal: controller.signal,
      })) {
        const integrationID = event?.data?.integrationID
        if (integrationID && integrationID !== PROVIDER_ID) continue
        await refreshModels()
      }
    } catch {
      /* the subscription ends when the plugin unloads */
    }
  })()

  void refreshModels()

  return () => controller.abort()
}

export default { id: PLUGIN_ID, setup }
