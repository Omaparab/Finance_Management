import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { FinancialAccount } from '../models'
import { accountsService } from '../services/accountsService'
import type { AccountInput, AccountsPageData } from '../services/accountsService'

interface AccountsProps {
  profileId: string
}

interface AccountFormValues {
  name: string
  type: string
  number: string
  balance: string
  institution: string
  isActive: boolean
}

const accountTypes = [
  { value: 1, label: 'Bank' },
  { value: 2, label: 'Credit card' },
  { value: 3, label: 'Wallet' },
  { value: 4, label: 'Cash' },
  { value: 5, label: 'Investment' },
]

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message
  return 'An unexpected error occurred while loading accounts.'
}

function formatAmount(value: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

function getAccountType(account: FinancialAccount) {
  return accountTypes.find((type) => type.value === account.oma_accounttype)?.label
    || 'Account'
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'A'
}

function maskedAccountNumber(value: string | undefined) {
  const accountNumber = value?.trim()
  if (!accountNumber) return 'No account number'
  if (accountNumber.length <= 4) return accountNumber
  return `•••• ${accountNumber.slice(-4)}`
}

function getFormValues(account: FinancialAccount | null): AccountFormValues {
  return {
    name: account?.oma_accountname ?? '',
    type: account?.oma_accounttype === undefined ? '' : String(account.oma_accounttype),
    number: account?.oma_accountnumber ?? '',
    balance: account?.oma_currentbalance === undefined ? '0' : String(account.oma_currentbalance),
    institution: account?.oma_institution ?? '',
    isActive: account?.oma_isactive ?? true,
  }
}

function toAccountInput(values: AccountFormValues, profileId: string): AccountInput {
  const name = values.name.trim()
  if (!name) throw new Error('Enter an account name.')
  if (name.length > 150) throw new Error('Account name must be 150 characters or fewer.')
  const type = Number(values.type)
  if (!accountTypes.some((accountType) => accountType.value === type)) throw new Error('Select an account type.')
  if (!values.balance.trim()) throw new Error('Enter the current balance.')
  const balance = Number(values.balance)
  if (!Number.isFinite(balance) || balance < 0 || balance > 922337203685477 || !/^\d+(\.\d{1,2})?$/.test(values.balance)) {
    throw new Error('Enter a balance of 0 or greater with no more than 2 decimal places.')
  }
  if (values.number.trim().length > 50) throw new Error('Account number must be 50 characters or fewer.')
  if (values.institution.trim().length > 150) throw new Error('Institution must be 150 characters or fewer.')
  const userProfileId = profileId.replace(/[{}]/g, '')
  if (!userProfileId) throw new Error('Select a finance profile before saving this account.')
  return {
    oma_accountname: name,
    oma_accounttype: type,
    oma_accountnumber: values.number.trim() || null,
    oma_currentbalance: balance,
    oma_institution: values.institution.trim() || null,
    oma_isactive: values.isActive,
    _oma_userprofile_value: userProfileId,
  }
}

function accountToInput(account: FinancialAccount, isActive: boolean, profileId: string): AccountInput {
  return {
    oma_accountname: account.oma_accountname || 'Financial account',
    oma_accounttype: account.oma_accounttype ?? 1,
    oma_accountnumber: account.oma_accountnumber ?? null,
    oma_currentbalance: account.oma_currentbalance ?? 0,
    oma_institution: account.oma_institution ?? null,
    oma_isactive: isActive,
    _oma_userprofile_value: profileId.replace(/[{}]/g, ''),
  }
}

export function Accounts({ profileId }: AccountsProps) {
  const [data, setData] = useState<AccountsPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [showInactive, setShowInactive] = useState(false)
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formValues, setFormValues] = useState<AccountFormValues>(() => getFormValues(null))
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingToggle, setPendingToggle] = useState<FinancialAccount | null>(null)
  const [toggleError, setToggleError] = useState('')
  const [toggling, setToggling] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    accountsService.list(profileId).then((result) => {
      if (!active) return
      setData(result)
      setError('')
    }).catch((loadError: unknown) => {
      if (!active) return
      setData(null)
      setError(errorMessage(loadError))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [profileId, reloadKey])

  const accounts = data?.accounts ?? []
  const activeAccounts = accounts.filter((account) => account.oma_isactive === true)
  const inactiveAccounts = accounts.filter((account) => account.oma_isactive !== true)
  const activeBalance = activeAccounts.reduce((sum, account) => sum + (account.oma_currentbalance ?? 0), 0)
  const visibleAccounts = showInactive ? accounts : activeAccounts

  function reload() {
    setLoading(true)
    setError('')
    setNotice('')
    setReloadKey((key) => key + 1)
  }

  function openForm(account: FinancialAccount | null) {
    setEditingAccount(account)
    setFormValues(getFormValues(account))
    setFormError('')
    setFormOpen(true)
  }

  function closeForm() {
    if (saving) return
    setFormOpen(false)
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    let input: AccountInput
    try {
      input = toAccountInput(formValues, profileId)
    } catch (validationError) {
      setFormError(errorMessage(validationError))
      return
    }
    setSaving(true)
    try {
      if (editingAccount?.oma_financialaccountid) {
        await accountsService.update(editingAccount.oma_financialaccountid, input)
      } else {
        await accountsService.create(input)
      }
      setFormOpen(false)
      setNotice(editingAccount ? 'Account updated.' : 'Account created.')
      setLoading(true)
      setReloadKey((key) => key + 1)
    } catch (saveError) {
      setFormError(errorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  async function toggleAccountStatus() {
    if (!pendingToggle?.oma_financialaccountid) return
    setToggling(true)
    setToggleError('')
    try {
      await accountsService.update(
        pendingToggle.oma_financialaccountid,
        accountToInput(pendingToggle, pendingToggle.oma_isactive !== true, profileId),
      )
      setNotice(pendingToggle.oma_isactive === true ? 'Account deactivated.' : 'Account activated.')
      setPendingToggle(null)
      setLoading(true)
      setReloadKey((key) => key + 1)
    } catch (operationError) {
      setToggleError(errorMessage(operationError))
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="accounts-page">
      <section className="accounts-page-heading">
        <div>
          <p className="eyebrow">YOUR MONEY, IN ONE PLACE</p>
          <h1>Accounts</h1>
          <p className="accounts-page-subtitle">Manage the accounts connected to your finance profile.</p>
        </div>
        <div className="accounts-heading-actions">
          <button className="button-secondary" type="button" onClick={reload} disabled={loading}>Refresh</button>
          <button className="button-primary" type="button" onClick={() => openForm(null)}>+ Add account</button>
        </div>
      </section>

      {notice && <p className="accounts-notice" role="status">{notice}</p>}

      {data && <section className="accounts-summary" aria-label="Account summary">
        <article><span>Active accounts</span><strong>{activeAccounts.length}</strong><small>{inactiveAccounts.length} inactive</small></article>
        <article><span>Combined balance</span><strong>{formatAmount(activeBalance)}</strong><small>Across active accounts</small></article>
        <article><span>Account types</span><strong>{new Set(activeAccounts.map((account) => account.oma_accounttype).filter((type) => type !== undefined)).size}</strong><small>In use by active accounts</small></article>
      </section>}

      <section className="accounts-list-panel" aria-label="Financial accounts">
        <header className="accounts-list-heading">
          <div><h2>Financial accounts</h2><p>{showInactive ? 'Active and inactive accounts' : 'Your active accounts'}</p></div>
          {inactiveAccounts.length > 0 && <button className="accounts-inactive-toggle" type="button" aria-pressed={showInactive} onClick={() => setShowInactive((show) => !show)}>{showInactive ? 'Hide inactive' : `Show inactive (${inactiveAccounts.length})`}</button>}
        </header>
        {loading ? (
          <div className="accounts-state" aria-live="polite"><span className="spinner" /><p>Loading accounts…</p></div>
        ) : error ? (
          <div className="accounts-state accounts-error" role="alert"><p>{error}</p><button className="button-primary" type="button" onClick={reload}>Try again</button></div>
        ) : visibleAccounts.length ? (
          <div className="account-record-list">{visibleAccounts.map((account) => {
            const isActive = account.oma_isactive === true
            return <article className={`account-record${isActive ? '' : ' account-record-inactive'}`} key={account.oma_financialaccountid}>
              <span className="account-avatar" aria-hidden="true">{getInitials(account.oma_accountname || '')}</span>
              <div className="account-record-details">
                <div className="account-record-heading">
                  <div><h3>{account.oma_accountname || 'Financial account'}</h3><span>{getAccountType(account)}{account.oma_institution ? ` · ${account.oma_institution}` : ''}</span></div>
                  <span className={`account-status${isActive ? ' account-status-active' : ' account-status-inactive'}`}><i />{isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="account-record-meta"><span>{maskedAccountNumber(account.oma_accountnumber)}</span><strong>{formatAmount(account.oma_currentbalance ?? 0)}</strong></div>
              </div>
              <div className="account-record-actions">
                <button type="button" onClick={() => openForm(account)}>Edit</button>
                <button type="button" className={isActive ? 'account-deactivate-action' : 'account-activate-action'} onClick={() => { setPendingToggle(account); setToggleError('') }}>{isActive ? 'Deactivate' : 'Activate'}</button>
              </div>
            </article>
          })}</div>
        ) : (
          <div className="accounts-empty-state">
            <span className="accounts-empty-icon" aria-hidden="true">▱</span>
            <h3>{showInactive ? 'No accounts yet' : 'No active accounts'}</h3>
            <p>{showInactive ? 'Add a financial account to start tracking your balances.' : 'Add an account or show inactive accounts to see your full list.'}</p>
            <button className="button-primary" type="button" onClick={() => openForm(null)}>Add account</button>
          </div>
        )}
      </section>

      {formOpen && <div className="account-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}>
        <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-dialog-title">
          <header className="account-dialog-heading">
            <div><p className="eyebrow">FINANCIAL ACCOUNT</p><h2 id="account-dialog-title">{editingAccount ? 'Edit account' : 'Add an account'}</h2></div>
            <button type="button" className="profile-dialog-close" aria-label="Close account form" disabled={saving} onClick={closeForm}>×</button>
          </header>
          <form className="account-form" onSubmit={saveAccount} noValidate>
            <label>Account name
              <input value={formValues.name} onChange={(event) => setFormValues((current) => ({ ...current, name: event.target.value }))} maxLength={150} required autoFocus />
            </label>
            <div className="account-form-grid">
              <label>Account type
                <select value={formValues.type} onChange={(event) => setFormValues((current) => ({ ...current, type: event.target.value }))} required>
                  <option value="">Select a type</option>
                  {accountTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </label>
              <label>Current balance
                <input type="number" value={formValues.balance} onChange={(event) => setFormValues((current) => ({ ...current, balance: event.target.value }))} min="0" max="922337203685477" step="0.01" required />
              </label>
            </div>
            <label>Institution <span>Optional</span>
              <input value={formValues.institution} onChange={(event) => setFormValues((current) => ({ ...current, institution: event.target.value }))} maxLength={150} />
            </label>
            <label>Account number <span>Optional</span>
              <input value={formValues.number} onChange={(event) => setFormValues((current) => ({ ...current, number: event.target.value }))} maxLength={50} autoComplete="off" />
              <small className="account-form-hint">Account numbers are masked in the account list.</small>
            </label>
            <label className="account-active-field">
              <input type="checkbox" checked={formValues.isActive} onChange={(event) => setFormValues((current) => ({ ...current, isActive: event.target.checked }))} />
              <span><strong>Active account</strong><small>Inactive accounts are hidden from active account totals.</small></span>
            </label>
            {formError && <p className="account-form-error" role="alert">{formError}</p>}
            <footer className="account-form-actions">
              <button type="button" className="button-secondary" disabled={saving} onClick={closeForm}>Cancel</button>
              <button type="submit" className="button-primary" disabled={saving}>{saving ? 'Saving…' : editingAccount ? 'Save changes' : 'Add account'}</button>
            </footer>
          </form>
        </section>
      </div>}

      {pendingToggle && <div className="account-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !toggling) setPendingToggle(null) }}>
        <section className="account-dialog account-status-dialog" role="alertdialog" aria-modal="true" aria-labelledby="account-status-title">
          <header className="account-dialog-heading">
            <div><p className="eyebrow">ACCOUNT STATUS</p><h2 id="account-status-title">{pendingToggle.oma_isactive === true ? 'Deactivate account?' : 'Activate account?'}</h2></div>
            <button type="button" className="profile-dialog-close" aria-label="Close confirmation" disabled={toggling} onClick={() => setPendingToggle(null)}>×</button>
          </header>
          <div className="account-status-content">
            <p><strong>{pendingToggle.oma_accountname || 'This account'}</strong> will be {pendingToggle.oma_isactive === true ? 'marked inactive and excluded from active account totals' : 'marked active and included in active account totals'}. Existing records are not deleted.</p>
            {toggleError && <p className="account-form-error" role="alert">{toggleError}</p>}
            <div className="account-form-actions">
              <button type="button" className="button-secondary" disabled={toggling} onClick={() => setPendingToggle(null)}>Cancel</button>
              <button type="button" className="button-primary" disabled={toggling} onClick={toggleAccountStatus}>{toggling ? 'Updating…' : pendingToggle.oma_isactive === true ? 'Deactivate account' : 'Activate account'}</button>
            </div>
          </div>
        </section>
      </div>}
    </div>
  )
}
