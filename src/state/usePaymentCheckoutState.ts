import { useEffect, useRef, useState } from 'react'

import { api, ApiError, type ApiOrder, type ApiPaymentCustomer, type ApiPaymentStatus } from '../lib/api'
import { readStoredJSON, writeStoredJSON } from '../lib/storage'
import { CardTokenizeError, tokenizeCard } from '../lib/pagarmeTokenize'
import {
  cardExpiryParts,
  formatCpf,
  formatPhone,
  isValidCardExpiry,
  isValidCardNumber,
  isValidCpf,
  isValidCvv,
  isValidPhone,
  splitPhone,
} from '../lib/paymentValidation'
import { STORAGE_KEYS } from './session'
import type { User } from '../types'

/** Mensagem pt-BR do backend quando houver (erro de rede/status 0 cai no fallback local). */
const apiErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof ApiError && err.status > 0 ? err.message : fallback

export interface CardFormState {
  number: string
  holderName: string
  expiry: string
  cvv: string
}

export interface CustomerFormState {
  cpf: string
  phone: string
}

export type PaymentStatus = 'idle' | 'tokenizing' | 'paying' | 'success' | 'error'

export interface PixData {
  qrCode: string | null
  qrCodeUrl: string | null
  expiresAt: string | null
}

export const EMPTY_CARD_FORM: CardFormState = { number: '', holderName: '', expiry: '', cvv: '' }
const EMPTY_CUSTOMER_FORM: CustomerFormState = { cpf: '', phone: '' }

const isCustomerFormState = (value: unknown): value is CustomerFormState =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as CustomerFormState).cpf === 'string' &&
  typeof (value as CustomerFormState).phone === 'string'

const loadStoredCustomer = (): CustomerFormState =>
  readStoredJSON<CustomerFormState>(STORAGE_KEYS.paymentCustomer, EMPTY_CUSTOMER_FORM, isCustomerFormState)

/**
 * Precedência do CPF/telefone que pré-preenche o checkout: perfil cadastrado
 * (`user.document`/`user.phone`, Item 3) primeiro; sem perfil ou sem esses
 * campos, cai para o que já estava salvo no localStorage (comportamento
 * anterior, mantido para quem preencheu o formulário de pagamento antes de
 * editar o perfil).
 */
const initialCustomerForm = (user: User | null | undefined): CustomerFormState => {
  const stored = loadStoredCustomer()
  return {
    cpf: user?.document ? formatCpf(user.document) : stored.cpf,
    phone: user?.phone ? formatPhone(user.phone) : stored.phone,
  }
}

/**
 * Etapa de pagamento do checkout: cartão tokenizado no navegador ou Pix.
 *
 * `pendingOrders` cobre a Fase 6 (um pedido por loja): a etapa cobra um por
 * vez ("Pagamento X de N"), avançando `paymentIndex` a cada sucesso.
 * `holderName`/CPF/telefone da PESSOA são os mesmos entre pedidos — só o
 * `orderId`/valor mudam a cada iteração.
 */
