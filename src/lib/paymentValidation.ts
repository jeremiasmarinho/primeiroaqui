/**
 * Máscaras e validações do formulário de pagamento (CPF, telefone, cartão).
 * Tudo hand-rolled (sem dependência de máscara) — CLAUDE.md: bundle enxuto,
 * nenhum recurso proprietário/dependência nova sem necessidade real.
 */

const onlyDigits = (value: string): string => value.replace(/\D/g, '')

// --------------------------------------------------------------- CPF

/** Formata progressivamente enquanto digita: 000.000.000-00. */
export const formatCpf = (value: string): string => {
  const digits = onlyDigits(value).slice(0, 11)
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean)
  let out = parts.join('.')
  if (digits.length > 9) out += `-${digits.slice(9, 11)}`
  return out
}

/** Validação de dígitos verificadores do CPF (algoritmo padrão da Receita). */
export const isValidCpf = (value: string): boolean => {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false // todos os dígitos iguais: sempre inválido

  const calcDigit = (base: string): number => {
    let sum = 0
    let weight = base.length + 1
    for (const char of base) {
      sum += Number(char) * weight
      weight -= 1
    }
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }

  const digit1 = calcDigit(cpf.slice(0, 9))
  const digit2 = calcDigit(cpf.slice(0, 9) + digit1)
  return cpf.slice(9) === `${digit1}${digit2}`
}

// ------------------------------------------------------------ telefone

/** Formata progressivamente: (00) 00000-0000. */
export const formatPhone = (value: string): string => {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export const isValidPhone = (value: string): boolean => {
  const digits = onlyDigits(value)
  return digits.length === 10 || digits.length === 11
}

/** Quebra o telefone formatado em DDI/DDD/número, no shape que o Pagar.me espera. */
export const splitPhone = (value: string): { countryCode: string; areaCode: string; number: string } => {
  const digits = onlyDigits(value)
  return { countryCode: '55', areaCode: digits.slice(0, 2), number: digits.slice(2) }
}

// ---------------------------------------------------------------- cartão

/** Formata em grupos de 4: 0000 0000 0000 0000. */
export const formatCardNumber = (value: string): string => {
  const digits = onlyDigits(value).slice(0, 19)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

/** Algoritmo de Luhn — validação básica de número de cartão (não confirma que a bandeira existe). */
export const isValidCardNumber = (value: string): boolean => {
  const digits = onlyDigits(value)
  if (digits.length < 12 || digits.length > 19) return false

  let sum = 0
  let shouldDouble = false
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i])
    if (shouldDouble) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    shouldDouble = !shouldDouble
  }
  return sum % 10 === 0
}

/** Formata MM/AA enquanto digita. */
export const formatCardExpiry = (value: string): string => {
  const digits = onlyDigits(value).slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

/** Valida mês 01–12 e ano/mês não no passado (comparado ao `now` injetado). */
export const isValidCardExpiry = (value: string, now: Date = new Date()): boolean => {
  const digits = onlyDigits(value)
  if (digits.length !== 4) return false
  const month = Number(digits.slice(0, 2))
  const year = 2000 + Number(digits.slice(2, 4))
  if (month < 1 || month > 12) return false

  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  if (year < currentYear) return false
  if (year === currentYear && month < currentMonth) return false
  return true
}

export const cardExpiryParts = (value: string): { expMonth: string; expYear: string } => {
  const digits = onlyDigits(value)
  return { expMonth: digits.slice(0, 2), expYear: digits.slice(2, 4) }
}

export const isValidCvv = (value: string): boolean => {
  const digits = onlyDigits(value)
  return digits.length >= 3 && digits.length <= 4
}
