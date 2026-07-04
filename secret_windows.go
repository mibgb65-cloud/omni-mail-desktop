//go:build windows

package main

import (
	"encoding/base64"
	"errors"
	"fmt"
	"syscall"
	"unsafe"
)

type dataBlob struct {
	cbData uint32
	pbData *byte
}

var (
	crypt32                = syscall.NewLazyDLL("Crypt32.dll")
	kernel32               = syscall.NewLazyDLL("Kernel32.dll")
	procCryptProtectData   = crypt32.NewProc("CryptProtectData")
	procCryptUnprotectData = crypt32.NewProc("CryptUnprotectData")
	procLocalFree          = kernel32.NewProc("LocalFree")
)

func protectSecret(value string) (string, bool, error) {
	if value == "" {
		return "", true, nil
	}

	inputBytes := []byte(value)
	input := dataBlob{cbData: uint32(len(inputBytes)), pbData: &inputBytes[0]}
	var output dataBlob

	ok, _, callErr := procCryptProtectData.Call(
		uintptr(unsafe.Pointer(&input)),
		0,
		0,
		0,
		0,
		0,
		uintptr(unsafe.Pointer(&output)),
	)
	if ok == 0 || output.pbData == nil || output.cbData == 0 {
		return "", false, windowsSecretError("protect secret with DPAPI", callErr)
	}
	defer procLocalFree.Call(uintptr(unsafe.Pointer(output.pbData)))

	protected := make([]byte, int(output.cbData))
	copy(protected, unsafe.Slice(output.pbData, int(output.cbData)))

	return base64.StdEncoding.EncodeToString(protected), true, nil
}

func unprotectSecret(value string, protected bool) (string, error) {
	if value == "" || !protected {
		return value, nil
	}

	inputBytes, err := base64.StdEncoding.DecodeString(value)
	if err != nil || len(inputBytes) == 0 {
		if err != nil {
			return "", fmt.Errorf("decode protected secret: %w", err)
		}
		return "", errors.New("decode protected secret: empty payload")
	}

	input := dataBlob{cbData: uint32(len(inputBytes)), pbData: &inputBytes[0]}
	var output dataBlob

	ok, _, callErr := procCryptUnprotectData.Call(
		uintptr(unsafe.Pointer(&input)),
		0,
		0,
		0,
		0,
		0,
		uintptr(unsafe.Pointer(&output)),
	)
	if ok == 0 || output.pbData == nil {
		return "", windowsSecretError("unprotect secret with DPAPI", callErr)
	}
	defer procLocalFree.Call(uintptr(unsafe.Pointer(output.pbData)))

	plain := make([]byte, int(output.cbData))
	copy(plain, unsafe.Slice(output.pbData, int(output.cbData)))

	return string(plain), nil
}

func windowsSecretError(operation string, err error) error {
	if err == nil {
		return errors.New(operation + " failed")
	}
	if errno, ok := err.(syscall.Errno); ok && errno == 0 {
		return errors.New(operation + " failed")
	}

	return fmt.Errorf("%s: %w", operation, err)
}
