// Converte "AAAA-MM-DD" para "DD/MM/AAAA" sem passar por Date (evita deslocamento de fuso)
export function formatDateBr(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

// toISOString() usa UTC: no Brasil, após as 21h, retornaria a data do dia seguinte
export function toLocalIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
