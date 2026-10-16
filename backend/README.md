# API de Nocturno

Express 5, PostgreSQL, SQL parametrizado y validación Zod. Ejecuta `npm run db:migrate`, `npm run db:seed` y `npm run dev` tras configurar `backend/.env`. La API escucha en `http://localhost:3000`; Swagger está en `/api/docs` y OpenAPI en `/api/openapi.json`.

La ruta valida y autoriza, el controller convierte la petición en una respuesta HTTP, el service aplica las reglas y el repository consulta PostgreSQL. `003_identity_commerce.sql` amplía el esquema sin modificar las migraciones 001 y 002.

Las rutas principales son `/api/auth`, `/api/events`, `/api/venues`, `/api/promoters`, `/api/me/favorites`, `/api/cart`, `/api/checkout`, `/api/orders`, `/api/payments`, `/api/tickets` y `/api/dashboard`. Las escrituras requieren JWT y el rol adecuado. `/api/stripe/webhook` verifica la firma sobre el cuerpo bruto. Los errores tienen la forma `{ "error": { "code": "...", "message": "...", "details": null } }`.

`npm test` ejecuta pruebas unitarias y pruebas con PostgreSQL si `DATABASE_URL` está configurada. `npm run check` verifica sintaxis. El seed incluye cuentas ficticias para desarrollo, documentadas en el [README principal](../README.md). No ejecutes `db:reset` si quieres conservar datos: elimina las tablas de Nocturno.
