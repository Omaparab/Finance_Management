import { useEffect, useMemo, useState } from 'react'
import type { Category, Investment, Transaction } from '../models'
import { reportsService } from '../services/reportsService'
import type { ReportsData } from '../services/reportsService'

interface ReportsProps {
  profileId: string
}

interface CashFlowBucket {
  label: string
  income: number
  expenses: number
}

interface CategorySpend {
  id: string
  name: string
  amount: number
  count: number
}

interface BudgetReportRow {
  id: string
  name: string
  budgeted: number
  spent: number
}

interface InvestmentTypeSummary {
  type: number | undefined
  name: string
  value: number
  invested: number
  count: number
}

interface DonutItem {
  id: string
  label: string
  value: number
  color: string
  detail: string
}

interface DonutChartProps {
  items: DonutItem[]
  total: number
  centerValue: string
  centerLabel: string
  ariaLabel: string
}

const assetTypeNames: Record<number, string> = {
  1: 'Stock',
  2: 'Mutual Fund',
  3: 'Fixed Deposit',
  4: 'Bond',
  5: 'Crypto',
  6: 'Real Estate',
  7: 'Gold',
}

const chartColors = ['#7166d8', '#4f9b76', '#d38a54', '#4b8bc7', '#c36b92', '#8a70b7', '#6b9b9b']
const emptyTransactions: Transaction[] = []
const emptyCategories: Category[] = []

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message
  return 'An unexpected error occurred while loading reports.'
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

function formatPercent(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function monthInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthTitle(date: Date) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date)
}

