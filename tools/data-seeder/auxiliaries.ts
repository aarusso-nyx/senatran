import type { Queryable } from './database-types.js';
import { createGenerationStream } from './deterministic.js';
import type { CondutorCandidate, VeiculoCandidate } from './generators.js';
import { buildCompletePayload, validateOpenApiPayload } from './openapi.js';
import type { ConflictMode } from './cli.js';

export interface AuxiliaryRow {
  table: string;
  columns: string[];
  values: unknown[];
}

const assertPayload = (component: string, payload: Record<string, unknown>) => {
  const errors = validateOpenApiPayload(component, payload);
  if (errors.length)
    throw new Error(`Invalid ${component} auxiliary payload: ${errors[0]}`);
  return payload;
};

export const condutorAuxiliaries = (
  candidates: readonly CondutorCandidate[],
  seed: number,
): AuxiliaryRow[] => {
  const rows: AuxiliaryRow[] = [];
  candidates.forEach((candidate, index) => {
    if (index % 2 === 0) {
      const stream = createGenerationStream(seed, `condutor_imagem:${index}`);
      const security = String(stream.rng.int(100_000_000, 999_999_999));
      const payload = assertPayload(
        'CondutorImagem',
        buildCompletePayload('CondutorImagem', stream, {
          mapeamentoAutomatico: true,
          nomeCondutor: candidate.nome,
          nomeMae: candidate.nomeMae,
          numeroRegistro: candidate.numeroRegistro,
          numeroFormularioCnh: candidate.numeroRegistro,
          numeroFormularioRenach: candidate.numeroFormularioRenach,
          numeroSeguranca: security,
          dataNascimento: `${candidate.dataNascimento}T00:00:00.000Z`,
        }),
      );
      rows.push({
        table: 'senatran.condutor_imagem',
        columns: ['cpf', 'numero_registro', 'numero_seguranca', 'payload'],
        values: [candidate.cpf, candidate.numeroRegistro, security, payload],
      });
    }
    if (index % 3 === 0) {
      const stream = createGenerationStream(
        seed,
        `condutor_infracao_item:${index}`,
      );
      const payload = assertPayload(
        'CondutorInfracaoExtratoItem',
        buildCompletePayload('CondutorInfracaoExtratoItem', stream, {
          mapeamentoAutomatico: true,
          quantidadeInfracao: 1,
        }),
      );
      rows.push({
        table: 'senatran.condutor_infracao_item',
        columns: ['numero_registro_cnh', 'payload'],
        values: [candidate.numeroRegistro, payload],
      });
    }
  });
  return rows;
};

