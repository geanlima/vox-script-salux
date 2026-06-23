import { Injectable } from '@angular/core';
import {
  createEmptyAddColumn,
  createEmptyColumn,
  createEmptyFormData,
  ScriptFormData,
  TableColumn
} from '../models/script-form.model';
import { ScriptType } from '../models/script-types';
import { splitOracleScript } from '../utils/oracle-script-splitter';

export interface ScriptImportResult {
  success: boolean;
  form: ScriptFormData;
  warnings: string[];
  errors: string[];
  detectedType: ScriptType | null;
  sourceFileName?: string;
}

const FILENAME_PATTERN = /^CARD_(\d+)_([a-z_]+)_/i;

const FILENAME_TYPE_MAP: Record<string, ScriptType> = {
  add_column: 'ADD_COLUMN',
  create_table: 'CREATE_TABLE',
  drop_table: 'DROP_TABLE',
  primary_key: 'PRIMARY_KEY',
  foreign_key: 'FOREIGN_KEY',
  check_constraint: 'CHECK_CONSTRAINT',
  sequence: 'SEQUENCE',
  function: 'FUNCTION',
  procedure: 'PROCEDURE',
  trigger: 'TRIGGER',
  cursor_not_null: 'CURSOR_NOT_NULL'
};

@Injectable({ providedIn: 'root' })
export class ScriptImportService {
  import(sql: string, fileName?: string): ScriptImportResult {
    const trimmed = sql.trim();
    if (!trimmed) {
      return this.failure(['O arquivo está vazio.']);
    }

    const statements = splitOracleScript(trimmed);
    if (statements.length === 0) {
      return this.failure(['Nenhum comando SQL encontrado no arquivo.']);
    }

    const warnings: string[] = [];
    const fileMeta = fileName ? this.parseFileName(fileName) : null;
    const detectedType = this.detectScriptType(trimmed, statements);

    if (!detectedType) {
      return this.failure([
        'Não foi possível identificar o tipo do script. Verifique se o arquivo segue o padrão do Cadastros Gerais.'
      ]);
    }

    if (fileMeta?.scriptType && fileMeta.scriptType !== detectedType) {
      warnings.push(
        `O nome do arquivo indica "${this.typeLabel(fileMeta.scriptType)}", mas o conteúdo foi identificado como "${this.typeLabel(detectedType)}". O conteúdo foi priorizado.`
      );
    }

    const parsed = this.parseByType(detectedType, statements, trimmed);
    if (parsed.errors.length > 0) {
      return {
        success: false,
        form: createEmptyFormData(),
        warnings,
        errors: parsed.errors,
        detectedType,
        sourceFileName: fileName
      };
    }

    const form: ScriptFormData = {
      ...createEmptyFormData(),
      ...parsed.fields,
      scriptType: detectedType,
      cardNumber: fileMeta?.cardNumber ?? parsed.fields.cardNumber ?? ''
    };

    if (!form.cardNumber) {
      warnings.push('Número do card não encontrado no nome do arquivo. Informe manualmente.');
    }

    return {
      success: true,
      form,
      warnings,
      errors: [],
      detectedType,
      sourceFileName: fileName
    };
  }

  private failure(errors: string[]): ScriptImportResult {
    return {
      success: false,
      form: createEmptyFormData(),
      warnings: [],
      errors,
      detectedType: null
    };
  }

  private parseFileName(fileName: string): { cardNumber: string; scriptType: ScriptType } | null {
    const baseName = fileName.replace(/\.sql$/i, '');
    const match = baseName.match(FILENAME_PATTERN);
    if (!match) {
      return null;
    }

    const scriptType = FILENAME_TYPE_MAP[match[2].toLowerCase()];
    if (!scriptType) {
      return null;
    }

    return { cardNumber: match[1], scriptType };
  }

