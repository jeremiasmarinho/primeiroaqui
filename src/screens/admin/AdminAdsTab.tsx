import { useState, type FormEvent } from 'react'

import type { ApiAdInput, ApiAdSlot, ApiAdminAd } from '../../lib/api'

const SLOT_LABELS: Record<ApiAdSlot, string> = {
  HERO_CAROUSEL: 'Carrossel do topo',
  HIGHLIGHT_STRIP: 'Faixa de destaque',
  SPONSORED_FEED: 'Patrocinado no feed',
}
const SLOTS = Object.keys(SLOT_LABELS) as ApiAdSlot[]

export type AdStatus = 'ATIVO' | 'AGENDADO' | 'EXPIRADO' | 'INATIVO'

const STATUS_LABELS: Record<AdStatus, string> = {
  ATIVO: 'Ativo',
  AGENDADO: 'Agendado',
  EXPIRADO: 'Expirado',
  INATIVO: 'Inativo',
}

const STATUS_CLASSES: Record<AdStatus, string> = {
  ATIVO: 'bg-success/10 text-success',
  AGENDADO: 'bg-primary/10 text-primary',
  EXPIRADO: 'bg-ink-muted/10 text-ink-muted',
  INATIVO: 'bg-error/10 text-error',
}

/**
 * Deriva o status exibido a partir de active/startsAt/endsAt — pura, sem
 * depender de estado do componente, pra ficar fácil de testar isolada.
 * Precedência: Inativo > Expirado > Agendado > Ativo (active=false manda,
 * mesmo que a vigência esteja em dia).
 */
export function deriveAdStatus(
  ad: Pick<ApiAdminAd, 'active' | 'startsAt' | 'endsAt'>,
  now: Date = new Date(),
): AdStatus {
  if (!ad.active) return 'INATIVO'
  const startsAt = new Date(ad.startsAt)
  const endsAt = new Date(ad.endsAt)
  if (now.getTime() > endsAt.getTime()) return 'EXPIRADO'
  if (now.getTime() < startsAt.getTime()) return 'AGENDADO'
  return 'ATIVO'
}

const dateTimeBR = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Converte o valor de um input datetime-local (hora local, sem timezone) para ISO. */
function localInputToIso(value: string): string {
  return new Date(value).toISOString()
}

