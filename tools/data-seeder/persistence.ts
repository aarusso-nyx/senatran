import type { Queryable } from './database-types.js';
import type { CondutorCandidate, VeiculoCandidate } from './generators.js';
import type { ConflictMode, SupportedTable } from './cli.js';

const CONDUTOR_COLUMNS = [
  'cpf',
  'numero_registro',
  'numero_formulario_renach',
  'numero_lista_impedimento',
  'numero_pgu',
  'numero_formulario_pid',
  'nome',
  'data_nascimento',
  'nome_mae',
  'payload',
] as const;
const VEICULO_COLUMNS = [
  'chassi',
  'placa',
  'codigo_renavam',
  'numero_motor',
  'numero_cambio',
  'id_proprietario',
  'tipo_proprietario',
  'ind_alarme',
  'ind_roubo_furto',
  'ind_transferencia',
  'ind_licenciamento',
  'ind_circulacao',
  'ind_penhora',
  'ind_media_monta',
  'ind_grande_monta',
  'ind_recuperado',
  'payload',
] as const;

const condutorValues = (item: CondutorCandidate): unknown[] => [
  item.cpf,
  item.numeroRegistro,
  item.numeroFormularioRenach,
  item.numeroListaImpedimento ?? null,
  item.numeroPgu ?? null,
  item.numeroFormularioPid ?? null,
  item.nome,
  item.dataNascimento,
  item.nomeMae,
  item.payload,
];
const veiculoValues = (item: VeiculoCandidate): unknown[] => [
  item.chassi,
  item.placa,
  item.codigoRenavam,
  item.numeroMotor ?? null,
  item.numeroCambio ?? null,
  item.idProprietario,
  item.tipoProprietario,
  item.indicators.alarme,
  item.indicators.rouboFurto,
  item.indicators.transferencia,
  item.indicators.licenciamento,
  item.indicators.circulacao,
  item.indicators.penhora,
  item.indicators.mediaMonta,
  item.indicators.grandeMonta,
  item.indicators.recuperado,
  item.payload,
];

export interface PersistResult {
  inserted: number;
  skipped: number;
  batches: number;
}

