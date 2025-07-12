import { render, screen } from '@testing-library/react'
import { HeroSection } from '../../components/hero-section'

describe('HeroSection', () => {
  it('renders the hero section with correct content', () => {
    render(<HeroSection />)
    
    // Check for main heading
    expect(screen.getByText(/AI Agent Orchestrator/i)).toBeInTheDocument()
    
    // Check for subtitle
    expect(screen.getByText(/Ultra-Fast AI Agent Management/i)).toBeInTheDocument()
    
    // Check for description
    expect(screen.getByText(/50x faster responses/i)).toBeInTheDocument()
    
    // Check for CTA button
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument()
  })

  it('has correct accessibility attributes', () => {
    render(<HeroSection />)
    
    // Check for proper heading structure
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()
    
    // Check for button accessibility
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('type', 'button')
  })

  it('displays performance metrics', () => {
    render(<HeroSection />)
    
    // Check for performance stats
    expect(screen.getByText(/50x faster/i)).toBeInTheDocument()
    expect(screen.getByText(/50x cheaper/i)).toBeInTheDocument()
  })
}) 