/** Converte um ISO em valor aceito por input type="datetime-local" (hora local). */
function isoToLocalInput(iso: string): string {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

interface AdFormState {
  slot: ApiAdSlot
  advertiserName: string
  imageUrl: string
  linkUrl: string
  startsAt: string
  endsAt: string
  position: string
}

const EMPTY_FORM: AdFormState = {
  slot: 'HERO_CAROUSEL',
  advertiserName: '',
  imageUrl: '',
  linkUrl: '',
  startsAt: '',
  endsAt: '',
  position: '0',
}

function adToForm(ad: ApiAdminAd): AdFormState {
  return {
    slot: ad.slot,
    advertiserName: ad.advertiserName,
    imageUrl: ad.imageUrl,
    linkUrl: ad.linkUrl ?? '',
    startsAt: isoToLocalInput(ad.startsAt),
    endsAt: isoToLocalInput(ad.endsAt),
    position: String(ad.position),
  }
}

interface AdminAdsTabProps {
  ads: ApiAdminAd[]
  pendingAdIds: Set<string>
  onCreate: (input: ApiAdInput) => void
  onEdit: (id: string, input: Partial<ApiAdInput>) => void
  onSetActive: (id: string, active: boolean) => void
}

/**
 * Anúncios da plataforma: lista agrupada por slot (topo/destaque/feed) com
 * status derivado da vigência, e formulário único que serve tanto para criar
 * quanto para editar (clicar "Editar" numa linha carrega os dados no form).
 * Sem botão de excluir de propósito — o ciclo de vida é ativar/desativar, o
 * histórico de anúncios fica registrado.
 */
export default function AdminAdsTab({ ads, pendingAdIds, onCreate, onEdit, onSetActive }: AdminAdsTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AdFormState>(EMPTY_FORM)

  const startEdit = (ad: ApiAdminAd) => {
    setEditingId(ad.id)
    setForm(adToForm(ad))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const payload: ApiAdInput = {
      slot: form.slot,
      advertiserName: form.advertiserName,
      imageUrl: form.imageUrl,
      linkUrl: form.linkUrl || undefined,
      startsAt: localInputToIso(form.startsAt),
      endsAt: localInputToIso(form.endsAt),
      position: Number(form.position) || 0,
    }
    if (editingId) {
      onEdit(editingId, payload)
    } else {
      onCreate(payload)
    }
    cancelEdit()
  }

  const grouped = SLOTS.map((slot) => ({ slot, items: ads.filter((ad) => ad.slot === slot) }))

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-[24px] border border-line p-4 md:p-6">
        <h3 className="text-lg font-black text-ink">{editingId ? 'Editar anúncio' : 'Novo anúncio'}</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
            Posição
            <select
              value={form.slot}
              onChange={(e) => setForm((f) => ({ ...f, slot: e.target.value as ApiAdSlot }))}
              className="min-h-[44px] rounded-[12px] border border-line px-3"
            >
              {SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {SLOT_LABELS[slot]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
            Anunciante
            <input
              value={form.advertiserName}
              onChange={(e) => setForm((f) => ({ ...f, advertiserName: e.target.value }))}
              required
              className="min-h-[44px] rounded-[12px] border border-line px-3"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-ink md:col-span-2">
            URL da imagem
            <input
              value={form.imageUrl}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
              required
              className="min-h-[44px] rounded-[12px] border border-line px-3"
            />
            {form.imageUrl ? (
              <img
                src={form.imageUrl}
                alt="Pré-visualização do anúncio"
                className="mt-2 h-24 w-full rounded-[12px] object-cover"
              />
            ) : null}
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-ink md:col-span-2">
            Link de destino
            <input
              value={form.linkUrl}
              onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
              className="min-h-[44px] rounded-[12px] border border-line px-3"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
            Início
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
              required
              className="min-h-[44px] rounded-[12px] border border-line px-3"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
            Fim
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
              required
              className="min-h-[44px] rounded-[12px] border border-line px-3"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
            Ordem
            <input
              type="number"
              value={form.position}
              onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
              className="min-h-[44px] rounded-[12px] border border-line px-3"
            />
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <button type="submit" className="btn-primary min-h-[44px] rounded-[16px] px-4 text-sm font-semibold">
            {editingId ? 'Salvar edição' : 'Criar anúncio'}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="min-h-[44px] rounded-[16px] border border-line px-4 text-sm font-semibold text-ink-muted"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      {grouped.map(({ slot, items }) => (
        <div key={slot}>
          <h3 className="text-lg font-black text-ink">{SLOT_LABELS[slot]}</h3>
          {items.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">Nenhum anúncio neste espaço.</p>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-[24px] border border-line">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs font-semibold uppercase tracking-[0.15em] text-ink-muted">
                    <th scope="col" className="px-4 py-3">Anunciante</th>
                    <th scope="col" className="px-4 py-3">Vigência</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((ad) => {
                    const status = deriveAdStatus(ad)
                    return (
                      <tr key={ad.id} className="border-b border-line last:border-b-0">
                        <td className="px-4 py-3 font-semibold text-ink">{ad.advertiserName}</td>
                        <td className="tabular px-4 py-3 text-ink-muted">
                          {dateTimeBR.format(new Date(ad.startsAt))} – {dateTimeBR.format(new Date(ad.endsAt))}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASSES[status]}`}>
                            {STATUS_LABELS[status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(ad)}
                              className="min-h-[36px] rounded-[12px] border border-line px-3 py-1 text-xs font-semibold text-ink-muted"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => onSetActive(ad.id, !ad.active)}
                              disabled={pendingAdIds.has(ad.id)}
                              className="motion-safe:active:scale-95 min-h-[36px] rounded-[12px] px-3 py-1 text-xs font-semibold transition-transform disabled:opacity-60 border border-line text-ink-muted"
                            >
                              {pendingAdIds.has(ad.id)
                                ? 'Salvando…'
                                : ad.active
                                  ? `Desativar ${ad.advertiserName}`
                                  : `Reativar ${ad.advertiserName}`}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
