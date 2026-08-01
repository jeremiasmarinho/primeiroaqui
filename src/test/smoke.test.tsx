import { render, screen } from '@testing-library/react'
import MarketplaceApp from '../MarketplaceApp'

describe('MarketplaceApp smoke', () => {
  it('renderiza sem crash e mostra marca', () => {
    render(<MarketplaceApp />)
    expect(screen.getAllByText(/primeiro aqui/i)[0]).toBeInTheDocument()
  })
})