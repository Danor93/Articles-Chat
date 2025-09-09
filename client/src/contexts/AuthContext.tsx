import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../lib/api';

// Types for authentication
export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
  full_name: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  logout: () => void;
  updateProfile: (data: { full_name: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Token storage keys
const TOKEN_KEY = 'clarticle_auth_token';
const USER_KEY = 'clarticle_user';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem(TOKEN_KEY);
        const storedUser = localStorage.getItem(USER_KEY);

        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(parsedUser);
          
          // Set axios default auth header
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          
          // Verify token is still valid by fetching user profile
          try {
            const response = await api.get<User>('/auth/me');
            setUser(response.data);
          } catch (error) {
            // Token is invalid, clear auth state
            console.log('Token expired or invalid, clearing auth state');
            clearAuthState();
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        clearAuthState();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Listen for token invalidation events from API interceptor
  useEffect(() => {
    const handleTokenInvalid = () => {
      console.log('Received token invalid event, clearing auth state');
      clearAuthState();
    };

    window.addEventListener('auth-token-invalid', handleTokenInvalid);
    return () => {
      window.removeEventListener('auth-token-invalid', handleTokenInvalid);
    };
  }, []);

  const clearAuthState = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    delete api.defaults.headers.common['Authorization'];
  };

  const login = async (credentials: LoginCredentials): Promise<void> => {
    try {
      const response = await api.post<AuthResponse>('/auth/login', credentials);
      const { user: userData, token: userToken } = response.data;

      setUser(userData);
      setToken(userToken);

      // Store in localStorage
      localStorage.setItem(TOKEN_KEY, userToken);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));

      // Set axios default auth header
      api.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signup = async (credentials: SignupCredentials): Promise<void> => {
    try {
      await api.post('/auth/signup', credentials);
      // After successful signup, automatically log in
      await login({
        email: credentials.email,
        password: credentials.password,
      });
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Call logout endpoint if token exists
      if (token) {
        try {
          await api.post('/auth/logout');
        } catch (error) {
          // Don't throw error on logout endpoint failure
          console.log('Logout endpoint failed, but clearing local state anyway');
        }
      }
    } finally {
      clearAuthState();
    }
  };

  const updateProfile = async (data: { full_name: string }): Promise<void> => {
    try {
      const response = await api.put<User>('/auth/profile', data);
      setUser(response.data);
      localStorage.setItem(USER_KEY, JSON.stringify(response.data));
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    signup,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};