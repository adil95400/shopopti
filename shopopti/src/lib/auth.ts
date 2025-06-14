import { supabase } from './supabase'

export async function signInWithEmail(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email })
  if (error) throw error
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getUser() {
  const { data } = await supabase.auth.getUser()
  return data.user
}
