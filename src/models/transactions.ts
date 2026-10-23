import type { DataverseAttachment } from './dataverse'

export interface Transaction {
  "oma_amount"?: number
  "oma_amount_base"?: number
  "createdon"?: string
  "exchangerate"?: number
  "importsequencenumber"?: number
  "oma_isrecurring"?: boolean
  "modifiedon"?: string
  "oma_notes"?: string
  "overriddencreatedon"?: string
  "statuscode"?: number
  "statecode"?: number
  "timezoneruleversionnumber"?: number
  "oma_transactionid"?: string
  "oma_transactiondate"?: string
  "oma_transactionname"?: string
  "oma_transactiontype"?: number
  "utcconversiontimezonecode"?: number
  "versionnumber"?: number
  "_oma_category_value"?: string
  "_oma_category_type"?: string
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
  "_statecode_label"?: string
  "_statuscode_label"?: string
  "_oma_transactiontype_label"?: string
  "_oma_transfertoaccount_value"?: string
  "_oma_transfertoaccount_type"?: string
  "_oma_userprofile_value"?: string
  "_oma_userprofile_type"?: string
  "{Attachments}"?: DataverseAttachment[]
}
