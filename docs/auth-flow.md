# Flujo de autenticación

```text
LoginPage → AuthStore.login() → AuthApiService.login()
  → POST /api/auth/login → auth.routes.js → authController
  → authService → authRepository → PostgreSQL
  ← access JWT + usuario, refresh en cookie HttpOnly
```

`AuthStore` conserva el access token en memoria. Al arrancar, `POST /api/auth/refresh` rota la cookie y obtiene un JWT nuevo. El interceptor adjunta el JWT a peticiones protegidas e intenta una renovación si recibe 401. Logout revoca la familia de refresh y limpia el estado local. El backend verifica la firma, busca al usuario activo y aplica roles y propiedad por ruta. `authGuard` exige sesión; `roleGuard` protege `/dashboard`, y el servidor vuelve a comprobar permisos.

## Responsabilidades separadas

- **Auth**: registro/login/logout, firma y verificación JWT, rotación/revocación de
  refresh tokens, interceptor y guards. AuthStore mantiene la única copia del usuario
  de sesión y del access token en memoria; no guarda JWT en localStorage.
- **Users**: CRUD, búsqueda, rol y activación administrativos. `/api/users` conserva
  `requireAuth` + `requireRole('ADMIN')`. Angular usa `features/users/pages/admin-users.page.ts`,
  `UsersStore` y `UsersApiService`; la URL sigue siendo `/dashboard/users`.
- **Profile**: consulta y cambio del nombre visible propio mediante
  `GET/PATCH /api/profile/me`. `profile.routes/controller/service/repository/validator`
  reutiliza requireAuth y el mapper/repositorio de Users para consultar datos.
  El identificador siempre procede de req.user validado; el body admite exclusivamente
  displayName. Rol, email, contraseña, estado, promoterId e IDs ajenos se rechazan.

```text
/account → features/profile/pages/profile.page.ts
  → ProfileStore (carga/guardado/error/confirmación)
  → ProfileApiService → /api/profile/me
  → profileController → profileService → profileRepository → PostgreSQL
```

ProfileStore deriva su usuario de AuthStore: no mantiene una segunda copia.
Tras una respuesta correcta, `updateSessionUser` sincroniza únicamente el estado de
sesión en memoria. No llama a HTTP ni edita el perfil. Comprueba ID y versión de
sesión para descartar respuestas de antes de logout o de otro login, incluso del
mismo usuario. Los consumidores existentes (navbar y layout de cuenta) siguen
observando AuthStore. El navbar conserva su texto «Mi cuenta» y su aspecto actual.
Los errores de perfil ya no contaminan los errores de login.

`GET/PATCH /api/auth/me` se conserva como alias de compatibilidad montado en App:
se delega al mismo Router/Controller de Profile; Auth no contiene lógica de perfil.
Swagger marca el alias como deprecated y Postman incluye las rutas canónicas.
No hay migraciones ni cambios en cookies, expiración, JWT, roles o infraestructura.
La cookie de refresh mantiene HttpOnly, SameSite y el path `/api/auth` existente;
Profile usa el access token Bearer y el interceptor conserva la renovación ante 401.

Las pruebas cubren registro USER, rechazo de roles privilegiados, perfil propio y
campos protegidos, alias, JWT expirado/refresh/logout, acceso ADMIN y permisos PROMOTER
existentes. Angular comprueba guardado, doble envío, sincronización de sesión,
respuestas tardías, errores aislados y reintento Bearer tras un 401.
