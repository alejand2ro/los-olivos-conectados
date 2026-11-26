import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { accesoActual } from '../../../inicio/infrastructure/acceso-actual';
import { SiteHeaderComponent } from './site-header.component';
import { apiNotificacionesHttp } from '../../../notificaciones/infrastructure/api-notificaciones-http';

@Component({ template: '' })
class PaginaVacia {}

const perfil = {
  id: 12,
  nombre: 'Ana Torres',
  correo: 'ana@test.invalid',
  telefono: null,
  rol: 'vecino',
  zona_id: 37,
  alias_chat: 'Usuario-TEST',
  modo_accesibilidad: false,
};

describe('SiteHeaderComponent', () => {
  let fixture: ComponentFixture<SiteHeaderComponent>;
  let router: Router;

  beforeEach(async () => {
    vi.spyOn(apiNotificacionesHttp, 'listar').mockResolvedValue({ resultados: [], pagina: 1, tamano_pagina: 20, total: 0, total_paginas: 0 });
    await TestBed.configureTestingModule({
      imports: [SiteHeaderComponent],
      providers: [provideRouter([
        { path: 'inicio', component: PaginaVacia },
        { path: 'dashboard', component: PaginaVacia },
        { path: 'mis-reportes', component: PaginaVacia },
        { path: 'alertas', component: PaginaVacia },
      ])],
    }).compileComponents();
    router = TestBed.inject(Router);
  });

  afterEach(() => vi.restoreAllMocks());

  async function montar(soloPublico = false): Promise<HTMLElement> {
    fixture = TestBed.createComponent(SiteHeaderComponent);
    fixture.componentInstance.soloPublico = soloPublico;
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra solo Inicio en el acceso público y en alertas sin sesión', async () => {
    const restaurar = vi.spyOn(accesoActual, 'restaurarSesion').mockResolvedValue(null);
    await router.navigateByUrl('/alertas');
    const elemento = await montar();
    expect([...elemento.querySelectorAll('nav a')].map((a) => a.textContent?.trim())).toEqual(['Inicio']);
    expect(elemento.querySelector('.header-actions')).toBeNull();

    fixture.destroy();
    await router.navigateByUrl('/inicio');
    const publico = await montar(true);
    expect([...publico.querySelectorAll('nav a')].map((a) => a.textContent?.trim())).toEqual(['Inicio']);
    expect(restaurar).toHaveBeenCalledTimes(1);
  });

  it('espera el perfil de una ruta protegida sin mostrar el menú público ni restaurar aparte', async () => {
    const restaurar = vi.spyOn(accesoActual, 'restaurarSesion');
    fixture = TestBed.createComponent(SiteHeaderComponent);
    fixture.componentInstance.sesionProtegida = true;
    fixture.componentInstance.perfilValidado = null;
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('nav')).toBeNull();
    expect(restaurar).not.toHaveBeenCalled();

    fixture.componentInstance.perfilValidado = perfil;
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.nav-auth')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.nav-public')).toBeNull();
    expect(restaurar).not.toHaveBeenCalled();
  });

  it('ordena el menú real, abre la campana y cierra sesión', async () => {
    vi.spyOn(accesoActual, 'restaurarSesion').mockResolvedValue(perfil);
    vi.spyOn(accesoActual, 'catalogos').mockResolvedValue({
      zonas: [{ id: 37, nombre: 'Zona de prueba', descripcion: null }], roles_publicos: [],
      tipos_incidente: [], niveles_gravedad: [], estados_reporte: [],
    });
    const cerrar = vi.spyOn(accesoActual, 'cerrarSesion').mockImplementation(() => {});
    await router.navigateByUrl('/dashboard');
    const elemento = await montar();

    const opciones = [...elemento.querySelectorAll('.nav-auth > *')];
    expect(opciones.map((opcion) => opcion.textContent?.trim())).toEqual([
      'Inicio', 'Mapa Comunitario Próximamente', 'Mis Reportes',
      'Chat Vecinal Próximamente', 'Alertas verificadas',
    ]);
    expect(elemento.querySelector('.nav-auth a[aria-current="page"]')?.textContent?.trim()).toBe('Inicio');
    expect(elemento.textContent).toContain('Ana Torres');
    expect(elemento.textContent).toContain('Zona de prueba');

    await router.navigateByUrl('/alertas');
    fixture.detectChanges();
    expect(elemento.querySelector('.nav-auth a[aria-current="page"]')?.textContent?.trim()).toBe('Alertas verificadas');
    await router.navigateByUrl('/mis-reportes');
    fixture.detectChanges();
    expect(elemento.querySelector('.nav-auth a[aria-current="page"]')?.textContent?.trim()).toBe('Mis Reportes');

    const menu = elemento.querySelector<HTMLButtonElement>('.menu-toggle')!;
    menu.click();
    fixture.detectChanges();
    expect(menu.getAttribute('aria-expanded')).toBe('true');
    expect(elemento.querySelector('.nav-auth')?.classList.contains('open')).toBe(true);
    menu.click();
    fixture.detectChanges();
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    menu.click();
    fixture.detectChanges();

    elemento.querySelector<HTMLButtonElement>('button[aria-label="Notificaciones"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(elemento.querySelector('#panel-notificaciones')?.textContent).toContain('Ver todas las notificaciones');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(elemento.querySelector('#panel-notificaciones')).toBeNull();

    elemento.querySelector<HTMLButtonElement>('.account-button')!.click();
    fixture.detectChanges();
    expect(elemento.querySelector('#panel-cuenta a')?.textContent?.trim()).toBe('Editar perfil');
    elemento.querySelector<HTMLButtonElement>('.account-panel button')!.click();
    await fixture.whenStable();
    expect(cerrar).toHaveBeenCalledTimes(1);
    expect(router.url).toBe('/inicio');
  });
});
