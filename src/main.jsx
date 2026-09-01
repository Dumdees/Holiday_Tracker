import { render } from 'preact';
import { App } from './app/App.jsx';
import { initStore } from './store/store.js';

const mount = document.getElementById('app');

initStore()
  .catch((err) => {
    console.error('Failed to start', err);
  })
  .finally(() => {
    render(<App />, mount);
  });
