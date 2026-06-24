import { ScriptType } from './script-types';

export type ColumnConstraintType = 'NONE' | 'PK' | 'FK' | 'CHECK';

export interface AddColumnEntry {
  name: string;
  dataTypeBase: string;
  dataTypeSize: string;
  notNull: boolean;
  defaultValue: string;
  comment: string;
  constraintType: ColumnConstraintType;
  pkConstraintName: string;
  fkSequence: number;
  fkRefTable: string;
  fkRefColumn: string;
  ckcSequence: number;
  ckcExpression: string;
}

export type TableColumn = AddColumnEntry;

export interface DmlColumnEntry {
  column: string;
  dataTypeBase: string;
  value: string;
  rollbackValue: string;
}

export interface ScriptFormData {
  cardNumber: string;
  scriptType: ScriptType;
  tableName: string;
  columnName: string;
  dataTypeBase: string;
  dataTypeSize: string;
  notNull: boolean;
  defaultValue: string;
  comment: string;
  tableComment: string;
  createSequence: boolean;
  columns: TableColumn[];
  addColumns: AddColumnEntry[];
  pkColumns: string;
  fkSequence: number;
  fkColumns: string;
  fkRefTable: string;
  fkRefColumns: string;
  ckcSequence: number;
  ckcExpression: string;
  sequenceName: string;
  plsqlBody: string;
  objectName: string;
  cursorDefaultValue: string;
  cursorWhereClause: string;
  mpModulo: string;
  mpProcesso: string;
  mpDescricao: string;
  mpOperacaoVinculada: string;
  mpInLogar: string;
  mpGrupoAcesso: number;
  dmlColumns: DmlColumnEntry[];
  dmlWhere: string;
  generateRollback: boolean;
}

export function createEmptyColumn(): TableColumn {
  return createEmptyAddColumn();
}

export function createEmptyDmlColumn(): DmlColumnEntry {
  return {
    column: '',
    dataTypeBase: 'VARCHAR2',
    value: '',
    rollbackValue: ''
  };
}

export function createEmptyAddColumn(): AddColumnEntry {
  return {
    name: '',
    dataTypeBase: 'VARCHAR2',
    dataTypeSize: '50',
    notNull: false,
    defaultValue: '',
    comment: '',
    constraintType: 'NONE',
    pkConstraintName: '',
    fkSequence: 1,
    fkRefTable: '',
    fkRefColumn: '',
    ckcSequence: 1,
    ckcExpression: ''
  };
}

export function createEmptyFormData(): ScriptFormData {
  return {
    cardNumber: '',
    scriptType: 'ADD_COLUMN',
    tableName: '',
    columnName: '',
    dataTypeBase: 'VARCHAR2',
    dataTypeSize: '50',
    notNull: false,
    defaultValue: '',
    comment: '',
    tableComment: '',
    createSequence: false,
    columns: [createEmptyColumn()],
    addColumns: [createEmptyAddColumn()],
    pkColumns: '',
    fkSequence: 1,
    fkColumns: '',
    fkRefTable: '',
    fkRefColumns: '',
    ckcSequence: 1,
    ckcExpression: '',
    sequenceName: '',
    plsqlBody: '',
    objectName: '',
    cursorDefaultValue: "'N'",
    cursorWhereClause: '',
    mpModulo: 'Horizon',
    mpProcesso: '',
    mpDescricao: '',
    mpOperacaoVinculada: '',
    mpInLogar: 'N',
    mpGrupoAcesso: 1,
    dmlColumns: [createEmptyDmlColumn()],
    dmlWhere: '',
    generateRollback: false
  };
}
