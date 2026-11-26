import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators, type ValidatorFn } from '@angular/forms';
import type { CatalogosRegistro, DatosRegistro, RolRegistro } from '../../domain/acceso';
import { PasswordFieldComponent } from '../password-field/password-field.component';

const requeridoSinEspacios: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() ? null : { required: true };

@Component({
  selector: 'app-registro-form',
  imports: [ReactiveFormsModule, PasswordFieldComponent],
  templateUrl: './registro-form.component.html',
  styleUrl: './registro-form.component.scss',
})
export class RegistroFormComponent {
  @Input() catalogos: CatalogosRegistro | null = null;
  @Input() cargandoCatalogos = false;
  @Input() errorCatalogos = '';
  @Input() enviando = false;
  @Input() error = '';
  @Input() exito = false;
  @Input() set modoAccesibilidadInicial(valor: boolean) {
    this.formulario.controls.modo_accesibilidad.setValue(valor, { emitEvent: false });
  }

  @Output() registrar = new EventEmitter<DatosRegistro>();
  @Output() volverAlLogin = new EventEmitter<void>();
  @Output() reintentarCatalogos = new EventEmitter<void>();
  @Output() modoAccesibilidadChange = new EventEmitter<boolean>();

  readonly formulario = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [requeridoSinEspacios, Validators.maxLength(150)] }),
    correo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(150)] }),
    contrasena: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)] }),
    rol: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    zona_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    telefono: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(20)] }),
    modo_accesibilidad: new FormControl(false, { nonNullable: true }),
    consentimiento_privacidad_aceptado: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
    compromiso_sos_aceptado: new FormControl(false, { nonNullable: true, validators: [Validators.requiredTrue] }),
  });

  get opcionesDisponibles(): boolean {
    return !!this.catalogos?.zonas.length && !!this.catalogos.roles_publicos.length;
  }

  cambiarModo(): void {
    this.modoAccesibilidadChange.emit(this.formulario.controls.modo_accesibilidad.value);
  }

  enviar(): void {
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.enviando || !this.catalogos) return;

    const valor = this.formulario.getRawValue();
    const zonaId = Number(valor.zona_id);
    const rol = valor.rol as RolRegistro['nombre'];
    if (!this.catalogos.zonas.some((zona) => zona.id === zonaId) ||
        !this.catalogos.roles_publicos.some((opcion) => opcion.nombre === rol)) return;

    this.registrar.emit({
      nombre: valor.nombre.trim(),
      correo: valor.correo.trim(),
      contrasena: valor.contrasena,
      rol,
      zona_id: zonaId,
      ...(valor.telefono.trim() ? { telefono: valor.telefono.trim() } : {}),
      modo_accesibilidad: valor.modo_accesibilidad,
      consentimiento_privacidad_aceptado: true,
      compromiso_sos_aceptado: true,
    });
  }
}
