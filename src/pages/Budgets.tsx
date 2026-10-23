import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Budget } from '../models'
import { budgetsService } from '../services/budgetsService'
import type { BudgetInput, BudgetsPageData } from '../services/budgetsService'

interface BudgetsProps {
  profileId: string
}

interface BudgetFormValues {
  name: string
  amount: string
  categoryId: string
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message
  return 'An unexpected error occurred while loading budgets.'
}

function cleanId(id: string | undefined) {
  return id?.replace(/[{}]/g, '').toLocaleLowerCase() ?? ''
}

function formatAmount(value: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

function periodStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function formatPeriod(date: Date) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date)
}

function periodInputValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

function getFormValues(budget: Budget | null): BudgetFormValues {
  return {
    name: budget?.oma_budgetname ?? '',
    amount: budget?.oma_budgetamount === undefined ? '' : String(budget.oma_budgetamount),
    categoryId: cleanId(budget?._oma_category_value),
  }
}

export function Budgets({ profileId }: BudgetsProps) {
  const [period, setPeriod] = useState(() => periodStart(new Date()))
  const [data, setData] = useState<BudgetsPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formValues, setFormValues] = useState<BudgetFormValues>(() => getFormValues(null))
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    budgetsService.list(profileId, period.getMonth() + 1, period.getFullYear()).then((result) => {
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
  }, [profileId, period, reloadKey])

  const totalPlanned = data?.budgets.reduce((sum, budget) => sum + (budget.oma_budgetamount ?? 0), 0) ?? 0
  const totalSpent = data?.budgets.reduce((sum, budget) => sum + (budget.oma_spentamount ?? 0), 0) ?? 0
  const totalRemaining = totalPlanned - totalSpent
  const budgetCategories = data?.categories ?? []
  const sortedBudgets = useMemo(() => [...(data?.budgets ?? [])].sort((first, second) => (
    (first.oma_budgetname ?? '').localeCompare(second.oma_budgetname ?? '')
  )), [data])

  function movePeriod(offset: number) {
    setLoading(true)
    setNotice('')
    setPeriod((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  function selectPeriod(value: string) {
    const match = /^(\d{4})-(\d{2})$/.exec(value)
    if (!match) return
    const year = Number(match[1])
    const month = Number(match[2])
    if (month < 1 || month > 12) return
    setLoading(true)
    setNotice('')
    setPeriod(new Date(year, month - 1, 1))
  }

  function selectCurrentPeriod() {
    setLoading(true)
    setNotice('')
    setPeriod(periodStart(new Date()))
  }

  function reload() {
    setLoading(true)
    setError('')
    setNotice('')
    setReloadKey((key) => key + 1)
  }

  function openForm(budget: Budget | null) {
    setEditingBudget(budget)
    setFormValues(getFormValues(budget))
    setFormError('')
    setDeleteError('')
    setDeleteConfirmation(false)
    setFormOpen(true)
  }

  function closeForm() {
    if (saving || deleting) return
    setFormOpen(false)
    setDeleteConfirmation(false)
  }

  function categoryName(categoryId: string | undefined) {
    const normalizedId = cleanId(categoryId)
    return budgetCategories.find((category) => cleanId(category.oma_categoryid) === normalizedId)?.oma_categoryname ?? 'Uncategorized'
  }

  function createInput(): BudgetInput | null {
    const name = formValues.name.trim()
    if (!name) {
      setFormError('Enter a name for this budget.')
      return null
    }
    if (formValues.categoryId && !budgetCategories.some((category) => cleanId(category.oma_categoryid) === cleanId(formValues.categoryId))) {
      setFormError('Select an expense category.')
      return null
    }
    if (!formValues.amount.trim()) {
      setFormError('Enter a budget amount.')
      return null
    }
    const amount = Number(formValues.amount)
    if (!Number.isFinite(amount) || amount < 0 || amount > 922337203685477 || !/^\d+(\.\d{1,2})?$/.test(formValues.amount)) {
      setFormError('Enter an amount of 0 or greater with no more than 2 decimal places.')
      return null
    }
    const duplicate = Boolean(formValues.categoryId) && sortedBudgets.some((budget) => (
      cleanId(budget._oma_category_value) === cleanId(formValues.categoryId)
      && cleanId(budget.oma_budgetid) !== cleanId(editingBudget?.oma_budgetid)
    ))
    if (duplicate) {
      setFormError('A budget already exists for this category and month.')
      return null
    }
    const profile = cleanId(profileId)
    if (!profile) {
      setFormError('Select a finance profile before saving a budget.')
      return null
    }
    return {
      oma_budgetname: name,
      oma_budgetamount: amount,
      oma_month: period.getMonth() + 1,
      oma_year: period.getFullYear(),
      _oma_category_value: formValues.categoryId.replace(/[{}]/g, '') || null,
      _oma_userprofile_value: profile,
    }
  }

  async function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    const input = createInput()
    if (!input) return
    setSaving(true)
    try {
      if (editingBudget?.oma_budgetid) {
        await budgetsService.update(editingBudget.oma_budgetid, input)
      } else {
        await budgetsService.create(input)
      }
      setFormOpen(false)
      setNotice(editingBudget ? 'Budget updated.' : 'Budget created.')
      setLoading(true)
      setReloadKey((key) => key + 1)
    } catch (saveError) {
      setFormError(errorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  async function deleteBudget() {
    if (!editingBudget?.oma_budgetid) return
    setDeleting(true)
    setDeleteError('')
    try {
      await budgetsService.delete(editingBudget.oma_budgetid)
      setFormOpen(false)
      setDeleteConfirmation(false)
      setNotice('Budget deleted.')
      setLoading(true)
      setReloadKey((key) => key + 1)
    } catch (operationError) {
      setDeleteError(errorMessage(operationError))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="budget-page">
      <section className="budget-page-heading">
        <div>
          <p className="eyebrow">SPENDING PLAN</p>
          <h1>Budgets</h1>
          <p className="budget-page-subtitle">Plan your spending and keep an eye on what’s left.</p>
        </div>
        <div className="budget-heading-actions">
          <button className="button-secondary" type="button" onClick={reload} disabled={loading}>Refresh</button>
          <button className="button-primary" type="button" onClick={() => openForm(null)} disabled={!data}>+ New budget</button>
        </div>
      </section>

      <section className="budget-period-bar" aria-label="Budget month">
        <button className="budget-period-button" type="button" aria-label="Previous month" onClick={() => movePeriod(-1)}>‹</button>
        <input className="budget-period-picker" type="month" value={periodInputValue(period)} onChange={(event) => selectPeriod(event.target.value)} aria-label="Select budget month and year" />
        <button className="budget-period-button" type="button" aria-label="Next month" onClick={() => movePeriod(1)}>›</button>
        <button className="budget-current-month" type="button" onClick={selectCurrentPeriod}>Current month</button>
      </section>

      {notice && <p className="budget-notice" role="status">{notice}</p>}

      {data && (
        <section className="budget-summary" aria-label="Monthly budget totals">
          <article><span>Total planned</span><strong>{formatAmount(totalPlanned)}</strong><small>{data.budgets.length} {data.budgets.length === 1 ? 'budget' : 'budgets'} this month</small></article>
          <article><span>Total spent</span><strong>{formatAmount(totalSpent)}</strong><small>Recorded spending</small></article>
          <article><span>{totalRemaining < 0 ? 'Over budget' : 'Remaining'}</span><strong className={totalRemaining < 0 ? 'budget-negative' : 'budget-positive'}>{formatAmount(Math.abs(totalRemaining))}</strong><small>{totalRemaining < 0 ? 'Across this month’s budgets' : 'Across this month’s budgets'}</small></article>
        </section>
      )}

      <section className="budget-list-panel" aria-label="Budgets">
        <header className="budget-list-heading"><div><h2>Monthly budgets</h2><p>{formatPeriod(period)} · budget progress by category</p></div></header>
        {loading ? (
          <div className="budget-page-state" aria-live="polite"><span className="spinner" /><p>Loading budgets…</p></div>
        ) : error ? (
          <div className="budget-page-state budget-page-error" role="alert"><p>{error}</p><button className="button-primary" type="button" onClick={reload}>Try again</button></div>
        ) : sortedBudgets.length ? (
          <div className="budget-record-list">{sortedBudgets.map((budget) => {
            const amount = budget.oma_budgetamount ?? 0
            const spent = budget.oma_spentamount ?? 0
            const remaining = amount - spent
            const percent = amount > 0 ? spent / amount * 100 : 0
            const progress = Math.min(Math.max(percent, 0), 100)
            return <article className="budget-record" key={budget.oma_budgetid}>
              <span className="budget-category-mark" aria-hidden="true">{(categoryName(budget._oma_category_value).trim()[0] ?? 'B').toUpperCase()}</span>
              <div className="budget-record-main">
                <div className="budget-record-title"><div><h3>{budget.oma_budgetname || 'Budget'}</h3><span>{categoryName(budget._oma_category_value)}</span></div>
                  <div className="budget-record-actions"><button type="button" onClick={() => openForm(budget)}>Edit</button><button type="button" className="budget-delete-link" onClick={() => { openForm(budget); setDeleteConfirmation(true) }}>Delete</button></div>
                </div>
                <div className="budget-record-progress" role="progressbar" aria-label={`${budget.oma_budgetname || 'Budget'} spending`} aria-valuenow={Math.min(Math.round(percent), 100)} aria-valuemin={0} aria-valuemax={100}><span className={remaining < 0 ? 'budget-progress-over' : ''} style={{ width: `${progress}%` }} /></div>
                <div className="budget-record-meta"><span>{formatAmount(spent)} spent of {formatAmount(amount)}</span><strong className={remaining < 0 ? 'budget-negative' : 'budget-positive'}>{remaining < 0 ? `${formatAmount(Math.abs(remaining))} over` : `${formatAmount(remaining)} left`}</strong></div>
              </div>
            </article>
          })}</div>
        ) : (
          <div className="budget-empty-state">
            <span className="budget-empty-icon" aria-hidden="true">◎</span>
            <h3>No budgets for {formatPeriod(period)}</h3>
            <p>{budgetCategories.length ? 'Add a budget to set a spending target for one of your expense categories.' : 'There are no expense categories available for budgeting in this profile.'}</p>
            {budgetCategories.length > 0 && <button className="button-primary" type="button" onClick={() => openForm(null)}>Create your first budget</button>}
          </div>
        )}
      </section>

      {formOpen && <div className="budget-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}>
        <section className="budget-dialog" role="dialog" aria-modal="true" aria-labelledby="budget-dialog-title">
          <header className="budget-dialog-heading">
            <div><p className="eyebrow">{formatPeriod(period).toLocaleUpperCase()}</p><h2 id="budget-dialog-title">{editingBudget ? 'Edit budget' : 'Create a budget'}</h2></div>
            <button type="button" className="profile-dialog-close" aria-label="Close budget form" disabled={saving || deleting} onClick={closeForm}>×</button>
          </header>
          <form className="budget-form" onSubmit={saveBudget} noValidate>
            <label>Budget name
              <input value={formValues.name} onChange={(event) => setFormValues((current) => ({ ...current, name: event.target.value }))} maxLength={200} required autoFocus />
            </label>
            <label>Expense category <span>Optional</span>
              <select value={formValues.categoryId} onChange={(event) => setFormValues((current) => ({ ...current, categoryId: event.target.value }))}>
                <option value="">Uncategorized</option>
                {budgetCategories.map((category) => <option key={category.oma_categoryid} value={category.oma_categoryid?.replace(/[{}]/g, '')}>{category.oma_categoryname || 'Category'}</option>)}
              </select>
            </label>
            {!budgetCategories.length && <p className="budget-form-hint" role="status">No expense categories were found. You can save this budget as uncategorized and assign a category later.</p>}
            <label>Monthly limit
              <input type="number" value={formValues.amount} onChange={(event) => setFormValues((current) => ({ ...current, amount: event.target.value }))} min="0" max="922337203685477" step="0.01" required />
            </label>
            <p className="budget-form-hint">Spent amount is tracked separately and is not changed when you edit the budget.</p>
            {formError && <p className="budget-form-error" role="alert">{formError}</p>}
            {deleteConfirmation && <div className="budget-delete-confirm" role="alert">
              <strong>Delete this budget?</strong>
              <p>This only removes the budget record. Recorded transactions are not affected.</p>
              {deleteError && <p className="budget-form-error">{deleteError}</p>}
              <div><button type="button" className="button-secondary" disabled={deleting} onClick={() => setDeleteConfirmation(false)}>Keep budget</button><button type="button" className="button-danger" disabled={deleting} onClick={deleteBudget}>{deleting ? 'Deleting…' : 'Delete budget'}</button></div>
            </div>}
            <footer className="budget-form-actions">
              {editingBudget && !deleteConfirmation && <button type="button" className="button-danger budget-form-delete" disabled={saving || deleting} onClick={() => setDeleteConfirmation(true)}>Delete</button>}
              <button type="button" className="button-secondary" disabled={saving || deleting} onClick={closeForm}>Cancel</button>
              <button type="submit" className="button-primary" disabled={saving || deleting}>{saving ? 'Saving…' : editingBudget ? 'Save changes' : 'Create budget'}</button>
            </footer>
          </form>
        </section>
      </div>}
    </div>
  )
}
