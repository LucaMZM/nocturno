# Arranque local de NOCTURNO

Con Postgres.app encendido, desde la raíz del proyecto:

```sh
./nocturno.sh          # Arrancar en segundo plano
./nocturno.sh down     # Apagar
./nocturno.sh restart  # Reiniciar
./nocturno.sh status   # Ver procesos
./nocturno.sh logs     # Ver registros
```

Abre **http://localhost:4200**. Puedes cerrar la terminal.

El script arranca Angular, Gateway, Core, Yomogan, Ollama local y el listener de Stripe Sandbox cuando están instalados y configurados. Usa las claves de prueba de `backend/.env` y pasa a Core la firma del listener en memoria. Si NOCTURNO ya estaba arrancado con npm, usa `./nocturno.sh restart` la primera vez.

`down` apaga los procesos que arrancó NOCTURNO, incluidos Yomogan, Ollama y Stripe CLI. Postgres.app y un Ollama que ya estuviera funcionando por separado siguen bajo tu control.
