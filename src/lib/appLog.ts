export type LogFields = Record<string, unknown>;

/** JSON log line. Never pass student documents, passwords, or tokens in `fields`. */
export function logAppEvent(
  level: 'info' | 'error' | 'warn',
  event: string,
  fields: LogFields = {},
) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

export function requestLogFields(opts: {
  requestId?: string | null;
  route?: string;
  method?: string;
  role?: string | null;
  school?: string | null;
}): LogFields {
  return {
    requestId: opts.requestId || null,
    route: opts.route || null,
    method: opts.method || null,
    role: opts.role || null,
    school: opts.school || null,
  };
}
