import { ScriptFormData } from './script-form.model';
import { ScriptType } from './script-types';

export interface SavedScriptSummary {
  id: number;
  cardNumber: string;
  scriptType: ScriptType;
  tableName: string | null;
  fileName: string;
  createdAt: string;
  updatedAt: string;
  userId: number | null;
  ownerName: string | null;
}

export interface SavedScript extends SavedScriptSummary {
  formData: ScriptFormData;
  generatedSql: string;
}

export interface SaveScriptPayload {
  formData: ScriptFormData;
  generatedSql: string;
  fileName: string;
}

export interface StorageStatus {
  configured: boolean;
  available: boolean;
}
