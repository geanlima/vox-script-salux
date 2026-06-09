import { CanDeactivateFn } from '@angular/router';
import { ScriptFormComponent } from '../components/script-form/script-form.component';

export const unsavedChangesGuard: CanDeactivateFn<ScriptFormComponent> = (component) =>
  component.confirmLeave();
