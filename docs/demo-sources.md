# Fuentes del catálogo de desarrollo

Revisado el 8 de octubre de 2026. El seed contiene **20 locales reales y 56 eventos DEMO de Nocturno**. Además conserva **9 locales ficticios de pruebas internas** y **22 fichas históricas de eventos reales** como referencias inactivas de gestión. Total: **29 locales y 78 eventos**. Discover muestra principalmente eventos DEMO futuros en locales reales. Los nombres, direcciones y webs de esos locales son datos reales; las sesiones de Nocturno, sus promotores, fechas, precios, aforos e inventario son **simulaciones de portfolio**. No existe afiliación, organización conjunta ni venta oficial de entradas de esos locales. Las 22 fichas externas no tienen entradas de Nocturno y quedan fuera de Discover.

La migration `007_event_sources.sql` guarda las fuentes de las fichas de evento; `008_demo_catalogue_provenance.sql` marca `is_demo` en locales y eventos y añade `venues.source_url`. `009_event_images.sql` conserva los carteles existentes y añade una galería ordenada con URL, texto alternativo, página fuente y origen. `010_event_gallery_user_edits.sql` impide que un seed posterior sobrescriba galerías editadas manualmente, incluso si quedaron vacías. El detalle distingue evento simulado de ficha externa. Las fotografías de locales se enlazan desde las webs oficiales solo en desarrollo; no se descargan ni se empaquetan como assets propios. Su disponibilidad y derechos de uso para una publicación pública siguen pendientes de revisión. Cuando no hay una fotografía verificada, la tarjeta usa la composición gráfica propia de Nocturno.

## Locales reales

