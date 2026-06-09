import { Routes } from '@angular/router';
import { AzureLayoutComponent } from './components/azure-layout/azure-layout.component';
import { ScriptFormComponent } from './components/script-form/script-form.component';
import { ScriptLibraryComponent } from './components/script-library/script-library.component';
import { SyntaxValidationComponent } from './components/syntax-validation/syntax-validation.component';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';

export const routes: Routes = [
  {
    path: '',
    component: AzureLayoutComponent,
    children: [
      { path: '', component: ScriptFormComponent, canDeactivate: [unsavedChangesGuard] },
      { path: 'scripts', component: ScriptLibraryComponent },
      { path: 'validacao', component: SyntaxValidationComponent }
    ]
  }
];
