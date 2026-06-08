import { Injectable } from '@angular/core';
import {
  buildOracleDataType,
  formatOracleDefaultValue,
  sizeIsRequired
} from '../models/oracle-type.util';
import { ScriptFormData, TableColumn } from '../models/script-form.model';
import { ScriptType } from '../models/script-types';

const SCHEMA = 'INFOSAUDE';
const MAX_OBJECT_NAME_LENGTH = 30;

export interface ValidationError {
  field: string;
  message: string;
}

export interface SqlGenerationResult {
  sql: string;
  fileName: string;
  errors: ValidationError[];
}

@Injectable({ providedIn: 'root' })
export class SqlGeneratorService {
  generate(form: ScriptFormData): SqlGenerationResult {
    const errors = this.validate(form);
    if (errors.length > 0) {
      return { sql: '', fileName: '', errors };
    }

    const table = this.normalize(form.tableName);
    const column = this.normalize(form.columnName);
    let commands: string[] = [];

    switch (form.scriptType) {
      case 'ADD_COLUMN':
        commands = this.buildAddColumn(form, table, column);
        break;
      case 'CREATE_TABLE':
        commands = this.buildCreateTable(form, table);
        break;
      case 'DROP_TABLE':
        commands = this.buildDropTable(table);
        break;
      case 'PRIMARY_KEY':
        commands = this.buildPrimaryKey(form, table);
        break;
      case 'FOREIGN_KEY':
        commands = this.buildForeignKey(form, table);
        break;
      case 'CHECK_CONSTRAINT':
        commands = this.buildCheckConstraint(form, table);
        break;
      case 'SEQUENCE':
        commands = this.buildSequence(form);
        break;
      case 'FUNCTION':
        commands = this.buildFunction(form);
        break;
      case 'PROCEDURE':
        commands = this.buildProcedure(form);
        break;
      case 'TRIGGER':
        commands = this.buildTrigger(form);
        break;
      case 'CURSOR_NOT_NULL':
        commands = this.buildCursorNotNull(form, table, column);
        break;
    }

    const sql = this.joinCommands(commands);
    const fileName = this.buildFileName(form, table, column);

    return { sql, fileName, errors: [] };
  }