export const persistCandidates = async (
  db: Queryable,
  table: SupportedTable,
  candidates: readonly (CondutorCandidate | VeiculoCandidate)[],
  batchSize: number,
  conflictMode: ConflictMode,
  interrupted: () => boolean,
): Promise<PersistResult> => {
  const columns = table.endsWith('condutor')
    ? CONDUTOR_COLUMNS
    : VEICULO_COLUMNS;
  const valuesOf = table.endsWith('condutor')
    ? (item: CondutorCandidate | VeiculoCandidate) =>
        condutorValues(item as CondutorCandidate)
    : (item: CondutorCandidate | VeiculoCandidate) =>
        veiculoValues(item as VeiculoCandidate);
  let inserted = 0;
  let batches = 0;
  for (let start = 0; start < candidates.length; start += batchSize) {
    if (interrupted()) throw new Error('Data seeding interrupted');
    const batch = candidates.slice(start, start + batchSize);
    const values: unknown[] = [];
    const tuples = batch.map((candidate) => {
      const row = valuesOf(candidate);
      const placeholders = row.map((value) => {
        values.push(value);
        return `$${values.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    const result = await db.query(
      `insert into ${table} (${columns.join(', ')}) values ${tuples.join(', ')}${conflictMode === 'skip' ? ' on conflict do nothing' : ''} returning 1`,
      values,
    );
    inserted += result.rowCount ?? 0;
    batches += 1;
  }
  return { inserted, skipped: candidates.length - inserted, batches };
};

export const assertNoReservedScenarioKeys = async (
  db: Queryable,
  candidates: readonly (CondutorCandidate | VeiculoCandidate)[],
): Promise<void> => {
  const values = candidates
    .flatMap((candidate) =>
      'cpf' in candidate
        ? [
            candidate.cpf,
            candidate.numeroRegistro,
            candidate.numeroFormularioRenach,
            candidate.numeroListaImpedimento,
            candidate.numeroPgu,
            candidate.numeroFormularioPid,
          ]
        : [
            candidate.chassi,
            candidate.placa,
            candidate.codigoRenavam,
            candidate.numeroMotor,
            candidate.numeroCambio,
            candidate.idProprietario,
          ],
    )
    .filter((value): value is string => value !== undefined);
  const result = await db.query<{ key_value: string }>(
    'select key_value from mock.scenario_key where key_value = any($1::text[]) limit 1',
    [values],
  );
  if (result.rows[0])
    throw new Error(
      `Candidate collides with reserved scenario key ${result.rows[0].key_value}`,
    );
};

export const countDatabaseCollisions = async (
  db: Queryable,
  table: SupportedTable,
  candidates: readonly (CondutorCandidate | VeiculoCandidate)[],
): Promise<number> => {
  if (table === 'senatran.condutor') {
    const items = candidates as readonly CondutorCandidate[];
    const result = await db.query<{ count: number }>(
      `select count(*)::int as count from senatran.condutor
        where cpf = any($1::text[])
           or numero_registro = any($2::text[])
           or numero_formulario_renach = any($3::text[])
           or numero_lista_impedimento = any($4::text[])
           or numero_pgu = any($5::text[])
           or numero_formulario_pid = any($6::text[])`,
      [
        items.map((item) => item.cpf),
        items.map((item) => item.numeroRegistro),
        items.map((item) => item.numeroFormularioRenach),
        items.flatMap((item) => item.numeroListaImpedimento ?? []),
        items.flatMap((item) => item.numeroPgu ?? []),
        items.flatMap((item) => item.numeroFormularioPid ?? []),
      ],
    );
    return Number(result.rows[0]?.count ?? 0);
  }
  const items = candidates as readonly VeiculoCandidate[];
  const result = await db.query<{ count: number }>(
    `select count(*)::int as count from senatran.veiculo
      where chassi = any($1::text[])
         or placa = any($2::text[])
         or codigo_renavam = any($3::text[])
         or numero_motor = any($4::text[])
         or numero_cambio = any($5::text[])`,
    [
      items.map((item) => item.chassi),
      items.map((item) => item.placa),
      items.map((item) => item.codigoRenavam),
      items.flatMap((item) => item.numeroMotor ?? []),
      items.flatMap((item) => item.numeroCambio ?? []),
    ],
  );
  return Number(result.rows[0]?.count ?? 0);
};

export const filterDatabaseConflicts = async (
  db: Queryable,
  table: SupportedTable,
  candidates: readonly (CondutorCandidate | VeiculoCandidate)[],
): Promise<(CondutorCandidate | VeiculoCandidate)[]> => {
  if (table === 'senatran.condutor') {
    const items = candidates as readonly CondutorCandidate[];
    const result = await db.query<{
      cpf: string;
      numero_registro: string | null;
      numero_formulario_renach: string | null;
      numero_lista_impedimento: string | null;
      numero_pgu: string | null;
      numero_formulario_pid: string | null;
    }>(
      `select cpf, numero_registro, numero_formulario_renach,
              numero_lista_impedimento, numero_pgu, numero_formulario_pid
         from senatran.condutor
        where cpf = any($1::text[])
           or numero_registro = any($2::text[])
           or numero_formulario_renach = any($3::text[])
           or numero_lista_impedimento = any($4::text[])
           or numero_pgu = any($5::text[])
           or numero_formulario_pid = any($6::text[])`,
      [
        items.map((item) => item.cpf),
        items.map((item) => item.numeroRegistro),
        items.map((item) => item.numeroFormularioRenach),
        items.flatMap((item) => item.numeroListaImpedimento ?? []),
        items.flatMap((item) => item.numeroPgu ?? []),
        items.flatMap((item) => item.numeroFormularioPid ?? []),
      ],
    );
    const occupied = new Set(
      result.rows.flatMap((row) =>
        Object.values(row).filter((value): value is string => value !== null),
      ),
    );
    return candidates.filter((candidate) => {
      const item = candidate as CondutorCandidate;
      return ![
        item.cpf,
        item.numeroRegistro,
        item.numeroFormularioRenach,
        item.numeroListaImpedimento,
        item.numeroPgu,
        item.numeroFormularioPid,
      ].some((value) => value !== undefined && occupied.has(value));
    });
  }
  const items = candidates as readonly VeiculoCandidate[];
  const result = await db.query<{
    chassi: string;
    placa: string;
    codigo_renavam: string;
    numero_motor: string | null;
    numero_cambio: string | null;
  }>(
    `select chassi, placa, codigo_renavam, numero_motor, numero_cambio
       from senatran.veiculo
      where chassi = any($1::text[])
         or placa = any($2::text[])
         or codigo_renavam = any($3::text[])
         or numero_motor = any($4::text[])
         or numero_cambio = any($5::text[])`,
    [
      items.map((item) => item.chassi),
      items.map((item) => item.placa),
      items.map((item) => item.codigoRenavam),
      items.flatMap((item) => item.numeroMotor ?? []),
      items.flatMap((item) => item.numeroCambio ?? []),
    ],
  );
  const occupied = new Set(
    result.rows.flatMap((row) =>
      Object.values(row).filter((value): value is string => value !== null),
    ),
  );
  return candidates.filter((candidate) => {
    const item = candidate as VeiculoCandidate;
    return ![
      item.chassi,
      item.placa,
      item.codigoRenavam,
      item.numeroMotor,
      item.numeroCambio,
    ].some((value) => value !== undefined && occupied.has(value));
  });
};
