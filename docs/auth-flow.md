# Auth, Profile y Users — cookies de servidor

## Contrato y seguridad

```text
LoginPage/RegisterPage → AuthForm (validación visual, output)
  → AuthStore → AuthApiService → HTTP con credentials
  → auth.routes → validación/middleware → controller → service → repository → PostgreSQL
  ← JSON { data: { user } } + dos Set-Cookie HttpOnly
```

`backend/src/auth/` es el módulo canónico. Los archivos antiguos `services/auth.service.js`,
`controllers/auth.controller.js`, etc. son reexports de compatibilidad, no otra implementación.

- `nocturno_access`: JWT HS256 de `jose`, HttpOnly, SameSite=Lax, Path=/api, duración del JWT.
- `nocturno_refresh`: token aleatorio de 48 bytes, HttpOnly, SameSite=Lax, Path=/api/auth,
  duración `JWT_REFRESH_EXPIRES_IN` (por defecto 30 días). PostgreSQL guarda un HMAC, nunca el token.
- Ambas cookies son host-only (sin Domain) y Secure cuando NODE_ENV=production. Producción requiere
  HTTPS y frontend/API en el mismo sitio, preferentemente proxy `/api`. Localhost HTTP sigue funcionando.
- Angular no recibe JWT en JSON ni lo almacena en memoria, localStorage, sessionStorage o cookies JS.
  El interceptor añade `withCredentials` solo a nuestra API; nunca a terceros.
- Claims obligatorios: UUID `sub`, `sid`, `jti`; `role`, `iat`, `exp`, issuer `nocturno-api`, audience
  `nocturno-web`. Firma, algoritmo, caducidad y tipos se comprueban antes de consultar PostgreSQL.
- Cada petición privada contrasta usuario activo, **rol actual igual al del JWT**, familia vigente y
  ausencia del jti en `revoked_access_tokens`. Los permisos de propiedad se mantienen en el backend.
- Logout registra jti/usuario/caducidad, revoca las familias identificadas por ambas cookies y las
  borra usando los mismos paths y flags. Un JWT sin caducar queda inutilizado. Inserción idempotente.
- Las entradas expiradas de blacklist se limpian al cerrar sesión; no se borran historiales comerciales.
- Refresh bloquea primero el usuario y después el token. Logout y cambios administrativos usan el mismo
  orden. Un refresh concurrente no puede dejar una sesión válida después del logout. La reutilización
  de un refresh rotado revoca la familia completa: dos pestañas que compitan pueden requerir login de nuevo.

## CSRF y CORS

Todas las operaciones mutadoras `/api` requieren **`X-Nocturno-CSRF: 1`**. Es una cabecera de intención,
no una credencial ni un secreto. Se rechazan Origin fuera de `frontendOrigins()` y Fetch Metadata
`cross-site`. Un formulario malicioso no puede enviar esa cabecera; un fetch ajeno requiere un preflight
que CORS no autoriza. No se acepta un origen comodín con credentials. Las solicitudes sin Origin
(CLI/Postman) también necesitan la cabecera. Mantener esta restricción al añadir endpoints.

