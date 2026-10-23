import { getClient } from '@microsoft/power-apps/data'
import type { IOperationResult } from '@microsoft/power-apps/data'
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo'
import type { Category, FinancialAccount, Transaction } from '../models'

const client = getClient(dataSourcesInfo)

export interface TransactionsPageData {
  transactions: Transaction[]
  categories: Category[]
  accounts: FinancialAccount[]
}

export interface TransactionInput {
  oma_transactionname: string
  oma_transactiondate: string
  oma_amount: number
  oma_transactiontype: number
  oma_isrecurring: boolean
  oma_notes: string | null
  _oma_category_value: string
  _oma_financialaccount_value: string
  _oma_transfertoaccount_value: string | null
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

export const transactionsService = {
  async listLookups(profileId: string): Promise<Pick<TransactionsPageData, 'categories' | 'accounts'>> {
    if (!profileId) throw new Error('Select a finance profile before loading transaction lookup values.')
    const [categoriesResult, accountsResult] = await Promise.all([
      client.retrieveMultipleRecordsAsync<Category>('oma_categories', {
        filter: 'statecode eq 0',
        select: ['oma_categoryid', 'oma_categoryname'],
        orderBy: ['oma_categoryname asc'],
        top: 200,
      }),
      client.retrieveMultipleRecordsAsync<FinancialAccount>('oma_financialaccounts', {
        filter: 'statecode eq 0',
        select: ['oma_financialaccountid', 'oma_accountname'],
        orderBy: ['oma_accountname asc'],
        top: 200,
      }),
    ])
    return {
      categories: requireData(categoriesResult, 'transaction category lookup'),
      accounts: requireData(accountsResult, 'transaction account lookup'),
    }
  },

  async list(profileId: string): Promise<TransactionsPageData> {
    if (!profileId) throw new Error('Select a finance profile before loading its transactions.')
    const profileFilter = `_oma_userprofile_value eq ${cleanId(profileId)}`
    const [transactionsResult, categoriesResult, accountsResult] = await Promise.all([
      client.retrieveMultipleRecordsAsync<Transaction>('oma_transactions', {
        filter: `${profileFilter} and statecode eq 0`,
        select: [
          'oma_transactionid',
          'oma_transactionname',
          'oma_transactiondate',
          'oma_amount',
          'oma_transactiontype',
          'oma_isrecurring',
          'oma_notes',
          '_oma_category_value',
          '_oma_financialaccount_value',
          '_oma_transfertoaccount_value',
        ],
        orderBy: ['oma_transactiondate desc'],
        top: 500,
      }),
      client.retrieveMultipleRecordsAsync<Category>('oma_categories', {
        filter: 'statecode eq 0',
        select: ['oma_categoryid', 'oma_categoryname'],
        orderBy: ['oma_categoryname asc'],
        top: 200,
      }),
      client.retrieveMultipleRecordsAsync<FinancialAccount>('oma_financialaccounts', {
        filter: 'statecode eq 0',
        select: ['oma_financialaccountid', 'oma_accountname'],
        orderBy: ['oma_accountname asc'],
        top: 200,
      }),
    ])

    return {
      transactions: requireData(transactionsResult, 'transaction retrieval'),
      categories: requireData(categoriesResult, 'transaction category lookup'),
      accounts: requireData(accountsResult, 'transaction account lookup'),
    }
  },

  async create(input: TransactionInput): Promise<void> {
    requireData(
      await client.createRecordAsync<TransactionInput, Transaction>('oma_transactions', input),
      'transaction creation',
    )
  },

  async update(transactionId: string, input: TransactionInput): Promise<void> {
    requireData(
      await client.updateRecordAsync<TransactionInput, Transaction>('oma_transactions', cleanId(transactionId), input),
      'transaction update',
    )
  },

  async delete(transactionId: string): Promise<void> {
    requireData(
      await client.deleteRecordAsync('oma_transactions', cleanId(transactionId)),
      'transaction deletion',
    )
  },
}
