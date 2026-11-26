import { ChangeDetectionStrategy, Component, ElementRef, HostListener, Input, OnInit, ViewChild, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { accesoActual } from '../../../inicio/infrastructure/acceso-actual';
import type { PerfilPropio } from '../../../inicio/domain/acceso';
import type { NotificacionPropia } from '../../../notificaciones/domain/notificacion';
import { crearListarMisNotificaciones } from '../../../notificaciones/application/listar-mis-notificaciones';
import { apiNotificacionesHttp } from '../../../notificaciones/infrastructure/api-notificaciones-http';
import { NotificacionListaComponent } from '../../../notificaciones/presentation/notificacion-lista/notificacion-lista.component';
import { rutaInicialPorRol } from '../../../inicio/domain/rutas-rol';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive, NotificacionListaComponent],
  templateUrl: './site-header.component.html',
  styleUrl: './site-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteHeaderComponent implements OnInit {
  @Input() soloPublico = false;
  private protegida = false;
  @Input() set sesionProtegida(valor: boolean) {
    this.protegida = valor;
    if (valor) this.verificando.set(this.perfil() === null);
  }
  @Input() set perfilValidado(valor: PerfilPropio | null) {
    this.perfil.set(valor);
    if (this.protegida) this.verificando.set(valor === null);
  }
  @Input() set zonaValidada(valor: string | null) {
    this.zonaNombre.set(valor);
  }
  @ViewChild('campana') campana?: ElementRef<HTMLButtonElement>;
  @ViewChild('tituloPanel') tituloPanel?: ElementRef<HTMLHeadingElement>;
  @ViewChild('menu') menu?: ElementRef<HTMLButtonElement>;
  @ViewChild('cuentaBoton') cuentaBoton?: ElementRef<HTMLButtonElement>;

  private readonly router = inject(Router);
  private readonly listarNotificaciones = crearListarMisNotificaciones(apiNotificacionesHttp);
  readonly perfil = signal<PerfilPropio | null>(null);
  readonly zonaNombre = signal<string | null>(null);
  readonly verificando = signal(true);
  readonly menuAbierto = signal(false);
  readonly panelAbierto = signal(false);
  readonly cuentaAbierta = signal(false);
  readonly avisos = signal<NotificacionPropia[]>([]);
  readonly cargandoAvisos = signal(false);
  readonly errorAvisos = signal('');
  readonly sinAvisos = signal(false);

  async ngOnInit(): Promise<void> {
    if (this.soloPublico) {
      this.verificando.set(false);
      return;
    }
    if (this.protegida) return;
    try {
      const perfil = await accesoActual.restaurarSesion();
      this.perfil.set(perfil);
      if (perfil?.zona_id !== null && perfil?.zona_id !== undefined) {
        const catalogos = await accesoActual.catalogos();
        this.zonaNombre.set(catalogos.zonas.find((zona) => zona.id === perfil.zona_id)?.nombre ?? null);
      }
    } catch {
      // El perfil puede seguir disponible aunque la consulta del catálogo falle.
    } finally {
      this.verificando.set(false);
    }
  }

  get iniciales(): string {
    const palabras = this.perfil()?.nombre.trim().split(/\s+/) ?? [];
    return palabras.slice(0, 2).map((palabra) => palabra.charAt(0).toLocaleUpperCase('es')).join('') || 'U';
  }

  get cuentaInterna(): boolean { return this.perfil()?.rol === 'autoridad' || this.perfil()?.rol === 'administrador'; }

  get subtituloCuenta(): string {
    const perfil = this.perfil();
    if (perfil?.rol === 'autoridad') return 'Autoridad';
    if (perfil?.rol === 'administrador') return 'Administrador';
    return this.zonaNombre() || (perfil?.zona_id === null ? 'Sin zona asignada' : 'Zona no disponible');
  }

  get rutaInterna(): string { return rutaInicialPorRol(this.perfil()?.rol ?? ''); }

  alternarMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
    this.panelAbierto.set(false);
    this.cuentaAbierta.set(false);
  }

  alternarPanel(): void {
    const abrir = !this.panelAbierto();
    this.panelAbierto.set(abrir);
    this.cuentaAbierta.set(false);
    this.menuAbierto.set(false);
    if (abrir) {
      void this.cargarAvisos();
      setTimeout(() => { if (this.panelAbierto()) this.tituloPanel?.nativeElement.focus(); });
    }
  }

  async cargarAvisos(): Promise<void> {
    const token = accesoActual.leerToken();
    if (!token) { this.errorAvisos.set('Tu sesión no está disponible.'); return; }
    this.cargandoAvisos.set(true);
    this.errorAvisos.set('');
    try {
      const pagina = await this.listarNotificaciones(token, 1);
      this.avisos.set(pagina.resultados.slice(0, 5));
      this.sinAvisos.set(pagina.total === 0);
    } catch {
      this.errorAvisos.set('No se pudieron cargar tus notificaciones.');
    } finally {
      this.cargandoAvisos.set(false);
    }
  }

  alternarCuenta(): void {
    this.cuentaAbierta.update((abierta) => !abierta);
    this.panelAbierto.set(false);
    this.menuAbierto.set(false);
  }

  cerrarPanel(): void {
    this.panelAbierto.set(false);
    this.campana?.nativeElement.focus();
  }

  @HostListener('document:keydown.escape')
  cerrarMenus(): void {
    if (this.panelAbierto()) this.cerrarPanel();
    if (this.cuentaAbierta()) {
      this.cuentaAbierta.set(false);
      this.cuentaBoton?.nativeElement.focus();
    }
    if (this.menuAbierto()) {
      this.menuAbierto.set(false);
      this.menu?.nativeElement.focus();
    }
  }

  async cerrarSesion(): Promise<void> {
    accesoActual.cerrarSesion();
    this.perfil.set(null);
    this.panelAbierto.set(false);
    this.cuentaAbierta.set(false);
    this.menuAbierto.set(false);
    await this.router.navigateByUrl('/inicio');
  }
}