export function usePaymentCheckoutState(user?: User | null) {
  const [pendingOrders, setPendingOrders] = useState<ApiOrder[]>([])
  const [paymentIndex, setPaymentIndex] = useState(0)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  /**
   * Feature flag por ambiente (2026-08-07): null enquanto GET
   * /payments/config ainda não respondeu, depois true/false conforme
   * PAGARME_SECRET_KEY/PUBLIC_KEY estarem configuradas no servidor.
   * `handleFinalizePurchase` (useMarketplaceState.ts) trata `null` como
   * "ainda não sei" e falha fechado (=false, comportamento pré-Fase 2) se
   * checkout terminar antes da resposta chegar — produção sem chaves nunca
   * deve arriscar mostrar uma etapa de pagamento quebrada.
   */
  const [paymentsEnabled, setPaymentsEnabled] = useState<boolean | null>(null)
  const [configError, setConfigError] = useState('')
  const [cardForm, setCardForm] = useState<CardFormState>(EMPTY_CARD_FORM)
  const [customerForm, setCustomerForm] = useState<CustomerFormState>(() => initialCustomerForm(user))
  // Aplica a precedência `user > localStorage` uma ÚNICA vez, na primeira vez
  // que o perfil chega com telefone/CPF preenchidos — o mount inicial roda
  // antes do GET /me (assíncrono) responder, então o estado inicial some com
  // o localStorage; este efeito corrige assim que o perfil real chega. Depois
  // disso nunca mais mexe: senão editar o campo durante o checkout e o
  // perfil re-renderizar apagaria o que a pessoa acabou de digitar.
  const appliedUserPrefillRef = useRef(false)

  useEffect(() => {
    if (appliedUserPrefillRef.current) return
    if (!user?.document && !user?.phone) return
    appliedUserPrefillRef.current = true
    setCustomerForm((prev) => ({
      cpf: user.document ? formatCpf(user.document) : prev.cpf,
      phone: user.phone ? formatPhone(user.phone) : prev.phone,
    }))
  }, [user?.document, user?.phone])
  const [status, setStatus] = useState<PaymentStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [pixData, setPixData] = useState<PixData | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  /**
   * Status do Pix POLLED em GET /orders/:id/payment — o sandbox real não
   * paga um Pix sozinho (não há "pagador" automático), então 'PENDING'
   * persistente é o comportamento ESPERADO em teste manual, não um bug.
   * Some para PAID se um webhook (ou um pagamento manual via app do banco
   * de testes do Pagar.me) confirmar antes do QR expirar.
   */
  const [pixPaymentStatus, setPixPaymentStatus] = useState<ApiPaymentStatus | null>(null)

  const currentOrder: ApiOrder | undefined = pendingOrders[paymentIndex]
  const totalPayments = pendingOrders.length

  // Config publica (feature flag + public key) carregada uma ÚNICA vez, já
  // no mount — não espera o checkout chegar na etapa de pagamento, porque
  // `handleFinalizePurchase` precisa saber ANTES de decidir se mostra a
  // etapa ou finaliza direto (comportamento pré-Fase 2). Ver GET
  // /api/payments/config.
  useEffect(() => {
    if (paymentsEnabled !== null || configError) return
    let cancelled = false
    api
      .paymentsConfig()
      .then((config) => {
        if (cancelled) return
        setPaymentsEnabled(config.enabled)
        setPublicKey(config.enabled ? config.publicKey : null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        // Falha ao consultar a config (rede/servidor fora) também fecha a
        // porta da etapa de pagamento — mais seguro degradar para o fluxo
        // pré-Fase 2 do que arriscar uma etapa sem publicKey confiável.
        setPaymentsEnabled(false)
        setConfigError(apiErrorMessage(err, 'Não foi possível carregar a configuração de pagamento.'))
      })
    return () => {
      cancelled = true
    }
  }, [paymentsEnabled, configError])

  useEffect(() => {
    writeStoredJSON(STORAGE_KEYS.paymentCustomer, customerForm)
  }, [customerForm])

  // Polling do status do Pix: só roda com QR gerado (status success + pixData)
  // e enquanto ainda não chegou PAID. Intervalo de 4s — suficiente para
  // detectar o webhook/confirmação sem martelar a API.
  useEffect(() => {
    if (!pixData || !currentOrder) return
    if (pixPaymentStatus === 'PAID') return

    let cancelled = false
    const poll = () => {
      api
        .getPaymentStatus(currentOrder.id)
        .then(({ paymentStatus }) => {
          if (!cancelled) setPixPaymentStatus(paymentStatus)
        })
        .catch(() => {
          // Falha de polling é silenciosa: a pessoa ainda vê o QR e pode
          // tentar de novo; não é motivo para travar a tela com erro.
        })
    }
    poll()
    const timer = setInterval(poll, 4000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixData, currentOrder?.id, pixPaymentStatus === 'PAID'])

  /** Inicia a etapa com os pedidos recém-criados (um por loja). */
  const startPayment = (orders: ApiOrder[]) => {
    setPendingOrders(orders)
    setPaymentIndex(0)
    setStatus('idle')
    setErrorMessage('')
    setPixData(null)
    setPixPaymentStatus(null)
    setFieldErrors({})
  }

  const resetPayment = () => {
    setPendingOrders([])
    setPaymentIndex(0)
    setStatus('idle')
    setErrorMessage('')
    setPixData(null)
    setPixPaymentStatus(null)
    setCardForm(EMPTY_CARD_FORM)
    setFieldErrors({})
  }

  const onCardFormChange = (patch: Partial<CardFormState>) =>
    setCardForm((prev) => ({ ...prev, ...patch }))

  const onCustomerFormChange = (patch: Partial<CustomerFormState>) =>
    setCustomerForm((prev) => ({ ...prev, ...patch }))

  const buildCustomer = (name: string, email: string): ApiPaymentCustomer => ({
    name,
    email,
    document: customerForm.cpf.replace(/\D/g, ''),
    documentType: 'CPF',
    phone: isValidPhone(customerForm.phone) ? splitPhone(customerForm.phone) : undefined,
  })

  /**
   * CPF/telefone — exigidos pelo servidor tanto para cartão quanto para Pix
   * puro (confirmado em sandbox real: Pix sem `customer.document`/`phone`
   * recusa com 400). Compartilhada pelos dois validadores abaixo.
   */
  const validateCustomerFields = (errors: Record<string, string>): void => {
    if (!isValidCpf(customerForm.cpf)) errors.cpf = 'CPF inválido'
    if (!isValidPhone(customerForm.phone)) errors.phone = 'Telefone inválido (inclua o DDD).'
  }

  /** Roda `fill`, publica os erros e devolve se passou — usada pelos dois validadores abaixo. */
  const runValidation = (fill: (errors: Record<string, string>) => void): boolean => {
    const errors: Record<string, string> = {}
    fill(errors)
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  /** Tokeniza no navegador (número nunca vai ao nosso servidor) e paga o pedido atual. */
  const payWithCard = async (buyerName: string, buyerEmail: string): Promise<'success' | 'error' | 'invalid'> => {
    if (!currentOrder || !publicKey) return 'invalid'
    const cardFormValid = runValidation((errors) => {
      if (!isValidCardNumber(cardForm.number)) errors.number = 'Número de cartão inválido.'
      if (!cardForm.holderName.trim()) errors.holderName = 'Informe o nome no cartão.'
      if (!isValidCardExpiry(cardForm.expiry)) errors.expiry = 'Validade inválida ou vencida.'
      if (!isValidCvv(cardForm.cvv)) errors.cvv = 'CVV inválido'
      validateCustomerFields(errors)
    })
    if (!cardFormValid) return 'invalid'

    setErrorMessage('')
    setStatus('tokenizing')
    try {
      const { expMonth, expYear } = cardExpiryParts(cardForm.expiry)
      const cardToken = await tokenizeCard(publicKey, {
        number: cardForm.number,
        holderName: cardForm.holderName,
        expMonth,
        expYear,
        cvv: cardForm.cvv,
      })

      setStatus('paying')
      await api.payOrder(currentOrder.id, {
        method: 'credit_card',
        customer: buildCustomer(buyerName, buyerEmail),
        cardToken,
      })
      setStatus('success')
      return 'success'
    } catch (err) {
      setStatus('error')
      setErrorMessage(
        err instanceof CardTokenizeError
          ? err.message
          : apiErrorMessage(err, 'Não foi possível processar o pagamento. Tente novamente.'),
      )
      return 'error'
    }
  }

  /** Pix: sem tokenização — chama /pay direto. action_forbidden (Pix gateado) vem como 409 do servidor. */
  const payWithPix = async (buyerName: string, buyerEmail: string): Promise<'success' | 'error' | 'invalid'> => {
    if (!currentOrder) return 'error'
    if (!runValidation(validateCustomerFields)) return 'invalid'

    setErrorMessage('')
    setPixPaymentStatus(null)
    setStatus('paying')
    try {
      const response = await api.payOrder(currentOrder.id, {
        method: 'pix',
        customer: buildCustomer(buyerName, buyerEmail),
      })
      setPixData(response.pix ?? null)
      setPixPaymentStatus('PENDING')
      setStatus('success')
      return 'success'
    } catch (err) {
      setStatus('error')
      setErrorMessage(apiErrorMessage(err, 'Não foi possível gerar o Pix. Tente novamente.'))
      return 'error'
    }
  }

  /** Avança para o próximo pedido pendente (múltiplas lojas) ou sinaliza que terminou. */
  const advanceToNextPayment = (): boolean => {
    if (paymentIndex + 1 >= totalPayments) return false
    setPaymentIndex((index) => index + 1)
    setStatus('idle')
    setErrorMessage('')
    setPixData(null)
    setPixPaymentStatus(null)
    setCardForm(EMPTY_CARD_FORM)
    setFieldErrors({})
    return true
  }

  return {
    pendingOrders,
    paymentIndex,
    totalPayments,
    currentOrder,
    publicKey,
    paymentsEnabled,
    configError,
    cardForm,
    customerForm,
    status,
    errorMessage,
    pixData,
    pixPaymentStatus,
    fieldErrors,
    startPayment,
    resetPayment,
    onCardFormChange,
    onCustomerFormChange,
    payWithCard,
    payWithPix,
    advanceToNextPayment,
  }
}

export type PaymentCheckoutState = ReturnType<typeof usePaymentCheckoutState>
