import { render, screen } from '@testing-library/react';
import LineBadge from './LineBadge';

describe('LineBadge', () => {
  it('affiche le libelle transmis', () => {
    render(<LineBadge mode="BUS" label="24" />);
    expect(screen.getByText('24')).toBeInTheDocument();
  });

  it.each([
    ['BUS', 'line-badge--bus'],
    ['TRAM', 'line-badge--tram'],
    ['SUBWAY', 'line-badge--metro'],
    ['RAIL', 'line-badge--train'],
  ])('applique la classe de forme correspondant au mode %s', (mode, expectedClass) => {
    render(<LineBadge mode={mode} label="X" />);
    expect(screen.getByText('X')).toHaveClass(expectedClass);
  });

  it('retombe sur la forme bus pour un mode de ligne non repertorie', () => {
    render(<LineBadge mode="FERRY" label="X" />);
    expect(screen.getByText('X')).toHaveClass('line-badge--bus');
  });

  it('applique un style de fond plein quand color et textColor sont fournis', () => {
    render(<LineBadge mode="BUS" label="C1" color="#95C11E" textColor="#1A171B" />);
    expect(screen.getByText('C1')).toHaveStyle({
      background: '#95C11E',
      color: '#1A171B',
      borderColor: '#95C11E',
    });
  });

  it('ne applique aucun style inline sans color/textColor (repli neutre)', () => {
    render(<LineBadge mode="BUS" label="24" />);
    expect(screen.getByText('24')).not.toHaveAttribute('style');
  });

  it('ne applique aucun style inline si un seul des deux (color/textColor) est fourni', () => {
    render(<LineBadge mode="BUS" label="24" color="#95C11E" />);
    expect(screen.getByText('24')).not.toHaveAttribute('style');
  });
});
