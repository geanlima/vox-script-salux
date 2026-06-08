import { Routes } from '@angular/router';
import { AzureLayoutComponent } from './components/azure-layout/azure-layout.component';
import { ScriptFormComponent } from './components/script-form/script-form.component';
import { SyntaxValidationComponent } from './components/syntax-validation/syntax-validation.component';

export const routes: Routes = [
  {
    path: '',
    component: AzureLayoutComponent,
    children: [
      { path: '', component: ScriptFormComponent },
      { path: 'validacao', component: SyntaxValidationComponent }
    ]
  }
];
