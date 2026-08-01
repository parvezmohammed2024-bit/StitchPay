type ToastType = 'error' | 'success';

interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

type ToastListener = (toast: ToastMessage) => void;

const listeners = new Set<ToastListener>();

export function subscribeToast(listener: ToastListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function showErrorToast(message: string) {
  console.error('[Supabase Error]', message);
  const toast: ToastMessage = {
    id: Math.random().toString(36).substring(2, 9),
    message,
    type: 'error',
  };
  listeners.forEach(fn => fn(toast));
}

export function showSuccessToast(message: string) {
  const toast: ToastMessage = {
    id: Math.random().toString(36).substring(2, 9),
    message,
    type: 'success',
  };
  listeners.forEach(fn => fn(toast));
}
