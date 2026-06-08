export interface OracleStatement {
  index: number;
  text: string;
  startLine: number;
  preview: string;
}

export function splitOracleScript(rawText: string): OracleStatement[] {
  const text = rawText.replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const statements: OracleStatement[] = [];
  let currentLines: string[] = [];
  let startLine = 1;

  const pushStatement = (): void => {
    const statementText = currentLines.join('\n').trim();
    if (statementText) {
      statements.push({
        index: statements.length + 1,
        text: statementText,
        startLine,
        preview: buildPreview(statementText)
      });
    }
    currentLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === '/') {
      pushStatement();
      startLine = i + 2;
      continue;
    }

    if (currentLines.length === 0) {
      startLine = i + 1;
    }

    currentLines.push(line);
  }

  pushStatement();
  return statements;
}

function buildPreview(statement: string): string {
  const singleLine = statement.replace(/\s+/g, ' ').trim();
  return singleLine.length > 90 ? `${singleLine.substring(0, 87)}...` : singleLine;
}