| Local | Dirección y web oficial | Coordenadas |
| --- | --- | --- |
| [Palau Alameda](https://palaualameda.com/contacto) | Calle Muñoz Seca 2, 46010 Valencia | 39.47262, -0.36283 ([OSM](https://mapcarta.com/N13720552201)) |
| [Marina Beach Club](https://marinabeachclub.com/contacto/) | Paseo de Neptuno, La Marina de Valencia, 46011 Valencia | 39.46295, -0.32164 ([OSM](https://mapcarta.com/es/W189304621)) |
| [Teatro Barceló](https://www.teatrobarcelo.com/contacto/) | Calle de Barceló 11, 28004 Madrid | 40.42705, -3.69973 ([OSM](https://mapcarta.com/es/W355513279)) |
| [Sala La Riviera](https://salariviera.com/) | Paseo Bajo de la Virgen del Puerto s/n, 28005 Madrid | 40.41299, -3.72213 ([OSM](https://mapcarta.com/es/W136005925)) |
| [Sala Apolo](https://sala-apolo.com/es/contacto) | Carrer Nou de la Rambla 107, 08004 Barcelona | 41.37439, 2.16956 ([OSM](https://mapcarta.com/es/N3072968504)) |
| [Sala Razzmatazz](https://www.salarazzmatazz.com/) | Carrer dels Almogàvers 122, 08018 Barcelona | 41.39759, 2.19125 ([OSM](https://mapcarta.com/es/W426162558)) |
| [La3 Club](https://la3clubvlc.com/) | Avenida Blasco Ibáñez 111, Valencia | Sin coordenada verificada |
| [Akuarela Playa](https://akuarelaplaya.es/web/contacto/) | Calle Eugenia Viñes 152, 46011 Valencia | Sin coordenada verificada |
| [Loco Club](https://lococlub.es/contacto/) | Calle Erudito Orellana 12, 46008 Valencia | 39.4712, -0.38705 ([OSM](https://mapcarta.com/es/N4663041889)) |
| [Barceló Valencia · Terraza 270º](https://www.barcelo.com/es-es/barcelo-valencia/) | Avenida de Francia 11, 46023 Valencia | Sin coordenada verificada |
| [Sala MON](https://www.monmadridoficial.com/) | Calle Hilarión Eslava 36, 28015 Madrid | 40.43584, -3.71647 ([OSM](https://mapcarta.com/N12699505301)) |
| [Sala Copérnico](https://www.salacopernico.es/) | Calle de Fernández de los Ríos 67, 28015 Madrid ([ticketing oficial](https://www.ticketmaster.es/venue/sala-copernico-madrid-billets/slcopermad/114)) | Sin coordenada verificada |
| [Ochoymedio Club](https://ochoymedioclub.com/contacto/) | Calle del Arenal 11, Madrid | Sin coordenada verificada |
| [Moog Club](https://moogbarcelona.com/es/contacto/) | Carrer de l’Arc del Teatre 3, 08002 Barcelona | Sin coordenada verificada |
| [Barceló Raval · Terraza 360º](https://www.barcelo.com/es-es/barcelo-raval/) | Rambla del Raval 17–21, 08001 Barcelona | Sin coordenada verificada |
| [Committee](https://www.smdgroup.club/es/redes-sociales/club/committee) | Carrer de Sant Vicent Màrtir 200, 46007 Valencia ([operador](https://www.smdgroup.club/es/redes-sociales/club/committee)) | Sin coordenada verificada |
| [Tulum Valencia](https://tulumvalencia.es/) | Avinguda de les Corts Valencianes 58, 46015 Valencia ([web oficial](https://tulumvalencia.es/)) | Sin coordenada verificada |
| [16 Toneladas](https://www.16toneladas.com/) | Carrer de Ricardo Micó 3, Valencia ([web oficial](https://www.16toneladas.com/)) | Sin coordenada verificada |
| [La Fábrica de Hielo](https://www.lafabricadehielo.net/donde-estamos/) | Calle José Ballester Gozalvo 37, 46011 Valencia ([web oficial](https://www.lafabricadehielo.net/donde-estamos/)) | Sin coordenada verificada |
| [Radio City Valencia](https://radiocityvalencia.es/) | Calle Santa Teresa 19, Valencia ([web oficial](https://radiocityvalencia.es/)) | Sin coordenada verificada |

Las coordenadas no verificadas se dejan `NULL`: no se muestran como puntos falsos en el mapa ni se usan en cálculos de distancia. Se pueden completar más adelante con una fuente cartográfica fiable. Actualmente hay 6 locales reales con coordenadas comprobadas; la experiencia de radio/distancia se demuestra con eventos de esos locales.

## Eventos DEMO de Nocturno

Los 35 nuevos eventos `d0000000-*` se reparten entre los locales reales de Valencia, Madrid y Barcelona. Sus fechas futuras son relativas al día de ejecución del seed para que la demo no caduque; los 21 eventos `40000000-*` conservan fixtures de checkout, histórico, inactivos y papelera. Los IDs fijos y `ON CONFLICT` permiten repetir `npm run db:seed` sin duplicar locales, eventos, tipos de entrada, pedidos ni tickets. Cada nuevo evento tiene tres tipos de entrada simulados (Early Bird, General y Last Call) con precio y stock en PostgreSQL. La foto principal, cuando existe, muestra **el local real** y nunca se presenta como cartel oficial del evento ficticio.

La fotografía de [Palau Alameda](https://palaualameda.com/) procede de su portada oficial (Àtic, Azza y La Gran Sala); [Marina Beach Club](https://marinabeachclub.com/) de su portada; [Sala La Riviera](https://salariviera.com/galeria/) de su galería; [Sala Apolo](https://www.sala-apolo.com/es/nosotros) de su página «Nosotros»; [Tulum Valencia](https://tulumvalencia.es/) de su portada y [La Fábrica de Hielo](https://www.lafabricadehielo.net/galeria/) de su galería. Para Sala Razzmatazz se añaden dos fotografías del local: [fachada de Zarateman, CC0](https://commons.wikimedia.org/wiki/File:Barcelona_-_Sala_Razzmatazz.jpg) y [salida de Gabriel Vidal, dominio público](https://commons.wikimedia.org/wiki/File:Salida_de_Razzmatazz.JPG). Ambas URL de imagen devolvieron `image/jpeg` el 21 de octubre de 2026. `image_source_url` guarda la página de origen por evento. Son enlaces remotos de desarrollo, no assets redistribuidos por Nocturno.

Las galerías reutilizan esas fuentes: la primera imagen sigue siendo la portada compatible y, cuando existen, se añaden fotografías distintas del mismo local. De los 20 locales reales, siete tienen alguna URL fotográfica en el seed y seis tienen varias; los demás eventos conservan su fotografía única o su cartel gráfico local. Entre los 56 eventos DEMO, 40 tienen una imagen, cinco tienen dos y once tienen tres. Las 22 fichas de referencia históricas conservan la imagen documentada del evento y, cuando hay fotos del local, las añaden como tales. En la revisión local del 21 de octubre de 2026, las 34 URL remotas anteriores respondieron con HTTP 2xx y tipo `image/*`; eso comprueba disponibilidad en ese momento, **no** autorización de uso, licencia ni disponibilidad futura. Las dos fotos nuevas de Razzmatazz tienen licencia CC0/dominio público indicada arriba. Nocturno no afirma poseer fotografías ajenas ni tener relación comercial con los locales o eventos.

El recuento por cada evento se conserva en [el inventario de galerías](demo-gallery-inventory.md).

El pedido local `60000000-0000-4000-8000-000000000100` es un **fixture**, no una transacción Stripe: General × 2, 28 €, dos tickets individuales válidos y dos QR independientes para ensayar check-in. Los otros siete pedidos anteriores siguen en el histórico. La compra Stripe test E2E requiere claves reales de prueba y webhook firmado.

## Fichas reales de referencia (inactivas)

La [agenda oficial de Palau Alameda](https://palaualameda.com/eventos) documenta fecha y franja horaria de 16 fichas del seed: Santos Gamberros (8 oct), Noche Àtic (9 oct), Tardeo Àtic (9 oct), Danzza (9 oct), Noche Azza (9 oct), AfterYou (10 oct), Vicente Buitrón (10 oct), Bamboleo (11 oct), ELENCO HOUSE con Bastian Bux (11 oct), CAFÉ VALENCIA (16 oct), DERALI COFFEE PARTY (18 oct), Distrito 10 (23 oct), ELYELLA (24 oct), Vicente Buitrón (24 oct), Bamboleo (25 oct) e Iñigo Quintero (6 nov). [Danzza](https://palaualameda.com/azza/danzza) y [Noche Azza](https://palaualameda.com/azza) tienen también páginas propias. Las imágenes usadas se observaron en las tarjetas de las fechas concretas de la agenda oficial.

Las otras seis fichas proceden de [Spain Reggaetón Mafia by Linkers](https://site.fourvenues.com/es/sala-la-riviera/events/spain-reggaeton-mafia-by-linkers-09-10-2026-6PK3) y [JUANKIS · URJC PARTY](https://site.fourvenues.com/es/nova-night-life@sala-la-riviera/events/8DER), ambos en Sala La Riviera con fecha y horario publicados por la plataforma de entradas, y de páginas de [Antichurros / Somoslas](https://www.sala-apolo.com/es/evento/antichurros-somoslas-20261011-7638), [Bresh Halloween](https://www.sala-apolo.com/es/evento/bresh-club20261028-7587), [Milkshake](https://sala-apolo.com/es/evento/el-desliz-de-la-milkshake-20261015-7590) y [Antichurros Halloween](https://www.sala-apolo.com/es/evento/antichurros-20261025-7640) de Sala Apolo. Para las dos fichas de La Riviera se usan fotografías del [sitio oficial del local](https://salariviera.com/galeria/), no carteles atribuidos falsamente al evento.

El seed no atribuye precios, aforos, códigos de vestimenta ni promotores a estos eventos si la fuente no los especifica. Un evento pasado pasa a `FINISHED` al repetir el seed. Estas fichas quedan `is_active = FALSE` para que Discover no parezca vender eventos oficiales ajenos. La programación es temporal y requiere revisión periódica; Nocturno no consulta las webs externas en tiempo de ejecución, salvo la carga opcional de sus imágenes.

## Geolocalización

`Cerca de mí` solicita permiso solo tras el clic y no guarda coordenadas del usuario en PostgreSQL. Fuera de `localhost`, el navegador necesita **HTTPS** para ofrecer `navigator.geolocation`. Si el permiso se deniega, el navegador no lo soporta o expira la solicitud, queda disponible la selección manual de ciudad.
