import { fileURLToPath } from 'node:url';
import { getPool, closePool } from '../config/db.js';
import { migrate } from './migrate.js';
import { hashPassword } from '../utils/password.js';
import { env } from '../config/env.js';

// Fixed UUIDs make the development catalogue safe to seed repeatedly.
const id = (group, index) => `${group}0000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const venues = [
  ['Sala Umbral', 'CLUB', 'Valencia', 'Valencia', 'Ruzafa', 'Carrer de Sueca 24', 39.459200, -0.375500, 280, '46006'],
  ['Azotea del Carmen', 'ROOFTOP', 'Valencia', 'Valencia', 'El Carmen', 'Carrer dels Cavallers 31', 39.476200, -0.378600, 150, '46001'],
  ['Muelle de Sal', 'CONCERT_HALL', 'Valencia', 'Valencia', 'El Cabanyal', 'Carrer de la Reina 105', 39.465700, -0.329500, 420, '46011'],
  ['Club Medianoche', 'CLUB', 'Madrid', 'Madrid', 'Malasaña', 'Calle del Pez 18', 40.425500, -3.706100, 300, '28004'],
  ['La Nave Sur', 'CONCERT_HALL', 'Madrid', 'Madrid', 'Arganzuela', 'Paseo de las Delicias 71', 40.397800, -3.695600, 550, '28045'],
  ['Cielo de Atocha', 'ROOFTOP', 'Madrid', 'Madrid', 'Atocha', 'Calle de Atocha 117', 40.409900, -3.693700, 160, '28012'],
  ['Llum del Born', 'BAR', 'Barcelona', 'Barcelona', 'El Born', 'Carrer de la Princesa 19', 41.385100, 2.181200, 140, '08003'],
  ['Fábrica del Mar', 'CLUB', 'Barcelona', 'Barcelona', 'Poblenou', 'Carrer de Pere IV 167', 41.405700, 2.197800, 390, '08018'],
  ['Mirador Paral·lel', 'CONCERT_HALL', 'Barcelona', 'Barcelona', 'Poble-sec', 'Avinguda del Paral·lel 83', 41.373600, 2.165600, 460, '08004'],
];
const promoters = [
  ['Órbita Sessions', 'orbita@nocturno.test'],
  ['Bajo Cero Colectivo', 'bajocero@nocturno.test'],
  ['Brisa Cultural', 'brisa@nocturno.test'],
  ['Nexo Nocturno', 'nexo@nocturno.test'],
];
const events = [
  ['Pulso en Ruzafa', 0, 1, 'CLUB', ['TECHNO','HOUSE'], ['UNDERGROUND'], 'STREETWEAR', 14, 'PUBLISHED'],
  ['Atardecer de Azotea', 1, 2, 'ROOFTOP', ['HOUSE','POP'], ['CHILL','ELEGANT'], 'SMART_CASUAL', 19, 'PUBLISHED'],
  ['Ritmo del Puerto', 2, 0, 'CONCERT', ['LATIN','REGGAETON'], ['COMMERCIAL'], 'CASUAL', 16, 'PUBLISHED'],
  ['La Hora Índigo', 0, 3, 'CLUB', ['INDIE','POP'], ['ALTERNATIVE'], 'CASUAL', 18, 'PUBLISHED'],
  ['Jazz bajo la Luna', 2, 2, 'JAZZ_CLUB', ['JAZZ','SOUL'], ['ELEGANT','CHILL'], 'SMART_CASUAL', 22, 'PUBLISHED'],
  ['Fuerza Marina', 2, 1, 'FESTIVAL', ['HARDGROOVE','TECHNO'], ['UNDERGROUND'], 'STREETWEAR', 28, 'PUBLISHED'],
  ['Vinilos y Neón', 1, 0, 'ROOFTOP', ['HOUSE','SOUL'], ['CHILL'], 'CASUAL', 12, 'PUBLISHED'],
  ['Noche de la Plaza', 3, 1, 'CLUB', ['TECHNO','HARD_TECHNO'], ['UNDERGROUND'], 'STREETWEAR', 17, 'PUBLISHED'],
  ['Directo en la Nave', 4, 3, 'CONCERT', ['ROCK','LIVE'], ['ALTERNATIVE'], 'CASUAL', 24, 'PUBLISHED'],
  ['Cielo en Violeta', 5, 2, 'ROOFTOP', ['POP','HOUSE'], ['ELEGANT'], 'ELEGANT', 26, 'PUBLISHED'],
  ['Baila Malasaña', 3, 0, 'CLUB', ['REGGAETON','LATIN'], ['COMMERCIAL','INTERNATIONAL'], 'SMART_CASUAL', 20, 'PUBLISHED'],
  ['Sesión Atlántica', 4, 1, 'LIVE_SESSION', ['INDIE','LIVE'], ['ALTERNATIVE'], 'CASUAL', 15, 'PUBLISHED'],
  ['Amanecer en Atocha', 5, 3, 'AFTER', ['TECH_HOUSE','EDM'], ['UNIVERSITY'], 'STREETWEAR', 13, 'SOLD_OUT'],
  ['Alma del Born', 6, 2, 'PUB', ['JAZZ','SOUL'], ['CHILL'], 'CASUAL', 11, 'PUBLISHED'],
  ['Circuito Poblenou', 7, 1, 'RAVE', ['TECHNO','HARDGROOVE'], ['UNDERGROUND','INTERNATIONAL'], 'STREETWEAR', 21, 'PUBLISHED'],
  ['Ecos del Paral·lel', 8, 3, 'CONCERT', ['ROCK','INDIE'], ['ALTERNATIVE'], 'CASUAL', 23, 'PUBLISHED'],
  ['Fuego de Medianoche', 7, 0, 'CLUB', ['LATIN','REGGAETON'], ['COMMERCIAL'], 'SMART_CASUAL', 18, 'PUBLISHED'],
  ['Brisa en la Rambla', 6, 2, 'LIVE_SESSION', ['POP','LIVE'], ['CHILL','UNIVERSITY'], 'NO_DRESS_CODE', 9, 'PUBLISHED'],
  ['Frecuencia Cobalto', 8, 1, 'FESTIVAL', ['EDM','TECH_HOUSE'], ['INTERNATIONAL'], 'CASUAL', 35, 'PUBLISHED'],
  ['Ensayo de Invierno', 4, 3, 'CONCERT', ['TRAP','HIP_HOP'], ['ALTERNATIVE'], 'STREETWEAR', 16, 'DRAFT'],
  ['Encuentro en la Marina', 2, 0, 'BEACH_CLUB', ['HOUSE','EDM'], ['CHILL'], 'CASUAL', 27, 'CANCELLED'],
];
// Real venue metadata is sourced from the venue or its operator (docs/demo-sources.md).
// A missing coordinate remains NULL; the map and radius filters must never invent one.
const verifiedVenues = [
  ['Palau Alameda','CONCERT_HALL','Valencia','Valencia','Calle Muñoz Seca 2','46010',39.47262,-0.36283,'https://palaualameda.com/'],
  ['Marina Beach Club','BEACH_CLUB','Valencia','Valencia','Paseo de Neptuno, La Marina de Valencia','46011',39.46295,-0.32164,'https://marinabeachclub.com/'],
  ['Teatro Barceló','CLUB','Madrid','Madrid','Calle de Barceló 11','28004',40.42705,-3.69973,'https://www.teatrobarcelo.com/'],
  ['Sala La Riviera','CONCERT_HALL','Madrid','Madrid','Paseo Bajo de la Virgen del Puerto s/n','28005',40.41299,-3.72213,'https://salariviera.com/'],
  ['Sala Apolo','CONCERT_HALL','Barcelona','Barcelona','Carrer Nou de la Rambla 107','08004',41.37439,2.16956,'https://www.sala-apolo.com/'],
  ['Sala Razzmatazz','CONCERT_HALL','Barcelona','Barcelona','Carrer dels Almogàvers 122','08018',41.39759,2.19125,'https://www.salarazzmatazz.com/'],
  ['La3 Club','CLUB','Valencia','Valencia','Avenida Blasco Ibáñez 111',null,null,null,'https://la3clubvlc.com/'],
  ['Akuarela Playa','BEACH_CLUB','Valencia','Valencia','Calle Eugenia Viñes 152','46011',null,null,'https://akuarelaplaya.es/web/inicio/'],
  ['Loco Club','CONCERT_HALL','Valencia','Valencia','Calle Erudito Orellana 12','46008',39.4712,-0.38705,'https://lococlub.es/'],
  ['Barceló Valencia · Terraza 270º','ROOFTOP','Valencia','Valencia','Avenida de Francia 11','46023',null,null,'https://www.barcelo.com/es-es/barcelo-valencia/'],
  ['Sala MON','CLUB','Madrid','Madrid','Calle Hilarión Eslava 36','28015',40.43584,-3.71647,'https://www.monmadridoficial.com/'],
  ['Sala Copérnico','CONCERT_HALL','Madrid','Madrid','Calle de Fernández de los Ríos 67','28015',null,null,'https://www.salacopernico.es/'],
  ['Ochoymedio Club','CLUB','Madrid','Madrid','Calle del Arenal 11',null,null,null,'https://ochoymedioclub.com/'],
  ['Moog Club','CLUB','Barcelona','Barcelona','Carrer de l’Arc del Teatre 3','08002',null,null,'https://moogbarcelona.com/'],
  ['Barceló Raval · Terraza 360º','ROOFTOP','Barcelona','Barcelona','Rambla del Raval 17-21','08001',null,null,'https://www.barcelo.com/es-es/barcelo-raval/'],
  ['Committee','CLUB','Valencia','Valencia','Carrer de Sant Vicent Màrtir 200','46007',null,null,null,'https://www.smdgroup.club/es/redes-sociales/club/committee'],
  ['Tulum Valencia','CLUB','Valencia','Valencia','Avinguda de les Corts Valencianes 58','46015',null,null,'https://tulumvalencia.es/'],
  ['16 Toneladas','CONCERT_HALL','Valencia','Valencia','Carrer de Ricardo Micó 3',null,null,null,'https://www.16toneladas.com/'],
  ['La Fábrica de Hielo','CONCERT_HALL','Valencia','Valencia','Calle José Ballester Gozalvo 37','46011',null,null,'https://www.lafabricadehielo.net/'],
  ['Radio City Valencia','BAR','Valencia','Valencia','Calle Santa Teresa 19',null,null,null,'https://radiocityvalencia.es/'],
];
// Remote photos stay on official venue servers for this local demo. No media is packaged.
const venuePhotos = {
  0: [
    ['https://palaualameda.com/wp-content/uploads/2025/08/palau-alameda-azza-medium.jpg','https://palaualameda.com/'],
    ['https://palaualameda.com/wp-content/uploads/2025/08/palau-alameda-atic-medium.jpg','https://palaualameda.com/'],
    ['https://palaualameda.com/wp-content/uploads/2025/08/conciertos-y-tributos-en-palau-alameda.jpg','https://palaualameda.com/'],
  ],
  1: [
    ['https://marinabeachclub.com/wp-content/uploads/2025/02/BEACHCLUB.jpeg','https://marinabeachclub.com/'],
    ['https://marinabeachclub.com/wp-content/uploads/2026/08/75428B17-7D38-4F2C-95AE-D7E1D4069B9F.jpeg','https://marinabeachclub.com/'],
  ],
  3: [
    ['https://salariviera.com/wp-content/uploads/2023/08/DSC05217-1-scaled-1-400x516.jpg','https://salariviera.com/galeria/'],
    ['https://salariviera.com/wp-content/uploads/2023/08/DSC05215-scaled-1-400x516.jpg','https://salariviera.com/galeria/'],
    ['https://salariviera.com/wp-content/uploads/2023/08/DSC05213-scaled-1-400x516.jpg','https://salariviera.com/galeria/'],
  ],
  4: [['https://www.sala-apolo.com/uploads/media/default/0001/01/thumb_319_default_wide.jpeg','https://www.sala-apolo.com/es/nosotros']],
  16: [
    ['https://tulumvalencia.es/wp-content/uploads/2024/09/06_10_2023-TULUM-10-1-1-scaled-1.jpg','https://tulumvalencia.es/'],
    ['https://tulumvalencia.es/wp-content/uploads/2024/09/Terraza-Tulum-1-1.png','https://tulumvalencia.es/'],
    ['https://tulumvalencia.es/wp-content/uploads/2024/09/TULUM.-pedroecastelo.-23.12.02-19-1-scaled-1.jpg','https://tulumvalencia.es/'],
  ],
  18: [
    ['https://www.lafabricadehielo.net/wp-content/uploads/2016/03/sala21_A-520x347.jpg','https://www.lafabricadehielo.net/galeria/'],
    ['https://www.lafabricadehielo.net/wp-content/uploads/2016/03/sala21_b-520x347.jpg','https://www.lafabricadehielo.net/galeria/'],
    ['https://www.lafabricadehielo.net/wp-content/uploads/2016/03/sala21_c-520x347.jpg','https://www.lafabricadehielo.net/galeria/'],
  ],
};
// Older externally published events are kept as inactive reference records. Their source URLs
// document the research; Nocturno never offers synthetic tickets for somebody else's event.
const verifiedEvents = [
  { title:'Santos Gamberros. EXOPLANETAS. Tributo a Arde Bogotá+Izal+Viva Suecia', venue:0,
    start:'2026-10-08T19:00:00+02:00', end:'2026-10-08T23:30:00+02:00', type:'CONCERT', genres:['ROCK','LIVE'],
    description:'Concierto y tributos en La Gran Sala de Palau Alameda. Apertura de puertas a las 19:00; inicio del concierto a las 21:00.',
    source:'https://palaualameda.com/agenda-de-conciertos', image:'https://palaualameda.com/uploads/fourvenues_la_gran_sala_e429b2e366_c6eb9d9c32.png?v=2026-09-29T11%3A07%3A07.010Z-20260609-2' },
  { title:'Noche Àtic · 9 de octubre', venue:0,
    start:'2026-10-09T23:00:00+02:00', end:'2026-10-10T02:30:00+02:00', type:'ROOFTOP', genres:[],
    description:'Sesión Noche Àtic en Palau Alameda. Programación y horario publicados por el local.',
    source:'https://palaualameda.com/noche-ocio-valencia', image:'https://palaualameda.com/uploads/fourvenues_atic_86a96ee98a_8c8a2b31a2.jpg?v=2026-06-10T11%3A36%3A39.487Z-20260609-2' },
  { title:'Spain Reggaetón Mafia by Linkers', venue:3,
    start:'2026-10-09T00:30:00+02:00', end:'2026-10-09T06:00:00+02:00', type:'CLUB', genres:['REGGAETON'],
    description:'Fiesta de reggaetón en Sala La Riviera. Fecha y horario publicados en la página de entradas del evento.',
    source:'https://site.fourvenues.com/es/sala-la-riviera/events/spain-reggaeton-mafia-by-linkers-09-10-2026-6PK3', image:'https://salariviera.com/wp-content/uploads/2023/08/DSC05217-1-scaled-1-400x516.jpg' },
  { title:'JUANKIS · URJC PARTY', venue:3,
    start:'2026-10-02T00:30:00+02:00', end:'2026-10-02T06:00:00+02:00', type:'CLUB', genres:[],
    description:'Fiesta JUANKIS de NOVA Night Life en Sala La Riviera. Fecha y horario publicados por la plataforma de entradas.',
    source:'https://site.fourvenues.com/es/nova-night-life@sala-la-riviera/events/8DER', image:'https://salariviera.com/wp-content/uploads/2023/08/DSC05215-scaled-1-400x516.jpg' },
  { title:'Antichurros - Somoslas', venue:4,
    start:'2026-10-11T16:00:00+02:00', end:'2026-10-12T05:00:00+02:00', type:'CLUB', genres:['EDM'],
    description:'Antichurros y Somoslas en Sala Apolo. La sala publica el inicio a las 16:00 y el final a las 05:00.',
    source:'https://www.sala-apolo.com/es/evento/antichurros-somoslas-20261011-7638', image:'https://www.sala-apolo.com/uploads/media/default/0001/13/thumb_12753_default_wide.jpeg' },
  { title:'BRESH CLUB: Edición Especial Halloween', venue:4,
    start:'2026-10-28T23:59:00+01:00', end:'2026-10-29T05:00:00+01:00', type:'CLUB', genres:['REGGAETON','POP'],
    description:'Edición especial de Halloween de Bresh Club en Sala Apolo. La selección anunciada incluye reggaetón y pop.',
    source:'https://www.sala-apolo.com/es/evento/bresh-club20261028-7587', image:'https://www.sala-apolo.com/uploads/media/default/0001/13/thumb_12610_default_wide.jpeg' },
  { title:'Tardeo en Àtic · 9 de octubre', venue:0,
    start:'2026-10-09T16:30:00+02:00', end:'2026-10-09T21:00:00+02:00', type:'ROOFTOP', genres:[],
    description:'Tardeo en Àtic, en la terraza de Palau Alameda. Horario publicado por el local.',
    source:'https://palaualameda.com/eventos', image:'https://palaualameda.com/uploads/fourvenues_atic_97e79f5e0f_47789fceef.jpg?v=2026-06-10T11%3A36%3A40.732Z-20260609-2' },
  { title:'Danzza · 9 de octubre', venue:0,
    start:'2026-10-09T19:30:00+02:00', end:'2026-10-09T22:30:00+02:00', type:'CLUB', genres:[],
    description:'Tardeo Danzza en Azza Palau Alameda. Sesión anunciada con DJ Santi Trillo.',
    source:'https://palaualameda.com/azza/danzza', image:'https://palaualameda.com/uploads/fourvenues_tardeo_azza_e3d8192b91_43c7d5516c.png?v=2026-08-27T09%3A18%3A30.999Z-20260609-2' },
  { title:'Noche Azza · 9 de octubre', venue:0,
    start:'2026-10-09T23:30:00+02:00', end:'2026-10-10T04:00:00+02:00', type:'CLUB', genres:[],
    description:'Sesión Noche Azza en Palau Alameda, anunciada en la programación oficial del local.',
    source:'https://palaualameda.com/azza', image:'https://palaualameda.com/uploads/fourvenues_azza_bdcd42493f_2487069be1.jpeg?v=2026-07-16T11%3A07%3A05.662Z-20260609-2' },
  { title:'AfterYou · 10 de octubre', venue:0,
    start:'2026-10-10T16:30:00+02:00', end:'2026-10-10T23:30:00+02:00', type:'CLUB', genres:[],
    description:'AfterYou en La Gran Sala de Palau Alameda. Horario anunciado por el local.',
    source:'https://palaualameda.com/eventos', image:'https://palaualameda.com/uploads/fourvenues_afteryou_c39ff4f75c_9db3d69e13.png?v=2026-08-27T09%3A18%3A17.325Z-20260609-2' },
  { title:'Tardeo con Vicente Buitrón · 10 de octubre', venue:0,
    start:'2026-10-10T17:00:00+02:00', end:'2026-10-10T22:00:00+02:00', type:'CLUB', genres:['POP'],
    description:'Sesión de tarde en Azza con himnos de los años noventa y dos mil, según el programa de Palau Alameda.',
    source:'https://palaualameda.com/eventos', image:'https://palaualameda.com/uploads/fourvenues_tardeo_azza_9d25042f8f_63556fb1bf.png?v=2026-08-27T09%3A18%3A25.000Z-20260609-2' },
  { title:'Bamboleo · 11 de octubre', venue:0,
    start:'2026-10-11T17:00:00+02:00', end:'2026-10-11T21:00:00+02:00', type:'LIVE_SESSION', genres:['LATIN','LIVE'],
    description:'Edición dominical de Bamboleo en Palau Alameda, con RIO ESENCIA anunciado como grupo invitado.',
    source:'https://palaualameda.com/eventos', image:'https://palaualameda.com/uploads/fourvenues_bamboleo_912b305807_33c6c24f21.png?v=2026-08-27T09%3A18%3A23.689Z-20260609-2' },
  { title:'ELENCO HOUSE w/ BASTIAN BUX · 11 de octubre', venue:0,
    start:'2026-10-11T20:00:00+02:00', end:'2026-10-12T07:30:00+02:00', type:'CLUB', genres:['HOUSE'],
    description:'Sesión ELENCO HOUSE w/ BASTIAN BUX anunciada por Palau Alameda en La Gran Sala.',
    source:'https://palaualameda.com/eventos', image:'https://palaualameda.com/uploads/fourvenues_la_gran_sala_6fd0030229_a32488bdf4.jpeg?v=2026-09-25T10%3A07%3A02.681Z-20260609-2' },
  { title:'CAFÉ VALENCIA · 16 de octubre', venue:0,
    start:'2026-10-16T17:00:00+02:00', end:'2026-10-16T23:30:00+02:00', type:'CONCERT', genres:['LIVE'],
    description:'Concierto CAFÉ VALENCIA anunciado en la agenda de Palau Alameda. Apertura de puertas a las 19:00.',
    source:'https://palaualameda.com/eventos', image:'https://palaualameda.com/uploads/fourvenues_la_gran_sala_c4227a3fc8_34f462dd3b.png?v=2026-08-19T13%3A07%3A05.742Z-20260609-2' },
  { title:'DERALI COFFEE PARTY · 18 de octubre', venue:0,
    start:'2026-10-18T15:00:00+02:00', end:'2026-10-18T21:00:00+02:00', type:'OTHER', genres:[],
    description:'Coffee Party de DERALI anunciada por Palau Alameda para la tarde del domingo.',
    source:'https://palaualameda.com/eventos', image:'https://palaualameda.com/uploads/fourvenues_la_gran_sala_a2765cae14_a9936681f0.png?v=2026-09-05T18%3A07%3A04.493Z-20260609-2' },
  { title:'Distrito 10 · 23 de octubre', venue:0,
    start:'2026-10-23T18:00:00+02:00', end:'2026-10-23T23:30:00+02:00', type:'CLUB', genres:[],
    description:'Distrito 10 vuelve a Palau Alameda con una sesión que une tardeo y noche.',
    source:'https://palaualameda.com/eventos', image:'https://palaualameda.com/uploads/fourvenues_la_gran_sala_b258eae6da_51609d4b54.jpg?v=2026-09-01T15%3A07%3A07.662Z-20260609-2' },
  { title:'ELYELLA · 24 de octubre', venue:0,
    start:'2026-10-24T23:30:00+02:00', end:'2026-10-25T03:00:00+01:00', type:'CONCERT', genres:['LIVE'],
    description:'ELYELLA en concierto en Palau Alameda. Fecha y horario publicados por el local.',
    source:'https://palaualameda.com/eventos', image:'https://palaualameda.com/uploads/WEB_25_cf887941ab.png?v=2026-07-15T09%3A56%3A30.936Z-20260609-2' },
  { title:'Tardeo con Vicente Buitrón · 24 de octubre', venue:0,
    start:'2026-10-24T17:00:00+02:00', end:'2026-10-24T22:00:00+02:00', type:'CLUB', genres:['POP'],
    description:'Sesión de tarde en Azza con éxitos de los años noventa y dos mil.',
    source:'https://palaualameda.com/eventos', image:'https://palaualameda.com/uploads/fourvenues_tardeo_azza_9d25042f8f_63556fb1bf.png?v=2026-08-27T09%3A18%3A25.000Z-20260609-2' },
  { title:'Bamboleo · 25 de octubre', venue:0,
    start:'2026-10-25T17:00:00+01:00', end:'2026-10-25T21:00:00+01:00', type:'LIVE_SESSION', genres:['LATIN','LIVE'],
    description:'Edición dominical de Bamboleo en Palau Alameda, con SONAKAYS anunciado como grupo invitado.',
    source:'https://palaualameda.com/eventos', image:'https://palaualameda.com/uploads/fourvenues_bamboleo_a1d79d77e3_3f2a82b8de.png?v=2026-09-28T16%3A07%3A23.538Z-20260609-2' },
  { title:'IÑIGO QUINTERO EN VALENCIA · 6 de noviembre', venue:0,
    start:'2026-11-06T20:00:00+01:00', end:'2026-11-06T23:30:00+01:00', type:'CONCERT', genres:['POP','LIVE'],
    description:'Concierto de Iñigo Quintero anunciado por Palau Alameda.',
    source:'https://palaualameda.com/eventos', image:'https://palaualameda.com/uploads/CUADRADO_1_6001a4d521.png?v=2026-08-24T11%3A52%3A22.600Z-20260609-2' },
  { title:'El Desliz de la Milkshake · 15 de octubre', venue:4,
    start:'2026-10-16T00:00:00+02:00', end:'2026-10-16T05:00:00+02:00', type:'CLUB', genres:['REGGAETON','HOUSE','LATIN'],
    description:'Sesión Milkshake en La (2) de Sala Apolo con reggaetón, música urbana y una sala de house.',
    source:'https://sala-apolo.com/es/evento/el-desliz-de-la-milkshake-20261015-7590', image:'https://sala-apolo.com/uploads/media/default/0001/13/thumb_12863_default_wide.jpeg' },
  { title:'Antichurros · 25 de octubre', venue:4,
    start:'2026-10-25T16:00:00+01:00', end:'2026-10-26T05:00:00+01:00', type:'CLUB', genres:['EDM'],
    description:'Edición de Halloween de Antichurros en Sala Apolo; La (2) anuncia electrónica de baile.',
    source:'https://www.sala-apolo.com/es/evento/antichurros-20261025-7640', image:'https://www.sala-apolo.com/uploads/media/default/0001/13/thumb_12761_default_wide.jpeg' },
];
// Original NOCTURNO portfolio simulations at real, independently operated venues.
// Titles, dates, genres, promoters, prices and stock below are invented DEMO data.
const portfolioEvents = [
  ['NOCTURNO SESSION · Alameda',0,0,'CLUB',['TECHNO','TECH_HOUSE','HOUSE'],['ELEGANT'],'SMART_CASUAL',14,0,23],
  ['Horizonte Rojo',1,2,'BEACH_CLUB',['HOUSE','EDM'],['CHILL'],'CASUAL',18,1,19],
  ['Frecuencia Gran Sala',0,1,'RAVE',['TECHNO','HARDGROOVE'],['UNDERGROUND'],'STREETWEAR',16,2,23],
  ['Marea Baja',1,2,'BEACH_CLUB',['TECH_HOUSE','HOUSE'],['CHILL'],'CASUAL',20,3,20],
  ['Latido Mediterráneo',16,0,'CLUB',['LATIN','REGGAETON'],['COMMERCIAL'],'SMART_CASUAL',15,4,23],
  ['La Hora de Hielo',18,2,'LIVE_SESSION',['INDIE','LIVE'],['ALTERNATIVE'],'CASUAL',12,5,21],
  ['Circuito Valencia',6,1,'CLUB',['TECHNO','HARD_TECHNO'],['UNDERGROUND'],'STREETWEAR',19,6,23],
  ['Pop Después de Medianoche',15,3,'CLUB',['POP','REGGAETON'],['COMMERCIAL'],'SMART_CASUAL',16,7,23],
  ['Guitarras de la Ciudad',17,2,'CONCERT',['ROCK','LIVE'],['ALTERNATIVE'],'CASUAL',18,8,21],
  ['Fuego Lento',16,0,'CLUB',['TECH_HOUSE','HOUSE'],['INTERNATIONAL'],'CASUAL',17,9,23],
  ['Una Noche en el Cabanyal',18,2,'LIVE_SESSION',['SOUL','JAZZ'],['CHILL'],'CASUAL',13,10,20],
  ['Sin Filtro · Radio City',19,3,'PUB',['HIP_HOP','SOUL'],['ALTERNATIVE'],'CASUAL',12,11,22],
  ['La Ruta de Medianoche',8,3,'CONCERT',['INDIE','LIVE'],['ALTERNATIVE'],'CASUAL',19,12,21],
  ['Último Piso',9,2,'ROOFTOP',['HOUSE','POP'],['ELEGANT'],'SMART_CASUAL',22,13,20],
  ['Señal de Playa',7,0,'BEACH_CLUB',['EDM','HOUSE'],['COMMERCIAL'],'CASUAL',18,14,20],
  ['Rojo sobre Neptuno',1,1,'BEACH_CLUB',['TECHNO','HOUSE'],['INTERNATIONAL'],'STREETWEAR',24,15,22],
  ['La Noche en Vivo',17,2,'CONCERT',['ROCK','INDIE'],['ALTERNATIVE'],'CASUAL',18,16,21],
  ['Bajo el Mismo Techo',0,0,'CLUB',['REGGAETON','LATIN'],['COMMERCIAL'],'SMART_CASUAL',14,17,23],
  ['Neón y Vinilo',16,3,'CLUB',['HOUSE','SOUL'],['ELEGANT'],'CASUAL',17,18,23],
  ['Ecos del Carmen',19,2,'JAZZ_CLUB',['JAZZ','SOUL'],['CHILL'],'CASUAL',15,19,21],
  ['Ritual de Domingo',18,1,'LIVE_SESSION',['LATIN','LIVE'],['CHILL'],'CASUAL',11,20,19],
  ['Ritmo Central',2,0,'CLUB',['REGGAETON','POP'],['COMMERCIAL'],'SMART_CASUAL',18,2,23],
  ['El Pulso de Madrid',3,1,'RAVE',['TECHNO','HARDGROOVE'],['UNDERGROUND'],'STREETWEAR',21,3,23],
  ['Órbita MON',10,0,'CLUB',['TECH_HOUSE','HOUSE'],['INTERNATIONAL'],'CASUAL',19,7,23],
  ['Noche de Sala',11,3,'CONCERT',['INDIE','ROCK'],['ALTERNATIVE'],'CASUAL',20,10,21],
  ['Seis de la Mañana',12,1,'AFTER',['EDM','HOUSE'],['UNIVERSITY'],'STREETWEAR',16,13,23],
  ['Río Eléctrico',3,0,'CLUB',['TECHNO','HOUSE'],['UNDERGROUND'],'CASUAL',22,16,23],
  ['A Contraluz',2,2,'CLUB',['POP','LATIN'],['ELEGANT'],'SMART_CASUAL',18,19,23],
  ['Señal Apolo',4,1,'CLUB',['HARD_TECHNO','TECHNO'],['UNDERGROUND'],'STREETWEAR',20,1,23],
  ['Poblenou en Directo',5,3,'CONCERT',['LIVE','INDIE'],['ALTERNATIVE'],'CASUAL',23,4,21],
  ['La Noche del Raval',14,2,'ROOFTOP',['HOUSE','SOUL'],['ELEGANT'],'SMART_CASUAL',21,8,20],
  ['Calle Abierta',13,0,'CLUB',['TECHNO','HARDGROOVE'],['UNDERGROUND'],'STREETWEAR',17,11,23],
  ['Sesión Dos',4,3,'CLUB',['HIP_HOP','TRAP'],['INTERNATIONAL'],'CASUAL',16,14,23],
  ['Razz en Rojo',5,1,'RAVE',['HARD_TECHNO','TECHNO'],['UNDERGROUND'],'STREETWEAR',25,18,23],
  ['El Último Compás',4,2,'LIVE_SESSION',['JAZZ','SOUL'],['CHILL'],'CASUAL',15,21,21],
];
const slugify = (title) => title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const eventStart = (index) => {
  const start = new Date();
  if (index === 0) {
    start.setHours(23, 0, 0, 0);
    if (start <= new Date()) { start.setDate(start.getDate() + 1); start.setHours(1, 0, 0, 0); }
  } else {
    start.setDate(start.getDate() + index);
    start.setHours(index % 3 === 0 ? 20 : 22, 0, 0, 0);
  }
  return start;
};
const isUpcomingDemo = (index) => [0, 1, 5, 12].includes(index);
const demoEventStart = (index) => {
  if (isUpcomingDemo(index)) return eventStart(index);
  const historic = new Date('2026-09-01T20:00:00+02:00');
  historic.setUTCDate(historic.getUTCDate() + index);
  return historic;
};
const portfolioEventStart = (dayOffset, hour) => {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  if (date <= new Date()) date.setDate(date.getDate() + 1);
  return date;
};

export async function seed() {
  if (env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production');
  await migrate();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < venues.length; i++) {
      const [name, type, province, municipality, zone, address, latitude, longitude, capacity, postalCode] = venues[i];
      await client.query(`INSERT INTO venues
        (id,name,slug,type,province,municipality,zone,address,latitude,longitude,capacity,postal_code,is_demo)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE)
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,province=EXCLUDED.province,
          municipality=EXCLUDED.municipality,zone=EXCLUDED.zone,address=EXCLUDED.address,
          latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,capacity=EXCLUDED.capacity,
          postal_code=EXCLUDED.postal_code,is_demo=TRUE`,
        [id(1,i+1),name,slugify(name),type,province,municipality,zone,address,latitude,longitude,capacity,postalCode]);
    }
    for (let i = 0; i < verifiedVenues.length; i++) {
      const [name,type,province,municipality,address,postalCode,latitude,longitude,websiteUrl,sourceUrl] = verifiedVenues[i];
      const photo = venuePhotos[i]?.[0]?.[0] ?? null;
      await client.query(`INSERT INTO venues
        (id,name,slug,type,province,municipality,address,postal_code,latitude,longitude,website_url,source_url,image_url,is_demo)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,FALSE)
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,type=EXCLUDED.type,
          province=EXCLUDED.province,municipality=EXCLUDED.municipality,address=EXCLUDED.address,
          postal_code=EXCLUDED.postal_code,latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,
          website_url=EXCLUDED.website_url,source_url=EXCLUDED.source_url,
          image_url=EXCLUDED.image_url,is_demo=FALSE`,
        [id('b',i+1),name,slugify(name),type,province,municipality,address,postalCode,latitude,longitude,websiteUrl,sourceUrl ?? websiteUrl,photo]);
    }
    for (let i = 0; i < promoters.length; i++) {
      await client.query(`INSERT INTO promoters (id,name,slug,email,description) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,description=EXCLUDED.description`,
        [id(2,i+1),promoters[i][0],slugify(promoters[i][0]),promoters[i][1],`Colectivo cultural ficticio de la demo Nocturno.`]);
    }
    const demoUsers = [
      [id(3,1),'admin@nocturno.test','Alex Moreno','ADMIN',null,'AdminDemo!2026'],
      [id(3,2),'promoter@nocturno.test','Cris Vega','PROMOTER',id(2,2),'PromoterDemo!2026'],
      [id(3,3),'user@nocturno.test','Sam Ríos','USER',null,'UserDemo!2026'],
    ];
    for (const [userId,email,displayName,role,promoterId,password] of demoUsers)
      await client.query(`INSERT INTO users (id,email,display_name,role,promoter_id,password_hash)
        VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET
        email=EXCLUDED.email,display_name=EXCLUDED.display_name,role=EXCLUDED.role,
        promoter_id=EXCLUDED.promoter_id,password_hash=EXCLUDED.password_hash,is_active=TRUE`,
        [userId,email,displayName,role,promoterId,await hashPassword(password)]);

    for (let i = 0; i < events.length; i++) {
      const [title,venueIndex,promoterIndex,eventType,genres,atmosphere,dressCode,price,status] = events[i];
      // Keep only the checkout fixtures and sold-out waitlist fixture upcoming.
      // The remaining synthetic catalogue is historical management data.
      const upcomingDemo = isUpcomingDemo(i);
      const seededStatus = !upcomingDemo && status === 'PUBLISHED' ? 'FINISHED' : status;
      const start = demoEventStart(i);
      const end = new Date(start.getTime() + 5 * 60 * 60 * 1000);
      await client.query(`INSERT INTO events (id,venue_id,promoter_id,title,slug,description,event_type,
        starts_at,ends_at,minimum_age,dress_code,music_genres,atmosphere,ideal_for,poster_url,status,is_active,is_demo)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,TRUE,TRUE)
        ON CONFLICT (id) DO UPDATE SET venue_id=EXCLUDED.venue_id,promoter_id=EXCLUDED.promoter_id,
        title=EXCLUDED.title,slug=EXCLUDED.slug,description=EXCLUDED.description,event_type=EXCLUDED.event_type,
        starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,minimum_age=EXCLUDED.minimum_age,
        dress_code=EXCLUDED.dress_code,music_genres=EXCLUDED.music_genres,atmosphere=EXCLUDED.atmosphere,
        ideal_for=EXCLUDED.ideal_for,poster_url=EXCLUDED.poster_url,status=EXCLUDED.status,is_active=TRUE,is_demo=TRUE
        WHERE events.deleted_at IS NULL`,
        [id(4,i+1),id(1,venueIndex+1),id(2,promoterIndex+1),title,slugify(title),
          `Una noche de ${genres.map((genre) => genre.toLowerCase().replaceAll('_',' ')).join(' y ')} en ${venues[venueIndex][0]}. Música y comunidad en ${venues[venueIndex][3]}.`,
          eventType,start,end,18,dressCode,genres,atmosphere,['FRIENDS','DANCING'],`/posters/event-${String(i+1).padStart(2,'0')}.svg`,seededStatus]);
      for (let j = 0; j < 2; j++) await client.query(`INSERT INTO ticket_types
        (id,event_id,name,price,quantity,max_per_user,benefits) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,price=EXCLUDED.price,quantity=EXCLUDED.quantity,
          max_per_user=EXCLUDED.max_per_user,benefits=EXCLUDED.benefits`,
        [id(5,i*2+j+1),id(4,i+1),j ? 'Acceso VIP' : 'Entrada general',j ? price+18 : price,status === 'SOLD_OUT' ? 0 : (j ? 40 : 180),6,
          j ? ['Acceso prioritario','Zona reservada'] : ['Acceso al evento']]);
    }
    // Management fixtures keep inactive and trash views populated without touching public inventory.
    await client.query(`UPDATE events SET is_active = FALSE, updated_at = NOW()
      WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [[id(4,20), id(4,21)]]);
    await client.query(`UPDATE events SET is_active = FALSE, deleted_at = COALESCE(deleted_at, NOW()), updated_at = NOW()
      WHERE id = $1`, [id(4,19)]);
    for (let i = 0; i < verifiedEvents.length; i++) {
      const event = verifiedEvents[i];
      const status = new Date(event.end) <= new Date() ? 'FINISHED' : 'PUBLISHED';
      await client.query(`INSERT INTO events (id,venue_id,title,slug,description,event_type,
        starts_at,ends_at,music_genres,poster_url,source_url,image_source_url,status,is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,TRUE)
        ON CONFLICT (id) DO UPDATE SET venue_id=EXCLUDED.venue_id,title=EXCLUDED.title,
          slug=EXCLUDED.slug,description=EXCLUDED.description,event_type=EXCLUDED.event_type,
          starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,music_genres=EXCLUDED.music_genres,
          poster_url=EXCLUDED.poster_url,source_url=EXCLUDED.source_url,
          image_source_url=EXCLUDED.image_source_url,status=EXCLUDED.status
        WHERE events.deleted_at IS NULL`,
        [id('c',i+1),id('b',event.venue+1),event.title,slugify(event.title),event.description,
          event.type,event.start,event.end,event.genres,event.image,event.source,event.image,status]);
    }
    // Preserve researched events as management reference records, outside public Discover.
    // This is independent of status and does not alter historical event titles or sources.
    await client.query(`UPDATE events SET is_active = FALSE, updated_at = NOW()
      WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [verifiedEvents.map((_, i) => id('c',i+1))]);

    const photoUsage = new Map();
    for (let i = 0; i < portfolioEvents.length; i++) {
      const [title,venueIndex,promoterIndex,eventType,genres,atmosphere,dressCode,basePrice,dayOffset,hour] = portfolioEvents[i];
      const start = portfolioEventStart(dayOffset,hour);
      const end = new Date(start.getTime() + 5 * 60 * 60 * 1000);
      const venueName = verifiedVenues[venueIndex][0];
      const photos = venuePhotos[venueIndex] ?? [];
      const photoIndex = photoUsage.get(venueIndex) ?? 0;
      photoUsage.set(venueIndex,photoIndex + 1);
      const [photoUrl,imageSourceUrl] = photos.length ? photos[photoIndex % photos.length] : [null,null];
      await client.query(`INSERT INTO events (id,venue_id,promoter_id,title,slug,description,event_type,
        starts_at,ends_at,minimum_age,dress_code,music_genres,atmosphere,ideal_for,poster_url,
        image_source_url,status,is_active,is_demo)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,18,$10,$11,$12,$13,$14,$15,'PUBLISHED',TRUE,TRUE)
        ON CONFLICT (id) DO UPDATE SET venue_id=EXCLUDED.venue_id,promoter_id=EXCLUDED.promoter_id,
          title=EXCLUDED.title,slug=EXCLUDED.slug,description=EXCLUDED.description,
          event_type=EXCLUDED.event_type,starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,
          dress_code=EXCLUDED.dress_code,music_genres=EXCLUDED.music_genres,
          atmosphere=EXCLUDED.atmosphere,ideal_for=EXCLUDED.ideal_for,
          poster_url=EXCLUDED.poster_url,image_source_url=EXCLUDED.image_source_url,is_demo=TRUE
        WHERE events.deleted_at IS NULL`,
        [id('d',i+1),id('b',venueIndex+1),id(2,promoterIndex+1),title,slugify(title),
          `Evento ficticio creado por Nocturno para demostrar la experiencia de ticketing en ${venueName}. La programación, los precios y las entradas son simulados. No existe afiliación ni venta oficial del local.`,
          eventType,start,end,dressCode,genres,atmosphere,['FRIENDS','DANCING'],photoUrl,imageSourceUrl]);
      for (let j = 0; j < 3; j++) await client.query(`INSERT INTO ticket_types
        (id,event_id,name,price,quantity,max_per_user,benefits) VALUES ($1,$2,$3,$4,$5,6,$6)
        ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,price=EXCLUDED.price,
          quantity=EXCLUDED.quantity,max_per_user=EXCLUDED.max_per_user,
          benefits=EXCLUDED.benefits`,
        [id('e',i*3+j+1),id('d',i+1),['Early Bird','General','Last Call'][j],
          [basePrice-4,basePrice,basePrice+8][j],[60,180,50][j],['Acceso demo al evento']]);
    }
    for (const [user,event] of [[1,1],[1,2],[2,3],[3,4],[3,8]]) await client.query(
      'INSERT INTO favorites (user_id,event_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',[id(3,user),id(4,event)]);

    // Synthetic local commerce is explicitly separate from live Stripe transactions.
    const demoSales = [[1,2],[2,1],[6,3],[8,2],[10,1],[14,2],[16,1]];
    for (let i = 0; i < demoSales.length; i++) {
      const [eventIndex,quantity] = demoSales[i];
      const generalType = id(5,(eventIndex-1)*2+1);
      const unitCents = events[eventIndex-1][7]*100;
      const amountCents = unitCents*quantity;
      await client.query(`INSERT INTO orders
        (id,user_id,status,subtotal_cents,total_cents,currency,idempotency_key,expires_at)
        VALUES ($1,$2,'PAID',$3,$3,'EUR',$4,NOW() + INTERVAL '1 day') ON CONFLICT (id) DO NOTHING`,
        [id(6,i+1),id(3,3),amountCents,id('a',i+1)]);
      await client.query(`INSERT INTO order_items
        (id,order_id,event_id,ticket_type_id,name,unit_price_cents,quantity,subtotal_cents,
         event_title_snapshot,venue_name_snapshot,starts_at_snapshot)
        VALUES ($1,$2,$3,$4,'Entrada general',$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
        [id(7,i+1),id(6,i+1),id(4,eventIndex),generalType,unitCents,quantity,amountCents,
          events[eventIndex-1][0],venues[events[eventIndex-1][1]][0],demoEventStart(eventIndex-1)]);
      await client.query(`INSERT INTO payments
        (id,order_id,provider,provider_payment_id,status,amount_cents,currency)
        VALUES ($1,$2,'STRIPE',$3,'PAID',$4,'EUR') ON CONFLICT (id) DO NOTHING`,
        [id(8,i+1),id(6,i+1),`pi_demo_nocturno_${i+1}`,amountCents]);
      for (let ticketIndex = 0; ticketIndex < quantity; ticketIndex++) {
        const ticketNumber = demoSales.slice(0,i).reduce((count,sale)=>count+sale[1],0)+ticketIndex+1;
        await client.query(`INSERT INTO tickets
          (id,order_item_id,user_id,event_id,ticket_type_id,status)
          VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
          [id(9,ticketNumber),id(7,i+1),id(3,3),id(4,eventIndex),generalType,ticketIndex===0 && i===1 ? 'USED' : 'VALID']);
      }
    }
    // A separate local fixture demonstrates 2 individual QR tickets for one purchase
    // at a real venue. It is not a Stripe transaction or an official venue ticket.
    const sampleOrder = id(6,100);
    const sampleItem = id(7,100);
    const sampleTicketType = id('e',2); // General, 14 € · NOCTURNO SESSION · Alameda
    await client.query(`INSERT INTO orders
      (id,user_id,status,subtotal_cents,total_cents,currency,idempotency_key,expires_at)
      VALUES ($1,$2,'PAID',2800,2800,'EUR',$3,NOW() + INTERVAL '1 day')
      ON CONFLICT (id) DO NOTHING`,[sampleOrder,id(3,3),id('a',100)]);
    await client.query(`INSERT INTO order_items
      (id,order_id,event_id,ticket_type_id,name,unit_price_cents,quantity,subtotal_cents,
       event_title_snapshot,venue_name_snapshot,starts_at_snapshot)
      VALUES ($1,$2,$3,$4,'General',1400,2,2800,$5,$6,$7)
      ON CONFLICT (id) DO NOTHING`,
      [sampleItem,sampleOrder,id('d',1),sampleTicketType,portfolioEvents[0][0],verifiedVenues[0][0],portfolioEventStart(0,23)]);
    await client.query(`INSERT INTO payments
      (id,order_id,provider,provider_payment_id,status,amount_cents,currency)
      VALUES ($1,$2,'STRIPE','pi_demo_nocturno_portfolio_100','PAID',2800,'EUR')
      ON CONFLICT (id) DO NOTHING`,[id(8,100),sampleOrder]);
    for (let i = 0; i < 2; i++) await client.query(`INSERT INTO tickets
      (id,order_item_id,user_id,event_id,ticket_type_id,status)
      VALUES ($1,$2,$3,$4,$5,'VALID') ON CONFLICT (id) DO NOTHING`,
      [id(9,100+i),sampleItem,id(3,3),id('d',1),sampleTicketType]);
    await client.query(`UPDATE ticket_types tt SET sold = (
      SELECT count(*)::integer FROM tickets t WHERE t.ticket_type_id = tt.id AND t.status IN ('VALID','USED'))
      WHERE tt.id = ANY($1::uuid[])`,[
        [...events.flatMap((_,i)=>[id(5,i*2+1),id(5,i*2+2)]),...portfolioEvents.flatMap((_,i)=>[id('e',i*3+1),id('e',i*3+2),id('e',i*3+3)])]
      ]);
    await client.query('COMMIT');
    console.log(`Demo seed ready: ${verifiedVenues.length} real venues, ${venues.length} fixture venues, ${events.length + portfolioEvents.length} demo events, ${verifiedEvents.length} inactive reference events, ${demoSales.length + 1} demo paid orders`);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { await seed(); } catch (error) { console.error(error); process.exitCode = 1; } finally { await closePool(); }
}
