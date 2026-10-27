# Payments API — NestJS + Arquitectura Hexagonal + DDD

API funcional de pagos (fintech) construida con NestJS 11 y TypeScript, organizada por capas y con dependencias apuntando siempre hacia el dominio. Incluye:

- Agregado `Payment` con máquina de estados (`pending → approved | rejected`).
- Value Objects `Money` (unidades mínimas) y `PaymentId` (UUID v4).
- Puertos `PaymentRepository` y `PaymentMetrics`.
- Adaptador de persistencia JSON atómico (`data/payments.json`).
- Métricas Prometheus: `payment_transactions_total{status,currency}`.
- Documentación interactiva Swagger/OpenAPI en `/api/docs`.
- Validación global, CORS, prefijo `/api`, health check y filtro de errores uniforme.
- 40 tests unitarios de dominio y persistencia + 15 tests e2e del flujo HTTP y de Swagger.

## Stack

| Pieza | Versión |
| --- | --- |
| NestJS | 11 |
| TypeScript | 5.7 |
| `@nestjs/config` | 4.x (CommonJS) |
| `@nestjs/swagger` + `swagger-ui-express` | 11.x / 5.x |
| `class-validator` / `class-transformer` | validación de entrada |
| `@willsoto/nestjs-prometheus` + `prom-client` | métricas |
| Jest + Supertest | tests unitarios y e2e |

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│ Infraestructura                                             │
│ controllers · PaymentMapper · InMemoryPaymentRepository     │
│ PaymentsModule (wiring / DI)                                │
└───────────────────────────┬─────────────────────────────────┘
                            │ implementa los puertos
┌───────────────────────────▼─────────────────────────────────┐
│ Aplicación                                                  │
│ CreatePaymentHandler · ApprovePaymentHandler                │
│ RejectPaymentHandler · GetPaymentHandler                    │
│ ListPaymentsHandler · DTOs · PaymentMetrics (puerto)        │
└───────────────────────────┬─────────────────────────────────┘
                            │ depende de
