import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar usuario desde localStorage al iniciar
  useEffect(() => {
    const storedUser = localStorage.getItem('app-user');
    const storedUserKey = localStorage.getItem('app-user-key');
    const storedCompany = localStorage.getItem('app-company');

    if (storedUser && storedUserKey) {
      setUser({
        username: storedUser,
        userKey: storedUserKey,
        company: storedCompany || 'MEG Industrial',
      });
    }
    setIsLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      // En desarrollo, usar localhost:3001, en producción usar la ruta relativa
      const isDev = import.meta.env.DEV;
      const apiUrl = isDev ? 'http://localhost:3001/api/login' : '/api/login';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        const userData = {
          username: data.username,
          userKey: data.userKey,
          company: data.company,
        };

        // Guardar en localStorage
        localStorage.setItem('app-user', data.username);
        localStorage.setItem('app-user-key', data.userKey);
        localStorage.setItem('app-company', data.company);

        setUser(userData);
        return { success: true };
      } else {
        return {
          success: false,
          error: data.message || 'Usuario o contraseña incorrectos',
        };
      }
    } catch (error) {
      console.error('Error en login:', error);
      return {
        success: false,
        error: 'Error de conexión con el servidor',
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('app-user');
    localStorage.removeItem('app-user-key');
    localStorage.removeItem('app-company');
    setUser(null);
  };

  const value = {
    user,
    isLoading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
}
