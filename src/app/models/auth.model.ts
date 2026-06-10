export type UserRole = 'user' | 'master';

export interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface LoginPayload {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterPayload {
  username: string;
  displayName: string;
  password: string;
}

export interface ChangePasswordPayload {
  username: string;
  currentPassword: string;
  newPassword: string;
}
