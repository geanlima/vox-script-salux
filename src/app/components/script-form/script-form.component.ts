import { Component, HostListener, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ORACLE_BASE_TYPES,
  requiresSize,
  sizeIsRequired
} from '../../models/oracle-type.util';
import { SCRIPT_TYPE_OPTIONS, ScriptType } from '../../models/script-types';
import {
  createEmptyAddColumn,
  createEmptyColumn,
  createEmptyFormData,
  AddColumnEntry,
  ColumnConstraintType,
  ScriptFormData,
  TableColumn
} from '../../models/script-form.model';
import { buildCkcConstraintName } from '../../models/constraint-name.util';
import { ScriptImportService } from '../../services/script-import.service';
import { SqlGeneratorService } from '../../services/sql-generator.service';
import { ScriptStorageService } from '../../services/script-storage.service';

@Component({
  selector: 'app-script-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './script-form.component.html',
  styleUrl: './script-form.component.scss'
})
export class ScriptFormComponent implements OnInit {
  readonly scriptTypes = SCRIPT_TYPE_OPTIONS;
  readonly baseTypes = ORACLE_BASE_TYPES;
  readonly requiresSize = requiresSize;
  readonly sizeIsRequired = sizeIsRequired;

  form = signal<ScriptFormData>(createEmptyFormData());
  generatedSql = signal('');
  fileName = signal('');
  rollbackSql = signal('');
  rollbackFileName = signal('');
  validationErrors = signal<{ field: string; message: string }[]>([]);
  importErrors = signal<string[]>([]);
  importWarnings = signal<string[]>([]);
  importSuccess = signal(false);
  importedFileName = signal('');
  showPreview = signal(false);
  savedScriptId = signal<number | null>(null);
  storageMessage = signal('');
  storageError = signal('');
  saving = signal(false);
  storageAvailable = signal(false);
  showLeaveDialog = signal(false);
  copied = signal(false);
  rollbackCopied = signal(false);

  private formBaseline = signal(this.serializeForm(createEmptyFormData()));
  private leaveDialogResolver: ((allow: boolean) => void) | null = null;
  private copiedTimeout: ReturnType<typeof setTimeout> | undefined;
  private rollbackCopiedTimeout: ReturnType<typeof setTimeout> | undefined;

  readonly currentScriptType = computed(() => this.form().scriptType);
  readonly currentScriptDescription = computed(
    () => this.scriptTypes.find((t) => t.value === this.form().scriptType)?.description ?? ''
  );
  readonly isEditingSavedScript = computed(() => this.savedScriptId() !== null);
  readonly canDownloadScript = computed(
    () => this.showPreview() && !!this.generatedSql().trim() && !!this.fileName().trim()
  );
  readonly hasUnsavedChanges = computed(
    () => !this.isFormEmpty(this.form()) && this.serializeForm(this.form()) !== this.formBaseline()
  );

  constructor(
    private readonly sqlGenerator: SqlGeneratorService,
    private readonly scriptStorage: ScriptStorageService,
    private readonly route: ActivatedRoute,
    private readonly scriptImport: ScriptImportService
  ) {}

