# NOCTURNO — Seguridad de la sesión web

## Modelo de sesión

El frontend Angular **no almacena JWT, refresh tokens ni identificadores de sesión** en
`localStorage`, `sessionStorage` ni SignalStore. SignalStore conserva únicamente
el usuario mostrado y el token CSRF ligado a la sesión. El carrito mantiene un marcador
de idempotencia en sessionStorage; **no es una credencial**.

- `nocturno_access` en desarrollo HTTP: JWT de 15 minutos, `HttpOnly; SameSite=Lax; Path=/api`.
- `__Host-nocturno_access` en producción HTTPS: el mismo JWT, `HttpOnly; Secure; SameSite=Lax; Path=/`. El prefijo exige host-only (sin Domain) y Path=/.
- `nocturno_refresh` en desarrollo HTTP: cookie `HttpOnly; SameSite=Lax; Path=/api/auth`.
- `__Host-nocturno_refresh` en producción HTTPS: cookie `HttpOnly; Secure; SameSite=Lax; Path=/`, host-only. Las antiguas cookies de producción sin prefijo no son válidas: por seguridad, el usuario debe volver a iniciar sesión. El backend limpia la cookie anterior al autenticar. Se rota al renovar sesión; el backend almacena solo un hash HMAC en `refresh_tokens` de PostgreSQL, nunca el valor original.
- `POST /api/auth/login`, `register` y `refresh` establecen las cookies y responden solo `{data:{user,csrfToken}}`. La API **no devuelve tokens de autenticación en JSON**.
- `GET /api/auth/session` devuelve usuario y CSRF si la cookie de acceso sigue vigente. Angular lo usa en el bootstrap; si ha caducado, renueva mediante la cookie refresh.
- `POST /api/auth/logout` revoca la familia del refresh y borra ambas cookies. Los access JWT ya emitidos quedan invalidados por la comprobación de familia en PostgreSQL.
- Cambiar un rol o desactivar una cuenta revoca las sesiones de ese usuario en la misma transacción del cambio. Reactivar el usuario **no** restaura sesiones antiguas.

No existe un access token en el JavaScript de Angular. En producción el backend rechaza
la alternativa `Authorization: Bearer`; se conserva solo en el entorno de pruebas
y herramientas locales para fixtures anteriores.

## CSRF y XSS

Las mutaciones `POST/PUT/PATCH/DELETE` del API requieren `X-Nocturno-CSRF` cuando
viaja la cookie de acceso. El servidor genera el token mediante HMAC de la familia de
sesión y un secreto exclusivo del backend, y verifica su valor con comparación segura.
También se rechazan orígenes no autorizados y `Sec-Fetch-Site: cross-site`.
`login`, `register`, `refresh` y `logout` dependen de Origin y Fetch Metadata
para mantener su flujo de cookies; el webhook Stripe permanece fuera del middleware
CSRF porque se valida con su propia firma sobre el cuerpo raw.

**HttpOnly limita la extracción de credenciales vía XSS, pero un XSS activo todavía
puede efectuar operaciones como el usuario.** Mantener CSP, sanitización Angular,
validación Zod y permisos backend sigue siendo imprescindible.

`SameSite=Lax` permite el retorno de navegador desde el proveedor de pagos y
es defensa adicional; no sustituye el encabezado CSRF. Las respuestas privadas
con cookie de sesión llevan `Cache-Control: private, no-store`.

## Despliegue seguro

1. Servir frontend y API desde un mismo origen HTTPS usando un proxy inverso; no
   depender de un backend accesible con cookies `Secure` sobre HTTP.
2. Configurar `NODE_ENV=production`, `CORS_ORIGIN` y `FRONTEND_URL` con el origen
   público HTTPS real; proteger `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
   claves de PostgreSQL y Stripe únicamente en variables privadas.
3. Mantener CSP para Angular y Stripe, HSTS, controles de tasa adecuados para
   despliegue multinodo y monitorización de intentos sospechosos.
4. Probar login, recarga, refresh, caducidad, logout, cambio de rol, desactivación,
   retorno de Stripe, carrito e invalidación de códigos QR en un entorno aislado.
5. No ejecutar `db:seed`, `db:reset` ni pruebas destructivas contra la base
   comercial. Esta modificación **no añade migraciones SQL**.
6. Antes de producción, realizar revisión externa de seguridad, escaneo de
   dependencias y pruebas de penetración. No existe seguridad absoluta.

## Verificación rápida en navegador

En DevTools → Application → Cookies, ver las cookies de sesión con `HttpOnly`.
En Network, las respuestas de `/api/auth/login`, `/refresh` y `/session`
contienen `user` y `csrfToken`, **nunca** `accessToken` o `refreshToken`.
El inspector de red puede mostrar `Set-Cookie`: no compartir esa captura.
Una petición de escritura sin `X-Nocturno-CSRF` debe devolver HTTP 403.
