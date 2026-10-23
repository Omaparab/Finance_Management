import type { DataverseAttachment } from './dataverse'

export interface InvestmentTransaction {
  "createdon"?: string
  "exchangerate"?: number
  "oma_fees"?: number
  "oma_fees_base"?: number
  "importsequencenumber"?: number
  "oma_investmenttransactionid"?: string
  "modifiedon"?: string
  "oma_notes"?: string
  "oma_priceperunit"?: number
  "oma_priceperunit_base"?: number
  "oma_quantity"?: number
  "overriddencreatedon"?: string
  "statuscode"?: number
  "statecode"?: number
  "timezoneruleversionnumber"?: number
  "oma_totalamount"?: number
  "oma_totalamount_base"?: number
  "oma_transactiondate"?: string
  "oma_transactionname"?: string
  "oma_transactiontype"?: number
  "utcconversiontimezonecode"?: number
  "versionnumber"?: number
  "_createdby_value"?: string
  "_createdonbehalfby_value"?: string
  "_createdonbehalfby_type"?: string
  "_createdby_type"?: string
  "_transactioncurrencyid_value"?: string
  "_transactioncurrencyid_type"?: string
  "_oma_investment_value"?: string
  "_oma_investment_type"?: string
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
  "_oma_userprofile_value"?: string
  "_oma_userprofile_type"?: string
  "{Attachments}"?: DataverseAttachment[]
}
