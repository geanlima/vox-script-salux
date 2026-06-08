import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  PreValidationResult,
  ValidationLogError
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
  isPrevalidating = signal(false);

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
    try {
      const result = this.validator.validate(this.scriptText());
      this.errors.set(result.errors);
      this.statusMessage.set(result.message);
      this.isSuccess.set(result.success);
      this.correctedText.set(result.correctedText);
      this.hasCorrection.set(
        !result.success &&
          result.correctedText.trim() !== '' &&
          result.correctedText !== this.scriptText()
      );
      this.showStatus.set(true);
      this.preValidation.set(null);
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
      this.preValidation.set(null);
    }
  }

  prevalidateExecution(): void {
    const script = this.scriptText();
    this.isPrevalidating.set(true);
    this.preValidation.set(null);

    const staticResult = this.prevalidator.validate(script);

    if (!this.oracleAvailable()) {
      this.preValidation.set(staticResult);
      this.isPrevalidating.set(false);
      return;
    }

    this.oracleExecution.prevalidate(script).subscribe((oracleResult) => {
      if (oracleResult.oracleAvailable === false) {
        this.preValidation.set(staticResult);
        this.isPrevalidating.set(false);
        return;
      }

      const mergedErrors = [...staticResult.errors, ...oracleResult.errors];
      const mergedStatements = oracleResult.statements.map((statement) => {
        const staticStatement = staticResult.statements.find((item) => item.index === statement.index);
        if (staticStatement && !staticStatement.valid) {
          return {
            ...statement,
            valid: false,
            error: staticStatement.error ?? statement.error
          };
        }
        return statement;
      });

      this.preValidation.set({
        mode: 'oracle',
        success: mergedErrors.length === 0,
        message:
          mergedErrors.length === 0
            ? oracleResult.message
            : `Pré-validação encontrou ${mergedErrors.length} problema(s).`,
        statements: mergedStatements,
        errors: mergedErrors,
        oracleAvailable: true
      });
      this.isPrevalidating.set(false);
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
    this.isPrevalidating.set(false);
  }
}
