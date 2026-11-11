import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CompareEndpoint,
  ConnectionModeHelp,
  ConnectionProfile,
  ConnectionSource,
  ConnectionTestState,
  LocalTnsInfo,
  SaluxIniConnection,
  SaluxIniData
} from '../../models/database-types';
import {
  CompareResponse,
  SchemaCompareResponse,
  TableCompareResponse
} from '../../models/schema-diff.model';
import { DatabaseCompareService } from '../../services/database-compare.service';
import { parseSaluxIniContent } from '../../utils/salux-ini-parser.util';
import { isTnsInList, parseTnsNamesContent } from '../../utils/tnsnames-parser.util';

@Component({
  selector: 'app-database-compare',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './database-compare.component.html',
  styleUrl: './database-compare.component.scss'
})
export class DatabaseCompareComponent implements OnInit {
  profiles = signal<ConnectionProfile[]>([]);
  connectionModes = signal<ConnectionModeHelp[]>([]);
  showConnectionHelp = signal(false);
  connectionSource = signal<ConnectionSource>('local_tns');

  saluxIni = signal<SaluxIniData | null>(null);
  localTns = signal<LocalTnsInfo | null>(null);
  iniFileName = signal('');
  tnsFileName = signal('');
  tnsAliases = signal<string[]>([]);
  tnsConfigId = signal('');

  sourceTnsName = signal('');
  targetTnsName = signal('');

  sourceDbUser = signal('');
  sourceDbPassword = signal('');
  targetDbUser = signal('');
  targetDbPassword = signal('');

  sourceProfileId = signal('');
  targetProfileId = signal('');
  sourceSchema = signal('');
  targetSchema = signal('');
  sourceTable = signal('');
  targetTable = signal('');
  compareMode = signal<'schema' | 'table'>('schema');

  sourceTestState = signal<ConnectionTestState>('idle');
  targetTestState = signal<ConnectionTestState>('idle');
  sourceTestMessage = signal('');
  targetTestMessage = signal('');

  sourceSchemas = signal<string[]>([]);
  targetSchemas = signal<string[]>([]);
  sourceTables = signal<string[]>([]);
  targetTables = signal<string[]>([]);

  loading = signal(false);
  loadingSchemas = signal(false);
  loadingTables = signal(false);
  errorMessage = signal('');
  compareResult = signal<CompareResponse | null>(null);

  iniConnections = computed(() => this.saluxIni()?.connections ?? []);

  availableConnections = computed(() => {
    const iniNames = this.iniConnections().map((item) => item.serverName);
    const tnsList = this.tnsAliases();

    if (iniNames.length && tnsList.length) {
      const tnsUpper = new Set(tnsList.map((alias) => alias.toUpperCase()));
      return iniNames.filter((name) => tnsUpper.has(name.toUpperCase()));
    }

    if (iniNames.length) {
      return iniNames;
    }

    return tnsList;
  });

  missingInTnsNames = computed(() => {
    const iniNames = this.iniConnections().map((item) => item.serverName);
    const tnsList = this.tnsAliases();

    if (!iniNames.length || !tnsList.length) {
      return [];
    }

    const tnsUpper = new Set(tnsList.map((alias) => alias.toUpperCase()));
    return iniNames.filter((name) => !tnsUpper.has(name.toUpperCase()));
  });

  sameConnectionSelected = computed(() => {
    if (this.connectionSource() === 'profile') {
      const source = this.sourceProfileId();
      const target = this.targetProfileId();
      return Boolean(source && target && source === target);
    }

    const source = this.sourceTnsName().trim().toUpperCase();
    const target = this.targetTnsName().trim().toUpperCase();
    return Boolean(source && target && source === target);
  });

  usesTnsAlias = computed(() => {
    const source = this.connectionSource();
    return source === 'salux_ini' || source === 'local_tns';
  });

  canCompare = computed(
    () =>
      this.sourceTestState() === 'success' &&
      this.targetTestState() === 'success' &&
      !this.sameConnectionSelected()
  );

  sourceProfile = computed(() =>
    this.profiles().find((profile) => profile.id === this.sourceProfileId()) ?? null
  );
  targetProfile = computed(() =>
    this.profiles().find((profile) => profile.id === this.targetProfileId()) ?? null
  );

  constructor(private readonly compareService: DatabaseCompareService) {}

  ngOnInit(): void {
    this.compareService.getLocalTns().subscribe({
      next: (info) => this.localTns.set(info)
    });

    this.compareService.getConnectionModes().subscribe({
      next: (response) => this.connectionModes.set(response.modes)
    });

    this.compareService.getProfiles().subscribe({
      next: (response) => {
        this.profiles.set(response.profiles);
        const first = response.profiles[0];
        if (first) {
          this.sourceProfileId.set(first.id);
          this.targetProfileId.set(response.profiles[1]?.id ?? first.id);
        }
      }
    });
  }

