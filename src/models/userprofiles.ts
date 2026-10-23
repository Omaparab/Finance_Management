import type { DataverseAttachment } from './dataverse'

export interface UserProfile {
  "createdon"?: string
  "exchangerate"?: number
  "oma_financialyearstart"?: string
  "oma_fullname"?: string
  "importsequencenumber"?: number
  "modifiedon"?: string
  "oma_monthlyincome"?: number
  "oma_monthlyincome_base"?: number
  "oma_profilename"?: string
  "overriddencreatedon"?: string
  "oma_risktolerance"?: number
  "statuscode"?: number
  "statecode"?: number
  "timezoneruleversionnumber"?: number
  "oma_userprofileid"?: string
  "utcconversiontimezonecode"?: number
  "versionnumber"?: number
  "_createdby_value"?: string
  "_createdonbehalfby_value"?: string
  "_createdonbehalfby_type"?: string
  "_createdby_type"?: string
  "_transactioncurrencyid_value"?: string
  "_transactioncurrencyid_type"?: string
  "_oma_defaultcurrency_value"?: string
  "_oma_defaultcurrency_type"?: string
  "_modifiedby_value"?: string
  "_modifiedonbehalfby_value"?: string
  "_modifiedonbehalfby_type"?: string
  "_modifiedby_type"?: string
  "_ownerid_value"?: string
  "_ownerid_type"?: string
  "_owningbusinessunit_value"?: string
  "_owningbusinessunit_type"?: string
  "_oma_risktolerance_label"?: string
  "_statecode_label"?: string
  "_statuscode_label"?: string
  "{Attachments}"?: DataverseAttachment[]
}
