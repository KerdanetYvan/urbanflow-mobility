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
});
