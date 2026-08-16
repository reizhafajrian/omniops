/** Parses a memory string like "93.41MB" into bytes */
export const parseBytes = (memStr: string) => {
  if (!memStr) return 0;
  const match = memStr.match(/^([\d.]+)\s*([A-Za-z]+)/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  
  if (unit === 'B') return val;
  if (unit === 'KB' || unit === 'KIB') return val * 1024;
  if (unit === 'MB' || unit === 'MIB') return val * 1024 * 1024;
  if (unit === 'GB' || unit === 'GIB') return val * 1024 * 1024 * 1024;
  if (unit === 'TB' || unit === 'TIB') return val * 1024 * 1024 * 1024 * 1024;
  
  return val;
};

/** Formats a number of bytes into a human readable string */
export const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
};

/** Parses "0.14%" → 0.14 */
export function parseCpuPercent(s: string): number | null {
  const m = s?.match(/([\d.]+)%/);
  return m ? parseFloat(m[1]) : null;
}

/** Parses "93.41MB / 2.036GB" → 0.0458... percent */
export function parseMemPercent(memStr: string): number | null {
  if (!memStr) return null;
  const parts = memStr.split('/').map(s => s.trim());
  if (parts.length !== 2) return null;
  
  const used = parseBytes(parts[0]);
  const total = parseBytes(parts[1]);
  
  if (used == null || total == null || total === 0) return null;
  return (used / total) * 100;
}
