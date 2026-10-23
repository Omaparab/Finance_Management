import { getClient } from '@microsoft/power-apps/data'
import type { IOperationResult } from '@microsoft/power-apps/data'
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo'
import type { Budget, Category } from '../models'

const client = getClient(dataSourcesInfo)

export interface BudgetsPageData {
  budgets: Budget[]
  categories: Category[]
}

export interface BudgetInput {
  oma_budgetname: string
  oma_budgetamount: number
  oma_month: number
  oma_year: number
  _oma_category_value: string | null
  _oma_userprofile_value: string
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

export const budgetsService = {
  async list(profileId: string, month: number, year: number): Promise<BudgetsPageData> {
    if (!profileId) throw new Error('Select a finance profile before loading budgets.')
    const cleanProfileId = cleanId(profileId)
    const [budgetsResult, categoriesResult] = await Promise.all([
      client.retrieveMultipleRecordsAsync<Budget>('oma_budgets', {
        filter: `_oma_userprofile_value eq ${cleanProfileId} and statecode eq 0 and oma_month eq ${month} and oma_year eq ${year}`,
        select: ['oma_budgetid', 'oma_budgetname', 'oma_budgetamount', 'oma_spentamount', 'oma_month', 'oma_year', '_oma_category_value'],
        orderBy: ['oma_budgetname asc'],
        top: 500,
      }),
      client.retrieveMultipleRecordsAsync<Category>('oma_categories', {
        filter: 'statecode eq 0',
        select: ['oma_categoryid', 'oma_categoryname', 'oma_categorytype'],
        orderBy: ['oma_categoryname asc'],
        top: 200,
      }),
    ])
    return {
      budgets: requireData(budgetsResult, 'budget retrieval'),
      categories: requireData(categoriesResult, 'budget category retrieval')
        .filter((category) => category.oma_categorytype === 2),
    }
  },

  async create(input: BudgetInput): Promise<void> {
    requireData(
      await client.createRecordAsync<BudgetInput, Budget>('oma_budgets', input),
      'budget creation',
    )
  },

  async update(budgetId: string, input: BudgetInput): Promise<void> {
    requireData(
      await client.updateRecordAsync<BudgetInput, Budget>('oma_budgets', cleanId(budgetId), input),
      'budget update',
    )
  },

  async delete(budgetId: string): Promise<void> {
    requireData(
      await client.deleteRecordAsync('oma_budgets', cleanId(budgetId)),
      'budget deletion',
    )
  },
}
