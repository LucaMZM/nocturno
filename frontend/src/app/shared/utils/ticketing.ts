export function ticketQuantityLimit(available: number, maxPerUser: number | null): number {
  return Math.max(0, Math.min(10, Math.floor(available), maxPerUser ?? 10));
}

export function ticketSubtotalCents(priceEuros: number, quantity: number): number {
  return Math.round(priceEuros * 100) * quantity;
}
