import { getClient } from '@microsoft/power-apps/data'
import type { IOperationResult } from '@microsoft/power-apps/data'
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo'
import type { FinancialAccount } from '../models'

const client = getClient(dataSourcesInfo)

export interface AccountsPageData {
  accounts: FinancialAccount[]
}

export interface AccountInput {
  oma_accountname: string
  oma_accounttype: number
  oma_accountnumber: string | null
  oma_currentbalance: number
  oma_institution: string | null
  oma_isactive: boolean
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

export const accountsService = {
  async list(profileId: string): Promise<AccountsPageData> {
    if (!profileId) throw new Error('Select a finance profile before loading accounts.')
    return {
      accounts: requireData(
        await client.retrieveMultipleRecordsAsync<FinancialAccount>('oma_financialaccounts', {
          filter: `_oma_userprofile_value eq ${cleanId(profileId)} and statecode eq 0`,
          select: [
            'oma_financialaccountid',
            'oma_accountname',
            'oma_accounttype',
            'oma_accountnumber',
            'oma_currentbalance',
            'oma_institution',
            'oma_isactive',
          ],
          orderBy: ['oma_accountname asc'],
          top: 500,
        }),
        'account retrieval',
      ),
    }
  },

  async create(input: AccountInput): Promise<void> {
    requireData(
      await client.createRecordAsync<AccountInput, FinancialAccount>('oma_financialaccounts', input),
      'account creation',
    )
  },

  async update(accountId: string, input: AccountInput): Promise<void> {
    requireData(
      await client.updateRecordAsync<AccountInput, FinancialAccount>('oma_financialaccounts', cleanId(accountId), input),
      'account update',
    )
  },
}
