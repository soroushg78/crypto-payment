package schema

import "embed"

//go:embed *.sql
var SchemaFS embed.FS
