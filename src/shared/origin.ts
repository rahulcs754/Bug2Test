/** Match pattern for a site. Chrome match patterns cannot hold a port, so localhost:3000 -> http://localhost/*. */
export function originPattern(url: string): string {
  const u = new URL(url);
  return `${u.protocol}//${u.hostname}/*`;
}
