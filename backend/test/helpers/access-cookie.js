// Test-only helper: real browsers never read HttpOnly cookies.
// Node.js integration tests can read Set-Cookie and emulate a legacy Bearer client.
export function accessTokenFromResponse(response) {
  const cookie = response.headers.getSetCookie()
    .find((value) => value.startsWith('nocturno_access=') ||
      value.startsWith('__Host-nocturno_access='));
  if (!cookie) return null;
  return cookie.split(';')[0].split('=').slice(1).join('=');
}