function transactionDate(value: string | undefined) {
  if (!value) return null
  const datePart = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (datePart) {
    const year = Number(datePart[1])
    const month = Number(datePart[2])
    const day = Number(datePart[3])
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return new Date(year, month - 1, day)
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function categoryName(categories: Category[], id: string | undefined) {
  const normalized = cleanId(id)
  return categories.find((category) => cleanId(category.oma_categoryid) === normalized)?.oma_categoryname || 'Uncategorized'
}

function buildCashFlow(transactions: Transaction[]) {
  const buckets: CashFlowBucket[] = Array.from({ length: 5 }, (_, index) => ({
    label: `${index * 7 + 1}–${index === 4 ? 31 : (index + 1) * 7}`,
    income: 0,
    expenses: 0,
  }))
  transactions.forEach((transaction) => {
    const date = transactionDate(transaction.oma_transactiondate)
    if (!date) return
    const bucket = buckets[Math.min(Math.floor((date.getDate() - 1) / 7), buckets.length - 1)]
    const amount = transaction.oma_amount ?? 0
    if (transaction.oma_transactiontype === 1) bucket.income += amount
    if (transaction.oma_transactiontype === 2) bucket.expenses += amount
  })
  return buckets
}

function buildCategorySpending(transactions: Transaction[], categories: Category[]) {
  const spending = new Map<string, CategorySpend>()
  transactions.forEach((transaction) => {
    if (transaction.oma_transactiontype !== 2) return
    const id = cleanId(transaction._oma_category_value) || 'uncategorized'
    const row = spending.get(id) ?? {
      id,
      name: categoryName(categories, transaction._oma_category_value),
      amount: 0,
      count: 0,
    }
    row.amount += transaction.oma_amount ?? 0
    row.count += 1
    spending.set(id, row)
  })
  return [...spending.values()].sort((first, second) => second.amount - first.amount)
}

function buildBudgetRows(
  budgets: ReportsData['budgets'],
  categories: Category[],
  categorySpending: CategorySpend[],
) {
  const spendingByCategory = new Map(categorySpending.map((row) => [row.id, row.amount]))
  return budgets.map((budget): BudgetReportRow => {
    const id = cleanId(budget._oma_category_value) || 'uncategorized'
    return {
      id: budget.oma_budgetid ?? id,
      name: categoryName(categories, budget._oma_category_value),
      budgeted: budget.oma_budgetamount ?? 0,
      spent: spendingByCategory.get(id) ?? 0,
    }
  }).sort((first, second) => second.spent - second.budgeted - (first.spent - first.budgeted))
}

function buildInvestmentSummary(investments: Investment[]) {
  const groups = new Map<number | undefined, InvestmentTypeSummary>()
  investments.forEach((investment) => {
    const type = investment.oma_assettype
    const row = groups.get(type) ?? {
      type,
      name: type === undefined ? 'Other' : assetTypeNames[type] ?? 'Other',
      value: 0,
      invested: 0,
      count: 0,
    }
    row.value += investment.oma_currentvalue ?? 0
    row.invested += investment.oma_investedamount ?? 0
    row.count += 1
    groups.set(type, row)
  })
  return [...groups.values()].sort((first, second) => second.value - first.value)
}

function safeCsvText(value: string) {
  return /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value
}

function csvCell(value: string | number) {
  const text = typeof value === 'string' ? safeCsvText(value) : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}

function DonutChart({ items, total, centerValue, centerLabel, ariaLabel }: DonutChartProps) {
  const radius = 66
  const circumference = 2 * Math.PI * radius
  const segments = items.reduce<Array<{ item: DonutItem; length: number; offset: number }>>((result, item) => {
    const previous = result[result.length - 1]
    const length = total > 0 ? item.value / total * circumference : 0
    return [...result, { item, length, offset: previous ? previous.offset + previous.length : 0 }]
  }, [])

  return (
    <div className="report-donut-layout">
      <svg className="report-donut" viewBox="0 0 180 180" role="img" aria-label={ariaLabel}>
        <circle className="report-donut-track" cx="90" cy="90" r={radius} />
        {segments.map(({ item, length, offset }) => (
            <circle
              key={item.id}
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth="18"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 90 90)"
            >
              <title>{`${item.label}: ${formatAmount(item.value)} (${item.detail})`}</title>
            </circle>
        ))}
        <text className="report-donut-center-value" x="90" y="87" textAnchor="middle">{centerValue}</text>
        <text className="report-donut-center-label" x="90" y="105" textAnchor="middle">{centerLabel}</text>
      </svg>
      <ul className="report-donut-legend">
        {items.map((item) => (
          <li key={item.id}>
            <span><i style={{ backgroundColor: item.color }} />{item.label}</span>
            <strong>{formatAmount(item.value)}</strong>
            <small>{item.detail}</small>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Reports({ profileId }: ReportsProps) {
  const [period, setPeriod] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [exportError, setExportError] = useState('')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  useEffect(() => {
    let active = true
    reportsService.load(profileId, period.getMonth() + 1, period.getFullYear()).then((result) => {
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

  const transactions = data?.transactions ?? emptyTransactions
  const categories = data?.categories ?? emptyCategories
  const incomeTransactions = transactions.filter((transaction) => transaction.oma_transactiontype === 1)
  const expenseTransactions = transactions.filter((transaction) => transaction.oma_transactiontype === 2)
  const totalIncome = incomeTransactions.reduce((sum, transaction) => sum + (transaction.oma_amount ?? 0), 0)
  const totalExpenses = expenseTransactions.reduce((sum, transaction) => sum + (transaction.oma_amount ?? 0), 0)
  const netCashFlow = totalIncome - totalExpenses
  const cashFlowBuckets = useMemo(() => buildCashFlow(transactions), [transactions])
  const categorySpending = useMemo(() => buildCategorySpending(transactions, categories), [transactions, categories])
  const budgetRows = useMemo(
    () => buildBudgetRows(data?.budgets ?? [], categories, categorySpending),
    [data, categories, categorySpending],
  )
  const investmentSummary = useMemo(() => buildInvestmentSummary(data?.investments ?? []), [data])
  const totalInvestmentValue = investmentSummary.reduce((sum, row) => sum + row.value, 0)
  const totalInvestmentCost = investmentSummary.reduce((sum, row) => sum + row.invested, 0)
  const investmentGainLoss = totalInvestmentValue - totalInvestmentCost
  const maxFlow = Math.max(...cashFlowBuckets.flatMap((bucket) => [bucket.income, bucket.expenses]), 1)
  const maxBudgetValue = Math.max(...budgetRows.flatMap((row) => [row.budgeted, row.spent]), 1)
  const categoryChartItems = categorySpending.map((row, index) => ({
    id: row.id,
    label: row.name,
    value: row.amount,
    color: chartColors[index % chartColors.length],
    detail: `${totalExpenses > 0 ? (row.amount / totalExpenses * 100).toFixed(1) : '0.0'}% · ${row.count} ${row.count === 1 ? 'expense' : 'expenses'}`,
  }))
  const investmentChartItems = investmentSummary.map((row, index) => ({
    id: String(row.type ?? 'other'),
    label: row.name,
    value: row.value,
    color: chartColors[index % chartColors.length],
    detail: `${totalInvestmentValue > 0 ? (row.value / totalInvestmentValue * 100).toFixed(1) : '0.0'}% · ${row.count} ${row.count === 1 ? 'holding' : 'holdings'}`,
  }))

  function reload() {
    setLoading(true)
    setError('')
    setExportError('')
    setReloadKey((key) => key + 1)
  }

  function selectPeriod(value: string) {
    const match = /^(\d{4})-(\d{2})$/.exec(value)
    if (!match) return
    const year = Number(match[1])
    const month = Number(match[2])
    if (month < 1 || month > 12) return
    setLoading(true)
    setExportError('')
    setPeriod(new Date(year, month - 1, 1))
  }

  function shiftPeriod(offset: number) {
    setLoading(true)
    setExportError('')
    setPeriod((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  function getExportRows(): (string | number)[][] {
    if (!data) throw new Error('Report data is not available yet.')
    return [
      ['Report', 'Period', 'Name', 'Amount', 'Comparison', 'Change percent'],
      ['Cash flow', monthTitle(period), 'Income', totalIncome, '', ''],
      ['Cash flow', monthTitle(period), 'Expenses', totalExpenses, '', ''],
      ['Cash flow', monthTitle(period), 'Net cash flow', netCashFlow, '', ''],
      ...cashFlowBuckets.map((bucket) => [
        'Cash flow by week',
        monthTitle(period),
        bucket.label,
        bucket.income,
        bucket.expenses,
        '',
      ]),
      ...categorySpending.map((row) => ['Spending by category', monthTitle(period), row.name, row.amount, `${row.count} transactions`, '']),
      ...budgetRows.map((row) => [
        'Budget performance',
        monthTitle(period),
        row.name,
        row.spent,
        `Budgeted ${row.budgeted}`,
        row.budgeted > 0 ? (row.spent / row.budgeted * 100).toFixed(1) : '',
      ]),
      ...investmentSummary.map((row) => [
        'Investment snapshot',
        'Current',
        row.name,
        row.value,
        `Invested ${row.invested}; ${row.count} holdings`,
        row.invested > 0 ? ((row.value - row.invested) / row.invested * 100).toFixed(1) : '',
      ]),
      ['Investment snapshot', 'Current', 'Portfolio total', totalInvestmentValue, `Invested ${totalInvestmentCost}`, totalInvestmentCost > 0 ? (investmentGainLoss / totalInvestmentCost * 100).toFixed(1) : ''],
    ]
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function exportCsv() {
    if (!data) return
    setExportError('')
    try {
      const rows = getExportRows()
      const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
      downloadBlob(blob, `finance-report-${period.getFullYear()}-${String(period.getMonth() + 1).padStart(2, '0')}.csv`)
    } catch (exportFailure) {
      setExportError(errorMessage(exportFailure))
    }
  }

  function buildReportDocument(printable: boolean) {
    const title = `Finance report — ${monthTitle(period)}`
    const summaryRows = [
      ['Income', formatAmount(totalIncome)],
      ['Expenses', formatAmount(totalExpenses)],
      ['Net cash flow', formatSignedAmount(netCashFlow)],
      ['Current investment value', formatAmount(totalInvestmentValue)],
      ['Amount invested', formatAmount(totalInvestmentCost)],
      ['Unrealized gain / loss', formatSignedAmount(investmentGainLoss)],
    ]
    const table = (headers: string[], rows: string[][]) => `
      <table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    const content = `
      <h1>${escapeHtml(title)}</h1>
      <p class="muted">Transaction and budget data for ${escapeHtml(monthTitle(period))}. Investment values are a current snapshot, not historical values.</p>
      <h2>Summary</h2>${table(['Metric', 'Amount'], summaryRows)}
      <h2>Cash flow by week</h2>${table(['Days', 'Income', 'Expenses'], cashFlowBuckets.map((bucket) => [bucket.label, formatAmount(bucket.income), formatAmount(bucket.expenses)]))}
      <h2>Spending by category</h2>${table(['Category', 'Expenses', 'Share', 'Transactions'], categorySpending.map((row) => [row.name, formatAmount(row.amount), `${totalExpenses > 0 ? (row.amount / totalExpenses * 100).toFixed(1) : '0.0'}%`, String(row.count)]))}
      <h2>Budget performance</h2>${table(['Category', 'Budgeted', 'Spent', 'Remaining'], budgetRows.map((row) => [row.name, formatAmount(row.budgeted), formatAmount(row.spent), row.spent > row.budgeted ? `${formatAmount(row.spent - row.budgeted)} over` : `${formatAmount(row.budgeted - row.spent)} left`]))}
      <h2>Investment snapshot by asset type</h2>${table(['Asset type', 'Current value', 'Invested', 'Gain / loss', 'Return'], investmentSummary.map((row) => {
        const gain = row.value - row.invested
        return [row.name, formatAmount(row.value), formatAmount(row.invested), formatSignedAmount(gain), formatPercent(row.invested > 0 ? gain / row.invested * 100 : 0)]
      }))}
      <p class="footer">Generated by Ledger Finance</p>`
    const styles = `
      body { color: #302f49; font: 14px Arial, sans-serif; margin: 36px; }
      h1 { color: #343348; font-size: 25px; margin: 0 0 8px; }
      h2 { border-bottom: 1px solid #dddbea; color: #514b9d; font-size: 17px; margin: 26px 0 8px; padding-bottom: 6px; }
      p { line-height: 1.5; } .muted, .footer { color: #77758e; font-size: 11px; }
      table { border-collapse: collapse; margin: 8px 0 18px; width: 100%; }
      th, td { border: 1px solid #dedce9; padding: 7px 9px; text-align: left; }
      th { background: #f1effa; color: #45435e; }
      tr:nth-child(even) td { background: #faf9fd; }
      .footer { border-top: 1px solid #dddbea; margin-top: 30px; padding-top: 10px; }
      ${printable ? '@media print { body { margin: 15mm; } h2 { break-after: avoid; } table { break-inside: avoid; } }' : ''}
    `
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${styles}</style></head><body>${content}</body></html>`
  }

  function exportWord() {
    if (!data) return
    setExportError('')
    setExportMenuOpen(false)
    try {
      const documentHtml = buildReportDocument(false)
      downloadBlob(
        new Blob([`\uFEFF${documentHtml}`], { type: 'application/msword;charset=utf-8' }),
        `finance-report-${period.getFullYear()}-${String(period.getMonth() + 1).padStart(2, '0')}.doc`,
      )
    } catch (exportFailure) {
      setExportError(errorMessage(exportFailure))
    }
  }

  function exportPdf() {
    if (!data) return
    setExportError('')
    setExportMenuOpen(false)
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setExportError('The PDF print window was blocked. Allow pop-ups for this app, then try again.')
      return
    }
    try {
      printWindow.document.open()
      printWindow.document.write(buildReportDocument(true))
      printWindow.document.close()
      printWindow.focus()
      printWindow.setTimeout(() => printWindow.print(), 300)
    } catch (exportFailure) {
      printWindow.close()
      setExportError(errorMessage(exportFailure))
    }
  }

  return (
    <div className="reports-page">
      <section className="reports-heading">
        <div>
          <p className="eyebrow">YOUR FINANCIAL PICTURE</p>
          <h1>Reports</h1>
          <p className="reports-subtitle">Understand your cash flow, spending habits, budgets, and portfolio.</p>
        </div>
        <div className="reports-heading-actions">
          <button className="button-secondary" type="button" onClick={reload} disabled={loading}>Refresh</button>
          <div className="reports-export">
            <button
              className="button-primary reports-export-trigger"
              type="button"
              aria-haspopup="menu"
              aria-expanded={exportMenuOpen}
              onClick={() => { setExportError(''); setExportMenuOpen((open) => !open) }}
              disabled={!data || loading}
            >
              Download report <span aria-hidden="true">⌄</span>
            </button>
            {exportMenuOpen && <div className="reports-export-menu" role="menu" aria-label="Download report format">
              <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); exportCsv() }}>CSV (.csv)</button>
              <button type="button" role="menuitem" onClick={exportPdf}>PDF (Print / Save as PDF)</button>
              <button type="button" role="menuitem" onClick={exportWord}>Word (.doc)</button>
            </div>}
          </div>
        </div>
      </section>

      <section className="reports-period-bar" aria-label="Report period">
        <button className="reports-period-button" type="button" aria-label="Previous month" onClick={() => shiftPeriod(-1)}>‹</button>
        <input className="reports-period-picker" type="month" value={monthInputValue(period)} onChange={(event) => selectPeriod(event.target.value)} aria-label="Select report month and year" />
        <button className="reports-period-button" type="button" aria-label="Next month" onClick={() => shiftPeriod(1)}>›</button>
        <span className="reports-period-note">Transaction and budget reports use this month. Investments show current values.</span>
      </section>

      {exportError && <p className="reports-error-banner" role="alert">{exportError}</p>}

      {data && <section className="reports-summary" aria-label={`${monthTitle(period)} cash flow summary`}>
        <article><span>Income</span><strong className="report-income">{formatAmount(totalIncome)}</strong><small>{incomeTransactions.length} recorded transactions</small></article>
        <article><span>Expenses</span><strong className="report-expense">{formatAmount(totalExpenses)}</strong><small>{expenseTransactions.length} recorded transactions</small></article>
        <article><span>Net cash flow</span><strong className={netCashFlow >= 0 ? 'report-income' : 'report-expense'}>{formatSignedAmount(netCashFlow)}</strong><small>{monthTitle(period)}</small></article>
      </section>}

      {loading ? (
        <section className="reports-panel reports-state" aria-live="polite"><span className="spinner" /><p>Loading reports…</p></section>
      ) : error ? (
        <section className="reports-panel reports-state reports-error" role="alert"><p>{error}</p><button className="button-primary" type="button" onClick={reload}>Try again</button></section>
      ) : data ? (
        <>
          <section className="reports-panel" aria-labelledby="cash-flow-title">
            <header className="reports-panel-heading"><div><h2 id="cash-flow-title">Cash flow</h2><p>Income and expenses grouped by week for {monthTitle(period)}.</p></div></header>
            <div className="cashflow-chart" role="img" aria-label={`Weekly income and expense chart for ${monthTitle(period)}`}>
              <div className="cashflow-chart-legend"><span><i className="cashflow-income-key" />Income</span><span><i className="cashflow-expense-key" />Expenses</span></div>
              {cashFlowBuckets.map((bucket) => (
                <div className="cashflow-week" key={bucket.label}>
                  <span className="cashflow-week-label">Days {bucket.label}</span>
                  <div className="cashflow-bars">
                    <div className="cashflow-bar-row"><span>In</span><div><i className="cashflow-income-bar" style={{ width: `${bucket.income / maxFlow * 100}%` }} /></div><strong>{formatAmount(bucket.income)}</strong></div>
                    <div className="cashflow-bar-row"><span>Out</span><div><i className="cashflow-expense-bar" style={{ width: `${bucket.expenses / maxFlow * 100}%` }} /></div><strong>{formatAmount(bucket.expenses)}</strong></div>
                  </div>
                </div>
              ))}
              {!transactions.length && <p className="reports-chart-empty">No transactions recorded for this month.</p>}
            </div>
          </section>

          <div className="reports-content-grid">
            <section className="reports-panel" aria-labelledby="category-spending-title">
              <header className="reports-panel-heading"><div><h2 id="category-spending-title">Spending by category</h2><p>Expense transactions for {monthTitle(period)}.</p></div></header>
              {categorySpending.length ? (
                <DonutChart
                  items={categoryChartItems}
                  total={totalExpenses}
                  centerValue={formatAmount(totalExpenses)}
                  centerLabel="total spent"
                  ariaLabel={`Expense breakdown by category for ${monthTitle(period)}`}
                />
              ) : <div className="reports-section-empty"><p>No expense transactions to break down for this month.</p></div>}
            </section>

            <section className="reports-panel" aria-labelledby="budget-performance-title">
              <header className="reports-panel-heading"><div><h2 id="budget-performance-title">Budget performance</h2><p>Recorded monthly expenses compared with budget targets.</p></div></header>
              {budgetRows.length ? (
                <div className="report-budget-chart">
                  <div className="report-budget-legend"><span><i className="report-budget-actual-key" />Spent</span><span><i className="report-budget-target-key" />Budgeted</span></div>
                  <div className="report-budget-axis" aria-hidden="true"><span>$0</span><span>{formatAmount(maxBudgetValue / 2)}</span><span>{formatAmount(maxBudgetValue)}</span></div>
                  {budgetRows.map((row) => {
                  const remaining = row.budgeted - row.spent
                  const percentage = row.budgeted > 0 ? row.spent / row.budgeted * 100 : row.spent > 0 ? 100 : 0
                  return <article className="report-budget-row" key={row.id}>
                    <div className="report-budget-heading"><div><strong>{row.name}</strong><small>{formatAmount(row.spent)} spent of {formatAmount(row.budgeted)}</small></div><span className={remaining < 0 ? 'report-expense' : 'report-income'}>{remaining < 0 ? `${formatAmount(Math.abs(remaining))} over` : `${formatAmount(remaining)} left`}</span></div>
                    <div className="report-budget-bars" role="img" aria-label={`${row.name}: ${formatAmount(row.spent)} spent, ${formatAmount(row.budgeted)} budgeted`}>
                      <span className="report-budget-target-bar" style={{ width: `${row.budgeted / maxBudgetValue * 100}%` }} />
                      <span className={`report-budget-actual-bar${remaining < 0 ? ' report-budget-over' : ''}`} style={{ width: `${row.spent / maxBudgetValue * 100}%` }} />
                    </div>
                    <small>{percentage.toFixed(1)}% used</small>
                  </article>
                  })}
                </div>
              ) : <div className="reports-section-empty"><p>No budgets have been set for {monthTitle(period)}.</p></div>}
            </section>
          </div>

          <section className="reports-panel" aria-labelledby="investment-performance-title">
            <header className="reports-panel-heading"><div><h2 id="investment-performance-title">Investment snapshot</h2><p>Current portfolio value and recorded cost basis by asset type. This is not historical performance.</p></div></header>
            {investmentSummary.length ? (
              <>
                <div className="investment-report-summary">
                  <article><span>Current value</span><strong>{formatAmount(totalInvestmentValue)}</strong></article>
                  <article><span>Amount invested</span><strong>{formatAmount(totalInvestmentCost)}</strong></article>
                  <article><span>Unrealized gain / loss</span><strong className={investmentGainLoss >= 0 ? 'report-income' : 'report-expense'}>{formatSignedAmount(investmentGainLoss)}</strong></article>
                </div>
                <div className="investment-type-chart">
                  <DonutChart
                    items={investmentChartItems}
                    total={totalInvestmentValue}
                    centerValue={formatAmount(totalInvestmentValue)}
                    centerLabel="portfolio value"
                    ariaLabel="Current investment portfolio allocation by asset type"
                  />
                  <div className="investment-type-returns">
                    {investmentSummary.map((row) => {
                      const gain = row.value - row.invested
                      const percentage = row.invested > 0 ? gain / row.invested * 100 : 0
                      return <article key={row.type ?? 'other'}>
                        <strong>{row.name}</strong>
                        <span>Invested {formatAmount(row.invested)}</span>
                        <b className={gain >= 0 ? 'report-income' : 'report-expense'}>{formatSignedAmount(gain)} ({formatPercent(percentage)})</b>
                      </article>
                    })}
                  </div>
                </div>
              </>
            ) : <div className="reports-section-empty"><p>No investment holdings available for this profile.</p></div>}
          </section>
        </>
      ) : null}
    </div>
  )
}
