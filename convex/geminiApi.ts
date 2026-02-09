"use node";

/**
 * Gemini API Helper Functions
 *
 * Raw REST API calls to bypass SDK ESM loader issues on Windows.
 * The @google/genai and @google/generative-ai packages have internal dependencies
 * that trigger ESM loader errors in Convex's Node.js environment.
 */

// ============================================
// Types
// ============================================

export interface GeminiFile {
  name: string;
  uri: string;
  mimeType: string;
  state: string;
}

export interface GeminiGenerationConfig {
  responseMimeType?: string;
  responseSchema?: object;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface GeminiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  cachedContentTokenCount?: number;
}

export interface GeminiResponse {
  text: string;
  usageMetadata?: GeminiUsageMetadata;
}

// Types for multi-turn conversation with tool calling
export interface GeminiToolDeclaration {
  name: string;
  description: string;
  parameters: object;
}

export interface GeminiCacheResult {
  cacheName: string;
  expireTime?: string; // RFC 3339 timestamp when cache expires
}

export interface GeminiMultiTurnResponse {
  candidates: Array<{
    content?: {
      parts: Array<{
        text?: string;
        functionCall?: {
          name: string;
          args: Record<string, unknown>;
        };
      }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: GeminiUsageMetadata;
}

export type GeminiMessage = {
  role: "user" | "model";
  parts: Array<{
    text?: string;
    functionCall?: { name: string; args: Record<string, unknown> };
    functionResponse?: { name: string; response: unknown };
  }>;
};

// ============================================
// File Management Functions
// ============================================

/**
 * Get file status from Gemini File API
 */
export async function getGeminiFile(
  apiKey: string,
  fileName: string
): Promise<GeminiFile> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`
  );
  if (!response.ok) {
    throw new Error(`Failed to get file status: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Delete file from Gemini File API
 */
export async function deleteGeminiFile(
  apiKey: string,
  fileName: string
): Promise<void> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(`Failed to delete file: ${response.statusText}`);
  }
}

/**
 * Upload buffer to Gemini File API using resumable upload
 * Bypasses SDK path issues on Windows
 */
export async function uploadBufferToGemini(
  apiKey: string,
  buffer: Buffer,
  mimeType: string,
  displayName: string
): Promise<GeminiFile> {
  const baseUrl = "https://generativelanguage.googleapis.com/upload/v1beta/files";

  // 1. Initiate resumable upload
  const initResponse = await fetch(`${baseUrl}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": buffer.length.toString(),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });

  if (!initResponse.ok) {
    const errorText = await initResponse.text();
    throw new Error(`Failed to initiate upload: ${initResponse.statusText} - ${errorText}`);
  }

  const uploadUrl = initResponse.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    throw new Error("No upload URL received from Gemini");
  }

  // 2. Upload content — pass Buffer directly; Blob wrapping can corrupt
  //    the payload in Node.js causing Gemini to 500 on subsequent status checks.
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": buffer.length.toString(),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: new Uint8Array(buffer),
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Failed to upload content: ${uploadResponse.statusText} - ${errorText}`);
  }

  const result = await uploadResponse.json();
  return result.file;
}

/**
 * Wait for Gemini file to finish processing.
 * Retries on transient server errors (5xx) during polling.
 */
export async function waitForFileProcessing(
  apiKey: string,
  file: GeminiFile,
  pollIntervalMs: number = 2000
): Promise<GeminiFile> {
  let currentFile = file;
  const maxRetries = 5;
  let consecutiveErrors = 0;

  while (currentFile.state === "PROCESSING") {
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    try {
      currentFile = await getGeminiFile(apiKey, currentFile.name);
      consecutiveErrors = 0;
    } catch (error) {
      consecutiveErrors++;
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(
        `File status poll failed (attempt ${consecutiveErrors}/${maxRetries}): ${msg}`
      );
      if (consecutiveErrors >= maxRetries) {
        throw new Error(
          `Failed to get file status after ${maxRetries} retries: ${msg}`
        );
      }
      // Exponential back-off before next retry
      await new Promise(resolve =>
        setTimeout(resolve, pollIntervalMs * consecutiveErrors)
      );
    }
  }

  if (currentFile.state === "FAILED") {
    throw new Error("Video processing failed in Gemini File API");
  }

  return currentFile;
}

// ============================================
// Content Generation Functions
// ============================================

