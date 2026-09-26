import { api, authApiRaw } from './client';
import type { AuthResponse, SignupResponse, UserResponse } from '../types';

/**
 * Sign-in and sign-up go through the bare instance so a 401 from a wrong
 * password never triggers the refresh-and-retry interceptor: a failed sign-in
 * is an ordinary 401, not an expired session.
 */
export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await authApiRaw.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

/**
 * Sign-up always resolves 201, whether or not the address was free. A null
 * `user` means it was already registered; see SignupResponse. In that case the
 * server issues no session cookie, so there is nothing to store either way.
 */
export async function signup(
  email: string,
  displayName: string,
  password: string
): Promise<SignupResponse> {
  const { data } = await authApiRaw.post<SignupResponse>('/auth/signup', {
    email,
    displayName,
    password,
  });
  return data;
}

/**
 * Renews the access cookie from the refresh cookie.
 *
 * Called on every page load to see whether there is still a session, and again
 * by the interceptor when an access token expires mid-visit.
 */
export async function refresh(): Promise<AuthResponse> {
  const { data } = await authApiRaw.post<AuthResponse>('/auth/refresh');
  return data;
}

/** Revokes the refresh token server-side and clears the cookies. */
export async function logout(): Promise<void> {
  await authApiRaw.post('/auth/logout');
}

export async function me(): Promise<UserResponse> {
  const { data } = await api.get<UserResponse>('/auth/me');
  return data;
}
