import { getClient } from '@microsoft/power-apps/data'
import type { IOperationResult } from '@microsoft/power-apps/data'
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo'
import type { FinancialAccount, Investment, InvestmentTransaction } from '../models'

const client = getClient(dataSourcesInfo)

export interface InvestmentsPageData {
  investments: Investment[]
  transactions: InvestmentTransaction[]
  accounts: FinancialAccount[]
}

export interface InvestmentInput {
  oma_investmentname: string
  oma_assettype: number
  oma_tickersymbol: string | null
  oma_quantity: number
  oma_purchaseprice: number
  oma_currentprice: number
  oma_investedamount: number
  oma_currentvalue: number
  oma_purchasedate: string | null
  _oma_financialaccount_value: string | null
  _oma_userprofile_value: string
}

export interface InvestmentActivityInput {
  oma_transactionname: string
  oma_transactiontype: number
  oma_transactiondate: string
  oma_quantity: number
  oma_priceperunit: number
  oma_fees: number
  oma_totalamount: number
  oma_notes: string | null
  _oma_investment_value: string
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

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export const investmentsService = {
  async list(profileId: string): Promise<InvestmentsPageData> {
    if (!profileId) throw new Error('Select a finance profile before loading investments.')
    const cleanProfileId = cleanId(profileId)
    const [investmentsResult, transactionsResult, accountsResult] = await Promise.all([
      client.retrieveMultipleRecordsAsync<Investment>('oma_investments', {
        filter: `_oma_userprofile_value eq ${cleanProfileId} and statecode eq 0`,
        select: [
          'oma_investmentid',
          'oma_investmentname',
          'oma_assettype',
          'oma_tickersymbol',
          'oma_quantity',
          'oma_purchaseprice',
          'oma_currentprice',
          'oma_investedamount',
          'oma_currentvalue',
          'oma_purchasedate',
          'oma_status',
          '_oma_financialaccount_value',
        ],
        orderBy: ['oma_investmentname asc'],
        top: 500,
      }),
      client.retrieveMultipleRecordsAsync<InvestmentTransaction>('oma_investmenttransactions', {
        filter: `_oma_userprofile_value eq ${cleanProfileId} and statecode eq 0`,
        select: [
          'oma_investmenttransactionid',
          'oma_transactionname',
          'oma_transactiontype',
          'oma_transactiondate',
          'oma_quantity',
          'oma_priceperunit',
          'oma_fees',
          'oma_totalamount',
          'oma_notes',
          '_oma_investment_value',
        ],
        orderBy: ['oma_transactiondate desc'],
        top: 500,
      }),
      client.retrieveMultipleRecordsAsync<FinancialAccount>('oma_financialaccounts', {
        filter: `_oma_userprofile_value eq ${cleanProfileId} and statecode eq 0 and oma_isactive eq true`,
        select: ['oma_financialaccountid', 'oma_accountname'],
        orderBy: ['oma_accountname asc'],
        top: 200,
      }),
    ])
    return {
      investments: requireData(investmentsResult, 'investment retrieval'),
      transactions: requireData(transactionsResult, 'investment activity retrieval'),
      accounts: requireData(accountsResult, 'investment account retrieval'),
    }
  },

  async create(input: InvestmentInput): Promise<void> {
    requireData(
      await client.createRecordAsync<InvestmentInput, Investment>('oma_investments', input),
      'investment creation',
    )
  },

  async update(investmentId: string, input: InvestmentInput): Promise<void> {
    requireData(
      await client.updateRecordAsync<InvestmentInput, Investment>('oma_investments', cleanId(investmentId), input),
      'investment update',
    )
  },

  async delete(investmentId: string): Promise<void> {
    requireData(
      await client.deleteRecordAsync('oma_investments', cleanId(investmentId)),
      'investment deletion',
    )
  },

  async recordActivity(
    investment: Investment,
    profileId: string,
    activity: Omit<InvestmentActivityInput, '_oma_investment_value' | '_oma_userprofile_value'>,
    holdingChanges: Pick<Investment, 'oma_quantity' | 'oma_purchaseprice' | 'oma_currentprice' | 'oma_investedamount' | 'oma_currentvalue' | 'oma_purchasedate'> | null,
  ): Promise<void> {
    const investmentId = investment.oma_investmentid
    if (!investmentId) throw new Error('The selected investment is missing its Dataverse ID.')

    if (holdingChanges) {
      requireData(
        await client.updateRecordAsync<typeof holdingChanges, Investment>(
          'oma_investments',
          cleanId(investmentId),
          holdingChanges,
        ),
        'investment holding update',
      )
    }

    try {
      requireData(
        await client.createRecordAsync<InvestmentActivityInput, InvestmentTransaction>('oma_investmenttransactions', {
          ...activity,
          _oma_investment_value: cleanId(investmentId),
          _oma_userprofile_value: cleanId(profileId),
        }),
        'investment activity creation',
      )
    } catch (createError) {
      if (!holdingChanges) throw createError
      try {
        requireData(
          await client.updateRecordAsync<typeof holdingChanges, Investment>(
            'oma_investments',
            cleanId(investmentId),
            {
              oma_quantity: investment.oma_quantity ?? 0,
              oma_purchaseprice: investment.oma_purchaseprice ?? 0,
              oma_currentprice: investment.oma_currentprice ?? 0,
              oma_investedamount: investment.oma_investedamount ?? 0,
              oma_currentvalue: investment.oma_currentvalue ?? 0,
              oma_purchasedate: investment.oma_purchasedate,
            },
          ),
          'investment holding rollback',
        )
      } catch (rollbackError) {
        throw new Error(
          `${errorText(createError)} The holding could not be restored: ${errorText(rollbackError)}`,
        )
      }
      throw createError
    }
  },
}
