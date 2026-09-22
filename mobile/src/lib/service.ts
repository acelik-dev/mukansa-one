// Teknik servis talebi — sabitler hem mobil uygulama hem sunucu (server/) tarafından kullanılır.
// Yönetim paneli (server/admin/public, düz JS) bunu import edemez; oradaki eşdeğer etiketler
// server/admin/public/js/fmt.js içinde elle tutulur, burasıyla senkron tutulmalı.

export type ServiceCategory = 'ariza' | 'bakim' | 'filtre' | 'diger'
export type ServiceStatus = 'open' | 'in_progress' | 'done' | 'cancelled'

export const SERVICE_CATEGORIES: ServiceCategory[] = ['ariza', 'bakim', 'filtre', 'diger']
export const SERVICE_STATUSES: ServiceStatus[] = ['open', 'in_progress', 'done', 'cancelled']

export const SERVICE_CATEGORY_LABEL: Record<ServiceCategory, string> = {
  ariza: 'Arıza / çalışmıyor',
  bakim: 'Periyodik bakım',
  filtre: 'Filtre değişimi',
  diger: 'Diğer',
}

export const SERVICE_STATUS_LABEL: Record<ServiceStatus, string> = {
  open: 'Yeni',
  in_progress: 'İşlemde',
  done: 'Tamamlandı',
  cancelled: 'İptal edildi',
}

export const SERVICE_DESCRIPTION_MAX = 500
export const SERVICE_CONTACT_NAME_MAX = 80
/** Basit ama gerçekçi bir telefon doğrulaması: rakam, boşluk, +, (), - içerebilir, 7-20 karakter */
export const PHONE_PATTERN = /^[0-9+()\s-]{7,20}$/
