/**
 * Daftar model OpenAI yang tersedia untuk agent.
 * Modul ini bebas dependensi server agar aman diimpor dari client component.
 */
export const AI_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'] as const
export type AiModel = (typeof AI_MODELS)[number]
