import { fileURLToPath } from 'node:url';
import type sql from 'mssql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SqlReviewCreator } from '../../../src/features/create-review/infrastructure/sql-review-creator.js';
import { SqlDecisionTotalsReader } from '../../../src/features/decision-metrics/infrastructure/sql-decision-totals-reader.js';
import { SqlReviewRemover } from '../../../src/features/delete-review/infrastructure/sql-review-remover.js';
import { SqlDecisionFinder } from '../../../src/features/get-decision/infrastructure/sql-decision-finder.js';
import { SqlDecisionSearch } from '../../../src/features/list-decisions/infrastructure/sql-decision-search.js';
import { SqlReviewReader } from '../../../src/features/list-reviews/infrastructure/sql-review-reader.js';
import { SqlDecisionRepository } from '../../../src/features/record-decision/infrastructure/sql/sql-decision-repository.js';
import { SqlReviewUpdater } from '../../../src/features/update-review/infrastructure/sql-review-updater.js';
import { connectSqlPool } from '../../../src/shared/sql-connection.js';
import { applyMigrations } from '../../../src/shared/sql-migrations.js';
import { aDeniedEvent, anEvent, recordOf } from '../../support/builders.js';

const connectionString = process.env.SQL_TEST_CONNECTION;
const migrationsDirectory = fileURLToPath(new URL('../../../db/migrations', import.meta.url));
const analyst = { name: 'Eduardo Martins', email: 'eduardo.martins@example.com' };

describe.skipIf(!connectionString)('leitura e revisões no SQL (integração, SQL_TEST_CONNECTION)', () => {
  let pool: sql.ConnectionPool;
  const provider = async () => pool;

  beforeAll(async () => {
    pool = await connectSqlPool(connectionString!);
    await applyMigrations(pool, migrationsDirectory);
  });

  afterAll(async () => {
    await pool?.close();
  });

  beforeEach(async () => {
    await pool.request().batch(`
      DELETE FROM dbo.revisao;
      DELETE FROM dbo.analista;
      DELETE FROM dbo.decisao_vizinho;
      DELETE FROM dbo.decisao;
      DELETE FROM dbo.transacao;
    `);
    const repository = new SqlDecisionRepository(provider);
    await repository.record(recordOf(anEvent()));
    await repository.record(recordOf(aDeniedEvent()));
  });

  async function decisionId(transactionId: string): Promise<string> {
    const { items } = await new SqlDecisionSearch(provider).search({}, 0, 20);
    return items.find((item) => item.transactionId === transactionId)!.id;
  }

  it('lista, filtra, detalha e agrega as decisões', async () => {
    const search = new SqlDecisionSearch(provider);

    expect((await search.search({}, 0, 20)).total).toBe(2);
    expect((await search.search({ status: 'NEGADO' }, 0, 20)).items.map((item) => item.transactionId)).toEqual(['tx-9999']);
    expect((await search.search({ minScore: 0.5 }, 0, 20)).total).toBe(1);
    expect((await search.search({}, 1, 1)).items).toHaveLength(1);

    const detail = await new SqlDecisionFinder(provider).findById(await decisionId('tx-9999'));
    expect(detail).toMatchObject({ transactionId: 'tx-9999', status: 'NEGADO', fraudScore: 0.8 });
    expect(detail?.neighbors).toHaveLength(5);
    expect(detail?.featureVector).toHaveLength(14);

    expect(await new SqlDecisionTotalsReader(provider).read()).toMatchObject({ total: 2, approved: 1, denied: 1, markedIncorrect: 0 });
  });

  it('cria, altera e remove revisões mantendo marcada_incorreta na mesma transação', async () => {
    const id = await decisionId('tx-9999');
    const creator = new SqlReviewCreator(provider);
    const finder = new SqlDecisionFinder(provider);

    const first = await creator.create(id, { analyst, incorrect: true, comment: 'primeira' });
    expect(first).toMatchObject({ decisionId: id, incorrect: true, comment: 'primeira', updatedAt: null });
    expect((await finder.findById(id))?.markedIncorrect).toBe(true);

    const second = await creator.create(id, { analyst: { ...analyst, name: 'Eduardo M.' }, incorrect: false, comment: null });
    expect((await finder.findById(id))?.markedIncorrect).toBe(false);
    expect((await pool.request().query('SELECT COUNT(*) AS total FROM dbo.analista')).recordset[0]!.total).toBe(1);

    const listed = await new SqlReviewReader(provider).listByDecision(id);
    expect(listed?.map((review) => review.id)).toEqual([second!.id, first!.id]);

    const updated = await new SqlReviewUpdater(provider).update(second!.id, { incorrect: true });
    expect(updated?.updatedAt).not.toBeNull();
    expect((await finder.findById(id))?.markedIncorrect).toBe(true);

    const remover = new SqlReviewRemover(provider);
    expect(await remover.remove(second!.id)).toBe('removed');
    expect(await remover.remove(second!.id)).toBe('not_found');
    expect((await finder.findById(id))?.markedIncorrect).toBe(true);
    expect(await remover.remove(first!.id)).toBe('removed');
    expect((await finder.findById(id))?.markedIncorrect).toBe(false);
  });

  it('trata decisão e revisão inexistentes', async () => {
    const unknown = '3f2c9a54-6d1e-4b7a-9c58-2a4f1e0d7b11';

    expect(await new SqlReviewCreator(provider).create(unknown, { analyst, incorrect: true, comment: null })).toBeNull();
    expect(await new SqlReviewReader(provider).listByDecision(unknown)).toBeNull();
    expect(await new SqlReviewUpdater(provider).update(unknown, { incorrect: true })).toBeNull();
    expect(await new SqlDecisionFinder(provider).findById(unknown)).toBeNull();
  });
});