  private detectScriptType(sql: string, statements: { text: string }[]): ScriptType | null {
    const upper = sql.toUpperCase();

    if (
      /\bDECLARE\b/.test(upper) &&
      /\bCURSOR\b/.test(upper) &&
      /\bMODIFY\b/.test(upper) &&
      /\bNOT\s+NULL\b/.test(upper)
    ) {
      return 'CURSOR_NOT_NULL';
    }
    if (/CREATE\s+OR\s+REPLACE\s+FUNCTION\b/i.test(sql)) {
      return 'FUNCTION';
    }
    if (/CREATE\s+OR\s+REPLACE\s+PROCEDURE\b/i.test(sql)) {
      return 'PROCEDURE';
    }
    if (/CREATE\s+OR\s+REPLACE\s+TRIGGER\b/i.test(sql)) {
      return 'TRIGGER';
    }
    if (/CREATE\s+TABLE\b/i.test(sql)) {
      return 'CREATE_TABLE';
    }
    if (/CREATE\s+SEQUENCE\b/i.test(sql)) {
      return 'SEQUENCE';
    }
    if (/DROP\s+TABLE\b/i.test(sql)) {
      return 'DROP_TABLE';
    }

    const first = statements[0]?.text ?? '';
    if (/ADD\s+CONSTRAINT\s+PK_/i.test(first)) {
      return 'PRIMARY_KEY';
    }
    if (/ADD\s+CONSTRAINT\s+FK_/i.test(first)) {
      return 'FOREIGN_KEY';
    }
    if (/ADD\s+CONSTRAINT\s+CKC_/i.test(first)) {
      return 'CHECK_CONSTRAINT';
    }
    if (/ALTER\s+TABLE\b/i.test(first) && /\bADD\b/i.test(first) && !/ADD\s+CONSTRAINT/i.test(first)) {
      return 'ADD_COLUMN';
    }

    return null;
  }

  private parseByType(
    type: ScriptType,
    statements: { text: string }[],
    fullSql: string
  ): { fields: Partial<ScriptFormData>; errors: string[] } {
    switch (type) {
      case 'ADD_COLUMN':
        return this.parseAddColumn(statements);
      case 'CREATE_TABLE':
        return this.parseCreateTable(statements);
      case 'DROP_TABLE':
        return this.parseDropTable(statements);
      case 'PRIMARY_KEY':
        return this.parsePrimaryKey(statements);
      case 'FOREIGN_KEY':
        return this.parseForeignKey(statements);
      case 'CHECK_CONSTRAINT':
        return this.parseCheckConstraint(statements);
      case 'SEQUENCE':
        return this.parseSequence(statements);
      case 'FUNCTION':
        return this.parsePlsqlObject(statements[0]?.text ?? '', 'FUNCTION');
      case 'PROCEDURE':
        return this.parsePlsqlObject(statements[0]?.text ?? '', 'PROCEDURE');
      case 'TRIGGER':
        return this.parseTrigger(statements[0]?.text ?? '', fullSql);
      case 'CURSOR_NOT_NULL':
        return this.parseCursorNotNull(statements);
      default:
        return { fields: {}, errors: ['Tipo de script não suportado para importação.'] };
    }
  }

  private parseAddColumn(statements: { text: string }[]): { fields: Partial<ScriptFormData>; errors: string[] } {
    const alterStmt = statements.find((s) => /ALTER\s+TABLE/i.test(s.text) && /\bADD\b/i.test(s.text));
    if (!alterStmt) {
      return { fields: {}, errors: ['Comando ALTER TABLE ADD não encontrado.'] };
    }

    const alterMatch = alterStmt.text.match(
      /ALTER\s+TABLE\s+(?:INFOSAUDE\.)?(\w+)\s+ADD\s+(\w+)\s+((?:VARCHAR2|CHAR|NUMBER|DATE|TIMESTAMP|CLOB|BLOB)(?:\([^)]*\))?)\s*(.*)/is
    );
    if (!alterMatch) {
      return { fields: {}, errors: ['Não foi possível interpretar o comando ALTER TABLE ADD.'] };
    }

    const [, tableName, columnName, dataTypeRaw, tail] = alterMatch;
    const { base, size } = this.parseOracleDataType(dataTypeRaw);
    const tailUpper = tail.toUpperCase();
    const notNull = /\bNOT\s+NULL\b/.test(tailUpper);

    let defaultValue = '';
    const defaultMatch = tail.match(/\bDEFAULT\s+(.+?)(?:\s+NOT\s+NULL)?$/is);
    if (defaultMatch) {
      defaultValue = this.parseDefaultForForm(base, defaultMatch[1].trim());
    }

    const commentStmt = statements.find((s) => /COMMENT\s+ON\s+COLUMN/i.test(s.text));
    const comment = commentStmt ? this.parseComment(commentStmt.text) : '';

