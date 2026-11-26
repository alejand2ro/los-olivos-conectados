import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { provideIonicAngular } from '@ionic/angular';
import { AppComponent } from './app.component';
import { routes } from './app.routes';
import { InicioPage } from './inicio/presentation/inicio.page';
import { accesoActual } from './inicio/infrastructure/acceso-actual';
import { apiAccesoHttp } from './inicio/infrastructure/api-acceso-http';
import { tokenSesion } from './inicio/infrastructure/token-sesion';
import { apiAlertasHttp } from './alertas/infrastructure/api-alertas-http';
import { apiReportesHttp } from './reportes/infrastructure/api-reportes-http';
import { apiNotificacionesHttp } from './notificaciones/infrastructure/api-notificaciones-http';
import { apiCrearReporteHttp } from './reportes/infrastructure/api-crear-reporte-http';
import { CrearReportePage } from './reportes/presentation/crear-reporte.page';
import { AdministracionPage } from './administracion/presentation/administracion.page';
import { apiAltaAutoridadHttp } from './administracion/infrastructure/api-alta-autoridad-http';

const perfil = {
  id: 11, nombre: 'Ana Torres', correo: 'ana@test.invalid', telefono: null,
  rol: 'vecino', zona_id: 37, alias_chat: 'Usuario-TEST', modo_accesibilidad: false,
};

