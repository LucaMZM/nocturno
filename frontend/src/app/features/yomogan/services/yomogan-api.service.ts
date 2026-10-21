import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface YomoganEvent {
  id: string;
  slug: string;
  title: string;
  venueName: string;
  municipality: string;
  startsAt: string;
  endsAt: string;
  minPrice: number;
  availability: number;
  isDemo: boolean;
  posterUrl: string | null;
  genres: string[];
  reason: string | null;
  href: string;
}
export interface YomoganReply {
  mode: 'assistant' | 'search' | 'clarification';
  message: string;
  question: string | null;
  events: YomoganEvent[];
  disclaimer: string;
  retrieval: 'hybrid' | 'structured';
}
export interface YomoganMessage {
  role: 'user' | 'assistant';
  content: string;
  reply?: YomoganReply;
}
@Injectable({ providedIn: 'root' })
export class YomoganApiService {
  private readonly http = inject(HttpClient);
  private readonly root = environment.apiUrl + '/yomogan';
  config() {
    return firstValueFrom(
      this.http.get<{ data: { avatarUrl: string | null } }>(this.root + '/config'),
    );
  }
  chat(messages: Pick<YomoganMessage, 'role' | 'content'>[]) {
    return firstValueFrom(
      this.http.post<{ data: YomoganReply }>(this.root + '/chat', { messages }),
    );
  }
}
