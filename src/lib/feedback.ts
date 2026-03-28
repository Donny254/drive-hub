const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const getApiErrorMessage = async (resp: Response, fallback: string) => {
  const data = await resp.json().catch(() => ({}));
  return (data as { error?: string }).error || fallback;
};

export const feedbackText = {
  created: (subject: string) => `${capitalize(subject)} created.`,
  updated: (subject: string) => `${capitalize(subject)} updated.`,
  deleted: (subject: string) => `${capitalize(subject)} deleted.`,
  cancelled: (subject: string) => `${capitalize(subject)} cancelled.`,
  uploaded: (subject = "image") => `${capitalize(subject)} uploaded.`,
  added: (subject: string) => `${capitalize(subject)} added.`,
  removed: (subject: string) => `${capitalize(subject)} removed.`,
  imported: (subject: string, count: number) =>
    `Imported ${count} ${subject}${count === 1 ? "" : "s"}.`,
  printingOpened: (subject: string) => `${capitalize(subject)} opened for printing.`,
  downloaded: (subject: string) => `${capitalize(subject)} downloaded.`,
};
