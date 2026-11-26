import { ChangeDetectionStrategy, Component, EventEmitter, InjectionToken, Input, OnDestroy, Output, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { prepararNotaVoz } from '../../infrastructure/preparar-nota-voz';

export const PREPARAR_NOTA_VOZ = new InjectionToken<typeof prepararNotaVoz>('Preparar nota de voz', {
  providedIn: 'root', factory: () => prepararNotaVoz,
});

@Component({
  selector: 'app-nota-voz',
  imports: [DecimalPipe],
  templateUrl: './nota-voz.component.html',
  styleUrl: './nota-voz.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotaVozComponent implements OnDestroy {
  private readonly preparar = inject(PREPARAR_NOTA_VOZ);
  @Input() disabled = false;
  @Output() readonly audioCambiado = new EventEmitter<File | null>();
  readonly grabando = signal(false);
  readonly procesando = signal(false);
  readonly segundos = signal(0);
  readonly archivo = signal<File | null>(null);
  readonly url = signal<string | null>(null);
  readonly error = signal('');
  private flujo: MediaStream | null = null;
  private grabadora: MediaRecorder | null = null;
  private partes: Blob[] = [];
  private intervalo: ReturnType<typeof setInterval> | null = null;
  private limite: ReturnType<typeof setTimeout> | null = null;
  private iniciado = 0;
  private destruido = false;
  private falloGrabacion = false;

  async iniciar(): Promise<void> {
    if (this.disabled || this.grabando() || this.procesando()) return;
    this.error.set('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined' ||
      typeof AudioContext === 'undefined' || typeof OfflineAudioContext === 'undefined') {
      this.error.set('Este navegador no permite preparar notas de voz. Puedes escribir la descripción.');
      return;
    }
    this.procesando.set(true);
    this.borrar();
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (this.destruido) { flujo.getTracks().forEach((pista) => pista.stop()); return; }
      this.flujo = flujo;
      this.partes = [];
      this.falloGrabacion = false;
      const grabadora = new MediaRecorder(flujo);
      this.grabadora = grabadora;
      grabadora.ondataavailable = (evento) => { if (evento.data.size) this.partes.push(evento.data); };
      grabadora.onstop = () => { void this.finalizar(); };
      grabadora.onerror = () => { this.falloGrabacion = true; this.error.set('Falló la grabación. Puedes intentarlo otra vez o escribir la descripción.'); this.detener(); };
      grabadora.start();
      this.iniciado = Date.now();
      this.segundos.set(0);
      this.grabando.set(true);
      this.intervalo = setInterval(() => this.segundos.set(Math.min(60, Math.floor((Date.now() - this.iniciado) / 1000))), 250);
      this.limite = setTimeout(() => this.detener(), 59_000);
    } catch {
      this.flujo?.getTracks().forEach((pista) => pista.stop());
      this.flujo = null;
      this.error.set('No se concedió acceso al micrófono o no pudo iniciarse. Puedes escribir la descripción.');
    } finally {
      this.procesando.set(false);
    }
  }

  detener(): void {
    if (!this.grabando()) return;
    this.grabando.set(false);
    this.limpiarTemporizadores();
    if (this.grabadora?.state === 'recording') this.grabadora.stop();
    this.flujo?.getTracks().forEach((pista) => pista.stop());
    this.flujo = null;
  }

  private async finalizar(): Promise<void> {
    if (this.destruido) return;
    if (this.falloGrabacion) { this.partes = []; this.grabadora = null; return; }
    this.procesando.set(true);
    try {
      const archivo = await this.preparar(new Blob(this.partes, { type: this.grabadora?.mimeType || 'audio/webm' }));
      if (this.destruido) return;
      this.archivo.set(archivo);
      this.url.set(URL.createObjectURL(archivo));
      this.audioCambiado.emit(archivo);
      this.error.set('');
    } catch (error) {
      if (!this.destruido) this.error.set(error instanceof Error ? error.message : 'No se pudo preparar la grabación.');
    } finally {
      if (!this.destruido) this.procesando.set(false);
      this.partes = [];
      this.grabadora = null;
    }
  }

  borrar(): void {
    if (this.grabando()) return;
    const anterior = this.url();
    if (anterior) URL.revokeObjectURL(anterior);
    this.url.set(null);
    this.archivo.set(null);
    this.audioCambiado.emit(null);
  }

  private limpiarTemporizadores(): void {
    if (this.intervalo) clearInterval(this.intervalo);
    if (this.limite) clearTimeout(this.limite);
    this.intervalo = this.limite = null;
  }

  ngOnDestroy(): void {
    this.destruido = true;
    this.limpiarTemporizadores();
    this.grabadora && (this.grabadora.onstop = null);
    if (this.grabadora?.state === 'recording') this.grabadora.stop();
    this.flujo?.getTracks().forEach((pista) => pista.stop());
    const anterior = this.url();
    if (anterior) URL.revokeObjectURL(anterior);
  }
}
