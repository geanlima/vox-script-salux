import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ORACLE_BASE_TYPES,
  requiresSize,
  sizeIsRequired
} from '../../models/oracle-type.util';
import { SCRIPT_TYPE_OPTIONS, ScriptType } from '../../models/script-types';
import {
  createEmptyColumn,
  createEmptyFormData,
  ScriptFormData,
  TableColumn
} from '../../models/script-form.model';
import { SqlGeneratorService } from '../../services/sql-generator.service';

@Component({
  selector: 'app-script-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './script-form.component.html',
  styleUrl: './script-form.component.scss'
})
export class ScriptFormComponent {
  readonly scriptTypes = SCRIPT_TYPE_OPTIONS;
  readonly baseTypes = ORACLE_BASE_TYPES;
  readonly requiresSize = requiresSize;
  readonly sizeIsRequired = sizeIsRequired;

  form = signal<ScriptFormData>(createEmptyFormData());
  generatedSql = signal('');
  fileName = signal('');
  validationErrors = signal<{ field: string; message: string }[]>([]);
  showPreview = signal(false);

  readonly currentScriptType = computed(() => this.form().scriptType);
  readonly currentScriptDescription = computed(
    () => this.scriptTypes.find((t) => t.value === this.form().scriptType)?.description ?? ''
  );

  constructor(private readonly sqlGenerator: SqlGeneratorService) {}

  updateField<K extends keyof ScriptFormData>(key: K, value: ScriptFormData[K]): void {
    this.form.update((current) => ({ ...current, [key]: value }));
  }

  onScriptTypeChange(value: ScriptType): void {
    this.updateField('scriptType', value);
    this.clearOutput();
  }

  addColumn(): void {
    this.form.update((current) => ({
      ...current,
      columns: [...current.columns, createEmptyColumn()]
    }));
  }

  removeColumn(index: number): void {
    this.form.update((current) => ({
      ...current,
      columns: current.columns.filter((_, i) => i !== index)
    }));
  }

  updateColumn(index: number, field: keyof TableColumn, value: string | boolean): void {
    this.form.update((current) => ({
      ...current,
      columns: current.columns.map((col, i) =>
        i === index ? { ...col, [field]: value } : col
      )
    }));
  }

  generateScript(): void {
    const result = this.sqlGenerator.generate(this.form());

    this.validationErrors.set(result.errors);
    this.generatedSql.set(result.sql);
    this.fileName.set(result.fileName);
    this.showPreview.set(result.errors.length === 0);

    if (result.errors.length === 0) {
      this.sqlGenerator.downloadSql(result.sql, result.fileName);
    }
  }

  downloadAgain(): void {
    const sql = this.generatedSql();
    const name = this.fileName();
    if (sql && name) {
      this.sqlGenerator.downloadSql(sql, name);
    }
  }

  resetForm(): void {
    this.form.set(createEmptyFormData());
    this.clearOutput();
  }

  copyToClipboard(): void {
    const sql = this.generatedSql();
    if (sql) {
      navigator.clipboard.writeText(sql);
    }
  }

  private clearOutput(): void {
    this.generatedSql.set('');
    this.fileName.set('');
    this.validationErrors.set([]);
    this.showPreview.set(false);
  }
}
