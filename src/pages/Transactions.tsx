import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Category, FinancialAccount, Transaction, UserProfile } from '../models'
import { transactionsService } from '../services/transactionsService'
import type { TransactionInput, TransactionsPageData } from '../services/transactionsService'

type TransactionFilter = 'all' | 'income' | 'expense' | 'transfer' | 'other'

interface TransactionsProps {
  profileId: string
  profiles: UserProfile[]
}

interface TransactionFormValues {
  name: string
  date: string
  amount: string
  type: string
  categoryId: string
  accountId: string
  transferToAccountId: string
  notes: string
  isRecurring: boolean
  profileId: string
}

const pageSize = 25

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message
  return 'An unexpected error occurred while loading transactions.'
}

function transactionKind(value: number | undefined): Exclude<TransactionFilter, 'all'> {
  if (value === 1) return 'income'
  if (value === 2) return 'expense'
  if (value === 3) return 'transfer'
  return 'other'
}

function kindLabel(kind: Exclude<TransactionFilter, 'all'>) {
  return kind[0].toUpperCase() + kind.slice(1)
}

function formatDate(value: string | undefined) {
  if (!value) return '—'
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function formatAmount(value: number | undefined) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0)
}

function categoryName(categories: Category[], id: string | undefined) {
  return categories.find((category) => (
    category.oma_categoryid && id && sameRecordId(category.oma_categoryid, id)
  ))?.oma_categoryname || 'Uncategorized'
}

function accountName(accounts: FinancialAccount[], id: string | undefined) {
  return accounts.find((account) => (
    account.oma_financialaccountid && id && sameRecordId(account.oma_financialaccountid, id)
  ))?.oma_accountname || '—'
}

function sameRecordId(firstId: string, secondId: string) {
  return firstId.replace(/[{}]/g, '').toLocaleLowerCase() === secondId.replace(/[{}]/g, '').toLocaleLowerCase()
}

function normalizeRecordId(id: string | undefined) {
  return id?.replace(/[{}]/g, '') ?? ''
}

