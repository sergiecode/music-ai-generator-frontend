import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/generator',
    pathMatch: 'full'
  },
  {
    path: 'generator',
    loadComponent: () => import('./pages/generator/generator.component').then(m => m.GeneratorComponent)
  },
  {
    path: '**',
    redirectTo: '/generator'
  }
];
