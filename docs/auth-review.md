# Revisión de autenticación y dashboard — 4 de noviembre de 2026

Partida: `dc97fe4`, rama de trabajo `codex/auth-cookie-security`.
Se conserva la arquitectura, comercio, galerías, mapa, Yomogan y los datos habituales.

## Checklist del encargo

| Requisito | Estado | Implementación y evidencia |
|---|---|---|
| 1. Cookies HttpOnly de servidor | Completado | `backend/src/auth/auth.controller.js`: access y refresh, paths/caducidades propios, Secure en producción. E2E inspecciona cookies reales. |
| 2. Angular no lee ni almacena JWT | Completado | `frontend/src/app/features/auth/store/auth.store.ts`, `services/auth-api.service.ts`: solo usuario y estados. No tokens JSON/Bearer. |
| 3. withCredentials centralizado | Completado | `frontend/src/app/features/auth/interceptors/auth.interceptor.ts`: solo nuestra API, sin fuga a terceros. |
| 4. cookie-parser | Completado | `backend/src/app.js`, `backend/package.json`: parser y `req.cookies`; también se rechazan cookies JSON malformadas para autenticación. |
| 5. Blacklist persistente | Completado | `backend/src/db/migrations/014_cookie_sessions_profile.sql`, `backend/src/auth/auth.repository.js`: PK/FK/índices, inserción idempotente y limpieza de expirados en logout. |
| 6. Rechazo de tokens revocados | Completado | `backend/test/cookie-auth.integration.test.js`: blacklist independiente y revocación de familia, reutilización y carrera refresh/logout. |
| 7. Roles comparados con PostgreSQL | Completado | `backend/src/auth/auth.service.js`, `auth.repository.js`: firma/claims/rol exacto/usuario activo/sesión vigente. Cambio de rol directo en DB cubierto. |
| 8. Auth/Profile/Users separados | Completado | `backend/src/auth/`, `services/profile.service.js`, `services/user.service.js`; wrappers heredados son reexports. Profile no administra roles. |
| 9. Pages y Components | Completado | `features/auth/pages/` coordinan AuthStore; `components/auth-form.component.ts` comparte formulario login/registro. ProfilePage coordina ProfileStore y ProfileForm. Avatar visual reutilizable. |
| 10. Guards para todos los roles | Completado | `frontend/src/app/features/auth/guards/auth.guard.ts`; tests Angular esperan bootstrap, conservan returnUrl y distinguen roles. E2E USER/PROMOTER/ADMIN y anónimo. |
| 11. Sesión tras F5 | Completado | `auth.store.ts`: bootstrap/refresh deduplicado; cookies se serializan en carreras. Navegador real verifica recarga y falta de access con refresh válido. |
| 12. Dashboard y perfiles | Completado según modelo | `features/users/pages/admin-users.page.ts`, `users.store.ts`, `backend/src/repositories/user.repository.js`: búsqueda, rol y activos/inactivos en SQL, edición y activación. No existe soft-delete de Users: no se inventa papelera; se conserva eliminación segura y desactivación. |
| 13. Avatar reactivo | Completado | `features/profile/store/profile.store.ts` sincroniza AuthStore; `shared/components/avatar.component.ts` y `layout/header.ts`. Nombre/avatar actualizados sin F5, persistencia y fallo de imagen verificados. |
| 14. Validación/integridad | Completado en alcance probado | Zod strict, allowlists, UUID, precios/stock/fechas y FK existentes conservados; URL HTTP/HTTPS sin credenciales, avatar HTTPS y longitud de password corregidos. `db:audit`: 0 errores, 0 advertencias, 243 constraints inspeccionadas en PG18 aislado. |
| 15. Seguridad y regresión | Completado localmente | 80 tests backend + 49 frontend, sin fallos/omisiones; check sintáctico/build OK; E2E cookies/perfil/roles/gestión. No equivale a pentest externo ni prueba de despliegue HTTPS. |
| 16. Funcionalidades anteriores | Completado en regresión | Suites existentes de eventos/slug/restore/eliminación, propiedad PROMOTER, checkout/stock/webhooks/tickets/QR/Yomogan mantenidas y adaptadas al contrato cookie. No se ha repetido compra Stripe externa ni descargado modelos. |

## Cambios reales

