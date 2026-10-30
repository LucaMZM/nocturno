# Stripe Sandbox y flujo de compra

## Implementación conservada

```text
EventDetailPage → CartStore → CartApiService → POST /api/cart/items
CartPage → CheckoutPage → CheckoutStore → CheckoutApiService
  → POST /api/checkout + Idempotency-Key → checkout.routes.js
  → checkoutController → checkoutService → orderRepository → PostgreSQL
  → PaymentIntent Stripe → Payment Element Angular
  → webhook firmado → paymentService → paymentRepository → PostgreSQL
  → Order PAID + un Ticket/QR por unidad → Account
```

Se conserva PaymentIntents + Payment Element porque Nocturno ya controla pedidos,
precios, ventanas de venta y reservas. El planificador oficial propone este camino
cuando la aplicación necesita controlar su estado de checkout. Checkout Sessions es
la recomendación general para integraciones nuevas; migrar aquí no es necesario.
Se ha evaluado el SDK oficial de Node. Se mantiene el adaptador REST pequeño existente,
con timeout de 15 segundos, errores públicos saneados, claves de idempotencia y API
fijada en `2026-09-30.endive`. No se añaden dependencias a la aplicación.

### Garantías del backend

- Importes en céntimos calculados desde PostgreSQL, nunca desde el body del cliente.
- Bloqueos de carrito/eventos/stock y reserva transaccional durante 30 minutos.
- Una clave UUID por intento de checkout; misma clave → mismo pedido.
- Una clave Stripe estable por pedido y otra por reembolso completo.
- La creación/recuperación del PaymentIntent mantiene bloqueado el pedido hasta guardar
  su ID. No mantiene bloqueos de stock durante la petición de red.
- Antes de devolver el client secret verifica importe, moneda, metadata de pedido, ID,
  estado y modo test en desarrollo. El client secret solo va al comprador autenticado.
- Métodos dinámicos, sin `payment_method_types` hardcodeado; `allow_redirects=never`.
  Configura en el Dashboard del Sandbox los métodos apropiados para reservas de entradas.
  Esto no impide la autenticación 3D Secure de tarjetas.
- El webhook usa el **cuerpo raw** antes de `express.json`, firma HMAC-SHA256, comparación
  segura y tolerancia de cinco minutos. El tipo de evento, su estructura y modo se validan.
- `payment_intent.succeeded`: verifica pago/pedido/importe/moneda/metadata cuando existe,
  convierte reserved → sold y crea un Ticket con UUID/QR opaco por unidad. Es atómico e
  idempotente. Ni el navegador ni la página de retorno pueden declarar una venta pagada.
- `payment_intent.payment_failed`: FAILED conserva AWAITING_PAYMENT y su reserva para
  reintentar el mismo PaymentIntent. Un fallo tardío no degrada PAID o REFUNDED.
- `charge.refunded`: solo reembolso completo. Invalida todos los tickets, conserva el
  historial/snapshots y devuelve sold. Si llega antes de succeeded, cumple y revierte
  dentro de la misma transacción: los QR nunca quedan válidos entre ambas operaciones.
  Un succeeded posterior no revierte REFUNDED.
- ADMIN puede solicitar un reembolso completo. Se valida la respuesta de Stripe; el
  estado local espera el webhook. Repetir la solicitud reutiliza la idempotencia.
  Los pagos ficticios del seed no se envían a Stripe.
- Al vencer, consulta el PaymentIntent. Un éxito con webhook retrasado se reconcilia.
  Solo libera stock cuando no hay PaymentIntent o Stripe confirma `canceled`. Una
  cancelación incierta o un pago `processing` conserva la reserva: nunca se revende
  stock que todavía puede pagarse. Si el proveedor permanece inaccesible, requiere
  seguimiento operativo; no se declara automáticamente cobrado o cancelado.
- Pedidos gratuitos se confirman transaccionalmente sin depender de Stripe.

No hay reembolsos parciales en el modelo v1. No los solicites desde el Dashboard para
estas pruebas: un evento parcial no modifica el estado local; requiere conciliación
manual hasta completar el reembolso o adaptar explícitamente el modelo.

### Angular y seguridad del servidor web

CheckoutStore bloquea dobles envíos y conserva la clave al fallar la red. Solo la borra
al caducar el pedido, cambiar el carrito o cerrar sesión. Un marcador del propietario
permite conservar el intento al recargar y resolver la misma sesión; otra cuenta nunca
hereda la clave. Un intento guardado puede consultar su reserva aunque las últimas
unidades ya estén reservadas por ese mismo pedido; el backend decide si sigue siendo pagable.
Abrir un pedido histórico no borra la clave de otro checkout. El formulario espera al evento
`ready`, permite reintentar la carga y se destruye al navegar. El botón de pago y el
servicio también bloquean confirmaciones simultáneas. Los errores de tarjeta permanecen
en el checkout para reintentar. Tras éxito/processing se consulta el pedido del servidor.

