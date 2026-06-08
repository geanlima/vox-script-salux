import { Injectable } from '@angular/core';
import {
  PreValidationError,
  PreValidationResult,
  StatementValidation
} from '../models/validation-error.model';
import { splitOracleScript } from '../utils/oracle-script-splitter';

@Injectable({ providedIn: 'root' })
export class ScriptPrevalidatorService {
  validate(rawText: string): PreValidationResult {
    const text = rawText ?? '';
    if (!text.trim()) {
      return {
        mode: 'static',
        success: true,
        message: 'Informe um script para pré-validar.',
        statements: [],
        errors: []
      };
    }

    const statements = splitOracleScript(text);
    const errors: PreValidationError[] = [];
    const statementResults: StatementValidation[] = [];

    if (statements.length === 0) {
      errors.push({
        linha: 0,
        descricao: 'Nenhum comando identificado. Verifique o separador / entre instruções.'
      });
    }

    statements.forEach((statement) => {
      const statementErrors = this.validateStatement(statement.text, statement.startLine);
      errors.push(...statementErrors);

      statementResults.push({
        index: statement.index,
        linha: statement.startLine,
        preview: statement.preview,
        valid: statementErrors.length === 0,
        error: statementErrors[0]?.descricao
      });
    });

    const success = errors.length === 0;
    return {
      mode: 'static',
      success,
      message: success
        ? `Pré-validação estática OK: ${statements.length} comando(s) analisado(s).`
        : `Pré-validação estática encontrou ${errors.length} problema(s).`,
      statements: statementResults,
      errors
    };
  }

  private validateStatement(sql: string, startLine: number): PreValidationError[] {
    const errors: PreValidationError[] = [];
    const trimmed = sql.trim();

    if (!trimmed) {
      errors.push({ linha: startLine, descricao: 'Comando vazio entre separadores /.' });
      return errors;
    }

    if (this.hasUnbalancedQuotes(trimmed)) {
      errors.push({
        linha: startLine,
        descricao: 'Aspas simples desbalanceadas no comando.'
      });
    }

    if (this.hasUnbalancedParentheses(trimmed)) {
      errors.push({
        linha: startLine,
        descricao: 'Parênteses desbalanceados no comando.'
      });
    }

    if (this.hasInvalidTrailingSemicolon(trimmed)) {
      errors.push({
        linha: startLine,
        descricao: 'Ponto e vírgula (;) fora de bloco PL/SQL. Remova o ; no final do comando.'
      });
    }

    if (this.isDdlWithoutInfosaude(trimmed)) {
      errors.push({
        linha: startLine,
        descricao: 'Comando DDL/DML deve referenciar o schema INFOSAUDE.'
      });
    }

    if (/^\s*--/m.test(trimmed) && !/comment\s+on/i.test(trimmed)) {
      errors.push({
        linha: startLine,
        descricao: 'Comentários SQL (--) não são permitidos, exceto COMMENT ON.'
      });
    }

    return errors;
  }

  private hasUnbalancedQuotes(sql: string): boolean {
    let inside = false;

    for (let i = 0; i < sql.length; i++) {
      if (sql[i] !== "'") {
        continue;
      }

      if (sql[i + 1] === "'") {
        i++;
        continue;
      }

      inside = !inside;
    }

    return inside;
  }

  private hasUnbalancedParentheses(sql: string): boolean {
    let depth = 0;
    let insideQuote = false;

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];

      if (char === "'") {
        if (sql[i + 1] === "'") {
          i++;
          continue;
        }
        insideQuote = !insideQuote;
        continue;
      }

      if (insideQuote) {
        continue;
      }

      if (char === '(') {
        depth++;
      } else if (char === ')') {
        depth--;
        if (depth < 0) {
          return true;
        }
      }
    }

    return depth !== 0;
  }

  private hasInvalidTrailingSemicolon(sql: string): boolean {
    const upper = sql.trim().toUpperCase();
    const isPlSqlBlock =
      upper.startsWith('DECLARE') ||
      upper.startsWith('BEGIN') ||
      /^CREATE\s+OR\s+REPLACE\s+(FUNCTION|PROCEDURE|TRIGGER|PACKAGE)/.test(upper);

    if (isPlSqlBlock) {
      return false;
    }

    return /;\s*$/.test(sql.trim());
  }

  private isDdlWithoutInfosaude(sql: string): boolean {
    const upper = sql.trim().toUpperCase();
    const requiresSchema =
      upper.startsWith('ALTER TABLE') ||
      upper.startsWith('CREATE TABLE') ||
      upper.startsWith('DROP TABLE') ||
      upper.startsWith('COMMENT ON') ||
      upper.startsWith('CREATE SEQUENCE') ||
      upper.startsWith('GRANT ') ||
      upper.startsWith('CREATE OR REPLACE PUBLIC SYNONYM');

    if (!requiresSchema) {
      return false;
    }

    return !upper.includes('INFOSAUDE');
  }
}
