/**
 * AI Model Configuration Parser for Next.js
 * 
 * Parses model configuration strings in format: {provider}/{model}
 * Examples: "openai/gpt-4", "anthropic/claude-3-opus-20240229"
 */

import { openai } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

export interface ModelConfig {
  provider: 'openai' | 'anthropic';
  model: string;
}

/**
 * Parse model configuration string
 * Format: {provider}/{model}
 * Examples: "openai/gpt-4", "anthropic/claude-3-opus-20240229"
 */
export function parseModelConfig(modelString: string): ModelConfig {
  const parts = modelString.split('/');
  if (parts.length !== 2) {
    throw new Error(
      `Invalid model format: "${modelString}". Expected format: {provider}/{model}. ` +
      `Examples: "openai/gpt-4", "anthropic/claude-3-opus-20240229"`
    );
  }

  const [provider, model] = parts;
  if (provider !== 'openai' && provider !== 'anthropic') {
    throw new Error(
      `Unsupported provider: "${provider}". Supported providers: openai, anthropic. ` +
      `Model string: "${modelString}"`
    );
  }

  if (!model || model.trim().length === 0) {
    throw new Error(
      `Invalid model name: "${model}". Model name cannot be empty. ` +
      `Model string: "${modelString}"`
    );
  }

  return { provider: provider as 'openai' | 'anthropic', model: model.trim() };
}

/**
 * Get language model from configuration string
 */
export function getLanguageModel(modelString: string): LanguageModel {
  const config = parseModelConfig(modelString);

  if (config.provider === 'openai') {
    return openai(config.model);
  }

  // For Anthropic, we'd need to import from @ai-sdk/anthropic
  // For now, throw error if Anthropic is requested but not available
  throw new Error(
    `Anthropic provider not yet configured. ` +
    `Install @ai-sdk/anthropic and update model-config.ts to support Anthropic models. ` +
    `Requested model: "${modelString}"`
  );
}

/**
 * Get embedding model from configuration string
 */
export function getEmbeddingModel(modelString: string) {
  const config = parseModelConfig(modelString);

  if (config.provider === 'openai') {
    return openai.embedding(config.model);
  }

  throw new Error(
    `Embedding model provider "${config.provider}" not supported. ` +
    `Only OpenAI embedding models are currently supported. ` +
    `Requested model: "${modelString}"`
  );
}

/**
 * Get default model configuration from environment variables
 */
export function getDefaultLLMModel(): string {
  return process.env.LLM_MODEL || 'openai/gpt-4';
}

/**
 * Get default embedding model configuration from environment variables
 */
export function getDefaultEmbeddingModel(): string {
  return process.env.EMBEDDING_MODEL || 'openai/text-embedding-3-large';
}







