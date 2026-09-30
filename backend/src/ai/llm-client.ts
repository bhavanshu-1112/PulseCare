/**
 * Direct LLM API client — no frameworks, explicit prompt construction.
 * Supports Gemini, OpenAI, and Anthropic via env var switching.
 *
 * Gemini: Automatic model fallback on 429 (quota exceeded):
 *   gemini-2.5-flash → gemini-2.5-flash-lite → gemini-3.8-flash
 */

import dotenv from 'dotenv';
dotenv.config();

export type AIProvider = 'gemini' | 'openai' | 'anthropic';

interface LLMResponse {
  text: string;
  provider: AIProvider;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

function getProvider(): AIProvider {
  return (process.env.AI_PROVIDER as AIProvider) || 'gemini';
}

/**
 * Returns the ordered list of Gemini models to try.
 * Primary from GEMINI_MODEL env, fallbacks from GEMINI_MODEL_FALLBACK_1/2.
 */
function getGeminiModelChain(): string[] {
  const primary = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const fallback1 = process.env.GEMINI_MODEL_FALLBACK_1 || 'gemini-2.5-flash-lite';
  const fallback2 = process.env.GEMINI_MODEL_FALLBACK_2 || 'gemini-3.8-flash';
  return [primary, fallback1, fallback2];
}

// ─── Gemini (with automatic model fallback) ─────────────────

async function callGeminiWithModel(
  model: string,
  prompt: string,
  systemPrompt?: string
): Promise<{ response: Response; model: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents: any[] = [];

  if (systemPrompt) {
    contents.push({
      role: 'user',
      parts: [{ text: `System instruction: ${systemPrompt}\n\n${prompt}` }],
    });
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    }),
  });

  return { response, model };
}

async function callGemini(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
  const models = getGeminiModelChain();
  let lastError: Error | null = null;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      console.log(`  🤖 Trying Gemini model: ${model}${i > 0 ? ' (fallback)' : ''}`);

      const { response } = await callGeminiWithModel(model, prompt, systemPrompt);

      // 429 = quota exceeded → try next model
      if (response.status === 429) {
        const errorText = await response.text();
        console.warn(`  ⚠️ ${model}: Quota exceeded (429), falling back...`);
        lastError = new Error(`${model} quota exceeded: ${errorText}`);
        continue;
      }

      // 503 = overloaded → try next model
      if (response.status === 503) {
        const errorText = await response.text();
        console.warn(`  ⚠️ ${model}: Service overloaded (503), falling back...`);
        lastError = new Error(`${model} overloaded: ${errorText}`);
        continue;
      }

      // Other errors → throw immediately (bad request, auth error, etc.)
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error ${response.status} (${model}): ${error}`);
      }

      // Success!
      const data: any = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      console.log(`  ✅ ${model}: Response received (${data.usageMetadata?.totalTokenCount || '?'} tokens)`);

      return {
        text,
        provider: 'gemini',
        model,
        usage: {
          prompt_tokens: data.usageMetadata?.promptTokenCount,
          completion_tokens: data.usageMetadata?.candidatesTokenCount,
        },
      };
    } catch (err: any) {
      // If it's a non-quota error we threw, propagate it
      if (!err.message?.includes('quota') && !err.message?.includes('overloaded')) {
        throw err;
      }
      lastError = err;
    }
  }

  // All models exhausted
  throw new Error(
    `All Gemini models exhausted (tried: ${models.join(', ')}). ` +
    `Last error: ${lastError?.message || 'unknown'}`
  );
}

// ─── OpenAI ────────────────────────────────────────────────

async function callOpenAI(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const model = 'gpt-4o-mini';
  const messages: Array<{ role: string; content: string }> = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${error}`);
  }

  const data: any = await response.json();
  const text = data.choices?.[0]?.message?.content || '';

  return {
    text,
    provider: 'openai',
    model,
    usage: {
      prompt_tokens: data.usage?.prompt_tokens,
      completion_tokens: data.usage?.completion_tokens,
    },
  };
}

// ─── Anthropic ─────────────────────────────────────────────

async function callAnthropic(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const model = 'claude-sonnet-4-20250514';

  const body: any = {
    model,
    max_tokens: 4096,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }],
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${error}`);
  }

  const data: any = await response.json();
  const text = data.content?.[0]?.text || '';

  return {
    text,
    provider: 'anthropic',
    model,
    usage: {
      prompt_tokens: data.usage?.input_tokens,
      completion_tokens: data.usage?.output_tokens,
    },
  };
}

// ─── Unified Interface ────────────────────────────────────

/**
 * Call the configured LLM provider with a prompt.
 * Returns structured JSON text that the caller must parse.
 *
 * For Gemini: automatically falls back through model chain on quota errors:
 *   gemini-2.5-flash → gemini-2.5-flash-lite → gemini-3.8-flash
 */
export async function callLLM(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
  const provider = getProvider();

  switch (provider) {
    case 'gemini':
      return callGemini(prompt, systemPrompt);
    case 'openai':
      return callOpenAI(prompt, systemPrompt);
    case 'anthropic':
      return callAnthropic(prompt, systemPrompt);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

/**
 * Call LLM and parse the JSON response.
 * Falls back to extracting JSON from markdown code blocks if needed.
 */
export async function callLLMJSON<T>(prompt: string, systemPrompt?: string): Promise<T> {
  const response = await callLLM(prompt, systemPrompt);
  let text = response.text.trim();

  // Strip markdown code fences if present
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    return JSON.parse(text) as T;
  } catch (err) {
    console.error('Failed to parse LLM JSON response:', text.substring(0, 500));
    throw new Error(`LLM returned invalid JSON (model: ${response.model}): ${(err as Error).message}`);
  }
}
