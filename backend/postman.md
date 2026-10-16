# Probar Nocturno con Postman

Importa [`Nocturno.postman_collection.json`](Nocturno.postman_collection.json). La colección usa `baseUrl = http://localhost:3000` y guarda el access token tras login o registro. Postman conserva la cookie HttpOnly de refresh en su cookie jar.

Orden recomendado:

1. `POST /api/auth/register` o `POST /api/auth/login`.
2. `GET /api/events` con filtros; prueba `Events near Valencia` y `Nearby techno below 20 EUR`, y abre `/api/events/slug/:slug`. Para el radio se envían ambos números `latitude` y `longitude`; `municipality` sigue siendo un filtro independiente.
3. `GET /api/events/:eventId/ticket-types`, añade un tipo en `POST /api/cart/items` y consulta `GET /api/cart`.
4. `POST /api/checkout` con un UUID nuevo en `Idempotency-Key`. Repite la misma clave para comprobar que se reutiliza el pedido.
5. Si el precio es cero, `GET /api/orders/:id` muestra `PAID`. Si tiene precio, configura las claves Stripe test y confirma el PaymentIntent desde la página Angular. Stripe CLI puede reenviar el webhook firmado a `/api/stripe/webhook`.
6. `GET /api/orders`, `GET /api/tickets` y `GET /api/tickets/:id`. El check-in requiere ADMIN o el promotor del evento.

La colección contiene también todos los métodos documentados de dashboard, favoritos y operaciones de gestión, incluidos los alias heredados. La petición de webhook sirve como referencia: necesita una firma real de Stripe en `Stripe-Signature`; usa Stripe CLI para generarla en local. El backend procesa `payment_intent.succeeded`, `payment_intent.payment_failed` y reembolsos completos `charge.refunded`. Para detalles de todos los campos y respuestas abre `/api/docs`. Nunca pegues claves secretas de Stripe ni refresh tokens en la colección.
