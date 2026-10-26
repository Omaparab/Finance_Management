import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { UserProfile } from '../models'
import type { UserProfileInput } from '../services/profileService'

interface ProfileSelectionProps {
  profiles: UserProfile[]
  recentProfileIds: string[]
  onSelect: (profile: UserProfile) => void
  onSaveProfile: (profile: UserProfile | null, input: UserProfileInput) => Promise<void>
  onDeleteProfile: (profile: UserProfile) => Promise<void>
  selectingProfileId: string
  error: string
}

function getProfileName(profile: UserProfile) {
  return profile.oma_fullname?.trim() || profile.oma_profilename?.trim() || 'Unnamed profile'
}

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'P'
}

const referencedTables = [
  'Financial Accounts',
  'Categories',
  'Transactions',
  'Budgets',
  'Savings Goals',
  'Savings Contributions',
  'Investments',
  'Investment Transactions',
]

const profilesPerPage = 10

export function ProfileSelection({
  profiles,
  recentProfileIds,
  onSelect,
  onSaveProfile,
  onDeleteProfile,
  selectingProfileId,
  error,
}: ProfileSelectionProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [openMenuProfileId, setOpenMenuProfileId] = useState('')
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [fullName, setFullName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deletingProfile, setDeletingProfile] = useState<UserProfile | null>(null)
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    if (!query) return profiles
    return profiles.filter((profile) => (
      `${profile.oma_fullname ?? ''} ${profile.oma_profilename ?? ''}`.toLocaleLowerCase().includes(query)
    ))
  }, [profiles, search])

  const orderedProfiles = useMemo(() => {
    const recentRank = new Map(recentProfileIds.map((id, index) => [id, index]))
    return [...filteredProfiles].sort((first, second) => {
      const firstRank = recentRank.get(first.oma_userprofileid ?? '')
      const secondRank = recentRank.get(second.oma_userprofileid ?? '')
      if (firstRank === undefined) return secondRank === undefined ? 0 : 1
      if (secondRank === undefined) return -1
      return firstRank - secondRank
    })
  }, [filteredProfiles, recentProfileIds])

  const pageCount = Math.max(1, Math.ceil(orderedProfiles.length / profilesPerPage))
  const currentPage = Math.min(page, pageCount)
  const visibleProfiles = orderedProfiles.slice(
    (currentPage - 1) * profilesPerPage,
    currentPage * profilesPerPage,
  )

  function openProfile(profile: UserProfile) {
    onSelect(profile)
  }

  function updateSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function openEditor(profile: UserProfile | null) {
    setEditingProfile(profile)
    setProfileName(profile?.oma_profilename?.trim() ?? '')
    setFullName(profile?.oma_fullname?.trim() ?? '')
    setSaveError('')
    setEditorOpen(true)
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      await onSaveProfile(editingProfile, {
        oma_profilename: profileName.trim(),
        oma_fullname: fullName.trim() || null,
      })
      setEditorOpen(false)
    } catch (operationError) {
      setSaveError(operationError instanceof Error ? operationError.message : 'The profile could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteProfile() {
    if (!deletingProfile) return
    setDeleting(true)
    setDeleteError('')
    try {
      await onDeleteProfile(deletingProfile)
      setDeletingProfile(null)
      setDeleteAcknowledged(false)
    } catch (operationError) {
      setDeleteError(operationError instanceof Error ? operationError.message : 'The profile could not be deleted.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="profile-selection">
      <span className="profile-selection-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
      </span>
      <p className="eyebrow">YOUR FINANCE WORKSPACE</p>
      <h1>Choose a profile</h1>
      <p className="profile-selection-intro">Select a profile to continue, or manage profiles for your finance workspace.</p>
      {error && <p className="profile-selection-error" role="alert">{error}</p>}
      <section className="profile-picker" aria-label="Finance profile management">
        <div className="profile-picker-heading">
          <div><h2>Your profiles</h2><p>{profiles.length} {profiles.length === 1 ? 'profile' : 'profiles'} available</p></div>
          <button className="button-primary profile-add-button" type="button" disabled={Boolean(selectingProfileId)} onClick={() => openEditor(null)}>Add profile</button>
        </div>
        {profiles.length > 0 && <>
          <label className="profile-search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
            <input
              type="search"
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Search profiles by name"
              aria-label="Search profiles by name"
            />
            {search && <button type="button" className="clear-search" onClick={() => updateSearch('')} aria-label="Clear profile search">×</button>}
          </label>
          <div className="profile-picker-heading profile-results-heading">
            <p>{filteredProfiles.length} matching {filteredProfiles.length === 1 ? 'profile' : 'profiles'} · {filteredProfiles.length ? `showing ${(currentPage - 1) * profilesPerPage + 1}–${Math.min(currentPage * profilesPerPage, filteredProfiles.length)}` : 'showing 0'}</p>
          </div>
        </>}
        {orderedProfiles.length ? <>
          <div className="profile-options">
          {visibleProfiles.map((profile) => {
            const name = getProfileName(profile)
            const id = profile.oma_userprofileid ?? ''
            const selecting = selectingProfileId === id
            const recentlyOpened = recentProfileIds.includes(id)
            return (
              <article
                className={`profile-option${recentlyOpened ? ' profile-option-recent' : ''}${openMenuProfileId === id ? ' profile-option-menu-open' : ''}`}
                key={id}
                onBlur={(event) => {
                  if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
                    setOpenMenuProfileId('')
                  }
                }}
              >
                <button
                  className="profile-option-main"
                  type="button"
                  disabled={Boolean(selectingProfileId)}
                  onClick={() => openProfile(profile)}
                >
                  <span className="profile-option-avatar">{getInitials(name)}</span>
                  <span className="profile-option-copy">
                    <strong>{name}</strong>
                    <small>{profile.oma_profilename?.trim() || 'Dataverse finance profile'}</small>
                    {recentlyOpened && <span className="profile-recent-badge">Recently opened</span>}
                  </span>
                  <span className="profile-option-action">{selecting ? 'Opening…' : 'Open'}</span>
                </button>
                <div className="profile-option-menu">
                  <button
                    type="button"
                    className="profile-option-menu-trigger"
                    aria-label={`More actions for ${name}`}
                    aria-haspopup="menu"
                    aria-expanded={openMenuProfileId === id}
                    disabled={Boolean(selectingProfileId)}
                    onClick={() => setOpenMenuProfileId((current) => current === id ? '' : id)}
                  >
                    <span aria-hidden="true">⋮</span>
                  </button>
                  {openMenuProfileId === id && <div className="profile-option-menu-popup" role="menu" aria-label={`${name} actions`}>
                    <button type="button" role="menuitem" onClick={() => { setOpenMenuProfileId(''); openEditor(profile) }}>Edit profile</button>
                    <button type="button" role="menuitem" className="profile-delete-action" onClick={() => {
                      setOpenMenuProfileId('')
                      setDeletingProfile(profile)
                      setDeleteError('')
                      setDeleteAcknowledged(false)
                    }}>Delete profile</button>
                  </div>}
                </div>
              </article>
            )
          })}
        </div>
        {pageCount > 1 && <nav className="profile-pagination" aria-label="Profile pages">
          <span>Page {currentPage} of {pageCount}</span>
          <div>
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
            <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button>
          </div>
        </nav>}
        </> : profiles.length ? (
          <p className="profile-no-results">No profiles match “{search.trim()}”. Try a different name.</p>
        ) : (
          <p className="profile-selection-empty">No profiles yet. Add a profile to get started.</p>
        )}
        {selectingProfileId && <span className="profile-selection-progress" aria-live="polite">Loading this profile’s finance data…</span>}
      </section>

      {editorOpen && <div className="profile-dialog-backdrop">
        <section className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-editor-title">
          <div className="profile-dialog-heading">
            <div><p className="eyebrow">FINANCE WORKSPACE</p><h2 id="profile-editor-title">{editingProfile ? 'Edit profile' : 'Add profile'}</h2></div>
            <button className="profile-dialog-close" type="button" aria-label="Close" disabled={saving} onClick={() => setEditorOpen(false)}>×</button>
          </div>
          <form className="profile-editor-form" onSubmit={saveProfile}>
            <label>Profile name
              <input value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={100} required autoFocus />
            </label>
            <label>Full name <span>Optional</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={150} />
            </label>
            {saveError && <p className="profile-operation-error" role="alert">{saveError}</p>}
            <div className="profile-dialog-actions">
              <button className="button-secondary" type="button" disabled={saving} onClick={() => setEditorOpen(false)}>Cancel</button>
              <button className="button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : editingProfile ? 'Save changes' : 'Create profile'}</button>
            </div>
          </form>
        </section>
      </div>}

      {deletingProfile && <div className="profile-dialog-backdrop">
        <section className="profile-dialog profile-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="profile-delete-title" aria-describedby="profile-delete-warning">
          <div className="profile-dialog-heading">
            <div><p className="eyebrow">DELETE PROFILE</p><h2 id="profile-delete-title">Delete {getProfileName(deletingProfile)}?</h2></div>
            <button className="profile-dialog-close" type="button" aria-label="Close" disabled={deleting} onClick={() => setDeletingProfile(null)}>×</button>
          </div>
          <div className="profile-delete-warning" id="profile-delete-warning">
            <strong>Before deleting, remove this profile’s lookup from related records.</strong>
            <p>This app checks for linked records and will block deletion until the references are cleared. Check these tables:</p>
            <ul>{referencedTables.map((table) => <li key={table}>{table}</li>)}</ul>
            <p>Deleting a profile does not delete or reassign its related financial records.</p>
          </div>
          <label className="profile-delete-confirm">
            <input type="checkbox" checked={deleteAcknowledged} onChange={(event) => setDeleteAcknowledged(event.target.checked)} disabled={deleting} />
            <span>I understand the profile references must be removed before deletion.</span>
          </label>
          {deleteError && <p className="profile-operation-error" role="alert">{deleteError}</p>}
          <div className="profile-dialog-actions">
            <button className="button-secondary" type="button" disabled={deleting} onClick={() => setDeletingProfile(null)}>Cancel</button>
            <button className="button-danger" type="button" disabled={!deleteAcknowledged || deleting} onClick={deleteProfile}>{deleting ? 'Checking references…' : 'Delete profile'}</button>
          </div>
        </section>
      </div>}
    </main>
  )
}
