import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  ErrorCode,
  type Model,
  type ModelProvider,
  OLLAMA_MODEL_ID_PREFIX,
} from '@notebooklm/shared';
import { DomainError } from '../common/errors';
import { AppConfigService } from '../config';

/** A model the chat may use: which provider serves it and under which name. */
export interface ResolvedModel {
  /** The id the picker sends and the message stores, e.g. `ollama:llama3.2`. */
  id: string;
  provider: ModelProvider;
  /** The name the provider knows, without the `ollama:` prefix. */
  name: string;
}

/** The requested model is not on the whitelist; the picker offers only allowed ones. */
export class UnknownModelError extends DomainError {
  constructor() {
    super(
      HttpStatus.BAD_REQUEST,
      ErrorCode.VALIDATION_FAILED,
      'Das gewählte Modell ist nicht verfügbar. Bitte wähle ein anderes Modell.',
    );
  }
}

interface RegisteredModel extends ResolvedModel {
  label: string;
}

/**
 * Whitelist of the chat models (CLAUDE.md section 6): the Mistral models from
 * `CHAT_MODELS`, plus the Ollama models when `OLLAMA_BASE_URL` is set. The
 * first Mistral model is the default. The chat accepts no model outside this
 * list, so the web app can never make the API call an arbitrary model.
 */
@Injectable()
export class ModelRegistry {
  private readonly models: readonly RegisteredModel[];

  // Explicit token: scripts run under tsx, which emits no decorator metadata.
  constructor(@Inject(AppConfigService) config: AppConfigService) {
    const mistral = config.chatModels.map((name): RegisteredModel => ({
      id: name,
      provider: 'mistral',
      name,
      label: mistralLabel(name),
    }));
    const ollama = (config.ollama?.chatModels ?? []).map((name): RegisteredModel => ({
      id: `${OLLAMA_MODEL_ID_PREFIX}${name}`,
      provider: 'ollama',
      name,
      label: `${name} (Lokal)`,
    }));
    // A model listed twice would appear twice in the picker; the first entry wins.
    this.models = [...new Map([...mistral, ...ollama].map((model) => [model.id, model])).values()];
  }

  /** The models for the picker, in configuration order, with exactly one default. */
  list(): Model[] {
    return this.models.map((model, index) => ({
      id: model.id,
      label: model.label,
      provider: model.provider,
      isLocal: model.provider === 'ollama',
      isDefault: index === 0,
    }));
  }

  /** Resolves a picker id, or the default without one. Unknown ids are rejected with `400`. */
  resolve(id?: string): ResolvedModel {
    const model = id === undefined ? this.models[0] : this.models.find((entry) => entry.id === id);
    if (model === undefined) {
      throw new UnknownModelError();
    }
    return { id: model.id, provider: model.provider, name: model.name };
  }
}

/** `mistral-small-latest` → `Mistral Small`, `ministral-8b-latest` → `Ministral 8B`. */
export function mistralLabel(name: string): string {
  return name
    .replace(/-latest$/, '')
    .split('-')
    .filter((word) => word.length > 0)
    .map((word) =>
      /^\d+b$/i.test(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}
