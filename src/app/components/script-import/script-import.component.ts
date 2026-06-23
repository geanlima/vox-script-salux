import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SCRIPT_TYPE_OPTIONS, ScriptType } from '../../models/script-types';
import { ScriptImportService } from '../../services/script-import.service';
import { ScriptImportSessionService } from '../../services/script-import-session.service';

@Component({
  selector: 'app-script-import',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './script-import.component.html',
  styleUrl: './script-import.component.scss'
})
export class ScriptImportComponent {
  readonly scriptTypes = SCRIPT_TYPE_OPTIONS;

  fileName = signal('');
  sqlContent = signal('');
  selectedType = signal<ScriptType | null>(null);
  detectedType = signal<ScriptType | null>(null);
  typeFromFileName = signal<ScriptType | null>(null);
  cardNumberFromFileName = signal<string | null>(null);
  analysisWarnings = signal<string[]>([]);
  analysisErrors = signal<string[]>([]);
  parseWarnings = signal<string[]>([]);
  parseErrors = signal<string[]>([]);
  parseReady = signal(false);

  readonly selectedTypeDescription = computed(() => {
    const type = this.selectedType();
    if (!type) {
      return '';
    }
    return this.scriptTypes.find((entry) => entry.value === type)?.description ?? '';
  });

  readonly canContinue = computed(
    () => this.parseReady() && this.selectedType() !== null && this.parseErrors().length === 0
  );

  constructor(
    private readonly scriptImport: ScriptImportService,
    private readonly importSession: ScriptImportSessionService,
    private readonly router: Router
  ) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.resetFeedback();

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      this.fileName.set(file.name);
      this.sqlContent.set(content);
      this.analyzeContent(content, file.name);
    };
    reader.onerror = () => {
      this.analysisErrors.set(['Não foi possível ler o arquivo selecionado.']);
    };
    reader.readAsText(file);

    input.value = '';
  }

  triggerFilePicker(): void {
    document.getElementById('scriptImportPageInput')?.click();
  }

  onTypeChange(value: ScriptType): void {
    this.selectedType.set(value);
    this.runParsePreview();
  }

  continueToCadastro(): void {
    const type = this.selectedType();
    const content = this.sqlContent();
    const name = this.fileName();
    if (!type || !content.trim() || !this.canContinue()) {
      return;
    }

    const result = this.scriptImport.import(content, name, type);
    if (!result.success) {
      this.parseErrors.set(result.errors);
      this.parseWarnings.set(result.warnings);
      this.parseReady.set(false);
      return;
    }

    this.importSession.setPending({
      form: result.form,
      warnings: result.warnings,
      fileName: name,
      detectedType: type
    });

    void this.router.navigate(['/']);
  }

  clear(): void {
    this.fileName.set('');
    this.sqlContent.set('');
    this.selectedType.set(null);
    this.detectedType.set(null);
    this.typeFromFileName.set(null);
    this.cardNumberFromFileName.set(null);
    this.resetFeedback();
  }

  typeLabel(type: ScriptType): string {
    return this.scriptTypes.find((entry) => entry.value === type)?.label ?? type;
  }

  private analyzeContent(content: string, name: string): void {
    const analysis = this.scriptImport.analyze(content, name);

    if (analysis.errors.length > 0) {
      this.analysisErrors.set(analysis.errors);
      return;
    }

    this.detectedType.set(analysis.detectedType);
    this.typeFromFileName.set(analysis.typeFromFileName);
    this.cardNumberFromFileName.set(analysis.cardNumberFromFileName);
    this.analysisWarnings.set(analysis.warnings);
    this.selectedType.set(analysis.suggestedType);
    this.runParsePreview();
  }

  private runParsePreview(): void {
    const type = this.selectedType();
    const content = this.sqlContent();
    const name = this.fileName();

    this.parseWarnings.set([]);
    this.parseErrors.set([]);
    this.parseReady.set(false);

    if (!type || !content.trim()) {
      return;
    }

    const result = this.scriptImport.import(content, name, type);
    this.parseWarnings.set(result.warnings);
    this.parseErrors.set(result.errors);
    this.parseReady.set(result.success);
  }

  private resetFeedback(): void {
    this.analysisWarnings.set([]);
    this.analysisErrors.set([]);
    this.parseWarnings.set([]);
    this.parseErrors.set([]);
    this.parseReady.set(false);
  }
}