function localDateInputValue() {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

function getFormValues(transaction: Transaction | null, profileId: string): TransactionFormValues {
  return {
    name: transaction?.oma_transactionname ?? '',
    date: transaction?.oma_transactiondate?.slice(0, 10) ?? localDateInputValue(),
    amount: transaction?.oma_amount === undefined ? '' : String(transaction.oma_amount),
    type: transaction?.oma_transactiontype === undefined ? '' : String(transaction.oma_transactiontype),
    categoryId: normalizeRecordId(transaction?._oma_category_value),
    accountId: normalizeRecordId(transaction?._oma_financialaccount_value),
    transferToAccountId: normalizeRecordId(transaction?._oma_transfertoaccount_value),
    notes: transaction?.oma_notes ?? '',
    isRecurring: transaction?.oma_isrecurring ?? false,
    profileId: normalizeRecordId(transaction?._oma_userprofile_value) || profileId,
  }
}

function toTransactionInput(values: TransactionFormValues): TransactionInput {
  const amount = Number(values.amount)
  return {
    oma_transactionname: values.name.trim(),
    oma_transactiondate: `${values.date}T00:00:00.000Z`,
    oma_amount: amount,
    oma_transactiontype: Number(values.type),
    oma_isrecurring: values.isRecurring,
    oma_notes: values.notes.trim() || null,
    _oma_category_value: normalizeRecordId(values.categoryId),
    _oma_financialaccount_value: normalizeRecordId(values.accountId),
    _oma_transfertoaccount_value: normalizeRecordId(values.transferToAccountId) || null,
    _oma_userprofile_value: normalizeRecordId(values.profileId),
  }
}

export function Transactions({ profileId, profiles }: TransactionsProps) {
  const [data, setData] = useState<TransactionsPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TransactionFilter>('all')
  const [page, setPage] = useState(1)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formValues, setFormValues] = useState<TransactionFormValues>(() => getFormValues(null, profileId))
  const [formLookups, setFormLookups] = useState<Pick<TransactionsPageData, 'categories' | 'accounts'>>({ categories: [], accounts: [] })
  const [formLoadingLookups, setFormLoadingLookups] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [saveNotice, setSaveNotice] = useState('')

  function reload() {
    setLoading(true)
    setError('')
    setPage(1)
    setReloadKey((key) => key + 1)
  }

  function refreshTransactions() {
    setPage(1)
    setLoading(true)
    setReloadKey((key) => key + 1)
  }

  useEffect(() => {
    let active = true
    transactionsService.list(profileId).then((result) => {
      if (active) setData(result)
    }).catch((loadError: unknown) => {
      if (!active) return
      setData(null)
      setError(errorMessage(loadError))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [profileId, reloadKey])

  const filteredTransactions = useMemo(() => {
    if (!data) return []
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return data.transactions.filter((transaction) => {
      const kind = transactionKind(transaction.oma_transactiontype)
      if (filter !== 'all' && kind !== filter) return false
      if (!normalizedQuery) return true
      const searchable = [
        transaction.oma_transactionname,
        transaction.oma_notes,
        categoryName(data.categories, transaction._oma_category_value),
        accountName(data.accounts, transaction._oma_financialaccount_value),
        accountName(data.accounts, transaction._oma_transfertoaccount_value),
      ].join(' ').toLocaleLowerCase()
      return searchable.includes(normalizedQuery)
    })
  }, [data, filter, query])

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize))
  const visibleTransactions = filteredTransactions.slice((page - 1) * pageSize, page * pageSize)
  const incomeTotal = data?.transactions.reduce((sum, transaction) => (
    transactionKind(transaction.oma_transactiontype) === 'income' ? sum + (transaction.oma_amount ?? 0) : sum
  ), 0) ?? 0
  const expenseTotal = data?.transactions.reduce((sum, transaction) => (
    transactionKind(transaction.oma_transactiontype) === 'expense' ? sum + (transaction.oma_amount ?? 0) : sum
  ), 0) ?? 0

  function updateQuery(value: string) {
    setQuery(value)
    setPage(1)
  }

  function updateFilter(value: TransactionFilter) {
    setFilter(value)
    setPage(1)
  }

  async function openForm(transaction: Transaction | null) {
    setEditingTransaction(transaction)
    setFormValues(getFormValues(transaction, profileId))
    setFormLookups({ categories: [], accounts: [] })
    setFormLoadingLookups(true)
    setFormError('')
    setDeleteError('')
    setSaveNotice('')
    setDeleteConfirmation(false)
    setFormOpen(true)
    try {
      setFormLookups(await transactionsService.listLookups(profileId))
    } catch (lookupError) {
      setFormError(`Lookup values could not be loaded: ${errorMessage(lookupError)}`)
    } finally {
      setFormLoadingLookups(false)
    }
  }

  function updateFormValue<K extends keyof TransactionFormValues>(key: K, value: TransactionFormValues[K]) {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  function updateSourceAccount(accountId: string) {
    setFormValues((current) => ({
      ...current,
      accountId,
      transferToAccountId: current.transferToAccountId && sameRecordId(current.transferToAccountId, accountId)
        ? ''
        : current.transferToAccountId,
    }))
  }

  async function handleProfileChange(nextProfileId: string) {
    setFormValues((current) => ({
      ...current,
      profileId: nextProfileId,
      categoryId: '',
      accountId: '',
      transferToAccountId: '',
    }))
    setFormLoadingLookups(true)
    setFormError('')
    try {
      setFormLookups(await transactionsService.listLookups(nextProfileId))
    } catch (lookupError) {
      setFormLookups({ categories: [], accounts: [] })
      setFormError(errorMessage(lookupError))
    } finally {
      setFormLoadingLookups(false)
    }
  }

  async function saveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    if (!formValues.name.trim()) {
      setFormError('Transaction was not saved. Enter a transaction name.')
      return
    }
    if (!formValues.date) {
      setFormError('Transaction was not saved. Select a transaction date.')
      return
    }
    if (!formValues.amount.trim()) {
      setFormError('Transaction was not saved. Enter a transaction amount.')
      return
    }
    const amount = Number(formValues.amount)
    if (!Number.isFinite(amount) || amount < 0 || amount > 922337203685477 || !/^\d+(\.\d{1,2})?$/.test(formValues.amount)) {
      setFormError('Transaction was not saved. Enter an amount of 0 or greater with no more than 2 decimal places.')
      return
    }
    if (![1, 2, 3].includes(Number(formValues.type))) {
      setFormError('Transaction was not saved. Select a valid transaction type.')
      return
    }
    if (!formValues.categoryId || !formLookups.categories.some((category) => (
      category.oma_categoryid && sameRecordId(category.oma_categoryid, formValues.categoryId)
    ))) {
      setFormError('Transaction was not saved. Select a valid category.')
      return
    }
    if (!formValues.accountId || !formLookups.accounts.some((account) => (
      account.oma_financialaccountid && sameRecordId(account.oma_financialaccountid, formValues.accountId)
    ))) {
      setFormError('Transaction was not saved. Select a valid financial account.')
      return
    }
    if (!formValues.profileId || !profiles.some((profile) => (
      profile.oma_userprofileid && sameRecordId(profile.oma_userprofileid, formValues.profileId)
    ))) {
      setFormError('Transaction was not saved. Select a valid user profile.')
      return
    }
    if (formValues.transferToAccountId && !formLookups.accounts.some((account) => (
      account.oma_financialaccountid && sameRecordId(account.oma_financialaccountid, formValues.transferToAccountId)
    ))) {
      setFormError('Transaction was not saved. Select a valid destination account.')
      return
    }
    if (formValues.transferToAccountId && sameRecordId(formValues.transferToAccountId, formValues.accountId)) {
      setFormError('Transaction was not saved. The transfer destination must be different from the source account.')
      return
    }

    setSaving(true)
    setSaveNotice('')
    try {
      const input = toTransactionInput(formValues)
      const isEditing = Boolean(editingTransaction?.oma_transactionid)
      if (editingTransaction?.oma_transactionid) {
        await transactionsService.update(editingTransaction.oma_transactionid, input)
      } else {
        await transactionsService.create(input)
      }
      setFormOpen(false)
      setSaveNotice(isEditing ? 'Transaction updated successfully.' : 'Transaction created successfully.')
      refreshTransactions()
    } catch (saveError) {
      setFormError(`Transaction was not saved. ${errorMessage(saveError)}`)
    } finally {
      setSaving(false)
    }
  }

  async function deleteTransaction() {
    if (!editingTransaction?.oma_transactionid) return
    setDeleting(true)
    setDeleteError('')
    try {
      await transactionsService.delete(editingTransaction.oma_transactionid)
      setFormOpen(false)
      refreshTransactions()
    } catch (operationError) {
      setDeleteError(errorMessage(operationError))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="transactions-page">
      <section className="transactions-heading">
        <div>
          <p className="eyebrow">FINANCE ACTIVITY</p>
          <h1>Transactions</h1>
          <p className="transactions-subtitle">Review and find transactions for this finance profile.</p>
        </div>
        <button className="button-secondary" type="button" disabled={loading} onClick={reload}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 9a7 7 0 0 1 12-2l2 2M4 13l2 2a7 7 0 0 0 12-2" /></svg>
          Refresh
        </button>
        <button className="button-primary" type="button" disabled={loading} onClick={() => openForm(null)}>New transaction</button>
      </section>

      {saveNotice && <p className="transaction-save-notice" role="status" aria-live="polite">{saveNotice}</p>}

      {data && !loading && !error && <>
        <section className="transaction-summary" aria-label="Transaction summary">
          <article className="transaction-stat"><span>Transactions</span><strong>{data.transactions.length}</strong><small>For this profile</small></article>
          <article className="transaction-stat"><span>Income recorded</span><strong>{formatAmount(incomeTotal)}</strong><small>All loaded transactions</small></article>
          <article className="transaction-stat"><span>Expenses recorded</span><strong>{formatAmount(expenseTotal)}</strong><small>All loaded transactions</small></article>
        </section>

      </>}

        <section className="transactions-panel">
          <div className="transactions-panel-heading">
            <div><h2>All transactions</h2><p>{data ? `${filteredTransactions.length} ${filteredTransactions.length === 1 ? 'record' : 'records'}${filteredTransactions.length !== data.transactions.length ? ` (filtered from ${data.transactions.length})` : ''}` : 'Your profile activity'}</p></div>
          </div>
          <div className="transactions-toolbar">
            <label className="transaction-search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
              <input type="search" value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Search transactions..." aria-label="Search transactions" />
            </label>
            <label className="transaction-filter">
              <span>Type</span>
              <select value={filter} onChange={(event) => updateFilter(event.target.value as TransactionFilter)} aria-label="Filter by transaction type">
                <option value="all">All types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="transfer">Transfer</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>

          {loading ? (
            <div className="transactions-state"><span className="spinner" /><p>Loading transactions from Dataverse…</p></div>
          ) : error ? (
            <div className="transactions-state transactions-error" role="alert"><p>{error}</p><button className="button-primary" type="button" onClick={reload}>Retry</button></div>
          ) : data && visibleTransactions.length ? (
            <>
              <div className="transactions-table-wrap">
                <table className="transactions-table">
                  <thead><tr><th>TRANSACTION</th><th>TYPE</th><th>CATEGORY</th><th>ACCOUNT</th><th>DATE</th><th className="align-right">AMOUNT</th></tr></thead>
                  <tbody>{visibleTransactions.map((transaction) => {
                    const kind = transactionKind(transaction.oma_transactiontype)
                    return (
                      <tr key={transaction.oma_transactionid}>
                        <td><button className="transaction-title-button" type="button" onClick={() => openForm(transaction)} aria-label={`Open ${transaction.oma_transactionname || 'transaction'} record`}>
                          <span className={`transaction-kind-icon kind-${kind}`}>{kind === 'income' ? '↓' : kind === 'expense' ? '↑' : kind === 'transfer' ? '↔' : '•'}</span><span className="transaction-title"><span><strong>{transaction.oma_transactionname || 'Transaction'}</strong>{transaction.oma_isrecurring && <small>Recurring</small>}</span></span>
                        </button></td>
                        <td><span className={`transaction-type-pill type-${kind}`}>{kindLabel(kind)}</span></td>
                        <td>{categoryName(data.categories, transaction._oma_category_value)}</td>
                        <td>{accountName(data.accounts, transaction._oma_financialaccount_value)}{transaction._oma_transfertoaccount_value && <small className="transaction-transfer-destination"> → {accountName(data.accounts, transaction._oma_transfertoaccount_value)}</small>}</td>
                        <td>{formatDate(transaction.oma_transactiondate)}</td>
                        <td className={`align-right transaction-amount amount-${kind}`}>{kind === 'income' ? '+' : kind === 'expense' ? '−' : ''}{formatAmount(transaction.oma_amount)}</td>
                      </tr>
                    )
                  })}</tbody>
                </table>
              </div>
              <div className="transactions-pagination">
                <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredTransactions.length)} of {filteredTransactions.length}</span>
                <div><button type="button" className="pagination-button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {totalPages}</span><button type="button" className="pagination-button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button></div>
              </div>
            </>
          ) : data ? (
            <div className="transactions-empty">
              <span className="transactions-empty-icon" aria-hidden="true">↔</span>
              <strong>{data.transactions.length ? 'No matching transactions' : 'No transactions yet'}</strong>
              <p>{data.transactions.length ? 'Try another search term or transaction type.' : 'Transactions linked to this finance profile will appear here.'}</p>
              {(query || filter !== 'all') && <button type="button" className="text-button" onClick={() => { updateQuery(''); updateFilter('all') }}>Clear filters</button>}
            </div>
          ) : null}
        </section>
      {formOpen && <div className="transaction-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving && !deleting) setFormOpen(false) }}>
        <section className="transaction-dialog" role="dialog" aria-modal="true" aria-labelledby="transaction-dialog-title">
          <header className="transaction-dialog-heading">
            <div><p className="eyebrow">{editingTransaction ? 'TRANSACTION RECORD' : 'NEW RECORD'}</p><h2 id="transaction-dialog-title">{editingTransaction ? 'Edit transaction' : 'New transaction'}</h2></div>
            <button type="button" className="profile-dialog-close" aria-label="Close transaction form" disabled={saving || deleting} onClick={() => setFormOpen(false)}>×</button>
          </header>
          <form id="transaction-record-form" className="transaction-record-form" onSubmit={saveTransaction} noValidate>
            <label className="transaction-form-field">Transaction Name <span className="required-indicator" aria-hidden="true">*</span>
              <input value={formValues.name} onChange={(event) => updateFormValue('name', event.target.value)} maxLength={200} required autoFocus />
            </label>
            <div className="transaction-form-grid">
              <label className="transaction-form-field">Transaction Date <span className="required-indicator" aria-hidden="true">*</span>
                <input type="date" value={formValues.date} onChange={(event) => updateFormValue('date', event.target.value)} required />
              </label>
              <label className="transaction-form-field">Amount <span className="required-indicator" aria-hidden="true">*</span>
                <input type="number" value={formValues.amount} onChange={(event) => updateFormValue('amount', event.target.value)} min="0" max="922337203685477" step="0.01" required />
              </label>
            </div>
            <label className="transaction-form-field">Transaction Type <span className="required-indicator" aria-hidden="true">*</span>
              <select value={formValues.type} onChange={(event) => updateFormValue('type', event.target.value)} required>
                <option value="">Select a type</option>
                <option value="1">Income</option>
                <option value="2">Expense</option>
                <option value="3">Transfer</option>
                {formValues.type && ![1, 2, 3].includes(Number(formValues.type)) && <option value={formValues.type}>Other ({formValues.type})</option>}
              </select>
            </label>
            <label className="transaction-form-field">Category <span className="required-indicator" aria-hidden="true">*</span>
              <select value={formValues.categoryId} onChange={(event) => updateFormValue('categoryId', event.target.value)} required disabled={formLoadingLookups}>
                <option value="">{formLoadingLookups ? 'Loading categories…' : 'Select a category'}</option>
                {formLookups.categories.map((category) => <option key={category.oma_categoryid} value={normalizeRecordId(category.oma_categoryid)}>{category.oma_categoryname}</option>)}
              </select>
            </label>
            <label className="transaction-form-field">Financial Account <span className="required-indicator" aria-hidden="true">*</span>
              <select value={formValues.accountId} onChange={(event) => updateSourceAccount(event.target.value)} required disabled={formLoadingLookups}>
                <option value="">{formLoadingLookups ? 'Loading accounts…' : 'Select an account'}</option>
                {formLookups.accounts.map((account) => <option key={account.oma_financialaccountid} value={normalizeRecordId(account.oma_financialaccountid)}>{account.oma_accountname}</option>)}
              </select>
            </label>
            <label className="transaction-form-field">Transfer To Account <span>Optional</span>
              <select value={formValues.transferToAccountId} onChange={(event) => updateFormValue('transferToAccountId', event.target.value)} disabled={formLoadingLookups}>
                <option value="">No destination account</option>
                {formLookups.accounts.filter((account) => account.oma_financialaccountid && !sameRecordId(account.oma_financialaccountid, formValues.accountId)).map((account) => <option key={account.oma_financialaccountid} value={normalizeRecordId(account.oma_financialaccountid)}>{account.oma_accountname}</option>)}
              </select>
            </label>
            <label className="transaction-form-field">User Profile <span className="required-indicator" aria-hidden="true">*</span>
              <select value={formValues.profileId} onChange={(event) => handleProfileChange(event.target.value)} required>
                {profiles.map((profile) => <option key={profile.oma_userprofileid} value={profile.oma_userprofileid}>{profile.oma_profilename || profile.oma_fullname || 'Finance profile'}</option>)}
              </select>
              <small className="transaction-form-help">Changing the profile moves this transaction to that profile’s transaction list.</small>
            </label>
            <label className="transaction-form-field">Notes <span>Optional</span>
              <textarea value={formValues.notes} onChange={(event) => updateFormValue('notes', event.target.value)} maxLength={2000} rows={4} />
            </label>
            <label className="transaction-recurring-field">
              <input type="checkbox" checked={formValues.isRecurring} onChange={(event) => updateFormValue('isRecurring', event.target.checked)} />
              <span><strong>Is Recurring</strong><small>Mark this transaction as recurring.</small></span>
            </label>
            {formError && <p className="transaction-form-error" role="alert">{formError}</p>}
            {deleteConfirmation && <div className="transaction-delete-confirm" role="alert">
              <strong>Delete this transaction?</strong>
              <p>This action is permanent. The transaction record will be removed from Dataverse.</p>
              {deleteError && <p className="transaction-form-error">{deleteError}</p>}
              <div><button type="button" className="button-secondary" disabled={deleting} onClick={() => setDeleteConfirmation(false)}>Keep transaction</button><button type="button" className="button-danger" disabled={deleting} onClick={deleteTransaction}>{deleting ? 'Deleting…' : 'Delete transaction'}</button></div>
            </div>}
          </form>
          <footer className="transaction-dialog-footer">
            {editingTransaction && !deleteConfirmation && <button type="button" className="button-danger transaction-dialog-delete" disabled={saving || deleting} onClick={() => setDeleteConfirmation(true)}>Delete</button>}
            <button type="button" className="button-secondary" disabled={saving || deleting} onClick={() => setFormOpen(false)}>Cancel</button>
            <button type="submit" form="transaction-record-form" className="button-primary" disabled={saving || deleting || formLoadingLookups}>{saving ? 'Saving…' : 'Save'}</button>
          </footer>
        </section>
      </div>}
    </div>
  )
}
