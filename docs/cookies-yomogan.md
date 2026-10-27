# Cookies visuales y Yomogan

## Preferencias del navegador
Aviso inicial con «Recordar mi elección», «Solo esta visita» y «Configurar».
Solo hay un ajuste opcional con efecto real: recordar el aviso en localStorage
(clave `nocturno_cookie_preferences_v2`). Desactivarlo elimina esa preferencia;
el aviso reaparece al recargar. Con almacenamiento bloqueado, la elección dura esta visita.
Analítica y marketing no están implementados: no hay interruptores ficticios ni trackers.
Las cookies de autenticación y el resto del almacenamiento técnico permanecen intactos.
No es una CMP ni una declaración de cumplimiento legal. La antigua clave visual v1
no se utiliza como consentimiento. El pie permite reabrir el diálogo, que conserva
ESC, clic exterior, foco inicial, Tab circular y retorno al botón de apertura.

Referencia consultada: https://site.fourvenues.com/es/nativa (21 de octubre de 2026).
La lectura pública mostró el enlace «Cookies» pero no permitió inspeccionar visualmente
el aviso o sus preferencias. Se diseñó una alternativa propia, no una réplica comprobada.
No se copiaron código, textos legales, logotipos ni assets de Fourvenues.

## Flujo de Yomogan
Layout App → componente visual con inputs/outputs → YomoganStore → YomoganApiService
→ POST /api/yomogan/chat → controller → service RAG → repository → PostgreSQL.

El historial se mantiene solo en memoria durante la conversación. «Nueva conversación»
lo borra y descarta respuestas antiguas pendientes. El componente gestiona presentación,
controles, foco y scroll; el Store gestiona peticiones, errores y respuestas.
El chat distingue «IA · contexto del catálogo» de «Búsqueda · sin respuesta IA».
Si falta una ciudad se pide aclaración. No hay respuestas de IA simuladas en producción.

### Recuperación y seguridad
1. Zod limita mensajes (11, 1200 caracteres por mensaje, 8000 totales), roles y salida.
2. La interpretación determinista extrae restricciones explícitas de los mensajes del usuario.
   El modelo no genera filtros SQL: no puede añadir una edad, fecha, dress code o ambiente
   que no se haya pedido. Los embeddings y la generación interpretan la afinidad semántica
   y ayudan a comparar las coincidencias. Las preferencias reconocidas se conservan en
   los seguimientos; una petición ambigua puede requerir aclaración.
3. SQL parametrizado comprueba municipio/provincia, género, ambiente, tipo, público,
   dress code, edad, fechas, precio y cantidad del grupo.
4. Solo PUBLISHED, activos, no eliminados y no terminados. Los tipos de entrada deben
   estar activos, dentro de la ventana de venta y tener stock real suficiente.
   El mínimo publicado es el del tipo vendible que satisface precio y cantidad,
   no el de un Early Bird agotado.
5. Ranking léxico PostgreSQL + similitud coseno sobre vectores. Máximo 100 candidatos
   SQL; hasta 32 se indexan por petición fría y solo seis entran en el contexto.
   Es proporcionado al catálogo de portfolio. No se usa pgvector.
6. Tabla yomogan_embeddings (migration incremental 011): huella SHA-256 del documento
   público y del proveedor/modelo de embeddings. No se regeneran documentos intactos.
   Cambios en título, descripción o atributos del documento se refrescan al recuperarlos.
   Precio, fechas y stock se consultan en vivo y no se congelan en el vector.
7. La IA elige IDs y códigos de motivo; el texto factual de esos motivos (música,
   ambiente, precio, local, público o tipo) se construye desde la fila actual de PostgreSQL.
   Introducción y pregunta siguen generándose con IA, sin cifras ni datos de eventos.
   Generación estructurada; IDs inventados, duplicados, HTML o URLs en la salida se
   rechazan y dan paso al modo búsqueda. Los enlaces se construyen desde slugs de la BD.
   Estado y stock se vuelven a consultar después de la inferencia.
8. Los documentos son datos no confiables: el prompt prohíbe seguir sus instrucciones.
   El modelo no tiene herramientas, acceso SQL ni secretos. Nunca recibe usuarios,
   pedidos, tickets, QR, correos privados o credenciales.
