# Flujo de compra

```text
EventDetailPage → CartStore → CartApiService → POST /api/cart/items
CartPage → CheckoutPage → CheckoutStore → CheckoutApiService
  → POST /api/checkout + Idempotency-Key → checkout.routes.js
  → checkoutController → checkoutService → orderRepository → PostgreSQL
  → PaymentIntent Stripe → Payment Element Angular
  → webhook firmado → paymentService → paymentRepository → PostgreSQL
  → Order PAID + Tickets → Account / QR
```

El servidor calcula precios en céntimos desde `ticket_types`, bloquea stock con `SELECT FOR UPDATE` y suma `reserved` en una transacción. La clave de idempotencia evita duplicar el pedido y Stripe recibe otra clave estable por pedido. El webhook verifica firma, importe y moneda antes de mover `reserved` a `sold` y crear un ticket por unidad. Repetir el webhook no crea entradas nuevas. Las reservas vencen a los 30 minutos; el backend cancela PaymentIntents pendientes antes de devolver stock. Las entradas gratuitas se emiten sin Stripe.

Si llega `payment_intent.payment_failed`, el pago pasa a `FAILED` pero el pedido conserva `AWAITING_PAYMENT` hasta el vencimiento, de modo que el mismo intento pueda reintentarse. Un éxito posterior todavía puede completar el pedido. `charge.refunded` procesa reembolsos **completos**: pedido y pago pasan a `REFUNDED`, se invalidan las entradas y se devuelve el stock vendido. Repetir el webhook no repite estos cambios. Los reembolsos parciales quedan fuera del modelo de pedido v1 y no modifican el estado local.
