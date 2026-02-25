import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Secret {
  id: string;
  name: string;
  service: string;
  key: string;
  masked: boolean;
  createdAt: string;
}

interface SecretsState {
  secrets: Secret[];
  loading: boolean;
  addSecret: (name: string, service: string, key: string) => void;
  removeSecret: (id: string) => void;
  updateSecret: (id: string, key: string) => void;
  getSecret: (service: string) => Secret | undefined;
  hasSecret: (service: string) => boolean;
  getDecryptedKey: (id: string) => string;
}

export const useSecretsStore = create<SecretsState>()(
  persist(
    (set, get) => ({
      secrets: [],
      loading: false,

      addSecret: (name: string, service: string, key: string) => {
        const id = `secret-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((state) => ({
          secrets: [
            ...state.secrets,
            {
              id,
              name,
              service,
              key,
              masked: true,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      },

      removeSecret: (id: string) => {
        set((state) => ({
          secrets: state.secrets.filter((s) => s.id !== id),
        }));
      },

      updateSecret: (id: string, key: string) => {
        set((state) => ({
          secrets: state.secrets.map((s) =>
            s.id === id ? { ...s, key, createdAt: new Date().toISOString() } : s
          ),
        }));
      },

      getSecret: (service: string) => {
        return get().secrets.find((s) => s.service === service);
      },

      hasSecret: (service: string) => {
        return get().secrets.some((s) => s.service === service);
      },

      getDecryptedKey: (id: string) => {
        const secret = get().secrets.find((s) => s.id === id);
        return secret?.key ?? '';
      },
    }),
    {
      name: 'harbinger-secrets',
    }
  )
);
