import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { accesoActual } from './acceso-actual';
import { apiAccesoHttp } from './api-acceso-http';
import { tokenSesion } from './token-sesion';
import { sesionGuard } from '../presentation/sesion-guard';

const perfil = {
  id: 8, nombre: 'Usuario de prueba', correo: 'test@test.invalid', telefono: null,
  rol: 'vecino', zona_id: 31, alias_chat: 'Usuario-TEST', modo_accesibilidad: false,
};

describe('sesión compartida', () => {
  beforeEach(() => accesoActual.cerrarSesion());
  afterEach(() => {
    accesoActual.cerrarSesion();
    vi.restoreAllMocks();
  });

  it('consulta el perfil con el token guardado y limpia la sesión al salir', async () => {
    tokenSesion.guardar('token-de-prueba');
    const consulta = vi.spyOn(apiAccesoHttp, 'perfil').mockResolvedValue(perfil);
    expect(await accesoActual.restaurarSesion()).toEqual(perfil);
    expect(await accesoActual.restaurarSesion()).toEqual(perfil);
    expect(consulta).toHaveBeenCalledTimes(1);
    expect(consulta).toHaveBeenCalledWith('token-de-prueba');

    accesoActual.cerrarSesion();
    expect(accesoActual.leerToken()).toBeNull();
    expect(await accesoActual.restaurarSesion()).toBeNull();
  });

  it('impide entrar al dashboard sin una sesión válida', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const router = TestBed.inject(Router);
    const resultado = await TestBed.runInInjectionContext(() => sesionGuard({} as never, {} as never));
    expect(router.serializeUrl(resultado as ReturnType<Router['parseUrl']>)).toBe('/inicio');
  });

  it('permite entrar a las rutas protegidas tras validar el perfil guardado', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    tokenSesion.guardar('token-de-prueba');
    const consulta = vi.spyOn(apiAccesoHttp, 'perfil').mockResolvedValue(perfil);
    const resultado = await TestBed.runInInjectionContext(() => sesionGuard({} as never, {} as never));
    expect(resultado).toBe(true);
    expect(consulta).toHaveBeenCalledWith('token-de-prueba');
  });
});