- JWT con jti UUID, sesión sid, rol DB y blacklist. Access y refresh exclusivamente cookies HttpOnly.
- CSRF en mutaciones con cabecera personalizada y validación de Origin/Fetch Metadata; Stripe raw firmado queda exento.
- Orden de bloqueos usuario → refresh para evitar que logout/rotación/cambio de rol dejen sesiones vivas por carreras.
- AuthStore sin credenciales, cola de operaciones de sesión, un refresh concurrente y un reintento HTTP como máximo.
- Perfil con avatar HTTPS persistido, estado compartido, iniciales/fallback, formularios visuales separados.
- Gestión de usuarios filtrada en SQL y contador coherente; prevención de doble envío y respuestas de listados obsoletos.
- JSON malformado 400, cuerpo excesivo 413, logs internos sin cuerpos/secretos; Zod/body-parser/qs actualizados dentro de rangos compatibles.
- OpenAPI, colección Postman y E2E existente de eliminación migrados a cookies/CSRF.

## Base de datos

Migration 014 aditiva, sin modificar las 001–013. El test de upgrade crea una base temporal a partir del
esquema anterior, añade historia comercial, migra y compara cada dato previo. La única columna nueva en
usuarios empieza a null. Repetir migraciones no modifica los datos. La FK CASCADE de blacklist elimina
solo metadatos de seguridad si se elimina un usuario sin dependencias; las FK comerciales siguen RESTRICT.

**La base habitual del usuario no se ha migrado, sembrado ni reinicializado.** Las pruebas se ejecutaron
con PostgreSQL 18.6 temporal, puerto 55441, y Node 24.21.0. El despliegue sobre la base habitual requiere
backup verificado, `npm run db:migrate` y `npm run db:audit`, siguiendo `auth-flow.md`.

## Resultados ejecutados

| Verificación | Resultado |
|---|---|
| Backend `npm test` | 80/80, 0 omitidas |
| Backend `npm run check` | Correcto |
| Frontend `npm test` | 49/49, 0 omitidas |
| Frontend `npm run build` | Correcto; avisos previos de presupuesto CSS Yomogan/CommonJS/optional chaining |
| Migraciones repetidas | Correcto, última 014 |
| Auditoría con dataset demo aislado | 0 errores / 0 advertencias |
| Browser headless independiente | HttpOnly, ausencia de Bearer/JWT en almacenamiento, F5, refresh, logout, avatar reactivo/fallback, tres roles, filtros y activación/desactivación |
| Responsive de Profile/Users | 390/768/1280 px sin desbordamiento de documento |
| Errores JS del E2E | 0 |
| `npm audit --omit=dev` backend | 0 vulnerabilidades conocidas |
| Revisión Git | `git diff --check` correcto, sin coincidencias de claves en archivos cambiados; .env ignorados |

## Limitaciones reales y entrega

- Quedan **dos avisos moderados de desarrollo** en la cadena nodemon/minimatch. El remedio automático
  sugerido por npm implica una regresión mayor de nodemon; no se fuerza un downgrade de la herramienta.
  No están en las dependencias de producción.
- No se ha desplegado HTTPS: Secure se prueba con configuración de producción en proceso separado;
  el E2E HTTP local comprueba HttpOnly/SameSite/paths y comportamiento de sesión.
- Dos pestañas que refresquen el mismo token simultáneamente fallan de forma segura (revocación de familia),
  pudiendo necesitar nuevo login. La cola frontend evita carreras dentro de una misma pestaña.
- Usuarios no tiene papelera/restauración lógica en el modelo. Activar una cuenta desactivada no revive
  credenciales revocadas; debe iniciar sesión otra vez.
- No hay compra Stripe real nueva ni prueba de IA externa en esta pasada: sí pasan sus regresiones locales.
- Entrega en la rama dedicada `codex/auth-cookie-security`, preparada para integrar los commits posteriores
  de main sin force push. La rama de la PR #4 se conserva: contiene una propuesta alternativa de cookies
  `__Host-` y CSRF ligado a sesión, que no se mezcla silenciosamente con este contrato validado. El resultado
  de Actions corresponde al SHA publicado y debe consultarse en GitHub. El `package-lock.json` suelto
  de la raíz, preexistente, se conserva sin añadir.
