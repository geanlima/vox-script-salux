import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-azure-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './azure-layout.component.html',
  styleUrl: './azure-layout.component.scss'
})
export class AzureLayoutComponent {}
