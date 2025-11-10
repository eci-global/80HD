/**
 * Authentication utilities for Supabase Auth.
 * Provides helper functions for session management and user context.
 */

import { createServerClient } from './supabase-server';
import { createClient } from './supabase';
import type { User } from '@supabase/supabase-js';

/**
 * Gets the current authenticated user from server-side context.
 * Returns null if not authenticated.
 */
export async function getServerUser(): Promise<User | null> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error('Error getting server user:', error.message);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error in getServerUser:', error);
    return null;
  }
}

/**
 * Gets the current authenticated user from client-side context.
 * Returns null if not authenticated.
 */
export async function getClientUser(): Promise<User | null> {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error('Error getting client user:', error.message);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error in getClientUser:', error);
    return null;
  }
}

/**
 * Gets the current session from server-side context.
 * Returns null if no active session.
 */
export async function getServerSession() {
  try {
    const supabase = await createServerClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error('Error getting server session:', error.message);
      return null;
    }

    return session;
  } catch (error) {
    console.error('Error in getServerSession:', error);
    return null;
  }
}

/**
 * Signs out the current user.
 * Works in both client and server contexts.
 */
export async function signOut(): Promise<{ error: Error | null }> {
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { error };
    }

    return { error: null };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error('Unknown error during sign out'),
    };
  }
}