El interceptor la añade a POST/PATCH/PUT/DELETE de nuestra API. Swagger y Postman están adaptados.
Es el patrón de cabecera personalizada para APIs JSON, no un double-submit sin firma.
Referencias: [OWASP CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html),
[Angular HttpClient](https://angular.dev/guide/http/making-requests).

`/api/stripe/webhook` se monta **antes** del parser/CSRF: conserva cuerpo raw y verificación de firma Stripe.
No se registran cookies, cabeceras de credenciales ni cuerpos en logs. Los errores internos se registran
por código/tipo; JSON malformado devuelve 400, payload excesivo 413.

## F5, concurrencia y guards

Al iniciar, `AuthStore.bootstrap()` deduplica refresh, recibe el usuario y resuelve `initialized`.
Los guards esperan esa resolución; el Navbar evita mostrar Entrar antes de conocer la sesión.
El store distingue inicialización, usuario autenticado, anónimo y error de conexión.
Los errores de sesión permiten reintento visible; un logout sin conexión avisa de que el servidor
no ha confirmado la revocación. No se promete logout remoto offline.

401 → un refresh compartido → un único reintento de la petición. Los endpoints de sesión no se
reintentan desde el interceptor. `sessionVersion` descarta respuestas anteriores; login, registro,
refresh y logout serializan las operaciones que escriben cookies. Logout bloquea refresh automático
hasta un nuevo login. No hay JWT que Angular pueda inspeccionar.

## Profile y avatar

`/account` → `ProfilePage` → `ProfileFormComponent` → `ProfileStore` → `ProfileApiService`
→ `GET/PATCH /api/profile/me` → controller → service → repository.
Solo se admiten `displayName` y `avatarUrl` (HTTPS sin credenciales, máximo 2048, nullable).
No hay upload de archivos ni descargas del servidor. IDs, rol, email, estado y contraseña se rechazan.
`GET/PATCH /api/auth/me` sigue como alias deprecated delegado a Profile.

`AuthStore.user` es la única copia del usuario; `ProfileStore` deriva ese signal y sincroniza las
respuestas comprobando ID y versión de sesión. `AvatarComponent` se reutiliza en perfil y Navbar,
con iniciales cuando falta o falla la imagen. Cambiar la URL actualiza ambos sin F5; refresh devuelve
el avatar persistido. La caché HTTP de una URL externa sin cambios depende del proveedor de la imagen:
para reemplazar su contenido se debe usar una URL versionada.

## Users y Dashboard

`/dashboard/users` → `AdminUsersPage` → `UsersStore` → `UsersApiService` → `/api/users`.
ADMIN consulta/edita nombre, correo, rol, promotor y estado. Búsqueda, rol y `active=all|true|false`
se aplican en SQL antes de paginar y contar. Protección de último ADMIN y autoexclusión conservada.
Cambiar rol o desactivar revoca sesiones; reactivar no recupera tokens antiguos.
PROMOTER solo gestiona su ámbito y USER no entra en administración. Sin acceso horizontal.

**Users no tiene soft-delete**: conserva desactivación y eliminación física solo sin historial comercial.
No se inventa papelera/restauración de usuarios. Events mantiene su propio soft-delete/restauración.

## Migración y puesta en marcha

`014_cookie_sessions_profile.sql` añade `users.avatar_url` nullable con CHECK, y
`revoked_access_tokens` con PK UUID, FK a users (CASCADE solo para metadatos de seguridad),
índices por usuario y caducidad. No cambia migraciones anteriores ni pedidos/pagos/tickets.
Antes de aplicarla a una base habitual, crear y verificar backup con pg_dump/pg_restore de la versión
adecuada. Después: `cd backend && npm run db:migrate && npm run db:audit`. No ejecutar reset ni seed.
Desplegar backend y frontend juntos: los clientes Bearer anteriores dejan de estar soportados.
Los access JWT antiguos sin jti se rechazan; un refresh válido emite el contrato nuevo.

## Verificación reproducible

- Backend: `npm test`, `npm run check`, `npm run db:audit` con DATABASE_URL de pruebas.
- Frontend: `npm test`, `npm run build`.
- `test/cookie-auth.integration.test.js`: cookies, CSRF, blacklist, rol DB, avatar, expiración,
  manipulación, reutilización, concurrencia, constraints y filtros de usuarios.
- `test/seed-integrity.integration.test.js`: upgrade de datos comerciales anteriores, preservación
  exacta de columnas previas y repetición segura de migrations. Usa una base temporal propia.
- `frontend/tools/test-auth-ui.mjs`: navegador independiente contra un backend **aislado y sembrado**;
  login, F5, avatar/placeholder, guards, filtros de usuarios, activación, logout, 390/768/1280 px.
  Requiere Playwright disponible; acepta PLAYWRIGHT_MODULE, PLAYWRIGHT_EXECUTABLE y AUTH_UI_ORIGIN.
  Solo el recurso gráfico HTTPS del avatar se intercepta como fixture; autenticación/API/DB son reales.
