import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { accesoActual } from '../../inicio/infrastructure/acceso-actual';
import type { PerfilPropio } from '../../inicio/domain/acceso';
import { SiteHeaderComponent } from '../../shared/presentation/site-header/site-header.component';
import type { Pagina } from '../../shared/domain/pagina';
import { crearListarMisReportes } from '../application/listar-mis-reportes';
import { apiReportesHttp } from '../infrastructure/api-reportes-http';
import type { ResumenReporte } from '../domain/resumen-reporte';

@Component({
  selector: 'app-mis-reportes',
  imports: [IonContent, DatePipe, RouterLink, SiteHeaderComponent],
  templateUrl: './mis-reportes.page.html',
  styleUrl: './mis-reportes.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisReportesPage implements OnInit {
  private readonly router = inject(Router);
  private readonly listar = crearListarMisReportes(apiReportesHttp);
  readonly pagina = signal<Pagina<ResumenReporte> | null>(null);
  readonly perfil = signal<PerfilPropio | null>(accesoActual.perfilValidado());
  readonly zonaNombre = signal<string | null>(null);
  readonly zonas = signal<Map<number, string>>(new Map());
  readonly cargando = signal(true);
  readonly error = signal('');

  async ngOnInit(): Promise<void> {
    if (!accesoActual.leerToken()) {
      await this.router.navigateByUrl('/inicio');
      return;
    }
    const perfil = accesoActual.perfilValidado();
    if (!perfil) {
      await this.router.navigateByUrl('/inicio');
      return;
    }
    this.perfil.set(perfil);
    void accesoActual.catalogos().then((catalogos) => {
      const zonas = new Map(catalogos.zonas.map((zona) => [zona.id, zona.nombre] as const));
      this.zonas.set(zonas);
      this.zonaNombre.set(perfil.zona_id === null ? null : zonas.get(perfil.zona_id) ?? null);
    }).catch(() => { /* La lista conserva el identificador de zona sin el catálogo. */ });
    await this.cargar(1);
  }

  zonaDelIncidente(id: number): string { return this.zonas().get(id) ?? `Zona #${id}`; }

  async cargar(numero: number): Promise<void> {
    if (numero < 1 || (this.cargando() && this.pagina())) return;
    const token = accesoActual.leerToken();
    if (!token) {
      await this.router.navigateByUrl('/inicio');
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    try {
      this.pagina.set(await this.listar(token, numero));
    } catch {
      this.error.set('No se pudieron cargar tus reportes. Inténtalo de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }
}
