export interface ValidationLogError {
  logErro: string;
  linha: number;
  descricao: string;
}

export interface ValidationResult {
  errors: ValidationLogError[];
  success: boolean;
  message: string;
  correctedText: string;
}

export interface PreValidationError {
  linha: number;
  descricao: string;
}

export interface StatementValidation {
  index: number;
  linha: number;
  preview: string;
  valid: boolean;
  error?: string;
}

export interface PreValidationResult {
  mode: 'static' | 'oracle';
  success: boolean;
  message: string;
  statements: StatementValidation[];
  errors: PreValidationError[];
  oracleAvailable?: boolean;
}
