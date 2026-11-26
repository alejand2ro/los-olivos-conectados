import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { EvidenciaLocal } from '../../domain/evidencia';

@Component({
  selector: 'app-adjuntos-evidencia',
  templateUrl: './adjuntos-evidencia.component.html',
  styleUrl: './adjuntos-evidencia.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdjuntosEvidenciaComponent {
  @Input() adjuntos: readonly EvidenciaLocal[] = [];
  @Input() bloqueado = false;
  @Input() reporteCreado = false;
  @Input() permitirAgregarDespues = false;
  @Input() error = '';
  @Output() readonly agregar = new EventEmitter<File[]>();
  @Output() readonly quitar = new EventEmitter<string>();
  @Output() readonly reintentar = new EventEmitter<void>();

  seleccionar(evento: Event): void {
    const control = evento.target as HTMLInputElement;
    this.agregar.emit(Array.from(control.files ?? []));
    control.value = '';
  }

  get hayFallidos(): boolean { return this.adjuntos.some((item) => item.estado === 'fallido'); }
}
