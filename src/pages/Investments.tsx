import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Investment, InvestmentTransaction } from '../models'
import { investmentsService } from '../services/investmentsService'
import type { InvestmentActivityInput, InvestmentInput, InvestmentsPageData } from '../services/investmentsService'

interface InvestmentsProps {
  profileId: string
}

interface InvestmentFormValues {
  name: string
  assetType: string
  ticker: string
  quantity: string
  purchasePrice: string
  currentPrice: string
  purchaseDate: string
  accountId: string
}

interface ActivityFormValues {
  type: string
  date: string
  quantity: string
  pricePerUnit: string
  fees: string
  notes: string
}

const assetTypes = [
  { value: 1, label: 'Stock' },
  { value: 2, label: 'Mutual Fund' },
  { value: 3, label: 'Fixed Deposit' },
  { value: 4, label: 'Bond' },
  { value: 5, label: 'Crypto' },
  { value: 6, label: 'Real Estate' },
  { value: 7, label: 'Gold' },
]

const transactionTypes = [
  { value: 1, label: 'Buy' },
  { value: 2, label: 'Sell' },
  { value: 3, label: 'Dividend' },
  { value: 4, label: 'Split' },
  { value: 5, label: 'Bonus' },
]

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message
  return 'An unexpected error occurred while loading investments.'
}

function cleanId(id: string | undefined) {
  return id?.replace(/[{}]/g, '').toLocaleLowerCase() ?? ''
}

function formatAmount(value: number) {
  const amount = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value))
  return value < 0 ? `-$${amount}` : `$${amount}`
}

function formatSignedAmount(value: number) {
  return value > 0 ? `+${formatAmount(value)}` : formatAmount(value)
}

function todayInputValue() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateInputValue(value: string | undefined) {
  if (!value) return ''
  const datePart = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : ''
}

function dateTimeValue(value: string) {
  return value ? `${value}T12:00:00.000Z` : null
}

function formatDate(value: string | undefined) {
  if (!value) return 'Date not set'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Date not set'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

function parseNumber(value: string, label: string, allowZero: boolean, max: number) {
  if (!value.trim()) throw new Error(`Enter ${label.toLowerCase()}.`)
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || (!allowZero && number === 0) || number > max) {
    throw new Error(`Enter ${label.toLowerCase()} ${allowZero ? 'of 0 or greater' : 'greater than 0'}.`)
  }
  return number
}

function parseCurrency(value: string, label: string, allowZero: boolean) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    throw new Error(`Enter ${label.toLowerCase()} with no more than 2 decimal places.`)
  }
  return parseNumber(value, label, allowZero, 922337203685477)
}

function getInvestmentFormValues(investment: Investment | null): InvestmentFormValues {
  return {
    name: investment?.oma_investmentname ?? '',
    assetType: String(investment?.oma_assettype ?? ''),
    ticker: investment?.oma_tickersymbol ?? '',
    quantity: String(investment?.oma_quantity ?? 0),
    purchasePrice: String(investment?.oma_purchaseprice ?? 0),
    currentPrice: String(investment?.oma_currentprice ?? 0),
    purchaseDate: dateInputValue(investment?.oma_purchasedate),
    accountId: cleanId(investment?._oma_financialaccount_value),
  }
}

function getActivityFormValues(): ActivityFormValues {
  return { type: '1', date: todayInputValue(), quantity: '', pricePerUnit: '', fees: '0', notes: '' }
}

function investmentTypeLabel(value: number | undefined) {
  return assetTypes.find((type) => type.value === value)?.label ?? 'Investment'
}

function activityTypeLabel(value: number | undefined) {
  return transactionTypes.find((type) => type.value === value)?.label ?? 'Activity'
}

function investmentTransactions(investment: Investment, transactions: InvestmentTransaction[]) {
  const id = cleanId(investment.oma_investmentid)
  return transactions.filter((transaction) => cleanId(transaction._oma_investment_value) === id)
}

