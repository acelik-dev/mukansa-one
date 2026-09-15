'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  Coffee,
  Droplets,
  MapPin,
  Nfc,
  PawPrint,
  QrCode,
  ScanLine,
  ShieldCheck,
  Users,
  Utensils,
} from 'lucide-react'
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
} from '@/lib/calc'
import { useApp } from '@/lib/store'
import { AnimatedNumber } from './animated-number'
import { Card, Eyebrow, GhostButton, PrimaryButton, SelectCard } from './ui-kit'

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
    completeOnboarding({ serialNo: serialNo || 'MKP-0000-0000', modelId, household })

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
    <div className="flex h-full flex-col">
      {/* üst çubuk: geri + adım göstergesi */}
      {step !== 'splash' && step !== 'welcome' && (
        <div className="flex items-center gap-3 px-5 pb-2 pt-5">
          <button
            onClick={goBack}
            aria-label="Geri"
            className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground active:scale-95"
          >
            <ArrowLeft className="size-4" />
          </button>
          {questionIndex >= 0 && (
            <div className="flex flex-1 gap-1.5">
              {QUESTION_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= questionIndex ? 'bg-accent' : 'bg-border'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar">
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
          <ModelInfo modelId={modelId} serialNo={serialNo} onNext={() => setStep('q1')} />
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
      </div>
    </div>
  )
}

/* ---------------- Splash ---------------- */
function Splash() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="relative flex size-24 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
        <span className="absolute inset-0 rounded-full border border-accent/40" />
        <Droplets className="size-10 text-accent" />
      </div>
      <div className="text-center">
        <h1 className="font-display text-2xl font-semibold tracking-wide">
          MUKANSA <span className="text-accent">ONE</span>
        </h1>
        <p className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Saf su, saf zarafet
        </p>
      </div>
    </div>
  )
}

/* ---------------- Welcome ---------------- */
function Welcome({ onStart, onDemo }: { onStart: () => void; onDemo: () => void }) {
  return (
    <div className="flex h-full flex-col px-6 pb-8 pt-10">
      <div className="flex flex-1 flex-col justify-center">
        <div className="mx-auto mb-8 flex size-32 items-center justify-center rounded-full bg-gradient-to-b from-water/30 to-transparent">
          <Droplets className="size-14 text-water-light" />
        </div>
        <Eyebrow>Hoş geldiniz</Eyebrow>
        <h1 className="mt-3 text-pretty font-display text-3xl font-semibold leading-tight">
          Cihazınızın dijital ikizine hoş geldiniz.
        </h1>
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
          Filtre ömrünü takip edin, tasarrufunuzu izleyin ve arıtma cihazınızı
          zahmetsizce yönetin. Başlamak için cihazınızı aktive edelim.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <PrimaryButton onClick={onStart}>
          Cihazımı aktive et
          <ChevronRight className="size-5" />
        </PrimaryButton>
        <button
          onClick={onDemo}
          className="h-10 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Önce demoyu keşfet
        </button>
      </div>
    </div>
  )
}

/* ---------------- Activation ---------------- */
function Activation({
  onVerified,
}: {
  onVerified: (serial: string, modelId: string) => void
}) {
  const [mode, setMode] = useState<'idle' | 'scan' | 'nfc' | 'manual'>('idle')
  const [scanning, setScanning] = useState(false)
  const [digits, setDigits] = useState<string[]>(Array(12).fill(''))
  const [error, setError] = useState(false)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  const runScan = (m: 'scan' | 'nfc') => {
    setMode(m)
    setScanning(true)
    setTimeout(() => {
      setScanning(false)
      onVerified('MKP-4820-7391', 'pro')
    }, 2000)
  }

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/[^0-9A-Za-z]/g, '').slice(-1).toUpperCase()
    const next = [...digits]
    next[i] = clean
    setDigits(next)
    setError(false)
    if (clean && i < 11) inputsRef.current[i + 1]?.focus()
  }

  const submitManual = () => {
    const code = digits.join('')
    if (code.length < 12) {
      setError(true)
      return
    }
    onVerified(`MKP-${code.slice(0, 4)}-${code.slice(4, 8)}`, 'standard')
  }

  return (
    <div className="flex h-full flex-col px-6 pb-8 pt-4">
      <Eyebrow>Aktivasyon</Eyebrow>
      <h2 className="mt-2 text-pretty font-display text-2xl font-semibold leading-tight">
        Cihazınızı doğrulayalım
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Kutunun üzerindeki QR kodu tarayın, telefonunuzu cihaza dokundurun ya da
        seri numaranızı elle girin.
      </p>

      {/* tarama görseli */}
      <div className="my-6 flex items-center justify-center">
        <div className="relative flex size-52 items-center justify-center overflow-hidden rounded-3xl border border-border bg-surface">
          {scanning ? (
            <>
              <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent shadow-[0_0_12px_#c8a15a] [animation:scanline_1.4s_ease-in-out_infinite]" />
              <span className="text-sm text-muted-foreground">Doğrulanıyor…</span>
            </>
          ) : mode === 'nfc' ? (
            <Nfc className="size-16 text-accent" />
          ) : (
            <QrCode className="size-16 text-muted-foreground" />
          )}
          <span className="pointer-events-none absolute left-3 top-3 size-6 rounded-tl-lg border-l-2 border-t-2 border-accent" />
          <span className="pointer-events-none absolute right-3 top-3 size-6 rounded-tr-lg border-r-2 border-t-2 border-accent" />
          <span className="pointer-events-none absolute bottom-3 left-3 size-6 rounded-bl-lg border-b-2 border-l-2 border-accent" />
          <span className="pointer-events-none absolute bottom-3 right-3 size-6 rounded-br-lg border-b-2 border-r-2 border-accent" />
        </div>
      </div>

      {mode === 'manual' ? (
        <div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputsRef.current[i] = el
                }}
                value={d}
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !digits[i] && i > 0)
                    inputsRef.current[i - 1]?.focus()
                }}
                inputMode="text"
                maxLength={1}
                aria-label={`Hane ${i + 1}`}
                className={`size-7 rounded-md border bg-background text-center text-sm font-semibold uppercase tabular outline-none focus:border-accent ${
                  error ? 'border-danger' : 'border-border'
                } ${i === 3 || i === 7 ? 'mr-2' : ''}`}
              />
            ))}
          </div>
          {error && (
            <p className="mt-3 text-center text-xs text-danger">
              Lütfen 12 haneli seri numarasını eksiksiz girin.
            </p>
          )}
          <div className="mt-5">
            <PrimaryButton onClick={submitManual}>Doğrula</PrimaryButton>
          </div>
          <button
            onClick={() => setMode('idle')}
            className="mt-3 h-9 w-full text-sm text-muted-foreground"
          >
            Diğer yöntemler
          </button>
        </div>
      ) : (
        !scanning && (
          <div className="mt-auto flex flex-col gap-3">
            <PrimaryButton onClick={() => runScan('scan')}>
              <ScanLine className="size-5" />
              Kamera ile QR tara
            </PrimaryButton>
            <GhostButton onClick={() => runScan('nfc')}>
              <Nfc className="size-4" />
              NFC ile dokun
            </GhostButton>
            <button
              onClick={() => setMode('manual')}
              className="h-10 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Seri numarasını elle gir
            </button>
          </div>
        )
      )}
      <style>{`@keyframes scanline{0%{top:8%}50%{top:88%}100%{top:8%}}`}</style>
    </div>
  )
}

