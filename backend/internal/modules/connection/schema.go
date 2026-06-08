package connection

const (
	DBTypePostgres  = "postgres"
	DBTypeMySQL     = "mysql"
	DBTypeSnowflake = "snowflake"
	DBTypeBigQuery  = "bigquery"
	DBTypeSQLite    = "sqlite"

	StatusConnected = "connected"
	StatusError     = "error"
	StatusPending   = "pending"
)

type AddConnectionSchema struct {
	Name         string `json:"name" binding:"required"`
	DBType       string `json:"db_type" binding:"required,oneof=postgres mysql snowflake bigquery sqlite"`
	Host         string `json:"host" binding:"required"`
	Port         int32  `json:"port" binding:"required,min=1,max=65535"`
	DatabaseName string `json:"database_name" binding:"required"`
	Username     string `json:"username" binding:"required"`
	Password     string `json:"password" binding:"required"`
	UseTLS       bool   `json:"use_tls"`
}

// ProbeConnectionSchema is used by the "test before saving" endpoint.
// Identical to AddConnectionSchema minus the name field.
type ProbeConnectionSchema struct {
	DBType       string `json:"db_type" binding:"required,oneof=postgres mysql snowflake bigquery sqlite"`
	Host         string `json:"host" binding:"required"`
	Port         int32  `json:"port" binding:"required,min=1,max=65535"`
	DatabaseName string `json:"database_name" binding:"required"`
	Username     string `json:"username" binding:"required"`
	Password     string `json:"password" binding:"required"`
	UseTLS       bool   `json:"use_tls"`
}
