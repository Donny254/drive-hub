export const toDateInputValue = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const parseDateInputValue = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const getTodayDateValue = () => toDateInputValue(new Date());

export const isPastDateValue = (value?: string | null) => {
  const selected = parseDateInputValue(value);
  if (!selected) return false;
  const today = parseDateInputValue(getTodayDateValue());
  if (!today) return false;
  return selected.getTime() < today.getTime();
};

export const isEndBeforeStart = (start?: string | null, end?: string | null) => {
  const startDate = parseDateInputValue(start);
  const endDate = parseDateInputValue(end);
  if (!startDate || !endDate) return false;
  return endDate.getTime() < startDate.getTime();
};

export const formatDateButtonLabel = (value?: string | null, placeholder = "Select date") => {
  const parsed = parseDateInputValue(value);
  if (!parsed) return placeholder;
  return parsed.toLocaleDateString();
};

export const toDateTimeLocalValue = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

export const getNowDateTimeLocalValue = () => toDateTimeLocalValue(new Date());

export const isPastDateTimeLocalValue = (value?: string | null) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < new Date().getTime();
};
