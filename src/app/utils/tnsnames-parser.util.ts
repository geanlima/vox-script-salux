function stripComments(content: string): string {
  return String(content ?? '')
    .split(/\r?\n/)
    .map((line) => (line.includes('#') ? line.slice(0, line.indexOf('#')) : line))
    .join('\n');
}

function extractBalancedParens(text: string, startIdx: number): string {
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

function extractTnsEntries(content: string): Array<{ alias: string; block: string }> {
  const text = stripComments(content);
  const entries: Array<{ alias: string; block: string }> = [];
  const aliasPattern = /(?:^|\n)\s*([A-Za-z0-9_$#.\-]+)\s*=\s*(?:\n\s*)?\(/g;
  let match: RegExpExecArray | null;

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

export function parseTnsNamesContent(content: string): string[] {
  return extractTnsEntries(content)
    .map((entry) => entry.alias)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function tnsNamesSet(aliases: string[]): Set<string> {
  return new Set(aliases.map((alias) => alias.toUpperCase()));
}

export function isTnsInList(tnsName: string, aliases: string[]): boolean {
  if (!tnsName.trim() || !aliases.length) {
    return true;
  }
  return tnsNamesSet(aliases).has(tnsName.trim().toUpperCase());
}
