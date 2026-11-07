import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopEntry } from '../services/shop-api.service';

@Component({
  selector: 'app-shop-carousel',
  imports: [RouterLink],
  template: `
    <section [attr.aria-label]="title()">
      <h2>{{ title() }}</h2>
      <div class="rail" tabindex="0" [attr.aria-label]="title() + ': desplaza para ver más'">
        @for (entry of entries(); track entry.id) {
          <a [routerLink]="kind() === 'category' ? '/events' : '/' + (kind() === 'host' ? 'promoters' : 'venues') + '/' + entry.slug"
             [queryParams]="kind() === 'category' ? { genre: entry.id, municipality: 'all' } : null">
            @if (entry.imageUrl) { <img [src]="entry.imageUrl" alt="" loading="lazy" /> }
            <span>{{ entry.name }}</span>
            @if (entry.municipality) { <small>{{ entry.municipality }}</small> }
          </a>
        } @empty { <p class="muted">Todavía no hay opciones públicas en esta sección.</p> }
      </div>
    </section>
  `,
  styles: [`
    :host{display:block;min-width:0}section{margin:2rem 0}h2{font-size:clamp(1.3rem,3vw,2rem);margin-bottom:1rem}
    .rail{display:flex;gap:1rem;overflow-x:auto;scroll-snap-type:x proximity;padding:4px 4px 16px}
    a{flex:0 0 210px;scroll-snap-align:start;display:flex;flex-direction:column;gap:.6rem;padding:1.2rem;
      background:#171717;border-bottom:2px solid #e50914;color:#f5f2ec;text-decoration:none}
    a:hover{background:#222}a:focus-visible,.rail:focus-visible{outline:2px solid #f5f2ec;outline-offset:2px}
    img{width:100%;height:120px;object-fit:cover}span{font-size:1.2rem}small{color:#aaa6a0}
  `],
})
export class ShopCarouselComponent {
  readonly title = input.required<string>();
  readonly entries = input.required<ShopEntry[]>();
  readonly kind = input.required<'category' | 'host' | 'location'>();
}
