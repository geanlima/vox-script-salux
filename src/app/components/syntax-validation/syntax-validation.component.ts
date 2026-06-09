import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  PreValidationResult,
  ValidationLogError,
  ValidationResult
} from '../../models/validation-error.model';
import { OracleExecutionService } from '../../services/oracle-execution.service';
import { ScriptPrevalidatorService } from '../../services/script-prevalidator.service';
import { SyntaxValidatorService } from '../../services/syntax-validator.service';

@Component({
  selector: 'app-syntax-validation',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './syntax-validation.component.html',
  styleUrl: './syntax-validation.component.scss'
})
export class SyntaxValidationComponent implements OnInit {
  scriptText = signal('');
  correctedText = signal('');
  errors = signal<ValidationLogError[]>([]);
  preValidation = signal<PreValidationResult | null>(null);
  statusMessage = signal('');
  showStatus = signal(false);
  isSuccess = signal(false);
  hasCorrection = signal(false);
  oracleAvailable = signal(false);
  isEvaluating = signal(false);

  constructor(
    private readonly validator: SyntaxValidatorService,
    private readonly prevalidator: ScriptPrevalidatorService,
    private readonly oracleExecution: OracleExecutionService
  ) {}

  ngOnInit(): void {
    this.oracleExecution.checkAvailability().subscribe((available) => {
      this.oracleAvailable.set(available);
    });
  }

  evaluate(): void {
    const script = this.scriptText();
    this.isEvaluating.set(true);
    this.preValidation.set(null);

    let cadastrosResult: ValidationResult;
    try {
      cadastrosResult = this.validator.validate(script);
    } catch {
      this.errors.set([
        {
          logErro: '1',
          linha: 0,
          descricao: 'Erro ao processar o script. Verifique o conteúdo e tente novamente.'
        }
      ]);
      this.statusMessage.set('Inconsistência encontrada: :o(');
      this.isSuccess.set(false);
      this.correctedText.set('');
      this.hasCorrection.set(false);
      this.showStatus.set(true);
      this.isEvaluating.set(false);
      return;
    }

    this.errors.set(cadastrosResult.errors);
    this.correctedText.set(cadastrosResult.correctedText);
    this.hasCorrection.set(
      !cadastrosResult.success &&
        cadastrosResult.correctedText.trim() !== '' &&
        cadastrosResult.correctedText !== script
    );

    const staticResult = this.prevalidator.validate(script);

    const finish = (preValidation: PreValidationResult) => {
      this.preValidation.set(preValidation);
      this.isSuccess.set(cadastrosResult.success && preValidation.success);
      this.statusMessage.set(this.buildStatusMessage(cadastrosResult, preValidation));
      this.showStatus.set(true);
      this.isEvaluating.set(false);
    };

    if (!this.oracleAvailable()) {
      finish(staticResult);
      return;
    }

    this.oracleExecution.prevalidate(script).subscribe((oracleResult) => {
      if (oracleResult.oracleAvailable === false) {
        finish(staticResult);
        return;
      }

      finish(this.mergePrevalidation(staticResult, oracleResult));
    });
  }

  applyCorrection(): void {
    const corrected = this.correctedText();
    if (corrected) {
      this.scriptText.set(corrected);
      this.evaluate();
    }
  }

  copyCorrection(): void {
    const corrected = this.correctedText();
    if (corrected) {
      navigator.clipboard.writeText(corrected);
    }
  }

  clear(): void {
    this.scriptText.set('');
    this.correctedText.set('');
    this.errors.set([]);
    this.preValidation.set(null);
    this.statusMessage.set('');
    this.showStatus.set(false);
    this.isSuccess.set(false);
    this.hasCorrection.set(false);
    this.isEvaluating.set(false);
  }

  private mergePrevalidation(
    staticResult: PreValidationResult,
    oracleResult: PreValidationResult
  ): PreValidationResult {
    const mergedErrors = [...staticResult.errors, ...oracleResult.errors];
    const mergedStatements = oracleResult.statements.map((statement) => {
      const staticStatement = staticResult.statements.find((item) => item.index === statement.index);
      if (staticStatement && !staticStatement.valid) {
        return {
          ...statement,
          valid: false,
          error: staticStatement.error ?? statement.error,
          warning: undefined
        };
      }
      return statement;
    });

    return {
      mode: 'oracle',
      success: mergedErrors.length === 0,
      message:
        mergedErrors.length === 0
          ? oracleResult.message
          : `Validação Oracle encontrou ${mergedErrors.length} problema(s).`,
      statements: mergedStatements,
      errors: mergedErrors,
      oracleAvailable: true
    };
  }

  private buildStatusMessage(
    cadastrosResult: ValidationResult,
    preValidation: PreValidationResult
  ): string {
    const cadastrosOk = cadastrosResult.success;
    const oracleOk = preValidation.success;

    if (cadastrosOk && oracleOk) {
      return cadastrosResult.message;
    }

    if (!cadastrosOk && !oracleOk) {
      return 'Inconsistências encontradas nas regras do Cadastros Gerais e na sintaxe Oracle.';
    }

    if (!cadastrosOk) {
      return cadastrosResult.message;
    }

    return preValidation.message;
  }
}
