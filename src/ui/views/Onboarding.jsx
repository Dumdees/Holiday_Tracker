// TODO: implemented by a later stage. First-run welcome wizard.
import { updateSettings } from '../../store/store.js';
export function Onboarding() {
  return (
    <div class="page">
      <h1>Welcome</h1>
      <button type="button" class="btn btn-primary" onClick={() => updateSettings({ onboardingComplete: true })}>Get started</button>
    </div>
  );
}
