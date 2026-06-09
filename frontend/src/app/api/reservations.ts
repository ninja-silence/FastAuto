import { api } from './client';

export type ReservationStatus =
  | 'pending_payment'   // листинг заблокирован, удержание ещё не подтверждено
  | 'active'            // удержание подтверждено — ждём просмотра
  | 'settling'          // первый отметил исход; корректировка открыта
  | 'completed'         // финализировано
  | 'cancelled';        // отменено до расчёта

export type ReservationOutcome = 'sold' | 'not_sold';

export type CancelReason =
  | 'buyer_cancelled'
  | 'seller_declined'
  | 'payment_abandoned'
  | 'hold_expired'
  | 'hold_released_externally'
  | 'admin';

export interface Reservation {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  deposit_amount: number;
  yk_payment_id: string | null;
  status: ReservationStatus;
  outcome: ReservationOutcome | null;
  outcome_set_by: 'buyer' | 'seller' | null;
  outcome_set_at: string | null;
  cancel_reason: CancelReason | null;
  payment_deadline: string;
  hold_deadline: string;
  correction_deadline: string | null;
  created_at: string;
  updated_at: string;
  // Раскрывается покупателю при статусе active/settling/completed
  seller_phone?: string | null;
  sale_address?: string | null;
  // Слот просмотра (если выбран при бронировании)
  window_date?: string | null;
  time_from?: string | null;
  time_to?: string | null;
}

export interface ReserveResponse {
  reservation_id: string;
  payment_url: string | null;
}

export interface BookViewingResponse {
  booked: boolean;
  window_id: string;
}

export const reservationsApi = {
  /** Создать бронь (возвращает ссылку на оплату депозита).
   *  window_id обязателен когда у объявления включён viewing_enabled. */
  reserve: (listing_id: string, window_id?: string | null) =>
    api.post<ReserveResponse>('/reservations', {
      listing_id,
      ...(window_id ? { window_id } : {}),
    }),

  /** Мои брони (buyer + seller) */
  my: () =>
    api.get<Reservation[]>('/reservations/my'),

  /** Деталь брони */
  get: (id: string) =>
    api.get<Reservation>(`/reservations/${id}`),

  /** Записаться на конкретное окно просмотра */
  bookViewing: (reservation_id: string, window_id: string) =>
    api.post<BookViewingResponse>(
      `/reservations/${reservation_id}/book-viewing`,
      { window_id }
    ),

  /** Отметить исход просмотра */
  markOutcome: (reservation_id: string, result: ReservationOutcome) =>
    api.post<{ status: string; outcome: string }>(
      `/reservations/${reservation_id}/outcome`,
      { result }
    ),

  /** Покупатель отменяет бронь */
  cancel: (reservation_id: string) =>
    api.post<{ status: string }>(`/reservations/${reservation_id}/cancel`, {}),

  /** Продавец отклоняет бронь */
  decline: (reservation_id: string, reason: string) =>
    api.post<{ status: string }>(
      `/reservations/${reservation_id}/decline`,
      { reason }
    ),

  /** Удалить отменённую бронь */
  delete: (reservation_id: string) =>
    api.delete<void>(`/reservations/${reservation_id}`),
};
