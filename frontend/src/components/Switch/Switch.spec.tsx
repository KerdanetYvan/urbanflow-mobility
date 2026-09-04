import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Switch from './Switch';

describe('Switch', () => {
  it('rend un role="switch" reflétant aria-checked', () => {
    render(
      <Switch
        checked={false}
        onChange={() => {}}
        ariaLabel="Basculer"
        iconOff={<span>off</span>}
        iconOn={<span>on</span>}
      />,
    );

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('checked=true reflete aria-checked="true"', () => {
    render(
      <Switch
        checked
        onChange={() => {}}
        ariaLabel="Basculer"
        iconOff={<span>off</span>}
        iconOn={<span>on</span>}
      />,
    );

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('appelle onChange au clic (composant purement controle, ne change pas seul)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Switch
        checked={false}
        onChange={onChange}
        ariaLabel="Basculer"
        iconOff={<span>off</span>}
        iconOn={<span>on</span>}
      />,
    );

    await user.click(screen.getByRole('switch'));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('appelle onChange au clavier (Espace, comportement natif du <button>)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Switch
        checked={false}
        onChange={onChange}
        ariaLabel="Basculer"
        iconOff={<span>off</span>}
        iconOn={<span>on</span>}
      />,
    );

    await user.tab();
    expect(screen.getByRole('switch')).toHaveFocus();
    await user.keyboard(' ');

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('expose le libelle ARIA fourni', () => {
    render(
      <Switch
        checked={false}
        onChange={() => {}}
        ariaLabel="Thème clair activé, basculer vers le thème sombre"
        iconOff={<span>off</span>}
        iconOn={<span>on</span>}
      />,
    );

    expect(
      screen.getByRole('switch', {
        name: 'Thème clair activé, basculer vers le thème sombre',
      }),
    ).toBeInTheDocument();
  });
});
