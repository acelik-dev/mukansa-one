import { Check, X } from 'lucide-react-native'
import { useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { ApiError } from '../lib/api'
import {
  PHONE_PATTERN,
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABEL,
  SERVICE_CONTACT_NAME_MAX,
  SERVICE_DESCRIPTION_MAX,
  type ServiceCategory,
} from '../lib/service'
import { useApp } from '../lib/store'
import { colors } from '../theme'

export function ServiceRequestModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const { createServiceRequest } = useApp()
  const [category, setCategory] = useState<ServiceCategory>('ariza')
  const [description, setDescription] = useState('')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const reset = () => {
    setCategory('ariza')
    setDescription('')
    setPhone('')
    setName('')
    setError(null)
    setDone(false)
  }

  const close = () => {
    onClose()
    // Kapanış animasyonu bitsin diye formu bir sonraki açılışa hazırlarken hemen sıfırlamayız;
    // sıfırlama tamamen kapandıktan sonra (onModalHide yerine) basitçe bir sonraki açılışta yapılır.
    setTimeout(reset, 300)
  }

  const submit = async () => {
    const trimmedDesc = description.trim()
    const trimmedPhone = phone.trim()
    if (!trimmedDesc) {
      setError('Lütfen sorunu kısaca açıklayın.')
      return
    }
    if (!PHONE_PATTERN.test(trimmedPhone)) {
      setError('Geçerli bir telefon numarası girin (en az 7 hane).')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await createServiceRequest({
        category,
        description: trimmedDesc,
        contactPhone: trimmedPhone,
        contactName: name.trim() || undefined,
      })
      setDone(true)
      onCreated()
    } catch (err) {
      setError(
        err instanceof ApiError && err.isNetwork
          ? 'Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.'
          : 'Talep gönderilemedi. Lütfen tekrar deneyin.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {done ? (
            <View style={styles.doneWrap}>
              <View style={styles.doneIcon}>
                <Check size={32} color={colors.accentForeground} />
              </View>
              <Text style={styles.title}>Talebiniz alındı</Text>
              <Text style={styles.sub}>
                Ekibimiz en kısa sürede belirttiğiniz numaradan sizinle iletişime geçecek.
              </Text>
              <Pressable onPress={close} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Tamam</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <View style={styles.headerRow}>
                <Text style={styles.title}>Teknik servis talebi</Text>
                <Pressable onPress={close} accessibilityLabel="Kapat" hitSlop={10}>
                  <X size={20} color={colors.muted} />
                </Pressable>
              </View>

              <Text style={styles.label}>Konu</Text>
              <View style={styles.chipsRow}>
                {SERVICE_CATEGORIES.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[styles.chip, category === c && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, category === c && styles.chipTextOn]}>
                      {SERVICE_CATEGORY_LABEL[c]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Açıklama</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Sorunu kısaca anlatın…"
                placeholderTextColor={colors.muted}
                multiline
                maxLength={SERVICE_DESCRIPTION_MAX}
                style={styles.textarea}
              />

              <Text style={styles.label}>Telefon</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="05xx xxx xx xx"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                style={styles.input}
              />

              <Text style={styles.label}>Ad soyad (isteğe bağlı)</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Aranacak kişi"
                placeholderTextColor={colors.muted}
                maxLength={SERVICE_CONTACT_NAME_MAX}
                style={styles.input}
              />

              {!!error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                onPress={submit}
                disabled={submitting}
                style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
              >
                <Text style={styles.primaryBtnText}>{submitting ? 'Gönderiliyor…' : 'Talebi gönder'}</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(12,20,24,0.7)',
  },
  sheet: {
    maxHeight: '86%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 24,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: '600', color: colors.foreground },
  sub: { marginTop: 8, fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 8,
    marginTop: 16,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.foreground },
  chipTextOn: { color: colors.accentForeground, fontWeight: '600' },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.foreground,
  },
  textarea: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.foreground,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  error: { marginTop: 12, fontSize: 12.5, color: colors.danger },
  primaryBtn: {
    marginTop: 22,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 15, fontWeight: '600', color: colors.accentForeground },
  doneWrap: { alignItems: 'center', paddingVertical: 12 },
  doneIcon: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
})
