/**
 * Ollama embedding client — calls local ollama /api/embed endpoint.
 */

const OLLAMA_URL = 'http://localhost:11434/api/embed';
const DEFAULT_MODEL = 'bge-m3';

export async function embed(
  texts: string[],
  model = DEFAULT_MODEL,
): Promise<Float32Array[]> {
  const payload = JSON.stringify({ model, input: texts });

  let resp: Response;
  try {
    resp = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Cannot connect to ollama at ${OLLAMA_URL}: ${msg}\n` +
        `  Make sure ollama is running: ollama serve\n` +
        `  And the model is pulled: ollama pull ${model}`,
    );
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`ollama returned ${resp.status}: ${body}`);
  }

  const data = (await resp.json()) as { embeddings?: number[][] };
  const embeddings = data.embeddings ?? [];
  return embeddings.map((e) => new Float32Array(e));
}

export async function embedSingle(
  text: string,
  model = DEFAULT_MODEL,
): Promise<Float32Array> {
  const results = await embed([text], model);
  return results[0];
}
