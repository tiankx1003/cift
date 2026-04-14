const TOKEN_KEY = 'cift_token';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);

export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);

export const removeToken = () => localStorage.removeItem(TOKEN_KEY);

export const getAuthHeaders = (): Record<string, string> => {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};
