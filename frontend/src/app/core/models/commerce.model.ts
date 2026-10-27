export interface CartItem {
  imageUrl: string | null;
  eventEndsAt: string;
  salesStart: string | null;
  salesEnd: string | null;
  purchasable: boolean;
  unavailableReason: string | null;
  id: string;
  ticketTypeId: string;
  quantity: number;
  name: string;
  unitPriceCents: number;
  available: number;
  maxPerUser: number | null;
  active: boolean;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  startsAt: string;
  eventStatus: string;
  eventActive: boolean;
  eventDeletedAt: string | null;
  venueName: string;
}

export interface Cart {
  id: string;
  items: CartItem[];
  totalCents: number;
}

export interface OrderItem {
  id: string;
  eventId: string;
  ticketTypeId: string;
  name: string;
  eventTitle: string;
  eventSlug: string;
  venueName: string;
  startsAt: string;
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
}

export interface Order {
  id: string;
  userId: string;
  status: 'AWAITING_PAYMENT' | 'PAID' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED';
  subtotalCents: number;
  totalCents: number;
  currency: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  paymentStatus?: string | null;
  providerPaymentId?: string | null;
  buyerName?: string;
  buyerEmail?: string;
  eventTitles?: string | null;
  itemCount?: number;
  tickets?: { id: string; code: string; status: string; issuedAt: string; usedAt: string | null; orderItemId: string }[];
  items?: OrderItem[];
}

export interface CheckoutSession { order: Order; clientSecret: string | null; }

export interface OwnedTicket {
  id: string;
  code: string;
  status: 'VALID' | 'USED' | 'CANCELLED' | 'REFUNDED';
  issuedAt: string;
  usedAt: string | null;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  venueAddress: string;
  ticketTypeName: string;
  displayName: string;
  orderId: string;
}
