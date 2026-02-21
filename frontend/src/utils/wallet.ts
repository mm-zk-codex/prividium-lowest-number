export function hasEthereumProvider(): boolean {
  return typeof window !== 'undefined' && !!(window as any).ethereum;
}
