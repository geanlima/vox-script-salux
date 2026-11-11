export interface SaluxIniConnection {
  serverName: string;
  active: boolean;
}

export interface SaluxIniParseResult {
  connections: SaluxIniConnection[];
  activeServerName: string | null;
  dirExe: string | null;
}

function parseIniLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(';')) {
    return null;
  }

  const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
  if (sectionMatch) {
    return { type: 'section' as const, name: sectionMatch[1].trim() };
  }

  const keyValueMatch = trimmed.match(/^([^=]+)=(.*)$/);
  if (keyValueMatch) {
    return {
      type: 'key' as const,
      key: keyValueMatch[1].trim(),
      value: keyValueMatch[2].trim()
    };
  }

  return null;
}

function parseServerNameKey(key: string, value: string): SaluxIniConnection | null {
  const disabled = key.startsWith('--');
  const normalizedKey = disabled ? key.slice(2) : key;

  if (normalizedKey.toLowerCase() !== 'servername') {
    return null;
  }

  return {
    serverName: value.trim(),
    active: !disabled
  };
}

export function parseSaluxIniContent(content: string): SaluxIniParseResult {
  const lines = String(content ?? '').split(/\r?\n/);
  let currentSection = '';
  const connections: SaluxIniConnection[] = [];
  let activeServerName: string | null = null;
  let dirExe: string | null = null;
  const seen = new Set<string>();

  for (const line of lines) {
    const parsed = parseIniLine(line);
    if (!parsed) {
      continue;
    }

    if (parsed.type === 'section') {
      currentSection = parsed.name.toLowerCase();
      continue;
    }

    if (currentSection !== 'database') {
      continue;
    }

    const serverEntry = parseServerNameKey(parsed.key, parsed.value);
    if (serverEntry?.serverName) {
      const key = serverEntry.serverName.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        connections.push(serverEntry);
      }
      if (serverEntry.active) {
        activeServerName = serverEntry.serverName;
      }
      continue;
    }

    if (parsed.key.toLowerCase() === 'dir_exe' && parsed.value) {
      dirExe = parsed.value;
    }
  }

  return { connections, activeServerName, dirExe };
}
