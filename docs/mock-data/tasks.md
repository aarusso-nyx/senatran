# Checklist

## Condutor e Veículo — concluído

- [x] Alinhar DDL com documentos.
- [x] Definir formatos específicos.
- [x] Definir ranges.
- [x] Criar JSON Schema de Condutores.
- [x] Criar JSON Schema de Veículos.
- [x] Implementar gerador CSV.
- [x] Validar geração.

## Fase A — Agente

- [ ] Adicionar a estrutura mínima proposta de `renainf.agente` ao DDL.
- [ ] Criar `tools/data-seeder/schemas/agente.schema.json`.
- [ ] Implementar candidate e gerador determinístico.
- [ ] Implementar validação de CPF, matrícula, órgão e chave composta.
- [ ] Adicionar agente ao dispatcher CSV.
- [ ] Adicionar teste determinístico.
- [ ] Gerar `tmp/agentes.csv`.
- [ ] Executar COPY.
- [ ] Validar quantidade, estados, amostra, unicidade e órgãos com SELECT.

## Fase B — Dispositivo

- [ ] Criar `tools/data-seeder/schemas/dispositivo.schema.json`.
- [ ] Implementar candidate e gerador determinístico.
- [ ] Implementar validação de ID, órgão, booleanos e payload.
- [ ] Adicionar dispositivo ao dispatcher CSV.
- [ ] Evitar colisão com os seeds `DEV-0001` a `DEV-0015`.
- [ ] Adicionar teste determinístico.
- [ ] Gerar `tmp/dispositivos.csv`.
- [ ] Executar COPY.
- [ ] Validar quantidade, estados, IDs CSV e coerência do payload com SELECT.

## Fase C — Plantão — bloqueada

- [ ] Obter do responsável a definição mínima de plantão: o que representa para
  a aplicação consumidora e quais campos ela espera receber ou consultar.

Os itens seguintes não são executáveis enquanto a decisão acima estiver
pendente:

- [ ] Definir DDL mínimo.
- [ ] Definir schema.
- [ ] Implementar gerador.
- [ ] Implementar validação.
- [ ] Gerar CSV.
- [ ] Executar COPY.
- [ ] Validar registros.

## Fase D — Validação final

- [ ] Regenerar os CSVs implementados com a mesma seed.
- [ ] Confirmar arquivos idênticos.
- [ ] Confirmar COPY sem erro.
- [ ] Confirmar quantidade esperada.
- [ ] Confirmar constraints e referências necessárias.
