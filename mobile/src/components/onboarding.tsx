import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  Coffee,
  Droplets,
  MapPin,
  PawPrint,
  ShieldCheck,
  Users,
  Utensils,
} from 'lucide-react-native'
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  dailyConsumptionL,
  dailySavingsTL,
  filterStatus,
  MODELS,
  previousCostPerL,
  purifiedCostPerL,
  type Household,
  type Presence,
  type SourceType,
  type UseCase,
  formatNum,
  formatTL,
} from '../lib/calc'
import { useApp } from '../lib/store'
import { AnimatedNumber } from './animated-number'
import { Card, Eyebrow, PrimaryButton, SelectCard } from './ui-kit'
import { colors } from '../theme'

type Step =
  | 'splash'
  | 'welcome'
  | 'activation'
  | 'model'
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4'
  | 'summary'
  | 'notif'

const QUESTION_STEPS: Step[] = ['q1', 'q2', 'q3', 'q4']

const REGIONS = [
  'İstanbul / Beşiktaş',
  'İstanbul / Kadıköy',
  'Ankara / Çankaya',
  'İzmir / Karşıyaka',
  'Bursa / Nilüfer',
  'Antalya / Konyaaltı',
]

export function Onboarding() {
  const { completeOnboarding, loadDemo } = useApp()
  const [step, setStep] = useState<Step>('splash')
  const [serialNo, setSerialNo] = useState('')
  const [modelId, setModelId] = useState('pro')
  const [people, setPeople] = useState(4)
  const [uses, setUses] = useState<UseCase[]>(['drinking', 'tea', 'cooking'])
  const [presence, setPresence] = useState<Presence>('home')
  const [source, setSource] = useState<SourceType>('damacana')
  const [damacanaPerMonth, setDamacanaPerMonth] = useState(6)
  const [region, setRegion] = useState(REGIONS[0])

  const household: Household = useMemo(
    () => ({
      people,
      uses,
      presence,
      source,
      damacanaPerMonth,
      region,
    }),
    [people, uses, presence, source, damacanaPerMonth, region],
  )

  useEffect(() => {
    if (step !== 'splash') return
    const t = setTimeout(() => setStep('welcome'), 2200)
    return () => clearTimeout(t)
  }, [step])

  const finish = () =>
    completeOnboarding({
      serialNo: serialNo || 'MKP-0000-0000',
      modelId,
      household,
    })

  const goBack = () => {
    const order: Step[] = [
      'welcome',
      'activation',
      'model',
      'q1',
      'q2',
      'q3',
      'q4',
      'summary',
      'notif',
    ]
    const i = order.indexOf(step)
    if (i > 0) setStep(order[i - 1])
  }

  const questionIndex = QUESTION_STEPS.indexOf(step)

  return (
    <View style={styles.root}>
      {step !== 'splash' && step !== 'welcome' && (
        <View style={styles.topBar}>
          <Pressable
            onPress={goBack}
            accessibilityLabel="Geri"
            style={styles.backBtn}
          >
            <ArrowLeft size={16} color={colors.muted} />
          </Pressable>
          {questionIndex >= 0 && (
            <View style={styles.progress}>
              {QUESTION_STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressSeg,
                    { backgroundColor: i <= questionIndex ? colors.accent : colors.border },
                  ]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.body}>
        {step === 'splash' && <Splash />}
        {step === 'welcome' && (
          <Welcome onStart={() => setStep('activation')} onDemo={loadDemo} />
        )}
        {step === 'activation' && (
          <Activation
            onVerified={(s, m) => {
              setSerialNo(s)
              setModelId(m)
              setStep('model')
            }}
          />
        )}
        {step === 'model' && (
          <ModelInfo
            modelId={modelId}
            serialNo={serialNo}
            onNext={() => setStep('q1')}
          />
        )}
        {step === 'q1' && (
          <Q1 people={people} setPeople={setPeople} onNext={() => setStep('q2')} />
        )}
        {step === 'q2' && (
          <Q2
            uses={uses}
            setUses={setUses}
            presence={presence}
            setPresence={setPresence}
            onNext={() => setStep('q3')}
          />
        )}
        {step === 'q3' && (
          <Q3
            source={source}
            setSource={setSource}
            damacanaPerMonth={damacanaPerMonth}
            setDamacanaPerMonth={setDamacanaPerMonth}
            onNext={() => setStep('q4')}
          />
        )}
        {step === 'q4' && (
          <Q4 region={region} setRegion={setRegion} onNext={() => setStep('summary')} />
        )}
        {step === 'summary' && (
          <Summary
            household={household}
            modelId={modelId}
            onNext={() => setStep('notif')}
          />
        )}
        {step === 'notif' && <Notifications onFinish={finish} />}
      </View>
    </View>
  )
}

function Splash() {
  return (
    <View style={styles.splash}>
      <View style={styles.splashIconWrap}>
        <View style={styles.splashPing} />
        <View style={styles.splashRing} />
        <Droplets size={40} color={colors.accent} />
      </View>
      <View style={{ alignItems: 'center' }}>
        <Text style={styles.splashTitle}>
          MUKANSA <Text style={{ color: colors.accent }}>ONE</Text>
        </Text>
        <Text style={styles.splashTag}>Saf su, saf zarafet</Text>
      </View>
    </View>
  )
}

function Welcome({ onStart, onDemo }: { onStart: () => void; onDemo: () => void }) {
  return (
    <View style={styles.screenPad}>
      <View style={styles.flexCenter}>
        <View style={styles.welcomeIcon}>
          <Droplets size={56} color={colors.waterLight} />
        </View>
        <Eyebrow>Hoş geldiniz</Eyebrow>
        <Text style={styles.h1}>Cihazınızın dijital ikizine hoş geldiniz.</Text>
        <Text style={styles.bodyText}>
          Filtre ömrünü takip edin, tasarrufunuzu izleyin ve arıtma cihazınızı
          zahmetsizce yönetin. Başlamak için cihazınızı aktive edelim.
        </Text>
      </View>
      <View style={styles.ctaCol}>
        <PrimaryButton onPress={onStart}>
          <Text style={styles.primaryLabel}>Cihazımı aktive et</Text>
          <ChevronRight size={20} color={colors.accentForeground} />
        </PrimaryButton>
        <Pressable onPress={onDemo} style={styles.linkBtn}>
          <Text style={styles.linkText}>Önce demoyu keşfet</Text>
        </Pressable>
      </View>
    </View>
  )
}

function Activation({
  onVerified,
}: {
  onVerified: (serial: string, modelId: string) => void
}) {
  const [digits, setDigits] = useState<string[]>(Array(12).fill(''))
  const [error, setError] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const inputsRef = useRef<(TextInput | null)[]>([])

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/[^0-9A-Za-z]/g, '').slice(-1).toUpperCase()
    const next = [...digits]
    next[i] = clean
    setDigits(next)
    setError(false)
    if (clean && i < 11) inputsRef.current[i + 1]?.focus()
  }

  const submit = () => {
    const code = digits.join('')
    if (code.length < 12) {
      setError(true)
      return
    }
    setVerifying(true)
    setTimeout(() => {
      onVerified(`MKP-${code.slice(0, 4)}-${code.slice(4, 8)}`, 'pro')
    }, 1400)
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screenPadScroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Eyebrow>Aktivasyon</Eyebrow>
      <Text style={styles.h2}>Cihazınızı doğrulayalım</Text>
      <Text style={styles.sub}>
        Cihazınızın altındaki etikette yer alan 12 haneli seri numarasını girin.
      </Text>

      <View style={styles.serialCenter}>
        <View style={styles.digitRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(el) => {
                inputsRef.current[i] = el
              }}
              value={d}
              onChangeText={(v) => setDigit(i, v)}
              onKeyPress={({ nativeEvent }) => {
                if (nativeEvent.key === 'Backspace' && !digits[i] && i > 0) {
                  inputsRef.current[i - 1]?.focus()
                }
              }}
              maxLength={1}
              autoCapitalize="characters"
              editable={!verifying}
              accessibilityLabel={`Hane ${i + 1}`}
              style={[
                styles.digitInput,
                error && { borderColor: colors.danger },
                (i === 3 || i === 7) && { marginRight: 10 },
              ]}
            />
          ))}
        </View>
        {error && (
          <Text style={styles.errorText}>
            Lütfen 12 haneli seri numarasını eksiksiz girin.
          </Text>
        )}
        <Text style={styles.serialHint}>
          Seri numarası cihazın alt yüzeyindeki gümüş etikette bulunur.
        </Text>
      </View>

      <View style={styles.ctaCol}>
        <PrimaryButton onPress={submit} disabled={verifying}>
          <Text style={styles.primaryLabel}>
            {verifying ? 'Doğrulanıyor…' : 'Doğrula'}
          </Text>
        </PrimaryButton>
      </View>
    </ScrollView>
  )
}

