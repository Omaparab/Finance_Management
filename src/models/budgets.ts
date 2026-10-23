import type { DataverseAttachment } from './dataverse'

export interface Budget {
  "oma_budgetid"?: string
  "oma_budgetamount"?: number
  "oma_budgetamount_base"?: number
  "oma_budgetname"?: string
  "createdon"?: string
  "exchangerate"?: number
  "importsequencenumber"?: number
  "modifiedon"?: string
  "oma_month"?: number
  "overriddencreatedon"?: string
  "oma_spentamount"?: number
  "oma_spentamount_base"?: number
  "statuscode"?: number
  "statecode"?: number
  "timezoneruleversionnumber"?: number
  "utcconversiontimezonecode"?: number
  "versionnumber"?: number
  "oma_year"?: number
  "_oma_category_value"?: string
  "_oma_category_type"?: string
  "_createdby_value"?: string
  "_createdonbehalfby_value"?: string
  "_createdonbehalfby_type"?: string
  "_createdby_type"?: string
  "_transactioncurrencyid_value"?: string
  "_transactioncurrencyid_type"?: string
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
  "_oma_userprofile_value"?: string
  "_oma_userprofile_type"?: string
  "{Attachments}"?: DataverseAttachment[]
}
