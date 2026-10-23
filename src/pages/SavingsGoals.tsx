import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { SavingsContribution, SavingsGoal } from '../models'
import { savingsGoalsService } from '../services/savingsGoalsService'
import type { SavingsContributionInput, SavingsGoalInput, SavingsGoalsPageData } from '../services/savingsGoalsService'

interface SavingsGoalsProps {
  profileId: string
}

interface GoalFormValues {
  name: string
  currentAmount: string
  targetAmount: string
  targetDate: string
  notes: string
  status: string
}

interface ContributionFormValues {
  amount: string
  date: string
  notes: string
}

const goalStatuses = [
  { value: 1, label: 'Active' },
  { value: 2, label: 'Achieved' },
  { value: 3, label: 'Paused' },
  { value: 4, label: 'Cancelled' },
]

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message
  return 'An unexpected error occurred while loading savings goals.'
}

function cleanId(id: string | undefined) {
  return id?.replace(/[{}]/g, '').toLocaleLowerCase() ?? ''
}

function formatAmount(value: number) {
  return `$${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`
}

function dateInputValue(value: string | undefined) {
  if (!value) return ''
  const datePart = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : ''
}

function todayInputValue() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(value: string | undefined) {
  if (!value) return 'No target date'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'No target date'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

function dateTimeValue(value: string) {
  return value ? `${value}T12:00:00.000Z` : null
}

function getGoalFormValues(goal: SavingsGoal | null): GoalFormValues {
  return {
    name: goal?.oma_goalname ?? '',
    currentAmount: goal?.oma_currentamount === undefined ? '0' : String(goal.oma_currentamount),
    targetAmount: goal?.oma_targetamount === undefined ? '' : String(goal.oma_targetamount),
    targetDate: dateInputValue(goal?.oma_targetdate),
    notes: goal?.oma_notes ?? '',
    status: String(goal?.oma_status ?? 1),
  }
}

function getContributionFormValues(): ContributionFormValues {
  return { amount: '', date: todayInputValue(), notes: '' }
}

function parseMoney(value: string, label: string, allowZero: boolean) {
  if (!value.trim()) throw new Error(`Enter a ${label.toLowerCase()}.`)
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0 || (!allowZero && amount === 0) || amount > 922337203685477 || !/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error(`Enter a ${label.toLowerCase()}${allowZero ? ' of 0 or greater' : ' greater than 0'} with no more than 2 decimal places.`)
  }
  return amount
}

function statusLabel(value: number | undefined) {
  return goalStatuses.find((status) => status.value === value)?.label ?? 'Unknown'
}

function getGoalContributions(goal: SavingsGoal, contributions: SavingsContribution[]) {
  const goalId = cleanId(goal.oma_savingsgoalid)
  return contributions.filter((contribution) => cleanId(contribution._oma_savingsgoal_value) === goalId)
}

function toGoalInput(values: GoalFormValues, profileId: string): SavingsGoalInput {
  const name = values.name.trim()
  if (!name) throw new Error('Enter a name for this savings goal.')
  if (name.length > 200) throw new Error('Goal name must be 200 characters or fewer.')
  if (values.notes.length > 200) throw new Error('Notes must be 200 characters or fewer.')
  const currentAmount = parseMoney(values.currentAmount, 'current amount', true)
  const targetAmount = parseMoney(values.targetAmount, 'target amount', false)
  const profile = cleanId(profileId)
  if (!profile) throw new Error('Select a finance profile before saving this goal.')
  const selectedStatus = Number(values.status)
  if (!goalStatuses.some((status) => status.value === selectedStatus)) throw new Error('Select a goal status.')
  const status = currentAmount >= targetAmount ? 2 : selectedStatus === 2 ? 1 : selectedStatus

  return {
    oma_goalname: name,
    oma_currentamount: currentAmount,
    oma_targetamount: targetAmount,
    oma_targetdate: dateTimeValue(values.targetDate),
    oma_notes: values.notes.trim() || null,
    oma_status: status,
    _oma_userprofile_value: profile,
  }
}

