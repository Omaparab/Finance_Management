import type { OverviewData } from '../services/overviewService'

interface OverviewProps {
  data: OverviewData
  onRefresh: () => void
}

function formatAmount(value: number | undefined) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value ?? 0)
}

function formatDate(value: string | undefined) {
  if (!value) return 'Date not set'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date not set' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function choiceValue(value: number | undefined) {
  return value === undefined ? '—' : `Option ${value}`
}

export function Overview({ data, onRefresh }: OverviewProps) {
  const profileName = data.profile.oma_fullname?.trim() || data.profile.oma_profilename?.trim() || 'there'
  const totalBalance = data.accounts.reduce((total, account) => total + (account.oma_currentbalance ?? 0), 0)
  const investmentValue = data.investments.reduce((total, investment) => total + (investment.oma_currentvalue ?? 0), 0)
  const contributionsByGoal = new Map<string, number>()
  data.savingsContributions.forEach((contribution) => {
    const goalId = contribution._oma_savingsgoal_value
    if (goalId) contributionsByGoal.set(goalId, (contributionsByGoal.get(goalId) ?? 0) + 1)
  })
  const investmentTransactionsByInvestment = new Map<string, number>()
  data.investmentTransactions.forEach((transaction) => {
    const investmentId = transaction._oma_investment_value
    if (investmentId) investmentTransactionsByInvestment.set(investmentId, (investmentTransactionsByInvestment.get(investmentId) ?? 0) + 1)
  })

  return (
    <div className="overview">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">FINANCE WORKSPACE</p>
          <h1>Welcome, {profileName}</h1>
          <p className="subtitle">A clear view of your accounts, transactions, and monthly budgets.</p>
        </div>
        <button className="button-secondary" onClick={onRefresh}>Refresh data</button>
      </section>

      <section className="summary-grid" aria-label="Finance summary">
        <article className="summary-card"><span>Active accounts</span><strong>{data.accounts.length}</strong><small>Linked to your profile</small></article>
        <article className="summary-card"><span>Combined balance</span><strong>{formatAmount(totalBalance)}</strong><small>Dataverse account balances</small></article>
        <article className="summary-card"><span>Recent transactions</span><strong>{data.transactions.length}</strong><small>Latest records</small></article>
        <article className="summary-card"><span>This month’s budgets</span><strong>{data.budgets.length}</strong><small>Current month</small></article>
        <article className="summary-card"><span>Savings goals</span><strong>{data.savingsGoals.length}</strong><small>{data.savingsContributions.length} recorded contributions</small></article>
        <article className="summary-card"><span>Investment holdings</span><strong>{data.investments.length}</strong><small>Current value {formatAmount(investmentValue)}</small></article>
        <article className="summary-card"><span>Categories</span><strong>{data.categories.length}</strong><small>Available to classify activity</small></article>
      </section>

      <div className="content-grid">
        <section className="panel">
          <div className="panel-heading"><div><h2>Recent transactions</h2><p>Latest activity from your Dataverse records</p></div></div>
          {data.transactions.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>TRANSACTION</th><th>TYPE</th><th>DATE</th><th className="align-right">AMOUNT</th></tr></thead>
                <tbody>{data.transactions.map((transaction) => (
                  <tr key={transaction.oma_transactionid}>
                    <td>{transaction.oma_transactionname || 'Transaction'}</td>
                    <td>{choiceValue(transaction.oma_transactiontype)}</td>
                    <td>{formatDate(transaction.oma_transactiondate)}</td>
                    <td className="align-right">{formatAmount(transaction.oma_amount)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="empty-state">No transactions yet. They’ll appear here when you add records to Dataverse.</p>}
        </section>

        <section className="panel">
          <div className="panel-heading"><div><h2>Accounts</h2><p>Your active financial accounts</p></div></div>
          {data.accounts.length ? (
            <ul className="record-list">{data.accounts.map((account) => (
              <li key={account.oma_financialaccountid}>
                <span className="record-icon">{(account.oma_accountname || 'A').slice(0, 1).toUpperCase()}</span>
                <span className="record-copy"><strong>{account.oma_accountname || 'Financial account'}</strong><small>{account.oma_institution || account.oma_accountnumber || 'Account'}</small></span>
                <strong className="record-value">{formatAmount(account.oma_currentbalance)}</strong>
              </li>
            ))}</ul>
          ) : <p className="empty-state">No active financial accounts yet.</p>}
        </section>
      </div>

      <section className="panel budget-panel">
        <div className="panel-heading"><div><h2>Monthly budgets</h2><p>Budgets for this calendar month</p></div></div>
        {data.budgets.length ? (
          <div className="budget-grid">{data.budgets.map((budget) => {
            const amount = budget.oma_budgetamount ?? 0
            const spent = budget.oma_spentamount ?? 0
            const percentage = amount > 0 ? Math.min((spent / amount) * 100, 100) : 0
            return <article className="budget-item" key={budget.oma_budgetid}>
              <div className="budget-label"><strong>{budget.oma_budgetname || 'Budget'}</strong><span>{formatAmount(spent)} / {formatAmount(amount)}</span></div>
              <div className="progress-track" role="progressbar" aria-valuenow={Math.round(percentage)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percentage}%` }} /></div>
            </article>
          })}</div>
        ) : <p className="empty-state">No budgets have been created for this month.</p>}
      </section>

      <div className="content-grid">
        <section className="panel">
          <div className="panel-heading"><div><h2>Savings goals</h2><p>Your progress and contribution activity</p></div></div>
          {data.savingsGoals.length ? (
            <ul className="record-list goal-list">{data.savingsGoals.map((goal) => {
              const currentAmount = goal.oma_currentamount ?? 0
              const targetAmount = goal.oma_targetamount ?? 0
              const percentage = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0
              return <li className="goal-record" key={goal.oma_savingsgoalid}>
                <span className="record-copy"><strong>{goal.oma_goalname || 'Savings goal'}</strong><small>{formatAmount(currentAmount)} of {formatAmount(targetAmount)} · {contributionsByGoal.get(goal.oma_savingsgoalid || '') ?? 0} contributions</small>
                  <span className="progress-track" role="progressbar" aria-valuenow={Math.round(percentage)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percentage}%` }} /></span>
                </span>
                <strong className="record-value">{choiceValue(goal.oma_status)}</strong>
              </li>
            })}</ul>
          ) : <p className="empty-state">No savings goals yet.</p>}
        </section>

        <section className="panel">
          <div className="panel-heading"><div><h2>Investments</h2><p>Your holdings and recorded investment activity</p></div></div>
          {data.investments.length ? (
            <ul className="record-list">{data.investments.map((investment) => (
              <li key={investment.oma_investmentid}>
                <span className="record-icon">{(investment.oma_tickersymbol || investment.oma_investmentname || 'I').slice(0, 1).toUpperCase()}</span>
                <span className="record-copy"><strong>{investment.oma_investmentname || 'Investment'}</strong><small>{investment.oma_tickersymbol || 'Holding'} · {new Intl.NumberFormat().format(investment.oma_quantity ?? 0)} units · {investmentTransactionsByInvestment.get(investment.oma_investmentid || '') ?? 0} transactions</small></span>
                <strong className="record-value">{formatAmount(investment.oma_currentvalue)}</strong>
              </li>
            ))}</ul>
          ) : <p className="empty-state">No investments yet.</p>}
        </section>
      </div>
      <footer className="app-footer">Your financial records remain in your Dataverse environment.</footer>
    </div>
  )
}
