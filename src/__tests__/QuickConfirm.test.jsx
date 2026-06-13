import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QuickConfirm } from '@/components/modals/QuickConfirm';

const mockDose = {
  id:      'dose1',
  med_id:  'med1',
  nome:    'Aspirina',
  dosagem: '100mg',
  unidade: 'comprimido',
  hora:    '08:00',
  status:  'pending',
  cor:     '#ef4444',
};

const mockT = {
  bg1: '#161b22', bg3: '#21262d',
  txt: '#f0f4f8', sub: '#8b949e', muted: '#6e7681',
  bdr: '#30363d',
};

const defaultProps = {
  dose:      mockDose,
  onConfirm: jest.fn(),
  onSnooze:  jest.fn(),
  onClose:   jest.fn(),
  T:         mockT,
};

describe('QuickConfirm Modal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders medication name and hora', () => {
    render(<QuickConfirm {...defaultProps} />);
    expect(screen.getByText('Aspirina')).toBeInTheDocument();
    expect(screen.getByText(/08:00/)).toBeInTheDocument();
    expect(screen.getByText(/100mg/)).toBeInTheDocument();
  });

  it('calls onConfirm when "Já tomei" is clicked', async () => {
    render(<QuickConfirm {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /Já tomei/i });
    fireEvent.click(btn);
    await waitFor(() => expect(defaultProps.onConfirm).toHaveBeenCalledWith(mockDose), { timeout: 1500 });
  });

  it('calls onSnooze and onClose when snooze button clicked', () => {
    render(<QuickConfirm {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /Lembrar em 15 minutos/i });
    fireEvent.click(btn);
    expect(defaultProps.onSnooze).toHaveBeenCalledWith(mockDose);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    const { container } = render(<QuickConfirm {...defaultProps} />);
    const backdrop = container.firstChild;
    fireEvent.click(backdrop);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows success state after confirmation', async () => {
    render(<QuickConfirm {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Já tomei/i }));
    await waitFor(() => expect(screen.getByText(/Dose confirmada!/i)).toBeInTheDocument(), { timeout: 1500 });
  });

  it('has accessible role and aria attributes', () => {
    render(<QuickConfirm {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });
});
