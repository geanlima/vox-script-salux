import { Injectable } from '@angular/core';
import { ValidationLogError, ValidationResult } from '../models/validation-error.model';

@Injectable({ providedIn: 'root' })
export class SyntaxValidatorService {
  private errors: ValidationLogError[] = [];
  private currentText = '';

  validate(rawText: string): ValidationResult {
    this.errors = [];
    this.currentText = rawText ?? '';

    try {
      const text = this.currentText;
      if (text.trim() === '') {
        return this.buildResult(text);
      }

      if (!this.endsWithSlash(text)) {
        this.logError(0, 'O arquivo deve terminar com /');
      }

      if (this.hasBlankLineAtEnd(text)) {
        this.logError(0, 'Existe uma linha em branco no final no arquivo.');
      }

      const normalized = this.normalizeDoubleSpaces(text);
      if (normalized === null) {
        this.logError(0, 'Não foi possível normalizar espaços duplos no arquivo.');
      }

      const workingText = normalized ?? text;

      if (this.validateSlashSeparators(workingText) < 0) {
        this.logError(0, 'Quantidade excessiva de separadores / no arquivo.');
      }

      this.validateInfosaude(workingText);
      this.validateTableSeqSynGrant(workingText);
      this.validatePkFkCkc(workingText);
    } catch {
      this.logError(0, 'Erro ao processar o script. Verifique o conteúdo e tente novamente.');
    }

    const correctedText = this.correct(this.currentText);
    return this.buildResult(correctedText);
  }

  correct(text: string): string {
    if (!text.trim()) {
      return text;
    }

    let result = text.replace(/\r\n/g, '\n');

    let guard = 0;
    while (result.includes('  ') && guard < 30) {
      result = result.replace(/  /g, ' ');
      guard++;
    }

    result = this.fixSlashSeparators(result);
    result = this.fixInfosaudeInCommentOnTable(result);
    result = this.ensureTrailingSlash(result);

    return result;
  }

  private buildResult(correctedText: string): ValidationResult {
    const success = this.errors.length === 0;
    return {
      errors: [...this.errors],
      success,
      message: success
        ? 'Nenhuma inconsistência encontrada: TOP :o)'
        : 'Inconsistência encontrada: :o(',
      correctedText
    };
  }

  private logError(position: number, descricao: string, lineNumber?: number): void {
    this.errors.push({
      logErro: '1',
      linha: lineNumber ?? (position > 0 ? this.positionToLine(position, this.currentText) : 0),
      descricao
    });
  }

  private positionToLine(position: number, text: string): number {
    const before = text.substring(0, Math.max(0, position - 1));
    return before.split(/\r\n|\r|\n/).length || 1;
  }

  private endsWithSlash(text: string): boolean {
    const trimmed = text.trimEnd();
    return trimmed.endsWith('/') || trimmed.endsWith(' /');
  }

  private hasBlankLineAtEnd(text: string): boolean {
    const normalized = text.replace(/\r\n/g, '\n').trimEnd();

    if (/\n\s*\n\/$/.test(normalized)) {
      return true;
    }

    return normalized.endsWith('\n /') || normalized.endsWith(' /');
  }

  private normalizeDoubleSpaces(text: string): string | null {
    let result = text;
    let guard = 0;
    while (result.includes('  ')) {
      result = result.replace('  ', ' ');
      guard++;
      if (guard > 30) {
        return null;
      }
    }
    return result;
  }

  private validateSlashSeparators(text: string): number {
    const lines = text.split(/\r\n|\r|\n/);
    let separatorCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === '/') {
        if (i > 0 && lines[i - 1].trim() === '') {
          this.logError(0, 'Linha em branco antes do separador /', i + 1);
        }
        if (i < lines.length - 1 && lines[i + 1].trim() === '') {
          this.logError(0, 'Linha em branco após o separador /', i + 1);
        }
        separatorCount++;
        if (separatorCount > 30) {
          return -1;
        }
        continue;
      }

      if (trimmed === ' /' || trimmed === '/ ' || trimmed === ' / ') {
        this.logError(0, 'Separador / com espaço antes ou depois da barra', i + 1);
        separatorCount++;
        continue;
      }

      if (/\s\/$/.test(line)) {
        this.logError(0, 'Separador / com espaço antes da barra', i + 1);
      }

