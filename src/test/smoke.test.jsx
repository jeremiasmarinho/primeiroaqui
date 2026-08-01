import { render, screen } from '@testing-library/react'
import MarketplaceApp from '../MarketplaceApp'

describe('MarketplaceApp smoke', () => {
  it('renderiza sem crash e mostra marca', () => {
    render(<MarketplaceApp />)
    expect(screen.getByText(/primeiro aqui/i)).toBeInTheDocument()
  })
})