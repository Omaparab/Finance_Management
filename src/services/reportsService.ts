import { getClient } from '@microsoft/power-apps/data'
import type { IOperationResult } from '@microsoft/power-apps/data'
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo'
import type { Budget, Category, Investment, Transaction } from '../models'

const client = getClient(dataSourcesInfo)

export interface ReportsData {
  transactions: Transaction[]
  budgets: Budget[]
  categories: Category[]
  investments: Investment[]
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

export const reportsService = {
  async load(profileId: string, month: number, year: number): Promise<ReportsData> {
    if (!profileId) throw new Error('Select a finance profile before loading reports.')
    const cleanProfileId = cleanId(profileId)
    const startDate = `${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`
    const endDate = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
    const profileFilter = `_oma_userprofile_value eq ${cleanProfileId} and statecode eq 0`

    const [transactionsResult, budgetsResult, categoriesResult, investmentsResult] = await Promise.all([
      client.retrieveMultipleRecordsAsync<Transaction>('oma_transactions', {
        filter: `${profileFilter} and oma_transactiondate ge ${startDate} and oma_transactiondate lt ${endDate}`,
        select: [
          'oma_transactionid',
          'oma_transactionname',
          'oma_transactiondate',
          'oma_amount',
          'oma_transactiontype',
          '_oma_category_value',
        ],
        orderBy: ['oma_transactiondate asc'],
        top: 5000,
      }),
      client.retrieveMultipleRecordsAsync<Budget>('oma_budgets', {
        filter: `${profileFilter} and oma_month eq ${month} and oma_year eq ${year}`,
        select: ['oma_budgetid', 'oma_budgetname', 'oma_budgetamount', 'oma_spentamount', '_oma_category_value'],
        orderBy: ['oma_budgetname asc'],
        top: 500,
      }),
      client.retrieveMultipleRecordsAsync<Category>('oma_categories', {
        filter: `(_oma_userprofile_value eq ${cleanProfileId} or oma_issystem eq true) and statecode eq 0`,
        select: ['oma_categoryid', 'oma_categoryname', 'oma_categorytype'],
        orderBy: ['oma_categoryname asc'],
        top: 500,
      }),
      client.retrieveMultipleRecordsAsync<Investment>('oma_investments', {
        filter: profileFilter,
        select: [
          'oma_investmentid',
          'oma_investmentname',
          'oma_assettype',
          'oma_tickersymbol',
          'oma_currentvalue',
          'oma_investedamount',
          'oma_quantity',
          'oma_currentprice',
        ],
        orderBy: ['oma_investmentname asc'],
        top: 500,
      }),
    ])

    return {
      transactions: requireData(transactionsResult, 'report transaction retrieval'),
      budgets: requireData(budgetsResult, 'report budget retrieval'),
      categories: requireData(categoriesResult, 'report category retrieval'),
      investments: requireData(investmentsResult, 'report investment retrieval'),
    }
  },
}
