export interface CookieChoice {
  version: 2;
  necessary: true;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
}
export const COOKIE_CHOICE_KEY = 'nocturno_cookie_preferences_v2';

export function cookieChoice(optional = false): CookieChoice {
  return {
    version: 2,
    necessary: true,
    preferences: optional,
    analytics: false,
    marketing: false,
  };
}

export function readCookieChoice(storage: Pick<Storage, 'getItem'> | null): CookieChoice | null {
  try {
    const value: unknown = JSON.parse(storage?.getItem(COOKIE_CHOICE_KEY) ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const choice = value as Partial<CookieChoice>;
    return choice.version === 2 &&
      choice.necessary === true &&
      ['preferences', 'analytics', 'marketing'].every(
        (key) => typeof (choice as unknown as Record<string, unknown>)[key] === 'boolean',
      )
      ? {
          version: 2,
          necessary: true,
          preferences: choice.preferences!,
          analytics: false,
          marketing: false,
        }
      : null;
  } catch {
    return null;
  }
}
