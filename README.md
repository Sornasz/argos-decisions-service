# argos-decisions-service

Serviço de histórico de decisões de fraude do Argos. Ele recebe o evento `TransactionScored` publicado pelo serviço de decisão (`argos-fraud-function`), grava a decisão no Azure SQL, dispara o alerta de fraude por e-mail quando a decisão é negada e expõe uma API REST para consultar o histórico e registrar as revisões dos analistas.

Projeto da disciplina de Arquitetura de Software com Cloud (PUCPR).

## Equipe

- Arthur Sornas
- Eduardo Martins
- Guilherme Marafon
- Victor Ribeiro

## Tecnologias

- Node 22 e TypeScript
- Express 5 (API REST)
- Swagger UI (OpenAPI 3) em `/docs` e AsyncAPI em `/docs/events`
- Azure Service Bus (`@azure/service-bus`), com um receptor que assina a subscription
- Azure SQL (`mssql`), com migrations em `db/migrations`
- Gmail API com OAuth2, para o alerta de fraude
- Vitest (testes unitários) e dependency-cruiser (testes e checagem de arquitetura)
- Docker, com build em múltiplos estágios

## Arquitetura

Clean Architecture com Vertical Slice: o código é dividido por feature, e cada feature tem as camadas `domain`, `application`, `infrastructure` e `api`.

```
src/
  main.ts                          composição do serviço e inicialização
  bootstrap/
    config.ts                      leitura e validação das variáveis de ambiente
    server.ts                      app Express, Swagger e tratamento de erros
    openapi.ts                     documento OpenAPI (schemas comuns e junção dos paths das features)
    migrate.ts                     aplica as migrations no Azure SQL
  shared/                          núcleo comum: pool SQL, migrations, memória de desenvolvimento
  features/
    record-decision/               evento TransactionScored -> grava a decisão
      api/                         receptor do Service Bus (conclui, devolve à fila ou envia à dead letter)
    notify-fraud/                  alerta de fraude por Gmail API ou log
    list-decisions/                GET /decisions
    get-decision/                  GET /decisions/:id
    decision-metrics/              GET /decisions/metrics
    create-review/                 POST /decisions/:id/reviews
    list-reviews/                  GET /decisions/:id/reviews
    update-review/                 PUT /reviews/:id
    delete-review/                 DELETE /reviews/:id
    health-check/                  GET /health
      (cada feature: domain/, application/, infrastructure/, api/, feature.ts, index.ts)
db/migrations/                     schema do Azure SQL
asyncapi.yaml                      contrato do evento TransactionScored
tests/                             espelha src/ e inclui tests/architecture
```

Regras de dependência, verificadas pelo dependency-cruiser (`.dependency-cruiser.cjs`):

- `domain` não importa nada fora do próprio `domain`.
- `application` importa só `domain` e a própria `application`.
- `api` não importa `infrastructure`; quem liga os adapters concretos é o `feature.ts`.
- Uma feature só enxerga outra pelo `index.ts`; `main.ts` e `bootstrap` entram nas features só pelo `index.ts`.
- `shared` não conhece nenhuma feature.
- Sem ciclos e sem imports não resolvidos.

Os testes em `tests/architecture` provam que a checagem funciona: eles criam projetos de fixture com uma violação artificial por regra e conferem que `depcruise` falha apontando exatamente aquela regra.

## Como as decisões chegam

O receptor (`record-decision/api/transaction-scored.receiver.ts`) assina a subscription em modo `peekLock` e decide o destino de cada mensagem de forma explícita:

| Situação | Destino |
|---|---|
| Decisão gravada | `complete` |
| Duplicata (mesmo ID de transação) | `complete`, sem efeito e sem novo alerta |
| Evento inválido | `deadLetter`, com o motivo `InvalidTransactionScored` e a lista de campos |
| Falha ao gravar (banco fora do ar, por exemplo) | `abandon`: a mensagem volta para a fila e é reentregue até o `maxDeliveryCount` |

Falha no alerta de fraude não muda o destino: a decisão já está gravada e o status da notificação fica registrado como `falhou`.

## API

A documentação interativa, com exemplos, fica em `/docs`. O contrato do evento fica em `/docs/events`.

