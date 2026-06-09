import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import {
  SaveScriptPayload,
  SavedScript,
  SavedScriptSummary,
  StorageStatus
} from '../models/saved-script.model';
import { ScriptType } from '../models/script-types';

export interface ScriptListFilters {
  cardNumber?: string;
  scriptType?: ScriptType | '';
  q?: string;
  limit?: number;
}

@Injectable({ providedIn: 'root' })
export class ScriptStorageService {
  private readonly baseUrl = '/api/scripts';

  constructor(private readonly http: HttpClient) {}

  getStorageStatus(): Observable<StorageStatus> {
    return this.http.get<StorageStatus>(`${this.baseUrl}/storage-status`);
  }

  list(filters: ScriptListFilters = {}): Observable<SavedScriptSummary[]> {
    let params = new HttpParams();

    if (filters.cardNumber?.trim()) {
      params = params.set('cardNumber', filters.cardNumber.trim());
    }
    if (filters.scriptType) {
      params = params.set('scriptType', filters.scriptType);
    }
    if (filters.q?.trim()) {
      params = params.set('q', filters.q.trim());
    }
    if (filters.limit) {
      params = params.set('limit', String(filters.limit));
    }

    return this.http.get<SavedScriptSummary[]>(this.baseUrl, { params });
  }

  getById(id: number): Observable<SavedScript> {
    return this.http.get<SavedScript>(`${this.baseUrl}/${id}`);
  }

  create(payload: SaveScriptPayload): Observable<SavedScript> {
    return this.http.post<SavedScript>(this.baseUrl, payload);
  }

  update(id: number, payload: SaveScriptPayload): Observable<SavedScript> {
    return this.http.put<SavedScript>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  handleError(error: unknown, fallback: string): Observable<never> {
    const message =
      (error as { error?: { message?: string } })?.error?.message ??
      (error as { message?: string })?.message ??
      fallback;
    return throwError(() => new Error(message));
  }

  listSafe(filters: ScriptListFilters = {}): Observable<SavedScriptSummary[]> {
    return this.list(filters).pipe(
      catchError((error) => this.handleError(error, 'Falha ao listar scripts.'))
    );
  }
}
