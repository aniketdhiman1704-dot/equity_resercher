export const percent = (n: number | null, digits = 1) =>
  n === null || !Number.isFinite(n * 100) ? '—' : `${(n * 100).toFixed(digits)}%`;
export const money = (n: number | null) => {
  if (n === null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  return `${n < 0 ? '−' : ''}$${abs >= 1000 ? (abs / 1000).toFixed(2) + 'B' : abs.toFixed(1) + 'M'}`;
};
export const amount = (n: number | null) =>
  n === null || !Number.isFinite(n) ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: 1 });
export const price = (n: number | null) =>
  n === null || !Number.isFinite(n)
    ? '—'
    : n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
