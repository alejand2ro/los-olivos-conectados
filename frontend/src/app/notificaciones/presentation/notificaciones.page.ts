import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { accesoActual } from '../../inicio/infrastructure/acceso-actual';
import type { PerfilPropio } from '../../inicio/domain/acceso';
import type { Pagina } from '../../shared/domain/pagina';
import { SiteHeaderComponent } from '../../shared/presentation/site-header/site-header.component';
import { crearListarMisNotificaciones } from '../application/listar-mis-notificaciones';
import { apiNotificacionesHttp } from '../infrastructure/api-notificaciones-http';
import type { NotificacionPropia } from '../domain/notificacion';
import { NotificacionListaComponent } from './notificacion-lista/notificacion-lista.component';

@Component({
  selector: 'app-notificaciones',
  imports: [IonContent, SiteHeaderComponent, NotificacionListaComponent],
  templateUrl: './notificaciones.page.html',
  styleUrl: './notificaciones.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificacionesPage implements OnInit {
  private readonly router = inject(Router);
  private readonly listar = crearListarMisNotificaciones(apiNotificacionesHttp);
  readonly perfil = signal<PerfilPropio | null>(accesoActual.perfilValidado());
  readonly zonaNombre = signal<string | null>(null);
  readonly pagina = signal<Pagina<NotificacionPropia> | null>(null);
  readonly cargando = signal(true);
  readonly error = signal('');

  ngOnInit(): void {
    const perfil = this.perfil();
    if (perfil?.zona_id !== null && perfil?.zona_id !== undefined) {
      void accesoActual.catalogos().then((catalogos) => {
        this.zonaNombre.set(catalogos.zonas.find((zona) => zona.id === perfil.zona_id)?.nombre ?? null);
      }).catch(() => {});
    }
    void this.cargar(1);
  }

  async cargar(numero: number): Promise<void> {
    if (numero < 1 || (this.cargando() && this.pagina())) return;
    const token = accesoActual.leerToken();
    if (!token) { await this.router.navigateByUrl('/inicio'); return; }
    this.cargando.set(true);
    this.error.set('');
    try {
      this.pagina.set(await this.listar(token, numero));
    } catch {
      this.error.set('No se pudieron cargar tus notificaciones. Inténtalo de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }
}
