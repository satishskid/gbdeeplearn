const configuredApiBase = (import.meta.env.PUBLIC_API_BASE_URL || '').trim();
const normalizedApiBase = configuredApiBase.replace(/\/+$/, '');

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!normalizedApiBase) {
    return normalizedPath;
  }

  return `${normalizedApiBase}${normalizedPath}`;
}
