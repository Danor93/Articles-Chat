package handlers

import (
	"encoding/json"
)

func toJSON(v interface{}) string {
	data, err := json.Marshal(v)
	if err != nil {
		return "{\"error\":\"json_marshal_failed\"}"
	}
	return string(data)
}