/** Mensagem de erro inline sob um campo — compartilhada por CardPaymentForm/CustomerFields. */
export default function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="mt-1 text-xs font-semibold text-error">
      {message}
    </p>
  )
}