  ngOnInit(): void {
    this.scriptStorage.getStorageStatus().subscribe({
      next: (status) => this.storageAvailable.set(status.available),
      error: () => this.storageAvailable.set(false)
    });

    this.route.queryParamMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (Number.isInteger(id) && id > 0) {
        this.loadSavedScript(id);
      }
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
    }
  }

  confirmLeave(): Promise<boolean> {
    if (!this.hasUnsavedChanges()) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      this.leaveDialogResolver = resolve;
      this.showLeaveDialog.set(true);
    });
  }

  onLeaveDialogSave(): void {
    void this.saveScriptAsync().then((saved) => {
      if (saved) {
        this.finishLeaveDialog(true);
      }
    });
  }

  onLeaveDialogDiscard(): void {
    this.finishLeaveDialog(true);
  }

  onLeaveDialogCancel(): void {
    this.finishLeaveDialog(false);
  }

  updateField<K extends keyof ScriptFormData>(key: K, value: ScriptFormData[K]): void {
    this.form.update((current) => ({ ...current, [key]: value }));
  }

  onScriptTypeChange(value: ScriptType): void {
    this.updateField('scriptType', value);
    this.clearOutput();
  }

  addColumn(): void {
    this.form.update((current) => {
      const newColumn = createEmptyColumn();
      newColumn.fkSequence = this.nextConstraintSequence(current.columns, 'FK', 'fkSequence');
      newColumn.ckcSequence = this.nextConstraintSequence(current.columns, 'CHECK', 'ckcSequence');

      return {
        ...current,
        columns: [...current.columns, newColumn]
      };
    });
  }

  addAddColumn(): void {
    this.form.update((current) => {
      const newColumn = createEmptyAddColumn();
      newColumn.fkSequence = this.nextConstraintSequence(current.addColumns, 'FK', 'fkSequence');
      newColumn.ckcSequence = this.nextConstraintSequence(current.addColumns, 'CHECK', 'ckcSequence');

      return {
        ...current,
        addColumns: [...current.addColumns, newColumn]
      };
    });
  }

  removeColumn(index: number): void {
    this.form.update((current) => ({
      ...current,
      columns: current.columns.filter((_, i) => i !== index)
    }));
  }

  removeAddColumn(index: number): void {
    this.form.update((current) => ({
      ...current,
      addColumns: current.addColumns.filter((_, i) => i !== index)
    }));
  }

  updateColumn(
    index: number,
    field: keyof TableColumn,
    value: string | boolean | number
  ): void {
    this.form.update((current) => ({
      ...current,
      columns: current.columns.map((col, i) => {
        if (i !== index) {
          return col;
        }

        const updated = { ...col, [field]: value };

        if (field === 'constraintType') {
          if (value === 'PK') {
            updated.notNull = true;
            if (!updated.pkConstraintName.trim()) {
              updated.pkConstraintName = this.suggestPkConstraintName(updated, current.columns);
            }
          } else {
            updated.pkConstraintName = '';
          }

          if (value === 'CHECK' && col.constraintType !== 'CHECK') {
            updated.ckcSequence = this.nextConstraintSequence(current.columns, 'CHECK', 'ckcSequence');
          }
        }

        if (field === 'name' && updated.constraintType === 'PK' && !updated.pkConstraintName.trim()) {
          updated.pkConstraintName = this.suggestPkConstraintName(updated, current.columns);
        }

        if (field === 'notNull' && value === false && updated.constraintType === 'PK') {
          updated.notNull = true;
        }

        return updated;
      })
    }));
  }

  updateAddColumn(
    index: number,
    field: keyof AddColumnEntry,
    value: string | boolean | number
  ): void {
    this.form.update((current) => ({
      ...current,
      addColumns: current.addColumns.map((col, i) => {
        if (i !== index) {
          return col;
        }

        const updated = { ...col, [field]: value };

        if (field === 'constraintType') {
          if (value === 'PK') {
            updated.notNull = true;
            if (!updated.pkConstraintName.trim()) {
              updated.pkConstraintName = this.suggestPkConstraintName(updated, current.addColumns);
            }
          } else {
            updated.pkConstraintName = '';
          }

          if (value === 'CHECK' && col.constraintType !== 'CHECK') {
            updated.ckcSequence = this.nextConstraintSequence(current.addColumns, 'CHECK', 'ckcSequence');
          }
        }

        if (field === 'name' && updated.constraintType === 'PK' && !updated.pkConstraintName.trim()) {
          updated.pkConstraintName = this.suggestPkConstraintName(updated, current.addColumns);
        }

        if (field === 'notNull' && value === false && updated.constraintType === 'PK') {
          updated.notNull = true;
        }

        return updated;
      })
    }));
  }

  generateScript(): void {
    this.applyGenerationResult();
  }

  downloadScript(): void {
    const sql = this.generatedSql();
    const name = this.fileName();
    if (sql && name) {
      this.sqlGenerator.downloadSql(sql, name);
    }
  }

  downloadRollback(): void {
    const sql = this.rollbackSql();
    const name = this.rollbackFileName();
    if (sql && name) {
      this.sqlGenerator.downloadSql(sql, name);
    }
  }

  saveScript(): void {
    void this.saveScriptAsync().then((saved) => {
      if (saved) {
        this.storageMessage.set(
          `Script salvo com sucesso (ID ${this.savedScriptId()}).`
        );
      }
    });
  }

  saveScriptAsync(): Promise<boolean> {
    if (!this.storageAvailable()) {
      this.storageError.set('Armazenamento indisponível. Aguarde o Oracle ficar pronto.');
      return Promise.resolve(false);
    }

    const result = this.applyGenerationResult();
    if (result.errors.length > 0) {
      this.storageError.set('Corrija os erros do formulário antes de salvar.');
      return Promise.resolve(false);
    }

    this.saving.set(true);
    this.storageError.set('');
    this.storageMessage.set('');

    const payload = {
      formData: this.form(),
      generatedSql: result.sql,
      fileName: result.fileName
    };

    const save$ = this.savedScriptId()
      ? this.scriptStorage.update(this.savedScriptId()!, payload)
      : this.scriptStorage.create(payload);

    return new Promise((resolve) => {
      save$.subscribe({
        next: (saved) => {
          this.savedScriptId.set(saved.id);
          this.saving.set(false);
          this.markFormBaseline();
          resolve(true);
        },
        error: (error: Error) => {
          this.saving.set(false);
          this.storageError.set(error.message);
          resolve(false);
        }
      });
    });
  }

  loadSavedScript(id: number): void {
    this.storageError.set('');
    this.storageMessage.set('');

    this.scriptStorage.getById(id).subscribe({
      next: (saved) => {
        const formData = { ...createEmptyFormData(), ...saved.formData };
        this.form.set(formData);
        this.generatedSql.set(saved.generatedSql);
        this.fileName.set(saved.fileName);
        this.savedScriptId.set(saved.id);

        // O rollback não é persistido; regera a partir do formulário salvo.
        if (formData.generateRollback) {
          const result = this.sqlGenerator.generate(formData);
          this.rollbackSql.set(result.rollbackSql);
          this.rollbackFileName.set(result.rollbackFileName);
        } else {
          this.rollbackSql.set('');
          this.rollbackFileName.set('');
        }

        this.validationErrors.set([]);
        this.showPreview.set(true);
        this.storageMessage.set(`Script #${saved.id} carregado para edição.`);
        this.markFormBaseline();
      },
      error: (error: Error) => {
        this.storageError.set(error.message);
      }
    });
  }

  resetForm(): void {
    this.form.set(createEmptyFormData());
    this.savedScriptId.set(null);
    this.storageMessage.set('');
    this.storageError.set('');
    this.clearOutput();
    this.clearImportFeedback();
    this.markFormBaseline();
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.clearImportFeedback();
    this.clearOutput();

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const result = this.scriptImport.import(content, file.name);

      this.importedFileName.set(file.name);

      if (!result.success) {
        this.importErrors.set(result.errors);
        return;
      }

      this.form.set(result.form);
      this.importWarnings.set(result.warnings);
      this.importSuccess.set(true);
    };
    reader.onerror = () => {
      this.importErrors.set(['Não foi possível ler o arquivo selecionado.']);
    };
    reader.readAsText(file);

    input.value = '';
  }

  triggerImport(): void {
    document.getElementById('scriptImportInput')?.click();
  }

  copyToClipboard(): void {
    const sql = this.generatedSql();
    if (!sql) {
      return;
    }

    navigator.clipboard.writeText(sql).then(() => {
      this.copied.set(true);
      clearTimeout(this.copiedTimeout);
      this.copiedTimeout = setTimeout(() => this.copied.set(false), 2000);
    });
  }

  copyRollbackToClipboard(): void {
    const sql = this.rollbackSql();
    if (!sql) {
      return;
    }

    navigator.clipboard.writeText(sql).then(() => {
      this.rollbackCopied.set(true);
      clearTimeout(this.rollbackCopiedTimeout);
      this.rollbackCopiedTimeout = setTimeout(() => this.rollbackCopied.set(false), 2000);
    });
  }

  private suggestPkConstraintName(col: AddColumnEntry, columns: AddColumnEntry[]): string {
    const pkCols = columns
      .filter((entry) => entry.constraintType === 'PK')
      .map((entry) => this.normalizeObjectName(entry.name))
      .filter(Boolean);

    if (pkCols.length <= 1) {
      const columnName = this.normalizeObjectName(col.name) || 'COLUNA';
      return `PK_${columnName}`;
    }

    return `PK_${pkCols.join('_')}`;
  }

  getSuggestedSequenceName(): string {
    const table = this.normalizeObjectName(this.form().tableName) || 'NOME_TABELA';
    const name = `SEQ_${table}`;
    return name.length <= 30 ? name : name.substring(0, 30);
  }

  getCkcConstraintName(sequence: number): string {
    const table = this.normalizeObjectName(this.form().tableName) || 'TABELA';
    return buildCkcConstraintName(table, sequence);
  }

  private nextConstraintSequence(
    columns: AddColumnEntry[],
    type: ColumnConstraintType,
    field: 'fkSequence' | 'ckcSequence'
  ): number {
    const sequences = columns
      .filter((col) => col.constraintType === type)
      .map((col) => col[field]);
    return sequences.length === 0 ? 1 : Math.max(...sequences) + 1;
  }

  private normalizeObjectName(value: string): string {
    return value.trim().toUpperCase().replace(/\s+/g, '_');
  }

  private applyGenerationResult() {
    const result = this.sqlGenerator.generate(this.form());
    this.validationErrors.set(result.errors);
    this.generatedSql.set(result.sql);
    this.fileName.set(result.fileName);
    this.rollbackSql.set(result.rollbackSql);
    this.rollbackFileName.set(result.rollbackFileName);
    this.showPreview.set(result.errors.length === 0);
    return result;
  }

  private clearOutput(): void {
    this.generatedSql.set('');
    this.fileName.set('');
    this.rollbackSql.set('');
    this.rollbackFileName.set('');
    this.validationErrors.set([]);
    this.showPreview.set(false);
  }

  private finishLeaveDialog(allow: boolean): void {
    this.showLeaveDialog.set(false);
    if (this.leaveDialogResolver) {
      this.leaveDialogResolver(allow);
      this.leaveDialogResolver = null;
    }
  }

  private markFormBaseline(): void {
    this.formBaseline.set(this.serializeForm(this.form()));
  }

  private serializeForm(data: ScriptFormData): string {
    return JSON.stringify(data);
  }

  private isFormEmpty(data: ScriptFormData): boolean {
    return this.serializeForm(data) === this.serializeForm(createEmptyFormData());
  }

  private clearImportFeedback(): void {
    this.importErrors.set([]);
    this.importWarnings.set([]);
    this.importSuccess.set(false);
    this.importedFileName.set('');
  }
}
