# Senatran Data Seeder

Documentação operacional do gerador determinístico de CSVs sintéticos. O fluxo
de trabalho é:

```text
investigação
→ decisões
→ generation-spec
→ tasks
→ implementação
→ CSV
→ COPY
→ validação
```

A ferramenta é exclusiva de desenvolvimento e testes e recusa execução com
`NODE_ENV=production`.

## Escopo

| Entidade | Estado |
| --- | --- |
| Condutor | implementado |
| Veículo | implementado |
| Agente | especificado para próxima implementação |
| Dispositivo | especificado para próxima implementação |
| Plantão | bloqueado por definição |

## Execução

```bash
pnpm data:generate --schema tools/data-seeder/schemas/condutor.schema.json --rows 100 --output tmp/condutores.csv --seed 20250101
pnpm data:generate --schema tools/data-seeder/schemas/veiculo.schema.json --rows 100 --output tmp/veiculos.csv --seed 20250101
```

Após a implementação da próxima etapa, agente e dispositivo serão gerados com:

```bash
pnpm data:generate \
  --schema tools/data-seeder/schemas/agente.schema.json \
  --rows 100 \
  --output tmp/agentes.csv \
  --seed 20250101
```

```bash
pnpm data:generate \
  --schema tools/data-seeder/schemas/dispositivo.schema.json \
  --rows 100 \
  --output tmp/dispositivos.csv \
  --seed 20250101
```

A geração de plantões será adicionada após a definição mínima da entidade.

`--schema`, `--rows` e `--output` são obrigatórios. `--seed` é opcional e usa
`20250101` por padrão. O diretório de saída é criado automaticamente.

## Schemas

- `tools/data-seeder/schemas/condutor.schema.json`
- `tools/data-seeder/schemas/veiculo.schema.json`

Os schemas de agente e dispositivo ainda serão criados; não há schema de plantão
enquanto sua definição estiver pendente.

Os schemas definem ordem das colunas, obrigatoriedade, formatos, unicidade,
defaults e ranges usados na geração e validação. A coluna `id` não entra no CSV:
o PostgreSQL a gera por `bigserial`. O `payload` é serializado como JSON válido
em uma célula CSV escapada.
