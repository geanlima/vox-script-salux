import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SCRIPT_TYPE_OPTIONS } from '../../models/script-types';
import { SavedScriptSummary } from '../../models/saved-script.model';
import { ScriptStorageService } from '../../services/script-storage.service';

@Component({
  selector: 'app-script-library',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './script-library.component.html',
  styleUrl: './script-library.component.scss'
})
export class ScriptLibraryComponent implements OnInit {
  readonly scriptTypes = SCRIPT_TYPE_OPTIONS;

  scripts = signal<SavedScriptSummary[]>([]);
  loading = signal(true);
  storageAvailable = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  filterCard = signal('');
  filterType = signal('');
  filterQuery = signal('');

  constructor(
    private readonly storage: ScriptStorageService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.storage.getStorageStatus().subscribe({
      next: (status) => {
        this.storageAvailable.set(status.available);
        if (status.available) {
          this.loadScripts();
        } else {
          this.loading.set(false);
          this.errorMessage.set(
            status.configured
              ? 'Banco de dados indisponível no momento.'
              : 'Armazenamento indisponível. O Oracle do servidor ainda não está pronto.'
          );
        }
      },
      error: () => {
        this.loading.set(false);
        this.storageAvailable.set(false);
        this.errorMessage.set('Não foi possível verificar o armazenamento.');
      }
    });
  }

  loadScripts(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.storage
      .list({
        cardNumber: this.filterCard(),
        scriptType: this.filterType() as '' | undefined,
        q: this.filterQuery()
      })
      .subscribe({
        next: (items) => {
          this.scripts.set(items);
          this.loading.set(false);
        },
        error: (error: Error) => {
          this.loading.set(false);
          this.errorMessage.set(error.message);
        }
      });
  }

  clearFilters(): void {
    this.filterCard.set('');
    this.filterType.set('');
    this.filterQuery.set('');
    this.loadScripts();
  }

  editScript(id: number): void {
    this.router.navigate(['/'], { queryParams: { id } });
  }

  deleteScript(item: SavedScriptSummary): void {
    const confirmed = confirm(`Excluir o script "${item.fileName}" (ID ${item.id})?`);
    if (!confirmed) {
      return;
    }

    this.storage.delete(item.id).subscribe({
      next: () => {
        this.successMessage.set(`Script ${item.fileName} excluído.`);
        this.loadScripts();
      },
      error: (error: Error) => {
        this.errorMessage.set(error.message);
      }
    });
  }

  scriptTypeLabel(value: string): string {
    return this.scriptTypes.find((type) => type.value === value)?.label ?? value;
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString('pt-BR');
  }
}
