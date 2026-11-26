import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { accesoActual } from '../infrastructure/acceso-actual';
import { rutaInicialPorRol } from '../domain/rutas-rol';

function guardPorRol(permitidos: readonly string[] | null): CanActivateFn {
  return async () => {
    const router = inject(Router);
    try {
      const perfil = await accesoActual.restaurarSesion();
      if (!perfil) return router.parseUrl('/inicio');
      return !permitidos || permitidos.includes(perfil.rol) ? true : router.parseUrl(rutaInicialPorRol(perfil.rol));
    } catch { return router.parseUrl('/inicio'); }
  };
}

export const sesionGuard = guardPorRol(null);
export const vecinalGuard = guardPorRol(['vecino', 'comerciante']);
export const autoridadGuard = guardPorRol(['autoridad']);
export const administradorGuard = guardPorRol(['administrador']);
