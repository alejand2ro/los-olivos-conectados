import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { crearCargarDashboard, type ResumenDashboard } from '../application/cargar-dashboard';
import { accesoActual } from '../../inicio/infrastructure/acceso-actual';
import type { PerfilPropio } from '../../inicio/domain/acceso';
import { crearListarMisReportes } from '../../reportes/application/listar-mis-reportes';
import { apiReportesHttp } from '../../reportes/infrastructure/api-reportes-http';
import { crearListarAlertas } from '../../alertas/application/listar-alertas';
import { apiAlertasHttp } from '../../alertas/infrastructure/api-alertas-http';
import { SiteHeaderComponent } from '../../shared/presentation/site-header/site-header.component';

const listarMisReportes = crearListarMisReportes(apiReportesHttp);
const listarAlertas = crearListarAlertas(apiAlertasHttp);

@Component({
  selector: 'app-dashboard',
  imports: [IonContent, RouterLink, DatePipe, SiteHeaderComponent],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage implements OnInit {
  private readonly router = inject(Router);
  readonly perfil = signal<PerfilPropio | null>(accesoActual.perfilValidado());
  readonly resumen = signal<ResumenDashboard | null>(null);
  readonly cargando = signal(true);
  readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const perfil = await accesoActual.restaurarSesion();
      const token = accesoActual.leerToken();
      if (!perfil || !token) {
        await this.router.navigateByUrl('/inicio');
        return;
      }
      this.perfil.set(perfil);
      const cargar = crearCargarDashboard({
        catalogos: () => accesoActual.catalogos(),
        reportes: () => listarMisReportes(token),
        alertas: (zonaId) => listarAlertas(1, zonaId),
      });
      this.resumen.set(await cargar(perfil));
    } catch {
      this.error.set('No se pudo cargar tu sesión. Inténtalo de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }

}
