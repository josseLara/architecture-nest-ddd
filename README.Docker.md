# Docker: Payments API + Prometheus + Grafana

Stack completo para ejecutar la API con observabilidad local:

| Servicio | Imagen | URL | Rol |
| --- | --- | --- | --- |
| `server` | build local (`Dockerfile`) | http://localhost:3000 | API NestJS + Swagger |
| `prometheus` | `prom/prometheus:v2.55.1` | http://localhost:9090 | Scrape y almacenamiento de métricas |
| `grafana` | `grafana/grafana:11.3.0` | http://localhost:3001 | Dashboards |

## Arranque

```bash
docker compose up --build -d
docker compose ps
```

La primera build compila TypeScript en una etapa separada y la imagen final solo contiene `dist/`, dependencias de producción y el usuario `node` (no root). El `server` tiene healthcheck; Prometheus espera a que esté sano antes de scrapear.

Logs:

```bash
docker compose logs -f server
docker compose logs -f prometheus
docker compose logs -f grafana
```

Detener:

```bash
docker compose down
```

Detener y borrar datos (pagos, métricas y dashboards persistidos):

```bash
docker compose down -v
```

## URLs

- API: http://localhost:3000/api
- Swagger: http://localhost:3000/api/docs
- Health: http://localhost:3000/api/health
- Métricas: http://localhost:3000/api/metrics
- Prometheus: http://localhost:9090
- Targets de Prometheus: http://localhost:9090/targets
- Grafana: http://localhost:3001

## Credenciales de Grafana

Si no existe `.env`, `compose.yaml` usa:

- Usuario: `admin`
- Contraseña: `admin`

`.env.example` trae `GRAFANA_ADMIN_PASSWORD=change-me`; definí una contraseña propia antes de levantar el stack:

```env
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=change-me
```

Después de cambiar la contraseña, recrear el contenedor:

```bash
docker compose up -d --force-recreate grafana
```

## Prometheus

Configuración: [`monitoring/prometheus/prometheus.yml`](monitoring/prometheus/prometheus.yml).

```yaml
scrape_configs:
  - job_name: payments-api
    metrics_path: /api/metrics
    static_configs:
      - targets:
          - server:3000
```

- `server` es el nombre del servicio en la red interna de Compose.
- El path incluye el prefijo global `/api`.
- Scrape cada 10 s; retención de 15 días en el volumen `prometheus-data`.

Consultas útiles en Prometheus:

```promql
payment_transactions_total
sum by (status) (rate(payment_transactions_total[5m]))
sum by (currency) (payment_transactions_total)
up{job="payments-api"}
```

> El stack **no define `API_KEY`** para que Prometheus pueda leer `/api/metrics` sin autenticación. Si activás `API_KEY`, el scrape devolverá 401 y habrá que adaptar la configuración o exponer métricas por otra vía.

## Grafana

Provisioning automático, sin importar nada a mano:

```
monitoring/grafana/
├── provisioning/
│   ├── datasources/prometheus.yml   # datasource Prometheus (UID: prometheus)
│   └── dashboards/payments-api.yml  # provider que lee /var/lib/grafana/dashboards
└── dashboards/
    └── payments-api.json            # dashboard "Payments API"
```

- Datasource por defecto: `Prometheus` → `http://prometheus:9090`.
- Dashboard en la carpeta **Payments**, UID `payments-api`.
- Paneles: totales, aprobadas, pendientes y rechazadas; tasa por estado y por moneda; estado del scrape (`up`) y memoria residente del proceso.
- El dashboard queda como home por defecto (`GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH`).
- Para editarlo desde la UI, el provider tiene `allowUiUpdates: true`; los cambios en el archivo JSON se recargan cada 30 s.

## Variables de entorno de Compose

Compose lee `.env` para interpolar puertos y credenciales. Estas variables no se pasan automáticamente al contenedor `server`; su entorno se define explícitamente en `compose.yaml`.

