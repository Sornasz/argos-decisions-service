-- Schema inicial do decision-audit-service (Azure SQL / SQL Server 2019+).
-- Datas em UTC. Chaves primárias internas em UNIQUEIDENTIFIER; o ID externo
-- da transação (ex.: tx-1329056812) é único em dbo.transacao.

CREATE TABLE dbo.transacao (
    id                          UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_transacao_id DEFAULT NEWSEQUENTIALID(),
    transacao_externa_id        NVARCHAR(128)    NOT NULL,
    valor                       DECIMAL(18, 2)   NOT NULL,
    parcelas                    INT              NOT NULL,
    solicitada_em               DATETIME2(3)     NOT NULL,
    cliente_media_valor         DECIMAL(18, 2)   NOT NULL,
    cliente_transacoes_24h      INT              NOT NULL,
    cliente_comerciantes_conhecidos NVARCHAR(MAX) NOT NULL,
    comerciante_externo_id      NVARCHAR(128)    NOT NULL,
    comerciante_mcc             CHAR(4)          NOT NULL,
    comerciante_media_valor     DECIMAL(18, 2)   NOT NULL,
    terminal_online             BIT              NOT NULL,
    terminal_cartao_presente    BIT              NOT NULL,
    terminal_km_de_casa         FLOAT            NOT NULL,
    transacao_anterior_em       DATETIME2(3)     NULL,
    transacao_anterior_km       FLOAT            NULL,
    criado_em                   DATETIME2(3)     NOT NULL CONSTRAINT df_transacao_criado_em DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_transacao PRIMARY KEY (id),
    CONSTRAINT uq_transacao_externa_id UNIQUE (transacao_externa_id),
    CONSTRAINT ck_transacao_valor CHECK (valor >= 0),
    CONSTRAINT ck_transacao_parcelas CHECK (parcelas >= 1),
    CONSTRAINT ck_transacao_comerciantes_json CHECK (ISJSON(cliente_comerciantes_conhecidos) = 1),
    CONSTRAINT ck_transacao_anterior CHECK (
        (transacao_anterior_em IS NULL AND transacao_anterior_km IS NULL)
        OR (transacao_anterior_em IS NOT NULL AND transacao_anterior_km IS NOT NULL)
    )
);
GO

CREATE TABLE dbo.decisao (
    id                          UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_decisao_id DEFAULT NEWSEQUENTIALID(),
    transacao_id                UNIQUEIDENTIFIER NOT NULL,
    evento_id                   NVARCHAR(64)     NOT NULL,
    fraud_score                 DECIMAL(3, 2)    NOT NULL,
    status                      VARCHAR(8)       NOT NULL,
    threshold_aprovacao         DECIMAL(5, 4)    NOT NULL,
    versao_indice               NVARCHAR(64)     NULL,
    vetor_caracteristicas       NVARCHAR(1000)   NOT NULL,
    decidido_em                 DATETIME2(3)     NOT NULL,
    criado_em                   DATETIME2(3)     NOT NULL CONSTRAINT df_decisao_criado_em DEFAULT SYSUTCDATETIME(),
    marcada_incorreta           BIT              NOT NULL CONSTRAINT df_decisao_marcada_incorreta DEFAULT 0,
    notificacao_status          VARCHAR(16)      NOT NULL,
    notificacao_canal           VARCHAR(8)       NULL,
    notificacao_erro            NVARCHAR(500)    NULL,
    notificacao_atualizada_em   DATETIME2(3)     NULL,
    CONSTRAINT pk_decisao PRIMARY KEY (id),
    CONSTRAINT fk_decisao_transacao FOREIGN KEY (transacao_id) REFERENCES dbo.transacao (id),
    CONSTRAINT uq_decisao_transacao UNIQUE (transacao_id),
    CONSTRAINT ck_decisao_fraud_score CHECK (fraud_score BETWEEN 0 AND 1),
    CONSTRAINT ck_decisao_status CHECK (status IN ('APROVADO', 'NEGADO')),
    CONSTRAINT ck_decisao_threshold CHECK (threshold_aprovacao > 0 AND threshold_aprovacao <= 1),
    CONSTRAINT ck_decisao_vetor_json CHECK (ISJSON(vetor_caracteristicas) = 1),
    CONSTRAINT ck_decisao_notificacao_status CHECK (notificacao_status IN ('pendente', 'nao_aplicavel', 'enviada', 'falhou')),
    CONSTRAINT ck_decisao_notificacao_canal CHECK (notificacao_canal IS NULL OR notificacao_canal IN ('gmail', 'log')),
    CONSTRAINT ck_decisao_aprovada_sem_alerta CHECK (status = 'NEGADO' OR notificacao_status = 'nao_aplicavel')
);
GO

