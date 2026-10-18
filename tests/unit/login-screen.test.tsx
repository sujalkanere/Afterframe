// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LoginScreen } from '../../src/client/screens/LoginScreen.js';

describe('LoginScreen Component & States (FR-064, Section 6.8.G)', () => {
  it('renders initial idle state with accessible form and Google OAuth button', () => {
    const onSignInSuccess = vi.fn();
    const onNavigateHome = vi.fn();
    const onNavigateTerms = vi.fn();
    const onNavigatePrivacy = vi.fn();
    const apiFetch = vi.fn();

    render(
      <LoginScreen
        onSignInSuccess={onSignInSuccess}
        onNavigateHome={onNavigateHome}
        onNavigateTerms={onNavigateTerms}
        onNavigatePrivacy={onNavigatePrivacy}
        apiFetch={apiFetch}
      />
    );

    // Heading and description
    expect(screen.getByRole('heading', { name: /Sign in to Afterframe/i })).toBeInTheDocument();

    // Accessible email input
    const input = screen.getByLabelText(/Email address/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'email');

    // Google OAuth button
    const googleBtn = screen.getByRole('button', { name: /Continue with Google/i });
    expect(googleBtn).toBeInTheDocument();

    // Send magic link primary button
    const sendBtn = screen.getByRole('button', { name: /Send magic link/i });
    expect(sendBtn).toBeInTheDocument();

    // Legal disclaimer
    expect(screen.getByText(/We only store your email/i)).toBeInTheDocument();
  });

  it('validates empty and invalid email before making an API call', async () => {
    const apiFetch = vi.fn();

    render(
      <LoginScreen
        onSignInSuccess={vi.fn()}
        onNavigateHome={vi.fn()}
        onNavigateTerms={vi.fn()}
        onNavigatePrivacy={vi.fn()}
        apiFetch={apiFetch}
      />
    );

    const sendBtn = screen.getByRole('button', { name: /Send magic link/i });

    // Submit empty
    fireEvent.click(sendBtn);
    expect(screen.getByText(/Please enter your email address/i)).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();

    // Submit invalid email
    const input = screen.getByLabelText(/Email address/i);
    fireEvent.change(input, { target: { value: 'invalid-email-address' } });
    fireEvent.click(sendBtn);

    expect(screen.getByText(/Enter a valid email address/i)).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('submits valid email and transitions to sent confirmation state with resend cooldown', async () => {
    const apiFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: 'usr_test', email: 'researcher@afterframe.app' },
        sessionToken: 'af_sess_12345678901234567890',
      }),
    });

    render(
      <LoginScreen
        onSignInSuccess={vi.fn()}
        onNavigateHome={vi.fn()}
        onNavigateTerms={vi.fn()}
        onNavigatePrivacy={vi.fn()}
        apiFetch={apiFetch}
      />
    );

    const input = screen.getByLabelText(/Email address/i);
    fireEvent.change(input, { target: { value: 'researcher@afterframe.app' } });

    const sendBtn = screen.getByRole('button', { name: /Send magic link/i });
    fireEvent.click(sendBtn);

    // Check that apiFetch was called with correct payload
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/auth/signin', {
        method: 'POST',
        body: JSON.stringify({ email: 'researcher@afterframe.app' }),
      });
    });

    // Check transition to sent state
    expect(await screen.findByRole('heading', { name: /Check your inbox/i })).toBeInTheDocument();
    expect(screen.getByText('researcher@afterframe.app')).toBeInTheDocument();

    // Resend button is initially in cooldown
    const resendBtn = screen.getByRole('button', { name: /Resend in \d+s/i });
    expect(resendBtn).toBeDisabled();

    // "Use a different email" allows returning to idle state
    const changeEmailBtn = screen.getByRole('button', { name: /Use a different email/i });
    fireEvent.click(changeEmailBtn);

    expect(screen.getByRole('heading', { name: /Sign in to Afterframe/i })).toBeInTheDocument();
  });

  it('handles server error response gracefully and displays message', async () => {
    const apiFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'AUTH_FAILED',
        message: 'Account suspended for policy violations.',
      }),
    });

    render(
      <LoginScreen
        onSignInSuccess={vi.fn()}
        onNavigateHome={vi.fn()}
        onNavigateTerms={vi.fn()}
        onNavigatePrivacy={vi.fn()}
        apiFetch={apiFetch}
      />
    );

    const input = screen.getByLabelText(/Email address/i);
    fireEvent.change(input, { target: { value: 'bad@afterframe.app' } });

    const sendBtn = screen.getByRole('button', { name: /Send magic link/i });
    fireEvent.click(sendBtn);

    expect(
      await screen.findByText(/Account suspended for policy violations/i)
    ).toBeInTheDocument();
  });

  it('renders expired link state when initial state is expired', () => {
    render(
      <LoginScreen
        initialState="expired"
        onSignInSuccess={vi.fn()}
        onNavigateHome={vi.fn()}
        onNavigateTerms={vi.fn()}
        onNavigatePrivacy={vi.fn()}
        apiFetch={vi.fn()}
      />
    );

    expect(
      screen.getByRole('heading', { name: /Sign-in link expired/i })
    ).toBeInTheDocument();

    const requestNewBtn = screen.getByRole('button', { name: /Request a new link/i });
    fireEvent.click(requestNewBtn);

    // Transitions back to idle state
    expect(screen.getByRole('heading', { name: /Sign in to Afterframe/i })).toBeInTheDocument();
  });
});
