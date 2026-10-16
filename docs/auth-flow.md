# Flujo de autenticación

```text
LoginPage → AuthStore.login() → AuthApiService.login()
  → POST /api/auth/login → auth.routes.js → authController
  → authService → authRepository → PostgreSQL
  ← access JWT + usuario, refresh en cookie HttpOnly
```

`AuthStore` conserva el access token en memoria. Al arrancar, `POST /api/auth/refresh` rota la cookie y obtiene un JWT nuevo. El interceptor adjunta el JWT a peticiones protegidas e intenta una renovación si recibe 401. Logout revoca la familia de refresh y limpia el estado local. El backend verifica la firma, busca al usuario activo y aplica roles y propiedad por ruta. `authGuard` exige sesión; `roleGuard` protege `/dashboard`, y el servidor vuelve a comprobar permisos.