| Variable | Default | Uso |
| --- | --- | --- |
| `SERVER_PORT` | `3000` | Puerto host de la API |
| `PROMETHEUS_PORT` | `9090` | Puerto host de Prometheus |
| `GRAFANA_PORT` | `3001` | Puerto host de Grafana |
| `GRAFANA_ADMIN_USER` | `admin` | Usuario inicial de Grafana |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | Contraseña inicial de Grafana |

Si cambiás un puerto, por ejemplo `SERVER_PORT=3005`, la API queda en `http://localhost:3005/api`. El target interno de Prometheus sigue siendo `server:3000`, porque dentro de la red del contenedor el puerto no cambia.

## Volúmenes

| Volumen | Contenido |
| --- | --- |
| `payments-data` | `data/payments.json` del mock de pagos |
| `prometheus-data` | series temporales de Prometheus |
| `grafana-data` | usuarios, configuración y estado de Grafana |

El JSON de pagos vive dentro del volumen, no en el `./data` del host. Para inspeccionarlo:

```bash
docker compose exec server cat /usr/src/app/data/payments.json
```

## Producción vs. desarrollo

Este `compose.yaml` construye una imagen de **producción**:

- `npm ci` + `npm run build` en una etapa temporal.
- La imagen final solo copia `dist/` y dependencias de producción.
- El contenedor ejecuta `node dist/main.js` (sin watch).
- El código no se monta desde el host.

El compose de un proyecto de desarrollo suele verse así:

```yaml
server:
  build: .
  volumes:
    - .:/usr/src/app
    - /usr/src/app/node_modules
  command: npm run start:dev
```

Ese patrón es válido para hot reload, pero requiere que la imagen tenga todas las dependencias de desarrollo y el código montado. No es necesario para este stack: acá se prioriza una imagen inmutable y liviana. Si querés hot reload, podés agregar un `compose.dev.yaml` que monte `.:/usr/src/app` y ejecute `npm run start:dev`, sin reemplazar el compose de producción.

## Diagnóstico

```bash
# Estado y salud
docker compose ps
docker inspect --format '{{json .State.Health}}' $(docker compose ps -q server)

# ¿La API responde?
curl http://localhost:3000/api/health

# ¿Prometheus ve el target?
curl http://localhost:9090/api/v1/targets

# Últimas líneas de cada servicio
docker compose logs --tail=100 server prometheus grafana
```

Si Grafana no muestra el dashboard, revisar:

```bash
docker compose logs grafana | grep -i provisioning
```

Si un puerto está ocupado, cambiá `SERVER_PORT`, `PROMETHEUS_PORT` o `GRAFANA_PORT` en `.env` y ejecutá `docker compose up -d`.

### `Bind for 0.0.0.0:3000 failed: port is already allocated`

Otro proceso o contenedor está usando el puerto 3000. Es habitual si tenés un clúster `kind` local: sus contenedores `envoyproxy/envoy` publican 3000/3002.

Verificá el dueño:

```bash
docker ps --filter "publish=3000"
netstat -ano | findstr :3000
```

No hace falta detener kind; cambiá solo el puerto de la API en `.env`:

```env
SERVER_PORT=3005
```

Y recreá el stack:

```bash
docker compose up -d
```

La API queda en `http://localhost:3005/api`, Swagger en `http://localhost:3005/api/docs`. Prometheus y Grafana no cambian. El target interno de Prometheus sigue siendo `server:3000`, porque dentro del contenedor la API siempre escucha en 3000.

> Importante: si Docker Desktop no está iniciado, `docker compose` falla con `failed to connect to the docker API`. Iniciá Docker Desktop y volvé a ejecutar el comando.

### `npm ci` falla con “Missing: ... from lock file”

El `Dockerfile` usa `node:22-alpine`, que incluye npm 10.9.4. Si `package-lock.json` fue generado con npm 11, `npm ci` puede rechazar dependencias opcionales que npm 11 resolvió distinto. Regenerá el lock con la misma versión de npm que usa la imagen:

```bash
npx npm@10.9.4 install --package-lock-only
docker compose build --no-cache server
docker compose up -d
```

Con el lock actual esto ya está resuelto: `npm ci` pasa tanto con npm 10 como con npm 11. Si volvés a actualizar dependencias, repetí el proceso con npm 10 antes de reconstruir la imagen.
