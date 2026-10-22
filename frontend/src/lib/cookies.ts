import Cookies from 'js-cookie';

export function getCookie(name: string): string | undefined {
  return Cookies.get(name);
}

export function setCookie(name: string, value: string, options?: Cookies.CookieAttributes): void {
  Cookies.set(name, value, {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...options,
  });
}

export function removeCookie(name: string): void {
  Cookies.remove(name, { path: '/' });
}

export function getAuthCookies() {
  return {
    accessToken: getCookie('access_token'),
    refreshToken: getCookie('refresh_token'),
    user: getCookie('user'),
  };
}

export function setAuthCookies(accessToken: string, refreshToken: string, user: any): void {
  setCookie('access_token', accessToken, { maxAge: 60 * 60 * 8 });
  setCookie('refresh_token', refreshToken, { maxAge: 60 * 60 * 24 * 30 });
  setCookie('user', JSON.stringify(user), { maxAge: 60 * 60 * 24 * 30 });
}

export function clearAuthCookies(): void {
  removeCookie('access_token');
  removeCookie('refresh_token');
  removeCookie('user');
}