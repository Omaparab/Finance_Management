import { useCallback, useEffect, useState } from 'react'
import './App.css'
import './styles/overview.css'
import './styles/profileSelection.css'
import './styles/transactions.css'
import './styles/budgets.css'
import './styles/accounts.css'
import './styles/savingsGoals.css'
import './styles/investments.css'
import './styles/reports.css'
import './styles/hoverEffects.css'
import { Sidebar } from './pages/Sidebar'
import { ProfileSelection } from './pages/ProfileSelection'
import { Overview } from './pages/Overview'
import { Transactions } from './pages/Transactions'
import { Budgets } from './pages/Budgets'
import { Accounts } from './pages/Accounts'
import { SavingsGoals } from './pages/SavingsGoals'
import { Investments } from './pages/Investments'
import { Reports } from './pages/Reports'
import { overviewService } from './services/overviewService'
import { profileService } from './services/profileService'
import type { UserProfileInput } from './services/profileService'
import type { OverviewData } from './services/overviewService'
import type { UserProfile } from './models'

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    const status = 'status' in error && typeof error.status === 'number' ? ` (HTTP ${error.status})` : ''
    return `${error.message}${status}`
  }
  return typeof error === 'string' ? error : JSON.stringify(error) || 'An unexpected error occurred while loading Dataverse data.'
}

function App() {
  const [page, setPage] = useState<'overview' | 'transactions' | 'budgets' | 'accounts' | 'savings' | 'investments' | 'reports'>('overview')
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [recentProfileIds, setRecentProfileIds] = useState<string[]>([])
  const [profilesLoaded, setProfilesLoaded] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null)
  const [data, setData] = useState<OverviewData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectingProfileId, setSelectingProfileId] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [profileLoadKey, setProfileLoadKey] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    let active = true
    profileService.listProfiles().then((result) => {
      if (!active) return
      setProfiles(result)
      setError('')
    }).catch((loadError: unknown) => {
      if (active) setError(errorMessage(loadError))
    }).finally(() => {
      if (active) {
        setProfilesLoaded(true)
        setLoading(false)
      }
    })
    return () => { active = false }
  }, [reloadKey])

  useEffect(() => {
    if (!selectedProfile) return
    let active = true
    overviewService.load(selectedProfile).then((result) => {
      if (active) {
        setData(result)
        setError('')
      }
    }).catch((loadError: unknown) => {
      if (active) {
        setData(null)
        setError(errorMessage(loadError))
      }
    }).finally(() => {
      if (active) setSelectingProfileId('')
    })
    return () => { active = false }
  }, [selectedProfile, profileLoadKey])

  const retry = useCallback(() => {
    setError('')
    if (selectedProfile) {
      setData(null)
      setSelectingProfileId(selectedProfile.oma_userprofileid ?? '')
      setProfileLoadKey((key) => key + 1)
      return
    }
    setLoading(true)
    setProfilesLoaded(false)
    setReloadKey((key) => key + 1)
  }, [selectedProfile])

  const selectProfile = useCallback((profile: UserProfile) => {
    const profileId = profile.oma_userprofileid
    if (profileId) {
      setRecentProfileIds((current) => [
        profileId,
        ...current.filter((id) => id !== profileId),
      ].slice(0, 20))
    }
    setData(null)
    setError('')
    setSelectingProfileId(profile.oma_userprofileid ?? '')
    setSelectedProfile(profile)
  }, [])

  const saveProfile = useCallback(async (profile: UserProfile | null, input: UserProfileInput) => {
    if (profile?.oma_userprofileid) {
      await profileService.updateProfile(profile.oma_userprofileid, input)
    } else {
      await profileService.createProfile(input)
    }
    setError('')
    setReloadKey((key) => key + 1)
  }, [])

  const deleteProfile = useCallback(async (profile: UserProfile) => {
    if (!profile.oma_userprofileid) throw new Error('The selected User Profile is missing its Dataverse ID.')
    await profileService.deleteProfile(profile.oma_userprofileid)
    setError('')
    setReloadKey((key) => key + 1)
  }, [])

  const changeProfile = useCallback(() => {
    setData(null)
    setError('')
    setPage('overview')
    setSelectedProfile(null)
    setSelectingProfileId('')
    setLoading(false)
  }, [])

  const profileName = data?.profile.oma_fullname?.trim() || data?.profile.oma_profilename?.trim() || 'User profile'

  return (
    <div className="app-shell">
      {data ? (
        <>
          <Sidebar profileName={profileName} page={page} onNavigate={setPage} open={sidebarOpen} onClose={() => setSidebarOpen(false)} onChangeProfile={changeProfile} />
          <div className="main-column">
            <header className="topbar">
              <div className="topbar-leading">
                <button className="mobile-menu-button" type="button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <div className="breadcrumb"><span>Finance</span><span aria-hidden="true">›</span><strong>{page === 'overview' ? 'Overview' : page === 'transactions' ? 'Transactions' : page === 'budgets' ? 'Budgets' : page === 'accounts' ? 'Accounts' : page === 'savings' ? 'Savings goals' : page === 'investments' ? 'Investments' : 'Reports'}</strong></div>
              </div>
              <span className="connection-status"><i /> Dataverse</span>
            </header>
            <main className="main-content">
              {page === 'overview'
                ? <Overview data={data} onRefresh={retry} />
                : page === 'transactions'
                  ? <Transactions profileId={data.profile.oma_userprofileid ?? ''} profiles={profiles} />
                  : page === 'budgets'
                    ? <Budgets profileId={data.profile.oma_userprofileid ?? ''} />
                    : page === 'accounts'
                      ? <Accounts profileId={data.profile.oma_userprofileid ?? ''} />
                      : page === 'savings'
                        ? <SavingsGoals profileId={data.profile.oma_userprofileid ?? ''} />
                        : page === 'investments'
                          ? <Investments profileId={data.profile.oma_userprofileid ?? ''} />
                          : <Reports profileId={data.profile.oma_userprofileid ?? ''} />}
            </main>
          </div>
        </>
      ) : loading || !profilesLoaded ? (
        <section className="page-state" aria-live="polite">
          <span className="spinner" />
          <h1>Loading your finance profiles</h1>
          <p>Finding profiles associated with your signed-in Dataverse user.</p>
        </section>
      ) : selectedProfile && error ? (
        <section className="page-state error-state" role="alert">
          <span className="state-mark">!</span>
          <h1>We couldn’t load this finance profile</h1>
          <p>{error}</p>
          <button className="button-primary" onClick={changeProfile}>Choose another profile</button>
        </section>
      ) : error && !profiles.length ? (
        <section className="page-state error-state" role="alert">
          <span className="state-mark">!</span>
          <h1>We couldn’t load your profiles</h1>
          <p>{error}</p>
          <button className="button-primary" onClick={retry}>Retry</button>
        </section>
      ) : (
        <ProfileSelection
          profiles={profiles}
          recentProfileIds={recentProfileIds}
          onSelect={selectProfile}
          onSaveProfile={saveProfile}
          onDeleteProfile={deleteProfile}
          selectingProfileId={selectingProfileId}
          error={error}
        />
      )}
    </div>
  )
}

export default App
