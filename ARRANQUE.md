# Arranque local de NOCTURNO

Con Postgres.app encendido, desde la raíz del proyecto:

```sh
./nocturno.sh          # Arrancar en segundo plano
./nocturno.sh stop     # Apagar
./nocturno.sh restart  # Reiniciar
./nocturno.sh status   # Comprobar procesos y HTTP
./nocturno.sh logs     # Última ejecución
```

Abre **http://localhost:4200**. Puedes cerrar la terminal.

El script arranca Angular, Gateway, Core, Yomogan, Ollama local y el listener de Stripe Sandbox cuando están instalados y configurados. Usa las claves de prueba de `backend/.env` y pasa a Core la firma del listener en memoria. Si NOCTURNO ya estaba arrancado con npm, usa `./nocturno.sh restart` la primera vez.

`stop` (también `npm run down`) apaga los procesos que arrancó NOCTURNO, incluidos Yomogan, Ollama y Stripe CLI. Postgres.app y un Ollama que ya estuviera funcionando por separado siguen bajo tu control.

Cada arranque guarda sus registros en un directorio privado bajo `.nocturno-local/run-*`. Si cae Core, ejecuta `./nocturno.sh` para recuperar el conjunto. Si aparece `EADDRINUSE`, el mensaje indica el comando para identificar quién escucha en ese puerto.

En macOS, si el proyecto está en un Escritorio sincronizado con iCloud, selecciona **Mantener descargado** en Finder para la carpeta del proyecto. Node y Angular leen miles de archivos de dependencias antes de escuchar por HTTP. Una copia fuera de iCloud también evita esa espera.

En macOS el lanzador detecta los archivos de arranque que iCloud ha dejado solo en la nube y muestra el progreso mientras los lee. El tiempo de espera de Core empieza después. El estado de Angular se comprueba cargando su página de inicio y el de Gateway consultando la configuración pública.