export const veiculoAuxiliaries = (
  candidates: readonly VeiculoCandidate[],
  seed: number,
): AuxiliaryRow[] => {
  const rows: AuxiliaryRow[] = [];
  candidates.forEach((candidate, index) => {
    const cpfValue =
      candidate.tipoProprietario === '1' ? candidate.idProprietario : null;
    const cnpjValue =
      candidate.tipoProprietario === '2' ? candidate.idProprietario : null;
    if (index % 3 !== 2) {
      const stream = createGenerationStream(seed, `csv_seguranca:${index}`);
      const security = String(stream.rng.int(100_000_000, 999_999_999));
      const payload = assertPayload(
        'CodigoSegurancaCrv',
        buildCompletePayload('CodigoSegurancaCrv', stream, {
          mapeamentoAutomatico: true,
          numeroSegurancaCrv: Number(security),
          placa: candidate.placa,
          chassi: candidate.chassi,
          codigoRenavam: candidate.codigoRenavam,
          codigoTipoProprietario: candidate.tipoProprietario,
          descricaoTipoProprietario:
            candidate.tipoProprietario === '1'
              ? 'PESSOA FISICA'
              : 'PESSOA JURIDICA',
          numeroIdentificacaoProprietario: candidate.idProprietario,
        }),
      );
      rows.push({
        table: 'senatran.csv_seguranca',
        columns: [
          'codigo_seguranca_crv',
          'cpf',
          'cnpj',
          'renavam',
          'placa',
          'payload',
        ],
        values: [
          security,
          cpfValue,
          cnpjValue,
          candidate.codigoRenavam,
          candidate.placa,
          payload,
        ],
      });
    }
    if (index % 3 === 0) {
      const stream = createGenerationStream(seed, `comunicacao_venda:${index}`);
      const payload = assertPayload(
        'ComunicacaoVenda',
        buildCompletePayload('ComunicacaoVenda', stream, {
          mapeamentoAutomatico: true,
          placa: candidate.placa,
          renavam: candidate.codigoRenavam,
          numeroIdentificacaoProprietario: candidate.idProprietario,
        }),
      );
      rows.push({
        table: 'senatran.comunicacao_venda',
        columns: ['cpf', 'cnpj', 'renavam', 'placa', 'payload'],
        values: [
          cpfValue,
          cnpjValue,
          candidate.codigoRenavam,
          candidate.placa,
          payload,
        ],
      });
    }
    if (index % 4 === 0) {
      const stream = createGenerationStream(
        seed,
        `endereco_possuidor:${index}`,
      );
      const payload = assertPayload(
        'EnderecoPossuidor',
        buildCompletePayload('EnderecoPossuidor', stream, {
          mapeamentoAutomatico: true,
          numeroDocumentoPossuidor: candidate.idProprietario,
        }),
      );
      rows.push({
        table: 'senatran.endereco_possuidor',
        columns: ['placa', 'renavam', 'payload'],
        values: [candidate.placa, candidate.codigoRenavam, payload],
      });
    }
    if (index % 5 === 0) {
      const stream = createGenerationStream(
        seed,
        `multa_interestadual:${index}`,
      );
      const multa = buildCompletePayload('MultaInterestadual', stream, {
        placa: candidate.placa,
        renavam: candidate.codigoRenavam,
        numeroIdentificacaoProprietario: candidate.idProprietario,
      });
      const payload = assertPayload(
        'MultaInterestadualResponse',
        buildCompletePayload('MultaInterestadualResponse', stream, {
          quantidade: 1,
          quantidadeReal: 1,
          multas: [multa],
        }),
      );
      rows.push({
        table: 'senatran.multa_interestadual',
        columns: ['cpf', 'cnpj', 'renavam', 'placa', 'payload'],
        values: [
          cpfValue,
          cnpjValue,
          candidate.codigoRenavam,
          candidate.placa,
          payload,
        ],
      });
    }
    if (index % 6 === 0) {
      const stream = createGenerationStream(seed, `recall:${index}`);
      const recall = buildCompletePayload('Recall', stream, {
        chassi: candidate.chassi,
      });
      const payload = assertPayload(
        'RecallResponse',
        buildCompletePayload('RecallResponse', stream, {
          quantidade: 1,
          quantidadeReal: 1,
          recalls: [recall],
        }),
      );
      rows.push({
        table: 'senatran.recall',
        columns: ['chassi', 'payload'],
        values: [candidate.chassi, payload],
      });
    }
  });
  return rows;
};

export const insertAuxiliaries = async (
  db: Queryable,
  rows: readonly AuxiliaryRow[],
  conflictMode: ConflictMode,
  batchSize: number,
): Promise<number> => {
  let inserted = 0;
  const groups = new Map<string, AuxiliaryRow[]>();
  for (const row of rows) {
    const key = `${row.table}|${row.columns.join(',')}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    const template = group[0];
    for (let start = 0; start < group.length; start += batchSize) {
      const values: unknown[] = [];
      const tuples = group.slice(start, start + batchSize).map((row) => {
        const placeholders = row.values.map((value) => {
          values.push(value);
          return `$${values.length}`;
        });
        return `(${placeholders.join(', ')})`;
      });
      const result = await db.query(
        `insert into ${template.table} (${template.columns.join(', ')}) values ${tuples.join(', ')}${conflictMode === 'skip' ? ' on conflict do nothing' : ''} returning 1`,
        values,
      );
      inserted += result.rowCount ?? 0;
    }
  }
  return inserted;
};