/* ---------------- Model info ---------------- */
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
    <div className="flex h-full flex-col px-6 pb-8 pt-2">
      <div className="flex flex-1 flex-col justify-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-accent/15 animate-fade-up">
          <Check className="size-8 text-accent" />
        </div>
        <h2 className="mt-5 text-center font-display text-2xl font-semibold">
          Cihazınız doğrulandı
        </h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Orijinal ürün — garantiniz bugün başladı.
        </p>

        <Card className="mt-6">
          <img
            src="/device.png"
            alt={`${model.name} arıtma cihazı`}
            className="mx-auto h-40 w-auto object-contain"
          />
          <div className="mt-4 space-y-3">
            <Row label="Model" value={model.name} />
            <Row label="Seri numarası" value={serialNo} />
            <Row label="Filtre kapasitesi" value={`${formatNum(model.capacityL)} L`} />
            <Row label="Garanti" value="3 yıl (aktivasyon ile uzatıldı)" />
          </div>
        </Card>
      </div>
      <PrimaryButton onClick={onNext} className="mt-6">
        Devam et
        <ChevronRight className="size-5" />
      </PrimaryButton>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

/* ---------------- Q1 household size ---------------- */
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
      <div className="grid grid-cols-3 gap-3">
        {options.map((n) => (
          <SelectCard
            key={n}
            selected={people === n}
            onClick={() => setPeople(n)}
            className="flex-col items-center justify-center py-6"
          >
            <Users
              className={`size-6 ${people === n ? 'text-accent' : 'text-muted-foreground'}`}
            />
            <span className="mt-2 font-display text-xl font-semibold">
              {n === 5 ? '5+' : n}
            </span>
          </SelectCard>
        ))}
      </div>
    </QuestionShell>
  )
}

