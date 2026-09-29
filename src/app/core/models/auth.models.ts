export type UserRole = 'CUSTOMER' | 'WASHER' | 'ADMIN';

export interface RegisterRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface User {
  id?: string | number;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
}

export interface AuthResponse {
  token?: string;
  jwt?: string;
  accessToken?: string;
  user?: User;
  role?: UserRole;
  name?: string;
  email?: string;
  message?: string;
  success?: boolean;
}
