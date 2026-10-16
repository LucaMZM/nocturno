# Frontend de Nocturno

Angular 22 con componentes standalone, Router, Reactive Forms, signals, SignalStore y HttpClient. `npm start` sirve la web en `http://localhost:4200` y `proxy.conf.json` reenvía `/api` al backend local en `http://localhost:3000`. `npm run build` y `npm test` verifican compilación y filtros.

El camino habitual es `app.routes.ts → Page → Component → Store → API Service → HTTP`. Descubrir conserva filtros en la URL, hace debounce de búsqueda y descarta respuestas antiguas. Las páginas de gestión viven bajo `/dashboard`, las compras bajo `/cart` y `/checkout`, y el historial y QR bajo `/account`.

El diseño mantiene negro, rojo y marfil; no hay usuario demo incrustado en el frontend. El seed del backend es la forma de crear cuentas locales de prueba. Consulta el [README principal](../README.md) para arrancar todo el producto.