export function SavingsGoals({ profileId }: SavingsGoalsProps) {
  const [data, setData] = useState<SavingsGoalsPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null)
  const [goalFormOpen, setGoalFormOpen] = useState(false)
  const [goalFormValues, setGoalFormValues] = useState<GoalFormValues>(() => getGoalFormValues(null))
  const [goalFormError, setGoalFormError] = useState('')
  const [savingGoal, setSavingGoal] = useState(false)
  const [contributingGoal, setContributingGoal] = useState<SavingsGoal | null>(null)
  const [contributionValues, setContributionValues] = useState<ContributionFormValues>(() => getContributionFormValues())
  const [contributionError, setContributionError] = useState('')
  const [savingContribution, setSavingContribution] = useState(false)
  const [deletingGoal, setDeletingGoal] = useState<SavingsGoal | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    savingsGoalsService.list(profileId).then((result) => {
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

  const goals = useMemo(() => [...(data?.goals ?? [])].sort((first, second) => {
    const statusOrder = (first.oma_status === 2 ? 1 : 0) - (second.oma_status === 2 ? 1 : 0)
    if (statusOrder !== 0) return statusOrder
    return (first.oma_targetdate ?? '').localeCompare(second.oma_targetdate ?? '')
  }), [data])
  const totalSaved = goals.reduce((sum, goal) => sum + (goal.oma_currentamount ?? 0), 0)
  const activeCount = goals.filter((goal) => goal.oma_status === 1).length
  const remainingAmount = goals.reduce((sum, goal) => {
    if (goal.oma_status === 2 || goal.oma_status === 4) return sum
    return sum + Math.max((goal.oma_targetamount ?? 0) - (goal.oma_currentamount ?? 0), 0)
  }, 0)

  function reload() {
    setLoading(true)
    setError('')
    setNotice('')
    setReloadKey((key) => key + 1)
  }

  function openGoalForm(goal: SavingsGoal | null) {
    setEditingGoal(goal)
    setGoalFormValues(getGoalFormValues(goal))
    setGoalFormError('')
    setGoalFormOpen(true)
  }

  async function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setGoalFormError('')
    let input: SavingsGoalInput
    try {
      input = toGoalInput(goalFormValues, profileId)
    } catch (validationError) {
      setGoalFormError(errorMessage(validationError))
      return
    }
    setSavingGoal(true)
    try {
      if (editingGoal?.oma_savingsgoalid) {
        await savingsGoalsService.update(editingGoal.oma_savingsgoalid, input)
      } else {
        await savingsGoalsService.create(input)
      }
      setGoalFormOpen(false)
      setNotice(editingGoal ? 'Savings goal updated.' : 'Savings goal created.')
      setLoading(true)
      setReloadKey((key) => key + 1)
    } catch (saveError) {
      setGoalFormError(errorMessage(saveError))
    } finally {
      setSavingGoal(false)
    }
  }

  function openContributionForm(goal: SavingsGoal) {
    setContributingGoal(goal)
    setContributionValues(getContributionFormValues())
    setContributionError('')
  }

  async function saveContribution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!contributingGoal) return
    setContributionError('')
    let amount: number
    try {
      amount = parseMoney(contributionValues.amount, 'contribution amount', false)
      if (!contributionValues.date) throw new Error('Select a contribution date.')
      if (contributionValues.notes.length > 2000) throw new Error('Contribution notes must be 2,000 characters or fewer.')
    } catch (validationError) {
      setContributionError(errorMessage(validationError))
      return
    }

    const goalName = contributingGoal.oma_goalname || 'Savings goal'
    const currentAmount = contributingGoal.oma_currentamount ?? 0
    const targetAmount = contributingGoal.oma_targetamount ?? 0
    const newCurrentAmount = currentAmount + amount
    if (newCurrentAmount > 922337203685477) {
      setContributionError('This contribution would exceed the maximum supported goal amount.')
      return
    }
    const newStatus = targetAmount > 0 && newCurrentAmount >= targetAmount ? 2 : contributingGoal.oma_status ?? 1
    const contributionSuffix = ` - ${contributionValues.date}`
    const contribution: Omit<SavingsContributionInput, '_oma_savingsgoal_value' | '_oma_userprofile_value'> = {
      oma_contributionname: `${goalName.slice(0, 200 - contributionSuffix.length)}${contributionSuffix}`,
      oma_amount: amount,
      oma_contributiondate: dateTimeValue(contributionValues.date) ?? '',
      oma_notes: contributionValues.notes.trim() || null,
    }

    setSavingContribution(true)
    try {
      await savingsGoalsService.recordContribution(contributingGoal, profileId, contribution, newCurrentAmount, newStatus)
      setContributingGoal(null)
      setNotice(newStatus === 2 && contributingGoal.oma_status !== 2 ? `${goalName} achieved!` : 'Contribution recorded.')
      setLoading(true)
      setReloadKey((key) => key + 1)
    } catch (saveError) {
      setContributionError(errorMessage(saveError))
    } finally {
      setSavingContribution(false)
    }
  }

  async function deleteGoal() {
    if (!deletingGoal?.oma_savingsgoalid) return
    setDeleting(true)
    setDeleteError('')
    try {
      await savingsGoalsService.delete(deletingGoal.oma_savingsgoalid)
      setDeletingGoal(null)
      setNotice('Savings goal deleted.')
      setLoading(true)
      setReloadKey((key) => key + 1)
    } catch (operationError) {
      setDeleteError(errorMessage(operationError))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="savings-goals-page">
      <section className="savings-goals-heading">
        <div>
          <p className="eyebrow">SAVE WITH PURPOSE</p>
          <h1>Savings goals</h1>
          <p className="savings-goals-subtitle">Set a target, track your progress, and celebrate every contribution.</p>
        </div>
        <div className="savings-goals-heading-actions">
          <button className="button-secondary" type="button" onClick={reload} disabled={loading}>Refresh</button>
          <button className="button-primary" type="button" onClick={() => openGoalForm(null)}>+ New goal</button>
        </div>
      </section>

      {notice && <p className="savings-goals-notice" role="status">{notice}</p>}

      {data && <section className="savings-goals-summary" aria-label="Savings goals summary">
        <article><span>Total saved</span><strong>{formatAmount(totalSaved)}</strong><small>Across {goals.length} {goals.length === 1 ? 'goal' : 'goals'}</small></article>
        <article><span>Active goals</span><strong>{activeCount}</strong><small>Goals currently in progress</small></article>
        <article><span>Still to save</span><strong>{formatAmount(remainingAmount)}</strong><small>For active and paused goals</small></article>
      </section>}

      <section className="savings-goals-panel" aria-label="Your savings goals">
        <header className="savings-goals-list-heading">
          <div><h2>Your goals</h2><p>Track progress and manage contributions in one place.</p></div>
        </header>
        {loading ? (
          <div className="savings-goals-state" aria-live="polite"><span className="spinner" /><p>Loading savings goals…</p></div>
        ) : error ? (
          <div className="savings-goals-state savings-goals-error" role="alert"><p>{error}</p><button className="button-primary" type="button" onClick={reload}>Try again</button></div>
        ) : goals.length ? (
          <div className="savings-goal-grid">{goals.map((goal) => {
            const current = goal.oma_currentamount ?? 0
            const target = goal.oma_targetamount ?? 0
            const percentage = target > 0 ? Math.min(current / target * 100, 100) : 0
            const contributions = getGoalContributions(goal, data?.contributions ?? [])
            const status = current >= target && target > 0 ? 2 : goal.oma_status ?? 1
            const achieved = status === 2
            const remaining = Math.max(target - current, 0)
            return <article className={`savings-goal-card${achieved ? ' savings-goal-achieved' : ''}`} key={goal.oma_savingsgoalid}>
              <header className="savings-goal-card-heading">
                <span className="savings-goal-icon" aria-hidden="true">{achieved ? '✓' : '◎'}</span>
                <div className="savings-goal-title"><h3>{goal.oma_goalname || 'Savings goal'}</h3><span className={`savings-goal-status savings-goal-status-${status}`}>{statusLabel(status)}</span></div>
                <div className="savings-goal-actions">
                  <button type="button" onClick={() => openGoalForm(goal)} aria-label={`Edit ${goal.oma_goalname || 'savings goal'}`}>Edit</button>
                  <button className="savings-goal-delete" type="button" onClick={() => { setDeletingGoal(goal); setDeleteError('') }} aria-label={`Delete ${goal.oma_goalname || 'savings goal'}`}>Delete</button>
                </div>
              </header>
              <div className="savings-goal-balance"><strong>{formatAmount(current)}</strong><span>of {formatAmount(target)}</span></div>
              <div className="savings-goal-progress" role="progressbar" aria-label={`${goal.oma_goalname || 'Savings goal'} progress`} aria-valuenow={Math.round(percentage)} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${percentage}%` }} />
              </div>
              <div className="savings-goal-meta"><span>{achieved ? 'Target reached' : `${formatAmount(remaining)} left to save`}</span><span>{Math.round(percentage)}%</span></div>
              <div className="savings-goal-footer">
                <span>Target date · {formatDate(goal.oma_targetdate)}</span>
                <button type="button" disabled={status !== 1} onClick={() => openContributionForm(goal)}>{status === 1 ? '+ Add contribution' : statusLabel(status)}</button>
              </div>
              {goal.oma_notes && <p className="savings-goal-notes">{goal.oma_notes}</p>}
              <details className="savings-contribution-history">
                <summary>Contribution history <span>{contributions.length}</span></summary>
                {contributions.length ? <ul>{contributions.map((contribution) => (
                  <li key={contribution.oma_savingscontributionid}>
                    <span><strong>{contribution.oma_contributionname || 'Contribution'}</strong><small>{formatDate(contribution.oma_contributiondate)}{contribution.oma_notes ? ` · ${contribution.oma_notes}` : ''}</small></span>
                    <strong>{formatAmount(contribution.oma_amount ?? 0)}</strong>
                  </li>
                ))}</ul> : <p>No contributions recorded yet.</p>}
              </details>
            </article>
          })}</div>
        ) : (
          <div className="savings-goals-empty">
            <span className="savings-goals-empty-icon" aria-hidden="true">◎</span>
            <h3>Start saving for something that matters</h3>
            <p>Create your first goal, then record contributions to watch your progress grow.</p>
            <button className="button-primary" type="button" onClick={() => openGoalForm(null)}>Create a savings goal</button>
          </div>
        )}
      </section>

      {goalFormOpen && <div className="savings-goals-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingGoal) setGoalFormOpen(false) }}>
        <section className="savings-goals-dialog" role="dialog" aria-modal="true" aria-labelledby="savings-goal-dialog-title">
          <header className="savings-goals-dialog-heading">
            <div><p className="eyebrow">SAVINGS PLAN</p><h2 id="savings-goal-dialog-title">{editingGoal ? 'Edit savings goal' : 'Create a savings goal'}</h2></div>
            <button type="button" className="profile-dialog-close" aria-label="Close savings goal form" disabled={savingGoal} onClick={() => setGoalFormOpen(false)}>×</button>
          </header>
          <form className="savings-goals-form" onSubmit={saveGoal} noValidate>
            <label>Goal name
              <input value={goalFormValues.name} onChange={(event) => setGoalFormValues((current) => ({ ...current, name: event.target.value }))} maxLength={200} required autoFocus />
            </label>
            <div className="savings-goals-form-grid">
              <label>Current amount
                <input type="number" value={goalFormValues.currentAmount} onChange={(event) => setGoalFormValues((current) => ({ ...current, currentAmount: event.target.value }))} min="0" step="0.01" required />
              </label>
              <label>Target amount
                <input type="number" value={goalFormValues.targetAmount} onChange={(event) => setGoalFormValues((current) => ({ ...current, targetAmount: event.target.value }))} min="0.01" step="0.01" required />
              </label>
            </div>
            <div className="savings-goals-form-grid">
              <label>Target date <span>Optional</span>
                <input type="date" value={goalFormValues.targetDate} onChange={(event) => setGoalFormValues((current) => ({ ...current, targetDate: event.target.value }))} />
              </label>
              <label>Status
                <select value={goalFormValues.status} onChange={(event) => setGoalFormValues((current) => ({ ...current, status: event.target.value }))}>
                  {goalStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </label>
            </div>
            <label>Notes <span>Optional</span>
              <textarea value={goalFormValues.notes} onChange={(event) => setGoalFormValues((current) => ({ ...current, notes: event.target.value }))} maxLength={200} rows={3} />
            </label>
            {goalFormError && <p className="savings-goals-form-error" role="alert">{goalFormError}</p>}
            <footer className="savings-goals-form-actions">
              {editingGoal && <button className="savings-goal-delete-button" type="button" disabled={savingGoal} onClick={() => { setDeletingGoal(editingGoal); setDeleteError(''); setGoalFormOpen(false) }}>Delete goal</button>}
              <button type="button" className="button-secondary" disabled={savingGoal} onClick={() => setGoalFormOpen(false)}>Cancel</button>
              <button type="submit" className="button-primary" disabled={savingGoal}>{savingGoal ? 'Saving…' : editingGoal ? 'Save changes' : 'Create goal'}</button>
            </footer>
          </form>
        </section>
      </div>}

      {contributingGoal && <div className="savings-goals-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingContribution) setContributingGoal(null) }}>
        <section className="savings-goals-dialog" role="dialog" aria-modal="true" aria-labelledby="savings-contribution-dialog-title">
          <header className="savings-goals-dialog-heading">
            <div><p className="eyebrow">ADD TO YOUR PROGRESS</p><h2 id="savings-contribution-dialog-title">Add a contribution</h2></div>
            <button type="button" className="profile-dialog-close" aria-label="Close contribution form" disabled={savingContribution} onClick={() => setContributingGoal(null)}>×</button>
          </header>
          <form className="savings-goals-form" onSubmit={saveContribution} noValidate>
            <p className="savings-contribution-target">Adding to <strong>{contributingGoal.oma_goalname || 'Savings goal'}</strong>. Your goal balance updates when this contribution is saved.</p>
            <label>Contribution amount
              <input type="number" value={contributionValues.amount} onChange={(event) => setContributionValues((current) => ({ ...current, amount: event.target.value }))} min="0.01" step="0.01" required autoFocus />
            </label>
            <label>Contribution date
              <input type="date" value={contributionValues.date} onChange={(event) => setContributionValues((current) => ({ ...current, date: event.target.value }))} required />
            </label>
            <label>Notes <span>Optional</span>
              <textarea value={contributionValues.notes} onChange={(event) => setContributionValues((current) => ({ ...current, notes: event.target.value }))} maxLength={2000} rows={3} />
            </label>
            {contributionError && <p className="savings-goals-form-error" role="alert">{contributionError}</p>}
            <footer className="savings-goals-form-actions">
              <button type="button" className="button-secondary" disabled={savingContribution} onClick={() => setContributingGoal(null)}>Cancel</button>
              <button type="submit" className="button-primary" disabled={savingContribution}>{savingContribution ? 'Saving…' : 'Record contribution'}</button>
            </footer>
          </form>
        </section>
      </div>}

      {deletingGoal && <div className="savings-goals-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeletingGoal(null) }}>
        <section className="savings-goals-dialog savings-goals-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="savings-goal-delete-title">
          <header className="savings-goals-dialog-heading">
            <div><p className="eyebrow">DELETE SAVINGS GOAL</p><h2 id="savings-goal-delete-title">Delete “{deletingGoal.oma_goalname || 'Savings goal'}”?</h2></div>
            <button type="button" className="profile-dialog-close" aria-label="Close delete confirmation" disabled={deleting} onClick={() => setDeletingGoal(null)}>×</button>
          </header>
          <div className="savings-goals-delete-content">
            <p>This permanently deletes the goal. Dataverse may also remove or restrict its linked contribution records.</p>
            {deleteError && <p className="savings-goals-form-error" role="alert">{deleteError}</p>}
            <footer className="savings-goals-form-actions">
              <button type="button" className="button-secondary" disabled={deleting} onClick={() => setDeletingGoal(null)}>Keep goal</button>
              <button type="button" className="savings-goals-confirm-delete" disabled={deleting} onClick={deleteGoal}>{deleting ? 'Deleting…' : 'Delete goal'}</button>
            </footer>
          </div>
        </section>
      </div>}
    </div>
  )
}
