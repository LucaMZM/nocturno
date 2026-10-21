export interface CookieChoice {
  version: 1;
  necessary: true;
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
}
export const COOKIE_CHOICE_KEY = 'nocturno_cookie_demo_v1';

export function cookieChoice(optional = false): CookieChoice {
  return {
    version: 1,
    necessary: true,
    preferences: optional,
    analytics: optional,
    marketing: optional,
  };
}

export function readCookieChoice(storage: Pick<Storage, 'getItem'> | null): CookieChoice | null {
  try {
    const value: unknown = JSON.parse(storage?.getItem(COOKIE_CHOICE_KEY) ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const choice = value as Partial<CookieChoice>;
    return choice.version === 1 &&
      choice.necessary === true &&
      ['preferences', 'analytics', 'marketing'].every(
        (key) => typeof (choice as unknown as Record<string, unknown>)[key] === 'boolean',
      )
      ? {
          version: 1,
          necessary: true,
          preferences: choice.preferences!,
          analytics: choice.analytics!,
          marketing: choice.marketing!,
        }
      : null;
  } catch {
    return null;
  }
}