describe('navegación integrada de sesión', () => {
  beforeEach(async () => {
    accesoActual.cerrarSesion();
    vi.spyOn(apiAccesoHttp, 'login').mockResolvedValue({
      token: 'token-de-prueba', usuario: { id: perfil.id, nombre: perfil.nombre, rol: perfil.rol, zona_id: perfil.zona_id },
    });
    vi.spyOn(apiAccesoHttp, 'perfil').mockResolvedValue(perfil);
    vi.spyOn(apiAccesoHttp, 'catalogos').mockResolvedValue({
      zonas: [{ id: 37, nombre: 'Zona de prueba', descripcion: null }], roles_publicos: [],
      tipos_incidente: [], niveles_gravedad: [], estados_reporte: [],
    });
    vi.spyOn(apiReportesHttp, 'listar').mockResolvedValue({ resultados: [], pagina: 1, tamano_pagina: 20, total: 0, total_paginas: 0 });
    vi.spyOn(apiAlertasHttp, 'listar').mockResolvedValue({ resultados: [], pagina: 1, tamano_pagina: 20, total: 0, total_paginas: 0 });
    vi.spyOn(apiNotificacionesHttp, 'listar').mockResolvedValue({ resultados: [], pagina: 1, tamano_pagina: 20, total: 0, total_paginas: 0 });
    vi.spyOn(apiAccesoHttp, 'actualizarPerfil').mockImplementation(async (_token, cambios) => ({ ...perfil, ...cambios }));
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideIonicAngular(),
        provideRouter(routes),
      ],
    }).compileComponents();
  });

  afterEach(() => {
    accesoActual.cerrarSesion();
    vi.restoreAllMocks();
  });

  function cabecera(fixture: ReturnType<typeof TestBed.createComponent<AppComponent>>): HTMLElement {
    const encabezados = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('app-site-header');
    expect(encabezados).toHaveLength(1);
    return encabezados[0];
  }

  function comprobarMenuAutenticado(header: HTMLElement): void {
    expect([...header.querySelectorAll('.nav-auth > *')].map((item) => item.textContent?.trim())).toEqual([
      'Inicio', 'Mapa Comunitario Próximamente', 'Mis Reportes',
      'Chat Vecinal Próximamente', 'Alertas verificadas',
    ]);
    expect(header.querySelector<HTMLAnchorElement>('.nav-auth a')?.getAttribute('href')).toBe('/dashboard');
    expect(header.querySelector('button[aria-label="Notificaciones"]')).not.toBeNull();
    expect([...header.querySelectorAll('button')].filter((boton) => boton.textContent?.trim() === 'Cerrar sesión')).toHaveLength(0);
    expect(header.textContent).toContain(perfil.nombre);
  }

  function comprobarActivo(header: HTMLElement, ruta: string): void {
    expect(header.querySelector<HTMLAnchorElement>('.nav-auth a[aria-current="page"]')?.getAttribute('href')).toBe(ruta);
  }

  it('entra al dashboard desde el login con el menú completo sin visitar otra página', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/inicio');
    await fixture.whenStable();
    fixture.detectChanges();

    const inicio = fixture.debugElement.query(By.directive(InicioPage)).componentInstance as InicioPage;
    await inicio.entrar({ correo: 'ana@test.invalid', contrasena: 'clave-de-prueba' });
    fixture.detectChanges();
    expect(router.url).toBe('/dashboard');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-inicio')).toBeNull();
    const header = cabecera(fixture);
    comprobarMenuAutenticado(header);
    expect(apiAccesoHttp.perfil).toHaveBeenCalledTimes(1);
    await fixture.whenStable();
    fixture.detectChanges();
    comprobarActivo(header, '/dashboard');
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(header.textContent).toContain('Zona de prueba');
    });
  });

  it('valida el token guardado al cargar directamente /dashboard', async () => {
    tokenSesion.guardar('token-de-prueba');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();
    expect(router.url).toBe('/dashboard');
    comprobarMenuAutenticado(cabecera(fixture));
    await fixture.whenStable();
    fixture.detectChanges();
    comprobarActivo(cabecera(fixture), '/dashboard');
    expect(apiAccesoHttp.perfil).toHaveBeenCalledTimes(1);
  });

  it('mantiene el menú autenticado al ir de Dashboard a Alertas y volver', async () => {
    tokenSesion.guardar('token-de-prueba');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();
    comprobarMenuAutenticado(cabecera(fixture));
    await fixture.whenStable();
    fixture.detectChanges();
    comprobarActivo(cabecera(fixture), '/dashboard');

    await router.navigateByUrl('/alertas');
    await fixture.whenStable();
    fixture.detectChanges();
    comprobarMenuAutenticado(cabecera(fixture));
    await vi.waitFor(() => {
      fixture.detectChanges();
      comprobarActivo(cabecera(fixture), '/alertas');
    });

    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();
    comprobarMenuAutenticado(cabecera(fixture));
    await fixture.whenStable();
    fixture.detectChanges();
    comprobarActivo(cabecera(fixture), '/dashboard');
    expect(apiAccesoHttp.perfil).toHaveBeenCalledTimes(1);
  });

  it('vuelve a la cabecera pública tras cerrar sesión y permite Alertas sin token', async () => {
    tokenSesion.guardar('token-de-prueba');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/dashboard');
    fixture.detectChanges();
    cabecera(fixture).querySelector<HTMLButtonElement>('.account-button')!.click();
    fixture.detectChanges();
    expect([...cabecera(fixture).querySelectorAll('#panel-cuenta > *')].slice(-2).map((item) => item.textContent?.trim())).toEqual(['Editar perfil', 'Cerrar sesión']);
    expect([...cabecera(fixture).querySelectorAll('button')].filter((boton) => boton.textContent?.trim() === 'Cerrar sesión')).toHaveLength(1);
    cabecera(fixture).querySelector<HTMLButtonElement>('#panel-cuenta button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/inicio');
    expect(accesoActual.leerToken()).toBeNull();
    expect([...cabecera(fixture).querySelectorAll('nav a')].map((item) => item.textContent?.trim())).toEqual(['Inicio']);
    expect(cabecera(fixture).querySelector('.header-actions')).toBeNull();

    await router.navigateByUrl('/alertas');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/alertas');
    expect([...cabecera(fixture).querySelectorAll('nav a')].map((item) => item.textContent?.trim())).toEqual(['Inicio']);
  });

  it('edita perfil, conserva el cambio en la sesión y lo recarga desde la API', async () => {
    tokenSesion.guardar('token-de-prueba');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/dashboard');
    await fixture.whenStable();
    fixture.detectChanges();
    cabecera(fixture).querySelector<HTMLButtonElement>('.account-button')!.click();
    fixture.detectChanges();
    cabecera(fixture).querySelector<HTMLAnchorElement>('#panel-cuenta a')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/perfil');
    const telefono = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#telefono-perfil')!;
    telefono.value = ' 999 888 ';
    telefono.dispatchEvent(new Event('input'));
    (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(apiAccesoHttp.actualizarPerfil).toHaveBeenCalledWith('token-de-prueba', { telefono: '999 888', modo_accesibilidad: true });
    expect(accesoActual.perfilValidado()?.telefono).toBe('999 888');
    expect(document.documentElement.classList.contains('modo-accesible-cuenta')).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Tu perfil se guardó correctamente.');
    await router.navigateByUrl('/dashboard');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(cabecera(fixture).textContent).toContain(perfil.nombre);
    expect(accesoActual.perfilValidado()?.modo_accesibilidad).toBe(true);
    accesoActual.cerrarSesion();
    tokenSesion.guardar('token-de-prueba');
    vi.mocked(apiAccesoHttp.perfil).mockResolvedValue({ ...perfil, telefono: '999 888', modo_accesibilidad: true });
    await router.navigateByUrl('/perfil');
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#telefono-perfil')?.value).toBe('999 888');
    const telefonoRecargado = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#telefono-perfil')!;
    telefonoRecargado.value = '';
    telefonoRecargado.dispatchEvent(new Event('input'));
    (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(apiAccesoHttp.actualizarPerfil).toHaveBeenLastCalledWith('token-de-prueba', { telefono: null, modo_accesibilidad: true });
    expect(accesoActual.perfilValidado()?.telefono).toBeNull();
  });

  it('abre la campana, muestra estado vacío real y navega al historial protegido', async () => {
    tokenSesion.guardar('token-de-prueba');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/dashboard');
    await fixture.whenStable();
    fixture.detectChanges();
    cabecera(fixture).querySelector<HTMLButtonElement>('button[aria-label="Notificaciones"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(apiNotificacionesHttp.listar).toHaveBeenCalledWith('token-de-prueba', 1);
    expect(cabecera(fixture).textContent).toContain('Todavía no tienes notificaciones.');
    cabecera(fixture).querySelector<HTMLAnchorElement>('a[href="/notificaciones"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/notificaciones');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Todavía no tienes notificaciones.');
    expect((fixture.nativeElement as HTMLElement).querySelector('.nav-public')).toBeNull();
    accesoActual.cerrarSesion();
    await router.navigateByUrl('/inicio');
    await router.navigateByUrl('/notificaciones');
    expect(router.url).toBe('/inicio');
  });

  it('comparte avisos reales entre campana e historial y pagina sin mezclar usuarios', async () => {
    const aviso = {
      id: 7, tipo: 'cambio_estado' as const, alerta_id: null, reporte_id: 13,
      leido: false, fecha_envio: '2026-01-01T12:00:00.000Z',
    };
    vi.mocked(apiNotificacionesHttp.listar).mockImplementation(async (_token, numero) => numero === 1
      ? { resultados: [aviso], pagina: 1, tamano_pagina: 20, total: 21, total_paginas: 2 }
      : { resultados: [{ ...aviso, id: 6 }], pagina: 2, tamano_pagina: 20, total: 21, total_paginas: 2 });
    tokenSesion.guardar('token-de-prueba');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/dashboard');
    await fixture.whenStable();
    fixture.detectChanges();
    cabecera(fixture).querySelector<HTMLButtonElement>('button[aria-label="Notificaciones"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(cabecera(fixture).textContent).toContain('Reporte #13');
    cabecera(fixture).querySelector<HTMLAnchorElement>('a[href="/notificaciones"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Reporte #13');
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.pagination button:last-child')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(apiNotificacionesHttp.listar).toHaveBeenCalledWith('token-de-prueba', 2);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Página 2 de 2');
  });

  it('abre el formulario desde dashboard y vuelve a consultar Mis Reportes tras crear uno', async () => {
    let enviado = false;
    vi.mocked(apiAccesoHttp.catalogos).mockResolvedValue({
      zonas: [
        { id: 37, nombre: 'Zona de prueba', descripcion: null },
        { id: 44, nombre: 'Otra zona de prueba', descripcion: null },
      ], roles_publicos: [],
      tipos_incidente: [{ id: 5, nombre: 'Incidente de prueba', icono: null }],
      niveles_gravedad: [{ id: 8, nombre: 'Media', orden: 2, color: null }],
      estados_reporte: [{ id: 2, codigo: 'recibido', nombre: 'Recibido', orden: 1 }],
    });
    vi.mocked(apiReportesHttp.listar).mockImplementation(async () => ({
      resultados: enviado ? [{ id: 91, tipo_incidente: 'Incidente de prueba', zona_id: 44,
        estado_codigo: 'recibido', estado_nombre: 'Recibido', verificado: false,
        es_sos: false, fecha_creacion: '2026-11-15T12:00:00.000Z' }] : [],
      pagina: 1, tamano_pagina: 20, total: enviado ? 1 : 0, total_paginas: enviado ? 1 : 0,
    }));
    const crear = vi.spyOn(apiCrearReporteHttp, 'crear').mockImplementation(async () => {
      enviado = true;
      return { id: 91, estado_codigo: 'recibido', estado_nombre: 'Recibido', fecha_creacion: '2026-11-15T12:00:00.000Z' };
    });
    tokenSesion.guardar('token-de-prueba');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/dashboard');
    await fixture.whenStable();
    fixture.detectChanges();
    const consultasPrevias = vi.mocked(apiReportesHttp.listar).mock.calls.length;
    (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('a[href="/reportes/nuevo"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/reportes/nuevo');
    const pagina = fixture.debugElement.query(By.directive(CrearReportePage)).componentInstance as CrearReportePage;
    expect(pagina.formulario.controls.zona_id.value).toBe('37');
    pagina.formulario.patchValue({
      tipo_incidente_id: '5', nivel_gravedad_id: '8', zona_id: '44',
      descripcion_texto: 'Incidente real de prueba',
    });
    pagina.cambiarPunto({ latitud: -11.9823, longitud: -77.0645 });
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(crear).toHaveBeenCalledOnce();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('reporte #91');
    (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('.primary-link')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/mis-reportes');
    expect(vi.mocked(apiReportesHttp.listar).mock.calls.length).toBeGreaterThan(consultasPrevias);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Reporte #91');
  });

  it('protege el formulario de creación si no hay sesión', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/reportes/nuevo');
    await fixture.whenStable();
    expect(router.url).toBe('/inicio');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-crear-reporte')).toBeNull();
  });

  it('dirige al Administrador a su espacio y crea Autoridad sin mostrar navegación vecinal', async () => {
    const interno = { ...perfil, id: 31, nombre: 'Administradora de prueba', rol: 'administrador', zona_id: null, alias_chat: null };
    vi.mocked(apiAccesoHttp.login).mockResolvedValue({ token: 'token-admin', usuario: interno });
    vi.mocked(apiAccesoHttp.perfil).mockResolvedValue(interno);
    const alta = vi.spyOn(apiAltaAutoridadHttp, 'crear').mockResolvedValue({ id: 32, nombre: 'Autoridad de prueba',
      correo: 'autoridad@test.invalid', rol: 'autoridad', zona_id: null, alias_chat: null });
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/inicio');
    await fixture.whenStable(); fixture.detectChanges();
    const inicio = fixture.debugElement.query(By.directive(InicioPage)).componentInstance as InicioPage;
    await inicio.entrar({ correo: 'admin@test.invalid', contrasena: 'clave-de-prueba' });
    await fixture.whenStable(); fixture.detectChanges();
    expect(router.url).toBe('/administracion');
    expect((fixture.nativeElement as HTMLElement).querySelector('.nav-public')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.nav-auth')?.textContent).toContain('Administración');
    expect((fixture.nativeElement as HTMLElement).querySelector('button[aria-label="Notificaciones"]')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(interno.nombre);
    const pagina = fixture.debugElement.query(By.directive(AdministracionPage)).componentInstance as AdministracionPage;
    pagina.formulario.setValue({ nombre: 'Autoridad de prueba', correo: 'autoridad@test.invalid', contrasena: 'clave-autoridad' });
    await pagina.guardar(); fixture.detectChanges();
    expect(alta).toHaveBeenCalledWith('token-admin', {
      nombre: 'Autoridad de prueba', correo: 'autoridad@test.invalid', contrasena: 'clave-autoridad',
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cuenta de Autoridad #32 creada');
    await router.navigateByUrl('/dashboard');
    expect(router.url).toBe('/administracion');
  });

  it('dirige a Autoridad a su panel y rechaza las rutas de Administración y Vecino', async () => {
    const interno = { ...perfil, id: 44, nombre: 'Autoridad de prueba', rol: 'autoridad', zona_id: null, alias_chat: null };
    vi.mocked(apiAccesoHttp.login).mockResolvedValue({ token: 'token-autoridad', usuario: interno });
    vi.mocked(apiAccesoHttp.perfil).mockResolvedValue(interno);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/inicio');
    await fixture.whenStable(); fixture.detectChanges();
    const inicio = fixture.debugElement.query(By.directive(InicioPage)).componentInstance as InicioPage;
    await inicio.entrar({ correo: 'autoridad@test.invalid', contrasena: 'clave-de-prueba' });
    await fixture.whenStable(); fixture.detectChanges();
    expect(router.url).toBe('/autoridad');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Panel de Autoridad');
    expect((fixture.nativeElement as HTMLElement).querySelector('.nav-auth')?.textContent).not.toContain('Mis Reportes');
    expect((fixture.nativeElement as HTMLElement).querySelector('button[aria-label="Notificaciones"]')).toBeNull();
    await router.navigateByUrl('/administracion');
    expect(router.url).toBe('/autoridad');
    await router.navigateByUrl('/mis-reportes');
    expect(router.url).toBe('/autoridad');
    await router.navigateByUrl('/alertas');
    await fixture.whenStable(); fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.nav-auth')?.textContent).toContain('Panel de Autoridad');
    await router.navigateByUrl('/autoridad');
    await fixture.whenStable(); fixture.detectChanges();
    cabecera(fixture).querySelector<HTMLButtonElement>('.account-button')!.click();
    fixture.detectChanges();
    await cabecera(fixture).querySelector<HTMLButtonElement>('.account-panel button')!.click();
    await fixture.whenStable(); fixture.detectChanges();
    expect(router.url).toBe('/inicio');
    expect((fixture.nativeElement as HTMLElement).querySelector('.nav-public')).not.toBeNull();
  });
});
