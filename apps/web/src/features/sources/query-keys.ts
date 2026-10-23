/** Query keys of the sources feature, kept in one place so invalidation stays targeted. */
export const sourceKeys = {
  all: ['sources'] as const,
  list: (notebookId: string) => [...sourceKeys.all, 'list', notebookId] as const,
};
