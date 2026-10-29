export function defaultBatchCode(_course: string, batch: string): string {
  const digits = batch.replace(/\D/g, "");
  if (digits.length === 6) return digits;
  if (digits.length > 6) return digits.slice(0, 6);
  return digits.padEnd(6, "0");
}

export function batchKey(course: string, batch: string): string {
  return `${course.trim()}:${batch.trim()}`;
}

export function normalizeBatchCode(code: string): string {
  return code.trim().replace(/\D/g, "").slice(0, 6);
}
