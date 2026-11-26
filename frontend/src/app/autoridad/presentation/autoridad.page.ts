import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { accesoActual } from '../../inicio/infrastructure/acceso-actual';
import type { PerfilPropio } from '../../inicio/domain/acceso';
import { SiteHeaderComponent } from '../../shared/presentation/site-header/site-header.component';

@Component({
  selector: 'app-autoridad',
  imports: [IonContent, SiteHeaderComponent],
  templateUrl: './autoridad.page.html',
  styleUrl: './autoridad.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoridadPage {
  readonly perfil = signal<PerfilPropio | null>(accesoActual.perfilValidado());
}
