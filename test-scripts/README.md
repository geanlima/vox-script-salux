# Scripts de teste

Cole o conteúdo de cada arquivo `.sql` na tela **Validação de Sintaxe** para testar a aplicação.

## Scripts válidos (devem passar no Avaliar)

| Arquivo | O que testa |
|---------|-------------|
| `01-adicionar-coluna-ok.sql` | ALTER TABLE + COMMENT ON COLUMN |
| `02-create-table-ok.sql` | CREATE TABLE completo com SYNONYM, GRANT e COMMENT |
| `03-sequence-ok.sql` | CREATE SEQUENCE com prefixo SEQ_ |
| `04-primary-key-ok.sql` | Primary Key com nomenclatura PK_ |

## Scripts com erros (devem falhar e gerar correção)

| Arquivo | Erro esperado |
|---------|---------------|
| `05-erro-sem-barra-final.sql` | Falta `/` no final |
| `06-erro-linha-branco-separador.sql` | Linha em branco antes do `/` |
| `07-erro-sem-infosaude.sql` | Sem schema INFOSAUDE |
| `08-erro-create-table-incompleto.sql` | CREATE TABLE sem SYNONYM e GRANT |
| `09-erro-sintaxe-oracle.sql` | Aspas desbalanceadas (falha na pré-validação Oracle) |
| `10-erro-sequence-sem-prefixo.sql` | SEQUENCE sem prefixo SEQ_ |

## Fluxo sugerido

1. Abra `/validacao`
2. Cole um script e clique em **Avaliar** (regras Cadastros Gerais)
3. Clique em **Pré-validar execução** (análise comando a comando)
4. Se houver correção automática, use **Aplicar correção**