9. Doce solicitudes por IP/minuto y dos inferencias simultáneas por proceso.
   Límite de clientes en memoria, timeout de proveedor y respuestas sin detalles internos.
   No se registran cuerpos de conversación. No se persiste el historial ni ubicación.

Los eventos DEMO se marcan expresamente como simulaciones, sin afiliación con locales.
El modo búsqueda admite los filtros explícitos que reconoce; no es una IA alternativa
y puede pedir aclaración. Los precios/disponibilidad siempre proceden de PostgreSQL.
Las recomendaciones no reservan stock.

## Activar Ollama
EmbeddingGemma requiere como mínimo Ollama 0.11.10. Para esta integración se recomienda una versión actual; el runner usa Ollama 0.40.7 con una sola inferencia paralela y un modelo cargado.
Modelos verificados en el catálogo oficial:
- https://ollama.com/library/qwen3:4b (generación)
- https://ollama.com/library/embeddinggemma (embeddings)
- API: https://docs.ollama.com/api/chat y https://docs.ollama.com/api/embed

### Mac local (pasos para ejecutar tú)

Requiere Homebrew y Node ^24.15.0 o >=26. Estos comandos no se han ejecutado en tu Mac.
Conserva tu PostgreSQL y tu .env si ya tienes una instalación; no uses db:reset.
Para una instalación nueva de desarrollo:

~~~sh
brew install ollama postgresql@17
brew services start postgresql@17
brew services start ollama
export PATH="$(brew --prefix postgresql@17)/bin:$PATH"
createdb nocturno
ollama pull qwen3:4b
ollama pull embeddinggemma
~~~

