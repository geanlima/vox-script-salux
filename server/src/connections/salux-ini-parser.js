/**
 * Parser do arquivo INI do Salux (seção [Database]).
 * ServerName corresponde ao alias TNS no tnsnames.ora.
 * Linhas com prefixo -- estão desativadas no INI original.
 */

function parseIniLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(';')) {
    return null;
  }

  const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
  if (sectionMatch) {
    return { type: 'section', name: sectionMatch[1].trim() };
  }

  const keyValueMatch = trimmed.match(/^([^=]+)=(.*)$/);
  if (keyValueMatch) {
    return {
      type: 'key',
      key: keyValueMatch[1].trim(),
      value: keyValueMatch[2].trim()
    };
  }

  return null;
}

function parseServerNameKey(key, value) {
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

export function parseSaluxIni(content) {
  const lines = String(content ?? '').split(/\r?\n/);
  let currentSection = '';
  const connections = [];
  let activeServerName = null;
  let dirExe = null;
  const seen = new Set();

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

  return {
    connections,
    activeServerName,
    dirExe,
    source: 'salux_ini'
  };
}

export function getSaluxIniPath() {
  return process.env.SALUX_INI_PATH?.trim() || null;
}
