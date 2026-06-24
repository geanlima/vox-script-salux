export type ScriptType =
  | 'ADD_COLUMN'
  | 'CREATE_TABLE'
  | 'DROP_TABLE'
  | 'PRIMARY_KEY'
  | 'FOREIGN_KEY'
  | 'CHECK_CONSTRAINT'
  | 'SEQUENCE'
  | 'FUNCTION'
  | 'PROCEDURE'
  | 'TRIGGER'
  | 'CURSOR_NOT_NULL'
  | 'MODULO_PROCESSO'
  | 'INSERT'
  | 'UPDATE';

export interface ScriptTypeOption {
  value: ScriptType;
  label: string;
  description: string;
}

export const SCRIPT_TYPE_OPTIONS: ScriptTypeOption[] = [
  {
    value: 'ADD_COLUMN',
    label: 'Adicionar Coluna',
    description: 'ALTER TABLE com COMMENT ON COLUMN'
  },
  {
    value: 'CREATE_TABLE',
    label: 'Criar Tabela',
    description: 'CREATE TABLE, SYNONYM, GRANT e COMMENTs'
  },
  {
    value: 'DROP_TABLE',
    label: 'Excluir Tabela',
    description: 'DROP TABLE e DROP SYNONYM'
  },
  {
    value: 'PRIMARY_KEY',
    label: 'Primary Key',
    description: 'ALTER TABLE ADD CONSTRAINT PK_'
  },
  {
    value: 'FOREIGN_KEY',
    label: 'Foreign Key',
    description: 'ALTER TABLE ADD CONSTRAINT FK_'
  },
  {
    value: 'CHECK_CONSTRAINT',
    label: 'Check Constraint',
    description: 'ALTER TABLE ADD CONSTRAINT CKC_'
  },
  {
    value: 'SEQUENCE',
    label: 'Sequence',
    description: 'CREATE SEQUENCE, SYNONYM e GRANT'
  },
  {
    value: 'FUNCTION',
    label: 'Function',
    description: 'CREATE OR REPLACE FUNCTION'
  },
  {
    value: 'PROCEDURE',
    label: 'Procedure',
    description: 'CREATE OR REPLACE PROCEDURE'
  },
  {
    value: 'TRIGGER',
    label: 'Trigger',
    description: 'CREATE OR REPLACE TRIGGER'
  },
  {
    value: 'CURSOR_NOT_NULL',
    label: 'Cursor (NOT NULL)',
    description: 'Script completo para coluna NOT NULL em tabela existente'
  },
  {
    value: 'MODULO_PROCESSO',
    label: 'Módulo Processo',
    description: 'INSERT em MODULO_PROCESSO, GRUPO_ACESSO_PROCESSO e FUNCIONARIO_PROCESSO'
  },
  {
    value: 'INSERT',
    label: 'Insert (avulso)',
    description: 'Script de INSERT com colunas, tipos e valores'
  },
  {
    value: 'UPDATE',
    label: 'Update (avulso)',
    description: 'Script de UPDATE com colunas, tipos e valores'
  }
];
