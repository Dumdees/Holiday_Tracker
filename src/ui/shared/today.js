// "Today" as a signal, so the app rolls over correctly if left open overnight.
import { signal } from '@preact/signals';
import { todayISO } from '../../core/dates.js';

export const today = signal(todayISO());

if (typeof window !== 'undefined') {
  setInterval(() => {
    const t = todayISO();
    if (t !== today.value) today.value = t;
  }, 60 * 1000);
}
