import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { splitBatches } from '../../../../src/shared/sql-migrations.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../db/migrations/', import.meta.url));

describe('splitBatches', () => {
  it('separa o script nas linhas GO, sem diferenciar maiúsculas', () => {
    expect(splitBatches('CREATE TABLE a (x INT);\nGO\nCREATE TABLE b (y INT);\ngo\n')).toEqual([
      'CREATE TABLE a (x INT);',
      'CREATE TABLE b (y INT);',
    ]);
  });

  it('não corta palavras que contêm GO', () => {
    expect(splitBatches("SELECT 'GOAL' AS GOTO;")).toEqual(["SELECT 'GOAL' AS GOTO;"]);
  });
});

describe('migrations versionadas', () => {
  const files = readdirSync(migrationsDirectory).filter((file) => file.endsWith('.sql')).sort();

  it('seguem a numeração NNNN_descricao.sql', () => {
    expect(files.length).toBeGreaterThan(0);
    files.forEach((file) => expect(file).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/));
  });

  it('declaram o ID externo da transação como único e as chaves internas como UNIQUEIDENTIFIER', () => {
    const schema = readFileSync(`${migrationsDirectory}0001_schema_inicial.sql`, 'utf8');

    expect(schema).toMatch(/CONSTRAINT uq_transacao_externa_id UNIQUE \(transacao_externa_id\)/);
    expect(schema).toMatch(/CONSTRAINT uq_decisao_transacao UNIQUE \(transacao_id\)/);
    for (const table of ['transacao', 'decisao', 'decisao_vizinho', 'analista', 'revisao']) {
      expect(schema).toMatch(new RegExp(`CREATE TABLE dbo\\.${table} \\(\\s*id\\s+UNIQUEIDENTIFIER`));
    }
    expect(schema).toMatch(/notificacao_status IN \('pendente', 'nao_aplicavel', 'enviada', 'falhou'\)/);
  });
});
