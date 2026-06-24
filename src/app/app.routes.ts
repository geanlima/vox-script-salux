import { Routes } from '@angular/router';
import { AzureLayoutComponent } from './components/azure-layout/azure-layout.component';
import { BoasPraticasComponent } from './components/boas-praticas/boas-praticas.component';
import { LoginComponent } from './components/login/login.component';
import { ScriptFormComponent } from './components/script-form/script-form.component';
import { ScriptImportComponent } from './components/script-import/script-import.component';
import { ScriptLibraryComponent } from './components/script-library/script-library.component';
import { SyntaxValidationComponent } from './components/syntax-validation/syntax-validation.component';
import { authGuard } from './guards/auth.guard';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: AzureLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: ScriptFormComponent, canDeactivate: [unsavedChangesGuard] },
      { path: 'importar', component: ScriptImportComponent },
      { path: 'scripts', component: ScriptLibraryComponent },
      { path: 'validacao', component: SyntaxValidationComponent },
      { path: 'boas-praticas', component: BoasPraticasComponent }
    ]
  },
  { path: '**', redirectTo: '' }
];
