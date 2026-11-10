import { fileURLToPath } from 'node:url';
import type sql from 'mssql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectSqlPool } from '../../../../src/shared/sql-connection.js';
import { SqlDecisionRepository } from '../../../../src/features/record-decision/infrastructure/sql/sql-decision-repository.js';
import { applyMigrations } from '../../../../src/shared/sql-migrations.js';
import { aDeniedEvent, anEvent, recordOf } from '../../../support/builders.js';

const connectionString = process.env.SQL_TEST_CONNECTION;
const migrationsDirectory = fileURLToPath(new URL('../../../../db/migrations', import.meta.url));

describe.skipIf(!connectionString)('SqlDecisionRepository (integração, SQL_TEST_CONNECTION)', () => {
  let pool: sql.ConnectionPool;
  let repository: SqlDecisionRepository;

  beforeAll(async () => {
    pool = await connectSqlPool(connectionString!);
    await applyMigrations(pool, migrationsDirectory);
    repository = new SqlDecisionRepository(async () => pool);
  });

  afterAll(async () => {
    await pool?.close();
  });

  beforeEach(async () => {
    await pool.request().batch(`
      DELETE FROM dbo.revisao;
      DELETE FROM dbo.decisao_vizinho;
      DELETE FROM dbo.decisao;
      DELETE FROM dbo.transacao;
    `);
  });

  async function count(table: string): Promise<number> {
    const result = await pool.request().query<{ total: number }>(`SELECT COUNT(*) AS total FROM dbo.${table}`);
    return result.recordset[0]!.total;
  }

  it('reaplicar as migrations não faz nada', async () => {
    expect(await applyMigrations(pool, migrationsDirectory)).toEqual([]);
  });

  it('grava transação, decisão e os 5 vizinhos', async () => {
    expect(await repository.record(recordOf(aDeniedEvent()))).toBe('recorded');

    const row = (
      await pool.request().query(`
        SELECT t.transacao_externa_id, t.valor, t.comerciante_mcc, t.transacao_anterior_km,
               d.fraud_score, d.status, d.notificacao_status, d.marcada_incorreta, d.vetor_caracteristicas
        FROM dbo.decisao d JOIN dbo.transacao t ON t.id = d.transacao_id`)
    ).recordset[0];
    expect(row).toMatchObject({
      transacao_externa_id: 'tx-9999',
      valor: 9505.97,
      comerciante_mcc: '7802',
      transacao_anterior_km: 50,
      fraud_score: 0.8,
      status: 'NEGADO',
      notificacao_status: 'pendente',
      marcada_incorreta: false,
    });
    expect(JSON.parse(row.vetor_caracteristicas)).toHaveLength(14);

    const neighbors = (
      await pool.request().query('SELECT posicao, referencia_indice, rotulo_fraude FROM dbo.decisao_vizinho ORDER BY posicao')
    ).recordset;
    expect(neighbors.map((neighbor) => neighbor.posicao)).toEqual([1, 2, 3, 4, 5]);
    expect(neighbors.map((neighbor) => neighbor.rotulo_fraude)).toEqual([true, true, true, true, false]);
  });

  it('trata o mesmo ID de transação como duplicata sem gravar nada a mais', async () => {
    await repository.record(recordOf(anEvent()));

    expect(await repository.record(recordOf(anEvent({ eventId: 'reenvio' })))).toBe('duplicate');
    expect(await count('transacao')).toBe(1);
    expect(await count('decisao')).toBe(1);
    expect(await count('decisao_vizinho')).toBe(5);
  });

  it('resolve entregas concorrentes do mesmo evento com uma única gravação', async () => {
    const results = await Promise.all([1, 2, 3].map(() => repository.record(recordOf(aDeniedEvent()))));

    expect(results.filter((result) => result === 'recorded')).toHaveLength(1);
    expect(results.filter((result) => result === 'duplicate')).toHaveLength(2);
    expect(await count('decisao_vizinho')).toBe(5);
  });

  it('grava transação sem transação anterior', async () => {
    await repository.record(recordOf(anEvent({ transaction: { lastTransaction: null } })));

    const row = (await pool.request().query('SELECT transacao_anterior_em, transacao_anterior_km FROM dbo.transacao')).recordset[0];
    expect(row).toEqual({ transacao_anterior_em: null, transacao_anterior_km: null });
  });

  it('atualiza a notificação só a partir de pendente', async () => {
    await repository.record(recordOf(aDeniedEvent()));
    await repository.record(recordOf(anEvent()));
    const update = { status: 'enviada', channel: 'gmail', error: null, updatedAt: new Date('2026-10-05T12:00:02Z') } as const;

    expect(await repository.updateNotificationStatus('tx-9999', update)).toBe(true);
    expect(await repository.updateNotificationStatus('tx-9999', { ...update, status: 'falhou' })).toBe(false);
    expect(await repository.updateNotificationStatus('tx-0001', update)).toBe(false);

    const rows = (
      await pool.request().query(`
        SELECT t.transacao_externa_id, d.notificacao_status, d.notificacao_canal
        FROM dbo.decisao d JOIN dbo.transacao t ON t.id = d.transacao_id
        ORDER BY t.transacao_externa_id`)
    ).recordset;
    expect(rows).toEqual([
      { transacao_externa_id: 'tx-0001', notificacao_status: 'nao_aplicavel', notificacao_canal: null },
      { transacao_externa_id: 'tx-9999', notificacao_status: 'enviada', notificacao_canal: 'gmail' },
    ]);
  });

  it('impede decisão aprovada com notificação pendente', async () => {
    const approved = { ...recordOf(anEvent()), notificationStatus: 'pendente' as const };

    await expect(repository.record(approved)).rejects.toThrow(/ck_decisao_aprovada_sem_alerta/);
    expect(await count('transacao')).toBe(0);
  });

  it('permite registrar revisão de analista e marcar a decisão como incorreta', async () => {
    await repository.record(recordOf(aDeniedEvent()));

    await pool.request().batch(`
      DECLARE @analista UNIQUEIDENTIFIER = NEWID();
      INSERT INTO dbo.analista (id, nome, email) VALUES (@analista, N'Camila', N'camila@exemplo.com');
      INSERT INTO dbo.revisao (decisao_id, analista_id, decisao_incorreta, comentario)
      SELECT id, @analista, 1, N'Cliente confirmou a compra' FROM dbo.decisao;
      UPDATE dbo.decisao SET marcada_incorreta = 1;
      DELETE FROM dbo.revisao;
      DELETE FROM dbo.analista;
    `);

    expect(await count('decisao')).toBe(1);
  });
});
