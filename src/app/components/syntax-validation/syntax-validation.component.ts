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
  errors = signal<ValidationLogError[]>([]);
  statusMessage = signal('');
  showStatus = signal(false);
  isSuccess = signal(false);

  constructor(private readonly validator: SyntaxValidatorService) {}

  evaluate(): void {
    const result = this.validator.validate(this.scriptText());
    this.errors.set(result.errors);
    this.statusMessage.set(result.message);
    this.isSuccess.set(result.success);
    this.showStatus.set(true);
  }

  clear(): void {
    this.scriptText.set('');
    this.errors.set([]);
    this.statusMessage.set('');
    this.showStatus.set(false);
    this.isSuccess.set(false);
  }
}
