import { z } from 'zod';
// Solo lee configuración de IA; nunca carga backend/.env.
export const env = z.object({
  YOMOGAN_EMBED_KEEP_ALIVE:z.string().regex(/^(0|[1-9][0-9]*[smh])$/).default('0'),
  YOMOGAN_KEEP_ALIVE:z.string().regex(/^(0|[1-9][0-9]*[smh])$/).default('5m'),
  YOMOGAN_WARMUP:z.enum(['true','false']).default('false'),
  YOMOGAN_PROVIDER:z.enum(['ollama','compatible']).default('ollama'),
  YOMOGAN_CHAT_URL:z.url().default('http://127.0.0.1:11434'),
  YOMOGAN_MODEL:z.string().default('qwen3:4b'),
  YOMOGAN_API_KEY:z.string().optional(),
  YOMOGAN_EMBED_PROVIDER:z.enum(['ollama','compatible','disabled']).default('ollama'),
  YOMOGAN_EMBED_URL:z.url().default('http://127.0.0.1:11434'),
  YOMOGAN_EMBED_MODEL:z.string().default('embeddinggemma'),
  YOMOGAN_EMBED_API_KEY:z.string().optional(),
  YOMOGAN_TIMEOUT_MS:z.coerce.number().int().min(1000).max(180000).default(60000),
  YOMOGAN_AVATAR_PATH:z.string().default('/yomogan/avatar.png'),
  YOMOGAN_CORE_URL:z.url().default('http://127.0.0.1:3000'),
}).parse(process.env);
