import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { Credenciales } from '../../domain/acceso';
import { PasswordFieldComponent } from '../password-field/password-field.component';

@Component({
  selector: 'app-login-form',
  imports: [ReactiveFormsModule, PasswordFieldComponent],
  templateUrl: './login-form.component.html',
  styleUrl: './login-form.component.scss',
})
export class LoginFormComponent {
  @Input() cargando = false;
  @Input() error = '';
  @Output() entrar = new EventEmitter<Credenciales>();
  @Output() abrirRegistro = new EventEmitter<void>();

  readonly formulario = new FormGroup({
    correo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(150)] }),
    contrasena: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  enviar(): void {
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.cargando) return;
    this.entrar.emit({
      correo: this.formulario.controls.correo.value.trim(),
      contrasena: this.formulario.controls.contrasena.value,
    });
  }
}
