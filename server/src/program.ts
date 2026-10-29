/** Same program and batch even when the sheet writes "2025 - 29" or "2025-29". */
export function programKey(course: string, batch: string) {
  const years = batch.replace(/[–—]/g, "-").replace(/\s+/g, "");
  return `${course.trim().toLowerCase()}\0${years.toLowerCase()}`;
}
