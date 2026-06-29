export function percentLabel(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

export function withAlpha(hex: string, alphaHex: string) {
  return `${hex}${alphaHex}`;
}