    return {
      fields: {
        tableName,
        addColumns: [
          {
            ...createEmptyAddColumn(),
            name: columnName,
            dataTypeBase: base,
            dataTypeSize: size,
            notNull,
            defaultValue,
            comment
          }
        ],
        createSequence: statements.some((s) => /CREATE\s+SEQUENCE/i.test(s.text))
      },
      errors: []
    };
  }

  private parseCreateTable(statements: { text: string }[]): { fields: Partial<ScriptFormData>; errors: string[] } {
    const createStmt = statements.find((s) => /CREATE\s+TABLE/i.test(s.text));
    if (!createStmt) {
      return { fields: {}, errors: ['Comando CREATE TABLE não encontrado.'] };
    }

    const createMatch = createStmt.text.match(
      /CREATE\s+TABLE\s+(?:INFOSAUDE\.)?(\w+)\s*\(([\s\S]*?)\)\s*$/i
    );
    if (!createMatch) {
      return { fields: {}, errors: ['Não foi possível interpretar a definição da tabela.'] };
    }

    const [, tableName, columnsBlock] = createMatch;
    const columns = this.parseTableColumns(columnsBlock);
    if (columns.length === 0) {
      return { fields: {}, errors: ['Nenhuma coluna encontrada na definição da tabela.'] };
    }

    const tableCommentStmt = statements.find((s) => /COMMENT\s+ON\s+TABLE/i.test(s.text));
    const tableComment = tableCommentStmt ? this.parseTableComment(tableCommentStmt.text) : '';

    const commentByColumn = new Map<string, string>();
    statements
      .filter((s) => /COMMENT\s+ON\s+COLUMN/i.test(s.text))
      .forEach((s) => {
        const match = s.text.match(
          /COMMENT\s+ON\s+COLUMN\s+(?:INFOSAUDE\.)?\w+\.(\w+)\s+IS\s+'((?:[^']|'')*)'/i
        );
        if (match) {
          commentByColumn.set(match[1].toUpperCase(), this.unescapeSqlString(match[2]));
        }
      });

    const enrichedColumns = columns.map((col) => ({
      ...col,
      comment: commentByColumn.get(col.name.toUpperCase()) ?? col.comment
    }));

    return {
      fields: {
        tableName,
        tableComment,
        columns: enrichedColumns,
        createSequence: statements.some((s) => /CREATE\s+SEQUENCE/i.test(s.text))
      },
      errors: []
    };
  }

  private parseTableColumns(columnsBlock: string): TableColumn[] {
    const lines = columnsBlock
      .split('\n')
      .map((line) => line.trim().replace(/,$/, ''))
      .filter(Boolean);

    const columns: TableColumn[] = [];

    for (const line of lines) {
      const match = line.match(
        /^(\w+)\s+((?:VARCHAR2|CHAR|NUMBER|DATE|TIMESTAMP|CLOB|BLOB)(?:\([^)]*\))?)\s*(NOT\s+NULL)?$/i
      );
      if (!match) {
        continue;
      }

      const [, name, dataTypeRaw, notNullFlag] = match;
      const { base, size } = this.parseOracleDataType(dataTypeRaw);

      columns.push({
        ...createEmptyAddColumn(),
        name,
        dataTypeBase: base,
        dataTypeSize: size,
        notNull: Boolean(notNullFlag),
        comment: ''
      });
    }

    return columns.length > 0 ? columns : [createEmptyColumn()];
  }

  private parseDropTable(statements: { text: string }[]): { fields: Partial<ScriptFormData>; errors: string[] } {
    const dropStmt = statements.find((s) => /DROP\s+TABLE/i.test(s.text));
    if (!dropStmt) {
      return { fields: {}, errors: ['Comando DROP TABLE não encontrado.'] };
    }

    const match = dropStmt.text.match(/DROP\s+TABLE\s+(?:INFOSAUDE\.)?(\w+)/i);
    if (!match) {
      return { fields: {}, errors: ['Não foi possível identificar o nome da tabela.'] };
    }

    return { fields: { tableName: match[1] }, errors: [] };
  }

  private parsePrimaryKey(statements: { text: string }[]): { fields: Partial<ScriptFormData>; errors: string[] } {
    const stmt = statements[0]?.text ?? '';
    const match = stmt.match(
      /ALTER\s+TABLE\s+(?:INFOSAUDE\.)?(\w+)\s+ADD\s+CONSTRAINT\s+PK_\w+\s*PRIMARY\s+KEY\s*\(([^)]+)\)/is
    );
    if (!match) {
      return { fields: {}, errors: ['Não foi possível interpretar a Primary Key.'] };
    }

    return {
      fields: {
        tableName: match[1],
        pkColumns: this.formatColumnListForForm(match[2])
      },
      errors: []
    };
  }

  private parseForeignKey(statements: { text: string }[]): { fields: Partial<ScriptFormData>; errors: string[] } {
    const stmt = statements[0]?.text ?? '';
    const match = stmt.match(
      /ALTER\s+TABLE\s+(?:INFOSAUDE\.)?(\w+)\s+ADD\s+CONSTRAINT\s+FK_\w+_(\d+)\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:INFOSAUDE\.)?(\w+)\s*\(([^)]+)\)/is
    );
    if (!match) {
      return { fields: {}, errors: ['Não foi possível interpretar a Foreign Key.'] };
    }

    return {
      fields: {
        tableName: match[1],
        fkSequence: Number.parseInt(match[2], 10) || 1,
        fkColumns: this.formatColumnListForForm(match[3]),
        fkRefTable: match[4],
        fkRefColumns: this.formatColumnListForForm(match[5])
      },
      errors: []
    };
  }

  private parseCheckConstraint(statements: { text: string }[]): { fields: Partial<ScriptFormData>; errors: string[] } {
    const stmt = statements[0]?.text ?? '';
    const headerMatch = stmt.match(
      /ALTER\s+TABLE\s+(?:INFOSAUDE\.)?(\w+)[\s\S]*ADD\s+CONSTRAINT\s+CKC_\w+_(\d+)\s+CHECK\s*\(/is
    );
    if (!headerMatch) {
      return { fields: {}, errors: ['Não foi possível interpretar o Check Constraint.'] };
    }

    const expression = this.extractCheckExpression(stmt);
    if (!expression) {
      return { fields: {}, errors: ['Expressão CHECK não encontrada.'] };
    }

    return {
      fields: {
        tableName: headerMatch[1],
        ckcSequence: Number.parseInt(headerMatch[2], 10) || 1,
        ckcExpression: expression
      },
      errors: []
    };
  }

  private parseSequence(statements: { text: string }[]): { fields: Partial<ScriptFormData>; errors: string[] } {
    const stmt = statements.find((s) => /CREATE\s+SEQUENCE/i.test(s.text));
    if (!stmt) {
      return { fields: {}, errors: ['Comando CREATE SEQUENCE não encontrado.'] };
    }

    const match = stmt.text.match(/CREATE\s+SEQUENCE\s+(?:INFOSAUDE\.)?(\w+)/i);
    if (!match) {
      return { fields: {}, errors: ['Não foi possível identificar o nome da sequence.'] };
    }

    return {
      fields: {
        tableName: '',
        sequenceName: match[1]
      },
      errors: []
    };
  }

  private parsePlsqlObject(
    stmt: string,
    kind: 'FUNCTION' | 'PROCEDURE'
  ): { fields: Partial<ScriptFormData>; errors: string[] } {
    const pattern =
      kind === 'FUNCTION'
        ? /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:INFOSAUDE\.)?(\w+)\s+([\s\S]+)/i
        : /CREATE\s+OR\s+REPLACE\s+PROCEDURE\s+(?:INFOSAUDE\.)?(\w+)\s+([\s\S]+)/i;

    const match = stmt.match(pattern);
    if (!match) {
      return { fields: {}, errors: [`Não foi possível interpretar a ${kind === 'FUNCTION' ? 'Function' : 'Procedure'}.`] };
    }

    return {
      fields: {
        objectName: match[1],
        plsqlBody: match[2].trim()
      },
      errors: []
    };
  }

  private parseTrigger(stmt: string, fullSql: string): { fields: Partial<ScriptFormData>; errors: string[] } {
    const match = stmt.match(/CREATE\s+OR\s+REPLACE\s+TRIGGER\s+(?:INFOSAUDE\.)?(\w+)\s+([\s\S]+)/i);
    if (!match) {
      return { fields: {}, errors: ['Não foi possível interpretar o Trigger.'] };
    }

    const tableMatch = fullSql.match(/\bON\s+(?:INFOSAUDE\.)?(\w+)\b/i);

    return {
      fields: {
        objectName: match[1],
        plsqlBody: match[2].trim(),
        tableName: tableMatch?.[1] ?? ''
      },
      errors: []
    };
  }

  private parseCursorNotNull(statements: { text: string }[]): { fields: Partial<ScriptFormData>; errors: string[] } {
    const addStmt = statements.find((s) => /ALTER\s+TABLE/i.test(s.text) && /\bADD\b/i.test(s.text));
    const declareStmt = statements.find((s) => /\bDECLARE\b/i.test(s.text) && /\bCURSOR\b/i.test(s.text));
    const modifyStmt = statements.find((s) => /ALTER\s+TABLE/i.test(s.text) && /\bMODIFY\b/i.test(s.text));
    const commentStmt = statements.find((s) => /COMMENT\s+ON\s+COLUMN/i.test(s.text));

    if (!addStmt || !declareStmt || !modifyStmt) {
      return { fields: {}, errors: ['Estrutura do script Cursor (NOT NULL) incompleta.'] };
    }

    const addMatch = addStmt.text.match(
      /ALTER\s+TABLE\s+(?:INFOSAUDE\.)?(\w+)\s+ADD\s+(\w+)\s+((?:VARCHAR2|CHAR|NUMBER|DATE|TIMESTAMP|CLOB|BLOB)(?:\([^)]*\))?)/is
    );
    if (!addMatch) {
      return { fields: {}, errors: ['Não foi possível interpretar o ALTER TABLE ADD do cursor.'] };
    }

    const [, tableName, columnName, dataTypeRaw] = addMatch;
    const { base, size } = this.parseOracleDataType(dataTypeRaw);

    const whereMatch = declareStmt.text.match(/\bWHERE\s+([\s\S]+?)\s+ORDER\s+BY\b/i);
    const cursorWhereClause = whereMatch ? whereMatch[1].trim() : '';

    const updateMatch = declareStmt.text.match(new RegExp(`SET\\s+${columnName}\\s*=\\s*(.+?)\\s+WHERE\\s+ROWID`, 'is'));
    const modifyMatch = modifyStmt.text.match(
      new RegExp(`MODIFY\\s+${columnName}\\s+DEFAULT\\s+(.+?)\\s+NOT\\s+NULL`, 'is')
    );

    const defaultRaw = updateMatch?.[1]?.trim() ?? modifyMatch?.[1]?.trim() ?? '';
    const cursorDefaultValue = defaultRaw ? this.parseDefaultForForm(base, defaultRaw) : "'N'";

    return {
      fields: {
        tableName,
        columnName,
        dataTypeBase: base,
        dataTypeSize: size,
        cursorDefaultValue,
        cursorWhereClause,
        comment: commentStmt ? this.parseComment(commentStmt.text) : ''
      },
      errors: []
    };
  }

  private parseOracleDataType(dataType: string): { base: string; size: string } {
    const match = dataType.trim().toUpperCase().match(/^(\w+)(?:\(([^)]+)\))?$/);
    if (!match) {
      return { base: 'VARCHAR2', size: '50' };
    }

    const size = (match[2] ?? '').replace(/\./g, ',');
    return { base: match[1], size };
  }

  private parseComment(stmt: string): string {
    const match = stmt.match(/COMMENT\s+ON\s+COLUMN\s+(?:INFOSAUDE\.)?\w+\.\w+\s+IS\s+'((?:[^']|'')*)'/i);
    return match ? this.unescapeSqlString(match[1]) : '';
  }

  private parseTableComment(stmt: string): string {
    const match = stmt.match(/COMMENT\s+ON\s+TABLE\s+(?:INFOSAUDE\.)?\w+\s+IS\s+'((?:[^']|'')*)'/i);
    return match ? this.unescapeSqlString(match[1]) : '';
  }

  private parseDefaultForForm(baseType: string, value: string): string {
    const trimmed = value.trim();
    if (/^'.*'$/.test(trimmed)) {
      return trimmed;
    }
    return trimmed;
  }

  private extractCheckExpression(stmt: string): string {
    const start = stmt.toUpperCase().indexOf('CHECK (');
    if (start === -1) {
      return '';
    }

    let depth = 0;
    let expression = '';

    for (let i = start + 'CHECK '.length; i < stmt.length; i++) {
      const char = stmt[i];
      if (char === '(') {
        depth++;
        expression += char;
        continue;
      }
      if (char === ')') {
        depth--;
        if (depth === 0) {
          break;
        }
        expression += char;
        continue;
      }
      expression += char;
    }

    return expression.trim().replace(/^\(/, '').replace(/\)$/, '').trim();
  }

  private formatColumnListForForm(value: string): string {
    return value
      .split(',')
      .map((col) => col.trim())
      .filter(Boolean)
      .join(', ');
  }

  private unescapeSqlString(value: string): string {
    return value.replace(/''/g, "'");
  }

  private typeLabel(type: ScriptType): string {
    const labels: Record<ScriptType, string> = {
      ADD_COLUMN: 'Adicionar Coluna',
      CREATE_TABLE: 'Criar Tabela',
      DROP_TABLE: 'Excluir Tabela',
      PRIMARY_KEY: 'Primary Key',
      FOREIGN_KEY: 'Foreign Key',
      CHECK_CONSTRAINT: 'Check Constraint',
      SEQUENCE: 'Sequence',
      FUNCTION: 'Function',
      PROCEDURE: 'Procedure',
      TRIGGER: 'Trigger',
      CURSOR_NOT_NULL: 'Cursor (NOT NULL)'
    };
    return labels[type];
  }
}
