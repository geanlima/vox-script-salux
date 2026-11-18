import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CompareEndpoint,
  ConnectionModeHelp,
  ConnectionProfile,
  LocalTnsInfo,
  SaluxIniData,
  TestConnectionResponse
} from '../models/database-types';
import { CompareResponse } from '../models/schema-diff.model';

@Injectable({ providedIn: 'root' })
export class DatabaseCompareService {
  constructor(private readonly http: HttpClient) {}

  getProfiles(): Observable<{ profiles: ConnectionProfile[] }> {
    return this.http.get<{ profiles: ConnectionProfile[] }>('/api/compare/profiles');
  }

  getConnectionModes(): Observable<{ modes: ConnectionModeHelp[] }> {
    return this.http.get<{ modes: ConnectionModeHelp[] }>('/api/compare/connection-modes');
  }

  getLocalTns(): Observable<LocalTnsInfo> {
    return this.http.get<LocalTnsInfo>('/api/compare/local-tns');
  }

  getSaluxIniFromServer(): Observable<SaluxIniData> {
    return this.http.get<SaluxIniData>('/api/compare/ini');
  }

  parseSaluxIni(content: string): Observable<SaluxIniData> {
    return this.http.post<SaluxIniData>('/api/compare/ini/parse', { content });
  }

  registerTnsNames(content: string): Observable<{ tnsConfigId: string; aliasCount: number }> {
    return this.http.post<{ tnsConfigId: string; aliasCount: number }>('/api/compare/tns-cache', {
      content
    });
  }

  testConnection(
    endpoint: Pick<CompareEndpoint, 'profileId' | 'tnsName' | 'tnsConfigId' | 'oracleUser' | 'oraclePassword'>
  ): Observable<TestConnectionResponse> {
    return this.http.post<TestConnectionResponse>('/api/compare/test-connection', endpoint);
  }

  listSchemas(
    endpoint: Pick<CompareEndpoint, 'profileId' | 'tnsName' | 'tnsConfigId' | 'oracleUser' | 'oraclePassword'>
  ): Observable<{ schemas: string[] }> {
    return this.http.post<{ schemas: string[] }>('/api/compare/schemas', endpoint);
  }

  listTables(
    endpoint: Pick<CompareEndpoint, 'profileId' | 'tnsName' | 'tnsConfigId' | 'oracleUser' | 'oraclePassword' | 'schema'>
  ): Observable<{ tables: string[] }> {
    return this.http.post<{ tables: string[] }>('/api/compare/tables', endpoint);
  }

  compare(
    source: CompareEndpoint,
    target: CompareEndpoint,
    tnsConfigId?: string
  ): Observable<CompareResponse> {
    return this.http.post<CompareResponse>('/api/compare', {
      source,
      target,
      ...(tnsConfigId ? { tnsConfigId } : {})
    });
  }
}
