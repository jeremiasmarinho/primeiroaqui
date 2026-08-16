/** True se a URL de um anúncio é externa (http/https) — usada para decidir
 * entre `<a target="_blank">` e o `<Link>` interno do wouter. */
export function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}
