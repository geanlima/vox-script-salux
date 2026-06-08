import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { PreValidationResult } from '../models/validation-error.model';

@Injectable({ providedIn: 'root' })
export class OracleExecutionService {
  constructor(private readonly http: HttpClient) {}

  checkAvailability(): Observable<boolean> {
    return this.http.get<{ available: boolean }>('/api/health').pipe(
      map((response) => response.available),
      catchError(() => of(false))
    );
  }

  prevalidate(sql: string): Observable<PreValidationResult> {
    return this.http.post<PreValidationResult>('/api/prevalidate', { sql }).pipe(
      catchError(() =>
        of({
          mode: 'static' as const,
          success: false,
          message: 'Serviço Oracle indisponível. Configure a API de pré-validação.',
          statements: [],
          errors: [
            {
              linha: 0,
              descricao:
                'Conexão com Oracle não configurada. A pré-validação Oracle requer ORACLE_USER, ORACLE_PASSWORD e ORACLE_CONNECT_STRING no servidor.'
            }
          ],
          oracleAvailable: false
        })
      )
    );
  }
}
