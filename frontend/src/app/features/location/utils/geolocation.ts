export type Coordinates = { latitude: number; longitude: number };

export function locateUser(geolocation: Pick<Geolocation, 'getCurrentPosition'> | undefined): Promise<Coordinates> {
  if (!geolocation) return Promise.reject(new Error('UNSUPPORTED'));
  return new Promise((resolve, reject) => geolocation.getCurrentPosition(
    (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
    reject,
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
  ));
}

export function geolocationMessage(error: unknown): string {
  if (error instanceof Error && error.message === 'UNSUPPORTED')
    return 'Tu navegador no ofrece localización. Selecciona una ciudad manualmente.';
  const code = (error as GeolocationPositionError | undefined)?.code;
  if (code === 1) return 'Has bloqueado la ubicación. Puedes elegir una ciudad manualmente.';
  if (code === 3) return 'La ubicación tardó demasiado. Prueba de nuevo o elige una ciudad.';
  return 'No hemos podido obtener tu ubicación. Selecciona una ciudad manualmente.';
}