/* ---------------- Q2 habits ---------------- */
const USE_OPTIONS: { id: UseCase; label: string; icon: typeof Coffee }[] = [
  { id: 'drinking', label: 'İçme suyu', icon: Droplets },
  { id: 'tea', label: 'Çay & kahve', icon: Coffee },
  { id: 'cooking', label: 'Yemek pişirme', icon: Utensils },
  { id: 'pet', label: 'Evcil hayvan', icon: PawPrint },
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
      <div className="grid grid-cols-2 gap-3">
        {USE_OPTIONS.map(({ id, label, icon: Icon }) => (
          <SelectCard key={id} selected={uses.includes(id)} onClick={() => toggle(id)}>
            <Icon
              className={`size-5 ${uses.includes(id) ? 'text-accent' : 'text-muted-foreground'}`}
            />
            <span className="text-sm font-medium">{label}</span>
          </SelectCard>
        ))}
      </div>

      <p className="mb-3 mt-7 text-sm text-muted-foreground">
        Gün içinde evde misiniz?
      </p>
      <div className="flex flex-col gap-2.5">
        {PRESENCE_OPTIONS.map(({ id, label }) => (
          <SelectCard key={id} selected={presence === id} onClick={() => setPresence(id)}>
            <span
              className={`flex size-5 items-center justify-center rounded-full border ${
                presence === id ? 'border-accent bg-accent' : 'border-border'
              }`}
            >
              {presence === id && <Check className="size-3 text-accent-foreground" />}
            </span>
            <span className="text-sm font-medium">{label}</span>
          </SelectCard>
        ))}
      </div>
    </QuestionShell>
  )
}

/* ---------------- Q3 current source ---------------- */
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
      <div className="grid grid-cols-2 gap-3">
        {SOURCE_OPTIONS.map(({ id, label, hint }) => (
          <SelectCard
            key={id}
            selected={source === id}
            onClick={() => setSource(id)}
            className="flex-col items-start"
          >
            <span className="text-sm font-semibold">{label}</span>
            <span className="text-xs text-muted-foreground">{hint}</span>
          </SelectCard>
        ))}
      </div>

      {source === 'damacana' && (
        <div className="mt-7 animate-fade-up">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Ayda kaç damacana?</span>
            <span className="font-display text-lg font-semibold tabular text-accent">
              {damacanaPerMonth}
            </span>
          </div>
          <input
            type="range"
            min={2}
            max={20}
            value={damacanaPerMonth}
            onChange={(e) => setDamacanaPerMonth(Number(e.target.value))}
            className="w-full accent-[#c8a15a]"
            aria-label="Aylık damacana adedi"
          />
        </div>
      )}
    </QuestionShell>
  )
}

/* ---------------- Q4 region ---------------- */
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
      <div className="flex flex-col gap-2.5">
        {REGIONS.map((r) => (
          <SelectCard key={r} selected={region === r} onClick={() => setRegion(r)}>
            <MapPin
              className={`size-5 ${region === r ? 'text-accent' : 'text-muted-foreground'}`}
            />
            <span className="text-sm font-medium">{r}</span>
          </SelectCard>
        ))}
      </div>
    </QuestionShell>
  )
}

