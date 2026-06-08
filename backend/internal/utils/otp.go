package utils

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

func GenerateSecureOtp() (string, error) {
	max := big.NewInt(900000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()+100000), nil
}