Si la base ya existe, omite createdb. Si Ollama ya está abierto como app, no arranques
un segundo servidor; como alternativa al servicio, ollama serve ocupa su propia terminal.
Los pull se necesitan al instalar/actualizar los modelos, no en cada arranque.
Fuentes: [Ollama Homebrew](https://formulae.brew.sh/formula/ollama) y
[PostgreSQL 17 Homebrew](https://formulae.brew.sh/formula/postgresql@17).

Desde la raíz del repositorio, prepara backend/.env solo si todavía no existe:

~~~sh
cd backend
npm ci
node --input-type=module <<'NODE'
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { userInfo } from 'node:os';
if (!existsSync('.env')) {
  const source = readFileSync('.env.example', 'utf8')
    .replace(/^DATABASE_URL=.*$/m, 'DATABASE_URL=postgresql://' + encodeURIComponent(userInfo().username) + '@127.0.0.1:5432/nocturno')
    .replace(/^JWT_ACCESS_SECRET=.*$/m, 'JWT_ACCESS_SECRET=' + randomBytes(32).toString('hex'))
    .replace(/^JWT_REFRESH_SECRET=.*$/m, 'JWT_REFRESH_SECRET=' + randomBytes(32).toString('hex'));
  writeFileSync('.env', source, { mode: 0o600 });
}
NODE
npm run db:migrate
npm run db:seed
npm run db:index:yomogan
npm run dev
~~~

La configuración generada presupone el usuario local de Homebrew y PostgreSQL en 5432.
Si ya tenías .env, ajusta DATABASE_URL a tu instalación y comprueba estas variables
existentes, sin cambiar el proveedor:

~~~dotenv
YOMOGAN_PROVIDER=ollama
YOMOGAN_CHAT_URL=http://127.0.0.1:11434
YOMOGAN_MODEL=qwen3:4b
YOMOGAN_EMBED_PROVIDER=ollama
YOMOGAN_EMBED_URL=http://127.0.0.1:11434
YOMOGAN_EMBED_MODEL=embeddinggemma
~~~

db:migrate aplica todas las pendientes en orden (001–011), incluidas
009_event_images.sql, 010_event_gallery_user_edits.sql y 011_yomogan_embeddings.sql.
Registra las aplicadas; no hay que ejecutar ni modificar esos SQL a mano.
El seed es exclusivamente de desarrollo. En otra terminal, desde la raíz:

~~~sh
cd frontend
npm ci
npm start
~~~

Abre http://localhost:4200; la API está en http://localhost:3000/health.
Angular usa su proxy /api. Prueba «Techno en Valencia por menos de 20 euros».
Con los modelos disponibles debe aparecer «IA · contexto del catálogo»; si Ollama
falla, el modo se identifica como «Búsqueda · sin respuesta IA».
Si backend está en Docker, 127.0.0.1 apunta al contenedor, no al Mac: esta receta
ejecuta Node y Ollama directamente en el host.

El índice inicial es opcional pero evita el coste inicial para el primer visitante.
El comando indexa por lotes el mismo catálogo público (máximo 100 candidatos).
En catálogos mayores hay que ampliar la paginación/indexación antes de escalar.
No publica un puerto de Ollama a Internet ni necesita una clave de pago.

Variables reales (backend/.env.example):
- YOMOGAN_PROVIDER=ollama; YOMOGAN_MODEL=qwen3:4b
- YOMOGAN_CHAT_URL=http://127.0.0.1:11434
- YOMOGAN_EMBED_PROVIDER=ollama; YOMOGAN_EMBED_MODEL=embeddinggemma
- YOMOGAN_EMBED_URL=http://127.0.0.1:11434
- YOMOGAN_TIMEOUT_MS=60000 (hasta 180000 para CPU lenta)
- YOMOGAN_API_KEY y YOMOGAN_EMBED_API_KEY: opcionales, nunca en Angular.
- Proveedores compatibles: elegir compatible, base URL terminada en /v1 y modelos
  que soporten JSON Schema para chat y /embeddings para vectores.
  Generación y embeddings se configuran por separado; disabled desactiva embeddings.
  La compatibilidad concreta de un servicio externo debe verificarse antes de desplegarlo.

## Avatar oficial
Se utiliza exactamente la fotografía aportada por el usuario, sin recorte ni transformación:
frontend/public/yomogan/avatar.png. SHA-256:
3b0bf4b0499a87e47289288dde4c8457177fdcb1db3c7703e310900d34bb65d7.
La ruta por defecto es /yomogan/avatar.png; YOMOGAN_AVATAR_PATH ya existente permite
sobrescribirla. GET /api/yomogan/config entrega esa ruta al mecanismo existente.
La misma imagen aparece en launcher, cabecera y mensajes, con object-fit: contain.
El E2E comprueba los bytes servidos, carga, dimensiones naturales y proporciones.

## Web pública
Un navegador público habla con la API de Nocturno, no con el ordenador del desarrollador.
La API necesita acceso privado a un servidor Ollama con los modelos descargados, memoria
suficiente y capacidad de CPU/GPU acorde al tráfico, o a un proveedor compatible configurado.
El runner de CI es efímero y no es alojamiento para visitantes.
Usar HTTPS, PostgreSQL persistente, índice inicial y límites en el proxy. En varias
réplicas, los límites deben compartirse en infraestructura o aplicarse en el proxy;
el límite en memoria actual es por proceso. No confiar sin control en X-Forwarded-For.
No exponer Ollama ni claves al navegador. El proveedor externo recibirá el texto enviado
al asistente: informa de ese tratamiento antes de una publicación real con usuarios.

## Verificación
Las pruebas unitarias usan dobles de proveedor solo dentro de tests.
Assistant UI levanta API, PostgreSQL y Chromium en GitHub Actions, guarda capturas de
cookies/chat y verifica el modo búsqueda con Ollama ausente. Después arranca Ollama
aislado y ejecuta tools/verify-yomogan-live.js con los dos modelos reales.
El resultado de ese job, no la mera existencia del script, determina si la IA real
ha quedado verificada.

La pasada de avatar reutiliza el E2E de UI y el fallback real sin descargar modelos.
El workflow reserva la inferencia real para cambios del código de IA o ejecución manual.
La generación y los embeddings reales ya se verificaron remotamente en main a6ab6a3
([Actions](https://github.com/LucaMZM/nocturno/actions/runs/39650780324)); esto no certifica
la instalación ni el rendimiento de un Mac concreto.
