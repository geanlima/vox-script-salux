import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import {
  AuthResponse,
  AuthUser,
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload
} from '../models/auth.model';

const TOKEN_KEY = 'vox-auth-token';
const USER_KEY = 'vox-auth-user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = '/api/auth';

  private readonly currentUserSignal = signal<AuthUser | null>(this.restoreUser());

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  readonly isMaster = computed(() => this.currentUserSignal()?.role === 'master');

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {}

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/login`, payload)
      .pipe(tap((response) => this.storeSession(response, payload.rememberMe ?? false)));
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/register`, payload)
      .pipe(tap((response) => this.storeSession(response, false)));
  }

  changePassword(payload: ChangePasswordPayload): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/change-password`, payload);
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/login']);
  }

  clearSession(): void {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem(TOKEN_KEY);
      storage.removeItem(USER_KEY);
    }
    this.currentUserSignal.set(null);
  }

  private storeSession(response: AuthResponse, rememberMe: boolean): void {
    this.clearSession();

    // localStorage persiste após fechar o navegador; sessionStorage não.
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY, response.token);
    storage.setItem(USER_KEY, JSON.stringify(response.user));
    this.currentUserSignal.set(response.user);
  }

  private restoreUser(): AuthUser | null {
    const storage = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
    const token = storage.getItem(TOKEN_KEY);
    const userRaw = storage.getItem(USER_KEY);

    if (!token || !userRaw) {
      return null;
    }

    try {
      return JSON.parse(userRaw) as AuthUser;
    } catch {
      return null;
    }
  }
}
