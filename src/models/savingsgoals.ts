import type { DataverseAttachment } from './dataverse'

export interface SavingsGoal {
  "createdon"?: string
  "oma_currentamount"?: number
  "oma_currentamount_base"?: number
  "exchangerate"?: number
  "oma_goalname"?: string
  "oma_icon"?: string
  "importsequencenumber"?: number
  "modifiedon"?: string
  "oma_notes"?: string
  "oma_priority"?: number
  "overriddencreatedon"?: string
  "oma_savingsgoalid"?: string
  "statuscode"?: number
  "oma_status"?: number
  "statecode"?: number
  "oma_targetamount"?: number
  "oma_targetamount_base"?: number
  "oma_targetdate"?: string
  "timezoneruleversionnumber"?: number
  "utcconversiontimezonecode"?: number
  "versionnumber"?: number
  "_createdby_value"?: string
  "_createdonbehalfby_value"?: string
  "_createdonbehalfby_type"?: string
  "_createdby_type"?: string
  "_transactioncurrencyid_value"?: string
  "_transactioncurrencyid_type"?: string
  "_oma_financialaccount_value"?: string
  "_oma_financialaccount_type"?: string
  "_modifiedby_value"?: string
  "_modifiedonbehalfby_value"?: string
  "_modifiedonbehalfby_type"?: string
  "_modifiedby_type"?: string
  "_ownerid_value"?: string
  "_ownerid_type"?: string
  "_owningbusinessunit_value"?: string
  "_owningbusinessunit_type"?: string
  "_oma_priority_label"?: string
  "_oma_status_label"?: string
  "_statecode_label"?: string
  "_statuscode_label"?: string
  "_oma_userprofile_value"?: string
  "_oma_userprofile_type"?: string
  "{Attachments}"?: DataverseAttachment[]
}
