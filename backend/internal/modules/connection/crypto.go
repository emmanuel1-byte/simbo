package connection

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"os"
)

// Encryptor encrypts and decrypts credential strings.
// Inject a real implementation via NewHandler; use PlaintextEncryptor in tests.
type Encryptor interface {
	Encrypt(plaintext string) (string, error)
	Decrypt(ciphertext string) (string, error)
}

// AESEncryptor uses AES-256-GCM.
// The key is derived by SHA-256 hashing the ENCRYPTION_KEY env var so any
// string length is accepted while always producing a 32-byte AES key.
type AESEncryptor struct{}

func (e AESEncryptor) key() []byte {
	h := sha256.Sum256([]byte(os.Getenv("ENCRYPTION_KEY")))
	return h[:]
}

func (e AESEncryptor) Encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(e.key())
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(sealed), nil
}

func (e AESEncryptor) Decrypt(encoded string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(e.key())
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	ns := gcm.NonceSize()
	if len(data) < ns {
		return "", errors.New("ciphertext too short")
	}
	plain, err := gcm.Open(nil, data[:ns], data[ns:], nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

// PlaintextEncryptor is a no-op encryptor for tests — never use in production.
type PlaintextEncryptor struct{}

func (PlaintextEncryptor) Encrypt(p string) (string, error) { return p, nil }
func (PlaintextEncryptor) Decrypt(p string) (string, error) { return p, nil }
