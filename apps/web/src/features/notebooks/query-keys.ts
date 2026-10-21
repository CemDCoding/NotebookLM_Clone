/** Query keys of the notebooks feature, kept in one place so invalidation stays targeted. */
export const notebookKeys = {
  all: ['notebooks'] as const,
  list: () => [...notebookKeys.all, 'list'] as const,
  detail: (id: string) => [...notebookKeys.all, 'detail', id] as const,
};