-- Filtros do histórico no painel: período, status e faixa de score (RF14, RF19).
CREATE INDEX ix_decisao_decidido_em ON dbo.decisao (decidido_em DESC) INCLUDE (status, fraud_score, notificacao_status);
CREATE INDEX ix_decisao_status_decidido_em ON dbo.decisao (status, decidido_em DESC) INCLUDE (fraud_score);
CREATE INDEX ix_decisao_fraud_score ON dbo.decisao (fraud_score, decidido_em DESC);
GO

CREATE TABLE dbo.decisao_vizinho (
    id                          UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_decisao_vizinho_id DEFAULT NEWSEQUENTIALID(),
    decisao_id                  UNIQUEIDENTIFIER NOT NULL,
    posicao                     TINYINT          NOT NULL,
    referencia_indice           INT              NOT NULL,
    distancia                   FLOAT            NOT NULL,
    rotulo_fraude               BIT              NOT NULL,
    CONSTRAINT pk_decisao_vizinho PRIMARY KEY (id),
    CONSTRAINT fk_decisao_vizinho_decisao FOREIGN KEY (decisao_id) REFERENCES dbo.decisao (id) ON DELETE CASCADE,
    CONSTRAINT uq_decisao_vizinho_posicao UNIQUE (decisao_id, posicao),
    CONSTRAINT ck_decisao_vizinho_posicao CHECK (posicao BETWEEN 1 AND 5),
    CONSTRAINT ck_decisao_vizinho_referencia CHECK (referencia_indice >= 0),
    CONSTRAINT ck_decisao_vizinho_distancia CHECK (distancia >= 0)
);
GO

CREATE TABLE dbo.analista (
    id                          UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_analista_id DEFAULT NEWSEQUENTIALID(),
    nome                        NVARCHAR(200)    NOT NULL,
    email                       NVARCHAR(320)    NOT NULL,
    criado_em                   DATETIME2(3)     NOT NULL CONSTRAINT df_analista_criado_em DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_analista PRIMARY KEY (id),
    CONSTRAINT uq_analista_email UNIQUE (email)
);
GO

-- Histórico de revisões (RF08). decisao.marcada_incorreta guarda o estado atual
-- para filtro rápido; cada marcação ou desmarcação gera uma linha aqui.
CREATE TABLE dbo.revisao (
    id                          UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_revisao_id DEFAULT NEWSEQUENTIALID(),
    decisao_id                  UNIQUEIDENTIFIER NOT NULL,
    analista_id                 UNIQUEIDENTIFIER NOT NULL,
    decisao_incorreta           BIT              NOT NULL,
    comentario                  NVARCHAR(2000)   NULL,
    revisado_em                 DATETIME2(3)     NOT NULL CONSTRAINT df_revisao_revisado_em DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_revisao PRIMARY KEY (id),
    CONSTRAINT fk_revisao_decisao FOREIGN KEY (decisao_id) REFERENCES dbo.decisao (id),
    CONSTRAINT fk_revisao_analista FOREIGN KEY (analista_id) REFERENCES dbo.analista (id)
);
GO

CREATE INDEX ix_revisao_decisao ON dbo.revisao (decisao_id, revisado_em DESC);
GO
