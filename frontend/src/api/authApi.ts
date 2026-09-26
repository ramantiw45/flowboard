import { api } from './client';
import type { AuthResponse, UserResponse } from '../types';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

export async function signup(
  email: string,
  displayName: string,
  password: string
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/signup', { email, displayName, password });
  return data;
}

export async function me(): Promise<UserResponse> {
  const { data } = await api.get<UserResponse>('/auth/me');
  return data;
}