┌───────────────────────────▼─────────────────────────────────┐
│ Dominio (TypeScript puro, sin NestJS ni ORM)                │
│ Payment · Money · PaymentId · PaymentRepository · errores   │
└─────────────────────────────────────────────────────────────┘
```

Regla de dependencia: **infraestructura → aplicación → dominio**. El dominio no conoce HTTP, NestJS, Prometheus ni el formato JSON.

### Estructura

```
src/
├── common/
│   ├── decorators/public.decorator.ts
│   ├── filters/all-exceptions.filter.ts
│   ├── guards/api-key.guard.ts
│   ├── interceptors/logging.interceptor.ts
│   └── swagger/error-response.dto.ts
├── config/
│   ├── configuration.ts
│   └── swagger.config.ts
├── metrics/
│   ├── metrics.module.ts
│   └── metrics.service.ts
├── modules/payments/
│   ├── domain/
│   │   ├── entities/payment.entity.ts (+ payment.entity.spec.ts)
│   │   ├── value-objects/money.vo.ts (+ spec)
│   │   ├── value-objects/payment-id.vo.ts (+ spec)
│   │   ├── repositories/payment.repository.ts
│   │   └── errors/*.ts
│   ├── application/
│   │   ├── commands/
│   │   │   ├── create-payment.command.ts / create-payment.handler.ts
│   │   │   ├── approve-payment.command.ts / approve-payment.handler.ts
│   │   │   └── reject-payment.command.ts / reject-payment.handler.ts
│   │   ├── queries/
│   │   │   ├── get-payment.query.ts / get-payment.handler.ts
│   │   │   └── list-payments.query.ts / list-payments.handler.ts
│   │   ├── dtos/
│   │   │   ├── create-payment.dto.ts
│   │   │   ├── reject-payment.dto.ts
│   │   │   ├── list-payments-query.dto.ts
│   │   │   ├── payment-response.dto.ts
│   │   │   └── string-transformers.ts
│   │   ├── ports/payment-metrics.port.ts
│   │   └── errors/application.error.ts / payment-not-found.error.ts
│   ├── infrastructure/
│   │   ├── controllers/payments.controller.ts
│   │   ├── persistence/in-memory-payment.repository.ts
│   │   └── mappers/payment.mapper.ts
│   └── payments.module.ts
├── app.controller.ts        # GET /api/health
├── app.module.ts
└── main.ts
data/
└── payments.json            # persistencia mock
test/
└── app.e2e-spec.ts
```

`payments.module.ts` es el composition root del módulo: es el único lugar que conoce las implementaciones concretas y las ata a los tokens del dominio/aplicación.

## Decisiones de diseño

### Dinero sin errores de coma flotante

`Money` guarda **unidades mínimas enteras** (centavos). El límite HTTP acepta decimales (`150.75`) y el caso de uso los convierte una sola vez:

```ts
Money.fromDecimal(150.75, 'usd'); // 15075 minor units, USD
Money.fromMinorUnits(15075, 'USD');
```

La persistencia guarda `amount: 15075`. Las respuestas HTTP exponen `amount: 150.75` para comodidad del cliente. `fromDecimal` rechaza más de dos decimales en lugar de redondear silenciosamente.

> Limitación conocida: se asume una moneda con 2 decimales. Para JPY (0) o KWD (3) habría que incorporar la tabla de exponentes ISO 4217 al Value Object.

### Entidad rica

`Payment.approve()` y `Payment.reject()` validan la transición; `rehydrate()` reconstruye desde persistencia **revalidando todas las invariantes** (fechas, coherencia estado/fechas, importe positivo). Un pago `approved` sin `approvedAt`, o `pending` con datos de rechazo, no puede existir.

### Puertos y tokens

```ts
// domain
export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');

// application
export const PAYMENT_METRICS = Symbol('PAYMENT_METRICS');
```

- `PaymentRepository` vive en el dominio porque expresa una necesidad del negocio.
- `PaymentMetrics` vive en aplicación porque es una salida técnica del caso de uso. `MetricsService` la implementa estructuralmente y se enlaza con `useExisting`.
- Los casos de uso no importan Prometheus.

### Persistencia JSON

`InMemoryPaymentRepository`:

1. Carga `data/payments.json` en memoria al iniciar (`OnModuleInit`) y crea el archivo si no existe.
2. Serializa todas las escrituras con una cola de promesas.
3. Escribe en un archivo temporal y hace `rename` atómico, evitando JSON corruptos.
4. Valida unicidad de `reference` dentro de la sección crítica.
5. Falla al arrancar si el archivo no contiene un array JSON válido.

Es un mock de **un solo proceso**. No usar con varias instancias/replicas.

### Métricas

`MetricsService` incrementa el contador después de persistir el pago:

| Evento | Labels |
| --- | --- |
| Crear pago | `status="pending"`, `currency="USD"` |
| Aprobar | `status="approved"`, `currency="USD"` |
| Rechazar | `status="rejected"`, `currency="EUR"` |

El fallo al registrar una métrica se loguea pero no rompe la operación de pago (la observabilidad no debe revertir negocio ya persistido).

### Errores de dominio → HTTP

El dominio lanza errores con un `code` de negocio; `AllExceptionsFilter` los traduce:

| Código | HTTP |
| --- | --- |
| `INVALID_MONEY`, `INVALID_PAYMENT_ID`, `INVALID_PAYMENT` | 400 |
| `PAYMENT_NOT_FOUND` | 404 |
| `PAYMENT_REFERENCE_ALREADY_EXISTS` | 409 |
| `INVALID_PAYMENT_STATE_TRANSITION` | 409 |
| `VALIDATION_ERROR` (class-validator) | 400 |

Respuesta uniforme:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "code": "INVALID_PAYMENT_STATE_TRANSITION",
  "message": "Payment \"...\" cannot be approved while its status is \"approved\"",
  "path": "/api/payments/.../approve",
  "timestamp": "2026-10-26T20:45:12.745Z"
}
```

## Puesta en marcha

```bash
npm install
cp .env.example .env      # Windows: Copy-Item .env.example .env
npm run start:dev
```

- API: `http://localhost:3000/api`
- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI JSON: `http://localhost:3000/api/docs-json`
- Health: `http://localhost:3000/api/health`
- Métricas: `http://localhost:3000/api/metrics`

Sin `.env`, la configuración usa valores por defecto (`PORT=3000`, `NODE_ENV=development`, `data/payments.json`).

## Docker + observabilidad

El `compose.yaml` levanta la API, Prometheus y Grafana con provisioning automático:

```bash
docker compose up --build -d
docker compose ps
```

| Servicio | URL |
| --- | --- |
| API / Swagger | http://localhost:3000/api · http://localhost:3000/api/docs |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 · `admin` / `admin` por defecto, o `GRAFANA_ADMIN_PASSWORD` |

- Scrape de Prometheus: `server:3000/api/metrics`, job `payments-api`.
- Dashboard provisionado: **Payments API**, carpeta **Payments**, datasource **Prometheus**.
- Puertos y credenciales se configuran en `.env` (`SERVER_PORT`, `PROMETHEUS_PORT`, `GRAFANA_PORT`, `GRAFANA_ADMIN_PASSWORD`).
- Guía completa, volúmenes y diagnóstico: [README.Docker.md](README.Docker.md).

### Variables de entorno

| Variable | Default | Descripción |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test` o `production`; otro valor aborta el arranque |
| `PORT` | `3000` | Puerto HTTP (1–65535) |
| `API_PREFIX` | `api` | Prefijo global sin barras |
| `CORS_ORIGINS` | vacío | Lista separada por comas; vacío o `*` refleja el origen de la petición |
| `API_KEY` | vacío | Si se define, exige `x-api-key` en rutas no `@Public` (incluye `/api/metrics`) |
| `PAYMENTS_DATA_FILE` | `data/payments.json` | Ruta absoluta o relativa al cwd |

## Endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/payments` | Crea un pago en `pending` (201) |
| `GET` | `/api/payments` | Lista con filtros y paginación |
| `GET` | `/api/payments/:id` | Obtiene un pago |
| `POST` | `/api/payments/:id/approve` | Aprueba un pago `pending` |
| `POST` | `/api/payments/:id/reject` | Rechaza un pago `pending` con motivo |
| `GET` | `/api/health` | Health check público |
| `GET` | `/api/metrics` | Métricas Prometheus |
| `GET` | `/api/docs` | Swagger UI interactiva |
| `GET` | `/api/docs-json` | Documento OpenAPI 3 crudo |

Filtros de listado: `status` (`pending|approved|rejected`), `currency` (ISO 4217), `customerId`, `page` (≥1), `limit` (1–100). Orden: más reciente primero.

## Documentación Swagger

Con el servidor levantado:

- **Swagger UI:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- **OpenAPI JSON:** [http://localhost:3000/api/docs-json](http://localhost:3000/api/docs-json)

La documentación se genera automáticamente desde los decoradores de los DTOs y controllers:

- Schemas de request con descripciones, ejemplos, mínimos/máximos, patrones y campos requeridos.
- Schemas de response (`PaymentResponseDto`, `PaginatedPaymentsResponseDto`) y el enum `PaymentStatus`.
- Todos los códigos de respuesta por endpoint (`201`, `200`, `400`, `401`, `404`, `409`, `500`) con el schema `ErrorResponseDto`.
- Botón **Authorize** para `x-api-key`: usalo solo si definiste `API_KEY`; si no, los endpoints funcionan sin autenticación.
- Las rutas ya incluyen el prefijo `/api`, y el servidor OpenAPI es relativo, por lo que **Try it out** funciona igual en local o detrás de un proxy/dominio.

La configuración del documento y de la UI está centralizada en `src/config/swagger.config.ts`. El endpoint `/api/metrics` se documenta manualmente porque su controller pertenece a `@willsoto/nestjs-prometheus` y no se puede anotar con `@ApiOperation`.

### Crear

```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "reference": "PAY-2026-0001",
    "customerId": "customer-123",
    "amount": 150.75,
    "currency": "USD",
    "description": "Suscripción anual"
  }'
```

```json
{
  "id": "65e23d30-b548-4955-8e8f-e24d3a650bd8",
  "reference": "PAY-2026-0001",
  "customerId": "customer-123",
  "amount": 150.75,
  "currency": "USD",
  "status": "pending",
  "description": "Suscripción anual",
  "createdAt": "2026-10-26T20:45:05.299Z",
  "updatedAt": "2026-10-26T20:45:05.299Z"
}
```

`reference` es única: repetirla devuelve `409 PAYMENT_REFERENCE_ALREADY_EXISTS`. El límite es 3–64 caracteres alfanuméricos, `-` o `_`.

### Aprobar / rechazar

```bash
curl -X POST http://localhost:3000/api/payments/{id}/approve

curl -X POST http://localhost:3000/api/payments/{id}/reject \
  -H "Content-Type: application/json" \
  -d '{ "reason": "Sospecha de fraude" }'
```

Solo un pago `pending` puede transicionar. Un segundo `approve` devuelve `409`.

### Listar

```bash
curl "http://localhost:3000/api/payments?status=approved&currency=USD&page=1&limit=10"
```

```json
{
  "data": [ { "id": "...", "status": "approved", "amount": 150.75, "currency": "USD" } ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

### Métricas

```bash
curl http://localhost:3000/api/metrics
```

```
# HELP payment_transactions_total Total number of payment transactions grouped by status and currency
# TYPE payment_transactions_total counter
payment_transactions_total{status="pending",currency="USD",service="payments-api"} 1
payment_transactions_total{status="approved",currency="USD",service="payments-api"} 1
```

## Formato de `data/payments.json`

```json
[
  {
    "id": "65e23d30-b548-4955-8e8f-e24d3a650bd8",
    "reference": "PAY-2026-0001",
    "customerId": "customer-123",
    "amount": 15075,
    "currency": "USD",
    "status": "approved",
    "description": "Suscripción anual",
    "createdAt": "2026-10-26T20:45:05.299Z",
    "updatedAt": "2026-10-26T20:45:05.359Z",
    "approvedAt": "2026-10-26T20:45:05.359Z",
    "rejectedAt": null,
    "rejectionReason": null
  }
]
```

`PaymentMapper` es el único punto que conoce esta estructura plana. Migrar a SQL/NoSQL implica reemplazar el mapper y el repositorio, no el dominio ni los casos de uso.

El cargador tolera un BOM UTF-8 (habitual al guardar con editores de Windows) y archivos vacíos. Si el contenido es JSON inválido, el arranque falla con un error explícito en lugar de iniciar con datos corruptos.

## Tests

```bash
npm test              # dominio + persistencia (40 tests)
npm run test:e2e      # flujo HTTP + Swagger/OpenAPI (15 tests)
npm run lint
npm run build
```

Los e2e usan `data/payments.e2e.json` y lo eliminan al terminar; no tocan `data/payments.json`.

## Cambiar el mock por una base de datos

1. Crear `infrastructure/persistence/postgres-payment.repository.ts` que implemente `PaymentRepository`.
2. Crear su propio mapper/ORM entity; mantener `PaymentMapper` o reemplazarlo.
3. Crear un índice único sobre `reference` (la unicidad es contrato del puerto).
4. En `PaymentsModule`, cambiar solo el provider:

```ts
{
  provide: PAYMENT_REPOSITORY,
  useClass: PostgresPaymentRepository,
}
```

Los handlers, DTOs, controlador y dominio no cambian. Para transacciones reales, `save` debe participar de la unidad de trabajo correspondiente.

## Solución de problemas

### `npm run start:dev` queda en “Found 0 errors. Watching for file changes.”

Ese mensaje solo indica que TypeScript terminó de compilar. Si después no aparecen los logs de Nest, el arranque falló. Desde ahora el bootstrap no usa `bufferLogs`, así que la causa se imprime en consola.

Causas habituales:

1. **JSON inválido o con BOM.** `data/payments.json` debe ser UTF-8 sin BOM. El repositorio ya tolera BOM y archivos vacíos, pero un JSON malformado sigue abortando el arranque con un mensaje explícito.
2. **Puerto ocupado.** Si aparece `EADDRINUSE`, cerrá la instancia anterior o arrancá en otro puerto:

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# u otro puerto
$env:PORT=3001; npm run start:dev
```

3. **Error de configuración.** `NODE_ENV` solo acepta `development`, `test` o `production`; un valor distinto aborta el arranque con el detalle.

Para ver el error sin modo watch:

```bash
npm run start
# o directamente el build:
npm run build
node dist/main
```

## Notas

- `src/app.controller.ts` solo expone el health check público; puede eliminarse si el proyecto ya tiene uno.
- El bootstrap no usa `bufferLogs`: así cualquier error de arranque (JSON corrupto, puerto ocupado, configuración inválida) se muestra de inmediato en la consola.
- `@nestjs/config` se fijó en 4.x porque la 12.x es ESM-only y Jest con Node 22 no la carga en CommonJS.
- `@nestjs/swagger` se fijó en 11.4.7 porque la 12.x exige Nest 12. Las anotaciones viven en los DTOs y controllers (borde HTTP); el dominio sigue sin depender de Swagger.
- El guard `ApiKeyGuard` es opt-in: sin `API_KEY` no hay autenticación. En producción conviene JWT/OAuth2 y una política de autorización por cliente.
- El contador usa el estado resultante (`pending` al crear, `approved`/`rejected` al ejecutar), de modo que las creaciones sean observables antes de su resolución.
