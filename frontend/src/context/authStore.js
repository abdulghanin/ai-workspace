import { create } from 'zustand';
import api from '../utils/api.js';

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  loading: false,
  initialized: false,

  init: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ initialized: true });
      return;
    }
    try {
      const res = await api.get('/auth/me');
      set({ user: res.data.user, initialized: true });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, initialized: true });
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      set({ user: res.data.user, token: res.data.token, loading: false });
      return { success: true };
    } catch (err) {
      set({ loading: false });
      return { success: false, error: err.response?.data?.message || 'Login failed' };
    }
  },

  register: async (username, email, password) => {
    set({ loading: true });
    try {
      const res = await api.post('/auth/register', { username, email, password });
      localStorage.setItem('token', res.data.token);
      set({ user: res.data.user, token: res.data.token, loading: false });
      return { success: true };
    } catch (err) {
      set({ loading: false });
      return { success: false, error: err.response?.data?.message || 'Registration failed' };
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));
