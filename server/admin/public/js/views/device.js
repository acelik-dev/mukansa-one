import { del, get, post } from '../api.js'
import { h } from '../dom.js'
import { ago, AUDIT, date, dateTime, KIND, num, num1, PRESENCE, SERVICE_CATEGORY, SERVICE_STATUS, SOURCE, STATUS, tl, TONE, USES } from '../fmt.js'
import { icon } from '../icons.js'
import { confirmDialog, copyText, empty, liquidGauge, modal, skeleton, statusChip, toast, toneChip } from '../ui.js'

const kv = (rows) =>
  h(
    'dl',
    { class: 'kv' },
    rows.filter(Boolean).flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]),
  )

export async function deviceView(root, ctx, id) {
  root.replaceChildren(skeleton(70), skeleton(300, { marginTop: '18px' }))
  const [initial, config] = await Promise.all([get(`/api/devices/${id}`), get('/api/config')])
  let detail = initial
  const modelName = (mid) => config.models.find((m) => m.id === mid)?.name ?? mid

  const run = async (body, okMsg) => {
    const r = await post(`/api/devices/${id}/action`, body)
    detail = r.detail
    render()
    if (okMsg) toast(okMsg)
    return r
  }

  // ------------------------------------------------------------ eylemler
  const askPush = async () => {
    const title = h('input', { class: 'input', value: 'Mukansa One', maxlength: '80' })
    const body = h('textarea', { class: 'input', maxlength: '240' })
    body.value = 'Bu bir test bildirimidir.'
    await modal({
      title: 'Test bildirimi gönder',
      body: h('div', {}, h('p', {}, 'Bildirim, bu cihazın kayıtlı tüm telefonlarına gider ve bildirim günlüğüne “Manuel” olarak yazılır.'), h('div', { class: 'field' }, h('label', {}, 'Başlık'), title), h('div', { class: 'field' }, h('label', {}, 'Mesaj'), body)),
      actions: [
        { label: 'Vazgeç' },
        {
          label: 'Gönder',
          kind: 'primary',
          onClick: async () => {
            const r = await run({ type: 'send_push', title: title.value, body: body.value })
            toast(r.ok ? `Bildirim iletildi (${r.sent}/${r.total})` : 'Bildirim iletilemedi', r.ok ? 'ok' : 'err')
          },
        },
      ],
    })
  }

  const askBlock = async () => {
    const reason = h('input', { class: 'input', placeholder: 'Örn. kayıp/çalıntı cihaz, mükerrer kod…', maxlength: '200' })
    await modal({
      title: 'Cihaz engellensin mi?',
      body: h('div', {}, h('p', {}, 'Tüm oturumlar kapatılır ve bu cihaz yeniden aktive edilemez. İstediğiniz zaman engeli kaldırabilirsiniz.'), h('div', { class: 'field' }, h('label', {}, 'Neden (isteğe bağlı)'), reason)),
      actions: [{ label: 'Vazgeç' }, { label: 'Engelle', kind: 'danger', onClick: () => run({ type: 'block', reason: reason.value || undefined }, 'Cihaz engellendi') }],
    })
  }

  const askDelete = async () => {
    const serial = detail.summary.serialNo
    const confirmInput = h('input', { class: 'input mono', placeholder: serial, autocomplete: 'off' })
    await modal({
      title: 'Cihaz kalıcı olarak silinsin mi?',
      body: h('div', {}, h('p', {}, 'Cihaz kaydı, hane bilgileri, oturumlar ve bildirim geçmişi silinir. Bu işlem geri alınamaz. Onaylamak için seri numarasını yazın:'), h('div', { class: 'field' }, confirmInput)),
      actions: [
        { label: 'Vazgeç' },
        {
          label: 'Kalıcı olarak sil',
          kind: 'danger',
          onClick: async () => {
            await del(`/api/devices/${id}?confirm=${encodeURIComponent(confirmInput.value.trim())}`)
            toast('Cihaz silindi')
            ctx.navigate('/devices')
          },
        },
      ],
    })
  }

  const reveal = async (host) => {
    const { code } = await get(`/api/devices/${id}/code`)
    const box = h('div', { class: 'code-box' }, h('span', { class: 'grow' }, code.replace(/(.{4})/g, '$1 ').trim()), h('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Kopyala', onClick: () => copyText(code) }, icon('copy')))
    host.replaceChildren(box, h('div', { class: 'hint', style: { marginTop: '8px' } }, 'Bu görüntüleme denetim günlüğüne yazıldı. 30 saniye sonra gizlenir.'))
    setTimeout(() => host.isConnected && paintCodeHidden(host), 30000)
  }
  const paintCodeHidden = (host) =>
    host.replaceChildren(
      h('div', { class: 'code-box' }, h('span', { class: 'grow' }, '•••• •••• ••••'), h('button', { class: 'btn sm', type: 'button', onClick: (e) => (e.currentTarget.disabled = true, reveal(host).catch((err) => toast(err.message, 'err'))) }, icon('eye'), 'Göster')),
      h('div', { class: 'hint', style: { marginTop: '8px' } }, 'Aktivasyon kodu cihaz sahibinin kimlik bilgisidir; yalnızca gerekirse görüntüleyin.'),
    )

  // ------------------------------------------------------------ görünüm
  function render() {
    const sm = detail.summary
    const m = detail.metrics
    const p = detail.profile
    const f = sm.filter

    const header = h(
      'div',
      { class: 'page-head' },
      h(
        'div',
        {},
        h('a', { class: 'hint', href: '#/devices', style: { display: 'inline-flex', gap: '6px', alignItems: 'center', marginBottom: '10px' } }, icon('back', 14), 'Cihazlar'),
        h('h1', { class: 'page-title mono', style: { fontFamily: 'var(--f-mono)', letterSpacing: '.03em', fontWeight: 400, fontSize: 'clamp(26px, 3vw, 38px)', color: 'var(--gold-2)' } }, sm.serialNo),
        h('div', { class: 'row', style: { marginTop: '12px' } }, statusChip(sm.status), h('span', { class: 'tag' }, modelName(sm.modelId)), f ? toneChip(f.tone) : null, sm.blockedAt ? h('span', { class: 'hint' }, `Engellendi: ${dateTime(sm.blockedAt)}`) : null),
      ),
      h(
        'div',
        { class: 'head-actions' },
        h('button', { class: 'btn', type: 'button', disabled: !sm.pushDevices, title: sm.pushDevices ? '' : 'Kayıtlı bildirim adresi yok', onClick: askPush }, icon('send'), 'Test bildirimi'),
        h('button', { class: 'btn', type: 'button', disabled: sm.status !== 'ready', onClick: () => confirmDialog({ title: 'Filtre değişimi kaydedilsin mi?', text: 'Filtre sayacı şimdi sıfırlanır (kullanıcı uygulamada “Filtre değiştirdim” dediğinde olduğu gibi).', confirmLabel: 'Kaydet', onConfirm: () => run({ type: 'replace_filter' }, 'Filtre sayacı sıfırlandı') }) }, icon('wrench'), 'Filtre değişti'),
        sm.blockedAt ? h('button', { class: 'btn', type: 'button', onClick: () => run({ type: 'unblock' }, 'Engel kaldırıldı') }, icon('check'), 'Engeli kaldır') : h('button', { class: 'btn danger', type: 'button', onClick: askBlock }, icon('ban'), 'Engelle'),
      ),
    )

    // Filtre kartı
    const filterCard = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Filtre ömrü')),
      f
        ? h(
            'div',
            { class: 'row', style: { gap: '26px', flexWrap: 'wrap' } },
            liquidGauge(f.percent, f.tone, 176),
            h('div', { class: 'grow', style: { minWidth: '220px' } }, kv([['Kalan gün', `${num(f.days)} gün`], ['Kalan kapasite', `${num(f.litres)} L`], ['Belirleyici', f.capacityBound ? 'Kapasite' : '6 ay hijyen sınırı'], ['Takılma', date(detail.filterInstallMs)], ['Kartuş', m?.model?.filterModel ?? '—']])),
          )
        : empty('Ölçüm yok', 'Cihaz kurulumu tamamlandığında filtre durumu burada görünür.'),
    )

    const profileCard = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Hane profili'), h('span', { class: 'card-note' }, 'kullanıcının onboarding cevapları')),
      p
        ? kv([
            ['Kişi sayısı', `${p.household.people}`],
            ['Kullanım', p.household.uses.map((u) => USES[u] ?? u).join(', ')],
            ['Evde bulunma', PRESENCE[p.household.presence] ?? p.household.presence],
            ['Önceki su kaynağı', SOURCE[p.household.source] ?? p.household.source],
            p.household.source === 'damacana' ? ['Damacana / ay', p.household.damacanaPerMonth ?? '—'] : null,
            p.household.damacanaPriceTL ? ['Damacana fiyatı', tl(p.household.damacanaPriceTL)] : null,
            ['Bölge', p.household.region ?? '—'],
          ])
        : empty('Henüz profil yok', 'Kullanıcı kurulumu tamamlamadı.'),
    )

    const metricsCard = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Tahminler')),
      m
        ? kv([
            ['Günlük tüketim', `${num1(m.dailyL)} L`],
            ['Aylık tüketim', `${num(m.monthlyL)} L`],
            ['Günlük tasarruf', tl(m.dailySaving)],
            ['Toplam arıtılan', `${num(m.totalLiters)} L`],
            ['Kümülatif tasarruf', tl(m.cumulativeSaving)],
            ['Engellenen şişe', num(m.bottles)],
            ['CO₂ eşdeğeri', `${num(m.co2Kg)} kg`],
            ['Ağaç eşdeğeri', num(m.trees)],
            ['Kullanım süresi', `${num(m.daysSinceActivation)} gün`],
          ])
        : empty('Hesaplanamadı'),
    )

    const notifCard = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Bildirim tercihleri')),
      p
        ? h(
            'div',
            { class: 'row' },
            [['weeklySummary', 'Haftalık özet'], ['filterAlerts', 'Filtre uyarıları'], ['milestones', 'Kilometre taşları'], ['marketing', 'Pazarlama']].map(([k, l]) => h('span', { class: `chip ${p.notif[k] ? 'ok' : 'mute'}` }, l)),
          )
        : h('span', { class: 'hint' }, '—'),
    )

    const codeHost = h('div', {})
    paintCodeHidden(codeHost)

    const timeline = h(
      'div',
      { class: 'timeline' },
      [
        ['Kod üretildi', sm.createdAt, true],
        ['Cihaz aktive edildi', sm.activatedAt, !!sm.activatedAt],
        ['Kurulum tamamlandı', sm.onboardedAt, !!sm.onboardedAt],
        ['Son filtre takılışı', detail.filterInstallMs, !!detail.filterInstallMs],
      ].map(([t, ms, on]) => h('div', { class: `ev ${on ? '' : 'off'}` }, h('b', {}, t), h('span', {}, on ? `${dateTime(ms)} · ${ago(ms)}` : 'henüz olmadı'))),
    )

    const sessions = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, `Oturumlar · ${detail.sessions.length}`), detail.sessions.length ? h('button', { class: 'btn sm', type: 'button', onClick: () => confirmDialog({ title: 'Tüm oturumlar kapatılsın mı?', text: 'Bu cihazdaki tüm telefonlar çıkış yapmış olur. Kullanıcı seri numarasıyla tekrar bağlanabilir.', confirmLabel: 'Oturumları kapat', danger: true, onConfirm: () => run({ type: 'revoke_sessions' }, 'Oturumlar kapatıldı') }) }, 'Tümünü kapat') : null),
      detail.sessions.length
        ? h(
            'div',
            { class: 'list' },
            detail.sessions.map((s) =>
              h('div', { class: 'it' }, h('div', { class: 'dot' }, icon('phone')), h('div', { class: 'grow' }, h('div', { class: 'ttl' }, { ios: 'iPhone', android: 'Android', web: 'Web' }[s.platform] ?? 'Bilinmiyor'), h('div', { class: 'meta' }, `Açıldı ${date(s.createdAt)} · son görülme ${ago(s.lastSeenAt)}`)), s.push ? h('span', { class: 'chip ok' }, 'Bildirim açık') : h('span', { class: 'chip mute' }, 'Bildirim yok')),
            ),
          )
        : empty('Açık oturum yok'),
    )

    const notifications = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Bildirim geçmişi')),
      detail.notifications.filter((n) => n.title).length
        ? h('div', { class: 'list' }, detail.notifications.filter((n) => n.title).slice(0, 8).map((n) => h('div', { class: 'it' }, h('div', { class: 'grow' }, h('div', { class: 'ttl' }, n.title), h('div', { class: 'meta' }, n.body)), h('div', { class: 'end' }, h('span', { class: `chip ${n.delivered ? KIND[n.kind]?.cls ?? 'mute' : 'danger'}` }, n.delivered ? KIND[n.kind]?.label : 'İletilemedi'), h('div', { class: 'meta', style: { marginTop: '4px' } }, ago(n.at))))))
        : empty('Henüz bildirim gönderilmedi'),
    )

    const serviceRequests = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Servis talepleri'), h('a', { class: 'card-note', href: '#/service-requests' }, 'Tümü →')),
      detail.serviceRequests.length
        ? h(
            'div',
            { class: 'list' },
            detail.serviceRequests.slice(0, 6).map((r) =>
              h(
                'div',
                { class: 'it' },
                h('div', { class: 'grow' }, h('div', { class: 'ttl' }, r.description), h('div', { class: 'meta' }, `${SERVICE_CATEGORY[r.category]?.label ?? r.category} · ${r.contactPhone} · ${ago(r.createdAt)}`)),
                h('span', { class: `chip ${SERVICE_STATUS[r.status]?.cls ?? 'mute'}` }, SERVICE_STATUS[r.status]?.label ?? r.status),
              ),
            ),
          )
        : empty('Henüz servis talebi yok'),
    )

    const noteInput = h('textarea', { class: 'input', maxlength: '500', placeholder: 'Bu cihaza dair iç not (bayi, müşteri adı, servis geçmişi…)' })
    noteInput.value = sm.note ?? ''
    const noteCard = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'İç not')),
      noteInput,
      h('div', { class: 'row end', style: { marginTop: '10px' } }, h('button', { class: 'btn sm primary', type: 'button', onClick: () => run({ type: 'set_note', note: noteInput.value }, 'Not kaydedildi').catch((e) => toast(e.message, 'err')) }, 'Notu kaydet')),
    )

    const audit = h(
      'div',
      { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Yönetici işlemleri')),
      detail.audit.length
        ? h('div', { class: 'list' }, detail.audit.slice(0, 8).map((a) => h('div', { class: 'it' }, h('div', { class: 'grow' }, h('div', { class: 'ttl' }, AUDIT[a.action] ?? a.action), h('div', { class: 'meta' }, [a.admin, a.detail].filter(Boolean).join(' · '))), h('div', { class: 'meta' }, ago(a.at)))))
        : h('span', { class: 'hint' }, 'Bu cihaz üzerinde henüz işlem yapılmadı.'),
    )

    const modelSel = h('select', { class: 'input', 'aria-label': 'Model', onChange: (e) => run({ type: 'set_model', modelId: e.target.value }, 'Model güncellendi').catch((err) => toast(err.message, 'err')) }, config.models.map((mm) => h('option', { value: mm.id, selected: mm.id === sm.modelId }, mm.name)))

    const danger = h(
      'div',
      { class: 'card danger-zone' },
      h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Tehlikeli bölge')),
      h('div', { class: 'field' }, h('label', {}, 'Cihaz modeli'), modelSel),
      h('div', { class: 'stack', style: { gap: '10px' } },
        h('button', { class: 'btn danger block', type: 'button', disabled: sm.status === 'pending', onClick: () => confirmDialog({ title: 'Aktivasyon sıfırlansın mı?', text: 'Hane bilgileri, oturumlar ve bildirim geçmişi silinir; cihaz “Bekliyor” durumuna döner ve aynı kodla yeniden aktive edilebilir.', confirmLabel: 'Sıfırla', danger: true, onConfirm: () => run({ type: 'reset_activation' }, 'Aktivasyon sıfırlandı') }) }, icon('reset'), 'Aktivasyonu sıfırla'),
        h('button', { class: 'btn danger block', type: 'button', onClick: askDelete }, icon('trash'), 'Cihazı sil'),
      ),
    )

    root.replaceChildren(
      h(
        'div',
        { class: 'reveal' },
        header,
        h(
          'div',
          { class: 'grid g-21' },
          h('div', { class: 'stack' }, filterCard, h('div', { class: 'grid g-2' }, profileCard, metricsCard), notifCard, serviceRequests, notifications),
          h('div', { class: 'stack' }, h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Aktivasyon kodu')), codeHost), h('div', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Yaşam döngüsü')), timeline), sessions, noteCard, audit, danger),
        ),
      ),
    )
  }
  render()
}

export { STATUS, TONE }