/**
 * Generate content with Gemini using raw REST API
 * Supports structured output via responseSchema
 * If fileUri/fileMimeType are not provided, generates text-only content
 */
export async function generateContentWithGemini(
  apiKey: string,
  model: string,
  fileUri: string | undefined,
  fileMimeType: string | undefined,
  prompt: string,
  config: GeminiGenerationConfig = {}
): Promise<GeminiResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Build parts array - include file only if provided
  const parts: Array<{ fileData?: { mimeType: string; fileUri: string }; text?: string }> = [];

  if (fileUri && fileMimeType) {
    parts.push({
      fileData: {
        mimeType: fileMimeType,
        fileUri: fileUri,
      },
    });
  }

  parts.push({ text: prompt });

  const requestBody = {
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    generationConfig: {
      responseMimeType: config.responseMimeType || "application/json",
      responseSchema: config.responseSchema,
      maxOutputTokens: config.maxOutputTokens || 65536,
      temperature: config.temperature,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();

  // Extract text and usage from the response
  if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
    return {
      text: result.candidates[0].content.parts[0].text,
      usageMetadata: result.usageMetadata
    };
  }

  throw new Error("No text content in Gemini response");
}

/**
 * Generate content with text-only prompt (no file)
 */
export async function generateTextContent(
  apiKey: string,
  model: string,
  prompt: string,
  config: GeminiGenerationConfig = {}
): Promise<GeminiResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: config.responseMimeType,
      responseSchema: config.responseSchema,
      maxOutputTokens: config.maxOutputTokens || 8192,
      temperature: config.temperature,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();

  if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
    return {
      text: result.candidates[0].content.parts[0].text,
      usageMetadata: result.usageMetadata
    };
  }

  throw new Error("No text content in Gemini response");
}

// ============================================
// Context Caching Functions (for Agent)
// ============================================

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

/**
 * Create a cached context with video + system prompt + tool declarations.
 * The cache stores the expensive video tokens so they're reused across iterations.
 */
export async function createGeminiCache(
  apiKey: string,
  model: string,
  fileUri: string,
  fileMimeType: string,
  systemPrompt: string,
  toolDeclarations: GeminiToolDeclaration[],
  ttlSeconds: number = 300
): Promise<GeminiCacheResult> {
  const url = `${GEMINI_BASE}/cachedContents?key=${apiKey}`;

  const requestBody = {
    model: `models/${model}`,
    contents: [
      {
        role: "user",
        parts: [
          { fileData: { fileUri, mimeType: fileMimeType } },
        ],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    tools: [{ functionDeclarations: toolDeclarations }],
    toolConfig: { functionCallingConfig: { mode: "AUTO" } },
    ttl: `${ttlSeconds}s`,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create Gemini cache: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();

  if (!result.name) {
    throw new Error("Cache creation succeeded but no name returned");
  }

  return { cacheName: result.name, expireTime: result.expireTime };
}

/**
 * Refresh cache TTL to prevent expiry during long analysis sessions
 */
export async function refreshGeminiCacheTTL(
  apiKey: string,
  cacheName: string,
  ttlSeconds: number = 300
): Promise<void> {
  const url = `${GEMINI_BASE}/${cacheName}?key=${apiKey}`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ttl: `${ttlSeconds}s` }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.warn(`Failed to refresh cache TTL: ${response.status} - ${errorText}`);
  }
}

/**
 * Delete a cached context to free resources
 */
export async function deleteGeminiCache(
  apiKey: string,
  cacheName: string
): Promise<void> {
  const url = `${GEMINI_BASE}/${cacheName}?key=${apiKey}`;

  const response = await fetch(url, { method: "DELETE" });

  if (!response.ok) {
    console.warn(`Failed to delete cache: ${response.status}`);
  }
}

// ============================================
// Multi-Turn Generation with Cache (for Agent)
// ============================================

/**
 * Generate content using a cached context with multi-turn conversation.
 * Supports tool/function calling - returns raw response with function calls.
 */
export async function generateContentWithCache(
  apiKey: string,
  model: string,
  cacheName: string,
  messages: GeminiMessage[]
): Promise<GeminiMultiTurnResponse> {
  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    cachedContent: cacheName,
    contents: messages,
    // Tools and toolConfig are in the cache, not here
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(
      `Gemini API error: ${response.status} ${response.statusText} - ${errorText}`
    ) as Error & { status: number };
    error.status = response.status;
    throw error;
  }

  return await response.json();
}
