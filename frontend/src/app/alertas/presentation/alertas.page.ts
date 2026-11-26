import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { crearListarAlertas } from '../application/listar-alertas';
import { apiAlertasHttp } from '../infrastructure/api-alertas-http';
import type { AlertaPublica } from '../domain/alerta-publica';
import type { Pagina } from '../../shared/domain/pagina';
import { SiteHeaderComponent } from '../../shared/presentation/site-header/site-header.component';

@Component({
  selector: 'app-alertas',
  imports: [IonContent, DatePipe, SiteHeaderComponent],
  templateUrl: './alertas.page.html',
  styleUrl: './alertas.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertasPage implements OnInit {
  private readonly listar = crearListarAlertas(apiAlertasHttp);
  readonly pagina = signal<Pagina<AlertaPublica> | null>(null);
  readonly cargando = signal(true);
  readonly error = signal('');

  ngOnInit(): void { void this.cargar(1); }

  async cargar(numero: number): Promise<void> {
    if (numero < 1 || this.cargando() && this.pagina()) return;
    this.cargando.set(true);
    this.error.set('');
    try {
      this.pagina.set(await this.listar(numero));
    } catch {
      this.error.set('No se pudieron cargar las alertas verificadas. Inténtalo de nuevo.');
    } finally {
      this.cargando.set(false);
    }
  }
}
