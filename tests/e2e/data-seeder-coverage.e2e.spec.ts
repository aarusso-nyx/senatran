import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PgDatabase } from '../../domain/shared/api/src/database/database.js';
import { loadConfig } from '../../domain/shared/api/src/config/configuration.js';
import { AUTH, createE2eApp, type TestApp } from '../utils/e2e-app.js';

let app: TestApp;
let db: PgDatabase;

beforeAll(async () => {
  db = new PgDatabase(loadConfig().database);
  app = await createE2eApp();
});

afterAll(async () => {
  await app.close();
  await db.close();
});

const get = (path: string) => request(app.server).get(path).set(AUTH);
const encoded = (value: unknown) => encodeURIComponent(String(value));

describe('data seeder controller coverage', () => {
  it('exercises all 12 Condutores endpoints with generated keys', async () => {
    const rows = await db.query<Record<string, string>>(
      `select c.*, i.numero_seguranca
         from senatran.condutor c
         join senatran.condutor_imagem i using (cpf, numero_registro)
        limit 1`,
    );
    const driver = rows.rows[0];
    const impediment = (
      await db.query<{ value: string }>(
        `select numero_lista_impedimento as value from senatran.condutor where numero_lista_impedimento is not null limit 1`,
      )
    ).rows[0].value;
    const pgu = (
      await db.query<{ value: string }>(
        `select numero_pgu as value from senatran.condutor where numero_pgu is not null limit 1`,
      )
    ).rows[0].value;
    const pid = (
      await db.query<{ value: string }>(
        `select numero_formulario_pid as value from senatran.condutor where numero_formulario_pid is not null limit 1`,
      )
    ).rows[0].value;
    const infractionRegistration = (
      await db.query<{ value: string }>(
        `select numero_registro_cnh as value from senatran.condutor_infracao_item limit 1`,
      )
    ).rows[0].value;
    expect(driver).toBeDefined();
    const paths = [
      `/v1/condutores/cpf/${driver.cpf}`,
      `/v1/condutores/cpf/${driver.cpf}/registroCnh/${driver.numero_registro}`,
      `/v1/condutores/formularioRenach/${driver.numero_formulario_renach}`,
      `/v1/condutores/imagens/cpf/${driver.cpf}/registroCnh/${driver.numero_registro}/segurancaCnh/${driver.numero_seguranca}`,
      `/v1/condutores/impedimento/${impediment}`,
      `/v1/condutores/infracoes/registroCnh/${infractionRegistration}`,
      `/v1/condutores/nomeCondutor/${encoded(driver.nome)}/dataNascimento/${encoded(driver.data_nascimento)}/nomeMae/${encoded(driver.nome_mae)}`,
      `/v1/condutores/pgu/${pgu}`,
      `/v1/condutores/pid/${pid}`,
      `/v1/condutores/registroCnh/${driver.numero_registro}`,
      `/v1/condutores/retrato/cpf/${driver.cpf}/registroCnh/${driver.numero_registro}/segurancaCnh/${driver.numero_seguranca}`,
      `/v1/condutores/validacao/cpf/${driver.cpf}/registroCnh/${driver.numero_registro}/segurancaCnh/${driver.numero_seguranca}`,
    ];
    for (const path of paths) expect((await get(path)).status, path).toBe(200);
  });

  it('exercises all 20 Veiculos endpoints with generated keys', async () => {
    const pf = (await db.query<Record<string, string>>(
      `select * from senatran.veiculo where tipo_proprietario = '1' and numero_motor is not null and numero_cambio is not null limit 1`,
    )).rows[0];
    const pj = (await db.query<Record<string, string>>(
      `select * from senatran.veiculo where tipo_proprietario = '2' limit 1`,
    )).rows[0];
    const csvPf = (await db.query<Record<string, string>>(`select * from senatran.csv_seguranca where cpf is not null limit 1`)).rows[0];
    const csvPj = (await db.query<Record<string, string>>(`select * from senatran.csv_seguranca where cnpj is not null limit 1`)).rows[0];
    const communicationPf = (await db.query<Record<string, string>>(`select * from senatran.comunicacao_venda where cpf is not null limit 1`)).rows[0];
    const communicationPj = (await db.query<Record<string, string>>(`select * from senatran.comunicacao_venda where cnpj is not null limit 1`)).rows[0];
    const finePf = (await db.query<Record<string, string>>(`select * from senatran.multa_interestadual where cpf is not null limit 1`)).rows[0];
    const finePj = (await db.query<Record<string, string>>(`select * from senatran.multa_interestadual where cnpj is not null limit 1`)).rows[0];
    const address = (await db.query<Record<string, string>>(`select * from senatran.endereco_possuidor limit 1`)).rows[0];
    const recall = (await db.query<Record<string, string>>(`select * from senatran.recall limit 1`)).rows[0];
    for (const value of [pf, pj, csvPf, csvPj, communicationPf, communicationPj, finePf, finePj, address, recall]) expect(value).toBeDefined();
    const paths = [
      `/v1/veiculos/placa/${pf.placa}`,
      `/v1/veiculos/chassi/${pf.chassi}`,
      `/v1/veiculos/renavam/${pf.codigo_renavam}`,
      `/v1/veiculos/motor/${pf.numero_motor}`,
      `/v1/veiculos/cambio/${pf.numero_cambio}`,
      `/v1/veiculos/proprietario/cpf/${pf.id_proprietario}`,
      `/v1/veiculos/proprietario/cnpj/${pj.id_proprietario}`,
      `/v1/veiculos/proprietario/cpf/${pf.id_proprietario}/chassi/${pf.chassi}/renavam/${pf.codigo_renavam}`,
      `/v1/veiculos/proprietario/cpf/${pf.id_proprietario}/placa/${pf.placa}/renavam/${pf.codigo_renavam}`,
      `/v1/veiculos/proprietario/cnpj/${pj.id_proprietario}/chassi/${pj.chassi}/renavam/${pj.codigo_renavam}`,
      `/v1/veiculos/proprietario/cnpj/${pj.id_proprietario}/placa/${pj.placa}/renavam/${pj.codigo_renavam}`,
      `/v1/veiculos/codigoSegurancaCrv/${csvPf.codigo_seguranca_crv}/cpf/${csvPf.cpf}/renavam/${csvPf.renavam}/placa/${csvPf.placa}`,
      `/v1/veiculos/codigoSegurancaCrv/${csvPj.codigo_seguranca_crv}/cnpj/${csvPj.cnpj}/renavam/${csvPj.renavam}/placa/${csvPj.placa}`,
      `/v1/veiculos/comunicacaoVenda/cpf/${communicationPf.cpf}/renavam/${communicationPf.renavam}/placa/${communicationPf.placa}`,
      `/v1/veiculos/comunicacaoVenda/cnpj/${communicationPj.cnpj}/renavam/${communicationPj.renavam}/placa/${communicationPj.placa}`,
      `/v1/veiculos/multaInterestadual/cpf/${finePf.cpf}/renavam/${finePf.renavam}/placa/${finePf.placa}`,
      `/v1/veiculos/multaInterestadual/cnpj/${finePj.cnpj}/renavam/${finePj.renavam}/placa/${finePj.placa}`,
      `/v1/veiculos/enderecoPossuidor/placa/${address.placa}`,
      `/v1/veiculos/enderecoPossuidor/placa/${address.placa}/renavam/${address.renavam}`,
      `/v1/veiculos/recall/chassi/${recall.chassi}`,
    ];
    for (const path of paths) expect((await get(path)).status, path).toBe(200);
  });

  it('rejects mismatched owner type/document and CRV document', async () => {
    const pf = (await db.query<Record<string, string>>(`select * from senatran.veiculo where tipo_proprietario = '1' limit 1`)).rows[0];
    const csv = (await db.query<Record<string, string>>(`select * from senatran.csv_seguranca where cpf is not null limit 1`)).rows[0];
    expect((await get(`/v1/veiculos/proprietario/cnpj/${pf.id_proprietario}`)).status).toBe(404);
    expect((await get(`/v1/veiculos/codigoSegurancaCrv/${csv.codigo_seguranca_crv}/cpf/00000000000/renavam/${csv.renavam}/placa/${csv.placa}`)).status).toBe(404);
  });

  it('paginates a repeated owner at 100 rows and returns an empty page after the cursor', async () => {
    const owner = (await db.query<{ id_proprietario: string; total: number }>(
      `select id_proprietario, count(*)::int as total
         from senatran.veiculo
        where tipo_proprietario = '1'
        group by id_proprietario
       having count(*) > 100
        limit 1`,
    )).rows[0];
    expect(owner.total).toBeGreaterThan(100);
    const first = await get(`/v1/veiculos/proprietario/cpf/${owner.id_proprietario}`);
    expect(first.body.quantidadeVeiculo).toBe(100);
    expect(first.body.quantidadeVeiculoReal).toBe(owner.total);
    const second = await get(`/v1/veiculos/proprietario/cpf/${owner.id_proprietario}?idUltimoRegistro=${first.body.idUltimoRegistro}`);
    expect(second.body.idUltimoRegistro).toBeGreaterThan(first.body.idUltimoRegistro);
    const empty = await get(`/v1/veiculos/proprietario/cpf/${owner.id_proprietario}?idUltimoRegistro=${second.body.idUltimoRegistro}`);
    expect(empty.body.quantidadeVeiculo).toBe(0);
    expect(empty.body.quantidadeVeiculoReal).toBe(owner.total);
  });
});
