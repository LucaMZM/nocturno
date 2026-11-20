import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-shop-pagination',
  template: `
    <nav aria-label="Páginas de eventos" class="load-more">
      <button class="button-outline" [disabled]="busy() || page() <= 1" (click)="changed.emit(page() - 1)">Anterior</button>
      <span aria-live="polite">Página {{ page() }} de {{ pages() }}</span>
      <button class="button-outline" [disabled]="busy() || page() >= pages()" (click)="changed.emit(page() + 1)">Siguiente</button>
    </nav>
  `,
})
export class ShopPaginationComponent {
  readonly page = input.required<number>();
  readonly pages = input.required<number>();
  readonly busy = input(false);
  readonly changed = output<number>();
}
