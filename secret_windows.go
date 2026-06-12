//go:build windows

package main

import (
	"encoding/base64"
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

func protectSecret(value string) (string, bool) {
	if value == "" {
		return "", true
	}

	inputBytes := []byte(value)
	input := dataBlob{cbData: uint32(len(inputBytes)), pbData: &inputBytes[0]}
	var output dataBlob

	ok, _, _ := procCryptProtectData.Call(
		uintptr(unsafe.Pointer(&input)),
		0,
		0,
		0,
		0,
		0,
		uintptr(unsafe.Pointer(&output)),
	)
	if ok == 0 || output.pbData == nil || output.cbData == 0 {
		return value, false
	}
	defer procLocalFree.Call(uintptr(unsafe.Pointer(output.pbData)))

	protected := make([]byte, int(output.cbData))
	copy(protected, unsafe.Slice(output.pbData, int(output.cbData)))

	return base64.StdEncoding.EncodeToString(protected), true
}

func unprotectSecret(value string, protected bool) string {
	if value == "" || !protected {
		return value
	}

	inputBytes, err := base64.StdEncoding.DecodeString(value)
	if err != nil || len(inputBytes) == 0 {
		return value
	}

	input := dataBlob{cbData: uint32(len(inputBytes)), pbData: &inputBytes[0]}
	var output dataBlob

	ok, _, _ := procCryptUnprotectData.Call(
		uintptr(unsafe.Pointer(&input)),
		0,
		0,
		0,
		0,
		0,
		uintptr(unsafe.Pointer(&output)),
	)
	if ok == 0 || output.pbData == nil {
		return value
	}
	defer procLocalFree.Call(uintptr(unsafe.Pointer(output.pbData)))

	plain := make([]byte, int(output.cbData))
	copy(plain, unsafe.Slice(output.pbData, int(output.cbData)))

	return string(plain)
}
