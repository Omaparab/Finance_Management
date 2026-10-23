import type { DataverseAttachment } from './dataverse'

export interface Category {
  "oma_categoryid"?: string
  "oma_categoryname"?: string
  "oma_categorytype"?: number
  "oma_color"?: string
  "createdon"?: string
  "oma_icon"?: string
  "importsequencenumber"?: number
  "oma_issystem"?: boolean
  "modifiedon"?: string
  "overriddencreatedon"?: string
  "statuscode"?: number
  "statecode"?: number
  "timezoneruleversionnumber"?: number
  "utcconversiontimezonecode"?: number
  "versionnumber"?: number
  "_oma_categorytype_label"?: string
  "_createdby_value"?: string
  "_createdonbehalfby_value"?: string
  "_createdonbehalfby_type"?: string
  "_createdby_type"?: string
  "_modifiedby_value"?: string
  "_modifiedonbehalfby_value"?: string
  "_modifiedonbehalfby_type"?: string
  "_modifiedby_type"?: string
  "_ownerid_value"?: string
  "_ownerid_type"?: string
  "_owningbusinessunit_value"?: string
  "_owningbusinessunit_type"?: string
  "_oma_parentcategory_value"?: string
  "_oma_parentcategory_type"?: string
  "_statecode_label"?: string
  "_statuscode_label"?: string
  "_oma_userprofile_value"?: string
  "_oma_userprofile_type"?: string
  "{Attachments}"?: DataverseAttachment[]
}