function ModelInfo({
  modelId,
  serialNo,
  onNext,
}: {
  modelId: string
  serialNo: string
  onNext: () => void
}) {
  const model = MODELS[modelId] ?? MODELS.pro
  return (
    <View style={styles.screenPad}>
      <View style={styles.flexCenter}>
        <View style={styles.checkCircle}>
          <Check size={32} color={colors.accent} />
        </View>
        <Text style={[styles.h2, { textAlign: 'center', marginTop: 20 }]}>
          Cihazınız doğrulandı
        </Text>
        <Text style={[styles.mutedSm, { textAlign: 'center', marginTop: 4 }]}>
          Orijinal ürün — garantiniz bugün başladı.
        </Text>

        <Card style={{ marginTop: 24, width: '100%' }}>
          <Image
            source={require('../../assets/device.png')}
            style={styles.modelImage}
            resizeMode="contain"
          />
          <View style={{ marginTop: 16, gap: 12 }}>
            <Row label="Model" value={model.name} />
            <Row label="Seri numarası" value={serialNo} />
            <Row label="Filtre kapasitesi" value={`${formatNum(model.capacityL)} L`} />
            <Row label="Garanti" value="3 yıl (aktivasyon ile uzatıldı)" />
          </View>
        </Card>
      </View>
      <PrimaryButton onPress={onNext} style={{ marginTop: 24 }}>
        <Text style={styles.primaryLabel}>Devam et</Text>
        <ChevronRight size={20} color={colors.accentForeground} />
      </PrimaryButton>
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.rowBetween}>
      <Text style={styles.mutedSm}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

function Q1({
  people,
  setPeople,
  onNext,
}: {
  people: number
  setPeople: (n: number) => void
  onNext: () => void
}) {
  const options = [1, 2, 3, 4, 5]
  return (
    <QuestionShell
      title="Hanede kaç kişi yaşıyor?"
      subtitle="Günlük tüketiminizi bu bilgiyle tahmin ediyoruz."
      onNext={onNext}
    >
      <View style={styles.grid3}>
        {options.map((n) => (
          <SelectCard
            key={n}
            selected={people === n}
            onPress={() => setPeople(n)}
            style={styles.selectCol}
          >
            <Users
              size={24}
              color={people === n ? colors.accent : colors.muted}
            />
            <Text style={styles.selectBig}>{n === 5 ? '5+' : n}</Text>
          </SelectCard>
        ))}
      </View>
    </QuestionShell>
  )
}

const USE_OPTIONS: { id: UseCase; label: string; Icon: typeof Coffee }[] = [
  { id: 'drinking', label: 'İçme suyu', Icon: Droplets },
  { id: 'tea', label: 'Çay & kahve', Icon: Coffee },
  { id: 'cooking', label: 'Yemek pişirme', Icon: Utensils },
  { id: 'pet', label: 'Evcil hayvan', Icon: PawPrint },
]
const PRESENCE_OPTIONS: { id: Presence; label: string }[] = [
  { id: 'home', label: 'Çoğunlukla evdeyiz' },
  { id: 'mixed', label: 'Karışık' },
  { id: 'away', label: 'Gündüz dışarıdayız' },
]

function Q2({
  uses,
  setUses,
  presence,
  setPresence,
  onNext,
}: {
  uses: UseCase[]
  setUses: (u: UseCase[]) => void
  presence: Presence
  setPresence: (p: Presence) => void
  onNext: () => void
}) {
  const toggle = (id: UseCase) =>
    setUses(uses.includes(id) ? uses.filter((u) => u !== id) : [...uses, id])
  return (
    <QuestionShell
      title="Su alışkanlıklarınız"
      subtitle="Arıtılmış suyu ne için kullanacaksınız?"
      onNext={onNext}
      disabled={uses.length === 0}
    >
      <View style={styles.grid2}>
        {USE_OPTIONS.map(({ id, label, Icon }) => (
          <SelectCard
            key={id}
            selected={uses.includes(id)}
            onPress={() => toggle(id)}
            style={{ flex: 1, minWidth: '45%' }}
          >
            <Icon
              size={20}
              color={uses.includes(id) ? colors.accent : colors.muted}
            />
            <Text style={styles.selectLabel}>{label}</Text>
          </SelectCard>
        ))}
      </View>

      <Text style={[styles.mutedSm, { marginTop: 28, marginBottom: 12 }]}>
        Gün içinde evde misiniz?
      </Text>
      <View style={{ gap: 10 }}>
        {PRESENCE_OPTIONS.map(({ id, label }) => (
          <SelectCard
            key={id}
            selected={presence === id}
            onPress={() => setPresence(id)}
          >
            <View
              style={[
                styles.radio,
                presence === id && {
                  borderColor: colors.accent,
                  backgroundColor: colors.accent,
                },
              ]}
            >
              {presence === id && (
                <Check size={12} color={colors.accentForeground} />
              )}
            </View>
            <Text style={styles.selectLabel}>{label}</Text>
          </SelectCard>
        ))}
      </View>
    </QuestionShell>
  )
}

const SOURCE_OPTIONS: { id: SourceType; label: string; hint: string }[] = [
  { id: 'damacana', label: 'Damacana', hint: '19 L' },
  { id: 'pet', label: 'Pet şişe', hint: '0,5–5 L' },
  { id: 'tap', label: 'Musluk suyu', hint: 'Şebeke' },
  { id: 'mixed', label: 'Karışık', hint: 'Damacana + pet' },
]

function Q3({
  source,
  setSource,
  damacanaPerMonth,
  setDamacanaPerMonth,
  onNext,
}: {
  source: SourceType
  setSource: (s: SourceType) => void
  damacanaPerMonth: number
  setDamacanaPerMonth: (n: number) => void
  onNext: () => void
}) {
  return (
    <QuestionShell
      title="Şu an içme suyunu nasıl alıyorsunuz?"
      subtitle="Tasarrufunuzu bugünkü maliyetinizle kıyaslıyoruz."
      onNext={onNext}
    >
      <View style={styles.grid2}>
        {SOURCE_OPTIONS.map(({ id, label, hint }) => (
          <SelectCard
            key={id}
            selected={source === id}
            onPress={() => setSource(id)}
            style={{ flex: 1, minWidth: '45%', flexDirection: 'column', alignItems: 'flex-start' }}
          >
            <Text style={styles.selectLabelBold}>{label}</Text>
            <Text style={styles.hintXs}>{hint}</Text>
          </SelectCard>
        ))}
      </View>

      {source === 'damacana' && (
        <View style={{ marginTop: 28 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.mutedSm}>Ayda kaç damacana?</Text>
            <Text style={styles.accentBig}>{damacanaPerMonth}</Text>
          </View>
          <View style={styles.stepperWide}>
            <Pressable
              onPress={() =>
                setDamacanaPerMonth(Math.max(2, damacanaPerMonth - 1))
              }
              style={styles.stepBtn}
            >
              <Text style={styles.stepBtnText}>−</Text>
            </Pressable>
            <View style={styles.sliderTrack}>
              <View
                style={[
                  styles.sliderFill,
                  { width: `${((damacanaPerMonth - 2) / 18) * 100}%` },
                ]}
              />
            </View>
            <Pressable
              onPress={() =>
                setDamacanaPerMonth(Math.min(20, damacanaPerMonth + 1))
              }
              style={styles.stepBtn}
            >
              <Text style={styles.stepBtnText}>+</Text>
            </Pressable>
          </View>
        </View>
      )}
    </QuestionShell>
  )
}

function Q4({
  region,
  setRegion,
  onNext,
}: {
  region: string
  setRegion: (r: string) => void
  onNext: () => void
}) {
  return (
    <QuestionShell
      title="Nerede yaşıyorsunuz?"
      subtitle="Su tarifenizi ve bölgesel kalite raporunuzu buna göre gösteririz."
      onNext={onNext}
    >
      <View style={{ gap: 10 }}>
        {REGIONS.map((r) => (
          <SelectCard
            key={r}
            selected={region === r}
            onPress={() => setRegion(r)}
          >
            <MapPin
              size={20}
              color={region === r ? colors.accent : colors.muted}
            />
            <Text style={styles.selectLabel}>{r}</Text>
          </SelectCard>
        ))}
      </View>
    </QuestionShell>
  )
}

function Summary({
  household,
  modelId,
  onNext,
}: {
  household: Household
  modelId: string
  onNext: () => void
}) {
  const model = MODELS[modelId] ?? MODELS.pro
  const daily = dailyConsumptionL(household)
  const fs = filterStatus(household, model, 0)
  const dailySave = dailySavingsTL(household, model)
  const yearly = dailySave * 365
  const months = Math.round(fs.remainingDays / 30)

  return (
    <View style={styles.screenPad}>
      <View style={styles.flexCenter}>
        <Eyebrow>Sizin için hesapladık</Eyebrow>
        <Text style={styles.h2}>İşte tahmini tablonuz</Text>

        <View style={{ marginTop: 24, gap: 16 }}>
          <Text style={styles.summaryLine}>
            Aileniz günde yaklaşık{' '}
            <Text style={{ color: colors.waterLight, fontWeight: '700' }}>
              <AnimatedNumber value={Math.round(daily)} /> litre
            </Text>{' '}
            arıtılmış su tüketecek.
          </Text>
          <Text style={styles.summaryLine}>
            Filtreniz yaklaşık{' '}
            <Text style={{ color: colors.waterLight, fontWeight: '700' }}>
              <AnimatedNumber value={months} /> ay
            </Text>{' '}
            dayanacak; değişim zamanını biz takip edeceğiz.
          </Text>
          <Text style={styles.summaryLine}>
            Yılda tahmini{' '}
            <Text style={{ color: colors.accent, fontWeight: '700' }}>
              <AnimatedNumber value={yearly} format={formatTL} duration={1800} />
            </Text>{' '}
            tasarruf edeceksiniz.
          </Text>
        </View>

        <Text style={styles.finePrint}>
          Bu tahminleri istediğiniz zaman Profil &gt; Ayarlar bölümünden
          güncelleyebilirsiniz. Litre başına arıtılmış su maliyeti{' '}
          {purifiedCostPerL(model).toFixed(2)} TL, mevcut kaynağınız{' '}
          {previousCostPerL(household).toFixed(2)} TL olarak alındı.
        </Text>
      </View>
      <PrimaryButton onPress={onNext} style={{ marginTop: 24 }}>
        <Text style={styles.primaryLabel}>Harika, devam et</Text>
        <ChevronRight size={20} color={colors.accentForeground} />
      </PrimaryButton>
    </View>
  )
}

function Notifications({ onFinish }: { onFinish: () => void }) {
  return (
    <View style={styles.screenPad}>
      <View style={styles.flexCenter}>
        <View style={styles.checkCircle}>
          <Bell size={28} color={colors.accent} />
        </View>
        <Text style={[styles.h2, { textAlign: 'center', marginTop: 20 }]}>
          Doğru zamanda haber verelim
        </Text>
        <Text style={[styles.sub, { textAlign: 'center', maxWidth: 300 }]}>
          Filtreniz değişim zamanına yaklaştığında ve haftalık tasarruf özetiniz
          hazır olduğunda sizi bilgilendiririz. Spam yok — ayda en fazla bir
          pazarlama mesajı.
        </Text>

        <View style={{ marginTop: 32, width: '100%', gap: 12 }}>
          <PermRow Icon={ShieldCheck} text="Filtre değişim hatırlatmaları" />
          <PermRow Icon={Bell} text="Haftalık tasarruf özeti" />
        </View>
      </View>
      <View style={styles.ctaCol}>
        <PrimaryButton onPress={onFinish}>
          <Text style={styles.primaryLabel}>Bildirimlere izin ver</Text>
        </PrimaryButton>
        <Pressable onPress={onFinish} style={styles.linkBtn}>
          <Text style={styles.linkText}>Şimdilik geç</Text>
        </Pressable>
      </View>
    </View>
  )
}

function PermRow({ Icon, text }: { Icon: typeof Bell; text: string }) {
  return (
    <View style={styles.permRow}>
      <Icon size={20} color={colors.accent} />
      <Text style={styles.selectLabel}>{text}</Text>
    </View>
  )
}

function QuestionShell({
  title,
  subtitle,
  children,
  onNext,
  disabled,
}: {
  title: string
  subtitle: string
  children: ReactNode
  onNext: () => void
  disabled?: boolean
}) {
  return (
    <View style={styles.screenPad}>
      <Text style={styles.h2}>{title}</Text>
      <Text style={styles.sub}>{subtitle}</Text>
      <ScrollView
        style={{ flex: 1, marginTop: 28 }}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      <PrimaryButton onPress={onNext} disabled={disabled} style={{ marginTop: 16 }}>
        <Text style={styles.primaryLabel}>Devam et</Text>
        <ChevronRight size={20} color={colors.accentForeground} />
      </PrimaryButton>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  progressSeg: { flex: 1, height: 4, borderRadius: 999 },
  body: { flex: 1 },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  splashIconWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashPing: {
    ...StyleSheet.absoluteFill,
    borderRadius: 48,
    backgroundColor: 'rgba(200, 161, 90, 0.2)',
  },
  splashRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: 'rgba(200, 161, 90, 0.4)',
  },
  splashTitle: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 1,
    color: colors.foreground,
  },
  splashTag: {
    marginTop: 4,
    fontSize: 12,
    letterSpacing: 4.8,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  screenPad: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  screenPadScroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  flexCenter: { flex: 1, justifyContent: 'center' },
  welcomeIcon: {
    alignSelf: 'center',
    marginBottom: 32,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(46, 125, 140, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: {
    marginTop: 12,
    fontSize: 30,
    fontWeight: '600',
    lineHeight: 36,
    color: colors.foreground,
  },
  h2: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 30,
    color: colors.foreground,
  },
  bodyText: {
    marginTop: 16,
    fontSize: 15,
    lineHeight: 24,
    color: colors.muted,
  },
  sub: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
  },
  ctaCol: { gap: 12 },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accentForeground,
  },
  linkBtn: { height: 40, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontSize: 14, fontWeight: '500', color: colors.muted },
  serialCenter: { flex: 1, justifyContent: 'center', paddingVertical: 32 },
  digitRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 3,
  },
  digitInput: {
    width: 24,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    textTransform: 'uppercase',
  },
  errorText: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12,
    color: colors.danger,
  },
  serialHint: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  mutedSm: { fontSize: 14, color: colors.muted },
  checkCircle: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(200, 161, 90, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelImage: { alignSelf: 'center', height: 160, width: 140 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },
  grid3: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  selectCol: {
    width: '30%',
    flexGrow: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  selectBig: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: '600',
    color: colors.foreground,
  },
  selectLabel: { fontSize: 14, fontWeight: '500', color: colors.foreground },
  selectLabelBold: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  hintXs: { fontSize: 12, color: colors.muted },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentBig: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  stepperWide: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 20, color: colors.foreground },
  sliderTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  summaryLine: {
    fontSize: 18,
    lineHeight: 28,
    color: colors.foreground,
  },
  finePrint: {
    marginTop: 32,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
  },
})
