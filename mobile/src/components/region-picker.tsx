import { ChevronRight, MapPin, Search, X } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import turkiye from '../data/turkiye-il-ilce.json'
import { colors } from '../theme'

interface IlEntry {
  il: string
  ilceler: string[]
}

const DATA = turkiye as IlEntry[]
const ILLER = DATA.map((d) => d.il)

// Türkçe'ye duyarlı küçük harfe çevirme (I/İ karışmasın diye arama TR kurallarına göre yapılır)
function trLower(s: string): string {
  return s
    .replace(/I/g, 'ı')
    .replace(/İ/g, 'i')
    .toLocaleLowerCase('tr-TR')
}

/**
 * İl + ilçe seçimi. Değer her zaman "İl / İlçe" biçiminde tek satır döner —
 * household.region alanı bu biçimi bekler, sunucu tarafında bir şema değişikliği gerekmez.
 */
export function RegionPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (region: string) => void
}) {
  const initialIl = ILLER.find((il) => value.startsWith(`${il} /`)) ?? null
  const [selectedIl, setSelectedIl] = useState<string | null>(initialIl)
  const [query, setQuery] = useState('')

  const ilceler = useMemo(
    () => (selectedIl ? (DATA.find((d) => d.il === selectedIl)?.ilceler ?? []) : []),
    [selectedIl],
  )

  const filtered = useMemo(() => {
    const list = selectedIl ? ilceler : ILLER
    const q = trLower(query.trim())
    if (!q) return list
    return list.filter((item) => trLower(item).includes(q))
  }, [selectedIl, ilceler, query])

  const pickIl = (il: string) => {
    setSelectedIl(il)
    setQuery('')
  }
  const pickIlce = (ilce: string) => {
    if (selectedIl) onChange(`${selectedIl} / ${ilce}`)
  }
  const backToIl = () => {
    setSelectedIl(null)
    setQuery('')
  }

  return (
    <View style={styles.root}>
      {selectedIl && (
        <Pressable onPress={backToIl} style={styles.backRow}>
          <ChevronRight size={16} color={colors.accent} style={{ transform: [{ rotate: '180deg' }] }} />
          <Text style={styles.backText}>{selectedIl}</Text>
        </Pressable>
      )}

      <View style={styles.searchBox}>
        <Search size={16} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={selectedIl ? 'İlçe ara…' : 'İl ara…'}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <X size={16} color={colors.muted} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        contentContainerStyle={{ paddingBottom: 8 }}
        initialNumToRender={20}
        ListEmptyComponent={
          <Text style={styles.empty}>Sonuç bulunamadı.</Text>
        }
        renderItem={({ item }) => {
          const current = selectedIl ? `${selectedIl} / ${item}` : null
          const isSelected = selectedIl ? current === value : item === selectedIl
          return (
            <Pressable
              onPress={() => (selectedIl ? pickIlce(item) : pickIl(item))}
              style={[styles.row, isSelected && styles.rowSelected]}
            >
              <MapPin size={16} color={isSelected ? colors.accent : colors.muted} />
              <Text style={[styles.rowText, isSelected && styles.rowTextSelected]}>{item}</Text>
              {!selectedIl && <ChevronRight size={16} color={colors.muted} style={{ marginLeft: 'auto' }} />}
            </Pressable>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 10 },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  backText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 46,
  },
  searchInput: { flex: 1, color: colors.foreground, fontSize: 15 },
  list: { flex: 1 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 24, fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  rowSelected: { backgroundColor: colors.surface },
  rowText: { color: colors.foreground, fontSize: 15 },
  rowTextSelected: { color: colors.accent, fontWeight: '600' },
})
