import { getClient } from '@microsoft/power-apps/data'
import type { IOperationResult } from '@microsoft/power-apps/data'
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo'
import type { SavingsContribution, SavingsGoal } from '../models'

const client = getClient(dataSourcesInfo)

export interface SavingsGoalsPageData {
  goals: SavingsGoal[]
  contributions: SavingsContribution[]
}

export interface SavingsGoalInput {
  oma_goalname: string
  oma_currentamount: number
  oma_targetamount: number
  oma_targetdate: string | null
  oma_notes: string | null
  oma_status: number
  _oma_userprofile_value: string
}

export interface SavingsContributionInput {
  oma_contributionname: string
  oma_amount: number
  oma_contributiondate: string
  oma_notes: string | null
  _oma_savingsgoal_value: string
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

export const savingsGoalsService = {
  async list(profileId: string): Promise<SavingsGoalsPageData> {
    if (!profileId) throw new Error('Select a finance profile before loading savings goals.')
    const cleanProfileId = cleanId(profileId)
    const [goalsResult, contributionsResult] = await Promise.all([
      client.retrieveMultipleRecordsAsync<SavingsGoal>('oma_savingsgoals', {
        filter: `_oma_userprofile_value eq ${cleanProfileId} and statecode eq 0`,
        select: [
          'oma_savingsgoalid',
          'oma_goalname',
          'oma_currentamount',
          'oma_targetamount',
          'oma_targetdate',
          'oma_notes',
          'oma_priority',
          'oma_status',
        ],
        orderBy: ['oma_targetdate asc'],
        top: 500,
      }),
      client.retrieveMultipleRecordsAsync<SavingsContribution>('oma_savingscontributions', {
        filter: `_oma_userprofile_value eq ${cleanProfileId} and statecode eq 0`,
        select: [
          'oma_savingscontributionid',
          'oma_contributionname',
          'oma_amount',
          'oma_contributiondate',
          'oma_notes',
          '_oma_savingsgoal_value',
        ],
        orderBy: ['oma_contributiondate desc'],
        top: 500,
      }),
    ])
    return {
      goals: requireData(goalsResult, 'savings goal retrieval'),
      contributions: requireData(contributionsResult, 'savings contribution retrieval'),
    }
  },

  async create(input: SavingsGoalInput): Promise<void> {
    requireData(
      await client.createRecordAsync<SavingsGoalInput, SavingsGoal>('oma_savingsgoals', input),
      'savings goal creation',
    )
  },

  async update(goalId: string, input: SavingsGoalInput): Promise<void> {
    requireData(
      await client.updateRecordAsync<SavingsGoalInput, SavingsGoal>('oma_savingsgoals', cleanId(goalId), input),
      'savings goal update',
    )
  },

  async delete(goalId: string): Promise<void> {
    requireData(
      await client.deleteRecordAsync('oma_savingsgoals', cleanId(goalId)),
      'savings goal deletion',
    )
  },

  async recordContribution(
    goal: SavingsGoal,
    profileId: string,
    contribution: Omit<SavingsContributionInput, '_oma_savingsgoal_value' | '_oma_userprofile_value'>,
    newCurrentAmount: number,
    newStatus: number,
  ): Promise<void> {
    const goalId = goal.oma_savingsgoalid
    if (!goalId) throw new Error('The selected savings goal is missing its Dataverse ID.')
    const previousCurrentAmount = goal.oma_currentamount ?? 0
    const previousStatus = goal.oma_status ?? 1

    await this.updateProgress(goalId, newCurrentAmount, newStatus)
    try {
      requireData(
        await client.createRecordAsync<SavingsContributionInput, SavingsContribution>('oma_savingscontributions', {
          ...contribution,
          _oma_savingsgoal_value: cleanId(goalId),
          _oma_userprofile_value: cleanId(profileId),
        }),
        'savings contribution creation',
      )
    } catch (createError) {
      try {
        await this.updateProgress(goalId, previousCurrentAmount, previousStatus)
      } catch (rollbackError) {
        throw new Error(
          `${errorText(createError)} The goal amount could not be restored: ${errorText(rollbackError)}`,
        )
      }
      throw createError
    }
  },

  async updateProgress(goalId: string, currentAmount: number, status: number): Promise<void> {
    requireData(
      await client.updateRecordAsync<Pick<SavingsGoal, 'oma_currentamount' | 'oma_status'>, SavingsGoal>(
        'oma_savingsgoals',
        cleanId(goalId),
        { oma_currentamount: currentAmount, oma_status: status },
      ),
      'savings goal progress update',
    )
  },
}