La página de pedido elimina los parámetros Stripe del retorno con `replaceUrl`, permite
consultar el estado y refresca el carrito al confirmar PAID. Nginx registra `$uri` sin
query ni referrer, y Morgan sanea también el Referer, para no guardar client secrets. La CSP del **frontend Nginx** permite
Stripe.js, sus subdominios/frames, API, Stripe Network y Link, sin abrir `default-src`.
Helmet de Express protege la API; su excepción de Swagger sigue limitada a `/api/docs`.
El build mantiene la minificación pero desactiva `inlineCritical` para evitar el script
inline de carga CSS que la CSP estricta bloqueaba; los estilos se cargan desde su archivo.
Angular dev server es un servidor diferente: la CSP de Express no protege su HTML.
Nocturno no recibe ni almacena PAN, CVC o datos de tarjeta: los recoge Payment Element.

## Configuración local: Sandbox, nunca dinero real

Las tres variables están en `backend/.env` (ignorado por Git):

```dotenv
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

Copia `sk_test_…` y `pk_test_…` del **mismo Sandbox** en Stripe Dashboard. No uses claves
live ni las pegues en chat, commits o capturas. El contrato actual exige `sk_test_` en
desarrollo; una futura adopción de claves restringidas `rk_test_` debe revisarse y probar
sus permisos. `/api/config/payments` devuelve solo enabled, testMode y una clave pública
válida; un secreto pegado por error en el campo público nunca se devuelve.

Stripe CLI oficial está instalada mediante `@stripe/cli` 1.55.3. Si no está en PATH:

```sh
export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"
stripe version
stripe whoami --format json
```

Para autorizarla sin abrir automáticamente un navegador:

```sh
stripe login --non-interactive
stripe login --complete-device
```

Aprueba la URL/código que devuelve la CLI en el Sandbox correcto. No listes la
configuración ni compartas claves. En otra terminal, inicia el listener:

```sh
stripe listen --events payment_intent.succeeded,payment_intent.payment_failed,charge.refunded \
  --forward-to localhost:3000/api/stripe/webhook
```

La CLI muestra una firma `whsec_…` en tu terminal: cópiala exclusivamente a
`STRIPE_WEBHOOK_SECRET` de `backend/.env`, sin guardarla en logs. El secreto de un
endpoint del Dashboard no tiene por qué coincidir con el del listener local.

Arranque habitual, conservando tu PostgreSQL y sin reset/seed sobre datos habituales:

```sh
# PostgreSQL: iniciar tu instalación existente (Postgres.app en este Mac).
cd backend
npm start
# Otra terminal, desde la raíz del proyecto:
cd frontend
npm start
```

Comprueba `http://localhost:3000/api/config/payments`: enabled y testMode deben ser true.
La clave que pueda devolver debe empezar por pk_test_. Reinicia el backend si cambias .env.

## Compra en navegador y matriz de pruebas

Usa un evento de muestra futuro con stock y un usuario de desarrollo. Selecciona General
× 2; comprueba el total en carrito; prepara el pago y completa Payment Element.

| Caso | Datos oficiales de prueba / resultado esperado |
| --- | --- |
| Aprobación | `4242 4242 4242 4242`, fecha futura y CVC de prueba → PAID y dos QR distintos |
| Rechazo | `4000 0000 0000 0002` → error de tarjeta, ningún ticket y opción de reintento |
| 3DS | `4000 0025 0000 3155` → autenticación de prueba; completa o cancela la ventana |
| Reintento | Tras rechazo, usa la tarjeta aprobada; mismo pedido/PaymentIntent |
| Doble clic | Un solo intento en curso; un pedido y una emisión por unidad |
| Webhook repetido | Reenvía el mismo evento desde Dashboard/CLI; ningún ticket extra |
| Vencimiento | Fixture aislada vencida; cancelación confirmada y reserved liberado una sola vez |
| Refund completo | ADMIN → Payments → reembolsar → webhook → REFUNDED, QR inválidos, sold corregido |

El listener local no es un endpoint público de Stripe: para reenviar un evento al
listener, vuelve a enviar su payload con una firma actual en el entorno de pruebas.
`stripe events resend` requiere un endpoint de Dashboard registrado; no confundas
ese flujo con `stripe listen`. No falsees fechas ni stock del catálogo habitual para
probar vencimientos: utiliza una base/fixture aislada.

Las suites automatizadas distinguen claramente su frontera:

- `stripe-api.test.js`: transporte Stripe y firmas con mocks; sin llamadas de red reales.
- `stripe-sandbox.integration.test.js`: PostgreSQL y servicios reales, proveedor Stripe
  simulado. Cubre concurrencia, QR, refund fuera de orden y carreras de expiración.
- `checkout.integration.test.js`: webhook HTTP firmado, stock y tickets reales en PostgreSQL.
- `full-flow.integration.test.js`: entradas gratuitas y rechazo de importes del cliente.
- Frontend: claves de reintento, doble envío, ready, errores de red/tarjeta y desmontaje.

**Estas suites no prueban una compra real en Stripe.** La evidencia real de Sandbox
se registra por separado y depende de claves del Sandbox, listener autenticado, acceso
a Stripe y ejecución real del Payment Element/3DS. Una compra API aprobada tampoco
prueba por sí sola el recorrido visual de Payment Element o la autenticación 3DS.

## Verificación real del 29/10/2026

Sandbox autorizado: «Entorno de prueba de Mazmi». Se usaron credenciales test locales,
Stripe CLI autenticada y forwarding firmado a una API aislada; ningún pago live.
Los recorridos de navegador utilizaron Chromium headless separado del navegador personal,
Angular de producción y la CSP configurada para Nginx. PostgreSQL temporal 18.6:
la base habitual y su historial comercial no se modificaron. No se ejecutó seed/reset allí.
Las suites y la última verificación HTTP se ejecutaron explícitamente con Node 24.21.0;
los primeros recorridos usaron el Node 25.8.2 ya presente en el equipo.

| Prueba ejecutada realmente | Resultado |
| --- | --- |
| Discover → evento → 2 entradas → carrito → Payment Element | 28 €, importe recalculado aunque el cliente envía 1 céntimo |
| Doble envío de preparación y confirmación | Un pedido, un PaymentIntent y una confirmación |
| Pago aprobado + webhook firmado | PAID y 2 tickets con códigos distintos; QR visible |
| Tarjeta rechazada | FAILED, pedido pendiente y ningún ticket |
| Reintento con tarjeta aprobada | Mismo pedido/PaymentIntent, sin duplicar tickets |
| 3D Secure real | Simulador ACS de Stripe completado; webhook confirmó PAID |
| Cancelación del desafío 3DS | Feedback visible, botón de reintento habilitado, sin tickets |
| Recarga y últimas dos unidades reservadas | Reanuda el mismo intento incluso con stock libre cero |
| Duplicados | Dos eventos reales de Stripe reentregados cuatro veces, con firma actual, sin cambios extra |
| Vencimiento | PaymentIntent realmente canceled, pedido EXPIRED, stock liberado una vez y clave antigua rechazada |
| Refund ADMIN | Tres pagos de prueba reembolsados íntegramente, confirmados por webhooks y consulta a Stripe |
| QR reembolsados | Los seis códigos rechazados por el check-in backend |
| Permisos | USER no puede solicitar refund (403) |
| CSP / responsive | Cero violaciones; Payment Element y pedido sin overflow a 390/768/1280 px |

Cierre del entorno aislado: 3 pedidos REFUNDED, 4 intentos sin cobro cancelados/EXPIRED,
6 tickets REFUNDED, sold=0, reserved=0, revenue=0 y auditoría con 0 errores/0 avisos.
Los pedidos, pagos y snapshots de estas pruebas se conservaron en la base temporal.
Suites: 68 tests backend, 43 frontend, check de sintaxis y build de producción correctos.
La suite automatizada utiliza mocks de Stripe; la tabla anterior procede de las pruebas
reales adicionales. No se han publicado cambios ni ejecutado un nuevo CI remoto.

## Productos adicionales: evaluados, no activados

- **Payments:** producto actual; compra puntual de entradas con Payment Element.
- **Billing:** solo si en el futuro hay suscripciones/servicios recurrentes; no se usa.
- **Connect:** si Nocturno llega a distribuir dinero a organizadores independientes,
  habrá que definir titular de la venta, onboarding y responsabilidades. No se implementa.
- **Invoicing:** posible facturación futura; un Order actual no equivale a factura fiscal.
- **Tax:** requiere definir el negocio, las obligaciones y registros antes de calcular
  impuestos. No se activa automatic_tax ni se asume cobertura fiscal.

Fuentes oficiales consultadas: [PaymentIntents](https://docs.stripe.com/payments/payment-intents),
[ciclo de vida](https://docs.stripe.com/payments/paymentintents/lifecycle),
[webhooks](https://docs.stripe.com/webhooks), [refunds](https://docs.stripe.com/refunds),
[seguridad/CSP](https://docs.stripe.com/security/guide),
[tarjetas de prueba](https://docs.stripe.com/testing), [CLI](https://docs.stripe.com/cli).
