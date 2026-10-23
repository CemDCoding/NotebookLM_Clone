import { Injectable, Logger } from '@nestjs/common';
import { type DataExport, type ExportNotebook, ExportSchema } from '@notebooklm/shared';
import { parseStoredCitations } from '../chat/resolve-citations';
import { toSource } from '../sources/source.mapper';
import { AccountRepository } from './account.repository';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(private readonly repository: AccountRepository) {}

  /**
   * All notebooks of the user with their source metadata and chat history
   * (GDPR Art. 20). The result is checked against `ExportSchema` before it
   * leaves: the schema strips any field it does not know, so nothing beyond
   * the contract reaches the download, and a mismatch fails as a `500`
   * instead of handing out a broken file.
   */
  async export(userId: string): Promise<DataExport> {
    const data = await this.repository.readAll(userId);

    const byNotebook = new Map<string, ExportNotebook>(
      data.notebooks.map((notebook) => [
        notebook.id,
        {
          id: notebook.id,
          title: notebook.title,
          createdAt: notebook.createdAt.toISOString(),
          updatedAt: notebook.updatedAt.toISOString(),
          sources: [],
          messages: [],
        },
      ]),
    );

    // Rows are grouped only under the user's own notebooks, so a row that
    // somehow points elsewhere is left out rather than exported.
    for (const record of data.sources) {
      const { notebookId, ...source } = toSource(record);
      byNotebook.get(notebookId)?.sources.push(source);
    }
    for (const record of data.messages) {
      const { citations, invalidCount } = parseStoredCitations(record.citations);
      if (invalidCount > 0) {
        // Only the ID: an invalid entry may hold anything, including text.
        this.logger.warn({ message: 'Dropped invalid stored citations', messageId: record.id });
      }
      byNotebook.get(record.notebookId)?.messages.push({
        id: record.id,
        role: record.role,
        content: record.content,
        model: record.model,
        citations,
        createdAt: record.createdAt.toISOString(),
      });
    }

    const result = ExportSchema.parse({
      exportedAt: new Date().toISOString(),
      userId,
      notebooks: [...byNotebook.values()],
    });
    this.logger.log({
      message: 'Data export created',
      notebooks: result.notebooks.length,
      sources: data.sources.length,
      messages: data.messages.length,
    });
    return result;
  }
}
