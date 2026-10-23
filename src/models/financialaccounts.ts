import type { DataverseAttachment } from './dataverse'

export interface FinancialAccount {
  "oma_accountname"?: string
  "oma_accountnumber"?: string
  "oma_accounttype"?: number
  "createdon"?: string
  "oma_currentbalance"?: number
  "oma_currentbalance_base"?: number
  "exchangerate"?: number
  "oma_financialaccountid"?: string
  "oma_fullname"?: string
  "importsequencenumber"?: number
  "oma_institution"?: string
  "oma_isactive"?: boolean
  "modifiedon"?: string
  "overriddencreatedon"?: string
  "statuscode"?: number
  "statecode"?: number
  "timezoneruleversionnumber"?: number
  "utcconversiontimezonecode"?: number
  "versionnumber"?: number
  "_oma_accounttype_label"?: string
  "_oma_contact_value"?: string
  "_oma_contact_type"?: string
  "_createdby_value"?: string
  "_createdonbehalfby_value"?: string
  "_createdonbehalfby_type"?: string
  "_createdby_type"?: string
  "_oma_currency_value"?: string
  "_transactioncurrencyid_value"?: string
  "_oma_currency_type"?: string
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
