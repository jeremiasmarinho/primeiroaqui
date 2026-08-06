import { useState } from 'react'

import { formatCents, parseBRLToCents } from '../../lib/money'
import type { ApiProduct } from '../../lib/api'

export interface ProductFormValues {
  title: string
  category: string
  priceCents: number
  stock: number
}

interface ProductsPanelProps {
  products: ApiProduct[]
  onCreate: (values: ProductFormValues) => Promise<boolean>
  onUpdate: (productId: string, patch: Partial<ProductFormValues & { isActive: boolean }>) => Promise<boolean>
  onUploadPhoto: (productId: string, file: File) => Promise<boolean>
}

interface DraftState {
  title: string
  category: string
  price: string
  stock: string
}

const EMPTY_DRAFT: DraftState = { title: '', category: '', price: '', stock: '0' }

/** Valida o rascunho digitado; devolve os valores prontos para a API ou uma mensagem pt-BR. */
const parseDraft = (draft: DraftState): { ok: true; values: ProductFormValues } | { ok: false; message: string } => {
  if (!draft.title.trim()) return { ok: false, message: 'Informe o nome do produto.' }
  if (!draft.category.trim()) return { ok: false, message: 'Informe a categoria.' }
  const priceCents = parseBRLToCents(draft.price)
  if (priceCents === null) return { ok: false, message: 'Informe um preço válido, ex.: 19,90.' }
  const stock = Number(draft.stock)
  if (!Number.isInteger(stock) || stock < 0) return { ok: false, message: 'Estoque deve ser um número inteiro (0 ou mais).' }
  return { ok: true, values: { title: draft.title.trim(), category: draft.category.trim(), priceCents, stock } }
}

const inputClass = 'w-full rounded-[16px] border border-line px-3 py-3 outline-none'

/** Cadastro e gestão dos produtos da loja: publicar, editar, ativar/desativar e foto. */
export default function ProductsPanel({ products, onCreate, onUpdate, onUploadPhoto }: ProductsPanelProps) {
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT)
  const [formError, setFormError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<DraftState>(EMPTY_DRAFT)
  const [photoNotice, setPhotoNotice] = useState('')

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = parseDraft(draft)
    if (!parsed.ok) {
      setFormError(parsed.message)
      return
    }
    setFormError('')
    if (await onCreate(parsed.values)) setDraft(EMPTY_DRAFT)
  }

  const startEdit = (product: ApiProduct) => {
    setEditingId(product.id)
    setEditDraft({
      title: product.title,
      category: product.category,
      price: (product.priceCents / 100).toFixed(2).replace('.', ','),
      stock: String(product.stock),
    })
    setFormError('')
  }

  const handleEditSave = async (productId: string) => {
    const parsed = parseDraft(editDraft)
    if (!parsed.ok) {
      setFormError(parsed.message)
      return
    }
    setFormError('')
    if (await onUpdate(productId, parsed.values)) setEditingId(null)
  }

  const handlePhoto = async (productId: string, file: File | undefined) => {
    if (!file) return
    setPhotoNotice('')
    if (await onUploadPhoto(productId, file)) setPhotoNotice('Foto enviada com sucesso.')
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="rounded-[24px] border border-line p-4">
        <h3 className="text-lg font-black text-ink">Publicar produto</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Nome do produto"
            aria-label="Nome do produto"
            className={inputClass}
          />
          <input
            value={draft.category}
            onChange={(event) => setDraft((prev) => ({ ...prev, category: event.target.value }))}
            placeholder="Categoria (ex.: Farmácia)"
            aria-label="Categoria"
            className={inputClass}
          />
          <input
            value={draft.price}
            onChange={(event) => setDraft((prev) => ({ ...prev, price: event.target.value }))}
            placeholder="Preço (R$), ex.: 19,90"
            aria-label="Preço em reais"
            inputMode="decimal"
            className={inputClass}
          />
          <input
            value={draft.stock}
            onChange={(event) => setDraft((prev) => ({ ...prev, stock: event.target.value }))}
            placeholder="Estoque"
            aria-label="Estoque"
            inputMode="numeric"
            className={inputClass}
          />
        </div>
        {formError && editingId === null ? (
          <p role="alert" className="mt-2 text-sm font-semibold text-error">{formError}</p>
        ) : null}
        <button type="submit" className="btn-primary mt-3 min-h-[44px] rounded-[16px] px-4 py-2 text-sm font-semibold">
          Publicar produto
        </button>
      </form>

      {photoNotice ? <p role="status" className="text-sm font-semibold text-success">{photoNotice}</p> : null}

      {products.length === 0 ? (
        <div className="rounded-[24px] border border-line p-6 text-center">
          <h3 className="text-lg font-black text-ink">Sua vitrine está vazia</h3>
          <p className="mt-2 text-sm text-ink-muted">
            Publique seu primeiro produto acima — é ele que os vizinhos vão encontrar na busca.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {products.map((product) => (
            <li key={product.id} className="rounded-[24px] border border-line p-4">
              {editingId === product.id ? (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <input value={editDraft.title} onChange={(event) => setEditDraft((prev) => ({ ...prev, title: event.target.value }))} aria-label="Nome do produto (edição)" className={inputClass} />
                    <input value={editDraft.category} onChange={(event) => setEditDraft((prev) => ({ ...prev, category: event.target.value }))} aria-label="Categoria (edição)" className={inputClass} />
                    <input value={editDraft.price} onChange={(event) => setEditDraft((prev) => ({ ...prev, price: event.target.value }))} aria-label="Preço em reais (edição)" inputMode="decimal" className={inputClass} />
                    <input value={editDraft.stock} onChange={(event) => setEditDraft((prev) => ({ ...prev, stock: event.target.value }))} aria-label="Estoque (edição)" inputMode="numeric" className={inputClass} />
                  </div>
                  {formError ? <p role="alert" className="text-sm font-semibold text-error">{formError}</p> : null}
                  <div className="flex gap-2">
                    <button onClick={() => void handleEditSave(product.id)} className="btn-primary min-h-[44px] rounded-[16px] px-4 py-2 text-sm font-semibold">
                      Salvar alterações
                    </button>
                    <button onClick={() => setEditingId(null)} className="min-h-[44px] rounded-[16px] border border-line px-4 py-2 text-sm font-semibold text-ink-muted">
                      Descartar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-ink">{product.title}</p>
                      <p className="text-sm text-ink-muted">
                        {product.category} • {formatCents(product.priceCents)} • estoque: {product.stock}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        product.isActive ? 'bg-success/10 text-success' : 'bg-surface-page text-ink-faint'
                      }`}
                    >
                      {product.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button onClick={() => startEdit(product)} className="min-h-[44px] rounded-[16px] border border-line px-4 py-2 text-sm font-semibold text-ink-muted">
                      Editar
                    </button>
                    <button
                      onClick={() => void onUpdate(product.id, { isActive: !product.isActive })}
                      className="min-h-[44px] rounded-[16px] border border-line px-4 py-2 text-sm font-semibold text-ink-muted"
                    >
                      {product.isActive ? 'Desativar' : 'Ativar'}
                    </button>
                    <label className="min-h-[44px] cursor-pointer rounded-[16px] border border-line px-4 py-2 text-sm font-semibold text-ink-muted">
                      Enviar foto
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        aria-label={`Enviar foto de ${product.title}`}
                        onChange={(event) => void handlePhoto(product.id, event.target.files?.[0])}
                      />
                    </label>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
