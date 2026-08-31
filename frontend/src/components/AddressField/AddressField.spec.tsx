import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddressField, { type AddressQuickEntry } from './AddressField';
import type { PlaceSuggestion } from '../../lib/places';

/**
 * Tests du dropdown d'`AddressField` (issue #166, docs/specs/
 * fusion-autocomplete-raccourcis.md) : affichage des entrées rapides au focus
 * quand le champ est vide, bascule vers les suggestions du géocodeur, et
 * comportement inchangé quand aucune entrée rapide n'est fournie (ProfilPage).
 */

const GARE: PlaceSuggestion = { label: 'Gare Part-Dieu', lat: 45.76, lon: 4.86 };

/** Rend un `AddressField` piloté, avec un bouton voisin pour tester la perte de focus. */
function renderField(props: Partial<Parameters<typeof AddressField>[0]> = {}) {
  const onChange = vi.fn();
  const onSelect = vi.fn();
  const utils = render(
    <>
      <AddressField
        id="origin-address"
        label="Origine"
        value=""
        suggestions={[]}
        onChange={onChange}
        onSelect={onSelect}
        {...props}
      />
      <button type="button">Ailleurs</button>
    </>,
  );
  return { ...utils, onChange, onSelect };
}

const QUICK_ENTRIES: AddressQuickEntry[] = [
  {
    key: 'current-position',
    title: 'Ma position actuelle',
    subtitle: 'Votre position GPS',
    icon: 'pin',
    onSelect: vi.fn(),
  },
  {
    key: 'home',
    title: 'Domicile',
    subtitle: '8 place du Marché',
    icon: 'pin',
    onSelect: vi.fn(),
  },
];

describe('AddressField - entrées rapides', () => {
  it("n'affiche rien au focus quand aucune entrée rapide n'est fournie (cas ProfilPage)", async () => {
    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByLabelText('Origine'));

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('affiche les entrées rapides (titre + sous-titre) au focus quand le champ est vide', async () => {
    const user = userEvent.setup();
    renderField({ quickEntries: QUICK_ENTRIES });

    // Rien tant que le champ n'a pas le focus.
    expect(
      screen.queryByRole('button', { name: /Ma position actuelle/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Origine'));

    expect(
      screen.getByRole('button', { name: /Ma position actuelle/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('Votre position GPS')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Domicile/ }),
    ).toBeInTheDocument();
  });

  it('masque les entrées rapides dès qu\'un caractère est saisi (champ non vide)', async () => {
    const user = userEvent.setup();
    const { rerender } = renderField({ quickEntries: QUICK_ENTRIES, value: '' });

    await user.click(screen.getByLabelText('Origine'));
    expect(
      screen.getByRole('button', { name: /Domicile/ }),
    ).toBeInTheDocument();

    // Le parent remonte la nouvelle valeur : le champ n'est plus vide.
    rerender(
      <>
        <AddressField
          id="origin-address"
          label="Origine"
          value="R"
          suggestions={[]}
          onChange={vi.fn()}
          onSelect={vi.fn()}
          quickEntries={QUICK_ENTRIES}
        />
        <button type="button">Ailleurs</button>
      </>,
    );

    expect(
      screen.queryByRole('button', { name: /Domicile/ }),
    ).not.toBeInTheDocument();
  });

  it('affiche les suggestions du géocodeur plutôt que les entrées rapides quand il y en a', async () => {
    const user = userEvent.setup();
    renderField({ quickEntries: QUICK_ENTRIES, suggestions: [GARE] });

    await user.click(screen.getByLabelText('Origine'));

    expect(
      screen.getByRole('button', { name: 'Gare Part-Dieu' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Ma position actuelle/ }),
    ).not.toBeInTheDocument();
  });

  it('distingue visuellement un arrêt (kind stop) d\'une adresse (kind address) par une classe d\'icône (issue #168)', async () => {
    const user = userEvent.setup();
    renderField({
      quickEntries: QUICK_ENTRIES,
      suggestions: [
        { label: 'République', lat: 48.1, lon: -1.6, kind: 'stop' },
        { label: '12 Rue de Nemours, Rennes', lat: 48.1, lon: -1.7, kind: 'address' },
      ],
    });

    await user.click(screen.getByLabelText('Origine'));

    const stopBtn = screen.getByRole('button', { name: 'République' });
    const addrBtn = screen.getByRole('button', {
      name: '12 Rue de Nemours, Rennes',
    });
    // Les deux ont une icône (aria-hidden, donc pas dans le nom accessible),
    // le libellé reste du texte propre sans suffixe.
    expect(stopBtn.querySelector('.address-suggestion-icon')).toBeInTheDocument();
    expect(addrBtn.querySelector('.address-suggestion-icon')).toBeInTheDocument();
  });

  it("appelle le onSelect de l'entrée cliquée", async () => {
    const user = userEvent.setup();
    const onEntrySelect = vi.fn();
    renderField({
      quickEntries: [
        {
          key: 'home',
          title: 'Domicile',
          subtitle: '8 place du Marché',
          icon: 'pin',
          onSelect: onEntrySelect,
        },
      ],
    });

    await user.click(screen.getByLabelText('Origine'));
    await user.click(screen.getByRole('button', { name: /Domicile/ }));

    expect(onEntrySelect).toHaveBeenCalledTimes(1);
  });

  it('désactive une entrée marquée disabled (position GPS en cours d\'acquisition)', async () => {
    const user = userEvent.setup();
    renderField({
      quickEntries: [
        {
          key: 'current-position',
          title: 'Ma position actuelle',
          subtitle: 'Localisation…',
          icon: 'pin',
          disabled: true,
          onSelect: vi.fn(),
        },
      ],
    });

    await user.click(screen.getByLabelText('Origine'));

    expect(
      screen.getByRole('button', { name: /Ma position actuelle/ }),
    ).toBeDisabled();
  });

  it('referme le dropdown à Échap et au retour du focus dans le champ', async () => {
    const user = userEvent.setup();
    renderField({ quickEntries: QUICK_ENTRIES });

    const input = screen.getByLabelText('Origine');
    await user.click(input);
    expect(
      screen.getByRole('button', { name: /Domicile/ }),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(
      screen.queryByRole('button', { name: /Domicile/ }),
    ).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it('referme le dropdown quand le focus quitte le champ', async () => {
    const user = userEvent.setup();
    renderField({ quickEntries: QUICK_ENTRIES });

    await user.click(screen.getByLabelText('Origine'));
    expect(
      screen.getByRole('button', { name: /Domicile/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ailleurs' }));

    expect(
      screen.queryByRole('button', { name: /Domicile/ }),
    ).not.toBeInTheDocument();
  });
});
