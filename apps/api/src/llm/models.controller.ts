import { Controller, Get } from '@nestjs/common';
import type { ModelListResponse } from '@notebooklm/shared';
import { ModelRegistry } from './model-registry';

/**
 * Model list for the chat picker (PE-21). The web app shows only what this
 * returns and never knows model names itself (CLAUDE.md section 6).
 */
@Controller('models')
export class ModelsController {
  constructor(private readonly registry: ModelRegistry) {}

  @Get()
  list(): ModelListResponse {
    return { models: this.registry.list() };
  }
}
