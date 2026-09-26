import { api } from './client';
import type { AuthResponse, SignupResponse, UserResponse } from '../types';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

/**
 * Sign-up always resolves 201, whether or not the address was free. A null
 * `user` means it was already registered; see SignupResponse.
 */
export async function signup(
  email: string,
  displayName: string,
  password: string
): Promise<SignupResponse> {
  const { data } = await api.post<SignupResponse>('/auth/signup', { email, displayName, password });
  return data;
}

export async function me(): Promise<UserResponse> {
  const { data } = await api.get<UserResponse>('/auth/me');
  return data;
}