      let pos = 0;
      while ((pos = line.indexOf(' / ', pos)) !== -1) {
        separatorCount++;
        pos += 3;
        if (separatorCount > 30) {
          return -1;
        }
      }
    }

    return 1;
  }

  private validateInfosaude(text: string): void {
    const lower = text.toLowerCase();
    let position = 0;

    while (position < lower.length) {
      const index = lower.indexOf('comment on table', position);
      if (index === -1) {
        break;
      }

      const snippet = text.substring(index, index + 200);
      if (!snippet.toLowerCase().includes('infosaude')) {
        this.logError(index + 1, `Sem INFOSAUDE para ${snippet.trim()}`);
      }

      position = index + 1;
    }
  }

  private validateTableSeqSynGrant(text: string): void {
    const lower = text.toLowerCase();
    let position = 0;

    while (position < lower.length) {
      const index = lower.indexOf('create sequence', position);
      if (index === -1) {
        break;
      }

      const snippet = text.substring(index, index + 100);
      if (!snippet.toLowerCase().includes('seq_')) {
        this.logError(index + 1, 'Nome de SEQUENCE deve começar com SEQ_');
      }

      position = index + 1;
    }

    position = 0;
    while (position < lower.length) {
      const index = lower.indexOf('create table', position);
      if (index === -1) {
        break;
      }

      const tableName = this.extractTableName(text, index);
      const hasComment =
        lower.includes(`comment on table ${tableName.toLowerCase()}`) ||
        lower.includes('comment on table infosaude.');
      const hasGrant = lower.includes('grant') && lower.includes('on infosaude.');
      const hasSynonym = lower.includes('public synonym');

      if (!hasComment) {
        this.logError(index + 1, `COMMENT TABLE não localizado para ${tableName}`);
      }
      if (!hasGrant) {
        this.logError(index + 1, `GRANT não localizado para ${tableName}`);
      }
      if (!hasSynonym) {
        this.logError(index + 1, `SYNONYM não localizado para ${tableName}`);
      }

      position = index + 1;
    }
  }

  private extractTableName(text: string, createTableIndex: number): string {
    const line = text.substring(createTableIndex, createTableIndex + 200);
    const lowerLine = line.toLowerCase();
    const offset = lowerLine.indexOf('create table') + 12;
    let tableName = line.substring(offset, offset + 50).trim();

    const spaceIndex = tableName.indexOf(' ');
    if (spaceIndex > 0) {
      tableName = tableName.substring(0, spaceIndex);
    }

    const parenIndex = tableName.indexOf('(');
    if (parenIndex > 0) {
      tableName = tableName.substring(0, parenIndex);
    }

    return tableName.trim();
  }

  private validatePkFkCkc(text: string): void {
    const lower = text.toLowerCase();
    let position = 0;

    while (position < lower.length) {
      const index = lower.indexOf('primary key', position);
      if (index === -1) {
        break;
      }

      const pkIndex = lower.indexOf('pk_', index);
      if (pkIndex > -1) {
        const name = this.extractConstraintName(text, pkIndex);
        if (!name.toLowerCase().startsWith('pk_')) {
          this.logError(pkIndex + 1, ' deve iniciar com PK_');
        }
      }

      position = index + 1;
    }

    position = 0;
    while (position < lower.length) {
      const index = lower.indexOf('foreign key', position);
      if (index === -1) {
        break;
      }

      const fkIndex = lower.indexOf('fk_', index);
      if (fkIndex > -1) {
        const name = this.extractConstraintName(text, fkIndex);
        if (!name.toLowerCase().startsWith('fk_')) {
          this.logError(fkIndex + 1, ' deve iniciar com FK_');
        } else if (!/\d$/.test(name)) {
          this.logError(fkIndex + 1, ' deve terminar com sequencial numerico');
        }
      }

      position = index + 1;
    }

    position = 0;
    while (position < lower.length) {
      const index = lower.indexOf('add constraint', position);
      if (index === -1) {
        break;
      }

      const ckcIndex = lower.indexOf('ckc_', index);
      if (ckcIndex > -1) {
        const name = this.extractConstraintName(text, ckcIndex);
        if (!name.toLowerCase().startsWith('ckc_')) {
          this.logError(ckcIndex + 1, ' deve iniciar com CKC_');
        } else if (!/\d$/.test(name)) {
          this.logError(ckcIndex + 1, ' deve terminar com sequencial numerico');
        }
      }

      position = index + 1;
    }
  }

  private extractConstraintName(text: string, startIndex: number): string {
    let name = text.substring(startIndex, startIndex + 60);
    const spaceIndex = name.indexOf(' ');
    if (spaceIndex > 0) {
      name = name.substring(0, spaceIndex);
    }
    return name.trim();
  }

  private fixSlashSeparators(text: string): string {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const fixedLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === '/' || trimmed === '/ ' || trimmed === ' /' || trimmed === ' / ') {
        fixedLines.push('/');
        continue;
      }

      fixedLines.push(line.replace(/\s+\/$/, '/'));
    }

    const withoutBlankAroundSlash: string[] = [];
    for (let i = 0; i < fixedLines.length; i++) {
      const current = fixedLines[i].trim();
      const previous = withoutBlankAroundSlash[withoutBlankAroundSlash.length - 1]?.trim() ?? '';

      if (current === '' && previous === '/') {
        continue;
      }

      if (current === '/' && fixedLines[i + 1]?.trim() === '') {
        withoutBlankAroundSlash.push('/');
        while (i + 1 < fixedLines.length && fixedLines[i + 1].trim() === '') {
          i++;
        }
        continue;
      }

      if (current === '' && withoutBlankAroundSlash.length > 0 && withoutBlankAroundSlash[withoutBlankAroundSlash.length - 1].trim() === '') {
        continue;
      }

      withoutBlankAroundSlash.push(fixedLines[i]);
    }

    return withoutBlankAroundSlash.join('\n');
  }

  private fixInfosaudeInCommentOnTable(text: string): string {
    return text.replace(
      /comment\s+on\s+table\s+(?!infosaude\.)(\w+)/gi,
      (_match, tableName: string) => `COMMENT ON TABLE INFOSAUDE.${tableName.toUpperCase()}`
    );
  }

  private ensureTrailingSlash(text: string): string {
    let result = text.replace(/\r\n/g, '\n').trimEnd();
    result = result.replace(/\n\s*\n\/\s*$/g, '\n/');

    if (!result.endsWith('/')) {
      result += '\n/';
    }

    return result;
  }
}
