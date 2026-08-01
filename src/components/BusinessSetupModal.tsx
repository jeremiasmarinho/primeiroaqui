import { X } from 'lucide-react'
import type { BusinessProfile } from '../types'

interface BusinessSetupModalProps {
  open: boolean
  form: BusinessProfile
  onChange: (patch: Partial<BusinessProfile>) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onClose: () => void
}

export default function BusinessSetupModal({
  open,
  form,
  onChange,
  onSubmit,
  onClose,
}: BusinessSetupModalProps) {
  if (!open) return null

  return (

        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-xl rounded-[28px] bg-white p-4 shadow-2xl md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Cadastro rápido</p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">Configure seu negócio</h3>
              </div>
              <button onClick={() => onClose()} className="rounded-full bg-slate-100 p-2"><X className="h-5 w-5 text-slate-700" /></button>
            </div>
            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              <input value={form.name} onChange={(event) => onChange({ name: event.target.value })} placeholder="Nome do negócio" className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none" />
              <select value={form.category} onChange={(event) => onChange({ category: event.target.value })} className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none">
                <option value="Loja local">Loja local</option>
                <option value="Mercado">Mercado</option>
                <option value="Farmácia">Farmácia</option>
                <option value="Serviço">Serviço</option>
              </select>
              <input value={form.address} onChange={(event) => onChange({ address: event.target.value })} placeholder="Endereço" className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none" />
              <input value={form.phone} onChange={(event) => onChange({ phone: event.target.value })} placeholder="Telefone" className="w-full rounded-[16px] border border-slate-200 px-3 py-3 outline-none" />
              <button type="submit" className="w-full rounded-[20px] bg-slate-900 px-4 py-3 font-bold text-white">Salvar cadastro</button>
            </form>
          </div>
        </div>
  )
}
