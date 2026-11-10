-- PUT /reviews/:id registra quando a revisão foi alterada pela última vez.
ALTER TABLE dbo.revisao ADD atualizado_em DATETIME2(3) NULL;
GO
