# VoxScript Salux

Aplicação web em **Angular** para geração e validação de scripts Oracle (`.sql`) conforme as boas práticas do **Cadastros Gerais** e schema **INFOSAUDE**.

Interface inspirada no portal do Azure, com layout responsivo para desktop e mobile.

## Funcionalidades

### Cadastro de Script

Formulário para montar scripts Oracle com:

- Número do card
- Tabela e campo
- Tipo e tamanho separados (ex.: `VARCHAR2` + `50`)
- Comentário do campo
- Valor padrão e opção NOT NULL
- Download automático do arquivo `.sql`
- Preview do script gerado

**Tipos de script suportados:**

| Tipo | Saída gerada |
|------|----------------|
| Adicionar Coluna | `ALTER TABLE` + `COMMENT ON COLUMN` |
| Criar Tabela | `CREATE TABLE`, `SYNONYM`, `GRANT`, `COMMENT ON` |
| Excluir Tabela | `DROP TABLE` + `DROP SYNONYM` |
| Primary Key | `PK_` + nome da coluna |
| Foreign Key | `FK_` + tabela + sequência |
| Check Constraint | `CKC_` + tabela + sequência |
| Sequence | `CREATE SEQUENCE`, `SYNONYM`, `GRANT` |
| Function / Procedure / Trigger | `CREATE OR REPLACE` |
| Cursor (NOT NULL) | Script completo com cursor para popular dados |

### Validação de Sintaxe

Validador portado do PowerBuilder (`w_sintaxe` — Cadastros Gerais V7). Cole o script e clique em **Avaliar** — uma única ação executa:

1. **Regras do Cadastros Gerais** (formatação, INFOSAUDE, nomenclatura)
2. **Análise estática por comando** (aspas, parênteses, schema)
3. **Validação Oracle** via `DBMS_SQL.PARSE` (quando o container estiver conectado)

**Regras verificadas:**

- Arquivo deve terminar com `/`
- Sem linha em branco antes/depois do separador `/`
- `COMMENT ON TABLE` deve conter `INFOSAUDE`
- `CREATE SEQUENCE` deve usar prefixo `SEQ_`
- `CREATE TABLE` deve ter `COMMENT`, `GRANT` e `PUBLIC SYNONYM`
- Constraints `PK_`, `FK_` e `CKC_` com nomenclatura correta

## Requisitos

