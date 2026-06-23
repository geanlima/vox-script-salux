import { Injectable } from '@angular/core';
import { ScriptFormData } from '../models/script-form.model';
import { ScriptType } from '../models/script-types';

export interface ScriptImportSession {
  form: ScriptFormData;
  warnings: string[];
  fileName: string;
  detectedType: ScriptType;
}

@Injectable({ providedIn: 'root' })
export class ScriptImportSessionService {
  private pending: ScriptImportSession | null = null;

  setPending(session: ScriptImportSession): void {
    this.pending = session;
  }

  consumePending(): ScriptImportSession | null {
    const data = this.pending;
    this.pending = null;
    return data;
  }
}