function toInvestmentInput(values: InvestmentFormValues, profileId: string): InvestmentInput {
  const name = values.name.trim()
  if (!name) throw new Error('Enter an investment name.')
  if (name.length > 200) throw new Error('Investment name must be 200 characters or fewer.')
  if (values.ticker.trim().length > 20) throw new Error('Ticker symbol must be 20 characters or fewer.')
  const assetType = Number(values.assetType)
  if (!assetTypes.some((type) => type.value === assetType)) throw new Error('Select an asset type.')
  const quantity = parseNumber(values.quantity, 'quantity', true, 100000000000)
  const purchasePrice = parseCurrency(values.purchasePrice, 'purchase price', true)
  const currentPrice = parseCurrency(values.currentPrice, 'current price', true)
  const profile = cleanId(profileId)
  if (!profile) throw new Error('Select a finance profile before saving this investment.')
  if (values.accountId && !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(cleanId(values.accountId))) {
    throw new Error('Select a valid financial account.')
  }
  const investedAmount = quantity * purchasePrice
  const currentValue = quantity * currentPrice
  if (!Number.isFinite(investedAmount) || investedAmount > 922337203685477) throw new Error('The invested amount exceeds the supported limit.')
  if (!Number.isFinite(currentValue) || currentValue > 922337203685477) throw new Error('The current value exceeds the supported limit.')

  return {
    oma_investmentname: name,
    oma_assettype: assetType,
    oma_tickersymbol: values.ticker.trim() || null,
    oma_quantity: quantity,
    oma_purchaseprice: purchasePrice,
    oma_currentprice: currentPrice,
    oma_investedamount: investedAmount,
    oma_currentvalue: currentValue,
    oma_purchasedate: dateTimeValue(values.purchaseDate),
    _oma_financialaccount_value: values.accountId ? cleanId(values.accountId) : null,
    _oma_userprofile_value: profile,
  }
}

