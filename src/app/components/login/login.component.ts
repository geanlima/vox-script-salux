import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

type LoginMode = 'login' | 'register' | 'change-password';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly mode = signal<LoginMode>('login');
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly username = signal('');
  readonly displayName = signal('');
  readonly password = signal('');
  readonly rememberMe = signal(false);
  readonly confirmPassword = signal('');
  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmNewPassword = signal('');

  readonly title = computed(() => {
    switch (this.mode()) {
      case 'register':
        return 'Cadastre-se';
      case 'change-password':
        return 'Alterar senha';
      default:
        return 'Entrar';
    }
  });

  readonly submitLabel = computed(() => {
    switch (this.mode()) {
      case 'register':
        return 'Criar conta';
      case 'change-password':
        return 'Alterar senha';
      default:
        return 'Entrar';
    }
  });

  setMode(mode: LoginMode): void {
    this.mode.set(mode);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.password.set('');
    this.confirmPassword.set('');
    this.currentPassword.set('');
    this.newPassword.set('');
    this.confirmNewPassword.set('');
  }

  submit(): void {
    if (this.loading()) {
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');

    switch (this.mode()) {
      case 'login':
        this.doLogin();
        break;
      case 'register':
        this.doRegister();
        break;
      case 'change-password':
        this.doChangePassword();
        break;
    }
  }

  private doLogin(): void {
    const username = this.username().trim();
    const password = this.password();

    if (!username || !password) {
      this.errorMessage.set('Informe usuário e senha.');
      return;
    }

    this.loading.set(true);
    this.auth.login({ username, password, rememberMe: this.rememberMe() }).subscribe({
      next: () => this.navigateAfterLogin(),
      error: (error) => this.handleError(error, 'Falha ao realizar login.')
    });
  }

  private doRegister(): void {
    const username = this.username().trim();
    const displayName = this.displayName().trim();
    const password = this.password();

    if (!username || !displayName || !password) {
      this.errorMessage.set('Preencha todos os campos.');
      return;
    }

    if (password.length < 6) {
      this.errorMessage.set('Senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== this.confirmPassword()) {
      this.errorMessage.set('As senhas não conferem.');
      return;
    }

    this.loading.set(true);
    this.auth.register({ username, displayName, password }).subscribe({
      next: () => this.navigateAfterLogin(),
      error: (error) => this.handleError(error, 'Falha ao cadastrar usuário.')
    });
  }

  private doChangePassword(): void {
    const username = this.username().trim();
    const currentPassword = this.currentPassword();
    const newPassword = this.newPassword();

    if (!username || !currentPassword || !newPassword) {
      this.errorMessage.set('Preencha todos os campos.');
      return;
    }

    if (newPassword.length < 6) {
      this.errorMessage.set('Nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== this.confirmNewPassword()) {
      this.errorMessage.set('As novas senhas não conferem.');
      return;
    }

    this.loading.set(true);
    this.auth.changePassword({ username, currentPassword, newPassword }).subscribe({
      next: () => {
        this.loading.set(false);
        this.setMode('login');
        this.successMessage.set('Senha alterada com sucesso. Faça login com a nova senha.');
      },
      error: (error) => this.handleError(error, 'Falha ao alterar senha.')
    });
  }

  private navigateAfterLogin(): void {
    this.loading.set(false);
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
    this.router.navigateByUrl(returnUrl);
  }

  private handleError(error: unknown, fallback: string): void {
    this.loading.set(false);
    const message =
      (error as { error?: { message?: string } })?.error?.message ??
      (error as { message?: string })?.message ??
      fallback;
    this.errorMessage.set(message);
  }
}
