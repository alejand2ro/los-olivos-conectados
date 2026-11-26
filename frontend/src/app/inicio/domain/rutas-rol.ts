export function rutaInicialPorRol(rol: string): string {
  if (rol === 'vecino' || rol === 'comerciante') return '/dashboard';
  if (rol === 'autoridad') return '/autoridad';
  if (rol === 'administrador') return '/administracion';
  return '/inicio';
}