  onConnectionSourceChange(): void {
    this.resetConnectionSelection();
  }

  onIniFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseSaluxIniContent(String(reader.result ?? ''));
      this.saluxIni.set({
        available: true,
        connections: parsed.connections,
        activeServerName: parsed.activeServerName,
        dirExe: parsed.dirExe
      });
      this.iniFileName.set(file.name);
      this.connectionSource.set('salux_ini');
      this.applyConnectionDefaults();
    };
    reader.readAsText(file, 'utf-8');
    input.value = '';
  }

  onTnsFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      this.tnsAliases.set(parseTnsNamesContent(content));
      this.tnsFileName.set(file.name);
      this.tnsConfigId.set('');
      this.compareService.registerTnsNames(content).subscribe({
        next: (response) => {
          this.tnsConfigId.set(response.tnsConfigId);
          if (response.aliasCount !== undefined) {
            this.tnsAliases.set(parseTnsNamesContent(content));
          }
          this.applyConnectionDefaults();
        },
        error: (error) => {
          this.errorMessage.set(error?.error?.message ?? 'Falha ao registrar tnsnames.ora.');
          this.tnsAliases.set([]);
          this.tnsFileName.set('');
        }
      });
    };
    reader.readAsText(file, 'utf-8');
    input.value = '';
  }

  onSourceTnsChange(): void {
    this.invalidateSourceConnection();
  }

  onSourceCredentialsChange(): void {
    this.invalidateSourceConnection();
  }

  onTargetTnsChange(): void {
    this.invalidateTargetConnection();
  }

  onTargetCredentialsChange(): void {
    this.invalidateTargetConnection();
  }

  onSourceProfileChange(): void {
    this.invalidateSourceConnection();
  }

  onTargetProfileChange(): void {
    this.invalidateTargetConnection();
  }

  onSourceSchemaChange(): void {
    this.sourceTable.set('');
    this.sourceTables.set([]);
    this.loadTables('source');
  }

  onTargetSchemaChange(): void {
    this.targetTable.set('');
    this.targetTables.set([]);
    this.loadTables('target');
  }

  onModeChange(): void {
    this.sourceTable.set('');
    this.targetTable.set('');
    this.compareResult.set(null);
  }

  testConnection(side: 'source' | 'target'): void {
    const ref = this.connectionRef(side);
    if (!ref.profileId && !ref.tnsName) {
      this.errorMessage.set('Selecione uma conexão antes de testar.');
      return;
    }

    if (this.usesTnsAlias()) {
      const tns = side === 'source' ? this.sourceTnsName().trim() : this.targetTnsName().trim();
      if (!tns) {
        this.errorMessage.set('Informe o alias TNS antes de testar.');
        return;
      }

      if (this.connectionSource() === 'salux_ini') {
        if (this.tnsAliases().length && !this.isTnsValid(tns)) {
          this.errorMessage.set(`"${tns}" não foi encontrado no tnsnames.ora carregado.`);
          return;
        }
        if (!this.tnsConfigId()) {
          this.errorMessage.set('Carregue o arquivo tnsnames.ora antes de testar a conexão.');
          return;
        }
      }

      if (this.connectionSource() === 'local_tns') {
        const local = this.localTns();
        if (!local?.available) {
          this.errorMessage.set(
            local?.message ??
              'tnsnames.ora local não encontrado. Configure ORACLE_TNS_ADMIN na máquina onde a API está rodando.'
          );
          return;
        }
        if (local.aliases.length && !this.isTnsValid(tns)) {
          this.errorMessage.set(`"${tns}" não foi encontrado no tnsnames.ora local (${local.configDir}).`);
          return;
        }
      }

      const oracleUser = side === 'source' ? this.sourceDbUser().trim() : this.targetDbUser().trim();
      const oraclePassword = side === 'source' ? this.sourceDbPassword() : this.targetDbPassword();
      if (!oracleUser || !oraclePassword) {
        this.errorMessage.set(
          side === 'source'
            ? 'Informe usuário e senha do banco na origem.'
            : 'Informe usuário e senha do banco no destino.'
        );
        return;
      }
    }

    this.errorMessage.set('');

    if (side === 'source') {
      this.sourceTestState.set('testing');
      this.sourceTestMessage.set('');
    } else {
      this.targetTestState.set('testing');
      this.targetTestMessage.set('');
    }

    this.compareService.testConnection(ref).subscribe({
      next: (response) => {
        if (side === 'source') {
          this.sourceTestState.set('success');
          this.sourceTestMessage.set(response.message);
          this.loadSchemas('source');
        } else {
          this.targetTestState.set('success');
          this.targetTestMessage.set(response.message);
          this.loadSchemas('target');
        }
      },
      error: (error) => {
        const message = error?.error?.message ?? 'Falha ao testar conexão.';
        if (side === 'source') {
          this.sourceTestState.set('error');
          this.sourceTestMessage.set(message);
          this.sourceSchemas.set([]);
        } else {
          this.targetTestState.set('error');
          this.targetTestMessage.set(message);
          this.targetSchemas.set([]);
        }
      }
    });
  }

  compare(): void {
    if (!this.canCompare()) {
      if (this.sameConnectionSelected()) {
        this.errorMessage.set(
          'Origem e destino estão com a mesma conexão. Selecione bases diferentes para comparar.'
        );
      } else {
        this.errorMessage.set('Teste a conexão de origem e destino antes de comparar.');
      }
      return;
    }

    const source = this.buildEndpoint('source');
    const target = this.buildEndpoint('target');

    if (!source || !target) {
      return;
    }

    if (this.compareMode() === 'table') {
      source.table = this.sourceTable().trim();
      target.table = this.targetTable().trim() || source.table;
    }

    if (!source.schema || !target.schema) {
      this.errorMessage.set('Informe o schema de origem e destino.');
      return;
    }

    if (this.compareMode() === 'table' && !source.table) {
      this.errorMessage.set('Informe o nome da tabela para comparar.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.compareResult.set(null);

    this.compareService
      .compare(
        source,
        target,
        this.connectionSource() === 'salux_ini' ? this.tnsConfigId() || undefined : undefined
      )
      .subscribe({
      next: (result) => {
        this.compareResult.set(result);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error?.error?.message ?? 'Falha ao comparar estruturas.');
        this.loading.set(false);
      }
    });
  }

  clear(): void {
    this.sourceTable.set('');
    this.targetTable.set('');
    this.compareResult.set(null);
    this.errorMessage.set('');
  }

  isTableResult(result: CompareResponse): result is TableCompareResponse {
    return result.mode === 'table';
  }

  isSchemaResult(result: CompareResponse): result is SchemaCompareResponse {
    return result.mode === 'schema';
  }

  toggleConnectionHelp(): void {
    this.showConnectionHelp.update((value) => !value);
  }

  optionLabel(name: string): string {
    const iniEntry = this.iniConnections().find(
      (item) => item.serverName.toUpperCase() === name.toUpperCase()
    );
    if (iniEntry?.active) {
      return `${name} (ativo no INI)`;
    }
    return name;
  }

  isTnsValid(tnsName: string): boolean {
    const aliases =
      this.connectionSource() === 'local_tns'
        ? (this.localTns()?.aliases ?? [])
        : this.tnsAliases();
    return isTnsInList(tnsName, aliases);
  }

  resolveTnsDisplay(side: 'source' | 'target'): string {
    return side === 'source' ? this.sourceTnsName() : this.targetTnsName();
  }

  sameConnectionLabel(): string {
    if (this.connectionSource() === 'profile') {
      const profile = this.sourceProfile();
      return profile?.label ?? 'mesma conexão';
    }
    return this.sourceTnsName();
  }

  isConnectionTested(side: 'source' | 'target'): boolean {
    return side === 'source'
      ? this.sourceTestState() === 'success'
      : this.targetTestState() === 'success';
  }

  private applyConnectionDefaults(): void {
    const options = this.availableConnections();
    if (!options.length) {
      this.sourceTnsName.set('');
      this.targetTnsName.set('');
      return;
    }

    const active =
      this.iniConnections().find(
        (item) => item.active && options.some((n) => n.toUpperCase() === item.serverName.toUpperCase())
      )?.serverName ??
      this.iniConnections().find((item) =>
        options.some((n) => n.toUpperCase() === item.serverName.toUpperCase())
      )?.serverName ??
      options[0];

    const second =
      options.find((name) => name.toUpperCase() !== active.toUpperCase()) ?? options[0];

    if (!this.sourceTnsName() || !options.some((n) => n.toUpperCase() === this.sourceTnsName().toUpperCase())) {
      this.sourceTnsName.set(active);
    }
    if (!this.targetTnsName() || !options.some((n) => n.toUpperCase() === this.targetTnsName().toUpperCase())) {
      this.targetTnsName.set(second);
    }

    if (this.sourceTnsName().toUpperCase() === this.targetTnsName().toUpperCase() && options.length > 1) {
      this.targetTnsName.set(
        options.find((name) => name.toUpperCase() !== this.sourceTnsName().toUpperCase()) ?? second
      );
    }

    this.invalidateSourceConnection();
    this.invalidateTargetConnection();
  }

  private resetConnectionSelection(): void {
    this.sourceSchema.set('');
    this.targetSchema.set('');
    this.sourceTable.set('');
    this.targetTable.set('');
    this.sourceDbUser.set('');
    this.sourceDbPassword.set('');
    this.targetDbUser.set('');
    this.targetDbPassword.set('');
    this.sourceSchemas.set([]);
    this.targetSchemas.set([]);
    this.sourceTables.set([]);
    this.targetTables.set([]);
    this.compareResult.set(null);
    this.sourceTestState.set('idle');
    this.targetTestState.set('idle');
    this.sourceTestMessage.set('');
    this.targetTestMessage.set('');
  }

  private invalidateSourceConnection(): void {
    this.sourceSchema.set('');
    this.sourceTable.set('');
    this.sourceSchemas.set([]);
    this.sourceTables.set([]);
    this.sourceTestState.set('idle');
    this.sourceTestMessage.set('');
    this.compareResult.set(null);
  }

  private invalidateTargetConnection(): void {
    this.targetSchema.set('');
    this.targetTable.set('');
    this.targetSchemas.set([]);
    this.targetTables.set([]);
    this.targetTestState.set('idle');
    this.targetTestMessage.set('');
    this.compareResult.set(null);
  }

  private connectionRef(
    side: 'source' | 'target'
  ): Pick<CompareEndpoint, 'profileId' | 'tnsName' | 'tnsConfigId' | 'oracleUser' | 'oraclePassword'> {
    const tnsConfigId = this.connectionSource() === 'salux_ini' ? this.tnsConfigId() || undefined : undefined;

    if (this.usesTnsAlias()) {
      const tnsName = side === 'source' ? this.sourceTnsName() : this.targetTnsName();
      const oracleUser = side === 'source' ? this.sourceDbUser().trim() : this.targetDbUser().trim();
      const oraclePassword = side === 'source' ? this.sourceDbPassword() : this.targetDbPassword();
      return tnsName.trim()
        ? { tnsName: tnsName.trim(), tnsConfigId, oracleUser, oraclePassword }
        : {};
    }

    const profileId = side === 'source' ? this.sourceProfileId() : this.targetProfileId();
    return profileId ? { profileId } : {};
  }

  private buildEndpoint(side: 'source' | 'target'): CompareEndpoint | null {
    const schema = (side === 'source' ? this.sourceSchema() : this.targetSchema()).trim();
    const ref = this.connectionRef(side);

    if (this.usesTnsAlias()) {
      if (!ref.tnsName) {
        this.errorMessage.set('Informe o alias TNS de origem e destino.');
        return null;
      }
      return { ...ref, schema };
    }

    if (!ref.profileId) {
      this.errorMessage.set('Selecione o perfil de conexão de origem e destino.');
      return null;
    }
    return { ...ref, schema };
  }

  private loadSchemas(side: 'source' | 'target'): void {
    const ref = this.connectionRef(side);
    if (!ref.profileId && !ref.tnsName) {
      return;
    }

    this.loadingSchemas.set(true);
    this.compareService.listSchemas(ref).subscribe({
      next: (response) => {
        if (side === 'source') {
          this.sourceSchemas.set(response.schemas);
        } else {
          this.targetSchemas.set(response.schemas);
        }
        this.loadingSchemas.set(false);
      },
      error: (error) => {
        this.loadingSchemas.set(false);
        const message = error?.error?.message ?? 'Falha ao listar schemas.';
        if (side === 'source') {
          this.sourceTestState.set('error');
          this.sourceTestMessage.set(message);
        } else {
          this.targetTestState.set('error');
          this.targetTestMessage.set(message);
        }
      }
    });
  }

  private loadTables(side: 'source' | 'target'): void {
    const schema = side === 'source' ? this.sourceSchema() : this.targetSchema();
    const ref = this.connectionRef(side);

    if ((!ref.profileId && !ref.tnsName) || !schema) {
      return;
    }

    this.loadingTables.set(true);
    this.compareService.listTables({ ...ref, schema }).subscribe({
      next: (response) => {
        if (side === 'source') {
          this.sourceTables.set(response.tables);
        } else {
          this.targetTables.set(response.tables);
        }
        this.loadingTables.set(false);
      },
      error: () => {
        this.loadingTables.set(false);
      }
    });
  }
}