| Método e rota | O que faz |
|---|---|
| `GET /decisions` | Lista decisões, da mais recente para a mais antiga, 20 por página. Filtros: `status` (`APROVADO` ou `NEGADO`), `from`, `to`, `minScore`, `maxScore`, `page` |
| `GET /decisions/:id` | Decisão com a transação, o vetor de 14 dimensões e os 5 vizinhos |
| `GET /decisions/metrics` | Volume, taxas de aprovação e negação, score médio e total marcado como incorreto |
| `POST /decisions/:id/reviews` | Cria uma revisão (`analyst`, `incorrect`, `comment`) |
| `GET /decisions/:id/reviews` | Lista as revisões da decisão, da mais recente para a mais antiga |
| `PUT /reviews/:id` | Altera `incorrect` e/ou `comment` |
| `DELETE /reviews/:id` | Remove a revisão |
| `GET /health` | `200` quando o armazenamento responde, `503` quando não |

Decisões nascem do evento; o CRUD completo é o de revisões. Detalhes:

- `:id` de decisão e de revisão é o UUID interno (campo `id`), não o ID externo da transação.
- A revisão atualiza o estado atual `marcada_incorreta` da decisão na mesma transação de banco. O estado atual é o veredito (`incorrect`) da revisão mais recente; sem revisões, é `false`. Alterar ou remover uma revisão recalcula o estado.
- O analista é identificado pelo e-mail (gravado em minúsculas). Um e-mail novo cria o analista; um e-mail conhecido reaproveita o cadastro e atualiza o nome.
- Erros de validação devolvem `400` com `error: "invalid_request"` e a lista `invalid_fields`. ID que não é UUID também é `400`; recurso inexistente é `404`.

## Variáveis de ambiente

Nenhum segredo fica no código. Copie `.env.example` para `.env` (ignorado pelo git) ou defina as variáveis no ambiente.

| Variável | Uso |
|---|---|
| `PORT` | Porta do servidor. Padrão `3002` |
| `SQL_CONNECTION_STRING` | Conexão com o Azure SQL. Obrigatória, salvo com `DECISION_STORE=memory` |
| `DECISION_STORE` | `sql` (padrão) ou `memory`. A memória é só para desenvolvimento: avisa no log ao subir e é recusada com `NODE_ENV=production`. Nunca é usada em silêncio quando faltar a conexão SQL |
| `SERVICEBUS_CONNECTION`, `SERVICEBUS_TOPIC_NAME`, `SERVICEBUS_SUBSCRIPTION_NAME` | Receptor do Service Bus. Defina as três ou nenhuma; sem elas a API sobe sem o receptor. O receptor exige `DECISION_STORE=sql` |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER`, `FRAUD_ALERT_RECIPIENTS` | Alerta de fraude pela Gmail API (OAuth2). Sem as credenciais, o alerta só vai para o log |

## Como rodar

Pré-requisito: Node 22.12 ou superior.

```bash
npm install
npm run verify         # checagem de arquitetura, typecheck e testes
```

### Só a API, sem banco (desenvolvimento)

```bash
DECISION_STORE=memory npm run dev
```

Abra `http://localhost:3002/docs`. Sem o receptor e com a memória vazia, `GET /decisions` devolve uma lista vazia; as decisões só aparecem quando o evento chega.

### Com Azure SQL e Service Bus

```bash
export SQL_CONNECTION_STRING='...'
npm run db:migrate     # aplica db/migrations
export SERVICEBUS_CONNECTION='...' SERVICEBUS_TOPIC_NAME=transaction-scored SERVICEBUS_SUBSCRIPTION_NAME=decision-audit
npm run dev
```

### Docker

```bash
docker build -t argos-decisions-service .
docker run --rm -p 3002:3002 --env-file .env argos-decisions-service
```

A imagem usa dois estágios: o primeiro compila o TypeScript; o segundo leva só as dependências de produção, `dist`, `db` e `asyncapi.yaml`, e roda como usuário `node`.

## Testes

```bash
npm test               # vitest
npm run check:arch     # dependency-cruiser sobre src/
```

Os testes de integração com o SQL (`tests/features/record-decision/infrastructure/sql-decision-repository.integration.test.ts`) só rodam quando `SQL_TEST_CONNECTION` aponta para um banco de testes; sem a variável, são pulados.
