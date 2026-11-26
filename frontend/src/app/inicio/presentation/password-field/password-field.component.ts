import { Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-password-field',
  imports: [ReactiveFormsModule],
  templateUrl: './password-field.component.html',
  styleUrl: './password-field.component.scss',
})
export class PasswordFieldComponent {
  @Input({ required: true }) control!: FormControl<string>;
  @Input({ required: true }) id = '';
  @Input() etiqueta = 'Contraseña';
  @Input() autocompletar = 'current-password';
  @Input() ayuda = '';

  visible = false;
}
