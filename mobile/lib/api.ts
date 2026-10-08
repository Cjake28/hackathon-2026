import Constants from 'expo-constants';
import { fetch as streamingFetch } from 'expo/fetch';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// EXPO_PUBLIC_API_URL wins (e.g. a deployed API). Otherwise use the computer running `expo start`:
// a phone or emulator can't reach "localhost", but it can reach the dev server's IP.
const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
export const API_URL = process.env.EXPO_PUBLIC_API_URL || `http://${host}:4101/api`;

// The session token from login. SecureStore on phones, localStorage on Expo web.
const TOKEN_KEY = 'token';
export const token = {
  get: async () =>
    Platform.OS === 'web' ? localStorage.getItem(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY),
  set: async (value: string) =>
    Platform.OS === 'web'
      ? localStorage.setItem(TOKEN_KEY, value)
      : SecureStore.setItemAsync(TOKEN_KEY, value),
  clear: async () =>
    Platform.OS === 'web'
      ? localStorage.removeItem(TOKEN_KEY)
      : SecureStore.deleteItemAsync(TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function authHeaders(json: boolean) {
  const headers: Record<string, string> = {};
  const session = await token.get();
  if (session) headers.Authorization = `Bearer ${session}`;
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

const unreachable = () => new ApiError(`Can't reach the API at ${API_URL}. Is it running? Firewall?`, 0);

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers = await authHeaders(body !== undefined);
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'omit', // the bearer token is the session; ignore the web cookie
  }).catch(() => {
    throw unreachable();
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.message ?? `${res.status} ${res.statusText}`, res.status);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

// POSTs and reads a streamed text reply (AI chat). React Native's fetch can't stream; expo/fetch can.
export async function streamText(path: string, body: unknown, onText: (text: string) => void) {
  const res = await streamingFetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify(body),
    credentials: 'omit',
  }).catch(() => {
    throw unreachable();
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new ApiError(data?.message ?? `${res.status} ${res.statusText}`, res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onText(decoder.decode(value, { stream: true }));
  }
}