- [Node.js](https://nodejs.org/) 18+ (recomendado 20+)
- npm 9+
- Docker + Docker Compose (para deploy)

## Deploy com Docker (frontend + API + SQLite)

### Fluxo

```
[PC Windows]  build + push     [Docker Hub]     pull + up     [VPS Locaweb]
     │              ──────────────────►              ───────────────►
    │         geansilvalima/vox-script-salux*                       http://179.188.193.186
```

O perfil de produção para VPS pequena sobe 2 containers e mantém os dados de autenticação/scripts em um volume SQLite persistente:

| Container | Função |
|-----------|--------|
| `vox-script-salux` | Frontend Angular (nginx) |
| `api` | Backend Node.js — login e armazenamento SQLite; Oracle opcional para pré-validação |
| volume `vox-script-salux-data` | Banco SQLite persistente (usuários e scripts salvos) |

O Oracle XE não é iniciado no servidor de 1 GB, pois causa `ORA-27104` e reinicialização. Sem uma conexão Oracle externa configurada, a pré-validação Oracle fica indisponível; a validação estática da aplicação continua funcionando.

### Ambiente de produção (GSLServer)

| Item | Valor |
|------|-------|
| Docker Hub | `geansilvalima` |
| Imagens | `geansilvalima/vox-script-salux` · `geansilvalima/vox-script-salux-api` |
| Servidor | Locaweb — `vps73705.publiccloud.com.br` |
| IP / SSH | `root@179.188.193.186` |
| URL | http://179.188.193.186 |
| Pasta no servidor | `/opt/vox-script-salux` |

### Onde executar cada comando

| Ação | Onde rodar |
|------|------------|
| `docker compose up --build` | **PC Windows** (pasta do projeto) |
| `.\scripts\docker-publish.ps1` | **PC Windows** |
| `ssh root@179.188.193.186` | **PC Windows** → abre sessão no servidor |
| `docker compose -f docker-compose.prod.yml ...` | **Dentro do SSH** (servidor) |
| `scp arquivo root@179.188.193.186:...` | **PC Windows** (terminal **fora** do SSH) |

> **Atenção:** não rode `scp` dentro da sessão SSH. Lá você já está no servidor — os arquivos `.yml` e `.env` ficam no seu PC (`C:\Projetos\GSL\vox-script-salux`), não no servidor remoto.

---

### 1. Desenvolvimento local (PC)

```powershell
cd C:\Projetos\GSL\vox-script-salux
copy .env.example .env
docker compose up --build -d
```

| Ambiente | URL |
|----------|-----|
| Docker local | http://localhost:8080 |
| `ng serve` | http://localhost:4200 (API em `:3000` via proxy) |

---

### 2. Publicar imagens no Docker Hub (PC)

As imagens atuais já estão publicadas em `geansilvalima`. Para publicar uma nova versão após mudanças no código, confirme que `DOCKERHUB_USER=geansilvalima` está no `.env` e execute:

```powershell
cd C:\Projetos\GSL\vox-script-salux
docker login
.\scripts\docker-publish.ps1
```

Com versão fixa (recomendado):

```powershell
.\scripts\docker-publish.ps1 -Tag 1.0.0
```

---

### 3. Preparar o servidor (primeira vez)

#### 3.1 Conectar e instalar Docker

No **PC**:

```powershell
ssh root@179.188.193.186
```

Na primeira conexão, confira no painel Locaweb se o fingerprint SSH exibido corresponde ao apresentado no terminal; só então aceite a chave. Não desative a verificação de chave do SSH.

No **servidor**:

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker
mkdir -p /opt/vox-script-salux
```

#### 3.2 Copiar arquivos de deploy para o servidor

Escolha **uma** opção:

**Opção A — Git (recomendado se o repositório estiver no GitHub/GitLab)**

No **servidor**:

```bash
cd /opt/vox-script-salux
git clone <url-do-repositorio> .    # só na 1ª vez, se a pasta estiver vazia
git pull
cp deploy/server.env.example .env
nano .env                           # altere as senhas Oracle
```

**Opção B — `scp` a partir do PC**

Abra um **novo** PowerShell no Windows (sem estar no SSH):

```powershell
cd C:\Projetos\GSL\vox-script-salux
scp docker-compose.prod.yml root@179.188.193.186:/opt/vox-script-salux/
scp deploy/server.env.example root@179.188.193.186:/opt/vox-script-salux/.env
```

Depois, conecte ao servidor e ajuste `/opt/vox-script-salux/.env`. Defina `DOCKERHUB_USER=geansilvalima`, `WEB_PORT=80` e troque `MASTER_PASSWORD` e `AUTH_SECRET` por valores fortes e exclusivos. Não configure `ORACLE_CONNECT_STRING=oracle:1521/XEPDB1`: o Compose de produção não inicia Oracle local. Configure Oracle somente se houver uma instância externa.

Se `scp` não for reconhecido, instale **OpenSSH Client** em *Configurações → Aplicativos → Recursos opcionais*, ou use a Opção A (Git).

---

### 4. Subir no servidor

No **servidor**:

```bash
cd /opt/vox-script-salux
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

As imagens são públicas; `docker login` no servidor não é necessário, a menos que os repositórios se tornem privados. Confirme `DOCKERHUB_USER=geansilvalima` no `.env` e remova as antigas linhas de Oracle local (`ORACLE_CONNECTION_MODE=connect_string` e `ORACLE_CONNECT_STRING=oracle:1521/XEPDB1`). Configure Oracle apenas se houver uma instância externa.

A primeira subida baixa apenas frontend e API; os dados ficam no volume SQLite `vox-script-salux-data`.

Verificar:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
```

Acesse: **http://179.188.193.186**

---

### 5. Atualizar após mudanças no código

| Etapa | Onde | Comando |
|-------|------|---------|
| 1. Publicar nova imagem | PC | `.\scripts\docker-publish.ps1` |
| 2. Baixar e reiniciar | Servidor | `docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d` |

Versão específica — altere no `.env` do servidor:

```env
IMAGE_TAG=1.0.0
```

---

### Solução de problemas

| Problema | Causa | Solução |
|----------|-------|---------|
| `scp: No such file or directory` | Comando rodado **dentro** do SSH | Use Opção B no servidor ou `scp` em terminal **local** no PC |
| `scp` não reconhecido no Windows | OpenSSH não instalado | Opção A (git) ou Opção B (`cat`) |
| Porta 80 em uso | Outro serviço na VPS | Defina `WEB_PORT=8080` no `.env` e acesse `:8080` |
| Oracle não disponível | O perfil de produção de 1 GB não executa Oracle XE | Login/CRUD usam SQLite; para pré-validação Oracle, configure uma instância Oracle externa |
| Imagens não encontradas | Push não feito | Rode `.\scripts\docker-publish.ps1` no PC antes do `pull` |
 | `denied` ao publicar imagens | Usuário do Docker Hub sem permissão no namespace | Confirme `docker login` com a conta `geansilvalima` e `DOCKERHUB_USER=geansilvalima` no `.env` |
 | Imagens não encontradas | Namespace/tag divergente ou push não concluído | Confira `DOCKERHUB_USER` e `IMAGE_TAG` no `.env` local e do servidor; publique antes do `pull` |

### Observações

- O perfil de 1 GB usa SQLite para usuários e scripts salvos. O volume Docker `vox-script-salux-data` precisa ser preservado em atualizações.
- Oracle é opcional e deve ser uma instância externa para validar sintaxe/consultar metadados; o contêiner Oracle XE não faz parte do Compose de produção leve.
- Senhas SQLite/administrador devem ser definidas em `MASTER_PASSWORD` e `AUTH_SECRET` no `.env` de produção.
- Objetos inexistentes (tabelas, sequences) **não** geram erro; apenas falhas reais de sintaxe.

### Arquivos de deploy

| Arquivo | Descrição |
|---------|-----------|
| `docker-compose.yml` | Build local + push |
| `docker-compose.prod.yml` | Servidor — frontend + API/SQLite, pull sem build |
| `.env.example` | Variáveis para desenvolvimento local |
| `deploy/server.env.example` | Modelo de `.env` para o servidor |
| `deploy/setup-server.sh` | Copia `server.env.example` → `.env` no servidor |
| `scripts/docker-publish.ps1` | Build + push (Windows) |
| `scripts/docker-update-server.sh` | Pull + restart no servidor |


## Instalação

```bash
git clone <url-do-repositorio>
cd VoxScriptSalux
npm install
```

## Executar em desenvolvimento

```bash
npm start
```

Acesse: [http://localhost:4200](http://localhost:4200)

| Rota | Descrição |
|------|-----------|
| `/` | Cadastro de Script |
| `/validacao` | Validação de Sintaxe |

## Build de produção

```bash
npm run build
```

Artefatos gerados em `dist/vox-script-salux/browser/`.

Para servir localmente após o build:

```bash
npx serve dist/vox-script-salux/browser
```

## Estrutura do projeto

```
src/
├── app/
│   ├── components/
│   │   ├── azure-layout/       # Layout principal (header + sidebar)
│   │   ├── script-form/        # Tela de cadastro e geração
│   │   └── syntax-validation/  # Tela de validação
│   ├── models/                 # Tipos e interfaces
│   ├── services/
│   │   ├── sql-generator.service.ts    # Geração de .sql
│   │   └── syntax-validator.service.ts # Validação de sintaxe
│   ├── app.routes.ts
│   └── app.config.ts
└── styles.scss                 # Tema global (estilo Azure)
```

## Boas práticas aplicadas na geração

1. Scripts criados/alterados no **SQL Developer**
2. Sem comentários SQL (`--`) no script (exceto `COMMENT ON`)
3. Separador `/` entre comandos, sem espaços ou linhas em branco antes/depois
4. `/` obrigatório no final do script
5. Schema **INFOSAUDE** em todas as instruções
6. Ponto e vírgula (`;`) apenas dentro de blocos PL/SQL
7. Nomes de objetos com no máximo **30 caracteres**

## Exemplo de saída (Adicionar Coluna)

```sql
ALTER TABLE INFOSAUDE.FIA ADD IN_VIRTUAL CHAR(1)
/
COMMENT ON COLUMN INFOSAUDE.FIA.IN_VIRTUAL IS 'Flag que indica se a fia é de um RN ou não.'
/
```

Arquivo gerado: `CARD_{numero}_{tipo}_{campo}.sql`

## Scripts npm

| Comando | Descrição |
|---------|-----------|
| `npm start` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run watch` | Build com watch mode |
| `npm test` | Testes unitários (Karma/Jasmine) |

## Tecnologias

- Angular 19 (standalone components)
- TypeScript 5.7
- SCSS
- Angular Router + Forms

## Licença

Uso interno — Salux / Cadastros Gerais.
