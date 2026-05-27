export function formatCurrency(amount: number | string, includeDecimals = true): string {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(num);
  return formatted.replace(/\s+/g, '');
}

export function formatNumber(value: number | string): string {
  const num = typeof value === 'number' ? value : parseFloat(value) || 0;
  return new Intl.NumberFormat('en-IN').format(num);
}
