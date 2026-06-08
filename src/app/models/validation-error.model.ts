export interface ValidationLogError {
  logErro: string;
  linha: number;
  descricao: string;
}

export interface ValidationResult {
  errors: ValidationLogError[];
  success: boolean;
  message: string;
}
