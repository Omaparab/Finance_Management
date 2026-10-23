import { getContext } from '@microsoft/power-apps/app'
import { getClient } from '@microsoft/power-apps/data'
import type { IOperationResult } from '@microsoft/power-apps/data'
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo'
import type { UserProfile } from '../models'

const client = getClient(dataSourcesInfo)

export interface UserProfileInput {
  oma_profilename: string
  oma_fullname: string | null
}

const profileReferences = [
  { table: 'oma_financialaccounts', label: 'Financial Accounts', primaryKey: 'oma_financialaccountid' },
  { table: 'oma_categories', label: 'Categories', primaryKey: 'oma_categoryid' },
  { table: 'oma_transactions', label: 'Transactions', primaryKey: 'oma_transactionid' },
  { table: 'oma_budgets', label: 'Budgets', primaryKey: 'oma_budgetid' },
  { table: 'oma_savingsgoals', label: 'Savings Goals', primaryKey: 'oma_savingsgoalid' },
  { table: 'oma_savingscontributions', label: 'Savings Contributions', primaryKey: 'oma_savingscontributionid' },
  { table: 'oma_investments', label: 'Investments', primaryKey: 'oma_investmentid' },
  { table: 'oma_investmenttransactions', label: 'Investment Transactions', primaryKey: 'oma_investmenttransactionid' },
] as const

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

export const profileService = {
  async listProfiles(): Promise<UserProfile[]> {
    const context = await getContext()
    const userId = context.user.systemUserId
    if (!userId) {
      throw new Error('The Power Apps host did not provide a Dataverse user ID. Open the app inside Power Apps and try again.')
    }

    return requireData(
      await client.retrieveMultipleRecordsAsync<UserProfile>('oma_userprofiles', {
        filter: `_ownerid_value eq ${cleanId(userId)}`,
        select: ['oma_userprofileid', 'oma_fullname', 'oma_profilename', '_ownerid_value'],
        orderBy: ['oma_profilename asc'],
        top: 100,
      }),
      'profile lookup',
    )
  },

  async createProfile(input: UserProfileInput): Promise<void> {
    requireData(
      await client.createRecordAsync<UserProfileInput, UserProfile>('oma_userprofiles', input),
      'profile creation',
    )
  },

  async updateProfile(profileId: string, input: UserProfileInput): Promise<void> {
    requireData(
      await client.updateRecordAsync<UserProfileInput, UserProfile>('oma_userprofiles', cleanId(profileId), input),
      'profile update',
    )
  },

  async deleteProfile(profileId: string): Promise<void> {
    const cleanedId = cleanId(profileId)
    const profileFilter = `_oma_userprofile_value eq ${cleanedId}`
    const references = await Promise.all(profileReferences.map(async (reference) => {
      const records = requireData(
        await client.retrieveMultipleRecordsAsync<Record<string, string>>(reference.table, {
          filter: profileFilter,
          select: [reference.primaryKey],
          top: 1,
        }),
        `${reference.label.toLocaleLowerCase()} profile-reference check`,
      )
      return records.length ? reference.label : null
    }))
    const linkedTables = references.filter((label) => label !== null)

    if (linkedTables.length) {
      throw new Error(`This profile is still referenced by records in: ${linkedTables.join(', ')}. Remove the User Profile lookup from those records before deleting this profile.`)
    }

    requireData(
      await client.deleteRecordAsync('oma_userprofiles', cleanedId),
      'profile deletion',
    )
  },
}
