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

Validador portado do PowerBuilder (`w_sintaxe` — Cadastros Gerais V7). Cole o script e clique em **Avaliar**.

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

O stack sobe 3 containers:

| Container | Função |
|-----------|--------|
| `vox-script-salux` | Frontend Angular (nginx) |
| `api` | Backend Node.js para pré-validação Oracle |
| `oracle` | Oracle XE dedicado **somente** à validação de sintaxe (`DBMS_SQL.PARSE`) |

### Desenvolvimento local (build)

```bash
cp .env.example .env
# Edite DOCKERHUB_USER com seu usuário do Docker Hub

docker compose up --build -d
```

Acesse: `http://localhost:8080` (porta padrão; altere `WEB_PORT` no `.env`).

### Publicar no Docker Hub

1. Crie uma conta em [hub.docker.com](https://hub.docker.com) e os repositórios (opcional — o push cria automaticamente):
   - `{seu-usuario}/vox-script-salux`
   - `{seu-usuario}/vox-script-salux-api`

2. Faça login e publique:

```bash
docker login
# Windows
./scripts/docker-publish.ps1
# Linux / macOS
chmod +x scripts/docker-publish.sh && ./scripts/docker-publish.sh

# Versão específica (recomendado em produção)
./scripts/docker-publish.ps1 -Tag 1.0.0
./scripts/docker-publish.sh 1.0.0
```

### Atualizar no servidor (pull das imagens)

No servidor, copie apenas:

- `docker-compose.prod.yml`
- `.env` (com `DOCKERHUB_USER`, senhas Oracle e `WEB_PORT`)

```bash
docker login
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Ou use o script:

```bash
chmod +x scripts/docker-update-server.sh
./scripts/docker-update-server.sh
```

Para atualizar para uma versão específica, defina no `.env`:

```env
IMAGE_TAG=1.0.0
```

**Importante:** o Oracle XE consome memória (~1 GB em execução). Em VPS com 2 GB de RAM, a primeira subida pode levar alguns minutos. Recomendado **4 GB+** de RAM para operação estável.

Credenciais padrão do Oracle de validação (altere em produção via `.env`):

- Usuário: `validator`
- Senha: `ValidatorPass1`
- Connect string interno: `oracle:1521/XEPDB1`

O Oracle de validação **não deve** ser usado para dados reais — apenas para analisar sintaxe dos scripts.

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
