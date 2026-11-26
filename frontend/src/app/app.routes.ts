import { Routes } from '@angular/router';
import { vecinalGuard, autoridadGuard, administradorGuard } from './inicio/presentation/sesion-guard';

export const routes: Routes = [
  {
    path: 'dashboard',
    canActivate: [vecinalGuard],
    loadComponent: () => import('./dashboard/presentation/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'alertas',
    loadComponent: () => import('./alertas/presentation/alertas.page').then((m) => m.AlertasPage),
  },
  {
    path: 'mis-reportes',
    canActivate: [vecinalGuard],
    loadComponent: () => import('./reportes/presentation/mis-reportes.page').then((m) => m.MisReportesPage),
  },
  {
    path: 'reportes/nuevo',
    canActivate: [vecinalGuard],
    loadComponent: () => import('./reportes/presentation/crear-reporte.page').then((m) => m.CrearReportePage),
  },
  {
    path: 'reportes/:id',
    canActivate: [vecinalGuard],
    loadComponent: () => import('./reportes/presentation/detalle-reporte.page').then((m) => m.DetalleReportePage),
  },
  {
    path: 'perfil',
    canActivate: [vecinalGuard],
    loadComponent: () => import('./perfil/presentation/perfil.page').then((m) => m.PerfilPage),
  },
  {
    path: 'notificaciones',
    canActivate: [vecinalGuard],
    loadComponent: () => import('./notificaciones/presentation/notificaciones.page').then((m) => m.NotificacionesPage),
  },
  {
    path: 'autoridad',
    canActivate: [autoridadGuard],
    loadComponent: () => import('./autoridad/presentation/autoridad.page').then((m) => m.AutoridadPage),
  },
  {
    path: 'administracion',
    canActivate: [administradorGuard],
    loadComponent: () => import('./administracion/presentation/administracion.page').then((m) => m.AdministracionPage),
  },
  {
    path: 'inicio',
    loadComponent: () => import('./inicio/presentation/inicio.page').then((m) => m.InicioPage),
  },
  {
    path: 'home',
    redirectTo: 'inicio',
    pathMatch: 'full',
  },
  {
    path: '',
    redirectTo: 'inicio',
    pathMatch: 'full',
  },
];
