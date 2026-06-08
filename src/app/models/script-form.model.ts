import { ScriptType } from './script-types';

export interface TableColumn {
  name: string;
  dataTypeBase: string;
  dataTypeSize: string;
  notNull: boolean;
  comment: string;
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
  columns: TableColumn[];
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
}

export function createEmptyColumn(): TableColumn {
  return {
    name: '',
    dataTypeBase: 'VARCHAR2',
    dataTypeSize: '50',
    notNull: false,
    comment: ''
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
    columns: [createEmptyColumn()],
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
    cursorWhereClause: ''
  };
}
