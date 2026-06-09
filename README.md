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
| Primary Key | `PK_` + nome da tabela |
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
- Docker + Docker Compose (para deploy com pré-validação Oracle)

## Deploy com Docker (frontend + API + Oracle de validação)

### Fluxo

```
[PC Windows]  build + push     [Docker Hub]     pull + up     [GSLServer]
     │              ──────────────────►              ───────────────►
     │         geandasilvalima/vox-script-salux*                    http://191.252.181.56
```

O stack sobe 3 containers:

| Container | Função |
|-----------|--------|
| `vox-script-salux` | Frontend Angular (nginx) |
| `api` | Backend Node.js — validação Oracle |
| `oracle` | Oracle XE — apenas `DBMS_SQL.PARSE` (sintaxe) |

### Ambiente de produção (GSLServer)

| Item | Valor |
|------|-------|
| Docker Hub | `geandasilvalima` |
| Imagens | `geandasilvalima/vox-script-salux` · `geandasilvalima/vox-script-salux-api` |
| Servidor | GSLServer (Locaweb) — `vps66927.publiccloud.com.br` |
| IP / SSH | `root@191.252.181.56` |
| URL | http://191.252.181.56 |
| Pasta no servidor | `/opt/vox-script-salux` |

### Onde executar cada comando

| Ação | Onde rodar |
|------|------------|
| `docker compose up --build` | **PC Windows** (pasta do projeto) |
| `.\scripts\docker-publish.ps1` | **PC Windows** |
| `ssh root@191.252.181.56` | **PC Windows** → abre sessão no servidor |
| `docker compose -f docker-compose.prod.yml ...` | **Dentro do SSH** (servidor) |
| `scp arquivo root@191...` | **PC Windows** (terminal **fora** do SSH) |

> **Atenção:** não rode `scp` dentro da sessão SSH. Lá você já está no servidor — os arquivos `.yml` e `.env` ficam no seu PC (`C:\Projetos\GSL\vox-script-salux`), não em `root@vps66927`.

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

Antes do primeiro deploy no servidor, publique as imagens:

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
ssh root@191.252.181.56
```

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

**Opção B — Criar arquivos direto no servidor**

No **servidor** (`ssh root@191.252.181.56`), cole o bloco abaixo inteiro:

```bash
cd /opt/vox-script-salux

cat > docker-compose.prod.yml << 'EOF'
services:
  vox-script-salux:
    image: ${DOCKERHUB_USER}/vox-script-salux:${IMAGE_TAG:-latest}
    ports:
      - "${WEB_PORT:-80}:80"
    depends_on:
      api:
        condition: service_started
    restart: unless-stopped

  api:
    image: ${DOCKERHUB_USER}/vox-script-salux-api:${IMAGE_TAG:-latest}
    environment:
      ORACLE_USER: ${ORACLE_USER:-validator}
      ORACLE_PASSWORD: ${ORACLE_PASSWORD:-ValidatorPass1}
      ORACLE_CONNECT_STRING: ${ORACLE_CONNECT_STRING:-oracle:1521/XEPDB1}
    depends_on:
      oracle:
        condition: service_healthy
    restart: unless-stopped

  oracle:
    image: gvenzl/oracle-xe:21-slim-faststart
    environment:
      ORACLE_PASSWORD: ${ORACLE_ADMIN_PASSWORD:-ValidatorAdmin1}
      APP_USER: ${ORACLE_USER:-validator}
      APP_USER_PASSWORD: ${ORACLE_PASSWORD:-ValidatorPass1}
    volumes:
      - oracle-validator-data:/opt/oracle/oradata
    expose:
      - "1521"
    healthcheck:
      test: ["CMD", "healthcheck.sh"]
      interval: 15s
      timeout: 10s
      retries: 20
      start_period: 90s
    shm_size: "1gb"
    restart: unless-stopped

volumes:
  oracle-validator-data:
EOF

cat > .env << 'EOF'
DOCKERHUB_USER=geandasilvalima
IMAGE_TAG=latest
WEB_PORT=80
ORACLE_USER=validator
ORACLE_PASSWORD=AltereEstaSenha1
ORACLE_ADMIN_PASSWORD=AltereEstaSenhaAdmin1
ORACLE_CONNECT_STRING=oracle:1521/XEPDB1
EOF

nano .env
```

**Opção C — `scp` a partir do PC**

Abra um **novo** PowerShell no Windows (sem estar no SSH):

```powershell
cd C:\Projetos\GSL\vox-script-salux
scp docker-compose.prod.yml root@191.252.181.56:/opt/vox-script-salux/
scp deploy/server.env.example root@191.252.181.56:/opt/vox-script-salux/.env
```

Se `scp` não for reconhecido, instale **OpenSSH Client** em *Configurações → Aplicativos → Recursos opcionais*, ou use a **Opção A** ou **B**.

---

### 4. Subir no servidor

No **servidor**:

```bash
cd /opt/vox-script-salux
docker login
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Aguarde **3–5 minutos** na primeira subida (download + init do Oracle).

Verificar:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
```

Acesse: **http://191.252.181.56**

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
| Container Oracle reinicia | VPS com 2 GB RAM | Crie swap ou faça upgrade de RAM na Locaweb |
| Imagens não encontradas | Push não feito | Rode `.\scripts\docker-publish.ps1` no PC antes do `pull` |

### Observações

- O Oracle XE usa ~1 GB de RAM. O GSLServer tem **2 GB** — monitore com `docker stats`.
- Altere as senhas Oracle no `.env` do servidor antes de produção.
- O banco de validação **não** armazena dados reais — só analisa sintaxe.
- Objetos inexistentes (tabelas, sequences) **não** geram erro; apenas falhas reais de sintaxe.

### Arquivos de deploy

| Arquivo | Descrição |
|---------|-----------|
| `docker-compose.yml` | Build local + push |
| `docker-compose.prod.yml` | Servidor — pull sem build |
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
