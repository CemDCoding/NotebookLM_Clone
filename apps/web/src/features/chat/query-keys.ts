/** Query keys of the chat feature, kept in one place so invalidation stays targeted. */
export const chatKeys = {
  all: ['chat'] as const,
  messages: (notebookId: string) => [...chatKeys.all, 'messages', notebookId] as const,
  models: () => [...chatKeys.all, 'models'] as const,
};
