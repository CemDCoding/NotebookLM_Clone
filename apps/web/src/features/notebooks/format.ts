// A fixed time zone keeps the date identical for every viewer and in tests.
const dateFormat = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeZone: 'Europe/Berlin',
});

export function formatNotebookDate(isoDate: string): string {
  return dateFormat.format(new Date(isoDate));
}

export function formatSourceCount(count: number): string {
  return count === 1 ? '1 Quelle' : `${count} Quellen`;
}
