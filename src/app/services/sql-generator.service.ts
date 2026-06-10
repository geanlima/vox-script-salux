import { Injectable } from '@angular/core';
import {
  buildCkcConstraintName,
  buildFkConstraintName,
  formatConstraintSequence,
  MAX_OBJECT_NAME_LENGTH
} from '../models/constraint-name.util';
import {
  buildOracleDataType,
  formatOracleDefaultValue,
  sizeIsRequired
} from '../models/oracle-type.util';
import { ScriptFormData, AddColumnEntry, TableColumn } from '../models/script-form.model';

const SCHEMA = 'INFOSAUDE';

export interface ValidationError {
  field: string;
  message: string;
}

export interface SqlGenerationResult {
  sql: string;
  fileName: string;
  rollbackSql: string;
  rollbackFileName: string;
  errors: ValidationError[];
}

@Injectable({ providedIn: 'root' })
export class SqlGeneratorService {
  generate(form: ScriptFormData): SqlGenerationResult {
    const errors = this.validate(form);
    if (errors.length > 0) {
      return { sql: '', fileName: '', rollbackSql: '', rollbackFileName: '', errors };
    }

    const table = this.normalize(form.tableName);
    const column = this.normalize(form.columnName);
    let commands: string[] = [];

    switch (form.scriptType) {
      case 'ADD_COLUMN':
        commands = this.buildAddColumns(form, table);
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
    const fileSuffix =
      form.scriptType === 'ADD_COLUMN' ? this.resolveAddColumnFileSuffix(form) : column;
    const fileName = this.buildFileName(form, table, fileSuffix);

    let rollbackSql = '';
    let rollbackFileName = '';

    if (form.generateRollback) {
      const rollbackCommands = this.buildRollbackCommands(form, table, column);
      if (rollbackCommands.length > 0) {
        rollbackSql = this.joinCommands(rollbackCommands);
        rollbackFileName = this.buildFileName(form, table, fileSuffix, true);
      }
    }

    return { sql, fileName, rollbackSql, rollbackFileName, errors: [] };
  }

  private buildRollbackCommands(form: ScriptFormData, table: string, column: string): string[] {
    switch (form.scriptType) {
      case 'ADD_COLUMN':
        return this.buildAddColumnsRollback(form, table);
      case 'CREATE_TABLE':
        return this.buildCreateTableRollback(form, table);
      case 'PRIMARY_KEY': {
        const columnNames = form.pkColumns
          .split(',')
          .map((col) => this.normalize(col))
          .filter(Boolean);
        return [
          `ALTER TABLE ${SCHEMA}.${table} DROP CONSTRAINT ${this.buildPkConstraintName(columnNames)}`
        ];
      }
      case 'FOREIGN_KEY':
        return [
          `ALTER TABLE ${SCHEMA}.${table} DROP CONSTRAINT ${buildFkConstraintName(table, form.fkSequence)}`
        ];
      case 'CHECK_CONSTRAINT':
        return [
          `ALTER TABLE ${SCHEMA}.${table} DROP CONSTRAINT ${buildCkcConstraintName(table, form.ckcSequence)}`
        ];
      case 'SEQUENCE':
        return this.buildSequenceRollback(this.normalize(form.sequenceName));
      case 'FUNCTION': {
        const name = this.normalize(form.objectName);
        return [`DROP PUBLIC SYNONYM ${name}`, `DROP FUNCTION ${SCHEMA}.${name}`];
      }
      case 'PROCEDURE':
        return [`DROP PROCEDURE ${SCHEMA}.${this.normalize(form.objectName)}`];
      case 'TRIGGER':
        return [`DROP TRIGGER ${SCHEMA}.${this.normalize(form.objectName)}`];
      case 'CURSOR_NOT_NULL':
        return [`ALTER TABLE ${SCHEMA}.${table} DROP COLUMN ${column}`];
      default:
        // DROP_TABLE: não há como gerar o CREATE original automaticamente.
        return [];
    }
  }

  private buildAddColumnsRollback(form: ScriptFormData, table: string): string[] {
    const commands: string[] = [];

    // Ordem inversa da criação: constraints primeiro, depois colunas e sequence.
    for (const col of form.addColumns.filter((entry) => entry.constraintType === 'CHECK')) {
      commands.push(
        `ALTER TABLE ${SCHEMA}.${table} DROP CONSTRAINT ${buildCkcConstraintName(table, col.ckcSequence)}`
      );
    }

    for (const col of form.addColumns.filter((entry) => entry.constraintType === 'FK')) {
      commands.push(
        `ALTER TABLE ${SCHEMA}.${table} DROP CONSTRAINT ${buildFkConstraintName(table, col.fkSequence)}`
      );
    }

    const pkEntries = form.addColumns.filter((col) => col.constraintType === 'PK');
    const pkColumns = pkEntries.map((col) => this.normalize(col.name)).filter(Boolean);
    if (pkColumns.length > 0) {
      commands.push(
        `ALTER TABLE ${SCHEMA}.${table} DROP CONSTRAINT ${this.resolvePkConstraintName(pkEntries, pkColumns)}`
      );
    }

    for (const col of form.addColumns) {
      commands.push(`ALTER TABLE ${SCHEMA}.${table} DROP COLUMN ${this.normalize(col.name)}`);
    }

    if (form.createSequence) {
      commands.push(...this.buildSequenceRollback(this.truncateName(`SEQ_${table}`)));
    }

    return commands;
  }

  private buildCreateTableRollback(form: ScriptFormData, table: string): string[] {
    const commands: string[] = [];

    if (form.createSequence) {
      commands.push(...this.buildSequenceRollback(this.truncateName(`SEQ_${table}`)));
    }

    commands.push(`DROP TABLE ${SCHEMA}.${table} CASCADE CONSTRAINTS`);
    commands.push(`DROP PUBLIC SYNONYM ${table}`);

    return commands;
  }

  private buildSequenceRollback(seqName: string): string[] {
    const name = this.normalize(seqName);
    return [`DROP PUBLIC SYNONYM ${name}`, `DROP SEQUENCE ${SCHEMA}.${name}`];
  }

  private resolveAddColumnFileSuffix(form: ScriptFormData): string {
    if (form.addColumns.length === 1) {
      return this.normalize(form.addColumns[0].name);
    }
    return this.normalize(form.tableName);
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

    if (form.scriptType === 'ADD_COLUMN') {
      if (form.addColumns.length === 0) {
        errors.push({ field: 'addColumns', message: 'Adicione ao menos uma coluna.' });
      }
      form.addColumns.forEach((col, index) => {
        this.validateAddColumnEntry(col, index, errors);
      });

      const names = form.addColumns.map((col) => this.normalize(col.name)).filter(Boolean);
      if (names.length !== new Set(names).size) {
        errors.push({ field: 'addColumns', message: 'Existem colunas com o mesmo nome.' });
      }

      if (form.tableName.trim()) {
        this.validateColumnConstraints(form.addColumns, this.normalize(form.tableName), errors, 'addColumns');
      }
    }

    if (
      (form.scriptType === 'CREATE_TABLE' || form.scriptType === 'ADD_COLUMN') &&
      form.createSequence &&
      form.tableName.trim()
    ) {
      const seqName = this.truncateName(`SEQ_${this.normalize(form.tableName)}`);
      this.validateObjectName(seqName, 'createSequence', 'Sequence', errors);
    }

    if (form.scriptType === 'CURSOR_NOT_NULL') {
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
        this.validateAddColumnEntry(col, index, errors);
      });

      const names = form.columns.map((col) => this.normalize(col.name)).filter(Boolean);
      if (names.length !== new Set(names).size) {
        errors.push({ field: 'columns', message: 'Existem colunas com o mesmo nome.' });
      }

      if (form.tableName.trim()) {
        this.validateColumnConstraints(form.columns, this.normalize(form.tableName), errors, 'columns');
      }
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

  private validateAddColumnEntry(col: AddColumnEntry, index: number, errors: ValidationError[]): void {
    const label = `Coluna ${index + 1}`;

    if (!col.name.trim()) {
      errors.push({ field: `add_column_${index}`, message: `${label}: informe o nome.` });
    }
    this.validateObjectName(col.name, `add_column_${index}`, label, errors);
    this.validateDataType(
      col.dataTypeBase,
      col.dataTypeSize,
      `add_column_type_base_${index}`,
      `add_column_type_size_${index}`,
      label,
      errors
    );
    if (!col.comment.trim()) {
      errors.push({ field: `add_column_comment_${index}`, message: `${label}: informe o comentário.` });
    }

    if (col.constraintType === 'PK' && !col.notNull) {
      errors.push({
        field: `add_column_pk_${index}`,
        message: `${label}: coluna PK deve ser NOT NULL (regra Cadastros Gerais).`
      });
    }

    if (col.constraintType === 'PK' && col.pkConstraintName.trim()) {
      this.validateObjectName(
        col.pkConstraintName,
        `add_column_pk_name_${index}`,
        `${label} (nome PK)`,
        errors
      );
    }

    if (col.notNull && !col.defaultValue.trim() && col.constraintType === 'NONE') {
      errors.push({
        field: `add_column_notnull_${index}`,
        message: `${label}: NOT NULL sem DEFAULT — use o tipo de script Cursor (NOT NULL) se a tabela já tiver dados.`
      });
    }

    if (col.constraintType === 'FK') {
      if (!col.fkRefTable.trim()) {
        errors.push({ field: `add_column_fk_table_${index}`, message: `${label}: informe a tabela de referência da FK.` });
      }
      if (!col.fkRefColumn.trim()) {
        errors.push({ field: `add_column_fk_col_${index}`, message: `${label}: informe a coluna de referência da FK.` });
      }
      this.validateObjectName(col.fkRefTable, `add_column_fk_table_${index}`, `${label} (tabela FK)`, errors);
      this.validateObjectName(col.fkRefColumn, `add_column_fk_col_${index}`, `${label} (coluna FK)`, errors);
    }

    if (col.constraintType === 'CHECK' && !col.ckcExpression.trim()) {
      errors.push({
        field: `add_column_ckc_${index}`,
        message: `${label}: informe a expressão do CHECK.`
      });
    }
  }

  private validateColumnConstraints(
    columns: AddColumnEntry[],
    table: string,
    errors: ValidationError[],
    fieldPrefix: string
  ): void {
    const pkColumns = columns.filter((col) => col.constraintType === 'PK');
    const fkColumns = columns.filter((col) => col.constraintType === 'FK');
    const checkColumns = columns.filter((col) => col.constraintType === 'CHECK');

    if (pkColumns.length > 0) {
      const pkColumnNames = pkColumns.map((col) => this.normalize(col.name)).filter(Boolean);
      const pkName = this.resolvePkConstraintName(pkColumns, pkColumnNames);
      this.validateConstraintName(pkName, 'PK', `${fieldPrefix}_pk`, errors);
    }

    const usedFkSequences = new Set<number>();
    fkColumns.forEach((col) => {
      const index = columns.indexOf(col);
      const label = `Coluna ${index + 1}`;

      if (usedFkSequences.has(col.fkSequence)) {
        errors.push({
          field: `${fieldPrefix}_fk_seq_${index}`,
          message: `${label}: sequência FK ${col.fkSequence} já utilizada (FK deve terminar com numeral único).`
        });
      }
      usedFkSequences.add(col.fkSequence);

      const fkName = buildFkConstraintName(table, col.fkSequence);
      this.validateConstraintName(fkName, 'FK', `${fieldPrefix}_fk_${index}`, errors);
    });

    const usedCkcSequences = new Set<number>();
    checkColumns.forEach((col) => {
      const index = columns.indexOf(col);
      const label = `Coluna ${index + 1}`;

      if (usedCkcSequences.has(col.ckcSequence)) {
        errors.push({
          field: `${fieldPrefix}_ckc_seq_${index}`,
          message: `${label}: sequência CKC ${formatConstraintSequence(col.ckcSequence)} já utilizada (CKC deve terminar com numeral único).`
        });
      }
      usedCkcSequences.add(col.ckcSequence);

      const ckcName = buildCkcConstraintName(table, col.ckcSequence);
      this.validateConstraintName(ckcName, 'CKC', `${fieldPrefix}_ckc_${index}`, errors);
    });
  }

  private validateConstraintName(
    name: string,
    type: 'PK' | 'FK' | 'CKC',
    field: string,
    errors: ValidationError[]
  ): void {
    if (name.length > MAX_OBJECT_NAME_LENGTH) {
      errors.push({
        field,
        message: `Nome ${name} ultrapassa ${MAX_OBJECT_NAME_LENGTH} caracteres. Encurte o nome da coluna ou ajuste a sequência.`
      });
    }

    if (type === 'PK' && !name.startsWith('PK_')) {
      errors.push({ field, message: 'Primary Key deve iniciar com PK_.' });
    }

    if (type === 'FK') {
      if (!name.startsWith('FK_')) {
        errors.push({ field, message: 'Foreign Key deve iniciar com FK_.' });
      }
      if (!/_\d{2,}$/.test(name)) {
        errors.push({
          field,
          message: `Foreign Key ${name} deve terminar com sequencial numérico de 2 dígitos (ex.: _01).`
        });
      }
    }

    if (type === 'CKC') {
      if (!name.startsWith('CKC_')) {
        errors.push({ field, message: 'Check Constraint deve iniciar com CKC_.' });
      }
      if (!/_\d{2,}$/.test(name)) {
        errors.push({
          field,
          message: `Check Constraint ${name} deve terminar com sequencial numérico de 2 dígitos (ex.: _01).`
        });
      }
    }
  }

  private buildAddColumns(form: ScriptFormData, table: string): string[] {
    const commands: string[] = [];

    for (const col of form.addColumns) {
      const column = this.normalize(col.name);
      const dataType = this.resolveDataType(col.dataTypeBase, col.dataTypeSize);
      let alter = `ALTER TABLE ${SCHEMA}.${table} ADD ${column} ${dataType}`;

      if (col.defaultValue.trim()) {
        alter += ` DEFAULT ${formatOracleDefaultValue(col.dataTypeBase, col.defaultValue)}`;
      }
      if (col.notNull) {
        alter += ' NOT NULL';
      }

      commands.push(alter);
      commands.push(
        `COMMENT ON COLUMN ${SCHEMA}.${table}.${column} IS '${this.escapeComment(col.comment)}'`
      );
    }

    const pkEntries = form.addColumns.filter((col) => col.constraintType === 'PK');
    const pkColumns = pkEntries.map((col) => this.normalize(col.name)).filter(Boolean);

    if (pkColumns.length > 0) {
      const pkName = this.resolvePkConstraintName(pkEntries, pkColumns);
      commands.push(
        `ALTER TABLE ${SCHEMA}.${table} ADD CONSTRAINT ${pkName}\nPRIMARY KEY (${pkColumns.join(', ')})`
      );
    }

    for (const col of form.addColumns.filter((entry) => entry.constraintType === 'FK')) {
      commands.push(...this.buildFkConstraintCommand(col, table));
    }

    for (const col of form.addColumns.filter((entry) => entry.constraintType === 'CHECK')) {
      commands.push(...this.buildCheckConstraintCommand(col, table));
    }

    if (form.createSequence) {
      commands.push(...this.buildSequenceCommands(this.truncateName(`SEQ_${table}`)));
    }

    return commands;
  }

  private buildCheckConstraintCommand(col: AddColumnEntry, table: string): string[] {
    return this.buildCheckConstraintCommands(table, col.ckcSequence, col.ckcExpression);
  }

  private buildCheckConstraintCommands(table: string, sequence: number, expression: string): string[] {
    const ckcName = buildCkcConstraintName(table, sequence);
    return [
      `ALTER TABLE ${SCHEMA}.${table}\nADD CONSTRAINT ${ckcName} CHECK (${expression.trim()})`
    ];
  }

  private buildFkConstraintCommand(col: AddColumnEntry, table: string): string[] {
    const column = this.normalize(col.name);
    const fkName = buildFkConstraintName(table, col.fkSequence);
    const refTable = this.normalize(col.fkRefTable);
    const refColumn = this.normalize(col.fkRefColumn);

    return [
      `ALTER TABLE ${SCHEMA}.${table} ADD CONSTRAINT ${fkName} FOREIGN KEY (${column})\nREFERENCES ${SCHEMA}.${refTable} (${refColumn})`
    ];
  }

  private appendPkAndFkCommands(commands: string[], columns: AddColumnEntry[], table: string): void {
    const pkEntries = columns.filter((col) => col.constraintType === 'PK');
    const pkColumns = pkEntries.map((col) => this.normalize(col.name)).filter(Boolean);

    if (pkColumns.length > 0) {
      const pkName = this.resolvePkConstraintName(pkEntries, pkColumns);
      commands.push(
        `ALTER TABLE ${SCHEMA}.${table} ADD CONSTRAINT ${pkName}\nPRIMARY KEY (${pkColumns.join(', ')})`
      );
    }

    for (const col of columns.filter((entry) => entry.constraintType === 'FK')) {
      commands.push(...this.buildFkConstraintCommand(col, table));
    }

    for (const col of columns.filter((entry) => entry.constraintType === 'CHECK')) {
      commands.push(...this.buildCheckConstraintCommand(col, table));
    }
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

    this.appendPkAndFkCommands(commands, form.columns, table);

    if (form.createSequence) {
      commands.push(...this.buildSequenceCommands(this.truncateName(`SEQ_${table}`)));
    }

    return commands;
  }

  private formatColumnDefinition(col: TableColumn): string {
    const dataType = this.resolveDataType(col.dataTypeBase, col.dataTypeSize);
    let def = `${this.normalize(col.name)} ${dataType}`;
    if (col.defaultValue.trim()) {
      def += ` DEFAULT ${formatOracleDefaultValue(col.dataTypeBase, col.defaultValue)}`;
    }
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
    const columnNames = form.pkColumns
      .split(',')
      .map((col) => this.normalize(col))
      .filter(Boolean);
    const pkName = this.buildPkConstraintName(columnNames);
    const columns = this.formatColumnList(form.pkColumns);
    return [
      `ALTER TABLE ${SCHEMA}.${table} ADD CONSTRAINT ${pkName}\nPRIMARY KEY (${columns})`
    ];
  }

  private buildForeignKey(form: ScriptFormData, table: string): string[] {
    const fkName = buildFkConstraintName(table, form.fkSequence);
    const columns = this.formatColumnList(form.fkColumns);
    const refTable = this.normalize(form.fkRefTable);
    const refColumns = this.formatColumnList(form.fkRefColumns);

    return [
      `ALTER TABLE ${SCHEMA}.${table} ADD CONSTRAINT ${fkName} FOREIGN KEY (${columns})\nREFERENCES ${SCHEMA}.${refTable} (${refColumns})`
    ];
  }

  private buildCheckConstraint(form: ScriptFormData, table: string): string[] {
    return this.buildCheckConstraintCommands(table, form.ckcSequence, form.ckcExpression);
  }

  private buildSequence(form: ScriptFormData): string[] {
    return this.buildSequenceCommands(form.sequenceName);
  }

  private buildSequenceCommands(seqName: string): string[] {
    const name = this.normalize(seqName);
    return [
      `CREATE SEQUENCE ${SCHEMA}.${name}\nSTART WITH 1\nMAXVALUE 99999999999\nMINVALUE 1\nINCREMENT BY 1\nNOCYCLE\nNOCACHE`,
      `CREATE OR REPLACE PUBLIC SYNONYM ${name} FOR ${SCHEMA}.${name}`,
      `GRANT SELECT ON ${SCHEMA}.${name} TO ROLE_INFOSAUDE`
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

  private buildFileName(
    form: ScriptFormData,
    table: string,
    column: string,
    rollback = false
  ): string {
    const card = form.cardNumber.trim().replace(/\s+/g, '_');
    const type = form.scriptType.toLowerCase();
    const suffix = column || table || form.objectName || form.sequenceName;
    const normalizedSuffix = this.normalize(suffix || 'script');
    const prefix = rollback ? 'rollback_' : '';
    return `CARD_${card}_${prefix}${type}_${normalizedSuffix}.sql`;
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

  private buildPkConstraintName(columnNames: string[]): string {
    if (columnNames.length === 0) {
      return 'PK_COLUNA';
    }

    if (columnNames.length === 1) {
      return this.truncateName(`PK_${columnNames[0]}`);
    }

    return this.truncateName(`PK_${columnNames.join('_')}`);
  }

  private resolvePkConstraintName(
    pkEntries: AddColumnEntry[],
    pkColumnNames: string[]
  ): string {
    const customName = pkEntries
      .map((entry) => entry.pkConstraintName.trim())
      .find(Boolean);

    if (customName) {
      return this.truncateName(customName);
    }

    return this.buildPkConstraintName(pkColumnNames);
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
