import { getClient } from '@microsoft/power-apps/data'
import type { IOperationResult } from '@microsoft/power-apps/data'
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo'
import type {
  Budget,
  Category,
  FinancialAccount,
  Investment,
  InvestmentTransaction,
  SavingsContribution,
  SavingsGoal,
  Transaction,
  UserProfile,
} from '../models'

const client = getClient(dataSourcesInfo)

export interface OverviewData {
  profile: UserProfile
  accounts: FinancialAccount[]
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  savingsGoals: SavingsGoal[]
  savingsContributions: SavingsContribution[]
  investments: Investment[]
  investmentTransactions: InvestmentTransaction[]
}

function requireData<T>(result: IOperationResult<T>, operation: string): T {
  if (!result.success) {
    const detail = result.error && typeof result.error === 'object' && 'message' in result.error
      ? String(result.error.message)
      : 'No error details were returned by the connector.'
    const status = result.error && typeof result.error === 'object' && 'status' in result.error && typeof result.error.status === 'number'
      ? ` (HTTP ${result.error.status})`
      : ''
    throw new Error(`Dataverse ${operation} failed${status}: ${detail}`)
  }
  return result.data
}

function cleanId(id: string) {
  return id.replace(/[{}]/g, '')
}

export const overviewService = {
  async load(profile: UserProfile): Promise<OverviewData> {
    const profileId = profile.oma_userprofileid
    if (!profileId) throw new Error('The User Profile record is missing its Dataverse ID.')
    const profileFilter = `_oma_userprofile_value eq ${cleanId(profileId)} and statecode eq 0`
    const current = new Date()

    const [
      accountsResult,
      categoriesResult,
      transactionsResult,
      budgetsResult,
      savingsGoalsResult,
      savingsContributionsResult,
      investmentsResult,
      investmentTransactionsResult,
    ] = await Promise.all([
      client.retrieveMultipleRecordsAsync<FinancialAccount>('oma_financialaccounts', {
        filter: `${profileFilter} and oma_isactive eq true`,
        select: ['oma_financialaccountid', 'oma_accountname', 'oma_institution', 'oma_currentbalance', 'oma_accounttype', 'oma_accountnumber'],
        orderBy: ['oma_accountname asc'],
        top: 100,
      }),
      client.retrieveMultipleRecordsAsync<Category>('oma_categories', {
        filter: `(_oma_userprofile_value eq ${cleanId(profileId)} or oma_issystem eq true) and statecode eq 0`,
        select: ['oma_categoryid', 'oma_categoryname', 'oma_categorytype', 'oma_color', 'oma_icon'],
        orderBy: ['oma_categoryname asc'],
        top: 200,
      }),
      client.retrieveMultipleRecordsAsync<Transaction>('oma_transactions', {
        filter: profileFilter,
        select: ['oma_transactionid', 'oma_transactionname', 'oma_transactiondate', 'oma_amount', 'oma_transactiontype', '_oma_category_value', '_oma_financialaccount_value'],
        orderBy: ['oma_transactiondate desc'],
        top: 10,
      }),
      client.retrieveMultipleRecordsAsync<Budget>('oma_budgets', {
        filter: `${profileFilter} and oma_month eq ${current.getMonth() + 1} and oma_year eq ${current.getFullYear()}`,
        select: ['oma_budgetid', 'oma_budgetname', 'oma_budgetamount', 'oma_spentamount', 'oma_month', 'oma_year'],
        orderBy: ['oma_budgetname asc'],
        top: 100,
      }),
      client.retrieveMultipleRecordsAsync<SavingsGoal>('oma_savingsgoals', {
        filter: profileFilter,
        select: ['oma_savingsgoalid', 'oma_goalname', 'oma_currentamount', 'oma_targetamount', 'oma_targetdate', 'oma_status'],
        orderBy: ['oma_targetdate asc'],
        top: 100,
      }),
      client.retrieveMultipleRecordsAsync<SavingsContribution>('oma_savingscontributions', {
        filter: profileFilter,
        select: ['oma_savingscontributionid', 'oma_amount', 'oma_contributiondate', '_oma_savingsgoal_value'],
        top: 500,
      }),
      client.retrieveMultipleRecordsAsync<Investment>('oma_investments', {
        filter: profileFilter,
        select: ['oma_investmentid', 'oma_investmentname', 'oma_tickersymbol', 'oma_currentvalue', 'oma_investedamount', 'oma_quantity'],
        orderBy: ['oma_investmentname asc'],
        top: 100,
      }),
      client.retrieveMultipleRecordsAsync<InvestmentTransaction>('oma_investmenttransactions', {
        filter: profileFilter,
        select: ['oma_investmenttransactionid', '_oma_investment_value'],
        top: 500,
      }),
    ])

    return {
      profile,
      accounts: requireData(accountsResult, 'account retrieval'),
      categories: requireData(categoriesResult, 'category retrieval'),
      transactions: requireData(transactionsResult, 'transaction retrieval'),
      budgets: requireData(budgetsResult, 'budget retrieval'),
      savingsGoals: requireData(savingsGoalsResult, 'savings goal retrieval'),
      savingsContributions: requireData(savingsContributionsResult, 'savings contribution retrieval'),
      investments: requireData(investmentsResult, 'investment retrieval'),
      investmentTransactions: requireData(investmentTransactionsResult, 'investment transaction retrieval'),
    }
  },
}