/* ---------------- Summary ---------------- */
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
    <div className="flex h-full flex-col px-6 pb-8 pt-2">
      <div className="flex flex-1 flex-col justify-center">
        <Eyebrow>Sizin için hesapladık</Eyebrow>
        <h2 className="mt-2 text-pretty font-display text-2xl font-semibold leading-tight">
          İşte tahmini tablonuz
        </h2>

        <div className="mt-6 space-y-4">
          <SummaryLine delay={0.1}>
            Aileniz günde yaklaşık{' '}
            <b className="text-water-light">
              <AnimatedNumber value={Math.round(daily)} /> litre
            </b>{' '}
            arıtılmış su tüketecek.
          </SummaryLine>
          <SummaryLine delay={0.5}>
            Filtreniz yaklaşık{' '}
            <b className="text-water-light">
              <AnimatedNumber value={months} /> ay
            </b>{' '}
            dayanacak; değişim zamanını biz takip edeceğiz.
          </SummaryLine>
          <SummaryLine delay={0.9}>
            Yılda tahmini{' '}
            <b className="text-accent">
              <AnimatedNumber value={yearly} format={formatTL} duration={1800} />
            </b>{' '}
            tasarruf edeceksiniz.
          </SummaryLine>
        </div>

        <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
          Bu tahminleri istediğiniz zaman Profil &gt; Ayarlar bölümünden
          güncelleyebilirsiniz. Litre başına arıtılmış su maliyeti{' '}
          {purifiedCostPerL(model).toFixed(2)} TL, mevcut kaynağınız{' '}
          {previousCostPerL(household).toFixed(2)} TL olarak alındı.
        </p>
      </div>
      <PrimaryButton onClick={onNext} className="mt-6">
        Harika, devam et
        <ChevronRight className="size-5" />
      </PrimaryButton>
    </div>
  )
}

function SummaryLine({
  children,
  delay,
}: {
  children: React.ReactNode
  delay: number
}) {
  return (
    <p
      className="animate-fade-up text-pretty text-lg leading-relaxed"
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </p>
  )
}

/* ---------------- Notifications ---------------- */
function Notifications({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="flex h-full flex-col px-6 pb-8 pt-2">
      <div className="flex flex-1 flex-col justify-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-accent/15">
          <Bell className="size-7 text-accent" />
        </div>
        <h2 className="mt-5 text-center font-display text-2xl font-semibold">
          Doğru zamanda haber verelim
        </h2>
        <p className="mx-auto mt-3 max-w-[300px] text-center text-sm leading-relaxed text-muted-foreground">
          Filtreniz değişim zamanına yaklaştığında ve haftalık tasarruf özetiniz
          hazır olduğunda sizi bilgilendiririz. Spam yok — ayda en fazla bir
          pazarlama mesajı.
        </p>

        <div className="mt-8 space-y-3">
          <PermRow icon={ShieldCheck} text="Filtre değişim hatırlatmaları" />
          <PermRow icon={Bell} text="Haftalık tasarruf özeti" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <PrimaryButton onClick={onFinish}>Bildirimlere izin ver</PrimaryButton>
        <button
          onClick={onFinish}
          className="h-10 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Şimdilik geç
        </button>
      </div>
    </div>
  )
}

function PermRow({ icon: Icon, text }: { icon: typeof Bell; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
      <Icon className="size-5 text-accent" />
      <span className="text-sm font-medium">{text}</span>
    </div>
  )
}

/* ---------------- Shared question shell ---------------- */
function QuestionShell({
  title,
  subtitle,
  children,
  onNext,
  disabled,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  onNext: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex h-full flex-col px-6 pb-8 pt-2">
      <h2 className="text-pretty font-display text-2xl font-semibold leading-tight">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      <div className="mt-7 flex-1">{children}</div>
      <PrimaryButton onClick={onNext} disabled={disabled} className="mt-6">
        Devam et
        <ChevronRight className="size-5" />
      </PrimaryButton>
    </div>
  )
}