export function Investments({ profileId }: InvestmentsProps) {
  const [data, setData] = useState<InvestmentsPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null)
  const [investmentFormOpen, setInvestmentFormOpen] = useState(false)
  const [investmentValues, setInvestmentValues] = useState<InvestmentFormValues>(() => getInvestmentFormValues(null))
  const [investmentError, setInvestmentError] = useState('')
  const [savingInvestment, setSavingInvestment] = useState(false)
  const [activityInvestment, setActivityInvestment] = useState<Investment | null>(null)
  const [activityValues, setActivityValues] = useState<ActivityFormValues>(() => getActivityFormValues())
  const [activityError, setActivityError] = useState('')
  const [savingActivity, setSavingActivity] = useState(false)
  const [deletingInvestment, setDeletingInvestment] = useState<Investment | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    investmentsService.list(profileId).then((result) => {
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

  const investments = useMemo(() => [...(data?.investments ?? [])].sort((first, second) => (
    (first.oma_investmentname ?? '').localeCompare(second.oma_investmentname ?? '')
  )), [data])
  const totalValue = investments.reduce((sum, investment) => sum + (investment.oma_currentvalue ?? 0), 0)
  const totalInvested = investments.reduce((sum, investment) => sum + (investment.oma_investedamount ?? 0), 0)
  const gainLoss = totalValue - totalInvested
  const transactions = data?.transactions ?? []

  function reload() {
    setLoading(true)
    setError('')
    setNotice('')
    setReloadKey((key) => key + 1)
  }

  function openInvestmentForm(investment: Investment | null) {
    setEditingInvestment(investment)
    setInvestmentValues(getInvestmentFormValues(investment))
    setInvestmentError('')
    setInvestmentFormOpen(true)
  }

  async function saveInvestment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setInvestmentError('')
    let input: InvestmentInput
    try {
      input = toInvestmentInput(investmentValues, profileId)
    } catch (validationError) {
      setInvestmentError(errorMessage(validationError))
      return
    }
    setSavingInvestment(true)
    try {
      if (editingInvestment?.oma_investmentid) {
        await investmentsService.update(editingInvestment.oma_investmentid, input)
      } else {
        await investmentsService.create(input)
      }
      setInvestmentFormOpen(false)
      setNotice(editingInvestment ? 'Investment updated.' : 'Investment added.')
      setLoading(true)
      setReloadKey((key) => key + 1)
    } catch (saveError) {
      setInvestmentError(errorMessage(saveError))
    } finally {
      setSavingInvestment(false)
    }
  }

  function openActivityForm(investment: Investment) {
    setActivityInvestment(investment)
    setActivityValues(getActivityFormValues())
    setActivityError('')
  }

  async function saveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activityInvestment) return
    setActivityError('')
    let quantity: number
    let pricePerUnit: number
    let fees: number
    const type = Number(activityValues.type)
    try {
      if (!transactionTypes.some((transactionType) => transactionType.value === type)) throw new Error('Select an activity type.')
      if (!activityValues.date) throw new Error('Select an activity date.')
      if (activityValues.notes.length > 2000) throw new Error('Notes must be 2,000 characters or fewer.')
      quantity = parseNumber(activityValues.quantity, 'quantity', false, 100000000000)
      pricePerUnit = parseCurrency(activityValues.pricePerUnit, 'price per unit', true)
      fees = parseCurrency(activityValues.fees, 'fees', true)
    } catch (validationError) {
      setActivityError(errorMessage(validationError))
      return
    }

    const gross = quantity * pricePerUnit
    if (!Number.isFinite(gross) || gross > 922337203685477) {
      setActivityError('The activity amount exceeds the supported limit.')
      return
    }
    if (type === 2 && fees > gross) {
      setActivityError('Fees cannot exceed the gross proceeds for a sale.')
      return
    }
    const investmentId = cleanId(activityInvestment.oma_investmentid)
    const currentQuantity = activityInvestment.oma_quantity ?? 0
    const currentInvested = activityInvestment.oma_investedamount ?? 0
    let holdingChanges: Pick<Investment, 'oma_quantity' | 'oma_purchaseprice' | 'oma_currentprice' | 'oma_investedamount' | 'oma_currentvalue' | 'oma_purchasedate'> | null = null
    let totalAmount = gross

    if (type === 1) {
      const newQuantity = currentQuantity + quantity
      const newInvestedAmount = currentInvested + gross + fees
      const newCurrentValue = newQuantity * pricePerUnit
      if (newQuantity > 100000000000 || newInvestedAmount > 922337203685477 || newCurrentValue > 922337203685477) {
        setActivityError('This purchase would exceed the supported holding limits.')
        return
      }
      totalAmount = gross + fees
      holdingChanges = {
        oma_quantity: newQuantity,
        oma_purchaseprice: newQuantity > 0 ? newInvestedAmount / newQuantity : 0,
        oma_currentprice: pricePerUnit,
        oma_investedamount: newInvestedAmount,
        oma_currentvalue: newCurrentValue,
        oma_purchasedate: activityInvestment.oma_purchasedate ?? dateTimeValue(activityValues.date) ?? undefined,
      }
    } else if (type === 2) {
      if (quantity > currentQuantity) {
        setActivityError('You cannot sell more units than this holding currently contains.')
        return
      }
      const newQuantity = currentQuantity - quantity
      const newInvestedAmount = currentQuantity > 0 ? currentInvested * (newQuantity / currentQuantity) : 0
      const newCurrentValue = newQuantity * pricePerUnit
      if (newCurrentValue > 922337203685477) {
        setActivityError('This sale would exceed the supported holding limit.')
        return
      }
      totalAmount = gross - fees
      holdingChanges = {
        oma_quantity: newQuantity,
        oma_purchaseprice: newQuantity > 0 ? newInvestedAmount / newQuantity : 0,
        oma_currentprice: pricePerUnit,
        oma_investedamount: newInvestedAmount,
        oma_currentvalue: newCurrentValue,
        oma_purchasedate: activityInvestment.oma_purchasedate,
      }
    } else {
      totalAmount = type === 3 ? gross - fees : gross + fees
      if (totalAmount < 0) {
        setActivityError('Fees cannot exceed the dividend amount.')
        return
      }
    }

    const typeLabel = activityTypeLabel(type)
    const investmentName = activityInvestment.oma_investmentname || 'Investment'
    const suffix = ` - ${activityValues.date}`
    const activity: Omit<InvestmentActivityInput, '_oma_investment_value' | '_oma_userprofile_value'> = {
      oma_transactionname: `${investmentName.slice(0, 200 - typeLabel.length - suffix.length - 1)} ${typeLabel}${suffix}`,
      oma_transactiontype: type,
      oma_transactiondate: dateTimeValue(activityValues.date) ?? '',
      oma_quantity: quantity,
      oma_priceperunit: pricePerUnit,
      oma_fees: fees,
      oma_totalamount: totalAmount,
      oma_notes: activityValues.notes.trim() || null,
    }
    if (!investmentId) {
      setActivityError('The selected investment is missing its Dataverse ID.')
      return
    }

    setSavingActivity(true)
    try {
      await investmentsService.recordActivity(activityInvestment, profileId, activity, holdingChanges)
      setActivityInvestment(null)
      setNotice(type === 1 || type === 2
        ? `${typeLabel} recorded and holding updated.`
        : `${typeLabel} activity recorded. Holdings were not recalculated.`)
      setLoading(true)
      setReloadKey((key) => key + 1)
    } catch (saveError) {
      setActivityError(errorMessage(saveError))
    } finally {
      setSavingActivity(false)
    }
  }

  async function deleteInvestment() {
    if (!deletingInvestment?.oma_investmentid) return
    setDeleting(true)
    setDeleteError('')
    try {
      await investmentsService.delete(deletingInvestment.oma_investmentid)
      setDeletingInvestment(null)
      setNotice('Investment deleted.')
      setLoading(true)
      setReloadKey((key) => key + 1)
    } catch (operationError) {
      setDeleteError(errorMessage(operationError))
    } finally {
      setDeleting(false)
    }
  }

  function accountName(accountId: string | undefined) {
    const normalizedId = cleanId(accountId)
    return data?.accounts.find((account) => cleanId(account.oma_financialaccountid) === normalizedId)?.oma_accountname ?? ''
  }

  return (
    <div className="investments-page">
      <section className="investments-heading">
        <div>
          <p className="eyebrow">GROW YOUR PORTFOLIO</p>
          <h1>Investments</h1>
          <p className="investments-subtitle">Track your holdings, performance, and investment activity.</p>
        </div>
        <div className="investments-heading-actions">
          <button className="button-secondary" type="button" onClick={reload} disabled={loading}>Refresh</button>
          <button className="button-primary" type="button" onClick={() => openInvestmentForm(null)}>+ Add investment</button>
        </div>
      </section>

      {notice && <p className="investments-notice" role="status">{notice}</p>}

      {data && <section className="investments-summary" aria-label="Portfolio summary">
        <article><span>Current value</span><strong>{formatAmount(totalValue)}</strong><small>Across {investments.length} {investments.length === 1 ? 'holding' : 'holdings'}</small></article>
        <article><span>Amount invested</span><strong>{formatAmount(totalInvested)}</strong><small>Total recorded cost basis</small></article>
        <article><span>Unrealized gain / loss</span><strong className={gainLoss >= 0 ? 'investment-positive' : 'investment-negative'}>{formatSignedAmount(gainLoss)}</strong><small>Current value minus invested amount</small></article>
      </section>}

      <section className="investments-panel" aria-label="Investment holdings">
        <header className="investments-list-heading"><div><h2>Your portfolio</h2><p>Holdings and their current performance.</p></div></header>
        {loading ? (
          <div className="investments-state" aria-live="polite"><span className="spinner" /><p>Loading investments…</p></div>
        ) : error ? (
          <div className="investments-state investments-error" role="alert"><p>{error}</p><button className="button-primary" type="button" onClick={reload}>Try again</button></div>
        ) : investments.length ? (
          <div className="investment-grid">{investments.map((investment) => {
            const invested = investment.oma_investedamount ?? 0
            const value = investment.oma_currentvalue ?? 0
            const returnValue = value - invested
            const returnPercent = invested > 0 ? returnValue / invested * 100 : 0
            const activities = investmentTransactions(investment, transactions)
            return <article className="investment-card" key={investment.oma_investmentid}>
              <header className="investment-card-heading">
                <span className="investment-asset-icon" aria-hidden="true">{investmentTypeLabel(investment.oma_assettype).slice(0, 1)}</span>
                <div className="investment-card-title">
                  <h3>{investment.oma_investmentname || 'Investment'}</h3>
                  <span>{investmentTypeLabel(investment.oma_assettype)}{investment.oma_tickersymbol ? ` · ${investment.oma_tickersymbol}` : ''}</span>
                </div>
                <div className="investment-card-actions">
                  <button type="button" onClick={() => openInvestmentForm(investment)} aria-label={`Edit ${investment.oma_investmentname || 'investment'}`}>Edit</button>
                  <button className="investment-delete" type="button" onClick={() => { setDeletingInvestment(investment); setDeleteError('') }} aria-label={`Delete ${investment.oma_investmentname || 'investment'}`}>Delete</button>
                </div>
              </header>
              <div className="investment-card-value"><strong>{formatAmount(value)}</strong><span>Current value</span></div>
              <div className="investment-card-stats">
                <span>Units <strong>{new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(investment.oma_quantity ?? 0)}</strong></span>
                <span>Current price <strong>{formatAmount(investment.oma_currentprice ?? 0)}</strong></span>
                <span>Invested <strong>{formatAmount(invested)}</strong></span>
              </div>
              <div className={`investment-return${returnValue >= 0 ? ' investment-positive' : ' investment-negative'}`}>
                <strong>{formatSignedAmount(returnValue)}</strong><span>{returnPercent > 0 ? '+' : ''}{returnPercent.toFixed(2)}% return</span>
              </div>
              <div className="investment-card-meta">
                <span>{accountName(investment._oma_financialaccount_value) || `Purchased ${formatDate(investment.oma_purchasedate)}`}</span>
                <button type="button" onClick={() => openActivityForm(investment)}>+ Add activity</button>
              </div>
              <details className="investment-activity-history">
                <summary>Activity history <span>{activities.length}</span></summary>
                {activities.length ? <ul>{activities.map((activity) => (
                  <li key={activity.oma_investmenttransactionid}>
                    <span><strong>{activity.oma_transactionname || activityTypeLabel(activity.oma_transactiontype)}</strong><small>{formatDate(activity.oma_transactiondate)} · {activityTypeLabel(activity.oma_transactiontype)} · {activity.oma_quantity ?? 0} units</small></span>
                    <strong>{formatAmount(activity.oma_totalamount ?? 0)}</strong>
                  </li>
                ))}</ul> : <p>No activity recorded yet.</p>}
              </details>
            </article>
          })}</div>
        ) : (
          <div className="investments-empty">
            <span className="investments-empty-icon" aria-hidden="true">↗</span>
            <h3>Your portfolio starts here</h3>
            <p>Add an investment to track its units, value, and performance over time.</p>
            <button className="button-primary" type="button" onClick={() => openInvestmentForm(null)}>Add your first investment</button>
          </div>
        )}
      </section>

      {investmentFormOpen && <div className="investments-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingInvestment) setInvestmentFormOpen(false) }}>
        <section className="investments-dialog" role="dialog" aria-modal="true" aria-labelledby="investment-dialog-title">
          <header className="investments-dialog-heading">
            <div><p className="eyebrow">PORTFOLIO HOLDING</p><h2 id="investment-dialog-title">{editingInvestment ? 'Edit investment' : 'Add an investment'}</h2></div>
            <button type="button" className="profile-dialog-close" aria-label="Close investment form" disabled={savingInvestment} onClick={() => setInvestmentFormOpen(false)}>×</button>
          </header>
          <form className="investments-form" onSubmit={saveInvestment} noValidate>
            <label>Investment name
              <input value={investmentValues.name} onChange={(event) => setInvestmentValues((current) => ({ ...current, name: event.target.value }))} maxLength={200} required autoFocus />
            </label>
            <div className="investments-form-grid">
              <label>Asset type
                <select value={investmentValues.assetType} onChange={(event) => setInvestmentValues((current) => ({ ...current, assetType: event.target.value }))} required>
                  <option value="">Select asset type</option>
                  {assetTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </label>
              <label>Ticker symbol <span>Optional</span>
                <input value={investmentValues.ticker} onChange={(event) => setInvestmentValues((current) => ({ ...current, ticker: event.target.value }))} maxLength={20} />
              </label>
            </div>
            <div className="investments-form-grid">
              <label>Units
                <input type="number" value={investmentValues.quantity} onChange={(event) => setInvestmentValues((current) => ({ ...current, quantity: event.target.value }))} min="0" max="100000000000" step="any" required />
              </label>
              <label>Purchase price per unit
                <input type="number" value={investmentValues.purchasePrice} onChange={(event) => setInvestmentValues((current) => ({ ...current, purchasePrice: event.target.value }))} min="0" step="0.01" required />
              </label>
            </div>
            <div className="investments-form-grid">
              <label>Current price per unit
                <input type="number" value={investmentValues.currentPrice} onChange={(event) => setInvestmentValues((current) => ({ ...current, currentPrice: event.target.value }))} min="0" step="0.01" required />
              </label>
              <label>Purchase date <span>Optional</span>
                <input type="date" value={investmentValues.purchaseDate} onChange={(event) => setInvestmentValues((current) => ({ ...current, purchaseDate: event.target.value }))} />
              </label>
            </div>
            <label>Financial account <span>Optional</span>
              <select value={investmentValues.accountId} onChange={(event) => setInvestmentValues((current) => ({ ...current, accountId: event.target.value }))}>
                <option value="">No account linked</option>
                {(data?.accounts ?? []).map((account) => <option key={account.oma_financialaccountid} value={cleanId(account.oma_financialaccountid)}>{account.oma_accountname || 'Financial account'}</option>)}
              </select>
            </label>
            <p className="investment-form-hint">Invested amount and current value are calculated from units and their respective prices.</p>
            {investmentError && <p className="investments-form-error" role="alert">{investmentError}</p>}
            <footer className="investments-form-actions">
              {editingInvestment && <button className="investment-delete-button" type="button" disabled={savingInvestment} onClick={() => { setDeletingInvestment(editingInvestment); setDeleteError(''); setInvestmentFormOpen(false) }}>Delete investment</button>}
              <button type="button" className="button-secondary" disabled={savingInvestment} onClick={() => setInvestmentFormOpen(false)}>Cancel</button>
              <button type="submit" className="button-primary" disabled={savingInvestment}>{savingInvestment ? 'Saving…' : editingInvestment ? 'Save changes' : 'Add investment'}</button>
            </footer>
          </form>
        </section>
      </div>}

      {activityInvestment && <div className="investments-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingActivity) setActivityInvestment(null) }}>
        <section className="investments-dialog" role="dialog" aria-modal="true" aria-labelledby="investment-activity-title">
          <header className="investments-dialog-heading">
            <div><p className="eyebrow">PORTFOLIO ACTIVITY</p><h2 id="investment-activity-title">Add activity</h2></div>
            <button type="button" className="profile-dialog-close" aria-label="Close activity form" disabled={savingActivity} onClick={() => setActivityInvestment(null)}>×</button>
          </header>
          <form className="investments-form" onSubmit={saveActivity} noValidate>
            <p className="investment-activity-description">Record activity for <strong>{activityInvestment.oma_investmentname || 'Investment'}</strong>. Buys and sells update units and holding values; other activity types are recorded without recalculating the holding.</p>
            <div className="investments-form-grid">
              <label>Activity type
                <select value={activityValues.type} onChange={(event) => setActivityValues((current) => ({ ...current, type: event.target.value }))}>
                  {transactionTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
              </label>
              <label>Date
                <input type="date" value={activityValues.date} onChange={(event) => setActivityValues((current) => ({ ...current, date: event.target.value }))} required />
              </label>
            </div>
            <div className="investments-form-grid">
              <label>Units
                <input type="number" value={activityValues.quantity} onChange={(event) => setActivityValues((current) => ({ ...current, quantity: event.target.value }))} min="0.000001" step="any" required />
              </label>
              <label>Price per unit
                <input type="number" value={activityValues.pricePerUnit} onChange={(event) => setActivityValues((current) => ({ ...current, pricePerUnit: event.target.value }))} min="0" step="0.01" required />
              </label>
            </div>
            <label>Fees
              <input type="number" value={activityValues.fees} onChange={(event) => setActivityValues((current) => ({ ...current, fees: event.target.value }))} min="0" step="0.01" required />
            </label>
            <label>Notes <span>Optional</span>
              <textarea value={activityValues.notes} onChange={(event) => setActivityValues((current) => ({ ...current, notes: event.target.value }))} maxLength={2000} rows={3} />
            </label>
            {activityError && <p className="investments-form-error" role="alert">{activityError}</p>}
            <footer className="investments-form-actions">
              <button type="button" className="button-secondary" disabled={savingActivity} onClick={() => setActivityInvestment(null)}>Cancel</button>
              <button type="submit" className="button-primary" disabled={savingActivity}>{savingActivity ? 'Saving…' : 'Record activity'}</button>
            </footer>
          </form>
        </section>
      </div>}

      {deletingInvestment && <div className="investments-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeletingInvestment(null) }}>
        <section className="investments-dialog investments-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="investment-delete-title">
          <header className="investments-dialog-heading">
            <div><p className="eyebrow">DELETE HOLDING</p><h2 id="investment-delete-title">Delete “{deletingInvestment.oma_investmentname || 'Investment'}”?</h2></div>
            <button type="button" className="profile-dialog-close" aria-label="Close delete confirmation" disabled={deleting} onClick={() => setDeletingInvestment(null)}>×</button>
          </header>
          <div className="investments-delete-content">
            <p>This permanently deletes the holding. If Dataverse has related activity records, it may reject the deletion.</p>
            {deleteError && <p className="investments-form-error" role="alert">{deleteError}</p>}
            <footer className="investments-form-actions">
              <button type="button" className="button-secondary" disabled={deleting} onClick={() => setDeletingInvestment(null)}>Keep investment</button>
              <button type="button" className="investments-confirm-delete" disabled={deleting} onClick={deleteInvestment}>{deleting ? 'Deleting…' : 'Delete investment'}</button>
            </footer>
          </div>
        </section>
      </div>}
    </div>
  )
}
