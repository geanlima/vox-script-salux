import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ValidationLogError } from '../../models/validation-error.model';
import { SyntaxValidatorService } from '../../services/syntax-validator.service';

@Component({
  selector: 'app-syntax-validation',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './syntax-validation.component.html',
  styleUrl: './syntax-validation.component.scss'
})
export class SyntaxValidationComponent {
  scriptText = signal('');
  correctedText = signal('');
  errors = signal<ValidationLogError[]>([]);
  statusMessage = signal('');
  showStatus = signal(false);
  isSuccess = signal(false);
  hasCorrection = signal(false);

  constructor(private readonly validator: SyntaxValidatorService) {}

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
    }
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
    this.statusMessage.set('');
    this.showStatus.set(false);
    this.isSuccess.set(false);
    this.hasCorrection.set(false);
  }
}
