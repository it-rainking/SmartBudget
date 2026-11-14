// Client Anthropic condiviso dalle route /api/ai/*.
// Usa il tool use forzato: il modello risponde con un oggetto che rispetta lo
// schema, senza dover estrarre JSON dal testo con una regex.

// Modelli di default. Sovrascrivibili da env:
// - ANTHROPIC_MODEL        → analisi (insights, semplificazione categorie)
// - ANTHROPIC_MODEL_SMALL  → compiti brevi e ripetitivi (categorizzazione)
export const MODEL_ANALYSIS = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5'
export const MODEL_SMALL = process.env.ANTHROPIC_MODEL_SMALL ?? process.env.ANTHROPIC_MODEL ?? 'claude-haiku-5-5'

export interface ClaudeTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export type ClaudeToolResult<T> =
  | { ok: true; input: T; usage: Record<string, number> }
  | { ok: false; status: number }

interface CallOptions {
  apiKey: string
  model: string
  system: string
  prompt: string
  tool: ClaudeTool
  maxTokens?: number
}

export async function callClaudeTool<T>(opts: CallOptions): Promise<ClaudeToolResult<T>> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.system,
      tools: [opts.tool],
      tool_choice: { type: 'tool', name: opts.tool.name },
      messages: [{ role: 'user', content: opts.prompt }],
    }),
  })
  if (!res.ok) return { ok: false, status: res.status }

  const data = await res.json()
  const block = (data.content ?? []).find((b: { type: string }) => b.type === 'tool_use')
  if (!block?.input) return { ok: false, status: 502 }
  return { ok: true, input: block.input as T, usage: data.usage ?? {} }
}
