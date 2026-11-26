import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { NotificacionPropia } from '../../domain/notificacion';

@Component({
  selector: 'app-notificacion-lista',
  imports: [DatePipe],
  templateUrl: './notificacion-lista.component.html',
  styleUrl: './notificacion-lista.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificacionListaComponent {
  @Input({ required: true }) avisos: NotificacionPropia[] = [];

  titulo(aviso: NotificacionPropia): string {
    switch (aviso.tipo) {
      case 'alerta': return 'Alerta verificada';
      case 'sos': return 'Aviso SOS';
      case 'cambio_estado': return 'Cambio de estado de reporte';
    }
  }

  referencia(aviso: NotificacionPropia): string {
    return aviso.alerta_id !== null ? `Alerta #${aviso.alerta_id}` : `Reporte #${aviso.reporte_id}`;
  }
}
