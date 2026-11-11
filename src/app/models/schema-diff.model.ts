export type DiffStatus = 'equal' | 'different' | 'only_source' | 'only_target' | 'changed';

export interface FieldDiff {
  field: string;
  sourceValue: string;
  targetValue: string;
  message: string;
}

export interface ColumnDiff {
  column: string;
  status: DiffStatus;
  message: string;
  sourceValue?: string;
  targetValue?: string;
  fields?: FieldDiff[];
}

export interface TableDiffSummary {
  table: string;
  schema: string | { source: string; target: string };
  status: DiffStatus;
  summary: string;
}

export interface TableComparisonResult {
  table: string;
  schema: { source: string; target: string };
  status: 'equal' | 'different';
  columnDiffs: ColumnDiff[];
  constraintDiffs: FieldDiff[];
  summary: string;
}

export interface SchemaComparisonSummary {
  totalTables: number;
  equal: number;
  different: number;
  onlySource: number;
  onlyTarget: number;
}

export interface SchemaComparisonResult {
  status: 'equal' | 'different';
  summary: SchemaComparisonSummary;
  equal: TableDiffSummary[];
  different: TableComparisonResult[];
  onlySource: TableDiffSummary[];
  onlyTarget: TableDiffSummary[];
}

export interface TableCompareResponse {
  mode: 'table';
  source: { profileId: string; schema: string; table: string };
  target: { profileId: string; schema: string; table: string };
  result: TableComparisonResult;
}

export interface SchemaCompareResponse {
  mode: 'schema';
  source: { profileId: string; schema: string };
  target: { profileId: string; schema: string };
  result: SchemaComparisonResult;
}

export type CompareResponse = TableCompareResponse | SchemaCompareResponse;
