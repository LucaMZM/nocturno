# Carrito y ampliación incremental del catálogo

Diez propuestas ficticias independientes de Nocturno: ocho en Valencia, una en Madrid y
una en Barcelona. Se reutilizan locales ya documentados, sin inventar direcciones ni
atribuir programación, artistas o acuerdos oficiales. No se añaden locales de L'Olleria
u Ontinyent sin haber contrastado un espacio apropiado. `is_demo=true` permanece en BD;
el detalle y el checkout aclaran que no se emiten entradas oficiales.

## Importación segura

Desde `backend`, con la configuración habitual ya existente:

```sh
npm run db:audit
npm run db:catalogue:import
```

La importación requiere el esquema actual y los locales del catálogo existente.
No ejecuta migraciones, seed general ni reset. Antes de escribir, comprueba integridad,
crea un backup custom completo y verifica su lectura con `pg_restore`. En macOS usa
Postgres.app 18; en Linux necesita los clientes PostgreSQL compatibles en PATH.
El backup se guarda en `.local-backups/` con directorio privado y archivo 0600, ignorado
por Git. Las credenciales solo se pasan mediante el entorno de los procesos hijos.

Todo el lote es una transacción con bloqueo de importación. Inserta diez Events con UUID
reservados `f1000000-…-000001` a `…-000010`, veinte Ticket Types y doce referencias de
imagen. Las fechas se calculan en Europe/Madrid solo al insertar, entre mañana y las
próximas tres semanas. Repetir el comando no cambia fechas, imágenes, stock ni galerías;
tampoco restaura borrados. Un local inexistente o conflicto de slug revierte el lote.
No modifica eventos anteriores, cuentas, promotores, pedidos, pagos ni tickets emitidos.

**Base habitual comprobada el 27/10/2026:** auditoría con un error
`TICKET_USED_WITHOUT_TIMESTAMP` y cuatro avisos `CART_ITEM_UNAVAILABLE`.
No se ha aplicado el lote ni se han reparado datos históricos. Primero debe resolverse
el error con un criterio explícito sobre el historial. La importación queda preparada.
No se ha ejecutado `db:seed` sobre esa base.

## Imágenes y procedencia

Se añaden cuatro fotografías ilustrativas distintas de Unsplash, mediante URLs públicas
estables, sin descargar assets ni insinuar que son fotos de estos eventos/locales:

| Fotógrafo | Página de la fotografía | Propuesta |
| --- | --- | --- |
| @dialfoto | [Crowd dancing](https://unsplash.com/photos/crowd-dancing-in-a-nightclub-iaVIEnRNkxY) | Gravedad Cero |
| Scarlett Alt | [Crowd at a concert](https://unsplash.com/photos/a-crowd-of-people-at-a-concert-QOajY0MNp8Y) | Perreo a Contraluz |
| Nathan Collier | [Band on stage](https://unsplash.com/photos/band-on-stage-with-red-lights-NqyORrt3njs) | Guitarras en Órbita |
| Keido wvtvnvbe | [DJ mixing music](https://unsplash.com/photos/dj-mixing-music-with-colorful-lights-980HYjxdT-U) | House de Medianoche |

Sus páginas las identifican como gratuitas bajo la [licencia Unsplash](https://unsplash.com/license).
El crédito y enlace quedan en `event_images.source_url` y en la galería. Los textos
alternativos indican que son ilustrativas, sin retratar el evento ni el local.

Otras ocho fotografías son referencias ya utilizadas y documentadas de los mismos
locales: [Palau Alameda](https://palaualameda.com/),
[Marina Beach Club](https://marinabeachclub.com/),
[La Fábrica de Hielo](https://www.lafabricadehielo.net/galeria/),
[Tulum](https://tulumvalencia.es/), [La Riviera](https://salariviera.com/galeria/),
[Sala Apolo](https://www.sala-apolo.com/es/nosotros).
Se reutilizan exclusivamente para propuestas situadas en ese mismo local. Se enlazan
como material de referencia de desarrollo; no se descargan ni se declaran propiedad de
Nocturno o libres de derechos. Véase también [demo-sources.md](demo-sources.md).
Solo dos eventos tienen una segunda vista legítima del local. No se fabrican galerías.
Las doce URLs respondieron HTTP 200 con contenido de imagen al preparar el lote;
las fuentes remotas pueden cambiar y existe fallback visual en tarjetas, carrito y galería.

## Carrito y preferencias

La navbar utiliza el CartStore global y cuenta unidades, no líneas. Carga al iniciar sesión;
no repite GET en cada navegación. La pantalla actualiza la disponibilidad al entrar.
La separación Auth/Users/Profile no cambia. Al cambiar de usuario se conserva el reset
existente, y el Store descarta respuestas tardías. Una carga antigua no pisa una mutación.

El backend mantiene el precio, stock, fecha de fin y ventana de venta como autoridad.
`GET /api/cart` añade `imageUrl`, `purchasable` y `unavailableReason` sin eliminar líneas
caducadas. El carrito explica cómo retirarlas o reducir cantidad y bloquea continuar.
El checkout vuelve a comprobar la selección y muestra pago no disponible sin configurar
Stripe. No se cambia la lógica de PaymentIntents, webhooks o reembolsos.
