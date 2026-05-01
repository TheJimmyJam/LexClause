import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,           setUser]          = useState(null)
  const [profile,        setProfile]       = useState(null)
  const [isSuperAdmin,   setIsSuperAdmin]  = useState(false)
  const [loading,        setLoading]       = useState(true)

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('lc_profiles')
      .select('*, organization:lc_organizations(*)')
      .eq('id', userId)
      .single()
    setProfile(data)
    return data
  }

  async function fetchSuperAdmin(userId) {
    // RLS lets super admins SELECT lc_super_admins; non-super-admins get 0 rows.
    const { data } = await supabase
      .from('lc_super_admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
    const flag = !!data
    setIsSuperAdmin(flag)
    return flag
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchProfile(session.user.id)
        await fetchSuperAdmin(session.user.id)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
        fetchSuperAdmin(session.user.id)
      } else {
        setProfile(null)
        setIsSuperAdmin(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{
      user, profile, isSuperAdmin, loading, signOut,
      refetchProfile: () => fetchProfile(user?.id),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