  private validate(form: ScriptFormData): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!form.cardNumber.trim()) {
      errors.push({ field: 'cardNumber', message: 'Informe o número do card.' });
    }

    if (!form.tableName.trim() && form.scriptType !== 'FUNCTION' && form.scriptType !== 'PROCEDURE') {
      errors.push({ field: 'tableName', message: 'Informe o nome da tabela.' });
    }

    this.validateObjectName(form.tableName, 'tableName', 'Tabela', errors);

    if (['ADD_COLUMN', 'CURSOR_NOT_NULL'].includes(form.scriptType)) {
      if (!form.columnName.trim()) {
        errors.push({ field: 'columnName', message: 'Informe o nome do campo.' });
      }
      this.validateObjectName(form.columnName, 'columnName', 'Campo', errors);
      this.validateDataType(form.dataTypeBase, form.dataTypeSize, 'dataTypeBase', 'dataTypeSize', 'Campo', errors);
      if (!form.comment.trim()) {
        errors.push({ field: 'comment', message: 'Informe o comentário do campo.' });
      }
    }

    if (form.scriptType === 'CREATE_TABLE') {
      if (form.columns.length === 0) {
        errors.push({ field: 'columns', message: 'Adicione ao menos uma coluna.' });
      }
      form.columns.forEach((col, index) => {
        if (!col.name.trim()) {
          errors.push({ field: `column_${index}`, message: `Coluna ${index + 1}: informe o nome.` });
        }
        this.validateObjectName(col.name, `column_${index}`, `Coluna ${index + 1}`, errors);
        this.validateDataType(
          col.dataTypeBase,
          col.dataTypeSize,
          `column_type_base_${index}`,
          `column_type_size_${index}`,
          `Coluna ${index + 1}`,
          errors
        );
        if (!col.comment.trim()) {
          errors.push({ field: `column_comment_${index}`, message: `Coluna ${index + 1}: informe o comentário.` });
        }
      });
    }

    if (form.scriptType === 'PRIMARY_KEY' && !form.pkColumns.trim()) {
      errors.push({ field: 'pkColumns', message: 'Informe as colunas da Primary Key.' });
    }

    if (form.scriptType === 'FOREIGN_KEY') {
      if (!form.fkColumns.trim()) errors.push({ field: 'fkColumns', message: 'Informe as colunas da FK.' });
      if (!form.fkRefTable.trim()) errors.push({ field: 'fkRefTable', message: 'Informe a tabela de referência.' });
      if (!form.fkRefColumns.trim()) errors.push({ field: 'fkRefColumns', message: 'Informe as colunas de referência.' });
    }

    if (form.scriptType === 'CHECK_CONSTRAINT' && !form.ckcExpression.trim()) {
      errors.push({ field: 'ckcExpression', message: 'Informe a expressão do CHECK.' });
    }

    if (form.scriptType === 'SEQUENCE') {
      if (!form.sequenceName.trim()) {
        errors.push({ field: 'sequenceName', message: 'Informe o nome da sequence.' });
      }
      this.validateObjectName(form.sequenceName, 'sequenceName', 'Sequence', errors);
    }

    if (['FUNCTION', 'PROCEDURE', 'TRIGGER'].includes(form.scriptType)) {
      if (!form.objectName.trim()) {
        errors.push({ field: 'objectName', message: 'Informe o nome do objeto.' });
      }
      this.validateObjectName(form.objectName, 'objectName', 'Objeto', errors);
      if (!form.plsqlBody.trim()) {
        errors.push({ field: 'plsqlBody', message: 'Informe o corpo PL/SQL.' });
      }
    }

    if (form.scriptType === 'CURSOR_NOT_NULL') {
      if (!form.cursorDefaultValue.trim()) {
        errors.push({ field: 'cursorDefaultValue', message: 'Informe o valor padrão do cursor.' });
      }
    }

    return errors;
  }

  private validateDataType(
    baseType: string,
    size: string,
    baseField: string,
    sizeField: string,
    label: string,
    errors: ValidationError[]
  ): void {
    if (!baseType.trim()) {
      errors.push({ field: baseField, message: `${label}: informe o tipo.` });
      return;
    }

    if (sizeIsRequired(baseType) && !size.trim()) {
      errors.push({ field: sizeField, message: `${label}: informe o tamanho.` });
    }
  }

  private resolveDataType(baseType: string, size: string): string {
    return buildOracleDataType(baseType, size);
  }

  private validateObjectName(
    name: string,
    field: string,
    label: string,
    errors: ValidationError[]
  ): void {
    const normalized = name.trim().toUpperCase();
    if (normalized && normalized.length > MAX_OBJECT_NAME_LENGTH) {
      errors.push({
        field,
        message: `${label} não pode ultrapassar ${MAX_OBJECT_NAME_LENGTH} caracteres (atual: ${normalized.length}).`
      });
    }
  }

  private buildAddColumn(form: ScriptFormData, table: string, column: string): string[] {
    const commands: string[] = [];
    const dataType = this.resolveDataType(form.dataTypeBase, form.dataTypeSize);
    let alter = `ALTER TABLE ${SCHEMA}.${table} ADD ${column} ${dataType}`;

    if (form.defaultValue.trim()) {
      alter += ` DEFAULT ${formatOracleDefaultValue(form.dataTypeBase, form.defaultValue)}`;
    }
    if (form.notNull) {
      alter += ' NOT NULL';
    }

    commands.push(alter);
    commands.push(
      `COMMENT ON COLUMN ${SCHEMA}.${table}.${column} IS '${this.escapeComment(form.comment)}'`
    );

    return commands;
  }

  private buildCreateTable(form: ScriptFormData, table: string): string[] {
    const commands: string[] = [];
    const columnDefs = form.columns
      .map((col) => this.formatColumnDefinition(col))
      .join(',\n    ');

    commands.push(
      `CREATE TABLE ${SCHEMA}.${table} (\n    ${columnDefs}\n)`
    );
    commands.push(`CREATE OR REPLACE PUBLIC SYNONYM ${table} FOR ${SCHEMA}.${table}`);
    commands.push(
      `GRANT DELETE, INSERT, SELECT, UPDATE ON ${SCHEMA}.${table} TO ROLE_INFOSAUDE`
    );

    if (form.tableComment.trim()) {
      commands.push(
        `COMMENT ON TABLE ${SCHEMA}.${table} IS '${this.escapeComment(form.tableComment)}'`
      );
    }

    form.columns.forEach((col) => {
      const colName = this.normalize(col.name);
      commands.push(
        `COMMENT ON COLUMN ${SCHEMA}.${table}.${colName} IS '${this.escapeComment(col.comment)}'`
      );
    });

    return commands;
  }

  private formatColumnDefinition(col: TableColumn): string {
    const dataType = this.resolveDataType(col.dataTypeBase, col.dataTypeSize);
    let def = `${this.normalize(col.name)} ${dataType}`;
    if (col.notNull) {
      def += ' NOT NULL';
    }
    return def;
  }

  private buildDropTable(table: string): string[] {
    return [
      `DROP TABLE ${SCHEMA}.${table} CASCADE CONSTRAINTS`,
      `DROP SYNONYM ${table}`
    ];
  }

  private buildPrimaryKey(form: ScriptFormData, table: string): string[] {
    const pkName = this.truncateName(`PK_${table}`);
    const columns = this.formatColumnList(form.pkColumns);
    return [
      `ALTER TABLE ${SCHEMA}.${table} ADD CONSTRAINT ${pkName}\nPRIMARY KEY (${columns})`
    ];
  }

  private buildForeignKey(form: ScriptFormData, table: string): string[] {
    const seq = String(form.fkSequence).padStart(2, '0');
    const fkName = this.truncateName(`FK_${table}_${seq}`);
    const columns = this.formatColumnList(form.fkColumns);
    const refTable = this.normalize(form.fkRefTable);
    const refColumns = this.formatColumnList(form.fkRefColumns);

    return [
      `ALTER TABLE ${SCHEMA}.${table} ADD CONSTRAINT ${fkName} FOREIGN KEY (${columns})\nREFERENCES ${SCHEMA}.${refTable} (${refColumns})`
    ];
  }

  private buildCheckConstraint(form: ScriptFormData, table: string): string[] {
    const seq = String(form.ckcSequence).padStart(2, '0');
    const ckcName = this.truncateName(`CKC_${table}_${seq}`);
    return [
      `ALTER TABLE ${SCHEMA}.${table}\nADD CONSTRAINT ${ckcName} CHECK (${form.ckcExpression.trim()})`
    ];
  }

  private buildSequence(form: ScriptFormData): string[] {
    const seqName = this.normalize(form.sequenceName);
    return [
      `CREATE SEQUENCE ${SCHEMA}.${seqName}\nSTART WITH 1\nMAXVALUE 99999999999\nMINVALUE 1\nINCREMENT BY 1\nNOCYCLE\nNOCACHE`,
      `CREATE OR REPLACE PUBLIC SYNONYM ${seqName} FOR ${SCHEMA}.${seqName}`,
      `GRANT SELECT ON ${SCHEMA}.${seqName} TO ROLE_INFOSAUDE`
    ];
  }

  private buildFunction(form: ScriptFormData): string[] {
    const name = this.normalize(form.objectName);
    const body = form.plsqlBody.trim();
    const commands = [`CREATE OR REPLACE FUNCTION ${SCHEMA}.${name} ${body}`];
    commands.push(`CREATE OR REPLACE PUBLIC SYNONYM ${name} FOR ${SCHEMA}.${name}`);
    return commands;
  }

  private buildProcedure(form: ScriptFormData): string[] {
    const name = this.normalize(form.objectName);
    const body = form.plsqlBody.trim();
    return [`CREATE OR REPLACE PROCEDURE ${SCHEMA}.${name} ${body}`];
  }

  private buildTrigger(form: ScriptFormData): string[] {
    const name = this.normalize(form.objectName);
    const table = this.normalize(form.tableName);
    const body = form.plsqlBody.trim();
    return [`CREATE OR REPLACE TRIGGER ${SCHEMA}.${name}\n${body}`];
  }

  private buildCursorNotNull(form: ScriptFormData, table: string, column: string): string[] {
    const commands: string[] = [];
    const defaultVal = formatOracleDefaultValue(form.dataTypeBase, form.cursorDefaultValue);
    const whereClause = form.cursorWhereClause.trim()
      ? `WHERE ${form.cursorWhereClause.trim()}`
      : `WHERE ${column} IS NULL`;

    const dataType = this.resolveDataType(form.dataTypeBase, form.dataTypeSize);
    commands.push(`ALTER TABLE ${SCHEMA}.${table} ADD ${column} ${dataType}`);
    commands.push(
      `DECLARE\n\n    CURSOR CUR_SEQ\n    IS\n\n        SELECT *\n        FROM ${table.toLowerCase()}\n        ${whereClause}\n        ORDER BY 1;\n\n    GRADE CUR_SEQ%ROWTYPE;\n\nBEGIN\n\n    FOR GRADE IN CUR_SEQ\n    LOOP\n\n        UPDATE ${SCHEMA}.${table}\n        SET ${column} = ${defaultVal}\n        WHERE ROWID = GRADE.ROWID;\n\n        COMMIT;\n\n    END LOOP;\n\nEND;`
    );
    commands.push(
      `ALTER TABLE ${SCHEMA}.${table} MODIFY ${column} DEFAULT ${defaultVal} NOT NULL`
    );
    commands.push(
      `COMMENT ON COLUMN ${SCHEMA}.${table}.${column} IS '${this.escapeComment(form.comment)}'`
    );

    return commands;
  }

  private joinCommands(commands: string[]): string {
    return commands.map((cmd) => `${cmd.trim()}\n/`).join('\n');
  }

  private buildFileName(form: ScriptFormData, table: string, column: string): string {
    const card = form.cardNumber.trim().replace(/\s+/g, '_');
    const type = form.scriptType.toLowerCase();
    const suffix = column || table || form.objectName || form.sequenceName;
    const normalizedSuffix = this.normalize(suffix || 'script');
    return `CARD_${card}_${type}_${normalizedSuffix}.sql`;
  }

  private normalize(value: string): string {
    return value.trim().toUpperCase().replace(/\s+/g, '_');
  }

  private formatColumnList(value: string): string {
    return value
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean)
      .join(', ');
  }

  private truncateName(name: string): string {
    const normalized = this.normalize(name);
    return normalized.length <= MAX_OBJECT_NAME_LENGTH
      ? normalized
      : normalized.substring(0, MAX_OBJECT_NAME_LENGTH);
  }

  private escapeComment(comment: string): string {
    return comment.trim().replace(/'/g, "''");
  }

  downloadSql(sql: string, fileName: string): void {
    const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
