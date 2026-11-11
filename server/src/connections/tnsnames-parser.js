function stripComments(content) {
  return String(content ?? '')
    .split(/\r?\n/)
    .map((line) => (line.includes('#') ? line.slice(0, line.indexOf('#')) : line))
    .join('\n');
}

function extractBalancedParens(text, startIdx) {
  if (text[startIdx] !== '(') {
    return '';
  }

  let depth = 0;
  for (let i = startIdx; i < text.length; i++) {
    if (text[i] === '(') {
      depth++;
    } else if (text[i] === ')') {
      depth--;
      if (depth === 0) {
        return text.slice(startIdx, i + 1);
      }
    }
  }

  return text.slice(startIdx);
}

function extractTnsEntries(content) {
  const text = stripComments(content);
  const entries = [];
  const aliasPattern = /(?:^|\n)\s*([A-Za-z0-9_$#.\-]+)\s*=\s*(?:\n\s*)?\(/g;
  let match;

  while ((match = aliasPattern.exec(text)) !== null) {
    const alias = match[1].trim();
    const start = match.index + match[0].lastIndexOf('(');
    const block = extractBalancedParens(text, start);

    if (!block) {
      continue;
    }

    const upper = alias.toUpperCase();
    if (!entries.some((entry) => entry.alias.toUpperCase() === upper)) {
      entries.push({ alias, block });
    }
  }

  return entries;
}

function readTnsValue(block, key) {
  const pattern = new RegExp(`\\(${key}\\s*=\\s*([^)]+?)\\)`, 'i');
  return block.match(pattern)?.[1]?.trim() ?? null;
}

export function resolveConnectFromBlock(block) {
  const hosts = [...block.matchAll(/\(HOST\s*=\s*([^)]+?)\)/gi)].map((m) => m[1].trim());
  const host = hosts[0];

  if (!host) {
    return null;
  }

  const portMatch = block.match(/\(PORT\s*=\s*(\d+)\)/i);
  const port = portMatch?.[1]?.trim() || '1521';
  const serviceName = readTnsValue(block, 'SERVICE_NAME');
  const sid = readTnsValue(block, 'SID');

  if (serviceName) {
    return `${host}:${port}/${serviceName}`;
  }

  if (sid) {
    return `${host}:${port}:${sid}`;
  }

  return null;
}

export function buildTnsAliasMap(content) {
  const map = new Map();

  for (const { alias, block } of extractTnsEntries(content)) {
    const connectString = resolveConnectFromBlock(block);
    if (connectString) {
      map.set(alias.toUpperCase(), connectString);
    }
  }

  return map;
}

export function parseTnsNamesContent(content) {
  return extractTnsEntries(content)
    .map((entry) => entry.alias)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function resolveTnsConnectString(content, alias) {
  const name = String(alias ?? '').trim().toUpperCase();
  if (!name) {
    return null;
  }

  return buildTnsAliasMap(content).get(name) ?? null;
}
