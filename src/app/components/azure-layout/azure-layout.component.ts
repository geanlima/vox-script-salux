import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-azure-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './azure-layout.component.html',
  styleUrl: './azure-layout.component.scss'
})
export class AzureLayoutComponent {
  private readonly auth = inject(AuthService);

  readonly currentUser = this.auth.currentUser;
  readonly isMaster = this.auth.isMaster;

  logout(): void {
    this.auth.logout();
  }
}
