const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 })
const tl0 = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })

export const num = (n) => (Number.isFinite(n) ? nf0.format(Math.round(n)) : '—')
export const num1 = (n) => (Number.isFinite(n) ? nf1.format(n) : '—')
export const tl = (n) => (Number.isFinite(n) ? tl0.format(Math.round(n)) : '—')

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Istanbul' })
const timeFmt = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
export const date = (ms) => (ms ? dateFmt.format(ms) : '—')
export const time = (ms) => (ms ? timeFmt.format(ms) : '—')
export const dateTime = (ms) => (ms ? `${dateFmt.format(ms)} ${timeFmt.format(ms)}` : '—')

export function ago(ms, now = Date.now()) {
  if (!ms) return '—'
  const d = Math.max(0, now - ms)
  const m = Math.round(d / 60000)
  if (m < 1) return 'az önce'
  if (m < 60) return `${m} dk önce`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} sa önce`
  const days = Math.round(h / 24)
  if (days < 30) return `${days} gün önce`
  if (days < 365) return `${Math.round(days / 30)} ay önce`
  return `${(days / 365).toFixed(1).replace('.', ',')} yıl önce`
}

export const STATUS = {
  pending: { label: 'Bekliyor', cls: 'mute' },
  activated: { label: 'Aktive', cls: 'water' },
  ready: { label: 'Kurulu', cls: 'ok' },
  blocked: { label: 'Engelli', cls: 'danger' },
}
export const TONE = {
  ok: { label: 'Sağlıklı', cls: 'ok', meter: '' },
  warning: { label: 'Uyarı', cls: 'warn', meter: 'warn' },
  danger: { label: 'Kritik', cls: 'danger', meter: 'danger' },
}
export const KIND = {
  filter: { label: 'Filtre', cls: 'warn' },
  weekly: { label: 'Haftalık', cls: 'water' },
  milestone: { label: 'Kilometre taşı', cls: 'gold' },
  manual: { label: 'Manuel', cls: 'mute' },
  other: { label: 'Diğer', cls: 'mute' },
}
export const AUDIT = {
  login: 'Giriş yaptı',
  login_failed: 'Başarısız giriş',
  logout: 'Çıkış yaptı',
  password_changed: 'Parolayı değiştirdi',
  admin_created: 'Yönetici ekledi',
  admin_deleted: 'Yönetici sildi',
  reveal_code: 'Aktivasyon kodunu görüntüledi',
  revoke_sessions: 'Oturumları kapattı',
  reset_activation: 'Aktivasyonu sıfırladı',
  block: 'Cihazı engelledi',
  unblock: 'Engeli kaldırdı',
  replace_filter: 'Filtre değişimi kaydetti',
  set_note: 'Not güncelledi',
  set_model: 'Modeli değiştirdi',
  send_push: 'Test bildirimi gönderdi',
  delete_device: 'Cihazı sildi',
  provision: 'Kod üretti',
  import_codes: 'Kod içe aktardı',
  export_codes: 'Kod dışa aktardı',
  run_scheduler: 'Zamanlayıcıyı çalıştırdı',
  service_request_update: 'Servis talebini güncelledi',
}
export const USES = { drinking: 'İçme suyu', tea: 'Çay & kahve', cooking: 'Yemek', pet: 'Evcil hayvan' }
export const PRESENCE = { home: 'Çoğunlukla evde', mixed: 'Karışık', away: 'Gündüz dışarıda' }
export const SOURCE = { damacana: 'Damacana', pet: 'Pet şişe', tap: 'Musluk suyu', mixed: 'Karışık' }
// server/src/service.ts (mobile/src/lib/service.ts) ile senkron tutulmalı
export const SERVICE_CATEGORY = {
  ariza: { label: 'Arıza / çalışmıyor', cls: 'danger' },
  bakim: { label: 'Periyodik bakım', cls: 'water' },
  filtre: { label: 'Filtre değişimi', cls: 'gold' },
  diger: { label: 'Diğer', cls: 'mute' },
}
export const SERVICE_STATUS = {
  open: { label: 'Yeni', cls: 'warn' },
  in_progress: { label: 'İşlemde', cls: 'water' },
  done: { label: 'Tamamlandı', cls: 'ok' },
  cancelled: { label: 'İptal edildi', cls: 'mute' },
}
export const ERRORS = {
  invalid_credentials: 'Kullanıcı adı veya parola hatalı.',
  locked: 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.',
  rate_limited: 'Çok fazla istek. Biraz bekleyip tekrar deneyin.',
  unauthorized: 'Oturum süresi doldu.',
  no_push_token: 'Bu cihazın kayıtlı bildirim adresi yok (uygulamada bildirim izni verilmemiş).',
  not_onboarded: 'Cihaz henüz kurulumu tamamlamamış.',
  username_taken: 'Bu kullanıcı adı zaten var.',
  wrong_password: 'Mevcut parola yanlış.',
  confirm_mismatch: 'Onay metni eşleşmiyor.',
  cannot_delete_self: 'Kendi hesabınızı silemezsiniz.',
  not_found: 'Kayıt bulunamadı.',
  network: 'Sunucuya ulaşılamadı.',
}
