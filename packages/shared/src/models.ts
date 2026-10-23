import { z } from 'zod';

// Local models get this prefix so the API can tell the provider from the id
// alone, even if Mistral and Ollama offer a model with the same name (PE-32).
export const OLLAMA_MODEL_ID_PREFIX = 'ollama:';

export const ModelProviderSchema = z.enum(['mistral', 'ollama']);

// The web app only shows what `GET /models` returns and never derives model
// names itself (CLAUDE.md section 6), so the schema keeps provider, id prefix
// and the "Lokal" flag consistent.
export const ModelSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    provider: ModelProviderSchema,
    isLocal: z.boolean(),
    isDefault: z.boolean(),
  })
  .refine(
    (model) => {
      const isOllama = model.provider === 'ollama';
      return model.id.startsWith(OLLAMA_MODEL_ID_PREFIX) === isOllama && model.isLocal === isOllama;
    },
    { message: 'Only Ollama models are local and carry the ollama: prefix' },
  );

// The picker preselects the API's default, so there must be exactly one.
export const ModelListResponseSchema = z.object({
  models: z
    .array(ModelSchema)
    .min(1)
    .refine((models) => models.filter((model) => model.isDefault).length === 1, {
      message: 'Exactly one model must be the default',
    }),
});

export type ModelProvider = z.infer<typeof ModelProviderSchema>;
export type Model = z.infer<typeof ModelSchema>;
export type ModelListResponse = z.infer<typeof ModelListResponseSchema>;
