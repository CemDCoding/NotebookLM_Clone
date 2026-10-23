import { Module } from '@nestjs/common';
import { LlmModule } from './llm.module';
import { ModelsController } from './models.controller';

/**
 * `GET /models`, apart from `LlmModule`: that one loads in every mode, and the
 * worker must serve nothing but `/health`. Registered for HTTP modes only.
 */
@Module({
  imports: [LlmModule],
  controllers: [ModelsController],
})
export class ModelsModule {}
