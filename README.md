# skeleton_v2

API NestJS organizada como **monólito modular** com **arquitetura hexagonal / Clean
Architecture**. Cada módulo de negócio é uma fatia vertical completa, com as quatro
camadas: `domain`, `application`, `infrastructure` e `presentation`.

**Stack:** NestJS 12 · TypeScript (ESM) · PostgreSQL 16 · TypeORM · Redis 7 · Vitest ·
Swagger · oxlint · Prettier.

---

## Sumário

- [Começando](#começando)
- [Arquitetura](#arquitetura)
  - [As quatro camadas](#as-quatro-camadas)
  - [Regras de dependência](#regras-de-dependência)
  - [Estrutura de pastas](#estrutura-de-pastas)
  - [Como um módulo é montado](#como-um-módulo-é-montado)
  - [Tratamento de erros](#tratamento-de-erros)
- [Configuração](#configuração)
- [Banco de dados](#banco-de-dados)
  - [Migrations](#migrations)
  - [Schema](#schema)
- [API](#api)
  - [Módulo users](#módulo-users)
  - [Módulo vouchers](#módulo-vouchers)
  - [Regras de validação do voucher](#regras-de-validação-do-voucher)
  - [Reserva temporária](#reserva-temporária)
  - [Usando o voucher](#usando-o-voucher)
- [Testes](#testes)
- [Scripts](#scripts)
- [Criando um novo módulo](#criando-um-novo-módulo)
- [Limitações conhecidas](#limitações-conhecidas)

---

## Começando

Pré-requisitos: Node 20.19+, 22.13+ ou 24.11+ (exigência do TypeORM), um PostgreSQL e um
Redis acessíveis — o `docker-compose.yml` sobe os dois.

```bash
npm install
cp .env.example .env
npm run db:up          # sobe o Postgres e o Redis (docker compose)
npm run migration:run  # compila e aplica as migrations
npm run start:dev
```

A API sobe em `http://localhost:3000` e o Swagger em `http://localhost:3000/docs`
(documento OpenAPI em `/docs-json`).

---

## Arquitetura

O projeto é um monólito: um único processo, um único banco. O que o torna **modular** é
que cada domínio de negócio vive isolado em `src/modules/<módulo>`, com suas próprias
camadas, e nunca importa o interior de outro módulo. Isso mantém a opção de extrair um
módulo para um serviço separado no futuro sem uma reescrita.

### As quatro camadas

As dependências apontam sempre para dentro: nada no centro sabe o que existe na borda.

| Camada           | Responsabilidade                                                      | Pode depender de          |
| ---------------- | --------------------------------------------------------------------- | ------------------------- |
| `domain`         | Entidades, value objects, regras de negócio, erros e **portas**       | só de `domain`            |
| `application`    | Casos de uso que orquestram o domínio, DTOs de entrada/saída e portas | `domain`, `application`   |
| `infrastructure` | **Adaptadores**: TypeORM, in-memory, relógio, geração de UUID         | todas as camadas internas |
| `presentation`   | Controllers HTTP, requests, presenters e documentação Swagger         | todas as camadas internas |

**Portas e adaptadores.** Uma porta é uma classe abstrata declarada na camada interna
(por exemplo `UserRepository`, `VoucherUsageRepository`, `IdGenerator`, `Clock`). O
adaptador que a implementa vive em `infrastructure`. Como a porta é uma classe abstrata,
ela serve também de token de injeção do Nest — não existe token mágico em string.

**O centro não conhece o framework.** `domain` e `application` não importam
`@nestjs/*`, `typeorm`, `pg` nem `express`. Os casos de uso são classes TypeScript
comuns, instanciadas por factory no `*.module.ts` do módulo. Trocar o Nest por outro
framework, ou o TypeORM por outro ORM, não toca no núcleo.

### Regras de dependência

Estas regras não dependem de disciplina: elas são verificadas por
[test/architecture.spec.ts](test/architecture.spec.ts), que roda junto com `npm test` e
falha apontando o import culpado.

- `domain` só depende de `domain`;
- `application` depende de `domain` e `application`;
- `infrastructure` e `presentation` podem depender das camadas internas;
- `domain` e `application` não importam `@nestjs/*`, `typeorm`, `pg` ou `express`;
- um módulo nunca importa o interior de outro módulo — só o que está em `shared`.

### Estrutura de pastas

```
src/
├── main.ts                        # bootstrap + Swagger
├── app.module.ts                  # composição da aplicação
│
├── shared/                        # peças transversais, sem regra de negócio
│   ├── domain/errors/             # DomainError, ValidationError, NotFoundError, ConflictError
│   ├── application/               # contrato UseCase<Input, Output>
│   ├── infrastructure/
│   │   ├── config/env.ts          # validação das variáveis de ambiente no boot
│   │   ├── cache/redis.module.ts  # cliente Redis compartilhado
│   │   └── database/
│   │       ├── database.module.ts # ConfigModule + TypeOrmModule.forRootAsync
│   │       └── typeorm/           # opções, DataSource do CLI e migrations
│   └── presentation/http/
│       ├── filters/               # erro de domínio -> status HTTP
│       ├── responses/             # ErrorResponse (schema do Swagger)
│       └── swagger.ts             # setupSwagger(app)
│
└── modules/
    ├── users/
    │   ├── domain/
    │   │   ├── entities/          # User
    │   │   ├── value-objects/     # Email
    │   │   ├── errors/            # InvalidEmailError, UserAlreadyExistsError, ...
    │   │   └── repositories/      # porta UserRepository
    │   ├── application/
    │   │   ├── use-cases/         # CreateUser, GetUserById, ListUsers
    │   │   ├── dtos/              # CreateUserInput, UserOutput
    │   │   └── ports/             # IdGenerator
    │   ├── infrastructure/
    │   │   ├── persistence/typeorm/    # entity, mapper e repositório
    │   │   ├── persistence/in-memory/  # adaptador usado nos testes
    │   │   └── services/               # CryptoIdGenerator
    │   ├── presentation/http/     # controller, request, presenter
    │   └── users.module.ts        # composition root do módulo
    │
    └── vouchers/
        ├── domain/
        │   ├── entities/          # Voucher, VoucherReservation, VoucherUsage
        │   ├── value-objects/     # UserId
        │   ├── errors/            # VoucherNotAvailableError, VoucherLimitReachedError, ...
        │   └── repositories/      # portas Voucher, VoucherUsage e VoucherReservation
        ├── application/
        │   ├── use-cases/         # ListVouchers, ValidateVoucher, UseVoucher
        │   ├── services/          # VoucherEligibility (regras compartilhadas)
        │   ├── dtos/              # inputs e VoucherOutput
        │   └── ports/             # Clock
        ├── infrastructure/
        │   ├── persistence/typeorm/    # entities, mapper e repositórios
        │   ├── persistence/redis/      # reservas temporárias
        │   ├── persistence/in-memory/  # adaptadores usados nos testes
        │   └── services/               # SystemClock
        ├── presentation/http/     # controller, request, presenter
        └── vouchers.module.ts     # composition root do módulo

test/
├── architecture.spec.ts           # valida as regras de dependência
├── users.e2e-spec.ts
├── vouchers.e2e-spec.ts
└── swagger.e2e-spec.ts
```

### Como um módulo é montado

O `*.module.ts` é o único lugar que conhece todas as camadas. É ali que as portas são
ligadas aos adaptadores e os casos de uso são construídos:

```ts
@Module({
  imports: [
    TypeOrmModule.forFeature([VoucherOrmEntity, VoucherUsageOrmEntity]),
  ],
  controllers: [VouchersController],
  providers: [
    // porta -> adaptador
    { provide: VoucherRepository, useClass: TypeOrmVoucherRepository },
    {
      provide: VoucherReservationRepository,
      useClass: RedisVoucherReservationRepository,
    },
    { provide: Clock, useClass: SystemClock },

    // casos de uso: classes puras, montadas por factory
    {
      provide: ValidateVoucherUseCase,
      useFactory: (vouchers, usages, reservations, clock) =>
        new ValidateVoucherUseCase(vouchers, usages, reservations, clock),
      inject: [
        VoucherRepository,
        VoucherUsageRepository,
        VoucherReservationRepository,
        Clock,
      ],
    },
  ],
})
export class VouchersModule {}
```

As reservas já passaram de memória para Redis exatamente assim: um adaptador novo e uma
linha trocada aqui. Nenhum caso de uso foi tocado.

### Tratamento de erros

O domínio lança erros semânticos; nenhum controller trata erro. O
[DomainErrorFilter](src/shared/presentation/http/filters/domain-error.filter.ts) traduz a
hierarquia em status HTTP:

| Classe base       | Status | Erros concretos                                                                                                                                           |
| ----------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ValidationError` | 400    | `InvalidEmailError`, `InvalidUserNameError`, `InvalidUserIdError`, `InvalidVoucherCodeError`, `InvalidVoucherValueError`, `InvalidVoucherLimitError`      |
| `NotFoundError`   | 404    | `UserNotFoundError`, `VoucherNotFoundError`                                                                                                               |
| `ConflictError`   | 409    | `UserAlreadyExistsError`, `VoucherNotAvailableError`, `VoucherNotAvailableForCategoriesError`, `VoucherLimitReachedError`, `VoucherUserLimitReachedError` |
| outros            | 422    | —                                                                                                                                                         |

O corpo é sempre o mesmo:

```json
{
  "statusCode": 409,
  "error": "VoucherLimitReachedError",
  "message": "Voucher \"WELCOME10\" reached its limit of 100 use(s)"
}
```

---

## Configuração

As variáveis são validadas no boot por
[env.ts](src/shared/infrastructure/config/env.ts) — falta uma delas, a aplicação não sobe.

| Variável            | Padrão        | Descrição                         |
| ------------------- | ------------- | --------------------------------- |
| `NODE_ENV`          | `development` | —                                 |
| `PORT`              | `3000`        | Porta HTTP                        |
| `DATABASE_HOST`     | obrigatória   | Host do Postgres                  |
| `DATABASE_PORT`     | `5432`        | —                                 |
| `DATABASE_USER`     | obrigatória   | —                                 |
| `DATABASE_PASSWORD` | obrigatória   | —                                 |
| `DATABASE_NAME`     | obrigatória   | —                                 |
| `DATABASE_SSL`      | `false`       | `true` habilita SSL na conexão    |
| `DATABASE_LOGGING`  | `false`       | `true` loga as queries do TypeORM |
| `REDIS_HOST`        | obrigatória   | Host do Redis (reservas)          |
| `REDIS_PORT`        | `6379`        | —                                 |
| `REDIS_PASSWORD`    | vazio         | Opcional                          |
| `REDIS_DB`          | `0`           | Índice do banco; e2e usa `1`      |

---

## Banco de dados

PostgreSQL via TypeORM. Dois princípios:

1. **O schema pertence às migrations.** `synchronize` está desligado em todos os
   ambientes; a estrutura só muda por migration versionada.
2. **O modelo de persistência é separado da entidade de domínio.** `UserOrmEntity` e
   `VoucherOrmEntity` descrevem tabelas; `User` e `Voucher` descrevem regras. A conversão
   fica nos mappers, então mudar o schema não vaza para o domínio.

### Migrations

```bash
npm run migration:run     # aplica as pendentes
npm run migration:show    # lista o que já rodou
npm run migration:revert  # desfaz a última
npm run migration:generate
```

Os comandos compilam antes de rodar, porque a CLI do TypeORM trabalha sobre o `dist`.

As migrations são registradas **explicitamente** em
[migrations/index.ts](src/shared/infrastructure/database/typeorm/migrations/index.ts), e
não por glob, para resolverem igual rodando de `dist` (produção) e de TypeScript (testes).
Toda migration gerada precisa ser adicionada nessa lista.

### Schema

**`users`**

| Coluna       | Tipo           | Observação |
| ------------ | -------------- | ---------- |
| `id`         | `uuid`         | PK         |
| `name`       | `varchar(100)` | —          |
| `email`      | `varchar(320)` | único      |
| `created_at` | `timestamptz`  | —          |

**`vouchers`**

| Coluna          | Tipo            | Observação                                    |
| --------------- | --------------- | --------------------------------------------- |
| `uuid`          | `uuid`          | PK                                            |
| `code`          | `varchar(50)`   | índice único; guardado em maiúsculas          |
| `value`         | `numeric(12,2)` | convertido para `number` na leitura           |
| `validate_date` | `timestamptz`   | anulável — `null` nunca expira                |
| `limit`         | `integer`       | total de usos permitidos                      |
| `user_limit`    | `integer`       | anulável — `null` é sem limite por usuário    |
| `restriction`   | `jsonb`         | regras livres, default `{}`                   |
| `created_at`    | `timestamptz`   | —                                             |
| `updated_at`    | `timestamptz`   | —                                             |
| `deleted_at`    | `timestamptz`   | soft delete; linhas apagadas somem das buscas |

**`users_vouchers`** — registra o uso de um voucher por um usuário.

| Coluna       | Tipo          | Observação                                    |
| ------------ | ------------- | --------------------------------------------- |
| `uuid`       | `uuid`        | PK, default `gen_random_uuid()`               |
| `user_id`    | `uuid`        | indexado junto com `voucher_id`               |
| `voucher_id` | `uuid`        | FK para `vouchers(uuid)`, `ON DELETE CASCADE` |
| `created_at` | `timestamptz` | default `now()`                               |

Duas decisões de modelagem aqui:

- **A PK é um `uuid` próprio**, e não `(user_id, voucher_id)`. Com `user_limit` maior que
  1 o mesmo usuário pode usar o voucher várias vezes, então a chave composta impediria o
  caso de uso.
- **`user_id` não tem FK** para `users`, de propósito: o acoplamento entre módulos para
  no banco. O `voucher_id` tem, porque `vouchers` é do mesmo módulo.

---

## API

Documentação interativa em `/docs`. Erros de domínio saem no formato descrito em
[Tratamento de erros](#tratamento-de-erros). A exceção é o que é barrado antes de chegar
ao domínio, como o `ParseUUIDPipe` em `GET /users/:id`, que usa o corpo padrão do Nest
(`{ "message", "error", "statusCode" }`).

| Método | Rota                 | Status possíveis                                    |
| ------ | -------------------- | --------------------------------------------------- |
| POST   | `/users`             | 201 · 400 (dados inválidos) · 409 (email duplicado) |
| GET    | `/users`             | 200                                                 |
| GET    | `/users/:id`         | 200 · 400 (id não-uuid) · 404                       |
| GET    | `/vouchers`          | 200                                                 |
| POST   | `/vouchers/validate` | 200 · 400 · 404 · 409                               |
| POST   | `/vouchers/use`      | 201 · 400 · 404 · 409                               |

### Módulo users

Criação, listagem e busca por id — o módulo serve de referência da estrutura.

```http
POST /users
{ "name": "Ada Lovelace", "email": "ada@example.com" }
```

```json
{
  "id": "6d349328-adee-44a0-a0fd-12540f68263f",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "createdAt": "2026-09-17T17:50:50.790Z"
}
```

O email é normalizado (minúsculas, sem espaços nas pontas) pelo value object `Email`, e a
unicidade é garantida no domínio e por constraint no banco — uma violação de constraint é
traduzida de volta para `UserAlreadyExistsError`, então uma corrida entre requisições
responde 409, não 500.

### Módulo vouchers

**`GET /vouchers`** lista os vouchers não apagados, ordenados por `created_at`.

**`POST /vouchers/validate`** verifica se um voucher pode ser usado por um cliente:

```http
POST /vouchers/validate
{
  "user_id": "3f1c5e0a-2b3d-4c5e-8f90-123456789abc",
  "categories": ["electronics", "games"],
  "code": "welcome10"
}
```

```json
{
  "uuid": "2260b471-2391-43ba-85db-07831e7261fe",
  "code": "WELCOME10",
  "value": 10,
  "validateDate": "2026-10-17T00:00:00.000Z",
  "limit": 100,
  "userLimit": 1,
  "restriction": { "categories": ["electronics"] },
  "createdAt": "2026-09-17T17:50:50.790Z",
  "updatedAt": "2026-09-17T17:50:50.790Z"
}
```

O contrato HTTP usa `snake_case` e o controller converte para o input do caso de uso. O
`code` é case-insensitive: `welcome10` encontra o voucher salvo como `WELCOME10`.

### Regras de validação do voucher

Aplicadas nesta ordem — a primeira que falhar define a resposta:

| #   | Regra                             | Falha                                            | Status |
| --- | --------------------------------- | ------------------------------------------------ | ------ |
| 0   | `code` e `user_id` bem formados   | `InvalidVoucherCodeError` / `InvalidUserIdError` | 400    |
| 1   | Voucher existe e não está apagado | `VoucherNotFoundError`                           | 404    |
| 2   | Não expirou                       | `VoucherNotAvailableError`                       | 409    |
| 3   | Serve às categorias               | `VoucherNotAvailableForCategoriesError`          | 409    |
| 4   | Limite total                      | `VoucherLimitReachedError`                       | 409    |
| 5   | Limite por usuário                | `VoucherUserLimitReachedError`                   | 409    |

**2. Validade** — comparada contra `validate_date`. O voucher continua válido no instante
exato da data, e expira a partir do milissegundo seguinte. `null` nunca expira. A
mensagem devolvida é `O voucher não está mais disponivel`.

**3. Categorias** — se `restriction.categories` existir e for uma lista de textos não
vazia, **basta uma** das `categories` recebidas estar nela. A comparação ignora
maiúsculas e espaços nas pontas. Sem `restriction.categories` — ausente, vazia ou com
formato inesperado — o voucher vale para qualquer categoria. Se o voucher é restrito e a
requisição não manda categoria alguma, a validação falha.

**4. Limite total** — soma as linhas de `users_vouchers` do voucher com as
[reservas ativas](#reserva-temporária) de **outros** usuários, e compara com `limit`.

**5. Limite por usuário** — conta as linhas de `users_vouchers` daquele `user_id` e
compara com `user_limit`. Nulo significa sem limite por usuário. A reserva do próprio
usuário não entra nessa conta.

As demais chaves de `restriction` (por exemplo `minCartValue`) ainda não são
interpretadas.

### Reserva temporária

Uma validação bem-sucedida **reserva** o voucher para aquele cliente por 15 minutos. A
reserva guarda `user_id`, `code` e `expireDate`, e vive no **Redis**, compartilhada entre
todas as instâncias da API.

- **Conta como uso temporário** contra o `limit` total — mas só para os _outros_ usuários.
  A reserva do próprio cliente não bloqueia ele mesmo, então revalidar é idempotente.
- **O `expireDate` só é empurrado** para os próximos 15 minutos quando o anterior já
  passou. Revalidar dentro da janela mantém a data original.
- **Não grava nada em `users_vouchers`** — reserva é bloqueio temporário, não uso.
- **Nada é reservado quando a validação falha.**
- Reservas vencidas são descartadas por score antes de cada leitura.

No Redis, cada `code` é um sorted set `vouchers:reservations:{CODE}`: o membro é o
`user_id` e o score é o `expireDate` em epoch de milissegundos. Isso resolve a contagem de
reservas ativas com uma única consulta por faixa, e a limpeza das vencidas com um
`ZREMRANGEBYSCORE`. A chave também recebe TTL igual à reserva mais recente, então um
código que ninguém valida de novo some sozinho.

#### A reserva também é atômica

Contar as reservas ativas e pegar uma precisa ser um passo só — senão duas validações
simultâneas na última unidade veem a mesma vaga livre e as duas reservam. Por isso a
operação é um script Lua ([reserve-voucher.lua](src/modules/vouchers/infrastructure/persistence/redis/reserve-voucher.lua)),
que o Redis executa como um único comando, sem intercalar outro cliente:

1. `ZREMRANGEBYSCORE` remove as reservas vencidas;
2. se o usuário já tem uma, devolve a existente com o `expireDate` original;
3. compara `ZCARD` com as vagas disponíveis e desiste se não houver;
4. `ZADD` da nova reserva e `PEXPIREAT` na chave.

As vagas disponíveis são `limit` menos os usos já gravados em `users_vouchers`. Do lado
da porta, isso é `reserve(userId, code, now, maxActiveHolds)`: o caso de uso pede uma
reserva respeitando um teto e recebe `null` quando não há vaga — sem saber que existe
script ou sorted set.

Com 1.200 validações simultâneas de usuários diferentes contra um voucher de 1.000 usos,
o Redis terminou com exatamente 1.000 reservas e 200 respostas 409.

O TTL está em `RESERVATION_TTL_MINUTES`, em
[voucher-reservation.ts](src/modules/vouchers/domain/entities/voucher-reservation.ts). O
tempo entra no caso de uso pela porta `Clock`, o que torna as janelas testáveis sem
espera real.

### Usando o voucher

`POST /vouchers/use` recebe o mesmo payload da validação e consome o voucher: a reserva
sai do Redis e vira uma linha em `users_vouchers`. Responde 201, com o voucher usado.

```http
POST /vouchers/use
{
  "user_id": "3f1c5e0a-2b3d-4c5e-8f90-123456789abc",
  "categories": ["electronics"],
  "code": "welcome10"
}
```

- **As mesmas regras da validação são reaplicadas.** O endpoint não confia em uma
  validação anterior: as cinco checagens rodam de novo antes de gravar. Elas vivem em
  `VoucherEligibility`, um colaborador que os dois casos de uso compartilham, então as
  regras não têm como divergir entre `/validate` e `/use`.
- **Validar antes não é obrigatório.** Quem nunca segurou o voucher pode usá-lo direto,
  desde que os limites permitam.
- **A reserva do próprio usuário é liberada**; as dos outros usuários continuam intactas.
- **Nada é gravado quando uma regra falha.**
- A partir daí a linha em `users_vouchers` passa a contar nos dois limites, `limit` e
  `user_limit`.

#### O limite é estrito

Um voucher de 1.000 usos não pode virar 1.001. Checar antes e gravar depois não garante
isso: duas requisições simultâneas na última unidade leem a mesma contagem, as duas passam
e as duas gravam.

Por isso a gravação e a checagem são uma operação só, dentro de uma transação:

```sql
BEGIN;
  SELECT 1 FROM vouchers WHERE uuid = $1 FOR UPDATE;  -- serializa os usos deste voucher
  SELECT count(*) FROM users_vouchers WHERE voucher_id = $1;
  -- recusa se já atingiu o limite, senão:
  INSERT INTO users_vouchers ...;
COMMIT;
```

O `FOR UPDATE` na linha do voucher faz cada uso do **mesmo** voucher esperar o anterior
terminar, então a contagem é lida sobre um estado que ninguém pode mudar até o commit.
Vouchers diferentes não disputam nada entre si.

Isso vive no `TypeOrmVoucherUsageRepository`, atrás do método de porta
`saveWithinLimits(usage, voucher)` — o caso de uso pede "grave respeitando estes limites",
sem saber que existe transação ou lock. Não existe caminho de escrita sem essa proteção.

A checagem que roda antes, em `VoucherEligibility`, continua valendo: ela dá o erro certo
rapidamente e leva as reservas em conta. A da transação é a autoritativa.

Há um teste e2e que dispara 25 requisições concorrentes contra um voucher de 5 usos e
exige exatamente 5 linhas gravadas. No cenário real, 1.200 requisições simultâneas contra
um voucher de 1.000 usos gravaram 1.000 linhas e devolveram 200 respostas 409.

---

## Testes

```bash
npm test          # unitários + arquitetura (não precisam de banco)
npm run test:e2e  # e2e contra o banco skeleton_v2_test
npm run test:cov  # cobertura
npm run lint
```

| Suíte               | O que cobre                                                             |
| ------------------- | ----------------------------------------------------------------------- |
| Unitários           | Entidades, value objects e casos de uso, sobre os adaptadores in-memory |
| `architecture.spec` | As regras de dependência entre camadas e módulos                        |
| `users.e2e`         | Criação, listagem e busca de usuários contra o Postgres                 |
| `vouchers.e2e`      | Listagem, as regras de validação, as reservas no Redis e o uso          |
| `swagger.e2e`       | O documento OpenAPI: rotas, tags, schemas e respostas de erro           |

Os unitários rodam sem infraestrutura porque toda porta tem um adaptador in-memory — é o
que o `InMemoryVoucherReservationRepository` faz pelas reservas. Os e2e usam Postgres e
Redis de verdade: aplicam as migrations no banco `skeleton_v2_test`, truncam as tabelas
entre os casos e limpam as chaves `vouchers:reservations:*` do Redis (índice `1`). O banco de teste é definido em
[vitest.config.e2e.ts](vitest.config.e2e.ts), que também desliga o paralelismo entre
arquivos, já que o banco é compartilhado.

---

## Scripts

| Script                      | O que faz                                 |
| --------------------------- | ----------------------------------------- |
| `npm run start:dev`         | Sobe em modo watch                        |
| `npm run start:prod`        | Roda o build de `dist`                    |
| `npm run build`             | Compila para `dist`                       |
| `npm run lint`              | oxlint com checagem de tipos              |
| `npm run format`            | Prettier em `src/` e `test/`              |
| `npm test`                  | Unitários + arquitetura                   |
| `npm run test:e2e`          | End-to-end contra o Postgres              |
| `npm run db:up` / `db:down` | Sobe/derruba o Postgres do docker-compose |
| `npm run migration:*`       | `run`, `revert`, `show`, `generate`       |

---

## Criando um novo módulo

1. Copie a estrutura de `src/modules/users` — é o módulo mais simples e completo.
2. Escreva primeiro o `domain`: entidade, value objects, erros e a porta do repositório.
3. Depois os casos de uso em `application`, recebendo as portas pelo construtor.
4. Implemente os adaptadores em `infrastructure` (TypeORM para produção, in-memory para
   os testes) e crie a migration correspondente, registrando-a no `migrations/index.ts`.
5. Exponha o controller em `presentation/http`, com os decorators do Swagger.
6. Ligue tudo no `*.module.ts` do módulo e importe-o no `AppModule`.

O teste de arquitetura passa a cobrir o módulo novo automaticamente.

---

## Limitações conhecidas

- **O Redis é obrigatório para validar vouchers.** Sem ele o endpoint de validação falha;
  as reservas não têm fallback para memória.
- **A reserva não garante a unidade.** Cada store é atômico por si — a transação no
  Postgres para os usos, o script Lua no Redis para as reservas — mas a checagem que soma
  os dois não é. Sob disputa pesada, um usuário sem reserva pode consumir uma unidade que
  outro segurava, e este último só descobre ao usar. O limite estrito nunca é violado; o
  que se perde é a promessa da reserva. Garantir isso de verdade exigiria exigir reserva
  ativa no `/use` e conferi-la dentro da mesma transação — ou seja, mover as reservas para
  o Postgres.
- **Sem validação de payload na borda.** Os decorators do Swagger são só documentação;
  quem rejeita entrada malformada é o domínio. Para validar na borda, instale
  `class-validator` e habilite o `ValidationPipe` global.
- **Sem autenticação.** O `user_id` chega no corpo da requisição e é confiado.
