# Publicación de NOCTURNO v1

El proyecto se distribuye para revisión de portfolio bajo [LICENSE](../LICENSE) (**All Rights Reserved**). El catálogo incluye locales reales documentados y eventos y ventas simulados de Nocturno; no existe afiliación con los locales. Consulta [fuentes y procedencia](demo-sources.md).

## Revisión de archivos públicos

- Publicar `backend/.env.example` y `.env.example` de la raíz; excluir todos los `.env` reales, logs, dependencias, builds, dumps, claves y certificados.
- La fotografía local `frontend/public/images/nocturno-hero.jpg` queda fuera del repositorio porque su procedencia no se pudo acreditar. La portada usa un fondo CSS.
- Las fotos de locales permanecen como enlaces externos con fuente documentada. Sus derechos y disponibilidad pertenecen a terceros; revisar cada licencia o permiso antes de empaquetar cualquier copia.
- [Las capturas previstas](screenshots/README.md) aún no existen. Incorporar solo capturas de la app real con datos personales y QR activos ocultos.

## Metadatos

| Campo | Valor |
| --- | --- |
| Repositorio | `nocturno` público |
| Descripción | `Nightlife discovery, ticketing and event operations with Angular, Express and PostgreSQL.` |
| Rama | `main` |
| Tag inicial | `v1.0.0` tras CI verde |
| Licencia | Proprietary — All Rights Reserved |

Topics previstos: `angular`, `typescript`, `nodejs`, `express`, `postgresql`, `ngrx-signals`, `stripe`, `ticketing`, `event-management`, `nightlife`, `full-stack`, `portfolio`.

## Verificaciones y límites

El workflow [`ci.yml`](../.github/workflows/ci.yml) usa PostgreSQL temporal y Node 24; aplica las migraciones reales 001–008, corre los tests y el build. El seed no es necesario en CI. Las compras de pago, fallos y refunds E2E esperan claves Stripe test y un webhook real. Docker runtime requiere daemon, y la geolocalización o lectura por cámara requieren dispositivo y permiso.

La vista social recomendada para GitHub: composición 1280 × 640, fondo negro, **NOCTURNO.** en marfil, acento rojo y una captura real de Discover o Event Detail, con el texto “Nightlife discovery & ticketing platform”. No generar una vista previa que aparente venta oficial de eventos ajenos.
