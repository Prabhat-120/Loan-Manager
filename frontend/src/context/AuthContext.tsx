import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  authApi,
  UserSummary,
  LoginCredentials,
  FirstLoginChangePasswordData
} from '../api/auth-api';
import {
  getStoredAccessToken,
  setStoredAccessToken,
  getStoredRefreshToken,
  setStoredRefreshToken
} from '../api/axios-client';

interface AuthContextType {
  user: UserSummary | null;
  accessToken: string | null;
  restrictedToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  firstLoginRequired: boolean;
  login: (credentials: LoginCredentials) => Promise<{ firstLoginRequired: boolean }>;
  firstLoginChangePassword: (data: FirstLoginChangePasswordData) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(getStoredAccessToken());
  const [restrictedToken, setRestrictedToken] = useState<string | null>(null);
  const [firstLoginRequired, setFirstLoginRequired] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = getStoredAccessToken();
      if (token) {
        try {
          const data = await authApi.getMe();
          setUser(data.user);
        } catch {
          setStoredAccessToken(null);
          setStoredRefreshToken(null);
          setAccessToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const res = await authApi.login(credentials);
    if (res.firstLoginRequired && res.firstLoginToken) {
      setRestrictedToken(res.firstLoginToken);
      setFirstLoginRequired(true);
      setUser(res.user);
      return { firstLoginRequired: true };
    }

    if (res.accessToken && res.refreshToken) {
      setStoredAccessToken(res.accessToken);
      setStoredRefreshToken(res.refreshToken);
      setAccessToken(res.accessToken);
      setUser(res.user);
      setFirstLoginRequired(false);
      setRestrictedToken(null);
      return { firstLoginRequired: false };
    }

    throw new Error('Invalid authentication response');
  };

  const firstLoginChangePassword = async (data: FirstLoginChangePasswordData) => {
    const token = restrictedToken || getStoredAccessToken() || undefined;
    const res = await authApi.firstLoginChangePassword(data, token);
    setStoredAccessToken(res.accessToken);
    setStoredRefreshToken(res.refreshToken);
    setAccessToken(res.accessToken);
    setUser(res.user);
    setFirstLoginRequired(false);
    setRestrictedToken(null);
  };

  const logout = async () => {
    const refreshToken = getStoredRefreshToken();
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // Ignore logout errors
    } finally {
      setStoredAccessToken(null);
      setStoredRefreshToken(null);
      setAccessToken(null);
      setUser(null);
      setFirstLoginRequired(false);
      setRestrictedToken(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        restrictedToken,
        isAuthenticated: !!user && !firstLoginRequired,
        isLoading,
        firstLoginRequired,
        login,
        firstLoginChangePassword,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
