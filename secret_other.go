//go:build !windows

package main

func protectSecret(value string) (string, bool) {
	return value, false
}

func unprotectSecret(value string, protected bool) string {
	return value
}
